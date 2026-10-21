"""
ThreatLens AI Agent package.

Public API:
  - compliance_mapper.map_finding_to_compliance(finding, frameworks) -> ComplianceMappingResult
  - compliance_mapper.persist_violations(db_session, finding_id, result)
  - cvss_scorer.score_finding(finding_dict) -> (score, vector)
  - remediation_planner.plan_remediation(finding_dict, violations) -> (steps, priority)
  - summary_writer.generate_executive_summary(scan_data) -> dict
"""
