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
import { ReportsLibraryPage } from "../../src/routes/_app/reports";
import { ReportDetailPage } from "../../src/routes/_app/reports.$reportId";
import { workspace } from "./hooks";
import "../../src/styles.css";
const options = new URLSearchParams(location.search);
document.documentElement.dataset.theme = options.get("theme") || "light";
localStorage.setItem("archon-theme", options.get("theme") || "light");
const scenario = options.get("scenario") || "default";
const id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
const scans = Array.from({ length: scenario === "empty" ? 0 : 31 }, (_, n) => ({
  id: id(n),
  workspace_id: workspace.id,
  target_name:
    n === 0
      ? "Payments service / production / very-long-project-name-for-mobile-layout"
      : `Project ${n}`,
  status: "completed",
  created_at: "2026-10-18T12:00:00Z",
  completed_at: "2026-10-18T12:00:00Z",
  selected_frameworks: ["soc2", "gdpr"],
  framework_scores: { soc2: 0 },
  counts: { total: 120, severity: { critical: 10, high: 20, medium: 30, low: 60 } },
  frameworks: ["soc2", "gdpr"],
  summary: {
    summary:
      "The saved audit identified input-validation issues. Review high-severity evidence before deployment.",
    top_priorities: ["Validate user-controlled input", "Remove embedded secrets"],
  },
  analysis: {
    mode: "static_and_ai",
    files_scanned: 90,
    files_truncated: 2,
    limitations: ["AI inspects a sampled context; not the entire archive."],
  },
  coverage: {},
  exclusions: [],
}));
const findings = Array.from({ length: 120 }, (_, n) => ({
  id: id(1000 + n),
  scan_id: id(0),
  title: `Finding ${n + 1}: Unsafe input`,
  severity: n % 2 ? "high" : "medium",
  state: "open",
  file_path: `src/very-long-service-name/controllers/payments/${"long-path/".repeat(4)}handler.ts`,
  line_number: n + 1,
  cvss_score: 0,
  source: "static-rule",
  description: "Untrusted input reaches a sensitive operation.",
  code_snippet: "const value = request.query.input;",
  remediation: "Validate input and use parameterized operations.",
  violations: [
    { framework: "soc2", control_id: "CC6.1", control_title: "Logical access controls" },
  ],
}));
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    location.href,
  );
  if (url.pathname === "/health") return Response.json({ status: "healthy" });
  if (!url.pathname.startsWith("/api/v1/")) return nativeFetch(input, init);
  if (scenario === "error") return Response.json({}, { status: 503 });
  if (scenario === "denied") return Response.json({}, { status: 404 });
  if (url.pathname.endsWith("/workbench/report"))
    return new Response("%PDF-isolated-fixture", {
      headers: { "content-type": "application/pdf" },
    });
  if (/\/findings\/[^/]+$/.test(url.pathname))
    return Response.json({
      finding: findings.find((f) => f.id === url.pathname.split("/").at(-1)),
      file: null,
    });
  if (url.pathname.endsWith("/findings")) {
    const offset = Number(url.searchParams.get("offset") || 0);
    return Response.json({
      items: findings.slice(offset, offset + 50),
      total: findings.length,
      offset,
      limit: 50,
    });
  }
  if (/report-library\/[^/]+$/.test(url.pathname))
    return Response.json(scans.find((s) => s.id === url.pathname.split("/").at(-1)) || {}, {
      status: scans.length ? 200 : 404,
    });
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const rows = scans.filter((s) => s.target_name.toLowerCase().includes(q) || s.id === q);
  const start = Number(url.searchParams.get("cursor") || 0);
  return Response.json({
    items: rows.slice(start, start + 25),
    total: rows.length,
    available_total: scans.length,
    limit: 25,
    next_cursor: start + 25 < rows.length ? String(start + 25) : null,
  });
};
const root = createRootRoute({
  component: () => (
    <>
      <div className="border-b border-border bg-card p-2 text-xs">
        Isolated Reports QA · synthetic data only
      </div>
      <Outlet />
    </>
  ),
});
const library = createRoute({
  getParentRoute: () => root,
  path: "/reports",
  component: ReportsLibraryPage,
});
const detail = createRoute({
  getParentRoute: () => root,
  path: "/reports/$reportId",
  component: () => {
    const { reportId } = detail.useParams();
    return <ReportDetailPage reference={reportId} />;
  },
});
const router = createRouter({
  routeTree: root.addChildren([library, detail]),
  history: createMemoryHistory({
    initialEntries: [options.get("detail") ? `/reports/${id(0)}` : "/reports"],
  }),
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
