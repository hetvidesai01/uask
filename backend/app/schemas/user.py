import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field, field_serializer, field_validator

from app.core.enums import UserRole
from app.schemas.base import CamelModel
from app.utils.validators import normalize_categories


class UserBase(CamelModel):
    name: str = Field(min_length=2, max_length=80)
    avatar_url: str | None = None
    bio: str | None = Field(default=None, max_length=1000)
    location: str | None = Field(default=None, max_length=120)
    categories: list[str] = Field(default_factory=list, max_length=10)
    roles: list[UserRole] = Field(min_length=1)


class UserCreate(UserBase):
    email: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserUpdate(CamelModel):
    # Non-nullable columns use a non-Optional annotation with default=None:
    # omitted fields are dropped via exclude_unset; explicit null → 422.
    name: str = Field(default=None, min_length=2, max_length=80)
    avatar_url: str | None = None
    bio: str | None = Field(default=None, max_length=1000)
    location: str | None = Field(default=None, max_length=120)
    categories: list[str] = Field(default=None, max_length=10)
    roles: list[UserRole] = Field(default=None, min_length=1)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank.")
        return v.strip()

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, v: list[str]) -> list[str]:
        return normalize_categories(v)

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: list[UserRole]) -> list[UserRole]:
        seen: set[UserRole] = set()
        unique: list[UserRole] = []
        for r in v:
            if r not in seen:
                seen.add(r)
                unique.append(r)
        return unique


class PasswordUpdate(CamelModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserPublic(CamelModel):
    id: uuid.UUID
    name: str
    avatar_url: str | None = None
    rating: Decimal = Decimal("0.0")
    review_count: int = 0

    @field_serializer("rating")
    def _serialize_rating(self, value: Decimal) -> float:
        return float(value)


class UserProfile(CamelModel):
    """Public profile for GET /users/{id} — no email, no credentials."""

    id: uuid.UUID
    name: str
    avatar_url: str | None = None
    bio: str | None = None
    location: str | None = None
    categories: list[str] = []
    roles: list[UserRole]
    rating: Decimal = Decimal("0.0")
    review_count: int = 0
    joined_at: datetime

    @field_serializer("rating")
    def _serialize_rating(self, value: Decimal) -> float:
        return float(value)


class UserResponse(UserBase):
    id: uuid.UUID
    email: str
    rating: Decimal = Decimal("0.0")
    review_count: int = 0
    is_active: bool = True
    joined_at: datetime
    updated_at: datetime

    @field_serializer("rating")
    def _serialize_rating(self, value: Decimal) -> float:
        return float(value)
