import { useState, useRef, useEffect, useId } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Check,
  CaretDown,
  GearSix,
  Buildings,
  CircleNotch,
  X,
  ShieldCheck,
} from "@phosphor-icons/react";
import { useActiveWorkspace, useWorkspaces, useCreateWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48);
}

/**
 * WorkspaceSwitcher — dropdown in the AppShell sidebar.
 * Structured to fit cleanly within the sidebar width without horizontal clipping or scrollbars.
 * Styled with Archon's brutalist/editorial aesthetic and Phosphor icons.
 */
export function WorkspaceSwitcher() {
  const triggerId = useId();
  const navigate = useNavigate();
  const { active, workspaces, isLoading, setActive } = useActiveWorkspace();
  const { data: allWorkspaces } = useWorkspaces();
  const createWorkspaceMutation = useCreateWorkspace();

  const [open, setOpen] = useState(false);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** Close on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  /** Close on Escape */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (open || showQuickModal) e.preventDefault();
        setOpen(false);
        setShowQuickModal(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, showQuickModal]);

  function handleSwitch(id: string) {
    setActive(id);
    setOpen(false);
  }

  function handleSettings() {
    if (!active) return;
    setOpen(false);
    void navigate({ to: "/workspace/$workspaceId/settings", params: { workspaceId: active.id } });
  }

  function handleOpenCreateModal() {
    setOpen(false);
    setQuickName("");
    setQuickError(null);
    setShowQuickModal(true);
  }

  async function handleQuickCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = quickName.trim();
    if (!trimmed) {
      setQuickError("Please enter a workspace name");
      return;
    }
    const slug = toSlug(trimmed) || "workspace";

    try {
      setQuickError(null);
      await createWorkspaceMutation.mutateAsync({ name: trimmed, slug });
      setShowQuickModal(false);
      setQuickName("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create workspace";
      setQuickError(msg);
    }
  }

  const workspaceList = allWorkspaces && allWorkspaces.length > 0 ? allWorkspaces : workspaces;

  return (
    <>
      <div ref={containerRef} className="relative w-full">
        {/* Transparent backdrop overlay when open to ensure outside clicks dismiss cleanly */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Trigger button */}
        <button
          type="button"
          id={triggerId}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "group relative z-30 flex w-full items-center gap-2.5 rounded-lg border border-border/80 bg-card/80 px-2.5 py-2 text-left transition-all",
            "hover:border-border hover:bg-sidebar-active focus:outline-none focus:ring-1 focus:ring-accent/40",
            open && "border-muted-foreground/40 bg-sidebar-active",
          )}
        >
          {/* Workspace avatar icon box */}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-foreground text-xs font-semibold uppercase">
            {isLoading ? (
              <CircleNotch size={15} className="animate-spin text-muted-foreground" />
            ) : active?.name ? (
              active.name[0]
            ) : (
              <Buildings size={15} weight="duotone" className="text-muted-foreground" />
            )}
          </span>

          {/* Text stack */}
          <div className="min-w-0 flex-1 overflow-hidden">
            <span className="block truncate text-[13px] font-semibold tracking-tight text-foreground leading-snug">
              {isLoading ? "Loading…" : active ? active.name : "Select workspace"}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground mt-0.5">
              {isLoading
                ? "Connecting…"
                : active
                  ? `${active.role.charAt(0).toUpperCase() + active.role.slice(1)} · ${active.scan_count} scan${active.scan_count === 1 ? "" : "s"}`
                  : "Choose project"}
            </span>
          </div>

          <CaretDown
            size={13}
            weight="bold"
            className={cn(
              "shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180 text-foreground",
            )}
          />
        </button>

        {/* Dropdown panel — sits above navigation with z-50 */}
        {open && (
          <div
            role="listbox"
            aria-label="Workspace list"
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Workspaces</span>
              <span
                className="text-xs tabular-nums text-muted-foreground"
                aria-label={`${workspaceList.length} workspaces`}
              >
                {workspaceList.length}
              </span>
            </div>

            {/* Workspace list */}
            <div className="max-h-56 overflow-y-auto py-1">
              {workspaceList.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <Buildings
                    size={24}
                    weight="duotone"
                    className="mx-auto text-muted-foreground/60 mb-1.5"
                  />
                  <p className="text-[12px] font-medium text-foreground">No workspaces found</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Create a workspace to isolate project audits
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-xs transition hover:opacity-90"
                  >
                    <Plus size={13} weight="bold" />
                    Create workspace
                  </button>
                </div>
              ) : (
                workspaceList.map((ws) => {
                  const isActive = ws.id === active?.id;
                  return (
                    <button
                      key={ws.id}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => handleSwitch(ws.id)}
                      className={cn(
                        "group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                        isActive
                          ? "bg-sidebar-active border-l-2 border-foreground text-foreground font-semibold"
                          : "text-foreground hover:bg-muted/50 border-l-2 border-transparent",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-[11px] font-semibold uppercase text-foreground",
                        )}
                      >
                        {ws.name[0] || "W"}
                      </span>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="truncate text-[12px] font-medium leading-tight">{ws.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                          {ws.slug} · {ws.scan_count} scan{ws.scan_count === 1 ? "" : "s"}
                        </p>
                      </div>
                      {isActive && (
                        <Check size={14} weight="regular" className="shrink-0 text-foreground" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-border/80 bg-muted/25 p-1.5 space-y-1">
              {active && (
                <button
                  type="button"
                  onClick={handleSettings}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <GearSix size={14} weight="duotone" className="shrink-0 text-muted-foreground" />
                  <span className="truncate">Workspace settings</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] font-medium text-accent transition-colors hover:bg-accent/10"
              >
                <Plus size={13} weight="bold" className="shrink-0" />
                <span className="truncate">Create new workspace</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Create Workspace Modal */}
      {showQuickModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-2xl text-foreground"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-ws-title"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent border border-accent/25">
                  <ShieldCheck size={16} weight="duotone" />
                </span>
                <h2 id="quick-ws-title" className="text-sm font-semibold tracking-tight">
                  New Project Workspace
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickModal(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close modal"
              >
                <X size={15} weight="bold" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateSubmit} className="mt-4 space-y-3.5">
              <div>
                <label
                  htmlFor="quick-ws-name"
                  className="block text-[11px] font-mono font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Workspace Name
                </label>
                <input
                  id="quick-ws-name"
                  type="text"
                  autoFocus
                  value={quickName}
                  onChange={(e) => {
                    setQuickName(e.target.value);
                    setQuickError(null);
                  }}
                  placeholder="e.g. FinTech Security Core"
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/30"
                />
                {quickName.trim() && (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Slug: <span className="text-accent font-semibold">{toSlug(quickName)}</span>
                  </p>
                )}
              </div>

              {quickError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
                  {quickError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickModal(false);
                    void navigate({ to: "/workspace/new" });
                  }}
                  className="text-[11px] text-muted-foreground underline hover:text-foreground"
                >
                  Full setup page
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickModal(false)}
                    className="rounded-md px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createWorkspaceMutation.isPending || !quickName.trim()}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 disabled:opacity-50"
                  >
                    {createWorkspaceMutation.isPending ? (
                      <>
                        <CircleNotch size={12} className="animate-spin" />
                        Creating…
                      </>
                    ) : (
                      "Create"
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
