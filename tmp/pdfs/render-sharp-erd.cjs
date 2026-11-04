const fs = require('fs');
const { instance } = require('C:/Users/20041/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@viz-js/viz');
const src = fs.readFileSync('docs/database-erd.md','utf8').replaceAll('\r','').split('```mermaid')[1].split('```')[0];
const esc = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let dot = `digraph ERD { graph [bgcolor="#111315", rankdir=TB, nodesep=0.85, ranksep=1.7, pad=0.5, splines=polyline, overlap=false, outputorder=edgesfirst]; node [shape=plain, fontname="Helvetica", fontsize=11]; edge [color="#4287a6", fontcolor="#d6e1e7", fontname="Helvetica", fontsize=9, style=dashed, arrowsize=0.65];\n`;
for (const match of src.matchAll(/^    (\w+) \{\n([\s\S]*?)^    \}/gm)) {
  const [,name,body]=match;
  let rows = `<TR><TD COLSPAN="3" BGCOLOR="#202c34"><FONT COLOR="#ffffff"><B>${name}</B></FONT></TD></TR>`;
  const fields = body.trim().split('\n').map(l=>l.trim());
  if(name!=='Counter' && !fields.some(l=>l.startsWith('ObjectId _id'))) fields.unshift('ObjectId _id PK');
  for(const field of fields) {
    const m=field.match(/^(\S+)\s+(\S+)(?:\s+([^"\s]+))?(?:\s+"(.*)")?$/);
    if(!m)throw Error(field);
    const [,type,name,key='',note='']=m;
    rows+=`<TR><TD ALIGN="LEFT"><FONT COLOR="#c8d9e2">${esc(type)}</FONT></TD><TD ALIGN="LEFT"><FONT COLOR="#ffffff">${esc(name)}</FONT></TD><TD ALIGN="LEFT"><FONT COLOR="#8fd1ed">${esc(key)}${note?' / '+esc(note):''}</FONT></TD></TR>`;
  }
  dot+=`${name} [label=<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6" COLOR="#4489a8" BGCOLOR="#151b20">${rows}</TABLE>>];\n`;
}
for(const m of src.matchAll(/^    (\w+) ([|o{}.]+) (\w+) : "([^"]+)"/gm)) {
  const [,a,card,b,label]=m;
  const parent=card.startsWith('o|')?'0..1':'1';
  const child=card.endsWith('o|')?'0..1':'0..*';
  dot+=`${a} -> ${b} [label="${label}", taillabel="${parent}", headlabel="${child}", dir=both, arrowtail=odot, arrowhead=vee, labeldistance=2.2];\n`;
}
dot+='}';
(async()=>{const viz=await instance(); fs.writeFileSync('tmp/pdfs/sharp-erd.json',viz.renderString(dot,{format:'json',engine:'neato'})); fs.writeFileSync('output/pdf/database-erd-sharp.svg',viz.renderString(dot,{format:'svg',engine:'neato'}));})();




