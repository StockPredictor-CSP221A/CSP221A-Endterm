import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.core.deps import CurrentUser, DbSession, get_current_user
from app.db_models.prediction import PredictionRecord
from app.db_models.watchlist import WatchlistItem
from app.ml.forecast import InsufficientHistoryError, build_prediction
from app.ml.timesfm import get_forecaster
from app.schemas.news import NewsItem
from app.schemas.stock import Prediction, StockHistory, StockInfo
from app.services import news as news_service
from app.services.market_data import (
    STOCK_UNIVERSE,
    SUPPORTED_SYMBOLS,
    InvalidSymbolError,
    get_history,
    normalize_symbol,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/stocks",
    tags=["stocks"],
    dependencies=[Depends(get_current_user)],
)


HistoryPeriod = Literal["5d", "1mo", "3mo", "6mo", "ytd", "1y", "2y", "5y"]


def tracked_symbol(symbol: str, user: CurrentUser, db: DbSession) -> str:
    try:
        normalized = normalize_symbol(symbol)
    except InvalidSymbolError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

    if normalized in SUPPORTED_SYMBOLS:
        return normalized

    try:
        watched = db.scalar(
            select(WatchlistItem.id).where(
                WatchlistItem.user_id == user.id,
                WatchlistItem.symbol == normalized,
            )
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not check watchlist access for %s", normalized)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc

    if watched is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Add {normalized} to your watchlist first.",
        )
    return normalized


TrackedSymbol = Annotated[str, Depends(tracked_symbol)]


@router.get("", response_model=list[StockInfo])
def list_stocks() -> list[StockInfo]:
    """The fixed three-stock universe served by the app."""
    return list(STOCK_UNIVERSE)


@router.get("/{symbol}/history", response_model=StockHistory)
def history(
    symbol: TrackedSymbol,
    period: Annotated[
        HistoryPeriod | None, Query(description="yfinance period, e.g. 1y, 6mo")
    ] = None,
) -> StockHistory:
    resolved_period = period or get_settings().default_history_period
    try:
        return get_history(symbol, period=resolved_period)
    except InvalidSymbolError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc


@router.get("/{symbol}/news", response_model=list[NewsItem])
def news(
    symbol: TrackedSymbol, limit: Annotated[int, Query(ge=1, le=10)] = 4
) -> list[NewsItem]:
    """Recent headlines. Provider problems return an empty list, never an error."""
    return news_service.get_news(symbol, limit)


@router.post("/{symbol}/predict", response_model=Prediction)
def predict(symbol: TrackedSymbol, user: CurrentUser, db: DbSession) -> Prediction:
    try:
        stock_history = get_history(symbol, period="5y")
    except InvalidSymbolError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    try:
        prediction = build_prediction(symbol, stock_history.prices, get_forecaster())
    except InsufficientHistoryError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except Exception as exc:
        logger.exception("Forecast failed for %s", symbol)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Forecast model error for {symbol}",
        ) from exc

    record = PredictionRecord(
        user_id=user.id,
        symbol=prediction.symbol,
        forecast_horizon=prediction.forecast_horizon,
        last_observed_date=prediction.last_observed_date,
        last_observed_close=prediction.last_observed_close,
        forecast_date=prediction.forecast_date,
        predicted_close=prediction.predicted_close,
        model_name=prediction.model_name,
        model_version=prediction.model_version,
    )
    try:
        db.add(record)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not persist prediction for %s", symbol)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not persist prediction",
        ) from exc

    return prediction
