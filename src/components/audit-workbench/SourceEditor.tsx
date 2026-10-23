import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import "monaco-editor/esm/vs/editor/contrib/find/browser/findController.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import type { SourceWindow } from "@/lib/api/workbench";
import { preloadEditor } from "./editorEngine";

type Engine = typeof import("monaco-editor/esm/vs/editor/editor.api.js");
const languages: Record<string, () => Promise<unknown>> = {
  javascript: () =>
    import("monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js"),
  typescript: () =>
    import("monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js"),
  python: () => import("monaco-editor/esm/vs/basic-languages/python/python.contribution.js"),
  php: () => import("monaco-editor/esm/vs/basic-languages/php/php.contribution.js"),
  java: () => import("monaco-editor/esm/vs/basic-languages/java/java.contribution.js"),
  go: () => import("monaco-editor/esm/vs/basic-languages/go/go.contribution.js"),
  rust: () => import("monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js"),
  cpp: () => import("monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js"),
  csharp: () => import("monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js"),
  html: () => import("monaco-editor/esm/vs/basic-languages/html/html.contribution.js"),
  css: () => import("monaco-editor/esm/vs/basic-languages/css/css.contribution.js"),
  sql: () => import("monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js"),
  yaml: () => import("monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js"),
  shell: () => import("monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js"),
  ruby: () => import("monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution.js"),
  markdown: () => import("monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js"),
  xml: () => import("monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js"),
  kotlin: () => import("monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution.js"),
  ini: () => import("monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js"),
};
type CachedModel = {
  model: Monaco.editor.ITextModel;
  bytes: number;
  view: Monaco.editor.ICodeEditorViewState | null;
};

export default function SourceEditor({
  source,
  path,
  line,
  fileKey,
  focusKey,
  message = "Loading source…",
}: {
  source: SourceWindow | null;
  path: string;
  line: number | null;
  fileKey: string;
  focusKey?: string;
  message?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const api = useRef<Engine | null>(null);
  const models = useRef(new Map<string, CachedModel>());
  const active = useRef<string | null>(null);
  const lastFocus = useRef<string | null>(null);
  const decorations = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | undefined;
    const cache = models.current;
    void preloadEditor()
      .then((monaco) => {
        if (disposed || !container.current) return;
        api.current = monaco;
        (
          globalThis as typeof globalThis & { MonacoEnvironment: { getWorker: () => Worker } }
        ).MonacoEnvironment = { getWorker: () => new EditorWorker() };
        monaco.editor.defineTheme("archon-light", {
          base: "vs",
          inherit: true,
          rules: [],
          colors: {
            "editor.background": "#FFFFFF",
            "editor.lineHighlightBackground": "#F5F1EC",
            "editorLineNumber.foreground": "#626260",
            "editor.selectionBackground": "#FF560025",
          },
        });
        monaco.editor.defineTheme("archon-dark", {
          base: "vs-dark",
          inherit: true,
          rules: [],
          colors: {
            "editor.background": "#191918",
            "editor.foreground": "#eeeeeb",
            "editorLineNumber.foreground": "#b4b4ae",
            "editorLineNumber.activeForeground": "#ffffff",
            "editor.lineHighlightBackground": "#313130",
            "editor.selectionBackground": "#FF560040",
          },
        });
        const theme = () =>
          monaco.editor.setTheme(
            document.documentElement.dataset.theme === "dark" ? "archon-dark" : "archon-light",
          );
        theme();
        editor.current = monaco.editor.create(container.current, {
          model: null,
          readOnly: true,
          domReadOnly: true,
          automaticLayout: true,
          minimap: { enabled: false },
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 13,
          lineHeight: 22,
          padding: { top: 14 },
          scrollBeyondLastLine: false,
          wordWrap: "off",
          renderLineHighlight: "line",
          contextmenu: false,
          links: false,
          renderValidationDecorations: "off",
          stickyScroll: { enabled: false },
        });
        container.current.dataset.editorInstance = crypto.randomUUID();
        decorations.current = editor.current.createDecorationsCollection();
        observer = new MutationObserver(theme);
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-theme"],
        });
        setReady(true);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      editor.current?.dispose();
      editor.current = null;
      api.current = null;
      cache.forEach(({ model }) => model.dispose());
      cache.clear();
    };
  }, []);
  useEffect(() => {
    const instance = editor.current;
    const monaco = api.current;
    if (!ready || !instance || !monaco) return;
    const previous = active.current && models.current.get(active.current);
    if (previous) previous.view = instance.saveViewState();
    if (!source) {
      instance.setModel(null);
      active.current = null;
      if (container.current) container.current.dataset.sourceId = "";
      return;
    }
    const key = fileKey + "/" + source.start_line;
    let cached = models.current.get(key);
    if (!cached)
      cached = {
        model: monaco.editor.createModel(
          source.content,
          "plaintext",
          monaco.Uri.parse("archon://" + encodeURIComponent(key)),
        ),
        bytes: new TextEncoder().encode(source.content).length,
        view: null,
      };
    models.current.delete(key);
    models.current.set(key, cached);
    instance.setModel(cached.model);
    active.current = key;
    instance.updateOptions({
      lineNumbers: (n) => String(source.start_line + n - 1),
      ariaLabel: "Read-only source " + path,
    });
    if (cached.view) instance.restoreViewState(cached.view);
    if (container.current) container.current.dataset.sourceId = source.id;
    let bytes = [...models.current.values()].reduce((n, entry) => n + entry.bytes, 0);
    for (const [id, entry] of models.current) {
      if (models.current.size <= 8 && bytes <= 2 * 1024 * 1024) break;
      if (id === key) continue;
      bytes -= entry.bytes;
      entry.model.dispose();
      models.current.delete(id);
    }
    const model = cached.model;
    const load = languages[source.language === "c" ? "cpp" : source.language];
    if (load)
      void load()
        .then(() => {
          if (!model.isDisposed())
            monaco.editor.setModelLanguage(
              model,
              source.language === "c" ? "cpp" : source.language,
            );
        })
        .catch(() => {});
  }, [ready, source, fileKey, path]);
  useEffect(() => {
    const monaco = api.current;
    const instance = editor.current;
    if (!ready || !instance || !monaco || !source) return;
    const local =
      line && line >= source.start_line && line <= source.end_line
        ? line - source.start_line + 1
        : null;
    decorations.current?.set(
      local
        ? [
            {
              range: new monaco.Range(local, 1, local, 1),
              options: {
                isWholeLine: true,
                className: "audit-source-finding-line",
                linesDecorationsClassName: "audit-source-finding-marker",
              },
            },
          ]
        : [],
    );
    const focus = `${focusKey || ""}:${line}`;
    if (local && lastFocus.current !== focus) {
      instance.revealLineInCenter(local);
      instance.setPosition({ lineNumber: local, column: 1 });
      lastFocus.current = focus;
    }
  }, [ready, line, source, fileKey, focusKey]);
  return (
    <div className="relative h-full min-h-[340px] w-full overflow-hidden">
      <div
        ref={container}
        className={"h-full w-full " + (!ready || !source || failed ? "invisible" : "")}
      />
      {(!ready || failed) && source ? (
        <pre
          tabIndex={0}
          aria-label={"Read-only source " + path}
          className="absolute inset-0 overflow-auto p-4 font-mono text-xs leading-[22px]"
        >
          {source.content.split("\n").map((text, index) => (
            <div
              key={index}
              className={source.start_line + index === line ? "audit-source-finding-line" : ""}
            >
              <span className="mr-5 select-none text-muted-foreground">
                {source.start_line + index}
              </span>
              {text || " "}
            </div>
          ))}
        </pre>
      ) : !source ? (
        <p role="status" className="absolute inset-0 p-5 text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
