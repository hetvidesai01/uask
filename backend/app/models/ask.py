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
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import AskStatus
from app.db.base import Base, TimestampMixin

ask_status_enum = SAEnum(AskStatus, name="ask_status")


class Ask(Base, TimestampMixin):
    __tablename__ = "asks"
    __table_args__ = (
        CheckConstraint(
            "budget_max IS NULL OR budget_min IS NULL OR budget_max >= budget_min",
            name="ck_asks_budget_range",
        ),
        CheckConstraint(
            "budget_min IS NULL OR budget_min >= 0",
            name="ck_asks_budget_min_nonneg",
        ),
        CheckConstraint(
            "budget_max IS NULL OR budget_max >= 0",
            name="ck_asks_budget_max_nonneg",
        ),
        CheckConstraint(
            "deadline IS NULL OR deadline >= created_at::date",
            name="ck_asks_deadline_not_past",
        ),
        Index("ix_asks_status_created_at", "status", text("created_at DESC")),
        Index("ix_asks_category", "category"),
        Index("ix_asks_requester_id", "requester_id"),
        Index(
            "ix_asks_fts",
            text("to_tsvector('english', title || ' ' || description)"),
            postgresql_using="gin",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(140), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    budget_min: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    budget_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default="INR",
    )
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    location: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_remote: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    status: Mapped[AskStatus] = mapped_column(
        ask_status_enum,
        nullable=False,
        server_default=AskStatus.open.value,
    )
    attachments: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    requester: Mapped["User"] = relationship(back_populates="asks")  # noqa: F821
    offers: Mapped[list["Offer"]] = relationship(  # noqa: F821
        back_populates="ask",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
