from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.db_models.prediction import PredictionRecord

from .conftest import auth_headers, register


def _add(session_factory, user_id: int | None, symbol: str, minutes_ago: int) -> None:
    with session_factory() as session:
        session.add(
            PredictionRecord(
                user_id=user_id,
                symbol=symbol,
                forecast_horizon="1 trading day",
                last_observed_date="2026-11-02",
                last_observed_close=100.0,
                forecast_date="2026-11-03",
                predicted_close=101.0,
                model_name="Google TimesFM 2.5",
                model_version="2.5-200m@1d952420",
                created_at=datetime.now(UTC) - timedelta(minutes=minutes_ago),
            )
        )
        session.commit()


@pytest.fixture
def two_users(client: TestClient, session_factory):
    ada = register(client, email="ada@example.com")
    bob = register(client, email="bob@example.com")
    _add(session_factory, ada["user"]["id"], "SPY", 30)
    _add(session_factory, ada["user"]["id"], "NVDA", 20)
    _add(session_factory, ada["user"]["id"], "SPY", 10)
    _add(session_factory, bob["user"]["id"], "KO", 5)
    _add(session_factory, None, "SPY", 1)  # legacy row with no owner
    return auth_headers(ada["access_token"]), auth_headers(bob["access_token"])


def test_history_is_scoped_to_user_and_newest_first(
    client: TestClient, two_users
) -> None:
    ada, bob = two_users
    rows = client.get("/api/predictions", headers=ada).json()
    assert [row["symbol"] for row in rows] == ["SPY", "NVDA", "SPY"]
    assert rows[0]["created_at"] > rows[-1]["created_at"]
    assert set(rows[0]) >= {
        "id",
        "symbol",
        "forecast_date",
        "predicted_close",
        "last_observed_close",
        "model_name",
        "model_version",
        "created_at",
    }

    bob_rows = client.get("/api/predictions", headers=bob).json()
    assert [row["symbol"] for row in bob_rows] == ["KO"]


def test_history_symbol_filter_and_limit(client: TestClient, two_users) -> None:
    ada, _ = two_users
    spy = client.get("/api/predictions?symbol=spy", headers=ada).json()
    assert [row["symbol"] for row in spy] == ["SPY", "SPY"]
    limited = client.get("/api/predictions?limit=1", headers=ada).json()
    assert len(limited) == 1


@pytest.mark.parametrize("limit", [0, 101])
def test_history_limit_is_bounded(
    client: TestClient, user_headers: dict[str, str], limit: int
) -> None:
    res = client.get(f"/api/predictions?limit={limit}", headers=user_headers)
    assert res.status_code == 422


def test_history_rejects_unsupported_symbol(
    client: TestClient, user_headers: dict[str, str]
) -> None:
    res = client.get("/api/predictions?symbol=AAPL", headers=user_headers)
    assert res.status_code == 404


def test_history_requires_auth(client: TestClient) -> None:
    assert client.get("/api/predictions").status_code == 401
