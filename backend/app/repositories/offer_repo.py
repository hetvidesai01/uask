"""Offer data access: per-ASK listings, duplicate lookup, row locking."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import OfferStatus
from app.models.ask import Ask
from app.models.offer import Offer


def get_live_offer(session: Session, offer_id: UUID) -> Offer | None:
    """Fetch one non-deleted offer with its ASK, or None."""
    stmt = (
        select(Offer)
        .where(Offer.id == offer_id, Offer.deleted_at.is_(None))
        .options(joinedload(Offer.ask))
    )
    return session.scalars(stmt).unique().one_or_none()


def lock_ask(session: Session, ask_id: UUID) -> Ask | None:
    """Row-lock a live ASK (FOR UPDATE), refreshing any cached state."""
    stmt = (
        select(Ask)
        .where(Ask.id == ask_id, Ask.deleted_at.is_(None))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return session.execute(stmt).scalar_one_or_none()


def lock_offer(session: Session, offer_id: UUID) -> Offer | None:
    """Row-lock a live offer (FOR UPDATE), refreshing any cached state."""
    stmt = (
        select(Offer)
        .where(Offer.id == offer_id, Offer.deleted_at.is_(None))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return session.execute(stmt).scalar_one_or_none()


def find_live_by_ask_provider(
    session: Session, ask_id: UUID, provider_id: UUID
) -> Offer | None:
    """The provider's live offer on this ASK, if any (duplicate guard)."""
    stmt = select(Offer).where(
        Offer.ask_id == ask_id,
        Offer.provider_id == provider_id,
        Offer.deleted_at.is_(None),
    )
    return session.scalar(stmt)


def list_for_ask(
    session: Session,
    ask_id: UUID,
    *,
    provider_only_id: UUID | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Offer], int]:
    """Live offers on an ASK, optionally restricted to one provider."""
    stmt = select(Offer).where(
        Offer.ask_id == ask_id, Offer.deleted_at.is_(None)
    )
    if provider_only_id is not None:
        stmt = stmt.where(Offer.provider_id == provider_only_id)

    total = session.scalar(
        select(func.count()).select_from(stmt.subquery())
    ) or 0

    stmt = stmt.order_by(Offer.created_at.asc(), Offer.id.asc())
    stmt = stmt.offset(offset).limit(limit)
    return list(session.scalars(stmt).all()), total


def get_by_ids_for_ask(
    session: Session, ask_id: UUID, ids: list[UUID]
) -> list[Offer]:
    """Live offers on this ASK matching the given ids (order unspecified)."""
    stmt = select(Offer).where(
        Offer.id.in_(ids),
        Offer.ask_id == ask_id,
        Offer.deleted_at.is_(None),
    )
    return list(session.scalars(stmt).all())


def accepted_exists(session: Session, ask_id: UUID) -> bool:
    """True if any live offer on the ASK is already accepted."""
    stmt = select(Offer.id).where(
        Offer.ask_id == ask_id,
        Offer.status == OfferStatus.accepted,
        Offer.deleted_at.is_(None),
    )
    return session.scalar(stmt) is not None


def lock_competing_offers(
    session: Session, ask_id: UUID, exclude_offer_id: UUID
) -> list[Offer]:
    """Row-lock every other live pending/shortlisted offer on the ASK."""
    stmt = (
        select(Offer)
        .where(
            Offer.ask_id == ask_id,
            Offer.id != exclude_offer_id,
            Offer.deleted_at.is_(None),
            Offer.status.in_((OfferStatus.pending, OfferStatus.shortlisted)),
        )
        .with_for_update()
    )
    return list(session.scalars(stmt).all())
