# ThreatLens — AI Implementation Prompts

> **What is this file?**  
> This file contains **9 ready-to-use prompts** — one project-context prompt plus one prompt for each of the 8 Parts — that you copy-paste to an AI coding assistant (Copilot, Gemini, Claude, ChatGPT, Cursor, etc.) to implement the ThreatLens backend step by step.
>
> **How to use:**
>
> 1. Start with **Prompt 0** (Project Setup) — paste it once at the beginning
> 2. Then paste **Prompt 1** to build Part 1
> 3. After Part 1 is verified, paste **Prompt 2** for Part 2
> 4. Continue sequentially: 3 → 4 → 5 → 6 → 7 → 8
> 5. Never skip a part — each builds on the previous

## Mandatory Supabase Architecture Override

Before using any prompt in this file, read:

- `copilot-instructions.md`
- `plan/Supabase-Backend.md`

These two files are the architecture authority. They override conflicting instructions in older Part, Workflow, backend-plan, and frontend-connection documents.

The required platform decisions are:

- Supabase Auth owns signup, signin, password reset, session refresh, and OAuth.
- Supabase PostgreSQL stores durable application data through SQLAlchemy and Alembic.
- Supabase Storage uses private `scan-inputs` and `audit-reports` buckets.
- FastAPI verifies Supabase access tokens through JWKS and owns business authorization.
- Every scan, finding, report, export, object, and progress stream is scoped to a workspace.
- Celery/Redis, Qdrant, scanners, Groq/LangChain, and WeasyPrint remain unchanged.
- Signed report URLs are generated after authorization and are never stored.
- Scanner subprocesses receive no database, Redis, Supabase, Groq, or Qdrant credentials.

When an older reference file disagrees with these rules, follow this section and `plan/Supabase-Backend.md`.

---

## Prompt Engineering Principles Used

This file follows proven prompt engineering best practices:

| Principle            | How Applied                                                                     |
| -------------------- | ------------------------------------------------------------------------------- |
| **Role** (RTCF)      | Every prompt assigns a specific expert role to the AI                           |
| **Context** (RTCF)   | Every prompt includes the tech stack, project structure, and current state      |
| **Task** (RTCF)      | Every prompt has a numbered task list with exact deliverables                   |
| **Format** (RTCF)    | Every prompt specifies output format, file paths, and code style                |
| **Delimiters**       | Uses `### CONTEXT`, `### TASK`, `### CONSTRAINTS` sections to separate concerns |
| **Few-Shot**         | Includes example code patterns from the Part files for consistency              |
| **Chain-of-Thought** | Tasks are decomposed into sequential, dependent subtasks                        |
| **Constraint-Based** | Explicitly states what to do AND what NOT to do                                 |
| **Verification**     | Every prompt ends with a test checklist so nothing is assumed                   |
| **Recency Effect**   | Critical constraints are restated at the end of each prompt                     |

---

## Prompt 0 — Project Context (Paste This First, Only Once)

> **When to use:** At the very start of a new AI session, before any implementation prompt. This establishes the project identity, tech stack, and folder structure in the AI's context.

```
### ROLE
You are a Senior Full-Stack Engineer specializing in Python/FastAPI backends and React/TypeScript frontends. You write clean, production-ready, secure code. You follow existing project patterns and never introduce unnecessary dependencies.

### PROJECT: ThreatLens
ThreatLens is an LLM-Agentic Compliance & Threat Modeling Engine.
It accepts codebases (ZIP/Git), architecture YAML, and server logs, runs static analysis (Semgrep, Bandit, Trufflehog) + LLM deep review (Groq/Llama 3 70B), maps every vulnerability to 5 compliance frameworks (GDPR, SOC 2, ISO 27001, PCI DSS v4, NIST CSF 2.0) using RAG, and generates PDF audit reports.

### TECH STACK
- API: FastAPI + Uvicorn (Python 3.11)
- LLM: Groq API (Llama 3 70B) via LangChain
- Vector Store: Qdrant (384-dim, all-MiniLM-L6-v2 embeddings)
- Task Queue: Celery + Redis
- Authentication: Supabase Auth; FastAPI verifies JWTs through Supabase JWKS
- Database: Supabase PostgreSQL + SQLAlchemy 2.x + Alembic
- PDF: WeasyPrint + Jinja2 + matplotlib
- Storage: Supabase Storage with private buckets
- Frontend: TanStack Start (React 18 + TypeScript + Vite + TailwindCSS)
- Frontend State: TanStack React Query v5

### BACKEND STRUCTURE (to create inside project root as `threatlens/`)
threatlens/
├── app/
│   ├── main.py, config.py, database.py
│   ├── auth/ (jwt_verifier, dependencies, permissions)
│   ├── models/ (profile, workspace, scan, scan_artifact, finding, compliance_violation, report, audit_event)
│   ├── schemas/ (scan, finding, report)
│   ├── api/ (scans, reports, frameworks, export, auth, ws)
│   ├── storage/ (client, paths, lifecycle)
│   ├── ingestion/ (code_extractor, arch_parser, log_parser)
│   ├── scanners/ (semgrep, bandit, trufflehog, dependency_audit, log_anomaly, llm_code_reviewer)
│   ├── rag/ (embedder, qdrant_client, retriever, chunkers/)
│   ├── agent/ (compliance_mapper, cvss_scorer, remediation_planner, summary_writer, prompts/)
│   ├── report/ (generator, templates/)
│   └── tasks/ (celery_app, scan_task, report_task)
├── scripts/ (seed_rag, sync_nvd)
├── tests/
├── alembic/
├── docker-compose.yml, Dockerfile, requirements.txt, .env.example

### EXISTING FRONTEND STRUCTURE (already exists, do NOT recreate)
src/
├── routes/ (index.tsx, _app/dashboard.tsx, _app/new-scan.tsx, _app/findings.tsx, _app/reports.tsx, _app/reports.$reportId.tsx)
├── components/brutal/ (AppShell, BrutalButton, BrutalBadge, ThemeToggle)
├── components/ui/ (53 components including SeverityBadge, DataTable, CoverageBar, CodePanel, Progress, PipelineStep)
├── hooks/ (use-mobile.tsx)
├── lib/ (mock-data.ts, api/example.functions.ts, utils.ts)
└── styles.css

The frontend currently uses mock data from `src/lib/mock-data.ts`. Each Part will progressively replace mock imports with live API calls.

### IMPLEMENTATION RULES
1. Follow Part files exactly — do not add features not described
2. Use async/await everywhere in FastAPI (async def for endpoints)
3. All secrets via environment variables (pydantic-settings)
4. Type hints on every function (Python) and strict TypeScript
5. Error handling with try/except on every external call
6. Never commit secrets to code
7. Test each file after creating it before moving to the next
8. Frontend changes: replace mock imports with API hooks progressively
9. `plan/Supabase-Backend.md` overrides all older database, authentication, upload, storage, ownership, and deployment instructions
10. Use workspace-scoped authorization and RLS; never rely on user-provided workspace or object paths
11. Use conservative Supabase connection pools and separate runtime/migration database roles

### REFERENCE DOCUMENTATION (in .github'/Backend/ folder)
- copilot-instructions.md — Master execution guide (BUILD→TEST→SECURE→OPTIMIZE→CONNECT lifecycle)
- Part-01 through Part-08 — Detailed file specs per Part
- plan/Workflow-01 through Workflow-06 — Step-by-step execution guides
- Backend-Frontend-Connect.md — Frontend↔Backend wiring guide with TypeScript code
- plan/Backend.md — Original full architecture specification
- plan/Supabase-Backend.md — Mandatory Supabase target architecture and conflict authority

Acknowledge this context and wait for my next instruction.
```

---

## Prompt 1 — Part 1: Foundation Setup

> **When to use:** After Prompt 0 is acknowledged. This builds the entire project skeleton.

```
### TASK: Implement Part 1 — Foundation Setup

Read the following reference files before starting:
- @Part-01-Foundation-Setup.md (file specs and implementation details)
- @plan/Workflow-01-Environment-Setup.md (step-by-step commands)
- @Backend-Frontend-Connect.md Section 5 (frontend connection)
- @plan/Supabase-Backend.md (mandatory architecture override)

### DELIVERABLES (create all files in order)

**0. Supabase Development Project**
- Create/use a non-production Supabase project for development
- Configure frontend URL and permitted Auth redirect URLs
- Enable email verification and a strong password policy
- Prefer asymmetric Auth signing keys so FastAPI can verify through JWKS
- Obtain placeholder names for project URL, publishable key, service role key, direct/session database connections, issuer, audience, and JWKS URL
- Keep real values in local/deployment secret stores, never in committed files or AI prompts

**1. Docker Services**
Create `threatlens/docker-compose.yml` with:
- Redis 7 (port 6379)
- Qdrant (ports 6333, 6334)
- FastAPI API service
- Celery worker service
- Named volumes for Redis and Qdrant only
- Health checks for each service
- Do not create a local PostgreSQL service; API and worker connect to Supabase PostgreSQL over TLS

**2. Dockerfile**
Create `threatlens/Dockerfile`:
- Base: python:3.11-slim
- Install system deps for WeasyPrint (libpango, libcairo)
- Copy requirements.txt, install deps
- Copy app code, expose port 8000
- CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000

**3. Dependencies**
Create `threatlens/requirements.txt` with ALL deps:
fastapi, uvicorn[standard], sqlalchemy[asyncio], asyncpg, psycopg2-binary, alembic, pydantic, pydantic-settings, celery[redis], redis, qdrant-client, sentence-transformers, langchain, langchain-groq, langchain-community, weasyprint, jinja2, matplotlib, supabase, PyJWT[crypto], slowapi, tenacity, semgrep, bandit, pip-audit, scikit-learn, orjson, httpx, pytest, pytest-asyncio

**4. Environment**
Create `threatlens/.env.example` with:
- Runtime and migration connections: DATABASE_URL, MIGRATION_DATABASE_URL
- Supabase: SUPABASE_URL, SUPABASE_JWKS_URL, SUPABASE_JWT_ISSUER, SUPABASE_JWT_AUDIENCE, SUPABASE_SERVICE_ROLE_KEY
- Private buckets: SUPABASE_SCAN_BUCKET=scan-inputs, SUPABASE_REPORT_BUCKET=audit-reports
- Storage controls: SIGNED_URL_TTL_SECONDS=300, SOURCE_RETENTION_HOURS=24, MAX_FILE_SIZE_MB=50
- Services: REDIS_URL, QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION, GROQ_API_KEY, NVD_API_KEY
- Application: CORS_ORIGINS, DEBUG, ENVIRONMENT

Never place SUPABASE_SERVICE_ROLE_KEY, database credentials, Redis credentials, Qdrant credentials, or GROQ_API_KEY in a `VITE_` variable.

**5. Config**
Create `threatlens/app/config.py` using pydantic-settings BaseSettings loading from .env

**6. Database**
Create `threatlens/app/database.py` with SQLAlchemy async engine, async session factory, Base declarative base.
Use Supabase PostgreSQL over TLS. Start with pool_size=5, max_overflow=5, pool_pre_ping=True, and pool_recycle=1800. The runtime API/worker connection must be separate from the owner connection used by Alembic.

**7. ORM Models** (create each as separate file)
- `app/models/profile.py` — Profile: UUID PK/FK to Supabase auth.users.id, display_name, avatar_url, created_at, updated_at; never store passwords
- `app/models/workspace.py` — Workspace and WorkspaceMember with owner/admin/analyst/viewer roles
- `app/models/scan.py` — Scan: UUID PK, workspace_id, created_by FK to auth.users, scan/source type, target_name, selected_frameworks, status, progress, finding_count, framework_scores, task/error fields, timestamps
- `app/models/scan_artifact.py` — ScanArtifact: scan_id, kind, bucket, object_path, original_filename, MIME type, size, SHA-256, verification status
- `app/models/finding.py` — Finding: UUID PK, scan_id FK, title, description, severity enum, cvss_score float, cvss_vector, cwe_id, cve_id, file_path, line_number, code_snippet text, source, remediation text, created_at
- `app/models/compliance_violation.py` — ComplianceViolation: UUID PK, finding_id FK, framework, control_id, control_title, violation_description, evidence, rag_chunk_ids JSON
- `app/models/report.py` — Report: UUID PK, scan_id FK, status, bucket, object_path, SHA-256, byte_size, version, generated_at, error_message; never persist a signed URL
- `app/models/audit_event.py` — Workspace-scoped security/business event metadata without secrets or source code
- `app/models/__init__.py` — Import all models

**8. Pydantic Schemas**
- `app/schemas/scan.py` — ScanCreate (scan_type, target_name, frameworks list, git_url optional), ScanResponse, ScanStatusResponse
- `app/schemas/finding.py` — FindingCreate, FindingResponse
- `app/schemas/report.py` — ReportResponse
- `app/schemas/auth.py` — AuthenticatedUser, ProfileResponse, WorkspaceMembershipResponse
- `app/schemas/__init__.py`

**9. Supabase Auth and Authorization Foundation**
- `app/auth/jwt_verifier.py` — Verify Supabase JWT signature with cached JWKS; validate algorithm, issuer, audience, expiration, and subject
- `app/auth/dependencies.py` — Typed FastAPI current-user dependency
- `app/auth/permissions.py` — Workspace membership and minimum-role checks
- `app/api/auth.py` — GET /api/v1/auth/me and idempotent POST /api/v1/auth/bootstrap; do not implement passwords or issue tokens

**10. Supabase Storage Foundation**
- `app/storage/client.py` — Server-only Storage operations using SUPABASE_SERVICE_ROLE_KEY
- `app/storage/paths.py` — Canonical workspace/scan/artifact/report path builders
- `app/storage/lifecycle.py` — Idempotent object cleanup helpers
- Prepare private `scan-inputs` and `audit-reports` buckets through reproducible setup/migrations

**11. Celery**
Create `app/tasks/celery_app.py`:
- Celery app with Redis broker and backend
- task_serializer = "json"
- result_expires = 3600
- task_track_started = True

**12. Alembic**
Set up Alembic for migrations:
- alembic.ini using MIGRATION_DATABASE_URL for DDL
- env.py importing Base and all models
- Generate the Supabase-compatible initial migration
- Create indexes for workspace and filter columns
- Enable RLS on public tenant tables
- Add workspace membership helper functions and RLS policies
- Add private Storage object policies
- Keep Alembic as the source of truth; do not duplicate schema changes manually in the Supabase Dashboard

**13. FastAPI Main App**
Create `app/main.py`:
- FastAPI instance with title, description, version
- CORS middleware allowing CORS_ORIGINS from config
- /health endpoint returning {"status": "healthy", "service": "threatlens"}
- Mount all API routers (stub for now)

**14. Project Scaffold**
Create all __init__.py files for: app/, auth/, storage/, models/, schemas/, api/, ingestion/, scanners/, rag/, rag/chunkers/, agent/, agent/prompts/, report/, tasks/

### FRONTEND CONNECTION (do after all backend files)
1. Add `VITE_API_URL=http://localhost:8000` to the frontend `.env` file
2. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY; no server-only variables
3. Create `src/lib/supabase.ts` — Browser client singleton
4. Create `src/lib/api/client.ts` — Base FastAPI client that obtains the current Supabase access token
5. Create `src/lib/api/types.ts` — TypeScript interfaces matching Pydantic schemas
6. Implement minimum signin/session support before the Part 3 private upload flow
7. Verify CORS: frontend fetch to /health returns 200

### CONSTRAINTS
- All models use UUID as primary key (import uuid, use uuid4 as default)
- All timestamps are timezone-aware UTC
- Use Mapped[] and mapped_column() syntax (SQLAlchemy 2.x style)
- Config class must use model_config = SettingsConfigDict(env_file=".env") (Pydantic v2)
- Do NOT use class Config — use model_config dict (Pydantic v2 style)
- Never create a custom users password table, password hash, or application JWT signing secret
- Supabase service role bypasses RLS and must remain server-only

### VERIFICATION CHECKLIST
After creating all files, verify:
- [ ] docker-compose up -d → Redis, Qdrant, API, and worker healthy; no PostgreSQL container
- [ ] alembic upgrade head → Supabase application tables, indexes, grants, and policies created
- [ ] uvicorn app.main:app --reload --port 8000 → Server starts
- [ ] GET http://localhost:8000/health → {"status": "healthy"}
- [ ] GET http://localhost:8000/docs → Swagger UI
- [ ] celery -A app.tasks.celery_app worker --loglevel=info → Worker connects
- [ ] Frontend fetch("http://localhost:8000/health") → No CORS errors
- [ ] Valid Supabase token reaches /api/v1/auth/me; missing/invalid token returns 401
- [ ] Two test users cannot read each other's workspace rows through RLS
- [ ] Private Storage buckets reject unauthorized reads and writes

### CRITICAL REMINDERS
- Use async SQLAlchemy (asyncpg driver, async session)
- No secrets in code — all via .env
- .env must be in .gitignore
- Supabase Auth is the only credential system
- Use separate runtime and migration database roles
- Pydantic v2 syntax (model_config, not class Config)
- SQLAlchemy 2.x syntax (Mapped[], mapped_column, not Column())
```

---

## Prompt 2 — Part 2: RAG Knowledge Base

> **When to use:** After Part 1 is verified (all checklist items pass).

````
### TASK: Implement Part 2 — RAG Knowledge Base

Read these reference files:
- @Part-02-RAG-Knowledge-Base.md
- @plan/Workflow-02-RAG-Pipeline.md
- @Backend-Frontend-Connect.md Section 6
- @plan/Supabase-Backend.md

### CURRENT STATE
Part 1 is complete. Supabase Auth/PostgreSQL/Storage are configured, Redis and Qdrant are running, FastAPI serves /health, the Celery worker connects, and the frontend Supabase/API clients exist.

### DELIVERABLES

**1. Embedder** (`app/rag/embedder.py`)
- Singleton SentenceTransformer("all-MiniLM-L6-v2") — lazy loaded
- encode_text(text: str) → list[float] (384 dimensions)
- encode_batch(texts: list[str]) → list[list[float]]

**2. Qdrant Client** (`app/rag/qdrant_client.py`)
- get_qdrant() → QdrantClient connection
- create_collection() → Create "compliance_knowledge" collection (384 dim, COSINE)
- upsert_chunks(chunks: list[dict]) → Batch upsert in groups of 100

**3. Chunkers** (create all 7 in `app/rag/chunkers/`)
For each framework, create a chunker function that returns list[dict]:
- `gdpr_chunker.py` — Chunk GDPR articles (Art.5, 25, 32, 33, 34, 35, 83 — key security/privacy articles)
- `soc2_chunker.py` — Chunk SOC 2 Trust Services Criteria (CC6.1–CC9.1)
- `iso27001_chunker.py` — Chunk ISO 27001 Annex A controls (A.5–A.8 series)
- `pci_chunker.py` — Chunk PCI DSS v4.0 requirements (Req 1–12)
- `nist_chunker.py` — Chunk NIST CSF 2.0 subcategories (GV, ID, PR, DE, RS, RC)
- `cve_chunker.py` — Fetch top CVEs from NVD API, chunk each
- `owasp_chunker.py` — Chunk OWASP Top 10 2021 categories (A01–A10)

Each chunk must return:
```python
{
    "text": "Art.32 — Security of processing\n\n<article text>",
    "metadata": {
        "framework": "GDPR",
        "control_id": "Art.32",
        "control_title": "Security of processing",
        "category": "Technical Measures",
        "severity_weight": 0.9
    }
}
````

**4. Retriever** (`app/rag/retriever.py`)

- retrieve_relevant_controls(finding_text: str, frameworks: list[str] | None = None, top_k: int = 10) → list[dict]
- Embeds the finding text, cosine searches Qdrant, optional framework metadata filter
- Returns control_id, control_title, text, score, framework for each result

**5. Seed Script** (`scripts/seed_rag.py`)

- Calls all 7 chunkers
- Embeds all chunk texts (batch)
- Upserts into Qdrant in batches of 100
- Prints total chunks seeded

**6. NVD Sync** (`scripts/sync_nvd.py`)

- Fetches latest CVEs from NVD API (last 30 days)
- Chunks and upserts to Qdrant

**7. Frameworks API** (`app/api/frameworks.py`)

- GET /api/v1/frameworks → Returns list of frameworks with id, name, version, chunks_indexed count
- Require a verified Supabase access token unless the endpoint is deliberately documented as public
- Register router in main.py

### FRONTEND CONNECTION

1. Create `src/lib/api/frameworks.ts` with fetchFrameworks() function
2. Create `src/hooks/useFrameworks.ts` with TanStack Query hook (staleTime: 5 min)
3. In `src/routes/_app/new-scan.tsx`: replace `import { FRAMEWORKS } from "@/lib/mock-data"` with `useFrameworks()` hook

### CONSTRAINTS

- Lazy-load SentenceTransformer model (don't load on import)
- Use functools.lru_cache or manual singleton for encoder
- Batch upsert to Qdrant (groups of 100, not one-by-one)
- Chunkers should work even if PDF files don't exist — use hardcoded compliance text for the key controls
- OWASP chunker must be included (7 chunkers total, not 6)
- Use Qdrant API-key authentication in production and never expose the key to the frontend

### VERIFICATION CHECKLIST

- [ ] python scripts/seed_rag.py → Seeds 500+ chunks without error
- [ ] Qdrant dashboard (http://localhost:6333/dashboard) shows compliance_knowledge collection
- [ ] retrieve_relevant_controls("hardcoded password in config") → Returns GDPR Art.32, ISO A.8.5, PCI Req.8.3.2
- [ ] retrieve_relevant_controls("SQL injection", frameworks=["PCI_DSS"]) → Returns only PCI results
- [ ] GET /api/v1/frameworks → Returns 5 frameworks with chunk counts
- [ ] Frontend new-scan page → Framework checkboxes populate from API

```

---

## Prompt 3 — Part 3: Input Ingestion Layer

> **When to use:** After Part 2 is verified.

```

### TASK: Implement Part 3 — Input Ingestion Layer

Read these reference files:

- @Part-03-Input-Ingestion-Layer.md
- @plan/Workflow-03-Ingestion-Scanners.md (Phase A)
- @Backend-Frontend-Connect.md Section 7
- @plan/Supabase-Backend.md Sections 14-15

### CURRENT STATE

Parts 1–2 complete. Supabase Auth/PostgreSQL/Storage work, RAG is seeded, framework API works, and the frontend has an authenticated Supabase session.

### DELIVERABLES

**1. Code Extractor** (`app/ingestion/code_extractor.py`)

- extract_from_zip(zip_path: str) → str (temp dir path)
  - ZIP bomb protection: reject if extracted > 100x compressed size
  - Path traversal: sanitize paths, reject ../
  - Extract to tempfile.mkdtemp()
- extract_from_git(git_url: str) → str (temp dir path)
  - Only allow https:// URLs, block file:// and ssh://
  - Shallow clone: git clone --depth=1
  - subprocess with 120s timeout
- collect_source_files(repo_path: str) → list[dict]
  - Walk directory tree, collect files with supported extensions
  - Skip excluded dirs (node_modules, .git, venv, **pycache**, dist, build)
  - Return: {"path": relative, "content": str, "language": ext, "size_bytes": int}
  - Max 1000 files cap

Supported extensions: .py, .js, .ts, .jsx, .tsx, .java, .go, .rb, .php, .cs, .cpp, .c, .rs, .yaml, .yml, .json, .env, .toml, .cfg, .ini, .sh, .dockerfile, .tf

**2. Architecture Parser** (`app/ingestion/arch_parser.py`)

- parse_architecture(file_content: str, file_type: str) → dict
- Handles YAML (yaml.safe_load) and JSON
- Returns: {"services": [], "exposed_ports": [], "databases": [], "network_config": {}}

**3. Log Parser** (`app/ingestion/log_parser.py`)

- parse_log_file(content: str) → list[dict]
- Handles Apache/Nginx, JSON logs, syslog
- Returns structured entries with: timestamp, level, source_ip, method, path, status, message

**4. Private Storage Upload Contract** (`app/storage/`, `app/models/scan_artifact.py`)

- Canonical path: scan-inputs/{workspace_id}/{scan_id}/{artifact_id}/{sanitized_filename}
- Browser uploads directly to the private `scan-inputs` bucket with its Supabase session
- Use resumable TUS upload for the existing 50 MB limit
- Store stable object metadata: bucket, object_path, MIME type, byte size, SHA-256, and status
- Storage RLS allows only workspace owner/admin/analyst roles and the exact authorized path
- Never accept an arbitrary complete object path from the browser

**5. Scan API** (`app/api/scans.py`)

- POST /api/v1/scans — Require Supabase JWT and analyst+ workspace role
  - Accept JSON metadata: workspace_id, scan_type, target_name, frameworks, filename/content_type/size for uploads, or a validated HTTPS git_url
  - For an upload: create Scan + ScanArtifact in one transaction and return scan_id, artifact_id, exact object_path, and upload requirements
  - For Git: store only non-secret source metadata and create a queued stub; never store Git credentials
- POST /api/v1/scans/{scan_id}/start
  - Authorize workspace membership and analyst+ role
  - Load the canonical artifact from PostgreSQL
  - Verify the private Storage object exists and validate path, size, MIME type, checksum metadata, and scan state
  - Atomically move uploading → queued and dispatch a Celery stub
- GET /api/v1/scans — Return a paginated list scoped to authorized workspace membership
- GET /api/v1/scans/{scan_id} — Return status, progress, finding_count, and sanitized error state
- DELETE /api/v1/scans/{scan_id} — Require admin+ and schedule idempotent object cleanup
- Register router in main.py

### FRONTEND CONNECTION

1. Create `src/lib/api/scans.ts` with createScan(), startScan(), createGitScan(), fetchScans(), fetchScan(), deleteScan()
2. Create `src/hooks/useScans.ts` with useScans() and useCreateScan() hooks
3. Add the justified resumable upload client and send the file directly to the exact private Storage path
4. In `new-scan.tsx`: create scan → resumable upload → start scan; show upload progress and retry without duplicate jobs
5. Wire Git URL input to the authenticated scan API without a Storage upload
6. In `dashboard.tsx`: replace `SCANS` import with useScans() hook and include workspaceId in query keys

### CONSTRAINTS

- Always use tempfile.mkdtemp() for temp directories
- Always cleanup temp dirs in finally block
- Validate file size in the browser, Storage metadata verification, and worker; reject objects > MAX_FILE_SIZE_MB
- Git URLs: validate with regex, only https:// allowed
- ZIP extraction: stream (don't load entire ZIP to memory)
- All ingestion functions must be sync (they'll run in Celery worker, not async endpoint)
- Block Git redirects/resolution to localhost, link-local, private network, and cloud metadata addresses
- Celery payloads contain IDs only, never temporary paths, user-provided object paths, or credentials

### VERIFICATION CHECKLIST

- [ ] Authorized resumable upload reaches the exact private Storage path
- [ ] Unauthorized user and viewer role cannot upload or start a scan
- [ ] Start endpoint rejects wrong path, oversized object, invalid MIME type, checksum mismatch, and duplicate start
- [ ] Worker-side test downloads the authoritative object to a temp directory, extracts it, and cleans up
- [ ] Git clone works with a public test repo URL
- [ ] collect_source_files skips node_modules and .git dirs
- [ ] YAML architecture parser extracts services/ports
- [ ] Log parser handles Apache and JSON log formats
- [ ] POST /api/v1/scans for a file returns scan_id, artifact_id, and exact object_path
- [ ] POST /api/v1/scans with git_url returns scan_id without storing credentials
- [ ] POST /api/v1/scans/{id}/start verifies the object and enqueues once
- [ ] GET /api/v1/scans returns only authorized workspace scans
- [ ] GET /api/v1/scans/{id} returns status object
- [ ] A second workspace cannot read, start, or delete the scan
- [ ] Frontend upload triggers backend, navigates to progress view
- [ ] Dashboard shows real scan list from API

```

---

## Prompt 4 — Part 4: Scanners

> **When to use:** After Part 3 is verified.

```

### TASK: Implement Part 4 — Security Scanners

Read these reference files:

- @Part-04-Scanners.md
- @plan/Workflow-03-Ingestion-Scanners.md (Phase B, C)
- @Backend-Frontend-Connect.md Section 8
- @plan/Supabase-Backend.md Section 18

### CURRENT STATE

Parts 1–3 complete. Ingestion works for private Storage artifacts, Git, YAML, and logs. Authenticated workspace users can create and start scans.

### DELIVERABLES

**1. Semgrep Runner** (`app/scanners/semgrep_runner.py`)

- run_semgrep(repo_path: str) → list[FindingCreate]
- Rulesets: p/owasp-top-ten, p/python, p/javascript, p/secrets, p/jwt, p/sql-injection, p/xss
- subprocess.run with 300s timeout, parse JSON output
- Severity mapping: ERROR→critical, WARNING→high, INFO→medium

**2. Bandit Runner** (`app/scanners/bandit_runner.py`)

- run_bandit(repo_path: str) → list[FindingCreate]
- Runs: bandit -r <path> -f json -q
- Severity mapping: HIGH+HIGH→critical, HIGH+\*→high, MEDIUM→medium, LOW→low

**3. Trufflehog Runner** (`app/scanners/trufflehog_runner.py`)

- run_trufflehog(repo_path: str) → list[FindingCreate]
- All findings are critical severity, CWE-798

**4. Dependency Audit** (`app/scanners/dependency_audit.py`)

- run_pip_audit(repo_path: str) → list[FindingCreate]
- run_npm_audit(repo_path: str) → list[FindingCreate]
- Detect requirements.txt or package-lock.json, run appropriate tool

**5. Log Anomaly Detector** (`app/scanners/log_anomaly.py`)

- detect_log_anomalies(log_entries: list[dict]) → list[FindingCreate]
- Pattern detection: brute-force (>50 auth failures), SQL injection in URLs, unusual HTTP methods
- Optional: Isolation Forest anomaly scoring

**6. LLM Code Reviewer** (`app/scanners/llm_code_reviewer.py`)

- llm_review_file(file_path: str, content: str) → list[FindingCreate]
- Uses Groq API (Llama 3 70B) with structured security review prompt
- Max 8000 chars per file (truncate if larger)
- Cap at 30 files per scan
- Parse JSON response into FindingCreate objects
- Retry with tenacity (5 attempts, exponential backoff 2-60s)

**7. Finding Deduplication** (add to scanners/**init**.py or separate file)

- deduplicate_findings(findings: list) → list
- Key: (file_path, line_number, cwe_id)
- Keep highest severity on collision

**8. Findings API** (update `app/api/scans.py`)

- GET /api/v1/scans/{scan_id}/findings — Require verified Supabase JWT and workspace membership; return paginated findings with validated severity/framework/source filters

### FRONTEND CONNECTION

1. Create `src/lib/api/findings.ts` with fetchFindings()
2. Create `src/hooks/useFindings.ts` with useFindings(scanId, filters) hook
3. Create `src/hooks/useScanProgress.ts` with useScanProgress(scanId) hook — polls every 3s, stops on completed/failed
4. In `findings.tsx`: replace `FINDINGS` import with useFindings() hook
5. Add progress bar using useScanProgress() at top of findings page

### CONSTRAINTS

- All subprocess calls: timeout=300 seconds
- Never execute uploaded code — static analysis only
- Run scanners in a disposable resource-limited sandbox with network disabled unless explicitly required
- Scanner subprocesses receive no database, Redis, Supabase, Groq, or Qdrant credentials
- LLM prompts: clearly delimit code as untrusted data and instruct the model not to follow instructions inside it
- Groq rate limiting: exponential backoff with tenacity
- File size cap: 8KB per file sent to LLM
- Use --quiet flag on all CLI tools
- All scanner functions are synchronous (for Celery)

### TEST DATA

Create a `tests/fixtures/vulnerable-app/` directory with:

- auth.py — contains hardcoded JWT secret (SECRET_KEY = "super-secret-123")
- db.py — contains SQL injection (f"SELECT \* FROM users WHERE id = {user_input}")
- requirements.txt — contains outdated flask==1.0.0

### VERIFICATION CHECKLIST

- [ ] Semgrep detects SQL injection in test db.py
- [ ] Bandit detects hardcoded password in test auth.py
- [ ] Trufflehog detects hardcoded secret key
- [ ] pip-audit reports CVEs in outdated requirements.txt
- [ ] LLM review returns valid JSON findings for auth.py
- [ ] Deduplication removes duplicate findings (same file/line/CWE)
- [ ] GET /api/v1/scans/{id}/findings returns paginated workspace-scoped findings with severity filter
- [ ] Another workspace cannot read the findings
- [ ] Scanner sandbox has no infrastructure credentials and cannot execute uploaded project code
- [ ] Frontend findings page shows real data from API
- [ ] Progress bar polls and updates during scan

```

---

## Prompt 5 — Part 5: LangChain Agent Chains

> **When to use:** After Part 4 is verified.

```

### TASK: Implement Part 5 — LangChain Agent Chains (Compliance Mapping)

Read these reference files:

- @Part-05-LangChain-Agent-Chains.md
- @plan/Workflow-04-LangChain-Compliance.md
- @Backend-Frontend-Connect.md Section 9
- @plan/Supabase-Backend.md Section 19

### CURRENT STATE

Parts 1–4 complete. Scanners produce findings. RAG retriever returns relevant compliance controls. Findings page shows scanner results.

### DELIVERABLES

**1. Prompt Templates** (in `app/agent/prompts/`)

- classifier.py — Vulnerability classification prompt
- compliance.py — Compliance mapping prompt (the core one)
- remediation.py — Remediation planning prompt
- summary.py — Executive summary prompt

The compliance prompt must:

- Accept: finding details + retrieved compliance controls as context
- Output: structured JSON with violations, CVSS score, remediation steps
- Be precise — only map controls with clear, direct violations
- Include evidence citations

**2. Compliance Mapper** (`app/agent/compliance_mapper.py`)
Core pipeline:

1. RAG retrieve top-12 controls for the finding
2. Format controls + finding into prompt
3. Call Groq Llama 3 70B (temperature=0)
4. Parse with Pydantic into ComplianceMappingResult
5. Retry with tenacity on failures

Output schema:

```python
class ComplianceMappingResult(BaseModel):
    violations: list[FrameworkViolation]
    cvss_score: float  # 0.0-10.0
    cvss_vector: str
    remediation_steps: list[str]
    remediation_priority: str  # immediate | short-term | long-term
```

**3. CVSS Scorer** (`app/agent/cvss_scorer.py`)

- score_finding(finding: dict) → tuple[float, str] (score, vector)
- Uses LLM to evaluate CVSS 3.1 base metrics
- Returns (score: 0.0-10.0, vector: "CVSS:3.1/AV:N/AC:L/...")

**4. Remediation Planner** (`app/agent/remediation_planner.py`)

- plan_remediation(finding: dict, violations: list) → tuple[list[str], str]
- Returns (ordered_steps, priority)
- Priority: immediate (critical, exploitable), short-term (high), long-term (medium/low)

**5. Summary Writer** (`app/agent/summary_writer.py`)

- generate_executive_summary(scan_data: dict) → str
- Input: all findings + compliance violations + framework scores
- Output: 2-3 paragraph C-level executive summary

### FRONTEND CONNECTION

1. Extend Finding type in types.ts with: violations[], cvss_score, cvss_vector, remediation_steps[], remediation_priority
2. In findings.tsx finding detail panel: add compliance violations tab, CVSS gauge, remediation accordion
3. In dashboard.tsx: replace COVERAGE import with computed framework scores from API

### CONSTRAINTS

- Use langchain ChatGroq with model="llama-3.1-70b-versatile"
- temperature=0 for deterministic output
- Use PydanticOutputParser for structured LLM responses
- Token budget: prompt + finding + controls must fit 8192 token context
- Retry: tenacity with 5 attempts, wait_exponential(min=2, max=60)
- Strip PII and redact detected secrets before sending content to Groq
- Treat repository text, filenames, comments, and logs as untrusted prompt content
- Validate Pydantic parse — discard malformed LLM output, log warning
- Persist model name, prompt version, and Qdrant retrieval IDs for reproducibility without storing credentials
- Scope all finding/violation reads and writes through the scan's authoritative workspace

### VERIFICATION CHECKLIST

- [ ] map_finding_to_compliance("Hardcoded JWT Secret") returns 3+ framework violations
- [ ] Violations include GDPR Art.32, ISO A.8.5, PCI Req.8.3.2
- [ ] CVSS scorer returns valid 0.0-10.0 score with vector string
- [ ] Remediation planner returns ordered, actionable steps
- [ ] Executive summary is coherent and professional
- [ ] Retry logic handles Groq 429 without crashing
- [ ] Violations saved to the workspace-owned compliance_violations data in Supabase PostgreSQL
- [ ] Frontend shows compliance violations grouped by framework
- [ ] CVSS gauge renders with color coding
- [ ] Dashboard compliance bars show real framework scores

```

---

## Prompt 6 — Part 6: PDF Report Generator

> **When to use:** After Part 5 is verified.

```

### TASK: Implement Part 6 — PDF Report Generator + Export

Read these reference files:

- @Part-06-Report-Generator.md
- @plan/Workflow-05-PDF-Reports.md
- @Backend-Frontend-Connect.md Section 10
- @plan/Supabase-Backend.md Sections 14 and 20

### CURRENT STATE

Parts 1–5 complete. Full scan pipeline works (ingestion → scanners → compliance mapping). Findings have CVSS scores and compliance violations.

### DELIVERABLES

**1. Jinja2 Templates** (in `app/report/templates/`)

- base.html — Master template: cover page (dark background, scan name, timestamp, ThreatLens branding), includes sub-templates, professional CSS styling
- executive_summary.html — Overall risk, key stats, LLM-generated summary paragraph
- compliance_section.html — Embedded bar chart (base64 PNG), per-framework breakdown table, top violated controls
- findings.html — Findings grouped by severity (critical→low), each with severity badge, file path, code snippet, framework tags, CVSS score, remediation

CSS: Inter font, severity color borders (critical=red, high=orange, medium=blue, low=green), page breaks between sections, alternating table rows

**2. PDF Generator** (`app/report/generator.py`)

- generate_compliance_chart(framework_scores: dict) → str (base64 PNG)
  - matplotlib horizontal bar chart, colors: red (<65), orange (65-80), green (>=80)
- generate_pdf_report(scan_data: dict) → bytes
  - Load Jinja2 templates, render HTML, WeasyPrint to PDF bytes
  - optimize_size=("fonts", "images")

**3. Supabase Report Storage** (`app/storage/client.py`, `app/storage/paths.py`)

- Upload PDFs to the private `audit-reports` bucket using the server-only Supabase client
- Canonical path: audit-reports/{workspace_id}/{scan_id}/{report_id}/threatlens-audit-v{version}.pdf
- Compute and persist bucket, object_path, SHA-256, byte_size, version, status, and generated_at
- Never persist a signed URL
- After FastAPI authorizes workspace membership, generate a signed download URL with SIGNED_URL_TTL_SECONDS (initially 300)
- No local report path is returned to the browser

**4. Report Celery Task** (`app/tasks/report_task.py`)

- generate_pdf_report_task(scan_id: str) — async Celery task
- Load workspace-owned scan data from Supabase PostgreSQL, generate PDF in a temporary directory, upload to the canonical private object path, save Report metadata, and clean temporary files in finally
- Make generation idempotent by (scan_id, version)

**5. API Endpoints**

- `app/api/reports.py`: POST /api/v1/scans/{scan_id}/reports → Require analyst+ workspace role, create queued report, return report_id/task state
- `app/api/reports.py`: GET /api/v1/reports/{report_id} → Return authorized report metadata/status
- `app/api/reports.py`: GET /api/v1/reports/{report_id}/download → Authorize viewer+ then return a fresh short-lived signed URL
- `app/api/export.py`: GET /api/v1/scans/{scan_id}/export.csv → Stream authorized CSV download
- `app/api/export.py`: GET /api/v1/scans/{scan_id}/export.json → Stream authorized JSON download
- Register routers in main.py

### FRONTEND CONNECTION

1. Create `src/lib/api/reports.ts` with generateReport(), getReportDownloadUrl(), exportFindingsCSV(), exportFindingsJSON()
2. In reports.tsx: replace REPORTS import, add "Generate Report" button, "Download PDF" button
3. In findings.tsx: add "Export CSV" button

### CONSTRAINTS

- PDF must not contain executable JavaScript
- CSV injection protection: prefix =, +, -, @ cells with single quote
- `audit-reports` bucket must be private and protected by Storage RLS
- Generate signed URLs only after workspace authorization; never store or log them
- Rate limit: max 1 concurrent report generation per workspace/user
- Use base64-embedded chart images (no external file deps)
- CSV encoding: UTF-8 BOM for Excel compatibility

### VERIFICATION CHECKLIST

- [ ] Jinja2 templates render valid HTML without errors
- [ ] Compliance chart generates with correct color coding
- [ ] WeasyPrint produces valid, openable PDF
- [ ] PDF has cover page, executive summary, compliance section, findings
- [ ] PDF page breaks are clean (no mid-card splits)
- [ ] PDF uploads to the canonical private Supabase Storage path
- [ ] Report row stores stable object metadata and no signed URL
- [ ] Authorized download endpoint returns a short-lived URL that expires
- [ ] Another workspace cannot read metadata or obtain a download URL
- [ ] CSV export has proper headers and escaped values
- [ ] JSON export returns clean, parseable data
- [ ] Frontend "Generate Report" button triggers generation
- [ ] Frontend "Download PDF" opens PDF in new browser tab
- [ ] Frontend "Export CSV" triggers browser file download

```

---

## Prompt 7 — Part 7: Celery Task Queue

> **When to use:** After Part 6 is verified.

```

### TASK: Implement Part 7 — Celery Full Scan Pipeline

Read these reference files:

- @Part-07-Celery-Task-Queue.md
- @plan/Workflow-06-Full-Integration-Deploy.md (Phase A)
- @Backend-Frontend-Connect.md Section 11
- @plan/Supabase-Backend.md Sections 15-16

### CURRENT STATE

Parts 1–6 complete. Supabase owns identity, durable data, and private objects. Ingestion, scanners, compliance mapping, and PDF generation work individually but are not wired into one automated pipeline.

### DELIVERABLES

**1. Full Scan Task** (`app/tasks/scan_task.py`)
Wire the complete pipeline as a Celery task:

```python
@celery_app.task(bind=True, max_retries=3)
def run_full_scan(self, scan_id: str):
    """
    Progress Timeline:
    0%  → 5%   : Validate input, create scan record
    5%  → 15%  : Extract/clone source code
    15% → 30%  : Semgrep static analysis
    30% → 40%  : Bandit Python analysis
    40% → 50%  : Trufflehog secret scan
    50% → 70%  : LLM deep code review (per file, up to 30 files)
    70% → 75%  : Deduplicate findings, save to DB
    75% → 95%  : Compliance mapping per finding (RAG → LLM)
    95% → 100% : Finalize, calculate framework scores
    """
```

Key implementation:

- Task payload contains scan_id only
- Atomically claim queued → running so duplicate starts/retries cannot execute the same scan concurrently
- Load workspace, source type, frameworks, and canonical artifact metadata from Supabase PostgreSQL
- For uploaded sources, download the authoritative private Storage object into a new temporary directory
- Update scan progress in DB at each stage
- Each scanner wrapped in individual try/except (one failing doesn't kill the scan)
- Temp directory cleanup in finally block
- On failure: set scan status to "failed", retry up to 3 times with 60s delay
- On success: set status to "completed", calculate framework_scores
- Persist durable status at stage boundaries; Redis progress is a temporary cache only
- Schedule source-object deletion after the configured recovery window

**2. Update Scan Start Flow** (in `app/api/scans.py`)

- After POST /api/v1/scans/{scan_id}/start verifies ownership and the Storage artifact, dispatch run_full_scan.delay(scan_id)
- Git scans also dispatch by scan_id; workers reload the validated URL from PostgreSQL
- Never pass a temporary path, arbitrary object path, source contents, frameworks, workspace, or credentials in the Celery message

**3. Celery Beat Schedule** (in `app/tasks/celery_app.py`)

```python
celery_app.conf.beat_schedule = {
    "sync-nvd-cves": {
        "task": "app.tasks.scan_task.sync_nvd_cves",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),
    },
}
```

**4. Progress Tracking**
Create a helper function:

```python
def update_scan_progress(db, scan_id: str, progress: int, finding_count: int = None):
    # Update scan.progress and optionally scan.finding_count
```

**5. Queue and Cleanup Design**

- Separate ingestion, static-scan, llm, report, and maintenance queues when worker capacity requires it
- Add an idempotent maintenance task for stale scans and orphaned/private Storage objects
- Use Redis locks only as an execution aid; PostgreSQL state transitions remain authoritative

### FRONTEND CONNECTION

1. Enhance progress bar in findings.tsx with phase labels (see Backend-Frontend-Connect.md Section 11)
2. Add live finding count display during scan
3. On completion: auto-fetch findings, enable report generation button
4. On failure: show error message with retry button

### CONSTRAINTS

- task_time_limit = 600 (10 min max)
- task_soft_time_limit = 540 (graceful 9 min warning)
- task_acks_late = True (crash recovery)
- result_expires = 3600
- JSON serializer only (not pickle)
- Redis password in production
- Progress updates at least every 5% for smooth UX
- Temp directory MUST be cleaned up in finally block
- Redis and Qdrant use protected private endpoints/API keys in production
- Worker may use server credentials, but scanner subprocesses/sandboxes receive none

### VERIFICATION CHECKLIST

- [ ] Celery worker starts and connects to Redis
- [ ] POST /api/v1/scans/{id}/start dispatches exactly one Celery task
- [ ] Queue payload contains scan_id only
- [ ] Worker reloads and authorizes the canonical source metadata from Supabase PostgreSQL
- [ ] Uploaded source downloads from private Storage and is removed from local temp storage
- [ ] Scan progress updates visible via GET /api/v1/scans/{id}
- [ ] Full scan completes: status="completed", progress=100
- [ ] Failed scan retries up to 3 times with 60s delay
- [ ] Temp directories cleaned up after completion
- [ ] Findings persisted in Supabase PostgreSQL
- [ ] Compliance violations linked to findings
- [ ] Duplicate delivery/retry does not duplicate findings or execute concurrently
- [ ] Source object cleanup is idempotent and respects retention
- [ ] Frontend progress bar animates 0→100%
- [ ] Frontend handles "failed" status with error display
- [ ] Full E2E: upload ZIP → progress → findings → report generation works

```

---

## Prompt 8 — Part 8: Supabase Auth + API + Final Integration

> **When to use:** After Part 7 is verified.

```

### TASK: Implement Part 8 — Supabase Auth Hardening + Rate Limiting + WebSocket + Final Integration

Read these reference files:

- @Part-08-API-Endpoints-Frontend-Integration.md
- @plan/Workflow-06-Full-Integration-Deploy.md (Phase B, C, D)
- @Backend-Frontend-Connect.md Section 12
- @plan/Supabase-Backend.md Sections 13, 21-23, and 25-26

### CURRENT STATE

Parts 1–7 complete. Supabase Auth/JWKS and workspace foundations already exist, and the full pipeline works end-to-end. Complete the production auth experience, route authorization, rate limiting, authenticated WebSocket progress, mock removal, and cross-tenant verification.

### DELIVERABLES

**1. Supabase Authentication Completion**

- Supabase Auth owns signup, signin, signout, email verification, password reset, OAuth, and session refresh
- `app/auth/jwt_verifier.py` verifies access-token signature through cached Supabase JWKS and validates algorithm, issuer, audience, expiry, and subject
- `app/api/auth.py` exposes GET /api/v1/auth/me, idempotent POST /api/v1/auth/bootstrap, and PATCH /api/v1/auth/profile only
- Profiles and workspace roles come from Supabase PostgreSQL, not user-editable user_metadata
- FastAPI never receives passwords, hashes passwords, issues access tokens, or implements a refresh endpoint

**2. Protect All Routes**
Add a typed authenticated-user dependency to all non-public API endpoints.
Authorize every scan, finding, report, export, object, and progress stream by workspace membership and minimum role.
All tenant queries include workspace_id and load ownership from PostgreSQL rather than trusting request data.

**3. Rate Limiting** (in `app/main.py`)

- Use slowapi with a key derived from verified user/workspace plus IP fallback
- POST /api/v1/scans and /start: 10/hour
- POST /api/v1/scans/{id}/reports: 5/hour
- GET endpoints: 100/minute
- Return 429 with Retry-After header

**4. WebSocket** (`app/api/ws.py`)

- WS /api/v1/ws/scans/{scan_id} → Real-time scan progress
- Do not place access tokens in the WebSocket URL
- Require an initial `{type: "authenticate", access_token: "..."}` message within 5 seconds
- Verify Supabase JWT and workspace membership before subscribing to the scan channel
- Send JSON: {status, progress, finding_count} every 2 seconds
- Close connection on completed/failed
- Client falls back to authenticated polling on disconnect

**5. Response Compression**
Add GZipMiddleware to FastAPI app (minimum_size=1000)

**6. Register All Routers** (update `app/main.py`)
Ensure ALL routers are mounted:

- /api/v1/auth → auth router
- /api/v1/scans → scans router
- /api/v1/reports → reports router
- /api/v1/frameworks → frameworks router
- /api/v1/ws → websocket router

### FRONTEND CONNECTION

1. Create `src/lib/supabase.ts` as the single browser client using only URL and publishable key
2. Create `src/lib/api/auth.ts` with Supabase signUp(), signIn(), signOut(), resetPassword(), getSession(), and the FastAPI getMe()/bootstrapProfile() calls
3. Create `src/hooks/useAuth.ts` using Supabase onAuthStateChange plus React Query profile/membership data
4. Create `src/routes/login.tsx` — Login page using Supabase Auth
5. Create `src/routes/register.tsx` — Registration and email-verification state
6. In `src/routes/_app.tsx`: add session-aware route protection and bootstrap the profile/workspace
7. Update `src/lib/api/client.ts`: asynchronously obtain the current Supabase session and attach its access token
8. Handle 401 by checking the managed Supabase session, then redirecting when unauthenticated
9. Clear private React Query caches on signout and workspace switch; include workspaceId in tenant query keys

### FINAL CLEANUP

1. Remove all remaining mock-data.ts imports from route files
2. Ensure every page uses API hooks instead of mock data
3. Add loading states (skeleton/spinner) to all pages
4. Add error states to all pages
5. Add empty states to all pages

### CONSTRAINTS

- Supabase Auth is the only user credential and token-issuing system
- SUPABASE_SERVICE_ROLE_KEY and database credentials are server-only
- Never persist access tokens manually or read/write a custom auth token in localStorage
- Never authorize using unverified JWT decoding or user-editable metadata
- CORS: specific frontend origin only (not \* in production)
- All request bodies validated by Pydantic
- Storage upload: validate exact path, type, size, checksum, ownership, and scan state before enqueue
- Error messages must NOT leak internal details (no stack traces to client)
- Use orjson for faster JSON serialization if possible

### VERIFICATION CHECKLIST

- [ ] Supabase signup, email verification, signin, managed refresh, password reset, and signout work
- [ ] GET /api/v1/auth/me returns the verified profile and memberships
- [ ] Valid token works; expired, wrong-issuer, wrong-audience, bad-signature, and unknown-key tokens return 401
- [ ] Protected endpoints return 401 without token
- [ ] Protected endpoints work with valid Bearer token
- [ ] Viewer/analyst/admin/owner permissions are enforced
- [ ] Two workspaces cannot access each other's scans, findings, reports, exports, Storage objects, or WebSockets
- [ ] Rate limiting: 11th POST /api/v1/scans in 1 hour returns 429
- [ ] WebSocket authenticates before subscription and polling fallback works
- [ ] Frontend login form works end-to-end
- [ ] Frontend register form works end-to-end
- [ ] Unauthenticated access redirects to /login
- [ ] Signout and workspace switch clear private cached data
- [ ] Full E2E: signup → verify → signin → bootstrap → private upload → scan → progress → findings → report → authorized download
- [ ] mock-data.ts has zero remaining imports in route files
- [ ] All pages have loading, error, and empty states

```

---

## Usage Summary

| Step | Prompt | What Gets Built | Time Estimate |
|------|--------|-----------------|---------------|
| 0 | Project Context | AI understands the full project | 1 minute |
| 1 | Part 1 | Supabase foundation, FastAPI, models/RLS, Redis, Qdrant, Celery, API client | 2–4 days |
| 2 | Part 2 | RAG, embedder, chunkers, retriever, frameworks API | 3–5 days |
| 3 | Part 3 | Private resumable upload, artifacts, ZIP/Git ingestion, parsers, scan API | 3–5 days |
| 4 | Part 4 | Isolated scanners, deduplication, workspace findings API | 3–5 days |
| 5 | Part 5 | LangChain chains, compliance mapper, CVSS | 3–5 days |
| 6 | Part 6 | Jinja2 templates, PDF generator, private Supabase report storage, exports | 3–4 days |
| 7 | Part 7 | ID-only Celery pipeline, progress, retention cleanup, full E2E | 3–4 days |
| 8 | Part 8 | Supabase Auth hardening, workspace authorization, rate limiting, WebSocket, final polish | 3–5 days |

**Total: ~23–37 days (5–8 weeks)**

### Tips for Best Results

1. **Paste Prompt 0 at the start of EVERY new AI session** — don't assume the AI remembers context
2. **One prompt per session** — don't combine Parts in a single prompt
3. **Verify before advancing** — run every checklist item before moving to the next prompt
4. **Attach the reference files** — when the prompt says `@Part-01-...`, attach that file to the AI conversation if your tool supports it
5. **If the AI gets stuck**, paste the specific reference file content directly into the chat
6. **Save working code before each new prompt** — commit to git after each Part passes verification
7. **Never paste server secrets into an AI prompt** — use placeholder values and local/deployment secret stores
8. **Before Part 3**, verify the minimum Supabase signin/session flow because private Storage RLS requires an authenticated user
```

---

## Prompt 9 -- Workspace Management

> Paste this prompt when Part 8 is verified and you need multi-workspace support with a member invite flow.

```
You are implementing Prompt 9 of the ThreatLens backend.

## Deliverables

### Backend (NEW app/api/workspaces.py)
- POST /api/v1/workspaces -- create workspace + owner membership; slug must be URL-safe (a-z0-9-)
- GET /api/v1/workspaces -- return all workspaces user is a member of (role, member_count, scan_count)
- GET /api/v1/workspaces/{workspace_id} -- single workspace detail (owner+)
- PATCH /api/v1/workspaces/{workspace_id} -- update name/description (owner role)
- POST /api/v1/workspaces/{workspace_id}/invites -- body: { email, role }; owner/admin only; create WorkspaceInvite row (token=64-char hex, expires 7 days); send via Supabase admin invite API
- GET /api/v1/workspaces/{workspace_id}/members -- list members with role/joined_at (admin+)
- DELETE /api/v1/workspaces/{workspace_id}/members/{user_id} -- remove member (owner; cannot remove self)
- PATCH /api/v1/workspaces/{workspace_id}/members/{user_id} -- update role (owner only)

### Backend: Add WorkspaceInvite model
Fields: id UUID, workspace_id FK, invited_email, token (64-char secure hex), role, invited_by FK, expires_at, accepted_at. New Alembic migration + RLS.

### Frontend
- NEW src/routes/workspace/new.tsx -- create workspace form
- NEW src/routes/workspace/settings.tsx -- settings + member management
- NEW src/components/workspace-switcher.tsx -- header dropdown; active workspace in localStorage
- MODIFY src/routes/_app.tsx -- redirect to /workspace/new if user has no workspaces
- NEW src/hooks/useWorkspace.ts -- useWorkspaces(), useActiveWorkspace(), useSetActiveWorkspace(id)

## Verification Checklist
- [ ] POST /workspaces creates workspace + owner membership atomically
- [ ] GET /workspaces returns only workspaces the user is a member of
- [ ] POST /invites triggers Supabase invite email
- [ ] Workspace switcher in UI shows all workspaces and switches correctly
- [ ] New user without a workspace is redirected to /workspace/new
```

---

## Prompt 10 -- Finding State Management + Audit Log Viewer

> Paste this prompt after Prompt 9 to add finding triage workflows and compliance audit trails.

```
You are implementing Prompt 10 of the ThreatLens backend.

## Deliverables

### Backend: Finding State API
- MODIFY app/api/scans.py -- add PATCH /api/v1/scans/{scan_id}/findings/{finding_id}
  body: { state: "open"|"accepted_risk"|"resolved"|"false_positive", note?: str (max 1000 chars) }
  Analyst+ role required. Record AuditEvent on every state change (event_type="finding.state_changed", details={ from, to, finding_id, note }).
- MODIFY app/schemas/finding.py -- add FindingUpdateRequest and FindingResponse (includes list[ComplianceViolationResponse])
- NEW app/api/audit_events.py -- GET /api/v1/audit-events?workspace_id=&event_type=&scan_id=&limit=&offset=; viewer+ required; paginated response

### Frontend: Finding Triage
- MODIFY src/routes/findings.tsx -- triage action buttons (Mark Resolved / Accept Risk / False Positive); state filter bar; state badge on finding cards
- NEW src/hooks/useFindings.ts -- useFindings(scanId, filters?), useUpdateFindingState(scanId, findingId)

### Frontend: Audit Log
- NEW src/routes/audit-log.tsx -- Table: timestamp, event type, user email, resource, details. Filters: date range, event type, scan ID. 100/page.
- NEW src/hooks/useAuditEvents.ts -- useAuditEvents(workspaceId, filters?)

## Verification Checklist
- [ ] PATCH /findings/{id} changes state and creates AuditEvent row
- [ ] GET /audit-events returns workspace-scoped paginated events
- [ ] Triage buttons dispatch API calls and refetch UI state
- [ ] Audit log page shows before/after state on change events
- [ ] Analyst can change state; viewer gets 403
```

---

## Prompt 11 -- Observability + Production Deployment

> Paste this prompt last when core product works and you need production-hardening.

```
You are implementing Prompt 11 of the ThreatLens backend.

## Deliverables

### Structured Logging
- NEW app/middleware/request_logging.py -- Starlette middleware: inject x-request-id (UUID), time duration, log JSON: { timestamp, level, request_id, method, path, status, duration_ms, user_id }
- MODIFY app/main.py -- register RequestLoggingMiddleware before CORS
- MODIFY app/config.py -- add SENTRY_DSN: str = "", LOG_LEVEL: str = "INFO", LOG_FORMAT: str = "json"

### Sentry Integration
- MODIFY app/main.py -- sentry-sdk[fastapi]: initialize from SENTRY_DSN; traces_sample_rate=0.1; scrub credentials
- MODIFY app/tasks/celery_app.py -- add Sentry Celery integration
- MODIFY requirements.txt -- add sentry-sdk[fastapi]

### Production Docker Compose
- NEW docker-compose.prod.yml -- built images (threatlens-api:), restart=always, health checks, separate queues (scans/reports/maintenance), beat + flower services, internal/public networks
- NEW nginx/nginx.conf -- HTTPS termination, proxy /api/ (120s timeout), WebSocket upgrade for /ws/, gzip, security headers, rate limiting (60r/m, burst=20)
- NEW .env.production.example -- complete checklist: Supabase, Redis TLS, Qdrant cloud, Groq, NVD, Sentry, CORS_ORIGINS, ENVIRONMENT=production, DEBUG=false, FLOWER_BASIC_AUTH

### Health Check Expansion
- MODIFY GET /health -- check Redis (celery ping timeout=2), Qdrant (get_collections), DB (SELECT 1); return 503 if any down; return { status, components: {redis, qdrant, db}, version, uptime_seconds }

## Verification Checklist
- [ ] Every HTTP request logs a unique request_id in JSON format
- [ ] Sentry receives a test error via GET /debug/sentry-test
- [ ] docker-compose.prod.yml brings up all services from built images
- [ ] Nginx proxies /api/ and /ws/ correctly with SSL
- [ ] GET /health returns 503 when Redis is stopped
- [ ] Celery Flower (port 5555) shows live task queues
- [ ] .env.production.example documents every required variable
```
