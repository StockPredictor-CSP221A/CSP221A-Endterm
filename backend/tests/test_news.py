from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.services import news

CURRENT_SHAPE = {
    "id": "abc",
    "content": {
        "title": "Chipmaker beats estimates",
        "pubDate": "2026-11-02T14:30:00Z",
        "provider": {"displayName": "Reuters"},
        "canonicalUrl": {"url": "https://example.com/a"},
        "clickThroughUrl": {"url": "https://example.com/a?tracking"},
        "thumbnail": {
            "originalUrl": "https://img.example.com/original.jpg",
            "resolutions": [
                {"url": "https://img.example.com/100.jpg", "width": 100},
                {"url": "https://img.example.com/170.jpg", "width": 170},
                {"url": "https://img.example.com/1200.jpg", "width": 1200},
            ],
        },
    },
}

LEGACY_SHAPE = {
    "title": "Soft drink sales steady",
    "publisher": "AP",
    "link": "https://example.com/b",
    "providerPublishTime": 1_762_000_000,
    "thumbnail": {"resolutions": [{"url": "https://img.example.com/b.jpg"}]},
}


@pytest.fixture(autouse=True)
def _fresh_cache() -> Iterator[None]:
    news.clear_cache()
    yield
    news.clear_cache()


def test_normalizes_current_shape() -> None:
    item = news.normalize_item(CURRENT_SHAPE)
    assert item is not None
    assert item.title == "Chipmaker beats estimates"
    assert item.publisher == "Reuters"
    assert item.url == "https://example.com/a"
    assert item.published_at == "2026-11-02T14:30:00+00:00"
    assert item.thumbnail == "https://img.example.com/170.jpg"


def test_normalizes_legacy_shape() -> None:
    item = news.normalize_item(LEGACY_SHAPE)
    assert item is not None
    assert item.publisher == "AP"
    assert item.url == "https://example.com/b"
    assert item.published_at is not None and item.published_at.startswith("2025-11-01")
    assert item.thumbnail == "https://img.example.com/b.jpg"


@pytest.mark.parametrize(
    "raw",
    [
        None,
        "headline",
        {"content": {"title": "No link"}},
        {"title": "Bad link", "link": "javascript:alert(1)"},
        {"link": "https://example.com/untitled"},
    ],
)
def test_drops_unusable_items(raw: object) -> None:
    assert news.normalize_item(raw) is None


def test_missing_optional_fields_are_null() -> None:
    raw = {"content": {"title": "T", "clickThroughUrl": {"url": "https://x.io"}}}
    item = news.normalize_item(raw)
    assert item is not None
    assert item.publisher is None
    assert item.published_at is None
    assert item.thumbnail is None


def test_normalize_news_dedupes_and_sorts_newest_first() -> None:
    items = news.normalize_news([LEGACY_SHAPE, CURRENT_SHAPE, CURRENT_SHAPE, 42])
    assert [item.url for item in items] == [
        "https://example.com/a",
        "https://example.com/b",
    ]
    assert news.normalize_news({"not": "a list"}) == []


def test_get_news_caches_successful_results() -> None:
    calls: list[str] = []
    clock = [1000.0]

    def fetch(symbol: str) -> list:
        calls.append(symbol)
        return [CURRENT_SHAPE, LEGACY_SHAPE]

    first = news.get_news("NVDA", 4, fetch=fetch, now=lambda: clock[0])
    clock[0] += 60
    second = news.get_news("NVDA", 1, fetch=fetch, now=lambda: clock[0])
    assert len(first) == 2 and len(second) == 1
    assert calls == ["NVDA"]

    clock[0] += news.CACHE_TTL_SECONDS
    news.get_news("NVDA", 4, fetch=fetch, now=lambda: clock[0])
    assert calls == ["NVDA", "NVDA"]


def test_get_news_returns_empty_on_failure_and_does_not_cache() -> None:
    def broken(symbol: str) -> list:
        raise RuntimeError("provider down")

    assert news.get_news("SPY", 4, fetch=broken) == []
    assert news.get_news("SPY", 4, fetch=lambda symbol: []) == []
    recovered = news.get_news("SPY", 4, fetch=lambda symbol: [LEGACY_SHAPE])
    assert recovered[0].publisher == "AP"


def test_news_endpoint_never_errors_on_provider_failure(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    def broken(symbol: str) -> list:
        raise RuntimeError("provider down")

    monkeypatch.setattr(news, "_fetch_raw", broken)
    res = client.get("/api/stocks/KO/news", headers=user_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_news_endpoint_returns_items(
    client: TestClient, user_headers: dict[str, str], monkeypatch
) -> None:
    def fetch(symbol: str) -> list:
        return [CURRENT_SHAPE, LEGACY_SHAPE]

    monkeypatch.setattr(news, "_fetch_raw", fetch)
    res = client.get("/api/stocks/nvda/news?limit=1", headers=user_headers)
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert set(body[0]) == {"title", "publisher", "url", "published_at", "thumbnail"}


def test_news_endpoint_validates_symbol_limit_and_auth(
    client: TestClient, user_headers: dict[str, str]
) -> None:
    assert client.get("/api/stocks/AAPL/news", headers=user_headers).status_code == 404
    bad_limit = client.get("/api/stocks/SPY/news?limit=0", headers=user_headers)
    assert bad_limit.status_code == 422
    assert client.get("/api/stocks/SPY/news").status_code == 401
