import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.base import CamelModel
from app.schemas.user import UserPublic


class ThreadCreate(CamelModel):
    participant_id: uuid.UUID
    ask_id: uuid.UUID | None = None
    offer_id: uuid.UUID | None = None


class MessageCreate(CamelModel):
    body: str = Field(min_length=1, max_length=5000)
    attachments: list[dict[str, Any]] = Field(default_factory=list, max_length=5)


class MessageResponse(CamelModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    attachments: list[dict[str, Any]] = []
    created_at: datetime
    sender: UserPublic | None = None


class LastMessagePreview(CamelModel):
    id: uuid.UUID
    body: str
    sender_id: uuid.UUID
    created_at: datetime


class ThreadResponse(CamelModel):
    id: uuid.UUID
    ask_id: uuid.UUID | None = None
    offer_id: uuid.UUID | None = None
    participant_ids: list[uuid.UUID] = []
    participants: list[UserPublic] = []
    last_message: LastMessagePreview | None = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime
