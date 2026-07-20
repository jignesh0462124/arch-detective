from fastapi import APIRouter

from app.api.frameworks import router as frameworks_router


api_router = APIRouter(prefix="/api/v1")
api_router.include_router(frameworks_router)

__all__ = ["api_router"]
