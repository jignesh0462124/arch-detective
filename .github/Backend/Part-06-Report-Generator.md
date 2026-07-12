# Part 6 — PDF Report Generator + Export

> **Timeline:** Week 9  
> **Priority:** 🟠 High  
> **Dependencies:** Part 5 (Compliance mapping data), Part 4 (Scanner findings)  

---

## 6.1 Objective

Build the PDF report generation system: Jinja2 HTML templates → WeasyPrint PDF rendering, compliance score charts (matplotlib), S3/R2 upload for persistent storage, signed download URLs, and CSV/JSON export endpoints.

---

## 6.2 Files to Create

| File | Purpose |
|------|---------|
| `threatlens/app/report/__init__.py` | Module init |
| `threatlens/app/report/generator.py` | PDF generation orchestrator |
| `threatlens/app/report/uploader.py` | S3/R2 upload + signed URL |
| `threatlens/app/report/templates/base.html` | Main Jinja2 report template |
| `threatlens/app/report/templates/executive_summary.html` | Executive summary section |
| `threatlens/app/report/templates/findings.html` | Findings by severity section |
| `threatlens/app/report/templates/compliance_section.html` | Compliance scores + violations |
| `threatlens/app/api/reports.py` | Report API endpoints |
| `threatlens/app/api/export.py` | CSV/JSON export endpoints |
| `threatlens/app/tasks/report_task.py` | Celery task for async PDF generation |

---

## 6.3 Implementation Details

### 6.3.1 PDF Generator (`app/report/generator.py`)

Two main functions:

**`generate_compliance_chart(framework_scores)`** — matplotlib bar chart → base64 PNG

```python
# Color coding:
# Red (#e24b4a): score < 65%
# Orange (#ef9f27): score 65-80%
# Green (#1d9e75): score >= 80%
```

**`generate_pdf_report(scan_data)`** — Jinja2 render → WeasyPrint → PDF bytes

**Scan data structure expected:**
```python
{
    "target_name": "my-flask-app",
    "scan_type": "codebase",
    "framework_scores": {"GDPR": 72, "SOC2": 58, "ISO27001": 81, ...},
    "findings": [...],
    "executive_summary": "...",
    "total_findings": 23,
    "critical_count": 3,
    "high_count": 7,
}
```

### 6.3.2 Jinja2 Templates

**`base.html`** — Cover page + includes:
- Cover: Dark background, scan name, generation timestamp, ThreatLens branding
- `{% include "executive_summary.html" %}`
- `{% include "compliance_section.html" %}`
- `{% include "findings.html" %}`

**CSS styling:**
- Professional typography (Inter font)
- Color-coded severity borders (critical=red, high=orange, medium=blue, low=green)
- Framework tags with subtle backgrounds
- Clean tables with alternating row colors
- Code blocks with dark background syntax display
- Page breaks between sections

### 6.3.3 S3/R2 Uploader (`app/report/uploader.py`)

```python
import boto3
from app.config import settings

def upload_pdf(pdf_bytes: bytes, scan_id: str) -> str:
    """Upload PDF to S3/R2, return signed URL (1 hour expiry)."""
    s3 = boto3.client("s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )
    key = f"reports/{scan_id}/audit-report.pdf"
    s3.put_object(Bucket=settings.S3_BUCKET_NAME, Key=key, Body=pdf_bytes, ContentType="application/pdf")
    
    signed_url = s3.generate_presigned_url("get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
        ExpiresIn=3600,
    )
    return signed_url
```

### 6.3.4 Report API Endpoints

```
POST /api/v1/scan/{scan_id}/report     → Trigger PDF generation (returns task_id)
GET  /api/v1/report/{scan_id}/download  → Get signed download URL
GET  /api/v1/scan/{scan_id}/export/csv  → Download findings as CSV
GET  /api/v1/scan/{scan_id}/export/json → Download findings as JSON
```

### 6.3.5 Celery Report Task

```python
@celery_app.task(bind=True)
def generate_pdf_report_task(self, scan_id: str):
    """Async PDF generation — can take 10-30 seconds."""
    scan_data = load_scan_data(scan_id)
    pdf_bytes = generate_pdf_report(scan_data)
    signed_url = upload_pdf(pdf_bytes, scan_id)
    save_report_to_db(scan_id, signed_url)
```

---

## 6.4 Frontend Connection Points

| Backend | Frontend |
|---------|----------|
| `POST /scan/{id}/report` | Reports page — "Generate Report" button |
| `GET /report/{id}/download` | Reports page — "Download PDF" button |
| `GET /scan/{id}/export/csv` | Findings page — "Export CSV" button |
| Report generation status | Reports page — loading spinner while generating |
| `framework_scores` | Dashboard — compliance score bar chart (Recharts) |

### Frontend Report Generation Flow

```typescript
// src/lib/api/reports.ts
export async function generateReport(scanId: string): Promise<{ task_id: string }> {
  const res = await fetch(`${API_BASE}/api/v1/scan/${scanId}/report`, { method: "POST" });
  return res.json();
}

export async function downloadReport(scanId: string): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/api/v1/report/${scanId}/download`);
  return res.json();
}

// In component:
const handleGenerateReport = async () => {
  setGenerating(true);
  await generateReport(scanId);
  // Poll until report is ready, then enable download
  const { url } = await downloadReport(scanId);
  window.open(url, "_blank");
  setGenerating(false);
};
```

### Frontend Compliance Chart (using Recharts)

The Dashboard already has Recharts installed. Render compliance scores:

```tsx
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts";

<BarChart data={frameworkScores}>
  <XAxis dataKey="framework" />
  <YAxis domain={[0, 100]} />
  <Bar dataKey="score">
    {frameworkScores.map((entry, index) => (
      <Cell key={index} fill={getScoreColor(entry.score)} />
    ))}
  </Bar>
</BarChart>
```

---

## 6.5 Verification Checklist

- [ ] Jinja2 templates render valid HTML
- [ ] WeasyPrint produces a valid PDF from rendered HTML
- [ ] Compliance chart generates correctly with color coding
- [ ] PDF has cover page, executive summary, compliance section, and findings
- [ ] PDF page breaks are clean (no mid-card splits)
- [ ] S3/R2 upload works and returns valid signed URL
- [ ] Signed URL expires after 1 hour
- [ ] CSV export includes all finding fields with proper escaping
- [ ] JSON export returns clean, parseable data
- [ ] Frontend "Generate Report" flow works end-to-end
- [ ] Frontend "Download PDF" opens PDF in new tab
- [ ] Dashboard compliance chart renders from backend data

---

## 6.6 Security Notes

- **Signed URLs:** Always use time-limited signed URLs (1 hour max) — never expose permanent public URLs
- **PDF content sanitization:** Ensure code snippets in PDF don't contain executable JavaScript
- **S3 bucket policy:** Bucket should be private, accessed only via signed URLs
- **Rate limit report generation:** Max 1 concurrent report per user to prevent resource abuse
- **CSV injection:** Prefix cell values starting with `=`, `+`, `-`, `@` with a single quote to prevent formula injection
