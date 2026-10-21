export const options = new URLSearchParams(window.location.search);
export const scenario = options.get("state") || "ready";
export const workspace = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Fixture workspace",
  role: options.get("role") || "owner",
  slug: "fixture",
  scan_count: 2,
};
export const scanId = "22222222-2222-4222-8222-222222222222";
export const olderScan = "33333333-3333-4333-8333-333333333333";
export const findings = Array.from({ length: scenario === "empty" ? 0 : 105 }, (_, n) => ({
  id: `44444444-4444-4444-8444-${String(n + 1).padStart(12, "0")}`,
  scan_id: scanId,
  title:
    n === 0 ? "Untrusted input reaches a database query" : `Review authorization boundary ${n}`,
  description:
    "Untrusted input can cross an authorization boundary. Confirm the affected route validates workspace membership.",
  file_path:
    "src/projects/payments/controllers/a-very-long-directory-name-that-must-wrap-on-small-screens/authorization-controller.ts",
  line_number: n + 5,
  severity: ["critical", "high", "medium", "low"][n % 4],
  state: "open",
  source: "static-rule",
  cwe_id: "CWE-89",
  cvss_score: n === 0 ? 9.8 : 0,
  code_snippet:
    "// Redacted evidence\nconst password = '[REDACTED]';\nawait database.query(query);",
  remediation: "Validate workspace membership and use parameterized queries.",
  created_at: "2026-10-19T10:00:00Z",
  violations: [
    {
      framework: "soc2",
      control_id: "CC6.1",
      control_title: "Logical access controls",
      violation_description: "Require authorization before accessing project data.",
    },
  ],
}));
