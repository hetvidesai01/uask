import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.core.enums import AskStatus
from app.schemas.base import CamelModel
from app.schemas.user import UserPublic


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

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        return v.upper()

    @model_validator(mode="after")
    def budget_order(self) -> "AskBase":
        if (
            self.budget_min is not None
            and self.budget_max is not None
            and self.budget_max < self.budget_min
        ):
            raise ValueError("budget_max must be >= budget_min")
        return self


class AskCreate(AskBase):
    pass


class AskUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=10, max_length=140)
    description: str | None = Field(default=None, min_length=30, max_length=5000)
    category: str | None = Field(default=None, min_length=1, max_length=60)
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    deadline: date | None = None
    location: str | None = Field(default=None, max_length=120)
    is_remote: bool | None = None
    attachments: list[dict[str, Any]] | None = Field(default=None, max_length=5)


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
