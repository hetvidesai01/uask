"""ASK data access: filtered/sorted list queries and live-offer counts."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import AskStatus
from app.models.ask import Ask
from app.models.offer import Offer


def _response_count_subq():
    return (
        select(func.count())
        .where(Offer.ask_id == Ask.id, Offer.deleted_at.is_(None))
        .correlate(Ask)
        .scalar_subquery()
        .label("response_count")
    )


def _apply_filters(
    stmt: Select,
    *,
    q: str | None,
    category: str | None,
    status: AskStatus | None,
    min_budget: Decimal | None,
    max_budget: Decimal | None,
    location: str | None,
    is_remote: bool | None,
    requester_id: UUID | None,
) -> Select:
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Ask.title.ilike(pattern), Ask.description.ilike(pattern)))
    if category:
        stmt = stmt.where(func.lower(Ask.category) == category.lower())
    if status is not None:
        stmt = stmt.where(Ask.status == status)
    if min_budget is not None:
        stmt = stmt.where(Ask.budget_max.is_not(None), Ask.budget_max >= min_budget)
    if max_budget is not None:
        stmt = stmt.where(Ask.budget_min.is_not(None), Ask.budget_min <= max_budget)
    if location:
        stmt = stmt.where(Ask.location.ilike(f"%{location}%"))
    if is_remote is not None:
        stmt = stmt.where(Ask.is_remote.is_(is_remote))
    if requester_id is not None:
        stmt = stmt.where(Ask.requester_id == requester_id)
    return stmt


_SORTS: dict[str, tuple] = {
    "newest": (Ask.created_at.desc(), Ask.id.desc()),
    "oldest": (Ask.created_at.asc(), Ask.id.asc()),
    "budget_low": (Ask.budget_min.asc().nulls_last(), Ask.id.desc()),
    "budget_high": (Ask.budget_max.desc().nulls_last(), Ask.id.desc()),
    "deadline": (Ask.deadline.asc().nulls_last(), Ask.id.asc()),
}


def list_asks(
    session: Session,
    *,
    q: str | None = None,
    category: str | None = None,
    status: AskStatus | None = None,
    min_budget: Decimal | None = None,
    max_budget: Decimal | None = None,
    location: str | None = None,
    is_remote: bool | None = None,
    requester_id: UUID | None = None,
    sort: str = "newest",
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[tuple[Ask, int]], int]:
    """Non-deleted ASKs with filters + sort. Returns ((ask, response_count), total)."""
    filters = dict(
        q=q,
        category=category,
        status=status,
        min_budget=min_budget,
        max_budget=max_budget,
        location=location,
        is_remote=is_remote,
        requester_id=requester_id,
    )

    count_stmt = select(func.count()).select_from(Ask).where(Ask.deleted_at.is_(None))
    count_stmt = _apply_filters(count_stmt, **filters)
    total = session.scalar(count_stmt) or 0

    stmt = (
        select(Ask, _response_count_subq())
        .where(Ask.deleted_at.is_(None))
        .options(joinedload(Ask.requester))
    )
    stmt = _apply_filters(stmt, **filters)
    stmt = stmt.order_by(*_SORTS.get(sort, _SORTS["newest"]))
    stmt = stmt.offset(offset).limit(limit)
    rows = list(session.execute(stmt).unique().all())
    return rows, total


def get_ask(session: Session, ask_id: UUID) -> tuple[Ask, int] | None:
    """Fetch one non-deleted ASK with its live-offer count, or None."""
    stmt = (
        select(Ask, _response_count_subq())
        .where(Ask.id == ask_id, Ask.deleted_at.is_(None))
        .options(joinedload(Ask.requester))
    )
    return session.execute(stmt).unique().one_or_none()
