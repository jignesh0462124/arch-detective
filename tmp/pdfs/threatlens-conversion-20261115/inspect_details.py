import pdfplumber,json
from pathlib import Path
from pypdf import PdfReader
from docx import Document
from collections import Counter
out=Path(__file__).resolve().parent
path=r'C:\Users\jigne\Downloads\ThreatLens_Thesis_Formatted (1).pdf'
pdf=pdfplumber.open(path)
for i in [7,8]: print('TABLE',i+1,json.dumps(pdf.pages[i].extract_tables(),ensure_ascii=True))
for i in [3,4,9,53,54]:
    print('LINES',i+1,json.dumps([(round(x['top'],1),round(x['x0'],1),x['text']) for x in pdf.pages[i].extract_text_lines()],ensure_ascii=True))
r=PdfReader(path)
for i,img in enumerate(r.pages[0].images):
    print('IMAGE',img.name,len(img.data),img.image.size)
    (out/f'branding-{i}.png').write_bytes(img.data)
d=Document(r'C:\Users\jigne\Downloads\G-14 ThreatLens - An LLM-Agentic Compliance Mapping And Threat Modeling.docx')
print('STYLE',[(s.name,s.style_id) for s in d.styles if 'List' in s.name])
print('FIG',[(i,p.text) for i,p in enumerate(d.paragraphs) if 'Figure' in p.text])
print('IMAGES',[(round(x.width/914400,2),round(x.height/914400,2)) for x in d.inline_shapes])
print('BREAKS',[(i,p.text[:70]) for i,p in enumerate(d.paragraphs) if p._p.xpath('.//w:br[@w:type="page"]')])
print('LISTS',[(i,p.style.name,p.text[:70],p._p.xml[:200]) for i,p in enumerate(d.paragraphs) if p._p.xpath('.//w:numPr')][:3])
print('UNUSUAL',Counter(c for p in d.paragraphs for c in p.text if ord(c)>127))
print('CELL',[[[c.text for c in row.cells] for row in t.rows] for t in d.tables])
