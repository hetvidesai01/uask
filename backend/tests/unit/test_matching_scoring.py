"""Unit tests for the deterministic responder-matching scorer (no DB)."""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest

from app.core.enums import AskStatus, OfferStatus, UserRole
from app.models.ask import Ask
from app.models.offer import Offer
from app.models.user import User
from app.services import matching_service as m

TODAY = datetime(2026, 10, 3, 12, 0, tzinfo=UTC)
DEADLINE = date(2026, 10, 17)

REASONS = {
    "Matches ASK category Design",
    "Price fits the budget",
    "Delivery fits the deadline",
    "Complete provider profile",
    "Rated 4.8 across 12 reviews",
}


def _ask(**overrides) -> Ask:
    payload = dict(
        id=uuid.uuid4(),
        requester_id=uuid.uuid4(),
        title="Need a professional logo design",
        description="A long enough description for a real ASK request.",
        category="Design",
        budget_min=Decimal("100"),
        budget_max=Decimal("500"),
        currency="INR",
        deadline=DEADLINE,
        status=AskStatus.open,
        created_at=TODAY,
        updated_at=TODAY,
    )
    payload.update(overrides)
    return Ask(**payload)


def _offer(**overrides) -> Offer:
    payload = dict(
        id=uuid.uuid4(),
        ask_id=uuid.uuid4(),
        provider_id=uuid.uuid4(),
        price=Decimal("300"),
        currency="INR",
        delivery_days=5,
        pitch="A detailed pitch that explains the whole approach nicely.",
        status=OfferStatus.pending,
        created_at=TODAY,
        updated_at=TODAY,
    )
    payload.update(overrides)
    return Offer(**payload)


def _provider(**overrides) -> User:
    payload = dict(
        id=uuid.uuid4(),
        name="Provider User",
        email=f"{uuid.uuid4().hex[:10]}@example.com",
        password_hash="x",
        roles=[UserRole.provider],
        categories=["Design"],
        rating=Decimal("0.0"),
        review_count=0,
        joined_at=TODAY,
        updated_at=TODAY,
    )
    payload.update(overrides)
    return User(**payload)


def _scored(score: int, provider: User, offer: Offer) -> tuple:
    """A (OfferScore, Offer) pair with the provider attached for sorting."""
    offer.provider = provider
    return (
        m.OfferScore(
            score=score, label=m.label_for(score), reasons=[], components={}
        ),
        offer,
    )


def _with_strength_components(score: int, offer: Offer) -> tuple:
    offer.provider = _provider()
    return (
        m.OfferScore(
            score=score,
            label=m.label_for(score),
            reasons=[],
            components={"category_relevance": 50.0, "profile_booster": 50.0},
        ),
        offer,
    )


# --------------------------------------------------------------------------
# Definition
# --------------------------------------------------------------------------


def test_weights_total_100_with_expected_split():
    assert m.WEIGHTS == {
        "category_relevance": 30,
        "similar_projects": 25,
        "rating_reviews": 15,
        "budget_fit": 10,
        "timeline_fit": 10,
        "profile_booster": 10,
    }
    assert sum(m.WEIGHTS.values()) == 100


def test_label_thresholds():
    assert m.label_for(100) == "Excellent Match"
    assert m.label_for(80) == "Excellent Match"
    assert m.label_for(79) == "Strong Match"
    assert m.label_for(55) == "Strong Match"
    assert m.label_for(54) == "Relevant"
    assert m.label_for(0) == "Relevant"


def test_score_stays_in_zero_to_one_hundred():
    ideal = m.score_offer(
        _ask(),
        _offer(price=Decimal("300"), delivery_days=3),
        _provider(
            rating=Decimal("4.9"),
            review_count=10,
            avatar_url="https://cdn.example.com/a.png",
            bio="Long-time designer.",
            location="Austin, TX",
        ),
    )
    worst = m.score_offer(
        _ask(budget_min=None, budget_max=None),
        _offer(price=Decimal("9000"), currency="USD", delivery_days=365),
        _provider(categories=["Errands"]),
    )
    for result in (ideal, worst):
        assert 0 <= result.score <= 100
    assert worst.score < ideal.score


# --------------------------------------------------------------------------
# Components
# --------------------------------------------------------------------------


def test_category_relevance_match_and_mismatch():
    ask = _ask(category="Design")
    assert m.category_score(ask, _provider(categories=["Design"])) == 100.0
    assert m.category_score(ask, _provider(categories=["design"])) == 100.0
    assert m.category_score(ask, _provider(categories=["Writing"])) == 0.0
    assert m.category_score(ask, _provider(categories=[])) == 0.0


def test_budget_compatibility():
    ask = _ask(budget_min=Decimal("100"), budget_max=Decimal("500"))
    assert m.budget_score(ask, _offer(price=Decimal("300"))) == 100.0
    assert m.budget_score(ask, _offer(price=Decimal("50"))) == 100.0
    assert m.budget_score(ask, _offer(price=Decimal("1000"))) == 50.0
    assert (
        m.budget_score(_ask(budget_min=None, budget_max=None), _offer()) == 50.0
    )
    assert m.budget_score(ask, _offer(currency="USD")) == 50.0


def test_timeline_compatibility():
    ask = _ask(deadline=DEADLINE)
    assert m.timeline_score(ask, _offer(delivery_days=5, created_at=TODAY)) == 100.0
    # 14 of 28 requested days are available → half credit.
    assert m.timeline_score(ask, _offer(delivery_days=28, created_at=TODAY)) == 50.0
    assert m.timeline_score(_ask(deadline=None), _offer()) == 50.0
    late = _offer(delivery_days=1, created_at=TODAY + timedelta(days=20))
    assert m.timeline_score(ask, late) == 0.0


def test_unavailable_reputation_data_is_neutral():
    assert m.similar_projects_score(None) == 50.0
    assert m.similar_projects_score(0) == 0.0
    assert m.similar_projects_score(5) == 100.0
    assert m.rating_score(_provider(review_count=0)) == 50.0
    assert m.rating_score(_provider(rating=Decimal("5.0"), review_count=10)) == (
        pytest.approx(100.0)
    )
    assert m.rating_score(_provider(rating=Decimal("4.0"), review_count=10)) == (
        pytest.approx(86.0)
    )


def test_neutral_similar_projects_pulls_no_reason_and_is_documented():
    result = m.score_offer(_ask(), _offer(), _provider())
    assert result.components["similar_projects"] == 50.0
    assert "similar_projects" not in " ".join(result.reasons)


# --------------------------------------------------------------------------
# Reasons
# --------------------------------------------------------------------------


def test_reasons_are_max_three_and_factual():
    result = m.score_offer(
        _ask(),
        _offer(delivery_days=3),
        _provider(
            rating=Decimal("4.8"),
            review_count=12,
            avatar_url="https://cdn.example.com/a.png",
            bio="Designer for ten years.",
            location="Austin, TX",
        ),
    )
    assert 1 <= len(result.reasons) <= m.MAX_REASONS
    assert all(isinstance(reason, str) for reason in result.reasons)
    assert all(len(reason) <= 60 for reason in result.reasons)
    assert len(set(result.reasons)) == len(result.reasons)
    assert set(result.reasons) <= REASONS


def test_neutral_factors_produce_no_reason():
    result = m.score_offer(
        _ask(budget_min=None, budget_max=None, deadline=None),
        _offer(),
        _provider(categories=[]),
    )
    assert result.reasons == []


# --------------------------------------------------------------------------
# Ordering & superlatives
# --------------------------------------------------------------------------


def test_rank_sort_key_prefers_score_then_rating_then_price_then_time():
    early = TODAY
    late = TODAY + timedelta(seconds=5)

    def pair(score: int, rating: str, price: str, when: datetime) -> tuple:
        return _scored(
            score,
            _provider(rating=Decimal(rating)),
            _offer(price=Decimal(price), created_at=when),
        )

    pairs = [
        pair(70, "3.0", "100", early),
        pair(70, "4.0", "200", early),
        pair(70, "4.0", "150", late),
        pair(70, "4.0", "200", late),
        pair(95, "1.0", "500", late),
    ]

    ranked = sorted(pairs, key=m.rank_sort_key)
    assert [float(offer.price) for _, offer in ranked] == [
        500.0,  # higher score beats everything
        150.0,  # equal score → higher rating → lower price
        200.0,  # equal rating and price → earlier response
        200.0,
        100.0,  # lowest rating of the tied group
    ]

    # Deterministic: same input in any order, same output.
    shuffled = [pairs[3], pairs[0], pairs[4], pairs[2], pairs[1]]
    assert [o.id for _, o in sorted(shuffled, key=m.rank_sort_key)] == [
        o.id for _, o in ranked
    ]


def test_strengths_are_awarded_to_unique_holders():
    slow_but_cheap = _with_strength_components(
        70, _offer(price=Decimal("100"), delivery_days=9)
    )
    fast_but_dear = _with_strength_components(
        70, _offer(price=Decimal("200"), delivery_days=3)
    )

    strengths = m.assign_strengths([slow_but_cheap, fast_but_dear])
    assert strengths[slow_but_cheap[1].id] == "Best value"
    assert strengths[fast_but_dear[1].id] == "Fastest delivery"


def test_strength_ties_award_nothing():
    left = _with_strength_components(70, _offer(price=Decimal("150"), delivery_days=5))
    right = _with_strength_components(70, _offer(price=Decimal("150"), delivery_days=5))

    assert m.assign_strengths([left, right]) == {}


def test_no_strengths_for_a_single_response():
    only = _with_strength_components(70, _offer())
    assert m.assign_strengths([only]) == {}
