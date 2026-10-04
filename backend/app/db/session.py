from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings

settings = get_settings()

# pool_pre_ping survives dropped connections (Supabase session pooler,
# Render's proxy); pool_recycle stops long-lived workers holding stale ones.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=settings.DB_POOL_RECYCLE,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
