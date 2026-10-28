// prettier-ignore
async (page) => {
  const base = "http://127.0.0.1:5193/tests/workbench-preview/index.html";
  const overflow = async () => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw Error("Horizontal overflow");
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "?view=advisor");
  await page.evaluate(() => { sessionStorage.removeItem("archon-fixture-conversations-v2"); for(const key of Object.keys(localStorage)) if(key.startsWith("archon:account:fixture-user:archon-advisor-handoff:")) localStorage.removeItem(key); });
  await page.reload();
  await page.getByRole("button", { name: "Review database query parameters", exact: true }).click();
  await page.getByText("Bind the request value separately from SQL.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your security question", exact: true })
    .fill("Explain safe query parameters");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByText("Bind the request value separately from SQL.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Explain safe query parameters", exact: true }).waitFor();
  await page
    .getByRole("textbox", { name: "Search conversations", exact: true })
    .fill("no such question");
  await page.getByText("No matching conversations.", { exact: true }).first().waitFor();
  await page.getByRole("textbox", { name: "Search conversations", exact: true }).fill("");
  for (const dark of [false, true]) {
    const themeToggle = page.getByRole("button", { name: dark ? "Switch to dark mode" : "Switch to light mode", exact: true });
    if (await themeToggle.count()) await themeToggle.click();
    await overflow();
    await page.screenshot({
      path: `output/playwright/advisor-v2-${dark ? "dark" : "light"}-desktop.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await overflow();
    await page.getByRole("button", { name: "Open conversation history", exact: true }).click();
    await page.getByRole("dialog").getByRole("textbox", { name: "Search conversations" }).waitFor();
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: `output/playwright/advisor-v2-${dark ? "dark" : "light"}-mobile.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto(base + "?view=workbench");
  await page.getByRole("tab", { name: "Remediation", exact: true }).click();
  await page.getByRole("tab", { name: "Code solution", exact: true }).click();
  await page.getByRole("button", { name: "Generate code suggestion", exact: true }).click();
  await page.getByText("Bind the request value separately from SQL.", { exact: true }).waitFor();
  await page.screenshot({ path: "output/playwright/workbench-code-solution.png", fullPage: true });
  await page.getByRole("link", { name: "Open in Security Advisor", exact: true }).click();
  await page.getByRole("heading", { name: "Security Advisor", exact: true }).waitFor();
  await page.getByText("Bind the request value separately from SQL.", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Codebase Audit", exact: true }).click();
  await page.getByRole("region", { name: "Resume audit" }).waitFor();
  await page.getByRole("button", { name: "Open workbench", exact: true }).waitFor();
  await page.getByRole("button", { name: "New audit", exact: true }).click();
  await page.getByRole("button", { name: "Start audit", exact: true }).waitFor();
  await page.goto(base + "?view=upload");
  await page.getByRole("region", { name: "Resume audit" }).waitFor();
  await page.goto(base + "?view=advisor&context=finding");
  await page.getByText("Bind the request value separately from SQL.", { exact: true }).waitFor();
  const metric = JSON.parse(
    await page.getByRole("status", { name: "Workbench fixture performance" }).textContent(),
  );
  if (metric.advisorRequests !== 1 || !metric.advisorContext?.finding_id)
    throw Error("Finding handoff duplicated or dropped context");
  await page.reload();
  await page.getByText("Bind the request value separately from SQL.", { exact: true }).waitFor();
  const reloaded = JSON.parse(await page.getByRole("status", { name: "Workbench fixture performance" }).textContent());
  if (reloaded.advisorRequests !== 0) throw Error("Refresh replayed a finding submission");
  await page.goto(base + "?view=preferences&section=account");
  for (const dark of [false, true]) {
    const toggle = page.getByRole("button", {
      name: dark ? "Switch to dark mode" : "Switch to light mode",
      exact: true,
    });
    if (await toggle.count()) await toggle.click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await overflow();
      await page.screenshot({
        path: `output/playwright/account-v2-${dark ? "dark" : "light"}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.goto(base + "?view=about");
  if (await page.getByRole("link", { name: "View reports", exact: true }).count())
    throw Error("About still exposes View reports");
  await overflow();
  await page.screenshot({ path: "output/playwright/about-v2-dark-mobile.png", fullPage: true });
  console.log(
    "PASS: Advisor history, search, mobile sheet, code remedies, one-shot handoff, resume and account/about layouts",
  );
}
