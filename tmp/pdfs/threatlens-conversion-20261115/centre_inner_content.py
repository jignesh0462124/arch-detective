from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import os,json,hashlib

root=Path(__file__).resolve().parent
target=root.parents[2]/'output/docx/G_14_ThreatLens_Thesis_.docx'
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
q=lambda name:'{'+ns['w']+'}'+name
with ZipFile(target) as z:parts={n:z.read(n) for n in z.namelist()};infos=z.infolist()
before=parts['word/document.xml'];d=E.fromstring(before);rels=E.fromstring(parts['word/_rels/document.xml.rels'])
targets={r.get('Id'):r.get('Target') for r in rels}
edits={};footers=[]
for i,s in enumerate(d.findall('.//w:sectPr',ns)):
    m=s.find('w:pgMar',ns)
    total=int(m.get(q('left')))+int(m.get(q('right')))
    assert total==3312 and total%2==0
    m.set(q('left'),str(total//2));m.set(q('right'),str(total//2))
    if i<3:
        ref=s.find('w:footerReference',ns)
        name='word/'+targets[ref.get('{'+ns['r']+'}id')]
        f=E.fromstring(parts[name])
        for p in f.findall('w:p',ns):
            if p.find('.//w:drawing',ns) is None:continue
            pr=p.find('w:pPr',ns)
            if pr is None:pr=E.SubElement(p,q('pPr'))
            align=pr.find('w:jc',ns)
            if align is None:align=E.SubElement(pr,q('jc'))
            align.set(q('val'),'center')
        edits[name]=E.tostring(f,encoding='UTF-8',xml_declaration=True,standalone=True)
        footers.append(name)
after=E.tostring(d,encoding='UTF-8',xml_declaration=True,standalone=True)
def canonical_without_margins(data):
    tree=E.fromstring(data)
    for m in tree.findall('.//w:pgMar',ns):
        m.attrib.pop(q('left'));m.attrib.pop(q('right'))
    return E.tostring(tree,method='c14n')
assert canonical_without_margins(before)==canonical_without_margins(after)
edits['word/document.xml']=after
pending=target.with_suffix('.pending')
with ZipFile(pending,'w') as z:
    for info in infos:z.writestr(info,edits.get(info.filename,parts[info.filename]))
with ZipFile(pending) as z:
    assert z.testzip() is None
    for name,data in parts.items():
        if name not in edits:assert z.read(name)==data,name
        else:assert E.fromstring(data).xpath('//w:t/text()',namespaces=ns)==E.fromstring(z.read(name)).xpath('//w:t/text()',namespaces=ns)
(root/'centre-content-before.xml').write_bytes(before)
report={'output':str(target),'before_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'equal_margins_inches':1.15,'text_column_width_unchanged':True,'every_text_node_unchanged':True,'border_unchanged':True,'all_images_tables_styles_preserved':True,'changed_parts':list(edits),'banner_paragraphs_centered':footers}
os.replace(pending,target)
report['after_sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
(root/'centred-content-edit-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
