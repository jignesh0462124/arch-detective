import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { authRequestSignal, authScope, isCurrentScope, privateStorage } from "@/lib/authState";

export class AuditScanDeleteError extends Error {}

/** One conditional RLS-enforced write; never invoke the legacy cancellation API. */
export async function deleteAuditHistoryScan(
  workspaceId: string,
  scanId: string,
  signal?: AbortSignal,
) {
  const scope = authScope();
  if (!scope.owner) throw new AuditScanDeleteError("Sign in to delete a scan.");
  const requestSignal = AbortSignal.any([
    authRequestSignal(),
    AbortSignal.timeout(20_000),
    ...(signal ? [signal] : []),
  ]);
  const { data, error } = await supabase
    .from("scans")
    .delete()
    .eq("id", scanId)
    .eq("workspace_id", workspaceId)
    .eq("scan_type", "codebase")
    .in("status", ["completed", "failed"])
    .select("id")
    .abortSignal(requestSignal);
  if (!isCurrentScope(scope)) throw new DOMException("Account changed", "AbortError");
  if (error)
    throw new AuditScanDeleteError(
      "The scan could not be deleted. Check your access and connection, then retry.",
    );
  if (data?.length !== 1 || data[0].id !== scanId)
    throw new AuditScanDeleteError(
      "The scan is unavailable, no longer eligible, or you no longer have permission. Refresh history before retrying.",
    );
  return { scan_id: scanId };
}

const privateKinds = new Set([
  "extension-review",
  "extension-screenshot",
  "source-window",
  "workbench",
  "workbench-bootstrap",
  "workbench-status",
  "snapshot-files",
  "workbench-file-pages",
  "workbench-finding-pages",
  "workbench-finding-detail",
  "finding-counts",
  "finding-queue",
  "finding-detail",
  "dashboard-findings",
  "report",
  "report-findings",
  "report-finding",
  "attack-graph-findings",
  "attack-graph-finding-detail",
  "github-proposal-findings",
  "fix-proposal",
  "fix-github-status",
  "fix-comparison",
]);
const workspaceKinds = new Set([
  "extension-review",
  "advisor-history",
  "audit-history",
  "dashboard-scans",
  "finding-scans",
  "reports",
  "attack-graph-scans",
  "github-saved-scans",
  "fix-proposals",
  "repository-scans",
]);
export function auditQueryInScope(key: QueryKey, user: string, workspace: string) {
  return key[1] === user && key[2] === workspace;
}
function mentionsScan(key: QueryKey, scan: string, data: unknown) {
  return (
    key.includes(scan) ||
    key.some(
      (value) =>
        !!value &&
        typeof value === "object" &&
        (("before" in value && value.before === scan) ||
          ("after" in value && value.after === scan)),
    ) ||
    (!!data &&
      typeof data === "object" &&
      (("scan_id" in data && data.scan_id === scan) || ("id" in data && data.id === scan)))
  );
}

export async function refreshAfterAuditDeletion(
  client: QueryClient,
  user: string,
  workspace: string,
  scan: string,
) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("archon-audit-deleted", { detail: { workspace, scan } }));
  const privateQuery = (query: { queryKey: QueryKey; state: { data: unknown } }) =>
    (privateKinds.has(String(query.queryKey[0])) &&
      auditQueryInScope(query.queryKey, user, workspace) &&
      mentionsScan(query.queryKey, scan, query.state.data)) ||
    // Compatibility hooks include the user and globally unique scan ID, but not workspace.
    (["scan", "findings"].includes(String(query.queryKey[0])) &&
      query.queryKey[1] === scan &&
      query.queryKey.at(-1) === user);
  await client.cancelQueries({ predicate: privateQuery });
  client.removeQueries({ predicate: privateQuery });
  // Optional navigation metadata is not audit evidence. Retain unrelated local history.
  const scope = authScope();
  if (scope.owner !== user) return;
  const storage = privateStorage(scope);
  try {
    const key = `archon-workbench-job:${workspace}`;
    const job = JSON.parse(storage.getItem(key) || "null");
    if (job?.id === scan) storage.removeItem(key);
  } catch {
    /* Optional metadata can be malformed. */
  }
  await client.invalidateQueries({
    predicate: (query) =>
      (workspaceKinds.has(String(query.queryKey[0])) &&
        auditQueryInScope(query.queryKey, user, workspace)) ||
      (query.queryKey[0] === "scans" &&
        query.queryKey[1] === workspace &&
        query.queryKey.includes(user)) ||
      (query.queryKey[0] === "workspaces" && query.queryKey[1] === user) ||
      (query.queryKey[0] === "workspace" &&
        query.queryKey[1] === workspace &&
        query.queryKey[2] === user),
  });
}

export function historyOffsetAfterDelete(offset: number, total: number, pageSize: number) {
  return Math.min(offset, Math.floor(Math.max(0, total - 2) / pageSize) * pageSize);
}
