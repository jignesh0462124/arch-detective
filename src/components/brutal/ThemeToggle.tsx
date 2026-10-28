import { Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({
  className = "",
  toolbar = false,
}: {
  className?: string;
  toolbar?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:shadow-ring",
        toolbar && "md:h-9 md:w-32 md:gap-2",
        className,
      )}
    >
      {dark ? <Sun size={15} weight="fill" /> : <Moon size={15} weight="fill" />}
      {toolbar && (
        <span className="hidden truncate font-mono text-xs font-bold md:inline">
          {dark ? "Dark mode" : "Light mode"}
        </span>
      )}
    </button>
  );
}
