from sqlalchemy import create_engine
from sqlalchemy.orm import SessionLocal

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

SessionLocal = SessionLocal(bind=engine, autocommit=False, autoflush=False)
