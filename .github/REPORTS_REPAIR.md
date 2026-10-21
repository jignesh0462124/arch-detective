# Reports repair and verification

Implemented on 20 October 2026. Scope: Reports library, report preview, authenticated PDF generation, ZIP export and the necessary shared report/data-layer repairs. Scanning and model analysis were not changed.

## User-facing changes

- One library entry per completed saved scan, with actual counts and assessed frameworks. No invented PDF records, scores, file sizes or signatures.
- Search by project/full scan ID, framework filter, Reset and stable cursor pagination (25 reports per page). Available and filtered totals are separate.
- Distinct loading, empty, no-match, failed-request and unavailable/access-denied states. Running scans never replace completed results.
- Saved summary, priorities, severity totals, coverage and limitations. Findings page through 50 at a time; selected evidence/remediation/control mappings open in an accessible native dialog with Escape dismissal.
- PDF framework scope defaults to recorded assessments. Deselecting all frameworks produces a security-only report; security findings are never removed by this selection.
- Selected-report ZIP export: sequential authenticated PDFs, progress, cancellation, 20-report/50-MiB limits and a manifest identifying failed PDFs. Access failures cancel the archive, rather than silently exporting a subset.
- Legacy `scan_` browser reports remain explicitly separate. Saved UUID scans cannot be restored from a browser cache after deletion or denied access. Malformed legacy storage is isolated.

## API, performance and security

- `GET /api/v1/workspaces/{workspace_id}/report-library`: summary-only cursor page with exact matching and available totals.
- `GET /api/v1/workspaces/{workspace_id}/report-library/{reference}`: authorized preview, including safe resolution of real report UUIDs and unambiguous historical links.
- Existing `GET /api/v1/scans/{scan_id}/workbench/report` retains compatibility and accepts optional `workspace_id` and `frameworks` parameters. It uses persisted, redacted evidence and reauthorizes after generation/cache retrieval.
- Existing paged findings endpoints provide summaries and on-demand full details. Opening a report does not load the parent library or every finding.
- The PDF fingerprint includes complete evidence, triage state, mappings, workspace/scan, framework scope and template version. Cache: at most eight PDFs, 50 MiB and ten minutes. Rendering: two concurrent operations, bounded admission and retryable busy responses.
- PDFs are never written to the legacy public cache by the authenticated flow. Source retention and private Storage are unchanged. New report evidence/PDFs are not persisted in browser storage.
- `fflate` is pinned to 0.8.3 and loaded only for ZIP export.

## Supabase rollout

Migration `20261020045234_report_library_counts.sql` was applied to the existing `group-project` project and its version was verified in hosted migration history. Old migrations were not replayed.

Both functions (`report_scan_counts` and `resolve_report_scan`) use security-invoker execution and an empty search path. Authenticated execution is granted; anonymous/public execution is revoked. Existing table RLS policies were not relaxed.

Hosted security advisors report the existing Auth warning **Leaked Password Protection Disabled**. No report-function security warning was reported. Auth settings were deliberately left unchanged.

## Verification

- Backend: **172 passed, 4 skipped**, using the project's Python 3.12 virtual environment and an isolated temporary root. The sole warning is an intentionally duplicated ZIP entry fixture.
- RLS: **228 checks passed**, including new report aggregates/link resolution for owners, admins, analysts, viewers, outsiders and anonymous callers.
- Frontend regressions: **43 passed**, covering Reports, Findings, scan progress, audit views, Attack Graph and summary/export escaping. Reports includes seven dedicated unit tests.
- Browser: **14 checks passed**, covering eight-PDF ZIP export, paging/search, both actual themes, desktop/mobile overflow, evidence-dialog keyboard behavior, framework/security-only scope and empty/error/denied states.
- The downloaded synthetic ZIP was opened and verified: eight PDFs, eight manifest entries and valid PDF headers.
- TypeScript, focused ESLint, production build and client-secret checks passed. The final client-secret check inspected 101 public assets without printing credentials.
- The actual PDF engine produced an eight-page synthetic report; rendered cover, summary, framework and evidence pages were visually inspected. Zero scores and missing scores remain distinct.
- Live authenticated Reports loaded seven completed hosted scans with correct counts; the 90-file fixture PDF download and a ZIP containing both synthetic 90-/500-file audit reports succeeded. No new scan or model call was made.
- Live Dashboard, Attack Graph and Findings navigation rendered successfully. The completed 500-file Audit Workbench reopened its source editor and retained its zero-findings state and report actions.

Repository-wide lint was also attempted. It still reports unrelated existing formatting/type-style issues in older scripts and shared source; these were not auto-fixed as part of Reports. Focused lint for all new/changed Reports code and the RLS script is clean.

## Rechecking

Run `npm run test:reports`, `npm run test:rls`, `npm run typecheck` and `npm run build`. Backend tests run from `threatlens` with its virtual-environment Python. `tests/reports-preview` is an isolated synthetic UI harness, not a production route. The PDF layout fixture is generated by `threatlens/scripts/verify_report_pdf.py`.

No production frontend/backend deployment, new review/approval workflow, immutable report-version system or rescan/model invocation was introduced.
