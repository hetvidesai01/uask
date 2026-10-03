"""Backend Contract Alignment Phase 3 — responder ranking + discovery."""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import AskStatus, OfferStatus
from app.models.ask import Ask
from app.models.notification import Notification
from app.models.offer import Offer
from app.models.user import User

API = "/api/v1"

RANKED_KEYS = {
    "offer",
    "provider",
    "score",
    "label",
    "reasons",
    "rating",
    "similarProjectCount",
    "strength",
}
OFFER_KEYS = {
    "id",
    "askId",
    "providerId",
    "price",
    "currency",
    "deliveryDays",
    "pitch",
    "deliverables",
    "attachments",
    "status",
    "createdAt",
    "updatedAt",
    "deletedAt",
}
USER_PUBLIC_KEYS = {"id", "name", "avatarUrl", "rating", "reviewCount"}
ASK_KEYS = {
    "id",
    "title",
    "description",
    "category",
    "budgetMin",
    "budgetMax",
    "currency",
    "deadline",
    "location",
    "isRemote",
    "status",
    "attachments",
    "requesterId",
    "responseCount",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "requester",
}
LABELS = {"Excellent Match", "Strong Match", "Relevant"}
STRENGTHS = {
    "Best value",
    "Fastest delivery",
    "Highest rated",
    "Strongest portfolio fit",
}


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Matcher"
) -> tuple[dict, str]:
    email = f"{uuid.uuid4().hex[:12]}@example.com"
    resp = client.post(
        f"{API}/auth/signup",
        json={
            "name": name,
            "email": email,
            "password": "password123",
            "roles": roles,
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return {"Authorization": f"Bearer {body['accessToken']}"}, body["user"]["id"]


def _create_ask(client: TestClient, headers: dict, **overrides) -> dict:
    payload = {
        "title": "Need a professional logo design",
        "description": (
            "Looking for a modern logo for my new bakery brand that works "
            "on storefront signage and business cards."
        ),
        "category": "Design",
        "budgetMin": 100,
        "budgetMax": 500,
        "currency": "INR",
        "deadline": (datetime.now(UTC).date() + timedelta(days=14)).isoformat(),
        "location": "Austin, TX",
        "isRemote": True,
    }
    payload.update(overrides)
    resp = client.post(f"{API}/asks", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _offer(
    client: TestClient, headers: dict, ask_id: str, **overrides
) -> dict:
    payload = {
        "price": 300,
        "deliveryDays": 5,
        "pitch": (
            "I can deliver this project quickly with two rounds of "
            "revisions included in the price."
        ),
        "deliverables": ["Source files", "Two revision rounds"],
        "attachments": [],
    }
    payload.update(overrides)
    resp = client.post(
        f"{API}/asks/{ask_id}/offers", json=payload, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _profile(client: TestClient, headers: dict, **fields) -> dict:
    me = client.get(f"{API}/auth/me", headers=headers).json()
    resp = client.patch(
        f"{API}/users/{me['id']}", json=fields, headers=headers
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _set_rating(
    db: Session, user_id: str, rating: str, review_count: int = 0
) -> None:
    user = db.get(User, uuid.UUID(user_id))
    user.rating = Decimal(rating)
    user.review_count = review_count
    db.commit()


def _set_ask_status(db: Session, ask_id: str, status: AskStatus) -> None:
    ask = db.get(Ask, uuid.UUID(ask_id))
    ask.status = status
    db.commit()


def _rank(client: TestClient, headers: dict, ask_id: str) -> list[dict]:
    resp = client.get(
        f"{API}/asks/{ask_id}/ranked-responses", headers=headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list), "contract returns RankedResponse[]"
    return body


# --------------------------------------------------------------------------
# Scope: only actual responders
# --------------------------------------------------------------------------


def test_ranks_only_submitted_offers(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"], name="Ask Owner")
    a_headers, a_id = _signup(client, ["provider"], name="Responder A")
    b_headers, b_id = _signup(client, ["provider"], name="Responder B")
    silent_headers, silent_id = _signup(
        client, ["provider"], name="Silent Provider"
    )
    elsewhere_headers, elsewhere_id = _signup(
        client, ["provider"], name="Elsewhere Provider"
    )

    ask = _create_ask(client, owner_headers)
    other_ask = _create_ask(
        client, owner_headers, title="A second open design request here"
    )
    for headers in (a_headers, b_headers, silent_headers, elsewhere_headers):
        _profile(client, headers, categories=["Design"])

    offer_a = _offer(client, a_headers, ask["id"])
    offer_b = _offer(client, b_headers, ask["id"])
    _offer(client, elsewhere_headers, other_ask["id"])

    items = _rank(client, owner_headers, ask["id"])
    assert {item["offer"]["id"] for item in items} == {
        offer_a["id"],
        offer_b["id"],
    }
    provider_ids = {item["provider"]["id"] for item in items}
    assert provider_ids == {a_id, b_id}
    # A provider who never responded — however well matched — is not ranked.
    assert silent_id not in provider_ids
    assert elsewhere_id not in provider_ids


def test_ranked_response_shape(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    _profile(
        client,
        provider_headers,
        categories=["Design"],
        bio="Independent designer with ten years of studio experience.",
        location="Austin, TX",
        avatarUrl="https://cdn.example.com/avatar.png",
    )
    _offer(client, provider_headers, ask["id"])

    items = _rank(client, owner_headers, ask["id"])
    assert len(items) == 1
    item = items[0]
    assert set(item.keys()) == RANKED_KEYS
    assert set(item["offer"].keys()) == OFFER_KEYS
    assert set(item["provider"].keys()) == USER_PUBLIC_KEYS
    assert isinstance(item["score"], int) and 0 <= item["score"] <= 100
    assert item["label"] in LABELS
    assert isinstance(item["reasons"], list)
    assert len(item["reasons"]) <= 3
    assert all(isinstance(reason, str) for reason in item["reasons"])
    assert isinstance(item["rating"], int | float)
    # No Contracts/Reputation data exists yet — reported as null, not faked.
    assert item["similarProjectCount"] is None
    assert item["strength"] is None or item["strength"] in STRENGTHS


def test_ranked_responses_requires_ask_owner(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"], name="Ask Owner")
    stranger_headers, _ = _signup(client, ["seeker"], name="Stranger")
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    _offer(client, provider_headers, ask["id"])

    resp = client.get(
        f"{API}/asks/{ask['id']}/ranked-responses", headers=stranger_headers
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_ASK_OWNER"

    resp = client.get(
        f"{API}/asks/{uuid.uuid4()}/ranked-responses", headers=owner_headers
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "ASK_NOT_FOUND"

    resp = client.get(f"{API}/asks/{ask['id']}/ranked-responses")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


# --------------------------------------------------------------------------
# Scores, labels, ordering
# --------------------------------------------------------------------------


def test_scores_sorted_descending_and_stable(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    good_headers, _ = _signup(client, ["provider"], name="Good Fit")
    mid_headers, _ = _signup(client, ["provider"], name="Mid Fit")
    poor_headers, _ = _signup(client, ["provider"], name="Poor Fit")
    ask = _create_ask(client, owner_headers)

    _profile(client, good_headers, categories=["Design"])
    _profile(
        client,
        mid_headers,
        categories=["Design"],
        bio="Occasional design work.",
    )
    _profile(client, poor_headers, categories=["Errands"])

    _offer(client, good_headers, ask["id"], price=250, deliveryDays=5)
    _offer(client, mid_headers, ask["id"], price=450, deliveryDays=9)
    _offer(client, poor_headers, ask["id"], price=490, deliveryDays=12)

    items = _rank(client, owner_headers, ask["id"])
    scores = [item["score"] for item in items]
    assert scores == sorted(scores, reverse=True)
    assert len(items) == 3

    again = _rank(client, owner_headers, ask["id"])
    assert [item["offer"]["id"] for item in again] == [
        item["offer"]["id"] for item in items
    ]


def test_tie_break_is_deterministic(client: TestClient, db: Session):
    """Equal scores → higher rating → lower price → earlier response."""
    owner_headers, _ = _signup(client, ["seeker"])
    first_headers, first_id = _signup(client, ["provider"], name="First")
    dear_headers, dear_id = _signup(client, ["provider"], name="Dear")
    cheap_headers, cheap_id = _signup(client, ["provider"], name="Cheap")
    low_headers, low_id = _signup(client, ["provider"], name="Low Rating")
    ask = _create_ask(client, owner_headers)

    # Identical components for everyone: same category match, same profile
    # completeness, no reviews (rating component stays neutral), prices all
    # inside budget, same delivery fit.
    for headers in (first_headers, dear_headers, cheap_headers, low_headers):
        _profile(client, headers, categories=["Design"])

    _offer(client, first_headers, ask["id"], price=100)
    _offer(client, dear_headers, ask["id"], price=200)
    _offer(client, cheap_headers, ask["id"], price=150)
    _offer(client, low_headers, ask["id"], price=200)

    _set_rating(db, cheap_id, "4.0")
    _set_rating(db, dear_id, "4.0")
    _set_rating(db, first_id, "4.0")
    _set_rating(db, low_id, "3.0")

    items = _rank(client, owner_headers, ask["id"])
    assert [item["provider"]["id"] for item in items] == [
        first_id,  # rating 4.0, lowest price (100)
        cheap_id,  # rating 4.0, price 150
        dear_id,  # rating 4.0, price 200
        low_id,  # rating 3.0 → lower score group
    ]


def test_labels_at_api_thresholds(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    ideal_headers, ideal_id = _signup(client, ["provider"], name="Ideal")
    partial_headers, _ = _signup(client, ["provider"], name="Partial")
    weak_headers, _ = _signup(client, ["provider"], name="Weak")
    competitor_headers, _ = _signup(client, ["provider"], name="Competitor")

    ideal_ask = _create_ask(client, owner_headers)
    partial_ask = _create_ask(
        client, owner_headers, title="A second design request for scoring"
    )
    weak_ask = _create_ask(
        client,
        owner_headers,
        title="A third design request for scoring",
        budgetMin=None,
        budgetMax=None,
    )

    _profile(
        client,
        ideal_headers,
        categories=["Design"],
        bio="Ten years of brand identity work for local businesses.",
        location="Austin, TX",
        avatarUrl="https://cdn.example.com/ideal.png",
    )
    _profile(client, partial_headers, categories=["Design"])
    _profile(client, weak_headers, categories=["Errands"])
    _profile(client, competitor_headers, categories=["Design"])

    _offer(client, ideal_headers, ideal_ask["id"], price=300, deliveryDays=3)
    # A second response is required before any superlative can be awarded.
    _offer(client, competitor_headers, ideal_ask["id"], price=450, deliveryDays=9)
    _offer(client, partial_headers, partial_ask["id"], price=300, deliveryDays=3)
    _offer(client, weak_headers, weak_ask["id"], price=300, deliveryDays=60)

    ideal_items = _rank(client, owner_headers, ideal_ask["id"])
    ideal = next(
        item for item in ideal_items if item["provider"]["id"] == ideal_id
    )
    assert ideal["score"] >= 80
    assert ideal["label"] == "Excellent Match"
    assert ideal["strength"] is not None

    partial = _rank(client, owner_headers, partial_ask["id"])[0]
    assert 55 <= partial["score"] < 80
    assert partial["label"] == "Strong Match"

    weak = _rank(client, owner_headers, weak_ask["id"])[0]
    assert 0 <= weak["score"] < 55
    assert weak["label"] == "Relevant"


def test_budget_compatibility_ranks_higher(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    inside_headers, _ = _signup(client, ["provider"], name="Inside Budget")
    over_headers, _ = _signup(client, ["provider"], name="Over Budget")
    ask = _create_ask(client, owner_headers)  # budget 100–500

    _profile(client, inside_headers, categories=["Design"])
    _profile(client, over_headers, categories=["Design"])
    _offer(client, inside_headers, ask["id"], price=300)
    _offer(client, over_headers, ask["id"], price=5000)

    items = _rank(client, owner_headers, ask["id"])
    assert [item["provider"]["name"] for item in items] == [
        "Inside Budget",
        "Over Budget",
    ]
    assert items[0]["score"] > items[1]["score"]


def test_timeline_compatibility_ranks_higher(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    fast_headers, _ = _signup(client, ["provider"], name="Fits Deadline")
    slow_headers, _ = _signup(client, ["provider"], name="Misses Deadline")
    ask = _create_ask(client, owner_headers)  # deadline ~14 days out

    _profile(client, fast_headers, categories=["Design"])
    _profile(client, slow_headers, categories=["Design"])
    _offer(client, fast_headers, ask["id"], price=300, deliveryDays=3)
    _offer(client, slow_headers, ask["id"], price=300, deliveryDays=60)

    items = _rank(client, owner_headers, ask["id"])
    assert [item["provider"]["name"] for item in items] == [
        "Fits Deadline",
        "Misses Deadline",
    ]
    assert items[0]["score"] > items[1]["score"]


def test_category_relevance_ranks_higher(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    matched_headers, _ = _signup(client, ["provider"], name="Design Match")
    other_headers, _ = _signup(client, ["provider"], name="Other Skill")
    ask = _create_ask(client, owner_headers, category="Design")

    _profile(client, matched_headers, categories=["Design"])
    _profile(client, other_headers, categories=["Errands"])
    _offer(client, matched_headers, ask["id"], price=300)
    _offer(client, other_headers, ask["id"], price=300)

    items = _rank(client, owner_headers, ask["id"])
    assert [item["provider"]["name"] for item in items] == [
        "Design Match",
        "Other Skill",
    ]
    assert items[0]["score"] - items[1]["score"] >= 25


def test_no_automatic_winner_selection(
    client: TestClient, db: Session
):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    other_headers, _ = _signup(client, ["provider"], name="Second Responder")
    ask = _create_ask(client, owner_headers)
    _profile(client, provider_headers, categories=["Design"])
    _profile(client, other_headers, categories=["Design"])
    offer = _offer(client, provider_headers, ask["id"])
    other_offer = _offer(client, other_headers, ask["id"])

    notifications_before = db.scalar(
        select(func.count()).select_from(Notification)
    )
    items = _rank(client, owner_headers, ask["id"])
    assert len(items) == 2

    # Ranking changes nothing: no winner, no status writes, no notifications.
    assert db.scalar(select(func.count()).select_from(Notification)) == (
        notifications_before
    )
    statuses = {
        row.id: row.status
        for row in db.scalars(select(Offer)).all()
    }
    assert statuses[uuid.UUID(offer["id"])] == OfferStatus.pending
    assert statuses[uuid.UUID(other_offer["id"])] == OfferStatus.pending
    assert db.get(Ask, uuid.UUID(ask["id"])).status == AskStatus.open
    assert client.get(f"{API}/threads", headers=owner_headers).json()[
        "total"
    ] == 0


# --------------------------------------------------------------------------
# GET /me/recommended-asks — discovery only
# --------------------------------------------------------------------------


def _setup_provider(client: TestClient) -> tuple[dict, str]:
    headers, user_id = _signup(
        client, ["seeker", "provider"], name="Discovery Provider"
    )
    _profile(client, headers, categories=["Design", "Photography"])
    return headers, user_id


def test_recommended_asks_filters_and_limits(
    client: TestClient, db: Session
):
    provider_headers, _ = _setup_provider(client)
    seeker_headers, _ = _signup(client, ["seeker"], name="Poster")
    other_headers, _ = _signup(client, ["seeker"], name="Other Poster")

    own = _create_ask(client, provider_headers)  # own ASK → excluded
    answered = _create_ask(client, seeker_headers, title="Answered design ask")
    _offer(client, provider_headers, answered["id"])

    closed = _create_ask(client, seeker_headers, title="Closed design ask")
    _set_ask_status(db, closed["id"], AskStatus.closed)

    wrong_category = _create_ask(
        client, seeker_headers, title="Writing help needed here", category="Writing"
    )
    match_one = _create_ask(client, seeker_headers, title="Open design ask one")
    match_two = _create_ask(
        client, other_headers, title="Open photography request"
    )

    resp = client.get(f"{API}/me/recommended-asks", headers=provider_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list), "contract returns Ask[]"
    ids = {item["id"] for item in body}
    assert ids == {match_one["id"], match_two["id"]}
    assert own["id"] not in ids
    assert answered["id"] not in ids
    assert closed["id"] not in ids
    assert wrong_category["id"] not in ids
    assert all(item["status"] == "open" for item in body)
    assert all(set(item.keys()) == ASK_KEYS for item in body)

    resp = client.get(
        f"{API}/me/recommended-asks", params={"limit": 1}, headers=provider_headers
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_recommended_asks_requires_provider_role(client: TestClient):
    seeker_headers, _ = _signup(client, ["seeker"])
    resp = client.get(f"{API}/me/recommended-asks", headers=seeker_headers)
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"


def test_recommended_asks_requires_auth(client: TestClient):
    resp = client.get(f"{API}/me/recommended-asks")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_recommended_asks_empty_without_categories(client: TestClient):
    headers, _ = _signup(client, ["provider"], name="No Categories")
    _create_ask(client, _signup(client, ["seeker"])[0])
    resp = client.get(f"{API}/me/recommended-asks", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []
