"""Signup legal acceptance — Terms & Privacy required before account creation.

Backend validation is authoritative: the frontend checkbox is UX only.
Acceptance is recorded server-side (UTC timestamp + prototype version) and
is never client-writable.
"""

from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import UserRole
from app.core.security import hash_password
from app.models.user import User

API = "/api/v1"


def _error(resp) -> dict:
    return resp.json()["error"]


def _payload(**overrides) -> dict:
    payload = {
        "name": "Legal User",
        "email": "legal@example.com",
        "password": "password123",
        "roles": ["seeker"],
        "termsAccepted": True,
        "privacyAccepted": True,
    }
    payload.update(overrides)
    return payload


def _db_user(db: Session, email: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    assert user is not None
    return user


# --------------------------------------------------------------------------
# Signup succeeds / fails on the acceptance flags
# --------------------------------------------------------------------------


def test_signup_succeeds_when_both_acceptances_true(
    client: TestClient, signup_payload: dict
):
    resp = client.post(f"{API}/auth/signup", json=signup_payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()["user"]
    assert body["termsAccepted"] is True
    assert body["privacyAccepted"] is True


def test_signup_fails_when_terms_not_accepted(client: TestClient):
    resp = client.post(
        f"{API}/auth/signup", json=_payload(termsAccepted=False)
    )
    assert resp.status_code == 422
    err = _error(resp)
    assert err["code"] == "VALIDATION_ERROR"
    assert err["message"] == (
        "Terms and Privacy Policy must be accepted to create an account."
    )


def test_signup_fails_when_privacy_not_accepted(client: TestClient):
    resp = client.post(
        f"{API}/auth/signup", json=_payload(privacyAccepted=False)
    )
    assert resp.status_code == 422
    assert _error(resp)["code"] == "VALIDATION_ERROR"
    assert "Terms and Privacy Policy" in _error(resp)["message"]


def test_signup_fails_when_acceptance_fields_missing(client: TestClient):
    payload = _payload()
    del payload["termsAccepted"]
    del payload["privacyAccepted"]
    resp = client.post(f"{API}/auth/signup", json=payload)
    assert resp.status_code == 422
    assert _error(resp)["code"] == "VALIDATION_ERROR"


def test_signup_fails_when_neither_accepted(client: TestClient):
    resp = client.post(
        f"{API}/auth/signup",
        json=_payload(termsAccepted=False, privacyAccepted=False),
    )
    assert resp.status_code == 422
    assert _error(resp)["code"] == "VALIDATION_ERROR"


def test_rejected_signup_creates_no_user(client: TestClient, db: Session):
    resp = client.post(
        f"{API}/auth/signup", json=_payload(termsAccepted=False)
    )
    assert resp.status_code == 422
    assert db.scalar(select(User).where(User.email == "legal@example.com")) is None


# --------------------------------------------------------------------------
# Audit record: server-side timestamps + configured versions
# --------------------------------------------------------------------------


def test_acceptance_timestamps_generated_server_side(
    client: TestClient, db: Session
):
    before = datetime.now(UTC)
    resp = client.post(f"{API}/auth/signup", json=_payload())
    after = datetime.now(UTC)
    assert resp.status_code == 201

    user = _db_user(db, "legal@example.com")
    assert user.terms_accepted_at is not None
    assert user.privacy_accepted_at is not None
    # Mixed-tz aware datetimes compare correctly; psycopg returns the
    # TIMESTAMPTZ tz-aware (in the DB session timezone), never naive.
    for ts in (user.terms_accepted_at, user.privacy_accepted_at):
        assert ts.tzinfo is not None
        assert before <= ts <= after


def test_client_supplied_timestamps_are_ignored(client: TestClient, db: Session):
    # The frontend must never be able to forge the acceptance moment.
    resp = client.post(
        f"{API}/auth/signup",
        json=_payload(
            termsAcceptedAt="2000-01-01T00:00:00Z",
            privacyAcceptedAt="2000-01-01T00:00:00Z",
        ),
    )
    assert resp.status_code == 201

    user = _db_user(db, "legal@example.com")
    assert user.terms_accepted_at is not None
    assert user.terms_accepted_at.year >= 2026
    assert user.privacy_accepted_at is not None
    assert user.privacy_accepted_at.year >= 2026


def test_correct_versions_stored(client: TestClient, db: Session):
    settings = get_settings()
    resp = client.post(f"{API}/auth/signup", json=_payload())
    assert resp.status_code == 201

    user = _db_user(db, "legal@example.com")
    assert user.terms_version == settings.TERMS_VERSION == "demo-2026-10"
    assert user.privacy_version == settings.PRIVACY_VERSION == "demo-2026-10"

    body = resp.json()["user"]
    assert body["termsVersion"] == "demo-2026-10"
    assert body["privacyVersion"] == "demo-2026-10"


def test_client_supplied_versions_are_ignored(client: TestClient, db: Session):
    resp = client.post(
        f"{API}/auth/signup",
        json=_payload(termsVersion="hacked-1.0", privacyVersion="hacked-1.0"),
    )
    assert resp.status_code == 201

    user = _db_user(db, "legal@example.com")
    assert user.terms_version == "demo-2026-10"
    assert user.privacy_version == "demo-2026-10"


# --------------------------------------------------------------------------
# camelCase serialization — safe status only
# --------------------------------------------------------------------------


def test_signup_response_serializes_acceptance_camel_case(
    client: TestClient, signup_payload: dict
):
    resp = client.post(f"{API}/auth/signup", json=signup_payload)
    body = resp.json()["user"]
    assert body["termsAccepted"] is True
    assert body["termsVersion"] == "demo-2026-10"
    assert body["privacyAccepted"] is True
    assert body["privacyVersion"] == "demo-2026-10"
    # snake_case must never appear on the wire
    assert "terms_accepted" not in body
    assert "privacy_accepted" not in body
    # audit timestamps stay server-side
    assert "termsAcceptedAt" not in body
    assert "privacyAcceptedAt" not in body


def test_me_exposes_acceptance_status(
    client: TestClient, signup_payload: dict
):
    signup = client.post(f"{API}/auth/signup", json=signup_payload)
    token = signup.json()["accessToken"]
    resp = client.get(
        f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["termsAccepted"] is True
    assert body["termsVersion"] == "demo-2026-10"
    assert body["privacyAccepted"] is True
    assert body["privacyVersion"] == "demo-2026-10"
    assert "termsAcceptedAt" not in body


def test_public_profile_hides_acceptance_metadata(
    client: TestClient, signup_payload: dict
):
    signup = client.post(f"{API}/auth/signup", json=signup_payload)
    token = signup.json()["accessToken"]
    user_id = signup.json()["user"]["id"]
    resp = client.get(
        f"{API}/users/{user_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "termsAccepted",
        "termsVersion",
        "privacyAccepted",
        "privacyVersion",
    ):
        assert key not in body


# --------------------------------------------------------------------------
# Acceptance is system-managed — not writable via profile update
# --------------------------------------------------------------------------


def test_acceptance_cannot_be_changed_via_profile_patch(
    client: TestClient, db: Session
):
    signup = client.post(f"{API}/auth/signup", json=_payload())
    token = signup.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    user_id = signup.json()["user"]["id"]

    resp = client.patch(
        f"{API}/users/{user_id}",
        headers=headers,
        json={
            "termsAccepted": False,
            "privacyAccepted": False,
            "termsVersion": "hacked-1.0",
            "privacyVersion": "hacked-1.0",
            "termsAcceptedAt": "2000-01-01T00:00:00Z",
            "privacyAcceptedAt": "2000-01-01T00:00:00Z",
        },
    )
    assert resp.status_code == 200, resp.text

    user = _db_user(db, "legal@example.com")
    assert user.terms_version == "demo-2026-10"
    assert user.privacy_version == "demo-2026-10"
    assert user.terms_accepted_at is not None
    assert user.terms_accepted_at.year >= 2026

    me = client.get(f"{API}/auth/me", headers=headers)
    assert me.json()["termsAccepted"] is True
    assert me.json()["termsVersion"] == "demo-2026-10"


# --------------------------------------------------------------------------
# Pre-existing users (created before this phase) migrate safely
# --------------------------------------------------------------------------


def test_existing_user_without_acceptance_still_works(
    client: TestClient, db: Session
):
    """Rows created before the migration have NULL acceptance columns.

    They must remain able to log in and use the API — acceptance is
    recorded going forward, never back-filled or forced.
    """
    now = datetime.now(UTC)
    legacy = User(
        name="Legacy User",
        email="legacy@example.com",
        password_hash=hash_password("password123"),
        roles=[UserRole.seeker],
        joined_at=now,
        updated_at=now,
        # terms_accepted_at / privacy_accepted_at intentionally left NULL
    )
    db.add(legacy)
    db.commit()

    resp = client.post(
        f"{API}/auth/login",
        json={"email": "legacy@example.com", "password": "password123"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()["user"]
    assert body["termsAccepted"] is False
    assert body["privacyAccepted"] is False
    assert body["termsVersion"] is None
    assert body["privacyVersion"] is None

    token = resp.json()["accessToken"]
    me = client.get(
        f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    assert me.json()["termsAccepted"] is False
