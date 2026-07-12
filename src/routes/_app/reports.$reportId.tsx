import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileText, ArrowLeft, Stamp, Sparkles } from "lucide-react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { BrutalBadge } from "@/components/brutal/BrutalBadge";
import { FINDINGS, FRAMEWORKS, REPORTS } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/reports/$reportId")({
  head: ({ params }) => {
    const r = REPORTS.find((x) => x.id === params.reportId);
    const title = r ? `${r.title} · Archon` : "Report · Archon";
    return {
      meta: [
        { title },
        { name: "description", content: r?.title ?? "Audit report" },
        { property: "og:title", content: title },
        { property: "og:description", content: r?.title ?? "Audit report" },
      ],
    };
  },
  component: ReportDetail,
});

function ReportDetail() {
  const { reportId } = Route.useParams();
  const r = REPORTS.find((x) => x.id === reportId) ?? REPORTS[0];

  return (
    <AppShell
      subtitle={r.framework}
      title={r.title}
      actions={
        <div className="flex gap-2">
          <Link to="/reports">
            <BrutalButton variant="ghost" size="sm">
              <ArrowLeft size={14} /> All reports
            </BrutalButton>
          </Link>
          <BrutalButton variant="primary">
            <Download size={15} /> Download PDF
          </BrutalButton>
        </div>
      }
    >
      {/* Cover */}
      <section className="relative overflow-hidden rounded-2xl hairline bg-card p-8 shadow-soft">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-bl from-secondary/40 to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <BrutalBadge tone="ink">{r.id}</BrutalBadge>
            <BrutalBadge tone={r.status === "Signed" ? "success" : "gold"}>
              {r.status}
            </BrutalBadge>
            <span className="text-xs text-muted-foreground">{r.date}</span>
          </div>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            {r.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Generated autonomously from 142 evidence artifacts across the production environment.
            Reviewed by 2 humans. {r.pages} pages.
          </p>

          <div className="mt-6 grid max-w-2xl grid-cols-3 gap-3">
            <Metric label="Controls in scope" value="64" />
            <Metric label="Findings" value={String(FINDINGS.length)} />
            <Metric label="Pass rate" value="78%" />
          </div>
        </div>
      </section>

      {/* Executive summary */}
      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl hairline bg-card p-6 shadow-soft lg:col-span-2">
          <p className="section-title text-primary">01 · Summary</p>
          <h3 className="mt-1 text-xl font-bold">Executive summary</h3>
          <p className="mt-3 text-sm leading-relaxed">
            Archon evaluated the Acme Cloud control environment against the {r.framework}{" "}
            criteria for the period ending {r.date}. The organization demonstrates a maturing
            security program with strong identity governance and incident response, while logical
            access enforcement and vendor risk monitoring remain the largest residual exposures.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            Eight critical findings require remediation prior to the next attestation window. The
            agent has drafted remediation pull requests for six of these and routed two to the
            architecture review board.
          </p>

          <div className="mt-5 rounded-xl hairline bg-secondary/40 p-4 text-sm">
            <p className="section-title text-foreground">
              <Sparkles size={11} className="mr-1 inline" strokeWidth={2.5} /> Agent verdict
            </p>
            <p className="mt-2 font-semibold">
              Conditional pass. Address CC6.1 and SC-7 within 30 days to clear the period.
            </p>
          </div>
        </div>

        <div className="rounded-2xl hairline bg-card p-6 shadow-soft">
          <p className="section-title text-primary">02 · Signatures</p>
          <h3 className="mt-1 text-xl font-bold">Sign-off</h3>
          <div className="mt-4 space-y-4">
            {[
              { name: "M. Aoki", role: "Archon Agent v4.2", signed: true },
              { name: "Priya R.", role: "Lead Auditor", signed: true },
              { name: "J. Okonkwo", role: "CISO", signed: false },
            ].map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between border-b border-dashed border-border pb-3 last:border-b-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-bold">{s.name}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {s.role}
                  </div>
                </div>
                {s.signed ? (
                  <div className="flex items-center gap-1 rounded-full border border-success/30 bg-success px-2 py-0.5 text-[10px] font-semibold uppercase text-success-foreground">
                    <Stamp size={11} strokeWidth={2.5} /> Signed
                  </div>
                ) : (
                  <BrutalBadge tone="ghost">Pending</BrutalBadge>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Control matrix */}
      <section className="mt-6 overflow-hidden rounded-2xl hairline bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="section-title text-primary">03 · Matrix</p>
            <h3 className="text-xl font-bold">Control coverage matrix</h3>
          </div>
          <BrutalBadge tone="ink">
            <FileText size={11} strokeWidth={2.5} /> Auto-generated
          </BrutalBadge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-muted">
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left font-semibold">Framework</th>
                <th className="px-5 py-3 text-left font-semibold">Controls</th>
                <th className="px-5 py-3 text-left font-semibold">Met</th>
                <th className="px-5 py-3 text-left font-semibold">Partial</th>
                <th className="px-5 py-3 text-left font-semibold">Violated</th>
                <th className="px-5 py-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {FRAMEWORKS.map((f, i) => {
                const total = f.controls;
                const met = Math.round(total * (0.6 + (i % 3) * 0.1));
                const partial = Math.round(total * 0.15);
                const violated = Math.max(0, total - met - partial);
                return (
                  <tr key={f.id} className="border-t border-border transition-colors hover:bg-muted/70">
                    <td className="px-5 py-3 font-semibold">{f.label}</td>
                    <td className="px-5 py-3 font-mono">{total}</td>
                    <td className="px-5 py-3 font-mono">{met}</td>
                    <td className="px-5 py-3 font-mono">{partial}</td>
                    <td className="px-5 py-3 font-mono">{violated}</td>
                    <td className="px-5 py-3">
                      <BrutalBadge tone={violated === 0 ? "success" : violated < 5 ? "gold" : "primary"}>
                        {violated === 0 ? "Clean" : violated < 5 ? "Watch" : "Action"}
                      </BrutalBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Findings */}
      <section className="mt-6 overflow-hidden rounded-2xl hairline bg-card shadow-soft">
        <div className="border-b border-border px-6 py-4">
          <p className="section-title text-primary">04 · Findings</p>
          <h3 className="text-xl font-bold">Detailed findings</h3>
        </div>
        <ol className="divide-y divide-border">
          {FINDINGS.slice(0, 5).map((f, i) => (
            <li key={f.id} className="px-6 py-5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  04.{String(i + 1).padStart(2, "0")}
                </span>
                <BrutalBadge tone={f.severity}>{f.severity}</BrutalBadge>
                <h4 className="text-base font-bold">{f.title}</h4>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed">{f.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Component <span className="font-mono">{f.component}</span> · controls{" "}
                {f.controls.map((c) => `${c.framework} ${c.control}`).join(", ")}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl hairline bg-muted px-3 py-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="section-title text-muted-foreground">{label}</div>
    </div>
  );
}
