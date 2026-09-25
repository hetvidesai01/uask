import os
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.core.deps import get_current_active_user
from app.models.user import User
from app.schemas.common import AttachmentRef
from app.services import upload_service

router = APIRouter(tags=["uploads"])

CurrentUser = Annotated[User, Depends(get_current_active_user)]


@router.post(
    "/uploads",
    response_model=AttachmentRef,
    status_code=status.HTTP_201_CREATED,
)
def upload_file(
    file: Annotated[UploadFile, File(...)],
    current_user: CurrentUser,
) -> AttachmentRef:
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    upload_service.ensure_within_limit(size)
    return upload_service.create_upload(
        data=file.file.read(),
        filename=file.filename,
        content_type=file.content_type,
    )
