import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "archon-theme";
type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
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
    } catch {}
  }, [theme, mounted]);

  const isDark = theme === "dark";
  const baseClass = cn(
    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg hairline bg-card text-foreground shadow-soft",
    "transition-colors hover:bg-secondary dark:hover:bg-secondary",
    "focus-visible:outline-none focus-visible:shadow-ring",
    className,
  );

  if (!mounted) {
    return (
      <button type="button" aria-label="Toggle theme" className={baseClass} suppressHydrationWarning>
        <Moon size={15} strokeWidth={2} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Light mode" : "Dark mode"}
      className={baseClass}
    >
      {isDark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
    </button>
  );
}
