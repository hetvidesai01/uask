from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.connection import (
    ConnectionCreate,
    ConnectionResponse,
    ConnectionStatusResponse,
)
from app.services import connection_service

router = APIRouter(prefix="/connections", tags=["connections"])

DbDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_active_user)]


@router.get(
    "/status/{target_user_id}", response_model=ConnectionStatusResponse
)
def get_connection_status(
    target_user_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ConnectionStatusResponse:
    return connection_service.connection_status(
        db, target_user_id=target_user_id, current_user=current_user
    )


@router.post(
    "", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED
)
def create_connection(
    payload: ConnectionCreate,
    db: DbDep,
    current_user: CurrentUser,
    response: Response,
) -> ConnectionResponse:
    connection, created = connection_service.create_connection(
        db, to_user_id=payload.to_user_id, current_user=current_user
    )
    if not created:
        response.status_code = status.HTTP_200_OK
    return connection


@router.delete(
    "/{connection_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_connection(
    connection_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> None:
    connection_service.remove_connection(
        db, connection_id, current_user=current_user
    )
