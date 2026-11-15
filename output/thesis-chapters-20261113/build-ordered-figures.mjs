import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const requireRuntime = createRequire('C:/Users/jigne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp = requireRuntime('sharp');
const root = process.cwd();
const out = path.join(root, 'output/Thesis_Ordered_Figures_20261114');
const display = 'C:/Users/jigne/.codex/visualizations/2026/10/17/01a14884-7256-79b3-83a0-d85a3174c02c/thesis-ordered-figures';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(display, { recursive: true });
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const palette = { ink:'#20262b', muted:'#505b63', accent:'#a74419', border:'#818b92', paper:'#f6f4ef' };
let parts = [];
function text(x,y,lines,size=30,bold=false,fill=palette.ink) {
  (Array.isArray(lines)?lines:[lines]).forEach((line,index)=>parts.push(`<text x="${x}" y="${y+index*(size*1.32)}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${bold?700:400}" fill="${fill}">${escape(line)}</text>`));
}
function rect(x,y,w,h,fill=palette.paper,dash=false) {
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${palette.border}" stroke-width="2" ${dash?'stroke-dasharray="10 7"':''}/>`);
}
function arrow(points,dash=false) {
  parts.push(`<polyline points="${points}" fill="none" stroke="${palette.muted}" stroke-width="3" marker-end="url(#arrow)" ${dash?'stroke-dasharray="10 8"':''}/>`);
}
function begin(title,subtitle,height=1080) {
  parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="${height}" viewBox="0 0 1800 ${height}" role="img"><title>${escape(title)}</title><desc>${escape(subtitle)}</desc><defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L10 5 L0 10 Z" fill="${palette.muted}"/></marker></defs><rect width="1800" height="${height}" fill="white"/>`];
  text(70,88,title,46,true); text(70,140,subtitle,26,false,palette.muted);
}
async function save(name) {
  const svg=parts.join('')+'</svg>';
  fs.writeFileSync(path.join(out,`${name}.svg`),svg);
  await sharp(Buffer.from(svg)).resize({width:3000}).png().toFile(path.join(out,`${name}.png`));
}

begin('Complementary Security-Review Approaches','Method classification — not a product ranking or accuracy comparison');
const methods = [
  ['Static analysis',['Recognised patterns and data flow','Context and language limits remain']],
  ['Dependency analysis',['Package names and versions','Version evidence is required']],
  ['Secret detection',['Potential credentials in source','Placeholders require interpretation']],
  ['Configuration review',['Deployment and application settings','Runtime settings may be unavailable']],
  ['Model-assisted explanation',['Bounded context and suggestions','Check assumptions against evidence']],
  ['Human review',['Application knowledge and judgement','Confirm relevance and next steps']]
];
methods.forEach((method,index)=>{
  const left=index%2===0; const x=left?70:1170; const y=210+Math.floor(index/2)*240;
  rect(x,y,560,180); text(x+24,y+45,method[0],31,true); text(x+24,y+95,method[1],25,false,palette.muted);
  arrow(left?`630,${y+90} 665,${y+90} 665,560 700,560`:`1170,${y+90} 1135,${y+90} 1135,560 1100,560`);
});
rect(700,435,400,250,'#eee7db'); text(730,495,['Evidence review'],35,true); text(730,550,['Inspect source','Check uncertainty','Decide next steps'],29);
text(70,1015,'Each method supplies a different kind of evidence; none alone guarantees security.',29,false,palette.muted);
await save('figure-2-1-review-approaches');

begin('Local Platform and Optional Services','Documented deployment modes — optional components require separate configuration',1160);
rect(55,190,1690,405,'#ffffff'); text(80,235,'LOCAL SAVED-ZIP / WORKBENCH PATH',28,true,palette.accent);
rect(90,310,380,180); text(115,365,'Browser interface',33,true); text(115,415,['React / source viewer','Authenticated requests'],27);
rect(650,310,420,180); text(675,365,'FastAPI application',33,true); text(675,415,['Scan state and analysis','Source preparation'],27);
rect(1250,275,460,125); text(1270,320,'Auth + PostgreSQL',31,true); text(1270,365,'Workspace records / row policies',25);
rect(1250,435,460,125); text(1270,480,'Private source storage',31,true); text(1270,525,'Time-limited source previews',25);
arrow('470,400 650,400'); arrow('1070,400 1150,400 1150,337 1250,337'); arrow('1150,400 1150,497 1250,497');
rect(55,655,1690,350,'#f8f8f7',true); text(80,700,'OPTIONAL WORKER / RETRIEVAL PROFILE',28,true,palette.accent);
rect(90,770,380,155); text(115,815,'Job broker',33,true); text(115,865,'Redis / queued work',27);
rect(650,770,420,155); text(675,815,'Background worker',33,true); text(675,865,'Celery task processing',27);
rect(1250,750,460,195); text(1270,795,'Additional services',31,true); text(1270,845,['Specialist scanner executables','Embeddings / vector retrieval'],26);
arrow('470,847 650,847',true); arrow('1070,847 1250,847',true);
text(80,1070,'Modes are shown separately. This figure does not establish that optional services were deployed.',27,false,palette.muted);
text(80,1110,'Arrows summarise responsibilities; they do not represent every request or database operation.',25,false,palette.muted);
await save('figure-4-1-platform-modes');

begin('Project Objectives and Available Evidence','Evidence summary — not a test-pass dashboard or detection-accuracy result');
const columns=[70,570,1120];
rect(60,205,1680,110,'#eee7db');
text(90,270,'Objective',34,true); text(590,270,'Available evidence',34,true); text(1140,270,'Remaining verification',34,true);
const rows=[
  [['Source-linked review'],['Workbench / graph captures'],['Correct location and scope','across tested cases']],
  [['Retained audit access'],['Saved-scan history design'],['Reload, navigation, expiry','and deletion tests']],
  [['Readable report output'],['Generated PDF excerpt'],['Content parity and complete','multi-page rendering']],
  [['Private workspace access'],['Authorisation / policy design'],['Permitted and denied reads','with isolated accounts']]
];
rows.forEach((row,index)=>{
  const y=315+index*155; rect(60,y,1680,155,index%2===0?'#ffffff':'#f7f6f3');
  row.forEach((lines,col)=>text(columns[col]+20,y+60,lines,col===0?29:27,col===0));
});
text(70,1005,'Record actual test results in Chapter 6 before claiming an objective has been verified.',28,false,palette.muted);
await save('figure-7-1-objectives-evidence');

begin('Future Research and Development Roadmap','Proposed future work — no completion dates or performance claims');
const stages=[
  {x:70,y:225,n:'01',title:['Reconcile evidence','and datasets'],body:['Label test projects','Define matching rules','Archive repeatable run records']},
  {x:980,y:225,n:'02',title:['Extend and evaluate','analysis'],body:['Broaden language coverage','Evaluate prompts and retrieval','Measure false alarms and misses']},
  {x:980,y:640,n:'03',title:['Validate deployment','and automation'],body:['Test isolation and recovery','Review repository permissions','Measure realistic concurrent load']},
  {x:70,y:640,n:'04',title:['Study developer','outcomes'],body:['Measure evidence-review time','Assess remediation decisions','Collect consented usability feedback']}
];
stages.forEach(stage=>{rect(stage.x,stage.y,750,310);text(stage.x+28,stage.y+46,stage.n,27,true,palette.accent);text(stage.x+28,stage.y+95,stage.title,34,true);text(stage.x+28,stage.y+200,stage.body,27,false,palette.muted);});
arrow('820,380 980,380');arrow('1355,535 1355,640');arrow('980,795 820,795');
text(70,1020,'Maintain human review, source privacy and explicit coverage limitations at every stage.',28,false,palette.muted);
await save('figure-8-1-future-roadmap');

const original=path.join(root,'output/ThreatLens_Thesis_Figures_20261112');
const reuse=[
  ['figure-5-1-system-architecture','figure-1-1-system-architecture'],
  ['figure-3-1-research-workflow','figure-3-1-research-workflow'],
  ['figure-5-6-audit-workbench','figure-5-1-audit-workbench'],
  ['figure-5-7-attack-graph','figure-5-2-attack-graph'],
  ['individual-panels/figure-5-8b-report-evidence-and-remedies','figure-6-1-report-evidence']
];
for(const [source,destination] of reuse){
  for(const ext of ['png','svg']){
    const from=path.join(original,`${source}.${ext}`);
    if(fs.existsSync(from)) fs.copyFileSync(from,path.join(out,`${destination}.${ext}`));
  }
}
const figures=[
  ['1.1','1.8 Main Contributions','Overall Architecture of ThreatLens','figure-1-1-system-architecture'],
  ['2.1','2.8 Comparison with Existing Security Assessment Tools','Classification of Security-Review Approaches','figure-2-1-review-approaches'],
  ['3.1','3.1 Research Design and Workflow','Research and Development Workflow','figure-3-1-research-workflow'],
  ['4.1','4.6 Background Processing and Deployment Modes','Local Platform and Optional Worker Services','figure-4-1-platform-modes'],
  ['5.1','5.10 Scan Visualization and Attack Graph','Audit Workbench with Source Code and Finding Details','figure-5-1-audit-workbench'],
  ['5.2','5.10 Scan Visualization and Attack Graph','Evidence-Based Graph of Security Findings','figure-5-2-attack-graph'],
  ['6.1','6.4 Vulnerability Detection Results','Generated Report with Recorded Evidence and Remedies','figure-6-1-report-evidence'],
  ['7.1','7.2 Key Findings and Contributions','Project Objectives and Available Evidence','figure-7-1-objectives-evidence'],
  ['8.1','8.5 Extended Validation and User Studies','Proposed Future Research and Development Roadmap','figure-8-1-future-roadmap']
];
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ThreatLens figures in thesis order</title><style>body{font:18px/1.6 Arial,sans-serif;max-width:1200px;margin:30px auto;padding:20px;color:#222}img{display:block;width:100%;height:auto;border:1px solid #ddd}section{margin:60px 0}h2{font-size:25px}p{margin:12px 0}header{background:#fff2dd;padding:18px}a{color:#174c80}</style></head><body><h1>ThreatLens — ordered thesis figures</h1><header>Nine figures; only two in Chapter 5. Figures 5.1 and 5.2 are older real screenshots with soft text and should be recaptured for final print. Diagrams 2.1, 4.1, 7.1 and 8.1 are newly drawn explanatory figures, not screenshots or verified results.</header>${figures.map(([number,section,title,name])=>`<section><h2>Figure ${number} — ${escape(title)}</h2><p>Place after Section ${escape(section)}.</p><img src="${name}.png" alt="${escape(title)}"><p><strong>Figure ${number}:</strong> ${escape(title)}.</p><p><a href="${name}.png">Open original PNG</a>${fs.existsSync(path.join(out,`${name}.svg`))?` · <a href="${name}.svg">Vector SVG</a>`:''}</p></section>`).join('')}</body></html>`;
fs.writeFileSync(path.join(out,'index.html'),html);
fs.writeFileSync(path.join(out,'PLACEMENT.md'),'# Thesis figures in order\n\n'+figures.map(([n,s,t,f])=>`## Figure ${n}: ${t}\n\nPlacement: Section ${s}.\n\n![${t}](${f}.png)\n`).join('\n')+'\nExisting screenshots are unchanged; Figures 5.1 and 5.2 need sharper recaptures for print. Four new diagrams are conceptual explanatory figures, not validation results. The platform diagram distinguishes optional deployment components. RLS reference: https://supabase.com/docs/guides/database/postgres/row-level-security\n');
for(const file of fs.readdirSync(out)) fs.copyFileSync(path.join(out,file),path.join(display,file));
for(const [, , ,name] of figures){const meta=await sharp(path.join(out,`${name}.png`)).metadata();console.log(`${name}: ${meta.width} x ${meta.height}`);}
console.log(`Gallery: ${display}/index.html`);
