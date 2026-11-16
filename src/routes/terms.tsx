import { createFileRoute } from "@tanstack/react-router";
import { ProjectNotice } from "@/components/marketing/ProjectNotice";
import { TermsContent } from "@/components/settings/LegalContent";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Usage notes · Archon" }] }),
  component: () => (
    <ProjectNotice title="For responsible code review." kind="terms">
      <TermsContent />
    </ProjectNotice>
  ),
});
