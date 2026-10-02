import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.base import CamelModel
from app.schemas.user import UserPublic

ConnectionStatus = Literal["self", "none", "connected"]


class ConnectionCreate(CamelModel):
    to_user_id: uuid.UUID


class ConnectionResponse(CamelModel):
    """One side of a connection — always rendered from the viewer's side."""

    id: uuid.UUID
    connected_user_id: uuid.UUID
    connected_user: UserPublic | None = None
    created_at: datetime


class ConnectionStatusResponse(CamelModel):
    status: ConnectionStatus
    connection_id: uuid.UUID | None = None


class ConnectionCountResponse(CamelModel):
    count: int = Field(ge=0)
