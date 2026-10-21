import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  UploadSimple,
  FileZip,
  ShieldCheck,
  CheckCircle,
  WarningCircle,
  Warning,
  FilePdf,
  ArrowClockwise,
  Bug,
  Pulse,
  Code,
  Lock,
  MagnifyingGlass,
  ClipboardText,
  CaretRight,
  Info,
  CircleNotch,
  Copy,
  Check,
  Clock,
  SlidersHorizontal,
  Archive,
  Trash,
  Eye,
  DownloadSimple,
} from "@phosphor-icons/react";

import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { CodePanel } from "@/components/ui/code-panel";
import { AuditAnalytics } from "@/components/ui/audit-analytics";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { useScans } from "@/hooks/useScans";
import { fetchFindings } from "@/lib/api/findings";
import {
  dbCreateScan,
  dbCreateFindingsBatch,
  dbDeleteScan,
  dbUpdateScan,
} from "@/lib/api/database";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuditUpload } from "@/components/audit-workbench/AuditUpload";
import { ScanAnimation } from "@/components/audit-workbench/ScanAnimation";
import {
  getWorkbenchCapabilities,
  getWorkbench,
  asLegacyAudit,
  exportWorkbenchReport,
  workbenchError,
} from "@/lib/api/workbench";
import { cn } from "@/lib/utils";
import { countSeverities, riskPosture, normalizeScanSummary } from "@/lib/api/scanSummary";
import {
  uploadLocalScan,
  streamScanProgress,
  downloadScanReport,
  type LocalScanResult,
  type ScanProgressEvent,
} from "@/lib/api/localScan";
import { recordReportDownload } from "@/lib/api/reports";
import {
  loadPersistedAudit,
  savePersistedAudit,
  clearPersistedAudit,
  loadScanHistory,
  saveScanToHistory,
  removeScanFromHistory,
  clearAllScanHistory,
  calculateHealthScore,
  type PersistedAuditState,
  type StoredScanHistoryItem,
} from "@/lib/api/auditStorage";
import { resolveComplianceViolations, getFrameworkActName } from "@/lib/api/compliance";
import { deduplicateAuditFindings, findingIdentity, validateAuditFile } from "@/lib/auditView";
import { syncAuditEvidence } from "@/lib/api/auditSync";
import { authScope, isCurrentScope } from "@/lib/authState";

const auditWriter = {
  createScan: dbCreateScan,
  createFindings: dbCreateFindingsBatch,
  updateScan: dbUpdateScan,
};

export const Route = createFileRoute("/_app/workspace")({
  validateSearch: (search: Record<string, unknown>): { reportScan?: string } => ({
    reportScan: typeof search.reportScan === "string" ? search.reportScan : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Codebase Audit · Archon" },
      {
        name: "description",
        content:
          "Upload a project archive for automated source review, scoring estimates, candidate compliance mappings, and remediation guidance.",
      },
    ],
  }),
  component: WorkspacePage,
});

// ── Framework Definitions ─────────────────────────────────────────────────────

const FRAMEWORKS = [
  {
    id: "gdpr",
    label: "GDPR",
    title: "EU General Data Protection",
    desc: "Enforces Art. 25 & 32 encryption, data handling, and breach prevention controls.",
    controls: "Reference mapping",
  },
  {
    id: "soc2",
    label: "SOC 2 Type II",
    title: "Trust Services Criteria",
    desc: "Verifies CC6.1 access protection, boundary defense, and change verification.",
    controls: "Reference mapping",
  },
  {
    id: "iso27001",
    label: "ISO/IEC 27001",
    title: "Information Security Management",
    desc: "Assesses A.8 secure coding, vulnerability management, and asset containment.",
    controls: "Reference mapping",
  },
  {
    id: "pci_dss",
    label: "PCI DSS v4.0",
    title: "Payment Card Security",
    desc: "Checks Req. 6 secure systems, cryptographic hygiene, and injection prevention.",
    controls: "Reference mapping",
  },
  {
    id: "nist_csf",
    label: "NIST CSF 2.0",
    title: "Cybersecurity Framework",
    desc: "Audits PR.DS data security, DE.CM anomaly detection, and RS.MI mitigation.",
    controls: "Reference mapping",
  },
] as const;

// ── Security Pipeline Steps ───────────────────────────────────────────────────

const SEV_BADGE_STYLE = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  medium: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
} as const;

type Phase = "idle" | "uploading" | "scanning" | "done" | "error";

// All compliance frameworks supported for filtering and violation resolution

// ── Session Persistence Helpers ───────────────────────────────────────────────

function formatAuditDate(isoString: string): { relative: string; exact: string } {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { relative: "Recently", exact: isoString };
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = "";
    if (diffMins < 1) relative = "Just now";
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays === 1) relative = "Yesterday";
    else if (diffDays < 7) relative = `${diffDays}d ago`;
    else relative = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const exact = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return { relative, exact };
  } catch {
    return { relative: "Recently", exact: isoString };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

async function loadHistoryEvidence(
  item: StoredScanHistoryItem,
  signal?: AbortSignal,
): Promise<LocalScanResult> {
  if (item.result && Array.isArray(item.result.findings)) return normalizeScanSummary(item.result);
  try {
    const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
    const timeout = AbortSignal.timeout(5000);
    const response = await fetch(
      `${apiBase}/api/local/scan/${encodeURIComponent(item.id)}/result`,
      { signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
    );
    // 202 is also response.ok, but contains progress, not a completed result.
    if (response.status === 200) {
      const result = (await response.json()) as LocalScanResult;
      if (Array.isArray(result.findings)) return normalizeScanSummary(result);
    }
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  const { items } = await fetchFindings(item.id);
  if (items.length < item.findingsCount)
    throw new Error(
      `Audit evidence is incomplete: expected ${item.findingsCount} findings, loaded ${items.length}. The saved result has not been overwritten.`,
    );
  const findings = items.map((f) => ({
    ...f,
    file_path: f.file_path || undefined,
    cvss_score: f.cvss_score ?? undefined,
    cvss_vector: f.cvss_vector ?? undefined,
    remediation_steps: f.remediation ? [f.remediation] : [],
  }));
  return {
    scan_id: item.id,
    target_name: item.targetName,
    frameworks: item.frameworks,
    findings,
    framework_scores: item.frameworkScores || {},
    severity_counts: countSeverities(findings),
    generated_at: item.completedAt,
    summary: {
      summary: `Restored ${findings.length} recorded findings.`,
      risk_headline: findings.length ? "Findings require review" : "No findings recorded",
      overall_posture: riskPosture(countSeverities(findings)),
      top_priorities: findings.slice(0, 3).map((f) => f.title),
    },
  };
}

function WorkspacePage() {
  const { active } = useActiveWorkspace();
  const { reportScan } = Route.useSearch();
  const [legacy, setLegacy] = useState(false);
  const capabilities = useQuery({
    queryKey: ["workbench-capabilities", active?.id],
    queryFn: ({ signal }) => getWorkbenchCapabilities(signal),
    enabled: Boolean(active),
    retry: 0,
    staleTime: 60000,
    // Never replace the intake transport in the middle of an active audit.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (!active)
    return (
      <AppShell title="Codebase Audit">
        <p role="status">Loading workspace…</p>
      </AppShell>
    );
  if (!legacy && !reportScan && capabilities.isPending)
    return (
      <AppShell title="Codebase Audit">
        <p role="status" className="p-5 text-sm">
          Preparing audit workspace…
        </p>
      </AppShell>
    );
  if (!legacy && !reportScan && capabilities.data?.enabled)
    return (
      <AuditUpload
        key={active.id}
        workspaceId={active.id}
        workspaceName={active.name}
        role={active.role}
        capabilities={capabilities.data}
        onLegacy={() => setLegacy(true)}
      />
    );
  return <WorkspaceAudit key={`${active.id}/${reportScan || "legacy"}`} reportScan={reportScan} />;
}

function WorkspaceAudit({ reportScan }: { reportScan?: string }) {
  const navigate = useNavigate();
  const { active: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const queryClient = useQueryClient();
  const connectionRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      connectionRef.current?.abort();
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  // Intake / Upload State
  const [phase, setPhase] = useState<Phase>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetName, setTargetName] = useState("");
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([
    "gdpr",
    "soc2",
    "iso27001",
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scan Telemetry State
  const [scanId, setScanId] = useState<string | null>(null);
  const [events, setEvents] = useState<ScanProgressEvent[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [, setCurrentStepKey] = useState<string>("");
  const [result, setResult] = useState<LocalScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [savedAuditPreview, setSavedAuditPreview] = useState<PersistedAuditState | null>(null);

  // Results Explorer State
  const [expandedFindingKey, setExpandedFindingKey] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [visibleFindingCount, setVisibleFindingCount] = useState(50);
  const [sortBy, setSortBy] = useState<"cvss-desc" | "severity-desc" | "file-asc">("cvss-desc");
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedFindingKey, setCopiedFindingKey] = useState<string | null>(null);

  // Audit History & Ledger State
  const { data: scansData, refetch: refetchScans } = useScans(workspaceId);
  const [localHistory, setLocalHistory] = useState<StoredScanHistoryItem[]>(() =>
    loadScanHistory(workspaceId),
  );
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [isRestoringAuditId, setIsRestoringAuditId] = useState<string | null>(null);
  const [downloadingHistoryId, setDownloadingHistoryId] = useState<string | null>(null);

  // Sync history state when workspace changes
  useEffect(() => {
    setLocalHistory(loadScanHistory(workspaceId));
  }, [workspaceId]);

  // Restore persisted audit session across page navigation & reloads
  useEffect(() => {
    if (reportScan && workspaceId) {
      const controller = new AbortController();
      setPhase("scanning");
      void getWorkbench(workspaceId, reportScan, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          const audit = normalizeScanSummary(asLegacyAudit(data));
          setResult(audit);
          setScanId(reportScan);
          setTargetName(audit.target_name);
          setSelectedFrameworks(audit.frameworks);
          setCurrentProgress(100);
          setPhase("done");
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setError(workbenchError(error));
            setPhase("error");
          }
        });
      return () => controller.abort();
    }
    const ownerScope = authScope();
    const saved = loadPersistedAudit(workspaceId);
    const controller = new AbortController();
    connectionRef.current = controller;
    if (!saved) {
      setSavedAuditPreview(null);
      setResult(null);
      setPhase("idle");
      setScanId(null);
      setEvents([]);
      setCurrentProgress(0);
      return;
    }

    setSavedAuditPreview(saved);

    // If an audit was already completed, restore all findings & scorecards immediately
    if (saved.result && (saved.phase === "done" || saved.currentProgress >= 100)) {
      setPhase("done");
      setTargetName(saved.targetName);
      setScanId(saved.scanId);
      setSelectedFrameworks(saved.selectedFrameworks || ["gdpr", "soc2", "iso27001"]);
      setCurrentProgress(100);
      setCurrentStepKey("summary");
      setEvents(saved.events || []);
      setResult(normalizeScanSummary(saved.result));
      setElapsedSeconds(saved.elapsedSeconds || 0);
    } else if (saved.scanId && (saved.phase === "scanning" || saved.phase === "uploading")) {
      // Reconnect to in-progress or recently finished scan
      setPhase("scanning");
      setTargetName(saved.targetName);
      setScanId(saved.scanId);
      setSelectedFrameworks(saved.selectedFrameworks || ["gdpr", "soc2", "iso27001"]);
      setCurrentProgress(saved.currentProgress || 50);
      setEvents(saved.events || []);

      const finishRecoveredAudit = async (data: LocalScanResult) => {
        if (controller.signal.aborted || !isCurrentScope(ownerScope)) return;
        const endedAt = Date.parse(data.generated_at);
        const savedAt = Date.parse(saved.savedAt);
        const duration = Number.isFinite(endedAt - savedAt)
          ? Math.max(
              saved.elapsedSeconds,
              saved.elapsedSeconds + Math.floor((endedAt - savedAt) / 1000),
            )
          : saved.elapsedSeconds;
        setResult(data);
        setPhase("done");
        setCurrentProgress(100);
        setCurrentStepKey("summary");
        setElapsedSeconds(duration);
        const counts = data.severity_counts;
        const cached = saveScanToHistory(
          {
            id: data.scan_id,
            targetName: data.target_name,
            completedAt: data.generated_at,
            durationSeconds: duration,
            frameworks: data.frameworks,
            findingsCount: data.findings.length,
            criticalCount: counts.critical,
            highCount: counts.high,
            mediumCount: counts.medium,
            lowCount: counts.low,
            healthScore: calculateHealthScore(counts),
            frameworkScores: data.framework_scores,
            result: data,
          },
          workspaceId,
        );
        savePersistedAudit(
          {
            ...saved,
            phase: "done",
            result: data,
            elapsedSeconds: duration,
            currentProgress: 100,
            currentStepKey: "summary",
          },
          workspaceId,
        );
        setLocalHistory(loadScanHistory(workspaceId));
        try {
          if (workspaceId) await syncAuditEvidence(data, workspaceId, auditWriter);
          void queryClient.invalidateQueries({ queryKey: ["scans"] });
          void queryClient.invalidateQueries({ queryKey: ["findings"] });
        } catch {
          if (!controller.signal.aborted)
            setSyncWarning(
              cached
                ? "Recovered audit is cached locally, but cloud synchronization failed. Download a report and keep this browser's local data."
                : "Recovered audit could not be cached or synchronized. Keep this tab open and download a report.",
            );
        }
      };

      const checkOrResume = async () => {
        try {
          const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
          const res = await fetch(`${apiBase}/api/local/scan/${saved.scanId}/result`, {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
          });
          if (controller.signal.aborted) return;
          if (res.status === 200) {
            const data = normalizeScanSummary((await res.json()) as LocalScanResult);
            if (controller.signal.aborted) return;
            await finishRecoveredAudit(data);
          } else {
            const scanResult = normalizeScanSummary(
              await streamScanProgress(
                saved.scanId!,
                (evt) => {
                  if (controller.signal.aborted) return;
                  setEvents((prev) => [...prev, { ...evt, result: undefined }].slice(-80));
                  setCurrentProgress(evt.progress);
                  setCurrentStepKey(evt.step);
                },
                { signal: controller.signal },
              ),
            );
            if (controller.signal.aborted) return;
            await finishRecoveredAudit(scanResult);
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          setError(error instanceof Error ? error.message : "Could not reconnect to the scan.");
          setPhase("error");
        }
      };
      void checkOrResume();
    }
    return () => controller.abort();
  }, [workspaceId, queryClient, reportScan]);

  // Live Timer during scan
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (phase === "uploading" || phase === "scanning") {
      timer = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [phase]);

  // File selection
  const handleFileSelect = useCallback(
    (file: File) => {
      const validationError = validateAuditFile(file);
      if (validationError) {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setError(validationError);
        return;
      }
      setSelectedFile(file);
      setError(null);
      if (!targetName) {
        setTargetName(file.name.replace(/\.zip$/i, "").replace(/[-_]/g, " "));
      }
    },
    [targetName],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const toggleFramework = (id: string) => {
    setSelectedFrameworks((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  // ── Execution ───────────────────────────────────────────────────────────────

  const startScan = async () => {
    const ownerScope = authScope();
    if (
      !selectedFile ||
      phase === "uploading" ||
      phase === "scanning" ||
      selectedFrameworks.length === 0
    )
      return;
    if (validateAuditFile(selectedFile)) {
      setError(validateAuditFile(selectedFile));
      return;
    }
    connectionRef.current?.abort();
    const controller = new AbortController();
    connectionRef.current = controller;
    const startedAt = Date.now();
    const liveEvents: ScanProgressEvent[] = [];
    const captureProgress = (id: string, evt?: ScanProgressEvent) => {
      if (controller.signal.aborted || !isCurrentScope(ownerScope)) return;
      if (evt) {
        liveEvents.push({ ...evt, result: undefined });
        if (liveEvents.length > 80) liveEvents.shift();
        setEvents([...liveEvents]);
        setCurrentProgress(evt.progress);
        setCurrentStepKey(evt.step);
      }
      savePersistedAudit(
        {
          phase: "scanning",
          targetName: targetName || selectedFile.name,
          scanId: id,
          selectedFrameworks,
          currentProgress: evt?.progress ?? 0,
          currentStepKey: evt?.step ?? "upload",
          events: [...liveEvents],
          result: null,
          elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
          savedAt: new Date().toISOString(),
        },
        workspaceId,
      );
    };

    setPhase("uploading");
    setEvents([]);
    setCurrentProgress(0);
    setElapsedSeconds(0);
    setResult(null);
    setError(null);
    setSyncWarning(null);
    setExpandedFindingKey(null);

    try {
      const { scan_id } = await uploadLocalScan(
        selectedFile,
        targetName || selectedFile.name,
        selectedFrameworks,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setScanId(scan_id);
      setPhase("scanning");
      captureProgress(scan_id);

      const scanResult = normalizeScanSummary(
        await streamScanProgress(scan_id, (evt) => captureProgress(scan_id, evt), {
          signal: controller.signal,
        }),
      );
      if (controller.signal.aborted || !isCurrentScope(ownerScope)) return;
      const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);

      setResult(scanResult);
      setPhase("done");
      setElapsedSeconds(durationSeconds);
      setCurrentProgress(100);
      setCurrentStepKey("summary");

      // Calculate health score and record to local history ledger
      const healthScore = calculateHealthScore(scanResult.severity_counts);
      const historyItem: StoredScanHistoryItem = {
        id: scan_id,
        targetName: targetName || selectedFile.name,
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
        completedAt: new Date().toISOString(),
        durationSeconds,
        frameworks: selectedFrameworks,
        findingsCount: scanResult.findings.length,
        criticalCount: scanResult.severity_counts.critical,
        highCount: scanResult.severity_counts.high,
        mediumCount: scanResult.severity_counts.medium,
        lowCount: scanResult.severity_counts.low,
        healthScore,
        frameworkScores: scanResult.framework_scores || {},
        result: scanResult,
      };

      const historyCached = saveScanToHistory(historyItem, workspaceId);
      setLocalHistory((prev) => [historyItem, ...prev.filter((x) => x.id !== scan_id)]);

      // Persist completed scan session to localStorage
      const sessionCached = savePersistedAudit(
        {
          phase: "done",
          targetName: targetName || selectedFile.name,
          scanId: scan_id,
          selectedFrameworks,
          currentProgress: 100,
          currentStepKey: "summary",
          events: liveEvents,
          result: scanResult,
          elapsedSeconds: durationSeconds,
          savedAt: new Date().toISOString(),
        },
        workspaceId,
      );
      if (!historyCached || !sessionCached)
        setSyncWarning(
          "Local audit caching failed, possibly because browser storage is full. Keep this tab open and download the audit report.",
        );
      setSavedAuditPreview(null);

      // Synchronize findings & scan record to Supabase
      if (workspace?.id) {
        try {
          await syncAuditEvidence(scanResult, workspace.id, auditWriter);

          void queryClient.invalidateQueries({ queryKey: ["scans"] });
          void queryClient.invalidateQueries({ queryKey: ["findings"] });
        } catch (dbErr) {
          console.warn("Could not sync scan to Supabase:", dbErr);
          if (mountedRef.current)
            setSyncWarning(
              historyCached || sessionCached
                ? "Audit completed and is cached locally, but cloud synchronization failed. Keep this browser's local data and download a report."
                : "Audit completed, but local caching and cloud synchronization failed. Keep this tab open and download the report before leaving.",
            );
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Security audit encountered an error";
      setError(msg);
      setPhase("error");
    }
  };

  const reset = () => {
    connectionRef.current?.abort();
    connectionRef.current = null;
    clearPersistedAudit(workspaceId);
    setSavedAuditPreview(null);
    setPhase("idle");
    setSelectedFile(null);
    setTargetName("");
    setEvents([]);
    setCurrentProgress(0);
    setElapsedSeconds(0);
    setCurrentStepKey("");
    setResult(null);
    setError(null);
    setSyncWarning(null);
    setScanId(null);
    setExpandedFindingKey(null);
    setSeverityFilter("all");
    setFrameworkFilter("all");
    setSearchQuery("");
  };

  const handleDownload = async () => {
    const ownerScope = authScope();
    if (!scanId) return;
    setIsDownloading(true);
    try {
      if (reportScan) {
        await exportWorkbenchReport(reportScan, targetName);
        return;
      }
      await downloadScanReport(
        scanId,
        `archon-audit-${targetName.replace(/\s+/g, "-").toLowerCase()}.pdf`,
        result,
      );
      if (!isCurrentScope(ownerScope)) return;
      recordReportDownload(
        scanId,
        {
          target_name: targetName,
          frameworks: result?.frameworks || selectedFrameworks,
          findings_count: result?.findings?.length ?? 0,
          critical_count: result?.severity_counts?.critical ?? 0,
          health_score: result ? calculateHealthScore(result.severity_counts) : undefined,
          framework_scores: result?.framework_scores,
          result,
        },
        workspaceId,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF report download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyRemediation = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (!mountedRef.current) return;
      setCopiedFindingKey(key);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedFindingKey(null), 2500);
    } catch {
      setError("Clipboard access failed. Select and copy the guidance manually.");
    }
  };

  // ── History Ledger Operations & Synchronization ─────────────────────────────

  const allHistoryItems = useMemo(() => {
    const itemsMap = new Map<string, StoredScanHistoryItem>();

    localHistory.forEach((item) => {
      itemsMap.set(item.id, item);
    });

    if (scansData?.items) {
      scansData.items.forEach((scan) => {
        if (scan.status !== "completed" || scan.scan_type !== "codebase") return;
        if (!itemsMap.has(scan.id)) {
          const {
            critical: crit = 0,
            high = 0,
            medium: med = 0,
            low = 0,
          } = scan.severity_counts ?? {};
          const health = calculateHealthScore({ critical: crit, high, medium: med, low });

          itemsMap.set(scan.id, {
            id: scan.id,
            targetName: scan.target_name || "Codebase Target",
            completedAt: scan.completed_at || scan.created_at,
            frameworks: scan.selected_frameworks || [],
            findingsCount: scan.finding_count || 0,
            criticalCount: crit,
            highCount: high,
            mediumCount: med,
            lowCount: low,
            healthScore: health,
            frameworkScores: scan.framework_scores || {},
          });
        }
      });
    }

    return Array.from(itemsMap.values()).sort((a, b) => {
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    });
  }, [localHistory, scansData?.items]);

  const filteredHistoryItems = useMemo(() => {
    if (!historySearchQuery.trim()) return allHistoryItems;
    const q = historySearchQuery.toLowerCase().trim();
    return allHistoryItems.filter((item) => {
      const matchName = item.targetName.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);
      const matchFrameworks = (item.frameworks || []).some((fw) => fw.toLowerCase().includes(q));
      return matchName || matchId || matchFrameworks;
    });
  }, [allHistoryItems, historySearchQuery]);

  const handleRestoreHistoryAudit = async (item: StoredScanHistoryItem) => {
    const ownerScope = authScope();
    connectionRef.current?.abort();
    const controller = new AbortController();
    connectionRef.current = controller;
    setIsRestoringAuditId(item.id);
    setError(null);
    try {
      const reconstructedResult = await loadHistoryEvidence(item, controller.signal);
      if (controller.signal.aborted || !isCurrentScope(ownerScope)) return;
      setResult(reconstructedResult);
      const counts = reconstructedResult.severity_counts;
      const correctedItem = {
        ...item,
        result: reconstructedResult,
        findingsCount: reconstructedResult.findings.length,
        criticalCount: counts.critical,
        highCount: counts.high,
        mediumCount: counts.medium,
        lowCount: counts.low,
        healthScore: calculateHealthScore(counts),
      };
      saveScanToHistory(correctedItem, workspaceId);
      setLocalHistory(loadScanHistory(workspaceId));
      setTargetName(item.targetName);
      setScanId(item.id);
      setSelectedFrameworks(item.frameworks || ["gdpr", "soc2", "iso27001"]);
      setCurrentProgress(100);
      setCurrentStepKey("summary");
      setElapsedSeconds(item.durationSeconds || 0);
      setSeverityFilter("all");
      setFrameworkFilter("all");
      setSearchQuery("");
      setExpandedFindingKey(null);
      setPhase("done");
      savePersistedAudit(
        {
          phase: "done",
          targetName: item.targetName,
          scanId: item.id,
          selectedFrameworks: item.frameworks,
          currentProgress: 100,
          currentStepKey: "summary",
          events: [
            {
              step: "summary",
              label: "Restored audit",
              progress: 100,
              result: reconstructedResult,
            },
          ],
          result: reconstructedResult,
          elapsedSeconds: item.durationSeconds || 0,
          savedAt: item.completedAt,
        },
        workspaceId,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to load audit findings.");
    } finally {
      if (!controller.signal.aborted) setIsRestoringAuditId(null);
    }
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, targetScanId: string) => {
    e.stopPropagation();
    if (
      !window.confirm("Are you sure you want to remove this scan record from the history ledger?")
    ) {
      return;
    }
    try {
      if (scansData?.items.some((scan) => scan.id === targetScanId))
        await dbDeleteScan(targetScanId);
      if (!mountedRef.current) return;
      removeScanFromHistory(targetScanId, workspaceId);
      setLocalHistory((prev) => prev.filter((x) => x.id !== targetScanId));
      if (targetScanId === scanId) {
        clearPersistedAudit(workspaceId);
        setSavedAuditPreview(null);
      }
      void queryClient.invalidateQueries({ queryKey: ["scans"] });
      void refetchScans();
    } catch {
      setError("The cloud record could not be deleted. Local history was kept unchanged.");
    }
  };

  const handleClearAllHistory = () => {
    if (
      !window.confirm(
        "Clear this workspace's locally cached audit history? Cloud records are not deleted. This cannot be undone.",
      )
    ) {
      return;
    }
    clearAllScanHistory(workspaceId);
    clearPersistedAudit(workspaceId);
    setSavedAuditPreview(null);
    setLocalHistory([]);
  };

  const handleDownloadHistoryReport = async (e: React.MouseEvent, item: StoredScanHistoryItem) => {
    const ownerScope = authScope();
    e.stopPropagation();
    setDownloadingHistoryId(item.id);
    try {
      const evidence = await loadHistoryEvidence(item);
      if (!mountedRef.current || !isCurrentScope(ownerScope)) return;
      await downloadScanReport(
        item.id,
        `archon-audit-${item.targetName.replace(/\s+/g, "-").toLowerCase()}.pdf`,
        evidence,
      );
      if (!isCurrentScope(ownerScope)) return;
      recordReportDownload(
        item.id,
        {
          target_name: item.targetName,
          frameworks: item.frameworks,
          findings_count: item.findingsCount,
          critical_count: item.criticalCount,
          health_score: item.healthScore,
          framework_scores: item.frameworkScores || item.result?.framework_scores,
          result: evidence,
        },
        workspaceId,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF report download failed");
    } finally {
      setDownloadingHistoryId(null);
    }
  };

  // ── Deduplicated Findings (runs only when scan result changes) ────────────────
  // Compliance violations are resolved ONCE here, against ALL 5 frameworks.
  // This is expensive – splitting it from the filter memo avoids re-running it
  // every time the user changes a filter or types in the search box.

  const groupedFindings = useMemo(() => {
    if (!result?.findings) return [];

    return deduplicateAuditFindings(result.findings).map((raw) => ({
      ...raw,
      affected_files: raw.affected_files?.length
        ? raw.affected_files
        : [{ file_path: raw.file_path || "source", line_number: raw.line_number }],
      violations: resolveComplianceViolations(raw, result.frameworks),
    }));
  }, [result?.findings, result?.frameworks]);

  // ── Filtered & Sorted Findings (cheap – runs when filters change) ─────────────

  const filteredFindings = useMemo(() => {
    let list = groupedFindings;

    // 1. Severity filter
    if (severityFilter !== "all") {
      list = list.filter((f) => f.severity === severityFilter);
    }

    // 2. Framework filter – normalized matching (pci_dss, pcidss, pci-dss, etc.)
    if (frameworkFilter !== "all") {
      const targetNorm = frameworkFilter.toLowerCase().replace(/[-_\s]/g, "");
      list = list.filter((f) =>
        f.violations?.some((v) => v.framework.toLowerCase().replace(/[-_\s]/g, "") === targetNorm),
      );
    }

    // 3. Search query (title, description, file_path, cwe_id, affected files)
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.trim().toLowerCase();
      list = list.filter((f) => {
        if (f.title.toLowerCase().includes(q)) return true;
        if (f.description.toLowerCase().includes(q)) return true;
        if ((f.file_path || "").toLowerCase().includes(q)) return true;
        if ((f.cwe_id || "").toLowerCase().includes(q)) return true;
        if (f.affected_files?.some((af) => af.file_path.toLowerCase().includes(q))) return true;
        return false;
      });
    }

    // 4. Sorting
    return [...list].sort((a, b) => {
      if (sortBy === "cvss-desc") return (b.cvss_score ?? 0) - (a.cvss_score ?? 0);
      if (sortBy === "severity-desc") {
        const weight = { critical: 4, high: 3, medium: 2, low: 1 };
        return (weight[b.severity] || 0) - (weight[a.severity] || 0);
      }
      if (sortBy === "file-asc") return (a.file_path || "").localeCompare(b.file_path || "");
      return 0;
    });
  }, [groupedFindings, severityFilter, frameworkFilter, deferredSearchQuery, sortBy]);

  useEffect(
    () => setVisibleFindingCount(50),
    [result, severityFilter, frameworkFilter, deferredSearchQuery, sortBy],
  );

  // Compute overall security score out of 100
  const securityHealthScore = useMemo(() => {
    if (!result) return 100;
    const { critical = 0, high = 0, medium = 0, low = 0 } = result.severity_counts || {};
    const deduction = critical * 12 + high * 6 + medium * 2 + low * 0.5;
    return Math.max(8, Math.round(100 - deduction));
  }, [result]);

  // Analytics payload incorporating unified grouped findings
  const analyticsResult = useMemo(() => {
    if (!result) return null;
    return {
      ...result,
      findings: groupedFindings,
    };
  }, [result, groupedFindings]);

  // Standard compliance framework tabs for filtering (All, GDPR, SOC 2, ISO 27001, PCI DSS, NIST CSF)
  const frameworkFilterTabs = useMemo(() => {
    const defaultList: Array<{ id: string; label: string }> = [
      { id: "all", label: "All" },
      { id: "gdpr", label: "GDPR" },
      { id: "soc2", label: "SOC 2" },
      { id: "iso27001", label: "ISO 27001" },
      { id: "pci_dss", label: "PCI DSS" },
      { id: "nist_csf", label: "NIST CSF" },
    ];
    if (!result?.framework_scores) return defaultList;

    const existingKeys = new Set(defaultList.map((d) => d.id.toLowerCase().replace(/[-_\s]/g, "")));
    const extras: Array<{ id: string; label: string }> = [];
    for (const key of Object.keys(result.framework_scores)) {
      const norm = key.toLowerCase().replace(/[-_\s]/g, "");
      if (!existingKeys.has(norm)) {
        extras.push({ id: key, label: key.toUpperCase().replace("_", " ") });
        existingKeys.add(norm);
      }
    }
    return [...defaultList, ...extras];
  }, [result?.framework_scores]);

  // Violation count for each framework tab
  const frameworkCounts = useMemo(() => {
    const counts: Record<string, number> = { all: groupedFindings.length };
    for (const fw of frameworkFilterTabs) {
      if (fw.id === "all") continue;
      const norm = fw.id.toLowerCase().replace(/[-_\s]/g, "");
      counts[norm] = groupedFindings.filter((f) =>
        f.violations?.some((v) => v.framework.toLowerCase().replace(/[-_\s]/g, "") === norm),
      ).length;
    }
    return counts;
  }, [groupedFindings, frameworkFilterTabs]);

  return (
    <AppShell
      title="Codebase Audit"
      subtitle={
        workspace ? `Workspace · ${workspace.name}` : "Codebase Vulnerability & Compliance Audit"
      }
    >
      <div className="space-y-6 min-w-0 w-full">
        {phase === "done" && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {reportScan && workspaceId ? (
              <BrutalButton
                size="sm"
                variant="secondary"
                onClick={() =>
                  navigate({
                    to: "/workspace/$workspaceId/scans/$scanId/workbench",
                    params: { workspaceId, scanId: reportScan },
                  })
                }
              >
                Open workbench
              </BrutalButton>
            ) : null}
            <BrutalButton onClick={() => void handleDownload()} disabled={isDownloading} size="sm">
              {isDownloading ? (
                <CircleNotch size={14} className="animate-spin" />
              ) : (
                <FilePdf size={14} weight="duotone" />
              )}
              {isDownloading ? "Generating PDF…" : "Download Audit Report"}
            </BrutalButton>
            <BrutalButton
              onClick={() => {
                reset();
                if (reportScan) void navigate({ to: "/workspace", search: {} });
              }}
              size="sm"
              variant="ghost"
            >
              <ArrowClockwise size={14} />
              New audit
            </BrutalButton>
          </div>
        )}
        {syncWarning && (
          <p
            role="status"
            className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
          >
            {syncWarning}
          </p>
        )}
        {error && phase !== "error" && phase !== "idle" && (
          <p
            role="alert"
            className="rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-xs"
          >
            {error}
          </p>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PHASE 1: INTAKE & CONFIGURATION
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {phase === "idle" && (
          <div className="space-y-6">
            {/* Saved Audit Restoration Banner */}
            {savedAuditPreview && savedAuditPreview.result && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-sm border border-accent/40 bg-accent/5 p-4 text-xs shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent/15 border border-accent/40 text-accent">
                    <Clock size={16} weight="bold" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground truncate">
                        {savedAuditPreview.targetName}
                      </span>
                      <span className="font-mono text-[9px] uppercase rounded border border-accent/30 bg-accent/10 px-1.5 py-0.2 text-accent font-bold">
                        Preserved Session
                      </span>
                    </div>
                    <p className="text-muted-foreground font-mono text-[11px] mt-0.5">
                      {savedAuditPreview.result.findings.length} findings identified · Audited{" "}
                      {savedAuditPreview.savedAt
                        ? new Date(savedAuditPreview.savedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "recently"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <BrutalButton
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setPhase("done");
                      setTargetName(savedAuditPreview.targetName);
                      setScanId(savedAuditPreview.scanId);
                      setSelectedFrameworks(
                        savedAuditPreview.selectedFrameworks || ["gdpr", "soc2", "iso27001"],
                      );
                      setCurrentProgress(100);
                      setCurrentStepKey("summary");
                      setEvents(savedAuditPreview.events || []);
                      setResult(savedAuditPreview.result);
                      setElapsedSeconds(savedAuditPreview.elapsedSeconds || 0);
                    }}
                  >
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <span>Resume Audit</span>
                      <CaretRight size={11} weight="bold" />
                    </span>
                  </BrutalButton>
                  <button
                    type="button"
                    onClick={() => {
                      clearPersistedAudit(workspaceId);
                      setSavedAuditPreview(null);
                    }}
                    title="Discard saved audit"
                    className="rounded border border-border bg-card px-2.5 py-1 font-mono text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Header Context Banner */}
            <div className="rounded-sm border border-border bg-card p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-accent uppercase tracking-wider">
                      // SECURITY AUDIT ENGINE
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    <span className="text-[11px] text-muted-foreground font-medium">Ready</span>
                  </div>
                  <h2 className="mt-1 text-base font-bold tracking-tight">
                    Upload codebase archive for security and compliance audit
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                    Upload a ZIP archive to analyze vulnerabilities, map statutory compliance, and
                    generate audit reports.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px] min-w-0 w-full">
              {/* Left Column: Dropzone & Project Details */}
              <div className="space-y-5 min-w-0">
                {/* Dropzone */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Choose ZIP archive"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-sm border-2 border-dashed p-10 text-center transition-all",
                    isDragging
                      ? "border-accent bg-accent/5 scale-[1.005]"
                      : selectedFile
                        ? "border-success/60 bg-success/5"
                        : "border-border bg-card/60 hover:border-foreground/30 hover:bg-card",
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                    }}
                  />

                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-success/15 border border-success/30 text-success">
                        <FileZip size={26} weight="duotone" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{selectedFile.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Payload ready for
                          inspection
                        </p>
                      </div>
                      <span className="mt-1 text-[11px] text-accent font-medium hover:underline">
                        Click to select a different archive
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-secondary border border-border text-foreground">
                        <UploadSimple size={24} weight="bold" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          Drop project ZIP archive here, or browse
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Maximum 50 MB compressed · Enforces internal zip decompression limits
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap justify-center gap-1.5 max-w-sm">
                        {[".py", ".ts", ".js", ".java", ".go", ".php", ".cs", ".sql", ".yaml"].map(
                          (ext) => (
                            <span
                              key={ext}
                              className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                            >
                              {ext}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Project Metadata Name Input */}
                <div className="rounded-sm border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="target-name"
                      className="text-xs font-bold uppercase tracking-wider text-foreground"
                    >
                      Audit Target Title
                    </label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      REQUIRED FOR PDF REPORT
                    </span>
                  </div>
                  <input
                    id="target-name"
                    type="text"
                    value={targetName}
                    aria-label="Project name"
                    onChange={(e) => setTargetName(e.target.value)}
                    placeholder="e.g. Core API Gateway / v2.4-prod"
                    maxLength={100}
                    className="h-10 w-full rounded-sm border border-input bg-background px-3 font-mono text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-accent"
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    This identifier will be branded across generated audit certificates, executive
                    summaries, and compliance violation logs.
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="flex items-start gap-2.5 rounded-sm border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-foreground">
                    <WarningCircle
                      size={16}
                      weight="fill"
                      className="mt-0.5 shrink-0 text-destructive"
                    />
                    <div>
                      <p className="font-bold text-destructive">Intake validation failed</p>
                      <p className="mt-0.5 text-muted-foreground">{error}</p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <BrutalButton
                  onClick={() => void startScan()}
                  disabled={!selectedFile || selectedFrameworks.length === 0}
                  className="w-full justify-center h-11 text-xs font-bold"
                >
                  <Pulse size={16} weight="bold" />
                  Execute Codebase Audit
                  <CaretRight size={14} className="ml-auto opacity-70" />
                </BrutalButton>

                {/* Recent Audits Quick Access (Directly Below Execute Button) */}
                {allHistoryItems.length > 0 && (
                  <div className="rounded-sm border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <Archive size={14} weight="duotone" className="text-accent" />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
                          Recent Audit Runs ({allHistoryItems.length})
                        </span>
                      </div>
                      <a
                        href="#codebase-audit-history-ledger"
                        className="font-mono text-[10px] text-accent hover:underline flex items-center gap-1 font-bold"
                      >
                        View Full Ledger ↓
                      </a>
                    </div>

                    <div className="space-y-2">
                      {allHistoryItems.slice(0, 3).map((item) => {
                        const isRestoring = isRestoringAuditId === item.id;
                        const { relative } = formatAuditDate(item.completedAt);
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-sm border border-border/80 bg-background/60 p-2.5 hover:bg-secondary/40 transition-colors"
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-xs font-bold text-foreground truncate">
                                  {item.targetName}
                                </p>
                                <span
                                  className={cn(
                                    "font-mono text-[9px] font-bold px-1.5 py-0.2 rounded-xs border shrink-0",
                                    item.healthScore >= 80
                                      ? "text-success border-success/30 bg-success/10"
                                      : item.healthScore >= 60
                                        ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                                        : "text-destructive border-destructive/30 bg-destructive/10",
                                  )}
                                >
                                  {item.healthScore}/100
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 font-mono text-[10px] text-muted-foreground">
                                <span>{relative}</span>
                                <span>·</span>
                                {item.findingsCount === 0 ? (
                                  <span className="text-success font-semibold">0 Issues</span>
                                ) : (
                                  <>
                                    {item.criticalCount > 0 && (
                                      <span className="text-destructive font-semibold">
                                        {item.criticalCount} Crit
                                      </span>
                                    )}
                                    {item.highCount > 0 && (
                                      <span className="text-amber-500 font-semibold">
                                        {item.highCount} High
                                      </span>
                                    )}
                                    <span>{item.findingsCount} Total</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => void handleRestoreHistoryAudit(item)}
                              disabled={isRestoring}
                              className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-1 rounded-sm border border-foreground/20 bg-foreground text-background hover:bg-foreground/90 transition-colors shrink-0"
                              title="Inspect full audit results"
                            >
                              {isRestoring ? (
                                <CircleNotch size={11} className="animate-spin" />
                              ) : (
                                <Eye size={11} weight="bold" />
                              )}
                              <span>{isRestoring ? "Loading…" : "Inspect"}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Framework Checklist */}
              <div className="rounded-sm border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Lock size={15} weight="duotone" className="text-accent" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Compliance Standards
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Select benchmarks to audit</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {FRAMEWORKS.map((fw) => {
                    const isChecked = selectedFrameworks.includes(fw.id);
                    return (
                      <button
                        key={fw.id}
                        type="button"
                        onClick={() => toggleFramework(fw.id)}
                        className={cn(
                          "w-full text-left rounded-sm border p-3 transition-colors",
                          isChecked
                            ? "border-accent/40 bg-accent/5"
                            : "border-border bg-background hover:bg-secondary/40",
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={cn(
                              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                              isChecked
                                ? "border-accent bg-accent text-white"
                                : "border-border bg-card",
                            )}
                          >
                            {isChecked && <Check size={11} weight="bold" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-foreground">
                                {fw.label}
                              </span>
                              <span className="font-mono text-[9px] text-muted-foreground">
                                {fw.controls}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-foreground/80 mt-0.5">
                              {fw.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-tight mt-1">
                              {fw.desc}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-start gap-2 rounded-sm border border-border bg-secondary/30 p-2.5 text-[11px] text-muted-foreground">
                  <Info size={13} className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    Candidate control mappings support review; they do not verify full framework
                    compliance.
                  </span>
                </div>
              </div>
            </div>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                CODEBASE AUDIT HISTORY LEDGER (FULL RESPONSIVE REGISTRY)
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div
              id="codebase-audit-history-ledger"
              className="rounded-sm border border-border bg-card p-5 space-y-4"
            >
              {/* Header Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Archive size={17} weight="duotone" className="text-accent" />
                    <span className="font-mono text-[10px] font-bold text-accent uppercase tracking-wider">
                      // CRYPTOGRAPHIC ARCHIVE & REPOSITORY
                    </span>
                    <span className="inline-flex items-center rounded-xs border border-border bg-secondary/60 px-1.5 py-0.2 font-mono text-[9px] font-bold text-foreground">
                      {allHistoryItems.length} RECORD{allHistoryItems.length !== 1 ? "S" : ""}
                    </span>
                  </div>
                  <h3 className="text-base font-bold tracking-tight text-foreground mt-0.5">
                    Codebase Audit History Ledger
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saved history of automated codebase scans, recorded score estimates, and
                    compliance control mappings.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Search Input */}
                  <div className="relative min-w-[200px] flex-1 sm:w-64 sm:flex-initial">
                    <MagnifyingGlass
                      size={13}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    />
                    <input
                      type="text"
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      placeholder="Search target, scan ID, standard…"
                      className="h-8 w-full rounded-sm border border-input bg-background pl-8 pr-7 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-accent"
                    />
                    {historySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setHistorySearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Purge All Action */}
                  {allHistoryItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllHistory}
                      className="inline-flex items-center gap-1.5 h-8 rounded-sm border border-destructive/30 bg-destructive/10 px-2.5 font-mono text-[10px] font-bold text-destructive hover:bg-destructive/20 transition-colors"
                      title="Clear locally cached history; cloud records are kept"
                    >
                      <Trash size={12} weight="bold" />
                      <span>Clear Local History</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Empty States */}
              {allHistoryItems.length === 0 ? (
                <div className="rounded-sm border-2 border-dashed border-border/80 bg-background/40 p-8 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground">
                    <Archive size={26} weight="duotone" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">No Audits Recorded</h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
                      Upload and audit a project archive above. Completed assessments and compliance
                      attestations will appear here.
                    </p>
                  </div>
                </div>
              ) : filteredHistoryItems.length === 0 ? (
                <div className="rounded-sm border border-border bg-background/50 p-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    No audit records matching query{" "}
                    <span className="font-mono text-foreground font-bold">
                      "{historySearchQuery}"
                    </span>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery("")}
                    className="font-mono text-xs text-accent hover:underline font-bold"
                  >
                    Clear Filter
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table View (lg+) */}
                  <div className="hidden lg:block overflow-x-auto rounded-sm border border-border">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border bg-secondary/50 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          <th className="py-2.5 px-3.5">Target & Archive</th>
                          <th className="py-2.5 px-3">Health Posture</th>
                          <th className="py-2.5 px-3">Findings Triage</th>
                          <th className="py-2.5 px-3">Compliance Frameworks</th>
                          <th className="py-2.5 px-3">Audited At</th>
                          <th className="py-2.5 px-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-mono text-xs">
                        {filteredHistoryItems.map((item) => {
                          const isRestoring = isRestoringAuditId === item.id;
                          const isDownloadingThis = downloadingHistoryId === item.id;
                          const { relative, exact } = formatAuditDate(item.completedAt);

                          return (
                            <tr
                              key={item.id}
                              className="bg-card hover:bg-secondary/30 transition-colors group"
                            >
                              {/* Target & Archive */}
                              <td className="py-3 px-3.5 align-middle">
                                <div className="flex items-start gap-2.5">
                                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary/60 text-foreground">
                                    <Archive size={14} weight="duotone" className="text-accent" />
                                  </div>
                                  <div className="min-w-0">
                                    <p
                                      className="font-bold text-foreground text-xs truncate max-w-[280px] xl:max-w-[420px]"
                                      title={item.targetName}
                                    >
                                      {item.targetName}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                                      <span>ID: {item.id.slice(0, 10)}…</span>
                                      {item.fileName && <span>· {item.fileName}</span>}
                                      {item.fileSizeBytes ? (
                                        <span>
                                          ({(item.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB)
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Health Posture */}
                              <td className="py-3 px-3 align-middle">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "inline-flex items-center justify-center font-mono text-xs font-black px-2 py-0.5 rounded-sm border tabular-nums",
                                      item.healthScore >= 80
                                        ? "text-success border-success/30 bg-success/10"
                                        : item.healthScore >= 60
                                          ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                                          : "text-destructive border-destructive/30 bg-destructive/10",
                                    )}
                                  >
                                    {item.healthScore}/100
                                  </span>
                                  <span className="text-[11px] font-medium text-foreground/80">
                                    {riskPosture({
                                      critical: item.criticalCount,
                                      high: item.highCount,
                                      medium: item.mediumCount,
                                      low: item.lowCount,
                                    })}{" "}
                                    Risk
                                  </span>
                                </div>
                              </td>

                              {/* Findings Triage */}
                              <td className="py-3 px-3 align-middle">
                                {item.findingsCount === 0 ? (
                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-success border border-success/30 bg-success/10 px-2 py-0.5 rounded-sm">
                                    <CheckCircle size={11} weight="fill" />0 Flaws · Secure
                                  </span>
                                ) : (
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                                      {item.criticalCount > 0 && (
                                        <span className="rounded-xs border border-destructive/30 bg-destructive/15 px-1.5 py-0.2 font-bold text-destructive">
                                          {item.criticalCount} Crit
                                        </span>
                                      )}
                                      {item.highCount > 0 && (
                                        <span className="rounded-xs border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.2 font-bold text-amber-500">
                                          {item.highCount} High
                                        </span>
                                      )}
                                      {item.mediumCount > 0 && (
                                        <span className="rounded-xs border border-yellow-500/30 bg-yellow-500/15 px-1.5 py-0.2 font-bold text-yellow-600 dark:text-yellow-400">
                                          {item.mediumCount} Med
                                        </span>
                                      )}
                                      {item.lowCount > 0 && (
                                        <span className="rounded-xs border border-blue-500/30 bg-blue-500/15 px-1.5 py-0.2 font-bold text-blue-500">
                                          {item.lowCount} Low
                                        </span>
                                      )}
                                      <span className="text-[10px] text-muted-foreground ml-1">
                                        ({item.findingsCount} total)
                                      </span>
                                    </div>

                                    {/* Mini Segmented Distribution Sparkbar */}
                                    <div className="flex h-1.5 w-full max-w-[170px] overflow-hidden rounded-xs bg-secondary/80 border border-border/50">
                                      {item.criticalCount > 0 && (
                                        <div
                                          style={{
                                            width: `${(item.criticalCount / item.findingsCount) * 100}%`,
                                          }}
                                          className="bg-destructive"
                                          title={`${item.criticalCount} Critical`}
                                        />
                                      )}
                                      {item.highCount > 0 && (
                                        <div
                                          style={{
                                            width: `${(item.highCount / item.findingsCount) * 100}%`,
                                          }}
                                          className="bg-amber-500"
                                          title={`${item.highCount} High`}
                                        />
                                      )}
                                      {item.mediumCount > 0 && (
                                        <div
                                          style={{
                                            width: `${(item.mediumCount / item.findingsCount) * 100}%`,
                                          }}
                                          className="bg-yellow-500"
                                          title={`${item.mediumCount} Medium`}
                                        />
                                      )}
                                      {item.lowCount > 0 && (
                                        <div
                                          style={{
                                            width: `${(item.lowCount / item.findingsCount) * 100}%`,
                                          }}
                                          className="bg-blue-500"
                                          title={`${item.lowCount} Low`}
                                        />
                                      )}
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Compliance Frameworks */}
                              <td className="py-3 px-3 align-middle">
                                <div className="flex flex-wrap gap-1 max-w-[320px]">
                                  {item.frameworks && item.frameworks.length > 0 ? (
                                    item.frameworks.map((fw) => (
                                      <span
                                        key={fw}
                                        className="rounded-xs border border-border bg-secondary/80 px-1.5 py-0.2 text-[9px] font-bold text-foreground/80 uppercase"
                                      >
                                        {fw.replace("_", " ")}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground italic">
                                      Baseline audit
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Audited At */}
                              <td className="py-3 px-3 align-middle">
                                <div title={exact}>
                                  <span className="font-mono text-xs text-foreground block">
                                    {relative}
                                  </span>
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {new Date(item.completedAt).toLocaleDateString("en-CA")}
                                  </span>
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-3.5 align-middle text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {/* View / Restore Audit */}
                                  <button
                                    type="button"
                                    onClick={() => void handleRestoreHistoryAudit(item)}
                                    disabled={isRestoring}
                                    className="inline-flex items-center gap-1 rounded-sm border border-foreground/20 bg-foreground px-2.5 py-1 text-[11px] font-bold text-background hover:bg-foreground/90 transition-colors shadow-xs"
                                    title="Restore full audit report and findings scorecard"
                                  >
                                    {isRestoring ? (
                                      <CircleNotch size={12} className="animate-spin" />
                                    ) : (
                                      <Eye size={12} weight="bold" />
                                    )}
                                    <span>{isRestoring ? "Loading…" : "Inspect"}</span>
                                  </button>

                                  {/* Download PDF */}
                                  <button
                                    type="button"
                                    onClick={(e) => void handleDownloadHistoryReport(e, item)}
                                    disabled={isDownloadingThis}
                                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary transition-colors"
                                    title="Download audit PDF report"
                                  >
                                    {isDownloadingThis ? (
                                      <CircleNotch size={12} className="animate-spin text-accent" />
                                    ) : (
                                      <DownloadSimple size={12} />
                                    )}
                                    <span>PDF</span>
                                  </button>

                                  {/* Delete Record */}
                                  <button
                                    type="button"
                                    onClick={(e) => void handleDeleteHistoryItem(e, item.id)}
                                    className="inline-flex items-center justify-center h-6 w-6 rounded-sm border border-border bg-card text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                    title="Delete from history ledger"
                                  >
                                    <Trash size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile & Tablet Card View (<lg) */}
                  <div className="lg:hidden space-y-3">
                    {filteredHistoryItems.map((item) => {
                      const isRestoring = isRestoringAuditId === item.id;
                      const isDownloadingThis = downloadingHistoryId === item.id;
                      const { relative, exact } = formatAuditDate(item.completedAt);

                      return (
                        <div
                          key={item.id}
                          className="rounded-sm border border-border bg-card p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-border/70 pb-3">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Archive
                                  size={14}
                                  weight="duotone"
                                  className="text-accent shrink-0"
                                />
                                <h4 className="font-bold text-foreground text-xs">
                                  {item.targetName}
                                </h4>
                              </div>
                              <p
                                className="font-mono text-[10px] text-muted-foreground mt-0.5"
                                title={exact}
                              >
                                {relative} · ID: {item.id.slice(0, 10)}…
                              </p>
                            </div>

                            <span
                              className={cn(
                                "inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded-sm border shrink-0",
                                item.healthScore >= 80
                                  ? "text-success border-success/30 bg-success/10"
                                  : item.healthScore >= 60
                                    ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                                    : "text-destructive border-destructive/30 bg-destructive/10",
                              )}
                            >
                              {item.healthScore}/100
                            </span>
                          </div>

                          {/* Severity and Framework Badges */}
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                              {item.findingsCount === 0 ? (
                                <span className="text-success font-bold flex items-center gap-1">
                                  <CheckCircle size={11} weight="fill" /> 0 Flaws Identified
                                </span>
                              ) : (
                                <>
                                  {item.criticalCount > 0 && (
                                    <span className="rounded-xs border border-destructive/30 bg-destructive/15 px-1.5 py-0.2 font-bold text-destructive">
                                      {item.criticalCount} Crit
                                    </span>
                                  )}
                                  {item.highCount > 0 && (
                                    <span className="rounded-xs border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.2 font-bold text-amber-500">
                                      {item.highCount} High
                                    </span>
                                  )}
                                  {item.mediumCount > 0 && (
                                    <span className="rounded-xs border border-yellow-500/30 bg-yellow-500/15 px-1.5 py-0.2 font-bold text-yellow-600 dark:text-yellow-400">
                                      {item.mediumCount} Med
                                    </span>
                                  )}
                                  {item.lowCount > 0 && (
                                    <span className="rounded-xs border border-blue-500/30 bg-blue-500/15 px-1.5 py-0.2 font-bold text-blue-500">
                                      {item.lowCount} Low
                                    </span>
                                  )}
                                  <span className="text-muted-foreground text-[10px]">
                                    ({item.findingsCount} total)
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Mini Distribution Bar in Mobile Card */}
                            {item.findingsCount > 0 && (
                              <div className="flex h-1.5 w-full overflow-hidden rounded-xs bg-secondary/80 border border-border/50">
                                {item.criticalCount > 0 && (
                                  <div
                                    style={{
                                      width: `${(item.criticalCount / item.findingsCount) * 100}%`,
                                    }}
                                    className="bg-destructive"
                                  />
                                )}
                                {item.highCount > 0 && (
                                  <div
                                    style={{
                                      width: `${(item.highCount / item.findingsCount) * 100}%`,
                                    }}
                                    className="bg-amber-500"
                                  />
                                )}
                                {item.mediumCount > 0 && (
                                  <div
                                    style={{
                                      width: `${(item.mediumCount / item.findingsCount) * 100}%`,
                                    }}
                                    className="bg-yellow-500"
                                  />
                                )}
                                {item.lowCount > 0 && (
                                  <div
                                    style={{
                                      width: `${(item.lowCount / item.findingsCount) * 100}%`,
                                    }}
                                    className="bg-blue-500"
                                  />
                                )}
                              </div>
                            )}

                            {item.frameworks && item.frameworks.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.frameworks.map((fw) => (
                                  <span
                                    key={fw}
                                    className="rounded-xs border border-border bg-secondary/80 px-1.5 py-0.2 text-[9px] font-bold text-foreground/80 uppercase"
                                  >
                                    {fw.replace("_", " ")}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-12 gap-2 pt-1 border-t border-border/60">
                            <button
                              type="button"
                              onClick={() => void handleRestoreHistoryAudit(item)}
                              disabled={isRestoring}
                              className="col-span-7 inline-flex items-center justify-center gap-1.5 rounded-sm border border-foreground/20 bg-foreground py-1.5 text-xs font-bold text-background hover:bg-foreground/90 transition-colors"
                            >
                              {isRestoring ? (
                                <CircleNotch size={13} className="animate-spin" />
                              ) : (
                                <Eye size={13} weight="bold" />
                              )}
                              <span>{isRestoring ? "Loading…" : "Inspect Audit"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => void handleDownloadHistoryReport(e, item)}
                              disabled={isDownloadingThis}
                              className="col-span-3 inline-flex items-center justify-center gap-1 rounded-sm border border-border bg-card py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                            >
                              {isDownloadingThis ? (
                                <CircleNotch size={13} className="animate-spin text-accent" />
                              ) : (
                                <DownloadSimple size={13} />
                              )}
                              <span>PDF</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => void handleDeleteHistoryItem(e, item.id)}
                              className="col-span-2 inline-flex items-center justify-center rounded-sm border border-border bg-card py-1.5 text-xs text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
                              title="Delete record"
                            >
                              <Trash size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PHASE 2: REAL-TIME AUDIT TELEMETRY (DURING SCANNING)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {(phase === "uploading" || phase === "scanning") && !reportScan && (
          <ScanAnimation
            progress={currentProgress}
            events={events.map((event, index) => ({
              sequence: index + 1,
              step: event.step,
              label: event.label,
              progress: event.progress,
              at: "",
            }))}
            elapsed={elapsedSeconds}
            name={targetName || selectedFile?.name || "Your project"}
          />
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PHASE 3: ERROR STATE
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {phase === "error" && (
          <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-8 text-center space-y-3">
            <WarningCircle size={40} weight="duotone" className="mx-auto text-destructive" />
            <h3 className="text-base font-bold text-destructive">Codebase Audit Halted</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              {error || "An unexpected error occurred while executing the security scanner."}
            </p>
            <div className="pt-2">
              <BrutalButton onClick={reset} size="sm" variant="ghost">
                <ArrowClockwise size={14} />
                Reset and Try Again
              </BrutalButton>
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PHASE 4: POST-SCAN DETAILED ANALYSIS (AFTER SCANNING)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {phase === "done" && result && (
          <div className="space-y-6 min-w-0 w-full">
            <div
              role="note"
              className="rounded-sm border border-border bg-secondary/40 p-4 text-xs leading-relaxed text-muted-foreground"
            >
              <p className="font-semibold text-foreground">
                Automated review — validate findings before remediation
              </p>
              {result.analysis ? (
                <p className="mt-1">
                  {result.analysis.files_scanned} files scanned · {result.analysis.files_truncated}{" "}
                  files truncated ·{" "}
                  {result.analysis.mode === "static_and_ai"
                    ? "Static rules + source-backed AI suggestions"
                    : "Static rules"}
                  .
                </p>
              ) : (
                <p className="mt-1">Coverage details were not recorded for this older audit.</p>
              )}
              <p className="mt-1">
                {result.analysis?.limitations.join(" ") ||
                  "No findings does not prove the project is secure. Scores and compliance mappings are review estimates, not certification."}
              </p>
            </div>

            {/* 1. EXECUTIVE POSTURE SCORECARD */}
            <div className="rounded-sm border border-border bg-card p-5 sm:p-6 space-y-5 min-w-0 w-full">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border pb-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-success uppercase tracking-wider">
                      // AUDIT EXECUTION COMPLETED
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      · {result.generated_at}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[9px] text-muted-foreground border border-border bg-secondary/50 px-1.5 py-0.2 rounded-xs">
                      <Clock size={10} className="text-accent" />
                      Session Preserved
                    </span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight mt-1 text-foreground">
                    {result.target_name}
                  </h2>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    Scan ID: {result.scan_id.slice(0, 13)}… // Audited against{" "}
                    {result.frameworks.length} compliance standard
                    {result.frameworks.length > 1 ? "s" : ""}
                  </p>
                </div>

                {/* Score & Posture Badge */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                      Codebase Health Index
                    </span>
                    <span
                      className={cn(
                        "font-mono text-2xl font-black tabular-nums",
                        securityHealthScore >= 80
                          ? "text-success"
                          : securityHealthScore >= 60
                            ? "text-amber-500"
                            : "text-destructive",
                      )}
                    >
                      {securityHealthScore} / 100
                    </span>
                  </div>

                  <div
                    className={cn(
                      "flex flex-col items-center justify-center rounded-sm border px-4 py-2 font-mono",
                      result.summary.overall_posture === "Critical"
                        ? "border-destructive/40 bg-destructive/15 text-destructive"
                        : result.summary.overall_posture === "High"
                          ? "border-amber-500/40 bg-amber-500/15 text-amber-500"
                          : "border-success/40 bg-success/15 text-success",
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Security Posture
                    </span>
                    <span className="text-sm font-black uppercase tracking-tight">
                      {result.summary.overall_posture} Risk
                    </span>
                  </div>
                </div>
              </div>

              {/* Severity Metrics Strip (Clickable Filters) */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["critical", "high", "medium", "low"] as const).map((sev) => {
                  const count = result.severity_counts?.[sev] || 0;
                  const isSelected = severityFilter === sev;
                  const sevStyle = SEV_BADGE_STYLE[sev];

                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverityFilter(isSelected ? "all" : sev)}
                      aria-pressed={isSelected}
                      aria-label={`Filter ${sev} severity (${count} findings)`}
                      className={cn(
                        "flex items-center justify-between rounded-sm border p-3.5 transition-all text-left",
                        isSelected
                          ? "ring-2 ring-foreground border-foreground bg-secondary"
                          : "border-border bg-background hover:bg-secondary/40",
                      )}
                    >
                      <div>
                        <span
                          className={cn(
                            "inline-block rounded px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase border",
                            sevStyle,
                          )}
                        >
                          {sev}
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-1">Vulnerabilities</p>
                      </div>
                      <span className="font-mono text-2xl font-black tabular-nums text-foreground">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Risk Headline Callout */}
              {result.summary.risk_headline && (
                <div className="mt-5 flex items-start gap-3 rounded-sm border border-destructive/30 bg-destructive/10 p-3.5">
                  <Warning size={17} weight="fill" className="mt-0.5 shrink-0 text-destructive" />
                  <div>
                    <h4 className="text-xs font-bold text-destructive uppercase tracking-wide">
                      Executive Risk Warning
                    </h4>
                    <p className="text-xs text-foreground/90 mt-0.5 leading-relaxed font-medium">
                      {result.summary.risk_headline}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. SECURITY TELEMETRY & VISUAL RISK ANALYTICS */}
            <AuditAnalytics
              result={analyticsResult || result}
              healthScore={securityHealthScore}
              onFilterSeverity={setSeverityFilter}
              onFilterFramework={setFrameworkFilter}
            />

            {/* 3. REGULATORY COMPLIANCE SCORECARD */}
            {Object.keys(result.framework_scores).length > 0 && (
              <div className="rounded-sm border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardText size={16} weight="duotone" className="text-accent" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Regulatory Compliance Breakdown
                    </h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Click a framework to filter findings below
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {Object.entries(result.framework_scores).map(([fwKey, score]) => {
                    const isSelected =
                      frameworkFilter.toLowerCase().replace(/[-_\s]/g, "") ===
                      fwKey.toLowerCase().replace(/[-_\s]/g, "");
                    const isPassing = score >= 80;

                    return (
                      <button
                        key={fwKey}
                        type="button"
                        onClick={() => setFrameworkFilter(isSelected ? "all" : fwKey)}
                        className={cn(
                          "rounded-sm border p-3.5 text-left transition-all",
                          isSelected
                            ? "border-accent ring-2 ring-accent/30 bg-accent/5"
                            : "border-border bg-background hover:bg-secondary/40",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold uppercase text-foreground">
                            {fwKey.replace("_", " ")}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-xs font-black tabular-nums",
                              isPassing
                                ? "text-success"
                                : score >= 60
                                  ? "text-amber-500"
                                  : "text-destructive",
                            )}
                          >
                            {score}%
                          </span>
                        </div>

                        {/* Meter */}
                        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full transition-all duration-500",
                              isPassing
                                ? "bg-success"
                                : score >= 60
                                  ? "bg-amber-500"
                                  : "bg-destructive",
                            )}
                            style={{ width: `${score}%` }}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Status</span>
                          <span
                            className={cn(
                              "font-mono font-bold uppercase",
                              isPassing ? "text-success" : "text-destructive",
                            )}
                          >
                            {isPassing ? "Estimate — review" : "Review needed"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. EXECUTIVE SUMMARY & ACTION ROADMAP */}
            {result.summary.summary && (
              <div className="rounded-sm border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <ShieldCheck size={16} weight="duotone" className="text-accent" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Executive Audit Assessment & Priorities
                  </h3>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground font-normal">
                  {result.summary.summary}
                </p>

                {result.summary.top_priorities && result.summary.top_priorities.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground block">
                      Immediate Engineering Action Items
                    </span>
                    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                      {result.summary.top_priorities.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 rounded-sm border border-border bg-background p-2.5"
                        >
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-accent/15 font-mono text-[10px] font-bold text-accent">
                            {idx + 1}
                          </div>
                          <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                            {item}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. INTERACTIVE FINDINGS EXPLORER */}
            <div className="rounded-sm border border-border bg-card overflow-hidden">
              {/* Toolbar */}
              <div className="border-b border-border p-4 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Bug size={16} weight="duotone" className="text-destructive" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Security Findings
                    </h3>
                    <span className="rounded border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
                      {filteredFindings.length} of {result.findings.length}
                    </span>
                  </div>

                  {/* Active Filter Clear Tag */}
                  {(severityFilter !== "all" || frameworkFilter !== "all" || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSeverityFilter("all");
                        setFrameworkFilter("all");
                        setSearchQuery("");
                      }}
                      className="text-[11px] text-accent hover:underline font-medium self-start sm:self-auto"
                    >
                      Reset all filters
                    </button>
                  )}
                </div>

                {/* Search Bar + Sort */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <MagnifyingGlass
                      size={14}
                      className="absolute left-3 top-3 text-muted-foreground"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter findings by title, file, CWE (e.g. CWE-89), or description…"
                      className="h-9 w-full rounded-sm border border-input bg-background pl-9 pr-3 font-mono text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-accent"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={13} className="text-muted-foreground shrink-0" />
                    <select
                      value={sortBy}
                      aria-label="Sort findings"
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="h-9 rounded-sm border border-input bg-background px-2.5 font-mono text-xs text-foreground outline-none focus:border-accent"
                    >
                      <option value="cvss-desc">Highest CVSS First</option>
                      <option value="severity-desc">Highest Severity First</option>
                      <option value="file-asc">File Path (A-Z)</option>
                    </select>
                  </div>
                </div>

                {/* Sub-tabs for Framework Filtering (Always accessible with real-time counts) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase mr-1 shrink-0">
                    Framework:
                  </span>
                  {frameworkFilterTabs.map((fw) => {
                    const isSelected =
                      fw.id === "all"
                        ? frameworkFilter === "all"
                        : frameworkFilter.toLowerCase().replace(/[-_\s]/g, "") ===
                          fw.id.toLowerCase().replace(/[-_\s]/g, "");
                    const count =
                      fw.id === "all"
                        ? groupedFindings.length
                        : (frameworkCounts[fw.id.toLowerCase().replace(/[-_\s]/g, "")] ?? 0);

                    return (
                      <button
                        key={fw.id}
                        type="button"
                        onClick={() =>
                          setFrameworkFilter(isSelected && fw.id !== "all" ? "all" : fw.id)
                        }
                        className={cn(
                          "flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase transition-colors shrink-0 cursor-pointer",
                          isSelected
                            ? "bg-accent text-white shadow-xs"
                            : "bg-secondary text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span>{fw.label}</span>
                        <span
                          className={cn(
                            "rounded px-1 text-[9px] font-mono",
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-background/80 text-muted-foreground",
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Findings List */}
              {filteredFindings.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground">
                  <MagnifyingGlass size={24} className="mx-auto mb-2 opacity-50" />
                  No security findings matched your current filters.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredFindings.slice(0, visibleFindingCount).map((finding) => {
                    const findingKey = findingIdentity(finding);
                    const isExpanded = expandedFindingKey === findingKey;
                    const sevStyle = SEV_BADGE_STYLE[finding.severity] || SEV_BADGE_STYLE.medium;
                    const affectedFiles =
                      finding.affected_files && finding.affected_files.length > 0
                        ? finding.affected_files
                        : [
                            {
                              file_path: finding.file_path || "source",
                              line_number: finding.line_number,
                            },
                          ];
                    // Use pre-computed violations from the groupedFindings memo (no re-computation per render)
                    const violations = finding.violations ?? [];

                    return (
                      <div
                        key={findingKey}
                        className={cn(
                          "transition-colors",
                          isExpanded ? "bg-secondary/20" : "hover:bg-secondary/10",
                        )}
                      >
                        {/* Summary Row */}
                        <button
                          type="button"
                          onClick={() => setExpandedFindingKey(isExpanded ? null : findingKey)}
                          aria-expanded={isExpanded}
                          className="flex w-full items-start gap-3 p-4 text-left transition-colors cursor-pointer"
                        >
                          <span
                            className={cn(
                              "mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase border",
                              sevStyle,
                            )}
                          >
                            {finding.severity}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-xs font-bold text-foreground truncate">
                                {finding.title}
                              </h4>
                              {finding.cwe_id && (
                                <span className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                  {finding.cwe_id}
                                </span>
                              )}
                              {affectedFiles.length > 1 && (
                                <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                                  {affectedFiles.length} files affected
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {finding.description}
                            </p>

                            {/* Compliance badges in summary row */}
                            {violations.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                                  Maps to:
                                </span>
                                {[...new Set(violations.map((v) => v.framework.toUpperCase()))].map(
                                  (fw) => (
                                    <span
                                      key={fw}
                                      className="rounded border border-accent/25 bg-accent/8 px-1.5 py-px font-mono text-[9px] font-bold uppercase text-accent"
                                    >
                                      {fw.replace("_", " ")}
                                    </span>
                                  ),
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            {typeof finding.cvss_score === "number" &&
                              Number.isFinite(finding.cvss_score) && (
                                <span
                                  className={cn(
                                    "hidden sm:inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold",
                                    finding.cvss_score >= 9.0
                                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                                      : finding.cvss_score >= 7.0
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                                        : "border-border bg-secondary text-foreground",
                                  )}
                                >
                                  CVSS {finding.cvss_score.toFixed(1)}
                                </span>
                              )}

                            {finding.file_path && (
                              <span
                                className="hidden md:flex items-center gap-1 font-mono text-[10px] text-muted-foreground max-w-[220px] xl:max-w-[360px] truncate"
                                title={`${finding.file_path}${finding.line_number ? `:${finding.line_number}` : ""}`}
                              >
                                <Code size={11} />
                                {finding.file_path}
                                {finding.line_number ? `:${finding.line_number}` : ""}
                              </span>
                            )}

                            <CaretRight
                              size={14}
                              className={cn(
                                "text-muted-foreground transition-transform duration-200",
                                isExpanded && "rotate-90",
                              )}
                            />
                          </div>
                        </button>

                        {/* Deep-Dive Inspection Details */}
                        {isExpanded && (
                          <div className="border-t border-border px-5 py-4 space-y-4 bg-background/50">
                            {/* Metadata Pills */}
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              {finding.file_path && (
                                <div className="flex items-center gap-1.5 rounded-sm border border-border bg-secondary/60 px-2 py-1 font-mono text-[11px] text-foreground">
                                  <Code size={12} className="text-accent" />
                                  <span>{finding.file_path}</span>
                                  {finding.line_number && (
                                    <span className="text-muted-foreground">
                                      Line {finding.line_number}
                                    </span>
                                  )}
                                </div>
                              )}

                              {finding.cwe_id && (
                                <div className="rounded-sm border border-border bg-secondary/60 px-2 py-1 font-mono text-[11px] text-foreground">
                                  <span>Taxonomy: {finding.cwe_id}</span>
                                </div>
                              )}

                              {finding.cvss_vector && (
                                <div className="rounded-sm border border-border bg-secondary/60 px-2 py-1 font-mono text-[10px] text-muted-foreground truncate max-w-md">
                                  {finding.cvss_vector}
                                </div>
                              )}
                            </div>

                            {/* Affected Source Files & Lines (Aggregated Multi-File Locations) */}
                            {affectedFiles.length > 1 && (
                              <div className="space-y-1.5 rounded-sm border border-amber-500/20 bg-amber-500/5 p-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                    Affected Codebase Locations ({affectedFiles.length} files
                                    detected)
                                  </span>
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    Deduplicated vulnerability instance
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {affectedFiles.map((af, afIdx) => (
                                    <div
                                      key={afIdx}
                                      className="flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-foreground"
                                    >
                                      <Code size={12} className="text-accent shrink-0" />
                                      <span className="font-semibold text-foreground/90">
                                        {af.file_path}
                                      </span>
                                      {af.line_number && (
                                        <span className="text-amber-500 font-bold">
                                          :line {af.line_number}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Threat & Exploitability Description */}
                            <div className="space-y-1">
                              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Threat & Impact Assessment
                              </span>
                              <p className="text-xs leading-relaxed text-foreground/90 font-medium">
                                {finding.description}
                              </p>
                            </div>

                            {/* Vulnerable Source Code Viewer */}
                            {finding.code_snippet && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Vulnerable Code Snippet
                                  </span>
                                  <span className="font-mono text-[10px] text-destructive">
                                    // Offending line flagged by AST taint rule
                                  </span>
                                </div>
                                <CodePanel
                                  filename={finding.file_path || "source.py"}
                                  label={
                                    finding.line_number ? `Line ${finding.line_number}` : undefined
                                  }
                                  variant="evidence"
                                >
                                  <pre className="p-3 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap">
                                    {finding.code_snippet}
                                  </pre>
                                </CodePanel>
                              </div>
                            )}

                            {/* Violated Compliance Controls & Regulatory Acts */}
                            {violations.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Violated Compliance Controls & Regulatory Acts (
                                    {violations.length})
                                  </span>
                                  <span className="font-mono text-[10px] text-accent">
                                    Audited against statutory baselines
                                  </span>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {violations.map((v, vIdx) => {
                                    const fwColors: Record<string, string> = {
                                      gdpr: "border-blue-500/30 bg-blue-500/10 text-blue-500",
                                      soc2: "border-purple-500/30 bg-purple-500/10 text-purple-500",
                                      iso27001:
                                        "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
                                      pci_dss: "border-amber-500/30 bg-amber-500/10 text-amber-500",
                                      nist_csf: "border-cyan-500/30 bg-cyan-500/10 text-cyan-500",
                                    };
                                    const colorStyle =
                                      fwColors[v.framework.toLowerCase().replace(/[-_\s]/g, "")] ||
                                      "border-accent/30 bg-accent/10 text-accent";

                                    return (
                                      <div
                                        key={vIdx}
                                        className="flex flex-col gap-1 rounded-sm border border-border bg-card p-3 text-xs"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span
                                            className={cn(
                                              "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase border",
                                              colorStyle,
                                            )}
                                          >
                                            {v.framework.replace("_", " ")}
                                          </span>
                                          <span className="font-mono text-[11px] font-bold text-foreground">
                                            {v.control_id}
                                          </span>
                                        </div>
                                        <div className="font-semibold text-foreground/90 text-xs mt-0.5">
                                          {v.control_title}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">
                                          <span className="font-bold text-foreground/75">
                                            {v.act_name || getFrameworkActName(v.framework)}:
                                          </span>{" "}
                                          {v.requirement || v.control_title}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Remediation Guide */}
                            {finding.remediation_steps && finding.remediation_steps.length > 0 && (
                              <div className="space-y-2 pt-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
                                    Remediation Blueprint & Prescribed Actions
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyRemediation(
                                        findingKey,
                                        finding.remediation_steps!.join("\n"),
                                      )
                                    }
                                    className="inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:underline cursor-pointer"
                                  >
                                    {copiedFindingKey === findingKey ? (
                                      <>
                                        <Check size={12} className="text-success" />
                                        <span className="text-success">Copied to clipboard</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={12} />
                                        <span>Copy fix instructions</span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                <div className="space-y-1.5">
                                  {finding.remediation_steps.map((step, sIdx) => (
                                    <div
                                      key={sIdx}
                                      className="flex items-start gap-2.5 rounded-sm border border-border bg-card p-2.5 text-xs text-foreground/90"
                                    >
                                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent/15 font-mono text-[9px] font-bold text-accent">
                                        {sIdx + 1}
                                      </span>
                                      <span className="leading-relaxed">{step}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {visibleFindingCount < filteredFindings.length && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Showing {Math.min(visibleFindingCount, filteredFindings.length)} of{" "}
                  {filteredFindings.length} matching findings
                </span>
                <BrutalButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setVisibleFindingCount((count) => count + 50)}
                >
                  Show 50 more findings
                </BrutalButton>
              </div>
            )}

            {/* Bottom PDF Download Banner */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-sm border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-accent/15 border border-accent/30 text-accent">
                  <FilePdf size={22} weight="duotone" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Audit Findings & PDF Report
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Includes cryptographic integrity hash, methodology breakdown, CVSS tables, and
                    full control matrices.
                  </p>
                </div>
              </div>

              <BrutalButton
                onClick={() => void handleDownload()}
                disabled={isDownloading}
                size="sm"
                className="shrink-0"
              >
                {isDownloading ? (
                  <CircleNotch size={14} className="animate-spin" />
                ) : (
                  <FilePdf size={14} weight="duotone" />
                )}
                {isDownloading ? "Generating PDF…" : "Download Audit PDF"}
              </BrutalButton>
            </div>

            {/* Historical Audit Ledger Link & Quick Switcher */}
            {allHistoryItems.length > 1 && (
              <div className="rounded-sm border border-border bg-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Archive size={16} weight="duotone" className="text-accent" />
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                        Previous Codebase Audits ({allHistoryItems.length})
                      </h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Switch between historical scan snapshots or initialize a fresh audit intake.
                    </p>
                  </div>
                  <BrutalButton onClick={reset} size="sm" variant="ghost">
                    <ArrowClockwise size={13} />
                    New Audit Intake
                  </BrutalButton>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {allHistoryItems
                    .filter((item) => item.id !== scanId)
                    .slice(0, 6)
                    .map((item) => {
                      const isRestoring = isRestoringAuditId === item.id;
                      const { relative } = formatAuditDate(item.completedAt);
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col justify-between rounded-sm border border-border bg-background/50 p-3 hover:bg-secondary/40 transition-colors"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-xs text-foreground truncate">
                                {item.targetName}
                              </p>
                              <span
                                className={cn(
                                  "font-mono text-[9px] font-bold px-1.5 py-0.2 rounded-xs border shrink-0",
                                  item.healthScore >= 80
                                    ? "text-success border-success/30 bg-success/10"
                                    : item.healthScore >= 60
                                      ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                                      : "text-destructive border-destructive/30 bg-destructive/10",
                                )}
                              >
                                {item.healthScore}/100
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground mt-1">
                              <span>{relative}</span>
                              <span>·</span>
                              <span>{item.findingsCount} findings</span>
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => void handleRestoreHistoryAudit(item)}
                              disabled={isRestoring}
                              className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-accent hover:underline"
                            >
                              {isRestoring ? (
                                <CircleNotch size={11} className="animate-spin" />
                              ) : (
                                <Eye size={11} />
                              )}
                              <span>Switch to this Audit →</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => void handleDeleteHistoryItem(e, item.id)}
                              className="text-muted-foreground hover:text-destructive p-0.5"
                              title="Delete"
                            >
                              <Trash size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
