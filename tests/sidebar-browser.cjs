// Shared shell with isolated workspace fixtures; never accesses real accounts.
// prettier-ignore
async (page) => {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const base = "http://127.0.0.1:5193/tests/workbench-preview/index.html";
  const open = async (view) => page.goto(base + "?view=" + view, { waitUntil: "domcontentloaded" });
  const sidebar = () => page.getByTestId("desktop-sidebar");
  const drawer = () => page.getByRole("dialog", { name: "Application navigation", exact: true });
  const toggle = () => page.getByRole("button", { name: /^(Collapse|Expand) sidebar$/, exact: false });
  const overflow = async () => { if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error("Page overflows"); };
  const extraOnly = page.url().includes("sidebar-extra=1");
  if (!extraOnly) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open("upload");
  await page.evaluate(() => localStorage.removeItem("archon-sidebar-v1"));
  await page.reload();
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await page.waitForFunction(() => Math.abs(document.querySelector('[data-testid="desktop-sidebar"]').getBoundingClientRect().width - 72) < 1);
  if (!(await sidebar().getByRole("link", { name: "Settings", exact: true }).count())) throw Error("Collapsed icon lost accessible name");
  await page.reload();
  await page.getByRole("button", { name: "Expand sidebar", exact: true }).waitFor();
  await sidebar().getByRole("link", { name: "Security Advisor", exact: true }).click();
  await page.getByRole("heading", { name: "Security Advisor", exact: true }).waitFor();
  if (await sidebar().getAttribute("data-collapsed") !== "true") throw Error("Preference lost on navigation");
  await page.getByRole("textbox", { name: "Your security question", exact: true }).fill("Keep my unfinished question");
  await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  if (await page.getByRole("textbox", { name: "Your security question", exact: true }).inputValue() !== "Keep my unfinished question") throw Error("Advisor composer reset");
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await page.getByRole("button", { name: "Expand sidebar to choose workspace", exact: true }).click();
  const switcher = sidebar().getByRole("button", { name: /UI test workspace/ });
  if (!(await switcher.evaluate(e => e === document.activeElement))) throw Error("Workspace switcher not focused");
  await sidebar().getByRole("link", { name: "Codebase Audit", exact: true }).click();
  if (await sidebar().getByRole("link", { name: "Codebase Audit", exact: true }).getAttribute("aria-current") !== "page") throw Error("Active route missing");
  for (const width of [390, 768, 1023]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await drawer().waitFor();
    if (await page.evaluate(() => document.body.style.overflow) !== "hidden") throw Error("Background not locked");
    await page.keyboard.press("Shift+Tab");
    if (!(await drawer().evaluate(e => e.contains(document.activeElement)))) throw Error("Focus escaped drawer");
    await page.keyboard.press("Escape");
    await drawer().waitFor({ state: "hidden" });
    if (!(await page.getByRole("button", { name: "Open navigation", exact: true }).evaluate(e => e === document.activeElement))) throw Error("Focus not restored");
    await page.getByRole("button", { name: "More navigation", exact: true }).click();
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    if (await page.getByRole("button", { name: "More navigation", exact: true }).getAttribute("aria-expanded") !== "false") throw Error("More and drawer both open");
    await drawer().getByRole("button", { name: /UI test workspace/ }).click();
    await page.keyboard.press("Escape");
    if (!(await drawer().isVisible())) throw Error("Escape closed drawer instead of workspace dropdown");
    await drawer().getByRole("link", { name: "Security Advisor", exact: true }).click();
    await drawer().waitFor({ state: "hidden" });
    await page.getByRole("heading", { name: "Security Advisor", exact: true }).waitFor();
    await overflow();
  }
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await drawer().waitFor({ state: "hidden" });
  await toggle().waitFor();
  for (const dark of [false, true]) for (const width of [390, 768, 1023, 1024, 1440]) {
    await open("upload");
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(dark => { document.documentElement.classList.toggle("dark", dark); document.documentElement.dataset.theme = dark ? "dark" : "light"; }, dark);
    if (width < 1024) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await overflow();
    await page.screenshot({ path: "output/playwright/sidebar-" + (dark ? "dark" : "light") + "-" + width + ".png", fullPage: false });
    if (width < 1024) await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await drawer().getByRole("link", { name: "Profile", exact: true }).scrollIntoViewIfNeeded();
  await drawer().getByRole("button", { name: "Close navigation", exact: true }).scrollIntoViewIfNeeded();
  await page.mouse.click(835, 100);
  await drawer().waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open("workbench");
  const metrics = async () => JSON.parse(await page.getByRole("status", { name: "Workbench fixture performance" }).textContent());
  await page.getByRole("region", { name: "Source viewer", exact: true }).waitFor();
  await page.waitForFunction(() => JSON.parse(document.querySelector('[aria-label="Workbench fixture performance"]').textContent).editorMounts >= 1);
  const before = await metrics();
  await toggle().click(); await toggle().click();
  const after = await metrics();
  if (before.editorMounts !== after.editorMounts || before.sourceDownloads !== after.sourceDownloads) throw Error("Toggling remounted editor or downloaded source");
  const saved = await sidebar().getAttribute("data-collapsed");
  await page.getByRole("button", { name: "Expand workbench", exact: true }).click();
  if (await sidebar().isVisible()) throw Error("Sidebar visible in immersive workbench");
  await page.keyboard.press("Escape");
  if (await sidebar().getAttribute("data-collapsed") !== saved) throw Error("Immersive mode reset preference");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open("graph");
  await page.getByRole("region", { name: "Attack graph canvas", exact: true }).waitFor();
  await toggle().click();
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await overflow();
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (!(await sidebar().evaluate(e => { const style = getComputedStyle(e); return style.transitionProperty === "none" || style.transitionDuration === "0s"; }))) throw Error("Reduced motion ignored");
  await open("settings");
  await page.getByRole("textbox", { name: "Workspace name", exact: true }).fill("Keep this unsaved workspace name");
  await toggle().click();
  if (await page.getByRole("textbox", { name: "Workspace name", exact: true }).inputValue() !== "Keep this unsaved workspace name") throw Error("Unsaved settings reset");
  await page.getByRole("textbox", { name: "Workspace name", exact: true }).fill("UI test workspace");
  await open("advisor");
  await page.evaluate(() => localStorage.removeItem("archon-sidebar-v1"));
  await page.reload();
  await page.getByRole("button", { name: "Expand sidebar", exact: true }).waitFor();
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key === "archon-sidebar-v1") throw Error("fixture storage denied"); return get.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key === "archon-sidebar-v1") throw Error("fixture storage denied"); return set.call(this, key, value); };
  });
  await open("upload");
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await page.getByRole("button", { name: "Expand sidebar", exact: true }).waitFor();
  await sidebar().getByRole("link", { name: "Security Advisor", exact: true }).click();
  await page.getByRole("heading", { name: "Security Advisor", exact: true }).waitFor();
  if (await sidebar().getAttribute("data-collapsed") !== "true") throw Error("Storage denial lost in-memory preference");
  return "PASS: rail persistence, route navigation, composer/editor preservation, workspace focus, drawer/focus/Escape/scroll lock, breakpoints, both themes and immersive workbench";
}
