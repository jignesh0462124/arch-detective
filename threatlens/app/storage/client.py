import hashlib
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

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
        response = getattr(cause, "response", None)
        if raw_status is None and response is not None:
            raw_status = getattr(response, "status_code", None)
        try:
            self.status_code = int(raw_status) if raw_status is not None else None
        except (TypeError, ValueError):
            self.status_code = None


class StorageSizeLimitError(RuntimeError):
    """Raised when a streamed object exceeds the caller's byte limit."""


@dataclass(frozen=True, slots=True)
class StorageObjectInfo:
    size: int
    content_type: str


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
        except Exception:
            raise StorageConfigurationError("Unable to initialize Supabase Storage") from None

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
            raise StorageOperationError("upload", exc) from None

    def download(self, bucket: str, object_path: str) -> bytes:
        try:
            return self._client.storage.from_(bucket).download(object_path)
        except Exception as exc:
            raise StorageOperationError("download", exc) from None

    def get_object_info(self, bucket: str, object_path: str) -> StorageObjectInfo:
        bucket_api = self._client.storage.from_(bucket)
        try:
            info_method = getattr(bucket_api, "info", None)
            if callable(info_method):
                response = info_method(object_path)
            else:
                parent, separator, filename = object_path.rpartition("/")
                entries = bucket_api.list(path=parent if separator else "")
                response = next(
                    (
                        entry
                        for entry in entries
                        if isinstance(entry, dict) and entry.get("name") == filename
                    ),
                    None,
                )
                if response is None:
                    raise FileNotFoundError("Storage object was not found")
        except FileNotFoundError as exc:
            error = StorageOperationError("object info", exc)
            error.status_code = 404
            raise error from None
        except Exception as exc:
            raise StorageOperationError("object info", exc) from None

        metadata = response.get("metadata", {}) if isinstance(response, dict) else {}
        raw_size = response.get("size") if isinstance(response, dict) else None
        if raw_size is None and isinstance(metadata, dict):
            raw_size = metadata.get("size") or metadata.get("contentLength")
        raw_content_type = None
        if isinstance(response, dict):
            raw_content_type = response.get("content_type") or response.get("contentType")
        if raw_content_type is None and isinstance(metadata, dict):
            raw_content_type = (
                metadata.get("mimetype")
                or metadata.get("content-type")
                or metadata.get("contentType")
            )
        try:
            size = int(raw_size)
        except (TypeError, ValueError) as exc:
            raise StorageOperationError("object info", exc) from exc
        if size < 0:
            raise StorageOperationError("object info", ValueError("negative object size"))
        if not isinstance(raw_content_type, str) or not raw_content_type:
            raise StorageOperationError(
                "object info",
                ValueError("Storage object has no content type"),
            )
        return StorageObjectInfo(size=size, content_type=raw_content_type)

    def exists(self, bucket: str, object_path: str) -> bool:
        try:
            self.get_object_info(bucket, object_path)
        except StorageOperationError as exc:
            if exc.status_code == 404:
                return False
            raise
        return True

    def download_to_path_and_hash(
        self,
        bucket: str,
        object_path: str,
        destination: str,
        *,
        maximum_bytes: int,
    ) -> tuple[int, str]:
        destination_path = Path(destination)
        digest = hashlib.sha256()
        written = 0
        object_url = (
            f"{self._settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/"
            f"{quote(bucket, safe='')}/{quote(object_path, safe='/')}"
        )
        try:
            with httpx.stream(
                "GET",
                object_url,
                headers={
                    "Authorization": f"Bearer {self._settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "apikey": self._settings.SUPABASE_SERVICE_ROLE_KEY,
                },
                follow_redirects=False,
                timeout=httpx.Timeout(60.0, connect=10.0),
            ) as response:
                raw_content_length = response.headers.get("content-length")
                if raw_content_length is not None:
                    try:
                        if int(raw_content_length) > maximum_bytes:
                            raise StorageSizeLimitError(
                                "Storage object exceeds the configured size limit"
                            )
                    except ValueError:
                        pass
                response.raise_for_status()
                with destination_path.open("wb") as output:
                    for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                        written += len(chunk)
                        if written > maximum_bytes:
                            raise StorageSizeLimitError(
                                "Storage object exceeds the configured size limit"
                            )
                        digest.update(chunk)
                        output.write(chunk)
        except Exception as exc:
            destination_path.unlink(missing_ok=True)
            if isinstance(exc, StorageSizeLimitError):
                raise
            if isinstance(exc, StorageOperationError):
                raise
            raise StorageOperationError("streamed download", exc) from None
        return written, digest.hexdigest()

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
            raise StorageOperationError("signed URL creation", exc) from None
        url = response.get("signedURL") or response.get("signedUrl")
        if not isinstance(url, str) or not url:
            raise RuntimeError("Supabase Storage did not return a signed URL")
        if url.startswith("/"):
            return f"{self._settings.SUPABASE_URL.rstrip('/')}{url}"
        return url

    def remove(self, bucket: str, object_path: str) -> None:
        try:
            self._client.storage.from_(bucket).remove([object_path])
        except Exception as exc:
            raise StorageOperationError("remove", exc) from None
