"""Phase 5 auth flow tests — blueprint §11 priority 1."""

from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.security import REFRESH_COOKIE_NAME, hash_refresh_token
from app.models.refresh_token import RefreshToken

API = "/api/v1"


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def test_successful_signup(client: TestClient, signup_payload: dict):
    resp = client.post(f"{API}/auth/signup", json=signup_payload)
    assert resp.status_code == 201
    body = resp.json()
    assert "accessToken" in body
    assert body["user"]["email"] == "test@example.com"
    assert body["user"]["roles"] == ["seeker"]
    assert "passwordHash" not in body["user"]
    assert "password_hash" not in body["user"]
    assert REFRESH_COOKIE_NAME in resp.cookies
    set_cookie = next(
        h for h in resp.headers.get_list("set-cookie") if REFRESH_COOKIE_NAME in h
    )
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie or "SameSite=Lax" in set_cookie


def test_duplicate_email_signup(client: TestClient, signup_payload: dict):
    assert client.post(f"{API}/auth/signup", json=signup_payload).status_code == 201
    resp = client.post(f"{API}/auth/signup", json=signup_payload)
    assert resp.status_code == 409
    assert _error_code(resp) == "EMAIL_TAKEN"
    assert "requestId" in resp.json()["error"]


def test_invalid_signup_weak_password(client: TestClient, signup_payload: dict):
    signup_payload["password"] = "short1"
    resp = client.post(f"{API}/auth/signup", json=signup_payload)
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_invalid_signup_no_digit(client: TestClient, signup_payload: dict):
    signup_payload["password"] = "onlyletters"
    resp = client.post(f"{API}/auth/signup", json=signup_payload)
    assert resp.status_code == 422


def test_invalid_signup_admin_role(client: TestClient, signup_payload: dict):
    signup_payload["roles"] = ["admin"]
    resp = client.post(f"{API}/auth/signup", json=signup_payload)
    assert resp.status_code == 422


def test_invalid_signup_bad_email(client: TestClient, signup_payload: dict):
    signup_payload["email"] = "not-an-email"
    resp = client.post(f"{API}/auth/signup", json=signup_payload)
    assert resp.status_code == 422


def test_signup_both_roles(client: TestClient, both_roles_payload: dict):
    resp = client.post(f"{API}/auth/signup", json=both_roles_payload)
    assert resp.status_code == 201
    assert set(resp.json()["user"]["roles"]) == {"seeker", "provider"}


def test_successful_login(client: TestClient, signup_payload: dict):
    client.post(f"{API}/auth/signup", json=signup_payload)
    resp = client.post(
        f"{API}/auth/login",
        json={"email": signup_payload["email"], "password": signup_payload["password"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "accessToken" in body
    assert body["user"]["email"] == signup_payload["email"]
    assert REFRESH_COOKIE_NAME in resp.cookies


def test_login_wrong_password(client: TestClient, signup_payload: dict):
    client.post(f"{API}/auth/signup", json=signup_payload)
    resp = client.post(
        f"{API}/auth/login",
        json={"email": signup_payload["email"], "password": "wrongpass1"},
    )
    assert resp.status_code == 401
    assert _error_code(resp) == "INVALID_CREDENTIALS"


def test_login_unknown_email(client: TestClient):
    resp = client.post(
        f"{API}/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )
    assert resp.status_code == 401
    assert _error_code(resp) == "INVALID_CREDENTIALS"


def test_protected_route_without_token(client: TestClient):
    resp = client.get(f"{API}/auth/me")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_auth_me(client: TestClient, signup_payload: dict):
    signup = client.post(f"{API}/auth/signup", json=signup_payload)
    token = signup.json()["accessToken"]
    resp = client.get(
        f"{API}/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == signup_payload["email"]
    assert body["name"] == signup_payload["name"]
    assert "passwordHash" not in body
    assert "password_hash" not in body


def test_refresh_success(client: TestClient, signup_payload: dict):
    client.post(f"{API}/auth/signup", json=signup_payload)
    assert REFRESH_COOKIE_NAME in client.cookies
    old_refresh = client.cookies.get(REFRESH_COOKIE_NAME)

    resp = client.post(f"{API}/auth/refresh")
    assert resp.status_code == 200
    assert "accessToken" in resp.json()
    new_refresh = client.cookies.get(REFRESH_COOKIE_NAME)
    assert new_refresh is not None
    assert new_refresh != old_refresh


def test_refresh_rotation_revokes_old_token(
    client: TestClient, signup_payload: dict, db: Session
):
    client.post(f"{API}/auth/signup", json=signup_payload)
    old_refresh = client.cookies.get(REFRESH_COOKIE_NAME)
    assert old_refresh is not None
    old_hash = hash_refresh_token(old_refresh)

    resp = client.post(f"{API}/auth/refresh")
    assert resp.status_code == 200
    assert client.cookies.get(REFRESH_COOKIE_NAME) != old_refresh

    # Old token must be revoked in the DB (rotation, not delete)
    row = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == old_hash)
    )
    assert row is not None
    assert row.revoked_at is not None

    # Presenting the old cookie again → reuse detection
    client.cookies.set(REFRESH_COOKIE_NAME, old_refresh)
    resp = client.post(f"{API}/auth/refresh")
    assert resp.status_code == 401


def test_refresh_expired_token(
    client: TestClient, signup_payload: dict, db: Session
):
    from datetime import UTC, datetime, timedelta

    client.post(f"{API}/auth/signup", json=signup_payload)
    opaque = client.cookies.get(REFRESH_COOKIE_NAME)
    token_hash = hash_refresh_token(opaque)

    db.execute(
        text("UPDATE refresh_tokens SET expires_at = :t WHERE token_hash = :h"),
        {"t": datetime.now(UTC) - timedelta(days=1), "h": token_hash},
    )
    db.commit()

    resp = client.post(f"{API}/auth/refresh")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_refresh_revoked_token(
    client: TestClient, signup_payload: dict, db: Session
):
    from datetime import UTC, datetime

    client.post(f"{API}/auth/signup", json=signup_payload)
    opaque = client.cookies.get(REFRESH_COOKIE_NAME)
    token_hash = hash_refresh_token(opaque)

    db.execute(
        text(
            "UPDATE refresh_tokens SET revoked_at = :t WHERE token_hash = :h"
        ),
        {"t": datetime.now(UTC), "h": token_hash},
    )
    db.commit()

    resp = client.post(f"{API}/auth/refresh")
    assert resp.status_code == 401


def test_reused_refresh_token_detection(
    client: TestClient, signup_payload: dict, db: Session
):
    client.post(f"{API}/auth/signup", json=signup_payload)
    first_refresh = client.cookies.get(REFRESH_COOKIE_NAME)

    # Rotate once — first token becomes revoked
    resp1 = client.post(f"{API}/auth/refresh")
    assert resp1.status_code == 200
    second_refresh = client.cookies.get(REFRESH_COOKIE_NAME)
    assert second_refresh != first_refresh

    # Replaying the first (revoked) token must fail and revoke the family
    client.cookies.set(REFRESH_COOKIE_NAME, first_refresh)
    resp2 = client.post(f"{API}/auth/refresh")
    assert resp2.status_code == 401

    # The still-valid second token must also be dead (family revoked)
    client.cookies.set(REFRESH_COOKIE_NAME, second_refresh)
    resp3 = client.post(f"{API}/auth/refresh")
    assert resp3.status_code == 401


def test_logout_revocation(client: TestClient, signup_payload: dict):
    signup = client.post(f"{API}/auth/signup", json=signup_payload)
    access = signup.json()["accessToken"]
    refresh = client.cookies.get(REFRESH_COOKIE_NAME)
    assert refresh is not None

    resp = client.post(
        f"{API}/auth/logout",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert resp.status_code == 204

    # Cookie cleared
    assert client.cookies.get(REFRESH_COOKIE_NAME) is None

    # Even if client still had the old cookie, refresh must fail
    client.cookies.set(REFRESH_COOKIE_NAME, refresh)
    refresh_resp = client.post(f"{API}/auth/refresh")
    assert refresh_resp.status_code == 401

    # Access token still works until expiry (short-lived JWT is fine)
    me = client.get(
        f"{API}/auth/me",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert me.status_code == 200


def test_refresh_without_cookie(client: TestClient):
    client.cookies.delete(REFRESH_COOKIE_NAME, domain=None, path="/")
    resp = client.post(f"{API}/auth/refresh")
    assert resp.status_code == 401


def test_error_envelope_shape(client: TestClient):
    resp = client.get(f"{API}/auth/me")
    assert resp.status_code == 401
    body = resp.json()
    assert set(body.keys()) == {"error"}
    err = body["error"]
    assert set(err.keys()) == {"code", "message", "details", "requestId"}
    assert err["code"] == "UNAUTHORIZED"
    assert err["requestId"]
