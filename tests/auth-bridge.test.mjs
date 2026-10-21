import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
test("one SDK bridge preserves verified recovery arriving before React mounts", async () => {
  let subscriptions = 0,
    callback;
  const session = { user: { id: "fixture" } };
  globalThis.window = { location: { href: "https://archon.test/reset-password" } };
  globalThis.bridgeFixture = {
    auth: {
      onAuthStateChange: (fn) => {
        subscriptions++;
        callback = fn;
        fn("PASSWORD_RECOVERY", session);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
  const result = await build({
    entryPoints: ["src/lib/supabase.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    define: { "import.meta.env": "{}", "import.meta.hot": "undefined" },
    plugins: [
      {
        name: "sdk-bridge-fixture",
        setup(builder) {
          builder.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({
            path: "sdk",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents: "export const createClient = () => globalThis.bridgeFixture;",
          }));
        },
      },
    ],
  });
  const api = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
  );
  const first = [],
    second = [];
  const unsubscribe = api.observeAuth((...args) => first.push(args));
  api.observeAuth((...args) => second.push(args));
  assert.equal(subscriptions, 1);
  assert.equal(first[0][0], "PASSWORD_RECOVERY");
  unsubscribe();
  callback("SIGNED_OUT", null);
  assert.equal(first.length, 1);
  assert.equal(second.at(-1)[0], "SIGNED_OUT");
  const late = [];
  api.observeAuth((...args) => late.push(args));
  assert.equal(late.length, 0);
});
