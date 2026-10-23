/* eslint-disable react-refresh/only-export-components -- Dedicated visual fixture entry point. */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { AuditWorkbench } from "../../src/components/audit-workbench/AuditWorkbench";
import { AuditUpload } from "../../src/components/audit-workbench/AuditUpload";
import { ScanAnimation } from "../../src/components/audit-workbench/ScanAnimation";
import { Route as ProfileRoute } from "../../src/routes/_app/profile";
import { Route as GraphRoute } from "../../src/routes/_app/attack-graph";
import { Route as AdvisorRoute } from "../../src/routes/_app/advisor";
import { Route as LandingRoute } from "../../src/routes/index";
import { Route as FixRoute } from "../../src/routes/_app/fix-verification";
import { AiChatProvider } from "../../src/components/ai-assistant/AiChatProvider";
import { WorkspaceSettingsPage } from "../../src/components/workspace/WorkspaceSettingsPage";
import type { ComponentType } from "react";
import { workspace } from "./hooks";
import "../../src/styles.css";

const scanId = "22222222-2222-4222-8222-222222222222";
const fileId = "33333333-3333-4333-8333-333333333333";
const secondFileId = "44444444-4444-4444-8444-444444444444";
const options = new URLSearchParams(window.location.search);
const state = options.get("state") || "ready";
const view = options.get("view") || "workbench";
const progressive = options.get("progressive") !== "false";
const fixtureStarted = Date.now();
const Profile = ProfileRoute.options.component as ComponentType;
const Graph = GraphRoute.options.component as ComponentType;
const Advisor = AdvisorRoute.options.component as ComponentType;
const Landing = LandingRoute.options.component as ComponentType;
const FixVerification = FixRoute.options.component as ComponentType;
const proposalId = "55555555-5555-4555-8555-555555555555";
const integrationId = "66666666-6666-4666-8666-666666666666";
let proposalValidated = false;
let proposalPublished = false;
// Visible fixture-only metrics, never imported by the production application.
const metrics = {
  sourceDownloads: 0,
  editorMounts: 0,
  lastTabMilliseconds: 0,
  advisorRequests: 0,
  advisorCancellations: 0,
  advisorModel: "",
  advisorContext: null as unknown,
};
let tabStart = 0;
const mountedEditors = new WeakSet<Element>();
function showMetrics() {
  const output = document.getElementById("workbench-test-metrics");
  const value = JSON.stringify(metrics);
  if (output && output.textContent !== value) output.textContent = value;
}
document.addEventListener(
  "click",
  (event) => {
    const target = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
    if (target?.closest('[aria-label="Open source files"]')) tabStart = performance.now();
  },
  true,
);
new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === "attributes" && record.attributeName === "data-source-id" && tabStart) {
      const started = tabStart;
      tabStart = 0;
      requestAnimationFrame(() => {
        metrics.lastTabMilliseconds = Math.round((performance.now() - started) * 10) / 10;
        showMetrics();
      });
    }
    if (
      record.type === "attributes" &&
      record.attributeName === "data-editor-instance" &&
      record.target instanceof Element &&
      !mountedEditors.has(record.target)
    ) {
      mountedEditors.add(record.target);
      metrics.editorMounts++;
    }
  }
  showMetrics();
}).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["data-source-id", "data-editor-instance"],
});
const running = () =>
  state === "indexing" && (options.has("hold") || Date.now() - fixtureStarted < 20000);
const source = `import express from "express";
import { database } from "./database";

const app = express();
app.get("/users", async (request, response) => {
  const name = request.query.name;
  // Fixture finding: untrusted input reaches a SQL query.
  const rows = await database.query("SELECT * FROM users WHERE name = '" + name + "'");
  response.json(rows);
});

app.listen(3000);
`;
const files = [
  {
    id: fileId,
    path: "src/server.ts",
    language: "typescript",
    byte_size: source.length,
    line_count: 13,
    preview_state: "ready",
    redacted: false,
  },
  {
    id: secondFileId,
    path: "src/config.ts",
    language: "typescript",
    byte_size: 45,
    line_count: 2,
    preview_state: "ready",
    redacted: true,
  },
  {
    id: "excluded",
    path: "node_modules/package/index.js",
    language: "javascript",
    byte_size: 100,
    line_count: 0,
    preview_state: "excluded",
    redacted: false,
    reason: "Generated output or dependency directory",
  },
];
const finding = {
  id: "fixture-finding",
  scan_id: scanId,
  title: "Untrusted input in SQL query",
  description:
    "A request parameter is concatenated into a database query. Use parameterized queries and validate input.",
  severity: "high",
  source: "static-rule",
  state: "open",
  cvss_score: 8.1,
  cwe_id: "CWE-89",
  file_path: "src/server.ts",
  line_number: 8,
  code_snippet: source.split("\n")[7],
  remediation:
    "Use a parameterized query.\nValidate the expected input type.\nAdd regression tests for malicious input.",
  location: { file_id: fileId, line_number: 8, match_status: "verified" },
  violations: [
    {
      framework: "soc2",
      control_id: "CC6.1",
      control_title: "Logical access controls",
      evidence: "The query uses a caller-controlled value without binding parameters.",
    },
  ],
};
const result = {
  scan: {
    id: scanId,
    workspace_id: workspace.id,
    status: "completed",
    scan_type: "codebase",
    target_name: "Fixture project — customer portal",
    selected_frameworks: ["soc2"],
    framework_scores: {},
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  },
  snapshot:
    state === "old"
      ? null
      : {
          id: "snapshot-fixture",
          scan_id: scanId,
          revision: 1,
          state,
          file_count: files.length,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          exclusions: [],
        },
  findings:
    state === "empty"
      ? []
      : [
          finding,
          {
            ...finding,
            id: "fixture-finding-2",
            severity: "medium",
            title: "Hardcoded credential requires review",
            cvss_score: null,
            file_path: "src/config.ts",
            line_number: 1,
            location: { file_id: secondFileId, line_number: 1, match_status: "verified" },
            violations: [],
          },
        ],
  metadata: {
    scan_id: scanId,
    summary: {
      summary: "Review two recorded findings and verify fixes with tests.",
      risk_headline: "Review required",
      overall_posture: "High",
      top_priorities: [],
    },
  },
  events: [
    {
      sequence: 1,
      step: "summary",
      label: "Audit saved — ready to review",
      progress: 100,
      at: new Date().toISOString(),
    },
  ],
};
if (state === "empty" && result.snapshot) result.snapshot.state = "ready";

// Block all API calls outside this fixture. No real credentials or cloud requests.
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    location.origin,
  );
  const fixtureProposal = {
    id: proposalId,
    scan_id: scanId,
    finding_id: finding.id,
    revision: 1,
    status: proposalPublished ? "published" : "proposed",
    expires_at: "2026-11-20T00:00:00Z",
    metadata: {
      title: "Use parameterized database queries",
      explanation:
        "Bind the request value as a query parameter rather than interpolating it into SQL.",
      repository: "fixture/security-demo",
      branch: "main",
      commit_sha: "a".repeat(40),
      tests: [
        "Confirm normal lookups still return the expected user.",
        "Confirm SQL control characters are treated as data.",
      ],
      assumptions: ["The database client supports query parameters."],
    },
    diff: "--- a/src/server.ts\n+++ b/src/server.ts\n@@ -1 +1 @@\n-const rows = database.query(`SELECT * FROM users WHERE id = ${id}`);\n+const rows = database.query('SELECT * FROM users WHERE id = ?', [id]);\n",
    checks: proposalValidated ? [{ path: "src/server.ts", status: "passed" }] : null,
    operation: proposalPublished
      ? {
          url: "https://github.com/fixture/security-demo/pull/1",
          branch: "archon/fix-fixture",
          commit: "b".repeat(40),
        }
      : {},
  };
  const json = (value: unknown) =>
    new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
  if (url.pathname === "/api/v1/github/capabilities")
    return json({
      enabled: state !== "github-disabled",
      publishing: true,
      reason: "GitHub App setup is required. ZIP audits remain available.",
      install_url: "https://github.com/apps/archon-fixture/installations/new",
    });
  if (url.pathname === "/api/v1/github/connection")
    return json({ connected: true, login: "fixture-user" });
  if (url.pathname === "/api/v1/github/repositories")
    return json(
      url.searchParams.has("installation_id")
        ? {
            repositories: [{ id: 123, full_name: "fixture/security-demo", private: true }],
            total_count: 1,
          }
        : { installations: [{ id: 456, account: { login: "fixture-user" } }] },
    );
  if (url.pathname.endsWith("/repositories"))
    return json([
      {
        id: integrationId,
        full_name: "fixture/security-demo",
        repository_id: 123,
        installation_id: 456,
      },
    ]);
  if (url.pathname.endsWith("/branches"))
    return json([{ name: "main", commit: { sha: "a".repeat(40) } }]);
  if (url.pathname.endsWith("/repository-scans"))
    return json({
      items: [
        {
          id: scanId,
          target_name: "Security demo",
          status: "completed",
          created_at: "2026-10-20T10:00:00Z",
        },
      ],
      total: 1,
    });
  if (url.pathname.endsWith("/fix-proposals"))
    return json(
      init?.method === "POST" ? { id: proposalId } : { items: [fixtureProposal], total: 1 },
    );
  if (url.pathname === `/api/v1/fix-proposals/${proposalId}`) return json(fixtureProposal);
  if (url.pathname.endsWith("/validate")) {
    proposalValidated = true;
    return json({ checks: [{ path: "src/server.ts", status: "passed" }] });
  }
  if (url.pathname.endsWith("/publish")) {
    proposalPublished = true;
    return json({ url: "https://github.com/fixture/security-demo/pull/1" });
  }
  if (url.pathname.endsWith("/github-status"))
    return json({
      state: "open",
      merged: false,
      checks: [{ name: "Unit tests", status: "completed", conclusion: "success" }],
      statuses: [],
    });
  if (url.pathname === "/api/v1/ai/capabilities")
    return new Response(JSON.stringify({ available: state !== "unavailable" }), {
      headers: { "Content-Type": "application/json" },
    });
  if (url.pathname === "/api/v1/ai/chat") {
    const payload = JSON.parse(String(init?.body));
    metrics.advisorRequests++;
    metrics.advisorModel = payload.model;
    metrics.advisorContext = payload.context || null;
    showMetrics();
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const signal = init?.signal;
    const abort = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      metrics.advisorCancellations++;
      showMetrics();
    };
    return new Response(
      new ReadableStream({
        start(controller) {
          signal?.addEventListener("abort", abort, { once: true });
          timer = setTimeout(
            () => {
              if (stopped) return;
              stopped = true;
              signal?.removeEventListener("abort", abort);
              controller.enqueue(
                encoder.encode(
                  'data: {"choices":[{"delta":{"content":"Fixture suggestion: review and test the change."}}]}\n\ndata: [DONE]\n\n',
                ),
              );
              controller.close();
            },
            state === "slow" ? 10000 : 800,
          );
        },
        cancel() {
          abort();
          signal?.removeEventListener("abort", abort);
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  }
  if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
    let body: unknown = { status: "healthy" };
    let status = 200;
    const activeFiles = files.map((file, index) => ({
      ...file,
      preview_state: running() && index === 1 ? "pending" : file.preview_state,
    }));
    const activeFindings = running() ? [] : result.findings;
    const current = {
      ...result,
      scan: { ...result.scan, status: running() ? "running" : "completed" },
      snapshot: result.snapshot
        ? {
            ...result.snapshot,
            state: state === "indexing" && !running() ? "ready" : result.snapshot.state,
          }
        : null,
      findings: activeFindings,
      job_status: running() ? "running" : "completed",
      counts: {
        total: activeFindings.length,
        severity: {
          high: activeFindings.filter((f) => f.severity === "high").length,
          medium: activeFindings.filter((f) => f.severity === "medium").length,
        },
        files: running() ? {} : { [fileId]: 1, [secondFileId]: 1 },
        previews: { ready: running() ? 1 : 2, pending: running() ? 1 : 0, total: 3 },
      },
      events: running()
        ? [
            {
              ...result.events[0],
              progress: 35,
              label: "Reviewing source with static rules and AI",
            },
          ]
        : result.events,
    };
    const sourceFor = (id: string) => ({
      id,
      revision: 1,
      start_line: 1,
      end_line: id === secondFileId ? 2 : 13,
      total_lines: id === secondFileId ? 2 : 13,
      language: "typescript",
      redacted: id === secondFileId,
      content: id === secondFileId ? 'export const apiKey = "****************";\n' : source,
    });
    if (url.pathname.endsWith("/capabilities")) body = capabilities;
    else if (url.pathname.endsWith("/bootstrap"))
      body = {
        ...current,
        files: { items: activeFiles, total: files.length },
        finding_page: { items: activeFindings, total: activeFindings.length },
        initial_source: state === "ready" || state === "indexing" ? sourceFor(fileId) : null,
        bootstrap_seconds: 0.08,
      };
    else if (url.pathname.endsWith("/workbench/status")) body = current;
    else if (url.pathname.endsWith("/workbench/findings")) {
      const severity = url.searchParams.get("severity") || "all";
      const search = (url.searchParams.get("q") || "").toLowerCase();
      const filtered = activeFindings.filter(
        (f) =>
          (severity === "all" || f.severity === severity) &&
          [f.title, f.file_path, f.description].some((v) => v.toLowerCase().includes(search)),
      );
      body = { items: filtered, total: filtered.length };
    } else if (url.pathname.includes("/workbench/findings/")) {
      const selected = result.findings.find((f) => url.pathname.endsWith(f.id))!;
      body = {
        finding: selected,
        file: activeFiles.find((f) => f.id === selected.location.file_id),
      };
    } else if (url.pathname.endsWith("/workbench")) {
      body = result;
      if (state === "denied") {
        status = 404;
        body = { detail: "Scan not found" };
      }
    } else if (url.pathname.endsWith("/source/files")) {
      const selected = activeFiles.filter((f) =>
        f.path.toLowerCase().includes((url.searchParams.get("q") || "").toLowerCase()),
      );
      body = { items: selected, total: selected.length };
    } else if (url.pathname.includes("/source/files/")) {
      metrics.sourceDownloads++;
      showMetrics();
      const config = url.pathname.endsWith(secondFileId);
      body = {
        id: config ? secondFileId : fileId,
        revision: 1,
        start_line: 1,
        end_line: config ? 2 : 13,
        total_lines: config ? 2 : 13,
        language: "typescript",
        redacted: config,
        content: config ? 'export const apiKey = "****************";\n' : source,
      };
    }
    if (state === "denied" && !url.pathname.endsWith("/capabilities")) {
      status = 404;
      body = { detail: "Scan not found" };
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (url.origin !== location.origin)
    throw new Error("External requests are disabled in this fixture");
  return nativeFetch(input, init);
};
const capabilities = {
  enabled: true,
  progressive_workbench: progressive,
  reason: null,
  retention_hours: 720,
  max_zip_bytes: 50 * 1048576,
};
function Upload() {
  return (
    <AuditUpload
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      role={workspace.role}
      settings={workspace.settings}
      capabilities={capabilities}
    />
  );
}
function Workbench() {
  return <AuditWorkbench workspaceId={workspace.id} scanId={scanId} />;
}
function Preview() {
  if (view === "settings") return <WorkspaceSettingsPage workspaceId={workspace.id} />;
  if (view === "landing") return <Landing />;
  if (view === "profile") return <Profile />;
  if (view === "graph") return <Graph />;
  return view === "upload" ? (
    <Upload />
  ) : view === "scan" ? (
    <main className="mx-auto max-w-5xl p-6">
      <ScanAnimation
        progress={62}
        elapsed={42}
        name="Fixture project"
        events={[
          {
            sequence: 1,
            step: "finding",
            label: "Reviewing supported source files",
            progress: 62,
            at: new Date().toISOString(),
          },
        ]}
      />
    </main>
  ) : (
    <Workbench />
  );
}
const root = createRootRoute({
  component: () => (
    <>
      <div className="border-b border-border bg-card px-4 py-2 text-xs">
        Isolated UI test · fixture data only ·{" "}
        <a href="?view=workbench" className="underline">
          Workbench
        </a>{" "}
        ·{" "}
        <a href="?view=upload" className="underline">
          Upload
        </a>{" "}
        ·{" "}
        <a href="?view=scan" className="underline">
          Scan animation
        </a>
      </div>
      <Outlet />
      <output
        id="workbench-test-metrics"
        className="block break-all p-3 font-mono text-xs"
        aria-label="Workbench fixture performance"
      />
    </>
  ),
});
const home = createRoute({ getParentRoute: () => root, path: "/", component: Preview });
const upload = createRoute({ getParentRoute: () => root, path: "/workspace", component: Upload });
const workbench = createRoute({
  getParentRoute: () => root,
  path: "/workspace/$workspaceId/scans/$scanId/workbench",
  component: Workbench,
});
const app = createRoute({ getParentRoute: () => root, id: "_app", component: Outlet });
const advisor = createRoute({ getParentRoute: () => app, path: "/advisor", component: Advisor });
const fixes = createRoute({
  getParentRoute: () => app,
  path: "/fix-verification",
  component: FixVerification,
  validateSearch: FixRoute.options.validateSearch,
});
const router = createRouter({
  routeTree: root.addChildren([home, upload, workbench, app.addChildren([advisor, fixes])]),
  history: createMemoryHistory({
    initialEntries: [
      view === "advisor"
        ? options.get("context") === "finding"
          ? `/advisor?workspaceId=${workspace.id}&scanId=${scanId}&findingId=${finding.id}`
          : "/advisor"
        : view === "fixes"
          ? `/fix-verification?scanId=${scanId}&findingId=${finding.id}`
          : "/",
    ],
  }),
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AiChatProvider>
      <RouterProvider router={router} />
    </AiChatProvider>
  </QueryClientProvider>,
);
