"""Storage backend interface — swap implementations via ``UPLOAD_BACKEND``."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class StoredFile:
    key: str
    url: str
    size: int
    content_type: str


class StorageBackend(ABC):
    """Write-only object storage.

    Business code only ever sees this interface, so the local-disk
    implementation can later be replaced by Supabase Storage,
    S3-compatible storage, or any other provider.
    """

    @abstractmethod
    def save(self, data: bytes, *, key: str, content_type: str) -> StoredFile:
        """Persist ``data`` under ``key`` and report where it landed."""
