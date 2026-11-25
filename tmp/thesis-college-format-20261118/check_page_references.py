"""Check Word's displayed page references against the final rendered pages."""
import json,re
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn

root=Path(__file__).resolve().parent
doc=Document(root.parents[1]/'output/docx/G_14_ThreatLens_Thesis_College_Format.docx')
pages=json.loads((root/'qa-native/pages.json').read_text(encoding='utf-8'))
compact=lambda s:re.sub(r'[^\w]','',s).casefold()
targets={}
for p in doc.paragraphs:
    for b in p._p.iter(qn('w:bookmarkStart')):targets[b.get(qn('w:name'))]=p.text
fields=[]
for p in doc.element.iter(qn('w:p')):
    stack=[]
    for node in p.iter():
        if node.tag==qn('w:fldSimple'):
            match=re.search(r'PAGEREF\s+(\w+)',node.get(qn('w:instr')) or '')
            if match:fields.append((match[1],''.join(n.text or '' for n in node.iter(qn('w:t')))))
        elif node.tag==qn('w:fldChar'):
            kind=node.get(qn('w:fldCharType'))
            if kind=='begin':stack.append({'instruction':'','value':'','display':False})
            elif kind=='separate' and stack:stack[-1]['display']=True
            elif kind=='end' and stack:
                field=stack.pop();match=re.search(r'PAGEREF\s+(\w+)',field['instruction'])
                if match:fields.append((match[1],field['value']))
        elif stack:
            if node.tag==qn('w:instrText'):stack[-1]['instruction']+=node.text or ''
            elif node.tag==qn('w:t') and stack[-1]['display']:stack[-1]['value']+=node.text or ''
assert len(fields)==100,len(fields)
results=[]
for target,displayed in fields:
    title=targets[target]
    front=title in ('ABSTRACT','LIST OF FIGURES','LIST OF TABLES','LIST OF SYMBOLS AND ABBREVIATIONS','LIST OF PUBLICATIONS PROJECT COMPETITIONS AND PATENTS')
    def has_target(page):
        if title in ('REFERENCES','APPENDICES'):
            return compact(title) in [compact(line) for line in page['text'].splitlines()]
        return compact(title) in compact(page['text'])
    candidates=[p for p in pages if (6<=p['page']<=11 if front else p['page']>=16) and has_target(p)]
    assert len(candidates)==1,(target,title,[p['page'] for p in candidates])
    physical=candidates[0]['page']
    expected=('i','ii','iii','iv','v','vi')[physical-6] if front else str(physical-11)
    assert displayed.strip()==expected,(target,title,displayed,expected)
    results.append({'target':target,'label':title,'physical_page':physical,'displayed_page':displayed,'verified':True})
(root/'page-reference-verification.json').write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding='utf-8')
print(f'Passed: all {len(results)} page-reference fields agree with the final Word render.')
