# Login, logout and recovery repair

## Delivered

- Existing Archon logo, colours and desktop illustration; form-first mobile layout. Removed the inactive GitHub option and unsupported access claims.
- Email/password sign-in, signup confirmation, password visibility, Caps Lock feedback, accessible native field validation, neutral email instructions and a 60-second resend cooldown. Existing passwords are not subject to signup length validation and are never trimmed.
- A single SDK event bridge captures verified recovery even before React mounts. One shared provider handles initialization, session errors, recovery, stale responses and deduplicated prefetching. `useAuth` remains compatible.
- Recognized internal return destinations only. Protected app, workspace creation/settings and source workbench entry points. Workspace creation follows a successful empty membership query, not a network failure.
- Local-browser logout by default, an account menu on desktop/mobile, failure/retry feedback, and a separately confirmed global action in Profile. No promise of immediate access-token revocation.
- User-scoped shared query keys and browser history. Account changes cancel private requests/downloads and remove in-memory queries; protected content/editor components unmount. Accepted backend scans are not deleted or cancelled.
- Audits, legacy reports, graphs, AI chat, workspace choice and workbench job references use account-scoped storage. Late legacy scan/chat callbacks check their captured account generation. Unowned old keys remain untouched and hidden, with an explanation in Profile. This is account isolation, not encryption.
- Recovery checking, unavailable, valid, password-updated and signed-out states are distinct. Ordinary sessions do not authorize a recovery form. After a successful password update, failed sign-out retries only sign-out. Callback credentials/errors are removed from the URL after SDK processing.

## Verification

- `npm run test:auth`: 8 checks, including explicit logout scopes, callback destinations, private request cancellation and pre-mount recovery events.
- Findings (7), Reports (7), Attack Graph (11), audit/progress (17) and summary/escaping (9) regressions passed.
- `npm run test:rls`: 228 isolated Postgres checks passed. No migration or RLS policy was changed.
- TypeScript, focused authentication/shared-data lint and production build checked.
- Two backend JWT claim-validation checks passed; the socket-based auth test was not rerun because it requires the unavailable approval service.
- Isolated browser fixtures passed 12 checks: short existing passwords, signup confirmation/cooldown, reset instructions, ordinary/expired recovery links, password-success/logout-failure retry, local logout retry, stale initialization, light/dark desktop/mobile layouts. Screenshots: `output/playwright/auth-{light,dark}-{390,1440}.png`.
- Browser recovery tests use synthetic sessions only. The real user's password and other-device sessions were not modified. No real confirmation/recovery emails were sent intentionally.

## Remaining hosted verification

The approval service hit a usage limit before read-only hosted Auth configuration inspection and the full backend/socket/browser smoke checks could be executed. This is a verification limitation, not evidence of a hosted configuration defect.

Before production rollout, verify Supabase email delivery and exact allowed destinations for every deployed origin:

- `<origin>/login` for signup and confirmation resend.
- `<origin>/reset-password` for recovery.

For local development the current origin is `http://127.0.0.1:5173`; add `http://localhost:5173` equivalents only if used. Do not add wildcard destinations or disable email confirmation. Complete a real email-confirmation/recovery test with an isolated account, multi-tab logout/refresh, and authenticated Dashboard/Findings/Reports/Workbench smoke checks once approvals are available. No SMTP/security settings were altered.

The full repository already contains unrelated lint issues; focused lint does not assert that the entire repository is lint-clean. The isolated browser checks preceded the final request-cancellation/SDK-bridge hardening, which has additional automated regressions; rerun `tests/auth-preview/checks.js` after restoring browser approvals.

## Reproduce isolated UI checks

Run `node node_modules/vite/bin/vite.js --config tests/auth-preview/vite.config.ts` and open `http://127.0.0.1:5178/tests/auth-preview/index.html`. The fixture replaces Supabase and prefetch dependencies; it must never be used as a production auth route. `tests/auth-preview/checks.js` is a Playwright CLI `run-code` function (omit its trailing semicolon when passing it as the function argument).

No OAuth, MFA, magic links, backend auth-policy changes, scan/model changes or new database schema are included.
