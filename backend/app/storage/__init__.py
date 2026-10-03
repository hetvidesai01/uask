from app.core.config import get_settings
from app.storage.base import StorageBackend, StoredFile
from app.storage.local import LocalDiskStorage
from app.storage.supabase import SupabaseStorage

__all__ = [
    "StorageBackend",
    "StoredFile",
    "SupabaseStorage",
    "get_storage",
]


def get_storage() -> StorageBackend:
    """Build the configured backend; services only depend on this factory."""
    settings = get_settings()
    provider = settings.STORAGE_PROVIDER.strip().lower()
    if provider == "local":
        return LocalDiskStorage(settings.UPLOAD_DIR)
    if provider == "supabase":
        required = (
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
            "SUPABASE_STORAGE_BUCKET",
        )
        missing = [name for name in required if not getattr(settings, name)]
        if missing:
            raise RuntimeError(
                "STORAGE_PROVIDER=supabase requires: " + ", ".join(missing)
            )
        return SupabaseStorage(
            base_url=settings.SUPABASE_URL,
            service_role_key=settings.SUPABASE_SERVICE_ROLE_KEY,
            bucket=settings.SUPABASE_STORAGE_BUCKET,
        )
    raise RuntimeError(f"Unsupported STORAGE_PROVIDER: {provider!r}")
