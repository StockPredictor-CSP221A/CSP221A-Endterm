"""Headlines for the supported symbols from yfinance.

News is best effort: any provider failure yields an empty list so the UI
can hide the section instead of erroring.
"""

import logging
import threading
import time
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Any

import yfinance as yf

from app.schemas.news import NewsItem

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 10 * 60
MAX_ITEMS = 10

_cache: dict[str, tuple[float, list[NewsItem]]] = {}
_cache_lock = threading.Lock()


def _dig(data: Any, *path: str) -> Any:
    for key in path:
        if not isinstance(data, Mapping):
            return None
        data = data.get(key)
    return data


def _text(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _http_url(value: Any) -> str | None:
    url = _text(value)
    return url if url and url.startswith(("https://", "http://")) else None


def _iso_from_epoch(value: Any) -> str | None:
    if isinstance(value, int | float) and value > 0:
        return datetime.fromtimestamp(value, tz=UTC).isoformat()
    return None


def _iso_from_string(value: Any) -> str | None:
    text = _text(value)
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.isoformat()


def _thumbnail(thumbnail: Any) -> str | None:
    resolutions = _dig(thumbnail, "resolutions")
    if isinstance(resolutions, list):
        sized = [
            item
            for item in resolutions
            if isinstance(item, Mapping) and _http_url(item.get("url"))
        ]
        if sized:
            # Smallest image that is still at least 140px wide, else the largest.
            sized.sort(key=lambda item: item.get("width") or 0)
            pick = next(
                (item for item in sized if (item.get("width") or 0) >= 140),
                sized[-1],
            )
            return _http_url(pick.get("url"))
    return _http_url(_dig(thumbnail, "originalUrl"))


def normalize_item(raw: Any) -> NewsItem | None:
    """Map either yfinance news shape to a NewsItem, or None if unusable."""
    if not isinstance(raw, Mapping):
        return None

    content = raw.get("content")
    if isinstance(content, Mapping):
        # Current shape: {"id": ..., "content": {...}}
        title = _text(content.get("title"))
        url = _http_url(_dig(content, "canonicalUrl", "url")) or _http_url(
            _dig(content, "clickThroughUrl", "url")
        )
        publisher = _text(_dig(content, "provider", "displayName"))
        published_at = _iso_from_string(content.get("pubDate")) or _iso_from_string(
            content.get("displayTime")
        )
        thumbnail = _thumbnail(content.get("thumbnail"))
    else:
        # Legacy flat shape.
        title = _text(raw.get("title"))
        url = _http_url(raw.get("link"))
        publisher = _text(raw.get("publisher"))
        published_at = _iso_from_epoch(raw.get("providerPublishTime"))
        thumbnail = _thumbnail(raw.get("thumbnail"))

    if not title or not url:
        return None
    return NewsItem(
        title=title,
        publisher=publisher,
        url=url,
        published_at=published_at,
        thumbnail=thumbnail,
    )


def normalize_news(raw_items: Any) -> list[NewsItem]:
    if not isinstance(raw_items, list):
        return []
    items: list[NewsItem] = []
    seen: set[str] = set()
    for raw in raw_items:
        item = normalize_item(raw)
        if item and item.url not in seen:
            seen.add(item.url)
            items.append(item)
    items.sort(key=lambda item: item.published_at or "", reverse=True)
    return items[:MAX_ITEMS]


def _fetch_raw(symbol: str) -> Any:
    ticker = yf.Ticker(symbol)
    get_news = getattr(ticker, "get_news", None)
    if callable(get_news):
        return get_news(count=MAX_ITEMS)
    return ticker.news


def get_news(
    symbol: str,
    limit: int,
    *,
    fetch: Callable[[str], Any] | None = None,
    now: Callable[[], float] = time.monotonic,
) -> list[NewsItem]:
    """Normalized headlines for an already-validated symbol; [] on any failure."""
    fetch = fetch or _fetch_raw
    with _cache_lock:
        cached = _cache.get(symbol)
    if cached and now() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1][:limit]

    try:
        items = normalize_news(fetch(symbol))
    except Exception:
        logger.warning("News lookup failed for %s", symbol, exc_info=True)
        return []

    if items:
        with _cache_lock:
            _cache[symbol] = (now(), items)
    return items[:limit]


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()
