import { cn } from "@/lib/utils";

export interface CoverageBarProps {
  label: string;
  pct: number;
  showMeta?: boolean;
  className?: string;
}

export function CoverageBar({ label, pct, showMeta = true, className }: CoverageBarProps) {
  const available = Number.isFinite(pct);
  const safePct = available ? Math.max(0, Math.min(100, pct)) : 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium tracking-tight">{label}</span>
        {showMeta ? (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {available ? `${safePct}%` : "Not available"}
          </span>
        ) : null}
      </div>
      {available && (
        <div
          role="meter"
          aria-label={`${label} automated assessment`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safePct}
          aria-valuetext={`${safePct}% — automated assessment, not certification`}
          className="relative h-2 overflow-hidden rounded-sm bg-muted"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-sm bg-foreground/75"
            style={{ width: `${safePct}%` }}
          />
        </div>
      )}
    </div>
  );
}
