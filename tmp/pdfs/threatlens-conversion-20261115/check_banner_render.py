from pathlib import Path
import json
from PIL import Image,ImageChops
import pypdfium2 as pdfium
import pdfplumber

root=Path(__file__).resolve().parent
out=root/'banner-render';out.mkdir(exist_ok=True)
pdf=pdfium.PdfDocument(root/'banner-review.pdf')
changed=[]
for i in range(len(pdf)):
    page=pdf[i];bitmap=page.render(scale=1.3);im=bitmap.to_pil().convert('RGB')
    name=f'page-{i+1:02}.png';im.save(out/name)
    previous=Image.open(root/'logo-render'/name).convert('RGB')
    if im.size!=previous.size or ImageChops.difference(im,previous).getbbox():changed.append(i+1)
    bitmap.close();page.close()
with pdfplumber.open(root/'banner-review.pdf') as new,pdfplumber.open(root/'logo-review.pdf') as old:
    assert len(new.pages)==len(old.pages)==65
    for i in range(3,65):assert new.pages[i].extract_text()==old.pages[i].extract_text(),i+1
    banner=[]
    for i in range(3):
        im=next(x for x in new.pages[i].images if x['width']>300 and x['top']>600)
        box=[round(im[k],2) for k in ['x0','top','x1','bottom']]
        assert 110<=box[0] and box[2]<535 and box[3]<770,box
        rules=[(round(x['x0'],1),round(x['top'],1),round(x['x1'],1),round(x['bottom'],1)) for x in new.pages[i].rects if x['width']>420 and x['height']<3 and x['top']>700]
        banner.append({'page':i+1,'banner_box':box,'bottom_border_segments':rules})
assert changed==[1,2,3],changed
(root/'banner-render-verification.json').write_text(json.dumps({'pages':65,'changed_pages':changed,'other_62_pages_pixel_identical':True,'banner_positions':banner},indent=2),encoding='utf8')
print(json.dumps({'pages':65,'changed_pages':changed,'other_62_pages_pixel_identical':True,'banner_positions':banner},indent=2))
