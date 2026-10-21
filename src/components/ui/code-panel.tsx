import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CodePanelProps {
  filename?: string;
  label?: string;
  variant?: "default" | "terminal" | "evidence";
  tone?: "dark" | "light";
  className?: string;
  children: ReactNode;
  scrollable?: boolean;
}

export function CodePanel({
  filename,
  label,
  variant = "default",
  tone = "dark",
  className,
  children,
  scrollable = true,
}: CodePanelProps) {
  const isTerminal = variant === "terminal";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-sm",
        tone === "dark" ? "bg-[#0d1117] text-white hairline border-border" : "bg-card text-foreground hairline",
        className,
      )}
    >
      {(filename || label) && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b px-3 py-2",
            tone === "dark" ? "border-white/10 bg-white/5" : "hairline-soft border-b bg-secondary/30",
          )}
        >
          <div className="flex items-center gap-2">
            {isTerminal ? (
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
            ) : null}
            <span
              className={cn(
                "font-mono text-[11px]",
                tone === "dark" ? "text-white/70" : "text-muted-foreground",
              )}
            >
              {filename ?? label}
            </span>
          </div>
          {label && filename ? (
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-wider",
                tone === "dark" ? "text-white/40" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          ) : null}
        </div>
      )}
      <div
        className={cn(
          "font-mono text-[12px] leading-relaxed",
          isTerminal ? "p-4" : "p-4",
          scrollable && "max-h-72 overflow-auto",
        )}
      >
        {children}
      </div>
    </div>
  );
}
