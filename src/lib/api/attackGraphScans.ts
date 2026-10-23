import { supabase } from "@/lib/supabase";

export interface AttackGraphScan {
  id: string;
  source_type?: string;
  target_name: string;
  status: "completed";
  finding_count: number | null;
  selected_frameworks: string[];
  created_at: string;
  completed_at: string | null;
}

export interface AttackGraphScanPage {
  items: AttackGraphScan[];
  total: number;
  offset: number;
}

const PAGE_SIZE = 25;

/** Small workspace-scoped selector page; the findings are loaded only for the chosen scan. */
export async function getAttackGraphScanPage(
  workspaceId: string,
  offset: number,
  signal: AbortSignal,
): Promise<AttackGraphScanPage> {
  const { data, count, error } = await supabase
    .from("scans")
    .select(
      "id,target_name,status,source_type,finding_count,selected_frameworks,created_at,completed_at",
      {
        count: "exact",
      },
    )
    .eq("workspace_id", workspaceId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
    .abortSignal(signal);

  if (error) throw error;
  if (count === null) throw new Error("Completed audit count is unavailable.");

  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      source_type: row.source_type,
      target_name: row.target_name,
      status: "completed" as const,
      finding_count: row.finding_count,
      selected_frameworks: row.selected_frameworks ?? [],
      created_at: row.created_at,
      completed_at: row.completed_at,
    })),
    total: count,
    offset,
  };
}
