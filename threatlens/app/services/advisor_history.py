"""Private, expiring conversations. Reads use the caller's JWT; writes are scoped server-side."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException
from app.config import settings
from app.storage.workbench_store import WorkbenchStore
from app.ingestion.source_snapshot import redact_text


def clock():
    return datetime.now(timezone.utc)


def enabled():
    if not settings.ADVISOR_HISTORY_ENABLED:
        raise HTTPException(503, "Saved conversations are not enabled. Contact the workspace administrator.")


async def conversation(identifier, user, token, store=None):
    enabled()
    store = store or WorkbenchStore()
    rows = await store.rest("GET", "advisor_conversations", params={"id": f"eq.{identifier}", "owner_user_id": f"eq.{user.id}", "expires_at": f"gt.{clock().isoformat()}", "limit": 1}, token=token)
    if not rows:
        raise HTTPException(404, "Conversation expired, was deleted, or is unavailable")
    item = rows[0]
    # A source can be expired early independently of the normal retention date.
    if item.get("scan_id"):
        await store.authorize(item["scan_id"], token, item["workspace_id"])
        snapshot = await store.snapshot(item["scan_id"])
        if not snapshot or snapshot["state"] in ("expired", "failed") or snapshot["expires_at"] <= clock().isoformat():
            raise HTTPException(410, "This conversation's source window has ended. Start a fresh audit.")
    return item


async def create(workspace, context, title, user, token):
    enabled()
    store = WorkbenchStore()
    if not await store.role(str(workspace), token):
        raise HTTPException(403, "Workspace access is required")
    expiry = clock() + timedelta(days=30)
    snapshot = None
    if context:
        if str(context.workspace_id) != str(workspace):
            raise HTTPException(404, "Finding does not belong to this workspace")
        await store.authorize(str(context.scan_id), token, str(workspace))
        table = "extension_policy_results" if getattr(context, "policy_result_id", None) else "findings"
        identifier = context.policy_result_id if table == "extension_policy_results" else context.finding_id
        rows = await store.rest("GET", table, params={"id": f"eq.{identifier}", "scan_id": f"eq.{context.scan_id}", "select": "id", "limit": 1}, token=token)
        if not rows:
            raise HTTPException(404, "Finding not found")
        snapshot = await store.snapshot(str(context.scan_id))
        if not snapshot or snapshot["state"] not in ("ready", "indexing"):
            raise HTTPException(410, "Source preview is unavailable. Rescan before starting a code conversation.")
        expiry = min(expiry, datetime.fromisoformat(snapshot["expires_at"].replace("Z", "+00:00")))
        if expiry <= clock():
            raise HTTPException(410, "Source preview expired. Rescan before starting a code conversation.")
    now = clock().isoformat()
    policy_context = {"policy_result_id": str(context.policy_result_id)} if context and getattr(context, "policy_result_id", None) else {}
    rows = await store.rest("POST", "advisor_conversations", body={"id": str(uuid4()), "owner_user_id": str(user.id), "workspace_id": str(workspace), "scan_id": str(context.scan_id) if context else None, "finding_id": str(context.finding_id) if context and context.finding_id else None, **policy_context, "snapshot_id": snapshot["id"] if snapshot else None, "title": redact_text(title.strip())[:120] or "New conversation", "created_at": now, "updated_at": now, "expires_at": expiry.isoformat()})
    return rows[0]


async def reserve(item, submission, content, model, store):
    rows = await store.rest("GET", "advisor_messages", params={"conversation_id": f"eq.{item['id']}", "submission_id": f"eq.{submission}", "limit": 1})
    if rows:
        raise HTTPException(409, "This message has already been submitted. Reopen the conversation to check its response.")
    # Insert both roles atomically; a unique constraint prevents concurrent duplicate requests.
    now = clock().isoformat()
    messages = [{"id": str(uuid4()), "conversation_id": item["id"], "submission_id": str(submission), "role": role, "content": redact_text(content) if role == "user" else "", "model_id": model if role == "assistant" else None, "status": "completed" if role == "user" else "streaming", "created_at": (datetime.fromisoformat(now)+timedelta(microseconds=index)).isoformat()} for index, role in enumerate(("user", "assistant"))]
    inserted = await store.rest("POST", "advisor_messages", params={"on_conflict": "conversation_id,submission_id,role"}, body=messages, prefer="resolution=ignore-duplicates,return=representation")
    if len(inserted or []) != 2:
        raise HTTPException(409, "This message has already been submitted")
    await store.rest("PATCH", "advisor_conversations", params={"id": f"eq.{item['id']}", "owner_user_id": f"eq.{item['owner_user_id']}"}, body={"updated_at": now})
    return messages[1]["id"]


async def finish(item, message_id, content, status, store):
    rows = await store.rest("PATCH", "advisor_messages", params={"id": f"eq.{message_id}", "conversation_id": f"eq.{item['id']}"}, body={"content": redact_text(content)[:32768], "status": status})
    if not rows:
        raise HTTPException(410, "The conversation was deleted or expired before the response was saved")


async def cleanup(store):
    await store.rest("DELETE", "advisor_conversations", params={"expires_at": f"lte.{clock().isoformat()}"})
    # Old in-flight messages cannot be resumed after a backend restart.
    await store.rest("PATCH", "advisor_messages", params={"status": "eq.streaming", "created_at": f"lt.{(clock()-timedelta(minutes=10)).isoformat()}"}, body={"status": "interrupted"})
