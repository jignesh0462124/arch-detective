import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  FileCheck2,
  GitBranch,
  Network,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import {
  MarketingBackdrop,
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/MarketingChrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Archon | How the audit engine works" },
      {
        name: "description",
        content:
          "Learn how Archon turns repositories, architecture files, and logs into prioritized findings, mapped controls, and audit-ready reports.",
      },
    ],
  }),
  component: AboutPage,
});

type WorkflowStage = {
  step: string;
  label: string;
  title: string;
  description: string;
  image: string;
  alt: string;
  icon: LucideIcon;
  imageFirst: boolean;
  points: string[];
};

const WORKFLOW: WorkflowStage[] = [
  {
    step: "01",
    label: "Connect",
    title: "Start with the system, not a questionnaire.",
    description:
      "Give Archon the evidence your team already maintains. A repository, architecture YAML, or a focused log sample is enough to begin a traceable review.",
    image: "/assets/archon-about-connect.webp",
    alt: "Repository, architecture document, and log store connected to one analysis engine",
    icon: GitBranch,
    imageFirst: false,
    points: [
      "Connect a Git repository or upload a ZIP archive",
      "Add architecture YAML to describe trust boundaries",
      "Attach server logs when runtime behavior matters",
    ],
  },
  {
    step: "02",
    label: "Model",
    title: "See the architecture the scanners are reasoning about.",
    description:
      "Archon extracts services, data stores, entry points, identities, and dataflows into one system model. Every later finding stays attached to this evidence graph.",
    image: "/assets/archon-about-model.webp",
    alt: "Layered system model with servers, database, cloud, trust boundaries, and orange dataflow",
    icon: Network,
    imageFirst: true,
    points: [
      "Static analyzers inspect code, dependencies, and secrets",
      "The agent identifies assets, actors, and trust transitions",
      "Source references remain linked to each conclusion",
    ],
  },
  {
    step: "03",
    label: "Triage",
    title: "Work the findings that change risk first.",
    description:
      "Raw scanner output is grouped, scored, and ranked by severity, exploitability, and reachability. The queue explains what matters and which controls are affected.",
    image: "/assets/archon-about-triage.webp",
    alt: "Inspection instrument examining a server issue and mapping it to five control records",
    icon: ScanSearch,
    imageFirst: false,
    points: [
      "Review evidence, attack path, and remediation together",
      "Filter by severity, framework, or affected service",
      "Map one issue across all selected compliance catalogs",
    ],
  },
  {
    step: "04",
    label: "Report",
    title: "Turn verified evidence into an audit package.",
    description:
      "When the queue is ready, Archon composes an executive summary, technical findings, framework coverage, and remediation guidance into a report your team can review and export.",
    image: "/assets/archon-about-report.webp",
    alt: "Infrastructure analysis machine delivering a sealed audit report into an output tray",
    icon: FileCheck2,
    imageFirst: true,
    points: [
      "Generate a consistent report from the current scan state",
      "Keep control citations beside the supporting evidence",
      "Export a clear PDF for engineering and audit stakeholders",
    ],
  },
];

const OVERVIEW = [
  { value: "3", label: "input types" },
  { value: "6", label: "analysis engines" },
  { value: "5", label: "framework mappings" },
  { value: "1", label: "evidence trail" },
];

function AboutPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <MarketingBackdrop />

      <div className="relative z-10 min-h-screen">
        <MarketingHeader current="about" />

        <main className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-6 sm:px-6 lg:space-y-8 lg:py-8">
          {WORKFLOW.map((stage, index) => {
            const Icon = stage.icon;
            const isFirst = index === 0;

            return (
              <section
                key={stage.step}
                id={isFirst ? "how-it-works" : undefined}
                className="scroll-mt-24 overflow-hidden rounded-sm border border-border bg-card"
              >
                <div className="grid lg:min-h-[520px] lg:grid-cols-2">
                  <div
                    className={[
                      "flex flex-col justify-center px-6 py-10 sm:px-9 sm:py-12 lg:px-12 lg:py-14",
                      stage.imageFirst ? "lg:order-2" : "lg:order-1",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                        <Icon size={17} strokeWidth={2} />
                      </span>
                      <span className="font-mono text-[11px] text-accent">{stage.step}</span>
                      <span>{stage.label}</span>
                    </div>

                    {isFirst ? (
                      <>
                        <p className="mt-8 section-title text-accent">// About Archon</p>
                        <h1 className="mt-2 max-w-[15ch] text-[40px] font-medium leading-[1.05] sm:text-5xl lg:text-[52px]">
                          {stage.title}
                        </h1>
                      </>
                    ) : (
                      <h2 className="mt-8 max-w-[18ch] text-3xl font-medium leading-tight sm:text-4xl">
                        {stage.title}
                      </h2>
                    )}

                    <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
                      {stage.description}
                    </p>

                    <ul className="mt-7 border-t border-border">
                      {stage.points.map((point) => (
                        <li
                          key={point}
                          className="flex min-h-12 items-start gap-3 border-b border-border py-3 text-sm leading-relaxed"
                        >
                          <Check
                            size={15}
                            className="mt-0.5 shrink-0 text-success"
                            strokeWidth={2.5}
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>

                    {isFirst && (
                      <div className="mt-7 flex flex-wrap gap-3">
                        <Link
                          to="/new-scan"
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
                        >
                          Start a scan <ArrowRight size={14} strokeWidth={2.5} />
                        </Link>
                        <a
                          href="#workflow-overview"
                          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                        >
                          See the full workflow
                        </a>
                      </div>
                    )}
                  </div>

                  <figure
                    className={[
                      "relative min-h-[320px] overflow-hidden bg-[#111111] sm:min-h-[420px] lg:min-h-full",
                      stage.imageFirst
                        ? "border-t border-border lg:order-1 lg:border-r lg:border-t-0"
                        : "border-t border-border lg:order-2 lg:border-l lg:border-t-0",
                    ].join(" ")}
                  >
                    <img
                      src={stage.image}
                      alt={stage.alt}
                      className="absolute inset-0 h-full w-full object-cover object-center"
                      width={1536}
                      height={1152}
                      loading={isFirst ? "eager" : "lazy"}
                      fetchPriority={isFirst ? "high" : "auto"}
                    />
                    <figcaption className="absolute bottom-4 left-4 rounded-md border border-white/15 bg-black/85 px-2.5 py-1.5 font-mono text-[10px] text-white">
                      {stage.step} / {stage.label.toLowerCase()}
                    </figcaption>
                  </figure>
                </div>
              </section>
            );
          })}

          <section
            id="workflow-overview"
            aria-label="Workflow overview"
            className="scroll-mt-24 overflow-hidden rounded-sm border border-border bg-card"
          >
            <div className="border-b border-border px-6 py-6 sm:px-8">
              <p className="section-title text-accent">// One connected review</p>
              <h2 className="mt-1 text-2xl font-medium sm:text-3xl">
                Automation with an evidence trail your team can inspect.
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-border">
              {OVERVIEW.map((item) => (
                <div
                  key={item.label}
                  className="border-b border-border px-6 py-6 even:border-l sm:border-b-0 sm:border-l-0 sm:px-8"
                >
                  <div className="text-3xl font-medium">{item.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid overflow-hidden rounded-sm border border-border bg-card lg:grid-cols-12">
            <div className="px-6 py-9 sm:px-9 lg:col-span-8 lg:px-12 lg:py-11">
              <div className="flex items-center gap-2 text-sm font-medium text-success">
                <ShieldCheck size={17} strokeWidth={2} /> Ready for your first review
              </div>
              <h2 className="mt-3 text-3xl font-medium leading-tight sm:text-4xl">
                Bring one repository. Leave with a defensible next step.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                The current preview uses sample data, so you can explore the workflow before the
                live analysis services are connected.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-7 sm:px-9 lg:col-span-4 lg:justify-end lg:border-l lg:border-t-0 lg:px-10">
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
              >
                Launch console <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
              <Link
                to="/reports/$reportId"
                params={{ reportId: "RPT-0098" }}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Sample report
              </Link>
            </div>
          </section>
        </main>

        <MarketingFooter />
      </div>
    </div>
  );
}
