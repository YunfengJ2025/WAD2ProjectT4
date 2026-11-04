import json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

data=json.loads(Path('tmp/pdfs/sharp-erd.json').read_text())
x0,y0,w,h=map(float,data['bb'].split(','))
footer=65
c=canvas.Canvas('output/pdf/database-erd-sharp.pdf',pagesize=(w,h+footer))
c.setTitle('Database ERD - current Mongoose schema')
c.setFillColor(HexColor('#111315'));c.rect(0,0,w,h+footer,fill=1,stroke=0)
c.saveState();c.translate(0,footer)
def draw(ops):
    for op in ops:
        k=op['op']
        if k=='c': c.setStrokeColor(HexColor(op['color'][:7]))
        elif k=='C': c.setFillColor(HexColor(op['color'][:7]))
        elif k=='F': c.setFont('Helvetica',op['size'])
        elif k=='S':
            style=op['style']
            if style=='dashed':c.setDash(4,4)
            elif style=='solid':c.setDash()
            elif style.startswith('setlinewidth'):c.setLineWidth(float(style.split('(')[1].split(')')[0]))
        elif k=='T':
            x,y=op['pt'];s=op['text'];align=op.get('align','c')
            if align=='c':c.drawCentredString(x,y,s)
            elif align=='r':c.drawRightString(x,y,s)
            else:c.drawString(x,y,s)
        elif k in ('P','p','L','b','B'):
            pts=op['points'];p=c.beginPath();p.moveTo(*pts[0])
            if k in ('b','B'):
                for i in range(1,len(pts),3): p.curveTo(*(pts[i]+pts[i+1]+pts[i+2]))
            else:
                for pt in pts[1:]:p.lineTo(*pt)
            if k in ('P','p'):p.close()
            c.drawPath(p,stroke=1,fill=int(k in ('P','b')))
        elif k in ('e','E'):
            x,y,rx,ry=op['rect'];c.ellipse(x-rx,y-ry,x+rx,y+ry,stroke=1,fill=int(k=='E'))
for edge in data.get('edges',[]):
    c.saveState()
    for key in ('_draw_','_hdraw_','_tdraw_','_ldraw_','_hldraw_','_tldraw_'):draw(edge.get(key,[]))
    c.restoreState()
for node in data.get('objects',[]):
    c.saveState();draw(node.get('_draw_',[]));draw(node.get('_ldraw_',[]));c.restoreState()
c.restoreState()
c.setFillColor(HexColor('#d6e1e7'));c.setFont('Helvetica',12)
c.drawString(30,43,'LOGICAL ERD | 13 Mongoose models | 04 Nov 2026')
c.setFont('Helvetica',10)
c.drawString(30,25,'PK: MongoDB _id | UK: unique application key | FK: logical reference | 0..*: zero or many | References are not database-enforced foreign keys.')
c.save()
print(f'Vector PDF dimensions: {w:.0f} x {h+footer:.0f} pt')
