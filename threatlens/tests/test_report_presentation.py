from app.report import generator
import copy
import re
from pathlib import Path
import xml.etree.ElementTree as ET

import pytest


def test_pdf_code_is_escaped_numbered_and_remedies_complete(monkeypatch):
    captured = {}
    monkeypatch.setattr(generator, "_find_browser_executable", lambda: "fixture")

    def render(browser, html):
        captured["html"] = html
        return b"%PDF-fixture"

    monkeypatch.setattr(generator, "_render_via_browser", render)
    finding = {
        "id": "same-title-first", "title": "Unsafe output", "severity": "high",
        "file_path": "src/view.ts", "line_number": 90,
        "description": "Review the output boundary.",
        "code_snippet": '<script>alert("fixture")</script>\n  return value;',
        "remediation": "Escape output.\nTest unsafe input.",
    }
    generator._render_pdf_report({"scan": {"id": "fixture", "target_name": "Fixture", "selected_frameworks": []}, "findings": [finding]})
    html = captured["html"]
    assert "&lt;script&gt;" in html and '<script>alert("fixture")</script>' not in html
    assert 'class="code-gutter">1<' in html and 'class="code-gutter">2<' in html
    assert "Reported source line: 90" in html
    assert "Source position is not inferred" in html
    assert "Escape output." in html and "Test unsafe input." in html
    assert "Suggested verification checks" in html
    assert "Archon Security Audit Report" in html
    assert "excerpt_lines" not in finding
    finding["source"] = "ai_source_verified"
    generator._render_pdf_report({"scan": {"id": "fixture", "target_name": "Fixture", "selected_frameworks": []}, "findings": [finding]})
    assert 'class="code-gutter">90<' in captured["html"]
    assert 'class="finding-code-line"' in captured["html"]


def test_pdf_missing_evidence_and_remediation_are_explicit(monkeypatch):
    monkeypatch.setattr(generator, "_find_browser_executable", lambda: "fixture")
    captured = []
    monkeypatch.setattr(generator, "_render_via_browser", lambda _, html: captured.append(html) or b"%PDF")
    generator._render_pdf_report({"scan": {"id": "fixture", "target_name": "Empty evidence", "selected_frameworks": []}, "findings": [{"title": "Review", "severity": "low"}]})
    assert "No source evidence was recorded" in captured[0]
    assert "No remediation guidance was recorded" in captured[0]


@pytest.fixture
def rendered_html(monkeypatch):
    captured = []
    monkeypatch.setattr(generator, "_find_browser_executable", lambda: "fixture")
    monkeypatch.setattr(generator, "_render_via_browser", lambda _, html: captured.append(html) or b"%PDF")

    def render(findings=None, **extras):
        payload = {"scan": {"id": "scope", "target_name": "Example", "selected_frameworks": ["soc2", "gdpr"]}, "findings": findings or [], **extras}
        before = copy.deepcopy(payload)
        generator._render_pdf_report(payload)
        assert payload == before
        return captured[-1]

    return render


def test_report_brand_matches_canonical_mark_and_cover_has_no_decorative_icons(rendered_html):
    html = rendered_html()
    canonical = ET.fromstring((Path(__file__).resolve().parents[2] / "public/brand/archon-mark.svg").read_text())
    svg = ET.fromstring(re.search(r"<svg\b.*?</svg>", html, re.S)[0])
    assert svg.find("{http://www.w3.org/2000/svg}path").attrib == canonical.find("{http://www.w3.org/2000/svg}path").attrib
    assert svg.find("{http://www.w3.org/2000/svg}rect").attrib == canonical.find("{http://www.w3.org/2000/svg}rect").attrib
    assert html.count("<svg") == 1
    assert "Security Audit Report</h1>" in html
    assert "not a compliance certificate" in html


def test_zero_and_missing_scores_and_valid_cvss_zero(rendered_html):
    html = rendered_html([{"severity": "low", "cvss_score": 0}], framework_scores={"soc2": 0})
    assert "CVSS: 0.0" in html and ">0%</td>" in html
    assert ">Not available</td>" in html
    for invalid in [True, False, -1, 11, float("nan"), "9.8"]:
        assert "CVSS: Not recorded" in rendered_html([{"severity": "low", "cvss_score": invalid}])


def test_all_findings_render_once_even_duplicate_titles_and_unknown_severities(rendered_html):
    findings = [{"id": str(n), "title": "Same title", "description": f"Unique issue {n}", "severity": sev} for n, sev in enumerate(["low", "High", "critical", "info", None, "medium"])]
    html = rendered_html(findings)
    assert html.count('<article class="finding') == 6
    assert [html.count(f'id="F-{n:03}"') for n in range(1, 7)] == [1] * 6
    assert html.index("Unique issue 2") < html.index("Unique issue 1") < html.index("Unique issue 5") < html.index("Unique issue 0")
    for n in range(6):
        assert html.count(f"Unique issue {n}") == 1
    assert "2 with another or unrecorded severity" in html


@pytest.mark.parametrize("fence", ["```", "~~~~"])
def test_fenced_remediation_preserves_literals_indentation_and_multiple_blocks(rendered_html, fence):
    code = '  const url = "https://example.test/#section";\n  output.textContent = "<script>";'
    remedy = f"Use text output.\n{fence}javascript\n{code}\n{fence}\nVerify the icon.\n```php\n  echo $safe;\n```"
    finding = {"severity": "high", "remediation": remedy}
    blocks = generator._remediation_blocks(finding)
    assert [block["kind"] for block in blocks] == ["text", "code", "text", "code"]
    assert blocks[1]["lines"] == code.splitlines()
    assert all(b["complete"] for b in blocks if b["kind"] == "code")
    html = rendered_html([finding])
    assert "#section" in html and "  echo $safe;" in html and "&lt;script&gt;" in html
    assert "<script>" not in html
    assert html.count("Saved remediation suggestion") == 2
    assert "suggestion lines" in html


def test_unclosed_fences_and_markdown_steps_are_not_silently_repaired(rendered_html):
    finding = {"severity": "medium", "remediation_steps": ["Review input.", "````js\n  fn();\n```\n  still_code();"]}
    blocks = generator._remediation_blocks(finding)
    assert blocks[-1]["complete"] is False
    assert blocks[-1]["lines"] == ["  fn();", "```", "  still_code();"]
    assert "Incomplete saved suggestion" in rendered_html([finding])
    assert "No remediation guidance was recorded" in rendered_html([{"remediation": "  "}])


def test_code_table_continuation_contains_reference_title_path_and_distinct_numbering(rendered_html):
    html = rendered_html([{"severity": "high", "title": "Finding title", "file_path": "src/test.ts", "line_number": 27, "code_snippet": "first();\nsecond();", "remediation": "```ts\nsafe();\n```"}])
    headers = re.findall(r"<thead><tr><th colspan=\"2\">(.*?)</th></tr></thead>", html, re.S)
    assert len(headers) == 2
    assert all("F-001 / Finding title" in header and "src/test.ts" in header for header in headers)
    assert "Source position is not inferred" in headers[0]
    assert 'class="code-gutter">27<' not in html
    assert "Suggested replacement - review and test" in headers[1]


def test_report_dates_nested_coverage_and_zero_findings(rendered_html):
    html = rendered_html(scan={"id": "date", "completed_at": "2026-11-05T14:00:00+05:30", "selected_frameworks": []}, generated_at="2026-11-05T10:00:00Z", coverage={"analyzed_files": 0, "tool": {"completed": False, "limitations": ["No supported files"]}})
    assert "05 Nov 2026, 08:30 UTC" in html and "05 Nov 2026, 10:00 UTC" in html
    assert "No findings were recorded" in html and "No supported files" in html
    assert "{'completed'" not in html


def test_template_revision_invalidates_cached_layout(monkeypatch):
    before = generator._compute_scan_data_hash({"scan": {"id": "fixture"}})
    monkeypatch.setattr(generator, "_TEMPLATE_VERSION", "future-layout")
    assert before != generator._compute_scan_data_hash({"scan": {"id": "fixture"}})


def test_report_strings_cannot_escape_css_or_execute_markup(rendered_html):
    html = rendered_html([
        {"title": '<img src="https://example.test/track">', "severity": "high", "description": "Quotes \" ' & symbols < > / café", "remediation": '```<script>\n  <svg onload="alert(1)">\n```'}
    ], report_id="'); } </style><script>alert(1)</script>")
    assert html.count("</style>") == 1
    assert "<script>" not in html and '<img src="https://' not in html
    assert "&lt;svg onload=" in html and "café" in html
    assert "font: 9pt/1.4 var(--mono)" in html


def test_long_names_and_headers_are_bounded_without_losing_saved_content(rendered_html):
    title = "Extremely long recorded finding title " * 12
    project = "Project-with-long-name-" * 12
    path = "nested/" * 80 + "source.ts"
    html = rendered_html([{"title": title, "file_path": path, "code_snippet": "const value = 0;", "severity": "high"}], scan={"id": "long", "target_name": project, "selected_frameworks": []})
    assert '<div class="project-name long">' in html and project in html
    assert title in html and path in html
    header = re.search(r'<thead><tr><th colspan="2">(.*?)</th></tr></thead>', html, re.S)[1]
    assert title not in header and title[:97] + "..." in header


def test_extension_report_has_every_policy_result_with_escaped_evidence(rendered_html):
    from app.scanners.extension_review import assess, Declarations
    results, coverage = assess([{"path": "popup.html", "content": '<script src="https://example.invalid/code.js"></script>'}],
        {"manifest_version": 3, "name": "Fixture", "version": "1", "action": {"default_popup": "popup.html"}}, ["chrome", "edge"], Declarations())
    report = {"package_name": "Fixture", "package_version": "1", "manifest_version": 3, "stores": ["chrome", "edge"],
        "policy_version": "fixture", "coverage": coverage, "results": results, "declarations": {"purpose": "Read documents", "chrome": {"description": "<script>must remain text</script>"}}}
    html = rendered_html(extension_review=report)
    assert "Browser extension policy review" in html and "Read documents" in html
    assert "&lt;script&gt;must remain text&lt;/script&gt;" in html
    assert "https://example.invalid/code.js" in html and '<script src="https://' not in html
    for number in range(1, len(results) + 1):
        assert f"P-{number:03d}" in html
    assert "Suggested verification" in html and "Code Readability Requirements" in html
