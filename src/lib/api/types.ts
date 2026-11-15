export type ScanStatus =
  "pending" | "uploading" | "queued" | "running" | "completed" | "failed" | "cancelled";
export type ScanType = "codebase" | "architecture" | "logs" | "full";
export type SourceType = "upload" | "git" | "architecture" | "logs" | "full";
export type Severity = "critical" | "high" | "medium" | "low";
export type WorkspaceRole = "owner" | "admin" | "analyst" | "viewer";
export type ReportStatus = "pending" | "queued" | "generating" | "ready" | "failed";
export type RemediationPriority = "immediate" | "short-term" | "long-term";
export type FindingSource =
  | "static-rule"
  | "semgrep"
  | "bandit"
  | "trufflehog"
  | "pip-audit"
  | "npm-audit"
  | "log-anomaly"
  | "llm-review"
  | "architecture"
  | "code";

export interface HealthResponse {
  status: "healthy" | "degraded" | "offline";
  service: "threatlens";
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMembership {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  role: WorkspaceRole;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  session_id: string | null;
}

export interface CurrentUserResponse {
  user: AuthenticatedUser;
  profile: Profile | null;
  memberships: WorkspaceMembership[];
}

export interface BootstrapResponse {
  profile: Profile;
  memberships: WorkspaceMembership[];
}

export interface Scan {
  source_config?: { review_kind?: string };
  id: string;
  workspace_id: string;
  created_by: string;
  scan_type: ScanType;
  source_type: SourceType;
  target_name: string;
  selected_frameworks: string[];
  status: ScanStatus;
  progress: number;
  finding_count: number;
  framework_scores: Record<string, number>;
  severity_counts?: { critical: number; high: number; medium: number; low: number };
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ScanStatusResponse {
  scan_id: string;
  status: ScanStatus;
  progress: number;
  finding_count: number;
  current_phase: string;
  error_code: string | null;
  error_message: string | null;
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
  fingerprint: string | null;
  state: "open" | "accepted_risk" | "resolved" | "false_positive";
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  violations?: Array<{
    framework: string;
    control_id: string;
    control_title: string;
    description?: string;
    status?: string;
  }>;
}

export interface FindingDetail extends Finding {
  // Legacy mappings can lack database IDs/evidence; do not fabricate those fields.
  violations: (NonNullable<Finding["violations"]>[number] & Partial<ComplianceViolation>)[];
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
  status: ReportStatus;
  bucket: string;
  object_path: string;
  sha256: string | null;
  byte_size: number | null;
  version: number;
  generated_at: string | null;
  error_message: string | null;
}
