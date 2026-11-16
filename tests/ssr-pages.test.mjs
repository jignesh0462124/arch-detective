// Run with the real frontend dev/preview server running; exercises its SSR path.
import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.FRONTEND_TEST_URL || "http://127.0.0.1:5173";
for (const path of [
  "/",
  "/about",
  "/team",
  "/privacy",
  "/terms",
  "/login",
  "/dashboard",
  "/workspace",
  "/advisor",
  "/settings",
  "/findings",
  "/reports",
  "/fix-verification",
]) {
  test(`server renders ${path} without a browser-global exception`, async () => {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
    const html = await response.text();
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
    assert.match(response.headers.get("content-type") || "", /text\/html/);
    assert.doesNotMatch(
      html,
      /ReferenceError: (document|window) is not defined|Internal Server Error/,
    );
  });
}
