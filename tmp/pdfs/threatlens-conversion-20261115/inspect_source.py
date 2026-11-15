from pathlib import Path
import json, re
from collections import Counter
import pdfplumber
from docx import Document
from difflib import SequenceMatcher

root = Path(__file__).resolve().parent
source = Path(r'C:\Users\jigne\Downloads\ThreatLens_Thesis_Formatted (1).pdf')
pages=[]
with pdfplumber.open(source) as pdf:
    for i,p in enumerate(pdf.pages,1):
        text=p.extract_text() or ''
        pages.append(dict(page=i,text=text,images=len(p.images),tables=len(p.find_tables()),fonts=Counter((c['fontname'],round(c['size'],1)) for c in p.chars).most_common(4)))
(root/'source-pages.json').write_text(json.dumps(pages,indent=2),encoding='utf-8')
(root/'source-text.txt').write_text('\n\n'.join(f'PAGE {p["page"]}\n{p["text"]}' for p in pages),encoding='utf-8')
print('PDF PAGES',len(pages))
for p in pages:
    print(p['page'],p['text'].splitlines()[:3],'images',p['images'],'tables',p['tables'])

def paragraphs(doc):
    from docx.oxml.ns import qn
    return [''.join(p.itertext()) for p in []]
pdftext=' '.join(p['text'] for p in pages)
pdfwords=re.findall(r'\w+',pdftext.lower())
for path in [Path('output/docx/ThreatLens_Thesis_Formatted.docx'),Path(r'C:\Users\jigne\Downloads\ThreatLens_Thesis_Fixed.docx')]:
    doc=Document(path)
    texts=[''.join(p.itertext()) for p in []]
    text=' '.join(n.text for n in doc.element.body.iter() if n.tag.endswith('}t') and n.text)
    words=re.findall(r'\w+',text.lower())
    match=SequenceMatcher(None,pdfwords,words,autojunk=False)
    print('DOCX',path,'paras',len(doc.paragraphs),'tables',len(doc.tables),'images',len(doc.inline_shapes),'words',len(words),'similarity',match.ratio())
    print('START',text[:500])
    (root/(path.stem+'-text.txt')).write_text(text,encoding='utf-8')
    diffs=[dict(tag=tag,pdf=' '.join(pdfwords[a:b])[:400],docx=' '.join(words[c:d])[:400]) for tag,a,b,c,d in match.get_opcodes() if tag!='equal']
    (root/(path.stem+'-diff.json')).write_text(json.dumps(diffs,indent=2),encoding='utf-8')
