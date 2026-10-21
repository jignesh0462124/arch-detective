import type { LocalFinding } from "./api/localScan";

export function validateAuditFile(file: { name: string; size: number }): string | null {
  if (!/\.zip$/i.test(file.name)) return "Only .zip source code archives are supported.";
  if (file.size === 0) return "This archive is empty. Choose a non-empty ZIP file.";
  if (file.size > 50 * 1024 * 1024) return "The archive exceeds the 50 MB upload limit.";
  return null;
}

export function findingIdentity(finding: LocalFinding): string {
  return JSON.stringify([
    finding.cwe_id || finding.title.toLowerCase(),
    finding.file_path?.replace(/\\/g, "/") || "",
    finding.line_number ?? null,
  ]);
}

export function recordedCvssAverage(findings: Pick<LocalFinding, "cvss_score">[]): number | null {
  const scores = findings
    .map((f) => f.cvss_score)
    .filter(
      (score): score is number =>
        typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 10,
    );
  return scores.length
    ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
    : null;
}

/** Only identical source locations are duplicates; a shared CWE is not enough. */
export function deduplicateAuditFindings(findings: LocalFinding[]): LocalFinding[] {
  const unique = new Map<string, LocalFinding>();
  const weights = { critical: 4, high: 3, medium: 2, low: 1 };
  for (const finding of findings) {
    const key = findingIdentity(finding);
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, { ...finding });
      continue;
    }
    const highest = weights[finding.severity] > weights[existing.severity] ? finding : existing;
    const violations = new Map(
      [...(existing.violations ?? []), ...(finding.violations ?? [])].map((v) => [
        `${v.framework}:${v.control_id}`,
        v,
      ]),
    );
    unique.set(key, { ...highest, violations: [...violations.values()] });
  }
  return [...unique.values()];
}
