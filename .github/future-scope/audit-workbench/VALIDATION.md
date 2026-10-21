# Workbench validation and activation

19 October 2026 — progressive-loading implementation, hosted migration/RLS and real ZIP-to-report verified. Local early opening is enabled. See [performance implementation and measured limitations](./PERFORMANCE_IMPLEMENTATION.md) for current results; older baseline details below are retained for context.

## Verified locally

- Backend: **147 passed, 4 skipped**. Covers ZIP indexing, unsafe paths, known credential masking, stable exact locations, zero findings, role denial/revocation, cross-snapshot IDs, idempotency conflicts, source expiry, Storage failure, report authorization/no-cache behavior and stale-job recovery, plus progressive/concurrency/pagination cases in the performance notes. Pipeline tests mock the AI provider; they do not establish real-model detection accuracy.
- RLS: **190 checks passed** in the local SQL harness, including all workspace roles, outsiders, browser write denial, cascade cleanup, aggregate RPC isolation and a pre-existing broad Storage policy. Hosted rollback-only verification also passed separately.
- Existing frontend regressions: audit/progress **17**, summary **9**, Attack Graph **11** checks passed.
- TypeScript and targeted ESLint checks passed. Production build passed; Monaco is lazy-loaded with only an editor worker, not the multi-megabyte TypeScript language-service worker.
- Isolated browser QA used real components and fixture-only networking. Desktop and 390px mobile layouts have no document-level horizontal overflow. Checked finding → file/line synchronization, missing CVSS, suggested control evidence, filename/finding filters, mobile inspector, light/dark editor themes, expired source, access denied, zero findings, upload layout and measured-stage animation.
- Screenshots below show **test fixtures**, not findings from the user's project:
  - [Workbench](./implemented-workbench-preview.png)
  - [Upload](./implemented-upload-preview.png)
  - [Scan animation](./implemented-scan-preview.png)

The Supabase skills informed the private bucket, restrictive Storage policy, additive metadata/RLS design, least-privilege grants and indexed relationships. Authenticated PDF exports explicitly bypass the legacy unauthenticated disk cache.

## Hosted verification completed

- CLI login now accesses the verified, healthy `group-project` project, reference `gzyxgqxycbccifajdoiu`.
- Applied only migration `20261019092935` and recorded its SQL/history atomically. Existing older schema migrations were not replayed or marked applied; the earlier workspace-hardening migration remains intact. A full `db push` still requires a separate, deliberate reconciliation of the older migration history—do not use `--include-all` blindly.
- Confirmed all five new tables have RLS, anonymous metadata access is denied, authenticated metadata reads are scoped and browser writes denied, and backend writes have the required grants. Cleanup queue remains server-only.
- Confirmed `audit-source` is private, has a 2 MiB/text-only limit, and has the restrictive anonymous/authenticated exclusion policy. The enum addition and private cleanup trigger are present; the cleanup function is not executable by anonymous callers.
- Ran [rollback-only hosted SQL verification](../../../supabase/security/verify_audit_workbench.sql): member read, outsider isolation, browser write denial, anonymous denial and cascade cleanup all passed. No synthetic scan/source metadata remains; no source objects were uploaded by this test.
- Hosted advisors: no performance warnings/errors and no new security warnings/errors. The pre-existing `auth_leaked_password_protection` warning remains unchanged; changing Auth settings is outside this migration.

## Activation and live verification

The backend credential is now configured in the ignored `threatlens/.env`. A fresh backend process successfully checked all workbench metadata tables and the private bucket; readiness returned `enabled: true`, 720-hour retention and a 50 MiB upload cap. Backend import passed. The separate secret entry in the tracked example file and its staged copy was cleared, preserving other staged changes. No credential value was displayed or added to these documents.

The backend was restarted, hosted progressive migration `20261019164441` applied and verified, and the live authenticated GHRCE upload → workbench → source/finding navigation → PDF flow passed. The 14-file job completed in 7.219 s. Synthetic 90-/500-file hosted jobs completed in 8.962/27.646 s, with first source publication at 2.146/4.803 s. Early opening is enabled in the ignored local environment; deployment defaults remain off. Browser-paint and production median targets are not claimed as passed.

## Limits and operational notes

- ZIP-first only; supporting documents, Git imports, editing, terminals and automatic fixes remain deferred.
- Source previews expire after 720 hours. Findings/reports retain their existing history behavior. Cleanup runs approximately every minute while the backend is running; expired source access is denied immediately by the API. Keep the backend running or schedule this maintenance separately in a future deployment.
- A server restart marks abandoned jobs failed after a three-minute heartbeat lease; jobs are not silently resumed or presented as complete.
- Known credential patterns are masked with line/column length preserved. Heuristic masking cannot guarantee discovery of every secret; remove sensitive material before upload. Files are read as inert text, never executed.
- Preview budgets: ZIP up to configured maximum capped at 50 MiB, source preview at most 2 MiB/file and 32 MiB total, windows up to 1,000 lines/256 KiB. Search results and upload concurrency are bounded. Analysis retains its documented 500-file/200,000-character-per-file coverage and sampled AI context.
- No full hosted load test, real-provider accuracy benchmark, production deployment or accessibility certification has been performed. Automated policy tests and UI fixtures do not replace hosted verification.

## Reproduce isolated UI checks

See [visual fixture instructions](../../../tests/workbench-preview/README.md). The separate test Vite config supplies fake authentication/workspace hooks and blocks external API calls; it is not part of the production routes or authentication flow.
