async (page) => {
  const base = "http://127.0.0.1:5187/tests/workbench-preview/index.html";
  for (const [view, name] of [
    ["upload", "codebase-audit"],
    ["workbench", "workbench"],
    ["scan", "scan-progress"],
    ["graph", "attack-graph"],
    ["profile", "profile"],
  ]) {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(base + "?view=" + view, { waitUntil: "domcontentloaded" });
    await page.locator("body").waitFor();
    await page.screenshot({ path: "output/playwright/readme-" + name + ".png", fullPage: true });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error("Overflow in " + view);
  }
  console.log("Captured upload, workbench, scan progress, attack graph and profile fixture states.");
}
