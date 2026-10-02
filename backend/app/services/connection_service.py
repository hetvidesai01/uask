"""Connection business rules: instant connect, status, listing, removal."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.core.pagination import Page, PageParams, build_page
from app.models.connection import Connection
from app.models.user import User
from app.repositories import connection_repo
from app.schemas.connection import ConnectionResponse, ConnectionStatusResponse
from app.schemas.user import UserPublic


def _to_response(
    connection: Connection, *, viewer_id: UUID, users: dict[UUID, User]
) -> ConnectionResponse:
    other_id = connection.other_user_id(viewer_id)
    other = users.get(other_id)
    return ConnectionResponse(
        id=connection.id,
        connected_user_id=other_id,
        connected_user=UserPublic.model_validate(other) if other else None,
        created_at=connection.created_at,
    )


def create_connection(
    db: Session, *, to_user_id: UUID, current_user: User
) -> tuple[ConnectionResponse, bool]:
    """Instantly connect two users. Returns (response, created).

    Repeating the call is idempotent: the existing connection is returned
    with `created=False` and no second row is written.
    """
    if to_user_id == current_user.id:
        raise ValidationError(
            "You cannot connect with yourself.", code="SELF_CONNECTION"
        )
    target = db.get(User, to_user_id)
    if target is None:
        raise NotFoundError("User not found.", code="USER_NOT_FOUND")

    user_a, user_b = Connection.ordered(current_user.id, to_user_id)
    existing = connection_repo.find_pair(db, user_a, user_b)
    viewer = {target.id: target}
    if existing is not None:
        return _to_response(existing, viewer_id=current_user.id, users=viewer), False

    connection = connection_repo.create(db, user_a=user_a, user_b=user_b)
    response = _to_response(connection, viewer_id=current_user.id, users=viewer)
    db.commit()
    return response, True


def connection_status(
    db: Session, *, target_user_id: UUID, current_user: User
) -> ConnectionStatusResponse:
    if target_user_id == current_user.id:
        return ConnectionStatusResponse(status="self")
    if db.get(User, target_user_id) is None:
        raise NotFoundError("User not found.", code="USER_NOT_FOUND")
    connection = connection_repo.find_pair(db, current_user.id, target_user_id)
    if connection is None:
        return ConnectionStatusResponse(status="none")
    return ConnectionStatusResponse(
        status="connected", connection_id=connection.id
    )


def remove_connection(
    db: Session, connection_id: UUID, *, current_user: User
) -> None:
    connection = db.get(Connection, connection_id)
    if connection is None:
        raise NotFoundError(
            "Connection not found.", code="CONNECTION_NOT_FOUND"
        )
    if current_user.id not in (connection.user_a_id, connection.user_b_id):
        raise ForbiddenError(
            "You do not have access to this connection.", code="FORBIDDEN"
        )
    db.delete(connection)
    db.commit()


def list_connections(
    db: Session,
    user_id: UUID,
    *,
    page: int = 1,
    page_size: int = 20,
) -> Page[ConnectionResponse]:
    if db.get(User, user_id) is None:
        raise NotFoundError("User not found.", code="USER_NOT_FOUND")
    pp = PageParams(page=page, page_size=page_size)
    rows, total = connection_repo.list_for_user(
        db, user_id, offset=pp.offset, limit=pp.limit
    )
    users = connection_repo.users_map(
        db, [row.other_user_id(user_id) for row in rows]
    )
    items = [
        _to_response(row, viewer_id=user_id, users=users) for row in rows
    ]
    return build_page(items, page=pp.page, page_size=pp.page_size, total=total)


def count_connections(db: Session, user_id: UUID) -> int:
    if db.get(User, user_id) is None:
        raise NotFoundError("User not found.", code="USER_NOT_FOUND")
    return connection_repo.count_for_user(db, user_id)
