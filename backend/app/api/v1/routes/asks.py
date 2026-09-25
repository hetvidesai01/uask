from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_roles
from app.core.enums import AskStatus
from app.core.pagination import Page
from app.models.user import User
from app.schemas.ask import AskCreate, AskResponse, AskSort, AskUpdate
from app.services import ask_service

router = APIRouter(prefix="/asks", tags=["asks"])

DbDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_active_user)]
SeekerUser = Annotated[User, Depends(require_roles("seeker"))]


@router.get("", response_model=Page[AskResponse])
def list_asks(
    db: DbDep,
    current_user: CurrentUser,
    q: str | None = Query(default=None, max_length=200),
    category: str | None = Query(default=None, max_length=60),
    status_filter: AskStatus | None = Query(default=None, alias="status"),
    min_budget: Annotated[
        Decimal | None, Query(alias="minBudget", ge=0)
    ] = None,
    max_budget: Annotated[
        Decimal | None, Query(alias="maxBudget", ge=0)
    ] = None,
    location: str | None = Query(default=None, max_length=120),
    is_remote: Annotated[bool | None, Query(alias="isRemote")] = None,
    requester_id: Annotated[UUID | None, Query(alias="requesterId")] = None,
    sort: AskSort = "newest",
    page: int = Query(default=1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> Page[AskResponse]:
    return ask_service.list_asks(
        db,
        q=q,
        category=category,
        status=status_filter,
        min_budget=min_budget,
        max_budget=max_budget,
        location=location,
        is_remote=is_remote,
        requester_id=requester_id,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=AskResponse, status_code=status.HTTP_201_CREATED)
def create_ask(
    payload: AskCreate,
    db: DbDep,
    current_user: SeekerUser,
) -> AskResponse:
    return ask_service.create_ask(db, payload, current_user)


@router.get("/{ask_id}", response_model=AskResponse)
def get_ask(
    ask_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> AskResponse:
    return ask_service.get_ask(db, ask_id)


@router.patch("/{ask_id}", response_model=AskResponse)
def update_ask(
    ask_id: UUID,
    payload: AskUpdate,
    db: DbDep,
    current_user: CurrentUser,
) -> AskResponse:
    return ask_service.update_ask(db, ask_id, payload, current_user)


@router.delete("/{ask_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ask(
    ask_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> None:
    ask_service.delete_ask(db, ask_id, current_user)
