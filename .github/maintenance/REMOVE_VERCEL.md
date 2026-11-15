# Remove the hosting adapter

Date: 4 November 2026.

## Plan and implementation

1. Inspect build configuration, deployment files, dependencies and scripts.
2. Replace the provider-specific Nitro preset with `node-server`, preserving the existing SSR entry, route splitting and development commands.
3. Add `npm start` for `.output/server/index.mjs`; point the client secret checker at `.output/public`.
4. Remove the deployment ignore file and old local `.vercel` output/link metadata. Keep application source, secrets, Supabase configuration and unrelated edits intact.
5. Verify production build, startup, static assets, SSR routes, client hydration and regression tests.

All implementation steps above were performed. No remote deployment/account/domain was deleted.

## Changed files

| File | Change |
| --- | --- |
| `vite.config.ts` | Explicit standalone Node SSR preset instead of the Vercel preset |
| `package.json` | Add `npm start`; no dependency removals/upgrades |
| `scripts/check-client-secrets.mjs` | Check standalone public output by default |
| `.gitignore`, `.prettierignore`, `eslint.config.js` | Remove old provider-output entries; `.output` remains excluded |
| `.vercelignore` | Delete obsolete provider deployment exclusions |
| `.github/security-fixes/README.md` | Describe the existing CORS rule without provider-specific wording |
| `README.md` | Document standalone production commands, output, Node version and separate API requirements |
| `tests/standalone-production-browser.cjs` | Reusable local-server hydration and signed-out route regression check |
| This file | Removal plan, results and boundaries |

Removed local `.vercel`: 219 generated files/link metadata files, no tracked source files. Rebuild output using `npm run build`; the old hosted project still exists independently. Local link metadata is not recreated by the Node build. Historical cleanup records retain their original paths as evidence and are not rewritten.

The lockfile contains optional `@vercel/queue` peer metadata from upstream multi-provider tooling. `npm ls @vercel/queue --all` confirms it is not installed. There is no direct Vercel SDK dependency to remove. Do not hand-edit third-party package metadata or remove Nitro/TanStack, which implement SSR.

## Verification

- `npm run build`: passed; `.output/nitro.json` identifies `node-server` and `server/index.mjs`.
- `HOST=127.0.0.1`, `PORT=5196`, `npm start`: standalone server started and served the app.
- All `tests/*.test.mjs` with `FRONTEND_TEST_URL=http://127.0.0.1:5196`: 102 passed, including ten production SSR routes.
- `npm run typecheck`: passed.
- `npm run lint`: passed after deleting stale provider output; one existing fixture Fast Refresh warning remains.
- `node scripts/check-client-secrets.mjs`: passed, 95 public assets checked without printing credentials.
- Browser smoke: production login/signup controls and redirects from Advisor, Workspace, Settings and Fix Verification passed on repeated runs; development control also passed. Browser testing used the existing Playwright CLI skill.
- Initial browser run recorded React recoverable hydration error 418. It did not reproduce in two subsequent production runs or the development control; no application/authentication changes were made to conceal it. This transient observation remains a monitoring limitation, not a proven fixed bug.
- Existing build warnings about large Monaco bundles and mixed dynamic/static imports remain. Prior dependency advisories are outside this deployment-only change.

## Running the project

Development remains `npm run dev`. Production frontend: `npm ci`, `npm run build`, `npm start` (default port 3000; configurable `HOST`/`PORT`). Keep FastAPI running separately. Configure public API values at build time and the backend's exact CORS origin. Private backend credentials must never be embedded in `VITE_*` values.

The tested deployment is local, not a live hosted rollout. No full real-user scan, email/GitHub login, provider request or database mutation was performed for this change. Scanning, authentication, RLS and retention implementation files were untouched.
