import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Connection(Base, TimestampMixin):
    """Instant, bidirectional social link between two users.

    One row per unordered pair: `user_a_id < user_b_id` is enforced in the
    service layer and by a check constraint, so (A, B) and (B, A) can never
    coexist. There is no pending/declined state.
    """

    __tablename__ = "connections"
    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_connections_pair"),
        CheckConstraint(
            "user_a_id < user_b_id", name="ck_connections_ordered_pair"
        ),
        Index("ix_connections_user_b_id", "user_b_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    @staticmethod
    def ordered(
        left: uuid.UUID, right: uuid.UUID
    ) -> tuple[uuid.UUID, uuid.UUID]:
        """Canonical member order for an unordered pair."""
        return (left, right) if left.int < right.int else (right, left)

    def other_user_id(self, user_id: uuid.UUID) -> uuid.UUID:
        """The counterpart of `user_id` in this pair."""
        if user_id == self.user_a_id:
            return self.user_b_id
        if user_id == self.user_b_id:
            return self.user_a_id
        raise ValueError("user is not part of this connection")
