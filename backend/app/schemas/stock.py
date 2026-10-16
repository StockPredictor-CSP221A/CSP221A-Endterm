from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class PricePoint(BaseModel):
    date: str
    close: float


class StockHistory(BaseModel):
    symbol: str
    interval: str
    prices: list[PricePoint]


class Prediction(BaseModel):
    symbol: str
    forecast_horizon: str
    last_observed_date: str
    last_observed_close: float
    forecast_date: str
    predicted_close: float
    model_name: str
    disclaimer: str = Field(
        default="Forecasts are uncertain and are not financial advice."
    )
