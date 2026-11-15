// Open the standalone server first, then run with playwright-cli run-code --filename.
// prettier-ignore
async (page) => {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))
    throw Error("Open the local standalone server before running this check");
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(base + "/") && response.status() >= 500)
      errors.push(`HTTP ${response.status()}`);
  });
  await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Welcome back", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Email address", exact: true }).waitFor();
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByRole("heading", { name: "Create your account", exact: true }).waitFor();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  for (const path of ["/advisor", "/workspace", "/settings", "/fix-verification"]) {
    await page.goto(base + path, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Welcome back", exact: true }).waitFor();
  }
  if (errors.length) throw Error(errors.join("\n"));
  return "PASS: standalone login/signup hydration and signed-out protected-route redirects; no local 500 responses or client exceptions";
}
