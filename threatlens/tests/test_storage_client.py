import pytest

from app.storage.client import StorageOperationError, SupabaseStorage
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
