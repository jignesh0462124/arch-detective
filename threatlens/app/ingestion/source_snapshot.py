"""Bounded, inert ZIP previews. Uploaded paths never become host filesystem paths."""
from __future__ import annotations

import hashlib
import io
import re
import uuid
import zipfile
from pathlib import PurePosixPath

from app.config import settings
from app.ingestion.code_extractor import ARCHIVE_RATIO_LIMIT, SUPPORTED_EXTENSIONS

LANGUAGES = {**{ext: "plaintext" for ext in SUPPORTED_EXTENSIONS}, ".py": "python", ".js": "javascript", ".jsx": "javascript", ".ts": "typescript", ".tsx": "typescript", ".json": "json", ".yml": "yaml", ".yaml": "yaml", ".php": "php", ".java": "java", ".go": "go", ".rb": "ruby", ".sql": "sql", ".css": "css", ".html": "html", ".md": "markdown", ".sh": "shell", ".xml": "xml", ".rs": "rust", ".c": "c", ".cpp": "cpp", ".cs": "csharp", ".kt": "kotlin", ".txt": "plaintext", ".toml": "ini", ".ini": "ini", ".env": "ini", ".config": "ini"}
SKIP = {"node_modules", ".git", "__pycache__", ".venv", "venv", "dist", "build", ".next", "vendor"}
_ASSIGNMENT = re.compile(r'''(?im)((?:\b(?:pass|pwd)\b|\b[\w.-]*(?:password|passwd|secret|api[_-]?key|token|private[_-]?key|service[_-]?role[_-]?key|credential|authorization|database[_-]?url|connection[_-]?string)[\w.-]*\b)["']?\s*[=:]\s*)("[^"\r\n]*"|'[^'\r\n]*'|[^\s"'`,;\r\n]+)''')
_TOKEN = re.compile(r"\b(?:sk-[A-Za-z0-9_-]{16,}|sbp_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{16,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b")
_PEM = re.compile(r"-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----")


def redact_text(text: str) -> str:
    def mask(match):
        return "".join("\n" if c == "\n" else "\r" if c == "\r" else "*" for c in match.group())
    text = _PEM.sub(mask, text)
    text = _TOKEN.sub(mask, text)
    text = re.sub(r"(?i)(Bearer\s+)([A-Za-z0-9._~+/-]{12,})", lambda m: m[1] + "*" * len(m[2]), text)
    text = re.sub(r"(\w+://[^\s/:@]+:)([^\s@]+)(@)", lambda m: m[1] + "*" * len(m[2]) + m[3], text)
    def mask_assignment(match):
        value = match[2]
        if value.startswith(('"', "'")):
            return match[1] + value[0] + "*" * (len(value) - 2) + value[-1]
        return match[1] + "*" * len(value)
    return _ASSIGNMENT.sub(mask_assignment, text)


def redact_evidence(value):
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, list):
        return [redact_evidence(v) for v in value]
    if isinstance(value, dict):
        return {k: redact_evidence(v) for k, v in value.items()}
    return value


def normalize_source_path(path: str) -> str | None:
    path = path.replace("\\", "/")
    parts = PurePosixPath(path).parts
    if not path or len(path) > 1024 or len(parts) > 40 or path.startswith("/") or re.match(r"^[A-Za-z]:", path) or ".." in parts or "\x00" in path or any(ord(c) < 32 for c in path):
        return None
    return str(PurePosixPath(path))


def read_zip_snapshot(content: bytes, snapshot_id: str, *, extension_package: bool = False):
    """Return metadata/previews and the exact bounded source input used by analysis."""
    files, analysis, exclusions, seen = [], [], [], set()
    total = preview_total = 0
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        members = [entry for entry in archive.infolist() if not entry.is_dir()]
        if len(members) > settings.MAX_SOURCE_FILES:
            raise ValueError(f"Archive exceeds {settings.MAX_SOURCE_FILES} files")
        for entry in members:
            total += entry.file_size
            if total > settings.MAX_EXTRACTED_SIZE_MB * 1024 * 1024:
                raise ValueError("Archive exceeds the expanded size limit")
            if entry.flag_bits & 1:
                raise ValueError("Encrypted archives are not supported")
            if entry.file_size and entry.file_size / max(entry.compress_size, 1) > ARCHIVE_RATIO_LIMIT:
                raise ValueError("Archive contains an unsafe compression ratio")
            path = normalize_source_path(entry.filename)
            if not path or path in seen or (entry.external_attr >> 16) & 0o170000 == 0o120000:
                exclusions.append({"reason": "Unsafe, duplicate or symbolic-link entry skipped"})
                continue
            seen.add(path)
            suffix = PurePosixPath(path).suffix.lower()
            language = LANGUAGES.get(suffix, "plaintext")
            extension_script = extension_package and suffix in {".mjs", ".cjs"}
            if extension_script:
                language = "javascript"
            record = {"id": str(uuid.uuid5(uuid.UUID(snapshot_id), path)), "snapshot_id": snapshot_id, "path": path, "language": language, "byte_size": entry.file_size, "line_count": 0, "preview_state": "ready", "redacted": False, "reason": None}
            if any(part in (SKIP - {"dist", "build", "vendor", "node_modules"} if extension_package else SKIP) for part in PurePosixPath(path).parts):
                record.update(preview_state="excluded", reason="Generated output or dependency directory")
            elif not extension_script and suffix not in LANGUAGES and PurePosixPath(path).name.lower() not in {"dockerfile", "makefile", ".gitignore", ".env", "requirements.txt"}:
                record.update(preview_state="unsupported", reason="No text preview for this file type")
            elif entry.file_size > min(settings.MAX_SOURCE_FILE_SIZE_MB, 2) * 1024 * 1024 or preview_total + entry.file_size > 32 * 1024 * 1024:
                record.update(preview_state="oversized", reason="Source preview byte budget exceeded")
            else:
                raw = archive.read(entry)
                try:
                    original = raw.decode("utf-8-sig")
                    if "\x00" in original:
                        raise UnicodeError()
                    sanitized = redact_text(original)
                    record.update(content=sanitized, byte_size=len(sanitized.encode()), line_count=len(sanitized.split("\n")), redacted=sanitized != original, content_hash=hashlib.sha256(sanitized.encode()).hexdigest())
                    preview_total += len(raw)
                    if len(analysis) < 500 and (extension_script or suffix in SUPPORTED_EXTENSIONS or PurePosixPath(path).name.lower() in {"dockerfile", "makefile", ".env"}):
                        analysis.append({"path": path, "content": original[:200000]})
                        if extension_package and len(original) > 200000:
                            exclusions.append({"path": path, "reason": "Security analysis uses the first 200,000 characters; source preview and policy inspection have separate limits"})
                    elif extension_package:
                        exclusions.append({"path": path, "reason": "Not included in model/static security input because of analysis limits or unsupported file type"})
                except UnicodeError:
                    record.update(preview_state="binary", reason="Binary or non-UTF-8 content")
            files.append(record)
    if not analysis:
        raise ValueError("No supported text source files were found")
    return files, analysis, exclusions


def resolve_location(finding: dict, files: list[dict]) -> dict:
    path = normalize_source_path(str(finding.get("file_path") or ""))
    file = next((f for f in files if f["path"] == path and f["preview_state"] == "ready"), None)
    line = finding.get("line_number")
    verified = file is not None and isinstance(line, int) and not isinstance(line, bool) and 1 <= line <= file["line_count"]
    return {"file_id": file["id"] if file else None, "line_number": line if verified else None, "match_status": "verified" if verified else "unlocated"}
