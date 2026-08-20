"""prevent duplicate Stripe checkout processing

Revision ID: 003_unique_stripe_session
Revises: 002_add_is_admin
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = "003_unique_stripe_session"
down_revision = "002_add_is_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotence : ne pas recréer la contrainte si elle existe déjà
    # (sous son nom, ou via une contrainte unique générée par create_all).
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    constraints = inspector.get_unique_constraints("transactions")
    exists = any(
        c["name"] == "uq_transactions_stripe_session_id"
        or c.get("column_names") == ["stripe_session_id"]
        for c in constraints
    )
    if not exists:
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
