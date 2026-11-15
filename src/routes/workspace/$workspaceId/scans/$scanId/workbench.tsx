import { RequireAuth } from "@/components/auth/RequireAuth";
import { createFileRoute } from "@tanstack/react-router";
import { AuditWorkbench } from "@/components/audit-workbench/AuditWorkbench";

export const Route = createFileRoute("/workspace/$workspaceId/scans/$scanId/workbench")({
  validateSearch: (search: Record<string, unknown>): { policyId?: string } => ({
    policyId:
      typeof search.policyId === "string" && /^[0-9a-f-]{36}$/i.test(search.policyId)
        ? search.policyId
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Audit Workbench · Archon" }] }),
  component: () => (
    <RequireAuth>
      <WorkbenchPage />
    </RequireAuth>
  ),
});

function WorkbenchPage() {
  const { workspaceId, scanId } = Route.useParams();
  const { policyId } = Route.useSearch();
  return (
    <AuditWorkbench
      key={`${workspaceId}/${scanId}/${policyId || ""}`}
      workspaceId={workspaceId}
      scanId={scanId}
      initialPolicyId={policyId}
    />
  );
}
