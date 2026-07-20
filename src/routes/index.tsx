import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Zap, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/brutal/ThemeToggle";
import { ArchonLogo } from "@/components/ui/ArchonLogo";
import { FRAMEWORKS } from "@/lib/mock-data";
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
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ink" aria-hidden>
        <img
          src="/assets/archon-infrastructure-backdrop.webp"
          alt=""
          className="h-full w-full object-cover object-[18%_center] opacity-45 sm:object-center dark:opacity-55"
          width={1672}
          height={941}
        />
      </div>

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
          <div className="mx-auto flex min-h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
            <Link to="/" className="flex min-h-10 min-w-0 items-center gap-2.5">
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

            <nav
              className="hidden h-16 items-center text-[13px] font-medium lg:flex"
              aria-label="Landing page"
            >
              {[
                ["#product", "Product"],
                ["#pipeline", "Pipeline"],
                ["#frameworks", "Frameworks"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="flex h-16 items-center border-b-2 border-transparent px-4 text-foreground/70 transition-colors hover:border-accent hover:bg-secondary/50 hover:text-foreground focus-visible:border-accent focus-visible:text-foreground focus-visible:outline-none"
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <Link
                to="/dashboard"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/85"
              >
                Launch <ArrowRight size={13} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[1280px] flex-col">
          <main className="flex-1 space-y-6 py-6 lg:space-y-8 lg:py-8">
            {/* Hero */}
            <section className="px-4 sm:px-6 lg:h-[min(636px,calc(100svh-164px))] lg:min-h-[580px]">
              <div
                data-testid="landing-hero"
                className="grid h-full grid-cols-1 overflow-hidden rounded-sm border border-border bg-card lg:grid-cols-12"
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

                <div className="aspect-[4/5] bg-[#111111] lg:col-span-5 lg:aspect-auto">
                  <figure className="relative h-full overflow-hidden bg-[#111111]">
                    <img
                      src="/assets/archon-system-audit.webp"
                      alt="Architectural model of cloud infrastructure connected to an audit report"
                      className="h-full w-full object-contain object-center"
                      width={1152}
                      height={1434}
                      loading="eager"
                      fetchPriority="high"
                    />
                    <figcaption className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-md border border-cream/20 bg-ink/90 px-2.5 py-1.5 font-mono text-[10px] text-cream backdrop-blur-sm">
                      <span className="size-1.5 rounded-full bg-success" />
                      Live system model
                    </figcaption>
                  </figure>
                </div>
              </div>
            </section>

            {/* Product — 3-up features */}
            <section id="product" className="scroll-mt-20 px-4 sm:px-6">
              <div className="grid grid-cols-1 overflow-hidden rounded-sm hairline bg-card md:grid-cols-3 md:divide-x md:divide-border">
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
                  <div
                    key={f.n}
                    className="border-b border-border px-6 py-8 last:border-b-0 sm:px-7 md:border-b-0"
                  >
                    <div className="section-title">{`// ${f.n}`}</div>
                    <h3 className="mt-2 text-xl font-medium">{f.t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.b}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Pipeline */}
            <section id="pipeline" className="scroll-mt-20 px-4 text-foreground sm:px-6">
              <div className="grid overflow-hidden rounded-sm hairline bg-card md:grid-cols-12">
                <div className="p-6 sm:p-8 md:col-span-5 lg:p-10">
                  <p className="section-title text-accent">// Pipeline</p>
                  <h2 className="mt-2 text-3xl font-medium leading-tight md:text-4xl">
                    Autonomous five-step verification.
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Every scan follows a deterministic flow optimized for speed and traceability,
                    from repository to signed report.
                  </p>
                </div>
                <div className="border-t border-border p-6 sm:p-8 md:col-span-7 md:border-l md:border-t-0 lg:p-10">
                  <ol className="relative space-y-6 pl-7">
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
                </div>
              </div>
            </section>

            {/* Frameworks coverage */}
            <section id="frameworks" className="scroll-mt-20 px-4 sm:px-6">
              <div className="overflow-hidden rounded-sm hairline bg-card">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-6 sm:p-8">
                  <div>
                    <p className="section-title text-primary">// Frameworks</p>
                    <h2 className="mt-1 text-2xl font-medium sm:text-3xl">Status dashboard</h2>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {FRAMEWORKS.length} frameworks active
                  </div>
                </div>

                <div className="grid lg:grid-cols-3 lg:divide-x lg:divide-border">
                  <SectionCard
                    variant="default"
                    frame="flat"
                    eyebrow="Coverage"
                    title="Per-framework compliance posture"
                    description="Control pass-rate across last 90 days of scans."
                    className="border-0 lg:col-span-2"
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      {COVERAGE.map((c) => (
                        <CoverageBar key={c.label} label={c.label} pct={c.pct} />
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard
                    variant="muted"
                    frame="flat"
                    eyebrow="Frameworks"
                    title="Active catalog"
                    description="Pick what to map against on every scan."
                    className="border-x-0 border-b-0 lg:border-t-0"
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
              </div>
            </section>
          </main>
        </div>

        <footer className="border-t border-border bg-background/95 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start justify-between gap-3 px-4 py-4 text-xs sm:min-h-16 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-0">
            <div className="flex min-h-10 items-center gap-2.5 font-medium">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ArchonLogo size={18} variant="mono" className="text-primary-foreground" />
              </div>
              Archon · 2026
            </div>
            <div className="flex flex-wrap items-center text-muted-foreground">
              <a
                href="#"
                className="flex min-h-10 items-center border-b-2 border-transparent px-2 transition-colors hover:border-accent hover:text-foreground focus-visible:border-accent focus-visible:text-foreground focus-visible:outline-none"
              >
                Security
              </a>
              <a
                href="#"
                className="flex min-h-10 items-center border-b-2 border-transparent px-2 transition-colors hover:border-accent hover:text-foreground focus-visible:border-accent focus-visible:text-foreground focus-visible:outline-none"
              >
                Docs
              </a>
              <a
                href="#"
                className="flex min-h-10 items-center border-b-2 border-transparent px-2 transition-colors hover:border-accent hover:text-foreground focus-visible:border-accent focus-visible:text-foreground focus-visible:outline-none"
              >
                Changelog
              </a>
              <a
                href="#"
                className="flex min-h-10 items-center border-b-2 border-transparent px-2 transition-colors hover:border-accent hover:text-foreground focus-visible:border-accent focus-visible:text-foreground focus-visible:outline-none"
              >
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
