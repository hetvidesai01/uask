"""Phase 8 messaging — accept-created threads, access, history, unread."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.ask import Ask
from app.models.offer import Offer
from app.models.thread import Thread
from app.services import thread_service

API = "/api/v1"

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
ASK_REF_KEYS = {"id", "title", "category", "status"}
LAST_MESSAGE_KEYS = {"id", "body", "senderId", "createdAt"}
MESSAGE_KEYS = {
    "id",
    "threadId",
    "senderId",
    "body",
    "attachments",
    "read",
    "createdAt",
    "sender",
}
MESSAGE_PAGE_KEYS = {"items", "nextCursor", "hasMore", "limit"}
ENVELOPE_KEYS = {"items", "page", "pageSize", "total", "totalPages", "hasNext"}
USER_PUBLIC_KEYS = {"id", "name", "avatarUrl", "rating", "reviewCount"}


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Thread Tester"
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


def _accept(client: TestClient, owner_headers: dict, offer_id: str) -> None:
    resp = client.patch(
        f"{API}/offers/{offer_id}",
        json={"status": "accepted"},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text


def _make_accepted_thread(client: TestClient) -> dict:
    """Owner + provider with one accepted offer and a live thread."""
    owner_headers, owner_id = _signup(client, ["seeker"], name="Ask Owner")
    provider_headers, provider_id = _signup(
        client, ["provider"], name="Winning Provider"
    )
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    _accept(client, owner_headers, offer["id"])
    resp = client.get(f"{API}/threads", headers=owner_headers)
    items = resp.json()["items"]
    assert len(items) == 1, items
    return {
        "owner_headers": owner_headers,
        "owner_id": owner_id,
        "provider_headers": provider_headers,
        "provider_id": provider_id,
        "ask": ask,
        "offer": offer,
        "thread": items[0],
    }


def _send(client: TestClient, headers: dict, thread_id: str, body: str, **kw) -> dict:
    resp = client.post(
        f"{API}/threads/{thread_id}/messages",
        json={"body": body, **kw},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _inbox(client: TestClient, headers: dict) -> dict:
    resp = client.get(f"{API}/threads", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _unread(client: TestClient, headers: dict, thread_id: str) -> int:
    for item in _inbox(client, headers)["items"]:
        if item["id"] == thread_id:
            return item["unreadCount"]
    raise AssertionError(f"thread {thread_id} not in inbox")


# --------------------------------------------------------------------------
# Thread auto-created on acceptance
# --------------------------------------------------------------------------


def test_no_thread_before_acceptance(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    _create_offer(client, provider_headers, ask["id"])

    # Messaging only opens once an offer is accepted.
    assert _inbox(client, owner_headers)["total"] == 0
    assert _inbox(client, provider_headers)["total"] == 0


def test_thread_created_after_acceptance(client: TestClient):
    owner_headers, owner_id = _signup(client, ["seeker"])
    provider_headers, provider_id = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    _accept(client, owner_headers, offer["id"])

    inbox = _inbox(client, owner_headers)
    assert inbox["total"] == 1
    thread = inbox["items"][0]
    assert set(thread.keys()) == THREAD_KEYS
    assert thread["askId"] == ask["id"]
    assert thread["offerId"] == offer["id"]
    assert set(thread["participantIds"]) == {owner_id, provider_id}
    assert {p["id"] for p in thread["participants"]} == {owner_id, provider_id}
    for participant in thread["participants"]:
        assert set(participant.keys()) == USER_PUBLIC_KEYS
    assert set(thread["ask"].keys()) == ASK_REF_KEYS
    assert thread["ask"]["id"] == ask["id"]
    assert thread["ask"]["status"] == "closed"
    assert thread["lastMessage"] is None
    assert thread["unreadCount"] == 0
    assert thread["createdAt"] and thread["updatedAt"]

    # Both participants see the same single thread.
    provider_inbox = _inbox(client, provider_headers)
    assert provider_inbox["total"] == 1
    assert provider_inbox["items"][0]["id"] == thread["id"]


def test_no_manual_thread_creation(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.post(
        f"{API}/threads",
        json={"participantId": str(uuid.uuid4())},
        headers=headers,
    )
    assert resp.status_code == 405


def test_duplicate_prevention(client: TestClient, db: Session):
    ctx = _make_accepted_thread(client)

    # Re-accepting fails and does not spawn a second thread.
    resp = client.patch(
        f"{API}/offers/{ctx['offer']['id']}",
        json={"status": "accepted"},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "OFFER_ALREADY_ACCEPTED"

    # Service-level find-or-create is idempotent for one transaction.
    ask = db.get(Ask, uuid.UUID(ctx["ask"]["id"]))
    offer = db.get(Offer, uuid.UUID(ctx["offer"]["id"]))
    first = thread_service.ensure_thread_for_accept(db, ask=ask, offer=offer)
    second = thread_service.ensure_thread_for_accept(db, ask=ask, offer=offer)
    db.commit()
    assert first.id == second.id

    assert db.scalar(select(func.count()).select_from(Thread)) == 1
    assert _inbox(client, ctx["owner_headers"])["total"] == 1


# --------------------------------------------------------------------------
# Participant access / unauthorized rejection
# --------------------------------------------------------------------------


def test_participants_can_view_thread(client: TestClient):
    ctx = _make_accepted_thread(client)
    thread_id = ctx["thread"]["id"]

    for headers in (ctx["owner_headers"], ctx["provider_headers"]):
        resp = client.get(f"{API}/threads/{thread_id}", headers=headers)
        assert resp.status_code == 200, resp.text
        assert resp.json()["id"] == thread_id

        resp = client.get(f"{API}/threads/{thread_id}/messages", headers=headers)
        assert resp.status_code == 200, resp.text

        resp = client.post(
            f"{API}/threads/{thread_id}/messages",
            json={"body": "Hello there"},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text


def test_non_participant_forbidden(client: TestClient):
    ctx = _make_accepted_thread(client)
    outsider_headers, _ = _signup(client, ["seeker"], name="Outsider")
    thread_id = ctx["thread"]["id"]

    resp = client.get(f"{API}/threads/{thread_id}", headers=outsider_headers)
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"

    resp = client.get(f"{API}/threads/{thread_id}/messages", headers=outsider_headers)
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"

    resp = client.post(
        f"{API}/threads/{thread_id}/messages",
        json={"body": "Let me in"},
        headers=outsider_headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"

    # The inbox never shows threads they do not belong to.
    assert _inbox(client, outsider_headers)["total"] == 0


def test_endpoints_require_auth(client: TestClient):
    ctx = _make_accepted_thread(client)
    thread_id = ctx["thread"]["id"]

    assert client.get(f"{API}/threads").status_code == 401
    assert client.get(f"{API}/threads/{thread_id}").status_code == 401
    assert client.get(f"{API}/threads/{thread_id}/messages").status_code == 401
    resp = client.post(
        f"{API}/threads/{thread_id}/messages", json={"body": "hi"}
    )
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_unknown_thread_404(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    missing = str(uuid.uuid4())

    resp = client.get(f"{API}/threads/{missing}", headers=headers)
    assert resp.status_code == 404
    assert _error_code(resp) == "THREAD_NOT_FOUND"

    resp = client.get(f"{API}/threads/{missing}/messages", headers=headers)
    assert resp.status_code == 404
    assert _error_code(resp) == "THREAD_NOT_FOUND"

    resp = client.post(
        f"{API}/threads/{missing}/messages", json={"body": "hi"}, headers=headers
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "THREAD_NOT_FOUND"


# --------------------------------------------------------------------------
# Send message
# --------------------------------------------------------------------------


def test_send_message(client: TestClient):
    ctx = _make_accepted_thread(client)
    thread_id = ctx["thread"]["id"]
    attachment = {
        "id": "att-1",
        "name": "brief.pdf",
        "url": "/uploads/brief.pdf",
        "size": 1024,
        "mimeType": "application/pdf",
    }

    resp = client.post(
        f"{API}/threads/{thread_id}/messages",
        json={"body": "Here is the brief.", "attachments": [attachment]},
        headers=ctx["provider_headers"],
    )
    assert resp.status_code == 201, resp.text
    message = resp.json()
    assert set(message.keys()) == MESSAGE_KEYS
    assert message["threadId"] == thread_id
    assert message["senderId"] == ctx["provider_id"]
    assert message["body"] == "Here is the brief."
    assert message["attachments"] == [attachment]
    assert message["read"] is False
    assert set(message["sender"].keys()) == USER_PUBLIC_KEYS
    assert message["sender"]["id"] == ctx["provider_id"]

    # The owner's inbox now shows the last message preview.
    thread = _inbox(client, ctx["owner_headers"])["items"][0]
    assert set(thread["lastMessage"].keys()) == LAST_MESSAGE_KEYS
    assert thread["lastMessage"]["id"] == message["id"]
    assert thread["lastMessage"]["body"] == "Here is the brief."
    assert thread["lastMessage"]["senderId"] == ctx["provider_id"]


def test_send_message_validation(client: TestClient):
    ctx = _make_accepted_thread(client)
    thread_id = ctx["thread"]["id"]
    url = f"{API}/threads/{thread_id}/messages"

    for body in ("", "   ", "x" * 5001, None):
        payload = {} if body is None else {"body": body}
        resp = client.post(url, json=payload, headers=ctx["owner_headers"])
        assert resp.status_code == 422, (body, resp.text)
        assert _error_code(resp) == "VALIDATION_ERROR"

    resp = client.post(
        url,
        json={"body": "ok", "attachments": [{}, {}, {}, {}, {}, {}]},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 422


# --------------------------------------------------------------------------
# Fetch history + cursor pagination
# --------------------------------------------------------------------------


def test_fetch_message_history(client: TestClient):
    ctx = _make_accepted_thread(client)
    thread_id = ctx["thread"]["id"]

    # Fresh thread has an empty history.
    resp = client.get(
        f"{API}/threads/{thread_id}/messages", headers=ctx["owner_headers"]
    )
    assert resp.status_code == 200
    page = resp.json()
    assert set(page.keys()) == MESSAGE_PAGE_KEYS
    assert page["items"] == []
    assert page["nextCursor"] is None
    assert page["hasMore"] is False

    m1 = _send(client, ctx["owner_headers"], thread_id, "Are you free next week?")
    m2 = _send(client, ctx["provider_headers"], thread_id, "Yes — mornings work.")
    m3 = _send(client, ctx["owner_headers"], thread_id, "Great, booking Tuesday.")

    resp = client.get(
        f"{API}/threads/{thread_id}/messages", headers=ctx["provider_headers"]
    )
    page = resp.json()
    assert [m["id"] for m in page["items"]] == [m1["id"], m2["id"], m3["id"]]
    assert [m["body"] for m in page["items"]] == [
        "Are you free next week?",
        "Yes — mornings work.",
        "Great, booking Tuesday.",
    ]
    assert [m["senderId"] for m in page["items"]] == [
        ctx["owner_id"],
        ctx["provider_id"],
        ctx["owner_id"],
    ]
    assert page["hasMore"] is False
    assert page["nextCursor"] is None
    assert all(set(m.keys()) == MESSAGE_KEYS for m in page["items"])


def test_cursor_pagination(client: TestClient):
    ctx = _make_accepted_thread(client)
    thread_id = ctx["thread"]["id"]

    sent = [
        _send(
            client,
            ctx["owner_headers"] if i % 2 == 0 else ctx["provider_headers"],
            thread_id,
            f"message number {i}",
        )
        for i in range(1, 6)
    ]
    expected = [m["id"] for m in sent]

    resp = client.get(
        f"{API}/threads/{thread_id}/messages?limit=2",
        headers=ctx["owner_headers"],
    )
    page1 = resp.json()
    assert [m["id"] for m in page1["items"]] == expected[3:5]
    assert page1["hasMore"] is True
    assert page1["nextCursor"] == expected[3]
    assert page1["limit"] == 2

    resp = client.get(
        f"{API}/threads/{thread_id}/messages?limit=2&before={page1['nextCursor']}",
        headers=ctx["owner_headers"],
    )
    page2 = resp.json()
    assert [m["id"] for m in page2["items"]] == expected[1:3]
    assert page2["hasMore"] is True
    assert page2["nextCursor"] == expected[1]

    resp = client.get(
        f"{API}/threads/{thread_id}/messages?limit=2&before={page2['nextCursor']}",
        headers=ctx["owner_headers"],
    )
    page3 = resp.json()
    assert [m["id"] for m in page3["items"]] == expected[0:1]
    assert page3["hasMore"] is False
    assert page3["nextCursor"] is None

    # Pages are disjoint and cover the whole history exactly once.
    seen = [m["id"] for m in page1["items"] + page2["items"] + page3["items"]]
    assert sorted(seen, key=expected.index) == expected


def test_cursor_rejects_invalid_cursor(client: TestClient):
    ctx = _make_accepted_thread(client)
    thread_id = ctx["thread"]["id"]
    url = f"{API}/threads/{thread_id}/messages"

    resp = client.get(f"{url}?before=not-a-uuid", headers=ctx["owner_headers"])
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"

    # A real message id that belongs to a different thread.
    other = _make_accepted_thread(client)
    foreign = _send(
        client,
        other["owner_headers"],
        other["thread"]["id"],
        "not your message",
    )
    resp = client.get(f"{url}?before={foreign['id']}", headers=ctx["owner_headers"])
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


# --------------------------------------------------------------------------
# Unread counts
# --------------------------------------------------------------------------


def test_unread_counts_for_both_users(client: TestClient):
    ctx = _make_accepted_thread(client)
    thread_id = ctx["thread"]["id"]
    owner = ctx["owner_headers"]
    provider = ctx["provider_headers"]

    assert _unread(client, owner, thread_id) == 0
    assert _unread(client, provider, thread_id) == 0

    # Provider writes two messages: only the owner has unread messages.
    _send(client, provider, thread_id, "First update for you.")
    _send(client, provider, thread_id, "Second update for you.")
    assert _unread(client, owner, thread_id) == 2
    assert _unread(client, provider, thread_id) == 0

    # Opening the inbox does not mark anything read.
    _inbox(client, owner)
    assert _unread(client, owner, thread_id) == 2

    # Fetching history marks only the fetching participant read.
    resp = client.get(f"{API}/threads/{thread_id}/messages", headers=owner)
    assert resp.status_code == 200
    assert _unread(client, owner, thread_id) == 0
    assert _unread(client, provider, thread_id) == 0

    # Owner replies: now the provider has unread messages.
    _send(client, owner, thread_id, "Thanks, both look good.")
    assert _unread(client, owner, thread_id) == 0
    assert _unread(client, provider, thread_id) == 1

    resp = client.get(f"{API}/threads/{thread_id}/messages", headers=provider)
    assert resp.status_code == 200
    assert _unread(client, provider, thread_id) == 0


def test_message_read_flags(client: TestClient):
    ctx = _make_accepted_thread(client)
    thread_id = ctx["thread"]["id"]
    url = f"{API}/threads/{thread_id}/messages"

    m1 = _send(client, ctx["provider_headers"], thread_id, "Are you there?")
    page = client.get(url, headers=ctx["owner_headers"]).json()
    by_id = {m["id"]: m for m in page["items"]}
    # Owner just read it; provider has not read anything new yet.
    assert by_id[m1["id"]]["read"] is True

    m2 = _send(client, ctx["owner_headers"], thread_id, "Yes — go ahead.")
    page = client.get(url, headers=ctx["owner_headers"]).json()
    by_id = {m["id"]: m for m in page["items"]}
    # Owner sees their own message as unread by the provider.
    assert by_id[m2["id"]]["read"] is False

    page = client.get(url, headers=ctx["provider_headers"]).json()
    by_id = {m["id"]: m for m in page["items"]}
    # Provider has now read both directions.
    assert by_id[m1["id"]]["read"] is True
    assert by_id[m2["id"]]["read"] is True


# --------------------------------------------------------------------------
# Inbox list: envelope, ask reference, ordering
# --------------------------------------------------------------------------


def test_thread_list_envelope(client: TestClient):
    ctx = _make_accepted_thread(client)
    inbox = _inbox(client, ctx["owner_headers"])
    assert set(inbox.keys()) == ENVELOPE_KEYS
    assert inbox["page"] == 1
    assert inbox["pageSize"] == 20
    assert inbox["total"] == 1
    assert inbox["totalPages"] == 1
    assert inbox["hasNext"] is False


def test_thread_list_sorted_by_recent_activity(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])

    ask_one = _create_ask(client, owner_headers, title="First request for design work")
    provider_one, _ = _signup(client, ["provider"])
    offer_one = _create_offer(client, provider_one, ask_one["id"])
    _accept(client, owner_headers, offer_one["id"])

    ask_two = _create_ask(client, owner_headers, title="Second request for design work")
    provider_two, _ = _signup(client, ["provider"])
    offer_two = _create_offer(client, provider_two, ask_two["id"])
    _accept(client, owner_headers, offer_two["id"])

    inbox = _inbox(client, owner_headers)
    assert inbox["total"] == 2
    first, second = inbox["items"]
    assert first["askId"] == ask_two["id"]
    assert second["askId"] == ask_one["id"]

    # A new message on the older thread moves it back to the top.
    older_id = second["id"]
    _send(client, provider_one, older_id, "Bumping this one.")
    inbox = _inbox(client, owner_headers)
    assert [t["id"] for t in inbox["items"]] == [older_id, first["id"]]
