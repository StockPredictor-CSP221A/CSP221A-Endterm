from datetime import UTC, datetime, timedelta

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.config import get_settings
from app.routes import auth as auth_routes
from app.services import oauth
from app.services.oauth import OAuthError, ProviderIdentity, ProviderUnavailableError
from tests.conftest import auth_headers, register

GOOGLE_CLIENT_ID = "test-google-client"
CALLBACK = "http://localhost:5173/auth/github/callback"


@pytest.fixture(autouse=True)
def _providers(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", GOOGLE_CLIENT_ID)
    monkeypatch.setattr(settings, "github_client_id", "test-github-client")
    monkeypatch.setattr(settings, "github_client_secret", "test-github-secret")
    monkeypatch.setattr(settings, "cors_origins", ["http://localhost:5173"])


def _identity(
    provider: str = "google",
    subject: str = "123",
    email: str = "grace@example.com",
    name: str | None = "Grace",
) -> ProviderIdentity:
    return ProviderIdentity(provider=provider, subject=subject, email=email, name=name)


def _stub_google(monkeypatch: pytest.MonkeyPatch, result: object) -> None:
    def fake(_credential: str) -> ProviderIdentity:
        if isinstance(result, Exception):
            raise result
        return result  # type: ignore[return-value]

    monkeypatch.setattr(auth_routes, "verify_google_credential", fake)


def _stub_github(monkeypatch: pytest.MonkeyPatch, result: object) -> None:
    def fake(_code: str, _redirect_uri: str) -> ProviderIdentity:
        if isinstance(result, Exception):
            raise result
        return result  # type: ignore[return-value]

    monkeypatch.setattr(auth_routes, "exchange_github_code", fake)


# --- Routes -----------------------------------------------------------------


def test_providers_lists_configured_client_ids(client: TestClient) -> None:
    res = client.get("/api/auth/providers")
    assert res.status_code == 200
    assert res.json() == {
        "google_client_id": GOOGLE_CLIENT_ID,
        "github_client_id": "test-github-client",
    }


def test_providers_hides_unconfigured(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", "")
    monkeypatch.setattr(settings, "github_client_secret", "")
    assert client.get("/api/auth/providers").json() == {
        "google_client_id": None,
        "github_client_id": None,
    }
    assert client.post("/api/auth/google", json={"credential": "x"}).status_code == 404
    res = client.post("/api/auth/github", json={"code": "c", "redirect_uri": CALLBACK})
    assert res.status_code == 404


def test_google_creates_user_then_signs_back_in(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_google(monkeypatch, _identity())

    first = client.post("/api/auth/google", json={"credential": "token"})
    assert first.status_code == 200, first.text
    user = first.json()["user"]
    assert user["email"] == "grace@example.com"
    assert user["display_name"] == "Grace"

    me = client.get("/api/auth/me", headers=auth_headers(first.json()["access_token"]))
    assert me.json()["id"] == user["id"]

    again = client.post("/api/auth/google", json={"credential": "token"})
    assert again.json()["user"]["id"] == user["id"]


def test_google_rejected_credential_is_401(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_google(monkeypatch, OAuthError("Invalid Google credential"))
    res = client.post("/api/auth/google", json={"credential": "bad"})
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid Google credential"


def test_provider_outage_is_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_google(monkeypatch, ProviderUnavailableError("down"))
    assert client.post("/api/auth/google", json={"credential": "t"}).status_code == 502


def test_social_sign_in_refuses_existing_password_account(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    register(client, email="grace@example.com")
    _stub_google(monkeypatch, _identity(email="grace@example.com"))

    res = client.post("/api/auth/google", json={"credential": "token"})
    assert res.status_code == 409
    assert "password" in res.json()["detail"]


def test_google_and_github_with_same_email_share_one_account(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_google(monkeypatch, _identity())
    google_user = client.post("/api/auth/google", json={"credential": "t"}).json()

    _stub_github(monkeypatch, _identity(provider="github", subject="999"))
    res = client.post("/api/auth/github", json={"code": "c", "redirect_uri": CALLBACK})
    assert res.status_code == 200, res.text
    assert res.json()["user"]["id"] == google_user["user"]["id"]


def test_password_login_fails_for_social_only_account(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_google(monkeypatch, _identity())
    client.post("/api/auth/google", json={"credential": "t"})

    res = client.post(
        "/api/auth/login",
        json={"email": "grace@example.com", "password": "anything-at-all"},
    )
    assert res.status_code == 401


def test_register_refuses_email_taken_by_social_account(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_google(monkeypatch, _identity())
    client.post("/api/auth/google", json={"credential": "t"})

    res = client.post(
        "/api/auth/register",
        json={"email": "grace@example.com", "password": "correct-horse"},
    )
    assert res.status_code == 409


@pytest.mark.parametrize(
    "redirect_uri",
    [
        "https://evil.example.com/auth/github/callback",
        "http://localhost:5173/somewhere-else",
        "http://localhost:5173/auth/github/callback?next=/x",
    ],
)
def test_github_rejects_foreign_redirect(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, redirect_uri: str
) -> None:
    _stub_github(monkeypatch, _identity(provider="github"))
    res = client.post(
        "/api/auth/github", json={"code": "c", "redirect_uri": redirect_uri}
    )
    assert res.status_code == 400


def test_long_provider_name_is_trimmed(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _stub_google(monkeypatch, _identity(name="x" * 200))
    res = client.post("/api/auth/google", json={"credential": "t"})
    assert len(res.json()["user"]["display_name"]) == 64


# --- Google token verification ----------------------------------------------


@pytest.fixture
def google_key(monkeypatch: pytest.MonkeyPatch) -> rsa.RSAPrivateKey:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    class FakeJWKS:
        def get_signing_key_from_jwt(self, _token: str) -> jwt.PyJWK:
            return jwt.PyJWK.from_dict(
                {
                    **jwt.algorithms.RSAAlgorithm.to_jwk(
                        key.public_key(), as_dict=True
                    ),
                    "alg": "RS256",
                }
            )

    monkeypatch.setattr(oauth, "_google_jwks", lambda: FakeJWKS())
    return key


def _google_token(key: rsa.RSAPrivateKey, **overrides: object) -> str:
    now = datetime.now(UTC)
    claims = {
        "iss": "https://accounts.google.com",
        "aud": GOOGLE_CLIENT_ID,
        "sub": "google-sub-1",
        "email": "Grace@Example.com",
        "email_verified": True,
        "name": "Grace Hopper",
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    claims.update(overrides)
    return jwt.encode(claims, key, algorithm="RS256")


def test_verify_google_credential_accepts_valid_token(google_key) -> None:
    identity = oauth.verify_google_credential(_google_token(google_key))
    assert identity == ProviderIdentity(
        provider="google",
        subject="google-sub-1",
        email="grace@example.com",
        name="Grace Hopper",
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "someone-elses-client"},
        {"iss": "https://evil.example.com"},
        {"email_verified": False},
        {"exp": datetime.now(UTC) - timedelta(minutes=1)},
    ],
)
def test_verify_google_credential_rejects_bad_tokens(google_key, overrides) -> None:
    with pytest.raises(OAuthError):
        oauth.verify_google_credential(_google_token(google_key, **overrides))


def test_verify_google_credential_rejects_wrong_signature(google_key) -> None:
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with pytest.raises(OAuthError):
        oauth.verify_google_credential(_google_token(other))


# --- GitHub code exchange ---------------------------------------------------


def _github_transport(
    *, token: dict, user: dict, emails: list
) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url == httpx.URL(oauth.GITHUB_TOKEN_URL):
            body = dict(httpx.QueryParams(request.content.decode()))
            assert body["client_secret"] == "test-github-secret"
            assert body["redirect_uri"] == CALLBACK
            return httpx.Response(200, json=token)
        assert request.headers["Authorization"] == "Bearer gho_test"
        if request.url.path == "/user":
            return httpx.Response(200, json=user)
        if request.url.path == "/user/emails":
            return httpx.Response(200, json=emails)
        return httpx.Response(404)

    return httpx.MockTransport(handler)


def _use_transport(
    monkeypatch: pytest.MonkeyPatch, transport: httpx.MockTransport
) -> None:
    real_client = httpx.Client
    monkeypatch.setattr(
        oauth.httpx,
        "Client",
        lambda **kwargs: real_client(transport=transport, **kwargs),
    )


def test_exchange_github_code_returns_verified_primary_email(monkeypatch) -> None:
    _use_transport(
        monkeypatch,
        _github_transport(
            token={"access_token": "gho_test"},
            user={"id": 42, "login": "grace", "name": None},
            emails=[
                {"email": "old@example.com", "verified": True, "primary": False},
                {"email": "Grace@Example.com", "verified": True, "primary": True},
            ],
        ),
    )
    identity = oauth.exchange_github_code("code", CALLBACK)
    assert identity == ProviderIdentity(
        provider="github", subject="42", email="grace@example.com", name="grace"
    )


def test_exchange_github_code_requires_a_verified_email(monkeypatch) -> None:
    _use_transport(
        monkeypatch,
        _github_transport(
            token={"access_token": "gho_test"},
            user={"id": 42, "login": "grace"},
            emails=[{"email": "g@example.com", "verified": False, "primary": True}],
        ),
    )
    with pytest.raises(OAuthError):
        oauth.exchange_github_code("code", CALLBACK)


def test_exchange_github_code_rejects_used_code(monkeypatch) -> None:
    _use_transport(
        monkeypatch,
        _github_transport(
            token={"error": "bad_verification_code"}, user={}, emails=[]
        ),
    )
    with pytest.raises(OAuthError):
        oauth.exchange_github_code("code", CALLBACK)
