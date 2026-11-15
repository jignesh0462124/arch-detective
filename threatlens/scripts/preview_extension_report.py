"""Create synthetic extension fixtures and a PDF for local visual acceptance."""
from pathlib import Path
import argparse
import io
import json
import sys
import uuid
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.scanners.extension_review import inspect_package, assess, Declarations, VERSION
from app.report.generator import _render_pdf_report


def fixture(fixed=False):
    stream = io.BytesIO()
    manifest = {"manifest_version": 3, "name": "Archon extension review fixture", "version": "1.1" if fixed else "1.0",
        "action": {"default_popup": "popup.html"}, "permissions": ["storage"], "background": {"service_worker": "dist/worker.js", "type": "module"}}
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))
        archive.writestr("popup.html", '<!doctype html>\n<h1>Fixture extension</h1>\n<script src="./dist/local.js"></script>' if fixed else '<!doctype html>\n<h1>Fixture extension</h1>\n<script src="https://example.invalid/remote.js"></script>')
        archive.writestr("dist/worker.js", "chrome.runtime.onInstalled.addListener(() => { console.log('Fixture installed'); });")
        archive.writestr("dist/local.js", "document.querySelector('h1').textContent = 'Fixture ready';")
    return stream.getvalue()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for fixed, name in ((False, "extension-before.zip"), (True, "extension-after.zip")):
        (args.output / name).write_bytes(fixture(fixed))
    files, analysis, exclusions, manifest = inspect_package(fixture(), str(uuid.uuid4()))
    declared = Declarations(purpose="Review documents locally", permissions="Use storage for local preferences only", data_use="No personal data is collected or shared")
    results, coverage = assess(files, manifest, ["chrome", "edge"], declared)
    coverage.update(security_analysis_files=len(analysis), analysis_exclusions=exclusions)
    payload = {"scan": {"id": "isolated-extension-fixture", "target_name": manifest["name"], "completed_at": "2026-11-05T12:00:00Z", "selected_frameworks": []}, "findings": [],
        "summary": {"summary": "This fixture illustrates extension policy evidence and developer review. The remote script reference requires attention before submission."},
        "extension_review": {"package_name": manifest["name"], "package_version": manifest["version"], "manifest_version": 3, "stores": ["chrome", "edge"], "policy_version": VERSION,
            "coverage": coverage, "results": results, "declarations": declared.model_dump()}, "report_id": "EXTENSION-FIXTURE", "generated_at": "2026-11-05T12:05:00Z"}
    data = _render_pdf_report(payload)
    (args.output / "extension-review.pdf").write_bytes(data)
    (args.output / "expected-policy-references.json").write_text(json.dumps([f"P-{n:03d}" for n in range(1, len(results) + 1)]), encoding="utf-8")
    print(f"Prepared {len(results)} policy results and two synthetic ZIPs; PDF bytes: {len(data)}")


if __name__ == "__main__":
    main()
