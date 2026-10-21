import type { LocalScanResult } from "./localScan";
import type { DbScanRecord, DbFindingInsert } from "./database";

export interface AuditWriter {
  createScan: (record: DbScanRecord) => Promise<unknown>;
  createFindings: (findings: DbFindingInsert[]) => Promise<void>;
  updateScan: (id: string, updates: Partial<DbScanRecord>) => Promise<void>;
}

/** Completion is published only after the entire evidence batch is saved. */
export async function syncAuditEvidence(
  result: LocalScanResult,
  workspaceId: string,
  writer: AuditWriter,
) {
  await writer.createScan({
    id: result.scan_id,
    workspace_id: workspaceId,
    scan_type: "codebase",
    target_name: result.target_name,
    status: "running",
    selected_frameworks: result.frameworks,
    finding_count: result.findings.length,
    critical_count: result.severity_counts.critical,
    high_count: result.severity_counts.high,
    framework_scores: result.framework_scores,
    summary: { ...result.summary, analysis: result.analysis },
  });
  if (result.findings.length)
    await writer.createFindings(
      result.findings.map((f) => ({
        scan_id: result.scan_id,
        title: f.title,
        description: f.description,
        severity: f.severity,
        state: "open",
        file_path: f.file_path,
        line_number: f.line_number,
        cwe_id: f.cwe_id,
        cve_id: f.cve_id,
        code_snippet: f.code_snippet,
        cvss_score: f.cvss_score,
        cvss_vector: f.cvss_vector,
        remediation: f.remediation_steps?.join("\n"),
        source: "code",
      })),
    );
  await writer.updateScan(result.scan_id, {
    status: "completed",
    completed_at: new Date().toISOString(),
  });
}
