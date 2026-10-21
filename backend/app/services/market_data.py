import re

import yfinance as yf

from app.schemas.stock import PricePoint, StockHistory

_SYMBOL_RE = re.compile(r"^[A-Za-z][A-Za-z0-9.\-]{0,9}$")


class InvalidSymbolError(ValueError):
    """Raised when a ticker symbol is malformed or has no available data."""


def normalize_symbol(symbol: str) -> str:
    cleaned = symbol.strip().upper()
    if not _SYMBOL_RE.match(cleaned):
        raise InvalidSymbolError(f"Invalid ticker symbol: {symbol!r}")
    return cleaned


def get_history(symbol: str, period: str = "1y") -> StockHistory:
    normalized = normalize_symbol(symbol)

    try:
        frame = yf.Ticker(normalized).history(period=period, interval="1d")
    except Exception as exc:  # provider/network failure
        raise RuntimeError(f"Market data provider error for {normalized}") from exc

    if frame is None or frame.empty:
        raise InvalidSymbolError(f"No historical data found for {normalized}")

    prices = [
        PricePoint(date=index.strftime("%Y-%m-%d"), close=round(float(row["Close"]), 2))
        for index, row in frame.iterrows()
    ]

    return StockHistory(symbol=normalized, interval="1d", prices=prices)
