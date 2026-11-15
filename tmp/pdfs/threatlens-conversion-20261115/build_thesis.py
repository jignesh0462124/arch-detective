"""Format the supplied thesis without rewriting its content."""
from pathlib import Path
from copy import deepcopy
import re, json, hashlib
import pdfplumber
from pypdf import PdfReader
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT=Path(__file__).resolve().parent
WORK=ROOT.parents[2]
SOURCE=Path(r'C:\Users\jigne\Downloads\ThreatLens_Thesis_Formatted (1).pdf')
EDITABLE=Path(r'C:\Users\jigne\Downloads\G-14 ThreatLens - An LLM-Agentic Compliance Mapping And Threat Modeling.docx')
OUT=WORK/'output/docx/ThreatLens_Thesis_Reference_Formatted.docx'
OUT.parent.mkdir(parents=True,exist_ok=True)
pdf=pdfplumber.open(SOURCE)
reader=PdfReader(SOURCE)
doc=Document(EDITABLE)
body=doc.element.body
original=[deepcopy(el) for el in body if el.tag!=qn('w:sectPr')]
original_text=''.join(n.text or '' for el in original for n in el.iter(qn('w:t')))
for el in list(body):
    if el.tag!=qn('w:sectPr'): body.remove(el)

def element(tag,**attrs):
    e=OxmlElement(tag)
    for k,v in attrs.items(): e.set(qn('w:'+k),str(v))
    return e

def setfont(run,size=None,bold=None):
    run.font.name='Calibri'
    run.font.color.rgb=RGBColor(0,0,0)
    if size is not None: run.font.size=Pt(size)
    if bold is not None: run.bold=bold
    rp=run._element.get_or_add_rPr()
    rf=rp.find(qn('w:rFonts'))
    if rf is None: rf=element('w:rFonts'); rp.insert(0,rf)
    for a in ['ascii','hAnsi','cs','eastAsia']: rf.set(qn('w:'+a),'Calibri')
    for a in ['asciiTheme','hAnsiTheme','cstheme','eastAsiaTheme']: rf.attrib.pop(qn('w:'+a),None)

for name,size,bold in [('Normal',12,False),('Title',18,True),('Heading 1',16,True),('Heading 2',14,True),('Heading 3',12,True),('Caption',11,False)]:
    if name not in doc.styles:doc.styles.add_style(name,WD_STYLE_TYPE.PARAGRAPH)
    st=doc.styles[name]; st.font.name='Calibri'; st.font.size=Pt(size); st.font.bold=bold; st.font.color.rgb=RGBColor(0,0,0)
    pf=st.paragraph_format; pf.space_before=Pt(0); pf.space_after=Pt(7); pf.line_spacing=1.5
    if name.startswith('Heading'): pf.keep_with_next=True

def page_settings(sec,number=None):
    sec.page_width=Inches(8.2677); sec.page_height=Inches(11.6929)
    sec.top_margin=Inches(1); sec.bottom_margin=Inches(1.03)
    sec.left_margin=Inches(1.5); sec.right_margin=Inches(.8)
    sec.header_distance=Inches(.3); sec.footer_distance=Inches(.65)
    sp=sec._sectPr
    for n in sp.findall(qn('w:pgBorders')): sp.remove(n)
    borders=element('w:pgBorders',offsetFrom='text')
    for edge in ['top','left','bottom','right']:
        borders.append(element('w:'+edge,val='double',sz=6,space=9,color='000000'))
    sp.append(borders)
    if number:
        for n in sp.findall(qn('w:pgNumType')): sp.remove(n)
        sp.append(element('w:pgNumType',fmt=number[0],start=number[1]))

def newsec(number=None):
    s=doc.add_section(WD_SECTION.NEW_PAGE)
    s.header.is_linked_to_previous=False; s.footer.is_linked_to_previous=False
    page_settings(s,number)
    return s

def page_number(sec):
    p=sec.footer.paragraphs[0]; p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after=Pt(0)
    r=p.add_run(); setfont(r,11)
    r._r.append(element('w:fldChar',fldCharType='begin'))
    ins=element('w:instrText'); ins.text=' PAGE '; r._r.append(ins)
    r._r.append(element('w:fldChar',fldCharType='end'))

def para(text='',style=None,size=None,bold=None,align=None,after=7,before=0,line=1.5):
    p=doc.add_paragraph(style=style)
    p.paragraph_format.space_after=Pt(after); p.paragraph_format.space_before=Pt(before); p.paragraph_format.line_spacing=line
    if align is not None:p.alignment=align
    r=p.add_run(text); setfont(r,size,bold)
    return p

def heading(text):
    p=para(text,'Heading 1',16,True,WD_ALIGN_PARAGRAPH.CENTER,18,line=1.2)
    p.paragraph_format.keep_with_next=True
    return p

def join_lines(lines):
    text=''
    for line in lines:
        if text.endswith('-'): text+=line
        else: text+=(' ' if text else '')+line
    return text

def lines_on(page,top=0,bottom=780):
    return [l for l in pdf.pages[page].extract_text_lines() if top<=l['top']<bottom]

def groups(page,top=0,bottom=780,gap=21):
    result=[]; group=[]; prev=None
    for line in lines_on(page,top,bottom):
        if prev is not None and line['top']-prev>gap:
            result.append(join_lines(group)); group=[]
        group.append(line['text']); prev=line['top']
    if group:result.append(join_lines(group))
    return result

def table(rows,widths,size=11):
    t=doc.add_table(rows=1,cols=len(rows[0])); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False
    for c,w in zip(t.columns,widths): c.width=Inches(w)
    for i,row in enumerate(rows):
        cells=t.rows[0].cells if i==0 else t.add_row().cells
        t.rows[i]._tr.get_or_add_trPr().append(element('w:cantSplit'))
        if i==0:t.rows[i]._tr.get_or_add_trPr().append(element('w:tblHeader'))
        for j,(cell,value) in enumerate(zip(cells,row)):
            cell.width=Inches(widths[j]); cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcPr=cell._tc.get_or_add_tcPr(); margins=element('w:tcMar')
            for edge in ['top','left','bottom','right']: margins.append(element('w:'+edge,w=85,type='dxa'))
            tcPr.append(margins)
            p=cell.paragraphs[0]; p.paragraph_format.line_spacing=1.1; p.paragraph_format.space_after=Pt(4); p.paragraph_format.space_before=Pt(4)
            if j==0 and len(row)>2:p.alignment=WD_ALIGN_PARAGRAPH.CENTER
            r=p.add_run(value); setfont(r,size,i==0)
            if i==0:tcPr.append(element('w:shd',fill='F2F2F2'))
    borders=element('w:tblBorders')
    for edge in ['top','left','bottom','right','insideH','insideV']:borders.append(element('w:'+edge,val='single',sz=4,color='000000'))
    t._tbl.tblPr.append(borders)
    para('',size=1,after=1,line=1)
    return t

def extracted_table(page,which=0):
    raw=pdf.pages[page].extract_tables()[which]; rows=[]
    for row in raw:
        # PDF table grid includes padding boundaries; collapse these, not content.
        if not any(v and v.strip() for v in row):continue
        if row[0] in ('',None): vals=[v for v in row if v and v.strip()]
        else: vals=[row[i] or '' for i in range(0,len(row),3)]
        rows.append([''.join(v.splitlines()) if '@' in v else join_lines(v.splitlines()) for v in vals])
    return rows

def institutional_footer(sec):
    foot=sec.footer
    p=foot.paragraphs[0]; p.paragraph_format.space_after=Pt(3); p.paragraph_format.line_spacing=1
    for i,text in enumerate([
        'Department of Computer Science and Engineering','G H Raisoni College of Engineering',
        'An Empowered Autonomous Institute affiliated to Rashtrasant Tukadoji Maharaj Nagpur University, Nagpur',
        'Accredited by NAAC with "A++" Grade (3rd Cycle)',
        'CRPF Gate No. 3, Hingna Road, Digdoh Hills, Nagpur - 440 016 (INDIA)']):
        if i:p.add_run('\n')
        setfont(p.add_run(text),6,i<2)
    p=foot.add_paragraph(); p.paragraph_format.space_after=Pt(0); p.paragraph_format.line_spacing=1
    p.add_run().add_picture(str(ROOT/'branding-1.png'),width=Inches(5.95))

def logo(sec):
    p=sec.header.paragraphs[0];p.paragraph_format.space_after=Pt(0)
    p.add_run().add_picture(str(ROOT/'branding-0.png'),width=Inches(1.65))

page_settings(doc.sections[0]); logo(doc.sections[0]); institutional_footer(doc.sections[0])
para('ThreatLens: An AI-Assisted Framework for Automated Source Code Security Assessment, Vulnerability Prioritization and Compliance Analysis','Title',18,True,WD_ALIGN_PARAGRAPH.CENTER,19,40,1.1)
cover=[
('Project Report submitted in partial fulfillment of the requirements for the award of the degree of',12,False,17),
('Bachelor of Technology',14,True,12),('in',12,False,12),('Computer Science and Engineering',14,True,12),('by',12,False,12),
('Mr. Jignesh Sonewane    Mr. Soham Pashine',12,True,12),('Mr. Bhargave Bawane',12,True,12),
('Under the guidance of',12,False,12),('Prof. Pankaj Sonewane',14,True,9),
('Head of Department (Data Science, IoT and Cyber Security)',12,True,23),('November 2026',12,True,9),
('© G H Raisoni College of Engineering, Nagpur, 2026',11,False,0)]
for text,size,bold,after in cover:para(text,size=size,bold=bold,align=WD_ALIGN_PARAGRAPH.CENTER,after=after,line=1.15)

s=newsec();logo(s);institutional_footer(s);heading('DECLARATION')
for text in groups(1,120,340):para(text)
para('Student Details and Signatures',bold=True,after=8)
table(extracted_table(1),[1.55,.9,2.75,.75],10)
para('Date: [     /     /     ]',before=12);para('Place: Nagpur')

s=newsec();logo(s);institutional_footer(s);heading('CERTIFICATE')
for text in groups(2,100,215):para(text)
para('Approval and Signature Details',bold=True);table(extracted_table(2,0),[2.975,2.975],11)
para('Institutional Approval',bold=True,before=8);table(extracted_table(2,1),[2.975,2.975],11)
last=[g for g in groups(2,0,720) if g.startswith('[Enter')]
for text in last:para(text,size=10,before=10,line=1.2)

s=newsec();heading('ACKNOWLEDGEMENT')
for text in groups(3,100,760):para(text)

s=newsec(('lowerRoman',1));page_number(s);heading('ABSTRACT')
for text in groups(4,100,750):para(text,size=11.5,after=7,line=1.12)

for pnum,title,widths in [(5,'LIST OF FIGURES',[.95,4.15,.85]),(6,'LIST OF TABLES',[1.0,4.1,.85]),(7,'LIST OF SYMBOLS AND ABBREVIATIONS',[.7,4.1,1.15]),(8,'LIST OF PUBLICATIONS PROJECT COMPETITIONS AND PATENTS',[.65,1.65,3.65])]:
    doc.add_page_break();heading(title);table(extracted_table(pnum),widths,11)

doc.add_page_break();heading('TABLE OF CONTENTS')
for i in [9,10,11]:
    for line in lines_on(i,95 if i==9 else 0,780):
        text=line['text']
        if text=='TABLE OF CONTENTS':continue
        m=re.match(r'^(.*?)\s*\.{3,}\s*(\S+)\s*$',text)
        if not m:raise ValueError('Unexpected contents line: '+text)
        title,page=m.groups()
        p=para(title+'\t'+page,size=10.5,bold=title.startswith('CHAPTER') or title in ['REFERENCES','APPENDICES'],after=5,line=1.1)
        p.paragraph_format.tab_stops.add_tab_stop(Inches(5.95),WD_TAB_ALIGNMENT.RIGHT,WD_TAB_LEADER.DOTS)
        if re.match(r'^\d+\.\d+',title):p.paragraph_format.left_indent=Inches(.15)

s=newsec(('decimal',1));page_number(s)

def split_paragraph(el):
    """Turn manual text breaks into paragraphs; keep runs, drawings and hyperlinks."""
    if not el.xpath('.//w:br[not(@w:type) or @w:type="textWrapping"]|.//w:drawing'):return [el]
    result=[]
    def fresh():
        p=OxmlElement('w:p')
        if el.pPr is not None:p.append(deepcopy(el.pPr))
        return p
    current=fresh()
    for child in el:
        if child.tag==qn('w:pPr'):continue
        if child.tag!=qn('w:r'):
            current.append(deepcopy(child));continue
        def newrun():
            r=OxmlElement('w:r')
            if child.rPr is not None:r.append(deepcopy(child.rPr))
            return r
        r=newrun()
        for item in child:
            if item.tag==qn('w:rPr'):continue
            if item.tag==qn('w:br') and item.get(qn('w:type')) in (None,'textWrapping'):
                if len(r)>int(child.rPr is not None):current.append(r)
                result.append(current);current=fresh();r=newrun()
            elif item.tag==qn('w:drawing'):
                if len(r)>int(child.rPr is not None):current.append(r)
                if ''.join(current.itertext()).strip():result.append(current);current=fresh()
                r=newrun();r.append(deepcopy(item));current.append(r)
                result.append(current);current=fresh();r=newrun()
            elif item.tag!=qn('w:lastRenderedPageBreak'):r.append(deepcopy(item))
        if len(r)>int(child.rPr is not None):current.append(r)
    result.append(current)
    return result

body_nodes=[]
for el in original:
    if el.tag==qn('w:p'):body_nodes.extend(split_paragraph(el))
    else:body_nodes.append(el)

start=True;after_chapter=False
for el in body_nodes:
    if el.tag!=qn('w:p'):
        body.insert(len(body)-1,el);continue
    p=Paragraph(el,doc._body)
    if not p.text.strip() and not el.xpath('.//w:drawing'):continue
    body.insert(len(body)-1,el)
    p.style=doc.styles['Normal'];pf=p.paragraph_format
    pf.space_before=Pt(0);pf.space_after=Pt(7);pf.line_spacing=1.5
    pf.keep_with_next=False;pf.keep_together=False;pf.page_break_before=False;pf.widow_control=True
    pf.left_indent=Pt(0);pf.right_indent=Pt(0);pf.first_line_indent=Pt(0)
    p.alignment=WD_ALIGN_PARAGRAPH.LEFT
    for run in p.runs:setfont(run,12)
    txt=p.text.strip()
    if after_chapter:pf.page_break_before=True;after_chapter=False
    if txt.startswith('CHAPTER '):
        spacer=OxmlElement('w:p');el.addprevious(spacer)
        sp=Paragraph(spacer,doc._body)
        sp.paragraph_format.page_break_before=not start
        sp.paragraph_format.line_spacing=Pt(300)
        sp.paragraph_format.space_before=Pt(0);sp.paragraph_format.space_after=Pt(0)
        sp.paragraph_format.keep_with_next=True
        setfont(sp.add_run('\u00a0'),1)
        p.style=doc.styles['Heading 1'];p.alignment=WD_ALIGN_PARAGRAPH.CENTER
        pf.page_break_before=False;pf.space_before=Pt(0);pf.space_after=Pt(0);pf.line_spacing=1.25
        pf.keep_with_next=False;pf.keep_together=True
        # A line break changes presentation only, not the chapter title text.
        m=re.match(r'^(CHAPTER \d+)\s+(.*)$',txt)
        if m:p.text=m[1]+'\n'+m[2]
        for r in p.runs:setfont(r,16,True)
        after_chapter=True
    elif re.match(r'^\d+\.\d+\s',txt):
        p.style=doc.styles['Heading 2'];pf.space_before=Pt(12);pf.space_after=Pt(9);pf.keep_with_next=True;pf.line_spacing=1.2
        for r in p.runs:setfont(r,14,True)
    elif txt.startswith('Figure ') and re.match(r'^Figure \d+\.\d+:',txt):
        p.style=doc.styles['Caption'];p.alignment=WD_ALIGN_PARAGRAPH.CENTER
        pf.space_after=Pt(12);pf.line_spacing=1.15;pf.keep_together=True
        for r in p.runs:setfont(r,11,False);r.italic=False
    elif txt.startswith('Contribution '):
        pf.keep_with_next=True
    if el.xpath('.//w:numPr'):
        pf.left_indent=Inches(.23);pf.first_line_indent=Inches(-.23)
    if el.xpath('.//w:drawing'):
        p.alignment=WD_ALIGN_PARAGRAPH.CENTER;pf.line_spacing=1;pf.space_after=Pt(7);pf.keep_with_next=False
    start=False

# Keep only the final panel with its caption, not every large picture in a chain.
for i,p in enumerate(doc.paragraphs[:-1]):
    if p._p.xpath('.//w:drawing') and doc.paragraphs[i+1].text.startswith('Figure '):
        p.paragraph_format.keep_with_next=True

for shape in doc.inline_shapes:
    if shape.width>Inches(5.95):
        ratio=Inches(5.95)/shape.width; shape.width=int(shape.width*ratio);shape.height=int(shape.height*ratio)
    if shape.height>Inches(6.4):
        ratio=Inches(6.4)/shape.height;shape.width=int(shape.width*ratio);shape.height=int(shape.height*ratio)

doc.add_page_break();heading('REFERENCES')
for i,text in enumerate(groups(53,110,750)):
    prefix,anchor=text.split('Available: ',1)
    p=para(prefix+'Available: ',size=12,line=1.3,after=10)
    link=element('w:hyperlink')
    link.set(qn('r:id'),doc.part.relate_to(pdf.pages[53].hyperlinks[i]['uri'],RT.HYPERLINK,is_external=True))
    r=OxmlElement('w:r');rp=element('w:rPr');rp.append(element('w:rFonts',ascii='Calibri',hAnsi='Calibri'));rp.append(element('w:sz',val=24));rp.append(element('w:u',val='single'));r.append(rp)
    tt=element('w:t');tt.text=anchor;r.append(tt);link.append(r);p._p.append(link)

doc.add_page_break();heading('APPENDICES')
for text in groups(54,110,750,gap=30):
    if text.startswith('APPENDIX '):
        p=para(text,'Heading 2',14,True,before=14,after=9,line=1.2)
    else:para(text)

# Style the original functional test matrix without changing cell contents.
for t in doc.tables:
    if not t.cell(0,0).text.startswith('Test case'):continue
    t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    widths=[2.1,2.5,1.35]
    for col,width in zip(t.columns,widths):col.width=Inches(width)
    for row in t.rows:
        row._tr.get_or_add_trPr().append(element('w:cantSplit'))
        for cell,width in zip(row.cells,widths):
            cell.width=Inches(width)
            margins=element('w:tcMar')
            for edge in ['top','left','bottom','right']:margins.append(element('w:'+edge,w=70,type='dxa'))
            cell._tc.get_or_add_tcPr().append(margins)
            cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for p in cell.paragraphs:
                p.paragraph_format.line_spacing=1.15;p.paragraph_format.space_after=Pt(5);p.paragraph_format.space_before=Pt(5)
                for r in p.runs:setfont(r,10.5)
    t.rows[0]._tr.get_or_add_trPr().append(element('w:tblHeader'))
    for cell in t.rows[0].cells:
        cell._tc.get_or_add_tcPr().append(element('w:shd',fill='F2F2F2'))
        for p in cell.paragraphs:
            for r in p.runs:r.bold=True
    borders=element('w:tblBorders')
    for edge in ['top','left','bottom','right','insideH','insideV']:borders.append(element('w:'+edge,val='single',sz=4,color='000000'))
    t._tbl.tblPr.append(borders)

doc.core_properties.title=reader.metadata.title
doc.core_properties.subject='ThreatLens thesis'
doc.core_properties.author='Jignesh Sonewane; Soham Pashine; Bhargav Bawane'
doc.core_properties.comments=''
doc.save(OUT)
print(OUT)
print('Sections',len(doc.sections),'Tables',len(doc.tables),'Figures',len(doc.inline_shapes))
manifest=dict(source=str(SOURCE),editable_body=str(EDITABLE),output=str(OUT),original_body_sha256=hashlib.sha256(original_text.encode()).hexdigest(),content_policy='Preserve source wording, names, placeholders, captions, table values and original contents-list values. Formatting only.',images=len(doc.inline_shapes),tables=len(doc.tables))
(ROOT/'conversion-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
