"""Notification data access: per-user listings, ownership, read updates."""

from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.notification import Notification


def list_for_user(
    session: Session,
    user_id: UUID,
    *,
    unread_only: bool = False,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Notification], int]:
    """One user's notifications, newest first."""
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))

    total = session.scalar(
        select(func.count()).select_from(stmt.subquery())
    ) or 0

    stmt = stmt.order_by(
        Notification.created_at.desc(), Notification.id.desc()
    )
    stmt = stmt.offset(offset).limit(limit)
    return list(session.scalars(stmt).all()), total


def get_owned(
    session: Session, user_id: UUID, notification_id: UUID
) -> Notification | None:
    """One notification scoped to its owner (others get 404, never 403)."""
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == user_id,
    )
    return session.scalar(stmt)


def mark_all_read(session: Session, user_id: UUID) -> int:
    """Set read_at on every unread notification; returns rows affected."""
    result = session.execute(
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=func.now())
    )
    return int(result.rowcount or 0)
