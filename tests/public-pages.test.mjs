import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";

const result = await build({
  stdin: {
    contents: `
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { TeamPage } from "./src/components/marketing/TeamPage";
      import { ProjectNotice } from "./src/components/marketing/ProjectNotice";
      import { PrivacyContent, TermsContent } from "./src/components/settings/LegalContent";
      import { MarketingFooter } from "./src/components/marketing/MarketingChrome";
      export { privacySections, termsSections } from "./src/components/settings/legalNotices";
      export const team = () => renderToStaticMarkup(createElement(TeamPage));
      export const notice = (kind) => renderToStaticMarkup(createElement(ProjectNotice, {kind, title: kind === "privacy" ? "Your data, explained." : "For responsible code review."}, createElement(kind === "privacy" ? PrivacyContent : TermsContent)));
      export const footer = (compact) => renderToStaticMarkup(createElement(MarketingFooter, {compact}));
    `,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  loader: { ".css": "empty" },
  external: ["react", "react-dom", "react-dom/server"],
  plugins: [
    {
      name: "public-page-router-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^@tanstack\/react-router$/ }, ({ path }) => ({
          path,
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `
        import { createElement } from "react";
        export const Link = ({to, search, children, ...props}) => createElement("a", {...props, href: to + (search ? "?" + new URLSearchParams(search) : "")}, children);
      `,
        }));
      },
    },
  ],
});
const require = createRequire(import.meta.url);
const code = result.outputFiles[0].text.replace(
  /from "(react|react\/jsx-runtime|react-dom|react-dom\/server)"/g,
  (_, name) => `from "${pathToFileURL(require.resolve(name)).href}"`,
);
const ui = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

test("Team is beside About in both navigation surfaces and has active-page semantics", () => {
  const html = ui.team();
  assert.equal(
    (html.match(/<a\b(?=[^>]*href="\/team")(?=[^>]*aria-current="page")[^>]*>/g) || []).length,
    3,
  );
  assert.match(html, /<a\b[^>]*href="\/about"[^>]*>About<\/a><a\b[^>]*href="\/team"/);
  for (const name of [
    "Jignesh Sonewane",
    "Soham Pashine",
    "Bhargav Bawane",
    "Professor Pankaj Sonewane",
  ])
    assert.ok(html.includes(name));
  assert.ok(html.includes("DIC Department"));
  assert.ok(html.includes("G. H. Raisoni College of Engineering, Nagpur"));
  assert.match(html, /First prize · Project seminar/);
});

test("the original photo is unchanged and rendered at its full aspect ratio", async () => {
  const file = await readFile("public/assets/team/project-seminar-original.jpeg");
  assert.equal(
    createHash("sha256").update(file).digest("hex"),
    "447ae6ce5be1e78a39b40243308ac2a6fc5a36134e2ce126337045abd4b87345",
  );
  assert.match(
    ui.team(),
    /src="\/assets\/team\/project-seminar-original.jpeg"[^>]*width="1600" height="1046"/,
  );
  const css = await readFile("src/components/marketing/public-pages.css", "utf8");
  assert.match(css, /\.team-photo-frame img\s*\{[^}]*height: auto/s);
  assert.doesNotMatch(css, /object-fit:\s*cover/);
});

test("workflow uses five readable stages without claiming verified exploits or compliance", () => {
  const html = ui.team();
  assert.match(html, /<ol class="review-workflow-stages">/);
  assert.ok(html.includes("authorized GitHub"));
  assert.ok(html.includes("not proof of compliance"));
  assert.ok(html.includes("depend on deployment configuration"));
  assert.doesNotMatch(html, /534 Controls|statutory compliance|guaranteed|certified/i);
});

for (const kind of ["privacy", "terms"]) {
  test(`${kind} contents point to real, unique section headings`, () => {
    const html = ui.notice(kind);
    const sections = kind === "privacy" ? ui.privacySections : ui.termsSections;
    for (const section of sections) {
      assert.ok(html.includes(`href="#${section.id}"`));
      assert.equal((html.match(new RegExp(`id="${section.id}"`, "g")) || []).length, 1);
      assert.ok(html.includes(`aria-labelledby="${section.id}-title"`));
    }
    assert.match(
      html,
      kind === "privacy"
        ? /Research prototype · product notice/
        : /Research prototype · not production service terms/,
    );
    assert.match(html, /href="\/login\?mode=signup"/);
    assert.match(html, new RegExp(`archon-${kind}-hero-v1.webp`));
  });
}

test("legal disclosures remain visible and privacy controls use the actual Settings search contract", () => {
  const privacy = ui.notice("privacy");
  for (const text of [
    "external AI providers",
    "30 days",
    "does not delete server-side records",
    "not a finalized privacy policy",
  ])
    assert.ok(privacy.includes(text));
  assert.match(privacy, /href="\/login\?next=%2Fsettings%3Fsection%3Dprivacy"/);
  const terms = ui.notice("terms");
  assert.ok(terms.includes("not a certification"));
  assert.ok(terms.includes("not production service terms"));
  assert.ok(terms.includes("merging remains on GitHub"));
});

test("both footer variants have real public destinations instead of dead placeholder links", () => {
  for (const compact of [false, true]) {
    const html = ui.footer(compact);
    for (const page of ["about", "team", "privacy", "terms"])
      assert.ok(html.includes(`href="/${page}"`));
    assert.doesNotMatch(html, /href="#"/);
  }
});
