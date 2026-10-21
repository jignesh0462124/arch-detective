import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "ink"
  | "gold"
  | "primary"
  | "success"
  | "ghost"
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "outline";

const tones: Record<Tone, string> = {
  ink: "bg-ink text-white hairline",
  gold: "bg-accent text-accent-foreground",
  primary: "bg-primary text-primary-foreground hairline",
  success: "bg-success/15 text-success hairline",
  ghost: "bg-card text-muted-foreground hairline",
  outline: "bg-transparent text-foreground hairline",
  critical: "bg-transparent text-severity-critical severity-border-critical border",
  high: "bg-transparent text-severity-high severity-border-high border",
  medium: "bg-transparent text-severity-medium severity-border-medium border",
  low: "bg-transparent text-severity-low severity-border-low border",
};

export function BrutalBadge({
  tone = "ink",
  children,
  className = "",
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
