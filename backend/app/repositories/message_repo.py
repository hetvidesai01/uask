"""Message data access: cursor history pages and unread counts."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.thread import Message, ThreadParticipant


def db_now(session: Session) -> datetime:
    """Database clock — keeps read state on the same clock as created_at."""
    return session.scalar(select(func.now()))


def get_in_thread(
    session: Session, thread_id: UUID, message_id: UUID
) -> Message | None:
    """One message scoped to its thread (cursor validation)."""
    stmt = select(Message).where(
        Message.thread_id == thread_id, Message.id == message_id
    )
    return session.scalar(stmt)


def page_before(
    session: Session,
    thread_id: UUID,
    *,
    before: Message | None,
    limit: int,
) -> tuple[list[Message], bool]:
    """Newest `limit` messages older than the cursor, oldest-first.

    Returns (ascending messages, has_more) where has_more means older
    messages exist beyond this window.
    """
    stmt = select(Message).where(Message.thread_id == thread_id)
    if before is not None:
        stmt = stmt.where(
            or_(
                Message.created_at < before.created_at,
                and_(
                    Message.created_at == before.created_at,
                    Message.id < before.id,
                ),
            )
        )
    stmt = (
        stmt.options(joinedload(Message.sender))
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit + 1)
    )
    rows = list(session.scalars(stmt).unique().all())
    has_more = len(rows) > limit
    rows = rows[:limit]
    rows.reverse()
    return rows, has_more


def unread_counts(
    session: Session, user_id: UUID, thread_ids: list[UUID]
) -> dict[UUID, int]:
    """Unread messages per thread: newer than my last read, not sent by me."""
    if not thread_ids:
        return {}
    stmt = (
        select(Message.thread_id, func.count().label("unread"))
        .join(
            ThreadParticipant,
            ThreadParticipant.thread_id == Message.thread_id,
        )
        .where(
            Message.thread_id.in_(thread_ids),
            ThreadParticipant.user_id == user_id,
            Message.sender_id != user_id,
            Message.created_at > ThreadParticipant.last_read_at,
        )
        .group_by(Message.thread_id)
    )
    return dict(session.execute(stmt).all())
