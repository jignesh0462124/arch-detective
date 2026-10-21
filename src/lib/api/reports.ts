import { accountStorage, authScope, isCurrentScope, authRequestSignal } from "@/lib/authState";
import { apiClient, ApiError } from "./client";
import { supabase } from "@/lib/supabase";
import type { Report } from "./types";
import type { LocalScanResult } from "./localScan";
import type { FindingCounts } from "./findingQueue";

export interface ReportEntry {
  id: string;
  workspace_id: string;
  target_name: string;
  status: "completed";
  created_at: string;
  completed_at: string | null;
  selected_frameworks: string[];
  framework_scores: Record<string, number>;
  counts: FindingCounts;
}
export interface ReportPreview extends ReportEntry {
  frameworks: string[];
  summary: {
    summary?: string;
    risk_headline?: string;
    overall_posture?: string;
    top_priorities?: string[];
  };
  analysis: Record<string, unknown>;
  coverage: Record<string, unknown>;
  exclusions: unknown[];
}
export interface ReportFilters {
  q: string;
  framework: string;
}
export interface ReportPage {
  items: ReportEntry[];
  total: number;
  available_total: number;
  next_cursor: string | null;
  limit: number;
}
const path = (workspace: string) =>
  `/api/v1/workspaces/${encodeURIComponent(workspace)}/report-library`;
const request = <T>(url: string, signal?: AbortSignal) =>
  apiClient<T>(url, {
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
export const getReportLibrary = (
  workspace: string,
  filters: ReportFilters,
  cursor: string | null,
  signal?: AbortSignal,
) =>
  request<ReportPage>(
    `${path(workspace)}?${new URLSearchParams({ ...filters, ...(cursor ? { cursor } : {}) })}`,
    signal,
  );
export const getReportPreview = (
  workspace: string,
  reference: string,
  signal?: AbortSignal,
  frameworks?: string[],
) =>
  request<ReportPreview>(
    `${path(workspace)}/${encodeURIComponent(reference)}${frameworks ? `?${new URLSearchParams({ frameworks: frameworks.join(",") })}` : ""}`,
    signal,
  );

export async function fetchReportPdf(
  workspace: string,
  scanId: string,
  signal: AbortSignal,
  frameworks?: string[],
): Promise<Blob> {
  const scope = authScope();
  const sessionSignal = authRequestSignal();
  signal.throwIfAborted();
  const { data, error } = await supabase.auth.getSession();
  if (!isCurrentScope(scope)) throw new DOMException("Account changed", "AbortError");
  if (error || !data.session) throw new ApiError(401, "Sign in to download reports");
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/v1/scans/${encodeURIComponent(scanId)}/workbench/report?${new URLSearchParams({ workspace_id: workspace, ...(frameworks ? { frameworks: frameworks.join(",") } : {}) })}`,
    {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: "no-store",
      signal: AbortSignal.any([signal, sessionSignal, AbortSignal.timeout(90000)]),
    },
  );
  if (!response.ok) throw new ApiError(response.status, response.statusText);
  if (!response.headers.get("content-type")?.includes("application/pdf"))
    throw new Error("The server did not return a PDF. Retry the download.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The PDF response was empty.");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 50 * 1024 * 1024) throw new Error("The PDF exceeds the 50 MiB download limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  signal.throwIfAborted();
  sessionSignal.throwIfAborted();
  const blob = new Blob(chunks, { type: "application/pdf" });
  if ((await blob.slice(0, 5).text()) !== "%PDF-")
    throw new Error("The PDF response is invalid. Retry the download.");
  return blob;
}
export function triggerReportDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function reportError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return error.authCheck === "invalid"
      ? "Your session has ended. Sign in again."
      : "The server could not verify this request. Refresh and retry.";
    if (error.status === 403 || error.status === 404)
      return "This report is unavailable, or you no longer have access.";
    if (error.status === 409) return "Audit results are not ready or changed. Refresh and retry.";
    if (error.status === 503)
      return "Report preparation is busy or unavailable. Wait a moment and retry.";
  }
  return error instanceof Error ? error.message : "Reports could not be loaded. Retry shortly.";
}

// Explicit legacy compatibility. Saved-report requests never consult this store.
export interface EnhancedReport extends Report {
  target_name?: string;
  frameworks?: string[];
  findings_count?: number;
  critical_count?: number;
  health_score?: number;
  framework_scores?: Record<string, number>;
  download_count?: number;
  downloaded_at?: string | null;
  result?: LocalScanResult | null;
}
export const getReportsStorageKey = (workspace?: string) =>
  `threatlens_reports_registry_v1_${workspace || "global"}`;
export function loadStoredReports(workspace?: string): EnhancedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const data: unknown = JSON.parse(
      accountStorage.getItem(getReportsStorageKey(workspace)) || "[]",
    );
    return Array.isArray(data)
      ? data
          .filter(
            (item): item is EnhancedReport =>
              !!item &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              typeof item.scan_id === "string",
          )
          .map((item) => ({
            ...item,
            target_name: typeof item.target_name === "string" ? item.target_name : "Local audit",
          }))
      : [];
  } catch {
    return [];
  }
}
export function saveStoredReport(report: EnhancedReport, workspace?: string) {
  if (typeof window === "undefined") return;
  try {
    accountStorage.setItem(
      getReportsStorageKey(workspace),
      JSON.stringify(
        [
          report,
          ...loadStoredReports(workspace).filter(
            (r) => r.id !== report.id && r.scan_id !== report.scan_id,
          ),
        ].slice(0, 50),
      ),
    );
  } catch {
    /* legacy storage may be full */
  }
}
export function recordReportDownload(
  id: string,
  extra: Partial<EnhancedReport> = {},
  workspace?: string,
): void {
  // A download is not a new saved report.
  const found = loadStoredReports(workspace).find((r) => r.id === id || r.scan_id === id);
  if (found)
    saveStoredReport(
      {
        ...found,
        ...extra,
        downloaded_at: new Date().toISOString(),
        download_count: (found.download_count || 0) + 1,
      },
      workspace,
    );
}
export function loadLegacyReports(workspace: string) {
  // UUIDs belong to persisted scans: deleted/denied scans cannot become local reports.
  return loadStoredReports(workspace).filter(
    (r) => r.scan_id?.startsWith("scan_") && Array.isArray(r.result?.findings),
  );
}
