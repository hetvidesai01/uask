"""Contract + milestone queries. Aggregates for reputation are SQL-side."""

from uuid import UUID

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import ContractStatus, MilestoneStatus
from app.models.contract import Contract, Milestone


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
