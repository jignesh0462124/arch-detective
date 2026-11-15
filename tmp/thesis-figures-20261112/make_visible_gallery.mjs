import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = 'C:/Users/jigne/OneDrive/Desktop/College Project/arch-detective';
const source = path.join(root, 'output/ThreatLens_Thesis_Figures_20261112');
const output = path.join(root, 'output/Thesis_Figures_Visible_20261113');
const preview = 'C:/Users/jigne/.codex/visualizations/2026/10/17/01a14884-7256-79b3-83a0-d85a3174c02c/thesis-figures-visible';
const figures = [
  ['3.1', 'Research workflow', 'figure-3-1-research-workflow', '01-research-workflow', 'diagram'],
  ['5.1', 'System architecture', 'figure-5-1-system-architecture', '02-system-architecture', 'diagram'],
  ['5.2', 'Dashboard', 'figure-5-2-dashboard', '03-dashboard', 'capture'],
  ['5.3', 'Upload and recorded scan activity', 'figure-5-3-upload-and-recorded-activity', '04-upload-and-scan-activity', 'capture'],
  ['5.4', 'Findings and evidence', 'figure-5-4-findings', '05-findings', 'capture'],
  ['5.5', 'Security Advisor', 'figure-5-5-security-advisor', '06-security-advisor', 'capture'],
  ['5.6', 'Audit Workbench', 'figure-5-6-audit-workbench', '07-audit-workbench', 'capture'],
  ['5.7', 'Attack graph', 'figure-5-7-attack-graph', '08-attack-graph', 'capture'],
  ['5.8', 'Generated report', 'figure-5-8-generated-report', '09-generated-report', 'report'],
  ['5.9', 'Database relationships', 'figure-5-9-database-erd', '10-database-relationships', 'diagram'],
];
const panels = [
  ['Upload screen', 'figure-5-3a-project-upload.png', '04a-upload.png'],
  ['Recorded scan activity', 'figure-5-3b-recorded-scan-activity.png', '04b-recorded-activity.png'],
  ['Report cover', 'figure-5-8a-report-cover.png', '09a-report-cover.png'],
  ['Report evidence and remedies', 'figure-5-8b-report-evidence-and-remedies.png', '09b-report-evidence.png'],
];
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for (const destination of [output, preview]) {
  fs.mkdirSync(destination, {recursive:true});
  const files = [];
  const copy = (from, name) => {
    const data = fs.readFileSync(from);
    fs.copyFileSync(from, path.join(destination, name));
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    const copiedHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(destination, name))).digest('hex');
    if (copiedHash !== hash) throw new Error('Copy mismatch: ' + name);
    files.push({file:name, bytes:data.length, sha256:hash});
  };
  for (const [, , original, name, kind] of figures) {
    copy(path.join(source, original + '.png'), name + '.png');
    if (kind === 'diagram') copy(path.join(source, original + '.svg'), name + '.svg');
  }
  for (const [, original, name] of panels) copy(path.join(source, 'individual-panels', original), name);
  copy(path.join(source, 'CAPTIONS_AND_PLACEMENT.md'), 'CAPTIONS_AND_PLACEMENT.md');

  const cards = figures.map(([number, title, , name, kind], index) => {
    const split = number === '5.3' ? panels.slice(0,2) : number === '5.8' ? panels.slice(2) : [];
    return `<section id="figure-${number.replace('.','-')}">
      <header><div><p class="eyebrow">FIGURE ${number} · ${kind === 'diagram' ? 'VECTOR DIAGRAM AVAILABLE' : kind === 'report' ? 'SAVED PDF PAGES' : 'ORIGINAL APPLICATION CAPTURE'}</p><h2>${esc(title)}</h2></div>
      <div class="actions"><a href="${name}.png" target="_blank" rel="noopener">Open full size</a><a href="${name}.png" download>Download PNG</a>${kind === 'diagram' ? `<a href="${name}.svg" target="_blank" rel="noopener">Open scalable SVG</a>` : ''}</div></header>
      <div class="zoom"><button type="button" data-scale="fit" aria-pressed="true">Fit width</button><button type="button" data-scale="100" aria-pressed="false">100% pixels</button><button type="button" data-scale="150" aria-pressed="false">150%</button><button type="button" data-scale="200" aria-pressed="false">200%</button><span class="dimensions" aria-live="polite"></span></div>
      <div class="viewport" tabindex="0" role="region" aria-label="Figure ${number} image; scroll to explore when zoomed"><img src="${name}.png" alt="Figure ${number}: ${esc(title)}" loading="${index === 0 ? 'eager' : 'lazy'}"></div>
      ${kind === 'capture' ? '<p class="note">The saved capture has limited text sharpness. Zoom enlarges the existing pixels; it does not recover missing detail. No UI text or results have been reconstructed.</p>' : ''}
      ${split.length ? `<aside><strong>For readable thesis placement, use the separate panels:</strong> ${split.map(([label,,file])=>`<a href="${file}" target="_blank" rel="noopener">${esc(label)}</a>`).join(' · ')}</aside>` : ''}
    </section>`;
  }).join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ThreatLens — full-size thesis figures</title>
<style>
:root{color-scheme:light;font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;color:#202020;background:#f3f2ef}*{box-sizing:border-box}body{margin:0}main{max-width:1480px;margin:auto;padding:32px 24px 64px}h1{font-size:clamp(26px,4vw,40px);line-height:1.2;margin:8px 0 18px}h2{font-size:22px;line-height:1.3;margin:0}.intro{max-width:1000px}.notice{background:#fff7e9;border:1px solid #bd7625;border-left:4px solid #a85111;border-radius:6px;padding:14px 18px}.navigation{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 32px}a{color:#81300d;text-underline-offset:3px}a:focus-visible,button:focus-visible,.viewport:focus-visible{outline:3px solid #1665c1;outline-offset:3px}.navigation a,.actions a,button{border:1px solid #bbb6ae;border-radius:5px;background:white;padding:9px 12px;min-height:42px;text-decoration:none;font:inherit}.navigation a:hover,.actions a:hover,button:hover{background:#f8eee6}section{background:white;border:1px solid #d0ccc5;border-radius:8px;margin:0 0 32px;overflow:hidden;scroll-margin-top:16px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:20px}.eyebrow{font-size:12px;letter-spacing:.06em;font-weight:650;color:#61564d;margin:0 0 4px}.actions{display:flex;gap:8px;flex-wrap:wrap;font-size:14px}.zoom{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 20px;border-top:1px solid #ddd;border-bottom:1px solid #ddd;background:#f7f6f3}button{cursor:pointer;font-size:14px}button[aria-pressed="true"]{background:#242321;color:white;border-color:#242321}.dimensions{font-size:13px;color:#555}.viewport{overflow:auto;background:white;padding:12px;max-height:85vh}.viewport img{display:block;width:100%;height:auto;max-width:100%;margin:auto}.note,aside{margin:0;padding:14px 20px;font-size:14px;border-top:1px solid #ddd;color:#49433d}aside a{white-space:normal}footer{font-size:14px;color:#555}@media(max-width:600px){main{padding:20px 10px}header{padding:16px}.actions a{flex:1;text-align:center}.zoom{padding:10px}.viewport{padding:0}}@media print{body{background:white}main{padding:0}.navigation,.actions,.zoom,.notice{display:none}.viewport{max-height:none;overflow:visible}section{break-before:page;border:0;overflow:visible}.viewport img{width:100%!important;max-width:100%!important}.note{font-size:10pt}}
</style></head><body><main><div class="intro"><p class="eyebrow">THREATLENS · THESIS FIGURES · VISIBILITY EDITION</p><h1>View each figure at full size</h1><p>Ten original figures, shown separately instead of squeezed into one contact sheet. Use <strong>Open full size</strong> or <strong>100% pixels</strong> to read the source image. White backgrounds and original colours are preserved.</p><p class="notice"><strong>Image-quality limit:</strong> several original application screenshots are blurred. They have not been replaced with mockups, fixture results or invented details. The local app was offline during this visibility repair, so sharper recaptures remain pending. Use SVG for diagrams and separate panels for upload/report figures.</p></div>
<nav class="navigation" aria-label="Choose a figure">${figures.map(([number,title])=>`<a href="#figure-${number.replace('.','-')}">${number} ${esc(title)}</a>`).join('')}</nav>
${cards}
<footer>Prepared 13 November 2026 from the existing 12 November figure set. No application code or saved scan data was changed. <a href="CAPTIONS_AND_PLACEMENT.md">Original captions and evidence notes</a></footer></main>
<script>
document.querySelectorAll('section').forEach(section=>{
  const image=section.querySelector('img');
  const dimensions=section.querySelector('.dimensions');
  function showSize(){if(image.naturalWidth) dimensions.textContent=image.naturalWidth+' × '+image.naturalHeight+' source pixels';}
  image.addEventListener('load',showSize);showSize();
  section.querySelectorAll('button[data-scale]').forEach(button=>button.addEventListener('click',()=>{
    section.querySelectorAll('button[data-scale]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
    if(button.dataset.scale==='fit'){image.style.width='100%';image.style.maxWidth='100%';}
    else{image.loading='eager';const apply=()=>{image.style.width=Math.round(image.naturalWidth*Number(button.dataset.scale)/100)+'px';image.style.maxWidth='none';};if(image.naturalWidth)apply();else image.addEventListener('load',apply,{once:true});}
  }));
});
</script></body></html>`;
  fs.writeFileSync(path.join(destination,'index.html'), html, 'utf8');
  const readme = `# Full-size thesis figures\n\nOpen index.html in your browser. It works offline; keep the image files beside it. Choose Fit width, 100% pixels, 150% or 200%. Open full size opens each original PNG separately.\n\nThree diagrams also have SVG files. Figures 5.3 and 5.8 include separate panels, which are easier to read on thesis pages than the combined figures. See CAPTIONS_AND_PLACEMENT.md for captions and evidence limitations.\n\n## What was fixed\n\n- Added individual full-size previews, rather than relying on the small overview sheet.\n- Added a local gallery with zoom and direct PNG/SVG access.\n- Used a path without spaces for previews in Codex.\n- Preserved all image bytes and existing privacy redactions. No application content or results were recreated.\n\n## Remaining quality limit\n\nSeveral original UI captures are already blurred. Larger pixel dimensions or zoom cannot restore missing text detail. Local frontend ports 5173/5174 and backend port 8000 were unavailable during this repair; sharper screenshots were not recaptured. Do not mistake gallery zoom for higher-resolution source material.\n\n## Figure list\n\n${figures.map(([number,title,,name])=>`- Figure ${number}: [${title}](${name}.png)`).join('\n')}\n\nPrepared 13 November 2026. Originals remain unchanged.\n`;
  fs.writeFileSync(path.join(destination,'README.md'), readme, 'utf8');
  fs.writeFileSync(path.join(destination,'FILE_MANIFEST.json'),JSON.stringify(files,null,2),'utf8');
  console.log(JSON.stringify({directory:destination, copiedImages:files.filter(f=>f.file.endsWith('.png')).length, verifiedCopies:files.length, galleryBytes:Buffer.byteLength(html)}));
}
