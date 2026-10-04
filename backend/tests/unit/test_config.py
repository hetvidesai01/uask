"""Phase 7 config guards — fail fast on unsafe settings."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import Settings

BASE = {
    "DATABASE_URL": "postgresql+psycopg://uask:uask@localhost:5432/uask",
    "JWT_SECRET": "a" * 48,
}


def _backend_path():
    return Path(__file__).resolve().parents[2]


def _settings(**overrides) -> Settings:
    payload = {**BASE, **overrides}
    return Settings(**payload)


def test_wildcard_cors_origin_is_rejected():
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        _settings(CORS_ORIGINS="*")


def test_cors_origins_are_explicit_and_deduped():
    settings = _settings(
        CORS_ORIGINS="http://localhost:5173, https://staging.example.com/",
        FRONTEND_URL="https://staging.example.com",
    )
    assert settings.cors_origins_list == [
        "http://localhost:5173",
        "https://staging.example.com",
    ]


def test_frontend_url_joins_allowed_origins():
    settings = _settings(
        CORS_ORIGINS="http://localhost:5173",
        FRONTEND_URL="https://app.example.com",
    )
    assert "https://app.example.com" in settings.cors_origins_list


def test_asymmetric_jwt_algorithm_is_rejected():
    with pytest.raises(ValidationError, match="JWT_ALGORITHM"):
        _settings(JWT_ALGORITHM="none")


def test_unknown_log_level_is_rejected():
    with pytest.raises(ValidationError, match="LOG_LEVEL"):
        _settings(LOG_LEVEL="verbose")


def test_placeholder_secret_is_rejected_in_production():
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        _settings(ENV="production", JWT_SECRET="change-me")


def test_short_secret_is_rejected_in_production():
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        _settings(ENV="production", JWT_SECRET="too-short")


def test_strong_secret_is_accepted_in_production():
    settings = _settings(ENV="production", JWT_SECRET="b" * 48)
    assert settings.is_production
    assert settings.JWT_SECRET == "b" * 48


def test_development_allows_placeholder_secret():
    assert _settings(ENV="development", JWT_SECRET="change-me").is_development


def test_invalid_rate_limit_bounds_rejected_in_production():
    with pytest.raises(ValidationError, match="RATE_LIMIT_LOGIN_MAX"):
        _settings(ENV="production", RATE_LIMIT_LOGIN_MAX=0)


def test_log_level_defaults_stay_safe_for_production():
    settings = _settings(ENV="production")
    assert settings.log_level in {"INFO", "WARNING", "ERROR", "CRITICAL"}


def test_env_example_holds_placeholders_only():
    example = _backend_path() / ".env.example"
    text = example.read_text(encoding="utf-8")
    assert "replace-with-openssl-rand-hex-32" in text
    assert "USER:PASSWORD@HOST" in text
    assert "SUPABASE_SERVICE_ROLE_KEY=" in text
    # nothing that looks like a live credential
    assert "postgresql+psycopg://uask:uask@" not in text


def test_env_file_is_gitignored():
    gitignore = (_backend_path() / ".gitignore").read_text(encoding="utf-8")
    assert ".env" in gitignore.split()


# --------------------------------------------------------------------------
# Phase 8 — deployment compatibility
# --------------------------------------------------------------------------


def test_paas_postgres_scheme_is_normalized():
    """Render hands out postgres:// — SQLAlchemy 2 + psycopg 3 needs a driver."""
    settings = _settings(
        DATABASE_URL="postgres://uask:secret@db.internal:5432/uask?sslmode=require"
    )
    assert settings.DATABASE_URL == (
        "postgresql+psycopg://uask:secret@db.internal:5432/uask?sslmode=require"
    )


def test_bare_postgresql_scheme_gains_the_psycopg_driver():
    settings = _settings(DATABASE_URL="postgresql://uask:secret@db:5432/uask")
    assert settings.DATABASE_URL == (
        "postgresql+psycopg://uask:secret@db:5432/uask"
    )


def test_driver_qualified_url_is_untouched():
    url = "postgresql+psycopg://uask:uask@localhost:5432/uask"
    assert _settings(DATABASE_URL=url).DATABASE_URL == url


def test_test_database_url_is_normalized_too():
    settings = _settings(TEST_DATABASE_URL="postgres://uask:pw@db/uask_test")
    assert settings.TEST_DATABASE_URL.startswith("postgresql+psycopg://")


def test_docs_default_matches_environment():
    assert _settings(ENV="production").docs_exposed is False
    assert _settings(ENV="development").docs_exposed is True


def test_docs_flag_forces_docs_on_in_production():
    settings = _settings(ENV="production", DOCS_ENABLED=True)
    assert settings.docs_exposed is True


def test_docs_flag_forces_docs_off_in_development():
    settings = _settings(ENV="development", DOCS_ENABLED=False)
    assert settings.docs_exposed is False


def test_empty_docs_flag_string_means_unset():
    assert _settings(DOCS_ENABLED="").DOCS_ENABLED is None
