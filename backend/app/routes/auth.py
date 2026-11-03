import logging

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.deps import CurrentUser, DbSession
from app.core.security import (
    burn_password_check,
    create_access_token,
    hash_password,
    verify_password,
)
from app.db_models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut

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

    if user is None:
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


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> Response:
    """Tokens are stateless; the client discards its copy."""
    return Response(status_code=status.HTTP_204_NO_CONTENT)
