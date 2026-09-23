from typing import Any


class AppError(Exception):
    status_code = 500
    code = "INTERNAL_ERROR"
    message = "Something went wrong."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        details: Any = None,
    ) -> None:
        self.message = message or self.message
        if code is not None:
            self.code = code
        self.details = details
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"
    message = "Resource not found."


class ValidationError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"
    message = "Validation failed."


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"
    message = "Not authenticated."


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"
    message = "You do not have access to this resource."


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"
    message = "Conflict."


class InvalidTransitionError(ConflictError):
    code = "INVALID_STATUS_TRANSITION"
    message = "Invalid status transition."
