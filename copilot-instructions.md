# ThreatLens — GitHub Copilot Instructions
> **Backend: LLM-Agentic Compliance & Threat Modeling Engine**
> Place this file at `.github/copilot-instructions.md` in the project root.

---

## 1. Project Identity

**ThreatLens** is a full-stack AI-powered cybersecurity audit platform. Users upload a project codebase (ZIP / Git URL), architecture files (YAML/JSON), or server logs. The backend:

1. Runs static analysis tools (Semgrep, Bandit, Trufflehog) on the uploaded codebase
2. Sends source files to an LLM (Llama 3 via Groq API) for deep contextual security review
3. Embeds every finding and queries a Qdrant vector store containing all 5 compliance frameworks
4. Uses a LangChain agent chain to map each vulnerability to exact violated controls
5. Generates a downloadable PDF audit report with findings, compliance violations, patches, and remediation steps

The system supports **modular analysis modes** — users can request any combination of:
- Codebase-only scan (code vulnerabilities + security issues)
- Framework compliance audit only (GDPR / SOC 2 / ISO 27001 / PCI DSS / NIST CSF)
- Full combined report (both code issues + framework violations in one PDF)
- Individual framework reports (e.g., only GDPR compliance PDF)
- Threat modeling only (authentication bypass, attack surface, OWASP Top 10)

Every output mode produces its own structured PDF. No analysis mode is forced — the user selects what they want.

---

## 2. Tech Stack — Exact Versions

| Layer | Library / Tool | Version |
|---|---|---|
| API framework | `fastapi` | `0.115.x` |
| ASGI server | `uvicorn[standard]` | `0.30.x` |
| LLM inference | Groq API (`langchain-groq`) | `0.2.x` |
| LLM model | `llama3-70b-8192` via Groq | — |
| Agent orchestration | `langchain` + `langchain-core` | `0.3.x` |
| Vector store | `qdrant-client` | `1.11.x` |
| Embedding model | `sentence-transformers` (`all-MiniLM-L6-v2`) | `3.1.x` |
| Task queue | `celery` + `redis` | `5.4.x` |
| Database ORM | `sqlalchemy` + `alembic` | `2.0.x` |
| Database | PostgreSQL 15 | — |
| Data validation | `pydantic` v2 | `2.9.x` |
| Static code scan | `semgrep` | `1.90.x` |
| Python AST scan | `bandit` | `1.7.x` |
| Secret scanner | `trufflehog3` | `3.x` |
| Dependency audit | `pip-audit`, `npm-audit` | latest |
| Anomaly detection | `scikit-learn` (IsolationForest) | `1.5.x` |
| PDF generation | `weasyprint` + `jinja2` | `62.x` |
| File storage | `boto3` (S3 / Cloudflare R2) | `1.35.x` |
| Auth | `python-jose[cryptography]` | `3.3.x` |
| Rate limiting | `slowapi` | `0.1.x` |
| Git clone | `gitpython` | `3.1.x` |
| Charts | `matplotlib` | `3.9.x` |
| Containerization | Docker + Docker Compose | v3.9 |
| Deployment | Railway / Render | — |

---

## 3. Project Folder Structure

```
threatlens/
├── .github/
│   └── copilot-instructions.md       ← THIS FILE
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── alembic.ini
├── .env.example
│
├── scripts/
│   ├── seed_rag.py                   ← Run ONCE: embed all 5 frameworks into Qdrant
│   ├── sync_nvd.py                   ← Weekly cron: pull new CVEs from NVD API
│   └── test_scan.py                  ← End-to-end scan smoke test
│
├── data/                             ← Framework source PDFs (gitignored, download separately)
│   ├── gdpr.pdf
│   ├── soc2_tsc.pdf
│   ├── iso27001_2022.pdf
│   ├── pci_dss_v4.pdf
│   └── nist_csf_2_0.pdf
│
└── app/
    ├── main.py                       ← FastAPI app, routers, lifespan
    ├── config.py                     ← Pydantic Settings from .env
    ├── database.py                   ← SQLAlchemy engine, session, Base
    │
    ├── models/                       ← SQLAlchemy ORM table definitions
    │   ├── scan.py                   ← Scan, ScanStatus enum
    │   ├── finding.py                ← Finding (one per vulnerability)
    │   ├── compliance_violation.py   ← Per finding × per framework violations
    │   └── report.py                 ← Generated PDF report metadata
    │
    ├── schemas/                      ← Pydantic v2 request/response models
    │   ├── scan.py
    │   ├── finding.py
    │   ├── compliance.py
    │   └── report.py
    │
    ├── api/                          ← FastAPI route handlers (thin controllers only)
    │   ├── scans.py                  ← POST /scan, GET /scan/{id}/status
    │   ├── findings.py               ← GET /scan/{id}/findings (filter, paginate)
    │   ├── reports.py                ← POST /report, GET /report/{id}/download
    │   ├── frameworks.py             ← GET /frameworks (metadata + coverage stats)
    │   └── export.py                 ← GET /export/csv, /export/json
    │
    ├── ingestion/                    ← Input parsing + file extraction
    │   ├── code_extractor.py         ← ZIP extract, Git clone, file walker
    │   ├── arch_parser.py            ← YAML/JSON architecture parser
    │   └── log_parser.py             ← .log / .pcap ingestion
    │
    ├── scanners/                     ← All static analysis runners
    │   ├── semgrep_runner.py         ← Semgrep subprocess + JSON output parser
    │   ├── bandit_runner.py          ← Bandit AST scanner
    │   ├── trufflehog_runner.py      ← Secret / credential scanner
    │   ├── dependency_audit.py       ← pip-audit + npm audit
    │   ├── llm_code_reviewer.py      ← LLM deep review per file batch
    │   └── log_anomaly.py            ← IsolationForest anomaly detection on logs
    │
    ├── rag/                          ← RAG pipeline: embed → store → retrieve
    │   ├── embedder.py               ← sentence-transformers wrapper (singleton)
    │   ├── qdrant_store.py           ← Qdrant client wrapper (upsert, search)
    │   ├── retriever.py              ← retrieve_relevant_controls(finding, frameworks, k)
    │   └── chunkers/                 ← One chunker per knowledge source
    │       ├── gdpr_chunker.py
    │       ├── soc2_chunker.py
    │       ├── iso27001_chunker.py
    │       ├── pci_chunker.py
    │       ├── nist_chunker.py
    │       ├── owasp_chunker.py
    │       └── cve_chunker.py        ← Reads from NVD API
    │
    ├── agent/                        ← LangChain chain definitions
    │   ├── compliance_mapper.py      ← Core chain: finding + RAG → violations JSON
    │   ├── cvss_scorer.py            ← CVSS 3.1 auto-score chain
    │   ├── remediation_planner.py    ← Ordered remediation steps chain
    │   ├── threat_modeler.py         ← STRIDE / attack surface chain
    │   ├── summary_writer.py         ← Executive summary LLM writer
    │   └── prompts/                  ← All prompt templates (never inline in chains)
    │       ├── classifier.py
    │       ├── compliance.py
    │       ├── remediation.py
    │       ├── threat_model.py
    │       └── summary.py
    │
    ├── report/                       ← PDF generation + upload
    │   ├── generator.py              ← Orchestrates Jinja2 → WeasyPrint → PDF bytes
    │   ├── uploader.py               ← S3/R2 upload + signed URL
    │   ├── chart_builder.py          ← matplotlib compliance score charts (base64)
    │   └── templates/
    │       ├── base.html             ← Master layout (CSS, fonts, page breaks)
    │       ├── cover.html
    │       ├── executive_summary.html
    │       ├── findings_table.html
    │       ├── finding_detail.html   ← Per-finding: code snippet, violated controls, fix
    │       ├── compliance_section.html ← Per-framework section with score + violations
    │       └── remediation_plan.html
    │
    └── tasks/                        ← Celery async task definitions
        ├── celery_app.py             ← Celery app factory + Redis broker config
        ├── scan_task.py              ← run_full_scan() Celery task
        └── report_task.py            ← generate_report() Celery task
```

---

## 4. Core Architecture Rules

### 4.1 Always Follow This Pattern in Every Module

```
API route → validate with Pydantic → dispatch Celery task → return task_id
Celery task → update DB progress → run pipeline → save results → mark complete
```

**Routes are thin.** They validate input, dispatch to Celery, and return immediately. Zero business logic in `api/` files.

**Tasks are fat.** All scanning, embedding, LLM calls, and DB writes happen in Celery tasks.

### 4.2 Async Rules

- FastAPI route handlers: use `async def` when doing I/O (file upload, DB read)
- Celery tasks: use standard `def` (Celery runs in separate processes)
- LLM calls via LangChain: always wrap in `try/except` with retry logic
- Database sessions: always use `with get_db() as db:` context manager, never pass raw session objects across functions

### 4.3 Type Hints — Mandatory Everywhere

Every function must have:
- Full type hints on all parameters
- Return type annotation
- Docstring with Args + Returns for non-trivial functions

```python
# CORRECT
def retrieve_relevant_controls(
    finding_text: str,
    frameworks: list[str] | None = None,
    top_k: int = 10,
) -> list[dict[str, str]]:
    """
    Embed the finding text and retrieve matching compliance clauses from Qdrant.

    Args:
        finding_text: The vulnerability description to embed and search.
        frameworks: Optional list of framework IDs to filter results.
                    e.g. ["GDPR", "PCI_DSS"]. None = search all.
        top_k: Number of top matching chunks to return.

    Returns:
        List of dicts with keys: framework, control_id, control_title, text, score
    """

# WRONG — no type hints, no docstring
def retrieve(text, fw=None, k=10):
    ...
```

### 4.4 Pydantic v2 — Use Everywhere for Data Validation

- All API request bodies: Pydantic `BaseModel`
- All API responses: Pydantic `BaseModel` with `model_config = ConfigDict(from_attributes=True)`
- All LLM structured outputs: `PydanticOutputParser` from LangChain
- Never use plain `dict` to pass structured data between layers — always use typed Pydantic models

### 4.5 Error Handling — Standardized

```python
# Every LLM call follows this pattern:
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    reraise=True,
)
def call_llm_with_retry(chain, inputs: dict) -> Any:
    return chain.invoke(inputs)
```

```python
# Every Celery task follows this pattern:
@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def some_task(self, scan_id: str) -> None:
    try:
        # ... work ...
    except SomeRecoverableError as exc:
        raise self.retry(exc=exc)
    except Exception as exc:
        update_scan_status(scan_id, "failed", error=str(exc))
        raise
```

---

## 5. RAG Pipeline — Step-by-Step Build Rules

### 5.1 What RAG Does in This Project

RAG is used to ground the LLM in specific regulatory text. Without RAG, the LLM guesses which compliance article applies. With RAG, it reads the exact clause retrieved from the vector store and maps to it directly.

```
Finding description text
    → embed (all-MiniLM-L6-v2, 384 dims)
    → Qdrant cosine similarity search (filter by framework if requested)
    → top-k most relevant compliance clauses returned
    → clauses + finding packed into LLM context window
    → LLM outputs exact control IDs, violation text, evidence
```

### 5.2 Qdrant Collection Schema

Every chunk in Qdrant must have this payload metadata structure:
```python
{
    "framework":      "GDPR",               # GDPR | SOC2 | ISO27001 | PCI_DSS | NIST_CSF | NVD | OWASP | CWE
    "control_id":     "Art.32",             # Exact article / control / requirement ID
    "control_title":  "Security of processing",
    "category":       "data_security",      # Human-readable category tag
    "severity_weight": 0.9,                 # 0.0–1.0, used for reranking
    "text":           "Full chunk text...", # The actual content for LLM context
    "source_doc":     "gdpr_official.pdf",
    "chunk_index":    42,
}
```

### 5.3 Chunking Rules Per Framework

| Framework | Chunk Unit | Key Controls to Prioritize |
|---|---|---|
| GDPR | One Article per chunk | Art. 5, 25, 32, 33, 34, 35, 83 |
| SOC 2 | One TSC control point (CC#.#) | CC6.1, CC6.6, CC7.1, CC7.2, CC8.1 |
| ISO 27001 | One Annex A control | A.5.14, A.8.2, A.8.5, A.8.7, A.8.24, A.8.25, A.8.28 |
| PCI DSS | One sub-requirement | Req. 2.2.7, 6.2.4, 6.3.3, 8.3.2, 8.3.4, 10.2.1, 11.3.1 |
| NIST CSF | One subcategory (FN.XX-##) | PR.AA-01/02/05, PR.DS-01/02, DE.CM-01, RS.MA-01 |
| NVD CVEs | One CVE entry | Include CVSS vector, CWE ID, description |
| OWASP | One Top 10 category | A01–A10 2021 list |

Chunk size: **300–500 tokens** per chunk. Use `RecursiveCharacterTextSplitter` with `chunk_size=1500, chunk_overlap=100` (character count, ~500 tokens average).

### 5.4 Retriever Function Rules

```python
# app/rag/retriever.py — always use this signature
def retrieve_relevant_controls(
    finding_text: str,
    frameworks: list[str] | None = None,
    top_k: int = 10,
    min_score: float = 0.55,
) -> list[dict]:
```

- `min_score=0.55` — discard low-relevance results below this cosine threshold
- When `frameworks` is provided, use Qdrant `Filter(should=[...])` to restrict to those frameworks
- Sort results by score descending before returning
- Cache the `SentenceTransformer` model as a module-level singleton — never re-instantiate per call

### 5.5 Seeding Script Rules (`scripts/seed_rag.py`)

- Run this once at project setup, then only when frameworks update
- Batch upserts in groups of 100 points to avoid Qdrant timeouts
- Print progress: `Seeded GDPR: 89 chunks | SOC2: 67 chunks | ...`
- Check if collection already exists before recreating — use `recreate_collection()` only with `--force` flag
- Log total chunk count at end

---

## 6. Scanning Pipeline — Step-by-Step Rules

### 6.1 Codebase Upload Flow

```
POST /api/v1/scan
  → save uploaded ZIP to /tmp/{scan_id}_{filename}
  → OR git.Repo.clone_from(git_url, tmp_dir, depth=1)
  → dispatch run_full_scan.delay(scan_id, scan_type, path, frameworks)
  → return {"scan_id": scan_id, "status": "pending"}
```

### 6.2 Static Analysis — Semgrep Rules

Always run these Semgrep rulesets:
```python
SEMGREP_RULESETS = [
    "p/owasp-top-ten",       # OWASP Top 10 coverage
    "p/python",               # Python-specific patterns
    "p/javascript",           # JS/TS patterns
    "p/secrets",              # Exposed credentials
    "p/supply-chain",         # Dependency issues
    "p/jwt",                  # JWT misuse
    "p/sql-injection",        # SQLi detection
    "p/xss",                  # Cross-site scripting
    "p/command-injection",    # OS command injection
]
```

Run Semgrep as: `semgrep scan --config {",".join(RULESETS)} --json --quiet {repo_path}`

Parse Semgrep severity → internal severity:
```python
SEVERITY_MAP = {"ERROR": "critical", "WARNING": "high", "INFO": "medium"}
```

### 6.3 Bandit Rules (Python Only)

Skip non-Python repos. Detect Python files by extension before running.
Run as: `bandit -r {repo_path} -f json -q`

Map Bandit severity:
- `HIGH` + `HIGH` confidence → `critical`
- `HIGH` + `MEDIUM` → `high`
- `MEDIUM` → `medium`
- else → `low`

### 6.4 Trufflehog Rules

Run as: `trufflehog filesystem {repo_path} --json --no-update`

Every Trufflehog hit is **critical severity** — hardcoded secrets/credentials are always critical. Always set `cwe_id = "CWE-798"`.

### 6.5 LLM Deep Code Review Rules

- Only review files in `SUPPORTED_EXTENSIONS` (see `code_extractor.py`)
- Cap at 30 files per scan to stay within Groq rate limits
- Truncate files to 8000 characters before sending
- Use `temperature=0` on the LLM — deterministic output required for audits
- Always use `PydanticOutputParser` — never parse LLM JSON manually with regex
- If LLM returns malformed JSON, log the raw output and return empty list — never crash the scan

### 6.6 Log Analysis Rules

Log anomaly detection order:
1. Rule-based patterns first (brute force: >50 401s, SQLi in URL params, unusual HTTP methods)
2. Isolation Forest on numeric log features (status code distribution, request rate, byte sizes)
3. Each pattern must produce a `Finding` with `source="log"`

### 6.7 Finding Deduplication

Before saving to DB, deduplicate findings by fingerprint:
```python
fingerprint = hashlib.md5(
    f"{finding.title}:{finding.file_path}:{finding.line_number}".encode()
).hexdigest()
```
Same fingerprint from multiple scanners → keep highest severity, merge source field as `"semgrep+llm"`.

---

## 7. LangChain Agent Chain Rules

### 7.1 Chain Architecture

There are 4 chains. Run them in this order per finding:

```
Chain 1: classify_and_score(finding) → severity, cvss_score, cvss_vector
Chain 2: map_to_compliance(finding, rag_chunks) → list[FrameworkViolation]
Chain 3: plan_remediation(finding, violations) → list[str] remediation steps
Chain 4: write_evidence_summary(finding, violations) → str evidence paragraph
```

### 7.2 LLM Config — Always Use These Settings

```python
from langchain_groq import ChatGroq

llm = ChatGroq(
    model="llama3-70b-8192",
    temperature=0,             # Deterministic — mandatory for audit outputs
    max_tokens=2048,
    timeout=30,
    max_retries=3,
)
```

Never use `temperature > 0` in any security analysis chain. Determinism is required for reproducible audits.

### 7.3 Pydantic Output Models for Agent Chains

```python
# All LLM structured outputs use these models — never return raw strings

class FrameworkViolation(BaseModel):
    framework: Literal["GDPR", "SOC2", "ISO27001", "PCI_DSS", "NIST_CSF"]
    control_id: str       # e.g. "Art.32", "CC6.1", "A.8.5", "Req.8.3.2"
    control_title: str
    violation_description: str
    evidence: str         # Exact evidence from the finding text

class ComplianceMappingResult(BaseModel):
    violations: list[FrameworkViolation]
    cvss_score: float = Field(ge=0.0, le=10.0)
    cvss_vector: str
    remediation_steps: list[str]
    remediation_priority: Literal["immediate", "short-term", "long-term"]
```

### 7.4 Prompt Rules

- All prompts live in `app/agent/prompts/` — never inline prompts in chain files
- Every prompt must include: role definition, output format spec (JSON), example, constraint
- Always include `{format_instructions}` from `PydanticOutputParser.get_format_instructions()`
- Instruct the LLM: "Only map to a control if there is a direct, demonstrable violation. Do not speculate."

---

## 8. Report Generation Rules

### 8.1 What Each Report Mode Produces

| Mode | PDF Sections |
|---|---|
| `full_audit` | Cover + Executive Summary + All Findings + All 5 Framework Sections + Remediation Plan |
| `code_only` | Cover + Vulnerability Summary + Code Findings (by severity) + Patch Recommendations |
| `framework_only` | Cover + Compliance Posture Dashboard + Per-Framework Violation Details |
| `gdpr_only` | Cover + GDPR-specific findings + Violated articles + Action items |
| `soc2_only` | Cover + SOC 2 TSC violations + Evidence gaps + Control recommendations |
| `iso_only` | Cover + ISO 27001 Annex A gaps + Risk assessment table |
| `pci_only` | Cover + PCI DSS requirement violations + Compensating controls table |
| `nist_only` | Cover + NIST CSF function gaps + Maturity level assessment |
| `threat_model` | Cover + STRIDE analysis + Attack surface map + Authentication flow review |

### 8.2 PDF Generation Rules

- Use `WeasyPrint` + `Jinja2` — always render HTML first, then convert to PDF
- All CSS must be inline or in `<style>` tags — WeasyPrint does not load external CSS files
- Font: use `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap')` for body, `JetBrains Mono` for code snippets
- Page breaks: add `page-break-before: always` on every major section's outer `<div>`
- Code snippets: render in `<pre><code>` blocks with dark background (#1a1a2e), monospace font
- Compliance score charts: generate with matplotlib, encode as base64, embed as `<img src="data:image/png;base64,..."/>`

### 8.3 WeasyPrint Page Setup

```css
@page {
    size: A4;
    margin: 2cm 2.5cm 2cm 2.5cm;
    @bottom-center {
        content: "ThreatLens AI Audit · Confidential · Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #999;
    }
}
```

### 8.4 PDF Storage + Delivery

- After PDF generation, upload bytes to S3/R2 using `boto3`
- Key pattern: `reports/{scan_id}/{report_type}_{timestamp}.pdf`
- Return a presigned URL with 1-hour expiry to the frontend
- Store the signed URL and expiry in the `reports` table

---

## 9. API Endpoints — Full Reference

### 9.1 All Endpoints

```
POST   /api/v1/scan                           Start a new scan
GET    /api/v1/scan/{scan_id}/status          Poll scan progress (0–100%)
GET    /api/v1/scan/{scan_id}/findings        Get findings (filter: severity, framework, source)
POST   /api/v1/scan/{scan_id}/report          Generate a PDF report
GET    /api/v1/report/{scan_id}/download      Get presigned PDF download URL
GET    /api/v1/scan/{scan_id}/export/csv      Export findings as CSV
GET    /api/v1/scan/{scan_id}/export/json     Export findings as structured JSON
GET    /api/v1/frameworks                     List frameworks + chunk coverage stats
GET    /api/v1/health                         Health check (DB, Redis, Qdrant connectivity)
WS     /ws/scan/{scan_id}/progress            WebSocket for real-time progress stream
```

### 9.2 POST /api/v1/scan — Request Body

```python
class ScanRequest(BaseModel):
    scan_type: Literal[
        "codebase",        # Code-only scan
        "architecture",    # YAML/JSON arch + logs
        "framework",       # Compliance audit only (no code needed)
        "full",            # Everything
    ]
    frameworks: list[Literal["GDPR", "SOC2", "ISO27001", "PCI_DSS", "NIST_CSF"]] = [
        "GDPR", "SOC2", "ISO27001", "PCI_DSS", "NIST_CSF"
    ]
    report_modes: list[Literal[
        "full_audit", "code_only", "framework_only",
        "gdpr_only", "soc2_only", "iso_only", "pci_only", "nist_only", "threat_model"
    ]] = ["full_audit"]
    git_url: str | None = None    # Mutually exclusive with file upload
```

File is accepted as `multipart/form-data`. `git_url` is accepted as a query param or form field.

### 9.3 GET /api/v1/scan/{scan_id}/status — Response

```python
class ScanStatusResponse(BaseModel):
    scan_id: str
    status: Literal["pending", "running", "completed", "failed"]
    progress: int              # 0–100
    current_step: str          # e.g. "Running Semgrep...", "Mapping to GDPR..."
    finding_count: int
    elapsed_seconds: float
    error: str | None
```

### 9.4 Standard Error Response

All errors must return this shape:
```python
class ErrorResponse(BaseModel):
    detail: str
    code: str       # e.g. "SCAN_NOT_FOUND", "INVALID_FILE_TYPE", "RATE_LIMIT_EXCEEDED"
    scan_id: str | None = None
```

---

## 10. Database Schema Rules

### 10.1 All Models Must Have These Base Fields

```python
class Base:
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

Use `UUID` primary keys everywhere — never use auto-increment integers.

### 10.2 Scan Progress Tracking

`Scan.progress` is an integer 0–100 updated by the Celery task at every major step:

| Progress | Milestone |
|---|---|
| 5 | Files extracted |
| 15 | Semgrep complete |
| 30 | Bandit + Trufflehog complete |
| 50 | LLM code review complete |
| 65 | Dependency audit + dedup complete |
| 75 | RAG retrieval complete |
| 90 | Compliance mapping complete |
| 95 | Report generation complete |
| 100 | Scan fully complete |

### 10.3 Migration Rules

- Every schema change = new Alembic migration: `alembic revision --autogenerate -m "description"`
- Never modify existing migration files — always add a new one
- Migration file names follow: `{timestamp}_{snake_case_description}.py`

---

## 11. Security Rules — Apply to All Code Generated

These rules apply to every file Copilot generates in this project.

### 11.1 Authentication

- All endpoints (except `/health`) require JWT Bearer token
- Use `python-jose` for JWT encode/decode
- Token payload must include: `user_id`, `email`, `exp`, `iat`
- Never store JWT secrets in code — always read from `settings.SECRET_KEY`

### 11.2 Input Validation

- Maximum upload file size: 50 MB (enforced at FastAPI middleware level)
- Allowed file extensions for code: `.py .js .ts .jsx .tsx .java .go .rb .php .cs .cpp .c .rs .yaml .yml .json .env .toml .cfg .ini .sh .tf .dockerfile`
- Git URLs: validate with regex — only `https://github.com/`, `https://gitlab.com/`, `https://bitbucket.org/`
- Sanitize all file paths — never allow path traversal (`../`)
- Reject ZIP files larger than 50 MB before extraction

### 11.3 Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/v1/scan")
@limiter.limit("5/minute")    # 5 scan starts per minute per IP
async def create_scan(...): ...
```

### 11.4 Sensitive Data

- Never log: JWT tokens, API keys, raw file content, user PII
- Never store: raw source code in PostgreSQL (it stays on disk in /tmp only)
- Environment variables via `.env` + `pydantic-settings` Settings class — never hardcode
- Groq API key must come from `settings.GROQ_API_KEY` only

### 11.5 Subprocess Security (Scanner Runners)

All `subprocess.run()` calls must:
- Use `capture_output=True`
- Set `timeout=300` (5 min max per scanner)
- Never use `shell=True` — always pass a list
- Sanitize the `repo_path` argument before passing to subprocess

```python
# CORRECT
subprocess.run(["semgrep", "scan", "--json", repo_path], capture_output=True, timeout=300)

# WRONG — shell injection risk
subprocess.run(f"semgrep scan {repo_path}", shell=True)
```

---

## 12. Celery Task Rules

### 12.1 Task Naming Convention

All tasks named as: `threatlens.tasks.{module}.{function_name}`

```python
@celery_app.task(
    bind=True,
    name="threatlens.tasks.scan.run_full_scan",
    max_retries=3,
    default_retry_delay=60,
    soft_time_limit=1800,     # 30 min soft limit
    time_limit=2100,          # 35 min hard kill
)
```

### 12.2 Progress Updates in Tasks

Every major step in a Celery task must call:
```python
update_scan_progress(db, scan_id, progress=25, current_step="Running Bandit analysis...")
```

This enables the WebSocket endpoint to stream live progress to the frontend.

### 12.3 Celery Queues

Use separate queues for different job types:
```python
# celery_app.py
app.conf.task_routes = {
    "threatlens.tasks.scan.*":   {"queue": "scans"},
    "threatlens.tasks.report.*": {"queue": "reports"},
}
```

Start workers with: `celery -A app.tasks.celery_app worker -Q scans,reports --loglevel=info`

---

## 13. Compliance Framework Rules Reference

When Copilot generates compliance mapping logic or LLM prompts, use this as the authoritative source of truth.

### 13.1 GDPR Violation Map

| Security Issue | Violated Article | Article Name |
|---|---|---|
| Unencrypted personal data at rest | Art. 32 §1a | Security of processing |
| No access control on personal data endpoint | Art. 32 §1b | Confidentiality and integrity |
| Hardcoded credentials accessing personal data | Art. 25 | Data protection by design |
| No breach notification plan | Art. 33 | 72-hour notification obligation |
| No Data Protection Impact Assessment | Art. 35 | DPIA requirement |
| Excessive data collection | Art. 5 §1c | Data minimisation principle |
| No encryption on data transit | Art. 32 §1a | Appropriate technical measures |
| Max fine tier | Art. 83 §5 | €20M or 4% global annual turnover |

### 13.2 SOC 2 Violation Map

| Security Issue | Violated Control | TSC Category |
|---|---|---|
| No MFA on admin accounts | CC6.1 | Logical & Physical Access |
| Unencrypted admin panel access | CC6.7 | Logical & Physical Access |
| Open ports / exposed management interfaces | CC6.6 | Logical & Physical Access |
| No IDS / anomaly detection | CC7.2 | System Operations |
| No vulnerability scanning process | CC7.1 | System Operations |
| No change management procedure | CC8.1 | Change Management |
| Third-party vendor risk not assessed | CC9.2 | Risk Mitigation |

### 13.3 ISO 27001 Violation Map

| Security Issue | Violated Control | Annex A Domain |
|---|---|---|
| Hardcoded credentials | A.8.5 | Access Management |
| No patch management | A.8.8 | Technical Vulnerability Mgmt |
| Insecure direct object reference | A.8.3 | Information Access Restriction |
| Cleartext network traffic | A.8.24 | Use of Cryptography |
| No security code review | A.8.28 | Secure Coding |
| Missing access logs | A.8.15 | Logging |
| No incident response plan | A.5.24 | Incident Management Planning |
| Malware not protected | A.8.7 | Protection Against Malware |

### 13.4 PCI DSS v4.0 Violation Map

| Security Issue | Violated Requirement | PCI Goal |
|---|---|---|
| Default or weak credentials | Req. 2.1 | Apply secure configs |
| SQL injection vulnerability | Req. 6.2.4 | Prevent common attacks |
| Unpatched software/dependencies | Req. 6.3.3 | Protect from known vulns |
| Excessive user access rights | Req. 7.2.1 | Need-to-know access |
| Shared admin accounts | Req. 8.2.1 | Unique user IDs |
| Weak password complexity | Req. 8.3.6 | Password complexity rules |
| No audit log for data access | Req. 10.2.1 | Audit log requirements |
| No internal vuln scans | Req. 11.3.1 | Quarterly internal scans |
| TLS 1.0/1.1 in use | Req. 4.2.1 | Strong cryptography in transit |

### 13.5 NIST CSF 2.0 Violation Map

| Security Issue | Violated Subcategory | CSF Function |
|---|---|---|
| No asset inventory | ID.AM-01 / ID.AM-02 | Identify |
| No risk assessment process | ID.RA-01 | Identify |
| Unmanaged user access | PR.AA-05 | Protect |
| Weak or no authentication | PR.AA-02 | Protect |
| Unencrypted sensitive data | PR.DS-01 | Protect |
| Cleartext data in transit | PR.DS-02 | Protect |
| No network traffic monitoring | DE.CM-01 | Detect |
| No anomaly detection | DE.AE-02 | Detect |
| No incident response plan | RS.MA-01 | Respond |
| No backup/recovery plan | RC.RP-01 | Recover |

---

## 14. Environment Variables Reference

All settings must come from `app/config.py` using `pydantic-settings`:

```python
class Settings(BaseSettings):
    # Groq
    GROQ_API_KEY: str

    # Postgres
    DATABASE_URL: str                     # postgresql://user:pass@host:5432/db

    # Redis / Celery
    REDIS_URL: str                        # redis://localhost:6379/0

    # Qdrant
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "compliance_knowledge"

    # Storage (S3 or Cloudflare R2)
    S3_BUCKET_NAME: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_ENDPOINT_URL: str                  # https://account.r2.cloudflarestorage.com

    # App
    SECRET_KEY: str
    DEBUG: bool = False
    MAX_FILE_SIZE_MB: int = 50
    SCAN_TIMEOUT_SECONDS: int = 1800
    MAX_FILES_PER_SCAN: int = 30

    model_config = SettingsConfig(env_file=".env")

settings = Settings()
```

Never use `os.getenv()` directly — always use `settings.VARIABLE_NAME`.

---

## 15. Testing Rules

### 15.1 Test File Naming

```
tests/
├── test_api_scans.py         ← FastAPI route tests (TestClient)
├── test_scanners.py          ← Semgrep, Bandit, Trufflehog unit tests
├── test_rag.py               ← Retriever + chunker tests
├── test_agent.py             ← LangChain chain tests (mock Groq)
├── test_report.py            ← PDF generation tests
└── conftest.py               ← Fixtures: db, client, sample scan data
```

### 15.2 Test Rules

- Mock Groq API calls in all unit tests — never call real API in tests
- Use `pytest-asyncio` for async route tests
- Every scanner runner must have a test with a known-vulnerable file fixture
- Every RAG retriever test must assert specific framework control IDs are returned
- Run tests with: `pytest tests/ -v --tb=short`

---

## 16. Docker Compose Services

```yaml
services:
  api:       FastAPI on port 8000
  worker:    Celery worker (queues: scans, reports)
  beat:      Celery beat (scheduled CVE sync)
  postgres:  PostgreSQL 15 on port 5432
  redis:     Redis 7 on port 6379
  qdrant:    Qdrant latest on port 6333
```

Start all: `docker-compose up -d`
Seed RAG:  `docker-compose exec api python scripts/seed_rag.py`
Migrate:   `docker-compose exec api alembic upgrade head`

---

## 17. What NOT to Do — Anti-Patterns to Avoid

- **Never** use `shell=True` in subprocess calls (injection risk)
- **Never** call `SentenceTransformer(...)` inside a request handler — use the module singleton
- **Never** inline prompt strings in chain files — put them in `app/agent/prompts/`
- **Never** parse LLM JSON output with regex — always use `PydanticOutputParser`
- **Never** store raw source code in PostgreSQL — keep it in /tmp only
- **Never** commit `.env` files — use `.env.example` with placeholder values
- **Never** use `temperature > 0` for any security analysis LLM call
- **Never** return HTTP 200 for errors — use proper status codes (400, 422, 500)
- **Never** put business logic in FastAPI route handlers — routes dispatch to tasks only
- **Never** use `dict` for structured inter-layer data — use Pydantic models

---

## 18. Copilot — How to Use This File Effectively

When asking Copilot to generate code in this project:

- Specify the target file path so Copilot applies the right module rules
- Mention the specific chain or scanner you're building
- Ask for type hints, docstrings, and error handling explicitly
- Reference the framework violation maps in Section 13 when building prompt templates
- For new endpoints, ask Copilot to follow the "thin route + Celery dispatch" pattern from Section 4.1

Example prompt to Copilot: *"Generate the `retrieve_relevant_controls` function in `app/rag/retriever.py` following the signature in the copilot-instructions.md, using Qdrant cosine search with optional framework filter and min_score threshold."*

---

*ThreatLens copilot-instructions.md · Backend v1.0 · Last updated: 2025 · Place at .github/copilot-instructions.md*
