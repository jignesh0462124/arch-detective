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
      import { SaaSHeroMotionGraphic } from "./src/components/marketing/SaaSHeroMotionGraphic";
      import { PrivacyContent } from "./src/components/settings/LegalContent";
      export { advisorErrorMessage } from "./src/lib/advisorPresentation";
      export const selector = () => renderToStaticMarkup(createElement(AiModelSelector, {
        selectedModel: "glm-5-3-flash", onSelectModel: () => {}
      }));
      export const message = (message) => renderToStaticMarkup(createElement(AiMessage, {message}));
      export const workflow = () => renderToStaticMarkup(createElement(SaaSHeroMotionGraphic));
      export const privacy = () => renderToStaticMarkup(createElement(PrivacyContent));
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

test("collapsed model selector is neutral and remains accessible", () => {
  const html = ui.selector();
  assert.match(html, /aria-label="Select model"/);
  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(html, />Model<\/span>/);
  assert.doesNotMatch(html, /GLM|ONLINE|Neural|Fastest|Recommended|tok\/s/);
});

test("responses retain their content without repeated model badges", () => {
  const html = ui.message({
    id: "fixture",
    role: "assistant",
    modelId: "glm-5-3-flash",
    content: "Review and test this proposed change. CWE-89.",
  });
  assert.match(html, /Security Advisor/);
  assert.match(html, /Review and test this proposed change\. CWE-89\./);
  assert.doesNotMatch(html, /GLM|Neural|ANALYST QUERY/);
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
