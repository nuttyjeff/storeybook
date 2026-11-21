/* layer: users. Simulated users. Five scripted journeys (PM from a requirements form, designer by hand, engineer with a data hall and roof PV,
   campus of two buildings, phone by touch) and eight seeded random users on desktop, tablet and phone sizes. After each: the plan is valid
   (finite numbers, unique ids, no orphans), no error was raised, every dialog closes with Esc, undo-all then redo-all returns the same plan,
   and the saved file opens as the same plan. The harness is sim/users.mjs; `STEPS=500 node test/release/sim/users.mjs` runs all 16 random
   users for longer. Random users run with 3D off (software 3D is too slow on the gate machine); journeys and the matrix cover 3D. Added 16 Nov 2026. */
import fs from 'fs';import os from 'os';import path from 'path';import {spawnSync} from 'child_process';import {row} from '../lib.mjs';
export const name='users';
const RANDOM='designer-1,pm-1,engineer-2,keyboard-1,phone-1,tablet-1,impatient-1,typist-1';
export async function run(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sb-users-'));
  const r=spawnSync(process.execPath,[new URL('../sim/users.mjs',import.meta.url).pathname],{env:{...process.env,SIM_DIR:dir,TAG:'gate',STEPS:process.env.SIM_STEPS||'300',PAR:'2',ONLY:RANDOM+',journey-pm,journey-designer,journey-engineer,journey-campus,journey-phone'},encoding:'utf8',timeout:1200000,maxBuffer:64e6});
  let d=null;try{d=JSON.parse(fs.readFileSync(dir+'/users-gate.json','utf8'))}catch(e){}
  if(!d)return[row('us-run','Simulated-user harness ran to the end',false,(r.stderr||r.stdout||String(r.error||'no output')).slice(-600))];
  const rows=d.U.map(u=>{const f=d.F.filter(x=>x.users.includes(u.id));const j=/^journey-/.test(u.id);return row('us-'+u.id,(j?'Journey, '+u.what:'Random user '+u.id+', '+u.done+' actions')+': plan valid, no error, dialogs close, undo-all and redo-all exact, saved file reopens the same',!f.length&&(j||u.done>=50),f.slice(0,5).map(x=>`[${x.sev}] ${x.what.slice(0,200)} (after: ${x.trail.slice(-5).join(' > ')})`).join(' | '))});
  rows.push(row('us-run','Simulated-user harness ran every user (5 journeys, 8 random)',d.U.length===13&&r.status===0,`${d.U.length} of 13 ran`+(r.status===0?'':' · '+(r.stderr||'').slice(-300))));return rows}
