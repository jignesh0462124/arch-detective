import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const out = await build({
  entryPoints: ["src/lib/authState.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const auth = await import(
  `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`
);
const data = {};
const storage = {
  getItem: (k) => data[k] ?? null,
  setItem: (k, v) => {
    data[k] = v;
    Object.defineProperty(storage, k, { configurable: true, enumerable: true, value: v });
  },
  removeItem: (k) => {
    delete data[k];
    delete storage[k];
  },
};
globalThis.window = { localStorage: storage };
test("only recognized internal return destinations", () => {
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/login",
    "/reset-password",
    "/register",
    "/reports/../../login",
    "/reports/%2e%2e/login",
  ])
    assert.equal(auth.safeAuthDestination(value), "/dashboard", value);
  assert.equal(
    auth.safeAuthDestination("/reports/abc?framework=soc2"),
    "/reports/abc?framework=soc2",
  );
  assert.equal(auth.safeAuthDestination("/workspace?reportScan=123"), "/workspace?reportScan=123");
});
test("retained history isolated across users and stale callbacks", () => {
  storage.setItem("threatlens_codebase_audit_v1_global", "unowned private audit");
  auth.setAuthOwner("alice");
  assert.equal(auth.accountStorage.getItem("threatlens_codebase_audit_v1_global"), null);
  const alice = auth.privateStorage();
  alice.setItem("audit", "alice evidence");
  auth.setAuthOwner("bob");
  assert.equal(auth.accountStorage.getItem("audit"), null);
  alice.setItem("late", "must not write");
  auth.accountStorage.setItem("audit", "bob evidence");
  auth.setAuthOwner(null);
  assert.equal(auth.accountStorage.getItem("audit"), null);
  auth.setAuthOwner("alice");
  assert.equal(auth.accountStorage.getItem("audit"), "alice evidence");
  assert.equal(auth.accountStorage.getItem("late"), null);
  assert.equal(storage.getItem("threatlens_codebase_audit_v1_global"), "unowned private audit");
  assert.equal(auth.hasUnownedHistory(), true);
});
test("safe actionable errors never expose credentials or provider bodies", () => {
  assert.match(auth.authErrorMessage({ code: "invalid_credentials" }), /incorrect/);
  assert.match(auth.authErrorMessage({ code: "email_not_confirmed" }), /Verify/);
  assert.match(auth.authErrorMessage({ code: "over_email_send_rate_limit" }), /Wait/);
  assert.doesNotMatch(
    auth.authErrorMessage(new Error("secret-provider-body")),
    /secret-provider-body/,
  );
});
