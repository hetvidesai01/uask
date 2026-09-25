from app.core.config import get_settings
from app.storage.base import StorageBackend, StoredFile
from app.storage.local import LocalDiskStorage

__all__ = ["StorageBackend", "StoredFile", "get_storage"]


def get_storage() -> StorageBackend:
    """Build the configured backend; services only depend on this factory."""
    backend = get_settings().UPLOAD_BACKEND.strip().lower()
    if backend == "local":
        return LocalDiskStorage(get_settings().UPLOAD_DIR)
    raise RuntimeError(f"Unsupported UPLOAD_BACKEND: {backend!r}")
