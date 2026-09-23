from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.base import Base


class BaseRepository[ModelT: Base]:
    """Minimal shared CRUD. Prefer dedicated queries when they read better."""

    def __init__(self, session: Session, model: type[ModelT]) -> None:
        self.session = session
        self.model = model

    def get(self, id: Any) -> ModelT | None:
        return self.session.get(self.model, id)

    def add(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        self.session.flush()
        return obj

    def delete(self, obj: ModelT) -> None:
        self.session.delete(obj)
        self.session.flush()

    def list(
        self,
        *,
        offset: int | None = None,
        limit: int | None = None,
    ) -> list[ModelT]:
        stmt = select(self.model)
        if offset is not None:
            stmt = stmt.offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)
        return list(self.session.scalars(stmt))

    def delete_where(self, *criteria: Any) -> None:
        self.session.execute(delete(self.model).where(*criteria))
