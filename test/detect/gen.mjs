/* Synthetic floor plans with ground truth, in the drawing styles the detector meets in practice.
   node test/detect/gen.mjs            -> test/detect/synth/<layout>-<style>.{png|pdf} + .json truth
   Plan units are mm, y down. Styles:
     cad     double-line walls, white interior, hatch on external walls, grid bubbles, dimension strings, text, furniture (PDF at 1:100 on A1, and PNG)
     solid   estate-agent style: solid black walls, swings, thin window lines, labels
     grey    marketing style: mid-grey walls, light furniture
     hatch   all walls hatched between hairline faces
     single  single-line sketch, no wall thickness
     scan    the cad PNG rotated 1.3 deg, blurred, noisy, JPEG (made by degrade.py)
*/
import fs from 'fs';import path from 'path';import {createRequire} from 'module';
const require=createRequire(process.env.SB_TOOLS||(fs.existsSync('/opt/npm-tools/node_modules')?'/opt/npm-tools/':new URL('../../',import.meta.url).pathname));const {chromium}=require('playwright');
const OUT=path.join(path.dirname(new URL(import.meta.url).pathname),'synth');fs.mkdirSync(OUT,{recursive:true});

/* ---------- layouts: rooms in centreline coordinates ---------- */
const LAYOUTS={
  office:{ext:300,int:100,W:24000,H:12000,
    rooms:[['Office 1',0,0,4800,5000],['Office 2',4800,0,9600,5000],['Meeting',9600,0,14400,5000],['Office 3',14400,0,19200,5000],['Store',19200,0,24000,5000],
      ['Corridor',0,5000,24000,7000],
      ['Open office',0,7000,6000,12000],['Open office 2',6000,7000,12000,12000],['Pantry',12000,7000,16000,12000],['WC M',16000,7000,20000,12000],['WC F',20000,7000,24000,12000]],
    /* doors: [room, side, offset from the side's start (mm), width, hinge 'lo'|'hi', swing 'in'|'out'] side: n,s,e,w (edge of that room) */
    doors:[['Office 1','s',600,900,'lo','in'],['Office 2','s',600,900,'lo','in'],['Meeting','s',1500,1800,'lo','in'],['Office 3','s',600,900,'hi','in'],['Store','s',900,900,'lo','in'],
      ['Open office','n',800,1000,'lo','in'],['Open office 2','n',800,1000,'hi','in'],['Pantry','n',600,900,'lo','in'],['WC M','n',600,900,'lo','in'],['WC F','n',600,900,'hi','in'],
      ['Corridor','w',100,1800,'lo','out'],['Corridor','e',500,1000,'lo','out']],
    windows:[['Office 1','n',1500,1800],['Office 2','n',1500,1800],['Meeting','n',1200,2400],['Office 3','n',1500,1800],['Store','n',1800,1200],['Office 1','w',1000,1500],['Store','e',1000,1500],
      ['Open office','s',500,2000,],['Open office','s',3500,2000],['Open office 2','s',500,2000],['Open office 2','s',3500,2000],['Pantry','s',1000,1800],['WC M','s',1600,800],['WC F','s',1600,800]],
    cols:[[3000,9500,400,400],[9000,9500,400,400],[14000,9500,400,400,true]],
    furn:{'Office 1':'desk','Office 2':'desk','Office 3':'desk','Meeting':'table','Open office':'desks','Open office 2':'desks','Pantry':'pantry','WC M':'wc','WC F':'wc'}},
  flat:{ext:200,int:100,W:12000,H:9000,
    rooms:[['Living',0,0,7000,5000],['Kitchen',7000,0,12000,5000],['Bed 1',0,5000,4500,9000],['Hall',4500,5000,7000,7000],['Bath',4500,7000,7000,9000],['Bed 2',7000,5000,12000,9000]],
    merge:[['Living','Hall']],
    doors:[['Kitchen','w',1000,900,'lo','in'],['Bed 1','e',500,900,'lo','in'],['Bath','n',400,800,'lo','in'],['Bed 2','w',500,900,'lo','in'],['Living','w',3500,1000,'hi','in']],
    windows:[['Living','n',1000,1800],['Living','n',4200,1800],['Kitchen','n',1500,1500],['Bed 1','s',1500,1500],['Bed 2','s',1800,1500],['Bed 2','e',1200,1200],['Bath','s',900,600]],
    cols:[],furn:{'Living':'sofa','Kitchen':'kitchen','Bed 1':'bed','Bed 2':'bed','Bath':'bath'}},
  small:{ext:230,int:115,W:9000,H:6000,
    rooms:[['Room A',0,0,4500,6000],['Room B',4500,0,9000,3000],['Room C',4500,3000,9000,6000]],
    doors:[['Room B','w',600,900,'lo','in'],['Room C','w',600,900,'hi','in'],['Room A','w',2500,1000,'lo','in']],
    windows:[['Room A','n',1500,1500],['Room B','n',1500,1500],['Room C','s',1500,1500],['Room B','e',900,1200]],
    cols:[],furn:{'Room A':'desk','Room B':'desk'}},
};

/* ---------- build walls, openings and truth from a layout ---------- */
function build(L){
  const R=L.rooms.map(([name,x0,y0,x1,y1])=>({name,x0,y0,x1,y1}));
  const byName=Object.fromEntries(R.map(r=>[r.name,r]));
  /* every room edge; shared edges become one interior wall, outer edges external */
  const edges=new Map();const key=(o,c,a,b)=>`${o}:${c}:${a}:${b}`;
  const addEdge=(o,c,a,b,room,side)=>{const k=key(o,c,a,b);if(!edges.has(k))edges.set(k,{o,c,a,b,rooms:[]});edges.get(k).rooms.push([room,side])};
  R.forEach(r=>{addEdge('h',r.y0,r.x0,r.x1,r,'n');addEdge('h',r.y1,r.x0,r.x1,r,'s');addEdge('v',r.x0,r.y0,r.y1,r,'w');addEdge('v',r.x1,r.y0,r.y1,r,'e')});
  /* split edges so that a long edge against two short rooms becomes pieces (shared pieces found by overlap) */
  const segs=[];
  const Hs=[...edges.values()].filter(e=>e.o==='h'),Vs=[...edges.values()].filter(e=>e.o==='v');
  const cutAt=(list)=>{const out=[];list.forEach(e=>{const cuts=new Set([e.a,e.b]);list.forEach(f=>{if(f===e||f.c!==e.c)return;[f.a,f.b].forEach(v=>{if(v>e.a&&v<e.b)cuts.add(v)})});const vs=[...cuts].sort((p,q)=>p-q);for(let i=0;i<vs.length-1;i++)out.push({o:e.o,c:e.c,a:vs[i],b:vs[i+1],rooms:e.rooms.slice()})});return out};
  const merged=new Map();cutAt(Hs).concat(cutAt(Vs)).forEach(s=>{const k=key(s.o,s.c,s.a,s.b);if(!merged.has(k))merged.set(k,s);else merged.get(k).rooms.push(...s.rooms)});
  const mergeSet=new Set((L.merge||[]).map(([p,q])=>[p,q].sort().join('|')));
  const walls=[];merged.forEach(s=>{const names=[...new Set(s.rooms.map(([r])=>r.name))];
    if(names.length===2&&mergeSet.has(names.slice().sort().join('|')))return; /* no wall between merged rooms */
    const ext=names.length===1;walls.push({o:s.o,c:s.c,a:s.a,b:s.b,t:ext?L.ext:L.int,ext,rooms:s.rooms})});
  /* openings on a room side at an offset from the side's start (west or north end) */
  const sideWall=(room,side,off,w)=>{const r=byName[room];const o=side==='n'||side==='s'?'h':'v';const c=side==='n'?r.y0:side==='s'?r.y1:side==='w'?r.x0:r.x1;const start=o==='h'?r.x0:r.y0;const p0=start+off,p1=p0+w;
    const wall=walls.find(q=>q.o===o&&q.c===c&&q.a<=p0+1&&q.b>=p1-1);if(!wall)throw new Error(`no wall for ${room} ${side} ${off}`);return{wall,p0,p1,r,o,c}};
  const doors=(L.doors||[]).map(([room,side,off,w,hinge,swing])=>{const s=sideWall(room,side,off,w);
    /* swing direction: into the room is away from the wall towards the room's interior */
    const inward=s.o==='h'?(side==='n'?1:-1):(side==='w'?1:-1);const dirN=swing==='in'?inward:-inward;const n=s.o==='h'?[0,dirN]:[dirN,0];
    const hingeP=hinge==='lo'?s.p0:s.p1;const hp=s.o==='h'?[hingeP,s.c]:[s.c,hingeP];
    return{o:s.o,c:s.c,p0:s.p0,p1:s.p1,w,t:s.wall.t,n,hinge:hp,dbl:w>=1500,cx:s.o==='h'?(s.p0+s.p1)/2:s.c,cy:s.o==='h'?s.c:(s.p0+s.p1)/2}});
  const windows=(L.windows||[]).map(([room,side,off,w])=>{const s=sideWall(room,side,off,w);return{o:s.o,c:s.c,p0:s.p0,p1:s.p1,w,t:s.wall.t,cx:s.o==='h'?(s.p0+s.p1)/2:s.c,cy:s.o==='h'?s.c:(s.p0+s.p1)/2}});
  /* truth rooms: the room rectangle(s) minus the wall mass, traced on a 10 mm raster (merged rooms become one polygon) */
  const used=new Set();const rooms=[];
  (L.merge||[]).forEach(([p,q])=>{used.add(p);used.add(q);rooms.push({name:p,pts:innerPoly([byName[p],byName[q]],walls)})});
  R.forEach(r=>{if(used.has(r.name))return;rooms.push({name:r.name,pts:innerPoly([r],walls)})});
  return{walls,doors,windows,rooms,R,byName,cols:(L.cols||[]).map(([x,y,w,d,round])=>({x,y,w,d,round:!!round}))};
}
function innerPoly(rects,walls){const g=10;const x0=Math.min(...rects.map(r=>r.x0))-500,y0=Math.min(...rects.map(r=>r.y0))-500,x1=Math.max(...rects.map(r=>r.x1))+500,y1=Math.max(...rects.map(r=>r.y1))+500;
  const GW=Math.round((x1-x0)/g),GH=Math.round((y1-y0)/g);const grid=new Uint8Array(GW*GH);
  const fill=(ax,ay,bx,by,v)=>{const i0=Math.max(0,Math.round((ax-x0)/g)),i1=Math.min(GW,Math.round((bx-x0)/g)),j0=Math.max(0,Math.round((ay-y0)/g)),j1=Math.min(GH,Math.round((by-y0)/g));for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++)grid[j*GW+i]=v};
  rects.forEach(r=>fill(r.x0,r.y0,r.x1,r.y1,1));
  walls.forEach(w=>{const h=w.t/2;if(w.o==='h')fill(w.a-h,w.c-h,w.b+h,w.c+h,0);else fill(w.c-h,w.a-h,w.c+h,w.b+h,0)});
  const loops=traceGrid(grid,GW,GH);const best=loops.sort((p,q)=>Math.abs(area(q))-Math.abs(area(p)))[0];return best.map(([i,j])=>[x0+i*g,y0+j*g])}
function area(p){let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1]}return a/2}
/* boundary loops of the filled cells of a grid, as grid-corner coordinates, collinear points dropped */
function traceGrid(grid,GW,GH){const VW=GW+1;const out=new Map();const add=(x0,y0,x1,y1)=>{const k=y0*VW+x0;let a=out.get(k);if(!a){a=[];out.set(k,a)}a.push(y1*VW+x1)};
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=j*GW+i;if(!grid[k])continue;if(j===0||!grid[k-GW])add(i,j,i+1,j);if(i===GW-1||!grid[k+1])add(i+1,j,i+1,j+1);if(j===GH-1||!grid[k+GW])add(i+1,j+1,i,j+1);if(i===0||!grid[k-1])add(i,j+1,i,j)}
  const loops=[];while(out.size){const start=out.keys().next().value;let cur=start;const loop=[];let n=0;do{loop.push([cur%VW,(cur/VW)|0]);const arr=out.get(cur);if(!arr)break;
      /* prefer turning so that holes and touching corners separate cleanly: take the last added edge */
      const nx=arr.pop();if(!arr.length)out.delete(cur);cur=nx}while(cur!==start&&n++<1e7);loops.push(dropCollinear(loop))}
  return loops}
function dropCollinear(p){let ch=true;while(ch&&p.length>3){ch=false;for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];if((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])===0){p.splice(i,1);ch=true;break}}}return p}

/* ---------- ink: the wall mass as a raster union, openings cut out, traced to paths ---------- */
function wallPaths(M,{cutWindows=true,cutDoors=true}={}){
  const g=10;const pad=1000;const x0=-pad,y0=-pad;const GW=Math.ceil((M.W+2*pad)/g),GH=Math.ceil((M.H+2*pad)/g);const grid=new Uint8Array(GW*GH);
  const fill=(ax,ay,bx,by,v)=>{const i0=Math.max(0,Math.round((ax-x0)/g)),i1=Math.min(GW,Math.round((bx-x0)/g)),j0=Math.max(0,Math.round((ay-y0)/g)),j1=Math.min(GH,Math.round((by-y0)/g));for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++)grid[j*GW+i]=v};
  M.walls.forEach(w=>{const h=w.t/2;/* extend ends by half the own thickness so corners and tees close without poking through */const e=h;
    if(w.o==='h')fill(w.a-e,w.c-h,w.b+e,w.c+h,1);else fill(w.c-h,w.a-e,w.c+h,w.b+e,1)});
  /* trim the extensions that poke outside the building: re-cut anything beyond the external envelope */
  const env={x0:0,y0:0,x1:M.W,y1:M.H};const E=M.ext/2;fill(x0,y0,M.W+pad,env.y0-E,0);fill(x0,env.y1+E,M.W+pad,M.H+pad,0);fill(x0,y0,env.x0-E,M.H+pad,0);fill(env.x1+E,y0,M.W+pad,M.H+pad,0);
  const cut=o=>{const h=o.t/2+1;if(o.o==='h')fill(o.p0,o.c-h,o.p1,o.c+h,0);else fill(o.c-h,o.p0,o.c+h,o.p1,0)};
  if(cutDoors)M.doors.forEach(cut);if(cutWindows)M.windows.forEach(cut);
  const loops=traceGrid(grid,GW,GH);return loops.map(l=>l.map(([i,j])=>[x0+i*g,y0+j*g]))}
const pathD=loops=>loops.map(l=>'M'+l.map(p=>p[0]+' '+p[1]).join('L')+'Z').join('');

/* ---------- furniture and symbols ---------- */
function furniture(M,style){const s=[];const pen=style==='grey'?'#9a9a9a':'#000';const sw=style==='solid'?12:10;
  const rect=(x,y,w,h,extra='')=>s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${pen}" stroke-width="${sw}" ${extra}/>`);
  const circ=(x,y,r)=>s.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${pen}" stroke-width="${sw}"/>`);
  const desk=(x,y)=>{rect(x,y,1400,700);circ(x+700,y+1100,250)};
  Object.entries(M.furn||{}).forEach(([name,kind])=>{const r=M.rooms.find(q=>q.name===name);if(!r)return;const xs=r.pts.map(p=>p[0]),ys=r.pts.map(p=>p[1]);const x0=Math.min(...xs),y0=Math.min(...ys),x1=Math.max(...xs),y1=Math.max(...ys);
    if(kind==='desk')desk(x0+600,y0+800);
    else if(kind==='desks'){for(let i=0;i<2;i++)for(let j=0;j<2;j++)desk(x0+500+i*2000,y0+600+j*1900)}
    else if(kind==='table'){rect(x0+1200,y0+1500,2400,1200);for(let i=0;i<3;i++){circ(x0+1600+i*800,y0+1150,220);circ(x0+1600+i*800,y0+3050,220)}}
    else if(kind==='pantry'){rect(x0+100,y0+100,600,x1-x0-200);circ(x0+400,y0+1200,200)}
    else if(kind==='wc'){rect(x0+200,y0+200,700,500);circ(x0+550,y0+1100,220);rect(x0+1500,y0+200,900,600)}
    else if(kind==='sofa'){rect(x0+800,y0+800,2200,900);rect(x0+800,y0+2200,1200,600);circ(x0+4000,y0+2000,600)}
    else if(kind==='kitchen'){rect(x0+100,y0+100,x1-x0-200,600);circ(x0+1500,y0+400,200);circ(x0+1900,y0+400,200)}
    else if(kind==='bed'){rect(x0+600,y0+500,1800,2000);rect(x0+600,y0+500,1800,400)}
    else if(kind==='bath'){rect(x0+150,y0+150,1700,750);circ(x1-500,y1-500,220)}});
  return s.join('')}
function doorSymbols(M,style){const pen=style==='grey'?'#777':'#000';const sw=style==='single'?25:style==='cad'?18:20;
  return M.doors.map(d=>{const u=d.o==='h'?[1,0]:[0,1];const hingeAtLo=d.hinge[0]===(d.o==='h'?d.p0:d.c)&&d.hinge[1]===(d.o==='h'?d.c:d.p0);const dir=hingeAtLo?u:[-u[0],-u[1]];
    /* leaf from the hinge perpendicular into the swing side, arc back to the far jamb */
    const leaf=d.dbl?d.w/2:d.w;const H=d.hinge;const n=d.n;const faceOff=style==='single'?0:0; /* hinge on the centreline */
    const one=(hx,hy,dx,dy)=>{const tip=[hx+n[0]*leaf,hy+n[1]*leaf];const far=[hx+dx*leaf,hy+dy*leaf];const sweep=(n[0]*dy-n[1]*dx)>0?1:0;
      return `<line x1="${hx}" y1="${hy}" x2="${tip[0]}" y2="${tip[1]}" stroke="${pen}" stroke-width="${sw}"/><path d="M${tip[0]} ${tip[1]} A${leaf} ${leaf} 0 0 ${sweep} ${far[0]} ${far[1]}" fill="none" stroke="${pen}" stroke-width="${sw*0.8}"/>`};
    if(!d.dbl)return one(H[0],H[1],dir[0],dir[1]);
    const A=d.o==='h'?[d.p0,d.c]:[d.c,d.p0],B=d.o==='h'?[d.p1,d.c]:[d.c,d.p1];return one(A[0],A[1],u[0],u[1])+one(B[0],B[1],-u[0],-u[1])}).join('')}
function windowSymbols(M,style){const pen=style==='grey'?'#777':'#000';
  return M.windows.map(w=>{const h=w.t/2;const L=(a,b,c,d,sw)=>`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${pen}" stroke-width="${sw}"/>`;
    const face=style==='solid'?14:18,glass=style==='solid'?14:12;
    if(w.o==='h'){let s=L(w.p0,w.c-h,w.p1,w.c-h,face)+L(w.p0,w.c+h,w.p1,w.c+h,face);if(style==='cad'||style==='hatch')s+=L(w.p0,w.c-h/3,w.p1,w.c-h/3,glass)+L(w.p0,w.c+h/3,w.p1,w.c+h/3,glass);else s+=L(w.p0,w.c,w.p1,w.c,glass);return s}
    let s=L(w.c-h,w.p0,w.c-h,w.p1,face)+L(w.c+h,w.p0,w.c+h,w.p1,face);if(style==='cad'||style==='hatch')s+=L(w.c-h/3,w.p0,w.c-h/3,w.p1,glass)+L(w.c+h/3,w.p0,w.c+h/3,w.p1,glass);else s+=L(w.c,w.p0,w.c,w.p1,glass);return s}).join('')}
function columnSymbols(M,style){return M.cols.map(c=>c.round?`<circle cx="${c.x}" cy="${c.y}" r="${c.w/2}" fill="${style==='grey'?'#9a9a9a':'#000'}"/>`:`<rect x="${c.x-c.w/2}" y="${c.y-c.d/2}" width="${c.w}" height="${c.d}" fill="${style==='grey'?'#9a9a9a':'#000'}"/>`).join('')}
function labels(M,style){const fs=style==='cad'?250:320;return M.rooms.map(r=>{const xs=r.pts.map(p=>p[0]),ys=r.pts.map(p=>p[1]);const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;const a=Math.abs(area(r.pts))/1e6;
    return `<text x="${cx}" y="${cy}" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" text-anchor="middle" fill="${style==='grey'?'#555':'#000'}">${r.name}</text><text x="${cx}" y="${cy+fs*1.2}" font-family="Arial, Helvetica, sans-serif" font-size="${fs*0.8}" text-anchor="middle" fill="${style==='grey'?'#777':'#000'}">${a.toFixed(1)} m²</text>`}).join('')}
/* grid bubbles and dimension strings, cad only */
function annotations(M){const s=[];const pen='#000';const xs=[...new Set(M.R.flatMap(r=>[r.x0,r.x1]))].sort((a,b)=>a-b),ys=[...new Set(M.R.flatMap(r=>[r.y0,r.y1]))].sort((a,b)=>a-b);
  const off=1800,bub=350;
  xs.forEach((x,i)=>{s.push(`<line x1="${x}" y1="${-off}" x2="${x}" y2="${M.H+off}" stroke="${pen}" stroke-width="10" stroke-dasharray="400 150 60 150"/>`);s.push(`<circle cx="${x}" cy="${-off-bub}" r="${bub}" fill="#fff" stroke="${pen}" stroke-width="18"/><text x="${x}" y="${-off-bub+110}" font-family="Arial" font-size="300" text-anchor="middle">${String.fromCharCode(65+i)}</text>`)});
  ys.forEach((y,i)=>{s.push(`<line x1="${-off}" y1="${y}" x2="${M.W+off}" y2="${y}" stroke="${pen}" stroke-width="10" stroke-dasharray="400 150 60 150"/>`);s.push(`<circle cx="${-off-bub}" cy="${y}" r="${bub}" fill="#fff" stroke="${pen}" stroke-width="18"/><text x="${-off-bub}" y="${y+110}" font-family="Arial" font-size="300" text-anchor="middle">${i+1}</text>`)});
  /* dimension strings: along the top between gridlines and overall, and down the right */
  const dim=(a,b,y,txt,vert)=>{if(!vert){s.push(`<line x1="${a}" y1="${y}" x2="${b}" y2="${y}" stroke="${pen}" stroke-width="12"/>`);[a,b].forEach(x=>s.push(`<line x1="${x-80}" y1="${y+80}" x2="${x+80}" y2="${y-80}" stroke="${pen}" stroke-width="20"/><line x1="${x}" y1="${y-150}" x2="${x}" y2="${y+150}" stroke="${pen}" stroke-width="10"/>`));s.push(`<text x="${(a+b)/2}" y="${y-80}" font-family="Arial" font-size="220" text-anchor="middle">${txt}</text>`)}
    else{s.push(`<line x1="${y}" y1="${a}" x2="${y}" y2="${b}" stroke="${pen}" stroke-width="12"/>`);[a,b].forEach(v=>s.push(`<line x1="${y-80}" y1="${v+80}" x2="${y+80}" y2="${v-80}" stroke="${pen}" stroke-width="20"/><line x1="${y-150}" y1="${v}" x2="${y+150}" y2="${v}" stroke="${pen}" stroke-width="10"/>`));s.push(`<text x="${y+100}" y="${(a+b)/2}" font-family="Arial" font-size="220" text-anchor="middle" transform="rotate(-90 ${y+100} ${(a+b)/2})">${txt}</text>`)}};
  for(let i=0;i<xs.length-1;i++)dim(xs[i],xs[i+1],M.H+off*0.6,String(xs[i+1]-xs[i]));dim(xs[0],xs[xs.length-1],M.H+off*0.95,String(M.W));
  for(let i=0;i<ys.length-1;i++)dim(ys[i],ys[i+1],M.W+off*0.6,String(ys[i+1]-ys[i]),true);dim(ys[0],ys[ys.length-1],M.W+off*0.95,String(M.H),true);
  /* north arrow and a note */
  s.push(`<g transform="translate(${M.W+off*1.6} ${-off})"><circle r="500" fill="none" stroke="${pen}" stroke-width="18"/><path d="M0 -420 L140 160 L0 60 L-140 160Z" fill="${pen}"/><text y="-560" font-family="Arial" font-size="260" text-anchor="middle">N</text></g>`);
  s.push(`<text x="0" y="${M.H+off*1.6}" font-family="Arial" font-size="220">NOTES: 1. ALL DIMENSIONS IN MM. 2. DO NOT SCALE FROM DRAWING. 3. WALLS 100 THK DRYWALL UNO.</text>`);
  return s.join('')}
function titleBlock(M){const x=M.W-9000,y=M.H+2600,w=9000,h=1600;const rows=[['PROJECT','SYNTHETIC BLOCK A'],['DRAWING','LEVEL 2 FLOOR PLAN'],['SCALE','1:100 @ A1'],['DWG NO','SB-A-201 REV B']];
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="35"/>`+rows.map((r,i)=>`<line x1="${x}" y1="${y+(i+1)*400}" x2="${x+w}" y2="${y+(i+1)*400}" stroke="#000" stroke-width="12"/><text x="${x+150}" y="${y+i*400+280}" font-family="Arial" font-size="200">${r[0]}</text><text x="${x+2500}" y="${y+i*400+280}" font-family="Arial" font-size="220" font-weight="bold">${r[1]}</text>`).join('')+`<line x1="${x+2300}" y1="${y}" x2="${x+2300}" y2="${y+h}" stroke="#000" stroke-width="12"/>`}

/* ---------- compose an SVG for a style ---------- */
function svgFor(M,style,{sheet=false}={}){
  const margin=sheet?4500:(style==='cad'?3200:1200);const vx=-margin,vy=-margin,vw=M.W+2*margin,vh=M.H+2*margin+(sheet?3000:0);
  let defs=`<pattern id="hatch" width="150" height="150" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="150" stroke="#000" stroke-width="14"/></pattern>`;
  let body='';
  if(style==='single'){body+=M.walls.map(w=>w.o==='h'?`<line x1="${w.a}" y1="${w.c}" x2="${w.b}" y2="${w.c}" stroke="#000" stroke-width="30"/>`:`<line x1="${w.c}" y1="${w.a}" x2="${w.c}" y2="${w.b}" stroke="#000" stroke-width="30"/>`).join('');
    /* openings: break the line */
    body+=M.doors.map(d=>d.o==='h'?`<line x1="${d.p0}" y1="${d.c}" x2="${d.p1}" y2="${d.c}" stroke="#fff" stroke-width="60"/>`:`<line x1="${d.c}" y1="${d.p0}" x2="${d.c}" y2="${d.p1}" stroke="#fff" stroke-width="60"/>`).join('');
    body+=columnSymbols(M,style)+doorSymbols(M,style)+labels(M,style)}
  else{
    const loops=wallPaths(M);const d=pathD(loops);
    if(style==='solid')body+=`<path d="${d}" fill="#000" fill-rule="evenodd"/>`;
    else if(style==='grey')body+=`<path d="${d}" fill="#8c8c8c" fill-rule="evenodd"/>`;
    else if(style==='hatch')body+=`<path d="${d}" fill="url(#hatch)" fill-rule="evenodd" stroke="#000" stroke-width="35"/>`;
    else{/* cad: external walls hatched, partitions white, hairline faces */
      const extLoops=wallPaths(Object.assign({},M,{walls:M.walls.filter(w=>w.ext)}));
      body+=`<path d="${d}" fill="#fff" fill-rule="evenodd" stroke="#000" stroke-width="35"/>`;
      body+=`<path d="${pathD(extLoops)}" fill="url(#hatch)" fill-rule="evenodd" stroke="none"/>`;
      /* the hatch covers partition ends that poke into external walls: redraw faces */
      body+=`<path d="${d}" fill="none" stroke="#000" stroke-width="35"/>`}
    body+=columnSymbols(M,style)+windowSymbols(M,style)+doorSymbols(M,style)+furniture(M,style)+labels(M,style);
    if(style==='cad'){body+=annotations(M);if(sheet)body+=titleBlock(M)}}
  return{svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}"><defs>${defs}</defs><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#fff"/>${body}</svg>`,vx,vy,vw,vh}}

/* ---------- truth ---------- */
function truth(M,ox,oy,mpp){/* ox,oy: plan mm of the image's top-left; mpp: mm per image pixel */
  const sh=p=>[p[0]-ox,p[1]-oy];
  return{mpp,origin:[ox,oy],W:M.W,H:M.H,
    walls:M.walls.map(w=>({a:sh(w.o==='h'?[w.a,w.c]:[w.c,w.a]),b:sh(w.o==='h'?[w.b,w.c]:[w.c,w.b]),t:w.t,ext:w.ext})),
    rooms:M.rooms.map(r=>({name:r.name,pts:r.pts.map(sh)})),
    doors:M.doors.map(d=>({c:sh([d.cx,d.cy]),w:d.w,o:d.o,n:d.n,hinge:sh(d.hinge),dbl:d.dbl})),
    windows:M.windows.map(w=>({c:sh([w.cx,w.cy]),w:w.w,o:w.o})),
    cols:M.cols.map(c=>({c:sh([c.x,c.y]),w:c.w,d:c.d,round:c.round}))}}

async function main(){
  const b=await chromium.launch();const pg=await b.newPage();
  const made=[];
  for(const [lname,L] of Object.entries(LAYOUTS)){
    const M=Object.assign({},L,build(L));
    for(const style of ['cad','solid','grey','hatch','single']){
      const {svg,vx,vy,vw,vh}=svgFor(M,style);
      /* PNG: pixel size chosen per style like the files people have */
      const pxW=style==='cad'?2400:style==='single'?1000:1400;const mpp=vw/pxW;const pxH=Math.round(vh/mpp);
      await pg.setViewportSize({width:pxW,height:pxH});await pg.setContent(`<html><body style="margin:0">${svg.replace('<svg ',`<svg width="${pxW}" height="${pxH}" `)}</body></html>`);
      const id=`${lname}-${style}`;await pg.screenshot({path:path.join(OUT,id+'.png')});
      fs.writeFileSync(path.join(OUT,id+'.json'),JSON.stringify(Object.assign(truth(M,vx,vy,mpp),{id,style,layout:lname,file:id+'.png'})));made.push(id);
    }
    /* cad sheet as a PDF at 1:100 on A1 landscape (841 x 594 mm) with a title block */
    {const {svg,vx,vy,vw,vh}=svgFor(M,'cad',{sheet:true});const id=`${lname}-pdf`;
      const paperW=841,paperH=594;const sMM=vw/100,sH=vh/100; /* drawing size on paper in mm */
      const left=(paperW-sMM)/2,top=(paperH-sH)/2;
      await pg.setContent(`<html><head><style>@page{size:${paperW}mm ${paperH}mm;margin:0}body{margin:0;width:${paperW}mm;height:${paperH}mm;position:relative}svg{position:absolute;left:${left}mm;top:${top}mm}</style></head><body>${svg.replace('<svg ',`<svg width="${sMM}mm" height="${sH}mm" `)}</body></html>`);
      await pg.pdf({path:path.join(OUT,id+'.pdf'),width:paperW+'mm',height:paperH+'mm',printBackground:true,margin:{top:0,bottom:0,left:0,right:0}});
      /* truth in sheet coordinates: the app assumes 1:100, so 1 pt on paper = 25.4/72 mm paper = 35.28 mm plan. Origin = sheet top-left */
      const mppPt=(25.4/72)*100;const ox=vx-left*100,oy=vy-top*100;
      fs.writeFileSync(path.join(OUT,id+'.json'),JSON.stringify(Object.assign(truth(M,ox,oy,mppPt),{id,style:'pdf',layout:lname,file:id+'.pdf',pdf:true})));made.push(id)}
  }
  await b.close();console.log('made',made.length,'samples in',OUT);
}
main().catch(e=>{console.error(e);process.exit(1)});
