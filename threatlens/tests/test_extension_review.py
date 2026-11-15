from __future__ import annotations

import io
import json
import uuid
import zipfile

import pytest

from app.scanners.extension_review import Declarations, assess, catalogue, comparison, inspect_package, notice
from app.ingestion.source_snapshot import read_zip_snapshot


def package(extra=None, manifest=None):
    files = {"manifest.json": json.dumps(manifest or {"manifest_version": 3, "name": "Fixture", "version": "1.0", "action": {"default_popup": "popup.html"}}),
        "popup.html": '<script src="https://example.invalid/script.js"></script>', "dist/main.js": "eval(data);", "vendor/library.js": "export const local = 1;"}
    files.update(extra or {})
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        for path, content in files.items():
            archive.writestr(path, content)
    return stream.getvalue()


def review(content=None):
    files, _, _, manifest = inspect_package(content or package(), str(uuid.uuid4()))
    return assess(files, manifest, ["chrome", "edge"], Declarations())


def test_extension_profile_includes_shipped_code_without_changing_project_profile():
    identifier = str(uuid.uuid4())
    original, _, _ = read_zip_snapshot(package(), identifier)
    extension, _, _, _ = inspect_package(package({"dist/module.mjs": "export const a = 1;"}), identifier)
    assert next(f for f in original if f["path"] == "dist/main.js")["preview_state"] == "excluded"
    assert all("content" in f for f in extension)


def test_store_specific_remote_script_and_uncertain_dynamic_code():
    rows, coverage = review()
    remote = [r for r in rows if r["rule_id"].endswith("remote-code.script")]
    assert {r["store"]: r["outcome"] for r in remote} == {"chrome": "violation", "edge": "needs_review"}
    assert all(r["outcome"] == "needs_review" for r in rows if r["rule_id"].endswith("remote-code.dynamic"))
    assert coverage["total"] == len(rows)
    assert sum(coverage["outcomes"].values()) == len(rows)
    assert all(r["outcome"] in {"not_assessed", "not_applicable"} for r in rows if ".manual." in r["rule_id"])


def test_remote_data_comments_and_sandbox_are_not_confirmed_violations():
    manifest = {"manifest_version": 3, "name": "Fixture", "version": "1", "sandbox": {"pages": ["popup.html"]}}
    rows, _ = review(package({"dist/main.js": 'fetch("https://example.invalid/config.json");', "popup.html": '<!-- <script src="https://bad.invalid/x.js"></script> -->'}, manifest))
    assert not any(r["outcome"] == "violation" for r in rows)
    rows, _ = review(package(manifest=manifest))
    assert not any(r["outcome"] == "violation" for r in rows)


@pytest.mark.parametrize("markup", ['<script type="application/json" src="https://example.invalid/data.json"></script>', '<template><script src="https://example.invalid/code.js"></script></template>'])
def test_inert_script_markup_is_not_remote_code_proof(markup):
    rows, _ = review(package({"popup.html": markup}))
    assert not any(r["outcome"] == "violation" for r in rows)


def test_broad_permissions_and_missing_declarations_never_pass_silently():
    rows, _ = review(package(manifest={"manifest_version": 3, "name": "Fixture", "version": "1", "host_permissions": ["<all_urls>"]}))
    assert all(r["outcome"] == "needs_review" for r in rows if r["rule_id"].endswith("permissions.scope"))
    assert all(r["outcome"] == "not_assessed" for r in rows if ".declarations." in r["rule_id"])


@pytest.mark.parametrize("extra", [{"../unsafe.js": "x"}, {"manifest.json": "[]"}, {"manifest.json": '{"manifest_version":3,"manifest_version":2}'}, {"manifest.json": "not json"}])
def test_invalid_package_rejected(extra):
    with pytest.raises((ValueError, json.JSONDecodeError)):
        inspect_package(package(extra), str(uuid.uuid4()))


def test_missing_entrypoint_and_escaped_evidence():
    rows, _ = review(package(manifest={"manifest_version": 3, "name": "Fixture", "version": "1", "background": {"service_worker": "absent.js"}}))
    assert any(r["outcome"] == "violation" and r["details"]["evidence"] == "absent.js" for r in rows)


def test_notice_is_not_a_fabricated_store_email():
    rows, _ = review()
    for row in rows:
        example = notice(row)
        assert example["kind"] == "illustrative"
        assert "not a notice sent" in example["label"]
        if row["store"] == "edge":
            assert example["notification_id"] is None


def test_comparison_keeps_duplicates_and_changed_coverage_uncertain():
    rows, _ = review()
    row = next(r for r in rows if r["outcome"] == "violation")
    assert comparison([row], [row])[0]["category"] == "still_present"
    assert comparison([row], [row], False)[0]["category"] == "needs_review"
    assert comparison([row, row], [row])[0]["category"] == "needs_review"
    assert comparison([row], [])[0]["category"] == "no_longer_detected"


def test_catalogue_is_versioned_and_unique():
    rows = catalogue(["chrome", "edge"])
    assert len({r["rule_id"] for r in rows}) == len(rows)
    assert all(r["policy_url"].startswith("https://") and r["policy_version"] for r in rows)


def test_csp_scripts_are_distinguished_from_allowed_style_directives():
    manifest = {"manifest_version": 3, "name": "Fixture", "version": "1", "content_security_policy": {"extension_pages": "script-src 'self'; style-src 'unsafe-inline'"}}
    rows, _ = review(package(manifest=manifest))
    assert not any(r["rule_id"].endswith("security.csp") for r in rows)
    manifest["content_security_policy"]["extension_pages"] = "script-src 'self' 'unsafe-eval'"
    rows, _ = review(package(manifest=manifest))
    assert {r["store"]: r["outcome"] for r in rows if r["rule_id"].endswith("security.csp")} == {"chrome": "violation", "edge": "needs_review"}


def test_result_budget_retains_both_stores_and_reports_incomplete_coverage():
    scripts = {f"dist/{n}.js": 'eval(data); element.innerHTML = text; fetch("http://example.invalid/data");' for n in range(180)}
    rows, coverage = review(package(scripts))
    assert coverage["omitted_executable_files"] > 0
    assert coverage["inspected_executable_files"] >= 0
    assert coverage["omitted_by_store"]["chrome"] > 0 and coverage["omitted_by_store"]["edge"] > 0
    assert {r["store"] for r in rows if ".remote-code.dynamic" in r["rule_id"]} == {"chrome", "edge"}
