from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.core.pagination import Page
from app.models.user import User
from app.schemas.contract import (
    CompletedContractResponse,
    ContractResponse,
    MilestoneResponse,
    MilestoneStatusUpdate,
    RatingCreate,
    ReputationResponse,
)
from app.services import contract_service

router = APIRouter(tags=["contracts"])

DbDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_active_user)]


@router.get("/contracts", response_model=Page[ContractResponse])
def list_contracts(
    db: DbDep,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> Page[ContractResponse]:
    return contract_service.list_contracts(
        db, current_user=current_user, page=page, page_size=page_size
    )


@router.get("/asks/{ask_id}/contract", response_model=ContractResponse)
def get_ask_contract(
    ask_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractResponse:
    return contract_service.get_ask_contract(
        db, ask_id, current_user=current_user
    )


@router.patch(
    "/contracts/{contract_id}/milestones/{milestone_id}",
    response_model=MilestoneResponse,
)
def update_milestone(
    contract_id: UUID,
    milestone_id: UUID,
    payload: MilestoneStatusUpdate,
    db: DbDep,
    current_user: CurrentUser,
) -> MilestoneResponse:
    return contract_service.update_milestone(
        db,
        contract_id,
        milestone_id,
        payload,
        current_user=current_user,
    )


@router.post("/contracts/{contract_id}/complete", response_model=ContractResponse)
def complete_contract(
    contract_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractResponse:
    return contract_service.complete_contract(
        db, contract_id, current_user=current_user
    )


@router.post("/contracts/{contract_id}/rating", response_model=ContractResponse)
def rate_contract(
    contract_id: UUID,
    payload: RatingCreate,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractResponse:
    return contract_service.rate_contract(
        db, contract_id, payload, current_user=current_user
    )


@router.get("/users/{user_id}/reputation", response_model=ReputationResponse)
def get_reputation(
    user_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ReputationResponse:
    return contract_service.reputation(db, user_id)


@router.get(
    "/users/{user_id}/completed-contracts",
    response_model=Page[CompletedContractResponse],
)
def list_completed_contracts(
    user_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> Page[CompletedContractResponse]:
    return contract_service.completed_contracts(
        db, user_id, page=page, page_size=page_size
    )
