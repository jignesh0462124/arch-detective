from functools import lru_cache
from typing import Any

from app.config import Settings, settings


class StorageConfigurationError(RuntimeError):
    pass


class StorageOperationError(RuntimeError):
    def __init__(self, operation: str, cause: Exception) -> None:
        super().__init__(f"Supabase Storage {operation} failed")
        raw_status = getattr(cause, "status", None) or getattr(
            cause,
            "status_code",
            None,
        )
        try:
            self.status_code = int(raw_status) if raw_status is not None else None
        except (TypeError, ValueError):
            self.status_code = None


@lru_cache
def _create_supabase_client(url: str, service_role_key: str) -> Any:
    from supabase import create_client

    return create_client(url, service_role_key)


class SupabaseStorage:
    def __init__(self, config: Settings = settings) -> None:
        if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
            raise StorageConfigurationError("Supabase server Storage credentials are not configured")
        self._settings = config
        try:
            self._client = _create_supabase_client(
                config.SUPABASE_URL,
                config.SUPABASE_SERVICE_ROLE_KEY,
            )
        except Exception as exc:
            raise StorageConfigurationError("Unable to initialize Supabase Storage") from exc

    def upload(
        self,
        bucket: str,
        object_path: str,
        content: bytes,
        content_type: str,
        *,
        upsert: bool = False,
    ) -> None:
        try:
            self._client.storage.from_(bucket).upload(
                path=object_path,
                file=content,
                file_options={"content-type": content_type, "upsert": str(upsert).lower()},
            )
        except Exception as exc:
            raise StorageOperationError("upload", exc) from exc

    def download(self, bucket: str, object_path: str) -> bytes:
        try:
            return self._client.storage.from_(bucket).download(object_path)
        except Exception as exc:
            raise StorageOperationError("download", exc) from exc

    def create_signed_download_url(
        self,
        bucket: str,
        object_path: str,
        expires_in: int | None = None,
    ) -> str:
        ttl = expires_in or self._settings.SIGNED_URL_TTL_SECONDS
        try:
            response = self._client.storage.from_(bucket).create_signed_url(object_path, ttl)
        except Exception as exc:
            raise StorageOperationError("signed URL creation", exc) from exc
        url = response.get("signedURL") or response.get("signedUrl")
        if not isinstance(url, str) or not url:
            raise RuntimeError("Supabase Storage did not return a signed URL")
        return url

    def remove(self, bucket: str, object_path: str) -> None:
        try:
            self._client.storage.from_(bucket).remove([object_path])
        except Exception as exc:
            raise StorageOperationError("remove", exc) from exc
