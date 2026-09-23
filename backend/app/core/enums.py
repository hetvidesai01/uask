from enum import Enum


class UserRole(str, Enum):
    seeker = "seeker"
    provider = "provider"
    admin = "admin"


class AskStatus(str, Enum):
    open = "open"
    matched = "matched"
    in_review = "in_review"
    closed = "closed"
    cancelled = "cancelled"


class OfferStatus(str, Enum):
    pending = "pending"
    shortlisted = "shortlisted"
    accepted = "accepted"
    rejected = "rejected"
    withdrawn = "withdrawn"


class NotificationType(str, Enum):
    ask_new_offer = "ask_new_offer"
    offer_shortlisted = "offer_shortlisted"
    offer_accepted = "offer_accepted"
    offer_rejected = "offer_rejected"
    ask_closing_soon = "ask_closing_soon"
    new_message = "new_message"
    ask_matched = "ask_matched"
    system = "system"
