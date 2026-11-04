from fastapi.testclient import TestClient

from .conftest import auth_headers, register


def test_watchlist_starts_empty(
    client: TestClient, user_headers: dict[str, str]
) -> None:
    res = client.get("/api/watchlist", headers=user_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_add_list_remove(client: TestClient, user_headers: dict[str, str]) -> None:
    added = client.post("/api/watchlist/ko", headers=user_headers)
    assert added.status_code == 200
    assert added.json()["symbol"] == "KO"
    assert added.json()["name"] == "Coca-Cola"
    assert added.json()["role"] == "Defensive"
    client.post("/api/watchlist/SPY", headers=user_headers)

    listed = client.get("/api/watchlist", headers=user_headers).json()
    assert [item["symbol"] for item in listed] == ["SPY", "KO"]
    assert all(item["added_at"] for item in listed)

    removed = client.delete("/api/watchlist/KO", headers=user_headers)
    assert removed.status_code == 204
    listed = client.get("/api/watchlist", headers=user_headers).json()
    assert [item["symbol"] for item in listed] == ["SPY"]


def test_add_and_remove_are_idempotent(
    client: TestClient, user_headers: dict[str, str]
) -> None:
    first = client.post("/api/watchlist/NVDA", headers=user_headers)
    second = client.post("/api/watchlist/NVDA", headers=user_headers)
    assert first.status_code == second.status_code == 200
    assert first.json()["added_at"] == second.json()["added_at"]
    assert len(client.get("/api/watchlist", headers=user_headers).json()) == 1

    assert client.delete("/api/watchlist/NVDA", headers=user_headers).status_code == 204
    assert client.delete("/api/watchlist/NVDA", headers=user_headers).status_code == 204


def test_watchlist_is_per_user(client: TestClient) -> None:
    ada = auth_headers(register(client, email="ada@example.com")["access_token"])
    bob = auth_headers(register(client, email="bob@example.com")["access_token"])
    client.post("/api/watchlist/SPY", headers=ada)

    assert client.get("/api/watchlist", headers=bob).json() == []
    client.delete("/api/watchlist/SPY", headers=bob)
    assert len(client.get("/api/watchlist", headers=ada).json()) == 1


def test_watchlist_rejects_unsupported_symbol(
    client: TestClient, user_headers: dict[str, str]
) -> None:
    assert client.post("/api/watchlist/AAPL", headers=user_headers).status_code == 404
    assert client.delete("/api/watchlist/AAPL", headers=user_headers).status_code == 404


def test_watchlist_requires_auth(client: TestClient) -> None:
    assert client.get("/api/watchlist").status_code == 401
    assert client.post("/api/watchlist/SPY").status_code == 401
    assert client.delete("/api/watchlist/SPY").status_code == 401
