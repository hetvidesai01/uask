"""Responder matching — deterministic, rule-based scoring of submitted offers.

Scores ONLY the offers already submitted on an ASK: the wider provider
directory is never scored, no winner is ever selected, and ranking never
writes to the database. Flow: ASK → providers submit offers → this service
scores those responses → the seeker compares and chooses manually.

No AI, no embeddings, no external API — every component is a pure function
over data the backend already has. `WEIGHTS` is the single place to retune.
"""

import math
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.ask import Ask
from app.models.offer import Offer
from app.models.user import User
from app.repositories import ask_repo, offer_repo
from app.schemas.ask import AskResponse
from app.schemas.matching import MatchStrength, RankedResponse
from app.schemas.offer import OfferResponse
from app.schemas.user import UserPublic

# --- scoring definition (percent, must total 100) --------------------------
WEIGHTS: dict[str, int] = {
    "category_relevance": 30,
    "similar_projects": 25,
    "rating_reviews": 15,
    "budget_fit": 10,
    "timeline_fit": 10,
    "profile_booster": 10,
}
assert sum(WEIGHTS.values()) == 100, "scoring weights must total 100"

# Component score (0–100) used when a signal does not exist yet: neutral,
# so a missing signal neither helps nor hurts the comparable total.
NEUTRAL_SCORE = 50.0

MAX_REASONS = 3
EXCELLENT_MIN = 80
STRONG_MIN = 55

STRENGTH_PRIORITY: tuple[MatchStrength, ...] = (
    "Best value",
    "Fastest delivery",
    "Highest rated",
    "Strongest portfolio fit",
)


@dataclass(frozen=True)
class OfferScore:
    score: int
    label: str
    reasons: list[str]
    components: dict[str, float]


def label_for(score: int) -> str:
    if score >= EXCELLENT_MIN:
        return "Excellent Match"
    if score >= STRONG_MIN:
        return "Strong Match"
    return "Relevant"


def category_score(ask: Ask, provider: User) -> float:
    wanted = (ask.category or "").strip().lower()
    have = {(c or "").strip().lower() for c in (provider.categories or [])}
    return 100.0 if wanted and wanted in have else 0.0


def similar_projects_score(similar_projects: int | None) -> float:
    """25% component — neutral until Contracts/Reputation supply real data."""
    if similar_projects is None:
        return NEUTRAL_SCORE
    return min(max(similar_projects, 0) / 5, 1.0) * 100


def rating_score(provider: User) -> float:
    """15% component. No reviews yet → no reputation data → neutral."""
    reviews = provider.review_count or 0
    if reviews <= 0:
        return NEUTRAL_SCORE
    rating_part = float(provider.rating or 0) / 5 * 100
    volume_part = min(reviews / 10, 1.0) * 100
    return 0.7 * rating_part + 0.3 * volume_part


def budget_score(ask: Ask, offer: Offer) -> float:
    """10% component — price against the ASK's stated budget."""
    if offer.currency != ask.currency:
        return NEUTRAL_SCORE  # different currencies are not comparable
    price = float(offer.price)
    low = float(ask.budget_min) if ask.budget_min is not None else None
    high = float(ask.budget_max) if ask.budget_max is not None else None
    if high is None and low is None:
        return NEUTRAL_SCORE  # ASK stated no budget
    if high is None:
        return NEUTRAL_SCORE  # floor only — no ceiling to be compatible with
    if price <= high:
        return 100.0  # at (or under) the stated ceiling
    return max(0.0, 100.0 * high / price)  # over budget → falls with overshoot


def timeline_score(ask: Ask, offer: Offer) -> float:
    """10% component — deliveryDays against the ASK deadline."""
    if ask.deadline is None or offer.created_at is None:
        return NEUTRAL_SCORE  # no deadline to fit
    days_available = (ask.deadline - offer.created_at.date()).days
    if days_available <= 0:
        return 0.0  # deadline already reached when the offer arrived
    if offer.delivery_days <= days_available:
        return 100.0
    return max(0.0, 100.0 * days_available / offer.delivery_days)


def profile_score(provider: User) -> float:
    """10% "Profile Booster" — completeness of the real profile fields."""
    signals = (
        bool(provider.avatar_url),
        bool(provider.bio),
        bool(provider.location),
        bool(provider.categories),
    )
    return 100.0 * sum(signals) / len(signals)


def _reasons(
    ask: Ask,
    offer: Offer,
    provider: User,
    components: dict[str, float],
) -> list[str]:
    """Up to MAX_REASONS short, factual highlights of favourable factors."""
    order = {name: index for index, name in enumerate(WEIGHTS)}
    candidates: list[tuple[float, int, str]] = []

    def add(name: str, text: str, *, perfect_only: bool) -> None:
        value = components[name]
        if perfect_only:
            if value < 100.0:
                return
        elif value <= NEUTRAL_SCORE:
            return
        candidates.append((WEIGHTS[name] * value / 100.0, order[name], text))

    add(
        "category_relevance",
        f"Matches ASK category {ask.category}",
        perfect_only=True,
    )
    if (provider.review_count or 0) > 0:
        rating = float(provider.rating)
        add(
            "rating_reviews",
            f"Rated {rating:.1f} across {provider.review_count} reviews",
            perfect_only=False,
        )
    add("budget_fit", "Price fits the budget", perfect_only=True)
    add("timeline_fit", "Delivery fits the deadline", perfect_only=True)
    add("profile_booster", "Complete provider profile", perfect_only=True)

    candidates.sort(key=lambda item: (-item[0], item[1]))
    return [text for _, _, text in candidates[:MAX_REASONS]]


def score_offer(
    ask: Ask,
    offer: Offer,
    provider: User,
    *,
    similar_projects: int | None = None,
) -> OfferScore:
    """Score one submitted response. Pure — no DB, no side effects.

    `similar_projects` is None while Contracts/Reputation are unimplemented;
    pass a real count there later to plug that data in without touching
    anything else.
    """
    components = {
        "category_relevance": category_score(ask, provider),
        "similar_projects": similar_projects_score(similar_projects),
        "rating_reviews": rating_score(provider),
        "budget_fit": budget_score(ask, offer),
        "timeline_fit": timeline_score(ask, offer),
        "profile_booster": profile_score(provider),
    }
    total = sum(WEIGHTS[name] * value / 100 for name, value in components.items())
    score = max(0, min(100, int(math.floor(total + 0.5))))
    return OfferScore(
        score=score,
        label=label_for(score),
        reasons=_reasons(ask, offer, provider, components),
        components=components,
    )


def rank_sort_key(pair: tuple[OfferScore, Offer]) -> tuple:
    """Deterministic ordering: score desc → rating desc → price asc →
    earlier response → offer id. Never random."""
    score, offer = pair
    return (
        -score.score,
        -float(offer.provider.rating),
        float(offer.price),
        offer.created_at,
        offer.id,
    )


def assign_strengths(
    scored: list[tuple[OfferScore, Offer]],
) -> dict[UUID, MatchStrength]:
    """One superlative per offer, only when it is the unique holder.

    Superlatives need at least two responses; ties award nothing so no
    offer is picked arbitrarily.
    """
    if len(scored) < 2:
        return {}

    def holders(values: dict[UUID, float], *, best: str) -> set[UUID]:
        if not values:
            return set()
        target = min(values.values()) if best == "min" else max(values.values())
        matched = {uid for uid, value in values.items() if value == target}
        return matched if len(matched) == 1 else set()

    by_offer = {offer.id: (score, offer) for score, offer in scored}
    price = {oid: float(o.price) for oid, (_, o) in by_offer.items()}
    speed = {oid: float(o.delivery_days) for oid, (_, o) in by_offer.items()}
    rating = {oid: float(o.provider.rating) for oid, (_, o) in by_offer.items()}
    portfolio = {
        oid: (
            s.components["category_relevance"] + s.components["profile_booster"]
        )
        / 2
        for oid, (s, _) in by_offer.items()
    }

    winners: dict[MatchStrength, set[UUID]] = {
        "Best value": holders(price, best="min"),
        "Fastest delivery": holders(speed, best="min"),
        "Highest rated": holders(rating, best="max"),
        "Strongest portfolio fit": holders(portfolio, best="max"),
    }

    result: dict[UUID, MatchStrength] = {}
    for strength in STRENGTH_PRIORITY:
        matched = winners[strength]
        if len(matched) == 1:
            uid = next(iter(matched))
            if uid not in result:
                result[uid] = strength
    return result


def ranked_responses(
    db: Session, ask_id: UUID, *, current_user: User
) -> list[RankedResponse]:
    """Score the responses on an ASK — ASK owner only, read-only."""
    row = ask_repo.get_ask(db, ask_id)
    if row is None:
        raise NotFoundError("Ask not found.", code="ASK_NOT_FOUND")
    ask, _ = row
    if ask.requester_id != current_user.id:
        raise ForbiddenError(
            "Only the ASK owner may see ranked responses.",
            code="NOT_ASK_OWNER",
        )

    scored = [
        (score_offer(ask, offer, offer.provider), offer)
        for offer in offer_repo.list_live_with_providers(db, ask.id)
    ]
    scored.sort(key=rank_sort_key)
    strengths = assign_strengths(scored)

    return [
        RankedResponse(
            offer=OfferResponse.model_validate(offer),
            provider=UserPublic.model_validate(offer.provider),
            score=score.score,
            label=score.label,
            reasons=score.reasons,
            rating=float(offer.provider.rating),
            similar_project_count=None,
            strength=strengths.get(offer.id),
        )
        for score, offer in scored
    ]


def recommended_asks(
    db: Session, *, current_user: User, limit: int = 6
) -> list[AskResponse]:
    """Discovery for providers: open ASKs in their categories they have not
    answered and did not post. Separate from responder ranking — this never
    scores anyone.
    """
    rows = ask_repo.list_recommended(
        db,
        provider_id=current_user.id,
        categories=current_user.categories or [],
        limit=limit,
    )
    items: list[AskResponse] = []
    for ask, count in rows:
        response = AskResponse.model_validate(ask)
        response.response_count = count
        items.append(response)
    return items
