import { createFileRoute } from "@tanstack/react-router";
import { ProjectNotice } from "@/components/marketing/ProjectNotice";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Usage notes · Archon" }] }),
  component: () => <ProjectNotice title="Usage notes">
    <p>Archon is a research security-review tool. Upload only projects and data you are authorized to review. Do not use it to scan systems without permission.</p>
    <p>Automated findings, inferred attack paths, suggested fixes and compliance mappings need human validation. A generated report is not a certification, penetration test, or legal compliance opinion.</p>
    <p>Test suggested changes in a separate environment before applying them. Keep backups of your source files and do not rely on the prototype as your only audit record.</p>
    <p>These are prototype usage notes, not production service terms. The project operator must supply reviewed service terms and contact details before a public production launch.</p>
  </ProjectNotice>,
});
