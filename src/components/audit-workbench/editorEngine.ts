type Engine = typeof import("monaco-editor/esm/vs/editor/editor.api.js");
let engine: Promise<Engine> | undefined;
export const preloadEditor = () =>
  (engine ??= import("monaco-editor/esm/vs/editor/editor.api.js").catch((error) => {
    engine = undefined;
    throw error;
  }));
