import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// Exercise the real compatibility module with only its database dependency replaced.
const output = await build({
  stdin: {
    contents:
      'export * from "./src/lib/api/findings.ts"; export {setAuthOwner} from "./src/lib/authState.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  plugins: [
    {
      name: "isolated-database",
      setup(builder) {
        builder.onResolve({ filter: /^\.\/database$/ }, () => ({
          path: "db",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `
      export const dbFetchFindings = (...args) => globalThis.findingsFixture.read(...args);
      export const dbUpdateFindingState = (...args) => globalThis.findingsFixture.write(...args);
    `,
        }));
      },
    },
  ],
});
const api = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);
const scanId = "11111111-1111-4111-8111-111111111111";
const findingId = "22222222-2222-4222-8222-222222222222";
const overrideKey = "archon_findings_state_overrides_v1";
const stored = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  key: (index) => [...stored.keys()][index],
  get length() {
    return stored.size;
  },
};
globalThis.window.localStorage = globalThis.localStorage;
api.setAuthOwner("fixture");

test("persisted empty/error results cannot resurrect browser history", async () => {
  stored.set(
    "threatlens_codebase_audit_history_v1_old-workspace",
    JSON.stringify([
      { id: scanId, result: { findings: [{ id: findingId, title: "stale private evidence" }] } },
    ]),
  );
  globalThis.findingsFixture = { read: async () => [] };
  assert.deepEqual((await api.fetchFindings(scanId)).items, []);
  globalThis.findingsFixture.read = async () => {
    throw new Error("denied");
  };
  await assert.rejects(api.fetchFindings(scanId), /denied/);
});

test("database state wins over global overrides and distinct IDs survive", async () => {
  stored.set(overrideKey, JSON.stringify({ [findingId]: "resolved", Repeated: "accepted_risk" }));
  globalThis.findingsFixture.read = async () =>
    Array.from({ length: 1205 }, (_, n) => ({
      id: n === 0 ? findingId : `id-${n}`,
      title: "Repeated",
      state: "open",
      file_path: "same.py",
      line_number: 1,
    }));
  const all = await api.fetchFindings(scanId);
  assert.equal(all.total, 1205);
  assert.equal(all.items[0].state, "open");
  assert.equal(all.items[1].state, "open");
  const page = await api.fetchFindings(scanId, { offset: 1000, limit: 50 });
  assert.equal(page.total, 1205);
  assert.equal(page.items.length, 50);
  assert.equal(page.items[0].id, "id-1000");
});

test("triage scopes the database write and never writes local overrides on success/failure", async () => {
  const before = [...stored.entries()];
  const calls = [];
  globalThis.findingsFixture.write = async (...args) => calls.push(args);
  for (const state of ["resolved", "accepted_risk", "false_positive", "open"]) {
    await api.updateFindingState(scanId, findingId, state);
    assert.deepEqual(calls.at(-1), [findingId, state, scanId]);
  }
  assert.deepEqual([...stored.entries()], before);
  globalThis.findingsFixture.write = async () => {
    throw new Error("RLS denied");
  };
  await assert.rejects(api.updateFindingState(scanId, findingId, "resolved"), /RLS denied/);
  assert.deepEqual([...stored.entries()], before);
});

test("explicit non-database legacy audit remains readable without a server request", async () => {
  const id = "local-audit-fixture";
  stored.set(
    "archon:account:fixture:threatlens_codebase_audit_history_v1_fixture",
    JSON.stringify([{ id, result: { findings: [{ title: "Legacy issue", severity: "high" }] } }]),
  );
  globalThis.findingsFixture.read = async () => {
    throw new Error("should not query database");
  };
  const result = await api.fetchFindings(id);
  assert.equal(result.items[0].title, "Legacy issue");
});
