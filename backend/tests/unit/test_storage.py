"""Storage backends and filename sanitisation — unit tests.

Supabase Storage is exercised through a mocked ``urlopen``: the suite must
never talk to a live bucket.
"""

import io
from pathlib import Path
from urllib.error import HTTPError, URLError

import pytest

from app.core.config import get_settings
from app.core.exceptions import StorageError, ValidationError
from app.services.upload_service import sanitize_filename
from app.storage import get_storage
from app.storage.base import StoredFile
from app.storage.local import LOCAL_PUBLIC_PREFIX, LocalDiskStorage
from app.storage.supabase import SupabaseStorage

SUPABASE_URL = "https://example.supabase.co"
BUCKET = "uask-uploads"
SERVICE_KEY = "service-role-secret"


class _FakeResponse:
    def __init__(self, status: int = 200, body: bytes = b"") -> None:
        self.status = status
        self._body = body

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *exc) -> bool:
        return False


def _supabase(monkeypatch, *, response=None, side_effect=None) -> list:
    """Install a urlopen double; return the list of captured requests."""
    captured: list = []

    def fake_urlopen(request, timeout=None):
        captured.append((request, timeout))
        if side_effect is not None:
            raise side_effect
        return response if response is not None else _FakeResponse()

    monkeypatch.setattr("app.storage.supabase.urlopen", fake_urlopen)
    return captured


def _backend() -> SupabaseStorage:
    return SupabaseStorage(
        base_url=SUPABASE_URL,
        service_role_key=SERVICE_KEY,
        bucket=BUCKET,
    )


def test_local_storage_saves_and_reports_url(tmp_path: Path):
    storage = LocalDiskStorage(tmp_path / "files")
    stored = storage.save(b"hello", key="a.png", content_type="image/png")
    assert isinstance(stored, StoredFile)
    assert stored.key == "a.png"
    assert stored.url == f"{LOCAL_PUBLIC_PREFIX}/a.png"
    assert stored.size == 5
    assert stored.content_type == "image/png"
    assert (tmp_path / "files" / "a.png").read_bytes() == b"hello"


def test_local_storage_creates_missing_directories(tmp_path: Path):
    storage = LocalDiskStorage(tmp_path / "nested" / "dir")
    assert storage.directory.is_dir()


@pytest.mark.parametrize("key", ["a/b.png", "..\\x.png", "..", ".", "", "x\0y"])
def test_local_storage_rejects_unsafe_keys(tmp_path: Path, key: str):
    storage = LocalDiskStorage(tmp_path)
    with pytest.raises(ValueError):
        storage.save(b"x", key=key, content_type="text/plain")


def test_factory_returns_configured_backend():
    assert isinstance(get_storage(), LocalDiskStorage)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("../../etc/passwd.png", "passwd.png"),
        ("C:\\Users\\x\\photo.png", "photo.png"),
        ("pho\x00to.png", "photo.png"),
        ("  my   file .png ", "my file .png"),
        ("archive.tar.gz", "archive.tar.gz"),
    ],
)
def test_sanitize_filename_cases(raw: str, expected: str):
    assert sanitize_filename(raw) == expected


def test_sanitize_filename_truncates_long_names():
    name = sanitize_filename("a" * 300 + ".png")
    assert len(name) <= 120
    assert name.endswith(".png")


@pytest.mark.parametrize("raw", [None, "", "   ", "..", " . "])
def test_sanitize_filename_rejects_useless_names(raw: str | None):
    with pytest.raises(ValidationError):
        sanitize_filename(raw)


# --------------------------------------------------------------------------
# Local backend: delete + public URLs
# --------------------------------------------------------------------------


def test_local_delete_removes_file(tmp_path: Path):
    storage = LocalDiskStorage(tmp_path)
    storage.save(b"bye", key="gone.png", content_type="image/png")
    storage.delete("gone.png")
    assert not (tmp_path / "gone.png").exists()


def test_local_delete_of_missing_key_is_idempotent(tmp_path: Path):
    LocalDiskStorage(tmp_path).delete("never-existed.png")


def test_local_public_url_uses_media_prefix(tmp_path: Path):
    storage = LocalDiskStorage(tmp_path)
    assert storage.get_public_url("a.png") == f"{LOCAL_PUBLIC_PREFIX}/a.png"


def test_local_public_url_rejects_unsafe_key(tmp_path: Path):
    with pytest.raises(ValueError):
        LocalDiskStorage(tmp_path).get_public_url("../escape.png")


# --------------------------------------------------------------------------
# Supabase backend (urlopen mocked — no network in the suite)
# --------------------------------------------------------------------------


def test_supabase_save_posts_to_object_endpoint(monkeypatch):
    captured = _supabase(monkeypatch)
    stored = _backend().save(
        b"png-bytes", key="abc.png", content_type="image/png"
    )
    request, timeout = captured[0]
    assert request.full_url == (
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/abc.png"
    )
    assert request.get_method() == "POST"
    assert request.data == b"png-bytes"
    assert request.headers["Authorization"] == f"Bearer {SERVICE_KEY}"
    assert request.headers["Content-type"] == "image/png"
    assert request.headers["X-upsert"] == "false"
    assert timeout == 30
    assert isinstance(stored, StoredFile)
    assert stored.key == "abc.png"
    assert stored.size == len(b"png-bytes")
    assert stored.url == (
        f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/abc.png"
    )


def test_supabase_delete_targets_object_and_swallows_missing(
    monkeypatch,
):
    captured = _supabase(
        monkeypatch,
        side_effect=HTTPError(
            "https://x", 404, "Not Found", None, io.BytesIO(b"")
        ),
    )
    _backend().delete("abc.png")
    request, _timeout = captured[0]
    assert request.get_method() == "DELETE"
    assert request.full_url == (
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/abc.png"
    )
    assert request.data is None


def test_supabase_delete_raises_on_server_error(monkeypatch):
    _supabase(
        monkeypatch,
        side_effect=HTTPError(
            "https://x", 500, "Server Error", None, io.BytesIO(b"")
        ),
    )
    with pytest.raises(StorageError):
        _backend().delete("abc.png")


def test_supabase_save_raises_on_http_error(monkeypatch):
    _supabase(
        monkeypatch,
        side_effect=HTTPError(
            "https://x", 400, "Bad Request", None, io.BytesIO(b"")
        ),
    )
    with pytest.raises(StorageError):
        _backend().save(b"x", key="a.png", content_type="image/png")


def test_supabase_network_failure_maps_to_storage_error(monkeypatch):
    _supabase(monkeypatch, side_effect=URLError("dns down"))
    with pytest.raises(StorageError):
        _backend().save(b"x", key="a.png", content_type="image/png")


# --------------------------------------------------------------------------
# Factory
# --------------------------------------------------------------------------


def test_factory_supabase_backend(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "STORAGE_PROVIDER", "supabase")
    monkeypatch.setattr(settings, "SUPABASE_URL", SUPABASE_URL)
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY)
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", BUCKET)
    storage = get_storage()
    assert isinstance(storage, SupabaseStorage)
    assert storage.bucket == BUCKET


def test_factory_supabase_requires_configuration(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "STORAGE_PROVIDER", "supabase")
    monkeypatch.setattr(settings, "SUPABASE_URL", "")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "")
    with pytest.raises(RuntimeError) as excinfo:
        get_storage()
    message = str(excinfo.value)
    assert "SUPABASE_URL" in message
    assert "SUPABASE_SERVICE_ROLE_KEY" in message
    assert "SUPABASE_STORAGE_BUCKET" in message


def test_factory_rejects_unknown_provider(monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_PROVIDER", "s3")
    with pytest.raises(RuntimeError):
        get_storage()
