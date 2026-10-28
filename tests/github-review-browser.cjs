// Run with playwright-cli run-code --filename tests/github-review-browser.cjs.
// Fixture-only: no real GitHub identity, repository, commit or PR is accessed.
// Playwright CLI requires a function expression without a trailing semicolon.
// prettier-ignore
async (page) => {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const base = "http://127.0.0.1:5193/tests/workbench-preview/index.html";
  const setTheme = async (dark) => {
    const toggle = page.getByRole("button", {
      name: dark ? "Switch to dark mode" : "Switch to light mode",
      exact: true,
    });
    if (await toggle.count()) await toggle.click();
  };
  await page.goto(`${base}?view=fixes`);
  await page.getByRole("button", { name: "Suggest fix", exact: true }).click();
  await page.getByRole("button", { name: "Full-screen diff", exact: true }).waitFor();
  await page.getByRole("button", { name: "Full-screen diff", exact: true }).click();
  await page.getByRole("button", { name: "Close diff", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  if (await page.locator("dialog[open]").count()) throw new Error("Escape did not close the diff");
  await page.getByRole("button", { name: "Run checks", exact: true }).click();
  await page.getByText("src/server.ts: passed", { exact: true }).waitFor();
  const publish = page.getByRole("button", { name: "Commit & create PR", exact: true });
  if (await publish.isEnabled()) throw new Error("Publishing enabled without explicit review");
  await page
    .getByRole("checkbox", {
      name: "I reviewed this exact diff, repository, target branch and commit message.",
    })
    .check();
  if (!(await publish.isEnabled())) throw new Error("Reviewed valid proposal cannot publish");
  for (const dark of [false, true]) {
    await setTheme(dark);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw new Error(`Fix page overflow at ${width}`);
      await page.screenshot({
        path: `output/playwright/github-fixes-${dark ? "dark" : "light"}-${width}.png`,
        fullPage: true,
      });
    }
  }
  // This publishes only to the in-memory fixture transport.
  await publish.click();
  await page.getByRole("link", { name: "View pull request on GitHub", exact: true }).waitFor();
  await page.getByRole("button", { name: "Rescan PR branch", exact: true }).waitFor();
  await page.goto(`${base}?view=upload`);
  await page.getByRole("button", { name: "GitHub repository", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Shared repository", exact: true })
    .selectOption("66666666-6666-4666-8666-666666666666");
  await page.getByRole("combobox", { name: "Repository branch", exact: true }).selectOption("main");
  for (const dark of [false, true]) {
    await setTheme(dark);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw new Error(`Repository page overflow at ${width}`);
      await page.screenshot({
        path: `output/playwright/github-repository-${dark ? "dark" : "light"}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.getByRole("button", { name: "Upload ZIP", exact: true }).click();
  await page.getByRole("button", { name: /Drop a project ZIP here/ }).waitFor();
  return "PASS: proposal review, syntax-check gating, full-screen diff/Escape, synthetic publication, rescan action, repository selection, preserved ZIP flow; desktop/mobile in both themes.";
}
