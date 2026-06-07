import type { ReactNode } from "react";

type Tone = "ink" | "gold" | "primary" | "success" | "ghost" | "critical" | "high" | "medium" | "low";

const tones: Record<Tone, string> = {
  ink: "bg-ink text-cream border-ink",
  gold: "bg-secondary text-foreground border-ink",
  primary: "bg-primary text-primary-foreground border-ink",
  success: "bg-success text-success-foreground border-ink",
  ghost: "bg-transparent text-foreground border-ink",
  critical: "bg-primary text-primary-foreground border-ink",
  high: "bg-secondary text-foreground border-ink",
  medium: "bg-ink text-cream border-ink",
  low: "bg-cream-deep text-foreground border-ink",
};

export function BrutalBadge({
  tone = "ink",
  children,
  className = "",
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        tones[tone],
        className,
      ].join(" ")}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
