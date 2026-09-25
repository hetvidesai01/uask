from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.core.pagination import Page
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.services import notification_service

router = APIRouter(tags=["notifications"])

DbDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_active_user)]


@router.get("/notifications", response_model=Page[NotificationResponse])
def list_notifications(
    db: DbDep,
    current_user: CurrentUser,
    unread_only: Annotated[bool, Query(alias="unreadOnly")] = False,
    page: int = Query(default=1, ge=1),
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> Page[NotificationResponse]:
    return notification_service.list_notifications(
        db,
        current_user=current_user,
        unread_only=unread_only,
        page=page,
        page_size=page_size,
    )


@router.patch(
    "/notifications/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
)
def mark_all_read(db: DbDep, current_user: CurrentUser) -> Response:
    notification_service.mark_all_read(db, current_user=current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_read(
    notification_id: UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> NotificationResponse:
    return notification_service.mark_read(
        db, notification_id, current_user=current_user
    )
