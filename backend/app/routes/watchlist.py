import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.deps import CurrentUser, DbSession
from app.schemas.watchlist import WatchlistEntry
from app.services import watchlist as watchlist_service
from app.services.market_data import InvalidSymbolError, normalize_symbol
from app.services.watchlist import WatchlistLimitError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


def normalized_symbol(symbol: str) -> str:
    try:
        return normalize_symbol(symbol)
    except InvalidSymbolError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


Symbol = Annotated[str, Depends(normalized_symbol)]


def _db_unavailable(exc: SQLAlchemyError) -> HTTPException:
    logger.exception("Watchlist database operation failed")
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable"
    )


@router.get("", response_model=list[WatchlistEntry])
def list_watchlist(
    user: CurrentUser,
    db: DbSession,
    q: Annotated[str | None, Query(max_length=64)] = None,
) -> list[WatchlistEntry]:
    """The user's watched symbols, searchable by symbol or name."""
    try:
        return watchlist_service.list_watchlist(db, user.id, q)
    except SQLAlchemyError as exc:
        raise _db_unavailable(exc) from exc


@router.post("/{symbol}", response_model=WatchlistEntry)
def add_to_watchlist(
    symbol: Symbol, user: CurrentUser, db: DbSession
) -> WatchlistEntry:
    """Add a default or real custom ticker. Adding one already watched is a no-op."""
    try:
        return watchlist_service.add_watchlist_item(db, user.id, symbol)
    except WatchlistLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    except InvalidSymbolError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc
    except SQLAlchemyError as exc:
        raise _db_unavailable(exc) from exc


@router.delete("/{symbol}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_watchlist(
    symbol: Symbol, user: CurrentUser, db: DbSession
) -> Response:
    """Remove a symbol. Removing one that is not watched is a no-op."""
    try:
        watchlist_service.remove_watchlist_item(db, user.id, symbol)
    except InvalidSymbolError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except SQLAlchemyError as exc:
        raise _db_unavailable(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
