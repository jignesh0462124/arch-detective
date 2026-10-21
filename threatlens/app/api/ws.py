"""WebSocket endpoint for real-time scan progress streaming."""
from __future__ import annotations

import asyncio
import uuid
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.auth.jwt_verifier import AuthTokenError, SupabaseJWTVerifier
from app.auth.permissions import get_workspace_role
from app.database import AsyncSessionLocal
from app.models.scan import Scan, ScanStatus

router = APIRouter(prefix="/ws", tags=["websocket"])

_HANDSHAKE_TIMEOUT = 5.0  # seconds to receive the auth message
_POLL_INTERVAL = 2.0       # seconds between progress pushes
_TERMINAL_STATUSES = {ScanStatus.COMPLETED, ScanStatus.FAILED, ScanStatus.CANCELLED}


async def _verify_and_authorize(
    token: str,
    scan_id: UUID,
) -> bool:
    """Return True if the token is valid and the user is a workspace member."""
    verifier = SupabaseJWTVerifier()
    try:
        user = await verifier.verify(token)
    except AuthTokenError:
        return False

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Scan).where(Scan.id == scan_id))
        scan = result.scalar_one_or_none()
        if scan is None:
            return False
        role = await get_workspace_role(db, scan.workspace_id, user.id)
        return role is not None


async def _get_scan_state(scan_id: UUID) -> dict | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Scan).where(Scan.id == scan_id))
        scan = result.scalar_one_or_none()
        if scan is None:
            return None
        return {
            "type": "progress",
            "scan_id": str(scan.id),
            "status": scan.status,
            "progress": scan.progress,
            "finding_count": scan.finding_count,
            "current_phase": _phase_label(scan.progress),
            "error_code": scan.error_code,
            "error_message": scan.error_message,
        }


def _phase_label(progress: int) -> str:
    if progress < 5:
        return "Initializing"
    if progress < 15:
        return "Extracting source"
    if progress < 30:
        return "Semgrep analysis"
    if progress < 40:
        return "Bandit analysis"
    if progress < 50:
        return "Secret detection"
    if progress < 70:
        return "LLM deep review"
    if progress < 75:
        return "Deduplicating findings"
    if progress < 95:
        return "Compliance mapping"
    return "Finalizing"


@router.websocket("/scans/{scan_id}")
async def scan_progress_ws(websocket: WebSocket, scan_id: UUID) -> None:
    """
    Real-time scan progress stream.

    Protocol:
    1. Accept connection.
    2. Wait up to 5s for: {"type": "authenticate", "access_token": "<token>"}
    3. Verify JWT and workspace membership.
    4. Stream {"type": "progress", ...} every 2s until terminal status.
    5. Close with appropriate code.
    """
    await websocket.accept()

    # ── 1. Handshake ──────────────────────────────────────────────────────────
    try:
        raw = await asyncio.wait_for(websocket.receive_json(), timeout=_HANDSHAKE_TIMEOUT)
    except (asyncio.TimeoutError, WebSocketDisconnect):
        await websocket.close(code=4001, reason="Authentication timeout")
        return

    if not isinstance(raw, dict) or raw.get("type") != "authenticate":
        await websocket.close(code=4001, reason="Expected authenticate message")
        return

    token = raw.get("access_token", "")
    if not isinstance(token, str) or not token:
        await websocket.close(code=4001, reason="Missing access_token")
        return

    authorized = await _verify_and_authorize(token, scan_id)
    if not authorized:
        await websocket.close(code=4003, reason="Unauthorized")
        return

    # ── 2. Stream progress ────────────────────────────────────────────────────
    try:
        while True:
            state = await _get_scan_state(scan_id)
            if state is None:
                await websocket.send_json({"type": "error", "detail": "Scan not found"})
                await websocket.close(code=4004, reason="Scan not found")
                return

            await websocket.send_json(state)

            # scan.status is a ScanStatus enum (not str) — normalize before compare
            # or the terminal check is always False and the socket never closes.
            status_value = state["status"].value if isinstance(state["status"], ScanStatus) else state["status"]
            if status_value in {s.value for s in _TERMINAL_STATUSES}:
                await websocket.close(code=1000, reason="Scan complete")
                return

            await asyncio.sleep(_POLL_INTERVAL)

    except WebSocketDisconnect:
        pass  # Client disconnected — normal teardown
