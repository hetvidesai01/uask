"""Phase 2 private contact/social fields — owner and connections only."""

import uuid

from fastapi.testclient import TestClient

API = "/api/v1"

CONTACT_KEYS = {"linkedin", "instagram", "contactEmail"}
PROFILE_KEYS = {
    "id",
    "name",
    "avatarUrl",
    "bio",
    "location",
    "categories",
    "roles",
    "rating",
    "reviewCount",
    "joinedAt",
}


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(client: TestClient, roles: list[str]) -> tuple[dict, str]:
    email = f"{uuid.uuid4().hex[:12]}@example.com"
    resp = client.post(
        f"{API}/auth/signup",
        json={
            "name": "Contact Tester",
            "email": email,
            "password": "password123",
            "roles": roles,
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return {"Authorization": f"Bearer {body['accessToken']}"}, body["user"]["id"]


def _patch(client: TestClient, headers: dict, payload: dict) -> dict:
    user_id = _me(client, headers)
    resp = client.patch(
        f"{API}/users/{user_id}", json=payload, headers=headers
    )
    return resp


def _me(client: TestClient, headers: dict) -> str:
    resp = client.get(f"{API}/auth/me", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _contact(client: TestClient, headers: dict, user_id: str) -> dict:
    resp = client.get(f"{API}/users/{user_id}/contact", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _connect(client: TestClient, headers: dict, to_user_id: str) -> dict:
    resp = client.post(
        f"{API}/connections",
        json={"toUserId": to_user_id},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# --------------------------------------------------------------------------
# PATCH /users/{id} — writing the fields
# --------------------------------------------------------------------------


def test_contact_fields_stored_on_profile_update(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    resp = _patch(
        client,
        headers,
        {
            "linkedin": "https://linkedin.com/in/contact-tester",
            "instagram": "@contact_tester",
            "contactEmail": "contact.tester@example.com",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["linkedin"] == "https://linkedin.com/in/contact-tester"
    assert body["instagram"] == "@contact_tester"
    assert body["contactEmail"] == "contact.tester@example.com"

    # Own profile endpoint keeps them; the public profile never exposes them.
    resp = client.get(f"{API}/auth/me", headers=headers)
    assert set(CONTACT_KEYS) <= set(resp.json().keys())

    resp = client.get(f"{API}/users/{user_id}", headers=headers)
    assert resp.status_code == 200
    assert set(resp.json().keys()) == PROFILE_KEYS
    assert CONTACT_KEYS.isdisjoint(resp.json().keys())


def test_contact_fields_default_to_null(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.get(f"{API}/auth/me", headers=headers)
    body = resp.json()
    assert set(CONTACT_KEYS) <= set(body.keys())
    assert body["linkedin"] is None
    assert body["instagram"] is None
    assert body["contactEmail"] is None


def test_contact_invalid_email_rejected(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _patch(client, headers, {"contactEmail": "not-an-email"})
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_contact_blank_value_rejected(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _patch(client, headers, {"linkedin": "   "})
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_contact_fields_clear_with_null(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _patch(
        client,
        headers,
        {
            "linkedin": "https://linkedin.com/in/soon-cleared",
            "instagram": "@soon_cleared",
            "contactEmail": "clear.me@example.com",
        },
    )
    assert resp.status_code == 200, resp.text

    resp = _patch(
        client,
        headers,
        {"linkedin": None, "instagram": None, "contactEmail": None},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["linkedin"] is None
    assert body["instagram"] is None
    assert body["contactEmail"] is None


# --------------------------------------------------------------------------
# GET /users/{id}/contact — privacy
# --------------------------------------------------------------------------


def test_contact_owner_can_read(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    _patch(
        client,
        headers,
        {"linkedin": "https://linkedin.com/in/owner-only", "instagram": "@owner"},
    )

    body = _contact(client, headers, user_id)
    assert set(body.keys()) == CONTACT_KEYS
    assert body["linkedin"] == "https://linkedin.com/in/owner-only"
    assert body["instagram"] == "@owner"
    assert body["contactEmail"] is None


def test_contact_visible_to_connected_user(client: TestClient):
    headers_owner, owner_id = _signup(client, ["seeker"])
    headers_viewer, _ = _signup(client, ["provider"])
    _patch(client, headers_owner, {"contactEmail": "reachable@example.com"})

    # Not connected → denied.
    resp = client.get(f"{API}/users/{owner_id}/contact", headers=headers_viewer)
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONNECTED"

    _connect(client, headers_viewer, owner_id)
    body = _contact(client, headers_viewer, owner_id)
    assert body["contactEmail"] == "reachable@example.com"


def test_contact_hidden_after_disconnect(client: TestClient):
    headers_owner, owner_id = _signup(client, ["seeker"])
    headers_viewer, _ = _signup(client, ["provider"])
    _patch(client, headers_owner, {"instagram": "@temporary"})
    connection = _connect(client, headers_viewer, owner_id)
    assert _contact(client, headers_viewer, owner_id)["instagram"] == "@temporary"

    resp = client.delete(
        f"{API}/connections/{connection['id']}", headers=headers_viewer
    )
    assert resp.status_code == 204, resp.text

    resp = client.get(f"{API}/users/{owner_id}/contact", headers=headers_viewer)
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONNECTED"


def test_contact_hidden_from_unrelated_user(client: TestClient):
    headers_owner, owner_id = _signup(client, ["seeker"])
    headers_stranger, _ = _signup(client, ["provider"])
    _patch(client, headers_owner, {"contactEmail": "private@example.com"})

    resp = client.get(
        f"{API}/users/{owner_id}/contact", headers=headers_stranger
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONNECTED"
    assert "private@example.com" not in resp.text


def test_contact_requires_auth(client: TestClient):
    _, user_id = _signup(client, ["seeker"])
    resp = client.get(f"{API}/users/{user_id}/contact")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_contact_unknown_user(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.get(
        f"{API}/users/{uuid.uuid4()}/contact", headers=headers
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "USER_NOT_FOUND"


def test_contact_cannot_be_written_by_another_user(client: TestClient):
    headers_owner, owner_id = _signup(client, ["seeker"])
    headers_stranger, _ = _signup(client, ["provider"])
    _patch(client, headers_owner, {"contactEmail": "mine@example.com"})

    resp = client.patch(
        f"{API}/users/{owner_id}",
        json={"contactEmail": "hijack@example.com"},
        headers=headers_stranger,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"

    body = _contact(client, headers_owner, owner_id)
    assert body["contactEmail"] == "mine@example.com"
