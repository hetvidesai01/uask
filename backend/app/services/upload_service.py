"""Upload rules: allowed types, size limits, safe names, storage dispatch."""

import re
from pathlib import PurePosixPath
from uuid import uuid4

from app.core.config import get_settings
from app.core.exceptions import PayloadTooLargeError, ValidationError
from app.schemas.common import AttachmentRef
from app.storage import get_storage

_MAX_NAME_LENGTH = 120
_SNIFF_HEAD = 8192
_TEXT_TYPES = frozenset({"text/plain", "text/csv"})
_DOCX = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

# mime type -> extensions accepted for it (strict allowlist)
_ALLOWLIST: dict[str, frozenset[str]] = {
    "image/png": frozenset({".png"}),
    "image/jpeg": frozenset({".jpg", ".jpeg"}),
    "image/gif": frozenset({".gif"}),
    "image/webp": frozenset({".webp"}),
    "application/pdf": frozenset({".pdf"}),
    "text/plain": frozenset({".txt"}),
    "text/csv": frozenset({".csv"}),
    "application/zip": frozenset({".zip"}),
    _DOCX: frozenset({".docx"}),
}

_TYPE_ALIASES = {
    "application/x-zip-compressed": "application/zip",
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
    *,
    data: bytes,
    filename: str | None,
    content_type: str | None,
) -> AttachmentRef:
    ensure_within_limit(len(data))
    if not data:
        raise ValidationError("File is empty.")
    declared = (content_type or "").split(";")[0].strip().lower()
    declared = _TYPE_ALIASES.get(declared, declared)
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
    file_id = str(uuid4())
    stored = get_storage().save(
        data, key=f"{file_id}{ext}", content_type=declared
    )
    return AttachmentRef(
        id=file_id,
        name=name,
        url=stored.url,
        size=stored.size,
        mime_type=declared,
    )


def _content_matches(data: bytes, content_type: str) -> bool:
    """Reject files whose bytes contradict the declared type."""
    if content_type in _TEXT_TYPES:
        return b"\x00" not in data[:_SNIFF_HEAD]
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if content_type == "image/gif":
        return data.startswith((b"GIF87a", b"GIF89a"))
    if content_type == "image/webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if content_type == "application/pdf":
        return data.startswith(b"%PDF-")
    # zip and docx both start with the PK local-file header
    return data.startswith(b"PK")
