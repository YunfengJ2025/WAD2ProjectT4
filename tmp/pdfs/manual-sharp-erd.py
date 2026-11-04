exec(open('tmp/pdfs/export_erd.py').read().split("out = root")[0])
from reportlab.pdfbase.pdfmetrics import stringWidth
W,H=2200,2000
c=canvas.Canvas(str(root/'output/pdf/database-erd-sharp.pdf'),pagesize=(W,H))
c.setTitle('Database ERD - vector diagram')
bg=HexColor('#111315'); line=HexColor('#4083a2'); ink=HexColor('#e0e9ef')
c.setFillColor(bg);c.rect(0,0,W,H,fill=1,stroke=0)
positions={'User':(815,1510),'Counter':(1530,1720),
 'CareRequest':(70,1080),'Plant':(610,1080),'Post':(1150,1080),'Like':(1690,1080),
 'CareVisit':(70,590),'RequestItem':(610,590),'Review':(1150,590),'TokenTransaction':(1690,590),
 'PhotoProof':(70,95),'HealthCheck':(610,95),'Notification':(1690,95)}
bw=440;rh=17
boxes={}
for name,fields in entities.items():
    if name!='Counter' and not any('_id PK' in f for f in fields):fields.insert(0,'ObjectId _id PK')
    x,y=positions[name];boxes[name]=(x,y,bw,30+rh*len(fields))
counts={}
for i,(a,card,b,label) in enumerate(relations):
    ax,ay,aw,ah=boxes[a];bx,by,bw1,bh=boxes[b]
    if a==b:
        sx,sy=ax+aw,ay+ah*.7;ex,ey=ax+aw,ay+ah*.35
        controls=(sx+95,sy+80,ex+95,ey-80)
    elif abs(ay-by)<100:
        if ax<bx:sx,sy=ax+aw,ay+ah*.55;ex,ey=bx,by+bh*.55
        else:sx,sy=ax,ay+ah*.45;ex,ey=bx+bw1,by+bh*.45
        controls=((sx+ex)/2,sy,(sx+ex)/2,ey)
    elif ay>by:
        n=counts.get(a,0);counts[a]=n+1
        sx,sy=ax+30+(n*43)%(aw-60),ay
        ex,ey=bx+30+(i*31)%(bw1-60),by+bh
        controls=(sx,sy-75,ex,ey+75)
    else:
        sx,sy=ax+aw,ay+ah*.6;ex,ey=bx+bw1,by+bh*.3
        lane=max(sx,ex)+45+(i%4)*15
        controls=(lane,sy,lane,ey)
    c.setStrokeColor(line);c.setLineWidth(.8);c.setDash(3,5)
    p=c.beginPath();p.moveTo(sx,sy);p.curveTo(*controls,ex,ey);c.drawPath(p)
    c.setDash();c.setFillColor(ink);c.circle(sx,sy,2.3,fill=1,stroke=0);c.circle(ex,ey,2.3,fill=1,stroke=0)
    # Each reference has its field and multiplicity directly on the connector.
    t=.47;u=1-t
    lx=u**3*sx+3*u*u*t*controls[0]+3*u*t*t*controls[2]+t**3*ex
    ly=u**3*sy+3*u*u*t*controls[1]+3*u*t*t*controls[3]+t**3*ey
    field=re.search(r'\((.*?)\)',label)
    desc=(field.group(1) if field else label).replace(', optional','')
    txt=f'{desc}  [{"0..1" if card.startswith("o|") else "1"} : {"0..1" if card.endswith("o|") else "0..*"}]'
    c.setFont('Helvetica',8);tw=stringWidth(txt,'Helvetica',8)
    c.setFillColor(bg);c.rect(lx-tw/2-4,ly-3,tw+8,12,fill=1,stroke=0)
    c.setFillColor(ink);c.drawCentredString(lx,ly,txt)
for name,fields in entities.items():
    x,y,w,h=boxes[name]
    c.setDash();c.setStrokeColor(line);c.setLineWidth(1)
    c.setFillColor(HexColor('#161d22'));c.rect(x,y,w,h,fill=1,stroke=1)
    c.setFillColor(HexColor('#22323e'));c.rect(x,y+h-30,w,30,fill=1,stroke=1)
    c.setFillColor(ink);c.setFont('Helvetica-Bold',12);c.drawCentredString(x+w/2,y+h-20,name)
    for j,f in enumerate(fields):
        pieces=f.split(' "')[0].split();typ,field=pieces[:2];key=' '.join(pieces[2:])
        yy=y+h-30-(j+1)*rh
        c.line(x,yy,x+w,yy);c.line(x+100,yy,x+100,yy+rh);c.line(x+355,yy,x+355,yy+rh)
        c.setFont('Helvetica',10);c.setFillColor(ink);c.drawString(x+7,yy+5,typ);c.drawString(x+107,yy+5,field)
        c.setFillColor(HexColor('#8bd0ed'));c.drawString(x+362,yy+5,key)
c.setFillColor(ink);c.setFont('Helvetica-Bold',20);c.drawString(60,H-45,'DATABASE ERD')
c.setFont('Helvetica',11);c.drawString(60,H-67,'Current Mongoose schema | 13 collections | 04 Nov 2026')
c.setFont('Helvetica',10);c.drawString(60,49,'PK = MongoDB _id | UK = unique application key | FK = logical reference | 0..* = zero or many | Embedded objects and arrays remain in the parent document.')
c.drawString(60,31,'Review targets depend on type. One CARE transaction per visit. One HealthCheck per RequestItem. MongoDB does not enforce referential integrity.')
c.save()
print('Created vector ERD')
