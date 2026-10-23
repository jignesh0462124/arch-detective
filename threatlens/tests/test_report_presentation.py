from app.report import generator


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
