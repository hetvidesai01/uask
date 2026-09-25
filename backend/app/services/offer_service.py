"""Offer business rules: eligibility, visibility, status, accept transaction."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.enums import AskStatus, OfferStatus
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.core.pagination import Page, PageParams, build_page
from app.models.offer import Offer
from app.models.user import User
from app.repositories import ask_repo, offer_repo
from app.schemas.offer import OfferCreate, OfferResponse, OfferUpdate

MAX_COMPARE_IDS = 4


def _offer_response(offer: Offer) -> OfferResponse:
    return OfferResponse.model_validate(offer)


def _parse_compare_ids(raw: str) -> list[UUID]:
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if not parts:
        raise ValidationError("At least one offer id is required.")
    if len(parts) > MAX_COMPARE_IDS:
        raise ValidationError(
            f"Compare supports at most {MAX_COMPARE_IDS} offers."
        )
    result: list[UUID] = []
    seen: set[UUID] = set()
    for part in parts:
        try:
            uid = UUID(part)
        except ValueError as exc:
            raise ValidationError(
                "Each compare id must be a valid UUID."
            ) from exc
        if uid not in seen:
            seen.add(uid)
            result.append(uid)
    return result


def _live_ask_or_404(db: Session, ask_id: UUID):
    row = ask_repo.get_ask(db, ask_id)
    if row is None:
        raise NotFoundError("Ask not found.", code="ASK_NOT_FOUND")
    ask, _ = row
    return ask


def list_offers(
    db: Session,
    ask_id: UUID,
    *,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
) -> Page[OfferResponse]:
    ask = _live_ask_or_404(db, ask_id)
    provider_only = (
        None if ask.requester_id == current_user.id else current_user.id
    )
    pp = PageParams(page=page, page_size=page_size)
    rows, total = offer_repo.list_for_ask(
        db,
        ask_id,
        provider_only_id=provider_only,
        offset=pp.offset,
        limit=pp.limit,
    )
    items = [_offer_response(offer) for offer in rows]
    return build_page(items, page=pp.page, page_size=pp.page_size, total=total)


def create_offer(
    db: Session, ask_id: UUID, payload: OfferCreate, current_user: User
) -> OfferResponse:
    ask = _live_ask_or_404(db, ask_id)
    if ask.status != AskStatus.open:
        raise ConflictError(
            "Offers can only be placed on open ASKs.", code="ASK_NOT_OPEN"
        )
    existing = offer_repo.find_live_by_ask_provider(db, ask_id, current_user.id)
    if existing is not None:
        raise ConflictError(
            "You have already offered on this ASK.", code="DUPLICATE_OFFER"
        )

    now = datetime.now(UTC)
    offer = Offer(
        ask_id=ask.id,
        provider_id=current_user.id,
        price=payload.price,
        currency=payload.currency,
        delivery_days=payload.delivery_days,
        pitch=payload.pitch,
        deliverables=payload.deliverables,
        attachments=payload.attachments,
        status=OfferStatus.pending,
        created_at=now,
        updated_at=now,
    )
    db.add(offer)
    try:
        db.flush()
        resp = _offer_response(offer)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "You have already offered on this ASK.", code="DUPLICATE_OFFER"
        ) from exc
    return resp


def get_offer(db: Session, offer_id: UUID, current_user: User) -> OfferResponse:
    offer = offer_repo.get_live_offer(db, offer_id)
    if offer is None or offer.ask is None or offer.ask.deleted_at is not None:
        raise NotFoundError("Offer not found.", code="OFFER_NOT_FOUND")
    is_owner = current_user.id == offer.ask.requester_id
    is_provider = current_user.id == offer.provider_id
    if not (is_owner or is_provider):
        raise ForbiddenError(
            "You do not have access to this offer.", code="FORBIDDEN"
        )
    return _offer_response(offer)


def compare_offers(
    db: Session, ask_id: UUID, ids_raw: str, current_user: User
) -> Page[OfferResponse]:
    ids = _parse_compare_ids(ids_raw)
    ask = _live_ask_or_404(db, ask_id)
    if ask.requester_id != current_user.id:
        raise ForbiddenError(
            "Only the ASK owner may compare offers.", code="NOT_ASK_OWNER"
        )
    found = offer_repo.get_by_ids_for_ask(db, ask_id, ids)
    by_id = {offer.id: offer for offer in found}
    if any(uid not in by_id for uid in ids):
        raise NotFoundError(
            "One or more offers not found for this ASK.",
            code="OFFER_NOT_FOUND",
        )
    items = [_offer_response(by_id[uid]) for uid in ids]
    return build_page(items, page=1, page_size=20, total=len(items))


def update_offer(
    db: Session, offer_id: UUID, payload: OfferUpdate, current_user: User
) -> OfferResponse:
    offer = offer_repo.get_live_offer(db, offer_id)
    if offer is None or offer.ask is None or offer.ask.deleted_at is not None:
        raise NotFoundError("Offer not found.", code="OFFER_NOT_FOUND")
    ask = offer.ask

    data = payload.model_dump(exclude_unset=True)
    has_status = "status" in data
    fields = {key: value for key, value in data.items() if key != "status"}

    if has_status and fields:
        raise ValidationError(
            "Update status and offer details in separate requests."
        )

    if fields:
        # Provider edits: only the offer's provider, only while pending.
        if offer.provider_id != current_user.id:
            raise ForbiddenError(
                "Only the offer's provider may edit this offer.",
                code="FORBIDDEN",
            )
        if offer.status != OfferStatus.pending:
            raise ConflictError(
                "Only pending offers can be edited.",
                code="OFFER_NOT_EDITABLE",
            )
        for key, value in fields.items():
            setattr(offer, key, value)
        db.flush()
        resp = _offer_response(offer)
        db.commit()
        return resp

    if not has_status:
        raise ValidationError("Provide at least one field to update.")

    # Status authority: shortlist / accept / reject are ASK-owner only.
    new_status = data["status"]
    if ask.requester_id != current_user.id:
        raise ForbiddenError(
            "Only the ASK owner may change offer status.",
            code="NOT_ASK_OWNER",
        )

    if new_status == OfferStatus.accepted:
        return _accept_offer(db, offer)

    if new_status == OfferStatus.shortlisted:
        if offer.status != OfferStatus.pending:
            raise ConflictError(
                "Only pending offers can be shortlisted.",
                code="INVALID_STATUS_TRANSITION",
            )
    elif new_status == OfferStatus.rejected:
        if offer.status not in (
            OfferStatus.pending,
            OfferStatus.shortlisted,
        ):
            raise ConflictError(
                "Only pending or shortlisted offers can be rejected.",
                code="INVALID_STATUS_TRANSITION",
            )
    else:
        raise ConflictError(
            "Unsupported status change.", code="INVALID_STATUS_TRANSITION"
        )

    offer.status = new_status
    db.flush()
    resp = _offer_response(offer)
    db.commit()
    return resp


def _accept_offer(db: Session, offer: Offer) -> OfferResponse:
    """Accept one offer atomically: lock, verify, accept, reject, close."""
    # Lock order: ask first — serializes all concurrent accept attempts.
    ask = offer_repo.lock_ask(db, offer.ask_id)
    if ask is None:
        raise NotFoundError("Ask not found.", code="ASK_NOT_FOUND")

    # Two racing accepts: the loser sees the winner's committed accept.
    if offer_repo.accepted_exists(db, ask.id):
        raise ConflictError(
            "An offer has already been accepted for this ASK.",
            code="OFFER_ALREADY_ACCEPTED",
        )
    if ask.status in (AskStatus.closed, AskStatus.cancelled):
        raise ConflictError(
            "This ASK is no longer accepting offers.", code="ASK_NOT_OPEN"
        )

    locked = offer_repo.lock_offer(db, offer.id)
    if locked is None:
        raise NotFoundError("Offer not found.", code="OFFER_NOT_FOUND")
    if locked.status not in (OfferStatus.pending, OfferStatus.shortlisted):
        raise ConflictError(
            "Only pending or shortlisted offers can be accepted.",
            code="INVALID_STATUS_TRANSITION",
        )

    competing = offer_repo.lock_competing_offers(
        db, ask.id, exclude_offer_id=locked.id
    )
    try:
        locked.status = OfferStatus.accepted
        for other in competing:
            other.status = OfferStatus.rejected
        ask.status = AskStatus.closed
        db.flush()
        resp = _offer_response(locked)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return resp
