// Isolated checks against the actual protected application layout.
// Playwright CLI requires a function expression without a trailing semicolon.
// prettier-ignore
async (page) => {
  const base = "http://127.0.0.1:5193/tests/workbench-preview/index.html?view=preferences";
  await page.goto(`${base}&section=workspace&role=viewer`);
  await page.getByText("General information", { exact: true }).waitFor();
  if (await page.getByRole("button", { name: "Save details", exact: true }).count())
    throw Error("Viewer controls exposed");
  await page.goto(`${base}&section=account&state=no-workspace`);
  await page.getByRole("textbox", { name: "Display name", exact: true }).waitFor();
  console.log("PASS viewer restrictions and personal Settings without a workspace");
}
