import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

type ArchonLogoProps = {
  size?: number;
  variant?: "brand" | "mono";
  decorative?: boolean;
  label?: string;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height" | "viewBox">;

/** Archon's shield-and-reticle mark. */
export function ArchonLogo({
  size = 32,
  variant = "brand",
  decorative = false,
  label = "Archon",
  className,
  ...props
}: ArchonLogoProps) {
  const accentColor = variant === "brand" ? "#ff5600" : "currentColor";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      focusable="false"
      role={decorative ? undefined : "img"}
      {...props}
    >
      {!decorative ? <title>{label}</title> : null}
      <path
        d="M32 5 10 16v16c0 13.2 9.2 24.8 22 28 12.8-3.2 22-14.8 22-28V16L32 5Z"
        fill="currentColor"
        fillOpacity={0.08}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path
        d="M20 33h8m8 0h8M32 21v8m0 8v8"
        stroke={accentColor}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <circle cx={32} cy={33} r={3.25} fill={accentColor} />
    </svg>
  );
}
