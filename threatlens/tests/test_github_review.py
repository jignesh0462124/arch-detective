"""Isolated contracts: no provider, Supabase or real repository writes."""
import copy
import hashlib
import hmac
import json
import uuid
from contextlib import asynccontextmanager
from io import BytesIO
from zipfile import ZipFile
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Response
from starlette.requests import Request

from app.api import github_review as api
from app.services import github_connection as transport
from app.services.reviewed_fixes import source_hash

W, U, P, S, F, I = [uuid.uuid4() for _ in range(6)]
USER = SimpleNamespace(id=U, session_id="fixture-session")
SHA = "a" * 40


@pytest.mark.asyncio
@pytest.mark.parametrize("role,write,admin,allowed", [
    ("viewer", False, False, True), ("viewer", True, False, False),
    ("analyst", True, False, True), ("analyst", False, True, False),
    ("admin", False, True, True), ("owner", True, True, True),
    (None, False, False, False),
])
async def test_workspace_action_roles(monkeypatch, role, write, admin, allowed):
    class Store:
        async def role(self, workspace, token):
            assert workspace == str(W) and token == "signed-in"
            return role
    monkeypatch.setattr(api, "WorkbenchStore", Store)
    if allowed:
        await api.member(W, "signed-in", write=write, admin=admin)
    else:
        with pytest.raises(HTTPException) as error:
            await api.member(W, "signed-in", write=write, admin=admin)
        assert error.value.status_code == 403


def request(body=b"", headers=None):
    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}
    return Request({"type": "http", "method": "POST", "path": "/", "headers": [(k.encode(), v.encode()) for k, v in (headers or {}).items()]}, receive)


@pytest.mark.asyncio
async def test_callback_rejects_missing_browser_binding(monkeypatch):
    with pytest.raises(HTTPException) as error:
        await api.callback(request(), "state", "code")
    assert error.value.status_code == 400


@pytest.mark.asyncio
async def test_complete_rejects_account_or_session_change(monkeypatch):
    async def load(*args, **kwargs):
        return {"user": str(U), "session": "another-browser"}
    monkeypatch.setattr(api, "load_secret", load)
    with pytest.raises(HTTPException) as error:
        await api.complete(api.Ticket(ticket="x"*32), USER, "token")
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_capability_fails_closed_before_migration(monkeypatch):
    monkeypatch.setattr(api, "configured", lambda: True)
    class Store:
        async def rest(self, *args, **kwargs):
            raise HTTPException(503, "missing table")
    monkeypatch.setattr(api, "WorkbenchStore", Store)
    result = await api.capabilities(USER)
    assert not result["enabled"] and not result["publishing"]


@pytest.mark.asyncio
async def test_connect_uses_pkce_and_http_only_state(monkeypatch):
    saved = []
    async def save(key, data, **kwargs): saved.append(data)
    async def member(*args, **kwargs): pass
    monkeypatch.setattr(api, "save_secret", save)
    monkeypatch.setattr(api, "member", member)
    monkeypatch.setattr(api, "configured", lambda: True)
    response = Response()
    result = await api.connect(api.Connect(workspace_id=W), response, USER, "token")
    assert "code_challenge_method=S256" in result["url"]
    assert "HttpOnly" in response.headers["set-cookie"]
    assert saved[0]["user"] == str(U) and saved[0]["session"] == USER.session_id
    assert saved[0]["verifier"] not in result["url"]


@pytest.mark.asyncio
async def test_webhook_unsigned_rejected_and_removal_scoped(monkeypatch):
    monkeypatch.setattr(api.settings, "GITHUB_WEBHOOK_SECRET", "isolated-fixture")
    body = json.dumps({"action": "removed", "installation": {"id": 12}, "repositories_removed": [{"id": 34}]}).encode()
    with pytest.raises(HTTPException) as error:
        await api.webhook(request(body))
    assert error.value.status_code == 403
    writes = []
    class Store:
        async def rest(self, method, table, **kwargs):
            writes.append((method, table, kwargs))
            return []
    monkeypatch.setattr(api, "WorkbenchStore", Store)
    signature = "sha256="+hmac.new(b"isolated-fixture", body, hashlib.sha256).hexdigest()
    result = await api.webhook(request(body, {"x-hub-signature-256": signature, "x-github-delivery": str(uuid.uuid4()), "x-github-event": "installation_repositories"}))
    assert result["received"]
    changed = next(w for w in writes if w[0] == "PATCH")
    assert changed[2]["params"] == {"installation_id": "eq.12", "repository_id": "eq.34"}


@pytest.fixture
def publishing(monkeypatch):
    row = {"id": str(P), "workspace_id": str(W), "scan_id": str(S), "finding_id": str(F), "revision": 1, "status": "proposed", "metadata": {}}
    data = {"diff": "-x = 1\n+x = 2\n", "ref": {"commit_sha": SHA, "branch": "main", "integration_id": str(I)}, "operation": {}}
    remote = {"branches": {}, "prs": [], "commits": 0, "refs": 0, "pulls": 0, "target": SHA, "fail_pr": False, "lost_pr": False}
    repo = {"id": 12, "full_name": "fixture/repo", "owner": {"login": "fixture"}}
    async def member(*args, **kwargs): pass
    async def access(*args): return row, data
    async def patch(*args): return {"app.py": "x = 1\n"}, {"app.py": "x = 2\n"}, "github-user-token", repo
    async def check_access(*args, **kwargs): return repo
    async def save(*args): pass
    @asynccontextmanager
    async def lock(*args): yield
    class Store:
        async def rest(self, *args, **kwargs): return [row]
    async def github(token, method, path, body=None):
        if "/branches/" in path: return {"commit": {"sha": remote["target"]}}
        if method == "GET" and "/git/commits/" in path: return {"tree": {"sha": "tree"}}
        if method == "GET" and "/git/trees/" in path: return {"tree": [{"path": "app.py", "mode": "100644"}]}
        if path.endswith("/git/blobs"): return {"sha": "blob"}
        if path.endswith("/git/trees"): return {"sha": "new-tree"}
        if path.endswith("/git/commits"):
            remote["commits"] += 1
            return {"sha": "b"*40}
        if "/git/ref/heads/" in path:
            if not remote["branches"]: raise HTTPException(404, "missing")
            return {"object": {"sha": "b"*40}}
        if path.endswith("/git/refs"):
            remote["refs"] += 1
            remote["branches"][body["ref"]] = body["sha"]
            return {"object": {"sha": body["sha"]}}
        if "/pulls?" in path: return remote["prs"]
        if path.endswith("/pulls"):
            remote["pulls"] += 1
            if remote["fail_pr"]:
                remote["fail_pr"] = False
                raise HTTPException(503, "fixture outage")
            pr = {"head": {"sha": "b"*40}, "html_url": "https://github.com/fixture/repo/pull/1", "number": 1}
            remote["prs"].append(pr)
            if remote["lost_pr"]:
                remote["lost_pr"] = False
                raise HTTPException(503, "lost response")
            return pr
        raise AssertionError((method, path))
    for name, value in {"member": member, "proposal_access": access, "patch_source": patch, "repo_access": check_access, "save_proposal": save, "publication_lock": lock, "WorkbenchStore": Store, "github": github}.items():
        monkeypatch.setattr(api, name, value)
    monkeypatch.setattr(api.settings, "GITHUB_PUBLISH_ENABLED", True)
    payload = api.Publish(revision=1, reviewed=True, message="Fix fixture", diff_hash=source_hash(data["diff"]))
    return row, data, remote, payload


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["fail_pr", "lost_pr"])
async def test_publish_reconciles_partial_and_lost_responses(publishing, failure):
    row, data, remote, payload = publishing
    remote[failure] = True
    with pytest.raises(HTTPException): await api.publish(P, payload, USER, "jwt")
    result = await api.publish(P, payload, USER, "jwt")
    assert result["number"] == 1
    assert remote["commits"] == remote["refs"] == len(remote["prs"]) == 1
    assert remote["pulls"] == (1 if failure == "lost_pr" else 2)
    await api.publish(P, payload, USER, "jwt")
    assert len(remote["prs"]) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["review", "hash", "revision", "superseded", "moved"])
async def test_publish_rejects_unreviewed_stale_and_moved(publishing, failure):
    row, data, remote, payload = publishing
    if failure == "review": payload.reviewed = False
    if failure == "hash": payload.diff_hash = "wrong"
    if failure == "revision": payload.revision = 2
    if failure == "superseded": row["status"] = "superseded"
    if failure == "moved": remote["target"] = "c"*40
    with pytest.raises(HTTPException) as error: await api.publish(P, payload, USER, "jwt")
    assert error.value.status_code == 409
    assert remote["commits"] == remote["refs"] == remote["pulls"] == 0


@pytest.mark.asyncio
async def test_viewer_cannot_publish(publishing, monkeypatch):
    async def denied(*args, **kwargs): raise HTTPException(403, "viewer")
    monkeypatch.setattr(api, "member", denied)
    with pytest.raises(HTTPException) as error: await api.publish(P, publishing[3], USER, "jwt")
    assert error.value.status_code == 403 and publishing[2]["commits"] == 0


@pytest.mark.asyncio
async def test_expired_patch_preserves_publication_metadata(monkeypatch):
    async def one(*args): return {"metadata": {"publication": {"url": "https://github.com/fixture/repo/pull/1"}}}
    async def expired(*args): raise HTTPException(410, "expired")
    monkeypatch.setattr(api, "one", one)
    monkeypatch.setattr(api, "load_secret", expired)
    result = await api.proposal_detail(P, USER, "jwt")
    assert result["expired"] and result["operation"]["url"].endswith("/1")
    assert "diff" not in result


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["120000", "160000"])
async def test_original_file_rejects_symlink_and_submodule(monkeypatch, mode):
    calls=[]
    async def github(token, method, path, body=None):
        calls.append(path)
        if "/git/commits/" in path: return {"tree":{"sha":"tree"}}
        return {"tree":[{"path":"app.py","type":"blob","mode":mode}]}
    monkeypatch.setattr(transport,"github",github)
    with pytest.raises(HTTPException) as error:
        await transport.original_file("remote-user-token","fixture/repo",SHA,"app.py")
    assert error.value.status_code==422 and len(calls)==2


@pytest.mark.asyncio
@pytest.mark.parametrize("redirect,accepted", [("https://codeload.github.com/fixture/repo/legacy.zip/abc",True),("https://unrelated.invalid/archive",False),("http://codeload.github.com/archive",False)])
async def test_archive_strips_wrapper_without_forwarding_token(monkeypatch,redirect,accepted):
    stream=BytesIO()
    with ZipFile(stream,"w") as archive: archive.writestr("generated-wrapper/src/app.py","print('fixture')\n")
    class Client:
        async def get(self,url,headers):
            assert url.startswith("https://api.github.com/") and headers["Authorization"]=="Bearer remote-token"
            return SimpleNamespace(status_code=302,headers={"location":redirect})
        @asynccontextmanager
        async def stream(self,method,url,**kwargs):
            assert "headers" not in kwargs  # never forward the API Authorization header
            async def chunks(): yield stream.getvalue()
            yield SimpleNamespace(is_success=True,aiter_bytes=chunks)
    @asynccontextmanager
    async def connection(): yield Client()
    monkeypatch.setattr(transport,"connection",connection)
    if accepted:
        content=await transport.archive("remote-token","fixture/repo",SHA)
        with ZipFile(BytesIO(content)) as archive: assert archive.namelist()==["src/app.py"]
    else:
        with pytest.raises(HTTPException) as error: await transport.archive("remote-token","fixture/repo",SHA)
        assert error.value.status_code==503
