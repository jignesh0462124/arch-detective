import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditEvents, type AuditEventFilters } from "@/lib/api/auditEvents";

/**
 * React Query hook for fetching workspace-scoped audit events.
 * Requires a valid workspaceId; query is disabled if not provided.
 * Polling is intentionally disabled — audit logs are not real-time.
 */
export function useAuditEvents(
  workspaceId: string | null | undefined,
  filters: Omit<AuditEventFilters, "workspace_id"> = {},
) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["audit-events", workspaceId, filters, user?.id],
    queryFn: ({ signal }) =>
      fetchAuditEvents({
        workspace_id: workspaceId!,
        ...filters,
        signal,
      }),
    enabled: isAuthenticated && Boolean(workspaceId),
    staleTime: 30_000,
  });
}
