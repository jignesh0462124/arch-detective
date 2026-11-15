from fastapi import APIRouter
from app.api.github_review import router as github_review_router
from app.api.extension_reviews import router as extension_reviews_router

from app.api.audit_events import router as audit_events_router
from app.api.ai_chat import router as ai_chat_router
from app.api.audit_workbench import router as audit_workbench_router
from app.api.auth import router as auth_router
from app.api.export import router as export_router
from app.api.frameworks import router as frameworks_router
from app.api.reports import router as reports_router
from app.api.report_library import router as report_library_router
from app.api.scans import router as scans_router
from app.api.workspaces import router as workspaces_router
from app.api.ws import router as ws_router


api_router = APIRouter(prefix="/api/v1")
api_router.include_router(github_review_router)
api_router.include_router(extension_reviews_router)
api_router.include_router(auth_router)
api_router.include_router(ai_chat_router)
api_router.include_router(audit_workbench_router)
api_router.include_router(report_library_router)
api_router.include_router(frameworks_router)
api_router.include_router(scans_router)
api_router.include_router(reports_router)
api_router.include_router(export_router)
api_router.include_router(workspaces_router)
api_router.include_router(audit_events_router)
api_router.include_router(ws_router)

__all__ = ["api_router"]
