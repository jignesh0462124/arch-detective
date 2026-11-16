import { createFileRoute } from "@tanstack/react-router";
import { ProjectNotice } from "@/components/marketing/ProjectNotice";
import { PrivacyContent } from "@/components/settings/LegalContent";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Data handling · Archon" }] }),
  component: () => (
    <ProjectNotice title="Your data, explained." kind="privacy">
      <PrivacyContent />
    </ProjectNotice>
  ),
});
