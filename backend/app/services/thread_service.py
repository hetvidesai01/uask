"""Thread business rules: inbox, participant access, accept-time creation."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.pagination import Page, PageParams, build_page
from app.models.ask import Ask
from app.models.offer import Offer
from app.models.thread import Thread, ThreadParticipant
from app.models.user import User
from app.repositories import message_repo, thread_repo
from app.schemas.thread import LastMessagePreview, ThreadAskRef, ThreadResponse
from app.schemas.user import UserPublic


def ensure_thread_for_accept(db: Session, *, ask: Ask, offer: Offer) -> Thread:
    """Find-or-create the thread for an accepted transaction.

    Runs inside the accept transaction, where the ASK row is already
    locked, so racing accepts cannot create two threads for one offer.
    """
    existing = thread_repo.find_by_offer(db, offer.id)
    if existing is not None:
        return existing

    now = message_repo.db_now(db)
    thread = Thread(
        ask_id=ask.id,
        offer_id=offer.id,
        created_at=now,
        updated_at=now,
    )
    participant_ids = dict.fromkeys((ask.requester_id, offer.provider_id))
    for user_id in participant_ids:
        thread.participants.append(
            ThreadParticipant(user_id=user_id, last_read_at=now, joined_at=now)
        )
    db.add(thread)
    db.flush()
    return thread


def require_participant(
    db: Session, thread_id: UUID, current_user: User
) -> tuple[Thread, ThreadParticipant]:
    """Load a thread the user belongs to, or raise 404/403."""
    thread = thread_repo.get_thread(db, thread_id)
    if thread is None:
        raise NotFoundError("Thread not found.", code="THREAD_NOT_FOUND")
    for participant in thread.participants:
        if participant.user_id == current_user.id:
            return thread, participant
    raise ForbiddenError(
        "You do not have access to this thread.", code="FORBIDDEN"
    )


def _thread_response(
    thread: Thread, *, unread_count: int, asks: dict[UUID, Ask]
) -> ThreadResponse:
    ask = asks.get(thread.ask_id) if thread.ask_id is not None else None
    last = thread.last_message
    return ThreadResponse(
        id=thread.id,
        ask_id=thread.ask_id,
        ask=ThreadAskRef.model_validate(ask) if ask is not None else None,
        offer_id=thread.offer_id,
        participant_ids=[p.user_id for p in thread.participants],
        participants=[
            UserPublic.model_validate(p.user) for p in thread.participants
        ],
        last_message=(
            LastMessagePreview.model_validate(last) if last is not None else None
        ),
        unread_count=unread_count,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
    )


def list_threads(
    db: Session, *, current_user: User, page: int = 1, page_size: int = 20
) -> Page[ThreadResponse]:
    pp = PageParams(page=page, page_size=page_size)
    threads, total = thread_repo.list_for_user(
        db, current_user.id, offset=pp.offset, limit=pp.limit
    )
    thread_ids = [thread.id for thread in threads]
    unread = message_repo.unread_counts(db, current_user.id, thread_ids)
    asks = thread_repo.asks_map(db, [t.ask_id for t in threads if t.ask_id])
    items = [
        _thread_response(
            thread, unread_count=unread.get(thread.id, 0), asks=asks
        )
        for thread in threads
    ]
    return build_page(items, page=pp.page, page_size=pp.page_size, total=total)


def get_thread(
    db: Session, thread_id: UUID, *, current_user: User
) -> ThreadResponse:
    thread, _ = require_participant(db, thread_id, current_user)
    unread = message_repo.unread_counts(db, current_user.id, [thread.id])
    asks = thread_repo.asks_map(db, [thread.ask_id] if thread.ask_id else [])
    return _thread_response(
        thread, unread_count=unread.get(thread.id, 0), asks=asks
    )
