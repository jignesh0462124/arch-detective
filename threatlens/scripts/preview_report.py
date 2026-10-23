"""Render a synthetic report for visual QA; no account or source access."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.report.generator import generate_pdf_report


def main():
    output = Path(__file__).resolve().parents[2] / "output" / "pdf"
    output.mkdir(parents=True, exist_ok=True)
    sample = {
        "scan": {"id": "synthetic-preview", "target_name": "Example project", "status": "completed", "selected_frameworks": ["soc2"]},
        "report_id": "presentation-preview", "generated_at": "2026-10-23 00:00 UTC",
        "framework_scores": {"soc2": 0},
        "summary": {"summary": "Synthetic report demonstrating source evidence, saved remedies and suggested verification checks.", "top_priorities": ["Review untrusted query input"]},
        "findings": [{
            "id": "example-1", "title": "Untrusted input reaches a database query", "severity": "high",
            "cvss_score": 7.5, "cwe_id": "CWE-89", "file_path": "src/server.ts", "line_number": 42,
            "description": "Request data is interpolated into a query. Review the recorded code and confirm the affected database path.",
            "code_snippet": 'const name = request.query.name;\nconst query = "SELECT * FROM users WHERE name = " + name;\nconst result = await database.query(query);',
            "remediation_steps": ["Replace string interpolation with the database driver's bound parameters.", "Validate expected input types at the request boundary.", "Add regression tests for normal input, quotes, and unexpected parameter types."],
            "state": "open", "source": "ai_source_verified", "violations": [],
        }, {
            "id": "example-2", "title": "Long evidence panel pagination", "severity": "medium",
            "description": "Synthetic lines test continued table headers and page boundaries.",
            "file_path": "tests/long-fixture.py", "code_snippet": "\n".join(f"result_{i} = validate(value_{i})" for i in range(100)),
            "remediation": "Review the input validation boundary.\nAdd tests for rejected values.",
        }],
    }
    pdf = output / "archon-report-preview.pdf"
    pdf.write_bytes(generate_pdf_report(sample))
    import pymupdf
    document = pymupdf.open(pdf)
    for index, page in enumerate(document):
        page.get_pixmap(matrix=pymupdf.Matrix(1.2, 1.2)).save(output / f"preview-page-{index+1}.png")
    print(f"Rendered {len(document)} pages: {pdf}")


if __name__ == "__main__":
    main()
