"""Fixed-window rate limiting — in-process, configurable, dependency-based.

Applied to the abusive paths only: login, signup, refresh, uploads and
messaging. Limits come from ``RATE_LIMIT_<BUCKET>_*`` settings and are
re-read on every request, so they can be tuned without a restart. Counters
are per process (each Uvicorn worker keeps its own), which is the accepted
trade-off for adding no Redis and no third-party dependency at this stage.
"""

import math
import threading
import time
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request

from app.core.config import RATE_LIMIT_BUCKETS, get_settings
from app.core.deps import get_current_active_user
from app.core.exceptions import RateLimitError
from app.models.user import User

_MAX_TRACKED_KEYS = 5000
_BUCKETS = {bucket.lower(): bucket for bucket in RATE_LIMIT_BUCKETS}


class FixedWindowLimiter:
    """Sliding-free fixed window: ``limit`` hits per ``window`` seconds."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._windows: dict[str, tuple[float, int]] = {}

    def hit(self, key: str, *, limit: int, window: int) -> None:
        now = time.monotonic()
        with self._lock:
            start, count = self._windows.get(key, (now, 0))
            if now - start >= window:
                start, count = now, 0
            if count >= limit:
                retry_after = max(1, math.ceil(window - (now - start)))
                raise RateLimitError(retry_after=retry_after)
            self._windows[key] = (start, count + 1)
            if len(self._windows) > _MAX_TRACKED_KEYS:
                self._prune(now, window)

    def _prune(self, now: float, window: int) -> None:
        stale = [
            key
            for key, (start, _count) in self._windows.items()
            if now - start >= window
        ]
        for key in stale:
            self._windows.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._windows.clear()


limiter = FixedWindowLimiter()


def reset_rate_limits() -> None:
    """Drop all counters — used by tests and available on restart."""
    limiter.reset()


def client_identity(request: Request, *, behind_proxy: bool) -> str:
    """Per-client key: forwarded client IP when behind a proxy, else peer."""
    if behind_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip() or "unknown"
    if request.client is not None:
        return request.client.host
    return "unknown"


def enforce(bucket: str, *, identity: str) -> str:
    """Count one hit against ``bucket``; raise 429 when the window is full."""
    settings = get_settings()
    if not settings.RATE_LIMIT_ENABLED:
        return identity
    try:
        suffix = _BUCKETS[bucket]
    except KeyError as exc:  # programming error, not a user error
        raise RuntimeError(f"Unknown rate-limit bucket: {bucket!r}") from exc
    limit = getattr(settings, f"RATE_LIMIT_{suffix}_MAX")
    window = getattr(settings, f"RATE_LIMIT_{suffix}_WINDOW_SECONDS")
    limiter.hit(f"{bucket}:{identity}", limit=limit, window=window)
    return identity


def ip_rate_limit(bucket: str) -> Callable[..., str]:
    """Bucket keyed by client IP — for pre-auth endpoints."""

    def dependency(request: Request) -> str:
        identity = client_identity(
            request, behind_proxy=get_settings().BEHIND_PROXY
        )
        return enforce(bucket, identity=identity)

    return dependency


def user_rate_limit(bucket: str) -> Callable[..., str]:
    """Bucket keyed by user id — for authenticated endpoints.

    Depends on ``get_current_active_user`` so authentication always runs
    before the counter, and the shared dependency cache avoids a second
    user lookup.
    """

    def dependency(
        current_user: Annotated[
            User, Depends(get_current_active_user)
        ],
    ) -> str:
        return enforce(bucket, identity=str(current_user.id))

    return dependency
