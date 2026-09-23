"""Password hashing, JWT access tokens, and opaque refresh-token helpers."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from passlib.context import CryptContext

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_TOKEN_BYTES = 32


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(plain_password, password_hash)
    except ValueError:
        return False


def create_access_token(*, user_id: str, roles: list[str]) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": user_id,
        "roles": roles,
        "iat": now,
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except ExpiredSignatureError as exc:
        raise UnauthorizedError(
            "Access token has expired.", code="TOKEN_EXPIRED"
        ) from exc
    except JWTError as exc:
        raise UnauthorizedError("Invalid access token.", code="UNAUTHORIZED") from exc

    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid access token.", code="UNAUTHORIZED")
    return payload


def generate_refresh_token() -> str:
    """Cryptographically secure opaque refresh token (32 random bytes, URL-safe)."""
    return secrets.token_urlsafe(REFRESH_TOKEN_BYTES)


def hash_refresh_token(token: str) -> str:
    """SHA-256 hex digest — only this is stored in the database."""
    if not token:
        raise ValueError("Refresh token must be a non-empty string.")
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
