import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field, field_validator

from app.core.enums import UserRole
from app.schemas.base import CamelModel


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
    name: str | None = Field(default=None, min_length=2, max_length=80)
    avatar_url: str | None = None
    bio: str | None = Field(default=None, max_length=1000)
    location: str | None = Field(default=None, max_length=120)
    categories: list[str] | None = Field(default=None, max_length=10)
    roles: list[UserRole] | None = None


class PasswordUpdate(CamelModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserPublic(CamelModel):
    id: uuid.UUID
    name: str
    avatar_url: str | None = None
    rating: Decimal = Decimal("0.0")
    review_count: int = 0


class UserResponse(UserBase):
    id: uuid.UUID
    email: str
    rating: Decimal = Decimal("0.0")
    review_count: int = 0
    is_active: bool = True
    joined_at: datetime
    updated_at: datetime
