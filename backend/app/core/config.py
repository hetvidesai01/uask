"""Application settings — every environment-specific value lives here.

Fail fast at startup: a bad CORS rule, a weak algorithm, or a placeholder
secret in production stops the process before it serves a single request.
"""

from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

_ALLOWED_JWT_ALGORITHMS = frozenset({"HS256", "HS384", "HS512"})
_PLACEHOLDER_SECRETS = frozenset(
    {
        "",
        "change-me",
        "change-me-openssl-rand-hex-32",
        "changeme",
        "secret",
        "password",
    }
)
_LOG_LEVELS = frozenset(
    {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}
)
# Named rate-limit buckets: RATE_LIMIT_<BUCKET>_MAX / _WINDOW_SECONDS
RATE_LIMIT_BUCKETS = ("LOGIN", "SIGNUP", "REFRESH", "UPLOAD", "MESSAGE")


class Settings(BaseSettings):
    DATABASE_URL: str
    TEST_DATABASE_URL: str = ""
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:5173"
    FRONTEND_URL: str = ""
    API_V1_PREFIX: str = "/api/v1"
    ENV: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    # None = default (docs hidden when ENV=production). Staging sets true,
    # hardened prod can force false — either way the choice is explicit.
    DOCS_ENABLED: bool | None = None
    COOKIE_SECURE: bool = False
    COOKIE_DOMAIN: str | None = None
    # Trust X-Forwarded-For (Render/Railway/nginx) for per-client rate keys.
    BEHIND_PROXY: bool = False
    STORAGE_PROVIDER: str = "local"
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = ""
    UPLOAD_MAX_MB: int = 10
    UPLOAD_DIR: str = "uploads"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 1800
    DB_POOL_PRE_PING: bool = True
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_LOGIN_MAX: int = 10
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = 60
    RATE_LIMIT_SIGNUP_MAX: int = 10
    RATE_LIMIT_SIGNUP_WINDOW_SECONDS: int = 60
    RATE_LIMIT_REFRESH_MAX: int = 30
    RATE_LIMIT_REFRESH_WINDOW_SECONDS: int = 60
    RATE_LIMIT_UPLOAD_MAX: int = 60
    RATE_LIMIT_UPLOAD_WINDOW_SECONDS: int = 60
    RATE_LIMIT_MESSAGE_MAX: int = 120
    RATE_LIMIT_MESSAGE_WINDOW_SECONDS: int = 60

    model_config = {"env_file": ".env", "extra": "ignore"}

    @field_validator("DATABASE_URL", "TEST_DATABASE_URL", mode="before")
    @classmethod
    def _normalize_postgres_scheme(cls, value: object) -> object:
        """Render/Railway hand out ``postgres://``; SQLAlchemy 2 needs a driver.

        Without this the process dies with ``NoSuchModuleError`` the moment it
        connects (psycopg2 is not installed — we speak psycopg 3).
        """
        if not isinstance(value, str):
            return value
        url = value.strip()
        for legacy in ("postgres://", "postgresql://"):
            if url.startswith(legacy):
                return "postgresql+psycopg://" + url[len(legacy) :]
        return url

    @field_validator("DOCS_ENABLED", mode="before")
    @classmethod
    def _empty_docs_flag_is_unset(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("CORS_ORIGINS")
    @classmethod
    def _no_wildcard_origins(cls, value: str) -> str:
        origins = [origin.strip() for origin in value.split(",")]
        if any(origin == "*" for origin in origins):
            raise ValueError(
                "CORS_ORIGINS must list explicit origins; '*' cannot be "
                "combined with credentialed CORS."
            )
        return ",".join(origin for origin in origins if origin)

    @field_validator("JWT_ALGORITHM")
    @classmethod
    def _symmetric_algorithms_only(cls, value: str) -> str:
        if value not in _ALLOWED_JWT_ALGORITHMS:
            raise ValueError(
                f"JWT_ALGORITHM must be one of {sorted(_ALLOWED_JWT_ALGORITHMS)}."
            )
        return value

    @field_validator("LOG_LEVEL")
    @classmethod
    def _known_log_level(cls, value: str) -> str:
        level = value.upper()
        if level not in _LOG_LEVELS:
            raise ValueError(
                f"LOG_LEVEL must be one of {sorted(_LOG_LEVELS)}."
            )
        return level

    @field_validator("LOG_FORMAT")
    @classmethod
    def _known_log_format(cls, value: str) -> str:
        fmt = value.lower()
        if fmt not in {"json", "plain"}:
            raise ValueError("LOG_FORMAT must be 'json' or 'plain'.")
        return fmt

    @model_validator(mode="after")
    def _production_guards(self) -> "Settings":
        if not self.is_production:
            return self
        secret = self.JWT_SECRET.strip()
        if len(secret) < 32 or secret.lower() in _PLACEHOLDER_SECRETS:
            raise ValueError(
                "JWT_SECRET must be a unique 32+ character secret when "
                "ENV=production."
            )
        for bucket in RATE_LIMIT_BUCKETS:
            limit = getattr(self, f"RATE_LIMIT_{bucket}_MAX")
            window = getattr(self, f"RATE_LIMIT_{bucket}_WINDOW_SECONDS")
            if limit < 1 or window < 1:
                raise ValueError(
                    f"RATE_LIMIT_{bucket}_MAX and RATE_LIMIT_{bucket}_"
                    "WINDOW_SECONDS must be >= 1."
                )
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        """Explicit origins only — local dev plus FRONTEND_URL when set."""
        origins: list[str] = []
        for raw in f"{self.CORS_ORIGINS},{self.FRONTEND_URL}".split(","):
            origin = raw.strip().rstrip("/")
            if origin and origin not in origins:
                origins.append(origin)
        return origins

    @property
    def upload_max_bytes(self) -> int:
        return self.UPLOAD_MAX_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() == "production"

    @property
    def is_development(self) -> bool:
        return self.ENV.lower() in {"development", "dev", ""}

    @property
    def docs_exposed(self) -> bool:
        """Interactive API docs: an explicit DOCS_ENABLED wins, else the
        production default hides them (staging opts in with true)."""
        if self.DOCS_ENABLED is not None:
            return self.DOCS_ENABLED
        return not self.is_production

    @property
    def log_level(self) -> str:
        return "DEBUG" if self.DEBUG else self.LOG_LEVEL


@lru_cache
def get_settings() -> Settings:
    return Settings()
