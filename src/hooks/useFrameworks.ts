import { useQuery } from "@tanstack/react-query";
import { fetchFrameworks } from "@/lib/api/frameworks";

export function useFrameworks() {
  return useQuery({
    queryKey: ["frameworks"],
    queryFn: fetchFrameworks,
    staleTime: 5 * 60 * 1000,
  });
}
