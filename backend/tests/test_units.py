from datetime import date, timedelta

import pytest

from app.config import Settings
from app.ml.baseline import previous_close_forecast
from app.ml.forecast import (
    InsufficientHistoryError,
    build_prediction,
    next_business_day,
)
from app.schemas.stock import PricePoint
from app.services.market_data import (
    SUPPORTED_SYMBOLS,
    InvalidSymbolError,
    ensure_supported,
    normalize_symbol,
)


@pytest.mark.parametrize("raw,expected", [("aapl", "AAPL"), (" brk.b ", "BRK.B")])
def test_normalize_symbol(raw: str, expected: str) -> None:
    assert normalize_symbol(raw) == expected


@pytest.mark.parametrize("bad", ["", "12", "way-too-long-symbol", "a b"])
def test_normalize_rejects_bad_symbols(bad: str) -> None:
    with pytest.raises(InvalidSymbolError):
        normalize_symbol(bad)


@pytest.mark.parametrize("symbol", SUPPORTED_SYMBOLS)
def test_ensure_supported_accepts_universe(symbol: str) -> None:
    assert ensure_supported(symbol.lower()) == symbol


def test_ensure_supported_rejects_outside_universe() -> None:
    with pytest.raises(InvalidSymbolError):
        ensure_supported("AAPL")


def test_previous_close_forecast() -> None:
    assert previous_close_forecast([100.0, 101.5, 102.0]) == 102.0


def test_previous_close_forecast_empty() -> None:
    with pytest.raises(ValueError):
        previous_close_forecast([])


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("postgres://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("postgresql://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
    ],
)
def test_database_url_normalization(raw: str, expected: str) -> None:
    assert Settings(database_url=raw).database_url == expected


def test_next_business_day() -> None:
    assert next_business_day(date(2026, 10, 23)) == date(2026, 10, 26)
    assert next_business_day(date(2026, 10, 24)) == date(2026, 10, 26)
    assert next_business_day(date(2026, 10, 26)) == date(2026, 10, 27)


class FakeForecaster:
    def __init__(self, value: float) -> None:
        self.value = value
        self.context: list[float] = []

    def predict(self, context: list[float]) -> float:
        self.context = context
        return self.value


def _prices(count: int) -> list[PricePoint]:
    start = date(2026, 1, 1)
    return [
        PricePoint(date=(start + timedelta(days=i)).isoformat(), close=100.0 + i)
        for i in range(count)
    ]


def test_build_prediction() -> None:
    prices = _prices(40)
    forecaster = FakeForecaster(123.456)

    prediction = build_prediction("SPY", prices, forecaster)

    assert forecaster.context == [point.close for point in prices]
    assert prediction.symbol == "SPY"
    assert prediction.forecast_horizon == "1 trading day"
    assert prediction.last_observed_date == prices[-1].date
    assert prediction.last_observed_close == prices[-1].close
    assert prediction.forecast_date == next_business_day(
        date.fromisoformat(prices[-1].date)
    ).isoformat()
    assert prediction.predicted_close == 123.46
    assert prediction.model_name == "Google TimesFM 2.5"


def test_build_prediction_rejects_short_history() -> None:
    with pytest.raises(InsufficientHistoryError):
        build_prediction("SPY", _prices(2), FakeForecaster(100.0))


def test_build_prediction_rejects_invalid_forecast() -> None:
    with pytest.raises(ValueError):
        build_prediction("SPY", _prices(40), FakeForecaster(float("nan")))
