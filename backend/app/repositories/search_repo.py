"""Global search queries — deterministic case-insensitive substring matching.

ILIKE with a shared `%term%` pattern mirrors the existing `?q=` filter on
GET /asks and the frontend's client-side `includes()` behaviour. The
`ix_asks_fts` GIN index is not used: full-text would lose the substring and
prefix matching the search contract requires and cannot cover `category`.
"""

from uuid import UUID

from sqlalchemy import Text, case, cast, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.ask import Ask
from app.models.user import User
from app.repositories import ask_repo


def search_asks(
    session: Session, *, term: str, limit: int = 10
) -> list[tuple[Ask, int]]:
    """Non-deleted ASKs matching title, description or category.

    Deterministic order: title exact → title prefix → title substring →
    category substring → description-only, then newest first, then id.
    """
    pattern = f"%{term}%"
    exact = term.lower()
    relevance = case(
        (func.lower(Ask.title) == exact, 4),
        (Ask.title.ilike(f"{term}%"), 3),
        (Ask.title.ilike(pattern), 2),
        (Ask.category.ilike(pattern), 1),
        else_=0,
    )
    stmt = (
        select(Ask, ask_repo._response_count_subq())
        .where(
            Ask.deleted_at.is_(None),
            or_(
                Ask.title.ilike(pattern),
                Ask.description.ilike(pattern),
                Ask.category.ilike(pattern),
            ),
        )
        .options(joinedload(Ask.requester))
        .order_by(relevance.desc(), Ask.created_at.desc(), Ask.id.desc())
        .limit(limit)
    )
    return list(session.execute(stmt).unique().all())


def search_people(
    session: Session, *, term: str, viewer_id: UUID, limit: int = 10
) -> list[User]:
    """Active users other than the viewer matching name, bio, location or
    categories.

    Same deterministic ladder for people: name exact → name prefix → name
    substring → category substring → location substring → bio-only, then
    newest joined first, then id. Private contact/social fields are never
    selected beyond the full row the public profile schema filters out.
    """
    pattern = f"%{term}%"
    exact = term.lower()
    categories = cast(User.categories, Text)
    relevance = case(
        (func.lower(User.name) == exact, 5),
        (User.name.ilike(f"{term}%"), 4),
        (User.name.ilike(pattern), 3),
        (categories.ilike(pattern), 2),
        (User.location.ilike(pattern), 1),
        else_=0,
    )
    stmt = (
        select(User)
        .where(
            User.is_active.is_(True),
            User.id != viewer_id,
            or_(
                User.name.ilike(pattern),
                User.bio.ilike(pattern),
                User.location.ilike(pattern),
                categories.ilike(pattern),
            ),
        )
        .order_by(relevance.desc(), User.joined_at.desc(), User.id.desc())
        .limit(limit)
    )
    return list(session.scalars(stmt).all())
