import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Cpu,
  ScanLine,
  ShieldCheck,
  FileText,
  Zap,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { BrutalBadge } from "@/components/brutal/BrutalBadge";
import { FRAMEWORKS } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sentinel — Agentic Compliance & Threat Modeling Engine" },
      {
        name: "description",
        content:
          "Sentinel parses architectures and logs, identifies vulnerabilities, and ships audit-ready reports against SOC 2, ISO 27001, HIPAA, GDPR, PCI-DSS, and NIST controls.",
      },
      { property: "og:title", content: "Sentinel — Agentic Compliance & Threat Modeling Engine" },
      {
        property: "og:description",
        content:
          "Audit at machine speed. Agentic threat modeling that maps vulnerabilities to compliance controls.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b-[1.5px] border-ink bg-cream/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border-brutal bg-primary text-primary-foreground shadow-brutal-sm">
              <Cpu size={16} strokeWidth={2.5} />
            </div>
            <div className="text-base font-bold tracking-tight">SENTINEL</div>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold md:flex">
            <a href="#product" className="hover:text-primary">Product</a>
            <a href="#pipeline" className="hover:text-primary">Pipeline</a>
            <a href="#frameworks" className="hover:text-primary">Frameworks</a>
            <a href="#pricing" className="hover:text-primary">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="hidden sm:inline">
              <BrutalButton variant="ghost" size="sm">Sign in</BrutalButton>
            </Link>
            <Link to="/dashboard">
              <BrutalButton variant="primary" size="sm">
                Launch console <ArrowRight size={14} />
              </BrutalButton>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "linear-gradient(to right, #1A1A1A 1px, transparent 1px), linear-gradient(to bottom, #1A1A1A 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
        </div>
        <div className="mx-auto grid max-w-[1280px] gap-12 px-6 py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-7">
            <BrutalBadge tone="gold">
              <Zap size={11} strokeWidth={2.5} /> Powered by Groq · Llama 3.1
            </BrutalBadge>
            <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Audit at
              <br />
              <span className="relative inline-block">
                <span className="relative z-10 px-2 text-cream">machine speed.</span>
                <span className="absolute inset-0 -skew-y-1 bg-ink" />
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Sentinel is an agentic engine that parses your architecture, finds vulnerabilities,
              maps them to SOC 2, ISO 27001, HIPAA, GDPR, PCI-DSS, and NIST controls, and ships a
              signed audit report — in minutes, not weeks.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/dashboard">
                <BrutalButton variant="primary" size="lg">
                  Launch console <ArrowRight size={16} />
                </BrutalButton>
              </Link>
              <Link to="/reports/RPT-0098">
                <BrutalButton variant="tertiary" size="lg">
                  View sample report
                </BrutalButton>
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
              {["SOC 2 Type II", "ISO 27001:2022", "HIPAA", "GDPR", "PCI-DSS 4.0"].map((x) => (
                <span key={x} className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider">
                  <CheckCircle2 size={13} strokeWidth={2.5} className="text-primary" /> {x}
                </span>
              ))}
            </div>
          </div>

          {/* Mock console card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border-brutal-2 bg-card p-5 shadow-brutal">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full border-brutal bg-primary" />
                  <span className="h-2.5 w-2.5 rounded-full border-brutal bg-secondary" />
                  <span className="h-2.5 w-2.5 rounded-full border-brutal bg-cream" />
                  <span className="ml-2 font-mono font-semibold">sentinel://scan/SCN-0142</span>
                </div>
                <BrutalBadge tone="success" dot>Live</BrutalBadge>
              </div>

              <div className="mt-4 rounded-lg border-brutal bg-ink p-4 font-mono text-[11px] text-cream/90 leading-relaxed">
                <div><span className="text-secondary">›</span> agent.parse(architecture.yaml)</div>
                <div className="text-cream/60">  ↳ 47 assets · 12 trust boundaries</div>
                <div className="mt-1"><span className="text-secondary">›</span> agent.threat_model(stride)</div>
                <div className="text-cream/60">  ↳ 19 threats identified</div>
                <div className="mt-1"><span className="text-secondary">›</span> agent.map(["SOC2","ISO27001","PCI"])</div>
                <div className="text-cream/60">  ↳ 38 controls touched · 8 violated</div>
                <div className="mt-1"><span className="text-secondary">›</span> agent.draft_report()</div>
                <div className="text-primary">  ✓ RPT-0098 ready · 124 pp · 1m 48s</div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  { v: "1m 48s", l: "End-to-end" },
                  { v: "740", l: "tok/s" },
                  { v: "$0.03", l: "Per scan" },
                ].map((m) => (
                  <div key={m.l} className="rounded-lg border-brutal bg-cream px-2 py-2">
                    <div className="text-base font-bold">{m.v}</div>
                    <div className="section-title text-muted-foreground">{m.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="product" className="border-t-[1.5px] border-ink">
        <div className="mx-auto max-w-[1280px] px-6 py-20">
          <div className="flex items-end justify-between">
            <div>
              <p className="section-title text-primary">What it does</p>
              <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Three agents. One audit-ready artifact.
              </h2>
            </div>
            <a href="#pipeline" className="hidden text-sm font-semibold underline underline-offset-4 md:inline">
              See the pipeline →
            </a>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: ScanLine,
                title: "Parse",
                tone: "primary",
                body: "Architectures, Terraform, k8s manifests, and operational logs — the agent extracts assets, dataflows, and trust boundaries automatically.",
              },
              {
                icon: ShieldCheck,
                title: "Map",
                tone: "gold",
                body: "Every threat is mapped to specific controls across SOC 2, ISO 27001, HIPAA, GDPR, PCI-DSS, and NIST 800-53 with citation-grade traceability.",
              },
              {
                icon: FileText,
                title: "Report",
                tone: "ink",
                body: "Generate signed PDF and DOCX audit reports with control matrices, evidence, and remediation PRs — co-signed by humans you choose.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border-brutal-2 bg-card p-6 shadow-brutal shadow-brutal-hover"
              >
                <div
                  className={[
                    "flex h-12 w-12 items-center justify-center rounded-lg border-brutal",
                    f.tone === "primary" ? "bg-primary text-primary-foreground" : "",
                    f.tone === "gold" ? "bg-secondary" : "",
                    f.tone === "ink" ? "bg-ink text-cream" : "",
                  ].join(" ")}
                >
                  <f.icon size={20} strokeWidth={2.25} />
                </div>
                <h3 className="mt-5 text-xl font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">
                  Learn more <ArrowUpRight size={14} strokeWidth={2.5} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline strip */}
      <section id="pipeline" className="border-t-[1.5px] border-ink bg-ink py-20 text-cream">
        <div className="mx-auto max-w-[1280px] px-6">
          <p className="section-title text-secondary">Pipeline</p>
          <h2 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            From repository to compliance report — five autonomous steps.
          </h2>

          <ol className="mt-12 grid gap-4 md:grid-cols-5">
            {[
              "Ingest",
              "Topologize",
              "Threat-model",
              "Map controls",
              "Sign & ship",
            ].map((step, i) => (
              <li
                key={step}
                className="rounded-xl border-[1.5px] border-cream/40 bg-cream/5 p-4"
              >
                <div className="flex items-center gap-2 font-mono text-xs text-secondary">
                  <span className="rounded-full border-[1.5px] border-secondary px-2 py-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  step
                </div>
                <div className="mt-3 text-lg font-bold">{step}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Frameworks */}
      <section id="frameworks" className="border-t-[1.5px] border-ink">
        <div className="mx-auto max-w-[1280px] px-6 py-20">
          <p className="section-title text-primary">Frameworks</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Ship-ready for the frameworks auditors actually ask for.
          </h2>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FRAMEWORKS.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-xl border-brutal-2 bg-card p-5 shadow-brutal"
              >
                <div>
                  <div className="text-xl font-bold">{f.label}</div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {f.controls} controls
                  </div>
                </div>
                <BrutalBadge tone="success" dot>Active</BrutalBadge>
              </div>
            ))}
          </div>

          <div className="mt-10 overflow-hidden rounded-xl border-brutal-2 bg-cream py-4">
            <div className="flex animate-marquee gap-12 whitespace-nowrap px-6 text-sm font-bold uppercase tracking-[0.18em]">
              {[...Array(2)].flatMap((_, k) =>
                ["SOC 2", "ISO 27001", "HIPAA", "GDPR", "PCI-DSS", "NIST 800-53", "FedRAMP", "CCPA"].map(
                  (label) => (
                    <span key={label + k} className="inline-flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-primary" /> {label}
                    </span>
                  )
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser / CTA */}
      <section id="pricing" className="border-t-[1.5px] border-ink">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="rounded-2xl border-brutal-2 bg-secondary p-10 shadow-brutal sm:p-14">
            <div className="grid items-center gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="section-title">Get started</p>
                <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                  Stop auditing by hand.
                  <br />
                  Let the agent do the paperwork.
                </h2>
                <p className="mt-4 max-w-xl text-sm sm:text-base">
                  Connect a repository or upload an architecture diagram. Sentinel ships your
                  first draft audit in under 5 minutes — free for the first 3 scans.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Link to="/dashboard">
                  <BrutalButton variant="primary" size="lg" className="w-full">
                    <Sparkles size={16} strokeWidth={2.5} /> Launch console
                  </BrutalButton>
                </Link>
                <Link to="/new-scan">
                  <BrutalButton variant="secondary" size="lg" className="w-full">
                    Start a scan
                  </BrutalButton>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t-[1.5px] border-ink">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border-brutal bg-primary text-primary-foreground">
              <Cpu size={12} strokeWidth={2.5} />
            </div>
            SENTINEL · © 2026
          </div>
          <div className="flex gap-5 text-muted-foreground">
            <a href="#">Security</a>
            <a href="#">Docs</a>
            <a href="#">Changelog</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
