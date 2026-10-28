// Playwright CLI requires a function expression without a trailing semicolon.
// prettier-ignore
async (page) => {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const passed = [];
  await page.goto("http://127.0.0.1:5177/tests/reports-preview/index.html");
  await page.getByRole("heading", { name: "Completed audits", exact: true }).waitFor();
  await page.getByRole("checkbox").first().waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Page 2 · 31 matching reports").waitFor();
  passed.push("library pagination");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByLabel("Search project or scan ID").fill("missing");
  await page.getByRole("heading", { name: "No matching reports" }).waitFor();
  passed.push("no matches");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("checkbox").first().waitFor();
  for (let n = 0; n < 8; n++) await page.getByRole("checkbox").nth(n).check();
  await page.getByRole("button", { name: "Download selected ZIP", exact: true }).click();
  await page.getByText("ZIP download started: 8 reports included.", { exact: true }).waitFor();
  passed.push("ZIP of eight PDFs");
  for (const theme of ["light", "dark"]) {
    await page.goto("http://127.0.0.1:5177/tests/reports-preview/index.html?theme=" + theme);
    await page.getByRole("heading", { name: "Completed audits", exact: true }).waitFor();
    await page.waitForFunction(
      (expected) => document.documentElement.dataset.theme === expected,
      theme,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: "output/playwright/reports-library-" + theme + ".png" });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error("Desktop overflow: " + theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "output/playwright/reports-mobile-" + theme + ".png" });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error("Mobile overflow: " + theme);
    passed.push(theme + " library desktop/mobile");
    await page.goto("http://127.0.0.1:5177/tests/reports-preview/index.html?detail=1&theme=" + theme);
    await page.getByRole("heading", { name: "Executive summary", exact: true }).waitFor();
    await page.waitForFunction(
      (expected) => document.documentElement.dataset.theme === expected,
      theme,
    );
    await page.screenshot({ path: "output/playwright/report-detail-mobile-" + theme + ".png" });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error("Detail mobile overflow: " + theme);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: "output/playwright/report-detail-" + theme + ".png" });
    await page.getByRole("button", { name: /Finding 1:/ }).click();
    await page.getByRole("dialog", { name: "Finding evidence", exact: true }).waitFor();
    await page.getByText("CC6.1", { exact: false }).waitFor();
    await page.keyboard.press("Escape");
    await page
      .getByRole("dialog", { name: "Finding evidence", exact: true })
      .waitFor({ state: "hidden" });
    passed.push(theme + " evidence dialog and Escape");
    await page.getByRole("checkbox", { name: "SOC 2", exact: true }).uncheck();
    await page.getByRole("button", { name: /Finding 1:/ }).click();
    await page
      .getByText("No control mapping was recorded for the selected frameworks.", { exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("checkbox", { name: "GDPR", exact: true }).uncheck();
    await page
      .getByText("Security-only report. No framework scores or mappings selected.", { exact: true })
      .waitFor();
    passed.push(theme + " framework scope and security-only report");
    passed.push(theme + " detail desktop/mobile");
  }
  for (const [scenario, title] of [
    ["empty", "No completed audits available"],
    ["error", "Report preparation is busy or unavailable. Wait a moment and retry."],
    ["denied", "This report is unavailable, or you no longer have access."],
  ]) {
    await page.goto("http://127.0.0.1:5177/tests/reports-preview/index.html?scenario=" + scenario);
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    passed.push(scenario + " explicit state");
  }
  return { passed };
}
