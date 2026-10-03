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
    """Contract lifecycle. Both states are terminal-friendly: `completed`
    never reverts, `active` is the only state where milestones move."""

    active = "active"
    completed = "completed"


class MilestoneStatus(StrEnum):
    """Role-gated milestone flow.

    provider: upcoming -> in_progress -> submitted (or straight to submitted)
    seeker:   submitted -> approved -> paid
    `paid` is terminal. Mock payment state — no gateway involved.
    """

    upcoming = "upcoming"
    in_progress = "in_progress"
    submitted = "submitted"
    approved = "approved"
    paid = "paid"


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
