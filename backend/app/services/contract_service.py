"""Contracts, milestones, completion, rating, and provider reputation.

Role rules live here — routes stay thin. Contract rows are created inside
the offer-accept transaction (see offer_service._accept_offer); everything
else in this module is a normal read/transition flow keyed off the current
auth user, never ids supplied by the frontend.
"""

import math
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.enums import ContractStatus, MilestoneStatus
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    InvalidTransitionError,
    NotFoundError,
)
from app.core.pagination import Page, PageParams, build_page
from app.models.contract import Contract, Milestone
from app.models.offer import Offer
from app.models.user import User
from app.repositories import contract_repo
from app.schemas.contract import (
    CompletedContractResponse,
    ContractResponse,
    MilestoneResponse,
    MilestoneStatusUpdate,
    RatingCreate,
    ReputationResponse,
)

MAX_MILESTONES = 3
TITLE_MAX = 120
FALLBACK_TITLE = "Project delivery"

# provider: start/submit work. seeker: approve, then pay (mock payment).
PROVIDER_TRANSITIONS: dict[MilestoneStatus, set[MilestoneStatus]] = {
    MilestoneStatus.upcoming: {
        MilestoneStatus.in_progress,
        MilestoneStatus.submitted,
    },
    MilestoneStatus.in_progress: {MilestoneStatus.submitted},
}
SEEKER_TRANSITIONS: dict[MilestoneStatus, set[MilestoneStatus]] = {
    MilestoneStatus.submitted: {MilestoneStatus.approved},
    MilestoneStatus.approved: {MilestoneStatus.paid},
}


def _contract_response(contract: Contract) -> ContractResponse:
    return ContractResponse.model_validate(contract)


def _round_one(value: float) -> float:
    return float(
        Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    )


def _require_participant(contract: Contract, current_user: User) -> None:
    if current_user.id not in (contract.seeker_id, contract.provider_id):
        raise ForbiddenError(
            "You do not have access to this contract.",
            code="NOT_CONTRACT_PARTICIPANT",
        )


def _require_seeker(contract: Contract, current_user: User) -> None:
    if contract.seeker_id != current_user.id:
        raise ForbiddenError(
            "Only the seeker can perform this action.",
            code="SEEKER_ONLY",
        )


def _contract_or_404(db: Session, contract_id: UUID) -> Contract:
    contract = contract_repo.get_contract(db, contract_id)
    if contract is None:
        raise NotFoundError(
            "Contract not found.", code="CONTRACT_NOT_FOUND"
        )
    return contract


# --------------------------------------------------------------------------
# Contract creation (inside the accept transaction)
# --------------------------------------------------------------------------


def _milestone_titles(deliverables: list[str] | None) -> list[str]:
    titles: list[str] = []
    for raw in deliverables or []:
        title = " ".join(str(raw).split())[:TITLE_MAX].strip()
        if title and title not in titles:
            titles.append(title)
        if len(titles) == MAX_MILESTONES:
            break
    return titles or [FALLBACK_TITLE]


def _split_amount(total: Decimal, count: int) -> list[Decimal]:
    """Even split with the remainder credited to the final milestone."""
    share = (total / count).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    parts = [share] * (count - 1)
    parts.append(total - share * (count - 1))
    return parts


def _due_dates(start: date, delivery_days: int, count: int) -> list[date]:
    """Spread due dates evenly across the offered delivery window."""
    return [
        start + timedelta(days=math.ceil(delivery_days * (index + 1) / count))
        for index in range(count)
    ]


def initial_milestones(offer: Offer) -> list[Milestone]:
    """Deterministic: up to 3 milestones from deliverables, even money
    split (remainder last), due dates spread across deliveryDays."""
    titles = _milestone_titles(offer.deliverables)
    amounts = _split_amount(offer.price, len(titles))
    dues = _due_dates(offer.created_at.date(), offer.delivery_days, len(titles))
    return [
        Milestone(
            id=uuid.uuid4(),
            title=title,
            description=None,
            amount=amount,
            due_date=due,
            status=MilestoneStatus.upcoming,
            position=index,
        )
        for index, (title, amount, due) in enumerate(
            zip(titles, amounts, dues, strict=True)
        )
    ]


def create_contract_for_accept(
    db: Session, *, ask, offer: Offer
) -> Contract:
    """Create the contract for an accepted offer — same transaction as
    the accept. Idempotent: one contract per ASK, ever."""
    existing = contract_repo.find_by_ask(db, ask.id)
    if existing is not None:
        return existing

    contract = Contract(
        id=uuid.uuid4(),
        ask_id=ask.id,
        offer_id=offer.id,
        seeker_id=ask.requester_id,
        provider_id=offer.provider_id,
        agreed_price=offer.price,
        currency=offer.currency,
        deliverables=list(offer.deliverables or []),
        status=ContractStatus.active,
    )
    contract.milestones = initial_milestones(offer)
    db.add(contract)
    db.flush()
    return contract


# --------------------------------------------------------------------------
# Reads
# --------------------------------------------------------------------------


def list_contracts(
    db: Session,
    *,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
) -> Page[ContractResponse]:
    pp = PageParams(page=page, page_size=page_size)
    rows, total = contract_repo.list_for_user(
        db, current_user.id, offset=pp.offset, limit=pp.limit
    )
    items = [_contract_response(contract) for contract in rows]
    return build_page(items, page=pp.page, page_size=pp.page_size, total=total)


def get_ask_contract(
    db: Session, ask_id: UUID, *, current_user: User
) -> ContractResponse:
    contract = contract_repo.find_by_ask(db, ask_id)
    if contract is None:
        raise NotFoundError("Contract not found.", code="CONTRACT_NOT_FOUND")
    _require_participant(contract, current_user)
    return _contract_response(contract)


# --------------------------------------------------------------------------
# Milestone workflow
# --------------------------------------------------------------------------


def update_milestone(
    db: Session,
    contract_id: UUID,
    milestone_id: UUID,
    payload: MilestoneStatusUpdate,
    *,
    current_user: User,
) -> MilestoneResponse:
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    milestone = contract_repo.get_milestone(db, contract_id, milestone_id)
    if milestone is None:
        raise NotFoundError(
            "Milestone not found.", code="MILESTONE_NOT_FOUND"
        )
    if contract.status != ContractStatus.active:
        raise InvalidTransitionError(
            "Contract is already completed.", code="CONTRACT_NOT_ACTIVE"
        )

    target = payload.status
    current = milestone.status
    if target == current:
        raise InvalidTransitionError(
            f"Milestone is already {current.value}.",
        )

    provider_ok = target in PROVIDER_TRANSITIONS.get(current, set())
    seeker_ok = target in SEEKER_TRANSITIONS.get(current, set())

    if contract.provider_id == current_user.id and not provider_ok:
        if seeker_ok:
            raise ForbiddenError(
                "Only the seeker can approve or pay this milestone.",
                code="SEEKER_ONLY",
            )
        raise InvalidTransitionError(
            f"Milestones cannot move from {current.value} to {target.value}."
        )
    if contract.seeker_id == current_user.id and not seeker_ok:
        if provider_ok:
            raise ForbiddenError(
                "Only the provider can move this milestone forward.",
                code="PROVIDER_ONLY",
            )
        raise InvalidTransitionError(
            f"Milestones cannot move from {current.value} to {target.value}."
        )
    if not provider_ok and not seeker_ok:
        raise InvalidTransitionError(
            f"Milestones cannot move from {current.value} to {target.value}."
        )

    milestone.status = target
    db.flush()
    resp = MilestoneResponse.model_validate(milestone)
    db.commit()
    return resp


def complete_contract(
    db: Session, contract_id: UUID, *, current_user: User
) -> ContractResponse:
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    _require_seeker(contract, current_user)
    if contract.status != ContractStatus.active:
        raise InvalidTransitionError(
            "Contract is already completed.", code="CONTRACT_NOT_ACTIVE"
        )
    contract.status = ContractStatus.completed
    contract.completed_at = datetime.now(UTC)
    db.flush()
    resp = _contract_response(contract)
    db.commit()
    return resp


def rate_contract(
    db: Session,
    contract_id: UUID,
    payload: RatingCreate,
    *,
    current_user: User,
) -> ContractResponse:
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    _require_seeker(contract, current_user)
    if contract.status != ContractStatus.completed:
        raise ConflictError(
            "Only a completed contract can be rated.",
            code="CONTRACT_NOT_COMPLETED",
        )
    if contract.rating is not None:
        raise InvalidTransitionError(
            "This contract has already been rated.", code="ALREADY_RATED"
        )

    contract.rating = payload.rating
    contract.review = payload.review
    # Flush first: the derived-rating query must see this contract's rating.
    db.flush()
    _refresh_derived_rating(db, contract.provider_id)
    resp = _contract_response(contract)
    db.commit()
    return resp


def _refresh_derived_rating(db: Session, provider_id: UUID) -> None:
    """Keep users.rating / users.reviewCount derived from rated,
    completed contracts — never writable by the user."""
    rating_sum, review_count = contract_repo.provider_rating_stats(
        db, provider_id
    )
    provider = db.get(User, provider_id)
    if provider is None:
        return
    if review_count:
        provider.rating = Decimal(
            str(_round_one(rating_sum / review_count))
        ).quantize(Decimal("0.1"))
    else:
        provider.rating = Decimal("0.0")
    provider.review_count = review_count


# --------------------------------------------------------------------------
# Reputation + history
# --------------------------------------------------------------------------


def reputation(db: Session, user_id: UUID) -> ReputationResponse:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found.", code="USER_NOT_FOUND")

    total, paid, revenue = contract_repo.provider_milestone_stats(db, user_id)
    completed = contract_repo.provider_completed_contract_count(db, user_id)
    rating_sum, review_count = contract_repo.provider_rating_stats(
        db, user_id
    )

    average = _round_one(rating_sum / review_count) if review_count else 0.0
    if total:
        booster = int(
            (Decimal(paid * 20) / Decimal(total)).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
    else:
        booster = 0

    return ReputationResponse(
        revenue=round(revenue, 2),
        average_rating=average,
        review_count=review_count,
        completed_contract_count=completed,
        completed_milestone_count=paid,
        total_milestone_count=total,
        profile_booster_pct=booster,
    )


def completed_contracts(
    db: Session,
    user_id: UUID,
    *,
    page: int = 1,
    page_size: int = 20,
) -> Page[CompletedContractResponse]:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found.", code="USER_NOT_FOUND")

    pp = PageParams(page=page, page_size=page_size)
    rows, total = contract_repo.list_completed_for_user(
        db, user_id, offset=pp.offset, limit=pp.limit
    )
    items = [
        CompletedContractResponse(
            id=contract.id,
            ask_id=contract.ask_id,
            ask_title=contract.ask.title if contract.ask else "",
            agreed_price=contract.agreed_price,
            currency=contract.currency,
            status=contract.status,
            completed_at=contract.completed_at,
            rating=contract.rating,
            review=contract.review,
        )
        for contract in rows
    ]
    return build_page(items, page=pp.page, page_size=pp.page_size, total=total)
