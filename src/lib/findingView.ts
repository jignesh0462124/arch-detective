// Pure presentation decisions; no sessions, source text or browser storage.
export const FINDING_STATES = ["open", "resolved", "accepted_risk", "false_positive"] as const;
export const stateLabel = (state: string) =>
  ({
    open: "Open",
    resolved: "Resolved",
    accepted_risk: "Accepted risk",
    false_positive: "False positive",
  })[state] ?? "Unknown";
export function formatCvss(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 10 ? score.toFixed(1) : null;
}
export function chooseFindingScan<T extends { id: string; status: string }>(
  scans: T[],
  selectedId: string | null,
): T | undefined {
  return (
    scans.find((s) => s.id === selectedId && s.status === "completed") ??
    scans.find((s) => s.status === "completed")
  );
}
