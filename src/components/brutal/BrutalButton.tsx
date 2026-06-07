import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "ghost" | "utility";

const styles: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground border-brutal shadow-brutal shadow-brutal-hover",
  secondary:
    "bg-card text-foreground border-brutal shadow-brutal shadow-brutal-hover",
  tertiary:
    "bg-secondary text-foreground border-brutal shadow-brutal shadow-brutal-hover",
  ghost: "bg-transparent text-foreground border-brutal hover:bg-cream-deep",
  utility:
    "bg-ink text-cream border-brutal hover:bg-foreground/90",
};

export function BrutalButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-base",
  } as const;

  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold leading-none",
        styles[variant],
        sizes[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
