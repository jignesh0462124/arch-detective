type Engine = typeof import("monaco-editor/esm/vs/editor/editor.api.js");
let engine: Promise<Engine> | undefined;
export const preloadEditor = () =>
  (engine ??= Promise.all([
    import("monaco-editor/esm/vs/editor/editor.api.js"),
    // Monaco 0.55 language modules also register editor contributions. Register
    // them before the standalone service collection is initialized; loading them
    // after the first editor leaves remounted editors with missing services.
    // Grammars remain on-demand in SourceEditor.
    import("monaco-editor/esm/vs/editor/editor.all.js"),
  ])
    .then(([api]) => api)
    .catch((error) => {
      engine = undefined;
      throw error;
    }));
