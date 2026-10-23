import { authScope, isCurrentScope, accountStorage } from "@/lib/authState";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle,
  CircleNotch,
  FileZip,
  FolderOpen,
  LockSimple,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import {
  startWorkbenchAudit,
  getWorkbenchProgress,
  workbenchError,
  type WorkbenchCapabilities,
} from "@/lib/api/workbench";
import { validateAuditFile } from "@/lib/auditView";
import { ScanAnimation } from "./ScanAnimation";
import { prefetchWorkbench } from "./preload";
import { AuditHistoryButton } from "./AuditHistory";
const GitHubRepositories = lazy(() =>
  import("@/components/github/GitHubRepositories").then((module) => ({
    default: module.GitHubRepositories,
  })),
);
import { AUDIT_FRAMEWORKS, auditDefaults } from "@/lib/workspaceSettings";
import type { WorkspaceSettings } from "@/lib/api/workspaces";

const frameworks = AUDIT_FRAMEWORKS;
const jobKey = (workspaceId: string) => `archon-workbench-job:${workspaceId}`;
function readJob(workspaceId: string): { id: string; name: string; created: string } | null {
  try {
    const value = JSON.parse(accountStorage.getItem(jobKey(workspaceId)) || "null");
    return value &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      typeof value.created === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}

export function AuditUpload({
  workspaceId,
  workspaceName,
  role,
  capabilities,
  settings,
}: {
  workspaceId: string;
  workspaceName: string;
  role: string;
  capabilities: WorkbenchCapabilities;
  settings?: WorkspaceSettings;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const upload = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<"zip" | "github">("zip");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(() => auditDefaults(settings));
  const touchedDefaults = useRef(false);
  useEffect(() => {
    if (!touchedDefaults.current) setSelected(auditDefaults(settings));
  }, [settings]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState(() =>
    typeof window !== "undefined" ? readJob(workspaceId) : null,
  );
  const [elapsed, setElapsed] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const progress = useQuery({
    queryKey: ["workbench-progress", workspaceId, job?.id],
    queryFn: ({ signal }) => getWorkbenchProgress(job!.id, signal),
    enabled: !!job,
    retry: 1,
    refetchInterval: (query) =>
      query.state.error
        ? false
        : query.state.data?.status === "running" || !query.state.data
          ? 1500
          : false,
    gcTime: 0,
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      upload.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!job || progress.data?.status === "failed" || progress.isError) return;
    const tick = () =>
      setElapsed(
        Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(progress.data?.created_at || job.created).getTime()) / 1000,
          ),
        ),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [job, progress.data?.created_at, progress.data?.status, progress.isError]);
  useEffect(() => {
    if (
      !job ||
      !(
        progress.data?.status === "completed" ||
        (capabilities.progressive_workbench && progress.data?.status === "running")
      )
    )
      return;
    try {
      if (progress.data?.status === "completed") accountStorage.removeItem(jobKey(workspaceId));
    } catch {
      /* Optional navigation metadata. */
    }
    void client.invalidateQueries({ queryKey: ["scans"] });
    void client.invalidateQueries({ queryKey: ["audit-history"] });
    void client.invalidateQueries({ queryKey: ["findings"] });
    void navigate({
      to: "/workspace/$workspaceId/scans/$scanId/workbench",
      params: { workspaceId, scanId: job.id },
    });
  }, [
    progress.data?.status,
    job,
    workspaceId,
    client,
    navigate,
    capabilities.progressive_workbench,
  ]);
  const choose = (chosen: File | undefined) => {
    if (!chosen) return;
    const message = validateAuditFile(chosen);
    if (message || chosen.size > capabilities.max_zip_bytes) {
      setError(message || "This ZIP exceeds the upload limit.");
      setFile(null);
      return;
    }
    setError("");
    setFile(chosen);
    prefetchWorkbench();
    setName(chosen.name.replace(/\.zip$/i, "").replace(/[_-]/g, " "));
    setIdempotencyKey(crypto.randomUUID());
  };
  const start = async () => {
    const scope = authScope();
    if (!file || !selected.length || !name.trim() || uploading) return;
    setUploading(true);
    setError("");
    const controller = new AbortController();
    upload.current = controller;
    try {
      const result = await startWorkbenchAudit(
        file,
        name.trim(),
        selected,
        workspaceId,
        idempotencyKey,
        controller.signal,
      );
      if (!mounted.current || !isCurrentScope(scope)) return;
      const next = { id: result.scan_id, name: name.trim(), created: new Date().toISOString() };
      try {
        accountStorage.setItem(jobKey(workspaceId), JSON.stringify(next));
      } catch {
        /* Audit evidence is stored on the server. */
      }
      setJob(next);
      void client.invalidateQueries({ queryKey: ["audit-history"] });
      if (capabilities.progressive_workbench && result.status !== "failed") {
        void navigate({
          to: "/workspace/$workspaceId/scans/$scanId/workbench",
          params: { workspaceId, scanId: result.scan_id },
        });
      }
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) setError(workbenchError(e));
    } finally {
      if (mounted.current) setUploading(false);
    }
  };
  const reset = () => {
    touchedDefaults.current = false;
    setSelected(auditDefaults(settings));
    setJob(null);
    setFile(null);
    setError("");
    setIdempotencyKey(crypto.randomUUID());
    try {
      accountStorage.removeItem(jobKey(workspaceId));
    } catch {
      /* Optional navigation metadata. */
    }
  };
  const canStart = ["owner", "admin", "analyst"].includes(role);
  return (
    <AppShell title="Codebase Audit" subtitle={`Workspace · ${workspaceName}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {job || uploading ? "Scan project" : "New audit"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {job || uploading
                ? "Follow the analysis, then review findings beside your source."
                : "Upload your project and review security findings in context."}
            </p>
          </div>
          <AuditHistoryButton workspaceId={workspaceId} role={role} />
        </div>
        <ol className="grid grid-cols-3 border-b border-border text-[10px] sm:text-xs">
          {["Upload and configure", "Scan project", "Review in workbench"].map((label, index) => (
            <li
              key={label}
              className={`flex min-h-12 items-center gap-2 border-b-2 px-2 ${index === (job || uploading ? 1 : 0) ? "border-accent font-semibold" : "border-transparent text-muted-foreground"}`}
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px]">
                {index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
        {!job && !uploading && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Project source">
            <BrutalButton
              size="sm"
              variant={source === "zip" ? "primary" : "secondary"}
              aria-pressed={source === "zip"}
              onClick={() => setSource("zip")}
            >
              Upload ZIP
            </BrutalButton>
            <BrutalButton
              size="sm"
              variant={source === "github" ? "primary" : "secondary"}
              aria-pressed={source === "github"}
              onClick={() => setSource("github")}
            >
              GitHub repository
            </BrutalButton>
          </div>
        )}
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
          >
            {error}
          </p>
        ) : null}
        {job || uploading ? (
          <>
            <ScanAnimation
              progressive={capabilities.progressive_workbench}
              progress={progress.data?.progress || 0}
              events={progress.data?.events || []}
              elapsed={elapsed}
              name={job?.name || name}
              paused={progress.isError || progress.data?.status === "failed"}
            />
            {progress.isError || progress.data?.status === "failed" ? (
              <div role="alert" className="rounded-md border border-destructive/30 bg-card p-5">
                <p className="text-sm font-medium">
                  {progress.data?.error_message || workbenchError(progress.error)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <BrutalButton
                    size="sm"
                    variant="secondary"
                    onClick={() => void progress.refetch()}
                  >
                    Reconnect
                  </BrutalButton>
                  <BrutalButton size="sm" onClick={reset}>
                    Start a new audit
                  </BrutalButton>
                </div>
              </div>
            ) : null}
          </>
        ) : source === "github" ? (
          <Suspense fallback={<p role="status">Opening repository selection…</p>}>
            <GitHubRepositories
              key={workspaceId}
              workspaceId={workspaceId}
              role={role}
              scan
              defaults={selected}
            />
          </Suspense>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
              <section className="rounded-md border border-border bg-card p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <FileZip size={19} />
                  <h3 className="text-base font-semibold">Project source</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Choose a ZIP containing your source code. Generated files and dependencies are
                  excluded from previews.
                </p>
                <input
                  ref={input}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  aria-label="Choose project ZIP"
                  onChange={(e) => choose(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    choose(e.dataTransfer.files[0]);
                  }}
                  onClick={() => input.current?.click()}
                  className="mt-5 flex min-h-56 w-full flex-col items-center justify-center rounded-md border border-dashed border-border bg-background/50 p-5 transition-colors hover:border-accent hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <UploadSimple size={28} className="text-muted-foreground" />
                  <span className="mt-4 text-sm font-semibold">Drop a project ZIP here</span>
                  <span className="mt-2 text-xs text-accent">or browse files</span>
                  <span className="mt-4 text-[11px] text-muted-foreground">
                    .zip · Up to {Math.floor(capabilities.max_zip_bytes / 1048576)} MB
                  </span>
                </button>
                {file ? (
                  <div className="mt-4 flex min-w-0 items-center gap-3 rounded border border-border p-3">
                    <FileZip size={18} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{file.name}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {(file.size / 1048576).toFixed(2)} MB · Ready to upload
                      </p>
                    </div>
                    <CheckCircle size={18} className="text-success" />
                    <button
                      type="button"
                      aria-label="Remove selected ZIP"
                      onClick={() => {
                        setFile(null);
                        if (input.current) input.current.value = "";
                      }}
                      className="rounded p-2 hover:bg-secondary"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : null}
                <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                  <LockSimple size={15} />
                  Private to your workspace · Read-only source preview
                </div>
              </section>
              <section className="rounded-md border border-border bg-card p-5 sm:p-6">
                <h3 className="text-base font-semibold">Audit settings</h3>
                <label className="mt-5 block text-xs font-medium" htmlFor="workbench-project-name">
                  Project name
                </label>
                <input
                  id="workbench-project-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setIdempotencyKey(crypto.randomUUID());
                  }}
                  maxLength={200}
                  placeholder="Your project"
                  className="mt-2 h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
                />
                <fieldset className="mt-5">
                  <legend className="text-xs font-medium">Compliance frameworks</legend>
                  <div className="mt-3 space-y-2">
                    {frameworks.map((framework) => (
                      <label key={framework.id} className="flex min-h-8 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.includes(framework.id)}
                          onChange={() => {
                            touchedDefaults.current = true;
                            setSelected((previous) =>
                              previous.includes(framework.id)
                                ? previous.filter((v) => v !== framework.id)
                                : [...previous, framework.id],
                            );
                            setIdempotencyKey(crypto.randomUUID());
                          }}
                          className="size-4 accent-[#ff5600]"
                        />
                        {framework.label}
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                    Findings include suggested control mappings for review.
                  </p>
                </fieldset>
                <section className="mt-5 border-t border-border pt-4">
                  <h4 className="text-xs font-medium">After the scan</h4>
                  <p className="mt-3 flex items-center gap-2 text-sm">
                    <FolderOpen size={17} className="text-accent" />
                    Open Audit Workbench
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    Browse files, inspect findings and understand remediation. Source previews
                    remain available for {Math.round(capabilities.retention_hours / 24)} days.
                  </p>
                </section>
              </section>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-card p-4">
              <div>
                <p className="text-xs font-medium">
                  {file ? "1 project selected" : "Choose a project to begin"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Files are validated before analysis.
                </p>
              </div>
              <BrutalButton
                onClick={() => void start()}
                disabled={!canStart || !file || !name.trim() || !selected.length || uploading}
              >
                {uploading ? (
                  <CircleNotch className="animate-spin" size={16} />
                ) : (
                  <UploadSimple size={16} />
                )}
                Start audit
              </BrutalButton>
            </div>
            {!canStart ? (
              <p className="text-xs text-muted-foreground">
                Your viewer role can review completed audits. Ask an analyst to start a scan.
              </p>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
