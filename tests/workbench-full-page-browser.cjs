// Isolated workbench fixture; no saved scans or real accounts are changed.
// prettier-ignore
async (page) => {
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("http://127.0.0.1:5193/tests/workbench-preview/index.html?view=workbench");
  // The fixture banner is not part of the application viewport.
  await page.locator("#root > div").first().evaluate(element => {
    if (element.textContent.startsWith("Isolated UI test")) element.style.display = "none";
  });
  const expand = page.getByRole("button", { name: "Expand workbench", exact: true });
  const footer = page.getByText("Read only · Snapshot retained", { exact: true });
  await footer.waitFor();
  const editor = page.locator("[data-editor-instance][data-source-id]:not([data-source-id=''])");
  await editor.waitFor();
  const instance = await editor.getAttribute("data-editor-instance");
  const sourceId = await editor.getAttribute("data-source-id");
  const metrics = () => page.getByRole("status", { name: "Workbench fixture performance" }).textContent().then(JSON.parse);
  const checkSourceFit = async () => {
    const fit = await page.getByTestId("source-panel").evaluate(element => {
      const pane = element.getBoundingClientRect();
      const pager = element.lastElementChild.getBoundingClientRect();
      const code = element.querySelector(".workbench-code-height").getBoundingClientRect();
      const main = element.closest("main");
      return {
        paneBottomGap: pane.bottom - pager.bottom,
        codeHeight: code.height,
        codeOverlapsPager: code.bottom > pager.top + 1,
        horizontalOverflow: main.scrollWidth > main.clientWidth + 1,
      };
    });
    if (Math.abs(fit.paneBottomGap) > 1 || fit.codeOverlapsPager || fit.codeHeight <= 0 || fit.horizontalOverflow)
      throw Error(`Source pane does not fit: ${JSON.stringify(fit)}`);
    return fit;
  };
  const normalMeasurements = [];
  for (const dark of [false, true]) {
    await page.evaluate(value => {
      document.documentElement.dataset.theme = value ? "dark" : "light";
      document.documentElement.classList.toggle("dark", value);
    }, dark);
    for (const [width, height] of [[1920, 1080], [1440, 900], [1024, 768], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await footer.waitFor();
      const fit = await checkSourceFit();
      normalMeasurements.push({ width, height, dark, ...fit });
      if (width >= 1024) {
        const footerFits = await footer.evaluate(element => {
          const main = element.closest("main");
          return element.getBoundingClientRect().bottom <= main.getBoundingClientRect().bottom - parseFloat(getComputedStyle(main).paddingBottom) + 1;
        });
        if (!footerFits) throw Error("Normal workbench footer is outside the usable viewport");
      }
      if (width === 1440 || width === 390)
        await page.screenshot({ path: `C:/Users/jigne/AppData/Local/Temp/archon-workbench-normal-${dark ? "dark" : "light"}-${width}-fit.png` });
    }
  }
  await page.getByRole("tab", { name: "Findings", exact: true }).click();
  await page.getByRole("region", { name: "Audit problems and activity", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Files", exact: true }).click();
  await page.getByRole("complementary", { name: "Source files", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Code", exact: true }).click();
  await checkSourceFit();
  await page.setViewportSize({ width: 1920, height: 1080 });
  const before = await metrics();
  await expand.click();
  await page.locator(".workbench-full").waitFor();
  if (await footer.count()) throw Error("Standalone footer still occupies fullscreen space");
  for (const [hide, show] of [["Hide files", "Show files"], ["Hide details", "Show details"]]) {
    await page.getByRole("button", { name: hide, exact: true }).click();
    await checkSourceFit();
    await page.getByRole("button", { name: show, exact: true }).click();
  }
  const measurements = [];
  for (const dark of [false, true]) {
    await page.evaluate(value => {
      document.documentElement.dataset.theme = value ? "dark" : "light";
      document.documentElement.classList.toggle("dark", value);
    }, dark);
    for (const [width, height] of [[1920, 1080], [1440, 900], [1024, 768], [390, 844], [844, 390]]) {
      await page.setViewportSize({ width, height });
      const result = await page.locator(".audit-workbench-grid").evaluate(element => {
        const rect = element.getBoundingClientRect();
        const main = element.closest("main");
        return {
          bottomGap: innerHeight - rect.bottom,
          horizontalOverflow: main.scrollWidth > main.clientWidth + 1,
        };
      });
      if (result.bottomGap > 1) throw Error(`Unused fullscreen bottom space: ${JSON.stringify({ width, height, ...result })}`);
      if (width >= 1024 && result.bottomGap < -1) throw Error("Desktop workbench exceeds viewport height");
      if (result.horizontalOverflow) throw Error("Fullscreen workbench overflows horizontally");
      await checkSourceFit();
      measurements.push({ width, height, dark, ...result });
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({ path: `C:/Users/jigne/AppData/Local/Temp/archon-workbench-full-${dark ? "dark" : "light"}-no-bottom-gap.png` });
  }
  await page.getByRole("button", { name: "Exit full page", exact: true }).click();
  await footer.waitFor();
  await expand.waitFor();
  if (await editor.getAttribute("data-editor-instance") !== instance) throw Error("Fullscreen toggle remounted source editor");
  if (await editor.getAttribute("data-source-id") !== sourceId) throw Error("Fullscreen toggle lost selected source");
  const after = await metrics();
  if (before.sourceDownloads !== after.sourceDownloads) throw Error("Fullscreen toggle unnecessarily redownloaded source");
  await expand.click();
  await page.keyboard.press("Escape");
  await footer.waitFor();
  if (!(await expand.evaluate(element => element === document.activeElement))) throw Error("Exit did not restore focus");
  if (await page.locator("vite-error-overlay").count()) throw Error("Framework error overlay");
  if (errors.length) throw Error(errors.join("\n"));
  return { result: "PASS: normal/fullscreen editor and pager fit, mobile Code/Files/Findings tabs, editor/source preserved, Escape/focus and both themes", normalMeasurements, measurements };
}
