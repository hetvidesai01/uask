from typing import Generic, TypeVar

from pydantic import Field

from app.schemas.base import CamelModel

T = TypeVar("T")


class PageMeta(CamelModel):
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)
    has_next: bool


class Page(CamelModel, Generic[T]):
    items: list[T]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)
    has_next: bool


class AttachmentRef(CamelModel):
    id: str
    name: str
    url: str
    size: int = 0
    mime_type: str = "application/octet-stream"


class ErrorResponse(CamelModel):
    code: str
    message: str
    details: object = None
    request_id: str | None = None
