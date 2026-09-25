import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import Field, field_serializer, field_validator

from app.core.enums import OfferStatus
from app.schemas.base import CamelModel


class OfferBase(CamelModel):
    price: Decimal = Field(ge=0, le=10_000_000)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    delivery_days: int = Field(ge=1, le=365)
    pitch: str = Field(min_length=30, max_length=3000)
    deliverables: list[str] = Field(default_factory=list, max_length=10)
    attachments: list[dict[str, Any]] = Field(default_factory=list, max_length=5)

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        return v.upper()

    @field_validator("deliverables")
    @classmethod
    def deliverables_len(cls, v: list[str]) -> list[str]:
        for item in v:
            if len(item) > 120:
                raise ValueError("each deliverable must be <= 120 chars")
        return v

    @field_serializer("price")
    def _serialize_price(self, value: Decimal) -> float:
        return float(value)


class OfferCreate(OfferBase):
    pass


class OfferUpdate(CamelModel):
    # Non-nullable columns use a non-Optional annotation with default=None:
    # omitted fields are dropped via exclude_unset; explicit null -> 422.
    price: Decimal = Field(default=None, ge=0, le=10_000_000)
    currency: str = Field(default=None, min_length=3, max_length=3)
    delivery_days: int = Field(default=None, ge=1, le=365)
    pitch: str = Field(default=None, min_length=30, max_length=3000)
    deliverables: list[str] = Field(default=None, max_length=10)
    attachments: list[dict[str, Any]] = Field(default=None, max_length=5)
    status: OfferStatus = Field(default=None)

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        return v.upper()

    @field_validator("deliverables")
    @classmethod
    def deliverables_len(cls, v: list[str]) -> list[str]:
        for item in v:
            if len(item) > 120:
                raise ValueError("each deliverable must be <= 120 chars")
        return v


class OfferStatusUpdate(CamelModel):
    status: OfferStatus


class OfferResponse(OfferBase):
    id: uuid.UUID
    ask_id: uuid.UUID
    provider_id: uuid.UUID
    status: OfferStatus
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
