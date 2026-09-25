"""ASK business rules: ownership, soft delete, status guards. No HTTP."""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.enums import AskStatus
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.core.pagination import Page, PageParams, build_page
from app.models.ask import Ask
from app.models.user import User
from app.repositories import ask_repo
from app.schemas.ask import AskCreate, AskResponse, AskUpdate


def _ask_response(ask: Ask, response_count: int) -> AskResponse:
    resp = AskResponse.model_validate(ask)
    resp.response_count = response_count
    return resp


def list_asks(
    db: Session,
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
    page: int = 1,
    page_size: int = 20,
) -> Page[AskResponse]:
    if min_budget is not None and max_budget is not None and max_budget < min_budget:
        raise ValidationError("maxBudget must be >= minBudget.")

    pp = PageParams(page=page, page_size=page_size)
    rows, total = ask_repo.list_asks(
        db,
        q=q,
        category=category,
        status=status,
        min_budget=min_budget,
        max_budget=max_budget,
        location=location,
        is_remote=is_remote,
        requester_id=requester_id,
        sort=sort,
        offset=pp.offset,
        limit=pp.limit,
    )
    items = [_ask_response(ask, count) for ask, count in rows]
    return build_page(items, page=pp.page, page_size=pp.page_size, total=total)


def get_ask(db: Session, ask_id: UUID) -> AskResponse:
    row = ask_repo.get_ask(db, ask_id)
    if row is None:
        raise NotFoundError("Ask not found.", code="ASK_NOT_FOUND")
    ask, count = row
    return _ask_response(ask, count)


def create_ask(db: Session, payload: AskCreate, requester: User) -> AskResponse:
    now = datetime.now(UTC)
    ask = Ask(
        requester_id=requester.id,
        requester=requester,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        budget_min=payload.budget_min,
        budget_max=payload.budget_max,
        currency=payload.currency,
        deadline=payload.deadline,
        location=payload.location,
        is_remote=payload.is_remote,
        status=AskStatus.open,
        attachments=payload.attachments,
        created_at=now,
        updated_at=now,
    )
    db.add(ask)
    db.flush()
    resp = _ask_response(ask, 0)
    db.commit()
    return resp


def update_ask(
    db: Session, ask_id: UUID, payload: AskUpdate, current_user: User
) -> AskResponse:
    row = ask_repo.get_ask(db, ask_id)
    if row is None:
        raise NotFoundError("Ask not found.", code="ASK_NOT_FOUND")
    ask, count = row
    if ask.requester_id != current_user.id:
        raise ForbiddenError(
            "Only the ASK owner may update this ASK.", code="NOT_ASK_OWNER"
        )
    if ask.status in (AskStatus.closed, AskStatus.cancelled):
        raise ConflictError(
            "Closed or cancelled ASKs cannot be updated.",
            code="ASK_NOT_EDITABLE",
        )

    data = payload.model_dump(exclude_unset=True)
    new_min = data.get("budget_min", ask.budget_min)
    new_max = data.get("budget_max", ask.budget_max)
    if (new_min is None) != (new_max is None):
        raise ValidationError(
            "budget_min and budget_max must both be set or both be omitted."
        )
    if new_min is not None and new_max is not None and new_max < new_min:
        raise ValidationError("budget_max must be >= budget_min.")

    for key, value in data.items():
        setattr(ask, key, value)
    db.flush()
    resp = _ask_response(ask, count)
    db.commit()
    return resp


def delete_ask(db: Session, ask_id: UUID, current_user: User) -> None:
    row = ask_repo.get_ask(db, ask_id)
    if row is None:
        raise NotFoundError("Ask not found.", code="ASK_NOT_FOUND")
    ask, _ = row
    if ask.requester_id != current_user.id:
        raise ForbiddenError(
            "Only the ASK owner may delete this ASK.", code="NOT_ASK_OWNER"
        )
    ask.deleted_at = datetime.now(UTC)
    db.commit()
