# Design prompts

Generated with the built-in image-generation tool, using `docs/screenshots/workbench.png` as the app-shell reference. No application code was changed.

## Extension Review

Use case: ui-mockup. Create one polished professional desktop ARCHON product UI screenshot for future Chrome Extension Review feature. Use provided image ONLY as style/app-shell reference. Match actual ARCHON wordmark, white left sidebar, warm cream #f5f1ec background with extremely subtle infrastructure line drawing, white cards, charcoal text, orange #ff5600 selected accents, fine gray borders, flat 5px radius, Inter text and JetBrains Mono code. Large landscape composition 1800x1250, crisp legible typography. Designed by a meticulous enterprise product designer, practical and restrained. No robots, sparkles, AI branding, gradients, floating blobs, fake live telemetry, excessive dashboards or glowing rings. Remove all test-fixture chrome from reference. Use simple outline icons only.

Sidebar ~200px wide: ARCHON logo, "Research workspace", nav Dashboard, Codebase Audit (active), Attack Graph, Findings, Fix verification, Reports, Audit log, Security Advisor, Settings. Main canvas title "Extension Review", subtitle "Review code, store policies and listing quality before submission." Top right small "Example audit" badge and "Export report" button.
Compact type navigation: Project ZIP | Chrome extension (active) | Infrastructure.
Project bar "FocusTab · Manifest V3" and "Package + listing + website supplied"; short workflow "Upload → Review → Fix → Recheck → Submit in Chrome Web Store".
Five equal compact white metric cells, exact numbers and denominator labels:
"Policy checks" "38 / 52" "14 require manual review"
"Security checks" "80%" "24 of 30 passed"
"Store listing" "75%" "9 of 12 passed"
"Website SEO" "70%" "7 of 10 passed"
"Answer readiness · ASEO" "60%" "6 of 10 passed"
One thin note underneath "Illustrative Archon rubrics · Open findings remain · Scores do not predict approval or ranking."
A compact status bar "Review complete" plus red "1 policy violation", amber "2 need review", "Source + listing evidence". NOT green allclear.

Main workbench large three-column panel about 760px tall:
LEFT narrow Files explorer heading, search field, folder focustab, entries manifest.json, src/background.js SELECTED, src/feature.js, popup.html, privacy.md, store-listing.json, website/index.html. Lower left separated navigation "Review areas": Policies, Permissions, Privacy, Security, Listing & search; footer "Read-only snapshot".
CENTER widest editor with tabs background.js active / manifest.json / Proposed diff and top-right "Full screen". Show path src/background.js with line numbers and professionally highlighted syntax:
17 const endpoint = "https://cdn.example.com/feature.js";
18
19 fetch(endpoint)
20   .then(response => response.text())
21   .then(code => eval(code));
Highlight lines19–21 pale red with margin marker. Below inline callout red border "Remote JavaScript execution" and small "Manifest V3 · Code requirements".
Then a clearly separate green tint proposed remedy section "Suggested replacement · Review before use", code:
import { startFeature } from "./feature.js";
startFeature();
Below short text "Bundle feature.js in the extension package. Use a module service worker."
Below code at bottom a problems table tabs "Findings 3 | Policy coverage | Listing & search", rows:
Violation | Remote code execution | background.js:21
Needs review | Broad host access | manifest.json:12
Needs review | Privacy disclosure mismatch | privacy.md
One selected highlighted row. Neat source lines, realistic code editor.
RIGHT detail pane generous 420px: heading "Finding & remedy"; orange-red small "Policy violation" tag, title "Remote code is executed", source src/background.js:19–21.
Sections ordered:
"Rule" -> "Chrome Web Store · Manifest V3 code requirements" with small "View official policy ↗".
"Why it violates" -> "JavaScript fetched from a remote server is executed in the extension service worker."
"Remedy" -> "Include the script in the submitted package and import it locally. Confirm the replacement preserves functionality."
"Verify the change" -> "Reload the extension. Test the feature. Confirm no downloaded scripts are executed. Recheck the package."
Neutral footer "Google makes the final publication decision."
Equal-height buttons "Review suggested diff" primary charcoal, "Recheck package" outline. Tiny note "No changes applied".
Bottom slim footer "Example data · Policy sources checked 24 Oct 2026 · Manual checks remain visible".

Ensure clear reading hierarchy, alignment and generous gutters, all app panels contained. This is a single real-looking UI screen, no annotations outside the product, no watermark, no invented official Google score or approved badge.

## Infrastructure Review

Use case: ui-mockup. Create one crisp, polished, professional desktop ARCHON future feature UI screenshot titled "Infrastructure Review". Use attached screenshot ONLY as reference for Archon brand and app shell, not content. Same white sidebar, ARCHON wordmark, cream #f5f1ec subtle infrastructure-line backdrop, white panels, charcoal text, thin warm-gray borders, 5px radii, restrained orange #ff5600 active accents, Inter labels, JetBrains Mono code. Landscape 1800x1250; coherent three-column VS Code-like review environment, very legible. No AI branding, sparkle symbols, robots, glows, gradients, lorem ipsum, gratuitous telemetry or ornamental charts. No test fixture banner. Show synthetic example data clearly.

Sidebar ~200px with ARCHON logo and Research workspace; nav Dashboard, Codebase Audit selected, Attack Graph, Findings, Fix verification, Reports, Audit log, Security Advisor, Settings.
Main header "Infrastructure Review", subtitle "Inspect configuration, connect evidence and review safe changes." Top right small neutral "Example audit" and black "Export report".
Type tabs "Project ZIP | Chrome extension | Infrastructure" with Infrastructure active orange.
Project header "Checkout platform · Staging" below "18 files supplied · Kubernetes, Docker, Terraform and logs"; horizontal workflow "Upload → Validate formats → Review → Verify changes".
Four equal compact metrics:
"Baseline checks" "78%" "39 of 50 passed"
"Open findings" "11" "2 high · 5 medium · 4 low"
"Review coverage" "50 / 62" "12 require runtime evidence"
"Control mappings" "3 frameworks" "Suggested mappings for review"
Small note "Example results · Selected baseline checks, not a compliance certification."
One compact line "Policy pack: Kubernetes Pod Security Standards / Restricted" and "Target Kubernetes version: selected per audit".
Small selectable chips "Kubernetes YAML" "Dockerfile" "Compose" "Terraform" "JSON" "Logs".

Large centered workbench roughly 750px tall, file tree left 210px, editor center widest ~600px, detail panel right ~390px.
LEFT heading "Files & resources", search field. Explorer tree realistic indentation:
checkout-platform
  k8s
    deployment.yaml selected (2)
    service.yaml
    network-policy.yaml
    rbac.yaml
  Dockerfile (1)
  compose.yaml
  terraform
    main.tf
  config
    app.json
  logs
    access.jsonl
    workload.log
Lower small panel "Evidence scope", rows "Configuration: parsed", "Logs: supplied time window", "Live cluster: not connected".
CENTER toolbar tabs deployment.yaml active | Dockerfile | Proposed diff, "Full screen". breadcrumb "k8s / deployment.yaml / container: api". Syntax-highlighted YAML readable line numbers:
12 spec:
13   containers:
14     - name: api
15       image: example/checkout:1.4
16       securityContext:
17         privileged: true
18         allowPrivilegeEscalation: true
19       ports:
20         - containerPort: 8080
Highlight17–18 pale red, red gutter marker. A compact inline callout "Privileged container conflicts with selected baseline".
Below clearly labeled proposed diff with removed red and added green lines:
- privileged: true
- allowPrivilegeEscalation: true
+ privileged: false
+ allowPrivilegeEscalation: false
+ capabilities:
+   drop: ["ALL"]
Caption "Focused proposal · Other baseline requirements still need review."
Below code, tab bar "Findings 11 | Resource links | Log evidence | Control mappings". Small table columns Severity / Finding / Location:
High | Privileged container | deployment.yaml:17
High | Credential-like value | app.json:8
Medium | Container runs as root | Dockerfile:14
Medium | No network isolation declared | k8s/
No fake CVE or CVSS.
RIGHT details: small badge "High · Configuration", title "Privileged container", source "k8s/deployment.yaml:17–18".
"Why this matters" body "Privileged mode grants broad host access. This violates the selected Pod Security baseline."
"Baseline reference" -> "Kubernetes Pod Security Standards" link "View official control ↗".
"Suggested remedy" -> "Disable privileged mode and privilege escalation. Drop unused capabilities. Test workload requirements before deployment."
"Verify" -> "Validate the rendered manifest. Test the workload in staging. Recheck the selected policy pack."
Small neutral status "Runtime verification pending".
Subpanel "Related log evidence" with "workload.log · supplied sample" and mono line "request_id=sample-42 status=403". Caption "Context only; this log does not prove the finding."
Two equal full-width buttons "Review proposed diff" charcoal and "Export patch" outline. Small footer "No changes applied. Deployment remains under your control."
Bottom thin bar "Read-only source · Secrets redacted · No repository scripts executed".
Polished restrained modern engineering SaaS, no cuts/overlapping text. Preserve professional Archon identity and understandable wording. Single full application screenshot, no presentation annotations.

## Infrastructure correction

The selected image was edited to use a Deployment excerpt with spec.template.spec.containers nesting and privileged/allowPrivilegeEscalation at lines 17–18. Preserve all other interface elements. Raster mockups are reference designs, not executable source.

