from pathlib import Path
from collections import Counter
from zipfile import ZipFile
from difflib import SequenceMatcher
import hashlib
import json
import re

import pdfplumber
from docx import Document
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parent
PDF = Path(r'C:\Users\jigne\Downloads\G_14_ThreatLens_Thesis_.pdf')
TEMPLATE = Path(r'C:\Users\jigne\Downloads\Project Thesis Guidelines Winter 2026 Format.docx')
EDITABLE = ROOT.parents[1] / 'output/docx/G_14_ThreatLens_Thesis_.docx'
ROOT.mkdir(parents=True, exist_ok=True)

def inventory(path):
    doc = Document(path)
    with ZipFile(path) as package:
        parts = {n: {'bytes': len(package.read(n)), 'sha256': hashlib.sha256(package.read(n)).hexdigest()} for n in package.namelist()}
    return {
        'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'parts': parts,
        'sections': [s._sectPr.xml for s in doc.sections],
        'styles': [{'name': s.name, 'xml': s.element.xml} for s in doc.styles if s.type == 1],
        'paragraphs': [{'n': n, 'text': p.text, 'style': p.style.name, 'xml': p._p.xml} for n, p in enumerate(doc.paragraphs)],
        'tables': [{'n': n, 'rows': [[c.text for c in r.cells] for r in t.rows], 'xml': t._tbl.xml} for n, t in enumerate(doc.tables)],
        'images': [{'width': s.width/914400, 'height': s.height/914400, 'xml': s._inline.xml} for s in doc.inline_shapes],
        'all_text': ' '.join(n.text for n in doc.element.body.iter(qn('w:t')) if n.text),
        'header_footer': [{name: getattr(s, name)._element.xml for name in ('header','footer','first_page_header','first_page_footer')} for s in doc.sections],
    }

template = inventory(TEMPLATE)
(ROOT/'template-inventory.json').write_text(json.dumps(template, indent=2), encoding='utf-8')
(ROOT/'template-text.txt').write_text('\n'.join(f"P{p['n']} [{p['style']}] {p['text']}" for p in template['paragraphs']) + '\nTABLES\n' + '\n'.join(str(t['rows']) for t in template['tables']), encoding='utf-8')
with pdfplumber.open(PDF) as pdf:
    pages = []
    for n, page in enumerate(pdf.pages, 1):
        text = page.extract_text(x_tolerance=2) or ''
        pages.append({'page': n, 'text': text, 'width': page.width, 'height': page.height,
            'fonts': Counter((c['fontname'],round(c['size'],1)) for c in page.chars).most_common(6), 'images': len(page.images)})
        if n <= 4:
            page.to_image(resolution=100).save(ROOT/f'source-page-{n}.png')
(ROOT/'source-pages.json').write_text(json.dumps(pages, indent=2), encoding='utf-8')
(ROOT/'source-text.txt').write_text('\n\n'.join(f"PAGE {p['page']}\n{p['text']}" for p in pages), encoding='utf-8')
print('SOURCE PDF PAGES', len(pages))
print('TEMPLATE sections',len(template['sections']),'paragraphs',len(template['paragraphs']),'tables',len(template['tables']),'inline images',len(template['images']))
for p in pages:
    print(p['page'],repr(p['text'].splitlines()[:2]),'images',p['images'])
if EDITABLE.exists():
    editable = inventory(EDITABLE)
    (ROOT/'editable-inventory.json').write_text(json.dumps(editable, indent=2), encoding='utf-8')
    pdf_words = re.findall(r'\w+', ' '.join(p['text'] for p in pages).lower())
    doc_words = re.findall(r'\w+', editable['all_text'].lower())
    matcher = SequenceMatcher(None,pdf_words,doc_words,autojunk=False)
    diffs = [{'kind': tag, 'pdf': ' '.join(pdf_words[a:b]), 'docx': ' '.join(doc_words[c:d])} for tag,a,b,c,d in matcher.get_opcodes() if tag!='equal']
    (ROOT/'content-diff.json').write_text(json.dumps(diffs, indent=2),encoding='utf-8')
    print('EXISTING DOCX',len(doc_words),'PDF',len(pdf_words),'word similarity',round(matcher.ratio(),5),'differences',len(diffs))
    print('DOCX sections',len(editable['sections']),'paragraphs',len(editable['paragraphs']),'tables',len(editable['tables']),'images',len(editable['images']))
