import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "sentinel-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Read stored preference only after mount to avoid SSR/client mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial: "light" | "dark" =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme, mounted]);

  const isDark = theme === "dark";
  const baseClass = [
    "inline-flex h-10 w-10 items-center justify-center rounded-lg border-brutal bg-card text-foreground shadow-brutal-sm shadow-brutal-hover",
    className,
  ].join(" ");

  if (!mounted) {
    // Stable SSR markup — same tag, attrs, and children on server and first client render.
    return (
      <button type="button" aria-label="Toggle theme" className={baseClass} suppressHydrationWarning>
        <Moon size={16} strokeWidth={2.5} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={baseClass}
    >
      {isDark ? <Sun size={16} strokeWidth={2.5} /> : <Moon size={16} strokeWidth={2.5} />}
    </button>
  );
}
