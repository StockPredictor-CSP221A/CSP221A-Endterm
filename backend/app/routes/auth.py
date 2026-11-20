import logging
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.config import get_settings
from app.core.deps import CurrentUser, DbSession
from app.core.security import (
    burn_password_check,
    create_access_token,
    hash_password,
    verify_password,
)
from app.db_models.oauth_account import OAuthAccount
from app.db_models.user import User
from app.schemas.auth import (
    AuthProviders,
    GitHubSignInRequest,
    GoogleSignInRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.services.oauth import (
    OAuthError,
    ProviderIdentity,
    ProviderUnavailableError,
    exchange_github_code,
    verify_google_credential,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_DB_UNAVAILABLE = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable"
)


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
def register(body: RegisterRequest, db: DbSession) -> TokenResponse:
    duplicate = HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="An account with this email already exists",
    )
    try:
        if db.scalar(select(User.id).where(User.email == body.email)) is not None:
            raise duplicate

        user = User(
            email=body.email,
            hashed_password=hash_password(body.password),
            display_name=body.display_name,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise duplicate from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not register user")
        raise _DB_UNAVAILABLE from exc

    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: DbSession) -> TokenResponse:
    try:
        user = db.scalar(select(User).where(User.email == body.email))
    except SQLAlchemyError as exc:
        logger.exception("Could not look up user during login")
        raise _DB_UNAVAILABLE from exc

    if user is None or user.hashed_password is None:
        # Unknown email, or an account that only signs in through Google or
        # GitHub. Spend the same time either way.
        burn_password_check(body.password)
        valid = False
    else:
        valid = verify_password(body.password, user.hashed_password)

    if user is None or not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _token_response(user)


GITHUB_CALLBACK_PATH = "/auth/github/callback"
_PROVIDER_LABELS = {"google": "Google", "github": "GitHub"}


@router.get("/providers", response_model=AuthProviders)
def providers() -> AuthProviders:
    settings = get_settings()
    github_ready = bool(settings.github_client_id and settings.github_client_secret)
    return AuthProviders(
        google_client_id=settings.google_client_id or None,
        github_client_id=settings.github_client_id if github_ready else None,
    )


def _not_configured(provider: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{_PROVIDER_LABELS[provider]} sign-in is not enabled",
    )


def _rejected(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)


def _unavailable(provider: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Could not reach {_PROVIDER_LABELS[provider]}. Please try again.",
    )


def _sign_in_with(identity: ProviderIdentity, db: DbSession) -> TokenResponse:
    """Find or create the user behind a verified Google or GitHub identity."""
    password_account = HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=(
            "An account with this email already exists. Sign in with your "
            "email and password instead."
        ),
    )
    try:
        user = db.scalar(
            select(User)
            .join(OAuthAccount, OAuthAccount.user_id == User.id)
            .where(
                OAuthAccount.provider == identity.provider,
                OAuthAccount.subject == identity.subject,
            )
        )
        if user is not None:
            return _token_response(user)

        user = db.scalar(select(User).where(User.email == identity.email))
        if user is None:
            name = (identity.name or "").strip()[:64] or None
            user = User(email=identity.email, hashed_password=None, display_name=name)
            db.add(user)
            db.flush()
        elif user.hashed_password is not None:
            # Password sign-up does not verify email ownership, so linking here
            # could hand someone else's account to whoever registered first.
            raise password_account

        db.add(
            OAuthAccount(
                user_id=user.id,
                provider=identity.provider,
                subject=identity.subject,
            )
        )
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise password_account from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not sign in with %s", identity.provider)
        raise _DB_UNAVAILABLE from exc

    return _token_response(user)


@router.post("/google", response_model=TokenResponse)
def google_sign_in(body: GoogleSignInRequest, db: DbSession) -> TokenResponse:
    if not get_settings().google_client_id:
        raise _not_configured("google")
    try:
        identity = verify_google_credential(body.credential)
    except OAuthError as exc:
        raise _rejected(str(exc)) from exc
    except ProviderUnavailableError as exc:
        raise _unavailable("google") from exc
    return _sign_in_with(identity, db)


def _allowed_redirect(redirect_uri: str) -> bool:
    parts = urlsplit(redirect_uri)
    origin = f"{parts.scheme}://{parts.netloc}"
    return (
        parts.path == GITHUB_CALLBACK_PATH
        and not parts.query
        and not parts.fragment
        and origin in get_settings().cors_origins
    )


@router.post("/github", response_model=TokenResponse)
def github_sign_in(body: GitHubSignInRequest, db: DbSession) -> TokenResponse:
    settings = get_settings()
    if not (settings.github_client_id and settings.github_client_secret):
        raise _not_configured("github")
    if not _allowed_redirect(body.redirect_uri):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid redirect URI"
        )
    try:
        identity = exchange_github_code(body.code, body.redirect_uri)
    except OAuthError as exc:
        raise _rejected(str(exc)) from exc
    except ProviderUnavailableError as exc:
        raise _unavailable("github") from exc
    return _sign_in_with(identity, db)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> Response:
    """Tokens are stateless; the client discards its copy."""
    return Response(status_code=status.HTTP_204_NO_CONTENT)
