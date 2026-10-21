import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { unzipSync, strFromU8 } from "fflate";

async function bundle(entry) {
  const result = await build({
    stdin: {
      contents: `export * from "./${entry}"; export {setAuthOwner} from "./src/lib/authState.ts";`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    define: { "import.meta.env": "{}" },
    plugins: [
      {
        name: "fixtures",
        setup(builder) {
          builder.onResolve({ filter: /^(\.\/api\/client|\.\/client)$/ }, () => ({
            path: "client",
            namespace: "fixture",
          }));
          builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({
            path: "supabase",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
            contents:
              path === "client"
                ? `export class ApiError extends Error { constructor(status, message) {super(message); this.status=status;} } export const apiClient = (...args) => globalThis.reportFixture.request(...args);`
                : `export const supabase = {auth: {getSession: async () => globalThis.reportFixture.session()}};`,
          }));
        },
      },
    ],
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
  );
}
const api = await bundle("src/lib/api/reports.ts");
const exporter = await bundle("src/lib/reportExport.ts");
const items = Array.from({ length: 8 }, (_, n) => ({
  id: `scan-${n}`,
  target_name: "../same/project",
}));
const signal = () => new AbortController().signal;

test("ZIP includes more than five reports and collision-safe filenames", async () => {
  let authorized = 0;
  const progress = [];
  const result = await exporter.buildReportZip(
    items,
    async (id) => new Blob([`%PDF-${id}`]),
    async () => authorized++,
    signal(),
    (done, total) => progress.push([done, total]),
  );
  const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
  assert.equal(Object.keys(files).length, 9);
  assert.equal(result.succeeded, 8);
  assert.equal(authorized, 2);
  assert.deepEqual(progress.at(-1), [8, 8]);
  assert.ok(Object.keys(files).every((name) => !name.includes("/") && !name.includes("..")));
  assert.equal(JSON.parse(strFromU8(files["manifest.json"])).reports.length, 8);
});
test("ZIP ordinary failures are explicit, all-failed/empty/oversized selections reject", async () => {
  const result = await exporter.buildReportZip(
    items,
    async (id) => {
      if (id === "scan-2") throw new Error("unavailable");
      return new Blob(["%PDF-ok"]);
    },
    async () => {},
    signal(),
    () => {},
  );
  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 7);
  const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
  assert.match(strFromU8(files["manifest.json"]), /failed/);
  await assert.rejects(
    exporter.buildReportZip(
      items,
      async () => {
        throw new Error("failed");
      },
      async () => {},
      signal(),
      () => {},
    ),
    /No PDFs/,
  );
  for (const invalid of [[], Array(21).fill(items[0]), [items[0], items[0]]])
    await assert.rejects(
      exporter.buildReportZip(
        invalid,
        async () => new Blob(),
        async () => {},
        signal(),
        () => {},
      ),
      /distinct reports/,
    );
});
test("ZIP cancellation and revoked access discard the archive", async () => {
  const controller = new AbortController();
  await assert.rejects(
    exporter.buildReportZip(
      items,
      async () => {
        controller.abort();
        return new Blob(["%PDF-ok"]);
      },
      async () => {},
      controller.signal,
      () => {},
    ),
  );
  let calls = 0;
  await assert.rejects(
    exporter.buildReportZip(
      items,
      async () => new Blob(["%PDF-ok"]),
      async () => {
        if (++calls === 2) throw new Error("access revoked");
      },
      signal(),
      () => {},
    ),
    /access revoked/,
  );
});
test("ZIP byte limit never silently omits a selected report", async () => {
  await assert.rejects(
    exporter.buildReportZip(
      items,
      async () => ({ size: exporter.ZIP_MAX_BYTES + 1 }),
      async () => {},
      signal(),
      () => {},
    ),
    /exceed 50 MiB/,
  );
});
test("saved reports never read browser fallback or write fake records", async () => {
  globalThis.window = {};
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("must not consult local evidence");
    },
  };
  globalThis.reportFixture = {
    request: async () => {
      throw new Error("denied");
    },
  };
  await assert.rejects(
    api.getReportLibrary("workspace", { q: "", framework: "all" }, null),
    /denied/,
  );
  await assert.rejects(api.getReportPreview("workspace", "scan"), /denied/);
});

test("malformed legacy storage is isolated and persisted UUIDs cannot become legacy reports", () => {
  globalThis.localStorage = {
    getItem: () =>
      JSON.stringify([
        null,
        4,
        {},
        { id: "rep_a", scan_id: "11111111-1111-4111-8111-111111111111", result: { findings: [] } },
        {
          id: "rep_b",
          scan_id: "scan_legacy",
          target_name: { invalid: true },
          result: { findings: [] },
        },
      ]),
  };
  globalThis.window.localStorage = globalThis.localStorage;
  api.setAuthOwner("fixture");
  const legacy = api.loadLegacyReports("workspace");
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].target_name, "Local audit");
});
test("private PDF sends workspace/framework scope and validates MIME and bytes", async () => {
  globalThis.reportFixture = {
    session: async () => ({ data: { session: { access_token: "synthetic-token" } }, error: null }),
  };
  let requested;
  globalThis.fetch = async (url, options) => {
    requested = { url, options };
    return new Response("%PDF-fixture", { headers: { "content-type": "application/pdf" } });
  };
  assert.equal(
    await (await api.fetchReportPdf("workspace", "scan", signal(), ["soc2"])).text(),
    "%PDF-fixture",
  );
  assert.match(requested.url, /workspace_id=workspace&frameworks=soc2/);
  assert.equal(requested.options.cache, "no-store");
  assert.equal(requested.options.headers.Authorization, "Bearer synthetic-token");
  globalThis.fetch = async () => new Response("html", { headers: { "content-type": "text/html" } });
  await assert.rejects(api.fetchReportPdf("workspace", "scan", signal()), /did not return a PDF/);
  globalThis.fetch = async () =>
    new Response("invalid", { headers: { "content-type": "application/pdf" } });
  await assert.rejects(api.fetchReportPdf("workspace", "scan", signal()), /invalid/);
  globalThis.fetch = async () => new Response("denied", { status: 403 });
  await assert.rejects(api.fetchReportPdf("workspace", "scan", signal()), (e) => e.status === 403);
});
