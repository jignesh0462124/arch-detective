-- ====================================================
-- ARCH-DETECTIVE / THREATLENS - COMPLETE SCHEMA
-- Migration: 20261003000001_initial_schema
-- Applied to Supabase: 2026-10-03
-- ====================================================
-- This file documents the schema applied via MCP execute_sql.
-- Re-run on a fresh project to recreate the full schema.
-- ====================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. ENUMS
do $$ begin create type public.workspace_role as enum ('owner','admin','analyst','viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.scan_status as enum ('pending','uploading','queued','running','completed','failed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.scan_type as enum ('codebase','architecture','logs','full'); exception when duplicate_object then null; end $$;
do $$ begin create type public.source_type as enum ('upload','git','architecture','logs','full'); exception when duplicate_object then null; end $$;
do $$ begin create type public.severity as enum ('critical','high','medium','low'); exception when duplicate_object then null; end $$;
do $$ begin create type public.finding_state as enum ('open','accepted_risk','resolved','false_positive'); exception when duplicate_object then null; end $$;
do $$ begin create type public.finding_source as enum ('semgrep','bandit','trufflehog','pip-audit','npm-audit','log-anomaly','llm-review','architecture'); exception when duplicate_object then null; end $$;
do $$ begin create type public.report_status as enum ('queued','generating','ready','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.remediation_priority as enum ('immediate','short-term','long-term'); exception when duplicate_object then null; end $$;

-- 3. UTILITY: set_updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- 4. PROFILES
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using ( (select auth.uid()) = id );
create policy "profiles_update_own" on public.profiles for update to authenticated using ( (select auth.uid()) = id ) with check ( (select auth.uid()) = id );
create or replace trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_app_meta_data->>'display_name', new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;
create or replace trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 5. WORKSPACES
create table if not exists public.workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint workspaces_name_length check (char_length(name) between 1 and 120),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$')
);
create index if not exists workspaces_owner_idx on public.workspaces(owner_user_id);
alter table public.workspaces enable row level security;
create or replace trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();

-- 6. WORKSPACE MEMBERS
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.workspace_role not null default 'viewer',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
alter table public.workspace_members enable row level security;
create or replace trigger workspace_members_set_updated_at before update on public.workspace_members for each row execute function public.set_updated_at();

-- Auto-add owner as member
create or replace function public.handle_workspace_created()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role) values (new.id, new.owner_user_id, 'owner') on conflict do nothing;
  return new;
end; $$;
create or replace trigger workspace_created_add_owner after insert on public.workspaces for each row execute function public.handle_workspace_created();

-- 7. WORKSPACE INVITES
create table if not exists public.workspace_invites (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  invited_email  text not null,
  role           public.workspace_role not null default 'viewer',
  invited_by     uuid references auth.users(id) on delete set null,
  token          text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at     timestamptz not null default (now() + interval '7 days'),
  created_at     timestamptz not null default now()
);
create index if not exists workspace_invites_workspace_idx on public.workspace_invites(workspace_id);
create index if not exists workspace_invites_email_idx on public.workspace_invites(invited_email);
alter table public.workspace_invites enable row level security;

-- 8. SCANS
create table if not exists public.scans (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  created_by           uuid references auth.users(id) on delete set null,
  scan_type            public.scan_type not null default 'codebase',
  source_type          public.source_type not null default 'upload',
  target_name          text not null,
  selected_frameworks  text[] not null default '{}',
  status               public.scan_status not null default 'pending',
  progress             integer not null default 0 check (progress between 0 and 100),
  finding_count        integer not null default 0 check (finding_count >= 0),
  framework_scores     jsonb not null default '{}',
  error_code           text,
  error_message        text,
  git_url              text,
  artifact_bucket      text,
  artifact_path        text,
  created_at           timestamptz not null default now(),
  started_at           timestamptz,
  completed_at         timestamptz
);
create index if not exists scans_workspace_idx  on public.scans(workspace_id);
create index if not exists scans_created_by_idx on public.scans(created_by);
create index if not exists scans_status_idx     on public.scans(status);
create index if not exists scans_created_at_idx on public.scans(created_at desc);
alter table public.scans enable row level security;

-- 9. FINDINGS
create table if not exists public.findings (
  id                   uuid primary key default gen_random_uuid(),
  scan_id              uuid not null references public.scans(id) on delete cascade,
  title                text not null,
  description          text not null default '',
  severity             public.severity not null,
  cvss_score           numeric(4,1) check (cvss_score between 0.0 and 10.0),
  cvss_vector          text,
  cwe_id               text,
  cve_id               text,
  file_path            text,
  line_number          integer check (line_number > 0),
  code_snippet         text,
  source               public.finding_source not null,
  remediation          text,
  remediation_steps    text[],
  remediation_priority public.remediation_priority,
  fingerprint          text,
  state                public.finding_state not null default 'open',
  assigned_to          uuid references auth.users(id) on delete set null,
  state_note           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists findings_scan_idx        on public.findings(scan_id);
create index if not exists findings_severity_idx    on public.findings(severity);
create index if not exists findings_state_idx       on public.findings(state);
create index if not exists findings_source_idx      on public.findings(source);
create index if not exists findings_fingerprint_idx on public.findings(fingerprint) where fingerprint is not null;
alter table public.findings enable row level security;
create or replace trigger findings_set_updated_at before update on public.findings for each row execute function public.set_updated_at();

-- 10. COMPLIANCE VIOLATIONS
create table if not exists public.compliance_violations (
  id                    uuid primary key default gen_random_uuid(),
  finding_id            uuid not null references public.findings(id) on delete cascade,
  framework             text not null,
  control_id            text not null,
  control_title         text not null,
  violation_description text not null default '',
  evidence              text not null default '',
  rag_chunk_ids         text[] not null default '{}',
  created_at            timestamptz not null default now()
);
create index if not exists compliance_violations_finding_idx   on public.compliance_violations(finding_id);
create index if not exists compliance_violations_framework_idx on public.compliance_violations(framework);
alter table public.compliance_violations enable row level security;

-- 11. REPORTS
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  scan_id       uuid not null references public.scans(id) on delete cascade,
  status        public.report_status not null default 'queued',
  bucket        text not null default 'reports',
  object_path   text not null default '',
  sha256        text,
  byte_size     bigint check (byte_size >= 0),
  version       integer not null default 1 check (version >= 1),
  generated_at  timestamptz,
  error_message text,
  created_at    timestamptz not null default now()
);
create index if not exists reports_scan_idx   on public.reports(scan_id);
create index if not exists reports_status_idx on public.reports(status);
alter table public.reports enable row level security;

-- 12. AUDIT EVENTS
create table if not exists public.audit_events (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id  uuid references auth.users(id) on delete set null,
  event_type     text not null,
  resource_type  text,
  resource_id    uuid,
  event_metadata jsonb not null default '{}',
  created_at     timestamptz not null default now()
);
create index if not exists audit_events_workspace_idx  on public.audit_events(workspace_id, created_at desc);
create index if not exists audit_events_actor_idx      on public.audit_events(actor_user_id);
create index if not exists audit_events_event_type_idx on public.audit_events(event_type);
create index if not exists audit_events_resource_idx   on public.audit_events(resource_type, resource_id);
alter table public.audit_events enable row level security;

-- 13. RLS HELPER FUNCTIONS
create or replace function public.is_workspace_member(p_workspace_id uuid) returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = (select auth.uid()));
$$;

create or replace function public.workspace_user_role(p_workspace_id uuid) returns public.workspace_role language sql stable security invoker set search_path = public as $$
  select role from public.workspace_members where workspace_id = p_workspace_id and user_id = (select auth.uid()) limit 1;
$$;

-- 14. RLS POLICIES
-- WORKSPACES
create policy "workspaces_select_member"  on public.workspaces for select to authenticated using ( public.is_workspace_member(id) );
create policy "workspaces_insert_owner"   on public.workspaces for insert to authenticated with check ( (select auth.uid()) = owner_user_id );
create policy "workspaces_update_admin"   on public.workspaces for update to authenticated using ( public.workspace_user_role(id) in ('owner','admin') ) with check ( public.workspace_user_role(id) in ('owner','admin') );
create policy "workspaces_delete_owner"   on public.workspaces for delete to authenticated using ( public.workspace_user_role(id) = 'owner' );
-- WORKSPACE MEMBERS
create policy "ws_members_select_member"  on public.workspace_members for select to authenticated using ( public.is_workspace_member(workspace_id) );
create policy "ws_members_insert_admin"   on public.workspace_members for insert to authenticated with check ( public.workspace_user_role(workspace_id) in ('owner','admin') );
create policy "ws_members_update_admin"   on public.workspace_members for update to authenticated using ( public.workspace_user_role(workspace_id) in ('owner','admin') ) with check ( public.workspace_user_role(workspace_id) in ('owner','admin') );
create policy "ws_members_delete_admin"   on public.workspace_members for delete to authenticated using ( public.workspace_user_role(workspace_id) in ('owner','admin') );
-- WORKSPACE INVITES
create policy "ws_invites_select_admin"   on public.workspace_invites for select to authenticated using ( public.workspace_user_role(workspace_id) in ('owner','admin') );
create policy "ws_invites_insert_admin"   on public.workspace_invites for insert to authenticated with check ( public.workspace_user_role(workspace_id) in ('owner','admin') );
create policy "ws_invites_delete_admin"   on public.workspace_invites for delete to authenticated using ( public.workspace_user_role(workspace_id) in ('owner','admin') );
-- SCANS
create policy "scans_select_member"       on public.scans for select to authenticated using ( public.is_workspace_member(workspace_id) );
create policy "scans_insert_analyst"      on public.scans for insert to authenticated with check ( public.workspace_user_role(workspace_id) in ('owner','admin','analyst') and (select auth.uid()) = created_by );
create policy "scans_update_analyst"      on public.scans for update to authenticated using ( public.workspace_user_role(workspace_id) in ('owner','admin','analyst') ) with check ( public.workspace_user_role(workspace_id) in ('owner','admin','analyst') );
create policy "scans_delete_admin"        on public.scans for delete to authenticated using ( public.workspace_user_role(workspace_id) in ('owner','admin') );
-- FINDINGS
create policy "findings_select_member"    on public.findings for select to authenticated using ( exists ( select 1 from public.scans s where s.id = scan_id and public.is_workspace_member(s.workspace_id) ) );
create policy "findings_insert_analyst"   on public.findings for insert to authenticated with check ( exists ( select 1 from public.scans s where s.id = scan_id and public.workspace_user_role(s.workspace_id) in ('owner','admin','analyst') ) );
create policy "findings_update_analyst"   on public.findings for update to authenticated using ( exists ( select 1 from public.scans s where s.id = scan_id and public.workspace_user_role(s.workspace_id) in ('owner','admin','analyst') ) ) with check ( exists ( select 1 from public.scans s where s.id = scan_id and public.workspace_user_role(s.workspace_id) in ('owner','admin','analyst') ) );
-- COMPLIANCE VIOLATIONS
create policy "violations_select_member"  on public.compliance_violations for select to authenticated using ( exists ( select 1 from public.findings f join public.scans s on s.id = f.scan_id where f.id = finding_id and public.is_workspace_member(s.workspace_id) ) );
create policy "violations_insert_analyst" on public.compliance_violations for insert to authenticated with check ( exists ( select 1 from public.findings f join public.scans s on s.id = f.scan_id where f.id = finding_id and public.workspace_user_role(s.workspace_id) in ('owner','admin','analyst') ) );
-- REPORTS
create policy "reports_select_member"     on public.reports for select to authenticated using ( exists ( select 1 from public.scans s where s.id = scan_id and public.is_workspace_member(s.workspace_id) ) );
create policy "reports_insert_analyst"    on public.reports for insert to authenticated with check ( exists ( select 1 from public.scans s where s.id = scan_id and public.workspace_user_role(s.workspace_id) in ('owner','admin','analyst') ) );
create policy "reports_update_system"     on public.reports for update to authenticated using ( exists ( select 1 from public.scans s where s.id = scan_id and public.workspace_user_role(s.workspace_id) in ('owner','admin','analyst') ) ) with check ( exists ( select 1 from public.scans s where s.id = scan_id and public.workspace_user_role(s.workspace_id) in ('owner','admin','analyst') ) );
-- AUDIT EVENTS
create policy "audit_events_select_admin" on public.audit_events for select to authenticated using ( public.workspace_user_role(workspace_id) in ('owner','admin') );
create policy "audit_events_insert_member" on public.audit_events for insert to authenticated with check ( public.is_workspace_member(workspace_id) );
