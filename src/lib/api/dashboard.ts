import { supabase } from "@/lib/supabase";
import type { ScanStatus, ScanType } from "./types";

export interface DashboardScan {
  id: string;
  workspace_id: string;
  target_name: string;
  scan_type: ScanType;
  status: ScanStatus;
  progress: number;
  finding_count: number;
  selected_frameworks: string[];
  framework_scores: Record<string, number>;
  created_at: string;
  completed_at: string | null;
}

export interface DashboardLatestAudit {
  latestCompleted: DashboardScan | null;
  completedTotal: number;
}

const SCAN_FIELDS =
  "id,workspace_id,target_name,scan_type,status,progress,finding_count,selected_frameworks,framework_scores,created_at,completed_at";
const RECENT_FIELDS = "id,workspace_id,target_name,scan_type,status,finding_count,created_at";
const readSignal = (signal: AbortSignal) => AbortSignal.any([signal, AbortSignal.timeout(15_000)]);

function asDashboardScan(row: Record<string, unknown>): DashboardScan {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    target_name: String(row.target_name || "Untitled audit"),
    scan_type: (row.scan_type || "codebase") as ScanType,
    status: row.status as ScanStatus,
    progress: typeof row.progress === "number" ? row.progress : 0,
    finding_count: typeof row.finding_count === "number" ? row.finding_count : 0,
    selected_frameworks: Array.isArray(row.selected_frameworks)
      ? row.selected_frameworks.filter((value): value is string => typeof value === "string")
      : [],
    framework_scores:
      row.framework_scores &&
      typeof row.framework_scores === "object" &&
      !Array.isArray(row.framework_scores)
        ? (row.framework_scores as Record<string, number>)
        : {},
    created_at: String(row.created_at || ""),
    completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
  };
}

/** RLS-scoped overview; independent of the recent-activity feed. */
export async function fetchDashboardLatestAudit(
  workspaceId: string,
  signal: AbortSignal,
): Promise<DashboardLatestAudit> {
  const completedResult = await supabase
    .from("scans")
    .select(SCAN_FIELDS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .abortSignal(readSignal(signal));

  if (completedResult.error) throw completedResult.error;
  if (completedResult.count === null) throw new Error("Completed scan count is unavailable.");

  return {
    latestCompleted: completedResult.data?.[0] ? asDashboardScan(completedResult.data[0]) : null,
    completedTotal: completedResult.count,
  };
}

export async function fetchDashboardRecentScans(workspaceId: string, signal: AbortSignal) {
  const result = await supabase
    .from("scans")
    .select(RECENT_FIELDS)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(5)
    .abortSignal(readSignal(signal));
  if (result.error) throw result.error;
  return (result.data ?? []).map(asDashboardScan);
}
