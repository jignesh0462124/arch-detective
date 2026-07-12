# ThreatLens — Copilot Instruction File

> **Master Execution Guide for AI-Assisted Part-Wise Implementation**  
> This file directs Copilot (or any AI coding assistant) to execute each part of the ThreatLens backend systematically, test it, secure it, optimize it, and connect it to the frontend before moving to the next part.

---

## Table of Contents

1. [Project Context](#1-project-context)
2. [Execution Rules](#2-execution-rules)
3. [Part-Wise Execution Order](#3-part-wise-execution-order)
4. [Part 1: Foundation Setup](#4-part-1-foundation-setup)
5. [Part 2: RAG Knowledge Base](#5-part-2-rag-knowledge-base)
6. [Part 3: Input Ingestion Layer](#6-part-3-input-ingestion-layer)
7. [Part 4: Scanners](#7-part-4-scanners)
8. [Part 5: LangChain Agent Chains](#8-part-5-langchain-agent-chains)
9. [Part 6: PDF Report Generator](#9-part-6-pdf-report-generator)
10. [Part 7: Celery Task Queue](#10-part-7-celery-task-queue)
11. [Part 8: API + Frontend Integration](#11-part-8-api--frontend-integration)
12. [Security Hardening Checklist](#12-security-hardening-checklist)
13. [Testing Strategy](#13-testing-strategy)
14. [Optimization Guidelines](#14-optimization-guidelines)
15. [Frontend-Backend Connection Map](#15-frontend-backend-connection-map)

---

## 1. Project Context

### What is ThreatLens?

ThreatLens is an LLM-Agentic Compliance & Threat Modeling Engine that:
- Accepts codebases (ZIP/Git), architecture YAML, and server logs
- Runs static analysis (Semgrep, Bandit, Trufflehog) + LLM deep review (Groq/Llama 3 70B)
- Maps every vulnerability to 5 compliance frameworks (GDPR, SOC 2, ISO 27001, PCI DSS v4, NIST CSF 2.0) using RAG
- Generates formatted PDF audit reports with severity scores and remediation steps

### Tech Stack

| Layer | Technology |
|-------|-----------|
| API | FastAPI + Uvicorn |
| LLM | Groq API (Llama 3 70B) |
| LLM Orchestration | LangChain |
| Vector Store | Qdrant |
| Embeddings | sentence-transformers all-MiniLM-L6-v2 |
| Task Queue | Celery + Redis |
| Database | PostgreSQL + SQLAlchemy + Alembic |
| PDF | WeasyPrint + Jinja2 |
| Storage | S3 / Cloudflare R2 |
| Frontend | TanStack Start (React + TypeScript + Vite + TailwindCSS) |

### Project Structure

```
threatlens/
├── app/
│   ├── main.py, config.py, database.py
│   ├── models/ (scan, finding, compliance_violation, report)
│   ├── schemas/ (scan, finding, report)
│   ├── api/ (scans, reports, frameworks, export, auth, ws)
│   ├── ingestion/ (code_extractor, arch_parser, log_parser)
│   ├── scanners/ (semgrep, bandit, trufflehog, dependency_audit, log_anomaly, llm_code_reviewer)
│   ├── rag/ (embedder, qdrant_client, retriever, chunkers/)
│   ├── agent/ (compliance_mapper, cvss_scorer, remediation_planner, summary_writer, prompts/)
│   ├── report/ (generator, uploader, templates/)
│   └── tasks/ (celery_app, scan_task, report_task)
├── scripts/ (seed_rag, sync_nvd, test_scan)
├── tests/
├── alembic/
├── docker-compose.yml, Dockerfile, requirements.txt, .env.example
```

### Frontend Structure (Existing)

```
src/
├── routes/
│   ├── index.tsx (Landing page)
│   └── _app/
│       ├── dashboard.tsx
│       ├── new-scan.tsx
│       ├── findings.tsx
│       ├── reports.tsx
│       └── reports.$reportId.tsx
├── components/ (brutal/, ui/)
├── hooks/
├── lib/
└── styles.css
```

---

## 2. Execution Rules

### STRICT RULES FOR AI EXECUTION:

1. **Sequential execution only.** Complete Part N before starting Part N+1.
2. **Per-part lifecycle.** For each part:
   - **BUILD** → Write all files listed in the part's MD file
   - **TEST** → Run the verification checklist
   - **SECURE** → Apply the security notes
   - **OPTIMIZE** → Apply optimization from Section 14
   - **CONNECT** → Wire to frontend using the connection points table
   - **VERIFY CONNECTION** → Confirm frontend can consume the backend data
3. **Never skip tests.** Every part has a verification checklist. All items must pass.
4. **Never skip security.** Every part has security notes. All must be addressed.
5. **Reference the detail files.** Each part has a detailed MD file in the Backend folder:
   - `Part-01-Foundation-Setup.md`
   - `Part-02-RAG-Knowledge-Base.md`
   - `Part-03-Input-Ingestion-Layer.md`
   - `Part-04-Scanners.md`
   - `Part-05-LangChain-Agent-Chains.md`
   - `Part-06-Report-Generator.md`
   - `Part-07-Celery-Task-Queue.md`
   - `Part-08-API-Endpoints-Frontend-Integration.md`
6. **Reference the workflow files.** Each workflow has a step-by-step guide in `plan/`:
   - `Workflow-01-Environment-Setup.md`
   - `Workflow-02-RAG-Pipeline.md`
   - `Workflow-03-Ingestion-Scanners.md`
   - `Workflow-04-LangChain-Compliance.md`
   - `Workflow-05-PDF-Reports.md`
   - `Workflow-06-Full-Integration-Deploy.md`
7. **Reference the connection file.** For the CONNECT step of every part, follow:
   - `Backend-Frontend-Connect.md` — Complete guide for wiring each Part to the frontend, with exact TypeScript code, import swaps, hook creation, and verification steps.
8. **Use the AI prompts file.** For AI-assisted implementation:
   - `AI-Implementation-Prompts.md` — 9 ready-to-use prompts (Prompt 0–8) that you paste into any AI coding assistant to implement each Part sequentially.

---

## 3. Part-Wise Execution Order

```
┌────────────────────────────────────────────────────────────────────┐
│                    EXECUTION DEPENDENCY GRAPH                      │
│                                                                    │
│  Part 1: Foundation ──────────────────┐                           │
│      │                                │                           │
│      ├── Part 2: RAG Knowledge Base   │                           │
│      │       │                        │                           │
│      ├── Part 3: Input Ingestion      │                           │
│      │       │                        │                           │
│      │       └── Part 4: Scanners ────┤                           │
│      │               │                │                           │
│      │               └── Part 5: LangChain Agent (needs Part 2)   │
│      │                       │                                    │
│      │                       └── Part 6: PDF Reports              │
│      │                               │                            │
│      └── Part 7: Celery Pipeline (ties Parts 3-6)                 │
│              │                                                    │
│              └── Part 8: API + Auth + Frontend Integration        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Recommended order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

---

## 4. Part 1: Foundation Setup

> **Detail file:** `Part-01-Foundation-Setup.md`  
> **Workflow file:** `plan/Workflow-01-Environment-Setup.md`

### BUILD

Create these files:
- `docker-compose.yml` — PostgreSQL 15, Redis 7, Qdrant
- `Dockerfile` — Python 3.11 slim
- `requirements.txt` — All dependencies
- `.env.example` — Environment variable template
- `app/main.py` — FastAPI app with CORS, `/health` endpoint
- `app/config.py` — pydantic-settings from `.env`
- `app/database.py` — SQLAlchemy engine + session
- `app/models/` — User, Scan, Finding, ComplianceViolation, Report ORM models
- `app/schemas/` — Pydantic request/response schemas
- `app/tasks/celery_app.py` — Celery with Redis broker
- `alembic/` — Migration setup

### TEST

```bash
docker-compose up -d                              # All 3 services start
alembic upgrade head                              # Tables created
uvicorn app.main:app --reload --port 8000         # Server starts
curl http://localhost:8000/health                  # {"status": "healthy"}
curl http://localhost:8000/docs                    # Swagger UI
celery -A app.tasks.celery_app worker --loglevel=info  # Worker connects
```

### SECURE

- [ ] `.env` in `.gitignore`
- [ ] SECRET_KEY is 64+ random chars
- [ ] Database password is strong
- [ ] No secrets in code or version control

### OPTIMIZE

- Use `async` SQLAlchemy sessions for non-blocking DB access
- Set PostgreSQL connection pool size: `pool_size=10, max_overflow=20`
- Enable SQLAlchemy query logging only in DEBUG mode

### CONNECT TO FRONTEND

- CORS must allow `http://localhost:5173`
- Create `src/lib/api/client.ts` with base API client
- Create `src/lib/api/types.ts` with TypeScript interfaces matching Pydantic schemas
- Test: frontend fetch to `/health` returns 200 without CORS errors

---

## 5. Part 2: RAG Knowledge Base

> **Detail file:** `Part-02-RAG-Knowledge-Base.md`  
> **Workflow file:** `plan/Workflow-02-RAG-Pipeline.md`

### BUILD

Create these files:
- `app/rag/embedder.py` — SentenceTransformer singleton wrapper
- `app/rag/qdrant_client.py` — Qdrant connection + collection setup
- `app/rag/retriever.py` — `retrieve_relevant_controls()` function
- `app/rag/chunkers/` — 7 chunker files (GDPR, SOC2, ISO, PCI, NIST, CVE, OWASP)
- `scripts/seed_rag.py` — One-time seeding script
- `scripts/sync_nvd.py` — Weekly CVE sync
- `app/api/frameworks.py` — `GET /frameworks` endpoint

### TEST

```bash
python scripts/seed_rag.py                        # Seeds 1,000+ chunks
# Qdrant dashboard shows compliance_knowledge collection
python -c "
from app.rag.retriever import retrieve_relevant_controls
r = retrieve_relevant_controls('hardcoded password in config')
print([x['control_id'] for x in r])
"
# Should include: Art.32, A.8.5, Req.8.3.2
curl http://localhost:8000/api/v1/frameworks       # Returns 5 frameworks
```

### SECURE

- [ ] `data/` directory in `.gitignore` (copyrighted PDFs)
- [ ] Qdrant API key authentication in production
- [ ] NVD API key for CVE sync (avoid rate limiting)

### OPTIMIZE

- Lazy-load SentenceTransformer model (singleton pattern)
- Batch upsert to Qdrant in groups of 100
- Cache retriever results for identical query texts (LRU cache, 5-min TTL)

### CONNECT TO FRONTEND

- `GET /frameworks` → New Scan page framework checkbox selector
- Create `src/lib/api/frameworks.ts` with `fetchFrameworks()` function
- Wire framework data to `src/routes/_app/new-scan.tsx`

---

## 6. Part 3: Input Ingestion Layer

> **Detail file:** `Part-03-Input-Ingestion-Layer.md`  
> **Workflow file:** `plan/Workflow-03-Ingestion-Scanners.md`

### BUILD

Create these files:
- `app/ingestion/code_extractor.py` — ZIP extract, Git clone, source file collector
- `app/ingestion/arch_parser.py` — YAML/JSON architecture parser
- `app/ingestion/log_parser.py` — Log file parser

### TEST

```bash
# Test ZIP extraction
python -c "
from app.ingestion.code_extractor import extract_from_zip, collect_source_files
path = extract_from_zip('test-app.zip')
files = collect_source_files(path)
print(f'Found {len(files)} files')
"

# Test YAML parsing
python -c "
from app.ingestion.arch_parser import parse_architecture
r = parse_architecture(open('test-k8s.yaml').read(), 'yaml')
print(r['services'])
"
```

### SECURE

- [ ] ZIP bomb protection: reject if extracted > 100x compressed
- [ ] Path traversal: sanitize extracted paths, reject `../`
- [ ] Git URL validation: only `https://`, block `file://` and `ssh://`
- [ ] Temp directory cleanup in `finally` block
- [ ] Max file count cap: 1000 files

### OPTIMIZE

- Stream ZIP extraction (don't load entire ZIP to memory)
- Git clone with `depth=1` to minimize download size
- Skip binary files during source collection

### CONNECT TO FRONTEND

- Wire New Scan page file upload dropzone to `POST /scan`
- Wire Git URL text input to `POST /scan`
- Add file size client-side validation (MAX_FILE_SIZE_MB)
- Show scan type selector (codebase/architecture/logs/full)

---

## 7. Part 4: Scanners

> **Detail file:** `Part-04-Scanners.md`  
> **Workflow file:** `plan/Workflow-03-Ingestion-Scanners.md`

### BUILD

Create these files:
- `app/scanners/semgrep_runner.py` — Semgrep subprocess + JSON parser
- `app/scanners/bandit_runner.py` — Bandit Python analysis
- `app/scanners/trufflehog_runner.py` — Secret/credential scanner
- `app/scanners/dependency_audit.py` — pip-audit + npm-audit
- `app/scanners/log_anomaly.py` — Isolation Forest anomaly detection
- `app/scanners/llm_code_reviewer.py` — Groq LLM deep review

### TEST

```bash
# Test each scanner individually on a vulnerable test app:
python -c "from app.scanners.semgrep_runner import run_semgrep; print(len(run_semgrep('test-app/')))"
python -c "from app.scanners.bandit_runner import run_bandit; print(len(run_bandit('test-app/')))"
python -c "from app.scanners.trufflehog_runner import run_trufflehog; print(len(run_trufflehog('test-app/')))"
```

### SECURE

- [ ] 300s subprocess timeout on all scanners
- [ ] Never execute uploaded code — static analysis only
- [ ] LLM prompt injection: wrap code in clear delimiters
- [ ] Rate limit Groq API: exponential backoff on 429
- [ ] File size cap: 8KB per file sent to LLM

### OPTIMIZE

- Run Semgrep, Bandit, Trufflehog in parallel (Celery group)
- Cap LLM review at 30 files per scan
- Deduplicate findings before compliance mapping
- Use `--quiet` flag on all scanner CLIs to reduce output

### CONNECT TO FRONTEND

- `GET /scan/{id}/status` → Progress bar on scan detail page
- `GET /scan/{id}/findings` → Findings table with severity/source filters
- Create `src/lib/api/findings.ts` with `fetchFindings()` function
- Create `src/hooks/useScanProgress.ts` with TanStack Query polling
- Wire findings page severity badges (critical=red, high=orange, medium=blue, low=green)

---

## 8. Part 5: LangChain Agent Chains

> **Detail file:** `Part-05-LangChain-Agent-Chains.md`  
> **Workflow file:** `plan/Workflow-04-LangChain-Compliance.md`

### BUILD

Create these files:
- `app/agent/prompts/classifier.py` — Vulnerability classification prompt
- `app/agent/prompts/compliance.py` — Compliance mapping prompt
- `app/agent/prompts/remediation.py` — Remediation planning prompt
- `app/agent/prompts/summary.py` — Executive summary prompt
- `app/agent/compliance_mapper.py` — RAG → LLM → Pydantic output chain
- `app/agent/cvss_scorer.py` — CVSS 3.1 auto-scorer
- `app/agent/remediation_planner.py` — Remediation step generator
- `app/agent/summary_writer.py` — Executive summary writer

### TEST

```bash
python -c "
from app.agent.compliance_mapper import map_finding_to_compliance
result = map_finding_to_compliance({
    'title': 'Hardcoded JWT Secret',
    'description': 'JWT key hardcoded in auth.py',
    'severity': 'critical',
    'cwe_id': 'CWE-798',
    'file_path': 'auth.py',
    'code_snippet': 'SECRET_KEY = \"super-secret\"'
})
assert len(result.violations) >= 3, f'Expected 3+ violations, got {len(result.violations)}'
assert 0 <= result.cvss_score <= 10
print('Compliance mapping test PASSED ✓')
"
```

### SECURE

- [ ] Strip PII from prompts before sending to Groq
- [ ] Validate Pydantic parse — discard malformed LLM output
- [ ] Wrap finding text in clear delimiters to prevent prompt injection
- [ ] Token budget: ensure prompt fits Llama 3 70B 8192 context

### OPTIMIZE

- Use `tenacity` for exponential backoff retry (5 attempts, 2-60s wait)
- Reduce `top_k` from 12 to 8 if Groq is slow
- Cache compliance mappings for identical finding fingerprints
- Use `temperature=0` for deterministic outputs

### CONNECT TO FRONTEND

- Finding detail view: compliance tab showing violations per framework
- CVSS gauge (0-10 score display)
- Remediation steps accordion
- Framework violation badges on finding cards
- Dashboard: compliance score bar chart (Recharts)
- Create TypeScript types for `ComplianceViolation` and `FindingDetail`

---

## 9. Part 6: PDF Report Generator

> **Detail file:** `Part-06-Report-Generator.md`  
> **Workflow file:** `plan/Workflow-05-PDF-Reports.md`

### BUILD

Create these files:
- `app/report/templates/base.html` — Master Jinja2 template
- `app/report/templates/executive_summary.html` — Summary section
- `app/report/templates/findings.html` — Findings by severity
- `app/report/templates/compliance_section.html` — Compliance scores
- `app/report/generator.py` — Chart generation + PDF rendering
- `app/report/uploader.py` — S3/R2 upload + signed URLs
- `app/api/reports.py` — Report endpoints
- `app/api/export.py` — CSV/JSON export endpoints
- `app/tasks/report_task.py` — Celery async PDF task

### TEST

```bash
# Generate PDF from completed scan:
curl -X POST http://localhost:8000/api/v1/scan/{scan_id}/report
# Wait for completion, then download:
curl http://localhost:8000/api/v1/report/{scan_id}/download
# Open PDF and verify: cover page, summary, findings, compliance section

# CSV export:
curl http://localhost:8000/api/v1/scan/{scan_id}/export/csv > findings.csv
# Open in Excel/LibreOffice, verify all columns present
```

### SECURE

- [ ] Signed URLs expire in 1 hour (never permanent public URLs)
- [ ] S3 bucket is private
- [ ] PDF content sanitized (no executable JS)
- [ ] CSV injection protection: prefix `=`, `+`, `-`, `@` with single quote
- [ ] Rate limit report generation: max 1 concurrent per user

### OPTIMIZE

- Compress PDF output (`HTML(...).write_pdf(optimize_size=("fonts", "images"))`)
- Use base64-embedded chart images (no external file dependencies)
- Async Celery task so PDF generation doesn't block API
- Cache generated PDFs — regenerate only if scan data changes

### CONNECT TO FRONTEND

- Reports page: "Generate Report" button → `POST /scan/{id}/report`
- Reports page: "Download PDF" button → opens signed URL in new tab
- Findings page: "Export CSV" button → triggers browser download
- Dashboard: compliance score chart (Recharts bar chart from framework_scores)
- Create `src/lib/api/reports.ts` with `generateReport()` and `downloadReport()`

---

## 10. Part 7: Celery Task Queue

> **Detail file:** `Part-07-Celery-Task-Queue.md`  
> **Workflow file:** `plan/Workflow-06-Full-Integration-Deploy.md`

### BUILD

Complete these files:
- `app/tasks/celery_app.py` — Celery config (broker, backend, serializer, beat schedule)
- `app/tasks/scan_task.py` — Full scan orchestration (ingestion → scanners → compliance)
- `app/tasks/report_task.py` — PDF generation task

### TEST

```bash
# Start worker:
celery -A app.tasks.celery_app worker --loglevel=info

# Trigger scan and monitor progress:
SCAN_ID=$(curl -s -X POST http://localhost:8000/api/v1/scan \
  -F "scan_type=codebase" -F "file=@test-app.zip" | python -c "import sys,json; print(json.load(sys.stdin)['scan_id'])")

# Poll until complete:
for i in $(seq 1 30); do
  STATUS=$(curl -s http://localhost:8000/api/v1/scan/${SCAN_ID}/status)
  echo "$STATUS"
  sleep 3
done
```

### SECURE

- [ ] `result_expires=3600` (auto-clear Redis results)
- [ ] `task_time_limit=600` (10 min max per task)
- [ ] Temp directory cleanup in `finally` block
- [ ] Redis password in production
- [ ] JSON serializer only (not pickle)

### OPTIMIZE

- Run independent scanners in parallel (Celery chord/group)
- Progress granularity: update every 5% for smooth UX
- Set `task_acks_late=True` for crash recovery
- Use `task_soft_time_limit` to gracefully handle timeouts

### CONNECT TO FRONTEND

- `useScanProgress` hook polls `GET /scan/{id}/status` every 3 seconds
- Stop polling when status is "completed" or "failed"
- Show live finding count during scan
- On completion → auto-fetch findings → enable report generation

---

## 11. Part 8: API + Frontend Integration

> **Detail file:** `Part-08-API-Endpoints-Frontend-Integration.md`  
> **Workflow file:** `plan/Workflow-06-Full-Integration-Deploy.md`

### BUILD

Create these files:
- `app/api/auth.py` — JWT register, login, refresh, me
- `app/api/ws.py` — WebSocket scan progress
- `src/lib/api/client.ts` — Base API client with auth headers
- `src/lib/api/types.ts` — Full TypeScript type definitions
- `src/lib/api/scans.ts` — Scan API functions
- `src/lib/api/findings.ts` — Findings API functions
- `src/lib/api/reports.ts` — Report API functions
- `src/lib/api/auth.ts` — Auth API functions
- `src/hooks/useScanProgress.ts` — TanStack Query polling hook
- `src/hooks/useFindings.ts` — TanStack Query findings hook

### TEST

```bash
# Test auth flow:
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Test protected endpoint:
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/scans

# Test rate limiting:
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/v1/scan \
    -F "scan_type=codebase" -F "file=@test.zip"
done
# Should see 429 after 10 requests

# Full E2E from frontend:
# 1. Open http://localhost:5173
# 2. Register/Login
# 3. Start New Scan → Upload ZIP
# 4. Watch progress bar
# 5. View findings
# 6. Generate PDF report
# 7. Download PDF
```

### SECURE

- [ ] JWT SECRET_KEY is 64+ random chars
- [ ] Access tokens expire in 24 hours
- [ ] Password hashing with bcrypt
- [ ] Rate limiting on all endpoints
- [ ] CORS: specific frontend origin only (not `*`)
- [ ] Input validation via Pydantic on all endpoints
- [ ] File type/size validation on uploads

### OPTIMIZE

- Gzip response compression middleware
- Connection pooling for all external services
- Use `orjson` for faster JSON serialization
- Frontend: debounce search/filter inputs

### CONNECT TO FRONTEND

See full route-to-endpoint mapping in Part 8 detail file.

---

## 12. Security Hardening Checklist

Apply **after each part is complete** and again at the end:

### Authentication & Authorization
- [ ] JWT on all scan/report endpoints
- [ ] User can only access their own scans
- [ ] Admin-only endpoints for system management
- [ ] Token refresh mechanism

### Input Validation
- [ ] All request bodies validated by Pydantic
- [ ] File upload: type, size, content validation
- [ ] Git URL: only HTTPS, no file:// or ssh://
- [ ] ZIP: bomb protection, path traversal prevention

### Secrets Management
- [ ] No secrets in code or git history
- [ ] .env in .gitignore
- [ ] Environment variables for all credentials
- [ ] Signed URLs for S3 objects (never public URLs)

### API Security
- [ ] Rate limiting (slowapi)
- [ ] CORS restricted to frontend origin
- [ ] Request size limits
- [ ] Error messages don't leak internal details

### Data Security
- [ ] PostgreSQL: encrypted connections in production
- [ ] Redis: password-protected
- [ ] Qdrant: API key in production
- [ ] PDF reports: signed URLs with expiry

### Infrastructure
- [ ] Docker containers run as non-root
- [ ] Base image: python:3.11-slim (minimal attack surface)
- [ ] No debug mode in production
- [ ] Health check endpoints for monitoring

---

## 13. Testing Strategy

### Unit Tests (run after each part)

```bash
# Per-part test files:
tests/
├── test_config.py          # Part 1
├── test_models.py          # Part 1
├── test_rag.py             # Part 2
├── test_ingestion.py       # Part 3
├── test_scanners.py        # Part 4
├── test_agent.py           # Part 5
├── test_report.py          # Part 6
├── test_tasks.py           # Part 7
├── test_api.py             # Part 8
└── test_e2e.py             # Full pipeline
```

### Test Commands

```bash
# Run all tests:
pytest tests/ -v --tb=short

# Run specific part tests:
pytest tests/test_rag.py -v

# Run with coverage:
pytest tests/ --cov=app --cov-report=html

# Run E2E test:
pytest tests/test_e2e.py -v --timeout=300
```

### Integration Tests

After each part's frontend connection:
1. Start backend: `uvicorn app.main:app --port 8000`
2. Start frontend: `npm run dev`
3. Open browser → test the connected feature
4. Check browser console for errors
5. Check backend logs for errors

---

## 14. Optimization Guidelines

### Apply After Each Part:

#### Database
- Add indexes on frequently queried columns (scan_id, severity, framework)
- Use eager loading for relationships to avoid N+1 queries
- Connection pool: `pool_size=10, max_overflow=20`
- Query pagination for findings list

#### API
- Response compression (gzip middleware)
- Async endpoints where possible
- Use `orjson` serializer for faster JSON
- Background tasks for non-critical operations

#### RAG
- Lazy-load SentenceTransformer model
- LRU cache on retriever (5-min TTL)
- Batch Qdrant upserts (groups of 100)
- Metadata filtering to narrow search scope

#### Scanners
- Parallel execution (Celery group/chord)
- Subprocess timeouts (300s)
- LLM file cap (30 files, 8KB each)
- Deduplicate before compliance mapping

#### Frontend
- TanStack Query caching for API responses
- Debounce search/filter inputs
- Lazy load route components
- Optimistic UI updates where safe

---

## 15. Frontend-Backend Connection Map

### Complete Route → Endpoint Mapping

| Frontend Page | Backend Endpoints | Data Flow |
|--------------|-------------------|-----------|
| Landing (`index.tsx`) | None | Static content |
| Dashboard (`dashboard.tsx`) | `GET /scans`, `GET /frameworks` | Scan list + framework metadata → cards & charts |
| New Scan (`new-scan.tsx`) | `POST /scan`, `GET /frameworks` | File upload/Git URL → scan_id → navigate to progress |
| Findings (`findings.tsx`) | `GET /scan/{id}/findings`, `GET /scan/{id}/status` | Findings table with filters + progress bar |
| Reports (`reports.tsx`) | `POST /scan/{id}/report`, `GET /report/{id}/download`, `GET /scans` | Generate → download PDF |
| Report Detail (`reports.$reportId.tsx`) | `GET /report/{id}/download`, `GET /scan/{id}/findings` | Full report view with findings |

### API Client Files to Create in Frontend

```
src/lib/api/
├── client.ts      → Base fetch wrapper with auth headers
├── types.ts       → TypeScript interfaces (Scan, Finding, ComplianceViolation, etc.)
├── scans.ts       → createScan(), fetchScanStatus(), fetchScans()
├── findings.ts    → fetchFindings(), fetchFindingDetail()
├── reports.ts     → generateReport(), downloadReport()
├── frameworks.ts  → fetchFrameworks()
└── auth.ts        → login(), register(), refreshToken()

src/hooks/
├── useScanProgress.ts  → TanStack Query polling hook
├── useFindings.ts      → TanStack Query findings hook
└── useAuth.ts          → Auth state management
```

### Environment Variable

```env
# Frontend .env
VITE_API_URL=http://localhost:8000
```

---

## Execution Start Point

**Begin with Part 1: Foundation Setup.**

Read `Part-01-Foundation-Setup.md` for detailed file specifications, then follow `plan/Workflow-01-Environment-Setup.md` for step-by-step commands.

After Part 1 is complete (all tests pass, frontend connects to `/health`), proceed to Part 2.

**Do not skip ahead. Each part builds on the previous.**
