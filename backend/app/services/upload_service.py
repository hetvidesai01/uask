"""Upload rules: allowlist, size limit, safe names, entity authz, storage.

The row lifecycle is one transaction: authorize first, write to storage,
then commit the ``attachments`` row — a failed commit best-effort removes
the stored object so no orphans are left behind.
"""

import re
from pathlib import PurePosixPath
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import (
    ForbiddenError,
    NotFoundError,
    PayloadTooLargeError,
    ValidationError,
)
from app.models.attachment import Attachment
from app.models.user import User
from app.repositories import ask_repo, offer_repo
from app.repositories.attachment_repo import AttachmentRepository
from app.schemas.common import AttachmentRef
from app.services import thread_service
from app.storage import get_storage

_MAX_NAME_LENGTH = 120
_SNIFF_HEAD = 8192
_ENTITY_TYPES = frozenset({"ask", "offer", "message"})

# mime type -> extensions accepted for it (strict allowlist)
_ALLOWLIST: dict[str, frozenset[str]] = {
    "image/png": frozenset({".png"}),
    "image/jpeg": frozenset({".jpg", ".jpeg"}),
    "image/webp": frozenset({".webp"}),
    "application/pdf": frozenset({".pdf"}),
}


def ensure_within_limit(size: int) -> None:
    settings = get_settings()
    if size > settings.upload_max_bytes:
        raise PayloadTooLargeError(
            f"File exceeds the {settings.UPLOAD_MAX_MB} MB limit."
        )


def sanitize_filename(raw: str | None) -> str:
    """Reduce a client-supplied path to a safe, displayable basename."""
    if not raw or not raw.strip():
        raise ValidationError("A file name is required.")
    name = raw.replace("\\", "/").rsplit("/", 1)[-1]
    name = "".join(ch for ch in name if ch.isprintable())
    name = re.sub(r"\s+", " ", name).strip(" .")
    if not name:
        raise ValidationError("Invalid file name.")
    if len(name) > _MAX_NAME_LENGTH:
        stem, dot, ext = name.rpartition(".")
        if dot and stem and 0 < len(ext) <= 10:
            budget = _MAX_NAME_LENGTH - len(ext) - 1
            name = f"{stem[:budget].rstrip()}.{ext}"
        else:
            name = name[:_MAX_NAME_LENGTH].rstrip()
    return name


def create_upload(
    db: Session,
    *,
    data: bytes,
    filename: str | None,
    content_type: str | None,
    current_user: User,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> AttachmentRef:
    ensure_within_limit(len(data))
    if not data:
        raise ValidationError("File is empty.")
    declared = (content_type or "").split(";")[0].strip().lower()
    if declared not in _ALLOWLIST:
        raise ValidationError(
            f"Files of type {declared or 'unknown'} are not allowed.",
            code="UNSUPPORTED_FILE_TYPE",
        )
    name = sanitize_filename(filename)
    ext = PurePosixPath(name).suffix.lower()
    if ext not in _ALLOWLIST[declared]:
        raise ValidationError(
            f"Extension {ext or '(none)'} does not match type {declared}.",
            code="UNSUPPORTED_FILE_TYPE",
        )
    if not _content_matches(data, declared):
        raise ValidationError(
            "File content does not match its declared type.",
            code="UNSAFE_FILE",
        )

    target = _normalize_entity(entity_type, entity_id)
    if target is not None:
        _authorize_entity(
            db,
            entity_type=target[0],
            entity_id=target[1],
            current_user=current_user,
        )

    file_id = uuid4()
    key = f"{file_id}{ext}"
    stored = get_storage().save(data, key=key, content_type=declared)
    row = Attachment(
        id=file_id,
        owner_id=current_user.id,
        entity_type=target[0] if target else None,
        entity_id=target[1] if target else None,
        file_name=name,
        content_type=declared,
        size_bytes=stored.size,
        storage_key=key,
        url=stored.url,
    )
    try:
        AttachmentRepository(db).add(row)
        db.commit()
    except Exception:
        db.rollback()
        _discard_quietly(key)
        raise
    return AttachmentRef(
        id=str(file_id),
        name=name,
        url=stored.url,
        size=stored.size,
        mime_type=declared,
    )


def delete_upload(
    db: Session, *, upload_id: UUID, current_user: User
) -> None:
    """Owner-only hard delete: storage object first, then the row."""
    repo = AttachmentRepository(db)
    row = repo.get(upload_id)
    if row is None:
        raise NotFoundError("Upload not found.", code="UPLOAD_NOT_FOUND")
    if row.owner_id != current_user.id:
        raise ForbiddenError(
            "Only the uploader can delete this file.", code="FORBIDDEN"
        )
    # Storage first: if it fails the row survives and the call can be retried.
    get_storage().delete(row.storage_key)
    repo.delete(row)
    db.commit()


def _normalize_entity(
    entity_type: str | None, entity_id: str | None
) -> tuple[str, UUID] | None:
    """Validate the optional ``entityType``/``entityId`` pair."""
    if entity_type is None and entity_id is None:
        return None
    if entity_type is None or entity_id is None:
        raise ValidationError(
            "entityType and entityId must be provided together.",
            details={"entityType": entity_type, "entityId": entity_id},
        )
    kind = entity_type.strip().lower()
    if kind not in _ENTITY_TYPES:
        raise ValidationError(
            f"entityType must be one of {sorted(_ENTITY_TYPES)}.",
            details={"entityType": entity_type},
        )
    try:
        parsed = UUID(entity_id.strip())
    except (ValueError, AttributeError):
        raise ValidationError(
            "entityId must be a UUID.",
            details={"entityId": entity_id},
        ) from None
    return kind, parsed


def _authorize_entity(
    db: Session,
    *,
    entity_type: str,
    entity_id: UUID,
    current_user: User,
) -> None:
    """Attach-time access check — runs before any bytes reach storage."""
    if entity_type == "ask":
        found = ask_repo.get_ask(db, entity_id)
        if found is None:
            raise NotFoundError("Ask not found.", code="ASK_NOT_FOUND")
        ask, _response_count = found
        if ask.requester_id != current_user.id:
            raise ForbiddenError(
                "Only the ask owner can attach files to this ask.",
                code="NOT_ASK_OWNER",
            )
    elif entity_type == "offer":
        offer = offer_repo.get_live_offer(db, entity_id)
        if offer is None:
            raise NotFoundError(
                "Offer not found.", code="OFFER_NOT_FOUND"
            )
        if offer.provider_id != current_user.id:
            raise ForbiddenError(
                "Only the responding provider can attach files "
                "to this offer.",
                code="FORBIDDEN",
            )
    else:  # message — entityId is the thread id
        thread_service.require_participant(db, entity_id, current_user)


def _discard_quietly(key: str) -> None:
    try:
        get_storage().delete(key)
    except Exception:  # noqa: BLE001 — cleanup must not mask the error
        pass


def _content_matches(data: bytes, content_type: str) -> bool:
    """Reject files whose bytes contradict the declared type."""
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if content_type == "image/webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if content_type == "application/pdf":
        return data.startswith(b"%PDF-")
    return False
