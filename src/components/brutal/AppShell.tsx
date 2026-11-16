import { AccountMenu } from "@/components/auth/AccountMenu";
import { lazy, Suspense, useState, useEffect, useRef, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  SquaresFour,
  TreeStructure,
  BugBeetle,
  ListChecks,
  FileText,
  CaretRight,
  CaretLeft,
  ClockCounterClockwise,
  FolderOpen,
  UserCircle,
  User,
  DotsThreeCircle,
  Gear,
  List,
  X,
  Buildings,
} from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/brutal/ThemeToggle";
import { ArchonWordmark } from "@/components/ui/ArchonWordmark";
import { ArchonLogo } from "@/components/ui/ArchonLogo";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { AiModelSelector } from "@/components/ai-assistant/AiModelSelector";
import type { ReactNode, RefObject } from "react";
import { api } from "@/lib/api/client";
import type { HealthResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { getStoredModelId, setStoredModelId } from "@/lib/api/ai-models";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarPreference } from "@/lib/sidebar";
import { profileAvatar } from "@/lib/profileAppearance";
import { AdvisorIcon } from "@/components/ui/AdvisorIcon";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: SquaresFour },
  { to: "/workspace", label: "Codebase Audit", icon: FolderOpen },
  { to: "/attack-graph", label: "Attack Graph", icon: TreeStructure },
  { to: "/findings", label: "Findings", icon: BugBeetle },
  { to: "/fix-verification", label: "Fix verification", icon: ListChecks },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/audit-log", label: "Audit log", icon: ClockCounterClockwise },
  { to: "/advisor", label: "Security Advisor", icon: AdvisorIcon },
  { to: "/settings", label: "Settings", icon: Gear },
] as const;

const AiAssistantPanel = lazy(() =>
  import("@/components/ai-assistant/AiAssistantPanel").then((module) => ({
    default: module.AiAssistantPanel,
  })),
);

const MOBILE_NAV = NAV.slice(0, 5);
const MOBILE_MORE_NAV = [
  NAV[5],
  NAV[6],
  NAV[7],
  NAV[8],
  { to: "/profile", label: "Profile", icon: UserCircle },
] as const;

type SidebarContentsProps = {
  compact: boolean;
  pathname: string;
  backendPending: boolean;
  backendOnline: boolean;
  backendStatus: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  initials: string;
  workspaceRef?: RefObject<HTMLDivElement | null>;
  expandWorkspace?: () => void;
  onCurrentNavigate?: () => void;
};
function SidebarContents({
  compact,
  pathname,
  backendPending,
  backendOnline,
  backendStatus,
  displayName,
  email,
  avatarUrl,
  initials,
  workspaceRef,
  expandWorkspace,
  onCurrentNavigate,
}: SidebarContentsProps) {
  return (
    <>
      <Link
        to="/"
        aria-label="Archon home"
        className="group flex min-h-11 items-center px-2 py-1.5 transition-colors hover:bg-sidebar-active"
      >
        {compact ? <ArchonLogo size={28} /> : <ArchonWordmark />}
      </Link>
      {compact && (
        <button
          type="button"
          onClick={expandWorkspace}
          aria-label="Expand sidebar to choose workspace"
          title="Choose workspace"
          className="mt-3.5 flex min-h-11 w-full items-center justify-center rounded-md hover:bg-sidebar-active focus-visible:outline focus-visible:outline-accent"
        >
          <Buildings size={20} />
        </button>
      )}
      {/* Workspace switcher */}
      <div ref={workspaceRef} className={compact ? "hidden" : "mt-3.5 w-full"}>
        <WorkspaceSwitcher />
      </div>
      <nav className="mt-5 flex flex-col gap-1" aria-label="Workspace navigation">
        <div className={compact ? "hidden" : "mb-2 flex items-center justify-between px-2"}>
          <p className="text-xs font-medium text-muted-foreground">Navigation</p>
          {(backendPending || backendOnline) && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium",
                backendPending ? "text-muted-foreground" : "text-success",
              )}
              title={`ThreatLens backend: ${backendStatus.toLowerCase()}`}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  backendPending ? "bg-muted-foreground" : "bg-success animate-pulse-dot",
                )}
              />
              {backendStatus}
            </span>
          )}
        </div>
        {NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (pathname === item.to) onCurrentNavigate?.();
              }}
              title={compact ? item.label : undefined}
              aria-label={compact ? item.label : undefined}
              className={cn(
                "group relative flex min-h-11 items-center gap-3 border-l-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-accent",
                compact ? "justify-center px-0" : "px-3",
                active
                  ? "border-l-accent bg-sidebar-active text-foreground"
                  : "border-l-transparent text-muted-foreground hover:bg-sidebar-active hover:text-foreground",
              )}
            >
              <Icon
                size={17}
                weight={active ? "fill" : "regular"}
                className="flex shrink-0 items-center gap-2"
              />
              <span className={compact ? "sr-only" : undefined}>{item.label}</span>
              {active && !compact ? (
                <CaretRight size={14} weight="bold" className="ml-auto" />
              ) : null}
            </Link>
          );
        })}
      </nav>
      {/* Profile chip — sticks to bottom */}
      <Link
        to="/profile"
        aria-label="Profile"
        onClick={() => {
          if (pathname === "/profile") onCurrentNavigate?.();
        }}
        title={compact ? "Profile" : undefined}
        aria-current={pathname.startsWith("/profile") ? "page" : undefined}
        className={cn(
          "mt-auto flex items-center gap-2.5 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-sidebar-active",
          pathname.startsWith("/profile") && "border-border bg-sidebar-active",
        )}
      >
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
              {initials}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-sidebar bg-success" />
        </div>
        <div className={compact ? "hidden" : "min-w-0 flex-1"}>
          <p className="truncate text-[12px] font-semibold leading-tight">
            {displayName ?? email ?? "Profile"}
          </p>
          {email && displayName && (
            <p className="truncate text-[10px] text-muted-foreground">{email}</p>
          )}
        </div>
        {!compact && <User size={13} className="shrink-0 text-muted-foreground" />}
      </Link>
    </>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  immersive = false,
  layout = "default",
  tools,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  immersive?: boolean;
  layout?: "default" | "workbench";
  tools?: ReactNode;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const drawerTrigger = useRef<HTMLButtonElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const focusWorkspace = useRef(false);
  const drawerId = useId();
  const sidebarId = useId();
  const [activeModelId, setActiveModelId] = useState<string>(() => getStoredModelId());

  // Sync model change events across components
  useEffect(() => {
    const handleModelChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ modelId: string }>;
      if (customEvent.detail?.modelId) {
        setActiveModelId(customEvent.detail.modelId);
      }
    };
    window.addEventListener("threatlens-model-changed", handleModelChange);
    return () => {
      window.removeEventListener("threatlens-model-changed", handleModelChange);
    };
  }, []);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdvisorPage = pathname.startsWith("/advisor");
  const { collapsed, setSidebarPreference } = useSidebarPreference(pathname);
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!collapsed && focusWorkspace.current) {
      focusWorkspace.current = false;
      workspaceRef.current?.querySelector("button")?.focus();
    }
  }, [collapsed]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      if (desktop.matches) setDrawerOpen(false);
    };
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    if (immersive) {
      setDrawerOpen(false);
      setMobileMoreOpen(false);
    }
  }, [immersive]);
  useEffect(() => {
    const dialog = drawer.current;
    if (!drawerOpen || immersive) {
      if (dialog?.open) dialog.close();
      return;
    }
    dialog?.showModal();
    const trigger = drawerTrigger.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog?.open) dialog.close();
      if (trigger?.isConnected && window.innerWidth < 1024) trigger.focus({ preventScroll: true });
    };
  }, [drawerOpen, immersive]);
  useEffect(() => setMobileMoreOpen(false), [pathname]);
  useEffect(() => {
    if (isAdvisorPage) setAiOpen(false);
  }, [isAdvisorPage]);
  const { user } = useAuth();
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.display_name as string | undefined) ||
    null;
  const email = user?.email ?? null;
  const avatarUrl = profileAvatar(user?.user_metadata);
  const initials = (() => {
    const n = displayName;
    if (n && n.trim()) {
      const p = n.trim().split(" ");
      return p.length >= 2
        ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
        : p[0].slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return "?";
  })();
  const backendHealth = useQuery({
    queryKey: ["backend-health"],
    queryFn: async () => {
      try {
        return await api.get<HealthResponse>("/health");
      } catch {
        return { status: "offline", service: "threatlens", version: "1.0.0" } as HealthResponse;
      }
    },
    enabled: typeof window !== "undefined",
    retry: 0,
    refetchInterval: 30_000,
  });
  const backendOnline = backendHealth.data?.status === "healthy";
  const backendStatus = backendHealth.isPending
    ? "Checking"
    : backendOnline
      ? "API online"
      : "API offline";

  const sidebarProps = {
    pathname,
    backendPending: backendHealth.isPending,
    backendOnline,
    backendStatus,
    displayName,
    email,
    avatarUrl,
    initials,
  };
  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground",
        layout === "workbench" && "workbench-shell",
        immersive && "workbench-shell-expanded",
      )}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1760px]">
        {/* Sidebar */}
        <aside
          id={sidebarId}
          data-testid="desktop-sidebar"
          data-collapsed={collapsed}
          className={cn(
            "sticky top-0 z-30 hidden h-dvh shrink-0 self-start border-r border-border bg-sidebar lg:block",
            "transition-[width] duration-150 motion-reduce:transition-none",
            collapsed ? "w-[72px]" : "w-[248px]",
          )}
        >
          <div className="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden px-3 py-4">
            <SidebarContents
              {...sidebarProps}
              compact={collapsed}
              workspaceRef={workspaceRef}
              expandWorkspace={() => {
                focusWorkspace.current = true;
                setSidebarPreference("expanded");
              }}
            />
          </div>
          <button
            type="button"
            data-testid="desktop-sidebar-toggle"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-controls={sidebarId}
            onClick={() => setSidebarPreference(collapsed ? "expanded" : "collapsed")}
            className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border bg-sidebar text-foreground shadow-sm transition-colors hover:border-accent hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {collapsed ? (
              <CaretRight size={19} weight="bold" aria-hidden="true" />
            ) : (
              <CaretLeft size={19} weight="bold" aria-hidden="true" />
            )}
          </button>
        </aside>

        {/* Main */}
        <main
          className={
            isAdvisorPage
              ? "flex h-[calc(100dvh-68px)] min-w-0 flex-1 flex-col bg-card lg:h-dvh"
              : "archon-app-canvas min-w-0 flex-1 px-4 py-4 pb-24 sm:px-6 sm:py-5 lg:px-7 lg:pb-7 xl:px-8"
          }
        >
          {/* Header */}
          <header className="border-b border-border bg-background">
            <div className="flex items-center justify-between gap-2 px-2 py-3 sm:gap-3 sm:px-5">
              <button
                ref={drawerTrigger}
                type="button"
                aria-label="Open navigation"
                aria-expanded={drawerOpen}
                aria-controls={drawerId}
                className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-card hover:bg-secondary focus-visible:outline focus-visible:outline-accent lg:hidden"
                onClick={() => {
                  setMobileMoreOpen(false);
                  setDrawerOpen(true);
                }}
              >
                <List size={20} />
              </button>
              <div className="min-w-0 flex-1">
                {subtitle ? <p className="section-title truncate">{subtitle}</p> : null}
                <h1 className="mt-0.5 text-base font-semibold leading-tight sm:text-lg lg:text-xl truncate text-foreground">
                  {title}
                </h1>
              </div>
              <div
                className="flex shrink-0 items-center gap-1.5 sm:gap-2"
                role="toolbar"
                aria-label="Application tools"
              >
                {tools}
                {/* Model switcher in top bar */}
                {!isAdvisorPage && (
                  <div className="hidden md:block">
                    <AiModelSelector
                      selectedModel={activeModelId}
                      onSelectModel={(id) => {
                        setActiveModelId(id);
                        setStoredModelId(id);
                      }}
                      toolbar
                    />
                  </div>
                )}

                {/* Security guidance; same neutral icon treatment as other toolbar controls. */}
                {!isAdvisorPage && (
                  <button
                    id="ai-assistant-toggle"
                    type="button"
                    onClick={() => setAiOpen((v) => !v)}
                    aria-expanded={aiOpen}
                    aria-controls="ai-assistant-panel"
                    aria-label="Open Security Advisor"
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-md border text-xs font-mono font-bold transition-colors md:h-9 md:w-auto md:px-3",
                      aiOpen
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary hover:border-accent/40",
                    )}
                  >
                    <AdvisorIcon
                      size={14}
                      className={aiOpen ? "text-accent-foreground" : "text-muted-foreground"}
                    />
                    <span className="hidden md:inline">Security Advisor</span>
                  </button>
                )}
                <div
                  className="flex shrink-0 items-center gap-1.5 sm:gap-2"
                  data-testid="account-tools"
                >
                  <ThemeToggle toolbar />
                  <AccountMenu />
                </div>
              </div>
            </div>
            {actions ? (
              <div className="flex min-w-0 justify-end overflow-x-auto border-t border-border/70 px-3 py-2 sm:px-5">
                <div className="flex shrink-0 items-center gap-2">{actions}</div>
              </div>
            ) : null}
          </header>

          <div className={isAdvisorPage ? "flex min-h-0 min-w-0 flex-1" : "mt-5 min-w-0"}>
            {children}
          </div>
        </main>
      </div>

      <dialog
        ref={drawer}
        id={drawerId}
        aria-label="Application navigation"
        className="app-navigation-drawer"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
            ),
          ).filter((item) => item.getClientRects().length > 0);
          const first = items[0],
            last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onCancel={() => setDrawerOpen(false)}
        onClose={() => setDrawerOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX > bounds.right ||
              event.clientX < bounds.left ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              setDrawerOpen(false);
          }
        }}
      >
        {drawerOpen && (
          <div className="flex min-h-full flex-col px-3 pb-5 pt-3">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                autoFocus
                aria-label="Close navigation"
                className="flex size-11 items-center justify-center rounded-md border border-border hover:bg-secondary focus-visible:outline focus-visible:outline-accent"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContents
              {...sidebarProps}
              compact={false}
              onCurrentNavigate={() => setDrawerOpen(false)}
            />
          </div>
        )}
      </dialog>
      {/* Mobile bottom nav */}
      {mobileMoreOpen ? (
        <div className="fixed bottom-[68px] right-3 z-50 w-56 rounded-lg border border-border bg-card p-1.5 shadow-xl lg:hidden">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            More
          </p>
          {MOBILE_MORE_NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-xs font-semibold",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon size={17} weight={active ? "fill" : "regular"} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card lg:hidden"
        aria-label="Mobile navigation"
      >
        <ul className="grid grid-cols-6">
          {MOBILE_NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to} className="min-w-0 py-1.5">
                <Link
                  to={item.to}
                  className={cn(
                    "mx-0.5 flex h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[9px] font-medium leading-tight",
                    active ? "bg-background text-foreground hairline" : "text-muted-foreground",
                  )}
                >
                  <Icon size={18} weight={active ? "fill" : "bold"} />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 py-1.5">
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                setMobileMoreOpen((open) => !open);
              }}
              aria-expanded={mobileMoreOpen}
              aria-label="More navigation"
              className={cn(
                "mx-0.5 flex h-14 w-[calc(100%-0.25rem)] flex-col items-center justify-center gap-1 rounded-md px-1 text-[9px] font-medium leading-tight",
                mobileMoreOpen || MOBILE_MORE_NAV.some((item) => pathname.startsWith(item.to))
                  ? "bg-background text-foreground hairline"
                  : "text-muted-foreground",
              )}
            >
              <DotsThreeCircle size={18} weight={mobileMoreOpen ? "fill" : "bold"} />
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* AI Assistant panel — rendered at root so it overlays everything */}
      {aiOpen && !isAdvisorPage && (
        <Suspense fallback={null}>
          <AiAssistantPanel open onClose={() => setAiOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
