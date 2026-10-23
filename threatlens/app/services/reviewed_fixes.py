"""Inert patch validation. Repository code is never executed."""
from __future__ import annotations

import ast
import difflib
import hashlib
from collections import defaultdict, Counter
from pathlib import PurePosixPath

from fastapi import HTTPException
from app.ingestion.source_snapshot import redact_text


def source_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def safe_path(path: str) -> bool:
    if not isinstance(path, str):
        return False
    parts = PurePosixPath(path).parts
    return bool(parts) and str(PurePosixPath(path)) == path and not path.startswith("/") and ":" not in path and "\\" not in path and not any(ord(c)<32 for c in path) and all(
        p not in {"..", ".git", "node_modules", "vendor", "dist", "build", ".github"} for p in parts
    ) and not any(p.startswith(".env") for p in parts)


def apply_edits(originals: dict[str, str], edits: list[dict]) -> tuple[dict[str, str], str]:
    if not isinstance(edits, list) or not edits or len(edits) > 5:
        raise HTTPException(422, "A proposal must change between one and five existing text files")
    output, diffs = {}, []
    for edit in edits:
        if not isinstance(edit, dict):
            raise HTTPException(422, "Invalid patch structure")
        path = edit.get("path", "")
        if not safe_path(path) or path not in originals or path in output:
            raise HTTPException(422, "Unsupported or duplicate patch path")
        original = originals[path]
        updated = original
        replacements = edit.get("replacements", [])
        if not isinstance(replacements, list) or not replacements or len(replacements) > 20:
            raise HTTPException(422, "Patch replacements are missing or too large")
        # Every replacement is grounded in one unique original span. No fuzzy application.
        spans = []
        for replacement in replacements:
            if not isinstance(replacement, dict):
                raise HTTPException(422, "Invalid patch replacement")
            before, after = replacement.get("before"), replacement.get("after")
            if not isinstance(before, str) or not isinstance(after, str) or not before or original.count(before) != 1:
                raise HTTPException(422, "Patch context is missing or ambiguous")
            if redact_text(before) != before or redact_text(after) != after or "****" in before or "****" in after:
                raise HTTPException(422, "Patch overlaps masked evidence or contains a secret")
            start = original.index(before)
            spans.append((start, start + len(before), after))
        spans.sort()
        if any(spans[i][1] > spans[i + 1][0] for i in range(len(spans) - 1)):
            raise HTTPException(422, "Patch replacements overlap")
        for start, end, after in reversed(spans):
            updated = updated[:start] + after + updated[end:]
        if updated == original:
            raise HTTPException(422, "The proposal contains no code change")
        output[path] = updated
        diffs.extend(difflib.unified_diff(redact_text(original).splitlines(True), redact_text(updated).splitlines(True), fromfile=f"a/{path}", tofile=f"b/{path}"))
    diff = "".join(diffs)
    if len(diff.encode()) > 200 * 1024 or sum(len(str(e).encode()) for e in edits) > 200 * 1024:
        raise HTTPException(413, "Patch exceeds 200 KiB")
    return output, diff


def syntax_checks(originals: dict[str, str], output: dict[str, str]) -> list[dict]:
    results = []
    for path, text in output.items():
        suffix = PurePosixPath(path).suffix.lower()
        before_failed = False
        try:
            if suffix == ".py":
                try:
                    ast.parse(originals[path])
                except SyntaxError:
                    before_failed = True
                ast.parse(text)
            elif suffix in {".js", ".jsx", ".ts", ".tsx", ".php"}:
                import tree_sitter_language_pack
                parser = tree_sitter_language_pack.get_parser({".js": "javascript", ".jsx": "javascript", ".ts": "typescript", ".tsx": "tsx", ".php": "php"}[suffix])
                before_failed = parser.parse(originals[path].encode()).root_node.has_error
                if parser.parse(text.encode()).root_node.has_error:
                    raise SyntaxError()
            else:
                results.append({"path": path, "status": "unsupported"})
                continue
            results.append({"path": path, "status": "passed"})
        except ImportError:
            results.append({"path": path, "status": "unsupported"})
        except SyntaxError:
            results.append({"path": path, "status": "needs_review" if before_failed else "failed"})
    return results


def compare_findings(before: list[dict], after: list[dict], compatible: bool) -> list[dict]:
    exact_index, evidence_index = defaultdict(list), defaultdict(list)
    def evidence_key(row):
        return (row.get("cwe_id"), row.get("file_path"), row.get("code_snippet"))
    for row in after:
        if row.get("fingerprint"):
            exact_index[(row["fingerprint"], row.get("file_path"))].append(row)
        if row.get("cwe_id") and row.get("code_snippet"):
            evidence_index[evidence_key(row)].append(row)
    candidates_by_id = {}
    for old in before:
        candidates_by_id[old["id"]] = exact_index.get((old.get("fingerprint"), old.get("file_path")), []) or evidence_index.get(evidence_key(old), [])
    # Only mutual one-to-one matches are safe. Never consume an ambiguous match.
    references = Counter(row["id"] for rows in candidates_by_id.values() if len(rows) == 1 for row in rows)
    ambiguous_after, seen_groups = set(), set()
    for rows in candidates_by_id.values():
        if rows and (len(rows) != 1 or references[rows[0]["id"]] != 1) and id(rows) not in seen_groups:
            seen_groups.add(id(rows))
            ambiguous_after.update(row["id"] for row in rows)
    remaining = {row["id"]: row for row in after}
    result = []
    for old in before:
        candidates = candidates_by_id[old["id"]]
        unique = len(candidates) == 1 and references[candidates[0]["id"]] == 1
        if compatible and unique:
            current = remaining.pop(candidates[0]["id"])
            result.append({"before_id": old["id"], "after_id": current["id"], "title": current.get("title"), "status": "still_present"})
        else:
            result.append({"before_id": old["id"], "title": old.get("title"), "status": "no_longer_detected" if compatible and not candidates else "needs_review"})
    result.extend({"after_id": row["id"], "title": row.get("title"), "status": "new" if compatible and row["id"] not in ambiguous_after else "needs_review"} for row in remaining.values())
    return result
