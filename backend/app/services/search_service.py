"""Global search orchestration — trim the term, then query the repo.

Empty or whitespace-only terms never reach the database: they return an
empty result directly, as the search contract requires.
"""

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import search_repo
from app.schemas.ask import AskResponse
from app.schemas.search import SearchResults
from app.schemas.user import UserProfile

DEFAULT_LIMIT = 10


def _term(q: str | None) -> str:
    return (q or "").strip()


def search_asks(
    db: Session, *, q: str | None, limit: int = DEFAULT_LIMIT
) -> list[AskResponse]:
    term = _term(q)
    if not term:
        return []
    items: list[AskResponse] = []
    for ask, count in search_repo.search_asks(db, term=term, limit=limit):
        response = AskResponse.model_validate(ask)
        response.response_count = count
        items.append(response)
    return items


def search_people(
    db: Session,
    *,
    q: str | None,
    current_user: User,
    limit: int = DEFAULT_LIMIT,
) -> list[UserProfile]:
    term = _term(q)
    if not term:
        return []
    users = search_repo.search_people(
        db, term=term, viewer_id=current_user.id, limit=limit
    )
    return [UserProfile.model_validate(user) for user in users]


def global_search(
    db: Session,
    *,
    q: str | None,
    current_user: User,
    limit: int = DEFAULT_LIMIT,
) -> SearchResults:
    return SearchResults(
        asks=search_asks(db, q=q, limit=limit),
        people=search_people(
            db, q=q, current_user=current_user, limit=limit
        ),
    )
