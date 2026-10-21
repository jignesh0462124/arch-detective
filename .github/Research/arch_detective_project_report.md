# ThreatLens / Arch-Detective Project Report

> Review date: July 25, 2026  
> Review mode: DEEP_WORK + DEEP_THINK + CODE_REVIEW + ARCHITECTURE_REVIEW  
> Scope: frontend, backend, Supabase integration, security posture, documentation quality  
> Current verification: frontend typecheck/build pass; backend pytest passes with 89 passed and 4 skipped

---

## 1. Executive Summary

ThreatLens, also named Arch-Detective in parts of the repository, is a Supabase-backed FastAPI and TanStack Start application for LLM-assisted compliance scanning and threat modeling.

The project is no longer just frontend-only. The backend now has a real foundation: Supabase JWT verification, workspace-scoped models, scan APIs, ingestion safety, scanner modules, RAG framework metadata, and private-storage abstractions are present. The main remaining gap is orchestration: scanners, compliance mapping, report generation, and frontend live data are not yet wired into one complete end-to-end product flow.

| Area | Status | Notes |
| --- | --- | --- |
| Frontend build health | Good | `npm run typecheck` and `npm run build` pass |
| Backend test health | Good | `89 passed, 4 skipped` |
| Supabase auth wiring | Partial | frontend signin/signup/reset is wired; live DB migration still needs private credentials |
| Data isolation | Good foundation | workspace models, membership checks, and RLS migration exist |
| Scan execution | Incomplete | scanner runners exist, Celery scan task is still an ingestion stub |
| Reports | Incomplete | report metadata model exists, PDF/report endpoints are not complete |
| Security posture | Improving | secret-safe config, scanner isolation, JWT verification; CI/secret scanning still missing |
| Documentation quality | Improved by this file | older report had stale findings and mojibake encoding |

---

## 2. Architecture Snapshot

```mermaid
flowchart TB
    Browser["TanStack Start frontend"]
    SupabaseAuth["Supabase Auth"]
    FastAPI["FastAPI /api/v1"]
    SupabaseDB["Supabase PostgreSQL"]
    Storage["Supabase private Storage"]
    Redis["Redis broker"]
    Worker["Celery worker"]
    Qdrant["Qdrant RAG store"]
    Scanners["Semgrep / Bandit / TruffleHog / dependency audit / log anomaly / LLM review"]
    Groq["Groq / Llama 3.1"]
    Reports["PDF report generator"]

    Browser -->|"signup, signin, reset"| SupabaseAuth
    Browser -->|"Bearer Supabase JWT"| FastAPI
    Browser -->|"planned direct uploads"| Storage
    FastAPI --> SupabaseDB
    FastAPI --> Storage
    FastAPI --> Redis
    Redis --> Worker
    Worker --> Storage
    Worker --> SupabaseDB
    Worker --> Scanners
    Worker --> Qdrant
    Worker --> Groq
    Worker --> Reports
```

### Strong Points

- Supabase Auth is the credential source. The backend verifies Supabase access tokens through JWKS instead of issuing homegrown JWTs.
- Application data is moving toward workspace scope instead of user-only ownership.
- Private storage paths and scan artifacts are modeled explicitly.
- Scanner execution code is designed to avoid leaking backend secrets into subprocesses.
- ZIP and Git ingestion has important safety checks such as path traversal rejection, limits, cleanup, and private-address protections.
- TypeScript strictness is active, including `noUnusedLocals` and `noUnusedParameters`.

### Main Product Gap

The frontend still uses `src/lib/mock-data.ts` on landing/dashboard/findings/reports/report-detail pages. The backend is stronger than the UI currently shows, but the UI has not been fully connected to live scan/finding/report data yet.

---

## 3. Resolved or Stale Findings from the Previous Report

These items were listed as problems in the old report but are now resolved or no longer accurate.

| Old finding | Current state |
| --- | --- |
| `SeverityLevel` import breaks dashboard | Resolved. Dashboard imports `type Severity` from `mock-data.ts`. |
| Scan model lacks workspace/source/framework fields | Resolved. `Scan` has `workspace_id`, `created_by`, `source_type`, `source_config`, `selected_frameworks`, `celery_task_id`, and error fields. |
| No workspace or tenant model | Resolved foundation. `Workspace` and `WorkspaceMember` exist with role checks and RLS policies in migration. |
| `tsconfig.json` unused-code flags disabled | Resolved. `noUnusedLocals` and `noUnusedParameters` are enabled. |
| Backend only has `/frameworks` live | Outdated. Auth and scans APIs also exist, including scan list/detail/start/findings/delete. |
| Custom login/register backend rate limits needed | Outdated. Supabase owns password authentication. Rate limiting should target FastAPI business endpoints, not nonexistent password endpoints. |
| AWS/S3 should be used for reports | Replaced. Supabase Storage is now the selected storage architecture. |

---

## 4. Confirmed Bugs and Risks

### BUG-001: Frontend Still Depends Heavily on Mock Data

Severity: High  
Files: `src/routes/_app/dashboard.tsx`, `src/routes/_app/findings.tsx`, `src/routes/_app/reports.tsx`, `src/routes/_app/reports.$reportId.tsx`, `src/routes/index.tsx`

The UI still imports `src/lib/mock-data.ts` for core product data. This blocks a true product demo because the dashboard, findings queue, and reports pages do not reflect the authenticated Supabase workspace.

Recommended fix:

- Add `src/lib/api/scans.ts`, `src/lib/api/findings.ts`, and `src/lib/api/reports.ts`.
- Add React Query hooks for scan list, scan detail, finding list, and report metadata.
- Replace each route one at a time, keeping loading, error, empty, and unauthenticated states.
- Keep mock data only for marketing demos or explicit development fallback.

### BUG-002: Celery Scan Task Is Still a Stub

Severity: Critical  
File: `threatlens/app/tasks/scan_task.py`

`ingest_scan()` validates the scan UUID and returns `{"status": "queued"}`. It does not download the authoritative source, run scanners, deduplicate findings, map compliance controls, or persist results.

Recommended fix:

- Implement Part 7 orchestration as the next backend milestone.
- Load scan/artifact metadata from PostgreSQL, not from queue payloads.
- Download uploaded sources from Supabase Storage into a temporary directory.
- Run scanners with the existing secret-scrubbed subprocess environment.
- Persist normalized findings and compliance violations in one transaction per phase.
- Update `Scan.status`, `progress`, `finding_count`, `started_at`, `completed_at`, and safe error fields.
- Ensure retries are idempotent and do not duplicate findings.

### BUG-003: Live Supabase Database Is Not Migrated Yet

Severity: High  
File: `threatlens/.env`

The project has a safe local `threatlens/.env` with placeholders. That is correct for not leaking secrets, but the real Supabase project still needs private database and service-role values before Alembic can create tables, RLS policies, and buckets.

Required local-only values:

```dotenv
DATABASE_URL=postgresql+asyncpg://threatlens_backend:PRIVATE_PASSWORD@HOST:5432/postgres?ssl=require
MIGRATION_DATABASE_URL=postgresql+asyncpg://postgres.dxiygpslqsklqpfdgakf:PRIVATE_PASSWORD@HOST:5432/postgres?ssl=require
SUPABASE_SERVICE_ROLE_KEY=sb_secret_PRIVATE_VALUE
```

Migration command:

```powershell
cd threatlens
python -m alembic -c alembic/alembic.ini upgrade head
```

Security note: do not paste the service-role key or database password into chat, source code, screenshots, or Markdown files.

### BUG-004: API Client 401 Handling Had Duplicate Session Fetch

Severity: Medium  
File: `src/lib/api/client.ts`

The old implementation fetched the Supabase session once while creating auth headers and again after a 401. That creates avoidable latency and can trigger multiple redirect attempts during concurrent API failures.

Status: Fixed in code. The API client now returns `{ headers, session }` from the auth-header helper and debounces unauthenticated redirects.

### BUG-005: Theme Toggle Lacked Live Screen-Reader Feedback

Severity: Medium  
File: `src/components/brutal/ThemeToggle.tsx`

The theme toggle used `aria-pressed`, but did not announce the resulting theme change.

Status: Fixed in code. The component now includes a polite live region announcing light/dark mode.

### BUG-006: Default CORS Origins Missed the Active `8082` Dev Port

Severity: Medium  
Files: `threatlens/app/config.py`, `threatlens/.env.example`

The frontend has been running on `http://127.0.0.1:8082`, but the default backend CORS list did not include this origin.

Status: Fixed in code and `.env.example`.

### BUG-007: Framework Counts Are Named as UI Controls but Come from RAG Chunks

Severity: Medium  
Files: `threatlens/app/api/frameworks.py`, `src/lib/api/frameworks.ts`

The backend returns `chunks_indexed`; the frontend maps that value to `controls`. A RAG chunk count is not the same as a compliance-control count.

Recommended fix:

- Backend response should include both `control_count` and `chunk_count`.
- Frontend should display `control_count` as controls and optionally show indexed chunk health elsewhere.
- Keep `chunks_indexed` temporarily for backward compatibility.

Safer interface:

```python
class FrameworkResponse(BaseModel):
    id: str
    name: str
    version: str
    control_count: int
    chunk_count: int
    chunks_indexed: int
```

### BUG-008: Report Generation and Export APIs Are Missing

Severity: High  
Files: `threatlens/app/api`, `threatlens/app/report`, `threatlens/app/tasks`

Report models exist, but report generation, signed download URLs, CSV/JSON export, and frontend report integration remain incomplete.

Recommended fix:

- Implement Part 6 after scanner/compliance mapping can persist findings.
- Store generated PDFs in private Supabase `audit-reports`.
- Generate signed URLs only after workspace authorization.
- Never store signed URLs in PostgreSQL or logs.

### BUG-009: CI and Secret-Scanning Gates Are Missing

Severity: High  
File: `.github/workflows`

Local checks pass, but there is no required CI workflow protecting the project from regressions, leaked secrets, broken builds, or vulnerable dependency changes.

Recommended workflow:

```yaml
name: Quality Gates

on:
  push:
  pull_request:

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint -- --max-warnings 0
      - run: npm run build

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: cd threatlens && python -m pip install -r requirements.txt
      - run: cd threatlens && python -m pytest -q --tb=short
      - run: cd threatlens && python -m bandit -r app -ll

  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gitleaks/gitleaks-action@v2
```

### BUG-010: Possible Secret History Must Be Treated as Unresolved

Severity: Critical if confirmed  
Files: Git history, `.env`, `.env.example`, screenshots, pasted prompts

The current tracked examples do not intentionally contain backend secrets, but previous notes mention a possible Groq key leak. This cannot be solved by editing the current file alone if the secret ever entered Git history.

Required response:

- Rotate any Groq, Supabase service-role, database, or storage keys that may have been pasted or committed.
- Run a history-aware scanner such as Gitleaks or TruffleHog.
- Avoid rewriting Git history until you confirm what leaked and whether the branch is shared.

Safe local scan:

```powershell
gitleaks detect --source . --redact
```

---

## 5. Security Recommendations

### Authentication and Authorization

- Keep Supabase Auth as the only password/session provider.
- Keep FastAPI as the business authorization boundary.
- Do not authorize with user-editable Supabase metadata.
- Require workspace membership checks for every scan, finding, report, export, and WebSocket subscription.
- The current frontend route guard is useful for UX, but backend JWT and workspace checks remain the real security boundary.

### Secrets

- Keep only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in frontend env.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, database passwords, Groq keys, Qdrant keys, and Redis credentials server-only.
- Never pass service keys into scanner subprocess environments.
- Add Gitleaks or detect-secrets to CI.

### Storage

- Keep `scan-inputs` and `audit-reports` private.
- Upload scans only to API-authorized exact object paths.
- Generate report signed URLs on demand after authorization.
- Never persist signed URLs.

### Scanner Safety

- Treat all uploaded repositories, YAML, logs, and ZIP files as hostile input.
- Keep path traversal, symlink, compression-ratio, file-count, and byte-size guards.
- Use temporary directories and cleanup in `finally`.
- Keep network access disabled for scanners unless a scanner explicitly requires controlled registry access.

---

## 6. Implementation Roadmap

### Phase 1: Make Supabase Live

- Fill private backend values in `threatlens/.env`.
- Run Alembic against Supabase.
- Confirm RLS is enabled on all application tables.
- Create a real user through `/login`.
- Confirm `POST /api/v1/auth/bootstrap` creates profile and personal workspace.

### Phase 2: Complete Scan Orchestration

- Implement Part 7 Celery orchestration.
- Persist scanner findings.
- Add compliance mapping persistence.
- Add progress updates and failure states.

### Phase 3: Replace Frontend Mocks

- Add scans/findings/reports API modules and React Query hooks.
- Replace dashboard data first.
- Replace findings queue second.
- Replace reports and report detail after PDF generation exists.

### Phase 4: Reports and Exports

- Generate PDF reports with Jinja2 and WeasyPrint.
- Upload PDFs to Supabase private storage.
- Add signed download URL endpoint.
- Add CSV and JSON exports.

### Phase 5: Production Gates

- Add GitHub Actions for frontend, backend, and secret scanning.
- Add frontend E2E tests for login, protected routes, scan creation, and report download.
- Add rate limiting for expensive FastAPI endpoints.
- Add structured logging without secrets or signed URLs.

---

## 7. Verification Commands

Frontend:

```powershell
cmd /c npm run typecheck
cmd /c npm run build
```

Backend:

```powershell
cd threatlens
python -m pytest
python -m compileall -q app tests
```

Supabase migration after private secrets are filled:

```powershell
cd threatlens
python -m alembic -c alembic/alembic.ini upgrade head
```

Secret scan:

```powershell
gitleaks detect --source . --redact
```

---

## 8. Definition of Done

The project is demo-ready when:

- Supabase migration succeeds against the live project.
- A user can sign up, verify/sign in, and bootstrap a workspace.
- A scan can be created from Git or uploaded source.
- Celery runs ingestion, scanners, compliance mapping, and persists findings.
- Dashboard and findings routes read live authenticated data.
- A report can be generated, stored privately, and downloaded through an authorized signed URL.
- CI runs frontend build/typecheck, backend tests, and secret scanning.
- No private keys or signed URLs are committed, logged, or shown in UI.

---

## 9. Final Assessment

ThreatLens has moved from a visual prototype toward a real full-stack security product. The strongest engineering work is in backend structure, Supabase-native tenancy, ingestion safety, and scanner normalization. The weakest area is the missing end-to-end connection between those backend capabilities and the UI.

The right next move is not another design pass. It is to make one vertical slice real: Supabase user -> workspace -> scan -> Celery scanner task -> persisted findings -> dashboard/finding UI. Once that slice works, the rest of the product becomes much easier to complete and demonstrate.
