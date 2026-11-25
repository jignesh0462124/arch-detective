from collections import defaultdict
from contextlib import closing
from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile
import json
import re
import shutil
import subprocess

from docx import Document
from lxml import etree as E
import pypdfium2 as pdfium

base=Path('tmp/g14-submission').resolve()
out=Path('output/G-14 ThreatLens').resolve()
manifest=json.loads((base/'listing_manifest.json').read_text())
pdfs=base/'doc-renders'
poppler=Path(shutil.which('pdftoppm')).parent
pages_checked=0
seen=defaultdict(set)
secrets=re.compile(r'(?i)(?:gsk_[\w-]{24,}|sk-(?:proj-|ant-)?[\w-]{24,}|gh[pousr]_[\w-]{20,}|github_pat_[\w-]{24,}|sb_(?:secret|publishable)_[\w-]{20,}|xox[baprs]-[\w-]{12,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{14,}\.[A-Za-z0-9_-]{14,}\.[A-Za-z0-9_-]{8,})')
for name, data in manifest['volumes'].items():
    file=out/name
    with ZipFile(file) as z:
        assert z.testzip() is None,name
        assert not secrets.search(z.read('word/document.xml').decode()),name
    paragraphs=Document(file).paragraphs
    starts=0
    for i,p in enumerate(paragraphs):
        if p.style.name=='Source File':
            f=p.text
            info=manifest['files'][f]
            starts+=bool(p.paragraph_format.page_break_before)
            assert paragraphs[i+2].style.name=='Source Listing'
            if info['line_count']:
                a,b,n=map(int,re.search(r'Lines (\d+) to (\d+) of (\d+)',paragraphs[i+1].text).groups())
                assert n==info['line_count']
                seen[f].update(range(a,b+1))
            else:
                assert paragraphs[i+1].text=='Empty module file'
                seen[f]=set()
    assert starts==data['listing_pages'],name
assert set(seen)==set(manifest['files'])
for f,r in seen.items():
    assert r==set(range(1,manifest['files'][f]['line_count']+1)),f

def verify_pdf(f):
    lookup = {Path(n).stem:v['listing_pages'] for n,v in manifest['volumes'].items()}
    source=lookup.get(f.stem)
    with pdfium.PdfDocument(f) as pdf:
        assert (source is None and len(pdf)==3 or source is not None and source < len(pdf) <= source+4), f.name
        n_listing=0
        for index,p in enumerate(pdf):
            with closing(p.get_textpage()) as text:
                body=text.get_text_bounded(left=0,bottom=41,right=612,top=792).strip()
                assert body,(f.name,'empty body',index+1)
                rects=[text.get_rect(i) for i in range(text.count_rects())]
                assert all(x>=41 and r<=571 and t<=753 for x,b,r,t in rects if t>=41),(f.name,'out-of-bounds text',index+1)
                listing=body.startswith(('src/','threatlens/','supabase/','.env.','package.json','vite.config','tsconfig','eslint','components.json','docker-compose','scripts/'))
                if listing:
                    n_listing+=1
                if source is None or (listing and n_listing==1) or (index==len(pdf)-1):
                    screen=base/'word-preview'
                    screen.mkdir(exist_ok=True)
                    p.render(scale=1.35).to_pil().save(screen/f'{f.stem} p{index+1:03}.png')
            p.close()
        assert source is None or n_listing==source,(f.name,n_listing,source)
        return len(pdf)

pdf_files=list(pdfs.glob('*.pdf'))
assert len(pdf_files)==len(manifest['volumes'])+1
pages_checked=sum(map(verify_pdf,pdf_files))
print(f'Word: all {len(pdf_files)} documents rendered; text bounds verified across {pages_checked} pages. All {len(seen)} source ranges present.')
downloads=Path('C:/Users/jigne/Downloads')
for group, name in [('Research Paper','G-14 ThreatLens Research paper.pdf'),('Thesis','G_14_ThreatLens_Thesis_Chapters.pdf')]:
    assert sha256((out/group/name).read_bytes()).hexdigest()==sha256((downloads/name).read_bytes()).hexdigest()
print('PDF copies: both SHA-256 hashes match the originals.')
