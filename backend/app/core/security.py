import hashlib
import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.config import get_settings

logger = logging.getLogger(__name__)

_password_hash = PasswordHash((Argon2Hasher(),))


class InvalidTokenError(Exception):
    """Raised when an access token is missing claims, expired, or forged."""


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return _password_hash.verify(password, hashed_password)


@lru_cache
def _dummy_hash() -> str:
    return _password_hash.hash(secrets.token_urlsafe(16))


def burn_password_check(password: str) -> None:
    """Spend the same time as a real check so unknown emails are not revealed."""
    _password_hash.verify(password, _dummy_hash())


@lru_cache
def _ephemeral_secret() -> str:
    logger.warning(
        "JWT_SECRET is not set; using a per-process signing key. "
        "Set JWT_SECRET for any shared or deployed environment."
    )
    return secrets.token_urlsafe(64)


def _signing_key() -> str:
    return get_settings().jwt_secret or _ephemeral_secret()


def password_stamp(hashed_password: str | None) -> str:
    """A short fingerprint of the stored password hash, carried in each token.

    Changing or setting a password changes the stamp, which signs out every
    session issued before the change.
    """
    message = (hashed_password or "").encode()
    digest = hmac.new(_signing_key().encode(), message, hashlib.sha256)
    return digest.hexdigest()[:16]


def create_access_token(
    user_id: int, *, stamp: str | None = None, now: datetime | None = None
) -> str:
    settings = get_settings()
    issued_at = now or datetime.now(UTC)
    payload: dict[str, object] = {
        "sub": str(user_id),
        "iat": issued_at,
        "exp": issued_at + timedelta(minutes=settings.access_token_expire_minutes),
    }
    if stamp is not None:
        payload["pwd"] = stamp
    return jwt.encode(payload, _signing_key(), algorithm=settings.jwt_algorithm)


def decode_session(token: str) -> tuple[int, str | None]:
    """Return the user ID and password stamp from a valid token."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            _signing_key(),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "iat", "exp"]},
        )
        stamp = payload.get("pwd")
        return int(payload["sub"]), stamp if isinstance(stamp, str) else None
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise InvalidTokenError("Invalid or expired token") from exc


def decode_access_token(token: str) -> int:
    return decode_session(token)[0]
