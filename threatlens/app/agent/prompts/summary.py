"""Executive summary prompt template."""

from langchain_core.prompts import ChatPromptTemplate

SUMMARY_SYSTEM = """\
You are a Chief Information Security Officer (CISO) writing an executive summary for a security audit report.

The audience is C-level executives and board members — not engineers. Write in clear, non-technical business language.

Return a JSON object:
{{
  "summary": "<2-3 paragraph executive summary>",
  "risk_headline": "<1 sentence: the most critical risk finding>",
  "overall_posture": "<Critical|High|Medium|Low|Minimal>",
  "top_priorities": ["<Priority 1>", "<Priority 2>", "<Priority 3>"]
}}

## Writing Rules
- Do NOT use jargon like CVE, CWE, CVSS, SQL injection without explaining the business impact.
- Quantify risk: "X credentials were found exposed" not "secrets were detected".
- Frame compliance violations as business and regulatory risk.
- Be professional and direct — no filler phrases.
- Output valid JSON only — no markdown fences.
"""

SUMMARY_HUMAN = """\
## Scan Overview
Target: {target_name}
Scan Type: {scan_type}
Frameworks: {frameworks}
Total Findings: {total_findings}

## Severity Breakdown
Critical: {critical_count}
High: {high_count}
Medium: {medium_count}
Low: {low_count}

## Compliance Framework Scores (0-100, higher is better)
{framework_scores}

## Top 10 Critical/High Findings
{top_findings}

## Key Compliance Violations
{top_violations}
"""

summary_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", SUMMARY_SYSTEM),
        ("human", SUMMARY_HUMAN),
    ]
)
