from pathlib import Path
from collections import Counter
from difflib import SequenceMatcher
from zipfile import ZipFile
import json,re,hashlib
import pdfplumber
from docx import Document
from docx.oxml.ns import qn

root=Path(__file__).resolve().parent
source=Path(r'C:\Users\jigne\Downloads\ThreatLens_Thesis_Formatted (1).pdf')
target=root.parents[2]/'output/docx/ThreatLens_Thesis_Reference_Formatted.docx'
pdf=pdfplumber.open(source);doc=Document(target)
orig=Document(r'C:\Users\jigne\Downloads\G-14 ThreatLens - An LLM-Agentic Compliance Mapping And Threat Modeling.docx')
text=lambda el:''.join(n.text or '' for n in el.iter(qn('w:t')))
norm=lambda s:re.sub(r'\s+','',s)
front=[];body=[];end=[];state=0
for el in doc.element.body:
    s=text(el)
    if norm(s)=='CHAPTER1INTRODUCTION':state=1
    if state==1 and s=='REFERENCES':state=2
    [front,body,end][state].append(s)
front_src=''.join(''.join(l['text'] for l in p.extract_text_lines() if l['top']<(740 if i<3 else 780)) for i,p in enumerate(pdf.pages[:12]))
frontnorm=lambda s:re.sub(r'\s|\.{2,}','',s)
end_src=''.join(''.join(l['text'] for l in p.extract_text_lines() if l['top']<780) for p in pdf.pages[53:])
body_src='\n'.join('\n'.join(l['text'] for l in p.extract_text_lines() if l['top']<780) for p in pdf.pages[12:53])
body_src=re.sub(r'(?m)^\d+\.\s+','',body_src)
words=lambda s:re.findall(r'\w+',s.lower())
a,b=words(body_src),words(text(orig.element.body))
matcher=SequenceMatcher(None,a,b,autojunk=False)
diff=[dict(kind=t,pdf=a[i:j],editable=b[k:l]) for t,i,j,k,l in matcher.get_opcodes() if t!='equal']
def media(d):
    return Counter(hashlib.sha256(d.part.related_parts[n.get(qn('r:embed'))].blob).hexdigest() for n in d.element.body.iter() if n.tag.endswith('}blip'))
result={
    'front_content_character_inventory_exact_excluding_whitespace_and_dot_leaders':Counter(frontnorm(front_src))==Counter(frontnorm(''.join(front))),
    'chapter_body_text_exact_excluding_whitespace':norm(text(orig.element.body))==norm(''.join(body)),
    'all_ten_body_image_bytes_exact':media(doc)==media(orig),
    'references_appendices_ordered_text_exact_excluding_whitespace':norm(end_src)==norm(''.join(end)),
    'body_pdf_vs_editable_differences':diff,
    'reference_hyperlinks_preserved':all(h['uri'] in [r.target_ref for r in doc.part.rels.values() if r.is_external] for h in pdf.pages[53].hyperlinks),
    'table_count':len(doc.tables),'body_figure_count':len(doc.inline_shapes),
    'output_bytes':target.stat().st_size,
}
with ZipFile(target) as z:
    result['review_comments_parts']=[p for p in z.namelist() if 'comments' in p.lower()]
(root/'content-verification.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps(result,indent=2))
assert result['front_content_character_inventory_exact_excluding_whitespace_and_dot_leaders']
assert result['chapter_body_text_exact_excluding_whitespace']
assert result['all_ten_body_image_bytes_exact']
assert result['references_appendices_ordered_text_exact_excluding_whitespace']
assert result['reference_hyperlinks_preserved']
