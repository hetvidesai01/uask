"""Phase 7 offers — creation, eligibility, status authority, accept, compare."""

import threading
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.enums import AskStatus, OfferStatus
from app.core.exceptions import ConflictError
from app.db.session import SessionLocal
from app.models.ask import Ask
from app.models.user import User
from app.schemas.offer import OfferUpdate
from app.services import offer_service

API = "/api/v1"

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
ENVELOPE_KEYS = {"items", "page", "pageSize", "total", "totalPages", "hasNext"}


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Offer Tester"
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


def _set_ask_status(db: Session, ask_id: str, status: AskStatus) -> None:
    ask = db.get(Ask, uuid.UUID(str(ask_id)))
    assert ask is not None
    ask.status = status
    db.commit()


# --------------------------------------------------------------------------
# POST /asks/:id/offers — creation, eligibility, duplicate guard
# --------------------------------------------------------------------------


def test_create_offer_success(client: TestClient):
    owner_headers, owner_id = _signup(client, ["seeker"])
    provider_headers, provider_id = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)

    resp = client.post(
        f"{API}/asks/{ask['id']}/offers",
        json=_offer_payload(currency="usd"),
        headers=provider_headers,
    )
    assert resp.status_code == 201, resp.text
    offer = resp.json()
    assert set(offer.keys()) >= OFFER_KEYS
    assert offer["askId"] == ask["id"]
    assert offer["providerId"] == provider_id
    assert offer["status"] == "pending"
    assert offer["currency"] == "USD"
    assert offer["price"] == 450
    assert isinstance(offer["price"], int | float)
    assert not isinstance(offer["price"], str)
    assert offer["deliveryDays"] == 5
    assert offer["deliverables"] == ["Source files", "Two revision rounds"]
    assert offer["attachments"] == []
    assert offer["deletedAt"] is None
    assert datetime.fromisoformat(offer["createdAt"])
    assert owner_id != provider_id


def test_create_offer_requires_provider_role(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    seeker_headers, _ = _signup(client, ["seeker"])
    ask = _create_ask(client, owner_headers)
    resp = client.post(
        f"{API}/asks/{ask['id']}/offers",
        json=_offer_payload(),
        headers=seeker_headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"


def test_create_offer_requires_auth(client: TestClient):
    resp = client.post(
        f"{API}/asks/{uuid.uuid4()}/offers", json=_offer_payload()
    )
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_create_offer_ask_not_found(client: TestClient):
    provider_headers, _ = _signup(client, ["provider"])
    resp = client.post(
        f"{API}/asks/{uuid.uuid4()}/offers",
        json=_offer_payload(),
        headers=provider_headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "ASK_NOT_FOUND"


def test_create_offer_closed_ask_prevention(client: TestClient, db: Session):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    _set_ask_status(db, ask["id"], AskStatus.closed)

    resp = client.post(
        f"{API}/asks/{ask['id']}/offers",
        json=_offer_payload(),
        headers=provider_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "ASK_NOT_OPEN"


def test_create_offer_cancelled_ask_prevention(
    client: TestClient, db: Session
):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    _set_ask_status(db, ask["id"], AskStatus.cancelled)

    resp = client.post(
        f"{API}/asks/{ask['id']}/offers",
        json=_offer_payload(),
        headers=provider_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "ASK_NOT_OPEN"


def test_create_offer_on_soft_deleted_ask(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    assert (
        client.delete(f"{API}/asks/{ask['id']}", headers=owner_headers).status_code
        == 204
    )
    resp = client.post(
        f"{API}/asks/{ask['id']}/offers",
        json=_offer_payload(),
        headers=provider_headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "ASK_NOT_FOUND"


def test_create_offer_duplicate_prevention(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)

    first = _create_offer(client, provider_headers, ask["id"])
    assert first["status"] == "pending"

    resp = client.post(
        f"{API}/asks/{ask['id']}/offers",
        json=_offer_payload(price=500),
        headers=provider_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "DUPLICATE_OFFER"

    # Still exactly one live offer for this provider.
    resp = client.get(f"{API}/asks/{ask['id']}/offers", headers=owner_headers)
    assert resp.json()["total"] == 1


def test_create_offer_two_providers_allowed(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_a, _ = _signup(client, ["provider"])
    provider_b, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)

    _create_offer(client, provider_a, ask["id"])
    _create_offer(client, provider_b, ask["id"], price=380)

    resp = client.get(f"{API}/asks/{ask['id']}/offers", headers=owner_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2


def test_create_offer_validation_errors(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)

    bad_payloads = [
        {"price": -1},
        {"price": 10_000_001},
        {"deliveryDays": 0},
        {"deliveryDays": 366},
        {"pitch": "too short"},
        {"currency": "IN"},
        {"deliverables": ["x" * 121]},
        {"deliverables": [str(i) for i in range(11)]},
    ]
    for overrides in bad_payloads:
        resp = client.post(
            f"{API}/asks/{ask['id']}/offers",
            json=_offer_payload(**overrides),
            headers=provider_headers,
        )
        assert resp.status_code == 422, (overrides, resp.text)
        assert _error_code(resp) == "VALIDATION_ERROR"


# --------------------------------------------------------------------------
# GET /asks/:id/offers — visibility and envelope
# --------------------------------------------------------------------------


def test_list_offers_owner_sees_all(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_a, _ = _signup(client, ["provider"])
    provider_b, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    _create_offer(client, provider_a, ask["id"])
    _create_offer(client, provider_b, ask["id"], price=380)

    resp = client.get(f"{API}/asks/{ask['id']}/offers", headers=owner_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == ENVELOPE_KEYS
    assert body["total"] == 2
    assert len(body["items"]) == 2
    assert set(body["items"][0].keys()) >= OFFER_KEYS


def test_list_offers_provider_sees_only_own(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_a, id_a = _signup(client, ["provider"])
    provider_b, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    _create_offer(client, provider_a, ask["id"])
    _create_offer(client, provider_b, ask["id"], price=380)

    resp = client.get(f"{API}/asks/{ask['id']}/offers", headers=provider_a)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["providerId"] == id_a


def test_list_offers_non_participant_sees_empty(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    outsider_headers, _ = _signup(client, ["seeker"])
    ask = _create_ask(client, owner_headers)
    _create_offer(client, provider_headers, ask["id"])

    resp = client.get(f"{API}/asks/{ask['id']}/offers", headers=outsider_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


def test_list_offers_requires_auth(client: TestClient):
    resp = client.get(f"{API}/asks/{uuid.uuid4()}/offers")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_list_offers_ask_not_found(client: TestClient):
    provider_headers, _ = _signup(client, ["provider"])
    resp = client.get(
        f"{API}/asks/{uuid.uuid4()}/offers", headers=provider_headers
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "ASK_NOT_FOUND"


# --------------------------------------------------------------------------
# GET /offers/:id — access control
# --------------------------------------------------------------------------


def test_get_offer_owner_and_provider(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, provider_id = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    for headers in (owner_headers, provider_headers):
        resp = client.get(f"{API}/offers/{offer['id']}", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert set(body.keys()) >= OFFER_KEYS
        assert body["id"] == offer["id"]
        assert body["providerId"] == provider_id


def test_get_offer_unrelated_user_forbidden(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    outsider_headers, _ = _signup(client, ["seeker"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    resp = client.get(f"{API}/offers/{offer['id']}", headers=outsider_headers)
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"


def test_get_offer_not_found(client: TestClient):
    provider_headers, _ = _signup(client, ["provider"])
    resp = client.get(f"{API}/offers/{uuid.uuid4()}", headers=provider_headers)
    assert resp.status_code == 404
    assert _error_code(resp) == "OFFER_NOT_FOUND"
    assert "requestId" in resp.json()["error"]


def test_get_offer_requires_auth(client: TestClient):
    resp = client.get(f"{API}/offers/{uuid.uuid4()}")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


# --------------------------------------------------------------------------
# PATCH /offers/:id — provider edits
# --------------------------------------------------------------------------


def test_provider_edits_pending_offer(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={
            "price": 525,
            "pitch": (
                "Revised pitch: I have updated my timeline and can start "
                "on Monday with delivery by the end of next week."
            ),
        },
        headers=provider_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["price"] == 525
    assert body["deliveryDays"] == offer["deliveryDays"]
    assert body["status"] == "pending"
    assert body["pitch"].startswith("Revised pitch")


def test_provider_cannot_edit_after_shortlist(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "shortlisted"},
        headers=owner_headers,
    )
    assert resp.status_code == 200

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"price": 100},
        headers=provider_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "OFFER_NOT_EDITABLE"


def test_owner_cannot_edit_offer_fields(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"price": 1},
        headers=owner_headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"


def test_provider_cannot_change_status(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "shortlisted"},
        headers=provider_headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_ASK_OWNER"

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "accepted"},
        headers=provider_headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_ASK_OWNER"


def test_update_offer_rejects_mixed_payload(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "shortlisted", "price": 500},
        headers=owner_headers,
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_update_offer_empty_body_rejected(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    resp = client.patch(
        f"{API}/offers/{offer['id']}", json={}, headers=provider_headers
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_update_offer_explicit_null_rejected(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    resp = client.patch(
        f"{API}/offers/{offer['id']}", json={"price": None},
        headers=provider_headers,
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_update_offer_requires_auth(client: TestClient):
    resp = client.patch(
        f"{API}/offers/{uuid.uuid4()}", json={"price": 100}
    )
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_update_offer_not_found(client: TestClient):
    provider_headers, _ = _signup(client, ["provider"])
    resp = client.patch(
        f"{API}/offers/{uuid.uuid4()}",
        json={"price": 100},
        headers=provider_headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "OFFER_NOT_FOUND"


# --------------------------------------------------------------------------
# PATCH /offers/:id — shortlist / reject (ASK owner only)
# --------------------------------------------------------------------------


def test_owner_shortlists_offer(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "shortlisted"},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "shortlisted"

    resp = client.get(f"{API}/offers/{offer['id']}", headers=owner_headers)
    assert resp.json()["status"] == "shortlisted"


def test_owner_rejects_from_pending(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "rejected"},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "rejected"


def test_owner_rejects_from_shortlisted(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "shortlisted"},
        headers=owner_headers,
    )
    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "rejected"},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "rejected"


def test_shortlist_by_non_owner_forbidden(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    outsider_headers, _ = _signup(client, ["seeker"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "shortlisted"},
        headers=outsider_headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_ASK_OWNER"


def test_invalid_transition_shortlist_rejected_offer(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "rejected"},
        headers=owner_headers,
    )

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "shortlisted"},
        headers=owner_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "INVALID_STATUS_TRANSITION"


def test_invalid_transition_back_to_pending(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "shortlisted"},
        headers=owner_headers,
    )

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "pending"},
        headers=owner_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "INVALID_STATUS_TRANSITION"


def test_status_change_offer_not_found(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/offers/{uuid.uuid4()}",
        json={"status": "rejected"},
        headers=owner_headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "OFFER_NOT_FOUND"


# --------------------------------------------------------------------------
# Accept — one transaction
# --------------------------------------------------------------------------


def test_accept_offer_transaction(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_a, _ = _signup(client, ["provider"])
    provider_b, _ = _signup(client, ["provider"])
    provider_c, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer_a = _create_offer(client, provider_a, ask["id"])
    offer_b = _create_offer(client, provider_b, ask["id"], price=380)
    offer_c = _create_offer(client, provider_c, ask["id"], price=520)

    resp = client.patch(
        f"{API}/offers/{offer_a['id']}",
        json={"status": "accepted"},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "accepted"

    # All three offers resolved in the same transaction.
    resp = client.get(f"{API}/asks/{ask['id']}/offers", headers=owner_headers)
    statuses = {item["id"]: item["status"] for item in resp.json()["items"]}
    assert statuses == {
        offer_a["id"]: "accepted",
        offer_b["id"]: "rejected",
        offer_c["id"]: "rejected",
    }

    # ASK closed.
    resp = client.get(f"{API}/asks/{ask['id']}", headers=owner_headers)
    assert resp.json()["status"] == "closed"


def test_accept_then_second_accept_conflicts(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_a, _ = _signup(client, ["provider"])
    provider_b, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer_a = _create_offer(client, provider_a, ask["id"])
    offer_b = _create_offer(client, provider_b, ask["id"], price=380)

    resp = client.patch(
        f"{API}/offers/{offer_a['id']}",
        json={"status": "accepted"},
        headers=owner_headers,
    )
    assert resp.status_code == 200

    # Competing offer can no longer be accepted.
    resp = client.patch(
        f"{API}/offers/{offer_b['id']}",
        json={"status": "accepted"},
        headers=owner_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "OFFER_ALREADY_ACCEPTED"

    # Re-accepting the same offer also conflicts.
    resp = client.patch(
        f"{API}/offers/{offer_a['id']}",
        json={"status": "accepted"},
        headers=owner_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "OFFER_ALREADY_ACCEPTED"

    # State unchanged from the first accept.
    resp = client.get(f"{API}/asks/{ask['id']}/offers", headers=owner_headers)
    statuses = {item["status"] for item in resp.json()["items"]}
    assert statuses == {"accepted", "rejected"}


def test_accept_by_non_owner_forbidden(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    outsider_headers, _ = _signup(client, ["seeker"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "accepted"},
        headers=outsider_headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_ASK_OWNER"


def test_accept_rejected_offer_invalid(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "rejected"},
        headers=owner_headers,
    )

    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "accepted"},
        headers=owner_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "INVALID_STATUS_TRANSITION"


def test_accept_requires_auth(client: TestClient):
    resp = client.patch(
        f"{API}/offers/{uuid.uuid4()}", json={"status": "accepted"}
    )
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_concurrent_accept_only_one_wins(client: TestClient):
    owner_headers, owner_id = _signup(client, ["seeker"])
    provider_a, _ = _signup(client, ["provider"])
    provider_b, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer_a = _create_offer(client, provider_a, ask["id"])
    offer_b = _create_offer(client, provider_b, ask["id"], price=380)

    results: list[str] = []
    errors: list[Exception] = []
    barrier = threading.Barrier(2, timeout=15)

    def attempt(offer_id: str) -> None:
        session = SessionLocal()
        try:
            user = session.get(User, uuid.UUID(owner_id))
            assert user is not None
            payload = OfferUpdate(status=OfferStatus.accepted)
            barrier.wait()
            offer_service.update_offer(
                session, uuid.UUID(offer_id), payload, user
            )
            results.append("accepted")
        except ConflictError as exc:
            results.append(exc.code)
        except Exception as exc:  # noqa: BLE001 — surfaced via assertion
            errors.append(exc)
        finally:
            session.close()

    threads = [
        threading.Thread(target=attempt, args=(offer_a["id"],)),
        threading.Thread(target=attempt, args=(offer_b["id"],)),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert not any(t.is_alive() for t in threads), "accept threads hung"
    assert not errors, errors
    assert sorted(results) == ["OFFER_ALREADY_ACCEPTED", "accepted"]

    # Exactly one accepted, one rejected, ASK closed.
    resp = client.get(f"{API}/asks/{ask['id']}/offers", headers=owner_headers)
    statuses = sorted(item["status"] for item in resp.json()["items"])
    assert statuses == ["accepted", "rejected"]
    resp = client.get(f"{API}/asks/{ask['id']}", headers=owner_headers)
    assert resp.json()["status"] == "closed"


# --------------------------------------------------------------------------
# GET /asks/:id/offers/compare
# --------------------------------------------------------------------------


def test_compare_endpoint(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_a, _ = _signup(client, ["provider"])
    provider_b, _ = _signup(client, ["provider"])
    ask = _create_ask(client, owner_headers)
    offer_a = _create_offer(client, provider_a, ask["id"])
    offer_b = _create_offer(client, provider_b, ask["id"], price=380)

    resp = client.get(
        f"{API}/asks/{ask['id']}/offers/compare",
        params={"ids": f"{offer_b['id']},{offer_a['id']}"},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert set(body.keys()) == ENVELOPE_KEYS
    assert body["total"] == 2
    assert body["page"] == 1
    assert body["hasNext"] is False
    # Input order preserved.
    assert [item["id"] for item in body["items"]] == [
        offer_b["id"],
        offer_a["id"],
    ]
    assert set(body["items"][0].keys()) >= OFFER_KEYS


def test_compare_max_four_ids(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    ask = _create_ask(client, owner_headers)
    ids = [str(uuid.uuid4()) for _ in range(5)]

    resp = client.get(
        f"{API}/asks/{ask['id']}/offers/compare",
        params={"ids": ",".join(ids)},
        headers=owner_headers,
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"

    # Exactly 4 is fine.
    resp = client.get(
        f"{API}/asks/{ask['id']}/offers/compare",
        params={"ids": ",".join(ids[:4])},
        headers=owner_headers,
    )
    assert resp.status_code == 404  # parse passes, offers don't exist
    assert _error_code(resp) == "OFFER_NOT_FOUND"


def test_compare_unauthorized_non_owner(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    outsider_headers, _ = _signup(client, ["seeker"])
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])

    for headers in (outsider_headers, provider_headers):
        resp = client.get(
            f"{API}/asks/{ask['id']}/offers/compare",
            params={"ids": offer["id"]},
            headers=headers,
        )
        assert resp.status_code == 403, headers
        assert _error_code(resp) == "NOT_ASK_OWNER"


def test_compare_offer_from_other_ask(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    provider_headers, _ = _signup(client, ["provider"])
    ask_one = _create_ask(client, owner_headers)
    ask_two = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask_one["id"])

    resp = client.get(
        f"{API}/asks/{ask_two['id']}/offers/compare",
        params={"ids": offer["id"]},
        headers=owner_headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "OFFER_NOT_FOUND"


def test_compare_ask_not_found(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    resp = client.get(
        f"{API}/asks/{uuid.uuid4()}/offers/compare",
        params={"ids": str(uuid.uuid4())},
        headers=owner_headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "ASK_NOT_FOUND"


def test_compare_missing_ids_param(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    ask = _create_ask(client, owner_headers)
    resp = client.get(
        f"{API}/asks/{ask['id']}/offers/compare", headers=owner_headers
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_compare_invalid_uuid(client: TestClient):
    owner_headers, _ = _signup(client, ["seeker"])
    ask = _create_ask(client, owner_headers)
    resp = client.get(
        f"{API}/asks/{ask['id']}/offers/compare",
        params={"ids": "not-a-uuid"},
        headers=owner_headers,
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_compare_requires_auth(client: TestClient):
    resp = client.get(
        f"{API}/asks/{uuid.uuid4()}/offers/compare",
        params={"ids": str(uuid.uuid4())},
    )
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"
