import re

from pydantic import Field, field_validator

from app.core.enums import UserRole
from app.schemas.base import CamelModel
from app.schemas.user import UserResponse

_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


class SignupRequest(CamelModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    roles: list[UserRole] = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        return v

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: list[UserRole]) -> list[UserRole]:
        if not v:
            raise ValueError("At least one role is required.")
        if UserRole.admin in v:
            raise ValueError("Admin role cannot be self-assigned.")
        # dedupe preserving order
        seen: set[UserRole] = set()
        unique: list[UserRole] = []
        for r in v:
            if r not in seen:
                seen.add(r)
                unique.append(r)
        return unique


class LoginRequest(CamelModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class AuthResponse(CamelModel):
    user: UserResponse
    access_token: str


class RefreshResponse(CamelModel):
    access_token: str
