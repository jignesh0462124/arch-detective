import copy
import os
import re
import uuid

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.testclient import TestClient

from app.api import audit_workbench as audit, report_library as api
from app.auth.dependencies import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.report import generator
from test_audit_workbench import MemoryStore, WORKSPACE, USER


class ReportStore(MemoryStore):
    async def rest(self, method, table, *, params=None, body=None, **kwargs):
        if table == "rpc/report_scan_counts":
            result = {}
            for scan in self.tables.get("scans", []):
                if not self.member or scan["id"] not in body["p_scan_ids"] or scan["workspace_id"] != body["p_workspace_id"] or scan["status"] != "completed":
                    continue
                findings = [f for f in self.tables.get("findings", []) if f["scan_id"] == scan["id"]]
                result[scan["id"]] = {"total": len(findings), "severity": {s: sum(f["severity"] == s for f in findings) for s in ["critical", "high", "medium", "low"]}}
            return result
        if table == "rpc/resolve_report_scan":
            return [{"id": s["id"]} for s in self.tables.get("scans", []) if self.member and s["workspace_id"] == body["p_workspace_id"] and s["status"] == "completed" and "rep_" + s["id"][:16] == body["p_reference"]][:2]
        return await super().rest(method, table, params=params, body=body, **kwargs)

    def matching(self, row, filters):
        filters = dict(filters)
        if "and" in filters:
            predicate = filters.pop("and")
            date = re.search(r"created_at.lt.([^,]+)", predicate)[1]
            identifier = re.search(r"id.lt.([^\)]+)", predicate)[1]
            if (row["created_at"], row["id"]) >= (date, identifier):
                return False
        if "selected_frameworks" in filters:
            scope = filters.pop("selected_frameworks").split("{", 1)[1].rstrip("}")
            if scope not in row.get("selected_frameworks", []):
                return False
        return super().matching(row, filters)


@pytest.fixture
def reports(monkeypatch):
    repository = ReportStore()
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    app.include_router(audit.router, prefix="/api/v1")
    app.dependency_overrides[audit.store] = lambda: repository
    app.dependency_overrides[audit.access_token] = lambda: "fixture-token"
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=uuid.UUID(USER), email=None, session_id=None)
    with TestClient(app) as browser:
        yield browser, repository


def seed(repository, scans=1, findings=12):
    repository.tables["scans"] = [{"id": str(uuid.uuid4()), "workspace_id": WORKSPACE, "status": "completed", "target_name": f"Project {n}", "created_at": "2026-10-18T00:00:00+00:00", "selected_frameworks": ["soc2", "gdpr"], "framework_scores": {"soc2": 0}, "summary": {"summary": "Recorded assessment"}} for n in range(scans)]
    scan = repository.tables["scans"][0]
    repository.tables["findings"] = [{"id": str(uuid.uuid4()), "scan_id": scan["id"], "title": "Same title", "severity": "high", "state": "open", "code_snippet": 'password = "report_fixture_secret"', "remediation": "Use parameters"} for _ in range(findings)]
    return scan["id"]


def test_library_cursor_all_pages_and_exact_totals(reports):
    browser, repository = reports
    seed(repository, 1005, 2)
    repository.tables["scans"].append({**repository.tables["scans"][0], "id": str(uuid.uuid4()), "status": "running"})
    seen, cursor = set(), None
    while True:
        params = {"cursor": cursor} if cursor else {}
        response = browser.get(f"/api/v1/workspaces/{WORKSPACE}/report-library", params=params)
        assert response.status_code == 200, response.text
        page = response.json()
        assert page["total"] == page["available_total"] == 1005
        assert len(page["items"]) <= 25
        assert not seen.intersection(s["id"] for s in page["items"])
        seen.update(s["id"] for s in page["items"])
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert len(seen) == 1005


def test_preview_counts_zero_scores_unknown_frameworks_and_no_findings_payload(reports):
    browser, repository = reports
    identifier = seed(repository)
    response = browser.get(f"/api/v1/workspaces/{WORKSPACE}/report-library/{identifier}")
    assert response.status_code == 200
    data = response.json()
    assert data["counts"]["total"] == 12 and data["framework_scores"]["soc2"] == 0
    assert "findings" not in data and "report_fixture_secret" not in response.text
    scoped = browser.get(f"/api/v1/workspaces/{WORKSPACE}/report-library/{identifier}?frameworks=gdpr").json()
    assert scoped["frameworks"] == ["gdpr"] and scoped["framework_scores"] == {}
    assert browser.get(f"/api/v1/workspaces/{WORKSPACE}/report-library/{identifier}?frameworks=nist_csf").status_code == 422


def test_filters_zero_empty_and_invalid_cursor(reports):
    browser, repository = reports
    identifier = seed(repository, 3, 0)
    base = f"/api/v1/workspaces/{WORKSPACE}/report-library"
    assert browser.get(base, params={"q": "missing"}).json()["total"] == 0
    assert browser.get(base, params={"framework": "nist_csf"}).json()["total"] == 0
    assert browser.get(base, params={"q": "Project 0", "framework": "soc2"}).json()["total"] == 1
    assert browser.get(base, params={"cursor": "not-a-cursor"}).status_code == 422
    assert browser.get(base + "/" + identifier).json()["counts"]["total"] == 0
    repository.tables["scans"] = []
    assert browser.get(base).json()["available_total"] == 0


def test_links_resolve_real_report_and_reject_ambiguous_deleted_running(reports):
    browser, repository = reports
    identifier = seed(repository)
    base = f"/api/v1/workspaces/{WORKSPACE}/report-library/"
    real_report = str(uuid.uuid4())
    repository.tables["reports"] = [{"id": real_report, "scan_id": identifier}]
    assert browser.get(base + real_report).json()["id"] == identifier
    assert browser.get(base + "rep_" + identifier[:16]).json()["id"] == identifier
    repository.tables["scans"].append({**repository.tables["scans"][0], "id": identifier[:16] + str(uuid.uuid4())[16:]})
    assert browser.get(base + "rep_" + identifier[:16]).status_code == 404
    repository.tables["scans"][0]["status"] = "running"
    assert browser.get(base + identifier).status_code == 409
    repository.tables["scans"] = []
    assert browser.get(base + identifier).status_code == 404


@pytest.mark.parametrize("role", ["owner", "admin", "analyst", "viewer"])
def test_read_access_roles_and_revocation(reports, role):
    browser, repository = reports
    identifier = seed(repository)
    repository.current_role = role
    base = f"/api/v1/workspaces/{WORKSPACE}/report-library"
    assert browser.get(base).status_code == 200
    assert browser.get(base + "/" + identifier).status_code == 200
    assert browser.get(f"/api/v1/workspaces/{uuid.uuid4()}/report-library/{identifier}").status_code == 404
    repository.member = False
    assert browser.get(base).status_code == 404
    assert browser.get(base + "/" + identifier).status_code == 404
    assert browser.get(f"/api/v1/scans/{identifier}/workbench/report").status_code == 404


def test_pdf_full_findings_scope_redaction_and_reauthorization(reports, monkeypatch):
    browser, repository = reports
    identifier = seed(repository, findings=1205)
    finding = repository.tables["findings"][0]
    repository.tables["compliance_violations"] = [{"id": str(uuid.uuid4()), "finding_id": finding["id"], "framework": fw, "control_id": fw} for fw in ["soc2", "gdpr"]]
    captured = {}
    def render(scan_id, result, cache=True):
        captured.update(result=result, cache=cache)
        return Response(b"%PDF-fixture", media_type="application/pdf")
    monkeypatch.setattr(audit, "_generate_pdf_stream", render)
    response = browser.get(f"/api/v1/scans/{identifier}/workbench/report?workspace_id={WORKSPACE}&frameworks=soc2")
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    assert captured["cache"] is False and len(captured["result"]["findings"]) == 1205
    assert "report_fixture_secret" not in str(captured)
    assert captured["result"]["framework_scores"] == {"soc2": 0}
    assert all(v["framework"] == "soc2" for f in captured["result"]["findings"] for v in f["violations"])
    def revoke(*args, **kwargs):
        repository.member = False
        return Response(b"%PDF-private", media_type="application/pdf")
    monkeypatch.setattr(audit, "_generate_pdf_stream", revoke)
    assert browser.get(f"/api/v1/scans/{identifier}/workbench/report").status_code == 404


def test_cache_fingerprint_content_scope_state_and_bounds(monkeypatch):
    generator._PDF_CACHE.clear()
    payload = {"scan": {"id": "scan", "workspace_id": WORKSPACE, "selected_frameworks": ["soc2"]}, "findings": [{"title": "Before", "state": "open"}], "generated_at": "now"}
    first = generator._compute_scan_data_hash(payload)
    for changes in [{"findings": [{"title": "After", "state": "open"}]}, {"findings": [{"title": "Before", "state": "resolved"}]}, {"scan": {"id": "scan", "workspace_id": "other"}}, {"scan": {"id": "scan", "selected_frameworks": []}}]:
        assert generator._compute_scan_data_hash({**payload, **changes}) != first
    assert generator._compute_scan_data_hash({**payload, "generated_at": "later"}) == first
    calls = []
    monkeypatch.setattr(generator, "_render_pdf_report", lambda value: calls.append(value) or b"%PDF-fixture")
    assert generator.generate_pdf_report(payload) == generator.generate_pdf_report(payload)
    assert len(calls) == 1
    for n in range(12):
        generator.generate_pdf_report({**payload, "report_id": str(n)})
    assert len(generator._PDF_CACHE) == 8
    monkeypatch.setattr(generator, "_CACHE_TTL", 0)
    generator.generate_pdf_report(payload)
    assert len(generator._PDF_CACHE) == 1
    generator._PDF_CACHE.clear()


def test_report_template_no_fabricated_attestation_and_complete_evidence():
    html = generator._get_jinja_env().get_template("base.html").render(scan={"id": "fixture", "target_name": "<script>alert(1)</script>", "scan_type": "static", "selected_frameworks": []}, findings=[], framework_scores={}, framework_breakdown=[], top_violated_controls=[], severity_counts={s: 0 for s in ["critical", "high", "medium", "low"]}, summary={}, analysis={}, coverage={}, exclusions=[])
    assert "sig_tl_" not in html and "SHA256 FINGERPRINT" not in html and ">Signed" not in html
    assert "<script>alert(1)</script>" not in html and "human review" in html.lower()


def test_report_routes_require_auth():
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    with TestClient(app) as browser:
        assert browser.get(f"/api/v1/workspaces/{WORKSPACE}/report-library").status_code == 401


def test_pdf_cache_byte_limit_and_busy_admission(monkeypatch):
    generator._PDF_CACHE.clear()
    monkeypatch.setattr(generator, "_CACHE_BYTES", 20)
    monkeypatch.setattr(generator, "_render_pdf_report", lambda value: b"%PDF-12345")
    for n in range(4):
        generator.generate_pdf_report({"report_id": str(n)})
    assert len(generator._PDF_CACHE) == 2
    assert sum(len(v[1]) for v in generator._PDF_CACHE.values()) <= 20
    import threading
    monkeypatch.setattr(generator, "_ADMISSION", threading.BoundedSemaphore(0))
    with pytest.raises(generator.PdfBusy):
        generator.generate_pdf_report({"report_id": "no-slot"})
    generator._PDF_CACHE.clear()


@pytest.mark.skipif(os.environ.get("ARCHON_TEST_RENDER_PDF") != "1", reason="Opt-in installed-browser PDF smoke test")
def test_authenticated_real_pdf_download_for_reports_and_workbench(reports):
    """Exercise real rendering through the shared authorized download endpoint.

    The isolated repository fixture is not a hosted Supabase verification.
    """
    pymupdf = pytest.importorskip("pymupdf")
    browser, repository = reports
    identifier = seed(repository, findings=12)
    generator._PDF_CACHE.clear()
    for scope in ["", f"?workspace_id={WORKSPACE}&frameworks=soc2"]:
        response = browser.get(f"/api/v1/scans/{identifier}/workbench/report{scope}")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.headers["cache-control"] == "no-store"
        assert "attachment" in response.headers["content-disposition"]
        assert response.content.startswith(b"%PDF-")
        with pymupdf.open(stream=response.content, filetype="pdf") as document:
            text = "\n".join(page.get_text() for page in document)
        assert "Security Audit Report" in text and "12 recorded findings" in text
        assert "report_fixture_secret" not in text
        assert "F-012" in text
    repository.member = False
    assert browser.get(f"/api/v1/scans/{identifier}/workbench/report").status_code == 404
    generator._PDF_CACHE.clear()
