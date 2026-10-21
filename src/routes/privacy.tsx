import { createFileRoute } from "@tanstack/react-router";
import { ProjectNotice } from "@/components/marketing/ProjectNotice";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Data handling · Archon" }] }),
  component: () => <ProjectNotice title="Data handling notice">
    <p>The prototype uses Supabase for account authentication and workspace records, including scans, findings and activity events. The browser also stores session information and local scan/report history.</p>
    <p>Uploaded archives are processed by the configured scanner backend. AI-assisted scanning and advisor conversations can send code excerpts or supplied context to the configured external AI providers. Remove credentials, personal information and confidential data that you are not authorized to share before uploading or chatting.</p>
    <p>Browser history is local to your device, so avoid shared browser profiles. Clearing browser site data removes local copies, but does not delete server-side records.</p>
    <p>Retention, deletion processes and provider configuration depend on the deployment. This is a research prototype notice, not a finalized privacy policy. Before production, the operator must document actual retention, subprocessors, contact details and applicable user-rights procedures.</p>
  </ProjectNotice>,
});
