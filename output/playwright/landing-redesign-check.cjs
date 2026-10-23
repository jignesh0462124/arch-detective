async (page) => {
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Switch to dark mode" }).waitFor();
  await page.getByRole("heading", { name: "Make your next review clearer." }).scrollIntoViewIfNeeded();
  await page.locator('img[src="/assets/archon-infrastructure-backdrop.webp"]').evaluate(image => image.decode());
  for (const dark of [false, true]) {
    if (dark) await page.getByRole("button", { name: "Switch to dark mode" }).click();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw new Error("Page overflow at " + width);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({
        path: "output/playwright/landing-redesign-" + (dark ? "dark" : "light") + "-" + width + ".png",
        fullPage: true,
      });
    }
  }
  await page.getByText("Review finding", { exact: true }).click();
  await page.getByText(/This example is not a saved scan result/).waitFor({ state: "visible" });
  await page.getByText("Review finding", { exact: true }).press("Enter");
  if (await page.getByText(/This example is not a saved scan result/).isVisible())
    throw new Error("Keyboard did not collapse finding explanation");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation", { name: "Mobile marketing" }).getByRole("link", { name: "Workflow", exact: true }).click();
  if (!page.url().endsWith("#pipeline")) throw new Error("Workflow anchor did not navigate");
  if (await page.getByRole("navigation", { name: "Mobile marketing" }).isVisible())
    throw new Error("Mobile navigation remained open");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.keyboard.press("Escape");
  if (await page.getByRole("navigation", { name: "Mobile marketing" }).isVisible())
    throw new Error("Escape did not close navigation");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Start an audit", exact: true }).click();
  await page.waitForURL("**/login");
  await page.goto("http://127.0.0.1:5173/about");
  await page.getByRole("banner").getByRole("link", { name: "Workflow", exact: true }).click();
  await page.waitForURL("**/#pipeline");
  const images = await page.locator("main img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0));
  if (!images) throw new Error("Artwork did not load");
  console.log("PASS both themes, desktop/tablet/mobile (320–1440), no overflow, finding disclosure keyboard control, mobile menu/Escape, login CTA, About navigation, original artwork.");
}
