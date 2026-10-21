import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchScan,
  fetchScans,
  createScan,
  deleteScan,
  type CreateScanPayload,
} from "@/lib/api/scans";

export function useScans(
  workspaceId: string | null | undefined,
  params?: { limit?: number; offset?: number },
) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["scans", workspaceId, params, user?.id],
    queryFn: () => fetchScans(workspaceId!, params),
    enabled: isAuthenticated && Boolean(workspaceId),
    staleTime: 30_000,
  });
}

export function useScan(scanId: string | null | undefined) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["scan", scanId, user?.id],
    queryFn: () => fetchScan(scanId!),
    enabled: isAuthenticated && Boolean(scanId),
    staleTime: 10_000,
  });
}

export function useCreateScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateScanPayload) => createScan(payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["scans", variables.workspace_id] });
    },
  });
}

export function useDeleteScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scanId: string) => deleteScan(scanId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scans"] });
    },
  });
}
