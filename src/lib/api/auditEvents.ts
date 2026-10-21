import { supabase } from "../supabase";

export interface AuditEvent {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  event_metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditEventListResponse {
  items: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditEventFilters {
  workspace_id: string;
  category?: "all" | "scans" | "findings" | "workspace" | "reports" | "auth";
  since?: string;
  search?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export async function fetchAuditEvents(
  filters: AuditEventFilters,
): Promise<AuditEventListResponse> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 1000);
  const offset = Math.max(filters.offset ?? 0, 0);
  let query = supabase
    .from("audit_events")
    .select(
      "id,workspace_id,actor_user_id,event_type,resource_type,resource_id,event_metadata,created_at",
      { count: "exact" },
    )
    .eq("workspace_id", filters.workspace_id);
  const prefix: Record<Exclude<NonNullable<AuditEventFilters["category"]>, "all">, string> = {
    scans: "scan.",
    findings: "finding.",
    workspace: "workspace.",
    reports: "report.",
    auth: "auth.",
  };
  if (filters.category && filters.category !== "all")
    query = query.like("event_type", `${prefix[filters.category]}%`);
  if (filters.since) query = query.gte("created_at", filters.since);
  // PostgREST `or` has a grammar of its own; keep user text out of operators.
  const search = filters.search
    ?.trim()
    .slice(0, 80)
    .replace(/[%,().\\]/g, " ")
    .trim();
  if (search) {
    query = query.or(
      `event_type.ilike.%${search}%,resource_type.ilike.%${search}%,event_metadata->>target.ilike.%${search}%`,
    );
  }
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1)
    .abortSignal(filters.signal ?? new AbortController().signal);
  if (error) throw error;
  return {
    items: (data ?? []) as AuditEvent[],
    total: count ?? 0,
    limit,
    offset,
  };
}

export interface ScanHistoryItem {
  id: string;
  target_name: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  finding_count: number | null;
}

export async function fetchScanHistory(
  workspaceId: string,
  offset = 0,
  limit = 25,
  signal?: AbortSignal,
) {
  const { data, count, error } = await supabase
    .from("scans")
    .select("id,target_name,status,created_at,completed_at,finding_count", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1)
    .abortSignal(signal ?? new AbortController().signal);
  if (error) throw error;
  return { items: (data ?? []) as ScanHistoryItem[], total: count ?? 0 };
}
