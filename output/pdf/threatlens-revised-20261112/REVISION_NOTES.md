# ThreatLens paper revision

Revised on 12 November 2026 from the user-supplied `ThreatLens (1).pdf`. The original PDF has not been overwritten. No application code or database configuration was changed.

## Files

- `ThreatLens_Revised.pdf`: revised four-page, two-column paper.
- `ThreatLens_Revised.tex`: complete editable LaTeX source, including the vector diagram and references.
- `ThreatLens_LaTeX_Package.zip`: source, compiled PDF and these notes together.

## Authors and affiliations

| Author | Department | Email |
| --- | --- | --- |
| Jignesh Sonewane | Computer Science and Engineering | jignesh.sonewane.cyb@ghrce.raisoni.net |
| Soham Pashine | Computer Science and Engineering | soham.pashine.cyb@ghrce.raisoni.net |
| Bhargav Bawane | Computer Science and Engineering | bhargav.bawane.cyb@ghrce.raisoni.net |
| Professor Pankaj Sonewane | DIC Department | pankaj.sonewane@raisoni.net |

All four entries retain the original institution, G. H. Raisoni College of Engineering, Nagpur, India. DIC appears only for Professor Pankaj Sonewane in the author block, as requested. Soham's and Bhargav's addresses follow the pattern supplied by the user; mailbox existence has not been verified. Confirm their spelling and addresses before submission.

## Writing and layout

- Rewrote the abstract, introduction, related work, architecture, methods, discussion and conclusion in direct academic language.
- Retained the original title and the six-engine prototype described in the supplied paper; this is not a new implementation audit of the current application.
- Replaced the placeholder author and email, including in PDF metadata.
- Retained a readable 10-point, US Letter, IEEE-style two-column layout. Four author blocks and clearer limitations expand the paper from three to four pages.
- Redrew the architecture as native vector artwork. The LaTeX file does not depend on external image files.
- Kept the numerical detection and retrieval tables, while making the limits of the available evidence explicit.
- Distinguished candidate compliance mappings from certification, model confidence from calibrated probability, and scanner errors from a clean assessment.
- Removed unsupported guarantees about prompt delimiters, perfect detection and automatically audit-ready outputs.

## Reference corrections

The bibliography now contains seven identifiable primary sources with clickable links. Descriptions were narrowed to claims supported by those sources.

1. The Zhou review is cited as the identifiable [arXiv preprint](https://arxiv.org/abs/2404.02525), without relying on the original draft's venue attribution.
2. [arXiv:2401.17010](https://arxiv.org/abs/2401.17010) is by Alexey Shestov and coauthors, not Steenhoek. Its fine-tuning study does not establish this project's 0.70 confidence threshold.
3. [arXiv:2503.04002](https://arxiv.org/abs/2503.04002) is by Md Nizam Uddin, Yihe Zhang and Xiali Hei, not Fan. The unsubstantiated 35–60% missed-vulnerability claim was removed.
4. The [Lewis RAG paper](https://arxiv.org/abs/2005.11401) is retained as background for retrieval-grounded generation.
5. [arXiv:2402.14160](https://arxiv.org/abs/2402.14160) concerns recursive speculative decoding, not the claimed PNNL CyRAG report. That mismatched citation was removed, not relabelled as support for cybersecurity claims.
6. The claimed 31%-to-4% compliance hallucination reduction and its unverified attribution were removed.
7. [SecretBench](https://arxiv.org/abs/2303.06729) is described as a labelled secret-detection dataset, not proof of a universally optimal entropy configuration.
8. The unverified claim that a cited study establishes Celery/Redis as the recommended DevSecOps pattern was removed. Celery/Redis remain part of the described prototype.
9. [Sentence-BERT](https://arxiv.org/abs/1908.10084) was added for sentence-embedding background, not as proof of the project's retrieval measurements.
10. The [FIRST CVSS 3.1 specification](https://www.first.org/cvss/v3-1/specification-document) remains the scoring reference. The standalone PCI DSS reference was removed because the revised paper does not claim to validate a particular current edition from the incomplete corpus inventory.

## Results requiring author confirmation

No benchmark, scanner test, deployed-security test or experiment was rerun for this document task. The numerical results remain reported preliminary measurements from the supplied paper, not newly verified results.

- The listed pipeline phases total **80.4 seconds**. The original overall figure is **80.7 seconds**. Both are shown; the unexplained **0.3 seconds** has not been invented as a new measurement or assigned to an assumed overhead category.
- The original 37 seeded / 34 detected totals coexist with a statement about six cross-scanner overlaps. The unique-defect denominator needs reconciliation using the ground-truth list.
- The LLM row shows one missed seeded item, while the original narrative supplies two missed-item explanations. The revision does not silently choose one explanation.
- The approximately 16% false-positive measure has no supplied denominator or adjudication protocol. It is explicitly qualified instead of presented as a validated false-positive rate.
- Retrieval precision lacks the query set, relevance labels and reviewer-agreement records needed for replication.
- The 534-entry control inventory is retained as a prototype corpus count, not a statement of the number of official requirements in current framework editions. Reconcile versions, identifiers and source documents before claiming complete coverage.
- The 89 passed / four skipped test counts are historical, not the status of the current application.
- No present-day provider throughput or local GPU inference claim has been established.

Before formal submission, reconcile the raw evaluation records, confirm all author details and obtain the required review from your guide. Natural, clearer writing cannot guarantee any particular AI-detector result. Follow the institution's disclosure and authorship requirements.

## Compile or edit

Upload `ThreatLens_Revised.tex` to Overleaf and select **pdfLaTeX**, or use an installed LaTeX distribution with IEEEtran and the listed standard packages. No BibTeX run or separate image upload is needed.

```text
pdflatex -no-shell-escape -interaction=nonstopmode -halt-on-error ThreatLens_Revised.tex
pdflatex -no-shell-escape -interaction=nonstopmode -halt-on-error ThreatLens_Revised.tex
```

The final page has a commented manual column break to balance the layout without an extra package. Revisit that break if you add or remove content. The two-column layout is IEEE-style, not a claim of acceptance by IEEE or compliance with a specific conference's submission rules.

## Document checks

The final PDF is checked through LaTeX compilation, text extraction, author/email/affiliation assertions, safe page-boundary checks and visual review of all four rendered pages. These are document checks, not verification of the reported experiments.
