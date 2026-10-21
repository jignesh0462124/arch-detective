import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DownloadSimple, FileText, MagnifyingGlass } from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { SectionCard } from "@/components/ui/section-card";
import { StatTile } from "@/components/ui/stat-tile";
import { ReportNotice, ReportDownloadStatus } from "@/components/reports/ReportUi";
import { REPORT_INPUT, FRAMEWORK_LABELS, frameworkLabel, reportDate } from "@/lib/reportView";
import { useReports, useReportDownloads } from "@/hooks/useReports";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import {
  loadLegacyReports,
  reportError,
  type ReportEntry,
  type ReportFilters,
} from "@/lib/api/reports";
import { downloadScanReport } from "@/lib/api/localScan";
import { ZIP_MAX_REPORTS } from "@/lib/reportExport";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports · Archon" },
      {
        name: "description",
        content: "Review saved audit evidence and download automated security reports.",
      },
    ],
  }),
  component: ReportsPage,
});
function ReportsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.replace(/\/$/, "") === "/reports" ? <ReportsLibraryPage /> : <Outlet />;
}
export function ReportsLibraryPage() {
  const auth = useAuth();
  const workspace = useActiveWorkspace();
  return (
    <AppShell title="Reports" subtitle="Saved audit evidence">
      {auth.isLoading || workspace.isLoading ? (
        <ReportNotice title="Loading your workspace…" />
      ) : workspace.isError ? (
        <ReportNotice
          title="Your workspaces could not be loaded."
          description="Refresh the page to retry."
        />
      ) : !auth.user ? (
        <ReportNotice title="Sign in to view reports." />
      ) : !workspace.active ? (
        <ReportNotice
          title="No workspace selected"
          description="Create or select a workspace to view completed audits."
        />
      ) : (
        <WorkspaceReports
          key={`${auth.user.id}:${workspace.active.id}`}
          user={auth.user.id}
          workspace={workspace.active.id}
        />
      )}
    </AppShell>
  );
}
export function WorkspaceReports({ user, workspace }: { user: string; workspace: string }) {
  const [filters, setFilters] = useState<ReportFilters>({ q: "", framework: "all" });
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [selected, setSelected] = useState<ReportEntry[]>([]);
  const reports = useReports(user, workspace, filters, cursors.at(-1) ?? null);
  const download = useReportDownloads(user, workspace);
  const cancelDownload = download.cancel;
  const [legacy] = useState(() => loadLegacyReports(workspace));
  const [legacyBusy, setLegacyBusy] = useState<string | null>(null);
  const [legacyMessage, setLegacyMessage] = useState("");
  useEffect(() => {
    if (reports.isError) cancelDownload();
  }, [reports.isError, cancelDownload]);
  function updateFilters(next: ReportFilters) {
    download.cancel();
    setFilters(next);
    setCursors([null]);
    setSelected([]);
  }
  async function legacyDownload(id: string) {
    const report = legacy.find((r) => r.scan_id === id);
    if (!report?.result) return;
    setLegacyBusy(id);
    setLegacyMessage("");
    try {
      await downloadScanReport(id, `archon-legacy-${id}.pdf`, report.result);
      setLegacyMessage(
        "Legacy download or print dialog opened. Saving is controlled by your browser.",
      );
    } catch {
      setLegacyMessage("The legacy report could not be opened. Retry from Codebase Audit history.");
    } finally {
      setLegacyBusy(null);
    }
  }
  return (
    <div className="space-y-5">
      <SectionCard
        eyebrow="Report library"
        title="Understand your audit. Share the evidence."
        description="Reports use completed, saved scan results. PDFs are prepared when downloaded; no scan or model analysis is rerun."
        actions={
          <Link
            to="/workspace"
            className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Run Codebase Audit
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Automated findings and framework mappings support your review. They are not signed
          attestations or compliance certificates.
        </p>
      </SectionCard>
      <div className="grid grid-cols-3 divide-x divide-border rounded-sm hairline bg-card">
        <StatTile
          label="Available reports"
          value={reports.isError ? "—" : (reports.data?.available_total ?? "—")}
          icon={<FileText size={16} />}
        />
        <StatTile
          icon={<MagnifyingGlass size={16} />}
          label="Matching results"
          value={reports.isError ? "—" : (reports.data?.total ?? "—")}
        />
        <StatTile
          label="Selected for ZIP"
          icon={<DownloadSimple size={16} />}
          value={selected.length}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-sm hairline bg-card p-4">
        <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1.5 text-xs font-medium">
          Search project or scan ID
          <div className="relative">
            <MagnifyingGlass
              size={16}
              className="pointer-events-none absolute left-3 top-3 text-muted-foreground"
            />
            <input
              type="search"
              maxLength={150}
              value={filters.q}
              onChange={(e) => updateFilters({ ...filters, q: e.target.value })}
              className={`${REPORT_INPUT} w-full pl-9`}
              placeholder="Project name or full scan ID"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium">
          Assessed framework
          <select
            value={filters.framework}
            onChange={(e) => updateFilters({ ...filters, framework: e.target.value })}
            className={REPORT_INPUT}
          >
            <option value="all">All frameworks</option>
            {Object.entries(FRAMEWORK_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <BrutalButton
          variant="secondary"
          onClick={() => updateFilters({ q: "", framework: "all" })}
        >
          Reset
        </BrutalButton>
      </div>
      <ReportDownloadStatus download={download} />
      <SectionCard
        title="Completed audits"
        description="Newest first · 25 per page. Selection is retained across pages, up to 20 reports / 50 MiB."
        actions={
          <>
            <BrutalButton
              variant="secondary"
              size="sm"
              disabled={!selected.length || !!download.busy}
              onClick={() => setSelected([])}
            >
              Clear selection
            </BrutalButton>
            <BrutalButton
              size="sm"
              disabled={!selected.length || !!download.busy || reports.isError}
              onClick={() => void download.run(selected, true)}
            >
              <DownloadSimple size={16} />
              Download selected ZIP
            </BrutalButton>
          </>
        }
        padding="none"
      >
        {reports.isPending ? (
          <div className="p-5" role="status">
            Loading completed audits…
          </div>
        ) : reports.isError ? (
          <ReportNotice title={reportError(reports.error)} retry={() => void reports.refetch()} />
        ) : !reports.data.available_total ? (
          <ReportNotice
            title="No completed audits available"
            description="Complete Codebase Audit to create a report. Running scans are not reported as clean."
            audit
          />
        ) : !reports.data.items.length ? (
          <ReportNotice
            title="No matching reports"
            description="Try a different project name or reset the filters."
          />
        ) : (
          <>
            <div
              className="hidden grid-cols-[32px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_160px] gap-4 border-b border-border bg-secondary px-5 py-3 text-xs font-medium text-muted-foreground lg:grid"
              aria-hidden="true"
            >
              <span />
              <span>Project / audit date</span>
              <span>Findings</span>
              <span>Frameworks</span>
              <span>Actions</span>
            </div>
            <ul>
              {reports.data.items.map((report) => {
                const checked = selected.some((s) => s.id === report.id);
                return (
                  <li
                    key={report.id}
                    className="grid min-w-0 gap-4 border-b border-border p-5 last:border-b-0 lg:grid-cols-[32px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_160px] lg:items-center"
                  >
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        aria-label={`Select ${report.target_name}`}
                        checked={checked}
                        disabled={
                          !!download.busy || (!checked && selected.length >= ZIP_MAX_REPORTS)
                        }
                        onChange={() =>
                          setSelected(
                            checked
                              ? selected.filter((s) => s.id !== report.id)
                              : [...selected, report],
                          )
                        }
                        className="size-4 accent-primary"
                      />
                      <span className="lg:hidden">Select for ZIP</span>
                    </label>
                    <div className="min-w-0">
                      <Link
                        to="/reports/$reportId"
                        params={{ reportId: report.id }}
                        className="break-words font-medium hover:underline"
                      >
                        {report.target_name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reportDate(report.completed_at || report.created_at)}
                      </p>
                      <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                        {report.id}
                      </p>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold tabular-nums">{report.counts.total}</span>{" "}
                      findings
                      <p className="mt-1 text-xs text-muted-foreground">
                        {report.counts.severity.critical ?? 0} critical ·{" "}
                        {report.counts.severity.high ?? 0} high
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {report.selected_frameworks.length ? (
                        report.selected_frameworks.map((fw) => (
                          <span
                            key={fw}
                            className="rounded-sm border border-border px-1.5 py-1 text-[10px] font-medium"
                          >
                            {frameworkLabel(fw)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Not recorded</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/reports/$reportId"
                        params={{ reportId: report.id }}
                        aria-label={`View report for ${report.target_name}`}
                        className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-[13px] font-medium hover:bg-secondary"
                      >
                        View
                      </Link>
                      <BrutalButton
                        size="sm"
                        disabled={!!download.busy}
                        onClick={() => void download.run([report], false)}
                        aria-label={`Download PDF for ${report.target_name}`}
                      >
                        <DownloadSimple size={16} />
                        PDF
                      </BrutalButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {reports.isSuccess && (reports.data.total > 25 || cursors.length > 1) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
            <span className="text-xs text-muted-foreground">
              Page {cursors.length} · {reports.data.total} matching reports
            </span>
            <div className="flex gap-2">
              <BrutalButton
                size="sm"
                variant="secondary"
                disabled={cursors.length === 1}
                onClick={() => setCursors(cursors.slice(0, -1))}
              >
                Previous
              </BrutalButton>
              <BrutalButton
                size="sm"
                variant="secondary"
                disabled={!reports.data.next_cursor || reports.isFetching}
                onClick={() => setCursors([...cursors, reports.data.next_cursor])}
              >
                Next
              </BrutalButton>
            </div>
          </div>
        )}
      </SectionCard>
      {!!legacy.length && (
        <SectionCard
          title="Browser-only legacy reports"
          description="Older local audits on this browser. Not verified against saved workspace evidence; excluded from library totals and ZIP exports."
        >
          <ul className="space-y-3">
            {legacy.map((report) => (
              <li
                key={report.scan_id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <span className="min-w-0 break-words text-sm">
                  {report.target_name || "Local audit"} · {reportDate(report.generated_at)}
                </span>
                <BrutalButton
                  variant="secondary"
                  size="sm"
                  disabled={!!legacyBusy}
                  onClick={() => void legacyDownload(report.scan_id)}
                >
                  {legacyBusy === report.scan_id ? "Opening…" : "Open legacy PDF / print"}
                </BrutalButton>
              </li>
            ))}
          </ul>
          {legacyMessage && (
            <p role="status" className="mt-3 text-sm">
              {legacyMessage}
            </p>
          )}
        </SectionCard>
      )}
    </div>
  );
}
