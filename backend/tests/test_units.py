import pytest

from app.ml.baseline import previous_close_forecast
from app.services.market_data import InvalidSymbolError, normalize_symbol


@pytest.mark.parametrize("raw,expected", [("aapl", "AAPL"), (" brk.b ", "BRK.B")])
def test_normalize_symbol(raw: str, expected: str) -> None:
    assert normalize_symbol(raw) == expected


@pytest.mark.parametrize("bad", ["", "12", "way-too-long-symbol", "a b"])
def test_normalize_rejects_bad_symbols(bad: str) -> None:
    with pytest.raises(InvalidSymbolError):
        normalize_symbol(bad)


def test_previous_close_forecast() -> None:
    assert previous_close_forecast([100.0, 101.5, 102.0]) == 102.0


def test_previous_close_forecast_empty() -> None:
    with pytest.raises(ValueError):
        previous_close_forecast([])
