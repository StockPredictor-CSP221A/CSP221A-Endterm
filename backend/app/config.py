from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Stock Predictor API"
    version: str = "0.1.0"
    api_prefix: str = "/api"

    cors_origins: list[str] = ["http://localhost:5173"]

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/stock_predictor"

    default_history_period: str = "1y"


@lru_cache
def get_settings() -> Settings:
    return Settings()
