// Isolated fixtures only: no uploaded source or real provider requests.
// prettier-ignore
async (page) => {
  page.setDefaultTimeout(15000);
  const base = "http://127.0.0.1:5193/tests/workbench-preview/index.html?view=workbench";
  const open = async (state = "ready") => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "&state=" + state, { waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: "Remediation", exact: true }).click();
    await page.getByRole("tab", { name: "Code solution", exact: true }).click();
  };
  const requests = async () => JSON.parse(await page.getByRole("status", { name: "Workbench fixture performance" }).textContent()).advisorRequests;
  await open();
  await page.getByRole("button", { name: "Generate code suggestion", exact: true }).click();
  await page.getByRole("button", { name: "Copy code", exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => b.textContent === "Copy code" && !b.disabled));
  await page.getByRole("heading", { name: "How to verify", exact: true }).waitFor();
  if (await page.getByRole("tabpanel", { name: "Code solution", exact: true }).getByText("Security Advisor", { exact: true }).count()) throw Error("Chat chrome leaked into solution");
  const conversation = await page.getByRole("link", { name: "Open in Security Advisor", exact: true }).getAttribute("href");
  if (!conversation.includes("conversation=")) throw Error("Missing exact conversation link");
  await page.getByRole("tab", { name: "Steps", exact: true }).click();
  await page.getByRole("tab", { name: "Code solution", exact: true }).click();
  await page.getByRole("tab", { name: "Evidence", exact: true }).click();
  await page.getByRole("tab", { name: "Remediation", exact: true }).click();
  if (await requests() !== 1) throw Error("Tab switch regenerated code");
  await page.getByRole("button", { name: "Expand code", exact: true }).click();
  await page.getByRole("button", { name: "Collapse code", exact: true }).waitFor();
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("fixture denial")) } }));
  await page.getByRole("button", { name: "Copy code", exact: true }).click();
  await page.getByText("Could not copy. Select the code and copy manually.", { exact: true }).waitFor();
  for (const dark of [false, true]) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    if (!(await page.getByRole("tab", { name: "Remediation", exact: true }).count()))
      await page.getByRole("button", { name: "Open finding details", exact: true }).click();
    await page.getByRole("tab", { name: "Remediation", exact: true }).last().click();
    await page.getByRole("tab", { name: "Code solution", exact: true }).last().click();
    await page.evaluate(dark => { document.documentElement.classList.toggle("dark", dark); document.documentElement.dataset.theme = dark ? "dark" : "light"; }, dark);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error("Horizontal overflow");
    await page.screenshot({ path: "output/playwright/code-solution-" + (dark ? "dark" : "light") + "-" + width + ".png", fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
  await page.getByRole("complementary", { name: "Finding inspector", exact: true }).getByRole("button", { name: "Next finding", exact: true }).click();
  await page.getByRole("tab", { name: "Code solution", exact: true }).click();
  if (await page.getByRole("button", { name: "Copy code", exact: true }).count()) throw Error("Previous finding response leaked");
  await open("solution-truncated");
  await page.getByRole("button", { name: "Generate code suggestion", exact: true }).click();
  await page.getByText("Incomplete suggestion. Regenerate before using this code.", { exact: true }).waitFor();
  if (!(await page.getByRole("button", { name: "Copy code", exact: true }).isDisabled())) throw Error("Incomplete code can be copied");
  await open("solution-reject");
  await page.getByRole("button", { name: "Generate code suggestion", exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => b.textContent === "Copy code" && !b.disabled));
  const previous = await page.getByRole("link", { name: "Open in Security Advisor", exact: true }).getAttribute("href");
  await page.getByRole("button", { name: "Regenerate code suggestion", exact: true }).click();
  await page.getByText(/The new suggestion could not be started/).waitFor();
  if (await page.getByRole("link", { name: "Open in Security Advisor", exact: true }).getAttribute("href") !== previous) throw Error("Rejected generation replaced previous result");
  if (!(await page.getByRole("button", { name: "Copy code", exact: true }).isEnabled())) throw Error("Previous solution lost after failure");
  await open("solution-slow");
  await page.getByRole("button", { name: "Generate code suggestion", exact: true }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByText("Incomplete suggestion. Regenerate before using this code.", { exact: true }).waitFor();
  if (await requests() !== 1) throw Error("Stop automatically replayed the request");
  return "PASS: structured solution, exact conversation, tab reuse, clipboard failure, both themes/mobile, finding isolation, truncation and failed regeneration";
}
