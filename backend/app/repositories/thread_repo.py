"""Thread data access: inbox queries, membership, accept-time lookup."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.ask import Ask
from app.models.thread import Thread, ThreadParticipant


def get_thread(session: Session, thread_id: UUID) -> Thread | None:
    """One thread with participants, their users, and the last message."""
    stmt = (
        select(Thread)
        .where(Thread.id == thread_id)
        .options(
            selectinload(Thread.participants).joinedload(ThreadParticipant.user),
            joinedload(Thread.last_message),
        )
    )
    return session.scalars(stmt).unique().one_or_none()


def find_by_offer(session: Session, offer_id: UUID) -> Thread | None:
    """The thread for an accepted transaction, if it already exists."""
    stmt = select(Thread).where(Thread.offer_id == offer_id)
    return session.scalar(stmt)


def list_for_user(
    session: Session, user_id: UUID, *, offset: int = 0, limit: int = 20
) -> tuple[list[Thread], int]:
    """Threads the user participates in, most recently updated first."""
    membership = select(ThreadParticipant.thread_id).where(
        ThreadParticipant.user_id == user_id
    )
    total = (
        session.scalar(
            select(func.count()).select_from(Thread).where(Thread.id.in_(membership))
        )
        or 0
    )
    stmt = (
        select(Thread)
        .where(Thread.id.in_(membership))
        .options(
            selectinload(Thread.participants).joinedload(ThreadParticipant.user),
            joinedload(Thread.last_message),
        )
        .order_by(Thread.updated_at.desc(), Thread.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(session.scalars(stmt).unique().all()), total


def asks_map(session: Session, ask_ids: list[UUID]) -> dict[UUID, Ask]:
    """Ask refs for threads — read-only display, includes soft-deleted ASKs."""
    if not ask_ids:
        return {}
    stmt = select(Ask).where(Ask.id.in_(ask_ids))
    return {ask.id: ask for ask in session.scalars(stmt)}
