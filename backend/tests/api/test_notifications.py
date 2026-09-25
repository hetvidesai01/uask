"""Phase 9 notifications — list, read state, isolation, event wiring."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

API = "/api/v1"

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
ENVELOPE_KEYS = {"items", "page", "pageSize", "total", "totalPages", "hasNext"}


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Notify Tester"
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


def _create_offer(
    client: TestClient, headers: dict, ask_id: str, **overrides
) -> dict:
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
    resp = client.post(
        f"{API}/asks/{ask_id}/offers", json=payload, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _set_offer_status(
    client: TestClient, owner_headers: dict, offer_id: str, status: str
) -> None:
    resp = client.patch(
        f"{API}/offers/{offer_id}",
        json={"status": status},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text


def _list(
    client: TestClient, headers: dict, *, query: str = ""
) -> dict:
    resp = client.get(f"{API}/notifications{query}", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _make_accepted_thread(client: TestClient) -> dict:
    owner_headers, owner_id = _signup(client, ["seeker"], name="Thread Owner")
    provider_headers, provider_id = _signup(
        client, ["provider"], name="Thread Provider"
    )
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    _set_offer_status(client, owner_headers, offer["id"], "accepted")
    threads = _list_threads(client, owner_headers)
    assert threads["total"] == 1, threads
    return {
        "owner_headers": owner_headers,
        "owner_id": owner_id,
        "provider_headers": provider_headers,
        "provider_id": provider_id,
        "ask": ask,
        "thread": threads["items"][0],
    }


def _list_threads(client: TestClient, headers: dict) -> dict:
    resp = client.get(f"{API}/threads", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


# --------------------------------------------------------------------------
# GET /notifications — list
# --------------------------------------------------------------------------


def test_list_notifications(client: TestClient):
    owner_headers, owner_id = _signup(client, ["seeker"], name="Ask Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Fast Provider")
    ask = _create_ask(client, owner_headers)
    _create_offer(client, provider_headers, ask["id"])

    inbox = _list(client, owner_headers)
    assert set(inbox.keys()) == ENVELOPE_KEYS
    assert inbox["total"] == 1
    assert inbox["page"] == 1
    assert inbox["pageSize"] == 20

    item = inbox["items"][0]
    assert set(item.keys()) == NOTIFICATION_KEYS
    assert item["type"] == "ask_new_offer"
    assert item["title"] == "New offer received"
    assert item["body"] == f"Fast Provider submitted an offer on {ask['title']}"
    assert item["link"] == f"/app/asks/{ask['id']}"
    assert item["read"] is False
    assert item["userId"] == owner_id
    assert item["createdAt"]

    # Newest first when a second offer arrives.
    provider_two, _ = _signup(client, ["provider"], name="Slow Provider")
    _create_offer(client, provider_two, ask["id"])
    inbox = _list(client, owner_headers)
    assert inbox["total"] == 2
    first, second = inbox["items"]
    assert first["body"].startswith("Slow Provider")
    assert second["body"].startswith("Fast Provider")
    assert datetime.fromisoformat(first["createdAt"]) >= datetime.fromisoformat(
        second["createdAt"]
    )


def test_list_requires_auth(client: TestClient):
    resp = client.get(f"{API}/notifications")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


# --------------------------------------------------------------------------
# User isolation
# --------------------------------------------------------------------------


def test_user_isolation(client: TestClient):
    alice_headers, alice_id = _signup(client, ["seeker"], name="Alice Owner")
    bob_headers, bob_id = _signup(client, ["seeker"], name="Bob Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Busy Provider")

    ask_a = _create_ask(client, alice_headers)
    ask_b = _create_ask(client, bob_headers)
    _create_offer(client, provider_headers, ask_a["id"])
    _create_offer(client, provider_headers, ask_b["id"])

    inbox_a = _list(client, alice_headers)
    inbox_b = _list(client, bob_headers)
    assert inbox_a["total"] == 1
    assert inbox_b["total"] == 1
    ids_a = {n["id"] for n in inbox_a["items"]}
    ids_b = {n["id"] for n in inbox_b["items"]}
    assert ids_a.isdisjoint(ids_b)
    assert inbox_a["items"][0]["userId"] == alice_id
    assert inbox_b["items"][0]["userId"] == bob_id

    # Marking someone else's notification is a 404, never a 403.
    resp = client.patch(
        f"{API}/notifications/{inbox_b['items'][0]['id']}/read",
        headers=alice_headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "NOTIFICATION_NOT_FOUND"
    assert _list(client, bob_headers)["items"][0]["read"] is False

    # read-all touches only the caller's notifications.
    resp = client.patch(f"{API}/notifications/read-all", headers=alice_headers)
    assert resp.status_code == 204
    assert _list(client, alice_headers)["items"][0]["read"] is True
    assert _list(client, bob_headers)["items"][0]["read"] is False


# --------------------------------------------------------------------------
# PATCH read / read-all
# --------------------------------------------------------------------------


def test_mark_one_read(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    _create_offer(client, provider_headers, ask["id"])
    notification_id = _list(client, owner_headers)["items"][0]["id"]

    resp = client.patch(
        f"{API}/notifications/{notification_id}/read", headers=owner_headers
    )
    assert resp.status_code == 200, resp.text
    item = resp.json()
    assert set(item.keys()) == NOTIFICATION_KEYS
    assert item["id"] == notification_id
    assert item["read"] is True

    # Unread view empties; the notification itself remains.
    assert _list(client, owner_headers, query="?unreadOnly=true")["total"] == 0
    assert _list(client, owner_headers)["total"] == 1

    # Idempotent.
    resp = client.patch(
        f"{API}/notifications/{notification_id}/read", headers=owner_headers
    )
    assert resp.status_code == 200
    assert resp.json()["read"] is True

    # Unknown id and malformed id.
    resp = client.patch(
        f"{API}/notifications/{uuid.uuid4()}/read", headers=owner_headers
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "NOTIFICATION_NOT_FOUND"

    resp = client.patch(
        f"{API}/notifications/not-a-uuid/read", headers=owner_headers
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_mark_all_read(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_a, _ = _signup(client, ["provider"])
    provider_b, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    _create_offer(client, provider_a, ask["id"])
    _create_offer(client, provider_b, ask["id"])

    inbox = _list(client, owner_headers)
    assert inbox["total"] == 2
    assert all(n["read"] is False for n in inbox["items"])
    assert (
        _list(client, owner_headers, query="?unreadOnly=true")["total"] == 2
    )

    resp = client.patch(f"{API}/notifications/read-all", headers=owner_headers)
    assert resp.status_code == 204
    assert resp.content == b""

    inbox = _list(client, owner_headers)
    assert all(n["read"] is True for n in inbox["items"])
    assert _list(client, owner_headers, query="?unreadOnly=true")["total"] == 0

    # Idempotent on an already-clear inbox.
    resp = client.patch(f"{API}/notifications/read-all", headers=owner_headers)
    assert resp.status_code == 204


# --------------------------------------------------------------------------
# Offer-generated notifications
# --------------------------------------------------------------------------


def test_offer_notifications(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"], name="Offer Owner")
    provider_a, _ = _signup(client, ["provider"], name="Alpha Provider")
    provider_b, _ = _signup(client, ["provider"], name="Beta Provider")
    provider_c, _ = _signup(client, ["provider"], name="Gamma Provider")
    ask = _create_ask(client, owner_headers)

    # New offer received → ASK owner.
    offer_a = _create_offer(client, provider_a, ask["id"])
    inbox = _list(client, owner_headers)
    assert [n["type"] for n in inbox["items"]] == ["ask_new_offer"]

    # Shortlisted → provider only.
    _set_offer_status(client, owner_headers, offer_a["id"], "shortlisted")
    inbox = _list(client, provider_a)
    assert [n["type"] for n in inbox["items"]] == ["offer_shortlisted"]
    assert inbox["items"][0]["link"] == f"/app/asks/{ask['id']}"
    assert inbox["items"][0]["read"] is False
    assert _list(client, owner_headers)["total"] == 1

    _create_offer(client, provider_b, ask["id"])
    _create_offer(client, provider_c, ask["id"])
    assert _list(client, owner_headers)["total"] == 3

    # Accept → winner accepted, every competitor rejected, owner quiet.
    _set_offer_status(client, owner_headers, offer_a["id"], "accepted")
    types_a = [n["type"] for n in _list(client, provider_a)["items"]]
    assert types_a[0] == "offer_accepted"
    assert "offer_shortlisted" in types_a
    assert _list(client, provider_b)["items"][0]["type"] == "offer_rejected"
    assert _list(client, provider_c)["items"][0]["type"] == "offer_rejected"
    assert (
        _list(client, provider_b)["items"][0]["link"] == f"/app/asks/{ask['id']}"
    )
    assert _list(client, owner_headers)["total"] == 3

    # Explicit reject on a second ASK → provider informed.
    ask_two = _create_ask(client, owner_headers, title="Second logo request")
    offer_d = _create_offer(client, provider_b, ask_two["id"])
    _set_offer_status(client, owner_headers, offer_d["id"], "rejected")
    inbox = _list(client, provider_b)
    assert inbox["total"] == 2
    assert inbox["items"][0]["type"] == "offer_rejected"
    assert inbox["items"][0]["link"] == f"/app/asks/{ask_two['id']}"


def test_no_self_notification(client: TestClient):
    headers, _ = _signup(client, ["seeker", "provider"], name="Solo User")
    ask = _create_ask(client, headers)
    _create_offer(client, headers, ask["id"])
    assert _list(client, headers)["total"] == 0


# --------------------------------------------------------------------------
# Message-generated notifications
# --------------------------------------------------------------------------


def test_message_notifications(client: TestClient):
    ctx = _make_accepted_thread(client)
    thread_id = ctx["thread"]["id"]
    owner = ctx["owner_headers"]
    provider = ctx["provider_headers"]

    # Baselines from the offer lifecycle: thread creation is silent.
    owner_inbox = _list(client, owner)
    provider_inbox = _list(client, provider)
    assert [n["type"] for n in owner_inbox["items"]] == ["ask_new_offer"]
    assert [n["type"] for n in provider_inbox["items"]] == ["offer_accepted"]
    owner_base = owner_inbox["total"]
    provider_base = provider_inbox["total"]

    resp = client.post(
        f"{API}/threads/{thread_id}/messages",
        json={"body": "The files are ready for review."},
        headers=provider,
    )
    assert resp.status_code == 201

    inbox = _list(client, owner)
    assert inbox["total"] == owner_base + 1
    item = inbox["items"][0]
    assert item["type"] == "new_message"
    assert item["title"] == "New message"
    assert item["body"] == (
        "Thread Provider: The files are ready for review."
    )
    assert item["link"] == f"/app/messages/{thread_id}"
    assert item["read"] is False

    # The sender is not notified about their own message.
    assert _list(client, provider)["total"] == provider_base

    # Owner replies → provider notified once, owner count unchanged.
    resp = client.post(
        f"{API}/threads/{thread_id}/messages",
        json={"body": "Thanks, taking a look now."},
        headers=owner,
    )
    assert resp.status_code == 201
    assert _list(client, owner)["total"] == owner_base + 1
    inbox = _list(client, provider)
    assert inbox["total"] == provider_base + 1
    assert inbox["items"][0]["type"] == "new_message"
    assert inbox["items"][0]["link"] == f"/app/messages/{thread_id}"

    # Outsiders see nothing.
    outsider, _ = _signup(client, ["seeker"], name="Curious Outsider")
    assert _list(client, outsider)["total"] == 0
