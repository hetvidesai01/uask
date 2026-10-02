"""Connection data access: pair lookup, listing, and profile counts."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.connection import Connection
from app.models.user import User


def find_pair(
    session: Session, user_a: UUID, user_b: UUID
) -> Connection | None:
    """The single row for an unordered pair — order-insensitive lookup."""
    left, right = Connection.ordered(user_a, user_b)
    stmt = select(Connection).where(
        Connection.user_a_id == left,
        Connection.user_b_id == right,
    )
    return session.scalar(stmt)


def create(
    session: Session, *, user_a: UUID, user_b: UUID
) -> Connection:
    """Insert a new pair (callers must pass canonical `user_a < user_b`)."""
    connection = Connection(user_a_id=user_a, user_b_id=user_b)
    session.add(connection)
    session.flush()
    return connection


def list_for_user(
    session: Session, user_id: UUID, *, offset: int = 0, limit: int = 20
) -> tuple[list[Connection], int]:
    """Connections touching `user_id`, newest first."""
    stmt = select(Connection).where(
        (Connection.user_a_id == user_id) | (Connection.user_b_id == user_id)
    )
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        session.scalars(
            stmt.order_by(Connection.created_at.desc(), Connection.id.desc())
            .offset(offset)
            .limit(limit)
        )
        .all()
    )
    return list(rows), total


def count_for_user(session: Session, user_id: UUID) -> int:
    """Total connections for a profile — used by GET /connections/count."""
    return (
        session.scalar(
            select(func.count())
            .select_from(Connection)
            .where(
                (Connection.user_a_id == user_id)
                | (Connection.user_b_id == user_id)
            )
        )
        or 0
    )


def users_map(session: Session, user_ids: list[UUID]) -> dict[UUID, User]:
    """Profiles for connection partners in one query (no N+1)."""
    unique = list({uid for uid in user_ids if uid is not None})
    if not unique:
        return {}
    stmt = select(User).where(User.id.in_(unique))
    return {user.id: user for user in session.scalars(stmt)}
