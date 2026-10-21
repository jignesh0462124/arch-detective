from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.models.finding import FindingSource
from app.scanners.bandit_runner import run_bandit
from app.scanners.dependency_audit import run_pip_audit
from app.scanners.llm_code_reviewer import llm_review_file
from app.scanners.semgrep_runner import run_semgrep
from app.scanners.trufflehog_runner import run_trufflehog

FIXTURE = Path(__file__).parent / "fixtures" / "vulnerable-app"


@pytest.mark.skipif(
    os.getenv("THREATLENS_RUN_SCANNER_SMOKE") != "1",
    reason="Scanner CLI smoke tests are opt-in",
)
def test_real_static_scanners_detect_vulnerable_fixture() -> None:
    findings = [
        *run_semgrep(str(FIXTURE)),
        *run_bandit(str(FIXTURE)),
        *run_trufflehog(str(FIXTURE)),
        *run_pip_audit(str(FIXTURE)),
    ]
    sources = {finding.source for finding in findings}

    assert FindingSource.SEMGREP in sources
    assert FindingSource.BANDIT in sources
    assert FindingSource.TRUFFLEHOG in sources
    assert FindingSource.PIP_AUDIT in sources


@pytest.mark.skipif(
    os.getenv("THREATLENS_RUN_GROQ_SMOKE") != "1",
    reason="Real Groq smoke test is opt-in",
)
def test_real_groq_review_returns_normalized_findings() -> None:
    source = (FIXTURE / "db.py").read_text(encoding="utf-8")
    findings = llm_review_file("db.py", source)

    assert findings
    assert all(finding.source is FindingSource.LLM_REVIEW for finding in findings)
