import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.deps import CurrentUser, DbSession
from app.db_models.watchlist import WatchlistItem
from app.schemas.watchlist import WatchlistEntry
from app.services.market_data import (
    SUPPORTED_SYMBOLS,
    InvalidSymbolError,
    ensure_supported,
    get_stock_info,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


def supported_symbol(symbol: str) -> str:
    try:
        return ensure_supported(symbol)
    except InvalidSymbolError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


Symbol = Annotated[str, Depends(supported_symbol)]


def _db_unavailable(exc: SQLAlchemyError) -> HTTPException:
    logger.exception("Watchlist database operation failed")
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable"
    )


def _entry(item: WatchlistItem) -> WatchlistEntry:
    info = get_stock_info(item.symbol)
    return WatchlistEntry(**info.model_dump(), added_at=item.created_at)


@router.get("", response_model=list[WatchlistEntry])
def list_watchlist(user: CurrentUser, db: DbSession) -> list[WatchlistEntry]:
    """The user's watched symbols, in universe order."""
    try:
        items = db.scalars(
            select(WatchlistItem).where(WatchlistItem.user_id == user.id)
        ).all()
    except SQLAlchemyError as exc:
        raise _db_unavailable(exc) from exc

    order = {symbol: index for index, symbol in enumerate(SUPPORTED_SYMBOLS)}
    items = [item for item in items if item.symbol in order]
    items.sort(key=lambda item: order[item.symbol])
    return [_entry(item) for item in items]


@router.post("/{symbol}", response_model=WatchlistEntry)
def add_to_watchlist(
    symbol: Symbol, user: CurrentUser, db: DbSession
) -> WatchlistEntry:
    """Add a symbol. Adding one that is already watched is a no-op."""
    query = select(WatchlistItem).where(
        WatchlistItem.user_id == user.id, WatchlistItem.symbol == symbol
    )
    try:
        item = db.scalar(query)
        if item is None:
            item = WatchlistItem(user_id=user.id, symbol=symbol)
            db.add(item)
            db.commit()
            db.refresh(item)
    except IntegrityError:
        # A concurrent request inserted the same row first.
        db.rollback()
        item = db.scalar(query)
    except SQLAlchemyError as exc:
        db.rollback()
        raise _db_unavailable(exc) from exc

    return _entry(item)


@router.delete("/{symbol}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_watchlist(
    symbol: Symbol, user: CurrentUser, db: DbSession
) -> Response:
    """Remove a symbol. Removing one that is not watched is a no-op."""
    try:
        db.execute(
            delete(WatchlistItem).where(
                WatchlistItem.user_id == user.id, WatchlistItem.symbol == symbol
            )
        )
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise _db_unavailable(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
