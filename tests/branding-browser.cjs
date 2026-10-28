// Run with playwright-cli run-code --filename tests/branding-browser.cjs.
// Uses the isolated fixture only: no account, provider or real audit requests.
// Playwright CLI requires a function expression without a trailing semicolon.
// prettier-ignore
async (page) => {
  const fixture = "http://127.0.0.1:5175/tests/workbench-preview/index.html";
  const metrics = async () =>
    JSON.parse(
      await page.getByRole("status", { name: "Workbench fixture performance" }).textContent(),
    );
  const checkLayout = async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error("Horizontal page overflow");
  };
  await page.goto(`${fixture}?view=advisor`, { waitUntil: "domcontentloaded" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByText("Ready", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Select model", exact: true }).click();
  await page.getByRole("option", { name: "Qwen 3.8 Flash", exact: true }).click();
  await page.getByRole("button", { name: "Select model", exact: true }).press("ArrowDown");
  await page
    .getByRole("option", { name: "Qwen 3.8 Flash", exact: true })
    .waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  if (await page.getByRole("listbox").count()) throw new Error("Escape did not close model menu");
  await page
    .getByRole("textbox", { name: "Your security question" })
    .fill("Explain safe query parameters.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page
    .getByText("Fixture suggestion: review and test the change.", { exact: true })
    .waitFor();
  if ((await metrics()).advisorModel !== "qwen-3-8-flash")
    throw new Error("Selected model was not sent");
  for (const dark of [false, true]) {
    await page.evaluate((dark) => {
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    }, dark);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await checkLayout();
      if (width === 390) {
        await page.getByRole("button", { name: "Select model", exact: true }).click();
        const bounds = await page.getByRole("listbox", { name: "Available models" }).boundingBox();
        if (!bounds || bounds.x < 0 || bounds.x + bounds.width > width)
          throw new Error("Mobile model menu is clipped");
        await page.keyboard.press("Escape");
      }
      await page.screenshot({
        path: `output/playwright/branding-advisor-${dark ? "dark" : "light"}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Codebase Audit", exact: true }).click();
  await page.getByRole("button", { name: "Open Security Advisor", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Security Advisor" })
    .getByText("Fixture suggestion: review and test the change.", { exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Open full Security Advisor page" }).click();
  await page
    .getByText("Fixture suggestion: review and test the change.", { exact: true })
    .waitFor();
  console.log(
    "PASS model selection, keyboard dismissal, streaming, shared panel/page, both themes and viewport widths",
  );
  await page.goto(`${fixture}?view=advisor&state=slow`, { waitUntil: "domcontentloaded" });
  await page.getByText("Ready", { exact: true }).waitFor();
  await page
    .getByRole("textbox", { name: "Your security question" })
    .fill("Explain safe query parameters.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText("Preparing response…", { exact: true }).waitFor();
  await page.getByRole("button", { name: /Stop/ }).click();
  if ((await metrics()).advisorCancellations !== 1) throw new Error("Stream was not cancelled");
  console.log("PASS pending response and cancellation");
  await page.goto(`${fixture}?view=advisor&context=finding`, { waitUntil: "domcontentloaded" });
  await page.getByText(/Saved finding ·/).waitFor();
  await page.getByText("Ready", { exact: true }).waitFor();
  await page
    .getByRole("textbox", { name: "Your security question" })
    .fill("Suggest a fix for this finding.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page
    .getByText("Fixture suggestion: review and test the change.", { exact: true })
    .waitFor();
  if ((await metrics()).advisorContext?.finding_id !== "fixture-finding")
    throw new Error("Finding context was not sent");
  console.log("PASS saved finding context");
  await page.goto(`${fixture}?view=advisor&state=unavailable`, { waitUntil: "domcontentloaded" });
  await page.getByText("Not configured", { exact: true }).waitFor();
  if (!(await page.getByRole("button", { name: "Send", exact: true }).isDisabled()))
    throw new Error("Unavailable advisor allowed submission");
  console.log("PASS truthful unavailable state");
  await page.goto(`${fixture}?view=landing`, { waitUntil: "domcontentloaded" });
  await page.getByText("Illustrative example", { exact: true }).waitFor();
  for (const dark of [false, true]) {
    await page.evaluate((dark) => {
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    }, dark);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await checkLayout();
      await page.screenshot({
        path: `output/playwright/branding-landing-${dark ? "dark" : "light"}-${width}.png`,
        fullPage: true,
      });
    }
  }
  console.log("PASS landing workflow in both themes and viewport widths");
}
