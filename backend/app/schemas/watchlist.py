from datetime import datetime

from app.schemas.stock import StockInfo


class WatchlistEntry(StockInfo):
    added_at: datetime
