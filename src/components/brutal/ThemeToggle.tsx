import { Moon, Sun } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "archon-theme";
type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle({
  className = "",
  toolbar = false,
}: {
  className?: string;
  toolbar?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* Storage may be unavailable. */
    }
    const initial: Theme = stored === "dark" || stored === "light" ? stored : "light";
    applyTheme(initial);
    setTheme(initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme changes still apply when browser storage is unavailable.
    }
  }, [theme, mounted]);

  const isDark = theme === "dark";
  const baseClass = cn(
    "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground",
    "transition-colors hover:bg-secondary dark:hover:bg-secondary",
    "focus-visible:outline-none focus-visible:shadow-ring",
    toolbar && "md:h-9 md:w-32 md:gap-2",
    className,
  );

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className={baseClass}
        suppressHydrationWarning
      >
        <Moon size={15} weight="fill" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={baseClass}
    >
      {isDark ? <Sun size={15} weight="fill" /> : <Moon size={15} weight="fill" />}
      {toolbar ? (
        <span className="hidden truncate font-mono text-xs font-bold md:inline">
          {isDark ? "Dark mode" : "Light mode"}
        </span>
      ) : null}
    </button>
  );
}
