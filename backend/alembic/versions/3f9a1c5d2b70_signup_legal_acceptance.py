"""signup legal acceptance — Terms/Privacy audit fields on users

Revision ID: 3f9a1c5d2b70
Revises: e716a161515b
Create Date: 2026-10-16 00:00:00.000000

Signup now requires explicit acceptance of Terms & Conditions and the
Privacy Policy. This records enough to prove which version was accepted:

* `users.terms_accepted_at` / `users.privacy_accepted_at` — UTC timestamps
  generated server-side at signup, never client-supplied.
* `users.terms_version` / `users.privacy_version` — the prototype document
  versions accepted (config `TERMS_VERSION` / `PRIVACY_VERSION`).

All four columns are nullable so existing accounts — created before this
phase — migrate safely and stay usable; they simply have no recorded
acceptance (serialized as `termsAccepted: false` on /me).
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3f9a1c5d2b70"
down_revision: str | Sequence[str] | None = "e716a161515b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "terms_accepted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column("terms_version", sa.String(40), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "privacy_accepted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column("privacy_version", sa.String(40), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "privacy_version")
    op.drop_column("users", "privacy_accepted_at")
    op.drop_column("users", "terms_version")
    op.drop_column("users", "terms_accepted_at")
