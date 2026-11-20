from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


def _normalize_email(value: str) -> str:
    return value.strip().lower()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH
    )
    display_name: str | None = Field(default=None, max_length=64)

    @field_validator("email", mode="after")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("display_name", mode="before")
    @classmethod
    def blank_display_name(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("email", mode="after")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return _normalize_email(value)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str | None
    created_at: datetime
    # Whether the account can sign in with a password, and which outside
    # providers (google, github) are linked to it.
    has_password: bool = False
    providers: list[str] = []


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=64)

    @field_validator("display_name", mode="before")
    @classmethod
    def blank_display_name(cls, value: object) -> object:
        return _blank_to_none(value)


class EmailChangeRequest(BaseModel):
    new_email: EmailStr
    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("new_email", mode="after")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return _normalize_email(value)


class PasswordChangeRequest(BaseModel):
    # Required when the account already has a password.
    current_password: str | None = Field(default=None, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(
        min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AuthProviders(BaseModel):
    """Public client IDs for the sign-in buttons; null hides a provider."""

    google_client_id: str | None
    github_client_id: str | None


class GoogleSignInRequest(BaseModel):
    credential: str = Field(min_length=1, max_length=4096)


class GitHubSignInRequest(BaseModel):
    code: str = Field(min_length=1, max_length=512)
    redirect_uri: str = Field(min_length=1, max_length=2048)


class DeleteAccountRequest(BaseModel):
    # Typed by the user to confirm; must match the account email.
    confirm_email: str = Field(min_length=1, max_length=320)
    # Required when the account has a password.
    current_password: str | None = Field(default=None, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("confirm_email", mode="after")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return _normalize_email(value)
