from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class PredictionRecord(Base):
    """Persisted prediction history (schema evolves via Alembic)."""

    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(16), index=True)
    forecast_horizon: Mapped[str] = mapped_column(String(32))
    last_observed_date: Mapped[str] = mapped_column(String(10))
    last_observed_close: Mapped[float] = mapped_column(Float)
    forecast_date: Mapped[str] = mapped_column(String(10))
    predicted_close: Mapped[float] = mapped_column(Float)
    model_name: Mapped[str] = mapped_column(String(128))
    model_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
