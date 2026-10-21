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
import { FindingsPage } from "../../src/routes/_app/findings";
import { findings, olderScan, options, scanId, scenario, workspace } from "./data";
import "../../src/styles.css";

document.documentElement.dataset.theme = options.get("theme") || "light";
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    location.href,
  );
  if (url.pathname === "/health") return Response.json({ status: "healthy" });
  if (!url.pathname.startsWith("/api/v1/")) return originalFetch(input, init);
  const params = url.searchParams;
  if (scenario === "error") return Response.json({}, { status: 503 });
  if (scenario === "denied") return Response.json({}, { status: 404 });
  if (url.pathname.endsWith("finding-scans"))
    return Response.json({
      items:
        scenario === "no-scans"
          ? []
          : [
              {
                id: scanId,
                workspace_id: workspace.id,
                target_name: "Payments service",
                status: "completed",
                created_at: "2026-10-19T10:00:00Z",
              },
              {
                id: olderScan,
                workspace_id: workspace.id,
                target_name: "Earlier zero-finding scan",
                status: "completed",
                created_at: "2026-10-18T10:00:00Z",
              },
            ],
      total: 2,
      offset: 0,
      limit: 100,
    });
  const rows = url.pathname.includes(olderScan) ? [] : findings;
  if (url.pathname.endsWith("/counts"))
    return Response.json({
      total: rows.length,
      severity: Object.fromEntries(
        ["critical", "high", "medium", "low"].map((s) => [
          s,
          rows.filter((f) => f.severity === s).length,
        ]),
      ),
    });
  if (/\/findings\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/export"))
    return Response.json({
      finding: rows.find((f) => f.id === url.pathname.split("/").at(-1)),
      file: null,
    });
  const filtered = rows.filter(
    (f) =>
      (!params.get("severity") ||
        params.get("severity") === "all" ||
        f.severity === params.get("severity")) &&
      (!params.get("state") || params.get("state") === "all" || f.state === params.get("state")) &&
      (!params.get("q") ||
        `${f.title} ${f.description} ${f.file_path} ${f.cwe_id}`
          .toLowerCase()
          .includes(params.get("q")!.toLowerCase())),
  );
  if (url.pathname.endsWith("/export"))
    return new Response(JSON.stringify(filtered), {
      headers: { "content-type": "application/json" },
    });
  const offset = Number(params.get("offset") || 0);
  return Response.json({
    items: filtered.slice(offset, offset + 50),
    total: filtered.length,
    offset,
    limit: 50,
  });
};
const root = createRootRoute({
  component: () => (
    <>
      <div className="bg-card border-b border-border p-2 text-xs">
        Isolated Findings QA · synthetic data only
      </div>
      <Outlet />
    </>
  ),
});
const page = createRoute({
  getParentRoute: () => root,
  path: "/findings",
  component: FindingsPage,
});
const router = createRouter({
  routeTree: root.addChildren([page]),
  history: createMemoryHistory({ initialEntries: ["/findings"] }),
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
