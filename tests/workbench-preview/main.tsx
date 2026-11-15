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
  useSearch,
} from "@tanstack/react-router";
import { AuditWorkbench } from "../../src/components/audit-workbench/AuditWorkbench";
import { AuditUpload } from "../../src/components/audit-workbench/AuditUpload";
import { ScanAnimation } from "../../src/components/audit-workbench/ScanAnimation";
import { Route as ProfileRoute } from "../../src/routes/_app/profile";
import { Route as GraphRoute } from "../../src/routes/_app/attack-graph";
import { Route as AdvisorRoute } from "../../src/routes/_app/advisor";
import { Route as LandingRoute } from "../../src/routes/index";
import { Route as AboutRoute } from "../../src/routes/about";
import { Route as WorkbenchRoute } from "../../src/routes/workspace/$workspaceId/scans/$scanId/workbench";
import { Route as FixRoute } from "../../src/routes/_app/fix-verification";
import { Route as SettingsRoute } from "../../src/routes/_app/settings";
import { Route as ProtectedRoute } from "../../src/routes/_app";
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
const About = AboutRoute.options.component as ComponentType;
const fixtureChatId = "77777777-7777-4777-8777-777777777777";
let conversations = [
  {
    id: fixtureChatId,
    workspace_id: workspace.id,
    title: "Review database query parameters",
    scan_id: null,
    finding_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  },
];
const chatMessages: Record<
  string,
  { id: string; role: string; content: string; status: string; created_at: string }[]
> = {};
chatMessages[fixtureChatId] = [
  {
    id: crypto.randomUUID(),
    role: "user",
    content: "How should I bind a query parameter?",
    status: "completed",
    created_at: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    role: "assistant",
    content:
      "Bind the request value separately from SQL.\n\n```ts\nconst rows = database.query('SELECT id FROM users WHERE id = ?', [id]);\n```\n\nVerify normal lookups and confirm quotes are treated as data.",
    status: "completed",
    created_at: new Date().toISOString(),
  },
];
try {
  const cached = JSON.parse(sessionStorage.getItem("archon-fixture-conversations-v2") || "null");
  if (cached) {
    conversations = cached.conversations;
    Object.assign(chatMessages, cached.messages);
  }
} catch {
  /* Isolated fixture history only. */
}
const saveFixtureConversations = () =>
  sessionStorage.setItem(
    "archon-fixture-conversations-v2",
    JSON.stringify({ conversations, messages: chatMessages }),
  );
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
    source_config: options.get("extension") === "1" ? { review_kind: "extension" } : {},
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
          state: state.startsWith("solution-") ? "ready" : state,
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
const extensionNotes = new Map<string, string>();
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
  if (url.pathname.includes("extension-reviews")) {
    const policy = {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      store: "chrome",
      rule_id: "chrome.remote-code.script",
      category: "security",
      title: "Remote script reference",
      outcome: "violation",
      finding_id: null,
    };
    if (url.pathname.endsWith("/capabilities"))
      return json({
        enabled: state !== "extension-disabled",
        policy_version: "fixture",
        reason: "Extension review is awaiting setup. Project ZIP audits remain available.",
      });
    if (url.pathname.endsWith("extension-reviews") && init?.method === "POST")
      return json({ scan_id: scanId, status: "running" });
    if (url.pathname.endsWith("/annotation")) {
      const id = url.pathname.split("/").at(-2)!;
      extensionNotes.set(id, JSON.parse(String(init?.body)).note);
      return json({ note: extensionNotes.get(id) });
    }
    if (url.pathname.endsWith("/assets")) return json({ items: [] });
    if (url.pathname.includes("/compare/"))
      return json({
        items: [
          { category: "still_present", title: "Remote script reference", path: "src/server.ts" },
        ],
        total: 1,
        compatible: true,
        counts: { still_present: 1 },
        limitation: "This synthetic comparison has not changed any triage status.",
      });
    if (url.pathname.includes("/results/"))
      return json({
        ...policy,
        source_available: true,
        details: {
          path: "src/server.ts",
          line: 2,
          explanation: "An extension entrypoint references code outside the submitted package.",
          remedy: "Package the executable script locally and update the reference.",
          verification: "Test the feature and recheck the corrected ZIP.",
          evidence: '<script src="https://example.invalid/code.js"></script>',
          policy_url:
            "https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements",
          policy_version: "fixture",
          reviewed_at: "2026-11-05",
          method: "static",
          exceptions: "Isolated sandbox contexts need separate review.",
        },
        notice: {
          label: "Illustrative example — not a notice sent by Google or Microsoft",
          message: "A store review may request changes. This is not an actual rejection.",
          remedy: "Package executable logic locally.",
          notification_id: "Blue Argon",
          help_url: "https://developer.chrome.com/docs/webstore/troubleshooting",
          reference_available: true,
        },
        annotation: extensionNotes.has(url.pathname.split("/").at(-1)!)
          ? { note: extensionNotes.get(url.pathname.split("/").at(-1)!) }
          : null,
      });
    if (url.pathname.endsWith("/results")) {
      let rows = [
        policy,
        ...Array.from({ length: 64 }, (_, index) => ({
          ...policy,
          id: `cccccccc-cccc-4ccc-8ccc-${String(index).padStart(12, "0")}`,
          title: `Manual policy requirement ${index + 1}`,
          rule_id: `chrome.manual.${index}`,
          category: index % 2 ? "permissions" : "listing",
          outcome: "not_assessed",
        })),
      ];
      if (url.searchParams.get("area") === "permissions")
        rows = rows.filter((row) => row.category === "permissions");
      if (url.searchParams.has("outcome"))
        rows = rows.filter((row) => row.outcome === url.searchParams.get("outcome"));
      if (url.searchParams.get("store_filter") === "edge")
        rows = rows.map((row) => ({ ...row, store: "edge" }));
      const offset = Number(url.searchParams.get("offset") || 0);
      return json({ items: rows.slice(offset, offset + 50), total: rows.length });
    }
    if (url.pathname.endsWith("extension-reviews"))
      return json({
        items: [
          {
            scan_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            package_name: "Fixture extension",
            package_version: "0.9",
          },
        ],
        total: 1,
      });
    return json({
      scan_id: scanId,
      status: "completed",
      package_name: "Fixture extension",
      package_version: "1.0",
      manifest_version: 3,
      stores: ["chrome", "edge"],
      policy_version: "fixture",
      declarations: {
        purpose: "Read documents",
        permissions: "Access only the active tab",
        browser_settings: "No changes",
        data_use: "No data collected",
        advertising: "None",
        paid_features: "None",
        chrome: {
          description: "Review documents locally",
          privacy_text: "Data stays on the device",
          privacy_url: "https://example.invalid/privacy",
          screenshots_description: "Manual review required",
        },
        edge: {
          description: "Review documents locally",
          privacy_text: "Data stays on the device",
          privacy_url: "https://example.invalid/privacy",
          screenshots_description: "Manual review required",
        },
      },
      coverage: {
        total: 90,
        outcomes: { violation: 1, needs_review: 4, not_assessed: 83, passed: 2 },
        limitations: ["Static inspection only; store approval is not guaranteed."],
      },
    });
  }
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
    return new Response(
      JSON.stringify({ available: state !== "unavailable", history_available: true }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  if (url.pathname.startsWith("/api/v1/ai/conversations")) {
    const id = url.pathname.split("/")[5];
    const payload = init?.body ? JSON.parse(String(init.body)) : null;
    if (init?.method === "POST") {
      const item = {
        id: crypto.randomUUID(),
        workspace_id: workspace.id,
        title: payload.title,
        scan_id: payload.context?.scan_id || null,
        finding_id: payload.context?.finding_id || null,
        policy_result_id: payload.context?.policy_result_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      };
      conversations.unshift(item);
      chatMessages[item.id] = [];
      saveFixtureConversations();
      return json(item);
    }
    if (init?.method === "PATCH") {
      const item = conversations.find((c) => c.id === id)!;
      item.title = payload.title;
      saveFixtureConversations();
      return json(item);
    }
    if (init?.method === "DELETE") {
      conversations = conversations.filter((c) => c.id !== id);
      delete chatMessages[id];
      saveFixtureConversations();
      return json({ deleted: id });
    }
    if (url.pathname.endsWith("/messages"))
      return json({ items: [...(chatMessages[id] || [])].reverse(), next_cursor: null });
    if (id) return json(conversations.find((c) => c.id === id));
    return json({
      items: conversations.filter((c) =>
        c.title.toLowerCase().includes((url.searchParams.get("q") || "").toLowerCase()),
      ),
      next_cursor: null,
    });
  }
  if (url.pathname === "/api/v1/ai/chat") {
    const payload = JSON.parse(String(init?.body));
    metrics.advisorRequests++;
    if (state === "solution-reject" && metrics.advisorRequests > 1)
      return Response.json({}, { status: 503 });
    metrics.advisorModel = payload.model;
    metrics.advisorContext = payload.context || null;
    const question = payload.messages[payload.messages.length - 1].content;
    const answer =
      payload.code_solution && payload.context?.policy_result_id
        ? '## Assessment\nThe recorded entrypoint references a remote script; review the extension context and policy exceptions.\n## Suggested code\n```html\n<script src="./dist/local.js"></script>\n```\n## How to verify\n- Bundle the dependency in the package.\n- Load the rebuilt extension in an isolated browser.\n- Recheck the corrected ZIP.\n## Explanation and assumptions\nThis is a review suggestion; confirm the local bundle preserves the feature.'
        : payload.code_solution
          ? "## Assessment\nBind the request value separately from SQL.\n## Suggested code\n```ts\nconst rows = database.query('SELECT id FROM users WHERE id = ?', [id]);\n```\n## How to verify\n- Verify normal lookups.\n- Confirm quotes are treated as data.\n## Explanation and assumptions\nThe database client must support placeholders. This suggestion has not been tested."
          : "Bind the request value separately from SQL.\n\n```ts\nconst rows = database.query('SELECT id FROM users WHERE id = ?', [id]);\n```\n\nAssumption: the database client supports placeholders.\n\nVerify normal lookups and confirm quotes are treated as data.";
    if (payload.conversation_id)
      chatMessages[payload.conversation_id] = [
        ...(chatMessages[payload.conversation_id] || []),
        {
          id: crypto.randomUUID(),
          role: "user",
          content: question,
          status: "completed",
          created_at: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answer,
          status: "completed",
          created_at: new Date().toISOString(),
        },
      ];
    saveFixtureConversations();
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
                  `data: ${JSON.stringify({ choices: [{ delta: { content: state === "solution-truncated" ? "## Assessment\nPartial response.\n```js\nconst value =" : answer } }] })}\n\n${state === "solution-truncated" ? 'data: {"error":"response_truncated"}' : "data: [DONE]"}\n\n`,
                ),
              );
              controller.close();
            },
            state === "slow" || state === "solution-slow" ? 10000 : 800,
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
  const search = useSearch({ strict: false }) as { policyId?: string };
  return (
    <AuditWorkbench workspaceId={workspace.id} scanId={scanId} initialPolicyId={search.policyId} />
  );
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
const home = createRoute({
  getParentRoute: () => root,
  path: "/",
  component: view === "about" ? About : Preview,
});
const upload = createRoute({ getParentRoute: () => root, path: "/workspace", component: Upload });
const workbench = createRoute({
  getParentRoute: () => root,
  path: "/workspace/$workspaceId/scans/$scanId/workbench",
  validateSearch: WorkbenchRoute.options.validateSearch,
  component: Workbench,
});
const app = createRoute({
  getParentRoute: () => root,
  id: "_app",
  component: view === "preferences" ? ProtectedRoute.options.component : Outlet,
});
const advisor = createRoute({
  getParentRoute: () => app,
  path: "/advisor",
  component: Advisor,
  validateSearch: AdvisorRoute.options.validateSearch,
});
const fixes = createRoute({
  getParentRoute: () => app,
  path: "/fix-verification",
  component: FixVerification,
  validateSearch: FixRoute.options.validateSearch,
});
const settings = createRoute({
  getParentRoute: () => app,
  path: "/settings",
  component: SettingsRoute.options.component,
  validateSearch: SettingsRoute.options.validateSearch,
});
const router = createRouter({
  routeTree: root.addChildren([
    home,
    upload,
    workbench,
    app.addChildren([advisor, fixes, settings]),
  ]),
  history: createMemoryHistory({
    initialEntries: [
      view === "preferences"
        ? `/settings?section=${options.get("section") || "overview"}`
        : view === "advisor"
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
