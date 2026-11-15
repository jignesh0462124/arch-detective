import { chromium } from 'file:///C:/Users/jigne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const root='C:/Users/jigne/OneDrive/Desktop/College Project/arch-detective';
const folder=path.join(root,'output/Thesis_Figures_Visible_20261113');
const screenshotFolder=path.join(root,'output/playwright/thesis-figures-visible');
fs.mkdirSync(screenshotFolder,{recursive:true});
const html=fs.readFileSync(path.join(folder,'index.html'),'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if(match[1].startsWith('#'))continue;
  assert.ok(fs.existsSync(path.join(folder,match[1])), 'Missing asset: '+match[1]);
}
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.join(folder,'index.html')).href);
  await page.locator('img').evaluateAll(async images=>{
    for(const image of images)image.loading='eager';
    await Promise.all(images.map(image=>image.decode()));
  });
  assert.equal(await page.locator('section').count(),10);
  assert.equal(await page.locator('img').count(),10);
  const dimensions=await page.locator('img').evaluateAll(images=>images.map(image=>({file:image.getAttribute('src'),width:image.naturalWidth,height:image.naturalHeight})));
  assert.ok(dimensions.every(image=>image.width>0&&image.height>0));
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    const section=page.locator('section').first();
    await section.getByRole('button',{name:'100% pixels',exact:true}).click();
    assert.equal(await section.locator('img').evaluate(image=>Math.round(image.getBoundingClientRect().width)),dimensions[0].width);
    await section.getByRole('button',{name:'200%',exact:true}).click();
    assert.equal(await section.locator('img').evaluate(image=>Math.round(image.getBoundingClientRect().width)),dimensions[0].width*2);
    await section.getByRole('button',{name:'Fit width',exact:true}).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Page overflow at '+width);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(screenshotFolder,`gallery-${width}.png`)});
  }
  assert.deepEqual(errors,[]);
  const result={status:'passed',mainFigures:10,allLinkedFilesExist:true,decodedImages:dimensions,viewports:[1440,390],checks:['Fit width','100% native pixels','200% zoom','No page-level horizontal overflow','No JavaScript errors']};
  fs.writeFileSync(path.join(folder,'GALLERY_CHECKS.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
