"""Structured logging — JSON lines by default, plain text for local runs.

Hard rule enforced by review and by `tests/api/test_hardening.py`:
**never** log passwords, access tokens, refresh tokens, JWT secrets or
private message bodies. Records carry identifiers, codes and timings only.
"""

import json
import logging
import sys
from datetime import UTC, datetime

from app.core.config import Settings

# Non-reserved LogRecord attributes we promote into the JSON payload.
_EXTRA_FIELDS = (
    "event",
    "request_id",
    "method",
    "path",
    "status",
    "duration_ms",
    "code",
    "bucket",
    "retry_after",
    "user_id",
    "env",
    "storage",
    "debug",
    "checks",
    "error_count",
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in _EXTRA_FIELDS:
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


class PlainFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        extras = [
            f"{field}={getattr(record, field)}"
            for field in _EXTRA_FIELDS
            if getattr(record, field, None) is not None
        ]
        return f"{base} {' '.join(extras)}" if extras else base


def configure_logging(settings: Settings) -> None:
    """Attach one handler to the root logger. Safe to call more than once."""
    root = logging.getLogger()
    if getattr(root, "_uask_configured", False):
        root.setLevel(settings.log_level)
        return

    handler = logging.StreamHandler(sys.stdout)
    if settings.LOG_FORMAT == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            PlainFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
        )
    root.addHandler(handler)
    root.setLevel(settings.log_level)
    root._uask_configured = True  # type: ignore[attr-defined]
