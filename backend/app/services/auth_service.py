"""Auth business rules. No FastAPI, no HTTP status codes."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest
from app.schemas.user import UserResponse


def _issue_tokens(user: User) -> tuple[str, str, RefreshToken]:
    """Return (access_token, opaque_refresh, refresh_row)."""
    settings = get_settings()
    access = create_access_token(
        user_id=str(user.id),
        roles=[r.value for r in user.roles],
    )
    opaque = generate_refresh_token()
    row = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(opaque),
        token_family_id=uuid4(),
        expires_at=datetime.now(UTC)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return access, opaque, row


def _user_response(user: User) -> UserResponse:
    return UserResponse.model_validate(user)


def signup(db: Session, payload: SignupRequest) -> tuple[UserResponse, str, str]:
    """Create user, issue tokens. Returns (user, access_token, refresh_token)."""
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise ConflictError("Email already registered.", code="EMAIL_TAKEN")

    now = datetime.now(UTC)
    user = User(
        name=payload.name.strip(),
        email=payload.email,
        password_hash=hash_password(payload.password),
        roles=payload.roles,
        joined_at=now,
        updated_at=now,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("Email already registered.", code="EMAIL_TAKEN") from exc

    access, opaque, row = _issue_tokens(user)
    db.add(row)
    # Snapshot before commit so expire_on_commit cannot invalidate the ORM instance
    user_response = _user_response(user)
    db.commit()
    return user_response, access, opaque


def login(db: Session, payload: LoginRequest) -> tuple[UserResponse, str, str]:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedError(
            "Invalid email or password.", code="INVALID_CREDENTIALS"
        )
    if not user.is_active:
        raise UnauthorizedError("Account is deactivated.", code="UNAUTHORIZED")

    access, opaque, row = _issue_tokens(user)
    db.add(row)
    user_response = _user_response(user)
    db.commit()
    return user_response, access, opaque


def refresh_rotate(db: Session, opaque_token: str | None) -> tuple[str, str]:
    """Rotate refresh token. Returns (new_access_token, new_opaque_refresh_token).

    Reuse detection: presenting an already-revoked token revokes every live
    token for that user and forces re-login.
    """
    if not opaque_token:
        raise UnauthorizedError("Refresh token missing.", code="UNAUTHORIZED")

    token_hash = hash_refresh_token(opaque_token)
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))

    if row is None:
        raise UnauthorizedError("Invalid refresh token.", code="UNAUTHORIZED")

    now = datetime.now(UTC)

    if row.revoked_at is not None:
        db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.user_id == row.user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=now),
        )
        db.commit()
        raise UnauthorizedError(
            "Refresh token reuse detected. Please log in again.",
            code="UNAUTHORIZED",
        )

    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires <= now:
        row.revoked_at = now
        db.commit()
        raise UnauthorizedError("Refresh token expired.", code="UNAUTHORIZED")

    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Account is unavailable.", code="UNAUTHORIZED")

    row.revoked_at = now
    access, opaque, new_row = _issue_tokens(user)
    new_row.token_family_id = row.token_family_id
    db.add(new_row)
    db.commit()
    return access, opaque


def logout(db: Session, user_id: UUID, opaque_token: str | None) -> None:
    """Revoke the presented refresh token family (or all live tokens)."""
    now = datetime.now(UTC)

    if opaque_token:
        token_hash = hash_refresh_token(opaque_token)
        row = db.scalar(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.user_id == user_id,
            )
        )
        if row is not None:
            db.execute(
                update(RefreshToken)
                .where(
                    RefreshToken.token_family_id == row.token_family_id,
                    RefreshToken.revoked_at.is_(None),
                )
                .values(revoked_at=now),
            )
            db.commit()
            return

    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now),
    )
    db.commit()
