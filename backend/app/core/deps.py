from collections.abc import Callable, Generator
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError("Not authenticated.", code="UNAUTHORIZED")

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Invalid access token.", code="UNAUTHORIZED")

    try:
        uid = UUID(str(user_id))
    except ValueError as exc:
        raise UnauthorizedError("Invalid access token.", code="UNAUTHORIZED") from exc

    user = db.get(User, uid)
    if user is None:
        raise UnauthorizedError("User not found.", code="UNAUTHORIZED")
    return user


def get_current_active_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not user.is_active:
        raise UnauthorizedError("Account is deactivated.", code="UNAUTHORIZED")
    return user


def get_optional_user(
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User | None:
    if credentials is None or not credentials.credentials:
        return None
    try:
        return get_current_user(db, credentials)
    except UnauthorizedError:
        return None


def require_roles(*roles: str) -> Callable[..., User]:
    allowed = set(roles)

    def dependency(
        user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        user_roles = {r.value if hasattr(r, "value") else str(r) for r in user.roles}
        if not user_roles.intersection(allowed):
            raise ForbiddenError("Insufficient role.", code="FORBIDDEN")
        return user

    return dependency
