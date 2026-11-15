import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const requireRuntime=createRequire('C:/Users/jigne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp=requireRuntime('sharp');
const source=path.resolve('docs/screenshots/attack-graph.png');
const out='C:/Users/jigne/.codex/visualizations/2026/10/17/01a14884-7256-79b3-83a0-d85a3174c02c/thesis-figure-5-2-readable';
fs.mkdirSync(out,{recursive:true});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const originalHash=hash(source);
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const header=(width,title,subtitle)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="100"><rect width="100%" height="100%" fill="white"/><text x="18" y="31" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="#202020">${xml(title)}</text><text x="18" y="62" font-family="Arial,Helvetica,sans-serif" font-size="17" fill="#4b4b4b">${xml(subtitle)}</text><line x1="18" y1="86" x2="${width-18}" y2="86" stroke="#c9c5bf"/></svg>`);
const crop=async region=>sharp(source).extract(region).png().toBuffer();
const graphRegions=[
  {role:'Canvas controls',left:1000,top:730,width:390,height:65,x:420,y:105},
  {role:'Graph legend',left:300,top:835,width:680,height:37,x:18,y:180},
  {role:'Graph nodes',left:450,top:975,width:790,height:365,x:18,y:245},
];
await sharp({create:{width:830,height:640,channels:3,background:'#ffffff'}}).composite([
  {input:header(830,'(a) Attack Graph — graph and controls','Actual interface · isolated test-fixture data · cropped excerpts'),left:0,top:0},
  ...await Promise.all(graphRegions.map(async r=>({input:await crop({left:r.left,top:r.top,width:r.width,height:r.height}),left:r.x,top:r.y})))
]).png().toFile(path.join(out,'figure-5-2a-graph-readable.png'));
const evidence={left:302,top:1815,width:630,height:860};
await sharp({create:{width:666,height:978,channels:3,background:'#ffffff'}}).composite([
  {input:header(666,'(b) Finding evidence and remedies','Actual interface · isolated test-fixture data · cropped excerpt'),left:0,top:0},
  {input:await crop(evidence),left:18,top:100},
]).png().toFile(path.join(out,'figure-5-2b-remedies-readable.png'));
if(hash(source)!==originalHash)throw new Error('Source screenshot changed');
fs.writeFileSync(path.join(out,'PROVENANCE.json'),JSON.stringify({source,sha256:originalHash,method:'Exact pixel crops and neutral figure headings; no generative reconstruction, sharpening or resampling',data:'Isolated UI test fixtures, not live audit results',panels:{a:graphRegions,b:evidence},originalPreserved:true},null,2));
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Readable Figure 5.2</title><style>body{max-width:1000px;margin:30px auto;padding:20px;font:18px/1.6 Arial,sans-serif;color:#222}img{display:block;max-width:100%;height:auto;margin:25px 0}a{color:#164c80}section{margin:50px 0}</style></head><body><h1>Figure 5.2 — Attack Graph</h1><p>Two panels from the existing application screenshot. Source pixels are preserved. These are isolated test-fixture data, not a live user's audit. Place the panels separately; do not shrink them side by side.</p><section><h2>(a) Graph and controls</h2><a href="figure-5-2a-graph-readable.png">Open original-size PNG</a><img src="figure-5-2a-graph-readable.png" alt="Attack Graph nodes, legend and controls using test-fixture data"></section><section><h2>(b) Evidence and remedies</h2><a href="figure-5-2b-remedies-readable.png">Open original-size PNG</a><img src="figure-5-2b-remedies-readable.png" alt="Finding evidence and remediation using test-fixture data"></section><p><strong>Figure 5.2:</strong> Attack Graph interface using isolated test-fixture data: (a) source associations and graph controls; (b) selected finding evidence and remediation guidance. Associations do not establish exploitability.</p></body></html>`);
console.log(JSON.stringify({out,sourceUnchanged:true,panels:['figure-5-2a-graph-readable.png','figure-5-2b-remedies-readable.png']},null,2));
