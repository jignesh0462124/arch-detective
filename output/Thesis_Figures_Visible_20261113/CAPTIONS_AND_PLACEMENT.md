# ThreatLens thesis figures

Prepared 12 November 2026. This set contains ten numbered figures: three deterministic diagrams and seven interface/report figures. Screens are genuine captures from the running project, not generated mockups. The report panels are rasterized pages from an actual authenticated PDF download. No scan results, source lines, responses or metrics were added to the screenshots.

## Names and branding

ThreatLens is the name used in the thesis. The running application displays **Archon**. That branding remains unchanged in the captures. Introduce it once in the thesis: “ThreatLens is implemented through the Archon web interface shown in the following figures.” Use this wording only if both names intentionally refer to the same project in your submitted thesis.

## Figure list, captions and placement

| Figure | Image file | Insert in section | Copy-ready caption |
|---|---|---|---|
| 3.1 | `figure-3-1-research-workflow.png` | 3.1 Research Design and Workflow | Figure 3.1: Research and development workflow for the ThreatLens prototype, from requirements and architecture to implementation, verification and documented limitations. |
| 5.1 | `figure-5-1-system-architecture.png` | 5.1 Overall ThreatLens Architecture | Figure 5.1: Core architecture of the saved-ZIP audit workflow, showing the web interface, authenticated API, concurrent source preparation and analysis, private persistence and supporting report and Advisor services. |
| 5.2 | `figure-5-2-dashboard.png` | 5.2 User Interface and Application Navigation | Figure 5.2: Dashboard showing the latest completed audit, saved finding totals and findings awaiting review. |
| 5.3 | `figure-5-3-upload-and-recorded-activity.png` | 5.4 Local In-Process Scanning Pipeline | Figure 5.3: Project ZIP intake (a) and retained scan activity from a completed saved audit (b). Panel (b) illustrates recorded processing stages, not a live scan initiated for this figure. |
| 5.4 | `figure-5-4-findings.png` | 5.6 Static Scanning Engines and Finding Normalization | Figure 5.4: Findings interface showing recorded severities, source locations and the selected finding's evidence and remediation guidance. |
| 5.5 | `figure-5-5-security-advisor.png` | 5.7 AI Agent Pipeline and Prompt Design | Figure 5.5: Saved finding-specific Security Advisor conversation showing contextual assessment, uncertainty and suggested verification for a reported static-SVG finding. |
| 5.6 | `figure-5-6-audit-workbench.png` | 5.10 Scan Visualization and Attack Graph | Figure 5.6: Read-only Audit Workbench with packaged files, the selected source location, reported finding details and the problems panel. |
| 5.7 | `figure-5-7-attack-graph.png` | 5.10 Scan Visualization and Attack Graph | Figure 5.7: Evidence-based graph associating a saved finding with its source component. Connectors indicate source associations rather than verified exploit or network paths. |
| 5.8 | `figure-5-8-generated-report.png` | 5.11 Reporting, Exports and Audit Events | Figure 5.8: Generated audit report showing the cover (a) and an evidence-and-remediation page (b), prepared from saved results without rerunning analysis. |
| 5.9 | `figure-5-9-database-erd.png` | 5.12 Database Schema and Data Relationships | Figure 5.9: Selected core database entities and foreign-key relationships supporting workspace membership, scans, findings, private source previews and compliance mappings. |

Use these section numbers only where they match your final thesis structure. Renumber captions with Word's **Insert Caption** function after the chapter order is final.

## How to insert in Word / Microsoft cloud

1. Use **Insert → Pictures**, select the PNG, keep its aspect ratio and set **In line with text**.
2. Center the figure and place its caption immediately below it. Do not stretch the image independently in each direction.
3. Use a full text-width figure for screenshots. Prefer a landscape section for the architecture, ER diagram and three-pane Workbench when allowed by your institution.
4. The multi-panel upload and report figures can become too small on one portrait page. The `individual-panels` directory contains panels (a) and (b) separately, allowing them to be placed consecutively under the same figure number.
5. The three diagrams also have SVG versions for scalable linework. PNG is the broadest-compatibility option. Do not upscale UI captures expecting extra source detail; their quality is limited by the original browser screenshot.
6. Add the caption to Word's List of Figures; do not type a separate inconsistent list manually.

## Evidence and interpretation

- Dashboard, Findings, Workbench and report examples use the saved **MERN E Commerce Store main** audit. The interface records six findings. These are reported candidates, not independently confirmed vulnerabilities or a measured accuracy result.
- Workbench lists **90 preview entries**; the saved report separately records **81 scanned files**. Preview-file count and analysis coverage are different measures and must not be treated as interchangeable.
- Advisor and graph use the saved **GHRCE SIH JUDGE PORTAL master** finding. The saved Advisor response discusses the difference between static trusted SVG strings and attacker-controlled HTML. It is guidance, not proof that all related code is safe.
- Figure 5.3 is an upload screen plus recorded completed-scan activity. No live progress, new upload or synthetic result was manufactured for the screenshot.
- Framework percentages are saved automated signals, not compliance certification or detection accuracy.
- The PDF was downloaded through the authenticated application. Panels retain its generated timestamps, branding, report references and saved evidence, including incomplete snippets already present in saved data.
- Screenshots were captured on 12 November 2026. They demonstrate observed interfaces and saved output, not exhaustive validation of every application workflow.

## Diagrams and source grounding

The diagrams were drawn programmatically using text, rectangles and connectors, not an image-generation model. They follow the inspected implementation and selected checked-in migrations:

- Workflow and architecture: current README and the saved-ZIP orchestration in `threatlens/app/api/audit_workbench.py` and `threatlens/app/api/local_scan.py`.
- Core ER relationships: initial schema and Audit Workbench migrations. The ER diagram intentionally omits additional user, job, chat and integration relationships for readability; it is not the complete database schema.
- The architecture shows the in-process saved-ZIP path. Optional GitHub, separate worker and retrieval paths are outside that figure. HTTPS is the deployment transport; the local screenshots were captured over localhost HTTP.
- Report generation renders saved evidence; it does not itself request a new vulnerability assessment. Model-provider links also serve analysis and on-demand Advisor requests.

## Privacy and unchanged project

Visible account names/email in sidebar profile blocks were covered with a labelled redaction. Source masking already applied by the application remains intact. No email, token, password or private environment-file content is included in this deliverable. No original PDF or raw unredacted screenshots are included in the ZIP.

No application source, environment settings, authentication, RLS policies, schema or saved audit records were changed to prepare these figures. Existing unrelated worktree changes were left untouched. Figures are observation artifacts, not a new application release.

## Files

- Ten numbered main PNG figures.
- Three corresponding scalable SVG diagrams.
- Four optional individual panels for Figures 5.3 and 5.8.
- `FIGURE_OVERVIEW.png`: contact sheet for browsing, not a substitute for the original figure files.
- `FILE_MANIFEST.json`: dimensions, sizes and SHA-256 checksums for integrity checking.

All main figures and selected panels were opened for visual review. The PDF cover and selected technical page were reviewed after rasterization; the ten-page report was also text-extracted to confirm the selected page's content. This does not assert that every page or recorded security claim has been validated.
