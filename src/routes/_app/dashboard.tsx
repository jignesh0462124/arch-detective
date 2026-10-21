import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowClockwise,
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  Scan,
  ShieldWarning,
  WarningCircle,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { SectionCard } from "@/components/ui/section-card";
import { CoverageBar } from "@/components/ui/coverage-bar";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { useAuth } from "@/hooks/useAuth";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { useDashboardFindings, useDashboardScans } from "@/hooks/useDashboard";
import type { DashboardScan } from "@/lib/api/dashboard";
import {
  dashboardDate,
  dashboardScanStatus,
  frameworkSignals,
  isScanInProgress,
} from "@/lib/dashboardView";
import { frameworkLabel } from "@/lib/reportView";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Archon" },
      {
        name: "description",
        content: "Latest completed audit, open findings, and recent scan activity.",
      },
    ],
  }),
  component: DashboardPage,
});

const actionClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const secondaryActionClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function DashboardPage() {
  const auth = useAuth();
  const workspace = useActiveWorkspace();

  return (
    <AppShell
      subtitle={workspace.active ? `Workspace · ${workspace.active.name}` : "Workspace overview"}
      title="Dashboard"
      actions={
        <Link to="/workspace" className={actionClass}>
          <Scan size={17} weight="bold" /> Run audit
        </Link>
      }
    >
      {auth.isLoading || workspace.isLoading ? (
        <DashboardNotice title="Loading your workspace…" />
      ) : workspace.isError ? (
        <DashboardNotice
          title="Your workspace could not be loaded"
          description="Check your connection and retry. Saved audit results have not been replaced with browser history."
          retry={() => void window.location.reload()}
        />
      ) : !auth.user ? (
        <DashboardNotice title="Sign in to view your dashboard" />
      ) : !workspace.active ? (
        <DashboardNotice
          title="Create a workspace to begin"
          description="A workspace keeps your audits and findings together."
          action={{ to: "/workspace/new", label: "Create workspace" }}
        />
      ) : (
        <WorkspaceDashboard
          key={`${auth.user.id}:${workspace.active.id}`}
          userId={auth.user.id}
          workspaceId={workspace.active.id}
        />
      )}
    </AppShell>
  );
}

function WorkspaceDashboard({ userId, workspaceId }: { userId: string; workspaceId: string }) {
  const scans = useDashboardScans(userId, workspaceId);
  const latest = scans.data?.latestCompleted;
  const findings = useDashboardFindings(userId, workspaceId, latest?.id);
  const activeScan = scans.data?.recent.find((scan) => isScanInProgress(scan.status));
  const signals = frameworkSignals(latest?.framework_scores ?? {});

  if (scans.isPending) return <DashboardNotice title="Loading saved audit activity…" />;
  if (scans.isError)
    return (
      <DashboardNotice
        title="Audit activity is unavailable"
        description="The database request failed. No scans or findings are being shown as zero."
        retry={() => void scans.refetch()}
      />
    );

  if (!latest)
    return (
      <div className="space-y-5">
        <DashboardNotice
          title={activeScan ? "Your first audit is in progress" : "No completed audit yet"}
          description={
            activeScan
              ? `${activeScan.target_name} is ${dashboardScanStatus(activeScan.status).toLowerCase()}. Results will appear here after they are saved.`
              : "Run Codebase Audit to see findings, assessed frameworks, and a report here. An unfinished audit is not a clean result."
          }
          action={{
            to: "/workspace",
            label: activeScan ? "View audit activity" : "Run Codebase Audit",
          }}
        />
        <RecentScans scans={scans.data.recent} workspaceId={workspaceId} />
      </div>
    );

  const findingError =
    findings.counts.isError || findings.open.isError || findings.criticalOpen.isError;
  const total = findings.counts.data?.total;
  const open = findings.open.data?.total;
  const criticalOpen = findings.criticalOpen.data?.total;

  let summary = "Loading saved finding counts…";
  if (findingError) summary = "Finding summary unavailable. Retry to see the saved evidence.";
  else if (total === 0)
    summary = "No findings were recorded in this audit. Review its scan coverage and limitations.";
  else if (open === 0)
    summary =
      "No open findings in this audit. Review resolved and accepted findings before drawing conclusions.";
  else if (open !== undefined)
    summary = `${open} open finding${open === 1 ? "" : "s"} in this completed audit need review.`;

  return (
    <div className="space-y-5">
      <section
        aria-labelledby="latest-audit-heading"
        className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-title text-muted-foreground">Latest completed audit</span>
              <StatusBadge status="completed" />
            </div>
            <h2
              id="latest-audit-heading"
              className="mt-3 break-words text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl"
            >
              {latest.target_name}
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <Clock size={15} aria-hidden="true" /> Completed {dashboardDate(latest.completed_at)}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">{summary}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {latest.scan_type === "codebase" ? (
              <Link
                to="/workspace/$workspaceId/scans/$scanId/workbench"
                params={{ workspaceId, scanId: latest.id }}
                className={actionClass}
              >
                Open workbench <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : null}
            <Link
              to="/reports/$reportId"
              params={{ reportId: latest.id }}
              className={secondaryActionClass}
            >
              <FileText size={17} aria-hidden="true" /> View report
            </Link>
          </div>
        </div>
      </section>

      {activeScan ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/25 bg-card px-4 py-3 text-sm"
        >
          <Scan size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-foreground">
            <strong className="font-semibold">Another audit is in progress.</strong> The numbers
            below remain from the latest completed audit.
          </span>
          <ScanAction scan={activeScan} workspaceId={workspaceId} />
        </div>
      ) : null}

      {findingError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/35 bg-card px-4 py-3 text-sm"
        >
          <WarningCircle size={18} className="shrink-0 text-destructive" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            Finding counts could not be loaded. Retry to see accurate results.
          </span>
          <button
            type="button"
            onClick={() => {
              void findings.counts.refetch();
              void findings.open.refetch();
              void findings.criticalOpen.refetch();
            }}
            className={secondaryActionClass}
          >
            <ArrowClockwise size={16} aria-hidden="true" /> Retry
          </button>
        </div>
      ) : null}

      <section aria-label="Audit metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total findings" value={total} scope="Latest completed audit" />
        <MetricCard label="Open findings" value={open} scope="Latest completed audit" />
        <MetricCard
          label="Open critical"
          value={criticalOpen}
          scope="Latest completed audit"
          urgent={Boolean(criticalOpen)}
        />
        <MetricCard
          label="Completed scans"
          value={scans.data.completedTotal}
          scope="Current workspace"
        />
      </section>

      <SectionCard
        eyebrow="Triage"
        title="Needs attention"
        description="Highest-severity open findings from the latest completed audit."
        actions={
          <Link to="/findings" className={secondaryActionClass}>
            View all findings <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
        padding="none"
      >
        {findings.open.isPending ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Loading open findings…</p>
        ) : findings.open.isError ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Open findings are unavailable. Use Retry above.
          </p>
        ) : findings.open.data.total === 0 ? (
          <div className="flex items-start gap-3 px-5 py-6">
            <CheckCircle size={20} className="shrink-0 text-success" aria-hidden="true" />
            <p className="text-sm text-foreground/80">
              No open findings in this audit. Check the full findings list for resolved or accepted
              items.
            </p>
          </div>
        ) : findings.open.data.items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            The findings changed while loading. Retry to refresh this list.
          </p>
        ) : (
          <ol className="divide-y divide-border">
            {findings.open.data.items.slice(0, 3).map((finding) => (
              <li
                key={finding.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <ShieldWarning
                    size={18}
                    className="mt-0.5 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={finding.severity} size="sm" dot />
                      <p className="min-w-0 break-words text-sm font-semibold text-foreground">
                        {finding.title}
                      </p>
                    </div>
                    <p
                      className="mt-1 break-all text-xs text-muted-foreground"
                      title={finding.file_path || undefined}
                    >
                      {finding.file_path || "Source file not recorded"}
                      {finding.line_number ? `:${finding.line_number}` : ""}
                    </p>
                  </div>
                </div>
                <Link
                  to="/findings"
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 self-start rounded-md px-2 text-sm font-medium text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-accent sm:self-center"
                >
                  Review <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      <RecentScans scans={scans.data.recent} workspaceId={workspaceId} />

      <SectionCard
        eyebrow="Assessed frameworks"
        title="Framework signals"
        description="Automated scores saved with this audit; they are not proof of compliance or certification."
        actions={
          <Link
            to="/reports/$reportId"
            params={{ reportId: latest.id }}
            className={secondaryActionClass}
          >
            See report <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      >
        {signals.length ? (
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {signals.map(([framework, score]) => (
              <CoverageBar key={framework} label={frameworkLabel(framework)} pct={score} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No framework scores were saved for this audit.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

function MetricCard({
  label,
  value,
  scope,
  urgent = false,
}: {
  label: string;
  value: number | undefined;
  scope: string;
  urgent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${urgent ? "text-severity-critical" : "text-foreground"}`}
      >
        {value ?? "—"}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{scope}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: DashboardScan["status"] }) {
  const className =
    status === "completed"
      ? "bg-success/10 text-success"
      : status === "failed" || status === "cancelled"
        ? "bg-destructive/10 text-destructive"
        : "bg-accent/10 text-accent";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {dashboardScanStatus(status)}
    </span>
  );
}

function ScanAction({ scan, workspaceId }: { scan: DashboardScan; workspaceId: string }) {
  if (scan.status === "completed")
    return (
      <Link
        to="/reports/$reportId"
        params={{ reportId: scan.id }}
        className="inline-flex min-h-9 items-center gap-1 text-sm font-medium hover:underline"
      >
        View report <ArrowRight size={15} aria-hidden="true" />
      </Link>
    );
  if (isScanInProgress(scan.status) && scan.scan_type === "codebase")
    return (
      <Link
        to="/workspace/$workspaceId/scans/$scanId/workbench"
        params={{ workspaceId, scanId: scan.id }}
        className="inline-flex min-h-9 items-center gap-1 text-sm font-medium hover:underline"
      >
        View progress <ArrowRight size={15} aria-hidden="true" />
      </Link>
    );
  return (
    <Link
      to="/workspace"
      className="inline-flex min-h-9 items-center gap-1 text-sm font-medium hover:underline"
    >
      Open audits <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}

function RecentScans({ scans, workspaceId }: { scans: DashboardScan[]; workspaceId: string }) {
  return (
    <SectionCard
      eyebrow="Workspace activity"
      title="Recent scans"
      description="The five newest scan submissions, including work in progress and failed attempts."
      actions={
        <Link to="/workspace" className={secondaryActionClass}>
          All audits <ArrowRight size={16} aria-hidden="true" />
        </Link>
      }
      padding="none"
    >
      {scans.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          No scans have been saved in this workspace yet.
        </p>
      ) : (
        <>
          <ol className="divide-y divide-border md:hidden">
            {scans.map((scan) => (
              <li key={scan.id} className="min-w-0 px-5 py-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold">{scan.target_name}</p>
                  <StatusBadge status={scan.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Started {dashboardDate(scan.created_at)} ·{" "}
                  {scan.status === "completed"
                    ? `${scan.finding_count} findings`
                    : "Results pending"}
                </p>
                <div className="mt-2">
                  <ScanAction scan={scan} workspaceId={workspaceId} />
                </div>
              </li>
            ))}
          </ol>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-secondary/70 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Project
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Started
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Findings
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scans.map((scan) => (
                  <tr key={scan.id}>
                    <td className="max-w-[280px] break-words px-5 py-3 font-medium">
                      {scan.target_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {dashboardDate(scan.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={scan.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {scan.status === "completed" ? scan.finding_count : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <ScanAction scan={scan} workspaceId={workspaceId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function DashboardNotice({
  title,
  description,
  retry,
  action,
}: {
  title: string;
  description?: string;
  retry?: () => void;
  action?: { to: "/workspace" | "/workspace/new"; label: string };
}) {
  return (
    <section
      className="rounded-xl border border-border bg-card px-5 py-8 sm:px-8"
      aria-live="polite"
    >
      <div className="flex max-w-2xl items-start gap-3">
        {retry ? (
          <WarningCircle size={23} className="shrink-0 text-destructive" aria-hidden="true" />
        ) : (
          <Scan size={23} className="shrink-0 text-accent" aria-hidden="true" />
        )}
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {retry || action ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {retry ? (
                <button type="button" onClick={retry} className={secondaryActionClass}>
                  <ArrowClockwise size={16} aria-hidden="true" /> Retry
                </button>
              ) : null}
              {action ? (
                <Link to={action.to} className={actionClass}>
                  {action.label} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
