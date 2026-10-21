from __future__ import annotations

import copy
import asyncio
import fnmatch
import io
import time
import uuid
import zipfile
from datetime import timedelta

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api import audit_workbench as api
from app.api import local_scan
from app.auth.dependencies import get_current_user
from app.ingestion.source_snapshot import read_zip_snapshot, redact_text, resolve_location, normalize_source_path
from app.schemas.auth import AuthenticatedUser

WORKSPACE = str(uuid.uuid4())
USER = str(uuid.uuid4())


@pytest.mark.asyncio
async def test_scan_transition_events_are_idempotent_and_minimal():
    repository = MemoryStore()
    scan_id = str(uuid.uuid4())
    for _ in range(2):
        await api.record_scan_event(repository, scan_id, WORKSPACE, USER, "scan.started", "Example ZIP")
    await api.record_scan_event(repository, scan_id, WORKSPACE, USER, "scan.completed", "Example ZIP", 3)
    events = repository.tables["audit_events"]
    assert len(events) == 2
    assert {event["event_type"] for event in events} == {"scan.started", "scan.completed"}
    assert all(event["resource_id"] == scan_id and event["actor_user_id"] == USER for event in events)
    assert events[1]["event_metadata"] == {"target": "Example ZIP", "findings": 3}


def archive(files):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as zipped:
        for path, content in files.items():
            zipped.writestr(path, content)
    return stream.getvalue()


class MemoryStore:
    def __init__(self):
        self.tables = {}
        self.objects = {}
        self.member = True
        self.current_role = "owner"
        self.fail_upload = False
        self.upload_delay = 0
        self.uploading = 0
        self.max_uploading = 0

    def matching(self, row, filters):
        for key, value in filters.items():
            if key in {"limit", "offset", "order", "select", "on_conflict"}:
                continue
            if key == "or":
                import re
                operands = re.findall(r'(\w+)\.ilike\."((?:\\.|[^"])*)"', value)
                if not any(pattern.strip('%').replace('\\', '').lower() in str(row.get(field) or '').lower() for field, pattern in operands):
                    return False
                continue
            operator, text = value.split(".", 1)
            current = str(row.get(key))
            if operator == "eq" and current != text:
                return False
            if operator == "neq" and current == text:
                return False
            if operator == "ilike" and not fnmatch.fnmatch(current.lower(), text.replace('%', '*').lower()):
                return False
            if operator == "in" and current not in text.strip("()").split(","):
                return False
            if operator in {"lt", "lte"} and not (current <= text if operator == "lte" else current < text):
                return False
        return True

    async def rest(self, method, table, *, params=None, body=None, **kwargs):
        if table == "rpc/audit_workbench_counts":
            findings = [f for f in self.tables.get("findings", []) if f["scan_id"] == body["p_scan_id"]] if self.member else []
            locations = [l for l in self.tables.get("finding_locations", []) if l["finding_id"] in {f["id"] for f in findings}]
            snapshot = await self.snapshot(body["p_scan_id"])
            files = [f for f in self.tables.get("snapshot_files", []) if snapshot and f["snapshot_id"] == snapshot["id"]] if self.member else []
            return {"total": len(findings), "severity": {s: sum(f["severity"] == s for f in findings) for s in ("critical", "high", "medium", "low")}, "files": {l["file_id"]: sum(x.get("file_id") == l["file_id"] for x in locations) for l in locations if l.get("file_id")}, "previews": {"ready": sum(f["preview_state"] == "ready" for f in files), "pending": sum(f["preview_state"] == "pending" for f in files), "total": len(files)}}
        if isinstance(body, list):
            results = []
            for entry in body:
                results.extend(await self.rest(method, table, params=params, body=entry, **kwargs))
            return results
        entries = self.tables.setdefault(table, [])
        params = params or {}
        if method == "POST":
            conflict = params.get("on_conflict")
            if conflict and any(row.get(conflict) == body.get(conflict) for row in entries):
                return []
            row = {"id": str(uuid.uuid4()), "created_at": api.now().isoformat(), **copy.deepcopy(body)}
            if table == "audit_workbench_jobs":
                row = {"status": "running", "events": [], "progress": 0, "result_metadata": {}, "heartbeat_at": api.now().isoformat(), **row}
            if table == "source_snapshots":
                row = {"revision": 1, **row}
            entries.append(row)
            return [copy.deepcopy(row)]
        selected = [row for row in entries if self.matching(row, params)]
        if method == "PATCH":
            for row in selected:
                row.update(copy.deepcopy(body))
        if method == "DELETE":
            self.tables[table] = [row for row in entries if row not in selected]
        return copy.deepcopy(selected)

    async def rows(self, table, **filters):
        return await self.rest("GET", table, params=filters)

    async def page(self, table, *, offset=0, limit=200, token=None, **filters):
        entries = await self.rows(table, **filters)
        for field in reversed(filters.get("order", "id.asc").split(",")):
            key, direction = field.split(".")
            ranks = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            entries.sort(key=lambda f: ranks.get(f.get(key), f.get(key) or ""), reverse=direction == "desc")
        return {"items": entries[offset:offset + limit], "total": len(entries), "offset": offset, "limit": limit}

    async def role(self, workspace_id, token):
        return self.current_role if workspace_id == WORKSPACE and self.member else None

    async def authorize(self, scan_id, token, workspace_id=None):
        values = await self.rows("scans", id=f"eq.{scan_id}")
        if not self.member or not values or (workspace_id and workspace_id != values[0]["workspace_id"]):
            raise HTTPException(404, "Scan not found")
        return values[0]

    async def snapshot(self, scan_id):
        values = await self.rows("source_snapshots", scan_id=f"eq.{scan_id}")
        return values[0] if values else None

    async def upload_text(self, path, text):
        if self.fail_upload:
            raise RuntimeError("storage down")
        self.uploading += 1
        self.max_uploading = max(self.max_uploading, self.uploading)
        try:
            await asyncio.sleep(self.upload_delay)
            self.objects[path] = text
        finally:
            self.uploading -= 1

    async def read_text(self, path):
        return self.objects[path]

    async def remove_text(self, path):
        self.objects.pop(path, None)


@pytest.fixture
def client(monkeypatch):
    repository = MemoryStore()
    async def no_ai(**kwargs):
        return "[]"
    monkeypatch.setattr(local_scan, "_run_groq_agent", no_ai)
    monkeypatch.setattr(api.settings, "AUDIT_WORKBENCH_ENABLED", True)
    monkeypatch.setattr(api.settings, "AUDIT_WORKBENCH_PROGRESSIVE_ENABLED", False)
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    app.dependency_overrides[api.store] = lambda: repository
    app.dependency_overrides[api.access_token] = lambda: "fixture-token"
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=uuid.UUID(USER), email=None, session_id=None)
    with TestClient(app) as browser:
        yield browser, repository


def start(browser, key=None, content=None):
    response = browser.post(f"/api/v1/workspaces/{WORKSPACE}/audits", files={"file": ("project.zip", content or archive({"app.php": '<?php\npassword="private-credential-value";\nreadfile($_GET["path"]);'}), "application/zip")}, data={"target_name": "Test project", "frameworks": "gdpr,soc2"}, headers={"Idempotency-Key": key or str(uuid.uuid4())})
    return response


def complete(browser, scan_id):
    for _ in range(100):
        state = browser.get(f"/api/v1/scans/{scan_id}/workbench/progress").json()
        if state["status"] != "running":
            return state
        time.sleep(.01)
    raise AssertionError("Scan did not complete")


def test_snapshot_sanitizes_without_changing_line_numbers_or_columns():
    source = 'API_KEY="private-credential"\npassword = "secret-value"\nprint("safe")\n'
    masked = redact_text(source)
    assert "private-credential" not in masked and "secret-value" not in masked
    assert len(masked) == len(source) and source.count("\n") == masked.count("\n")
    assert 'print("safe")' in masked
    private_key = "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----"
    assert "secret" not in redact_text(private_key)
    assert redact_text(private_key).count("\n") == 2


@pytest.mark.parametrize("source,value", [
    ('{"password": "two word value"}', 'two word value'),
    ('SUPABASE_SERVICE_ROLE_KEY="private-role-value"', 'private-role-value'),
    ('TOKEN = "private-token-value"', 'private-token-value'),
    ("$pass = 'fixture-pass-value';", 'fixture-pass-value'),
    ("$pwd = 'fixture-pwd-value';", 'fixture-pwd-value'),
    ('DATABASE_URL=postgres://user:private-password@localhost/db', 'private-password'),
    ('url = "https://user:private-password@host/path"', 'private-password'),
])
def test_common_credential_formats_are_masked(source, value):
    assert value not in redact_text(source)
    assert len(redact_text(source)) == len(source)


@pytest.mark.parametrize("path", ["../outside.py", "/root/a.py", "C:\\data.py", "a/../../bad", "bad\x00.py"])
def test_unsafe_paths_are_rejected(path):
    assert normalize_source_path(path) is None


def test_tree_has_skip_reasons_and_exact_location_matching():
    files, source, excluded = read_zip_snapshot(archive({"src/a.py": "one\ntwo\n", "other/a.py": "other", "node_modules/x.js": "dependency", "image.png": b"\x00\xff", "../outside.py": "bad"}), str(uuid.uuid4()))
    assert len(source) == 2 and len(excluded) == 1
    assert next(f for f in files if f["path"] == "node_modules/x.js")["preview_state"] == "excluded"
    location = resolve_location({"file_path": "src\\a.py", "line_number": 2}, files)
    assert location["match_status"] == "verified"
    assert resolve_location({"file_path": "a.py", "line_number": 2}, files)["match_status"] == "unlocated"
    assert resolve_location({"file_path": "src/a.py", "line_number": 90}, files)["match_status"] == "unlocated"


def test_zip_to_source_findings_controls_and_report_metadata(client):
    browser, repository = client
    response = start(browser)
    assert response.status_code == 202, response.text
    scan_id = response.json()["scan_id"]
    assert complete(browser, scan_id)["status"] == "completed"
    result = browser.get(f"/api/v1/scans/{scan_id}/workbench?workspace_id={WORKSPACE}")
    assert result.status_code == 200 and result.headers["cache-control"] == "no-store"
    data = result.json()
    assert data["snapshot"]["state"] == "ready"
    assert data["findings"] and data["findings"][0]["violations"]
    assert data["findings"][0]["id"] and data["findings"][0]["source"] == "static-rule"
    assert "private-credential-value" not in result.text
    files = browser.get(f"/api/v1/scans/{scan_id}/source/files").json()["items"]
    source = browser.get(f"/api/v1/scans/{scan_id}/source/files/{files[0]['id']}")
    assert source.status_code == 200 and "private-credential-value" not in source.text
    assert "object_path" not in json_keys(files[0])
    assert repository.tables["scans"][0]["status"] == "completed"


def json_keys(value):
    return value.keys()


def test_idempotency_and_different_payload_conflict(client):
    browser, repository = client
    key = str(uuid.uuid4())
    first = start(browser, key)
    second = start(browser, key)
    assert first.json()["scan_id"] == second.json()["scan_id"]
    assert len(repository.tables["scans"]) == 1
    assert start(browser, key, archive({"other.py": "different"})).status_code == 409


def test_viewer_cannot_start_and_membership_revocation_blocks_source(client):
    browser, repository = client
    repository.current_role = "viewer"
    assert start(browser).status_code == 403
    repository.current_role = "owner"
    scan_id = start(browser).json()["scan_id"]
    complete(browser, scan_id)
    files = browser.get(f"/api/v1/scans/{scan_id}/source/files").json()["items"]
    repository.member = False
    for suffix in ["workbench", "workbench/progress", "source", "source/files", f"source/files/{files[0]['id']}", "source/search?q=readfile", "workbench/report"]:
        assert browser.get(f"/api/v1/scans/{scan_id}/{suffix}").status_code == 404


def test_foreign_file_and_expiry_are_explicit(client):
    browser, repository = client
    scan_id = start(browser).json()["scan_id"]
    complete(browser, scan_id)
    assert browser.get(f"/api/v1/scans/{scan_id}/source/files/{uuid.uuid4()}").status_code == 404
    repository.tables["source_snapshots"][0]["expires_at"] = (api.now() - timedelta(seconds=1)).isoformat()
    assert browser.get(f"/api/v1/scans/{scan_id}/source/files").status_code == 410
    assert browser.get(f"/api/v1/scans/{scan_id}/workbench").json()["findings"]


def test_older_previews_are_masked_on_read_and_search(client):
    browser, repository = client
    scan_id = start(browser).json()["scan_id"]
    complete(browser, scan_id)
    file = repository.tables["snapshot_files"][0]
    repository.objects[file["object_path"]] = "$pass = 'fixture-old-value';\nneedle"
    file["redacted"] = False
    response = browser.get(f"/api/v1/scans/{scan_id}/source/files/{file['id']}")
    assert response.json()["redacted"] is True
    assert "fixture-old-value" not in response.text
    assert "fixture-old-value" not in browser.get(f"/api/v1/scans/{scan_id}/source/search?q=pass").text


def test_other_snapshot_file_and_invalid_line_are_rejected(client):
    browser, _ = client
    first = start(browser).json()["scan_id"]
    second = start(browser).json()["scan_id"]
    complete(browser, first)
    complete(browser, second)
    file_id = browser.get(f"/api/v1/scans/{first}/source/files").json()["items"][0]["id"]
    assert browser.get(f"/api/v1/scans/{second}/source/files/{file_id}").status_code == 404
    assert browser.get(f"/api/v1/scans/{first}/source/files/{file_id}?start=99999").status_code == 416


def test_unauthenticated_requests_require_a_session():
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    with TestClient(app) as browser:
        for suffix in ["workbench", "workbench/progress", "source", "source/files", "source/search?q=test", "workbench/report"]:
            assert browser.get(f"/api/v1/scans/{uuid.uuid4()}/{suffix}").status_code == 401


def test_report_uses_saved_sanitized_evidence(client, monkeypatch):
    from fastapi.responses import Response
    browser, _ = client
    def pdf(scan_id, evidence, *, cache=True):
        assert cache is False
        assert evidence["findings"] and evidence["target_name"] == "Test project"
        assert "private-credential-value" not in str(evidence)
        return Response(b"%PDF-fixture", media_type="application/pdf")
    monkeypatch.setattr(api, "_generate_pdf_stream", pdf)
    scan_id = start(browser).json()["scan_id"]
    complete(browser, scan_id)
    response = browser.get(f"/api/v1/scans/{scan_id}/workbench/report")
    assert response.status_code == 200 and response.content.startswith(b"%PDF")
    assert response.headers["cache-control"] == "no-store"


def test_search_continuation_does_not_skip_unprocessed_files(client):
    browser, _ = client
    scan_id = start(browser, content=archive({"a.py": "needle\n" * 101, "b.py": "needle\n", "c.py": "needle\n"})).json()["scan_id"]
    complete(browser, scan_id)
    first = browser.get(f"/api/v1/scans/{scan_id}/source/search?q=needle").json()
    assert len(first["items"]) == 100 and first["next_offset"] == 1
    second = browser.get(f"/api/v1/scans/{scan_id}/source/search?q=needle&offset=1").json()
    assert {item["path"] for item in second["items"]} == {"b.py", "c.py"}


def test_authenticated_pdf_never_touches_legacy_cache(monkeypatch):
    from app.report import generator
    def forbidden_cache(*args):
        raise AssertionError("Authenticated report must not access the public legacy cache")
    monkeypatch.setattr(local_scan, "_scan_file_path", forbidden_cache)
    monkeypatch.setattr(generator, "generate_pdf_report", lambda data: b"%PDF-private-fixture")
    response = local_scan._generate_pdf_stream(str(uuid.uuid4()), {"target_name": "Private audit", "findings": []}, cache=False)
    assert response.media_type == "application/pdf"


def test_storage_failure_keeps_findings_but_does_not_publish_partial_source(client):
    browser, repository = client
    repository.fail_upload = True
    scan_id = start(browser).json()["scan_id"]
    assert complete(browser, scan_id)["status"] == "completed"
    data = browser.get(f"/api/v1/scans/{scan_id}/workbench").json()
    assert data["snapshot"]["state"] == "failed" and data["findings"]
    assert browser.get(f"/api/v1/scans/{scan_id}/source/files").status_code == 409


def test_progressive_pending_files_and_late_findings(client, monkeypatch):
    browser, repository = client
    monkeypatch.setattr(api.settings, "AUDIT_WORKBENCH_PROGRESSIVE_ENABLED", True)
    repository.upload_delay = .08
    scan_id = start(browser, content=archive({f"src/{i:03}.php": '<?php readfile($_GET["path"]);' for i in range(30)})).json()["scan_id"]
    for _ in range(100):
        boot = browser.get(f"/api/v1/scans/{scan_id}/workbench/bootstrap?workspace_id={WORKSPACE}").json()
        if boot["initial_source"] and boot["counts"]["previews"]["pending"]:
            break
        time.sleep(.005)
    else:
        raise AssertionError("No source was published before indexing finished")
    assert boot["scan"]["status"] == "running"
    assert len(boot["files"]["items"]) == 30
    assert "object_path" not in str(boot["files"])
    pending = next(f for f in boot["files"]["items"] if f["preview_state"] == "pending")
    response = browser.get(f"/api/v1/scans/{scan_id}/source/files/{pending['id']}")
    assert response.status_code == 409 and "Preparing preview" in response.text
    assert browser.get(f"/api/v1/scans/{scan_id}/workbench/report").status_code == 409
    assert complete(browser, scan_id)["status"] == "completed"
    status = browser.get(f"/api/v1/scans/{scan_id}/workbench/status").json()
    assert status["counts"]["total"] > 0 and status["counts"]["previews"]["pending"] == 0
    assert repository.max_uploading == 8
    assert {"archive_validation", "source_preparation", "analysis", "persistence", "first_source_ready"} <= set(status["metadata"]["timings"])
    assert status["metadata"]["timings"]["analysis"] < status["metadata"]["timings"]["source_preparation"]
    repository.member = False
    for suffix in ["workbench/bootstrap", "workbench/status", "workbench/findings"]:
        assert browser.get(f"/api/v1/scans/{scan_id}/{suffix}").status_code == 404


def test_database_pages_global_counts_and_selected_evidence(client, monkeypatch):
    browser, repository = client
    monkeypatch.setattr(api.settings, "AUDIT_WORKBENCH_PROGRESSIVE_ENABLED", True)
    scan_id = start(browser, content=archive({f"src/{i:03}.php": '<?php readfile($_GET["path"]);' for i in range(210)})).json()["scan_id"]
    assert complete(browser, scan_id)["status"] == "completed"
    boot = browser.get(f"/api/v1/scans/{scan_id}/workbench/bootstrap").json()
    assert len(boot["files"]["items"]) == 200 and boot["files"]["total"] == 210
    assert len(boot["finding_page"]["items"]) == 50
    assert boot["counts"]["total"] == 210
    first = boot["finding_page"]["items"][0]
    assert "description" not in first and "code_snippet" not in first and "violations" not in first
    page2 = browser.get(f"/api/v1/scans/{scan_id}/workbench/findings?offset=50").json()
    assert len(page2["items"]) == 50
    assert not {f["id"] for f in page2["items"]} & {f["id"] for f in boot["finding_page"]["items"]}
    assert browser.get(f"/api/v1/scans/{scan_id}/source/files?offset=200").json()["total"] == 210
    filtered = browser.get(f"/api/v1/scans/{scan_id}/source/files?q=209.php").json()
    assert len(filtered["items"]) == 1
    filtered_findings = browser.get(f"/api/v1/scans/{scan_id}/workbench/findings?q=209.php").json()
    assert len(filtered_findings["items"]) == 1
    detail = browser.get(f"/api/v1/scans/{scan_id}/workbench/findings/{first['id']}").json()
    assert detail["finding"]["description"] and detail["finding"]["violations"]
    assert detail["file"]["id"] == first["location"]["file_id"]
    assert "object_path" not in detail["file"]
    assert browser.get(f"/api/v1/scans/{scan_id}/workbench/findings/{uuid.uuid4()}").status_code == 404


def test_bootstrap_prioritizes_preview_outside_first_file_page(client, monkeypatch):
    browser, _ = client
    monkeypatch.setattr(api.settings, "AUDIT_WORKBENCH_PROGRESSIVE_ENABLED", True)
    entries = {f"node_modules/{i:03}.js": "dependency" for i in range(210)}
    entries["src/main.php"] = "<?php echo 'fixture';"
    scan_id = start(browser, content=archive(entries)).json()["scan_id"]
    assert complete(browser, scan_id)["status"] == "completed"
    boot = browser.get(f"/api/v1/scans/{scan_id}/workbench/bootstrap").json()
    assert len(boot["files"]["items"]) == 200
    assert all(f["preview_state"] == "excluded" for f in boot["files"]["items"])
    assert boot["initial_file"]["path"] == "src/main.php"
    assert boot["initial_source"]["id"] == boot["initial_file"]["id"]


def test_source_metadata_failure_does_not_discard_findings(client, monkeypatch):
    browser, repository = client
    original = repository.rest
    async def reject_snapshot(method, table, **kwargs):
        if method == "POST" and table == "source_snapshots":
            raise HTTPException(503, "Fixture snapshot metadata outage")
        return await original(method, table, **kwargs)
    monkeypatch.setattr(repository, "rest", reject_snapshot)
    scan_id = start(browser).json()["scan_id"]
    assert complete(browser, scan_id)["status"] == "completed"
    result = browser.get(f"/api/v1/scans/{scan_id}/workbench").json()
    assert result["findings"] and result["snapshot"] is None
    assert not repository.tables.get("finding_locations")


def test_deleted_snapshot_late_uploads_are_requeued(client, monkeypatch):
    browser, repository = client
    monkeypatch.setattr(api.settings, "AUDIT_WORKBENCH_PROGRESSIVE_ENABLED", True)
    original = repository.upload_text
    removed = False
    async def remove_during_upload(path, text):
        nonlocal removed
        await original(path, text)
        if not removed:
            removed = True
            repository.tables["source_snapshots"] = []
            repository.tables["snapshot_files"] = []
            # Simulate the cascade cleanup having already run before late uploads finish.
            repository.tables["source_cleanup_queue"] = []
    monkeypatch.setattr(repository, "upload_text", remove_during_upload)
    scan_id = start(browser, content=archive({f"src/{i}.php": "<?php echo 'fixture';" for i in range(12)})).json()["scan_id"]
    complete(browser, scan_id)
    queued = {entry["object_path"] for entry in repository.tables["source_cleanup_queue"]}
    assert removed and set(repository.objects) <= queued
    assert not repository.tables["source_snapshots"]


@pytest.mark.asyncio
async def test_shared_http_client_keeps_jwts_request_specific(monkeypatch):
    import httpx
    from app.storage import workbench_store as storage
    requests = []
    async def handler(request):
        requests.append(request.headers["authorization"])
        return httpx.Response(200, json=[])
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(storage, "_client", client)
    monkeypatch.setattr(storage.settings, "SUPABASE_URL", "https://fixture.invalid")
    monkeypatch.setattr(storage.settings, "SUPABASE_SERVICE_ROLE_KEY", "fixture-server-only")
    repository = storage.WorkbenchStore()
    await asyncio.gather(repository.rest("GET", "scans", token="user-a"), repository.rest("GET", "scans", token="user-b"), repository.rest("GET", "scans"))
    assert requests == ["Bearer user-a", "Bearer user-b", "Bearer fixture-server-only"]
    assert "authorization" not in client.headers
    await client.aclose()


@pytest.mark.asyncio
async def test_process_upload_limit_is_shared_between_scans(monkeypatch):
    import httpx
    from app.storage import workbench_store as storage
    active, peak = 0, 0
    async def handler(request):
        nonlocal active, peak
        active += 1
        peak = max(active, peak)
        await asyncio.sleep(.005)
        active -= 1
        return httpx.Response(200, json={})
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(storage, "_client", client)
    monkeypatch.setattr(storage, "_upload_slots", asyncio.Semaphore(16))
    monkeypatch.setattr(storage.settings, "SUPABASE_URL", "https://fixture.invalid")
    monkeypatch.setattr(storage.settings, "SUPABASE_SERVICE_ROLE_KEY", "fixture-server-only")
    stores = [storage.WorkbenchStore(), storage.WorkbenchStore(), storage.WorkbenchStore()]
    await asyncio.gather(*(stores[i % 3].upload_text(f"scan/{i}", "safe") for i in range(40)))
    assert peak == 16 and active == 0
    await client.aclose()


@pytest.mark.asyncio
async def test_static_and_ai_overlap_without_changing_merge_order(monkeypatch):
    import threading
    ai_started = threading.Event()
    static_started = threading.Event()
    original_static = local_scan._static_code_scan
    source = [{"path": "a.php", "content": "<?php\nreadfile($_GET['path']);"}]
    expected = original_static(source, ["soc2"])
    def slow_static(files, frameworks):
        static_started.set()
        assert ai_started.wait(timeout=2), "AI was blocked behind the static scan"
        return original_static(files, frameworks)
    async def deterministic_ai(**kwargs):
        ai_started.set()
        assert await asyncio.to_thread(static_started.wait, 2)
        return '[{"title":"Grounded model review","severity":"medium","file_path":"a.php","line_number":2,"cwe_id":"CWE-200","description":"Review file read context","code_snippet":"readfile($_GET[\'path\']);"}]'
    monkeypatch.setattr(local_scan, "_static_code_scan", slow_static)
    monkeypatch.setattr(local_scan, "_run_groq_agent", deterministic_ai)
    result = await local_scan._scan_pipeline(str(uuid.uuid4()), source, local_scan._build_code_context(source), "Fixture", ["soc2"], persist_local=False, suggest_all_frameworks=False)
    assert result["analysis"]["mode"] == "static_and_ai"
    assert result["findings"][0]["title"] == expected[0]["title"]
    assert result["findings"][0]["source"] == "static-rule"
    assert result["findings"][-1]["source"] == "llm-review"


def test_clean_project_has_no_fabricated_findings(client):
    browser, _ = client
    scan_id = start(browser, content=archive({"app.py": "print('hello')"})).json()["scan_id"]
    assert complete(browser, scan_id)["status"] == "completed"
    data = browser.get(f"/api/v1/scans/{scan_id}/workbench").json()
    assert data["findings"] == [] and data["snapshot"]["file_count"] == 1


@pytest.mark.asyncio
async def test_expiry_cleanup_and_stale_job_recovery():
    repository = MemoryStore()
    repository.tables["audit_workbench_jobs"] = [{"scan_id": "old", "status": "running", "heartbeat_at": (api.now() - timedelta(minutes=10)).isoformat()}]
    repository.tables["scans"] = [{"id": "old", "status": "running"}]
    repository.tables["source_snapshots"] = [{"id": "snapshot", "state": "ready", "expires_at": (api.now() - timedelta(days=1)).isoformat()}]
    repository.tables["snapshot_files"] = [{"id": "file", "snapshot_id": "snapshot", "object_path": "workspace/scan/snapshot/file.txt"}]
    repository.objects["workspace/scan/snapshot/file.txt"] = "sanitized text"
    await api.maintenance_once(repository)
    assert repository.tables["scans"][0]["status"] == "failed"
    assert repository.tables["source_snapshots"][0]["state"] == "expired"
    assert not repository.objects
