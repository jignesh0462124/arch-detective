import { createFileRoute } from "@tanstack/react-router";
import { TeamPage } from "@/components/marketing/TeamPage";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team · Archon" },
      {
        name: "description",
        content:
          "Meet the Archon project team from G. H. Raisoni College of Engineering, Nagpur, and learn how its security-review workflow works.",
      },
    ],
  }),
  component: TeamPage,
});
