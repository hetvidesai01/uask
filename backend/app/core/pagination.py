from typing import Generic, TypeVar

from pydantic import Field

from app.schemas.base import CamelModel

T = TypeVar("T")

DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class PageParams:
    """Query-side pagination params (page ≥ 1, pageSize 1–100)."""

    def __init__(
        self,
        page: int = DEFAULT_PAGE,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> None:
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), MAX_PAGE_SIZE)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class Page(CamelModel, Generic[T]):
    """Standard list envelope — every list endpoint returns this shape."""

    items: list[T]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=MAX_PAGE_SIZE)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)
    has_next: bool


def build_page(
    items: list[T],
    *,
    page: int,
    page_size: int,
    total: int,
) -> Page[T]:
    total_pages = (total + page_size - 1) // page_size if page_size else 0
    return Page(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        has_next=page < total_pages,
    )
