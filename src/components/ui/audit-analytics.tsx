import { useMemo, useState } from "react";
import { ChartPieSlice, ShieldCheck, Code, Flame, CheckCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { recordedCvssAverage } from "@/lib/auditView";
import type { LocalScanResult, LocalFinding } from "@/lib/api/localScan";

export interface AuditAnalyticsProps {
  result: LocalScanResult;
  healthScore: number;
  onFilterSeverity?: (severity: string) => void;
  onFilterFramework?: (framework: string) => void;
  className?: string;
}

type AnalyticsTab = "overview" | "taxonomy" | "compliance" | "hotspots";

interface TaxonomyGroup {
  name: string;
  cwe: string;
  count: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  topSeverity: "critical" | "high" | "medium" | "low";
  percentage: number;
}

interface FileHotspot {
  filePath: string;
  fileName: string;
  riskScore: number;
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  percentageOfTotalRisk: number;
}

const SEVERITY_COLORS = {
  critical: {
    stroke: "#c41c1c",
    fill: "bg-destructive/15 text-destructive border-destructive/30",
    text: "text-destructive",
  },
  high: {
    stroke: "#e65100",
    fill: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    text: "text-amber-500",
  },
  medium: {
    stroke: "#eab308",
    fill: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  low: {
    stroke: "#3b82f6",
    fill: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    text: "text-blue-500",
  },
} as const;

export function AuditAnalytics({
  result,
  healthScore,
  onFilterSeverity,
  onFilterFramework,
  className,
}: AuditAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const { critical = 0, high = 0, medium = 0, low = 0 } = result.severity_counts || {};
  const totalFindings = result.findings?.length || 0;

  // ── 1. Donut Chart Calculations ─────────────────────────────────────────────
  const donutData = useMemo(() => {
    if (totalFindings === 0) return [];
    const r = 50;
    const circumference = 2 * Math.PI * r;
    let accumulatedOffset = 0;

    const segments = [
      { key: "critical", label: "Critical Risk", count: critical, color: "#c41c1c" },
      { key: "high", label: "High Severity", count: high, color: "#e65100" },
      { key: "medium", label: "Medium Concern", count: medium, color: "#eab308" },
      { key: "low", label: "Low Severity", count: low, color: "#3b82f6" },
    ];

    return segments
      .filter((s) => s.count > 0)
      .map((s) => {
        const pct = s.count / totalFindings;
        const strokeLength = pct * circumference;
        const offset = -accumulatedOffset;
        accumulatedOffset += strokeLength;

        return {
          ...s,
          pct: Math.round(pct * 100),
          strokeDasharray: `${strokeLength} ${circumference - strokeLength}`,
          strokeDashoffset: offset,
          circumference,
        };
      });
  }, [critical, high, medium, low, totalFindings]);

  // ── 2. Taxonomy / CWE Attack Surface Grouping ────────────────────────────────
  const taxonomyGroups = useMemo<TaxonomyGroup[]>(() => {
    if (!result.findings || result.findings.length === 0) return [];

    const map = new Map<string, { cwe: string; findings: LocalFinding[] }>();

    result.findings.forEach((f) => {
      let cat = "Software Vulnerability";
      const titleLower = f.title.toLowerCase();
      const cwe = f.cwe_id || "CWE-General";

      if (titleLower.includes("sql") || cwe === "CWE-89") cat = "SQL Injection";
      else if (titleLower.includes("xss") || titleLower.includes("script") || cwe === "CWE-79")
        cat = "Cross-Site Scripting (XSS)";
      else if (titleLower.includes("command") || cwe === "CWE-78") cat = "Command Injection";
      else if (
        titleLower.includes("secret") ||
        titleLower.includes("key") ||
        titleLower.includes("password") ||
        cwe === "CWE-798"
      )
        cat = "Hardcoded Secrets & Keys";
      else if (titleLower.includes("ssrf") || cwe === "CWE-918")
        cat = "Server-Side Request Forgery";
      else if (
        titleLower.includes("auth") ||
        titleLower.includes("token") ||
        titleLower.includes("jwt") ||
        cwe === "CWE-284"
      )
        cat = "Broken Access Control & Auth";
      else if (titleLower.includes("crypto") || titleLower.includes("cipher") || cwe === "CWE-327")
        cat = "Cryptographic Weakness";
      else if (titleLower.includes("deserialize") || cwe === "CWE-502")
        cat = "Insecure Deserialization";
      else if (titleLower.includes("path") || titleLower.includes("traversal") || cwe === "CWE-22")
        cat = "Path Traversal";
      else if (f.cwe_id) cat = `${f.cwe_id} Violation`;
      else cat = f.title.split(":")[0] || "Application Flaw";

      const key = `${cat}__${cwe}`;
      if (!map.has(key)) {
        map.set(key, { cwe, findings: [] });
      }
      map.get(key)!.findings.push(f);
    });

    const groups: TaxonomyGroup[] = [];
    map.forEach((value, key) => {
      const [name] = key.split("__");
      const list = value.findings;
      const crit = list.filter((x) => x.severity === "critical").length;
      const h = list.filter((x) => x.severity === "high").length;
      const m = list.filter((x) => x.severity === "medium").length;
      const l = list.filter((x) => x.severity === "low").length;

      let topSev: "critical" | "high" | "medium" | "low" = "low";
      if (crit > 0) topSev = "critical";
      else if (h > 0) topSev = "high";
      else if (m > 0) topSev = "medium";

      groups.push({
        name,
        cwe: value.cwe,
        count: list.length,
        criticalCount: crit,
        highCount: h,
        mediumCount: m,
        lowCount: l,
        topSeverity: topSev,
        percentage: Math.round((list.length / totalFindings) * 100),
      });
    });

    return groups.sort((a, b) => b.count - a.count);
  }, [result.findings, totalFindings]);

  // ── 3. File Blast Radius & Risk Concentration Hotspots ───────────────────────
  const fileHotspots = useMemo<FileHotspot[]>(() => {
    if (!result.findings || result.findings.length === 0) return [];

    const map = new Map<string, LocalFinding[]>();
    result.findings.forEach((f) => {
      const path = f.file_path || "root/unclassified_source";
      if (!map.has(path)) map.set(path, []);
      map.get(path)!.push(f);
    });

    let maxRisk = 1;
    const list: FileHotspot[] = [];

    map.forEach((findings, filePath) => {
      const crit = findings.filter((x) => x.severity === "critical").length;
      const h = findings.filter((x) => x.severity === "high").length;
      const m = findings.filter((x) => x.severity === "medium").length;
      const l = findings.filter((x) => x.severity === "low").length;

      // Weighted risk score
      const riskScore = crit * 10 + h * 5 + m * 2 + l * 1;
      if (riskScore > maxRisk) maxRisk = riskScore;

      const segments = filePath.split(/[/\\]/);
      const fileName = segments[segments.length - 1] || filePath;

      list.push({
        filePath,
        fileName,
        riskScore,
        totalFindings: findings.length,
        critical: crit,
        high: h,
        medium: m,
        low: l,
        percentageOfTotalRisk: 0,
      });
    });

    // Compute relative percentage to the highest risk file
    return list
      .map((item) => ({
        ...item,
        percentageOfTotalRisk: Math.round((item.riskScore / maxRisk) * 100),
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 6);
  }, [result.findings]);

  // ── 4. Compliance Framework Benchmark Matrix ────────────────────────────────
  const complianceData = useMemo(() => {
    const rawScores = result.framework_scores || {};
    const keys = Object.keys(rawScores);
    if (keys.length === 0) return [];

    return keys.map((key) => {
      const score = Number.isFinite(rawScores[key])
        ? Math.max(0, Math.min(100, rawScores[key]))
        : 0;
      const isCompliant = score >= 80;
      const keyNorm = key.toLowerCase().replace(/[-_\s]/g, "");
      const violationsCount = (result.findings || []).filter((f) =>
        f.violations?.some((v) => v.framework.toLowerCase().replace(/[-_\s]/g, "") === keyNorm),
      ).length;

      return {
        key,
        label: key.toUpperCase().replace("_", " "),
        score,
        isCompliant,
        violationsCount,
      };
    });
  }, [result.framework_scores, result.findings]);

  // Average CVSS calculation
  const avgCvss = useMemo(() => {
    return recordedCvssAverage(result.findings || []);
  }, [result.findings]);

  return (
    <div className={cn("rounded-sm border border-border bg-card p-5 space-y-5", className)}>
      {/* Analytics Dashboard Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ChartPieSlice size={17} weight="duotone" className="text-accent" />
            <span className="font-mono text-[10px] font-bold text-accent uppercase tracking-wider">
              // TELEMETRY & AUDIT ANALYTICS ENGINE
            </span>
            <span className="inline-flex items-center rounded-xs border border-border bg-secondary/60 px-1.5 py-0.2 font-mono text-[9px] font-bold text-foreground">
              {totalFindings} TOTAL FINDINGS
            </span>
          </div>
          <h3 className="text-base font-bold tracking-tight text-foreground mt-0.5">
            Security Telemetry & Risk Vector Analytics
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quantitative vulnerability density, CWE taxonomy dispersion, and regulatory posture
            benchmarks.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center rounded-sm border border-border bg-background p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "px-2.5 py-1 rounded-xs font-bold transition-colors",
              activeTab === "overview"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("taxonomy")}
            className={cn(
              "px-2.5 py-1 rounded-xs font-bold transition-colors",
              activeTab === "taxonomy"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            CWE Vectors
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("compliance")}
            className={cn(
              "px-2.5 py-1 rounded-xs font-bold transition-colors",
              activeTab === "compliance"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Compliance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hotspots")}
            className={cn(
              "px-2.5 py-1 rounded-xs font-bold transition-colors",
              activeTab === "hotspots"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Hotspots
          </button>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          VIEW 1: OVERVIEW (DONUT + KEY METRICS + TOP CWE + COMPLIANCE PREVIEW)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {(activeTab === "overview" || activeTab === "taxonomy") && (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Donut Chart & Severity Distribution (5 Cols) */}
          <div className="rounded-sm border border-border bg-background/50 p-4 lg:col-span-5 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-border/70 pb-2.5 mb-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                // Severity Distribution
              </span>
              <span className="font-mono text-[10px] text-foreground font-semibold">
                Mean recorded CVSS: {avgCvss ?? "N/A"} / 10.0
              </span>
            </div>

            {totalFindings === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                <CheckCircle size={36} weight="fill" className="text-success" />
                <p className="font-bold text-xs text-foreground">No findings recorded</p>
                <p className="text-[11px] text-muted-foreground">
                  Validate scan coverage; this does not prove security.
                </p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row lg:flex-col items-center justify-around gap-4 py-2">
                {/* SVG Donut */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg width="150" height="150" viewBox="0 0 130 130" className="-rotate-90">
                    <circle
                      cx="65"
                      cy="65"
                      r="50"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="12"
                      className="text-border dark:text-secondary/60"
                    />
                    {donutData.map((slice) => {
                      const isHovered = hoveredSlice === slice.key;
                      return (
                        <circle
                          key={slice.key}
                          cx="65"
                          cy="65"
                          r="50"
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth={isHovered ? 16 : 12}
                          strokeDasharray={slice.strokeDasharray}
                          strokeDashoffset={slice.strokeDashoffset}
                          className="transition-all duration-300 cursor-pointer"
                          onMouseEnter={() => setHoveredSlice(slice.key)}
                          onMouseLeave={() => setHoveredSlice(null)}
                          onClick={() => onFilterSeverity?.(slice.key)}
                        />
                      );
                    })}
                  </svg>

                  {/* Center Score Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                      Health
                    </span>
                    <span
                      className={cn(
                        "font-mono text-xl font-black tabular-nums leading-none mt-0.5",
                        healthScore >= 80
                          ? "text-success"
                          : healthScore >= 60
                            ? "text-amber-500"
                            : "text-destructive",
                      )}
                    >
                      {healthScore}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">/ 100</span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="w-full space-y-1.5 font-mono text-xs">
                  {donutData.map((slice) => {
                    const isHovered = hoveredSlice === slice.key;
                    return (
                      <div
                        key={slice.key}
                        onClick={() => onFilterSeverity?.(slice.key)}
                        onMouseEnter={() => setHoveredSlice(slice.key)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        className={cn(
                          "flex items-center justify-between p-1.5 rounded-sm border transition-all cursor-pointer",
                          isHovered
                            ? "border-foreground bg-secondary/80 scale-[1.01]"
                            : "border-border/60 bg-card/60 hover:bg-secondary/40",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: slice.color }}
                          />
                          <span className="text-[11px] font-bold text-foreground">
                            {slice.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{slice.pct}%</span>
                          <span className="text-xs font-black tabular-nums text-foreground">
                            {slice.count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* CWE Attack Surface Histogram (7 Cols) */}
          <div className="rounded-sm border border-border bg-background/50 p-4 lg:col-span-7 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-border/70 pb-2.5 mb-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                // CWE Attack Vectors & Vulnerability Taxonomy
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {taxonomyGroups.length} Vector Classes
              </span>
            </div>

            {taxonomyGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ShieldCheck size={32} className="text-success mb-2" />
                <p className="font-mono text-xs text-muted-foreground">
                  No exploit taxonomy categories flagged.
                </p>
              </div>
            ) : (
              <div className="space-y-3 py-1">
                {taxonomyGroups.slice(0, activeTab === "taxonomy" ? 10 : 5).map((group, idx) => {
                  const sevStyle = SEVERITY_COLORS[group.topSeverity];
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "rounded-xs border px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase shrink-0",
                              sevStyle.fill,
                            )}
                          >
                            {group.cwe}
                          </span>
                          <span className="font-bold text-foreground text-xs truncate">
                            {group.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                          <span className="text-[11px] text-muted-foreground">
                            {group.percentage}%
                          </span>
                          <span className="font-black text-foreground tabular-nums">
                            {group.count} flaw{group.count > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      {/* Proportional Bar */}
                      <div className="relative h-2 w-full overflow-hidden rounded-xs bg-secondary/80 border border-border/50">
                        <div
                          className="h-full transition-all duration-500 rounded-xs"
                          style={{
                            width: `${Math.max(6, group.percentage)}%`,
                            backgroundColor: sevStyle.stroke,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          VIEW 2: COMPLIANCE POSTURE BENCHMARK COMPARISON
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {(activeTab === "overview" || activeTab === "compliance") && complianceData.length > 0 && (
        <div className="rounded-sm border border-border bg-background/50 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              // Regulatory Compliance Readiness Comparison
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              Estimated readiness, not certification
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {complianceData.map((item) => {
              return (
                <div
                  key={item.key}
                  onClick={() => onFilterFramework?.(item.key)}
                  className="rounded-sm border border-border bg-card p-3 space-y-2 hover:bg-secondary/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-foreground">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-xs font-black tabular-nums",
                        item.isCompliant
                          ? "text-success"
                          : item.score >= 60
                            ? "text-amber-500"
                            : "text-destructive",
                      )}
                    >
                      {item.score}%
                    </span>
                  </div>

                  {/* Horizontal Bar with Threshold Tick */}
                  <div className="relative h-2 w-full overflow-hidden rounded-xs bg-secondary border border-border/60">
                    <div
                      className={cn(
                        "h-full transition-all duration-500 rounded-xs",
                        item.isCompliant
                          ? "bg-success"
                          : item.score >= 60
                            ? "bg-amber-500"
                            : "bg-destructive",
                      )}
                      style={{ width: `${item.score}%` }}
                    />
                    {/* 80% passing indicator tick */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-foreground/50 z-10"
                      style={{ left: "80%" }}
                      title="80% display reference, not a certification threshold"
                    />
                  </div>

                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground pt-0.5">
                    <span>
                      {item.violationsCount > 0 ? (
                        <span className="text-destructive font-semibold">
                          {item.violationsCount} mapped finding{item.violationsCount > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-semibold">
                          0 findings mapped
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "font-bold uppercase text-[9px]",
                        item.isCompliant ? "text-success" : "text-destructive",
                      )}
                    >
                      {item.isCompliant ? "Estimate" : "Review"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          VIEW 3: FILE BLAST RADIUS & RISK HOTSPOTS
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {(activeTab === "overview" || activeTab === "hotspots") && fileHotspots.length > 0 && (
        <div className="rounded-sm border border-border bg-background/50 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Flame size={14} weight="fill" className="text-destructive" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                // File Blast Radius & Risk Concentration Hotspots
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              Ranked by Weighted Flaw Severity
            </span>
          </div>

          <div className="space-y-2">
            {fileHotspots.map((item, idx) => {
              return (
                <div
                  key={idx}
                  className="rounded-sm border border-border/80 bg-card p-3 space-y-2 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-secondary border border-border shrink-0">
                        <Code size={12} className="text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-foreground truncate">
                          {item.fileName}
                        </p>
                        <p
                          className="font-mono text-[10px] text-muted-foreground truncate max-w-md xl:max-w-2xl"
                          title={item.filePath}
                        >
                          {item.filePath}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                      {item.critical > 0 && (
                        <span className="rounded-xs border border-destructive/30 bg-destructive/15 px-1.5 py-0.2 font-bold text-destructive">
                          {item.critical} Crit
                        </span>
                      )}
                      {item.high > 0 && (
                        <span className="rounded-xs border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.2 font-bold text-amber-500">
                          {item.high} High
                        </span>
                      )}
                      {item.medium > 0 && (
                        <span className="rounded-xs border border-yellow-500/30 bg-yellow-500/15 px-1.5 py-0.2 font-bold text-yellow-600 dark:text-yellow-400">
                          {item.medium} Med
                        </span>
                      )}
                      {item.low > 0 && (
                        <span className="rounded-xs border border-blue-500/30 bg-blue-500/15 px-1.5 py-0.2 font-bold text-blue-500">
                          {item.low} Low
                        </span>
                      )}
                      <span className="font-bold text-foreground text-xs ml-1">
                        {item.totalFindings} Flaw{item.totalFindings > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Relative Heat Bar */}
                  <div className="relative h-1.5 w-full overflow-hidden rounded-xs bg-secondary border border-border/50">
                    <div
                      className={cn(
                        "h-full transition-all duration-500 rounded-xs",
                        item.critical > 0
                          ? "bg-destructive"
                          : item.high > 0
                            ? "bg-amber-500"
                            : "bg-yellow-500",
                      )}
                      style={{ width: `${Math.max(8, item.percentageOfTotalRisk)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
