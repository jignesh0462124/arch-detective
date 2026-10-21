import { Check, CircleNotch } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PipelineState = "done" | "active" | "idle";

export interface PipelineStepProps {
  index: number;
  state: PipelineState;
  title: string;
  note?: ReactNode;
  badge?: ReactNode;
  className?: string;
  dark?: boolean;
}

export function PipelineStep({
  index,
  state,
  title,
  note,
  badge,
  className,
  dark = false,
}: PipelineStepProps) {
  const muted = state === "idle";
  const accent = state === "active";

  return (
    <div className={cn("relative pl-9 min-w-0", className)}>
      {/* Spine node */}
      <div className="absolute left-0 top-0.5">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold",
            state === "done" && "bg-success text-success-foreground",
            state === "active" &&
              "bg-primary text-primary-foreground ring-2 ring-primary/20 animate-pulse-ring",
            state === "idle" &&
              (dark
                ? "border hairline-soft border-white/25 text-white/60"
                : "border hairline-soft text-muted-foreground"),
          )}
        >
          {state === "done" ? (
            <Check size={12} weight="bold" />
          ) : state === "active" ? (
            <CircleNotch size={12} weight="bold" className="animate-spin" />
          ) : (
            String(index).padStart(2, "0")
          )}
        </div>
      </div>

      {/* Title + note */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "text-sm font-medium leading-tight tracking-tight break-words overflow-wrap-anywhere",
              muted && (dark ? "text-white/70" : "text-muted-foreground"),
              accent && "font-semibold",
            )}
          >
            {title}
          </div>
          {badge}
        </div>
        {note ? (
          <div
            className={cn(
              "mt-1 font-mono text-[11px] break-words overflow-wrap-anywhere",
              dark ? "text-white/70" : "text-muted-foreground",
            )}
          >
            {note}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface PipelineListProps {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}

export function PipelineList({ children, className, dark = false }: PipelineListProps) {
  return (
    <ol className={cn("relative space-y-5 min-w-0", className)}>
      <div
        aria-hidden
        className={cn("absolute left-3 top-3 bottom-3 w-px", dark ? "bg-white/20" : "bg-border")}
      />
      {children}
    </ol>
  );
}
