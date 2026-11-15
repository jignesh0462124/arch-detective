from pathlib import Path
from collections import Counter
import json
import pdfplumber
import pypdfium2 as pdfium

source=Path(r'C:\Users\jigne\Downloads\G-24 TrueSheild - AI.pdf')
out=Path(__file__).resolve().parent
selected=[1,4,5,6,7,10,11,23,26,45,49,54,55,68,69,74,88,91]
pdf=pdfium.PdfDocument(str(source))
for number in selected:
    page=pdf[number-1]
    bitmap=page.render(scale=1.5)
    bitmap.to_pil().convert('RGB').save(out/f'page-{number:02d}.png')
    bitmap.close();page.close()
pdf.close()
with pdfplumber.open(source) as pdf:
    result=[]
    for number in [1,4,5,6,7,10,11,15,25,45,55,66,68,88]:
        p=pdf.pages[number-1]
        chars=[c for c in p.chars if c.get('text','').strip()]
        lines=p.extract_text_lines()
        result.append({
            'page':number,
            'first_lines': [{'text':l['text'],'x0':round(l['x0'],2),'x1':round(l['x1'],2),'top':round(l['top'],2),'bottom':round(l['bottom'],2)} for l in lines[:5]],
            'last_lines':[{'text':l['text'],'x0':round(l['x0'],2),'top':round(l['top'],2)} for l in lines[-3:]],
            'line_top_gaps':Counter(round(b['top']-a['top'],2) for a,b in zip(lines,lines[1:]) if 8<b['top']-a['top']<35).most_common(4),
            'rects':[{'x0':round(r['x0'],2),'x1':round(r['x1'],2),'top':round(r['top'],2),'bottom':round(r['bottom'],2),'width':r['linewidth']} for r in p.rects[:4]],
            'page_border_candidates':[{'x0':round(r['x0'],2),'x1':round(r['x1'],2),'top':round(r['top'],2),'bottom':round(r['bottom'],2),'width':r['linewidth']} for r in p.lines if r['x0']<130 or r['x1']>550][:6],
            'first_line_font_sizes':sorted(set((c['fontname'],round(c['size'],1)) for c in chars if lines and abs(c['top']-lines[0]['top'])<3)),
        })
    print(json.dumps(result,indent=2))
    (out/'layout-details.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
