import re
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import Field, field_serializer, field_validator, model_validator

from app.core.enums import AskStatus
from app.schemas.base import CamelModel
from app.schemas.user import UserPublic
from app.utils.validators import normalize_category

AskSort = Literal["newest", "oldest", "budget_low", "budget_high", "deadline"]


class AskBase(CamelModel):
    title: str = Field(min_length=10, max_length=140)
    description: str = Field(min_length=30, max_length=5000)
    category: str = Field(min_length=1, max_length=60)
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    deadline: date | None = None
    location: str | None = Field(default=None, max_length=120)
    is_remote: bool = False
    attachments: list[dict[str, Any]] = Field(default_factory=list, max_length=5)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        return normalize_category(v)

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        v = v.upper()
        if not re.fullmatch(r"[A-Z]{3}", v):
            raise ValueError("currency must be a 3-letter ISO-4217 code.")
        return v

    @model_validator(mode="after")
    def budget_order(self) -> "AskBase":
        if (
            self.budget_min is not None
            and self.budget_max is not None
            and self.budget_max < self.budget_min
        ):
            raise ValueError("budget_max must be >= budget_min")
        return self

    @field_serializer("budget_min", "budget_max")
    def _serialize_money(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None


class AskCreate(AskBase):
    @field_validator("deadline")
    @classmethod
    def deadline_not_past(cls, v: date | None) -> date | None:
        if v is not None and v < datetime.now(UTC).date():
            raise ValueError("deadline must be today or later.")
        return v

    @model_validator(mode="after")
    def budget_pairing(self) -> "AskCreate":
        if (self.budget_min is None) != (self.budget_max is None):
            raise ValueError(
                "budget_min and budget_max must both be set or both be omitted."
            )
        return self


class AskUpdate(CamelModel):
    # Non-nullable columns use a non-Optional annotation with default=None:
    # omitted fields are dropped via exclude_unset; explicit null → 422.
    title: str = Field(default=None, min_length=10, max_length=140)
    description: str = Field(default=None, min_length=30, max_length=5000)
    category: str = Field(default=None, min_length=1, max_length=60)
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default=None, min_length=3, max_length=3)
    deadline: date | None = None
    location: str | None = Field(default=None, max_length=120)
    is_remote: bool = Field(default=None)
    attachments: list[dict[str, Any]] = Field(default=None, max_length=5)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        return normalize_category(v)

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        v = v.upper()
        if not re.fullmatch(r"[A-Z]{3}", v):
            raise ValueError("currency must be a 3-letter ISO-4217 code.")
        return v

    @field_validator("deadline")
    @classmethod
    def deadline_not_past(cls, v: date | None) -> date | None:
        if v is not None and v < datetime.now(UTC).date():
            raise ValueError("deadline must be today or later.")
        return v

    @field_serializer("budget_min", "budget_max")
    def _serialize_money(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None


class AskStatusUpdate(CamelModel):
    status: AskStatus


class AskResponse(AskBase):
    id: uuid.UUID
    requester_id: uuid.UUID
    status: AskStatus
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    requester: UserPublic | None = None
    response_count: int = 0
