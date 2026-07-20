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
  Terminal,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { BrutalBadge } from "@/components/brutal/BrutalBadge";
import { useFrameworks } from "@/hooks/useFrameworks";

export const Route = createFileRoute("/_app/new-scan")({
  head: () => ({
    meta: [
      { title: "New scan · Archon" },
      {
        name: "description",
        content:
          "Run an agentic threat model across architecture diagrams, descriptions, or operational logs.",
      },
      { property: "og:title", content: "New scan · Archon" },
      {
        property: "og:description",
        content:
          "Run an agentic threat model across architecture diagrams, descriptions, or operational logs.",
      },
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
  { label: "Parse system topology", note: "tokenize · graph build" },
  { label: "Identify trust boundaries & assets", note: "asset enumeration" },
  { label: "Enumerate STRIDE threats", note: "12 threats · 4 critical" },
  { label: "Map to compliance controls", note: "38 controls matched" },
  { label: "Draft audit report", note: "markdown + pdf" },
];

const MODELS = [
  { name: "Llama 3.1 · 70B", note: "Best reasoning", speed: "480 tok/s" },
  { name: "Llama 3.1 · 8B", note: "Fastest", speed: "1.2k tok/s" },
  { name: "Mixtral 8x7B", note: "Long context", speed: "620 tok/s" },
];

function NewScanPage() {
  const {
    data: frameworks = [],
    isLoading: frameworksLoading,
    isError: frameworksError,
    refetch: refetchFrameworks,
  } = useFrameworks();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("describe");
  const [selected, setSelected] = useState<string[]>(["soc2", "iso27001"]);
  const [model, setModel] = useState(MODELS[0].name);
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
      subtitle="Pipeline · New scan"
      title="Configure a threat model"
      actions={
        <BrutalButton variant="primary" onClick={run} disabled={running}>
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? "Analyzing…" : "Run analysis"}
        </BrutalButton>
      }
    >
      {/* HERO: 7/5 split */}
      <section className="overflow-hidden rounded-sm hairline bg-card">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left: configuration */}
          <div className="border-b border-border lg:col-span-7 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border bg-muted px-5 py-3">
              <p className="section-title text-primary">// scan.config</p>
              <span className="font-mono text-[10px] text-muted-foreground">step 01 / 03</span>
            </div>

            <div className="p-5 sm:p-7">
              <p className="font-mono text-xs text-primary tracking-wider">INPUT_SOURCE</p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight leading-[0.95]">
                FEED THE
                <br />
                <span className="text-primary">AGENT.</span>
              </h2>

              {/* Tab strip */}
              <div className="mt-6 flex overflow-hidden rounded-lg hairline bg-muted p-1">
                {TABS.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={[
                        "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-card hover:text-foreground",
                      ].join(" ")}
                    >
                      <t.icon size={14} strokeWidth={2.5} />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                {tab === "diagram" && (
                  <div className="rounded-sm border border-dashed border-border bg-muted p-8 text-center">
                    <Upload size={22} strokeWidth={2.5} className="mx-auto" />
                    <p className="mt-3 text-sm font-bold">
                      Drop a Terraform plan, C4 diagram, or k8s manifest
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      .tf · .yaml · .json · .draw.io — max 20MB
                    </p>
                    <BrutalButton variant="secondary" size="sm" className="mt-4">
                      Browse files
                    </BrutalButton>
                  </div>
                )}

                {tab === "describe" && (
                  <textarea
                    rows={8}
                    defaultValue={`Three-tier web app on AWS.
- React SPA via CloudFront + S3
- Node API on ALB, private subnet
- Aurora Postgres, KMS-encrypted, 2 AZ
- Cognito federated to Okta
- Stripe tokenization (PCI reduced)
- Audit logs → S3 + Splunk`}
                    className="w-full rounded-lg hairline bg-muted p-3 font-mono text-[12px] leading-relaxed outline-none transition-shadow focus:shadow-ring"
                  />
                )}

                {tab === "logs" && (
                  <div className="rounded-sm border border-dashed border-border bg-muted p-8 text-center">
                    <ScrollText size={22} strokeWidth={2.5} className="mx-auto" />
                    <p className="mt-3 text-sm font-bold">
                      Upload CloudTrail / VPC flow / app logs
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      .jsonl · .csv — streams parsed in chunks
                    </p>
                    <BrutalButton variant="secondary" size="sm" className="mt-4">
                      Select files
                    </BrutalButton>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: terminal trace */}
          <div className="lg:col-span-5 bg-ink text-cream">
            <div className="flex items-center justify-between border-b border-cream/20 px-5 py-3">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-accent" />
                <span className="font-mono text-[11px] uppercase tracking-wider text-cream/70">
                  agent.trace
                </span>
              </div>
              <BrutalBadge tone={running ? "gold" : "ghost"} dot>
                {running ? "Streaming" : step === PIPELINE.length ? "Done" : "Idle"}
              </BrutalBadge>
            </div>

            <div className="p-5 font-mono text-[12px] leading-relaxed">
              <div className="text-cream/70">$ agent.run(</div>
              <div className="pl-4">
                <span className="text-cream/70">model=</span>
                <span className="text-secondary">
                  "{model.toLowerCase().replace(/[· ]+/g, "-")}"
                </span>
                ,
              </div>
              <div className="pl-4">
                <span className="text-cream/70">frameworks=</span>
                <span className="text-secondary">{JSON.stringify(selected)}</span>,
              </div>
              <div className="pl-4">
                <span className="text-cream/70">stream=</span>
                <span className="text-primary">true</span>
              </div>
              <div className="text-cream/70">)</div>

              <div className="mt-5 border-t border-cream/20 pt-4 space-y-2">
                <div>
                  <span className="text-success">[ok]</span> groq.connect → 312ms
                </div>
                <div>
                  <span className="text-success">[ok]</span> context.tokens = 14,221
                </div>
                <div>
                  <span className={running ? "text-secondary" : "text-cream/70"}>
                    [{running ? "..." : "--"}]
                  </span>{" "}
                  pipeline ready · awaiting trigger
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 border-t border-cream/20">
              {[
                ["Queue", "0"],
                ["Cost/scan", "$0.04"],
                ["ETA", "~38s"],
              ].map(([k, v], i) => (
                <div key={k} className={["p-4", i < 2 ? "border-r border-cream/20" : ""].join(" ")}>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-cream/70">
                    {k}
                  </div>
                  <div className="mt-1 text-xl font-bold">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FRAMEWORKS + MODEL: split 5/7 */}
      <section className="mt-5 grid grid-cols-1 overflow-hidden rounded-sm hairline bg-card lg:grid-cols-12 lg:divide-x lg:divide-border">
        <div className="overflow-hidden bg-muted lg:col-span-5">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="section-title text-primary">// frameworks</p>
            <span className="font-mono text-[10px] text-muted-foreground">
              {selected.length} selected
            </span>
          </div>
          <div className="p-5">
            <h3 className="text-lg font-bold tracking-tight">MAP AGAINST</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Select compliance frameworks for control mapping.
            </p>

            <div className="mt-4 divide-y divide-border border-y border-border">
              {frameworksLoading &&
                Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="h-[54px] animate-pulse bg-card" aria-hidden="true" />
                ))}
              {frameworksError && (
                <button
                  type="button"
                  onClick={() => void refetchFrameworks()}
                  className="flex min-h-[54px] w-full items-center justify-center gap-2 bg-card px-3 text-xs font-semibold text-destructive"
                >
                  <AlertCircle size={14} />
                  Frameworks unavailable. Retry
                </button>
              )}
              {frameworks.map((f) => {
                const active = selected.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggle(f.id)}
                    className={[
                      "flex w-full items-center justify-between px-3 py-3 text-left transition-colors",
                      active ? "bg-primary text-primary-foreground" : "bg-card hover:bg-background",
                    ].join(" ")}
                  >
                    <div>
                      <div className="text-xs font-bold">{f.label}</div>
                      <div className="font-mono text-[10px] opacity-70">{f.controls} ctrl</div>
                    </div>
                    <div
                      className={[
                        "flex h-4 w-4 items-center justify-center rounded border border-current",
                        active ? "bg-cream text-ink" : "",
                      ].join(" ")}
                    >
                      {active && <CheckCircle2 size={10} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="overflow-hidden bg-card lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border bg-muted px-5 py-3">
            <p className="section-title text-primary">// inference.model</p>
            <BrutalBadge tone="gold">
              <Zap size={11} strokeWidth={2.5} /> Groq
            </BrutalBadge>
          </div>
          <div className="p-5">
            <h3 className="text-lg font-bold tracking-tight">CHOOSE A MODEL</h3>
            <div className="mt-4 overflow-hidden border-y border-border divide-y divide-border">
              {MODELS.map((m) => {
                const active = model === m.name;
                return (
                  <button
                    key={m.name}
                    onClick={() => setModel(m.name)}
                    className={[
                      "w-full flex items-center justify-between p-3 text-left",
                      active ? "bg-secondary" : "bg-card hover:bg-muted",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <Cpu size={16} strokeWidth={2.5} />
                      <div>
                        <div className="text-sm font-bold">{m.name}</div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {m.note}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-muted-foreground">{m.speed}</span>
                      <ChevronRight
                        size={14}
                        strokeWidth={2.5}
                        className={active ? "" : "opacity-30"}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* PIPELINE: vertical trace on ink */}
      <section className="mt-5 overflow-hidden border-y border-border bg-ink text-cream">
        <div className="flex items-center justify-between border-b border-cream/20 px-5 py-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-secondary">
            // reasoning.pipeline
          </p>
          <span className="font-mono text-[10px] text-cream/70">
            {step < 0 ? "0" : Math.min(step, PIPELINE.length)} / {PIPELINE.length}
          </span>
        </div>

        <ol className="p-5 sm:p-7 border-l-2 border-cream/20 ml-5 sm:ml-7 space-y-5">
          {PIPELINE.map((p, i) => {
            const done = step > i;
            const active = step === i;
            const idle = step < i;
            return (
              <li key={p.label} className="relative">
                <div
                  className={[
                    "absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[11px] font-bold sm:-left-[42px]",
                    done
                      ? "bg-success border-cream text-success-foreground"
                      : active
                        ? "bg-secondary border-cream text-ink"
                        : "bg-ink border-cream/40 text-cream/70",
                  ].join(" ")}
                >
                  {done ? (
                    <CheckCircle2 size={14} strokeWidth={2.5} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </div>
                <div
                  className={[
                    "text-sm font-bold tracking-tight",
                    idle ? "text-cream/70" : "text-cream",
                  ].join(" ")}
                >
                  {p.label}
                </div>
                <div className="font-mono text-[11px] text-cream/70 mt-0.5">
                  {active ? (
                    <span className="text-secondary flex items-center gap-1.5">
                      <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-secondary" />
                      analyzing…
                    </span>
                  ) : (
                    p.note
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* CTA strip */}
      <section className="mt-5 overflow-hidden border-y border-border bg-primary text-primary-foreground dark:bg-card dark:text-card-foreground">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-7">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider opacity-80">
              // ready_to_execute
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight">SHIP THE SCAN.</h3>
            <p className="mt-1 text-sm opacity-90">
              {selected.length} frameworks · {model} · streaming
            </p>
          </div>
          <BrutalButton variant="secondary" onClick={run} disabled={running}>
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Analyzing…" : "Run analysis"}
          </BrutalButton>
        </div>
      </section>
    </AppShell>
  );
}
