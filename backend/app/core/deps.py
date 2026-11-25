import logging
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import InvalidTokenError, decode_access_token
from app.db.session import get_db
from app.db_models.user import User

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized("Not authenticated")

    try:
        user_id = decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise _unauthorized("Invalid or expired token") from exc

    try:
        user = db.get(User, user_id)
    except SQLAlchemyError as exc:
        logger.exception("Could not load the authenticated user")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc

    if user is None:
        raise _unauthorized("Invalid or expired token")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
