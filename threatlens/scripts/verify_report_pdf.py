"""Generate synthetic PDF QA evidence; never reads user scans or credentials."""
from pathlib import Path
from app.report.generator import generate_pdf_report

destination = Path(__file__).resolve().parents[2] / "output" / "pdf"
destination.mkdir(parents=True, exist_ok=True)
data = {
    "scan": {"id": "synthetic-report-layout", "workspace_id": "isolated-qa", "target_name": "Payments service", "scan_type": "static_analysis", "selected_frameworks": ["soc2", "gdpr"], "completed_at": "2026-10-20T00:00:00Z"},
    "summary": {"summary": "The saved automated assessment identified input validation risks. Validate the evidence and prioritize the recorded high-severity findings.", "top_priorities": ["Use parameterized database operations", "Remove embedded credentials"]},
    "framework_scores": {"soc2": 0},
    "analysis": {"files_scanned": 90, "files_truncated": 2, "limitations": ["AI inspects a sampled context, not the full archive.", "False positives and false negatives require human review."]},
    "findings": [{"id": f"fixture-{n}", "title": f"Unvalidated input {n + 1}", "severity": "high" if n % 2 else "medium", "state": "open", "file_path": "src/controllers/payments/handler.py", "line_number": n + 1, "description": "User input reaches a sensitive operation without adequate validation.", "cvss_score": 0, "code_snippet": "value = request.args.get('input')\nexecute(value)", "remediation_steps": ["Validate accepted input", "Use a parameterized operation"], "violations": [{"framework": "soc2", "control_id": "CC6.1", "control_title": "Logical access controls"}]} for n in range(12)],
    "report_id": "SYNTHETIC-QA-NOT-A-REAL-AUDIT", "generated_at": "2026-10-20 00:00 UTC",
}
result = generate_pdf_report(data)
(destination / "reports-layout-qa.pdf").write_bytes(result)
print(f"Synthetic PDF: {len(result)} bytes")
