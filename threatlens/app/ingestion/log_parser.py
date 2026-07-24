from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from app.config import settings

MAX_LOG_BYTES = 10 * 1024 * 1024
MAX_LOG_LINE_LENGTH = 64 * 1024
APACHE_PATTERN = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[(?P<timestamp>[^\]]+)\] '
    r'"(?P<method>[A-Z]+) (?P<path>\S+)(?: HTTP/[0-9.]+)?" '
    r"(?P<status>\d{3})(?: \S+)(?: .*)?$"
)
SYSLOG_PATTERN = re.compile(
    r"^(?P<timestamp>[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}) "
    r"(?P<host>\S+) (?P<program>[^:\[]+)(?:\[\d+\])?: (?P<message>.*)$"
)


class LogParseError(ValueError):
    """Raised when a log payload violates parser limits."""


def _status(value: object) -> int | None:
    try:
        parsed = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return parsed if 100 <= parsed <= 599 else None


def _entry(
    *,
    timestamp: object = None,
    level: object = None,
    source_ip: object = None,
    method: object = None,
    path: object = None,
    status: object = None,
    message: object = None,
) -> dict[str, object]:
    return {
        "timestamp": str(timestamp)[:128] if timestamp is not None else None,
        "level": str(level).upper()[:32] if level is not None else None,
        "source_ip": str(source_ip)[:128] if source_ip is not None else None,
        "method": str(method).upper()[:32] if method is not None else None,
        "path": str(path)[:2048] if path is not None else None,
        "status": _status(status),
        "message": str(message)[:8192] if message is not None else None,
    }


def _parse_json(line: str) -> dict[str, object] | None:
    try:
        value: Any = json.loads(line)
    except json.JSONDecodeError:
        return None
    if not isinstance(value, dict):
        return None
    return _entry(
        timestamp=value.get("timestamp") or value.get("time") or value.get("@timestamp"),
        level=value.get("level") or value.get("severity"),
        source_ip=value.get("source_ip") or value.get("remote_addr") or value.get("ip"),
        method=value.get("method") or value.get("http_method"),
        path=value.get("path") or value.get("url") or value.get("request_uri"),
        status=value.get("status") or value.get("status_code"),
        message=value.get("message") or value.get("msg"),
    )


def _parse_apache(line: str) -> dict[str, object] | None:
    match = APACHE_PATTERN.match(line)
    if match is None:
        return None
    values = match.groupdict()
    return _entry(
        timestamp=values["timestamp"],
        source_ip=values["ip"],
        method=values["method"],
        path=values["path"],
        status=values["status"],
        message=line,
    )


def _parse_syslog(line: str) -> dict[str, object] | None:
    match = SYSLOG_PATTERN.match(line)
    if match is None:
        return None
    values = match.groupdict()
    return _entry(
        timestamp=values["timestamp"],
        level="INFO",
        message=f"{values['program']}: {values['message']}",
    )


def _parse_timestamped(line: str) -> dict[str, object] | None:
    parts = line.split(maxsplit=2)
    if len(parts) < 3:
        return None
    timestamp = f"{parts[0]} {parts[1]}"
    try:
        datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return None
    return _entry(timestamp=timestamp, message=parts[2])


def parse_log_file(content: str) -> list[dict[str, object]]:
    if len(content.encode("utf-8")) > MAX_LOG_BYTES:
        raise LogParseError("Log payload exceeds the parser size limit")

    entries: list[dict[str, object]] = []
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if len(stripped) > MAX_LOG_LINE_LENGTH:
            raise LogParseError("Log line exceeds the parser length limit")
        parsed = (
            _parse_json(stripped)
            or _parse_apache(stripped)
            or _parse_syslog(stripped)
            or _parse_timestamped(stripped)
        )
        if parsed is not None:
            entries.append(parsed)
        if len(entries) >= settings.MAX_LOG_ENTRIES:
            break
    return entries
