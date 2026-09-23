import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import OfferStatus
from app.db.base import Base, TimestampMixin

offer_status_enum = SAEnum(OfferStatus, name="offer_status")


class Offer(Base, TimestampMixin):
    __tablename__ = "offers"
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_offers_price_nonneg"),
        CheckConstraint(
            "delivery_days BETWEEN 1 AND 365",
            name="ck_offers_delivery_days_range",
        ),
        CheckConstraint("char_length(currency) = 3", name="ck_offers_currency_len"),
        Index(
            "uq_offers_ask_id_provider_id_live",
            "ask_id",
            "provider_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_offers_ask_id_status", "ask_id", "status"),
        Index(
            "ix_offers_provider_id_created_at",
            "provider_id",
            text("created_at DESC"),
        ),
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
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default="INR",
    )
    delivery_days: Mapped[int] = mapped_column(Integer, nullable=False)
    pitch: Mapped[str] = mapped_column(Text, nullable=False)
    deliverables: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        server_default="{}",
    )
    attachments: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    status: Mapped[OfferStatus] = mapped_column(
        offer_status_enum,
        nullable=False,
        server_default=OfferStatus.pending.value,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    ask: Mapped["Ask"] = relationship(back_populates="offers")  # noqa: F821
    provider: Mapped["User"] = relationship(back_populates="offers")  # noqa: F821
