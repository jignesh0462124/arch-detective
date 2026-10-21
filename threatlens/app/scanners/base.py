from __future__ import annotations

import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Collection, Mapping, Sequence

SCANNER_TIMEOUT_SECONDS = 300
MAX_SCANNER_OUTPUT_BYTES = 32 * 1024 * 1024
MAX_FINDINGS_PER_SCANNER = 10_000

_SAFE_ENVIRONMENT_KEYS = frozenset(
    {
        "COMSPEC",
        "LANG",
        "LC_ALL",
        "PATH",
        "PATHEXT",
        "SYSTEMDRIVE",
        "SYSTEMROOT",
        "TEMP",
        "TMP",
        "TMPDIR",
        "WINDIR",
    }
)


class ScannerError(RuntimeError):
    """Raised when a scanner cannot produce a trustworthy result."""


class ScannerUnavailableError(ScannerError):
    """Raised when a required scanner executable is not installed."""


@dataclass(frozen=True, slots=True)
class ScannerCommandResult:
    stdout: str
    stderr: str
    returncode: int


def validate_repository_path(repo_path: str) -> Path:
    root = Path(repo_path).expanduser().resolve()
    if not root.is_dir():
        raise ScannerError("Scanner target must be an existing directory")
    return root


def scanner_environment(*, network_access: bool) -> dict[str, str]:
    environment = {
        key: value
        for key, value in os.environ.items()
        if key.upper() in _SAFE_ENVIRONMENT_KEYS
    }
    cache_root = Path(tempfile.gettempdir()) / "threatlens-scanner-cache"
    try:
        cache_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    except PermissionError:
        # Locked-down TEMP (or a stale read-only dir): fall back to an
        # isolated per-run dir so scanners still get a HOME/cache.
        cache_root = Path(tempfile.mkdtemp(prefix="threatlens-scanner-"))
    sandbox_home = cache_root / "home"
    try:
        sandbox_home.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        sandbox_home = Path(tempfile.mkdtemp(prefix="threatlens-home-"))
    npm_config = sandbox_home / ".npmrc"
    try:
        npm_config.touch(exist_ok=True)
    except Exception:
        pass

    environment.update(
        {
            "APPDATA": str(sandbox_home),
            "CI": "1",
            "HOME": str(sandbox_home),
            "LOCALAPPDATA": str(sandbox_home),
            "NO_COLOR": "1",
            "PIP_CONFIG_FILE": os.devnull,
            "PIP_DISABLE_PIP_VERSION_CHECK": "1",
            "PIP_NO_INPUT": "1",
            "SEMGREP_ENABLE_VERSION_CHECK": "0",
            "SEMGREP_SEND_METRICS": "off",
            "USERPROFILE": str(sandbox_home),
            "XDG_CACHE_HOME": str(cache_root),
            "npm_config_audit_level": "low",
            "npm_config_cache": str(cache_root / "npm"),
            "npm_config_fund": "false",
            "npm_config_ignore_scripts": "true",
            "npm_config_userconfig": str(npm_config),
            "npm_config_update_notifier": "false",
        }
    )
    if not network_access:
        # A production worker still needs an OS-level network-restricted container.
        environment.update(
            {
                "ALL_PROXY": "http://127.0.0.1:9",
                "HTTP_PROXY": "http://127.0.0.1:9",
                "HTTPS_PROXY": "http://127.0.0.1:9",
                "NO_PROXY": "",
            }
        )
    return environment


def run_scanner_command(
    command: Sequence[str],
    *,
    cwd: Path,
    accepted_returncodes: Collection[int] = (0,),
    network_access: bool = False,
    timeout: int = SCANNER_TIMEOUT_SECONDS,
) -> ScannerCommandResult:
    if not command or not command[0]:
        raise ScannerError("Scanner command is empty")
    try:
        completed = subprocess.run(
            list(command),
            cwd=str(cwd),
            env=scanner_environment(network_access=network_access),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
            shell=False,
        )
    except FileNotFoundError as exc:
        raise ScannerUnavailableError(f"{command[0]} is not installed") from exc
    except subprocess.TimeoutExpired as exc:
        raise ScannerError(f"{command[0]} exceeded the {timeout}-second timeout") from exc
    except OSError as exc:
        raise ScannerError(f"{command[0]} could not be started") from exc

    if (
        len(completed.stdout.encode("utf-8"))
        + len(completed.stderr.encode("utf-8"))
        > MAX_SCANNER_OUTPUT_BYTES
    ):
        raise ScannerError(f"{command[0]} produced too much output")
    if completed.returncode not in accepted_returncodes:
        raise ScannerError(
            f"{command[0]} failed with exit code {completed.returncode}"
        )
    return ScannerCommandResult(
        stdout=completed.stdout,
        stderr=completed.stderr,
        returncode=completed.returncode,
    )


def relative_finding_path(value: object, root: Path) -> str | None:
    if value is None:
        return None
    raw = str(value).strip().replace("\\", "/")
    if not raw:
        return None
    candidate = Path(raw)
    if candidate.is_absolute():
        try:
            raw = candidate.resolve().relative_to(root.resolve()).as_posix()
        except ValueError:
            raw = candidate.name
    else:
        parts = [
            part
            for part in PurePosixPath(raw).parts
            if part not in {"", ".", ".."}
        ]
        raw = "/".join(parts)
    return raw[:1024] or None


def bounded_text(value: object, maximum: int, *, default: str = "") -> str:
    text = str(value).strip() if value is not None else ""
    if not text:
        text = default
    return text[:maximum]


def first_mapping(value: object) -> Mapping[str, object]:
    return value if isinstance(value, Mapping) else {}
