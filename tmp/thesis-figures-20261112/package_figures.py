"""Package real captures and deterministic diagrams for the thesis."""
from pathlib import Path
import json, shutil, hashlib, zipfile, math
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output'/'thesis-figures-20261112'
BASE=ROOT/'tmp'/'thesis-figures-20261112'
REVIEW=BASE/'redacted'
PANELS=OUT/'individual-panels'
PANELS.mkdir(exist_ok=True)
FONT='C:/Windows/Fonts/arial.ttf'
BOLD='C:/Windows/Fonts/arialbd.ttf'

def stacked(panels,name):
    loaded=[Image.open(p).convert('RGB')for _,p in panels]
    width=max(im.width for im in loaded)
    height=sum(im.height+64 for im in loaded)+32
    out=Image.new('RGB',(width+48,height),'white');d=ImageDraw.Draw(out)
    y=24
    for (label,_),im in zip(panels,loaded):
        d.text((24,y),label,font=ImageFont.truetype(BOLD,25),fill='#222222')
        y+=40;out.paste(im,(24,y));y+=im.height+24
    out.save(OUT/name,dpi=(200,200))

for stem in ['figure-5-2-dashboard','figure-5-4-findings','figure-5-5-security-advisor','figure-5-6-audit-workbench','figure-5-7-attack-graph']:
    im=Image.open(REVIEW/(stem+'.png'))
    # Omit the start of a below-fold section, without changing application content.
    if stem=='figure-5-2-dashboard':im=im.crop((0,0,im.width,850))
    im.save(OUT/(stem+'.png'),dpi=(200,200))

for stem in ['figure-5-3a-project-upload','figure-5-3b-recorded-scan-activity']:
    shutil.copy2(REVIEW/(stem+'.png'),PANELS/(stem+'.png'))
stacked([
    ('(a) Project ZIP intake',PANELS/'figure-5-3a-project-upload.png'),
    ('(b) Recorded scan activity from a completed audit',PANELS/'figure-5-3b-recorded-scan-activity.png')
],'figure-5-3-upload-and-recorded-activity.png')

for page,target in [(1,'figure-5-8a-report-cover.png'),(6,'figure-5-8b-report-evidence-and-remedies.png')]:
    shutil.copy2(REVIEW/f'pdf-page-{page:02d}.png',PANELS/target)
cover=Image.open(PANELS/'figure-5-8a-report-cover.png').convert('RGB')
detail=Image.open(PANELS/'figure-5-8b-report-evidence-and-remedies.png').convert('RGB')
report=Image.new('RGB',(cover.width+detail.width+72,max(cover.height,detail.height)+90),'white')
d=ImageDraw.Draw(report)
d.text((24,15),'(a) Generated report cover',font=ImageFont.truetype(BOLD,28),fill='#222222')
d.text((cover.width+48,15),'(b) Recorded evidence and remediation — page 6',font=ImageFont.truetype(BOLD,28),fill='#222222')
report.paste(cover,(24,66));report.paste(detail,(cover.width+48,66))
report.save(OUT/'figure-5-8-generated-report.png',dpi=(180,180))

titles={
'figure-3-1-research-workflow':'3.1  Research and development workflow',
'figure-5-1-system-architecture':'5.1  Overall system architecture',
'figure-5-2-dashboard':'5.2  Dashboard',
'figure-5-3-upload-and-recorded-activity':'5.3  Upload and recorded scan activity',
'figure-5-4-findings':'5.4  Findings and evidence',
'figure-5-5-security-advisor':'5.5  Finding-specific Security Advisor',
'figure-5-6-audit-workbench':'5.6  Read-only source workbench',
'figure-5-7-attack-graph':'5.7  Evidence-based attack graph',
'figure-5-8-generated-report':'5.8  Generated report',
'figure-5-9-database-erd':'5.9  Core database relationships',
}
sheet=Image.new('RGB',(1800,2840),'white');d=ImageDraw.Draw(sheet)
d.text((35,25),'ThreatLens — thesis figure set',font=ImageFont.truetype(BOLD,40),fill='#202020')
d.text((35,83),'Real application captures and implementation-grounded diagrams · 12 November 2026',font=ImageFont.truetype(FONT,22),fill='#555555')
for i,(stem,title) in enumerate(titles.items()):
    x=35+(i%2)*890;y=145+(i//2)*530
    d.text((x,y),title,font=ImageFont.truetype(BOLD,24),fill='#222222')
    im=Image.open(OUT/(stem+'.png'));im.thumbnail((845,475),Image.Resampling.LANCZOS)
    sheet.paste(im,(x+(845-im.width)//2,y+43))
sheet.save(OUT/'FIGURE_OVERVIEW.png',dpi=(150,150))

manifest=[]
for p in sorted(OUT.rglob('*')):
    if not p.is_file() or p.name=='FILE_MANIFEST.json':continue
    row={'file':str(p.relative_to(OUT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
    if p.suffix.lower()=='.png':
        with Image.open(p)as im:row['dimensions']=list(im.size);im.verify()
    manifest.append(row)
(OUT/'FILE_MANIFEST.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
archive=OUT.parent/'ThreatLens_Thesis_Figures_20261112.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED)as z:
    for p in sorted(OUT.rglob('*')):
        if p.is_file():z.write(p,arcname=str(p.relative_to(OUT)))
with zipfile.ZipFile(archive)as z:assert z.testzip()is None
print('Numbered main figures:',len(titles))
print('Package files:',len(manifest)+1)
print('Archive:',archive,'bytes',archive.stat().st_size)
