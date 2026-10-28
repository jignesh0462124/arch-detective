"""Live acceptance check using disposable accounts and a synthetic ZIP only.

Run from threatlens: .venv/Scripts/python scripts/verify_advisor_workflow.py --live
Credentials remain in memory. Cleanup targets only IDs created by this invocation.
"""
import argparse
import io
import json
from pathlib import Path
import secrets
import sys
import time
import uuid
import zipfile
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from dotenv import dotenv_values
from fastapi.testclient import TestClient
from app.config import settings
from app.main import app


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--api-url", default="")
    args = parser.parse_args()
    if not args.live:
        raise SystemExit("Pass --live to create and remove isolated acceptance fixtures.")
    if args.api_url and (urlparse(args.api_url).hostname not in ("127.0.0.1", "localhost") or urlparse(args.api_url).scheme != "http"):
        raise SystemExit("The optional API target must be a local HTTP backend.")
    public = settings.SUPABASE_PUBLISHABLE_KEY or dotenv_values(Path(__file__).resolve().parents[2]/".env").get("VITE_SUPABASE_PUBLISHABLE_KEY", "")
    if not public or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise SystemExit("Server and publishable keys must be configured locally.")
    marker = "archon-advisor-check-"+uuid.uuid4().hex
    accounts = []
    workspace = None
    scan_id = None
    paths = []
    stage = "setup"
    results = {}
    admin = {"apikey":settings.SUPABASE_SERVICE_ROLE_KEY,"Authorization":"Bearer "+settings.SUPABASE_SERVICE_ROLE_KEY,"Prefer":"return=representation"}
    def checked(response, codes=(200,201,202,204)):
        if response.status_code not in codes:
            raise RuntimeError(f"HTTP {response.status_code}")
        return response.json() if response.content else None
    with httpx.Client(base_url=settings.SUPABASE_URL,timeout=30) as remote:
        try:
            def account(suffix):
                password = secrets.token_urlsafe(32)
                email = marker+suffix+"@example.com"
                item=checked(remote.post("/auth/v1/admin/users",headers=admin,json={"email":email,"password":password,"email_confirm":True}))
                accounts.append(item["id"])
                session=checked(remote.post("/auth/v1/token?grant_type=password",headers={"apikey":public},json={"email":email,"password":password}))
                return {"Authorization":"Bearer "+session["access_token"]}
            owner = account("-owner")
            outsider = account("-other")
            workspace=checked(remote.post("/rest/v1/workspaces",headers=admin,json={"name":marker,"slug":marker,"owner_user_id":accounts[0]}))[0]["id"]
            archive=io.BytesIO()
            with zipfile.ZipFile(archive,"w") as bundle:
                bundle.writestr("src/app.py", "import sqlite3\n\ndef lookup(email):\n    connection = sqlite3.connect('users.db')\n    return connection.execute(f\"SELECT id FROM users WHERE email = '{email}'\").fetchone()\n")
                bundle.writestr("README.md", "Synthetic acceptance fixture. No real credentials or user data.\n")
            with (httpx.Client(base_url=args.api_url,timeout=90) if args.api_url else TestClient(app)) as backend:
                stage="fresh sign-in and capabilities"
                initial=backend.get("/api/v1/ai/capabilities",headers=owner)
                if initial.status_code==503:
                    import asyncio
                    from app.auth.jwt_verifier import SupabaseJWTVerifier
                    try:
                        asyncio.run(SupabaseJWTVerifier().verify(owner["Authorization"].split(" ",1)[1]))
                    except Exception as failure:
                        results["verification_category"]=str(failure) if type(failure).__name__.startswith("Auth") else type(failure).__name__
                capabilities=checked(initial)
                assert capabilities["history_available"]
                results["post_login_read"]="passed"
                stage="accepted ZIP scan"
                accepted=checked(backend.post(f"/api/v1/workspaces/{workspace}/audits",headers={**owner,"Idempotency-Key":str(uuid.uuid4())},files={"file":("advisor-fixture.zip",archive.getvalue(),"application/zip")},data={"target_name":marker,"frameworks":"soc2"}))
                scan_id=accepted["scan_id"]
                deadline=time.monotonic()+150
                while time.monotonic()<deadline:
                    progress=checked(backend.get(f"/api/v1/scans/{scan_id}/workbench/progress",headers=owner))
                    if progress["status"]!="running": break
                    time.sleep(1)
                assert progress["status"]=="completed"
                results["zip_scan"]="completed"
                stage="authorized saved finding"
                findings=checked(backend.get(f"/api/v1/scans/{scan_id}/workbench/findings",params={"workspace_id":workspace},headers=owner))["items"]
                assert findings
                finding=findings[0]
                context={"workspace_id":workspace,"scan_id":scan_id,"finding_id":finding["id"]}
                stage="private saved chat"
                conversation=checked(backend.post("/api/v1/ai/conversations",headers=owner,json={"workspace_id":workspace,"title":"Review synthetic query fix","context":context}))
                cid=conversation["id"]
                assert backend.get(f"/api/v1/ai/conversations/{cid}",headers=outsider).status_code==404
                direct=checked(remote.get("/rest/v1/advisor_conversations",headers={"apikey":public,**outsider},params={"id":"eq."+cid}))
                assert direct==[]
                results["private_history_access"]="passed"
                if capabilities["available"]:
                    stage="grounded code suggestion"
                    submission=str(uuid.uuid4())
                    payload={"conversation_id":cid,"submission_id":submission,"context":context,"code_solution":True,"model":"glm-5-3-flash","messages":[{"role":"user","content":"Suggest a minimal fix with code, assumptions and verification steps for this query."}]}
                    answer=backend.post("/api/v1/ai/chat",headers=owner,json=payload)
                    checked(answer, (200,)) if not answer.headers.get("content-type","").startswith("text/event-stream") else None
                    assert answer.status_code==200 and "[DONE]" in answer.text and '"error"' not in answer.text
                    messages=checked(backend.get(f"/api/v1/ai/conversations/{cid}/messages",headers=owner))["items"]
                    assert len(messages)==2 and all(m["status"]=="completed" for m in messages)
                    assert any(m["role"]=="assistant" and m["content"].strip() for m in messages)
                    assert backend.post("/api/v1/ai/chat",headers=owner,json=payload).status_code==409
                    results["saved_code_response_and_duplicate_guard"]="passed"
                else:
                    results["code_response"]="provider unavailable"
                stage="conversation update and deletion"
                checked(backend.patch(f"/api/v1/ai/conversations/{cid}",headers=owner,json={"title":"Renamed isolated review"}))
                checked(backend.delete(f"/api/v1/ai/conversations/{cid}",headers=owner))
                assert backend.get(f"/api/v1/ai/conversations/{cid}",headers=owner).status_code==404
                results["rename_delete_reload"]="passed"
                general=checked(backend.post("/api/v1/ai/conversations",headers=owner,json={"workspace_id":workspace,"title":"General isolated review"}))
                linked=checked(backend.post("/api/v1/ai/conversations",headers=owner,json={"workspace_id":workspace,"title":"Source isolated review","context":context}))
                assert general["expires_at"] and linked["expires_at"]<=general["expires_at"]
                results["expiry_cap"]="passed"
                paths=[row["object_path"] for row in checked(remote.get("/rest/v1/snapshot_files",headers=admin,params={"select":"object_path","object_path":"like."+workspace+"/"+scan_id+"/*"})) if row.get("object_path")]
                stage="isolated scan deletion cascade"
                removed=checked(remote.delete("/rest/v1/scans",headers={"apikey":public,**owner,"Prefer":"return=representation"},params={"id":"eq."+scan_id,"workspace_id":"eq."+workspace,"status":"eq.completed"}))
                assert len(removed)==1
                assert backend.get(f"/api/v1/ai/conversations/{linked['id']}",headers=owner).status_code==404
                checked(backend.get(f"/api/v1/ai/conversations/{general['id']}",headers=owner))
                results["scan_delete_cascade"]="passed"
            print(json.dumps(results))
        except Exception as error:
            print(json.dumps({**results,"failed_stage":stage,"error_type":type(error).__name__}))
            raise SystemExit(1) from None
        finally:
            failed=False
            if workspace:
                rows=remote.get("/rest/v1/snapshot_files",headers=admin,params={"select":"object_path","object_path":"like."+workspace+"/*"})
                if rows.is_success: paths.extend(row["object_path"] for row in rows.json() if row.get("object_path"))
                failed |= not remote.delete("/rest/v1/workspaces",headers=admin,params={"id":"eq."+workspace,"name":"eq."+marker}).is_success
                for path in set(paths):
                    if not path.startswith(workspace+"/"): raise RuntimeError("Unexpected fixture source path")
                    failed |= not remote.request("DELETE","/storage/v1/object/audit-source",headers=admin,json={"prefixes":[path]}).is_success
            for account_id in accounts:
                failed |= not remote.delete("/auth/v1/admin/users/"+account_id,headers=admin).is_success
            if failed: raise SystemExit("Isolated fixture cleanup needs attention; credentials were not logged.")


if __name__=="__main__":
    main()
