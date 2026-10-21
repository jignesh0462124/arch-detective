# Findings repair

Implemented 20 October 2026. The scan pipeline, model analysis, applied migrations, RLS policies and source retention are unchanged.

## Behaviour

- Defaults to the newest completed scan; older completed scans are selectable with paged scan history. Running scans cannot replace completed results.
- Search, severity and status filters run in the database. Findings load 50 at a time with exact matching totals; scan-wide totals remain independent of filtering.
- Distinct persisted finding IDs are preserved, even when title/file/line match. Database errors are not converted into clean results or replaced with local history.
- Detail requests load redacted evidence, actual file/line, valid CVSS (including zero), remediation and compliance mappings only when selected.
- Resolve, Accept risk, False positive and Reopen persist through caller-JWT Supabase updates scoped to both finding and scan. Owners/admins/analysts can triage; viewers are read-only. Failed writes do not create browser overrides.
- CSV/JSON exports contain all matching results, not just one page. The server reads batches, honors lower PostgREST row caps, reapplies redaction, blocks CSV formulas and rejects incomplete/changing exports. Limit: 20,000 matching rows; narrow filters above that limit.
- Explicit loading/error/no-workspace/no-completed-scan/no-findings/no-matches states replace ambiguous empty lists. Empty scans do not claim that the project is vulnerability-free.
- Existing visual components/theme retained; responsive filters, wrapping paths, mobile detail scrolling and readable evidence/pagination contrast added.

## Interfaces and security

- `GET /api/v1/workspaces/{workspace_id}/finding-scans?offset=0`: caller-authorized completed scan summaries, 100/page.
- `GET /api/v1/scans/{scan_id}/workbench/findings`: existing endpoint, additive `state` and optional `workspace_id`; existing severity/search/offset behaviour retained.
- `GET /api/v1/scans/{scan_id}/workbench/findings/counts?workspace_id=...`: scan-wide totals through the existing security-invoker aggregate.
- `GET /api/v1/scans/{scan_id}/workbench/findings/export?workspace_id=...&format=csv|json`: same severity/status/search filters as the queue; completed scans only.
- Existing detail endpoint accepts optional `workspace_id`; the selected finding and controls are read using the caller's JWT.
- New query keys include user, workspace and scan; requests are abortable. Details are cleared when scope changes and after failed access checks. Source/evidence is not stored in persistent browser storage by this page.
- Legacy shared findings callers retain their signatures and full-scan behaviour. Explicit non-database local audits remain readable; persisted UUID scans never fall back to browser history or global status overrides.
- No hosted migration or policy relaxation is required. Backend deployment/restart is required alongside the frontend changes.

## Verification

- Backend: **159 passed, 4 skipped**. Coverage includes 1,205 finding records, matching totals, combined filters, same-location distinct IDs, authorization, lower row caps, exports, redaction and CSV safety.
- Isolated Postgres: **208 RLS checks passed**, including all four finding states, wrong-scan writes, viewer denial and revoked membership. No hosted finding states were changed by these tests.
- Frontend: **7 Findings tests**, **9 summary/report checks**, **11 Attack Graph tests**, **17 audit/progress tests** passed.
- Browser fixture: **15 functional checks passed**, covering paging, all status transitions, filters, exports, error/empty states, viewer access, rejected writes and mobile overflow. Additional light/dark evidence/pagination contrast checks passed.
- Live signed-in app: newest empty scan displayed correctly; an older ten-finding scan reopened with correct global totals; high-severity filtering returned three findings. Detail evidence/control mappings loaded. Hosted filtered CSV and JSON downloads each contained exactly three high-severity findings.
- Live compatibility smoke checks passed for Dashboard, Reports history, Attack Graph topology and reopening the retained-source 90-file Audit Workbench.
- TypeScript, focused ESLint, production build and client-secret checks passed. Existing bundler size/dynamic-import warnings remain unrelated to this repair.

## Reproduce browser QA

The fixture uses synthetic records, a fake session and an in-memory update adapter; it makes no hosted writes. Its separate Vite cache avoids interfering with the main application's dev server.

```powershell
npx vite tests/findings-preview --config tests/findings-preview/vite.config.ts
npx --package @playwright/cli playwright-cli -s=findings-qa open http://127.0.0.1:5176/ --headed
npx --package @playwright/cli playwright-cli -s=findings-qa run-code --filename=tests/findings-preview/browser-checks.js
npx --package @playwright/cli playwright-cli -s=findings-qa run-code --filename=tests/findings-preview/contrast-checks.js
```

Screenshots: `output/playwright/findings/desktop-light.png`, `desktop-dark.png`, `mobile-light.png`, `mobile-dark.png`.
