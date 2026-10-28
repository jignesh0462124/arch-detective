/** Query callbacks can run during server rendering even when a query is disabled. */
export function isPageVisible(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "visible";
}

export function visiblePageInterval(milliseconds: number): number | false {
  return isPageVisible() ? milliseconds : false;
}
