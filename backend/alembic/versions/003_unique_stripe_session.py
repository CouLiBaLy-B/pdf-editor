"""prevent duplicate Stripe checkout processing

Revision ID: 003_unique_stripe_session
Revises: 002_add_is_admin
Create Date: 2026-08-19
"""
from alembic import op

revision = "003_unique_stripe_session"
down_revision = "002_add_is_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_transactions_stripe_session_id",
        "transactions",
        ["stripe_session_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_transactions_stripe_session_id",
        "transactions",
        type_="unique",
    )
