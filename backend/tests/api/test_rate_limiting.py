"""Phase 7 rate limiting — configurable fixed windows, opt-in in tests."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.ratelimit import reset_rate_limits

API = "/api/v1"
PNG = b"\x89PNG\r\n\x1a\nIHDR" + b"\x00" * 32
BAD_CREDENTIALS = {"email": "nobody@example.com", "password": "wrong-pass1"}


def _enable(monkeypatch, **overrides) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    for key, value in overrides.items():
        monkeypatch.setattr(settings, key, value)
    reset_rate_limits()


def _signup(client: TestClient, *, name: str = "Limiter") -> dict:
    resp = client.post(
        f"{API}/auth/signup",
        json={
            "name": name,
            "email": f"{uuid.uuid4().hex[:12]}@example.com",
            "password": "password123",
            "roles": ["seeker"],
        },
    )
    assert resp.status_code == 201, resp.text
    return {"Authorization": f"Bearer {resp.json()['accessToken']}"}


def test_login_bucket_blocks_after_configured_limit(
    client: TestClient, monkeypatch
):
    _enable(
        monkeypatch,
        RATE_LIMIT_LOGIN_MAX=3,
        RATE_LIMIT_LOGIN_WINDOW_SECONDS=60,
    )
    for _ in range(3):
        resp = client.post(f"{API}/auth/login", json=BAD_CREDENTIALS)
        assert resp.status_code == 401, resp.text

    resp = client.post(f"{API}/auth/login", json=BAD_CREDENTIALS)
    assert resp.status_code == 429, resp.text
    error = resp.json()["error"]
    assert error["code"] == "RATE_LIMITED"
    assert error["message"]
    assert error["requestId"]
    assert int(resp.headers["Retry-After"]) >= 1


def test_signup_bucket_is_separate_from_login(
    client: TestClient, monkeypatch
):
    _enable(
        monkeypatch,
        RATE_LIMIT_SIGNUP_MAX=1,
        RATE_LIMIT_LOGIN_MAX=50,
        RATE_LIMIT_SIGNUP_WINDOW_SECONDS=60,
    )
    payload = {
        "name": "Signup Limit",
        "email": f"{uuid.uuid4().hex[:12]}@example.com",
        "password": "password123",
        "roles": ["seeker"],
    }
    assert client.post(f"{API}/auth/signup", json=payload).status_code == 201
    resp = client.post(f"{API}/auth/signup", json=payload)
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "RATE_LIMITED"
    # login still allowed: different bucket
    login = {"email": payload["email"], "password": "password123"}
    assert client.post(f"{API}/auth/login", json=login).status_code == 200


def test_refresh_bucket_blocks_stale_cookie_spam(
    client: TestClient, monkeypatch
):
    _enable(
        monkeypatch,
        RATE_LIMIT_REFRESH_MAX=2,
        RATE_LIMIT_REFRESH_WINDOW_SECONDS=60,
    )
    for _ in range(2):
        assert client.post(f"{API}/auth/refresh").status_code == 401
    resp = client.post(f"{API}/auth/refresh")
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "RATE_LIMITED"


def test_upload_bucket_counts_per_user(
    client: TestClient, monkeypatch
):
    _enable(
        monkeypatch,
        RATE_LIMIT_UPLOAD_MAX=1,
        RATE_LIMIT_UPLOAD_WINDOW_SECONDS=60,
    )
    first = _signup(client, name="Uploader A")
    second = _signup(client, name="Uploader B")

    def upload(headers: dict):
        return client.post(
            f"{API}/uploads",
            files={"file": ("photo.png", PNG, "image/png")},
            headers=headers,
        )

    assert upload(first).status_code == 201
    assert upload(first).status_code == 429
    # a different user has their own bucket
    assert upload(second).status_code == 201


def test_message_bucket_blocks_bursts(client: TestClient, monkeypatch):
    _enable(
        monkeypatch,
        RATE_LIMIT_MESSAGE_MAX=2,
        RATE_LIMIT_MESSAGE_WINDOW_SECONDS=60,
    )
    headers = _signup(client)
    payload = {"body": "Hello, is this still available?"}
    unknown_thread = str(uuid.uuid4())

    def send():
        return client.post(
            f"{API}/threads/{unknown_thread}/messages",
            json=payload,
            headers=headers,
        )

    assert send().status_code == 404  # counted, then handled normally
    assert send().status_code == 404
    resp = send()
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "RATE_LIMITED"


def test_limits_are_disabled_by_default_in_the_suite(
    client: TestClient,
):
    """conftest turns limits off — a shared suite must never see a 429."""
    statuses = {
        client.post(f"{API}/auth/login", json=BAD_CREDENTIALS).status_code
        for _ in range(15)
    }
    assert 429 not in statuses
    assert statuses == {401}
