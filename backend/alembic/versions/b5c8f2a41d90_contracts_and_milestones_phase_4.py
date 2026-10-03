"""contracts + milestones (phase 4)

Revision ID: b5c8f2a41d90
Revises: 810496335b61
Create Date: 2026-10-03 09:14:00.000000

Adds the `contracts` table — one row per accepted ASK/offer pair, created
inside the accept transaction — and the `milestones` table that carries
the role-gated provider→seeker workflow (submitted → approved → paid).
Rating on `contracts` is seeker-written, set-once, post-completion only.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b5c8f2a41d90"
down_revision: str | Sequence[str] | None = "810496335b61"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "contracts",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("ask_id", sa.UUID(), nullable=False),
        sa.Column("offer_id", sa.UUID(), nullable=False),
        sa.Column("seeker_id", sa.UUID(), nullable=False),
        sa.Column("provider_id", sa.UUID(), nullable=False),
        sa.Column(
            "agreed_price", sa.Numeric(precision=12, scale=2), nullable=False
        ),
        sa.Column(
            "currency",
            sa.String(length=3),
            server_default="INR",
            nullable=False,
        ),
        sa.Column(
            "deliverables",
            sa.ARRAY(sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("active", "completed", name="contract_status"),
            server_default="active",
            nullable=False,
        ),
        sa.Column(
            "rating", sa.Numeric(precision=2, scale=1), nullable=True
        ),
        sa.Column("review", sa.String(length=1000), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
            "agreed_price >= 0", name="ck_contracts_agreed_price_nonneg"
        ),
        sa.CheckConstraint(
            "char_length(currency) = 3", name="ck_contracts_currency_len"
        ),
        sa.CheckConstraint(
            "rating >= 0 AND rating <= 5", name="ck_contracts_rating_range"
        ),
        sa.ForeignKeyConstraint(["ask_id"], ["asks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["offer_id"], ["offers.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["seeker_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_contracts_ask_id", "contracts", ["ask_id"], unique=True
    )
    op.create_index(
        "uq_contracts_offer_id", "contracts", ["offer_id"], unique=True
    )
    op.create_index(
        "ix_contracts_seeker_id", "contracts", ["seeker_id"], unique=False
    )
    op.create_index(
        "ix_contracts_provider_id_status",
        "contracts",
        ["provider_id", "status"],
        unique=False,
    )

    op.create_table(
        "milestones",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("contract_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column(
            "amount", sa.Numeric(precision=12, scale=2), nullable=False
        ),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "upcoming",
                "in_progress",
                "submitted",
                "approved",
                "paid",
                name="milestone_status",
            ),
            server_default="upcoming",
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
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
        sa.CheckConstraint("amount >= 0", name="ck_milestones_amount_nonneg"),
        sa.ForeignKeyConstraint(
            ["contract_id"], ["contracts.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_milestones_contract_id_status",
        "milestones",
        ["contract_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "ix_milestones_contract_id_status", table_name="milestones"
    )
    op.drop_table("milestones")
    op.drop_index(
        "ix_contracts_provider_id_status", table_name="contracts"
    )
    op.drop_index("ix_contracts_seeker_id", table_name="contracts")
    op.drop_index("uq_contracts_offer_id", table_name="contracts")
    op.drop_index("uq_contracts_ask_id", table_name="contracts")
    op.drop_table("contracts")
    sa.Enum(name="milestone_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="contract_status").drop(op.get_bind(), checkfirst=True)
