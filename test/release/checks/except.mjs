/* layer: except. Exception handling: broken plan files, library CSVs and requirement forms, garbage AI answers, a faulty AI server,
   full storage, a failed browser database, lost graphics and odd input. Each must end in a clear message and an intact plan, never a
   crash, a silent failure or a damaged plan. The harness is sim/exc.mjs; run it alone with `node test/release/sim/exc.mjs`. Added 16 Nov 2026. */
import fs from 'fs';import os from 'os';import path from 'path';import {spawnSync} from 'child_process';import {row} from '../lib.mjs';
export const name='except';
const WHAT={files:'Damaged, hostile and oversized plan files',csv:'Bad library CSVs and requirement forms',"ai answers":'Garbage and hostile AI answers and commands',"ai server":'AI server faults: refused, slow, cut off, wrong content','environment':'Full storage, failed browser database, lost graphics, clipboard, print, odd input'};
export async function run(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sb-exc-'));
  const r=spawnSync(process.execPath,[new URL('../sim/exc.mjs',import.meta.url).pathname],{env:{...process.env,SIM_DIR:dir},encoding:'utf8',timeout:600000,maxBuffer:64e6});
  let d=null;try{d=JSON.parse(fs.readFileSync(dir+'/exc.json','utf8'))}catch(e){}
  if(!d)return[row('ex-run','Exception harness ran to the end',false,(r.stderr||r.stdout||String(r.error||'no output')).slice(-600))];
  const rows=d.sections.map(s=>{const f=d.F.filter(x=>x.sec===s);return row('ex-'+s.replace(/\W+/g,'-'),(WHAT[s]||s)+': a clear message each time, the plan intact, no error',!f.length,f.slice(0,6).map(x=>`[${x.sev}] ${x.name}: ${String(x.what).slice(0,160)}`).join(' | '))});
  rows.push(row('ex-run','Exception harness ran to the end ('+d.sections.length+' sections)',d.sections.length>=5&&r.status===0,r.status===0?'':(r.stderr||'').slice(-400)));return rows}
