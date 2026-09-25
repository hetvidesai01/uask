import uuid
from datetime import datetime

from app.core.enums import NotificationType
from app.schemas.base import CamelModel


class NotificationResponse(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: NotificationType
    title: str
    body: str | None = None
    link: str | None = None
    read: bool
    created_at: datetime
