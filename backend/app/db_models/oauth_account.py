from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db_models.base import Base


class OAuthAccount(Base):
    """Links a user to an identity at an outside sign-in provider."""

    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint(
            "provider", "subject", name="uq_oauth_accounts_provider_subject"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(16))
    # The provider's stable user ID ("sub" for Google, numeric ID for GitHub).
    subject: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
