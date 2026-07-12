<div align="center">
  <img src="docs/logo.png" alt="ThreatLens Logo" width="140" />
  <h1>🔍 ThreatLens — Arch Detective</h1>
  <p><strong>LLM-Agentic Compliance & Threat Modeling Engine</strong></p>
  <p>
    <em>Upload code → Find vulnerabilities → Map to compliance → Generate audit reports</em>
  </p>

  <br/>

  <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick_Start-▶-00d1b2?style=for-the-badge" alt="Quick Start" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/Stack-React_+_FastAPI-61dafb?style=for-the-badge" alt="Tech Stack" /></a>
  <a href="#-documentation"><img src="https://img.shields.io/badge/Docs-18_Files-blueviolet?style=for-the-badge" alt="Documentation" /></a>
  <a href="#-project-graph"><img src="https://img.shields.io/badge/Graph-Graphify-ff6b6b?style=for-the-badge" alt="Graphify" /></a>

  <br/><br/>

  <img src="https://img.shields.io/badge/python-3.11+-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.2-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat" alt="License" />

</div>

---

## 📋 Table of Contents

- [What is ThreatLens?](#-what-is-threatlens)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Frontend Pages](#-frontend-pages)
- [Backend Pipeline](#-backend-pipeline)
- [Compliance Frameworks](#-compliance-frameworks)
- [Project Graph (Graphify)](#-project-graph)
- [Documentation](#-documentation)
- [Implementation Roadmap](#-implementation-roadmap)
- [API Reference](#-api-reference)
- [Environment Variables](#-environment-variables)
- [Development Commands](#-development-commands)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🧠 What is ThreatLens?

**ThreatLens** (codename: *Arch Detective*) is a full-stack, LLM-powered security compliance engine for a College Project.

It accepts **codebases** (ZIP upload or Git clone), **architecture diagrams** (YAML/JSON), and **server logs**, then:

1. **Scans** for vulnerabilities using 6 static analysis tools (Semgrep, Bandit, Trufflehog, pip-audit, npm-audit, Isolation Forest)
2. **Deep reviews** code with an LLM agent (Groq / Llama 3 70B) for logic-level flaws humans miss
3. **Maps** every finding to exact violated controls across 5+ compliance frameworks using RAG
4. **Generates** audit-ready PDF reports with executive summaries, compliance charts, and remediation plans
5. **Tracks** compliance posture over time through a real-time dashboard

All in **minutes**, not months.

---

## ✨ Features

### Frontend (Built ✅)
- 🖥️ **Brutalist-modern UI** — Dark theme with neobrutalist design system
- 📊 **Audit Dashboard** — Real-time stats, severity feed, compliance coverage bars, scan history
- 🔍 **Findings Explorer** — Filter by severity/framework, expandable finding detail with evidence + remediation
- 🆕 **New Scan Wizard** — Architecture/description/log input tabs, framework selector, model picker, live pipeline animation
- 📄 **Reports Center** — Report list with status badges, featured reports, PDF preview
- 📱 **Responsive** — Mobile-first design with collapsible sidebar

### Backend (Planned 🚧)
- 🔒 **JWT Authentication** — Register, login, token refresh, route protection
- 🤖 **6 Security Scanners** — Semgrep, Bandit, Trufflehog, pip-audit, npm-audit, LLM code reviewer
- 🧬 **RAG Compliance Engine** — Qdrant vector DB + SentenceTransformers for control matching
- 📈 **CVSS 3.1 Auto-Scoring** — LLM-powered vulnerability scoring with vector strings
- 📋 **PDF Report Generator** — Jinja2 + WeasyPrint with charts and branded templates
- ⚡ **Celery Pipeline** — Async task queue with real-time progress via WebSocket
- 🛡️ **Rate Limiting** — slowapi protection on all endpoints

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           ThreatLens Architecture                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────┐          ┌─────────────────────────────────┐      │
│   │   FRONTEND       │          │          BACKEND (FastAPI)       │      │
│   │   TanStack Start │◄────────►│                                 │      │
│   │   React 19 + TS  │  REST +  │  ┌─────────┐  ┌────────────┐  │      │
│   │   TailwindCSS 4  │  WebSocket│  │ Ingestion│  │ Scanners   │  │      │
│   │   Recharts       │          │  │ ZIP/Git/ │  │ Semgrep    │  │      │
│   │   TanStack Query │          │  │ YAML/Logs│  │ Bandit     │  │      │
│   └─────────────────┘          │  └────┬─────┘  │ Trufflehog │  │      │
│                                 │       │        │ LLM Review │  │      │
│                                 │       ▼        └─────┬──────┘  │      │
│   ┌─────────────────┐          │  ┌────────────────────▼──────┐  │      │
│   │   INFRASTRUCTURE │          │  │     LangChain Agent        │  │      │
│   │                  │          │  │  Compliance Mapper (RAG)   │  │      │
│   │  PostgreSQL 15   │◄────────►│  │  CVSS Scorer              │  │      │
│   │  Redis 7         │          │  │  Remediation Planner      │  │      │
│   │  Qdrant          │◄────────►│  │  Executive Summary Writer │  │      │
│   │  S3/R2           │          │  └────────────┬─────────────┘  │      │
│   └─────────────────┘          │               │                 │      │
│                                 │               ▼                 │      │
│                                 │  ┌──────────────────────────┐  │      │
│                                 │  │  PDF Report Generator     │  │      │
│                                 │  │  Jinja2 + WeasyPrint      │  │      │
│                                 │  └──────────────────────────┘  │      │
│                                 └─────────────────────────────────┘      │
│                                                                          │
│   ┌─────────────────┐                                                    │
│   │  TASK QUEUE       │                                                   │
│   │  Celery + Redis   │  ← Async scan pipeline with progress tracking    │
│   └─────────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| [TanStack Start](https://tanstack.com/start) | 1.167+ | Full-stack React framework (SSR) |
| [React](https://react.dev) | 19.2 | UI library |
| [TypeScript](https://typescriptlang.org) | 5.8 | Type safety |
| [TailwindCSS](https://tailwindcss.com) | 4.2 | Utility-first CSS |
| [TanStack React Query](https://tanstack.com/query) | 5.83 | Server state management |
| [TanStack Router](https://tanstack.com/router) | 1.168 | Type-safe routing |
| [Radix UI](https://radix-ui.com) | Latest | Accessible primitives |
| [Recharts](https://recharts.org) | 2.15 | Data visualization |
| [Lucide React](https://lucide.dev) | 0.575 | Icon system |
| [Zod](https://zod.dev) | 3.24 | Schema validation |
| [React Hook Form](https://react-hook-form.com) | 7.71 | Form management |

### Backend (Planned)
| Technology | Version | Purpose |
|---|---|---|
| [FastAPI](https://fastapi.tiangolo.com) | 0.115+ | REST API framework |
| [Python](https://python.org) | 3.11 | Runtime |
| [SQLAlchemy](https://sqlalchemy.org) | 2.x | Async ORM |
| [PostgreSQL](https://postgresql.org) | 15 | Primary database |
| [Redis](https://redis.io) | 7 | Cache + Celery broker |
| [Qdrant](https://qdrant.tech) | Latest | Vector store (384-dim, cosine) |
| [Celery](https://docs.celeryq.dev) | 5.x | Async task queue |
| [LangChain](https://langchain.com) | Latest | LLM orchestration |
| [Groq](https://groq.com) | API | LLM inference (Llama 3 70B) |
| [SentenceTransformers](https://sbert.net) | Latest | Embeddings (all-MiniLM-L6-v2) |
| [WeasyPrint](https://weasyprint.org) | Latest | PDF generation |
| [Alembic](https://alembic.sqlalchemy.org) | Latest | DB migrations |

### Dev Tools
| Tool | Purpose |
|---|---|
| [Vite](https://vite.dev) | Build tooling + dev server |
| [ESLint](https://eslint.org) | Linting |
| [Prettier](https://prettier.io) | Code formatting |
| [Graphify](https://github.com/nicobailey/graphifyy) | Codebase graph analysis |
| [Docker Compose](https://docs.docker.com/compose) | Infrastructure orchestration |

---

## 📁 Project Structure

```
arch-detective/
│
├── 📂 src/                           # Frontend source code
│   ├── 📂 routes/                    # TanStack Start file-based routes
│   │   ├── index.tsx                 # Landing page
│   │   ├── __root.tsx                # Root layout
│   │   ├── _app.tsx                  # App layout (sidebar)
│   │   └── 📂 _app/                 # Protected app routes
│   │       ├── dashboard.tsx         # Audit dashboard
│   │       ├── new-scan.tsx          # New scan wizard
│   │       ├── findings.tsx          # Findings explorer
│   │       ├── reports.tsx           # Reports center
│   │       └── reports.$reportId.tsx # Report detail view
│   │
│   ├── 📂 components/
│   │   ├── 📂 brutal/               # Neobrutalist design system
│   │   │   ├── AppShell.tsx          # Page layout wrapper
│   │   │   ├── BrutalButton.tsx      # Action buttons
│   │   │   ├── BrutalBadge.tsx       # Status badges
│   │   │   └── ThemeToggle.tsx       # Light/dark toggle
│   │   └── 📂 ui/                   # 53 shadcn/ui components
│   │       ├── data-table.tsx        # Generic data table
│   │       ├── severity-badge.tsx    # Severity display
│   │       ├── coverage-bar.tsx      # Compliance bars
│   │       ├── code-panel.tsx        # Code snippet panel
│   │       ├── pipeline-step.tsx     # Scan pipeline indicator
│   │       ├── stat-tile.tsx         # Dashboard stat cards
│   │       ├── section-card.tsx      # Section wrapper
│   │       └── ...                   # 46 more components
│   │
│   ├── 📂 hooks/                     # Custom React hooks
│   │   └── use-mobile.tsx            # Responsive detection
│   │
│   ├── 📂 lib/                       # Utilities & data
│   │   ├── mock-data.ts              # Mock data (to be replaced by API)
│   │   ├── utils.ts                  # Utility functions
│   │   └── 📂 api/                  # API layer (to be created)
│   │       └── example.functions.ts  # TanStack Start server function example
│   │
│   ├── router.tsx                    # Router configuration
│   ├── server.ts                     # SSR server entry
│   ├── start.ts                      # TanStack Start entry
│   └── styles.css                    # Global styles + Tailwind
│
├── 📂 .github'/Backend/              # Backend documentation (18 files)
│   ├── copilot-instructions.md       # Master execution guide
│   ├── AI-Implementation-Prompts.md  # 9 AI prompts for implementation
│   ├── Backend-Frontend-Connect.md   # Frontend↔Backend wiring guide
│   ├── Part-01-Foundation-Setup.md   # Docker + FastAPI + DB + Celery
│   ├── Part-02-RAG-Knowledge-Base.md # Qdrant + embeddings + chunkers
│   ├── Part-03-Input-Ingestion-Layer.md # ZIP/Git/YAML/Log parsing
│   ├── Part-04-Scanners.md           # 6 security scanners
│   ├── Part-05-LangChain-Agent-Chains.md # Compliance mapping + CVSS
│   ├── Part-06-Report-Generator.md   # PDF + CSV/JSON export
│   ├── Part-07-Celery-Task-Queue.md  # Async pipeline + progress
│   ├── Part-08-API-Endpoints-Frontend-Integration.md # JWT + rate limiting
│   └── 📂 plan/                     # Workflow execution guides
│       ├── Backend.md                # Original full specification
│       ├── Workflow-01-Environment-Setup.md
│       ├── Workflow-02-RAG-Pipeline.md
│       ├── Workflow-03-Ingestion-Scanners.md
│       ├── Workflow-04-LangChain-Compliance.md
│       ├── Workflow-05-PDF-Reports.md
│       └── Workflow-06-Full-Integration-Deploy.md
│
├── 📂 threatlens/                    # Backend source (to be created)
│   ├── app/
│   │   ├── main.py, config.py, database.py
│   │   ├── models/                   # SQLAlchemy ORM models
│   │   ├── schemas/                  # Pydantic request/response schemas
│   │   ├── api/                      # FastAPI route handlers
│   │   ├── ingestion/                # Code extractors & parsers
│   │   ├── scanners/                 # Security analysis tools
│   │   ├── rag/                      # Vector search & embeddings
│   │   ├── agent/                    # LangChain chains & prompts
│   │   ├── report/                   # PDF generation & templates
│   │   └── tasks/                    # Celery task definitions
│   ├── scripts/                      # Seed & sync scripts
│   ├── tests/                        # pytest test suite
│   ├── alembic/                      # Database migrations
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── requirements.txt
│
├── 📂 graphify-out/                  # Codebase graph analysis
│   ├── graph.html                    # Interactive visual graph
│   ├── graph.json                    # Machine-readable graph data
│   └── GRAPH_REPORT.md               # Graph analysis report
│
├── 📂 docs/                          # Documentation assets
│   └── logo.png                      # Project logo
│
├── package.json                      # Frontend dependencies
├── tsconfig.json                     # TypeScript configuration
├── vite.config.ts                    # Vite build configuration
├── eslint.config.js                  # ESLint configuration
├── copilot-instructions.md           # AI coding assistant instructions
├── .gitignore
├── .prettierrc
└── README.md                         # ← You are here
```

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) 20+ (or [Bun](https://bun.sh))
- [Python](https://python.org) 3.11+
- [Docker Desktop](https://docker.com/products/docker-desktop)
- [Git](https://git-scm.com)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/arch-detective.git
cd arch-detective
```

### 2. Install Frontend Dependencies

```bash
npm install
# or
bun install
```

### 3. Start Frontend Dev Server

```bash
npm run dev
```

Open **http://localhost:5173** — the frontend is ready!

### 4. Backend Setup (When Implementing)

```bash
# Start infrastructure services
cd threatlens
docker-compose up -d

# Install Python dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --port 8000

# Start Celery worker (separate terminal)
celery -A app.tasks.celery_app worker --loglevel=info
```

### 5. Verify Everything

```bash
# Frontend
curl http://localhost:5173          # Landing page

# Backend
curl http://localhost:8000/health   # {"status": "healthy"}
curl http://localhost:8000/docs     # Swagger UI
```

---

## 🖥️ Frontend Pages

| Page | Route | Description |
|---|---|---|
| **Landing** | `/` | Hero section, pipeline animation, framework showcase, CTA |
| **Dashboard** | `/dashboard` | Stats tiles, severity feed, scan table, compliance bars |
| **New Scan** | `/new-scan` | Input tabs (Architecture/Description/Logs), framework selector, model picker, live scan animation |
| **Findings** | `/findings` | Severity filter, findings table, expandable detail panel with evidence + remediation + compliance controls |
| **Reports** | `/reports` | Report list with status badges, featured report card, generate/download actions |
| **Report Detail** | `/reports/:id` | Full report view with findings breakdown |

---

## ⚙️ Backend Pipeline

```
User Input (ZIP / Git URL / YAML / Logs)
    │
    ▼
┌─ INGESTION ──────────────────────────────────┐
│  extract_from_zip() / extract_from_git()     │
│  collect_source_files()                       │
│  parse_architecture() / parse_log_file()      │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌─ STATIC SCANNERS (parallel) ─────────────────┐
│  Semgrep      → OWASP patterns               │
│  Bandit       → Python vulnerabilities        │
│  Trufflehog   → Hardcoded secrets             │
│  pip-audit    → Python dependency CVEs        │
│  npm-audit    → Node.js dependency CVEs       │
│  LogAnomaly   → Brute-force / injection       │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌─ LLM DEEP REVIEW ───────────────────────────┐
│  Groq Llama 3 70B code review (30 files max) │
│  Finds logic flaws, auth bypasses, IDOR      │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌─ DEDUPLICATION ──────────────────────────────┐
│  Remove duplicate findings by (file, line, CWE) │
│  Keep highest severity on collision           │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌─ COMPLIANCE MAPPING (RAG) ───────────────────┐
│  1. Embed finding → vector                    │
│  2. Search Qdrant for matching controls       │
│  3. LLM maps to exact violated controls       │
│  4. CVSS 3.1 auto-scoring                     │
│  5. Remediation planning                      │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌─ REPORT GENERATION ─────────────────────────┐
│  Executive summary (LLM)                     │
│  Compliance charts (matplotlib)              │
│  PDF rendering (Jinja2 + WeasyPrint)         │
│  Upload to S3/R2 → signed URL               │
└──────────────────────────────────────────────┘
```

---

## 🛡️ Compliance Frameworks

ThreatLens maps vulnerabilities to controls across these frameworks:

| Framework | Version | Controls | Focus |
|---|---|---|---|
| **GDPR** | Regulation (EU) 2016/679 | 99 Articles | Data privacy & protection |
| **SOC 2** | Trust Services Criteria | 64 Controls | Service organization security |
| **ISO 27001** | 2022 Edition | 93 Controls (Annex A) | Information security management |
| **PCI DSS** | v4.0 | 78 Requirements | Payment card data security |
| **NIST CSF** | 2.0 | 108 Subcategories | Cybersecurity framework |
| **OWASP** | Top 10 (2021) | 10 Categories | Web application security |

---

## 📊 Project Graph

ThreatLens uses [Graphify](https://github.com/nicobailey/graphifyy) for codebase graph analysis — mapping every function, component, and file relationship into an interactive visual graph.

### Generate / Update the Graph

```bash
# Install graphify (one-time)
pip install graphifyy

# Generate the codebase graph
graphify update .

# Output:
# [graphify watch] Rebuilt: 124 nodes, 53 edges, 74 communities
# graph.json, graph.html and GRAPH_REPORT.md updated in graphify-out/
```

### View the Graph

```bash
# Open interactive graph in browser
start graphify-out/graph.html        # Windows
open graphify-out/graph.html         # macOS
xdg-open graphify-out/graph.html     # Linux
```

### Graph Output Files

| File | Description |
|---|---|
| `graphify-out/graph.html` | Interactive force-directed graph visualization |
| `graphify-out/graph.json` | Machine-readable graph (nodes + edges + communities) |
| `graphify-out/GRAPH_REPORT.md` | Analysis report with hubs, communities, knowledge gaps |

### Query the Graph

```bash
# Find shortest path between two nodes
graphify path "AppShell" "DashboardPage"

# Explain a node and its connections
graphify explain "fetch"

# Ask a question about the codebase
graphify query "What components use the mock data?"

# Watch for changes and auto-rebuild
graphify watch .
```

### Install Git Hooks (Auto-Update on Commit)

```bash
graphify hook install
# Now the graph auto-updates on every git commit/checkout
```

### Current Graph Stats

| Metric | Value |
|---|---|
| Files scanned | 79 |
| Nodes | 124 |
| Edges | 53 |
| Communities | 74 |
| Extraction accuracy | 92% extracted, 8% inferred |

> **Note:** The graph is currently frontend-only. Once the backend (Parts 1–8) is implemented, re-run `graphify update .` to see the full system graph with API routes, scanners, RAG pipeline, and Celery tasks.

---

## 📚 Documentation

### Architecture & Implementation Docs

All documentation lives in `.github'/Backend/`:

| Document | Purpose | Size |
|---|---|---|
| **[Backend.md](.github'/Backend/plan/Backend.md)** | Original full specification — the master blueprint | 57 KB |
| **[copilot-instructions.md](.github'/Backend/copilot-instructions.md)** | Master execution guide — BUILD→TEST→SECURE→OPTIMIZE→CONNECT lifecycle | 27 KB |
| **[Backend-Frontend-Connect.md](.github'/Backend/Backend-Frontend-Connect.md)** | Complete frontend↔backend wiring guide with TypeScript code | 42 KB |
| **[AI-Implementation-Prompts.md](.github'/Backend/AI-Implementation-Prompts.md)** | 9 ready-to-use AI prompts for step-by-step implementation | 40 KB |

### Part Files (What to Build)

| Part | File | Topic |
|---|---|---|
| 1 | [Part-01-Foundation-Setup.md](.github'/Backend/Part-01-Foundation-Setup.md) | Docker, FastAPI, DB models, Celery, API client |
| 2 | [Part-02-RAG-Knowledge-Base.md](.github'/Backend/Part-02-RAG-Knowledge-Base.md) | Qdrant, embeddings, 7 chunkers, retriever |
| 3 | [Part-03-Input-Ingestion-Layer.md](.github'/Backend/Part-03-Input-Ingestion-Layer.md) | ZIP/Git extraction, YAML/log parsing |
| 4 | [Part-04-Scanners.md](.github'/Backend/Part-04-Scanners.md) | 6 security scanners + deduplication |
| 5 | [Part-05-LangChain-Agent-Chains.md](.github'/Backend/Part-05-LangChain-Agent-Chains.md) | Compliance mapper, CVSS scorer, remediation |
| 6 | [Part-06-Report-Generator.md](.github'/Backend/Part-06-Report-Generator.md) | PDF templates, charts, S3 upload, CSV/JSON export |
| 7 | [Part-07-Celery-Task-Queue.md](.github'/Backend/Part-07-Celery-Task-Queue.md) | Full scan pipeline, progress tracking |
| 8 | [Part-08-API-Endpoints-Frontend-Integration.md](.github'/Backend/Part-08-API-Endpoints-Frontend-Integration.md) | JWT auth, rate limiting, WebSocket, final integration |

### Workflow Files (How to Build)

| Workflow | File | Steps Covered |
|---|---|---|
| 1 | [Workflow-01-Environment-Setup.md](.github'/Backend/plan/Workflow-01-Environment-Setup.md) | Docker, venv, deps, DB, migrations |
| 2 | [Workflow-02-RAG-Pipeline.md](.github'/Backend/plan/Workflow-02-RAG-Pipeline.md) | Embedder, Qdrant, chunkers, seeding |
| 3 | [Workflow-03-Ingestion-Scanners.md](.github'/Backend/plan/Workflow-03-Ingestion-Scanners.md) | Input parsing, all 6 scanners |
| 4 | [Workflow-04-LangChain-Compliance.md](.github'/Backend/plan/Workflow-04-LangChain-Compliance.md) | Agent chains, CVSS, remediation |
| 5 | [Workflow-05-PDF-Reports.md](.github'/Backend/plan/Workflow-05-PDF-Reports.md) | Templates, PDF rendering, exports |
| 6 | [Workflow-06-Full-Integration-Deploy.md](.github'/Backend/plan/Workflow-06-Full-Integration-Deploy.md) | E2E pipeline, auth, deployment |

---

## 🗺️ Implementation Roadmap

```
┌──────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION PROGRESS                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ✅ Frontend UI (Complete)                                        │
│  │   Landing, Dashboard, New Scan, Findings, Reports             │
│  │                                                                │
│  🚧 Part 1: Foundation Setup ─────────────── (1–2 days)          │
│  │   Docker, FastAPI, DB, Celery, API client                     │
│  │                                                                │
│  ⬜ Part 2: RAG Knowledge Base ────────────── (3–5 days)          │
│  │   Qdrant, embeddings, 7 chunkers, retriever                   │
│  │                                                                │
│  ⬜ Part 3: Input Ingestion Layer ─────────── (2–3 days)          │
│  │   ZIP/Git/YAML/Log parsers, POST /scan                        │
│  │                                                                │
│  ⬜ Part 4: Security Scanners ─────────────── (3–5 days)          │
│  │   Semgrep, Bandit, Trufflehog, LLM review                    │
│  │                                                                │
│  ⬜ Part 5: LangChain Agent Chains ────────── (3–5 days)          │
│  │   Compliance mapping, CVSS scoring                             │
│  │                                                                │
│  ⬜ Part 6: PDF Report Generator ──────────── (3–4 days)          │
│  │   Jinja2 templates, WeasyPrint, S3 upload                     │
│  │                                                                │
│  ⬜ Part 7: Celery Task Queue ─────────────── (2–3 days)          │
│  │   Full pipeline, progress tracking                             │
│  │                                                                │
│  ⬜ Part 8: Auth + Final Integration ──────── (3–5 days)          │
│      JWT, rate limiting, WebSocket, E2E polish                    │
│                                                                    │
│  Total Estimated: 4–6 weeks                                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📡 API Reference

### Public Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger UI |

### Auth Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create account |
| `POST` | `/api/v1/auth/login` | Login → JWT |
| `POST` | `/api/v1/auth/refresh` | Refresh token |
| `GET` | `/api/v1/auth/me` | Current user profile |

### Scan Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/scan` | Start new scan (file upload or Git URL) |
| `GET` | `/api/v1/scans` | List all scans |
| `GET` | `/api/v1/scan/{id}/status` | Scan progress (polled every 3s) |
| `GET` | `/api/v1/scan/{id}/findings` | Findings with severity/framework filters |
| `DELETE` | `/api/v1/scan/{id}` | Delete scan |

### Report Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/scan/{id}/report` | Generate PDF report |
| `GET` | `/api/v1/report/{id}/download` | Download PDF (signed URL) |
| `GET` | `/api/v1/scan/{id}/export/csv` | Export findings as CSV |
| `GET` | `/api/v1/scan/{id}/export/json` | Export findings as JSON |

### Other Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/frameworks` | List compliance frameworks |
| `WS` | `/ws/scan/{id}` | Real-time scan progress (WebSocket) |

---

## 🔐 Environment Variables

### Frontend (`.env`)

```env
VITE_API_URL=http://localhost:8000
```

### Backend (`threatlens/.env`)

```env
# Database
DATABASE_URL=postgresql+asyncpg://threatlens:password@localhost:5432/threatlens_db

# Redis
REDIS_URL=redis://localhost:6379/0

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# LLM
GROQ_API_KEY=gsk_your_key_here

# Auth
SECRET_KEY=your-64-char-random-secret-key-here

# S3/R2 Storage
S3_BUCKET_NAME=threatlens-reports
S3_ENDPOINT_URL=https://your-r2-endpoint.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key

# App
CORS_ORIGINS=http://localhost:5173
DEBUG=true
```

---

## 💻 Development Commands

### Frontend

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint check
npm run format       # Prettier format
```

### Backend

```bash
# Infrastructure
docker-compose up -d                                    # Start PostgreSQL, Redis, Qdrant
docker-compose down                                     # Stop all services
docker-compose logs -f                                  # View logs

# API Server
uvicorn app.main:app --reload --port 8000               # Start with hot reload

# Celery
celery -A app.tasks.celery_app worker --loglevel=info    # Start worker
celery -A app.tasks.celery_app beat --loglevel=info      # Start scheduler

# Database
alembic revision --autogenerate -m "description"         # Create migration
alembic upgrade head                                     # Apply migrations
alembic downgrade -1                                     # Rollback last migration

# Testing
pytest tests/ -v --tb=short                              # Run all tests
pytest tests/ --cov=app --cov-report=html                # Coverage report

# RAG
python scripts/seed_rag.py                               # Seed compliance data
python scripts/sync_nvd.py                               # Sync CVEs from NVD
```

### Graphify (Codebase Graph)

```bash
graphify update .                     # Generate/update project graph
graphify watch .                      # Auto-rebuild on file changes
graphify path "NodeA" "NodeB"         # Find shortest path between nodes
graphify explain "functionName"       # Explain a node and its neighbors
graphify query "What does X do?"      # Ask questions about the codebase
graphify hook install                 # Auto-update graph on git commit
graphify hook uninstall               # Remove git hooks
graphify benchmark                    # Measure token reduction efficiency
```

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Read** the relevant Part file before implementing
4. **Follow** the BUILD → TEST → SECURE → OPTIMIZE → CONNECT lifecycle
5. **Verify** all checklist items pass before submitting
6. **Update** the graph: `graphify update .`
7. **Submit** a Pull Request

### Code Style

- **Python:** PEP 8, type hints everywhere, async/await
- **TypeScript:** Strict mode, no `any`, Prettier formatted
- **Commits:** Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- **Tests:** Required for all business logic

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <br/>
  <p><strong>Built with 🛡️ for the College Project</strong></p>
  <p><sub>ThreatLens — Making compliance audits faster, smarter, and more accessible</sub></p>
</div>
