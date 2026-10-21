"""Supabase REST adapter. User authorization uses the caller JWT; writes stay server-only."""
from __future__ import annotations

from urllib.parse import quote
from contextlib import asynccontextmanager
import asyncio

import httpx
from fastapi import HTTPException

from app.config import settings

_client: httpx.AsyncClient | None = None
_upload_slots: asyncio.Semaphore | None = None


async def open_workbench_connections():
    global _client, _upload_slots
    _client = httpx.AsyncClient(timeout=30, follow_redirects=False,
        limits=httpx.Limits(max_connections=32, max_keepalive_connections=16))
    _upload_slots = asyncio.Semaphore(16)


async def close_workbench_connections():
    global _client, _upload_slots
    if _client:
        await _client.aclose()
    _client = None
    _upload_slots = None


@asynccontextmanager
async def connection():
    if _client is not None:
        yield _client
    else:
        # Isolated scripts/tests have no application lifespan.
        async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
            yield client


@asynccontextmanager
async def upload_slot():
    if _upload_slots is not None:
        async with _upload_slots:
            yield
    else:
        yield


class WorkbenchStore:
    def __init__(self):
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise HTTPException(503, "Source storage is not configured")
        self.url = settings.SUPABASE_URL.rstrip("/")
        self.key = settings.SUPABASE_SERVICE_ROLE_KEY

    async def rest(self, method: str, table: str, *, params=None, body=None, token=None, prefer="return=representation"):
        headers = {"apikey": self.key, "Authorization": f"Bearer {token or self.key}", "Prefer": prefer}
        async with connection() as client:
            response = await client.request(method, f"{self.url}/rest/v1/{table}", headers=headers, params=params, json=body)
        if not response.is_success:
            # Never expose provider errors, keys, SQL details or user/source data.
            raise HTTPException(503, "Audit persistence is temporarily unavailable")
        return response.json() if response.content else None

    async def page(self, table: str, *, offset=0, limit=200, token=None, **filters):
        headers = {"apikey": self.key, "Authorization": f"Bearer {token or self.key}", "Prefer": "count=exact"}
        async with connection() as client:
            response = await client.get(f"{self.url}/rest/v1/{table}", headers=headers,
                params={**filters, "offset": offset, "limit": limit})
        if not response.is_success:
            raise HTTPException(503, "Audit persistence is temporarily unavailable")
        total = response.headers.get("content-range", "*/0").rsplit("/", 1)[-1]
        return {"items": response.json(), "total": int(total) if total.isdigit() else offset + len(response.json()), "offset": offset, "limit": limit}

    async def rows(self, table: str, **filters):
        rows = []
        maximum = min(int(filters.pop("limit", 20000)), 20000)
        for offset in range(0, maximum, 1000):
            page_size = min(1000, maximum - offset)
            page = await self.rest("GET", table, params={**filters, "limit": page_size, "offset": offset})
            rows.extend(page)
            if len(page) < page_size or maximum < 20000 and len(rows) >= maximum:
                return rows
        raise HTTPException(413, "Audit exceeds the review response limit")

    async def role(self, workspace_id: str, token: str):
        return await self.rest("POST", "rpc/workspace_user_role", body={"p_workspace_id": workspace_id}, token=token)

    async def authorize(self, scan_id: str, token: str, workspace_id: str | None = None):
        rows = await self.rest("GET", "scans", params={"id": f"eq.{scan_id}", "limit": 1}, token=token)
        if not rows or (workspace_id and rows[0]["workspace_id"] != workspace_id):
            raise HTTPException(404, "Scan not found")
        return rows[0]

    async def snapshot(self, scan_id: str):
        rows = await self.rows("source_snapshots", scan_id=f"eq.{scan_id}")
        return rows[0] if rows else None

    async def upload_text(self, object_path: str, text: str):
        content = text.encode("utf-8")
        if len(content) > 2097152:
            raise HTTPException(413, "Source preview exceeds the file limit")
        async with upload_slot(), connection() as client:
            response = await client.post(f"{self.url}/storage/v1/object/{settings.SUPABASE_SOURCE_BUCKET}/{quote(object_path, safe='/')}", headers={"apikey": self.key, "Authorization": f"Bearer {self.key}", "Content-Type": "text/plain", "x-upsert": "false"}, content=content)
        if not response.is_success:
            raise HTTPException(503, "Source preview could not be saved")

    async def read_text(self, object_path: str):
        content = bytearray()
        async with connection() as client:
            async with client.stream("GET", f"{self.url}/storage/v1/object/{settings.SUPABASE_SOURCE_BUCKET}/{quote(object_path, safe='/')}", headers={"apikey": self.key, "Authorization": f"Bearer {self.key}"}, timeout=20) as response:
                if response.status_code == 404:
                    raise HTTPException(410, "Source preview is no longer available")
                if not response.is_success:
                    raise HTTPException(503, "Source preview is temporarily unavailable")
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > 2097152:
                        raise HTTPException(413, "Source preview exceeds the file limit")
        return content.decode("utf-8")

    async def remove_text(self, object_path: str):
        async with connection() as client:
            response = await client.request("DELETE", f"{self.url}/storage/v1/object/{settings.SUPABASE_SOURCE_BUCKET}", headers={"apikey": self.key, "Authorization": f"Bearer {self.key}"}, json={"prefixes": [object_path]}, timeout=20)
        if not response.is_success and response.status_code != 404:
            raise HTTPException(503, "Source cleanup will be retried")
