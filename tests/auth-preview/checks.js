async (page) => {
  const passed = [];
  const base = "http://127.0.0.1:5178/tests/auth-preview/index.html";
  const open = async (q = "") => {
    await page.goto(base + q);
  };
  const stats = () => page.evaluate(() => window.authFixture.stats());
  await open("?scenario=credentials");
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  await page.getByLabel("Email address").fill("fixture@example.test");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("short");
  await page.locator('button[type="submit"]').click();
  await page.getByRole("alert").filter({ hasText: "incorrect" }).waitFor();
  if ((await stats()).calls !== 1) throw Error("Existing short password was blocked");
  passed.push("short existing password reaches authentication; safe credential error");
  await page.getByRole("button", { name: "Create account", exact: true }).first().click();
  await page.getByLabel("Full name").fill("Fixture User");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("NewPassword42!");
  await page.getByLabel("Confirm password").fill("different");
  await page.locator('button[type="submit"]').click();
  if (
    !(await page.getByLabel("Confirm password").evaluate((el) => el.validationMessage)).includes(
      "match",
    )
  )
    throw Error("No mismatch feedback");
  await page.getByLabel("Confirm password").fill("NewPassword42!");
  await page.locator('button[type="submit"]').click();
  await page.getByRole("status").filter({ hasText: "eligible" }).waitFor();
  if (!(await page.getByRole("button", { name: /Resend confirmation in/ }).isDisabled()))
    throw Error("No confirmation cooldown");
  passed.push("signup confirmation, neutral email message and resend cooldown");
  await open();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email address").fill("fixture@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page.getByRole("status").filter({ hasText: "eligible" }).waitFor();
  if (!(await page.getByRole("button", { name: /Resend in/ }).isDisabled()))
    throw Error("Reset cooldown missing");
  passed.push("password reset instructions and cooldown");
  await open("?page=reset&scenario=ordinary");
  await page.getByRole("heading", { name: "Reset link unavailable" }).waitFor();
  if (await page.locator("form").count()) throw Error("Ordinary session can reset password");
  passed.push("ordinary session is not recovery authorization");
  await open("?page=reset");
  await page.getByRole("heading", { name: "Reset link unavailable" }).waitFor();
  if (await page.locator("form").count()) throw Error("Expired form remains visible");
  passed.push("expired recovery mutually exclusive state");
  await open("?page=reset&scenario=recovery");
  await page.getByLabel("New password", { exact: true }).fill("NewPassword42!");
  await page.getByLabel("Confirm new password").fill("NewPassword42!");
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await page.getByRole("button", { name: "Retry sign out", exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry sign out", exact: true }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).waitFor();
  const afterRecovery = await stats();
  if (afterRecovery.updates !== 1 || afterRecovery.signouts !== 2)
    throw Error("Retried password write instead of logout");
  passed.push("password success survives logout failure; only logout retried");
  await open("?page=private&scenario=logout-failure");
  await page.getByRole("heading", { name: "Private workspace" }).waitFor();
  await page.getByLabel("Account menu").click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Retry sign out", exact: true }).waitFor();
  if (!(await page.getByRole("heading", { name: "Private workspace" }).count()))
    throw Error("Failure falsely signed out");
  await page.getByRole("button", { name: "Retry sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  if ((await page.evaluate(() => window.lastScope)) !== "local")
    throw Error("Normal logout not local");
  if ((await stats()).subscribes !== 1) throw Error("Repeated auth subscriptions");
  passed.push("local logout failure/retry; one subscription across consumers");
  await open("?scenario=stale");
  await page.evaluate(() => {
    window.authFixture.emit("SIGNED_IN", window.authFixture.fake("bob"));
    window.authFixture.emit("SIGNED_OUT", null);
  });
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  await page.waitForTimeout(250);
  if (await page.getByRole("heading", { name: "Private workspace" }).count())
    throw Error("Stale session restored");
  passed.push("stale initialization cannot restore signed-out account");
  for (const theme of ["light", "dark"])
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await open("?theme=" + theme);
      await page.getByRole("heading", { name: "Welcome back" }).waitFor();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw Error("Horizontal overflow");
      await page.screenshot({
        path: `output/playwright/auth-${theme}-${width}.png`,
        fullPage: true,
      });
      passed.push(`${theme} ${width}px layout`);
    }
  return passed;
};
