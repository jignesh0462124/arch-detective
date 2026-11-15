from __future__ import annotations

import asyncio
import base64
import io
import json
import uuid
import zipfile

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import audit_workbench as workbench
from app.api import extension_reviews as api
from app.auth.dependencies import get_current_user
from app.schemas.auth import AuthenticatedUser
from app.api.ai_chat import FindingContext
from test_audit_workbench import MemoryStore, WORKSPACE, USER, complete
from test_extension_review import package
FIXTURE_PACKAGE = package()


@pytest.fixture
def client(monkeypatch):
    repository = MemoryStore()
    async def fixture_pipeline(*args, **kwargs):
        return {"findings": [], "framework_scores": {"gdpr": 100}, "summary": {"executive_summary": "Fixture only"}, "analysis": {}, "severity_counts": {"critical": 0, "high": 0, "medium": 0, "low": 0}}
    monkeypatch.setattr(workbench, "_scan_pipeline", fixture_pipeline)
    monkeypatch.setattr(api.settings, "EXTENSION_REVIEW_ENABLED", True)
    monkeypatch.setattr(api.settings, "AUDIT_WORKBENCH_ENABLED", True)
    monkeypatch.setattr(api.settings, "AUDIT_WORKBENCH_PROGRESSIVE_ENABLED", False)
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    app.include_router(workbench.router, prefix="/api/v1")
    app.dependency_overrides[api.store] = lambda: repository
    app.dependency_overrides[api.access_token] = lambda: "fixture-token"
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=uuid.UUID(USER), email=None, session_id=None)
    with TestClient(app) as browser:
        yield browser, repository


def start(browser, key=None, stores="chrome,edge", declarations="{}"):
    return browser.post(f"/api/v1/workspaces/{WORKSPACE}/extension-reviews", files={"file": ("extension.zip", FIXTURE_PACKAGE, "application/zip")}, data={"stores": stores, "declarations": declarations}, headers={"Idempotency-Key": key or str(uuid.uuid4())})


def test_zip_to_saved_results_and_existing_workbench(client):
    browser, repository = client
    response = start(browser)
    assert response.status_code == 202, response.text
    scan = response.json()["scan_id"]
    assert complete(browser, scan)["status"] == "completed"
    base = f"/api/v1/workspaces/{WORKSPACE}/extension-reviews/{scan}"
    review = browser.get(base)
    assert review.status_code == 200 and review.headers["cache-control"] == "no-store"
    first = browser.get(base + "/results").json()
    assert len(first["items"]) == 50 and first["total"] > 50
    second = browser.get(base + "/results?offset=50").json()
    assert second["items"] and second["total"] == first["total"]
    filtered = browser.get(base + "/results?store_filter=chrome&outcome=violation").json()
    assert filtered["total"] == 1
    selected = filtered["items"][0]["id"]
    detail = browser.get(base + f"/results/{selected}").json()
    assert detail["details"]["notification_id"] == "Blue Argon"
    assert "not a notice sent" in detail["notice"]["label"]
    assert repository.tables["scans"][0]["framework_scores"] == {}
    assert repository.tables["scans"][0]["source_config"]["review_kind"] == "extension"
    assert any("dist/main.js" == f["path"] for f in repository.tables["snapshot_files"])
    saved = browser.put(base + f"/results/{selected}/annotation", json={"note": "Checked in an isolated browser"})
    assert saved.status_code == 200
    assert browser.get(base + f"/results/{selected}").json()["outcome"] == "violation"


def test_roles_revocation_and_workspace_scope(client):
    browser, repository = client
    for role in ("viewer", None):
        repository.current_role = role
        assert start(browser).status_code == 403
    repository.current_role = "analyst"
    response = start(browser)
    scan = response.json()["scan_id"]
    assert complete(browser, scan)["status"] == "completed"
    base = f"/api/v1/workspaces/{WORKSPACE}/extension-reviews/{scan}"
    result = browser.get(base + "/results").json()["items"][0]["id"]
    repository.current_role = "viewer"
    assert browser.get(base).status_code == 200
    assert browser.put(base + f"/results/{result}/annotation", json={"note": "No"}).status_code == 403
    assert browser.get(base.replace(WORKSPACE, str(uuid.uuid4()))).status_code == 404
    repository.member = False
    assert browser.get(base).status_code == 404
    assert browser.get(base + "/results").status_code == 404


def test_idempotency_and_changed_inputs(client):
    browser, repository = client
    key = str(uuid.uuid4())
    first = start(browser, key)
    scan = first.json()["scan_id"]
    complete(browser, scan)
    assert start(browser, key).json()["scan_id"] == scan
    assert len(repository.tables["scans"]) == 1
    assert start(browser, key, "edge").status_code == 409
    assert start(browser, stores="firefox").status_code == 422
    assert start(browser, declarations='{"chrome":{"privacy_url":"javascript:alert(1)"}}').status_code == 422


def test_comparison_and_note_relationship_validation(client):
    browser, repository = client
    scans = []
    for _ in range(2):
        scan = start(browser).json()["scan_id"]
        complete(browser, scan)
        scans.append(scan)
    base = f"/api/v1/workspaces/{WORKSPACE}/extension-reviews/{scans[1]}"
    result = browser.get(base + f"/compare/{scans[0]}")
    assert result.status_code == 200
    assert result.json()["counts"]["still_present"] > 0
    assert browser.get(base + f"/compare/{scans[1]}").status_code == 409
    wrong = repository.tables["extension_policy_results"][0]["id"]
    assert browser.put(base + f"/results/{wrong}/annotation", json={"note": "wrong scan"}).status_code == 404


def test_failures_never_appear_completed(client, monkeypatch):
    browser, repository = client
    async def fail(*args, **kwargs):
        raise RuntimeError("provider unavailable")
    monkeypatch.setattr(workbench, "_scan_pipeline", fail)
    scan = start(browser).json()["scan_id"]
    assert complete(browser, scan)["status"] == "failed"
    assert browser.get(f"/api/v1/workspaces/{WORKSPACE}/extension-reviews/{scan}/results").status_code == 409


def screenshot():
    from PIL import Image, PngImagePlugin
    output = io.BytesIO()
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("Author", "private-personal-metadata")
    Image.new("RGB", (50, 40), "white").save(output, format="PNG", pnginfo=metadata)
    return output.getvalue()


def test_private_screenshot_upload_normalization_and_scope(client):
    browser, repository = client
    response = browser.post(f"/api/v1/workspaces/{WORKSPACE}/extension-reviews", data={"stores": "chrome", "screenshot_stores": '["chrome"]'},
        files=[("file", ("extension.zip", package(), "application/zip")), ("screenshots", ("private-name.png", screenshot(), "image/png"))])
    assert response.status_code == 202, response.text
    scan = response.json()["scan_id"]
    assert complete(browser, scan)["status"] == "completed"
    base = f"/api/v1/workspaces/{WORKSPACE}/extension-reviews/{scan}"
    images = browser.get(base + "/assets").json()["items"]
    assert len(images) == 1
    image = browser.get(base + f"/assets/{images[0]['id']}")
    assert image.status_code == 200 and image.headers["cache-control"] == "no-store"
    decoded = base64.b64decode(image.json()["data_url"].split(",")[1])
    assert decoded.startswith(b"\x89PNG") and b"private-personal-metadata" not in decoded
    assert "private-name" not in json.dumps(repository.tables["extension_review_assets"])
    repository.member = False
    assert browser.get(base + f"/assets/{images[0]['id']}").status_code == 404


def test_screenshots_cannot_be_svg_or_mapped_to_an_unselected_store(client):
    browser, _ = client
    for mapping, image in (('["edge"]', screenshot()), ('["chrome"]', b'<svg onload="alert(1)"/>')):
        response = browser.post(f"/api/v1/workspaces/{WORKSPACE}/extension-reviews", data={"stores": "chrome", "screenshot_stores": mapping},
            files=[("file", ("extension.zip", package(), "application/zip")), ("screenshots", ("test.png", image, "image/png"))])
        assert response.status_code == 422


def test_corrupt_deflate_payload_returns_a_readable_validation_error(client):
    browser, _ = client
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps({"manifest_version": 3, "name": "Fixture", "version": "1"}))
    damaged = bytearray(stream.getvalue())
    damaged[30 + len("manifest.json")] = 7  # Invalid deflate block type.
    response = browser.post(f"/api/v1/workspaces/{WORKSPACE}/extension-reviews", data={"stores": "chrome"}, files={"file": ("bad.zip", bytes(damaged), "application/zip")})
    assert response.status_code == 422
    assert "corrupt" in response.json()["detail"]


@pytest.mark.asyncio
async def test_policy_code_context_is_scoped_grounded_and_expiring(client, monkeypatch):
    browser, repository = client
    scan = start(browser).json()["scan_id"]
    assert complete(browser, scan)["status"] == "completed"
    row = next(r for r in repository.tables["extension_policy_results"] if r["store"] == "chrome" and r["outcome"] == "violation")
    context = FindingContext(workspace_id=WORKSPACE, scan_id=scan, policy_result_id=row["id"])
    monkeypatch.setattr(api, "WorkbenchStore", lambda: repository)
    evidence = await api.policy_advisor_evidence(context, "token", True)
    assert "source_context" in evidence and "policy" in evidence and "outcome" in evidence
    repository.current_role = "viewer"
    with pytest.raises(api.HTTPException) as denied:
        await api.policy_advisor_evidence(context, "token", True)
    assert denied.value.status_code == 403
    repository.current_role = "analyst"
    repository.tables["source_snapshots"][0]["state"] = "expired"
    with pytest.raises(api.HTTPException) as expired:
        await api.policy_advisor_evidence(context, "token", True)
    assert expired.value.status_code == 410


def test_permissions_area_filters_in_database(client):
    browser, repository = client
    scan = start(browser).json()["scan_id"]
    complete(browser, scan)
    page = browser.get(f"/api/v1/workspaces/{WORKSPACE}/extension-reviews/{scan}/results?area=permissions").json()
    assert page["total"] == 4
    assert {r["category"] for r in page["items"]} == {"permissions", "settings"}


def test_pdf_endpoint_receives_complete_extension_policy_content(client, monkeypatch):
    from fastapi.responses import Response
    browser, repository = client
    scan = start(browser).json()["scan_id"]
    complete(browser, scan)
    captured = {}
    def render(scan_id, payload, cache):
        captured.update(payload)
        assert cache is False
        return Response(b"%PDF-fixture", media_type="application/pdf")
    monkeypatch.setattr(workbench, "_generate_pdf_stream", render)
    response = browser.get(f"/api/v1/scans/{scan}/workbench/report?workspace_id={WORKSPACE}")
    assert response.status_code == 200
    assert len(captured["extension_review"]["results"]) == len(repository.tables["extension_policy_results"])
    assert captured["framework_scores"] == {} and captured["frameworks"] == []
