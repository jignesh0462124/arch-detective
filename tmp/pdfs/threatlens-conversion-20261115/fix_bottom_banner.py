from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import hashlib,json

root=Path(__file__).resolve().parent
src=root.parents[2]/'output/docx/ThreatLens_Thesis_Logo_Inside_Border.docx'
dst=src.with_name('ThreatLens_Thesis_Corrected.docx')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'rel':'http://schemas.openxmlformats.org/package/2006/relationships',
    'wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
q=lambda prefix,name:'{'+ns[prefix]+'}'+name
with ZipFile(src) as z:parts={n:z.read(n) for n in z.namelist()}
d=E.fromstring(parts['word/document.xml'])
relations=E.fromstring(parts['word/_rels/document.xml.rels'])
targets={x.get('Id'):x.get('Target') for x in relations}
edits={}
for s in d.findall('.//w:sectPr',ns)[:3]:
    margins=s.find('w:pgMar',ns)
    margins.set(q('w','footer'),'1512') # 1.05 inches; raise entire college footer 28.8 pt.
    ref=s.find('w:footerReference',ns)
    name='word/'+targets[ref.get(q('r','id'))]
    f=E.fromstring(parts[name])
    for p in f.findall('w:p',ns):
        pr=p.find('w:pPr',ns)
        if pr is None:pr=E.SubElement(p,q('w','pPr'))
        indent=pr.find('w:ind',ns)
        if indent is None:indent=E.SubElement(pr,q('w','ind'))
        indent.set(q('w','left'),'120');indent.set(q('w','right'),'120')
    # Inset both ends of the banner, preserving aspect ratio and original artwork.
    for drawing in f.findall('.//w:drawing',ns):
        size=drawing.find('.//wp:extent',ns)
        oldw=int(size.get('cx'));oldh=int(size.get('cy'))
        width=int(5.78*914400);height=round(oldh*width/oldw)
        size.set('cx',str(width));size.set('cy',str(height))
        for extent in drawing.findall('.//a:xfrm/a:ext',ns):
            extent.set('cx',str(width));extent.set('cy',str(height))
    edits[name]=E.tostring(f,xml_declaration=True,encoding='UTF-8',standalone=True)
edits['word/document.xml']=E.tostring(d,xml_declaration=True,encoding='UTF-8',standalone=True)
with ZipFile(src) as z,ZipFile(dst,'w') as out:
    for info in z.infolist():out.writestr(info,edits.get(info.filename,parts[info.filename]))
with ZipFile(dst) as z:
    for name,data in parts.items():
        if name not in edits:assert z.read(name)==data,name
        else:
            assert E.fromstring(data).xpath('//w:t/text()',namespaces=ns)==E.fromstring(z.read(name)).xpath('//w:t/text()',namespaces=ns),name
report={'source':str(src),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'output':str(dst),'changed_parts':list(edits),'every_text_node_unchanged':True,'all_other_parts_byte_identical':True,'source_images_unchanged':True,'footer_raise_pt':28.8,'banner_width_inches':5.78,'horizontal_inset_pt':6}
(root/'banner-edit-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
