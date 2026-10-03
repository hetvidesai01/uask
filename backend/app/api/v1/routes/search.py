from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.ask import AskResponse
from app.schemas.search import SearchResults
from app.schemas.user import UserProfile
from app.services import search_service

router = APIRouter(prefix="/search", tags=["search"])

DbDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_active_user)]


@router.get("/asks", response_model=list[AskResponse])
def search_asks(
    db: DbDep,
    current_user: CurrentUser,
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=10, ge=1, le=50),
) -> list[AskResponse]:
    """ASKs matching title, description or category — best match first."""
    return search_service.search_asks(db, q=q, limit=limit)


@router.get("/people", response_model=list[UserProfile])
def search_people(
    db: DbDep,
    current_user: CurrentUser,
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=10, ge=1, le=50),
) -> list[UserProfile]:
    """Active users matching name, bio, location or categories — never self."""
    return search_service.search_people(
        db, q=q, current_user=current_user, limit=limit
    )


@router.get("", response_model=SearchResults)
def global_search(
    db: DbDep,
    current_user: CurrentUser,
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=10, ge=1, le=50),
) -> SearchResults:
    """Both groups for one term, each capped at `limit`."""
    return search_service.global_search(
        db, q=q, current_user=current_user, limit=limit
    )
