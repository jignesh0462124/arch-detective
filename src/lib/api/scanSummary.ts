export type SeverityCounts = { critical: number; high: number; medium: number; low: number };

/** Counts come from evidence, never by assuming unspecified findings are medium. */
export function countSeverities(findings: readonly { severity: string }[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) {
    const severity = finding.severity.toLowerCase();
    if (Object.hasOwn(counts, severity)) counts[severity as keyof SeverityCounts]++;
  }
  return counts;
}

export function healthScore(counts: SeverityCounts): number {
  return Math.max(8, Math.round(100 - counts.critical * 12 - counts.high * 6 - counts.medium * 2 - counts.low * 0.5));
}

export function riskPosture(counts: SeverityCounts): "Critical" | "High" | "Medium" | "Low" | "Minimal" {
  return counts.critical ? "Critical" : counts.high ? "High" : counts.medium ? "Medium" : counts.low ? "Low" : "Minimal";
}

export function normalizeScanSummary<T extends { findings: { severity: string }[]; severity_counts: SeverityCounts; summary: { overall_posture: string } }>(result: T): T {
  const counts = countSeverities(result.findings);
  return { ...result, severity_counts: counts, summary: { ...result.summary, overall_posture: riskPosture(counts) } };
}
