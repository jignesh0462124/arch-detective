import { useEffect } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFindingCounts,
  getFindingPage,
  getFindingScans,
  getQueueFinding,
  type FindingState,
  type QueueFilters,
} from "@/lib/api/findingQueue";
import { updateFindingState } from "@/lib/api/findings";

export function useFindingScans(userId: string | undefined, workspaceId: string) {
  return useInfiniteQuery({
    queryKey: ["finding-scans", userId, workspaceId],
    queryFn: ({ signal, pageParam }) => getFindingScans(workspaceId, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total && last.items.length
        ? last.offset + last.items.length
        : undefined,
    enabled: !!userId,
    retry: false,
    refetchInterval: 15000,
    gcTime: 0,
  });
}

export function useFindingQueue(
  userId: string | undefined,
  workspaceId: string,
  scanId: string,
  filters: QueueFilters,
  offset: number,
  selectedId: string | null,
) {
  const client = useQueryClient();
  const scope = [userId, workspaceId, scanId];
  const counts = useQuery({
    queryKey: ["finding-counts", ...scope],
    queryFn: ({ signal }) => getFindingCounts(workspaceId, scanId, signal),
    enabled: !!userId,
    retry: false,
    gcTime: 0,
    refetchInterval: 15000,
  });
  const page = useQuery({
    queryKey: ["finding-queue", ...scope, filters, offset],
    queryFn: ({ signal }) => getFindingPage(workspaceId, scanId, filters, offset, signal),
    enabled: !!userId && counts.isSuccess,
    retry: false,
    gcTime: 0,
  });
  const detail = useQuery({
    queryKey: ["finding-detail", ...scope, selectedId],
    queryFn: ({ signal }) => getQueueFinding(workspaceId, scanId, selectedId!, signal),
    enabled: !!userId && counts.isSuccess && !!selectedId,
    retry: false,
    gcTime: 0,
  });
  useEffect(() => {
    if (!counts.isError) return;
    for (const key of ["finding-queue", "finding-detail"]) {
      const queryKey = [key, userId, workspaceId, scanId];
      void client.cancelQueries({ queryKey });
      client.removeQueries({ queryKey });
    }
  }, [counts.isError, client, userId, workspaceId, scanId]);
  const update = useMutation({
    mutationKey: ["finding-triage", ...scope],
    mutationFn: ({ id, state }: { id: string; state: FindingState }) =>
      updateFindingState(scanId, id, state),
    onSuccess: async () => {
      // Refresh both this queue and existing consumers; never cache a synthetic success.
      await Promise.all([
        ...["finding-queue", "finding-detail", "finding-counts"].map((key) =>
          client.invalidateQueries({ queryKey: [key, ...scope] }),
        ),
        client.invalidateQueries({ queryKey: ["findings", scanId] }),
        client.invalidateQueries({ queryKey: ["attack-graph-findings"] }),
        ...[
          "workbench",
          "workbench-bootstrap",
          "workbench-status",
          "workbench-finding-pages",
          "workbench-finding-detail",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      ]);
    },
  });
  return { counts, page, detail, update };
}
