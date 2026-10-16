"""Contract + milestone + history/dispute/amendment queries.

Aggregates for reputation stay SQL-side. New-table lookups keep the service
layer free of raw SQLAlchemy where practical.
"""

from uuid import UUID

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import (
    AmendmentStatus,
    ContractStatus,
    DisputeStatus,
    MilestoneStatus,
)
from app.models.contract import (
    Contract,
    ContractAmendment,
    ContractDispute,
    ContractHistory,
    Milestone,
)


def _with_milestones(stmt):
    return stmt.options(selectinload(Contract.milestones))


def get_contract(db: Session, contract_id: UUID) -> Contract | None:
    stmt = _with_milestones(select(Contract).where(Contract.id == contract_id))
    return db.scalar(stmt)


def find_by_ask(db: Session, ask_id: UUID) -> Contract | None:
    stmt = _with_milestones(select(Contract).where(Contract.ask_id == ask_id))
    return db.scalar(stmt)


def get_milestone(
    db: Session, contract_id: UUID, milestone_id: UUID
) -> Milestone | None:
    stmt = select(Milestone).where(
        Milestone.contract_id == contract_id,
        Milestone.id == milestone_id,
    )
    return db.scalar(stmt)


def _user_clause(user_id: UUID):
    return or_(Contract.seeker_id == user_id, Contract.provider_id == user_id)


def list_for_user(
    db: Session, user_id: UUID, *, offset: int, limit: int
) -> tuple[list[Contract], int]:
    where = _user_clause(user_id)
    total = db.scalar(
        select(func.count()).select_from(Contract).where(where)
    )
    stmt = (
        _with_milestones(select(Contract))
        .where(where)
        .order_by(Contract.created_at.desc(), Contract.id.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = list(db.scalars(stmt).all())
    return rows, int(total or 0)


def list_completed_for_user(
    db: Session, user_id: UUID, *, offset: int, limit: int
) -> tuple[list[Contract], int]:
    where = _user_clause(user_id) & (Contract.status == ContractStatus.completed)
    total = db.scalar(
        select(func.count()).select_from(Contract).where(where)
    )
    stmt = (
        _with_milestones(select(Contract))
        .where(where)
        .order_by(Contract.completed_at.desc(), Contract.id.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = list(db.scalars(stmt).all())
    return rows, int(total or 0)


# --------------------------------------------------------------------------
# History / disputes / amendments
# --------------------------------------------------------------------------


def add_history(
    db: Session,
    contract_id: UUID,
    action: str,
    *,
    actor_id: UUID | None = None,
    details: dict | None = None,
) -> ContractHistory:
    row = ContractHistory(
        contract_id=contract_id,
        actor_id=actor_id,
        action=action,
        details=details or {},
    )
    db.add(row)
    return row


def list_history(
    db: Session, contract_id: UUID, *, offset: int, limit: int
) -> tuple[list[ContractHistory], int]:
    where = ContractHistory.contract_id == contract_id
    total = db.scalar(
        select(func.count()).select_from(ContractHistory).where(where)
    )
    stmt = (
        select(ContractHistory)
        .where(where)
        .order_by(ContractHistory.created_at.asc(), ContractHistory.id.asc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(stmt).all()), int(total or 0)


def has_open_dispute(db: Session, contract_id: UUID) -> bool:
    stmt = select(func.count()).select_from(ContractDispute).where(
        ContractDispute.contract_id == contract_id,
        ContractDispute.status == DisputeStatus.open,
    )
    return int(db.scalar(stmt) or 0) > 0


def get_dispute(
    db: Session, contract_id: UUID, dispute_id: UUID
) -> ContractDispute | None:
    stmt = select(ContractDispute).where(
        ContractDispute.contract_id == contract_id,
        ContractDispute.id == dispute_id,
    )
    return db.scalar(stmt)


def list_disputes(
    db: Session, contract_id: UUID, *, offset: int, limit: int
) -> tuple[list[ContractDispute], int]:
    where = ContractDispute.contract_id == contract_id
    total = db.scalar(
        select(func.count()).select_from(ContractDispute).where(where)
    )
    stmt = (
        select(ContractDispute)
        .where(where)
        .order_by(ContractDispute.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(stmt).all()), int(total or 0)


def has_pending_amendment(db: Session, contract_id: UUID) -> bool:
    stmt = select(func.count()).select_from(ContractAmendment).where(
        ContractAmendment.contract_id == contract_id,
        ContractAmendment.status == AmendmentStatus.pending,
    )
    return int(db.scalar(stmt) or 0) > 0


def get_amendment(
    db: Session, contract_id: UUID, amendment_id: UUID
) -> ContractAmendment | None:
    stmt = select(ContractAmendment).where(
        ContractAmendment.contract_id == contract_id,
        ContractAmendment.id == amendment_id,
    )
    return db.scalar(stmt)


def list_amendments(
    db: Session, contract_id: UUID, *, offset: int, limit: int
) -> tuple[list[ContractAmendment], int]:
    where = ContractAmendment.contract_id == contract_id
    total = db.scalar(
        select(func.count()).select_from(ContractAmendment).where(where)
    )
    stmt = (
        select(ContractAmendment)
        .where(where)
        .order_by(ContractAmendment.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(stmt).all()), int(total or 0)


# --------------------------------------------------------------------------
# Reputation aggregates
# --------------------------------------------------------------------------


def provider_milestone_stats(
    db: Session, provider_id: UUID
) -> tuple[int, int, float]:
    """(total, paid, revenue) across the provider's contracts."""
    where = Contract.provider_id == provider_id
    stmt = (
        select(
            func.count(Milestone.id),
            func.coalesce(
                func.sum(
                    case((Milestone.status == MilestoneStatus.paid, 1), else_=0)
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (
                            Milestone.status == MilestoneStatus.paid,
                            Milestone.amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
        )
        .select_from(Milestone)
        .join(Contract, Contract.id == Milestone.contract_id)
        .where(where)
    )
    row = db.execute(stmt).one()
    return int(row[0]), int(row[1]), float(row[2])


def provider_completed_contract_count(db: Session, provider_id: UUID) -> int:
    stmt = select(func.count()).select_from(Contract).where(
        Contract.provider_id == provider_id,
        Contract.status == ContractStatus.completed,
    )
    return int(db.scalar(stmt) or 0)


def provider_rating_stats(
    db: Session, provider_id: UUID
) -> tuple[float, int]:
    """(rating_sum, review_count) over completed, rated contracts."""
    stmt = select(
        func.coalesce(func.sum(Contract.rating), 0),
        func.count(Contract.rating),
    ).where(
        Contract.provider_id == provider_id,
        Contract.status == ContractStatus.completed,
        Contract.rating.is_not(None),
    )
    row = db.execute(stmt).one()
    return float(row[0]), int(row[1])
