import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionCardProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  variant?: "default" | "muted" | "dark" | "primary";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  children?: ReactNode;
  headerExtra?: ReactNode;
}

const VARIANT: Record<NonNullable<SectionCardProps["variant"]>, string> = {
  default: "bg-card text-card-foreground",
  muted: "bg-secondary text-foreground",
  dark: "bg-ink text-cream dark:bg-card dark:text-card-foreground",
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
        "overflow-hidden rounded-xl hairline shadow-soft",
        VARIANT[variant],
        className,
      )}
    >
      {hasHeader ? (
        <div
          className={cn(
            "flex items-start justify-between gap-3 px-5 py-4 sm:px-6",
            isDark && "border-b hairline-soft border-cream/15 dark:border-border",
            isPrimary && "border-b border-primary-foreground/15",
            !isDark && !isPrimary && "border-b hairline-soft",
          )}
        >
          <div className="min-w-0">
            {eyebrow ? (
              <div
                className={cn(
                  "section-title",
                  isDark
                    ? "text-cream/70 dark:text-muted-foreground"
                    : isPrimary
                      ? "opacity-80"
                      : "text-muted-foreground",
                )}
              >
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <h3 className="mt-1 text-[22px] font-medium leading-tight">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p
                className={cn(
                  "mt-1 text-sm",
                  isDark ? "text-cream/70 dark:text-muted-foreground" : "text-muted-foreground",
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
          {actions || headerExtra ? (
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              {headerExtra}
            </div>
          ) : null}
        </div>
      ) : null}
      {children ? <div className={PADDING[padding]}>{children}</div> : null}
    </div>
  );
}
