from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.core.pagination import Page
from app.models.user import User
from app.schemas.connection import ConnectionCountResponse, ConnectionResponse
from app.schemas.user import (
    ContactDetails,
    UserProfile,
    UserResponse,
    UserUpdate,
)
from app.services import connection_service, user_service

router = APIRouter(prefix="/users", tags=["users"])

DbDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_active_user)]


@router.get("/{user_id}", response_model=UserProfile)
def get_user(
    user_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> UserProfile:
    return user_service.get_public_profile(db, user_id)


@router.get("/{user_id}/contact", response_model=ContactDetails)
def get_user_contact(
    user_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ContactDetails:
    """Owner or connected users only — unrelated callers get 403."""
    return user_service.get_contact_details(
        db, user_id, current_user=current_user
    )


@router.get("/{user_id}/connections", response_model=Page[ConnectionResponse])
def list_user_connections(
    user_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> Page[ConnectionResponse]:
    return connection_service.list_connections(
        db, user_id, page=page, page_size=page_size
    )


@router.get(
    "/{user_id}/connections/count", response_model=ConnectionCountResponse
)
def count_user_connections(
    user_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ConnectionCountResponse:
    return ConnectionCountResponse(
        count=connection_service.count_connections(db, user_id)
    )


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: DbDep,
    current_user: CurrentUser,
) -> UserResponse:
    return user_service.update_profile(db, user_id, payload, current_user)
