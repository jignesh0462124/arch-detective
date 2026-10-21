import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "tertiary" | "ghost" | "utility";

const styles: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-card text-foreground hairline hover:bg-secondary",
  tertiary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "bg-transparent text-foreground hover:bg-secondary",
  utility: "bg-accent text-accent-foreground hover:bg-accent/90",
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
    sm: "min-h-9 px-3 py-1.5 text-[13px]",
    md: "min-h-10 px-[18px] py-2.5 text-[15px]",
    lg: "min-h-11 px-5 py-3 text-base",
  } as const;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium leading-none transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-50",
        styles[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
