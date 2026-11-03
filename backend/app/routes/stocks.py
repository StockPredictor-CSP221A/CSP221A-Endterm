import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.db_models.prediction import PredictionRecord
from app.ml.forecast import (
    MODEL_NAME,
    MODEL_VERSION,
    InsufficientHistoryError,
    build_prediction,
)
from app.ml.timesfm import get_forecaster
from app.schemas.stock import Prediction, StockHistory
from app.services.market_data import (
    InvalidSymbolError,
    ensure_supported,
    get_history,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/{symbol}/history", response_model=StockHistory)
def history(
    symbol: str,
    period: str = Query(default=None, description="yfinance period, e.g. 1y, 6mo"),
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


@router.post("/{symbol}/predict", response_model=Prediction)
def predict(
    symbol: str, db: Annotated[Session, Depends(get_db)]
) -> Prediction:
    try:
        normalized = ensure_supported(symbol)
    except InvalidSymbolError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

    try:
        stock_history = get_history(normalized, period="5y")
    except InvalidSymbolError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    try:
        prediction = build_prediction(
            normalized, stock_history.prices, get_forecaster()
        )
    except InsufficientHistoryError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except Exception as exc:
        logger.exception("Forecast failed for %s", normalized)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Forecast model error for {normalized}",
        ) from exc

    record = PredictionRecord(
        symbol=prediction.symbol,
        forecast_horizon=prediction.forecast_horizon,
        last_observed_date=prediction.last_observed_date,
        last_observed_close=prediction.last_observed_close,
        forecast_date=prediction.forecast_date,
        predicted_close=prediction.predicted_close,
        model_name=MODEL_NAME,
        model_version=MODEL_VERSION,
    )
    try:
        db.add(record)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not persist prediction for %s", normalized)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not persist prediction",
        ) from exc

    return prediction
