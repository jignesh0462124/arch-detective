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
    { label: "Open Findings", value: "47", trend: "+6 today", icon: ShieldAlert, tone: "primary" as const },
    { label: "Critical", value: "8", trend: "+2 last 24h", icon: AlertTriangle, tone: "gold" as const },
    { label: "Compliance Score", value: "78%", trend: "+4 pts", icon: Activity, tone: "ink" as const },
    { label: "Reports Shipped", value: "12", trend: "Q2 cycle", icon: FileCheck, tone: "ghost" as const },
  ];

  return (
    <AppShell
      subtitle="Workspace · Acme Cloud"
      title="Audit dashboard"
      actions={
        <Link to="/new-scan">
          <BrutalButton variant="primary">
            <ScanLine size={16} strokeWidth={2.25} /> New scan
          </BrutalButton>
        </Link>
      }
    >
      {/* Stat grid */}
      <section className="grid grid-cols-2 gap-4 sm:gap-5 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border-brutal-2 bg-card p-5 shadow-brutal"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border-brutal bg-cream">
                <s.icon size={18} strokeWidth={2.25} />
              </div>
              <BrutalBadge tone={s.tone}>{s.trend}</BrutalBadge>
            </div>
            <div className="mt-5 text-4xl font-bold tracking-tight">{s.value}</div>
            <p className="section-title mt-1 text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-12">
        {/* Recent scans */}
        <div className="xl:col-span-8 overflow-hidden rounded-xl border-brutal-2 bg-card shadow-brutal">
          <div className="flex items-center justify-between border-b-[1.5px] border-ink px-5 py-4">
            <div>
              <p className="section-title text-primary">Live feed</p>
              <h2 className="text-lg font-bold">Recent scans</h2>
            </div>
            <BrutalButton variant="ghost" size="sm">
              View all <ArrowUpRight size={14} />
            </BrutalButton>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-[1.5px] border-ink bg-cream/60 text-left">
                <th className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Scan</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Target</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Findings</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Duration</th>
              </tr>
            </thead>
            <tbody>
              {SCANS.map((s) => (
                <tr
                  key={s.id}
                  className="group border-b-[1px] border-ink/10 last:border-b-0 transition-colors hover:bg-cream/50"
                >
                  <td className="whitespace-nowrap px-5 py-4 align-middle font-mono text-xs font-semibold text-muted-foreground">
                    {s.id}
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <div className="font-semibold group-hover:text-primary transition-colors">{s.target}</div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {s.frameworks.join(" · ")}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-middle">
                    {s.status === "complete" && (
                      <BrutalBadge tone="success" dot>
                        <CheckCircle2 size={11} strokeWidth={2.5} /> Complete
                      </BrutalBadge>
                    )}
                    {s.status === "running" && (
                      <BrutalBadge tone="gold" dot>
                        Running
                      </BrutalBadge>
                    )}
                    {s.status === "failed" && (
                      <BrutalBadge tone="primary">
                        <XCircle size={11} strokeWidth={2.5} /> Failed
                      </BrutalBadge>
                    )}
                  </td>
                  <td className="px-5 py-4 align-middle text-right font-mono text-xs">
                    {s.findings ? (
                      <>
                        <span className="font-semibold">{s.findings}</span>{" "}
                        <span className="text-muted-foreground">findings</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 align-middle text-right font-mono text-xs text-muted-foreground">
                    <Clock size={11} className="mr-1 inline" />
                    {s.duration}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Coverage panel */}
        <div className="xl:col-span-4 rounded-xl border-brutal-2 bg-card p-5 shadow-brutal">
          <p className="section-title text-primary">Posture</p>
          <h2 className="text-lg font-bold">Framework coverage</h2>
          <div className="mt-5 space-y-4">
            {COVERAGE.map((c) => (
              <div key={c.framework}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold tracking-tight">{c.framework}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.pct}%</span>
                </div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full border-brutal bg-cream">
                  <div
                    className="h-full border-r-[1.5px] border-ink bg-primary"
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-2 rounded-lg border-brutal bg-cream/60 p-3 text-xs">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-primary" strokeWidth={2.5} />
            <span>
              Agent suggests focusing on <span className="font-semibold">NIST 800-53 SC-7</span> next.
            </span>
          </div>
        </div>
      </section>

      {/* Top findings */}
      <section className="mt-6 rounded-xl border-brutal-2 bg-card shadow-brutal">
        <div className="flex items-center justify-between border-b-[1.5px] border-ink px-5 py-4">
          <div>
            <p className="section-title text-primary">Triage</p>
            <h2 className="text-lg font-bold">Top severity findings</h2>
          </div>
          <Link to="/findings">
            <BrutalButton variant="ghost" size="sm">
              Open queue <ArrowUpRight size={14} />
            </BrutalButton>
          </Link>
        </div>
        <div className="divide-y-[1.5px] divide-ink">
          {FINDINGS.slice(0, 4).map((f) => (
            <Link
              to="/findings"
              key={f.id}
              className="block px-5 py-4 transition-colors hover:bg-cream"
            >
              <div className="flex flex-wrap items-center gap-3">
                <BrutalBadge tone={f.severity}>{f.severity}</BrutalBadge>
                <BrutalBadge tone="ghost">{f.stride}</BrutalBadge>
                <span className="font-mono text-xs text-muted-foreground">{f.id}</span>
                <span className="ml-auto text-xs text-muted-foreground">{f.detected}</span>
              </div>
              <h3 className="mt-2 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-mono">{f.component}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.controls.map((c) => (
                  <span
                    key={c.framework + c.control}
                    className="rounded-full border-brutal bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
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
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {FRAMEWORKS.map((f) => (
          <div
            key={f.id}
            className="rounded-lg border-brutal bg-card px-3 py-3 text-center shadow-brutal-sm"
          >
            <div className="text-sm font-bold">{f.label}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {f.controls} controls
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
