import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cpu, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/brutal/ThemeToggle";
import { FRAMEWORKS } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sentinel — Agentic Compliance & Threat Modeling Engine" },
      {
        name: "description",
        content:
          "Sentinel parses architectures and logs, finds vulnerabilities, and ships audit-ready reports against SOC 2, ISO 27001, HIPAA, GDPR, PCI-DSS, and NIST in minutes.",
      },
    ],
  }),
  component: Landing,
});

const PIPELINE = [
  { code: "01 // INGEST", label: "Repository Analysis" },
  { code: "02 // TOPOLOGIZE", label: "Graph Extraction" },
  { code: "03 // THREAT-MODEL", label: "Risk Assessment" },
  { code: "04 // MAP-CONTROLS", label: "Framework Alignment" },
  { code: "05 // SIGN & SHIP", label: "Signed Audit Report" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-start justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl border-[3px] border-ink bg-card shadow-brutal overflow-hidden">
        {/* NAV */}
        <header className="flex items-center justify-between border-b-[3px] border-ink px-6 py-4 bg-cream">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center border-[2px] border-ink bg-primary text-primary-foreground">
              <Cpu size={16} strokeWidth={2.5} />
            </div>
            <span className="text-base font-bold tracking-tight">SENTINEL</span>
          </Link>
          <nav className="hidden items-center gap-7 text-xs font-bold uppercase tracking-[0.15em] md:flex">
            <a href="#product" className="hover:text-primary">Product</a>
            <a href="#pipeline" className="hover:text-primary">Pipeline</a>
            <a href="#frameworks" className="hover:text-primary">Frameworks</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 border-[2px] border-ink bg-primary px-3 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-[3px_3px_0_0_hsl(var(--ink)/1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            >
              Launch <ArrowRight size={12} />
            </Link>
          </div>
        </header>

        {/* HERO — split 7/5 */}
        <section className="grid grid-cols-1 lg:grid-cols-12 border-b-[3px] border-ink">
          <div className="lg:col-span-7 p-8 md:p-12 border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-ink flex flex-col justify-center bg-card">
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="inline-flex items-center gap-1 border border-ink bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground">
                <Zap size={10} strokeWidth={3} /> Llama 3.1
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground italic">
                Powered by Groq
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold leading-[0.85] tracking-tighter">
              AUDIT AT
              <br />
              <span className="text-primary">MACHINE</span> SPEED.
            </h1>
            <p className="mt-8 max-w-lg text-base md:text-lg font-medium text-muted-foreground">
              Sentinel is an agentic engine that parses architecture, finds
              vulnerabilities, and ships signed audit reports in minutes — not weeks.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 border-[2px] border-ink bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground shadow-[4px_4px_0_0_hsl(var(--ink)/1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              >
                Launch Console <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
              <Link
                to="/reports/$reportId"
                params={{ reportId: "RPT-0098" }}
                className="inline-flex items-center border-[2px] border-ink bg-cream px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-foreground shadow-[4px_4px_0_0_hsl(var(--ink)/1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              >
                View Sample
              </Link>
            </div>
          </div>

          {/* Terminal panel */}
          <div className="lg:col-span-5 bg-ink p-6 flex flex-col text-cream">
            <div className="flex gap-1.5 mb-4">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
              <span className="h-2.5 w-2.5 rounded-full bg-success" />
            </div>
            <div className="flex-1 font-mono text-[11px] leading-relaxed">
              <div className="text-success mb-1">$ sentinel --scan infra-prod</div>
              <div className="text-cream/40 mb-3">Initializing agentic swarm…</div>
              <div className="mb-1"><span className="text-primary">PARSE:</span> 47 assets identified</div>
              <div className="mb-1"><span className="text-primary">THREAT:</span> 19 attack vectors found</div>
              <div className="mb-1"><span className="text-primary">MAP:</span> 38 SOC2 controls validated</div>
              <div className="mb-4"><span className="text-primary">REPORT:</span> Generating signed PDF…</div>

              <div className="mt-4 border border-cream/20 bg-cream/5 p-3">
                <div className="flex justify-between items-center text-cream/60 mb-1.5">
                  <span>COMPLETION TIME</span>
                  <span className="text-success">1m 48s</span>
                </div>
                <div className="flex justify-between items-center text-cream/60 mb-1.5">
                  <span>THROUGHPUT</span>
                  <span className="text-cream">740 TOK/S</span>
                </div>
                <div className="flex justify-between items-center text-cream/60">
                  <span>COST / SCAN</span>
                  <span className="text-cream">$0.03</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES — three numbered cells */}
        <section id="product" className="grid grid-cols-1 md:grid-cols-3 border-b-[3px] border-ink bg-cream">
          {[
            { n: "01", t: "Parse", b: "Extract assets, dataflows, and trust boundaries from code and logs automatically." },
            { n: "02", t: "Map", b: "Trace every threat to specific regulatory controls with citation-grade evidence." },
            { n: "03", t: "Report", b: "Generate human-readable, auditor-ready documentation co-signed by your team." },
          ].map((f, i) => (
            <div
              key={f.n}
              className={[
                "p-8",
                i < 2 ? "border-b-[3px] md:border-b-0 md:border-r-[3px] border-ink" : "",
              ].join(" ")}
            >
              <div className="text-4xl font-bold mb-4 text-primary tracking-tighter">{f.n}</div>
              <h3 className="text-2xl font-bold mb-2 uppercase tracking-tight">{f.t}</h3>
              <p className="text-sm text-muted-foreground">{f.b}</p>
            </div>
          ))}
        </section>

        {/* PIPELINE — vertical trace on ink */}
        <section id="pipeline" className="bg-ink text-cream p-8 md:p-16 flex flex-col md:flex-row gap-10 md:gap-16 border-b-[3px] border-ink">
          <div className="md:w-1/3">
            <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-3">// Pipeline</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-6">
              Autonomous, five-step verification sequence.
            </h2>
            <p className="text-cream/60 text-sm">
              Every scan follows a deterministic flow optimized for speed and
              traceability — from repository to signed report.
            </p>
          </div>
          <div className="flex-1 border-l-2 border-cream/20 pl-8 space-y-10">
            {PIPELINE.map((s, i) => (
              <div key={s.code} className="relative">
                <div
                  className={[
                    "absolute -left-[41px] top-1 h-4 w-4 border-2 border-ink",
                    i === 0 ? "bg-primary" : "bg-cream/20",
                  ].join(" ")}
                />
                <div
                  className={[
                    "font-mono text-xs mb-1 tracking-wider",
                    i === 0 ? "text-primary" : "text-cream/40",
                  ].join(" ")}
                >
                  {s.code}
                </div>
                <div className="text-lg font-bold">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FRAMEWORKS — status dashboard */}
        <section id="frameworks" className="p-8 md:p-12 bg-card border-b-[3px] border-ink">
          <div className="flex flex-wrap justify-between items-end gap-3 mb-8">
            <h2 className="text-3xl font-bold uppercase tracking-tighter">Status Dashboard</h2>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {FRAMEWORKS.length} Frameworks Active
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FRAMEWORKS.map((f) => (
              <div key={f.id} className="p-5 border-[2px] border-ink bg-cream">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold">{f.label}</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-success text-success-foreground font-bold uppercase tracking-wider border border-ink">
                    Active
                  </span>
                </div>
                <div className="text-2xl font-black tracking-tight">
                  {f.controls}{" "}
                  <span className="text-xs font-normal text-muted-foreground uppercase tracking-wider">
                    Controls
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="p-8 md:p-12 bg-primary">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1">
              <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground leading-none tracking-tighter mb-4">
                DITCH THE
                <br />
                MANUAL LABOR.
              </h2>
              <p className="text-primary-foreground/80 font-medium">
                Connect your first repo and get a draft audit in 5 minutes.
              </p>
            </div>
            <div className="w-full md:w-auto">
              <Link
                to="/new-scan"
                className="block w-full md:w-64 text-center py-5 bg-ink text-cream font-bold text-base uppercase tracking-[0.18em] border-[2px] border-ink shadow-[8px_8px_0_0_rgba(255,255,255,0.3)] hover:translate-x-2 hover:translate-y-2 hover:shadow-none transition-all"
              >
                Start Free Scan
              </Link>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 text-xs bg-cream border-t-[3px] border-ink">
          <div className="flex items-center gap-2 font-semibold">
            <div className="flex h-6 w-6 items-center justify-center border-[2px] border-ink bg-primary text-primary-foreground">
              <Cpu size={11} strokeWidth={2.5} />
            </div>
            SENTINEL · © 2026
          </div>
          <div className="flex gap-5 text-muted-foreground">
            <a href="#">Security</a>
            <a href="#">Docs</a>
            <a href="#">Changelog</a>
            <a href="#">Contact</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
