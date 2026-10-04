"""Liveness and readiness probes.

`/health` answers "is the process alive?" and touches nothing.
`/ready` answers "can it serve traffic?" by checking PostgreSQL and that
the configured storage backend can be constructed. Check results are
deliberately opaque strings — never exception text, never a DSN.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.storage import get_storage

logger = logging.getLogger("uask.readiness")

router = APIRouter(tags=["health"])
DbDep = Annotated[Session, Depends(get_db)]

VERSION = "0.1.0"


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "version": VERSION}


@router.get("/ready")
def ready(db: DbDep) -> JSONResponse:
    checks = {
        "database": _database_check(db),
        "storage": _storage_check(),
    }
    is_ready = all(result == "ok" for result in checks.values())
    if not is_ready:
        logger.warning(
            "readiness check failed",
            extra={"event": "readiness_failed", "checks": checks},
        )
    return JSONResponse(
        status_code=200 if is_ready else 503,
        content={
            "status": "ready" if is_ready else "unavailable",
            "version": VERSION,
            "checks": checks,
        },
    )


def _database_check(db: Session) -> str:
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 — probe must never raise
        return "error"
    return "ok"


def _storage_check() -> str:
    try:
        get_storage()
    except Exception:  # noqa: BLE001 — misconfiguration → not ready
        return "error"
    return "ok"
