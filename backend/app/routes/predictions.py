import logging
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.deps import CurrentUser, DbSession
from app.db_models.prediction import PredictionRecord
from app.schemas.prediction import PredictionOut
from app.services.market_data import InvalidSymbolError, ensure_supported

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get("", response_model=list[PredictionOut])
def list_predictions(
    user: CurrentUser,
    db: DbSession,
    symbol: Annotated[str | None, Query(description="SPY, NVDA, or KO")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[PredictionRecord]:
    """The signed-in user's saved forecasts, newest first."""
    query = select(PredictionRecord).where(PredictionRecord.user_id == user.id)
    if symbol:
        try:
            query = query.where(PredictionRecord.symbol == ensure_supported(symbol))
        except InvalidSymbolError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc

    query = query.order_by(
        PredictionRecord.created_at.desc(), PredictionRecord.id.desc()
    ).limit(limit)
    try:
        return list(db.scalars(query))
    except SQLAlchemyError as exc:
        logger.exception("Could not load prediction history")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc
