import { flushSync } from "react-dom";

type ThemeTransition = {
  finished: Promise<void>;
  ready?: Promise<void>;
  updateCallbackDone?: Promise<void>;
  skipTransition: () => void;
};
type ThemeDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeTransition;
};

let revision = 0;
let active: ThemeTransition | undefined;
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

/** Cancel obsolete snapshots without delaying or remounting application content. */
export function cancelThemeTransition() {
  revision++;
  active?.skipTransition();
  active = undefined;
  clearTimeout(fallbackTimer);
  if (typeof document !== "undefined") delete document.documentElement.dataset.themeTransition;
}

export function transitionTheme(update: () => void) {
  cancelThemeTransition();
  const request = revision;
  let committed = false;
  const commit = () => {
    if (request !== revision || committed) return;
    committed = true;
    update();
  };
  if (typeof document === "undefined" || typeof window === "undefined") {
    commit();
    return;
  }
  if (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
    document.visibilityState === "hidden"
  ) {
    commit();
    return;
  }
  const root = document.documentElement;
  const cleanup = () => {
    if (request !== revision) return;
    active = undefined;
    delete root.dataset.themeTransition;
  };
  const start = (document as ThemeDocument).startViewTransition;
  if (typeof start === "function") {
    root.dataset.themeTransition = "snapshot";
    try {
      const transition = start.call(document, () => flushSync(commit));
      active = transition;
      // Snapshot capture can be skipped by the browser; the preference must still apply.
      void transition.ready?.catch(() => {});
      void transition.updateCallbackDone?.catch(commit);
      void transition.finished.catch(commit).then(cleanup, cleanup);
      return;
    } catch {
      delete root.dataset.themeTransition;
    }
  }
  root.dataset.themeTransition = "colors";
  commit();
  fallbackTimer = setTimeout(cleanup, 360);
}
