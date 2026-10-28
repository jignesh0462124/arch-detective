export function PrivacyContent() {
  return (
    <>
      <p>
        The prototype uses Supabase for account authentication and workspace records, including
        scans, findings and activity events. The browser also stores session information and local
        scan/report history.
      </p>
      <p>
        Uploaded archives are processed by the configured scanner backend. AI-assisted scanning and
        advisor conversations can send code excerpts or supplied context to the configured external
        AI providers. Remove credentials, personal information and confidential data that you are
        not authorized to share before uploading or chatting.
      </p>
      <p>
        Browser history is local to your device, so avoid shared browser profiles. Clearing browser
        site data removes local copies, but does not delete server-side records.
      </p>
      <p>
        When saved Advisor history is enabled, conversations are stored in Supabase and are private
        to your account within the workspace. Chats expire after 30 days. Conversations attached to
        a finding expire no later than its source-preview window and are removed when the associated
        scan or source is deleted. You can delete individual conversations from chat history. New
        chat messages are not saved in browser storage.
      </p>
      <p>
        Retention, deletion processes and provider configuration depend on the deployment. This is a
        research prototype notice, not a finalized privacy policy. Before production, the operator
        must document actual retention, subprocessors, contact details and applicable user-rights
        procedures.
      </p>
    </>
  );
}
export function TermsContent() {
  return (
    <>
      <p>
        Archon is a research security-review tool. Upload only projects and data you are authorized
        to review. Do not use it to scan systems without permission.
      </p>
      <p>
        Automated findings, inferred attack paths, suggested fixes and compliance mappings need
        human validation. A generated report is not a certification, penetration test, or legal
        compliance opinion.
      </p>
      <p>
        Test suggested changes in a separate environment before applying them. Keep backups of your
        source files and do not rely on the prototype as your only audit record.
      </p>
      <p>
        These are prototype usage notes, not production service terms. The project operator must
        supply reviewed service terms and contact details before a public production launch.
      </p>
    </>
  );
}
