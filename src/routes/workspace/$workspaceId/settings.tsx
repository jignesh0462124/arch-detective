import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceSettingsPage } from "@/components/workspace/WorkspaceSettingsPage";

export const Route = createFileRoute("/workspace/$workspaceId/settings")({
  head: () => ({ meta: [{ title: "Workspace Settings · Archon" }] }),
  component: SettingsRoute,
});
function SettingsRoute() {
  const { workspaceId } = Route.useParams();
  const { user } = useAuth();
  return (
    <RequireAuth>
      <WorkspaceSettingsPage key={`${user?.id}/${workspaceId}`} workspaceId={workspaceId} />
    </RequireAuth>
  );
}
