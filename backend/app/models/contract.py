import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
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
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ContractStatus, MilestoneStatus
from app.db.base import Base, TimestampMixin

contract_status_enum = SAEnum(ContractStatus, name="contract_status")
milestone_status_enum = SAEnum(MilestoneStatus, name="milestone_status")


class Contract(Base, TimestampMixin):
    """One contract per accepted ASK/offer pair — created inside the
    same transaction that accepts the offer."""

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
        server_default=ContractStatus.active.value,
    )
    # Set-once rating: written only by the seeker, only after completion.
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
    status: Mapped[MilestoneStatus] = mapped_column(
        milestone_status_enum,
        nullable=False,
        server_default=MilestoneStatus.upcoming.value,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    contract: Mapped[Contract] = relationship(back_populates="milestones")
