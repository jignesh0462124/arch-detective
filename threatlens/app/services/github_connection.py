"""Server-only GitHub transport and encrypted short-lived credentials."""
from __future__ import annotations
import base64
import hashlib
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from app.config import settings
from app.storage.workbench_store import WorkbenchStore, connection

def clock():
    return datetime.now(timezone.utc)

def cipher():
    try:
        return Fernet(settings.GITHUB_TOKEN_ENCRYPTION_KEY.encode())
    except (ValueError, TypeError):
        raise HTTPException(503, "GitHub encryption is not configured")

def configured():
    return bool(settings.GITHUB_ENABLED and settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET and settings.GITHUB_TOKEN_ENCRYPTION_KEY)

async def save_secret(key, data, owner=None, workspace=None, proposal=None, snapshot=None, expires=None):
    await WorkbenchStore().rest("POST", "github_private_records", params={"on_conflict": "id"}, body={
        "id": key, "owner_id": owner, "workspace_id": workspace, "proposal_id": proposal,
        "snapshot_id": snapshot,
        "ciphertext": cipher().encrypt(json.dumps(data).encode()).decode(),
        "expires_at": (expires or clock() + timedelta(minutes=10)).isoformat(),
    }, prefer="resolution=merge-duplicates,return=representation")

async def load_secret(key, consume=False):
    rows = await WorkbenchStore().rest("DELETE" if consume else "GET", "github_private_records", params={"id": f"eq.{key}", "expires_at": f"gt.{clock().isoformat()}"})
    if not rows:
        raise HTTPException(410, "GitHub connection or source has expired. Reconnect or rescan.")
    try:
        return json.loads(cipher().decrypt(rows[0]["ciphertext"].encode()))
    except (InvalidToken, ValueError):
        raise HTTPException(503, "GitHub credentials cannot be opened")

async def exchange(fields):
    try:
        async with connection() as client:
            response = await client.post("https://github.com/login/oauth/access_token", headers={"Accept": "application/json"}, data={"client_id": settings.GITHUB_CLIENT_ID, "client_secret": settings.GITHUB_CLIENT_SECRET, **fields})
    except httpx.HTTPError:
        raise HTTPException(503, "GitHub authorization is temporarily unavailable")
    if not response.is_success or response.json().get("error") or not response.json().get("access_token"):
        raise HTTPException(401, "GitHub authorization failed. Reconnect GitHub.")
    return response.json()

async def user_token(user_id):
    data = await load_secret(f"user:{user_id}")
    if data["token_expires"] <= clock().timestamp() + 60:
        # Serialize refreshes in this process; rotated refresh tokens are persisted before use.
        import asyncio
        lock = _refresh_locks.setdefault(str(user_id), asyncio.Lock())
        async with lock:
            data = await load_secret(f"user:{user_id}")
            if data["token_expires"] <= clock().timestamp() + 60:
                if not data.get("refresh_token"):
                    raise HTTPException(403, "Reconnect GitHub to renew repository access")
                import uuid
                lease = str(uuid.uuid4())
                store = WorkbenchStore()
                claimed = await store.rest("PATCH", "github_private_records", params={"id": f"eq.user:{user_id}", "or": f"(refresh_lease_until.is.null,refresh_lease_until.lt.{clock().isoformat()})"}, body={"refresh_lease": lease, "refresh_lease_until": (clock()+timedelta(minutes=2)).isoformat()})
                if not claimed:
                    raise HTTPException(503, "GitHub access is being renewed. Retry shortly.")
                try:
                    data = await load_secret(f"user:{user_id}")
                    if data["token_expires"] <= clock().timestamp() + 60:
                        updated = await exchange({"grant_type": "refresh_token", "refresh_token": data["refresh_token"]})
                        data.update(updated, token_expires=clock().timestamp()+updated.get("expires_in", 28800))
                        # A concurrent disconnect must not recreate personal authorization.
                        changed = await store.rest("PATCH", "github_private_records", params={"id": f"eq.user:{user_id}", "refresh_lease": f"eq.{lease}"}, body={"ciphertext": cipher().encrypt(json.dumps(data).encode()).decode(), "expires_at": (clock()+timedelta(days=180)).isoformat()})
                        if not changed:
                            raise HTTPException(403, "GitHub was disconnected. Connect again to continue.")
                finally:
                    await store.rest("PATCH", "github_private_records", params={"id": f"eq.user:{user_id}", "refresh_lease": f"eq.{lease}"}, body={"refresh_lease": None, "refresh_lease_until": None})
    return data["access_token"]

_refresh_locks = {}

async def github(token, method, path, body=None):
    if not path.startswith("/") or path.startswith("//"):
        raise HTTPException(422, "Invalid GitHub request")
    async with connection() as client:
        try:
            response = await client.request(method, "https://api.github.com"+path,
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}, json=body)
        except httpx.HTTPError:
            raise HTTPException(503, "GitHub is temporarily unavailable")
    if response.status_code == 204:
        return None
    if response.status_code == 401:
        raise HTTPException(403, "Reconnect GitHub to continue")
    if response.status_code in (403, 429):
        raise HTTPException(403 if response.status_code == 403 else 429, "GitHub denied access or rate limited this operation. Check access and retry later.")
    if response.status_code == 404:
        raise HTTPException(404, "Repository or GitHub resource is unavailable")
    if not response.is_success:
        raise HTTPException(409, "GitHub rejected this operation. Refresh its state before retrying.")
    return response.json()

async def repo_access(token, repo_id, write=False):
    repo = await github(token, "GET", f"/repositories/{int(repo_id)}")
    if repo.get("archived") or repo.get("disabled") or (write and not repo.get("permissions", {}).get("push")):
        raise HTTPException(403, "This repository is read-only or you do not have write access")
    return repo

async def original_file(token, repo, sha, path):
    from app.services.reviewed_fixes import safe_path
    if not safe_path(path):
        raise HTTPException(422, "This file is not eligible for a code fix")
    parent = await github(token, "GET", f"/repos/{repo}/git/commits/{sha}")
    tree = await github(token, "GET", f"/repos/{repo}/git/trees/{parent['tree']['sha']}?recursive=1")
    entry = next((item for item in tree.get("tree", []) if item.get("path") == path), None)
    if tree.get("truncated") or not entry or entry.get("mode") not in {"100644", "100755"} or entry.get("type") != "blob":
        raise HTTPException(422, "Symlinks, submodules and unverified file modes cannot be changed")
    item = await github(token, "GET", f"/repos/{repo}/contents/{quote(path, safe='/')}?ref={quote(sha, safe='')}")
    if not isinstance(item, dict) or item.get("type") != "file" or item.get("size", 0) > 2*1024*1024 or item.get("encoding") != "base64":
        raise HTTPException(422, "Only existing UTF-8 text files can be changed")
    try:
        raw = base64.b64decode(item["content"])
        if len(raw) > 2*1024*1024:
            raise ValueError()
        text = raw.decode("utf-8")
    except (ValueError, UnicodeError):
        raise HTTPException(422, "This file is not supported text")
    if "\x00" in text:
        raise HTTPException(422, "Binary files cannot be changed")
    return text


async def cleanup_private_records(repository):
    """Enforce expiry physically as well as at every read; never delete GitHub history."""
    await repository.rest("DELETE", "github_private_records", params={"expires_at": f"lte.{clock().isoformat()}"}, prefer="return=minimal")
    for snapshot in await repository.rows("source_snapshots", state="in.(failed,expired)", select="scan_id"):
        proposals = await repository.rows("fix_proposals", scan_id=f"eq.{snapshot['scan_id']}", select="id")
        for offset in range(0, len(proposals), 100):
            ids = ",".join(row["id"] for row in proposals[offset:offset+100])
            await repository.rest("DELETE", "github_private_records", params={"proposal_id": f"in.({ids})"}, prefer="return=minimal")
    # Recover interrupted acceptance (scan saved, job not yet claimed).
    pending = await repository.rows("scans", source_type="eq.git", status="eq.running", started_at=f"lt.{(clock()-timedelta(minutes=3)).isoformat()}", select="id")
    for scan in pending:
        jobs = await repository.rest("GET", "audit_workbench_jobs", params={"scan_id": f"eq.{scan['id']}", "select": "scan_id"})
        if not jobs:
            await repository.rest("PATCH", "scans", params={"id": f"eq.{scan['id']}", "status": "eq.running"}, body={"status": "failed", "error_code": "repository_acceptance_interrupted", "error_message": "Repository acceptance was interrupted. Start a new audit."})

async def archive(token, repo, sha):
    from io import BytesIO
    from zipfile import ZipFile, ZIP_DEFLATED
    from app.ingestion.source_snapshot import read_zip_snapshot
    import uuid
    async with connection() as client:
        response = await client.get(f"https://api.github.com/repos/{repo}/zipball/{sha}", headers={"Authorization": f"Bearer {token}"})
        location = response.headers.get("location", "")
        from urllib.parse import urlparse
        parsed = urlparse(location)
        if response.status_code not in (301, 302, 307) or parsed.scheme != "https" or parsed.hostname != "codeload.github.com":
            raise HTTPException(503, "GitHub archive download is unavailable")
        content = bytearray()
        async with client.stream("GET", location, timeout=120) as download:
            if not download.is_success:
                raise HTTPException(503, "GitHub archive download failed")
            async for chunk in download.aiter_bytes():
                content.extend(chunk)
                if len(content) > min(settings.MAX_FILE_SIZE_MB, 50)*1024*1024:
                    raise HTTPException(413, "Repository exceeds the archive limit")
    # Validate before copying/decompressing. Preserve archive metadata (including symlinks).
    try:
        read_zip_snapshot(bytes(content), str(uuid.uuid4()))
        output = BytesIO()
        with ZipFile(BytesIO(content)) as source, ZipFile(output, "w", ZIP_DEFLATED) as target:
            roots = {x.filename.split("/", 1)[0] for x in source.infolist()}
            if len(roots) != 1:
                raise ValueError()
            for entry in source.infolist():
                path = entry.filename.partition("/")[2]
                if path and not entry.is_dir():
                    data = source.read(entry)
                    entry.filename = path
                    target.writestr(entry, data)
        return output.getvalue()
    except (ValueError, OSError):
        raise HTTPException(422, "Repository archive is unsupported or exceeds scan limits")
