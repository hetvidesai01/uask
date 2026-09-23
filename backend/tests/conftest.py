import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

os.environ["DATABASE_URL"] = (
    "postgresql+psycopg://uask:uask@localhost:5432/uask_test"
)
os.environ["TEST_DATABASE_URL"] = (
    "postgresql+psycopg://uask:uask@localhost:5432/uask_test"
)

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.core.deps import get_db  # noqa: E402
from app.main import app  # noqa: E402

settings = get_settings()
TEST_URL = settings.TEST_DATABASE_URL

engine = create_engine(
    TEST_URL,
    pool_pre_ping=True,
    # No pooling — every connect is fresh so TRUNCATE cannot deadlock
    poolclass=NullPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

_TABLES = [
    "thread_participants",
    "messages",
    "threads",
    "offers",
    "asks",
    "notifications",
    "refresh_tokens",
    "users",
]
_TRUNCATE_SQL = text(
    "TRUNCATE " + ", ".join(_TABLES) + " RESTART IDENTITY CASCADE"
)


def _truncate_all() -> None:
    # NullPool: dispose is a no-op safety; AUTOCOMMIT avoids leftover txns
    engine.dispose()
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(_TRUNCATE_SQL)


@pytest.fixture(autouse=True)
def clean_db() -> Generator[None, None, None]:
    _truncate_all()
    yield
    _truncate_all()


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        try:
            session.rollback()
        finally:
            session.close()


@pytest.fixture()
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def signup_payload() -> dict:
    return {
        "name": "Test User",
        "email": "test@example.com",
        "password": "password123",
        "roles": ["seeker"],
    }


@pytest.fixture()
def provider_payload() -> dict:
    return {
        "name": "Provider User",
        "email": "provider@example.com",
        "password": "password123",
        "roles": ["provider"],
    }


@pytest.fixture()
def both_roles_payload() -> dict:
    return {
        "name": "Both User",
        "email": "both@example.com",
        "password": "password123",
        "roles": ["seeker", "provider"],
    }
