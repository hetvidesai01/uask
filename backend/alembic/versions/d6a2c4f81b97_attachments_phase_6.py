"""attachments (phase 6)

Revision ID: d6a2c4f81b97
Revises: b5c8f2a41d90
Create Date: 2026-10-04 02:30:00.000000

Adds the `attachments` table — one row per uploaded file. `entity_type` +
`entity_id` are an optional, always-together pair (`ask` | `offer` |
`message`; for `message` the id is the thread id) recorded at upload time;
`entity_id` intentionally carries no foreign key because it is polymorphic.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d6a2c4f81b97"
down_revision: str | Sequence[str] | None = "b5c8f2a41d90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "attachments",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("entity_type", sa.String(length=16), nullable=True),
        sa.Column("entity_id", sa.UUID(), nullable=True),
        sa.Column("file_name", sa.String(length=120), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=255), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "entity_type IN ('ask', 'offer', 'message')",
            name="ck_attachments_entity_type",
        ),
        sa.CheckConstraint(
            "(entity_type IS NULL) = (entity_id IS NULL)",
            name="ck_attachments_entity_pair",
        ),
        sa.CheckConstraint(
            "size_bytes >= 0", name="ck_attachments_size_nonneg"
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_attachments_storage_key",
        "attachments",
        ["storage_key"],
        unique=True,
    )
    op.create_index(
        "ix_attachments_entity_type_entity_id",
        "attachments",
        ["entity_type", "entity_id"],
        unique=False,
    )
    op.create_index(
        "ix_attachments_owner_id_created_at",
        "attachments",
        ["owner_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "ix_attachments_owner_id_created_at", table_name="attachments"
    )
    op.drop_index(
        "ix_attachments_entity_type_entity_id", table_name="attachments"
    )
    op.drop_index("uq_attachments_storage_key", table_name="attachments")
    op.drop_table("attachments")
