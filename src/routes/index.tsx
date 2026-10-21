import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Lightning, CheckCircle } from "@phosphor-icons/react";
import {
  MarketingBackdrop,
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/MarketingChrome";
import { SaaSHeroMotionGraphic } from "@/components/marketing/SaaSHeroMotionGraphic";
import { useFrameworks } from "@/hooks/useFrameworks";
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
  const { data: frameworksData } = useFrameworks();
  const frameworks = frameworksData ?? [];

  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased selection:bg-accent/20">
      <MarketingBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        <MarketingHeader current="home" />

        <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col">
          <main className="flex-1 space-y-6 py-4 sm:space-y-8 sm:py-6 lg:space-y-8 lg:py-6">
            {/* Hero — Fits 100% in viewport cleanly */}
            <section className="px-4 sm:px-6 lg:h-[min(620px,calc(100svh-120px))] lg:min-h-[520px]">
              <div
                data-testid="landing-hero"
                className="grid h-full grid-cols-1 overflow-hidden rounded-sm border border-border bg-card lg:grid-cols-12"
              >
                <div className="flex flex-col justify-center border-b border-border px-5 py-8 sm:px-8 sm:py-10 lg:col-span-7 lg:border-b-0 lg:border-r lg:px-10 lg:py-8 xl:px-12">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-2.5 py-1 text-[12px] font-medium text-accent">
                      <Lightning size={11} weight="fill" /> Llama 3.1 70B
                    </span>
                    <span className="text-[12px] text-muted-foreground">Powered by Groq</span>
                  </div>

                  <h1 className="max-w-[14ch] text-[38px] font-medium leading-[1.05] sm:text-5xl lg:text-[52px] xl:text-[56px]">
                    Audit at <span className="text-accent">machine</span> speed.
                  </h1>

                  <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
                    Archon parses your architecture, finds vulnerabilities, maps them to controls,
                    and ships signed audit reports in minutes — not weeks.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      to="/login"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-all hover:-translate-y-px hover:shadow-soft-lg"
                    >
                      Launch console <ArrowRight size={14} weight="bold" />
                    </Link>
                    <Link
                      to="/reports"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-card px-5 py-2.5 text-sm font-medium text-foreground hairline shadow-soft transition-all hover:-translate-y-px hover:shadow-soft-lg"
                    >
                      View reports
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
                    <figcaption className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-md border border-white/20 bg-ink/90 px-2.5 py-1.5 font-mono text-[10px] text-white backdrop-blur-sm">
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
                    b: "Extract assets, dataflows, and trust boundaries from code and configs.",
                  },
                  {
                    n: "02",
                    t: "Map",
                    b: "Map code vulnerabilities directly to statutory compliance controls.",
                  },
                  {
                    n: "03",
                    t: "Report",
                    b: "Generate auditor-ready compliance attestations and sealed PDFs.",
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

            {/* Audit flow motion */}
            <section id="audit-flow" className="scroll-mt-20 px-4 sm:px-6">
              <div className="overflow-hidden rounded-sm hairline bg-card">
                <div className="grid lg:grid-cols-12">
                  <div className="border-b border-border p-6 sm:p-8 lg:col-span-4 lg:border-b-0 lg:border-r">
                    <p className="section-title text-accent">// Live audit path</p>
                    <h2 className="mt-2 max-w-[14ch] text-3xl font-medium leading-tight md:text-4xl">
                      Audit path in motion.
                    </h2>
                    <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                      Trace from repository ingestion to ranked findings, control mapping, and sealed reports.
                    </p>

                    <div className="mt-8 grid grid-cols-3 border-y border-border text-sm">
                      {[
                        ["5", "stages"],
                        ["38s", "ETA"],
                        ["71%", "surface closed"],
                      ].map(([value, label], index) => (
                        <div
                          key={label}
                          className={[
                            "py-4",
                            index === 0 ? "pr-4" : "border-l border-border px-4",
                          ].join(" ")}
                        >
                          <div className="font-mono text-xl font-semibold text-foreground">
                            {value}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-8">
                    <AuditMotionGraphic />
                  </div>
                </div>
              </div>
            </section>

            {/* Pipeline */}
            <section id="pipeline" className="scroll-mt-20 px-4 text-foreground sm:px-6">
              <div className="overflow-hidden rounded-sm hairline bg-card">
                <div className="grid gap-5 border-b border-border p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.62fr)] lg:items-end">
                  <div>
                    <p className="section-title text-accent">// Pipeline</p>
                    <h2 className="mt-2 max-w-[20ch] text-3xl font-medium leading-tight md:text-4xl">
                      From repository to signed report.
                    </h2>
                  </div>
                  <p className="max-w-lg text-sm leading-relaxed text-muted-foreground lg:justify-self-end">
                    Five stages keeping every finding traceable to code evidence and statutory controls.
                  </p>
                </div>

                <ol className="grid md:grid-cols-5">
                  {PIPELINE.map((stage, index) => (
                    <li
                      key={stage.code}
                      className={[
                        "relative min-h-[148px] px-6 py-6",
                        index === PIPELINE.length - 1
                          ? "border-b-0 md:border-r-0"
                          : "border-b border-border md:border-b-0 md:border-r",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[11px] font-medium text-accent">
                          {stage.code}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">step</span>
                      </div>
                      <h3 className="mt-7 text-base font-medium leading-snug">{stage.label}</h3>
                      <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
                        {stage.note}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* Frameworks coverage */}
            <section id="frameworks" className="scroll-mt-20 px-4 sm:px-6">
              <div className="overflow-hidden rounded-sm hairline bg-card">
                <div className="grid gap-5 border-b border-border p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div>
                    <p className="section-title text-accent">// Frameworks</p>
                    <h2 className="mt-2 text-3xl font-medium leading-tight md:text-4xl">
                      Coverage across every framework.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      See current pass rates and the active control catalogs applied to every scan.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground lg:pb-1">
                    <span className="size-2 rounded-full bg-success" />
                    {frameworks.length || 6} frameworks active
                  </div>
                </div>

                <div className="grid lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <div className="border-b border-border px-6 py-5 sm:px-8">
                      <p className="section-title">Coverage</p>
                      <h3 className="mt-1 text-xl font-medium">Current compliance posture</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Control pass rates mapped across audit scans.
                      </p>
                    </div>
                    <div className="grid gap-x-8 gap-y-6 p-6 sm:grid-cols-2 sm:p-8">
                      {COVERAGE.map((c) => (
                        <CoverageBar key={c.label} label={c.label} pct={c.pct} />
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border bg-secondary lg:col-span-5 lg:border-l lg:border-t-0">
                    <div className="border-b border-border px-6 py-5 sm:px-8">
                      <p className="section-title">Catalog</p>
                      <h3 className="mt-1 text-xl font-medium">Controls included</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Each selected catalog is mapped during the same review.
                      </p>
                    </div>
                    <ul className="grid sm:grid-cols-2 lg:grid-cols-2">
                      {(frameworks.length ? frameworks : [
                        { id: 'soc2', label: 'SOC 2', controls: 64, version: '2017' },
                        { id: 'iso', label: 'ISO 27001', controls: 114, version: '2022' },
                        { id: 'hipaa', label: 'HIPAA', controls: 54, version: '2013' },
                        { id: 'gdpr', label: 'GDPR', controls: 99, version: '2018' },
                        { id: 'pcidss', label: 'PCI-DSS', controls: 12, version: 'v4.0' },
                        { id: 'nist', label: 'NIST 800-53', controls: 110, version: 'Rev5' },
                      ]).map((f) => (
                        <li
                          key={f.id}
                          className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-6 py-3 sm:odd:border-r lg:px-4"
                        >
                          <span className="inline-flex items-center gap-2 font-medium">
                            <CheckCircle size={14} weight="fill" className="text-success" />
                            {f.label}
                          </span>
                          <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                            {f.controls}
                            <span className="sr-only"> controls</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>

        <MarketingFooter />
      </div>
    </div>
  );
}

function AuditMotionGraphic() {
  return <SaaSHeroMotionGraphic />;
}
