/* StoreyBook release gate
   node test/release/runner.mjs                 run every layer, print the table, exit 1 on any failure
   --only build,smoke   run some layers         --accept-visual  take the current screenshots as the new baseline
   --accept-perf        record current numbers  --json           also write test/release/out/last.json
   --quick              skip the slow matrix slices (layout, robust) for a fast check while working; a release always runs the full gate
   known.json           open bugs that are logged in the backlog: their checks still run and still show, as KNOWN, but do not block.
                        Every entry names its backlog row. A known check that starts passing is reported so the entry can be removed.
*/
import fs from 'fs';import path from 'path';import {browser,appVersion,ROOT} from './lib.mjs';
const args=process.argv.slice(2);const flag=f=>args.includes(f);const only=(args.find(a=>a.startsWith('--only='))||'').slice(7).split(',').filter(Boolean);
const LAYERS=['build','load','golden','smoke','matrix','detect','visual','perf','deploy'];
const ver=appVersion();console.log(`StoreyBook release gate · v${ver} · ${new Date().toISOString()}\n`);
const known=(()=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,'test/release/known.json'),'utf8')).map(k=>Object.assign(k,{re:new RegExp(k.id)}))}catch(e){return[]}})();
const knownOf=id=>known.find(k=>k.re.test(id));
if(flag('--quick'))process.env.MX_QUICK='1';
const b=await browser();const all=[];let blocked=false;const t0=Date.now();const fixedKnown=[];
for(const L of LAYERS){
  if(only.length&&!only.includes(L))continue;
  const mod=await import(`./checks/${L}.mjs`);const t=Date.now();let rows=[];
  try{rows=await mod.run(b,{accept:(L==='visual'&&flag('--accept-visual'))||(L==='perf'&&flag('--accept-perf'))})}catch(e){rows=[{id:L+'-crash',name:`${L} layer crashed: ${e.message}`,pass:false,detail:String(e.stack||'').slice(0,400)}]}
  rows.forEach(r=>{const k=knownOf(r.id);if(k){r.known=k.row;if(r.pass)fixedKnown.push(r.id)}});
  const fails=rows.filter(r=>!r.pass&&!r.known),kn=rows.filter(r=>!r.pass&&r.known);all.push(...rows.map(r=>({layer:L,...r})));
  const sec=((Date.now()-t)/1000).toFixed(0)+'s';
  console.log(`${fails.length?'✗':'✓'} ${L.padEnd(7)} ${String(rows.length-fails.length-kn.length).padStart(3)}/${rows.length} pass${kn.length?`, ${kn.length} known`:''}  ${sec}`);
  for(const f of fails){console.log(`    FAIL ${f.id}: ${f.name}${f.detail?'\n         '+f.detail.slice(0,300):''}`);blocked=true}
  for(const f of kn)console.log(`    KNOWN (backlog row ${f.known}) ${f.id}: ${f.name}`);
  if(L==='build'&&fails.length){console.log('\nbuild failed; later layers skipped');break}
}
await b.close();
if(fixedKnown.length)console.log(`\nThese known issues now pass; remove them from known.json and close their backlog rows:\n  ${fixedKnown.join('\n  ')}`);
const nk=all.filter(r=>!r.pass&&r.known).length;
console.log(`\n${blocked?'RELEASE BLOCKED':'RELEASE OK'} · ${all.filter(r=>r.pass).length}/${all.length} checks pass${nk?` · ${nk} known issues (logged in the backlog)`:''}${flag('--quick')?' · QUICK run: not valid for a release':''} · ${((Date.now()-t0)/1000).toFixed(0)}s`);
if(flag('--quick')&&!blocked)blocked=false;
if(flag('--json')||true){fs.mkdirSync(path.join(ROOT,'test/release/out'),{recursive:true});fs.writeFileSync(path.join(ROOT,'test/release/out/last.json'),JSON.stringify({version:ver,at:new Date().toISOString(),ok:!blocked,rows:all},null,1))}
process.exit(blocked?1:0);
