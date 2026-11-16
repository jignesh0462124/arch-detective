import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, DownloadSimple } from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { SectionCard } from "@/components/ui/section-card";
import { StatTile } from "@/components/ui/stat-tile";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { CodePanel } from "@/components/ui/code-panel";
import { Coverage, ReportNotice, ReportDownloadStatus } from "@/components/reports/ReportUi";
import { frameworkLabel, reportDate } from "@/lib/reportView";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useReport, useReportDownloads } from "@/hooks/useReports";
import { reportError, type ReportPreview } from "@/lib/api/reports";
import { getFindingPage, getQueueFinding } from "@/lib/api/findingQueue";
import { formatCvss, stateLabel } from "@/lib/findingView";

export const Route = createFileRoute("/_app/reports/$reportId")({
  head: () => ({ meta: [{ title: "Report Detail · Archon" }] }),
  component: ReportDetail,
});
function ReportDetail() {
  const { reportId } = Route.useParams();
  return <ReportDetailPage reference={reportId} />;
}
export function ReportDetailPage({ reference }: { reference: string }) {
  const auth = useAuth();
  const workspace = useActiveWorkspace();
  return (
    <AppShell title="Audit report" subtitle="Saved results · human review required">
      {auth.isLoading || workspace.isLoading ? (
        <ReportNotice title="Loading your workspace…" />
      ) : workspace.isError ? (
        <ReportNotice title="Your workspaces could not be loaded." />
      ) : !auth.user ? (
        <ReportNotice title="Sign in to view reports." />
      ) : !workspace.active ? (
        <ReportNotice title="No workspace selected" />
      ) : (
        <WorkspaceReport
          key={`${auth.user.id}:${workspace.active.id}:${reference}`}
          user={auth.user.id}
          workspace={workspace.active.id}
          reference={reference}
        />
      )}
    </AppShell>
  );
}
function WorkspaceReport({
  user,
  workspace,
  reference,
}: {
  user: string;
  workspace: string;
  reference: string;
}) {
  const report = useReport(user, workspace, reference);
  return (
    <div className="space-y-5">
      <Link
        to="/reports"
        className="inline-flex min-h-10 items-center gap-2 text-sm hover:underline"
      >
        <ArrowLeft size={16} />
        Report library
      </Link>
      {report.isPending ? (
        <ReportNotice title="Loading saved report evidence…" />
      ) : report.isError ? (
        <ReportNotice title={reportError(report.error)} retry={() => void report.refetch()} />
      ) : (
        <ReportEvidence
          key={report.data.id}
          user={user}
          workspace={workspace}
          report={report.data}
        />
      )}
    </div>
  );
}
export function ReportEvidence({
  user,
  workspace,
  report,
}: {
  user: string;
  workspace: string;
  report: ReportPreview;
}) {
  const [frameworks, setFrameworks] = useState(report.selected_frameworks);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const evidenceDialog = useRef<HTMLDialogElement>(null);
  const download = useReportDownloads(user, workspace);
  const cancelDownload = download.cancel;
  const scope = [user, workspace, report.id];
  const page = useQuery({
    queryKey: ["report-findings", ...scope, offset],
    queryFn: ({ signal }) =>
      getFindingPage(
        workspace,
        report.id,
        { severity: "all", state: "all", q: "" },
        offset,
        signal,
      ),
    gcTime: 0,
    retry: false,
  });
  const detail = useQuery({
    queryKey: ["report-finding", ...scope, selected],
    queryFn: ({ signal }) => getQueueFinding(workspace, report.id, selected!, signal),
    enabled: !!selected && !page.isError,
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (page.isError) cancelDownload();
  }, [page.isError, cancelDownload]);
  useEffect(() => {
    const dialog = evidenceDialog.current;
    if (!dialog) return;
    if (selected && !page.isError) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) dialog.close();
  }, [selected, page.isError]);
  return (
    <div className="space-y-5">
      <SectionCard
        eyebrow="Completed audit · PDF prepared on demand"
        title={report.target_name}
        description={`Audit completed ${reportDate(report.completed_at || report.created_at)}`}
        actions={
          <BrutalButton
            disabled={!!download.busy || page.isError}
            onClick={() => void download.run([report], false, frameworks)}
          >
            <DownloadSimple size={16} />
            Download PDF
          </BrutalButton>
        }
      >
        <p className="break-all font-mono text-xs text-muted-foreground">Scan ID: {report.id}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          This report reflects saved findings and current triage states. It does not rerun analysis.
          Automated evidence requires human review; it is not a compliance certificate.
        </p>
        <fieldset className="mt-4" disabled={!!download.busy}>
          <legend className="text-xs font-medium">Framework scope for preview and PDF</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {report.selected_frameworks.map((fw) => (
              <label key={fw} className="flex min-h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={frameworks.includes(fw)}
                  onChange={() =>
                    setFrameworks(
                      frameworks.includes(fw)
                        ? frameworks.filter((f) => f !== fw)
                        : [...frameworks, fw],
                    )
                  }
                  className="size-4 accent-primary"
                />
                {frameworkLabel(fw)}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {frameworks.length
              ? "Selected framework scores and mappings are included. All security findings remain visible."
              : "Security-only report. No framework scores or mappings selected."}
          </p>
        </fieldset>
      </SectionCard>
      <ReportDownloadStatus download={download} />
      <div className="grid grid-cols-2 divide-x divide-border rounded-sm hairline bg-card sm:grid-cols-5">
        <StatTile label="All findings" value={report.counts.total} />
        {(["critical", "high", "medium", "low"] as const).map((severity) => (
          <StatTile
            key={severity}
            label={severity[0].toUpperCase() + severity.slice(1)}
            value={report.counts.severity[severity] ?? 0}
          />
        ))}
      </div>
      <SectionCard
        title="Executive summary"
        description={report.summary.risk_headline || "Recorded audit assessment"}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {report.summary.summary ||
            "No executive summary was recorded. Review the findings and scan coverage below."}
        </p>
        {!!report.summary.top_priorities?.length && (
          <>
            <h4 className="mt-4 text-sm font-medium">Recorded priorities</h4>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
              {report.summary.top_priorities.map((priority, index) => (
                <li key={index} className="break-words">
                  {priority}
                </li>
              ))}
            </ol>
          </>
        )}
      </SectionCard>
      <SectionCard
        title="Framework mapping"
        description="Heuristic assessment scores are not certification results. Missing scores are not treated as zero."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {frameworks.map((fw) => {
            const score = report.framework_scores[fw];
            return (
              <div
                key={fw}
                className="flex items-center justify-between gap-3 rounded-sm hairline bg-secondary p-3"
              >
                <span className="text-sm font-medium">{frameworkLabel(fw)}</span>
                <span className="font-mono text-sm">
                  {typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100
                    ? `${score}%`
                    : "Not available"}
                </span>
              </div>
            );
          })}
        </div>
        {!frameworks.length && (
          <p className="text-sm text-muted-foreground">
            No framework mappings selected. Security findings are still included.
          </p>
        )}
      </SectionCard>
      <Coverage report={report} />
      <SectionCard
        title="Findings & remediation"
        description="Select a finding to read its recorded evidence and mapped controls. 50 findings per page."
        actions={
          <Link
            to="/workspace/$workspaceId/scans/$scanId/workbench"
            params={{ workspaceId: workspace, scanId: report.id }}
            className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-secondary"
          >
            Open source workbench
          </Link>
        }
        padding="none"
      >
        {page.isPending ? (
          <p className="p-5" role="status">
            Loading findings…
          </p>
        ) : page.isError ? (
          <ReportNotice title={reportError(page.error)} retry={() => void page.refetch()} />
        ) : !page.data.total ? (
          <p className="p-5 text-sm">
            No findings were recorded. This does not guarantee that the project is free of
            vulnerabilities.
          </p>
        ) : (
          <>
            <ul>
              {page.data.items.map((finding) => (
                <li key={finding.id} className="border-b border-border last:border-b-0">
                  <button
                    aria-expanded={selected === finding.id}
                    onClick={() => setSelected(selected === finding.id ? null : finding.id)}
                    className="flex w-full flex-wrap items-start justify-between gap-3 p-5 text-left hover:bg-secondary"
                  >
                    <div className="min-w-0 flex-1 basis-56">
                      <span className="break-words text-sm font-medium">{finding.title}</span>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                        {finding.file_path || "File path not recorded"}
                        {finding.line_number ? `:${finding.line_number}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={finding.severity} />
                      <span className="text-xs text-muted-foreground">
                        {stateLabel(finding.state)}
                      </span>
                      <span className="text-xs">
                        CVSS {formatCvss(finding.cvss_score) ?? "not available"}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
              <span className="text-xs text-muted-foreground">
                {offset + 1}–{Math.min(offset + page.data.items.length, page.data.total)} of{" "}
                {page.data.total} findings
              </span>
              <div className="flex gap-2">
                <BrutalButton
                  size="sm"
                  variant="secondary"
                  disabled={!offset}
                  onClick={() => {
                    setSelected(null);
                    setOffset(Math.max(0, offset - 50));
                  }}
                >
                  Previous
                </BrutalButton>
                <BrutalButton
                  size="sm"
                  variant="secondary"
                  disabled={offset + page.data.items.length >= page.data.total}
                  onClick={() => {
                    setSelected(null);
                    setOffset(offset + 50);
                  }}
                >
                  Next
                </BrutalButton>
              </div>
            </div>
          </>
        )}
      </SectionCard>
      <dialog
        ref={evidenceDialog}
        aria-label="Finding evidence"
        onClose={() => setSelected(null)}
        onCancel={() => setSelected(null)}
        className="m-auto max-h-[85dvh] w-[92vw] max-w-3xl overflow-y-auto rounded-sm border-0 bg-card p-0 text-foreground backdrop:bg-black/60"
      >
        {selected && !page.isError && (
          <SectionCard
            title="Finding evidence"
            actions={
              <BrutalButton size="sm" variant="secondary" onClick={() => setSelected(null)}>
                Close evidence
              </BrutalButton>
            }
          >
            {detail.isPending ? (
              <p role="status">Loading finding evidence…</p>
            ) : detail.isError ? (
              <ReportNotice title={reportError(detail.error)} retry={() => void detail.refetch()} />
            ) : (
              <div className="space-y-4 text-sm">
                <h4 className="break-words font-semibold">{detail.data.finding.title}</h4>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {detail.data.finding.file_path || "File path not recorded"}
                  {detail.data.finding.line_number
                    ? `:${detail.data.finding.line_number}`
                    : ""} · {stateLabel(detail.data.finding.state)} · CVSS{" "}
                  {formatCvss(detail.data.finding.cvss_score) ?? "Not available"}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {detail.data.finding.description || "No description recorded."}
                </p>
                <p className="break-words text-xs text-muted-foreground">
                  CWE: {detail.data.finding.cwe_id || "Not recorded"} · CVE:{" "}
                  {detail.data.finding.cve_id || "Not recorded"}
                </p>
                {detail.data.finding.code_snippet ? (
                  <CodePanel label="Recorded evidence">
                    <pre className="whitespace-pre-wrap break-words">
                      <code>{detail.data.finding.code_snippet}</code>
                    </pre>
                  </CodePanel>
                ) : (
                  <p className="text-muted-foreground">
                    No source evidence was recorded for this finding.
                  </p>
                )}
                <div>
                  <h4 className="font-medium">Remediation</h4>
                  <p className="mt-1 whitespace-pre-wrap break-words">
                    {detail.data.finding.remediation ||
                      "No remediation guidance was recorded. Review this finding with your security team."}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Selected framework controls</h4>
                  {detail.data.finding.violations?.some((v) => frameworks.includes(v.framework)) ? (
                    <ul className="mt-2 space-y-2">
                      {detail.data.finding.violations
                        .filter((v) => frameworks.includes(v.framework))
                        .map((v, index) => (
                          <li key={index} className="break-words rounded-sm hairline p-3">
                            {frameworkLabel(v.framework)} · {v.control_id} · {v.control_title}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-muted-foreground">
                      No control mapping was recorded for the selected frameworks.
                    </p>
                  )}
                </div>
              </div>
            )}
          </SectionCard>
        )}
      </dialog>
    </div>
  );
}
