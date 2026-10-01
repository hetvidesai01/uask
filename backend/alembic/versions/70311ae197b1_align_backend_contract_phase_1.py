"""align backend contract phase 1 — ask lifecycle + notification names

Revision ID: 70311ae197b1
Revises: 829d296f1f94
Create Date: 2026-10-01 16:38:03.114357

Adds the `accepted` ASK state (provider chosen, work in progress) and
renames two notification types to the canonical frontend names.
Renames, not drops, so existing notification rows keep their history.
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "70311ae197b1"
down_revision: str | Sequence[str] | None = "829d296f1f94"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        "ALTER TYPE ask_status "
        "ADD VALUE IF NOT EXISTS 'accepted' BEFORE 'closed'"
    )
    op.execute(
        "ALTER TYPE notification_type "
        "RENAME VALUE 'ask_new_offer' TO 'offer_received'"
    )
    op.execute(
        "ALTER TYPE notification_type RENAME VALUE 'new_message' TO 'message'"
    )


def downgrade() -> None:
    """Downgrade schema.

    PostgreSQL cannot drop an enum value, so both types are rebuilt under
    their old labels and the columns are recast. Existing rows survive:
    `accepted` becomes `closed`, the two renamed notification types revert
    to their previous names.
    """
    op.execute("ALTER TABLE asks ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TYPE ask_status RENAME TO ask_status_old")
    op.execute(
        "CREATE TYPE ask_status AS ENUM "
        "('open', 'matched', 'in_review', 'closed', 'cancelled')"
    )
    op.execute(
        "ALTER TABLE asks ALTER COLUMN status TYPE ask_status "
        "USING (CASE WHEN status::text = 'accepted' "
        "THEN 'closed'::ask_status ELSE status::text::ask_status END)"
    )
    op.execute("DROP TYPE ask_status_old")
    op.execute("ALTER TABLE asks ALTER COLUMN status SET DEFAULT 'open'")

    op.execute("ALTER TYPE notification_type RENAME TO notification_type_old")
    op.execute(
        "CREATE TYPE notification_type AS ENUM "
        "('ask_new_offer', 'offer_shortlisted', 'offer_accepted', "
        "'offer_rejected', 'ask_closing_soon', 'new_message', "
        "'ask_matched', 'system')"
    )
    op.execute(
        "ALTER TABLE notifications ALTER COLUMN type TYPE notification_type "
        "USING (CASE type::text "
        "WHEN 'offer_received' THEN 'ask_new_offer'::notification_type "
        "WHEN 'message' THEN 'new_message'::notification_type "
        "ELSE type::text::notification_type END)"
    )
    op.execute("DROP TYPE notification_type_old")
