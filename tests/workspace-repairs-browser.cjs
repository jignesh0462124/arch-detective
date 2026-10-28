// Isolated UI fixtures only. Run with playwright-cli run-code --filename this file.
// prettier-ignore
async (page) => {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const base="http://127.0.0.1:5193/tests/workbench-preview/index.html";
  const open=async(query)=>{await page.goto(`${base}?${query}`,{waitUntil:"domcontentloaded"});};
  const check=async()=>{if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error("Page overflows horizontally");};
  await open("view=upload");
  await page.getByRole("button",{name:"History",exact:true}).click();
  const history=page.getByRole("dialog",{name:"Previous scans"});
  await history.getByText("1–20 of 54 saved scans",{exact:true}).waitFor();
  await history.getByRole("button",{name:"Next",exact:true}).click();
  await history.getByText("21–40 of 54 saved scans",{exact:true}).waitFor();
  await history.getByRole("combobox",{name:"Scan status"}).selectOption("failed");
  await history.getByText(/matching scans/).waitFor();
  if(await history.getByRole("link",{name:"View report"}).count())throw Error("Failed scan offers a report");
  await history.getByRole("searchbox",{name:"Search project"}).fill("No such fixture");
  await history.getByRole("heading",{name:"No matching scans"}).waitFor();
  await history.getByRole("button",{name:"Reset filters"}).click();
  await history.getByText("1–20 of 54 saved scans",{exact:true}).waitFor();
  for(const dark of [false,true])for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.evaluate(dark=>document.documentElement.classList.toggle("dark",dark),dark);await check();
    await page.screenshot({path:`output/playwright/history-${dark?"dark":"light"}-${width}.png`,fullPage:true});
  }
  await page.keyboard.press("Escape");
  if(await history.count())throw Error("Escape did not close history");
  if(!(await page.getByRole("button",{name:"History",exact:true}).evaluate(e=>e===document.activeElement)))throw Error("History focus was not restored");
  await page.setViewportSize({width:1440,height:1000});
  for(const state of ["empty","history-error","denied"]){
    await open(`view=upload&state=${state}`);await page.getByRole("button",{name:"History",exact:true}).click();
    if(state==="empty")await page.getByRole("heading",{name:"No previous codebase scans"}).waitFor();
    else await page.getByRole("dialog").getByRole("alert").waitFor();
  }
  console.log("PASS history paging, filters, errors, denied access, both themes/mobile and Escape/focus");
  await open("view=settings");
  await page.getByText("30 days",{exact:true}).waitFor();
  await page.getByRole("textbox",{name:"Workspace name",exact:true}).fill("Repaired fixture workspace");
  await page.getByRole("button",{name:"Save details",exact:true}).click();
  await page.getByText("Workspace details saved.",{exact:true}).waitFor();
  await page.getByRole("checkbox",{name:"ISO 27001",exact:true}).check();
  await page.getByRole("button",{name:"Save audit defaults",exact:true}).click();
  await page.getByText("Default frameworks saved. They apply to new audit uploads.",{exact:true}).waitFor();
  await page.getByRole("combobox",{name:"Role for analyst@example.invalid"}).selectOption("viewer");
  await page.getByRole("alert").filter({hasText:"could not be confirmed"}).waitFor();
  if(await page.getByText("Member role saved.",{exact:true}).count())throw Error("Rejected role write appeared successful");
  for(const dark of [false,true])for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.evaluate(dark=>document.documentElement.classList.toggle("dark",dark),dark);await check();
    await page.screenshot({path:`output/playwright/settings-${dark?"dark":"light"}-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole("link",{name:"Open Codebase Audit",exact:true}).click();
  if(!(await page.getByRole("checkbox",{name:"ISO 27001",exact:true}).isChecked()))throw Error("Saved defaults were not applied to new upload");
  await open("view=settings&state=mutation-error");
  await page.getByRole("textbox",{name:"Workspace name",exact:true}).fill("Keep this unsaved name");
  await page.getByRole("button",{name:"Save details",exact:true}).click();
  await page.getByRole("alert").waitFor();
  if(await page.getByRole("textbox",{name:"Workspace name",exact:true}).inputValue()!=="Keep this unsaved name")throw Error("Failed save lost input");
  for(const role of ["admin","analyst","viewer"]){
    await open(`view=settings&role=${role}`);await page.getByRole("textbox",{name:"Workspace name",exact:true}).waitFor();
    if(await page.getByRole("button",{name:"Delete workspace",exact:true}).count())throw Error("Non-owner has deletion control");
    if(role!=="admin"&&!(await page.getByRole("textbox",{name:"Workspace name",exact:true}).isDisabled()))throw Error("Read-only role can edit settings");
  }
  await open("view=settings&state=members-error");await page.getByRole("alert").filter({hasText:"Could not load workspace members"}).waitFor();
  await open("view=settings&state=denied");await page.getByRole("alert").waitFor();
  console.log("PASS settings save, defaults propagation, failed writes, owner protection, roles and load errors");
  await open("view=graph");
  await page.getByRole("button",{name:"Center selected",exact:true}).waitFor();
  const canvas=page.getByRole("region",{name:"Attack graph canvas"});
  await canvas.getByRole("button").first().waitFor();
  if(await page.getByText(/EVIDENCE REVIEW|2 STAGES/).count())throw Error("Redundant saved evidence block remains");
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    for(const zoom of ["100%","Fit","Auto"]){
      await page.getByRole("button",{name:zoom,exact:true}).click();
      if(zoom==="100%")for(let i=0;i<5;i++)await page.getByRole("button",{name:"Zoom in graph",exact:true}).click();
      await canvas.getByRole("button").first().click();
      await canvas.evaluate(e=>{e.scrollLeft=e.scrollWidth;e.scrollTop=e.scrollHeight;});
      await page.getByRole("button",{name:"Center selected",exact:true}).scrollIntoViewIfNeeded();
      const before=await page.evaluate(()=>scrollY);
      await page.getByRole("button",{name:"Center selected",exact:true}).click();
      const after=await page.evaluate(()=>scrollY);
      if(Math.abs(before-after)>1)throw Error("Center selected scrolled the page");
      const selection=await canvas.getByRole("button").first().evaluate(e=>{const c=e.closest('[aria-label="Attack graph canvas"]');const a=e.getBoundingClientRect(),b=c.getBoundingClientRect();return {visible:a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom,focused:e===document.activeElement};});
      if(!selection.visible||!selection.focused)throw Error("Selected node was not centered/focused");
    }
    await check();
  }
  console.log("PASS canvas-only centering, selected source node, zoom modes and mobile");
}
