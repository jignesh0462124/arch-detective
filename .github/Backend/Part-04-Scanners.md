# Part 4 — Scanners (Static Analysis + LLM Review)

> **Timeline:** Weeks 4–5 (Architecture/Log Scanners) + Weeks 6–7 (Code Scanners)  
> **Priority:** 🔴 Critical  
> **Dependencies:** Part 1 (FastAPI), Part 3 (Ingestion layer)  

---

## 4.1 Objective

Build all security scanning modules: Semgrep (static analysis), Bandit (Python AST), Trufflehog (secret detection), dependency auditing (pip-audit/npm-audit), log anomaly detection (Isolation Forest), architecture analysis, and LLM deep code review via Groq.

---

## 4.2 Files to Create

| File | Purpose |
|------|---------|
| `threatlens/app/scanners/__init__.py` | Module init |
| `threatlens/app/scanners/semgrep_runner.py` | Semgrep subprocess + output parser |
| `threatlens/app/scanners/bandit_runner.py` | Bandit Python analysis |
| `threatlens/app/scanners/trufflehog_runner.py` | Secret/credential scanner |
| `threatlens/app/scanners/dependency_audit.py` | pip-audit + npm-audit runners |
| `threatlens/app/scanners/log_anomaly.py` | Isolation Forest anomaly detection |
| `threatlens/app/scanners/llm_code_reviewer.py` | Groq LLM deep code review |
| `threatlens/app/ingestion/arch_parser.py` | Architecture YAML/JSON analysis (if not created in Part 3) |

---

## 4.3 Implementation Details

### 4.3.1 Semgrep Runner (`app/scanners/semgrep_runner.py`)

**Rulesets:**
```python
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
```

**Flow:** subprocess.run → parse JSON output → map to `FindingCreate` objects

**Severity mapping:**
| Semgrep | ThreatLens |
|---------|-----------|
| ERROR | critical |
| WARNING | high |
| INFO | medium |

### 4.3.2 Bandit Runner (`app/scanners/bandit_runner.py`)

Python-specific AST analysis. Runs `bandit -r <path> -f json -q`.

**Severity mapping:**
| Bandit Severity | Bandit Confidence | ThreatLens |
|----------------|------------------|-----------|
| HIGH | HIGH | critical |
| HIGH | * | high |
| MEDIUM | * | medium |
| LOW | * | low |

### 4.3.3 Trufflehog Runner (`app/scanners/trufflehog_runner.py`)

Scans for hardcoded secrets, API keys, credentials. All Trufflehog findings are **critical** severity.

CWE: `CWE-798` (Use of Hard-coded Credentials)

### 4.3.4 Dependency Audit (`app/scanners/dependency_audit.py`)

Two sub-runners:
- **pip-audit:** Scans `requirements.txt` / `Pipfile.lock` for Python CVEs
- **npm-audit:** Scans `package-lock.json` / `yarn.lock` for Node.js CVEs

### 4.3.5 Log Anomaly Detection (`app/scanners/log_anomaly.py`)

Three detection patterns:
1. **Brute-force detection:** >50 auth failures → HIGH severity
2. **SQL injection in URLs:** Regex pattern matching → CRITICAL severity
3. **Unusual HTTP methods:** TRACE/CONNECT/PROPFIND → MEDIUM severity

Plus:
- **Isolation Forest:** Feature extraction from log entries (request rate, error rate, IP diversity) → anomaly scoring

### 4.3.6 LLM Deep Code Review (`app/scanners/llm_code_reviewer.py`)

Uses Groq API with Llama 3 70B for contextual security review.

**System prompt focus areas:**
- Authentication flaws
- Authorization bypass
- Injection attacks
- Insecure data handling
- Broken cryptography
- Exposed secrets
- IDOR
- Race conditions
- Insecure dependencies

**Constraints:**
- Max 8000 chars per file (truncate if larger)
- Output must be valid JSON array
- Cap at 30 files per scan to control API costs

---

## 4.4 Finding Deduplication

After all scanners run, deduplicate findings by:

```python
def deduplicate_findings(findings: list) -> list:
    """
    Deduplicate by (file_path, line_number, cwe_id) tuple.
    Keep the finding with highest severity.
    """
    seen = {}
    for f in findings:
        key = (f.file_path, f.line_number, f.cwe_id)
        if key not in seen or SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[seen[key].severity]:
            seen[key] = f
    return list(seen.values())
```

---

## 4.5 Frontend Connection Points

| Backend | Frontend |
|---------|----------|
| `GET /scan/{id}/status` (progress %) | Dashboard — scan progress bar |
| `GET /scan/{id}/findings` | Findings page — findings table |
| Finding severity levels | Color-coded severity badges (critical=red, high=orange, medium=blue, low=green) |
| Finding source field | Source filter (semgrep, bandit, trufflehog, llm, log, arch) |
| `code_snippet` field | Code snippet display with syntax highlighting |

### Frontend Findings Fetch

```typescript
// src/lib/api/findings.ts
export async function fetchFindings(
  scanId: string,
  filters?: { severity?: string; framework?: string }
): Promise<Finding[]> {
  const params = new URLSearchParams();
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.framework) params.set("framework", filters.framework);
  
  const res = await fetch(`${API_BASE}/api/v1/scan/${scanId}/findings?${params}`);
  return (await res.json()).findings;
}
```

### Scan Progress Polling

```typescript
// src/hooks/useScanProgress.ts
export function useScanProgress(scanId: string) {
  return useQuery({
    queryKey: ["scan-status", scanId],
    queryFn: () => fetchScanStatus(scanId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 3000; // Poll every 3 seconds while running
    },
  });
}
```

---

## 4.6 Verification Checklist

- [ ] Semgrep runs on a test Python file and detects SQL injection
- [ ] Bandit detects hardcoded passwords in test code
- [ ] Trufflehog detects AWS keys in test files
- [ ] pip-audit reports known CVEs in an outdated requirements.txt
- [ ] Log anomaly detector flags >50 auth failures as brute-force
- [ ] Log anomaly detector flags SQL injection patterns in URLs
- [ ] LLM review returns valid JSON findings for a vulnerable Flask app
- [ ] Deduplication removes duplicate findings (same file/line/CWE)
- [ ] All findings have correct severity levels
- [ ] Frontend findings page displays scanner results with filters

---

## 4.7 Security Notes

- **Subprocess timeout:** All scanners have 300s timeout to prevent hanging
- **Semgrep sandbox:** Runs in isolated temp directory, not the main app dir
- **LLM prompt injection:** Code content is wrapped in code fences to reduce injection risk
- **Rate limiting on Groq:** Implement exponential backoff for 429 responses
- **File size cap:** Don't send files >8KB to LLM — truncate with `[truncated]` marker
- **No execution:** Never execute uploaded code — only static analysis

---

## 4.8 Implementation Status

**Backend implementation completed:** July 24, 2026

Implemented:

- Shared scanner runtime with 300-second timeouts, bounded output, sanitized
  subprocess environments, isolated tool configuration, and credential removal.
- Semgrep, Bandit, official TruffleHog v3, pip-audit, npm audit, log anomaly,
  and Groq/Llama code-review adapters.
- Deterministic finding normalization, CWE/severity mapping, fingerprints, and
  highest-severity deduplication.
- Workspace-protected, paginated
  `GET /api/v1/scans/{scan_id}/findings` with severity, framework, and source
  filters.
- Vulnerable fixtures, offline parser/security tests, and opt-in real scanner
  and Groq smoke tests.
- Worker container hardening and the required Git, Node/npm, and official
  TruffleHog tooling.

Verification:

- Default backend suite: `89 passed, 4 skipped`.
- Real scanner smoke tests:
  `THREATLENS_RUN_SCANNER_SMOKE=1 python -m pytest tests/test_part4_smoke.py`.
- Real Groq smoke test:
  `THREATLENS_RUN_GROQ_SMOKE=1 python -m pytest tests/test_part4_smoke.py`.

Deferred by architecture:

- Persisting scanner output and executing all scanners as one scan pipeline is
  Part 7 Celery orchestration.
- Frontend findings hooks, progress polling, and mock-data replacement remain
  Part 8 integration work.
