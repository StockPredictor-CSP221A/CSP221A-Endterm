"""Verify sign-ins from Google and GitHub and return who the user is."""

import logging
from dataclasses import dataclass
from functools import lru_cache

import httpx
import jwt

from app.config import get_settings

logger = logging.getLogger(__name__)

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_URL = "https://api.github.com"

_TIMEOUT = httpx.Timeout(10.0)


@dataclass(frozen=True)
class ProviderIdentity:
    provider: str
    subject: str
    email: str
    name: str | None


class OAuthError(Exception):
    """The sign-in was rejected: bad token, bad code, or no verified email."""


class ProviderUnavailableError(Exception):
    """The provider could not be reached or answered unexpectedly."""


@lru_cache
def _google_jwks() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(GOOGLE_CERTS_URL, cache_keys=True)


def verify_google_credential(credential: str) -> ProviderIdentity:
    """Check a Google ID token from the "Sign in with Google" button."""
    client_id = get_settings().google_client_id
    try:
        signing_key = _google_jwks().get_signing_key_from_jwt(credential)
    except jwt.PyJWKClientConnectionError as exc:
        logger.exception("Could not fetch Google signing keys")
        raise ProviderUnavailableError("Google is unavailable") from exc
    except jwt.PyJWTError as exc:
        raise OAuthError("Invalid Google credential") from exc

    try:
        claims = jwt.decode(
            credential,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            options={"require": ["sub", "iss", "aud", "exp", "email"]},
        )
    except jwt.PyJWTError as exc:
        raise OAuthError("Invalid Google credential") from exc

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise OAuthError("Invalid Google credential")
    if claims.get("email_verified") is not True:
        raise OAuthError("Your Google email address is not verified")

    return ProviderIdentity(
        provider="google",
        subject=str(claims["sub"]),
        email=str(claims["email"]).strip().lower(),
        name=claims.get("name"),
    )


def _github_get(client: httpx.Client, path: str, access_token: str) -> object:
    res = client.get(
        f"{GITHUB_API_URL}{path}",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {access_token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    res.raise_for_status()
    return res.json()


def exchange_github_code(code: str, redirect_uri: str) -> ProviderIdentity:
    """Trade a GitHub OAuth code for the user's ID and verified primary email."""
    settings = get_settings()
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            token_res = client.post(
                GITHUB_TOKEN_URL,
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
            )
            token_res.raise_for_status()
            access_token = token_res.json().get("access_token")
            if not access_token:
                # GitHub answers 200 with an "error" field for bad or used codes.
                raise OAuthError("GitHub sign-in expired. Please try again.")

            profile = _github_get(client, "/user", access_token)
            emails = _github_get(client, "/user/emails", access_token)
    except httpx.HTTPError as exc:
        logger.exception("GitHub sign-in request failed")
        raise ProviderUnavailableError("GitHub is unavailable") from exc

    if not isinstance(profile, dict) or "id" not in profile:
        raise ProviderUnavailableError("GitHub returned an unexpected profile")

    entries = emails if isinstance(emails, list) else []
    verified = [
        entry
        for entry in entries
        if isinstance(entry, dict) and entry.get("verified") and entry.get("email")
    ]
    primary = next((e for e in verified if e.get("primary")), None) or next(
        iter(verified), None
    )
    if primary is None:
        raise OAuthError("Your GitHub account has no verified email address")

    return ProviderIdentity(
        provider="github",
        subject=str(profile["id"]),
        email=str(primary["email"]).strip().lower(),
        name=profile.get("name") or profile.get("login"),
    )
