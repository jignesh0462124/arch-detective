# Post-login access and scan deletion

## Changes

### Authentication

An isolated live sign-in reproduced the reported failure: Supabase accepted a newly issued ES256 session, while the API rejected its `iat` claim. The local Windows clock was approximately 136 seconds behind Supabase. Frontend and backend project settings matched; this was not evidence of an expired sign-in.

- RS256/ES256 signatures, issuer, audience and required user claims remain checked locally against JWKS. Key-set caching expires after five minutes; an unknown key triggers one refresh.
- A time-related rejection retains signature/issuer/audience checks and asks the configured project's Auth `/user` endpoint to confirm validity on its own clock. After confirmed skew, Auth remains the time authority for that verifier's lifetime, so a slow local clock cannot extend later tokens' validity. No arbitrary JWT leeway or system-clock changes were introduced.
- Legacy HS256 sessions require Auth-server verification. Decoding their claims does not grant access.
- Auth validation uses a public project gateway key, never the service-role key or a locally configured signing secret. Configure `SUPABASE_PUBLISHABLE_KEY`; local development also accepts `VITE_SUPABASE_PUBLISHABLE_KEY` from the existing root environment file. Both modern publishable keys and legacy anon keys work; secret/service-role keys are rejected for this purpose.
- Invalid credentials return 401, denied account access returns 403, and unavailable/malformed signing-key or Auth services return 503. Auth responses and credentials are not logged.
- Concurrent remote checks share one in-flight operation per session, with bounded admission. Browser validation and refreshes are also deduplicated.
- After a backend 401, the browser validates through Supabase and rereads the SDK's current session. A safe GET may retry once with a changed token. Uploads, chat submissions and deletes are never automatically replayed. A backend outage or Auth 403 does not announce session expiry.

Keeping Windows automatic time synchronization enabled is still recommended for the development environment; this repair does not change that setting.

### Codebase Audit → History → Delete

Owners and admins see Delete beside completed and failed codebase scans. Other roles do not see it. Active scans explain why deletion is unavailable.

The keyboard-accessible confirmation shows the project and date, focuses Cancel, traps focus, supports Escape before submission and restores focus afterward. It explains permanent removal of the saved audit, findings, report entries and source previews. Original ZIPs, repositories, external GitHub branches/PRs and downloaded files are untouched.

Deletion is one Supabase operation matching scan ID, workspace ID, codebase type and eligible status, protected by the existing RLS policy. Exactly one matching returned row is required for success. Zero-row, revoked-access and failed writes retain the row and show a retry path. Duplicate clicks are blocked. Requests have a 20-second client timeout; a lost response is not treated as confirmed success.

The existing database cascades and durable private-source cleanup queue remain unchanged. Storage cleanup is asynchronous. Account/workspace-scoped scan, source, finding and report caches are cleared; library/selector queries are invalidated. Search/status filters remain selected and an empty last page moves back to a valid page. No local audit history is deleted.

## Verification

- Live disposable Auth account: immediate protected request returned 200; authorized finding-count and report-library reads passed.
- Live disposable completed scan: owner RLS deletion returned the exact scan; findings, report entries, snapshots, files and locations cascaded; deleted scan reads returned 404. No existing project audits were used.
- Live private-source cleanup passed: the maintenance worker removed the disposable preview through the existing durable queue. The live check uses authoritative Storage metadata, not potentially cached download responses.
- Authentication regression coverage includes clock skew, invalid signatures/claims, legacy sessions, key rotation, malformed/offline verification services, secret-key rejection and concurrency.
- Frontend coverage includes safe-read retries, no mutation replay, account switches, zero-row and rejected deletions, pagination correction and scoped cache removal.
- Isolated PostgreSQL suite: 343 RLS checks, including owner/admin versus analyst/viewer/outsider/revoked/anonymous access, active-scan protection and cascades.
- Browser fixture checks cover completed/failed deletion, retained rows on failure, role controls, filters, keyboard/focus, desktop/mobile and both themes. Preview screenshots are in `output/playwright/delete-scan-*.png`.
- Backend regressions: 271 passed, 4 skipped. Frontend regressions: 70 passed. TypeScript, focused lint and the production build pass.

The disposable verifier is `threatlens/scripts/verify_auth_scan_deletion.py` (run from the project root with `PYTHONPATH=threatlens`). `--baseline` reports only sanitized failure categories; `--wait-cleanup` verifies asynchronous source removal. It provisions only its own fixtures and removes its own workspace and account. Fixture provisioning uses the admin API; acceptance reads and scan deletion use the signed-in owner's token and RLS.

No new migration, RLS relaxation, model-routing change or scan-pipeline change is part of this repair.

Reference: [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts).
