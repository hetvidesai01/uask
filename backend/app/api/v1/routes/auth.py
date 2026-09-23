from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_active_user, get_db
from app.core.security import REFRESH_COOKIE_NAME
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, RefreshResponse, SignupRequest
from app.schemas.user import UserResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

DbDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_active_user)]


def _cookie_flags() -> dict:
    settings = get_settings()
    secure = settings.COOKIE_SECURE or settings.is_production
    return {
        "httponly": True,
        "secure": secure,
        "samesite": "lax",
        "domain": settings.COOKIE_DOMAIN or None,
        "path": "/",
    }


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        max_age=max_age,
        **_cookie_flags(),
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, **_cookie_flags())


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(
    payload: SignupRequest,
    db: DbDep,
    response: Response,
) -> AuthResponse:
    user, access, refresh_token = auth_service.signup(db, payload)
    _set_refresh_cookie(response, refresh_token)
    return AuthResponse(user=user, access_token=access)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    db: DbDep,
    response: Response,
) -> AuthResponse:
    user, access, refresh_token = auth_service.login(db, payload)
    _set_refresh_cookie(response, refresh_token)
    return AuthResponse(user=user, access_token=access)


@router.post("/refresh", response_model=RefreshResponse)
def refresh(
    request: Request,
    db: DbDep,
    response: Response,
) -> RefreshResponse:
    opaque = request.cookies.get(REFRESH_COOKIE_NAME)
    access, new_refresh = auth_service.refresh_rotate(db, opaque or "")
    _set_refresh_cookie(response, new_refresh)
    return RefreshResponse(access_token=access)


@router.get("/me", response_model=UserResponse)
def me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    current_user: CurrentUser,
    db: DbDep,
    response: Response,
) -> None:
    opaque = request.cookies.get(REFRESH_COOKIE_NAME)
    auth_service.logout(db, current_user.id, opaque)
    _clear_refresh_cookie(response)
