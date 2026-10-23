import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight } from "@phosphor-icons/react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";
import { LandingCodePreview } from "@/components/marketing/LandingCodePreview";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Archon — Security Audits & Threat Modeling" },
      {
        name: "description",
        content:
          "Review project code, investigate security findings, explore framework mappings, and prepare reports with Archon.",
      },
    ],
  }),
  component: Landing,
});

const OUTCOMES = [
  { title: "Source evidence", note: "Trace findings to recorded file locations." },
  { title: "Clear remediation", note: "Review suggested fixes with supporting evidence." },
  { title: "Framework mappings", note: "Connect findings to selected controls." },
  { title: "Exportable reports", note: "Share findings and remediation for review." },
];
const WORKFLOW = [
  { title: "Upload your project", note: "Start with a project ZIP." },
  { title: "Review findings", note: "Inspect severity and source evidence." },
  { title: "Plan the fix", note: "Review remediation and verification steps." },
  { title: "Share the report", note: "Export findings for your team." },
];
// Public catalog names only; no request or sample assessment scores.
const FRAMEWORKS = ["SOC 2", "ISO 27001", "GDPR", "PCI DSS", "NIST CSF"];
const container = "mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10";
const eyebrow = "font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-accent";
const primaryAction =
  "inline-flex min-h-12 items-center justify-center gap-3 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background";

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent/20">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-card px-4 py-3 text-foreground focus:not-sr-only"
      >
        Skip to content
      </a>
      <MarketingHeader current="home" />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <section aria-labelledby="hero-title" className={container}>
          <div
            data-testid="landing-hero"
            className="grid items-center gap-10 py-10 sm:gap-12 sm:py-14 lg:grid-cols-[1.12fr_1fr] lg:gap-14 lg:py-12"
          >
            <div className="min-w-0 lg:py-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
                Code review, with context
              </p>
              <h1
                id="hero-title"
                className="mt-6 max-w-[15ch] text-[clamp(2.6rem,4.5vw,4rem)] font-medium leading-[1.06] tracking-[-0.045em] sm:mt-8"
              >
                Understand your code. Prioritize{" "}
                <span className="block text-accent">what matters.</span>
              </h1>
              <p className="mt-6 max-w-[42ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
                Review security findings, trace the evidence, and plan your next fix in one
                workspace.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 sm:mt-10">
                <Link to="/login" className={primaryAction}>
                  Start an audit <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <a
                  href="#pipeline"
                  className="inline-flex min-h-12 items-center gap-3 text-sm font-medium underline decoration-border underline-offset-8 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  See the workflow <ArrowDown size={15} aria-hidden="true" />
                </a>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                Automated assessments. Human review required.
              </p>
            </div>
            <figure className="mx-auto w-full max-w-[520px] lg:justify-self-end">
              <div className="overflow-hidden rounded-md bg-[#111111]">
                <img
                  src="/assets/archon-system-audit.webp"
                  alt="Architectural model linking cloud infrastructure, source evidence, and an audit report"
                  className="aspect-[1/1.02] w-full object-contain"
                  width={1122}
                  height={1402}
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
              <figcaption className="mt-2 text-[11px] text-muted-foreground">
                Workflow illustration
              </figcaption>
            </figure>
          </div>
        </section>

        <section aria-label="From source to next steps" className="border-y border-border">
          <div className={`${container} py-8 lg:flex lg:items-start lg:gap-8 lg:py-9`}>
            <p className="mb-6 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground lg:mb-0 lg:pt-1">
              From source to next steps
            </p>
            <ul className="grid flex-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-7">
              {OUTCOMES.map((item) => (
                <li key={item.title} className="border-l border-border pl-4 lg:pl-6">
                  <h2 className="text-sm font-medium">{item.title}</h2>
                  <p className="mt-2 max-w-[24ch] text-xs leading-relaxed text-muted-foreground">
                    {item.note}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="bg-card/40">
          <section
            id="product"
            aria-labelledby="product-title"
            className={`${container} scroll-mt-24 pb-4 pt-14 sm:pt-20`}
          >
            <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <p className={eyebrow}>01 / Investigate</p>
                <h2
                  id="product-title"
                  className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl"
                >
                  Every finding, in context.
                </h2>
              </div>
              <p className="max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
                See the affected file, understand the evidence, and review suggested remediation.
              </p>
            </div>
            <LandingCodePreview />
          </section>
          <section
            id="pipeline"
            aria-labelledby="workflow-title"
            className={`${container} relative scroll-mt-24 py-14 sm:py-20`}
          >
            {/* Preserve links to the former motion section. */}
            <span id="audit-flow" className="absolute top-0 scroll-mt-24" />
            <p className={eyebrow}>02 / Workflow</p>
            <h2
              id="workflow-title"
              className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl"
            >
              A clear path from upload to report.
            </h2>
            <ol className="mt-9 grid gap-8 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW.map((step, index) => (
                <li key={step.title}>
                  <div className="flex items-center gap-5" aria-hidden="true">
                    <span className="font-mono text-sm text-accent">0{index + 1}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <h3 className="mt-4 text-base font-medium">{step.title}</h3>
                  <p className="mt-2 max-w-[27ch] text-sm leading-relaxed text-muted-foreground">
                    {step.note}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section
          id="frameworks"
          aria-labelledby="frameworks-title"
          className="scroll-mt-20 border-t border-border"
        >
          <div
            className={`${container} grid gap-8 py-12 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14`}
          >
            <div>
              <p className={eyebrow}>03 / Frameworks</p>
              <h2
                id="frameworks-title"
                className="mt-3 max-w-[18ch] text-3xl font-medium tracking-tight sm:text-4xl"
              >
                Connect findings to controls.
              </h2>
              <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-muted-foreground">
                Explore assessment mappings in the context of your audit.
              </p>
            </div>
            <div className="flex flex-col justify-center lg:border-l lg:border-border lg:pl-12">
              <ul className="flex flex-wrap items-center gap-x-7 gap-y-5 py-3 text-base font-medium lg:justify-between">
                {FRAMEWORKS.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                Assessment signals are not proof of compliance.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="closing-title"
          className="relative isolate overflow-hidden bg-[#111111] text-white"
        >
          <img
            src="/assets/archon-infrastructure-backdrop.webp"
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover"
            width={1672}
            height={941}
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 -z-10 bg-black/65 sm:bg-black/45" />
          <div className={`${container} flex flex-col items-center py-14 text-center sm:py-16`}>
            <h2 id="closing-title" className="text-3xl font-medium tracking-tight sm:text-4xl">
              Make your next review clearer.
            </h2>
            <p className="mt-4 text-base text-white/85">Start with your code. Leave with a plan.</p>
            <Link
              to="/login"
              className="mt-7 inline-flex min-h-12 items-center justify-center gap-3 rounded-md bg-[#f5f1ec] px-6 py-3 text-sm font-medium text-[#111111] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black"
            >
              Launch console <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter compact />
    </div>
  );
}
