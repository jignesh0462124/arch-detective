# ThreatLens: Chapter-Wise Thesis Draft

## Editing notes — remove this section before submission

This draft follows the supplied eight-chapter contents list. It uses ThreatLens as the research-project name and Archon as the application name shown in the existing screenshots. Confirm that naming convention with your guide. The text is a substantive first draft, not a completed experimental thesis or a guarantee of any detector score. Review it against your own work and follow your institution's rules for assisted writing.

The current README and installation profiles distinguish the saved-ZIP workbench from the optional full scanner-worker and retrieval deployment. This distinction is maintained below. No experiments or live integrations were rerun while preparing this draft. Chapter 6 separates recorded interface observations from missing experimental evidence. Replace every `[AUTHOR INPUT: ...]` with a verified statement before submission; do not turn proposed tests into completed results.

Nine figure placeholders are distributed across all eight chapters. Chapter 5 contains only two. Four figures are proposed diagrams whose image files have not been created. The image-placement guide identifies reusable existing assets. No generated mockups should be presented as application screenshots. Page numbers must be updated after final layout.

# ABSTRACT

Software security reviews often produce more alerts than a developer can investigate at once. A finding may name a weakness without making its source location, practical impact or connection to a security requirement easy to understand. ThreatLens addresses this review problem by bringing project intake, source inspection, findings, remediation guidance and reporting into a shared workspace. The application interface is named Archon.

The system accepts project archives and, when separately configured, authorised GitHub repositories. Source preparation and security analysis are treated as distinct operations, allowing users to inspect available files while processing continues. Saved findings are presented beside a read-only source viewer. A Security Advisor supports finding-specific explanations, while an evidence graph helps users inspect relationships between findings and source components. Reports assemble saved observations and limitations without requiring another scan. Authentication, workspace membership checks, private source storage and controlled source retention form part of the design.

The study examines how these components can support a traceable review workflow. It distinguishes the local application path from optional scanner-worker and retrieval services, and separates visible application behaviour from measured detection quality. Existing captures demonstrate source review and report presentation, but they do not establish general detection accuracy, exploitability or compliance certification. The main contribution is an integrated review environment that keeps recorded evidence, suggested remedies and human decisions distinct. Further evaluation requires independently labelled test projects, reproducible run records and user studies.

**Keywords:** software security; static analysis; vulnerability review; compliance mapping; retrieval-augmented generation; remediation; threat modeling.

# CHAPTER 1 INTRODUCTION

## 1.1 Background and Motivation

Modern applications bring together custom code, third-party packages, configuration files and external services. Security problems can arise at any of these boundaries. A development team therefore needs more than a list of suspicious statements: it needs a practical way to examine evidence, understand the surrounding code and decide what should change. ThreatLens grew from this need to connect security assessment with the developer's everyday review process.

## 1.2 Problem Statement

Security findings are difficult to act on when their evidence, source files, explanations and reports are separated. Developers may spend time locating a reported line, distinguishing duplicate alerts or interpreting a generic recommendation. Meanwhile, a stakeholder reviewing a report may not know which checks actually ran. The problem addressed by this project is how to provide an organised, access-controlled assessment workflow that preserves this context and makes incomplete coverage visible.

## 1.3 Existing Approaches and Challenges

Static analysis, dependency auditing, secret detection and manual review address different parts of the problem. Static tools can identify recognised code patterns, while specialist tools inspect packages or suspected credentials. Language models can add explanations but also introduce unsupported interpretations. A usable workflow must therefore retain the origin of each observation rather than treating every output as equally reliable. Tool integration also brings operational challenges, including inconsistent formats, unavailable services and repeated findings.

## 1.4 Research Gap

The project focuses on an integration and presentation gap: moving from an alert to a reviewable decision without losing source evidence or uncertainty. Existing techniques provide useful detection capabilities, but the engineering question is how to connect them with source navigation, retained history, remediation and reporting. This is not a claim that no existing product provides those functions. It defines the particular workflow and evidence-handling problem investigated by this implementation.

## 1.5 Aim and Objectives

The aim is to develop a security-review platform that helps authorised users inspect project findings and understand their possible implications. The objectives are to support controlled project intake; retain source-linked findings; provide a readable source workbench; explain assessment coverage; present remediation separately from recorded evidence; generate consistent reports; and protect access across workspaces. Evaluation must examine these objectives individually, rather than assuming that a functioning interface establishes accurate detection.

## 1.6 Research Questions

The study asks four questions. How can a project retain a useful link between an uploaded file, a finding and its explanation? How can static and model-assisted observations be presented without concealing their limitations? How can source preparation and analysis be organised so that users obtain useful feedback before every stage finishes? Finally, what evidence is needed to evaluate detection quality, review usability and workspace isolation separately? These questions guide the implementation and the proposed experimental assessment.

## 1.7 Project Scope and Limitations

The main scope is the saved project-ZIP workflow and its source-review, findings, graph, Advisor and report interfaces. Repository integration and extension-policy review depend on additional configuration and should be evaluated as separate capabilities. The system does not prove exploitation by displaying a finding, and a suggested code change is not a verified repair. Source previews are time-limited. Unsupported files, excluded content, provider failures and unexecuted checks must be included in the coverage statement.

## 1.8 Main Contributions

The principal contribution is the connection between evidence and review. A saved audit can be reopened, its findings inspected beside source text, and its output communicated through a report. A second contribution is the separation of processing states: a file preview, a completed analysis and a published report are not treated as the same event. The architecture also makes access control part of the data flow rather than leaving it solely to visible navigation controls.

**[INSERT FIGURE 1.1 HERE — reuse the existing overall system architecture diagram as an introductory overview.]**

*Figure 1.1: Overview of the ThreatLens saved-ZIP review architecture, showing the interface, authenticated API, source preparation, analysis and private persistence.*

Figure 1.1 introduces the main components. Their implementation is explained in Chapter 5; optional worker and retrieval services are not implied by this core-workflow diagram.

## 1.9 Thesis Organization

Chapter 2 reviews the methods and terminology that inform the project. Chapter 3 describes the research and evaluation approach. Chapter 4 identifies the platform and evidence sources. Chapter 5 explains implementation decisions. Chapter 6 separates available observations from measurements that still require verification. Chapter 7 summarises the contribution and its limits, while Chapter 8 proposes further research. References and appendices provide supporting material without replacing evidence in the main discussion.

# CHAPTER 2 LITERATURE REVIEW

## 2.1 Introduction to Software Vulnerability Detection

Vulnerability detection attempts to identify conditions that may allow software to behave insecurely. A useful review distinguishes a suspicious construct from a demonstrated vulnerability. The meaning of an alert depends on data flow, validation, configuration and runtime conditions. This chapter considers complementary analysis methods and the evidence each can provide. It does not rank commercial products or infer that integrating several tools necessarily improves accuracy without a controlled comparison.

## 2.2 Static Application Security Testing (SAST)

Static analysis examines code without running the target application. Depending on the tool, analysis may use patterns, syntax trees or data-flow reasoning. OWASP describes taint analysis as following untrusted data from a source towards a potentially dangerous sink [1]. Its usefulness depends on the supported language, rules and available context. A reported pattern should therefore lead to investigation rather than an automatic claim that an exploit is possible.

## 2.3 Dependency, Secret and Configuration Analysis

Dependency analysis concerns the packages an application uses, while secret detection concerns credentials and similar sensitive values. Configuration review examines settings that affect deployment behaviour. These categories need different evidence: a package finding requires version information, whereas a secret alert requires contextual interpretation. SecretBench provides a labelled dataset intended to support research on software-secret detection [2]. Its role here is methodological: evaluation needs labelled examples, including misleading look-alike strings, not only successful detections.

## 2.4 AI and Large Language Models for Code Security

Language models can relate a code fragment to a natural-language explanation and suggest possible changes. Zhou and colleagues review research on their use in vulnerability detection and repair [3]. That literature provides a foundation for exploring model-assisted review, but it does not establish the accuracy of this project's selected provider or prompts. Generated explanations must be checked against the submitted code, particularly when the model receives only part of a file or lacks runtime context.

## 2.5 Retrieval-Augmented Generation in Security Analysis

Retrieval-augmented generation combines generated responses with retrieved reference material. Lewis and colleagues describe a model that incorporates an external retrieval mechanism into knowledge-intensive language tasks [4]. In a security-review setting, reference material may include weakness descriptions or control clauses. The relevant distinction is between finding a potentially useful passage and interpreting it correctly. Retrieval supplies context; it does not independently verify a vulnerability or settle a compliance question.

## 2.6 Vulnerability Taxonomies and CVSS Prioritization

MITRE's Common Weakness Enumeration provides a vocabulary for describing categories of software and hardware weaknesses [5]. CVSS serves a different purpose: it characterises vulnerability severity through defined metrics [6]. A weakness identifier is not a score, and neither is a triage decision. Keeping these concepts separate helps avoid misleading interfaces in which a critical label, an unresolved status and a control mapping appear to represent the same judgement.

## 2.7 Compliance Mapping and Remediation Guidance

Compliance mapping links an observation to a potentially relevant requirement. The relationship should explain why the cited text applies and what evidence remains missing. Many obligations concern operational procedures, people or organisational controls that a repository cannot establish. Remediation guidance should likewise identify assumptions, expected behavioural effects and checks to perform. In ThreatLens, both activities are treated as assistance for a reviewer rather than a substitute for professional assessment.

## 2.8 Comparison with Existing Security Assessment Tools

The comparison is organised by method rather than unsupported product rankings. Static analysis contributes repeatable rule-based checks. Dependency and secret tools contribute specialised inspection. Model-assisted review contributes explanation and contextual reasoning. Manual review contributes application knowledge and judgement. Their roles overlap, but they are not interchangeable. ThreatLens is evaluated as a workflow that combines and presents evidence; claims of better precision or recall require the baseline experiment described in Chapter 6.

**[INSERT FIGURE 2.1 HERE — proposed method-classification diagram; not a product screenshot.]**

*Figure 2.1: Complementary security-review approaches and their evidence: static patterns, package versions, suspected credentials, configuration settings, model explanations and human judgement.*

Use six labelled boxes leading to a common “Evidence review” box. Do not add performance percentages or rank the methods without experimental evidence.

## 2.9 Comparative Literature Synthesis

The selected sources address different levels of the problem. OWASP explains analysis practices [1]. SecretBench concerns evaluation data for one specialised task [2]. Zhou and colleagues synthesise model-based detection and repair research [3], while Lewis and colleagues establish the retrieval-generation approach [4]. CWE and CVSS provide classification and severity terminology [5, 6]. Together, these sources support a review-oriented design, but none directly validates the combined ThreatLens deployment.

## 2.10 Consolidated Research Gap

The resulting research focus is a traceable connection among source material, analysis outputs, control references and reviewer actions. The study also needs to separate technical integration from demonstrated benefit. A platform may successfully combine tools while still producing unnecessary alerts or incomplete recommendations. The gap is therefore addressed through both implementation and an evaluation protocol that measures coverage, correctness, usability and operational behaviour independently.

# CHAPTER 3 METHODOLOGY

## 3.1 Research Design and Workflow

The study follows an engineering-development approach. Requirements are identified from the review tasks a developer must perform, translated into architecture and data contracts, and implemented through successive application components. Verification then examines both successful workflows and failure conditions. The final discussion relates the available evidence to the original objectives. This process allows implementation progress to be documented without presenting every completed feature as a validated research result.

**[INSERT FIGURE 3.1 HERE — existing research and development workflow diagram.]**

*Figure 3.1: Research workflow from problem definition and requirements to architecture, implementation, verification and discussion of limitations.*

## 3.2 Functional and Non-Functional Requirements

Functional requirements include sign-in, workspace selection, project intake, progress display, finding inspection, source navigation, remediation guidance and report access. Non-functional requirements include controlled resource use, readable interfaces, explicit failures and protection of private material. Requirements should be assigned identifiers and connected to test cases. For example, reopening a completed audit concerns persistence, while denying an outsider's source request concerns authorisation; the two require different checks.

## 3.3 Test Project and Input Selection

Test inputs should include deliberately vulnerable fixtures, corrected versions of those fixtures and permitted real-world projects. Inputs should vary in language, size, nesting, dependency structure and supported file types. Benign examples are necessary to examine false alarms. Selection must avoid publishing live credentials or private code. `[AUTHOR INPUT: list the exact test projects, licences or permissions, versions, checksums and why each was selected.]`

## 3.4 Source Code Ingestion and Preprocessing

The intake process validates the submitted archive before preparing files for inspection. Paths, archive expansion and supported content require checks because uploads are untrusted. A manifest records files available for preview, while analysis may use a smaller eligible subset. Preprocessing must preserve the relationship between a saved finding and its original source coordinates. Excluded or truncated material belongs in the coverage record instead of disappearing from the explanation of what was analysed.

## 3.5 Static Scanning and Finding Normalization

Analysis outputs are normalised into records that can be displayed consistently. A useful record contains an identifier, severity, description, source location, provenance and any available weakness or remediation information. Normalisation should preserve distinctions in the original evidence. Two alerts with the same title are not necessarily duplicates, and an empty result after a scanner failure is not equivalent to a successful check with no findings. Duplicate handling needs explicit test cases.

## 3.6 LLM-Assisted Analysis and RAG

Model-assisted analysis receives bounded context and returns structured information for review. Repository text is treated as data, not as instructions that can redefine the task. For a configured retrieval experiment, relevant reference passages are supplied alongside the finding, with identifiers retained for inspection. The study should record provider, model, prompts, context limits and corpus version. The local API profile alone does not establish that the separate retrieval stack was installed or exercised.

## 3.7 Severity Scoring and Compliance Mapping

Severity, weakness classification and control mapping are evaluated separately. A score needs a defensible metric vector; a control mapping needs a source and a reason for applicability. Missing values remain unavailable rather than being converted into a harmless score. Reviewers should record disagreements and the reasoning used to resolve them. Framework assessment signals are presented as automated interpretations of available evidence, not a statement that an organisation satisfies every requirement.

## 3.8 Remediation and Report Generation

Written remediation is retained alongside the finding. A code solution, where requested, is presented as a proposed replacement and not confused with the uploaded source. Reports are assembled from saved assessment data so that exporting a document does not silently trigger a new analysis. The evaluation should compare displayed findings with exported content, including source locations, limitations and missing fields. Report preparation should not introduce private Advisor conversations into shared audit output.

## 3.9 Evaluation Protocol

Each run should record the application revision, input checksum, configuration, active engines and timestamps. Functional tests examine workflow behaviour; access-control tests examine permitted and denied actions; labelled detection tests examine correctness. Repeated timing runs should use the same machine and network conditions where practical. Model and baseline settings should be fixed before the final evaluation. Failures and skipped integrations must remain in the record rather than being excluded to improve the apparent outcome.

## 3.10 Evaluation Metrics

Let TP be correctly identified labelled defects, FP be incorrectly reported defects and FN be labelled defects that were missed. Precision is TP/(TP+FP), recall is TP/(TP+FN), and F1 is 2TP/(2TP+FP+FN). A zero denominator should be reported as undefined under the chosen convention, not silently treated as a perfect result. Timing metrics should separate acceptance-to-first-preview, analysis, persistence and end-to-end completion. Coverage should report analysed files against eligible files with exclusions explained.

## 3.11 Ethical and Security Considerations

Only authorised projects should be uploaded. Source code, credentials and conversations require controlled access, and any use of an external provider should be disclosed to the project owner. Public thesis figures should remove identifying account details without altering the assessment results. Tests involving deletion or publishing must use isolated resources. The study should also disclose relevant writing assistance and distinguish actual observations from illustrative diagrams, test fixtures and proposed future work.

# CHAPTER 4 DATA COLLECTION, TOOLS AND COMPUTATIONAL PLATFORM

## 4.1 Hardware and Operating Environment

Hardware information is necessary for interpreting performance, not for making the project appear more capable. The development workspace is on Windows, and the installation guide describes a Python 3.12 local profile. The final experiment must record its own machine and software details. `[AUTHOR INPUT: processor, memory, operating-system build, browser version, network conditions, Python/Node versions and test date.]` A remote model service must not be described as running on the development machine's GPU.

## 4.2 Programming Languages and Frameworks

The application uses TypeScript and React for the interface and Python with FastAPI for the API. SQL migrations describe persistent data structures and access policies. These technologies serve different responsibilities: browser interaction, request handling and data integrity. Version information should come from the dependency files and lockfiles associated with the evaluated commit. Older prototype documents should not be used as a substitute for the installed configuration.

## 4.3 Frontend Technologies

The current README identifies React 19, TanStack Router and Query, Tailwind CSS and Monaco. Routing connects application pages, query management coordinates server data, and Monaco provides source inspection. The workbench remains read-only. Responsive controls allow navigation and source review at different viewport sizes. Frontend evaluation should include keyboard access, loading and error states, long file paths and returning to an accepted scan after navigating elsewhere.

## 4.4 Backend Technologies

FastAPI provides the request layer for intake, scan status, source reads, findings, guidance and reports. The backend coordinates private storage and database persistence while retaining request-specific identity. It also mediates optional provider and repository operations. The study should distinguish a reachable API from a correctly configured integration: a health response does not demonstrate that a model provider, private storage bucket or repository permission is working.

## 4.5 Database, Authentication and Storage

The documented platform uses Supabase Auth, PostgreSQL and private Storage. Application authorisation is scoped to workspaces, while database policies constrain access to rows. Supabase documents RLS as a mechanism for combining database access with policies [7]. In this project, source previews and saved assessment metadata have different retention behaviour. The current documentation specifies a 30-day source-preview window; this must not be interpreted as automatic deletion of all findings and reports after 30 days.

## 4.6 Background Processing and Deployment Modes

The installation guide provides separate API, testing and full scanner-worker profiles. The API profile supports the local progressive workbench and direct provider clients. The full profile additionally includes worker, embedding and research dependencies. Installing the API profile therefore does not prove that Celery, Redis, Qdrant or specialist scanner executables are operating. The thesis must identify which mode produced each set of results and keep optional-deployment descriptions separate from observed local behaviour.

**[INSERT FIGURE 4.1 HERE — proposed two-lane platform diagram.]**

*Figure 4.1: Separation between the local API/workbench environment and the optional scanner-worker and retrieval environment.*

Draw one lane for browser, FastAPI, database and private source storage. Draw a second, explicitly optional lane for workers, broker, scanner executables, embeddings and vector retrieval. Do not use arrows that imply every local scan uses all optional services.

## 4.7 Security Scanners, AI and Retrieval Services

The full deployment supports specialist analysis components in addition to model-assisted review. Scanner presence, executable versions and successful invocation need confirmation from run records. Provider selection and fallback should be documented without claiming that all available models were evaluated. Retrieval experiments require an identified corpus and embedding configuration. The project's requirements files describe dependencies, but dependency declarations alone are not evidence that each service contributed to a particular scan.

## 4.8 Data Sources and Reference Material

Evidence sources include authorised input projects, saved findings, source snapshots, generated reports, application logs and public technical references. The existing figure notes identify captures from saved MERN and GHRCE project audits. These captures are useful for explaining the interface, but they are not independently labelled vulnerability datasets. Research papers supply background, while official terminology and specifications support classification. Each source should be used for the type of claim it can actually establish.

## 4.9 Reproducibility and Version Control

A reproducible record should connect each input to a commit, dependency configuration, active feature flags, model selection and output set. Public records must exclude secrets and private source. Useful artefacts include sanitised configuration summaries, input checksums, commands, timestamps and structured test results. Screenshots should carry a capture date and identify demonstration data where applicable. Repeating a run under changed provider behaviour or framework references should be treated as a new experimental condition.

# CHAPTER 5 SYSTEM DESIGN AND IMPLEMENTATION

## 5.1 Overall ThreatLens Architecture

The architecture separates user interaction, request authorisation, analysis, source preparation and persistent results. The browser requests operations through the API, while saved audit records allow users to revisit results. Source preparation and analysis have independent progress because uploading a readable preview is not the same as completing security checks. Figure 1.1 provides the system overview; it is referenced here rather than repeated, keeping this chapter focused on design decisions and two essential interface figures.

## 5.2 User Interface and Application Navigation

The navigation follows the review workflow: Dashboard, Codebase Audit, Findings, Workbench, Attack Graph, Reports and Security Advisor. History and resume controls help users return to saved work. Settings and profile controls are separate from the assessment itself. The interface should explain whether a view shows the latest completed audit, a selected historical scan or an example scenario. This distinction prevents a user from interpreting an empty or still-running scan as a clean assessment.

## 5.3 Authentication, Authorization and Workspaces

Authentication identifies the user; authorisation determines which workspace resources that user may access. The application must check resource relationships rather than trusting identifiers supplied by the browser. Database policies provide an additional boundary, while privileged server credentials remain outside client bundles. A viewer's ability to read shared findings does not imply permission to delete scans or publish repository changes. This separation must be tested through actual permitted and denied requests.

## 5.4 Local In-Process Scanning Pipeline

The saved-ZIP path accepts an authorised upload, prepares scan state and starts source handling and analysis. Available previews can be published while remaining files are still being prepared. Findings should become final only after persistence succeeds. A source-preparation failure must not erase otherwise saved findings. Returning to the intake page uses an account- and workspace-scoped reference to reopen the audit, rather than treating the upload component's lifetime as the lifetime of the scan.

## 5.5 Hosted Scanning and Worker-Orchestrated Pipeline

The repository also documents a separate scanner-worker deployment with additional dependencies and services. A worker architecture can move long-running tasks away from API processes, but requires explicit job ownership, recovery and service configuration. This is a deployment option, not proof that the current saved-ZIP path uses the same orchestration. `[AUTHOR INPUT: identify whether the worker deployment was exercised, with broker, worker and service versions; otherwise state that it was not evaluated.]`

## 5.6 Static Scanning Engines and Finding Normalization

Normalised findings allow the interface to present severity, location, origin and remediation consistently across supported inputs. Stable finding identifiers remain important when titles or source locations are similar. Counts and pagination must refer to saved records, not only to the rows currently displayed. An engine failure should contribute a limitation to the scan, while an unsupported language should remain outside any claim of complete coverage. The actual engine set is documented per execution mode.

## 5.7 AI Agent Pipeline and Prompt Design

Model assistance is used to interpret findings and prepare guidance from bounded context. A finding-specific request must carry the authorised workspace, scan and finding relationship; it must not silently fall back to a general conversation after losing context. Prompts should separate observations, assumptions, suggested changes and verification. The application also needs explicit interrupted-response handling. A truncated code suggestion is incomplete, even when its first paragraphs appear convincing.

## 5.8 CVSS Scoring and Vulnerability Classification

The interface preserves recorded weakness identifiers and available scores. CVSS 3.1 defines severity through a metric vector [6]; a valid zero score is different from a missing score. A model-generated value should be checked for consistency with its vector and evidence. Triage decisions such as accepting risk or marking a false positive remain separate from severity. A fix proposal or a report download must not automatically change a finding's triage state.

## 5.9 RAG and Compliance Mapping

The repository contains retrieval components, including embedding, vector-client and corpus-preparation modules. Their presence establishes implementation material, not successful execution in the current local mode. A retrieval-enabled assessment must preserve corpus version, retrieved control identifiers and the evidence supporting each proposed relationship. When the required service is unavailable, the system should report that limitation. A saved framework percentage should not be presented as legal compliance or certification.

## 5.10 Scan Visualization and Attack Graph

The workbench places the file explorer, source viewer and finding details within one page. A reviewer can inspect the reported location while retaining access to evidence and remediation. The graph provides a complementary view of relationships between findings and source components. In the saved-evidence view, connectors represent associations, not verified network routes or successful exploitation. Explicitly labelled scenarios remain separate from the user's saved evidence.

**[INSERT FIGURE 5.1 HERE — original Audit Workbench screenshot; use a sharper recapture for final submission.]**

*Figure 5.1: Read-only Audit Workbench showing source navigation, a selected finding and its recorded evidence.*

**[INSERT FIGURE 5.2 HERE — original Attack Graph screenshot; do not replace recorded data with a mockup.]**

*Figure 5.2: Evidence graph linking a saved finding to its source component; the displayed connections do not establish an exploit path.*

These are the only figures in Chapter 5. Detailed screenshots of other pages can be omitted or placed in a separately approved supplementary appendix.

## 5.11 Reporting, Exports and Audit Events

Reports organise completed saved audits and prepare PDFs on demand. The exported document should preserve the same finding identities, evidence and limitations shown in the interface. Audit events record actions and state transitions, whereas scan history records saved assessments; they should not be described as interchangeable. Export verification must examine all selected or filtered results rather than assuming that a visible page contains the entire dataset. A report is review material, not an approval certificate.

## 5.12 Database Schema and Data Relationships

Workspaces connect members to scans, and scans connect findings with source snapshots and related assessment information. Optional chat and repository features add relationships without changing the meaning of the core audit records. The existing ER diagram can remain in supplementary material instead of adding another figure here. Foreign keys and policies serve different purposes: a valid relationship does not, by itself, authorise the requesting user to read or modify the linked record.

## 5.13 API Design and Data Flow

API requests need a clear scope and a response appropriate to the operation. List endpoints return bounded summaries, while detailed evidence is loaded when selected. Upload acceptance, scan completion and source availability require distinct states. Request failures should distinguish unavailable services, invalid credentials and denied access. Safe-read recovery must not become automatic replay of uploads or publishing operations. API documentation should identify these behaviours without exposing credentials or private payloads.

## 5.14 Security and Reliability Controls

The documented design includes archive validation, private storage, source redaction, workspace checks, bounded processing and explicit error states. Uploaded dependency files must not cause arbitrary package installation on the API host. Report generation restricts resource access, and code suggestions remain read-only. These controls require separate verification, including malformed inputs and revoked access. No single unit-test suite, scanner run or successful deployment is sufficient to establish that every security boundary works.

## 5.15 Deployment and Configuration

The frontend builds as a standalone Node server, while the API runs separately. Both must refer to the same intended identity project, and browser origins must match the API's permitted configuration. Optional integrations are enabled only when their services and credentials are configured. The installation profiles should be reproduced in isolated environments. Public frontend configuration and server-only secrets must remain distinct, and the thesis should never include actual environment-file values or access tokens.

# CHAPTER 6 TESTING AND SUMMARY OF RESULTS

## 6.1 Experimental Environment

This chapter distinguishes documented interface observations from quantitative experiments. The available figure notes describe captures made on 12 November 2026, but those captures are not a full regression report. A defensible experimental record must identify the evaluated revision and active deployment mode. `[AUTHOR INPUT: insert the environment from Section 4.1, run identifiers, provider/model, enabled engines, corpus version where relevant, and commands used for the final evaluation.]`

## 6.2 Test Dataset and Ground Truth

Ground truth is the reference against which detection claims are judged. It should identify each intentionally introduced or independently confirmed weakness, its location, expected behaviour and corrected counterpart. Saved alerts alone cannot supply that reference because they are the outputs being evaluated. `[AUTHOR INPUT: provide the labelled test inventory, reviewer procedure and ambiguous-case policy.]` Real project names may be anonymised, but their selection method and the limitations of the dataset should remain clear.

## 6.3 Functional Test Cases

Functional verification should cover sign-in, workspace selection, upload acceptance, progressive source access, history reopening, finding selection, remediation guidance and report export. Negative cases include malformed archives, unavailable providers, expired previews and denied workspace access. A screenshot can demonstrate a visible state, but it does not show every transition that led to it. Use the following evidence table to record actual outcomes rather than marking all cases as passed by assumption.

| Test case | Expected behaviour | Observed result and evidence |
| --- | --- | --- |
| Accepted ZIP, then navigate away | Reopen the same server-side scan without duplicate submission | [AUTHOR INPUT] |
| Finding selected in workbench | Correct evidence and source location remain associated | [AUTHOR INPUT] |
| Provider or preview failure | Explicit limitation; no false clean/completed state | [AUTHOR INPUT] |
| Viewer and outsider requests | Only authorised reads and actions are permitted | [AUTHOR INPUT] |
| PDF export | Saved finding identities and limitations match the report | [AUTHOR INPUT] |

## 6.4 Vulnerability Detection Results

The existing capture notes describe a saved MERN project audit with six reported findings. They also distinguish 90 preview entries from 81 scanned files. These are observations about saved output, not six independently confirmed vulnerabilities or an accuracy measure. The difference between preview count and analysis count illustrates why coverage needs separate reporting. `[AUTHOR INPUT: insert verified detection counts from the labelled evaluation; otherwise retain this section as an explicitly limited output review.]`

**[INSERT FIGURE 6.1 HERE — existing report evidence-and-remedies panel, shown alone at readable width.]**

*Figure 6.1: Saved audit report excerpt showing recorded source evidence, remediation and suggested verification checks. The excerpt illustrates reporting behaviour, not independently validated detection accuracy.*

## 6.5 Detection Quality Metrics

Precision, recall and F1 should be calculated only after comparing findings with the labelled reference. Duplicate alerts need a documented matching rule so that repeated reports do not inflate true positives. Historical manuscript totals should not be reused without their underlying evaluation records and matching procedure. `[AUTHOR INPUT: supply TP, FP, FN, matching rules and per-language or per-category results.]` If these are unavailable, state that detection quality has not yet been established.

## 6.6 Performance and Scan Duration

Useful timing separates waiting for acceptance, obtaining a readable source preview, analysing content and saving the final result. Repeated runs should report the number of observations and an appropriate summary such as median and range. Concurrent stages can overlap, so their durations must not simply be added and presented as elapsed completion time. Differences between phase timings and total duration require recorded timing boundaries, not invented overhead. `[AUTHOR INPUT: replace historical timing claims with traceable run measurements and the actual timing boundaries.]`

## 6.7 AI, RAG and Remediation Evaluation

Explanations should be reviewed for groundedness, uncertainty, correct source references and whether the proposed change preserves behaviour. The saved SVG-related example is useful because static trusted markup must not automatically be equated with attacker-controlled HTML. A suggestion that overstates the evidence is a review failure even if it appears polished. Retrieval evaluation needs labelled relevant controls, and repair evaluation needs applicable changes and tests. `[AUTHOR INPUT: supply reviewer ratings, disagreements and verified examples.]`

## 6.8 Robustness, Security and Error Handling

Robustness testing should deliberately interrupt the normal workflow: reject unsafe archives, remove membership, expire source access, interrupt a response and simulate unavailable services. Each outcome needs an expected state and observed evidence. In particular, a backend outage must not be mistaken for an invalid user session, and a scanner failure must not be counted as a successful clean scan. No live security validation was performed during this writing pass; final claims require the corresponding test records.

## 6.9 Comparison with Baselines

A useful baseline comparison would evaluate static-only analysis and the combined workflow on the same labelled inputs. Where retrieval is studied, compare retrieval-enabled and non-retrieval conditions with matched model settings and clearly defined relevance labels. Timing conditions should remain comparable. `[AUTHOR INPUT: insert actual baseline results or state that no controlled baseline experiment was completed.]` A feature comparison or literature survey cannot establish that ThreatLens is faster or more accurate than another system.

## 6.10 Discussion and Limitations

The available material supports a discussion of workflow design and saved-output presentation. It does not establish universal vulnerability detection, compliance correctness or superiority over other tools. Important limitations include incomplete runtime context, partial file coverage, dependence on external services and the need for reviewer judgement. The final thesis should identify which research questions have direct experimental answers and which remain open. This produces a narrower but more defensible conclusion than unsupported performance claims.

# CHAPTER 7 CONCLUSION

## 7.1 Summary of Achieved Objectives

The documented implementation brings project intake, source review, findings, guidance and reporting into one workspace-oriented application. Existing captures illustrate several of these interfaces with saved output. The distinction between source availability and analysis completion is particularly important: it allows progress to be communicated without claiming that an unfinished assessment is clean. Completion of each objective should be supported by the test evidence in Chapter 6 rather than inferred from the presence of a page.

## 7.2 Key Findings and Contributions

The main engineering contribution is a traceable review workflow. Recorded evidence remains distinct from proposed changes, and the graph and reports offer complementary ways to inspect saved results. The study also identifies a practical evaluation lesson: preview coverage, analysed-file coverage, finding counts and detection accuracy are different quantities. Treating them separately makes both the interface and the research discussion more understandable. Quantitative improvements remain conditional on a completed and reproducible evaluation.

**[INSERT FIGURE 7.1 HERE — proposed contribution-and-evidence summary, not a results graph.]**

*Figure 7.1: Summary of project objectives, corresponding implementation evidence and remaining validation needs.*

Use three columns: “Objective”, “Available evidence” and “Remaining verification”. Include evidence-linked review, retained audits, report presentation and access isolation. Do not place a “passed” badge against an objective without the Chapter 6 test record.

## 7.3 Limitations and Final Remarks

ThreatLens should be understood as assistance for developers and reviewers, not an automatic security authority. Its usefulness depends on the quality of inputs, active analysis components and the care with which findings are interpreted. A repository alone cannot demonstrate every organisational control, and generated guidance cannot replace testing. The project provides a basis for further evaluation while keeping these limits visible. Its strongest conclusion is the integration of review tasks, not a guarantee that uploaded software is secure.

# CHAPTER 8 FUTURE SCOPE

## 8.1 Scanning Coverage and Language Support

Future work should broaden language and framework coverage through explicit parser support and documented rules. Cross-file reasoning and runtime-aware validation may address cases that isolated snippets cannot explain. Any new capability should include benign examples, vulnerable fixtures and clear exclusion rules. Packaged extensions and infrastructure configurations require their own assessment profiles; they should not be described as fully covered merely because their files can be uploaded.

## 8.2 AI and Retrieval Improvements

Model and retrieval improvements should begin with evaluation data rather than an assumption that a larger model will perform better. Useful work includes versioned control corpora, relevance judgements, prompt comparisons and checks for unsupported explanations. Context selection should preserve the evidence needed for a finding while respecting source privacy and input limits. Claims of reduced hallucination or better remediation require measured comparisons, including cases where no code change is justified.

## 8.3 Continuous Integration and Workflow Automation

Repository scanning and reviewed publishing are already described as configurable capabilities, so future work should focus on extending and validating them rather than presenting them as entirely absent. Potential directions include policy-controlled CI initiation, clearer review checkpoints and reliable comparison after changes. Publishing must retain explicit approval, and passing external checks must not automatically resolve a finding. Deployment and permission constraints need testing in isolated repositories before broader use.

## 8.4 Scalability, Security and Deployment

Further deployment work should evaluate queueing, worker isolation, concurrent uploads, storage cleanup and recovery under load. Performance improvements must not weaken authorisation or omit checks without disclosure. Operational study should include provider outages, rate limits and membership changes during active work. Browser-extension policy packs will also need version maintenance as store requirements change. The objective is controlled, observable behaviour under realistic conditions, not only a lower time from one benchmark run.

## 8.5 Extended Validation and User Studies

The next research stage should use diverse, independently labelled projects and participants with different levels of security experience. A user study could measure time to locate evidence, ability to distinguish suggestions from confirmed results and correctness of remediation decisions. Participant consent and source confidentiality are necessary. These studies would provide evidence about whether the integrated interface improves review work, rather than relying only on screenshots or developer impressions.

**[INSERT FIGURE 8.1 HERE — proposed future-work roadmap.]**

*Figure 8.1: Proposed progression from reproducible benchmarks and broader coverage to controlled automation, deployment evaluation and user studies.*

Use four stages: “Reconcile evidence and datasets” → “Extend and evaluate analysis” → “Validate deployment and automation” → “Study developer outcomes”. Label the whole image “Proposed future work”; do not invent completion dates or percentage improvements.

# REFERENCES

[1] OWASP Foundation, “Static analysis,” OWASP Developer Guide. https://devguide.owasp.org/en/05-implementation/05-static-analysis/ (accessed 13 November 2026).

[2] S. K. Basak, L. Neil, B. Reaves and L. Williams, “SecretBench: A Dataset of Software Secrets,” MSR, 2023, arXiv:2303.06729. https://arxiv.org/abs/2303.06729

[3] X. Zhou, S. Cao, X. Sun and D. Lo, “Large Language Model for Vulnerability Detection and Repair: Literature Review and the Road Ahead,” arXiv:2404.02525, 2024. https://arxiv.org/abs/2404.02525

[4] P. Lewis et al., “Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks,” Advances in Neural Information Processing Systems, vol. 33, 2020. https://arxiv.org/abs/2005.11401

[5] MITRE, “About CWE.” https://cwe.mitre.org/about/index.html (accessed 13 November 2026).

[6] FIRST.Org, “Common Vulnerability Scoring System v3.1: Specification Document,” 2019. https://www.first.org/cvss/v3-1/specification-document

[7] Supabase, “Row Level Security,” Supabase documentation. https://supabase.com/docs/guides/database/postgres/row-level-security (accessed 13 November 2026).

Project-specific descriptions were checked against the repository README, `threatlens/INSTALLATION.md`, the saved-ZIP API implementation and the existing figure evidence notes. In the submitted thesis, identify the evaluated repository revision and archive permitted supporting material. The bibliography is a starting set, not a claim of an exhaustive systematic review.

# APPENDICES

## APPENDIX A PROJECT AND GROUP PHOTOGRAPHS

Include genuine project and group photographs with brief captions naming the activity, location and date where known. Obtain permission from identifiable participants. These photographs document project activity, not detection accuracy. Do not substitute generated group photographs.

## APPENDIX B INDUSTRY PHOTOGRAPHS AND CERTIFICATES

Include only relevant, authentic visit photographs and certificates. If no industry visit or certificate applies to this project, remove the appendix or state “Not applicable”, according to the institution's format. Do not imply an industry partnership that did not occur.

## APPENDIX C PROJECT COMPETITION AND AWARD CERTIFICATES

Include verified participation or award certificates with event name and date. Distinguish participation from an award. Do not infer publication, patent filing, acceptance or recognition from a project demonstration. The front-matter list of publications, competitions and patents should use the same verified records.
