/* StoreyBook release gate
   node test/release/runner.mjs                 run every layer, print the table, exit 1 on any failure
   --only build,smoke   run some layers         --accept-visual  take the current screenshots as the new baseline
   --accept-perf        record current numbers  --json           also write test/release/out/last.json
   --quick              skip the slow matrix slices (layout, robust) for a fast check while working; a release always runs the full gate
   known.json           open bugs that are logged in the backlog: their checks still run and still show, as KNOWN, but do not block.
                        Every entry names its backlog row. A known check that starts passing is reported so the entry can be removed.
   matrix-su            the device checks again with SketchUp keys on (ids end in @su). Slices: MX_SU_FILES, or the default list below.
   Retry                a layer with failures is run once more (the matrix retries its own slices). A check that fails and then passes is
                        kept as FLAKY: listed, not blocking. SB_NORETRY=1 turns this off.
   Screenshots          a failing check leaves a picture of the page in use in test/release/out/shots (see row() in lib.mjs).
   The test kit (kit.mjs: npm run kit, kit:standard, kit:full) runs this and writes a report page from last.json.
*/
import fs from 'fs';import path from 'path';import {browser,appVersion,ROOT,flushShots,SHOT_DIR} from './lib.mjs';
const args=process.argv.slice(2);const flag=f=>args.includes(f);/* the last --only wins, so the kit's own list can be narrowed: npm run kit -- --only=build,smoke */const only=(args.filter(a=>a.startsWith('--only=')).pop()||'').slice(7).split(',').filter(Boolean);
const LAYERS=['build','load','golden','smoke','rules','except','users','matrix','matrix-su','detect','visual','perf','deploy'];
/* layers that run the whole matrix list unless --only names them */const OPT_IN=['matrix-su'];
/* the SketchUp-keys pass: every slice where keys, snapping, selection or the new tools can differ. Not phone2d (phone only) or layout (geometry) */
const SU_DEFAULT='edit-create,tablet-desktop,views-building,shell,view3d,data,objects,robust';
const RETRY=new Set(['load','golden','smoke','rules','except','users','detect','visual','perf']);
const ver=appVersion();console.log(`StoreyBook release gate · v${ver} · ${new Date().toISOString()}\n`);
const known=(()=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,'test/release/known.json'),'utf8')).map(k=>Object.assign(k,{re:new RegExp(k.id)}))}catch(e){return[]}})();
const knownOf=id=>known.find(k=>k.re.test(id));
if(flag('--quick'))process.env.MX_QUICK='1';
fs.rmSync(SHOT_DIR,{recursive:true,force:true});
const b=await browser();const all=[];const stats=[];let blocked=false;const t0=Date.now();const fixedKnown=[];
async function runLayer(L,accept,fresh){
  const file=L==='matrix-su'?'matrix':L;const mod=await import(`./checks/${file}.mjs${fresh?'?r='+Date.now():''}`);
  const keep={SB_SUKEYS:process.env.SB_SUKEYS,MX_FILES:process.env.MX_FILES};
  if(L==='matrix-su'){process.env.SB_SUKEYS='1';const want=(process.env.MX_SU_FILES||SU_DEFAULT).split(',');process.env.MX_FILES=(keep.MX_FILES?want.filter(f=>keep.MX_FILES.split(',').includes(f)):want).join(',')||'none'}
  try{let rows=await mod.run(b,{accept});if(L==='matrix-su')rows=rows.map(r=>({...r,id:r.id+'@su',name:r.name+' (SketchUp keys)'}));return rows}
  catch(e){return [{id:L+'-crash',name:`${L} layer crashed: ${e.message}`,pass:false,detail:String(e.stack||'').slice(0,400)}]}
  finally{for(const k in keep){if(keep[k]==null)delete process.env[k];else process.env[k]=keep[k]}await flushShots()}}
for(const L of LAYERS){
  if(only.length?!only.includes(L):OPT_IN.includes(L))continue;
  const t=Date.now();const accept=(L==='visual'&&flag('--accept-visual'))||(L==='perf'&&flag('--accept-perf'));
  let rows=await runLayer(L,accept,false);
  /* one more run for a layer that failed: a check that passes the second time was a timing fluke, not a bug */
  const bad=rows.filter(r=>!r.pass&&!knownOf(r.id));
  if(bad.length&&RETRY.has(L)&&!process.env.SB_NORETRY&&!accept){console.log(`  … ${L}: ${bad.length} failed, running the layer once more to tell bugs from timing flukes`);
    const again=new Map((await runLayer(L,false,true)).map(r=>[r.id,r]));
    rows=rows.map(r=>{const a=again.get(r.id);return !r.pass&&a&&a.pass?{...a,detail:'FLAKY (failed, then passed on a second run): '+String(r.detail||'').slice(0,300)}:r})}
  rows.forEach(r=>{if(r.pass&&/^FLAKY/.test(String(r.detail||'')))r.flaky=true;const k=knownOf(r.id);if(k){r.known=k.row;if(r.pass)fixedKnown.push(r.id)}});
  const fails=rows.filter(r=>!r.pass&&!r.known),kn=rows.filter(r=>!r.pass&&r.known),fl=rows.filter(r=>r.flaky);all.push(...rows.map(r=>({layer:L,...r})));
  const sec=Math.round((Date.now()-t)/1000);stats.push({layer:L,checks:rows.length,fail:fails.length,known:kn.length,flaky:fl.length,sec});
  console.log(`${fails.length?'✗':'✓'} ${L.padEnd(9)} ${String(rows.length-fails.length-kn.length).padStart(4)}/${rows.length} pass${kn.length?`, ${kn.length} known`:''}${fl.length?`, ${fl.length} flaky`:''}  ${sec}s`);
  for(const f of fails){console.log(`    FAIL ${f.id}: ${f.name}${f.detail?'\n         '+String(f.detail).slice(0,300):''}`);blocked=true}
  for(const f of fl)console.log(`    FLAKY ${f.id}: ${f.name}`);
  for(const f of kn)console.log(`    KNOWN (backlog row ${f.known}) ${f.id}: ${f.name}`);
  if(L==='build'&&fails.length){console.log('\nbuild failed; later layers skipped');break}
}
await b.close();
if(fixedKnown.length)console.log(`\nThese known issues now pass; remove them from known.json and close their backlog rows:\n  ${fixedKnown.join('\n  ')}`);
const nk=all.filter(r=>!r.pass&&r.known).length,nf=all.filter(r=>r.flaky).length;
console.log(`\n${blocked?'RELEASE BLOCKED':'RELEASE OK'} · ${all.filter(r=>r.pass).length}/${all.length} checks pass${nf?` · ${nf} flaky (passed on a second run)`:''}${nk?` · ${nk} known issues (logged in the backlog)`:''}${flag('--quick')?' · QUICK run: not valid for a release':''} · ${((Date.now()-t0)/1000).toFixed(0)}s`);
fs.mkdirSync(path.join(ROOT,'test/release/out'),{recursive:true});fs.writeFileSync(path.join(ROOT,'test/release/out/last.json'),JSON.stringify({version:ver,at:new Date().toISOString(),ok:!blocked,sec:Math.round((Date.now()-t0)/1000),args,layers:stats,rows:all},null,1));
process.exit(blocked?1:0);
