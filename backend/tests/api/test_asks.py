"""Phase 6 ASK tests — create, list, filters, sort, pagination, ownership."""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.enums import AskStatus
from app.models.ask import Ask
from app.models.offer import Offer

API = "/api/v1"

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
ENVELOPE_KEYS = {"items", "page", "pageSize", "total", "totalPages", "hasNext"}


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Ask Tester"
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


def _ask_payload(**overrides) -> dict:
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
    return payload


def _create_ask(client: TestClient, headers: dict, **overrides) -> dict:
    resp = client.post(
        f"{API}/asks", json=_ask_payload(**overrides), headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _set_created_at(db: Session, ask_id: str, when: datetime) -> None:
    db.execute(
        text("UPDATE asks SET created_at = :t WHERE id = :id"),
        {"t": when, "id": ask_id},
    )
    db.commit()


def _set_status(db: Session, ask_id: str, status: AskStatus) -> None:
    ask = db.get(Ask, uuid.UUID(str(ask_id)))
    assert ask is not None
    ask.status = status
    db.commit()


# --------------------------------------------------------------------------
# POST /asks
# --------------------------------------------------------------------------


def test_create_ask(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    body = dict(
        title="Need help moving furniture this weekend",
        description=(
            "I need two people to help move furniture from my apartment "
            "to a storage unit across town on Saturday morning."
        ),
        category="design",
        budgetMin=150,
        budgetMax=400,
        currency="inr",
        deadline=(datetime.now(UTC).date() + timedelta(days=7)).isoformat(),
        location="Austin, TX",
        isRemote=False,
    )
    resp = client.post(f"{API}/asks", json=body, headers=headers)
    assert resp.status_code == 201, resp.text
    ask = resp.json()
    assert set(ask.keys()) >= ASK_KEYS
    assert ask["title"] == body["title"]
    assert ask["category"] == "Design"
    assert ask["currency"] == "INR"
    assert ask["requesterId"] == user_id
    assert ask["status"] == "open"
    assert ask["responseCount"] == 0
    assert ask["deletedAt"] is None
    assert isinstance(ask["budgetMin"], int | float)
    assert not isinstance(ask["budgetMin"], str)
    assert isinstance(ask["requester"], dict)
    assert ask["requester"]["id"] == user_id
    assert "passwordHash" not in ask["requester"]


def test_create_ask_ignores_client_supplied_ids(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    _, other_id = _signup(client, ["seeker"])
    body = _ask_payload(
        id=str(uuid.uuid4()),
        requesterId=other_id,
        status="closed",
        responseCount=99,
        createdAt="2020-01-01T00:00:00Z",
    )
    resp = client.post(f"{API}/asks", json=body, headers=headers)
    assert resp.status_code == 201, resp.text
    ask = resp.json()
    assert ask["requesterId"] == user_id
    assert ask["status"] == "open"
    assert ask["responseCount"] == 0
    assert ask["createdAt"] >= "2025-01-01"


def test_create_ask_requires_seeker_role(client: TestClient):
    headers, _ = _signup(client, ["provider"])
    resp = client.post(f"{API}/asks", json=_ask_payload(), headers=headers)
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"


def test_create_ask_requires_auth(client: TestClient):
    resp = client.post(f"{API}/asks", json=_ask_payload())
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_create_ask_validation_errors(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    bad_payloads = [
        {"title": "short"},
        {"description": "too short"},
        {"category": "Hacking"},
        {"budgetMin": 500, "budgetMax": 100},
        {"budgetMin": 100, "budgetMax": None},
        {"budgetMin": -1, "budgetMax": 10},
        {"deadline": (datetime.now(UTC).date() - timedelta(days=1)).isoformat()},
        {"currency": "DOLLARS"},
        {"budgetMin": 100, "budgetMax": 50},
    ]
    for overrides in bad_payloads:
        resp = client.post(
            f"{API}/asks", json=_ask_payload(**overrides), headers=headers
        )
        assert resp.status_code == 422, (overrides, resp.text)
        assert _error_code(resp) == "VALIDATION_ERROR"


# --------------------------------------------------------------------------
# GET /asks — envelope, filters, sort, pagination
# --------------------------------------------------------------------------


def test_list_asks_envelope(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    _create_ask(client, headers)
    resp = client.get(f"{API}/asks", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == ENVELOPE_KEYS
    assert body["total"] == 1
    assert body["page"] == 1
    assert body["pageSize"] == 20
    assert body["totalPages"] == 1
    assert body["hasNext"] is False
    assert set(body["items"][0].keys()) >= ASK_KEYS


def test_list_asks_requires_auth(client: TestClient):
    resp = client.get(f"{API}/asks")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_list_asks_default_empty(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.get(f"{API}/asks", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_fetch_ask_detail(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    created = _create_ask(client, headers)
    resp = client.get(f"{API}/asks/{created['id']}", headers=headers)
    assert resp.status_code == 200
    ask = resp.json()
    assert set(ask.keys()) >= ASK_KEYS
    assert ask["id"] == created["id"]
    assert ask["requester"]["id"] == user_id
    assert ask["responseCount"] == 0


def test_ask_detail_not_found(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.get(f"{API}/asks/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404
    assert _error_code(resp) == "ASK_NOT_FOUND"
    assert "requestId" in resp.json()["error"]


def test_ask_detail_requires_auth(client: TestClient):
    resp = client.get(f"{API}/asks/{uuid.uuid4()}")
    assert resp.status_code == 401


def test_filter_category(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    _create_ask(client, headers, category="Design")
    _create_ask(
        client,
        headers,
        title="Write five blog posts about sourdough",
        category="Writing",
    )
    resp = client.get(f"{API}/asks", params={"category": "design"}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["category"] == "Design"


def test_filter_min_budget(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    _create_ask(client, headers, budgetMin=100, budgetMax=200)
    _create_ask(client, headers, budgetMin=500, budgetMax=1000)
    resp = client.get(
        f"{API}/asks", params={"minBudget": 600}, headers=headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["budgetMin"] == 500


def test_filter_max_budget(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    _create_ask(client, headers, budgetMin=100, budgetMax=200)
    _create_ask(client, headers, budgetMin=500, budgetMax=1000)
    resp = client.get(
        f"{API}/asks", params={"maxBudget": 400}, headers=headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["budgetMin"] == 100


def test_filter_location(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    _create_ask(client, headers, location="Austin, TX")
    _create_ask(client, headers, location="Chicago, IL")
    resp = client.get(f"{API}/asks", params={"location": "austin"}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["location"] == "Austin, TX"


def test_filter_is_remote(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    _create_ask(client, headers, isRemote=True)
    _create_ask(client, headers, isRemote=False)
    resp = client.get(f"{API}/asks", params={"isRemote": "true"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["isRemote"] is True
    resp = client.get(f"{API}/asks", params={"isRemote": "false"}, headers=headers)
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["isRemote"] is False


def test_filter_status(client: TestClient, db: Session):
    headers, _ = _signup(client, ["seeker"])
    closed = _create_ask(client, headers)
    _create_ask(client, headers)
    _set_status(db, closed["id"], AskStatus.closed)

    resp = client.get(f"{API}/asks", params={"status": "closed"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["status"] == "closed"

    resp = client.get(f"{API}/asks", params={"status": "open"}, headers=headers)
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["status"] == "open"

    resp = client.get(f"{API}/asks", headers=headers)
    assert resp.json()["total"] == 2


def test_filter_requester_id(client: TestClient):
    headers_a, user_a = _signup(client, ["seeker"])
    headers_b, _ = _signup(client, ["seeker"])
    _create_ask(client, headers_a, location="Austin, TX")
    _create_ask(client, headers_b, location="Chicago, IL")
    resp = client.get(
        f"{API}/asks", params={"requesterId": user_a}, headers=headers_a
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["requesterId"] == user_a


def test_filter_q_matches_title_and_description(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    _create_ask(client, headers)
    _create_ask(
        client,
        headers,
        title="Photograph a birthday party downtown",
        description=(
            "Need a photographer for a child's birthday party next month, "
            "about three hours of coverage with edited digital files."
        ),
    )
    resp = client.get(f"{API}/asks", params={"q": "birthday"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert "birthday" in resp.json()["items"][0]["title"].lower()


def test_list_min_max_budget_order_invalid(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.get(
        f"{API}/asks",
        params={"minBudget": 500, "maxBudget": 100},
        headers=headers,
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_sort_newest_and_oldest(client: TestClient, db: Session):
    headers, _ = _signup(client, ["seeker"])
    a = _create_ask(client, headers)
    b = _create_ask(client, headers, budgetMin=300, budgetMax=400)
    c = _create_ask(client, headers, budgetMin=500, budgetMax=600)
    base = datetime(2026, 1, 1, tzinfo=UTC)
    _set_created_at(db, a["id"], base)
    _set_created_at(db, b["id"], base + timedelta(days=1))
    _set_created_at(db, c["id"], base + timedelta(days=2))

    resp = client.get(
        f"{API}/asks", params={"sort": "newest"}, headers=headers
    )
    assert resp.status_code == 200
    ids = [i["id"] for i in resp.json()["items"]]
    assert ids == [c["id"], b["id"], a["id"]]

    resp = client.get(
        f"{API}/asks", params={"sort": "oldest"}, headers=headers
    )
    ids = [i["id"] for i in resp.json()["items"]]
    assert ids == [a["id"], b["id"], c["id"]]


def test_sort_budget_low_and_high(client: TestClient, db: Session):
    headers, _ = _signup(client, ["seeker"])
    a = _create_ask(client, headers, budgetMin=100, budgetMax=200)
    b = _create_ask(client, headers, budgetMin=300, budgetMax=400)
    c = _create_ask(client, headers, budgetMin=500, budgetMax=600)
    base = datetime(2026, 1, 1, tzinfo=UTC)
    _set_created_at(db, a["id"], base)
    _set_created_at(db, b["id"], base + timedelta(days=1))
    _set_created_at(db, c["id"], base + timedelta(days=2))

    resp = client.get(
        f"{API}/asks", params={"sort": "budget_low"}, headers=headers
    )
    ids = [i["id"] for i in resp.json()["items"]]
    assert ids == [a["id"], b["id"], c["id"]]

    resp = client.get(
        f"{API}/asks", params={"sort": "budget_high"}, headers=headers
    )
    ids = [i["id"] for i in resp.json()["items"]]
    assert ids == [c["id"], b["id"], a["id"]]


def test_sort_deadline(client: TestClient, db: Session):
    headers, _ = _signup(client, ["seeker"])
    today = datetime.now(UTC).date()
    a = _create_ask(client, headers, deadline=(today + timedelta(days=21)).isoformat())
    b = _create_ask(client, headers, deadline=(today + timedelta(days=7)).isoformat())
    c = _create_ask(client, headers, deadline=(today + timedelta(days=14)).isoformat())
    base = datetime(2026, 1, 1, tzinfo=UTC)
    _set_created_at(db, a["id"], base)
    _set_created_at(db, b["id"], base + timedelta(days=1))
    _set_created_at(db, c["id"], base + timedelta(days=2))

    resp = client.get(
        f"{API}/asks", params={"sort": "deadline"}, headers=headers
    )
    assert resp.status_code == 200
    ids = [i["id"] for i in resp.json()["items"]]
    assert ids == [b["id"], c["id"], a["id"]]
    deadlines = [i["deadline"] for i in resp.json()["items"]]
    assert deadlines == sorted(deadlines)


def test_sort_allowed_values(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    _create_ask(client, headers)
    for sort_value in ("newest", "oldest", "budget_low", "budget_high", "deadline"):
        resp = client.get(f"{API}/asks", params={"sort": sort_value}, headers=headers)
        assert resp.status_code == 200, sort_value
        assert resp.json()["total"] == 1


def test_sort_invalid_values_rejected(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    _create_ask(client, headers)
    for sort_value in ("password_hash", "created_at", ""):
        resp = client.get(f"{API}/asks", params={"sort": sort_value}, headers=headers)
        assert resp.status_code == 422, sort_value
        assert _error_code(resp) == "VALIDATION_ERROR"


def test_pagination(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    created = [
        _create_ask(client, headers, budgetMin=100 * (i + 1), budgetMax=900)
        for i in range(3)
    ]

    resp = client.get(
        f"{API}/asks",
        params={"pageSize": 2, "page": 1, "sort": "budget_low"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == ENVELOPE_KEYS
    assert body["total"] == 3
    assert body["totalPages"] == 2
    assert body["hasNext"] is True
    assert len(body["items"]) == 2
    assert body["items"][0]["id"] == created[0]["id"]

    resp = client.get(
        f"{API}/asks",
        params={"pageSize": 2, "page": 2, "sort": "budget_low"},
        headers=headers,
    )
    body = resp.json()
    assert body["page"] == 2
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == created[2]["id"]
    assert body["hasNext"] is False

    resp = client.get(
        f"{API}/asks", params={"pageSize": 2, "page": 5}, headers=headers
    )
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 3
    assert body["hasNext"] is False


def test_pagination_invalid_params(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    for params in ({"page": 0}, {"pageSize": 0}, {"pageSize": 101}):
        resp = client.get(f"{API}/asks", params=params, headers=headers)
        assert resp.status_code == 422, params
        assert _error_code(resp) == "VALIDATION_ERROR"


# --------------------------------------------------------------------------
# PATCH /asks/{id}
# --------------------------------------------------------------------------


def test_owner_updates_ask(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    created = _create_ask(client, headers)
    resp = client.patch(
        f"{API}/asks/{created['id']}",
        json={
            "title": "Updated title that is definitely long enough",
            "budgetMin": 200,
            "budgetMax": 800,
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    ask = resp.json()
    assert ask["title"] == "Updated title that is definitely long enough"
    assert ask["budgetMin"] == 200
    assert ask["budgetMax"] == 800
    assert ask["description"] == created["description"]
    assert set(ask.keys()) >= ASK_KEYS


def test_owner_clears_location_and_budget(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    created = _create_ask(client, headers)
    resp = client.patch(
        f"{API}/asks/{created['id']}",
        json={"location": None, "budgetMin": None, "budgetMax": None},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    ask = resp.json()
    assert ask["location"] is None
    assert ask["budgetMin"] is None
    assert ask["budgetMax"] is None


def test_empty_patch_returns_unchanged(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    created = _create_ask(client, headers)
    resp = client.patch(
        f"{API}/asks/{created['id']}", json={}, headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == created["title"]


def test_non_owner_cannot_update(client: TestClient):
    headers_owner, _ = _signup(client, ["seeker"])
    headers_other, _ = _signup(client, ["seeker"])
    created = _create_ask(client, headers_owner)
    resp = client.patch(
        f"{API}/asks/{created['id']}",
        json={"title": "Someone else changed this title"},
        headers=headers_other,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_ASK_OWNER"


def test_closed_ask_cannot_be_updated(
    client: TestClient, db: Session
):
    headers, _ = _signup(client, ["seeker"])
    created = _create_ask(client, headers)
    _set_status(db, created["id"], AskStatus.closed)
    resp = client.patch(
        f"{API}/asks/{created['id']}",
        json={"title": "Trying to edit after it closed"},
        headers=headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "ASK_NOT_EDITABLE"


def test_update_ask_not_found(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/asks/{uuid.uuid4()}",
        json={"title": "A perfectly valid updated title"},
        headers=headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "ASK_NOT_FOUND"


def test_update_ask_requires_auth(client: TestClient):
    resp = client.patch(
        f"{API}/asks/{uuid.uuid4()}", json={"title": "Unauthenticated edit attempt"}
    )
    assert resp.status_code == 401


def test_update_explicit_null_title_rejected(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    created = _create_ask(client, headers)
    resp = client.patch(
        f"{API}/asks/{created['id']}", json={"title": None}, headers=headers
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


# --------------------------------------------------------------------------
# DELETE /asks/{id}
# --------------------------------------------------------------------------


def test_owner_deletes_ask_soft(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    created = _create_ask(client, headers)

    resp = client.delete(f"{API}/asks/{created['id']}", headers=headers)
    assert resp.status_code == 204
    assert resp.content == b""

    resp = client.get(f"{API}/asks/{created['id']}", headers=headers)
    assert resp.status_code == 404
    assert _error_code(resp) == "ASK_NOT_FOUND"

    resp = client.get(f"{API}/asks", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0
    assert resp.json()["items"] == []

    resp = client.patch(
        f"{API}/asks/{created['id']}",
        json={"title": "Editing a deleted ask should fail"},
        headers=headers,
    )
    assert resp.status_code == 404


def test_non_owner_cannot_delete(client: TestClient):
    headers_owner, _ = _signup(client, ["seeker"])
    headers_other, _ = _signup(client, ["seeker"])
    created = _create_ask(client, headers_owner)

    resp = client.delete(f"{API}/asks/{created['id']}", headers=headers_other)
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_ASK_OWNER"

    resp = client.get(f"{API}/asks/{created['id']}", headers=headers_other)
    assert resp.status_code == 200


def test_delete_ask_requires_auth(client: TestClient):
    resp = client.delete(f"{API}/asks/{uuid.uuid4()}")
    assert resp.status_code == 401


def test_delete_ask_not_found(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.delete(f"{API}/asks/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404
    assert _error_code(resp) == "ASK_NOT_FOUND"


# --------------------------------------------------------------------------
# responseCount
# --------------------------------------------------------------------------


def test_response_count_counts_only_live_offers(
    client: TestClient, db: Session
):
    headers, _ = _signup(client, ["seeker"])
    created = _create_ask(client, headers)
    headers_p1, pid1 = _signup(client, ["provider"])
    headers_p2, pid2 = _signup(client, ["provider"])
    assert headers_p1 and headers_p2

    ask_uuid = uuid.UUID(created["id"])
    live_1 = Offer(
        ask_id=ask_uuid,
        provider_id=uuid.UUID(pid1),
        price=Decimal("250.00"),
        delivery_days=7,
        pitch="I can design your logo quickly with two revision rounds.",
    )
    dead_1 = Offer(
        ask_id=ask_uuid,
        provider_id=uuid.UUID(pid1),
        price=Decimal("300.00"),
        delivery_days=5,
        pitch="This earlier offer was withdrawn and soft-deleted later on.",
        deleted_at=datetime.now(UTC),
    )
    live_2 = Offer(
        ask_id=ask_uuid,
        provider_id=uuid.UUID(pid2),
        price=Decimal("275.00"),
        delivery_days=10,
        pitch="Experienced branding designer, portfolio attached on request.",
    )
    db.add_all([live_1, dead_1, live_2])
    db.commit()

    resp = client.get(f"{API}/asks/{created['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["responseCount"] == 2

    resp = client.get(f"{API}/asks", headers=headers)
    assert resp.json()["items"][0]["responseCount"] == 2
    assert resp.json()["items"][0]["id"] == created["id"]


def test_response_count_zero_when_no_offers(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    created = _create_ask(client, headers)
    resp = client.get(f"{API}/asks/{created['id']}", headers=headers)
    assert resp.json()["responseCount"] == 0


def test_deadline_sort_independent_of_created_at(client: TestClient, db: Session):
    headers, _ = _signup(client, ["seeker"])
    today = date.today()
    a = _create_ask(client, headers, deadline=(today + timedelta(days=10)).isoformat())
    b = _create_ask(client, headers, deadline=(today + timedelta(days=3)).isoformat())
    # Backdate b — sort must still follow deadline, not recency.
    _set_created_at(db, b["id"], datetime(2020, 1, 1, tzinfo=UTC))
    resp = client.get(
        f"{API}/asks", params={"sort": "deadline"}, headers=headers
    )
    ids = [i["id"] for i in resp.json()["items"]]
    assert ids == [b["id"], a["id"]]
