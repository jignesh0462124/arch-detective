"""
PDF report generator.

- generate_compliance_chart()   → base64 PNG via matplotlib
- generate_pdf_report()         → bytes via WeasyPrint + Jinja2
"""
from __future__ import annotations

import base64
import hashlib
import io
import logging
import os
import json
import threading
import time
from collections import Counter, OrderedDict
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── Jinja2 environment ────────────────────────────────────────────────────────

_TEMPLATES_DIR = Path(__file__).parent / "templates"


@lru_cache(maxsize=1)
def _get_jinja_env():
    """Lazy-load and cache Jinja2 environment."""
    from jinja2 import Environment, FileSystemLoader, select_autoescape

    return Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )


# ── Compliance chart ──────────────────────────────────────────────────────────

_FRAMEWORK_LABELS = {
    "gdpr":      "GDPR",
    "soc2":      "SOC 2",
    "iso27001":  "ISO 27001",
    "pci_dss":   "PCI DSS v4",
    "nist_csf":  "NIST CSF 2.0",
}


def generate_compliance_chart(framework_scores: dict[str, int]) -> str:
    """
    Generate a horizontal bar chart of framework compliance scores.

    Returns a base64-encoded PNG string.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")  # non-interactive backend
        import matplotlib.pyplot as plt

        labels = [_FRAMEWORK_LABELS.get(fw, fw.upper()) for fw in framework_scores]
        scores = list(framework_scores.values())

        colors = []
        for s in scores:
            if s >= 80:
                colors.append("#0b8f3c")  # Archon success green
            elif s >= 65:
                colors.append("#fe4c02")  # Archon high orange
            else:
                colors.append("#c41c1c")  # Archon critical red

        fig, ax = plt.subplots(figsize=(7, max(2.4, len(labels) * 0.55)))
        bars = ax.barh(labels, scores, color=colors, height=0.45, edgecolor="none")

        # Score labels on bars
        for bar, score in zip(bars, scores):
            ax.text(
                min(score + 1.2, 98),
                bar.get_y() + bar.get_height() / 2,
                f"{score}%",
                va="center",
                ha="left",
                fontsize=9.5,
                fontweight="bold",
                color="#111111",
            )

        ax.set_xlim(0, 110)
        ax.set_xlabel("Compliance Readiness (%)", fontsize=9, color="#626260", fontweight="600")
        ax.set_title("Framework Compliance Readiness", fontsize=11, fontweight="bold", color="#111111", pad=10)
        ax.tick_params(axis="y", labelsize=9.5, colors="#111111")
        ax.tick_params(axis="x", labelsize=8.5, colors="#8a8a86")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.spines["left"].set_color("#d3cec6")
        ax.spines["bottom"].set_color("#d3cec6")
        ax.set_facecolor("#f5f1ec")
        fig.patch.set_facecolor("#ffffff")

        # Threshold lines
        for x, label, color in [(65, "65% Min", "#fe4c02"), (80, "80% Compliant", "#0b8f3c")]:
            ax.axvline(x=x, color=color, linestyle="--", linewidth=0.9, alpha=0.8)
            ax.text(x + 0.5, -0.6, label, fontsize=7, color=color, fontweight="bold")

        plt.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=180, bbox_inches="tight")
        plt.close(fig)
        return base64.b64encode(buf.read()).decode("utf-8")
    except Exception:
        logger.exception("Failed to generate compliance chart")
        return ""


# ── PDF generator ─────────────────────────────────────────────────────────────

def _build_framework_breakdown(
    findings: list[dict[str, Any]],
    framework_scores: dict[str, int],
    frameworks: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Build per-framework breakdown for the compliance section."""
    # Count violations per framework and find top controls
    fw_violations: dict[str, list[dict]] = {}
    for finding in findings:
        for v in finding.get("violations", []):
            fw = v.get("framework", "")
            if fw not in fw_violations:
                fw_violations[fw] = []
            fw_violations[fw].append(v)

    breakdown = []
    for fw_id in frameworks if frameworks is not None else framework_scores:
        score = framework_scores.get(fw_id)
        if not isinstance(score, (int, float)) or isinstance(score, bool) or not 0 <= score <= 100:
            score = None
        violations = fw_violations.get(fw_id, fw_violations.get(fw_id.upper(), []))
        top_control = ""
        if violations:
            # Most common control_id
            control_counter = Counter(v.get("control_id", "") for v in violations)
            top_control = control_counter.most_common(1)[0][0] if control_counter else ""
        breakdown.append({
            "name": _FRAMEWORK_LABELS.get(fw_id, fw_id.upper()),
            "id": fw_id,
            "score": score,
            "violation_count": len(violations),
            "top_control": top_control,
        })
    return breakdown


def _build_top_violated_controls(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Aggregate most violated controls across all findings."""
    control_counts: dict[str, dict] = {}
    for finding in findings:
        for v in finding.get("violations", []):
            key = f"{v.get('framework','')}/{v.get('control_id','')}"
            if key not in control_counts:
                control_counts[key] = {
                    "framework": v.get("framework", ""),
                    "control_id": v.get("control_id", ""),
                    "control_title": v.get("control_title", ""),
                    "count": 0,
                }
            control_counts[key]["count"] += 1

    return sorted(control_counts.values(), key=lambda x: x["count"], reverse=True)[:15]


def _severity_counts(findings: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in findings:
        sev = str(f.get("severity", "")).lower()
        if sev in counts:
            counts[sev] += 1
    return counts


@lru_cache(maxsize=1)
def _find_browser_executable() -> str | None:
    """Locate an available Chromium-based browser for high-fidelity PDF printing."""
    import shutil

    candidates = [
        os.environ.get("CHROME_BIN"),
        os.environ.get("EDGE_BIN"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        "google-chrome",
        "chromium-browser",
        "chromium",
        "msedge",
    ]
    for c in candidates:
        if c:
            if os.path.isabs(c) and os.path.exists(c):
                return c
            found = shutil.which(c)
            if found:
                return found
    return None


def _render_via_browser(browser_path: str, html_content: str) -> bytes:
    """Render HTML to PDF using an optimized headless Chromium/Edge browser with isolated profile."""
    import subprocess
    import tempfile

    with tempfile.TemporaryDirectory() as tmpdir:
        html_file = Path(tmpdir) / "report.html"
        pdf_file = Path(tmpdir) / "report.pdf"
        profile_dir = Path(tmpdir) / "browser_profile"
        profile_dir.mkdir(parents=True, exist_ok=True)
        html_file.write_text(html_content, encoding="utf-8")

        base_flags = [
            f"--user-data-dir={profile_dir.resolve()}",
            "--disable-gpu",
            "--no-pdf-header-footer",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--disable-default-apps",
            "--disable-sync",
            "--disable-background-networking",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-breakpad",
            "--disable-component-update",
            "--disable-domain-reliability",
            "--disable-features=Translate,OptimizationHints,MediaRouter,CalculateNativeWinOcclusion",
            "--disable-prompt-on-repost",
            "--disable-renderer-backgrounding",
            "--metrics-recording-only",
            "--mute-audio",
            "--disable-dev-shm-usage",
            "--hide-scrollbars",
            f"--print-to-pdf={pdf_file.resolve()}",
            html_file.resolve().as_uri(),
        ]

        # 1. Primary: modern Blink headless pipeline (--headless=new)
        cmd_new = [browser_path, "--headless=new"] + base_flags
        try:
            res = subprocess.run(cmd_new, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=25)
            if pdf_file.exists() and pdf_file.stat().st_size > 0:
                return pdf_file.read_bytes()
        except subprocess.TimeoutExpired:
            logger.warning("Browser headless=new timed out after 25s, falling back to legacy headless")
        except Exception as e:
            logger.debug("Browser headless=new error: %s", e)

        # 2. Fallback: legacy headless flag (--headless)
        cmd_legacy = [browser_path, "--headless"] + base_flags
        res = subprocess.run(cmd_legacy, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=25)
        if pdf_file.exists() and pdf_file.stat().st_size > 0:
            return pdf_file.read_bytes()

        raise RuntimeError(f"Browser PDF generation failed (code {res.returncode})")


def _deny_report_resource(_url: str, **_kwargs):
    # The report template is self-contained: inline styles, text and system fonts.
    # WeasyPrint does not enforce browser CSP, so block all external/file fetches here.
    raise ValueError("External report resources are disabled")


_PDF_CACHE: OrderedDict[str, tuple[float, bytes]] = OrderedDict()
_CACHE_LOCK = threading.Lock()
_RENDER_SLOTS = threading.BoundedSemaphore(2)
_ADMISSION = threading.BoundedSemaphore(6)
_CACHE_BYTES = 50 * 1024 * 1024
_CACHE_TTL = 600
_TEMPLATE_VERSION = "reports-v3.1-resource-restricted"


class PdfBusy(RuntimeError):
    pass


def _compute_scan_data_hash(scan_data: dict[str, Any]) -> str:
    """Generate a consistent cache key for scan payload."""
    # generated_at is render time, not evidence revision. All other content,
    # tenant scope, mappings and triage state participate in invalidation.
    content = {k: v for k, v in scan_data.items() if k != "generated_at"}
    seed = json.dumps([_TEMPLATE_VERSION, content], sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def generate_pdf_report(scan_data: dict[str, Any]) -> bytes:
    key = _compute_scan_data_hash(scan_data)
    with _CACHE_LOCK:
        for old, (at, _) in list(_PDF_CACHE.items()):
            if time.monotonic() - at >= _CACHE_TTL:
                del _PDF_CACHE[old]
        if key in _PDF_CACHE:
            _PDF_CACHE.move_to_end(key)
            return _PDF_CACHE[key][1]
    if not _ADMISSION.acquire(blocking=False):
        raise PdfBusy("PDF queue is full")
    acquired = False
    try:
        acquired = _RENDER_SLOTS.acquire(timeout=5)
        if not acquired:
            raise PdfBusy("PDF renderers are busy")
        # Another thread may have rendered the same content while we waited.
        with _CACHE_LOCK:
            if key in _PDF_CACHE and time.monotonic() - _PDF_CACHE[key][0] < _CACHE_TTL:
                _PDF_CACHE.move_to_end(key)
                return _PDF_CACHE[key][1]
        result = _render_pdf_report(scan_data)
        with _CACHE_LOCK:
            if len(result) <= _CACHE_BYTES:
                _PDF_CACHE[key] = (time.monotonic(), result)
                while len(_PDF_CACHE) > 8 or sum(len(v[1]) for v in _PDF_CACHE.values()) > _CACHE_BYTES:
                    _PDF_CACHE.popitem(last=False)
        return result
    finally:
        if acquired:
            _RENDER_SLOTS.release()
        _ADMISSION.release()


def _render_pdf_report(scan_data: dict[str, Any]) -> bytes:
    """
    Generate a PDF audit report from scan_data with caching and high-speed execution.

    scan_data keys:
        scan: dict (id, target_name, scan_type, selected_frameworks, status)
        findings: list[dict] (with nested violations, remediation_steps)
        framework_scores: dict[str, int]
        summary: dict (summary, risk_headline, overall_posture, top_priorities)
        report_id: str
        generated_at: str

    Returns PDF bytes.
    """
    # Presentation metadata only; never alter or infer the saved evidence.
    findings = []
    for original in scan_data.get("findings", []):
        finding = dict(original)
        snippet = finding.get("code_snippet") or ""
        finding["excerpt_lines"] = str(snippet).splitlines()
        reported_line = finding.get("line_number")
        finding["excerpt_start_line"] = reported_line if (
            finding.get("source") == "ai_source_verified"
            and isinstance(reported_line, int) and not isinstance(reported_line, bool) and reported_line > 0
        ) else None
        finding["evidence_language"] = {
            ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript", ".tsx": "TSX",
            ".jsx": "JSX", ".php": "PHP", ".java": "Java", ".go": "Go", ".sql": "SQL",
            ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".rs": "Rust",
        }.get(Path(str(finding.get("file_path") or "")).suffix.lower(), "Source")
        # Saved findings do not establish a separate excerpt start line.
        # Keep excerpt numbering distinct from the reported source location.
        finding["remedy_steps"] = finding.get("remediation_steps") or [
            line.strip() for line in str(finding.get("remediation") or "").splitlines() if line.strip()
        ]
        findings.append(finding)
    framework_scores = scan_data.get("framework_scores", {})

    template_ctx = {
        "scan": scan_data.get("scan", {}),
        "findings": findings,
        "framework_scores": framework_scores,
        "summary": scan_data.get("summary", {}),
        "analysis": scan_data.get("analysis", {}),
        "coverage": scan_data.get("coverage", {}),
        "exclusions": scan_data.get("exclusions", []),
        "report_id": scan_data.get("report_id", ""),
        "generated_at": scan_data.get("generated_at", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")),
        "severity_counts": _severity_counts(findings),
        "framework_breakdown": _build_framework_breakdown(findings, framework_scores, scan_data.get("scan", {}).get("selected_frameworks")),
        "top_violated_controls": _build_top_violated_controls(findings),
    }

    env = _get_jinja_env()
    template = env.get_template("base.html")
    html_content = template.render(**template_ctx)

    pdf_bytes: bytes | None = None

    # Engine 1: Headless Chromium / Edge (fastest, modern visual fidelity)
    browser = _find_browser_executable()
    if browser:
        try:
            pdf_bytes = _render_via_browser(browser, html_content)
        except Exception as browser_err:
            logger.warning("Browser PDF render failed (%s); trying WeasyPrint", browser_err)

    # Engine 2: WeasyPrint (standard on Linux/Docker servers)
    if not pdf_bytes:
        try:
            from weasyprint import HTML

            pdf_bytes = HTML(string=html_content, url_fetcher=_deny_report_resource).write_pdf(
                optimize_images=True,
                presentational_hints=True,
            )
        except Exception as weasy_err:
            logger.warning("WeasyPrint render failed (%s)", weasy_err)

    if not pdf_bytes:
        raise RuntimeError(
            "PDF generation failed: no Chromium browser found and WeasyPrint failed. "
            "Please ensure Microsoft Edge, Google Chrome, or WeasyPrint is available."
        )

    return pdf_bytes
