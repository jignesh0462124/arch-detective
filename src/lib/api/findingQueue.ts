import { apiClient, ApiError } from "./client";
import { supabase } from "@/lib/supabase";
import type { Finding, Severity } from "./types";
import type { WorkbenchFinding, SnapshotFile } from "./workbench";

export type FindingState = Finding["state"];
export interface QueueFilters {
  severity: Severity | "all";
  state: FindingState | "all";
  q: string;
}
export interface FindingScan {
  id: string;
  workspace_id: string;
  target_name: string;
  status: "completed";
  created_at: string;
  completed_at: string | null;
}
export type FindingSummary = Pick<
  Finding,
  | "id"
  | "scan_id"
  | "title"
  | "severity"
  | "state"
  | "source"
  | "file_path"
  | "line_number"
  | "cwe_id"
  | "cvss_score"
  | "created_at"
>;
export interface QueuePage<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}
export interface FindingCounts {
  total: number;
  severity: Partial<Record<Severity, number>>;
}
export interface DashboardFindings {
  total: number;
  open: number;
  criticalOpen: number;
  items: Pick<FindingSummary, "id" | "title" | "severity" | "file_path" | "line_number">[];
}
export interface QueueDetail {
  finding: WorkbenchFinding;
  file: SnapshotFile | null;
}

const base = (scanId: string) => `/api/v1/scans/${encodeURIComponent(scanId)}/workbench/findings`;
const params = (workspaceId: string, filters?: QueueFilters) =>
  new URLSearchParams({
    workspace_id: workspaceId,
    ...(filters ? { severity: filters.severity, state: filters.state, q: filters.q } : {}),
  });
const get = <T>(path: string, signal?: AbortSignal) =>
  apiClient<T>(path, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
    cache: "no-store",
  });

export const getFindingScans = (workspaceId: string, offset: number, signal?: AbortSignal) =>
  get<QueuePage<FindingScan>>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/finding-scans?offset=${offset}`,
    signal,
  );
export const getFindingCounts = (workspaceId: string, scanId: string, signal?: AbortSignal) =>
  get<FindingCounts>(`${base(scanId)}/counts?${params(workspaceId)}`, signal);
export const getDashboardFindings = (workspaceId: string, scanId: string, signal?: AbortSignal) =>
  get<DashboardFindings>(`${base(scanId)}/dashboard?${params(workspaceId)}`, signal);
export const getFindingPage = (
  workspaceId: string,
  scanId: string,
  filters: QueueFilters,
  offset: number,
  signal?: AbortSignal,
) =>
  get<QueuePage<FindingSummary>>(
    `${base(scanId)}?${params(workspaceId, filters)}&offset=${offset}`,
    signal,
  );
export const getQueueFinding = (
  workspaceId: string,
  scanId: string,
  id: string,
  signal?: AbortSignal,
) => get<QueueDetail>(`${base(scanId)}/${encodeURIComponent(id)}?${params(workspaceId)}`, signal);

export async function exportFindingQueue(
  workspaceId: string,
  scanId: string,
  filters: QueueFilters,
  format: "csv" | "json",
  signal?: AbortSignal,
) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in to export findings.");
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || "http://localhost:8000"}${base(scanId)}/export?${params(workspaceId, filters)}&format=${format}`,
    {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
        : AbortSignal.timeout(60000),
    },
  );
  if (!response.ok) throw new ApiError(response.status, response.statusText);
  const blob = await response.blob();
  signal?.throwIfAborted();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `findings-${scanId}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function findingError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return error.authCheck === "invalid"
        ? "Your session has ended. Sign in again to view findings."
        : "You are signed in, but the server could not verify this request. Retry shortly.";
    if (error.status === 503)
      return "The audit service is temporarily unavailable. Your session and saved findings are unchanged. Retry shortly.";
    if (error.status === 403 || error.status === 404)
      return "This scan or finding is unavailable, or you no longer have access.";
    if (error.status === 409) return "The scan or findings changed. Refresh and try again.";
    if (error.status === 413) return "Narrow your filters to export at most 20,000 findings.";
  }
  return "Findings could not be loaded or saved. Check your connection and try again.";
}
