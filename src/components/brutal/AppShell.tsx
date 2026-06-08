import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ScanLine,
  ShieldAlert,
  FileText,
  Settings,
  Cpu,
  ChevronRight,
  Search,
} from "lucide-react";
import { ThemeToggle } from "@/components/brutal/ThemeToggle";
import type { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/new-scan", label: "New Scan", icon: ScanLine },
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
      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r-[1.5px] border-ink bg-cream px-5 py-6 lg:flex">
          <Link to="/" className="group flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-brutal bg-primary text-primary-foreground shadow-brutal-sm">
              <Cpu size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-base font-bold leading-none tracking-tight">SENTINEL</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Audit engine
              </div>
            </div>
          </Link>

          <nav className="mt-8 flex flex-col gap-1.5">
            <p className="section-title px-2 pb-2 text-muted-foreground">Workspace</p>
            {NAV.map((item) => {
              const active = pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={[
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "border-brutal bg-secondary text-foreground shadow-brutal-sm"
                      : "border-[1.5px] border-transparent hover:border-ink hover:bg-card",
                  ].join(" ")}
                >
                  <Icon size={16} strokeWidth={2.25} />
                  <span>{item.label}</span>
                  {active ? (
                    <ChevronRight size={14} strokeWidth={2.5} className="ml-auto" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border-brutal bg-card p-4 shadow-brutal-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-success" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Groq · Llama 3 70B
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Avg inference: <span className="font-semibold text-foreground">312 ms</span> ·
              tokens/s 740
            </p>
          </div>

          <Link
            to="/"
            className="mt-3 flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <Settings size={14} /> Settings
          </Link>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
          {/* Header card */}
          <header className="rounded-2xl border-brutal-2 bg-card p-5 shadow-brutal sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="section-title text-primary">{subtitle ?? "Sentinel"}</p>
                <h1 className="mt-1 text-[26px] font-bold tracking-tight sm:text-3xl">
                  {title}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-lg border-brutal bg-cream px-3 py-2 text-sm sm:flex">
                  <Search size={14} strokeWidth={2.25} />
                  <input
                    placeholder="Search findings, scans, controls…"
                    className="w-64 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <kbd className="rounded border-brutal px-1.5 py-0.5 text-[10px] font-semibold">
                    ⌘K
                  </kbd>
                </div>
                <ThemeToggle />
                {actions}
              </div>
            </div>
          </header>

          <div className="mt-6">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav with gold top border */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-[4px] border-gold bg-card lg:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex justify-center py-2">
                <Link
                  to={item.to}
                  className={[
                    "flex flex-col items-center gap-1 rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider",
                    active ? "bg-secondary text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  <Icon size={18} strokeWidth={2.25} />
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
