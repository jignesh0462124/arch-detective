import type { ScanStatus } from "./api/types";

export const isScanInProgress = (status: ScanStatus) =>
  status === "pending" || status === "uploading" || status === "queued" || status === "running";

export function dashboardScanStatus(status: ScanStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "pending":
    case "uploading":
    case "queued":
    case "running":
      return "In progress";
  }
}

export function dashboardDate(value: string | null | undefined): string {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString()
    : "Date unavailable";
}

export function frameworkSignals(scores: Record<string, unknown>): Array<[string, number]> {
  return Object.entries(scores).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= 0 && entry[1] <= 100,
  );
}
