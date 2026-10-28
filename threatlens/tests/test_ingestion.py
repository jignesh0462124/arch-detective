from __future__ import annotations

import socket
import stat
import subprocess
import zipfile
from pathlib import Path

import pytest

from app.config import settings
from app.ingestion.arch_parser import ArchitectureParseError, parse_architecture
from app.ingestion.code_extractor import (
    ArchiveSecurityError,
    GitSecurityError,
    cleanup_temp_directory,
    collect_source_files,
    extract_from_git,
    extract_from_zip,
    validate_public_git_url,
)
from app.ingestion.log_parser import LogParseError, parse_log_file


def _resolver(address: str):
    def resolve(*_args: object, **_kwargs: object) -> list[tuple[object, ...]]:
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))]

    return resolve


def test_zip_extraction_streams_valid_files_and_cleans_up(tmp_path: Path) -> None:
    archive_path = tmp_path / "source.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("src/main.py", "print('safe')")

    extracted = Path(extract_from_zip(str(archive_path)))
    assert (extracted / "src" / "main.py").read_text() == "print('safe')"

    cleanup_temp_directory(str(extracted))
    assert not extracted.exists()


@pytest.mark.parametrize(
    "member_name",
    ("../escape.py", "/absolute.py", "C:\\Windows\\escape.py"),
)
def test_zip_rejects_path_traversal_and_absolute_paths(
    tmp_path: Path,
    member_name: str,
) -> None:
    archive_path = tmp_path / "unsafe.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr(member_name, "unsafe")

    with pytest.raises(ArchiveSecurityError):
        extract_from_zip(str(archive_path))


def test_zip_rejects_symbolic_links(tmp_path: Path) -> None:
    archive_path = tmp_path / "symlink.zip"
    member = zipfile.ZipInfo("src/link")
    member.create_system = 3
    member.external_attr = (stat.S_IFLNK | 0o777) << 16
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr(member, "../secret")

    with pytest.raises(ArchiveSecurityError, match="symbolic"):
        extract_from_zip(str(archive_path))


def test_zip_rejects_encrypted_entries(tmp_path: Path) -> None:
    archive_path = tmp_path / "encrypted.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("source.py", "pass")
    payload = bytearray(archive_path.read_bytes())
    local_header = payload.index(b"PK\x03\x04")
    central_header = payload.index(b"PK\x01\x02")
    payload[local_header + 6] |= 0x01
    payload[central_header + 8] |= 0x01
    archive_path.write_bytes(payload)

    with pytest.raises(ArchiveSecurityError, match="Encrypted"):
        extract_from_zip(str(archive_path))


def test_zip_rejects_high_compression_ratio(tmp_path: Path) -> None:
    archive_path = tmp_path / "bomb.zip"
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("large.txt", "0" * (2 * 1024 * 1024))

    with pytest.raises(ArchiveSecurityError, match="ratio"):
        extract_from_zip(str(archive_path))


def test_zip_rejects_extracted_size_over_limit(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "MAX_EXTRACTED_SIZE_MB", 1)
    archive_path = tmp_path / "oversized.zip"
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr("large.bin", b"x" * (1024 * 1024 + 1))

    with pytest.raises(ArchiveSecurityError, match="extracted-size"):
        extract_from_zip(str(archive_path))


def test_zip_rejects_entry_count_over_limit(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "MAX_SOURCE_FILES", 2)
    archive_path = tmp_path / "many.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        for index in range(3):
            archive.writestr(f"{index}.py", "pass")

    with pytest.raises(ArchiveSecurityError, match="too many"):
        extract_from_zip(str(archive_path))


def test_zip_rejects_duplicate_member_paths(tmp_path: Path) -> None:
    archive_path = tmp_path / "duplicate.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("src/main.py", "first")
        archive.writestr("src/main.py", "second")

    with pytest.raises(ArchiveSecurityError, match="duplicate"):
        extract_from_zip(str(archive_path))


def test_source_collection_skips_vendor_binary_and_unsupported_files(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("print('included')")
    (tmp_path / "src" / "binary.py").write_bytes(b"\x00\x01")
    (tmp_path / "notes.pdf").write_text("unsupported")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "ignored.js").write_text("ignored")

    files = collect_source_files(str(tmp_path))

    assert [item["path"] for item in files] == ["src/main.py"]


def test_cleanup_refuses_unrelated_temp_directories(tmp_path: Path, monkeypatch) -> None:
    # Exercise the unrelated-name guard regardless of pytest's --basetemp.
    monkeypatch.setattr("app.ingestion.code_extractor.tempfile.gettempdir", lambda: str(tmp_path.parent))
    with pytest.raises(ValueError, match="unrelated"):
        cleanup_temp_directory(str(tmp_path))
    assert tmp_path.is_dir()


@pytest.mark.parametrize(
    "url",
    (
        "http://github.com/example/repo.git",
        "https://user:token@github.com/example/repo.git",
        "https://github.com:444/example/repo.git",
        "https://github.com/example/repo.git?token=secret",
    ),
)
def test_git_url_rejects_unsafe_syntax(url: str) -> None:
    with pytest.raises(GitSecurityError):
        validate_public_git_url(url, resolver=_resolver("93.184.216.34"))


@pytest.mark.parametrize(
    "address",
    (
        "127.0.0.1",
        "10.0.0.1",
        "100.64.0.1",
        "169.254.169.254",
        "203.0.113.1",
        "224.0.0.1",
        "0.0.0.0",
    ),
)
def test_git_url_rejects_non_public_dns_results(address: str) -> None:
    with pytest.raises(GitSecurityError, match="non-public"):
        validate_public_git_url(
            "https://example.com/repo.git",
            resolver=_resolver(address),
        )


def test_git_clone_is_shallow_and_disables_redirects(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.ingestion.code_extractor.validate_public_git_url",
        lambda _url: "https://example.com/repo.git",
    )

    def fake_run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        repository = Path(command[-1])
        repository.mkdir(parents=True)
        (repository / "main.py").write_text("pass")
        assert "--depth" in command
        assert kwargs["shell"] is False
        assert kwargs["timeout"] == settings.GIT_CLONE_TIMEOUT_SECONDS
        environment = kwargs["env"]
        assert isinstance(environment, dict)
        assert environment["GIT_CONFIG_VALUE_0"] == "false"
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr("app.ingestion.code_extractor.subprocess.run", fake_run)
    repository = Path(extract_from_git("https://example.com/repo.git"))
    assert (repository / "main.py").exists()
    cleanup_temp_directory(str(repository.parent))


def test_git_clone_timeout_cleans_temporary_directory(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.ingestion.code_extractor.validate_public_git_url",
        lambda _url: "https://example.com/repo.git",
    )
    monkeypatch.setattr(
        "app.ingestion.code_extractor.subprocess.run",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            subprocess.TimeoutExpired(args[0], timeout=kwargs["timeout"])
        ),
    )
    with pytest.raises(GitSecurityError, match="timed out"):
        extract_from_git("https://example.com/repo.git")


def test_architecture_yaml_and_json_are_parsed_without_object_construction() -> None:
    yaml_result = parse_architecture(
        """
services:
  api:
    image: example/api
    ports: ["8080:80"]
    depends_on: [db]
  db:
    image: postgres:15
external_api: https://api.example.com/v1
""",
        "yaml",
    )
    json_result = parse_architecture('{"services":{"cache":{"image":"redis:7"}}}', "json")

    assert yaml_result["exposed_ports"] == [{"service": "api", "port": "8080:80"}]
    assert [item["name"] for item in yaml_result["databases"]] == ["db"]
    assert yaml_result["external_apis"] == ["https://api.example.com/v1"]
    assert json_result["databases"][0]["name"] == "cache"


def test_architecture_rejects_malformed_and_non_object_documents() -> None:
    with pytest.raises(ArchitectureParseError):
        parse_architecture("services: [", "yaml")
    with pytest.raises(ArchitectureParseError, match="object"):
        parse_architecture("- one\n- two", "yaml")


def test_log_parser_handles_json_apache_syslog_and_bounds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    content = "\n".join(
        (
            '{"timestamp":"2026-01-01T10:00:00Z","level":"warn","message":"event"}',
            '203.0.113.5 - - [10/Oct/2025:13:55:36 +0000] "GET /health HTTP/1.1" 200 12',
            "Jan 10 10:11:12 host sshd[12]: Accepted publickey",
        )
    )
    entries = parse_log_file(content)
    assert [entry["status"] for entry in entries] == [None, 200, None]
    assert entries[2]["message"] == "sshd: Accepted publickey"

    monkeypatch.setattr(settings, "MAX_LOG_ENTRIES", 1)
    assert len(parse_log_file(content)) == 1


def test_log_parser_rejects_overlong_lines() -> None:
    with pytest.raises(LogParseError, match="line"):
        parse_log_file("x" * (64 * 1024 + 1))
