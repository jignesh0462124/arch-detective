from pathlib import Path
import json
import pypdfium2 as pdfium
import pdfplumber
from PIL import Image

root=Path(__file__).resolve().parent
out=root/'centred-border-render';out.mkdir(exist_ok=True)
render=pdfium.PdfDocument(root/'centred-border-review.pdf')
checks=[]
with pdfplumber.open(root/'centred-border-review.pdf') as pdf,pdfplumber.open(root/'banner-review.pdf') as prior:
    assert len(pdf.pages)==len(prior.pages)==65
    for i,p in enumerate(pdf.pages):
        vertical=[r for r in p.rects if r['width']<3 and r['height']>700]
        horizontal=[r for r in p.rects if r['width']>500 and r['height']<3]
        assert vertical and horizontal,i+1
        left=min(r['x0'] for r in vertical);right=max(r['x1'] for r in vertical)
        top=min(r['top'] for r in horizontal);bottom=max(r['bottom'] for r in horizontal)
        gaps=[left,p.width-right,top,p.height-bottom]
        assert abs(gaps[0]-gaps[1])<.15,(i+1,gaps)
        assert abs(gaps[2]-gaps[3])<.15,(i+1,gaps)
        assert p.extract_text()==prior.pages[i].extract_text(),i+1
        chars=[c for c in p.chars if c['text'].strip()]
        assert all(left<c['x0'] and c['x1']<right and top<c['top'] and c['bottom']<bottom for c in chars),i+1
        assert all(left<im['x0'] and im['x1']<right and top<im['top'] and im['bottom']<bottom for im in p.images),i+1
        checks.append({'page':i+1,'outside_gaps_pt':[round(x,3) for x in gaps],'text_unchanged':True,'all_text_and_images_inside_border':True})
        page=render[i];bm=page.render(scale=1.3);im=bm.to_pil().convert('RGB');im.save(out/f'page-{i+1:02}.png');bm.close();page.close()
report={'pages':65,'all_65_borders_centred_horizontally_and_vertically':True,'all_page_text_unchanged':True,'no_text_or_images_outside_border':True,'checks':checks}
(root/'centred-border-render-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='checks'},indent=2));print('First page gaps in pt:',checks[0]['outside_gaps_pt'])
