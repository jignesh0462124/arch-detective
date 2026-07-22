# ThreatLens Supabase Backend Architecture

> Status: Proposed target architecture  
> Scope: Replace custom authentication, self-managed PostgreSQL, and AWS S3/R2 with Supabase  
> Preserved: FastAPI, SQLAlchemy, Alembic, Celery, Redis, Qdrant, scanners, Groq/LangChain, WeasyPrint, and the existing React application  
> Source documents: every Markdown file under `.github/Backend`, including Parts 1-8, Workflows 1-6, `Backend.md`, `Backend-Frontend-Connect.md`, `copilot-instructions.md`, and `AI-Implementation-Prompts.md`

## 1. Executive Decision

ThreatLens will use Supabase for three managed platform responsibilities:

1. **Supabase Auth** for user registration, login, email verification, session refresh, password reset, and OAuth when needed.
2. **Supabase PostgreSQL** for profiles, workspaces, scans, findings, compliance violations, report metadata, and audit events.
3. **Supabase Storage** for private scan inputs and generated audit reports.

ThreatLens will continue to use its existing Python services for the work Supabase is not designed to perform:

- **FastAPI** remains the only business API and authorization boundary.
- **Celery + Redis** remain the asynchronous execution and short-lived progress system.
- **Qdrant** remains the compliance RAG vector database.
- **Semgrep, Bandit, TruffleHog, dependency audit, and custom parsers** remain isolated worker processes.
- **Groq/LangChain** remain the LLM analysis and compliance mapping layer.
- **WeasyPrint/Jinja2/matplotlib** remain the report generation layer.

This is a hybrid architecture, not a rewrite into Supabase Edge Functions. It removes infrastructure that is difficult for a beginner to operate while preserving the backend pipeline already specified and partially implemented.

## 2. Architecture Goals

- Remove AWS, S3, Cloudflare R2, custom password hashing, and custom JWT issuing.
- Keep the route structure and frontend behavior described in the existing backend documents.
- Preserve SQLAlchemy 2.x and Alembic as the application database layer and migration source of truth.
- Add workspace-level isolation so every scan, finding, report, and object has an explicit tenant owner.
- Keep uploaded repositories and generated reports private by default.
- Avoid passing database or Supabase administrative credentials into scanner subprocesses.
- Keep scan execution retryable and report generation idempotent.
- Support the existing maximum upload size of 50 MB without loading the whole file into FastAPI memory.
- Make local development simpler: local Docker runs Redis and Qdrant; Supabase hosts Auth, PostgreSQL, and Storage.

## 3. Non-Goals

- Do not replace Qdrant with pgvector during the initial migration.
- Do not replace Celery/Redis with Supabase queues or database polling.
- Do not run Semgrep, Bandit, TruffleHog, WeasyPrint, or the LLM pipeline in Edge Functions.
- Do not expose the application tables directly as the primary frontend API.
- Do not store Git access tokens, repository contents, signed URLs, or Supabase service keys in database rows.
- Do not add billing, organization invitations, SSO, or enterprise role management until the core scan flow works.

## 4. Replacement Matrix

| Existing design                                          | Supabase target                                                 | Decision |
| -------------------------------------------------------- | --------------------------------------------------------------- | -------- |
| Docker PostgreSQL 15                                     | Supabase managed PostgreSQL                                     | Replace  |
| `users.hashed_password`                                  | Supabase `auth.users`                                           | Replace  |
| FastAPI `/auth/register`, `/auth/login`, `/auth/refresh` | `supabase-js` Auth methods                                      | Replace  |
| FastAPI-issued HS256 JWT                                 | Supabase access token, verified by FastAPI through JWKS         | Replace  |
| S3/R2 report bucket                                      | Private Supabase `audit-reports` bucket                         | Replace  |
| FastAPI multipart upload as the only path                | Direct private Storage upload followed by FastAPI start request | Replace  |
| Stored `signed_url` column                               | Generate a short-lived signed URL on demand                     | Replace  |
| Local PostgreSQL volume                                  | Supabase backups and managed persistence                        | Remove   |
| SQLAlchemy + Alembic                                     | SQLAlchemy + Alembic against Supabase PostgreSQL                | Keep     |
| Celery + Redis                                           | Celery + Redis                                                  | Keep     |
| Qdrant RAG                                               | Qdrant RAG                                                      | Keep     |
| Groq/LangChain                                           | Groq/LangChain                                                  | Keep     |
| FastAPI REST/WebSocket API                               | FastAPI REST/WebSocket API                                      | Keep     |
| React Query hooks                                        | React Query hooks with Supabase session tokens                  | Keep     |

## 5. Target System Architecture

```mermaid
flowchart TB
    Browser["React / TanStack Start"]
    Auth["Supabase Auth"]
    Storage["Supabase Storage\nprivate buckets"]
    API["FastAPI business API"]
    DB["Supabase PostgreSQL"]
    Redis["Redis broker and progress cache"]
    Worker["Celery workers"]
    Sandbox["Disposable scanner sandbox"]
    Qdrant["Qdrant compliance RAG"]
    Groq["Groq / Llama"]
    Report["Jinja2 + WeasyPrint"]

    Browser -->|signup, login, refresh| Auth
    Auth -->|access token| Browser
    Browser -->|Bearer access token| API
    Browser -->|resumable upload with user token| Storage
    API -->|SQLAlchemy| DB
    API -->|enqueue| Redis
    Redis --> Worker
    Worker -->|read and update| DB
    Worker -->|download source / upload report| Storage
    Worker --> Sandbox
    Worker --> Qdrant
    Worker --> Groq
    Worker --> Report
    API -->|short-lived signed report URL| Browser
```

### Runtime ownership

| Component       | Durable data                          | Secrets allowed                                                                  | Publicly reachable                           |
| --------------- | ------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| Browser         | Supabase session managed by SDK       | Publishable Supabase key only                                                    | Yes                                          |
| FastAPI         | None locally                          | DB runtime URL, Supabase URL, service role key, Groq key only if required by API | Yes                                          |
| Celery worker   | Temporary scan workspace              | DB runtime URL, Storage service role key, Groq key, Qdrant key                   | No                                           |
| Scanner sandbox | Temporary extracted source            | No DB, Redis, Supabase, Groq, or Qdrant credentials                              | No                                           |
| Redis           | Queue messages and temporary progress | Redis password                                                                   | Private network only                         |
| Qdrant          | Compliance embeddings                 | Qdrant API key                                                                   | Private network or restricted cloud endpoint |
| Supabase        | Auth, PostgreSQL, private objects     | Platform-managed                                                                 | Managed endpoints                            |

## 6. Trust Boundaries

1. **Browser to Supabase Auth:** Supabase owns credentials and session rotation. ThreatLens never receives a user password.
2. **Browser to FastAPI:** every protected request carries a Supabase access token. FastAPI validates signature, issuer, audience, expiration, and subject.
3. **Browser to Storage:** uploads are restricted by Storage RLS to an exact workspace and scan path.
4. **FastAPI to PostgreSQL:** FastAPI performs business authorization before every tenant query.
5. **Worker to untrusted source:** uploaded code, ZIP files, YAML, and logs are hostile input. Scanners execute in a disposable, resource-limited environment.
6. **Worker to external LLM:** source data is minimized and secrets are redacted before a Groq request.
7. **Report download:** FastAPI authorizes the report first, then returns a short-lived signed Storage URL.

## 7. Recommended Project Structure

The existing `threatlens/` package remains. Only Supabase-specific modules and models are added or replaced.

```text
threatlens/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── auth/
│   │   ├── dependencies.py       # FastAPI current-user dependency
│   │   ├── jwt_verifier.py       # Supabase JWKS verification and cache
│   │   └── permissions.py        # workspace role checks
│   ├── models/
│   │   ├── profile.py            # replaces custom user model
│   │   ├── workspace.py
│   │   ├── scan.py
│   │   ├── scan_artifact.py
│   │   ├── finding.py
│   │   ├── compliance_violation.py
│   │   ├── report.py
│   │   └── audit_event.py
│   ├── api/
│   │   ├── auth.py               # me/bootstrap only, no password endpoints
│   │   ├── scans.py
│   │   ├── reports.py
│   │   ├── frameworks.py
│   │   ├── export.py
│   │   └── ws.py
│   ├── storage/
│   │   ├── client.py             # server-only Supabase Storage client
│   │   ├── paths.py              # canonical object path builder
│   │   └── lifecycle.py          # delete/retention helpers
│   ├── ingestion/
│   ├── scanners/
│   ├── rag/
│   ├── agent/
│   ├── report/
│   └── tasks/
├── alembic/
├── scripts/
├── tests/
├── docker-compose.yml            # Redis, Qdrant, API, and worker; no PostgreSQL
├── Dockerfile
├── requirements.txt
└── .env.example
```

Frontend additions:

```text
src/
├── lib/
│   ├── supabase.ts               # browser client singleton
│   └── api/
│       ├── client.ts             # obtains current Supabase token
│       ├── auth.ts               # Supabase Auth wrapper
│       ├── scans.ts
│       ├── findings.ts
│       ├── reports.ts
│       └── frameworks.ts
└── hooks/
    ├── useAuth.ts
    ├── useScans.ts
    ├── useFindings.ts
    ├── useReports.ts
    └── useScanProgress.ts
```

## 8. Supabase Environment Strategy

Use separate Supabase projects for development and production. A staging project is recommended once deployment begins. Never point local tests at production.

### Frontend variables

Only publishable values are allowed in Vite variables.

```dotenv
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
```

### Backend variables

```dotenv
ENVIRONMENT=development
DEBUG=true

# Runtime application connection. Prefer Supavisor session mode when IPv4 is required.
DATABASE_URL=postgresql+asyncpg://threatlens_backend:REPLACE_ME@HOST:5432/postgres?ssl=require

# Owner connection used only by Alembic/CI migrations, never by the running API.
MIGRATION_DATABASE_URL=postgresql+psycopg://postgres.PROJECT_REF:REPLACE_ME@HOST:5432/postgres?sslmode=require

SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_JWKS_URL=https://PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_ISSUER=https://PROJECT_REF.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_SERVICE_ROLE_KEY=sb_secret_REPLACE_ME
SUPABASE_SCAN_BUCKET=scan-inputs
SUPABASE_REPORT_BUCKET=audit-reports
SIGNED_URL_TTL_SECONDS=300

REDIS_URL=redis://:REPLACE_ME@redis:6379/0
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=REPLACE_ME
QDRANT_COLLECTION=compliance_knowledge
GROQ_API_KEY=REPLACE_ME
NVD_API_KEY=REPLACE_ME

MAX_FILE_SIZE_MB=50
SOURCE_RETENTION_HOURS=24
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080
```

### Secret rules

- Never prefix the service role key, database password, Groq key, Redis password, or Qdrant key with `VITE_`.
- Never use the service role key in React, screenshots, logs, test fixtures, or generated reports.
- The publishable/anon key is expected in the browser; security comes from Auth and RLS, not hiding that key.
- The service role bypasses RLS. Limit it to server-side Storage operations that need administrative access.
- FastAPI does not need the service role key to verify user JWTs.
- Rotate any key that has previously appeared in a committed or shared `.env` file.

## 9. PostgreSQL Connection Architecture

### Connection choice

| Workload                              | Connection                                                         | Reason                                           |
| ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| Alembic migrations                    | Direct connection when available, otherwise Supavisor session mode | DDL and migration locks need stable sessions     |
| FastAPI                               | Direct connection or Supavisor session mode                        | Long-lived async process with SQLAlchemy pooling |
| Celery worker                         | Direct connection or Supavisor session mode                        | Persistent worker process                        |
| Serverless deployment, if added later | Supavisor transaction mode                                         | Many short-lived connections                     |

Do not use transaction mode with SQLAlchemy prepared statements unless prepared statements are disabled and the behavior is tested. Keep API and worker pool sizes conservative because Supabase connection limits are shared.

Recommended initial SQLAlchemy settings per process:

```python
create_async_engine(
    settings.DATABASE_URL,
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={"ssl": "require"},
)
```

The API and each worker process create their own pool. Total possible connections must be calculated as:

```text
(API process count + worker process count) * (pool_size + max_overflow)
```

### Database roles

- `postgres` or the Supabase owner role: migrations only.
- `threatlens_backend`: API and worker CRUD; no schema ownership and no ability to alter roles.
- `authenticated`: browser access controlled by RLS, used mainly for Storage policies.
- `anon`: no access to ThreatLens application data or private buckets.

Do not run the API with the owner connection. Do not give the scanner sandbox any database role.

## 10. Application Data Model

### Entity relationships

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : has
    AUTH_USERS ||--o{ WORKSPACE_MEMBERS : joins
    WORKSPACES ||--o{ WORKSPACE_MEMBERS : contains
    WORKSPACES ||--o{ SCANS : owns
    AUTH_USERS ||--o{ SCANS : creates
    SCANS ||--o{ SCAN_ARTIFACTS : stores
    SCANS ||--o{ FINDINGS : produces
    FINDINGS ||--o{ COMPLIANCE_VIOLATIONS : maps
    SCANS ||--o{ REPORTS : generates
    WORKSPACES ||--o{ AUDIT_EVENTS : records
```

### `auth.users`

Managed entirely by Supabase Auth. Do not map or store `hashed_password` in the application schema.

### `profiles`

| Column         | Type          | Rule                                                      |
| -------------- | ------------- | --------------------------------------------------------- |
| `id`           | `uuid`        | Primary key and FK to `auth.users.id` with cascade delete |
| `display_name` | `text`        | Optional, maximum 120 characters                          |
| `avatar_url`   | `text`        | Optional; validate allowed URL form                       |
| `created_at`   | `timestamptz` | Default `now()`                                           |
| `updated_at`   | `timestamptz` | Updated by application                                    |

Email remains in `auth.users`; do not duplicate it unless a denormalized read model becomes necessary.

### `workspaces`

| Column          | Type          | Rule                                        |
| --------------- | ------------- | ------------------------------------------- |
| `id`            | `uuid`        | Primary key, default `gen_random_uuid()`    |
| `name`          | `text`        | Required, 1-120 characters                  |
| `slug`          | `text`        | Unique normalized slug                      |
| `owner_user_id` | `uuid`        | FK to `auth.users.id`, restricted on delete |
| `created_at`    | `timestamptz` | Default `now()`                             |

### `workspace_members`

| Column         | Type          | Rule                                           |
| -------------- | ------------- | ---------------------------------------------- |
| `workspace_id` | `uuid`        | FK to `workspaces.id`, cascade delete          |
| `user_id`      | `uuid`        | FK to `auth.users.id`, cascade delete          |
| `role`         | `text`        | Check in `owner`, `admin`, `analyst`, `viewer` |
| `created_at`   | `timestamptz` | Default `now()`                                |

Primary key: `(workspace_id, user_id)`. Add an index on `(user_id, workspace_id)` for membership checks.

### `scans`

Preserve existing status, type, progress, finding count, framework scores, and timestamps. Replace direct ownership by a custom user table.

| Added/revised column  | Type          | Purpose                                            |
| --------------------- | ------------- | -------------------------------------------------- |
| `workspace_id`        | `uuid`        | Required tenant boundary                           |
| `created_by`          | `uuid`        | FK to `auth.users.id`                              |
| `source_type`         | `text`        | `upload`, `git`, `architecture`, `logs`, or `full` |
| `source_config`       | `jsonb`       | Non-secret source metadata only                    |
| `selected_frameworks` | `text[]`      | Requested framework identifiers                    |
| `celery_task_id`      | `text`        | Operational correlation, not business truth        |
| `error_code`          | `text`        | Stable user-safe failure code                      |
| `error_message`       | `text`        | Sanitized message, never stack trace               |
| `started_at`          | `timestamptz` | Worker start time                                  |

Checks:

- `progress between 0 and 100`
- `finding_count >= 0`
- allowed status values: `pending`, `uploading`, `queued`, `running`, `completed`, `failed`, `cancelled`

Indexes:

- `(workspace_id, created_at desc)`
- `(workspace_id, status, created_at desc)`
- `(created_by, created_at desc)`

### `scan_artifacts`

This table separates object metadata from the scan state.

| Column              | Type          | Purpose                                                     |
| ------------------- | ------------- | ----------------------------------------------------------- |
| `id`                | `uuid`        | Primary key                                                 |
| `scan_id`           | `uuid`        | FK to scan, cascade delete                                  |
| `kind`              | `text`        | `source_zip`, `architecture_yaml`, `log_bundle`, or `other` |
| `bucket`            | `text`        | Must equal configured input bucket                          |
| `object_path`       | `text`        | Canonical private Storage path                              |
| `original_filename` | `text`        | Sanitized display name                                      |
| `content_type`      | `text`        | Validated MIME type                                         |
| `byte_size`         | `bigint`      | Must be within configured limit                             |
| `sha256`            | `text`        | Integrity and deduplication aid                             |
| `status`            | `text`        | `pending`, `uploaded`, `verified`, `processed`, `deleted`   |
| `created_at`        | `timestamptz` | Default `now()`                                             |

Unique constraint: `(bucket, object_path)`.

### `findings`

Keep the existing Part 1 fields. Add `fingerprint text` for deterministic deduplication and optional triage fields:

- `state`: `open`, `accepted_risk`, `resolved`, `false_positive`
- `assigned_to`: nullable FK to `auth.users.id`
- `updated_at`: `timestamptz`

Indexes:

- `(scan_id, severity)`
- `(scan_id, source)`
- `(scan_id, fingerprint)` unique where practical

### `compliance_violations`

Keep the existing schema and add a unique constraint on `(finding_id, framework, control_id)`. Store Qdrant point IDs in `rag_chunk_ids`; do not duplicate full licensed compliance documents in PostgreSQL.

### `reports`

Replace URL persistence with stable object identity.

| Column          | Type          | Purpose                                   |
| --------------- | ------------- | ----------------------------------------- |
| `id`            | `uuid`        | Primary key                               |
| `scan_id`       | `uuid`        | FK to scan, cascade delete                |
| `status`        | `text`        | `queued`, `generating`, `ready`, `failed` |
| `bucket`        | `text`        | Configured report bucket                  |
| `object_path`   | `text`        | Stable private object path                |
| `sha256`        | `text`        | Integrity value                           |
| `byte_size`     | `bigint`      | Generated PDF size                        |
| `version`       | `integer`     | Report revision                           |
| `generated_at`  | `timestamptz` | Nullable until ready                      |
| `error_message` | `text`        | Sanitized failure message                 |

Do not store a signed URL or its expiration. Signed URLs are credentials and should be generated only after authorization.

### `audit_events`

Record security-relevant business events: scan created, upload verified, scan started, scan completed, report generated, report downloaded, scan deleted, and authorization denied. Store IDs and metadata, not source code, access tokens, secrets, or full request bodies.

## 11. Migration Source of Truth

Use Alembic for all application schema, indexes, grants, RLS policies, helper functions, and Storage policies. Do not alternate between manual Dashboard changes, Supabase CLI migrations, and Alembic for the same objects.

Acceptable Dashboard-only setup:

- Create the Supabase project.
- Configure Auth providers, redirect URLs, email templates, and password policy.
- Create initial secret values in the deployment platform.

Everything reproducible in PostgreSQL belongs in Alembic.

### Current repository migration path

The current `0001_initial_schema.py` creates a public `users` table with `hashed_password`, and `scans.user_id` references it.

If no shared or production database has used that migration:

1. Rewrite/squash the initial migration before applying it to Supabase.
2. Create `profiles`, `workspaces`, and `workspace_members` instead of `users`.
3. Reference `auth.users(id)` from `profiles`, memberships, and `scans.created_by`.

If an existing database contains real users or scans:

1. Create an additive migration; never rewrite applied history.
2. Create Supabase Auth users through a controlled admin import or invitation flow.
3. Do not attempt to copy bcrypt hashes into Supabase Auth.
4. Map old user IDs to new `auth.users.id` values in a temporary migration table.
5. Backfill workspaces, memberships, and `scans.workspace_id`.
6. Validate row counts and ownership before dropping old foreign keys and password columns.
7. Force password reset or invitation acceptance for migrated users.

## 12. Row-Level Security and Authorization

### Authorization model

FastAPI is the primary business authorization layer. RLS is the database safety layer for browser-accessible Supabase operations, especially Storage.

- All public application tables have RLS enabled.
- `anon` receives no application table access.
- `authenticated` policies require active workspace membership.
- FastAPI always includes `workspace_id` in tenant queries and checks membership before loading a scan or report.
- Celery jobs receive `scan_id`, then load the authoritative workspace and object path from PostgreSQL. They never trust tenant paths from queue payloads.
- The Supabase service role is used only in trusted server processes and never substitutes for API authorization.

### Membership helper

Use a stable SQL helper to avoid duplicating policy logic:

```sql
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;
```

Grant execute only to `authenticated`. Index all columns used by RLS policies.

### Example scan policies

```sql
alter table public.scans enable row level security;

create policy "members can read workspace scans"
on public.scans
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "analysts can create workspace scans"
on public.scans
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = scans.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'analyst')
  )
);
```

Application policies should be generated for all tenant tables. Do not create a broad policy such as `using (true)` for `authenticated`.

## 13. Supabase Auth Architecture

### Frontend session flow

1. Create one browser client with `createClient`.
2. Sign up with `supabase.auth.signUp`.
3. Sign in with `supabase.auth.signInWithPassword` or an approved OAuth provider.
4. Subscribe to `onAuthStateChange` for session transitions.
5. Let the Supabase SDK refresh the session.
6. Obtain the current access token immediately before a FastAPI request.
7. Sign out with `supabase.auth.signOut` and clear private React Query caches.

Do not create a second ThreatLens password database. Do not manually decode a JWT in React to decide authorization.

### FastAPI token verification

FastAPI must verify:

- signature against the Supabase JWKS
- expected issuer
- audience `authenticated`
- `exp`, `iat`, and `sub`
- supported signing algorithm

Cache JWKS keys with a bounded TTL and refresh when the token `kid` is unknown. Reject tokens if verification services fail; do not accept an unverified decode as fallback.

The request identity should be a typed object:

```python
class AuthenticatedUser(BaseModel):
    id: UUID
    email: EmailStr | None
    session_id: str | None
```

Workspace roles come from `workspace_members`, not user-editable `user_metadata`.

### FastAPI auth endpoints after migration

| Method  | Endpoint                 | Responsibility                                           |
| ------- | ------------------------ | -------------------------------------------------------- |
| `GET`   | `/api/v1/auth/me`        | Return verified user profile and memberships             |
| `POST`  | `/api/v1/auth/bootstrap` | Idempotently create profile and first personal workspace |
| `PATCH` | `/api/v1/auth/profile`   | Update allowed profile fields                            |

Remove FastAPI password endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- password hashing helpers
- application JWT signing secret

## 14. Supabase Storage Architecture

### Buckets

| Bucket          | Visibility | Contents                                | Retention                                              |
| --------------- | ---------- | --------------------------------------- | ------------------------------------------------------ |
| `scan-inputs`   | Private    | ZIP, architecture YAML, and log bundles | Delete after processing plus a 24-hour recovery window |
| `audit-reports` | Private    | Generated PDF audit reports             | Retain until workspace/report deletion policy applies  |

Optional later buckets such as avatars should be separate because their policies and retention differ.

### Canonical paths

```text
scan-inputs/{workspace_id}/{scan_id}/{artifact_id}/{sanitized_filename}
audit-reports/{workspace_id}/{scan_id}/{report_id}/threatlens-audit-v{version}.pdf
```

Never accept a complete Storage path directly from the browser. FastAPI creates IDs and returns the exact allowed path. The worker reloads that path from `scan_artifacts` or `reports`.

### Upload flow for the 50 MB requirement

Supabase standard uploads are appropriate for small files. For the project requirement up to 50 MB, use Supabase resumable TUS uploads.

1. Browser calls `POST /api/v1/scans` with metadata and selected frameworks.
2. FastAPI authorizes the workspace, creates the scan and artifact rows, and returns the exact object path.
3. Browser uploads directly to `scan-inputs` with its Supabase access token and Storage RLS.
4. Browser calls `POST /api/v1/scans/{scan_id}/start` with artifact ID and checksum.
5. FastAPI verifies bucket, object path, size, MIME type, checksum metadata, scan state, and workspace ownership.
6. FastAPI changes status to `queued` and dispatches Celery.

The TUS client is a justified frontend dependency because the existing specification requires reliable uploads above the size recommended for standard upload.

### Example Storage RLS concept

The first path segment is the workspace ID. A user may upload only if they are an analyst, admin, or owner in that workspace, and only to a scan created by the API. The exact policy should also verify the path against a pending `scan_artifacts` row where possible.

```sql
create policy "workspace members upload scan inputs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'scan-inputs'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ((storage.foldername(name))[1])::uuid
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'analyst')
  )
);
```

Create separate select, update, and delete policies. Do not combine unrelated bucket permissions into one broad policy.

### Report download flow

1. Browser requests `GET /api/v1/reports/{report_id}/download` with a Supabase access token.
2. FastAPI verifies workspace membership and report status.
3. FastAPI creates a signed URL for the configured report object with a short TTL, initially 300 seconds.
4. FastAPI returns `{url, expires_in}` and records an audit event.
5. The database retains only `bucket` and `object_path`, never the signed URL.

## 15. Scan Lifecycle

```mermaid
sequenceDiagram
    participant UI as React UI
    participant SA as Supabase Auth
    participant API as FastAPI
    participant SS as Supabase Storage
    participant DB as Supabase PostgreSQL
    participant R as Redis
    participant W as Celery Worker
    participant Q as Qdrant
    participant G as Groq

    UI->>SA: Sign in
    SA-->>UI: Access token
    UI->>API: POST /scans with Bearer token
    API->>DB: Create scan and artifact
    API-->>UI: scan_id and exact upload path
    UI->>SS: Resumable private upload
    UI->>API: POST /scans/{id}/start
    API->>SS: Verify object metadata
    API->>DB: Mark queued
    API->>R: Enqueue scan_id
    API-->>UI: 202 Accepted
    R->>W: Deliver task
    W->>DB: Load authoritative scan and artifact
    W->>SS: Download source to temporary directory
    W->>W: Validate and extract safely
    W->>W: Run scanners in isolation
    W->>Q: Retrieve compliance controls
    W->>G: Structured compliance analysis
    W->>DB: Save findings and violations
    W->>DB: Mark completed
    W->>SS: Delete source after retention window
```

### State transitions

```text
pending -> uploading -> queued -> running -> completed
                               \-> failed
pending/uploading/queued/running -> cancelled
```

Transitions must use conditional updates so duplicate requests and Celery retries do not start the same scan twice.

## 16. Celery and Redis Responsibilities

Redis is still required because Supabase PostgreSQL is the durable business database, not a task broker.

Redis stores:

- Celery task messages
- short-lived task results
- scan progress snapshots
- rate-limit counters
- WebSocket fan-out/pub-sub if used
- distributed locks for idempotent scan/report execution

Redis must not be the only copy of:

- scan status
- findings
- compliance mappings
- report metadata
- ownership or authorization state

Persist meaningful state to PostgreSQL at stage boundaries. Configure JSON-only Celery serialization, result expiration, hard/soft time limits, retries with backoff, and password/TLS in production.

Queue separation is recommended:

```text
ingestion       -> download, validation, extraction
static-scan     -> Semgrep, Bandit, TruffleHog, dependency audit
llm             -> Groq review and compliance mapping
report          -> charts, HTML, PDF, Storage upload
maintenance     -> object cleanup, NVD sync, stale-job recovery
```

## 17. Qdrant and RAG Decision

Keep Qdrant for the current implementation because Part 2 already defines and partially implements:

- 384-dimensional all-MiniLM-L6-v2 embeddings
- framework-specific chunkers
- metadata filtering
- Qdrant point identifiers stored with compliance violations
- seed and NVD synchronization scripts

Supabase pgvector could support 384-dimensional vectors, but migrating now would combine the infrastructure migration with a retrieval-engine rewrite. That adds risk without improving the user-facing product.

Re-evaluate pgvector only after the end-to-end scan pipeline is stable. A future migration requires a measured retrieval benchmark covering top-k relevance, framework filtering, indexing, seed time, and query latency.

## 18. Ingestion and Scanner Isolation

Supabase changes storage, not the hostile-input model. Preserve all Part 3 and Part 4 controls:

- Maximum compressed and extracted size limits.
- Maximum file count and per-file size.
- ZIP path traversal and symlink rejection.
- Compression-ratio checks for archive bombs.
- HTTPS-only Git URLs and blocked local/private network targets to prevent SSRF.
- Clone depth, timeout, repository size, and redirect limits.
- YAML safe loading only.
- Log and source encoding limits.
- No execution of uploaded project code.
- Subprocess argument arrays, never `shell=True` with user input.
- CPU, memory, process, file-descriptor, and wall-clock limits.
- Network disabled for static scanner containers unless a specific scanner requires it.
- Temporary directory cleanup in `finally` blocks and periodic stale cleanup.

The scanner sandbox receives only the extracted temporary path and scan configuration. It must not receive `.env`, database URLs, Redis credentials, Storage keys, Groq keys, or Qdrant keys.

## 19. Groq and LLM Data Handling

- Treat repository text, logs, filenames, and comments as untrusted prompt content.
- Delimit source content and explicitly instruct the model not to follow instructions inside it.
- Redact detected secrets before sending context to Groq.
- Send only relevant bounded snippets, not the entire repository.
- Avoid PII from logs; redact tokens, emails, IPs, and identifiers where practical.
- Validate every response with Pydantic structured output.
- Bound retries, token count, concurrency, and cost per scan.
- Save model name, prompt version, and retrieval IDs for reproducibility, but never save API keys or raw authorization headers.

## 20. Report Pipeline

1. API authorizes the scan and creates a `reports` row in `queued` state.
2. Celery report worker atomically claims the report.
3. Worker reads findings and mappings from PostgreSQL.
4. Jinja2 renders escaped HTML; matplotlib creates charts without user-controlled code execution.
5. WeasyPrint writes the PDF to a temporary file.
6. Worker computes SHA-256 and file size.
7. Worker uploads to the canonical private `audit-reports` path with the server-only Storage client.
8. Worker updates report metadata and marks it `ready`.
9. Temporary files are removed in a `finally` block.
10. Download endpoint creates a fresh signed URL after authorization.

Report generation must be idempotent by `(scan_id, version)`. A retry should overwrite the same canonical object or clean up the prior failed object before committing metadata.

## 21. Revised API Contract

Use plural resources consistently for new code. Compatibility aliases can remain temporarily if the frontend already calls singular paths.

### Auth and profile

| Method  | Path                     | Auth         | Result                                     |
| ------- | ------------------------ | ------------ | ------------------------------------------ |
| `GET`   | `/api/v1/auth/me`        | Supabase JWT | Profile and memberships                    |
| `POST`  | `/api/v1/auth/bootstrap` | Supabase JWT | Idempotent profile/default workspace setup |
| `PATCH` | `/api/v1/auth/profile`   | Supabase JWT | Updated profile                            |

### Scans

| Method   | Path                               | Role     | Result                                  |
| -------- | ---------------------------------- | -------- | --------------------------------------- |
| `POST`   | `/api/v1/scans`                    | analyst+ | Create scan and upload intent/path      |
| `POST`   | `/api/v1/scans/{scan_id}/start`    | analyst+ | Verify artifact and enqueue             |
| `GET`    | `/api/v1/scans`                    | viewer+  | Workspace-scoped paginated list         |
| `GET`    | `/api/v1/scans/{scan_id}`          | viewer+  | Scan detail/status                      |
| `GET`    | `/api/v1/scans/{scan_id}/findings` | viewer+  | Paginated/filterable findings           |
| `POST`   | `/api/v1/scans/{scan_id}/cancel`   | analyst+ | Request cancellation                    |
| `DELETE` | `/api/v1/scans/{scan_id}`          | admin+   | Delete scan and schedule object cleanup |

For Git sources, `POST /scans` stores only a sanitized HTTPS URL and non-secret branch/ref. Private Git credentials require a future encrypted integration design and are not stored in `source_config`.

### Reports and exports

| Method | Path                                   | Role     | Result                 |
| ------ | -------------------------------------- | -------- | ---------------------- |
| `POST` | `/api/v1/scans/{scan_id}/reports`      | analyst+ | Queue PDF generation   |
| `GET`  | `/api/v1/reports`                      | viewer+  | Workspace report list  |
| `GET`  | `/api/v1/reports/{report_id}`          | viewer+  | Report metadata/status |
| `GET`  | `/api/v1/reports/{report_id}/download` | viewer+  | Short-lived signed URL |
| `GET`  | `/api/v1/scans/{scan_id}/export.csv`   | viewer+  | Stream CSV             |
| `GET`  | `/api/v1/scans/{scan_id}/export.json`  | viewer+  | Stream JSON            |

### Frameworks and progress

| Method | Path                         | Auth                   | Result                       |
| ------ | ---------------------------- | ---------------------- | ---------------------------- |
| `GET`  | `/api/v1/frameworks`         | Supabase JWT           | Available framework metadata |
| `WS`   | `/api/v1/ws/scans/{scan_id}` | Supabase JWT handshake | Authorized progress events   |

### Pagination and filtering

All list endpoints use bounded pagination, stable sort keys, and validated filters. Never load all findings for a large workspace by default.

## 22. WebSocket Authentication

Browsers cannot reliably attach an Authorization header to a native WebSocket connection. Do not put long-lived access tokens in URLs because URLs are frequently logged.

Recommended handshake:

1. Connect to `/api/v1/ws/scans/{scan_id}`.
2. Within five seconds, send `{ "type": "authenticate", "access_token": "..." }`.
3. Server verifies the token and workspace membership.
4. Server subscribes the socket to that scan's progress channel.
5. Close with an authorization-specific code if verification fails.
6. Client falls back to authenticated polling after disconnection.

Never broadcast progress by scan ID without checking membership first.

## 23. Frontend Integration Changes

### Supabase client

Create one client singleton in `src/lib/supabase.ts`. Use only the project URL and publishable key.

### API client

The base FastAPI client becomes asynchronous when preparing headers:

```typescript
const { data, error } = await supabase.auth.getSession();
if (error) throw error;

const token = data.session?.access_token;
const headers = new Headers(init.headers);
if (token) headers.set("Authorization", `Bearer ${token}`);
```

On `401`, ask Supabase for the current session or redirect to login. Do not invent a second refresh-token flow in the FastAPI client.

### React Query boundaries

- Include `workspaceId` in every tenant query key.
- Clear private caches on logout and workspace switch.
- Keep polling as the reliable scan-progress baseline.
- Add WebSocket updates as an enhancement, not the only status source.
- Gradually replace `mock-data.ts` imports exactly as described in `Backend-Frontend-Connect.md`.

### Upload UI

The New Scan route should:

1. Create the scan through FastAPI.
2. Upload to the exact Supabase Storage path.
3. Display resumable progress.
4. Call the start endpoint only after upload completion.
5. Abort or retry without creating duplicate scan jobs.

## 24. Docker and Deployment Topology

### Local Docker Compose

Remove the PostgreSQL service and `postgres_data` volume. Keep:

```text
redis
qdrant
api
worker
```

The API and worker connect over TLS to Supabase PostgreSQL and Storage. For fully offline tests, use test doubles or a separate local Supabase setup, but do not make local Supabase a prerequisite for the first beginner-friendly implementation.

### Production

Recommended simple deployment:

- Supabase: Auth, PostgreSQL, Storage.
- Railway or Render: FastAPI and Celery worker from the same image.
- Managed Redis with a normal TLS Redis connection supported by Celery.
- Qdrant Cloud or a private Qdrant container/service.
- Groq managed API.

Place services in nearby regions to reduce database, Storage, and RAG latency. API and worker must use private networking for Redis and Qdrant when the platform supports it.

### Health checks

`GET /health` reports process health without exposing secrets. `GET /ready` may check database, Redis, and Qdrant with short timeouts. A Supabase Storage outage should degrade readiness for scan/report creation but should not leak internal endpoint details.

## 25. Security Requirements

### Authentication

- Email verification enabled before production access.
- Strong Supabase password policy and rate limits configured.
- Asymmetric JWT signing keys preferred so FastAPI can verify with JWKS.
- Issuer, audience, expiration, and subject validated.
- MFA can be added later for admin/owner actions.

### Authorization

- Workspace membership checked on every scan, finding, report, export, and WebSocket request.
- Roles read from database membership, not `user_metadata`.
- Object paths derived from authorized database records.
- RLS enabled on all public tenant tables and Storage objects.

### Data protection

- PostgreSQL and Storage connections use TLS.
- Both buckets are private.
- Signed report URLs expire quickly.
- Source artifacts are deleted after the recovery window.
- Logs redact access tokens, cookies, service keys, database URLs, and source secrets.
- Findings containing source snippets are treated as confidential tenant data.

### External calls

- Groq, NVD, Git hosts, and Qdrant calls have timeouts and bounded retries.
- Git URL validation blocks localhost, link-local, private network, and cloud metadata endpoints.
- No automatic fallback that disables TLS verification.

### Operational safety

- Database owner credentials used only by migrations.
- Service role key used only by server-side Storage helpers.
- Scanner sandbox has no platform credentials.
- Storage deletion and database deletion use an idempotent cleanup task because they cannot share one transaction.

## 26. Testing Strategy

### Unit tests

- JWT claim validation: valid, expired, wrong issuer, wrong audience, unknown key ID.
- Workspace role checks for viewer, analyst, admin, owner, and non-member.
- Canonical Storage path creation and path traversal rejection.
- Scan state transition rules and idempotent start.
- Artifact size, MIME, checksum, and object metadata validation.
- Existing ingestion, scanner, RAG, agent, and report tests.

### Database integration tests

- Alembic upgrade from an empty Supabase-compatible PostgreSQL database.
- Foreign keys to `auth.users`.
- RLS isolation between two users and two workspaces.
- Index use for workspace list and finding filter queries.
- Cascade behavior for scans, findings, violations, and report metadata.

### Storage integration tests

- Non-member cannot upload, read, update, or delete an object.
- Analyst can upload only to an authorized pending scan path.
- Viewer cannot upload scan input.
- Report bucket is private.
- Signed URL expires and cannot be reused after expiry.
- Object cleanup is retryable.

### End-to-end tests

1. Sign up and verify email.
2. Bootstrap profile and workspace.
3. Create scan.
4. Upload a vulnerable ZIP with resumable upload.
5. Start scan and observe polling/WebSocket progress.
6. Verify findings and compliance mappings.
7. Generate PDF.
8. Download through an authorized short-lived URL.
9. Confirm another user cannot access the scan or report.
10. Delete scan and verify database/object cleanup.

## 27. Part-by-Part Compatibility Map

| Original part      | Preserved work                                                         | Supabase change                                                                                    |
| ------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Part 1: Foundation | FastAPI, config, SQLAlchemy, Alembic, schemas, Redis, Qdrant, health   | Remove local PostgreSQL; replace `users` with profiles/workspaces; add Supabase settings           |
| Part 2: RAG        | Embedder, Qdrant client, chunkers, retriever, seed/sync, framework API | No architecture change                                                                             |
| Part 3: Ingestion  | ZIP/Git/YAML/log parsing and source collector                          | Input comes from private Storage; 50 MB upload is resumable; worker downloads to temp              |
| Part 4: Scanners   | All scanners, deduplication, normalization, timeouts                   | Run against Storage-sourced temp content in credential-free sandbox                                |
| Part 5: Agent      | Qdrant retrieval, Groq chains, CVSS, remediation, summary              | Workspace-scoped persistence and stricter data minimization                                        |
| Part 6: Reports    | Jinja2, charts, WeasyPrint, CSV/JSON                                   | Replace boto3/S3 uploader with private Supabase Storage; never persist signed URLs                 |
| Part 7: Celery     | Redis broker/backend, scan/report tasks, progress, retries             | Task payload contains IDs only; durable state remains in Supabase PostgreSQL                       |
| Part 8: API/Auth   | Protected REST API, rate limits, WebSocket, React Query integration    | Supabase owns credential flows; FastAPI verifies Supabase JWT and enforces workspace authorization |

## 28. Required Repository Changes

### Remove or replace

- Remove `postgres` from `threatlens/docker-compose.yml`.
- Remove `postgres_data` volume and API/worker dependency on local PostgreSQL health.
- Replace `app/models/user.py` with `profile.py` and workspace models.
- Replace `scans.user_id` with `workspace_id` and `created_by`.
- Replace report `pdf_url`, `signed_url`, and `expires_at` with stable Storage metadata.
- Remove S3 settings from `config.py`, Compose, and `.env.example`.
- Remove `boto3` after the Supabase Storage client is implemented.
- Remove `passlib[bcrypt]` after custom password endpoints are removed.
- Remove the application JWT signing `SECRET_KEY` if it has no other purpose.
- Replace localStorage token code in the frontend API/auth modules.

### Add

- Supabase frontend SDK.
- Server-side Storage client or a narrow HTTP client wrapper.
- JWT/JWKS verifier.
- Profile, workspace, membership, artifact, and audit models.
- RLS and Storage policies in Alembic.
- Upload create/start split and resumable client.
- Storage cleanup task.
- Cross-tenant authorization tests.

Dependency versions should be selected and pinned during implementation after checking compatibility with the existing Python and React versions. Do not add both a broad Supabase Python SDK and custom wrappers unless both are demonstrably needed.

## 29. Implementation Order

### Phase 0: Safety and project setup

- Create development Supabase project.
- Rotate any exposed credentials.
- Configure Auth URLs and email verification.
- Record project URL, publishable key, JWKS URL, database URLs, and service role key in local/deployment secret stores.

### Phase 1: Database foundation

- Add profiles, workspaces, memberships, artifact, report metadata, and audit schema.
- Migrate scan ownership.
- Add indexes, checks, grants, RLS, and Storage policies.
- Connect SQLAlchemy/Alembic to Supabase and run integration tests.

### Phase 2: Authentication

- Add `supabase.ts` and frontend Auth flow.
- Add FastAPI JWKS verification and typed current-user dependency.
- Add bootstrap/me endpoints and workspace authorization helpers.
- Protect existing APIs and clear private caches on logout.

### Phase 3: Storage and ingestion

- Create private buckets.
- Implement canonical path builder and artifact table.
- Implement create/upload/start flow with resumable uploads.
- Update worker to download from Storage and clean temporary files.

### Phase 4: Reports

- Replace S3/R2 uploader.
- Upload PDFs to private report bucket.
- Generate short-lived URLs only in authorized download endpoint.
- Add cleanup and retry handling.

### Phase 5: Pipeline completion

- Complete scanners, LangChain mapping, Celery orchestration, progress, and WebSocket authorization.
- Replace remaining frontend mocks route by route.
- Run full cross-tenant E2E tests.

### Phase 6: Deployment hardening

- Use managed Redis and protected Qdrant.
- Apply conservative database pools.
- Configure monitoring, backups, retention, rate limiting, and alerting.
- Verify no AWS/S3 variables or dependencies remain.

## 30. Acceptance Criteria

- [ ] Supabase Auth is the only user credential system.
- [ ] FastAPI issues no login JWT and stores no password hash.
- [ ] Every protected FastAPI route validates a Supabase JWT.
- [ ] Every tenant resource is authorized by workspace membership.
- [ ] Supabase PostgreSQL stores all durable application state.
- [ ] No local PostgreSQL service is required by Docker Compose.
- [ ] Both Storage buckets are private and protected by RLS.
- [ ] A 50 MB scan input can upload resumably without passing through FastAPI memory.
- [ ] Scan workers load object paths from PostgreSQL, not untrusted task payloads.
- [ ] Scanner sandboxes receive no infrastructure credentials.
- [ ] Reports are stored in Supabase Storage and downloaded by short-lived signed URL.
- [ ] Signed URLs are not persisted.
- [ ] Celery/Redis and Qdrant continue to satisfy Parts 2, 5, and 7.
- [ ] Cross-tenant tests prove one workspace cannot access another workspace's scans, findings, objects, or reports.
- [ ] AWS, S3, R2, boto3, custom password hashing, and custom JWT signing are absent from the final runtime.

## 31. Architecture Alternatives Considered

| Option                                                 | Beginner operations |    Rework |                                     Pipeline fit | Decision             |
| ------------------------------------------------------ | ------------------: | --------: | -----------------------------------------------: | -------------------- |
| Supabase Auth/Postgres/Storage + FastAPI/Celery/Qdrant |       Low to medium |    Medium |                                        Excellent | Recommended          |
| Supabase plus pgvector, no Qdrant                      |       Low to medium |      High |                             Good after benchmark | Revisit later        |
| Supabase Edge Functions for all backend work           |              Medium | Very high |                   Poor for scanners and PDF jobs | Reject               |
| Current Docker PostgreSQL + custom JWT + S3/R2         |                High |       Low |               Works but harder to secure/operate | Replace              |
| Supabase Data API directly from React for all app data |       Low initially |    Medium | Weak central business boundary for this pipeline | Reject for core data |

The recommended hybrid is the smallest change that removes the difficult managed infrastructure without discarding completed backend work.

## 32. Official Supabase References

- [Auth architecture](https://supabase.com/docs/guides/auth/architecture)
- [JSON Web Tokens](https://supabase.com/docs/guides/auth/jwts)
- [Python `get_claims`](https://supabase.com/docs/reference/python/auth-getclaims)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Storage overview](https://supabase.com/docs/guides/storage)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Serving private downloads](https://supabase.com/docs/guides/storage/serving/downloads)
- [Standard and resumable uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Vector columns](https://supabase.com/docs/guides/ai/vector-columns)
- [Vector indexes](https://supabase.com/docs/guides/ai/vector-indexes)

## 33. Final Architecture Rule

Supabase manages identity, relational persistence, and private object storage. FastAPI owns business authorization and API contracts. Celery owns long-running orchestration. Redis owns temporary queue state. Qdrant owns compliance retrieval. Scanner sandboxes own untrusted analysis. No component should silently take over another component's responsibility.
