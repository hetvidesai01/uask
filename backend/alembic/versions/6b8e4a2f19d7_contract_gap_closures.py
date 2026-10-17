"""contract gap closures — stage paidAt, amendment withdrawn

Revision ID: 6b8e4a2f19d7
Revises: 3f9a1c5d2b70
Create Date: 2026-10-17 00:00:00.000000

Closes the three gaps found by the final frontend/backend audit:

* `milestones.paid_at` — nullable UTC timestamp stamped by the server the
  moment a payment stage transitions to `paid`. Existing (already-paid)
  rows migrate safely as NULL; nothing is back-filled or forced.
* `amendment_status` gains `withdrawn` so a proposer can retract their own
  pending amendment with an explicit state (never overloaded onto
  `rejected`). ADD VALUE must commit on its own before the value can be
  used, so it runs in autocommit.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6b8e4a2f19d7"
down_revision: str | Sequence[str] | None = "3f9a1c5d2b70"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "milestones",
        sa.Column(
            "paid_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE amendment_status ADD VALUE IF NOT EXISTS 'withdrawn'"
        )


def downgrade() -> None:
    # Map any withdrawn rows back onto rejected before shrinking the enum
    # (withdrawal can only exist if this revision ran).
    op.execute(
        "UPDATE contract_amendments SET status = 'rejected' "
        "WHERE status = 'withdrawn'"
    )
    bind = op.get_bind()
    op.execute(
        "ALTER TABLE contract_amendments ALTER COLUMN status DROP DEFAULT"
    )
    op.execute(
        "ALTER TYPE amendment_status RENAME TO amendment_status_old"
    )
    sa.Enum(
        "pending", "approved", "rejected", name="amendment_status"
    ).create(bind)
    op.execute(
        "ALTER TABLE contract_amendments ALTER COLUMN status "
        "TYPE amendment_status USING status::text::amendment_status"
    )
    op.execute("DROP TYPE amendment_status_old")
    op.execute(
        "ALTER TABLE contract_amendments ALTER COLUMN status "
        "SET DEFAULT 'pending'"
    )

    op.drop_column("milestones", "paid_at")
