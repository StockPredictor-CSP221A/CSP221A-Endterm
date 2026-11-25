from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient

from app.core.security import create_access_token, decode_access_token

from .conftest import auth_headers, register


def test_register_returns_token_and_normalized_user(client: TestClient) -> None:
    body = register(client, email="  Ada@Example.COM ", display_name="  Ada  ")

    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == "ada@example.com"
    assert body["user"]["display_name"] == "Ada"
    assert "hashed_password" not in body["user"]


def test_register_blank_display_name_is_null(client: TestClient) -> None:
    body = register(client, display_name="   ")
    assert body["user"]["display_name"] is None


def test_register_duplicate_email_conflicts(client: TestClient) -> None:
    register(client)
    res = client.post(
        "/api/auth/register",
        json={"email": "ADA@example.com", "password": "another-pass"},
    )
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"]


def test_register_validates_input(client: TestClient) -> None:
    short = client.post(
        "/api/auth/register", json={"email": "a@example.com", "password": "short"}
    )
    bad_email = client.post(
        "/api/auth/register", json={"email": "nope", "password": "long-enough"}
    )
    assert short.status_code == 422
    assert bad_email.status_code == 422


def test_password_is_hashed_with_argon2(client: TestClient, session_factory) -> None:
    from app.db_models.user import User

    register(client)
    with session_factory() as session:
        user = session.query(User).one()
    assert user.hashed_password.startswith("$argon2")
    assert "correct-horse" not in user.hashed_password


def test_login_success(client: TestClient) -> None:
    register(client)
    res = client.post(
        "/api/auth/login",
        json={"email": "ADA@example.com", "password": "correct-horse"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"] == "ada@example.com"
    me = client.get("/api/auth/me", headers=auth_headers(body["access_token"]))
    assert me.status_code == 200


def test_login_wrong_password_is_generic_401(client: TestClient) -> None:
    register(client)
    wrong = client.post(
        "/api/auth/login",
        json={"email": "ada@example.com", "password": "wrong-password"},
    )
    unknown = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "wrong-password"},
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]
    assert wrong.headers["www-authenticate"] == "Bearer"


def test_me_returns_current_user(
    client: TestClient, user_headers: dict[str, str]
) -> None:
    res = client.get("/api/auth/me", headers=user_headers)
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"id", "email", "display_name", "created_at"}
    assert body["email"] == "ada@example.com"


def test_me_requires_token(client: TestClient) -> None:
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"


def test_me_rejects_garbage_token(client: TestClient) -> None:
    res = client.get("/api/auth/me", headers=auth_headers("not-a-jwt"))
    assert res.status_code == 401


def test_me_rejects_expired_token(client: TestClient) -> None:
    user_id = register(client)["user"]["id"]
    stale = create_access_token(user_id, now=datetime.now(UTC) - timedelta(days=30))
    res = client.get("/api/auth/me", headers=auth_headers(stale))
    assert res.status_code == 401


def test_me_rejects_token_signed_with_other_key(client: TestClient) -> None:
    user_id = register(client)["user"]["id"]
    now = datetime.now(UTC)
    forged = jwt.encode(
        {"sub": str(user_id), "iat": now, "exp": now + timedelta(hours=1)},
        "a-different-signing-key-that-is-long-enough",
        algorithm="HS256",
    )
    res = client.get("/api/auth/me", headers=auth_headers(forged))
    assert res.status_code == 401


def test_me_rejects_token_for_deleted_user(client: TestClient) -> None:
    res = client.get("/api/auth/me", headers=auth_headers(create_access_token(999)))
    assert res.status_code == 401


def test_token_round_trip() -> None:
    assert decode_access_token(create_access_token(42)) == 42


def test_logout_is_stateless(client: TestClient) -> None:
    assert client.post("/api/auth/logout").status_code == 204
