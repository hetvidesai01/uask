from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.core.pagination import Page
from app.models.user import User
from app.schemas.thread import (
    MessageCreate,
    MessagePage,
    MessageResponse,
    ThreadResponse,
)
from app.services import message_service, thread_service

router = APIRouter(tags=["threads"])

DbDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_active_user)]


@router.get("/threads", response_model=Page[ThreadResponse])
def list_threads(
    db: DbDep,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> Page[ThreadResponse]:
    return thread_service.list_threads(
        db, current_user=current_user, page=page, page_size=page_size
    )


@router.get("/threads/{thread_id}", response_model=ThreadResponse)
def get_thread(
    thread_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> ThreadResponse:
    return thread_service.get_thread(db, thread_id, current_user=current_user)


@router.get("/threads/{thread_id}/messages", response_model=MessagePage)
def list_messages(
    thread_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
    before: UUID | None = Query(default=None),
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> MessagePage:
    return message_service.list_messages(
        db,
        thread_id,
        current_user=current_user,
        before=before,
        limit=limit,
    )


@router.post(
    "/threads/{thread_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    thread_id: UUID,
    payload: MessageCreate,
    db: DbDep,
    current_user: CurrentUser,
) -> MessageResponse:
    return message_service.send_message(
        db, thread_id, payload, current_user=current_user
    )
