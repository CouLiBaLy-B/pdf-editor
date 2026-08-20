"""add is_admin column to users

Revision ID: 002_add_is_admin
Revises: 001_initial
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision = '002_add_is_admin'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotence : ne pas recréer la colonne si une base existante la contient déjà.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("users")}
    if "is_admin" not in columns:
        op.add_column('users', sa.Column('is_admin', sa.Integer(), nullable=False, server_default='0'))

def downgrade() -> None:
    op.drop_column('users', 'is_admin')
