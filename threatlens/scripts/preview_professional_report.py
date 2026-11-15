"""Render isolated PDF fixtures and check text completeness/page bounds.

No account, source-storage or model access. Run from the repository root:
    python threatlens/scripts/preview_professional_report.py
Use --engine weasyprint in an environment with its native libraries installed.
"""
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
import sys
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.report import generator


def fixtures():
    base = {
        "scan": {
            "id": "synthetic-professional-report", "target_name": "Example application",
            "status": "completed", "completed_at": "2026-11-05T09:00:00Z",
            "selected_frameworks": ["soc2", "gdpr"],
        },
        "report_id": "archon-layout-preview", "generated_at": "2026-11-05T09:30:00Z",
        "framework_scores": {"soc2": 0},
        "summary": {
            "summary": "This synthetic assessment demonstrates how recorded findings, source evidence and saved remedies appear in an Archon report. It is not an assessment of a real repository.",
            "top_priorities": ["Review the database query boundary.", "Validate the evidence before changing the password-visibility icon."],
        },
        "coverage": {"analyzed_files": 14, "limitations": ["Runtime exploitation was not tested.", "No project tests were executed by this assessment."]},
        "findings": [{
            "id": "synthetic-query", "title": "Untrusted input reaches a database query", "severity": "high",
            "cvss_score": 7.5, "cwe_id": "CWE-89", "file_path": "src/server.ts", "line_number": 42,
            "source": "ai_source_verified", "state": "open",
            "description": "Request data is interpolated into a query. Review the recorded code and confirm the database path before remediation.",
            "code_snippet": 'const name = request.query.name;\nconst query = "SELECT * FROM users WHERE name = " + name;\nconst result = await database.query(query);',
            "remediation": 'Use the driver\'s bound parameters; confirm the placeholder syntax for your driver.\n```typescript\nconst name = request.query.name;\nconst query = "SELECT * FROM users WHERE name = ?";\nconst result = await database.query(query, [name]);\n```\nVerify normal input, quotes and unexpected parameter types.',
            "violations": [{"framework": "soc2", "control_id": "CC6.1", "control_title": "Logical access controls (recorded mapping)"}],
        }, {
            "id": "synthetic-svg", "title": "Review static SVG icon assignment", "severity": "medium", "state": "open",
            "file_path": "views/login.php", "line_number": 205, "cwe_id": "CWE-79",
            "description": "The excerpt assigns a hardcoded SVG string to innerHTML. It does not establish attacker-controlled HTML or confirmed XSS. Confirm the actual data flow before classifying exploitability.",
            "code_snippet": 'function showIcon() {\n  eyeIcon.innerHTML = \'<path d="M3 12h18" />\';\n}',
            "remediation": 'If avoiding string-based icon updates, construct SVG elements in the SVG namespace. Preserve the original icon geometry.\n```javascript\nconst path = document.createElementNS(\n  "http://www.w3.org/2000/svg", "path"\n);\npath.setAttribute("d", "M3 12h18");\neyeIcon.replaceChildren(path);\n```\nReview the rendered icon and existing password-toggle behavior. This example is not a general-purpose sanitizer.',
            "violations": [],
        }],
    }
    empty = copy.deepcopy(base)
    empty.update(findings=[], framework_scores={}, summary={})
    empty["scan"].update(target_name="Empty assessment", selected_frameworks=[])
    long = copy.deepcopy(base)
    long["scan"]["target_name"] = "Long project " + "repository-component-" * 14
    long["findings"] = [{
        "title": "Long evidence continuation", "severity": "high",
        "file_path": "src/" + "nested-directory/" * 12 + "validation.py", "line_number": 300,
        "description": "Pagination fixture with excerpt numbering, not inferred source positions.",
        "code_snippet": "\n".join(f"line_{n:03} = validate(value_{n:03})" for n in range(100)),
        "remediation": 'Review "<input>" and https://example.test/#section.\n```python\n  final_remedy_marker = "<safe>"\n```',
    }]
    many = copy.deepcopy(base)
    many["findings"] = [{
        "id": str(n), "title": "Duplicate title", "severity": ["critical", "high", "medium", "low", "info"][n % 5],
        "description": f"Unique evidence marker FINDING_{n:03}_END", "cvss_score": 0 if n == 0 else None,
    } for n in range(12)]
    return {"preview": base, "zero": empty, "long": long, "many": many}


def inspect_pdf(pdf, payload, render_dir):
    import pymupdf
    from PIL import Image, ImageDraw

    document = pymupdf.open(pdf)
    all_text = "\n".join(page.get_text() for page in document)
    for finding in payload["findings"]:
        assert finding["title"] in all_text, finding["title"]
    if "line_099" in str(payload):
        assert all(f"line_{n:03}" in all_text for n in range(100))
        assert "final_remedy_marker" in all_text
        assert "#section" in all_text
    if payload["scan"]["target_name"] == "Empty assessment":
        assert "No findings were recorded" in all_text
    for n in range(12):
        if f"FINDING_{n:03}_END" in str(payload):
            assert f"FINDING_{n:03}_END" in all_text
    render_dir.mkdir(parents=True, exist_ok=True)
    pages = []
    for index, page in enumerate(document):
        assert page.get_text().strip(), f"Blank page {index + 1}"
        assert abs(page.rect.width - 595.28) < 2 and abs(page.rect.height - 841.89) < 2
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    if span["text"].strip():
                        rect = pymupdf.Rect(span["bbox"])
                        assert rect.x0 >= -1 and rect.y0 >= -1 and rect.x1 <= page.rect.width + 1 and rect.y1 <= page.rect.height + 1, (index + 1, span)
                        if "line_" in span["text"] or "final_remedy_marker" in span["text"]:
                            assert span["size"] >= 8.95, ("Code shrunk below 9pt", index + 1, span)
        if index:
            assert f"Page {index + 1} of {len(document)}" in page.get_text()
        path = render_dir / f"page-{index + 1}.png"
        page.get_pixmap(matrix=pymupdf.Matrix(1.25, 1.25)).save(path)
        with Image.open(path) as image:
            thumbnail = image.convert("RGB")
            thumbnail.thumbnail((357, 505))
            pages.append(thumbnail)
    # Every page appears on a labeled contact sheet, plus full-resolution PNGs.
    for start in range(0, len(pages), 6):
        group = pages[start:start + 6]
        sheet = Image.new("RGB", (3 * 377, ((len(group) + 2) // 3) * 535), "#dedbd5")
        draw = ImageDraw.Draw(sheet)
        for n, page in enumerate(group):
            x, y = (n % 3) * 377 + 10, (n // 3) * 535 + 22
            sheet.paste(page, (x, y))
            draw.text((x, y - 16), f"Page {start + n + 1}", fill="black")
        sheet.save(render_dir / f"contact-{start // 6 + 1}.png")
    return {"pages": len(document), "bytes": pdf.stat().st_size, "text_complete": True, "page_bounds": True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", choices=["chromium", "weasyprint"], default="chromium")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    output = root / "output/pdf"
    output.mkdir(parents=True, exist_ok=True)
    work = root / "tmp/pdfs/professional-report-qa" / args.engine
    work.mkdir(parents=True, exist_ok=True)
    browser = generator._find_browser_executable()
    if args.engine == "chromium" and not browser:
        raise RuntimeError("Chromium/Edge is unavailable; use --engine weasyprint if installed")
    results = {}
    for name, payload in fixtures().items():
        with patch.object(generator, "_find_browser_executable", return_value=browser if args.engine == "chromium" else None):
            data = generator._render_pdf_report(payload)
        pdf = output / "archon-professional-report-preview.pdf" if name == "preview" and args.engine == "chromium" else work / f"{name}.pdf"
        pdf.write_bytes(data)
        results[name] = inspect_pdf(pdf, payload, work / name)
        print(f"{name}: {results[name]}", flush=True)
    (work / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"Visual review pages: {work}")


if __name__ == "__main__":
    main()
