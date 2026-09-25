"""Notification business rules: creation on key events, read state.

Creation is synchronous and in-transaction — the notification commits or
rolls back with the operation that triggered it. No queues, no event bus.
"""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.enums import NotificationType, OfferStatus
from app.core.exceptions import NotFoundError
from app.core.pagination import Page, PageParams, build_page
from app.models.ask import Ask
from app.models.notification import Notification
from app.models.offer import Offer
from app.models.thread import Thread
from app.models.user import User
from app.repositories import notification_repo
from app.schemas.notification import NotificationResponse

_MESSAGE_PREVIEW_CHARS = 300

_OFFER_STATUS_COPY: dict[
    OfferStatus,
    tuple[NotificationType, str, str],
] = {
    OfferStatus.accepted: (
        NotificationType.offer_accepted,
        "Offer accepted",
        "Your offer on {title} was accepted — you can now message the client.",
    ),
    OfferStatus.shortlisted: (
        NotificationType.offer_shortlisted,
        "Offer shortlisted",
        "Your offer on {title} was shortlisted.",
    ),
    OfferStatus.rejected: (
        NotificationType.offer_rejected,
        "Offer not selected",
        "Your offer on {title} was not selected.",
    ),
}


def _response(notification: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        user_id=notification.user_id,
        type=notification.type,
        title=notification.title,
        body=notification.body,
        link=notification.link,
        read=notification.read_at is not None,
        created_at=notification.created_at,
    )


def notify(
    db: Session,
    *,
    user_id: UUID,
    notification_type: NotificationType,
    title: str,
    actor_id: UUID | None = None,
    body: str | None = None,
    link: str | None = None,
) -> Notification | None:
    """Append an in-transaction notification; never notifies the actor."""
    if actor_id is not None and user_id == actor_id:
        return None
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        body=body,
        link=link,
    )
    db.add(notification)
    return notification


def notify_new_offer(db: Session, *, ask: Ask, provider: User) -> Notification | None:
    """The ASK owner learns that a provider has responded."""
    return notify(
        db,
        user_id=ask.requester_id,
        actor_id=provider.id,
        notification_type=NotificationType.ask_new_offer,
        title="New offer received",
        body=f"{provider.name} submitted an offer on {ask.title}",
        link=f"/app/asks/{ask.id}",
    )


def notify_offer_status(
    db: Session, *, ask: Ask, offer: Offer, status: OfferStatus
) -> Notification | None:
    """The provider learns how their offer was resolved."""
    copy = _OFFER_STATUS_COPY.get(status)
    if copy is None:
        return None
    notification_type, title, body_template = copy
    return notify(
        db,
        user_id=offer.provider_id,
        actor_id=ask.requester_id,
        notification_type=notification_type,
        title=title,
        body=body_template.format(title=ask.title),
        link=f"/app/asks/{ask.id}",
    )


def notify_new_message(
    db: Session, *, thread: Thread, sender: User, text: str
) -> None:
    """Everyone else in the thread learns a message arrived."""
    preview = text
    if len(preview) > _MESSAGE_PREVIEW_CHARS:
        preview = preview[: _MESSAGE_PREVIEW_CHARS - 3] + "..."
    for participant in thread.participants:
        notify(
            db,
            user_id=participant.user_id,
            actor_id=sender.id,
            notification_type=NotificationType.new_message,
            title="New message",
            body=f"{sender.name}: {preview}",
            link=f"/app/messages/{thread.id}",
        )


def list_notifications(
    db: Session,
    *,
    current_user: User,
    unread_only: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> Page[NotificationResponse]:
    pp = PageParams(page=page, page_size=page_size)
    rows, total = notification_repo.list_for_user(
        db,
        current_user.id,
        unread_only=unread_only,
        offset=pp.offset,
        limit=pp.limit,
    )
    items = [_response(notification) for notification in rows]
    return build_page(items, page=pp.page, page_size=pp.page_size, total=total)


def mark_read(
    db: Session, notification_id: UUID, *, current_user: User
) -> NotificationResponse:
    notification = notification_repo.get_owned(
        db, current_user.id, notification_id
    )
    if notification is None:
        raise NotFoundError(
            "Notification not found.", code="NOTIFICATION_NOT_FOUND"
        )
    if notification.read_at is None:
        notification.read_at = datetime.now(UTC)
        db.commit()
    return _response(notification)


def mark_all_read(db: Session, *, current_user: User) -> int:
    updated = notification_repo.mark_all_read(db, current_user.id)
    db.commit()
    return updated
