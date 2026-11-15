# Thesis figure guide

These diagrams adapt the supplied layout into print-focused SVG and PNG. They are explanatory figures based on source inspection, not application screenshots or proof of running integrations.

## Figure 1.1

Placement: Section 1.8 Main Contributions.

Caption: ThreatLens architecture for the saved-ZIP workflow, including authenticated processing, source preparation, analysis, private persistence and evidence review.

File: figure-1-1-system-architecture-revised.png (SVG also included).

## Figure 3.2

Placement: Section 3.4 Source Code Ingestion and Preprocessing.

Caption: End-to-end audit flow showing validation, scan acceptance, concurrent source preparation and analysis, persistence and review.

File: figure-3-2-end-to-end-audit-flow.png (SVG also included).

## Figure 4.1

Placement: Section 4.6 Background Processing and Deployment Modes.

Caption: Local progressive workbench and optional scanner-worker processing modes. Worker checks are shown in their implemented sequence.

File: figure-4-1-local-and-worker-modes-revised.png (SVG also included).

## Corrections to the supplied references

- Local static and model-assisted analysis overlap; worker scanner calls are sequential in the inspected implementation.
- No fixed Llama version or unverified 534-control corpus count is asserted.
- Rendering precedes PDF delivery; PDF does not feed into Chromium.
- NVD import and Qdrant services are optional/configuration-dependent, not mandatory for every ZIP assessment.
- Core source previews are not a claim of complete archive analysis.
- Source retention and saved assessment history are different concepts.
- Database row access follows project scope and policy design; see https://supabase.com/docs/guides/database/postgres/row-level-security .

## Grounding inspected on 14 November 2026

- threatlens/app/api/audit_workbench.py: accepted job, prepare_source, source_task, pipeline call and final persistence.
- threatlens/app/api/local_scan.py: _scan_pipeline, static_task, model call, grounding and merge.
- threatlens/app/tasks/scan_task.py: run_full_scan, sequential scanner calls and mapping stage.
- threatlens/app/tasks/report_task.py: generate_pdf_report before storing/delivering the result.
- threatlens/INSTALLATION.md: separate API and full scanner-worker installation profiles.

This is a static source review. No provider, worker, database or live scan was exercised for these figures.

## Engine comparison figures pending supplied measurements

Reserve Figure 6.2 for Section 6.5 Detection Quality Metrics: grouped precision/recall/F1 bars on the same independently labelled corpus and compatible scope. Do not rank tools on different task subsets.

Reserve Figure 6.3 for Section 6.6 Performance and Scan Duration: phase-time shares only if measured sequential exclusive intervals form a valid total. Concurrent or overlapping engine times must not be added into an elapsed-time pie. A pie chart cannot establish which engine is most accurate.

The user confirmed having evaluation data but has not attached it. engine-results-template.csv records the fields needed. No engine ranking or numeric comparison chart was fabricated. Earlier paper totals remain preliminary and unreconciled.
