import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const bundled = await build({
  stdin: {
    contents: 'export * from "./src/lib/theme"; export * from "./src/lib/themeMotion";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  plugins: [
    {
      name: "theme-react-boundary",
      setup(builder) {
        builder.onResolve({ filter: /^react(?:-dom)?$/ }, ({ path }) => ({
          path,
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          contents:
            path === "react-dom"
              ? "export const flushSync = fn => fn();"
              : "export const useSyncExternalStore = (subscribe, read, server) => server();",
        }));
      },
    },
  ],
});
const theme = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture({ reduced = false, hidden = false, storageDenied = false, start } = {}) {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const values = new Map();
  const events = [];
  const root = {
    dataset: {},
    classList: {
      toggle: (name, value) => {
        root.dark = value;
      },
    },
  };
  globalThis.document = {
    documentElement: root,
    visibilityState: hidden ? "hidden" : "visible",
    startViewTransition: start,
  };
  globalThis.window = {
    matchMedia: () => ({ matches: reduced }),
    localStorage: {
      setItem(key, value) {
        if (storageDenied) throw Error("denied");
        values.set(key, value);
      },
    },
    dispatchEvent: (event) => events.push(event.type),
  };
  return {
    root,
    values,
    events,
    cleanup() {
      theme.cancelThemeTransition();
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
    },
  };
}
test("SSR theme writes remain safe and do not touch browser globals", () => {
  const original = globalThis.window;
  delete globalThis.window;
  assert.doesNotThrow(() => theme.setTheme("dark"));
  globalThis.window = original;
});
test("reduced motion and hidden documents apply immediately without snapshots", () => {
  for (const options of [{ reduced: true }, { hidden: true }]) {
    const f = fixture({
      ...options,
      start: () => {
        throw Error("must not capture");
      },
    });
    try {
      theme.setTheme("dark");
      assert.equal(f.root.dataset.theme, "dark");
      assert.equal(f.root.dataset.themeTransition, undefined);
      assert.equal(f.values.get("archon-theme"), "dark");
    } finally {
      f.cleanup();
    }
  }
});
test("unsupported and failing snapshot APIs retain a usable preference with denied storage", () => {
  for (const start of [
    undefined,
    () => {
      throw Error("unsupported");
    },
  ]) {
    const f = fixture({ start, storageDenied: true });
    try {
      assert.doesNotThrow(() => theme.setTheme("dark"));
      assert.equal(f.root.dark, true);
      assert.equal(f.root.dataset.themeTransition, "colors");
      assert.deepEqual(f.events, ["archon-theme-changed"]);
    } finally {
      f.cleanup();
    }
  }
});
test("rapid theme choices discard obsolete callbacks and clear snapshot state", async () => {
  const transitions = [];
  const f = fixture({
    start(update) {
      const ready = deferred(),
        finished = deferred();
      const item = {
        update,
        ready: ready.promise,
        finished: finished.promise,
        finish: finished.resolve,
        skipTransition() {
          ready.reject(Error("skipped"));
          finished.reject(Error("skipped"));
        },
      };
      transitions.push(item);
      return item;
    },
  });
  try {
    theme.setTheme("dark");
    theme.setTheme("light");
    transitions[0].update();
    assert.equal(f.root.dataset.theme, undefined);
    transitions[1].update();
    assert.equal(f.root.dataset.theme, "light");
    transitions[1].finish();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(f.root.dataset.themeTransition, undefined);
    assert.equal(f.values.get("archon-theme"), "light");
    assert.deepEqual(f.events, ["archon-theme-changed"]);
  } finally {
    f.cleanup();
  }
});
test("a skipped capture still commits its update and handles rejected transition promises", async () => {
  const ready = deferred(),
    finished = deferred();
  const f = fixture({
    start: () => ({ ready: ready.promise, finished: finished.promise, skipTransition() {} }),
  });
  try {
    theme.setTheme("dark");
    ready.reject(Error("capture failed"));
    finished.reject(Error("capture failed"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(f.root.dataset.theme, "dark");
    assert.equal(f.root.dataset.themeTransition, undefined);
  } finally {
    f.cleanup();
  }
});
test("motion is bounded, theme-scoped and disabled for reduced motion", async () => {
  const css = await readFile("src/motion.css", "utf8");
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-theme-transition="snapshot"/);
  assert.match(css, /view-transition-old\(root\)/);
  assert.match(css, /360ms/);
  assert.doesNotMatch(css, /transition:\s*all|blur\(|clip-path/);
});
