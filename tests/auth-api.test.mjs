import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const output = await build({
  stdin: {
    contents:
      'export * from "./src/lib/api/auth.ts"; export * from "./src/lib/authState.ts"; export {apiClient} from "./src/lib/api/client.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  define: { "import.meta.env": "{}" },
  plugins: [
    {
      name: "auth-sdk-fixture",
      setup(builder) {
        builder.onResolve({ filter: /(?:^@\/lib\/supabase$|^\.\.\/supabase$)/ }, () => ({
          path: "sdk",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents:
            "export const isSupabaseConfigured = true; export const supabase = {auth: new Proxy({}, {get: (_, key) => (...args) => globalThis.sdkFixture[key](...args)})};",
        }));
      },
    },
  ],
});
const api = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);
globalThis.window = { location: { origin: "https://archon.example" }, dispatchEvent: () => {} };
test("local is default signout scope; global is explicit and failures reject", async () => {
  const scopes = [];
  globalThis.sdkFixture = {
    signOut: async (options) => {
      scopes.push(options.scope);
      return { error: null };
    },
  };
  await api.signOut();
  await api.signOut("global");
  assert.deepEqual(scopes, ["local", "global"]);
  globalThis.sdkFixture.signOut = async () => ({ error: new Error("offline") });
  await assert.rejects(api.signOut(), /offline/);
});
test("password unchanged; confirmation and reset use exact callback routes", async () => {
  const calls = {};
  globalThis.sdkFixture = Object.fromEntries(
    ["signInWithPassword", "signUp", "resend", "resetPasswordForEmail"].map((name) => [
      name,
      async (...args) => {
        calls[name] = args;
        return { data: {}, error: null };
      },
    ]),
  );
  await api.signIn("a@example.test", " short ");
  assert.equal(calls.signInWithPassword[0].password, " short ");
  await api.signUp("a@example.test", "new password", "A");
  assert.equal(calls.signUp[0].options.emailRedirectTo, "https://archon.example/login");
  await api.resendConfirmation("a@example.test");
  assert.equal(calls.resend[0].options.emailRedirectTo, "https://archon.example/login");
  await api.resetPassword("a@example.test");
  assert.equal(calls.resetPasswordForEmail[1].redirectTo, "https://archon.example/reset-password");
});
test("GitHub sign-in preserves the internal destination and rejects initiation failures", async () => {
  let request;
  globalThis.sdkFixture = {
    signInWithOAuth: async (options) => {
      request = options;
      return { error: null };
    },
  };
  await api.signInWithGitHub("/reports");
  assert.equal(request.provider, "github");
  assert.equal(request.options.redirectTo, "https://archon.example/login?next=%2Freports");
  await api.signInWithGitHub("https://untrusted.example");
  assert.equal(request.options.redirectTo, "https://archon.example/login?next=%2Fdashboard");
  globalThis.sdkFixture.signInWithOAuth = async () => ({ error: new Error("offline") });
  await assert.rejects(api.signInWithGitHub(), /offline/);
});

test("401 revalidates without replaying a mutation", async () => {
  let requests = 0,
    checks = 0;
  globalThis.sdkFixture = {
    getSession: async () => ({ data: { session: { access_token: "fixture" } }, error: null }),
    getUser: async () => {
      checks++;
      return { error: null };
    },
  };
  globalThis.fetch = async () => {
    requests++;
    return Response.json({}, { status: 401 });
  };
  await assert.rejects(api.apiClient("/mutation", { method: "POST", body: "{}" }), /401/);
  assert.equal(requests, 1);
  assert.equal(checks, 1);
});
test("valid session retries a safe read once with a refreshed token", async () => {
  const authorization = [];
  let refreshes = 0;
  globalThis.sdkFixture = {
    getSession: async () => ({ data: { session: { access_token: "old-token" } }, error: null }),
    getUser: async () => ({ error: null }),
    refreshSession: async () => {
      refreshes++;
      return { data: { session: { access_token: "new-token" } }, error: null };
    },
  };
  globalThis.fetch = async (_, init) => {
    authorization.push(init.headers.get("Authorization"));
    return authorization.length === 1
      ? Response.json({}, { status: 401 })
      : Response.json({ ok: true });
  };
  assert.deepEqual(await api.apiClient("/safe-read"), { ok: true });
  assert.deepEqual(authorization, ["Bearer old-token", "Bearer new-token"]);
  assert.equal(refreshes, 1);
});
test("a fresh valid session is not repeatedly refreshed for a backend 401", async () => {
  let requests = 0;
  let refreshes = 0;
  globalThis.sdkFixture = {
    getSession: async () => ({
      data: {
        session: { access_token: "fresh-token", expires_at: Math.floor(Date.now() / 1000) + 3600 },
      },
      error: null,
    }),
    getUser: async () => ({ error: null }),
    refreshSession: async () => {
      refreshes++;
      throw new Error("A fresh token must not be refreshed");
    },
  };
  globalThis.fetch = async () => {
    requests++;
    return Response.json({}, { status: 401 });
  };
  await assert.rejects(api.apiClient("/safe-read"), (error) => {
    assert.equal(error.status, 401);
    assert.equal(error.authCheck, "valid");
    return true;
  });
  assert.equal(requests, 1);
  assert.equal(refreshes, 0);
});
test("account changes abort active private requests and discard late responses", async () => {
  api.setAuthOwner("alice");
  let release, requestSignal;
  globalThis.fetch = async (_, init) => {
    requestSignal = init.signal;
    await new Promise((resolve) => {
      release = resolve;
    });
    return Response.json({ evidence: "private" });
  };
  const pending = api.apiClient("/private");
  await new Promise((resolve) => setTimeout(resolve, 0));
  api.setAuthOwner("bob");
  assert.equal(requestSignal.aborted, true);
  release();
  await assert.rejects(pending, /Account changed/);
});

test("safe read rereads SDK session after validation, without unnecessary refresh", async () => {
  api.setAuthOwner("current-user");
  let checked = false;
  const tokens = [];
  globalThis.sdkFixture = {
    getSession: async () => ({
      data: {
        session: {
          access_token: checked ? "already-refreshed" : "initial",
          expires_at: Date.now() / 1000 + 3600,
        },
      },
      error: null,
    }),
    getUser: async () => {
      checked = true;
      return { error: null };
    },
    refreshSession: async () => {
      throw Error("SDK already refreshed the token");
    },
  };
  globalThis.fetch = async (_, options) => {
    tokens.push(options.headers.get("Authorization"));
    return tokens.length === 1 ? Response.json({}, { status: 401 }) : Response.json({ ok: true });
  };
  assert.deepEqual(await api.apiClient("/safe"), { ok: true });
  assert.deepEqual(tokens, ["Bearer initial", "Bearer already-refreshed"]);
});

test("concurrent 401s share Auth validation and one refresh, without retry loops", async () => {
  let checks = 0,
    refreshes = 0,
    requests = 0,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  globalThis.sdkFixture = {
    getSession: async () => ({
      data: { session: { access_token: "concurrent-old" } },
      error: null,
    }),
    getUser: async () => {
      checks++;
      await gate;
      return { error: null };
    },
    refreshSession: async () => {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { data: { session: { access_token: "concurrent-new" } }, error: null };
    },
  };
  globalThis.fetch = async () => {
    requests++;
    return Response.json({}, { status: 401 });
  };
  const reads = Array.from({ length: 8 }, () =>
    api.apiClient("/concurrent").catch((error) => error),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  release();
  const results = await Promise.all(reads);
  assert.equal(checks, 1);
  assert.equal(refreshes, 1);
  assert.equal(requests, 16);
  assert.ok(results.every((error) => error.status === 401 && error.authCheck === "valid"));
});

test("Auth outages, denied accounts and backend 503 never announce session expiry", async () => {
  let announcements = 0,
    checks = 0,
    requests = 0;
  window.dispatchEvent = () => {
    announcements++;
  };
  for (const status of [403, 503]) {
    globalThis.sdkFixture = {
      getSession: async () => ({
        data: { session: { access_token: `status-${status}` } },
        error: null,
      }),
      getUser: async () => {
        checks++;
        return { error: { status } };
      },
    };
    globalThis.fetch = async () => {
      requests++;
      return Response.json({}, { status: 401 });
    };
    await assert.rejects(api.apiClient("/service"), (error) => error.authCheck === "unavailable");
  }
  globalThis.fetch = async () => {
    requests++;
    return Response.json({}, { status: 503 });
  };
  await assert.rejects(api.apiClient("/service"), (error) => error.status === 503);
  assert.equal(checks, 2);
  assert.equal(requests, 3);
  assert.equal(announcements, 0);
});

test("confirmed invalid Auth credentials expose Sign in without replaying deletion", async () => {
  let announcements = 0,
    requests = 0;
  window.dispatchEvent = () => {
    announcements++;
  };
  globalThis.sdkFixture = {
    getSession: async () => ({ data: { session: { access_token: "invalid" } }, error: null }),
    getUser: async () => ({ error: { status: 401 } }),
  };
  globalThis.fetch = async () => {
    requests++;
    return Response.json({}, { status: 401 });
  };
  await assert.rejects(
    api.apiClient("/delete", { method: "DELETE" }),
    (error) => error.authCheck === "invalid",
  );
  assert.equal(requests, 1);
  assert.equal(announcements, 1);
});
