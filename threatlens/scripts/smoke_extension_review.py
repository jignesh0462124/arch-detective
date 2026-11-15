"""Opt-in live verification using disposable users, one workspace and synthetic ZIPs.

Uses server environment credentials in memory. Never prints credentials, changes
an existing account or runs repository scripts. Removes only its own fixtures.
"""
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse
import argparse
import asyncio
import io
import json
import os
import secrets
import sys
import time
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", required=True)
    args = parser.parse_args()
    os.environ["EXTENSION_REVIEW_ENABLED"] = "true"
    os.environ["ADVISOR_HISTORY_ENABLED"] = "true"
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    import httpx
    from PIL import Image
    from app.config import settings
    from app.api import api_router
    from app.api.audit_workbench import _tasks
    from app.storage.workbench_store import open_workbench_connections, close_workbench_connections
    from preview_extension_report import fixture

    if urlparse(settings.SUPABASE_URL).hostname != "gzyxgqxycbccifajdoiu.supabase.co":
        raise RuntimeError("Live verification is restricted to the configured Archon project")
    if not settings.SUPABASE_SERVICE_ROLE_KEY or not settings.SUPABASE_PUBLISHABLE_KEY:
        raise RuntimeError("Configure server storage and publishable keys locally before this test")
    root = settings.SUPABASE_URL.rstrip("/")
    service_headers = {"apikey": settings.SUPABASE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}", "Prefer": "return=representation"}
    user_ids, scan_ids, workspace = [], [], None
    created = time.monotonic()

    def require(response, code, label):
        if response.status_code != code:
            raise RuntimeError(f"{label} failed with status {response.status_code}")
        return response

    with httpx.Client(timeout=45, follow_redirects=False) as remote:
        def rest(method, table, **kwargs):
            return remote.request(method, f"{root}/rest/v1/{table}", headers=service_headers, **kwargs)

        def create_user(label):
            email = f"archon-extension-{label}-{uuid.uuid4().hex}@example.com"
            password = secrets.token_urlsafe(32)
            response = require(remote.post(f"{root}/auth/v1/admin/users", headers=service_headers,
                json={"email": email, "password": password, "email_confirm": True}), 200, "Disposable user creation")
            identifier = str(uuid.UUID(response.json()["id"]))
            user_ids.append(identifier)
            auth = require(remote.post(f"{root}/auth/v1/token?grant_type=password", headers={"apikey": settings.SUPABASE_PUBLISHABLE_KEY},
                json={"email": email, "password": password}), 200, "Disposable sign-in").json()
            import jwt
            claims = jwt.decode(auth["access_token"], options={"verify_signature": False})
            print("Auth metadata: " + json.dumps({"algorithm": jwt.get_unverified_header(auth["access_token"]).get("alg"), "issuer_matches": claims.get("iss") == settings.SUPABASE_JWT_ISSUER, "audience_matches": claims.get("aud") == settings.SUPABASE_JWT_AUDIENCE}), flush=True)
            return identifier, {"Authorization": f"Bearer {auth['access_token']}"}

        @asynccontextmanager
        async def lifespan(app):
            await open_workbench_connections()
            try:
                yield
            finally:
                for task in list(_tasks):
                    task.cancel()
                await asyncio.gather(*list(_tasks), return_exceptions=True)
                await close_workbench_connections()

        try:
            owner, owner_headers = create_user("owner")
            viewer, viewer_headers = create_user("viewer")
            workspace = str(uuid.uuid4())
            require(rest("POST", "workspaces", json={"id": workspace, "name": "Disposable extension verification", "slug": "ext-check-" + uuid.uuid4().hex[:16], "owner_user_id": owner}), 201, "Disposable workspace creation")
            app = FastAPI(lifespan=lifespan)
            app.include_router(api_router)
            with TestClient(app) as browser:
                capability_response = browser.get("/api/v1/extension-reviews/capabilities", headers=owner_headers)
                if capability_response.status_code == 401:
                    from app.auth.dependencies import get_jwt_verifier
                    try:
                        browser.portal.call(get_jwt_verifier().verify, owner_headers["Authorization"].split(" ", 1)[1])
                    except Exception as failure:
                        print("Auth verification category: " + type(failure).__name__ + "; cause: " + type(failure.__cause__).__name__, flush=True)
                caps = require(capability_response, 200, "Post-login capability read").json()
                if not caps["enabled"]:
                    raise RuntimeError("Hosted extension tables or Storage are unavailable")
                print("PASS real sign-in and authenticated extension capabilities", flush=True)
                declarations = {"purpose": "Review documents locally", "permissions": "storage for local preferences", "data_use": "No personal data is collected", "chrome": {"description": "Review documents locally", "privacy_text": "No personal data is collected"}, "edge": {"description": "Review documents locally", "privacy_text": "No personal data is collected"}}
                image = io.BytesIO()
                Image.new("RGB", (64, 48), "white").save(image, format="PNG")
                for fixed in (False, True):
                    response = require(browser.post(f"/api/v1/workspaces/{workspace}/extension-reviews", headers={**owner_headers, "Idempotency-Key": str(uuid.uuid4())},
                        data={"stores": "chrome,edge", "declarations": json.dumps(declarations), "screenshot_stores": '["chrome"]'},
                        files=[("file", ("fixture.zip", fixture(fixed), "application/zip")), ("screenshots", ("fixture.png", image.getvalue(), "image/png"))]), 202, "Extension upload acceptance")
                    scan = response.json()["scan_id"]
                    scan_ids.append(scan)
                    started = time.monotonic()
                    for _ in range(240):
                        progress = require(browser.get(f"/api/v1/scans/{scan}/workbench/progress", headers=owner_headers), 200, "Authenticated progress").json()
                        if progress["status"] != "running":
                            break
                        time.sleep(1)
                    if progress["status"] != "completed":
                        raise RuntimeError("Synthetic extension scan failed or timed out")
                    base = f"/api/v1/workspaces/{workspace}/extension-reviews/{scan}"
                    metadata = require(browser.get(base, headers=owner_headers), 200, "Saved extension metadata").json()
                    if not metadata["coverage"]["total"]:
                        raise RuntimeError("Completed scan is missing policy coverage")
                    print(f"PASS {'corrected' if fixed else 'original'} ZIP: saved source, security and policy review in {time.monotonic()-started:.1f}s", flush=True)
                base = f"/api/v1/workspaces/{workspace}/extension-reviews/{scan_ids[0]}"
                first = require(browser.get(base + "/results?store_filter=chrome&outcome=violation", headers=owner_headers), 200, "Store/outcome filtering").json()
                if first["total"] < 1:
                    raise RuntimeError("Synthetic remote script was not detected")
                policy = first["items"][0]["id"]
                detail = require(browser.get(base + f"/results/{policy}", headers=owner_headers), 200, "Policy detail").json()
                if not detail["source_available"] or not detail["notice"]["reference_available"]:
                    raise RuntimeError("Grounded source or notice reference is unavailable")
                require(browser.put(base + f"/results/{policy}/annotation", headers=owner_headers, json={"note": "Synthetic verification only"}), 200, "Saved review note")
                images = require(browser.get(base + "/assets", headers=owner_headers), 200, "Private screenshot list").json()["items"]
                require(browser.get(base + f"/assets/{images[0]['id']}", headers=owner_headers), 200, "Authenticated screenshot")
                require(browser.get(base, headers=viewer_headers), 404, "Outsider denial")
                require(rest("POST", "workspace_members", json={"workspace_id": workspace, "user_id": viewer, "role": "viewer"}), 201, "Disposable viewer membership")
                require(browser.get(base, headers=viewer_headers), 200, "Viewer read")
                require(browser.put(base + f"/results/{policy}/annotation", headers=viewer_headers, json={"note": "must be denied"}), 403, "Viewer write denial")
                denied = remote.patch(f"{root}/rest/v1/extension_policy_results", params={"id": f"eq.{policy}"}, headers={"apikey": settings.SUPABASE_PUBLISHABLE_KEY, **owner_headers}, json={"outcome": "passed"})
                if denied.status_code not in (401, 403):
                    raise RuntimeError("Direct browser policy write was not rejected")
                print("PASS hosted private screenshot, policy remedies, viewer/outsider access and server-only writes", flush=True)
                compare = require(browser.get(f"/api/v1/workspaces/{workspace}/extension-reviews/{scan_ids[1]}/compare/{scan_ids[0]}", headers=owner_headers), 200, "Recheck comparison").json()
                if compare["counts"]["no_longer_detected"] < 1:
                    raise RuntimeError("Corrected package did not remove the synthetic policy finding")
                report = require(browser.get(f"/api/v1/scans/{scan_ids[0]}/workbench/report?workspace_id={workspace}", headers=owner_headers), 200, "Authenticated PDF")
                if not report.content.startswith(b"%PDF") or len(report.content) < 10000:
                    raise RuntimeError("PDF response is invalid")
                print(f"PASS corrected-package comparison and authenticated PDF ({len(report.content)} bytes)", flush=True)
                advisor = browser.get("/api/v1/ai/capabilities", headers=owner_headers).json()
                if not advisor.get("available"):
                    raise RuntimeError("Live suggestion verification needs a configured provider")
                context = {"workspace_id": workspace, "scan_id": scan_ids[0], "policy_result_id": policy}
                conversation = require(browser.post("/api/v1/ai/conversations", headers=owner_headers,
                    json={"workspace_id": workspace, "title": "Disposable extension remedy check", "context": context}), 201, "Private policy conversation").json()
                response = require(browser.post("/api/v1/ai/chat", headers=owner_headers, json={"messages": [{"role": "user", "content": "Suggest a minimal change for this recorded extension policy issue. The package already contains dist/local.js. Preserve uncertainty and include verification."}],
                    "context": context, "conversation_id": conversation["id"], "submission_id": str(uuid.uuid4()), "code_solution": True}), 200, "Policy code suggestion")
                if "data: [DONE]" not in response.text:
                    raise RuntimeError("Live suggestion was interrupted; it was not treated as complete")
                require(browser.get(f"/api/v1/ai/conversations/{conversation['id']}", headers=viewer_headers), 404, "Private conversation isolation")
                snapshot = require(rest("GET", "source_snapshots", params={"scan_id": f"eq.{scan_ids[0]}", "select": "id"}), 200, "Fixture snapshot lookup").json()[0]
                require(rest("PATCH", "source_snapshots", params={"id": f"eq.{snapshot['id']}"}, json={"state": "expired"}), 200, "Fixture-only expiry")
                require(browser.get(base + f"/assets/{images[0]['id']}", headers=owner_headers), 410, "Expired screenshot denial")
                require(browser.get(f"/api/v1/ai/conversations/{conversation['id']}", headers=owner_headers), 404, "Expired policy conversation removal")
                print("PASS live provider suggestion, private conversation and immediate source-expiry denial", flush=True)
            print(f"PASS complete hosted extension workflow in {time.monotonic()-created:.1f}s", flush=True)
        finally:
            # Only IDs created in this invocation are eligible for cleanup.
            paths = set()
            if workspace:
                snapshots = rest("GET", "source_snapshots", params={"scan_id": "in.(" + ",".join(scan_ids) + ")", "select": "id"}).json() if scan_ids else []
                for snapshot in snapshots if isinstance(snapshots, list) else []:
                    rows = rest("GET", "snapshot_files", params={"snapshot_id": f"eq.{snapshot['id']}", "select": "object_path"}).json()
                    paths.update(row["object_path"] for row in rows if row.get("object_path"))
                assets = rest("GET", "extension_review_assets", params={"scan_id": "in.(" + ",".join(scan_ids) + ")", "select": "object_path"}).json() if scan_ids else []
                if isinstance(assets, list):
                    paths.update(row["object_path"] for row in assets)
                require(rest("DELETE", "workspaces", params={"id": f"eq.{workspace}"}), 200, "Disposable workspace cleanup")
                for path in paths:
                    if not path.startswith(workspace + "/"):
                        raise RuntimeError("Refusing cleanup outside disposable workspace")
                    require(remote.request("DELETE", f"{root}/storage/v1/object/{settings.SUPABASE_SOURCE_BUCKET}", headers=service_headers, json={"prefixes": [path]}), 200, "Disposable private-object cleanup")
                    require(rest("DELETE", "source_cleanup_queue", params={"object_path": f"eq.{path}"}), 200, "Disposable cleanup checkpoint")
            for identifier in user_ids:
                require(remote.delete(f"{root}/auth/v1/admin/users/{identifier}", headers=service_headers), 200, "Disposable user cleanup")
            print("Removed disposable workspace, users and captured source/screenshot objects", flush=True)


if __name__ == "__main__":
    main()
