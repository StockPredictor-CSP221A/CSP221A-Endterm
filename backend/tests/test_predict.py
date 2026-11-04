from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.db_models.prediction import PredictionRecord
from app.schemas.stock import PricePoint, StockHistory


class FixedForecaster:
    def predict(self, context: list[float]) -> float:
        return context[-1] + 1.5


def _history(symbol: str, period: str = "5y") -> StockHistory:
    start = date(2026, 1, 1)
    return StockHistory(
        symbol=symbol.upper(),
        interval="1d",
        prices=[
            PricePoint(date=(start + timedelta(days=i)).isoformat(), close=100.0 + i)
            for i in range(60)
        ],
    )


@pytest.fixture
def fake_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routes.stocks.get_history", _history)
    monkeypatch.setattr("app.routes.stocks.get_forecaster", FixedForecaster)


def test_predict_persists_with_user(
    client: TestClient, user_headers: dict[str, str], fake_model, session_factory
) -> None:
    res = client.post("/api/stocks/nvda/predict", headers=user_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["symbol"] == "NVDA"
    assert body["predicted_close"] == 160.5
    assert body["model_name"] == "Google TimesFM 2.5"
    assert body["model_version"]
    assert body["disclaimer"].startswith("Forecasts are uncertain")

    me = client.get("/api/auth/me", headers=user_headers).json()
    with session_factory() as session:
        record = session.query(PredictionRecord).one()
    assert record.user_id == me["id"]
    assert record.symbol == "NVDA"
    assert record.model_version == body["model_version"]


def test_predict_rejects_unsupported_symbol(
    client: TestClient, user_headers: dict[str, str], fake_model
) -> None:
    res = client.post("/api/stocks/AAPL/predict", headers=user_headers)
    assert res.status_code == 404


def test_predict_maps_model_failure_to_502(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    class Broken:
        def predict(self, context: list[float]) -> float:
            raise RuntimeError("boom")

    monkeypatch.setattr("app.routes.stocks.get_history", _history)
    monkeypatch.setattr("app.routes.stocks.get_forecaster", Broken)
    res = client.post("/api/stocks/SPY/predict", headers=user_headers)
    assert res.status_code == 502
    assert res.json()["detail"] == "Forecast model error for SPY"
