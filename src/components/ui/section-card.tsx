import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionCardProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  variant?: "default" | "muted" | "dark" | "primary";
  frame?: "outlined" | "flat";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  children?: ReactNode;
  headerExtra?: ReactNode;
}

const VARIANT: Record<NonNullable<SectionCardProps["variant"]>, string> = {
  default: "bg-card text-card-foreground",
  muted: "bg-secondary text-foreground",
  dark: "bg-ink text-white dark:bg-card dark:text-card-foreground",
  primary: "bg-primary text-primary-foreground",
};

const PADDING: Record<NonNullable<SectionCardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function SectionCard({
  eyebrow,
  title,
  description,
  actions,
  variant = "default",
  frame = "outlined",
  padding = "md",
  className,
  children,
  headerExtra,
}: SectionCardProps) {
  const isDark = variant === "dark";
  const isPrimary = variant === "primary";
  const hasHeader = eyebrow || title || description || actions || headerExtra;

  return (
    <div
      className={cn(
        "overflow-hidden min-w-0 w-full",
        frame === "outlined" ? "rounded-sm hairline" : "rounded-none border-y border-border",
        VARIANT[variant],
        className,
      )}
    >
      {hasHeader ? (
        <div
          className={cn(
            "flex flex-col gap-3 px-5 py-4 sm:px-6 md:flex-row md:items-start md:justify-between",
            isDark && "border-b hairline-soft border-white/15 dark:border-border",
            isPrimary && "border-b border-primary-foreground/15",
            !isDark && !isPrimary && "border-b hairline-soft",
          )}
        >
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <div
                className={cn(
                  "section-title",
                  isDark
                    ? "text-white/70 dark:text-muted-foreground"
                    : isPrimary
                      ? "opacity-80"
                      : "text-muted-foreground",
                )}
              >
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <h3 className="mt-1 text-lg sm:text-[22px] font-medium leading-snug break-words overflow-wrap-anywhere">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p
                className={cn(
                  "mt-1 text-sm break-words overflow-wrap-anywhere",
                  isDark ? "text-white/70 dark:text-muted-foreground" : "text-muted-foreground",
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
          {actions || headerExtra ? (
            <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end md:max-w-[45%]">
              {actions}
              {headerExtra}
            </div>
          ) : null}
        </div>
      ) : null}
      {children ? <div className={cn(PADDING[padding], "min-w-0")}>{children}</div> : null}
    </div>
  );
}
