"""connections + private contact fields (phase 2)

Revision ID: 810496335b61
Revises: 70311ae197b1
Create Date: 2026-10-02 10:12:44.918305

Adds the `connections` table — one row per unordered user pair, instant
connect with no pending state — plus three nullable private contact/social
columns on `users` that only the owner and connected users may read.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "810496335b61"
down_revision: str | Sequence[str] | None = "70311ae197b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "connections",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_a_id", sa.UUID(), nullable=False),
        sa.Column("user_b_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "user_a_id < user_b_id", name="ck_connections_ordered_pair"
        ),
        sa.ForeignKeyConstraint(
            ["user_a_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_b_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_a_id", "user_b_id", name="uq_connections_pair"
        ),
    )
    op.create_index(
        "ix_connections_user_b_id", "connections", ["user_b_id"], unique=False
    )
    op.add_column(
        "users", sa.Column("linkedin", sa.String(length=200), nullable=True)
    )
    op.add_column(
        "users", sa.Column("instagram", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "users", sa.Column("contact_email", sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "contact_email")
    op.drop_column("users", "instagram")
    op.drop_column("users", "linkedin")
    op.drop_index("ix_connections_user_b_id", table_name="connections")
    op.drop_table("connections")
