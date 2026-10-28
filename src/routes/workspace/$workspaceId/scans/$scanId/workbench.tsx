import { RequireAuth } from "@/components/auth/RequireAuth";
import { createFileRoute } from "@tanstack/react-router";
import { AuditWorkbench } from "@/components/audit-workbench/AuditWorkbench";

export const Route = createFileRoute("/workspace/$workspaceId/scans/$scanId/workbench")({
  head: () => ({ meta: [{ title: "Audit Workbench · Archon" }] }),
  component: () => (
    <RequireAuth>
      <WorkbenchPage />
    </RequireAuth>
  ),
});

function WorkbenchPage() {
  const { workspaceId, scanId } = Route.useParams();
  return (
    <AuditWorkbench key={`${workspaceId}/${scanId}`} workspaceId={workspaceId} scanId={scanId} />
  );
}
