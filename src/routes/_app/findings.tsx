import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Filter, X, FileWarning, Wrench, ShieldCheck, Zap, AlertOctagon } from "lucide-react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { SectionCard } from "@/components/ui/section-card";
import { StatTile } from "@/components/ui/stat-tile";
import { CodePanel } from "@/components/ui/code-panel";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PipelineList, PipelineStep } from "@/components/ui/pipeline-step";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { FINDINGS, type Finding, type Severity } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/findings")({
  head: () => ({
    meta: [
      { title: "Findings · Archon" },
      {
        name: "description",
        content:
          "Triage vulnerabilities discovered by the agent and view mapped compliance controls.",
      },
      { property: "og:title", content: "Findings · Archon" },
      {
        property: "og:description",
        content:
          "Triage vulnerabilities discovered by the agent and view mapped compliance controls.",
      },
    ],
  }),
  component: FindingsPage,
});

const SEVERITIES: { id: Severity | "all"; label: string }[] = [
  { id: "all", label: "All severities" },
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

function FindingsPage() {
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [open, setOpen] = useState<Finding | null>(null);

  const list = FINDINGS.filter((f) => severity === "all" || f.severity === severity);

  const counts = {
    critical: FINDINGS.filter((f) => f.severity === "critical").length,
    high: FINDINGS.filter((f) => f.severity === "high").length,
    medium: FINDINGS.filter((f) => f.severity === "medium").length,
    low: FINDINGS.filter((f) => f.severity === "low").length,
  };

  const STATS = [
    { code: "01 // OPEN", label: "Findings", value: String(FINDINGS.length), accent: true },
    { code: "02 // CRIT", label: "Critical", value: String(counts.critical) },
    { code: "03 // HIGH", label: "High", value: String(counts.high) },
    { code: "04 // MED+LOW", label: "Med + Low", value: String(counts.medium + counts.low) },
  ];

  return (
    <AppShell
      subtitle="Triage queue"
      title="Findings"
      actions={
        <BrutalButton variant="secondary">
          <Filter size={14} /> Filters
        </BrutalButton>
      }
    >
      <div className="space-y-5">
        {/* Hero */}
        <section className="grid grid-cols-1 overflow-hidden rounded-sm hairline bg-card lg:grid-cols-12 lg:divide-x lg:divide-border">
          <SectionCard
            className="border-0 lg:col-span-7"
            frame="flat"
            eyebrow={
              <span className="inline-flex items-center gap-1.5">
                <Zap size={10} strokeWidth={2.5} className="text-primary" /> TRIAGE
              </span>
            }
            title={
              <span>
                <span className="text-primary">{list.length}</span>{" "}
                {severity === "all" ? "open" : severity} findings
              </span>
            }
            description="Filter by severity, inspect evidence, map mitigations to controls, and auto-draft remediation PRs."
            actions={
              <span className="text-xs text-muted-foreground">Agent-ranked · blast radius</span>
            }
          >
            <div className="grid grid-cols-2 border-y border-border sm:grid-cols-4 sm:divide-x sm:divide-border">
              {STATS.map((s) => (
                <StatTile
                  key={s.code}
                  code={s.code}
                  label={s.label}
                  value={s.value}
                  accent={s.accent}
                />
              ))}
            </div>
          </SectionCard>

          {/* Filter rail */}
          <SectionCard
            variant="dark"
            className="border-x-0 border-b-0 lg:col-span-5 lg:border-t-0"
            frame="flat"
            padding="none"
            eyebrow="// Filter"
            title="Severity"
          >
            <div className="p-4">
              <div className="font-mono text-[11px] text-cream/40">$ archon findings --filter</div>
              <div className="mt-3 space-y-1">
                {SEVERITIES.map((s) => {
                  const active = severity === s.id;
                  const n =
                    s.id === "all"
                      ? FINDINGS.length
                      : FINDINGS.filter((f) => f.severity === s.id).length;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSeverity(s.id)}
                      className={cn(
                        "flex w-full items-center justify-between border-l-2 px-3 py-2 text-left text-[13px] transition-colors",
                        active
                          ? "border-l-accent bg-primary text-primary-foreground"
                          : "border-l-transparent text-cream/80 hover:bg-cream/10",
                      )}
                    >
                      <span className="inline-flex items-center gap-2 font-medium">
                        {s.id !== "all" ? (
                          <SeverityBadge severity={s.id as Severity} size="sm">
                            {s.id}
                          </SeverityBadge>
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-cream/40" />
                        )}
                        {s.label}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </SectionCard>
        </section>

        {/* Trace list + detail */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <SectionCard
            className={cn(open ? "lg:col-span-7" : "lg:col-span-12")}
            variant="dark"
            padding="none"
            eyebrow="// Queue"
            title={severity === "all" ? "All severities" : `${severity} only`}
            actions={
              <span className="font-mono text-[11px] text-cream/40">{list.length} item(s)</span>
            }
          >
            <div className="divide-y divide-cream/15">
              {list.length === 0 ? (
                <div className="py-8 text-center text-sm text-cream/40">
                  // no findings at this severity
                </div>
              ) : (
                <PipelineList dark>
                  {list.map((f, i) => (
                    <button
                      key={f.id}
                      onClick={() => setOpen(f)}
                      className={cn(
                        "block w-full px-5 py-4 text-left transition-colors sm:px-6",
                        open?.id === f.id ? "opacity-100" : "hover:bg-cream/5",
                      )}
                    >
                      <PipelineStep
                        index={i + 1}
                        state={
                          open?.id === f.id
                            ? "active"
                            : f.severity === "critical"
                              ? "active"
                              : "idle"
                        }
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
                          <SeverityBadge severity={f.severity} size="sm">
                            {f.severity}
                          </SeverityBadge>
                        }
                      />
                      <div className="ml-9 mt-2 flex flex-wrap gap-1.5">
                        {f.controls.map((c) => (
                          <span
                            key={c.framework + c.control}
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              c.status === "violated"
                                ? "bg-primary/20 text-primary"
                                : c.status === "partial"
                                  ? "bg-secondary/20 text-secondary"
                                  : "bg-cream/10 text-cream/70",
                            )}
                          >
                            {c.framework} · {c.control}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </PipelineList>
              )}
            </div>
          </SectionCard>

          {open ? (
            <SectionCard
              className="lg:col-span-5 self-start lg:sticky lg:top-6"
              padding="md"
              eyebrow={`// ${open.id}`}
              title={open.title}
              actions={
                <button
                  onClick={() => setOpen(null)}
                  className="rounded-lg hairline bg-card p-1.5 text-foreground/70 transition-colors hover:bg-cream dark:bg-cream-deep"
                  aria-label="Close detail"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              }
              headerExtra={
                <div className="flex flex-wrap gap-1.5">
                  <SeverityBadge severity={open.severity} dot>
                    {open.severity}
                  </SeverityBadge>
                  <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-medium dark:bg-cream-deep">
                    {open.stride}
                  </span>
                </div>
              }
            >
              <div className="space-y-5">
                <DetailSection icon={FileWarning} label="Description">
                  <p className="text-sm leading-relaxed">{open.description}</p>
                </DetailSection>

                <DetailSection icon={AlertOctagon} label="Evidence">
                  <CodePanel filename={`${open.id}.evidence`} variant="default">
                    <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-cream">
                      {open.evidence}
                    </pre>
                  </CodePanel>
                </DetailSection>

                <DetailSection icon={Wrench} label="Remediation">
                  <p className="text-sm leading-relaxed">{open.remediation}</p>
                </DetailSection>

                <DetailSection icon={ShieldCheck} label="Control mapping">
                  <DataTable dense columns={controlColumns} rows={open.controls} />
                </DetailSection>

                <div className="flex gap-2 border-t hairline-soft pt-4">
                  <BrutalButton variant="primary" className="flex-1">
                    Generate remediation PR
                  </BrutalButton>
                  <BrutalButton variant="secondary">Snooze</BrutalButton>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function DetailSection({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof FileWarning;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="section-title flex items-center gap-1.5 mb-2">
        <Icon size={11} strokeWidth={2.5} /> {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

type Control = Finding["controls"][number];

const controlColumns: DataTableColumn<Control>[] = [
  {
    key: "framework",
    header: "Framework",
    cell: (c) => <span className="font-medium">{c.framework}</span>,
  },
  {
    key: "control",
    header: "Control",
    mono: true,
    cell: (c) => <span>{c.control}</span>,
  },
  {
    key: "status",
    header: "Status",
    cell: (c) => (
      <span
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
          c.status === "violated"
            ? "bg-primary/10 text-primary"
            : c.status === "partial"
              ? "bg-secondary/15 text-secondary-foreground"
              : "bg-success/10 text-success",
        )}
      >
        {c.status}
      </span>
    ),
  },
];
