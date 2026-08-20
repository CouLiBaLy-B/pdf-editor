"""initial schema v2 - pay-as-you-go

Revision ID: 001_initial
Revises:
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa

revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotence : si une base existante (créée par init_db/create_all avant
    # l'introduction des migrations) contient déjà ces tables sans table
    # alembic_version, on ne les recrée pas.
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table('users'):
        op.create_table(
            'users',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('email', sa.String(), nullable=False, unique=True, index=True),
            sa.Column('hashed_password', sa.String(), nullable=False),
            sa.Column('credits', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('stripe_customer_id', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
    if not inspector.has_table('files'):
        op.create_table(
            'files',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('size_bytes', sa.Integer(), server_default='0'),
            sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('last_accessed_at', sa.DateTime(), nullable=True),
        )
    if not inspector.has_table('share_links'):
        op.create_table(
            'share_links',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('file_id', sa.String(), sa.ForeignKey('files.id'), nullable=False),
            sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('token', sa.String(), unique=True, nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
    if not inspector.has_table('transactions'):
        op.create_table(
            'transactions',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('file_id', sa.String(), nullable=True),
            sa.Column('type', sa.String(), nullable=False),
            sa.Column('credits_delta', sa.Integer(), nullable=False),
            sa.Column('stripe_session_id', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    op.drop_table('transactions')
    op.drop_table('share_links')
    op.drop_table('files')
    op.drop_table('users')
