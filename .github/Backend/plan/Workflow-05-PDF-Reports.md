# Workflow 5 — PDF Reports + Export

> **Covers:** Part 6 (Report Generator)  
> **Estimated Time:** 4–5 days  
> **Prerequisites:** Workflow 4 (Compliance data available)  
> **Goal:** Generate professional PDF audit reports and CSV/JSON exports  

---

## Workflow Sequence

```mermaid
graph TD
    A[Write Jinja2 HTML templates] --> B[Write compliance chart generator]
    B --> C[Write PDF renderer with WeasyPrint]
    C --> D[Write S3/R2 uploader]
    D --> E[Write report Celery task]
    E --> F[Write POST /scan/{id}/report endpoint]
    F --> G[Write GET /report/{id}/download endpoint]
    G --> H[Write CSV export endpoint]
    H --> I[Write JSON export endpoint]
    I --> J[Test: Generate PDF from a completed scan]
    J --> K[Connect frontend Reports page]
    K --> L[Test: Full generate + download flow from UI]
```

---

## Step-by-Step Implementation

### Step 1: Jinja2 Templates (Day 1)

Create 4 template files:

#### `base.html` — Master template
- Cover page with dark background, scan name, timestamp
- Includes all sub-templates
- CSS styling for print/PDF output

#### `executive_summary.html`
- Overall risk level indicator
- Key statistics (total findings, critical count, compliance scores)
- LLM-generated executive paragraph

#### `compliance_section.html`
- Embedded bar chart (base64 PNG from matplotlib)
- Per-framework breakdown table
- Top violated controls list

#### `findings.html`
- Findings grouped by severity (critical → low)
- Each finding card shows:
  - Title, description, severity badge
  - File path + line number
  - Code snippet in dark code block
  - Framework violation tags
  - CVSS score
  - Remediation steps

### Step 2: Chart Generator (Day 2)

```python
# app/report/generator.py
def generate_compliance_chart(framework_scores: dict) -> str:
    # matplotlib horizontal bar chart
    # Color: red (<65), orange (65-80), green (>=80)
    # Returns base64-encoded PNG string
```

### Step 3: PDF Renderer (Day 2)

```python
# WeasyPrint installation (requires system deps):
# Ubuntu: sudo apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libcairo2
# Windows: pip install weasyprint (uses prebuilt binaries)

def generate_pdf_report(scan_data: dict) -> bytes:
    env = Environment(loader=FileSystemLoader("app/report/templates"))
    template = env.get_template("base.html")
    html = template.render(...)
    return HTML(string=html, base_url=".").write_pdf()
```

### Step 4: S3/R2 Upload (Day 3)

```python
# app/report/uploader.py
# If S3 credentials not configured, fall back to local file storage:
def upload_pdf(pdf_bytes, scan_id):
    if settings.S3_ACCESS_KEY:
        return upload_to_s3(pdf_bytes, scan_id)
    else:
        return save_locally(pdf_bytes, scan_id)
```

### Step 5: API Endpoints (Day 3–4)

```bash
# Test report generation:
curl -X POST http://localhost:8000/api/v1/scan/{scan_id}/report
# Returns: {"task_id": "...", "status": "generating"}

# Poll until ready, then download:
curl http://localhost:8000/api/v1/report/{scan_id}/download
# Returns: {"url": "https://...", "expires_in": 3600}

# CSV export:
curl http://localhost:8000/api/v1/scan/{scan_id}/export/csv > findings.csv
```

### Step 6: Frontend Integration (Day 4–5)

```typescript
// src/routes/_app/reports.tsx
// 1. "Generate Report" button → POST /scan/{id}/report
// 2. Show loading spinner during generation
// 3. "Download PDF" button → opens signed URL in new tab
// 4. "Export CSV" button → triggers CSV download
```

---

## Verification Criteria

| Check | Expected Result |
|-------|----------------|
| HTML templates render | Valid HTML without Jinja2 errors |
| Chart generation | base64 PNG with correct color coding |
| WeasyPrint PDF | Valid PDF file, opens in reader |
| PDF cover page | Dark background, scan name, timestamp |
| PDF findings | All findings with code snippets |
| S3 upload | Returns valid signed URL |
| Local fallback | Saves PDF to local storage when no S3 |
| CSV export | Proper headers, escaped values |
| Frontend generate button | Triggers report and shows loading |
| Frontend download | Opens PDF in new browser tab |

---

## Failure Recovery

| Issue | Fix |
|-------|-----|
| WeasyPrint import error | Install system deps: pango, cairo |
| PDF rendering slow (>30s) | Reduce finding count per page, simplify CSS |
| S3 upload fails | Check credentials; fall back to local storage |
| Chart text overlap | Adjust matplotlib figure size and margins |
| CSV encoding issues | Force UTF-8 BOM for Excel compatibility |
