from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.db_models.watchlist import WatchlistItem
from app.schemas.watchlist import WatchlistEntry
from app.services import market_data

MAX_ADDED_STOCKS = 20
CUSTOM_ROLE = "Custom"
CUSTOM_DESCRIPTION = "Added to your watchlist."


class WatchlistLimitError(Exception):
    """Raised when a user already has the maximum number of added stocks."""


def _is_default(symbol: str) -> bool:
    return symbol in market_data.SUPPORTED_SYMBOLS


def _entry(item: WatchlistItem) -> WatchlistEntry:
    if _is_default(item.symbol):
        info = market_data.get_stock_info(item.symbol)
        return WatchlistEntry(
            **info.model_dump(), added_at=item.created_at, is_default=True
        )
    return WatchlistEntry(
        symbol=item.symbol,
        name=item.name or item.symbol,
        role=CUSTOM_ROLE,
        description=CUSTOM_DESCRIPTION,
        added_at=item.created_at,
        is_default=False,
    )


def _items(db: Session, user_id: int) -> list[WatchlistItem]:
    return list(
        db.scalars(select(WatchlistItem).where(WatchlistItem.user_id == user_id))
    )


def list_watchlist(
    db: Session, user_id: int, q: str | None = None
) -> list[WatchlistEntry]:
    """The user's watched symbols: defaults first, then added stocks by age."""
    items = _items(db, user_id)
    defaults = sorted(
        (item for item in items if _is_default(item.symbol)),
        key=lambda item: market_data.SUPPORTED_SYMBOLS.index(item.symbol),
    )
    custom = sorted(
        (item for item in items if not _is_default(item.symbol)),
        key=lambda item: (item.created_at, item.id),
    )

    entries = [_entry(item) for item in (*defaults, *custom)]
    term = (q or "").strip().casefold()
    if term:
        entries = [
            entry
            for entry in entries
            if term in entry.symbol.casefold() or term in entry.name.casefold()
        ]
    return entries


def add_watchlist_item(db: Session, user_id: int, symbol: str) -> WatchlistEntry:
    """Add a default or real custom ticker; re-adding one returns the existing row."""
    normalized = market_data.normalize_symbol(symbol)
    items = _items(db, user_id)
    existing = next((item for item in items if item.symbol == normalized), None)
    if existing is not None:
        return _entry(existing)

    name: str | None = None
    if not _is_default(normalized):
        added_count = sum(1 for item in items if not _is_default(item.symbol))
        if added_count >= MAX_ADDED_STOCKS:
            raise WatchlistLimitError(
                f"Watchlists are limited to {MAX_ADDED_STOCKS} added stocks"
            )
        name = market_data.lookup_watchlist_symbol(normalized)

    item = WatchlistItem(user_id=user_id, symbol=normalized, name=name)
    try:
        db.add(item)
        db.commit()
        db.refresh(item)
    except IntegrityError:
        # A concurrent request inserted the same row first.
        db.rollback()
        existing = db.scalar(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user_id,
                WatchlistItem.symbol == normalized,
            )
        )
        if existing is None:
            raise
        return _entry(existing)
    except SQLAlchemyError:
        db.rollback()
        raise

    return _entry(item)


def remove_watchlist_item(db: Session, user_id: int, symbol: str) -> None:
    """Remove a watched symbol; removing one that is absent is a no-op."""
    normalized = market_data.normalize_symbol(symbol)
    try:
        db.execute(
            delete(WatchlistItem).where(
                WatchlistItem.user_id == user_id,
                WatchlistItem.symbol == normalized,
            )
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise
