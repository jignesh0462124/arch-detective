"""Supabase-native initial schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-07-22 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


TENANT_TABLES = (
    "profiles",
    "workspaces",
    "workspace_members",
    "scans",
    "scan_artifacts",
    "findings",
    "compliance_violations",
    "reports",
    "audit_events",
)


def _create_tables() -> None:
    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=True),
        sa.Column("avatar_url", sa.String(length=2048), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["id"], ["auth.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["auth.users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_workspaces_slug", "workspaces", ["slug"], unique=True)
    op.create_index("ix_workspaces_owner_user_id", "workspaces", ["owner_user_id"])

    op.create_table(
        "workspace_members",
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "role IN ('owner', 'admin', 'analyst', 'viewer')",
            name="ck_workspace_members_role",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["auth.users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("workspace_id", "user_id"),
    )
    op.create_index("ix_workspace_members_user_workspace", "workspace_members", ["user_id", "workspace_id"])

    op.create_table(
        "scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scan_type", sa.String(length=32), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("target_name", sa.String(length=255), nullable=False),
        sa.Column("source_config", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("selected_frameworks", postgresql.ARRAY(sa.String(length=64)), server_default=sa.text("'{}'::text[]"), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("progress", sa.Integer(), server_default="0", nullable=False),
        sa.Column("finding_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("framework_scores", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("progress >= 0 AND progress <= 100", name="ck_scans_progress"),
        sa.CheckConstraint("finding_count >= 0", name="ck_scans_finding_count"),
        sa.CheckConstraint(
            "scan_type IN ('codebase', 'architecture', 'logs', 'full')",
            name="ck_scans_scan_type",
        ),
        sa.CheckConstraint(
            "source_type IN ('upload', 'git', 'architecture', 'logs', 'full')",
            name="ck_scans_source_type",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'uploading', 'queued', 'running', 'completed', 'failed', 'cancelled')",
            name="ck_scans_status",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["auth.users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scans_workspace_created", "scans", ["workspace_id", "created_at"])
    op.create_index("ix_scans_workspace_status_created", "scans", ["workspace_id", "status", "created_at"])
    op.create_index("ix_scans_created_by_created", "scans", ["created_by", "created_at"])

    op.create_table(
        "scan_artifacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("bucket", sa.String(length=128), nullable=False),
        sa.Column("object_path", sa.String(length=2048), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("byte_size >= 0", name="ck_scan_artifacts_byte_size"),
        sa.CheckConstraint(
            "kind IN ('source_zip', 'architecture_yaml', 'log_bundle', 'other')",
            name="ck_scan_artifacts_kind",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'uploaded', 'verified', 'processed', 'deleted')",
            name="ck_scan_artifacts_status",
        ),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("bucket", "object_path", name="uq_scan_artifacts_object"),
    )
    op.create_index("ix_scan_artifacts_scan_id", "scan_artifacts", ["scan_id"])

    op.create_table(
        "findings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("cvss_score", sa.Float(), nullable=True),
        sa.Column("cvss_vector", sa.String(length=255), nullable=True),
        sa.Column("cwe_id", sa.String(length=32), nullable=True),
        sa.Column("cve_id", sa.String(length=32), nullable=True),
        sa.Column("file_path", sa.String(length=1024), nullable=True),
        sa.Column("line_number", sa.Integer(), nullable=True),
        sa.Column("code_snippet", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("remediation", sa.Text(), nullable=True),
        sa.Column("fingerprint", sa.String(length=64), nullable=True),
        sa.Column("state", sa.String(length=32), server_default="open", nullable=False),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("severity IN ('critical', 'high', 'medium', 'low')", name="ck_findings_severity"),
        sa.CheckConstraint(
            "state IN ('open', 'accepted_risk', 'resolved', 'false_positive')",
            name="ck_findings_state",
        ),
        sa.ForeignKeyConstraint(["assigned_to"], ["auth.users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scan_id", "fingerprint", name="uq_findings_scan_fingerprint"),
    )
    op.create_index("ix_findings_scan_severity", "findings", ["scan_id", "severity"])
    op.create_index("ix_findings_scan_source", "findings", ["scan_id", "source"])
    op.create_index("ix_findings_state", "findings", ["state"])
    op.create_index("ix_findings_assigned_to", "findings", ["assigned_to"])

    op.create_table(
        "compliance_violations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("finding_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("framework", sa.String(length=64), nullable=False),
        sa.Column("control_id", sa.String(length=64), nullable=False),
        sa.Column("control_title", sa.String(length=255), nullable=False),
        sa.Column("violation_description", sa.Text(), nullable=False),
        sa.Column("evidence", sa.Text(), nullable=False),
        sa.Column("rag_chunk_ids", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.ForeignKeyConstraint(["finding_id"], ["findings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "finding_id",
            "framework",
            "control_id",
            name="uq_compliance_violation_control",
        ),
    )
    op.create_index("ix_compliance_violations_finding_id", "compliance_violations", ["finding_id"])
    op.create_index("ix_compliance_violations_framework", "compliance_violations", ["framework"])

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="queued", nullable=False),
        sa.Column("bucket", sa.String(length=128), nullable=False),
        sa.Column("object_path", sa.String(length=2048), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("byte_size", sa.BigInteger(), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.CheckConstraint("status IN ('queued', 'generating', 'ready', 'failed')", name="ck_reports_status"),
        sa.CheckConstraint("version > 0", name="ck_reports_version"),
        sa.CheckConstraint("byte_size IS NULL OR byte_size >= 0", name="ck_reports_byte_size"),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scan_id", "version", name="uq_reports_scan_version"),
    )
    op.create_index("ix_reports_scan_id", "reports", ["scan_id"])
    op.create_index("ix_reports_status", "reports", ["status"])

    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=True),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["auth.users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_events_workspace_created", "audit_events", ["workspace_id", "created_at"])
    op.create_index("ix_audit_events_actor_user_id", "audit_events", ["actor_user_id"])
    op.create_index("ix_audit_events_event_type", "audit_events", ["event_type"])


def _create_database_security() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'threatlens_backend') THEN
            CREATE ROLE threatlens_backend NOLOGIN;
          END IF;
        END
        $$;
        """,
    )
    op.execute("GRANT USAGE ON SCHEMA public TO threatlens_backend")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO threatlens_backend")

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id uuid)
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = ''
        AS $$
          SELECT EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.workspace_id = target_workspace_id
              AND wm.user_id = auth.uid()
          );
        $$;
        """,
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.has_workspace_role(
          target_workspace_id uuid,
          allowed_roles text[]
        )
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = ''
        AS $$
          SELECT EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.workspace_id = target_workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role = ANY (allowed_roles)
          );
        $$;
        """,
    )
    op.execute("REVOKE ALL ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC")
    op.execute("REVOKE ALL ON FUNCTION public.has_workspace_role(uuid, text[]) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated")
    op.execute("GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, text[]) TO authenticated")

    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY backend_full_access ON public.{table} "
            "FOR ALL TO threatlens_backend USING (true) WITH CHECK (true)",
        )

    op.execute(
        "CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid())",
    )
    op.execute(
        "CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid())",
    )
    op.execute(
        "CREATE POLICY workspaces_select_member ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(id))",
    )
    op.execute(
        "CREATE POLICY workspace_members_select_member ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id))",
    )
    op.execute(
        "CREATE POLICY scans_select_member ON public.scans FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id))",
    )
    op.execute(
        "CREATE POLICY scans_insert_analyst ON public.scans FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.has_workspace_role(workspace_id, ARRAY['owner','admin','analyst']))",
    )
    op.execute(
        "CREATE POLICY scans_update_analyst ON public.scans FOR UPDATE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin','analyst'])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','analyst']))",
    )
    op.execute(
        "CREATE POLICY scans_delete_admin ON public.scans FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']))",
    )

    child_policies = {
        "scan_artifacts": "EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND public.is_workspace_member(s.workspace_id))",
        "findings": "EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND public.is_workspace_member(s.workspace_id))",
        "compliance_violations": "EXISTS (SELECT 1 FROM public.findings f JOIN public.scans s ON s.id = f.scan_id WHERE f.id = finding_id AND public.is_workspace_member(s.workspace_id))",
        "reports": "EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND public.is_workspace_member(s.workspace_id))",
        "audit_events": "public.has_workspace_role(workspace_id, ARRAY['owner','admin'])",
    }
    for table, predicate in child_policies.items():
        op.execute(
            f"CREATE POLICY {table}_select_member ON public.{table} FOR SELECT TO authenticated USING ({predicate})",
        )


def _create_storage_security() -> None:
    op.execute(
        """
        INSERT INTO storage.buckets (id, name, public, file_size_limit)
        VALUES
          ('scan-inputs', 'scan-inputs', false, 52428800),
          ('audit-reports', 'audit-reports', false, 52428800)
        ON CONFLICT (id) DO UPDATE
        SET public = false, file_size_limit = EXCLUDED.file_size_limit;
        """,
    )
    op.execute(
        """
        CREATE POLICY scan_inputs_insert_authorized
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'scan-inputs'
          AND EXISTS (
            SELECT 1
            FROM public.scan_artifacts a
            JOIN public.scans s ON s.id = a.scan_id
            WHERE a.bucket = bucket_id
              AND a.object_path = name
              AND public.has_workspace_role(s.workspace_id, ARRAY['owner','admin','analyst'])
          )
        );
        """,
    )
    op.execute(
        """
        CREATE POLICY scan_inputs_select_authorized
        ON storage.objects FOR SELECT TO authenticated
        USING (
          bucket_id = 'scan-inputs'
          AND EXISTS (
            SELECT 1
            FROM public.scan_artifacts a
            JOIN public.scans s ON s.id = a.scan_id
            WHERE a.bucket = bucket_id
              AND a.object_path = name
              AND public.has_workspace_role(s.workspace_id, ARRAY['owner','admin','analyst'])
          )
        );
        """,
    )
    op.execute(
        """
        CREATE POLICY scan_inputs_update_authorized
        ON storage.objects FOR UPDATE TO authenticated
        USING (
          bucket_id = 'scan-inputs'
          AND EXISTS (
            SELECT 1 FROM public.scan_artifacts a
            JOIN public.scans s ON s.id = a.scan_id
            WHERE a.bucket = bucket_id AND a.object_path = name
              AND public.has_workspace_role(s.workspace_id, ARRAY['owner','admin','analyst'])
          )
        )
        WITH CHECK (
          bucket_id = 'scan-inputs'
          AND EXISTS (
            SELECT 1 FROM public.scan_artifacts a
            JOIN public.scans s ON s.id = a.scan_id
            WHERE a.bucket = bucket_id AND a.object_path = name
              AND public.has_workspace_role(s.workspace_id, ARRAY['owner','admin','analyst'])
          )
        );
        """,
    )
    op.execute(
        """
        CREATE POLICY reports_select_member
        ON storage.objects FOR SELECT TO authenticated
        USING (
          bucket_id = 'audit-reports'
          AND EXISTS (
            SELECT 1
            FROM public.reports r
            JOIN public.scans s ON s.id = r.scan_id
            WHERE r.bucket = bucket_id
              AND r.object_path = name
              AND public.is_workspace_member(s.workspace_id)
          )
        );
        """,
    )


def upgrade() -> None:
    _create_tables()
    _create_database_security()
    _create_storage_security()


def downgrade() -> None:
    for policy in (
        "reports_select_member",
        "scan_inputs_update_authorized",
        "scan_inputs_select_authorized",
        "scan_inputs_insert_authorized",
    ):
        op.execute(f"DROP POLICY IF EXISTS {policy} ON storage.objects")

    op.execute("DELETE FROM storage.buckets WHERE id IN ('scan-inputs', 'audit-reports')")
    op.execute("DROP FUNCTION IF EXISTS public.has_workspace_role(uuid, text[])")
    op.execute("DROP FUNCTION IF EXISTS public.is_workspace_member(uuid)")

    for table in reversed(TENANT_TABLES):
        op.drop_table(table)
