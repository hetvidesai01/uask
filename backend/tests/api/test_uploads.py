"""Phase 10 uploads — POST /uploads validation, storage, attachment round-trips."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings

API = "/api/v1"
UPLOAD_KEYS = {"id", "name", "url", "size", "mimeType"}

PNG = b"\x89PNG\r\n\x1a\nIHDR" + b"\x00" * 32
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16
GIF = b"GIF89a" + b"\x00" * 16
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 16
PDF = b"%PDF-1.4\n1 0 obj\n<< >>\nendobj\n"
ZIP = b"PK\x03\x04" + b"\x00" * 16
TEXT = b"plain notes for the ask\n"
CSV = b"item,price\nlogo,500\n"

ACCEPTED = [
    ("photo.png", PNG, "image/png"),
    ("scan.jpg", JPEG, "image/jpeg"),
    ("anim.gif", GIF, "image/gif"),
    ("art.webp", WEBP, "image/webp"),
    ("brief.pdf", PDF, "application/pdf"),
    ("notes.txt", TEXT, "text/plain"),
    ("prices.csv", CSV, "text/csv"),
    ("assets.zip", ZIP, "application/zip"),
    ("report.docx", ZIP, "application/vnd.openxmlformats-"
     "officedocument.wordprocessingml.document"),
]


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Upload Tester"
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


def _upload(
    client: TestClient,
    headers: dict,
    filename: str,
    data: bytes,
    content_type: str,
):
    return client.post(
        f"{API}/uploads",
        files={"file": (filename, data, content_type)},
        headers=headers,
    )


def test_upload_returns_frontend_metadata(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(client, headers, "photo.png", PNG, "image/png")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert set(body) == UPLOAD_KEYS
    uuid.UUID(body["id"])  # parseable id
    assert body["name"] == "photo.png"
    assert body["url"] == f"/media/{body['id']}.png"
    assert body["size"] == len(PNG)
    assert body["mimeType"] == "image/png"


def test_uploaded_file_is_served_from_media(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    url = _upload(client, headers, "photo.png", PNG, "image/png").json()["url"]
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.content == PNG
    assert resp.headers["content-type"].startswith("image/png")


def test_upload_requires_authentication(client: TestClient):
    resp = _upload(client, {}, "photo.png", PNG, "image/png")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_missing_file_field_rejected(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.post(f"{API}/uploads", headers=headers)
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


@pytest.mark.parametrize(("filename", "data", "content_type"), ACCEPTED)
def test_accepted_content_types(
    client: TestClient, filename: str, data: bytes, content_type: str
):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(client, headers, filename, data, content_type)
    assert resp.status_code == 201, resp.text


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("setup.exe", "application/x-msdownload"),
        ("page.html", "text/html"),
        ("icon.svg", "image/svg+xml"),
        ("script.js", "text/javascript"),
        ("photo.png", "application/octet-stream"),
        ("photo.png", ""),
    ],
)
def test_unsupported_content_types_rejected(
    client: TestClient, filename: str, content_type: str
):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(client, headers, filename, PNG, content_type)
    assert resp.status_code == 422
    assert _error_code(resp) == "UNSUPPORTED_FILE_TYPE"


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("notes.pdf", "image/png"),
        ("photo.png", "application/pdf"),
        ("data.zip", "text/plain"),
    ],
)
def test_extension_must_match_declared_type(
    client: TestClient, filename: str, content_type: str
):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(client, headers, filename, PNG, content_type)
    assert resp.status_code == 422
    assert _error_code(resp) == "UNSUPPORTED_FILE_TYPE"


def test_unsafe_binary_content_rejected(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(
        client,
        headers,
        "photo.png",
        b"<html><script>alert(1)</script>",
        "image/png",
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "UNSAFE_FILE"


def test_text_with_null_bytes_rejected(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(client, headers, "notes.txt", b"hi\x00there", "text/plain")
    assert resp.status_code == 422
    assert _error_code(resp) == "UNSAFE_FILE"


def test_empty_file_rejected(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(client, headers, "empty.txt", b"", "text/plain")
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_oversized_file_rejected(client: TestClient, monkeypatch):
    monkeypatch.setattr(get_settings(), "UPLOAD_MAX_MB", 1)
    headers, _ = _signup(client, ["seeker"])
    blob = b"a" * (1024 * 1024 + 1)
    resp = _upload(client, headers, "big.txt", blob, "text/plain")
    assert resp.status_code == 413
    assert _error_code(resp) == "FILE_TOO_LARGE"


def test_traversal_filename_sanitized(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(client, headers, "..\\..\\evil.png", PNG, "image/png")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "evil.png"
    assert ".." not in body["url"]
    assert "/" not in body["name"]


def test_path_prefix_filename_sanitized(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(client, headers, "../../etc/logo.png", PNG, "image/png")
    assert resp.status_code == 201, resp.text
    assert resp.json()["name"] == "logo.png"


def test_long_filename_truncated(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(client, headers, "a" * 300 + ".png", PNG, "image/png")
    assert resp.status_code == 201, resp.text
    name = resp.json()["name"]
    assert len(name) <= 120
    assert name.endswith(".png")


def test_degenerate_filename_rejected(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(client, headers, " .. ", PNG, "image/png")
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_ask_accepts_uploaded_attachment(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    attachment = _upload(
        client, headers, "brief.pdf", PDF, "application/pdf"
    ).json()
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
        "attachments": [attachment],
    }
    resp = client.post(f"{API}/asks", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    ask_id = resp.json()["id"]

    resp = client.get(f"{API}/asks/{ask_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["attachments"] == [attachment]


def test_offer_accepts_uploaded_attachment(client: TestClient):
    seeker_headers, _ = _signup(client, ["seeker"], name="Ask Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Bidder")
    attachment = _upload(
        client,
        provider_headers,
        "portfolio.png",
        PNG,
        "image/png",
    ).json()

    ask_payload = {
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
    resp = client.post(f"{API}/asks", json=ask_payload, headers=seeker_headers)
    assert resp.status_code == 201, resp.text
    ask_id = resp.json()["id"]

    offer_payload = {
        "price": 450,
        "deliveryDays": 5,
        "pitch": "I can deliver this project with two revisions included.",
        "deliverables": ["Source files"],
        "attachments": [attachment],
    }
    resp = client.post(
        f"{API}/asks/{ask_id}/offers",
        json=offer_payload,
        headers=provider_headers,
    )
    assert resp.status_code == 201, resp.text
    offer_id = resp.json()["id"]

    resp = client.get(f"{API}/offers/{offer_id}", headers=provider_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["attachments"] == [attachment]


def test_avatar_uses_uploaded_url(client: TestClient):
    headers, user_id = _signup(client, ["seeker"])
    url = _upload(client, headers, "avatar.png", PNG, "image/png").json()["url"]

    resp = client.patch(
        f"{API}/users/{user_id}",
        json={"avatarUrl": url},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["avatarUrl"] == url

    resp = client.get(f"{API}/users/{user_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["avatarUrl"] == url
