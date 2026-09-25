from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_roles
from app.core.pagination import Page
from app.models.user import User
from app.schemas.offer import OfferCreate, OfferResponse, OfferUpdate
from app.services import offer_service

router = APIRouter(tags=["offers"])

DbDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_active_user)]
ProviderUser = Annotated[User, Depends(require_roles("provider"))]


@router.get("/asks/{ask_id}/offers", response_model=Page[OfferResponse])
def list_offers(
    ask_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> Page[OfferResponse]:
    return offer_service.list_offers(
        db, ask_id, current_user=current_user, page=page, page_size=page_size
    )


@router.post(
    "/asks/{ask_id}/offers",
    response_model=OfferResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_offer(
    ask_id: UUID,
    payload: OfferCreate,
    db: DbDep,
    current_user: ProviderUser,
) -> OfferResponse:
    return offer_service.create_offer(db, ask_id, payload, current_user)


@router.get("/asks/{ask_id}/offers/compare", response_model=Page[OfferResponse])
def compare_offers(
    ask_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
    ids: str = Query(..., max_length=300),
) -> Page[OfferResponse]:
    return offer_service.compare_offers(db, ask_id, ids, current_user)


@router.get("/offers/{offer_id}", response_model=OfferResponse)
def get_offer(
    offer_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> OfferResponse:
    return offer_service.get_offer(db, offer_id, current_user)


@router.patch("/offers/{offer_id}", response_model=OfferResponse)
def update_offer(
    offer_id: UUID,
    payload: OfferUpdate,
    db: DbDep,
    current_user: CurrentUser,
) -> OfferResponse:
    return offer_service.update_offer(db, offer_id, payload, current_user)
