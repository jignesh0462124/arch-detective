import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CaretRight,
  CheckCircle,
  CircleNotch,
  Code,
  DownloadSimple,
  FileCode,
  FolderOpen,
  List,
  LockSimple,
  MagnifyingGlass,
  X,
  WarningCircle,
  ArrowsOut,
  ArrowsIn,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import {
  getSourceWindow,
  getSnapshotFilePage,
  exportWorkbenchReport,
  workbenchError,
  type SnapshotFile,
  type WorkbenchFinding,
  type WorkbenchBootstrap,
  type SourceWindow,
} from "@/lib/api/workbench";
import { cn } from "@/lib/utils";
import { useWorkbenchData } from "./useWorkbenchData";
import { loadSourceEditor } from "./preload";
import { rememberAudit } from "@/lib/auditResume";
import { CodeSolution } from "./CodeSolution";

const SourceEditor = lazy(loadSourceEditor);
const ExtensionReviewPanel = lazy(() =>
  import("@/components/extension-review/ExtensionReviewPanel").then((module) => ({
    default: module.ExtensionReviewPanel,
  })),
);
const rank = { critical: 0, high: 1, medium: 2, low: 3 };
type InspectorTab = "Evidence" | "Compliance" | "Remediation";
type TreeNode = { name: string; path: string; file?: SnapshotFile; children: TreeNode[] };
function makeTree(files: SnapshotFile[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  const indexed = new Map<string, TreeNode>();
  for (const file of files) {
    let parent = root;
    const parts = file.path.split("/");
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let node = indexed.get(path);
      if (!node) {
        node = { name, path, children: [] };
        parent.children.push(node);
        indexed.set(path, node);
      }
      if (i === parts.length - 1) node.file = file;
      parent = node;
    });
  }
  return root.children;
}
function FileTree({
  nodes,
  onOpen,
  selected,
  counts,
}: {
  nodes: TreeNode[];
  onOpen: (file: SnapshotFile) => void;
  selected: string | null;
  counts: Map<string, number>;
}) {
  return (
    <ul role="group" className="min-w-0">
      {nodes.map((node) => (
        <li
          key={node.path}
          role="treeitem"
          aria-selected={node.file ? node.file.id === selected : undefined}
          className="min-w-0"
        >
          {node.file ? (
            <button
              type="button"
              onClick={() => onOpen(node.file!)}
              title={node.path}
              className={cn(
                "flex min-h-9 w-full items-center gap-2 border-l-2 px-2 text-left text-xs hover:bg-secondary",
                selected === node.file.id
                  ? "border-accent bg-secondary text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              <FileCode size={15} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
              {counts.get(node.file.id) ? (
                <span className="rounded bg-destructive/10 px-1.5 text-[10px] text-destructive">
                  {counts.get(node.file.id)}
                </span>
              ) : null}
            </button>
          ) : (
            <TreeFolder node={node} onOpen={onOpen} selected={selected} counts={counts} />
          )}
        </li>
      ))}
    </ul>
  );
}

function TreeFolder({
  node,
  onOpen,
  selected,
  counts,
}: {
  node: TreeNode;
  onOpen: (file: SnapshotFile) => void;
  selected: string | null;
  counts: Map<string, number>;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-9 w-full items-center gap-1 text-left text-xs font-medium"
      >
        <CaretRight size={12} className={expanded ? "rotate-90" : ""} />
        <FolderOpen size={15} />
        <span className="truncate">{node.name}</span>
      </button>
      {expanded ? (
        <div className="ml-3 border-l border-border pl-1">
          <FileTree nodes={node.children} onOpen={onOpen} selected={selected} counts={counts} />
        </div>
      ) : null}
    </div>
  );
}

function FindingInspector({
  workspaceId,
  scanId,
  sourceAvailable,
  finding,
  tab,
  setTab,
  onNext,
  onPrevious,
  index,
  total,
}: {
  workspaceId: string;
  scanId: string;
  sourceAvailable: boolean;
  finding: WorkbenchFinding | undefined;
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  onNext: () => void;
  onPrevious: () => void;
  index: number;
  total: number;
}) {
  if (!finding)
    return (
      <div className="p-5 text-sm text-muted-foreground">
        Select a security finding to inspect its source evidence, suggested controls and
        remediation.
      </div>
    );
  return (
    <>
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <span className="text-xs font-semibold">Finding details</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous finding"
            onClick={onPrevious}
            className="rounded p-1.5 hover:bg-secondary"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            {index + 1} of {total}
          </span>
          <button
            type="button"
            aria-label="Next finding"
            onClick={onNext}
            className="rounded p-1.5 hover:bg-secondary"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
      <div role="tablist" aria-label="Finding details" className="flex border-b border-border">
        {(["Evidence", "Compliance", "Remediation"] as const).map((item) => (
          <button
            type="button"
            key={item}
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={cn(
              "min-h-11 flex-1 border-b-2 px-1 text-[11px]",
              tab === item
                ? "border-accent font-semibold"
                : "border-transparent text-muted-foreground",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tab} className="space-y-5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={finding.severity} />
          {finding.cwe_id ? <span className="font-mono text-[10px]">{finding.cwe_id}</span> : null}
          <span className="ml-auto text-[10px] text-muted-foreground">
            {finding.cvss_score == null ? "Not scored" : `CVSS ${finding.cvss_score.toFixed(1)}`}
          </span>
        </div>
        <h2 className="text-lg font-semibold leading-snug">{finding.title}</h2>
        <p
          hidden={tab === "Remediation"}
          className="break-all font-mono text-[10px] text-muted-foreground"
        >
          {finding.file_path || "Location unavailable"}
          {finding.line_number ? `:${finding.line_number}` : ""}
        </p>
        {finding.location?.match_status !== "verified" ? (
          <p className="text-[11px] leading-5 text-muted-foreground">
            Source location is unverified. Review the recorded evidence before making changes.
          </p>
        ) : null}
        {tab === "Evidence" ? (
          <>
            <section>
              <h3 className="text-xs font-semibold">What was found</h3>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
                {finding.description}
              </p>
            </section>
            <section className="border-t border-border pt-4">
              <h3 className="text-xs font-semibold">Detected by</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                {finding.source === "static-rule"
                  ? "Static rule analysis"
                  : finding.source === "llm-review"
                    ? "AI source review"
                    : finding.source}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                Severity describes potential impact. Review the source and runtime context to
                confirm exploitability.
              </p>
            </section>
            <button
              type="button"
              onClick={() => setTab("Remediation")}
              className="min-h-10 w-full rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              View remediation
            </button>
          </>
        ) : tab === "Compliance" ? (
          <>
            <p className="text-xs leading-5 text-muted-foreground">
              Suggested mappings connect this finding to controls for review.
            </p>
            {finding.violations?.length ? (
              finding.violations.map((control, i) => (
                <section
                  key={`${control.framework}-${control.control_id}-${i}`}
                  className="rounded-md border border-border p-3"
                >
                  <p className="font-mono text-[10px] font-semibold uppercase">
                    {control.framework.replace(/_/g, " ")} · {control.control_id}
                  </p>
                  <h3 className="mt-2 text-xs font-semibold">{control.control_title}</h3>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    {control.evidence || control.description || finding.description}
                  </p>
                  {control.rag_chunk_ids?.length ? (
                    <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
                      Reference IDs: {control.rag_chunk_ids.join(", ")}
                    </p>
                  ) : null}
                  <span className="mt-3 inline-block rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px]">
                    Suggested — review required
                  </span>
                </section>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No control evidence was recorded for this finding.
              </p>
            )}
          </>
        ) : null}
        <div hidden={tab !== "Remediation"}>
          <CodeSolution
            key={finding.id}
            workspaceId={workspaceId}
            scanId={scanId}
            finding={finding}
            available={sourceAvailable}
          />
        </div>
      </div>
    </>
  );
}

export function AuditWorkbench({
  workspaceId,
  scanId,
  initialPolicyId,
}: {
  workspaceId: string;
  scanId: string;
  initialPolicyId?: string;
}) {
  const navigate = useNavigate();
  const policySourceScope = useRef("");
  const { user, isLoading: authLoading } = useAuth();
  const { active, setActive, workspaces, isLoading: workspaceLoading } = useActiveWorkspace();
  const allowed = !!user && active?.id === workspaceId;
  policySourceScope.current = `${active?.id}/${workspaceId}/${scanId}/${user?.id}`;
  useEffect(
    () => () => {
      policySourceScope.current = "";
    },
    [],
  );
  const client = useQueryClient();
  const measuredSource = useRef("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [policyFocus, setPolicyFocus] = useState<{ fileId: string; line: number | null } | null>(
    null,
  );
  const [tabs, setTabs] = useState<string[]>([]);
  const [openedFiles, setOpenedFiles] = useState<SnapshotFile[]>([]);
  const [fileSearch, setFileSearch] = useState("");
  const [onlyFindings, setOnlyFindings] = useState(false);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [page, setPage] = useState(50);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("Evidence");
  const [dock, setDock] = useState("Problems");
  const [mobile, setMobile] = useState("Code");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [start, setStart] = useState(1);
  const [explorerWidth, setExplorerWidth] = useState(220);
  const [expanded, setExpanded] = useState(false);
  const [hideFiles, setHideFiles] = useState(false);
  const [hideDetails, setHideDetails] = useState(false);
  const expandButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const scroll = window.scrollY;
    const trigger = expandButton.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !dialog.current?.open &&
        !document.querySelector(
          ".monaco-editor .suggest-widget.visible, .monaco-editor .find-widget.visible",
        )
      ) {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", escape);
      window.scrollTo(0, scroll);
      trigger?.focus({ preventScroll: true });
    };
  }, [expanded]);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const deferredFileSearch = useDeferredValue(fileSearch.trim().toLowerCase());
  const {
    overview,
    files,
    snapshot,
    progressive,
    detail,
    findingPages,
    initialSource,
    sourceAllowed,
    blocked,
  } = useWorkbenchData(
    workspaceId,
    scanId,
    user?.id,
    allowed,
    deferredFileSearch,
    severity,
    deferredSearch,
    selectedId,
  );
  const findings = useMemo(() => overview.data?.findings || [], [overview.data?.findings]);
  useEffect(() => {
    if (overview.data?.scan)
      rememberAudit(workspaceId, {
        id: scanId,
        name: overview.data.scan.target_name,
        created: overview.data.scan.created_at,
      });
  }, [workspaceId, scanId, overview.data?.scan]);
  const selectedSummary = findings.find((f) => f.id === selectedId) || findings[0];
  const finding = progressive
    ? detail.data && detail.data.finding.id === (selectedId || selectedSummary?.id)
      ? detail.data.finding
      : undefined
    : selectedSummary;
  const selectedFile =
    files.data?.find((f) => f.id === fileId) || openedFiles.find((f) => f.id === fileId);
  const line =
    policyFocus?.fileId === fileId
      ? policyFocus.line
      : finding?.location?.file_id === fileId
        ? finding.location.line_number
        : null;
  const source = useQuery({
    queryKey: [
      "source-window",
      user?.id,
      workspaceId,
      scanId,
      fileId,
      start,
      snapshot?.revision,
      sourceAllowed,
    ],
    queryFn: ({ signal }) => getSourceWindow(scanId, fileId!, start, signal),
    enabled:
      allowed && !overview.isError && sourceAllowed && selectedFile?.preview_state === "ready",
    initialData:
      sourceAllowed && initialSource?.id === fileId && initialSource.start_line === start
        ? initialSource
        : undefined,
    retry: 0,
    gcTime: 600000,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    const entries = client
      .getQueryCache()
      .findAll({ queryKey: ["source-window"] })
      .sort(
        (a, b) =>
          Number(b.isActive()) - Number(a.isActive()) ||
          b.state.dataUpdatedAt - a.state.dataUpdatedAt,
      );
    const scope = `${workspaceId}/${scanId}`;
    if (sourceAllowed && source.data && measuredSource.current !== scope) {
      measuredSource.current = scope;
      const accepted = performance.getEntriesByName("archon.audit.accepted").at(-1) as
        PerformanceMark | undefined;
      if (accepted?.detail?.scanId === scanId)
        performance.measure("archon.workbench.first_source", {
          start: accepted.startTime,
          end: performance.now(),
        });
    }
    let bytes = 0;
    entries.forEach((entry, index) => {
      const content = (entry.state.data as { content?: string } | undefined)?.content || "";
      bytes += new TextEncoder().encode(content).length;
      if (
        blocked ||
        snapshot?.state === "expired" ||
        snapshot?.state === "failed" ||
        source.isError ||
        index >= 8 ||
        bytes > 2 * 1024 * 1024
      )
        client.removeQueries({ queryKey: entry.queryKey, exact: true });
    });
    if (source.data || blocked || snapshot?.state === "expired" || snapshot?.state === "failed") {
      client.setQueryData<WorkbenchBootstrap>(
        ["workbench-bootstrap", user?.id, workspaceId, scanId],
        (previous) => (previous?.initial_source ? { ...previous, initial_source: null } : previous),
      );
    }
  }, [
    client,
    source.data,
    source.isError,
    sourceAllowed,
    blocked,
    snapshot?.state,
    user?.id,
    workspaceId,
    scanId,
  ]);
  useEffect(
    () => () => {
      client.removeQueries({ queryKey: ["source-window"] });
    },
    [client, user?.id, workspaceId, scanId],
  );
  const counts = useMemo(() => {
    const values = new Map<string, number>();
    if (overview.data?.counts) return new Map(Object.entries(overview.data.counts.files));
    for (const f of findings)
      if (f.location?.file_id)
        values.set(f.location.file_id, (values.get(f.location.file_id) || 0) + 1);
    return values;
  }, [findings, overview.data?.counts]);
  const visibleFiles = useMemo(
    () =>
      (files.data || []).filter(
        (f) =>
          f.path.toLowerCase().includes(deferredFileSearch) && (!onlyFindings || counts.has(f.id)),
      ),
    [files.data, deferredFileSearch, onlyFindings, counts],
  );
  const tree = useMemo(() => makeTree(visibleFiles), [visibleFiles]);
  const filtered = progressive
    ? findings
    : findings
        .filter(
          (f) =>
            (severity === "all" || f.severity === severity) &&
            [f.title, f.file_path, f.cwe_id, f.description].some((v) =>
              v?.toLowerCase().includes(deferredSearch),
            ),
        )
        .sort((a, b) => rank[a.severity] - rank[b.severity]);
  const openFile = (file: SnapshotFile, lineNumber: number | null = null) => {
    setPolicyFocus(null);
    setOpenedFiles((previous) => [...previous.filter((f) => f.id !== file.id), file].slice(-8));
    setFileId(file.id);
    const cached = client
      .getQueryCache()
      .findAll({ queryKey: ["source-window", user?.id, workspaceId, scanId, file.id] })
      .map((query) => query.state.data as SourceWindow | undefined)
      .find(
        (window) =>
          window &&
          (!lineNumber || (lineNumber >= window.start_line && lineNumber <= window.end_line)),
      );
    setStart(cached?.start_line || (lineNumber ? Math.max(1, lineNumber - 80) : 1));
    setTabs((previous) => [...previous.filter((id) => id !== file.id), file.id].slice(-8));
    setMobile("Code");
  };
  const selectFinding = (value: WorkbenchFinding) => {
    setPolicyFocus(null);
    setSelectedId(value.id);
    const file = files.data?.find((f) => f.id === value.location?.file_id);
    if (file) openFile(file, value.location?.line_number || null);
  };
  useEffect(() => {
    if (progressive && detail.data?.finding.id === selectedId && detail.data.file) {
      const file = detail.data.file;
      setOpenedFiles((previous) => [...previous.filter((f) => f.id !== file.id), file].slice(-8));
      setFileId(file.id);
      setTabs((previous) => [...previous.filter((id) => id !== file.id), file.id].slice(-8));
      const number = detail.data.finding.location?.line_number;
      const cached = client
        .getQueryCache()
        .findAll({ queryKey: ["source-window", user?.id, workspaceId, scanId, file.id] })
        .map((entry) => entry.state.data as SourceWindow | undefined)
        .find(
          (window) => window && number && number >= window.start_line && number <= window.end_line,
        );
      setStart(cached?.start_line || (number ? Math.max(1, number - 80) : 1));
      setMobile("Code");
    }
  }, [detail.data, progressive, selectedId, client, user?.id, workspaceId, scanId]);
  useEffect(() => {
    setPage(50);
  }, [deferredSearch, severity]);
  useEffect(() => {
    if (!files.data?.length || fileId) return;
    const first = findings.find((f) => f.location?.file_id);
    const file =
      files.data.find((f) => f.id === first?.location?.file_id) ||
      files.data.find((f) => f.preview_state === "ready") ||
      files.data.find((f) => f.preview_state === "pending") ||
      (snapshot?.state === "ready" ? files.data[0] : undefined);
    if (!file) return;
    if (first) setSelectedId(first.id);
    setFileId(file.id);
    setTabs([file.id]);
    setStart(first?.location?.line_number ? Math.max(1, first.location.line_number - 80) : 1);
  }, [files.data, findings, fileId, snapshot?.state]);
  useEffect(() => {
    if (inspectorOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [inspectorOpen]);
  const next = (delta: number) => {
    if (!findings.length) return;
    const index = Math.max(
      0,
      findings.findIndex((f) => f.id === finding?.id),
    );
    selectFinding(findings[(index + delta + findings.length) % findings.length]);
  };
  const exportReport = async () => {
    setExporting(true);
    setError("");
    try {
      await exportWorkbenchReport(scanId, overview.data!.scan.target_name);
    } catch (e) {
      setError(workbenchError(e));
    } finally {
      setExporting(false);
    }
  };
  const inspector =
    progressive && detail.isPending && selectedSummary ? (
      <p role="status" className="p-5 text-xs">
        Loading finding evidence…
      </p>
    ) : progressive && detail.isError ? (
      <p role="alert" className="p-5 text-xs">
        {workbenchError(detail.error)}
      </p>
    ) : (
      <FindingInspector
        workspaceId={workspaceId}
        scanId={scanId}
        sourceAvailable={sourceAllowed}
        finding={finding}
        tab={inspectorTab}
        setTab={setInspectorTab}
        onNext={() => next(1)}
        onPrevious={() => next(-1)}
        index={Math.max(
          0,
          findings.findIndex((f) => f.id === finding?.id),
        )}
        total={findings.length}
      />
    );
  if (authLoading || workspaceLoading)
    return (
      <AppShell title="Audit Workbench">
        <p role="status" className="p-6 text-sm">
          Loading your workspace…
        </p>
      </AppShell>
    );
  if (!allowed)
    return (
      <AppShell title="Audit Workbench">
        <div className="rounded-lg border border-border bg-card p-8">
          <h2 className="text-lg font-semibold">Open the scan's workspace</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Source review is scoped to the selected workspace.
          </p>
          {user && workspaces.some((w) => w.id === workspaceId) ? (
            <BrutalButton className="mt-5" onClick={() => setActive(workspaceId)}>
              Switch workspace
            </BrutalButton>
          ) : (
            <Link to="/workspace" className="mt-5 inline-block text-sm underline">
              Return to Codebase Audit
            </Link>
          )}
        </div>
      </AppShell>
    );
  if (overview.isPending || overview.isError)
    return (
      <AppShell title="Audit Workbench">
        <div className="rounded-lg border border-border bg-card p-8">
          {overview.isError ? (
            <>
              <h2 className="text-lg font-semibold">Audit could not be opened</h2>
              <p role="alert" className="mt-2 text-sm text-muted-foreground">
                {workbenchError(overview.error)}
              </p>
              <BrutalButton className="mt-4" onClick={() => void overview.refetch()}>
                Try again
              </BrutalButton>
              <Link to="/workspace" className="ml-4 text-xs underline">
                Codebase Audit
              </Link>
            </>
          ) : (
            <p role="status" className="flex items-center gap-2 text-sm">
              <CircleNotch className="animate-spin" />
              Loading audit evidence…
            </p>
          )}
        </div>
      </AppShell>
    );
  const data = overview.data;
  if (!data)
    return (
      <AppShell title="Audit Workbench">
        <p role="status" className="p-6 text-sm">
          Loading audit…
        </p>
      </AppShell>
    );
  const complete =
    data.scan.status === "completed" && (!data.job_status || data.job_status === "completed");
  const total = data.counts?.total ?? findings.length;
  return (
    <AppShell
      title="Audit Workbench"
      immersive={expanded}
      layout="workbench"
      subtitle={`${active?.name} / Codebase Audit / ${data.scan.target_name}`}
    >
      <div className={cn("workbench-layout min-w-0 space-y-4", expanded && "workbench-full")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{data.scan.target_name}</h2>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              Scan {scanId.slice(0, 8)} · Read-only snapshot
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {complete && finding && (
              <Link
                className="inline-flex min-h-9 items-center rounded-md border border-border bg-card px-3 text-xs font-medium"
                to={data.scan.source_type === "git" ? "/fix-verification" : "/advisor"}
                search={
                  data.scan.source_type === "git"
                    ? { scanId, findingId: finding.id }
                    : { workspaceId, scanId, findingId: finding.id, solution: "patch" }
                }
              >
                Suggest fix
              </Link>
            )}
            <button
              ref={expandButton}
              type="button"
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary"
              onClick={() => setExpanded((value) => !value)}
              aria-pressed={expanded}
            >
              {expanded ? <ArrowsIn size={15} /> : <ArrowsOut size={15} />}
              {expanded ? "Exit full page" : "Expand workbench"}
            </button>
            {expanded && (
              <>
                <button
                  type="button"
                  aria-pressed={!hideFiles}
                  onClick={() => setHideFiles((value) => !value)}
                  className="hidden rounded border border-border px-3 text-xs lg:block"
                >
                  {hideFiles ? "Show files" : "Hide files"}
                </button>
                <button
                  type="button"
                  aria-pressed={!hideDetails}
                  onClick={() => setHideDetails((value) => !value)}
                  className="hidden rounded border border-border px-3 text-xs xl:block"
                >
                  {hideDetails ? "Show details" : "Hide details"}
                </button>
              </>
            )}
            <BrutalButton
              variant="secondary"
              size="sm"
              onClick={() => navigate({ to: "/workspace" })}
            >
              New audit
            </BrutalButton>
            <BrutalButton
              variant="secondary"
              size="sm"
              disabled={!complete}
              onClick={() => navigate({ to: "/reports/$reportId", params: { reportId: scanId } })}
            >
              View audit report
            </BrutalButton>
            <BrutalButton
              size="sm"
              onClick={() => void exportReport()}
              disabled={exporting || !complete}
            >
              <DownloadSimple size={15} />
              {exporting ? "Exporting…" : "Export report"}
            </BrutalButton>
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {data.scan.source_config?.review_kind === "extension" && (
          <Suspense fallback={<p role="status">Opening extension policy review…</p>}>
            <ExtensionReviewPanel
              key={`${user?.id}/${workspaceId}/${scanId}`}
              workspaceId={workspaceId}
              scanId={scanId}
              initialPolicyId={initialPolicyId}
              role={active?.role || "viewer"}
              status={data.scan.status}
              sourceAvailable={sourceAllowed}
              onOpenSource={async (path, number) => {
                const requestedScope = policySourceScope.current;
                const file = files.data?.find((item) => item.path === path);
                if (file) {
                  openFile(file, number);
                  setPolicyFocus({ fileId: file.id, line: number });
                } else {
                  const scope = policySourceScope.current;
                  try {
                    const page = await getSnapshotFilePage(scanId, path, 0);
                    const matched = page.items.find((item) => item.path === path);
                    if (scope !== policySourceScope.current) return;
                    if (matched) {
                      openFile(matched, number);
                      setPolicyFocus({ fileId: matched.id, line: number });
                    } else setError("The recorded file is unavailable in this source snapshot.");
                  } catch (failure) {
                    if (scope === policySourceScope.current) setError(workbenchError(failure));
                  }
                }
                requestAnimationFrame(() => {
                  if (requestedScope !== policySourceScope.current) return;
                  document.querySelector('[data-testid="source-panel"]')?.scrollIntoView({
                    block: "center",
                    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                      ? "auto"
                      : "smooth",
                  });
                });
              }}
            />
          </Suspense>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-md border border-border bg-card px-4 py-3 text-xs">
          <span className="flex items-center gap-2">
            {complete ? (
              <CheckCircle size={16} weight="fill" className="text-success" />
            ) : (
              <WarningCircle size={16} className="text-muted-foreground" />
            )}
            {complete
              ? "Scan complete"
              : data.scan.status === "running" || data.scan.status === "completed"
                ? "Analysis in progress"
                : "Scan interrupted — incomplete"}
          </span>
          <span>{snapshot?.file_count || 0} files</span>
          <span>
            {total} security findings{!complete ? " · provisional" : ""}
          </span>
          {(["critical", "high", "medium", "low"] as const).map((sev) => (
            <span key={sev} className="flex items-center gap-1.5">
              <SeverityBadge severity={sev} />
              {data.counts?.severity[sev] ?? findings.filter((f) => f.severity === sev).length}
            </span>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground">
            {snapshot?.state === "ready"
              ? `Preview expires ${new Date(snapshot.expires_at).toLocaleDateString()}`
              : snapshot?.state === "indexing"
                ? "Preparing source previews"
                : "Source preview unavailable"}
          </span>
        </div>
        {!complete && data.scan.status !== "failed" ? (
          <section
            aria-label="Audit progress"
            className="grid gap-4 rounded-md border border-border bg-card p-4 sm:grid-cols-2"
          >
            <div>
              <p className="mb-2 flex justify-between text-xs">
                <span>Source preparation</span>
                <span>
                  {data.counts?.previews.ready || 0} ready · {data.counts?.previews.pending || 0}{" "}
                  preparing
                </span>
              </p>
              <progress
                aria-label="Source preparation"
                className="h-1.5 w-full accent-accent"
                max={Math.max(
                  1,
                  (data.counts?.previews.ready || 0) + (data.counts?.previews.pending || 0),
                )}
                value={data.counts?.previews.ready || 0}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Ready files are readable now. Other previews will appear automatically.
              </p>
            </div>
            <div>
              <p className="mb-2 flex justify-between text-xs">
                <span>Analysis in progress</span>
                <span>{data.events.at(-1)?.progress || 0}%</span>
              </p>
              <progress
                aria-label="Security analysis"
                className="h-1.5 w-full accent-accent"
                max={100}
                value={data.events.at(-1)?.progress || 0}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Results are provisional until all findings and evidence are saved. Export is locked.
              </p>
            </div>
          </section>
        ) : null}
        {snapshot?.state !== "ready" ? (
          <div className="rounded-md border border-border bg-card p-4 text-sm">
            <p className="font-medium">
              {snapshot?.state === "expired"
                ? "Source preview expired"
                : snapshot?.state === "indexing"
                  ? "Source preview is being indexed"
                  : "Source unavailable for this audit"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {snapshot?.state === "expired"
                ? "Your findings and report remain available."
                : snapshot?.state === "indexing"
                  ? "Browse ready files while the remaining previews and security analysis continue."
                  : "Run a new audit to create a source snapshot. You can still review available finding evidence below."}
            </p>
          </div>
        ) : null}
        <div
          className="flex gap-1 rounded-md border border-border bg-card p-1 lg:hidden"
          role="tablist"
          aria-label="Workbench views"
        >
          {["Files", "Code", "Findings"].map((view) => (
            <button
              type="button"
              key={view}
              role="tab"
              aria-selected={mobile === view}
              onClick={() => setMobile(view)}
              className={cn(
                "min-h-11 flex-1 rounded text-xs font-medium",
                mobile === view ? "bg-secondary" : "text-muted-foreground",
              )}
            >
              {view}
            </button>
          ))}
        </div>
        <div
          className="audit-workbench-grid grid min-w-0 overflow-hidden rounded-md border border-border bg-card"
          data-hide-files={expanded && hideFiles}
          data-hide-details={expanded && hideDetails}
          style={{ "--explorer-width": `${explorerWidth}px` } as React.CSSProperties}
        >
          <aside
            className={cn(
              "relative min-w-0 border-r border-border lg:row-span-2",
              mobile === "Files" ? "block" : "hidden lg:block",
            )}
            aria-label="Source files"
          >
            <div className="flex h-11 items-center justify-between border-b border-border px-3">
              <h3 className="text-xs font-semibold">Files</h3>
              <span className="text-[10px] text-muted-foreground">{files.data?.length || 0}</span>
            </div>
            <div className="space-y-2 border-b border-border p-2">
              <div className="flex items-center gap-2 rounded border border-border px-2">
                <MagnifyingGlass size={13} />
                <input
                  aria-label="Search filenames"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Find a file…"
                  className="h-8 min-w-0 w-full bg-transparent text-xs outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={onlyFindings}
                  onChange={(e) => setOnlyFindings(e.target.checked)}
                />
                With findings only
              </label>
            </div>
            <div
              className="max-h-[600px] overflow-auto p-2"
              role="tree"
              aria-label="Scanned source tree"
            >
              {files.isPending && sourceAllowed ? (
                <p role="status" className="p-2 text-xs">
                  Loading files…
                </p>
              ) : files.isError ? (
                <p role="alert" className="p-2 text-xs text-destructive">
                  {workbenchError(files.error)}
                </p>
              ) : tree.length ? (
                <FileTree
                  nodes={tree}
                  onOpen={(file) => openFile(file)}
                  selected={fileId}
                  counts={counts}
                />
              ) : (
                <p className="p-2 text-xs leading-5 text-muted-foreground">
                  {snapshot?.state === "ready"
                    ? "No files match this filter."
                    : "No retained source tree."}
                </p>
              )}
            </div>
            <div
              role="separator"
              aria-label="Resize file explorer using left and right arrows"
              aria-orientation="vertical"
              aria-valuenow={explorerWidth}
              aria-valuemin={180}
              aria-valuemax={320}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  setExplorerWidth((w) =>
                    Math.min(320, Math.max(180, w + (e.key === "ArrowRight" ? 20 : -20))),
                  );
                }
              }}
              className="absolute inset-y-0 right-0 hidden w-1 cursor-col-resize focus:bg-accent focus:outline-none lg:block"
            />
          </aside>
          <section
            className={cn(
              "min-h-0 min-w-0 flex-col",
              mobile === "Code" ? "flex" : "hidden lg:flex",
            )}
            aria-label="Source viewer"
            data-testid="source-panel"
          >
            <div
              role="tablist"
              aria-label="Open source files"
              className="flex h-11 overflow-x-auto border-b border-border bg-background/50"
            >
              {tabs.map((id) => {
                const file =
                  files.data?.find((f) => f.id === id) || openedFiles.find((f) => f.id === id);
                return file ? (
                  <div
                    key={id}
                    className={cn(
                      "flex shrink-0 items-center border-r border-b-2 border-r-border pr-1",
                      fileId === id ? "border-b-accent bg-card" : "border-b-transparent",
                    )}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={fileId === id}
                      onClick={() => openFile(file)}
                      className="flex h-full items-center gap-2 px-3 text-xs"
                    >
                      <FileCode size={14} />
                      {file.path.split("/").at(-1)}
                    </button>
                    <button
                      type="button"
                      aria-label={`Close ${file.path}`}
                      onClick={() => {
                        setTabs((ids) => ids.filter((v) => v !== id));
                        if (fileId === id) {
                          setFileId(tabs.find((v) => v !== id) || null);
                          setStart(1);
                        }
                      }}
                      className="rounded p-1 hover:bg-secondary"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : null;
              })}
              {!tabs.length ? (
                <span className="px-3 py-3 text-xs text-muted-foreground">Source preview</span>
              ) : null}
            </div>
            <div className="flex min-h-10 min-w-0 items-center justify-between gap-2 border-b border-border px-3">
              <span
                className="truncate font-mono text-[10px] text-muted-foreground"
                title={selectedFile?.path}
              >
                {selectedFile?.path || "Choose a source file"}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                <LockSimple size={12} />
                Read only
              </span>
              <button
                type="button"
                onClick={() => setInspectorOpen(true)}
                className="shrink-0 rounded border border-border p-1.5 xl:hidden"
                aria-label="Open finding details"
              >
                <List size={14} />
              </button>
            </div>
            <div className="workbench-code-height min-h-0 min-w-0 flex-1">
              {!sourceAllowed ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                  <Code size={28} />
                  <p>Source preview {snapshot?.state === "expired" ? "expired" : "unavailable"}</p>
                  {finding?.code_snippet ? (
                    <pre className="max-h-48 w-full overflow-auto rounded border border-border bg-background p-3 text-left font-mono text-xs">
                      {finding.code_snippet}
                    </pre>
                  ) : null}
                </div>
              ) : source.isError ? (
                <div role="alert" className="p-5 text-sm text-muted-foreground">
                  {workbenchError(source.error)}
                </div>
              ) : (
                <Suspense
                  fallback={
                    source.data ? (
                      <pre
                        className="h-full overflow-auto p-4 font-mono text-xs leading-[22px]"
                        aria-label="Read-only source loading"
                      >
                        {source.data.content}
                      </pre>
                    ) : (
                      <p role="status" className="p-5 text-xs">
                        Preparing source viewer…
                      </p>
                    )
                  }
                >
                  <SourceEditor
                    source={selectedFile?.preview_state === "ready" ? source.data || null : null}
                    path={selectedFile?.path || ""}
                    line={line}
                    focusKey={
                      policyFocus ? `policy:${policyFocus.fileId}:${policyFocus.line}` : finding?.id
                    }
                    fileKey={`${workspaceId}/${scanId}/${snapshot?.id}/${snapshot?.revision}/${fileId}`}
                    message={
                      selectedFile?.preview_state === "pending"
                        ? "Preparing preview — this file will become readable automatically."
                        : selectedFile && selectedFile.preview_state !== "ready"
                          ? selectedFile.reason || "No text preview for this file."
                          : fileId
                            ? "Loading source…"
                            : "Select a file to browse its source."
                    }
                  />
                </Suspense>
              )}
            </div>
            <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-t border-border px-3 text-[10px] text-muted-foreground">
              <span>
                {source.data
                  ? `Lines ${source.data.start_line}–${source.data.end_line} of ${source.data.total_lines}${source.data.redacted ? " · Secrets masked" : ""}`
                  : "UTF-8 · Read-only source"}
              </span>
              {source.data ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={source.data.start_line <= 1}
                    onClick={() => setStart(Math.max(1, start - 1000))}
                    className="disabled:opacity-30"
                  >
                    Previous lines
                  </button>
                  <button
                    type="button"
                    disabled={source.data.end_line >= source.data.total_lines}
                    onClick={() => setStart(source.data!.end_line + 1)}
                    className="disabled:opacity-30"
                  >
                    Next lines
                  </button>
                </div>
              ) : null}
            </div>
          </section>
          <aside
            className="hidden min-w-0 overflow-y-auto border-l border-border xl:row-span-2 xl:block"
            aria-label="Finding inspector"
          >
            {inspector}
          </aside>
          <section
            className={cn(
              "min-h-0 min-w-0 flex-col overflow-hidden border-t border-border",
              mobile === "Findings" ? "flex" : "hidden lg:flex",
            )}
            aria-label="Audit problems and activity"
          >
            <div
              role="tablist"
              aria-label="Audit dock"
              className="flex shrink-0 border-b border-border"
            >
              {["Problems", "Scan activity", "Summary"].map((value) => (
                <button
                  type="button"
                  key={value}
                  role="tab"
                  aria-selected={dock === value}
                  onClick={() => setDock(value)}
                  className={cn(
                    "min-h-10 border-b-2 px-3 text-xs",
                    dock === value
                      ? "border-accent font-semibold"
                      : "border-transparent text-muted-foreground",
                  )}
                >
                  {value}
                  {value === "Problems" ? ` ${total}` : ""}
                </button>
              ))}
            </div>
            {dock === "Problems" ? (
              <>
                <div className="flex shrink-0 flex-wrap gap-2 border-b border-border p-2">
                  <input
                    aria-label="Search security findings"
                    placeholder="Search findings or CWE…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 min-w-0 flex-1 rounded border border-border bg-transparent px-2 text-xs"
                  />
                  <select
                    aria-label="Filter findings severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="h-8 rounded border border-border bg-card px-2 text-xs"
                  >
                    {["all", "critical", "high", "medium", "low"].map((value) => (
                      <option key={value} value={value}>
                        {value === "all" ? "All severities" : value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Severity</th>
                        <th className="px-3 py-2 font-medium">Finding</th>
                        <th className="px-3 py-2 font-medium">File</th>
                        <th className="px-3 py-2 font-medium">Line</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, page).map((f) => (
                        <tr
                          key={f.id}
                          className={cn(
                            "border-b border-border/60",
                            f.id === finding?.id && "bg-secondary/70",
                          )}
                        >
                          <td className="px-3 py-2">
                            <SeverityBadge severity={f.severity} />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                selectFinding(f);
                                if (window.innerWidth < 1280) setInspectorOpen(true);
                              }}
                              className="min-h-8 text-left font-medium hover:underline"
                            >
                              {f.title}
                            </button>
                          </td>
                          <td
                            className="max-w-40 truncate px-3 py-2 font-mono text-[10px]"
                            title={f.file_path || undefined}
                          >
                            {f.file_path?.split("/").at(-1) || "Unavailable"}
                          </td>
                          <td className="px-3 py-2 font-mono">{f.line_number || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filtered.length ? (
                    <p className="p-5 text-xs leading-5 text-muted-foreground">
                      {!complete
                        ? "Analysis in progress — findings will appear after they are saved. This is not a clean result."
                        : total
                          ? "No findings match your filters."
                          : "No security findings recorded within this scan's analysis coverage."}
                    </p>
                  ) : null}
                  {(progressive ? findingPages.hasNextPage : filtered.length > page) ? (
                    <button
                      type="button"
                      disabled={findingPages.isFetchingNextPage}
                      onClick={() => {
                        setPage((p) => p + 50);
                        if (progressive) void findingPages.fetchNextPage();
                      }}
                      className="min-h-10 w-full text-xs"
                    >
                      {findingPages.isFetchingNextPage ? "Loading…" : "Show 50 more findings"}
                    </button>
                  ) : null}
                </div>
              </>
            ) : dock === "Scan activity" ? (
              <ol className="min-h-0 flex-1 space-y-2 overflow-auto p-4 font-mono text-[10px] text-muted-foreground">
                {data.events.length ? (
                  data.events.map((event) => <li key={event.sequence}>{event.label}</li>)
                ) : (
                  <li>No scan activity was retained for this audit.</li>
                )}
              </ol>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto p-4 text-xs leading-6 text-muted-foreground">
                <p>
                  {data.metadata.summary?.summary ||
                    "Review the recorded findings, file locations and available control evidence."}
                </p>
                {data.metadata.analysis?.limitations?.map((note) => (
                  <p key={note} className="mt-2">
                    {note}
                  </p>
                ))}
              </div>
            )}
          </section>
        </div>
        {!expanded && (
          <div className="workbench-status-bar flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <LockSimple size={12} /> Read only ·{" "}
              {snapshot?.state === "ready" ? "Snapshot retained" : "Findings retained"}
            </span>
            <span>
              {selectedFile?.language || "Source review"} {line ? `· Line ${line}` : ""}
            </span>
          </div>
        )}
        <dialog
          ref={dialog}
          onClose={() => setInspectorOpen(false)}
          className="fixed inset-0 m-auto max-h-[90dvh] w-[min(94vw,420px)] overflow-auto rounded-lg border border-border bg-card text-foreground backdrop:bg-black/40"
        >
          <button
            type="button"
            aria-label="Close finding details"
            onClick={() => setInspectorOpen(false)}
            className="float-right m-2 rounded border border-border p-2"
          >
            <X size={16} />
          </button>
          <div className="clear-both">{inspector}</div>
        </dialog>
      </div>
    </AppShell>
  );
}
