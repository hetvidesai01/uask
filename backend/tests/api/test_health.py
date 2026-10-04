"""Phase 7 probes — liveness (`/health`) and readiness (`/ready`)."""

from fastapi.testclient import TestClient

from app.api.v1.routes import health as health_module

API = "/api/v1"


def test_health_reports_ok_without_auth(client: TestClient):
    resp = client.get(f"{API}/health")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "ok", "version": "0.1.0"}


def test_health_does_not_touch_dependencies(client: TestClient, monkeypatch):
    """Liveness must stay green even when the database is down."""
    monkeypatch.setattr(health_module, "_database_check", lambda db: "error")
    monkeypatch.setattr(health_module, "_storage_check", lambda: "error")
    resp = client.get(f"{API}/health")
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "ok"


def test_ready_reports_all_dependencies(client: TestClient):
    resp = client.get(f"{API}/ready")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ready"
    assert body["version"] == "0.1.0"
    assert body["checks"]["database"] == "ok"
    assert body["checks"]["storage"] == "ok"


def test_ready_returns_503_when_database_unavailable(
    client: TestClient, monkeypatch
):
    monkeypatch.setattr(health_module, "_database_check", lambda db: "error")
    resp = client.get(f"{API}/ready")
    assert resp.status_code == 503, resp.text
    body = resp.json()
    assert body["status"] == "unavailable"
    assert body["checks"] == {"database": "error", "storage": "ok"}


def test_ready_returns_503_when_storage_is_misconfigured(
    client: TestClient, monkeypatch
):
    monkeypatch.setattr(health_module, "_storage_check", lambda: "error")
    resp = client.get(f"{API}/ready")
    assert resp.status_code == 503, resp.text
    assert resp.json()["checks"]["database"] == "ok"


def test_ready_never_leaks_connection_details(
    client: TestClient, monkeypatch
):
    monkeypatch.setattr(health_module, "_database_check", lambda db: "error")
    resp = client.get(f"{API}/ready")
    assert "postgresql" not in resp.text
    assert "Traceback" not in resp.text
    assert "psycopg" not in resp.text


def test_probes_require_no_authentication(client: TestClient):
    assert client.get(f"{API}/health").status_code == 200
    assert client.get(f"{API}/ready").status_code == 200
