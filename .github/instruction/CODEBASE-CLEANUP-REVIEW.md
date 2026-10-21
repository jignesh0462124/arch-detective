# Archon Codebase Cleanup and Dead-Code Review

> Review date: 2026-07-23
> Scope: frontend, backend, dependencies, generated output, assets, tests, and project documentation
> Review type: static import analysis, reference search, build/type/lint checks, backend tests, and manual architecture review
> Implementation date: 2026-07-24
> Status: high-confidence cleanup implemented; schema and backend-document migrations remain deferred

## 1. Executive Summary

The codebase is functional, but it contains a sizeable unused frontend component library, tracked generator cache files, one template server-function example, duplicated package-manager state, and backend documentation that still conflicts with the Supabase architecture.

The safest cleanup is:

1. Fix the existing TypeScript type error and make type checking a normal script.
2. Untrack and remove the 79 Graphify cache files.
3. Remove the unused TanStack example server-function pair.
4. Remove the 47 unreachable generic UI/hook files and their exclusive dependencies.
5. Select one JavaScript package manager and retain one lockfile.
6. Correct or archive the obsolete AWS/S3 backend documents.
7. Remove the redundant `gitpython` Python dependency.
8. Remove legacy `SourceType` enum values through an Alembic migration after checking production data.

Measured cleanup opportunities:

| Area                                             |                           Evidence | Recommended disposition                         |
| ------------------------------------------------ | ---------------------------------: | ----------------------------------------------- |
| Unreachable TypeScript modules                   |                   51 of 89 modules | Remove 49; retain 2 Supabase auth modules       |
| Generic UI source                                |           47 files, about 150.2 KB | Remove as one dependency-aware batch            |
| Graphify cache                                   |   79 tracked files, about 155.8 KB | Remove from Git immediately                     |
| Demo frontend server code                        |                            2 files | Remove immediately                              |
| Frontend dependencies made obsolete by the above |           Up to 39 direct packages | Remove after deleting the unused UI batch       |
| Duplicate lock state                             | `package-lock.json` and `bun.lock` | Keep one package manager                        |
| Backend dependency                               |                        `gitpython` | Remove immediately                              |
| Legacy database/source enum values               |                           3 values | Remove with a migration, not a source-only edit |
| Conflicting AWS/S3 documentation                 |                5 primary documents | Rewrite or archive before Parts 4-8             |

## 2. Implementation Result

Completed:

- Removed 47 unreachable generic UI/hook files.
- Removed the 2 unused TanStack example/config files.
- Removed 39 obsolete direct frontend dependencies and 121 installed packages.
- Removed 79 tracked Graphify cache entries; regenerated cache remains ignored.
- Removed the unrelated 32-file, 4.35 MB `work/presentations/java-ppt-fill/tmp` artifact tree.
- Standardized frontend package management on npm by removing `bun.lock` and `bunfig.toml`.
- Removed the unused `gitpython` backend requirement.
- Added a dedicated typecheck script and enabled unused TypeScript checks.
- Restored passing frontend lint and typecheck gates.
- Refreshed Graphify to 470 nodes, 913 edges, and 64 communities.
- Reduced the production CSS bundle from about 102.5 KB to 56.2 KB.

Deliberately deferred:

- Supabase rewrites for the obsolete AWS/S3 backend documents.
- The `SourceType` constraint migration, which requires checking persisted database rows.
- Supabase auth modules and mock data, which still have documented near-term owners.

## 3. Verification Baseline

| Check                                | Result | Notes                                                           |
| ------------------------------------ | ------ | --------------------------------------------------------------- |
| `npm run build`                      | Pass   | Client and SSR bundles build successfully                       |
| Backend `pytest -q`                  | Pass   | 75 passed, 2 skipped                                            |
| Strict TypeScript with unused checks | Pass   | `npm run typecheck` succeeds                                    |
| `npm run lint`                       | Pass   | Active source and repository lint pass                          |
| `git diff --check`                   | Pass   | No whitespace errors                                            |

The production build still does not perform a complete TypeScript check internally, so both `npm run typecheck` and `npm run build` remain required.

## 4. Findings Ordered by Priority

### P1. Type checking is not a reliable quality gate

Evidence:

- `src/routes/_app/dashboard.tsx:19` imports `SeverityLevel`.
- `src/lib/mock-data.ts:10` exports `Severity`, not `SeverityLevel`.
- `tsconfig.json:19-20` disables `noUnusedLocals` and `noUnusedParameters`.
- `package.json:6-12` has no dedicated `typecheck` script.

Impact:

- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` fails.
- Unused imports, variables, and incorrect type imports can survive a production build.
- Future cleanup cannot be validated confidently until the type gate passes.

Recommended action:

1. Replace `SeverityLevel` with the existing `Severity` type, or export one canonical type name.
2. Add `"typecheck": "tsc --noEmit"` to `package.json`.
3. After the dead-code batch is removed, enable `noUnusedLocals` and `noUnusedParameters`.

### P1. Lint output is too noisy to expose real problems

Evidence:

- `npm run lint` reports 4,789 issues.
- Most errors are `prettier/prettier` complaints about CRLF line endings.
- Real errors, such as the empty catch block in `src/components/brutal/ThemeToggle.tsx:30`, are buried in formatting output.
- `.prettierrc` does not declare an end-of-line policy.
- `eslint.config.js:46` disables TypeScript unused-variable reporting.

Recommended action:

1. Add a repository `.gitattributes` policy, preferably `* text=auto eol=lf`.
2. Normalize active source files in one dedicated formatting change.
3. Exclude generated `src/routeTree.gen.ts` from ESLint as well as Prettier.
4. Re-enable `@typescript-eslint/no-unused-vars` after the dead modules are removed.
5. Keep formatting cleanup separate from functional changes to preserve reviewability.

### P1. Tracked Graphify cache contradicts `.gitignore`

Evidence:

- `.gitignore:18` ignores `graphify-out/cache/`.
- Git still tracks 79 JSON files under that directory.
- The tracked cache occupies about 155.8 KB and changes when Graphify is regenerated.

Recommended action:

```bash
git rm -r --cached graphify-out/cache
```

Then remove the local cache directory or allow Graphify to regenerate it. Keep these user-facing outputs if the graph remains part of the project documentation:

```text
graphify-out/graph.html
graphify-out/graph.json
graphify-out/GRAPH_REPORT.md
```

Do not commit graph outputs when they contain an interrupted or zero-node generation result.

### P2. TanStack example server code is unused template residue

High-confidence removal:

```text
src/lib/api/example.functions.ts
src/lib/config.server.ts
```

Evidence:

- `example.functions.ts:6` explicitly describes itself as an example.
- `getGreeting` has no importers.
- `getServerConfig` is imported only by the example.
- The production backend is FastAPI, so this sample does not implement an application requirement.
- `zod` is referenced only by this example.

Associated dependency removal:

```text
zod
```

### P2. Forty-seven generic UI files are unreachable

A TypeScript import graph starting from `src/router.tsx`, `src/server.ts`, and `src/start.ts` found the following files unreachable:

```text
src/components/ui/accordion.tsx
src/components/ui/alert.tsx
src/components/ui/alert-dialog.tsx
src/components/ui/aspect-ratio.tsx
src/components/ui/avatar.tsx
src/components/ui/badge.tsx
src/components/ui/breadcrumb.tsx
src/components/ui/button.tsx
src/components/ui/calendar.tsx
src/components/ui/card.tsx
src/components/ui/carousel.tsx
src/components/ui/chart.tsx
src/components/ui/checkbox.tsx
src/components/ui/collapsible.tsx
src/components/ui/command.tsx
src/components/ui/context-menu.tsx
src/components/ui/dialog.tsx
src/components/ui/drawer.tsx
src/components/ui/dropdown-menu.tsx
src/components/ui/form.tsx
src/components/ui/hover-card.tsx
src/components/ui/input.tsx
src/components/ui/input-otp.tsx
src/components/ui/label.tsx
src/components/ui/menubar.tsx
src/components/ui/navigation-menu.tsx
src/components/ui/pagination.tsx
src/components/ui/popover.tsx
src/components/ui/progress.tsx
src/components/ui/radio-group.tsx
src/components/ui/resizable.tsx
src/components/ui/scroll-area.tsx
src/components/ui/select.tsx
src/components/ui/separator.tsx
src/components/ui/sheet.tsx
src/components/ui/sidebar.tsx
src/components/ui/skeleton.tsx
src/components/ui/slider.tsx
src/components/ui/sonner.tsx
src/components/ui/switch.tsx
src/components/ui/table.tsx
src/components/ui/tabs.tsx
src/components/ui/textarea.tsx
src/components/ui/toggle.tsx
src/components/ui/toggle-group.tsx
src/components/ui/tooltip.tsx
src/hooks/use-mobile.tsx
```

The application uses its own focused components, including `AppShell`, `SectionCard`, `DataTable`, `CoverageBar`, `CodePanel`, `SeverityBadge`, and `PipelineStep`. Those files are reachable and must remain.

Remove the unreachable UI files as one batch. Removing only leaf files will leave an unused internal component graph behind.

### P2. Up to 39 frontend dependencies support only dead UI or demo code

After removing the files above, remove these direct dependencies:

```text
@hookform/resolvers
@radix-ui/react-accordion
@radix-ui/react-alert-dialog
@radix-ui/react-aspect-ratio
@radix-ui/react-avatar
@radix-ui/react-checkbox
@radix-ui/react-collapsible
@radix-ui/react-context-menu
@radix-ui/react-dialog
@radix-ui/react-dropdown-menu
@radix-ui/react-hover-card
@radix-ui/react-label
@radix-ui/react-menubar
@radix-ui/react-navigation-menu
@radix-ui/react-popover
@radix-ui/react-progress
@radix-ui/react-radio-group
@radix-ui/react-scroll-area
@radix-ui/react-select
@radix-ui/react-separator
@radix-ui/react-slider
@radix-ui/react-slot
@radix-ui/react-switch
@radix-ui/react-tabs
@radix-ui/react-toggle
@radix-ui/react-toggle-group
@radix-ui/react-tooltip
class-variance-authority
cmdk
date-fns
embla-carousel-react
input-otp
react-day-picker
react-hook-form
react-resizable-panels
recharts
sonner
vaul
zod
```

Do not remove these packages merely because direct text search is empty:

- `react-dom`: required by the React runtime and framework.
- `@tailwindcss/vite`, `@tanstack/router-plugin`, and `vite-tsconfig-paths`: supplied through `@lovable.dev/vite-tanstack-config`; verify its peer requirements before changing them.
- `tw-animate-css`: imported by `src/styles.css`.
- `clsx` and `tailwind-merge`: used by the active `cn` utility.

### P2. Two package-manager lockfiles can drift

Tracked files:

```text
package-lock.json
bun.lock
bunfig.toml
```

The README and verified commands primarily use npm, while `bunfig.toml` contains a Bun-specific supply-chain release-age guard. Retaining both lockfiles allows the resolved dependency trees to diverge.

Recommended default for this repository:

1. Standardize on npm because the documented build, lint, and development commands use npm.
2. Keep `package-lock.json`.
3. Remove `bun.lock` and `bunfig.toml`.
4. Update `README.md` to show only the selected package manager.

If Bun is deliberately selected instead, perform the inverse and update all commands and CI together.

### P2. `gitpython` is redundant

Evidence:

- `threatlens/requirements.txt:35` installs `gitpython`.
- `threatlens/app/ingestion/code_extractor.py:8` uses Python's `subprocess`.
- `code_extractor.py:227-246` invokes a hardened `git clone` command directly.
- No application or test file imports the `git` Python module.

Recommended action:

```text
Remove gitpython==3.1.43 from threatlens/requirements.txt.
```

The direct subprocess implementation is the intended security boundary and should remain.

### P2. Backend documents still prescribe the retired AWS/S3 architecture

The following are not harmless historical mentions; they contain implementation instructions that conflict with the Supabase source of truth:

| Document                                                | Conflicting content                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `.github/Backend/Part-01-Foundation-Setup.md:88-92`     | S3 credentials in application settings                               |
| `.github/Backend/Part-06-Report-Generator.md:11,79-99`  | boto3 uploader and persisted signed URL                              |
| `.github/Backend/plan/Workflow-05-PDF-Reports.md:84-93` | S3/local-storage branching                                           |
| `.github/Backend/Backend-Frontend-Connect.md:1188-1220` | S3 participant, old singular `/scan` endpoints, direct FormData flow |
| `.github/Backend/plan/Backend.md:113,138,274-278`       | Original AWS/R2 architecture                                         |

Recommended action:

1. Treat `.github/Backend/plan/Supabase-Backend.md` and `.github/Backend/AI-Implementation-Prompts.md` as authoritative.
2. Rewrite Part 6, Workflow 5, and the frontend connection guide to use private Supabase Storage and the current plural `/api/v1/scans` contract.
3. Move `plan/Backend.md` to a clearly labelled `archive/` directory or delete it after confirming that all non-storage architecture details exist in the Supabase document.
4. Remove AWS/S3 snippets instead of relying only on an override warning in Copilot instructions.

This documentation cleanup should happen before implementing Part 6, otherwise an AI assistant can generate the retired boto3 design.

### P3. Legacy `SourceType` values are not accepted by the current API

Evidence:

- `threatlens/app/models/scan.py:29-34` defines `upload`, `git`, `architecture`, `logs`, and `full`.
- The Part 3 request discriminator accepts only `upload` and `git`.
- `architecture`, `logs`, and `full` belong to `ScanType`, not transport/source type.
- `threatlens/alembic/versions/0001_initial_schema.py:102` still allows all five values.

Recommended action:

1. Query existing scan rows for legacy source values.
2. Map any legacy values to `upload` or another valid transport.
3. Add a new Alembic migration narrowing the check constraint.
4. Remove `SourceType.ARCHITECTURE`, `SourceType.LOGS`, and `SourceType.FULL`.

Do not edit the enum without a matching migration.

### P3. Generated graph output is large and currently dirty

Tracked graph deliverables occupy about 1.2 MB:

```text
graphify-out/graph.json
graphify-out/graph.html
graphify-out/GRAPH_REPORT.md
```

These are referenced by `README.md:427-460`, so they are not strictly useless. Choose one policy:

- Keep them as published project documentation and regenerate them only from a clean, complete run.
- Remove them from Git and publish the interactive graph as a CI artifact or documentation-site artifact.

Do not keep both generated output and generator cache. The cache has no review value.

### P3. Documentation and instruction files need one ownership model

Current instruction documents:

```text
copilot-instructions.md
.agents/copilot-instructions.md
.github/Backend/copilot-instructions.md
```

They are different files, not byte-for-byte duplicates, but the root file says it should live at `.github/copilot-instructions.md`, which does not exist. This creates ambiguity about which instructions an assistant actually loads.

Recommended action:

1. Put repository-wide Copilot instructions at `.github/copilot-instructions.md`.
2. Keep `.agents/copilot-instructions.md` only for agent-specific modes and workflows.
3. Keep `.github/Backend/copilot-instructions.md` as backend execution documentation, and link to it from the repository-wide file.
4. Remove the root copy after its unique rules have been merged.

### P3. Runtime-unused brand artifacts are intentional source assets

`public/brand/archon-logo-sheet.png` is not loaded by the app, but it is generated by `scripts/generate_brand_assets.py:207-243` as a brand reference sheet. The SVG variants are documented by `public/brand/README.md`.

Recommendation:

- Keep the canonical brand SVGs, README, generator, and social/image sources.
- Keep the logo sheet only if human-facing brand handoff is a project requirement.
- If the public directory is deployed verbatim and the sheet should not be publicly served, move it to `docs/brand/` instead of deleting the brand system.
- Keep `docs/logo.png`; `README.md:2` uses it.

## 5. Files That Look Unused but Must Remain

Do not delete these during the cleanup:

```text
src/hooks/useAuth.ts
src/lib/api/auth.ts
src/lib/supabase.ts
src/lib/mock-data.ts
src/routeTree.gen.ts
threatlens/app/agent/__init__.py
threatlens/app/agent/prompts/__init__.py
threatlens/app/report/__init__.py
threatlens/app/scanners/__init__.py
threatlens/app/tasks/scan_task.py
```

Reasons:

- `useAuth.ts` and `api/auth.ts` are currently unreachable because the login page is intentionally dummy, but they are the prepared Supabase auth integration for the next frontend connection phase.
- `mock-data.ts` is imported by the landing page and dashboard routes. Remove it only as each route is converted to live API hooks.
- `routeTree.gen.ts` is generated but imported by `src/router.tsx`; deleting it breaks routing.
- The Python package initializers establish the planned Parts 4-6 module layout.
- `scan_task.py` is the explicit Part 3 Celery ingestion stub and is registered by `celery_app.py`; it is replaced, not deleted, in later backend parts.

Also retain future backend packages by roadmap stage unless requirements are split:

| Future part      | Packages to retain or move to an optional requirements file              |
| ---------------- | ------------------------------------------------------------------------ |
| Part 4 scanners  | `semgrep`, `bandit`, `trufflehog3`, `pip-audit`, `scikit-learn`, `numpy` |
| Part 5 agent     | `langchain`, `langchain-community`, `langchain-groq`, `groq`, `tenacity` |
| Part 6 reports   | `Jinja2`, `weasyprint`, `matplotlib`                                     |
| Part 8 hardening | `slowapi`, `orjson`, `structlog`                                         |

`PyPDF2` supports the documented RAG PDF seeding workflow. `python-docx` and `pandas` have no current imports; either remove them now and add them when a concrete implementation needs them, or move them to a clearly named future/optional requirements file.

## 6. Recommended Cleanup Sequence

### Phase A: Restore trustworthy checks

1. Fix the `SeverityLevel` type import.
2. Add an npm `typecheck` script.
3. Establish LF line-ending policy.
4. Run type check, lint, build, and backend tests.

### Phase B: Remove deterministic residue

1. Untrack `graphify-out/cache/`.
2. Delete `example.functions.ts` and `config.server.ts`.
3. Remove `zod`.
4. Remove `gitpython`.
5. Re-run all checks.

### Phase C: Remove the unused UI subtree

1. Delete all 47 files in the UI inventory.
2. Remove the 38 remaining exclusive UI dependencies listed above.
3. Regenerate the selected lockfile with a clean install.
4. Confirm all routes in light and dark mode.
5. Update README references to "53 shadcn components" and `use-mobile.tsx`.

### Phase D: Consolidate project metadata

1. Select npm or Bun and remove the other lock/config files.
2. Consolidate Copilot/agent instruction ownership.
3. Decide whether graph deliverables stay tracked.
4. Move optional brand handoff artifacts outside deployed `public/` if appropriate.

### Phase E: Correct backend architecture documentation and schema

1. Replace AWS/S3 instructions with Supabase Storage.
2. Update API examples to the current `/api/v1/scans` upload/start contract.
3. Archive or remove the original AWS architecture.
4. Migrate and narrow `SourceType`.
5. Split current and future Python dependencies if installation size becomes a concern.

## 7. Required Validation After Cleanup

Run:

```bash
npm install
npm run typecheck
npm run lint
npm run build
cd threatlens
.venv/Scripts/python.exe -m pytest -q
cd ..
git diff --check
```

Browser-check these routes at desktop and mobile widths in light and dark mode:

```text
/
/about
/login
/dashboard
/new-scan
/findings
/reports
/reports/RPT-0098
```

Confirm:

- No unresolved imports.
- No route generation failure.
- No missing styles caused by deleting a component package.
- Theme persistence still works.
- Supabase framework requests still work.
- Dashboard mock data still renders until live API replacement.
- Backend tests remain at least 75 passed and 2 environment-gated skips.

## 8. Definition of Done

Cleanup is complete when:

- The type check, lint, build, backend tests, and `git diff --check` all pass.
- `graphify-out/cache/` has no tracked files.
- No template example server function remains.
- Every retained frontend component has a reachable importer or an explicitly documented near-term owner.
- Only one JavaScript lockfile is authoritative.
- Python requirements reflect current or explicitly staged future work.
- Backend implementation documents no longer instruct agents to use AWS, S3, R2, boto3, custom auth, or obsolete singular scan endpoints.
- Database enum values match the public API contract.
