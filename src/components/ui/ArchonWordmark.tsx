import { cn } from "@/lib/utils";

import { ArchonLogo } from "./ArchonLogo";

type ArchonWordmarkProps = {
  size?: "sm" | "md";
  hideTagline?: boolean;
  className?: string;
  taglineClassName?: string;
};

/** Canonical in-product lockup: mark, product name, and optional descriptor. */
export function ArchonWordmark({
  size = "md",
  hideTagline = false,
  className,
  taglineClassName,
}: ArchonWordmarkProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ArchonLogo
          size={size === "sm" ? 19 : 20}
          variant="brand"
          decorative
          className="text-primary-foreground"
        />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block font-semibold leading-none",
            size === "sm" ? "text-sm" : "text-[15px]",
          )}
        >
          Archon
        </span>
        {!hideTagline ? (
          <span
            className={cn(
              "mt-1 block text-[11px] leading-none text-muted-foreground",
              taglineClassName,
            )}
          >
            Audit engine
          </span>
        ) : null}
      </span>
    </span>
  );
}
