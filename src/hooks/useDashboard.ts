import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardLatestAudit,
  fetchDashboardRecentScans,
  type DashboardScan,
} from "@/lib/api/dashboard";
import { getDashboardFindings } from "@/lib/api/findingQueue";
import { isScanInProgress } from "@/lib/dashboardView";

export function useDashboardScans(userId: string | undefined, workspaceId: string | undefined) {
  const scope = ["dashboard-scans", userId, workspaceId];
  const options = {
    enabled: Boolean(userId && workspaceId),
    retry: false,
    gcTime: 0,
    staleTime: 15_000,
  };
  const recent = useQuery({
    ...options,
    queryKey: [...scope, "recent"],
    queryFn: ({ signal }) => fetchDashboardRecentScans(workspaceId!, signal),
    refetchInterval: (query) =>
      query.state.data?.some((scan) => isScanInProgress(scan.status)) ? 15_000 : false,
  });
  const latest = useQuery({
    ...options,
    queryKey: [...scope, "latest"],
    queryFn: ({ signal }) => fetchDashboardLatestAudit(workspaceId!, signal),
  });
  const previousRecent = useRef<DashboardScan[] | undefined>(undefined);
  const refetchLatest = latest.refetch;
  const recentScans = recent.isError ? undefined : recent.data;
  useEffect(() => {
    if (!recentScans) return;
    const previous = previousRecent.current;
    previousRecent.current = recentScans;
    if (
      previous?.some(
        (scan) =>
          isScanInProgress(scan.status) &&
          !recentScans.some((next) => next.id === scan.id && isScanInProgress(next.status)),
      )
    ) {
      void refetchLatest();
    }
  }, [recentScans, refetchLatest]);
  return { latest, recent };
}

export function useDashboardFindings(
  userId: string | undefined,
  workspaceId: string,
  scanId: string | undefined,
) {
  return useQuery({
    queryKey: ["dashboard-findings", userId, workspaceId, scanId],
    queryFn: ({ signal }) => getDashboardFindings(workspaceId, scanId!, signal),
    enabled: Boolean(userId && workspaceId && scanId),
    retry: false,
    gcTime: 0,
  });
}
