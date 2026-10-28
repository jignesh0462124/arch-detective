import { createFileRoute } from "@tanstack/react-router";
import { AdvisorWorkspace } from "@/components/ai-assistant/AdvisorWorkspace";
export type AdvisorSearch = {
  prompt?: string;
  q?: string;
  threat?: string;
  solution?: string;
  workspaceId?: string;
  scanId?: string;
  findingId?: string;
  example?: string;
  cwe?: string;
  file?: string;
  conversation?: string;
};
export const Route = createFileRoute("/_app/advisor")({
  validateSearch: (search: Record<string, unknown>): AdvisorSearch => {
    const output: AdvisorSearch = {};
    for (const key of [
      "prompt",
      "q",
      "threat",
      "solution",
      "workspaceId",
      "scanId",
      "findingId",
      "example",
      "cwe",
      "file",
      "conversation",
    ] as const)
      if (typeof search[key] === "string") output[key] = search[key];
    return output;
  },
  head: () => ({ meta: [{ title: "Security Advisor · Archon" }] }),
  component: AdvisorPage,
});
function AdvisorPage() {
  return <AdvisorWorkspace search={Route.useSearch()} />;
}
