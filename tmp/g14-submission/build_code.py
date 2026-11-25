"""Assemble the local G-14 submission without reading live configuration."""
from pathlib import Path
from collections import defaultdict
from copy import deepcopy
from hashlib import sha256
import json
import re
import shutil
import subprocess
import textwrap
import unicodedata

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path.cwd()
BUILD = ROOT / 'tmp/g14-submission'
DEST = ROOT / 'output/G-14 ThreatLens'
D = Path('C:/Users/jigne/Downloads')
PAPER = D / 'G-14 ThreatLens Research paper.pdf'
THESIS = D / 'G_14_ThreatLens_Thesis_Chapters.pdf'
ARCH = ROOT / 'output/Thesis_Research_Diagrams_Archon_Colours_20261114/figure-1-1-system-architecture-revised.png'
TABLES = ('src', 'threatlens/app', 'supabase/migrations', 'threatlens/alembic')
SHA = subprocess.check_output(['git', 'rev-parse', '--short=12', 'HEAD'], text=True).strip()
NAMES = 'Jignesh Sonewane, Soham Pashine, and Bhargav Bawane'

for folder in ('Code', 'PPT', 'Research Paper', 'Thesis'):
    (DEST / folder).mkdir(parents=True, exist_ok=True)

for source, target in ((PAPER, 'Research Paper'), (THESIS, 'Thesis')):
    output = DEST / target / source.name
    shutil.copyfile(source, output)
    assert sha256(source.read_bytes()).digest() == sha256(output.read_bytes()).digest()

subprocess.run(['pdftoppm', '-f', '1', '-l', '1', '-singlefile', '-r', '135', '-png',
                str(PAPER), str(DEST / 'Research Paper/Research Paper Format Reference')], check=True)

groups = [
    ('01 Frontend', 'Frontend Application', 'Route and component code for sign-in, workspaces, the dashboard, Workbench, findings, settings, reports, and the advisor.'),
    ('02 Backend and API', 'Backend API and Services', 'FastAPI startup, route handlers, authentication, service code, data models, schemas, storage, and background tasks.'),
    ('03 Database', 'Database and Access Policies', 'Versioned PostgreSQL migrations, workspace-level read and write policies, and the separate SQLAlchemy migration bootstrap.'),
    ('04 Detection and Reporting', 'Detection Analysis and Reports', 'Archive intake, scanner adapters, evidence handling, model review, reference retrieval, and report templates.'),
    ('05 Environment and Deployment', 'Environment and Deployment', 'Frontend and backend environment templates, dependency manifests, build files, and local deployment settings.'),
]

FRONT_CONFIG = {'package.json', 'vite.config.ts', 'tsconfig.json', 'eslint.config.js',
                'components.json', '.env.example', 'docker-compose.prod.yml'}
BACK_CONFIG = {'threatlens/.env.example', 'threatlens/Dockerfile', 'threatlens/docker-compose.yml',
               'threatlens/requirements.txt', 'threatlens/requirements-api.txt',
               'threatlens/requirements-test.txt', 'scripts/dev-backend.mjs'}
ALL_SELECT = list(TABLES) + sorted(FRONT_CONFIG | BACK_CONFIG)
paths = subprocess.check_output(['git', 'ls-files', '--', *ALL_SELECT], text=True).splitlines()
assert len(paths) == len(set(paths))

# Do not reproduce crafted exploit fixtures or environment files. Defensive scanner
# patterns and report rendering code are in scope. Secret-looking strings are masked.
SECRET = re.compile(r'(?i)(?:gsk_[\w-]{24,}|sk-(?:proj-|ant-)?[\w-]{24,}|gh[pousr]_[\w-]{20,}|github_pat_[\w-]{24,}|sb_(?:secret|publishable)_[\w-]{20,}|xox[baprs]-[\w-]{12,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{14,}\.[A-Za-z0-9_-]{14,}\.[A-Za-z0-9_-]{8,})')
PEM = re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----')
CRED_URI = re.compile(r'(?i)\b(?:postgres(?:ql)?(?:\+asyncpg)?|redis(?:s)?|mysql)://[^\s\"\'<>@]+:[^\s\"\'<>@]+@[^\s\"\'<>]+')
SUSPECT = re.compile(r'(?i)^\s*['+chr(34)+chr(39)+r']?(?:\w*API_KEY|\w*PRIVATE_KEY|\w*SECRET|\w*PASSWORD|\w*TOKEN)\b\s*['+chr(34)+chr(39)+r']?\s*[:=]\s*(["\'])([A-Za-z0-9_+./=\-]{12,})\1')
HOST = re.compile(r'(?i)\b[a-z0-9]{20}\.supabase\.co\b')
SAFE_DEFAULT = re.compile(r'(?i)^(?:true|false|[0-9]+|development|production|authenticated|RS256,ES256|https?://(?:127\.0\.0\.1|localhost):[0-9]+)$')
BAD_TEXT = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')


def mask(text):
    text, a = PEM.subn('[private key omitted]', text)
    text, b = SECRET.subn('[credential omitted]', text)
    text, c = CRED_URI.subn('[connection string omitted]', text)
    text, d = HOST.subn('example-project.supabase.co', text)
    out = []
    e = 0
    for line in text.split('\n'):
        m = SUSPECT.search(line)
        if m and not any(t in m[2].lower() for t in ('placeholder', 'example', 'replace', 'your-', 'your_', 'fixture', 'changeme')):
            line = line[:m.start(2)] + '[credential omitted]' + line[m.end(2):]
            e += 1
        out.append(line)
    return '\n'.join(out), a + b + c + d + e


def example_env(src):
    safe = []
    for line in src.splitlines():
        match = re.fullmatch(r'\s*(#\s*)?([A-Z][A-Z0-9_]*)=(.*)', line)
        if not match:
            continue
        disabled, key, val = match.groups()
        val = val.strip()
        if not SAFE_DEFAULT.fullmatch(val or ''):
            val = '<set-in-your-environment>' if val else ''
        safe.append(f'{"# " if disabled else ""}{key}={val}')
    assert safe
    return '\n'.join(safe)


def assign(p):
    if p in FRONT_CONFIG | BACK_CONFIG or p.startswith('nginx/'):
        return 4
    if p == 'src/routeTree.gen.ts' or '/__pycache__/' in p:
        return None
    if p.startswith('src/') and Path(p).suffix in {'.tsx', '.ts', '.css', '.js', '.mjs'}:
        return 0
    if p.startswith(('supabase/migrations/', 'threatlens/alembic/')) and Path(p).suffix in {'.sql', '.py', '.ini'}:
        return 2
    if p.startswith('threatlens/app/') and Path(p).suffix in {'.py', '.html'}:
        if p.split('/')[2] in {'agent', 'ingestion', 'rag', 'report', 'scanners'}:
            return 3
        return 1
    return None


def file_order(item):
    p = item['path']
    starts = ('src/start', 'src/server', 'src/router', 'src/routes/__root', 'src/routes/_app.tsx', 'src/routes/',
              'src/components/', 'src/hooks/', 'src/lib/', 'threatlens/app/main.py', 'threatlens/app/config.py',
              'threatlens/app/auth/', 'threatlens/app/api/', 'threatlens/app/services/', 'threatlens/app/ingestion/',
              'threatlens/app/scanners/', 'threatlens/app/agent/', 'threatlens/app/rag/', 'threatlens/app/report/',
              'supabase/migrations/', 'threatlens/alembic/', '.env.example', 'threatlens/.env.example')
    return next((i for i, s in enumerate(starts) if p.startswith(s)), len(starts)), p


records = defaultdict(list)
for path in paths:
    grp = assign(path)
    if grp is None:
        continue
    raw = (ROOT / path).read_text(encoding='utf-8-sig')
    if path.endswith('.env.example'):
        value, changes = mask(example_env(raw))
        form = 'Sanitized template'
    else:
        value, changes = mask(raw)
        form = 'Sanitized listing' if changes else 'Repository listing'
    assert not BAD_TEXT.search(value), path
    records[grp].append({'path': path, 'lines': value.splitlines(), 'form': form})

for files in records.values():
    files.sort(key=file_order)


def config_style(s, name, size, color='000000'):
    s.font.name, s.font.size, s.font.color.rgb = name, Pt(size), RGBColor.from_string(color)
    fonts = s.element.get_or_add_rPr().rFonts
    for attr in ('asciiTheme', 'hAnsiTheme', 'cstheme', 'eastAsiaTheme'):
        fonts.attrib.pop(qn('w:' + attr), None)


def field(paragraph, command):
    r = paragraph.add_run()
    e = OxmlElement('w:fldSimple')
    e.set(qn('w:instr'), command)
    r._r.addnext(e)


def doc_template(is_code=False):
    d = Document()
    s = d.sections[0]
    s.page_width, s.page_height = Inches(8.5), Inches(11)
    s.top_margin, s.bottom_margin = Inches(0.67), Inches(0.63)
    s.left_margin, s.right_margin = Inches(0.63), Inches(0.63)
    s.footer_distance = Inches(.36)
    normal = d.styles['Normal']
    config_style(normal, 'Calibri', 11)
    normal.paragraph_format.space_after = Pt(7)
    normal.paragraph_format.line_spacing = 1.12
    for name, sz in (('Title', 29), ('Heading 1', 18), ('Heading 2', 13)):
        config_style(d.styles[name], 'Calibri', sz)
        d.styles[name].font.bold = True
    for name, font, size, line in [('Source Listing','Consolas',9,10.5), ('Source File','Calibri',12,14),
                                    ('Source Range','Calibri',9,11), ('Index Entry','Calibri',10,12)]:
        st = d.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        config_style(st, font, size, '3F3F46' if name == 'Source Range' else '000000')
        pf = st.paragraph_format
        pf.space_after = Pt(0)
        pf.space_before = Pt(0)
        pf.line_spacing = Pt(line)
        pf.keep_with_next = name in ('Source File', 'Source Range')
        pf.widow_control = False
        if name == 'Source File':
            st.font.bold = True
            pf.space_before = Pt(8)
        if name == 'Source Range':
            pf.space_after = Pt(4)
    d.core_properties.author = 'Group G-14'
    d.core_properties.subject = 'ThreatLens Project Submission'
    s.footer.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    s.footer.paragraphs[0].add_run('G-14  /  ' + ('Source listings  /  ' if is_code else 'ThreatLens  /  ')).font.size = Pt(9)
    field(s.footer.paragraphs[0], 'PAGE')
    # Remove Word's default title rule where present.
    for node in d.styles['Title'].element.xpath('.//w:pBdr'):
        node.getparent().remove(node)
    return d


def grid(doc, heads, rows, widths):
    t = doc.add_table(rows=1, cols=len(heads))
    t.style = 'Table Grid'
    props = t._tbl.tblPr
    t.autofit = False
    bs = OxmlElement('w:tblBorders')
    for name in ('top','left','bottom','right','insideH','insideV'):
        x = OxmlElement('w:' + name)
        x.set(qn('w:val'), 'single'); x.set(qn('w:sz'), '5'); x.set(qn('w:color'), 'D9D9D9')
        bs.append(x)
    props.append(bs)
    for i,w in enumerate(widths):
        t.columns[i].width = Inches(w)
    for j, row in enumerate((heads,*rows)):
        cells = t.rows[0].cells if j == 0 else t.add_row().cells
        for i,value in enumerate(row):
            cells[i].width = Inches(widths[i])
            cells[i].text = value
            for paragraph in cells[i].paragraphs:
                paragraph.paragraph_format.space_after = Pt(3)
                paragraph.paragraph_format.space_before = Pt(3)
                for run in paragraph.runs:
                    run.bold = j == 0
                    run.font.size = Pt(10)
            if j == 0:
                shade = OxmlElement('w:shd'); shade.set(qn('w:fill'),'E8E9EB')
                cells[i]._tc.get_or_add_tcPr().append(shade)
        tr = cells[0]._tc.getparent().get_or_add_trPr()
        tr.append(OxmlElement('w:cantSplit'))
        if j == 0:
            tr.append(OxmlElement('w:tblHeader'))
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def physical_chunks(lines, max_width=91):
    for idx, line in enumerate(lines, 1):
        line = line.expandtabs(4)
        # Preserve every character. Use a hanging visual indent only after a long wrap.
        first = True
        if not line:
            yield idx, ''
            continue
        while line:
            stride = 0
            remaining = max_width if first else max_width-4
            for j,ch in enumerate(line):
                stride += 2 if unicodedata.east_asian_width(ch) in ('W','F') else 1
                if stride > remaining:
                    break
            else:
                j = len(line)
            j = max(1,j)
            yield idx, ('' if first else '    ') + line[:j]
            line = line[j:]
            first = False


def paginate(items):
    pages = []
    current, used = [], 0
    for item in items:
        rows = list(physical_chunks(item['lines'])) or [(0,'')]
        start = 0
        while start < len(rows):
            # Charge four rows for filename, range, and breathing space.
            if used + min(len(rows)-start, 7) + 4 > 53:
                pages.append(current); current, used = [], 0
            stop = min(len(rows), start + 53 - used - 4)
            current.append((item,rows[start:stop]))
            used += stop-start + 4
            start = stop
    if current:
        pages.append(current)
    return pages


manifest = {'revision': SHA, 'files': {}, 'volumes': {}}
for i,(folder,title,desc) in enumerate(groups):
    out = DEST/'Code'/folder
    out.mkdir(exist_ok=True)
    if i == 1:
        # Split by responsibility so route handlers remain easy to find.
        segments = [
            ('01 API Routes', [p for p in records[i] if p['path'].startswith('threatlens/app/api/')]),
            ('02 Authentication Services and Storage', [p for p in records[i] if p['path'] not in {
                r['path'] for r in records[i] if r['path'].startswith('threatlens/app/api/')}]),
        ]
    elif i == 0:
        segments = []
        for name, prefixes in [('01 Routes and Entry Points',('src/routes/','src/server','src/start','src/router')),
                               ('02 Components',('src/components/',)),
                               ('03 Data Clients and Styles',('src/hooks/','src/lib/','src/types/','src/styles.css','src/motion.css'))]:
            segments.append((name,[p for p in records[i] if p['path'].startswith(prefixes)]))
    else:
        segments = [(title, records[i])]
    assert {r['path'] for _, fs in segments for r in fs} == {r['path'] for r in records[i]}
    for name,files in segments:
        pages = paginate(files)
        for vol in range(0, len(pages), 110):
            subset = pages[vol:vol+110]
            file = f'{name}{f" Volume {vol//110+1:02d}" if len(pages)>110 else ""}.docx'
            doc = doc_template(True)
            doc.add_paragraph(name, 'Title')
            doc.add_paragraph(f'ThreatLens   /   Group G-14   /   Source revision {SHA}')
            doc.add_paragraph(desc)
            doc.add_paragraph('Each listing begins with its repository path. Line ranges refer to source lines. Long lines wrap for print, with an indent on the continuation. Environment templates list variable names and safe defaults only.')
            doc.add_heading('Files in this volume', 1)
            seen = set()
            for k,page in enumerate(subset,1):
                for item,rows in page:
                    p = item['path']
                    if p not in seen:
                        doc.add_paragraph(f'{k:03d}   {p}', 'Index Entry')
                        seen.add(p)
                    manifest['files'][p] = {'line_count':len(item['lines']),'form':item['form']}
            for page in subset:
                for block,(item,rows) in enumerate(page):
                    pr = doc.add_paragraph(item['path'],'Source File')
                    if block == 0:
                        pr.paragraph_format.page_break_before = True
                        pr.paragraph_format.space_before = Pt(0)
                    a,b = rows[0][0],rows[-1][0]
                    doc.add_paragraph(f'{item["form"]}  /  Lines {a} to {b} of {len(item["lines"])}' if a else 'Empty module file', 'Source Range')
                    p = doc.add_paragraph(style='Source Listing')
                    p.add_run('\n'.join(t for _,t in rows))
            dest = out/file
            doc.save(dest)
            manifest['volumes'][str(dest.relative_to(DEST))] = {'listing_pages':len(subset),'distinct_files':len(seen)}

assert len(manifest['files']) == sum(map(len,records.values()))

guide = doc_template()
guide.add_paragraph('ThreatLens Architecture and Source Code', 'Title')
guide.add_paragraph('Group G-14 · Project Submission')
guide.add_paragraph(NAMES + '\nProject guide: Prof. Pankaj Sonewane\nDepartment of Data Science, IoT and Cyber Security\nG. H. Raisoni College of Engineering, Nagpur')
guide.add_heading('Project architecture', 1)
guide.add_paragraph('ThreatLens helps a developer review security findings from an authorized project. The React and TanStack client opens a workspace audit. FastAPI checks the request, prepares the uploaded source, and makes scan progress available to the browser. PostgreSQL keeps the audit records, while private object storage holds eligible source previews. The Workbench brings saved findings beside the relevant, read-only source.')
guide.add_picture(str(ARCH), width=Inches(6.75))
guide.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
guide.add_paragraph('Figure 1. Browser, API, analysis services, private persistence, and the review workflow. Optional services depend on deployment configuration.')
guide.add_paragraph('Source revision: ' + SHA)
guide.add_page_break()
guide.add_heading('Source reading order', 1)
grid(guide,('Folder','Scope and reading order'),[(g[0],g[2]) for g in groups],(2.45,4.52))
guide.add_paragraph('Start with src/start.ts and the route files. Then read threatlens/app/main.py and the audit route handlers. Follow a saved result from the intake and analysis modules to the database migrations, Workbench, and report templates. The volume index and the path above each listing identify the corresponding source file.')
guide.add_heading('Database and source previews', 1)
guide.add_paragraph('The migrations define workspace membership, audits, findings, reports, and the access rules used for each. Source previews are kept apart from finding metadata and have their own retention policy. Optional tables support features such as Advisor history, extension reviews, and reviewed GitHub fixes.')
guide.add_heading('Configuration and scope', 1)
guide.add_paragraph('The environment volume covers frontend and backend variable names, ordinary defaults, and optional service settings. Deployment credentials belong in the deployment environment. The submission excludes real .env files, database dumps, account data, generated build output, dependency caches, and test fixtures.')
guide.add_paragraph(f'The code folder contains {len(manifest["files"])} source and configuration listings in {len(manifest["volumes"])} volumes.')
guide.add_page_break()
guide.add_heading('API and configuration index', 1)
grid(guide,('Operation','Where to read the implementation'),[
 ('Health and router startup','threatlens/app/main.py'),
 ('Session and workspace access','threatlens/app/api/auth.py, api/workspaces.py, app/auth/'),
 ('Scan intake, status, source and evidence','threatlens/app/api/audit_workbench.py and api/scans.py'),
 ('Findings and exports','threatlens/app/api/audit_workbench.py and api/export.py'),
 ('Reports and PDF preparation','threatlens/app/api/report_library.py, api/reports.py, and app/report/'),
 ('Advisor requests and saved history','threatlens/app/api/ai_chat.py and app/services/advisor_history.py'),
 ('Repository connections and reviewed fixes','threatlens/app/api/github_review.py and app/services/'),
 ('Chrome and Edge package review','threatlens/app/api/extension_reviews.py and app/scanners/extension_review.py'),
],(2.38,4.59))
guide.add_heading('Frontend and server environments', 2)
guide.add_paragraph('The browser uses the API URL, the Supabase project location, and the Supabase publishable key. A database connection string, service-role key, provider credential, and GitHub signing or encryption keys are server settings. Keep those values outside the frontend bundle and this submission.')
guide.add_paragraph('The standard ZIP workflow can be reviewed independently of optional model providers and repository publishing. The worker profile adds Celery and Redis. Retrieval-enabled configurations add a vector store. Check the environment template and installation documentation before choosing a profile.')
guide.save(DEST/'Code/00 ThreatLens Architecture and Code Index.docx')

(BUILD/'listing_manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'{len(manifest["files"])} files, {len(manifest["volumes"])} listing volumes, {sum(x["listing_pages"] for x in manifest["volumes"].values())} planned listing pages')
print('Original PDFs copied with matching SHA-256 hashes.')
