/* layer: interaction parity matrix. Every basic action on every device and view, plus "a way out of every state".
   Each slice lives in its own file test/release/checks/matrix/<slice>.mjs exporting run(browser) -> rows. */
import fs from 'fs';import path from 'path';import {ROOT,row} from '../lib.mjs';
export const name='matrix';
export async function run(b){
  const dir=path.join(ROOT,'test/release/checks/matrix');if(!fs.existsSync(dir))return [];
  const R=[];
  const slow=['layout.mjs','robust.mjs'];
  /* MX_FILES=phone2d,view3d runs only those slices (CI splits the matrix across machines this way) */const pick=process.env.MX_FILES?process.env.MX_FILES.split(',').map(x=>x.replace(/\.mjs$/,'')+'.mjs'):null;
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.mjs')).sort()){if(process.env.MX_QUICK&&slow.includes(f))continue;if(pick&&!pick.includes(f))continue;
    try{const m=await import(path.join(dir,f)+'?t='+Date.now());let rows=await m.run(b);
      /* slices that can re-run single checks (SB_CHECK) get one retry for checks that failed in the long sequence; a pass on retry is kept but marked FLAKY so it stays visible */
      const known=(()=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,'test/release/known.json'),'utf8')).map(k=>new RegExp(k.id))}catch(e){return []}})();const bad=rows.filter(r=>!r.pass&&!known.some(k=>k.test(r.id)));if((m.retryable||m.retryEnv)&&bad.length&&bad.length<=40){const env=m.retryEnv?m.retryEnv(bad.map(r=>r.id)):{SB_CHECK:'^('+bad.map(r=>r.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')$'};const keepEnv={};for(const k in env){keepEnv[k]=process.env[k];process.env[k]=env[k]}
        try{const m2=await import(path.join(dir,f)+'?r='+Date.now());const again=new Map((await m2.run(b)).map(r=>[r.id,r]));rows=rows.map(r=>!r.pass&&again.get(r.id)&&again.get(r.id).pass?{...again.get(r.id),detail:'FLAKY (failed in sequence, passed alone): '+JSON.stringify(r.detail).slice(0,200)}:r)}
        finally{for(const k in keepEnv){if(keepEnv[k]==null)delete process.env[k];else process.env[k]=keepEnv[k]}}}
      R.push(...rows)}
    catch(e){R.push(row('mx-load-'+f,`matrix slice ${f} ran`,false,String(e&&e.stack||e).slice(0,400)))}}
  return R}
