from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Protocol

from app.schemas.stock import Prediction, PricePoint

MODEL_NAME = "Google TimesFM 2.5"
MODEL_VERSION = "2.5-200m@1d952420"
CONTEXT_LENGTH = 1024
MIN_CONTEXT_LENGTH = 32


class ForecastModel(Protocol):
    def predict(self, context: list[float]) -> float: ...


class InsufficientHistoryError(ValueError):
    pass


def next_business_day(day: date) -> date:
    candidate = day + timedelta(days=1)
    while candidate.weekday() >= 5:
        candidate += timedelta(days=1)
    return candidate


def build_prediction(
    symbol: str,
    prices: list[PricePoint],
    forecaster: ForecastModel,
) -> Prediction:
    if len(prices) < MIN_CONTEXT_LENGTH:
        raise InsufficientHistoryError(
            f"Need at least {MIN_CONTEXT_LENGTH} observations for {symbol}, "
            f"got {len(prices)}"
        )

    closes = [point.close for point in prices[-CONTEXT_LENGTH:]]
    predicted = float(forecaster.predict(closes))
    if not math.isfinite(predicted) or predicted <= 0:
        raise ValueError(
            f"Model returned an invalid forecast for {symbol}: {predicted}"
        )

    last = prices[-1]
    forecast_date = next_business_day(date.fromisoformat(last.date))

    return Prediction(
        symbol=symbol,
        forecast_horizon="1 trading day",
        last_observed_date=last.date,
        last_observed_close=last.close,
        forecast_date=forecast_date.isoformat(),
        predicted_close=round(predicted, 2),
        model_name=MODEL_NAME,
    )
