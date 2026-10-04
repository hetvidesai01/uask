import os
import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.core.ratelimit import user_rate_limit
from app.models.user import User
from app.schemas.common import AttachmentRef
from app.services import upload_service

router = APIRouter(tags=["uploads"])

CurrentUser = Annotated[User, Depends(get_current_active_user)]
DbDep = Annotated[Session, Depends(get_db)]
UploadLimit = Annotated[str, Depends(user_rate_limit("upload"))]


@router.post(
    "/uploads",
    response_model=AttachmentRef,
    status_code=status.HTTP_201_CREATED,
)
def upload_file(
    db: DbDep,
    current_user: CurrentUser,
    _rate_limit: UploadLimit,
    file: Annotated[UploadFile, File(...)],
    entity_type: Annotated[str | None, Form(alias="entityType")] = None,
    entity_id: Annotated[str | None, Form(alias="entityId")] = None,
) -> AttachmentRef:
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    upload_service.ensure_within_limit(size)
    return upload_service.create_upload(
        db,
        data=file.file.read(),
        filename=file.filename,
        content_type=file.content_type,
        current_user=current_user,
        entity_type=entity_type,
        entity_id=entity_id,
    )


@router.delete(
    "/uploads/{upload_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_upload(
    upload_id: uuid.UUID,
    db: DbDep,
    current_user: CurrentUser,
) -> Response:
    upload_service.delete_upload(
        db, upload_id=upload_id, current_user=current_user
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
