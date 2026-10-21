import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRESET_SCENARIOS,
  buildAttackGraphFromScan,
  classifyFindingToStride,
} from "../src/lib/api/attackGraph.ts";
import {
  edgePath,
  formatCvss,
  getThreatTarget,
  layoutAttackGraph,
  peakCvss,
  compactSourcePath,
  shouldShowEmptyAttackGraph,
} from "../src/lib/attackGraphView.ts";

const finding = (overrides = {}) => ({
  title: "SQL Injection",
  severity: "high",
  file_path: "src/api.ts",
  cwe_id: "CWE-89",
  ...overrides,
});

test("compact source paths preserve filenames within node subtitle width", () => {
  const path = compactSourcePath(
    "GHRCE-SIH-JUDGE-PORTAL-master/GHRCE-SIH-JUDGE-PORTAL-master/admin.php",
  );
  assert.ok(path.endsWith("/admin.php"));
  assert.ok(path.length <= 40);
});

test("empty state appears only after all scan sources confirm no evidence", () => {
  assert.equal(
    shouldShowEmptyAttackGraph({
      workspaceReady: true,
      scansPending: false,
      scansFailed: false,
      scanCount: 0,
    }),
    true,
  );
  for (const state of [
    { workspaceReady: false, scansPending: false, scansFailed: false, scanCount: 0 },
    { workspaceReady: true, scansPending: true, scansFailed: false, scanCount: 0 },
    { workspaceReady: true, scansPending: false, scansFailed: true, scanCount: 0 },
    { workspaceReady: true, scansPending: false, scansFailed: false, scanCount: 1 },
  ]) {
    assert.equal(shouldShowEmptyAttackGraph(state), false);
  }
});

test("all preset nodes remain in-bounds and all vectors resolve to their own target", () => {
  for (const scenario of Object.values(PRESET_SCENARIOS)) {
    const canvas = layoutAttackGraph(scenario.nodes);
    assert.equal(canvas.nodes.length, scenario.nodes.length);
    for (const node of canvas.nodes) {
      assert.ok(node.px >= 4 && node.py >= 4);
      assert.ok(node.px + node.pw + 4 <= canvas.width);
      assert.ok(node.py + node.ph + 4 <= canvas.height);
    }
    for (const threat of scenario.threats) {
      assert.equal(getThreatTarget(scenario, threat)?.id, threat.compromisedNodeId);
      assert.ok(threat.edgeIds.every((id) => scenario.edges.some((e) => e.id === id)));
    }
    assert.equal(getThreatTarget(scenario), null);
  }
});

test("extra chain nodes and more than three branches are never dropped or clipped", () => {
  for (const count of [0, 1, 2, 3, 4, 8, 30]) {
    const scenario = buildAttackGraphFromScan({
      findings: Array.from({ length: count }, (_, i) =>
        finding({ file_path: `src/service-${i}.ts` }),
      ),
    });
    const canvas = layoutAttackGraph(scenario.nodes);
    assert.equal(canvas.nodes.length, count + 1);
    assert.equal(new Set(canvas.nodes.map((n) => n.id)).size, count + 1);
    for (const node of canvas.nodes) assert.ok(node.py + node.ph + 4 <= canvas.height);
    for (let i = 0; i < canvas.nodes.length; i++) {
      for (const other of canvas.nodes.slice(i + 1)) {
        const node = canvas.nodes[i];
        assert.ok(
          node.px + node.pw <= other.px ||
            other.px + other.pw <= node.px ||
            node.py + node.ph <= other.py ||
            other.py + other.ph <= node.py,
        );
      }
    }
  }
  assert.deepEqual(layoutAttackGraph([]).nodes, []);
});

test("scans map recorded files without inventing infrastructure, compromise, scores or patches", () => {
  const scenario = buildAttackGraphFromScan({
    target_name: "Project",
    findings: [
      finding({ code_snippet: "line 1\nline 2", remediation_steps: ["Use bound parameters."] }),
    ],
  });
  assert.deepEqual(scenario.frameworks, []);
  assert.equal(scenario.threats[0].cvssScore, null);
  assert.equal(scenario.threats[0].remediationSnippet.patched, "");
  assert.equal(scenario.threats[0].remediationSnippet.vulnerable, "line 1\nline 2");
  assert.equal(scenario.threats[0].remediationSnippet.explanation, "Use bound parameters.");
  assert.ok(scenario.nodes.every((n) => n.type === "service" && n.status !== "compromised"));
  assert.equal(getThreatTarget(scenario, scenario.threats[0]).metadata.file, "src/api.ts");
});

test("captured code keeps indentation and line breaks", () => {
  const snippet = "  if (input) {\n    unsafe(input);\n  }\n";
  const scenario = buildAttackGraphFromScan({ findings: [finding({ code_snippet: snippet })] });
  assert.equal(scenario.threats[0].remediationSnippet.vulnerable, snippet);
});

test("source locations are grouped, Windows paths normalized and duplicate finding IDs disambiguated", () => {
  const scenario = buildAttackGraphFromScan({
    findings: [finding({ id: "same", file_path: "src\\api.ts" }), finding({ id: "same" })],
  });
  assert.equal(scenario.nodes.length, 2);
  assert.equal(scenario.edges.length, 1);
  assert.equal(new Set(scenario.threats.map((t) => t.id)).size, 2);
  assert.equal(scenario.threats[0].compromisedNodeId, scenario.threats[1].compromisedNodeId);
  assert.equal(scenario.threats[0].filePath, "src/api.ts");
});

test("zero CVSS is preserved and missing, invalid and out-of-range scores are not fabricated", () => {
  const threats = buildAttackGraphFromScan({
    findings: [0, null, undefined, NaN, Infinity, -1, 11, "9.8", 7.1].map((cvss_score) =>
      finding({ cvss_score }),
    ),
  }).threats;
  assert.equal(threats[0].cvssScore, 0);
  assert.equal(formatCvss(0), "0.0");
  assert.equal(formatCvss(null), "N/A");
  assert.equal(formatCvss(NaN), "N/A");
  assert.ok(threats.slice(1, -1).every((t) => t.cvssScore === null));
  assert.equal(peakCvss(threats), 7.1);
  assert.equal(peakCvss([]), null);
});

test("malformed and empty scan data renders an honest empty model rather than throwing", () => {
  for (const value of [
    null,
    undefined,
    [],
    "bad",
    { findings: {} },
    { findings: [null, false, "bad"] },
  ]) {
    const scenario = buildAttackGraphFromScan(value);
    assert.equal(scenario.threats.length, 0);
    assert.equal(scenario.nodes.length, 1);
  }
  const scenario = buildAttackGraphFromScan({
    frameworks: [null, "soc2", "soc2"],
    findings: [
      { title: 42, file_path: null, line_number: -2, remediation: "Review access controls." },
    ],
  });
  assert.deepEqual(scenario.frameworks, ["soc2"]);
  assert.equal(scenario.threats[0].lineNumber, undefined);
  assert.deepEqual(scenario.threats[0].affectedAssets, []);
  assert.equal(scenario.threats[0].remediationSnippet.explanation, "Review access controls.");
});

test("specific CWE and availability evidence wins over incidental keywords", () => {
  assert.equal(
    classifyFindingToStride(finding({ title: "Authorization bypass", cwe_id: "CWE-285" })),
    "elevation_of_privilege",
  );
  assert.equal(
    classifyFindingToStride({ title: "ReDoS injection in login", cwe_id: "CWE-1333" }),
    "dos",
  );
  assert.equal(
    classifyFindingToStride({ title: "Sensitive data in logs", cwe_id: "CWE-532" }),
    "info_disclosure",
  );
  assert.equal(
    classifyFindingToStride({ title: "Log injection", cwe_id: "CWE-117" }),
    "repudiation",
  );
  assert.equal(classifyFindingToStride({ title: "Unsafe keyboard component" }), "tampering");
  assert.equal(classifyFindingToStride(null), "tampering");
});

test("paths support forward, backward, and same-column connectors", () => {
  const nodes = layoutAttackGraph(
    buildAttackGraphFromScan({ findings: [finding(), finding({ file_path: "other.ts" })] }).nodes,
  ).nodes;
  for (const [source, target] of [
    [nodes[0], nodes[1]],
    [nodes[1], nodes[0]],
    [nodes[1], nodes[2]],
  ]) {
    const path = edgePath(source, target);
    assert.ok(path.startsWith("M "));
    assert.ok(!path.includes("NaN"));
  }
});
