/* layer: floor plan detection on known drawings. Each sample has ground truth (test/detect/synth); the thresholds below are the
   floor the detector must not fall under. A full score table comes from `node test/detect/run.mjs`. */
import fs from 'fs';import path from 'path';import {openApp,row,ROOT} from '../lib.mjs';
export const name='detect';
const DIR=path.join(ROOT,'test/detect/synth');
const CASES=[
  {id:'office-cad',  rooms:11,doors:12,wins:13,cols:3,walls:0.9},
  {id:'office-solid',rooms:11,doors:12,wins:11,cols:3,walls:0.9},
  {id:'flat-pdf',    rooms:5, doors:5, wins:6, cols:0,walls:0.9},
  {id:'small-single',rooms:3, doors:3, wins:0, cols:0,walls:0.9},
  {id:'flat-hatch',  rooms:5, doors:5, wins:7, cols:0,walls:0.9},
];
const segDist=(px,py,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy;let t=L2?((px-a[0])*dx+(py-a[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-a[0]-t*dx,py-a[1]-t*dy)};
const inPoly=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))c=!c}return c};
function iou(A,B){const xs=A.concat(B).map(p=>p[0]),ys=A.concat(B).map(p=>p[1]);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);const g=Math.max(25,(x1-x0)/200);let i=0,u=0;for(let y=y0+g/2;y<y1;y+=g)for(let x=x0+g/2;x<x1;x+=g){const a=inPoly(x,y,A),b=inPoly(x,y,B);if(a&&b)i++;if(a||b)u++}return u?i/u:0}
export async function run(b){
  const R=[];
  for(const C of CASES){
    const T=JSON.parse(fs.readFileSync(path.join(DIR,C.id+'.json'),'utf8'));
    const pg=await openApp(b,{sample:false});
    try{
      await pg.evaluate(()=>document.querySelector('#m-new').click());await pg.waitForTimeout(100);
      await pg.setInputFiles('#f-under',path.join(DIR,T.file));
      await pg.waitForFunction(()=>{const S=window.__osp.S();return S.underlay&&S.underlay.src&&S.underlay.w>0},{timeout:60000});await pg.waitForTimeout(200);
      await pg.evaluate(({mpp,pdf})=>{const u=window.__osp.S().underlay;u.x=0;u.y=0;if(!pdf)u.mpp=mpp;u.calibrated=true},{mpp:T.mpp,pdf:!!T.pdf});
      const n0=pg.errs.length;await pg.evaluate(()=>window.__osp.runDetect(null));
      const det=await pg.evaluate(()=>window.__osp.S().objs.filter(o=>o.det).map(o=>({t:o.t,shape:o.shape,pts:o.pts,th:o.th,x:o.x,y:o.y,w:o.w})));
      const walls=det.filter(o=>o.t==='wall'),rooms=det.filter(o=>o.t==='room'),doors=det.filter(o=>/^door/.test(o.shape||'')),wins=det.filter(o=>o.shape==='window'),cols=det.filter(o=>/^col/.test(o.shape||''));
      let hit=0,tot=0;T.walls.forEach(w=>{const L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),n=Math.max(1,Math.round(L/200));for(let i=0;i<=n;i++){const p=[w.a[0]+(w.b[0]-w.a[0])*i/n,w.a[1]+(w.b[1]-w.a[1])*i/n];tot++;if(walls.some(o=>segDist(p[0],p[1],o.pts[0],o.pts[1])<=Math.max(200,w.t)))hit++}});
      const rec=tot?hit/tot:0;
      const used=new Set();let rm=0;T.rooms.forEach(r=>{let best=0,bi=-1;rooms.forEach((d,i)=>{if(used.has(i))return;const v=iou(r.pts,d.pts);if(v>best){best=v;bi=i}});if(best>=0.75){rm++;used.add(bi)}});
      const usedD=new Set();let dm=0;T.doors.forEach(d=>{const i=doors.findIndex((o,k)=>!usedD.has(k)&&Math.hypot(o.x-d.c[0],o.y-d.c[1])<=450&&Math.abs(o.w-d.w)<=300);if(i>=0){dm++;usedD.add(i)}});
      const usedW=new Set();let wm=0;T.windows.forEach(w=>{const i=wins.findIndex((o,k)=>!usedW.has(k)&&Math.hypot(o.x-w.c[0],o.y-w.c[1])<=500&&Math.abs(o.w-w.w)<=400);if(i>=0){wm++;usedW.add(i)}});
      let cm=0;(T.cols||[]).forEach(c=>{if(cols.some(o=>Math.hypot(o.x-c.c[0],o.y-c.c[1])<=300))cm++});
      const got={walls:+rec.toFixed(2),rooms:rm,roomsExtra:rooms.length-used.size,doors:dm,doorsFalse:doors.length-usedD.size,wins:wm,cols:cm,errs:pg.errs.slice(n0)};
      const ok=rec>=C.walls&&rm>=C.rooms&&dm>=C.doors&&wm>=C.wins&&cm>=C.cols&&got.roomsExtra<=1&&got.doorsFalse<=2&&got.errs.length===0;
      R.push(row('det-'+C.id,`${C.id}: walls ≥${C.walls*100}%, rooms ≥${C.rooms}, doors ≥${C.doors}, windows ≥${C.wins}, columns ≥${C.cols}`,ok,got));
    }catch(e){R.push(row('det-'+C.id,C.id+': detection ran',false,e.message))}
    await pg.ctx.close()}
  return R}
