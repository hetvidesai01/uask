"""Supabase Storage over its REST API — no SDK, Python stdlib HTTP only.

Public bucket URLs (``/storage/v1/object/public/...``) are the deliberate
MVP strategy: uploaded files are referenced by URL inside ASK/offer/message
payloads, and expiring signed links would break those stored references.

Credentials and the bucket name come exclusively from configuration
(``SUPABASE_URL``, ``SUPABASE_SERVICE_ROLE_KEY``, ``SUPABASE_STORAGE_BUCKET``)
— never from code.
"""

from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.core.exceptions import StorageError
from app.storage.base import StorageBackend, StoredFile

TIMEOUT_SECONDS = 30


class SupabaseStorage(StorageBackend):
    def __init__(
        self, *, base_url: str, service_role_key: str, bucket: str
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.service_role_key = service_role_key
        self.bucket = bucket

    def save(self, data: bytes, *, key: str, content_type: str) -> StoredFile:
        status, _body = self._call(
            "POST",
            f"{self.base_url}/storage/v1/object/{self.bucket}/{quote(key)}",
            body=data,
            headers={
                "Authorization": f"Bearer {self.service_role_key}",
                "Content-Type": content_type,
                "x-upsert": "false",
            },
        )
        if status >= 400:
            raise StorageError(
                f"Supabase upload failed with status {status}."
            )
        return StoredFile(
            key=key,
            url=self.get_public_url(key),
            size=len(data),
            content_type=content_type,
        )

    def delete(self, key: str) -> None:
        status, _body = self._call(
            "DELETE",
            f"{self.base_url}/storage/v1/object/{self.bucket}/{quote(key)}",
            headers={"Authorization": f"Bearer {self.service_role_key}"},
        )
        if status >= 400 and status != 404:
            raise StorageError(
                f"Supabase delete failed with status {status}."
            )

    def get_public_url(self, key: str) -> str:
        return (
            f"{self.base_url}/storage/v1/object/public/"
            f"{self.bucket}/{quote(key)}"
        )

    def _call(
        self,
        method: str,
        url: str,
        *,
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, bytes]:
        request = Request(url, data=body, method=method, headers=headers or {})
        try:
            with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                return response.status, response.read()
        except HTTPError as exc:
            return exc.code, exc.read()
        except URLError as exc:
            raise StorageError(
                f"Storage request failed: {exc.reason}"
            ) from exc
