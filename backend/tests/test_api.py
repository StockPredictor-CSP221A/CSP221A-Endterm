import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"]
    assert body["version"]


def test_invalid_symbol_history(user_headers: dict[str, str]) -> None:
    res = client.get("/api/stocks/not a symbol/history", headers=user_headers)
    assert res.status_code == 404


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/stocks/SPY/history"),
        ("post", "/api/stocks/SPY/predict"),
    ],
)
def test_stock_endpoints_require_auth(method: str, path: str) -> None:
    res = client.request(method.upper(), path)
    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"
