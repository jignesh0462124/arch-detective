from pathlib import Path
from zipfile import ZipFile
from copy import deepcopy
from lxml import etree as E
import json,hashlib,re,posixpath

root=Path(__file__).resolve().parent
source=root.parents[2]/'output/docx/ThreatLens_Thesis_Reference_Formatted.docx'
target=source.with_name('ThreatLens_Thesis_Logo_Inside_Border.docx')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'a':'http://schemas.openxmlformats.org/drawingml/2006/main',
    'wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'rel':'http://schemas.openxmlformats.org/package/2006/relationships'}
q=lambda p,n:'{'+ns[p]+'}'+n
with ZipFile(source) as z:parts={n:z.read(n) for n in z.namelist()}
bodyxml=E.fromstring(parts['word/document.xml']);body=bodyxml.find('w:body',ns)
rels=E.fromstring(parts['word/_rels/document.xml.rels'])
relmap={r.get('Id'):r for r in rels}
nextid=max(int(r.get('Id')[3:]) for r in rels if re.fullmatch(r'rId\d+',r.get('Id')))+1
nextdraw=max(int(d.get('id')) for d in bodyxml.findall('.//wp:docPr',ns))+1
edits={}; changed=[]
titles=['ThreatLens: An AI-Assisted Framework for Automated Source Code Security Assessment, Vulnerability Prioritization and Compliance Analysis','DECLARATION','CERTIFICATE']
headers=bodyxml.findall('.//w:sectPr/w:headerReference',ns)[:3]
for i,(href,title) in enumerate(zip(headers,titles)):
    hname=posixpath.normpath('word/'+relmap[href.get(q('r','id'))].get('Target'))
    header=E.fromstring(parts[hname])
    drawing=header.find('.//w:drawing',ns)
    assert drawing is not None,hname
    picture=deepcopy(drawing)
    hrelname=posixpath.dirname(hname)+'/_rels/'+posixpath.basename(hname)+'.rels'
    hrels=E.fromstring(parts[hrelname])
    imageid=picture.find('.//a:blip',ns).get(q('r','embed'))
    hr=next(r for r in hrels if r.get('Id')==imageid)
    imagepath=posixpath.normpath(posixpath.dirname(hname)+'/'+hr.get('Target'))
    reltarget=posixpath.relpath(imagepath,'word')
    existing=next((r for r in rels if r.get('Target')==reltarget and r.get('Type')==hr.get('Type')),None)
    if existing is None:
        existing=E.SubElement(rels,q('rel','Relationship'),Id=f'rId{nextid}',Type=hr.get('Type'),Target=reltarget);nextid+=1
    picture.find('.//a:blip',ns).set(q('r','embed'),existing.get('Id'))
    for d in picture.findall('.//wp:docPr',ns):d.set('id',str(nextdraw));nextdraw+=1
    drawing.getparent().remove(drawing)
    edits[hname]=E.tostring(header,xml_declaration=True,encoding='UTF-8',standalone=True)
    first=next(p for p in body.findall('w:p',ns) if ''.join(p.itertext()).strip()==title)
    p=E.Element(q('w','p'));pr=E.SubElement(p,q('w','pPr'))
    E.SubElement(pr,q('w','keepNext'))
    E.SubElement(pr,q('w','spacing'),{q('w','before'):'0',q('w','after'):'200',q('w','line'):'240',q('w','lineRule'):'auto'})
    E.SubElement(pr,q('w','ind'),{q('w','left'):'120'})
    E.SubElement(pr,q('w','jc'),{q('w','val'):'left'})
    E.SubElement(p,q('w','r')).append(picture)
    first.addprevious(p)
    if i==0:
        spacing=first.find('w:pPr/w:spacing',ns)
        if spacing is not None:spacing.set(q('w','before'),'240')
    changed.append({'page':i+1,'former_header':hname,'placement':'inline body at left content margin plus 6 pt'})
edits['word/document.xml']=E.tostring(bodyxml,xml_declaration=True,encoding='UTF-8',standalone=True)
edits['word/_rels/document.xml.rels']=E.tostring(rels,xml_declaration=True,encoding='UTF-8',standalone=True)
with ZipFile(source) as z,ZipFile(target,'w') as out:
    for info in z.infolist():out.writestr(info,edits.get(info.filename,parts[info.filename]))
with ZipFile(target) as z:
    after=E.fromstring(z.read('word/document.xml'))
    before=E.fromstring(parts['word/document.xml'])
    text=lambda el:[t.text for t in el.findall('.//w:t',ns)]
    assert text(before)==text(after),'Text changed'
    assert len(after.findall('.//w:drawing',ns))==len(before.findall('.//w:drawing',ns))+3
    assert all(z.read(n)==data for n,data in parts.items() if n not in edits),'Unexpected package change'
(root/'logo-edit-verification.json').write_text(json.dumps({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'output':str(target),'changed_parts':list(edits),'text_nodes_exact':True,'moves':changed},indent=2),encoding='utf8')
print(target)
print('Moved 3 logos; every text node unchanged; only 5 intended XML parts changed.')
