from pathlib import Path
import re, math
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A3, landscape

root = Path(__file__).resolve().parents[2]
source = (root / 'docs/database-erd.md').read_text(encoding='utf-8')
diagram = source.split('```mermaid')[1].split('```')[0]
entities = {}
for name, body in re.findall(r'^    (\w+) \{\n(.*?)^    \}', diagram, re.M | re.S):
    entities[name] = [line.strip() for line in body.splitlines() if line.strip()]
relations = re.findall(r'^    (\w+) ([|o{}.]+) (\w+) : "([^"]+)"', diagram, re.M)
out = root / 'output/pdf/database-erd.pdf'
c = canvas.Canvas(str(out), pagesize=landscape(A3))
c.setTitle('WAD2 Project - Database Logical ER Diagram')
W,H = landscape(A3)
navy,green,muted = map(HexColor, ['#183346','#197564','#536779'])
def text(x,y,s,size=10,color=navy,font='Helvetica'):
    c.setFillColor(color); c.setFont(font,size); c.drawString(x,y,s)
def header(title,subtitle,page):
    c.setFillColor(HexColor('#f5f8fa')); c.rect(0,0,W,H,fill=1,stroke=0)
    text(38,H-44,title,24,font='Helvetica-Bold'); text(38,H-66,subtitle,10,muted)
    text(38,23,'WAD2 Project | Code-defined Mongoose schema | 04 Nov 2026',9,muted)
    text(W-85,23,f'{page} / 5',9,muted)
def box(name,x,y,w=185,h=66,detail=None):
    c.setFillColor(white); c.setStrokeColor(green); c.setLineWidth(1)
    c.roundRect(x,y,w,h,7,fill=1,stroke=1)
    text(x+12,y+h-23,name,13,font='Helvetica-Bold')
    text(x+12,y+15,detail or next((f.split(' UK')[0] for f in entities[name] if ' UK' in f), '_id: primary key'),9,muted)
def arrow(a,b,label):
    x,y=a; X,Y=b
    c.setStrokeColor(muted); c.setLineWidth(.8); c.line(x,y,X,Y)
    ang=math.atan2(Y-y,X-x)
    for d in [-.45,.45]: c.line(X,Y,X-7*math.cos(ang+d),Y-7*math.sin(ang+d))
    if label:
        mx,my=(x+X)/2,(y+Y)/2
        width=c.stringWidth(label,'Helvetica',8)+8
        c.setFillColor(HexColor('#f5f8fa')); c.rect(mx-width/2,my-3,width,13,fill=1,stroke=0)
        text(mx-width/2+4,my,label,8)

header('Database logical ER diagram','Overview: principal links. Complete reference cardinalities are listed on page 5.',1)
pos={'User':(45,620),'Plant':(340,620),'CareRequest':(635,620),'CareVisit':(930,620),
     'Post':(45,405),'Like':(340,405),'Review':(635,405),'RequestItem':(930,405),
     'Notification':(45,190),'TokenTransaction':(340,190),'HealthCheck':(635,190),'PhotoProof':(930,190),
     'Counter':(45,85)}
def bottom(n):
    x,y=pos[n]; return x+92.5,y
def top(n):
    x,y=pos[n]; return x+92.5,y+66
def right(n):
    x,y=pos[n]; return x+185,y+33
def left(n):
    x,y=pos[n]; return x,y+33
for a,b,l in [('User','Plant','1 : many'),('Plant','CareRequest',''),('CareRequest','CareVisit','1 : many'),('Post','Like','1 : many'),('Review','RequestItem',''),('Notification','TokenTransaction',''),('HealthCheck','PhotoProof','')]:
    if l: arrow(right(a),left(b),l)
for a,b,l in [('User','Post','1 : many'),('CareVisit','RequestItem','1 : many'),('RequestItem','PhotoProof','1 : many')]: arrow(bottom(a),top(b),l)
arrow((right('Plant')[0]-30,620),(top('RequestItem')[0]-30,471),'plantId')
# Dashed or indirect links are detailed in the full relationship register rather than implied here.
for name,(x,y) in pos.items(): box(name,x,y)
text(270,120,'Counter generates numeric application IDs; it has no foreign-key relationship.',11,muted)
text(270,98,'All collections use MongoDB _id. Numeric IDs shown here are unique application keys.',10,muted)
text(270,77,'Use the complete relationship register on page 5 for optional links, roles and conditional targets.',10,muted)
c.showPage()

groups=[('Accounts and community',['User','Post','Like','Review','Notification']),
        ('Plant care and scheduling',['Plant','CareRequest','CareVisit','RequestItem']),
        ('Evidence, health and token ledger',['PhotoProof','HealthCheck','TokenTransaction','Counter'])]
for page,(title,names) in enumerate(groups,2):
    header(title,'Full model attributes | UK = unique key | FK = logical reference | PK = physical primary key',page)
    cols=3; bw=(W-100)/3; gap=14
    for i,name in enumerate(names):
        col=i%3; row=i//3; x=38+col*(bw+gap); topy=H-100-row*350
        lines=entities[name]; bh=44+len(lines)*14
        c.setFillColor(white);c.setStrokeColor(HexColor('#cad7df'));c.roundRect(x,topy-bh,bw,bh,5,fill=1,stroke=1)
        text(x+12,topy-24,name,15,green,'Helvetica-Bold')
        for j,line in enumerate(lines):
            # Field name, type and key markers stay visible; long inline explanations move to notes.
            line=line.split(' "')[0]
            text(x+12,topy-46-j*14,line,9)
    text(38,66,'Except Counter, every model also has an ObjectId _id; version metadata is omitted.',10,muted)
    text(38,49,'Embedded arrays/objects remain inside their parent document. Refer to the source ERD for embedded field details.',10,muted)
    c.showPage()

header('Complete relationship register','Each row gives the referenced parent and the stored reference on the child. Links are application-level.',5)
text(38,H-100,'PARENT',9,green,'Helvetica-Bold');text(220,H-100,'CHILD / REFERENCE',9,green,'Helvetica-Bold');text(660,H-100,'CARDINALITY / ROLE',9,green,'Helvetica-Bold')
for i,(a,card,b,label) in enumerate(relations):
    y=H-123-i*19
    if i%2==0:
        c.setFillColor(HexColor('#eaf0f3'));c.rect(34,y-5,W-70,18,fill=1,stroke=0)
    parent='0..1' if card.startswith('o|') else '1'
    child='0..1' if card.endswith('o|') else '0..many'
    text(38,y,a,9);text(220,y,f'{b} / {label}',9);text(660,y,f'{parent} parent per child; {child} children per parent',9)
notes=[
    'Review: exactly one target matches type VISIT, POST or REVIEW. A VISIT review requires rating 1-5.',
    'Unique compound keys: Like (creatorId, postId); Review (creatorId, visitId) only when visitId is numeric.',
    'HealthCheck.requestItemId is unique; PhotoProof.requestItemId is not. One make-up request per referenced visit.',
    'TokenTransaction: at most one CARE transaction per visit; other transaction types can also reference that visit.',
    'Embedded: User.tokenReservations[] = requestId + amount; badges[] = id, name, description, icon, unlockedAt.',
    'Plant.wateringInfo = frequencyDays, amountMl, notes. HealthCheck.issues[] embeds diagnosis and treatment arrays.',
    'TokenTransaction.visitId declares ref "Visit" in code; the intended target is the CareVisit model.',
    'Source: server/models/*.js. Based on schema code, not inspection of a running database.'
]
for i,line in enumerate(notes): text(38,153-i*14,line,9,muted)
c.save()
print(out)
