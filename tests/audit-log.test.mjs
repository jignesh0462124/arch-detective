import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({
  stdin: { contents: 'export * from "./src/lib/api/auditEvents.ts";', resolveDir: process.cwd() },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  plugins: [
    {
      name: "audit-supabase-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^\.\.\/supabase$/ }, () => ({
          path: "sdk",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "export const supabase = { from: (table) => globalThis.auditFixture(table) };",
        }));
      },
    },
  ],
});
const api = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);

function mockQuery(result) {
  const calls = [];
  const query = { calls };
  for (const method of ["select", "eq", "like", "gte", "or", "order", "range"])
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  query.abortSignal = () => Promise.resolve(result);
  return query;
}

test("events stay workspace-scoped with exact totals, filters and database paging", async () => {
  const query = mockQuery({ data: [{ id: "event-1" }], count: 73, error: null });
  globalThis.auditFixture = (table) => {
    assert.equal(table, "audit_events");
    return query;
  };
  const result = await api.fetchAuditEvents({
    workspace_id: "workspace-1",
    category: "scans",
    since: "2026-10-01T00:00:00Z",
    search: "project.zip",
    offset: 50,
    limit: 50,
  });
  assert.equal(result.total, 73);
  assert.deepEqual(result.items, [{ id: "event-1" }]);
  assert.deepEqual(
    query.calls.find(([method]) => method === "eq"),
    ["eq", "workspace_id", "workspace-1"],
  );
  assert.deepEqual(
    query.calls.find(([method]) => method === "like"),
    ["like", "event_type", "scan.%"],
  );
  assert.deepEqual(
    query.calls.find(([method]) => method === "range"),
    ["range", 50, 99],
  );
  assert.match(query.calls.find(([method]) => method === "or")[1], /event_metadata->>target/);
});

test("database errors remain visible instead of becoming an empty Audit Log", async () => {
  globalThis.auditFixture = () =>
    mockQuery({ data: null, count: null, error: new Error("denied") });
  await assert.rejects(api.fetchAuditEvents({ workspace_id: "workspace-1" }), /denied/);
});

test("saved scans are queried separately from recorded events", async () => {
  const query = mockQuery({ data: [{ id: "scan-1" }], count: 51, error: null });
  globalThis.auditFixture = (table) => {
    assert.equal(table, "scans");
    return query;
  };
  const result = await api.fetchScanHistory("workspace-1", 25, 25);
  assert.equal(result.total, 51);
  assert.deepEqual(
    query.calls.find(([method]) => method === "range"),
    ["range", 25, 49],
  );
});
