import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const requireRuntime=createRequire('C:/Users/jigne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp=requireRuntime('sharp');
const out=path.resolve('output/Thesis_Research_Diagrams_Archon_Colours_20261114');
const display='C:/Users/jigne/.codex/visualizations/2026/10/17/01a14884-7256-79b3-83a0-d85a3174c02c/thesis-research-diagrams-archon';
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(display,{recursive:true});
// Colour-only variant: match the application's light-theme tokens. White page
// backgrounds are retained for thesis printing; all geometry and wording stay.
const p={navy:'#111111',blue:'#f5f1ec',teal:'#b23800',green:'#fff3e8',ink:'#111111',muted:'#626260',border:'#d3cec6'};
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let elements=[];
function text(x,y,content,size=28,bold=false,color=p.ink){(Array.isArray(content)?content:[content]).forEach((s,i)=>elements.push(`<text x="${x}" y="${y+i*size*1.3}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${bold?700:400}" fill="${color}">${esc(s)}</text>`));}
function box(x,y,w,h,title,lines=[],optional=false,size=29){
  elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${optional?p.green:p.blue}" stroke="${optional?p.teal:p.border}" stroke-width="2" ${optional?'stroke-dasharray="10 7"':''}/>`);
  text(x+22,y+45,title,size,true,optional?p.teal:p.navy);text(x+22,y+95,lines,25);
}
function line(points,optional=false){elements.push(`<polyline points="${points}" fill="none" stroke="${optional?p.teal:p.navy}" stroke-width="3" marker-end="url(#${optional?'optional':'main'})" ${optional?'stroke-dasharray="10 7"':''}/>`);}
function begin(title,subtitle,h){elements=[`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="${h}" viewBox="0 0 1800 ${h}" role="img"><title>${esc(title)}</title><desc>${esc(subtitle)}</desc><defs><marker id="main" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L10 5 L0 10 Z" fill="${p.navy}"/></marker><marker id="optional" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L10 5 L0 10 Z" fill="${p.teal}"/></marker></defs><rect width="100%" height="100%" fill="white"/>`];text(60,78,title,46,true,p.navy);text(60,130,subtitle,26,false,p.muted);}
async function save(name){const svg=elements.join('')+'</svg>';fs.writeFileSync(path.join(out,name+'.svg'),svg);await sharp(Buffer.from(svg)).resize({width:3000}).png().toFile(path.join(out,name+'.png'));}

begin('ThreatLens System Architecture','Core saved-ZIP path; optional deployment modes are shown separately',1310);
box(60,215,480,175,'Web application',['React / TypeScript / source viewer','Upload, review and report access']);
box(660,215,480,175,'Authenticated FastAPI',['Validate identity and membership','Accept bounded project uploads']);
box(1260,215,480,175,'Identity verification',['Supabase Auth / signing keys','Validated session identity']);
line('540,302 660,302');line('1140,302 1260,302');
box(60,535,480,215,'Source preparation',['Manifest and redacted previews','Private Storage objects','Time-limited source access']);
box(660,495,480,295,'In-process assessment',['Static rules + model review','Run independently / merge results','Ground locations in source','Retain coverage limitations']);
box(1260,535,480,215,'Configured model provider',['Bounded, redacted context','Provider and model are configurable','No fixed model-name assumption'],false,28);
line('900,390 900,495');line('660,640 540,640');line('1140,640 1260,640');
box(660,915,480,185,'Saved assessment data',['PostgreSQL / workspace-scoped RLS','Findings, locations and metadata']);
box(60,915,480,185,'Evidence review',['Workbench, Findings and graph','Suggestions require human review']);
box(1260,915,480,185,'On-demand reports',['Saved data → renderer → PDF','No new scan during PDF export']);
line('900,790 900,915');line('660,1007 540,1007');line('1140,1007 1260,1007');
text(60,1180,'Reports: Chromium or available fallback renders the document before download.',27,false,p.muted);
text(60,1230,'Separate optional worker / retrieval profile: Celery, Redis, specialist scanners and Qdrant.',27,false,p.teal);
await save('figure-1-1-system-architecture-revised');

begin('ThreatLens End-to-End Audit Flow','Accepted project-ZIP workflow — source preparation and analysis have separate states',1510);
box(570,190,660,125,'Select project ZIP and frameworks',[],false,32);
line('900,315 900,345');
elements.push(`<polygon points="900,345 1090,420 900,495 710,420" fill="${p.green}" stroke="${p.teal}" stroke-width="2"/>`);
text(790,429,'Input valid?',31,true,p.teal);
box(1280,350,455,155,'Reject before acceptance',['Explain validation or access error','No completed audit is implied'],false,27);
line('1090,420 1280,420');text(1150,400,'No',24,true);
line('900,495 900,535');text(925,525,'Yes',24,true);
box(570,535,660,130,'Accept scan and return its ID',['Open progressive workbench when enabled'],false,31);
line('900,665 900,710 405,710 405,755');line('900,710 1395,710 1395,755');
box(70,755,670,225,'Prepare source previews',['Publish manifest / pending file states','Upload redacted source; expose ready files','Preview failure remains explicit'],false,31);
box(1060,755,670,225,'Analyse eligible source',['Static rules and model review overlap','Ground and merge reported findings','Record exclusions and limitations'],false,31);
text(770,835,['Concurrent','operations'],27,true,p.teal);
line('405,980 405,1040 900,1040 900,1080');line('1395,980 1395,1040 900,1040');
box(570,1080,660,170,'Persist results and final status',['Only saved results can be marked complete','Retain findings if source previews fail'],false,31);
line('900,1250 900,1300');
box(570,1300,660,125,'Review evidence and export reports',[],false,31);
text(70,1470,'Failed processing or persistence remains failed; an unfinished audit must never appear clean.',25,false,p.muted);
await save('figure-3-2-end-to-end-audit-flow');

begin('Local and Optional Worker Processing Modes','Code-grounded comparison of orchestration — not a live deployment or performance result',1120);
text(60,210,'LOCAL PROGRESSIVE WORKBENCH',30,true,p.navy);
box(60,255,365,200,'FastAPI scan',['Validate project input','Accept scan reference']);
box(495,255,365,200,'Concurrent work',['Source preparation','Static + model review']);
box(930,255,365,200,'Ground and save',['Resolve source locations','Persist findings / status']);
box(1365,255,365,200,'Review interfaces',['Read-only workbench','On-demand report export']);
line('425,355 495,355');line('860,355 930,355');line('1295,355 1365,355');
text(60,540,'OPTIONAL FULL SCANNER-WORKER PROFILE',30,true,p.teal);
box(60,585,365,220,'Celery / Redis',['Queue and claim job','Retrieve source artifact'],true);
box(495,585,365,220,'Specialist checks',['Semgrep → Bandit','→ TruffleHog','Sequential worker calls'],true);
box(930,585,365,220,'Additional review',['Dependency auditing','→ model code review','→ deduplicate / save'],true);
box(1365,585,365,220,'Enrichment',['CVSS / control mapping','Persist assessment','Separate report task'],true);
line('425,695 495,695',true);line('860,695 930,695',true);line('1295,695 1365,695',true);
box(495,885,800,120,'Optional retrieval support',['Versioned corpus → embeddings / Qdrant → candidate controls'],true,29);
line('1295,945 1550,945 1550,805',true);
text(60,1060,'The worker is not shown as parallel. Infrastructure/log coverage is not implied by accepting a file.',25,false,p.muted);
await save('figure-4-1-local-and-worker-modes-revised');

const records=[
  {number:'1.1',section:'1.8 Main Contributions',name:'figure-1-1-system-architecture-revised',caption:'ThreatLens architecture for the saved-ZIP workflow, including authenticated processing, source preparation, analysis, private persistence and evidence review.'},
  {number:'3.2',section:'3.4 Source Code Ingestion and Preprocessing',name:'figure-3-2-end-to-end-audit-flow',caption:'End-to-end audit flow showing validation, scan acceptance, concurrent source preparation and analysis, persistence and review.'},
  {number:'4.1',section:'4.6 Background Processing and Deployment Modes',name:'figure-4-1-local-and-worker-modes-revised',caption:'Local progressive workbench and optional scanner-worker processing modes. Worker checks are shown in their implemented sequence.'}
];
fs.writeFileSync(path.join(out,'engine-results-template.csv'),'dataset_id,run_id,engine,version,true_positives,false_positives,false_negatives,runtime_seconds,eligible_files,analysed_files\n');
fs.writeFileSync(path.join(out,'FIGURE_GUIDE.md'),`# Thesis figure guide\n\nThese diagrams adapt the supplied layout into print-focused SVG and PNG. They are explanatory figures based on source inspection, not application screenshots or proof of running integrations.\n\n${records.map(r=>`## Figure ${r.number}\n\nPlacement: Section ${r.section}.\n\nCaption: ${r.caption}\n\nFile: ${r.name}.png (SVG also included).\n`).join('\n')}\n## Corrections to the supplied references\n\n- Local static and model-assisted analysis overlap; worker scanner calls are sequential in the inspected implementation.\n- No fixed Llama version or unverified 534-control corpus count is asserted.\n- Rendering precedes PDF delivery; PDF does not feed into Chromium.\n- NVD import and Qdrant services are optional/configuration-dependent, not mandatory for every ZIP assessment.\n- Core source previews are not a claim of complete archive analysis.\n- Source retention and saved assessment history are different concepts.\n- Database row access follows project scope and policy design; see https://supabase.com/docs/guides/database/postgres/row-level-security .\n\n## Grounding inspected on 14 November 2026\n\n- threatlens/app/api/audit_workbench.py: accepted job, prepare_source, source_task, pipeline call and final persistence.\n- threatlens/app/api/local_scan.py: _scan_pipeline, static_task, model call, grounding and merge.\n- threatlens/app/tasks/scan_task.py: run_full_scan, sequential scanner calls and mapping stage.\n- threatlens/app/tasks/report_task.py: generate_pdf_report before storing/delivering the result.\n- threatlens/INSTALLATION.md: separate API and full scanner-worker installation profiles.\n\nThis is a static source review. No provider, worker, database or live scan was exercised for these figures.\n\n## Engine comparison figures pending supplied measurements\n\nReserve Figure 6.2 for Section 6.5 Detection Quality Metrics: grouped precision/recall/F1 bars on the same independently labelled corpus and compatible scope. Do not rank tools on different task subsets.\n\nReserve Figure 6.3 for Section 6.6 Performance and Scan Duration: phase-time shares only if measured sequential exclusive intervals form a valid total. Concurrent or overlapping engine times must not be added into an elapsed-time pie. A pie chart cannot establish which engine is most accurate.\n\nThe user confirmed having evaluation data but has not attached it. engine-results-template.csv records the fields needed. No engine ranking or numeric comparison chart was fabricated. Earlier paper totals remain preliminary and unreconciled.\n`);
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Thesis research diagrams — Archon colours</title><style>body{font:18px/1.6 Arial,sans-serif;max-width:1300px;margin:30px auto;padding:24px;color:#111111}img{width:100%;height:auto}section{margin:60px 0}a{color:#b23800}header{padding:18px;background:#f5f1ec}</style></head><body><h1>ThreatLens — thesis research diagrams</h1><header>Cream, charcoal and orange matched to Archon's light theme. Source-grounded explanatory diagrams, not proof of deployment. SVG files retain scalable text for Word. Engine-comparison plots await the supplied measurements.</header>${records.map(r=>`<section><h2>Figure ${r.number}</h2><p>Section ${esc(r.section)}</p><img src="${r.name}.png" alt="${esc(r.caption)}"><p><strong>Figure ${r.number}:</strong> ${esc(r.caption)}</p><p><a href="${r.name}.svg">Vector SVG</a> · <a href="${r.name}.png">Original PNG</a></p></section>`).join('')}</body></html>`);
for(const filename of fs.readdirSync(out))fs.copyFileSync(path.join(out,filename),path.join(display,filename));
for(const r of records){const meta=await sharp(path.join(out,r.name+'.png')).metadata();console.log(`${r.name}: ${meta.width} x ${meta.height}`);}
console.log('Display folder: '+display);
