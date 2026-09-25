"""User profile business rules. No FastAPI, no HTTP status codes."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.enums import UserRole
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.user import User
from app.schemas.user import UserProfile, UserResponse, UserUpdate


def get_public_profile(db: Session, user_id: UUID) -> UserProfile:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found.", code="USER_NOT_FOUND")
    return UserProfile.model_validate(user)


def update_profile(
    db: Session, user_id: UUID, payload: UserUpdate, current_user: User
) -> UserResponse:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found.", code="USER_NOT_FOUND")

    is_admin = UserRole.admin in current_user.roles
    if user.id != current_user.id and not is_admin:
        raise ForbiddenError(
            "You can only edit your own profile.", code="FORBIDDEN"
        )

    data = payload.model_dump(exclude_unset=True)
    roles = data.get("roles")
    if roles is not None and UserRole.admin in roles and not is_admin:
        raise ForbiddenError(
            "Only admins can grant the admin role.", code="FORBIDDEN"
        )

    for key, value in data.items():
        setattr(user, key, value)
    db.flush()
    resp = UserResponse.model_validate(user)
    db.commit()
    return resp
