# ThreatLens — AI Implementation Prompts

> **What is this file?**  
> This file contains **8 ready-to-use prompts** — one per Part — that you copy-paste to an AI coding assistant (Copilot, Gemini, Claude, ChatGPT, Cursor, etc.) to implement the ThreatLens backend step by step.
>
> **How to use:**  
> 1. Start with **Prompt 0** (Project Setup) — paste it once at the beginning  
> 2. Then paste **Prompt 1** to build Part 1  
> 3. After Part 1 is verified, paste **Prompt 2** for Part 2  
> 4. Continue sequentially: 3 → 4 → 5 → 6 → 7 → 8  
> 5. Never skip a part — each builds on the previous

---

## Prompt Engineering Principles Used

This file follows proven prompt engineering best practices:

| Principle | How Applied |
|---|---|
| **Role** (RTCF) | Every prompt assigns a specific expert role to the AI |
| **Context** (RTCF) | Every prompt includes the tech stack, project structure, and current state |
| **Task** (RTCF) | Every prompt has a numbered task list with exact deliverables |
| **Format** (RTCF) | Every prompt specifies output format, file paths, and code style |
| **Delimiters** | Uses `### CONTEXT`, `### TASK`, `### CONSTRAINTS` sections to separate concerns |
| **Few-Shot** | Includes example code patterns from the Part files for consistency |
| **Chain-of-Thought** | Tasks are decomposed into sequential, dependent subtasks |
| **Constraint-Based** | Explicitly states what to do AND what NOT to do |
| **Verification** | Every prompt ends with a test checklist so nothing is assumed |
| **Recency Effect** | Critical constraints are restated at the end of each prompt |

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
- Database: PostgreSQL 15 + SQLAlchemy 2.x + Alembic
- PDF: WeasyPrint + Jinja2 + matplotlib
- Storage: S3/Cloudflare R2 (boto3)
- Frontend: TanStack Start (React 18 + TypeScript + Vite + TailwindCSS)
- Frontend State: TanStack React Query v5

### BACKEND STRUCTURE (to create inside project root as `threatlens/`)
threatlens/
├── app/
│   ├── main.py, config.py, database.py
│   ├── models/ (user, scan, finding, compliance_violation, report)
│   ├── schemas/ (scan, finding, report)
│   ├── api/ (scans, reports, frameworks, export, auth, ws)
│   ├── ingestion/ (code_extractor, arch_parser, log_parser)
│   ├── scanners/ (semgrep, bandit, trufflehog, dependency_audit, log_anomaly, llm_code_reviewer)
│   ├── rag/ (embedder, qdrant_client, retriever, chunkers/)
│   ├── agent/ (compliance_mapper, cvss_scorer, remediation_planner, summary_writer, prompts/)
│   ├── report/ (generator, uploader, templates/)
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

### REFERENCE DOCUMENTATION (in .github'/Backend/ folder)
- copilot-instructions.md — Master execution guide (BUILD→TEST→SECURE→OPTIMIZE→CONNECT lifecycle)
- Part-01 through Part-08 — Detailed file specs per Part
- plan/Workflow-01 through Workflow-06 — Step-by-step execution guides
- Backend-Frontend-Connect.md — Frontend↔Backend wiring guide with TypeScript code
- plan/Backend.md — Original full architecture specification

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

### DELIVERABLES (create all files in order)

**1. Docker Services**
Create `threatlens/docker-compose.yml` with:
- PostgreSQL 15 (port 5432, database: threatlens_db, user: threatlens)
- Redis 7 (port 6379)
- Qdrant (ports 6333, 6334)
- Named volumes for data persistence
- Health checks for each service

**2. Dockerfile**
Create `threatlens/Dockerfile`:
- Base: python:3.11-slim
- Install system deps for WeasyPrint (libpango, libcairo)
- Copy requirements.txt, install deps
- Copy app code, expose port 8000
- CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000

**3. Dependencies**
Create `threatlens/requirements.txt` with ALL deps:
fastapi, uvicorn[standard], sqlalchemy[asyncio], asyncpg, alembic, pydantic, pydantic-settings, celery[redis], redis, qdrant-client, sentence-transformers, langchain, langchain-groq, langchain-community, weasyprint, jinja2, matplotlib, boto3, python-jose[cryptography], passlib[bcrypt], python-multipart, slowapi, tenacity, semgrep, bandit, pip-audit, scikit-learn, orjson, httpx, pytest, pytest-asyncio

**4. Environment**
Create `threatlens/.env.example` with all config variables (DATABASE_URL, REDIS_URL, QDRANT_HOST, QDRANT_PORT, GROQ_API_KEY, S3_*, SECRET_KEY, CORS_ORIGINS, DEBUG)

**5. Config**
Create `threatlens/app/config.py` using pydantic-settings BaseSettings loading from .env

**6. Database**
Create `threatlens/app/database.py` with SQLAlchemy async engine, async session factory, Base declarative base.
Connection pool: pool_size=10, max_overflow=20

**7. ORM Models** (create each as separate file)
- `app/models/user.py` — User: UUID PK, email (unique), hashed_password, is_active, created_at
- `app/models/scan.py` — Scan: UUID PK, user_id FK, scan_type enum, target_name, status enum (pending/running/completed/failed), progress int, framework_scores JSON, created_at, completed_at
- `app/models/finding.py` — Finding: UUID PK, scan_id FK, title, description, severity enum, cvss_score float, cvss_vector, cwe_id, cve_id, file_path, line_number, code_snippet text, source, remediation text, created_at
- `app/models/compliance_violation.py` — ComplianceViolation: UUID PK, finding_id FK, framework, control_id, control_title, violation_description, evidence, rag_chunk_ids JSON
- `app/models/report.py` — Report: UUID PK, scan_id FK, pdf_url, signed_url, generated_at
- `app/models/__init__.py` — Import all models

**8. Pydantic Schemas**
- `app/schemas/scan.py` — ScanCreate (scan_type, target_name, frameworks list, git_url optional), ScanResponse, ScanStatusResponse
- `app/schemas/finding.py` — FindingCreate, FindingResponse
- `app/schemas/report.py` — ReportResponse
- `app/schemas/__init__.py`

**9. Celery**
Create `app/tasks/celery_app.py`:
- Celery app with Redis broker and backend
- task_serializer = "json"
- result_expires = 3600
- task_track_started = True

**10. Alembic**
Set up Alembic for migrations:
- alembic.ini pointing to DATABASE_URL from env
- env.py importing Base and all models
- Generate initial migration

**11. FastAPI Main App**
Create `app/main.py`:
- FastAPI instance with title, description, version
- CORS middleware allowing CORS_ORIGINS from config
- /health endpoint returning {"status": "healthy", "service": "threatlens"}
- Mount all API routers (stub for now)

**12. Project Scaffold**
Create all __init__.py files for: app/, models/, schemas/, api/, ingestion/, scanners/, rag/, rag/chunkers/, agent/, agent/prompts/, report/, tasks/

### FRONTEND CONNECTION (do after all backend files)
1. Add `VITE_API_URL=http://localhost:8000` to the frontend `.env` file
2. Create `src/lib/api/client.ts` — Base API client with auth headers (see Backend-Frontend-Connect.md Section 5 Step 2)
3. Create `src/lib/api/types.ts` — All TypeScript interfaces matching the Pydantic schemas (see Backend-Frontend-Connect.md Section 13)
4. Verify CORS: frontend fetch to /health returns 200

### CONSTRAINTS
- All models use UUID as primary key (import uuid, use uuid4 as default)
- All timestamps use datetime.utcnow
- Use Mapped[] and mapped_column() syntax (SQLAlchemy 2.x style)
- Config class must use model_config = SettingsConfigDict(env_file=".env") (Pydantic v2)
- Do NOT use class Config — use model_config dict (Pydantic v2 style)

### VERIFICATION CHECKLIST
After creating all files, verify:
- [ ] docker-compose up -d → 3 containers running (check with docker ps)
- [ ] alembic upgrade head → 5 tables created
- [ ] uvicorn app.main:app --reload --port 8000 → Server starts
- [ ] GET http://localhost:8000/health → {"status": "healthy"}
- [ ] GET http://localhost:8000/docs → Swagger UI
- [ ] celery -A app.tasks.celery_app worker --loglevel=info → Worker connects
- [ ] Frontend fetch("http://localhost:8000/health") → No CORS errors

### CRITICAL REMINDERS
- Use async SQLAlchemy (asyncpg driver, async session)
- No secrets in code — all via .env
- .env must be in .gitignore
- Pydantic v2 syntax (model_config, not class Config)
- SQLAlchemy 2.x syntax (Mapped[], mapped_column, not Column())
```

---

## Prompt 2 — Part 2: RAG Knowledge Base

> **When to use:** After Part 1 is verified (all checklist items pass).

```
### TASK: Implement Part 2 — RAG Knowledge Base

Read these reference files:
- @Part-02-RAG-Knowledge-Base.md
- @plan/Workflow-02-RAG-Pipeline.md
- @Backend-Frontend-Connect.md Section 6

### CURRENT STATE
Part 1 is complete. Docker services running (PostgreSQL, Redis, Qdrant). FastAPI serves /health. Celery worker connects. Frontend API client exists.

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
```

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

### CURRENT STATE
Parts 1–2 complete. Docker running, RAG seeded, frameworks API works, frontend framework selector connected.

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
  - Skip excluded dirs (node_modules, .git, venv, __pycache__, dist, build)
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

**4. POST /scan Endpoint** (`app/api/scans.py`)
- POST /api/v1/scan — Accepts multipart form (file upload) OR JSON body (git_url)
  - Parameters: scan_type, frameworks[], file (optional), git_url (optional)
  - Creates Scan record in DB with status="pending"
  - Dispatches Celery task (stub for now — just set status to "pending")
  - Returns: {"scan_id": uuid, "status": "pending"}
- GET /api/v1/scans — List all scans for current user (no auth yet, return all)
- GET /api/v1/scan/{scan_id}/status — Return status, progress, finding_count
- DELETE /api/v1/scan/{scan_id} — Delete scan and findings
- Register router in main.py

### FRONTEND CONNECTION
1. Create `src/lib/api/scans.ts` with createScanWithFile(), createScanWithGit(), fetchScans(), fetchScanStatus(), deleteScan()
2. Create `src/hooks/useScans.ts` with useScans() and useCreateScan() hooks
3. In `new-scan.tsx`: wire file upload and Git URL input to createScan API
4. In `dashboard.tsx`: replace `SCANS` import with useScans() hook

### CONSTRAINTS
- Always use tempfile.mkdtemp() for temp directories
- Always cleanup temp dirs in finally block
- File size validation: reject uploads > MAX_FILE_SIZE_MB (from config, default 50)
- Git URLs: validate with regex, only https:// allowed
- ZIP extraction: stream (don't load entire ZIP to memory)
- All ingestion functions must be sync (they'll run in Celery worker, not async endpoint)

### VERIFICATION CHECKLIST
- [ ] ZIP upload extracts to temp dir, finds source files
- [ ] Git clone works with a public test repo URL
- [ ] collect_source_files skips node_modules and .git dirs
- [ ] YAML architecture parser extracts services/ports
- [ ] Log parser handles Apache and JSON log formats
- [ ] POST /api/v1/scan with file returns scan_id
- [ ] POST /api/v1/scan with git_url returns scan_id
- [ ] GET /api/v1/scans returns list of scans
- [ ] GET /api/v1/scan/{id}/status returns status object
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

### CURRENT STATE
Parts 1–3 complete. Ingestion layer works (ZIP, Git, YAML, logs). POST /scan endpoint creates scan records. Frontend can submit scans.

### DELIVERABLES

**1. Semgrep Runner** (`app/scanners/semgrep_runner.py`)
- run_semgrep(repo_path: str) → list[FindingCreate]
- Rulesets: p/owasp-top-ten, p/python, p/javascript, p/secrets, p/jwt, p/sql-injection, p/xss
- subprocess.run with 300s timeout, parse JSON output
- Severity mapping: ERROR→critical, WARNING→high, INFO→medium

**2. Bandit Runner** (`app/scanners/bandit_runner.py`)
- run_bandit(repo_path: str) → list[FindingCreate]
- Runs: bandit -r <path> -f json -q
- Severity mapping: HIGH+HIGH→critical, HIGH+*→high, MEDIUM→medium, LOW→low

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

**7. Finding Deduplication** (add to scanners/__init__.py or separate file)
- deduplicate_findings(findings: list) → list
- Key: (file_path, line_number, cwe_id)
- Keep highest severity on collision

**8. Findings API** (update `app/api/scans.py`)
- GET /api/v1/scan/{scan_id}/findings — Return findings with optional filters (?severity=critical&framework=GDPR&source=semgrep)

### FRONTEND CONNECTION
1. Create `src/lib/api/findings.ts` with fetchFindings()
2. Create `src/hooks/useFindings.ts` with useFindings(scanId, filters) hook
3. Create `src/hooks/useScanProgress.ts` with useScanProgress(scanId) hook — polls every 3s, stops on completed/failed
4. In `findings.tsx`: replace `FINDINGS` import with useFindings() hook
5. Add progress bar using useScanProgress() at top of findings page

### CONSTRAINTS
- All subprocess calls: timeout=300 seconds
- Never execute uploaded code — static analysis only
- LLM prompts: wrap code in ``` delimiters to prevent injection
- Groq rate limiting: exponential backoff with tenacity
- File size cap: 8KB per file sent to LLM
- Use --quiet flag on all CLI tools
- All scanner functions are synchronous (for Celery)

### TEST DATA
Create a `tests/fixtures/vulnerable-app/` directory with:
- auth.py — contains hardcoded JWT secret (SECRET_KEY = "super-secret-123")
- db.py — contains SQL injection (f"SELECT * FROM users WHERE id = {user_input}")
- requirements.txt — contains outdated flask==1.0.0

### VERIFICATION CHECKLIST
- [ ] Semgrep detects SQL injection in test db.py
- [ ] Bandit detects hardcoded password in test auth.py
- [ ] Trufflehog detects hardcoded secret key
- [ ] pip-audit reports CVEs in outdated requirements.txt
- [ ] LLM review returns valid JSON findings for auth.py
- [ ] Deduplication removes duplicate findings (same file/line/CWE)
- [ ] GET /scan/{id}/findings returns findings with severity filter
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
- Strip PII before sending to Groq
- Validate Pydantic parse — discard malformed LLM output, log warning

### VERIFICATION CHECKLIST
- [ ] map_finding_to_compliance("Hardcoded JWT Secret") returns 3+ framework violations
- [ ] Violations include GDPR Art.32, ISO A.8.5, PCI Req.8.3.2
- [ ] CVSS scorer returns valid 0.0-10.0 score with vector string
- [ ] Remediation planner returns ordered, actionable steps
- [ ] Executive summary is coherent and professional
- [ ] Retry logic handles Groq 429 without crashing
- [ ] Violations saved to compliance_violations table in PostgreSQL
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

**3. S3 Uploader** (`app/report/uploader.py`)
- upload_pdf(pdf_bytes: bytes, scan_id: str) → str (signed URL)
- If S3 credentials configured: upload to S3/R2, return 1-hour signed URL
- If not configured: save locally to /tmp/reports/, return local path
- Signed URLs expire in 3600 seconds

**4. Report Celery Task** (`app/tasks/report_task.py`)
- generate_pdf_report_task(scan_id: str) — async Celery task
- Load scan data from DB, generate PDF, upload, save Report record

**5. API Endpoints**
- `app/api/reports.py`: POST /api/v1/scan/{scan_id}/report → Trigger generation, return task_id
- `app/api/reports.py`: GET /api/v1/report/{scan_id}/download → Return signed URL
- `app/api/export.py`: GET /api/v1/scan/{scan_id}/export/csv → Stream CSV download
- `app/api/export.py`: GET /api/v1/scan/{scan_id}/export/json → Stream JSON download
- Register routers in main.py

### FRONTEND CONNECTION
1. Create `src/lib/api/reports.ts` with generateReport(), getReportDownloadUrl(), exportFindingsCSV(), exportFindingsJSON()
2. In reports.tsx: replace REPORTS import, add "Generate Report" button, "Download PDF" button
3. In findings.tsx: add "Export CSV" button

### CONSTRAINTS
- PDF must not contain executable JavaScript
- CSV injection protection: prefix =, +, -, @ cells with single quote
- S3 bucket must be private — only signed URLs for access
- Rate limit: max 1 concurrent report generation per user
- Use base64-embedded chart images (no external file deps)
- CSV encoding: UTF-8 BOM for Excel compatibility

### VERIFICATION CHECKLIST
- [ ] Jinja2 templates render valid HTML without errors
- [ ] Compliance chart generates with correct color coding
- [ ] WeasyPrint produces valid, openable PDF
- [ ] PDF has cover page, executive summary, compliance section, findings
- [ ] PDF page breaks are clean (no mid-card splits)
- [ ] S3 upload returns valid signed URL (or local fallback works)
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

### CURRENT STATE
Parts 1–6 complete. All individual components work (ingestion, scanners, compliance mapper, PDF generator). But they're not wired into a single automated pipeline yet. The POST /scan endpoint creates a record but doesn't trigger the full pipeline.

### DELIVERABLES

**1. Full Scan Task** (`app/tasks/scan_task.py`)
Wire the complete pipeline as a Celery task:

```python
@celery_app.task(bind=True, max_retries=3)
def run_full_scan(self, scan_id: str, scan_type: str, source: str, frameworks: list[str]):
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
- Update scan progress in DB at each stage
- Each scanner wrapped in individual try/except (one failing doesn't kill the scan)
- Temp directory cleanup in finally block
- On failure: set scan status to "failed", retry up to 3 times with 60s delay
- On success: set status to "completed", calculate framework_scores

**2. Update POST /scan** (in `app/api/scans.py`)
- After creating scan record, dispatch: run_full_scan.delay(scan_id, scan_type, source_path, frameworks)
- Handle both file upload (save to temp, pass path) and git_url (pass URL directly)

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

### VERIFICATION CHECKLIST
- [ ] Celery worker starts and connects to Redis
- [ ] POST /scan dispatches Celery task (visible in worker logs)
- [ ] Scan progress updates visible via GET /scan/{id}/status
- [ ] Full scan completes: status="completed", progress=100
- [ ] Failed scan retries up to 3 times with 60s delay
- [ ] Temp directories cleaned up after completion
- [ ] Findings persisted in PostgreSQL
- [ ] Compliance violations linked to findings
- [ ] Frontend progress bar animates 0→100%
- [ ] Frontend handles "failed" status with error display
- [ ] Full E2E: upload ZIP → progress → findings → report generation works
```

---

## Prompt 8 — Part 8: Auth + API + Final Integration

> **When to use:** After Part 7 is verified.

```
### TASK: Implement Part 8 — JWT Auth + Rate Limiting + WebSocket + Final Integration

Read these reference files:
- @Part-08-API-Endpoints-Frontend-Integration.md
- @plan/Workflow-06-Full-Integration-Deploy.md (Phase B, C, D)
- @Backend-Frontend-Connect.md Section 12

### CURRENT STATE
Parts 1–7 complete. Full pipeline works end-to-end (upload → scan → findings → compliance → report). But no authentication, no rate limiting, no WebSocket progress.

### DELIVERABLES

**1. JWT Authentication** (`app/api/auth.py`)
- POST /api/v1/auth/register → Create user, hash password (bcrypt), return JWT
- POST /api/v1/auth/login → Verify password, return JWT (24h expiry)
- POST /api/v1/auth/refresh → Refresh expired token (7 day refresh window)
- GET /api/v1/auth/me → Return current user profile
- create_access_token(data: dict) → str (JWT with HS256)
- get_current_user(token) → User dependency for protected routes

**2. Protect All Routes**
Add `user: str = Depends(get_current_user)` to ALL scan and report endpoints.
Users can only access their own scans (filter by user_id).

**3. Rate Limiting** (in `app/main.py`)
- Use slowapi with get_remote_address
- POST /scan: 10/hour
- POST /report: 5/hour
- GET endpoints: 100/minute
- Return 429 with Retry-After header

**4. WebSocket** (`app/api/ws.py`)
- WS /ws/scan/{scan_id} → Real-time scan progress
- Send JSON: {status, progress, finding_count} every 2 seconds
- Close connection on completed/failed

**5. Response Compression**
Add GZipMiddleware to FastAPI app (minimum_size=1000)

**6. Register All Routers** (update `app/main.py`)
Ensure ALL routers are mounted:
- /api/v1/auth → auth router
- /api/v1/scan → scans router
- /api/v1/report → reports router
- /api/v1/frameworks → frameworks router
- /ws → websocket router

### FRONTEND CONNECTION
1. Create `src/lib/api/auth.ts` with login(), register(), logout(), getMe(), isAuthenticated()
2. Create `src/hooks/useAuth.ts` with useAuth() hook (login, register, user, isAuthenticated)
3. Create `src/routes/login.tsx` — Login page with email/password form
4. Create `src/routes/register.tsx` — Registration page
5. In `src/routes/_app.tsx`: add route guard (redirect to /login if no token)
6. Update `src/lib/api/client.ts`: add Authorization header from localStorage
7. Handle 401 responses: clear token, redirect to login

### FINAL CLEANUP
1. Remove all remaining mock-data.ts imports from route files
2. Ensure every page uses API hooks instead of mock data
3. Add loading states (skeleton/spinner) to all pages
4. Add error states to all pages
5. Add empty states to all pages

### CONSTRAINTS
- JWT SECRET_KEY: 64+ random chars from env
- Access tokens: 24h expiry
- bcrypt for password hashing (default rounds)
- CORS: specific frontend origin only (not * in production)
- All request bodies validated by Pydantic
- File upload: validate type, size, content
- Error messages must NOT leak internal details (no stack traces to client)
- Use orjson for faster JSON serialization if possible

### VERIFICATION CHECKLIST
- [ ] POST /auth/register creates user and returns JWT
- [ ] POST /auth/login with correct credentials returns JWT
- [ ] POST /auth/login with wrong password returns 401
- [ ] Protected endpoints return 401 without token
- [ ] Protected endpoints work with valid Bearer token
- [ ] Users can only see their own scans
- [ ] Rate limiting: 11th POST /scan in 1 hour returns 429
- [ ] WebSocket sends real-time progress updates
- [ ] Frontend login form works end-to-end
- [ ] Frontend register form works end-to-end
- [ ] Unauthenticated access redirects to /login
- [ ] Full E2E: register → login → new scan → upload → progress → findings → generate report → download PDF
- [ ] mock-data.ts has zero remaining imports in route files
- [ ] All pages have loading, error, and empty states
```

---

## Usage Summary

| Step | Prompt | What Gets Built | Time Estimate |
|------|--------|-----------------|---------------|
| 0 | Project Context | AI understands the full project | 1 minute |
| 1 | Part 1 | Docker, FastAPI, DB, Celery, API client | 1–2 days |
| 2 | Part 2 | RAG, embedder, chunkers, retriever, frameworks API | 3–5 days |
| 3 | Part 3 | ZIP/Git ingestion, parsers, scan endpoint | 2–3 days |
| 4 | Part 4 | 6 scanners, deduplication, findings API | 3–5 days |
| 5 | Part 5 | LangChain chains, compliance mapper, CVSS | 3–5 days |
| 6 | Part 6 | Jinja2 templates, PDF generator, S3, exports | 3–4 days |
| 7 | Part 7 | Celery pipeline, progress tracking, full E2E | 2–3 days |
| 8 | Part 8 | JWT auth, rate limiting, WebSocket, final polish | 3–5 days |

**Total: ~20–32 days (4–6 weeks)**

### Tips for Best Results

1. **Paste Prompt 0 at the start of EVERY new AI session** — don't assume the AI remembers context
2. **One prompt per session** — don't combine Parts in a single prompt
3. **Verify before advancing** — run every checklist item before moving to the next prompt
4. **Attach the reference files** — when the prompt says `@Part-01-...`, attach that file to the AI conversation if your tool supports it
5. **If the AI gets stuck**, paste the specific reference file content directly into the chat
6. **Save working code before each new prompt** — commit to git after each Part passes verification
