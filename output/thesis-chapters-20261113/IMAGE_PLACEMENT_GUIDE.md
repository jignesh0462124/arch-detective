# Thesis image placement guide

Use nine figures across eight chapters. Chapter 5 contains two figures only. Insert each figure after its first discussion, followed by its caption. Do not create a separate image-only section that interrupts the chapter argument.

| Figure | Chapter and placement | Image | Asset status |
| --- | --- | --- | --- |
| 1.1 | Introduction, after 1.8 Main Contributions | Overall system architecture | Reuse `figure-5-1-system-architecture.svg` from the existing figure collection; renumber its caption. |
| 2.1 | Literature Review, after 2.8 Comparison with Existing Security Assessment Tools | Classification of security-review approaches | New diagram to prepare: static analysis, dependency analysis, secret/configuration checks, model-assisted explanation and human review. No unsupported product rankings. |
| 3.1 | Methodology, after 3.1 Research Design and Workflow | Research workflow | Reuse `figure-3-1-research-workflow.svg`. |
| 4.1 | Platform, after 4.6 Background Processing and Deployment Modes | Local environment and optional worker/retrieval environment | New two-lane diagram to prepare. Clearly label optional components; do not imply they were deployed or tested. |
| 5.1 | Implementation, within 5.10 Scan Visualization and Attack Graph | Audit Workbench screenshot | Existing `figure-5-6-audit-workbench.png`; recapture for print because the available screenshot text is soft. |
| 5.2 | Implementation, within 5.10 Scan Visualization and Attack Graph | Attack Graph screenshot | Existing `figure-5-7-attack-graph.png`; recapture for print. Label connections as evidence relationships, not confirmed exploitation. |
| 6.1 | Results, after 6.4 Vulnerability Detection Results | Generated report evidence and remedies | Reuse `individual-panels/figure-5-8b-report-evidence-and-remedies.png`. It demonstrates output presentation, not detection accuracy. |
| 7.1 | Conclusion, after 7.2 Key Findings and Contributions | Objective-to-evidence summary | New diagram to prepare: objective, available evidence and remaining verification. Do not add unverified success indicators. |
| 8.1 | Future Scope, after 8.5 Extended Validation and User Studies | Research and development roadmap | New diagram to prepare. Use proposed stages without fabricated deadlines, metrics or completion claims. |

Existing assets are under `output/ThreatLens_Thesis_Figures_20261112/`. Four proposed diagrams are placeholders only: Figures 2.1, 4.1, 7.1 and 8.1 have not been created in this writing task. The chapter draft supplies all nine captions and insertion markers.

## Where to put project screenshots

Keep the two essential interface screenshots in Chapter 5 and the report excerpt in Chapter 6. Use explanatory diagrams in the other chapters. There is no need to force a dashboard screenshot into the literature review or conclusion.

The original dashboard, upload, Findings, Advisor and database-relationship images are not required in this reduced set. Preserve their files; omit them from the main thesis unless a section genuinely needs them. If your guide requests supplementary interface evidence, obtain approval for an additional technical appendix rather than putting it among photographs or certificates.

## Readability and authenticity

- Prefer the SVG originals for diagrams. Keep an editable original even if your document editor requires a PNG export.
- Capture real application views at a legible browser zoom. Crop irrelevant navigation, not evidence or important limitations. Do not enlarge blurred text and call it corrected.
- Redact personal identifiers, credentials and private repository information before sharing. Identify redactions without exposing the original data.
- Do not substitute generated interface mockups or synthetic fixture captures for observations from a real saved audit. Label fixtures explicitly if used to demonstrate a test.
- Use one main screenshot per figure where possible. Check captions and smallest labels at the final printed size.
- Use automatic captions and cross-references. The old asset filename does not determine its new thesis figure number.
- Keep images inline with text to avoid floating-layout problems in Word or Google Docs.

## Final check

Each figure must be mentioned in the surrounding text, have a caption, and appear in the List of Figures. Update the table of contents and page numbers only after final document layout. University formatting requirements take precedence over this suggested distribution.
