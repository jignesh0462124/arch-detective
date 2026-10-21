import { Link } from "@tanstack/react-router";
import { ArrowClockwise } from "@phosphor-icons/react";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { SectionCard } from "@/components/ui/section-card";
import type { ReportPreview } from "@/lib/api/reports";

function readableValue(value: unknown): string {
  if (value === null || value === undefined) return "Not recorded";
  if (Array.isArray(value)) return value.map(readableValue).join("; ");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, item]) => `${key.replaceAll("_", " ")}: ${readableValue(item)}`)
      .join("; ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === "static_and_ai") return "Static checks and AI review";
  if (value === "static") return "Static checks";
  return String(value);
}
export function ReportNotice({
  title,
  description,
  retry,
  audit = false,
}: {
  title: string;
  description?: string;
  retry?: () => void;
  audit?: boolean;
}) {
  return (
    <SectionCard title={title} description={description}>
      <div className="flex flex-wrap gap-2">
        {retry && (
          <BrutalButton variant="secondary" size="sm" onClick={retry}>
            <ArrowClockwise size={16} />
            Retry
          </BrutalButton>
        )}
        {audit && (
          <Link
            to="/workspace"
            className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Run Codebase Audit
          </Link>
        )}
      </div>
    </SectionCard>
  );
}
export function ReportDownloadStatus({
  download,
}: {
  download: {
    busy: string | null;
    message: string;
    error: string;
    progress: { done: number; total: number };
    cancel: () => void;
  };
}) {
  return (
    <>
      {download.busy && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-sm hairline bg-secondary p-3"
          role="status"
        >
          <span className="text-sm">
            {download.busy === "zip"
              ? `Preparing ZIP · ${download.progress.done} of ${download.progress.total} PDFs processed`
              : "Preparing PDF from saved evidence…"}
          </span>
          <BrutalButton variant="secondary" size="sm" onClick={download.cancel}>
            Cancel
          </BrutalButton>
        </div>
      )}
      {download.message && (
        <p role="status" className="rounded-sm hairline bg-secondary p-3 text-sm">
          {download.message}
        </p>
      )}
      {download.error && (
        <p
          role="alert"
          className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {download.error} Use the download action to retry.
        </p>
      )}
    </>
  );
}
export function Coverage({ report }: { report: ReportPreview }) {
  const data = { ...report.analysis, ...report.coverage };
  return (
    <SectionCard
      title="Coverage & limitations"
      description="Automated assessment, not a compliance certificate or proof that the project is secure."
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="min-w-0">
            <dt className="capitalize text-muted-foreground">{key.replaceAll("_", " ")}</dt>
            <dd className="mt-1 break-words">
              {Array.isArray(value) ? (
                <ul className="list-disc space-y-1 pl-4">
                  {value.map((item, index) => (
                    <li key={index}>{readableValue(item)}</li>
                  ))}
                </ul>
              ) : (
                readableValue(value)
              )}
            </dd>
          </div>
        ))}
      </dl>
      {!Object.keys(data).length && (
        <p className="text-sm text-muted-foreground">
          Detailed scan coverage was not recorded for this audit.
        </p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        Static checks and model review have different coverage and input limits. Unreported issues
        may still exist. Source previews expire separately; saved findings and reports remain
        available.
      </p>
      {!!report.exclusions.length && (
        <p className="mt-3 break-words text-sm">
          Recorded exclusions:{" "}
          {report.exclusions
            .map((value) => (typeof value === "object" ? JSON.stringify(value) : String(value)))
            .join("; ")}
        </p>
      )}
    </SectionCard>
  );
}
