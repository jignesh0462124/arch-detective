from pathlib import Path
from types import SimpleNamespace

import pytest

from app.report import generator


@pytest.mark.parametrize("url", ["https://example.test/image", "http://127.0.0.1:8000/", "http://169.254.169.254/", "file:///etc/passwd", "data:image/svg+xml,<svg/>"])
def test_weasyprint_cannot_fetch_resources(url):
    with pytest.raises(ValueError, match="resources are disabled"):
        generator._deny_report_resource(url)


def test_browser_keeps_sandbox_and_never_buffers_error_payloads(monkeypatch):
    import subprocess
    def run(command, **kwargs):
        assert "--no-sandbox" not in command
        assert "--disable-web-security" not in command
        assert kwargs["stdout"] is subprocess.DEVNULL
        assert kwargs["stderr"] is subprocess.DEVNULL
        output = next(arg.split("=", 1)[1] for arg in command if arg.startswith("--print-to-pdf="))
        Path(output).write_bytes(b"%PDF-test")
        return SimpleNamespace(returncode=0)
    monkeypatch.setattr(subprocess, "run", run)
    assert generator._render_via_browser("fixture-browser", "<html></html>") == b"%PDF-test"


def test_report_template_blocks_network_and_escapes_source(monkeypatch):
    captured = []
    monkeypatch.setattr(generator, "_find_browser_executable", lambda: "fixture-browser")
    monkeypatch.setattr(generator, "_render_via_browser", lambda _, html: captured.append(html) or b"%PDF-test")
    generator._render_pdf_report({"scan": {"id": "fixture-pdf", "selected_frameworks": [], "target_name": "<img src='http://127.0.0.1/secret'>"},
                                  "findings": [{"title": "unsafe", "severity": "high", "code_snippet": "<script>alert(1)</script>"}]})
    html = captured[0]
    assert "Content-Security-Policy" in html and "default-src 'none'" in html
    assert "<script>" not in html and "<img src=" not in html
    assert "&lt;script&gt;" in html
