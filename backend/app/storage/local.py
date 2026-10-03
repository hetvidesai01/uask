"""Local-disk storage: files live under ``UPLOAD_DIR``, served from ``/media``.

Development/testing fallback only — production uses ``STORAGE_PROVIDER=supabase``.
"""

from pathlib import Path

from app.storage.base import StorageBackend, StoredFile

LOCAL_PUBLIC_PREFIX = "/media"


class LocalDiskStorage(StorageBackend):
    def __init__(
        self,
        directory: str | Path,
        *,
        public_prefix: str = LOCAL_PUBLIC_PREFIX,
    ) -> None:
        self.directory = Path(directory)
        self.public_prefix = public_prefix.rstrip("/")
        self.directory.mkdir(parents=True, exist_ok=True)

    def save(self, data: bytes, *, key: str, content_type: str) -> StoredFile:
        path = self.directory / self._safe_key(key)
        path.write_bytes(data)
        return StoredFile(
            key=key,
            url=self.get_public_url(key),
            size=len(data),
            content_type=content_type,
        )

    def delete(self, key: str) -> None:
        (self.directory / self._safe_key(key)).unlink(missing_ok=True)

    def get_public_url(self, key: str) -> str:
        return f"{self.public_prefix}/{self._safe_key(key)}"

    @staticmethod
    def _safe_key(key: str) -> str:
        if (
            not key
            or "/" in key
            or "\\" in key
            or "\x00" in key
            or key in {".", ".."}
        ):
            raise ValueError(f"Unsafe storage key: {key!r}")
        return key
