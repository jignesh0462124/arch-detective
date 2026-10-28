// Real local frontend, signed out; catches hydration exceptions missed by static builds.
// Playwright CLI requires a function expression without a trailing semicolon.
// prettier-ignore
async (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith("http://127.0.0.1:5173/") && response.status() >= 500)
      errors.push(`HTTP ${response.status()}`);
  });
  await page.goto("http://127.0.0.1:5173/login");
  await page.getByRole("heading", { name: "Welcome back", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Email address", exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('input[name="email"]')?.disabled);
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByRole("heading", { name: "Create your account", exact: true }).waitFor();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  for (const path of ["/advisor", "/workspace", "/settings", "/fix-verification"]) {
    await page.goto("http://127.0.0.1:5173" + path);
    await page.getByRole("heading", { name: "Welcome back", exact: true }).waitFor();
  }
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS: Real login/signup hydration and protected-route sign-in redirects without 500 responses or client exceptions",
  );
}
