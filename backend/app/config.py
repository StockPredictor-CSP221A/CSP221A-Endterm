from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Stock Predictor API"
    version: str = "0.1.0"
    api_prefix: str = "/api"

    cors_origins: list[str] = ["http://localhost:5173"]

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/stock_predictor"

    default_history_period: str = "1y"

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        """Accept hosted Postgres URLs and force the psycopg 3 driver.

        Neon, Render, and Railway hand out ``postgres://`` or
        ``postgresql://`` URLs; SQLAlchemy needs the driver in the scheme.
        """
        if value.startswith("postgres://"):
            value = "postgresql+psycopg://" + value.removeprefix("postgres://")
        elif value.startswith("postgresql://"):
            value = "postgresql+psycopg://" + value.removeprefix("postgresql://")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
