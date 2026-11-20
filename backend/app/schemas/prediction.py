from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PredictionOut(BaseModel):
    """A saved forecast as listed in the user's history."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    forecast_horizon: str
    last_observed_date: str
    last_observed_close: float
    forecast_date: str
    predicted_close: float
    model_name: str
    model_version: str | None
    created_at: datetime
