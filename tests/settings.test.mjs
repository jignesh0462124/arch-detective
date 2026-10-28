import assert from "node:assert/strict";
import test from "node:test";
import { settingsSection, validateDisplayName } from "../src/lib/settings.ts";

test("only recognized Settings sections are accepted", () => {
  for (const value of [
    undefined,
    null,
    {},
    ["privacy"],
    "__proto__",
    "https://example.com",
    "unknown",
  ]) {
    assert.equal(settingsSection(value), "overview");
  }
  for (const value of [
    "overview",
    "account",
    "appearance",
    "workspace",
    "integrations",
    "privacy",
    "pricing",
    "help",
  ])
    assert.equal(settingsSection(value), value);
});
test("display names validate trimmed length without requiring work email or ASCII names", () => {
  assert.ok(validateDisplayName("   "));
  assert.ok(validateDisplayName("a".repeat(121)));
  assert.equal(validateDisplayName("  Jignesh  "), null);
  assert.equal(validateDisplayName("उपयोगकर्ता"), null);
  assert.equal(validateDisplayName("a".repeat(120)), null);
});
