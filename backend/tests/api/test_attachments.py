"""Phase 6 attachments — entity authorization, persistence, deletion."""

import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.exceptions import StorageError
from app.models.attachment import Attachment
from app.services import upload_service
from app.storage import get_storage

API = "/api/v1"
ATTACHMENT_KEYS = {"id", "name", "url", "size", "mimeType"}

PNG = b"\x89PNG\r\n\x1a\nIHDR" + b"\x00" * 32
PDF = b"%PDF-1.4\n1 0 obj\n<< >>\nendobj\n"


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Attachment Tester"
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
    filename: str = "photo.png",
    data: bytes = PNG,
    content_type: str = "image/png",
    *,
    entity_type: str | None = None,
    entity_id: str | None = None,
):
    form = {}
    if entity_type is not None:
        form["entityType"] = entity_type
    if entity_id is not None:
        form["entityId"] = str(entity_id)
    return client.post(
        f"{API}/uploads",
        files={"file": (filename, data, content_type)},
        data=form,
        headers=headers,
    )


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


def _accepted_thread(client: TestClient) -> dict:
    """Owner + provider with one accepted offer and a live thread."""
    owner_headers, owner_id = _signup(client, ["seeker"], name="Ask Owner")
    provider_headers, provider_id = _signup(
        client, ["provider"], name="Winning Provider"
    )
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    resp = client.patch(
        f"{API}/offers/{offer['id']}",
        json={"status": "accepted"},
        headers=owner_headers,
    )
    assert resp.status_code == 200, resp.text
    items = client.get(f"{API}/threads", headers=owner_headers).json()["items"]
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


class _SpyStorage:
    """Wraps the real backend and records every key it is asked to touch."""

    def __init__(self, inner, *, fail_delete: bool = False) -> None:
        self.inner = inner
        self.fail_delete = fail_delete
        self.saved: list[str] = []
        self.deleted: list[str] = []

    def save(self, data: bytes, *, key: str, content_type: str):
        self.saved.append(key)
        return self.inner.save(data, key=key, content_type=content_type)

    def delete(self, key: str) -> None:
        self.deleted.append(key)
        if self.fail_delete:
            raise StorageError("storage is down")
        self.inner.delete(key)

    def get_public_url(self, key: str) -> str:
        return self.inner.get_public_url(key)


@pytest.fixture()
def spy_storage(monkeypatch) -> _SpyStorage:
    spy = _SpyStorage(get_storage())
    monkeypatch.setattr(upload_service, "get_storage", lambda: spy)
    return spy


# --------------------------------------------------------------------------
# Attachment record
# --------------------------------------------------------------------------


def test_upload_creates_attachment_record(
    client: TestClient, db: Session
):
    headers, user_id = _signup(client, ["seeker"])
    ask = _create_ask(client, headers)
    resp = _upload(
        client, headers, "brief.pdf", PDF, "application/pdf",
        entity_type="ask", entity_id=ask["id"],
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert set(body) == ATTACHMENT_KEYS

    row = db.get(Attachment, uuid.UUID(body["id"]))
    assert row is not None
    assert row.owner_id == uuid.UUID(user_id)
    assert row.entity_type == "ask"
    assert row.entity_id == uuid.UUID(ask["id"])
    assert row.file_name == "brief.pdf"
    assert row.content_type == "application/pdf"
    assert row.size_bytes == len(PDF)
    assert row.storage_key == f"{body['id']}.pdf"
    assert row.url == body["url"]


def test_unbound_upload_creates_row_without_entity(
    client: TestClient, db: Session
):
    headers, user_id = _signup(client, ["seeker"])
    body = _upload(client, headers).json()
    row = db.get(Attachment, uuid.UUID(body["id"]))
    assert row is not None
    assert row.owner_id == uuid.UUID(user_id)
    assert row.entity_type is None
    assert row.entity_id is None


# --------------------------------------------------------------------------
# Entity authorization — ask
# --------------------------------------------------------------------------


def test_ask_owner_can_bind_upload(client: TestClient, db: Session):
    headers, _ = _signup(client, ["seeker"])
    ask = _create_ask(client, headers)
    resp = _upload(
        client, headers, entity_type="ask", entity_id=ask["id"]
    )
    assert resp.status_code == 201, resp.text
    row = db.get(Attachment, uuid.UUID(resp.json()["id"]))
    assert row.entity_type == "ask"
    assert row.entity_id == uuid.UUID(ask["id"])


def test_non_owner_cannot_bind_upload_to_ask(
    client: TestClient, db: Session
):
    owner_headers, _ = _signup(client, ["seeker"], name="Owner")
    stranger_headers, _ = _signup(client, ["provider"], name="Stranger")
    ask = _create_ask(client, owner_headers)
    resp = _upload(
        client, stranger_headers, entity_type="ask", entity_id=ask["id"]
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_ASK_OWNER"
    assert db.query(Attachment).count() == 0


def test_unknown_ask_is_404(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(
        client, headers, entity_type="ask", entity_id=uuid.uuid4()
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "ASK_NOT_FOUND"


# --------------------------------------------------------------------------
# Entity authorization — offer
# --------------------------------------------------------------------------


def test_provider_can_bind_upload_to_own_offer(
    client: TestClient, db: Session
):
    owner_headers, _ = _signup(client, ["seeker"], name="Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Provider")
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    resp = _upload(
        client,
        provider_headers,
        entity_type="offer",
        entity_id=offer["id"],
    )
    assert resp.status_code == 201, resp.text
    row = db.get(Attachment, uuid.UUID(resp.json()["id"]))
    assert row.entity_type == "offer"
    assert row.entity_id == uuid.UUID(offer["id"])


def test_ask_owner_cannot_bind_upload_to_others_offer(
    client: TestClient, db: Session
):
    owner_headers, _ = _signup(client, ["seeker"], name="Owner")
    provider_headers, _ = _signup(client, ["provider"], name="Provider")
    ask = _create_ask(client, owner_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    resp = _upload(
        client,
        owner_headers,
        entity_type="offer",
        entity_id=offer["id"],
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"
    assert db.query(Attachment).count() == 0


def test_unknown_offer_is_404(client: TestClient):
    headers, _ = _signup(client, ["provider"])
    resp = _upload(
        client, headers, entity_type="offer", entity_id=uuid.uuid4()
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "OFFER_NOT_FOUND"


# --------------------------------------------------------------------------
# Entity authorization — message (thread)
# --------------------------------------------------------------------------


def test_thread_participant_can_bind_upload(
    client: TestClient, db: Session
):
    ctx = _accepted_thread(client)
    resp = _upload(
        client,
        ctx["provider_headers"],
        "sketch.png",
        entity_type="message",
        entity_id=ctx["thread"]["id"],
    )
    assert resp.status_code == 201, resp.text
    row = db.get(Attachment, uuid.UUID(resp.json()["id"]))
    assert row.entity_type == "message"
    assert row.entity_id == uuid.UUID(ctx["thread"]["id"])


def test_non_participant_cannot_bind_upload_to_thread(
    client: TestClient, db: Session
):
    ctx = _accepted_thread(client)
    outsider_headers, _ = _signup(client, ["seeker"], name="Outsider")
    resp = _upload(
        client,
        outsider_headers,
        entity_type="message",
        entity_id=ctx["thread"]["id"],
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"
    assert db.query(Attachment).count() == 0


def test_unknown_thread_is_404(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(
        client, headers, entity_type="message", entity_id=uuid.uuid4()
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "THREAD_NOT_FOUND"


# --------------------------------------------------------------------------
# entityType / entityId pairing and values
# --------------------------------------------------------------------------


def test_entity_type_and_id_must_travel_together(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    ask_id = str(uuid.uuid4())
    resp = _upload(client, headers, entity_type="ask")
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"

    resp = _upload(client, headers, entity_id=ask_id)
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_unknown_entity_type_rejected(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(
        client, headers, entity_type="avatar", entity_id=uuid.uuid4()
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_non_uuid_entity_id_rejected(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = _upload(client, headers, entity_type="ask", entity_id="not-a-uuid")
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"


def test_entity_type_is_case_insensitive(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    ask = _create_ask(client, headers)
    resp = _upload(
        client, headers, entity_type="AsK", entity_id=ask["id"]
    )
    assert resp.status_code == 201, resp.text


def test_bound_upload_requires_authentication(client: TestClient):
    resp = client.post(
        f"{API}/uploads",
        files={"file": ("photo.png", PNG, "image/png")},
        data={"entityType": "ask", "entityId": str(uuid.uuid4())},
    )
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


# --------------------------------------------------------------------------
# Storage interaction
# --------------------------------------------------------------------------


def test_storage_receives_unique_uuid_keys(
    client: TestClient, db: Session, spy_storage: _SpyStorage
):
    headers, _ = _signup(client, ["seeker"])
    first = _upload(client, headers, "photo.png").json()
    second = _upload(client, headers, "photo.png").json()
    assert len(spy_storage.saved) == 2
    first_key, second_key = spy_storage.saved
    assert first_key != second_key
    assert first_key == f"{first['id']}.png"
    assert second_key == f"{second['id']}.png"
    for key in spy_storage.saved:
        uuid.UUID(key.removesuffix(".png"))  # generated, not client input
        assert "photo" not in key


def test_failed_database_write_removes_stored_object(
    client: TestClient, monkeypatch
):
    class _FailingRepo:
        def __init__(self, session) -> None:
            self.session = session

        def add(self, row):
            raise RuntimeError("database write failed")

    monkeypatch.setattr(upload_service, "AttachmentRepository", _FailingRepo)
    headers, _ = _signup(client, ["seeker"])
    with pytest.raises(RuntimeError):
        _upload(client, headers, "photo.png")


# --------------------------------------------------------------------------
# DELETE /uploads/{id}
# --------------------------------------------------------------------------


def _upload_row(
    client: TestClient, headers: dict, db: Session, **kwargs
) -> tuple[str, Attachment]:
    body = _upload(client, headers, **kwargs).json()
    row = db.get(Attachment, uuid.UUID(body["id"]))
    assert row is not None
    return body["id"], row


def test_owner_delete_removes_row_and_file(
    client: TestClient, db: Session, spy_storage: _SpyStorage
):
    headers, _ = _signup(client, ["seeker"])
    upload_id, _row = _upload_row(client, headers, db)
    stored_path = Path(os.environ["UPLOAD_DIR"]) / spy_storage.saved[0]
    assert stored_path.exists()

    resp = client.delete(f"{API}/uploads/{upload_id}", headers=headers)
    assert resp.status_code == 204, resp.text
    assert resp.content == b""
    assert db.get(Attachment, uuid.UUID(upload_id)) is None
    assert not stored_path.exists()
    assert spy_storage.deleted == spy_storage.saved


def test_delete_is_forbidden_for_other_users(
    client: TestClient, db: Session
):
    headers, _ = _signup(client, ["seeker"], name="Uploader")
    other_headers, _ = _signup(client, ["seeker"], name="Other")
    upload_id, _row = _upload_row(client, headers, db)

    resp = client.delete(
        f"{API}/uploads/{upload_id}", headers=other_headers
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "FORBIDDEN"
    assert db.get(Attachment, uuid.UUID(upload_id)) is not None


def test_delete_unknown_upload_is_404(client: TestClient):
    headers, _ = _signup(client, ["seeker"])
    resp = client.delete(f"{API}/uploads/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404
    assert _error_code(resp) == "UPLOAD_NOT_FOUND"


def test_delete_requires_authentication(client: TestClient, db: Session):
    headers, _ = _signup(client, ["seeker"])
    upload_id, _row = _upload_row(client, headers, db)

    resp = client.delete(f"{API}/uploads/{upload_id}")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"
    assert db.get(Attachment, uuid.UUID(upload_id)) is not None


def test_storage_delete_failure_returns_502_and_keeps_row(
    client: TestClient, db: Session, monkeypatch
):
    headers, _ = _signup(client, ["seeker"])
    upload_id, _row = _upload_row(client, headers, db)
    failing = _SpyStorage(get_storage(), fail_delete=True)
    monkeypatch.setattr(upload_service, "get_storage", lambda: failing)

    resp = client.delete(f"{API}/uploads/{upload_id}", headers=headers)
    assert resp.status_code == 502
    assert _error_code(resp) == "STORAGE_ERROR"
    assert failing.deleted == [f"{upload_id}.png"]
    assert db.get(Attachment, uuid.UUID(upload_id)) is not None
