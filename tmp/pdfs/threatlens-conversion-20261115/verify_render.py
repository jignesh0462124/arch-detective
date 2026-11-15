from pathlib import Path
import json,re,hashlib
from collections import Counter
from difflib import SequenceMatcher
import pdfplumber,pypdfium2 as pdfium
from PIL import Image,ImageDraw,ImageFont
from docx import Document
from docx.oxml.ns import qn

root=Path(__file__).resolve().parent
doc=Document(root.parents[2]/'output/docx/ThreatLens_Thesis_Reference_Formatted.docx')
orig=Document(r'C:\Users\jigne\Downloads\G-14 ThreatLens - An LLM-Agentic Compliance Mapping And Threat Modeling.docx')
def t(el):return ''.join(n.text or '' for n in el.iter(qn('w:t')))
norm=lambda s:re.sub(r'\s+','',s)
origtext=t(orig.element.body)
selected=[];active=False
for el in doc.element.body:
    text=t(el)
    if norm(text)=='CHAPTER1INTRODUCTION':active=True
    if active and text=='REFERENCES':break
    if active:selected.append(text)
newtext=''.join(selected)
print('BODY CONTENT EXACT',norm(origtext)==norm(newtext),'nonwhitespace chars',len(norm(origtext)),len(norm(newtext)))
if norm(origtext)!=norm(newtext):
    m=SequenceMatcher(None,norm(origtext),norm(newtext),autojunk=False)
    print('DIFF',[(tag,norm(origtext)[a:b],norm(newtext)[c:d]) for tag,a,b,c,d in m.get_opcodes() if tag!='equal'][:10])
def hashes(d):
    ids=[n.get(qn('r:embed')) for n in d.element.body.iter() if n.tag.endswith('}blip')]
    return Counter(hashlib.sha256(d.part.related_parts[i].blob).hexdigest() for i in ids)
print('ALL 10 BODY IMAGES EXACT',hashes(orig)==hashes(doc))

path=root/'word-review.pdf'
pdf=pdfium.PdfDocument(path);images=root/'render';images.mkdir(exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
pages=[]
with pdfplumber.open(path) as ppdf:
    for i,p in enumerate(ppdf.pages):
        text=p.extract_text() or ''
        chars=[c for c in p.chars if c['text'].strip()]
        pages.append(dict(page=i+1,text=text,images=len(p.images),bbox=[round(min(c['x0'] for c in chars),1),round(min(c['top'] for c in chars),1),round(max(c['x1'] for c in chars),1),round(max(c['bottom'] for c in chars),1)] if chars else [],first=text.splitlines()[:3]))
        pic=pdf[i].render(scale=1.3).to_pil().convert('RGB');pic.save(images/f'page-{i+1:02}.png')
for start in range(0,len(pdf),8):
    sheet=Image.new('RGB',(1280,940),'#dddddd');draw=ImageDraw.Draw(sheet)
    for j in range(min(8,len(pdf)-start)):
        im=Image.open(images/f'page-{start+j+1:02}.png');im.thumbnail((302,420))
        x=(j%4)*320+9;y=(j//4)*470+34
        sheet.paste(im,(x,y));draw.text((x,y-27),str(start+j+1),fill='black',font=font)
    sheet.save(root/f'contact-{start+1:02}.png')
(root/'rendered-pages.json').write_text(json.dumps(pages,indent=2),encoding='utf8')
print('PAGES',len(pages))
for p in pages:print(p['page'],p['first'],p['bbox'],'images',p['images'])
