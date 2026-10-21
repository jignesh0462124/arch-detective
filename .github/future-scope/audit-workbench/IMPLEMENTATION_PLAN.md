# Audit Workbench implementation

Approved 19 October 2026. ZIP-first; automatically open after scan; sanitized source retained for 30 days.

## Workflow and design

Upload and configure → scan project → review in workbench. Reuse Archon's cream/white/charcoal/orange tokens, shared shell, Phosphor icons and fonts. The design references are `new-audit-upload-desktop.png` and `audit-workbench-desktop.png` in this folder.

The workbench combines a file explorer, read-only lazy-loaded Monaco source viewer, Evidence/Compliance/Remediation inspector, and synchronized Problems/Activity/Summary dock. Mobile switches between Files, Code and Findings; the inspector becomes a drawer. Selecting evidence opens its verified file and line. Missing or expired source has an explicit state. Reading files never invokes the model.

Scanning uses actual pipeline stages, progress, elapsed time and bounded events. Active-stage animation respects reduced motion; no fabricated file activity or ETA.

## Integration

- Extract a callback-driven analysis entry point from the working local engine; preserve the legacy wrapper and its tests.
- Add JWT-authenticated workbench orchestration and a Supabase REST repository against the deployed schema. Server owns scan IDs, stable findings, compliance evidence and completion; do not duplicate browser-side synchronization.
- Create immutable sanitized snapshots, file metadata, verified finding locations and durable job events. Save text in private Storage, never browser persistence.
- Add scan-specific workbench routing, history entry points, automatic opening and a link back to the existing report view.
- Keep the existing scanner available when the new backend capability is disabled or not configured. New source APIs always require authorization.

## Access and lifecycle

Use additive migrations. Existing workspace roles and hardened policies remain intact. Members may read; analysts/admins/owners may start scans; admins/owners may delete. Only the trusted backend writes source objects, manifests and locations. New tables have RLS and least-privilege grants; the private bucket has no public access. Membership is checked on each request. Credentials remain server-only.

Preview retention is 720 hours, independent of temporary input retention. Expiry preserves findings/reports. Deleting a scan enqueues object cleanup; periodic reconciliation handles expiry, partial failures and orphaned objects. A durable heartbeat identifies interrupted scans. Snapshot failures retain available analysis.

## API contract

Authenticated `/api/v1` endpoints: workspace audit capabilities/start; scan workbench overview/progress; source metadata/tree/file/search; scoped report export. Source bodies have `Cache-Control: no-store`, bounded windows and cancellation. Findings include stable IDs, exact location status, truthful scanner provenance, available CVSS and suggested compliance evidence.

## Delivery checklist

- [x] Approved design and scope saved.
- [x] Shared analysis entry point and archive/snapshot sanitization.
- [x] Supabase metadata migration, RLS, Storage isolation and cleanup implemented; local policy tests pass.
- [x] Authenticated APIs, durable events, idempotency and failure recovery.
- [x] Upload entry, scan animation, automatic workbench routing and history integration.
- [x] Monaco viewer, explorer, synchronized findings/compliance, responsive themes.
- [x] Local backend, frontend, RLS, build and isolated browser checks; see VALIDATION.md for scope and remaining checks.
- [x] Hosted migration applied to group-project; schema, private Storage policy, metadata grants and rollback-only RLS/cascade checks verified.
- [x] Backend credential configured; fresh-process readiness reports enabled and private Storage access succeeds. Example-file credential removed from working tree and staged template.
- [ ] Restart the running backend and verify a live ZIP upload/workbench flow.

## Acceptance

Verify ZIP → exact file/line → compliance evidence → report → history reopening. Exercise zero findings, unsupported files, corrupt archives, unsafe paths, expiry, old audits without snapshots, connection loss, restart, duplicate submission and indexing/storage failure. Test all roles, outsiders, anonymous access, forged file/scan IDs and membership removal. Confirm secrets are masked in source, snippets, search, clipboard and export. Preserve existing audit, summary, Attack Graph and RLS suites. Test both themes, keyboard access, reduced motion, mobile overflow and bounded loading for larger projects.

## Release prerequisites

Configure `SUPABASE_SERVICE_ROLE_KEY` only in the backend environment. Apply and verify the additive migration. `AUDIT_WORKBENCH_ENABLED` gates activation; readiness must pass before replacing the legacy upload transport. Historical audits without snapshots retain the existing results/report experience.

Current state: migration `20261019092935` is applied on the correct `group-project` project, and hosted RLS checks pass. The backend key is configured in the Git-ignored backend environment; a fresh process reports workbench readiness enabled. The existing development server must reload its environment before the live ZIP/workbench test. No credentials are recorded in these documents.
