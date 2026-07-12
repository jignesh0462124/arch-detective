export type ScanStatus = "pending" | "running" | "completed" | "failed";
export type ScanType = "codebase" | "architecture" | "logs" | "full";
export type Severity = "critical" | "high" | "medium" | "low";
export type RemediationPriority = "immediate" | "short-term" | "long-term";
export type FindingSource =
  | "semgrep"
  | "bandit"
  | "trufflehog"
  | "pip-audit"
  | "npm-audit"
  | "log-anomaly"
  | "llm-review"
  | "architecture";

export interface HealthResponse {
  status: "healthy";
  service: "threatlens";
}

export interface Scan {
  id: string;
  user_id: string;
  scan_type: ScanType;
  target_name: string;
  status: ScanStatus;
  progress: number;
  finding_count: number;
  framework_scores: Record<string, number>;
  created_at: string;
  completed_at: string | null;
}

export interface ScanStatusResponse {
  scan_id: string;
  status: ScanStatus;
  progress: number;
  finding_count: number;
  current_phase: string;
}

export interface Finding {
  id: string;
  scan_id: string;
  title: string;
  description: string;
  severity: Severity;
  cvss_score: number | null;
  cvss_vector: string | null;
  cwe_id: string | null;
  cve_id: string | null;
  file_path: string | null;
  line_number: number | null;
  code_snippet: string | null;
  source: FindingSource;
  remediation: string | null;
  created_at: string;
}

export interface FindingDetail extends Finding {
  violations: ComplianceViolation[];
  remediation_steps: string[];
  remediation_priority: RemediationPriority | null;
}

export interface ComplianceViolation {
  id: string;
  finding_id: string;
  framework: string;
  control_id: string;
  control_title: string;
  violation_description: string;
  evidence: string;
  rag_chunk_ids: string[];
}

export interface Framework {
  id: string;
  label: string;
  version: string;
  controls: number;
  color?: string;
}

export interface Report {
  id: string;
  scan_id: string;
  pdf_url: string;
  signed_url: string | null;
  generated_at: string;
  expires_at: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
}
