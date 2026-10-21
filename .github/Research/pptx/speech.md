Below is a natural slide-by-slide script based on your presentation. :codex-file-citation{path="C:\Users\jigne\OneDrive\Desktop\College Project\arch-detective\.github\Research\pptx\ThreatLens_Project_Presentation_with_Literature-.pdf" purpose="source"}

## Slide 1 — Title

“Good morning everyone. We are Jignesh Sonewane, Soham Pashine, and Bhargav Bawane. Under the guidance of Professor Pankaj Sonewane, we are presenting our project, ThreatLens—an LLM-agentic compliance and threat-modeling engine.”

## Slide 2 — Contents

“I’ll begin with the problem, briefly discuss the research behind our work, and then explain our objectives, methodology, system architecture, implementation status, testing, and future scope.”

## Slide 3 — Introduction

“Security scanners produce technical findings, but organizations need those findings connected to compliance requirements. Doing this manually is slow and difficult.

ThreatLens solves this by scanning code, architecture files, and server logs. It detects vulnerabilities and maps them to frameworks such as GDPR, SOC 2, ISO 27001, PCI DSS, and NIST CSF.

The final output includes severity, CVSS scores, violated controls, remediation advice, and downloadable reports.”

## Slides 4 and 5 — Literature Survey

“Our literature review covers vulnerability detection using LLMs, retrieval-augmented generation, secret detection, log anomaly detection, threat modeling, and automated security scanning.

Existing studies provide strong methods, but most focus on only one area. Some detect vulnerabilities, while others support compliance or threat modeling.

This research gap motivated ThreatLens: one platform that combines multiple scanners, RAG-based compliance mapping, LLM reasoning, and report generation.”

## Slide 6 — Objectives

“Our project has five main objectives.

First, accept different inputs such as ZIP files, Git repositories, architecture files, and logs.

Second, detect vulnerabilities using multiple scanners and LLM review.

Third, map findings to compliance controls using RAG and an LLM.

Fourth, generate audit-ready reports.

Finally, protect every workspace using authentication, authorization, and private storage.”

## Slide 7 — Proposed Methodology

“The workflow contains six steps.

The user uploads an input. We safely extract and validate it. Multiple scanners then analyze the content.

Relevant compliance controls are retrieved from the knowledge base. The LLM maps each finding to those controls and generates severity and remediation information.

Finally, ThreatLens produces PDF, CSV, and JSON reports.”

## Slide 8 — System Architecture

“The user interacts with a React and TanStack frontend. Supabase manages authentication, and FastAPI handles authorized business operations.

Long-running scans are sent through Redis and Celery. The scanner sandbox executes security tools without receiving database or infrastructure credentials.

Qdrant stores compliance knowledge, while the Groq-hosted Llama model performs structured reasoning. PostgreSQL stores application data, and private storage holds uploaded inputs and reports.”

## Slide 9 — Modules and Technology Stack

“The frontend uses React, TanStack, TypeScript, Tailwind, and React Query.

The backend uses FastAPI, Pydantic, SQLAlchemy, and Alembic. Celery and Redis manage background tasks.

Our scanner layer includes Semgrep, Bandit, TruffleHog, dependency auditing, and log-anomaly detection.

Qdrant and sentence transformers support RAG, while Groq and LangChain support structured LLM output. Reports are generated using Jinja2, Matplotlib, and WeasyPrint.”

## Slide 10 — Database and Security

“Our core database stores users, workspaces, scans, findings, compliance violations, reports, and audit events.

Supabase manages identities, while FastAPI verifies JWT tokens and workspace membership. Row-level security and signed URLs protect stored data.

Uploaded repositories are treated as untrusted input. Therefore, scanners run with resource limits and without access to infrastructure credentials.”

## Slide 11 — Implementation Status

“We have implemented the frontend flow, basic FastAPI endpoints, database models, migrations, Docker configuration, and major RAG components.

The remaining work includes completing authentication, ingestion, scanner execution, compliance mapping, CVSS scoring, and report generation.

Our immediate security priorities are credential rotation, scanner isolation, tenant separation, automated tests, and deployment checks.”

## Slide 12 — Testing and Future Scope

“We will test individual scanners, RAG retrieval, and LLM output parsing. Integration testing will cover authentication, storage, row-level security, and FastAPI.

Our end-to-end test will upload a vulnerable project, detect its findings, map them to compliance controls, and generate a report.

Future improvements include reviewer workflows, false-positive handling, additional frameworks, real-time progress, monitoring, and deployment automation.”

## Slide 13 — Conclusion

“To conclude, ThreatLens connects vulnerability detection with compliance reporting in one secure workflow. It converts raw technical findings into understandable, evidence-based, and actionable reports.

Thank you for listening. We are ready for your questions.”
