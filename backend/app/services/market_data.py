import math
import re

import yfinance as yf

from app.schemas.stock import PricePoint, StockHistory

_SYMBOL_RE = re.compile(r"^[A-Za-z][A-Za-z0-9.\-]{0,9}$")

SUPPORTED_SYMBOLS = ("SPY", "NVDA", "KO")


class InvalidSymbolError(ValueError):
    """Raised when a ticker symbol is malformed or has no available data."""


def normalize_symbol(symbol: str) -> str:
    cleaned = symbol.strip().upper()
    if not _SYMBOL_RE.match(cleaned):
        raise InvalidSymbolError(f"Invalid ticker symbol: {symbol!r}")
    return cleaned


def ensure_supported(symbol: str) -> str:
    normalized = normalize_symbol(symbol)
    if normalized not in SUPPORTED_SYMBOLS:
        options = ", ".join(SUPPORTED_SYMBOLS)
        raise InvalidSymbolError(
            f"Unsupported symbol {normalized!r}. Choose one of: {options}"
        )
    return normalized


def get_history(symbol: str, period: str = "1y") -> StockHistory:
    normalized = ensure_supported(symbol)

    try:
        frame = yf.Ticker(normalized).history(
            period=period, interval="1d", auto_adjust=False, actions=False
        )
    except Exception as exc:  # provider/network failure
        raise RuntimeError(f"Market data provider error for {normalized}") from exc

    if frame is None or frame.empty:
        raise InvalidSymbolError(f"No historical data found for {normalized}")

    prices = []
    for index, row in frame.iterrows():
        close = float(row["Close"])
        if not math.isfinite(close):
            continue
        prices.append(
            PricePoint(date=index.strftime("%Y-%m-%d"), close=round(close, 2))
        )

    if not prices:
        raise InvalidSymbolError(f"No usable closing prices for {normalized}")

    return StockHistory(symbol=normalized, interval="1d", prices=prices)
