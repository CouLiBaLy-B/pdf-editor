"""record terms acceptance

Revision ID: 004_terms_acceptance
Revises: 003_unique_stripe_session
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = "004_terms_acceptance"
down_revision = "003_unique_stripe_session"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotence : ne pas recréer les colonnes si une base existante les contient déjà.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("users")}
    if "terms_accepted_at" not in columns:
        op.add_column("users", sa.Column("terms_accepted_at", sa.DateTime(), nullable=True))
    if "token_version" not in columns:
        op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))

def downgrade() -> None:
    op.drop_column("users", "token_version")
    op.drop_column("users", "terms_accepted_at")
