import uuid
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Literal

from pydantic import Field, field_serializer, field_validator

from app.core.enums import (
    AmendmentStatus,
    ContractStatus,
    DisputeReason,
    DisputeStatus,
    OwnershipOption,
    PaymentStageStatus,
    PortfolioPermission,
    StageKind,
)
from app.schemas.base import CamelModel

# Progress checkpoints the workflow supports. The server never accepts an
# arbitrary value — these are the only legal contract progress states.
PROGRESS_CHECKPOINTS = (0, 25, 60, 100)


class MilestoneStatusUpdate(CamelModel):
    """PATCH body for a payment stage — only `paid` is accepted.

    The prototype payment flow is stage-driven: the ASK side marks a stage
    that has become `due` as `paid`. Every other transition is handled by the
    sign / progress / approve endpoints, so this stays deliberately narrow.
    """

    status: Literal["paid"]


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


class ProgressSubmit(CamelModel):
    """POST /contracts/{id}/progress body — respond side only.

    Only the next checkpoint (60 mid-project, 100 final) may be submitted;
    anything else is rejected so the frontend cannot invent progress.
    """

    progress: Literal[60, 100]


class DisputeCreate(CamelModel):
    """POST /contracts/{id}/disputes body — either participant."""

    reason: DisputeReason
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class CancellationRequest(CamelModel):
    """POST /contracts/{id}/cancellation-request body — either participant."""

    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("A cancellation reason is required.")
        return v


class AmendmentCreate(CamelModel):
    """POST /contracts/{id}/amendments body — either participant.

    `changes` holds only the terms being amended, keyed by the contract
    response field name (camelCase), e.g. {"scope": "..."}.
    """

    changes: dict[str, Any]
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("changes")
    @classmethod
    def non_empty_changes(cls, v: dict[str, Any]) -> dict[str, Any]:
        if not v:
            raise ValueError("An amendment must propose at least one change.")
        return v


# --------------------------------------------------------------------------
# Responses
# --------------------------------------------------------------------------


class MilestoneResponse(CamelModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    title: str
    description: str | None = None
    amount: Decimal
    due_date: date | None = None
    status: PaymentStageStatus
    kind: StageKind

    @field_serializer("amount")
    def _serialize_amount(self, value: Decimal) -> float:
        return float(value)


class ContractHistoryResponse(CamelModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    actor_id: uuid.UUID | None = None
    action: str
    details: dict[str, Any]
    created_at: datetime


class ContractDisputeResponse(CamelModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    raised_by: uuid.UUID
    reason: DisputeReason
    description: str | None = None
    status: DisputeStatus
    created_at: datetime
    resolved_at: datetime | None = None


class ContractAmendmentResponse(CamelModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    proposed_by: uuid.UUID
    status: AmendmentStatus
    changes: dict[str, Any]
    reason: str | None = None
    edit_number: int
    resolved_by: uuid.UUID | None = None
    created_at: datetime
    resolved_at: datetime | None = None


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

    # ---- Terms snapshot ----
    scope: str | None = None
    final_deadline: date | None = None
    included_revision_count: int
    revisions_used: int
    ownership_option: OwnershipOption
    portfolio_permission: PortfolioPermission
    confidentiality_agreed: bool
    terms_version: str

    # ---- Signatures ----
    ask_side_signed_at: datetime | None = None
    respond_side_signed_at: datetime | None = None

    # ---- Derived progress + edit accounting ----
    project_progress: int
    contract_edit_count: int
    calculated_edit_fee: float

    # ---- Prototype fee breakdown (informational; no money moves) ----
    project_value: float
    platform_fee: float
    provider_commission: float

    # ---- Cancellation + dispute summary ----
    cancellation_requested: bool
    cancellation_reason: str | None = None
    cancellation_requested_at: datetime | None = None
    cancellation_progress_snapshot: int | None = None
    cancellation_termination_estimate_pct: float | None = None
    has_open_dispute: bool

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
