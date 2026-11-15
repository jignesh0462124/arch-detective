import test from "node:test";
import assert from "node:assert/strict";
import { parseCodeSolution, solutionKey, textBatcher } from "../src/lib/codeSolution.ts";

test("code-first sections preserve uncertainty, exact code, multiple fences and checklist", () => {
  const code = '<script>\n  eyeIcon.setAttribute("data-state", "open#eye");\n</script>';
  const result = parseCodeSolution(
    `## Assessment\nStatic trusted SVG does not demonstrate XSS.\n## Suggested code\n\u0060\u0060\u0060php\n${code}\n\u0060\u0060\u0060\n~~~js\nconst path = "a##b";\n~~~\n## How to verify\n- Toggle twice.\n2. Check keyboard access.\n## Explanation and assumptions\nNo exploit or fix has been verified.`,
  );
  assert.match(result.assessment, /does not demonstrate XSS/);
  assert.equal(result.blocks[0].code, code);
  assert.equal(result.blocks.length, 2);
  assert.deepEqual(result.verification, ["Toggle twice.", "Check keyboard access."]);
  assert.match(result.explanation, /No exploit or fix/);
  assert.equal(result.incompleteFence, false);
});

test("legacy text, missing sections and unclosed code remain honest", () => {
  assert.equal(parseCodeSolution("No code change is justified.").blocks.length, 0);
  const partial = parseCodeSolution("Explanation\nUse parameters.\n```python\n  print('<script>')");
  assert.equal(partial.incompleteFence, true);
  assert.equal(partial.blocks[0].code, "  print('<script>')");
  assert.deepEqual(partial.verification, []);
  assert.equal(
    parseCodeSolution("```\n# literal heading\n```\n").blocks[0].code,
    "# literal heading",
  );
  assert.notEqual(solutionKey("a", "b", "c"), solutionKey("a", "b", "d"));
});

test("100ms batching reduces token publishes and flushes final content without loss", async () => {
  const updates = [];
  const batch = textBatcher((text) => updates.push(text));
  for (let i = 0; i < 1000; i++) batch.append("x");
  assert.equal(updates.length, 1);
  await new Promise((done) => setTimeout(done, 120));
  assert.equal(updates.length, 2);
  assert.equal(updates[1].length, 1000);
  batch.append("final");
  batch.flush();
  batch.dispose();
  assert.equal(updates.at(-1), "x".repeat(1000) + "final");
  await new Promise((done) => setTimeout(done, 120));
  assert.equal(updates.length, 3);
});
