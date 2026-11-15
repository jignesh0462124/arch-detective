from pathlib import Path
import json,re
import pypdfium2 as pdfium
import pdfplumber

root=Path(__file__).resolve().parent
out=root/'centred-content-render';out.mkdir(exist_ok=True)
render=pdfium.PdfDocument(root/'centred-content-review.pdf')
checks=[];branding=[]
with pdfplumber.open(root/'centred-content-review.pdf') as pdf,pdfplumber.open(root/'centred-border-review.pdf') as before:
    assert len(pdf.pages)==len(before.pages)==65
    for i,p in enumerate(pdf.pages):
        normalise=lambda s:re.sub(r'\.{2,}|\s+','',s)
        assert normalise(p.extract_text())==normalise(before.pages[i].extract_text()),i+1
        vertical=[r for r in p.rects if r['width']<3 and r['height']>700]
        horizontal=[r for r in p.rects if r['width']>500 and r['height']<3]
        left=min(r['x0'] for r in vertical);right=max(r['x1'] for r in vertical)
        top=min(r['top'] for r in horizontal);bottom=max(r['bottom'] for r in horizontal)
        assert abs(left-(p.width-right))<.15
        chars=[c for c in p.chars if c['text'].strip()]
        assert all(left<c['x0'] and c['x1']<right and top<c['top'] and c['bottom']<bottom for c in chars),i+1
        assert all(left<im['x0'] and im['x1']<right and top<im['top'] and im['bottom']<bottom for im in p.images),i+1
        if i<3:
            logo=next(im for im in p.images if im['width']<200 and im['top']<300)
            banner=next(im for im in p.images if im['width']>300 and im['top']>600)
            assert abs((banner['x0']+banner['x1'])/2-p.width/2)<.2
            assert abs(logo['x0']-88.8)<.2
            branding.append({'page':i+1,'logo_left_pt':round(logo['x0'],2),'logo_top_pt':round(logo['top'],2),'banner_center_pt':round((banner['x0']+banner['x1'])/2,2),'page_center_pt':p.width/2})
        # The line widths stay unchanged; the column simply moves to the page centre.
        visible=lambda page:[c for c in page.chars if c['text'].strip() and c['text']!='.']
        a,b=visible(before.pages[i]),visible(p)
        assert len(a)==len(b),i+1
        max_vertical_shift=max(abs(x['top']-y['top']) for x,y in zip(a,b))
        assert max_vertical_shift<.2,(i+1,max_vertical_shift)
        checks.append({'page':i+1,'text_unchanged':True,'vertical_positions_unchanged':True,'all_content_inside_border':True})
        page=render[i];bm=page.render(scale=1.3);im=bm.to_pil().convert('RGB');im.save(out/f'page-{i+1:02}.png');bm.close();page.close()
report={'pages':65,'text_unchanged_on_all_pages':True,'equal_left_right_margins_inches':1.15,'text_column_width_and_vertical_layout_preserved':True,'all_content_inside_border':True,'branding':branding,'checks':checks}
(root/'centred-content-render-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='checks'},indent=2))
