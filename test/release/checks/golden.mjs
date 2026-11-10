/* layer 3: golden plan files from every schema version open, migrate and round-trip without drift */
import fs from 'fs';import path from 'path';import {openApp,row,ROOT} from '../lib.mjs';
export const name='golden';
const G=path.join(ROOT,'test/release/golden');
const strip=o=>{const c=JSON.parse(JSON.stringify(o));delete c.saved;delete c.appVersion;return c};
export async function run(b){
  const R=[];const pg=await openApp(b,{sample:false});
  const PLAN_V=await pg.evaluate(()=>window.__osp.PLAN_V);
  for(const f of fs.readdirSync(G).filter(f=>f.endsWith('.json')).sort()){
    const text=fs.readFileSync(path.join(G,f),'utf8');const n0=pg.errs.length;
    const r=await pg.evaluate(async(text)=>{const o=window.__osp;try{const raw=JSON.parse(text);o.openPlanText(text,'golden');await new Promise(r=>setTimeout(r,250));
        const S=o.S();const j1=o.planJSON();const p1=JSON.parse(j1);
        o.openPlanText(j1,'golden2');await new Promise(r=>setTimeout(r,250));const p2=JSON.parse(o.planJSON());
        return {ok:true,fileV:raw.v||1,inObjs:raw.objs.length,objs:S.objs.length,outV:p1.v,keptFuture:raw.v>o.PLAN_V?p1.v===raw.v:true,futureField:raw.objs.some(x=>x.futureField)?p1.objs.some(x=>x.futureField==='keep me'):true,p1,p2}}
      catch(e){return {ok:false,err:String(e.message||e)}}},text);
    if(f==='bad.json'){R.push(row('g-'+f,`${f}: rejected cleanly with a message`,!r.ok&&/JSON|plan/i.test(r.err)&&pg.errs.length===n0,r.err));continue}
    if(!r.ok){R.push(row('g-'+f,`${f}: opens`,false,r.err));continue}
    const same=JSON.stringify(strip(r.p1))===JSON.stringify(strip(r.p2));
    R.push(row('g-'+f,`${f} (v${r.fileV}): migrates to v${r.outV}, ${r.objs}/${r.inObjs} objects kept, round-trip stable`,r.objs>=r.inObjs*0.98&&same&&r.keptFuture&&r.futureField&&pg.errs.length===n0,{objs:r.objs,inObjs:r.inObjs,same,keptFuture:r.keptFuture,futureField:r.futureField,errs:pg.errs.slice(n0)}));
  }
  R.push(row('g-planv',`PLAN_V is ${PLAN_V} and a golden-v${PLAN_V}.json exists (freeze a new one when PLAN_V changes)`,fs.existsSync(path.join(G,`golden-v${PLAN_V}.json`))));
  await pg.ctx.close();return R}
