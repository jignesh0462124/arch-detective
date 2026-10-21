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

export interface DashboardScans {
  latestCompleted: DashboardScan | null;
  completedTotal: number;
  recent: DashboardScan[];
}

const SCAN_FIELDS =
  "id,workspace_id,target_name,scan_type,status,progress,finding_count,selected_frameworks,framework_scores,created_at,completed_at";

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

/** Small, RLS-scoped overview; no full scan or finding-history downloads. */
export async function fetchDashboardScans(
  workspaceId: string,
  signal: AbortSignal,
): Promise<DashboardScans> {
  const [recentResult, completedResult] = await Promise.all([
    supabase
      .from("scans")
      .select(SCAN_FIELDS)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(0, 4)
      .abortSignal(signal),
    supabase
      .from("scans")
      .select(SCAN_FIELDS, { count: "exact" })
      .eq("workspace_id", workspaceId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .abortSignal(signal),
  ]);

  if (recentResult.error) throw recentResult.error;
  if (completedResult.error) throw completedResult.error;
  if (completedResult.count === null) throw new Error("Completed scan count is unavailable.");

  return {
    recent: (recentResult.data ?? []).map(asDashboardScan),
    latestCompleted: completedResult.data?.[0] ? asDashboardScan(completedResult.data[0]) : null,
    completedTotal: completedResult.count,
  };
}
