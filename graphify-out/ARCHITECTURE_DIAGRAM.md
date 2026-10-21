# ThreatLens / Arch Detective Architecture

> Generated only from `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md`.
> Solid arrows represent relationships directly supported by graph nodes or extracted edges.
> Dashed arrows summarize higher-level flow inferred from those relationships.

```mermaid
flowchart LR
    User([User / Security Analyst])

    subgraph Client["Web Client - React + Vite"]
        UI["Routes and dashboards\nProtectedApp / Landing\nScans / Findings / Attack Graph / Audit Log"]
        ClientAPI["Client API layer\nscan, findings, reports, workspaces"]
        ClientDB["Supabase client/data layer\nauth session + db* operations"]
        LocalAI["Optional client AI integration\nGroq chat / model configuration"]
        UI --> ClientAPI
        UI --> ClientDB
        UI --> LocalAI
    end

    subgraph Backend["ThreatLens Backend - FastAPI"]
        Entry["FastAPI application\nVercel serverless entry available"]
        Auth["Authentication and authorization\nSupabaseJWTVerifier / workspace roles"]
        APIs["REST API modules\nscans / findings / reports / exports\nworkspaces / audit / frameworks"]
        Progress["Real-time progress\nServer-Sent Events"]
        LocalScan["Local scan path\nin-process; no DB/Redis/Celery"]

        Entry --> Auth
        Entry --> APIs
        APIs --> Progress
        APIs --> LocalScan
    end

    subgraph Async["Asynchronous Processing"]
        Queue["Celery task queue"]
        Redis[("Redis\nbroker + transient progress cache")]
        Orchestrator["run_full_scan()\nscan pipeline orchestrator"]
        ReportTask["Async report task"]

        Queue <--> Redis
        Queue --> Orchestrator
        Queue --> ReportTask
    end

    subgraph Pipeline["Scan and Analysis Pipeline"]
        Ingest["Ingestion\nZIP / Git / architecture / logs"]
        Scanners["Scanner ensemble\nBandit / Semgrep / TruffleHog\nnpm audit / pip-audit / log anomaly"]
        Normalize["Normalize, deduplicate, score\nand persist findings"]
        Agents["AI analysis agents\nCVSS scoring / compliance mapping\nremediation / executive summary"]
        RAG["RAG and knowledge retrieval\nembeddings / controls / NVD CVEs"]

        Orchestrator --> Ingest
        Ingest --> Scanners
        Scanners --> Normalize
        Normalize --> Agents
        RAG --> Agents
    end

    subgraph Data["Data and Artifact Services"]
        SupaAuth["Supabase Auth / JWKS"]
        Postgres[("PostgreSQL\nusers / workspaces / scans / findings\ncompliance / audit / reports")]
        Storage[("Supabase Storage\nscan inputs + generated reports")]
        Qdrant[("Qdrant vector store\ncontrols + CVE knowledge")]
    end

    subgraph External["External Services and Tools"]
        LLM["Groq / OmegaPlus LLM APIs"]
        NVD["NVD CVE feed"]
        CLIs["Scanner executables"]
        Browser["Headless Chromium"]
    end

    subgraph Reporting["Reporting"]
        ReportGen["PDF report generator\ncompliance charts + HTML template"]
        Downloads["Signed report download / exports"]
        ReportTask --> ReportGen
        ReportGen --> Downloads
    end

    User --> UI
    ClientAPI -->|"REST + SSE"| Entry
    ClientDB --> SupaAuth
    ClientDB -.->|"direct Supabase data operations"| Postgres
    LocalAI -.-> LLM

    Auth --> SupaAuth
    APIs --> Postgres
    APIs --> Storage
    APIs --> Queue
    Progress <--> Redis

    Ingest --> Storage
    Scanners --> CLIs
    Normalize --> Postgres
    Agents --> LLM
    RAG <--> Qdrant
    NVD --> RAG

    Orchestrator --> Postgres
    Orchestrator --> Storage
    Agents --> Postgres
    ReportGen --> Postgres
    ReportGen --> Browser
    ReportGen --> Storage
    Downloads --> User

    LocalScan -.->|"synchronous alternative"| Scanners
```

## Primary runtime flow

```mermaid
sequenceDiagram
    actor User
    participant Web as React/Vite client
    participant API as FastAPI
    participant DB as PostgreSQL
    participant Store as Supabase Storage
    participant Queue as Celery/Redis
    participant Worker as run_full_scan()
    participant Tools as Scanner ensemble
    participant AI as AI agents + RAG

    User->>Web: Create scan (upload or Git source)
    Web->>API: Authenticated scan request
    API->>Store: Reserve/store scan artifact
    API->>DB: Create scan record
    API->>Queue: Dispatch after commit
    API-->>Web: Scan ID
    Web->>API: Open SSE progress stream
    Queue->>Worker: Execute scan task
    Worker->>Store: Retrieve artifact
    Worker->>Tools: Run static, dependency, secret, and log scanners
    Tools-->>Worker: Normalized findings
    Worker->>AI: CVSS, compliance, remediation, summary
    AI-->>Worker: Enriched findings and violations
    Worker->>DB: Persist results and durable progress
    API-->>Web: Stream progress/results
    Web-->>User: Findings, compliance, attack graph, exports
```

## Graph evidence used

- Frontend nodes come from `src/routes`, `src/lib/api`, `src/hooks`, and `src/lib/supabase.ts` represented in the graph.
- Backend entry, API, authentication, ingestion, scanner, agent, RAG, task, storage, and report nodes come from `threatlens/app` graph records.
- `run_full_scan()` is the principal cross-community bridge and connects ingestion, scanners, persistence, storage, compliance, and scoring concerns.
- The graph explicitly describes PostgreSQL as durable progress storage and Redis as a transient cache; Celery uses Redis.
- The graph includes Qdrant connectivity and NVD-to-vector-store synchronization.
- `SupabaseStorage`, `Scan`, `ScanStatus`, `AuthenticatedUser`, and `Finding` are among the most connected domain abstractions.

## Confidence note

The source graph contains 1,227 nodes and 2,777 edges: 59% extracted and 41% inferred. Component existence and named function calls above are grounded in graph records; dashed architecture arrows are intentionally marked as summarized or inferred flows. The graph reports no ambiguous edges, but several high-degree domain-model connections remain candidates for source-level verification.
