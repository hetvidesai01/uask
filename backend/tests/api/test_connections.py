"""Phase 2 connections — instant connect, status, list, connected chat."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.connection import Connection

API = "/api/v1"

CONNECTION_KEYS = {"id", "connectedUserId", "connectedUser", "createdAt"}
STATUS_KEYS = {"status", "connectionId"}
COUNT_KEYS = {"count"}
ENVELOPE_KEYS = {"items", "page", "pageSize", "total", "totalPages", "hasNext"}
USER_PUBLIC_KEYS = {"id", "name", "avatarUrl", "rating", "reviewCount"}
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


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Connector"
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


def _connect(
    client: TestClient, headers: dict, to_user_id: str, *, expect: int = 201
) -> dict:
    resp = client.post(
        f"{API}/connections",
        json={"toUserId": to_user_id},
        headers=headers,
    )
    assert resp.status_code == expect, resp.text
    return resp.json()


def _me(client: TestClient, headers: dict) -> str:
    resp = client.get(f"{API}/auth/me", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _status(client: TestClient, headers: dict, target_id: str) -> dict:
    resp = client.get(f"{API}/connections/status/{target_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


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


def _accept(client: TestClient, owner_headers: dict, offer_id: str) -> None:
    resp = client.patch(
        f"{API}/offers/{offer_id}",
        json={"status": "accepted"},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text


def _inbox(client: TestClient, headers: dict) -> dict:
    resp = client.get(f"{API}/threads", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _send(
    client: TestClient, headers: dict, thread_id: str, body: str
) -> dict:
    resp = client.post(
        f"{API}/threads/{thread_id}/messages",
        json={"body": body},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# --------------------------------------------------------------------------
# POST /connections
# --------------------------------------------------------------------------


def test_connect_creates_instant_connection(client: TestClient):
    headers_a, user_a = _signup(client, ["seeker"], name="Alice")
    headers_b, user_b = _signup(client, ["provider"], name="Bob")

    body = _connect(client, headers_a, user_b)
    assert set(body.keys()) == CONNECTION_KEYS
    assert body["connectedUserId"] == user_b
    assert body["connectedUser"]["id"] == user_b
    assert set(body["connectedUser"].keys()) == USER_PUBLIC_KEYS
    assert datetime.fromisoformat(body["createdAt"])

    # There is no pending state — the link is live in both directions.
    assert _status(client, headers_a, user_b)["status"] == "connected"
    assert _status(client, headers_b, user_a)["status"] == "connected"
    assert _status(client, headers_b, user_a)["connectionId"] == body["id"]


def test_connect_is_idempotent(client: TestClient, db: Session):
    headers, _ = _signup(client, ["seeker"])
    _, other_id = _signup(client, ["provider"])

    first = _connect(client, headers, other_id)
    second = _connect(client, headers, other_id, expect=200)
    assert second["id"] == first["id"]
    assert db.scalar(select(func.count()).select_from(Connection)) == 1


def test_connect_order_does_not_duplicate(client: TestClient, db: Session):
    headers_a, _ = _signup(client, ["seeker"])
    headers_b, other_id = _signup(client, ["provider"])

    a = _connect(client, headers_a, other_id)
    b = _connect(client, headers_b, _me(client, headers_a), expect=200)
    assert a["id"] == b["id"]
    assert db.scalar(select(func.count()).select_from(Connection)) == 1


def test_connect_self_rejected(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    resp = client.post(
        f"{API}/connections",
        json={"toUserId": user_id},
        headers=headers,
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "SELF_CONNECTION"


def test_connect_unknown_user(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.post(
        f"{API}/connections",
        json={"toUserId": str(uuid.uuid4())},
        headers=headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "USER_NOT_FOUND"


def test_connect_requires_auth(client: TestClient):
    _, other_id = _signup(client, ["provider"])
    resp = client.post(
        f"{API}/connections", json={"toUserId": other_id}
    )
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


# --------------------------------------------------------------------------
# GET /connections/status/{targetUserId}
# --------------------------------------------------------------------------


def test_connection_status_shapes(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    _, other_id = _signup(client, ["provider"])
    _, stranger_id = _signup(client, ["seeker"], name="Stranger")

    assert set(_status(client, headers, user_id).keys()) == STATUS_KEYS
    assert _status(client, headers, user_id) == {
        "status": "self",
        "connectionId": None,
    }
    assert _status(client, headers, stranger_id) == {
        "status": "none",
        "connectionId": None,
    }

    created = _connect(client, headers, other_id)
    assert _status(client, headers, other_id) == {
        "status": "connected",
        "connectionId": created["id"],
    }


def test_connection_status_unknown_user(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.get(
        f"{API}/connections/status/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "USER_NOT_FOUND"


# --------------------------------------------------------------------------
# DELETE /connections/{id}
# --------------------------------------------------------------------------


def test_remove_connection(client: TestClient, db: Session):
    headers_a, _ = _signup(client, ["seeker"])
    headers_b, user_b = _signup(client, ["provider"])
    connection = _connect(client, headers_a, user_b)
    connection_id = connection["id"]

    resp = client.delete(
        f"{API}/connections/{connection_id}", headers=headers_b
    )
    assert resp.status_code == 204, resp.text
    assert db.scalar(select(func.count()).select_from(Connection)) == 0
    assert _status(client, headers_a, user_b)["status"] == "none"

    resp = client.delete(f"{API}/connections/{connection_id}", headers=headers_a)
    assert resp.status_code == 404
    assert _error_code(resp) == "CONNECTION_NOT_FOUND"


def test_remove_connection_forbidden_for_outsider(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    _, other_id = _signup(client, ["provider"])
    connection = _connect(client, headers, other_id)
    outsider_headers, _ = _signup(client, ["seeker"], name="Outsider")

    resp = client.delete(
        f"{API}/connections/{connection['id']}", headers=outsider_headers
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"


# --------------------------------------------------------------------------
# GET /users/{id}/connections (+ /count)
# --------------------------------------------------------------------------


def test_list_and_count_connections(client: TestClient):
    headers, user_id = _signup(client, ["seeker"], name="Alice")
    _, other_id = _signup(client, ["provider"], name="Bob")
    created = _connect(client, headers, other_id)

    for target in (user_id, other_id):
        resp = client.get(
            f"{API}/users/{target}/connections", headers=headers
        )
        assert resp.status_code == 200, resp.text
        page = resp.json()
        assert set(page.keys()) == ENVELOPE_KEYS
        assert page["total"] == 1
        assert page["totalPages"] == 1
        assert set(page["items"][0].keys()) == CONNECTION_KEYS
        assert page["items"][0]["id"] == created["id"]

    resp = client.get(f"{API}/users/{user_id}/connections/count", headers=headers)
    assert resp.status_code == 200, resp.text
    assert set(resp.json().keys()) == COUNT_KEYS
    assert resp.json()["count"] == 1


def test_list_connections_empty(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    resp = client.get(f"{API}/users/{user_id}/connections", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["items"] == []
    assert resp.json()["total"] == 0


def test_list_connections_unknown_user(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.get(
        f"{API}/users/{uuid.uuid4()}/connections", headers=headers
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "USER_NOT_FOUND"

    resp = client.get(
        f"{API}/users/{uuid.uuid4()}/connections/count", headers=headers
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "USER_NOT_FOUND"


# --------------------------------------------------------------------------
# POST /threads — connected users only, never duplicated
# --------------------------------------------------------------------------


def test_direct_thread_requires_connection(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    _, other_id = _signup(client, ["provider"])

    resp = client.post(
        f"{API}/threads", json={"participantId": other_id}, headers=headers
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONNECTED"

    resp = client.post(
        f"{API}/threads", json={"participantId": user_id}, headers=headers
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "SELF_THREAD"

    resp = client.post(
        f"{API}/threads",
        json={"participantId": str(uuid.uuid4())},
        headers=headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "USER_NOT_FOUND"


def test_direct_thread_created_and_idempotent(
    client: TestClient, db: Session
):
    headers_a, user_a = _signup(client, ["seeker"], name="Alice")
    headers_b, user_b = _signup(client, ["provider"], name="Bob")
    _connect(client, headers_a, user_b)

    resp = client.post(
        f"{API}/threads", json={"participantId": user_b}, headers=headers_a
    )
    assert resp.status_code == 201, resp.text
    thread = resp.json()
    assert set(thread.keys()) == THREAD_KEYS
    assert thread["askId"] is None
    assert thread["ask"] is None
    assert thread["offerId"] is None
    assert set(thread["participantIds"]) == {user_a, user_b}
    assert {p["id"] for p in thread["participants"]} == {user_a, user_b}
    assert thread["lastMessage"] is None
    assert thread["unreadCount"] == 0

    # Same pair never gets a second thread.
    again = client.post(
        f"{API}/threads", json={"participantId": user_a}, headers=headers_b
    )
    assert again.status_code == 200, again.text
    assert again.json()["id"] == thread["id"]

    assert _inbox(client, headers_a)["total"] == 1
    assert _inbox(client, headers_b)["total"] == 1

    # The connected chat accepts messages straight away.
    sent = _send(client, headers_b, thread["id"], "Hi Alice")
    assert sent["threadId"] == thread["id"]
    history = client.get(
        f"{API}/threads/{thread['id']}/messages", headers=headers_a
    )
    assert history.status_code == 200
    assert [m["body"] for m in history.json()["items"]] == ["Hi Alice"]


def test_existing_accepted_thread_reused(client: TestClient):
    headers_a, user_a = _signup(client, ["seeker"], name="Owner")
    headers_b, user_b = _signup(client, ["provider"], name="Provider")
    ask = _create_ask(client, headers_a)
    offer = _create_offer(client, headers_b, ask["id"])
    _accept(client, headers_a, offer["id"])

    accepted_id = _inbox(client, headers_a)["items"][0]["id"]
    _connect(client, headers_a, user_b)

    resp = client.post(
        f"{API}/threads", json={"participantId": user_b}, headers=headers_a
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == accepted_id
    assert resp.json()["askId"] == ask["id"]
    assert _inbox(client, headers_a)["total"] == 1
    assert _inbox(client, headers_b)["total"] == 1


def test_accept_binds_existing_direct_thread(client: TestClient):
    headers_a, _ = _signup(client, ["seeker"], name="Owner")
    headers_b, user_b = _signup(client, ["provider"], name="Provider")
    _connect(client, headers_a, user_b)

    created = client.post(
        f"{API}/threads", json={"participantId": user_b}, headers=headers_a
    )
    thread_id = created.json()["id"]
    _send(client, headers_a, thread_id, "Before the ASK existed")

    ask = _create_ask(client, headers_a)
    offer = _create_offer(client, headers_b, ask["id"])
    _accept(client, headers_a, offer["id"])

    # One conversation per pair — the direct thread becomes the ASK thread.
    inbox = _inbox(client, headers_a)
    assert inbox["total"] == 1
    thread = inbox["items"][0]
    assert thread["id"] == thread_id
    assert thread["askId"] == ask["id"]
    assert thread["offerId"] == offer["id"]

    history = client.get(
        f"{API}/threads/{thread_id}/messages", headers=headers_b
    )
    assert [m["body"] for m in history.json()["items"]] == [
        "Before the ASK existed"
    ]
