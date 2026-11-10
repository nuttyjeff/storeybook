/* combines the last.json of every gate part into one table for the GitHub run page; exits 1 if any part blocked */
import fs from 'fs';import path from 'path';
const dir=process.argv[2]||'results';let ok=true,all=[],parts=[];
for(const d of fs.existsSync(dir)?fs.readdirSync(dir):[]){const f=path.join(dir,d,'last.json');if(!fs.existsSync(f)){parts.push([d.replace(/^result-/,''),'no result',0,0,0]);ok=false;continue}
  const j=JSON.parse(fs.readFileSync(f,'utf8'));const rows=j.rows||[];const fails=rows.filter(r=>!r.pass&&!r.known),kn=rows.filter(r=>!r.pass&&r.known);
  if(!j.ok)ok=false;all.push(...fails.map(r=>[d.replace(/^result-/,''),r]));parts.push([d.replace(/^result-/,''),j.ok?'OK':'BLOCKED',rows.length,rows.length-fails.length-kn.length,kn.length])}
console.log(`## ${ok?'✅ RELEASE OK':'❌ RELEASE BLOCKED'}\n\n| Part | Result | Checks | Pass | Known |\n|---|---|---:|---:|---:|`);
for(const p of parts)console.log(`| ${p.join(' | ')} |`);
const t=parts.reduce((a,p)=>[a[0]+p[2],a[1]+p[3],a[2]+p[4]],[0,0,0]);console.log(`| **Total** | | ${t[0]} | ${t[1]} | ${t[2]} |`);
if(all.length){console.log('\n### Failures\n');for(const[p,r]of all)console.log(`- **${p}** \`${r.id}\` ${r.name}${r.detail?` — ${String(typeof r.detail==='string'?r.detail:JSON.stringify(r.detail)).slice(0,200)}`:''}`)}
process.exit(ok?0:1);
