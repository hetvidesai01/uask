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
    """One side of a connection — always rendered from the viewer's side.

    The frontend service reads `connectionId`/`userId`/`since`; those aliases
    are additive alongside the original keys (renames are never allowed).
    """

    id: uuid.UUID
    connected_user_id: uuid.UUID
    connected_user: UserPublic | None = None
    created_at: datetime
    connection_id: uuid.UUID
    user_id: uuid.UUID
    since: datetime


class ConnectionStatusResponse(CamelModel):
    status: ConnectionStatus
    connection_id: uuid.UUID | None = None


class ConnectionCountResponse(CamelModel):
    count: int = Field(ge=0)
