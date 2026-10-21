from fastapi import APIRouter, HTTPException, Query, status

from app.config import get_settings
from app.schemas.stock import Prediction, StockHistory
from app.services.market_data import (
    InvalidSymbolError,
    get_history,
    normalize_symbol,
)

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
def predict(symbol: str) -> Prediction:
    try:
        normalized = normalize_symbol(symbol)
    except InvalidSymbolError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            f"Forecast model is not wired up yet for {normalized}. "
            "The inference pipeline lands in the next milestone."
        ),
    )
