from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.scan import ScanType, SourceType
from app.models.scan_artifact import ArtifactKind
from app.schemas.scan import ScanCreate, ScanStartRequest


def _base_upload() -> dict[str, object]:
    return {
        "workspace_id": uuid4(),
        "scan_type": ScanType.CODEBASE,
        "source_type": SourceType.UPLOAD,
        "target_name": "payments-api",
        "frameworks": ["soc2"],
        "filename": "source.zip",
        "content_type": "application/zip",
        "byte_size": 1024,
        "artifact_kind": ArtifactKind.SOURCE_ZIP,
    }


def test_upload_contract_requires_all_metadata_and_forbids_git_url() -> None:
    values = _base_upload()
    values.pop("filename")
    with pytest.raises(ValidationError, match="filename"):
        ScanCreate.model_validate(values)

    values = _base_upload()
    values["git_url"] = "https://github.com/example/repo.git"
    with pytest.raises(ValidationError, match="must not include git_url"):
        ScanCreate.model_validate(values)


def test_git_contract_forbids_upload_metadata_and_non_https_urls() -> None:
    values = _base_upload()
    values["source_type"] = SourceType.GIT
    values["git_url"] = "https://github.com/example/repo.git"
    with pytest.raises(ValidationError, match="upload metadata"):
        ScanCreate.model_validate(values)

    for key in ("filename", "content_type", "byte_size", "artifact_kind"):
        values.pop(key)
    values["git_url"] = "http://github.com/example/repo.git"
    with pytest.raises(ValidationError, match="HTTPS"):
        ScanCreate.model_validate(values)


def test_frameworks_are_supported_unique_and_bounded() -> None:
    values = _base_upload()
    values["frameworks"] = ["soc2", "soc2"]
    with pytest.raises(ValidationError, match="unique"):
        ScanCreate.model_validate(values)

    values["frameworks"] = ["hipaa"]
    with pytest.raises(ValidationError, match="Unsupported"):
        ScanCreate.model_validate(values)

    values["frameworks"] = []
    with pytest.raises(ValidationError):
        ScanCreate.model_validate(values)


def test_artifact_kind_mime_and_extension_must_match_scan_type() -> None:
    values = _base_upload()
    values["artifact_kind"] = ArtifactKind.LOG_BUNDLE
    with pytest.raises(ValidationError, match="Artifact kind"):
        ScanCreate.model_validate(values)

    values = _base_upload()
    values["content_type"] = "text/plain"
    with pytest.raises(ValidationError, match="Content type"):
        ScanCreate.model_validate(values)

    values = _base_upload()
    values["filename"] = "source.txt"
    with pytest.raises(ValidationError, match="extension"):
        ScanCreate.model_validate(values)


def test_start_request_normalizes_sha256() -> None:
    request = ScanStartRequest(artifact_id=uuid4(), sha256="A" * 64)
    assert request.sha256 == "a" * 64
