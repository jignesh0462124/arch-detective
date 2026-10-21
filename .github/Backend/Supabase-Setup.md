# ThreatLens — Complete Supabase Setup Guide
# SQL Queries · RLS Policies · Triggers · CLI Instructions

> **Target:** Supabase hosted PostgreSQL + Auth + Storage  
> **Updated:** July 25, 2026  
> **Project:** Arch-Detective / ThreatLens  
> **Authority:** Canonical Supabase implementation — replaces all AWS/S3 references

---

## 📋 Table of Contents

1. [Prerequisites & CLI Setup](#1-prerequisites--supabase-cli-setup)
2. [Project Initialization](#2-project-initialization)
3. [Full Database Schema SQL](#3-full-database-schema-sql)
4. [RLS Policies](#4-row-level-security-rls-policies)
5. [Triggers & Automation](#5-triggers--automation)
6. [Storage Buckets & Policies](#6-storage-buckets--policies)
7. [Helper Functions](#7-helper-functions)
8. [Environment Variables](#8-environment-variables)
9. [Verification Queries](#9-verification-queries)
10. [CLI Execution Instructions](#10-cli-execution-instructions)

---

## 1. Prerequisites & Supabase CLI Setup

### 1.1 Install Supabase CLI (Windows)

**Method A: via Scoop (Recommended)**
```powershell
# Install Scoop first (if not already installed)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Method B: via npm**
```powershell
npm install -g supabase
```

**Method C: Direct Binary (PowerShell)**
```powershell
# Download latest release
$version = "1.200.3"
Invoke-WebRequest -Uri "https://github.com/supabase/cli/releases/download/v$version/supabase_windows_amd64.tar.gz" -OutFile "supabase.tar.gz"
tar -xzf supabase.tar.gz
Move-Item supabase.exe $env:LOCALAPPDATA\Microsoft\WindowsApps\
```

**Verify Installation**
```powershell
supabase --version
# Expected: supabase version 1.x.x
```

---

### 1.2 Install psql (PostgreSQL Client)

```powershell
# Via Scoop
scoop install postgresql

# Verify
psql --version
# Expected: psql (PostgreSQL) 15.x
```

---

## 2. Project Initialization

### 2.1 Login to Supabase Cloud

```powershell
# Navigate to your project root
cd "C:\Users\jigne\OneDrive\Desktop\College Project\arch-detective"

# Login (opens browser)
supabase login
```

### 2.2 Link to Your Supabase Project

```powershell
# Replace YOUR_PROJECT_REF with your Supabase project reference ID
# Found at: https://supabase.com/dashboard → Settings → General → Reference ID
supabase link --project-ref YOUR_PROJECT_REF

# Example:
# supabase link --project-ref abcdefghijklmnop
```

### 2.3 Initialize Local Development (Optional but Recommended)

```powershell
# Start local Supabase stack (Docker required)
supabase start

# This starts:
#  - PostgreSQL on localhost:54322
#  - Supabase Studio on localhost:54323
#  - Auth server on localhost:54321
#  - Storage server on localhost:54321/storage/v1
```

---

## 3. Full Database Schema SQL

> **Execution method:** Paste into Supabase SQL Editor or run via psql.
> **Order matters:** Run sections in sequence 3.1 → 3.2 → 3.3

---

### 3.1 Enable Extensions

```sql
-- ============================================================
-- STEP 1: Enable Required PostgreSQL Extensions
-- Run this first — required for UUID generation
-- ============================================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgcrypto for secure hash functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

### 3.2 Core Application Tables

```sql
-- ============================================================
-- STEP 2: Create Application Tables
-- Order: profiles → workspaces → workspace_members → scans →
--        scan_artifacts → findings → compliance_violations →
--        reports → audit_events
-- ============================================================


-- ------------------------------------------------------------
-- TABLE: profiles
-- Purpose: Public application profile linked to auth.users
-- One profile per authenticated user, auto-created by trigger
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name  VARCHAR(120),
    avatar_url    VARCHAR(2048),
    bio           TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_profiles PRIMARY KEY (id)
);

COMMENT ON TABLE public.profiles IS 'Public profile data for each authenticated user. Linked 1:1 to auth.users.';
COMMENT ON COLUMN public.profiles.id IS 'Mirrors auth.users.id exactly — not a separate UUID.';


-- ------------------------------------------------------------
-- TABLE: workspaces
-- Purpose: Tenant isolation unit. Every scan belongs to a workspace.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
    id             UUID         NOT NULL DEFAULT gen_random_uuid(),
    name           VARCHAR(120) NOT NULL,
    slug           VARCHAR(140) NOT NULL,
    owner_user_id  UUID         NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    plan           VARCHAR(32)  NOT NULL DEFAULT 'free',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_workspaces          PRIMARY KEY (id),
    CONSTRAINT uq_workspaces_slug     UNIQUE (slug),
    CONSTRAINT ck_workspaces_plan     CHECK (plan IN ('free', 'pro', 'enterprise'))
);

CREATE INDEX IF NOT EXISTS ix_workspaces_slug          ON public.workspaces (slug);
CREATE INDEX IF NOT EXISTS ix_workspaces_owner_user_id ON public.workspaces (owner_user_id);

COMMENT ON TABLE public.workspaces IS 'Top-level tenant unit. All business resources are scoped to a workspace.';
COMMENT ON COLUMN public.workspaces.slug IS 'URL-safe lowercase identifier. Auto-generated from name if not provided.';


-- ------------------------------------------------------------
-- TABLE: workspace_members
-- Purpose: Many-to-many between users and workspaces with roles
-- Roles: owner > admin > analyst > viewer
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
    workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role          VARCHAR(16) NOT NULL DEFAULT 'analyst',
    invited_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    status        VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_workspace_members        PRIMARY KEY (workspace_id, user_id),
    CONSTRAINT ck_workspace_members_role   CHECK (role   IN ('owner', 'admin', 'analyst', 'viewer')),
    CONSTRAINT ck_workspace_members_status CHECK (status IN ('active', 'suspended', 'invited'))
);

CREATE INDEX IF NOT EXISTS ix_workspace_members_user_workspace
    ON public.workspace_members (user_id, workspace_id);
CREATE INDEX IF NOT EXISTS ix_workspace_members_workspace_role
    ON public.workspace_members (workspace_id, role);

COMMENT ON TABLE public.workspace_members IS 'Role-based workspace access. FastAPI verifies membership before every resource operation.';


-- ------------------------------------------------------------
-- TABLE: scans
-- Purpose: Core scan record — extended to persist all pipeline state
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scans (
    id                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    workspace_id         UUID         NOT NULL REFERENCES public.workspaces(id)   ON DELETE CASCADE,
    created_by           UUID         NOT NULL REFERENCES auth.users(id)          ON DELETE RESTRICT,

    -- What to scan
    scan_type            VARCHAR(32)  NOT NULL,
    source_type          VARCHAR(32)  NOT NULL,
    target_name          VARCHAR(255) NOT NULL,
    source_config        JSONB        NOT NULL DEFAULT '{}',
    selected_frameworks  TEXT[]       NOT NULL DEFAULT '{}',

    -- Pipeline state
    status               VARCHAR(32)  NOT NULL DEFAULT 'pending',
    progress             INTEGER      NOT NULL DEFAULT 0,
    current_phase        VARCHAR(64),
    finding_count        INTEGER      NOT NULL DEFAULT 0,
    framework_scores     JSONB        NOT NULL DEFAULT '{}',

    -- Worker tracking
    celery_task_id       VARCHAR(255),
    worker_heartbeat_at  TIMESTAMPTZ,
    retry_count          INTEGER      NOT NULL DEFAULT 0,

    -- Failure info (safe for frontend display)
    error_code           VARCHAR(64),
    error_message        TEXT,

    -- Scanner audit trail
    scanner_versions     JSONB        NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    started_at           TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,

    CONSTRAINT pk_scans               PRIMARY KEY (id),
    CONSTRAINT ck_scans_progress      CHECK (progress       BETWEEN 0 AND 100),
    CONSTRAINT ck_scans_finding_count CHECK (finding_count  >= 0),
    CONSTRAINT ck_scans_retry_count   CHECK (retry_count    >= 0),
    CONSTRAINT ck_scans_scan_type     CHECK (scan_type      IN ('codebase', 'architecture', 'logs', 'full')),
    CONSTRAINT ck_scans_source_type   CHECK (source_type    IN ('upload', 'git')),
    CONSTRAINT ck_scans_status        CHECK (status         IN (
        'pending', 'uploading', 'queued', 'running',
        'completed', 'failed', 'cancelled'
    ))
);

CREATE INDEX IF NOT EXISTS ix_scans_workspace_created
    ON public.scans (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_scans_workspace_status
    ON public.scans (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_scans_created_by
    ON public.scans (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_scans_status_active
    ON public.scans (status)
    WHERE status IN ('pending', 'queued', 'running');

COMMENT ON TABLE public.scans IS 'Core scan record. Persists all pipeline state for Celery orchestration.';
COMMENT ON COLUMN public.scans.source_config IS 'JSON blob: git_url, branch, commit_sha for git; artifact object path for uploads.';
COMMENT ON COLUMN public.scans.scanner_versions IS 'Snapshot of tool versions at scan time for audit reproducibility.';


-- ------------------------------------------------------------
-- TABLE: scan_artifacts
-- Purpose: Tracks uploaded files stored in Supabase Storage
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan_artifacts (
    id                UUID         NOT NULL DEFAULT gen_random_uuid(),
    scan_id           UUID         NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    kind              VARCHAR(32)  NOT NULL,
    bucket            VARCHAR(128) NOT NULL,
    object_path       VARCHAR(2048) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type      VARCHAR(255) NOT NULL,
    byte_size         BIGINT       NOT NULL,
    sha256            VARCHAR(64),
    status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_scan_artifacts              PRIMARY KEY (id),
    CONSTRAINT uq_scan_artifacts_object       UNIQUE (bucket, object_path),
    CONSTRAINT ck_scan_artifacts_byte_size    CHECK (byte_size >= 0),
    CONSTRAINT ck_scan_artifacts_kind         CHECK (kind IN (
        'source_zip', 'git_bundle', 'architecture_yaml',
        'architecture_json', 'log_bundle', 'other'
    )),
    CONSTRAINT ck_scan_artifacts_status       CHECK (status IN (
        'pending', 'uploaded', 'verified', 'processed', 'deleted'
    ))
);

CREATE INDEX IF NOT EXISTS ix_scan_artifacts_scan_id ON public.scan_artifacts (scan_id);

COMMENT ON TABLE public.scan_artifacts IS 'Tracks uploaded scan input files in Supabase Storage. Never store public URLs — only bucket+path.';


-- ------------------------------------------------------------
-- TABLE: findings
-- Purpose: Security findings from all scanners, deduplicated
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.findings (
    id                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    scan_id              UUID         NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,

    -- Finding content
    title                VARCHAR(255) NOT NULL,
    description          TEXT         NOT NULL,
    severity             VARCHAR(16)  NOT NULL,
    cvss_score           REAL,
    cvss_vector          VARCHAR(255),
    cwe_id               VARCHAR(32),
    cve_id               VARCHAR(32),

    -- Location in source
    file_path            VARCHAR(1024),
    line_number          INTEGER,
    code_snippet         TEXT,

    -- Scanner metadata
    source               VARCHAR(32)  NOT NULL,
    fingerprint          VARCHAR(64),
    raw_output           JSONB        NOT NULL DEFAULT '{}',

    -- Remediation
    remediation          TEXT,
    remediation_priority VARCHAR(16),

    -- Workflow state
    state                VARCHAR(32)  NOT NULL DEFAULT 'open',
    assigned_to          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at          TIMESTAMPTZ,
    resolution_note      TEXT,

    -- Confidence from LLM/RAG
    confidence_score     REAL,

    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_findings                   PRIMARY KEY (id),
    CONSTRAINT uq_findings_scan_fingerprint  UNIQUE (scan_id, fingerprint),
    CONSTRAINT ck_findings_severity          CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    CONSTRAINT ck_findings_source            CHECK (source   IN ('semgrep', 'bandit', 'trufflehog', 'dep_audit', 'llm', 'log', 'arch')),
    CONSTRAINT ck_findings_state             CHECK (state    IN ('open', 'accepted_risk', 'resolved', 'false_positive')),
    CONSTRAINT ck_findings_priority          CHECK (remediation_priority IS NULL OR remediation_priority IN ('immediate', 'short-term', 'long-term')),
    CONSTRAINT ck_findings_cvss              CHECK (cvss_score IS NULL OR cvss_score BETWEEN 0 AND 10),
    CONSTRAINT ck_findings_confidence        CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS ix_findings_scan_severity ON public.findings (scan_id, severity);
CREATE INDEX IF NOT EXISTS ix_findings_scan_source   ON public.findings (scan_id, source);
CREATE INDEX IF NOT EXISTS ix_findings_scan_state    ON public.findings (scan_id, state);
CREATE INDEX IF NOT EXISTS ix_findings_assigned_to   ON public.findings (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_findings_fingerprint   ON public.findings (fingerprint) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_findings_severity_open ON public.findings (severity, state) WHERE state = 'open';

COMMENT ON TABLE public.findings IS 'Deduplicated security findings from all scanners. fingerprint prevents duplicates per scan.';
COMMENT ON COLUMN public.findings.fingerprint IS 'SHA-256 of (scan_id || file_path || line_number || cwe_id). Prevents duplicate findings.';
COMMENT ON COLUMN public.findings.confidence_score IS 'LLM/RAG confidence: 1.0 = deterministic match, <1.0 = AI-inferred.';


-- ------------------------------------------------------------
-- TABLE: compliance_violations
-- Purpose: Maps findings to specific compliance framework controls
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_violations (
    id                    UUID         NOT NULL DEFAULT gen_random_uuid(),
    finding_id            UUID         NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,

    framework             VARCHAR(64)  NOT NULL,
    control_id            VARCHAR(64)  NOT NULL,
    control_title         VARCHAR(255) NOT NULL,
    violation_description TEXT         NOT NULL,
    evidence              TEXT         NOT NULL,

    -- RAG provenance (for audit reproducibility)
    rag_chunk_ids         JSONB        NOT NULL DEFAULT '[]',
    rag_retrieval_score   REAL,
    embedding_model       VARCHAR(128),
    llm_model             VARCHAR(128),
    prompt_version        VARCHAR(32),

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_compliance_violations        PRIMARY KEY (id),
    CONSTRAINT uq_compliance_violation_control UNIQUE (finding_id, framework, control_id),
    CONSTRAINT ck_compliance_framework         CHECK (framework IN (
        'gdpr', 'soc2', 'iso27001', 'pci_dss', 'nist_csf', 'owasp', 'nvd'
    )),
    CONSTRAINT ck_compliance_rag_score         CHECK (rag_retrieval_score IS NULL OR rag_retrieval_score BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS ix_compliance_violations_finding_id ON public.compliance_violations (finding_id);
CREATE INDEX IF NOT EXISTS ix_compliance_violations_framework  ON public.compliance_violations (framework);
CREATE INDEX IF NOT EXISTS ix_compliance_violations_control    ON public.compliance_violations (framework, control_id);

COMMENT ON TABLE public.compliance_violations IS 'RAG-retrieved + LLM-validated compliance control violations per finding.';
COMMENT ON COLUMN public.compliance_violations.rag_chunk_ids IS 'Qdrant point IDs used in retrieval. Enables report reproducibility.';


-- ------------------------------------------------------------
-- TABLE: reports
-- Purpose: Generated PDF audit reports stored in Supabase Storage
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    id               UUID         NOT NULL DEFAULT gen_random_uuid(),
    scan_id          UUID         NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,

    status           VARCHAR(32)  NOT NULL DEFAULT 'queued',
    bucket           VARCHAR(128) NOT NULL DEFAULT 'audit-reports',
    object_path      VARCHAR(2048),
    sha256           VARCHAR(64),
    byte_size        BIGINT,
    version          INTEGER      NOT NULL DEFAULT 1,
    template_version VARCHAR(32)  NOT NULL DEFAULT 'v1',

    error_message    TEXT,
    generated_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_reports              PRIMARY KEY (id),
    CONSTRAINT uq_reports_scan_version UNIQUE (scan_id, version),
    CONSTRAINT ck_reports_status       CHECK (status IN ('queued', 'generating', 'ready', 'failed')),
    CONSTRAINT ck_reports_version      CHECK (version > 0),
    CONSTRAINT ck_reports_byte_size    CHECK (byte_size IS NULL OR byte_size >= 0)
);

CREATE INDEX IF NOT EXISTS ix_reports_scan_id ON public.reports (scan_id);
CREATE INDEX IF NOT EXISTS ix_reports_status  ON public.reports (status) WHERE status IN ('queued', 'generating');

COMMENT ON TABLE public.reports IS 'Metadata for generated PDF audit reports. Never store signed URLs — generate them on demand.';
COMMENT ON COLUMN public.reports.object_path IS 'Supabase Storage path: audit-reports/{workspace_id}/{scan_id}/{report_id}.pdf';


-- ------------------------------------------------------------
-- TABLE: audit_events
-- Purpose: Append-only security audit log for compliance evidence
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    workspace_id  UUID         NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor_user_id UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type    VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64),
    resource_id   UUID,
    ip_address    INET,
    user_agent    TEXT,
    metadata      JSONB        NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_audit_events PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_audit_events_workspace_created ON public.audit_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_events_actor_user_id     ON public.audit_events (actor_user_id) WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_audit_events_event_type        ON public.audit_events (event_type);
CREATE INDEX IF NOT EXISTS ix_audit_events_resource          ON public.audit_events (resource_type, resource_id) WHERE resource_type IS NOT NULL;

COMMENT ON TABLE public.audit_events IS 'Append-only audit log. Never DELETE or UPDATE rows. Used for compliance evidence.';
```

---

## 4. Row Level Security (RLS) Policies

> **Run AFTER tables are created.** RLS blocks all access by default once enabled.

### 4.1 Enable RLS on All Tables

```sql
-- ============================================================
-- STEP 3: Enable Row Level Security
-- ============================================================

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_artifacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events          ENABLE ROW LEVEL SECURITY;
```

---

### 4.2 Helper Security Functions

```sql
-- ============================================================
-- STEP 4: Security Helper Functions
-- SECURITY DEFINER = runs as function owner, not caller
-- SET search_path = '' prevents search_path injection attacks
-- ============================================================

-- Check if the current user is an active member of a workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND wm.user_id      = auth.uid()
          AND wm.status       = 'active'
    );
$$;

-- Check if the current user has one of the allowed roles
CREATE OR REPLACE FUNCTION public.has_workspace_role(
    target_workspace_id UUID,
    allowed_roles       TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND wm.user_id      = auth.uid()
          AND wm.role         = ANY(allowed_roles)
          AND wm.status       = 'active'
    );
$$;

-- Revoke public access
REVOKE ALL ON FUNCTION public.is_workspace_member(UUID)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_workspace_role(UUID, TEXT[]) FROM PUBLIC;

-- Grant only to authenticated users
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(UUID, TEXT[]) TO authenticated;
```

---

### 4.3 Backend Service Role Full Access

```sql
-- ============================================================
-- STEP 5: Backend Role Policies
-- FastAPI + Celery use service_role which bypasses RLS.
-- These policies are safety nets for direct DB connections.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'threatlens_backend') THEN
        CREATE ROLE threatlens_backend NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO threatlens_backend;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO threatlens_backend;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO threatlens_backend;

CREATE POLICY backend_full_access_profiles
    ON public.profiles FOR ALL TO threatlens_backend USING (true) WITH CHECK (true);

CREATE POLICY backend_full_access_workspaces
    ON public.workspaces FOR ALL TO threatlens_backend USING (true) WITH CHECK (true);

CREATE POLICY backend_full_access_workspace_members
    ON public.workspace_members FOR ALL TO threatlens_backend USING (true) WITH CHECK (true);

CREATE POLICY backend_full_access_scans
    ON public.scans FOR ALL TO threatlens_backend USING (true) WITH CHECK (true);

CREATE POLICY backend_full_access_scan_artifacts
    ON public.scan_artifacts FOR ALL TO threatlens_backend USING (true) WITH CHECK (true);

CREATE POLICY backend_full_access_findings
    ON public.findings FOR ALL TO threatlens_backend USING (true) WITH CHECK (true);

CREATE POLICY backend_full_access_compliance_violations
    ON public.compliance_violations FOR ALL TO threatlens_backend USING (true) WITH CHECK (true);

CREATE POLICY backend_full_access_reports
    ON public.reports FOR ALL TO threatlens_backend USING (true) WITH CHECK (true);

CREATE POLICY backend_full_access_audit_events
    ON public.audit_events FOR ALL TO threatlens_backend USING (true) WITH CHECK (true);
```

---

### 4.4 Profiles Policies

```sql
-- Users can read and update only their own profile
CREATE POLICY profiles_select_own
    ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY profiles_update_own
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
```

---

### 4.5 Workspaces Policies

```sql
-- Members can view workspaces they belong to
CREATE POLICY workspaces_select_member
    ON public.workspaces FOR SELECT TO authenticated
    USING (public.is_workspace_member(id));

-- Any authenticated user can create a workspace
CREATE POLICY workspaces_insert_authenticated
    ON public.workspaces FOR INSERT TO authenticated
    WITH CHECK (owner_user_id = auth.uid());

-- Only admins and owners can update workspace settings
CREATE POLICY workspaces_update_admin
    ON public.workspaces FOR UPDATE TO authenticated
    USING  (public.has_workspace_role(id, ARRAY['owner', 'admin']))
    WITH CHECK (public.has_workspace_role(id, ARRAY['owner', 'admin']));

-- Only owners can delete a workspace
CREATE POLICY workspaces_delete_owner
    ON public.workspaces FOR DELETE TO authenticated
    USING (public.has_workspace_role(id, ARRAY['owner']));
```

---

### 4.6 Workspace Members Policies

```sql
-- All workspace members can see the member list
CREATE POLICY workspace_members_select_member
    ON public.workspace_members FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

-- Owners and admins can add members
CREATE POLICY workspace_members_insert_admin
    ON public.workspace_members FOR INSERT TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

-- Admins can change roles; users can update own status
CREATE POLICY workspace_members_update_admin
    ON public.workspace_members FOR UPDATE TO authenticated
    USING (
        public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
        OR user_id = auth.uid()
    );

-- Admins remove members; users can remove themselves
CREATE POLICY workspace_members_delete_admin
    ON public.workspace_members FOR DELETE TO authenticated
    USING (
        public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
        OR user_id = auth.uid()
    );
```

---

### 4.7 Scans Policies

```sql
-- All workspace members can view scans
CREATE POLICY scans_select_member
    ON public.scans FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

-- Analysts, admins, and owners can create scans
CREATE POLICY scans_insert_analyst
    ON public.scans FOR INSERT TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'analyst'])
    );

-- Analysts+ can update scans (cancel, etc.)
CREATE POLICY scans_update_analyst
    ON public.scans FOR UPDATE TO authenticated
    USING  (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'analyst']))
    WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'analyst']));

-- Only admins and owners can delete scans
CREATE POLICY scans_delete_admin
    ON public.scans FOR DELETE TO authenticated
    USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));
```

---

### 4.8 Scan Artifacts Policies

```sql
CREATE POLICY scan_artifacts_select_member
    ON public.scan_artifacts FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scans s
            WHERE s.id = scan_id
              AND public.is_workspace_member(s.workspace_id)
        )
    );

CREATE POLICY scan_artifacts_insert_analyst
    ON public.scan_artifacts FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.scans s
            WHERE s.id = scan_id
              AND public.has_workspace_role(s.workspace_id, ARRAY['owner','admin','analyst'])
        )
    );

CREATE POLICY scan_artifacts_delete_admin
    ON public.scan_artifacts FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scans s
            WHERE s.id = scan_id
              AND public.has_workspace_role(s.workspace_id, ARRAY['owner','admin'])
        )
    );
```

---

### 4.9 Findings Policies

```sql
CREATE POLICY findings_select_member
    ON public.findings FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scans s
            WHERE s.id = scan_id
              AND public.is_workspace_member(s.workspace_id)
        )
    );

CREATE POLICY findings_insert_analyst
    ON public.findings FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.scans s
            WHERE s.id = scan_id
              AND public.has_workspace_role(s.workspace_id, ARRAY['owner','admin','analyst'])
        )
    );

-- Analysts can update finding state (mark false positive, accept risk)
CREATE POLICY findings_update_analyst
    ON public.findings FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scans s
            WHERE s.id = scan_id
              AND public.has_workspace_role(s.workspace_id, ARRAY['owner','admin','analyst'])
        )
    );

CREATE POLICY findings_delete_admin
    ON public.findings FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scans s
            WHERE s.id = scan_id
              AND public.has_workspace_role(s.workspace_id, ARRAY['owner','admin'])
        )
    );
```

---

### 4.10 Compliance Violations Policies

```sql
CREATE POLICY compliance_violations_select_member
    ON public.compliance_violations FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM   public.findings f
            JOIN   public.scans   s ON s.id = f.scan_id
            WHERE  f.id = finding_id
              AND  public.is_workspace_member(s.workspace_id)
        )
    );
-- Backend (service_role) writes all compliance violations — no INSERT for auth users
```

---

### 4.11 Reports Policies

```sql
CREATE POLICY reports_select_member
    ON public.reports FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scans s
            WHERE s.id = scan_id
              AND public.is_workspace_member(s.workspace_id)
        )
    );

CREATE POLICY reports_insert_analyst
    ON public.reports FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.scans s
            WHERE s.id = scan_id
              AND public.has_workspace_role(s.workspace_id, ARRAY['owner','admin','analyst'])
        )
    );

CREATE POLICY reports_delete_admin
    ON public.reports FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scans s
            WHERE s.id = scan_id
              AND public.has_workspace_role(s.workspace_id, ARRAY['owner','admin'])
        )
    );
```

---

### 4.12 Audit Events Policies

```sql
-- Only owners and admins can read the audit log
CREATE POLICY audit_events_select_admin
    ON public.audit_events FOR SELECT TO authenticated
    USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

-- Backend uses service_role to insert — no INSERT policy for authenticated users
-- No UPDATE or DELETE policies — audit log is append-only
```

---

## 5. Triggers & Automation

### 5.1 Auto-Create Profile on Signup

```sql
-- ============================================================
-- TRIGGER: Auto-create profile when a new user signs up
-- Fires AFTER INSERT on auth.users
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'display_name',
            NEW.raw_user_meta_data ->> 'full_name',
            split_part(NEW.email, '@', 1)
        ),
        NEW.raw_user_meta_data ->> 'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
    'Auto-creates a public.profiles row when a user signs up via Supabase Auth.';
```

---

### 5.2 Auto-Create Default Workspace on Profile Creation

```sql
-- ============================================================
-- TRIGGER: Auto-create a personal workspace after profile is created
-- Fires AFTER INSERT on public.profiles
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_workspace_id UUID;
    v_slug         TEXT;
    v_base_slug    TEXT;
    v_counter      INTEGER := 0;
BEGIN
    -- Generate URL-safe slug from display_name
    v_base_slug := lower(regexp_replace(
        COALESCE(NEW.display_name, 'workspace'),
        '[^a-z0-9]+', '-', 'g'
    ));
    v_base_slug := trim(both '-' from v_base_slug);
    v_slug      := v_base_slug;

    -- Ensure slug uniqueness
    WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = v_slug) LOOP
        v_counter := v_counter + 1;
        v_slug    := v_base_slug || '-' || v_counter::text;
    END LOOP;

    -- Create the personal workspace
    INSERT INTO public.workspaces (name, slug, owner_user_id)
    VALUES (
        COALESCE(NEW.display_name, 'My') || '''s Workspace',
        v_slug,
        NEW.id
    )
    RETURNING id INTO v_workspace_id;

    -- Add the user as owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_profile();
```

---

### 5.3 Auto-Update `updated_at` Timestamp

```sql
-- ============================================================
-- TRIGGER: Automatically update updated_at on every row UPDATE
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER set_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_findings_updated_at ON public.findings;
CREATE TRIGGER set_findings_updated_at
    BEFORE UPDATE ON public.findings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

### 5.4 Auto-Increment Scan Finding Counter

```sql
-- ============================================================
-- TRIGGER: Keep scans.finding_count in sync automatically
-- Fires AFTER INSERT/DELETE on findings
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_scan_finding_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.scans
        SET finding_count = finding_count + 1
        WHERE id = NEW.scan_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.scans
        SET finding_count = GREATEST(finding_count - 1, 0)
        WHERE id = OLD.scan_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_finding_count_on_insert ON public.findings;
CREATE TRIGGER sync_finding_count_on_insert
    AFTER INSERT ON public.findings
    FOR EACH ROW EXECUTE FUNCTION public.sync_scan_finding_count();

DROP TRIGGER IF EXISTS sync_finding_count_on_delete ON public.findings;
CREATE TRIGGER sync_finding_count_on_delete
    AFTER DELETE ON public.findings
    FOR EACH ROW EXECUTE FUNCTION public.sync_scan_finding_count();
```

---

### 5.5 Audit Log — Scan Status Changes

```sql
-- ============================================================
-- TRIGGER: Append audit event when scan status changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_scan_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.audit_events (
            workspace_id, actor_user_id, event_type,
            resource_type, resource_id, metadata
        ) VALUES (
            NEW.workspace_id,
            auth.uid(),
            'scan.status_changed',
            'scan',
            NEW.id,
            jsonb_build_object(
                'old_status',    OLD.status,
                'new_status',    NEW.status,
                'scan_type',     NEW.scan_type,
                'finding_count', NEW.finding_count,
                'progress',      NEW.progress
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_scan_status ON public.scans;
CREATE TRIGGER audit_scan_status
    AFTER UPDATE ON public.scans
    FOR EACH ROW EXECUTE FUNCTION public.audit_scan_status_change();
```

---

### 5.6 Audit Log — Finding State Changes

```sql
-- ============================================================
-- TRIGGER: Append audit event when a finding state changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_finding_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_workspace_id UUID;
BEGIN
    IF OLD.state IS DISTINCT FROM NEW.state THEN
        SELECT s.workspace_id INTO v_workspace_id
        FROM public.scans s WHERE s.id = NEW.scan_id;

        INSERT INTO public.audit_events (
            workspace_id, actor_user_id, event_type,
            resource_type, resource_id, metadata
        ) VALUES (
            v_workspace_id,
            auth.uid(),
            'finding.state_changed',
            'finding',
            NEW.id,
            jsonb_build_object(
                'old_state', OLD.state,
                'new_state', NEW.state,
                'severity',  NEW.severity,
                'title',     NEW.title
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_finding_state ON public.findings;
CREATE TRIGGER audit_finding_state
    AFTER UPDATE ON public.findings
    FOR EACH ROW EXECUTE FUNCTION public.audit_finding_state_change();
```

---

### 5.7 Workspace Slug Auto-Generation

```sql
-- ============================================================
-- TRIGGER: Auto-generate slug from name on INSERT if not provided
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_workspace_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_base_slug TEXT;
    v_slug      TEXT;
    v_counter   INTEGER := 0;
BEGIN
    IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
        v_base_slug := lower(regexp_replace(NEW.name, '[^a-z0-9]+', '-', 'g'));
        v_base_slug := trim(both '-' from v_base_slug);
        v_slug      := v_base_slug;

        WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = v_slug) LOOP
            v_counter := v_counter + 1;
            v_slug    := v_base_slug || '-' || v_counter::text;
        END LOOP;

        NEW.slug := v_slug;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generate_slug_before_insert ON public.workspaces;
CREATE TRIGGER generate_slug_before_insert
    BEFORE INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.generate_workspace_slug();
```

---

## 6. Storage Buckets & Policies

### 6.1 Create Private Buckets

```sql
-- ============================================================
-- STEP 6: Supabase Storage — Create Private Buckets
-- ============================================================

-- Scan input files — 50MB max
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'scan-inputs',
    'scan-inputs',
    false,
    52428800,
    ARRAY[
        'application/zip', 'application/x-zip-compressed',
        'application/octet-stream', 'text/yaml', 'application/yaml',
        'application/json', 'text/plain', 'text/x-log'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Generated PDF audit reports — 50MB max
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'audit-reports',
    'audit-reports',
    false,
    52428800,
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = EXCLUDED.file_size_limit;
```

---

### 6.2 Storage Policies — scan-inputs

```sql
-- ============================================================
-- Storage Policies: scan-inputs bucket
-- Path convention: scan-inputs/{workspace_id}/{scan_id}/filename
-- ============================================================

CREATE POLICY scan_inputs_insert_analyst
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'scan-inputs'
    AND EXISTS (
        SELECT 1
        FROM   public.scan_artifacts a
        JOIN   public.scans          s ON s.id = a.scan_id
        WHERE  a.bucket      = bucket_id
          AND  a.object_path = name
          AND  public.has_workspace_role(s.workspace_id, ARRAY['owner','admin','analyst'])
    )
);

CREATE POLICY scan_inputs_select_member
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'scan-inputs'
    AND EXISTS (
        SELECT 1
        FROM   public.scan_artifacts a
        JOIN   public.scans          s ON s.id = a.scan_id
        WHERE  a.bucket      = bucket_id
          AND  a.object_path = name
          AND  public.is_workspace_member(s.workspace_id)
    )
);

CREATE POLICY scan_inputs_delete_admin
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'scan-inputs'
    AND EXISTS (
        SELECT 1
        FROM   public.scan_artifacts a
        JOIN   public.scans          s ON s.id = a.scan_id
        WHERE  a.bucket      = bucket_id
          AND  a.object_path = name
          AND  public.has_workspace_role(s.workspace_id, ARRAY['owner','admin'])
    )
);
```

---

### 6.3 Storage Policies — audit-reports

```sql
-- ============================================================
-- Storage Policies: audit-reports bucket
-- ============================================================

-- Members can view reports (backend generates signed URL after this check)
CREATE POLICY audit_reports_select_member
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'audit-reports'
    AND EXISTS (
        SELECT 1
        FROM   public.reports r
        JOIN   public.scans   s ON s.id = r.scan_id
        WHERE  r.bucket      = bucket_id
          AND  r.object_path = name
          AND  public.is_workspace_member(s.workspace_id)
    )
);

-- Admins can delete old reports
CREATE POLICY audit_reports_delete_admin
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'audit-reports'
    AND EXISTS (
        SELECT 1
        FROM   public.reports r
        JOIN   public.scans   s ON s.id = r.scan_id
        WHERE  r.bucket      = bucket_id
          AND  r.object_path = name
          AND  public.has_workspace_role(s.workspace_id, ARRAY['owner','admin'])
    )
);
-- Backend (service_role) uploads reports — no INSERT for authenticated users
```

---

## 7. Helper Functions

### 7.1 Workspace Summary Statistics

```sql
CREATE OR REPLACE FUNCTION public.get_workspace_summary(p_workspace_id UUID)
RETURNS TABLE (
    total_scans       BIGINT,
    completed_scans   BIGINT,
    running_scans     BIGINT,
    total_findings    BIGINT,
    critical_findings BIGINT,
    high_findings     BIGINT,
    open_findings     BIGINT,
    last_scan_at      TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        COUNT(DISTINCT s.id)                                                          AS total_scans,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'completed')                   AS completed_scans,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'running')                     AS running_scans,
        COALESCE(SUM(s.finding_count), 0)                                            AS total_findings,
        COUNT(f.id) FILTER (WHERE f.severity = 'critical' AND f.state = 'open')      AS critical_findings,
        COUNT(f.id) FILTER (WHERE f.severity = 'high'     AND f.state = 'open')      AS high_findings,
        COUNT(f.id) FILTER (WHERE f.state = 'open')                                  AS open_findings,
        MAX(s.created_at)                                                             AS last_scan_at
    FROM   public.scans    s
    LEFT JOIN public.findings f ON f.scan_id = s.id
    WHERE  s.workspace_id = p_workspace_id
      AND  public.is_workspace_member(p_workspace_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_summary(UUID) TO authenticated;
```

---

### 7.2 Per-Scan Compliance Scores

```sql
CREATE OR REPLACE FUNCTION public.get_scan_compliance_scores(p_scan_id UUID)
RETURNS TABLE (
    framework       TEXT,
    violation_count BIGINT,
    severity_score  NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        cv.framework,
        COUNT(DISTINCT cv.id)  AS violation_count,
        ROUND(
            SUM(
                CASE f.severity
                    WHEN 'critical' THEN 4.0
                    WHEN 'high'     THEN 3.0
                    WHEN 'medium'   THEN 2.0
                    WHEN 'low'      THEN 1.0
                    ELSE 0.0
                END
            )::NUMERIC, 2
        ) AS severity_score
    FROM   public.compliance_violations cv
    JOIN   public.findings              f  ON f.id  = cv.finding_id
    JOIN   public.scans                 s  ON s.id  = f.scan_id
    WHERE  f.scan_id = p_scan_id
      AND  public.is_workspace_member(s.workspace_id)
    GROUP  BY cv.framework
    ORDER  BY violation_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_scan_compliance_scores(UUID) TO authenticated;
```

---

## 8. Environment Variables

### 8.1 Frontend `.env` (arch-detective root)

```env
# Supabase — safe to expose via VITE_ prefix (browser bundle)
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend API
VITE_API_URL=http://localhost:8000
```

### 8.2 Backend `.env` (threatlens/ directory)

```env
ENVIRONMENT=development
DEBUG=true

# Supabase PostgreSQL — use Supavisor for IPv4 deployments
DATABASE_URL=postgresql+asyncpg://postgres.YOUR_REF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?ssl=require
MIGRATION_DATABASE_URL=postgresql+asyncpg://postgres.YOUR_REF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?ssl=require
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=5

# Supabase Auth and Storage
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_JWKS_URL=https://YOUR_PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_ISSUER=https://YOUR_PROJECT_REF.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_JWT_ALGORITHMS=RS256,ES256
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...YOUR_SERVICE_ROLE
SUPABASE_SCAN_BUCKET=scan-inputs
SUPABASE_REPORT_BUCKET=audit-reports
SIGNED_URL_TTL_SECONDS=300
SOURCE_RETENTION_HOURS=24

# Redis / Celery
REDIS_URL=redis://redis:6379/0

# Qdrant (remains separate)
QDRANT_URL=http://qdrant:6333
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_COLLECTION=compliance_knowledge

# AI
GROQ_API_KEY=REPLACE_ME_AFTER_ROTATING
GROQ_MODEL=llama-3.1-70b-versatile

# File limits
MAX_FILE_SIZE_MB=50
GIT_CLONE_TIMEOUT_SECONDS=120
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080
```

> ⚠️ **NEVER** prefix backend vars with `VITE_` — Vite exposes them to the browser bundle.

---

## 9. Verification Queries

Run these after executing the schema to confirm correct setup:

```sql
-- Confirm all 9 tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
      'profiles','workspaces','workspace_members','scans',
      'scan_artifacts','findings','compliance_violations','reports','audit_events'
  )
ORDER BY table_name;
-- Expected: 9 rows

-- Confirm RLS is enabled on all tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
-- Expected: all rowsecurity = true

-- Count all RLS policies
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Expected: 25+

-- Confirm triggers exist
SELECT trigger_name, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_schema IN ('public','auth')
ORDER BY event_object_table, trigger_name;
-- Expected: 7+ triggers

-- Confirm storage buckets
SELECT id, name, public, file_size_limit FROM storage.buckets
WHERE id IN ('scan-inputs','audit-reports');
-- Expected: 2 rows, both public = false

-- End-to-end auth flow check (after signing up a test user)
SELECT p.id, p.display_name, w.name AS workspace, wm.role
FROM public.profiles p
JOIN public.workspace_members wm ON wm.user_id = p.id
JOIN public.workspaces w         ON w.id = wm.workspace_id
ORDER BY p.created_at DESC LIMIT 3;
-- Expected: user has a workspace auto-created with role='owner'
```

---

## 10. CLI Execution Instructions

### 10.1 Login and Link Project

```powershell
# 1. Navigate to project root
cd "C:\Users\jigne\OneDrive\Desktop\College Project\arch-detective"

# 2. Login to Supabase
supabase login

# 3. Link to your remote project
#    Get YOUR_PROJECT_REF from: Dashboard → Settings → General
supabase link --project-ref YOUR_PROJECT_REF

# 4. Verify link
supabase status
```

### 10.2 Apply Schema via SQL Editor (Browser — Easiest)

```
1. Go to: https://supabase.com/dashboard → Your Project → SQL Editor
2. Click: New Query
3. Paste: Section 3.1 (extensions) → Run
4. Paste: Section 3.2 (tables) → Run
5. Paste: Section 4.1 (enable RLS) → Run
6. Paste: Section 4.2 (helper functions) → Run
7. Paste: Section 4.3 (backend policies) → Run
8. Paste: Sections 4.4–4.12 (all table policies) → Run
9. Paste: Sections 5.1–5.7 (all triggers) → Run
10. Paste: Section 6.1 (storage buckets) → Run
11. Paste: Sections 6.2–6.3 (storage policies) → Run
12. Paste: Sections 7.1–7.2 (helper functions) → Run
13. Paste: Section 9 (verification queries) → Run and confirm output
```

### 10.3 Apply Schema via psql (Terminal)

```powershell
# Get connection string from:
# Dashboard → Settings → Database → Connection string → URI

$DB_URL = "postgresql://postgres.YOUR_REF:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

# Save all SQL blocks from this file into a single schema.sql file, then:
psql $DB_URL -f ".\supabase\schema.sql"

# Or run individual blocks:
psql $DB_URL -c "CREATE EXTENSION IF NOT EXISTS 'uuid-ossp';"
```

### 10.4 Apply via Alembic (Python — Recommended for Backend)

```powershell
cd "C:\Users\jigne\OneDrive\Desktop\College Project\arch-detective\threatlens"

# Activate virtual environment
.venv\Scripts\Activate.ps1

# Run migration (point MIGRATION_DATABASE_URL to Supabase)
python -m alembic upgrade head

# Verify
python -m alembic current
python -m alembic history --verbose
```

### 10.5 Generate TypeScript Types from Schema

```powershell
# After schema is applied, generate typed interfaces for your frontend:
supabase gen types typescript --linked --schema public > src/lib/database.types.ts

# This creates types like:
# Database['public']['Tables']['scans']['Row']
# Database['public']['Tables']['findings']['Insert']
```

### 10.6 Useful Supabase CLI Commands

```powershell
# Start local development stack (requires Docker)
supabase start
# Opens Studio at: http://localhost:54323

# Check project status
supabase status

# Pull remote schema to local migration files
supabase db pull

# Push local migrations to remote project
supabase db push

# Run any SQL against the linked remote project
supabase db execute --linked --command "SELECT COUNT(*) FROM public.profiles;"

# View logs
supabase logs --service db
supabase logs --service auth
supabase logs --service storage

# Reset local database (WARNING: destroys local data)
supabase db reset

# Stop local stack
supabase stop
```

### 10.7 Verify RLS via CLI

```powershell
# Check RLS status on all tables
supabase db execute --linked --command "
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
"

# List all active policies
supabase db execute --linked --command "
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public' ORDER BY tablename, policyname;
"

# Check triggers
supabase db execute --linked --command "
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema IN ('public','auth')
ORDER BY trigger_name;
"

# Check storage buckets
supabase db execute --linked --command "
SELECT id, name, public, file_size_limit FROM storage.buckets;
"
```

---

## 📚 Final Checklist

| # | Check | Expected Result |
|---|-------|----------------|
| 1 | Tables created | 9 tables in `public` schema |
| 2 | RLS enabled | All 9 tables `rowsecurity = true` |
| 3 | Policies active | 25+ policies in `pg_policies` |
| 4 | Triggers exist | 7+ triggers including `on_auth_user_created` |
| 5 | Storage buckets | `scan-inputs` and `audit-reports` with `public = false` |
| 6 | Helper functions | `is_workspace_member`, `has_workspace_role`, `get_workspace_summary` |
| 7 | Auth trigger works | Sign up user → profile auto-created |
| 8 | Workspace trigger | Profile created → workspace + owner membership auto-created |
| 9 | Cross-tenant blocked | User A cannot SELECT scans from User B's workspace |
| 10 | TypeScript types | `supabase gen types typescript` succeeds without errors |

---

*ThreatLens Supabase Setup Guide v1.0 | July 25, 2026*
