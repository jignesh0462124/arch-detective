from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
from docx import Document
from docx.oxml.ns import qn
import json, re

R=Path(__file__).resolve().parent
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','v':'urn:schemas-microsoft-com:vml','a':'http://schemas.openxmlformats.org/drawingml/2006/main','wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
for key in ['template','editable']:
    x=json.loads((R/f'{key}-inventory.json').read_text())
    d=Document(x['path'])
    print('\n',key.upper())
    print('Assets',[n for n in x['parts'] if n.startswith('word/media/')])
    print('Sections')
    for s in d.sections:
        print('margins in',*[round(getattr(s,k)/914400,4) for k in ['top_margin','bottom_margin','left_margin','right_margin','header_distance','footer_distance']])
    with ZipFile(x['path']) as z:
        for n in z.namelist():
            if re.fullmatch(r'word/(header|footer)\d+\.xml',n):
                root=E.fromstring(z.read(n))
                print(n, 'TEXT:', ''.join(root.xpath('//w:t/text()',namespaces=ns))[:150])
                for shape in root.xpath('//v:shape',namespaces=ns):
                    print('VML',shape.get('id'),shape.get('style'))
                for a in root.xpath('//wp:anchor|//wp:inline',namespaces=ns):
                    print('Drawing', a.tag.split('}')[-1],[(c.tag.split('}')[-1],dict(c.attrib),''.join(c.itertext())[:30]) for c in a if c.tag.split('}')[-1] in ('extent','positionH','positionV','docPr')])
    if key=='editable':
        for i,p in enumerate(d.paragraphs):
            if i<16 or i in range(55,66) or 'Figure ' in p.text or 'Table ' in p.text or p.style.name=='Heading 1':
                print(i, p.style.name,repr(p.text), 'keep',p.paragraph_format.keep_with_next,'before',p.paragraph_format.space_before,'after',p.paragraph_format.space_after,'line',p.paragraph_format.line_spacing)
        print('Body Normal',d.styles['Normal'].element.xml)
        print('Equations',len(d.element.xpath('//m:oMath')))
