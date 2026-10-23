import { supabase } from "@/lib/supabase";
import { authRequestSignal, authScope, isCurrentScope } from "@/lib/authState";

export const AUDIT_HISTORY_PAGE_SIZE = 20;
export type AuditHistoryStatus = "all" | "pending" | "running" | "completed" | "failed";
export type AuditHistoryItem = {
  id: string;
  target_name: string;
  status: Exclude<AuditHistoryStatus, "all">;
  created_at: string;
  completed_at: string | null;
};
export type AuditHistoryPage = { items: AuditHistoryItem[]; total: number; offset: number };
export class AuditHistoryAccessError extends Error {}

/** Read metadata only. RLS remains authoritative; no source or finding downloads. */
export async function getAuditHistoryPage(
  workspaceId: string,
  filters: { q: string; status: AuditHistoryStatus; offset: number },
  signal: AbortSignal,
): Promise<AuditHistoryPage> {
  const scope = authScope();
  const requestSignal = AbortSignal.any([signal, authRequestSignal()]);
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .abortSignal(requestSignal)
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!workspace)
    throw new AuditHistoryAccessError(
      "This workspace is unavailable or you no longer have access.",
    );
  const offset = Number.isFinite(filters.offset) ? Math.max(0, Math.floor(filters.offset)) : 0;
  let request = supabase
    .from("scans")
    .select("id,target_name,status,created_at,completed_at", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .eq("scan_type", "codebase");
  if (filters.status !== "all") request = request.eq("status", filters.status);
  const q = filters.q.trim().slice(0, 200);
  if (q) request = request.ilike("target_name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, count, error } = await request
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + AUDIT_HISTORY_PAGE_SIZE - 1)
    .abortSignal(requestSignal);
  if (!isCurrentScope(scope)) throw new DOMException("Account changed", "AbortError");
  if (error) throw error;
  if (count === null) throw new Error("Audit history count is unavailable.");
  return { items: (data ?? []) as AuditHistoryItem[], total: count, offset };
}
