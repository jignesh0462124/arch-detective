let editorModule: Promise<typeof import("./SourceEditor")> | undefined;
export function loadSourceEditor() {
  return (editorModule ??= import("./SourceEditor").catch((error) => {
    editorModule = undefined;
    throw error;
  }));
}
export function prefetchWorkbench() {
  void import("./AuditWorkbench").catch(() => {});
  void loadSourceEditor()
    .then(() => import("./editorEngine").then((module) => module.preloadEditor()))
    .catch(() => {});
}
