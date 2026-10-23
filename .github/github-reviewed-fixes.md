# GitHub repository audits and reviewed fixes

## Current delivery status

The local implementation adds GitHub sign-in, separate App authorization, workspace repository sharing, pinned-commit scanning, a Fix Verification page, grounded proposals, inert syntax checks, reviewed branch/PR publication with recovery checkpoints, exact-head CI queries, explicit rescans and conservative comparisons. The public landing hero's View reports action was removed. Existing ZIP uploads and their Advisor guidance remain available.

**This is not yet a verified live release.** Repository scanning and publishing default to disabled. No production repository was changed, no real PR was created, and the new migration has not been applied to hosted Supabase during this work.

Remaining release work beyond credentials/configuration:

- Generation currently supplies one finding's verified source file. Validation supports at most five existing files, but automatic multi-file context selection is not delivered.
- ZIP audits retain Security Advisor suggestions; structured ZIP patch generation/download is not delivered. ZIP files are never implicitly associated with a GitHub repository.
- Repository downloading and proposal generation are bounded request operations, not durable queued operations with independent operation IDs. Accepted analysis jobs use the existing workbench job/restart recovery.
- Signed webhooks handle revocation, installation suspension/deletion and removed repository access. CI/PR views currently query GitHub while visible; webhook-driven CI snapshots remain to be added.
- Comparisons are computed from authorized saved scans. Durable comparison history, mapped-line matching and additional PDF/PR comparison references remain to be added. Ambiguous matches and changed/missing analysis provenance are Needs review, not verified fixes.
- A real email-user and GitHub-login-user scan → PR → CI → rescan acceptance test in an isolated repository remains required. Browser fixtures are not a substitute.

Do not describe the entire approved plan as production-complete until these items and the live checks are finished.

## Two separate GitHub connections

1. **Supabase sign-in:** Continue with GitHub uses Supabase OAuth. Keep email/password enabled. Configure Supabase's provider with its exact Supabase callback and allow the application's `/login` and `/profile` redirect destinations. Optional manual identity linking must be enabled for Profile's Link GitHub sign-in action. Use Supabase linking, never custom account merging. See [GitHub sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-github) and [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).
2. **Repository authorization:** Connect GitHub authorizes a separately registered GitHub App. Email users stay signed into their existing Archon account. Supabase's provider token is never used as a repository token.

## Backend configuration

Use `threatlens/.env` locally or the deployment's server-secret manager. Never paste keys into chat or commit them. Placeholders are in `threatlens/.env.example`.

| Setting | Purpose |
| --- | --- |
| `GITHUB_ENABLED` | Repository feature gate, initially false |
| `GITHUB_PUBLISH_ENABLED` | Independent publishing gate, initially false |
| `GITHUB_APP_SLUG` | GitHub App installation/manage-access link |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub App web authorization, not the Supabase OAuth application's credentials |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | A Fernet key generated locally using the installed cryptography library; keep it stable and private |
| `GITHUB_WEBHOOK_SECRET` | Strong independent HMAC webhook secret |
| `GITHUB_CALLBACK_URL` | Exact backend `/api/v1/github/callback` URL registered with the App |
| `GITHUB_FRONTEND_URL` | Frontend origin for the short-lived completion ticket |
| `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY` | Reserved App configuration; interactive operations currently use the user's App token, not installation JWTs |

Local defaults use `127.0.0.1:5173` and `127.0.0.1:8000`. If Vite uses 5174, configure the frontend URL and Supabase redirect allowlist accordingly. Keep the browser's API hostname and callback hostname identical: `localhost` and `127.0.0.1` do not share cookies. Production requires HTTPS and a same-site API/frontend deployment for the HttpOnly, SameSite=Lax state cookie. Do not disable browser cookie protections to accommodate mismatched deployment domains. Keep CORS restricted to actual frontend origins.

## GitHub App registration

Restrict installation to selected repositories. Permissions: Metadata read, Contents read/write, Pull requests read/write, Checks read, Commit statuses read. Do not grant Administration, Secrets or Workflows write. Enable expiring user access tokens. GitHub user tokens are restricted to permissions held by both the App and the acting user; see [token refresh and permission behavior](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens).

Register the exact backend callback above. Configure a publicly reachable HTTPS webhook at `/api/v1/github/webhook`. Subscribe to installation changes, installation repositories, authorization revocation, pull requests, check runs/check suites and commit statuses. Sign deliveries with the webhook secret. Event processing must never execute repository scripts.

## Database and access controls

New additive migration: `supabase/migrations/20261023093955_github_reviewed_fixes.sql`. It has not been applied to hosted Supabase here. Review and apply only this pending migration through the normal deployment process; never replay old migrations or edit already-applied migrations. Run hosted security/performance advisors and confirm grants afterward.

Publicly exposed metadata tables have RLS, indexed foreign keys, workspace/scan/finding relationship constraints and authenticated SELECT only. Browser roles cannot write integration/proposal data. Encrypted credentials, state, patch bodies and checkpoints have no browser grants. The authenticated backend checks workspace role and the acting user's current GitHub access before remote actions.

Owners/admins share or disconnect repositories. Owners/admins/analysts can scan, propose and publish with their own GitHub permissions. Viewers read results only. Disconnect stops future operations, not saved-result access. Removing an Archon member removes RLS access. Deleting Archon records never deletes GitHub branches or PRs.

Patches expire with the associated source preview (normally 30 days). Reads enforce expiry and backend maintenance deletes expired encrypted records. Source/scan/finding deletion cascades private patch records. Non-source proposal metadata and published PR references remain. Expired patches cannot be validated/downloaded/published; a fresh authorized rescan can still start from a retained published PR reference.

## Publication safety

- Original files are fetched at the scanned commit, with Git tree modes checked. Redacted preview hashes are not original Git blob hashes.
- Exact unique replacements only; reject unsafe paths, workflows, excluded directories, binary files, symlinks/submodules, overlapping hunks, masked values, secrets and oversized patches.
- Python AST and JavaScript/TypeScript/PHP tree-sitter parsing are non-executing. Unsupported/pre-existing failures require acknowledgement; introduced syntax errors block publication.
- Review is tied to the proposal revision and diff hash. Regeneration supersedes the old proposal and clears UI review. Target branch movement blocks publishing.
- Recheck workspace membership and GitHub write access before publishing. Create one new branch and a normal PR, never merge, force-push or write to the target branch.
- Persist the created commit before branch/PR creation. Reconcile the recorded branch and PR on retry; a lost PR response must not create a duplicate PR. A database lease prevents concurrent publication.
- Downloaded patch previews are redacted. A patch containing masked context may require manual application/review against original source; do not replace original credentials with masking characters.
- Passing CI, PR merge and No longer detected do not change triage status automatically.

## Verification performed locally

Latest local run: **129 backend tests passed, 288 isolated RLS checks passed, 77 focused frontend assertions/checks passed**. TypeScript, focused ESLint, production build and the isolated desktop/mobile browser workflow passed. The build retains existing chunk-size/mixed-import warnings. Hosted security advisors, real OAuth consent and real GitHub publication were not verified.

- Isolated backend: GitHub role guards, PKCE/browser-session binding, unavailable-migration gating, webhook signature and removed-repository scope, publication review/staleness, partial/lost PR response recovery, and expired patch history.
- Patch validation: exact source grounding, original secret/line-ending preservation, path restrictions, malformed model output, non-executing syntax parsing, duplicate ambiguity, case-sensitive paths and >1,000 finding comparison.
- Existing Auth, Audit Workbench, Findings, Reports, Audit Log and Advisor regressions.
- Isolated Postgres/RLS: browser writes and private reads denied, member/outsider/anonymous isolation, cross-workspace FK rejection and cascade cleanup.
- TypeScript, focused ESLint, production build; isolated browser review/check gating, full-screen diff/Escape, synthetic publication, repository/branch selection and return to ZIP. Desktop 1440 and mobile 390 widths in both actual themes. Screenshots: `output/playwright/github-*.png`.

Browser fixture: `tests/workbench-preview/vite.config.ts`. Browser script: `tests/github-review-browser.cjs` (fixture port 5176). It cannot create a real commit or PR.

## Hosted rollout checklist

1. Complete the remaining release work listed above, using isolated fixtures.
2. Configure the separate GitHub App and encryption/webhook credentials locally/server-side; verify exact callback, cookie host/site and CORS configuration.
3. Apply the single additive migration, verify grants/RLS and hosted advisors.
4. Enable repository access only; test both email and GitHub-login users on an isolated repository. Verify revoked members and GitHub read-only users.
5. Enable publishing only for isolated acceptance testing. Verify exact diff, one branch/PR, actual CI head SHA, explicit rescan and comparison. Do not merge through Archon or touch a production repository.
6. Broaden enablement only after acceptance; keep ZIP/history/reports/auth regressions passing.
