import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { AiModelSelector } from "./src/components/ai-assistant/AiModelSelector";
      import { AiMessage } from "./src/components/ai-assistant/AiMessage";
      import { SolutionPreview } from "./src/components/audit-workbench/SolutionPreview";
      import { SaaSHeroMotionGraphic } from "./src/components/marketing/SaaSHeroMotionGraphic";
      import { PrivacyContent } from "./src/components/settings/LegalContent";
      import { SeverityBadge } from "./src/components/ui/severity-badge";
      import { CoverageBar } from "./src/components/ui/coverage-bar";
      export { advisorErrorMessage } from "./src/lib/advisorPresentation";
      export const selector = () => renderToStaticMarkup(createElement(AiModelSelector, {
        selectedModel: "glm-5-3-flash", onSelectModel: () => {}
      }));
      export const message = (message) => renderToStaticMarkup(createElement(AiMessage, {message}));
      export const solution = (message) => renderToStaticMarkup(createElement(SolutionPreview, {message}));
      export const workflow = () => renderToStaticMarkup(createElement(SaaSHeroMotionGraphic));
      export const privacy = () => renderToStaticMarkup(createElement(PrivacyContent));
      export const severity = (severity) => renderToStaticMarkup(createElement(SeverityBadge, {severity}));
      export const coverage = (pct) => renderToStaticMarkup(createElement(CoverageBar, {label:"SOC 2", pct}));
    `,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  external: ["react", "react-dom/server"],
});
// Resolve bare React imports from this repository rather than a data URL.
const { pathToFileURL } = await import("node:url");
const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
const code = bundle.outputFiles[0].text.replace(
  /from "(react|react\/jsx-runtime|react-dom\/server)"/g,
  (_, name) => `from "${pathToFileURL(require.resolve(name)).href}"`,
);
const ui = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

test("solution preview is code-first, escaped, and refuses incomplete copy", () => {
  const content =
    '## Assessment\nStatic SVG does not confirm XSS.\n## Suggested code\n```php\n<script>alert("fixture")</script>\n```\n## How to verify\n- Test icon visibility.\n## Explanation and assumptions\nHuman review required.';
  const html = ui.solution({
    id: "fixture-solution",
    role: "assistant",
    content,
    status: "completed",
  });
  assert.match(html, /Static SVG does not confirm XSS/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|Security Advisor|Fenced Code Solution/);
  assert.ok(html.indexOf("Assessment") < html.indexOf("Suggested code"));
  assert.ok(html.indexOf("Suggested code") < html.indexOf("How to verify"));
  assert.match(html, /<details/);
  assert.match(html, /html ·/);
  const partial = ui.solution({
    id: "partial",
    role: "assistant",
    content: "```js\nconst x =",
    status: "interrupted",
  });
  assert.match(partial, /Incomplete suggestion/);
  assert.match(partial, /disabled=""/);
  assert.match(partial, /Verification steps were not provided/);
});

test("collapsed model selector is neutral and remains accessible", () => {
  const html = ui.selector();
  assert.match(html, /aria-label="Select model"/);
  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(html, />Model<\/span>/);
  assert.doesNotMatch(html, /GLM|ONLINE|Neural|Fastest|Recommended|tok\/s/);
});

test("severity labels retain all four levels in one readable outlined style", () => {
  for (const level of ["critical", "high", "medium", "low"]) {
    const html = ui.severity(level);
    assert.match(html, new RegExp(`>${level}<`));
    assert.match(html, /rounded border bg-card/);
    assert.match(html, /text-xs/);
    assert.doesNotMatch(html, /severity-bg-|rounded-full|<svg/);
  }
});

test("framework bars remain visible at midrange scores and expose truthful accessible values", () => {
  for (const pct of [0, 50, 80, 100]) {
    const html = ui.coverage(pct);
    assert.match(html, /role="meter"/);
    assert.match(html, new RegExp(`aria-valuenow="${pct}"`));
    assert.match(html, new RegExp(`width:${pct}%`));
    assert.match(html, /bg-foreground\/75/);
    assert.match(html, /not certification/);
  }
  for (const pct of [NaN, Infinity]) {
    assert.match(ui.coverage(pct), /Not available/);
    assert.doesNotMatch(ui.coverage(pct), /role="meter"/);
  }
});

test("finding list does not stretch to the evidence panel or force dark-only text", async () => {
  const source = await readFile("src/routes/_app/findings.tsx", "utf8");
  assert.match(source, /grid-cols-1 items-start gap-5 xl:grid-cols-12/);
  const list = source.slice(
    source.indexOf('aria-label="Findings list"'),
    source.indexOf("{selectedId && ("),
  );
  assert.ok(list.includes("Previous"));
  assert.doesNotMatch(list, /text-cream|text-white|border-white/);
});

test("report rows and details explain missing CVSS without inventing a score", async () => {
  const source = await readFile("src/routes/_app/reports.$reportId.tsx", "utf8");
  assert.match(source, /formatCvss\(finding\.cvss_score\) \?\? "not available"/);
  assert.match(source, /formatCvss\(detail\.data\.finding\.cvss_score\) \?\? "Not available"/);
});

test("responses retain their content without repeated model badges", () => {
  const html = ui.message({
    id: "fixture",
    role: "assistant",
    modelId: "glm-5-3-flash",
    content: "Review and test this proposed change. CWE-89.",
  });
  assert.match(html, /Security Advisor/);
  assert.match(html, /data-advisor-icon=""/);
  assert.match(html, /Review and test this proposed change\. CWE-89\./);
  assert.doesNotMatch(html, /GLM|Neural|ANALYST QUERY/);
});

test("Advisor marks share one regular speech-bubble design without restoring prompt decorations", async () => {
  const icon = await readFile("src/components/ui/AdvisorIcon.tsx", "utf8");
  assert.match(icon, /ChatCircleText/);
  assert.match(icon, /weight="regular"/);
  for (const path of [
    "src/components/ai-assistant/AiMessage.tsx",
    "src/routes/_app/attack-graph.tsx",
  ])
    assert.match(await readFile(path, "utf8"), /<AdvisorIcon/);
  assert.doesNotMatch(
    await readFile("src/components/ai-assistant/AiAssistantPanel.tsx", "utf8"),
    /<AdvisorIcon|<ShieldCheck/,
  );
});

test("response formatting preserves literal hashes and escapes untrusted code", () => {
  const html = ui.message({
    id: "literal-code",
    role: "assistant",
    content:
      "Use `url#section` and `a##b`.\nC#\n**C#**\n- `# comment #`\nhttps://example.test/#section\n```html\n<script>alert(1)</script>\n```",
  });
  for (const value of ["url#section", "a##b", "C#", "# comment #", "https://example.test/#section"])
    assert.ok(html.includes(value), value);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("pending response has honest loading text", () => {
  const html = ui.message({ id: "fixture", role: "assistant", content: "", streaming: true });
  assert.match(html, /role="status"/);
  assert.match(html, /Preparing response/);
  assert.doesNotMatch(html, /ANALYZING CODEBASE/);
});

test("marketing workflow is explicitly illustrative with no fake live or signed indicators", () => {
  const html = ui.workflow();
  assert.match(html, /ILLUSTRATIVE WORKFLOW/);
  assert.match(html, /human review/i);
  assert.doesNotMatch(
    html,
    /GROQ|LLAMA|AGENTIC|ONLINE|STREAMING RUN|SIGNED REPORT|SEALED|CO-SIGNED|SHA-256|92%/,
  );
});

test("unexpected errors never render stack traces, credentials or raw provider payloads", () => {
  const safe = "Could not prepare a response. Check your connection and try again.";
  for (const error of [
    "Traceback (most recent call last): secret=fixture",
    new Error("TypeError: provider payload\n at request (backend.ts:20)"),
    "Security Advisor is temporarily unavailable. Retry shortly.\nsecret=fixture",
    { detail: "raw provider payload" },
    null,
  ])
    assert.equal(ui.advisorErrorMessage(error), safe);
  for (const message of [
    "Your session has ended. Sign in again.",
    "You are signed in, but the server could not verify this request. Retry shortly.",
    "This saved finding is no longer available to your workspace. Choose another finding.",
    "Advisor stream was interrupted. Please retry.",
  ])
    assert.equal(ui.advisorErrorMessage(message), message);
});

test("removed branding does not return in navigation, metadata or public marketing", async () => {
  for (const path of [
    "src/routes/index.tsx",
    "src/routes/__root.tsx",
    "src/components/marketing/SaaSHeroMotionGraphic.tsx",
    "public/site.webmanifest",
  ]) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(
      source,
      /Powered by Groq|Agentic|Neural Reasoning|LLAMA 3\.1|STREAMING RUN|CO-SIGNED|sealed reports|signed audit reports/i,
    );
  }
  for (const path of [
    "src/routes/_app/advisor.tsx",
    "src/routes/_app/attack-graph.tsx",
    "src/components/ai-assistant/AiAssistantPanel.tsx",
    "src/components/brutal/AppShell.tsx",
  ])
    assert.doesNotMatch(await readFile(path, "utf8"), /<Sparkle\b|>AI Advisor<|Open in AI Advisor/);
  assert.match(await readFile("src/routes/privacy.tsx", "utf8"), /<PrivacyContent\s*\/>/);
  assert.match(ui.privacy(), /external AI providers/);
  const reports = await readFile("src/components/reports/ReportUi.tsx", "utf8");
  assert.match(reports, /Static checks and AI review/);
});

test("Advisor panel uses text-only headings and quick actions without removing their behavior", async () => {
  const source = await readFile("src/components/ai-assistant/AiAssistantPanel.tsx", "utf8");
  assert.doesNotMatch(source, /ShieldCheck|icon:|action\.icon|<Icon\b/);
  for (const label of ["Explain", "Suggest a fix", "How to verify"])
    assert.ok(source.includes(`label: "${label}"`));
  assert.match(source, /chat\.sendMessage\(/);
  assert.match(source, /chat\.findingContext/);
  assert.match(source, /chat\.stopStreaming/);
  assert.match(source, /Advice needs human review/);
  assert.match(source, /aria-label="Quick advisor prompts"/);
});

test("graph uses neutral source presentation while retaining recorded evidence and graph actions", async () => {
  const source = await readFile("src/routes/_app/attack-graph.tsx", "utf8");
  assert.doesNotMatch(
    source,
    /FOCUS TARGET ASSET|Target focused|Flaw Origin|Review Target|ATTACK CHAIN REASONING/,
  );
  const evidence = source.slice(
    source.indexOf("{/* Recorded source evidence */}"),
    source.indexOf("{/* Blast Radius Section */}"),
  );
  assert.ok(evidence.includes("Saved source excerpt"));
  assert.doesNotMatch(evidence, /bg-red-950\/30|text-red-300/);
  for (const label of [
    "Finding location",
    "Recenter finding",
    "Saved source excerpt",
    "Source location",
  ])
    assert.ok(source.includes(label));
  assert.match(source, /onClick=\{handleFocusTargetAsset\}/);
  assert.match(source, /activeThreat\.remediationSnippet\.vulnerable/);
  assert.match(source, /handleCopySnippet\("source"\)/);
  assert.match(source, /Validate exploitability before remediation/);
  assert.match(source, /<SeverityBadge severity=\{activeThreat\.severity\}/);
});

test("graph labels omit decorative slashes and context cards share a responsive column", async () => {
  const { default: ts } = await import("typescript");
  const source = await readFile("src/routes/_app/attack-graph.tsx", "utf8");
  const tree = ts.createSourceFile(
    "attack-graph.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const labels = [];
  const visit = (node) => {
    if (ts.isJsxText(node) || ts.isStringLiteralLike(node) || ts.isTemplateHead(node))
      labels.push(node.text.trim());
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.deepEqual(
    labels.filter((text) => /^(?:\d+\s+)?\/\//.test(text)),
    [],
  );
  for (const label of ["TOPOLOGY CANVAS", "SAVED FINDING", "THREAT SUMMARY", "SELECTED COMPONENT"])
    assert.ok(labels.includes(label), label);
  const context = source.slice(source.indexOf("<aside"), source.indexOf("</aside>"));
  assert.match(context, /aria-label="Finding context and selected component"/);
  assert.match(context, /grid content-start gap-4/);
  assert.doesNotMatch(context, /xl:border-l|xl:pl-6|truncate text-right/);
  assert.equal((context.match(/sm:grid-cols-\[auto_minmax\(0,1fr\)\]/g) || []).length, 4);
  assert.match(context, /overflow-wrap:anywhere/);
});

test("Findings labels omit decorative slashes without changing evidence or metrics", async () => {
  const { default: ts } = await import("typescript");
  const source = await readFile("src/routes/_app/findings.tsx", "utf8");
  const tree = ts.createSourceFile(
    "findings.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const labels = [];
  const visit = (node) => {
    if (ts.isJsxText(node) || ts.isStringLiteralLike(node) || ts.isTemplateHead(node))
      labels.push(node.text.trim());
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.deepEqual(
    labels.filter((text) => /^(?:\d+\s+)?\/\//.test(text)),
    [],
  );
  for (const label of ["TRIAGE", "FINDINGS", "TOTAL", "CRIT", "HIGH", "MED+LOW"])
    assert.ok(labels.includes(label), label);
  assert.match(source, /eyebrow=\{f\.id\.slice\(0, 8\)\}/);
  assert.match(source, /severityCount\("medium"\) \+ severityCount\("low"\)/);
});
