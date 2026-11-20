"""create predictions table

Revision ID: 0001
Revises:
Create Date: 2026-10-23

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("symbol", sa.String(length=16), nullable=False),
        sa.Column("forecast_horizon", sa.String(length=32), nullable=False),
        sa.Column("last_observed_date", sa.String(length=10), nullable=False),
        sa.Column("last_observed_close", sa.Float(), nullable=False),
        sa.Column("forecast_date", sa.String(length=10), nullable=False),
        sa.Column("predicted_close", sa.Float(), nullable=False),
        sa.Column("model_name", sa.String(length=128), nullable=False),
        sa.Column("model_version", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_predictions_symbol", "predictions", ["symbol"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_predictions_symbol", table_name="predictions")
    op.drop_table("predictions")
