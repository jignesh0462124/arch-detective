import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Zap, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/brutal/ThemeToggle";
import { ArchonLogo } from "@/components/ui/ArchonLogo";
import { FRAMEWORKS } from "@/lib/mock-data";
import { CodePanel } from "@/components/ui/code-panel";
import { SectionCard } from "@/components/ui/section-card";
import { CoverageBar } from "@/components/ui/coverage-bar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Archon — Agentic Compliance & Threat Modeling" },
      {
        name: "description",
        content:
          "Archon parses architectures and logs, finds vulnerabilities, and ships audit-ready reports against SOC 2, ISO 27001, HIPAA, GDPR, PCI-DSS, and NIST in minutes.",
      },
    ],
  }),
  component: Landing,
});

const PIPELINE = [
  { code: "01", label: "Repository analysis", note: "parse · crawl · index" },
  { code: "02", label: "Graph extraction", note: "topology · trust boundaries" },
  { code: "03", label: "Threat assessment", note: "STRIDE · attack paths" },
  { code: "04", label: "Framework alignment", note: "SOC 2 · ISO · NIST · …" },
  { code: "05", label: "Signed audit report", note: "PDF · countersign" },
];

const COVERAGE = [
  { label: "SOC 2", pct: 92 },
  { label: "ISO 27001", pct: 78 },
  { label: "PCI-DSS", pct: 64 },
  { label: "HIPAA", pct: 81 },
  { label: "GDPR", pct: 71 },
  { label: "NIST 800-53", pct: 58 },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ArchonLogo size={18} variant="mono" className="text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-none tracking-tight">Archon</div>
              <div className="mt-1 font-mono text-[10px] tracking-wider text-muted-foreground">
                Audit engine
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] font-medium lg:flex">
            <a
              href="#product"
              className="text-foreground/70 transition-colors hover:text-foreground"
            >
              Product
            </a>
            <a
              href="#pipeline"
              className="text-foreground/70 transition-colors hover:text-foreground"
            >
              Pipeline
            </a>
            <a
              href="#frameworks"
              className="text-foreground/70 transition-colors hover:text-foreground"
            >
              Frameworks
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link
              to="/dashboard"
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-soft transition-all hover:-translate-y-px hover:shadow-soft-lg"
            >
              Launch <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>
        </header>

        <main className="flex-1">
          {/* Hero */}
          <section className="px-4 py-6 sm:px-6 lg:h-[min(700px,calc(100svh-132px))] lg:min-h-[620px] lg:py-8">
            <div
              data-testid="landing-hero"
              className="grid h-full grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-12"
            >
              <div className="flex flex-col justify-center border-b border-border px-5 py-10 sm:px-8 sm:py-12 lg:col-span-7 lg:border-b-0 lg:border-r lg:px-12 lg:py-10">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-2.5 py-1 text-[12px] font-medium text-accent">
                    <Zap size={11} strokeWidth={2.5} /> Llama 3.1 70B
                  </span>
                  <span className="text-[12px] text-muted-foreground">Powered by Groq</span>
                </div>

                <h1 className="max-w-[14ch] text-[40px] font-medium leading-[1.05] sm:text-5xl lg:text-[56px]">
                  Audit at <span className="text-accent">machine</span> speed.
                </h1>

                <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
                  Archon parses your architecture, finds vulnerabilities, maps them to controls,
                  and ships signed audit reports in minutes — not weeks.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/dashboard"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-all hover:-translate-y-px hover:shadow-soft-lg"
                  >
                    Launch console <ArrowRight size={14} strokeWidth={2.5} />
                  </Link>
                  <Link
                    to="/reports/$reportId"
                    params={{ reportId: "RPT-0098" }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-card px-5 py-2.5 text-sm font-medium text-foreground hairline shadow-soft transition-all hover:-translate-y-px hover:shadow-soft-lg"
                  >
                    View sample report
                  </Link>
                </div>
              </div>

              <div className="flex min-h-[360px] flex-col bg-[#111111] p-5 sm:p-6 lg:col-span-5 lg:min-h-0">
                <CodePanel filename="scan.terminal" variant="terminal" className="flex-1">
                  <div className="text-success">$ archon --scan infra-prod</div>
                  <div className="mt-0.5 text-cream/60">Initializing agentic engine...</div>

                  <div className="mt-4 space-y-1">
                    <div>
                      <span className="text-accent">[parse]</span>{" "}
                      <span className="text-cream">47 assets identified</span>
                    </div>
                    <div>
                      <span className="text-accent">[threat]</span>{" "}
                      <span className="text-cream">19 attack vectors found</span>
                    </div>
                    <div>
                      <span className="text-accent">[map]</span>{" "}
                      <span className="text-cream">38 SOC 2 controls validated</span>
                    </div>
                    <div>
                      <span className="text-accent">[report]</span>{" "}
                      <span className="text-cream">generating signed PDF...</span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-1.5 border-t border-cream/15 pt-4 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-cream/60">
                      <span>Completion</span>
                      <span className="text-cream">1m 48s</span>
                    </div>
                    <div className="flex items-center justify-between text-cream/60">
                      <span>Throughput</span>
                      <span className="text-cream">740 tok/s</span>
                    </div>
                    <div className="flex items-center justify-between text-cream/60">
                      <span>Cost / scan</span>
                      <span className="text-cream">$0.03</span>
                    </div>
                  </div>
                </CodePanel>

                <div className="mt-4 grid grid-cols-3 border-t border-cream/15 pt-4 text-center">
                  <TerminalStat value="47" label="Assets" />
                  <TerminalStat value="19" label="Threats" />
                  <TerminalStat value="38" label="Controls" />
                </div>
              </div>
            </div>
          </section>

          {/* Product — 3-up features */}
          <section
            id="product"
            className="grid grid-cols-1 gap-3 px-4 pb-12 sm:px-6 md:grid-cols-3 lg:pb-16"
          >
            {[
              {
                n: "01",
                t: "Parse",
                b: "Extract assets, dataflows, and trust boundaries from code and logs automatically.",
              },
              {
                n: "02",
                t: "Map",
                b: "Trace every threat to specific regulatory controls with citation-grade evidence.",
              },
              {
                n: "03",
                t: "Report",
                b: "Generate human-readable, auditor-ready documentation co-signed by your team.",
              },
            ].map((f) => (
              <div key={f.n} className="rounded-xl bg-card px-6 py-8 hairline sm:px-7">
                <div className="section-title">{`// ${f.n}`}</div>
                <h3 className="mt-2 text-xl font-medium">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.b}</p>
              </div>
            ))}
          </section>

          {/* Pipeline */}
          <section
            id="pipeline"
            className="flex flex-col gap-10 border-t border-border px-4 py-14 text-foreground sm:px-6 sm:py-16 md:flex-row md:gap-14 lg:py-20"
          >
            <div className="md:w-1/3">
              <p className="section-title text-accent">// Pipeline</p>
              <h2 className="mt-2 text-3xl font-medium leading-tight md:text-4xl">
                Autonomous five-step verification.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Every scan follows a deterministic flow optimized for speed and traceability, from
                repository to signed report.
              </p>
            </div>
            <ol className="relative flex-1 space-y-6 pl-7">
              <div aria-hidden className="absolute left-3 top-3 bottom-3 w-px bg-border" />
              {PIPELINE.map((s, i) => (
                <li key={s.code} className="relative">
                  <div
                    className={[
                      "absolute -left-7 top-0.5 flex size-6 items-center justify-center rounded-full text-[10px] font-semibold",
                      i === 0
                        ? "bg-primary text-primary-foreground"
                        : "border hairline-soft text-muted-foreground",
                    ].join(" ")}
                  >
                    {s.code}
                  </div>
                  <div
                    className={[
                      "font-mono text-[11px]",
                      i === 0 ? "text-accent" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    step
                  </div>
                  <div
                    className={[
                      "mt-0.5 text-base font-medium",
                      i === 0 ? "" : "text-foreground",
                    ].join(" ")}
                  >
                    {s.label}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">{s.note}</div>
                </li>
              ))}
            </ol>
          </section>

          {/* Frameworks coverage */}
          <section
            id="frameworks"
            className="border-t border-border px-4 py-14 sm:px-6 sm:py-16 lg:py-20"
          >
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="section-title text-primary">// Frameworks</p>
                <h2 className="mt-1 text-2xl font-medium sm:text-3xl">Status dashboard</h2>
              </div>
              <div className="text-xs font-medium text-muted-foreground">
                {FRAMEWORKS.length} frameworks active
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <SectionCard
                variant="default"
                eyebrow="Coverage"
                title="Per-framework compliance posture"
                description="Control pass-rate across last 90 days of scans."
                className="lg:col-span-2"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  {COVERAGE.map((c) => (
                    <CoverageBar key={c.label} label={c.label} pct={c.pct} />
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                variant="muted"
                eyebrow="Frameworks"
                title="Active catalog"
                description="Pick what to map against on every scan."
              >
                <ul className="space-y-2.5">
                  {FRAMEWORKS.map((f) => (
                    <li key={f.id} className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <CheckCircle2 size={14} className="text-success" strokeWidth={2} />
                        {f.label}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {f.controls}
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-6 text-xs sm:px-6">
          <div className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <ArchonLogo size={13} variant="mono" className="text-primary-foreground" />
            </div>
            Archon · 2026
          </div>
          <div className="flex flex-wrap gap-5 text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">
              Security
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Docs
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Changelog
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Contact
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

function TerminalStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-lg font-semibold tabular-nums text-cream">{value}</div>
      <div className="font-mono text-[10px] text-cream/60">{label}</div>
    </div>
  );
}
