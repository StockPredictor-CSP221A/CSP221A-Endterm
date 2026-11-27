import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import get_settings
from app.core.security import create_access_token
from app.db_models import OAuthAccount, PredictionRecord, User, WatchlistItem
from app.routes import auth as auth_routes
from app.services.oauth import ProviderIdentity

from .conftest import auth_headers, register
from .test_predictions import _add

PASSWORD = "correct-horse"


def _login(client: TestClient, email: str, password: str) -> int:
    return client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code


@pytest.fixture
def social_headers(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> dict[str, str]:
    """Headers for an account created through Google, with no password."""
    monkeypatch.setattr(get_settings(), "google_client_id", "test-client")
    monkeypatch.setattr(
        auth_routes,
        "verify_google_credential",
        lambda _credential: ProviderIdentity(
            provider="google", subject="1", email="grace@example.com", name="Grace"
        ),
    )
    body = client.post("/api/auth/google", json={"credential": "t"}).json()
    assert body["user"]["has_password"] is False
    assert body["user"]["providers"] == ["google"]
    return auth_headers(body["access_token"])


# --- Profile ----------------------------------------------------------------


def test_update_display_name(client: TestClient, user_headers) -> None:
    res = client.patch(
        "/api/auth/me", json={"display_name": "  Countess  "}, headers=user_headers
    )
    assert res.status_code == 200
    assert res.json()["display_name"] == "Countess"
    me = client.get("/api/auth/me", headers=user_headers).json()
    assert me["display_name"] == "Countess"


def test_blank_display_name_clears_it(client: TestClient, user_headers) -> None:
    res = client.patch(
        "/api/auth/me", json={"display_name": "  "}, headers=user_headers
    )
    assert res.json()["display_name"] is None


def test_display_name_too_long(client: TestClient, user_headers) -> None:
    res = client.patch(
        "/api/auth/me", json={"display_name": "x" * 65}, headers=user_headers
    )
    assert res.status_code == 422


def test_account_routes_require_token(client: TestClient) -> None:
    assert client.patch("/api/auth/me", json={}).status_code == 401
    assert client.post("/api/auth/me/email", json={}).status_code == 401
    assert client.post("/api/auth/me/password", json={}).status_code == 401


# --- Email ------------------------------------------------------------------


def test_change_email(client: TestClient, user_headers) -> None:
    res = client.post(
        "/api/auth/me/email",
        json={"new_email": " New@Example.com ", "current_password": PASSWORD},
        headers=user_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["email"] == "new@example.com"
    assert _login(client, "new@example.com", PASSWORD) == 200
    assert _login(client, "ada@example.com", PASSWORD) == 401


def test_change_email_wrong_password_is_400_not_401(
    client: TestClient, user_headers
) -> None:
    res = client.post(
        "/api/auth/me/email",
        json={"new_email": "new@example.com", "current_password": "nope"},
        headers=user_headers,
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "Current password is incorrect"


def test_change_email_to_taken_address(client: TestClient, user_headers) -> None:
    register(client, email="taken@example.com")
    res = client.post(
        "/api/auth/me/email",
        json={"new_email": "taken@example.com", "current_password": PASSWORD},
        headers=user_headers,
    )
    assert res.status_code == 409


def test_change_email_to_same_address(client: TestClient, user_headers) -> None:
    res = client.post(
        "/api/auth/me/email",
        json={"new_email": "ADA@example.com", "current_password": PASSWORD},
        headers=user_headers,
    )
    assert res.status_code == 400


def test_social_account_must_set_password_before_email_change(
    client: TestClient, social_headers
) -> None:
    res = client.post(
        "/api/auth/me/email",
        json={"new_email": "new@example.com", "current_password": "anything"},
        headers=social_headers,
    )
    assert res.status_code == 400
    assert "Set a password" in res.json()["detail"]


# --- Password ---------------------------------------------------------------


def test_change_password_signs_out_other_sessions(
    client: TestClient, user_headers
) -> None:
    res = client.post(
        "/api/auth/me/password",
        json={"current_password": PASSWORD, "new_password": "brand-new-pass"},
        headers=user_headers,
    )
    assert res.status_code == 200, res.text
    fresh = auth_headers(res.json()["access_token"])

    assert client.get("/api/auth/me", headers=user_headers).status_code == 401
    assert client.get("/api/auth/me", headers=fresh).status_code == 200
    assert _login(client, "ada@example.com", "brand-new-pass") == 200
    assert _login(client, "ada@example.com", PASSWORD) == 401


def test_change_password_needs_current_password(
    client: TestClient, user_headers
) -> None:
    missing = client.post(
        "/api/auth/me/password",
        json={"new_password": "brand-new-pass"},
        headers=user_headers,
    )
    wrong = client.post(
        "/api/auth/me/password",
        json={"current_password": "nope", "new_password": "brand-new-pass"},
        headers=user_headers,
    )
    assert missing.status_code == wrong.status_code == 400


def test_new_password_must_be_long_enough(client: TestClient, user_headers) -> None:
    res = client.post(
        "/api/auth/me/password",
        json={"current_password": PASSWORD, "new_password": "short"},
        headers=user_headers,
    )
    assert res.status_code == 422


def test_social_account_can_set_password_then_change_email(
    client: TestClient, social_headers
) -> None:
    res = client.post(
        "/api/auth/me/password",
        json={"new_password": "first-password"},
        headers=social_headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["user"]["has_password"] is True
    assert body["user"]["providers"] == ["google"]
    headers = auth_headers(body["access_token"])

    assert _login(client, "grace@example.com", "first-password") == 200
    res = client.post(
        "/api/auth/me/email",
        json={"new_email": "grace2@example.com", "current_password": "first-password"},
        headers=headers,
    )
    assert res.status_code == 200


def test_token_without_password_stamp_is_rejected(client: TestClient) -> None:
    user_id = register(client)["user"]["id"]
    res = client.get("/api/auth/me", headers=auth_headers(create_access_token(user_id)))
    assert res.status_code == 401


# --- Delete -----------------------------------------------------------------


def _delete(client: TestClient, headers, **body):
    return client.request("DELETE", "/api/auth/me", json=body, headers=headers)


def test_delete_account_removes_user_and_their_data(
    client: TestClient, session_factory
) -> None:
    me = register(client)
    other = register(client, email="other@example.com")
    headers = auth_headers(me["access_token"])
    client.post("/api/watchlist/SPY", headers=headers)
    _add(session_factory, me["user"]["id"], "SPY", 1)
    _add(session_factory, other["user"]["id"], "KO", 1)

    res = _delete(
        client, headers, confirm_email="ADA@example.com", current_password=PASSWORD
    )
    assert res.status_code == 204

    with session_factory() as session:

        def count(model) -> int:
            return session.scalar(select(func.count()).select_from(model))

        assert count(User) == 1
        assert count(WatchlistItem) == 0
        assert count(OAuthAccount) == 0
        assert count(PredictionRecord) == 1  # only the other user's

    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert _login(client, "ada@example.com", PASSWORD) == 401
    # The email is free again.
    register(client)


def test_delete_account_needs_matching_email(client: TestClient, user_headers) -> None:
    res = _delete(
        client,
        user_headers,
        confirm_email="someone@example.com",
        current_password=PASSWORD,
    )
    assert res.status_code == 400
    assert client.get("/api/auth/me", headers=user_headers).status_code == 200


def test_delete_account_needs_current_password(
    client: TestClient, user_headers
) -> None:
    missing = _delete(client, user_headers, confirm_email="ada@example.com")
    wrong = _delete(
        client, user_headers, confirm_email="ada@example.com", current_password="no"
    )
    assert missing.status_code == wrong.status_code == 400
    assert client.get("/api/auth/me", headers=user_headers).status_code == 200


def test_social_account_deletes_with_email_only(
    client: TestClient, social_headers, session_factory
) -> None:
    res = _delete(client, social_headers, confirm_email="grace@example.com")
    assert res.status_code == 204
    with session_factory() as session:
        assert session.scalar(select(func.count()).select_from(OAuthAccount)) == 0
