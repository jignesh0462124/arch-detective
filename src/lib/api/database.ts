/**
 * database.ts
 * Direct Supabase Database Service Layer for ThreatLens.
 *
 * Provides typed, resilient access directly to Supabase tables:
 * - workspaces
 * - workspace_members
 * - scans
 * - findings
 * - compliance_violations
 * - reports
 * - audit_events
 *
 * Enforces workspace isolation and project-wise scoping.
 */

import { supabase } from "@/lib/supabase";
import { countSeverities } from "./scanSummary";
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceInvite,
  WorkspaceSettings,
  WorkspaceUpdatePayload,
} from "./workspaces";
import type { Scan, Finding, Report, FindingSource } from "./types";
import type { AuditEvent } from "./auditEvents";

/**
 * Mutations must never impersonate a demo owner when a session expires.
 */
async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.status === 401 || error.status === 403)
      throw new Error("Your session has ended. Sign in again to continue.");
    throw new Error(
      "Your account could not be verified right now. Check your connection and retry.",
    );
  }
  if (!data.user) throw new Error("Please sign in to continue.");
  return data.user.id;
}

async function getWorkspaceRoles(userId: string, signal?: AbortSignal) {
  const query = supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId);
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  return new Map((data ?? []).map((m) => [m.workspace_id, m.role as Workspace["role"]]));
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACES
// ═══════════════════════════════════════════════════════════════════════════════

export async function dbFetchWorkspaces(signal?: AbortSignal): Promise<Workspace[]> {
  const userId = await getCurrentUserId();
  signal?.throwIfAborted();
  const readSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
    : AbortSignal.timeout(15_000);
  // Both reads use the signed-in user; the workspace view doesn't depend on the role result.
  const [roles, { data: viewData, error: viewError }] = await Promise.all([
    getWorkspaceRoles(userId, readSignal),
    supabase
      .from("workspaces_with_counts")
      .select("id,name,slug,owner_user_id,member_count,scan_count,settings,created_at")
      .order("created_at", { ascending: false })
      .abortSignal(readSignal),
  ]);
  readSignal.throwIfAborted();

  if (!viewError && viewData) {
    return viewData.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      owner_user_id: row.owner_user_id,
      role: row.owner_user_id === userId ? "owner" : (roles.get(row.id) ?? "viewer"),
      member_count: row.member_count ?? 1,
      scan_count: row.scan_count ?? 0,
      settings: (row.settings as WorkspaceSettings) ?? {
        default_frameworks: ["SOC 2", "ISO 27001", "GDPR"],
        retention_days: 90,
        notify_on_critical: true,
      },
      created_at: row.created_at,
    }));
  }

  // Resilient fallback to direct table query
  const { data, error } = await supabase
    .from("workspaces")
    .select(
      `
      id,
      name,
      slug,
      owner_user_id,
      settings,
      created_at,
      updated_at
    `,
    )
    .order("created_at", { ascending: false })
    .abortSignal(readSignal);
  readSignal.throwIfAborted();

  if (error) {
    console.error("Failed to fetch workspaces from Supabase:", error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    owner_user_id: row.owner_user_id,
    role: row.owner_user_id === userId ? "owner" : (roles.get(row.id) ?? "viewer"),
    member_count: 1,
    scan_count: 0,
    settings: (row.settings as WorkspaceSettings) ?? {
      default_frameworks: ["SOC 2", "ISO 27001", "GDPR"],
      retention_days: 90,
      notify_on_critical: true,
    },
    created_at: row.created_at,
  }));
}

export async function dbFetchWorkspace(workspaceId: string): Promise<Workspace> {
  const userId = await getCurrentUserId();
  const roles = await getWorkspaceRoles(userId);
  // Ultra-fast single-query via PostgreSQL view
  const { data: viewData, error: viewError } = await supabase
    .from("workspaces_with_counts")
    .select("*")
    .eq("id", workspaceId)
    .single();

  if (!viewError && viewData) {
    return {
      id: viewData.id,
      name: viewData.name,
      slug: viewData.slug,
      owner_user_id: viewData.owner_user_id,
      role: viewData.owner_user_id === userId ? "owner" : (roles.get(viewData.id) ?? "viewer"),
      member_count: viewData.member_count ?? 1,
      scan_count: viewData.scan_count ?? 0,
      settings: (viewData.settings as WorkspaceSettings) ?? {
        default_frameworks: ["SOC 2", "ISO 27001", "GDPR"],
        retention_days: 90,
        notify_on_critical: true,
      },
      created_at: viewData.created_at,
    };
  }

  // Resilient fallback
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  if (error || !data) {
    throw new Error(`Workspace not found: ${error?.message || workspaceId}`);
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    owner_user_id: data.owner_user_id,
    role: data.owner_user_id === userId ? "owner" : (roles.get(data.id) ?? "viewer"),
    member_count: 1,
    scan_count: 0,
    settings: (data.settings as WorkspaceSettings) ?? {
      default_frameworks: ["SOC 2", "ISO 27001", "GDPR"],
      retention_days: 90,
      notify_on_critical: true,
    },
    created_at: data.created_at,
  };
}

export async function dbCreateWorkspace(name: string, slug: string): Promise<Workspace> {
  const ownerId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      owner_user_id: ownerId,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create workspace in database: ${error?.message}`);
  }

  // Log audit event
  void dbLogAuditEvent({
    workspace_id: data.id,
    event_type: "workspace.created",
    resource_type: "workspace",
    resource_id: data.id,
    event_metadata: { name: data.name, slug: data.slug },
  });

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    owner_user_id: data.owner_user_id,
    role: "owner",
    member_count: 1,
    scan_count: 0,
    created_at: data.created_at,
  };
}

export async function dbUpdateWorkspace(
  workspaceId: string,
  payload: WorkspaceUpdatePayload | string,
): Promise<Workspace> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof payload === "string") {
    updateData.name = payload.trim();
  } else {
    if (payload.name !== undefined && payload.name.trim()) {
      updateData.name = payload.name.trim();
    }
    if (payload.slug !== undefined && payload.slug.trim()) {
      updateData.slug = payload.slug.trim().toLowerCase();
    }
    if (payload.settings !== undefined) {
      updateData.settings = payload.settings;
    }
  }

  const { data: changed, error } = await supabase
    .from("workspaces")
    .update(updateData)
    .eq("id", workspaceId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update workspace: ${error.message}`);
  }
  if (!changed) throw new Error("Workspace was not updated. Check your access and retry.");

  void dbLogAuditEvent({
    workspace_id: workspaceId,
    event_type: "workspace.updated",
    resource_type: "workspace",
    resource_id: workspaceId,
    event_metadata: updateData,
  });

  return dbFetchWorkspace(workspaceId);
}

export async function dbDeleteWorkspace(workspaceId: string): Promise<void> {
  try {
    await dbLogAuditEvent({
      workspace_id: workspaceId,
      event_type: "workspace.deleted",
      resource_type: "workspace",
      resource_id: workspaceId,
      event_metadata: { deleted_at: new Date().toISOString() },
    });
  } catch {
    // Non-blocking
  }

  const { data: deleted, error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete workspace: ${error.message}`);
  }
  if (!deleted) throw new Error("Workspace was not deleted. Check your access and retry.");
}

export async function dbFetchMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at")
    .eq("workspace_id", workspaceId);

  if (error) {
    throw error;
  }

  const userIds = (members ?? []).map((m) => m.user_id);
  const profileMap = new Map<
    string,
    { display_name: string | null; email: string | null; avatar_url: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .in("id", userIds);

    if (!profileErr && profiles) {
      profiles.forEach((p) => {
        profileMap.set(p.id, {
          display_name: p.display_name,
          email: p.email,
          avatar_url: p.avatar_url,
        });
      });
    }
  }

  return (members ?? []).map((m) => {
    const prof = profileMap.get(m.user_id);
    return {
      user_id: m.user_id,
      role: m.role,
      display_name: prof?.display_name || null,
      email: prof?.email || null,
      avatar_url: prof?.avatar_url || null,
      created_at: m.created_at,
    };
  });
}

export async function dbFetchPendingInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  const { data, error } = await supabase
    .from("workspace_invites")
    .select("id, workspace_id, invited_email, role, expires_at, created_at")
    .eq("workspace_id", workspaceId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((inv) => ({
    id: inv.id,
    workspace_id: inv.workspace_id,
    invited_email: inv.invited_email,
    role: inv.role,
    expires_at: inv.expires_at,
    created_at: inv.created_at,
  }));
}

export async function dbRevokeInvite(inviteId: string, workspaceId?: string): Promise<void> {
  let request = supabase.from("workspace_invites").delete().eq("id", inviteId);
  if (workspaceId) request = request.eq("workspace_id", workspaceId);
  const { data: deleted, error } = await request.select("id").maybeSingle();

  if (error) {
    throw new Error(`Failed to revoke invite: ${error.message}`);
  }
  if (!deleted) throw new Error("Invitation was not revoked. Refresh the list and retry.");
}

export async function dbInviteMember(
  workspaceId: string,
  email: string,
  role: string,
): Promise<WorkspaceInvite> {
  if (!["admin", "analyst", "viewer"].includes(role))
    throw new Error("Choose a supported invitation role.");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const token = crypto.randomUUID();

  const ownerId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      invited_email: email.trim().toLowerCase(),
      role: role.toLowerCase() as "owner" | "admin" | "analyst" | "viewer",
      invited_by: ownerId,
      token,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create invite: ${error?.message}`);
  }

  void dbLogAuditEvent({
    workspace_id: workspaceId,
    event_type: "workspace.member_invited",
    resource_type: "workspace_invite",
    resource_id: data.id,
    event_metadata: { email: data.invited_email, role: data.role },
  });

  return {
    id: data.id,
    workspace_id: data.workspace_id,
    invited_email: data.invited_email,
    role: data.role,
    expires_at: data.expires_at,
    created_at: data.created_at,
  };
}

export async function dbRemoveMember(workspaceId: string, userId: string): Promise<void> {
  const { data: deleted, error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .neq("role", "owner")
    .select("user_id")
    .maybeSingle();

  if (error) throw error;
  if (!deleted) throw new Error("Member was not removed. Refresh the list and check your access.");

  void dbLogAuditEvent({
    workspace_id: workspaceId,
    event_type: "workspace.member_removed",
    resource_type: "workspace_member",
    resource_id: userId,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCANS
// ═══════════════════════════════════════════════════════════════════════════════

export interface DbScanRecord {
  id?: string;
  workspace_id: string;
  scan_type: "codebase" | "architecture" | "logs" | "full";
  target_name: string;
  status: "pending" | "running" | "completed" | "failed";
  selected_frameworks: string[];
  finding_count?: number;
  critical_count?: number;
  high_count?: number;
  framework_scores?: Record<string, number>;
  summary?: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
}

export async function dbFetchScans(workspaceId: string): Promise<Scan[]> {
  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch scans from Supabase:", error);
    throw error;
  }

  // Preserve the existing scan query; load severity evidence in one scoped batch.
  // A child-table problem must not make all parent scan rows disappear.
  const scanIds = (data ?? []).map((s) => s.id);
  const { data: evidence, error: evidenceError } = scanIds.length
    ? await supabase.from("findings").select("scan_id, severity").in("scan_id", scanIds)
    : { data: [], error: null };
  if (evidenceError) console.warn("Scan severity summaries unavailable:", evidenceError);

  return (data ?? []).map((s) => ({
    id: s.id,
    workspace_id: s.workspace_id,
    created_by: s.created_by ?? "",
    scan_type: s.scan_type || "codebase",
    source_type: "upload" as const,
    target_name: s.target_name,
    selected_frameworks: s.selected_frameworks ?? [],
    status: s.status,
    progress: s.status === "completed" ? 100 : s.status === "running" ? 50 : 0,
    finding_count: s.finding_count ?? 0,
    framework_scores: s.framework_scores ?? {},
    severity_counts: evidenceError
      ? undefined
      : countSeverities((evidence ?? []).filter((f) => f.scan_id === s.id)),
    error_code: null,
    error_message: null,
    created_at: s.created_at,
    started_at: s.started_at ?? null,
    completed_at: s.completed_at ?? null,
  }));
}

export async function dbFetchScan(scanId: string): Promise<Scan | null> {
  const { data, error } = await supabase.from("scans").select("*").eq("id", scanId).single();

  if (error || !data) return null;

  return {
    id: data.id,
    workspace_id: data.workspace_id,
    created_by: data.created_by ?? "",
    scan_type: data.scan_type || "codebase",
    source_type: "upload",
    target_name: data.target_name,
    selected_frameworks: data.selected_frameworks ?? [],
    status: data.status,
    progress: data.status === "completed" ? 100 : data.status === "running" ? 50 : 0,
    finding_count: data.finding_count ?? 0,
    framework_scores: data.framework_scores ?? {},
    error_code: null,
    error_message: null,
    created_at: data.created_at,
    started_at: data.started_at ?? null,
    completed_at: data.completed_at ?? null,
  };
}

export async function dbCreateScan(record: DbScanRecord): Promise<Scan> {
  const ownerId = await getCurrentUserId();
  const scanId = record.id || crypto.randomUUID();

  const { data, error } = await supabase
    .from("scans")
    .insert({
      id: scanId,
      workspace_id: record.workspace_id,
      scan_type: record.scan_type,
      target_name: record.target_name,
      status: record.status,
      selected_frameworks: record.selected_frameworks,
      finding_count: record.finding_count ?? 0,
      critical_count: record.critical_count ?? 0,
      high_count: record.high_count ?? 0,
      framework_scores: record.framework_scores ?? {},
      summary: record.summary ?? {},
      created_by: ownerId,
      started_at: record.started_at ?? new Date().toISOString(),
      completed_at: record.completed_at,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to record scan in database: ${error?.message}`);
  }

  // Log audit event
  void dbLogAuditEvent({
    workspace_id: record.workspace_id,
    event_type: "scan.started",
    resource_type: "scan",
    resource_id: data.id,
    event_metadata: {
      target: record.target_name,
      frameworks: record.selected_frameworks,
    },
  });

  return {
    id: data.id,
    workspace_id: data.workspace_id,
    created_by: data.created_by || ownerId,
    scan_type: data.scan_type || "codebase",
    source_type: "upload",
    target_name: data.target_name,
    selected_frameworks: data.selected_frameworks ?? [],
    status: data.status,
    progress: data.status === "completed" ? 100 : data.status === "running" ? 50 : 0,
    finding_count: data.finding_count ?? 0,
    framework_scores: data.framework_scores ?? {},
    error_code: null,
    error_message: null,
    created_at: data.created_at,
    started_at: data.started_at ?? null,
    completed_at: data.completed_at ?? null,
  };
}

export async function dbUpdateScan(scanId: string, updates: Partial<DbScanRecord>): Promise<void> {
  const { error } = await supabase
    .from("scans")
    .update({ ...updates })
    .eq("id", scanId);

  if (error) {
    console.error("Failed to update scan status:", error);
  }
}

export async function dbDeleteScan(scanId: string): Promise<void> {
  const { error } = await supabase.from("scans").delete().eq("id", scanId);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINDINGS
// ═══════════════════════════════════════════════════════════════════════════════

export interface DbFindingInsert {
  scan_id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  state?: "open" | "accepted_risk" | "resolved" | "false_positive";
  file_path?: string;
  line_number?: number | null;
  cwe_id?: string | null;
  cve_id?: string | null;
  code_snippet?: string | null;
  cvss_score?: number;
  cvss_vector?: string;
  remediation?: string;
  source?: string;
}

export async function dbFetchFindings(
  scanId: string,
  filters?: { severity?: string; state?: string },
): Promise<Finding[]> {
  let targetScanId = scanId;
  if (!targetScanId || targetScanId === "latest") {
    const { data: latestScan } = await supabase
      .from("scans")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestScan?.id) {
      targetScanId = latestScan.id;
    }
  }

  let query = supabase.from("findings").select("*", { count: "exact" }).eq("scan_id", targetScanId);

  if (filters?.severity && filters.severity !== "all") {
    query = query.eq("severity", filters.severity);
  }
  if (filters?.state) {
    query = query.eq("state", filters.state);
  }

  // Legacy consumers need the complete scan, not PostgREST's first 1,000 rows.
  const data = [];
  query = query.order("created_at", { ascending: false }).order("id");
  for (let offset = 0; ;) {
    const page = await query.range(offset, offset + 999);
    if (page.error) throw page.error;
    data.push(...(page.data ?? []));
    offset += page.data?.length ?? 0;
    if (page.count !== null && offset >= page.count) break;
    if (!page.data?.length) {
      if (page.count && offset < page.count)
        throw new Error("Findings changed while loading. Please retry.");
      break;
    }
    if (page.count === null && page.data.length < 1000) break;
  }

  // IDs represent distinct persisted evidence, even when titles/locations match.
  const uniqueFindings: Finding[] = [];

  for (const f of data) {
    uniqueFindings.push({
      id: f.id,
      scan_id: f.scan_id,
      title: f.title,
      description: f.description,
      severity: f.severity,
      cvss_score:
        f.cvss_score != null && Number.isFinite(Number(f.cvss_score)) ? Number(f.cvss_score) : null,
      cvss_vector: f.cvss_vector ?? null,
      cwe_id: f.cwe_id ?? null,
      cve_id: f.cve_id ?? null,
      file_path: f.file_path ?? null,
      line_number: f.line_number ?? null,
      code_snippet: f.code_snippet ?? null,
      source: (f.source as FindingSource) || "semgrep",
      remediation: f.remediation ?? null,
      fingerprint: f.fingerprint ?? null,
      state: f.state || "open",
      assigned_to: null,
      created_at: f.created_at,
      updated_at: f.updated_at || f.created_at,
    });
  }

  return uniqueFindings;
}

export async function dbCreateFindingsBatch(findings: DbFindingInsert[]): Promise<void> {
  if (!findings.length) return;

  // Deduplicate incoming batch by title + file_path + line_number
  const seen = new Set<string>();
  const uniqueBatch: DbFindingInsert[] = [];
  for (const f of findings) {
    const key = `${(f.title || "").trim().toLowerCase()}|${f.file_path || ""}|${f.line_number ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueBatch.push(f);
  }

  const records = uniqueBatch.map((f) => ({
    id: crypto.randomUUID(),
    scan_id: f.scan_id,
    title: f.title,
    description: f.description,
    severity: f.severity,
    state: f.state || "open",
    file_path: f.file_path,
    line_number: f.line_number,
    cwe_id: f.cwe_id,
    cve_id: f.cve_id,
    code_snippet: f.code_snippet,
    cvss_score: f.cvss_score,
    cvss_vector: f.cvss_vector,
    remediation: f.remediation,
    source: !f.source || f.source === "code" ? "llm-review" : f.source,
  }));

  const { error } = await supabase.from("findings").insert(records);
  if (error) {
    console.error("Failed to insert findings into Supabase:", error);
    throw error;
  }
}

export async function dbUpdateFindingState(
  findingId: string,
  state: "open" | "accepted_risk" | "resolved" | "false_positive",
  scanId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("findings")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", findingId)
    .eq("scan_id", scanId)
    .select("id")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Finding update was not permitted.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS & AUDIT LOGS
// ═══════════════════════════════════════════════════════════════════════════════

export async function dbFetchReports(workspaceId: string): Promise<Report[]> {
  // reports table links to scans which link to workspaces — filter via scan join
  const { data: scans } = await supabase.from("scans").select("id").eq("workspace_id", workspaceId);

  const scanIds = (scans ?? []).map((s) => s.id);
  if (!scanIds.length) return [];

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .in("scan_id", scanIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch reports:", error);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    scan_id: r.scan_id,
    status: (r.status ?? "ready") as Report["status"],
    bucket: r.bucket ?? "reports",
    object_path: r.object_path ?? `reports/${r.id}.pdf`,
    sha256: r.sha256 ?? null,
    byte_size: r.byte_size ?? 0,
    version: r.version ?? 1,
    generated_at: r.generated_at ?? r.created_at,
    error_message: r.error_message ?? null,
  }));
}

export async function dbFetchReport(
  reportId: string,
  workspaceId?: string,
): Promise<Report | null> {
  let query = supabase
    .from("reports")
    .select("*, scans!inner(workspace_id)")
    .or(`id.eq.${reportId},scan_id.eq.${reportId}`);
  if (workspaceId) query = query.eq("scans.workspace_id", workspaceId);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    scan_id: data.scan_id,
    status: (data.status ?? "ready") as Report["status"],
    bucket: data.bucket ?? "reports",
    object_path: data.object_path ?? `reports/${data.id}.pdf`,
    sha256: data.sha256 ?? null,
    byte_size: data.byte_size ?? 0,
    version: data.version ?? 1,
    generated_at: data.generated_at ?? data.created_at,
    error_message: data.error_message ?? null,
  };
}

export async function dbCreateReport(report: {
  scan_id: string;
  status?: "queued" | "generating" | "ready" | "failed";
}): Promise<Report> {
  const { data, error } = await supabase
    .from("reports")
    .insert({
      scan_id: report.scan_id,
      status: report.status ?? "queued",
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create report record: ${error?.message}`);
  }

  return {
    id: data.id,
    scan_id: data.scan_id,
    status: (data.status ?? "pending") as Report["status"],
    bucket: data.bucket ?? "reports",
    object_path: data.object_path ?? `reports/${data.id}.pdf`,
    sha256: data.sha256 ?? null,
    byte_size: data.byte_size ?? 0,
    version: data.version ?? 1,
    generated_at: data.generated_at ?? data.created_at,
    error_message: data.error_message ?? null,
  };
}

export async function dbFetchAuditEvents(workspaceId: string): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from("audit_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((e) => ({
    id: e.id,
    workspace_id: e.workspace_id,
    actor_user_id: e.actor_user_id,
    event_type: e.event_type,
    resource_type: e.resource_type ?? null,
    resource_id: e.resource_id ?? null,
    event_metadata: (e.event_metadata as Record<string, unknown>) ?? {},
    created_at: e.created_at,
  }));
}

export async function dbLogAuditEvent(event: {
  workspace_id: string;
  event_type: string;
  resource_type?: string;
  resource_id?: string;
  event_metadata?: Record<string, unknown>;
}): Promise<void> {
  const actorId = await getCurrentUserId();

  const { error } = await supabase.from("audit_events").insert({
    workspace_id: event.workspace_id,
    actor_user_id: actorId,
    event_type: event.event_type,
    resource_type: event.resource_type ?? null,
    resource_id: event.resource_id ?? null,
    event_metadata: event.event_metadata ?? {},
  });

  if (error) {
    console.warn("Failed to log audit event:", error.message);
  }
}
