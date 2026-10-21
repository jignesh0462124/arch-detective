import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowRight,
  ClockCounterClockwise,
  Copy,
  DownloadSimple,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { useAuditEvents } from "@/hooks/useAuditEvents";
import { useAuth } from "@/hooks/useAuth";
import { authRequestSignal, authScope, isCurrentScope } from "@/lib/authState";
import {
  fetchAuditEvents,
  fetchScanHistory,
  type AuditEvent,
  type AuditEventFilters,
} from "@/lib/api/auditEvents";

export const Route = createFileRoute("/_app/audit-log")({
  head: () => ({ meta: [{ title: "Audit Log · Archon" }] }),
  component: AuditLogPage,
});

type Category = NonNullable<AuditEventFilters["category"]>;
type Period = "all" | "24h" | "7d" | "30d";
const PAGE_SIZE = 50;
const categories: { value: Category; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "scans", label: "Scans" },
  { value: "findings", label: "Finding changes" },
  { value: "workspace", label: "Workspace" },
  { value: "reports", label: "Reports" },
  { value: "auth", label: "Access" },
];

function eventSummary(event: AuditEvent) {
  const meta = event.event_metadata || {};
  const target = typeof meta.target === "string" ? meta.target : "the project";
  switch (event.event_type) {
    case "scan.started":
      return `Scan started for ${target}`;
    case "scan.completed":
      return `Scan completed for ${target}`;
    case "scan.failed":
      return `Scan failed for ${target}`;
    case "finding.state_changed":
      return `Finding changed from ${String(meta.from ?? "previous state")} to ${String(meta.to ?? "new state")}`;
    case "workspace.created":
      return "Workspace created";
    case "workspace.updated":
      return "Workspace settings changed";
    case "workspace.member_invited":
      return "Workspace member invited";
    case "workspace.member_removed":
      return "Workspace member removed";
    case "report.generated":
      return "Report generated";
    case "report.exported":
      return "Report downloaded";
    default:
      return event.event_type.replaceAll(".", " · ").replaceAll("_", " ");
  }
}

function readableTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  // A spreadsheet may evaluate formulas after opening an exported CSV.
  const safe = /^[\s\p{Cc}]*[=+\-@]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function download(content: string, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EventInspector({ event, onClose }: { event: AuditEvent; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const keydown = (key: KeyboardEvent) => {
      if (key.key === "Escape") onClose();
      if (key.key !== "Tab" || !panel.current) return;
      const items = Array.from(
        panel.current.querySelectorAll<HTMLElement>("button, a, [tabindex]:not([tabindex='-1'])"),
      );
      if (!items.length) return;
      if (key.shiftKey && document.activeElement === items[0]) {
        key.preventDefault();
        items.at(-1)?.focus();
      } else if (!key.shiftKey && document.activeElement === items.at(-1)) {
        key.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = priorOverflow;
      previous?.focus();
    };
  }, [onClose]);
  const metadata = event.event_metadata || {};
  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 w-full bg-black/45"
        aria-label="Close event details"
        onClick={onClose}
      />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Audit event details"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-card shadow-2xl sm:max-w-[520px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <p className="section-title">Recorded event</p>
            <h2 className="mt-1 break-words text-lg font-semibold text-foreground">
              {eventSummary(event)}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{readableTime(event.created_at)}</p>
          </div>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded border border-border p-2 text-foreground hover:bg-secondary"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 text-sm">
          <div className="rounded border border-border bg-secondary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What happened
            </p>
            <p className="mt-2 break-words text-foreground">{eventSummary(event)}</p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Action</dt>
              <dd className="break-all font-mono text-xs">{event.event_type}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Actor</dt>
              <dd className="break-all font-mono text-xs">{event.actor_user_id || "System"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Resource</dt>
              <dd className="break-all font-mono text-xs">{event.resource_type || "Workspace"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Recorded at</dt>
              <dd className="text-xs">{readableTime(event.created_at)}</dd>
            </div>
          </dl>
          <details className="rounded border border-border p-4">
            <summary className="cursor-pointer font-semibold text-foreground">
              Technical details
            </summary>
            <p className="mt-3 text-xs text-muted-foreground">
              These identifiers help correlate the event with saved records. They are not a
              cryptographic proof.
            </p>
            <div className="mt-3 flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all text-xs">{event.id}</code>
              <button
                type="button"
                aria-label="Copy event ID"
                className="rounded border border-border p-1.5"
                onClick={() => void navigator.clipboard.writeText(event.id)}
              >
                <Copy size={14} />
              </button>
            </div>
            <pre className="mt-4 max-h-72 overflow-auto rounded bg-secondary p-3 text-xs text-foreground">
              {JSON.stringify({ resource_id: event.resource_id, metadata }, null, 2)}
            </pre>
          </details>
        </div>
      </aside>
    </div>
  );
}

function AuditLogPage() {
  const {
    active: workspace,
    isLoading: workspaceLoading,
    isError: workspaceError,
  } = useActiveWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<Category>("all");
  const [period, setPeriod] = useState<Period>("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState("");
  const closeInspector = useCallback(() => setSelectedId(null), []);
  const canRead = workspace?.role === "owner" || workspace?.role === "admin";
  const since = useMemo(
    () =>
      period === "all"
        ? undefined
        : new Date(
            Date.now() - { "24h": 1, "7d": 7, "30d": 30 }[period] * 86_400_000,
          ).toISOString(),
    [period],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search);
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setSelectedId(null);
    setPage(0);
    setHistoryPage(0);
  }, [workspace?.id]);
  useEffect(() => {
    setSelectedId(null);
  }, [category, period, appliedSearch, page]);
  const filters = {
    category,
    since,
    search: appliedSearch,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };
  const events = useAuditEvents(canRead ? workspace?.id : null, filters);
  const history = useQuery({
    queryKey: ["audit-scan-history", user?.id, workspace?.id, historyPage],
    queryFn: ({ signal }) => fetchScanHistory(workspace!.id, historyPage * 25, 25, signal),
    enabled: !!user && !!workspace?.id && canRead,
    staleTime: 30_000,
  });
  const selected = events.data?.items.find((item) => item.id === selectedId);
  const total = events.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const reset = () => {
    setSearch("");
    setAppliedSearch("");
    setCategory("all");
    setPeriod("all");
    setPage(0);
  };
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["audit-events", workspace?.id] });
    void queryClient.invalidateQueries({
      queryKey: ["audit-scan-history", user?.id, workspace?.id],
    });
  };
  const exportEvents = async (format: "csv" | "json") => {
    if (!workspace || exporting) return;
    const scope = authScope();
    setExporting(format);
    setExportError("");
    setExportProgress(0);
    try {
      const all: AuditEvent[] = [];
      let expected = 0;
      do {
        const result = await fetchAuditEvents({
          workspace_id: workspace.id,
          ...filters,
          offset: all.length,
          limit: 500,
          signal: authRequestSignal(),
        });
        if (!isCurrentScope(scope)) return;
        expected = result.total;
        all.push(...result.items);
        setExportProgress(all.length);
        if (!result.items.length && all.length < expected)
          throw new Error("Export stopped before all records were loaded.");
      } while (all.length < expected);
      if (!isCurrentScope(scope)) return;
      const safeName =
        workspace.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 50) || "workspace";
      const filename = `archon-audit-events-${safeName}-${new Date().toISOString().slice(0, 10)}.${format}`;
      if (format === "json")
        download(
          JSON.stringify(
            { workspace: workspace.name, exported_at: new Date().toISOString(), events: all },
            null,
            2,
          ),
          "application/json",
          filename,
        );
      else {
        const columns = ["Event ID", "Time", "Action", "Actor", "Resource", "Summary", "Metadata"];
        const rows = all.map((event) => [
          event.id,
          event.created_at,
          event.event_type,
          event.actor_user_id,
          event.resource_id,
          eventSummary(event),
          JSON.stringify(event.event_metadata || {}),
        ]);
        download(
          [columns.map(csvValue).join(","), ...rows.map((row) => row.map(csvValue).join(","))].join(
            "\r\n",
          ),
          "text/csv;charset=utf-8",
          filename,
        );
      }
    } catch {
      if (isCurrentScope(scope))
        setExportError("Export could not finish. Retry after checking your connection.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppShell
      title="Audit Log"
      subtitle={workspace ? `Workspace · ${workspace.name}` : "Workspace activity"}
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded border border-border bg-card p-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Recorded workspace activity</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Review recorded actions and saved scan history. Entries are activity records, not
              signed audit attestations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={!canRead}
              className="inline-flex h-9 items-center gap-2 rounded border border-border px-3 text-xs hover:bg-secondary disabled:opacity-50"
            >
              <ArrowClockwise size={14} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => void exportEvents("csv")}
              disabled={!canRead || !total || !!exporting}
              className="inline-flex h-9 items-center gap-2 rounded border border-border px-3 text-xs hover:bg-secondary disabled:opacity-50"
            >
              <DownloadSimple size={14} /> CSV
            </button>
            <button
              type="button"
              onClick={() => void exportEvents("json")}
              disabled={!canRead || !total || !!exporting}
              className="inline-flex h-9 items-center gap-2 rounded border border-border px-3 text-xs hover:bg-secondary disabled:opacity-50"
            >
              <DownloadSimple size={14} /> JSON
            </button>
          </div>
        </div>
        {exporting && (
          <p role="status" className="text-xs text-muted-foreground">
            Preparing {exporting.toUpperCase()} · {exportProgress} events loaded
          </p>
        )}
        {exportError && (
          <p role="alert" className="text-xs text-destructive">
            {exportError}
          </p>
        )}
        {workspaceLoading ? (
          <State title="Loading workspace" description="Checking your access…" />
        ) : workspaceError ? (
          <State
            title="Workspace unavailable"
            description="Could not load your workspace. Try refreshing the page."
          />
        ) : !workspace ? (
          <State
            title="No workspace selected"
            description="Create or join a workspace to view activity."
          />
        ) : !canRead ? (
          <State
            title="Audit Log access is restricted"
            description="Only workspace owners and admins can read recorded activity."
          />
        ) : (
          <>
            <section
              className="overflow-hidden rounded border border-border bg-card"
              aria-label="Recorded events"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
                <div>
                  <h3 className="font-semibold">Recorded events</h3>
                  <p className="text-xs text-muted-foreground">
                    {events.isLoading ? "Loading…" : `${total} matching events`}
                  </p>
                </div>
                <Link
                  to="/code-audit"
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  Run Codebase Audit <ArrowRight size={13} />
                </Link>
              </div>
              <div className="grid gap-2 border-b border-border p-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                <label className="relative">
                  <span className="sr-only">Search events</span>
                  <MagnifyingGlass
                    size={15}
                    className="absolute left-3 top-3 text-muted-foreground"
                  />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(0);
                    }}
                    placeholder="Search action or project name"
                    className="h-10 w-full rounded border border-input bg-background pl-9 pr-3 text-sm"
                  />
                </label>
                <label className="sr-only" htmlFor="audit-category">
                  Event category
                </label>
                <select
                  id="audit-category"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value as Category);
                    setPage(0);
                  }}
                  className="h-10 rounded border border-input bg-background px-3 text-sm"
                >
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="audit-period">
                  Time period
                </label>
                <select
                  id="audit-period"
                  value={period}
                  onChange={(event) => {
                    setPeriod(event.target.value as Period);
                    setPage(0);
                  }}
                  className="h-10 rounded border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Any time</option>
                  <option value="24h">Past 24 hours</option>
                  <option value="7d">Past 7 days</option>
                  <option value="30d">Past 30 days</option>
                </select>
              </div>
              {events.isLoading ? (
                <State title="Loading events" description="Reading recorded workspace activity…" />
              ) : events.isError ? (
                <State
                  title="Could not load events"
                  description="Your connection or access may have changed."
                  action={
                    <button
                      onClick={() => void events.refetch()}
                      className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground"
                    >
                      Retry
                    </button>
                  }
                />
              ) : !total ? (
                <State
                  title={
                    category !== "all" || period !== "all" || appliedSearch
                      ? "No events match these filters"
                      : "No recorded events yet"
                  }
                  description={
                    category !== "all" || period !== "all" || appliedSearch
                      ? "Try a different search, category or time period."
                      : "New scan and finding actions will appear here when recorded."
                  }
                  action={
                    (category !== "all" || period !== "all" || appliedSearch) && (
                      <button onClick={reset} className="text-xs text-accent underline">
                        Reset filters
                      </button>
                    )
                  }
                />
              ) : (
                <div className="divide-y divide-border">
                  {events.data?.items.map((event) => (
                    <div
                      key={event.id}
                      className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-foreground">
                          {eventSummary(event)}
                        </p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {readableTime(event.created_at)} · {event.event_type}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(event.id)}
                        aria-label={`Inspect ${event.event_type} at ${readableTime(event.created_at)}`}
                        className="self-start rounded border border-border px-3 py-2 text-xs font-medium hover:border-accent hover:text-accent sm:self-auto"
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-border p-4 text-xs">
                  <span>
                    Page {page + 1} of {pageCount} · {total} results
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={!page}
                      onClick={() => setPage(page - 1)}
                      className="rounded border border-border px-3 py-1.5 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page + 1 >= pageCount}
                      onClick={() => setPage(page + 1)}
                      className="rounded border border-border px-3 py-1.5 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
            <section
              className="overflow-hidden rounded border border-border bg-card"
              aria-label="Saved scan history"
            >
              <div className="border-b border-border p-4">
                <h3 className="font-semibold">Saved scan history</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Existing scans from your workspace. These are saved scan records, not
                  reconstructed audit events.
                </p>
              </div>
              {history.isLoading ? (
                <State title="Loading scan history" description="Reading saved scans…" />
              ) : history.isError ? (
                <State
                  title="Could not load scan history"
                  description="Try again to load saved scans."
                  action={
                    <button
                      onClick={() => void history.refetch()}
                      className="text-xs text-accent underline"
                    >
                      Retry
                    </button>
                  }
                />
              ) : !history.data?.total ? (
                <State title="No saved scans" description="A completed audit will appear here." />
              ) : (
                <div className="divide-y divide-border">
                  {history.data.items.map((scan) => (
                    <div
                      key={scan.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-4"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium">{scan.target_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Started {readableTime(scan.created_at)}
                          {scan.completed_at
                            ? ` · Finished ${readableTime(scan.completed_at)}`
                            : ""}
                        </p>
                      </div>
                      <span className="rounded border border-border bg-secondary px-2 py-1 text-xs capitalize">
                        {scan.status.replaceAll("_", " ")}
                        {scan.status === "completed"
                          ? ` · ${scan.finding_count ?? "?"} findings`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {(history.data?.total ?? 0) > 25 && (
                <div className="flex items-center justify-between border-t border-border p-4 text-xs">
                  <span>
                    Page {historyPage + 1} of {Math.ceil((history.data?.total ?? 0) / 25)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={!historyPage}
                      onClick={() => setHistoryPage(historyPage - 1)}
                      className="rounded border border-border px-3 py-1.5 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      disabled={(historyPage + 1) * 25 >= (history.data?.total ?? 0)}
                      onClick={() => setHistoryPage(historyPage + 1)}
                      className="rounded border border-border px-3 py-1.5 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {selected && <EventInspector event={selected} onClose={closeInspector} />}
    </AppShell>
  );
}

function State({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-10 text-center">
      <ClockCounterClockwise size={25} className="text-muted-foreground" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
