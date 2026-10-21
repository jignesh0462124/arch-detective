import { Outlet, createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspace";
import { RequireAuth } from "@/components/auth/RequireAuth";
export const Route = createFileRoute("/_app")({ component: ProtectedApp });
function ProtectedApp() {
  return (
    <RequireAuth>
      <WorkspaceGate />
    </RequireAuth>
  );
}
function WorkspaceGate() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data, isSuccess, isError, refetch } = useWorkspaces();
  const location = useLocation();
  useEffect(() => {
    if (isAuthenticated && isSuccess && data.length === 0)
      void navigate({ to: "/workspace/new", replace: true });
  }, [data, isSuccess, isAuthenticated, navigate]);
  if (isError)
    return (
      <div className="p-8" role="alert">
        Workspaces couldn’t load. Your data hasn’t been removed.{" "}
        <button onClick={() => void refetch()}>Retry</button>
      </div>
    );
  return <Outlet key={location.pathname.split("/")[1]} />;
}
