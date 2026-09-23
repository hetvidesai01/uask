"""Phase 3 verification: error envelope, camelCase in/out, no business models."""
from __future__ import annotations

import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import ConflictError, NotFoundError
from app.core.pagination import Page, build_page
from app.repositories.base import BaseRepository
from app.schemas.base import CamelModel


class DemoSchema(CamelModel):
    budget_min: int | None = None
    request_count: int = 0


def verify_camel_out() -> None:
    s = DemoSchema(budget_min=100, request_count=3)
    data = s.model_dump(by_alias=True)
    assert "budgetMin" in data and "requestCount" in data, data
    assert "budget_min" not in data, data
    # snake_case Python attribute still works
    assert s.budget_min == 100
    print("OK camelCase: snake_case field serializes to camelCase")


def verify_camel_in() -> None:
    s = DemoSchema.model_validate({"budgetMin": 50, "requestCount": 2})
    assert s.budget_min == 50, s
    assert s.request_count == 2, s
    s2 = DemoSchema.model_validate({"budget_min": 7})
    assert s2.budget_min == 7
    print("OK camelCase: API input populates snake_case Python field")


def verify_invalid_input() -> None:
    try:
        DemoSchema.model_validate({"budgetMin": "not-a-number"})
    except PydanticValidationError:
        print("OK validation: bad camelCase input rejected by Pydantic")
    else:
        raise AssertionError("expected PydanticValidationError")


def verify_envelope() -> None:
    page = build_page([{"id": "1"}], page=2, page_size=20, total=50)
    data = page.model_dump(by_alias=True)
    expected = {
        "items",
        "page",
        "pageSize",
        "total",
        "totalPages",
        "hasNext",
    }
    assert set(data.keys()) == expected, data
    assert data["pageSize"] == 20
    assert data["totalPages"] == 3
    assert data["hasNext"] is True
    assert data["page"] == 2
    print("OK pagination: envelope matches blueprint (camelCase keys)")


def verify_error_envelope() -> None:
    test_app = FastAPI()

    # reuse production handlers registered on a fresh app for isolation
    from app.main import (
        app_error_handler,
        request_validation_handler,
        unhandled_exception_handler,
    )
    from fastapi.exceptions import RequestValidationError as FastAPIValidationErr

    test_app.add_exception_handler(Exception, unhandled_exception_handler)
    test_app.add_exception_handler(FastAPIValidationErr, request_validation_handler)

    from app.core.exceptions import AppError

    test_app.add_exception_handler(AppError, app_error_handler)

    from app.core.middleware import RequestIDMiddleware

    test_app.add_middleware(RequestIDMiddleware)

    @test_app.get("/__boom")
    def boom() -> None:
        raise NotFoundError("Ask not found.", code="ASK_NOT_FOUND")

    @test_app.get("/__conflict")
    def conflict() -> None:
        raise ConflictError("Duplicate offer.", code="DUPLICATE_OFFER")

    client = TestClient(test_app, raise_server_exceptions=False)

    r = client.get("/__boom")
    assert r.status_code == 404, r.status_code
    body = r.json()
    assert body == {
        "error": {
            "code": "ASK_NOT_FOUND",
            "message": "Ask not found.",
            "details": None,
            "requestId": body["error"]["requestId"],
        }
    }, body
    assert body["error"]["requestId"], body
    assert r.headers.get("X-Request-ID") == body["error"]["requestId"]
    print("OK AppError: 404 envelope matches blueprint §4")

    # pass-through request id
    rid = "req-test-123"
    r2 = client.get("/__boom", headers={"X-Request-ID": rid})
    assert r2.headers.get("X-Request-ID") == rid
    assert r2.json()["error"]["requestId"] == rid
    print("OK Request-ID: existing X-Request-ID passed through")

    r3 = client.get("/__conflict")
    assert r3.status_code == 409
    assert r3.json()["error"]["code"] == "DUPLICATE_OFFER"
    print("OK AppError: 409 ConflictError envelope")

    # Pydantic 422 via production handler shape
    from pydantic import BaseModel

    class In(CamelModel):
        name: str

    @test_app.post("/__validate")
    def validate_ep(body: In) -> dict:
        return {"ok": True}

    r4 = client.post("/__validate", json={"badKey": 1})
    assert r4.status_code == 422, r4.status_code
    err = r4.json()["error"]
    assert err["code"] == "VALIDATION_ERROR"
    assert isinstance(err["details"], list) and err["details"]
    assert "field" in err["details"][0] and "message" in err["details"][0]
    print("OK Pydantic 422: field details in standard envelope")


def verify_repo_is_minimal() -> None:
    assert hasattr(BaseRepository, "get")
    assert hasattr(BaseRepository, "add")
    assert issubclass(BaseRepository, object)
    print("OK repository: minimal BaseRepository present")


def verify_no_business_models() -> None:
    from app.db.base import Base

    assert list(Base.metadata.tables) == [], list(Base.metadata.tables)
    print("OK scope: no business tables on Base")


def main() -> int:
    verify_camel_out()
    verify_camel_in()
    verify_invalid_input()
    verify_envelope()
    verify_error_envelope()
    verify_repo_is_minimal()
    verify_no_business_models()
    print("ALL PHASE 3 CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
