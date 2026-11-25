"""Apply the retained college template without rewriting thesis prose."""
from copy import deepcopy
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json
import re

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.parts.hdrftr import FooterPart
from docx.shared import Inches, Pt, RGBColor
from docx.text.paragraph import Paragraph
from docx.table import Table

ROOT = Path(__file__).resolve().parent
WORK = ROOT.parents[1]
REFERENCE = Path(r'C:\Users\jigne\Downloads\Project Thesis Guidelines Winter 2026 Format.docx')
SOURCE = WORK/'output/docx/G_14_ThreatLens_Thesis_.docx'
OUT = WORK/'output/docx/G_14_ThreatLens_Thesis_College_Format.docx'
baseline = json.loads((ROOT/'template-inventory.json').read_text(encoding='utf-8'))
assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest() == baseline['sha256']
doc = Document(REFERENCE)
source = Document(SOURCE)
template_sections = [deepcopy(s._sectPr) for s in doc.sections]
source_paras = list(source.paragraphs)
source_tables = list(source.tables)
source_index = {id(p._p): n for n,p in enumerate(source_paras)}
source_table_index = {id(t._tbl): n for n,t in enumerate(source_tables)}
body = doc.element.body
for child in list(body):
    if child.tag != qn('w:sectPr'):
        body.remove(child)

def el(tag, **attrs):
    node=OxmlElement('w:'+tag)
    for key,value in attrs.items():
        node.set(qn('w:'+key),str(value))
    return node

def font(run,size=12,bold=None,italic=None):
    run.font.name='Calibri'
    run.font.size=Pt(size)
    run.font.color.rgb=RGBColor(0,0,0)
    if bold is not None: run.bold=bold
    if italic is not None: run.italic=italic
    rpr=run._r.get_or_add_rPr()
    rfonts=rpr.find(qn('w:rFonts'))
    if rfonts is None:
        rfonts=el('rFonts'); rpr.insert(0,rfonts)
    for key in ('ascii','hAnsi','eastAsia','cs'):
        rfonts.set(qn('w:'+key),'Calibri')
    for key in ('asciiTheme','hAnsiTheme','eastAsiaTheme','cstheme'):
        rfonts.attrib.pop(qn('w:'+key),None)

# Freeze header/footer paragraph rhythm before changing the shared Normal style.
# Otherwise its new body spacing expands the college's fixed footer text boxes.
seen_parts=set()
for rel in list(doc.part.rels.values()):
    if rel.reltype in (RT.HEADER,RT.FOOTER):
        part=rel.target_part
        if str(part.partname) in seen_parts:continue
        seen_parts.add(str(part.partname))
        for node in part.element.iter(qn('w:p')):
            p=Paragraph(node,doc._body)
            for prop,default in [('space_before',Pt(0)),('space_after',Pt(0)),('line_spacing',1.0)]:
                if getattr(p.paragraph_format,prop) is not None:continue
                style=p.style;value=None
                while style is not None and value is None:
                    value=getattr(style.paragraph_format,prop);style=style.base_style
                setattr(p.paragraph_format,prop,default if value is None else value)
            # Keep the final contact line inside the narrow fixed footer text box.
            if p.text.startswith('T:'):
                for run in p.runs:run.font.size=Pt(8)

roles=[('Normal',12,False),('Title',18,True),('Heading 1',16,True),('Heading 2',14,True),('Heading 3',12,True),('Caption1',12,True),('Caption',12,True),('Thesis contents',12,False),('Thesis bullet',12,False)]
for name,size,bold in roles:
    if name not in doc.styles:
        doc.styles.add_style(name,WD_STYLE_TYPE.PARAGRAPH,builtin=name in ('Title','Heading 1','Heading 2','Heading 3','Caption'))
    st=doc.styles[name]
    if name!='Normal':st.base_style=doc.styles['Normal']
    st.quick_style=True
    st.font.name='Calibri';st.font.size=Pt(size);st.font.bold=bold;st.font.color.rgb=RGBColor(0,0,0)
    pr=st.paragraph_format
    pr.line_spacing=1.5;pr.space_before=Pt(0);pr.space_after=Pt(7)
    pr.widow_control=True;pr.keep_together=False
    if name.startswith('Heading '):
        pr._element.append(el('outlineLvl',val=int(name[-1])-1))
    if name.startswith('Heading') or name.startswith('Caption'):
        pr.keep_with_next=True

# Preserve source automatic list labels without colliding with template numIds.
target_num=doc.part.numbering_part.element
source_num=source.part.numbering_part.element
abstract_next=max([int(n.get(qn('w:abstractNumId'))) for n in target_num.findall(qn('w:abstractNum'))]+[-1])+1
num_next=max([int(n.get(qn('w:numId'))) for n in target_num.findall(qn('w:num'))]+[0])+1
abstract_map={}
for item in source_num.findall(qn('w:abstractNum')):
    clone=deepcopy(item); old=clone.get(qn('w:abstractNumId'));abstract_map[old]=str(abstract_next);abstract_next+=1
    clone.set(qn('w:abstractNumId'),abstract_map[old]); target_num.append(clone)
num_map={}
for item in source_num.findall(qn('w:num')):
    clone=deepcopy(item);old=clone.get(qn('w:numId'));num_map[old]=str(num_next);num_next+=1
    clone.set(qn('w:numId'),num_map[old]);ref=clone.find(qn('w:abstractNumId'));ref.set(qn('w:val'),abstract_map[ref.get(qn('w:val'))]);target_num.append(clone)
bullet_abstract=el('abstractNum',abstractNumId=abstract_next)
level=el('lvl',ilvl=0);level.append(el('start',val=1));level.append(el('numFmt',val='bullet'));level.append(el('lvlText',val='•'));level.append(el('lvlJc',val='left'))
bullet_abstract.append(level);target_num.append(bullet_abstract)
bullet_num_id=num_next;bullet_num=el('num',numId=bullet_num_id);bullet_num.append(el('abstractNumId',val=abstract_next));target_num.append(bullet_num)

relationships={}
def imported(element):
    clone=deepcopy(element)
    for node in clone.iter():
        for attr,value in list(node.attrib.items()):
            if not attr.startswith('{'+RT.IMAGE.rsplit('/',1)[0]+'}') and not attr.startswith('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'):
                continue
            if value not in source.part.rels:
                continue
            if value not in relationships:
                rel=source.part.rels[value]
                if rel.reltype==RT.IMAGE:
                    rid,_=doc.part.get_or_add_image(BytesIO(rel.target_part.blob))
                    relationships[value]=rid
                elif rel.is_external:
                    relationships[value]=doc.part.relate_to(rel.target_ref,rel.reltype,is_external=True)
                else:
                    raise ValueError('Unexpected body relationship: '+rel.reltype)
            node.set(attr,relationships[value])
    for node in list(clone.iter(qn('w:sectPr'))):
        node.getparent().remove(node)
    for node in clone.iter(qn('w:numId')):
        old=node.get(qn('w:val'))
        if old in num_map:node.set(qn('w:val'),num_map[old])
    for node in list(clone.iter(qn('w:bookmarkStart')))+list(clone.iter(qn('w:bookmarkEnd'))):
        node.getparent().remove(node)
    return clone

footerpart=FooterPart.new(doc.part.package)
page_p=footerpart.element.find(qn('w:p'))
pr=page_p.get_or_add_pPr();pr.append(el('jc',val='center'));pr.append(el('spacing',before=0,after=0,line=240,lineRule='auto'))
field=el('fldSimple',instr=' PAGE ');run=el('r');rp=el('rPr');rp.append(el('rFonts',ascii='Calibri',hAnsi='Calibri'));rp.append(el('sz',val=24));run.append(rp);t=el('t');t.text='1';run.append(t);field.append(run);page_p.append(field)
page_footer_rid=doc.part.relate_to(footerpart,RT.FOOTER)
empty_footer_ref=next(deepcopy(n) for n in template_sections[2] if n.tag==qn('w:footerReference'))

# The inner title page's copyright fits below the original banner, inside its
# existing footer text box, rather than overflowing onto a third cover page.
cover_footer_ref=next(n for n in template_sections[0] if n.tag==qn('w:footerReference') and n.get(qn('w:type'))=='default')
cover_footer=doc.part.rels[cover_footer_ref.get(qn('r:id'))].target_part
inner_footer=FooterPart.new(doc.part.package)
inner_footer._element=deepcopy(cover_footer.element)
footer_rels={rid:inner_footer.relate_to(rel.target_ref if rel.is_external else rel.target_part,rel.reltype,is_external=rel.is_external) for rid,rel in cover_footer.rels.items()}
for node in inner_footer.element.iter():
    for attr,value in list(node.attrib.items()):
        if attr.startswith('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}') and value in footer_rels:node.set(attr,footer_rels[value])
for box in inner_footer.element.iter(qn('w:txbxContent')):
    p=el('p');pr=el('pPr');pr.append(el('spacing',before=40,after=0,line=200,lineRule='auto'));p.append(pr)
    r=el('r');rp=el('rPr');rp.append(el('rFonts',ascii='Calibri',hAnsi='Calibri'));rp.append(el('sz',val=16));r.append(rp);t=el('t');t.text=source_paras[13].text;r.append(t);p.append(r);box.append(p)
inner_footer_rid=doc.part.relate_to(inner_footer,RT.FOOTER)

def configure_section(section,kind='plain',number=None,first=False):
    sp=section._sectPr
    source_section=template_sections[0 if kind=='cover' else 1 if kind=='branded' else 2]
    for node in list(sp):sp.remove(node)
    for node in source_section:
        if node.tag in (qn('w:headerReference'),qn('w:footerReference')) and node.get(qn('w:type'))!='default':
            continue
        if node.tag not in (qn('w:titlePg'),qn('w:pgNumType'),qn('w:type')):
            sp.append(deepcopy(node))
    sp.insert(0,el('type',val='nextPage'))
    if kind=='numbered':
        for node in list(sp.findall(qn('w:footerReference'))):sp.remove(node)
        sp.insert(0,el('footerReference',type='default'))
        sp[0].set(qn('r:id'),page_footer_rid)
        if first:
            ref=deepcopy(empty_footer_ref);ref.set(qn('w:type'),'first');sp.insert(0,ref);sp.append(el('titlePg'))
    if number:
        fmt,start=number
        attrs={'fmt':fmt}
        if start is not None:attrs['start']=start
        sp.append(el('pgNumType',**attrs))

configure_section(doc.sections[0],'cover')
def section(kind='plain',number=None,first=False):
    # The section-boundary paragraph should not consume a visible blank line.
    s=doc.add_section(WD_SECTION.NEW_PAGE)
    boundary=doc.paragraphs[-1]
    boundary.paragraph_format.space_after=Pt(0);boundary.paragraph_format.space_before=Pt(0);boundary.paragraph_format.line_spacing=Pt(1)
    for r in boundary.runs:font(r,1)
    configure_section(s,kind,number,first)
    return s

def add_text(text='',style='Normal',size=12,bold=None,italic=None,align=WD_ALIGN_PARAGRAPH.CENTER,before=0,after=0,line=1.5):
    p=doc.add_paragraph(style=style)
    p.alignment=align;p.paragraph_format.space_before=Pt(before);p.paragraph_format.space_after=Pt(after);p.paragraph_format.line_spacing=line
    p.paragraph_format.keep_with_next=False
    font(p.add_run(text),size,bold,italic)
    return p

def cover(inner=False):
    add_text(source_paras[1].text,'Title',18,True,before=82,after=18,line=1.15)
    add_text(source_paras[2].text,size=12,bold=True,italic=True,after=17)
    add_text(source_paras[3].text,size=16,bold=True,after=0,line=1.1)
    add_text(source_paras[4].text,size=16,bold=True,after=0,line=1.1)
    add_text(source_paras[5].text,size=16,bold=True,after=12,line=1.1)
    add_text(source_paras[6].text,size=12,after=6,line=1.1)
    add_text(source_paras[7].text,size=16,bold=True,after=3,line=1.1)
    add_text(source_paras[8].text,size=16,bold=True,after=15,line=1.1)
    add_text(source_paras[9].text,size=12,bold=True,italic=True,after=4,line=1.1)
    add_text(source_paras[10].text,size=16,bold=True,after=4,line=1.1)
    add_text(source_paras[11].text,size=12,bold=True,after=24,line=1.1)
    add_text(source_paras[12].text,size=16,bold=True,line=1.1)
    if inner:
        ref=doc.sections[-1]._sectPr.find(qn('w:footerReference'))
        ref.set(qn('r:id'),inner_footer_rid)

cover()
section('cover');cover(True)

bookmark_counter=1
bookmarks={}
def bookmark(p,name):
    global bookmark_counter
    start=el('bookmarkStart',id=bookmark_counter,name=name);end=el('bookmarkEnd',id=bookmark_counter);bookmark_counter+=1
    p._p.insert(1 if p._p.pPr is not None else 0,start);p._p.append(end)
    bookmarks[name]=p.text

def normalize(text):return re.sub(r'\s+',' ',text.replace('\xa0',' ')).strip()
heading_bookmarks={}
for n,p in enumerate(source_paras):
    if p.style.name.startswith('Heading'):
        heading_bookmarks[normalize(p.text)]=f'thesis_heading_{n}'

def pageref(p,target):
    field=el('fldSimple',instr=f' PAGEREF {target} \\h ')
    r=el('r');rp=el('rPr');rp.append(el('sz',val=24));r.append(rp);t=el('t');t.text='1';r.append(t);field.append(r);p._p.append(field)

contents=[]
unmatched_contents=[]
for p in source_paras[60:154]:
    if '\t' in p.text:
        label=p.text.rsplit('\t',1)[0]
        match=heading_bookmarks.get(normalize(label)) or next((target for heading,target in heading_bookmarks.items() if re.sub(r'\W+','',heading).casefold()==re.sub(r'\W+','',label).casefold()),None)
        if match:contents.append((label,match))
        else:unmatched_contents.append(label)

actual_figures=[]
for n,p in enumerate(source_paras):
    if p.style.name.startswith('Caption'):
        m=re.match(r'Figure\s+(\d+\.\d+):\s*(.*)',normalize(p.text))
        if m:actual_figures.append((n,m[1],m[2],f'thesis_figure_{n}'))

def index_table(rows,widths):
    t=doc.add_table(rows=1,cols=len(widths));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    for c,w in zip(t.columns,widths):c.width=Inches(w)
    for col,text in zip(t.rows[0].cells,rows[0]):col.text=text
    for row in rows[1:]:
        cells=t.add_row().cells
        for cell,text in zip(cells,row):
            if isinstance(text,tuple):pageref(cell.paragraphs[0],text[0])
            else:cell.text=text
    style_table(t,widths)
    return t

def style_table(t,widths=None):
    t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    if widths is None:
        old=[col.width or 1 for col in t.columns];scale=Inches(5.969)/sum(old);widths=[w*scale/914400 for w in old]
    for col,w in zip(t.columns,widths):col.width=Inches(w)
    props=t._tbl.tblPr
    for tag in ('tblW','tblBorders','tblCellMar','tblInd'):
        for node in list(props.findall(qn('w:'+tag))):props.remove(node)
    props.append(el('tblW',w=8595,type='dxa'))
    border=el('tblBorders')
    for edge in ('top','left','bottom','right','insideH','insideV'):border.append(el(edge,val='single',sz=4,color='000000'))
    props.append(border)
    mar=el('tblCellMar')
    for side,w in [('top',80),('bottom',80),('left',90),('right',90)]:mar.append(el(side,w=w,type='dxa'))
    props.append(mar)
    for row_index,row in enumerate(t.rows):
        trpr=row._tr.get_or_add_trPr()
        for node in list(trpr.findall(qn('w:trHeight'))):trpr.remove(node)
        trpr.append(el('cantSplit'))
        if row_index==0:trpr.append(el('tblHeader'))
        for col_index,(cell,w) in enumerate(zip(row.cells,widths)):
            cell.width=Inches(w);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            cellpr=cell._tc.get_or_add_tcPr()
            for node in list(cellpr.findall(qn('w:tcBorders')))+list(cellpr.findall(qn('w:shd'))):cellpr.remove(node)
            cellpr.append(el('shd',val='clear',color='auto',fill='FFFFFF'))
            cell_borders=el('tcBorders')
            for edge in ('top','left','bottom','right'):
                cell_borders.append(el(edge,val='single',sz=4,space=0,color='000000'))
            cellpr.append(cell_borders)
            for p in cell.paragraphs:
                p.paragraph_format.space_before=Pt(0);p.paragraph_format.space_after=Pt(0);p.paragraph_format.line_spacing=1.0;p.paragraph_format.keep_with_next=False
                p.alignment=WD_ALIGN_PARAGRAPH.CENTER if len(widths)==3 and col_index in (0,2) else WD_ALIGN_PARAGRAPH.LEFT
                for run in p.runs:font(run,12,True if row_index==0 else None)

preserved=[]
current_chapter=0
skip_navigation=False
for original in source.element.body:
    if original.tag==qn('w:sectPr'):continue
    if original.tag==qn('w:tbl'):
        index=source_table_index[id(original)]
        if index==3:
            index_table([['Figure No.','Figure Name','Page No.']]+[[f'Fig. {num}',title,(target,)] for _,num,title,target in actual_figures],[.85,4.4,.719])
        elif index==4:
            index_table([['Table No.','Table Name','Page No.'],['Table 6.1','Functional Test Matrix',('thesis_table_6_1',)]],[.85,4.4,.719])
        else:
            if index==7:
                caption=add_text('Table 6.1: Functional Test Matrix',size=12,bold=True,before=6,after=6)
                bookmark(caption,'thesis_table_6_1');caption.paragraph_format.keep_with_next=True
            clone=imported(original);body.insert(len(body)-1,clone);t=Table(clone,doc._body)
            style_table(t,[1.7,1.1,2.25,.919] if index==0 else None)
            preserved.append(('table',index,normalize(' '.join(n.text or '' for n in original.iter(qn('w:t'))))))
        continue
    if original.tag!=qn('w:p'):continue
    n=source_index[id(original)];p0=source_paras[n];text=normalize(p0.text)
    if n<16 or n==24:continue  # College logos are supplied by the reference headers.
    if 60<=n<154:continue
    if not text and not list(original.iter(qn('w:drawing'))):continue
    is_heading=p0.style.name.startswith('Heading')
    if text in ('DECLARATION','CERTIFICATE'):section('branded')
    elif text=='ACKNOWLEDGEMENT':section('plain')
    elif text=='ABSTRACT':section('numbered',('lowerRoman',1))
    elif text=='TABLE OF CONTENTS':section('numbered',('decimal',1))
    elif text.startswith('CHAPTER '):
        current_chapter=int(re.match(r'CHAPTER\s+(\d+)',text)[1]);section('numbered',('decimal',None),True)
    elif text in ('REFERENCES','APPENDICES'):
        current_chapter=0
    clone=imported(original);body.insert(len(body)-1,clone);p=Paragraph(clone,doc._body)
    pf=p.paragraph_format
    pf.space_before=Pt(0);pf.space_after=Pt(7);pf.line_spacing=1.5;pf.widow_control=True;pf.keep_together=False;pf.keep_with_next=False
    pf.left_indent=None;pf.right_indent=None;pf.first_line_indent=None;pf.page_break_before=False
    for br in list(clone.iter(qn('w:br'))):
        if br.get(qn('w:type'))=='page':br.getparent().remove(br)
    role=p0.style.name
    if is_heading:
        p.style='Heading 1' if role=='Heading 1' else 'Heading 2' if role=='Heading 2' else 'Heading 3'
        size=16 if role=='Heading 1' else 14 if role=='Heading 2' else 12
        for run in p.runs:font(run,size,True)
        pf.space_after=Pt(10);pf.keep_with_next=True
        p.alignment=WD_ALIGN_PARAGRAPH.CENTER if role=='Heading 1' else WD_ALIGN_PARAGRAPH.LEFT
        bookmark(p,heading_bookmarks[text])
        if text.startswith('CHAPTER '):
            pf.space_before=Pt(215);pf.keep_with_next=False
        elif role=='Heading 1':
            pf.page_break_before=text not in ('DECLARATION','CERTIFICATE','ACKNOWLEDGEMENT','ABSTRACT','TABLE OF CONTENTS')
            if text in ('DECLARATION','CERTIFICATE'):pf.space_before=Pt(48)
    else:
        for run in p.runs:font(run,12)
        p.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
        if role.startswith('Caption'):
            p.style='Caption1';p.alignment=WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:font(run,12,True)
            pf.space_before=Pt(6);pf.space_after=Pt(9)
            target=next((f[3] for f in actual_figures if f[0]==n),None)
            if target:bookmark(p,target)
        elif current_chapter in (7,8) and text and not text.startswith('The figure should'):
            p.style='Thesis bullet';pf.left_indent=Inches(.2);pf.first_line_indent=Inches(-.2)
            numpr=el('numPr');numpr.append(el('ilvl',val=0));numpr.append(el('numId',val=bullet_num_id));p._p.get_or_add_pPr().append(numpr)
        if 182<=n<=189:
            # Preserve the objective wording while making the original list's
            # inconsistent continuation paragraphs align as a single list.
            p.style='Thesis bullet';pf.left_indent=Inches(.2);pf.first_line_indent=Inches(-.2)
            ppr=p._p.get_or_add_pPr()
            for node in list(ppr.findall(qn('w:numPr')))+list(ppr.findall(qn('w:tabs'))):ppr.remove(node)
            numpr=el('numPr');numpr.append(el('ilvl',val=0));numpr.append(el('numId',val=bullet_num_id));ppr.append(numpr)
        if text.startswith('Contribution ') or text in ('The metrics are:','The project objectives are:','References Cited in This Chapter'):
            pf.keep_with_next=True
    if n in (19,27,29):
        for run in p.runs:font(run,12,True)
        p.alignment=WD_ALIGN_PARAGRAPH.LEFT
        pf.space_before=Pt(8);pf.space_after=Pt(6)
    if n>=16 and n<33:
        if not is_heading:pf.line_spacing=1.5
    if list(clone.iter(qn('w:drawing'))):
        p.alignment=WD_ALIGN_PARAGRAPH.CENTER;pf.line_spacing=1.0
        for inline in clone.iter(qn('wp:inline')):
            ext=inline.find(qn('wp:extent'));cx,cy=int(ext.get('cx')),int(ext.get('cy'))
            ratio=min(1,Inches(5.969)/cx,Inches(7.4)/cy)
            if ratio<1:
                for extent in inline.iter(qn('a:ext')):
                    if extent.get('cx')==str(cx) and extent.get('cy')==str(cy):
                        extent.set('cx',str(int(cx*ratio)));extent.set('cy',str(int(cy*ratio)))
                ext.set('cx',str(int(cx*ratio)));ext.set('cy',str(int(cy*ratio)))
    if p0.style.name=='Heading 2' and n>154 and source_paras[n-1].text.startswith('CHAPTER '):
        pf.page_break_before=True
    if text=='TABLE OF CONTENTS':
        for label,target in contents:
            item=add_text(style='Thesis contents',align=WD_ALIGN_PARAGRAPH.LEFT,after=2,line=1.5)
            item.paragraph_format.tab_stops.add_tab_stop(Inches(5.94),WD_TAB_ALIGNMENT.RIGHT,WD_TAB_LEADER.DOTS)
            is_main=label.startswith('CHAPTER ') or label in ('REFERENCES','APPENDICES') or label.isupper()
            font(item.add_run(label+'\t'),12,is_main)
            if not is_main:item.paragraph_format.left_indent=Inches(.15)
            pageref(item,target)
    preserved.append(('paragraph',n,normalize(p0.text)))

# Bind each final image paragraph to its caption, but never chain two large images.
paragraphs=list(doc.paragraphs)
for index,p in enumerate(paragraphs[:-1]):
    if list(p._p.iter(qn('w:drawing'))) and paragraphs[index+1].style.name.startswith('Caption'):
        p.paragraph_format.keep_with_next=True
    if p.style.name.startswith('Caption'):p.paragraph_format.keep_with_next=False

settings=doc.settings.element
for node in list(settings.findall(qn('w:updateFields'))):settings.remove(node)
settings.append(el('updateFields',val='true'))
doc.core_properties.title=source.core_properties.title or 'ThreatLens thesis'
doc.core_properties.subject='Project thesis formatted to the Winter 2026 college template'
doc.core_properties.author=source.core_properties.author
OUT.parent.mkdir(parents=True,exist_ok=True)
doc.save(OUT)
assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest()==baseline['sha256']
with ZipFile(OUT) as z:assert z.testzip() is None

# Semantic preservation gate excludes navigation metadata, blank layout paragraphs,
# the additional inner cover, and the one new caption for the existing table.
final=Document(OUT)
texts=[normalize(p.text) for p in final.paragraphs]
for kind,index,text in preserved:
    if kind=='paragraph' and text:assert text in texts,(index,text)
    if kind=='table':
        assert text in [normalize(' '.join(n.text or '' for n in t._tbl.iter(qn('w:t')))) for t in final.tables]
source_images={hashlib.sha256(source.part.rels[rid].target_part.blob).hexdigest() for rid in relationships if source.part.rels[rid].reltype==RT.IMAGE}
final_images={hashlib.sha256(r.target_part.blob).hexdigest() for r in final.part.rels.values() if r.reltype==RT.IMAGE}
assert source_images<=final_images
report={'output':str(OUT),'sections':len(final.sections),'preserved_paragraphs':sum(k=='paragraph' for k,_,_ in preserved),'preserved_tables':sum(k=='table' for k,_,_ in preserved),'source_body_image_hashes':sorted(source_images),'figure_entries':len(actual_figures),'contents_entries':len(contents),'removed_stale_contents_entries':unmatched_contents,'reference_sha256':baseline['sha256'],'template_original_unchanged':True,'body_prose_preserved':True,'navigation_updated':True,'pending_source_content':['Existing official-name/signature placeholders retained.','Literature-review minimum length is an author-content requirement; no filler added.']}
(ROOT/'build-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
