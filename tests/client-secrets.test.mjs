import test from "node:test";
import assert from "node:assert/strict";
import { configuredSecrets, containsPrivateMaterial } from "../scripts/check-client-secrets.mjs";

test("client guard includes GitHub configuration, multiline keys and runtime credentials", () => {
  const fixture = [
    'GITHUB_CLIENT_SECRET="synthetic-client-secret"',
    "GITHUB_WEBHOOK_SECRET=synthetic-webhook-secret",
    "GITHUB_TOKEN_ENCRYPTION_KEY='synthetic-encryption-key'",
    'GITHUB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nsynthetic-key-body\n-----END PRIVATE KEY-----"',
    "VITE_SUPABASE_PUBLISHABLE_KEY=public-publishable-key",
  ].join("\n");
  const secrets = configuredSecrets(fixture, { GROQ_API_KEY: "synthetic-runtime-key" });
  for (const value of [
    "synthetic-client-secret",
    "synthetic-webhook-secret",
    "synthetic-encryption-key",
    "synthetic-runtime-key",
  ])
    assert.ok(containsPrivateMaterial(`bundle:${value}`, secrets));
  assert.ok(
    containsPrivateMaterial(
      '"-----BEGIN PRIVATE KEY-----\\nsynthetic-key-body\\n-----END PRIVATE KEY-----"',
      secrets,
    ),
  );
  assert.equal(containsPrivateMaterial("public-publishable-key", secrets), false);
});

test("unconfigured token signatures are rejected without relying on local environment", () => {
  assert.ok(containsPrivateMaterial("ghp_" + "x".repeat(36), []));
  assert.ok(containsPrivateMaterial("sb_secret_" + "x".repeat(24), []));
  assert.equal(containsPrivateMaterial("GITHUB_CLIENT_ID: public-id", []), false);
});
