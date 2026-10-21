"""Findings queue uses the hosted persistence adapter, not the legacy SQLAlchemy DB."""
import csv
import io
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import audit_workbench as api
from test_audit_workbench import client, WORKSPACE  # noqa: F401 -- shared isolated fixture


def seed(repository, count=1205):
    scan_id = str(uuid.uuid4())
    repository.tables["scans"] = [{"id": scan_id, "workspace_id": WORKSPACE, "status": "completed", "target_name": "Fixture", "created_at": "2026-10-18"}]
    repository.tables["findings"] = [{
        "id": str(uuid.uuid4()), "scan_id": scan_id,
        "title": "Same finding", "file_path": "src/app.py", "line_number": 5,
        "severity": "high" if n % 2 == 0 else "low", "state": "open" if n % 3 == 0 else "resolved",
        "description": "SQL evidence", "code_snippet": 'password = "queue_fixture_secret"',
        "source": "static-rule", "remediation": "Use parameters", "created_at": "2026-10-18",
        "object_path": "must-not-leak",
    } for n in range(count)]
    return scan_id


def test_pages_preserve_distinct_ids_and_global_counts(client):
    browser, repository = client
    scan_id = seed(repository)
    base = f"/api/v1/scans/{scan_id}/workbench/findings"
    all_ids = set()
    for offset in range(0, 1205, 50):
        response = browser.get(base, params={"workspace_id": WORKSPACE, "offset": offset})
        assert response.status_code == 200
        page = response.json()
        assert page["total"] == 1205
        assert len(page["items"]) == min(50, 1205 - offset)
        assert all("code_snippet" not in f and "object_path" not in f for f in page["items"])
        all_ids.update(f["id"] for f in page["items"])
    assert len(all_ids) == 1205
    counts = browser.get(base + "/counts", params={"workspace_id": WORKSPACE}).json()
    assert counts == {"total": 1205, "severity": {"critical": 0, "high": 603, "medium": 0, "low": 602}}
    filtered = browser.get(base, params={"severity": "high", "state": "open", "q": "SQL"}).json()
    assert filtered["total"] == 201
    assert all(f["state"] == "open" and f["severity"] == "high" for f in filtered["items"])
    assert browser.get(base + "/counts", params={"workspace_id": WORKSPACE}).json() == counts
    assert browser.get(base, params={"q": "missing"}).json()["total"] == 0


def test_completed_scan_selector_is_workspace_scoped(client):
    browser, repository = client
    scan_id = seed(repository, 0)
    repository.tables["scans"].extend([
        {"id": str(uuid.uuid4()), "workspace_id": WORKSPACE, "status": "running", "created_at": "2026-10-19"},
        {"id": str(uuid.uuid4()), "workspace_id": str(uuid.uuid4()), "status": "completed", "created_at": "2026-10-19"},
    ])
    response = browser.get(f"/api/v1/workspaces/{WORKSPACE}/finding-scans")
    assert response.status_code == 200
    assert [s["id"] for s in response.json()["items"]] == [scan_id]
    assert browser.get(f"/api/v1/workspaces/{uuid.uuid4()}/finding-scans").status_code == 404


@pytest.mark.parametrize("endpoint", ["", "/counts", "/export", "/detail"])
def test_scoped_endpoints_deny_other_workspace_and_revoked_members(client, endpoint):
    browser, repository = client
    scan_id = seed(repository, 1)
    suffix = "/" + repository.tables["findings"][0]["id"] if endpoint == "/detail" else endpoint
    path = f"/api/v1/scans/{scan_id}/workbench/findings{suffix}"
    assert browser.get(path, params={"workspace_id": str(uuid.uuid4())}).status_code == 404
    repository.member = False
    assert browser.get(path, params={"workspace_id": WORKSPACE}).status_code == 404


def test_export_reads_all_pages_and_reapplies_redaction(client):
    browser, repository = client
    scan_id = seed(repository)
    response = browser.get(f"/api/v1/scans/{scan_id}/workbench/findings/export", params={"workspace_id": WORKSPACE, "format": "json"})
    assert response.status_code == 200
    assert len(response.json()) == 1205
    assert "queue_fixture_secret" not in response.text
    assert "object_path" not in response.text
    assert response.headers["cache-control"] == "no-store"
    filtered = browser.get(f"/api/v1/scans/{scan_id}/workbench/findings/export", params={"workspace_id": WORKSPACE, "format": "json", "severity": "high", "state": "open", "q": "SQL"})
    assert len(filtered.json()) == 201
    assert all(f["state"] == "open" for f in filtered.json())


def test_csv_quotes_every_column_and_blocks_formulas(client):
    browser, repository = client
    scan_id = seed(repository, 1)
    repository.tables["findings"][0].update(title='=DANGEROUS("x")', file_path='src/a,"b"\n.py', remediation="\t=SUM(1,2)")
    response = browser.get(f"/api/v1/scans/{scan_id}/workbench/findings/export", params={"workspace_id": WORKSPACE})
    assert response.status_code == 200
    rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
    assert len(rows) == 2 and len(rows[0]) == len(rows[1]) == 9
    assert rows[1][0] == '\'=DANGEROUS("x")'
    assert rows[1][5] == 'src/a,"b"\n.py'
    assert rows[1][-1] == "'\t=SUM(1,2)"


def test_export_honors_a_lower_project_row_cap(client):
    browser, repository = client
    scan_id = seed(repository)
    original = repository.page
    async def capped_page(table, *, limit=200, **kwargs):
        return await original(table, limit=min(limit, 123), **kwargs)
    repository.page = capped_page
    response = browser.get(f"/api/v1/scans/{scan_id}/workbench/findings/export", params={"workspace_id": WORKSPACE, "format": "json"})
    assert response.status_code == 200
    assert len(response.json()) == 1205


def test_detail_is_redacted_and_has_compliance_without_source_snapshot(client):
    browser, repository = client
    scan_id = seed(repository, 1)
    finding_id = repository.tables["findings"][0]["id"]
    repository.tables["compliance_violations"] = [{"finding_id": finding_id, "framework": "soc2", "control_id": "CC6.1", "control_title": "Access control"}]
    response = browser.get(f"/api/v1/scans/{scan_id}/workbench/findings/{finding_id}", params={"workspace_id": WORKSPACE})
    assert response.status_code == 200
    assert response.json()["finding"]["violations"][0]["control_id"] == "CC6.1"
    assert response.json()["file"] is None
    assert "queue_fixture_secret" not in response.text
    assert browser.get(f"/api/v1/scans/{scan_id}/workbench/findings/{uuid.uuid4()}").status_code == 404


def test_validation_and_running_export(client):
    browser, repository = client
    scan_id = seed(repository, 1)
    base = f"/api/v1/scans/{scan_id}/workbench/findings"
    for params in ({"state": "bad"}, {"severity": "bad"}, {"offset": -1}, {"q": "x" * 151}):
        assert browser.get(base, params=params).status_code == 422
    repository.tables["scans"][0]["status"] = "running"
    assert browser.get(base + "/export", params={"workspace_id": WORKSPACE}).status_code == 409


def test_queue_routes_require_authentication():
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    with TestClient(app) as browser:
        for path in (f"/api/v1/workspaces/{uuid.uuid4()}/finding-scans", f"/api/v1/scans/{uuid.uuid4()}/workbench/findings/counts?workspace_id={uuid.uuid4()}", f"/api/v1/scans/{uuid.uuid4()}/workbench/findings/export?workspace_id={uuid.uuid4()}"):
            assert browser.get(path).status_code == 401
