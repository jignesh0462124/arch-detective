import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClockCounterClockwise, Trash, X } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { authScope, isCurrentScope } from "@/lib/authState";
import {
  deleteAuditHistoryScan,
  refreshAfterAuditDeletion,
  historyOffsetAfterDelete,
} from "@/lib/api/auditDeletion";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import {
  AUDIT_HISTORY_PAGE_SIZE,
  AuditHistoryAccessError,
  getAuditHistoryPage,
  type AuditHistoryStatus,
} from "@/lib/api/auditHistory";

const statusNames = {
  pending: "Queued",
  running: "In progress",
  completed: "Completed",
  failed: "Failed",
};
const actionClass =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary";
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

export function AuditHistoryButton({
  workspaceId,
  role = "viewer",
}: {
  workspaceId: string;
  role?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => setOpen(false), [workspaceId, user?.id]);
  return (
    <>
      <BrutalButton
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <ClockCounterClockwise size={16} /> History
      </BrutalButton>
      {open && (
        <AuditHistoryPanel
          key={`${user?.id}/${workspaceId}`}
          workspaceId={workspaceId}
          role={role}
          onClose={close}
        />
      )}
    </>
  );
}

function AuditHistoryPanel({
  workspaceId,
  role,
  onClose,
}: {
  workspaceId: string;
  role: string;
  onClose: () => void;
}) {
  const { user, isAuthenticated } = useAuth();
  const client = useQueryClient();
  const canDelete = role === "owner" || role === "admin";
  const confirmation = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<{ id: string; name: string; date: string } | null>(null);
  const [feedback, setFeedback] = useState("");
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ q: "", status: "all" as AuditHistoryStatus, offset: 0 });
  const [visible, setVisible] = useState(document.visibilityState === "visible");
  useEffect(() => {
    const timeout = setTimeout(
      () =>
        setFilters((old) =>
          old.q === search.trim() ? old : { ...old, q: search.trim(), offset: 0 },
        ),
      250,
    );
    return () => clearTimeout(timeout);
  }, [search]);
  const history = useQuery({
    queryKey: ["audit-history", user?.id, workspaceId, filters],
    queryFn: ({ signal }) => getAuditHistoryPage(workspaceId, filters, signal),
    enabled: isAuthenticated && !!workspaceId,
    staleTime: 15000,
    gcTime: 0,
    retry: false,
    refetchInterval: (query) =>
      visible &&
      query.state.data?.items.some((scan) => scan.status === "running" || scan.status === "pending")
        ? 5000
        : false,
    refetchOnWindowFocus: "always",
  });
  const { refetch } = history;
  useEffect(() => {
    if (
      !history.isSuccess ||
      history.isFetching ||
      !history.data.total ||
      history.data.items.length
    )
      return;
    setFilters((old) =>
      old.offset >= history.data.total
        ? {
            ...old,
            offset:
              Math.floor((history.data.total - 1) / AUDIT_HISTORY_PAGE_SIZE) *
              AUDIT_HISTORY_PAGE_SIZE,
          }
        : old,
    );
  }, [history.isSuccess, history.isFetching, history.data]);
  useEffect(() => {
    const changed = () => {
      const active = document.visibilityState === "visible";
      setVisible(active);
      if (active) void refetch();
    };
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, [refetch]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      // The native confirmation dialog manages its own focus and Escape key.
      if (confirmation.current?.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input, select",
        ) ?? [],
      ).filter((element) => element.getClientRects().length);
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  const denied =
    history.error instanceof AuditHistoryAccessError ||
    (history.error &&
      "code" in history.error &&
      ["42501", "PGRST301"].includes(String(history.error.code)));
  const data = history.data;
  const filtered = !!filters.q || filters.status !== "all";
  const reset = () => {
    setSearch("");
    setFilters({ q: "", status: "all", offset: 0 });
  };
  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-black/45"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-history-title"
        className="flex h-dvh w-full flex-col border-l border-border bg-card text-foreground shadow-2xl sm:max-w-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div className="min-w-0">
            <h2 id="audit-history-title" className="text-lg font-semibold">
              Previous scans
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Saved codebase audits in this workspace. Opening a scan does not run it again.
            </p>
          </div>
          <button
            ref={close}
            type="button"
            aria-label="Close audit history"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-secondary"
          >
            <X size={18} />
          </button>
        </header>
        <div className="grid gap-3 border-b border-border bg-secondary/20 p-4 sm:grid-cols-[1fr_150px]">
          <label className="min-w-0 text-xs font-medium">
            Search project
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Project name"
              maxLength={200}
              className="mt-1 min-h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium">
            Scan status
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((old) => ({
                  ...old,
                  status: event.target.value as AuditHistoryStatus,
                  offset: 0,
                }))
              }
              className="mt-1 min-h-10 w-full rounded-md border border-border bg-card px-2 text-sm"
            >
              <option value="all">All statuses</option>
              {Object.entries(statusNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" aria-busy={history.isFetching}>
          {feedback && (
            <p role="status" className="mb-4 rounded-md border border-success/30 p-3 text-sm">
              {feedback}
            </p>
          )}
          {history.isError ? (
            <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm">
              <p>
                {denied
                  ? "This workspace is unavailable or you no longer have access."
                  : "Could not load previous scans. Your saved audits are unchanged."}
              </p>
              <BrutalButton
                className="mt-3"
                variant="secondary"
                size="sm"
                onClick={() => void history.refetch()}
              >
                Retry
              </BrutalButton>
            </div>
          ) : history.isPending ? (
            <p role="status" className="text-sm">
              Loading previous scans…
            </p>
          ) : !data?.items.length ? (
            <div role="status" className="rounded-md border border-border p-5 text-sm">
              <h3 className="font-semibold">
                {filtered
                  ? "No matching scans"
                  : data?.total
                    ? "This page is no longer available"
                    : "No previous codebase scans"}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {filtered
                  ? "Try another project name or reset the filters."
                  : "Start a new audit to create saved scan history."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {filtered || data?.total ? (
                  <BrutalButton size="sm" variant="secondary" onClick={reset}>
                    Reset filters
                  </BrutalButton>
                ) : null}
                <BrutalButton size="sm" onClick={onClose}>
                  New audit
                </BrutalButton>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground" role="status">
                {filters.offset + 1}–{filters.offset + data.items.length} of {data.total}{" "}
                {filtered ? "matching scans" : "saved scans"}
                {history.isFetching ? " · Updating…" : ""}
              </p>
              <ul className="space-y-3">
                {data.items.map((scan) => (
                  <li key={scan.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">
                        {scan.target_name || "Unnamed project"}
                      </h3>
                      <span
                        className={`rounded border px-2 py-1 text-xs ${scan.status === "failed" ? "border-destructive/30 text-destructive" : scan.status === "completed" ? "border-success/30 text-success" : "border-border text-muted-foreground"}`}
                      >
                        {statusNames[scan.status] || "Status unavailable"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Started {dateLabel(scan.created_at)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {scan.status === "completed" && (
                        <Link
                          to="/reports/$reportId"
                          params={{ reportId: scan.id }}
                          className={actionClass}
                          onClick={onClose}
                        >
                          View report
                        </Link>
                      )}
                      {scan.status !== "failed" && (
                        <Link
                          to="/workspace/$workspaceId/scans/$scanId/workbench"
                          params={{ workspaceId, scanId: scan.id }}
                          className={actionClass}
                          onClick={onClose}
                        >
                          {scan.status === "completed" ? "Open workbench" : "View progress"}
                        </Link>
                      )}
                      {canDelete && ["completed", "failed"].includes(scan.status) && (
                        <button
                          type="button"
                          className={`${actionClass} gap-1.5 text-destructive focus-visible:outline-2 focus-visible:outline-offset-2`}
                          aria-label={`Delete scan: ${scan.target_name || "Unnamed project"}`}
                          onClick={() => {
                            setFeedback("");
                            setSelected({
                              id: scan.id,
                              name: scan.target_name || "Unnamed project",
                              date: scan.created_at,
                            });
                          }}
                        >
                          <Trash size={15} aria-hidden="true" /> Delete
                        </button>
                      )}
                    </div>
                    {canDelete && ["running", "pending"].includes(scan.status) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Active scans cannot be deleted. Wait for completion or failure.
                      </p>
                    )}
                    {scan.status === "failed" && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        This scan did not complete. Start a new audit to try again.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Source previews have a separate retention period. Reports and saved findings remain
                available when previews expire.
              </p>
            </>
          )}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-border p-4">
          <BrutalButton
            size="sm"
            variant="secondary"
            disabled={!filters.offset || history.isFetching}
            onClick={() =>
              setFilters((old) => ({
                ...old,
                offset: Math.max(0, old.offset - AUDIT_HISTORY_PAGE_SIZE),
              }))
            }
          >
            Previous
          </BrutalButton>
          <span className="text-xs text-muted-foreground">
            Page {Math.floor(filters.offset / AUDIT_HISTORY_PAGE_SIZE) + 1}
          </span>
          <BrutalButton
            size="sm"
            variant="secondary"
            disabled={
              !data ||
              history.isError ||
              filters.offset + AUDIT_HISTORY_PAGE_SIZE >= data.total ||
              history.isFetching
            }
            onClick={() =>
              setFilters((old) => ({ ...old, offset: old.offset + AUDIT_HISTORY_PAGE_SIZE }))
            }
          >
            Next
          </BrutalButton>
        </footer>
      </section>
      {selected && canDelete && user && (
        <DeleteScanConfirmation
          key={selected.id}
          dialogRef={confirmation}
          scan={selected}
          workspaceId={workspaceId}
          onCancel={() => setSelected(null)}
          onDeleted={async () => {
            const deleted = selected.id;
            setSelected(null);
            setFeedback("Scan deleted. Private source cleanup may finish in the background.");
            close.current?.focus();
            setFilters((old) => ({
              ...old,
              offset: historyOffsetAfterDelete(
                old.offset,
                data?.total ?? 0,
                AUDIT_HISTORY_PAGE_SIZE,
              ),
            }));
            await refreshAfterAuditDeletion(client, user.id, workspaceId, deleted);
          }}
        />
      )}
    </div>
  );
}

function DeleteScanConfirmation({
  dialogRef,
  scan,
  workspaceId,
  onCancel,
  onDeleted,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  scan: { id: string; name: string; date: string };
  workspaceId: string;
  onCancel: () => void;
  onDeleted: () => Promise<void>;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const request = useRef(new AbortController());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    cancel.current?.focus();
    return () => {
      controller.abort();
      dialog?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [dialogRef]);
  async function remove() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    const scope = authScope();
    try {
      await deleteAuditHistoryScan(workspaceId, scan.id, request.current.signal);
    } catch (error) {
      if (!request.current.signal.aborted && isCurrentScope(scope)) {
        setError(
          error instanceof Error
            ? error.message
            : "Could not delete this scan. Retry when your connection is available.",
        );
        setPending(false);
        busy.current = false;
      }
      return;
    }
    if (!request.current.signal.aborted && isCurrentScope(scope)) await onDeleted();
  }
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-scan-title"
      aria-describedby="delete-scan-description"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-5 text-foreground shadow-2xl backdrop:bg-black/60"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy.current) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        } else if (!controls.length) event.preventDefault();
      }}
    >
      <h2 id="delete-scan-title" className="text-lg font-semibold">
        Delete this scan?
      </h2>
      <p className="mt-3 break-words text-sm font-medium [overflow-wrap:anywhere]">{scan.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">Audit started {dateLabel(scan.date)}</p>
      <div id="delete-scan-description" className="mt-4 space-y-2 text-sm text-muted-foreground">
        <p>
          This permanently removes the saved audit, findings, report entries and source previews.
          Private storage cleanup may finish in the background.
        </p>
        <p>
          Your original ZIP, repository, GitHub branches and pull requests, and already-downloaded
          files are not deleted.
        </p>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {pending && (
        <p role="status" className="mt-4 text-sm">
          Deleting scan. Please wait…
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          ref={cancel}
          type="button"
          disabled={pending}
          onClick={onCancel}
          className={`${actionClass} disabled:opacity-50`}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void remove()}
          className={`${actionClass} text-destructive disabled:opacity-50`}
        >
          {pending ? "Deleting…" : error ? "Retry deletion" : "Delete scan"}
        </button>
      </div>
    </dialog>
  );
}
