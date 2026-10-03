import uuid
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal

from pydantic import Field, field_serializer, field_validator

from app.core.enums import ContractStatus, MilestoneStatus
from app.schemas.base import CamelModel


class MilestoneStatusUpdate(CamelModel):
    """PATCH body — status only; role + transition validity live in the service."""

    status: MilestoneStatus


class RatingCreate(CamelModel):
    """POST /contracts/{id}/rating body — seeker only, set once."""

    rating: Decimal = Field(ge=0, le=5)
    review: str | None = Field(default=None, max_length=1000)

    @field_validator("rating")
    @classmethod
    def one_decimal(cls, v: Decimal) -> Decimal:
        return Decimal(v).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)

    @field_validator("review")
    @classmethod
    def review_or_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class MilestoneResponse(CamelModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    title: str
    description: str | None = None
    amount: Decimal
    due_date: date | None = None
    status: MilestoneStatus

    @field_serializer("amount")
    def _serialize_amount(self, value: Decimal) -> float:
        return float(value)


class ContractResponse(CamelModel):
    id: uuid.UUID
    ask_id: uuid.UUID
    offer_id: uuid.UUID
    seeker_id: uuid.UUID
    provider_id: uuid.UUID
    agreed_price: Decimal
    currency: str
    deliverables: list[str]
    status: ContractStatus
    rating: Decimal | None = None
    review: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
    milestones: list[MilestoneResponse] = Field(default_factory=list)

    @field_serializer("agreed_price")
    def _serialize_price(self, value: Decimal) -> float:
        return float(value)

    @field_serializer("rating")
    def _serialize_rating(self, value: Decimal | None) -> float | None:
        return None if value is None else float(value)


class CompletedContractResponse(CamelModel):
    """Public-safe subset for GET /users/{id}/completed-contracts."""

    id: uuid.UUID
    ask_id: uuid.UUID
    ask_title: str
    agreed_price: Decimal
    currency: str
    status: ContractStatus
    completed_at: datetime | None = None
    rating: Decimal | None = None
    review: str | None = None

    @field_serializer("agreed_price")
    def _serialize_price(self, value: Decimal) -> float:
        return float(value)

    @field_serializer("rating")
    def _serialize_rating(self, value: Decimal | None) -> float | None:
        return None if value is None else float(value)


class ReputationResponse(CamelModel):
    """GET /users/{id}/reputation — derived, read-only."""

    revenue: float
    average_rating: float
    review_count: int
    completed_contract_count: int
    completed_milestone_count: int
    total_milestone_count: int
    profile_booster_pct: int
