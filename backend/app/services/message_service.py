"""Message business rules: participant access, cursor history, read state."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.thread import Message
from app.models.user import User
from app.repositories import message_repo
from app.schemas.thread import MessageCreate, MessagePage, MessageResponse
from app.schemas.user import UserPublic
from app.services import thread_service

DEFAULT_LIMIT = 50


def _is_read(message: Message, participants) -> bool:
    """True when every participant except the sender has read this message."""
    return all(
        p.last_read_at is not None and message.created_at <= p.last_read_at
        for p in participants
        if p.user_id != message.sender_id
    )


def _message_response(message: Message, participants) -> MessageResponse:
    sender = message.sender
    return MessageResponse(
        id=message.id,
        thread_id=message.thread_id,
        sender_id=message.sender_id,
        body=message.body,
        attachments=message.attachments,
        read=_is_read(message, participants),
        created_at=message.created_at,
        sender=UserPublic.model_validate(sender) if sender is not None else None,
    )


def list_messages(
    db: Session,
    thread_id: UUID,
    *,
    current_user: User,
    before: UUID | None = None,
    limit: int = DEFAULT_LIMIT,
) -> MessagePage:
    thread, mine = thread_service.require_participant(db, thread_id, current_user)

    cursor = None
    if before is not None:
        cursor = message_repo.get_in_thread(db, thread.id, before)
        if cursor is None:
            raise ValidationError("Cursor message does not belong to this thread.")

    rows, has_more = message_repo.page_before(
        db, thread.id, before=cursor, limit=limit
    )

    # Fetching history is reading it — flags below reflect the new state.
    now = message_repo.db_now(db)
    if mine.last_read_at is None or mine.last_read_at < now:
        mine.last_read_at = now

    page = MessagePage(
        items=[_message_response(row, thread.participants) for row in rows],
        next_cursor=rows[0].id if has_more and rows else None,
        has_more=has_more,
        limit=limit,
    )
    db.commit()
    return page


def send_message(
    db: Session,
    thread_id: UUID,
    payload: MessageCreate,
    *,
    current_user: User,
) -> MessageResponse:
    thread, mine = thread_service.require_participant(db, thread_id, current_user)

    now = message_repo.db_now(db)
    message = Message(
        thread=thread,
        sender_id=current_user.id,
        body=payload.body,
        attachments=payload.attachments,
        created_at=now,
    )
    db.add(message)
    db.flush()

    # Inbox sort key, denormalized preview, and my own read pointer.
    thread.last_message_id = message.id
    thread.updated_at = now
    mine.last_read_at = now

    resp = _message_response(message, thread.participants)
    db.commit()
    return resp
