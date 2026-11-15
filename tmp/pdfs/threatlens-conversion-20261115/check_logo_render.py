from pathlib import Path
from PIL import Image,ImageChops
import json
import pypdfium2 as pdfium
import pdfplumber

root=Path(__file__).resolve().parent
out=root/'logo-render';out.mkdir(exist_ok=True)
pdf=pdfium.PdfDocument(root/'logo-review.pdf')
changed=[]
for i in range(len(pdf)):
    page=pdf[i];bm=page.render(scale=1.3);im=bm.to_pil().convert('RGB')
    name=f'page-{i+1:02}.png';im.save(out/name)
    previous=Image.open(root/'render'/name).convert('RGB')
    if im.size!=previous.size or ImageChops.difference(im,previous).getbbox():changed.append(i+1)
    bm.close();page.close()
with pdfplumber.open(root/'logo-review.pdf') as p:
    positions=[]
    for i in range(3):
        logo=next(im for im in p.pages[i].images if im['width']<200 and im['top']<300)
        positions.append(dict(page=i+1,logo_box=[round(logo[k],1) for k in ['x0','top','x1','bottom']],first_lines=(p.pages[i].extract_text() or '').splitlines()[:3]))
    for entry in positions:
        assert entry['logo_box'][0]>100 and entry['logo_box'][1]>=70
    with pdfplumber.open(root/'word-review.pdf') as old:
        max_shift=0
        for i in range(3,len(p.pages)):
            assert old.pages[i].extract_text()==p.pages[i].extract_text(),i+1
            a,b=old.pages[i].chars,p.pages[i].chars
            assert len(a)==len(b),i+1
            max_shift=max(max_shift,max(abs(x[k]-y[k]) for x,y in zip(a,b) for k in ['x0','top','x1','bottom']))
report={'pages':len(pdf),'changed_pages':changed,'unchanged_pages_pixel_identical':len(pdf)-len(changed),'logo_positions':positions,'maximum_body_character_position_shift_pt':max_shift,'body_page_text_unchanged':True}
assert len(pdf)==65
assert max_shift<.5,max_shift
(root/'logo-render-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
