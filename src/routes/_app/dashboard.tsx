import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ScanLine,
  CheckCircle2,
  XCircle,
  Zap,
  Activity,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { SectionCard } from "@/components/ui/section-card";
import { StatTile } from "@/components/ui/stat-tile";
import { CodePanel } from "@/components/ui/code-panel";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { CoverageBar } from "@/components/ui/coverage-bar";
import { PipelineList, PipelineStep } from "@/components/ui/pipeline-step";
import { COVERAGE, FINDINGS, FRAMEWORKS, SCANS, type SeverityLevel } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Archon" },
      { name: "description", content: "Overview of active scans, open findings, and compliance posture across frameworks." },
      { property: "og:title", content: "Dashboard · Archon" },
      { property: "og:description", content: "Overview of active scans, open findings, and compliance posture across frameworks." },
    ],
  }),
  component: DashboardPage,
});

const STATS = [
  { code: "01 // OPEN", label: "Open findings", value: "47", trend: "+6 today", accent: true },
  { code: "02 // CRIT", label: "Critical", value: "8", trend: "+2 / 24h" },
  { code: "03 // POSTURE", label: "Compliance", value: "78%", trend: "+4 pts" },
  { code: "04 // SHIPPED", label: "Reports Q2", value: "12", trend: "Cycle" },
];

const FEED = [
  { time: "14:02", sev: "CRIT" as SeverityLevel, id: "F-2041", msg: "hard-coded AWS key" },
  { time: "13:51", sev: "CRIT" as SeverityLevel, id: "F-2039", msg: "0.0.0.0/0 → :5432" },
  { time: "13:28", sev: "HIGH" as SeverityLevel, id: "F-2037", msg: "MFA absent (admin)" },
  { time: "13:02", sev: "HIGH" as SeverityLevel, id: "F-2031", msg: "PII in logs" },
  { time: "12:14", sev: "MED" as SeverityLevel, id: "F-2024", msg: "SSE off (audit-logs)" },
];

function DashboardPage() {
  return (
    <AppShell
      subtitle="Workspace · Acme Cloud"
      title="Audit dashboard"
      actions={
        <Link to="/new-scan">
          <BrutalButton variant="primary">
            <ScanLine size={15} strokeWidth={2} /> New scan
          </BrutalButton>
        </Link>
      }
    >
      <div className="space-y-5">
        {/* Hero — 7/5 */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Live posture */}
          <SectionCard
            variant="default"
            className="lg:col-span-7"
            padding="md"
            eyebrow={
              <span className="inline-flex items-center gap-1.5">
                <Zap size={10} strokeWidth={2.5} className="text-primary" /> LIVE
              </span>
            }
            title="Posture overview"
            description="Continuous monitoring across all production assets."
            actions={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
                Streaming
              </span>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 hairline rounded-xl overflow-hidden">
              {STATS.map((s) => (
                <StatTile
                  key={s.code}
                  code={s.code}
                  label={s.label}
                  value={s.value}
                  trend={s.trend}
                  accent={s.accent}
                />
              ))}
            </div>
          </SectionCard>

          {/* Agent feed */}
          <div className="lg:col-span-5">
            <CodePanel filename="agent.log" variant="terminal">
              <div className="text-success">$ archon --watch findings</div>
              <div className="mt-0.5 text-cream/40">
                Streaming agent decisions...
              </div>

              <div className="mt-4 space-y-1.5">
                {FEED.map((entry) => {
                  const color =
                    entry.sev === "CRIT"
                      ? "text-primary"
                      : entry.sev === "HIGH"
                        ? "text-secondary"
                        : "text-cream/60";
                  return (
                    <div key={entry.id} className="flex items-center gap-3 text-[11px]">
                      <span className="text-primary tabular-nums">{entry.time}</span>
                      <span className={`font-medium ${color}`}>{entry.sev}</span>
                      <span className="font-mono text-cream/40">{entry.id}</span>
                      <span className="text-cream/80 truncate">{entry.msg}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 space-y-1.5 border-t border-cream/15 pt-4">
                <div className="flex justify-between text-cream/60">
                  <span>Queue depth</span>
                  <span className="text-cream">47</span>
                </div>
                <div className="flex justify-between text-cream/60">
                  <span>MTTR (P50)</span>
                  <span className="text-success">2h 14m</span>
                </div>
                <div className="flex justify-between text-cream/60">
                  <span>Agent latency</span>
                  <span className="text-cream">312 ms</span>
                </div>
              </div>
            </CodePanel>
          </div>
        </section>

        {/* Scans + Coverage */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <SectionCard
            className="lg:col-span-8"
            padding="none"
            eyebrow="// Live feed"
            title="Recent scans"
            actions={
              <BrutalButton variant="ghost" size="sm">
                View all <ArrowUpRight size={12} />
              </BrutalButton>
            }
          >
            <DataTable
              columns={scanColumns}
              rows={SCANS}
              rowKey={(s) => s.id}
            />
          </SectionCard>

          <SectionCard
            className="lg:col-span-4"
            variant="default"
            eyebrow="// Posture"
            title="Framework coverage"
          >
            <div className="space-y-4">
              {COVERAGE.map((c) => (
                <CoverageBar
                  key={c.framework}
                  label={c.framework}
                  pct={c.pct}
                />
              ))}
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-cream px-3 py-2.5 text-[12px] dark:bg-cream-deep">
                <Activity
                  size={13}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0 text-primary"
                />
                <span>
                  Agent suggests focusing on{" "}
                  <span className="font-semibold">NIST 800-53 SC-7</span> next.
                </span>
              </div>
            </div>
          </SectionCard>
        </section>

        {/* Top findings */}
        <SectionCard
          variant="dark"
          eyebrow="// Triage"
          title="Top severity findings"
          description="Highest-impact issues ranked by blast radius and exploitability."
          actions={
            <Link
              to="/findings"
              className="inline-flex items-center gap-1.5 rounded-lg border hairline border-cream/20 px-3 py-1.5 text-[12px] font-medium text-cream transition-colors hover:bg-cream/10"
            >
              Open queue <ArrowUpRight size={12} />
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            <div className="md:col-span-4">
              <p className="section-title text-secondary">// Why these matter</p>
              <p className="mt-2 text-sm leading-relaxed text-cream/70">
                Critical findings combine CVSS scores with reachability
                analysis. Remediating the top four closes 71% of attacker
                surface area.
              </p>
              <Link
                to="/findings"
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground transition-all hover:-translate-y-px hover:shadow-soft-lg"
              >
                <ShieldAlert size={13} /> View full queue
              </Link>
            </div>

            <div className="md:col-span-8">
              <PipelineList dark>
                {FINDINGS.slice(0, 4).map((f, i) => (
                  <PipelineStep
                    key={f.id}
                    index={i + 1}
                    state={f.severity === "critical" ? "active" : "idle"}
                    title={f.title}
                    dark
                    note={
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono">{f.id}</span>
                        <span>·</span>
                        <span>{f.stride}</span>
                        <span>·</span>
                        <span>{f.detected}</span>
                      </span>
                    }
                    badge={
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          f.severity === "critical"
                            ? "bg-primary/20 text-primary"
                            : "border hairline border-cream/15 text-cream/70",
                        ].join(" ")}
                      >
                        {f.severity}
                      </span>
                    }
                  />
                ))}
              </PipelineList>
            </div>
          </div>
        </SectionCard>

        {/* Frameworks grid */}
        <SectionCard
          variant="muted"
          padding="md"
          eyebrow="// Frameworks"
          title="Status dashboard"
          actions={
            <span className="text-xs font-medium text-muted-foreground">
              {FRAMEWORKS.length} active
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {FRAMEWORKS.map((f) => (
              <div
                key={f.id}
                className="rounded-xl bg-card p-3 hairline shadow-soft"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium tracking-tight truncate">
                    {f.label}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                </div>
                <div className="mt-3 text-xl font-semibold tabular-nums">
                  {f.controls}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  controls
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

type Scan = (typeof SCANS)[number];

const scanColumns: DataTableColumn<Scan>[] = [
  {
    key: "id",
    header: "Scan",
    cell: (s) => (
      <span className="font-mono text-[12px] text-muted-foreground">
        {s.id}
      </span>
    ),
    width: "120px",
  },
  {
    key: "target",
    header: "Target",
    cell: (s) => (
      <div>
        <div className="text-[13px] font-medium">{s.target}</div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {s.frameworks.join(" · ")}
        </div>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (s) => <ScanStatus status={s.status} />,
    width: "120px",
  },
  {
    key: "findings",
    header: "Findings",
    align: "right",
    mono: true,
    cell: (s) =>
      s.findings ? (
        <>
          <span className="font-semibold">{s.findings}</span>{" "}
          <span className="text-muted-foreground text-[11px]">found</span>
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    width: "110px",
  },
  {
    key: "duration",
    header: "Duration",
    align: "right",
    mono: true,
    cell: (s) => (
      <span className="text-muted-foreground">{s.duration}</span>
    ),
    width: "100px",
  },
];

function ScanStatus({ status }: { status: Scan["status"] }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
        <CheckCircle2 size={11} strokeWidth={2} /> Complete
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/15 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse-dot" />
        Running
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      <XCircle size={11} strokeWidth={2} /> Failed
    </span>
  );
}