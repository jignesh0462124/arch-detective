# Cleanup and security repair handoff

Verification date: 4 November 2026. Earlier implementation was incorporated into commit `4113eab`; this continuation completes the removal inventory and outstanding local verification. **Local regressions pass, but security acceptance is not complete: newly published dependency advisories and live deployment checks remain.**

## Exact scope and recovery

- [Pre-edit baseline](cleanup-baseline.json): existing dirty files and content hashes, before cleanup.
- [Every changed/deleted file and reason](cleanup-changes.json): task-specific inventory, including formatting and QA evidence.
- [Removal manifest](cleanup-removals.json): 113 exact files, original hashes, rationale and recovery revision.

Removed five unused modules, 22 transient browser snapshots, 81 reproducible pytest files and five byte-identical screenshot copies. Canonical documentation screenshots, fixtures, research, compatibility wrappers, marketing animation and the chart callable remain. Removed tracked files can be recovered individually from the revision in the manifest. No blanket directory deletion was performed.

The newer research-script deletions, missing pytest `current` links and Graphify changes are unrelated and were not modified or attributed to cleanup. Existing application, migrations and settings work remains intact. No hosted schema, RLS, credential or account changes were performed.

## Repairs implemented

1. Advisor inline code retains URL fragments and literal `#` characters. HTML remains escaped.
2. Findings compatibility boundaries use validated types instead of three explicit `any` values.
3. Unauthenticated legacy `/api/local` routes require explicit development enablement plus loopback peer, Host and allowed Origin checks. They remain disabled in production. The public deliberate-error route was removed.
4. Uploaded Python requirements are never resolved or installed: only exact sanitized pins reach `pip-audit --no-deps --disable-pip`. Unsupported syntax or incomplete dependency coverage cannot be reported as clean.
5. Scanner stdout/stderr is bounded while being read; subprocess timeout/output-limit handling is tested.
6. PDF Chromium sandbox remains enabled; the inline report template blocks external resources and WeasyPrint resource fetching is denied. The six-page synthetic report was visually inspected during the earlier implementation run.
7. Client build checks cover server credentials, GitHub secrets and private-key/token signatures without printing secret values.
8. Unused frontend dependencies were removed, targeted DOMPurify/selector-parser patches applied, and Python install profiles documented. Tenacity constraints, multipart declaration and Groq/HTTPX client compatibility were corrected. Model choices and provider routing remain unchanged.

## Verification results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed on 4 November |
| `npm run lint` | Passed, zero errors; one existing fixture Fast Refresh warning |
| `npm run build` | Passed, production client/server output; existing large-chunk/mixed-import warnings remain |
| All `tests/*.test.mjs`, with `FRONTEND_TEST_URL=http://127.0.0.1:5195` | 102 passed, including 10 real SSR routes |
| Isolated Python profile, `pytest threatlens/tests -q` with fresh basetemp | 315 passed, 4 explicitly opt-in external-service tests skipped |
| `npm run test:rls` | 369 isolated policy checks passed; no hosted database connection |
| `node scripts/check-client-secrets.mjs` | 95 public assets passed; no credential values printed |
| Clean profile `pip check` | Passed |
| Clean npm install / clean Python test profile / full Python resolution | Passed during October implementation; full worker was resolution-only, not deployed |
| `git diff --check -- .github/maintenance` | Passed for this continuation; whole-worktree inspection encounters unrelated inaccessible pytest `current` links |
| Current `npm audit` | **Failed: 15 moderate affected packages; zero high/critical. Do not reuse the October zero-vulnerability claim.** |

The clean Python profile is under ignored `output/cleanup-python-profile`; exact test pins and setup boundaries are documented in [INSTALLATION.md](../../threatlens/INSTALLATION.md). The four skips require real Supabase, Redis/worker, scanner binaries or provider access. Tests use synthetic credentials and isolated data.

## Browser evidence

Browser plugin was not available; the existing Playwright CLI fixture workflow was used. Isolated fixtures do not establish live integration success.

Earlier October checks passed for login/signup/recovery/logout failure and retry, Advisor history and code suggestions, resume navigation, workspace settings, History pagination, graph zoom/centering, Findings pagination/triage/export, Reports including an eight-PDF ZIP, and simulated GitHub review/publishing. Desktop 1440px and mobile 390px, light and dark themes were exercised.

On 4 November, `tests/audit-deletion-browser.cjs` completed against `http://127.0.0.1:5193/tests/workbench-preview/index.html`. It verified History → Delete → confirmation → row/count removal; failed/zero-row writes retain the row and offer Retry; owners/admins have controls while analysts/viewers and active scans do not. Escape, focus trapping/restoration, preserved filters and both theme/viewport combinations passed. The page title and meaningful fixture content were present; no framework overlay or relevant console errors were recorded. The dark mobile confirmation screenshot was visually inspected and remained readable without clipping.

## Outstanding security and deployment gates

The refreshed registry audit reports Seroval `1.6.9` through TanStack serialization and minimatch `3.1.5`/`10.2.6` through lint tooling:

- [Seroval typed-array constructor injection](https://github.com/advisories/GHSA-f86p-h4j2-7qgj), patched at 1.6.11 according to the audit.
- [Seroval RegExp serialization injection](https://github.com/advisories/GHSA-9wx9-5pv9-3349), patched at 1.6.10 according to the audit.
- [minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249), affected below 11.0.1 according to the audit.

These are dependency findings, not proof of an exploitable application path. No speculative forced upgrade or lint-stack downgrade was applied. The next security batch must verify the TanStack serialization boundary with a focused reproducer and test a narrow Seroval update; minimatch needs compatibility review across its major versions. Until then, the vulnerability gate remains open.

Also not verified here: live hosted login-to-upload-to-report, real provider responses, full Linux Celery scanner deployment, hosted policy/advisor state, actual GitHub consent/PR publication, or private storage cleanup against a hosted account. Previously passing fixture checks do not replace these gates. Existing source retention, permissions and scan/model logic were not relaxed to make tests pass.

This report is a bounded verification record, not a guarantee that the project is bug-free or completely secure.
