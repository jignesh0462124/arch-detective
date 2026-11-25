import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";

const out = await build({
  stdin: {
    contents: `
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { DashboardSkeleton, LoadingRows, PageDataActivity } from "./src/components/ui/data-loading";
    import { Route } from "./src/routes/_app/dashboard";
    import { RequireAuth } from "./src/components/auth/RequireAuth";
    export const skeleton = () => renderToStaticMarkup(createElement(DashboardSkeleton));
    export const rows = () => renderToStaticMarkup(createElement(LoadingRows));
    export const activity = () => renderToStaticMarkup(createElement(PageDataActivity));
    export const dashboard = () => renderToStaticMarkup(createElement(Route.options.component));
    export const gate = () => renderToStaticMarkup(createElement(RequireAuth,null,"Private dashboard"));
  `,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  external: ["react", "react-dom/server"],
  plugins: [
    {
      name: "loading-boundaries",
      setup(builder) {
        const modules = {
          "@tanstack/react-router": `import {createElement} from "react"; export const createFileRoute=() => options => ({options}); export const useNavigate=()=>()=>{}; export const useLocation=()=>({href:"/dashboard"}); export const Link=({to,params,search,children,...props})=>createElement("a",{...props,href:to},children);`,
          "@tanstack/react-query": `export const useIsFetching = ({predicate}) => globalThis.loadingFixture.queries.filter(predicate).length;`,
          "@/hooks/useAuth": `export const useAuth=()=>({user:{id:"user"},isLoading:false,...globalThis.loadingAuth});`,
          "@/hooks/useWorkspace": `export const useActiveWorkspace=()=>({active:{id:"workspace",name:"Workspace"},isLoading:false});`,
          "@/hooks/useDashboard": `export const useDashboardScans=()=>globalThis.loadingFixture.scans; export const useDashboardFindings=()=>globalThis.loadingFixture.findings;`,
          "@/components/brutal/AppShell": `import {createElement} from "react"; export const AppShell=({children,title})=>createElement("main",null,createElement("h1",null,title),children);`,
        };
        builder.onResolve(
          {
            filter:
              /^(?:@tanstack\/react-(?:router|query)|@\/hooks\/(?:useAuth|useWorkspace|useDashboard)|@\/components\/brutal\/AppShell)$/,
          },
          ({ path }) => ({ path, namespace: "fixture" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          contents: modules[path],
        }));
      },
    },
  ],
});
const require = createRequire(import.meta.url);
const code = out.outputFiles[0].text.replace(
  /from "(react|react\/jsx-runtime|react-dom\/server)"/g,
  (_, name) => `from "${pathToFileURL(require.resolve(name)).href}"`,
);
const ui = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const query = (data, isPending = false, isError = false) => ({
  data,
  isPending,
  isError,
  refetch() {},
});
function setup() {
  globalThis.loadingFixture = {
    queries: [],
    scans: {
      latest: query({
        latestCompleted: {
          id: "scan",
          target_name: "Saved project",
          scan_type: "codebase",
          completed_at: "2026-11-17T10:00:00Z",
          framework_scores: {},
        },
        completedTotal: 3,
      }),
      recent: query([]),
    },
    findings: query({
      total: 6,
      open: 6,
      criticalOpen: 1,
      items: [{ id: "f", title: "Recorded finding", severity: "high", file_path: "code.ts" }],
    }),
  };
}
test("skeletons have one status label, no fake findings and no focusable controls", () => {
  const html = ui.skeleton();
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Loading your saved audit data/);
  assert.doesNotMatch(html, /<button|<a\b|tabindex|Security score|%|All clear/);
  assert.match(ui.rows(), /Loading saved results/);
});
test("session loading stays gated and stops animating on failure", () => {
  globalThis.loadingAuth = { status: "loading" };
  const pending = ui.gate();
  assert.match(pending, /Checking your session/);
  assert.match(pending, /aria-busy="true"/);
  assert.match(pending, /data-skeleton/);
  assert.doesNotMatch(pending, /Private dashboard/);
  globalThis.loadingAuth = { status: "error", error: "Session check unavailable" };
  const failed = ui.gate();
  assert.match(failed, /Retry session check/);
  assert.doesNotMatch(failed, /data-skeleton|Private dashboard/);
  globalThis.loadingAuth = { status: "authenticated" };
  assert.match(ui.gate(), /Private dashboard/);
  delete globalThis.loadingAuth;
});
test("dashboard progressively replaces pending cards with real values and preserves errors", () => {
  setup();
  globalThis.loadingFixture.scans.latest = query(undefined, true);
  assert.match(ui.dashboard(), /dashboard-loading/);
  setup();
  globalThis.loadingFixture.findings = query(undefined, true);
  const pending = ui.dashboard();
  assert.match(pending, /Saved project/);
  assert.match(pending, /data-skeleton/);
  assert.doesNotMatch(pending, /Finding counts could not be loaded/);
  setup();
  const ready = ui.dashboard();
  assert.match(ready, /6 open findings/);
  assert.match(ready, /Recorded finding/);
  assert.doesNotMatch(ready, /data-skeleton/);
  // A revalidation can fail while old (potentially revoked) data is still in Query state.
  globalThis.loadingFixture.findings.isError = true;
  const error = ui.dashboard();
  assert.match(error, /Finding counts could not be loaded/);
  assert.match(error, /Retry/);
  assert.doesNotMatch(error, /data-skeleton|No findings were recorded|Recorded finding/);
});
test("the latest audit and recent scans do not wait on or borrow errors from each other", () => {
  setup();
  globalThis.loadingFixture.scans.recent = query(undefined, true);
  const slowRecent = ui.dashboard();
  assert.match(slowRecent, /Saved project/);
  assert.match(slowRecent, /Recorded finding/);
  assert.match(slowRecent, /Loading recent scans/);
  assert.doesNotMatch(slowRecent, /dashboard-loading/);
  globalThis.loadingFixture.scans.recent = query(undefined, false, true);
  assert.match(ui.dashboard(), /Retry recent scans/);
  assert.match(ui.dashboard(), /Saved project/);

  globalThis.loadingFixture.scans.latest.isError = true;
  globalThis.loadingFixture.scans.recent = query([
    { id: "active", target_name: "New upload", status: "running", scan_type: "codebase" },
  ]);
  const failedLatest = ui.dashboard();
  assert.match(failedLatest, /The latest audit is unavailable/);
  assert.match(failedLatest, /New upload/);
  assert.doesNotMatch(failedLatest, /Saved project|Recorded finding/);
});
test("background refreshes retain saved content instead of flashing skeletons", () => {
  setup();
  globalThis.loadingFixture.scans.latest.isFetching = true;
  globalThis.loadingFixture.findings.isFetching = true;
  assert.match(ui.dashboard(), /6 open findings/);
  assert.doesNotMatch(ui.dashboard(), /dashboard-loading|data-skeleton/);
});
test("page activity ignores inactive queries, health polls and background refreshes", () => {
  setup();
  const q = (key, data, observers = 1) => ({
    queryKey: [key],
    state: { data },
    getObserversCount: () => observers,
  });
  globalThis.loadingFixture.queries = [
    q("backend-health"),
    q("advisor-capabilities"),
    q("reports", {}, 1),
    q("finding-counts", undefined, 0),
  ];
  assert.doesNotMatch(ui.activity(), /page-data-activity-fill/);
  globalThis.loadingFixture.queries.push(q("finding-counts"));
  assert.match(ui.activity(), /Loading page data/);
  assert.match(ui.activity(), /page-data-activity-fill/);
});
test("loading does not introduce timers, extra requests or persisted source", async () => {
  const source = await readFile("src/components/ui/data-loading.tsx", "utf8");
  assert.doesNotMatch(source, /setTimeout|localStorage|fetch\(|setInterval|Math.random/);
  assert.match(await readFile("src/motion.css", "utf8"), /prefers-reduced-motion: reduce/);
});
