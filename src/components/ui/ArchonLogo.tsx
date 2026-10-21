import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

type ArchonLogoProps = {
  size?: number;
  variant?: "brand" | "mono" | "inverse";
  decorative?: boolean;
  label?: string;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height" | "viewBox">;

/** Architectural A with an open counter and a signal-orange inspection point. */
export function ArchonLogo({
  size = 32,
  variant = "brand",
  decorative = false,
  label = "Archon",
  className,
  ...props
}: ArchonLogoProps) {
  const ink = variant === "inverse" ? "#F5F1EC" : "currentColor";

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
        d="M8 56V30C8 16.7452 18.7452 6 32 6S56 16.7452 56 30V56H44V44H20V56Z M20 34H44V30C44 23.3726 38.6274 18 32 18S20 23.3726 20 30Z"
        fill={ink}
        fillRule="evenodd"
      />
      <rect
        x="28"
        y="48"
        width="8"
        height="8"
        fill={variant === "mono" ? ink : "#FF5600"}
      />
    </svg>
  );
}
