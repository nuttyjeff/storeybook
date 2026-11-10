/* Detection harness: loads each sample as the underlay in the dev build, sets the true scale, runs Detect, scores against truth.
   node test/detect/run.mjs [--only=a,b] [--real] [--tag=name] [--box]
   Writes test/detect/out/<tag>/<id>.png (what the user would see) and scores.json, prints a table. */
import fs from 'fs';import path from 'path';import {browser,openApp,ROOT} from '../release/lib.mjs';
const DIR=path.join(ROOT,'test/detect');const args=Object.fromEntries(process.argv.slice(2).map(a=>{const m=a.match(/^--([^=]+)(?:=(.*))?$/);return m?[m[1],m[2]??true]:[a,true]}));
const TAG=args.tag||'cur';const OUTD=path.join(DIR,'out',TAG);fs.mkdirSync(OUTD,{recursive:true});
const only=args.only?String(args.only).split(','):null;

/* ---------- geometry helpers ---------- */
const segDist=(px,py,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy;let t=L2?((px-a[0])*dx+(py-a[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-a[0]-t*dx,py-a[1]-t*dy)};
const polyArea=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1]}return a/2};
const inPoly=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))c=!c}return c};
function iou(A,B){const xs=A.concat(B).map(p=>p[0]),ys=A.concat(B).map(p=>p[1]);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);const g=Math.max(25,(x1-x0)/300);let i=0,u=0;
  for(let y=y0+g/2;y<y1;y+=g)for(let x=x0+g/2;x<x1;x+=g){const a=inPoly(x,y,A),b=inPoly(x,y,B);if(a&&b)i++;if(a||b)u++}return u?i/u:0}
const samples=(a,b,step)=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]);const n=Math.max(1,Math.round(L/step));const out=[];for(let i=0;i<=n;i++)out.push([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]);return out};
function wallSegsOf(o){const out=[];const p=o.pts;for(let i=0;i<p.length-1;i++)out.push([p[i],p[i+1]]);if(o.closed&&p.length>2)out.push([p[p.length-1],p[0]]);return out}

/* ---------- scoring ---------- */
function score(T,det){
  const R={};
  const dWalls=det.filter(o=>o.t==='wall'),dRooms=det.filter(o=>o.t==='room'),dDoors=det.filter(o=>o.t==='item'&&/^door/.test(o.shape)),dWins=det.filter(o=>o.t==='item'&&o.shape==='window'),dCols=det.filter(o=>o.t==='item'&&/^col/.test(o.shape));
  /* walls: centreline coverage both ways */
  const dSegs=dWalls.flatMap(o=>wallSegsOf(o).map(([a,b])=>({a,b,th:o.th||100})));
  let hit=0,tot=0;T.walls.forEach(w=>{const tol=Math.max(200,w.t);samples(w.a,w.b,200).forEach(p=>{tot++;if(dSegs.some(s=>segDist(p[0],p[1],s.a,s.b)<=tol))hit++})});R.wallRecall=tot?hit/tot:0;
  hit=0;tot=0;dSegs.forEach(s=>{const tol=Math.max(200,s.th);samples(s.a,s.b,200).forEach(p=>{tot++;if(T.walls.some(w=>segDist(p[0],p[1],w.a,w.b)<=tol))hit++})});R.wallPrec=tot?hit/tot:1;R.wallsN=dWalls.length;
  /* rooms */
  const usedR=new Set();let rm=0;const ious=[];T.rooms.forEach(r=>{let best=0,bi=-1;dRooms.forEach((d,i)=>{if(usedR.has(i))return;const v=iou(r.pts,d.pts);if(v>best){best=v;bi=i}});ious.push(+best.toFixed(2));if(best>=0.75){rm++;usedR.add(bi)}});
  R.roomsT=T.rooms.length;R.roomsMatched=rm;R.roomsExtra=dRooms.length-usedR.size;R.roomIoU=ious;
  /* doors */
  const usedD=new Set();let dm=0,swingOk=0;T.doors.forEach(d=>{let best=null,bd=1e9;dDoors.forEach((o,i)=>{if(usedD.has(i))return;const dist=Math.hypot(o.x-d.c[0],o.y-d.c[1]);if(dist<=450&&Math.abs(o.w-d.w)<=300&&dist<bd){bd=dist;best=i}});
    if(best!=null){dm++;usedD.add(best);const o=dDoors[best];const t=o.r*Math.PI/180,ey=[-Math.sin(t),Math.cos(t)];if(ey[0]*d.n[0]+ey[1]*d.n[1]>0)swingOk++}});
  R.doorsT=T.doors.length;R.doorsMatched=dm;R.doorsSwingOk=swingOk;R.doorsFalse=dDoors.length-usedD.size;
  /* windows (sketches do not draw them) */
  if(T.style!=='single'){const usedW=new Set();let wm=0;T.windows.forEach(w=>{let best=null,bd=1e9;dWins.forEach((o,i)=>{if(usedW.has(i))return;const dist=Math.hypot(o.x-w.c[0],o.y-w.c[1]);if(dist<=500&&Math.abs(o.w-w.w)<=400&&dist<bd){bd=dist;best=i}});if(best!=null){wm++;usedW.add(best)}});
    R.winsT=T.windows.length;R.winsMatched=wm;R.winsFalse=dWins.length-usedW.size}
  /* columns */
  {const usedC=new Set();let cm=0;(T.cols||[]).forEach(c=>{let best=null,bd=1e9;dCols.forEach((o,i)=>{if(usedC.has(i))return;const dist=Math.hypot(o.x-c.c[0],o.y-c.c[1]);if(dist<=300&&dist<bd){bd=dist;best=i}});if(best!=null){cm++;usedC.add(best)}});R.colsT=(T.cols||[]).length;R.colsMatched=cm;R.colsFalse=dCols.length-usedC.size}
  return R}

/* ---------- one sample through the app ---------- */
async function runOne(b,T,file){
  const pg=await openApp(b,{sample:false});
  await pg.evaluate(()=>{document.querySelector('#m-new').click()});await pg.waitForTimeout(100);
  await pg.setInputFiles('#f-under',file);
  await pg.waitForFunction(()=>{const S=window.__osp.S();return S.underlay&&S.underlay.src&&S.underlay.w>0},{timeout:60000});await pg.waitForTimeout(300);
  /* scale: images get the true mm per pixel; PDFs are read at 1:100 by the app already */
  const info=await pg.evaluate(({mpp,pdf})=>{const S=window.__osp.S(),u=S.underlay;u.x=0;u.y=0;if(!pdf){u.mpp=mpp}u.calibrated=true;window.__osp.fit();return{w:u.w,h:u.h,mpp:u.mpp,sc:u.sc}},{mpp:T.mpp,pdf:!!T.pdf});
  const t0=Date.now();const errs0=pg.errs.length;
  await pg.evaluate(()=>window.__osp.runDetect(null));
  const ms=Date.now()-t0;
  const det=await pg.evaluate(()=>window.__osp.S().objs.filter(o=>o.det).map(o=>({t:o.t,shape:o.shape,pts:o.pts,th:o.th,closed:o.closed,x:o.x,y:o.y,w:o.w,d:o.d,r:o.r,flip:o.flip,name:o.name})));
  const toast=await pg.evaluate(()=>document.querySelector('#toast').textContent);
  /* picture: drawers closed, plan fitted, underlay a little stronger so the drawing shows under the trace */
  await pg.evaluate(()=>{const o=window.__osp,P=o.P();if(P.lib)document.querySelector('#t-lib').click();if(P.insp)document.querySelector('#t-insp').click();o.S().underlay.op=0.5;o.toastOff()});await pg.waitForTimeout(100);
  await pg.evaluate(()=>{window.__osp.fit();window.__osp.toastOff()});await pg.waitForTimeout(200);
  await pg.screenshot({path:path.join(OUTD,T.id+'.png'),clip:{x:0,y:110,width:1400,height:720}});
  const errs=pg.errs.slice(errs0);await pg.ctx.close();
  return{det,ms,toast,errs,info}}

async function main(){
  const list=[];
  for(const f of fs.readdirSync(path.join(DIR,'synth')).filter(f=>f.endsWith('.json')).sort()){const T=JSON.parse(fs.readFileSync(path.join(DIR,'synth',f),'utf8'));list.push({T,file:path.join(DIR,'synth',T.file)})}
  if(args.real&&fs.existsSync(path.join(DIR,'real','index.json'))){for(const T of JSON.parse(fs.readFileSync(path.join(DIR,'real','index.json'),'utf8')))list.push({T:Object.assign({walls:[],rooms:[],doors:[],windows:[],cols:[]},T),file:path.join(DIR,'real',T.file)})}
  const b=await browser();const rows=[];
  for(const {T,file} of list){if(only&&!only.includes(T.id))continue;
    let r;try{r=await runOne(b,T,file)}catch(e){rows.push({id:T.id,error:e.message});console.log(T.id,'ERROR',e.message);continue}
    const sc=T.real?{}:score(T,r.det);
    const row=Object.assign({id:T.id,style:T.style,ms:r.ms,toast:r.toast,errs:r.errs},sc,{counts:{walls:r.det.filter(o=>o.t==='wall').length,rooms:r.det.filter(o=>o.t==='room').length,doors:r.det.filter(o=>/^door/.test(o.shape||'')).length,wins:r.det.filter(o=>o.shape==='window').length,cols:r.det.filter(o=>/^col/.test(o.shape||'')).length}});
    rows.push(row);
    const f=v=>v==null?'-':(v*100).toFixed(0)+'%';
    console.log([T.id.padEnd(16),T.real?`walls ${row.counts.walls} rooms ${row.counts.rooms}/${T.expect?T.expect.rooms:'?'} doors ${row.counts.doors}/${T.expect?T.expect.doors:'?'} wins ${row.counts.wins} cols ${row.counts.cols}  ${(r.toast||'').replace(/Traced.*?·\s*/,'').replace(/\. Check.*$/,'').slice(0,60)}`:
      `walls R ${f(sc.wallRecall)} P ${f(sc.wallPrec)} (${sc.wallsN})  rooms ${sc.roomsMatched}/${sc.roomsT}+${sc.roomsExtra}  doors ${sc.doorsMatched}/${sc.doorsT}+${sc.doorsFalse} swing ${sc.doorsSwingOk}  wins ${sc.winsMatched==null?'-':sc.winsMatched+'/'+sc.winsT+'+'+sc.winsFalse}  cols ${sc.colsMatched}/${sc.colsT}+${sc.colsFalse}`,`${r.ms} ms`,r.errs.length?'ERRS '+r.errs[0]:''].join('  '))}
  await b.close();
  fs.writeFileSync(path.join(OUTD,'scores.json'),JSON.stringify(rows,null,1));
  /* aggregate over synthetic */
  const S=rows.filter(r=>!r.error&&r.roomsT!=null);if(S.length){const avg=k=>S.reduce((a,r)=>a+(r[k]||0),0)/S.length;const sum=k=>S.reduce((a,r)=>a+(r[k]||0),0);
    console.log(`\n${S.length} synthetic: wall recall ${(avg('wallRecall')*100).toFixed(0)}%  precision ${(avg('wallPrec')*100).toFixed(0)}%  rooms ${sum('roomsMatched')}/${sum('roomsT')} (+${sum('roomsExtra')} extra)  doors ${sum('doorsMatched')}/${sum('doorsT')} (+${sum('doorsFalse')} false, swing ok ${sum('doorsSwingOk')})  windows ${sum('winsMatched')}/${sum('winsT')} (+${sum('winsFalse')} false)  cols ${sum('colsMatched')}/${sum('colsT')} (+${sum('colsFalse')})`)}
}
main().catch(e=>{console.error(e);process.exit(1)});
