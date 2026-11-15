import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {FileZip} from '@phosphor-icons/react/dist/ssr/FileZip';
import {ShieldCheck} from '@phosphor-icons/react/dist/ssr/ShieldCheck';
import {CodeBlock} from '@phosphor-icons/react/dist/ssr/CodeBlock';
import {Database} from '@phosphor-icons/react/dist/ssr/Database';
import {FileMagnifyingGlass} from '@phosphor-icons/react/dist/ssr/FileMagnifyingGlass';
import {FileArrowDown} from '@phosphor-icons/react/dist/ssr/FileArrowDown';
const requireRuntime=createRequire('C:/Users/jigne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp=requireRuntime('sharp');
const out=path.resolve('output/Thesis_Workflow_Academic_Icons_20261114');
const display='C:/Users/jigne/.codex/visualizations/2026/10/17/01a14884-7256-79b3-83a0-d85a3174c02c/thesis-workflow-academic-icons';
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(display,{recursive:true});
const c={ink:'#111111',cream:'#f5f1ec',orange:'#b23800',muted:'#626260',line:'#d3cec6'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const svg=[];
function text(x,y,lines,size=27,bold=false,color=c.ink,family='Arial,Helvetica,sans-serif'){
  (Array.isArray(lines)?lines:[lines]).forEach((line,i)=>svg.push(`<text x="${x}" y="${y+i*size*1.4}" font-family="${family}" font-size="${size}" font-weight="${bold?700:400}" fill="${color}">${esc(line)}</text>`));
}
function arrow(points,dash=false){svg.push(`<polyline points="${points}" fill="none" stroke="${c.ink}" stroke-width="2.5" marker-end="url(#arrow)" ${dash?'stroke-dasharray="8 7"':''}/>`);}
const stageIcons=[FileZip,ShieldCheck,CodeBlock,Database,FileMagnifyingGlass,FileArrowDown];
function icon(x,y,number){
  const markup=renderToStaticMarkup(React.createElement(stageIcons[Number(number)-1],{size:36,weight:'regular',color:c.orange,'aria-hidden':true}));
  svg.push(`<g data-stage-icon="${number}" transform="translate(${x} ${y})">${markup}</g>`);
}
function step(x,y,n,title,lines){
  svg.push(`<rect x="${x}" y="${y}" width="500" height="230" rx="3" fill="${c.cream}" stroke="${c.line}" stroke-width="2"/><line x1="${x+23}" y1="${y+73}" x2="${x+477}" y2="${y+73}" stroke="${c.line}"/>`);
  text(x+24,y+45,n,24,true,c.orange);text(x+78,y+45,title,31,true);
  icon(x+440,y+21,n);
  text(x+24,y+115,lines,26);
}
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1280" viewBox="0 0 1800 1280" role="img"><title>ThreatLens Security Analysis Workflow</title><desc>Print-first workflow diagram for the core saved-ZIP path, with a separately labelled optional worker and retrieval profile.</desc><defs><marker id="arrow" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L9 5 L0 10 Z" fill="${c.ink}"/></marker></defs><rect width="1800" height="1280" fill="white"/>`);
text(60,74,'ThreatLens Security Analysis Workflow',45,true,c.ink,'Georgia,Times New Roman,serif');
text(60,124,'Core project-ZIP workflow',27,false,c.muted);
svg.push(`<line x1="60" y1="154" x2="1740" y2="154" stroke="${c.line}" stroke-width="2"/>`);
step(60,205,'01','Project intake',['Select ZIP and frameworks','React / TypeScript interface','Submit an authorised project']);
step(650,205,'02','Validate and accept',['Check identity and membership','Validate archive boundaries','Return a saved scan reference']);
step(1240,205,'03','Prepare and analyse',['Prepare redacted source previews','Run static and model review','Process independent work concurrently']);
step(1240,575,'04','Ground and persist',['Check source-linked locations','Merge and save reported findings','Mark complete after persistence']);
step(650,575,'05','Evidence review',['Inspect source and finding details','Use the graph for associations','Review suggested remedies']);
step(60,575,'06','Report export',['Read saved assessment data','Render with Chromium / fallback','Download the generated PDF']);
arrow('560,320 650,320');arrow('1150,320 1240,320');arrow('1490,435 1490,575');arrow('1240,690 1150,690');arrow('650,690 560,690');
text(60,867,'Supporting services',27,true);
text(60,911,'Supabase Auth  ·  PostgreSQL with workspace policies  ·  Private source storage  ·  Configured model provider',26,false,c.muted);
svg.push(`<rect x="60" y="965" width="1680" height="215" rx="3" fill="white" stroke="${c.orange}" stroke-width="2" stroke-dasharray="9 7"/>`);
text(84,1008,'Separate optional worker and retrieval profile',29,true,c.orange);
text(84,1055,'Celery / Redis → Semgrep → Bandit → TruffleHog → dependency audit → model review',27);
text(84,1096,'Deduplicate → CVSS and candidate control mapping → persist results',27);
text(84,1141,'Retrieval support: versioned reference corpus → embeddings / Qdrant → candidate controls',26,false,c.muted);
text(60,1241,'Dashed enclosure denotes an optional deployment. Findings and suggested mappings require human review.',25,false,c.muted);
svg.push('</svg>');
const image=svg.join('');
fs.writeFileSync(path.join(out,'threatlens-security-workflow.svg'),image);
await sharp(Buffer.from(image)).resize({width:3600}).png().toFile(path.join(out,'threatlens-security-workflow.png'));
const notes=`# ThreatLens workflow — academic presentation with icons\n\nRedrawn as a vector diagram, not a generatively reconstructed screenshot.\n\nPalette uses the project's light-theme CSS tokens: cream #f5f1ec, charcoal #111111, accent #b23800, muted #626260 and border #d3cec6. White page background is retained for printing. Six regular-weight outline icons use the same Phosphor family as the application: FileZip, ShieldCheck, CodeBlock, Database, FileMagnifyingGlass and FileArrowDown. Source: installed @phosphor-icons/react 2.1.10, MIT licence (included). No gradients, grid texture, shadows or fabricated measurements.\n\nThe core saved-ZIP path is separate from optional scanner-worker/retrieval services. Specialist worker calls are sequential. A fixed model version and an unverified corpus count are omitted. PDF rendering precedes delivery. Diagram source grounding is recorded in output/Thesis_Research_Diagrams_Archon_Colours_20261114/FIGURE_GUIDE.md. This is not a claim of live deployment verification.\n\nPlacement: Section 3.4, Source Code Ingestion and Preprocessing. Replace the previous Figure 3.2; do not add a duplicate figure. Keep the separate research-methodology Figure 3.1.\n\nCaption: Figure 3.2: ThreatLens security-analysis workflow showing project intake, validation, source preparation and analysis, persistence, evidence review and report generation. Optional worker and retrieval services are shown separately.\n\nPNG: 3600 x 2560. SVG is preferable for Word resizing. Original icon-free files are preserved. Application code is unchanged.\n\nRemaining comparison work: the engine bar/pie plots require the user's uploaded results table or CSV. A yes answer confirms availability, not the measurements. No ranking, timing percentage or test outcome was fabricated.\n`;
fs.writeFileSync(path.join(out,'PLACEMENT_AND_PROVENANCE.md'),notes);
fs.copyFileSync(path.resolve('node_modules/@phosphor-icons/react/LICENSE'),path.join(out,'PHOSPHOR-LICENSE.txt'));
for(const filename of fs.readdirSync(out))fs.copyFileSync(path.join(out,filename),path.join(display,filename));
const meta=await sharp(path.join(out,'threatlens-security-workflow.png')).metadata();
console.log(JSON.stringify({workspace:out,display,width:meta.width,height:meta.height},null,2));
