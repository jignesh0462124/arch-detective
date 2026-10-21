import { accountStorage } from "@/lib/authState";
import {
  dbFetchFindings,
  dbUpdateFindingState,
} from "./database";
import type { Finding, FindingDetail } from "./types";

export interface FindingListResponse {
  items: Finding[];
  total: number;
  limit: number;
  offset: number;
}

export interface FindingFilters {
  severity?: string;
  source?: string;
  framework?: string;
  state?: string;
  limit?: number;
  offset?: number;
}

const OVERRIDES_STORAGE_KEY = "archon_findings_state_overrides_v1";
const DATABASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getLocalFindingStateOverrides(): Record<string, "open" | "accepted_risk" | "resolved" | "false_positive"> {
  if (typeof window === "undefined") return {};
  try {
    const raw = accountStorage.getItem(OVERRIDES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function fetchFindings(
  scanId: string,
  filters: FindingFilters = {},
): Promise<FindingListResponse> {
  const persisted = DATABASE_ID.test(scanId) || scanId === "latest";
  let items = persisted ? await dbFetchFindings(scanId, {
    severity: filters.severity,
    state: filters.state,
  }) : [];

  // Never resurrect deleted/empty server scans from browser history or mask server state.
  if (persisted) {
    const total = items.length;
    const offset = filters.offset ?? 0;
    if (filters.limit !== undefined) items = items.slice(offset, offset + filters.limit);
    else if (offset) items = items.slice(offset);
    return { items, total, limit: filters.limit ?? total, offset };
  }

  const overrides = getLocalFindingStateOverrides();

  // Local fallback: If database has no findings for this scanId (e.g. local mode or offline), check accountStorage
  if (items.length === 0 && typeof window !== "undefined") {
    try {
      const localFindings: Finding[] = [];
      const seenIds = new Set<string>();
      const seenSignatures = new Set<string>();

      // Candidate storage keys ordered by specificity: workspace history first, then global history, then active session
      const candidateKeys: string[] = [];
      for (let i = 0; i < accountStorage.length; i++) {
        const k = accountStorage.key(i);
        if (!k) continue;
        if (k.startsWith("threatlens_codebase_audit_history_v1")) {
          // Push workspace keys first, global later
          if (k.includes("global")) {
            candidateKeys.push(k);
          } else {
            candidateKeys.unshift(k);
          }
        } else if (
          k.startsWith("threatlens_codebase_audit_v1_") ||
          k.startsWith("threatlens_codebase_audit_state") ||
          k.startsWith("archon_audit_session")
        ) {
          candidateKeys.push(k);
        }
      }

      const uniqueKeys = Array.from(new Set(candidateKeys));
      let foundMatchingScan = false;

      for (const key of uniqueKeys) {
        if (foundMatchingScan) break;

        const raw = accountStorage.getItem(key);
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          const scanList = Array.isArray(parsed) ? parsed : [parsed];

          for (const s of scanList) {
            const res = s.result || s;
            const matchesScan =
              !scanId ||
              scanId === "latest" ||
              s.id === scanId ||
              s.scanId === scanId ||
              res.scan_id === scanId;

            if (matchesScan && Array.isArray(res.findings) && res.findings.length > 0) {
              for (let idx = 0; idx < res.findings.length; idx++) {
                const f = res.findings[idx];
                const findingId = f.id || `${s.id || scanId || "scan"}-${idx}`;
                const titleLower = (f.title || "").trim().toLowerCase();
                const fileStr = f.file_path || "";
                const lineStr = f.line_number != null ? String(f.line_number) : "";
                const sig = `${titleLower}|${fileStr}|${lineStr}`;

                // Strict deduplication: Skip if ID or title+file+line signature has already been processed
                if (seenIds.has(findingId) || seenSignatures.has(sig)) {
                  continue;
                }

                seenIds.add(findingId);
                seenSignatures.add(sig);

                const stateOverride = overrides[findingId] || overrides[f.title];
                const currentState = stateOverride || f.state || "open";

                localFindings.push({
                  id: findingId,
                  scan_id: s.id || s.scanId || scanId || "local",
                  title: f.title || "Vulnerability Finding",
                  description: f.description || "",
                  severity: f.severity || "medium",
                  cvss_score: f.cvss_score != null ? Number(f.cvss_score) : null,
                  cvss_vector: f.cvss_vector ?? null,
                  cwe_id: f.cwe_id ?? null,
                  cve_id: f.cve_id ?? null,
                  file_path: f.file_path ?? null,
                  line_number: f.line_number ?? null,
                  code_snippet: f.code_snippet ?? null,
                  source: (f.source as any) || "code",
                  remediation: Array.isArray(f.remediation_steps)
                    ? f.remediation_steps.join("\n")
                    : f.remediation ?? null,
                  fingerprint: f.fingerprint ?? null,
                  state: currentState,
                  violations: Array.isArray(f.violations) ? f.violations : undefined,
                  assigned_to: null,
                  created_at: f.created_at || s.completedAt || new Date().toISOString(),
                  updated_at: f.updated_at || s.completedAt || new Date().toISOString(),
                });
              }

              foundMatchingScan = true;
              // If targeting latest or a specific scan, take this scan and do not duplicate across other scans
              break;
            }
          }
        } catch {
          // ignore parsing error
        }
      }

      if (localFindings.length > 0) {
        items = localFindings;
      }
    } catch (e) {
      console.warn("Could not read local findings fallback:", e);
    }
  }

  // Deduplicate and apply state overrides to items
  const finalSeenIds = new Set<string>();
  const finalSeenSignatures = new Set<string>();
  const deduplicatedItems: Finding[] = [];

  for (const f of items) {
    const titleLower = (f.title || "").trim().toLowerCase();
    const fileStr = f.file_path || "";
    const lineStr = f.line_number != null ? String(f.line_number) : "";
    const sig = `${titleLower}|${fileStr}|${lineStr}`;

    if (f.id && finalSeenIds.has(f.id)) continue;
    if (finalSeenSignatures.has(sig)) continue;

    if (f.id) finalSeenIds.add(f.id);
    finalSeenSignatures.add(sig);

    const stateOverride = overrides[f.id] || overrides[f.title];
    deduplicatedItems.push({
      ...f,
      state: stateOverride || f.state || "open",
    });
  }

  items = deduplicatedItems;

  if (filters.severity && filters.severity !== "all") {
    items = items.filter((f) => f.severity === filters.severity);
  }
  if (filters.state) {
    items = items.filter((f) => f.state === filters.state);
  }

  return {
    items,
    total: items.length,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  };
}

export async function fetchFinding(scanId: string, findingId: string): Promise<FindingDetail> {
  const res = await fetchFindings(scanId);
  const finding = res.items.find((f) => f.id === findingId || f.title === findingId);
  if (!finding) throw new Error(`Finding not found: ${findingId}`);

  return {
    ...finding,
    violations: (finding.violations as any) || [],
    remediation_steps: finding.remediation ? [finding.remediation] : [],
    remediation_priority: finding.severity === "critical" ? "immediate" : "short-term",
  };
}

export async function updateFindingState(
  scanId: string,
  findingId: string,
  state: "open" | "accepted_risk" | "resolved" | "false_positive",
  _note?: string,
): Promise<{ finding_id: string; state: string; previous_state: string | null }> {
  // Persist server findings first. A denied write must not appear successful locally.
  const isDatabaseId = DATABASE_ID.test(findingId);
  if (isDatabaseId) {
    if (!DATABASE_ID.test(scanId)) throw new Error("A saved scan is required to update this finding.");
    await dbUpdateFindingState(findingId, state, scanId);
    return { finding_id: findingId, state, previous_state: null };
  }

  // 2. Persist in local overrides storage (guarantees state never reverts or disappears)
  if (typeof window !== "undefined") {
    try {
      const overrides = getLocalFindingStateOverrides();
      overrides[findingId] = state;
      accountStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    } catch (e) {
      console.warn("Could not save finding state override:", e);
    }

    // 3. Also update all audit history and active scan entries in accountStorage
    try {
      for (let i = 0; i < accountStorage.length; i++) {
        const key = accountStorage.key(i);
        if (
          key &&
          (key.startsWith("threatlens_codebase_audit_history_v1") ||
            key.startsWith("threatlens_codebase_audit_v1_") ||
            key.startsWith("threatlens_codebase_audit_state") ||
            key.startsWith("archon_audit_session"))
        ) {
          const raw = accountStorage.getItem(key);
          if (raw && (raw.includes(findingId) || raw.includes("findings"))) {
            const parsed = JSON.parse(raw);
            let modified = false;

            const checkAndModifyFindings = (findingsList: any[]) => {
              for (let idx = 0; idx < findingsList.length; idx++) {
                const f = findingsList[idx];
                const generatedId = `${scanId || "scan"}-${idx}`;
                if (f.id === findingId || f.title === findingId || generatedId === findingId) {
                  f.state = state;
                  f.id = f.id || generatedId;
                  modified = true;
                }
              }
            };

            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (item.id !== scanId && item.result?.scan_id !== scanId) continue;
                if (item.result?.findings) checkAndModifyFindings(item.result.findings);
                if (item.findings) checkAndModifyFindings(item.findings);
              }
            } else if (parsed && typeof parsed === "object" && (parsed.id === scanId || parsed.scanId === scanId || parsed.result?.scan_id === scanId)) {
              if (parsed.result?.findings) checkAndModifyFindings(parsed.result.findings);
              if (parsed.findings) checkAndModifyFindings(parsed.findings);
            }

            if (modified) {
              accountStorage.setItem(key, JSON.stringify(parsed));
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not sync finding state to accountStorage:", e);
    }
  }

  return { finding_id: findingId, state, previous_state: null };
}

export async function exportFindingsCSV(scanId: string): Promise<void> {
  const res = await fetchFindings(scanId);
  const items = res.items;
  const headers = ["Title", "Severity", "State", "CWE", "File", "Line", "CVSS", "Remediation"];
  const rows = items.map((f) => [
    `"${(f.title || "").replace(/"/g, '""')}"`,
    `"${f.severity}"`,
    `"${f.state}"`,
    `"${f.cwe_id || ""}"`,
    `"${f.file_path || ""}"`,
    `"${f.line_number ?? ""}"`,
    `"${f.cvss_score ?? ""}"`,
    `"${(f.remediation || "").replace(/"/g, '""')}"`,
  ]);
  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `findings-${scanId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportFindingsJSON(scanId: string): Promise<void> {
  const res = await fetchFindings(scanId);
  const items = res.items;
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `findings-${scanId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
