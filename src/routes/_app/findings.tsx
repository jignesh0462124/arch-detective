import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Filter, X, FileWarning, Wrench, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { BrutalBadge } from "@/components/brutal/BrutalBadge";
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

const SEVERITIES: { id: Severity | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

function FindingsPage() {
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [open, setOpen] = useState<Finding | null>(null);

  const list = FINDINGS.filter((f) => severity === "all" || f.severity === severity);

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
      {/* Severity filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {SEVERITIES.map((s) => {
          const active = severity === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSeverity(s.id)}
              className={[
                "rounded-full border-brutal px-3.5 py-1.5 text-xs font-semibold",
                active ? "bg-ink text-cream shadow-brutal-sm" : "bg-card hover:bg-cream",
              ].join(" ")}
            >
              {s.label}
              <span className="ml-1.5 opacity-70">
                {s.id === "all"
                  ? FINDINGS.length
                  : FINDINGS.filter((f) => f.severity === s.id).length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <div className={open ? "lg:col-span-3" : "lg:col-span-5"}>
          <ul className="space-y-4">
            {list.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => setOpen(f)}
                  className={[
                    "block w-full rounded-xl border-brutal-2 bg-card p-5 text-left shadow-brutal shadow-brutal-hover",
                    open?.id === f.id ? "shadow-brutal-gold" : "",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <BrutalBadge tone={f.severity}>{f.severity}</BrutalBadge>
                    <BrutalBadge tone="ghost">{f.stride}</BrutalBadge>
                    <span className="font-mono text-xs text-muted-foreground">{f.id}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{f.detected}</span>
                  </div>
                  <h3 className="mt-3 text-base font-bold leading-snug">{f.title}</h3>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{f.component}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {f.controls.map((c) => (
                      <span
                        key={c.framework + c.control}
                        className={[
                          "rounded-full border-brutal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          c.status === "violated"
                            ? "bg-primary text-primary-foreground"
                            : c.status === "partial"
                            ? "bg-secondary"
                            : "bg-cream",
                        ].join(" ")}
                      >
                        {c.framework} · {c.control}
                      </span>
                    ))}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {open && (
          <aside className="lg:col-span-2">
            <div className="sticky top-6 rounded-xl border-brutal-2 bg-card shadow-brutal">
              <div className="flex items-start justify-between border-b-[1.5px] border-ink p-5">
                <div>
                  <p className="section-title text-primary">{open.id}</p>
                  <h3 className="mt-1 text-lg font-bold leading-snug">{open.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <BrutalBadge tone={open.severity}>{open.severity}</BrutalBadge>
                    <BrutalBadge tone="ghost">{open.stride}</BrutalBadge>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(null)}
                  className="rounded-lg border-brutal bg-cream p-1.5 hover:bg-cream-deep"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>

              <div className="space-y-5 p-5">
                <Section icon={FileWarning} label="Description">
                  <p className="text-sm leading-relaxed">{open.description}</p>
                </Section>

                <Section icon={FileWarning} label="Evidence">
                  <pre className="overflow-x-auto rounded-lg border-brutal bg-ink p-3 font-mono text-[11px] text-cream">
                    {open.evidence}
                  </pre>
                </Section>

                <Section icon={Wrench} label="Remediation">
                  <p className="text-sm leading-relaxed">{open.remediation}</p>
                </Section>

                <Section icon={ShieldCheck} label="Control mapping">
                  <div className="overflow-hidden rounded-lg border-brutal">
                    <table className="w-full text-xs">
                      <thead className="bg-cream-deep">
                        <tr className="border-b-[1.5px] border-ink">
                          <th className="px-3 py-2 text-left font-semibold">Framework</th>
                          <th className="px-3 py-2 text-left font-semibold">Control</th>
                          <th className="px-3 py-2 text-left font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {open.controls.map((c) => (
                          <tr
                            key={c.framework + c.control}
                            className="border-t-[1.5px] border-ink"
                          >
                            <td className="px-3 py-2 font-semibold">{c.framework}</td>
                            <td className="px-3 py-2 font-mono">{c.control}</td>
                            <td className="px-3 py-2">
                              <BrutalBadge
                                tone={
                                  c.status === "violated"
                                    ? "primary"
                                    : c.status === "partial"
                                    ? "gold"
                                    : "success"
                                }
                              >
                                {c.status}
                              </BrutalBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>

                <div className="flex gap-2">
                  <BrutalButton variant="primary" className="flex-1">
                    Generate remediation PR
                  </BrutalButton>
                  <BrutalButton variant="secondary">Snooze</BrutalButton>
                </div>
              </div>
            </div>
          </aside>
        )}
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
      <p className="section-title flex items-center gap-1.5 text-muted-foreground">
        <Icon size={12} strokeWidth={2.5} /> {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
