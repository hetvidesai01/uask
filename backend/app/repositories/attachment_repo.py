from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.attachment import Attachment
from app.repositories.base import BaseRepository


class AttachmentRepository(BaseRepository[Attachment]):
    """Attachments are read one at a time (owner or entity scoped)."""

    def __init__(self, session: Session) -> None:
        super().__init__(session, Attachment)

    def list_for_entity(
        self, entity_type: str, entity_id: UUID
    ) -> list[Attachment]:
        stmt = (
            select(Attachment)
            .where(
                Attachment.entity_type == entity_type,
                Attachment.entity_id == entity_id,
            )
            .order_by(Attachment.created_at)
        )
        return list(self.session.scalars(stmt))
