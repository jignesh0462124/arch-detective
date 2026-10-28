import { useEffect } from "react";
import { useBlocker } from "@tanstack/react-router";

export function useUnsavedSettings(dirty: boolean | (() => boolean), message: string) {
  const isDirty = () => (typeof dirty === "function" ? dirty() : dirty);
  useBlocker({
    shouldBlockFn: () => isDirty() && !window.confirm(message),
    enableBeforeUnload: isDirty,
  });
  useEffect(() => {
    const check = (event: Event) => {
      if ((typeof dirty === "function" ? dirty() : dirty) && !window.confirm(message))
        event.preventDefault();
    };
    window.addEventListener("archon-before-workspace-change", check);
    return () => window.removeEventListener("archon-before-workspace-change", check);
  }, [dirty, message]);
}
