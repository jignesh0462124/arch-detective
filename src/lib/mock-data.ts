export const FRAMEWORKS = [
  { id: "soc2", label: "SOC 2", controls: 64, color: "primary" },
  { id: "iso27001", label: "ISO 27001", controls: 93, color: "gold" },
  { id: "hipaa", label: "HIPAA", controls: 54, color: "ink" },
  { id: "gdpr", label: "GDPR", controls: 47, color: "primary" },
  { id: "pci", label: "PCI-DSS", controls: 78, color: "gold" },
  { id: "nist", label: "NIST 800-53", controls: 1006, color: "ink" },
] as const;

export type Severity = "critical" | "high" | "medium" | "low";
export type Stride =
  | "Spoofing"
  | "Tampering"
  | "Repudiation"
  | "Information Disclosure"
  | "Denial of Service"
  | "Elevation of Privilege";

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  stride: Stride;
  component: string;
  description: string;
  evidence: string;
  remediation: string;
  controls: { framework: string; control: string; status: "violated" | "partial" | "met" }[];
  detected: string;
}

export const FINDINGS: Finding[] = [
  {
    id: "F-2041",
    title: "Hard-coded service account credentials in deployment manifest",
    severity: "critical",
    stride: "Information Disclosure",
    component: "k8s/payments-api/deployment.yaml",
    description:
      "Long-lived AWS access keys are embedded in plaintext within the payments-api Helm chart. Any developer with repo read access can extract production credentials.",
    evidence:
      "env:\n  - name: AWS_SECRET_ACCESS_KEY\n    value: \"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\"",
    remediation:
      "Move secrets to a managed secret store (AWS Secrets Manager / Vault). Rotate the exposed key immediately and audit CloudTrail for misuse.",
    controls: [
      { framework: "SOC 2", control: "CC6.1", status: "violated" },
      { framework: "ISO 27001", control: "A.8.24", status: "violated" },
      { framework: "PCI-DSS", control: "3.5.1", status: "violated" },
    ],
    detected: "2 min ago",
  },
  {
    id: "F-2039",
    title: "Inbound 0.0.0.0/0 allow rule on production database subnet",
    severity: "critical",
    stride: "Elevation of Privilege",
    component: "vpc/prod-db-sg",
    description:
      "Security group sg-018ad permits unrestricted ingress on port 5432 from the public internet to the primary Postgres cluster.",
    evidence: "ingress: [{ cidr: 0.0.0.0/0, port: 5432, protocol: tcp }]",
    remediation:
      "Restrict ingress to the application tier security group. Enable VPC flow logs and add a GuardDuty detector.",
    controls: [
      { framework: "SOC 2", control: "CC6.6", status: "violated" },
      { framework: "NIST 800-53", control: "SC-7", status: "violated" },
      { framework: "HIPAA", control: "164.312(e)(1)", status: "partial" },
    ],
    detected: "11 min ago",
  },
  {
    id: "F-2037",
    title: "Auth service does not enforce MFA for privileged roles",
    severity: "high",
    stride: "Spoofing",
    component: "auth-service/policies/admin.json",
    description:
      "Administrator role assumes are gated on password only. SCIM events show 14 active admins without a registered second factor.",
    evidence: '"require_mfa": false  // admin policy',
    remediation:
      "Enforce WebAuthn or TOTP for every role with write access to production. Block sessions older than 8h.",
    controls: [
      { framework: "SOC 2", control: "CC6.1", status: "violated" },
      { framework: "ISO 27001", control: "A.5.17", status: "violated" },
      { framework: "GDPR", control: "Art. 32", status: "partial" },
    ],
    detected: "34 min ago",
  },
  {
    id: "F-2031",
    title: "PII written to application logs at INFO level",
    severity: "high",
    stride: "Information Disclosure",
    component: "checkout-service/logger.ts",
    description:
      "Email addresses and partial card numbers are emitted to stdout and shipped to a non-segmented log bucket.",
    evidence: "logger.info(`charge ok user=${email} pan=${pan.slice(-4)}`)",
    remediation: "Add a redaction transport, classify the log bucket as Tier-2, and enable object-lock.",
    controls: [
      { framework: "GDPR", control: "Art. 5(1)(f)", status: "violated" },
      { framework: "PCI-DSS", control: "3.3", status: "violated" },
    ],
    detected: "1 h ago",
  },
  {
    id: "F-2024",
    title: "S3 bucket without server-side encryption (audit-logs-archive)",
    severity: "medium",
    stride: "Tampering",
    component: "s3://audit-logs-archive",
    description:
      "Long-term audit log archive does not enforce SSE-KMS. Objects can be replaced by anyone with PutObject.",
    evidence: "ServerSideEncryptionConfiguration: null",
    remediation: "Apply a bucket policy denying PutObject without aws:kms. Enable Object Lock in compliance mode.",
    controls: [
      { framework: "ISO 27001", control: "A.8.12", status: "partial" },
      { framework: "HIPAA", control: "164.312(c)(1)", status: "partial" },
    ],
    detected: "3 h ago",
  },
  {
    id: "F-2019",
    title: "Session cookie missing Secure + SameSite=Strict",
    severity: "medium",
    stride: "Spoofing",
    component: "edge/auth-gateway",
    description:
      "Session cookies issued by the auth gateway omit SameSite and Secure flags on the staging tenant.",
    evidence: "Set-Cookie: sid=…; Path=/; HttpOnly",
    remediation: "Append `; Secure; SameSite=Strict` and rotate active sessions.",
    controls: [
      { framework: "SOC 2", control: "CC6.7", status: "partial" },
      { framework: "GDPR", control: "Art. 32", status: "partial" },
    ],
    detected: "Yesterday",
  },
  {
    id: "F-2002",
    title: "Outdated TLS 1.0 endpoint exposed on legacy API",
    severity: "low",
    stride: "Tampering",
    component: "legacy-api.acme.io",
    description:
      "Edge listener still negotiates TLS 1.0 / 1.1 for backward compatibility. Five clients hit this in the last 30d.",
    evidence: "ssl_protocols TLSv1 TLSv1.1 TLSv1.2;",
    remediation: "Remove TLS 1.0/1.1, notify the 5 affected integrations, schedule retirement.",
    controls: [
      { framework: "PCI-DSS", control: "4.2.1.1", status: "partial" },
      { framework: "NIST 800-53", control: "SC-8", status: "met" },
    ],
    detected: "2 d ago",
  },
];

export const SCANS = [
  { id: "SCN-0142", target: "payments-api · prod", frameworks: ["SOC 2", "PCI-DSS"], status: "complete", findings: 12, started: "Today 14:02", duration: "1m 48s" },
  { id: "SCN-0141", target: "auth-service · prod", frameworks: ["SOC 2", "ISO 27001"], status: "complete", findings: 7, started: "Today 11:30", duration: "2m 11s" },
  { id: "SCN-0140", target: "ml-platform · staging", frameworks: ["NIST 800-53"], status: "running", findings: 0, started: "Today 09:14", duration: "—" },
  { id: "SCN-0139", target: "checkout-service · prod", frameworks: ["PCI-DSS", "GDPR"], status: "complete", findings: 19, started: "Yesterday", duration: "3m 02s" },
  { id: "SCN-0138", target: "data-warehouse", frameworks: ["HIPAA"], status: "failed", findings: 0, started: "Yesterday", duration: "0m 14s" },
];

export const REPORTS = [
  { id: "RPT-0098", title: "SOC 2 Type II — Q2 Readiness", framework: "SOC 2", date: "Jun 04, 2026", status: "Signed", pages: 124, featured: true },
  { id: "RPT-0097", title: "PCI-DSS 4.0 Gap Assessment", framework: "PCI-DSS", date: "Jun 02, 2026", status: "Draft", pages: 88 },
  { id: "RPT-0096", title: "ISO 27001:2022 Statement of Applicability", framework: "ISO 27001", date: "May 28, 2026", status: "Signed", pages: 64 },
  { id: "RPT-0095", title: "HIPAA Security Rule — Annual", framework: "HIPAA", date: "May 21, 2026", status: "Signed", pages: 41 },
  { id: "RPT-0094", title: "GDPR Article 32 Review", framework: "GDPR", date: "May 14, 2026", status: "In Review", pages: 32 },
  { id: "RPT-0093", title: "NIST 800-53 Rev 5 Baseline", framework: "NIST 800-53", date: "Apr 30, 2026", status: "Signed", pages: 212 },
];

export const COVERAGE = [
  { framework: "SOC 2", pct: 92 },
  { framework: "ISO 27001", pct: 78 },
  { framework: "PCI-DSS", pct: 64 },
  { framework: "HIPAA", pct: 81 },
  { framework: "GDPR", pct: 71 },
  { framework: "NIST 800-53", pct: 58 },
];
