import { useQuery } from "@tanstack/react-query";
import { fetchDashboardScans } from "@/lib/api/dashboard";
import { getFindingCounts, getFindingPage, type QueueFilters } from "@/lib/api/findingQueue";
import { isScanInProgress } from "@/lib/dashboardView";

const openFilters: QueueFilters = { severity: "all", state: "open", q: "" };
const criticalOpenFilters: QueueFilters = { severity: "critical", state: "open", q: "" };

export function useDashboardScans(userId: string | undefined, workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard-scans", userId, workspaceId],
    queryFn: ({ signal }) => fetchDashboardScans(workspaceId!, signal),
    enabled: Boolean(userId && workspaceId),
    retry: false,
    gcTime: 0,
    staleTime: 15_000,
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.data?.recent.some((scan) => isScanInProgress(scan.status)) ? 15_000 : false,
  });
}

export function useDashboardFindings(
  userId: string | undefined,
  workspaceId: string,
  scanId: string | undefined,
) {
  const scope = [userId, workspaceId, scanId];
  const enabled = Boolean(userId && workspaceId && scanId);
  const counts = useQuery({
    queryKey: ["finding-counts", ...scope],
    queryFn: ({ signal }) => getFindingCounts(workspaceId, scanId!, signal),
    enabled,
    retry: false,
    gcTime: 0,
  });
  const open = useQuery({
    queryKey: ["finding-queue", ...scope, openFilters, 0],
    queryFn: ({ signal }) => getFindingPage(workspaceId, scanId!, openFilters, 0, signal),
    enabled,
    retry: false,
    gcTime: 0,
  });
  const criticalOpen = useQuery({
    queryKey: ["finding-queue", ...scope, criticalOpenFilters, 0],
    queryFn: ({ signal }) => getFindingPage(workspaceId, scanId!, criticalOpenFilters, 0, signal),
    enabled,
    retry: false,
    gcTime: 0,
  });
  return { counts, open, criticalOpen };
}
