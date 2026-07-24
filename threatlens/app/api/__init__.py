from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.frameworks import router as frameworks_router
from app.api.scans import router as scans_router


api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(frameworks_router)
api_router.include_router(scans_router)

__all__ = ["api_router"]
