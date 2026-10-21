# Faster audit and progressive IDE loading

Implemented and verified locally against the hosted Supabase project on 19 October 2026. Read-only review, Archon styling, analysis limits and provider fallback remain in place.

## Shipped behavior

- A capability-gated ZIP upload opens the workbench after HTTP 202. Source preparation and analysis have separate indicators; zero provisional findings never means a clean scan. Reports remain disabled until both saved scan and durable job are complete.
- A lifespan HTTPX client reuses connections. JWT headers are constructed per request, never stored in shared defaults. Uploads use eight workers per scan and a shared sixteen-upload process limit.
- The manifest is written first, with pending previews. The first previewable file is uploaded/published first; further ready IDs are published eight at a time. Source preparation overlaps full analysis. Static analysis and AI review overlap, with the original static-first grounding/deduplication order.
- Files are filtered and paged in Postgres (200/page). The first page is usable immediately; remaining pages load progressively. A bootstrap source window can come from beyond the first 200 entries if those entries are dependencies or otherwise excluded.
- Finding summaries are paged in Postgres (50/page), with global severity/text filters. Full evidence, remediation and controls are fetched on selection. A security-invoker RPC returns global severity, per-file and preview counts under caller RLS. Counts are not derived from the visible page.
- ZIP selection preloads workbench/editor assets. Lightweight text is shown before Monaco initializes. One editor switches cached models, retaining view state; model and source-window caches are each bounded to eight windows/2 MiB of UTF-8 source payload. Syntax registrations/tokenizers load on demand. Only expanded folder branches render.
- Completed views make lightweight authorization/status checks every 15 seconds while visible, plus a visibility recheck. Active jobs refresh status/pending metadata more often. Source requests do not run on a timer. Logout, workspace changes, expiry and access denial discard source caches and dispose editors/models. Source is not persisted in browser storage.
- Source failures retain findings with explicit unavailable/unlocated states. Failed/cascaded uploads queue cleanup in metadata batches; late uploads after deletion are requeued. Existing idempotency, restart lease recovery, private Storage and 720-hour retention are retained.
- The live test exposed a PHP `$pass`/`$pwd` masking gap. Masking now covers these assignments and is reapplied on reads/search/export of older snapshots/evidence. Length and line positions are preserved. Heuristic masking is not a guarantee that every possible secret is detected; remove credentials before uploading.

## API and database changes

New authenticated routes below `/api/v1/scans/{scanId}/workbench`:

| Route | Purpose |
| --- | --- |
| `/bootstrap?workspace_id=…` | Status, counts, initial file/finding pages and available source window |
| `/status?workspace_id=…` | Authorization, snapshot/job status and global counts; no source download |
| `/findings?severity=…&q=…&offset=…` | Up to 50 finding summaries with global filtering |
| `/findings/{findingId}` | Full evidence/controls and safe linked file metadata |

Existing source file endpoints keep their response contract, now applying database pagination. Pending source returns HTTP 409 (“Preparing preview”), not an expired-file response. Existing full overview/report endpoints remain available to older clients.

Migration `20261019164441_progressive_audit_workbench.sql` adds only the pending-state constraint, `audit_workbench_counts(uuid)` (security invoker, fixed search path, authenticated/service-role execute only), and `(scan_id,severity,created_at,id)` index. Applied atomically with its history record to `gzyxgqxycbccifajdoiu`; no older migration was replayed or edited. Rollback-only hosted RLS verification and advisors passed. The existing disabled leaked-password-protection Auth warning remains unchanged.

Pagination uses bounded offsets to preserve existing file contracts; it does not transfer a full manifest for each page. A future much-larger history contract can move to keyset pagination.

## Measurements

### Real local application → hosted Storage/database/provider

One run per row, not medians. Timings come from persisted job metadata and database timestamps. The application was authenticated normally; no production auth bypass was used.

| Input | Entries | First source published after acceptance | Source preparation | Analysis | Persistence | Accepted-job → saved scan |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| User-selected GHRCE ZIP | 14 | Not instrumented in this first run | 3.523 s | 5.581 s | 0.918 s | 7.219 s |
| Synthetic audit ZIP | 90 | 2.146 s | 6.784 s | 2.884 s | 1.506 s | 8.962 s |
| Synthetic audit ZIP | 500 | 4.803 s | 26.421 s | 2.788 s | 0.222 s | 27.646 s |

Concurrent phases overlap: do not add them to predict total time. Validation happens before acceptance (0.025/0.199/1.173 s respectively); the job-to-scan timestamp total excludes the final small job-status write. The GHRCE run exported a valid 346,988-byte PDF; source/finding navigation and history re-opening worked.

The earlier 14-file GHRCE job took 30.89 s and the earlier 90-file MERN job took 81.49 s. Different archives, provider responses and network conditions prevent using those observations as proof of a same-fixture median improvement. In particular, synthetic 90-file and earlier MERN results are not an apples-to-apples comparison.

### Repeatable offline reference-schedule comparison

`python tests/benchmark_workbench.py --repeats 3` from `threatlens/` uses actual ZIP parsing, static analysis, grounded deterministic model replies and orchestration, with explicit simulated request latency. No hosted reads/writes occur. The reference schedule uses four uploads, then analysis, then persistence; optimized uses the implementation. Simulated old/new connection costs are 20/5 ms per metadata request and 60/20 ms per upload. These are scheduling tests, not live network predictions.

| Files | Reference median completion | Optimized median completion | Optimized first publication | Finding identity/order |
| ---: | ---: | ---: | ---: | --- |
| 14 | 0.554 s | 0.185 s | 0.078 s | Identical |
| 90 | 2.068 s | 0.532 s | 0.088 s | Identical |
| 500 | 10.449 s | 2.242 s | 0.257 s | Identical |

The 90-file offline reference comparison is about 74% faster. This is not a claim of a 74% hosted median improvement.

### Browser timing and remaining acceptance work

- Desktop light/dark and 390px mobile were visually checked with real components and isolated fixtures, including pending-file messaging and locked exports. [Mobile proof](./progressive-mobile.png) uses synthetic fixture data.
- Cached tab switching stopped additional source downloads. One development-browser click-to-next-paint observation was 101.1 ms. A stable production-build median below 100 ms is **not yet verified**; browser debugging disconnected during further measurements. Do not label that acceptance target passed.
- `archon.workbench.bootstrap` and `archon.workbench.first_source` are local Performance measures for bootstrap duration and acceptance-to-first-source commit. They contain no source/credentials and are not sent to a telemetry service. Backend `bootstrap_seconds` measures the authenticated server bootstrap separately. `first_source_ready` is server publication, not browser paint.
- Same-fixture hosted before/after medians, browser-paint-within-five-seconds, sustained multi-user load and production accessibility certification remain unverified. The live 90-file server publication is within five seconds; that alone does not establish the browser-paint target.

## Verification and rollout

- Backend: **147 passed, 4 skipped**. Added pending/late findings, database paging/detail/counts, first preview beyond page one, source-metadata failure, old-preview masking, deletion/late-upload cleanup, shared JWT isolation, process upload cap and deterministic concurrent static/AI merge tests.
- Local SQL harness: **190 RLS checks passed**. Hosted rollback-only tests additionally confirm member totals, pending counts, outsider isolation and anonymous RPC execute denial.
- Audit/progress 17, summary 9 and Attack Graph 11 existing frontend checks pass; TypeScript, targeted ESLint and production build pass. Public client assets were checked against locally configured provider and service-role secrets without printing their values.
- No rules-only shortcut, provider/model migration, timeout reduction or analysis-limit reduction was introduced. Provider output is nondeterministic; tests establish deterministic fixture consistency, not perfect vulnerability detection.
- `AUDIT_WORKBENCH_PROGRESSIVE_ENABLED=true` is enabled only in the ignored local backend `.env` after hosted migration checks and the real ZIP-to-report test. The code default and example remain `false` for staged deployment. Other environments must deploy backend/migration first, run their own live check, then opt in. Older clients/backends retain completed-scan navigation.
- Disable the flag and restart the backend to return to completed-only navigation. Leave the additive migration in place; do not replay historical migrations with `--include-all`.

Synthetic ZIP fixtures can be recreated with `python scripts/create-workbench-fixtures.py`. The backend and frontend were left running for review; isolated preview networking never contacts hosted services.

Implementation references: [HTTPX client lifetime](https://www.python-httpx.org/async/), [TanStack prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Supabase skills guided the invoker RPC, additive migration and least-privilege verification.
