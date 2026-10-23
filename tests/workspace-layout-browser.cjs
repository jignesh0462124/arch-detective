// Use the actual theme toggle so both CSS theme selectors stay in sync.
// prettier-ignore
async (page) => {
  const base="http://127.0.0.1:5175/tests/workbench-preview/index.html";
  for(const view of ["settings","upload"]){
    await page.goto(`${base}?view=${view}`,{waitUntil:"domcontentloaded"});
    await page.setViewportSize({width:1440,height:1000});
    if(view==="settings")await page.getByText("30 days",{exact:true}).waitFor();
    for(const dark of [false,true]){
      const toggle=page.getByRole("button",{name:dark?"Switch to dark mode":"Switch to light mode",exact:true});
      if(await toggle.count())await toggle.click();
      const theme=await page.evaluate(()=>document.documentElement.dataset.theme);
      if(theme!==(dark?"dark":"light"))throw Error("Theme toggle did not apply theme");
      if(view==="upload"){
        await page.getByRole("button",{name:"History",exact:true}).click();
        const dialog=page.getByRole("dialog",{name:"Previous scans"});
        await dialog.getByText("1–20 of 54 saved scans",{exact:true}).waitFor();
        await page.getByRole("button",{name:"Close audit history",exact:true}).focus();
        await page.keyboard.press("Shift+Tab");
        if(!(await dialog.evaluate(e=>e.contains(document.activeElement))))throw Error("Focus escaped History dialog");
      }
      for(const width of [1440,390]){
        await page.setViewportSize({width,height:1000});
        if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error("Horizontal overflow");
        await page.screenshot({path:`output/playwright/${view==="upload"?"history":"settings"}-${dark?"dark":"light"}-${width}.png`,fullPage:true});
      }
      if(view==="upload")await page.keyboard.press("Escape");
      await page.setViewportSize({width:1440,height:1000});
    }
  }
  console.log("PASS actual dark/light theme toggle, desktop/mobile layout and History focus trap");
}
