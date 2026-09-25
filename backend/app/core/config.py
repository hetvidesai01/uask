from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    TEST_DATABASE_URL: str = ""
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:5173"
    API_V1_PREFIX: str = "/api/v1"
    ENV: str = "development"
    COOKIE_SECURE: bool = False
    COOKIE_DOMAIN: str | None = None
    UPLOAD_BACKEND: str = "local"
    UPLOAD_MAX_MB: int = 10
    UPLOAD_DIR: str = "uploads"

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def upload_max_bytes(self) -> int:
        return self.UPLOAD_MAX_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
