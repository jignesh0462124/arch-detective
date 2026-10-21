import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SeverityLevel = "critical" | "high" | "medium" | "low";

const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  critical: "severity-bg-critical",
  high: "severity-bg-high",
  medium: "severity-bg-medium",
  low: "severity-bg-low",
};

const SEVERITY_DOT: Record<SeverityLevel, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
};

export interface SeverityBadgeProps {
  severity: SeverityLevel;
  children?: ReactNode;
  dot?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function SeverityBadge({
  severity,
  children,
  dot = false,
  size = "md",
  className,
}: SeverityBadgeProps) {
  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-medium",
        SEVERITY_CLASS[severity],
        sizeClass,
        className,
      )}
    >
      {dot ? (
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[severity])} />
      ) : null}
      {children ?? severity}
    </span>
  );
}
