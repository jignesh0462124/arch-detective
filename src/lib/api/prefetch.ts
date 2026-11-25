import type { QueryClient } from "@tanstack/react-query";
import { fetchWorkspaces } from "./workspaces";
import { authScope, isCurrentScope } from "../authState";
// No detached promise chains may start private work after an account switch.
export async function prefetchUserData(client: QueryClient): Promise<void> {
  const scope = authScope();
  if (!scope.owner) return;
  await client.prefetchQuery({
    queryKey: ["workspaces", scope.owner],
    queryFn: async ({ signal }) => {
      const rows = await fetchWorkspaces(signal);
      if (signal.aborted || !isCurrentScope(scope))
        throw new DOMException("Account changed", "AbortError");
      return rows ?? [];
    },
    staleTime: 30_000,
  });
}
