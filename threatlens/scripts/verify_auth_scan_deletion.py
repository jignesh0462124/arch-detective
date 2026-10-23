"""Disposable live acceptance fixture. Never reads or changes an existing audit.

Run from the repo root with PYTHONPATH=threatlens. All credentials stay in memory.
"""
import argparse
import json
import secrets
import time
import uuid

import httpx
import jwt
from app.config import settings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", action="store_true")
    parser.add_argument("--wait-cleanup", action="store_true")
    args = parser.parse_args()
    public_key = settings.SUPABASE_PUBLISHABLE_KEY if hasattr(settings, "SUPABASE_PUBLISHABLE_KEY") else ""
    if not public_key:
        # Read the existing public frontend key without displaying or persisting it.
        from dotenv import dotenv_values
        public_key = dotenv_values(".env").get("VITE_SUPABASE_PUBLISHABLE_KEY", "")
    if not settings.SUPABASE_SERVICE_ROLE_KEY or not public_key:
        raise SystemExit("Live fixture requires configured server and publishable keys.")
    marker = "archon-access-check-"+uuid.uuid4().hex
    account_id = workspace_id = None
    object_path = None
    token = ""
    stage = "create isolated account"
    results = {}
    with httpx.Client(base_url=settings.SUPABASE_URL, timeout=20) as remote:
        admin = {"apikey": settings.SUPABASE_SERVICE_ROLE_KEY, "Authorization": "Bearer "+settings.SUPABASE_SERVICE_ROLE_KEY}
        def expect(response, codes=(200, 201, 204)):
            if response.status_code not in codes:
                results["failed_http_status"] = response.status_code
                try:
                    code = response.json().get("code", "")
                    if isinstance(code, str) and code.isalnum() and len(code) <= 12:
                        results["response_error_code"] = code
                except (ValueError, AttributeError):
                    pass
                raise RuntimeError(f"{stage}: HTTP {response.status_code}")
            return response.json() if response.content else None
        try:
            password = secrets.token_urlsafe(32)
            created = expect(remote.post("/auth/v1/admin/users", headers=admin, json={"email":marker+"@example.com", "password":password, "email_confirm":True}))
            account_id = created["id"]
            stage = "sign in isolated account"
            session = expect(remote.post("/auth/v1/token?grant_type=password", headers={"apikey":public_key}, json={"email":marker+"@example.com", "password":password}))
            token = session["access_token"]
            results["token_algorithm"] = jwt.get_unverified_header(token).get("alg")
            stage = "first protected backend request"
            auth = {"Authorization":"Bearer "+token}
            check = httpx.get("http://127.0.0.1:8000/api/v1/ai/capabilities", headers=auth, timeout=15)
            results["first_protected_status"] = check.status_code
            if args.baseline:
                import asyncio
                from app.auth.jwt_verifier import SupabaseJWTVerifier
                try:
                    asyncio.run(SupabaseJWTVerifier().verify(token))
                    results["current_verifier"] = "passed"
                except Exception as error:
                    results["current_verifier"] = type(error).__name__
                if check.status_code == 401:
                    detail=check.json().get("detail")
                    results["backend_rejection"] = detail if detail in {"Authentication required","Invalid or expired access token","Access token contains invalid user claims"} else "other"
                results["auth_server_status"] = remote.get("/auth/v1/user", headers={"apikey":public_key, **auth}).status_code
                try:
                    key = jwt.PyJWKClient(settings.SUPABASE_JWKS_URL).get_signing_key_from_jwt(token)
                    jwt.decode(token,key.key,algorithms=settings.SUPABASE_JWT_ALGORITHMS,audience=settings.SUPABASE_JWT_AUDIENCE,issuer=settings.SUPABASE_JWT_ISSUER,options={"require":["exp","iat","sub"]})
                    results["local_verification"] = "passed"
                except Exception as error:
                    results["local_verification"] = type(error).__name__
                # Metadata is diagnostic only, never trusted as identity or authorization.
                claimed = jwt.decode(token, options={"verify_signature":False})
                results["local_clock_minus_issued_seconds"] = round(time.time()-claimed["iat"])
                print(json.dumps(results))
                return
            expect(check)
            stage = "create isolated workspace"
            headers = {"apikey":public_key, **auth, "Prefer":"return=representation"}
            # Provision fixtures with the admin API; all acceptance reads/deletes
            # below use the signed-in owner's token and existing RLS.
            fixture_admin = {**admin, "Prefer":"return=representation"}
            workspace = expect(remote.post("/rest/v1/workspaces", headers=fixture_admin, json={"name":marker,"slug":marker,"owner_user_id":account_id}))[0]
            workspace_id = workspace["id"]
            expect(remote.post("/rest/v1/workspace_members", headers={**fixture_admin,"Prefer":"resolution=ignore-duplicates,return=representation"}, json={"workspace_id":workspace_id,"user_id":account_id,"role":"owner"}))
            stage = "create isolated completed scan"
            scan = expect(remote.post("/rest/v1/scans", headers=headers, json={"workspace_id":workspace_id,"created_by":account_id,"target_name":marker,"scan_type":"codebase","source_type":"upload","status":"completed","selected_frameworks":["soc2"]}))[0]
            scan_id = scan["id"]
            stage = "create isolated evidence"
            finding=expect(remote.post("/rest/v1/findings", headers=headers, json={"scan_id":scan_id,"title":"Disposable acceptance finding","severity":"low","source":"semgrep","state":"open"}))[0]
            stage = "provision isolated private preview"
            snapshot=expect(remote.post("/rest/v1/source_snapshots",headers=fixture_admin,json={"scan_id":scan_id,"state":"ready","file_count":1}))[0]
            file_id=str(uuid.uuid4())
            object_path=f"{workspace_id}/{scan_id}/{snapshot['id']}/{file_id}.txt"
            preview=b"print('Disposable acceptance fixture')\n"
            expect(remote.post("/storage/v1/object/audit-source/"+object_path,headers={**admin,"Content-Type":"text/plain"},content=preview))
            expect(remote.post("/rest/v1/snapshot_files",headers=fixture_admin,json={"id":file_id,"snapshot_id":snapshot["id"],"path":"fixture.py","language":"python","byte_size":len(preview),"line_count":1,"preview_state":"ready","object_path":object_path}))
            expect(remote.post("/rest/v1/finding_locations",headers=fixture_admin,json={"finding_id":finding["id"],"snapshot_id":snapshot["id"],"file_id":file_id,"line_number":1,"match_status":"verified"}))
            expect(remote.post("/rest/v1/reports",headers=headers,json={"scan_id":scan_id,"status":"queued"}))
            for route in (f"/api/v1/scans/{scan_id}/workbench/findings/counts?workspace_id={workspace_id}",f"/api/v1/workspaces/{workspace_id}/report-library?q=&framework=all"):
                stage = "protected saved-result read"
                expect(httpx.get("http://127.0.0.1:8000"+route, headers=auth, timeout=15))
            stage = "delete isolated scan through owner RLS"
            deleted = expect(remote.delete("/rest/v1/scans", headers=headers, params={"id":"eq."+scan_id,"workspace_id":"eq."+workspace_id,"status":"in.(completed,failed)","select":"id"}))
            if len(deleted) != 1 or deleted[0]["id"] != scan_id:
                raise RuntimeError("Deletion returned no matching isolated scan")
            stage = "verify cascade and deleted-scan denial"
            for table, column, value in (("findings","scan_id",scan_id),("reports","scan_id",scan_id),("source_snapshots","scan_id",scan_id),("snapshot_files","snapshot_id",snapshot["id"]),("finding_locations","finding_id",finding["id"])):
                rows = expect(remote.get("/rest/v1/"+table, headers=admin, params={column:"eq."+value,"select":"id"}))
                if rows:
                    raise RuntimeError("Isolated child records were not removed")
            stage = "verify durable private source cleanup"
            queued=expect(remote.get("/rest/v1/source_cleanup_queue",headers=admin,params={"object_path":"eq."+object_path,"select":"object_path"}))
            def private_preview_removed():
                parent, name = object_path.rsplit("/",1)
                # Listing checks authoritative private object metadata, rather than
                # a download response that can survive briefly in a CDN cache.
                response=remote.post("/storage/v1/object/list/audit-source",headers=admin,json={"prefix":parent,"search":name,"limit":10})
                return response.is_success and not any(row.get("name")==name for row in response.json())
            if not queued and not private_preview_removed():
                raise RuntimeError("Private cleanup was neither queued nor completed")
            results["durable_source_cleanup"]="queued" if queued else "completed"
            if args.wait_cleanup:
                for _ in range(38):
                    if private_preview_removed():
                        results["durable_source_cleanup"]="completed"
                        break
                    time.sleep(2)
                else:
                    raise RuntimeError("Private cleanup did not finish in the acceptance window")
            missing = httpx.get(f"http://127.0.0.1:8000/api/v1/scans/{scan_id}/workbench/findings/counts?workspace_id={workspace_id}", headers=auth, timeout=15)
            if missing.status_code != 404:
                raise RuntimeError("Deleted scan remained readable")
            results.update(saved_result_reads="passed", confirmed_scan_deletion="passed", finding_report_source_cascades="passed", deleted_scan_status=missing.status_code)
            print(json.dumps(results))
        except Exception as error:
            # Do not print HTTP request/response bodies, secrets or JWTs.
            print(json.dumps({**results,"failed_stage":stage,"error_type":type(error).__name__}))
            raise SystemExit(1) from None
        finally:
            cleanup_failed=False
            if workspace_id:
                response=remote.delete("/rest/v1/workspaces", headers=admin, params={"id":"eq."+workspace_id,"name":"eq."+marker,"select":"id"})
                if not response.is_success:
                    cleanup_failed=True
            if account_id:
                response=remote.delete("/auth/v1/admin/users/"+account_id, headers=admin)
                if not response.is_success:
                    cleanup_failed=True
            # Leave an enqueued object to the production cleanup worker. If fixture
            # provisioning failed before metadata existed, remove only this object.
            if object_path:
                queue=remote.get("/rest/v1/source_cleanup_queue",headers=admin,params={"object_path":"eq."+object_path,"select":"object_path"})
                if queue.is_success and not queue.json():
                    remote.request("DELETE","/storage/v1/object/audit-source",headers=admin,json={"prefixes":[object_path]})
            if cleanup_failed:
                raise SystemExit("Isolated fixture cleanup needs attention (no credentials logged).")


if __name__ == "__main__":
    main()
