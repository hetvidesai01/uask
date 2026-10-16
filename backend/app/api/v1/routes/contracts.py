from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.core.pagination import Page
from app.models.user import User
from app.schemas.contract import (
    AmendmentCreate,
    CancellationRequest,
    CompletedContractResponse,
    ContractAmendmentResponse,
    ContractDisputeResponse,
    ContractHistoryResponse,
    ContractResponse,
    DisputeCreate,
    MilestoneResponse,
    MilestoneStatusUpdate,
    ProgressSubmit,
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


@router.get("/contracts/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractResponse:
    return contract_service.get_contract_detail(
        db, contract_id, current_user=current_user
    )


# --------------------------------------------------------------------------
# Signing
# --------------------------------------------------------------------------


@router.post("/contracts/{contract_id}/sign", response_model=ContractResponse)
def sign_contract(
    contract_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractResponse:
    """The authenticated participant signs for their own side. The signer is
    derived from the auth user — never from the request body."""
    return contract_service.sign_contract(
        db, contract_id, current_user=current_user
    )


# --------------------------------------------------------------------------
# Payment stages + completion
# --------------------------------------------------------------------------


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


# --------------------------------------------------------------------------
# Progress (60% checkpoint + final submission)
# --------------------------------------------------------------------------


@router.post("/contracts/{contract_id}/progress", response_model=ContractResponse)
def submit_progress(
    contract_id: UUID,
    payload: ProgressSubmit,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractResponse:
    """Respond side submits 60% progress or the final (100%) work."""
    return contract_service.submit_progress(
        db, contract_id, payload, current_user=current_user
    )


@router.post(
    "/contracts/{contract_id}/progress/approve",
    response_model=ContractResponse,
)
def approve_progress(
    contract_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractResponse:
    """ASK side approves the submitted stage -> it becomes due (not paid)."""
    return contract_service.approve_progress(
        db, contract_id, current_user=current_user
    )


@router.post(
    "/contracts/{contract_id}/progress/revision",
    response_model=ContractResponse,
)
def request_revision(
    contract_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractResponse:
    """ASK side requests a revision of the submitted stage."""
    return contract_service.request_revision(
        db, contract_id, current_user=current_user
    )


# --------------------------------------------------------------------------
# Rating
# --------------------------------------------------------------------------


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


# --------------------------------------------------------------------------
# History / disputes / cancellation / amendments
# --------------------------------------------------------------------------


@router.get(
    "/contracts/{contract_id}/history",
    response_model=Page[ContractHistoryResponse],
)
def list_history(
    contract_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> Page[ContractHistoryResponse]:
    return contract_service.list_history(
        db,
        contract_id,
        current_user=current_user,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/contracts/{contract_id}/disputes",
    response_model=ContractDisputeResponse,
)
def raise_dispute(
    contract_id: UUID,
    payload: DisputeCreate,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractDisputeResponse:
    return contract_service.raise_dispute(
        db, contract_id, payload, current_user=current_user
    )


@router.get(
    "/contracts/{contract_id}/disputes",
    response_model=Page[ContractDisputeResponse],
)
def list_disputes(
    contract_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> Page[ContractDisputeResponse]:
    return contract_service.list_disputes(
        db,
        contract_id,
        current_user=current_user,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/contracts/{contract_id}/disputes/{dispute_id}/resolve",
    response_model=ContractResponse,
)
def resolve_dispute(
    contract_id: UUID,
    dispute_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractResponse:
    return contract_service.resolve_dispute(
        db, contract_id, dispute_id, current_user=current_user
    )


@router.post(
    "/contracts/{contract_id}/cancellation-request",
    response_model=ContractResponse,
)
def request_cancellation(
    contract_id: UUID,
    payload: CancellationRequest,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractResponse:
    return contract_service.request_cancellation(
        db, contract_id, payload, current_user=current_user
    )


@router.post(
    "/contracts/{contract_id}/cancellation-request/approve",
    response_model=ContractResponse,
)
def approve_cancellation(
    contract_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractResponse:
    """The other participant approves -> contract becomes cancelled."""
    return contract_service.approve_cancellation(
        db, contract_id, current_user=current_user
    )


@router.post(
    "/contracts/{contract_id}/amendments",
    response_model=ContractAmendmentResponse,
)
def propose_amendment(
    contract_id: UUID,
    payload: AmendmentCreate,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractAmendmentResponse:
    return contract_service.propose_amendment(
        db, contract_id, payload, current_user=current_user
    )


@router.get(
    "/contracts/{contract_id}/amendments",
    response_model=Page[ContractAmendmentResponse],
)
def list_amendments(
    contract_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> Page[ContractAmendmentResponse]:
    return contract_service.list_amendments(
        db,
        contract_id,
        current_user=current_user,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/contracts/{contract_id}/amendments/{amendment_id}/approve",
    response_model=ContractAmendmentResponse,
)
def approve_amendment(
    contract_id: UUID,
    amendment_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractAmendmentResponse:
    return contract_service.decide_amendment(
        db,
        contract_id,
        amendment_id,
        approve=True,
        current_user=current_user,
    )


@router.post(
    "/contracts/{contract_id}/amendments/{amendment_id}/reject",
    response_model=ContractAmendmentResponse,
)
def reject_amendment(
    contract_id: UUID,
    amendment_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ContractAmendmentResponse:
    return contract_service.decide_amendment(
        db,
        contract_id,
        amendment_id,
        approve=False,
        current_user=current_user,
    )


# --------------------------------------------------------------------------
# Reputation + completed history
# --------------------------------------------------------------------------


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
