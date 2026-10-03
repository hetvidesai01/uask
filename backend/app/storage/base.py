"""Storage backend interface — select an implementation via ``STORAGE_PROVIDER``."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class StoredFile:
    key: str
    url: str
    size: int
    content_type: str


class StorageBackend(ABC):
    """Object storage with public URLs.

    Business code only ever sees this interface, so the local-disk
    implementation can be swapped for Supabase Storage — or anything else —
    through configuration alone.
    """

    @abstractmethod
    def save(self, data: bytes, *, key: str, content_type: str) -> StoredFile:
        """Persist ``data`` under ``key`` and report where it landed."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Remove ``key``. A missing object counts as success (idempotent)."""

    @abstractmethod
    def get_public_url(self, key: str) -> str:
        """Public URL for ``key`` — captured at upload time and stored."""
