import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-ID"
# Only allow ids we would have generated ourselves: limits length and keeps
# control characters (log forging) out of every structured record.
_SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

logger = logging.getLogger("uask.access")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Pass through a well-formed X-Request-ID or generate one; expose on state."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        supplied = request.headers.get(REQUEST_ID_HEADER, "")
        if _SAFE_REQUEST_ID.fullmatch(supplied):
            request_id = supplied
        else:
            request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response


class AccessLogMiddleware(BaseHTTPMiddleware):
    """One structured line per request: method, path, status, duration.

    Never records query strings, headers, or bodies — those can carry
    search terms, cookies and tokens.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        path = request.url.path
        if path.rstrip("/").endswith(("/health", "/ready")) or path.startswith(
            "/media/"
        ):
            return await call_next(request)
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - started) * 1000, 1)
        logger.info(
            "request completed",
            extra={
                "event": "http_request",
                "method": request.method,
                "path": path,
                "status": response.status_code,
                "duration_ms": duration_ms,
                "request_id": getattr(request.state, "request_id", None),
            },
        )
        return response


def get_request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)
