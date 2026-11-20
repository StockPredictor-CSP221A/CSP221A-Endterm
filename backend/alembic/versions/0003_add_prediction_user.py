"""link predictions to users

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-04

Existing prediction rows keep a NULL user_id.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("predictions", sa.Column("user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_predictions_user_id_users",
        "predictions",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_predictions_user_id", "predictions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_predictions_user_id", table_name="predictions")
    op.drop_constraint(
        "fk_predictions_user_id_users", "predictions", type_="foreignkey"
    )
    op.drop_column("predictions", "user_id")
