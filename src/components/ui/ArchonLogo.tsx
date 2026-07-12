import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Archon logomark — Shield with scanning reticle.
 *
 * Cybersecurity + analysis in a single mark. Uses `currentColor` for the
 * shield body so it auto-adapts to light/dark mode, and hardcoded #ff5600
 * for the accent reticle to keep brand consistency across themes.
 *
 * @example
 * <ArchonLogo size={32} />
 * <ArchonLogo size={20} className="text-accent" variant="mono" />
 */
export function ArchonLogo({
  size = 32,
  className,
  variant = "brand",
  ...props
}: {
  /** Pixel size (width & height). */
  size?: number;
  /** "brand" uses accent orange for reticle; "mono" uses currentColor for everything. */
  variant?: "brand" | "mono";
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height" | "viewBox">) {
  const accentColor = variant === "brand" ? "#ff5600" : "currentColor";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={cn("shrink-0", className)}
      aria-label="Archon logo"
      role="img"
      {...props}
    >
      <title>Archon</title>

      {/* Shield body */}
      <path
        d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4Z"
        fill="currentColor"
        fillOpacity={0.08}
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />

      {/* Inner shield highlight */}
      <path
        d="M32 12l-18 9v12c0 11.04 7.84 21.36 18 24.56 10.16-3.2 18-13.52 18-24.56V21L32 12Z"
        fill="currentColor"
        fillOpacity={0.04}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeOpacity={0.25}
      />

      {/* Scanning reticle — horizontal */}
      <line
        x1={20}
        y1={34}
        x2={28}
        y2={34}
        stroke={accentColor}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <line
        x1={36}
        y1={34}
        x2={44}
        y2={34}
        stroke={accentColor}
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      {/* Scanning reticle — vertical */}
      <line
        x1={32}
        y1={22}
        x2={32}
        y2={30}
        stroke={accentColor}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <line
        x1={32}
        y1={38}
        x2={32}
        y2={46}
        stroke={accentColor}
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      {/* Center dot */}
      <circle cx={32} cy={34} r={2.5} fill={accentColor} />

      {/* Corner brackets — top-left */}
      <path
        d="M24 26h-2v2"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Corner brackets — top-right */}
      <path
        d="M40 26h2v2"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Corner brackets — bottom-left */}
      <path
        d="M24 42h-2v-2"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Corner brackets — bottom-right */}
      <path
        d="M40 42h2v-2"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
