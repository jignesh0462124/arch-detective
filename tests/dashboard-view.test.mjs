import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardDate,
  dashboardScanStatus,
  frameworkSignals,
  isScanInProgress,
} from "../src/lib/dashboardView.ts";

test("active statuses stay distinct from completed and failed scans", () => {
  for (const status of ["pending", "uploading", "queued", "running"]) {
    assert.equal(isScanInProgress(status), true);
    assert.equal(dashboardScanStatus(status), "In progress");
  }
  assert.equal(isScanInProgress("completed"), false);
  assert.equal(isScanInProgress("failed"), false);
  assert.equal(dashboardScanStatus("completed"), "Completed");
  assert.equal(dashboardScanStatus("failed"), "Failed");
});

test("framework signals retain zero but reject missing and fabricated scores", () => {
  assert.deepEqual(frameworkSignals({ gdpr: 0, soc2: 84, iso27001: null, fake: 102 }), [
    ["gdpr", 0],
    ["soc2", 84],
  ]);
  assert.deepEqual(frameworkSignals({}), []);
});

test("missing or invalid completion dates stay unavailable", () => {
  assert.equal(dashboardDate(null), "Date unavailable");
  assert.equal(dashboardDate("not-a-date"), "Date unavailable");
  assert.notEqual(dashboardDate("2026-10-20T10:00:00Z"), "Date unavailable");
});
