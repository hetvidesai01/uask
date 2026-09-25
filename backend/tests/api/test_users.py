"""Phase 6 users tests — public profile and owner/admin profile updates."""

import uuid
from datetime import datetime

from fastapi.testclient import TestClient

API = "/api/v1"

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


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Profile Tester"
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


# --------------------------------------------------------------------------
# GET /users/{id}
# --------------------------------------------------------------------------


def test_get_user_public_profile(client: TestClient):
    headers, user_id = _signup(client, ["seeker"], name="Jane Doe")
    resp = client.get(f"{API}/users/{user_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert set(body.keys()) == PROFILE_KEYS
    assert body["id"] == user_id
    assert body["name"] == "Jane Doe"
    assert body["roles"] == ["seeker"]
    assert body["categories"] == []
    assert body["bio"] is None
    assert body["avatarUrl"] is None
    assert body["location"] is None
    assert body["reviewCount"] == 0
    assert isinstance(body["rating"], int | float)
    assert not isinstance(body["rating"], str)
    assert body["rating"] == 0.0
    assert datetime.fromisoformat(body["joinedAt"])
    assert "email" not in body
    assert "passwordHash" not in body
    assert "password_hash" not in body


def test_get_other_user_public_profile(client: TestClient):
    headers_me, _ = _signup(client, ["seeker"])
    _, other_id = _signup(client, ["provider"], name="Other Person")
    resp = client.get(f"{API}/users/{other_id}", headers=headers_me)
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == other_id
    assert body["name"] == "Other Person"
    assert body["roles"] == ["provider"]
    assert "email" not in body


def test_get_user_not_found(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.get(f"{API}/users/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404
    assert _error_code(resp) == "USER_NOT_FOUND"
    assert "requestId" in resp.json()["error"]


def test_get_user_requires_auth(client: TestClient):
    resp = client.get(f"{API}/users/{uuid.uuid4()}")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_get_user_invalid_uuid(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.get(f"{API}/users/not-a-uuid", headers=headers)
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


# --------------------------------------------------------------------------
# PATCH /users/{id}
# --------------------------------------------------------------------------


def test_update_own_profile(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/users/{user_id}",
        json={
            "name": "  Renamed User  ",
            "bio": "Freelance baker and weekend photographer.",
            "location": "Austin, TX",
            "categories": ["design", "Design", "photography"],
            "roles": ["seeker", "provider"],
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "Renamed User"
    assert body["bio"] == "Freelance baker and weekend photographer."
    assert body["location"] == "Austin, TX"
    assert body["categories"] == ["Design", "Photography"]
    assert set(body["roles"]) == {"seeker", "provider"}
    assert body["email"]
    assert body["id"] == user_id
    assert isinstance(body["rating"], int | float)

    # Persisted — visible on the public profile too.
    resp = client.get(f"{API}/users/{user_id}", headers=headers)
    assert resp.status_code == 200
    profile = resp.json()
    assert profile["name"] == "Renamed User"
    assert profile["categories"] == ["Design", "Photography"]
    assert profile["location"] == "Austin, TX"
    assert profile["bio"] == "Freelance baker and weekend photographer."


def test_update_own_profile_partial(client: TestClient):
    headers, user_id = _signup(client, ["seeker"], name="Before Name")
    resp = client.patch(
        f"{API}/users/{user_id}",
        json={"bio": "Only changing the bio right now."},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["bio"] == "Only changing the bio right now."
    assert body["name"] == "Before Name"
    assert body["roles"] == ["seeker"]


def test_update_other_user_forbidden(client: TestClient):
    headers_me, _ = _signup(client, ["seeker"])
    _, other_id = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/users/{other_id}",
        json={"name": "Hijacked Name"},
        headers=headers_me,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"


def test_update_grant_admin_role_forbidden(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/users/{user_id}",
        json={"roles": ["admin"]},
        headers=headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"


def test_update_embedded_admin_role_forbidden(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/users/{user_id}",
        json={"roles": ["seeker", "admin"]},
        headers=headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"


def test_update_user_not_found(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/users/{uuid.uuid4()}",
        json={"name": "Ghost Update"},
        headers=headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "USER_NOT_FOUND"


def test_update_requires_auth(client: TestClient):
    resp = client.patch(
        f"{API}/users/{uuid.uuid4()}", json={"name": "No Token Edit"}
    )
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_update_invalid_category_rejected(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/users/{user_id}",
        json={"categories": ["Not A Real Category"]},
        headers=headers,
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_update_empty_roles_rejected(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/users/{user_id}",
        json={"roles": []},
        headers=headers,
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_update_blank_name_rejected(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/users/{user_id}",
        json={"name": "  "},
        headers=headers,
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_update_explicit_null_name_rejected(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/users/{user_id}",
        json={"name": None},
        headers=headers,
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_update_clears_nullable_fields(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    resp = client.patch(
        f"{API}/users/{user_id}",
        json={"bio": "temporary bio", "location": "Old Town"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    resp = client.patch(
        f"{API}/users/{user_id}",
        json={"bio": None, "location": None, "avatarUrl": None},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["bio"] is None
    assert body["location"] is None
    assert body["avatarUrl"] is None
