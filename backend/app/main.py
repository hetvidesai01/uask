import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.router import v1_router
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.logging import configure_logging
from app.core.middleware import AccessLogMiddleware, RequestIDMiddleware
from app.storage import get_storage
from app.storage.local import LocalDiskStorage

settings = get_settings()
configure_logging(settings)
logger = logging.getLogger("uask.app")


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info(
        "application starting",
        extra={
            "event": "startup",
            "env": settings.ENV,
            "storage": settings.STORAGE_PROVIDER,
            "debug": settings.DEBUG,
        },
    )
    yield
    logger.info("application shutdown", extra={"event": "shutdown"})


# Production serves no interactive API docs (see AGENTS.md Phase 7).
app = FastAPI(
    title="UASK API",
    lifespan=_lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AccessLogMiddleware)


def _error_body(
    request: Request,
    *,
    code: str,
    message: str,
    details: object = None,
) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "requestId": getattr(request.state, "request_id", None),
        }
    }


def _request_context(request: Request) -> dict:
    """Identifiers only — never headers, cookies, query strings or bodies."""
    return {
        "method": request.method,
        "path": request.url.path,
        "request_id": getattr(request.state, "request_id", None),
    }


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    context = {
        **_request_context(request),
        "code": exc.code,
        "status": exc.status_code,
    }
    if exc.status_code in (401, 403):
        logger.warning("request rejected", extra={"event": "authz_failure", **context})
    elif exc.status_code == 429:
        logger.warning(
            "rate limit exceeded",
            extra={
                "event": "rate_limited",
                "retry_after": getattr(exc, "retry_after", None),
                **context,
            },
        )
    elif exc.status_code >= 500:
        logger.error(
            "request failed",
            extra={"event": "app_error", **context},
            exc_info=(type(exc), exc, exc.__traceback__),
        )
    else:
        logger.info("request rejected", extra={"event": "app_error", **context})

    headers = None
    retry_after = getattr(exc, "retry_after", None)
    if retry_after is not None:
        headers = {"Retry-After": str(retry_after)}
    return JSONResponse(
        status_code=exc.status_code,
        headers=headers,
        content=_error_body(
            request,
            code=exc.code,
            message=exc.message,
            details=exc.details,
        ),
    )


@app.exception_handler(RequestValidationError)
async def request_validation_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Field names and messages only — `input` values may hold passwords.
    details = [
        {
            "field": ".".join(str(p) for p in err.get("loc", ())),
            "message": err.get("message", ""),
        }
        for err in exc.errors()
    ]
    logger.info(
        "request validation failed",
        extra={
            "event": "validation_failed",
            "error_count": len(details),
            **_request_context(request),
        },
    )
    return JSONResponse(
        status_code=422,
        content=_error_body(
            request,
            code="VALIDATION_ERROR",
            message="Validation failed.",
            details=details,
        ),
    )


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(
    request: Request, exc: SQLAlchemyError
) -> JSONResponse:
    """Database failures: full traceback in the log, generic body to the client."""
    logger.error(
        "database error",
        extra={"event": "database_error", **_request_context(request)},
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=500,
        content=_error_body(
            request,
            code="INTERNAL_ERROR",
            message="Something went wrong.",
            details=None,
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Unexpected errors: traceback with requestId in the log, never in the body."""
    logger.error(
        "unhandled exception",
        extra={"event": "unhandled_error", **_request_context(request)},
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=500,
        content=_error_body(
            request,
            code="INTERNAL_ERROR",
            message="Something went wrong.",
            details=None,
        ),
    )

storage_backend = get_storage()
if isinstance(storage_backend, LocalDiskStorage):
    app.mount(
        storage_backend.public_prefix,
        StaticFiles(directory=str(storage_backend.directory)),
        name="media",
    )

app.include_router(v1_router, prefix=settings.API_V1_PREFIX)
