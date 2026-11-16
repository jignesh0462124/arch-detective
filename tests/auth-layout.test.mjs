import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

// Exercise the actual route markup, without sessions, network calls or browser globals.
const result = await build({
  stdin: {
    contents: `
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { AuthPage } from "./src/routes/login";
      export const render = () => renderToStaticMarkup(createElement(AuthPage));
    `,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  loader: { ".css": "empty" },
  external: ["react", "react-dom/server"],
  plugins: [
    {
      name: "auth-layout-fixture",
      setup(builder) {
        const modules = {
          "@tanstack/react-router": `
            import { createElement } from "react";
            export const createFileRoute = () => (options) => ({options, useSearch: () => globalThis.authLayoutFixture.search});
            export const useNavigate = () => () => {};
            export const Link = ({to, children, ...props}) => createElement("a", {...props, href: to}, children);
          `,
          "@/hooks/useAuth": "export const useAuth = () => globalThis.authLayoutFixture.auth;",
          "@/lib/api/auth":
            "export const resendConfirmation = () => {}; export const signInWithGitHub = () => {};",
          "@/lib/supabase": "export const authCallbackFailed = false;",
        };
        builder.onResolve(
          {
            filter:
              /^(?:@tanstack\/react-router|@\/hooks\/useAuth|@\/lib\/api\/auth|@\/lib\/supabase)$/,
          },
          ({ path }) => ({ path, namespace: "fixture" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          contents: modules[path],
        }));
      },
    },
  ],
});
const require = createRequire(import.meta.url);
const code = result.outputFiles[0].text.replace(
  /from "(react|react\/jsx-runtime|react-dom\/server)"/g,
  (_, name) => `from "${pathToFileURL(require.resolve(name)).href}"`,
);
const { render } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
function page(mode, auth = {}) {
  globalThis.authLayoutFixture = {
    search: { mode },
    auth: { status: "signed-out", isLoading: false, ...auth },
  };
  return render();
}

test("approved auth composition keeps the form before original artwork and integrated footer", () => {
  const html = page();
  assert.match(html, /aria-labelledby="auth-title"/);
  assert.ok(html.indexOf('class="auth-form-area"') < html.indexOf('class="auth-artwork"'));
  assert.match(html, /srcSet="\/assets\/archon-auth-gateway.webp"/);
  assert.match(html, /media="\(min-width: 1024px\)"/);
  assert.match(html, /<footer class="auth-footer/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.doesNotMatch(html, /ACCOUNT ACCESS|YOUR AUDIT WORKSPACE/);
});

test("sign-in preserves autofill, short existing passwords, recovery and GitHub controls", () => {
  const html = page();
  assert.match(html, /Welcome back/);
  assert.match(html, /autoComplete="username"/);
  assert.match(html, /autoComplete="current-password"/);
  assert.doesNotMatch(html, /minLength=|name="confirm"|name="name"/);
  assert.match(html, /Forgot password\?/);
  assert.match(html, /Continue with GitHub/);
  assert.match(
    html,
    /aria-label="Show password"[^>]+aria-pressed="false"[^>]+aria-controls="auth-password"/,
  );
});

test("signup retains confirmation, requirements and the separate workspace step", () => {
  const html = page("signup");
  assert.match(html, /Create your account/);
  assert.match(html, /<input(?=[^>]*name="name")(?=[^>]*autoComplete="name")[^>]*>/);
  assert.match(
    html,
    /<input(?=[^>]*name="password")(?=[^>]*autoComplete="new-password")(?=[^>]*minLength="8")[^>]*>/,
  );
  assert.match(html, /<input(?=[^>]*name="confirm")(?=[^>]*autoComplete="new-password")[^>]*>/);
  assert.match(html, /Verify your email if requested, then create or join a workspace/);
});

test("recovery has one email action, not password or OAuth controls", () => {
  const html = page("forgot");
  assert.match(html, /Forgot your password\?/);
  assert.match(html, /Send reset link/);
  assert.match(html, /Back to sign in/);
  assert.doesNotMatch(html, /name="password"|Continue with GitHub/);
});

test("session checking disables submissions and session errors retain Retry", () => {
  assert.match(page(undefined, { isLoading: true }), /<fieldset disabled=""/);
  const html = page(undefined, { status: "error", error: "Session check unavailable" });
  assert.match(html, /role="alert"/);
  assert.match(html, /Retry session check/);
});

test("dark mode keeps the approved grid and narrow screens hide only decorative artwork", async () => {
  const css = await readFile("src/components/auth/auth-page.css", "utf8");
  assert.match(css, /"brand navigation" "form artwork" "footer footer"/);
  assert.match(css, /archon-infrastructure-backdrop.webp/);
  assert.match(css, /:root\[data-theme="dark"\] \.auth-shell/);
  assert.match(css, /@media \(width < 1024px\)/);
  assert.match(css, /\.auth-artwork \{\s+display: none;/);
  assert.doesNotMatch(css, /row-reverse|column-reverse|order:\s*-1/);
});
