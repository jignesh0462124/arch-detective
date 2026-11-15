from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
from copy import deepcopy
import hashlib,json,os

root=Path(__file__).resolve().parent
target=root.parents[2]/'output/docx/G_14_ThreatLens_Thesis_.docx'
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
q=lambda name:'{'+ns['w']+'}'+name
with ZipFile(target) as z:parts={n:z.read(n) for n in z.namelist()};infos=z.infolist()
before=parts['word/document.xml'];doc=E.fromstring(before)
sections=doc.findall('.//w:sectPr',ns)
assert len(sections)==6
for sec in sections:
    border=sec.find('w:pgBorders',ns)
    assert border is not None
    border.set(q('offsetFrom'),'page')
    for edge in ['top','bottom','left','right']:
        rule=border.find('w:'+edge,ns)
        assert rule is not None
        rule.set(q('space'),'24')
after=E.tostring(doc,encoding='UTF-8',xml_declaration=True,standalone=True)
def without_borders(data):
    tree=E.fromstring(data)
    for b in tree.findall('.//w:pgBorders',ns):b.getparent().remove(b)
    return E.tostring(tree,method='c14n')
assert without_borders(before)==without_borders(after),'Unexpected body/section changes'
pending=target.with_suffix('.pending')
with ZipFile(pending,'w') as z:
    for info in infos:z.writestr(info,after if info.filename=='word/document.xml' else parts[info.filename])
with ZipFile(pending) as z:
    assert z.testzip() is None
    assert all(z.read(n)==data for n,data in parts.items() if n!='word/document.xml')
(root/'centre-border-before.xml').write_bytes(before)
report={'output':str(target),'before_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'sections_updated':6,'border_offset_from':'page','all_four_edge_offsets_pt':24,'text_tables_images_margins_unchanged':True,'only_changed_package_part':'word/document.xml'}
os.replace(pending,target)
report['after_sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
(root/'centred-border-edit-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
