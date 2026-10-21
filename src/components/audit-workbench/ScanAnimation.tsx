import {
  CheckCircle,
  CircleNotch,
  FileZip,
  ShieldCheck,
  TreeStructure,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { AuditEvent } from "@/lib/api/workbench";

const stages = [
  {
    key: "upload",
    label: "Validate archive",
    description: "Check the ZIP and supported source files.",
  },
  {
    key: "extracting",
    label: "Index source",
    description: "Prepare a private, read-only source preview.",
  },
  { key: "finding", label: "Analyze code", description: "Inspect source for security findings." },
  {
    key: "compliance",
    label: "Map controls",
    description: "Review candidate compliance controls and remediation.",
  },
  {
    key: "summary",
    label: "Save results",
    description: "Save the audit for review and report export.",
  },
];
export function ScanAnimation({
  progress,
  events,
  elapsed,
  name,
  paused = false,
  progressive = false,
}: {
  progress: number;
  events: AuditEvent[];
  elapsed: number;
  name: string;
  paused?: boolean;
  progressive?: boolean;
}) {
  const current = events.at(-1);
  const key =
    current?.step === "cvss"
      ? "finding"
      : current?.step === "remediation"
        ? "compliance"
        : current?.step || "upload";
  const active = Math.max(
    0,
    stages.findIndex((s) => s.key === key),
  );
  return (
    <section
      aria-label="Audit progress"
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="border-b border-border p-5 sm:p-7">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Step 2 of 3 · Scan project
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">
              {paused ? "Scan needs attention" : "Reviewing your project"}
            </h2>
            <p className="mt-1 break-all text-sm text-muted-foreground">{name}</p>
          </div>
          <span className="rounded-md border border-border px-3 py-2 font-mono text-xs">
            {Math.floor(elapsed / 60)}m {elapsed % 60}s elapsed
          </span>
        </div>
      </div>
      <div className="grid gap-8 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)]">
        <ol className="space-y-1">
          {stages.map((stage, index) => (
            <li
              key={stage.key}
              className={cn("flex gap-3 rounded-md p-3", index === active && "bg-accent/5")}
              aria-current={index === active ? "step" : undefined}
            >
              {index < active ? (
                <CheckCircle size={22} className="shrink-0 text-success" weight="fill" />
              ) : index === active ? (
                <CircleNotch
                  size={22}
                  className={cn(
                    "shrink-0 text-accent motion-reduce:animate-none",
                    !paused && "animate-spin",
                  )}
                />
              ) : (
                <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
                  {index + 1}
                </span>
              )}
              <div>
                <p className={cn("text-sm font-medium", index > active && "text-muted-foreground")}>
                  {stage.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex min-w-0 flex-col justify-center">
          <div className="audit-scan-visual relative flex min-h-40 items-center justify-center gap-5 overflow-hidden rounded-lg border border-border bg-background">
            <FileZip size={30} weight="duotone" className="text-muted-foreground" />
            <span className="h-px w-10 bg-border" />
            <TreeStructure size={36} weight="duotone" className="text-accent" />
            <span className="h-px w-10 bg-border" />
            <ShieldCheck size={30} weight="duotone" className="text-muted-foreground" />
            {!paused && (
              <div className="audit-scan-sweep pointer-events-none absolute inset-y-0 w-0.5 bg-accent/50" />
            )}
          </div>
          <div className="mt-5 flex justify-between text-xs">
            <span>Reported progress</span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Reported scan progress"
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full bg-accent transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p role="status" className="mt-3 min-h-10 text-xs leading-5 text-muted-foreground">
            {current?.label || "Uploading and validating your archive…"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {paused
              ? "Check the message below to reconnect or start a new audit."
              : progressive
                ? "The workbench opens after acceptance; source preparation and analysis continue there."
                : "The workbench opens when your results are ready."}
          </p>
        </div>
      </div>
      <details className="border-t border-border px-5 py-4">
        <summary className="cursor-pointer text-xs font-medium">
          Scan activity · {events.length} updates
        </summary>
        <ol className="mt-3 max-h-40 space-y-2 overflow-y-auto font-mono text-[11px] text-muted-foreground">
          {events.map((event) => (
            <li key={event.sequence}>{event.label}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
