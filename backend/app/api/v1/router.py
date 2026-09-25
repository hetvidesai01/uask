from fastapi import APIRouter

from app.api.v1.routes.asks import router as asks_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.users import router as users_router

v1_router = APIRouter()
v1_router.include_router(auth_router)
v1_router.include_router(health_router)
v1_router.include_router(users_router)
v1_router.include_router(asks_router)
