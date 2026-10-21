# 🎤 ThreatLens: 5-Minute Master Presentation Script & Viva Defense Guide

> **Project:** ThreatLens (*Arch Detective / Archon*)  
> **Topic:** Agentic Compliance & Automated Threat Modeling Audit Engine  
> **Duration:** 4:45 – 5:00 Minutes (~130 words per minute speaking pace)  
> **Slide Deck Reference:** [`./ThreatLens_Project_Presentation_with_Literature-.pdf`](./ThreatLens_Project_Presentation_with_Literature-.pdf)  
> **Literature Survey Reference:** [`./pptx.md`](./pptx.md)  
> **Paper Figures Directory:** [`../../../docs/paper_figures/`](../../../docs/paper_figures/)  

---

## ⏱️ Executive Slide Timing & Agenda

```
┌───────────────┬─────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
│ Time Index    │ Slide Topic                                                 │ Recommended Visual / Figure                      │
├───────────────┼─────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ 0:00 – 0:45   │ 1. Problem Statement: The $50k / 3-Month Audit Dilemma      │ Slide 1 & 2 (Broken Status Quo & Objectives)     │
│ 0:45 – 1:40   │ 2. End-to-End System Architecture & Ingestion               │ Figure 1 (fig1_architecture_diagram.png)         │
│ 1:40 – 2:35   │ 3. Multi-Scanner Pipeline & 88.7% Noise Reduction           │ Figure 2 (Pipeline Flow) & Figure 6 (Confusion)  │
│ 2:35 – 3:30   │ 4. RAG Compliance Mapping & Vector Retrieval                │ Figure 3 (Agent Chains) & Figure 5 (Precision)   │
│ 3:30 – 4:25   │ 5. Cryptographic Security & Automated Regulatory Artifacts  │ Figure 4 (Auth Flow) & Figure 8 (Audit Report)   │
│ 4:25 – 4:55   │ 6. Sub-Linear Scalability & Conclusion                      │ Figure 7 (Latency Scaling) + Live Platform Demo  │
│ 4:55 – 5:00   │ 7. Viva Q&A Defense                                         │ Thank You Slide / GitHub QR Code                 │
└───────────────┴─────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────┘
```

---

## 🎙️ Complete Spoken Script (Word-for-Word with Stage Cues)

> [!TIP]
> **Delivery Tips:**
> - Words in **bold** should be stressed verbally with conviction.
> - `[Action]` cues tell you when to change slides, point at specific chart elements, or make hand gestures.
> - Take a calm 1-second pause at every section transition.

---

### Part 1: The Hook & The Broken Status Quo (0:00 – 0:45)
*Target Duration: 45s | Words: ~105*  
**Visual:** Slide 1 & 2 (Title & Problem Statement)

> "Good morning, respected professors and evaluation committee members.
>
> Today, software teams deploy code to production in minutes. Yet, preparing for regulatory audits like **GDPR, SOC 2, or PCI DSS** still takes **up to three months and costs over fifty thousand dollars** in manual consulting.
>
> Why? Because traditional static analysis tools dump hundreds of disconnected alerts with up to **28% false positives**, completely detached from regulatory standards. Security engineers are left manually cross-referencing CSV spreadsheets against legal control clauses.
>
> To solve this fundamental bottleneck, we developed **ThreatLens** — an agentic security compliance and automated threat modeling audit engine that turns weeks of manual auditing into **under sixty seconds** of actionable, mathematically verified intelligence."

---

### Part 2: End-to-End System Architecture (0:45 – 1:40)
*Target Duration: 55s | Words: ~125*  
**Visual:** Slide 3 — [`Figure 1: End-to-End System Architecture`](../../../docs/paper_figures/fig1_architecture_diagram.png)

> "As illustrated in **Figure 1**, ThreatLens bridges raw source code and legal compliance through a modern, decoupled architecture.
>
> `[Point to frontend on left]`  
> On the frontend, developers interact with a high-performance **TanStack Start and React 19** interface, submitting codebases via Git clones or ZIP bundles, alongside architectural descriptors and server logs.
>
> `[Point to center backend]`  
> The requests enter our **FastAPI gateway**, which dispatches jobs asynchronously through a **Redis and Celery distributed task queue**. 
>
> Instead of relying on a single scanner, our ingestion engine dispatches code simultaneously across **six specialized security engines** running in isolated worker sandboxes. Findings are aggregated, validated, and mapped using vector retrieval before generating publication-grade audit artifacts."

---

### Part 3: Multi-Scanner Orchestration & 88.7% Noise Reduction (1:40 – 2:35)
*Target Duration: 55s | Words: ~125*  
**Visual:** Slide 4 — [`Figure 2: Multi-Scanner Pipeline Flow`](../../../docs/paper_figures/fig2_scanner_pipeline_flow.png) & [`Figure 6: Severity Confusion Matrix`](../../../docs/paper_figures/fig6_confusion_matrix_fp_reduction.png)

> "Our technical breakthrough lies in how we eliminate scanner fatigue, shown in **Figure 2**.
>
> We orchestrate **Semgrep and Bandit** for AST-level static flaws, **Trufflehog** for entropy-based secret detection, **pip-audit and npm-audit** for known dependency CVEs, and an **Isolation Forest anomaly model** for runtime access patterns.
>
> However, raw scanners create immense noise. That is where our **Llama-3 70B LLM Code Reviewer** acts as a confidence-weighted filter. It ingests surrounding code context, validates taint propagation, and filters out benign patterns.
>
> `[Point to Figure 6: Confusion Matrix]`  
> As shown by our empirical evaluation in **Figure 6**, ThreatLens reduces raw false positive rates from **28.4% down to just 3.2%** — representing an **88.7% net noise reduction** while preserving an exceptional **92.1% recall**."

---

### Part 4: RAG Compliance Mapping & Vector Retrieval (2:35 – 3:30)
*Target Duration: 55s | Words: ~120*  
**Visual:** Slide 5 — [`Figure 3: RAG Agent Chains`](../../../docs/paper_figures/fig3_rag_agent_chain_sequence.png) & [`Figure 5: Precision Benchmarks`](../../../docs/paper_figures/fig5_rag_retrieval_precision.png)

> "Finding a vulnerability is only half the battle; knowing which law you violated is the other half.
>
> In **Figure 3**, our **RAG Compliance Agent Chain** embeds validated findings using SentenceTransformers and queries a **Qdrant vector database** pre-seeded with indexed regulatory frameworks: GDPR, SOC 2, ISO 27001, PCI DSS v4.0, and NIST CSF 2.0.
>
> Instead of naive keyword matching, our semantic retrieval ranks the top-five matching legal clauses using cosine similarity.
>
> `[Point to Figure 5: Precision Chart]`  
> In empirical benchmarks across 250 test vectors, ThreatLens achieved a **Mean Precision@10 of 86.8%** and a **Mean Reciprocal Rank of 1.48**, proving that our engine maps technical vulnerabilities to exact legal articles with near-perfect accuracy."

---

### Part 5: Enterprise Security & Automated Audit Artifacts (3:30 – 4:25)
*Target Duration: 55s | Words: ~125*  
**Visual:** Slide 6 — [`Figure 4: Security Auth Flow`](../../../docs/paper_figures/fig4_security_auth_flow.png) & [`Figure 8: Regulatory Audit Report`](../../../docs/paper_figures/fig8_audit_report_artifact.png)

> "Because ThreatLens processes proprietary source code, we engineered it under a zero-trust multi-tenant security model, detailed in **Figure 4**.
>
> We implement **OAuth2 with PKCE** via Supabase, asymmetric **RS256 JWT cryptographic verification** against cached JWKS endpoints, and strict **PostgreSQL Row-Level Security (RLS)** to guarantee absolute tenant isolation.
>
> `[Point to Figure 8: Audit Report Artifact]`  
> Within seconds, ThreatLens compiles findings into an audit-ready executive PDF report featuring **automated CVSS 3.1 scoring**, a multi-framework compliance matrix, and prioritized remediation actions categorized by SLA urgency.
>
> Furthermore, as shown in **Figure 7**, our parallel pipeline scales sub-linearly: auditing a 10,000-line codebase in **18.4 seconds**, and 100,000 lines in under **55 seconds**."

---

### Part 6: Conclusion & Impact (4:25 – 4:55)
*Target Duration: 30s | Words: ~70*  
**Visual:** Slide 7 — Summary & Live Platform Interface

> "To conclude: **ThreatLens** bridges the long-standing divide between DevSecOps and regulatory compliance.
>
> By uniting **multi-scanner static analysis, LLM context validation, and vector RAG compliance mapping**, we replace months of expensive manual audits with verifiable, continuous, and automated security intelligence.
>
> Thank you. We are now open for your questions and would love to demonstrate the live platform."

---

## ⚡ 60-Second Emergency Pitch (If Time is Cut by Panel)

> *"ThreatLens is an automated AI security compliance engine. Preparing for a SOC 2, GDPR, or ISO 27001 audit today takes three months and costs over $50,000 in manual consulting.*  
> 
> *ThreatLens completely automates this workflow: you upload your codebase, and our parallel backend runs six security scanners alongside an LLM reasoning agent to eliminate 88.7% of false positives.*  
> 
> *Then, our vector RAG engine maps every vulnerability to the exact violated legal clauses across five global frameworks with 86.8% precision, and automatically compiles an audit-ready PDF report with CVSS 3.1 scores and code-level remediation steps in under 60 seconds.*  
> 
> *In short, ThreatLens makes enterprise-grade compliance continuous, instant, and mathematically verifiable."*

---

## 🛡️ Top 6 Viva / Examiner Q&A Defenses

### Q1: "Why not just use SonarQube, Snyk, or GitHub Advanced Security?"
> **Examiner Intent:** Wants to see if you built a redundant tool or understand the real market differentiation.  
> **Your Defense:**  
> *"SonarQube and Snyk are excellent for developer code hygiene, but they stop at the CVE or code quality level. They do **not** perform **regulatory compliance mapping**. They cannot tell you: 'This hardcoded secret violates GDPR Article 32(1)(a) and PCI DSS Requirement 8.3.2, exposing you to a 4% global turnover fine.' Furthermore, standard static tools produce high false-positive rates (~28%). ThreatLens combines 6 scanners with LLM reasoning to cut noise down to 3.2%, and uses RAG to link technical vulnerabilities directly to legal standards."*

### Q2: "How do you prevent the LLM from hallucinating vulnerabilities or legal laws?"
> **Examiner Intent:** Testing your understanding of LLM reliability and hallucinations.  
> **Your Defense:**  
> *"We use a **two-tier deterministic grounding architecture**:  
> 1. **Deterministic Discovery First:** Initial detection is performed by deterministic tools (Semgrep AST rules, Trufflehog entropy, pip-audit CVE databases). The LLM never invents vulnerabilities out of nowhere; it only validates existing execution paths.  
> 2. **RAG Vector Grounding:** For compliance mapping, the LLM is strictly constrained to retrieved vectors from our verified Qdrant regulatory database with similarity threshold filtering. The LLM must output the exact legal clause ID present in the retrieved vector context."*

### Q3: "What is your confidence-weighted aggregator and how does it calculate severity?"
> **Examiner Intent:** Probing your backend algorithm for merging multi-scanner findings.  
> **Your Defense:**  
> *"Each scanner has an empirical domain confidence weight: Trufflehog has 0.95 for verified API keys; Semgrep has 0.85 for syntactic patterns; the LLM Reviewer assesses reachable taint paths (0.90). When multiple tools flag the same sink, the composite confidence score increases asymptotically. If a finding is isolated and marked unreachable by dataflow analysis, its severity is downgraded or filtered out, which is how we achieved our 88.7% noise reduction."*

### Q4: "How do you guarantee multi-tenant security if two competing companies upload code?"
> **Examiner Intent:** Checking your knowledge of real-world enterprise security and data leaks.  
> **Your Defense:**  
> *"Through defense-in-depth:  
> 1. **Sandboxed Ingestion:** Each repository clone or ZIP extraction executes in an ephemeral directory isolated per Celery worker task.  
> 2. **Database Row-Level Security (RLS):** Every PostgreSQL query runs with `SET LOCAL app.current_workspace_id = :id` derived directly from the verified RS256 JWT claims. A tenant cannot physically query or read another workspace's records even in the event of an application-level SQL injection."*

### Q5: "What embeddings and vector search metrics are you using in Qdrant?"
> **Examiner Intent:** Verifying your ML / AI / RAG implementation specifics.  
> **Your Defense:**  
> *"We use `all-MiniLM-L6-v2` from SentenceTransformers, generating 384-dimensional dense vectors. We use Cosine Similarity with HNSW indexing in Qdrant. In our empirical benchmarks across 250 test vectors, this model provided sub-5ms retrieval latency with a Mean Precision@10 of 86.8% across GDPR, SOC 2, ISO 27001, PCI DSS, and NIST CSF."*

### Q6: "What are the limitations of ThreatLens and what is your future scope?"
> **Examiner Intent:** Assessing self-awareness and research maturity.  
> **Your Defense:**  
> *"Currently, ThreatLens specializes in static code analysis, configuration files, and architecture YAML descriptors. Our immediate roadmap includes:  
> 1. Dynamic Application Security Testing (DAST) integration via OWASP ZAP for live endpoint probing.  
> 2. Automated Git Pull Request remediation bots that open verified fix PRs.  
> 3. Expanding compliance frameworks into healthcare (HIPAA) and automotive standards (ISO 21434)."*

---

## 📋 Rehearsal & Presentation Day Checklist

- [ ] **Run with a Stopwatch:** Read the script aloud 2–3 times. Aim for **4:35 to 4:45**.
- [ ] **Have Figures Ready:** Open the figures in `docs/paper_figures/` in full-screen view.
- [ ] **Tabs Setup:**
  - Tab 1: Presentation PDF / Slides.
  - Tab 2: ThreatLens running locally (`localhost:3000` / `localhost:8000`).
  - Tab 3: Generated sample PDF audit report.
- [ ] **Confidence Cues:** Keep your shoulders back, make eye contact across all evaluators, and pause for 1 second after delivering key metrics (**88.7% noise reduction**, **86.8% precision**, **18.4 seconds**).
