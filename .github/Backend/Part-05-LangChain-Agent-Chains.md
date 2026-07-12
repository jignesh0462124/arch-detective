# Part 5 — LangChain Agent Chains (Compliance Mapping)

> **Timeline:** Week 8  
> **Priority:** 🔴 Critical (core intelligence layer)  
> **Dependencies:** Part 2 (RAG retriever), Part 4 (Scanner findings)  

---

## 5.1 Objective

Build the LangChain agent chain system: compliance mapper (RAG → LLM → structured output), CVSS auto-scorer, remediation planner, and executive summary writer. Every finding gets mapped to specific violated controls across all 5 frameworks with evidence.

---

## 5.2 Files to Create

| File | Purpose |
|------|---------|
| `threatlens/app/agent/__init__.py` | Module init |
| `threatlens/app/agent/compliance_mapper.py` | Main chain: RAG retrieval → LLM mapping → Pydantic output |
| `threatlens/app/agent/cvss_scorer.py` | CVSS 3.1 auto-scoring chain |
| `threatlens/app/agent/remediation_planner.py` | Remediation step generator |
| `threatlens/app/agent/summary_writer.py` | Executive summary LLM writer |
| `threatlens/app/agent/prompts/__init__.py` | Prompt exports |
| `threatlens/app/agent/prompts/classifier.py` | Vulnerability classification prompt |
| `threatlens/app/agent/prompts/compliance.py` | Compliance mapping prompt template |
| `threatlens/app/agent/prompts/remediation.py` | Remediation planning prompt |
| `threatlens/app/agent/prompts/summary.py` | Executive summary prompt |

---

## 5.3 Implementation Details

### 5.3.1 Compliance Mapper Chain (`app/agent/compliance_mapper.py`)

This is the **core intelligence** of ThreatLens. For each finding:

1. **RAG Retrieval:** Embed finding → cosine search Qdrant → get top-12 relevant compliance clauses
2. **LLM Mapping:** Pack finding + retrieved clauses into prompt → Groq Llama 3 70B → structured output
3. **Pydantic Parsing:** Parse LLM response into `ComplianceMappingResult`

**Output schema:**
```python
class FrameworkViolation(BaseModel):
    framework: str            # GDPR | SOC2 | ISO27001 | PCI_DSS | NIST_CSF
    control_id: str           # e.g. "Art.32", "CC6.1", "A.8.5"
    control_title: str        # Human-readable control name
    violation_description: str # Why this finding violates this control
    evidence: str             # Specific evidence from the finding

class ComplianceMappingResult(BaseModel):
    violations: list[FrameworkViolation]
    cvss_score: float         # 0.0–10.0
    cvss_vector: str          # CVSS vector string
    remediation_steps: list[str]
    remediation_priority: str # immediate | short-term | long-term
```

### 5.3.2 CVSS Scorer (`app/agent/cvss_scorer.py`)

Dedicated chain for CVSS 3.1 base score calculation:

```python
CVSS_PROMPT = """Given this vulnerability, calculate the CVSS 3.1 base score.
Evaluate each metric:
- Attack Vector (AV): Network/Adjacent/Local/Physical
- Attack Complexity (AC): Low/High  
- Privileges Required (PR): None/Low/High
- User Interaction (UI): None/Required
- Scope (S): Unchanged/Changed
- Confidentiality Impact (C): None/Low/High
- Integrity Impact (I): None/Low/High
- Availability Impact (A): None/Low/High

Return the score (0.0-10.0) and vector string."""
```

### 5.3.3 Remediation Planner (`app/agent/remediation_planner.py`)

Generates ordered, actionable remediation steps:

```python
REMEDIATION_PROMPT = """Given this vulnerability and its compliance violations,
provide specific, ordered remediation steps.

Categorize priority:
- immediate: Fix within 24 hours (critical, actively exploitable)
- short-term: Fix within 1 week (high severity, compliance-blocking)
- long-term: Fix within 1 month (medium/low, best practice)

Include specific code changes, configuration updates, and tooling recommendations."""
```

### 5.3.4 Executive Summary Writer (`app/agent/summary_writer.py`)

Generates a C-level executive summary for the entire scan:

```python
def generate_executive_summary(scan_data: dict) -> str:
    """
    Input: all findings + compliance violations + framework scores
    Output: 2-3 paragraph executive summary
    """
```

### 5.3.5 Retry Logic for Groq Rate Limits

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=60),
)
def invoke_groq_with_retry(chain, inputs):
    return chain.invoke(inputs)
```

---

## 5.4 Frontend Connection Points

| Backend | Frontend |
|---------|----------|
| `ComplianceMappingResult` per finding | Findings detail view — compliance tab |
| `violations[]` per finding | Framework violation badges on finding cards |
| `cvss_score` + `cvss_vector` | CVSS score display (0-10 gauge) |
| `remediation_steps[]` | Remediation steps accordion in finding detail |
| `remediation_priority` | Priority badge (immediate=red, short-term=orange, long-term=green) |
| Executive summary | Reports page — summary section |
| Framework compliance scores | Dashboard — compliance score bar chart |

### Frontend Types

```typescript
// src/lib/api/types.ts
export interface ComplianceViolation {
  framework: string;
  control_id: string;
  control_title: string;
  violation_description: string;
  evidence: string;
}

export interface FindingDetail extends Finding {
  violations: ComplianceViolation[];
  cvss_score: number;
  cvss_vector: string;
  remediation_steps: string[];
  remediation_priority: "immediate" | "short-term" | "long-term";
}
```

### Compliance Score Calculation

```typescript
// Per framework, calculate compliance score
// Score = 100 - (weighted_violations / total_controls * 100)
export function calculateFrameworkScore(
  framework: string,
  violations: ComplianceViolation[],
  totalControls: number
): number {
  const fwViolations = violations.filter(v => v.framework === framework);
  return Math.max(0, 100 - (fwViolations.length / totalControls * 100));
}
```

---

## 5.5 Verification Checklist

- [ ] Compliance mapper returns violations for a hardcoded password finding
- [ ] Mapping includes GDPR Art.32, ISO A.8.5, PCI Req.8.3.2 for credential findings
- [ ] CVSS scorer returns valid 0.0–10.0 scores with correct vector strings
- [ ] Remediation planner returns ordered, actionable steps
- [ ] Executive summary is coherent and C-level appropriate
- [ ] Pydantic parser handles LLM output format variations gracefully
- [ ] Retry logic handles Groq 429 rate limit responses
- [ ] Violations are saved to `compliance_violations` table in PostgreSQL
- [ ] Frontend displays violations grouped by framework
- [ ] CVSS gauge renders correctly in finding detail view

---

## 5.6 Security Notes

- **Prompt injection:** Finding descriptions from code scans could contain prompt injection — wrap in clear delimiters
- **Output validation:** Always validate Pydantic parse before saving — discard malformed LLM responses
- **Rate limit handling:** Implement exponential backoff; don't hammer Groq API on retries
- **Token limits:** Llama 3 70B has 8192 token context — ensure prompt + finding + controls fit within limit
- **No PII in prompts:** Strip any user-identifying information before sending to Groq
