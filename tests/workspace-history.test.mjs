import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({
  stdin: {
    contents: `export * from "./src/lib/workspaceSettings"; export * from "./src/lib/api/auditHistory"; export * from "./src/lib/api/auditDeletion"; export {dbFetchWorkspaces, dbUpdateWorkspace, dbDeleteWorkspace, dbFetchMembers, dbFetchPendingInvites, dbRemoveMember, dbRevokeInvite} from "./src/lib/api/database"; export {updateMemberRole} from "./src/lib/api/workspaces"; export {centeredGraphScroll} from "./src/lib/attackGraphView"; export {setAuthOwner} from "./src/lib/authState";`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  define: { "import.meta.env": "{}" },
  plugins: [
    {
      name: "isolated-sdk",
      setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({
          path: "sdk",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `export const supabase={from:(table)=>globalThis.sdk.from(table),auth:{getUser:async()=>({data:{user:{id:"actor"}},error:null})}};`,
        }));
      },
    },
  ],
});
const api = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);
let calls = [];
function fixture(responses) {
  calls = [];
  globalThis.sdk = {
    from(table) {
      const methods = [];
      const next = () => {
        calls.push({ table, methods });
        return Promise.resolve(responses[table]?.shift() ?? { data: [], error: null });
      };
      const query = new Proxy(
        {},
        {
          get(_, key) {
            if (key === "then") return (resolve, reject) => next().then(resolve, reject);
            if (key === "maybeSingle" || key === "single")
              return (...args) => {
                methods.push([key, ...args]);
                return next();
              };
            return (...args) => {
              methods.push([key, ...args]);
              return query;
            };
          },
        },
      );
      return query;
    },
  };
}
test("framework defaults normalize labels and IDs, reject unsupported inputs, and preserve other settings", () => {
  assert.deepEqual(
    api.normalizeAuditFrameworks([
      "SOC 2",
      "soc2",
      "ISO 27001",
      "pci_dss",
      "NIST CSF",
      "HIPAA",
      null,
    ]),
    ["soc2", "iso27001", "pci_dss", "nist_csf"],
  );
  const old = {
    default_frameworks: ["SOC 2"],
    retention_days: 365,
    notify_on_critical: true,
    extra: { keep: true },
  };
  assert.deepEqual(api.mergeAuditDefaults(old, ["gdpr"]), { ...old, default_frameworks: ["gdpr"] });
  assert.deepEqual(old.default_frameworks, ["SOC 2"]);
  assert.throws(() => api.mergeAuditDefaults(old, []), /at least one/);
});
test("validation and member guards protect owner, self and read-only roles", () => {
  assert.equal(api.validateWorkspaceDetails("Project", "project-1"), null);
  for (const slug of ["a", "-test", "test-", "a b"])
    assert.ok(api.validateWorkspaceDetails("Project", slug));
  assert.equal(api.validInviteEmail("person@example.test"), true);
  assert.equal(api.validInviteEmail("a b@example.test"), false);
  const member = { user_id: "member", role: "analyst" };
  for (const role of ["owner", "admin"])
    assert.equal(api.canManageMember(role, "owner", "actor", member), true);
  for (const role of ["analyst", "viewer"])
    assert.equal(api.canManageMember(role, "owner", "actor", member), false);
  assert.equal(
    api.canManageMember("admin", "owner", "actor", { user_id: "owner", role: "analyst" }),
    false,
  );
  assert.equal(
    api.canManageMember("admin", "owner", "actor", { user_id: "actor", role: "admin" }),
    false,
  );
});
test("history uses exact database pagination/filtering without downloading findings or sources", async () => {
  fixture({
    workspaces: [{ data: { id: "ws" }, error: null }],
    scans: [{ data: [{ id: "scan" }], count: 1001, error: null }],
  });
  const result = await api.getAuditHistoryPage(
    "ws",
    { q: "project%_", status: "completed", offset: 20 },
    new AbortController().signal,
  );
  assert.equal(result.total, 1001);
  assert.equal(result.items.length, 1);
  const query = calls.find((c) => c.table === "scans").methods;
  assert.ok(query.some((m) => m[0] === "range" && m[1] === 20 && m[2] === 39));
  assert.ok(query.some((m) => m[0] === "select" && m[2].count === "exact"));
  assert.ok(query.some((m) => m[0] === "eq" && m[1] === "workspace_id" && m[2] === "ws"));
  assert.ok(query.some((m) => m[0] === "eq" && m[1] === "scan_type" && m[2] === "codebase"));
  assert.ok(query.some((m) => m[0] === "ilike" && m[2] === "%project\\%\\_%"));
  assert.equal(
    calls.some((c) => c.table === "findings"),
    false,
  );
});
test("history distinguishes denied scope, failed requests, missing totals and true zero results", async () => {
  fixture({ workspaces: [{ data: null, error: null }] });
  await assert.rejects(
    api.getAuditHistoryPage(
      "ws",
      { q: "", status: "all", offset: 0 },
      new AbortController().signal,
    ),
    api.AuditHistoryAccessError,
  );
  fixture({
    workspaces: [{ data: { id: "ws" }, error: null }],
    scans: [{ data: null, error: { code: "offline" } }],
  });
  await assert.rejects(
    api.getAuditHistoryPage(
      "ws",
      { q: "", status: "all", offset: 0 },
      new AbortController().signal,
    ),
  );
  fixture({
    workspaces: [{ data: { id: "ws" }, error: null }],
    scans: [{ data: [], count: null, error: null }],
  });
  await assert.rejects(
    api.getAuditHistoryPage(
      "ws",
      { q: "", status: "all", offset: 0 },
      new AbortController().signal,
    ),
    /count/,
  );
  fixture({
    workspaces: [{ data: { id: "ws" }, error: null }],
    scans: [{ data: [], count: 0, error: null }],
  });
  assert.equal(
    (
      await api.getAuditHistoryPage(
        "ws",
        { q: "", status: "all", offset: 0 },
        new AbortController().signal,
      )
    ).total,
    0,
  );
});
test("zero-row mutations cannot report success and role changes cannot promote owners", async () => {
  for (const [table, operation] of [
    ["workspaces", () => api.dbUpdateWorkspace("ws", { name: "New name" })],
    ["workspaces", () => api.dbDeleteWorkspace("ws")],
    ["workspace_members", () => api.dbRemoveMember("ws", "member")],
    ["workspace_members", () => api.updateMemberRole("ws", "member", "viewer")],
    ["workspace_invites", () => api.dbRevokeInvite("invite", "ws")],
  ]) {
    fixture({ [table]: [{ data: null, error: null }] });
    await assert.rejects(operation(), /not (updated|deleted|removed|changed|revoked)/);
  }
  await assert.rejects(api.updateMemberRole("ws", "member", "owner"), /supported/);
});
test("member and invitation read failures propagate instead of becoming empty lists", async () => {
  fixture({ workspace_members: [{ error: { code: "42501" }, data: null }] });
  await assert.rejects(api.dbFetchMembers("ws"));
  fixture({ workspace_invites: [{ error: { code: "42501" }, data: null }] });
  await assert.rejects(api.dbFetchPendingInvites("ws"));
});
test("role/removal/revocation results are scoped and confirmed from returned rows", async () => {
  fixture({
    workspace_members: [
      { data: { user_id: "member", role: "viewer", created_at: "saved" }, error: null },
    ],
  });
  const result = await api.updateMemberRole("ws", "member", "viewer");
  assert.equal(result.created_at, "saved");
  assert.ok(calls[0].methods.some((m) => m[0] === "neq" && m[1] === "role" && m[2] === "owner"));
  fixture({ workspace_invites: [{ data: { id: "invite" }, error: null }] });
  await api.dbRevokeInvite("invite", "ws");
  assert.ok(
    calls[0].methods.some((m) => m[0] === "eq" && m[1] === "workspace_id" && m[2] === "ws"),
  );
});
test("centering uses canvas coordinates, existing scroll and clamps edges", () => {
  const view = {
    left: 100,
    top: 200,
    width: 400,
    height: 300,
    scrollLeft: 500,
    scrollTop: 100,
    scrollWidth: 1600,
    scrollHeight: 900,
  };
  assert.deepEqual(api.centeredGraphScroll(view, { left: 400, top: 400, width: 100, height: 80 }), {
    left: 650,
    top: 190,
  });
  assert.deepEqual(
    api.centeredGraphScroll(
      { ...view, scrollLeft: 0, scrollTop: 0 },
      { left: 100, top: 200, width: 40, height: 40 },
    ),
    { left: 0, top: 0 },
  );
  assert.deepEqual(
    api.centeredGraphScroll(view, { left: 4000, top: 4000, width: 100, height: 80 }),
    { left: 1200, top: 600 },
  );
});

test("startup reads workspace rows and roles in parallel under the same cancellation signal", async () => {
  const membership = Promise.withResolvers();
  const actor = new AbortController();
  fixture({
    workspace_members: [membership.promise],
    workspaces_with_counts: [
      {
        data: [{ id: "ws", name: "Shared project", owner_user_id: "other", scan_count: 7 }],
        error: null,
      },
    ],
  });
  const read = api.dbFetchWorkspaces(actor.signal);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.map((call) => call.table).sort(), [
    "workspace_members",
    "workspaces_with_counts",
  ]);
  const signals = calls.map(
    ({ methods }) => methods.find(([method]) => method === "abortSignal")[1],
  );
  assert.equal(signals[0], signals[1]);
  membership.resolve({ data: [{ workspace_id: "ws", role: "analyst" }], error: null });
  const [workspace] = await read;
  assert.equal(workspace.role, "analyst");
  assert.equal(workspace.scan_count, 7);
  actor.abort();
  assert.equal(signals[0].aborted, true);
});

test("an aborted startup read doesn't run the compatibility fallback", async () => {
  const view = Promise.withResolvers();
  const abort = new AbortController();
  fixture({ workspaces_with_counts: [view.promise] });
  const read = api.dbFetchWorkspaces(abort.signal);
  await new Promise((resolve) => setImmediate(resolve));
  abort.abort();
  view.resolve({ data: null, error: new Error("cancelled") });
  await assert.rejects(read, { name: "AbortError" });
  assert.equal(
    calls.some((call) => call.table === "workspaces"),
    false,
  );
});

test("successful workspace update returns the saved database state", async () => {
  const saved = {
    id: "ws",
    name: "Saved project",
    slug: "saved-project",
    owner_user_id: "actor",
    member_count: 2,
    scan_count: 3,
    settings: { default_frameworks: ["gdpr"], retention_days: 365 },
    created_at: "2026-10-01",
  };
  fixture({
    workspaces: [{ data: { id: "ws" }, error: null }],
    workspace_members: [{ data: [{ workspace_id: "ws", role: "owner" }], error: null }],
    workspaces_with_counts: [{ data: saved, error: null }],
  });
  assert.equal(
    (await api.dbUpdateWorkspace("ws", { name: "Saved project" })).name,
    "Saved project",
  );
  assert.ok(
    calls.some(
      (call) =>
        call.table === "workspaces" &&
        call.methods.some((method) => method[0] === "select" && method[1] === "id"),
    ),
  );
});

test("scan deletion is a single conditional RLS write, never cancellation", async () => {
  api.setAuthOwner("actor");
  fixture({ scans: [{ data: [{ id: "scan" }], error: null }] });
  assert.deepEqual(await api.deleteAuditHistoryScan("ws", "scan"), { scan_id: "scan" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, "scans");
  const methods = calls[0].methods;
  for (const method of [
    ["delete"],
    ["eq", "id", "scan"],
    ["eq", "workspace_id", "ws"],
    ["eq", "scan_type", "codebase"],
    ["in", "status", ["completed", "failed"]],
    ["select", "id"],
  ]) {
    assert.ok(
      methods.some((value) => JSON.stringify(value) === JSON.stringify(method)),
      JSON.stringify(method),
    );
  }
});

test("zero-row, denied, duplicate and revoked deletions cannot report success", async () => {
  api.setAuthOwner("actor");
  for (const response of [
    { data: [], error: null },
    { data: [{ id: "other" }], error: null },
    { data: null, error: { code: "42501" } },
    { data: null, error: { code: "offline" } },
  ]) {
    fixture({ scans: [response] });
    await assert.rejects(api.deleteAuditHistoryScan("ws", "scan"), api.AuditScanDeleteError);
  }
  fixture({
    scans: [
      { data: [{ id: "scan" }], error: null },
      { data: [], error: null },
    ],
  });
  await api.deleteAuditHistoryScan("ws", "scan");
  await assert.rejects(api.deleteAuditHistoryScan("ws", "scan"), api.AuditScanDeleteError);
  api.setAuthOwner(null);
  await assert.rejects(api.deleteAuditHistoryScan("ws", "scan"), /Sign in/);
});

test("deletion keeps other users/workspaces/scan caches and corrects last-page offset", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  const client = new QueryClient();
  api.setAuthOwner("actor");
  for (const key of [
    ["source-window", "actor", "ws", "scan"],
    ["report", "actor", "ws", "scan"],
    ["finding-queue", "actor", "ws", "scan"],
    ["dashboard-findings", "actor", "ws", "scan"],
    ["dashboard-findings", "actor", "other-ws", "scan"],
    ["scan", "scan", "actor"],
    ["findings", "scan", {}, "actor"],
    ["source-window", "other", "ws", "scan"],
    ["source-window", "actor", "other-ws", "scan"],
    ["source-window", "actor", "ws", "other-scan"],
    ["audit-history", "actor", "ws"],
    ["dashboard-scans", "actor", "ws", "latest"],
    ["dashboard-scans", "actor", "ws", "recent"],
    ["reports", "actor", "ws"],
    ["attack-graph-scans", "actor", "ws"],
  ])
    client.setQueryData(key, { fixture: true });
  await api.refreshAfterAuditDeletion(client, "actor", "ws", "scan");
  assert.equal(client.getQueryData(["source-window", "actor", "ws", "scan"]), undefined);
  assert.equal(client.getQueryData(["report", "actor", "ws", "scan"]), undefined);
  assert.equal(client.getQueryData(["dashboard-findings", "actor", "ws", "scan"]), undefined);
  assert.ok(client.getQueryData(["dashboard-findings", "actor", "other-ws", "scan"]));
  assert.equal(client.getQueryData(["scan", "scan", "actor"]), undefined);
  assert.equal(client.getQueryData(["findings", "scan", {}, "actor"]), undefined);
  assert.ok(client.getQueryData(["source-window", "other", "ws", "scan"]));
  assert.ok(client.getQueryData(["source-window", "actor", "other-ws", "scan"]));
  assert.ok(client.getQueryData(["source-window", "actor", "ws", "other-scan"]));
  for (const prefix of ["audit-history", "reports", "attack-graph-scans"])
    assert.equal(client.getQueryState([prefix, "actor", "ws"]).isInvalidated, true);
  for (const area of ["latest", "recent"])
    assert.equal(
      client.getQueryState(["dashboard-scans", "actor", "ws", area]).isInvalidated,
      true,
    );
  assert.equal(api.historyOffsetAfterDelete(20, 21, 20), 0);
  assert.equal(api.historyOffsetAfterDelete(20, 22, 20), 20);
  assert.equal(api.historyOffsetAfterDelete(40, 41, 20), 20);
  assert.equal(api.historyOffsetAfterDelete(0, 1, 20), 0);
  client.clear();
});

test("a late delete response is discarded after account switching", async () => {
  api.setAuthOwner("actor");
  let release, signal;
  const query = new Proxy(
    {},
    {
      get(_, method) {
        if (method === "then")
          return (resolve) =>
            new Promise((done) => {
              release = () => done({ data: [{ id: "scan" }], error: null });
            }).then(resolve);
        return (...args) => {
          if (method === "abortSignal") signal = args[0];
          return query;
        };
      },
    },
  );
  globalThis.sdk = { from: () => query };
  const pending = api.deleteAuditHistoryScan("ws", "scan");
  await new Promise((resolve) => setTimeout(resolve, 0));
  api.setAuthOwner("another-account");
  assert.equal(signal.aborted, true);
  release();
  await assert.rejects(pending, /Account changed/);
});
