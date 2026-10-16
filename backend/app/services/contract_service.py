"""Contracts, payment stages, signing, progress, revisions, amendments.

Redesigned for the approved frontend Contract flow:

    ASK -> Response -> Select -> Draft -> Both Sign -> Active ->
    25% Initial -> 60% Progress Approval -> 50% Progress ->
    Final Submission -> 25% Final -> Complete

This is a **prototype payment model**: stages move through demo states only.
No gateway, escrow, refund enforcement or penalty collection exists. Money
never moves; "paid" is a label.

Role rules live here — routes stay thin. Contract rows are created inside
the offer-accept transaction (see offer_service._accept_offer); everything
else keys off the current auth user, never ids supplied by the frontend.
"""

import math
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import (
    AmendmentStatus,
    ContractStatus,
    DisputeStatus,
    MilestoneStatus,
    OwnershipOption,
    PortfolioPermission,
    StageKind,
)
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    InvalidTransitionError,
    NotFoundError,
    ValidationError,
)
from app.core.pagination import Page, PageParams, build_page
from app.models.contract import (
    Contract,
    ContractAmendment,
    ContractDispute,
    Milestone,
)
from app.models.offer import Offer
from app.models.user import User
from app.repositories import contract_repo
from app.schemas.contract import (
    AmendmentCreate,
    CancellationRequest,
    CompletedContractResponse,
    ContractAmendmentResponse,
    ContractDisputeResponse,
    ContractHistoryResponse,
    ContractResponse,
    DisputeCreate,
    MilestoneResponse,
    MilestoneStatusUpdate,
    ProgressSubmit,
    RatingCreate,
    ReputationResponse,
)

TITLE_MAX = 120
STAGE_TITLES: dict[StageKind, str] = {
    StageKind.initial: "Initial payment (25%)",
    StageKind.progress: "Progress payment (50%)",
    StageKind.final: "Final payment (25%)",
}
STAGE_PCT: dict[StageKind, int] = {
    StageKind.initial: 25,
    StageKind.progress: 50,
    StageKind.final: 25,
}
# Amendable contract fields: API (camelCase) name -> (attr, kind).
# Price/currency are deliberately NOT amendable — they drive the payment
# schedule and stay frozen at the agreed values.
_AMENDABLE_FIELDS: dict[str, tuple[str, str]] = {
    "scope": ("scope", "text"),
    "deliverables": ("deliverables", "str_list"),
    "finalDeadline": ("final_deadline", "date"),
    "includedRevisionCount": ("included_revision_count", "int"),
    "ownershipOption": ("ownership_option", "ownership"),
    "portfolioPermission": ("portfolio_permission", "portfolio"),
    "confidentialityAgreed": ("confidentiality_agreed", "bool"),
}


# --------------------------------------------------------------------------
# Helpers: guards, rounding, responses
# --------------------------------------------------------------------------


def _require_participant(contract: Contract, current_user: User) -> None:
    if current_user.id not in (contract.seeker_id, contract.provider_id):
        raise ForbiddenError(
            "You do not have access to this contract.",
            code="NOT_CONTRACT_PARTICIPANT",
        )


def _require_seeker(contract: Contract, current_user: User) -> None:
    if contract.seeker_id != current_user.id:
        raise ForbiddenError(
            "Only the ASK side can perform this action.",
            code="SEEKER_ONLY",
        )


def _require_provider(contract: Contract, current_user: User) -> None:
    if contract.provider_id != current_user.id:
        raise ForbiddenError(
            "Only the respond side can perform this action.",
            code="PROVIDER_ONLY",
        )


def _contract_or_404(db: Session, contract_id: UUID) -> Contract:
    contract = contract_repo.get_contract(db, contract_id)
    if contract is None:
        raise NotFoundError(
            "Contract not found.", code="CONTRACT_NOT_FOUND"
        )
    return contract


def _round_one(value: float) -> float:
    return float(
        Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    )


def _money(value: Decimal) -> float:
    return float(Decimal(value).quantize(Decimal("0.01")))


def _milestone_or_404(
    db: Session, contract_id: UUID, milestone_id: UUID
) -> Milestone:
    milestone = contract_repo.get_milestone(db, contract_id, milestone_id)
    if milestone is None:
        raise NotFoundError(
            "Milestone not found.", code="MILESTONE_NOT_FOUND"
        )
    return milestone


def _stage_of_kind(contract: Contract, kind: StageKind) -> Milestone:
    for milestone in contract.milestones:
        if milestone.kind == kind:
            return milestone
    raise NotFoundError("Payment stage not found.", code="MILESTONE_NOT_FOUND")


def _awaiting_stage(contract: Contract) -> Milestone | None:
    for milestone in contract.milestones:
        if milestone.status == MilestoneStatus.awaiting_approval:
            return milestone
    return None


def _calc_edit_fee_pct(edit_count: int) -> float:
    """Cumulative informational edit fee, in percent of contract value.

    First `CONTRACT_FREE_EDITS` edits are free; each further edit adds
    `CONTRACT_EDIT_FEE_PCT`, capped at `CONTRACT_EDIT_FEE_CAP_PCT`.
    """
    s = get_settings()
    billable = max(0, edit_count - s.CONTRACT_FREE_EDITS)
    return min(billable * s.CONTRACT_EDIT_FEE_PCT, s.CONTRACT_EDIT_FEE_CAP_PCT)


def _contract_response(db: Session, contract: Contract) -> ContractResponse:
    s = get_settings()
    value = Decimal(contract.agreed_price)
    platform_fee = value * Decimal(str(s.CONTRACT_PLATFORM_FEE_PCT)) / 100
    commission = (
        value * Decimal(str(s.CONTRACT_PROVIDER_COMMISSION_PCT)) / 100
    )
    edit_fee_pct = _calc_edit_fee_pct(contract.contract_edit_count)
    edit_fee = value * Decimal(str(edit_fee_pct)) / 100
    open_dispute = contract_repo.has_open_dispute(db, contract.id)
    cancellation_pending = contract.cancellation_requested_at is not None
    termination_estimate = (
        float(s.CONTRACT_CANCELLATION_FEE_CAP_PCT)
        if cancellation_pending
        else None
    )
    return ContractResponse(
        id=contract.id,
        ask_id=contract.ask_id,
        offer_id=contract.offer_id,
        seeker_id=contract.seeker_id,
        provider_id=contract.provider_id,
        agreed_price=contract.agreed_price,
        currency=contract.currency,
        deliverables=list(contract.deliverables or []),
        status=contract.status,
        rating=contract.rating,
        review=contract.review,
        created_at=contract.created_at,
        completed_at=contract.completed_at,
        milestones=[
            MilestoneResponse.model_validate(m)
            for m in sorted(contract.milestones, key=lambda m: m.position)
        ],
        scope=contract.scope,
        final_deadline=contract.final_deadline,
        included_revision_count=contract.included_revision_count,
        revisions_used=contract.revisions_used,
        ownership_option=contract.ownership_option,
        portfolio_permission=contract.portfolio_permission,
        confidentiality_agreed=contract.confidentiality_agreed,
        terms_version=contract.terms_version,
        ask_side_signed_at=contract.ask_side_signed_at,
        respond_side_signed_at=contract.respond_side_signed_at,
        project_progress=contract.project_progress,
        contract_edit_count=contract.contract_edit_count,
        calculated_edit_fee=_money(edit_fee),
        project_value=_money(value),
        platform_fee=_money(platform_fee),
        provider_commission=_money(commission),
        cancellation_requested=cancellation_pending,
        cancellation_reason=contract.cancellation_reason,
        cancellation_requested_at=contract.cancellation_requested_at,
        cancellation_progress_snapshot=contract.cancellation_progress_snapshot,
        cancellation_termination_estimate_pct=termination_estimate,
        has_open_dispute=open_dispute,
    )


# --------------------------------------------------------------------------
# Contract creation (inside the accept transaction)
# --------------------------------------------------------------------------


def _split_25_50_25(total: Decimal) -> list[Decimal]:
    """25% / 50% / remainder. The remainder lands on the final stage so the
    three amounts always sum exactly to the agreed price."""
    initial = (total * Decimal("0.25")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    progress = (total * Decimal("0.50")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    final = total - initial - progress
    return [initial, progress, final]


def _stage_due_dates(start: date, delivery_days: int) -> list[date]:
    """Spread the three stage due dates across the delivery window."""
    return [
        start + timedelta(days=math.ceil(delivery_days * (index + 1) / 3))
        for index in range(3)
    ]


def initial_stages(offer: Offer) -> list[Milestone]:
    """Deterministic 25/50/25 payment stages for the accepted offer."""
    amounts = _split_25_50_25(Decimal(offer.price))
    dues = _stage_due_dates(offer.created_at.date(), offer.delivery_days)
    kinds = [StageKind.initial, StageKind.progress, StageKind.final]
    return [
        Milestone(
            id=uuid.uuid4(),
            title=STAGE_TITLES[kind],
            description=None,
            amount=amount,
            due_date=due,
            status=MilestoneStatus.not_due,
            kind=kind,
            position=index,
        )
        for index, (kind, amount, due) in enumerate(
            zip(kinds, amounts, dues, strict=True)
        )
    ]


def create_contract_for_accept(
    db: Session, *, ask, offer: Offer
) -> Contract:
    """Create the contract **draft** for an accepted offer — same
    transaction as the accept. Idempotent: one contract per ASK, ever.

    The draft carries a frozen terms snapshot and three not-yet-due payment
    stages. It only becomes active once both sides sign.
    """
    existing = contract_repo.find_by_ask(db, ask.id)
    if existing is not None:
        return existing

    s = get_settings()
    contract = Contract(
        id=uuid.uuid4(),
        ask_id=ask.id,
        offer_id=offer.id,
        seeker_id=ask.requester_id,
        provider_id=offer.provider_id,
        agreed_price=offer.price,
        currency=offer.currency,
        deliverables=list(offer.deliverables or []),
        status=ContractStatus.draft,
        # Terms snapshot taken now, so later ASK/offer edits never silently
        # change the contract.
        scope=offer.pitch,
        final_deadline=offer.created_at.date()
        + timedelta(days=offer.delivery_days),
        included_revision_count=s.CONTRACT_DEFAULT_INCLUDED_REVISIONS,
        revisions_used=0,
        ownership_option=OwnershipOption.transfers_after_final_payment,
        portfolio_permission=PortfolioPermission.ask_before_using,
        confidentiality_agreed=False,
        terms_version=s.CONTRACT_TERMS_VERSION,
        project_progress=0,
        contract_edit_count=0,
    )
    contract.milestones = initial_stages(offer)
    db.add(contract)
    db.flush()
    contract_repo.add_history(
        db,
        contract.id,
        "contract_generated",
        details={
            "agreedPrice": _money(Decimal(offer.price)),
            "currency": offer.currency,
            "termsVersion": s.CONTRACT_TERMS_VERSION,
        },
    )
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
    items = [_contract_response(db, contract) for contract in rows]
    return build_page(items, page=pp.page, page_size=pp.page_size, total=total)


def get_ask_contract(
    db: Session, ask_id: UUID, *, current_user: User
) -> ContractResponse:
    contract = contract_repo.find_by_ask(db, ask_id)
    if contract is None:
        raise NotFoundError("Contract not found.", code="CONTRACT_NOT_FOUND")
    _require_participant(contract, current_user)
    return _contract_response(db, contract)


def get_contract_detail(
    db: Session, contract_id: UUID, *, current_user: User
) -> ContractResponse:
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    return _contract_response(db, contract)


def list_history(
    db: Session,
    contract_id: UUID,
    *,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
) -> Page[ContractHistoryResponse]:
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    pp = PageParams(page=page, page_size=page_size)
    rows, total = contract_repo.list_history(
        db, contract_id, offset=pp.offset, limit=pp.limit
    )
    items = [ContractHistoryResponse.model_validate(r) for r in rows]
    return build_page(items, page=pp.page, page_size=pp.page_size, total=total)


# --------------------------------------------------------------------------
# Signing
# --------------------------------------------------------------------------


def sign_contract(
    db: Session, contract_id: UUID, *, current_user: User
) -> ContractResponse:
    """The authenticated participant signs for their own side. Idempotent.

    First signature moves draft -> awaiting_signatures; the second moves the
    contract to active and makes the initial 25% stage due.
    """
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)

    # Terminal states reject signing outright — even an idempotent re-sign.
    if contract.status in (
        ContractStatus.completed,
        ContractStatus.cancelled,
    ):
        raise InvalidTransitionError(
            "This contract can no longer be signed.",
            code="CONTRACT_NOT_SIGNABLE",
        )

    # Idempotency: a side that already signed gets the current state back.
    if contract.seeker_id == current_user.id and contract.ask_side_signed_at:
        return _contract_response(db, contract)
    if (
        contract.provider_id == current_user.id
        and contract.respond_side_signed_at
    ):
        return _contract_response(db, contract)

    if contract.status not in (
        ContractStatus.draft,
        ContractStatus.awaiting_signatures,
    ):
        raise InvalidTransitionError(
            "This contract can no longer be signed.",
            code="CONTRACT_NOT_SIGNABLE",
        )

    now = datetime.now(UTC)
    if contract.seeker_id == current_user.id:
        side = "askSide"
        contract.ask_side_signed_at = now
    else:
        side = "respondSide"
        contract.respond_side_signed_at = now

    contract_repo.add_history(
        db, contract.id, "contract_signed", actor_id=current_user.id,
        details={"side": side},
    )

    both_signed = (
        contract.ask_side_signed_at is not None
        and contract.respond_side_signed_at is not None
    )
    if both_signed:
        contract.status = ContractStatus.active
        _stage_of_kind(contract, StageKind.initial).status = (
            MilestoneStatus.due
        )
        contract_repo.add_history(
            db, contract.id, "contract_activated", actor_id=current_user.id
        )
    else:
        contract.status = ContractStatus.awaiting_signatures

    db.flush()
    resp = _contract_response(db, contract)
    db.commit()
    return resp


# --------------------------------------------------------------------------
# Payment stage (mark paid) + completion
# --------------------------------------------------------------------------


def update_milestone(
    db: Session,
    contract_id: UUID,
    milestone_id: UUID,
    payload: MilestoneStatusUpdate,
    *,
    current_user: User,
) -> MilestoneResponse:
    """ASK side marks a `due` payment stage as paid (mock payment)."""
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    _require_seeker(contract, current_user)
    if contract.status != ContractStatus.active:
        raise InvalidTransitionError(
            "Contract is not active.", code="CONTRACT_NOT_ACTIVE"
        )
    milestone = _milestone_or_404(db, contract_id, milestone_id)
    if milestone.status == MilestoneStatus.paid:
        raise InvalidTransitionError(
            "This payment stage is already paid.",
            code="INVALID_STATUS_TRANSITION",
        )
    if milestone.status != MilestoneStatus.due:
        raise InvalidTransitionError(
            "Only a due payment stage can be marked paid.",
            code="INVALID_STATUS_TRANSITION",
        )

    milestone.status = MilestoneStatus.paid
    if milestone.kind == StageKind.initial:
        contract.project_progress = 25
    contract_repo.add_history(
        db,
        contract.id,
        "payment_stage_changed",
        actor_id=current_user.id,
        details={
            "stage": milestone.kind.value,
            "status": "paid",
            "amount": _money(Decimal(milestone.amount)),
        },
    )
    db.flush()
    resp = MilestoneResponse.model_validate(milestone)
    db.commit()
    return resp


def complete_contract(
    db: Session, contract_id: UUID, *, current_user: User
) -> ContractResponse:
    """ASK side completes the contract once the final stage is paid."""
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    _require_seeker(contract, current_user)
    if contract.status != ContractStatus.active:
        raise InvalidTransitionError(
            "Contract is already completed.", code="CONTRACT_NOT_ACTIVE"
        )
    final_stage = _stage_of_kind(contract, StageKind.final)
    if final_stage.status != MilestoneStatus.paid:
        raise InvalidTransitionError(
            "The final payment stage must be paid before completion.",
            code="CONTRACT_NOT_COMPLETE",
        )

    contract.status = ContractStatus.completed
    contract.completed_at = datetime.now(UTC)
    contract_repo.add_history(
        db, contract.id, "contract_completed", actor_id=current_user.id
    )
    db.flush()
    resp = _contract_response(db, contract)
    db.commit()
    return resp


# --------------------------------------------------------------------------
# Progress (60% checkpoint and final submission)
# --------------------------------------------------------------------------


def submit_progress(
    db: Session,
    contract_id: UUID,
    payload: ProgressSubmit,
    *,
    current_user: User,
) -> ContractResponse:
    """Respond side submits progress (60) or final work (100) for review."""
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    _require_provider(contract, current_user)
    if contract.status != ContractStatus.active:
        raise InvalidTransitionError(
            "Contract is not active.", code="CONTRACT_NOT_ACTIVE"
        )
    if _awaiting_stage(contract) is not None:
        raise ConflictError(
            "A submitted progress is already awaiting review.",
            code="PROGRESS_ALREADY_SUBMITTED",
        )

    if payload.progress == 60:
        if contract.project_progress != 25:
            raise ConflictError(
                "The initial 25% stage must be paid before 60% progress.",
                code="PROGRESS_NOT_DUE",
            )
        stage = _stage_of_kind(contract, StageKind.progress)
    else:  # 100
        if contract.project_progress != 60:
            raise ConflictError(
                "60% progress must be approved before final submission.",
                code="PROGRESS_NOT_DUE",
            )
        stage = _stage_of_kind(contract, StageKind.final)

    stage.status = MilestoneStatus.awaiting_approval
    contract_repo.add_history(
        db,
        contract.id,
        "progress_submitted",
        actor_id=current_user.id,
        details={"progress": payload.progress},
    )
    db.flush()
    resp = _contract_response(db, contract)
    db.commit()
    return resp


def approve_progress(
    db: Session, contract_id: UUID, *, current_user: User
) -> ContractResponse:
    """ASK side approves the submitted stage -> it becomes due (not paid)."""
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    _require_seeker(contract, current_user)
    if contract.status != ContractStatus.active:
        raise InvalidTransitionError(
            "Contract is not active.", code="CONTRACT_NOT_ACTIVE"
        )
    stage = _awaiting_stage(contract)
    if stage is None:
        raise ConflictError(
            "There is no submitted progress to approve.",
            code="NO_PENDING_PROGRESS",
        )

    stage.status = MilestoneStatus.due
    if stage.kind == StageKind.progress:
        contract.project_progress = 60
        approved = 60
    else:
        contract.project_progress = 100
        approved = 100
    contract_repo.add_history(
        db,
        contract.id,
        "progress_approved",
        actor_id=current_user.id,
        details={"progress": approved},
    )
    db.flush()
    resp = _contract_response(db, contract)
    db.commit()
    return resp


def request_revision(
    db: Session, contract_id: UUID, *, current_user: User
) -> ContractResponse:
    """ASK side requests a revision of the submitted stage.

    Increments revisionsUsed. Blocked once the included allowance is
    exhausted — a contract amendment is required beyond that.
    """
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    _require_seeker(contract, current_user)
    if contract.status != ContractStatus.active:
        raise InvalidTransitionError(
            "Contract is not active.", code="CONTRACT_NOT_ACTIVE"
        )
    stage = _awaiting_stage(contract)
    if stage is None:
        raise ConflictError(
            "There is no submitted progress to revise.",
            code="NO_PENDING_PROGRESS",
        )
    if contract.revisions_used >= contract.included_revision_count:
        raise ConflictError(
            "The included revisions are exhausted. A contract amendment "
            "is required to request further revisions.",
            code="REVISIONS_EXHAUSTED",
        )

    contract.revisions_used += 1
    stage.status = MilestoneStatus.not_due
    contract_repo.add_history(
        db,
        contract.id,
        "revision_requested",
        actor_id=current_user.id,
        details={
            "revisionsUsed": contract.revisions_used,
            "includedRevisionCount": contract.included_revision_count,
            "stage": stage.kind.value,
        },
    )
    db.flush()
    resp = _contract_response(db, contract)
    db.commit()
    return resp


# --------------------------------------------------------------------------
# Rating (unchanged behaviour)
# --------------------------------------------------------------------------


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
    resp = _contract_response(db, contract)
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
# Disputes
# --------------------------------------------------------------------------


def raise_dispute(
    db: Session,
    contract_id: UUID,
    payload: DisputeCreate,
    *,
    current_user: User,
) -> ContractDisputeResponse:
    """Either participant opens a dispute; contract + the live stage go to
    `disputed`. No winner is decided and no money moves."""
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    if contract.status in (ContractStatus.completed, ContractStatus.cancelled):
        raise InvalidTransitionError(
            "This contract is closed.", code="CONTRACT_NOT_ACTIVE"
        )
    if contract_repo.has_open_dispute(db, contract.id):
        raise ConflictError(
            "A dispute is already open on this contract.",
            code="DISPUTE_ALREADY_OPEN",
        )

    dispute = ContractDispute(
        contract_id=contract.id,
        raised_by=current_user.id,
        reason=payload.reason,
        description=payload.description,
        status=DisputeStatus.open,
    )
    db.add(dispute)
    contract.status = ContractStatus.disputed
    # Put the stage under review (or the due stage) into disputed too.
    for milestone in contract.milestones:
        if milestone.status in (
            MilestoneStatus.awaiting_approval,
            MilestoneStatus.due,
        ):
            milestone.status = MilestoneStatus.disputed
    contract_repo.add_history(
        db,
        contract.id,
        "dispute_raised",
        actor_id=current_user.id,
        details={"reason": payload.reason.value},
    )
    db.flush()
    resp = ContractDisputeResponse.model_validate(dispute)
    db.commit()
    return resp


def resolve_dispute(
    db: Session,
    contract_id: UUID,
    dispute_id: UUID,
    *,
    current_user: User,
) -> ContractResponse:
    """A participant resolves their dispute. When none remain open the
    contract returns to active. Still no automatic refund or payment."""
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    dispute = contract_repo.get_dispute(db, contract.id, dispute_id)
    if dispute is None:
        raise NotFoundError("Dispute not found.", code="DISPUTE_NOT_FOUND")
    if dispute.status == DisputeStatus.resolved:
        raise InvalidTransitionError(
            "This dispute is already resolved.", code="DISPUTE_NOT_OPEN"
        )

    dispute.status = DisputeStatus.resolved
    dispute.resolved_at = datetime.now(UTC)
    contract_repo.add_history(
        db,
        contract.id,
        "dispute_resolved",
        actor_id=current_user.id,
        details={"disputeId": str(dispute.id)},
    )
    # Flush the resolution before re-checking for other open disputes —
    # autoflush is off, so the query below must see this write.
    db.flush()
    if not contract_repo.has_open_dispute(db, contract.id):
        if contract.status == ContractStatus.disputed:
            contract.status = ContractStatus.active
        # Disputed stages fall back to due so the flow can continue.
        for milestone in contract.milestones:
            if milestone.status == MilestoneStatus.disputed:
                milestone.status = MilestoneStatus.due
    db.flush()
    resp = _contract_response(db, contract)
    db.commit()
    return resp


def list_disputes(
    db: Session,
    contract_id: UUID,
    *,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
) -> Page[ContractDisputeResponse]:
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    pp = PageParams(page=page, page_size=page_size)
    rows, total = contract_repo.list_disputes(
        db, contract_id, offset=pp.offset, limit=pp.limit
    )
    items = [ContractDisputeResponse.model_validate(r) for r in rows]
    return build_page(items, page=pp.page, page_size=pp.page_size, total=total)


# --------------------------------------------------------------------------
# Cancellation
# --------------------------------------------------------------------------


def request_cancellation(
    db: Session,
    contract_id: UUID,
    payload: CancellationRequest,
    *,
    current_user: User,
) -> ContractResponse:
    """Either participant records a cancellation request. It never instantly
    terminates the contract; the other side must approve."""
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    if contract.status in (ContractStatus.completed, ContractStatus.cancelled):
        raise InvalidTransitionError(
            "This contract is closed.", code="CONTRACT_NOT_ACTIVE"
        )
    if contract.cancellation_requested_at is not None:
        raise ConflictError(
            "A cancellation request is already pending.",
            code="CANCELLATION_ALREADY_REQUESTED",
        )

    contract.cancellation_requested_by = current_user.id
    contract.cancellation_reason = payload.reason
    contract.cancellation_requested_at = datetime.now(UTC)
    contract.cancellation_progress_snapshot = contract.project_progress
    contract_repo.add_history(
        db,
        contract.id,
        "cancellation_requested",
        actor_id=current_user.id,
        details={
            "reason": payload.reason,
            "progressSnapshot": contract.project_progress,
        },
    )
    db.flush()
    resp = _contract_response(db, contract)
    db.commit()
    return resp


def approve_cancellation(
    db: Session, contract_id: UUID, *, current_user: User
) -> ContractResponse:
    """The other participant approves -> the contract becomes cancelled."""
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    if contract.cancellation_requested_at is None:
        raise ConflictError(
            "There is no pending cancellation request.",
            code="NO_CANCELLATION_REQUEST",
        )
    if contract.cancellation_requested_by == current_user.id:
        raise ForbiddenError(
            "Only the other participant can approve this cancellation.",
            code="NOT_CANCELLATION_APPROVER",
        )

    contract.status = ContractStatus.cancelled
    contract_repo.add_history(
        db, contract.id, "cancellation_approved", actor_id=current_user.id
    )
    db.flush()
    resp = _contract_response(db, contract)
    db.commit()
    return resp


# --------------------------------------------------------------------------
# Amendments
# --------------------------------------------------------------------------


def _coerce_amendment_value(kind: str, value):
    if kind == "text":
        if not isinstance(value, str):
            raise ValidationError("scope must be a string.")
        return value.strip() or None
    if kind == "str_list":
        if not isinstance(value, list) or not all(
            isinstance(v, str) for v in value
        ):
            raise ValidationError("deliverables must be a list of strings.")
        return value
    if kind == "date":
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return date.fromisoformat(value)
            except ValueError as exc:
                raise ValidationError(
                    "finalDeadline must be an ISO date."
                ) from exc
        raise ValidationError("finalDeadline must be an ISO date.")
    if kind == "int":
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValidationError("includedRevisionCount must be an integer.")
        if value < 0:
            raise ValidationError(
                "includedRevisionCount cannot be negative."
            )
        return value
    if kind == "bool":
        if not isinstance(value, bool):
            raise ValidationError(
                "confidentialityAgreed must be a boolean."
            )
        return value
    if kind == "ownership":
        try:
            return OwnershipOption(value)
        except ValueError as exc:
            raise ValidationError("Invalid ownershipOption.") from exc
    if kind == "portfolio":
        try:
            return PortfolioPermission(value)
        except ValueError as exc:
            raise ValidationError("Invalid portfolioPermission.") from exc
    raise ValidationError("Unknown amendment field.")


def propose_amendment(
    db: Session,
    contract_id: UUID,
    payload: AmendmentCreate,
    *,
    current_user: User,
) -> ContractAmendmentResponse:
    """Either participant proposes a terms change. It does NOT touch the live
    contract until the other participant approves. Locked after 60% progress
    unless a dispute is open (dispute-related correction)."""
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    if contract.status != ContractStatus.active:
        raise InvalidTransitionError(
            "Amendments require an active contract.",
            code="CONTRACT_NOT_ACTIVE",
        )
    if contract.project_progress >= 60 and not contract_repo.has_open_dispute(
        db, contract.id
    ):
        raise ConflictError(
            "Contract terms are locked after 60% progress. Only a dispute "
            "correction or exceptional amendment is allowed.",
            code="CONTRACT_EDIT_LOCKED",
        )
    if contract_repo.has_pending_amendment(db, contract.id):
        raise ConflictError(
            "An amendment is already pending approval.",
            code="AMENDMENT_ALREADY_PENDING",
        )

    # Validate the proposed field names + values before storing.
    changes: dict[str, object] = {}
    for api_name, raw in payload.changes.items():
        if api_name not in _AMENDABLE_FIELDS:
            raise ValidationError(
                f"'{api_name}' is not an amendable contract field."
            )
        attr, kind = _AMENDABLE_FIELDS[api_name]
        changes[api_name] = _coerce_amendment_value(kind, raw)

    amendment = ContractAmendment(
        contract_id=contract.id,
        proposed_by=current_user.id,
        status=AmendmentStatus.pending,
        changes=changes,
        reason=payload.reason,
        edit_number=contract.contract_edit_count + 1,
    )
    db.add(amendment)
    contract_repo.add_history(
        db,
        contract.id,
        "terms_amended",
        actor_id=current_user.id,
        details={"editNumber": amendment.edit_number, "phase": "proposed"},
    )
    db.flush()
    resp = ContractAmendmentResponse.model_validate(amendment)
    db.commit()
    return resp


def decide_amendment(
    db: Session,
    contract_id: UUID,
    amendment_id: UUID,
    *,
    approve: bool,
    current_user: User,
) -> ContractAmendmentResponse:
    """The other participant approves (applies + increments edit count) or
    rejects the pending amendment."""
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    amendment = contract_repo.get_amendment(db, contract.id, amendment_id)
    if amendment is None:
        raise NotFoundError(
            "Amendment not found.", code="AMENDMENT_NOT_FOUND"
        )
    if amendment.status != AmendmentStatus.pending:
        raise InvalidTransitionError(
            "This amendment has already been decided.",
            code="AMENDMENT_NOT_PENDING",
        )
    if amendment.proposed_by == current_user.id:
        raise ForbiddenError(
            "Only the other participant can decide this amendment.",
            code="NOT_AMENDMENT_APPROVER",
        )

    amendment.resolved_by = current_user.id
    amendment.resolved_at = datetime.now(UTC)
    if not approve:
        amendment.status = AmendmentStatus.rejected
        contract_repo.add_history(
            db,
            contract.id,
            "terms_amended",
            actor_id=current_user.id,
            details={
                "editNumber": amendment.edit_number,
                "phase": "rejected",
            },
        )
    else:
        amendment.status = AmendmentStatus.approved
        for api_name, value in amendment.changes.items():
            attr, _kind = _AMENDABLE_FIELDS[api_name]
            setattr(contract, attr, value)
        contract.contract_edit_count += 1
        contract_repo.add_history(
            db,
            contract.id,
            "terms_amended",
            actor_id=current_user.id,
            details={
                "editNumber": amendment.edit_number,
                "phase": "applied",
                "fields": sorted(amendment.changes.keys()),
            },
        )
    db.flush()
    resp = ContractAmendmentResponse.model_validate(amendment)
    db.commit()
    return resp


def list_amendments(
    db: Session,
    contract_id: UUID,
    *,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
) -> Page[ContractAmendmentResponse]:
    contract = _contract_or_404(db, contract_id)
    _require_participant(contract, current_user)
    pp = PageParams(page=page, page_size=page_size)
    rows, total = contract_repo.list_amendments(
        db, contract_id, offset=pp.offset, limit=pp.limit
    )
    items = [ContractAmendmentResponse.model_validate(r) for r in rows]
    return build_page(items, page=pp.page, page_size=pp.page_size, total=total)


# --------------------------------------------------------------------------
# Reputation + completed history (unchanged)
# --------------------------------------------------------------------------


def reputation(db: Session, user_id: UUID) -> ReputationResponse:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found.", code="USER_NOT_FOUND")

    total, paid, revenue = contract_repo.provider_milestone_stats(
        db, user_id
    )
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
