from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_roles
from app.models.user import User
from app.schemas.ask import AskResponse
from app.schemas.matching import RankedResponse
from app.services import matching_service

router = APIRouter(tags=["matching"])

DbDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_active_user)]
ProviderUser = Annotated[User, Depends(require_roles("provider"))]


@router.get(
    "/asks/{ask_id}/ranked-responses", response_model=list[RankedResponse]
)
def ranked_responses(
    ask_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> list[RankedResponse]:
    """Scored responses on an ASK — ASK owner only, read-only."""
    return matching_service.ranked_responses(
        db, ask_id, current_user=current_user
    )


@router.get("/me/recommended-asks", response_model=list[AskResponse])
def recommended_asks(
    db: DbDep,
    current_user: ProviderUser,
    limit: int = Query(default=6, ge=1, le=50),
) -> list[AskResponse]:
    """Discovery for providers — never scores or ranks responders."""
    return matching_service.recommended_asks(
        db, current_user=current_user, limit=limit
    )
