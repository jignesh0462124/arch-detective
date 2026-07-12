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
        "overflow-hidden rounded-xl shadow-soft",
        tone === "dark"
          ? "bg-ink text-cream hairline"
          : "bg-cream text-foreground hairline",
        className,
      )}
    >
      {(filename || label) && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b px-3 py-2",
            tone === "dark" ? "border-cream/10" : "hairline-soft border-b",
          )}
        >
          <div className="flex items-center gap-2">
            {isTerminal ? (
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="h-2 w-2 rounded-full bg-secondary" />
                <span className="h-2 w-2 rounded-full bg-success" />
              </div>
            ) : null}
            <span
              className={cn(
                "font-mono text-[11px]",
                tone === "dark" ? "text-cream/70" : "text-muted-foreground",
              )}
            >
              {filename ?? label}
            </span>
          </div>
          {label && filename ? (
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-wider",
                tone === "dark" ? "text-cream/40" : "text-muted-foreground",
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