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


def test_invalid_symbol_history() -> None:
    res = client.get("/api/stocks/not a symbol/history")
    assert res.status_code == 404
