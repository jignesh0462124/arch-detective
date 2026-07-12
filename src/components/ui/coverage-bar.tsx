import { cn } from "@/lib/utils";

export interface CoverageBarProps {
  label: string;
  pct: number;
  showMeta?: boolean;
  className?: string;
}

export function CoverageBar({
  label,
  pct,
  showMeta = true,
  className,
}: CoverageBarProps) {
  const safePct = Math.max(0, Math.min(100, pct));
  const tone =
    safePct >= 85
      ? "bg-success"
      : safePct >= 65
        ? "bg-secondary"
        : "bg-primary";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium tracking-tight">{label}</span>
        {showMeta ? (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {safePct}%
          </span>
        ) : null}
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all", tone)}
          style={{ width: `${safePct}%` }}
        />
      </div>
    </div>
  );
}