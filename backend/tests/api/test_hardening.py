"""Phase 7 hardening — CORS, error envelopes, secret hygiene, prod surface."""

import asyncio
import json
import logging
import os
import subprocess
import sys
import uuid
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from starlette.requests import Request

from app import main as app_main
from app.core.config import get_settings
from app.core.exceptions import NotFoundError, RateLimitError
from app.main import (
    app_error_handler,
    database_error_handler,
    unhandled_exception_handler,
)

API = "/api/v1"


def _request(path: str = f"{API}/boom", *, request_id: str = "req-123") -> Request:
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "root_path": "",
            "headers": [],
            "client": ("127.0.0.1", 40000),
            "server": ("testserver", 80),
            "state": {"request_id": request_id},
        }
    )


def _body(response) -> dict:
    return json.loads(response.body)


def _log_blob(caplog) -> str:
    """Every captured record — message, extras and args, nothing hidden."""
    return "\n".join(
        " ".join(f"{key}={value!r}" for key, value in record.__dict__.items())
        for record in caplog.records
    )


# --------------------------------------------------------------------------
# CORS
# --------------------------------------------------------------------------


def test_cors_allows_configured_frontend_origin(client: TestClient):
    resp = client.get(
        f"{API}/health", headers={"Origin": "http://localhost:5173"}
    )
    assert (
        resp.headers["access-control-allow-origin"]
        == "http://localhost:5173"
    )
    assert resp.headers["access-control-allow-credentials"] == "true"


def test_cors_never_allows_unknown_origin(client: TestClient):
    resp = client.get(
        f"{API}/health", headers={"Origin": "https://evil.example"}
    )
    assert "access-control-allow-origin" not in resp.headers


def test_cors_origins_are_never_wildcard_with_credentials():
    origins = get_settings().cors_origins_list
    assert "*" not in origins
    assert origins  # local dev origin is present by default


# --------------------------------------------------------------------------
# Error envelopes
# --------------------------------------------------------------------------


def test_unhandled_error_returns_generic_envelope():
    exc = RuntimeError("boom with SECRET-DETAIL")
    resp = asyncio.run(unhandled_exception_handler(_request(), exc))
    assert resp.status_code == 500
    body = _body(resp)
    assert set(body["error"]) == {"code", "message", "details", "requestId"}
    assert body["error"]["code"] == "INTERNAL_ERROR"
    assert body["error"]["details"] is None
    assert body["error"]["requestId"] == "req-123"
    text = resp.body.decode()
    assert "SECRET-DETAIL" not in text
    assert "Traceback" not in text
    assert "RuntimeError" not in text


def test_database_error_returns_generic_envelope():
    exc = OperationalError(
        "SELECT 1",
        {},
        Exception("connection refused postgres://user:hunter2@db:5432"),
    )
    resp = asyncio.run(database_error_handler(_request(), exc))
    assert resp.status_code == 500
    body = _body(resp)
    assert body["error"]["code"] == "INTERNAL_ERROR"
    text = resp.body.decode()
    assert "hunter2" not in text
    assert "Traceback" not in text


def test_rate_limit_error_sets_retry_after_header():
    resp = asyncio.run(
        app_error_handler(_request(), RateLimitError(retry_after=7))
    )
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "7"
    assert _body(resp)["error"]["code"] == "RATE_LIMITED"


def test_not_found_keeps_frontend_contract_shape():
    resp = asyncio.run(
        app_error_handler(
            _request(), NotFoundError("Ask not found.", code="ASK_NOT_FOUND")
        )
    )
    assert resp.status_code == 404
    error = _body(resp)["error"]
    assert error["code"] == "ASK_NOT_FOUND"
    assert error["message"] == "Ask not found."
    assert error["requestId"] == "req-123"


def test_validation_errors_do_not_echo_input_values(client: TestClient):
    payload = {
        "name": "Echo Tester",
        "email": "echo@example.com",
        "password": "Ab1$",
        "roles": ["seeker"],
    }
    resp = client.post(f"{API}/auth/signup", json=payload)
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "Ab1$" not in resp.text


# --------------------------------------------------------------------------
# Secrets never reach the logs
# --------------------------------------------------------------------------


def test_failed_login_never_logs_credentials(client: TestClient, caplog):
    password = "S3cretLoginPass!"
    with caplog.at_level(logging.DEBUG):
        resp = client.post(
            f"{API}/auth/login",
            json={"email": "ghost@example.com", "password": password},
        )
    assert resp.status_code == 401
    blob = _log_blob(caplog)
    assert password not in blob
    assert get_settings().JWT_SECRET not in blob


def test_signup_never_logs_password_tokens_or_secrets(
    client: TestClient, caplog
):
    password = "S3cretSignupPass1"
    with caplog.at_level(logging.DEBUG):
        resp = client.post(
            f"{API}/auth/signup",
            json={
                "name": "Log Checker",
                "email": "logchecker@example.com",
                "password": password,
                "roles": ["seeker"],
            },
        )
    assert resp.status_code == 201, resp.text
    access_token = resp.json()["accessToken"]
    refresh_token = client.cookies.get("refresh_token")
    blob = _log_blob(caplog)
    assert password not in blob
    assert access_token not in blob
    assert refresh_token
    assert refresh_token not in blob
    assert get_settings().JWT_SECRET not in blob


def test_auth_failures_are_logged_with_request_context(
    client: TestClient, caplog
):
    with caplog.at_level(logging.WARNING):
        client.post(
            f"{API}/auth/login",
            json={"email": "ghost@example.com", "password": "Nope12345"},
        )
    events = [
        record
        for record in caplog.records
        if getattr(record, "event", None) == "authz_failure"
    ]
    assert events, "401 responses must leave an audit trail"
    assert events[0].code == "INVALID_CREDENTIALS"
    assert events[0].status == 401
    assert events[0].request_id
    assert "Nope12345" not in _log_blob(caplog)


def test_request_logs_carry_no_headers_or_bodies(
    client: TestClient, caplog
):
    with caplog.at_level(logging.INFO):
        client.post(
            f"{API}/auth/login",
            json={"email": "ghost@example.com", "password": "Nope12345"},
        )
    access = [
        record
        for record in caplog.records
        if getattr(record, "event", None) == "http_request"
    ]
    assert access
    for record in access:
        assert set(record.__dict__) >= {"method", "path", "status", "request_id"}
        assert "authorization" not in _log_blob(caplog).lower()


# --------------------------------------------------------------------------
# Production surface
# --------------------------------------------------------------------------


def test_development_exposes_api_docs(client: TestClient):
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_well_formed_request_id_is_echoed_back(client: TestClient):
    resp = client.get(
        f"{API}/health", headers={"X-Request-ID": "client-trace-42"}
    )
    assert resp.headers["X-Request-ID"] == "client-trace-42"


def test_malicious_request_id_is_replaced(client: TestClient):
    """Only our id format reaches the logs; anything else is regenerated."""
    supplied = "bad id! [FAKE] injected=1"
    resp = client.get(f"{API}/health", headers={"X-Request-ID": supplied})
    echoed = resp.headers["X-Request-ID"]
    assert echoed != supplied
    uuid.UUID(echoed)  # regenerated as a well-formed id


def test_production_app_hides_interactive_docs():
    backend = Path(app_main.__file__).resolve().parents[1]
    env = {
        **os.environ,
        "ENV": "production",
        "JWT_SECRET": "p" * 48,
        "LOG_LEVEL": "WARNING",
    }
    script = (
        "from app.main import app; "
        "print(app.docs_url, app.redoc_url, app.openapi_url)"
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=backend,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "None None None"
