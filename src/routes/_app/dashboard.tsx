import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ScanLine,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Activity,
} from "lucide-react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
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

const STATS = [
  { code: "01 // OPEN", label: "Open Findings", value: "47", trend: "+6 today", accent: true },
  { code: "02 // CRIT", label: "Critical", value: "8", trend: "+2 / 24h" },
  { code: "03 // POSTURE", label: "Compliance", value: "78%", trend: "+4 pts" },
  { code: "04 // SHIPPED", label: "Reports Q2", value: "12", trend: "Cycle" },
];

function DashboardPage() {
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
      <div className="border-[3px] border-ink bg-card shadow-brutal overflow-hidden">
        {/* HERO STRIP — asymmetric 7/5 */}
        <section className="grid grid-cols-1 lg:grid-cols-12 border-b-[3px] border-ink">
          {/* Left: live posture summary */}
          <div className="lg:col-span-7 p-5 md:p-7 lg:border-r-[3px] border-b-[3px] lg:border-b-0 border-ink bg-card flex flex-col justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1 border border-ink bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground">
                  <Zap size={10} strokeWidth={3} /> LIVE
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground italic">
                  Continuous monitoring · Acme Cloud
                </span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold leading-[0.9] tracking-tighter">
                <span className="text-primary">47</span> OPEN
                <br />
                FINDINGS.
              </h2>
              <p className="mt-4 max-w-md text-sm font-medium text-muted-foreground">
                8 critical · 11 high · 19 medium · 9 low. Triage queue refreshed
                2 minutes ago by the agentic engine.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 border-t-[2px] border-ink">
              {STATS.map((s, i) => (
                <div
                  key={s.code}
                  className={[
                    "p-3 sm:p-4",
                    i < 3 ? "border-r-[2px] border-ink" : "",
                    i < 2 ? "border-b-[2px] sm:border-b-0 border-ink" : "",
                    s.accent ? "bg-cream" : "",
                  ].join(" ")}
                >
                  <div className={["font-mono text-[10px] mb-2 tracking-wider", s.accent ? "text-primary" : "text-muted-foreground"].join(" ")}>
                    {s.code}
                  </div>
                  <div className="text-2xl font-bold tracking-tight tabular-nums">{s.value}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</div>
                  <div className="mt-1 text-[10px] font-mono text-foreground/60">{s.trend}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: terminal feed */}
          <div className="lg:col-span-5 bg-ink p-5 md:p-6 flex flex-col text-cream">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
                <span className="h-2.5 w-2.5 rounded-full bg-success" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-cream/40">agent.log</span>
            </div>
            <div className="flex-1 font-mono text-[11px] leading-relaxed">
              <div className="text-success mb-1">$ sentinel --watch findings</div>
              <div className="text-cream/40 mb-3">Streaming agent decisions…</div>
              <div className="mb-1"><span className="text-primary">14:02</span> <span className="text-secondary">CRIT</span> F-2041 hard-coded AWS key</div>
              <div className="mb-1"><span className="text-primary">13:51</span> <span className="text-secondary">CRIT</span> F-2039 0.0.0.0/0 → :5432</div>
              <div className="mb-1"><span className="text-primary">13:28</span> <span className="text-cream">HIGH</span> F-2037 MFA absent (admin)</div>
              <div className="mb-1"><span className="text-primary">13:02</span> <span className="text-cream">HIGH</span> F-2031 PII in logs</div>
              <div className="mb-3"><span className="text-primary">12:14</span> <span className="text-cream/60">MED</span>  F-2024 SSE off (audit-logs)</div>

              <div className="mt-3 border border-cream/20 bg-cream/5 p-3">
                <div className="flex justify-between text-cream/60 mb-1.5"><span>QUEUE DEPTH</span><span className="text-cream">47</span></div>
                <div className="flex justify-between text-cream/60 mb-1.5"><span>MTTR (P50)</span><span className="text-success">2h 14m</span></div>
                <div className="flex justify-between text-cream/60"><span>AGENT LATENCY</span><span className="text-cream">312 ms</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* SCANS + COVERAGE — split */}
        <section className="grid grid-cols-1 lg:grid-cols-12 border-b-[3px] border-ink">
          {/* Recent scans */}
          <div className="lg:col-span-8 bg-card lg:border-r-[3px] border-b-[3px] lg:border-b-0 border-ink">
            <div className="flex items-center justify-between border-b-[2px] border-ink px-5 py-3 bg-cream">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[10px] text-primary tracking-wider shrink-0">// LIVE FEED</span>
                <h2 className="text-sm font-bold uppercase tracking-tight truncate">Recent scans</h2>
              </div>
              <BrutalButton variant="ghost" size="sm">
                View all <ArrowUpRight size={12} />
              </BrutalButton>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-xs">
                <thead>
                  <tr className="border-b-[2px] border-ink bg-cream/40 text-left">
                    <th className="px-5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Scan</th>
                    <th className="px-5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Target</th>
                    <th className="px-5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status</th>
                    <th className="px-5 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Findings</th>
                    <th className="px-5 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {SCANS.map((s) => (
                    <tr key={s.id} className="group border-b-[1px] border-ink/15 last:border-b-0 hover:bg-cream/60 transition-colors">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] font-semibold text-muted-foreground">{s.id}</td>
                      <td className="px-5 py-3">
                        <div className="text-xs font-bold group-hover:text-primary transition-colors">{s.target}</div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          {s.frameworks.join(" · ")}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {s.status === "complete" && (
                          <span className="inline-flex items-center gap-1 border border-ink bg-success/15 text-success px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle2 size={10} strokeWidth={2.5} /> Complete
                          </span>
                        )}
                        {s.status === "running" && (
                          <span className="inline-flex items-center gap-1 border border-ink bg-secondary text-secondary-foreground px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            <span className="h-1.5 w-1.5 rounded-full bg-ink animate-pulse" /> Running
                          </span>
                        )}
                        {s.status === "failed" && (
                          <span className="inline-flex items-center gap-1 border border-ink bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            <XCircle size={10} strokeWidth={2.5} /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[11px]">
                        {s.findings ? (
                          <><span className="font-bold">{s.findings}</span> <span className="text-muted-foreground">found</span></>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[11px] text-muted-foreground">{s.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Coverage panel */}
          <div className="lg:col-span-4 p-5 bg-card">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] text-primary tracking-wider">// POSTURE</span>
            </div>
            <h2 className="text-sm font-bold uppercase tracking-tight mb-4">Framework coverage</h2>
            <div className="space-y-3">
              {COVERAGE.map((c) => (
                <div key={c.framework}>
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="font-bold tracking-tight uppercase">{c.framework}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{c.pct}%</span>
                  </div>
                  <div className="h-2 border-[1.5px] border-ink bg-cream overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-[2px] border-ink bg-cream p-3 text-[11px] flex gap-2">
              <Activity size={12} className="mt-0.5 shrink-0 text-primary" strokeWidth={2.5} />
              <span>
                Agent suggests focusing on{" "}
                <span className="font-bold">NIST 800-53 SC-7</span> next.
              </span>
            </div>
          </div>
        </section>

        {/* TOP FINDINGS — vertical trace on ink */}
        <section className="bg-ink text-cream p-6 md:p-10 border-b-[3px] border-ink">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12">
            <div className="md:w-1/3">
              <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-3">// Triage</p>
              <h2 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight mb-4">
                Top severity findings.
              </h2>
              <p className="text-cream/60 text-sm mb-5">
                Highest-impact issues ranked by blast radius and exploitability.
              </p>
              <Link
                to="/findings"
                className="inline-flex items-center gap-2 border-[2px] border-cream bg-transparent px-4 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-cream hover:bg-cream hover:text-ink transition-colors"
              >
                Open queue <ArrowUpRight size={12} />
              </Link>
            </div>

            <div className="flex-1 border-l-2 border-cream/20 pl-6 md:pl-8 space-y-6">
              {FINDINGS.slice(0, 4).map((f, i) => {
                const isCrit = f.severity === "critical";
                return (
                  <Link
                    key={f.id}
                    to="/findings"
                    className="block relative group"
                  >
                    <div
                      className={[
                        "absolute -left-[33px] md:-left-[41px] top-1 h-4 w-4 border-2 border-cream",
                        isCrit ? "bg-primary" : "bg-cream/20",
                      ].join(" ")}
                    />
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={[
                        "font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border",
                        isCrit ? "bg-primary text-primary-foreground border-primary" : "bg-transparent border-cream/40 text-cream/70",
                      ].join(" ")}>
                        {f.severity}
                      </span>
                      <span className="font-mono text-[10px] text-cream/40 uppercase tracking-wider">{f.stride}</span>
                      <span className="font-mono text-[10px] text-cream/40 ml-auto">{f.detected}</span>
                    </div>
                    <div className="font-mono text-[10px] text-cream/40 mb-1 tracking-wider">{String(i + 1).padStart(2, "0")} // {f.id}</div>
                    <h3 className="text-sm md:text-base font-bold leading-snug group-hover:text-primary transition-colors">{f.title}</h3>
                    <p className="mt-1 text-[11px] text-cream/50 font-mono">{f.component}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* FRAMEWORKS — status dashboard */}
        <section className="p-6 md:p-8 bg-cream">
          <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
            <div>
              <p className="font-mono text-[10px] text-primary tracking-wider mb-1">// FRAMEWORKS</p>
              <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tighter">Status dashboard</h2>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {FRAMEWORKS.length} Active
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {FRAMEWORKS.map((f) => (
              <div key={f.id} className="p-3 border-[2px] border-ink bg-card">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold uppercase tracking-tight truncate">{f.label}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                </div>
                <div className="text-xl font-black tracking-tight tabular-nums">{f.controls}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  Controls
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
