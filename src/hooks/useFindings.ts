import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchFindings,
  updateFindingState,
  exportFindingsCSV,
  exportFindingsJSON,
  type FindingFilters,
} from "@/lib/api/findings";

export function useFindings(scanId: string | null | undefined, filters: FindingFilters = {}) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["findings", scanId, filters, user?.id],
    queryFn: () => fetchFindings(scanId!, filters),
    enabled: isAuthenticated && Boolean(scanId),
    staleTime: 15_000,
  });
}

export function useUpdateFindingState(scanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      findingId,
      state,
      note,
    }: {
      findingId: string;
      state: "open" | "accepted_risk" | "resolved" | "false_positive";
      note?: string;
    }) => updateFindingState(scanId, findingId, state, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["findings", scanId] });
    },
  });
}

export function useExportFindings() {
  return {
    exportCSV: (scanId: string) => exportFindingsCSV(scanId),
    exportJSON: (scanId: string) => exportFindingsJSON(scanId),
  };
}
