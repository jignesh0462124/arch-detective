from pathlib import Path
from collections import Counter
import json
import re
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFont

source = Path(r'C:\Users\jigne\Downloads\G-24 TrueSheild - AI.pdf')
out = Path(__file__).resolve().parent
out.mkdir(parents=True, exist_ok=True)
pages = []
fonts = Counter()
with pdfplumber.open(source) as document:
    for number, page in enumerate(document.pages, 1):
        text = page.extract_text(layout=False) or ''
        chars = [c for c in page.chars if c.get('text', '').strip()]
        styles = Counter((c['fontname'], round(c['size'], 1)) for c in chars)
        fonts.update(styles)
        headings = []
        for word in page.extract_words(extra_attrs=['fontname', 'size']):
            if word['size'] >= 14:
                headings.append({k: word[k] for k in ['text', 'x0', 'x1', 'top', 'bottom', 'fontname', 'size']})
        body_chars = [c for c in chars if 120 < c['top'] < 760]
        positions = sorted(set(round(c['top'], 1) for c in chars if 11.5 < c['size'] < 12.5 and 120 < c['top'] < 740))
        gaps = Counter(round(b-a, 1) for a,b in zip(positions, positions[1:]) if 8 < b-a < 35)
        pages.append({
            'page': number, 'width': page.width, 'height': page.height,
            'text': text, 'styles': [{'font':f, 'size':s, 'characters':n} for (f,s),n in styles.most_common(8)],
            'heading_words': headings,
            'body_bounds': [min(c['x0'] for c in body_chars), min(c['top'] for c in body_chars), max(c['x1'] for c in body_chars), max(c['bottom'] for c in body_chars)] if body_chars else None,
            'body_line_gaps': gaps.most_common(5), 'image_count': len(page.images),
            'rect_count': len(page.rects), 'line_count': len(page.lines),
            'footer': page.crop((0, 770, page.width, page.height)).extract_text() or '',
        })

(out/'pages.json').write_text(json.dumps(pages, indent=2), encoding='utf-8')
(out/'full-text.txt').write_text('\n\n'.join(f'PDF PAGE {p["page"]}\n{p["text"]}' for p in pages), encoding='utf-8')
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 17)
pdf = pdfium.PdfDocument(str(source))
for start in range(0, len(pdf), 16):
    sheet = Image.new('RGB', (1080, 1580), '#e7e7e7')
    draw = ImageDraw.Draw(sheet)
    for offset in range(min(16, len(pdf)-start)):
        page = pdf[start+offset]
        bitmap = page.render(scale=.43)
        image = bitmap.to_pil().convert('RGB')
        image.thumbnail((250, 354))
        x = (offset % 4)*270+10
        y = (offset // 4)*395+30
        draw.text((x,y-24), f'PDF page {start+offset+1}', font=font, fill='#111111')
        sheet.paste(image,(x,y))
        bitmap.close(); page.close()
    sheet.save(out/f'contact-{start+1:02d}-{min(start+16,len(pdf)):02d}.png')
pdf.close()
summary = {
    'page_count':len(pages),
    'fonts':[{'font':f,'size':s,'characters':n} for (f,s),n in fonts.most_common(12)],
    'page_outline':[{'page':p['page'],'first_lines':p['text'].splitlines()[:4],'footer':p['footer'],'images':p['image_count']} for p in pages],
}
(out/'summary.json').write_text(json.dumps(summary,indent=2), encoding='utf-8')
print(json.dumps(summary,indent=2))
