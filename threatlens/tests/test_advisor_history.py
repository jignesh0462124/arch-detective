from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from app.services import advisor_history as history
from app.api.ai_chat import cursor_filter, page_result, ChatRequest


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(history.settings, "ADVISOR_HISTORY_ENABLED", True)


@pytest.mark.asyncio
async def test_creation_requires_membership_and_caps_source_expiry(monkeypatch):
    workspace, scan, finding, snapshot, owner = [str(uuid4()) for _ in range(5)]
    expiry = (history.clock()+timedelta(days=2)).isoformat()
    records = []
    class Store:
        async def role(self, *args): return "analyst"
        async def authorize(self, *args): pass
        async def snapshot(self, *args): return {"id":snapshot,"state":"ready","expires_at":expiry}
        async def rest(self, method, table, **kwargs):
            if table == "findings": return [{"id":finding}]
            records.append(kwargs["body"])
            return [kwargs["body"]]
    monkeypatch.setattr(history, "WorkbenchStore", Store)
    context = SimpleNamespace(workspace_id=workspace, scan_id=scan, finding_id=finding)
    item = await history.create(workspace, context, "api_key=secret-test-value", SimpleNamespace(id=owner), "caller-token")
    assert item["owner_user_id"] == owner and item["expires_at"] == expiry and item["snapshot_id"] == snapshot
    assert "secret-test-value" not in item["title"]
    class Denied(Store):
        async def role(self, *args): return None
    monkeypatch.setattr(history, "WorkbenchStore", Denied)
    with pytest.raises(HTTPException) as error:
        await history.create(workspace, None, "Question", SimpleNamespace(id=owner), "token")
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_conversation_read_uses_owner_token_and_denies_missing_or_expired_source():
    owner = SimpleNamespace(id=uuid4())
    identifier = uuid4()
    class Store:
        async def rest(self, method, table, **kwargs):
            assert kwargs["token"] == "caller"
            assert kwargs["params"]["owner_user_id"] == f"eq.{owner.id}"
            return []
    with pytest.raises(HTTPException) as error:
        await history.conversation(identifier, owner, "caller", Store())
    assert error.value.status_code == 404
    class Expired(Store):
        async def rest(self, *args, **kwargs): return [{"scan_id":"scan", "workspace_id":"workspace"}]
        async def authorize(self, *args): pass
        async def snapshot(self, *args): return {"state":"expired", "expires_at":history.clock().isoformat()}
    with pytest.raises(HTTPException) as error:
        await history.conversation(identifier, owner, "caller", Expired())
    assert error.value.status_code == 410


@pytest.mark.asyncio
async def test_submission_reservation_is_deduplicated_and_redacted():
    saved = []
    item = {"id":str(uuid4()),"owner_user_id":str(uuid4())}
    class Store:
        async def rest(self, method, table, **kwargs):
            if method == "GET": return []
            if method == "POST":
                saved.extend(kwargs["body"])
                return kwargs["body"]
            return [item]
    await history.reserve(item, uuid4(), "password=private-value", "glm-5-3-flash", Store())
    assert "private-value" not in saved[0]["content"]
    assert saved[0]["created_at"] < saved[1]["created_at"]
    class Duplicate(Store):
        async def rest(self, *args, **kwargs): return [{"id":"existing"}]
    with pytest.raises(HTTPException) as error:
        await history.reserve(item, uuid4(), "Question", "glm-5-3-flash", Duplicate())
    assert error.value.status_code == 409


def test_history_pagination_validates_cursor_and_keeps_stable_tie_breaker():
    stamp = history.clock().isoformat()
    identifier = str(uuid4())
    params = cursor_filter(f"{stamp}|{identifier}", "updated_at")
    assert f"id.lt.{identifier}" in params["or"]
    with pytest.raises(HTTPException): cursor_filter("untrusted-query-value", "updated_at")
    rows = [{"id":str(uuid4()),"updated_at":stamp} for _ in range(26)]
    page = page_result(rows,25,"updated_at")
    assert len(page["items"]) == 25 and page["next_cursor"].endswith(rows[24]["id"])


def test_saved_chat_requires_submission_and_conversation_identifiers_together():
    with pytest.raises(ValueError):
        ChatRequest(messages=[{"role":"user","content":"Question"}], conversation_id=uuid4())
