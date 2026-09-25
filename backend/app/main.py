from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import v1_router
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.middleware import RequestIDMiddleware
from app.storage import get_storage
from app.storage.local import LocalDiskStorage

settings = get_settings()

app = FastAPI(title="UASK API")

app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
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
    details = [
        {
            "field": ".".join(str(p) for p in err.get("loc", ())),
            "message": err.get("message", ""),
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content=_error_body(
            request,
            code="VALIDATION_ERROR",
            message="Validation failed.",
            details=details,
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
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
