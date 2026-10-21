import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseFindingScan,
  formatCvss,
  stateLabel,
  FINDING_STATES,
} from "../src/lib/findingView.ts";

test("latest completed scan survives newer pending/running scans", () => {
  const scans = [
    { id: "running", status: "running" },
    { id: "latest", status: "completed" },
    { id: "older", status: "completed" },
  ];
  assert.equal(chooseFindingScan(scans, null)?.id, "latest");
  assert.equal(chooseFindingScan(scans, "older")?.id, "older");
  assert.equal(chooseFindingScan(scans, "deleted")?.id, "latest");
  assert.equal(chooseFindingScan(scans.slice(0, 1), null), undefined);
  assert.equal(chooseFindingScan([], null), undefined);
});

test("CVSS preserves zero and rejects malformed/out-of-range values", () => {
  assert.equal(formatCvss(0), "0.0");
  assert.equal(formatCvss("9.8"), "9.8");
  for (const value of [null, undefined, "", NaN, Infinity, "bad", -1, 11])
    assert.equal(formatCvss(value), null);
});

test("all persisted statuses have readable labels", () => {
  assert.deepEqual(FINDING_STATES.map(stateLabel), [
    "Open",
    "Resolved",
    "Accepted risk",
    "False positive",
  ]);
  assert.equal(stateLabel("unknown"), "Unknown");
});
