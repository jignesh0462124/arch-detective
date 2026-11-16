export type NoticeSection = { id: string; title: string; paragraphs: readonly string[] };

// One source for Settings and public documents; keep operational disclosures visible.
export const privacySections: readonly NoticeSection[] = [
  {
    id: "privacy-information",
    title: "Information we process",
    paragraphs: [
      "The prototype uses Supabase for account authentication and workspace records, including scans, findings and activity events. The browser also stores session information and local scan/report history.",
    ],
  },
  {
    id: "privacy-services",
    title: "Code & external services",
    paragraphs: [
      "Uploaded archives are processed by the configured scanner backend. AI-assisted scanning and advisor conversations can send code excerpts or supplied context to the configured external AI providers. Remove credentials, personal information and confidential data that you are not authorized to share before uploading or chatting.",
    ],
  },
  {
    id: "privacy-retention",
    title: "Retention & deletion",
    paragraphs: [
      "When saved Advisor history is enabled, conversations are stored in Supabase and are private to your account within the workspace. Chats expire after 30 days. Conversations attached to a finding expire no later than its source-preview window and are removed when the associated scan or source is deleted. You can delete individual conversations from chat history. New chat messages are not saved in browser storage.",
      "Source previews expire separately from saved findings and reports. Preview availability can also end when the audit is deleted. Exact retention and cleanup depend on the deployment configuration.",
    ],
  },
  {
    id: "privacy-controls",
    title: "Your controls",
    paragraphs: [
      "Browser history is local to your device, so avoid shared browser profiles. Clearing browser site data removes local copies, but does not delete server-side records.",
      "Manage your account in Settings and saved conversations in Security Advisor. Owners and admins can delete completed or failed scans through Codebase Audit → History. Keep your own copies of reports you need to retain.",
    ],
  },
  {
    id: "privacy-notice",
    title: "About this notice",
    paragraphs: [
      "Retention, deletion processes and provider configuration depend on the deployment. This is a research prototype notice, not a finalized privacy policy. Before production, the operator must document actual retention, subprocessors, contact details and applicable user-rights procedures.",
    ],
  },
];

export const termsSections: readonly NoticeSection[] = [
  {
    id: "terms-authorized",
    title: "Authorized use",
    paragraphs: [
      "Archon is a research security-review tool. Upload only projects and data you are authorized to review. Do not use it to scan systems without permission.",
    ],
  },
  {
    id: "terms-review",
    title: "Review & limitations",
    paragraphs: [
      "Automated findings, inferred attack paths, suggested fixes and compliance mappings need human validation. A generated report is not a certification, penetration test, or legal compliance opinion.",
    ],
  },
  {
    id: "terms-source",
    title: "Source & repository access",
    paragraphs: [
      "Uploading a ZIP does not apply changes to your original project. GitHub repository operations require separate authorization. When publishing is configured, reviewed changes use a new branch and pull request; merging remains on GitHub.",
    ],
  },
  {
    id: "terms-changes",
    title: "Changes & backups",
    paragraphs: [
      "Test suggested changes in a separate environment before applying them. Keep backups of your source files and do not rely on the prototype as your only audit record.",
    ],
  },
  {
    id: "terms-notice",
    title: "About these notes",
    paragraphs: [
      "These are prototype usage notes, not production service terms. The project operator must supply reviewed service terms and contact details before a public production launch.",
    ],
  },
];
