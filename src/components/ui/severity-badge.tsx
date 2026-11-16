import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SeverityLevel = "critical" | "high" | "medium" | "low";

const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  critical: "text-severity-critical border-severity-critical/40",
  high: "text-severity-high border-severity-high/40",
  medium: "text-severity-medium border-severity-medium/40",
  low: "text-severity-low border-severity-low/40",
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
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={cn(
        "inline-flex min-h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded border bg-card font-medium leading-4 capitalize",
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
