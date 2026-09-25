"""Storage backend and filename sanitisation — Phase 10 unit tests."""

from pathlib import Path

import pytest

from app.core.exceptions import ValidationError
from app.services.upload_service import sanitize_filename
from app.storage import get_storage
from app.storage.base import StoredFile
from app.storage.local import LOCAL_PUBLIC_PREFIX, LocalDiskStorage


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
