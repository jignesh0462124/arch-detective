import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Globe,
  Shield,
  Gear,
  Database,
  Package,
  Stack,
  TreeStructure,
  DownloadSimple,
  Code,
  ChatCircle,
  X,
  Copy,
  Check,
  Lightning,
  ShieldWarning,
  Info,
  Lock,
  User,
  ClockCounterClockwise,
  ShareNetwork,
  CaretDown,
  Target,
  Scan,
  ArrowRight,
  BookOpen,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { BrutalBadge } from "@/components/brutal/BrutalBadge";
import { SectionCard } from "@/components/ui/section-card";
import { StatTile } from "@/components/ui/stat-tile";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { getFindingPage, getQueueFinding, findingError } from "@/lib/api/findingQueue";
import { getAttackGraphScanPage } from "@/lib/api/attackGraphScans";
import { authScope, isCurrentScope } from "@/lib/authState";
import { loadScanHistory } from "@/lib/api/auditStorage";
import {
  PRESET_SCENARIOS,
  STRIDE_DEFINITIONS,
  buildAttackGraphFromScan,
  type StrideCategory,
  type ThreatVector,
  type AttackGraphScenario,
  type AttackGraphNode,
} from "@/lib/api/attackGraph";
import { cn } from "@/lib/utils";
import {
  edgePath,
  formatCvss,
  getThreatTarget,
  layoutAttackGraph,
  peakCvss,
  compactSourcePath,
  shouldShowEmptyAttackGraph,
  centeredGraphScroll,
} from "@/lib/attackGraphView";

export const Route = createFileRoute("/_app/attack-graph")({
  head: () => ({
    meta: [
      { title: "Attack Graph · Archon" },
      {
        name: "description",
        content:
          "STRIDE threat modeling with source evidence, illustrative attack paths, and remediation guidance.",
      },
    ],
  }),
  component: AttackGraphPage,
});

// ── Icon helpers ──────────────────────────────────────────────────────────────

function StrideIcon({ category, className }: { category: StrideCategory; className?: string }) {
  const iconProps = { className: cn("h-3.5 w-3.5 shrink-0", className), weight: "bold" as const };
  switch (category) {
    case "spoofing":
      return <User {...iconProps} />;
    case "tampering":
      return <ShieldWarning {...iconProps} />;
    case "repudiation":
      return <ClockCounterClockwise {...iconProps} />;
    case "info_disclosure":
      return <Info {...iconProps} />;
    case "dos":
      return <Lightning {...iconProps} />;
    case "elevation_of_privilege":
      return <Lock {...iconProps} />;
    default:
      return <Shield {...iconProps} />;
  }
}

function NodeIcon({ icon, className }: { icon: AttackGraphNode["icon"]; className?: string }) {
  const props = { size: 18, weight: "duotone" as const, className };
  switch (icon) {
    case "Globe":
      return <Globe {...props} />;
    case "Shield":
      return <Shield {...props} />;
    case "Gear":
      return <Gear {...props} />;
    case "Database":
      return <Database {...props} />;
    case "Package":
      return <Package {...props} />;
    case "Stack":
      return <Stack {...props} />;
    default:
      return <Shield {...props} />;
  }
}

function nodeTypeLabel(type: AttackGraphNode["type"]): string {
  switch (type) {
    case "client":
      return "Untrusted";
    case "gateway":
      return "Gateway";
    case "service":
      return "Service";
    case "database":
      return "Database";
    case "storage":
      return "Storage";
    case "cache":
      return "Cache";
    default:
      return type;
  }
}

interface StoredScanItem {
  id: string;
  targetName?: string;
  findingsCount?: number;
  completedAt?: string;
  result?: unknown;
}
const SAVED_SCAN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Page ──────────────────────────────────────────────────────────────────────

function AttackGraphPage() {
  const navigate = useNavigate();
  const { active } = useActiveWorkspace();
  const { user, isAuthenticated } = useAuth();
  const savedScanPages = useInfiniteQuery({
    queryKey: ["attack-graph-scans", user?.id, active?.id],
    queryFn: ({ pageParam, signal }) => getAttackGraphScanPage(active!.id, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total && last.items.length
        ? last.offset + last.items.length
        : undefined,
    enabled: isAuthenticated && Boolean(active?.id),
    staleTime: 30_000,
  });
  const savedScans = useMemo(
    () => savedScanPages.data?.pages.flatMap((page) => page.items) ?? [],
    [savedScanPages.data],
  );
  const scansFailed = savedScanPages.isError && !savedScanPages.data;
  const olderScansFailed = savedScanPages.isFetchNextPageError;
  const scansPending = savedScanPages.isPending;
  const refreshScans = savedScanPages.refetch;

  const [scenarioSelection, setScenarioSelection] = useState<{
    workspaceId: string;
    key: string;
  } | null>(null);
  const [activeStride, setActiveStride] = useState<StrideCategory | "all">("all");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeThreatId, setActiveThreatId] = useState<string | null>(null);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<"source" | "patch" | null>(null);
  const [copyError, setCopyError] = useState("");
  const [exportingJson, setExportingJson] = useState(false);
  const [exportError, setExportError] = useState("");
  const [explainOpen, setExplainOpen] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [localHistory, setLocalHistory] = useState<{
    workspaceId: string;
    items: StoredScanItem[];
  } | null>(null);
  const [canvasMode, setCanvasMode] = useState<"auto" | "fit" | "actual" | "manual">("auto");
  const [manualScale, setManualScale] = useState(1);
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 480 });
  useEffect(() => {
    if (!canvasElement) return;
    const observer = new ResizeObserver(() =>
      setViewportSize({
        width: canvasElement.clientWidth,
        height: canvasElement.clientHeight,
      }),
    );
    observer.observe(canvasElement);
    return () => observer.disconnect();
  }, [canvasElement]);
  const patchDialog = useRef<HTMLDialogElement>(null);
  const nodeButtons = useRef(new Map<string, HTMLButtonElement>());
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Never show a different workspace's cached scan while the workspace changes.
  useEffect(() => {
    if (!active?.id) return;
    setLocalHistory({ workspaceId: active.id, items: loadScanHistory(active.id) });
    setShowExamples(false);
  }, [active?.id]);

  const auditScans = useMemo(() => {
    // A deleted saved scan must never be resurrected from browser history.
    // Keep only explicit non-database legacy examples when the server query succeeds.
    const local =
      !scansFailed && savedScanPages.data && localHistory?.workspaceId === active?.id
        ? (localHistory?.items ?? []).filter((item) => !SAVED_SCAN_ID.test(item.id))
        : [];
    const items = new Map<string, StoredScanItem>(local.filter((s) => s?.id).map((s) => [s.id, s]));
    for (const s of savedScans) {
      items.set(s.id, {
        ...items.get(s.id),
        id: s.id,
        targetName: s.target_name,
        findingsCount: s.finding_count ?? undefined,
        completedAt: s.completed_at ?? s.created_at,
      });
    }
    return [...items.values()].sort(
      (a, b) => Date.parse(b.completedAt || "") - Date.parse(a.completedAt || ""),
    );
  }, [active?.id, localHistory, savedScans, savedScanPages.data, scansFailed]);

  const requestedKey =
    scenarioSelection?.workspaceId === (active?.id ?? "") ? scenarioSelection.key : null;
  const scenarioKey =
    requestedKey &&
    (PRESET_SCENARIOS[requestedKey] || auditScans.some((s) => s.id === requestedKey))
      ? requestedKey
      : (auditScans[0]?.id ?? "fintech");
  const setScenarioKey = (key: string) =>
    setScenarioSelection({ workspaceId: active?.id ?? "", key });
  const selectedScan = auditScans.find((s) => s.id === scenarioKey);
  const persistedScan = savedScans.find((s) => s.id === selectedScan?.id);
  // Only fetch findings for the selected saved scan, not every scan on each visit.
  const scanFindings = useInfiniteQuery({
    queryKey: ["attack-graph-findings", user?.id, active?.id, persistedScan?.id],
    queryFn: ({ pageParam, signal }) =>
      getFindingPage(
        active!.id,
        persistedScan!.id,
        { severity: "all", state: "all", q: "" },
        pageParam,
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total && last.items.length
        ? last.offset + last.items.length
        : undefined,
    enabled: Boolean(active?.id && persistedScan),
    staleTime: 30_000,
  });
  const loadedFindings = useMemo(
    () => scanFindings.data?.pages.flatMap((page) => page.items) ?? [],
    [scanFindings.data],
  );
  const totalFindings = scanFindings.data?.pages[0]?.total ?? 0;

  // Current scenario object
  const currentScenario: AttackGraphScenario = useMemo(() => {
    if (PRESET_SCENARIOS[scenarioKey]) return PRESET_SCENARIOS[scenarioKey];
    if (selectedScan) {
      const result = persistedScan
        ? {
            scan_id: selectedScan.id,
            target_name: selectedScan.targetName,
            frameworks: persistedScan?.selected_frameworks,
            findings: loadedFindings,
          }
        : (selectedScan.result ?? { target_name: selectedScan.targetName });
      return buildAttackGraphFromScan(result, `scan-${selectedScan.id}`);
    }
    return PRESET_SCENARIOS.fintech;
  }, [scenarioKey, selectedScan, persistedScan, loadedFindings]);

  const isLiveScan = Boolean(selectedScan);
  const findingsLoading = Boolean(persistedScan && scanFindings.isPending);
  const findingsUnavailable = Boolean(
    selectedScan && (persistedScan ? scanFindings.isError : !selectedScan.result),
  );

  // Canvas layout derived from the scenario's real nodes
  const canvas = useMemo(() => layoutAttackGraph(currentScenario.nodes), [currentScenario]);
  const placedNodes = canvas.nodes;
  const fitScale = Math.min(
    1,
    Math.max(1, viewportSize.width - 24) / canvas.width,
    Math.max(1, viewportSize.height - 24) / canvas.height,
  );
  const canvasScale =
    canvasMode === "fit"
      ? fitScale
      : canvasMode === "auto"
        ? fitScale >= 0.75
          ? fitScale
          : 1
        : canvasMode === "manual"
          ? manualScale
          : 1;
  const zoomCanvas = (delta: number) => {
    setManualScale(Math.min(2, Math.max(0.1, canvasScale + delta)));
    setCanvasMode("manual");
  };
  const nodeById = useMemo(() => new Map(placedNodes.map((n) => [n.id, n])), [placedNodes]);

  // Sync selection on scenario change
  useEffect(() => {
    setActiveStride("all");
    setActiveThreatId(null);
    setDiffModalOpen(false);
    setCopiedSnippet(null);
    setCopyError("");
  }, [scenarioKey]); // Background refresh must not reset the user's filter/selection.

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  useEffect(() => {
    const dialog = patchDialog.current;
    if (!dialog || !diffModalOpen) return;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, [diffModalOpen]);

  // STRIDE counts
  const strideCounts = useMemo(() => {
    const counts: Record<StrideCategory, number> = {
      spoofing: 0,
      tampering: 0,
      repudiation: 0,
      info_disclosure: 0,
      dos: 0,
      elevation_of_privilege: 0,
    };
    currentScenario.threats.forEach((t) => {
      if (counts[t.stride] !== undefined) counts[t.stride]++;
    });
    return counts;
  }, [currentScenario]);

  // Threats visible under the active STRIDE filter
  const filteredThreats = useMemo(() => {
    if (activeStride === "all") return currentScenario.threats;
    return currentScenario.threats.filter((t) => t.stride === activeStride);
  }, [currentScenario, activeStride]);

  // Active threat vector (explicit selection, falls back to first visible).
  const selectedThreat = useMemo(() => {
    if (filteredThreats.length === 0) return undefined;
    return filteredThreats.find((t) => t.id === activeThreatId) ?? filteredThreats[0];
  }, [filteredThreats, activeThreatId]);
  const findingDetail = useQuery({
    queryKey: [
      "attack-graph-finding-detail",
      user?.id,
      active?.id,
      persistedScan?.id,
      selectedThreat?.findingId,
    ],
    queryFn: ({ signal }) =>
      getQueueFinding(active!.id, persistedScan!.id, selectedThreat!.findingId!, signal),
    enabled: Boolean(active?.id && persistedScan && selectedThreat?.findingId),
    staleTime: 30_000,
  });
  const activeThreat: ThreatVector | undefined = useMemo(() => {
    if (!selectedThreat) return undefined;
    const detail = findingDetail.data?.finding;
    if (!detail || detail.id !== selectedThreat.findingId) return selectedThreat;
    return {
      ...selectedThreat,
      summary: detail.description || selectedThreat.summary,
      remediationSnippet: {
        vulnerable: detail.code_snippet || "",
        patched: "",
        explanation: detail.remediation || "",
      },
    };
  }, [selectedThreat, findingDetail.data]);

  // Edges on the active kill chain
  const activeThreatEdgeIds = useMemo(() => {
    if (!activeThreat) return new Set<string>();
    return new Set(activeThreat.edgeIds);
  }, [activeThreat]);

  const selectedNode = useMemo(() => {
    return currentScenario.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [currentScenario, selectedNodeId]);

  const compromisedTargetNode = useMemo(() => {
    return getThreatTarget(currentScenario, activeThreat);
  }, [currentScenario, activeThreat]);
  const defaultNodeId = compromisedTargetNode?.id ?? currentScenario.nodes[0]?.id ?? null;

  useEffect(() => {
    setSelectedNodeId(defaultNodeId);
    setCopiedSnippet(null);
    setCopyError("");
    setDiffModalOpen(false);
  }, [scenarioKey, activeThreat?.id, defaultNodeId]);

  const handleFocusTargetAsset = () => {
    if (!compromisedTargetNode) return;
    setSelectedNodeId(compromisedTargetNode.id);
    const button = nodeButtons.current.get(compromisedTargetNode.id);
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: "nearest", inline: "center" });
  };
  const handleCenterSelected = () => {
    const id = selectedNode?.id ?? compromisedTargetNode?.id;
    const button = id ? nodeButtons.current.get(id) : undefined;
    if (!button || !canvasElement) return;
    const bounds = canvasElement.getBoundingClientRect();
    const position = centeredGraphScroll(
      {
        left: bounds.left + canvasElement.clientLeft,
        top: bounds.top + canvasElement.clientTop,
        width: canvasElement.clientWidth,
        height: canvasElement.clientHeight,
        scrollLeft: canvasElement.scrollLeft,
        scrollTop: canvasElement.scrollTop,
        scrollWidth: canvasElement.scrollWidth,
        scrollHeight: canvasElement.scrollHeight,
      },
      button.getBoundingClientRect(),
    );
    button?.focus({ preventScroll: true });
    canvasElement.scrollTo({ ...position, behavior: "instant" });
  };

  const handleExportJson = async () => {
    if (exportingJson) return;
    const scope = authScope();
    setExportingJson(true);
    setExportError("");
    try {
      const allFindings = [...loadedFindings];
      if (persistedScan && !scanFindings.data) {
        throw new Error("Saved findings are still loading. Retry the export shortly.");
      }
      while (persistedScan && allFindings.length < totalFindings) {
        if (!isCurrentScope(scope)) return;
        const page = await getFindingPage(
          active!.id,
          persistedScan.id,
          { severity: "all", state: "all", q: "" },
          allFindings.length,
        );
        if (page.total !== totalFindings || page.items.length === 0) {
          throw new Error("Saved findings changed during export. Refresh the graph and retry.");
        }
        allFindings.push(...page.items);
      }
      const scenario = persistedScan
        ? buildAttackGraphFromScan(
            {
              scan_id: persistedScan.id,
              target_name: persistedScan.target_name,
              frameworks: persistedScan.selected_frameworks,
              findings: allFindings,
            },
            `scan-${persistedScan.id}`,
          )
        : currentScenario;
      if (!isCurrentScope(scope)) return;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(scenario, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `attack-graph-${scenario.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (isCurrentScope(scope))
        setExportError(error instanceof Error ? error.message : "Graph export failed. Retry.");
    } finally {
      setExportingJson(false);
    }
  };

  const handleCopySnippet = async (kind: "source" | "patch" = "patch") => {
    const content =
      kind === "source"
        ? activeThreat?.remediationSnippet?.vulnerable
        : activeThreat?.remediationSnippet?.patched;
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopyError("");
      setCopiedSnippet(kind);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedSnippet(null), 2000);
    } catch {
      setCopyError("Clipboard access failed. Select and copy the code manually.");
    }
  };

  const handleOpenAdvisor = (
    threat?: ThreatVector,
    solution?: "patch" | "root_cause" | "compliance" | "hardening" | "test" | "overview",
  ) => {
    const targetThreat = threat || activeThreat;
    if (
      solution === "patch" &&
      persistedScan?.source_type === "git" &&
      targetThreat?.findingId &&
      targetThreat.scanId
    ) {
      window.location.assign(
        `/fix-verification?scanId=${encodeURIComponent(targetThreat.scanId)}&findingId=${encodeURIComponent(targetThreat.findingId)}`,
      );
      return;
    }
    if (!targetThreat) {
      navigate({ to: "/advisor" });
      return;
    }

    navigate({
      to: "/advisor",
      search: {
        threat: targetThreat.title,
        ...(targetThreat.cweId ? { cwe: targetThreat.cweId } : {}),
        ...(targetThreat.filePath ? { file: targetThreat.filePath } : {}),
        ...(persistedScan && active?.id && targetThreat.findingId && targetThreat.scanId
          ? {
              workspaceId: active.id,
              scanId: targetThreat.scanId,
              findingId: targetThreat.findingId,
            }
          : { example: "1" }),
        ...(solution ? { solution } : {}),
      },
    });
  };

  const maxCvss = peakCvss(currentScenario.threats);

  const STATS = [
    {
      code: "01 // NODES",
      label: isLiveScan ? "Code components" : "System nodes",
      value: String(currentScenario.nodes.length),
      trend: isLiveScan ? "Source evidence only" : "Illustrative architecture",
    },
    {
      code: "02 // VECTORS",
      label: isLiveScan && persistedScan ? "Loaded vectors" : "Attack vectors",
      value: findingsLoading ? "…" : String(currentScenario.threats.length),
      trend: findingsLoading
        ? "Loading saved findings"
        : isLiveScan && persistedScan
          ? `Of ${totalFindings} saved findings`
          : "STRIDE categorized",
    },
    {
      code: "03 // MAX CVSS",
      label: "Peak severity",
      value: findingsLoading ? "…" : formatCvss(maxCvss),
      trend:
        maxCvss === null
          ? "No recorded CVSS score"
          : isLiveScan && loadedFindings.length < totalFindings
            ? "Highest score among loaded findings"
            : "Highest recorded score",
    },
    {
      code: "04 // STRIDE",
      label: "Active vector",
      value: activeThreat ? STRIDE_DEFINITIONS[activeThreat.stride].code : "—",
      trend: activeThreat ? STRIDE_DEFINITIONS[activeThreat.stride].name : "No active vector",
    },
  ];

  const killChainStages = useMemo(() => {
    if (!activeThreat || isLiveScan) return [];
    const source = nodeById.get(activeThreat.sourceNodeId);
    const target = nodeById.get(activeThreat.compromisedNodeId);
    return [
      {
        title: "Initial Ingress",
        note: "Untrusted HTTP client request received",
        detail: null as ReactNode,
      },
      {
        title: "Gateway Forwarding",
        note: "Illustrative request forwarding; validate gateway controls",
        detail: null as ReactNode,
      },
      {
        title: "Service Execution",
        note: activeThreat.filePath
          ? `Potential flaw at ${activeThreat.filePath}${activeThreat.lineNumber != null ? `:${activeThreat.lineNumber}` : ""}`
          : `Potential flaw in ${source?.label ?? "application service"}`,
        detail: null as ReactNode,
      },
      {
        title: "Potential Impact",
        note: target
          ? `Potential data exposure path to ${target.label}; validate manually`
          : "Potential data exposure path; validate manually",
        detail: null as ReactNode,
      },
    ];
  }, [activeThreat, nodeById, isLiveScan]);

  const reasoningSource = activeThreat
    ? (nodeById.get(activeThreat.sourceNodeId)?.label ?? "Application service")
    : "";
  const reasoningTarget = activeThreat
    ? (nodeById.get(activeThreat.compromisedNodeId)?.label ?? "Target asset")
    : "";
  const reasoningFile = activeThreat?.filePath ? activeThreat.filePath.split("/").pop() : null;

  const localHistoryReady = Boolean(active?.id && localHistory?.workspaceId === active.id);
  const waitingForScanSources = Boolean(active?.id && (!localHistoryReady || scansPending));
  const hasNoScanEvidence = shouldShowEmptyAttackGraph({
    workspaceReady: localHistoryReady,
    scansPending,
    scansFailed,
    scanCount: auditScans.length,
  });

  if (waitingForScanSources && auditScans.length === 0) {
    return (
      <AppShell
        title="Attack Graph"
        subtitle={active ? `Workspace · ${active.name}` : "Threat Modeling · STRIDE Kill Chain"}
      >
        <section
          role="status"
          className="flex min-h-[420px] items-center justify-center rounded-lg border border-border bg-card p-8 text-center"
        >
          <div>
            <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="mt-4 text-sm font-medium text-foreground">Checking scan evidence…</p>
          </div>
        </section>
      </AppShell>
    );
  }

  if (hasNoScanEvidence && !showExamples) {
    return (
      <AppShell title="Attack Graph" subtitle={`Workspace · ${active?.name ?? "ThreatLens"}`}>
        <section className="flex min-h-[520px] items-center justify-center rounded-lg border border-border bg-card px-5 py-12 text-center sm:px-10">
          <div className="max-w-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <TreeStructure size={28} weight="duotone" />
            </div>
            <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              No scan evidence
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              No scan evidence available
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Run a codebase audit to build an attack graph from recorded findings and source-file
              associations.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
              <BrutalButton type="button" size="md" onClick={() => navigate({ to: "/workspace" })}>
                <Scan size={17} weight="bold" /> Run Codebase Audit
              </BrutalButton>
              <BrutalButton
                type="button"
                size="md"
                variant="secondary"
                onClick={() => setShowExamples(true)}
              >
                <BookOpen size={17} weight="bold" /> View example architectures
              </BrutalButton>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Examples are educational models and do not represent your project.
            </p>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Attack Graph"
      subtitle={active ? `Workspace · ${active.name}` : "Threat Modeling · STRIDE Kill Chain"}
    >
      <div className="space-y-5 min-w-0 w-full [overflow-wrap:anywhere]">
        {hasNoScanEvidence && showExamples ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs">
            <div className="flex min-w-0 items-center gap-2 text-foreground">
              <Info size={16} weight="fill" className="shrink-0 text-amber-600" />
              <span>Showing educational examples only. No project scan evidence is available.</span>
            </div>
            <button
              type="button"
              className="shrink-0 font-semibold underline underline-offset-4"
              onClick={() => setShowExamples(false)}
            >
              Hide examples
            </button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1 sm:max-w-lg">
            <label
              htmlFor="attack-scenario"
              className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              Architecture source
            </label>
            <div className="relative">
              <select
                id="attack-scenario"
                value={scenarioKey}
                onChange={(e) => setScenarioKey(e.target.value)}
                className="h-10 w-full min-w-0 appearance-none truncate rounded-md border border-border bg-card pl-3 pr-8 text-xs font-medium text-foreground transition-colors hover:bg-secondary cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Select architecture scenario"
              >
                {auditScans.length > 0 && (
                  <optgroup label="Saved scan findings">
                    {auditScans.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.targetName || "Scan"} (
                        {h.id === selectedScan?.id && scanFindings.data
                          ? totalFindings
                          : (h.findingsCount ?? "—")}{" "}
                        findings)
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Example architectures">
                  <option value="fintech">Fintech Banking Core (PCI DSS)</option>
                  <option value="healthcare">Healthcare EHR Portal (HIPAA)</option>
                  <option value="ecommerce">E-Commerce Cloud SaaS (SOC 2)</option>
                </optgroup>
              </select>
              <CaretDown
                size={12}
                weight="bold"
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>
            {savedScanPages.data?.pages[0]?.total ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  {savedScans.length} of {savedScanPages.data.pages[0].total} saved audits loaded
                </span>
                {savedScanPages.hasNextPage && (
                  <button
                    type="button"
                    className="font-semibold text-foreground underline underline-offset-4 disabled:opacity-50"
                    disabled={savedScanPages.isFetchingNextPage}
                    onClick={() => void savedScanPages.fetchNextPage()}
                  >
                    {savedScanPages.isFetchingNextPage
                      ? "Loading older audits…"
                      : olderScansFailed
                        ? "Retry older audits"
                        : "Load older audits"}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          <BrutalButton
            variant="secondary"
            size="sm"
            onClick={() => void handleExportJson()}
            disabled={findingsLoading || findingsUnavailable || exportingJson}
            className="h-10 shrink-0"
          >
            <DownloadSimple size={14} weight="bold" />{" "}
            {exportingJson ? "Preparing…" : "Export JSON"}
          </BrutalButton>
        </div>
        {(scansFailed || olderScansFailed || scanFindings.isError || findingsUnavailable) && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
          >
            <p>
              {findingsUnavailable
                ? `Saved findings could not be loaded. This is not a clean scan. ${scanFindings.isError ? findingError(scanFindings.error) : ""}`
                : olderScansFailed
                  ? "Older saved audits could not be loaded. Already loaded audits remain available."
                  : "Saved scan data is unavailable. Showing locally cached evidence or example architectures."}
            </p>
            <button
              type="button"
              className="font-semibold underline underline-offset-4"
              onClick={() => {
                if (olderScansFailed) void savedScanPages.fetchNextPage();
                else if (persistedScan) void scanFindings.refetch();
                else void refreshScans();
              }}
            >
              Retry
            </button>
          </div>
        )}
        {findingsLoading && (
          <p role="status" className="text-xs text-muted-foreground">
            Loading the first 50 saved finding summaries…
          </p>
        )}
        {copyError && (
          <p role="alert" className="text-xs text-destructive">
            {copyError}
          </p>
        )}
        {exportError && (
          <p role="alert" className="text-xs text-destructive">
            {exportError}
          </p>
        )}
        {/* Top hero: architectural overview */}
        <section className="overflow-hidden rounded-sm hairline bg-card min-w-0 w-full">
          <div className="p-5 sm:p-6 flex flex-col justify-between space-y-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase block mb-1 font-semibold">
                  // TOPOLOGY MODEL · {currentScenario.industry}
                  {isLiveScan ? " · DERIVED FROM FINDINGS" : " · EXAMPLE"}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words overflow-wrap-anywhere">
                  {currentScenario.title}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed break-words overflow-wrap-anywhere">
                  {currentScenario.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 min-w-0 sm:max-w-[40%]">
                {currentScenario.frameworks.map((f) => (
                  <BrutalBadge key={f} tone="outline" className="uppercase font-mono text-[10px]">
                    {f.replace(/_/g, " ")}
                  </BrutalBadge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 border-t hairline sm:grid-cols-4 sm:divide-x sm:divide-border pt-3">
              {STATS.map((s) => (
                <StatTile
                  key={s.code}
                  code={s.code}
                  label={s.label}
                  value={s.value}
                  trend={s.trend}
                  className="min-w-0"
                />
              ))}
            </div>
          </div>
        </section>

        {/* How-to-read explainer */}
        <SectionCard
          padding="md"
          eyebrow="// UNDERSTAND THIS GRAPH"
          title="How to read this attack graph"
          description="Select a STRIDE category, trace a finding, and inspect its source evidence."
          actions={
            <button
              onClick={() => setExplainOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border hairline bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary cursor-pointer shrink-0"
              aria-expanded={explainOpen}
            >
              <BookOpen size={14} weight="duotone" className="text-primary" />
              {explainOpen ? "Hide guide" : "Show guide"}
              <CaretDown
                size={12}
                weight="bold"
                className={cn(
                  "text-muted-foreground transition-transform",
                  explainOpen && "rotate-180",
                )}
              />
            </button>
          }
        >
          {explainOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
              <div className="rounded-sm border hairline bg-secondary/20 p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ArrowRight size={14} weight="bold" className="text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Left to right follows the model
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Saved scans connect the codebase to files recorded in findings. Example
                  architectures show hypothetical request paths. Red connectors highlight the
                  selected vector; they do not confirm a successful exploit or a runtime dependency.
                </p>
              </div>
              <div className="rounded-sm border hairline bg-secondary/20 p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Target size={14} weight="bold" className="text-destructive" />
                  <span className="text-xs font-bold text-foreground">
                    Node colours are asset states
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Neutral cards are modeled components, not proof of safety. Amber marks findings;
                  red identifies the selected target. Select any card with a mouse or keyboard to
                  inspect it.
                </p>
              </div>
              <div className="rounded-sm border hairline bg-secondary/20 p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldWarning size={14} weight="bold" className="text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    STRIDE pills filter the kill chain
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Each threat vector is classified under STRIDE (spoofing, tampering, repudiation,
                  information disclosure, denial of service, elevation of privilege). Pick a pill to
                  isolate vectors of that class; pick a vector below to redraw the breach path.
                </p>
              </div>
              <div className="rounded-sm border hairline bg-secondary/20 p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Code size={14} weight="bold" className="text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Blast radius is listed per vector
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Source files, line numbers, snippets, and remediation are shown only when
                  recorded. Missing scores show N/A. Validate runtime reachability and downstream
                  impact manually. Example patches are illustrative and require review.
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        {/* STRIDE category pills */}
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="STRIDE categories"
        >
          <button
            aria-pressed={activeStride === "all"}
            onClick={() => setActiveStride("all")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border hairline",
              activeStride === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-card text-foreground hover:bg-secondary border-border",
            )}
          >
            <TreeStructure size={14} weight="bold" />
            <span>All Categories: {currentScenario.threats.length}</span>
          </button>

          {(Object.keys(STRIDE_DEFINITIONS) as StrideCategory[]).map((cat) => {
            const info = STRIDE_DEFINITIONS[cat];
            const count = strideCounts[cat] || 0;
            const isCurrent = activeStride === cat;
            return (
              <button
                key={cat}
                aria-pressed={isCurrent}
                title={info.description}
                onClick={() => setActiveStride(cat)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border hairline",
                  isCurrent
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : count > 0
                      ? "bg-card text-foreground hover:bg-secondary border-border"
                      : "bg-card/50 text-muted-foreground hover:bg-secondary/50 border-border/50 opacity-60",
                )}
              >
                <StrideIcon category={cat} />
                <span>
                  {info.name}: {count}
                  {isCurrent && count > 0 ? " (Active)" : ""}
                </span>
              </button>
            );
          })}
        </div>

        {/* 1. Exploit path topology canvas (data-driven) */}
        <section className="w-full min-w-0">
          <SectionCard
            className="w-full min-w-0 flex flex-col"
            padding="none"
            eyebrow="// TOPOLOGY CANVAS"
            title={isLiveScan ? "Finding evidence topology" : "Illustrative attack topology"}
            description={`${currentScenario.nodes.length} nodes · ${currentScenario.edges.length} connectors. ${isLiveScan ? "Source associations, not verified network paths." : "Example only; not a verified deployed architecture or exploit."}`}
            actions={
              <div
                role="group"
                aria-label="Canvas scale"
                className="inline-flex flex-wrap rounded-md border border-border bg-secondary/40 p-1 gap-1"
              >
                <button
                  type="button"
                  aria-label="Zoom out graph"
                  onClick={() => zoomCanvas(-0.1)}
                  className="rounded px-2 text-sm"
                  disabled={canvasScale <= 0.1}
                >
                  −
                </button>
                {(
                  [
                    ["auto", "Auto"],
                    ["fit", "Fit"],
                    ["actual", "100%"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={canvasMode === mode}
                    title={
                      mode === "fit"
                        ? "Fit the entire graph in the viewport"
                        : mode === "actual"
                          ? "Display graph at actual size"
                          : "Fit when labels remain readable; otherwise use actual size"
                    }
                    onClick={() => setCanvasMode(mode)}
                    className={cn(
                      "rounded-sm px-2.5 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary",
                      canvasMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Zoom in graph"
                  onClick={() => zoomCanvas(0.1)}
                  className="rounded px-2 text-sm"
                  disabled={canvasScale >= 2}
                >
                  +
                </button>
                <span className="self-center px-1 text-xs text-muted-foreground" aria-live="polite">
                  {Math.round(canvasScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleCenterSelected}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                  disabled={!selectedNode && !compromisedTargetNode}
                  title="Center the selected node inside the graph canvas"
                >
                  <Target size={14} aria-hidden="true" /> Center selected
                </button>
              </div>
            }
            headerExtra={null}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-[11px] text-muted-foreground border-b border-border">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" /> Modeled component
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Vulnerable Component
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Selected target
              </span>
              <span className="inline-flex items-center gap-1.5 text-primary font-semibold">
                <span className="inline-block h-0.5 w-3.5 bg-destructive rounded-full" /> Selected
                path
              </span>
              <span className="sm:ml-auto">
                Auto keeps labels readable · Fit shows the complete graph · Zoom to inspect
              </span>
            </div>
            <div
              ref={setCanvasElement}
              tabIndex={0}
              role="region"
              aria-label="Attack graph canvas"
              className="relative w-full min-w-0 overflow-auto bg-background focus-visible:outline-2 focus-visible:outline-primary"
              style={{ height: "clamp(320px, 60dvh, 560px)" }}
            >
              <div
                className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
                style={{
                  backgroundImage: "radial-gradient(var(--border) 1.2px, transparent 1.2px)",
                  backgroundSize: "24px 24px",
                }}
              />

              <svg
                viewBox={`0 0 ${canvas.width} ${canvas.height}`}
                className="relative z-10 block h-auto select-none mx-auto"
                style={{
                  width: canvas.width * canvasScale,
                  height: canvas.height * canvasScale,
                  maxWidth: "none",
                  marginTop: Math.max(0, (viewportSize.height - canvas.height * canvasScale) / 2),
                }}
                role="group"
                aria-label={`Attack graph topology for ${currentScenario.title}`}
              >
                <defs>
                  <marker
                    id="arrow-norm"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--muted-foreground)" />
                  </marker>
                  <marker
                    id="arrow-threat"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--destructive)" />
                  </marker>
                </defs>

                {/* Edges resolved from scenario data */}
                {currentScenario.edges.map((edge) => {
                  const source = nodeById.get(edge.source);
                  const target = nodeById.get(edge.target);
                  if (!source || !target) return null;
                  const isThreat = activeThreatEdgeIds.has(edge.id);
                  const d = edgePath(source, target);
                  const midX = (source.px + source.pw + target.px) / 2;
                  const midY = (source.py + source.ph / 2 + target.py + target.ph / 2) / 2;
                  return (
                    <g key={edge.id}>
                      <path
                        d={d}
                        fill="none"
                        stroke={isThreat ? "var(--destructive)" : "var(--muted-foreground)"}
                        strokeWidth={isThreat ? "3.5" : "2"}
                        strokeDasharray={isThreat ? "8 8" : undefined}
                        markerEnd={isThreat ? "url(#arrow-threat)" : "url(#arrow-norm)"}
                      />
                      {isThreat && (
                        <g aria-hidden="true">
                          <title>{edge.label || "Selected path"}</title>
                          <rect
                            x={midX - 44}
                            y={midY - 30}
                            width="88"
                            height="22"
                            rx="4"
                            fill="var(--card)"
                            stroke="var(--destructive)"
                          />
                          <text
                            x={midX}
                            y={midY - 15}
                            textAnchor="middle"
                            fill="var(--destructive)"
                            fontSize="11"
                            fontWeight="600"
                          >
                            {(edge.label || "PATH").slice(0, 12)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Nodes resolved from scenario data */}
                {placedNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isCompromised = node.id === compromisedTargetNode?.id;
                  const isVulnerable = node.status === "vulnerable" || node.hasVulnerability;
                  const detail = node.subtitle ?? node.metadata?.file ?? nodeTypeLabel(node.type);
                  return (
                    <foreignObject
                      key={node.id}
                      x={node.px - 4}
                      y={node.py - 4}
                      width={node.pw + 8}
                      height={node.ph + 8}
                    >
                      <button
                        type="button"
                        ref={(element) => {
                          if (element) nodeButtons.current.set(node.id, element);
                          else nodeButtons.current.delete(node.id);
                        }}
                        aria-label={`Inspect ${node.label}`}
                        aria-pressed={isSelected}
                        title={`${node.label} · ${detail}`}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={cn(
                          "m-1 text-left rounded-md p-4 transition-colors cursor-pointer select-none shadow-xs flex flex-col justify-between border-2 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1",
                          isCompromised
                            ? "border-destructive bg-destructive/10 dark:bg-destructive/15 hover:border-destructive"
                            : isVulnerable
                              ? "border-amber-500/80 bg-amber-500/10 hover:border-amber-500"
                              : "border hairline bg-card hover:border-foreground/30",
                          isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                        )}
                        style={{ width: node.pw, height: node.ph }}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-sm border",
                              isCompromised
                                ? "bg-destructive/20 text-destructive border-destructive/30"
                                : isVulnerable
                                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                  : "bg-secondary text-foreground hairline",
                            )}
                          >
                            {node.metadata?.file ? (
                              <Code size={18} weight="duotone" />
                            ) : (
                              <NodeIcon icon={node.icon} />
                            )}
                          </div>
                          {isCompromised ? (
                            <BrutalBadge
                              tone="critical"
                              dot
                              className="text-[10px] font-bold py-0.5 px-2"
                            >
                              Target
                            </BrutalBadge>
                          ) : isVulnerable ? (
                            <BrutalBadge
                              tone="high"
                              dot
                              className="text-[10px] font-bold py-0.5 px-2"
                            >
                              Vulnerable
                            </BrutalBadge>
                          ) : (
                            <BrutalBadge tone="ghost" className="text-[10px] font-mono py-0.5 px-2">
                              {nodeTypeLabel(node.type)}
                            </BrutalBadge>
                          )}
                        </div>
                        <div>
                          <div
                            className={cn(
                              "text-sm font-semibold line-clamp-2 leading-5 break-words",
                              isCompromised ? "text-destructive" : "text-foreground",
                            )}
                          >
                            {node.label}
                          </div>
                          <div
                            title={detail}
                            className="block w-full text-[11px] leading-4 text-muted-foreground truncate mt-1"
                          >
                            {node.metadata?.file ? compactSourcePath(detail) : detail}
                          </div>
                        </div>
                      </button>
                    </foreignObject>
                  );
                })}
              </svg>
            </div>

            {/* Focus target asset bar (data-driven) */}
            <div
              className={cn(
                "w-full min-w-0 flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 sm:px-6 border-t hairline transition-all",
                selectedNodeId === compromisedTargetNode?.id && compromisedTargetNode
                  ? "bg-destructive/10 border-destructive/30"
                  : "bg-card hover:bg-secondary/30",
              )}
            >
              <div className="flex items-center gap-3.5 w-full md:w-auto md:flex-1 md:min-w-0">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border transition-all",
                    selectedNodeId === compromisedTargetNode?.id && compromisedTargetNode
                      ? "bg-destructive text-destructive-foreground border-destructive"
                      : "bg-destructive/15 text-destructive border-destructive/30",
                  )}
                >
                  <Target size={24} weight="bold" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] tracking-wider font-bold text-destructive uppercase">
                      // FOCUS TARGET ASSET
                    </span>
                    {activeThreat && (
                      <span className="font-mono text-[11px] font-bold bg-destructive/15 text-destructive px-2 py-0.5 rounded-xs border border-destructive/20">
                        CVSS {formatCvss(activeThreat.cvssScore)} ·{" "}
                        {activeThreat.severity.toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {isLiveScan ? "Recorded source location" : "Hypothetical target"}
                    </span>
                  </div>
                  <div className="text-sm sm:text-base font-bold text-foreground mt-0.5 break-words overflow-wrap-anywhere">
                    {compromisedTargetNode?.label ?? "No target in this filter"}
                  </div>
                  {activeThreat && activeThreat.affectedAssets.length > 0 && (
                    <p className="font-mono text-[11px] text-muted-foreground mt-1 break-words overflow-wrap-anywhere">
                      {isLiveScan ? "Source" : "Potential impact"}:{" "}
                      {activeThreat.affectedAssets.join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                <BrutalButton
                  variant={selectedNodeId === compromisedTargetNode?.id ? "primary" : "secondary"}
                  size="md"
                  onClick={handleFocusTargetAsset}
                  disabled={!compromisedTargetNode}
                  className={cn(
                    "w-full md:w-auto font-bold px-5 py-2.5 text-xs shadow-xs transition-all",
                    selectedNodeId === compromisedTargetNode?.id &&
                      compromisedTargetNode &&
                      "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90",
                  )}
                >
                  <Target size={16} weight="bold" />
                  <span>
                    {selectedNodeId === compromisedTargetNode?.id && compromisedTargetNode
                      ? "Target focused"
                      : compromisedTargetNode
                        ? "Focus target"
                        : "No target"}
                  </span>
                </BrutalButton>
              </div>
            </div>
          </SectionCard>
        </section>

        {/* 2. Threat vector picker */}
        <section className="w-full min-w-0">
          <SectionCard
            padding="md"
            eyebrow={
              isLiveScan && persistedScan
                ? `// THREAT VECTORS · ${filteredThreats.length} SHOWN · ${loadedFindings.length}/${totalFindings} LOADED`
                : `// THREAT VECTORS · ${filteredThreats.length} SHOWN`
            }
            title={
              <span className="font-bold text-lg text-foreground">Select a vector to trace</span>
            }
            description="Choose a finding to inspect its source evidence and remediation. Connectors are source associations, not verified exploit paths."
          >
            {isLiveScan && persistedScan && loadedFindings.length < totalFindings && (
              <p className="mb-3 text-xs text-muted-foreground">
                STRIDE filters and category counts apply to loaded findings. Load more to review the
                rest of this scan.
              </p>
            )}
            {filteredThreats.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredThreats.map((threat) => {
                  const isActive = activeThreat?.id === threat.id;
                  return (
                    <button
                      key={threat.id}
                      aria-pressed={isActive}
                      onClick={() => {
                        setActiveThreatId(threat.id);
                        setSelectedNodeId(threat.compromisedNodeId);
                      }}
                      className={cn(
                        "text-left rounded-sm border p-3.5 transition-all cursor-pointer min-w-0 w-full",
                        isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs"
                          : "hairline bg-card hover:bg-secondary/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <StrideIcon
                            category={threat.stride}
                            className="text-muted-foreground mt-0.5"
                          />
                          <span className="text-[13px] font-semibold text-foreground break-words overflow-wrap-anywhere leading-snug">
                            {threat.title}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-destructive shrink-0">
                          {formatCvss(threat.cvssScore)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <SeverityBadge severity={threat.severity} size="sm" />
                        <BrutalBadge
                          tone="primary"
                          className="text-[10px] font-semibold whitespace-nowrap"
                        >
                          {threat.strideCode}
                        </BrutalBadge>
                        {threat.cweId && (
                          <BrutalBadge
                            tone="outline"
                            className="font-mono text-[10px] whitespace-nowrap"
                          >
                            {threat.cweId}
                          </BrutalBadge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">
                {findingsLoading
                  ? "Loading threat vectors…"
                  : totalFindings > loadedFindings.length
                    ? "No vector in this category is loaded yet. Load more findings below."
                    : "No threat vectors in this category."}
              </p>
            )}
            {persistedScan && scanFindings.hasNextPage && (
              <div className="mt-4 flex justify-center">
                <BrutalButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={scanFindings.isFetchingNextPage}
                  onClick={() => void scanFindings.fetchNextPage()}
                >
                  {scanFindings.isFetchingNextPage ? "Loading…" : "Load 50 more vectors"}
                </BrutalButton>
              </div>
            )}
            {scanFindings.isFetchNextPageError && (
              <p role="alert" className="mt-3 text-xs text-destructive">
                More vectors could not be loaded. Retry using Load 50 more vectors.
              </p>
            )}
          </SectionCard>
        </section>

        {/* 3. Threat vector detail & kill chain */}
        <section className="w-full min-w-0">
          <SectionCard
            className="w-full min-w-0"
            padding="lg"
            eyebrow={isLiveScan ? "// SAVED FINDING" : "// EXAMPLE THREAT VECTOR"}
            title={activeThreat ? activeThreat.title : "No threat vectors in this view"}
            description={
              activeThreat
                ? "Recorded evidence and potential impact. Validate exploitability before remediation."
                : "This filter has no vectors. Choose another STRIDE category, or run a codebase audit to generate live vectors."
            }
          >
            {activeThreat ? (
              <div className="space-y-5">
                {/* 1. Unified Threat Classification Metadata Ribbon */}
                <div className="flex flex-wrap items-center gap-2 pb-3.5 border-b border-border/80">
                  <SeverityBadge severity={activeThreat.severity} size="sm" />

                  <span className="inline-flex items-center gap-1 rounded-sm border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-destructive">
                    <span>CVSS</span>
                    <span>{formatCvss(activeThreat.cvssScore)}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                    <ShieldWarning size={13} weight="bold" />
                    <span>{activeThreat.strideCode}</span>
                  </span>

                  {activeThreat.cweId && (
                    <span className="inline-flex items-center rounded-sm border border-border bg-card px-2.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
                      {activeThreat.cweId}
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground sm:ml-auto">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse-dot" />
                    Inferred threat vector
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6 items-start xl:grid-cols-12">
                  {/* Left column: Summary, Origin Code snippet, Blast radius, Actions */}
                  <div className="xl:col-span-7 space-y-4 min-w-0 w-full">
                    {/* Threat Summary Box */}
                    <div className="rounded-sm border border-border bg-secondary/30 p-4 space-y-1.5 border-l-4 border-l-primary shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase font-semibold">
                          // THREAT SUMMARY
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {isLiveScan ? "Scan evidence" : "Example scenario"}
                        </span>
                      </div>
                      <p className="text-xs sm:text-[13px] text-foreground leading-relaxed font-normal break-words overflow-wrap-anywhere">
                        {activeThreat.summary}
                      </p>
                    </div>

                    {persistedScan && findingDetail.isPending && (
                      <p role="status" className="text-xs text-muted-foreground">
                        Loading recorded evidence and remediation…
                      </p>
                    )}
                    {persistedScan && findingDetail.isError && (
                      <div
                        role="alert"
                        className="rounded border border-destructive/30 bg-destructive/5 p-3 text-xs"
                      >
                        Full evidence could not be loaded. The summary above is not a complete
                        finding.{" "}
                        <button
                          type="button"
                          className="font-semibold underline"
                          onClick={() => void findingDetail.refetch()}
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {/* Recorded source evidence */}
                    {activeThreat.filePath && (
                      <div className="space-y-1.5 min-w-0">
                        <div className="overflow-hidden rounded-sm border border-border bg-[#0d1117] text-white shadow-2xs min-w-0">
                          {/* Code Window Header: 1.app/transfer.py Line 42 */}
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-white/10 bg-white/5 text-xs font-mono">
                            <div className="flex items-center gap-2 min-w-0 flex-1 basis-full sm:basis-auto">
                              <span className="font-mono text-accent font-bold text-xs">1.</span>
                              <span
                                className="font-semibold text-white/90 truncate"
                                title={activeThreat.filePath}
                              >
                                {activeThreat.filePath}
                              </span>
                              {activeThreat.lineNumber != null && (
                                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-mono text-white/70 shrink-0">
                                  Line {activeThreat.lineNumber}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="rounded-sm bg-destructive/20 border border-destructive/30 px-2 py-0.5 text-destructive font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">
                                Recorded source
                              </span>
                              {activeThreat.remediationSnippet?.vulnerable && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleCopySnippet("source");
                                  }}
                                  className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                                  title="Copy vulnerable snippet"
                                  aria-label="Copy snippet"
                                >
                                  {copiedSnippet === "source" ? (
                                    <Check size={13} className="text-success" />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Code Body with IDE Line Number Gutter */}
                          {activeThreat.remediationSnippet?.vulnerable ? (
                            <div className="flex text-xs font-mono leading-relaxed bg-[#0a0d12] text-white overflow-x-auto">
                              <div className="select-none py-3 px-3 text-right text-white/70 border-r border-white/10 bg-white/[0.03] shrink-0 font-mono text-xs min-w-[42px]">
                                {activeThreat.lineNumber ?? 1}
                              </div>
                              <div className="p-3 font-mono overflow-x-auto whitespace-pre flex-1 bg-red-950/30 border-l border-red-500/20">
                                <code className="text-red-300 font-mono font-medium">
                                  {activeThreat.remediationSnippet.vulnerable}
                                </code>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3.5 font-mono text-xs leading-relaxed text-white/60">
                              No source snippet was captured for this finding. Review the recorded
                              path and remediation below.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="rounded-sm border border-accent/30 bg-accent/5 p-4 space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          Remediation and verification
                        </h4>
                        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-foreground/85">
                          {activeThreat.remediationSnippet?.explanation ||
                            (persistedScan && findingDetail.isPending
                              ? "Loading the saved remediation…"
                              : "No remediation steps were saved for this finding. Review the evidence before choosing a fix.")}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        After changing code, test the affected path and confirm the finding is
                        resolved in a new audit.
                      </p>
                      <BrutalButton
                        type="button"
                        size="sm"
                        onClick={() => handleOpenAdvisor(activeThreat, "patch")}
                      >
                        <Code size={14} weight="bold" /> Suggest code fix
                      </BrutalButton>
                      <p className="text-[11px] text-muted-foreground">
                        AI suggestions are examples to review and test; no code is applied
                        automatically.
                      </p>
                    </div>

                    {/* Blast Radius Section */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase font-semibold">
                          // {isLiveScan ? "RECORDED SOURCES" : "POTENTIAL IMPACT"} (
                          {activeThreat.affectedAssets.length})
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Runtime impact unverified
                        </span>
                      </div>

                      {activeThreat.affectedAssets.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {activeThreat.affectedAssets.map((asset, i) => (
                            <div
                              key={`${asset}-${i}`}
                              className="flex items-center justify-between gap-3 rounded-sm border border-border bg-card p-3 text-xs transition-colors hover:bg-secondary/40 shadow-2xs min-w-0"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-destructive/10 border border-destructive/20 text-destructive">
                                  <Database size={16} weight="duotone" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span
                                    className="font-mono text-foreground font-semibold block truncate text-xs"
                                    title={asset}
                                  >
                                    {asset}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono block">
                                    {isLiveScan ? "Finding source file" : "Modeled asset"}
                                  </span>
                                </div>
                              </div>
                              <BrutalBadge
                                tone="critical"
                                dot
                                className="text-[10px] shrink-0 whitespace-nowrap"
                              >
                                Review
                              </BrutalBadge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No downstream assets recorded for this vector.
                        </p>
                      )}
                    </div>

                    {/* Evidence and triage actions */}
                    <div className="space-y-3 pt-3 border-t border-border/80">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <BrutalButton
                          variant="secondary"
                          size="md"
                          className="w-full sm:w-auto justify-center text-xs font-semibold py-2.5"
                          onClick={() => setDiffModalOpen(true)}
                        >
                          <Code size={15} weight="bold" /> Inspect evidence
                        </BrutalButton>

                        <BrutalButton
                          variant="ghost"
                          size="md"
                          className="w-full sm:w-auto justify-center text-xs py-2.5"
                          onClick={() => {
                            navigate({ to: "/findings" });
                          }}
                        >
                          <ShareNetwork size={14} weight="bold" /> View in Findings
                        </BrutalButton>
                      </div>
                    </div>
                  </div>

                  {/* Right column: kill chain + reasoning */}
                  <div className="xl:col-span-5 space-y-3 xl:border-l xl:hairline xl:pl-6 min-w-0 w-full">
                    {!isLiveScan && (
                      <section className="rounded-sm border border-border bg-card p-4">
                        <h4 className="text-xs font-semibold">
                          Illustrative sequence · example only
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          A modeled scenario, not recorded execution or a confirmed exploit.
                        </p>
                        <ol className="mt-3 space-y-3">
                          {killChainStages.map((stage, index) => (
                            <li key={stage.title} className="flex gap-3">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs">
                                {index + 1}
                              </span>
                              <div className="min-w-0">
                                <h5 className="text-xs font-semibold">{stage.title}</h5>
                                <p className="mt-1 break-words text-xs text-muted-foreground">
                                  {stage.note}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </section>
                    )}

                    {/* 2. Attack chain reasoning */}
                    <div className="rounded-sm border border-border bg-card p-4 min-w-0 w-full overflow-hidden shadow-2xs">
                      <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShareNetwork size={14} weight="bold" className="text-primary shrink-0" />
                          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-muted-foreground truncate">
                            // ATTACK CHAIN REASONING
                          </span>
                        </div>
                        <span className="rounded-sm bg-destructive/10 border border-destructive/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-destructive whitespace-nowrap shrink-0">
                          {isLiveScan ? "Source mapping" : "Hypothesis"}
                        </span>
                      </div>

                      <div className="pt-3 space-y-2">
                        {/* Step 1: Ingress */}
                        <div className="flex items-center justify-between gap-3 rounded-sm border border-border/70 bg-secondary/30 px-3 py-2 text-xs">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold shrink-0">
                            1. {isLiveScan ? "Context" : "Ingress Edge"}
                          </span>
                          <span className="font-mono text-xs font-medium text-foreground truncate text-right">
                            {isLiveScan ? "Saved scan finding" : "Untrusted HTTP client (modeled)"}
                          </span>
                        </div>

                        {/* Step 2: Executes in */}
                        <div className="flex items-center justify-between gap-3 rounded-sm border border-border/70 bg-secondary/30 px-3 py-2 text-xs">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold shrink-0">
                            2. {isLiveScan ? "Codebase" : "Component"}
                          </span>
                          <span
                            className="font-mono text-xs font-semibold text-foreground truncate text-right"
                            title={reasoningSource}
                          >
                            {reasoningSource}
                          </span>
                        </div>

                        {/* Step 3: Flaw origin */}
                        {reasoningFile && (
                          <div className="flex items-center justify-between gap-3 rounded-sm border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-destructive font-semibold shrink-0">
                              3. Flaw Origin
                            </span>
                            <span
                              className="font-mono text-xs font-semibold text-destructive truncate text-right"
                              title={`${activeThreat.filePath}${activeThreat.lineNumber != null ? `:${activeThreat.lineNumber}` : ""}`}
                            >
                              {reasoningFile}
                              {activeThreat.lineNumber != null ? `:${activeThreat.lineNumber}` : ""}
                            </span>
                          </div>
                        )}

                        {/* Step 4: Reaches target */}
                        <div className="flex items-center justify-between gap-3 rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-destructive font-bold shrink-0">
                            4. Review Target
                          </span>
                          <span
                            className="font-mono text-xs font-bold text-destructive truncate text-right"
                            title={reasoningTarget}
                          >
                            {reasoningTarget}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Selected Node / Component Inspector */}
                    <div className="rounded-sm border border-border bg-card p-4 min-w-0 w-full overflow-hidden shadow-2xs">
                      <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <TreeStructure
                            size={14}
                            weight="bold"
                            className="text-primary shrink-0"
                          />
                          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-muted-foreground truncate">
                            // SELECTED COMPONENT
                          </span>
                        </div>
                        {selectedNode && (
                          <BrutalBadge
                            tone={
                              selectedNode.id === compromisedTargetNode?.id
                                ? "critical"
                                : selectedNode.status === "vulnerable" ||
                                    selectedNode.hasVulnerability
                                  ? "high"
                                  : "ghost"
                            }
                            dot
                            className="text-[10px] whitespace-nowrap shrink-0"
                          >
                            {selectedNode.id === compromisedTargetNode?.id
                              ? "Target"
                              : selectedNode.status === "vulnerable" ||
                                  selectedNode.hasVulnerability
                                ? "Vulnerable"
                                : "Modeled"}
                          </BrutalBadge>
                        )}
                      </div>

                      {selectedNode ? (
                        <div className="pt-3 space-y-3">
                          {/* Node Card Header */}
                          <div className="flex items-center gap-2.5 rounded-sm border border-border bg-secondary/30 p-2.5">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 border border-primary/20 text-primary">
                              <NodeIcon icon={selectedNode.icon} className="text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4
                                className="font-mono text-xs font-bold text-foreground truncate"
                                title={selectedNode.label}
                              >
                                {selectedNode.label}
                              </h4>
                              <p className="text-[10px] font-mono text-muted-foreground truncate">
                                {selectedNode.subtitle || nodeTypeLabel(selectedNode.type)}
                              </p>
                            </div>
                          </div>

                          {/* Property Details Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-sm border border-border/60 bg-secondary/20 p-2">
                              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                Type
                              </span>
                              <span className="block font-mono text-xs font-semibold text-foreground mt-0.5 truncate">
                                {nodeTypeLabel(selectedNode.type)}
                              </span>
                            </div>

                            <div className="rounded-sm border border-border/60 bg-secondary/20 p-2">
                              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                Evidence
                              </span>
                              <span
                                className={cn(
                                  "block font-mono text-xs font-semibold mt-0.5 truncate",
                                  selectedNode.id === compromisedTargetNode?.id
                                    ? "text-destructive"
                                    : "text-foreground",
                                )}
                              >
                                {isLiveScan
                                  ? selectedNode.hasVulnerability
                                    ? "Finding recorded"
                                    : "Scan context"
                                  : "Illustrative"}
                              </span>
                            </div>

                            {selectedNode.metadata?.file && (
                              <div className="col-span-2 rounded-sm border border-border/60 bg-secondary/20 p-2">
                                <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                  Source File
                                </span>
                                <span
                                  className="block font-mono text-xs text-foreground/90 mt-0.5 truncate"
                                  title={selectedNode.metadata.file}
                                >
                                  {selectedNode.metadata.file}
                                </span>
                              </div>
                            )}

                            {selectedNode.metadata?.tables && (
                              <div className="col-span-2 rounded-sm border border-border/60 bg-secondary/20 p-2">
                                <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                  Connected Tables
                                </span>
                                <span
                                  className="block font-mono text-xs text-foreground/90 mt-0.5 truncate"
                                  title={selectedNode.metadata.tables}
                                >
                                  {selectedNode.metadata.tables}
                                </span>
                              </div>
                            )}

                            {(selectedNode.metadata?.engine || selectedNode.metadata?.runtime) && (
                              <div className="col-span-2 rounded-sm border border-border/60 bg-secondary/20 p-2">
                                <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                  Technology Stack
                                </span>
                                <span className="block font-mono text-xs text-foreground/90 mt-0.5 truncate">
                                  {[selectedNode.metadata?.engine, selectedNode.metadata?.runtime]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center space-y-2">
                          <TreeStructure
                            size={24}
                            weight="duotone"
                            className="mx-auto text-muted-foreground/60"
                          />
                          <p className="text-xs font-semibold text-foreground">
                            No component selected
                          </p>
                          <p className="text-[11px] text-muted-foreground max-w-[230px] mx-auto leading-relaxed">
                            Click any node on the topology canvas above to inspect its metadata and
                            security posture.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <Scan size={28} weight="duotone" className="mx-auto text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">
                  {findingsLoading
                    ? "Loading findings…"
                    : findingsUnavailable
                      ? "Findings unavailable"
                      : "No threat vectors in this view"}
                </p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  {findingsLoading
                    ? "Your saved scan evidence is being loaded."
                    : findingsUnavailable
                      ? "Retry loading your saved findings above. No security conclusion can be drawn from this view."
                      : currentScenario.threats.length === 0
                        ? "This codebase produced no mappable findings. Run a new audit to generate live attack vectors."
                        : "Try a different STRIDE category — this one has no vectors in the current scenario."}
                </p>
                {currentScenario.threats.length === 0 &&
                  !findingsLoading &&
                  !findingsUnavailable && (
                    <BrutalButton
                      variant="primary"
                      size="sm"
                      onClick={() => navigate({ to: "/workspace" })}
                    >
                      <Scan size={14} weight="bold" /> Run a codebase audit
                    </BrutalButton>
                  )}
              </div>
            )}
          </SectionCard>
        </section>
      </div>

      {/* Recorded evidence and example remediation modal */}
      {diffModalOpen && activeThreat && (
        <dialog
          ref={patchDialog}
          onCancel={() => setDiffModalOpen(false)}
          aria-labelledby="attack-patch-title"
          className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] border-0 bg-transparent p-0 backdrop:bg-black/65 backdrop:backdrop-blur-xs"
        >
          <div className="w-full rounded-sm border hairline bg-card text-foreground shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] [overflow-wrap:anywhere]">
            <div className="flex items-center justify-between px-5 py-4 border-b hairline bg-secondary/30">
              <div className="min-w-0">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block">
                  // EVIDENCE AND REMEDIATION
                </span>
                <h3
                  id="attack-patch-title"
                  className="text-sm font-semibold text-foreground mt-0.5 break-all"
                >
                  {activeThreat.filePath
                    ? `${activeThreat.filePath}${activeThreat.lineNumber != null ? `:${activeThreat.lineNumber}` : ""}`
                    : "Remediation guidance"}
                </h3>
              </div>
              <button
                onClick={() => setDiffModalOpen(false)}
                className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                aria-label="Close evidence view"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{activeThreat.title}</h4>
                  {activeThreat.cweId && (
                    <BrutalBadge tone="high" className="font-mono text-[10px]">
                      {activeThreat.cweId}
                    </BrutalBadge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {activeThreat.summary}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    // {isLiveScan ? "CAPTURED EVIDENCE" : "ILLUSTRATIVE EXAMPLE"}
                  </span>
                  {activeThreat.remediationSnippet?.patched && (
                    <button
                      onClick={() => {
                        void handleCopySnippet();
                      }}
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-accent font-semibold hover:underline cursor-pointer"
                    >
                      {copiedSnippet === "patch" ? (
                        <Check size={12} weight="bold" />
                      ) : (
                        <Copy size={12} weight="bold" />
                      )}
                      {copiedSnippet === "patch" ? "Copied" : "Copy example fix"}
                    </button>
                  )}
                </div>

                {activeThreat.remediationSnippet?.vulnerable ||
                activeThreat.remediationSnippet?.patched ? (
                  <div className="overflow-hidden rounded-sm border hairline bg-[#0d1117] text-white">
                    <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-white/5 font-mono text-xs">
                      <span className="text-white/80 truncate min-w-0">
                        {activeThreat.filePath || "patch"}
                      </span>
                      <span className="text-white/70 text-[10px] uppercase shrink-0 ml-2">
                        {isLiveScan ? "Source" : "Example"}
                      </span>
                    </div>
                    <div className="p-4 font-mono text-xs leading-relaxed space-y-2">
                      {activeThreat.lineNumber != null && (
                        <div className="text-white/50">
                          # {isLiveScan ? "Recorded" : "Example"} line {activeThreat.lineNumber}
                        </div>
                      )}
                      {activeThreat.remediationSnippet.vulnerable && (
                        <pre className="text-red-300 font-mono bg-red-950/40 border border-red-500/20 px-2.5 py-1 rounded-xs overflow-x-auto whitespace-pre">
                          <code>{activeThreat.remediationSnippet.vulnerable}</code>
                        </pre>
                      )}
                      {activeThreat.remediationSnippet.patched ? (
                        <>
                          <div className="text-white/50 pt-1">
                            # Example fix — review and test before use
                          </div>
                          <pre className="text-emerald-300 font-mono bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-1 rounded-xs overflow-x-auto whitespace-pre">
                            <code>{activeThreat.remediationSnippet.patched}</code>
                          </pre>
                        </>
                      ) : (
                        <p className="text-white/70">
                          No verified code patch was captured. Review the remediation guidance
                          below.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-sm border hairline bg-secondary/20 p-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      No code snippet was captured for this vector. Review the saved remediation
                      guidance, or ask Security Advisor for a proposed change.
                    </p>
                  </div>
                )}
              </div>

              {activeThreat.remediationSnippet?.explanation && (
                <div className="rounded-sm border hairline bg-secondary/30 p-3.5 space-y-1">
                  <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase block font-semibold">
                    // SECURITY RATIONALE
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {activeThreat.remediationSnippet.explanation}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t hairline bg-secondary/30">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase font-semibold hidden sm:inline">
                  Need more help?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDiffModalOpen(false);
                    handleOpenAdvisor(activeThreat, "patch");
                  }}
                  className="inline-flex items-center gap-1 rounded-sm border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-semibold text-foreground hover:bg-accent hover:text-white transition-colors cursor-pointer"
                  title="Ask Security Advisor for a code-fix suggestion"
                >
                  <Code size={12} weight="bold" /> Suggest code fix
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiffModalOpen(false);
                    handleOpenAdvisor(activeThreat, "test");
                  }}
                  className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:border-accent hover:bg-secondary transition-colors cursor-pointer"
                  title="Ask Security Advisor how to verify the fix"
                >
                  <Check size={12} weight="bold" /> How to verify
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <BrutalButton variant="secondary" size="sm" onClick={() => setDiffModalOpen(false)}>
                  Close
                </BrutalButton>
                <BrutalButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setDiffModalOpen(false);
                    handleOpenAdvisor(activeThreat);
                  }}
                >
                  <ChatCircle size={14} weight="bold" /> Open Security Advisor
                </BrutalButton>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </AppShell>
  );
}
