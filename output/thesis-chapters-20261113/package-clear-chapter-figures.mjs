import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const destination = 'C:/Users/jigne/.codex/visualizations/2026/10/17/01a14884-7256-79b3-83a0-d85a3174c02c/thesis-clear-ch5-onwards';
fs.mkdirSync(destination, { recursive: true });
const items = [
  {number:'5.1',section:'5.10 Scan Visualization and Attack Graph',source:'docs/screenshots/workbench.png',name:'figure-5-1-workbench-fixture.png',title:'Audit Workbench interface with isolated test-fixture data',note:'Actual application UI screenshot, not a live user audit or detection-accuracy result. The test-fixture label is preserved.'},
  {number:'5.2',section:'5.10 Scan Visualization and Attack Graph',source:'docs/screenshots/attack-graph.png',name:'figure-5-2-attack-graph-fixture.png',title:'Attack Graph interface with isolated test-fixture data',note:'Actual application UI screenshot. Long page: inspect at original size, not fitted to one portrait page. The fixture and runtime-unverified labels are preserved.'},
  {number:'6.1',section:'6.4 Vulnerability Detection Results',source:'output/ThreatLens_Thesis_Figures_20261112/individual-panels/figure-5-8b-report-evidence-and-remedies.png',name:'figure-6-1-saved-report.png',title:'Saved audit report showing recorded evidence and remediation',note:'Original PDF page image. Saved recommendations and partial evidence are unchanged; not an independently verified fix.'},
  {number:'7.1',section:'7.2 Key Findings and Contributions',source:'output/Thesis_Ordered_Figures_20261114/figure-7-1-objectives-evidence.png',name:'figure-7-1-objectives-evidence.png',title:'Project objectives, available evidence and remaining verification',note:'Explanatory summary, not a claim that tests passed.'},
  {number:'8.1',section:'8.5 Extended Validation and User Studies',source:'output/Thesis_Ordered_Figures_20261114/figure-8-1-future-roadmap.png',name:'figure-8-1-future-roadmap.png',title:'Proposed research and development roadmap',note:'Proposed future work, not completed outcomes.'},
];
const manifest=[];
for (const item of items) {
  const source=path.join(root,item.source);
  const target=path.join(destination,item.name);
  fs.copyFileSync(source,target);
  const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  if(hash(source)!==hash(target)) throw new Error('Copy mismatch');
  manifest.push({...item,sha256:hash(target)});
  if(['7.1','8.1'].includes(item.number)) fs.copyFileSync(source.replace(/\.png$/,'.svg'),target.replace(/\.png$/,'.svg'));
}
fs.writeFileSync(path.join(destination,'PROVENANCE.json'),JSON.stringify(manifest,null,2));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
fs.writeFileSync(path.join(destination,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Chapter 5 onwards — original-size figures</title><style>body{font:18px/1.6 Arial,sans-serif;color:#222;margin:30px auto;padding:24px;max-width:1500px}img{display:block;max-width:none;width:auto;height:auto;border:1px solid #ddd}.viewport{overflow:auto;border:1px solid #bbb;max-height:90vh}section{margin:60px 0}header{background:#fff2d8;padding:20px}a{color:#164c80}</style></head><body><h1>Chapter 5 onwards — figures at original size</h1><header>The original real-audit screenshots were blurred; they are not sharpened or silently replaced. Figures 5.1 and 5.2 below are clearer existing screenshots of the application with labelled isolated fixture data. Use them only to illustrate implementation. Local ports 5173, 5174 and 8000 refused connections when checked on 14 November 2026, so new real-audit capture remains pending. Each image scrolls at original pixel size rather than shrinking to the page width.</header>${items.map(i=>`<section><h2>Figure ${i.number}: ${escape(i.title)}</h2><p>Section ${escape(i.section)}.</p><p>${escape(i.note)}</p><p><a href="${i.name}">Open original-size PNG</a>${['7.1','8.1'].includes(i.number)?` · <a href="${i.name.replace(/\.png$/,'.svg')}">Vector SVG for Word</a>`:''}</p><div class="viewport"><img src="${i.name}" alt="${escape(i.title)}"></div></section>`).join('')}</body></html>`);
console.log(JSON.stringify({destination,verifiedUnchangedCopies:items.length,applicationCodeChanged:false},null,2));
