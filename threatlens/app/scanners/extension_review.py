"""Inert, bounded extension-package review. Never imports or runs submitted code.

Policy outcomes are not security severities or store approval predictions. Lexical
JavaScript signals deliberately require review; only structural facts are decisive.
"""
from __future__ import annotations

import io
import json
import re
import uuid
import zipfile
from collections import Counter
from html.parser import HTMLParser
from pathlib import PurePosixPath

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.ingestion.source_snapshot import read_zip_snapshot, redact_evidence

VERSION = "2026-11-05.1"
CHROME = "https://developer.chrome.com/docs/webstore/program-policies/policies/"
EDGE = "https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies"
MV3 = "https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements"
TROUBLESHOOT = "https://developer.chrome.com/docs/webstore/troubleshooting"
OUTCOMES = ("passed", "violation", "needs_review", "not_assessed", "not_applicable")
LIMITATIONS = [
    "Static package inspection and supplied declarations only; no extension code was executed.",
    "No account, live service, actual consent flow, browser behaviour or store submission was verified.",
    "Policy coverage is a section-level checklist, not a guarantee of approval or exhaustive legal review.",
    "JavaScript signals require human review. Files outside inspection limits remain unassessed.",
]


class Listing(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(default="", max_length=10000)
    screenshots_description: str = Field(default="", max_length=3000)
    privacy_text: str = Field(default="", max_length=20000)
    privacy_url: str = Field(default="", max_length=2000)

    @field_validator("privacy_url")
    @classmethod
    def safe_url(cls, value):
        if value and not value.startswith("https://"):
            raise ValueError("Use an HTTPS privacy URL; it will not be fetched")
        return value


class Declarations(BaseModel):
    model_config = ConfigDict(extra="forbid")
    purpose: str = Field(default="", max_length=3000)
    permissions: str = Field(default="", max_length=5000)
    browser_settings: str = Field(default="", max_length=3000)
    data_use: str = Field(default="", max_length=5000)
    advertising: str = Field(default="", max_length=3000)
    paid_features: str = Field(default="", max_length=3000)
    chrome: Listing = Field(default_factory=Listing)
    edge: Listing = Field(default_factory=Listing)


# Section inventory: references and applicability are distinct per store. Manual
# sections are never counted as automatically passed, even when declarations exist.
CHROME_MANUAL = {
    "privacy": ["Protecting User Privacy", "Limited Use", "Privacy Policy", "Use of Permissions", "Disclosure Requirements", "Handling Requirements"],
    "listing": ["Building Quality Products", "Feature Products", "Quality Guidelines", "Listing Requirements", "Minimum Functionality", "Spam and Abuse", "Misleading or Unexpected Behavior"],
    "content": ["Fostering a Safe Ecosystem", "Mature & Sexually Explicit Material", "Malicious and Prohibited Products", "Hate Speech and Violent Behavior", "Regulated Goods and Services"],
    "commercial": ["Ensuring Responsible Marketing and Monetization", "Impersonation & Intellectual Property", "Deceptive Installation Tactics", "Accepting Payment From Users", "Ads", "Affiliate Ads"],
    "technical": ["Chrome Apps", "Technical Requirements", "Code Readability Requirements", "API Use", "Additional Requirements for Manifest V3"],
    "publisher": ["Best Practices and Guidelines", "2-Step Verification", "Enforcement", "Enforcement Circumvention", "Notification and Appeals", "Repeat Abuse"],
}
EDGE_MANUAL = {
    "listing": ["1.1.1 Extensions must have a single purpose", "1.1.2 Describe your extension", "1.1.3 Functionality", "1.1.4 Search and discovery", "1.1.5 Provide appropriate details", "1.1.6 Stability and performance", "1.1.7 Obfuscation", "1.1.8 Altering browser settings", "1.3.1 User credentials", "1.3.2 Availability of services", "1.4.1 Compatibility across platforms", "1.4.2 User experience", "1.7 Localization"],
    "security": ["1.2 Security", "1.2.1 Content security policies", "1.2.2 Unwanted and malicious software", "1.2.3 Dependency on other software", "1.2.4 Extension updates", "1.6 Permissions"],
    "privacy": ["1.5.1 Collect personal information only when necessary", "1.5.2 Maintain a privacy policy", "1.5.3 Sharing data with third parties", "1.5.4 Sharing information of non-users", "1.5.5 Transmit information securely", "1.5.6 Highly sensitive information"],
    "commercial": ["1.8 Financial transactions", "1.8.1 Paid features", "1.8.2 Disclosing paid features", "1.9 Notifications", "1.9.1 General guidance", "1.9.2 Ownership of notifications", "1.9.3 No confidential or sensitive information", "1.9.4 Purpose of notifications", "1.10 Advertising conduct and content", "1.10.1 Purpose", "1.10.2 Policies and agreements", "1.10.3 Quality of advertising", "1.10.4 Promotions", "1.10.5 Notifying users of opt-out for interest-based advertising", "1.10.6 Other guidelines"],
    "content": ["2. Content policies", "2.1 Content requirements", "2.2 Content including names, logos, and original and third-party content", "2.3 Risk of harm", "2.3.1 Requirements", "2.3.2 Responsibility", "2.4 Defamatory, libelous, slanderous, or threatening", "2.5 Offensive content", "2.6 Alcohol, tobacco, and drugs", "2.7 Adult content", "2.8 Prohibited content, services, and activity", "2.9 Illegal activity", "2.10 Excessive profanity and inappropriate content", "2.11 Requirements specific to a country/region", "2.12 Age ratings", "2.12.1 Mature content", "2.12.2 Ratings change", "2.13 Videos"],
    "publisher": ["Building quality products", "Principles", "Complaint and appeal process for Microsoft Edge Add-ons certification"],
}


def catalogue(stores):
    rows = []
    for store in stores:
        for category, titles in (CHROME_MANUAL if store == "chrome" else EDGE_MANUAL).items():
            for title in titles:
                slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
                rows.append({"store": store, "rule_id": f"{store}.manual.{slug}", "category": category,
                    "title": title, "policy_url": (CHROME + "#" + ("%C2%A02-step_verification" if title == "2-Step Verification" else re.sub(r"\s+", "_", title.lower().replace(" &", "")))) if store == "chrome" else EDGE + "#" + re.sub(r"\s+", "-", re.sub(r"[.,;/]", "", title.lower())),
                    "method": "manual", "policy_version": VERSION, "reviewed_at": "2026-11-05"})
    return rows


def inspect_package(content, snapshot_id):
    # Reject ambiguous archives rather than letting extraction skip unsafe entries.
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        manifests = [i for i in archive.infolist() if i.filename == "manifest.json"]
        if len(manifests) != 1:
            raise ValueError("Upload the built extension ZIP with exactly one manifest.json at its root. Do not upload a repository wrapper.")
        if manifests[0].file_size > 256 * 1024:
            raise ValueError("manifest.json exceeds the 256 KiB inspection limit")
    files, analysis, exclusions = read_zip_snapshot(content, snapshot_id, extension_package=True)
    if any("Unsafe" in e["reason"] for e in exclusions):
        raise ValueError("Remove unsafe, duplicate or symbolic-link archive entries")
    manifest_file = next((f for f in files if f["path"] == "manifest.json" and "content" in f), None)
    if not manifest_file:
        raise ValueError("manifest.json must be readable UTF-8 JSON within the source limits")
    # Parse originals for structure only; all returned content is redacted.
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        def unique(pairs):
            obj = {}
            for key, value in pairs:
                if key in obj:
                    raise ValueError("manifest.json has duplicate properties")
                obj[key] = value
            return obj
        manifest = json.loads(archive.read("manifest.json").decode("utf-8-sig"), object_pairs_hook=unique)
    if not isinstance(manifest, dict) or type(manifest.get("manifest_version")) is not int or manifest["manifest_version"] not in (2, 3):
        raise ValueError("Supported inspection formats are Manifest V2 and V3; store eligibility is assessed separately")
    if "theme" in manifest or "app" in manifest:
        raise ValueError("Upload a browser extension package. Chrome apps and themes are outside this review mode")
    if not isinstance(manifest.get("name"), str) or not manifest["name"].strip() or len(manifest["name"]) > 200:
        raise ValueError("manifest.json requires a valid name of at most 200 characters")
    if not isinstance(manifest.get("version"), str) or not re.fullmatch(r"\d{1,5}(?:\.\d{1,5}){0,3}", manifest["version"]):
        raise ValueError("manifest.json requires a numeric extension version")
    for field in ("permissions", "host_permissions", "optional_permissions", "optional_host_permissions"):
        if field in manifest and (not isinstance(manifest[field], list) or not all(isinstance(v, str) for v in manifest[field])):
            raise ValueError(f"{field} must be a list of strings")
    return files, analysis, exclusions, manifest


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.remote = []
        self.template_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "template":
            self.template_depth += 1
        if tag.lower() == "script" and not self.template_depth:
            attributes = dict(attrs)
            kind = (attributes.get("type") or "").strip().lower()
            if kind not in {"", "module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"}:
                return
            src = attributes.get("src", "") or ""
            if src.lower().startswith(("https://", "http://", "//")):
                self.remote.append((self.getpos()[0], src))

    def handle_endtag(self, tag):
        if tag.lower() == "template":
            self.template_depth = max(0, self.template_depth - 1)


def assess(files, manifest, stores, declarations):
    results = []
    by_path = {f["path"]: f for f in files}
    executable = [f for f in files if PurePosixPath(f["path"]).suffix.lower() in {".js", ".mjs", ".cjs", ".html", ".wasm"}]
    omitted = {f["path"] for f in executable if "content" not in f}
    base_omitted = set(omitted)
    omitted_by_store = {}
    sandbox = (manifest.get("sandbox") or {}).get("pages", []) if isinstance(manifest.get("sandbox"), dict) else []

    def add(store, key, title, outcome, category, explanation, remedy, path=None, line=None, evidence=None, method="static"):
        results.append({"id": str(uuid.uuid4()), "store": store, "rule_id": f"{store}.{key}", "title": title,
            "priority": {"violation": 0, "needs_review": 1, "not_assessed": 2, "passed": 3, "not_applicable": 4}[outcome],
            "outcome": outcome, "category": category, "details": {
                "explanation": explanation, "remedy": remedy, "verification": "Rebuild and upload the corrected package. Test the affected feature in an isolated development browser; no runtime tests were performed here.",
                "path": path, "line": line, "evidence": evidence, "method": method,
                "policy_url": MV3 if store == "chrome" and key.startswith("remote-code") else CHROME if store == "chrome" else EDGE,
                "policy_version": VERSION, "reviewed_at": "2026-11-05", "notification_id": "Blue Argon" if store == "chrome" and key.startswith("remote-code") else None,
                "exceptions": "Chrome debugger/userScripts APIs and isolated sandbox contexts require individual review; normal remote data is not executable code." if key.startswith("remote-code") else "Assess applicability against the official policy and declared purpose.",
            }})

    # Resolve extension entrypoints; malformed structures are explicit findings.
    references = []
    for key in ("action", "browser_action", "page_action", "options_ui", "background"):
        value = manifest.get(key)
        if isinstance(value, dict):
            for field in ("default_popup", "page", "service_worker"):
                if isinstance(value.get(field), str):
                    references.append(value[field])
            if isinstance(value.get("scripts"), list):
                references.extend(v for v in value["scripts"] if isinstance(v, str))
    if isinstance(manifest.get("options_page"), str):
        references.append(manifest["options_page"])
    for value in (manifest.get("chrome_url_overrides") or {}).values() if isinstance(manifest.get("chrome_url_overrides"), dict) else []:
        if isinstance(value, str):
            references.append(value)
    for script in manifest.get("content_scripts", []) if isinstance(manifest.get("content_scripts"), list) else []:
        if isinstance(script, dict):
            for field in ("js", "css"):
                if isinstance(script.get(field), list):
                    references.extend(v for v in script[field] if isinstance(v, str))
    privileged_html = {p for p in references if p.endswith(".html") and p not in sandbox}
    permissions = manifest.get("permissions", []) + manifest.get("host_permissions", [])
    for store in stores:
        store_start = len(results)
        store_omitted = set(base_omitted)
        add(store, "package.root", "Root manifest is readable", "passed", "package", "A unique root manifest was parsed. This is not full schema or functionality validation.", "Validate all APIs and test the packaged extension.", "manifest.json", 1)
        add(store, "manifest.eligibility", "Manifest version and API eligibility", "needs_review", "package", f"Manifest V{manifest['manifest_version']}; check current target-store eligibility and API compatibility.", "Review the current store submission requirements; migrate unsupported APIs.", "manifest.json", 1)
        for ref in sorted(set(references)):
            if ref not in by_path:
                add(store, "package.missing-entry", "Declared entrypoint is not packaged", "violation", "package", "A manifest entry references a file not present at that case-sensitive package path.", "Include the declared file or correct its manifest path.", "manifest.json", None, ref)
        add(store, "permissions.scope", "Permission scope and justification", "needs_review" if permissions else "passed", "permissions", "Review requested access against the single purpose. Broad access alone does not establish a violation." if permissions else "No required permissions declared; optional and runtime access still require review.", "Remove unnecessary access, use optional permissions where appropriate, and document each permission.", "manifest.json", None, json.dumps(permissions))
        settings_changed = any(k in manifest for k in ("chrome_settings_overrides", "chrome_url_overrides"))
        add(store, "settings.consent", "Browser settings, consent and reversibility", "needs_review", "settings", "Manifest declares browser setting overrides." if settings_changed else "No manifest overrides detected; runtime API use and consent have not been verified.", "Disclose changes, obtain appropriate consent, use supported APIs and provide a reversible path.", "manifest.json", None, "Declaration supplied; see the retained declaration snapshot." if declarations.browser_settings else "Not supplied")
        csp = manifest.get("content_security_policy")
        extension_csp = csp.get("extension_pages", "") if isinstance(csp, dict) else csp if isinstance(csp, str) else ""
        script_directives = " ".join(re.findall(r"(?:^|;)\s*script-src(?:-elem|-attr)?\s+([^;]*)", extension_csp))
        if "'unsafe-eval'" in script_directives or "'unsafe-inline'" in script_directives:
            add(store, "security.csp", "Unsafe extension-page CSP directive", "violation" if store == "chrome" and manifest["manifest_version"] == 3 else "needs_review", "security", "The declared extension-page CSP includes an unsafe script directive. Review manifest-version restrictions and whether this is a sandbox-only context.", "Remove prohibited unsafe directives from the extension-page CSP; bundle executable scripts locally. Review any sandbox-specific policy separately.", "manifest.json", None, extension_csp)
        for key, label, supplied in (("purpose", "Single-purpose declaration", declarations.purpose), ("privacy", "Privacy and data-use declarations", getattr(declarations, store).privacy_text), ("listing", "Store listing evidence", getattr(declarations, store).description)):
            add(store, f"declarations.{key}", label, "needs_review" if supplied else "not_assessed", "privacy" if key == "privacy" else "listing", "Declaration supplied; consistency with actual behaviour requires review." if supplied else "Not supplied. This requirement has not been assessed.", "Provide accurate declarations and compare them with code and runtime behaviour.", method="declaration")
        for file_index, f in enumerate(executable):
            if len(results) - store_start >= 400:
                store_omitted.update(entry["path"] for entry in executable[file_index:])
                break
            text = f.get("content")
            if text is None:
                continue
            if f["path"].endswith(".html"):
                parser = Scripts()
                parser.feed(text)
                for line, src in parser.remote[:20]:
                    decisive = store == "chrome" and manifest["manifest_version"] == 3 and f["path"] in privileged_html
                    add(store, "remote-code.script", "Remote script reference", "violation" if decisive else "needs_review", "security", "An extension HTML entrypoint references executable code outside the package." if decisive else "Remote script reference found; execution context and store-specific exceptions require review.", "Package executable logic locally where required; review sandbox/API exceptions rather than deleting legitimate remote data.", f["path"], line, src)
                if len(parser.remote) > 20:
                    store_omitted.add(f["path"])
            # Signals, not a JavaScript data-flow proof. Comments/string examples can match.
            if re.search(r"\b(?:eval|Function|importScripts)\s*\(|\.createElement\s*\(\s*['\"]script", text):
                match = re.search(r"\b(?:eval|Function|importScripts)\s*\(|\.createElement\s*\(\s*['\"]script", text)
                line = text[:match.start()].count("\n") + 1
                add(store, "remote-code.dynamic", "Dynamic code-loading signal", "needs_review", "security", "Lexical signal only; verify whether this code executes, where input comes from, and whether a documented exception applies. A remote URL alone is not a violation.", "Trace the executable input. Bundle logic locally if required; do not treat a parser as a sanitizer.", f["path"], line, text.splitlines()[line - 1][:600])
            for label, pattern in (("Insecure transport signal", r"http://[^\s'\"<>]+"), ("HTML injection sink signal", r"\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b"), ("Privileged message handler signal", r"\b(?:onMessageExternal|externally_connectable)\b")):
                signal = re.search(pattern, text)
                if signal:
                    add(store, "security." + re.sub(r"\W+", "-", label.lower()), label, "needs_review", "security", "Static signal found. Check data origin, execution context, validation and whether the code is reachable; the signal alone does not demonstrate exploitation.", "Trace the input and destination, apply appropriate validation or safe APIs, and test legitimate behaviour.", f["path"], text[:signal.start()].count("\n") + 1, signal.group()[:500])
        omitted_by_store[store] = len(store_omitted)
        omitted.update(store_omitted)
        add(store, "inspection.coverage", "Packaged executable inspection coverage", "not_assessed" if store_omitted else "passed", "package", f"{len(store_omitted)} executable entries could not be fully inspected." if store_omitted else "All recognized executable text entries were visited. This does not establish runtime safety or complete JavaScript analysis.", "Review unsupported files and limits before submission.", evidence="\n".join(sorted(store_omitted)[:50]))
    for rule in catalogue(stores):
        add(rule["store"], rule["rule_id"].split(".", 1)[1], rule["title"], "not_assessed", rule["category"], "Manual policy review required. Package analysis alone cannot verify this requirement.", "Review the official section, supply supporting evidence and record reviewer notes.", method="manual")
        results[-1]["details"]["policy_url"] = rule["policy_url"]
        results[-1]["details"]["verification"] = "Review the current official section and collect evidence that the requirement is met. Record assumptions and any runtime or account checks still needed."
        if rule["title"] == "Chrome Apps":
            results[-1].update(outcome="not_applicable", priority=4)
            results[-1]["details"]["explanation"] = "This package is an extension rather than a Chrome app. Other applicable store policies remain in scope."
    return redact_evidence(results), {"outcomes": dict(Counter(r["outcome"] for r in results)), "total": len(results), "inspected_executable_files": max(0, len(executable) - len(omitted)), "omitted_executable_files": len(omitted), "omitted_by_store": omitted_by_store, "limitations": LIMITATIONS, "policy_version": VERSION}


def comparison(before, after, compatible=True):
    def fingerprint(row):
        d = row["details"]
        return (row["store"], row["rule_id"], d.get("path"), d.get("evidence"))
    old, new = {}, {}
    for target, rows in ((old, before), (new, after)):
        for row in rows:
            if row["outcome"] in ("violation", "needs_review"):
                target.setdefault(fingerprint(row), []).append(row)
    output = []
    for key in sorted(old.keys() | new.keys(), key=str):
        a, b = old.get(key, []), new.get(key, [])
        ambiguous = not compatible or len(a) > 1 or len(b) > 1
        category = "needs_review" if ambiguous else "still_present" if a and b else "new" if b else "no_longer_detected"
        output.append({"category": category, "before_ids": [r["id"] for r in a], "after_ids": [r["id"] for r in b], "title": (b or a)[0]["title"], "path": key[2]})
    return output


def notice(result):
    d = result["details"]
    return {"kind": "illustrative", "label": "Illustrative example — not a notice sent by Google or Microsoft",
        "store": result["store"], "title": result["title"], "notification_id": d.get("notification_id"),
        "message": "A store review may request changes when an extension does not meet this policy. This example describes a possible concern, not an actual rejection or a prediction.",
        "remedy": d["remedy"], "policy_url": d["policy_url"],
        "help_url": TROUBLESHOOT if result["store"] == "chrome" else EDGE,
        "reference_available": result["store"] == "chrome" and d.get("notification_id") == "Blue Argon"}
