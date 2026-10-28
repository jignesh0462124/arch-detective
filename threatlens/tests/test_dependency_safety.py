from pathlib import Path
from types import SimpleNamespace

import pytest

from app.scanners import dependency_audit as audit
from app.scanners.base import ScannerCoverageError


@pytest.mark.parametrize("content", [
    "-r elsewhere.txt", "-e .", "package @ https://example.test/pkg.tar.gz",
    "https://example.test/pkg.whl", "package>=1.0", "package==1.*",
    "--index-url https://example.test", "pkg[extra]==1.0", "pkg==1.0; python_version>'3'",
    "./local-package", "--find-links .", "pkg==1.0\\\n --hash=sha256:abc",
])
def test_uploaded_resolver_syntax_never_reaches_subprocess(tmp_path, monkeypatch, content):
    (tmp_path / "requirements.txt").write_text(content)
    def forbidden(*args, **kwargs):
        pytest.fail("Untrusted syntax reached a scanner subprocess")
    monkeypatch.setattr(audit, "run_scanner_command", forbidden)
    with pytest.raises(ScannerCoverageError, match="coverage incomplete"):
        audit.run_pip_audit(str(tmp_path))


def test_only_sanitized_exact_pins_with_resolution_disabled(tmp_path, monkeypatch):
    (tmp_path / "requirements.txt").write_text("# comment\nFlask == 1.0.0 # pinned\nfoo-bar==2.0rc1\n")
    calls = []
    def run(command, **kwargs):
        calls.append(command)
        source = Path(command[command.index("-r") + 1])
        assert tmp_path not in source.parents
        assert source.read_text() == "Flask==1.0.0\nfoo-bar==2.0rc1\n"
        assert "--disable-pip" in command and "--no-deps" in command
        assert kwargs["cwd"] == source.parent
        return SimpleNamespace(stdout='{"dependencies": []}')
    monkeypatch.setattr(audit, "run_scanner_command", run)
    assert audit.run_pip_audit(str(tmp_path)) == []
    assert len(calls) == 1


def test_provider_skips_are_not_clean_results(tmp_path):
    with pytest.raises(ScannerCoverageError):
        audit.parse_pip_audit_output('[{"name":"private-package","skip_reason":"not found"}]', tmp_path, tmp_path / "requirements.txt")


def test_manifest_limit_does_not_silently_skip_files(tmp_path):
    for index in range(21):
        folder = tmp_path / str(index)
        folder.mkdir()
        (folder / "requirements.txt").write_text("pkg==1.0")
    with pytest.raises(ScannerCoverageError):
        audit.run_pip_audit(str(tmp_path))


def test_worker_coverage_failure_is_persisted_without_retry(monkeypatch):
    from app.tasks import scan_task
    from uuid import UUID

    scan_id = "00000000-0000-4000-8000-000000000001"
    failures = []

    def incomplete(*args, **kwargs):
        raise ScannerCoverageError("Dependency coverage incomplete: unsupported input.")

    def forbidden_retry(*args, **kwargs):
        pytest.fail("Non-transient coverage failure was retried")

    monkeypatch.setattr(scan_task, "_update_progress", incomplete)
    monkeypatch.setattr(scan_task, "_set_failed", lambda *a, **kw: failures.append((a, kw)))
    monkeypatch.setattr(scan_task.run_full_scan, "retry", forbidden_retry)
    result = scan_task.run_full_scan.run(scan_id)
    assert result == {"scan_id": scan_id, "status": "failed", "error_code": "incomplete_coverage"}
    assert failures == [((UUID(scan_id),), {
        "error_code": "incomplete_coverage",
        "error_message": "Dependency coverage incomplete: unsupported input.",
    })]
