import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateAuditFile,
  findingIdentity,
  deduplicateAuditFindings,
  recordedCvssAverage,
} from "../src/lib/auditView.ts";
import { syncAuditEvidence } from "../src/lib/api/auditSync.ts";

const finding = (overrides) => ({
  title: "Injection",
  description: "Review query",
  severity: "high",
  cwe_id: "CWE-89",
  file_path: "a.php",
  line_number: 2,
  code_snippet: "queryA()",
  ...overrides,
});

test("mean CVSS ignores absent/invalid metrics and preserves zero", () => {
  assert.equal(recordedCvssAverage([]), null);
  assert.equal(recordedCvssAverage([{}, { cvss_score: NaN }, { cvss_score: 12 }]), null);
  assert.equal(recordedCvssAverage([{ cvss_score: 0 }, { cvss_score: 8 }]), 4);
});

const scanResult = (findings) => ({
  scan_id: "fixture",
  target_name: "Fixture",
  frameworks: ["gdpr"],
  findings,
  framework_scores: {},
  severity_counts: { critical: 0, high: findings.length, medium: 0, low: 0 },
  summary: { overall_posture: findings.length ? "High" : "Minimal" },
});

test("cloud completion is published only after findings are saved", async () => {
  const operations = [];
  await syncAuditEvidence(scanResult([finding({})]), "workspace-a", {
    createScan: async (record) => operations.push(["scan", record.status, record.workspace_id]),
    createFindings: async (rows) => operations.push(["findings", rows.length]),
    updateScan: async (_, updates) => operations.push(["update", updates.status]),
  });
  assert.deepEqual(operations, [
    ["scan", "running", "workspace-a"],
    ["findings", 1],
    ["update", "completed"],
  ]);
});

test("cloud failure cannot publish a partially saved audit as completed", async () => {
  let completed = false;
  await assert.rejects(
    syncAuditEvidence(scanResult([finding({})]), "workspace-a", {
      createScan: async () => {},
      createFindings: async () => {
        throw new Error("Denied");
      },
      updateScan: async () => {
        completed = true;
      },
    }),
    /Denied/,
  );
  assert.equal(completed, false);
});

test("zero findings can complete without writing fabricated evidence", async () => {
  let wroteFindings = false;
  let completed = false;
  await syncAuditEvidence(scanResult([]), "workspace-a", {
    createScan: async () => {},
    createFindings: async () => {
      wroteFindings = true;
    },
    updateScan: async () => {
      completed = true;
    },
  });
  assert.equal(wroteFindings, false);
  assert.equal(completed, true);
});

test("ZIP validation accepts uppercase extension and enforces empty/oversize limits", () => {
  assert.equal(validateAuditFile({ name: "PROJECT.ZIP", size: 120 }), null);
  assert.match(validateAuditFile({ name: "p.zip", size: 0 }), /empty/);
  assert.match(validateAuditFile({ name: "p.zip", size: 50 * 1024 * 1024 + 1 }), /50 MB/);
  assert.match(validateAuditFile({ name: "p.zip.exe", size: 100 }), /Only .zip/);
});

test("same CWE in different files/lines preserves each source and snippet", () => {
  const values = [
    finding({}),
    finding({ file_path: "b.php", code_snippet: "queryB()" }),
    finding({ line_number: 4 }),
  ];
  assert.equal(deduplicateAuditFindings(values).length, 3);
  assert.equal(new Set(values.map(findingIdentity)).size, 3);
  assert.equal(deduplicateAuditFindings(values)[1].code_snippet, "queryB()");
});

test("exact-location duplicates merge without mutating input", () => {
  const values = [
    finding({ severity: "low", violations: [{ framework: "gdpr", control_id: "32" }] }),
    finding({ severity: "critical", violations: [{ framework: "soc2", control_id: "CC6" }] }),
  ];
  const before = JSON.stringify(values);
  const merged = deduplicateAuditFindings(values);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].severity, "critical");
  assert.equal(merged[0].violations.length, 2);
  assert.equal(JSON.stringify(values), before);
});

test("finding identities normalize Windows paths and avoid truncated-title collisions", () => {
  assert.equal(
    findingIdentity(finding({ file_path: "a\\b.php" })),
    findingIdentity(finding({ file_path: "a/b.php" })),
  );
  assert.notEqual(
    findingIdentity(finding({ cwe_id: null, title: "A".repeat(40) + "one" })),
    findingIdentity(finding({ cwe_id: null, title: "A".repeat(40) + "two" })),
  );
});
