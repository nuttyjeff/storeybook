/* layer 6: performance budget. Numbers are recorded per release; a release fails if a figure is 30% worse than the last accepted one or over the hard cap. */
import fs from 'fs';import path from 'path';import {openApp,row,to3D,ROOT,appVersion} from '../lib.mjs';
export const name='perf';
const FILE=path.join(ROOT,'test/release/perf-baseline.json');
const CAPS={load_ms:4000,sample_objs_min:150,clash_ms:60,planJSON_ms:40,migRoom_ms:3,build3d_ms:12000,idle_renders_2s:6,drawCalls:900,triangles:400000};
export async function run(b,{accept=false}={}){
  const R=[];const pg=await openApp(b,{sample:false});
  const t0=Date.now();await pg.reload({waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S);const load_ms=Date.now()-t0;
  await pg.evaluate(()=>document.querySelector('#m-sample').click());await pg.waitForTimeout(400);
  const m=await pg.evaluate(()=>{const o=window.__osp,S=o.S();const out={sample_objs:S.objs.length};const rooms=S.objs.filter(x=>x.t==='room');
    let t=performance.now();for(let i=0;i<50;i++)o.computeClash();out.clash_ms=+((performance.now()-t)/50).toFixed(2);
    t=performance.now();for(let i=0;i<20;i++)o.planJSON();out.planJSON_ms=+((performance.now()-t)/20).toFixed(2);
    t=performance.now();for(let i=0;i<50;i++)rooms.forEach(r=>o.migRoom(r));out.migRoom_ms=+((performance.now()-t)/50).toFixed(3);return out});
  const t1=Date.now();await to3D(pg);const build3d_ms=Date.now()-t1;
  const m3=await pg.evaluate(async()=>{const T=window.__osp.T3();let n=0;const orig=T.renderer.render.bind(T.renderer);T.renderer.render=(s,c)=>{n++;return orig(s,c)};await new Promise(r=>setTimeout(r,2000));T.renderer.render=orig;
    let tris=0;T.group.traverse(x=>{if(x.isMesh){const g=x.geometry;if(g&&g.index)tris+=g.index.count/3;else if(g&&g.attributes.position)tris+=g.attributes.position.count/3}});return {idle_renders_2s:n,drawCalls:T.renderer.info.render.calls,triangles:Math.round(tris)}});
  await pg.ctx.close();
  const cur={load_ms,...m,build3d_ms,...m3};const prev=fs.existsSync(FILE)?JSON.parse(fs.readFileSync(FILE,'utf8')):null;
  const worse=(k,v)=>prev&&prev.values&&typeof prev.values[k]==='number'&&k!=='sample_objs'&&v>prev.values[k]*1.3&&v-prev.values[k]>(k.endsWith('_ms')?5:0);
  for(const [k,v] of Object.entries(cur)){const cap=k==='sample_objs'?CAPS.sample_objs_min:CAPS[k];const capOk=k==='sample_objs'?v>=cap:v<=cap;const regress=worse(k,v);
    R.push(row('perf-'+k,`${k}: ${v}${prev&&prev.values&&prev.values[k]!==undefined?' (last '+prev.values[k]+')':''}, cap ${cap}`,capOk&&!regress,regress?'30% worse than last accepted release':''))}
  if(accept||!prev)fs.writeFileSync(FILE,JSON.stringify({version:appVersion(),at:new Date().toISOString(),values:cur},null,1));
  return R}
