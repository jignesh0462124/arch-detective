import fs from 'node:fs/promises';
import { FileBlob, PresentationFile } from 'file:///C:/Program%20Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const original = 'C:/Users/jigne/Downloads/ThreatLens_Project_Presentation_with_Literature-.pptx';
const p = await PresentationFile.importPptx(await FileBlob.load(original));
const dir = 'tmp/g14-submission/template';
await fs.mkdir(dir,{recursive:true});
console.log('Source slide count:', p.slides.items.length);
if(process.argv.includes('--names')){
  for(const [i,s] of p.slides.items.entries()) console.log(i+1, s.shapes.items.map(x=>[x.name,x.text.toString().slice(0,65)]).filter(x=>x[1].trim()), 'tables',s.tables.items.length);
  process.exit(0);
}
for(const [i,s] of p.slides.items.entries()){
  try {const pic = await p.export({slide:s,format:'png',scale:0.5}); await fs.writeFile(`${dir}/slide-${i+1}.png`,new Uint8Array(await pic.arrayBuffer()));}
  catch(e){console.log('Slide preview unavailable:',i+1,e.message);}
}
