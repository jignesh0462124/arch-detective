import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ScanLine,
  ShieldAlert,
  FileText,
  ChevronRight,
  Search,
} from "lucide-react";
import { ThemeToggle } from "@/components/brutal/ThemeToggle";
import { ArchonLogo } from "@/components/ui/ArchonLogo";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";


const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/new-scan", label: "New scan", icon: ScanLine },
  { to: "/findings", label: "Findings", icon: ShieldAlert },
  { to: "/reports", label: "Reports", icon: FileText },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1760px]">
        {/* Sidebar */}
        <aside
          data-testid="desktop-sidebar"
          className="sticky top-0 hidden h-dvh w-[232px] shrink-0 self-start flex-col overflow-y-auto border-r border-border bg-sidebar px-4 py-5 lg:flex"
        >
          <Link
            to="/"
            className="group flex min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-active"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ArchonLogo size={20} variant="mono" className="text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-none">
                Archon
              </div>
              <div className="mt-1 text-[11px] leading-none text-muted-foreground">
                Audit engine
              </div>
            </div>
          </Link>

          <nav className="mt-7 flex flex-col gap-1" aria-label="Workspace navigation">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-xs font-medium text-muted-foreground">Workspace</p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
                Live
              </span>
            </div>
            {NAV.map((item) => {
              const active = pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group flex h-10 items-center gap-3 rounded-lg border px-3 text-[13px] font-medium transition-colors",
                    active
                      ? "border-border bg-sidebar-active text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-sidebar-active hover:text-foreground",
                  )}
                >
                  <Icon size={16} strokeWidth={1.9} className="shrink-0" />
                  <span>{item.label}</span>
                  {active ? (
                    <ChevronRight size={14} strokeWidth={2} className="ml-auto" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-lg border border-border bg-sidebar-active p-3.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-success" />
              <span className="truncate text-xs font-semibold">Groq / Llama 3 70B</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Latency</p>
                <p className="mt-0.5 font-mono text-[11px] font-medium">312 ms</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Throughput</p>
                <p className="mt-0.5 font-mono text-[11px] font-medium">740 tok/s</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-4 py-4 pb-24 sm:px-6 sm:py-5 lg:px-7 lg:pb-7 xl:px-8">
          {/* Header */}
          <header className="rounded-xl hairline bg-card shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                {subtitle ? (
                  <p className="section-title">
                    {subtitle}
                  </p>
                ) : null}
                <h1 className="mt-0.5 text-lg font-medium leading-tight sm:text-xl">
                  {title}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm hairline lg:flex">
                  <Search
                    size={13}
                    strokeWidth={2}
                    className="text-muted-foreground"
                  />
                  <input
                    placeholder="Search findings, scans, controls..."
                    className="w-56 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                  />
                  <kbd className="rounded border hairline px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
                    Ctrl K
                  </kbd>
                </div>
                <ThemeToggle />
                {actions}
              </div>
            </div>
          </header>

          <div className="mt-5">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card lg:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex justify-center py-2">
                <Link
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium",
                    active
                      ? "bg-background text-foreground hairline"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon size={16} strokeWidth={2} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
