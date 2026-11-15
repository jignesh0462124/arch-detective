from pathlib import Path
import re
from pypdf import PdfReader
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION_START
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parents[1] / 'output' / 'docx' / 'ThreatLens_Thesis_Formatted.docx'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdf = PdfReader(r'C:\Users\jigne\Downloads\ThreatLens_Thesis_Fixed.pdf')
doc = Document()
TITLE = 'ThreatLens: An AI-Assisted Framework for Automated Source Code Security Assessment, Vulnerability Prioritization and Compliance Analysis'

def font(style, size, bold=False, italic=False):
    style.font.name = 'Calibri'
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.italic = italic
    style.font.color.rgb = RGBColor(0, 0, 0)
    style.element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'), 'Calibri')

font(doc.styles['Normal'],12)
doc.styles['Normal'].paragraph_format.line_spacing = 1.15
doc.styles['Normal'].paragraph_format.space_after = Pt(7)
doc.styles['Normal'].paragraph_format.widow_control = True
for name,size in [('Title',18),('Heading 1',16),('Heading 2',12.5)]:
    font(doc.styles[name],size,True)
    pf=doc.styles[name].paragraph_format
    pf.space_before=Pt(12); pf.space_after=Pt(8); pf.keep_with_next=True
doc.styles['Heading 1'].paragraph_format.alignment=WD_ALIGN_PARAGRAPH.CENTER
doc.styles['Heading 1'].paragraph_format.page_break_before=True
doc.styles['Heading 2'].paragraph_format.space_before=Pt(8)
doc.styles['Heading 2'].paragraph_format.space_after=Pt(4)
for name,size,bold,italic in [('Front Matter Heading',16,True,False),('Contents Title',16,True,False),('Front Section Label',12.5,True,False),('Draft Instruction',10.5,False,True),('Figure Caption',11,True,False),('Table Caption',11,True,False)]:
    s=doc.styles.add_style(name,1);s.base_style=doc.styles['Normal'];font(s,size,bold,italic)
    s.paragraph_format.space_before=Pt(8);s.paragraph_format.space_after=Pt(6)
    if 'Heading' in name or name=='Contents Title':
        s.paragraph_format.alignment=WD_ALIGN_PARAGRAPH.CENTER;s.paragraph_format.keep_with_next=True
    if 'Caption' in name: s.paragraph_format.keep_with_next=True
for name in ['TOC 1','TOC 2']:
    if name not in doc.styles: doc.styles.add_style(name,1)
    font(doc.styles[name],11)
    doc.styles[name].paragraph_format.line_spacing=1.05
    doc.styles[name].paragraph_format.space_after=Pt(4)
doc.styles['TOC 2'].paragraph_format.left_indent=Inches(.2)

def field(p, code, cached=''):
    r=p.add_run();b=OxmlElement('w:fldChar');b.set(qn('w:fldCharType'),'begin');r._r.append(b)
    t=OxmlElement('w:instrText');t.set(qn('xml:space'),'preserve');t.text=' '+code+' ';r._r.append(t)
    s=OxmlElement('w:fldChar');s.set(qn('w:fldCharType'),'separate');r._r.append(s)
    if cached: p.add_run(cached)
    e=OxmlElement('w:fldChar');e.set(qn('w:fldCharType'),'end');p.add_run()._r.append(e)

def setup(section, numbering=None, first=False):
    section.page_width=Pt(595.5);section.page_height=Pt(841.75)
    section.left_margin=Inches(1.25);section.right_margin=Inches(.9)
    section.top_margin=Inches(1.25 if first else .85)
    section.bottom_margin=Inches(1.55 if first else .8)
    section.header_distance=Inches(.25);section.footer_distance=Inches(.25 if first else .35)
    section.header.is_linked_to_previous=False;section.footer.is_linked_to_previous=False
    border=OxmlElement('w:pgBorders');border.set(qn('w:offsetFrom'),'page')
    for side in ['top','left','bottom','right']:
        el=OxmlElement('w:'+side)
        for key,value in {'val':'single','sz':'4','space':'12','color':'808080'}.items():el.set(qn('w:'+key),value)
        border.append(el)
    section._sectPr.append(border)
    if numbering:
        n=OxmlElement('w:pgNumType');n.set(qn('w:fmt'),numbering);n.set(qn('w:start'),'1');section._sectPr.append(n)
        p=section.footer.paragraphs[0];p.alignment=WD_ALIGN_PARAGRAPH.CENTER;field(p,'PAGE','1')
    if first:
        section.header.paragraphs[0].add_run().add_picture(str(ROOT/'source/asset-1.png'),width=Inches(2.05))
        fp=section.footer.paragraphs[0];fp.paragraph_format.space_after=Pt(2);fp.paragraph_format.line_spacing=1
        lines=['Department of Computer Science and Engineering','G H Raisoni College of Engineering','An Empowered Autonomous Institute affiliated to Rashtrasant Tukadoji Maharaj Nagpur University, Nagpur','Accredited by NAAC with "A++" Grade (3rd Cycle)','CRPF Gate No. 3, Hingna Road, Digdoh Hills, Nagpur - 440 016 (INDIA)']
        for i,line in enumerate(lines):
            run=fp.add_run(line+ ('\n' if i<len(lines)-1 else ''));run.font.size=Pt(7);run.bold=i==0
        p=section.footer.add_paragraph();p.paragraph_format.space_after=Pt(0)
        p.add_run().add_picture(str(ROOT/'source/asset-2.png'),width=Inches(5.95))

def p(text='',style=None,align=None):
    x=doc.add_paragraph(text,style);x.alignment=align;return x

def heading(text,front=False):
    return p(text,'Front Matter Heading' if front else 'Heading 1')

def note(text):return p(text,'Draft Instruction')

def table(headers,rows,widths=None):
    t=doc.add_table(rows=1, cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    total=595.5-72*(1.25+.9)
    widths=widths or [1/len(headers)]*len(headers)
    for col,ratio in zip(t.columns,widths): col.width=Pt(total*ratio)
    for cell,txt in zip(t.rows[0].cells,headers):cell.text=txt
    for row in rows:
        for cell,txt in zip(t.add_row().cells,row):cell.text=txt
    for ri,row in enumerate(t.rows):
        trPr=row._tr.get_or_add_trPr();cant=OxmlElement('w:cantSplit');trPr.append(cant)
        if ri==0: trPr.append(OxmlElement('w:tblHeader'))
        for ci,cell in enumerate(row.cells):
            cell.width=Pt(total*widths[ci]);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            pr=cell._tc.get_or_add_tcPr();b=OxmlElement('w:tcBorders')
            for edge in ['top','left','bottom','right']:
                e=OxmlElement('w:'+edge)
                for key,value in {'val':'single','sz':'4','color':'D9D9D9'}.items(): e.set(qn('w:'+key),value)
                b.append(e)
            pr.append(b);m=OxmlElement('w:tcMar')
            for side in ['top','bottom','left','right']:
                e=OxmlElement('w:'+side);e.set(qn('w:w'),'75');e.set(qn('w:type'),'dxa');m.append(e)
            pr.append(m)
            if ri==0:
                shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'E7E6E6');pr.append(shade)
            for para in cell.paragraphs:
                para.paragraph_format.space_after=Pt(0);para.paragraph_format.line_spacing=1.05
                para.alignment=WD_ALIGN_PARAGRAPH.LEFT if ci else WD_ALIGN_PARAGRAPH.CENTER
                for r in para.runs:r.font.size=Pt(10);r.bold=ri==0
    return t

setup(doc.sections[0],first=True)
for cover in range(2):
    if cover:doc.add_page_break()
    x=p(TITLE,'Title',WD_ALIGN_PARAGRAPH.CENTER);x.paragraph_format.space_before=Pt(24);x.paragraph_format.space_after=Pt(22)
    for text in ['Project Report submitted in partial fulfillment of the requirements for the award of the degree of','Bachelor of Technology','in','Computer Science and Engineering','by']:
        x=p(text,align=WD_ALIGN_PARAGRAPH.CENTER)
        if text in ['Bachelor of Technology','Computer Science and Engineering']:
            x.runs[0].bold=True;x.runs[0].font.size=Pt(14)
    for text in ['[Student 1 Name]    [Student 2 Name]','[Student 3 Name]    [Student 4 Name]','Under the guidance of','Pankaj Sonewane','[Guide designation / department]','November 2026']:
        x=p(text,align=WD_ALIGN_PARAGRAPH.CENTER)
        if text in ['Pankaj Sonewane','November 2026']:x.runs[0].bold=True
    if cover:p('© G H Raisoni College of Engineering, Nagpur, 2026',align=WD_ALIGN_PARAGRAPH.CENTER)

doc.add_page_break();p('DECLARATION','Contents Title')
p(f'We hereby declare that the project report titled "{TITLE}" submitted herein has been carried out by us towards partial fulfillment of the requirements for the award of the degree of Bachelor of Technology in Computer Science and Engineering. The work is original and has not been submitted earlier as a whole or in part for the award of any degree or diploma at this or any other institution or university.').alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
p('We also hereby assign to G H Raisoni College of Engineering, Nagpur, all rights under copyright that may exist in and to the above work and any revised or expanded derivative work based on it, as specified by the college declaration template. Work drawn from references and manuals is acknowledged through citations.').alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
p('Student Details and Signatures','Front Section Label');table(['Student name','Mobile number','Email ID','Signature'],[['[Fill]']*4 for _ in range(4)],[.28,.22,.3,.2])
p('Date: [DD/MM/YYYY]');p('Place: Nagpur')
doc.add_page_break();p('CERTIFICATE','Contents Title')
p(f'The project report entitled "{TITLE}" submitted by [Student 1], [Student 2], [Student 3] and [Student 4] for the award of the degree of Bachelor of Technology in Computer Science and Engineering has been carried out under my supervision. The work is comprehensive, complete and fit for evaluation.').alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
p('Approval and Signature Details','Front Section Label');table(['Guide','Project Incharge'],[['Pankaj Sonewane','[Fill]'],['[Signature]','[Signature]']])
p('Institutional Approval','Front Section Label');table(['Head of Department','Director'],[['[Fill]','[Fill]'],['[Signature]','[Signature]']])
note('[Enter official names and designations, verify the declaration and obtain the prescribed signatures.]')

setup(doc.add_section(WD_SECTION_START.NEW_PAGE))
p('ACKNOWLEDGEMENT','Contents Title')
ack=[
'We express our sincere gratitude to our project guide, Pankaj Sonewane, for his guidance, technical insight and careful review throughout this work. His questions and suggestions helped us refine the research problem, strengthen the experimental methodology and present the findings with appropriate scientific boundaries. We are especially thankful for his encouragement to integrate AI-driven vulnerability detection, machine learning, Retrieval-Augmented Generation (RAG) and cybersecurity analysis into one coherent study through our ThreatLens project.',
'We thank the faculty and staff of G H Raisoni College of Engineering, Nagpur, for providing the academic environment, computational resources and administrative support required to complete this project. We also acknowledge the researchers, cybersecurity professionals, open-source contributors and standards organizations whose published research, technical documentation and security frameworks supported the development of ThreatLens. Their contributions provided valuable insights into automated vulnerability detection, static code analysis, RAG, CVSS-based risk assessment, compliance mapping and remediation recommendations. Responsibility for the system architecture, implementation, experimental evaluation, analysis and conclusions presented in this study remains with the project team.',
'We are grateful to our families and friends for their patience, encouragement and support during the development, testing and writing stages. Finally, we acknowledge the effort of every member of the project team in maintaining the code, reviewing evidence, preparing the manuscript and thesis, and completing the work collaboratively.'
]
for text in ack:
    x=p(text);x.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY;x.paragraph_format.first_line_indent=Inches(.25)

setup(doc.add_section(WD_SECTION_START.NEW_PAGE),'lowerRoman')
heading('ABSTRACT',True)
abstract=' '.join(line.strip() for page in pdf.pages[5:7] for line in page.extract_text().splitlines() if line.strip() and line.strip()!='ABSTRACT' and not re.fullmatch(r'[ivxlcdm]+',line.strip()))
abstract=abstract.replace('Archon','ThreatLens');abstract=re.sub(r'\s+',' ',abstract)
starts=['Security assessment','This thesis presents','The workbench connects','ThreatLens also provides','The principal contribution','Keywords:']
positions=[abstract.index(s) for s in starts]
for i,start in enumerate(positions):
    text=abstract[start:positions[i+1] if i+1<len(positions) else len(abstract)].strip()
    text=text.replace('vulnerability- detection','vulnerability-detection').replace('store- approval','store-approval')
    x=p(text);x.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
    if i<5:x.paragraph_format.first_line_indent=Inches(.25)
    else:x.runs[0].italic=True;x.runs[0].font.size=Pt(11)
for title,code in [('LIST OF FIGURES','TOC \\h \\z \\t "Figure Caption,1"'),('LIST OF TABLES','TOC \\h \\z \\t "Table Caption,1"')]:
    doc.add_page_break();heading(title,True);field(p(),code)
doc.add_page_break();heading('LIST OF SYMBOLS AND ABBREVIATIONS',True)
p('Technical Symbols and Abbreviations','Front Section Label')
table(['Symbol / abbreviation','Meaning','Unit / note'],[['[Fill]']*3 for _ in range(7)],[.3,.45,.25])
doc.add_page_break();heading('LIST OF PUBLICATIONS PROJECT COMPETITIONS AND PATENTS',True)
note('[List only verifiable publications, competitions, awards or patent filings related to the project. If none, write "Not Applicable" according to guide instructions.]')
doc.add_page_break();p('TABLE OF CONTENTS','Contents Title');field(p(),'TOC \\o "1-2" \\h \\z \\t "Front Matter Heading,1"')

setup(doc.add_section(WD_SECTION_START.NEW_PAGE),'decimal')
tables={
'2.1':(['Study / year','Approach','Strength','Limitation / gap'],5,[.2,.26,.24,.3]),
'4.1':(['Component','Technology / version','Role','Evidence / config'],5,[.2,.3,.2,.3]),
'5.1':(['Method','Endpoint','Purpose','Auth / role'],5,[.13,.35,.3,.22]),
'6.1':(['Test ID','Scenario','Expected result','Actual result','Status'],6,[.12,.25,.24,.24,.15]),
'6.2':(['Category','TP','FP','FN','Precision','Recall / F1'],4,[.27,.09,.09,.09,.21,.25])}

def clean(s):
    s=s.replace('\ufffd','-').replace('\u2014','-').replace('\u2013','-').replace('\u201c','"').replace('\u201d','"')
    return re.sub(r'\s+',' ',s).strip()

lines=[]
for page in pdf.pages[16:]:
    raw=page.extract_text().splitlines()
    for line in raw:
        line=line.strip()
        if not line or re.fullmatch(r'\d+',line):continue
        lines.append(clean(line))
i=0
while i<len(lines):
    line=lines[i]
    if line.startswith('CHAPTER '):
        title=line+' '+lines[i+1];x=heading(title)
        if line=='CHAPTER 1':x.paragraph_format.page_break_before=False
        i+=2;continue
    if line in ['REFERENCES','APPENDICES']:
        heading(line);i+=1;continue
    if re.match(r'^\d+\.\d+\s',line):
        p(line,'Heading 2');i+=1;continue
    if line.startswith('APPENDIX '):
        p(line.replace(' - ',' '),'Heading 2');i+=1;continue
    if re.match(r'^Table \d+\.\d+',line):
        key=re.search(r'\d+\.\d+',line).group();p(line,'Table Caption')
        heads,count,width=tables[key];table(heads,[['[Fill]']*len(heads) for _ in range(count)],width)
        i+=1
        while i<len(lines) and not re.match(r'^(?:\d+\.\d+\s|CHAPTER |Table |Figure |\[COLLEGE|REFERENCES|APPENDI)',lines[i]):i+=1
        continue
    if re.match(r'^Figure \d+\.\d+',line):p(line,'Figure Caption');i+=1;continue
    if line.startswith('['):
        text=line
        while text.count('[')>text.count(']') and i+1<len(lines):i+=1;text+=' '+lines[i]
        if '[Fill]' not in text:
            if text.startswith('[COLLEGE REQUIREMENT:') and hasattr(doc,'add_comment'):
                chapter=next(x for x in reversed(doc.paragraphs) if x.text=='CHAPTER 2 LITERATURE REVIEW')
                doc.add_comment(chapter.runs,text+' Confirm this requirement with the project guide.','Formatting review','FR')
                i+=1;continue
            # Repair missing quote glyphs in the bibliography without inventing sources.
            if re.match(r'^\[\d+\]',text):
                text=text.replace('-[Article or paper title],-','"[Article or paper title],"')
            note(text)
        i+=1;continue
    i+=1

# Native comments keep unresolved academic content explicit without inventing it.
if hasattr(doc,'add_comment'):
    for para in doc.paragraphs:
        if para.style.name=='Front Matter Heading' and para.text=='ABSTRACT':
            doc.add_comment(para.runs,'The source alternated between Archon and ThreatLens. This copy uses ThreatLens to match the thesis title. Confirm the preferred final project name.','Formatting review','FR')
        if para.style.name=='Heading 1' and para.text.startswith('CHAPTER 6'):
            doc.add_comment(para.runs,'This chapter still contains source-template prompts. Insert measured results and verifiable evidence before academic submission; no results have been invented during conversion.','Formatting review','FR')
doc.core_properties.title=TITLE;doc.core_properties.subject='Formatted editable thesis'
doc.core_properties.author='';doc.core_properties.last_modified_by=''
# Word's installed templates may carry a decorative rule in the Title style.
for style in doc.styles:
    for border in list(style.element.findall('.//'+qn('w:pBdr'))):border.getparent().remove(border)
for para in doc.paragraphs:
    for border in list(para._p.findall('.//'+qn('w:pBdr'))):border.getparent().remove(border)
doc.save(OUT)
print(OUT)
print('paragraphs',len(doc.paragraphs),'tables',len(doc.tables),'sections',len(doc.sections))
