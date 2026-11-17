from fastapi.testclient import TestClient

from app.schemas.stock import PricePoint, StockHistory
from app.services import market_data


def test_list_stocks_returns_universe(
    client: TestClient, user_headers: dict[str, str]
) -> None:
    res = client.get("/api/stocks", headers=user_headers)
    assert res.status_code == 200
    body = res.json()
    assert [stock["symbol"] for stock in body] == ["SPY", "NVDA", "KO"]
    assert [stock["role"] for stock in body] == ["Safe", "Volatile", "Defensive"]
    assert all(stock["name"] and stock["description"] for stock in body)


def test_list_stocks_requires_auth(client: TestClient) -> None:
    assert client.get("/api/stocks").status_code == 401


def test_history_rejects_unsupported_symbol(
    client: TestClient, user_headers: dict[str, str]
) -> None:
    res = client.get("/api/stocks/AAPL/history", headers=user_headers)
    assert res.status_code == 404


def test_history_rejects_unknown_period(
    client: TestClient, user_headers: dict[str, str]
) -> None:
    res = client.get("/api/stocks/SPY/history?period=forever", headers=user_headers)
    assert res.status_code == 422


def test_history_passes_period(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    seen: dict[str, str] = {}

    def fake_history(symbol: str, period: str = "1y") -> StockHistory:
        seen.update(symbol=symbol, period=period)
        return StockHistory(
            symbol="SPY",
            interval="1d",
            prices=[PricePoint(date="2026-11-02", close=700.0)],
        )

    monkeypatch.setattr("app.routes.stocks.get_history", fake_history)
    res = client.get("/api/stocks/spy/history?period=3mo", headers=user_headers)
    assert res.status_code == 200
    assert seen == {"symbol": "spy", "period": "3mo"}


def test_get_stock_info() -> None:
    assert market_data.get_stock_info("ko").name == "Coca-Cola"
