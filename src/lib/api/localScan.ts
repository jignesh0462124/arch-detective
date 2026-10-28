/**
 * Local scan API client — communicates with /api/local/* endpoints.
 * No auth required (local-only mode for localhost testing).
 */

import { escapeHtml } from "./escapeHtml";
import { consumeScanProgress } from "./scanProgress";
import { authScope, isCurrentScope, authRequestSignal } from "../authState";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface ScanStartResponse {
  scan_id: string;
  status: string;
  file_count: number;
}

export interface ScanProgressEvent {
  step: string;
  label: string;
  progress: number;
  findings_count?: number;
  result?: LocalScanResult;
}

export interface LocalFinding {
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  file_path?: string;
  line_number?: number | null;
  cwe_id?: string | null;
  cve_id?: string | null;
  code_snippet?: string | null;
  cvss_score?: number;
  cvss_vector?: string;
  violations?: Array<{
    framework: string;
    control_id: string;
    control_title: string;
    act_name?: string;
    requirement?: string;
    description?: string;
  }>;
  remediation_steps?: string[];
  affected_files?: Array<{
    file_path: string;
    line_number?: number | null;
  }>;
}

export interface LocalScanResult {
  scan_id: string;
  target_name: string;
  frameworks: string[];
  findings: LocalFinding[];
  framework_scores: Record<string, number>;
  summary: {
    summary: string;
    risk_headline: string;
    overall_posture: "Critical" | "High" | "Medium" | "Low" | "Minimal";
    top_priorities: string[];
  };
  severity_counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  generated_at: string;
  analysis?: {
    mode: string;
    files_scanned: number;
    files_truncated: number;
    limitations: string[];
  };
}

/**
 * Upload a ZIP file and start a local AI scan.
 * Returns scan_id immediately — use streamScanProgress() to watch progress.
 */
export async function uploadLocalScan(
  file: File,
  targetName: string,
  frameworks: string[],
  options: { signal?: AbortSignal } = {},
): Promise<ScanStartResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("target_name", targetName);
  form.append("frameworks", frameworks.join(","));

  let resp: Response;
  try {
    resp = await fetch(`${API_BASE}/api/local/scan`, {
      method: "POST",
      body: form,
      signal: options.signal,
    });
  } catch (netErr) {
    if (options.signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
    throw new Error(
      `Cannot connect to Archon scanner backend at ${API_BASE}. Make sure the backend is running via 'npm run dev' or 'npm run dev:backend'. (${netErr instanceof Error ? netErr.message : "Connection Refused"})`,
    );
  }

  if (!resp.ok) {
    if (resp.status === 404 || resp.status === 403)
      throw new Error(
        "Legacy local audits are unavailable. Use the signed-in Codebase Audit page. Existing browser reports remain available.",
      );
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error((err as { detail?: string }).detail ?? "Upload failed");
  }

  return resp.json() as Promise<ScanStartResponse>;
}

/**
 * Connect to the SSE stream for real-time scan progress with automatic polling fallback.
 * Calls `onEvent` for each progress update.
 * Resolves when the scan is done, rejects on error.
 */
export function streamScanProgress(
  scanId: string,
  onEvent: (event: ScanProgressEvent) => void,
  options: { signal?: AbortSignal } = {},
): Promise<LocalScanResult> {
  return consumeScanProgress(API_BASE, scanId, onEvent, options);
}

/**
 * Trigger browser PDF download for a completed scan.
 * Supports fallback to direct export endpoint with client-cached scan result,
 * and client-side printable audit report fallback if backend is unreachable.
 */
type ReportEvidence = Omit<Partial<LocalScanResult>, "findings"> & {
  findings?: (LocalFinding & { remediation?: string | null })[];
  targetName?: string;
  frameworkScores?: Record<string, number>;
};

async function fetchReportResponse(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.any([controller.signal, authRequestSignal()]),
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadScanReport(
  scanId: string,
  filename?: string,
  cachedResult?: ReportEvidence | null,
): Promise<void> {
  const ownerScope = authScope();
  const checkScope = () => {
    if (!isCurrentScope(ownerScope)) throw new DOMException("Account changed", "AbortError");
  };
  const safeFilename = filename ?? `threatlens-report-${scanId.slice(0, 8)}.pdf`;

  // 1. Try GET /api/local/scan/{scanId}/report
  try {
    const resp = await fetchReportResponse(
      `${API_BASE}/api/local/scan/${encodeURIComponent(scanId)}/report`,
      {},
      7000,
    );
    if (resp.ok) {
      const blob = await resp.blob();
      checkScope();
      _triggerDownload(blob, safeFilename);
      return;
    }
  } catch (getErr) {
    checkScope();
    console.warn(
      "GET report endpoint failed or timed out, attempting direct export fallback:",
      getErr,
    );
  }

  // 2. If GET failed and we have cachedResult (from state or history), try POST /api/local/scan/export-report
  if (cachedResult) {
    try {
      const exportResp = await fetchReportResponse(
        `${API_BASE}/api/local/scan/export-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scan_id: scanId,
            target_name: cachedResult.target_name || cachedResult.targetName || "Codebase Audit",
            frameworks: cachedResult.frameworks || [],
            findings: cachedResult.findings || [],
            framework_scores: cachedResult.framework_scores || cachedResult.frameworkScores || {},
            summary: cachedResult.summary || {},
            generated_at: cachedResult.generated_at || new Date().toISOString(),
          }),
        },
        10000,
      );

      if (exportResp.ok) {
        const blob = await exportResp.blob();
        checkScope();
        _triggerDownload(blob, safeFilename);
        return;
      }
    } catch (postErr) {
      checkScope();
      console.warn("POST export endpoint failed, falling back to print dialog:", postErr);
    }
  }

  // 3. Fallback: Generate printable HTML audit report window
  if (!cachedResult)
    throw new Error("Report data is unavailable. Open a completed audit and retry.");
  checkScope();
  _renderClientSideAuditReport(cachedResult, scanId, safeFilename);
}

function _triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function _renderClientSideAuditReport(
  result: ReportEvidence,
  scanId: string,
  _filename: string,
): void {
  const findings = (result?.findings || []).map((f) => ({
    ...f,
    title: escapeHtml(f.title),
    description: escapeHtml(f.description),
    file_path: escapeHtml(f.file_path),
    code_snippet: escapeHtml(f.code_snippet),
    remediation: escapeHtml(f.remediation || f.remediation_steps?.join("\n")),
    severity: ["critical", "high", "medium", "low"].includes(f.severity) ? f.severity : "low",
    line_number:
      typeof f.line_number === "number" && Number.isSafeInteger(f.line_number) && f.line_number > 0
        ? f.line_number
        : null,
  }));
  const targetName = escapeHtml(result?.target_name || result?.targetName || "Codebase Audit");
  scanId = escapeHtml(scanId);
  const frameworks = (result?.frameworks || []).map((f: string) => escapeHtml(f));
  const scores = Object.fromEntries(
    Object.entries(result?.framework_scores || result?.frameworkScores || {}).map(([k, v]) => [
      escapeHtml(k),
      escapeHtml(v),
    ]),
  );

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Unable to open print report window. Please allow popups for this site.");
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Security Audit Report — ${targetName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #111; line-height: 1.5; }
    h1 { font-size: 24px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
    .meta { font-size: 13px; color: #666; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .card { background: #f8f8f8; padding: 12px; border-radius: 6px; border: 1px solid #ddd; }
    .card .title { font-size: 11px; text-transform: uppercase; color: #777; font-weight: bold; }
    .card .val { font-size: 20px; font-weight: bold; margin-top: 4px; }
    .finding { border: 1px solid #e0e0e0; border-radius: 6px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid; }
    .crit { border-left: 5px solid #d32f2f; }
    .high { border-left: 5px solid #f57c00; }
    .med { border-left: 5px solid #fbc02d; }
    .low { border-left: 5px solid #1976d2; }
    .badge { display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: bold; text-transform: uppercase; border-radius: 3px; color: #fff; background: #555; }
    .badge.crit { background: #d32f2f; }
    .badge.high { background: #f57c00; }
    .badge.med { background: #fbc02d; color: #222; }
    .badge.low { background: #1976d2; }
    pre { background: #1e1e1e; color: #f0f0f0; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto; }
    .btn { background: #000; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-bottom: 20px; }
    @media print { .btn { display: none; } body { margin: 20px; } }
  </style>
</head>
<body>
  <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  <h1>ARCHON // SECURITY AUDIT REPORT</h1>
  <div class="meta">
    Target: <strong>${targetName}</strong> &nbsp;|&nbsp; Scan ID: <code>${scanId.slice(0, 8)}</code> &nbsp;|&nbsp; Date: ${new Date().toLocaleDateString()}
  </div>
  <div class="grid">
    <div class="card"><div class="title">Total Findings</div><div class="val">${findings.length}</div></div>
    <div class="card"><div class="title">Critical</div><div class="val" style="color: #d32f2f">${findings.filter((f) => f.severity === "critical").length}</div></div>
    <div class="card"><div class="title">High</div><div class="val" style="color: #f57c00">${findings.filter((f) => f.severity === "high").length}</div></div>
    <div class="card"><div class="title">Frameworks</div><div class="val" style="font-size: 14px">${Array.isArray(frameworks) ? frameworks.map((f: string) => f.toUpperCase()).join(", ") : "All"}</div></div>
  </div>
  <h2>Compliance Framework Readiness</h2>
  <div class="grid">
    ${Object.entries(scores)
      .map(
        ([k, v]) => `
      <div class="card"><div class="title">${k.toUpperCase()}</div><div class="val">${v}%</div></div>
    `,
      )
      .join("")}
  </div>
  <h2>Vulnerability Findings (${findings.length})</h2>
  ${findings
    .map(
      (f, i) => `
    <div class="finding ${f.severity === "critical" ? "crit" : f.severity === "high" ? "high" : f.severity === "medium" ? "med" : "low"}">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
        <span class="badge ${f.severity === "critical" ? "crit" : f.severity === "high" ? "high" : f.severity === "medium" ? "med" : "low"}">${f.severity}</span>
        <span style="font-size:12px; color:#666">${f.file_path ? f.file_path + (f.line_number ? ":" + f.line_number : "") : ""}</span>
      </div>
      <h3 style="margin: 4px 0 8px 0; font-size: 16px;">${i + 1}. ${f.title}</h3>
      <p style="font-size: 13px; color: #333;">${f.description || ""}</p>
      ${f.code_snippet ? `<pre><code>${f.code_snippet}</code></pre>` : ""}
      ${f.remediation ? `<p style="font-size: 12px; color: #0070f3;"><strong>Remediation:</strong> ${f.remediation}</p>` : ""}
    </div>
  `,
    )
    .join("")}
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 400); };
  </script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
