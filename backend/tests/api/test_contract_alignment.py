"""Backend Contract Alignment Phase 1 — frozen frontend contract checks.

Covers the compatibility decisions only: ASK acceptance lifecycle,
canonical notification names, camelCase shapes, pagination envelope,
and the INR/USD/EUR currency set. Feature work (connections, matching,
contracts, search, payments) is deliberately out of scope here.
"""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.enums import AskStatus, NotificationType
from app.models.ask import Ask

API = "/api/v1"

ENVELOPE_KEYS = {"items", "page", "pageSize", "total", "totalPages", "hasNext"}
NOTIFICATION_KEYS = {
    "id",
    "userId",
    "type",
    "title",
    "body",
    "link",
    "read",
    "createdAt",
}
THREAD_KEYS = {
    "id",
    "askId",
    "ask",
    "offerId",
    "participantIds",
    "participants",
    "lastMessage",
    "unreadCount",
    "createdAt",
    "updatedAt",
}
LAST_MESSAGE_KEYS = {"id", "body", "senderId", "createdAt"}
CANONICAL_NOTIFICATION_TYPES = {
    "offer_received",
    "offer_shortlisted",
    "offer_accepted",
    "offer_rejected",
    "ask_matched",
    "message",
}


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Contract Tester"
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


def _offer_payload(**overrides) -> dict:
    payload = {
        "price": 450,
        "deliveryDays": 5,
        "pitch": (
            "I can deliver this project quickly with two rounds of "
            "revisions included in the price."
        ),
        "deliverables": ["Source files", "Two revision rounds"],
        "attachments": [],
    }
    payload.update(overrides)
    return payload


def _create_offer(
    client: TestClient, headers: dict, ask_id: str, **overrides
) -> dict:
    resp = client.post(
        f"{API}/asks/{ask_id}/offers",
        json=_offer_payload(**overrides),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _set_status(db: Session, ask_id: str, status: AskStatus) -> None:
    ask = db.get(Ask, uuid.UUID(str(ask_id)))
    assert ask is not None
    ask.status = status
    db.commit()


def _accept(client: TestClient, owner_headers: dict, offer_id: str) -> None:
    resp = client.patch(
        f"{API}/offers/{offer_id}",
        json={"status": "accepted"},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text


def _inbox(client: TestClient, headers: dict, *, query: str = "") -> dict:
    resp = client.get(f"{API}/notifications{query}", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


# --------------------------------------------------------------------------
# ASK lifecycle
# --------------------------------------------------------------------------


def test_ask_status_values_match_frontend_states():
    assert {status.value for status in AskStatus} == {
        "open",
        "matched",
        "in_review",
        "accepted",
        "closed",
        "cancelled",
    }


def test_accept_moves_ask_to_accepted_not_closed(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"], name="Ask Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Winner")
    other_headers, _ = _signup(client, ["provider"], name="Loser")
    ask = _create_ask(client, owner_headers)
    assert ask["status"] == "open"

    winner = _create_offer(client, provider_headers, ask["id"])
    loser = _create_offer(client, other_headers, ask["id"], price=380)
    _accept(client, owner_headers, winner["id"])

    resp = client.get(f"{API}/asks/{ask['id']}", headers=owner_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"

    resp = client.get(f"{API}/asks/{ask['id']}/offers", headers=owner_headers)
    statuses = {item["id"]: item["status"] for item in resp.json()["items"]}
    assert statuses == {
        winner["id"]: "accepted",
        loser["id"]: "rejected",
    }

    resp = client.get(
        f"{API}/asks", params={"status": "accepted"}, headers=owner_headers
    )
    assert resp.status_code == 200
    assert [item["id"] for item in resp.json()["items"]] == [ask["id"]]


def test_accepted_ask_rejects_new_offers(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"], name="Ask Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Winner")
    late_headers, _ = _signup(client, ["provider"], name="Late Responder")
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    _accept(client, owner_headers, offer["id"])

    resp = client.post(
        f"{API}/asks/{ask['id']}/offers",
        json=_offer_payload(price=120, deliveryDays=3),
        headers=late_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "ASK_NOT_OPEN"


def test_accepted_ask_cannot_be_updated(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"], name="Ask Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Winner")
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    _accept(client, owner_headers, offer["id"])

    resp = client.patch(
        f"{API}/asks/{ask['id']}",
        json={"title": "Trying to edit after a provider was chosen"},
        headers=owner_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "ASK_NOT_EDITABLE"


def test_open_ask_still_accepts_offers(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"], name="Ask Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Responder")
    ask = _create_ask(client, owner_headers)

    offer = _create_offer(client, provider_headers, ask["id"])
    assert offer["status"] == "pending"

    resp = client.get(f"{API}/asks/{ask['id']}", headers=owner_headers)
    assert resp.json()["status"] == "open"


def test_closed_ask_rejects_new_offers(client: TestClient, db: Session):
    owner_headers, _ = _signup(client, ["seeker"], name="Ask Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Responder")
    ask = _create_ask(client, owner_headers, title="Closed job for testing")
    _set_status(db, ask["id"], AskStatus.closed)

    resp = client.post(
        f"{API}/asks/{ask['id']}/offers",
        json=_offer_payload(price=150, deliveryDays=4),
        headers=provider_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "ASK_NOT_OPEN"


def test_cancelled_ask_is_preserved_and_filterable(
    client: TestClient, db: Session
):
    owner_headers, _ = _signup(client, ["seeker"], name="Ask Owner")
    ask = _create_ask(
        client, owner_headers, title="Cancelled job for testing"
    )
    _set_status(db, ask["id"], AskStatus.cancelled)

    resp = client.get(
        f"{API}/asks", params={"status": "cancelled"}, headers=owner_headers
    )
    assert resp.status_code == 200
    assert [item["id"] for item in resp.json()["items"]] == [ask["id"]]


# --------------------------------------------------------------------------
# Notification names
# --------------------------------------------------------------------------


def test_offer_notifications_use_canonical_types(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"], name="Offer Owner")
    provider_a, _ = _signup(client, ["provider"], name="Alpha Provider")
    provider_b, _ = _signup(client, ["provider"], name="Beta Provider")
    ask = _create_ask(client, owner_headers)

    offer_a = _create_offer(client, provider_a, ask["id"])
    assert _inbox(client, owner_headers)["items"][0]["type"] == "offer_received"

    resp = client.patch(
        f"{API}/offers/{offer_a['id']}",
        json={"status": "shortlisted"},
        headers=owner_headers,
    )
    assert resp.status_code == 200
    assert _inbox(client, provider_a)["items"][0]["type"] == "offer_shortlisted"

    _create_offer(client, provider_b, ask["id"], price=380)
    _accept(client, owner_headers, offer_a["id"])
    assert _inbox(client, provider_a)["items"][0]["type"] == "offer_accepted"
    assert _inbox(client, provider_b)["items"][0]["type"] == "offer_rejected"

    ask_two = _create_ask(client, owner_headers, title="Second contract ask")
    offer_c = _create_offer(client, provider_b, ask_two["id"])
    resp = client.patch(
        f"{API}/offers/{offer_c['id']}",
        json={"status": "rejected"},
        headers=owner_headers,
    )
    assert resp.status_code == 200
    assert _inbox(client, provider_b)["items"][0]["type"] == "offer_rejected"


def test_message_notification_uses_message_type(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"], name="Thread Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Thread Provider")
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    _accept(client, owner_headers, offer["id"])

    threads = client.get(f"{API}/threads", headers=owner_headers).json()
    assert threads["total"] == 1
    thread_id = threads["items"][0]["id"]

    resp = client.post(
        f"{API}/threads/{thread_id}/messages",
        json={"body": "The files are ready for review."},
        headers=provider_headers,
    )
    assert resp.status_code == 201

    item = _inbox(client, owner_headers)["items"][0]
    assert item["type"] == "message"
    assert set(item.keys()) == NOTIFICATION_KEYS
    assert item["title"] == "New message"


def test_notification_types_expose_canonical_names():
    values = {member.value for member in NotificationType}
    assert CANONICAL_NOTIFICATION_TYPES <= values


# --------------------------------------------------------------------------
# camelCase shapes
# --------------------------------------------------------------------------


def test_thread_last_message_stays_an_object(client: TestClient):
    owner_headers, owner_id = _signup(client, ["seeker"], name="Thread Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Thread Provider")
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    _accept(client, owner_headers, offer["id"])

    threads = client.get(f"{API}/threads", headers=owner_headers).json()
    assert set(threads["items"][0].keys()) == THREAD_KEYS
    assert threads["items"][0]["lastMessage"] is None

    resp = client.post(
        f"{API}/threads/{threads['items'][0]['id']}/messages",
        json={"body": "Here is the brief."},
        headers=owner_headers,
    )
    assert resp.status_code == 201

    thread = client.get(
        f"{API}/threads", headers=owner_headers
    ).json()["items"][0]
    last = thread["lastMessage"]
    assert isinstance(last, dict)
    assert set(last.keys()) == LAST_MESSAGE_KEYS
    assert last["senderId"] == owner_id
    assert last["body"] == "Here is the brief."
    assert last["id"] and last["createdAt"]


# --------------------------------------------------------------------------
# Pagination
# --------------------------------------------------------------------------


def test_pagination_envelope_is_unchanged(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"], name="Page Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Page Provider")
    ask = _create_ask(client, owner_headers)
    _create_offer(client, provider_headers, ask["id"])

    endpoints = [
        f"{API}/asks",
        f"{API}/notifications",
        f"{API}/threads",
        f"{API}/asks/{ask['id']}/offers",
    ]
    for endpoint in endpoints:
        resp = client.get(endpoint, headers=owner_headers)
        assert resp.status_code == 200, (endpoint, resp.text)
        body = resp.json()
        assert isinstance(body, dict), endpoint
        assert set(body.keys()) == ENVELOPE_KEYS, endpoint

    resp = client.get(
        f"{API}/asks", params={"pageSize": 1}, headers=owner_headers
    )
    body = resp.json()
    assert body["page"] == 1
    assert body["pageSize"] == 1
    assert body["total"] == 1
    assert body["totalPages"] == 1
    assert body["hasNext"] is False


# --------------------------------------------------------------------------
# Currency
# --------------------------------------------------------------------------


def test_currency_supports_inr_usd_eur_with_inr_default(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"], name="Currency Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Currency Provider")

    for code in ("INR", "USD", "EUR", "inr", "usd", "eur"):
        ask = _create_ask(
            client, owner_headers, title=f"Currency check {code}", currency=code
        )
        assert ask["currency"] == code.upper()

    no_currency = _ask_payload()
    no_currency.pop("currency")
    resp = client.post(f"{API}/asks", json=no_currency, headers=owner_headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["currency"] == "INR"
    ask = resp.json()

    resp = client.post(
        f"{API}/asks/{ask['id']}/offers",
        json=_offer_payload(),
        headers=provider_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["currency"] == "INR"

    euro_headers, _ = _signup(client, ["provider"], name="Euro Provider")
    resp = client.post(
        f"{API}/asks/{ask['id']}/offers",
        json=_offer_payload(currency="eur", price=380),
        headers=euro_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["currency"] == "EUR"
