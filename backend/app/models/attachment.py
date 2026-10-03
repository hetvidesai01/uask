import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Attachment(Base):
    __tablename__ = "attachments"
    __table_args__ = (
        CheckConstraint(
            "entity_type IN ('ask', 'offer', 'message')",
            name="ck_attachments_entity_type",
        ),
        CheckConstraint(
            "(entity_type IS NULL) = (entity_id IS NULL)",
            name="ck_attachments_entity_pair",
        ),
        CheckConstraint(
            "size_bytes >= 0", name="ck_attachments_size_nonneg"
        ),
        Index("uq_attachments_storage_key", "storage_key", unique=True),
        Index(
            "ix_attachments_entity_type_entity_id",
            "entity_type",
            "entity_id",
        ),
        Index("ix_attachments_owner_id_created_at", "owner_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    entity_type: Mapped[str | None] = mapped_column(
        String(16), nullable=True
    )
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    file_name: Mapped[str] = mapped_column(String(120), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
