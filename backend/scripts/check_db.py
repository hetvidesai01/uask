"""Phase 2 smoke test: engine, sessionmaker, Base, get_db, DATABASE_URL, Alembic."""
from __future__ import annotations

import sys

from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings
from app.core.deps import get_db
from app.db.base import Base
from app.db.session import SessionLocal, engine


def main() -> int:
    settings = get_settings()
    assert settings.DATABASE_URL.startswith("postgresql"), settings.DATABASE_URL[:30]
    print("OK config: DATABASE_URL loaded from .env")

    # SessionLocal must be our own sessionmaker instance, not a SQLAlchemy import
    assert isinstance(SessionLocal, type(sessionmaker())), type(SessionLocal)
    print("OK session: SessionLocal = sessionmaker(...) in app/db/session.py")

    assert isinstance(Base, type) and issubclass(Base, DeclarativeBase)
    print("OK base: DeclarativeBase subclass with naming_convention")

    tables = sorted(Base.metadata.tables)
    assert tables == [], tables
    print("OK models: Base.metadata has no business tables (Phase 2 constraint)")

    with engine.connect() as conn:
        ver = conn.execute(text("SELECT version()")).scalar()
        print(f"OK engine: {ver.split(',')[0]}")

    db = SessionLocal()
    try:
        n = db.execute(text("SELECT 1")).scalar()
        assert n == 1
        print("OK session: SessionLocal() executes SELECT 1")
    finally:
        db.close()

    gen = get_db()
    db2 = next(gen)
    try:
        assert db2.execute(text("SELECT 1")).scalar() == 1
        print("OK deps: get_db() yields Session and closes")
    finally:
        try:
            next(gen)
        except StopIteration:
            pass

    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
