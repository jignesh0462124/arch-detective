"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-07-10 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "scan_type",
            sa.Enum("codebase", "architecture", "logs", "full", name="scan_type", native_enum=False),
            nullable=False,
        ),
        sa.Column("target_name", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "running", "completed", "failed", name="scan_status", native_enum=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("finding_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("framework_scores", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scans_status"), "scans", ["status"], unique=False)
    op.create_index(op.f("ix_scans_user_id"), "scans", ["user_id"], unique=False)

    op.create_table(
        "findings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "severity",
            sa.Enum("critical", "high", "medium", "low", name="severity", native_enum=False),
            nullable=False,
        ),
        sa.Column("cvss_score", sa.Float(), nullable=True),
        sa.Column("cvss_vector", sa.String(length=255), nullable=True),
        sa.Column("cwe_id", sa.String(length=32), nullable=True),
        sa.Column("cve_id", sa.String(length=32), nullable=True),
        sa.Column("file_path", sa.String(length=1024), nullable=True),
        sa.Column("line_number", sa.Integer(), nullable=True),
        sa.Column("code_snippet", sa.Text(), nullable=True),
        sa.Column(
            "source",
            sa.Enum(
                "semgrep",
                "bandit",
                "trufflehog",
                "pip-audit",
                "npm-audit",
                "log-anomaly",
                "llm-review",
                "architecture",
                name="finding_source",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("remediation", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_findings_scan_id"), "findings", ["scan_id"], unique=False)
    op.create_index(op.f("ix_findings_severity"), "findings", ["severity"], unique=False)
    op.create_index(op.f("ix_findings_source"), "findings", ["source"], unique=False)

    op.create_table(
        "compliance_violations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("finding_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("framework", sa.String(length=64), nullable=False),
        sa.Column("control_id", sa.String(length=64), nullable=False),
        sa.Column("control_title", sa.String(length=255), nullable=False),
        sa.Column("violation_description", sa.Text(), nullable=False),
        sa.Column("evidence", sa.Text(), nullable=False),
        sa.Column("rag_chunk_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.ForeignKeyConstraint(["finding_id"], ["findings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_compliance_violations_finding_id"), "compliance_violations", ["finding_id"], unique=False)
    op.create_index(op.f("ix_compliance_violations_framework"), "compliance_violations", ["framework"], unique=False)

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pdf_url", sa.String(length=2048), nullable=False),
        sa.Column("signed_url", sa.String(length=4096), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reports_scan_id"), "reports", ["scan_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_reports_scan_id"), table_name="reports")
    op.drop_table("reports")
    op.drop_index(op.f("ix_compliance_violations_framework"), table_name="compliance_violations")
    op.drop_index(op.f("ix_compliance_violations_finding_id"), table_name="compliance_violations")
    op.drop_table("compliance_violations")
    op.drop_index(op.f("ix_findings_source"), table_name="findings")
    op.drop_index(op.f("ix_findings_severity"), table_name="findings")
    op.drop_index(op.f("ix_findings_scan_id"), table_name="findings")
    op.drop_table("findings")
    op.drop_index(op.f("ix_scans_user_id"), table_name="scans")
    op.drop_index(op.f("ix_scans_status"), table_name="scans")
    op.drop_table("scans")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
