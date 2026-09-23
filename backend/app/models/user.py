import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import UserRole
from app.db.base import Base

user_role_enum = SAEnum(UserRole, name="user_role")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("rating >= 0 AND rating <= 5", name="ck_users_rating_range"),
        CheckConstraint("review_count >= 0", name="ck_users_review_count_nonneg"),
        Index("ix_users_categories", "categories", postgresql_using="gin"),
        Index("ix_users_roles", "roles", postgresql_using="gin"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str] = mapped_column(CITEXT, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    roles: Mapped[list[UserRole]] = mapped_column(
        ARRAY(user_role_enum),
        nullable=False,
        server_default="{seeker}",
    )
    bio: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    location: Mapped[str | None] = mapped_column(String(120), nullable=True)
    categories: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        server_default="{}",
    )
    rating: Mapped[Decimal] = mapped_column(
        Numeric(2, 1),
        nullable=False,
        server_default="0.0",
    )
    review_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="true",
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    asks: Mapped[list["Ask"]] = relationship(  # noqa: F821
        back_populates="requester",
        passive_deletes=True,
    )
    offers: Mapped[list["Offer"]] = relationship(  # noqa: F821
        back_populates="provider",
        passive_deletes=True,
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    notifications: Mapped[list["Notification"]] = relationship(  # noqa: F821
        back_populates="user",
        passive_deletes=True,
    )
    participant_rows: Mapped[list["ThreadParticipant"]] = relationship(  # noqa: F821
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    messages_sent: Mapped[list["Message"]] = relationship(  # noqa: F821
        back_populates="sender",
        passive_deletes=True,
    )
