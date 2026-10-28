// Playwright CLI requires a function expression without a trailing semicolon.
// prettier-ignore
async (page) => {
  const base = "http://127.0.0.1:5193/tests/workbench-preview/index.html";
  for (const [view, title] of [
    ["graph", "Attack Graph"],
    ["fixes", "Fix verification"],
  ]) {
    await page.goto(`${base}?view=${view}`);
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    if (await page.getByText("Something went wrong!", { exact: true }).count())
      throw Error("Shared page crashed");
  }
  console.log("PASS: Attack Graph and Fix verification render after the shared Advisor changes");
}
