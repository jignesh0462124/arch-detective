# Part 1 — Foundation Setup

> **Timeline:** Week 1  
> **Priority:** 🔴 Critical (blocks all subsequent parts)  
> **Dependencies:** None — this is the starting point  

---

## 1.1 Objective

Set up the complete backend scaffolding: FastAPI project structure, Docker services (PostgreSQL, Redis, Qdrant), ORM models, database migrations, Celery worker, config management, and a health endpoint. Everything must be runnable with `docker-compose up`.

---

## 1.2 Files to Create

| File | Purpose |
|------|---------|
| `threatlens/docker-compose.yml` | PostgreSQL 15, Redis 7, Qdrant services |
| `threatlens/Dockerfile` | Python 3.11 app container |
| `threatlens/requirements.txt` | All pip dependencies |
| `threatlens/.env.example` | Environment variable template |
| `threatlens/app/main.py` | FastAPI app entry, CORS, router mounting |
| `threatlens/app/config.py` | `pydantic-settings` config from `.env` |
| `threatlens/app/database.py` | SQLAlchemy engine + async session factory |
| `threatlens/app/models/__init__.py` | Import all ORM models |
| `threatlens/app/models/scan.py` | `Scan` model with status enum |
| `threatlens/app/models/finding.py` | `Finding` model |
| `threatlens/app/models/compliance_violation.py` | `ComplianceViolation` model |
| `threatlens/app/models/report.py` | `Report` model |
| `threatlens/app/models/user.py` | `User` model (email, hashed_password, created_at) |
| `threatlens/app/schemas/__init__.py` | Pydantic schema exports |
| `threatlens/app/schemas/scan.py` | `ScanCreate`, `ScanResponse` schemas |
| `threatlens/app/schemas/finding.py` | `FindingCreate`, `FindingResponse` schemas |
| `threatlens/app/schemas/report.py` | `ReportResponse` schema |
| `threatlens/app/tasks/celery_app.py` | Celery app instance with Redis broker |
| `threatlens/alembic/alembic.ini` | Alembic config |
| `threatlens/alembic/env.py` | Alembic migration environment |

---

## 1.3 Implementation Details

### 1.3.1 FastAPI Entry Point (`app/main.py`)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(
    title="ThreatLens API",
    description="LLM-Agentic Compliance & Threat Modeling Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "threatlens"}
```

**CORS origins** must include the frontend dev server URL (`http://localhost:5173` for Vite TanStack Start).

### 1.3.2 Config (`app/config.py`)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    # Qdrant
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "compliance_knowledge"
    # Groq
    GROQ_API_KEY: str
    # S3/R2
    S3_BUCKET_NAME: str = "threatlens-reports"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_ENDPOINT_URL: str = ""
    # App
    SECRET_KEY: str
    DEBUG: bool = True
    MAX_FILE_SIZE_MB: int = 50
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"

settings = Settings()
```

### 1.3.3 Database Models

Use the exact schema from Backend.md Section 6, plus a User model for JWT auth:
- `User` — UUID PK, email (unique), hashed_password, is_active, created_at
- `Scan` — UUID PK, user_id (FK to User), scan_type, status enum, progress, timestamps
- `Finding` — UUID PK, FK to scan, title, description, severity, CVSS, CWE/CVE, file/line, source, remediation
- `ComplianceViolation` — UUID PK, FK to finding, framework, control_id, control_title, violation_description, evidence, rag_chunk_ids
- `Report` — UUID PK, FK to scan, pdf_url, signed_url, generated_at

### 1.3.4 Celery Setup

```python
from celery import Celery
from app.config import settings

celery_app = Celery(
    "threatlens",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
celery_app.conf.task_track_started = True
```

---

## 1.4 Frontend Connection Points

| Backend | Frontend |
|---------|----------|
| `GET /health` | Dashboard status indicator — show green/red service status |
| CORS middleware | Must allow `http://localhost:5173` (TanStack Start dev server) |
| Pydantic response schemas | TypeScript types in frontend should mirror these exactly |

### Frontend Types to Create (for later use)

```typescript
// src/lib/api/types.ts
export type ScanStatus = "pending" | "running" | "completed" | "failed";
export type ScanType = "codebase" | "architecture" | "logs" | "full";
export type Severity = "critical" | "high" | "medium" | "low";

export interface Scan {
  id: string;
  user_id: string;
  scan_type: ScanType;
  target_name: string;
  status: ScanStatus;
  progress: number;
  created_at: string;
  completed_at: string | null;
}
```

---

## 1.5 Verification Checklist

- [ ] `docker-compose up -d` starts PostgreSQL, Redis, Qdrant without errors
- [ ] `alembic upgrade head` creates all 5 tables in PostgreSQL (users, scans, findings, compliance_violations, reports)
- [ ] `uvicorn app.main:app --reload` starts on port 8000
- [ ] `GET http://localhost:8000/health` returns `{"status": "healthy"}`
- [ ] `GET http://localhost:8000/docs` shows OpenAPI Swagger UI
- [ ] Celery worker starts: `celery -A app.tasks.celery_app worker --loglevel=info`
- [ ] Frontend at `http://localhost:5173` can fetch `/health` without CORS errors

---

## 1.6 Security Notes

- `.env` file must be in `.gitignore` — never commit secrets
- `SECRET_KEY` should be a 64+ character random string
- Database password should be strong (not "password" in production)
- Docker volumes ensure data persistence across restarts
