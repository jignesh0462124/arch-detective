# Workflow 4 — LangChain Agent + Compliance Mapping

> **Covers:** Part 5 (LangChain Agent Chains)  
> **Estimated Time:** 5–7 days  
> **Prerequisites:** Workflow 2 (RAG), Workflow 3 (Scanner findings)  
> **Goal:** Every finding has CVSS score + violated controls across all 5 frameworks  

---

## Workflow Sequence

```mermaid
graph TD
    A[Write compliance prompt templates] --> B[Write compliance_mapper.py chain]
    B --> C[Write cvss_scorer.py chain]
    C --> D[Write remediation_planner.py chain]
    D --> E[Write summary_writer.py chain]
    E --> F[Add retry logic for Groq rate limits]
    F --> G[Integrate into scan_task.py pipeline]
    G --> H[Test: Run compliance mapping on real findings]
    H --> I[Save violations to compliance_violations table]
    I --> J[Calculate framework compliance scores]
    J --> K[Write GET /scan/{id}/findings with compliance data]
    K --> L[Connect frontend findings page]
    L --> M[Build compliance score chart on dashboard]
```

---

## Step-by-Step Implementation

### Step 1: Prompt Templates (Day 1)

Write all prompt templates in `app/agent/prompts/`:

```bash
# Write each prompt file:
# - classifier.py    → Vulnerability classification
# - compliance.py    → Compliance mapping (the core prompt)
# - remediation.py   → Remediation planning
# - summary.py       → Executive summary
```

**Critical prompt: compliance.py**

The compliance prompt must:
1. Accept a finding + retrieved controls as input
2. Map the finding to specific violated controls
3. Output structured JSON matching `ComplianceMappingResult` schema
4. Be precise — only map controls with clear, direct violations
5. Include specific evidence citations

### Step 2: Compliance Mapper Chain (Days 2–3)

```python
# Write app/agent/compliance_mapper.py
# The core pipeline:
#   1. RAG retrieve top-12 controls for the finding
#   2. Format controls into prompt context
#   3. Call Groq Llama 3 70B with structured output
#   4. Parse with PydanticOutputParser
#   5. Return ComplianceMappingResult

# Test:
python -c "
from app.agent.compliance_mapper import map_finding_to_compliance
result = map_finding_to_compliance({
    'title': 'Hardcoded JWT Secret',
    'description': 'JWT signing key is hardcoded as a string literal in auth.py',
    'severity': 'critical',
    'cwe_id': 'CWE-798',
    'file_path': 'auth.py',
    'code_snippet': 'SECRET_KEY = \"super-secret-123\"'
})
print(f'Found {len(result.violations)} violations')
print(f'CVSS: {result.cvss_score}')
for v in result.violations:
    print(f'  {v.framework} {v.control_id}: {v.violation_description}')
"
```

**Expected output for hardcoded secret:**
- GDPR Art.32 — Failure to implement encryption/pseudonymization
- GDPR Art.25 — No data protection by design
- SOC 2 CC6.1 — No logical access control
- ISO 27001 A.8.5 — Insecure authentication
- PCI DSS Req.8.3.2 — No strong cryptography for auth
- NIST CSF PR.AA-02 — Identity not properly bound to credentials

### Step 3: CVSS Scorer (Day 3)

```python
# Write app/agent/cvss_scorer.py
# Test:
# A hardcoded password should score 8.0-9.8 (Network/Low/None/None)
# A low-severity info disclosure should score 3.0-5.0
```

### Step 4: Remediation Planner (Day 4)

```python
# Write app/agent/remediation_planner.py
# Test output should include:
# - Specific code changes
# - Configuration updates
# - Tool recommendations
# - Priority classification
```

### Step 5: Executive Summary Writer (Day 4)

```python
# Write app/agent/summary_writer.py
# Input: all scan findings + violations
# Output: 2-3 paragraph C-level summary
```

### Step 6: Pipeline Integration (Days 5–6)

```python
# Update app/tasks/scan_task.py:
# After scanner deduplication (progress 75%):
for finding in all_findings:
    mapping = map_finding_to_compliance(finding)
    save_compliance_violations(db, finding, mapping)
    # Progress: 75% → 95%
```

### Step 7: Frontend Integration (Day 7)

```typescript
// Update findings page to show:
// 1. Compliance violation badges per finding
// 2. CVSS score gauge
// 3. Remediation steps accordion
// 4. Framework filter dropdown

// Update dashboard to show:
// 1. Compliance score bar chart per framework
// 2. Overall compliance percentage
```

---

## Verification Criteria

| Check | Expected Result |
|-------|----------------|
| Hardcoded password → mapper | 5+ framework violations returned |
| SQL injection → mapper | PCI Req.6.2.4 and OWASP A03 violations |
| CVSS scorer | Valid 0.0-10.0 scores with vector strings |
| Remediation planner | Ordered, actionable steps with priorities |
| Executive summary | Coherent 2-3 paragraph summary |
| DB violations table | Populated after scan completes |
| Retry logic | Handles Groq 429 without crashing |
| Frontend findings | Shows violations grouped by framework |
| Dashboard chart | Renders compliance scores per framework |

---

## Failure Recovery

| Issue | Fix |
|-------|-----|
| Groq API key invalid | Check `GROQ_API_KEY` in `.env`, get new key at console.groq.com |
| Pydantic parse fails | Add fallback: if parse fails, retry with explicit JSON instruction |
| Token limit exceeded | Truncate retrieved controls text to fit 8192 token context |
| Slow mapping (>2min per finding) | Reduce `top_k` from 12 to 8, batch findings |
| Incorrect violations | Improve prompt specificity, add few-shot examples |
