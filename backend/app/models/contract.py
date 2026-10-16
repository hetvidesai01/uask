import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
from app.db.base import Base, TimestampMixin

contract_status_enum = SAEnum(ContractStatus, name="contract_status")
milestone_status_enum = SAEnum(
    PaymentStageStatus, name="milestone_status"
)
stage_kind_enum = SAEnum(StageKind, name="stage_kind")
ownership_option_enum = SAEnum(OwnershipOption, name="ownership_option")
portfolio_permission_enum = SAEnum(
    PortfolioPermission, name="portfolio_permission"
)
dispute_reason_enum = SAEnum(DisputeReason, name="dispute_reason")
dispute_status_enum = SAEnum(DisputeStatus, name="dispute_status")
amendment_status_enum = SAEnum(AmendmentStatus, name="amendment_status")

DEFAULT_TERMS_VERSION = "demo-2026-10"


class Contract(Base, TimestampMixin):
    """One contract per accepted ASK/offer pair — created as a `draft`
    inside the same transaction that accepts the offer, then activated only
    once both sides sign.

    Carries a full terms snapshot so later ASK/offer edits never silently
    change the agreed contract.
    """

    __tablename__ = "contracts"
    __table_args__ = (
        CheckConstraint(
            "agreed_price >= 0", name="ck_contracts_agreed_price_nonneg"
        ),
        CheckConstraint(
            "char_length(currency) = 3", name="ck_contracts_currency_len"
        ),
        CheckConstraint(
            "rating >= 0 AND rating <= 5", name="ck_contracts_rating_range"
        ),
        CheckConstraint(
            "project_progress IN (0, 25, 60, 100)",
            name="ck_contracts_progress_values",
        ),
        CheckConstraint(
            "revisions_used >= 0", name="ck_contracts_revisions_used_nonneg"
        ),
        CheckConstraint(
            "included_revision_count >= 0",
            name="ck_contracts_included_revisions_nonneg",
        ),
        CheckConstraint(
            "contract_edit_count >= 0",
            name="ck_contracts_edit_count_nonneg",
        ),
        Index("uq_contracts_ask_id", "ask_id", unique=True),
        Index("uq_contracts_offer_id", "offer_id", unique=True),
        Index("ix_contracts_seeker_id", "seeker_id"),
        Index("ix_contracts_provider_id_status", "provider_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    ask_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("asks.id", ondelete="CASCADE"),
        nullable=False,
    )
    offer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("offers.id", ondelete="CASCADE"),
        nullable=False,
    )
    seeker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    agreed_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default="INR",
    )
    deliverables: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        server_default="{}",
    )
    status: Mapped[ContractStatus] = mapped_column(
        contract_status_enum,
        nullable=False,
        server_default=ContractStatus.draft.value,
    )

    # ---- Terms snapshot (frozen at creation; edits go via amendments) ----
    scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    included_revision_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="2"
    )
    revisions_used: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    ownership_option: Mapped[OwnershipOption] = mapped_column(
        ownership_option_enum,
        nullable=False,
        server_default=OwnershipOption.transfers_after_final_payment.value,
    )
    portfolio_permission: Mapped[PortfolioPermission] = mapped_column(
        portfolio_permission_enum,
        nullable=False,
        server_default=PortfolioPermission.ask_before_using.value,
    )
    confidentiality_agreed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    terms_version: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default=DEFAULT_TERMS_VERSION
    )

    # ---- Dual signatures ----
    ask_side_signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    respond_side_signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ---- Derived progress + edit accounting (never set by the client) ----
    project_progress: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    contract_edit_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )

    # ---- Cancellation request (recorded, never auto-terminating) ----
    cancellation_requested_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    cancellation_reason: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    cancellation_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancellation_progress_snapshot: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )

    # ---- Set-once rating: written only by the seeker, only after completion.
    rating: Mapped[Decimal | None] = mapped_column(
        Numeric(2, 1),
        nullable=True,
    )
    review: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    ask: Mapped["Ask"] = relationship(  # noqa: F821
        foreign_keys=[ask_id]
    )
    offer: Mapped["Offer"] = relationship(  # noqa: F821
        foreign_keys=[offer_id]
    )
    seeker: Mapped["User"] = relationship(  # noqa: F821
        foreign_keys=[seeker_id]
    )
    provider: Mapped["User"] = relationship(  # noqa: F821
        foreign_keys=[provider_id]
    )
    milestones: Mapped[list["Milestone"]] = relationship(
        back_populates="contract",
        cascade="all, delete-orphan",
        order_by="Milestone.position",
        passive_deletes=True,
    )


class Milestone(Base, TimestampMixin):
    """A payment stage of the 25/50/25 prototype schedule.

    Reuses the historical `milestones` table; `kind` marks which of the
    three fixed stages the row is. Amounts always sum to `agreed_price`.
    """

    __tablename__ = "milestones"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_milestones_amount_nonneg"),
        Index(
            "ix_milestones_contract_id_status", "contract_id", "status"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[PaymentStageStatus] = mapped_column(
        milestone_status_enum,
        nullable=False,
        server_default=PaymentStageStatus.not_due.value,
    )
    kind: Mapped[StageKind] = mapped_column(
        stage_kind_enum,
        nullable=False,
        server_default=StageKind.initial.value,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    contract: Mapped[Contract] = relationship(back_populates="milestones")


class ContractHistory(Base):
    """Append-only audit trail for a contract. No secrets are stored."""

    __tablename__ = "contract_histories"
    __table_args__ = (
        Index("ix_contract_histories_contract_id", "contract_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Null actor = a system-generated event (e.g. contract generated).
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(60), nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class ContractDispute(Base):
    """A dispute raised by either participant. Never auto-resolves."""

    __tablename__ = "contract_disputes"
    __table_args__ = (
        Index("ix_contract_disputes_contract_id_status", "contract_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
    )
    raised_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    reason: Mapped[DisputeReason] = mapped_column(
        dispute_reason_enum, nullable=False
    )
    description: Mapped[str | None] = mapped_column(
        String(2000), nullable=True
    )
    status: Mapped[DisputeStatus] = mapped_column(
        dispute_status_enum,
        nullable=False,
        server_default=DisputeStatus.open.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ContractAmendment(Base):
    """A proposed change to contract terms. Applied only after the other
    participant approves; then the live contract is updated."""

    __tablename__ = "contract_amendments"
    __table_args__ = (
        Index(
            "ix_contract_amendments_contract_id_status",
            "contract_id",
            "status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
    )
    proposed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[AmendmentStatus] = mapped_column(
        amendment_status_enum,
        nullable=False,
        server_default=AmendmentStatus.pending.value,
    )
    # Only the fields being changed, e.g. {"scope": "...", "finalDeadline": ...}
    changes: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # The1-based edit number this amendment would become if approved.
    edit_number: Mapped[int] = mapped_column(Integer, nullable=False)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
