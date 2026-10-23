// Disposable fixture UI only. No requests to the user's saved audits.
// Run via playwright-cli run-code --filename tests/audit-deletion-browser.cjs.
// prettier-ignore
async (page) => {
  const base="http://127.0.0.1:5176/tests/workbench-preview/index.html?view=upload";
  const open=async(query="")=>{
    await page.goto(base+query,{waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:"History",exact:true}).click();
    await page.getByText("1–20 of 54 saved scans",{exact:true}).waitFor();
  };
  const history=()=>page.getByRole("dialog",{name:"Previous scans",exact:true});
  const confirmation=()=>page.getByRole("dialog",{name:"Delete this scan?",exact:true});
  await open("&state=delete-success");
  await page.getByRole("button",{name:"Delete scan: Fixture project 1",exact:true}).click();
  await confirmation().getByRole("button",{name:"Cancel",exact:true}).waitFor();
  if(!(await confirmation().getByRole("button",{name:"Cancel",exact:true}).evaluate(e=>e===document.activeElement)))throw Error("Confirmation does not focus Cancel");
  await page.keyboard.press("Shift+Tab");
  if(!(await confirmation().getByRole("button",{name:"Delete scan",exact:true}).evaluate(e=>e===document.activeElement)))throw Error("Dialog focus escaped");
  await page.keyboard.press("Escape");
  if(await confirmation().count())throw Error("Escape did not close confirmation");
  if(!(await page.getByRole("button",{name:"Delete scan: Fixture project 1",exact:true}).evaluate(e=>e===document.activeElement)))throw Error("Cancel focus was not restored");
  await page.getByRole("button",{name:"Delete scan: Fixture project 1",exact:true}).click();
  for(const dark of [false,true])for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(dark=>{
      document.documentElement.dataset.theme=dark?"dark":"light";
      document.documentElement.classList.toggle("dark",dark);
    },dark);
    if(await confirmation().evaluate(e=>e.scrollWidth>e.clientWidth||e.getBoundingClientRect().left<0||e.getBoundingClientRect().right>innerWidth))throw Error("Confirmation overflows");
    await page.screenshot({path:`output/playwright/delete-scan-${dark?"dark":"light"}-${width}.png`,fullPage:false});
  }
  await confirmation().getByRole("button",{name:"Delete scan",exact:true}).click();
  await history().getByText("1–20 of 53 saved scans",{exact:true}).waitFor();
  if(await history().getByRole("heading",{name:"Fixture project 1",exact:true}).count())throw Error("Deleted row remained");
  await history().getByText(/Scan deleted/).waitFor();
  // Last row of the final filtered page: keep filters and return to a valid page.
  await history().getByRole("combobox",{name:"Scan status"}).selectOption("failed");
  await history().getByRole("searchbox",{name:"Search project"}).fill("Fixture project 8");
  await history().getByText("1–1 of 1 matching scans",{exact:true}).waitFor();
  await history().getByRole("button",{name:"Delete scan: Fixture project 8",exact:true}).click();
  await confirmation().getByRole("button",{name:"Delete scan",exact:true}).click();
  await history().getByRole("heading",{name:"No matching scans",exact:true}).waitFor();
  if(await history().getByRole("combobox",{name:"Scan status"}).inputValue()!=="failed")throw Error("Deletion reset filters");
  await page.keyboard.press("Escape");
  if(!(await page.getByRole("button",{name:"History",exact:true}).evaluate(e=>e===document.activeElement)))throw Error("History focus was not restored");
  for(const state of ["delete-failure","delete-zero"]){
    await open(`&state=${state}`);
    await page.getByRole("button",{name:"Delete scan: Fixture project 1",exact:true}).click();
    await confirmation().getByRole("button",{name:"Delete scan",exact:true}).click();
    await confirmation().getByRole("alert").waitFor();
    if(!(await confirmation().getByRole("button",{name:"Retry deletion",exact:true}).isEnabled()))throw Error("Deletion failure left controls stuck");
    await confirmation().getByRole("button",{name:"Cancel",exact:true}).click();
    await history().getByRole("heading",{name:"Fixture project 1",exact:true}).waitFor();
  }
  for(const role of ["owner","admin","analyst","viewer"]){
    await open(`&role=${role}`);
    const permitted=["owner","admin"].includes(role);
    if(!!(await history().getByRole("button",{name:/^Delete scan:/}).count())!==permitted)throw Error("Incorrect deletion role control");
    if(await history().getByRole("button",{name:"Delete scan: Fixture project 12",exact:true}).count())throw Error("Running scan offers deletion");
  }
  console.log("PASS deletion confirmation, keyboard/focus, both themes/mobile, completed+failed, preserved filters, denied and zero-row writes, role controls and active-scan protection");
}
