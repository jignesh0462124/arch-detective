# Professional PDF reports

Implemented 5 November 2026. PDF presentation only; no API, database, RLS,
authentication, provider-routing or scan-pipeline changes.

## Changed files and safety

| File | Change and safeguard |
| --- | --- |
| `threatlens/app/report/templates/base.html` | Print-first A4 layout, canonical inline Archon mark, cream cover, white reading pages, 10.5pt body and 9pt code, readable running headers/footers. Long project names use a smaller cover heading to prevent Chromium from shrinking the entire report. CSP still blocks external resources and scripts. |
| `threatlens/app/report/templates/executive_summary.html` | Separate overview and assessment scope, readable nested coverage, explicit limitations and honest counts. No fabricated scores or certification claims. |
| `threatlens/app/report/templates/compliance_section.html` | Clear framework tables, valid zero/missing distinction and explicit mapping-occurrence labels. Existing top-15 control summary is labeled as such; per-finding mappings remain complete. |
| `threatlens/app/report/templates/findings.html` | Stable report-local references, source/remedy distinction, repeated code-table context, fenced saved remedies, explicit missing/incomplete states and suggested verification checks. Short evidence-free findings stay together; long evidence can continue. |
| `threatlens/app/report/generator.py` | Presentation-only copies, stable severity ordering, unknown-severity fallback, safe fenced-code splitting, UTC timestamp presentation and a restricted footer label. Cache version bumped to `reports-v4.0-print-first`; existing cache/admission limits and rendering engines preserved. |
| `threatlens/tests/test_report_presentation.py` | Regression cases for escaping, canonical logo geometry, all finding records, zero/invalid scores, code fences, source numbering, dates, cache revision, long names and hostile strings. |
| `threatlens/tests/test_report_library.py` | Opt-in real-browser PDF download smoke test using the existing isolated authenticated repository fixture. Existing cache-limit tests retained. |
| `threatlens/scripts/preview_professional_report.py` | Reusable synthetic visual fixtures, content and page-bound checks, code-size checks and contact sheets. No accounts, private projects or model calls. |
| This document | Implementation and verification record. |

No maintained files were deleted. Existing unrelated worktree changes were not
reverted. The inline logo geometry matches `public/brand/archon-mark.svg`; a test
guards against drift. No source or private conversations are fetched during
report preparation. Saved fenced remediation is rendered, not generated or run.

## Verification

- Baseline focused report suite: **22 passed** before edits.
- Final report presentation/security/library/workbench regressions: **70 passed**,
  including real Edge rendering through authenticated download routes. The opt-in
  test verifies 12 findings, redaction, attachment/MIME/no-store headers, framework
  scoping and denied access after membership revocation.
- Frontend report/export tests: **7 passed**.
- `npm run typecheck`: passed.
- `npm run build`: passed. Existing mixed static/dynamic import warnings remain;
  they are not caused by this PDF-only change.
- Python compile checks and task-specific `git diff --check`: passed.
- Edge synthetic visual review: preview 5 pages, zero-findings 2 pages, long
  title/path plus 100-line evidence 6 pages, 12 mixed/duplicate-title findings
  9 pages. All pages were reviewed using contact sheets, with full-size review of
  code/remediation pages. No blank pages, out-of-page text or missing fixture
  markers were detected; long-fixture code retained at least 9pt size.

Commands (PowerShell, repository root):

```powershell
$env:ARCHON_TEST_RENDER_PDF='1'
python -m pytest threatlens/tests/test_report_presentation.py threatlens/tests/test_pdf_safety.py threatlens/tests/test_report_library.py threatlens/tests/test_audit_workbench.py -q -p no:cacheprovider
python threatlens/scripts/preview_professional_report.py
npm run test:reports
npm run typecheck
npm run build
```

The review PDF is `output/pdf/archon-professional-report-preview.pdf`. Temporary
fixture PDFs, per-page PNGs, contact sheets and results are under
`tmp/pdfs/professional-report-qa/chromium/`. These are synthetic examples, not
security assessments of the user's repository.

## Verification limits

- WeasyPrint fallback is retained, but could not be rendered here: the system
  Python does not have WeasyPrint, and the project virtual environment lacks its
  native `libgobject-2.0-0` dependency. No packages, native libraries or deployment
  settings were changed. Run the preview with `--engine weasyprint` in the
  supported Linux/deployment environment before rollout there.
- Authenticated downloads were tested through FastAPI's test client with isolated
  membership fixtures and real PDF rendering, not a signed-in hosted browser.
  A live Reports/Workbench download against hosted data remains unverified.
- The frontend was not changed. No new UI lint targets, hosted RLS changes or
  schema migrations were introduced.
- Legacy local report routes and their pre-existing disk cache behavior are
  unchanged. Newly prepared reports use the new template; existing downloaded
  PDFs are not modified.

The initial Edge run and frontend tests were blocked by tool-sandbox restrictions;
reruns with approved access passed without weakening Chromium's own sandbox.
