import { apiClient, ApiError } from "./client";
import { authScope, isCurrentScope, authRequestSignal } from "@/lib/authState";
import { supabase } from "@/lib/supabase";
import type { Finding, Scan } from "./types";
import type { LocalScanResult } from "./localScan";
import { countSeverities, riskPosture } from "./scanSummary";

export interface WorkbenchCapabilities {
  enabled: boolean;
  progressive_workbench?: boolean;
  reason: string | null;
  retention_hours: number;
  max_zip_bytes: number;
}
export interface Snapshot {
  id: string;
  scan_id: string;
  revision: number;
  state: "indexing" | "ready" | "failed" | "expired";
  file_count: number;
  expires_at: string;
  exclusions: { reason: string }[];
}
export interface SnapshotFile {
  id: string;
  path: string;
  language: string;
  byte_size: number;
  line_count: number;
  preview_state: string;
  redacted: boolean;
  reason?: string;
}
export interface WorkbenchFinding extends Finding {
  violations?: Array<{
    framework: string;
    control_id: string;
    control_title: string;
    evidence?: string;
    violation_description?: string;
    rag_chunk_ids?: string[];
    description?: string;
  }>;
  location?: {
    file_id: string | null;
    line_number: number | null;
    match_status: "verified" | "unlocated";
  };
}
export interface AuditEvent {
  sequence: number;
  step: string;
  label: string;
  progress: number;
  at: string;
}
export interface WorkbenchOverview {
  scan: Scan;
  snapshot: Snapshot | null;
  findings: WorkbenchFinding[];
  metadata: Partial<LocalScanResult>;
  events: AuditEvent[];
  job_status?: string;
  counts?: WorkbenchCounts;
}
export interface WorkbenchCounts {
  total: number;
  severity: Record<string, number>;
  files: Record<string, number>;
  previews: { ready: number; pending: number; total: number };
}
export interface WorkbenchPage<T> {
  items: T[];
  total: number;
  offset?: number;
  limit?: number;
}
export interface WorkbenchBootstrap extends WorkbenchOverview {
  files: WorkbenchPage<SnapshotFile>;
  finding_page: WorkbenchPage<WorkbenchFinding>;
  initial_source: SourceWindow | null;
  initial_file?: SnapshotFile | null;
  bootstrap_seconds: number;
}
export interface WorkbenchProgress {
  scan_id: string;
  status: "running" | "completed" | "failed";
  progress: number;
  error_message: string | null;
  created_at: string;
  events: AuditEvent[];
}
export interface SourceWindow {
  id: string;
  revision: number;
  start_line: number;
  end_line: number;
  total_lines: number;
  language: string;
  redacted: boolean;
  content: string;
}

export function workbenchError(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.body &&
    typeof error.body === "object" &&
    "detail" in error.body &&
    typeof error.body.detail === "string"
  )
    return error.body.detail;
  return error instanceof Error ? error.message : "The audit could not be loaded. Try again.";
}

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = 30000) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return apiClient<T>(path, {
    ...options,
    cache: "no-store",
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  });
}
export const getWorkbenchCapabilities = (signal?: AbortSignal) =>
  request<WorkbenchCapabilities>("/api/v1/audit-workbench/capabilities", { signal }, 5000);
export const getWorkbench = (workspaceId: string, scanId: string, signal?: AbortSignal) =>
  request<WorkbenchOverview>(
    `/api/v1/scans/${encodeURIComponent(scanId)}/workbench?workspace_id=${encodeURIComponent(workspaceId)}`,
    { signal },
  );
export const getWorkbenchProgress = (scanId: string, signal?: AbortSignal) =>
  request<WorkbenchProgress>(`/api/v1/scans/${encodeURIComponent(scanId)}/workbench/progress`, {
    signal,
  });
const workbenchPath = (id: string) => `/api/v1/scans/${encodeURIComponent(id)}/workbench`;
export const getWorkbenchBootstrap = async (
  workspace: string,
  id: string,
  signal?: AbortSignal,
) => {
  const started = performance.now();
  const result = await request<WorkbenchBootstrap>(
    `${workbenchPath(id)}/bootstrap?workspace_id=${encodeURIComponent(workspace)}`,
    { signal },
  );
  performance.measure("archon.workbench.bootstrap", { start: started, end: performance.now() });
  return result;
};
export const getWorkbenchStatus = (workspace: string, id: string, signal?: AbortSignal) =>
  request<Omit<WorkbenchOverview, "findings">>(
    `${workbenchPath(id)}/status?workspace_id=${encodeURIComponent(workspace)}`,
    { signal },
  );
export const getWorkbenchFindings = (
  id: string,
  severity: string,
  q: string,
  offset: number,
  signal?: AbortSignal,
) =>
  request<WorkbenchPage<WorkbenchFinding>>(
    `${workbenchPath(id)}/findings?${new URLSearchParams({ severity, q, offset: String(offset) })}`,
    { signal },
  );
export const getWorkbenchFinding = (
  id: string,
  finding: string,
  signal?: AbortSignal,
  workspaceId?: string,
) =>
  request<{ finding: WorkbenchFinding; file: SnapshotFile | null }>(
    `${workbenchPath(id)}/findings/${encodeURIComponent(finding)}${workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ""}`,
    { signal },
  );
export const getSnapshotFilePage = (id: string, q: string, offset: number, signal?: AbortSignal) =>
  request<WorkbenchPage<SnapshotFile>>(
    `/api/v1/scans/${encodeURIComponent(id)}/source/files?${new URLSearchParams({ q, offset: String(offset), limit: "200" })}`,
    { signal },
  );

export async function startWorkbenchAudit(
  file: File,
  name: string,
  frameworks: string[],
  workspaceId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  const body = new FormData();
  body.set("file", file);
  body.set("target_name", name);
  body.set("frameworks", frameworks.join(","));
  const result = await request<{ scan_id: string; status: string }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/audits`,
    { method: "POST", body, signal, headers: { "Idempotency-Key": idempotencyKey } },
  );
  performance.clearMarks("archon.audit.accepted");
  performance.mark("archon.audit.accepted", { detail: { scanId: result.scan_id } });
  return result;
}

export async function getSnapshotFiles(scanId: string, signal?: AbortSignal) {
  const items: SnapshotFile[] = [];
  for (let offset = 0; offset < 10000; offset += 200) {
    const page = await request<{ items: SnapshotFile[]; total: number }>(
      `/api/v1/scans/${encodeURIComponent(scanId)}/source/files?offset=${offset}&limit=200`,
      { signal },
    );
    items.push(...page.items);
    if (items.length >= page.total) return items;
  }
  throw new Error("This source tree exceeds the viewer file limit.");
}
export const getSourceWindow = (
  scanId: string,
  fileId: string,
  start: number,
  signal?: AbortSignal,
) =>
  request<SourceWindow>(
    `/api/v1/scans/${encodeURIComponent(scanId)}/source/files/${encodeURIComponent(fileId)}?start=${start}&lines=1000`,
    { signal },
  );

export async function exportWorkbenchReport(scanId: string, name: string) {
  const scope = authScope();
  const signal = authRequestSignal();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in to export this audit.");
  if (!isCurrentScope(scope)) throw new DOMException("Account changed", "AbortError");
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/v1/scans/${encodeURIComponent(scanId)}/workbench/report`,
    {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
    },
  );
  if (!response.ok) throw new Error("The audit report could not be exported. Try again.");
  const blob = await response.blob();
  signal.throwIfAborted();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `archon-audit-${name.replace(/[^a-z0-9-]/gi, "-")}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function asLegacyAudit(data: WorkbenchOverview): LocalScanResult {
  const counts = countSeverities(data.findings);
  return {
    scan_id: data.scan.id,
    target_name: data.scan.target_name,
    frameworks: data.scan.selected_frameworks,
    framework_scores: data.scan.framework_scores,
    severity_counts: counts,
    generated_at: data.scan.completed_at || data.scan.created_at,
    summary: data.metadata.summary || {
      summary: "Recorded audit findings",
      risk_headline: "Review required",
      overall_posture: riskPosture(counts),
      top_priorities: [],
    },
    findings: data.findings.map((f) => ({
      ...f,
      file_path: f.file_path ?? undefined,
      cvss_score: f.cvss_score ?? undefined,
      cvss_vector: f.cvss_vector ?? undefined,
      remediation_steps: (f.remediation || "").split("\n"),
    })),
  };
}
