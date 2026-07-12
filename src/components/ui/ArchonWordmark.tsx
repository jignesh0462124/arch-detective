import { cn } from "@/lib/utils";
import { ArchonLogo } from "./ArchonLogo";

/**
 * Full Archon wordmark — logomark + product name + tagline.
 *
 * Drop-in replacement for the old Cpu-icon + text pattern used in
 * AppShell sidebar and landing header.
 *
 * @example
 * <ArchonWordmark />
 * <ArchonWordmark size="sm" hideTagline />
 */
export function ArchonWordmark({
  size = "md",
  hideTagline = false,
  className,
}: {
  /** "sm" = compact (header), "md" = default (sidebar). */
  size?: "sm" | "md";
  /** Hide the "Audit engine" tagline. */
  hideTagline?: boolean;
  className?: string;
}) {
  const iconSize = size === "sm" ? 28 : 32;
  const nameClass =
    size === "sm"
      ? "text-sm font-semibold leading-none tracking-tight"
      : "text-[15px] font-semibold leading-none";
  const tagClass =
    size === "sm"
      ? "mt-0.5 font-mono text-[10px] tracking-wider text-muted-foreground"
      : "mt-1 text-[11px] leading-none text-muted-foreground";

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <div className="flex shrink-0 items-center justify-center rounded-lg bg-primary p-1.5 text-primary-foreground">
        <ArchonLogo size={iconSize} variant="mono" className="text-primary-foreground" />
      </div>
      <div className="min-w-0">
        <div className={nameClass}>Archon</div>
        {!hideTagline && <div className={tagClass}>Audit engine</div>}
      </div>
    </div>
  );
}
