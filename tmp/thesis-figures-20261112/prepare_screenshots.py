"""Redact account identifiers from genuine browser captures; no UI synthesis."""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont
import pypdfium2 as pdfium

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'tmp'/'thesis-figures-20261112'
OUT=ROOT/'output'/'thesis-figures-20261112'
REVIEW=BASE/'redacted'
REVIEW.mkdir(exist_ok=True)
FONT='C:/Windows/Fonts/arial.ttf'
BOLD='C:/Windows/Fonts/arialbd.ttf'

def redact():
    manifest=json.loads((BASE/'raw'/'manifest.json').read_text())
    for entry in manifest:
        im=Image.open(BASE/'raw'/(entry['name']+'.jpg')).convert('RGB')
        d=ImageDraw.Draw(im)
        # Only the visible sidebar account area is private. A second profile
        # locator can be an offscreen responsive menu; do not redact unrelated UI.
        for r in entry['masks']:
            if r['width']<=0 or r['height']<=0 or r['x']>100:continue
            x,y=max(0,math.floor(r['x'])-3),max(0,math.floor(r['y'])-3)
            w,h=math.ceil(r['width'])+6,math.ceil(r['height'])+6
            d.rectangle((x,y,x+w,y+h),fill='#F0EFEC',outline='#CBC8C3')
            if w>120:d.text((x+8,y+16),'Account details redacted',fill='#55514B',font=ImageFont.truetype(FONT,12))
            else:d.text((x+10,y+15),'—',fill='#55514B',font=ImageFont.truetype(FONT,16))
        im.save(REVIEW/(entry['name']+'.png'),dpi=(200,200))
    return manifest

def render_pdf():
    pdf=pdfium.PdfDocument(str(BASE/'raw'/'saved-audit-report.pdf'))
    texts=[]
    for i in range(len(pdf)):
        page=pdf[i]
        textpage=page.get_textpage()
        texts.append(textpage.get_text_range())
        page.render(scale=2.5).to_pil().convert('RGB').save(REVIEW/f'pdf-page-{i+1:02d}.png',dpi=(180,180))
        textpage.close();page.close()
    (BASE/'pdf-page-text.txt').write_text('\n\n'.join(f'PAGE {i+1}\n{t}'for i,t in enumerate(texts)),encoding='utf-8')
    print('PDF pages:',len(pdf))
    pdf.close()

if __name__=='__main__':
    manifest=redact();render_pdf()
    # Review sheet preserves screenshot content; only downsizes for inspection.
    items=[REVIEW/(e['name']+'.png')for e in manifest]
    cellw,cellh=840,570
    sheet=Image.new('RGB',(cellw*2,cellh*math.ceil(len(items)/2)),'#FFFFFF')
    d=ImageDraw.Draw(sheet)
    for i,p in enumerate(items):
        im=Image.open(p);im.thumbnail((800,500))
        x=(i%2)*cellw+20;y=(i//2)*cellh+40
        d.text((x,y-27),p.stem,fill='#222222',font=ImageFont.truetype(FONT,20))
        sheet.paste(im,(x,y))
    sheet.save(BASE/'screenshot-review.jpg',quality=92)
