// Isolated fixture checks; run using playwright-cli run-code --filename.
// Playwright CLI requires a function expression without a trailing semicolon.
// prettier-ignore
async (page) => {
  const base = "http://127.0.0.1:5193/tests/workbench-preview/index.html?view=preferences";
  const open = async (section, extra = "") => {
    await page.goto(`${base}&section=${section}${extra}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Make Archon work for you" }).waitFor();
  };
  const overflow = async () => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw Error("Horizontal overflow");
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open("overview");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== "dark")
    throw Error("Dark preference failed");
  await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  if (
    (await page
      .getByRole("button", { name: "Light", exact: true })
      .getAttribute("aria-pressed")) !== "true"
  )
    throw Error("Theme controls diverged");
  const second = await page.context().newPage();
  await second.goto(base);
  await second.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Switch to light mode", exact: true }).waitFor();
  await second.close();
  for (const dark of [false, true]) {
    const toggle = page.getByRole("button", {
      name: dark ? "Switch to dark mode" : "Switch to light mode",
      exact: true,
    });
    if (await toggle.count()) await toggle.click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await overflow();
      await page.screenshot({
        path: `output/playwright/settings-overview-${dark ? "dark" : "light"}-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await open("account");
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill("Updated Fixture");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await page.getByText("Display name saved.", { exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill("Unsaved Fixture");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name: "Privacy & data", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Display name", exact: true }).waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name: "Privacy & data", exact: true })
    .click();
  await page.getByText("30 days after preparation.", { exact: true }).waitFor();
  await page.getByText("Privacy policy — current data-handling notice", { exact: true }).click();
  await page.getByRole("link", { name: "Open public notice", exact: true }).waitFor();
  await open("account", "&state=name-error");
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill("Rejected Fixture");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await page
    .getByText("Your name could not be saved. Check your connection and try again.", {
      exact: true,
    })
    .waitFor();
  if (await page.getByText("Display name saved.", { exact: true }).count())
    throw Error("Rejected write shown as success");
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill("UI Test");
  for (const role of ["owner", "viewer"]) {
    await open("workspace", `&role=${role}`);
    await page.getByText("General information", { exact: true }).waitFor();
    const buttons = page.getByRole("button", { name: "Save details", exact: true });
    if (role === "viewer" && (await buttons.count())) throw Error("Viewer can save workspace");
    await overflow();
  }
  await open("workspace", "&state=no-workspace");
  await page.getByRole("heading", { name: "No workspace selected", exact: true }).waitFor();
  await open("workspace", "&state=workspace-error");
  await page.getByRole("heading", { name: "Workspace unavailable", exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
  await open("integrations", "&state=github-disabled");
  await page
    .getByText("GitHub App setup is required. ZIP audits remain available.", { exact: true })
    .waitFor();
  for (const section of ["privacy", "pricing", "help", "account", "integrations"]) {
    await open(section);
    await page.setViewportSize({ width: 390, height: 900 });
    await overflow();
    await page.getByRole("combobox", { name: "Settings section", exact: true }).waitFor();
    await page.screenshot({
      path: `output/playwright/settings-${section}-mobile.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await open("overview");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.screenshot({ path: "docs/screenshots/settings.png", fullPage: true });
  await page.evaluate(() => {
    document.documentElement.dataset.settingsChecks = "passed";
  });
  console.log(
    "PASS Settings navigation, save/failure feedback, dirty-form protection, theme synchronization, role UI, unavailable states and responsive layouts",
  );
}
