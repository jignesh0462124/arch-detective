import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const key = "archon-theme";
const event = "archon-theme-changed";
let current: Theme | undefined;
function read(): Theme {
  if (current) return current;
  try {
    current = window.localStorage.getItem(key) === "dark" ? "dark" : "light";
  } catch {
    current = "light";
  }
  return current;
}
function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}
export function setTheme(theme: Theme) {
  current = theme;
  apply(theme);
  try {
    window.localStorage.setItem(key, theme);
  } catch {
    /* Keep the in-memory preference usable. */
  }
  window.dispatchEvent(new Event(event));
}
function subscribe(update: () => void) {
  apply(read());
  const storage = (value: StorageEvent) => {
    if (value.key !== key && value.key !== null) return;
    current = undefined;
    apply(read());
    update();
  };
  window.addEventListener(event, update);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(event, update);
    window.removeEventListener("storage", storage);
  };
}
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, (): Theme => "light");
  return { theme, setTheme };
}
