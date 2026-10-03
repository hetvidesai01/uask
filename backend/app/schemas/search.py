from app.schemas.ask import AskResponse
from app.schemas.base import CamelModel
from app.schemas.user import UserProfile


class SearchResults(CamelModel):
    """GET /search — one group per entity, never a mixed result list."""

    asks: list[AskResponse] = []
    people: list[UserProfile] = []
