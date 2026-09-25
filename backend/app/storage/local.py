"""Local-disk storage: files live under ``UPLOAD_DIR``, served from ``/media``."""

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
            url=f"{self.public_prefix}/{key}",
            size=len(data),
            content_type=content_type,
        )

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
