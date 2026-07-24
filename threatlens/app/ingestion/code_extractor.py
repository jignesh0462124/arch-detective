from __future__ import annotations

import ipaddress
import os
import shutil
import socket
import stat
import subprocess
import tempfile
import zipfile
from collections.abc import Callable
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from app.config import settings

SUPPORTED_EXTENSIONS = frozenset(
    {
        ".bash",
        ".c",
        ".cfg",
        ".cpp",
        ".cs",
        ".dockerfile",
        ".env",
        ".go",
        ".ini",
        ".java",
        ".js",
        ".json",
        ".jsx",
        ".php",
        ".py",
        ".rb",
        ".rs",
        ".sh",
        ".tf",
        ".toml",
        ".ts",
        ".tsx",
        ".yaml",
        ".yml",
    }
)
SUPPORTED_FILENAMES = frozenset({"dockerfile"})
EXCLUDED_DIRS = frozenset(
    {
        ".git",
        ".next",
        ".pytest_cache",
        ".venv",
        "__pycache__",
        "build",
        "dist",
        "node_modules",
        "target",
        "venv",
        "vendor",
    }
)
ARCHIVE_RATIO_LIMIT = 100
COPY_CHUNK_SIZE = 1024 * 1024


class IngestionError(ValueError):
    """Raised when source input cannot be ingested safely."""


class ArchiveSecurityError(IngestionError):
    """Raised when an archive violates extraction limits."""


class GitSecurityError(IngestionError):
    """Raised when a Git source is unsafe or cannot be cloned."""


def _is_zip_symlink(member: zipfile.ZipInfo) -> bool:
    mode = member.external_attr >> 16
    return stat.S_ISLNK(mode)


def _safe_member_target(root: Path, member_name: str) -> Path:
    if "\x00" in member_name:
        raise ArchiveSecurityError("Archive member contains a null byte")

    normalized = member_name.replace("\\", "/")
    posix_path = PurePosixPath(normalized)
    windows_path = PureWindowsPath(member_name)
    if posix_path.is_absolute() or windows_path.is_absolute() or windows_path.drive:
        raise ArchiveSecurityError("Archive contains an absolute path")
    if any(part in {"", ".", ".."} for part in posix_path.parts):
        raise ArchiveSecurityError("Archive contains an unsafe relative path")

    target = (root / Path(*posix_path.parts)).resolve()
    if not target.is_relative_to(root.resolve()):
        raise ArchiveSecurityError("Archive member escapes the extraction directory")
    return target


def extract_from_zip(zip_path: str) -> str:
    source = Path(zip_path)
    if not source.is_file():
        raise IngestionError("ZIP source does not exist")

    compressed_limit = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    extracted_limit = settings.MAX_EXTRACTED_SIZE_MB * 1024 * 1024
    if source.stat().st_size > compressed_limit:
        raise ArchiveSecurityError("ZIP exceeds the configured upload limit")

    destination = Path(tempfile.mkdtemp(prefix="threatlens-zip-"))
    try:
        with zipfile.ZipFile(source) as archive:
            members = archive.infolist()
            files = [member for member in members if not member.is_dir()]
            if len(files) > settings.MAX_SOURCE_FILES:
                raise ArchiveSecurityError("ZIP contains too many files")

            total_uncompressed = sum(member.file_size for member in files)
            total_compressed = max(sum(member.compress_size for member in files), 1)
            if any(member.file_size < 0 or member.compress_size < 0 for member in files):
                raise ArchiveSecurityError("ZIP contains invalid entry sizes")
            if total_uncompressed > extracted_limit:
                raise ArchiveSecurityError("ZIP exceeds the extracted-size limit")
            if total_uncompressed / total_compressed > ARCHIVE_RATIO_LIMIT:
                raise ArchiveSecurityError("ZIP compression ratio is unsafe")

            targets: list[tuple[zipfile.ZipInfo, Path]] = []
            seen_targets: set[Path] = set()
            for member in members:
                if member.flag_bits & 0x1:
                    raise ArchiveSecurityError("Encrypted ZIP entries are not supported")
                if _is_zip_symlink(member):
                    raise ArchiveSecurityError("ZIP symbolic links are not allowed")
                target = _safe_member_target(destination, member.filename)
                if target in seen_targets:
                    raise ArchiveSecurityError("ZIP contains duplicate member paths")
                seen_targets.add(target)
                targets.append((member, target))

            written = 0
            for member, target in targets:
                if member.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member, "r") as source_file, target.open("wb") as output:
                    while chunk := source_file.read(COPY_CHUNK_SIZE):
                        written += len(chunk)
                        if written > extracted_limit:
                            raise ArchiveSecurityError("ZIP exceeded its declared extracted size")
                        output.write(chunk)
        return str(destination)
    except (ArchiveSecurityError, OSError, zipfile.BadZipFile, zipfile.LargeZipFile) as exc:
        cleanup_temp_directory(str(destination))
        if isinstance(exc, ArchiveSecurityError):
            raise
        raise IngestionError("Unable to extract ZIP source") from exc


def _address_is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    # `is_global` excludes private, loopback, link-local, multicast, reserved,
    # documentation, and carrier-grade address ranges in one explicit gate.
    return ip.is_global and not ip.is_multicast


def validate_public_git_url(
    git_url: str,
    *,
    resolver: Callable[..., list[tuple[Any, ...]]] | None = None,
) -> str:
    try:
        parsed = urlsplit(git_url.strip())
        port = parsed.port
    except ValueError as exc:
        raise GitSecurityError("Git URL is malformed") from exc
    if parsed.scheme.lower() != "https":
        raise GitSecurityError("Git URL must use HTTPS")
    if not parsed.hostname:
        raise GitSecurityError("Git URL must include a hostname")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise GitSecurityError("Git URL must not contain credentials, query data, or fragments")
    if port not in (None, 443):
        raise GitSecurityError("Git URL must use the standard HTTPS port")

    lookup = resolver or socket.getaddrinfo
    try:
        addresses = {
            result[4][0]
            for result in lookup(parsed.hostname, port or 443, type=socket.SOCK_STREAM)
        }
    except (OSError, socket.gaierror) as exc:
        raise GitSecurityError("Git hostname could not be resolved") from exc
    if not addresses or any(not _address_is_public(address) for address in addresses):
        raise GitSecurityError("Git hostname resolves to a non-public address")

    hostname = parsed.hostname.encode("idna").decode("ascii").lower()
    netloc = hostname if port is None else f"{hostname}:{port}"
    normalized_path = "/" + parsed.path.lstrip("/")
    return urlunsplit(("https", netloc, normalized_path, "", ""))


def _directory_size(root: Path, maximum: int) -> int:
    total = 0
    for path in root.rglob("*"):
        if path.is_file() and not path.is_symlink():
            total += path.stat().st_size
            if total > maximum:
                return total
    return total


def extract_from_git(git_url: str) -> str:
    safe_url = validate_public_git_url(git_url)
    root = Path(tempfile.mkdtemp(prefix="threatlens-git-"))
    repository = root / "repository"
    environment = os.environ.copy()
    environment.update(
        {
            "GIT_CONFIG_COUNT": "1",
            "GIT_CONFIG_KEY_0": "http.followRedirects",
            "GIT_CONFIG_VALUE_0": "false",
            "GIT_TERMINAL_PROMPT": "0",
        }
    )
    command = [
        "git",
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--no-tags",
        "--",
        safe_url,
        str(repository),
    ]
    try:
        subprocess.run(
            command,
            check=True,
            capture_output=True,
            env=environment,
            shell=False,
            timeout=settings.GIT_CLONE_TIMEOUT_SECONDS,
        )
        maximum = settings.MAX_EXTRACTED_SIZE_MB * 1024 * 1024
        if _directory_size(repository, maximum) > maximum:
            raise GitSecurityError("Cloned repository exceeds the configured size limit")
        return str(repository)
    except subprocess.TimeoutExpired as exc:
        cleanup_temp_directory(str(root))
        raise GitSecurityError("Git clone timed out") from exc
    except (OSError, subprocess.CalledProcessError, GitSecurityError) as exc:
        cleanup_temp_directory(str(root))
        if isinstance(exc, GitSecurityError):
            raise
        raise GitSecurityError("Unable to clone Git repository") from exc


def _language_for(path: Path) -> str:
    if path.name.lower() == "dockerfile":
        return "dockerfile"
    return path.suffix.lower().lstrip(".")


def collect_source_files(repo_path: str) -> list[dict[str, object]]:
    root = Path(repo_path).resolve()
    if not root.is_dir():
        raise IngestionError("Source directory does not exist")

    maximum_file_size = settings.MAX_SOURCE_FILE_SIZE_MB * 1024 * 1024
    collected: list[dict[str, object]] = []
    for current_root, directories, filenames in os.walk(root, followlinks=False):
        directories[:] = sorted(
            directory
            for directory in directories
            if directory.lower() not in EXCLUDED_DIRS
            and not (Path(current_root) / directory).is_symlink()
        )
        for filename in sorted(filenames):
            path = Path(current_root) / filename
            if path.is_symlink():
                continue
            if (
                path.suffix.lower() not in SUPPORTED_EXTENSIONS
                and path.name.lower() not in SUPPORTED_FILENAMES
            ):
                continue
            size = path.stat().st_size
            if size > maximum_file_size:
                continue
            content_bytes = path.read_bytes()
            if b"\x00" in content_bytes:
                continue
            try:
                content = content_bytes.decode("utf-8")
            except UnicodeDecodeError:
                continue

            collected.append(
                {
                    "path": path.relative_to(root).as_posix(),
                    "content": content,
                    "language": _language_for(path),
                    "size_bytes": size,
                }
            )
            if len(collected) > settings.MAX_SOURCE_FILES:
                raise IngestionError("Source contains too many supported files")
    return collected


def cleanup_temp_directory(path: str) -> None:
    candidate = Path(path).resolve()
    temp_root = Path(tempfile.gettempdir()).resolve()
    if candidate == temp_root or not candidate.is_relative_to(temp_root):
        raise ValueError("Refusing to remove a directory outside the temporary root")
    if not candidate.name.startswith("threatlens-"):
        raise ValueError("Refusing to remove an unrelated temporary directory")
    shutil.rmtree(candidate, ignore_errors=True)
