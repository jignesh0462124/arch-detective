import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Funnel,
  DownloadSimple,
  FileText,
  Detective,
  Wrench,
  ShieldCheck,
  X,
  ArrowClockwise,
  MagnifyingGlass,
  type Icon,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { SectionCard } from "@/components/ui/section-card";
import { StatTile } from "@/components/ui/stat-tile";
import { CodePanel } from "@/components/ui/code-panel";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useFindingScans, useFindingQueue } from "@/hooks/useFindingQueue";
import {
  exportFindingQueue,
  findingError,
  type QueueFilters,
  type FindingState,
} from "@/lib/api/findingQueue";
import { chooseFindingScan, FINDING_STATES, formatCvss, stateLabel } from "@/lib/findingView";
import type { WorkbenchFinding } from "@/lib/api/workbench";
import type { Workspace } from "@/lib/api/workspaces";
import type { Severity } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/findings")({
  head: () => ({
    meta: [
      { title: "Findings · Archon" },
      {
        name: "description",
        content:
          "Review saved scan findings, inspect evidence and triage mapped compliance controls.",
      },
    ],
  }),
  component: FindingsPage,
});

const EMPTY_FILTERS: QueueFilters = { severity: "all", state: "all", q: "" };
const SEVERITIES: (Severity | "all")[] = ["all", "critical", "high", "medium", "low"];
const INPUT =
  "min-h-10 min-w-0 rounded-sm border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary";

export function FindingsPage() {
  const { active: workspace, isLoading, isError, error } = useActiveWorkspace();
  const auth = useAuth();
  return (
    <AppShell subtitle="Triage queue" title="Findings">
      {isLoading || auth.isLoading ? (
        <Notice title="Loading your workspace…" />
      ) : isError ? (
        <Notice
          title={findingError(error)}
          description="Your workspaces could not be loaded. Refresh the page to retry."
        />
      ) : !auth.user ? (
        <Notice title="Sign in to view findings." />
      ) : !workspace ? (
        <Notice
          title="No workspace selected"
          description="Create or select a workspace before reviewing saved scans."
        />
      ) : (
        <WorkspaceFindings
          key={`${auth.user.id}:${workspace.id}`}
          workspace={workspace}
          userId={auth.user.id}
        />
      )}
    </AppShell>
  );
}

function WorkspaceFindings({ workspace, userId }: { workspace: Workspace; userId: string }) {
  const scans = useFindingScans(userId, workspace.id);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const items = scans.data?.pages.flatMap((page) => page.items) ?? [];
  const scan = chooseFindingScan(items, selectedScanId);
  if (scans.isPending) return <Notice title="Loading completed scans…" />;
  if (scans.isError)
    return <Notice title={findingError(scans.error)} retry={() => void scans.refetch()} />;
  if (!scan)
    return (
      <Notice
        title="No completed scans available"
        description="Run Codebase Audit or wait for your current scan to finish. In-progress scans are not reported as clean."
        audit
      />
    );
  if (selectedScanId && !items.some((item) => item.id === selectedScanId))
    return (
      <Notice
        title="The selected scan is no longer available."
        retry={() => {
          setSelectedScanId(null);
          void scans.refetch();
        }}
      />
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-sm hairline bg-card p-4">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium">
          Completed scan
          <select
            aria-label="Completed scan"
            value={scan.id}
            onChange={(e) => setSelectedScanId(e.target.value)}
            className={`${INPUT} w-full sm:max-w-xl`}
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.target_name} ·{" "}
                {new Date(item.completed_at || item.created_at).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        {scans.hasNextPage && (
          <BrutalButton
            size="sm"
            variant="ghost"
            disabled={scans.isFetchingNextPage}
            onClick={() => void scans.fetchNextPage()}
          >
            Load older scans
          </BrutalButton>
        )}
        <span className="text-xs text-muted-foreground">
          {selectedScanId ? "Selected scan" : "Latest completed scan"}
        </span>
      </div>
      <FindingQueue key={scan.id} workspace={workspace} userId={userId} scanId={scan.id} />
    </div>
  );
}

function FindingQueue({
  workspace,
  userId,
  scanId,
}: {
  workspace: Workspace;
  userId: string;
  scanId: string;
}) {
  const [filters, setFilters] = useState<QueueFilters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportAbort = useRef<AbortController | null>(null);
  const detailPanel = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => exportAbort.current?.abort(), []);
  const { counts, page, detail, update } = useFindingQueue(
    userId,
    workspace.id,
    scanId,
    filters,
    offset,
    selectedId,
  );
  useEffect(() => {
    if (page.data && offset > 0 && offset >= page.data.total) {
      setOffset(Math.max(0, Math.floor((page.data.total - 1) / 50) * 50));
      setSelectedId(null);
    }
  }, [page.data, offset]);
  useEffect(() => {
    if (counts.isError) {
      setSelectedId(null);
      exportAbort.current?.abort();
    }
  }, [counts.isError]);
  useEffect(() => {
    if (selectedId && window.matchMedia("(max-width: 1279px)").matches) {
      detailPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedId]);
  const canTriage = ["owner", "admin", "analyst"].includes(workspace.role);
  const changeFilters = (next: QueueFilters) => {
    setFilters(next);
    setOffset(0);
    setSelectedId(null);
    update.reset();
    setExportError(null);
    exportAbort.current?.abort();
  };
  const changePage = (next: number) => {
    setOffset(next);
    setSelectedId(null);
    update.reset();
  };
  async function download(format: "csv" | "json") {
    exportAbort.current?.abort();
    const controller = new AbortController();
    exportAbort.current = controller;
    setExporting(true);
    setExportError(null);
    try {
      await exportFindingQueue(workspace.id, scanId, filters, format, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) setExportError(findingError(error));
    } finally {
      if (exportAbort.current === controller) setExporting(false);
    }
  }
  if (counts.isPending) return <Notice title="Loading scan totals…" />;
  if (counts.isError)
    return <Notice title={findingError(counts.error)} retry={() => void counts.refetch()} />;
  const total = counts.data.total;
  const matching = page.data?.total ?? 0;
  const filtered = filters.severity !== "all" || filters.state !== "all" || !!filters.q;
  const severityCount = (severity: Severity) => counts.data.severity[severity] ?? 0;
  return (
    <div className="space-y-5 [&_button]:min-h-10">
      <SectionCard
        eyebrow="// TRIAGE"
        title="Review scan findings"
        description="Inspect recorded evidence, review compliance mappings and track remediation status."
      >
        <div className="grid grid-cols-2 border-y border-border md:grid-cols-4">
          {[
            ["01 // TOTAL", "All findings", total],
            ["02 // CRIT", "Critical", severityCount("critical")],
            ["03 // HIGH", "High", severityCount("high")],
            ["04 // MED+LOW", "Med + Low", severityCount("medium") + severityCount("low")],
          ].map(([code, label, value]) => (
            <StatTile key={code} code={String(code)} label={String(label)} value={String(value)} />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Scan-wide totals · all statuses · unaffected by filters
        </p>
      </SectionCard>

      <section aria-label="Finding filters" className="rounded-sm hairline bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" aria-label="Severity filters">
            {SEVERITIES.map((severity) => (
              <button
                key={severity}
                type="button"
                aria-pressed={filters.severity === severity}
                onClick={() => changeFilters({ ...filters, severity })}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-sm border px-3 text-xs capitalize transition-colors",
                  filters.severity === severity
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                {severity === "all" ? "All severities" : severity}
                <span className="font-mono tabular-nums">
                  {severity === "all" ? total : severityCount(severity)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <BrutalButton
              size="sm"
              variant="secondary"
              aria-expanded={showFilters}
              aria-controls="finding-filter-fields"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Funnel size={14} /> Filters{filtered ? " · active" : ""}
            </BrutalButton>
            <BrutalButton
              size="sm"
              variant="ghost"
              disabled={exporting || !matching || page.isError || page.isPending}
              onClick={() => void download("csv")}
            >
              <DownloadSimple size={14} /> CSV
            </BrutalButton>
            <BrutalButton
              size="sm"
              variant="ghost"
              disabled={exporting || !matching || page.isError || page.isPending}
              onClick={() => void download("json")}
            >
              <DownloadSimple size={14} /> JSON
            </BrutalButton>
          </div>
        </div>
        {showFilters && (
          <form
            id="finding-filter-fields"
            className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              changeFilters({ ...filters, q: search.trim() });
            }}
          >
            <label className="flex min-w-0 basis-56 flex-1 flex-col gap-1.5 text-xs font-medium">
              Search findings
              <input
                value={search}
                maxLength={150}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title, description, file or CWE"
                className={INPUT}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
              Status
              <select
                className={INPUT}
                value={filters.state}
                onChange={(e) =>
                  changeFilters({ ...filters, state: e.target.value as QueueFilters["state"] })
                }
              >
                <option value="all">All statuses</option>
                {FINDING_STATES.map((state) => (
                  <option key={state} value={state}>
                    {stateLabel(state)}
                  </option>
                ))}
              </select>
            </label>
            <BrutalButton type="submit" size="sm" variant="secondary">
              <MagnifyingGlass size={14} /> Search
            </BrutalButton>
            <BrutalButton
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch("");
                changeFilters(EMPTY_FILTERS);
              }}
            >
              Reset
            </BrutalButton>
          </form>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {filters.q ? `Search: “${filters.q}” · ` : ""}Status:{" "}
            {filters.state === "all" ? "All" : stateLabel(filters.state)}
          </span>
          <span>{exporting ? "Preparing download…" : "Exports include all matching results"}</span>
        </div>
        {exportError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {exportError}
          </p>
        )}
      </section>

      {update.isSuccess && (!selectedId || matching === 0) && (
        <p role="status" className="text-sm text-muted-foreground">
          Status saved.
        </p>
      )}
      {page.isPending ? (
        <Notice title="Loading findings…" />
      ) : page.isError ? (
        <Notice title={findingError(page.error)} retry={() => void page.refetch()} />
      ) : matching === 0 ? (
        <Notice
          audit={total === 0}
          title={
            total === 0 ? "No findings recorded for this scan" : "No findings match these filters"
          }
          description={
            total === 0
              ? "The scan completed without recorded findings. This is not a guarantee that the project is free of vulnerabilities."
              : "Change the severity, status or search, or reset your filters."
          }
        />
      ) : (
        <section className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-12">
          <SectionCard
            className={cn("min-w-0", selectedId ? "xl:col-span-7" : "xl:col-span-12")}
            padding="none"
            eyebrow="// FINDINGS"
            title={`${matching} matching finding${matching === 1 ? "" : "s"}`}
          >
            <div className="divide-y divide-border" aria-label="Findings list">
              {page.data.items.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  disabled={update.isPending}
                  onClick={() => {
                    setSelectedId(f.id);
                    update.reset();
                  }}
                  aria-pressed={selectedId === f.id}
                  className={cn(
                    "block w-full min-w-0 border-l-2 p-4 text-left transition-colors sm:px-6",
                    selectedId === f.id
                      ? "border-primary bg-secondary"
                      : "border-transparent hover:bg-secondary/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words text-sm font-medium text-foreground">
                      {f.title}
                    </span>
                    <span className="inline-flex shrink-0 rounded-md bg-card">
                      <SeverityBadge severity={f.severity} size="sm">
                        {f.severity}
                      </SeverityBadge>
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                    {f.file_path || "No file location recorded"}
                    {f.line_number != null ? `:${f.line_number}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{stateLabel(f.state)}</span>
                    <span>{f.source}</span>
                    {f.cwe_id && <span>{f.cwe_id}</span>}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-muted-foreground">
              <span className="text-xs" aria-live="polite">
                {offset + 1}–{Math.min(offset + page.data.items.length, matching)} of {matching}
              </span>
              <div className="flex gap-2">
                <BrutalButton
                  size="sm"
                  variant="ghost"
                  className="border border-border text-foreground hover:bg-secondary"
                  disabled={offset === 0 || update.isPending}
                  onClick={() => changePage(Math.max(0, offset - 50))}
                >
                  Previous
                </BrutalButton>
                <BrutalButton
                  size="sm"
                  variant="ghost"
                  className="border border-border text-foreground hover:bg-secondary"
                  disabled={offset + 50 >= matching || update.isPending}
                  onClick={() => changePage(offset + 50)}
                >
                  Next
                </BrutalButton>
              </div>
            </div>
          </SectionCard>
          {selectedId && (
            <div
              ref={detailPanel}
              className="min-w-0 scroll-mt-4 xl:sticky xl:top-6 xl:col-span-5 xl:self-start"
            >
              {detail.isPending ? (
                <Notice title="Loading finding details…" />
              ) : detail.isError ? (
                <Notice title={findingError(detail.error)} retry={() => void detail.refetch()} />
              ) : (
                detail.data && (
                  <FindingDetail
                    finding={detail.data.finding}
                    workspaceId={workspace.id}
                    scanId={scanId}
                    canTriage={canTriage}
                    pending={update.isPending}
                    message={update.isSuccess ? "Status saved." : null}
                    error={update.isError ? findingError(update.error) : null}
                    close={() => setSelectedId(null)}
                    change={(state) => update.mutate({ id: selectedId, state })}
                  />
                )
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function FindingDetail({
  finding: f,
  workspaceId,
  scanId,
  close,
  change,
  canTriage,
  pending,
  message,
  error,
}: {
  finding: WorkbenchFinding;
  workspaceId: string;
  scanId: string;
  close: () => void;
  change: (state: FindingState) => void;
  canTriage: boolean;
  pending: boolean;
  message: string | null;
  error: string | null;
}) {
  const cvss = formatCvss(f.cvss_score);
  return (
    <SectionCard
      className="min-w-0 [&_h2]:break-words"
      eyebrow={`// ${f.id.slice(0, 8)}`}
      title={f.title}
      actions={
        <button
          type="button"
          onClick={close}
          aria-label="Close detail"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border hover:bg-muted"
        >
          <X size={16} />
        </button>
      }
    >
      <div className="space-y-5" aria-busy={pending}>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={f.severity}>{f.severity}</SeverityBadge>
          <span className="text-xs">
            {stateLabel(f.state)} · {f.source}
          </span>
        </div>
        <DetailSection icon={FileText} label="Description">
          <p className="break-words text-sm leading-relaxed">
            {f.description || "No description recorded."}
          </p>
        </DetailSection>
        <DetailSection icon={Detective} label="Evidence">
          <p className="mb-2 break-all font-mono text-xs text-muted-foreground">
            {f.file_path || "No file location recorded"}
            {f.line_number != null ? ` · line ${f.line_number}` : ""}
          </p>
          {f.code_snippet ? (
            <CodePanel filename="Recorded evidence" variant="default">
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs leading-relaxed text-white">
                {f.code_snippet}
              </pre>
            </CodePanel>
          ) : (
            <p className="text-sm text-muted-foreground">No code evidence captured.</p>
          )}
        </DetailSection>
        <DetailSection icon={Wrench} label="Remediation">
          <a
            className="mb-3 inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm"
            href={`/fix-verification?scanId=${encodeURIComponent(scanId)}&findingId=${encodeURIComponent(f.id)}`}
          >
            Suggest fix
          </a>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {f.remediation || "No remediation guidance recorded."}
          </p>
          <Link
            to="/advisor"
            search={{ workspaceId, scanId, findingId: f.id, solution: "overview" }}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent underline"
          >
            Ask Security Advisor about this saved finding
          </Link>
        </DetailSection>
        <DetailSection icon={ShieldCheck} label="Classification">
          <div className="space-y-1 text-sm">
            {f.cwe_id && <p>CWE: {f.cwe_id}</p>}
            {f.cve_id && <p>CVE: {f.cve_id}</p>}
            {cvss !== null && <p>CVSS: {cvss}</p>}
            {!f.cwe_id && !f.cve_id && cvss === null && (
              <p className="text-muted-foreground">No classification recorded.</p>
            )}
          </div>
        </DetailSection>
        <DetailSection icon={ShieldCheck} label="Compliance mappings">
          {f.violations?.length ? (
            <ul className="space-y-3">
              {f.violations.map((v, i) => (
                <li
                  key={`${v.framework}:${v.control_id}:${i}`}
                  className="break-words rounded-sm border border-border p-3 text-sm"
                >
                  <p className="font-medium">
                    {v.framework.toUpperCase()} · {v.control_id}
                  </p>
                  <p>{v.control_title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {v.violation_description ||
                      v.description ||
                      "Recorded control association; review the supporting evidence."}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No compliance mappings recorded.</p>
          )}
        </DetailSection>
        <div className="border-t border-border pt-4">
          {canTriage ? (
            <div className="grid grid-cols-2 gap-2">
              {FINDING_STATES.filter((state) => state !== f.state).map((state) => (
                <BrutalButton
                  key={state}
                  size="sm"
                  variant={state === "resolved" ? "secondary" : "ghost"}
                  disabled={pending}
                  onClick={() => change(state)}
                >
                  {state === "resolved"
                    ? "Resolve"
                    : state === "open"
                      ? "Reopen"
                      : state === "accepted_risk"
                        ? "Accept risk"
                        : stateLabel(state)}
                </BrutalButton>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Read-only access. An analyst, admin or owner can change this status.
            </p>
          )}
          <p
            aria-live="polite"
            role={error ? "alert" : "status"}
            className={cn("mt-3 text-xs", error ? "text-destructive" : "text-muted-foreground")}
          >
            {pending ? "Saving status…" : error || message}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function Notice({
  title,
  description,
  retry,
  audit,
}: {
  title: string;
  description?: string;
  retry?: () => void;
  audit?: boolean;
}) {
  return (
    <div role={retry ? "alert" : "status"} className="rounded-sm hairline bg-card p-6">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {retry && (
          <BrutalButton size="sm" variant="secondary" onClick={retry}>
            <ArrowClockwise size={14} /> Retry
          </BrutalButton>
        )}
        {audit && (
          <Link
            to="/workspace"
            className="inline-flex min-h-10 items-center rounded-sm bg-primary px-4 text-sm text-primary-foreground"
          >
            Run Codebase Audit
          </Link>
        )}
      </div>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  label,
  children,
}: {
  icon: Icon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h3 className="section-title mb-2 flex items-center gap-1.5">
        <Icon size={12} weight="duotone" />
        {label}
      </h3>
      {children}
    </div>
  );
}
