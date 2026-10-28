// Run using the Playwright CLI's run-code --filename option.
async function checkContrast(page) {
  page.setDefaultTimeout(10000);
  await page.goto("http://127.0.0.1:5176/");
  await page.setViewportSize({ width: 1440, height: 960 });
  const main = page.getByRole("main");
  await main.getByRole("heading", { name: "105 matching findings" }).waitFor();
  if (await main.getByRole("button", { name: "Switch to light mode", exact: true }).count())
    await main.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await main.getByRole("button", { name: /^Untrusted input reaches/ }).click();
  await main.getByText("SOC2 · CC6.1", { exact: true }).waitFor();
  for (const theme of ["light", "dark"]) {
    const evidenceColor = await main.locator("pre").evaluate((el) => getComputedStyle(el).color);
    const pagingColor = await main
      .getByRole("button", { name: "Next", exact: true })
      .evaluate((el) => getComputedStyle(el).color);
    if (evidenceColor !== "rgb(255, 255, 255)" || pagingColor !== "rgb(255, 255, 255)")
      throw new Error(`Unreadable ${theme} evidence/pagination: ${evidenceColor}, ${pagingColor}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/playwright/findings/desktop-${theme}.png` });
    if (theme === "light")
      await main.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["dark", "light"]) {
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error(`Horizontal overflow in ${theme}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/playwright/findings/mobile-${theme}.png` });
    if (theme === "dark")
      await main.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  }
  return { passed: true, evidenceAndPaginationContrast: "both themes", mobileOverflow: false };
}
