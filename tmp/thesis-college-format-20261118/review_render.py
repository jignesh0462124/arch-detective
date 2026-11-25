from pathlib import Path
from collections import Counter
import argparse,json,re
import pdfplumber
from PIL import Image,ImageDraw

parser=argparse.ArgumentParser()
parser.add_argument('pdf')
parser.add_argument('out')
args=parser.parse_args()
root=Path(args.out);root.mkdir(parents=True,exist_ok=True)
pages=[];thumbs=[]
with pdfplumber.open(args.pdf) as pdf:
    for number,page in enumerate(pdf.pages,1):
        text=page.extract_text(x_tolerance=2) or ''
        image=page.to_image(resolution=120).original
        image.save(root/f'page-{number}.png')
        image.thumbnail((420,594));thumbs.append(image)
        out=[c for c in page.chars if c.get('text','').strip() and (c['x0']<99 or c['x1']>548 or c['top']<59 or c['bottom']>781)]
        pages.append({'page':number,'text':text,'fonts':Counter((c['fontname'],round(c['size'],1)) for c in page.chars).most_common(4),
            'outside_border':[{'text':c['text'],'x0':c['x0'],'x1':c['x1'],'top':c['top'],'bottom':c['bottom']} for c in out],
            'images':[{k:v for k,v in i.items() if k in ['x0','x1','top','bottom','width','height']} for i in page.images]})
        print(number,repr(text.splitlines()[:2]),'images',len(page.images),'out',len(out),flush=True)
for start in range(0,len(thumbs),4):
    sheet=Image.new('RGB',(880,1250),'#dedbd5');draw=ImageDraw.Draw(sheet)
    for index,image in enumerate(thumbs[start:start+4]):
        x=(index%2)*440+10;y=(index//2)*625+22
        sheet.paste(image,(x,y));draw.text((x,y-18),f'Page {start+index+1}',fill='black')
    sheet.save(root/f'contact-{start//4+1:02}.png')
(root/'pages.json').write_text(json.dumps(pages,indent=2),encoding='utf-8')
(root/'all-text.txt').write_text('\n\n'.join(f"PAGE {p['page']}\n{p['text']}" for p in pages),encoding='utf-8')
print('PAGES',len(pages),'outside-border pages',[p['page'] for p in pages if p['outside_border']])
