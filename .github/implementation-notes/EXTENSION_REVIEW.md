# Chrome and Edge extension review

Implemented and verified on 5 November 2026. The feature lives in **Codebase Audit → Browser extension** and uses the existing authenticated source workbench, scan history, private Advisor conversations and PDF download.

## Workflow

1. Select Chrome Web Store, Microsoft Edge Add-ons, or both.
2. Upload the built ZIP with a unique root `manifest.json`; provide purpose, permission, browser-setting, privacy, advertising and payment declarations.
3. Optionally attach up to four PNG/JPEG listing screenshots per store, at most 512 KiB each. Screenshots are decoded, stripped of metadata and stored privately as normalized PNG evidence.
4. The accepted scan opens the workbench. Policy and security results become final only after persistence completes.
5. Inspect the store, policy, evidence, remedy and suggested verification. The permissions area filters in the database; lists show exact totals and 50 results per page.
6. A source-backed policy result can generate a code suggestion through the existing provider choices and fallback. The suggestion opens the exact private conversation that produced it. Listing/account checks without a verified source location retain written remedies.
7. Open a labelled illustrative notice. Chrome remote-code results also offer two cropped excerpts of the supplied Blue Argon reference. The original email/PDF, identities, extension ID, routing ID and Gmail links are not included.
8. Recheck creates a new saved scan. Compare compatible reviews and download the authenticated PDF. No extension code is applied or submitted to a store.

## Deployment and access

- Apply `20261105060545_extension_reviews.sql`, followed by `20261105124250_extension_scan_metadata.sql`. The second migration fills a confirmed gap between the hosted schema and the existing ORM model. Applied migration files were not edited or replayed.
- The first migration adds review metadata, declaration snapshots, private screenshot metadata, policy results and reviewer notes. It also allows a private Advisor conversation to reference one policy result instead of a security finding.
- New records inherit workspace authorization through the parent scan. Writes remain server-only. Owner/admin/analyst roles can initiate reviews and save notes; viewers can read authorized results. Advisor bodies remain private to their owner even within a shared workspace.
- Existing column-scoped scan write grants prevent browsers from changing `source_config` or overriding policy outcomes.
- Supporting declarations/screenshots expire within the existing 30-day source window. Reads immediately reject expired evidence; durable cleanup uses the existing private-source queue. Scan deletion cascades review and private conversation records.
- Set backend `EXTENSION_REVIEW_ENABLED=true` only after database and access verification. The local ignored environment file is enabled; the committed example remains off by default. `ADVISOR_HISTORY_ENABLED` must be enabled for saved conversations.
- No Gmail access, outgoing notices, store credentials, browser installation, store submission or repository execution is involved.

## Coverage and limits

Policy pack `2026-11-05.1` maintains separate Chrome and Edge section inventories, official references and review dates. It distinguishes passed checks, detected violations, needs review, not assessed and not applicable. The catalogue is a section-level review checklist, not an automated assertion about every clause or applicable law.

The extension extraction profile includes shipped `dist`, `build`, `vendor` and dependency directories. Ordinary ZIP exclusions remain unchanged. Source previews and security input retain their separate size/file limits; omissions and truncation are recorded rather than counted as clean coverage.

Structural checks cover package entrypoints and selected manifest/CSP facts. HTML parsing distinguishes executable remote scripts from comments, inert templates, data script types and declared sandbox pages. JavaScript dynamic loading, injection, insecure transport and privileged-message signals require review rather than being promoted to confirmed exploitation. Permissions and actual consent require purpose/runtime evidence. No submitted URL or remote script is fetched.

The PDF contains every policy-result reference. Actionable evidence has detailed remedies; remaining checklist items are compact, linked rows. It distinguishes security totals from policy outcomes and does not include private Advisor answers.

## Verification

- The full backend suite passed: **360 passed, 5 skipped** (environment-dependent integrations), with one expected duplicate-ZIP warning. Frontend auth, SSR, code-solution, findings, reports, audit/progress and Attack Graph checks passed: **72 checks**. TypeScript, focused lint and the production client/SSR build passed. The public-bundle secret check passed for **102 assets** without printing secret values.
- Isolated PostgreSQL tests passed **437 access checks**, including viewer/outsider/revoked membership, private policy chats, expiry, protected writes, scan cascades and queued screenshot cleanup.
- A disposable hosted workflow passed in **63.8 seconds**: real sign-in, original/corrected ZIPs, hosted source and screenshot storage, exact filters, remedies, review notes, viewer/outsider restrictions, direct-write denial, comparison, authenticated PDF and a complete live provider suggestion with private conversation/source-expiry checks. Only synthetic code and temporary accounts were used; all fixture accounts, workspace and captured Storage objects were removed.
- Hosted security advisors reported no database errors. An existing Auth warning about leaked-password protection remains unchanged; no hosted Auth policy was changed.
- The isolated Chrome UI flow verified upload/navigation, paging, filtering, source opening, note persistence feedback, policy-specific generation/context, exact conversation link, comparison and viewer restrictions. A second pass verifies opening Advisor before generation, returning to the exact policy and highlighting its source line. It caught and repaired a Monaco 0.55 initialization-order issue: editor contributions must be registered before the first standalone service collection is initialized, not after an on-demand grammar import. The remount scenario now passes without page errors or error-level console messages. Desktop and mobile layouts, both themes, dialog Escape/focus restoration and reference-image loading were inspected. Browser-plugin tooling was unavailable; Playwright CLI was used. Edge fixture sessions intermittently stalled while resizing; fresh Chrome/device contexts were used for the remaining visual checks.
- The final synthetic PDF has **14 pages** and retains all **114 policy references**, including remedies/verification. Every page was rendered and visually inspected for clipping, overlap, headings and table continuation. Chromium rendered successfully with normal process access. Windows WeasyPrint remains unavailable because its native `libgobject` dependency is absent.
- During the hosted fixture, the configured primary provider returned an authorization failure; the existing fallback completed analysis and the live suggestion. Provider credentials/routing were not changed. Passing fallback verification does not verify the primary provider's credentials.

## Changed surfaces

### Final continuation checks

The final follow-up reran the complete backend suite (**360 passed, 5 skipped**), all **437 isolated RLS checks**, TypeScript, focused lint, frontend regressions and the complete extension browser workflow. Server-rendering checks passed for both the development URL and the standalone production server. The hosted extension tables and scan metadata were checked again, and the local extension-review flag is enabled.

The first test attempt encountered access-denied errors in an existing system pytest temporary directory. Rerunning with a fresh workspace-scoped `--basetemp` passed; no product code or permissions were changed to address that environment issue. Chrome also required normal process access outside the Windows sandbox. The final browser run completed with no page errors or error-level console messages.

The saved 14-page PDF was checked again: all 114 expected policy references, remedies and verification content are present. Desktop and mobile notice dialogs in both themes and all PDF pages were visually reviewed. Unrelated whitespace in the pre-existing generated `graphify-out/GRAPH_REPORT.md` remains untouched.

| Area | Files and purpose |
| --- | --- |
| New review API/rules | `threatlens/app/api/extension_reviews.py`, `threatlens/app/scanners/extension_review.py` |
| Intake/workbench | `src/components/extension-review/ExtensionUpload.tsx`, `ExtensionReviewPanel.tsx`; existing `AuditUpload.tsx`, `AuditWorkbench.tsx`, `CodeSolution.tsx` reuse navigation, source and remedy presentation; `src/routes/workspace/$workspaceId/scans/$scanId/workbench.tsx` accepts an authorized policy deep link |
| Editor lifecycle | `src/components/audit-workbench/editorEngine.ts`, `src/types/monaco-languages.d.ts`; pre-register the contributions already brought in by Monaco's grammar modules before creating an editor, preserving lazy language selection and fixing remount errors |
| Typed data/cache | `src/lib/api/extensionReview.ts`, `types.ts`, `auditDeletion.ts`; scoped requests and deletion invalidation |
| Private conversations | `threatlens/app/api/ai_chat.py`, `services/advisor_history.py`, `src/lib/api/ai-client.ts`, `advisorHistory.ts`, `src/hooks/useGroqChat.ts`, `src/components/ai-assistant/AdvisorWorkspace.tsx` extend existing context handling and return-source links without changing model choices |
| Processing/configuration | `threatlens/app/api/__init__.py`, `audit_workbench.py`, `local_scan.py`, `config.py`, `ingestion/source_snapshot.py`; opt-in profile and security-only framework scope |
| PDF | `threatlens/app/api/report_library.py`, `report/generator.py`, `report/templates/base.html`, `compliance_section.html`, `findings.html`, new `extension_review.html`; complete policy content and template-cache revision |
| Database | The two additive migrations listed above |
| Dependencies/setup | `threatlens/requirements-api.txt`, `requirements.txt`, `.env.example`; declare the Pillow version already in the test lockfile |
| Reference assets | `public/notice-examples/chrome-blue-argon-reference-1.png`, `chrome-blue-argon-reference-2.png`; cropped, flattened reference excerpts |
| Verification | `threatlens/tests/test_extension_review.py`, `test_extension_review_api.py`, `test_report_presentation.py`, `test_audit_workbench.py` (numeric-zero sorting in the test adapter); `scripts/test-rls.mjs`, `tests/extension-review-browser.cjs`, `tests/workbench-preview/main.tsx` |
| Reproducible scripts | `threatlens/scripts/prepare_extension_notice_reference.py`, `preview_extension_report.py`, `smoke_extension_review.py` |
| Documentation/hygiene | This note, the README workflow paragraph and narrow `.gitignore` entries for disposable extension QA/deployment artifacts |

Existing unrelated worktree changes and saved audits were preserved. Generated QA PDFs, ZIPs and screenshots are verification artifacts, not product examples or actual customer scans.

## Official references

- [Chrome Web Store policies](https://developer.chrome.com/docs/webstore/program-policies/policies/)
- [Manifest V3 requirements and exceptions](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [Chrome violation troubleshooting and Blue Argon](https://developer.chrome.com/docs/webstore/troubleshooting)
- [Microsoft Edge Add-ons policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
