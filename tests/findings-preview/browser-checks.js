// Run with: playwright-cli -s=findings-qa run-code --filename=tests/findings-preview/browser-checks.js
async function checkFindings(page) {
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks.push(message);
  };
  await page.goto("http://127.0.0.1:5176/tests/findings-preview/index.html");
  const main = page.getByRole("main");
  await main.getByRole("heading", { name: "105 matching findings" }).waitFor();
  if (await main.getByRole("button", { name: "Switch to light mode", exact: true }).count()) {
    await main.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  }
  assert(
    (await main.getByLabel("Findings list").getByRole("button").count()) === 50,
    "First page contains 50 findings",
  );
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await main.getByText("51–100 of 105", { exact: true }).waitFor();
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await main.getByText("101–105 of 105", { exact: true }).waitFor();
  assert(
    (await main.getByLabel("Findings list").getByRole("button").count()) === 5,
    "Last page is not truncated or duplicated",
  );
  await main.getByRole("button", { name: "Previous", exact: true }).click();
  await main.getByText("51–100 of 105", { exact: true }).waitFor();
  await main.getByRole("button", { name: "Previous", exact: true }).click();
  await main.getByText("1–50 of 105", { exact: true }).waitFor();
  await main.getByRole("button", { name: /^Untrusted input reaches/ }).click();
  await main.getByText("SOC2 · CC6.1", { exact: true }).waitFor();
  for (const [action, state] of [
    ["Resolve", "Resolved"],
    ["Accept risk", "Accepted risk"],
    ["False positive", "False positive"],
    ["Reopen", "Open"],
  ]) {
    await main.getByRole("button", { name: action, exact: true }).click();
    await main.getByText(`${state} · static-rule`, { exact: true }).waitFor();
  }
  assert(
    await main.getByRole("button", { name: "Resolve", exact: true }).isEnabled(),
    "All four status transitions refresh the detail panel",
  );
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/playwright/findings/desktop-light.png" });
  await main.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  await page.screenshot({ path: "output/playwright/findings/desktop-dark.png" });
  await main.getByRole("button", { name: "Close detail", exact: true }).click();
  await main.getByRole("combobox", { name: "Status", exact: true }).selectOption("resolved");
  await main.getByText("No findings match these filters", { exact: true }).waitFor();
  assert(
    (await main.getByText("105", { exact: true }).count()) >= 1,
    "Scan totals remain unchanged by status filtering",
  );
  await main.getByRole("button", { name: "Reset", exact: true }).click();
  await main.getByRole("textbox", { name: "Search findings", exact: true }).fill("database query");
  await main.getByRole("button", { name: "Search", exact: true }).click();
  await main.getByRole("heading", { name: "1 matching finding", exact: true }).waitFor();
  await main.getByRole("button", { name: "Filters · active", exact: true }).click();
  assert(
    (await main.getByRole("textbox", { name: "Search findings", exact: true }).count()) === 0,
    "Filter button collapses its fields",
  );
  await main.getByRole("button", { name: "Filters · active", exact: true }).click();
  await main.getByRole("button", { name: "Reset", exact: true }).click();
  const download = page.waitForEvent("download");
  await main.getByRole("button", { name: "JSON", exact: true }).click();
  assert(
    (await download).suggestedFilename().endsWith(".json"),
    "Filtered export initiates a download",
  );
  await main
    .getByRole("combobox", { name: "Completed scan", exact: true })
    .selectOption("33333333-3333-4333-8333-333333333333");
  await main.getByText("No findings recorded for this scan", { exact: true }).waitFor();
  assert(
    await main.getByRole("button", { name: "JSON", exact: true }).isDisabled(),
    "Empty scans disable export",
  );
  await main
    .getByRole("combobox", { name: "Completed scan", exact: true })
    .selectOption("22222222-2222-4222-8222-222222222222");
  await main.getByRole("heading", { name: "105 matching findings" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/playwright/findings/mobile-dark.png" });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "Mobile filters/list have no horizontal overflow",
  );
  await main.getByRole("button", { name: /^Untrusted input reaches/ }).click();
  await main.getByText("SOC2 · CC6.1", { exact: true }).waitFor();
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "Mobile evidence/controls have no horizontal overflow",
  );
  await main.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/playwright/findings/mobile-light.png" });
  for (const [state, expected] of [
    ["no-scans", "No completed scans available"],
    ["empty", "No findings recorded for this scan"],
    [
      "error",
      "The audit service is temporarily unavailable. Your session and saved findings are unchanged. Retry shortly.",
    ],
    ["denied", "This scan or finding is unavailable, or you no longer have access."],
  ]) {
    await page.goto(`http://127.0.0.1:5176/tests/findings-preview/index.html?state=${state}`);
    await page.getByRole("main").getByText(expected, { exact: true }).waitFor();
    checks.push(`Explicit ${state} state`);
  }
  await page.goto("http://127.0.0.1:5176/tests/findings-preview/index.html?role=viewer");
  await page
    .getByRole("main")
    .getByRole("button", { name: /^Untrusted input reaches/ })
    .click();
  await page
    .getByRole("main")
    .getByText("Read-only access. An analyst, admin or owner can change this status.", {
      exact: true,
    })
    .waitFor();
  assert(
    (await page.getByRole("button", { name: "Resolve", exact: true }).count()) === 0,
    "Viewers cannot see triage actions",
  );
  await page.goto("http://127.0.0.1:5176/tests/findings-preview/index.html?state=write-error");
  await page
    .getByRole("main")
    .getByRole("button", { name: /^Untrusted input reaches/ })
    .click();
  await page.getByRole("button", { name: "Resolve", exact: true }).click();
  await page
    .getByRole("main")
    .getByText("Findings could not be loaded or saved. Check your connection and try again.", {
      exact: true,
    })
    .waitFor();
  assert(
    await page.getByRole("button", { name: "Resolve", exact: true }).isEnabled(),
    "Rejected writes do not report success or change status",
  );
  return { passed: checks.length, checks };
}
