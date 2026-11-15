# Responsive application navigation

Implemented and verified locally on 4 November 2026.

## Behavior

- Desktop, at 1024px and above: header toggle changes the shared sidebar between 248px and a 72px icon rail. Compact links retain accessible labels, native hover titles and active-page semantics. Profile stays accessible; the compact workspace button expands the rail and focuses the existing workspace switcher.
- Below 1024px: header menu opens full navigation in a left-side modal drawer, maximum 320px wide with a backdrop. The bottom bar and More menu remain. The drawer supports Close, Escape, backdrop dismissal, focus trapping/restoration, body scroll locking and short-screen scrolling. It closes after route changes or desktop resizing; clicking the already-current destination also closes it.
- Drawer and More state are mutually exclusive. Workspace-dropdown Escape closes the dropdown first without closing its parent drawer. Existing workspace creation/switching logic and navigation guards are retained.
- Desktop preference is browser-only, non-sensitive appearance state (`archon-sidebar-v1`). A shared external store keeps it consistent across page mounts, navigation and storage events; an in-memory fallback works when storage is denied. SSR uses a deterministic default snapshot. With no stored choice, Advisor starts compact while other pages start expanded. An explicit choice overrides both defaults.
- Sidebar toggles do not key/remount page children. Immersive Workbench still hides the shell navigation and restores its previous preference on exit. Reduced motion disables the width transition.

## Files

| File | Purpose |
| --- | --- |
| `src/components/brutal/AppShell.tsx` | Shared sidebar contents, desktop toggle and accessible mobile drawer lifecycle |
| `src/lib/sidebar.ts` | Hydration-safe shared preference state and storage fallback |
| `src/components/workspace-switcher.tsx` | Unique trigger IDs when both desktop/drawer switchers exist; nested Escape handling only |
| `src/styles.css` | Narrow drawer/backdrop styling; existing theme tokens preserved |
| `tests/sidebar.test.mjs` | Default/explicit preferences and blocked storage regression |
| `tests/sidebar-browser.cjs` | Responsive navigation, state preservation and accessibility checks |

No API, database, authentication, RLS, model, scan-pipeline or dependency changes. Marketing and authentication page layouts remain unchanged. Earlier unrelated worktree changes were preserved.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero errors; one existing auth-fixture Fast Refresh warning |
| `npm run build` | Passed, standalone Node SSR output; existing large-chunk/import warnings remain |
| All frontend `tests/*.test.mjs` against production server on port 5196 | 107 passed, including ten SSR routes |
| `node scripts/check-client-secrets.mjs` | 95 public assets passed |
| Task-scoped `git diff --check` | Passed |
| Playwright core navigation checks | Passed persisted rail width, route navigation, workspace focus, drawer/More interaction, focus/Escape, scroll lock, backdrop, desktop resize and immersive mode |
| Playwright extended checks | Passed graph Fit after resizing, unsaved workspace-name preservation, Advisor default, reduced motion and actual denied-storage fallback |

Browser tests used the existing Playwright CLI with isolated workspace data on port 5193. Tested widths: 390, 768, 1023, 1024 and 1440, plus 844×390 landscape, in both themes. The core and extended checks passed in separate runs; the test's `sidebar-extra=1` URL option permits rerunning extended checks without recapturing all screenshots.

The initial focus check found a keyboard-wrap gap and an explicit Tab/Shift+Tab trap was added. Editor measurements were corrected to wait for the initial lazy mount before taking a baseline: toggling did not increase editor mounts or source downloads. A reduced-motion assertion was corrected to accept `transition-property: none`, which disables animation even when the computed duration remains nonzero. These corrections did not weaken application guards.

Screenshots `output/playwright/sidebar-{light,dark}-{390,768,1023,1024,1440}.png` are synthetic QA captures. Mobile dark and desktop light screenshots were visually inspected for readable controls, consistent theme, drawer fit and absence of page overflow.

The existing real frontend on http://127.0.0.1:5173/login returned HTTP 200 with Archon content and was left untouched. Temporary production/fixture servers used for verification were stopped separately. No real scan, user account, hosted workspace or repository was mutated for testing. Browser fixtures do not replace a hosted end-to-end audit run; backend/RLS suites were not rerun because no backend or policy files changed in this task.
