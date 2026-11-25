import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { FileBlob, PresentationFile } from 'file:///C:/Program%20Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const source = 'C:/Users/jigne/Downloads/ThreatLens_Project_Presentation_with_Literature-.pptx';
const work = path.resolve('tmp/g14-submission');
const target = path.resolve('output/G-14 ThreatLens/PPT');
await fs.mkdir(path.join(work,'verified'),{recursive:true});
const tools = 'C:/Users/jigne/.codex/plugins/cache/openai-primary-runtime/presentations/26.1123.11515/skills/presentations/container_tools';
const python = 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/python/python.exe';
const { finalizePresentation } = await import(pathToFileURL(path.join(tools,'artifact_tool_utils.mjs')).href);

const shapeBy = (s, i) => {
  const obj = s.shapes.items.find(x => x.name === `object ${i}`);
  if (!obj) throw Error(`Could not find object ${i} on ${s.id}: ${s.shapes.items.map(x=>x.name).join(',')}`);
  return obj;
};
const edit = (s, i, value) => {
  const el = shapeBy(s, i);
  const before = el.text.toString();
  if (Array.isArray(value)) {
    const old = before.split('\n');
    if (old.length === value.length && old.every(x=>x.length>0) && new Set(old).size===old.length) {
      const slots=value.map((_,k)=>`QQSZ${k}ZQQ`);
      old.forEach((str,k)=>el.text.replace(str,slots[k]));
      value.forEach((str,k)=>el.text.replace(slots[k],str));
    } else {
      el.text.replace(before,value.join('\n'));
    }
  } else el.text.replace(before,value);
};
const editFirst = (s,i,from,to) => shapeBy(s,i).text.replace(from,to);
const named = (s,i,title) => edit(s,i,title);

async function collegeLogos(slide){
  for(const [i,left,top,width,height,name] of [[4,45,41,574,119,'G. H. Raisoni College of Engineering'],[5,1634,42,235,115,'Raisoni Education']]){
    const im=await fs.readFile(path.join(work,'template-assets',`image${i}.jpg`));
    slide.images.add({blob:im.buffer.slice(im.byteOffset,im.byteOffset+im.byteLength),contentType:'image/jpeg',
      alt:name,fit:'contain',position:{left,top,width,height}});
  }
}

const mainNotes = {
  literature: 'Sources: supplied G-14 ThreatLens Research paper, Section II and References. Zhou et al., literature review on vulnerability detection and repair. Lewis et al., retrieval-augmented generation. Basak et al., SecretBench for secret-detection evaluation. The project uses these ideas as design inputs rather than evidence of its own detection accuracy.',
  bench: 'Source: threatlens/tests/benchmark_workbench.py, rerun in the project review at revision 143aee6. Three runs per size using a memory store, simulated storage delays and deterministic model responses. At 90 files: baseline median first readable source 1.6264 s, optimized 0.1391 s; baseline median completion after validation 2.4279 s, optimized 0.7446 s. No hosted timing or detection quality claim.',
  limits: 'Sources: README.md and .github/implementation-notes/EXTENSION_REVIEW.md. The released ZIP Workbench is distinct from optional worker/retrieval and configured GitHub capabilities. Figure is for explaining the component boundaries.',
};

function cover(slide,num,label) {
  edit(slide,3,`Seminar ${num} / G-14`);
  editFirst(slide,4,shapeBy(slide,4).text.toString().split('\n').slice(-1)[0],label);
  shapeBy(slide,4).text.style={alignment:'center'};
}
function ending(slide,num,label) {
  edit(slide,3,'Questions?');
  edit(slide,4,`ThreatLens  /  Group G-14  /  Seminar ${num}`);
}
function architecture(slide){
  edit(slide,8,'Static checks');
  edit(slide,32,'Optional Worker');
  edit(slide,36,'Qdrant RAG');
  edit(slide,41,'Model review');
  edit(slide,45,'Supabase PostgreSQL');
  edit(slide,49,'Private Source Storage');
  edit(slide,54,'The browser submits the audit. FastAPI checks workspace access. Worker and retrieval services depend on the deployment profile.');
  slide.speakerNotes.text=mainNotes.limits;
}
function workflow(slide){
  edit(slide,6,'Audit Methodology');
  edit(slide,23,'Deduplicate');
  edit(slide,28,'Review');
  edit(slide,37,['Inputs','Start with a ZIP project. GitHub and packaged extension review use separate configuration.']);
  edit(slide,41,['Analysis','Validate the archive. Run the enabled checks and record any limit on coverage.']);
  edit(slide,45,['Review Output','Review evidence and remedies. Export the saved report.']);
}
function stack(slide){
  edit(slide,2,'Modules and Technology');
  edit(slide,6,['Frontend','React, TypeScript, TanStack Start and Query']);
  edit(slide,10,['Backend API','FastAPI, Pydantic and SQLAlchemy']);
  edit(slide,14,['Background Work','In-process ZIP workflow and optional Celery worker']);
  edit(slide,18,['Optional Retrieval','Sentence embeddings and Qdrant']);
  edit(slide,22,['Security Checks','Static rules and configured scanner adapters']);
  edit(slide,26,['Security Advisor','Model-assisted explanations with source context']);
  edit(slide,30,['Reports','Saved audit PDF, CSV and JSON']);
  edit(slide,34,['Data Services','Supabase and private Storage']);
  edit(slide,35,'The available engine and service set depends on the installed profile.');
}
function database(slide){
  edit(slide,2,'Database and Access Control');
  edit(slide,7,'Profiles and workspace members\nScans and scan artifacts\nFindings and control mappings\nReports and audit events');
  edit(slide,11,['Supabase Auth manages the user session.','The API checks the requested workspace.','Row-level policies scope database access.']);
  edit(slide,16,['Uploaded archives are treated as untrusted.','Intake checks size and entry paths.','Retained source previews use private storage.']);
  edit(slide,17,'Workspace membership governs the audit. A saved finding can remain after its source preview expires.');
}
function status(slide,finish){
  if(!finish){
    named(slide,2,'Work at the Prototype Stage');
    edit(slide,6,'Working Components');
    edit(slide,7,['Frontend navigation and audit screens','FastAPI health and framework routes','Database models and migrations','Retrieval modules and unit fixtures']);
    edit(slide,11,'Integration Pending');
    edit(slide,12,['Connect workspace access to audit intake.','Carry detector output into saved findings.','Verify evidence and PDF export together.']);
    edit(slide,16,'Next Checkpoint');
    edit(slide,17,'Demonstrate sign-in, an authorized ZIP audit, a recorded finding, and a report using the same test project.');
  } else {
    named(slide,2,'Completed Project Work');
    edit(slide,6,'Core Workflow');
    edit(slide,7,['Workspace-based ZIP audits','Scan progress and saved history','Source evidence and findings review','Downloadable audit reports']);
    edit(slide,11,'Configured Features');
    edit(slide,12,['Finding conversations in Advisor','Chrome and Edge package review','Reviewed GitHub proposals with permission']);
    edit(slide,16,'Known Limits');
    edit(slide,17,'Coverage depends on the input and enabled checks. Review proposed changes and policy mappings before relying on them.');
  }
}
function verification(slide){
  named(slide,3,'Verification and Future Work');
  edit(slide,7,'Functional Checks');
  edit(slide,8,['Frontend regression checks','Workspace access policy fixtures','Saved source and findings review','PDF rendering and export checks']);
  edit(slide,12,'Offline Timing');
  edit(slide,13,['90-file synthetic fixture','First source: 1.63 s to 0.14 s','Completion: 2.43 s to 0.74 s','Same saved findings in both runs']);
  edit(slide,17,'Next Evaluation');
  edit(slide,18,['Label a varied project set.','Measure precision and recall.','Separate results by language.','Run a hosted performance test.']);
  edit(slide,19,'Timings are medians from three offline runs with simulated storage and model responses.');
  slide.speakerNotes.text=mainNotes.bench;
}

const decks = [
  {num:1,label:'Problem Identification and Proposed Solution',selected:[1,2,3,4,6,7,13]},
  {num:2,label:'Partial Implementation',selected:[1,2,7,8,9,10,11,13]},
  {num:3,label:'Completed Project Work',selected:[1,2,8,9,10,11,12,13]},
];

for(const d of decks){
  const pres = await PresentationFile.importPptx(await FileBlob.load(source));
  const slides = pres.slides.items;
  const get = i => slides[i-1];
  cover(get(1),d.num,d.label);
  ending(get(13),d.num,d.label);
  for (const i of [2,13,...(d.num>1?[11]:[])]) await collegeLogos(get(i));
  const agendas = {
    1:['Project background','Problem identification','Related work','Project objectives','Proposed solution and workflow','Expected audit outputs','Discussion'],
    2:['Audit methodology','System architecture','Modules and technology','Database and access control','Working components','Integration pending','Next checkpoint'],
    3:['System architecture','Modules and technology','Database and access control','Completed project work','Audit Workbench demonstration','Verification and future work','Discussion'],
  };
  edit(get(2),3,agendas[d.num]);
  if(d.num===1){
    edit(get(3),4,'ThreatLens brings source evidence and security findings into one review workspace.');
    edit(get(3),9,['Scanner results use different formats.','Manual control mapping takes time.','Evidence can be hard to trace.','Developers need a clear next step.']);
    edit(get(3),14,['Combine findings from enabled checks.','Keep each finding linked to evidence.','Suggest relevant controls for review.','Share a saved audit report.']);
    edit(get(3),19,['Prioritized findings, source paths, and suggested remediation.','PDF, CSV, and JSON output.']);
    const lit=get(4);
    named(lit,4,'Literature Survey');
    const tb=lit.tables.items[0];
    if(!tb) throw Error('Source literature table unavailable');
    const matrix=[
      ['Ref','Source','Year','Work','Relevance to ThreatLens','Scope'],
      ['1','Zhou et al.','2024','LLMs for Vulnerability Detection and Repair','Survey of detection and repair tasks.','Supports evaluating model advice against source evidence.'],
      ['2','Shestov et al.','2024','Finetuning LLMs for Vulnerability Detection','Explores fine-tuning for classification.','Does not validate this project’s model or thresholds.'],
      ['3','Uddin et al.','2025','Deep Learning Aided Vulnerability Detection','Reviews datasets and evaluation approaches.','Comparison requires common data and scoring.'],
      ['4','Lewis et al.','2020','Retrieval-Augmented Generation','Uses retrieved material when generating an answer.','A retrieved control still needs scope and applicability checks.'],
      ['5','Basak et al.','2023','SecretBench','Provides labeled material for secret detection evaluation.','Useful for evaluation, not a detector by itself.'],
    ];
    matrix.forEach((row,y)=>row.forEach((v,x)=>{
      const cell=tb.getCell(y,x);
      cell.text.replace(cell.text.toString(),v);
      cell.text.style={fontFamily:'Arial',fontSize:y===0?'13pt':'13pt',color:y===0?'#FFFFFF':'#232129',bold:y===0,alignment:(x===0||x===2||y===0)?'center':'left',verticalAlignment:'middle'};
    }));
    tb.cells.block({row:0,column:0,rowCount:6,columnCount:6}).assign({margins:{left:7,right:7,top:9,bottom:6}});
    for(const sh of lit.shapes.items){
      const t=sh.text.toString();
      if(t.startsWith('Selected research')) sh.text.replace(t,'Selected work cited in the ThreatLens research paper');
      if(t.startsWith('Only the top')) sh.text.replace(t,'Sources: ThreatLens research paper, related work and references.');
    }
    lit.speakerNotes.text=mainNotes.literature;
    named(get(6),2,'Project Objectives');
    edit(get(6),8,'Accept a project ZIP and preserve the audit scope.');
    edit(get(6),14,'Combine supported static checks with optional source review.');
    edit(get(6),19,'Show relevant controls and identify gaps that require manual review.');
    edit(get(6),25,'Export a report with source evidence and suggested remediation.');
    edit(get(6),31,'Keep workspace records and source previews under access control.');
    workflow(get(7));
  } else {
    if(d.num===2) workflow(get(7));
    architecture(get(8)); stack(get(9)); database(get(10)); status(get(11),d.num===3);
    if(d.num===3) verification(get(12));
  }
  for(const [i,s] of slides.entries()) if(!d.selected.includes(i+1)) pres.delete(s.id);
  if(d.num===3){
    const screenshotSlide=get(11).duplicate();
    for(const el of [...screenshotSlide.shapes.items]) if(el.name!=="object 2") el.delete();
    named(screenshotSlide,2,'Audit Workbench');
    const sourceShot=await fs.readFile('docs/screenshots/workbench.png');
    screenshotSlide.images.add({blob:sourceShot.buffer.slice(sourceShot.byteOffset,sourceShot.byteOffset+sourceShot.byteLength),
      contentType:'image/png',fit:'cover',crop:{left:0,top:0.031,right:0,bottom:0.062},alt:'ThreatLens Workbench with read-only source and finding evidence from an isolated audit fixture',
      position:{left:482,top:173,width:956,height:720}});
    const label=screenshotSlide.shapes.add({geometry:'textbox',position:{left:275,top:943,width:1370,height:48},fill:'none'});
    label.text='The Workbench displays saved findings next to their recorded source locations.';
    label.text.style={fontFamily:'Calibri',fontSize:'18pt',color:'#5B007D',alignment:'center'};
    screenshotSlide.speakerNotes.text='Source: docs/screenshots/workbench.png. The captured audit uses isolated demonstration data.';
  }
  const draft=path.join(work,`seminar-${d.num}-draft.pptx`);
  const final=path.join(target,`Seminar ${d.num}.pptx`);
  const verified=path.join(work,'verified',`seminar-${d.num}-${randomUUID()}.pptx`);
  await (await PresentationFile.exportPptx(pres)).save(draft);
  const proof=await PresentationFile.importPptx(await FileBlob.load(draft));
  const dir=path.join(work,`seminar-${d.num}`);
  await fs.mkdir(dir,{recursive:true});
  for(const [i,slide] of proof.slides.items.entries()){
    const png=await proof.export({slide,format:'png',scale:0.6});
    await fs.writeFile(path.join(dir,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));
  }
  const result=await finalizePresentation({
    workspaceDir:path.resolve('.'),candidatePath:draft,finalPath:verified,pythonExecutable:python,
    integrityValidatorPath:path.join(tools,'inspect_presentation_package_integrity.py'),
    layoutValidatorPath:path.join(tools,'inspect_presentation_layout_geometry.py'),
    layoutArgs:['--expected-slide-size-emu','18288000,10287000',...(d.num===1?['--require-native-table-slide','4']:[])],
    requiredNativeTableOwnerSlides:d.num===1?[4]:[],
    explicitTotalSlideCount:d.selected.length+(d.num===3?1:0),
    verifyArtifactToolImport:true,receiptPath:path.join(work,`seminar-${d.num}-${randomUUID()}-validation.json`),
  });
  await fs.copyFile(verified,final);
  console.log(`Seminar ${d.num}: ${proof.slides.items.length} slides, exported and checked.`,final);
}
