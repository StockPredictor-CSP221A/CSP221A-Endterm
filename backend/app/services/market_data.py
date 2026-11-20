import math
import re

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
