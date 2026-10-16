"""contract alignment phase 8 — draft/sign flow, 25/50/25 stages, terms

Revision ID: e716a161515b
Revises: d6a2c4f81b97
Create Date: 2026-10-15 00:00:00.000000

Redesigns the contract experience to the approved frontend flow:

* `contract_status` gains draft / awaiting_signatures / cancelled / disputed.
  Existing rows keep their value; the column default becomes `draft` so a
  newly accepted offer starts unsigned.
* `milestone_status` is replaced with the payment-stage states
  (not_due / due / awaiting_approval / paid / disputed). Old in-flight rows
  are remapped to a sensible equivalent; `paid` survives unchanged.
* `milestones` gains `kind` (initial / progress / final) for the 25/50/25
  schedule and `stage_kind` enum type.
* `contracts` gains the frozen terms snapshot, dual signature timestamps,
  derived progress + edit counters, cancellation-request fields, and the
  ownership / portfolio / confidentiality terms.
* New tables: `contract_histories` (audit), `contract_disputes`,
  `contract_amendments`.

No secrets are stored in audit details. All new FKs use ON DELETE rules.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e716a161515b"
down_revision: str | Sequence[str] | None = "d6a2c4f81b97"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    # ------------------------------------------------------------------
    # 1. contract_status: add the new lifecycle values (additive; existing
    #    active/completed rows are untouched). ADD VALUE must commit on its
    #    own before the value can be used, so run it in autocommit.
    # ------------------------------------------------------------------
    with op.get_context().autocommit_block():
        for value in (
            "draft",
            "awaiting_signatures",
            "cancelled",
            "disputed",
        ):
            op.execute(
                sa.text(
                    f"ALTER TYPE contract_status ADD VALUE IF NOT EXISTS '{value}'"
                )
            )

    # ------------------------------------------------------------------
    # 2. ownership / portfolio enums (new).
    # ------------------------------------------------------------------
    sa.Enum(
        "transfers_after_final_payment",
        "custom",
        name="ownership_option",
    ).create(bind, checkfirst=True)
    sa.Enum(
        "allowed",
        "not_allowed",
        "ask_before_using",
        name="portfolio_permission",
    ).create(bind, checkfirst=True)

    # ------------------------------------------------------------------
    # 3. contract terms + signature + derived columns.
    # ------------------------------------------------------------------
    op.add_column(
        "contracts",
        sa.Column("scope", sa.Text(), nullable=True),
    )
    op.add_column(
        "contracts",
        sa.Column("final_deadline", sa.Date(), nullable=True),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "included_revision_count",
            sa.Integer(),
            server_default="2",
            nullable=False,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "revisions_used",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "ownership_option",
            sa.Enum(
                "transfers_after_final_payment",
                "custom",
                name="ownership_option",
            ),
            server_default="transfers_after_final_payment",
            nullable=False,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "portfolio_permission",
            sa.Enum(
                "allowed",
                "not_allowed",
                "ask_before_using",
                name="portfolio_permission",
            ),
            server_default="ask_before_using",
            nullable=False,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "confidentiality_agreed",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "terms_version",
            sa.String(length=32),
            server_default="demo-2026-10",
            nullable=False,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column("ask_side_signed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "respond_side_signed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "project_progress",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "contract_edit_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "cancellation_requested_by",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "cancellation_reason",
            sa.String(length=500),
            nullable=True,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "cancellation_requested_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "cancellation_progress_snapshot",
            sa.Integer(),
            nullable=True,
        ),
    )
    op.create_check_constraint(
        "ck_contracts_progress_values",
        "contracts",
        "project_progress IN (0, 25, 60, 100)",
    )
    op.create_check_constraint(
        "ck_contracts_revisions_used_nonneg",
        "contracts",
        "revisions_used >= 0",
    )
    op.create_check_constraint(
        "ck_contracts_included_revisions_nonneg",
        "contracts",
        "included_revision_count >= 0",
    )
    op.create_check_constraint(
        "ck_contracts_edit_count_nonneg",
        "contracts",
        "contract_edit_count >= 0",
    )

    # A newly accepted offer now starts as a draft, not an active contract.
    op.alter_column(
        "contracts",
        "status",
        server_default="draft",
        existing_type=sa.Enum(
            "draft",
            "awaiting_signatures",
            "active",
            "completed",
            "cancelled",
            "disputed",
            name="contract_status",
        ),
    )

    # ------------------------------------------------------------------
    # 4. milestones -> payment stages. Replace the status enum in place and
    #    add the `kind` discriminator. Old values remap as:
    #      upcoming/in_progress -> not_due, submitted -> awaiting_approval,
    #      approved -> due, paid -> paid (unchanged).
    # ------------------------------------------------------------------
    sa.Enum(
        "initial",
        "progress",
        "final",
        name="stage_kind",
    ).create(bind, checkfirst=True)

    op.add_column(
        "milestones",
        sa.Column(
            "kind",
            sa.Enum(
                "initial",
                "progress",
                "final",
                name="stage_kind",
            ),
            server_default="initial",
            nullable=False,
        ),
    )

    # Backfill `kind` from position (the 25/50/25 schedule is exactly three
    # rows ordered by position); anything past 2 stays `final`.
    op.execute(
        sa.text(
            "UPDATE milestones SET kind = CASE "
            "WHEN position = 0 THEN 'initial'::stage_kind "
            "WHEN position = 1 THEN 'progress'::stage_kind "
            "ELSE 'final'::stage_kind END"
        )
    )

    # Swap milestone_status to the payment-stage values via a fresh type.
    op.execute("ALTER TYPE milestone_status RENAME TO milestone_status_old")
    sa.Enum(
        "not_due",
        "due",
        "awaiting_approval",
        "paid",
        "disputed",
        name="milestone_status",
    ).create(bind, checkfirst=False)
    op.execute(
        sa.text(
            "ALTER TABLE milestones ALTER COLUMN status DROP DEFAULT"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE milestones ALTER COLUMN status TYPE milestone_status "
            "USING (CASE status::text "
            "WHEN 'upcoming' THEN 'not_due'::milestone_status "
            "WHEN 'in_progress' THEN 'not_due'::milestone_status "
            "WHEN 'submitted' THEN 'awaiting_approval'::milestone_status "
            "WHEN 'approved' THEN 'due'::milestone_status "
            "WHEN 'paid' THEN 'paid'::milestone_status "
            "ELSE 'not_due'::milestone_status END)"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE milestones ALTER COLUMN status "
            "SET DEFAULT 'not_due'::milestone_status"
        )
    )
    sa.Enum(name="milestone_status_old").drop(bind, checkfirst=True)

    # ------------------------------------------------------------------
    # 5. audit / dispute / amendment tables.
    # ------------------------------------------------------------------
    op.create_table(
        "contract_histories",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("contract_id", sa.UUID(), nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column(
            "details",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["contract_id"], ["contracts.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_contract_histories_contract_id",
        "contract_histories",
        ["contract_id"],
    )

    op.create_table(
        "contract_disputes",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("contract_id", sa.UUID(), nullable=False),
        sa.Column("raised_by", sa.UUID(), nullable=False),
        sa.Column(
            "reason",
            sa.Enum(
                "scope_mismatch",
                "missed_deadline",
                "communication_issue",
                "payment_disagreement",
                "revision_disagreement",
                "other",
                name="dispute_reason",
            ),
            nullable=False,
        ),
        sa.Column(
            "description", sa.String(length=2000), nullable=True
        ),
        sa.Column(
            "status",
            sa.Enum("open", "resolved", name="dispute_status"),
            server_default="open",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "resolved_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.ForeignKeyConstraint(
            ["contract_id"], ["contracts.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["raised_by"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_contract_disputes_contract_id_status",
        "contract_disputes",
        ["contract_id", "status"],
    )

    op.create_table(
        "contract_amendments",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("contract_id", sa.UUID(), nullable=False),
        sa.Column("proposed_by", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="amendment_status"),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "changes",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("edit_number", sa.Integer(), nullable=False),
        sa.Column("resolved_by", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "resolved_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.ForeignKeyConstraint(
            ["contract_id"], ["contracts.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["proposed_by"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["resolved_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_contract_amendments_contract_id_status",
        "contract_amendments",
        ["contract_id", "status"],
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index(
        "ix_contract_amendments_contract_id_status",
        table_name="contract_amendments",
    )
    op.drop_table("contract_amendments")
    sa.Enum(name="amendment_status").drop(bind, checkfirst=True)

    op.drop_index(
        "ix_contract_disputes_contract_id_status",
        table_name="contract_disputes",
    )
    op.drop_table("contract_disputes")
    sa.Enum(name="dispute_status").drop(bind, checkfirst=True)
    sa.Enum(name="dispute_reason").drop(bind, checkfirst=True)

    op.drop_index(
        "ix_contract_histories_contract_id", table_name="contract_histories"
    )
    op.drop_table("contract_histories")

    # Restore milestone_status to the old role-gated values.
    op.execute("ALTER TYPE milestone_status RENAME TO milestone_status_new")
    sa.Enum(
        "upcoming",
        "in_progress",
        "submitted",
        "approved",
        "paid",
        name="milestone_status",
    ).create(bind, checkfirst=False)
    op.execute("ALTER TABLE milestones ALTER COLUMN status DROP DEFAULT")
    op.execute(
        sa.text(
            "ALTER TABLE milestones ALTER COLUMN status TYPE milestone_status "
            "USING (CASE status::text "
            "WHEN 'not_due' THEN 'upcoming'::milestone_status "
            "WHEN 'due' THEN 'approved'::milestone_status "
            "WHEN 'awaiting_approval' THEN 'submitted'::milestone_status "
            "WHEN 'paid' THEN 'paid'::milestone_status "
            "ELSE 'upcoming'::milestone_status END)"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE milestones ALTER COLUMN status "
            "SET DEFAULT 'upcoming'::milestone_status"
        )
    )
    sa.Enum(name="milestone_status_new").drop(bind, checkfirst=True)

    op.drop_column("milestones", "kind")
    sa.Enum(name="stage_kind").drop(bind, checkfirst=True)

    op.drop_constraint(
        "ck_contracts_edit_count_nonneg", "contracts", type_="check"
    )
    op.drop_constraint(
        "ck_contracts_included_revisions_nonneg", "contracts", type_="check"
    )
    op.drop_constraint(
        "ck_contracts_revisions_used_nonneg", "contracts", type_="check"
    )
    op.drop_constraint(
        "ck_contracts_progress_values", "contracts", type_="check"
    )
    for col in (
        "cancellation_progress_snapshot",
        "cancellation_requested_at",
        "cancellation_reason",
        "cancellation_requested_by",
        "contract_edit_count",
        "project_progress",
        "respond_side_signed_at",
        "ask_side_signed_at",
        "terms_version",
        "confidentiality_agreed",
        "portfolio_permission",
        "ownership_option",
        "revisions_used",
        "included_revision_count",
        "final_deadline",
        "scope",
    ):
        op.drop_column("contracts", col)

    op.alter_column(
        "contracts",
        "status",
        server_default="active",
        existing_type=sa.Enum(
            "draft",
            "awaiting_signatures",
            "active",
            "completed",
            "cancelled",
            "disputed",
            name="contract_status",
        ),
    )
    sa.Enum(name="portfolio_permission").drop(bind, checkfirst=True)
    sa.Enum(name="ownership_option").drop(bind, checkfirst=True)
