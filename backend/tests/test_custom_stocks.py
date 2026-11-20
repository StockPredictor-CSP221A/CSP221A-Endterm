from datetime import date, timedelta

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.db_models.watchlist import WatchlistItem
from app.schemas.stock import PricePoint, StockHistory
from app.services import market_data

from .conftest import auth_headers, register


class FixedForecaster:
    def predict(self, context: list[float]) -> float:
        return context[-1] + 1.5


def _history(symbol: str, period: str = "5y") -> StockHistory:
    start = date(2026, 1, 1)
    return StockHistory(
        symbol=symbol.upper(),
        interval="1d",
        prices=[
            PricePoint(
                date=(start + timedelta(days=i)).isoformat(),
                close=100.0 + i,
            )
            for i in range(60)
        ],
    )


def _stub_lookup(
    monkeypatch: pytest.MonkeyPatch, names: dict[str, str] | None = None
) -> list[str]:
    calls: list[str] = []

    def lookup(symbol: str) -> str:
        calls.append(symbol)
        return (names or {}).get(symbol, symbol)

    monkeypatch.setattr(market_data, "lookup_watchlist_symbol", lookup)
    return calls


def _add(client: TestClient, headers: dict[str, str], symbol: str) -> dict:
    res = client.post(f"/api/watchlist/{symbol}", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def test_add_valid_custom_ticker_and_name_fallback(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    calls = _stub_lookup(monkeypatch, {"AAPL": "Apple Inc."})

    apple = _add(client, user_headers, "aapl")
    assert apple["symbol"] == "AAPL"
    assert apple["name"] == "Apple Inc."
    assert apple["role"] == "Custom"
    assert apple["description"] == "Added to your watchlist."
    assert apple["is_default"] is False
    assert apple["added_at"]

    fallback = _add(client, user_headers, "TSLA")
    assert fallback["name"] == "TSLA"
    assert calls == ["AAPL", "TSLA"]


def test_lookup_falls_back_to_ticker_when_name_lookup_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeTicker:
        @property
        def info(self) -> dict:
            raise RuntimeError("no name available")

        def history(self, **kwargs: object) -> pd.DataFrame:
            return pd.DataFrame({"Close": [100.0]})

    monkeypatch.setattr(market_data.yf, "Ticker", lambda symbol: FakeTicker())
    assert market_data.lookup_watchlist_symbol("aapl") == "AAPL"


def test_unknown_ticker_returns_404_and_saves_nothing(
    client: TestClient,
    user_headers: dict[str, str],
    monkeypatch,
    session_factory,
) -> None:
    def lookup(symbol: str) -> str:
        raise market_data.InvalidSymbolError(f"No market data found for {symbol}")

    monkeypatch.setattr(market_data, "lookup_watchlist_symbol", lookup)
    res = client.post("/api/watchlist/XYZ", headers=user_headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "No market data found for XYZ"
    assert client.get("/api/watchlist", headers=user_headers).json() == []
    with session_factory() as session:
        assert session.query(WatchlistItem).count() == 0


def test_provider_error_returns_502_and_saves_nothing(
    client: TestClient,
    user_headers: dict[str, str],
    monkeypatch,
    session_factory,
) -> None:
    def lookup(symbol: str) -> str:
        raise RuntimeError(f"Market data provider error for {symbol}")

    monkeypatch.setattr(market_data, "lookup_watchlist_symbol", lookup)
    res = client.post("/api/watchlist/XYZ", headers=user_headers)
    assert res.status_code == 502
    assert "provider error" in res.json()["detail"]
    assert client.get("/api/watchlist", headers=user_headers).json() == []
    with session_factory() as session:
        assert session.query(WatchlistItem).count() == 0


def test_added_stock_limit_excludes_defaults(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    calls = _stub_lookup(monkeypatch)
    for symbol in ("SPY", "NVDA", "KO"):
        _add(client, user_headers, symbol)
    for index in range(20):
        _add(client, user_headers, f"C{index:02d}")

    assert len(calls) == 20
    over = client.post("/api/watchlist/ZZZ", headers=user_headers)
    assert over.status_code == 409
    assert "20" in over.json()["detail"]
    assert len(calls) == 20

    listed = client.get("/api/watchlist", headers=user_headers).json()
    assert len(listed) == 23
    assert "ZZZ" not in [entry["symbol"] for entry in listed]


def test_idempotent_add_does_not_call_lookup_again(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    calls = _stub_lookup(monkeypatch, {"AAPL": "Apple Inc."})

    first = _add(client, user_headers, "AAPL")
    second = _add(client, user_headers, "AAPL")

    assert first["added_at"] == second["added_at"]
    assert calls == ["AAPL"]
    assert len(client.get("/api/watchlist", headers=user_headers).json()) == 1


def test_idempotent_remove_and_unwatched_ticker(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    calls = _stub_lookup(monkeypatch)
    _add(client, user_headers, "AAPL")

    assert client.delete("/api/watchlist/AAPL", headers=user_headers).status_code == 204
    assert client.delete("/api/watchlist/AAPL", headers=user_headers).status_code == 204
    assert client.delete("/api/watchlist/MSFT", headers=user_headers).status_code == 204

    assert calls == ["AAPL"]
    assert client.get("/api/watchlist", headers=user_headers).json() == []


def test_another_user_cannot_use_custom_stock(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    _stub_lookup(monkeypatch, {"AAPL": "Apple Inc."})
    _add(client, user_headers, "AAPL")
    bob = auth_headers(register(client, email="bob@example.com")["access_token"])

    requests = (
        ("GET", "/api/stocks/AAPL/history"),
        ("GET", "/api/stocks/AAPL/news"),
        ("POST", "/api/stocks/AAPL/predict"),
    )
    for method, path in requests:
        res = client.request(method, path, headers=bob)
        assert res.status_code == 404
        assert res.json()["detail"] == "Add AAPL to your watchlist first."


def test_removal_revokes_access_but_keeps_forecasts(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    _stub_lookup(monkeypatch, {"AAPL": "Apple Inc."})
    _add(client, user_headers, "AAPL")
    monkeypatch.setattr("app.routes.stocks.get_history", _history)
    monkeypatch.setattr("app.routes.stocks.get_forecaster", FixedForecaster)

    before = client.get("/api/stocks/AAPL/history", headers=user_headers)
    assert before.status_code == 200
    predicted = client.post("/api/stocks/AAPL/predict", headers=user_headers)
    assert predicted.status_code == 200

    assert client.delete("/api/watchlist/AAPL", headers=user_headers).status_code == 204
    requests = (
        ("GET", "/api/stocks/AAPL/history"),
        ("GET", "/api/stocks/AAPL/news"),
        ("POST", "/api/stocks/AAPL/predict"),
    )
    for method, path in requests:
        res = client.request(method, path, headers=user_headers)
        assert res.status_code == 404
        assert res.json()["detail"] == "Add AAPL to your watchlist first."

    history = client.get("/api/predictions?symbol=AAPL", headers=user_headers)
    assert history.status_code == 200
    rows = history.json()
    assert len(rows) == 1
    assert rows[0]["symbol"] == "AAPL"


def test_search_by_symbol_and_name(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    _stub_lookup(
        monkeypatch,
        {"AAPL": "Apple Inc.", "MSFT": "Microsoft Corporation"},
    )
    _add(client, user_headers, "AAPL")
    _add(client, user_headers, "MSFT")

    def symbols(query: str) -> list[str]:
        res = client.get(
            "/api/watchlist", headers=user_headers, params={"q": query}
        )
        assert res.status_code == 200
        return [entry["symbol"] for entry in res.json()]

    assert symbols("MSFT") == ["MSFT"]
    assert symbols("apple") == ["AAPL"]
    assert symbols("MICRO") == ["MSFT"]
    assert symbols("") == ["AAPL", "MSFT"]
    assert symbols("   ") == ["AAPL", "MSFT"]


def test_list_ordering_and_custom_entry_fields(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    _stub_lookup(
        monkeypatch,
        {"AAPL": "Apple Inc.", "MSFT": "Microsoft Corporation"},
    )
    for symbol in ("KO", "NVDA", "SPY"):
        _add(client, user_headers, symbol)
    _add(client, user_headers, "AAPL")
    _add(client, user_headers, "MSFT")

    listed = client.get("/api/watchlist", headers=user_headers).json()
    assert [entry["symbol"] for entry in listed] == [
        "SPY",
        "NVDA",
        "KO",
        "AAPL",
        "MSFT",
    ]
    defaults = listed[:3]
    assert all(entry["is_default"] is True for entry in defaults)
    assert [entry["role"] for entry in defaults] == [
        "Safe",
        "Volatile",
        "Defensive",
    ]

    apple = listed[3]
    assert apple["is_default"] is False
    assert apple["name"] == "Apple Inc."
    assert apple["role"] == "Custom"
    assert apple["description"] == "Added to your watchlist."


def test_forecast_custom_stock_and_filter_predictions(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    _stub_lookup(monkeypatch, {"AAPL": "Apple Inc."})
    _add(client, user_headers, "AAPL")
    monkeypatch.setattr("app.routes.stocks.get_history", _history)
    monkeypatch.setattr("app.routes.stocks.get_forecaster", FixedForecaster)

    res = client.post("/api/stocks/aapl/predict", headers=user_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["symbol"] == "AAPL"
    assert body["predicted_close"] == 160.5

    filtered = client.get(
        "/api/predictions?symbol=aapl", headers=user_headers
    )
    assert filtered.status_code == 200
    rows = filtered.json()
    assert len(rows) == 1
    assert rows[0]["symbol"] == "AAPL"
    assert rows[0]["predicted_close"] == body["predicted_close"]
