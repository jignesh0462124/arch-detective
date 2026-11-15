"""Deterministic thesis figures drawn from the checked-in implementation.

No image generation, invented UI, example performance or database writes.
SVG and PNG share the same drawing primitives and coordinates.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html
import math

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output'/'thesis-figures-20261112'
OUT.mkdir(parents=True,exist_ok=True)
INK='#202020';MUTED='#515151';EDGE='#777777';PALE='#F6F5F2';ORANGE='#C44A15'
FONT=Path('C:/Windows/Fonts/arial.ttf');BOLD=Path('C:/Windows/Fonts/arialbd.ttf')

class Figure:
    def __init__(self,w,h,title,subtitle):
        self.w=w;self.h=h;self.parts=[]
        self.im=Image.new('RGB',(w*2,h*2),'white');self.d=ImageDraw.Draw(self.im)
        self.text(70,55,title,46,True)
        self.text(70,117,subtitle,24,color=MUTED)
    def text(self,x,y,text,size=28,bold=False,color=INK):
        font=ImageFont.truetype(str(BOLD if bold else FONT),size*2)
        self.d.text((x*2,y*2),text,font=font,fill=color,anchor='lt')
        self.parts.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" font-family="Arial, Helvetica, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{html.escape(text)}</text>')
    def rect(self,x,y,w,h,fill='white',stroke=EDGE,r=10):
        self.d.rounded_rectangle((x*2,y*2,(x+w)*2,(y+h)*2),radius=r*2,fill=fill,outline=stroke,width=2)
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>')
    def line(self,points,color=EDGE,width=2,arrow=False):
        p=[(x*2,y*2)for x,y in points];self.d.line(p,fill=color,width=width*2)
        self.parts.append('<polyline points="'+' '.join(f'{x},{y}'for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="{width}"/>')
        if arrow:
            (x0,y0),(x,y)=points[-2:];angle=math.atan2(y-y0,x-x0)
            a=(x-13*math.cos(angle-.45),y-13*math.sin(angle-.45));b=(x-13*math.cos(angle+.45),y-13*math.sin(angle+.45))
            self.d.polygon([(x*2,y*2),(a[0]*2,a[1]*2),(b[0]*2,b[1]*2)],fill=color)
            self.parts.append(f'<polygon points="{x},{y} {a[0]},{a[1]} {b[0]},{b[1]}" fill="{color}"/>')
    def box(self,x,y,w,h,title,lines,number=None):
        self.rect(x,y,w,h,PALE)
        ty=y+24
        if number:
            self.text(x+22,ty,str(number).zfill(2),24,True,ORANGE);ty+=39
        titles=title if isinstance(title,list) else [title]
        for t in titles:self.text(x+22,ty,t,31,True);ty+=40
        ty+=12
        for line in lines:self.text(x+22,ty,line,25,color=MUTED);ty+=35
        assert ty<=y+h+10,(title,'box overflow',ty,y+h)
    def save(self,name):
        svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}"><rect width="100%" height="100%" fill="white"/>'+''.join(self.parts)+'</svg>'
        (OUT/(name+'.svg')).write_text(svg,encoding='utf-8')
        self.im.save(OUT/(name+'.png'),dpi=(300,300))
        print(name,self.im.size)

def workflow():
    f=Figure(1800,1110,'Research and Development Workflow','ThreatLens  |  engineering study and verification process')
    xs=[70,665,1260];ys=[205,640];w=470;h=275
    f.box(xs[0],ys[0],w,h,['Define the problem','and study boundaries'],['Developer review needs','Evidence, access and privacy'],1)
    f.box(xs[1],ys[0],w,h,['Review guidance','and requirements'],['Security checks and mappings','Roles and retention limits'],2)
    f.box(xs[2],ys[0],w,h,['Design architecture','and the data model'],['Browser, API and persistence','Scan and finding relationships'],3)
    f.box(xs[2],ys[1],w,h,['Implement scanning','and evidence review'],['Parallel source preparation','Read-only review workbench'],4)
    f.box(xs[1],ys[1],w,h,['Verify behaviour','with recorded tests'],['Archive and access checks','Interface, evidence and reports'],5)
    f.box(xs[0],ys[1],w,h,['Discuss findings','and document limits'],['Timing and evidence consistency','Separate verification from claims'],6)
    for x1,x2 in [(540,665),(1135,1260)]:f.line([(x1,343),(x2,343)],arrow=True)
    f.line([(1495,480),(1495,640)],arrow=True)
    for x1,x2 in [(1260,1135),(665,540)]:f.line([(x1,778),(x2,778)],arrow=True)
    f.text(70,1000,'Outputs: working prototype, traceable test evidence and thesis documentation.',28,True)
    f.text(70,1050,'This development workflow does not establish independently measured detection accuracy.',23,color=MUTED)
    f.save('figure-3-1-research-workflow')

def architecture():
    f=Figure(1900,1570,'Overall ThreatLens System Architecture','Core saved-ZIP Audit Workbench path  |  displayed application name: Archon')
    f.box(70,195,1760,170,'Web application',['React and TypeScript  |  project upload, findings, evidence graph, Security Advisor and reports','Monaco provides the read-only source viewer. Authenticated requests carry the current user session.'])
    f.line([(950,365),(950,465)],arrow=True);f.text(985,394,'HTTPS / authenticated API requests',25)
    f.box(70,465,1760,170,'FastAPI and workspace authorization',['JWT verification and current membership checks  |  bounded archive validation and scan acceptance','In-process audit orchestration, progress/status endpoints, source reads and on-demand report access'])
    for x in [345,950,1555]:f.line([(x,635),(x,745)],arrow=True)
    f.box(70,745,550,235,['Source preparation','and private previews'],['Build the file manifest','Redact and upload text previews','Publish available file windows'])
    f.box(675,745,550,235,['Static and model-assisted','security analysis'],['Run independent reviews in parallel','Merge and ground reported findings','Save evidence and control mappings'])
    f.box(1280,745,550,235,['Report and Advisor','services'],['Render saved audit content as PDF','Load authorised finding context','Keep suggestions separate from source'])
    f.rect(350,670,1020,42,'white','white',0)
    f.text(360,681,'Source preparation and analysis proceed concurrently.',26,True)
    f.line([(345,980),(345,1125)],arrow=True)
    f.line([(950,980),(950,1125)],arrow=True)
    f.line([(1555,980),(1555,1125)],arrow=True)
    f.line([(1160,980),(1160,1060),(1440,1060),(1440,1125)],arrow=True)
    f.text(1180,1027,'Model review',23,color=MUTED)
    f.box(70,1125,550,235,['Private source storage'],['Supabase private Storage objects','30-day source-preview window','Expiry and durable cleanup'])
    f.box(675,1125,550,235,['Audit metadata and results'],['PostgreSQL with scoped RLS','Scans, findings and source locations','Jobs, mappings and private chats'])
    f.box(1280,1125,550,235,['Configured model providers'],['Server-side credentials only','Bounded, redacted source context','Existing provider fallback'])
    f.text(70,1430,'Identity: Supabase Auth supplies sessions; the API verifies tokens and enforces workspace access.',25)
    f.text(70,1474,'Progressive opening is capability-gated. A scan is complete only after its results are saved.',25)
    f.text(70,1518,'Optional GitHub and separate worker/retrieval paths are omitted; they are not required for this ZIP path.',23,color=MUTED)
    f.save('figure-5-1-system-architecture')

def erd():
    f=Figure(1800,1740,'Core Audit Database Relationships','Selected tables and foreign keys from the project migrations  |  not a new schema')
    xs=[70,675,1280];ys=[245,765,1285];w=460;h=310
    def entity(col,row,title,fields):
        x=xs[col];y=ys[row];f.rect(x,y,w,h);f.rect(x,y,w,66,PALE)
        f.text(x+20,y+18,title,30,True)
        for i,line in enumerate(fields):f.text(x+20,y+88+i*40,line,27)
    entity(0,0,'auth.users',['PK  id','Identity managed by Supabase','Parent of workspace ownership','and workspace membership'])
    entity(1,0,'workspaces',['PK  id','FK  owner_user_id','name','slug'])
    entity(2,0,'workspace_members',['PK/FK  workspace_id','PK/FK  user_id','role','Composite primary key'])
    entity(0,1,'source_snapshots',['PK  id','FK/UQ  scan_id','state, revision','expires_at'])
    entity(1,1,'scans',['PK  id','FK  workspace_id','FK  created_by  (nullable)','status, target_name'])
    entity(2,1,'findings',['PK  id','FK  scan_id','severity, state','file_path, line_number'])
    entity(0,2,'snapshot_files',['PK  id','FK  snapshot_id','path, preview_state','object_path  (private pointer)'])
    entity(1,2,'finding_locations',['PK  id','FK  finding_id, snapshot_id','FK  file_id  (nullable)','line_number, match_status'])
    entity(2,2,'compliance_violations',['PK  id','FK  finding_id','framework, control_id','evidence'])
    def edge(points,label,pos):
        f.line(points,arrow=True);f.text(*pos,label,24,True,ORANGE)
    edge([(530,390),(675,390)],'1 : N',(550,350))
    edge([(1135,390),(1280,390)],'1 : N',(1154,350))
    edge([(300,245),(300,195),(1510,195),(1510,245)],'users join workspaces through membership',(555,160))
    edge([(905,555),(905,765)],'1 : N',(933,641))
    edge([(675,915),(530,915)],'1 : 0..1',(541,871))
    edge([(1135,915),(1280,915)],'1 : N',(1152,871))
    edge([(300,1075),(300,1285)],'1 : N',(328,1162))
    edge([(1510,1075),(1510,1285)],'1 : N',(1538,1162))
    edge([(530,1450),(675,1450)],'0..1 : N',(536,1400))
    edge([(1510,1075),(1510,1170),(905,1170),(905,1285)],'finding to locations  1 : N',(947,1128))
    edge([(530,995),(590,995),(590,1340),(675,1340)],'1 : N',(586,1210))
    f.text(70,1634,'PK = primary key   FK = foreign key   UQ = unique   N = zero or more child rows',25)
    f.text(70,1679,'Arrows run from referenced parent to child. Additional user, job, chat and integration relationships are omitted.',23,color=MUTED)
    f.save('figure-5-9-database-erd')

if __name__=='__main__':workflow();architecture();erd()
