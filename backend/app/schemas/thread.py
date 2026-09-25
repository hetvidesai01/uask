import uuid
from datetime import datetime
from typing import Any

from pydantic import Field, field_validator

from app.core.enums import AskStatus
from app.schemas.base import CamelModel
from app.schemas.user import UserPublic


class MessageCreate(CamelModel):
    body: str = Field(min_length=1, max_length=5000)
    attachments: list[dict[str, Any]] = Field(default_factory=list, max_length=5)

    @field_validator("body")
    @classmethod
    def body_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("body must not be blank.")
        return v


class MessageResponse(CamelModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    attachments: list[dict[str, Any]] = []
    read: bool = False
    created_at: datetime
    sender: UserPublic | None = None


class LastMessagePreview(CamelModel):
    id: uuid.UUID
    body: str
    sender_id: uuid.UUID
    created_at: datetime


class ThreadAskRef(CamelModel):
    id: uuid.UUID
    title: str
    category: str
    status: AskStatus


class ThreadResponse(CamelModel):
    id: uuid.UUID
    ask_id: uuid.UUID | None = None
    ask: ThreadAskRef | None = None
    offer_id: uuid.UUID | None = None
    participant_ids: list[uuid.UUID] = []
    participants: list[UserPublic] = []
    last_message: LastMessagePreview | None = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime


class MessagePage(CamelModel):
    """Cursor-paginated history — not the page-number envelope."""

    items: list[MessageResponse] = []
    next_cursor: uuid.UUID | None = None
    has_more: bool = False
    limit: int = Field(ge=1, le=100)
