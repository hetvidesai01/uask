from enum import StrEnum


class UserRole(StrEnum):
    seeker = "seeker"
    provider = "provider"
    admin = "admin"


class AskStatus(StrEnum):
    """ASK lifecycle as the frozen frontend expects it.

    open       — live, accepts new offers
    matched    — a responder shortlist was surfaced (frontend-driven)
    in_review  — the owner is comparing offers (frontend-driven)
    accepted   — a provider was chosen; work may proceed
    closed     — the work is finished / the ASK is done
    cancelled  — backend-only terminal state, kept for data that already
                 used it; never removed
    """

    open = "open"
    matched = "matched"
    in_review = "in_review"
    accepted = "accepted"
    closed = "closed"
    cancelled = "cancelled"


class OfferStatus(StrEnum):
    pending = "pending"
    shortlisted = "shortlisted"
    accepted = "accepted"
    rejected = "rejected"
    withdrawn = "withdrawn"


class ContractStatus(StrEnum):
    """Contract lifecycle for the redesigned frontend flow.

    draft                — created by the accept transaction; terms not yet
                           signed by either side.
    awaiting_signatures  — at least one side signed, waiting for the other.
    active               — both sides signed; payment stages move.
    completed            — final stage paid and completed; terminal.
    cancelled            — mutually cancelled; terminal.
    disputed             — an open dispute is on the contract.
    """

    draft = "draft"
    awaiting_signatures = "awaiting_signatures"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"
    disputed = "disputed"


class PaymentStageStatus(StrEnum):
    """Payment-stage (milestone) states for the 25/50/25 prototype schedule.

    not_due           — stage not yet eligible.
    due               — eligible; the ASK side may mark it paid.
    awaiting_approval — provider submitted work for this stage, the ASK side
                        has not yet approved it.
    paid              — ASK side marked paid (mock payment state, terminal).
    disputed          — an open dispute targets this stage.
    """

    not_due = "not_due"
    due = "due"
    awaiting_approval = "awaiting_approval"
    paid = "paid"
    disputed = "disputed"


# Kept as an alias so older imports keep working; new code should use
# PaymentStageStatus. The DB enum type is `milestone_status`.
MilestoneStatus = PaymentStageStatus


class StageKind(StrEnum):
    """Which of the three fixed payment stages a milestone row is."""

    initial = "initial"
    progress = "progress"
    final = "final"


class OwnershipOption(StrEnum):
    transfers_after_final_payment = "transfers_after_final_payment"
    custom = "custom"


class PortfolioPermission(StrEnum):
    allowed = "allowed"
    not_allowed = "not_allowed"
    ask_before_using = "ask_before_using"


class DisputeReason(StrEnum):
    scope_mismatch = "scope_mismatch"
    missed_deadline = "missed_deadline"
    communication_issue = "communication_issue"
    payment_disagreement = "payment_disagreement"
    revision_disagreement = "revision_disagreement"
    other = "other"


class DisputeStatus(StrEnum):
    open = "open"
    resolved = "resolved"


class AmendmentStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    withdrawn = "withdrawn"


class NotificationType(StrEnum):
    """Names on the wire are the canonical frontend names.

    `offer_received` / `message` were renamed from the older internal names
    `ask_new_offer` / `new_message` in the contract-alignment migration, so
    the API emits canonical values directly — no per-service mapping layer.
    `ask_closing_soon`, `ask_matched` and `system` are extra backend values
    the frontend does not use yet; they stay.
    """

    offer_received = "offer_received"
    offer_shortlisted = "offer_shortlisted"
    offer_accepted = "offer_accepted"
    offer_rejected = "offer_rejected"
    ask_closing_soon = "ask_closing_soon"
    message = "message"
    ask_matched = "ask_matched"
    system = "system"
