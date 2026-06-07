import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Upload,
  FileCode2,
  ScrollText,
  Play,
  Cpu,
  Zap,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { BrutalBadge } from "@/components/brutal/BrutalBadge";
import { FRAMEWORKS } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/new-scan")({
  head: () => ({
    meta: [
      { title: "New scan · Sentinel" },
      { name: "description", content: "Run an agentic threat model across architecture diagrams, descriptions, or operational logs." },
      { property: "og:title", content: "New scan · Sentinel" },
      { property: "og:description", content: "Run an agentic threat model across architecture diagrams, descriptions, or operational logs." },
    ],
  }),
  component: NewScanPage,
});

const TABS = [
  { id: "diagram", label: "Architecture", icon: FileCode2 },
  { id: "describe", label: "Description", icon: ScrollText },
  { id: "logs", label: "Operational logs", icon: Upload },
] as const;

const PIPELINE = [
  "Parse system topology",
  "Identify trust boundaries & assets",
  "Enumerate STRIDE threats",
  "Map to compliance controls",
  "Draft audit report",
];

function NewScanPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("describe");
  const [selected, setSelected] = useState<string[]>(["soc2", "iso27001"]);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const run = () => {
    if (running) return;
    setRunning(true);
    setStep(0);
    let i = 0;
    const tick = () => {
      i += 1;
      if (i >= PIPELINE.length) {
        setStep(PIPELINE.length);
        setRunning(false);
        return;
      }
      setStep(i);
      setTimeout(tick, 1100);
    };
    setTimeout(tick, 1100);
  };

  return (
    <AppShell
      subtitle="Pipeline"
      title="Run a threat model"
      actions={
        <BrutalButton variant="primary" onClick={run} disabled={running}>
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? "Analyzing…" : "Run analysis"}
        </BrutalButton>
      }
    >
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Inputs */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border-brutal-2 bg-card shadow-brutal">
            {/* Tabs */}
            <div className="flex border-b-[1.5px] border-ink">
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={[
                      "flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold border-r-[1.5px] last:border-r-0 border-ink",
                      active ? "bg-secondary" : "bg-card hover:bg-cream",
                    ].join(" ")}
                  >
                    <t.icon size={15} strokeWidth={2.25} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {tab === "diagram" && (
                <div className="rounded-lg border-[1.5px] border-dashed border-ink bg-cream p-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border-brutal bg-card shadow-brutal-sm">
                    <Upload size={20} strokeWidth={2.25} />
                  </div>
                  <p className="mt-4 text-sm font-semibold">
                    Drop a Terraform plan, C4 diagram, or k8s manifest
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Supports .tf, .yaml, .json, .draw.io · max 20 MB
                  </p>
                  <BrutalButton variant="secondary" size="sm" className="mt-4">
                    Browse files
                  </BrutalButton>
                </div>
              )}

              {tab === "describe" && (
                <div>
                  <label className="section-title text-muted-foreground">
                    System description
                  </label>
                  <textarea
                    rows={9}
                    defaultValue={`Three-tier web application on AWS.
- React SPA served from CloudFront + S3.
- Node API behind an ALB in a private subnet.
- Aurora Postgres in two AZs, KMS-encrypted.
- Auth via Cognito federated to Okta.
- Payment processing through Stripe; PCI scope reduced via tokenization.
- Audit logs streamed to a centralized S3 bucket and Splunk.`}
                    className="mt-2 w-full rounded-lg border-brutal bg-cream p-3 font-mono text-[13px] outline-none focus:shadow-brutal-gold"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    The agent will extract assets, trust boundaries, and dataflows.
                  </p>
                </div>
              )}

              {tab === "logs" && (
                <div className="rounded-lg border-[1.5px] border-dashed border-ink bg-cream p-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border-brutal bg-card shadow-brutal-sm">
                    <ScrollText size={20} strokeWidth={2.25} />
                  </div>
                  <p className="mt-4 text-sm font-semibold">
                    Upload CloudTrail, VPC flow, or app logs (jsonl / csv)
                  </p>
                  <BrutalButton variant="secondary" size="sm" className="mt-4">
                    Select files
                  </BrutalButton>
                </div>
              )}
            </div>
          </div>

          {/* Frameworks */}
          <div className="mt-5 rounded-xl border-brutal-2 bg-card p-5 shadow-brutal">
            <p className="section-title text-primary">Map against</p>
            <h3 className="text-lg font-bold">Compliance frameworks</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {FRAMEWORKS.map((f) => {
                const active = selected.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggle(f.id)}
                    className={[
                      "rounded-full border-brutal px-3.5 py-1.5 text-xs font-semibold transition-shadow",
                      active
                        ? "bg-primary text-primary-foreground shadow-brutal-sm"
                        : "bg-card hover:bg-cream",
                    ].join(" ")}
                  >
                    {f.label}
                    <span className="ml-1.5 opacity-70">· {f.controls}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model picker */}
          <div className="mt-5 rounded-xl border-brutal-2 bg-card p-5 shadow-brutal">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-title text-primary">Inference</p>
                <h3 className="text-lg font-bold">Model</h3>
              </div>
              <BrutalBadge tone="gold">
                <Zap size={11} strokeWidth={2.5} /> Groq · 740 tok/s
              </BrutalBadge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { name: "Llama 3.1 · 70B", note: "Best reasoning", active: true },
                { name: "Llama 3.1 · 8B", note: "Fastest", active: false },
                { name: "Mixtral 8x7B", note: "Long context", active: false },
              ].map((m) => (
                <button
                  key={m.name}
                  className={[
                    "rounded-lg border-brutal p-3 text-left",
                    m.active ? "bg-secondary shadow-brutal-sm" : "bg-card hover:bg-cream",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Cpu size={14} strokeWidth={2.5} /> {m.name}
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {m.note}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Agent timeline */}
        <aside className="lg:col-span-2">
          <div className="rounded-xl border-brutal-2 bg-ink p-5 text-cream shadow-brutal">
            <div className="flex items-center justify-between">
              <p className="section-title text-secondary">Agent trace</p>
              <BrutalBadge tone={running ? "gold" : "ghost"} dot>
                {running ? "Streaming" : step === PIPELINE.length ? "Done" : "Idle"}
              </BrutalBadge>
            </div>
            <h3 className="mt-1 text-lg font-bold">Reasoning pipeline</h3>

            <ol className="mt-5 space-y-3">
              {PIPELINE.map((label, i) => {
                const done = step > i;
                const active = step === i;
                return (
                  <li key={label} className="flex items-start gap-3">
                    <div
                      className={[
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                        done
                          ? "bg-success border-cream text-success-foreground"
                          : active
                          ? "bg-secondary border-cream text-foreground"
                          : "bg-transparent border-cream/40 text-cream/40",
                      ].join(" ")}
                    >
                      {done ? (
                        <CheckCircle2 size={14} strokeWidth={2.5} />
                      ) : (
                        <span className="text-[11px] font-bold">{i + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div
                        className={[
                          "text-sm font-semibold",
                          done || active ? "text-cream" : "text-cream/50",
                        ].join(" ")}
                      >
                        {label}
                      </div>
                      {active && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-secondary">
                          <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-secondary" />
                          analyzing…
                        </div>
                      )}
                      {done && i === 2 && (
                        <p className="mt-1 text-xs text-cream/70">
                          Found 12 threats · 4 critical
                        </p>
                      )}
                      {done && i === 3 && (
                        <p className="mt-1 text-xs text-cream/70">
                          Mapped 38 controls across {selected.length} frameworks
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 rounded-lg border-[1.5px] border-cream/30 bg-cream/5 p-3 font-mono text-[11px] text-cream/70">
              <span className="text-secondary">$</span> agent.run(
              <br />
              &nbsp;&nbsp;model=<span className="text-secondary">"llama-3.1-70b"</span>,
              <br />
              &nbsp;&nbsp;frameworks=
              <span className="text-secondary">{JSON.stringify(selected)}</span>,
              <br />
              &nbsp;&nbsp;stream=<span className="text-secondary">true</span>
              <br />)
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
