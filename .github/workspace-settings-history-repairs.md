# Workspace settings, audit history and graph repairs

## Implemented

- Settings now use aligned cards for general details, audit defaults, members, invitations and owner-only deletion. Request errors are not rendered as empty lists; rejected/zero-row writes do not claim success.
- Owner/admin management of other non-owner members follows existing RLS. Ownership transfer is not offered. Invitation creation does not claim email delivery.
- Supported framework defaults accept saved labels or IDs and initialize new uploads. Edited selections survive background refreshes. Other settings keys are preserved.
- Source retention is displayed from backend capabilities; unsupported alert and legacy retention preferences are explained without pretending to enforce them.
- A History button beside New audit opens a desktop side panel/mobile full-height sheet. It shows saved workspace codebase scans only, with database search/status filters, exact totals, stable newest-first pagination (20 per page), and report/workbench/progress links.
- History downloads metadata only, does not fall back to browser history, polls only active visible pages and supports Escape, focus trapping and focus restoration.
- Redundant two-stage Evidence Review is removed for saved scans. Illustrative sequences remain explicitly labeled examples with neutral numbering.
- Center selected uses scaled node/container geometry and scrolls the canvas only. Selection and outer-page scroll are preserved.

## Verification

- 63 focused frontend regressions, including query pagination, write confirmation, role guards, framework normalization and centering coordinates.
- 228 isolated RLS checks against the existing migrations; no policies or migrations changed.
- TypeScript, focused ESLint and production build.
- Isolated browser checks for Settings saves/errors/roles, default propagation, History filters/paging/empty/denied/error states, keyboard focus and canvas centering at multiple zoom levels.
- Desktop/mobile screenshots in both themes using the real theme toggle are in `output/playwright/`.

No saved scans were deleted. Scanning/model analysis and source retention enforcement are unchanged. Hosted Supabase mutation smoke tests were not performed; visual checks use synthetic data and data-layer checks use controlled SDK fixtures.
