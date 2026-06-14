import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Filter, X, FileWarning, Wrench, ShieldCheck, Zap, AlertOctagon } from "lucide-react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { FINDINGS, type Finding, type Severity } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/findings")({
  head: () => ({
    meta: [
      { title: "Findings · Sentinel" },
      { name: "description", content: "Triage vulnerabilities discovered by the agent and view mapped compliance controls." },
      { property: "og:title", content: "Findings · Sentinel" },
      { property: "og:description", content: "Triage vulnerabilities discovered by the agent and view mapped compliance controls." },
    ],
  }),
  component: FindingsPage,
});

const SEVERITIES: { id: Severity | "all"; label: string; code: string }[] = [
  { id: "all", label: "All", code: "00" },
  { id: "critical", label: "Critical", code: "01" },
  { id: "high", label: "High", code: "02" },
  { id: "medium", label: "Medium", code: "03" },
  { id: "low", label: "Low", code: "04" },
];

const sevTone: Record<Severity, string> = {
  critical: "bg-primary text-primary-foreground border-primary",
  high: "bg-secondary text-secondary-foreground border-ink",
  medium: "bg-cream text-ink border-ink",
  low: "bg-card text-muted-foreground border-ink",
};

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
    { code: "04 // MED/LOW", label: "Med + Low", value: String(counts.medium + counts.low) },
  ];

  return (
    <AppShell
      subtitle="Triage queue"
      title="Findings"
      actions={
        <BrutalButton variant="secondary">
          <Filter size={15} /> Filters
        </BrutalButton>
      }
    >
      <div className="border-[3px] border-ink bg-card shadow-brutal overflow-hidden">
        {/* HERO STRIP — 7/5 split */}
        <section className="grid grid-cols-1 lg:grid-cols-12 border-b-[3px] border-ink">
          <div className="lg:col-span-7 p-5 md:p-7 lg:border-r-[3px] border-b-[3px] lg:border-b-0 border-ink bg-card flex flex-col justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1 border border-ink bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground">
                  <Zap size={10} strokeWidth={3} /> TRIAGE
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground italic">
                  Agent-ranked · blast radius
                </span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold leading-[0.9] tracking-tighter">
                <span className="text-primary">{list.length}</span> {severity === "all" ? "OPEN" : severity.toUpperCase()}
                <br />
                FINDINGS.
              </h2>
              <p className="mt-4 max-w-md text-sm font-medium text-muted-foreground">
                Filter by severity, inspect evidence, map mitigations to controls,
                and auto-draft remediation PRs from a single pane.
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
                </div>
              ))}
            </div>
          </div>

          {/* Right: severity filter rail */}
          <div className="lg:col-span-5 bg-ink p-5 md:p-6 flex flex-col text-cream">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
                <span className="h-2.5 w-2.5 rounded-full bg-success" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-cream/40">filter.rs</span>
            </div>
            <div className="font-mono text-[11px] leading-relaxed">
              <div className="text-success mb-1">$ sentinel findings --filter</div>
              <div className="text-cream/40 mb-3">Pick a severity bucket…</div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {SEVERITIES.map((s) => {
                const active = severity === s.id;
                const n = s.id === "all" ? FINDINGS.length : FINDINGS.filter((f) => f.severity === s.id).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSeverity(s.id)}
                    className={[
                      "w-full flex items-center justify-between border-2 px-3 py-2 text-left transition-colors",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-cream/20 hover:bg-cream/5 text-cream",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-[10px] opacity-60">{s.code}</span>
                      <span className="text-xs font-bold uppercase tracking-wider">{s.label}</span>
                    </span>
                    <span className="font-mono text-[11px] tabular-nums">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* TRACE LIST + DETAIL */}
        <section className="grid grid-cols-1 lg:grid-cols-12">
          <div className={[open ? "lg:col-span-7" : "lg:col-span-12", "bg-ink text-cream p-6 md:p-8 lg:border-r-[3px] border-ink"].join(" ")}>
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <p className="font-mono text-[10px] text-secondary uppercase tracking-widest mb-1">// Queue</p>
                <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">
                  {severity === "all" ? "All severities" : `${severity} only`}
                </h2>
              </div>
              <span className="font-mono text-[10px] text-cream/40">{list.length} item(s)</span>
            </div>

            <ol className="border-l-2 border-cream/20 pl-6 md:pl-8 space-y-5">
              {list.map((f, i) => {
                const isCrit = f.severity === "critical";
                const selected = open?.id === f.id;
                return (
                  <li key={f.id} className="relative">
                    <span
                      className={[
                        "absolute -left-[33px] md:-left-[41px] top-1.5 h-4 w-4 border-2 border-cream",
                        isCrit ? "bg-primary" : selected ? "bg-secondary" : "bg-cream/20",
                      ].join(" ")}
                    />
                    <button
                      onClick={() => setOpen(f)}
                      className={[
                        "block w-full text-left group transition-colors",
                        selected ? "opacity-100" : "opacity-90 hover:opacity-100",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={["font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border", sevTone[f.severity]].join(" ")}>
                          {f.severity}
                        </span>
                        <span className="font-mono text-[10px] text-cream/50 uppercase tracking-wider">{f.stride}</span>
                        <span className="font-mono text-[10px] text-cream/40 ml-auto">{f.detected}</span>
                      </div>
                      <div className="font-mono text-[10px] text-cream/40 mb-1 tracking-wider">
                        {String(i + 1).padStart(2, "0")} // {f.id}
                      </div>
                      <h3 className="text-sm md:text-base font-bold leading-snug group-hover:text-primary transition-colors">
                        {f.title}
                      </h3>
                      <p className="mt-1 text-[11px] text-cream/50 font-mono">{f.component}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {f.controls.map((c) => (
                          <span
                            key={c.framework + c.control}
                            className={[
                              "border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              c.status === "violated"
                                ? "bg-primary text-primary-foreground border-primary"
                                : c.status === "partial"
                                ? "bg-secondary text-ink border-cream/40"
                                : "bg-transparent text-cream/70 border-cream/30",
                            ].join(" ")}
                          >
                            {c.framework} · {c.control}
                          </span>
                        ))}
                      </div>
                    </button>
                  </li>
                );
              })}
              {list.length === 0 && (
                <li className="text-cream/50 font-mono text-sm">// no findings at this severity</li>
              )}
            </ol>
          </div>

          {open && (
            <aside className="lg:col-span-5 bg-card p-5 md:p-6">
              <div className="sticky top-6">
                <div className="flex items-start justify-between border-b-[2px] border-ink pb-4 mb-4">
                  <div>
                    <p className="font-mono text-[10px] text-primary tracking-wider mb-1">// {open.id}</p>
                    <h3 className="text-lg font-bold leading-snug tracking-tight">{open.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={["border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", sevTone[open.severity]].join(" ")}>
                        {open.severity}
                      </span>
                      <span className="border border-ink bg-cream px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        {open.stride}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setOpen(null)}
                    className="border-[2px] border-ink bg-cream p-1.5 hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="space-y-5">
                  <Section icon={FileWarning} label="Description">
                    <p className="text-sm leading-relaxed">{open.description}</p>
                  </Section>

                  <Section icon={AlertOctagon} label="Evidence">
                    <pre className="overflow-x-auto border-[2px] border-ink bg-ink p-3 font-mono text-[11px] text-cream">
                      {open.evidence}
                    </pre>
                  </Section>

                  <Section icon={Wrench} label="Remediation">
                    <p className="text-sm leading-relaxed">{open.remediation}</p>
                  </Section>

                  <Section icon={ShieldCheck} label="Control mapping">
                    <div className="border-[2px] border-ink overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-cream">
                          <tr className="border-b-[2px] border-ink text-left">
                            <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">Framework</th>
                            <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">Control</th>
                            <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {open.controls.map((c) => (
                            <tr key={c.framework + c.control} className="border-t-[1.5px] border-ink/20">
                              <td className="px-3 py-2 font-bold">{c.framework}</td>
                              <td className="px-3 py-2 font-mono">{c.control}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={[
                                    "border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                    c.status === "violated"
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : c.status === "partial"
                                      ? "bg-secondary text-ink border-ink"
                                      : "bg-success/20 text-success border-ink",
                                  ].join(" ")}
                                >
                                  {c.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Section>

                  <div className="flex gap-2 pt-2 border-t-[2px] border-ink">
                    <BrutalButton variant="primary" className="flex-1">
                      Generate remediation PR
                    </BrutalButton>
                    <BrutalButton variant="secondary">Snooze</BrutalButton>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Section({
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
      <p className="font-mono text-[10px] text-primary tracking-wider mb-2 flex items-center gap-1.5 uppercase">
        <Icon size={12} strokeWidth={2.5} /> // {label}
      </p>
      <div>{children}</div>
    </div>
  );
}
