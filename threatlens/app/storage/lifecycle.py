from app.storage.client import StorageOperationError, SupabaseStorage


def delete_object_if_present(
    storage: SupabaseStorage,
    bucket: str,
    object_path: str,
) -> bool:
    try:
        storage.remove(bucket, object_path)
    except StorageOperationError as exc:
        if exc.status_code == 404:
            return False
        raise
    return True
