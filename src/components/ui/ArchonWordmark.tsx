import { cn } from "@/lib/utils";

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
    <span className={cn("inline-flex min-w-0 flex-col", className)}>
      <img
        src="/brand/archon-wordmark.svg"
        alt="Archon"
        width={336}
        height={64}
        className={cn(
          "block h-auto shrink-0 dark:hidden",
          size === "sm" ? "w-[168px]" : "w-[184px]",
        )}
      />
      <img
        src="/brand/archon-wordmark-inverse.svg"
        alt="Archon"
        width={336}
        height={64}
        className={cn(
          "hidden h-auto shrink-0 dark:block",
          size === "sm" ? "w-[168px]" : "w-[184px]",
        )}
      />
      {!hideTagline ? (
        <span
          className={cn(
            "ml-10 mt-0.5 block text-[10px] leading-none text-muted-foreground",
            taglineClassName,
          )}
        >
          Audit engine
        </span>
      ) : null}
    </span>
  );
}
