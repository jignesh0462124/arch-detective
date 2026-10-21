import { accountStorage } from "@/lib/authState";
import type { LocalScanResult, ScanProgressEvent } from "./localScan";
import { normalizeScanSummary, healthScore } from "./scanSummary";
import { saveStoredReport } from "./reports";

type Phase = "idle" | "uploading" | "scanning" | "done" | "error";

const AUDIT_STORAGE_KEY_PREFIX = "threatlens_codebase_audit_v1";

function getAuditStorageKey(workspaceId?: string): string {
  return `${AUDIT_STORAGE_KEY_PREFIX}_${workspaceId || "global"}`;
}

export interface PersistedAuditState {
  phase: Phase;
  targetName: string;
  scanId: string | null;
  selectedFrameworks: string[];
  currentProgress: number;
  currentStepKey: string;
  events: ScanProgressEvent[];
  result: LocalScanResult | null;
  elapsedSeconds: number;
  savedAt: string;
}

export function loadPersistedAudit(workspaceId?: string): PersistedAuditState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = accountStorage.getItem(getAuditStorageKey(workspaceId));
    if (!raw) return null;
    const state = JSON.parse(raw) as PersistedAuditState;
    return { ...state, result: state.result ? normalizeScanSummary(state.result) : null };
  } catch {
    return null;
  }
}

export function savePersistedAudit(state: PersistedAuditState, workspaceId?: string) {
  if (typeof window === "undefined") return false;
  try {
    accountStorage.setItem(getAuditStorageKey(workspaceId), JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn("Could not save audit to accountStorage:", e);
    return false;
  }
}

export function clearPersistedAudit(workspaceId?: string) {
  if (typeof window === "undefined") return;
  try {
    accountStorage.removeItem(getAuditStorageKey(workspaceId));
  } catch {
    // ignore
  }
}

// ── Audit History Storage Types & Helpers ─────────────────────────────────────

const AUDIT_HISTORY_STORAGE_KEY_PREFIX = "threatlens_codebase_audit_history_v1";

function getAuditHistoryKey(workspaceId?: string): string {
  return `${AUDIT_HISTORY_STORAGE_KEY_PREFIX}_${workspaceId || "global"}`;
}

export interface StoredScanHistoryItem {
  id: string;
  targetName: string;
  fileName?: string;
  fileSizeBytes?: number;
  completedAt: string;
  durationSeconds?: number;
  frameworks: string[];
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  healthScore: number;
  frameworkScores?: Record<string, number>;
  result?: LocalScanResult;
}

export function calculateHealthScore(counts: {
  critical: number;
  high: number;
  medium: number;
  low: number;
}): number {
  return healthScore(counts);
}

export function loadScanHistory(workspaceId?: string): StoredScanHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = accountStorage.getItem(getAuditHistoryKey(workspaceId));
    const items = raw ? (JSON.parse(raw) as StoredScanHistoryItem[]) : [];
    const snapshot = loadPersistedAudit(workspaceId);
    // Older sessions saved only an active snapshot, not a ledger entry. Keep
    // completed evidence available to dashboard, reports and graph consumers.
    if (
      snapshot?.phase === "done" &&
      snapshot.result &&
      snapshot.scanId &&
      !items.some((item) => item.id === snapshot.scanId)
    ) {
      const result = snapshot.result;
      const counts = result.severity_counts;
      items.unshift({
        id: snapshot.scanId,
        targetName: snapshot.targetName,
        completedAt: snapshot.savedAt,
        frameworks: snapshot.selectedFrameworks,
        findingsCount: result.findings.length,
        criticalCount: counts.critical,
        highCount: counts.high,
        mediumCount: counts.medium,
        lowCount: counts.low,
        healthScore: calculateHealthScore(counts),
        frameworkScores: result.framework_scores,
        result,
      });
    }
    return items.map((item) => {
      if (!item.result || !Array.isArray(item.result.findings)) return item;
      const result = normalizeScanSummary(item.result);
      const counts = result.severity_counts;
      return {
        ...item,
        result,
        criticalCount: counts.critical,
        highCount: counts.high,
        mediumCount: counts.medium,
        lowCount: counts.low,
        findingsCount: result.findings.length,
        healthScore: calculateHealthScore(counts),
      };
    });
  } catch {
    return [];
  }
}

export function saveScanToHistory(item: StoredScanHistoryItem, workspaceId?: string) {
  if (typeof window === "undefined") return false;
  try {
    const existing = loadScanHistory(workspaceId);
    const filtered = existing.filter((x) => x.id !== item.id);
    const updated = [item, ...filtered].slice(0, 50);
    accountStorage.setItem(getAuditHistoryKey(workspaceId), JSON.stringify(updated));

    // Synchronize to the reports registry
    saveStoredReport(
      {
        id: `rep_${item.id.replace(/^scan_/, "").slice(0, 16)}`,
        scan_id: item.id,
        status: "ready",
        bucket: "local-reports",
        object_path: `reports/${item.id}.pdf`,
        sha256: null,
        byte_size: null,
        version: 1,
        generated_at: item.completedAt || new Date().toISOString(),
        error_message: null,
        target_name: item.targetName || item.fileName || "Codebase scan",
        frameworks: item.frameworks || [],
        findings_count: item.findingsCount,
        critical_count: item.criticalCount,
        health_score: item.healthScore,
        framework_scores: item.frameworkScores || item.result?.framework_scores,
        result: item.result,
      },
      workspaceId,
    );
    return true;
  } catch (e) {
    console.warn("Could not save scan to history:", e);
    return false;
  }
}

export function removeScanFromHistory(scanId: string, workspaceId?: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadScanHistory(workspaceId);
    const updated = existing.filter((x) => x.id !== scanId);
    accountStorage.setItem(getAuditHistoryKey(workspaceId), JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function clearAllScanHistory(workspaceId?: string) {
  if (typeof window === "undefined") return;
  try {
    accountStorage.removeItem(getAuditHistoryKey(workspaceId));
  } catch {
    // ignore
  }
}
