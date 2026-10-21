import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatTileProps {
  code?: string;
  label: string;
  value: ReactNode;
  trend?: string;
  accent?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function StatTile({
  code,
  label,
  value,
  trend,
  accent = false,
  icon,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 px-4 py-3.5",
        accent && "bg-cream dark:bg-cream-deep",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon ? <span className="text-primary">{icon}</span> : null}
        {code ? (
          <span
            className={cn(
              "font-mono text-[10px] tracking-wider",
              accent ? "text-primary" : "text-muted-foreground",
            )}
          >
            {code}
          </span>
        ) : null}
      </div>
      <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      <div className="text-[12px] font-medium text-foreground/80">{label}</div>
      {trend ? <div className="font-mono text-[10px] text-muted-foreground">{trend}</div> : null}
    </div>
  );
}
