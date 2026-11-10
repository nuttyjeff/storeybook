/* layer 5: screenshots of fixed states, compared against the last accepted baseline */
import fs from 'fs';import path from 'path';import {createRequire} from 'module';import {openApp,row,click,to3D,to2D,ROOT,touch,TOOLS} from '../lib.mjs';
const walkIn=async(pg,phone)=>{await to2D(pg);if(phone){await click(pg,'#mbar [data-m=select]');await pg.waitForTimeout(100)}await click(pg,'#b-walk');await pg.waitForTimeout(150);const c=await pg.evaluate(()=>{const o=window.__osp,S=o.S();const r=S.objs.find(x=>x.t==='room');const c=r.pts.reduce((a,p)=>[a[0]+p[0]/r.pts.length,a[1]+p[1]/r.pts.length],[0,0]);const V=o.V,rr=document.querySelector('#plan').getBoundingClientRect();return [rr.left+(c[0]-V.x)*V.k,rr.top+(c[1]-V.y)*V.k]});if(phone){const t=await touch(pg);await t.tap(c[0],c[1])}else await pg.mouse.click(c[0],c[1]);await pg.waitForFunction(()=>window.__osp.WALK.on,{timeout:20000});await pg.waitForTimeout(1200)};
const sharp=createRequire(TOOLS)('sharp');
export const name='visual';
const BASE=path.join(ROOT,process.env.SB_BASELINE||'test/release/baseline'),OUTD=path.join(ROOT,'test/release/out');
const THRESH=0.6; // percent of pixels allowed to differ
async function diff(a,b){const A=await sharp(a).raw().toBuffer({resolveWithObject:true}),B=await sharp(b).raw().toBuffer({resolveWithObject:true});
  if(A.info.width!==B.info.width||A.info.height!==B.info.height)return {pct:100,note:'size changed'};
  const ch=A.info.channels;let bad=0;const n=A.info.width*A.info.height;for(let i=0;i<n;i++){const o=i*ch;if(Math.abs(A.data[o]-B.data[o])+Math.abs(A.data[o+1]-B.data[o+1])+Math.abs(A.data[o+2]-B.data[o+2])>48)bad++}
  return {pct:+(100*bad/n).toFixed(2)}}
const STATES=[
  {id:'d-2d',phone:false,go:async pg=>{}},
  {id:'d-insp',phone:false,go:async pg=>{await pg.evaluate(()=>{const S=window.__osp.S();window.__osp.setSel([S.objs.find(o=>o.t==='item').id])});await pg.waitForTimeout(150)}},
  {id:'d-3d',phone:false,go:async pg=>{await to3D(pg);await pg.waitForTimeout(600)}},
  {id:'d-bld',phone:false,go:async pg=>{await to3D(pg);await click(pg,'#vbld');await pg.waitForTimeout(1800)}},
  {id:'d-walk',phone:false,go:async pg=>{await walkIn(pg,false)}},
  {id:'p-2d',phone:true,go:async pg=>{}},
  {id:'p-draw',phone:true,go:async pg=>{await click(pg,'#mbar [data-m=draw]');await pg.waitForTimeout(150)}},
  {id:'p-lib',phone:true,go:async pg=>{await click(pg,'#mbar [data-m=lib]');await pg.waitForTimeout(200)}},
  {id:'p-insp',phone:true,go:async pg=>{await pg.evaluate(()=>{const S=window.__osp.S();window.__osp.setSel([S.objs.find(o=>o.t==='item').id])});await click(pg,'#mbar [data-m=insp]');await pg.waitForTimeout(250)}},
  {id:'p-more',phone:true,go:async pg=>{await click(pg,'#mbar [data-m=more]');await pg.waitForTimeout(150)}},
  {id:'p-3d',phone:true,go:async pg=>{await to3D(pg);await pg.waitForTimeout(600)}},
  {id:'p-walk',phone:true,go:async pg=>{await walkIn(pg,true)}},
];
export async function run(b,{accept=false}={}){
  fs.mkdirSync(BASE,{recursive:true});fs.mkdirSync(OUTD,{recursive:true});const R=[];
  for(const st of STATES){
    const pg=await openApp(b,{phone:st.phone});await pg.evaluate(()=>{const t=document.querySelector('#toast');if(t)t.hidden=true});
    /* wait until the view has stopped moving (fit after load can land a frame late) */
    for(let i=0,last='';i<8;i++){const v=await pg.evaluate(()=>JSON.stringify([window.__osp.V.x,window.__osp.V.y,window.__osp.V.k,innerWidth,innerHeight]));if(v===last)break;last=v;await pg.waitForTimeout(250)}
    /* fit once more now that the layout has settled, so the plan sits in the same place every run */
    await pg.evaluate(()=>window.__osp.fit&&window.__osp.fit());await pg.waitForTimeout(150);
    try{await st.go(pg)}catch(e){R.push(row('v-'+st.id,`${st.id}: state could not be reached`,false,e.message));await pg.ctx.close();continue}
    await pg.evaluate(()=>{const t=document.querySelector('#toast');if(t){t.hidden=true;t.textContent=''}document.querySelectorAll('.walk-tip').forEach(e=>e.style.display='none')});await pg.waitForTimeout(100);
    const cur=path.join(OUTD,st.id+'.png');await pg.screenshot({path:cur});await pg.ctx.close();
    const base=path.join(BASE,st.id+'.png');
    if(!fs.existsSync(base)||accept){fs.copyFileSync(cur,base);R.push(row('v-'+st.id,`${st.id}: baseline ${accept?'accepted':'created'}`,true,'new baseline'));continue}
    const d=await diff(base,cur);const ok=d.pct<=THRESH;
    if(!ok){const dp=path.join(OUTD,'diff-'+st.id+'.png');const A=sharp(base).resize({width:700}),B=sharp(cur).resize({width:700});const [ab,bb]=await Promise.all([A.png().toBuffer(),B.png().toBuffer()]);const m=await sharp(ab).metadata();
      await sharp({create:{width:m.width*2+10,height:m.height,channels:3,background:'#888'}}).composite([{input:ab,left:0,top:0},{input:bb,left:m.width+10,top:0}]).png().toFile(dp)}
    R.push(row('v-'+st.id,`${st.id}: ${d.pct}% of pixels differ from baseline (limit ${THRESH}%)`,ok,ok?'':'see test/release/out/diff-'+st.id+'.png; rerun with --accept-visual to accept'))}
  return R}
