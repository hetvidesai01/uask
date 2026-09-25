from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.user import UserProfile, UserResponse, UserUpdate
from app.services import user_service

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


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: DbDep,
    current_user: CurrentUser,
) -> UserResponse:
    return user_service.update_profile(db, user_id, payload, current_user)
