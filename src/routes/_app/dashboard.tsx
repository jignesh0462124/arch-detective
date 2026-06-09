import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ScanLine,
  ShieldAlert,
  Activity,
  FileCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { BrutalBadge } from "@/components/brutal/BrutalBadge";
import { COVERAGE, FINDINGS, FRAMEWORKS, SCANS } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Sentinel" },
      { name: "description", content: "Overview of active scans, open findings, and compliance posture across frameworks." },
      { property: "og:title", content: "Dashboard · Sentinel" },
      { property: "og:description", content: "Overview of active scans, open findings, and compliance posture across frameworks." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const stats = [
    { label: "Open Findings", value: "47", trend: "+6 today", icon: ShieldAlert, tone: "primary" as const, chip: "bg-primary text-primary-foreground", accent: true },
    { label: "Critical", value: "8", trend: "+2 last 24h", icon: AlertTriangle, tone: "gold" as const, chip: "bg-secondary text-secondary-foreground" },
    { label: "Compliance Score", value: "78%", trend: "+4 pts", icon: Activity, tone: "ink" as const, chip: "bg-success/15 text-success" },
    { label: "Reports Shipped", value: "12", trend: "Q2 cycle", icon: FileCheck, tone: "ghost" as const, chip: "bg-cream text-foreground" },
  ];

  return (
    <AppShell
      subtitle="Workspace · Acme Cloud"
      title="Audit dashboard"
      actions={
        <Link to="/new-scan">
          <BrutalButton variant="primary">
            <ScanLine size={16} strokeWidth={2} /> New scan
          </BrutalButton>
        </Link>
      }
    >
      {/* Stat grid */}
      <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4 sm:gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={[
              "relative overflow-hidden rounded-lg border-brutal bg-card p-3.5 shadow-soft transition-shadow hover:shadow-soft-lg",
              s.accent ? "ring-1 ring-primary/20" : "",
            ].join(" ")}
          >
            {s.accent && <span className="absolute left-0 top-0 h-full w-[3px] bg-primary" />}
            <div className="flex items-start justify-between">
              <div className={`flex h-8 w-8 items-center justify-center rounded-md border-brutal ${s.chip}`}>
                <s.icon size={14} strokeWidth={2} />
              </div>
              <BrutalBadge tone={s.tone}>{s.trend}</BrutalBadge>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{s.value}</div>
            <p className="section-title mt-0.5 text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="mt-3 grid gap-3 lg:grid-cols-12 sm:mt-4 sm:gap-4">
        {/* Recent scans */}
        <div className="lg:col-span-8 overflow-hidden rounded-lg border-brutal bg-card shadow-soft">
          <div className="flex items-center justify-between border-b-[1.5px] border-ink px-4 py-2.5">
            <div>
              <p className="section-title text-primary">Live feed</p>
              <h2 className="text-sm font-bold">Recent scans</h2>
            </div>
            <BrutalButton variant="ghost" size="sm">
              View all <ArrowUpRight size={12} />
            </BrutalButton>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-xs">
            <thead>
              <tr className="border-b-[1.5px] border-ink bg-cream/60 text-left">
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Scan</th>
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Target</th>
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Findings</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Duration</th>
              </tr>
            </thead>
            <tbody>
              {SCANS.map((s) => (
                <tr
                  key={s.id}
                  className="group border-b-[1px] border-ink/10 last:border-b-0 transition-colors hover:bg-cream/50"
                >
                  <td className="whitespace-nowrap px-4 py-2.5 align-middle font-mono text-[11px] font-semibold text-muted-foreground">
                    {s.id}
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <div className="text-xs font-semibold group-hover:text-primary transition-colors">{s.target}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {s.frameworks.join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    {s.status === "complete" && (
                      <BrutalBadge tone="success" dot>
                        <CheckCircle2 size={10} strokeWidth={2.5} /> Complete
                      </BrutalBadge>
                    )}
                    {s.status === "running" && (
                      <BrutalBadge tone="gold" dot>
                        Running
                      </BrutalBadge>
                    )}
                    {s.status === "failed" && (
                      <BrutalBadge tone="primary">
                        <XCircle size={10} strokeWidth={2.5} /> Failed
                      </BrutalBadge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-middle text-right font-mono text-[11px]">
                    {s.findings ? (
                      <>
                        <span className="font-semibold">{s.findings}</span>{" "}
                        <span className="text-muted-foreground">findings</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-middle text-right font-mono text-[11px] text-muted-foreground">
                    <Clock size={10} className="mr-1 inline" />
                    {s.duration}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>

        {/* Coverage panel */}
        <div className="lg:col-span-4 rounded-lg border-brutal bg-card p-3 shadow-soft sm:p-4">
          <p className="section-title text-primary">Posture</p>
          <h2 className="text-sm font-bold">Framework coverage</h2>
          <div className="mt-3 space-y-2.5">
            {COVERAGE.map((c) => (
              <div key={c.framework}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold tracking-tight">{c.framework}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{c.pct}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full border-brutal bg-cream">
                  <div
                    className="h-full border-r-[1.5px] border-ink bg-primary"
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-md border-brutal bg-cream/60 p-2.5 text-[11px]">
            <Sparkles size={12} className="mt-0.5 shrink-0 text-primary" strokeWidth={2.5} />
            <span>
              Agent suggests focusing on <span className="font-semibold">NIST 800-53 SC-7</span> next.
            </span>
          </div>
        </div>
      </section>

      {/* Top findings */}
      <section className="mt-4 rounded-lg border-brutal bg-card shadow-soft">
        <div className="flex items-center justify-between border-b-[1.5px] border-ink px-4 py-2.5">
          <div>
            <p className="section-title text-primary">Triage</p>
            <h2 className="text-sm font-bold">Top severity findings</h2>
          </div>
          <Link to="/findings">
            <BrutalButton variant="ghost" size="sm">
              Open queue <ArrowUpRight size={12} />
            </BrutalButton>
          </Link>
        </div>
        <div className="divide-y-[1px] divide-ink/10">
          {FINDINGS.slice(0, 4).map((f) => (
            <Link
              to="/findings"
              key={f.id}
              className="block px-4 py-2.5 transition-colors hover:bg-cream"
            >
              <div className="flex flex-wrap items-center gap-2">
                <BrutalBadge tone={f.severity}>{f.severity}</BrutalBadge>
                <BrutalBadge tone="ghost">{f.stride}</BrutalBadge>
                <span className="font-mono text-[11px] text-muted-foreground">{f.id}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{f.detected}</span>
              </div>
              <h3 className="mt-1.5 text-xs font-semibold">{f.title}</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                <span className="font-mono">{f.component}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {f.controls.map((c) => (
                  <span
                    key={c.framework + c.control}
                    className="rounded-full border-brutal bg-cream px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                  >
                    {c.framework} · {c.control}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Frameworks marquee */}
      <section className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {FRAMEWORKS.map((f) => (
          <div
            key={f.id}
            className="rounded-md border-brutal bg-card px-2 py-2 text-center shadow-brutal-sm"
          >
            <div className="text-xs font-bold">{f.label}</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              {f.controls} controls
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
