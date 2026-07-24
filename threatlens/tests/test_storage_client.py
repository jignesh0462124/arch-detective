import pytest

from app.storage.client import StorageObjectInfo, StorageOperationError, SupabaseStorage
from app.storage.lifecycle import delete_object_if_present


class _NotFoundError(Exception):
    status_code = 404


class _FailingBucket:
    def remove(self, paths: list[str]) -> None:
        raise _NotFoundError(paths[0])


class _FakeStorage:
    def from_(self, bucket: str) -> _FailingBucket:
        return _FailingBucket()


class _FakeClient:
    storage = _FakeStorage()


def _failing_storage() -> SupabaseStorage:
    storage = object.__new__(SupabaseStorage)
    storage._client = _FakeClient()
    return storage


def test_storage_errors_preserve_status_without_leaking_provider_details() -> None:
    with pytest.raises(StorageOperationError) as error:
        _failing_storage().remove("scan-inputs", "workspace/scan/file.zip")

    assert error.value.status_code == 404
    assert str(error.value) == "Supabase Storage remove failed"


def test_delete_object_is_idempotent_for_missing_objects() -> None:
    assert (
        delete_object_if_present(
            _failing_storage(),
            "scan-inputs",
            "workspace/scan/file.zip",
        )
        is False
    )


class _InfoBucket:
    def info(self, _path: str) -> dict[str, object]:
        return {
            "metadata": {
                "size": "128",
                "mimetype": "application/zip",
            }
        }


class _InfoStorage:
    def from_(self, _bucket: str) -> _InfoBucket:
        return _InfoBucket()


class _InfoClient:
    storage = _InfoStorage()


def test_object_info_normalizes_supabase_metadata() -> None:
    storage = object.__new__(SupabaseStorage)
    storage._client = _InfoClient()

    assert storage.get_object_info("scan-inputs", "workspace/scan/source.zip") == (
        StorageObjectInfo(size=128, content_type="application/zip")
    )


class _ListBucket:
    def list(self, *, path: str) -> list[dict[str, object]]:
        assert path == "workspace/scan"
        return [
            {
                "name": "source.zip",
                "metadata": {"size": 16, "mimetype": "application/zip"},
            }
        ]


class _ListStorage:
    def from_(self, _bucket: str) -> _ListBucket:
        return _ListBucket()


class _ListClient:
    storage = _ListStorage()


def test_object_info_uses_storage_list_when_info_is_unavailable() -> None:
    storage = object.__new__(SupabaseStorage)
    storage._client = _ListClient()

    assert storage.get_object_info("scan-inputs", "workspace/scan/source.zip") == (
        StorageObjectInfo(size=16, content_type="application/zip")
    )
