from pathlib import Path
from collections import Counter
from zipfile import ZipFile
from lxml import etree as E
import hashlib,json,re
from docx import Document
from docx.oxml.ns import qn

root=Path(__file__).resolve().parent
work=root.parents[1]
out=work/'output/docx/G_14_ThreatLens_Thesis_College_Format.docx'
source=Document(work/'output/docx/G_14_ThreatLens_Thesis_.docx')
final=Document(out)
qa=json.loads((root/'qa-native/pages.json').read_text(encoding='utf-8'))
build=json.loads((root/'build-verification.json').read_text(encoding='utf-8'))
norm=lambda t:re.sub(r'\s+',' ',t.replace('\xa0',' ')).strip()
expected=[norm(p.text) for n,p in enumerate(source.paragraphs) if n>=16 and not 60<=n<154 and norm(p.text)]
actual=[norm(p.text) for p in final.paragraphs]
cursor=0
for text in expected:
    while cursor<len(actual) and actual[cursor]!=text:cursor+=1
    assert cursor<len(actual),('missing/changed/out-of-order text',text)
    cursor+=1
for index in [0,1,2,5,6,7]:
    data=norm(' '.join(n.text or '' for n in source.tables[index]._tbl.iter(qn('w:t'))))
    assert data in [norm(' '.join(n.text or '' for n in t._tbl.iter(qn('w:t')))) for t in final.tables]
def effective_font(style,property_name):
    while style is not None:
        value=getattr(style.font,property_name)
        if value is not None:return value
        style=style.base_style
    return None
for role,size in [('Normal',12),('Title',18),('Heading 1',16),('Heading 2',14),('Heading 3',12),('Caption1',12)]:
    assert effective_font(final.styles[role],'name')=='Calibri',(role,effective_font(final.styles[role],'name'))
    assert effective_font(final.styles[role],'size').pt==size,(role,effective_font(final.styles[role],'size'))
    if role.startswith('Heading '):
        assert final.styles[role].builtin
        assert final.styles[role].element.find(qn('w:pPr')).find(qn('w:outlineLvl')).get(qn('w:val'))==str(int(role[-1])-1)
for section in final.sections:
    assert section._sectPr.find(qn('w:pgSz')).get(qn('w:w'))=='11907'
    assert section._sectPr.find(qn('w:pgSz')).get(qn('w:h'))=='16839'
    margins=section._sectPr.find(qn('w:pgMar'))
    for key,value in [('top','1440'),('bottom','1800'),('left','2160'),('right','1152')]:assert margins.get(qn('w:'+key))==value
    assert section._sectPr.find(qn('w:pgBorders')).find(qn('w:top')).get(qn('w:val'))=='thickThinSmallGap'
assert not [p for p in qa if p['outside_border']]
assert all(p['text'].strip() or p['images'] for p in qa)
assert not re.search(r'Error!|Reference source not found|Bookmark not defined',' '.join(p['text'] for p in qa))
assert all(len(qa[i]['images'])==2 for i in range(4))
for p in qa:
    for image in p['images']:
        assert image['x0']>=100 and image['x1']<=546 and image['top']>=60 and image['bottom']<=779,(p['page'],image)
hashes={hashlib.sha256(r.target_part.blob).hexdigest() for r in final.part.rels.values() if r.reltype.endswith('/image')}
assert set(build['source_body_image_hashes'])<=hashes
bookmarks=[n.get(qn('w:name')) for n in final.element.iter(qn('w:bookmarkStart'))]
assert len(bookmarks)==len(set(bookmarks))
field_targets=[]
for node in final.element.iter():
    if node.tag==qn('w:instrText'):
        match=re.search(r'PAGEREF\s+(\w+)',node.text or '')
        if match:field_targets.append(match[1])
    if node.tag==qn('w:fldSimple'):
        match=re.search(r'PAGEREF\s+(\w+)',node.get(qn('w:instr')) or '')
        if match:field_targets.append(match[1])
assert set(field_targets)<=set(bookmarks)
assert len(field_targets)==100,len(field_targets)
with ZipFile(out) as z:
    assert z.testzip() is None
    for name in z.namelist():
        if name.endswith('.rels'):
            for rel in E.fromstring(z.read(name)):
                if rel.get('TargetMode')=='External':continue
                import posixpath
                base=posixpath.dirname(posixpath.dirname(name))
                target=posixpath.normpath(posixpath.join(base,rel.get('Target'))).lstrip('/')
                assert target in z.namelist(),(name,target)
ref=Path(json.loads((root/'template-inventory.json').read_text(encoding='utf-8'))['path'])
assert hashlib.sha256(ref.read_bytes()).hexdigest()==build['reference_sha256']
unchanged=[]
for number in range(1,len(qa)+1):
    previous=root/'qa-confirmed'/f'page-{number}.png'
    current=root/'qa-native'/f'page-{number}.png'
    if previous.exists() and hashlib.sha256(previous.read_bytes()).digest()==hashlib.sha256(current.read_bytes()).digest():unchanged.append(number)
report={'docx':str(out),'pages':len(qa),'paragraphs_preserved_in_order':len(expected),'substantive_tables_preserved':6,'body_images_preserved_byte_for_byte':len(build['source_body_image_hashes']),'all_text_and_images_inside_border':True,'logo_and_banner_on_each_branded_page':True,'page_reference_targets_valid':len(field_targets),'template_original_unchanged':True,'unchanged_from_reviewed_render':unchanged,'docx_bytes':out.stat().st_size}
(root/'final-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
