async (page) => {
  for (const [url, name] of [
    ["http://127.0.0.1:5188/tests/findings-preview/index.html", "findings"],
    ["http://127.0.0.1:5189/tests/reports-preview/index.html", "reports"],
  ]) {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByRole("main").waitFor();
    await page.screenshot({ path: "docs/screenshots/" + name + ".png" });
  }
  await page.goto("http://127.0.0.1:5189/tests/reports-preview/index.html?detail=1", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /audit report/i }).waitFor();
  await page.screenshot({ path: "docs/screenshots/report-detail.png" });
  console.log("Refreshed Findings, Reports, and report detail.");
}
