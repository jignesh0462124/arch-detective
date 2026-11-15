import { useSyncExternalStore } from "react";

export type SidebarPreference = "expanded" | "collapsed" | null;
export const sidebarPreferenceKey = "archon-sidebar-v1";
const changed = "archon-sidebar-changed";
let cached: SidebarPreference | undefined;
export function readSidebarPreference(): SidebarPreference {
  if (cached !== undefined) return cached;
  try {
    const value = window.localStorage.getItem(sidebarPreferenceKey);
    cached = value === "expanded" || value === "collapsed" ? value : null;
  } catch {
    cached = null;
  }
  return cached;
}
export function setSidebarPreference(value: Exclude<SidebarPreference, null>) {
  cached = value;
  try {
    window.localStorage.setItem(sidebarPreferenceKey, value);
  } catch {
    /* Session preference still works. */
  }
  window.dispatchEvent(new Event(changed));
}
function subscribe(update: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== sidebarPreferenceKey && event.key !== null) return;
    cached = undefined;
    update();
  };
  window.addEventListener(changed, update);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(changed, update);
    window.removeEventListener("storage", storage);
  };
}
export const sidebarCollapsed = (preference: SidebarPreference, pathname: string) =>
  preference === "collapsed" || (preference === null && pathname.startsWith("/advisor"));
export function useSidebarPreference(pathname: string) {
  const preference = useSyncExternalStore(
    subscribe,
    readSidebarPreference,
    (): SidebarPreference => null,
  );
  return { collapsed: sidebarCollapsed(preference, pathname), setSidebarPreference };
}
