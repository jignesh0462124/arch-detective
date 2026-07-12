# CollegeProject

# ThreatLens — LLM-Agentic Compliance & Threat Modeling Engine

### Complete Build Guide · Backend + RAG + Codebase Analysis + PDF Reports

---

## Table of Contents

1. [Project Overview](about:blank#1-project-overview)
2. [System Architecture](about:blank#2-system-architecture)
3. [Tech Stack](about:blank#3-tech-stack)
4. [Project Structure](about:blank#4-project-structure)
5. [Environment Setup](about:blank#5-environment-setup)
6. [Database Schema](about:blank#6-database-schema)
7. [RAG Knowledge Base — All 5 Frameworks](about:blank#7-rag-knowledge-base--all-5-frameworks)
8. [Input Ingestion Layer](about:blank#8-input-ingestion-layer)
9. [Codebase Scanner](about:blank#9-codebase-scanner)
10. [Architecture & Log Scanner](about:blank#10-architecture--log-scanner)
11. [LangChain Agent — Compliance Mapper](about:blank#11-langchain-agent--compliance-mapper)
12. [PDF Report Generator](about:blank#12-pdf-report-generator)
13. [FastAPI Endpoints](about:blank#13-fastapi-endpoints)
14. [Celery Async Task Queue](about:blank#14-celery-async-task-queue)
15. [Framework Compliance Rules Reference](about:blank#15-framework-compliance-rules-reference)
16. [10-Week Build Plan](about:blank#16-10-week-build-plan)
17. [Dependencies — Full Install List](about:blank#17-dependencies--full-install-list)
18. [Deployment](about:blank#18-deployment)

---

## 1. Project Overview

### The Problem

Security auditing is manual, slow, and disconnected from compliance law. A developer finding a hardcoded JWT secret has no idea it violates GDPR Article 25, SOC 2 CC6.1, PCI DSS Requirement 8.3.2, ISO 27001 Annex A.8.5, and NIST CSF PR.AA-2 simultaneously. Mapping findings to frameworks requires a compliance lawyer + a security engineer working together for weeks.

### What ThreatLens Does

1. User uploads a codebase (ZIP or Git URL), architecture YAML/JSON, or server logs
2. Static analysis tools (Semgrep, Bandit, Trufflehog) scan the codebase automatically
3. An LLM agent (Llama 3 via Groq) performs deep contextual security review
4. Each finding is embedded and matched against a vector store containing all 5 compliance frameworks
5. The LLM maps every vulnerability to exact articles/controls across GDPR, SOC 2, ISO 27001, PCI DSS v4, NIST CSF 2.0
6. A formatted PDF audit report is generated with severity scores, violated controls, and remediation steps

### Why RAG + API (No Local Model)

- **Groq API** runs Llama 3 70B at ~300 tokens/second — faster than any local setup
- **Qdrant** stores 10,000+ compliance document chunks as vectors — retrieved fresh per scan
- **No GPU required** — runs on any VPS with 2GB RAM
- **Zero latency** from model loading — API is instant
- The LLM never “remembers” compliance rules — it retrieves them live, making every citation traceable and auditable

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INPUTS                              │
│  Codebase ZIP/Git  │  Architecture YAML  │  Server Logs (.log) │
└──────────────┬──────────────────────────────────────────────────┘
               │  POST /api/v1/scan
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI (REST Layer)                          │
│  /scan  /status  /report  /export  /frameworks                 │
└──────────────┬──────────────────────────────────────────────────┘
               │  Celery task dispatch
               ▼
┌────────────────────────┐    ┌────────────────────────────────────┐
│   TRACK A: CODE SCAN   │    │   TRACK B: ARCH/LOG SCAN           │
│                        │    │                                    │
│  ① Semgrep             │    │  ① YAML/JSON parser                │
│  ② Bandit              │    │  ② Port/exposure checker           │
│  ③ Trufflehog          │    │  ③ Log anomaly detection           │
│  ④ pip-audit/npm-audit │    │  ④ Network flow analysis           │
│  ⑤ LLM deep review     │    │  ⑤ LLM context parse               │
└──────────┬─────────────┘    └─────────────────┬──────────────────┘
           │                                     │
           └──────────────┬──────────────────────┘
                          │  Unified VulnerabilityReport{}
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              RAG COMPLIANCE ENGINE (Qdrant)                     │
│                                                                 │
│  Per Finding:                                                   │
│  finding_text → embed → cosine search → top-10 clauses         │
│                                                                 │
│  Knowledge Base:                                                │
│  GDPR chunks │ SOC2 chunks │ ISO chunks │ PCI chunks │ NIST     │
│  NVD CVEs    │ OWASP Top10 │ CWE entries                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │  finding + retrieved clauses
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           LangChain Agent Chain (Groq · Llama 3 70B)           │
│                                                                 │
│  Chain 1: Vulnerability classifier + CVSS scorer               │
│  Chain 2: Compliance mapper (framework → violated controls)     │
│  Chain 3: Remediation planner                                   │
│  Chain 4: Executive summary writer                              │
│                                                                 │
│  Output: Structured JSON → PostgreSQL                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   REPORT GENERATOR                              │
│                                                                 │
│  Jinja2 HTML template → WeasyPrint → PDF                       │
│  S3/Cloudflare R2 upload → Signed URL returned                 │
│  CSV/JSON export endpoints                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Why |
| --- | --- | --- |
| API framework | FastAPI + Uvicorn | Async, auto OpenAPI docs |
| LLM inference | Groq API (Llama 3 70B) | 300 tok/s, free tier available |
| LLM orchestration | LangChain | Agent chains, prompt management |
| Vector store | Qdrant | Fast cosine search, metadata filtering |
| Embedding model | sentence-transformers all-MiniLM-L6-v2 | 384-dim, fast, free |
| Task queue | Celery + Redis | Async heavy jobs |
| Database | PostgreSQL + SQLAlchemy | Structured findings storage |
| Migrations | Alembic | DB version control |
| Static code scan | Semgrep | 1000+ security rules |
| Python vuln scan | Bandit | AST-based Python analysis |
| Secret scanner | Trufflehog | Git history + file secrets |
| Dependency audit | pip-audit, npm-audit | CVE-matched dependencies |
| Anomaly detection | scikit-learn (Isolation Forest) | Log anomaly detection |
| PDF generation | WeasyPrint + Jinja2 | HTML → PDF with full CSS |
| File storage | AWS S3 / Cloudflare R2 | PDF report storage |
| Containerization | Docker + Docker Compose | Reproducible environment |
| Deployment | Railway / Render | Free tier, easy deploy |

---

## 4. Project Structure

```
threatlens/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env.example
├── alembic/
│   ├── alembic.ini
│   └── versions/
├── scripts/
│   ├── seed_rag.py          ← Run once: embed all 5 frameworks
│   ├── sync_nvd.py          ← Weekly cron: update CVE database
│   └── test_scan.py         ← Test a scan end-to-end
├── app/
│   ├── main.py              ← FastAPI app entry point
│   ├── config.py            ← Settings from .env
│   ├── database.py          ← SQLAlchemy engine + session
│   │
│   ├── models/              ← SQLAlchemy ORM models
│   │   ├── scan.py
│   │   ├── finding.py
│   │   ├── compliance_violation.py
│   │   └── report.py
│   │
│   ├── schemas/             ← Pydantic request/response schemas
│   │   ├── scan.py
│   │   ├── finding.py
│   │   └── report.py
│   │
│   ├── api/                 ← FastAPI route handlers
│   │   ├── scans.py
│   │   ├── reports.py
│   │   ├── frameworks.py
│   │   └── export.py
│   │
│   ├── ingestion/           ← File parsing layer
│   │   ├── code_extractor.py
│   │   ├── arch_parser.py
│   │   └── log_parser.py
│   │
│   ├── scanners/            ← Static analysis runners
│   │   ├── semgrep_runner.py
│   │   ├── bandit_runner.py
│   │   ├── trufflehog_runner.py
│   │   ├── dependency_audit.py
│   │   └── log_anomaly.py
│   │
│   ├── rag/                 ← Vector store + retrieval
│   │   ├── embedder.py
│   │   ├── qdrant_client.py
│   │   ├── retriever.py
│   │   └── chunkers/
│   │       ├── gdpr_chunker.py
│   │       ├── soc2_chunker.py
│   │       ├── iso27001_chunker.py
│   │       ├── pci_chunker.py
│   │       ├── nist_chunker.py
│   │       └── cve_chunker.py
│   │
│   ├── agent/               ← LangChain agent chains
│   │   ├── compliance_mapper.py
│   │   ├── cvss_scorer.py
│   │   ├── remediation_planner.py
│   │   ├── summary_writer.py
│   │   └── prompts/
│   │       ├── classifier.py
│   │       ├── compliance.py
│   │       ├── remediation.py
│   │       └── summary.py
│   │
│   ├── report/              ← PDF generation
│   │   ├── generator.py
│   │   ├── templates/
│   │   │   ├── base.html
│   │   │   ├── executive_summary.html
│   │   │   ├── findings.html
│   │   │   └── compliance_section.html
│   │   └── uploader.py
│   │
│   └── tasks/               ← Celery task definitions
│       ├── celery_app.py
│       ├── scan_task.py
│       └── report_task.py
│
└── tests/
    ├── test_scanners.py
    ├── test_rag.py
    ├── test_agent.py
    └── test_report.py
```

---

## 5. Environment Setup

### Step 1 — Clone and create virtual environment

```bash
git clone https://github.com/yourname/threatlens.git
cd threatlens
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2 — Copy and fill environment variables

```bash
cp .env.example .env
```

**`.env.example`**

```
# Groq API (free at console.groq.com)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# PostgreSQL
DATABASE_URL=postgresql://threatlens:password@localhost:5432/threatlens_db

# Redis
REDIS_URL=redis://localhost:6379/0

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=compliance_knowledge

# AWS S3 / Cloudflare R2 (for PDF storage)
S3_BUCKET_NAME=threatlens-reports
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_ENDPOINT_URL=https://your-account.r2.cloudflarestorage.com

# App
SECRET_KEY=your-very-long-random-secret-key-here
DEBUG=True
MAX_FILE_SIZE_MB=50
```

### Step 3 — Start all services with Docker Compose

**`docker-compose.yml`**

```yaml
version:"3.9"

services:
postgres:
image: postgres:15
environment:
POSTGRES_USER: threatlens
POSTGRES_PASSWORD: password
POSTGRES_DB: threatlens_db
ports:
-"5432:5432"
volumes:
- pg_data:/var/lib/postgresql/data

redis:
image: redis:7-alpine
ports:
-"6379:6379"

qdrant:
image: qdrant/qdrant:latest
ports:
-"6333:6333"
volumes:
- qdrant_data:/qdrant/storage

volumes:
pg_data:
qdrant_data:
```

```bash
docker-compose up -d
alembic upgrade head
```

### Step 4 — Seed the RAG knowledge base (run once)

```bash
python scripts/seed_rag.py
```

This downloads, chunks, embeds, and upserts all 5 compliance frameworks into Qdrant. Takes 5–10 minutes on first run.

### Step 5 — Start the application

```bash
# Terminal 1: FastAPI
uvicorn app.main:app --reload --port 8000

# Terminal 2: Celery worker
celery -A app.tasks.celery_app worker --loglevel=info

# Terminal 3: Celery beat (scheduled tasks like CVE sync)
celery -A app.tasks.celery_app beat --loglevel=info
```

---

## 6. Database Schema

```python
# app/models/scan.py
from sqlalchemy import Column, String, DateTime, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid, enum

class ScanStatus(str, enum.Enum):
    PENDING    = "pending"
    RUNNING    = "running"
    COMPLETED  = "completed"
    FAILED     = "failed"

class Scan(Base):
    __tablename__ = "scans"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id        = Column(String, nullable=False)
    scan_type      = Column(String)          # "codebase" | "architecture" | "logs" | "full"
    target_name    = Column(String)          # repo name or file name
    status         = Column(Enum(ScanStatus), default=ScanStatus.PENDING)
    progress       = Column(Integer, default=0)  # 0–100
    created_at     = Column(DateTime, default=datetime.utcnow)
    completed_at   = Column(DateTime, nullable=True)
    findings       = relationship("Finding", back_populates="scan")

# app/models/finding.py
class Finding(Base):
    __tablename__ = "findings"
    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id            = Column(UUID(as_uuid=True), ForeignKey("scans.id"))
    title              = Column(String, nullable=False)
    description        = Column(Text)
    severity           = Column(String)      # critical | high | medium | low
    cvss_score         = Column(Float)
    cve_id             = Column(String, nullable=True)
    cwe_id             = Column(String, nullable=True)
    file_path          = Column(String, nullable=True)
    line_number        = Column(Integer, nullable=True)
    code_snippet       = Column(Text, nullable=True)
    source             = Column(String)      # semgrep | bandit | trufflehog | llm | arch | log
    remediation        = Column(Text)
    created_at         = Column(DateTime, default=datetime.utcnow)
    violations         = relationship("ComplianceViolation", back_populates="finding")

# app/models/compliance_violation.py
class ComplianceViolation(Base):
    __tablename__ = "compliance_violations"
    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    finding_id           = Column(UUID(as_uuid=True), ForeignKey("findings.id"))
    framework            = Column(String)    # GDPR | SOC2 | ISO27001 | PCI_DSS | NIST_CSF
    control_id           = Column(String)    # e.g. "Art.32" | "CC6.1" | "A.8.5" | "Req.8.3.2"
    control_title        = Column(String)
    violation_description = Column(Text)
    evidence             = Column(Text)
    rag_chunk_ids        = Column(ARRAY(String))  # which RAG chunks were retrieved
```

---

## 7. RAG Knowledge Base — All 5 Frameworks

### How RAG Works in This Project

```
Finding description text
        │
        ▼
  all-MiniLM-L6-v2 embed (384-dim vector)
        │
        ▼
  Qdrant cosine similarity search
  filter by: framework = "GDPR" (optional)
  return: top-10 most relevant chunks
        │
        ▼
  Retrieved chunks = specific articles/controls
        │
        ▼
  Packed into LLM prompt with the finding
        │
        ▼
  LLM maps finding to exact control violation
```

### Chunking Strategy Per Framework

```python
# app/rag/chunkers/gdpr_chunker.py

GDPR_KEY_ARTICLES = {
    "Art.5":  "Principles relating to processing of personal data",
    "Art.25": "Data protection by design and by default",
    "Art.32": "Security of processing",
    "Art.33": "Notification of personal data breach to supervisory authority",
    "Art.34": "Communication of personal data breach to data subject",
    "Art.35": "Data protection impact assessment",
    "Art.83": "General conditions for imposing administrative fines",
}

def chunk_gdpr(pdf_path: str) -> list[dict]:
    """
    Each chunk = one Article.
    Returns list of dicts with text + metadata.
    """
    chunks = []
    for article_id, title in GDPR_KEY_ARTICLES.items():
        text = extract_article_text(pdf_path, article_id)
        chunks.append({
            "text": f"{article_id} —{title}\n\n{text}",
            "metadata": {
                "framework": "GDPR",
                "control_id": article_id,
                "control_title": title,
                "category": get_gdpr_category(article_id),
                "severity_weight": get_severity_weight(article_id),
            }
        })
    return chunks
```

```python
# app/rag/chunkers/soc2_chunker.py

SOC2_KEY_CONTROLS = {
    "CC6.1":  "Logical and physical access controls — restrict access",
    "CC6.2":  "Authentication prior to granting access",
    "CC6.3":  "Role-based access and authorization",
    "CC6.6":  "Security measures against threats outside system boundaries",
    "CC6.7":  "Transmission of data to authorized entities only",
    "CC7.1":  "Detect and monitor for new vulnerabilities",
    "CC7.2":  "Monitor system components for anomalies",
    "CC8.1":  "Change management procedures",
    "CC9.1":  "Risk mitigation activities",
}
# Same pattern — each control = one chunk with metadata
```

```python
# app/rag/chunkers/iso27001_chunker.py

ISO_KEY_CONTROLS = {
    "A.5.14": "Information transfer",
    "A.5.15": "Access control",
    "A.8.2":  "Privileged access rights",
    "A.8.4":  "Access to source code",
    "A.8.5":  "Secure authentication",
    "A.8.7":  "Protection against malware",
    "A.8.9":  "Configuration management",
    "A.8.15": "Logging",
    "A.8.24": "Use of cryptography",
    "A.8.25": "Secure development life cycle",
    "A.8.28": "Secure coding",
}
```

```python
# app/rag/chunkers/pci_chunker.py

PCI_KEY_REQUIREMENTS = {
    "Req.2.2.7":  "All non-console admin access encrypted with strong cryptography",
    "Req.6.2.4":  "Prevent common software attacks (injection, XSS, etc.)",
    "Req.6.3.3":  "All software components protected from known vulnerabilities",
    "Req.7.2.1":  "Access control system enforces need-to-know",
    "Req.8.2.1":  "All users assigned unique IDs",
    "Req.8.3.2":  "Strong cryptography for all non-console admin access",
    "Req.8.3.4":  "Invalid authentication attempts limited",
    "Req.10.2.1": "Audit logs for individual user access to cardholder data",
    "Req.11.3.1": "Internal vulnerability scans performed at least quarterly",
}
```

```python
# app/rag/chunkers/nist_chunker.py

NIST_KEY_SUBCATEGORIES = {
    "GV.OC-01": "Organizational mission informs cybersecurity risk management",
    "ID.AM-01": "Inventories of hardware managed by the organization",
    "ID.AM-02": "Inventories of software managed by the organization",
    "PR.AA-01": "Identities and credentials for authorized users managed",
    "PR.AA-02": "Identities proven and bound to credentials",
    "PR.AA-05": "Access permissions managed incorporating least privilege",
    "PR.DS-01": "Data-at-rest protected",
    "PR.DS-02": "Data-in-transit protected",
    "DE.CM-01": "Networks monitored to find potentially adverse events",
    "DE.CM-09": "Computing hardware and software monitored",
    "RS.MA-01": "Incident response plan executed",
}
```

### Embedding + Upsert Script

```python
# scripts/seed_rag.py

from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import uuid

model = QdrantClient(host="localhost", port=6333)
encoder = SentenceTransformer("all-MiniLM-L6-v2")

def seed_collection():
    client = QdrantClient(host="localhost", port=6333)

    # Create collection (run once)
    client.recreate_collection(
        collection_name="compliance_knowledge",
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )

    all_chunks = []
    all_chunks += chunk_gdpr("data/gdpr.pdf")
    all_chunks += chunk_soc2("data/soc2_tsc.pdf")
    all_chunks += chunk_iso27001("data/iso27001_2022.pdf")
    all_chunks += chunk_pci("data/pci_dss_v4.pdf")
    all_chunks += chunk_nist("data/nist_csf_2_0.pdf")
    all_chunks += chunk_nvd_cves()        # from NVD API
    all_chunks += chunk_owasp_top10()     # from OWASP PDF

    points = []
    for chunk in all_chunks:
        vector = encoder.encode(chunk["text"]).tolist()
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload=chunk["metadata"] | {"text": chunk["text"]}
        ))

    # Batch upsert in groups of 100
    for i in range(0, len(points), 100):
        client.upsert(
            collection_name="compliance_knowledge",
            points=points[i:i+100]
        )
    print(f"Seeded{len(points)} chunks into Qdrant.")

if __name__ == "__main__":
    seed_collection()
```

### RAG Query Function

```python
# app/rag/retriever.py

from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

encoder = SentenceTransformer("all-MiniLM-L6-v2")
qdrant  = QdrantClient(host="localhost", port=6333)

def retrieve_relevant_controls(
    finding_text: str,
    frameworks: list[str] = None,  # e.g. ["GDPR", "PCI_DSS"]
    top_k: int = 10,
) -> list[dict]:
    """
    Embed the finding, search Qdrant, return top-k compliance clauses.
    """
    query_vector = encoder.encode(finding_text).tolist()

    query_filter = None
    if frameworks:
        query_filter = Filter(
            should=[
                FieldCondition(key="framework", match=MatchValue(value=fw))
                for fw in frameworks
            ]
        )

    results = qdrant.search(
        collection_name="compliance_knowledge",
        query_vector=query_vector,
        query_filter=query_filter,
        limit=top_k,
        with_payload=True,
    )

    return [
        {
            "framework":      r.payload["framework"],
            "control_id":     r.payload["control_id"],
            "control_title":  r.payload["control_title"],
            "text":           r.payload["text"],
            "score":          r.score,
        }
        for r in results
    ]
```

---

## 8. Input Ingestion Layer

```python
# app/ingestion/code_extractor.py

import zipfile, tempfile, os
from pathlib import Path
import git

SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go",
    ".rb", ".php", ".cs", ".cpp", ".c", ".rs", ".yaml",
    ".yml", ".json", ".env", ".toml", ".cfg", ".ini",
    ".sh", ".bash", ".dockerfile", ".tf"
}

def extract_from_zip(zip_path: str) -> str:
    """Extract ZIP to temp dir and return path."""
    tmp = tempfile.mkdtemp()
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(tmp)
    return tmp

def extract_from_git(git_url: str) -> str:
    """Clone repo to temp dir and return path."""
    tmp = tempfile.mkdtemp()
    git.Repo.clone_from(git_url, tmp, depth=1)
    return tmp

def collect_source_files(repo_path: str) -> list[dict]:
    """
    Walk the repo and collect all supported source files.
    Returns list of {path, content, language}
    """
    files = []
    for root, dirs, filenames in os.walk(repo_path):
        # Skip node_modules, .git, venv, __pycache__
        dirs[:] = [d for d in dirs if d not in {
            "node_modules", ".git", "venv", "__pycache__",
            ".pytest_cache", "dist", "build", ".next"
        }]
        for filename in filenames:
            ext = Path(filename).suffix.lower()
            if ext in SUPPORTED_EXTENSIONS:
                filepath = os.path.join(root, filename)
                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    files.append({
                        "path": filepath.replace(repo_path, ""),
                        "content": content,
                        "language": ext.lstrip("."),
                        "size_bytes": len(content.encode("utf-8")),
                    })
                except Exception:
                    pass
    return files
```

---

## 9. Codebase Scanner

### Semgrep Runner

```python
# app/scanners/semgrep_runner.py

import subprocess, json
from app.schemas.finding import FindingCreate

SEMGREP_RULESETS = [
    "p/owasp-top-ten",
    "p/python",
    "p/javascript",
    "p/secrets",
    "p/supply-chain",
    "p/jwt",
    "p/sql-injection",
    "p/xss",
]

def run_semgrep(repo_path: str) -> list[FindingCreate]:
    """Run Semgrep and parse output into Finding objects."""
    cmd = [
        "semgrep", "scan",
        "--config", ",".join(SEMGREP_RULESETS),
        "--json",
        "--quiet",
        repo_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    data = json.loads(result.stdout)

    findings = []
    for r in data.get("results", []):
        findings.append(FindingCreate(
            title=r["check_id"].split(".")[-1].replace("-", " ").title(),
            description=r["extra"]["message"],
            severity=map_semgrep_severity(r["extra"]["severity"]),
            cwe_id=extract_cwe(r),
            file_path=r["path"],
            line_number=r["start"]["line"],
            code_snippet=r["extra"].get("lines", ""),
            source="semgrep",
        ))
    return findings

def map_semgrep_severity(s: str) -> str:
    return {"ERROR": "critical", "WARNING": "high", "INFO": "medium"}.get(s, "low")
```

### Bandit Runner (Python AST)

```python
# app/scanners/bandit_runner.py

import subprocess, json

def run_bandit(repo_path: str) -> list[FindingCreate]:
    """Run Bandit on Python files."""
    cmd = ["bandit", "-r", repo_path, "-f", "json", "-q"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []

    findings = []
    for r in data.get("results", []):
        findings.append(FindingCreate(
            title=r["test_name"].replace("_", " ").title(),
            description=r["issue_text"],
            severity=map_bandit_severity(r["issue_severity"], r["issue_confidence"]),
            cwe_id=r.get("issue_cwe", {}).get("id"),
            file_path=r["filename"],
            line_number=r["line_number"],
            code_snippet=r.get("code", ""),
            source="bandit",
        ))
    return findings

def map_bandit_severity(severity: str, confidence: str) -> str:
    if severity == "HIGH" and confidence == "HIGH":
        return "critical"
    if severity == "HIGH":
        return "high"
    if severity == "MEDIUM":
        return "medium"
    return "low"
```

### Trufflehog Secret Scanner

```python
# app/scanners/trufflehog_runner.py

import subprocess, json

def run_trufflehog(repo_path: str) -> list[FindingCreate]:
    """Scan for hardcoded secrets and credentials."""
    cmd = ["trufflehog", "filesystem", repo_path, "--json", "--no-update"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    findings = []
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        try:
            r = json.loads(line)
            findings.append(FindingCreate(
                title=f"Secret exposed:{r.get('DetectorName', 'Unknown')}",
                description=f"Credential type '{r['DetectorName']}' found in{r['SourceMetadata']['Data']['Filesystem']['file']}",
                severity="critical",
                cwe_id="CWE-798",
                file_path=r["SourceMetadata"]["Data"]["Filesystem"]["file"],
                line_number=r["SourceMetadata"]["Data"]["Filesystem"].get("line"),
                source="trufflehog",
            ))
        except Exception:
            pass
    return findings
```

### LLM Deep Code Review

```python
# app/scanners/llm_code_reviewer.py

from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage
import json

llm = ChatGroq(model="llama3-70b-8192", temperature=0)

SYSTEM_PROMPT = """You are a senior application security engineer.
Review the provided source code for security vulnerabilities.
Focus on: authentication flaws, authorization bypass, injection attacks,
insecure data handling, broken cryptography, exposed secrets, IDOR,
race conditions, and insecure dependencies.

For each vulnerability found, output ONLY a JSON array with objects:
{
  "title": "short vulnerability name",
  "description": "detailed explanation of the vulnerability",
  "severity": "critical|high|medium|low",
  "cwe_id": "CWE-XXX or null",
  "file_path": "relative path",
  "line_number": integer or null,
  "code_snippet": "the vulnerable code, max 5 lines",
  "remediation": "specific fix instructions"
}

If no vulnerabilities found, return empty array []. Return ONLY valid JSON."""

def llm_review_file(file_path: str, content: str) -> list[FindingCreate]:
    """Send a file to LLM for deep security review."""
    if len(content) > 8000:  # Truncate very large files
        content = content[:8000] + "\n... [truncated]"

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"File:{file_path}\n\n```\n{content}\n```")
    ]

    response = llm.invoke(messages)
    try:
        results = json.loads(response.content)
    except json.JSONDecodeError:
        return []

    return [
        FindingCreate(
            source="llm",
            **{k: v for k, v in r.items() if k in FindingCreate.__fields__}
        )
        for r in results
    ]
```

---

## 10. Architecture & Log Scanner

```python
# app/scanners/log_anomaly.py

import re
from collections import Counter
from sklearn.ensemble import IsolationForest
import numpy as np

def analyze_logs(log_content: str) -> list[FindingCreate]:
    """
    Parse log file, extract features, run Isolation Forest for anomalies.
    """
    lines = log_content.strip().split("\n")
    findings = []

    # Pattern 1: Brute force detection
    auth_failures = [l for l in lines if "401" in l or "authentication failed" in l.lower()]
    if len(auth_failures) > 50:
        findings.append(FindingCreate(
            title="Potential brute-force attack detected",
            description=f"{len(auth_failures)} authentication failures found in logs.",
            severity="high",
            cwe_id="CWE-307",
            source="log",
        ))

    # Pattern 2: SQL injection attempts in URL
    sqli_pattern = re.compile(r"(union\s+select|drop\s+table|or\s+1=1|--|xp_cmd)", re.I)
    sqli_hits = [l for l in lines if sqli_pattern.search(l)]
    if sqli_hits:
        findings.append(FindingCreate(
            title="SQL injection attempt detected in logs",
            description=f"{len(sqli_hits)} requests with SQL injection patterns.",
            severity="critical",
            cwe_id="CWE-89",
            source="log",
        ))

    # Pattern 3: Unusual HTTP methods
    unusual_methods = [l for l in lines if re.search(r'"(TRACE|CONNECT|PROPFIND)', l)]
    if unusual_methods:
        findings.append(FindingCreate(
            title="Unusual HTTP methods detected",
            description="TRACE/CONNECT/PROPFIND methods indicate reconnaissance.",
            severity="medium",
            source="log",
        ))

    return findings
```

---

## 11. LangChain Agent — Compliance Mapper

```python
# app/agent/compliance_mapper.py

from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from app.rag.retriever import retrieve_relevant_controls

llm = ChatGroq(model="llama3-70b-8192", temperature=0)

class FrameworkViolation(BaseModel):
    framework: str            = Field(description="Framework name: GDPR, SOC2, ISO27001, PCI_DSS, NIST_CSF")
    control_id: str           = Field(description="Specific control ID e.g. Art.32, CC6.1, A.8.5")
    control_title: str        = Field(description="Control name")
    violation_description: str = Field(description="Why this finding violates this control")
    evidence: str             = Field(description="Specific evidence from the finding")

class ComplianceMappingResult(BaseModel):
    violations: list[FrameworkViolation]
    cvss_score: float         = Field(description="CVSS 3.1 base score 0.0–10.0")
    cvss_vector: str          = Field(description="CVSS vector string e.g. AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")
    remediation_steps: list[str] = Field(description="Ordered list of remediation steps")
    remediation_priority: str = Field(description="immediate|short-term|long-term")

parser = PydanticOutputParser(pydantic_object=ComplianceMappingResult)

COMPLIANCE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a certified security compliance auditor with deep expertise in
GDPR, SOC 2 Type II, ISO 27001:2022, PCI DSS v4.0, and NIST CSF 2.0.

Your task: given a security vulnerability finding and relevant compliance control excerpts,
map the finding to specific control violations and produce a structured compliance report.

Be precise. Only map to controls where there is a clear, direct violation.
Include specific evidence from the finding text.

{format_instructions}"""),
    ("human", """SECURITY FINDING:
Title:{title}
Description:{description}
Severity:{severity}
CWE:{cwe_id}
File:{file_path}
Code snippet:{code_snippet}

RELEVANT COMPLIANCE CONTROLS (retrieved from knowledge base):
{retrieved_controls}

Map this finding to compliance violations and provide CVSS score and remediation.""")
])

def map_finding_to_compliance(finding: dict) -> ComplianceMappingResult:
    """Full pipeline: retrieve relevant controls → LLM maps → structured output."""

    # Step 1: RAG retrieval
    retrieved = retrieve_relevant_controls(
        finding_text=f"{finding['title']}{finding['description']}{finding.get('cwe_id','')}",
        top_k=12,
    )

    controls_text = "\n\n".join([
        f"[{r['framework']} —{r['control_id']}]{r['control_title']}\n{r['text'][:400]}"
        for r in retrieved
    ])

    # Step 2: LLM compliance mapping
    chain = COMPLIANCE_PROMPT | llm | parser

    result = chain.invoke({
        "format_instructions": parser.get_format_instructions(),
        "title":        finding["title"],
        "description":  finding["description"],
        "severity":     finding["severity"],
        "cwe_id":       finding.get("cwe_id", "Unknown"),
        "file_path":    finding.get("file_path", "N/A"),
        "code_snippet": finding.get("code_snippet", "N/A"),
        "retrieved_controls": controls_text,
    })

    return result
```

---

## 12. PDF Report Generator

```python
# app/report/generator.py

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
import matplotlib.pyplot as plt
import io, base64, os
from datetime import datetime

def generate_compliance_chart(framework_scores: dict) -> str:
    """Generate bar chart, return as base64 PNG for embedding in PDF."""
    frameworks = list(framework_scores.keys())
    scores     = list(framework_scores.values())
    colors     = ["#e24b4a" if s < 65 else "#ef9f27" if s < 80 else "#1d9e75" for s in scores]

    fig, ax = plt.subplots(figsize=(8, 3))
    bars = ax.barh(frameworks, scores, color=colors, height=0.5)
    ax.set_xlim(0, 100)
    ax.set_xlabel("Compliance score (%)")
    for bar, score in zip(bars, scores):
        ax.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2,
                f"{score}%", va="center", fontsize=10)
    fig.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close()
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def generate_pdf_report(scan_data: dict) -> bytes:
    """
    Build HTML from Jinja2 template, convert to PDF via WeasyPrint.
    Returns PDF bytes.
    """
    env = Environment(loader=FileSystemLoader("app/report/templates"))
    template = env.get_template("base.html")

    chart_b64 = generate_compliance_chart(scan_data["framework_scores"])

    html_content = template.render(
        scan=scan_data,
        chart_b64=chart_b64,
        generated_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        findings_by_severity={
            "critical": [f for f in scan_data["findings"] if f["severity"] == "critical"],
            "high":     [f for f in scan_data["findings"] if f["severity"] == "high"],
            "medium":   [f for f in scan_data["findings"] if f["severity"] == "medium"],
            "low":      [f for f in scan_data["findings"] if f["severity"] == "low"],
        }
    )

    return HTML(string=html_content, base_url=".").write_pdf()
```

**Jinja2 Template Structure (`app/report/templates/base.html`):**

```html
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Inter', sans-serif; color: #1a1a1a; font-size: 11pt; }
  .cover { page-break-after: always; padding: 60px; background: #0d1f35; color: white; }
  .cover h1 { font-size: 28pt; margin-bottom: 8px; }
  .cover .meta { font-size: 10pt; opacity: 0.7; }
  .section { page-break-before: always; padding: 40px; }
  .finding-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .severity-critical { border-left: 4px solid #e24b4a; }
  .severity-high     { border-left: 4px solid #ef9f27; }
  .severity-medium   { border-left: 4px solid #378add; }
  .severity-low      { border-left: 4px solid #1d9e75; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9pt; font-weight: 600; }
  .framework-tag { background: #eeedfe; color: #3c3489; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th { background: #f5f5f5; padding: 8px; text-align: left; }
  td { padding: 7px 8px; border-bottom: 1px solid #eee; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 9pt; }
  pre  { background: #1a1a2e; color: #e0e0ff; padding: 12px; border-radius: 6px; font-size: 9pt; overflow-x: auto; }
</style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover">
    <h1>Security Audit Report</h1>
    <p>{{ scan.target_name }}</p>
    <p class="meta">Generated: {{ generated_at }} · ThreatLens AI Audit Engine</p>
  </div>

  <!-- Executive Summary -->
  {% include "executive_summary.html" %}

  <!-- Compliance Scores -->
  {% include "compliance_section.html" %}

  <!-- Findings by Severity -->
  {% include "findings.html" %}

</body>
</html>
```

---

## 13. FastAPI Endpoints

```python
# app/api/scans.py

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from app.tasks.scan_task import run_full_scan
import uuid, shutil, os

router = APIRouter(prefix="/api/v1", tags=["scans"])

@router.post("/scan")
async def create_scan(
    scan_type: str,                           # "codebase" | "architecture" | "logs" | "full"
    file: UploadFile = File(None),
    git_url: str = None,
    frameworks: list[str] = ["GDPR", "SOC2", "ISO27001", "PCI_DSS", "NIST_CSF"],
):
    """Start a new security scan. Returns scan_id for polling."""
    scan_id = str(uuid.uuid4())

    # Save uploaded file
    if file:
        upload_path = f"/tmp/{scan_id}_{file.filename}"
        with open(upload_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        file_path = upload_path
    elif git_url:
        file_path = git_url
    else:
        raise HTTPException(400, "Provide either a file upload or git_url")

    # Dispatch Celery task
    run_full_scan.delay(scan_id, scan_type, file_path, frameworks)

    return {"scan_id": scan_id, "status": "pending", "message": "Scan started"}

@router.get("/scan/{scan_id}/status")
async def get_scan_status(scan_id: str):
    """Poll scan progress. Frontend polls this every 3 seconds."""
    scan = get_scan_from_db(scan_id)
    return {
        "scan_id":    scan_id,
        "status":     scan.status,
        "progress":   scan.progress,
        "finding_count": len(scan.findings),
    }

@router.get("/scan/{scan_id}/findings")
async def get_findings(scan_id: str, severity: str = None, framework: str = None):
    """Get all findings for a scan with optional filters."""
    findings = query_findings(scan_id, severity=severity, framework=framework)
    return {"findings": findings, "total": len(findings)}

@router.post("/scan/{scan_id}/report")
async def generate_report(scan_id: str):
    """Trigger PDF report generation. Returns download URL when ready."""
    task = generate_pdf_report_task.delay(scan_id)
    return {"task_id": task.id, "status": "generating"}

@router.get("/report/{scan_id}/download")
async def download_report(scan_id: str):
    """Get signed URL to download the generated PDF."""
    report = get_report_from_db(scan_id)
    return {"url": report.signed_url, "expires_in": 3600}

@router.get("/scan/{scan_id}/export/csv")
async def export_csv(scan_id: str):
    """Export findings as CSV for spreadsheet import."""
    # Returns StreamingResponse with CSV content
    ...

@router.get("/frameworks")
async def list_frameworks():
    """Return compliance framework metadata and coverage stats."""
    return {
        "frameworks": [
            {"id": "GDPR",      "name": "GDPR",          "chunks_indexed": 89,  "version": "2016/679"},
            {"id": "SOC2",      "name": "SOC 2 Type II",  "chunks_indexed": 67,  "version": "2022"},
            {"id": "ISO27001",  "name": "ISO/IEC 27001",  "chunks_indexed": 114, "version": "2022"},
            {"id": "PCI_DSS",   "name": "PCI DSS",        "chunks_indexed": 156, "version": "v4.0"},
            {"id": "NIST_CSF",  "name": "NIST CSF",       "chunks_indexed": 108, "version": "2.0"},
        ]
    }
```

---

## 14. Celery Async Task Queue

```python
# app/tasks/scan_task.py

from app.tasks.celery_app import celery_app
from app.ingestion.code_extractor import extract_from_zip, extract_from_git, collect_source_files
from app.scanners.semgrep_runner import run_semgrep
from app.scanners.bandit_runner import run_bandit
from app.scanners.trufflehog_runner import run_trufflehog
from app.scanners.llm_code_reviewer import llm_review_file
from app.agent.compliance_mapper import map_finding_to_compliance
from app.database import get_db_session

@celery_app.task(bind=True, max_retries=3)
def run_full_scan(self, scan_id: str, scan_type: str, source: str, frameworks: list[str]):
    db = get_db_session()
    try:
        update_scan_status(db, scan_id, "running", progress=5)

        # Step 1: Extract source files
        if source.endswith(".zip"):
            repo_path = extract_from_zip(source)
        elif source.startswith("http"):
            repo_path = extract_from_git(source)
        else:
            repo_path = source

        update_scan_status(db, scan_id, "running", progress=15)

        all_findings = []

        if scan_type in ("codebase", "full"):
            # Step 2: Static analysis (parallel in practice)
            all_findings += run_semgrep(repo_path)
            update_scan_status(db, scan_id, "running", progress=30)

            all_findings += run_bandit(repo_path)
            update_scan_status(db, scan_id, "running", progress=40)

            all_findings += run_trufflehog(repo_path)
            update_scan_status(db, scan_id, "running", progress=50)

            # Step 3: LLM deep review (per file)
            source_files = collect_source_files(repo_path)
            for i, f in enumerate(source_files[:30]):  # Cap at 30 files
                findings = llm_review_file(f["path"], f["content"])
                all_findings += findings
                progress = 50 + int((i / len(source_files[:30])) * 20)
                update_scan_status(db, scan_id, "running", progress=progress)

        # Step 4: Deduplicate findings
        all_findings = deduplicate_findings(all_findings)
        save_raw_findings(db, scan_id, all_findings)
        update_scan_status(db, scan_id, "running", progress=75)

        # Step 5: Compliance mapping per finding
        for i, finding in enumerate(all_findings):
            mapping = map_finding_to_compliance(finding)
            save_compliance_violations(db, finding, mapping)
            progress = 75 + int((i / len(all_findings)) * 20)
            update_scan_status(db, scan_id, "running", progress=progress)

        update_scan_status(db, scan_id, "completed", progress=100)

    except Exception as exc:
        update_scan_status(db, scan_id, "failed")
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()
```

---

## 15. Framework Compliance Rules Reference

This is what you embed in Qdrant. Use this as your mapping guide when the LLM reasons about violations.

### GDPR — Key Violations by Vulnerability Type

| Vulnerability Type | Article | Obligation |
| --- | --- | --- |
| Unencrypted data at rest | Art. 32 §1a | Implement encryption of personal data |
| No authentication on data endpoint | Art. 32 §1b | Ensure confidentiality of systems |
| No breach notification plan | Art. 33 | Notify authority within 72 hours |
| No data minimization | Art. 5 §1c | Collect only what is necessary |
| No privacy by design | Art. 25 | Data protection by default |
| Excessive data retention | Art. 5 §1e | Storage limitation principle |
| Weak access controls | Art. 32 §1b | Authorized access only |

### SOC 2 Type II — Key Violations

| Vulnerability Type | Control | Category |
| --- | --- | --- |
| Missing MFA | CC6.1 | Logical Access |
| Unencrypted admin access | CC6.7 | Logical Access |
| No intrusion detection | CC7.2 | System Operations |
| No vulnerability scanning | CC7.1 | System Operations |
| Exposed management ports | CC6.6 | Logical Access |
| No change management | CC8.1 | Change Management |
| Vendor/third-party risk | CC9.2 | Risk Mitigation |

### ISO 27001:2022 — Key Violations (Annex A)

| Vulnerability Type | Control | Domain |
| --- | --- | --- |
| Hardcoded credentials | A.8.5 | Access Management |
| Unpatched dependencies | A.8.8 | Technical Vulnerability Management |
| No security testing | A.8.25 | Secure Development |
| Insecure code practices | A.8.28 | Secure Coding |
| Cleartext transmission | A.8.24 | Use of Cryptography |
| Missing access logs | A.8.15 | Logging |
| No incident response | A.5.24 | Incident Management |

### PCI DSS v4.0 — Key Violations

| Vulnerability Type | Requirement | Goal |
| --- | --- | --- |
| Default credentials | Req. 2.1 | Apply secure config to all components |
| SQLi vulnerability | Req. 6.2.4 | Prevent common software attacks |
| Unpatched software | Req. 6.3.3 | Protect from known vulnerabilities |
| Excessive access rights | Req. 7.2.1 | Need-to-know access control |
| Shared admin accounts | Req. 8.2.1 | Unique IDs for all users |
| Weak password policy | Req. 8.3.6 | Minimum password complexity |
| No audit logging | Req. 10.2.1 | Audit log for data access |

### NIST CSF 2.0 — Key Violations

| Vulnerability Type | Subcategory | Function |
| --- | --- | --- |
| No asset inventory | ID.AM-01/02 | Identify |
| No risk assessment | ID.RA-01 | Identify |
| Unmanaged access | PR.AA-05 | Protect |
| Unencrypted sensitive data | PR.DS-01 | Protect |
| Cleartext in transit | PR.DS-02 | Protect |
| No network monitoring | DE.CM-01 | Detect |
| No anomaly detection | DE.AE-02 | Detect |
| No incident response plan | RS.MA-01 | Respond |

---

## 16. 10-Week Build Plan

### Week 1 — Foundation

- [ ]  Initialize FastAPI project with folder structure above
- [ ]  Set up Docker Compose (PostgreSQL, Redis, Qdrant)
- [ ]  Define all SQLAlchemy ORM models
- [ ]  Run Alembic migrations
- [ ]  Set up Celery + Redis
- [ ]  Create base Pydantic schemas
- [ ]  Write `.env` config loader

**Deliverable:** Project runs with `docker-compose up` and returns 200 on `/health`

---

### Weeks 2–3 — RAG Knowledge Base

- [ ]  Download all 5 framework source documents (PDF/HTML)
- [ ]  Write chunker for each framework (see Section 7)
- [ ]  Write metadata tagger per chunk
- [ ]  Set up Qdrant collection with 384-dim vectors
- [ ]  Write embedding pipeline using `all-MiniLM-L6-v2`
- [ ]  Run `seed_rag.py` — upsert all chunks
- [ ]  Download NVD CVE data via NVD API, chunk and embed
- [ ]  Write `retrieve_relevant_controls()` function
- [ ]  Test: given “Redis no auth”, verify GDPR Art.32 and PCI Req.2 are returned
- [ ]  Set up weekly cron job to sync new CVEs

**Deliverable:** Qdrant collection with 1,000+ indexed chunks, retrieval function tested

---

### Weeks 4–5 — Architecture and Log Scanner

- [ ]  Build YAML/JSON architecture parser
- [ ]  Port and service exposure checker
- [ ]  Network topology analyzer
- [ ]  Log ingestion endpoint (`.log`, `.pcap`)
- [ ]  Isolation Forest anomaly detector for logs
- [ ]  Regex pattern scanner (SQLi, XSS, brute-force in logs)
- [ ]  Groq integration via LangChain
- [ ]  LLM prompt for architecture context analysis
- [ ]  Save findings to PostgreSQL

**Deliverable:** Upload a `k8s-config.yaml` → get back a list of findings

---

### Weeks 6–7 — Codebase Scanner

- [ ]  ZIP extract endpoint
- [ ]  Git clone endpoint (`gitpython`)
- [ ]  Source file collector with extension filter
- [ ]  Semgrep subprocess runner + output parser
- [ ]  Bandit runner + severity mapper
- [ ]  Trufflehog runner + secret type extractor
- [ ]  `pip-audit` and `npm audit` dependency scanners
- [ ]  LLM deep code review (file-by-file with Groq)
- [ ]  Finding deduplication and fingerprinting
- [ ]  Celery task tying everything together

**Deliverable:** Upload a Python Flask app → get 10+ findings including SQLi, secrets, misconfigs

---

### Week 8 — LangChain Agent Chain

- [ ]  Compliance mapper chain (RAG → LLM → structured output)
- [ ]  CVSS auto-scorer prompt
- [ ]  Remediation planner chain
- [ ]  Executive summary LLM writer
- [ ]  Pydantic output parser for all chains
- [ ]  Retry logic for Groq rate limits (exponential backoff)
- [ ]  Save all violations to `compliance_violations` table

**Deliverable:** Each finding has CVSS score + specific violated controls across all 5 frameworks

---

### Week 9 — PDF Report

- [ ]  Jinja2 HTML templates (cover, executive summary, findings, compliance)
- [ ]  WeasyPrint PDF renderer
- [ ]  Compliance score calculation per framework
- [ ]  matplotlib chart generation (bar chart of scores)
- [ ]  S3/R2 upload + signed URL
- [ ]  Async report generation Celery task
- [ ]  CSV export endpoint

**Deliverable:** Complete PDF audit report generated from a real scan

---

### Week 10 — Polish and Deploy

- [ ]  JWT authentication on all endpoints (`python-jose`)
- [ ]  Rate limiting (`slowapi`)
- [ ]  WebSocket endpoint for real-time scan progress
- [ ]  Auto-generated OpenAPI docs review
- [ ]  End-to-end pytest test suite
- [ ]  Railway / Render deployment
- [ ]  Demo codebase with known vulnerabilities for showcase

**Deliverable:** Live URL, demo video, full scan to PDF in under 5 minutes

---

## 17. Dependencies — Full Install List

```
# requirements.txt

# API framework
fastapi==0.115.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9

# Database
sqlalchemy==2.0.35
alembic==1.13.2
psycopg2-binary==2.9.9

# Validation
pydantic==2.9.2
pydantic-settings==2.5.2

# Task queue
celery==5.4.0
redis==5.1.0
flower==2.0.1

# LLM + Agent
langchain==0.3.3
langchain-groq==0.2.0
groq==0.11.0

# RAG + Vector store
qdrant-client==1.11.3
sentence-transformers==3.1.1

# Static code analysis
semgrep==1.90.0
bandit==1.7.10
trufflehog3==3.0.9
pip-audit==2.7.3

# Git
gitpython==3.1.43

# ML / anomaly detection
scikit-learn==1.5.2
numpy==1.26.4
pandas==2.2.3

# PDF generation
Jinja2==3.1.4
weasyprint==62.3
matplotlib==3.9.2

# File parsing
PyPDF2==3.0.1
python-docx==1.1.2
PyYAML==6.0.2

# HTTP client (for NVD API, etc.)
httpx==0.27.2

# Auth
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# Rate limiting
slowapi==0.1.9

# Object storage
boto3==1.35.32

# Utilities
python-dotenv==1.0.1
structlog==24.4.0
```

```bash
pip install -r requirements.txt
```

### Install system dependencies (Ubuntu/Debian)

```bash
# WeasyPrint dependencies
sudo apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libcairo2

# Semgrep
pip install semgrep

# Trufflehog (binary)
curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b /usr/local/bin
```

---

## 18. Deployment

### Option A — Railway (Recommended for demo)

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway add postgresql redis
railway up
```

Set all environment variables in Railway dashboard. Add Qdrant as a separate Railway service using the `qdrant/qdrant` Docker image.

### Option B — Render

1. Push to GitHub
2. Create Render Web Service → point to repo
3. Add PostgreSQL and Redis via Render’s managed databases
4. Add environment variables in dashboard
5. Deploy — auto-deploys on every push to `main`

### Dockerfile

```docker
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libpango-1.0-0 libpangoft2-1.0-0 libcairo2 \
    git curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Quick Reference — Key API Calls

```bash
# Start a codebase scan
curl -X POST http://localhost:8000/api/v1/scan \
  -F "scan_type=codebase" \
  -F "file=@my-app.zip" \
  -F "frameworks=GDPR" \
  -F "frameworks=PCI_DSS"

# Poll scan status
curl http://localhost:8000/api/v1/scan/{scan_id}/status

# Get findings (filter by severity)
curl "http://localhost:8000/api/v1/scan/{scan_id}/findings?severity=critical"

# Generate PDF report
curl -X POST http://localhost:8000/api/v1/scan/{scan_id}/report

# Download PDF
curl http://localhost:8000/api/v1/report/{scan_id}/download
```

---

*ThreatLens — Built with FastAPI · LangChain · Groq · Qdrant · sentence-transformers*

[copilot-instructions](https://app.notion.com/p/copilot-instructions-397df7fc310580b79b04e568398a25a2?pvs=21)