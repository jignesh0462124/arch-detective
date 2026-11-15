// Isolated UI fixtures only. Does not contact a store, real account or provider.
// prettier-ignore
async (page) => {
  page.setDefaultTimeout(15000);
  const base = "http://127.0.0.1:5193/tests/workbench-preview/index.html";
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const open = async (query = "view=workbench&extension=1") => {
    await page.goto(`${base}?${query}`, { waitUntil: "commit" });
    await page.getByRole("heading", { name: /Audit Workbench|Codebase Audit/ }).first().waitFor();
    if (await page.locator("vite-error-overlay").count()) throw Error("Framework error overlay");
  };
  const panel = () => page.getByRole("region", { name: "Extension policy review" });
  const selectPolicy = async () => panel().getByRole("button", { name: /Chrome · Violation detected · security Remote script reference/ }).click();
  const noOverflow = async () => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error("Horizontal page overflow");
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open();
  await page.locator("[data-editor-instance][data-source-id]:not([data-source-id=''])").waitFor();
  await panel().getByText("65 matching results · 90 total checks").waitFor();
  await panel().getByRole("button", { name: "Next", exact: true }).click();
  await panel().getByText("Page 2", { exact: true }).waitFor();
  await panel().getByRole("button", { name: "Previous", exact: true }).click();
  await panel().getByRole("button", { name: "Permissions & browser settings", exact: true }).click();
  await panel().getByText("32 matching results · 90 total checks").waitFor();
  if (await panel().getByRole("button", { name: /Remote script reference/ }).count()) throw Error("Permissions area did not filter results");
  await panel().getByRole("button", { name: "Findings", exact: true }).click();
  await panel().getByRole("combobox", { name: "Filter policy outcome" }).selectOption("violation");
  await panel().getByText("1 matching results · 90 total checks").waitFor();
  await selectPolicy();
  await panel().getByRole("tab", { name: "Code solution", exact: true }).click();
  await panel().getByRole("link", { name: "Open in Security Advisor", exact: true }).click();
  await page.getByRole("heading", { name: "Security Advisor", exact: true }).waitFor();
  const returnLink = page.getByRole("link", { name: "Open source", exact: true });
  if (!(await returnLink.getAttribute("href")).includes("policyId=")) throw Error("Policy source deep link missing");
  await returnLink.click();
  await page.locator("[data-editor-instance][data-source-id]:not([data-source-id=''])").waitFor();
  await panel().getByRole("heading", { name: "Remote script reference", exact: true }).waitFor();
  await panel().getByRole("button", { name: "Open recorded source", exact: true }).click();
  await page.getByText("typescript · Line 2", { exact: true }).waitFor();
  await panel().getByRole("textbox", { name: "Reviewer note", exact: true }).fill("Verified with the synthetic review fixture.");
  await panel().getByRole("button", { name: "Save review note", exact: true }).click();
  await panel().getByText("Review note saved. Automated outcome is unchanged.").waitFor();
  await panel().getByRole("tab", { name: "Code solution", exact: true }).click();
  await panel().getByRole("button", { name: "Generate code suggestion", exact: true }).click();
  await panel().getByRole("button", { name: "Copy code", exact: true }).waitFor();
  const context = JSON.parse(await page.getByRole("status", { name: "Workbench fixture performance" }).textContent()).advisorContext;
  if (context?.policy_result_id !== "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee") throw Error("Policy context lost during generation");
  const advisorLink = await panel().getByRole("link", { name: "Open in Security Advisor", exact: true }).getAttribute("href");
  if (!advisorLink.includes("conversation=")) throw Error("Exact suggestion conversation missing");
  for (const dark of [false, true]) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.evaluate(value => { document.documentElement.classList.toggle("dark", value); document.documentElement.dataset.theme = value ? "dark" : "light"; }, dark);
    await noOverflow();
    const noticeButton = panel().getByRole("button", { name: "View violation notice example", exact: true });
    await noticeButton.click();
    const dialog = page.getByRole("dialog", { name: "Policy notice example", exact: true });
    await dialog.getByText("Illustrative example — not a notice sent by Google or Microsoft", { exact: true }).waitFor();
    await dialog.getByText("Redacted reference supplied by a user", { exact: true }).click();
    await dialog.getByRole("img").first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll("dialog img")].every(image => image.complete && image.naturalWidth > 0));
    await noOverflow();
    await page.screenshot({ path: `C:/Users/jigne/AppData/Local/Temp/archon-extension-${dark ? "dark" : "light"}-${width}.png` });
    await page.keyboard.press("Escape");
    if (await dialog.count()) throw Error("Notice did not close with Escape");
    if (!(await noticeButton.evaluate(element => element === document.activeElement))) throw Error("Notice focus not restored");
  }
  await panel().getByRole("button", { name: "Listing & privacy", exact: true }).click();
  await panel().getByText("Read documents", { exact: true }).waitFor();
  await panel().getByRole("button", { name: "Compare reviews", exact: true }).click();
  await panel().getByRole("combobox", { name: "Previous extension review" }).selectOption("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  await panel().getByText(/still present — Remote script reference/).waitFor();
  await open("view=upload&extension=1");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Browser extension", exact: true }).click();
  await page.getByLabel("Built extension ZIP", { exact: false }).setInputFiles({ name: "fixture.zip", mimeType: "application/zip", buffer: Buffer.from("UI transport fixture; real archive validation is covered by backend tests") });
  await page.getByRole("button", { name: "Start extension review", exact: true }).click();
  await page.getByRole("heading", { name: "Audit Workbench", exact: true }).waitFor();
  await panel().waitFor();
  await open("view=workbench&extension=1&role=viewer");
  await selectPolicy();
  if (await panel().getByRole("button", { name: "Save review note", exact: true }).count()) throw Error("Viewer can save a review note");
  await panel().getByRole("tab", { name: "Code solution", exact: true }).click();
  await panel().getByText("Viewers can read remedies. Ask an analyst to request a code suggestion.", { exact: true }).waitFor();
  if (errors.length) throw Error(errors.join("\n"));
  console.log("PASS extension upload/navigation, policy paging/filtering, source, notes, policy-specific suggestion, conversation link, notice images/Escape/focus, comparison, viewer restrictions, desktop/mobile and both themes");
}
