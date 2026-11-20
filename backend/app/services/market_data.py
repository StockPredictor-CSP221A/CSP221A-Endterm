import math
import re
from collections.abc import Mapping

import yfinance as yf

from app.schemas.stock import PricePoint, StockHistory, StockInfo

_SYMBOL_RE = re.compile(r"^[A-Za-z][A-Za-z0-9.\-]{0,9}$")

STOCK_UNIVERSE: tuple[StockInfo, ...] = (
    StockInfo(
        symbol="SPY",
        name="SPDR S&P 500 ETF",
        role="Safe",
        description="Broad US large-cap exposure and the locked benchmark asset.",
    ),
    StockInfo(
        symbol="NVDA",
        name="NVIDIA",
        role="Volatile",
        description="High-beta semiconductor name with larger price swings.",
    ),
    StockInfo(
        symbol="KO",
        name="Coca-Cola",
        role="Defensive",
        description="Low-volatility consumer staple with a contrasting regime.",
    ),
)

SUPPORTED_SYMBOLS = tuple(stock.symbol for stock in STOCK_UNIVERSE)


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


def get_stock_info(symbol: str) -> StockInfo:
    normalized = ensure_supported(symbol)
    return next(stock for stock in STOCK_UNIVERSE if stock.symbol == normalized)


def get_history(symbol: str, period: str = "1y") -> StockHistory:
    normalized = normalize_symbol(symbol)

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


def _has_usable_close(frame: object) -> bool:
    if frame is None or not hasattr(frame, "empty") or frame.empty:
        return False
    if "Close" not in frame:
        return False
    for close in frame["Close"]:
        try:
            value = float(close)
        except (TypeError, ValueError):
            continue
        if math.isfinite(value):
            return True
    return False


def _ticker_name(ticker: object, symbol: str) -> str:
    try:
        info = ticker.info
    except Exception:  # name lookup must never block adding a real ticker
        return symbol
    if not isinstance(info, Mapping):
        return symbol
    for key in ("shortName", "longName"):
        value = info.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return symbol


def lookup_watchlist_symbol(symbol: str) -> str:
    """Validate a custom ticker and return a display name.

    Raises InvalidSymbolError when the provider has no usable data and
    RuntimeError when the provider/network call itself fails.
    """
    normalized = normalize_symbol(symbol)
    try:
        ticker = yf.Ticker(normalized)
        frame = ticker.history(
            period="1mo", interval="1d", auto_adjust=False, actions=False
        )
    except Exception as exc:  # provider/network failure
        raise RuntimeError(
            f"Market data provider error for {normalized}"
        ) from exc

    if not _has_usable_close(frame):
        raise InvalidSymbolError(f"No market data found for {normalized}")

    return _ticker_name(ticker, normalized)
