# Part 7 — Celery Task Queue + Full Scan Pipeline

> **Timeline:** Integrated across Weeks 6–8  
> **Priority:** 🔴 Critical (ties all scanners together)  
> **Dependencies:** Part 1 (Celery setup), Part 3 (Ingestion), Part 4 (Scanners), Part 5 (Agent)  

---

## 7.1 Objective

Build the Celery async task system that orchestrates the complete scan pipeline: ingestion → static analysis → LLM review → deduplication → compliance mapping → database persistence. Includes progress tracking, retry logic, and error handling.

---

## 7.2 Files to Create/Modify

| File | Purpose |
|------|---------|
| `threatlens/app/tasks/celery_app.py` | Celery app configuration (created in Part 1, extended here) |
| `threatlens/app/tasks/scan_task.py` | Full scan orchestration task |
| `threatlens/app/tasks/report_task.py` | PDF report generation task |

---

## 7.3 Implementation Details

### 7.3.1 Full Scan Pipeline (`app/tasks/scan_task.py`)

The `run_full_scan` task is the **orchestration heart** of ThreatLens:

```
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
```

**Key design decisions:**
- **Sequential by phase, parallel within phase:** Scanners can run concurrently (Celery group) but compliance mapping must be sequential (API rate limits)
- **Progress granularity:** Update every 5% to give smooth frontend progress bar
- **Max retries:** 3 retries with 60s countdown between
- **Error isolation:** One scanner failing doesn't kill the entire scan

### 7.3.2 Error Handling Strategy

```python
@celery_app.task(bind=True, max_retries=3)
def run_full_scan(self, scan_id, scan_type, source, frameworks):
    try:
        # ... scan pipeline ...
    except Exception as exc:
        update_scan_status(db, scan_id, "failed")
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()
        # Cleanup temp directories
```

**Per-scanner error handling:**
```python
# Each scanner is wrapped individually
try:
    semgrep_findings = run_semgrep(repo_path)
except Exception as e:
    logger.error(f"Semgrep failed: {e}")
    semgrep_findings = []  # Continue with other scanners
```

### 7.3.3 Celery Beat — Scheduled Tasks

```python
# Weekly CVE database sync
celery_app.conf.beat_schedule = {
    "sync-nvd-cves": {
        "task": "app.tasks.scan_task.sync_nvd_cves",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),  # Sunday 2 AM
    },
}
```

---

## 7.4 Frontend Connection Points

| Backend | Frontend |
|---------|----------|
| `GET /scan/{id}/status` (progress, status) | Real-time progress bar on scan detail page |
| `status: "completed"` | Trigger findings fetch + enable report generation |
| `status: "failed"` | Show error message + retry button |
| `finding_count` in status response | Live finding counter during scan |

### Frontend Polling Pattern (TanStack Query)

```typescript
// src/hooks/useScanProgress.ts
import { useQuery } from "@tanstack/react-query";

export function useScanProgress(scanId: string) {
  return useQuery({
    queryKey: ["scan-status", scanId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/scan/${scanId}/status`);
      return res.json();
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 3000; // Poll every 3 seconds while running
    },
  });
}
```

### WebSocket Alternative (Week 10 enhancement)

```typescript
// Future: Replace polling with WebSocket for real-time updates
const ws = new WebSocket(`ws://localhost:8000/ws/scan/${scanId}`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  setProgress(data.progress);
  setStatus(data.status);
};
```

---

## 7.5 Verification Checklist

- [ ] Celery worker starts and connects to Redis broker
- [ ] Scan task dispatches and appears in Celery worker logs
- [ ] Progress updates are visible via status endpoint (5%, 15%, 30%, ...)
- [ ] Scan completes with status "completed" and progress 100
- [ ] Failed scan retries up to 3 times with 60s delay
- [ ] Temp directories are cleaned up after scan completion
- [ ] Findings are persisted in PostgreSQL
- [ ] Compliance violations are linked to findings
- [ ] Frontend progress bar animates smoothly from 0-100%
- [ ] Frontend handles "failed" status with error display
- [ ] Celery Flower monitoring shows task history (optional)

---

## 7.6 Security Notes

- **Task result expiration:** Set `result_expires=3600` to auto-clear stale results from Redis
- **Task timeouts:** Set `task_time_limit=600` (10 min) to prevent runaway tasks
- **Temp directory cleanup:** Always clean up in `finally` block, even on failure
- **Redis authentication:** Enable Redis password in production
- **Celery serializer:** Use JSON serializer, not pickle (security risk)
