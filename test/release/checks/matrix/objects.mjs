/* matrix slice: exhaustive per-object coverage (ids mx-ob-*).
   Part 1 (lib1..3): every library item (the app's own LIB, imported with a unit rate on every row through Library > Import) is
           placed through the library row -> plan click path (a real mouse click on the row and R before placing for the first
           item of each category in a share) and checked in 2D, 3D, the Schedule and a save -> File > Open round trip. One row per item.
   Part 2 (fitems, fother: 2D view, 3D rebuilt with build3D; f3items, f3other: a sample in the live 3D view; phone: P2 sheet):
           every Details field of every object type through its real control, value / 2D / 3D / Schedule, then Ctrl+Z.
   Part 3 (ops): every object type rotates 4 x 90 deg back to its JSON, duplicates (id + shift only), deletes and undoes; Add points.
   MX_OB_ONLY=<regex> picks page groups, MX_OB_FIELD / MX_OB_OP filter field / operation ids (mutation testing).
   Mutations (/tmp/mx-ob/mutate.mjs applies each to a copy of app.js, builds, runs the filtered groups) - FAIL confirmed for all:
   // mutation: app.js ~1621 inspector input: numeric item field not assigned (o[f]=n removed) → FAIL confirmed (f-item-w,d,h,x,cf; p-f-w)
   // mutation: app.js ~1613 room MIG select ignored (if(0)o.ent=v) → FAIL confirmed (f-room-ment)
   // mutation: app.js ~1682 applyColor does not set the colour → FAIL confirmed (f-room-floor/wall-col swatch + wheel)
   // mutation: app.js ~1622 Arm rests tick box ignored → FAIL confirmed (f-item-arms, p-f-arms)
   // mutation: app.js ~1639 section Turn off button does not toggle → FAIL confirmed (f-section-toggle)
   // mutation: app.js ~525 shapeSVG default rect drawn 5 mm too wide → FAIL confirmed (lib rect items, f-item-w)
   // mutation: app.js ~3194 furnitureModel height 90 % of h → FAIL confirmed (lib furniture, f-item-h)
   // mutation: app.js ~1724 scheduleData counts repeats twice → FAIL confirmed (lib CH-TASK, sets, schedule-total)
   // mutation: app.js ~166 normObj drops item rotation on open → FAIL confirmed (lib rotated items after reopen)
   // mutation: app.js ~939 ghostAt ignores the placing rotation → FAIL confirmed (lib real-click items)
   // mutation: app.js ~1609 inspector edit pushes no undo point → FAIL confirmed (f-item-w, f-item-label)
   // mutation: app.js ~1395 rotateSel adds 1° per turn → FAIL confirmed (op-rot-it, op-rot-ch)
   // mutation: app.js ~1416 pasteClip copy not shifted → FAIL confirmed (op-dup-it, op-dup-r1)
   // mutation: app.js ~1406 deleteSel without checkpoint → FAIL confirmed (op-del-it, op-del-tx)
   // mutation: app.js ~558 wall stroke-width +1 → FAIL confirmed (f-wall-th);  ~584 text font-size +1 → FAIL confirmed (f-text-size)
   // mutation: app.js ~483 road stroke-width fixed 6000 → FAIL confirmed (f-road-th);  ~3119 trunk 3D width fixed → FAIL confirmed (f-trunk-w)
   // mutation: app.js ~2989 room raise ignored in 3D → FAIL confirmed (f-room-raise);  ~1490 pin Done ignored → FAIL confirmed (f-pin-done)
   // mutation: app.js ~2960 schedule3D never rebuilds the live 3D view → FAIL confirmed (f-item-w-3d) */
import {openApp,row,to3D,to2D,touch} from '../../lib.mjs';
export const name='matrix-objects';
const ONLY=process.env.MX_OB_ONLY?new RegExp(process.env.MX_OB_ONLY):null;
const DUMP=!!process.env.MX_OB_DUMP;
const URLO=()=>process.env.SB_URL?{url:process.env.SB_URL}:{};
const ev=(pg,fn,a)=>pg.evaluate(fn,a);
const wf=(pg,fn,a,t=5000)=>pg.waitForFunction(fn,a,{timeout:t,polling:30}).then(()=>true,()=>false);
const blur=pg=>ev(pg,()=>{const a=document.activeElement;if(a&&a!==document.body&&a.blur)a.blur()});

/* ---------- CSV helpers: the built-in library with a distinct unit rate on every row, imported through Library > Import ---------- */
function csvRows(t){const out=[];let r=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];
  if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
  else if(c==='"')q=true;else if(c===','){r.push(f);f=''}else if(c==='\n'){r.push(f);out.push(r);r=[];f=''}else if(c!=='\r')f+=c}
  if(f!==''||r.length){r.push(f);out.push(r)}return out}
const csvCell=v=>/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
const rateOf=code=>{let h=0;for(const ch of code)h=(h*31+ch.charCodeAt(0))%9000;return 100+h};/* stable, distinct-enough rate per code */
function ratedCSV(text){const R=csvRows(text);const hd=R[0];const ri=hd.indexOf('unit_rate'),ci=hd.indexOf('code');
  return R.map((r,i)=>{if(i===0||r.length<hd.length)return r.map(csvCell).join(',');const c=r.slice();c[ri]=String(rateOf(c[ci]));return c.map(csvCell).join(',')}).join('\n')+'\n'}

/* ---------- part 1: library items ---------- */
const PITCH=14000;/* each item gets its own 14 m cell, far beyond any snap distance */
async function libSetup(b){
  const pg=await openApp(b,Object.assign({sample:false},URLO()));
  await ev(pg,()=>{const o=window.__osp;o.toastOff();if(!o.P().lib)document.querySelector('#t-lib').click()});
  const csv=await ev(pg,()=>DEFAULT_LIB_CSV);
  await pg.setInputFiles('#f-lib',{name:'rated-library.csv',mimeType:'text/csv',buffer:Buffer.from(ratedCSV(csv))});
  pg.libOk=await wf(pg,()=>{const L=window.__osp.LIB();return L.length>100&&L.filter(l=>l.shape!=='set').every(l=>l.rate>=100)});
  return pg}
/* point the 2D view at world (cx,cy) at a fixed zoom */
async function viewAt(pg,cx,cy,k=0.05){await ev(pg,([cx,cy,k])=>{const o=window.__osp,V=o.V,r=document.querySelector('#plan').getBoundingClientRect();V.k=k;V.x=cx-r.width/2/k;V.y=cy-r.height/2/k;
  document.querySelector('#plan').dispatchEvent(new WheelEvent('wheel',{deltaY:0,clientX:r.left+5,clientY:r.top+5,bubbles:true,cancelable:true}));o.toastOff()},[cx,cy,k]);
  await wf(pg,([cx,cy])=>{const V=window.__osp.V,vb=document.querySelector('#plan').getAttribute('viewBox').split(' ').map(Number);return Math.abs(vb[0]-V.x)<1&&Math.abs(vb[1]-V.y)<1},[cx,cy])}
const W2S=(pg,wx,wy)=>ev(pg,([wx,wy])=>{const V=window.__osp.V,r=document.querySelector('#plan').getBoundingClientRect();return [r.left+(wx-V.x)*V.k,r.top+(wy-V.y)*V.k]},[wx,wy]);

/* place LIB[i] at world (cx,cy). real=true: a real mouse click on the library row and R pressed once (rotate 90°) */
async function placeOne(pg,i,cx,cy,real){
  const before=await ev(pg,()=>window.__osp.S().objs.map(o=>o.id));const e0=pg.errs.length;
  await viewAt(pg,cx,cy);
  const rowSel=`#lib-list [data-li="${i}"]`;
  if(real)await clickEl(pg,loc_(rowSel));else await ev(pg,s=>document.querySelector(s).click(),rowSel);
  const placing=await wf(pg,i=>{const b=document.querySelector(`#lib-list [data-li="${i}"]`);return b&&b.classList.contains('on')&&document.querySelector('#plan').classList!=null},i);
  const [sx,sy]=await W2S(pg,cx,cy);
  await pg.mouse.move(sx-30,sy-30);await pg.mouse.move(sx,sy);
  if(real)await pg.keyboard.press('r');
  const hit=await ev(pg,([x,y])=>{const e=document.elementFromPoint(x,y);return e&&!!e.closest('#plan')},[sx,sy]);
  await pg.mouse.click(sx,sy);
  await wf(pg,n=>window.__osp.S().objs.length>n,before.length);
  await pg.keyboard.press('Escape');await wf(pg,()=>!document.querySelector('#lib-list .lib-row.on'));
  const added=await ev(pg,b=>JSON.parse(JSON.stringify(window.__osp.S().objs.filter(o=>!b.includes(o.id)))),before);
  await wf(pg,ids=>ids.every(id=>document.querySelector(`#plan [data-id="${id}"]`)),added.map(o=>o.id),5000);/* render runs on the next animation frame */
  return {i,added,placing,hit,real,errs:pg.errs.slice(e0)}}

/* 2D: every added object is drawn; footprint of its outline (class b, plus the boom arm) in world mm equals w x d after rotation */
const measure2D=(pg,ids)=>ev(pg,ids=>{const o=window.__osp;return ids.map(id=>{const g=document.querySelector(`#plan [data-id="${id}"]`);if(!g)return {id,drawn:false};
  const ob=o.byId(id);const parts=[...g.querySelectorAll(':scope > .b, :scope > .env')];if(ob.shape==='boom')parts.push(...g.querySelectorAll(':scope > .d'));
  const m=g.transform.baseVal.consolidate();const M=m?m.matrix:{a:1,b:0,c:0,d:1,e:0,f:0};let x0=1e18,y0=1e18,x1=-1e18,y1=-1e18;
  parts.forEach(p=>{const bb=p.getBBox();[[bb.x,bb.y],[bb.x+bb.width,bb.y],[bb.x,bb.y+bb.height],[bb.x+bb.width,bb.y+bb.height]].forEach(([x,y])=>{const X=M.a*x+M.c*y+M.e,Y=M.b*x+M.d*y+M.f;x0=Math.min(x0,X);x1=Math.max(x1,X);y0=Math.min(y0,Y);y1=Math.max(y1,Y)})});
  return {id,drawn:true,parts:parts.length,x0,y0,x1,y1}})},ids);
/* 3D: the scene group carrying userData.id, its world AABB in mm */
const measure3D=(pg,ids)=>ev(pg,ids=>{const T=window.__osp.T3(),THREE=T.THREE;const by={};T.group.children.forEach(c=>{if(c.userData.id)(by[c.userData.id]=by[c.userData.id]||[]).push(c)});
  return ids.map(id=>{const gs=by[id];if(!gs)return {id,in3D:false};const bx=new THREE.Box3();let meshes=0;gs.forEach(g=>{g.updateMatrixWorld(true);g.traverse(m=>{if(m.isMesh)meshes++});bx.expandByObject(g)});
    const ob=window.__osp.byId(id);let maxR=0;const v=new THREE.Vector3();gs.forEach(g=>g.traverse(m=>{if(!m.isMesh||!m.geometry.attributes.position)return;const pa=m.geometry.attributes.position;for(let i=0;i<pa.count;i++){v.fromBufferAttribute(pa,i).applyMatrix4(m.matrixWorld);maxR=Math.max(maxR,Math.hypot(v.x*1000-ob.x,v.z*1000-ob.y))}}));
    return {id,in3D:true,meshes,maxR,x0:bx.min.x*1000,x1:bx.max.x*1000,y0:bx.min.y*1000,y1:bx.max.y*1000,z0:bx.min.z*1000,z1:bx.max.z*1000}})},ids);
/* Schedule tab: parse the furniture table */
const readSchedule=pg=>ev(pg,()=>{const t=[...document.querySelectorAll('#p-sch table.sch')].find(t=>/Qty/.test(t.querySelector('thead').textContent));if(!t)return null;
  const hasAmt=/Amount/.test(t.querySelector('thead').textContent);const lines=[...t.querySelectorAll('tbody tr')].filter(tr=>tr.querySelector('td .muted')).map(tr=>{const td=tr.querySelectorAll('td');const sub=td[0].querySelector('.muted').textContent;
    return {name:td[0].childNodes[0].textContent,code:sub.split(' · ')[0],size:sub.split(' · ')[1],qty:+td[1].textContent,seats:+(td[2].textContent||0),amt:hasAmt?+(td[3].textContent.replace(/[^0-9.-]/g,'')||NaN):null}});
  const ft=t.querySelector('tfoot');return {hasAmt,lines,total:ft?+ft.querySelectorAll('td')[1].textContent.replace(/\D/g,''):null,cost:ft?+ft.querySelectorAll('td')[3].textContent.replace(/[^0-9.-]/g,''):null}});

/* what each library entry should become: its components (sets) or itself */
function expandLib(L,l){if(l.shape!=='set')return [l];return l.comps.map(c=>L.find(z=>z.code===c.code&&z.shape!=='set')).filter(Boolean)}
const rotDims=(w,d,r)=>((((r||0)%180)+180)%180)===90?[d,w]:[w,d];

/* 3D rules for one placed item (m = world AABB of its scene group in mm, maxR = furthest vertex from its plan centre):
   - it stands at its plan position (plan centre inside the model's box);
   - footprint: the model never reaches beyond the plan outline by more than TOL (what the plan shows bounds what is built, and
     clash / clearance checks use the plan outline), and it fills at least 75 % of each plan size (a model ignoring w or d fails).
     Round things are judged on their swept diameter; doors on their leaf span (leaves stand open in 3D); windows on width along the
     wall and thickness within the wall;
   - height: floor items run 0..h; h = 0 columns and cores run to the 3D wall height; windows sill..sill+h (full height: floor to
     ceiling); ceiling items hang with the body's underside at ceiling - drop - h; desk screens stand on a 730 mm desk top.
   TOL = max(30 mm, 3 %): handles and trims may stand proud by that much. */
const TOL=v=>Math.max(30,Math.abs(v)*0.03);
const ROUNDISH=['round','colr','tree','fan','cctv','det','spk','wap','pir','spr','dl','pend'];
/* world bounding box of an item's overall size (envOf from the app; the plain box when the app has none) */
function envBox(o,e){const E=e||{x0:-o.w/2,x1:o.w/2,y0:-o.d/2,y1:o.d/2};const a=(o.r||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);const pts=[[E.x0,E.y0],[E.x1,E.y0],[E.x1,E.y1],[E.x0,E.y1]].map(([x,y])=>[o.x+x*c-y*s,o.y+x*s+y*c]);
  return {x0:Math.min(...pts.map(p=>p[0])),x1:Math.max(...pts.map(p=>p[0])),y0:Math.min(...pts.map(p=>p[1])),y1:Math.max(...pts.map(p=>p[1]))}}
function check3D(o,m,H,env){const f=[],c=o.code,eb=envBox(o,env&&env.grown?env:null),W=Math.round(eb.x1-eb.x0),D=Math.round(eb.y1-eb.y0),sx=m.x1-m.x0,sz=m.z1-m.z0,q=v=>Math.round(v);
  if(/^door/.test(o.shape)){/* open leaves hang from a jamb: the model must touch the plan outline of the opening */const hx=W/2,hz=D/2;if(m.x1<o.x-hx-1||m.x0>o.x+hx+1||m.z1<o.y-hz-1||m.z0>o.y+hz+1)f.push(`3D: ${c} leaves not at the door's plan position`)}
  else if(!(o.x>=m.x0-1&&o.x<=m.x1+1&&o.y>=m.z0-1&&o.y<=m.z1+1))f.push(`3D: ${c} not at its plan position`);
  if(/^door/.test(o.shape)){const L=Math.max(sx,sz);if(Math.abs(L-o.w)>TOL(o.w))f.push(`3D: ${c} leaf span ${q(L)} ≠ door width ${o.w}`)}
  else if(o.shape==='window'){const along=W>=D?sx:sz,thru=W>=D?sz:sx;if(Math.abs(along-o.w)>TOL(o.w))f.push(`3D: ${c} ${q(along)} along the wall ≠ ${o.w}`);if(thru>o.d+1)f.push(`3D: ${c} ${q(thru)} thick, beyond ${o.d}`)}
  else if(ROUNDISH.includes(o.shape)){const dia=2*m.maxR;if(dia>Math.max(o.w,o.d)+TOL(o.w))f.push(`3D: ${c} spans ${q(dia)}, beyond its ${Math.max(o.w,o.d)} plan outline`);if(dia<0.75*Math.min(o.w,o.d))f.push(`3D: ${c} spans only ${q(dia)} of ${Math.min(o.w,o.d)}`)}
  else{if(sx>W+TOL(W))f.push(`3D: ${c} ${q(sx)} across, beyond its ${W} plan outline`);if(sz>D+TOL(D))f.push(`3D: ${c} ${q(sz)} deep, beyond its ${D} plan outline`);
    if(sx<0.75*W)f.push(`3D: ${c} only ${q(sx)} of ${W} across`);if(sz<0.75*D)f.push(`3D: ${c} only ${q(sz)} of ${D} deep`)}
  let bot=null,top=null;
  if(o.shape==='window'){bot=o.h>0?(o.sill||0):0;top=o.h>0?bot+o.h:H.ceil}
  else if(o.cat==='Ceiling'){bot=H.ceil-(o.drop||0)-Math.max(10,env&&env.under||o.h||50);if(m.y1>H.ceil+5)f.push(`3D: ${c} pokes ${q(m.y1-H.ceil)} above the ceiling`)}
  else if(o.cat==='Core'||o.shape==='col'||o.shape==='colr'){bot=0;top=o.h>0?o.h:H.wallH}
  else if(/desk screen/i.test(o.name||'')){top=730+o.h}
  else{bot=0;top=Math.max(30,env&&env.top>(o.h||0)?env.top:(o.h||0))}
  if(bot!=null&&Math.abs(m.y0-bot)>TOL(o.h||100))f.push(`3D: ${c} underside at ${q(m.y0)} ≠ ${bot}`);
  if(top!=null&&Math.abs(m.y1-top)>TOL(top))f.push(`3D: ${c} top at ${q(m.y1)} ≠ ${top}`);
  return f}

async function libGroup(b,part,N){
  const out=[];const tag=`lib${part+1}`;let pg;
  try{
    pg=await libSetup(b);
    if(part===0)out.push(row('mx-ob-lib-import','library import with unit rates loads every built-in item with its rate',pg.libOk));
    const L=await ev(pg,()=>JSON.parse(JSON.stringify(window.__osp.LIB())));
    const idx=L.map((l,i)=>i).filter(i=>i%N===part);
    /* a real click on the library row for the first item of each category in this share */
    const seenCat=new Set();const P=[];const T0=Date.now();const tm=k=>{if(DUMP)console.log('T',part,k,Date.now()-T0)};
    for(let n=0;n<idx.length;n++){const i=idx[n];const l=L[i];const real=!seenCat.has(l.cat);seenCat.add(l.cat);
      const cx=(n%6)*PITCH,cy=Math.floor(n/6)*PITCH;P.push(await placeOne(pg,i,cx,cy,real))}
    tm('placed');const allIds=P.flatMap(p=>p.added.map(o=>o.id));
    const m2=Object.fromEntries((await measure2D(pg,allIds)).map(m=>[m.id,m]));
    /* schedule */
    await pg.click('[data-tab=sch]');await wf(pg,()=>!!document.querySelector('#p-sch table.sch'));const SC=await readSchedule(pg);
    const exp={};P.forEach(p=>p.added.forEach(o=>{const lib=L.find(z=>z.code===o.code&&z.shape!=='set');const k=o.code;exp[k]=exp[k]||{qty:0,seats:0,rate:lib?lib.rate:null,w:lib&&lib.w,d:lib&&lib.d,name:lib&&lib.name};exp[k].qty++;exp[k].seats+=(+(lib&&lib.seats)||0)}));
    const expCost=Object.values(exp).reduce((a,e)=>a+e.rate*e.qty,0);
    await pg.click('[data-tab=sel]');
    /* 3D */
    tm('2d+sch');await to3D(pg);await wf(pg,n=>{const T=window.__osp.T3();return T&&T.group.children.filter(c=>c.userData.id).length>=n},allIds.length,15000);
    const m3=Object.fromEntries((await measure3D(pg,allIds)).map(m=>[m.id,m]));
    /* the wall height and ceiling in 3D for this plan: from a reference wall drawn in an empty corner? read from build3D's own inputs */
    /* the 3D ceiling and wall heights build3D uses for this floor (app.js build3D: ceilH, wallH) */
    const H3=await ev(pg,()=>{const P=window.__osp.P(),S=window.__osp.S(),b=S.bld;let ceil=2800;if(b){const L=b.levels,l=L.find(l=>l.id===b.active)||L[L.findIndex(l=>l.kind!=='B')]||L[0];ceil=l.ceiling!=null&&l.ceiling!==''?+l.ceiling:+b.ceiling}
      const wallH=P.wall3d==='full'&&b?ceil:(P.wall3d==='half'?1200:(P.wall3d==='off'?0:2800));return {wallH,ceil}});
    const objsBefore=await ev(pg,()=>JSON.stringify(window.__osp.S().objs));
    tm('3d');await pg.click('#v2d');
    /* save -> reopen through File > Open (the file input) */
    const text=await ev(pg,()=>window.__osp.planJSON());
    await pg.setInputFiles('#f-plan',{name:'mx-ob-roundtrip.json',mimeType:'application/json',buffer:Buffer.from(text)});
    await wf(pg,n=>window.__osp.S().name==='mx-ob-roundtrip'||window.__osp.tabs().length>1,null);
    await wf(pg,n=>window.__osp.S().objs.length===n,allIds.length);
    tm('reopen');const reo=await ev(pg,()=>Object.fromEntries(window.__osp.S().objs.map(o=>[o.id,JSON.stringify(o)])));
    const was=Object.fromEntries(JSON.parse(objsBefore).map(o=>[o.id,JSON.stringify(o)]));
    if(DUMP)console.log(JSON.stringify({P:P.map(p=>({code:L[p.i].code,added:p.added.map(o=>({id:o.id,code:o.code,shape:o.shape,cat:o.cat,w:o.w,d:o.d,h:o.h,r:o.r,x:o.x,y:o.y})),m2:p.added.map(o=>m2[o.id]),m3:p.added.map(o=>m3[o.id])})),SC,H3}));
    /* the app's own overall size for each item (dashed outline on the plan when the model is bigger than the item's box) */
    const ENV=await ev(pg,os=>Object.fromEntries(os.map(o=>[o.id,window.__osp.envOf?window.__osp.envOf(o):null])),P.flatMap(p=>p.added));
    for(const p of P){const l=L[p.i];const want=expandLib(L,l);const f=[];
      if(!p.placing)f.push('library row did not arm placing');if(p.real&&!p.hit)f.push('click point not on the plan');
      if(p.added.length!==want.length)f.push(`placed ${p.added.length} objects, expected ${want.length}`);
      const codes=p.added.map(o=>o.code).sort().join(','),wc=want.map(z=>z.code).sort().join(',');if(codes!==wc)f.push(`codes ${codes} ≠ ${wc}`);
      if(p.real&&l.shape!=='set'&&p.added[0]&&p.added[0].r!==90)f.push(`R before placing gave r=${p.added[0]&&p.added[0].r}, expected 90`);
      /* 2D */
      for(const o of p.added){const m=m2[o.id];if(!m||!m.drawn){f.push(`2D: ${o.code} not drawn`);continue}if(!m.parts){f.push(`2D: ${o.code} has no outline`);continue}
        const [W,D]=rotDims(o.w,o.d,o.r);const lw=want.find(z=>z.code===o.code);
        if(lw&&(o.w!==lw.w||o.d!==lw.d||o.h!==lw.h))f.push(`object ${o.code} ${o.w}×${o.d}×${o.h} ≠ library ${lw.w}×${lw.d}×${lw.h}`);
        const eb=envBox(o,ENV[o.id]);if(Math.abs((m.x1-m.x0)-(eb.x1-eb.x0))>1||Math.abs((m.y1-m.y0)-(eb.y1-eb.y0))>1)f.push(`2D: ${o.code} footprint ${(m.x1-m.x0).toFixed(1)}×${(m.y1-m.y0).toFixed(1)} ≠ ${W}×${D}${ENV[o.id]&&ENV[o.id].grown?' (overall '+(eb.x1-eb.x0)+'×'+(eb.y1-eb.y0)+')':''}`);
        if(Math.abs((m.x0+m.x1)/2-(eb.x0+eb.x1)/2)>1||Math.abs((m.y0+m.y1)/2-(eb.y0+eb.y1)/2)>1)f.push(`2D: ${o.code} drawn off its centre`)}
      if(l.shape==='set'&&p.added.length){let x0=1e18,y0=1e18,x1=-1e18,y1=-1e18;p.added.forEach(o=>{const m=m2[o.id];if(m&&m.drawn){x0=Math.min(x0,m.x0);y0=Math.min(y0,m.y0);x1=Math.max(x1,m.x1);y1=Math.max(y1,m.y1)}});
        const [SW,SD]=rotDims(l.w,l.d,p.real?90:0);if(Math.abs((x1-x0)-SW)>1||Math.abs((y1-y0)-SD)>1)f.push(`2D: set outline ${(x1-x0).toFixed(0)}×${(y1-y0).toFixed(0)} ≠ library ${SW}×${SD}`);
        if(new Set(p.added.map(o=>o.gid)).size!==1||!p.added[0].gid)f.push('set parts are not one group')}
      /* 3D */
      for(const o of p.added){const m=m3[o.id];if(!m||!m.in3D){f.push(`3D: ${o.code} missing from the scene`);continue}if(!m.meshes){f.push(`3D: ${o.code} has no mesh`);continue}
        f.push(...check3D(o,m,H3,ENV[o.id]))}
      /* schedule */
      if(!SC)f.push('schedule: no furniture table');else{if(!SC.hasAmt)f.push('schedule: no Amount column although every item has a rate');
        for(const z of new Set(p.added.map(o=>o.code))){const e=exp[z];const ln=SC.lines.filter(x=>x.code===z);if(ln.length!==1){f.push(`schedule: ${ln.length} lines for ${z}`);continue}const x=ln[0];
          if(x.qty!==e.qty)f.push(`schedule: ${z} qty ${x.qty} ≠ ${e.qty}`);if(x.seats!==e.seats)f.push(`schedule: ${z} seats ${x.seats} ≠ ${e.seats}`);if(x.amt!==e.rate*e.qty)f.push(`schedule: ${z} amount ${x.amt} ≠ ${e.rate*e.qty}`);
          if(x.name!==e.name)f.push(`schedule: ${z} name "${x.name}" ≠ "${e.name}"`)}}
      /* round trip */
      for(const o of p.added)if(reo[o.id]!==was[o.id])f.push(`reopen: ${o.code} changed`+(reo[o.id]?'':' (missing)'));
      if(p.errs.length)f.push('console: '+p.errs.join(' | '));
      out.push(row(`mx-ob-lib-${l.code}`,`library item ${l.name} (${l.code}) places${p.real?' by real click, rotated with R,':''} and matches in 2D, 3D, Schedule and after reopen`,!f.length,f.join('; ')))}
    if(SC)out.push(row(`mx-ob-lib-schedule-total-${part+1}`,`Schedule totals for library share ${part+1}: item count and cost`,SC.total===allIds.length&&SC.cost===expCost,{total:SC.total,want:allIds.length,cost:SC.cost,wantCost:expCost}));
    out.push(row(`mx-ob-lib-errors-${part+1}`,`library share ${part+1}: no console errors`,!pg.errs.length,pg.errs.slice(0,5).join(' | ')));
  }catch(e){out.push(row(`mx-ob-${tag}-crash`,`library share ${part+1} ran to the end`,false,String(e&&e.stack||e).slice(0,400)))}
  finally{if(pg)await pg.ctx.close()}
  return out}

/* ---------- parts 2 and 3: a fixture with one object of every type ---------- */
/* fixture (mm). Items are copied from the app's own LIB entries the way itemFromLib builds them. */
function fixture(){const L=window.__osp.LIB();const lib=c=>L.find(l=>l.code===c);
  const it=(id,code,x,y,ex)=>{const l=lib(code);return Object.assign({id,t:'item',arms:l.shape==='chair'?true:undefined,code:l.code,name:l.name,cat:l.cat,shape:l.shape,w:l.w,d:l.d,h:l.h,a:l.a,seats:l.seats,cf:l.cf,cb:l.cb,nests:!!l.nests,rate:l.rate,pts:null,x,y,r:0,gid:null,label:'',
    sill:l.shape==='window'?(+l.a||0):undefined,drop:l.cat==='Ceiling'?(+l.a||0):undefined,from:l.cat==='Core'?null:undefined,to:l.cat==='Core'?null:undefined,roof:l.cat==='Core'?l.shape==='stair':undefined,cov:l.cat==='Ceiling'?0:undefined,
    tilt:/^cctv/.test(l.shape)?20:undefined,fov:/^cctv/.test(l.shape)?90:undefined,range:/^cctv/.test(l.shape)?15000:undefined},ex||{})};
  const cus=(id,shape,x,y,w,d,ex)=>Object.assign({id,t:'item',code:'CUSTOM',name:{round:'Custom round',L:'Custom L-shape',poly:'Custom polygon'}[shape]||'Custom rectangle',cat:'Custom',shape,w,d,h:750,a:Math.round(Math.min(w,d)/2),seats:0,cf:0,cb:0,nests:false,rate:null,pts:null,x,y,r:0,gid:null,label:''},ex||{});
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  return {name:'mx-ob fixture',objs:[
    it('it','WS1260',2000,2000),it('ld','LD1616',6000,2000),it('ch','CH-TASK',10000,2000),it('col','C400',13000,2000),
    it('st','ST2654',18000,4000),it('lf','LF2022',23000,3000),
    {id:'w1',t:'wall',pts:[[0,8000],[6000,8000]],closed:false,th:150,gid:null},it('wn','WN1200',1500,8000),it('dr','DR900',4500,8000),
    it('lp','LP6060',2000,12000),it('cam','CCTV-D',6000,12000),
    cus('cr','rect',10000,12000,1000,800),cus('cro','round',13000,12000,900,900),cus('cl','L',16000,12000,1600,1400),
    cus('cp','poly',19500,12000,1200,1000,{a:0,pts:[[-600,-500],[600,-500],[600,500],[-200,500]]}),
    {id:'r1',t:'room',name:'Office',pts:rect(0,15000,5000,19000),gid:null},
    {id:'tx',t:'text',x:9000,y:8500,text:'Label',size:300,gid:null},
    {id:'dm',t:'dim',a:[12000,8500],b:[16000,8500],gid:null},
    {id:'tk',t:'trunk',pts:[[14000,6500],[20000,6500]],w:150,h:100,drop:30,gid:null},
    {id:'fe',t:'wall',site:'fence',pts:[[-3000,-3000],[30000,-3000],[30000,22000]],closed:false,th:150,h:2400,gid:null},
    {id:'rd',t:'wall',site:'road',pts:[[-3000,25000],[30000,25000]],closed:false,th:6000,gid:null}],
    pins:[{id:'p1',x:9000,y:17000,text:'',done:false}],section:{a:[-2000,10000],b:[28000,10000],on:true,flip:false}}}

/* helpers injected into each fixture page */
function injectHelpers(){window.__mx={
  q:(id,sub)=>document.querySelector(`#plan [data-id="${id}"]${sub?' '+sub:''}`),
  attr:(id,sub,a)=>{const e=window.__mx.q(id,sub);return e?e.getAttribute(a):null},
  g3:id=>{const T=window.__osp.T3();const out=[];if(!T||!T.group)return out;T.group.children.forEach(c=>{if(c.userData&&c.userData.id===id)out.push(c)});return out},
  box3:id=>{const T=window.__osp.T3();const gs=window.__mx.g3(id);if(!gs.length)return null;const b=new T.THREE.Box3();gs.forEach(g=>{g.updateMatrixWorld(true);b.expandByObject(g)});const r=v=>Math.round(v*1000);
    return {sx:r(b.max.x-b.min.x),sy:r(b.max.y-b.min.y),sz:r(b.max.z-b.min.z),x0:r(b.min.x),x1:r(b.max.x),y0:r(b.min.y),y1:r(b.max.y),z0:r(b.min.z),z1:r(b.max.z)}},
  geo3:id=>{let n=0,h=0;const T=window.__osp.T3(),v=new T.THREE.Vector3();window.__mx.g3(id).forEach(g=>{g.updateMatrixWorld(true);g.traverse(m=>{if(m.isMesh&&m.geometry.attributes.position){const pa=m.geometry.attributes.position;for(let i=0;i<pa.count;i++){v.fromBufferAttribute(pa,i).applyMatrix4(m.matrixWorld);h+=Math.abs(v.x)+Math.abs(v.y)*3+Math.abs(v.z)*7;n++}}})});return n+':'+Math.round(h)},
  verts3:id=>{let n=0;window.__mx.g3(id).forEach(g=>g.traverse(m=>{if(m.isMesh&&m.geometry.attributes.position)n+=m.geometry.attributes.position.count}));return n},
  /* does any mesh of the object carry this sRGB colour (materials hold it linearised) */
  hasCol3:(id,hex)=>{const T=window.__osp.T3();const want=new T.THREE.Color(hex).convertSRGBToLinear();let ok=false;window.__mx.g3(id).forEach(g=>g.traverse(m=>{if(m.isMesh&&m.material&&m.material.color){const c=m.material.color;if(Math.abs(c.r-want.r)+Math.abs(c.g-want.g)+Math.abs(c.b-want.b)<0.01)ok=true}}));return ok},
  rotY3:id=>{const g=window.__mx.g3(id)[0];return g?Math.round(-g.rotation.y*180/Math.PI*10)/10:null},
  pos3:id=>{const g=window.__mx.g3(id)[0];return g?[Math.round(g.position.x*1000),Math.round(g.position.z*1000)]:null},
  sch:code=>{const t=[...document.querySelectorAll('#p-sch table.sch')].find(t=>/Qty/.test(t.querySelector('thead').textContent));if(!t)return null;const hasAmt=/Amount/.test(t.querySelector('thead').textContent);
    const tr=[...t.querySelectorAll('tbody tr')].find(tr=>{const m=tr.querySelector('td .muted');return m&&m.textContent.split(' · ')[0]===code});if(!tr)return null;const td=tr.querySelectorAll('td');
    return {qty:+td[1].textContent,seats:+(td[2].textContent||0),amt:hasAmt?+(td[3].textContent.replace(/[^0-9.-]/g,'')||NaN):null}}}}

const STATE=pg=>ev(pg,()=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null,st:S.style||null})});
async function fxSetup(b,{d3=false,phone=false,small=false,warm=false}={}){
  const pg=await openApp(b,Object.assign({sample:false,phone},URLO()));
  if(!phone)await pg.setViewportSize(small?{width:960,height:640}:{width:1100,height:760});/* still the desktop shell (> 820 px), fewer pixels for the software 3D renderer */
  await ev(pg,injectHelpers);
  await ev(pg,f=>{window.__osp.openPlanText(JSON.stringify(f),'mx-ob.json')},await ev(pg,fixture));
  pg.fxOk=await wf(pg,()=>window.__osp.S().name==='mx-ob fixture'&&!!window.__osp.byId('rd'));
  if(!phone)await ev(pg,()=>{const o=window.__osp;if(o.P().lib)document.querySelector('#t-lib').click();if(!o.P().insp)document.querySelector('#t-insp').click();o.toastOff()});
  await viewAt(pg,11000,10000,phone?0.02:0.045);
  if(d3||warm){await to3D(pg);await wf(pg,()=>window.__mx.g3('it').length>0,null,15000)}
  /* warm: the 3D scene exists but the page works in 2D; fields rebuild it with build3D() and read the model (no software rendering per edit) */
  if(warm&&!d3){await to2D(pg);await wf(pg,()=>document.querySelector('#v3').hidden||getComputedStyle(document.querySelector('#v3')).display==='none',null,5000)}
  pg.warm=!!warm;
  pg.setDefaultTimeout(10000);/* a control that cannot be used fails its row fast */
  pg.d3=d3;pg.base=await STATE(pg);return pg}
const H3F={ceil:2800,wallH:2800};
async function selectObj(pg,id){await blur(pg);await ev(pg,id=>{window.__osp.setSel(id?[id]:[]);const t=document.querySelector('[data-tab=sel]');if(t&&document.querySelector('#p-sel').hidden)t.click()},id);
  return wf(pg,id=>{const s=window.__osp.sel();return id?s.length===1&&s[0]===id&&!document.querySelector('#p-sel').hidden&&document.querySelector('#p-sel').children.length>0:s.length===0},id)}
/* poll a page function until the matcher accepts its value */
async function until(pg,fn,arg,ok,t=5000){if(typeof fn==='function')fn=fn.toString();const end=Date.now()+t;let v;for(;;){v=await ev(pg,([f,a])=>{try{return (0,eval)('('+f+')')(a)}catch(e){return 'ERR '+e.message}},[fn,arg]);if(ok(v))return {ok:true,v};if(Date.now()>end)return {ok:false,v};await pg.waitForTimeout(50)}}
const J=v=>JSON.stringify(v);
/* matcher for an expected value: plain value (deep equal), {near,tol}, {changed:true} (≠ before), {has:'text'} */
const matcher=(e,before)=>v=>{if(e&&typeof e==='object'&&!Array.isArray(e)){if('near' in e)return typeof v==='number'&&Math.abs(v-e.near)<=(e.tol==null?2:e.tol);if(e.changed)return v!=null&&J(v)!==J(before);if('has' in e)return typeof v==='string'&&v.includes(e.has);if('delta' in e)return typeof v==='number'&&typeof before==='number'&&Math.abs(v-before-e.delta)<=(e.tol==null?2:e.tol);if('not' in e)return J(v)!==J(e.not)}return J(v)===J(e)};

/* real input on a Details control: scroll it to the middle of its panel, check the point hits it, then mouse / keyboard */
async function clickEl(pg,loc){const L=typeof loc==='string'?{sel:loc,nth:0}:loc;const p=await ev(pg,([s,n])=>{const e=document.querySelectorAll(s)[n];if(!e)return {none:true};e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);
    const ok=!!t&&(t===e||e.contains(t)||(t.closest&&t.closest('label')&&t.closest('label').contains(e))||(e.closest('label')&&e.closest('label').contains(t)));return {x,y,ok,hit:t&&(t.tagName+'.'+t.className)}},[L.sel,L.nth||0]);
  if(p.none)throw new Error('no control '+L.sel);if(!p.ok)throw new Error('control is covered at its centre by '+p.hit);await pg.mouse.click(p.x,p.y)}
const loc_=(sel,nth=0)=>({sel,nth});
const cnt=(pg,L)=>ev(pg,([s,n])=>document.querySelectorAll(s).length>n,[L.sel,L.nth||0]);
async function typeIn(pg,loc,val,{keep=false}={}){await clickEl(pg,loc);await pg.keyboard.press('Control+a');await pg.keyboard.type(String(val));if(!keep)await blur(pg)}/* keep: stay in the panel, as when the user clicks straight on to the next control */
/* one Details field: change it through its real control, check the object, the 2D drawing, the 3D model (in 3D view), then Ctrl+Z */
async function fieldCase(pg,c){const f=[];const e0=pg.errs.length;
  const scope=c.scope||'#p-sel';
  const D2=c.d2&&!pg.d3,D3=c.d3&&(pg.d3||pg.warm);/* the 2D page checks the drawing (and the rebuilt model), the live 3D page the model only */
  const B3=async()=>{if(D3&&!pg.d3)await ev(pg,()=>window.__osp.build3D())};
  let d20=null;if(D2&&c.desel){await selectObj(pg,null);d20=(await until(pg,c.d2,c.obj,()=>true)).v}
  if(c.obj&&!c.noSel){if(!await selectObj(pg,c.obj))f.push('could not select '+c.obj)}
  if(c.pre)await c.pre(pg);
  if(D2&&!c.desel)d20=(await until(pg,c.d2,c.obj,()=>true)).v;
  const st0=await STATE(pg);
  const p0=(await until(pg,c.prop,c.obj,()=>true)).v;await B3();const d30=D3?(await until(pg,c.d3,c.obj,()=>true)).v:null;
  if(matcher(c.exp,p0)(p0)&&!(c.exp&&c.exp.changed))f.push(`precondition: value is already ${J(p0)}`);
  if(D2&&c.d2exp!==undefined&&matcher(c.d2exp,d20)(d20)&&!(c.d2exp&&c.d2exp.changed))f.push(`precondition: 2D already shows ${J(d20)}`);
  const loc=loc_(`${scope} ${c.sel}`,c.nth||0);
  if(!await cnt(pg,loc))f.push(`no control ${c.sel}${c.nth?' #'+c.nth:''} in the Details panel`);
  else{try{
    if(c.kind==='num'||c.kind==='text')await typeIn(pg,loc,c.val);
    else if(c.kind==='select'){await clickEl(pg,loc);await pg.keyboard.press('Escape');await pg.locator(loc.sel).nth(loc.nth).selectOption(String(c.val),{force:true})}
    else if(c.kind==='range'){await clickEl(pg,loc);for(const k of c.keys||[])await pg.keyboard.press(k);await blur(pg)}
    else if(c.kind==='color'){await pg.locator(loc.sel).nth(loc.nth).fill(c.val,{force:true});await blur(pg)}/* the native colour dialog cannot be driven; fill sets the value and fires input + change as the dialog does */
    else await clickEl(pg,loc);/* check, button, swatch */
  }catch(e){f.push('control: '+String(e.message).split('\n')[0])}
  const r=await until(pg,c.prop,c.obj,matcher(c.exp,p0));if(!r.ok)f.push(`value ${J(r.v)} ≠ ${J(c.exp)}`);
  if(D2){if(c.desel)await selectObj(pg,null);const r2=await until(pg,c.d2,c.obj,matcher(c.d2exp,d20));if(!r2.ok)f.push(`2D shows ${J(r2.v)}, expected ${J(c.d2exp)} (was ${J(d20)})`)}
  if(D3){await B3();const r3=await until(pg,`a=>{if(${!pg.d3})window.__osp.build3D();return (${c.d3})(a)}`,c.obj,matcher(c.d3exp,d30));if(!r3.ok)f.push(`3D gives ${J(r3.v)}, expected ${J(c.d3exp)} (was ${J(d30)})`)}
  if(c.sch&&!pg.d3){await clickEl(pg,loc_('[data-tab=sch]'));const r4=await until(pg,c.sch,c.obj,matcher(c.schexp));if(!r4.ok)f.push(`Schedule shows ${J(r4.v)}, expected ${J(c.schexp)}`);await clickEl(pg,loc_('[data-tab=sel]'))}
  /* undo */
  await blur(pg);await pg.keyboard.press('Control+z');
  const u=await until(pg,()=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null,st:S.style||null})},null,v=>v===st0);
  if(!u.ok){const pu=(await until(pg,c.prop,c.obj,()=>true)).v;f.push(`undo did not restore the plan (value now ${J(pu)}, was ${J(p0)})`)}
  else if(D2&&!c.desel){const r5=await until(pg,c.d2,c.obj,v=>J(v)===J(d20));if(!r5.ok)f.push(`2D after undo ${J(r5.v)} ≠ ${J(d20)}`)}}
  if(pg.errs.length>e0)f.push('console: '+pg.errs.slice(e0).join(' | '));
  /* leave the plan exactly as the fixture had it */
  await blur(pg);const back=await ev(pg,base=>{const o=window.__osp,S=o.S();const now=JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null,st:S.style||null});if(now===base)return true;const B=JSON.parse(base);S.objs=B.o;S.pins=B.p;S.section=B.s||undefined;S.style=B.st||undefined;o.render();return false},pg.base);
  if(DUMP)console.log('case',c.id,f.length?'FAIL '+f.join('; '):'ok');
  return row(pg.d3?c.id+'-3d':c.id,pg.d3?c.name.replace(/^Details:/,'Details (3D view):'):c.name,!f.length,f.join('; '))}

/* field specs, per object type. prop/d2/d3/sch are page functions of the object id */
const P_=k=>`id=>{const o=window.__osp.byId(id);return o?(o[${J(k)}]===undefined?null:o[${J(k)}]):null}`;
const B_=a=>`id=>window.__mx.attr(id,'> .b',${J(a)})`;
const TR=`id=>window.__mx.attr(id,'',"transform")`;
const BOX=k=>`id=>{const b=window.__mx.box3(id);return b?b[${J(k)}]:null}`;
function itemFields(){const F=[];const add=(id,name,c)=>F.push(Object.assign({id:'mx-ob-f-'+id,name},c));
  /* generic item: workstation */
  add('item-label','Details: item Label on plan shows the new label on the plan',{obj:'it',sel:'[data-f=label]',kind:'text',val:'Desk A',prop:P_('label'),exp:'Desk A',d2:`id=>{const o=window.__osp.byId(id);const t=[...document.querySelectorAll('#plan text.it-lbl')].find(t=>+t.getAttribute('x')===o.x&&+t.getAttribute('y')===o.y);return t?t.textContent:null}`,d2exp:'Desk A'});
  add('item-w','Details: item Width resizes the outline and the 3D model',{obj:'it',sel:'[data-f=w]',kind:'num',val:1500,prop:P_('w'),exp:1500,d2:B_('width'),d2exp:'1500',d3:BOX('sx'),d3exp:{near:1500}});
  add('item-d','Details: item Depth resizes the outline and the 3D model',{obj:'it',sel:'[data-f=d]',kind:'num',val:750,prop:P_('d'),exp:750,d2:B_('height'),d2exp:'750',d3:BOX('sz'),d3exp:{near:750}});
  add('item-r','Details: item Angle rotates it on the plan and in 3D',{obj:'it',sel:'[data-f=r]',kind:'num',val:30,prop:P_('r'),exp:30,d2:TR,d2exp:{has:'rotate(30)'},d3:'id=>window.__mx.rotY3(id)',d3exp:{near:30,tol:0.2}});
  add('item-h','Details: item Height changes the 3D model height',{obj:'it',sel:'[data-f=h]',kind:'num',val:900,prop:P_('h'),exp:900,d3:BOX('y1'),d3exp:{near:900}});
  add('item-x','Details: item Centre X moves it on the plan and in 3D',{obj:'it',sel:'[data-f=x]',kind:'num',val:2600,prop:P_('x'),exp:2600,d2:TR,d2exp:{has:'translate(2600 2000)'},d3:'id=>window.__mx.pos3(id)',d3exp:[2600,2000]});
  add('item-y','Details: item Centre Y moves it on the plan and in 3D',{obj:'it',sel:'[data-f=y]',kind:'num',val:2400,prop:P_('y'),exp:2400,d2:TR,d2exp:{has:'translate(2000 2400)'},d3:'id=>window.__mx.pos3(id)',d3exp:[2000,2400]});
  add('item-seats','Details: item Seats changes the Schedule seat count',{obj:'it',sel:'[data-f=seats]',kind:'num',val:3,prop:P_('seats'),exp:3,sch:`id=>{const r=window.__mx.sch('WS1260');return r&&r.seats}`,schexp:3});
  add('item-rate','Details: item Unit rate shows as its Schedule amount',{obj:'it',sel:'[data-f=rate]',kind:'num',val:250,prop:P_('rate'),exp:250,sch:`id=>{const r=window.__mx.sch('WS1260');return r&&r.amt}`,schexp:250});
  add('item-cf','Details: item Clear front draws the front clearance zone',{obj:'it',sel:'[data-f=cf]',kind:'num',val:1500,prop:P_('cf'),exp:1500,d2:`id=>[...document.querySelectorAll('#plan path.zone')].filter(p=>p.getAttribute('transform')==='translate(2000 2000) rotate(0)').map(p=>p.getAttribute('d')).join('|')`,d2exp:{has:'1800'}});
  add('item-cb','Details: item Clear back draws a rear clearance zone',{obj:'it',sel:'[data-f=cb]',kind:'num',val:500,prop:P_('cb'),exp:500,d2:`id=>[...document.querySelectorAll('#plan path.zone')].filter(p=>p.getAttribute('transform')==='translate(2000 2000) rotate(0)').map(p=>p.getAttribute('d')).join('|')`,d2exp:{has:'-800'}});
  add('item-cat','Details: item Category select recolours it on the plan and in 3D',{obj:'it',sel:'select[data-f=cat]',kind:'select',val:'Storage',prop:P_('cat'),exp:'Storage',d2:`id=>window.__mx.attr(id,'','class')`,d2exp:{has:'cat-store'},d3:`id=>window.__mx.hasCol3(id,getComputedStyle(document.documentElement).getPropertyValue('--c-store').trim())`,d3exp:true});
  add('item-code','Details: item Code shows in the Schedule',{obj:'it',sel:'[data-f=code]',kind:'text',val:'WS-X1',prop:P_('code'),exp:'WS-X1',sch:`id=>{const r=window.__mx.sch('WS-X1');return r&&r.qty}`,schexp:1});
  add('item-tolib','Details: Save to library adds a custom shape to the library under a new code',{obj:'cr',sel:'[data-act=tolib]',kind:'btn',prop:`id=>{const o=window.__osp.byId(id);const L=window.__osp.LIB();const l=L.find(l=>l.code===o.code);return /^CUS-/.test(o.code)&&!!l&&l.w===o.w&&l.d===o.d&&!!document.querySelector('#lib-list [data-li="'+L.indexOf(l)+'"]')}`,exp:true});
  /* shape-specific */
  add('item-a','Details: L-desk Leg width reshapes the L outline',{obj:'ld',sel:'[data-f=a]',kind:'num',val:500,prop:P_('a'),exp:500,d2:B_('d'),d2exp:{has:'V-300'},d3:'id=>window.__mx.geo3(id)',d3exp:{changed:true}});
  add('item-arms','Details: chair Arm rests tick box removes the arms on the plan and in 3D',{obj:'ch',sel:'[data-f=arms]',kind:'check',prop:P_('arms'),exp:false,d2:`id=>{const g=window.__mx.q(id);return g?g.querySelectorAll(':scope > rect.d').length:null}`,d2exp:0,d3:'id=>window.__mx.verts3(id)',d3exp:{changed:true}});
  add('item-win-sill','Details: window Sill height moves the glass in 3D',{obj:'wn',sel:'[data-f=sill]',kind:'num',val:1000,prop:P_('sill'),exp:1000,d3:BOX('y0'),d3exp:{near:1000}});
  add('item-win-h','Details: window Glass height changes the glass in 3D',{obj:'wn',sel:'[data-f=h]',nth:1,kind:'num',val:1300,prop:P_('h'),exp:1300,d3:BOX('y1'),d3exp:{near:900+1300}});
  add('item-win-full','Details: window Full height tick box runs it floor to ceiling',{obj:'wn',sel:'[data-f=fullh]',kind:'check',prop:`id=>{const o=window.__osp.byId(id);return [o.h,o.sill]}`,exp:[0,0],d3:`id=>{const b=window.__mx.box3(id);return b&&[b.y0,b.y1]}`,d3exp:[0,H3F.ceil]});
  add('item-door-exit','Details: door Final exit tick box marks it as an exit',{obj:'dr',sel:'[data-f=exit]',kind:'check',prop:P_('exit'),exp:true});
  add('item-door-hinge','Details: door Hinge to the other side flips the drawn swing and the 3D leaf',{obj:'dr',sel:'[data-act=dflip]',kind:'btn',prop:P_('flip'),exp:true,d2:TR,d2exp:{has:'scale(-1 1)'},d3:BOX('x0'),d3exp:{changed:true}});
  add('item-door-swing','Details: door Swing the other way turns it 180° on the plan and in 3D',{obj:'dr',sel:'[data-act=dswing]',kind:'btn',prop:`id=>{const o=window.__osp.byId(id);return [o.r,!!o.flip]}`,exp:[180,true],d2:TR,d2exp:{has:'rotate(180)'},d3:BOX('z0'),d3exp:{changed:true}});
  add('item-door-h','Details: door Height sets the 3D door leaf height',{obj:'dr',sel:'[data-f=h]',kind:'num',val:2400,prop:P_('h'),exp:2400,d3:BOX('y1'),d3exp:{near:2400}});
  add('item-col-w','Details: column Width resizes it on the plan and in 3D',{obj:'col',sel:'[data-f=w]',kind:'num',val:600,prop:P_('w'),exp:600,d2:B_('width'),d2exp:'600',d3:BOX('sx'),d3exp:{near:600}});
  add('item-col-h','Details: column Height sets its 3D height',{obj:'col',sel:'[data-f=h]',kind:'num',val:2000,prop:P_('h'),exp:2000,d3:BOX('y1'),d3exp:{near:2000}});
  add('item-ceil-drop','Details: ceiling item Drop lowers it below the ceiling in 3D',{obj:'lp',sel:'[data-f=drop]',kind:'num',val:300,prop:P_('drop'),exp:300,d3:BOX('y1'),d3exp:{near:H3F.ceil-300}});
  add('item-ceil-cov','Details: ceiling item Coverage radius draws its coverage circle',{obj:'lp',sel:'[data-f=cov]',kind:'num',val:2000,prop:P_('cov'),exp:2000,d2:`id=>{const c=[...document.querySelectorAll('#plan circle.cov')].find(c=>+c.getAttribute('cx')===2000&&+c.getAttribute('cy')===12000);return c?c.getAttribute('r'):null}`,d2exp:'2000'});
  add('item-ceil-rate','Details: ceiling item Unit rate shows as its Schedule amount',{obj:'lp',sel:'[data-f=rate]',kind:'num',val:90,prop:P_('rate'),exp:90,sch:`id=>{const r=window.__mx.sch('LP6060');return r&&r.amt}`,schexp:90});
  const FOV=`id=>{const p=document.querySelector('#plan path.cctv-fov');return p?p.getAttribute('d'):null}`;
  add('item-cam-drop','Details: camera Drop lowers it in 3D',{obj:'cam',sel:'[data-f=drop]',kind:'num',val:200,prop:P_('drop'),exp:200,d3:BOX('y0'),d3exp:{delta:-200}});/* the dome hangs from a pole to the ceiling: its underside drops */
  add('item-cam-facing','Details: camera Facing turns its view on the plan',{obj:'cam',sel:'[data-f=r]',nth:0,kind:'num',val:45,prop:P_('r'),exp:45,d2:FOV,d2exp:{changed:true}});
  add('item-cam-tilt','Details: camera Tilt down is stored',{obj:'cam',sel:'[data-f=tilt]',kind:'num',val:40,prop:P_('tilt'),exp:40});
  add('item-cam-range','Details: camera Range lengthens its view on the plan',{obj:'cam',sel:'[data-f=range]',kind:'num',val:5000,prop:P_('range'),exp:5000,d2:FOV,d2exp:{changed:true}});
  add('item-cam-fov','Details: camera Field of view slider (a click at its middle, 115°) widens its view on the plan',{obj:'cam',sel:'[data-f=fov]',kind:'range',keys:[],prop:P_('fov'),exp:115,d2:FOV,d2exp:{changed:true}});
  /* custom shapes */
  add('shape-rect-w','Details: custom rectangle Width resizes it',{obj:'cr',sel:'[data-f=w]',kind:'num',val:1400,prop:P_('w'),exp:1400,d2:B_('width'),d2exp:'1400',d3:BOX('sx'),d3exp:{near:1400,tol:30}});
  add('shape-round-d','Details: custom round Depth makes it an oval',{obj:'cro',sel:'[data-f=d]',kind:'num',val:600,prop:P_('d'),exp:600,d2:B_('ry'),d2exp:'300',d3:BOX('sz'),d3exp:{near:600,tol:30}});
  add('shape-L-a','Details: custom L-shape Leg width reshapes it',{obj:'cl',sel:'[data-f=a]',kind:'num',val:400,prop:P_('a'),exp:400,d2:B_('d'),d2exp:{has:'V-300'}});
  add('shape-poly-w','Details: custom polygon Width scales its outline',{obj:'cp',sel:'[data-f=w]',kind:'num',val:2400,prop:`id=>{const o=window.__osp.byId(id);return [o.w,o.pts[0][0],o.pts[1][0]]}`,exp:[2400,-1200,1200],d2:B_('d'),d2exp:{has:'-1200'},d3:BOX('sx'),d3exp:{near:2400,tol:30}});
  /* cores (need two floors: set up by Building > Duplicate floor) */
  const lvPre=async pg=>{};
  add('core-exit','Details: stair Final exit tick box marks it as an exit',{obj:'st',sel:'[data-f=exit]',kind:'check',prop:P_('exit'),exp:true});
  add('core-from','Details: stair Runs from select sets its lowest floor',{obj:'st',sel:'select[data-f=cfrom]',kind:'select',val:'@L0',prop:P_('from'),exp:'@L0'});
  add('core-to','Details: lift Runs to select sets its top floor',{obj:'lf',sel:'select[data-f=cto]',kind:'select',val:'@L1',prop:P_('to'),exp:'@L1'});
  add('core-roof','Details: stair Continues to the roof tick box turns the roof box off',{obj:'st',sel:'[data-f=croof]',kind:'check',prop:P_('roof'),exp:false});
  /* array */
  add('item-array','Details: Create array (1 × 3) adds two copies',{obj:'cro',sel:'[data-act=array]',kind:'btn',pre:async pg=>{await typeIn(pg,loc_('#ar-r'),1,{keep:true});await typeIn(pg,loc_('#ar-c'),3,{keep:true})},prop:`id=>window.__osp.S().objs.filter(o=>o.code==='CUSTOM'&&o.shape==='round').length`,exp:3});
  return F}
function otherFields(){const F=[];const add=(id,name,c)=>F.push(Object.assign({id:'mx-ob-f-'+id,name},c));
  const RP=`id=>window.__mx.attr(id,'','d')`;
  add('room-name','Details: room Name renames its label on the plan',{obj:'r1',sel:'[data-f=name]',kind:'text',val:'Board room',prop:P_('name'),exp:'Board room',d2:`id=>[...document.querySelectorAll('#plan text.room-lbl')].map(t=>t.textContent).join('|')`,d2exp:{has:'Board room'}});
  add('room-rw','Details: room Width resizes it on the plan and its 3D floor',{obj:'r1',sel:'[data-f=rw]',kind:'num',val:6000,prop:`id=>window.__osp.byId(id).pts`,exp:[[0,15000],[6000,15000],[6000,19000],[0,19000]],d2:`id=>document.querySelector('#plan path.room-f[data-id="'+id+'"]').getAttribute('d')`,d2exp:{has:'6000'},d3:`id=>{const T=window.__osp.T3();const m=T.group.children.find(c=>c.userData.id===id&&c.userData.paint==='floor');if(!m)return null;const b=new T.THREE.Box3().setFromObject(m);return Math.round((b.max.x-b.min.x)*1000)}`,d3exp:{near:6000}});
  add('room-rd','Details: room Depth resizes it',{obj:'r1',sel:'[data-f=rd]',kind:'num',val:5000,prop:`id=>window.__osp.byId(id).pts`,exp:[[0,15000],[5000,15000],[5000,20000],[0,20000]],d2:`id=>document.querySelector('#plan path.room-f[data-id="'+id+'"]').getAttribute('d')`,d2exp:{has:'20000'}});
  add('room-raise','Details: room Raised floor lifts its 3D floor',{obj:'r1',sel:'[data-f=raise]',kind:'num',val:300,prop:P_('raise'),exp:300,d3:`id=>{const m=window.__osp.T3().group.children.find(c=>c.userData.id===id&&c.userData.paint==='floor');return m?Math.round(m.position.y*1000):null}`,d3exp:{near:300}});
  add('room-ment','Details: room MIG entitlement select applies a rank check to the room',{obj:'r1',sel:'select[data-f=ment]',kind:'select',val:'@MIG1',prop:P_('ent'),exp:'@MIG1',d2:`id=>document.querySelector('#plan path.room-f[data-id="'+id+'"]').getAttribute('class')`,d2exp:{has:'mig-'}});
  const RF=`id=>{const p=document.querySelector('#plan path.room-f[data-id="'+id+'"]');return p?p.getAttribute('style'):null}`;
  add('room-floor-swatch','Details: room Floor colour swatch paints its floor on the plan and in 3D',{obj:'r1',sel:'[data-cp=room-floor] [data-cval="#2f6db5"]',kind:'btn',prop:P_('floorCol'),exp:'#2f6db5',desel:true,d2:RF,d2exp:{has:'#2f6db5'},d3:`id=>window.__mx.hasCol3(id,'#2f6db5')`,d3exp:true});
  add('room-floor-wheel','Details: room Floor colour wheel sets any colour',{obj:'r1',sel:'[data-cp=room-floor] input[type=color]',kind:'color',val:'#123456',prop:P_('floorCol'),exp:'#123456',d3:`id=>window.__mx.hasCol3(id,'#123456')`,d3exp:true});
  add('room-floor-default','Details: room Floor colour Default goes back to the plan colour',{obj:'r1',pre:async pg=>{await clickEl(pg,loc_('#p-sel [data-cp=room-floor] [data-cval="#e07b2a"]'));await wf(pg,()=>window.__osp.byId('r1').floorCol==='#e07b2a');await wf(pg,()=>!!document.querySelector('#p-sel [data-cp=room-floor] .cdef'))},sel:'[data-cp=room-floor] .cdef',kind:'btn',prop:P_('floorCol'),exp:null,d3:`id=>window.__mx.hasCol3(id,'#e07b2a')`,d3exp:false});
  add('room-wall-swatch','Details: room Walls colour swatch paints its walls in 3D',{obj:'r1',sel:'[data-cp=room-wall] [data-cval="#4b5320"]',kind:'btn',prop:P_('wallCol'),exp:'#4b5320',d3:`id=>window.__mx.hasCol3(id,'#4b5320')`,d3exp:true});
  add('room-wall-wheel','Details: room Walls colour wheel sets any colour',{obj:'r1',sel:'[data-cp=room-wall] input[type=color]',kind:'color',val:'#654321',prop:P_('wallCol'),exp:'#654321',d3:`id=>window.__mx.hasCol3(id,'#654321')`,d3exp:true});
  const NEWWIN=`id=>window.__osp.S().objs.filter(o=>o.shape==='window'&&o.id!=='wn').map(o=>[o.w,o.sill||0,o.h])`;
  const WF=(k,v,check,name)=>add('room-winfill-'+k,`Details: room windows form ${name} applies to the windows added`,{obj:'r1',pre:async pg=>{const l=loc_(`#p-sel .winf [data-w=${k}]`);if(k==='type')await pg.locator(l.sel).selectOption(String(v),{force:true});else if(k==='outside')await clickEl(pg,l);else await typeIn(pg,l,v,{keep:true});await wf(pg,()=>!!document.querySelector('#p-sel [data-act=winfill]'))},sel:'[data-act=winfill]',kind:'btn',prop:check,exp:true});
  WF('w',1700,`id=>{const n=window.__osp.S().objs.filter(o=>o.shape==='window'&&o.id!=='wn');return n.length>0&&n.every(o=>o.w===1700)}`,'Width each');
  WF('sill',800,`id=>{const n=window.__osp.S().objs.filter(o=>o.shape==='window'&&o.id!=='wn');return n.length>0&&n.every(o=>o.sill===800)}`,'Sill height');
  WF('h',1100,`id=>{const n=window.__osp.S().objs.filter(o=>o.shape==='window'&&o.id!=='wn');return n.length>0&&n.every(o=>o.h===1100)}`,'Glass height');
  WF('type','full',`id=>{const n=window.__osp.S().objs.filter(o=>o.shape==='window'&&o.id!=='wn');return n.length>0&&n.every(o=>o.h===0)}`,'Type (full-height glazing)');
  /* gap: neighbouring windows on the 5 m top wall sit (w + gap) apart */
  WF('gap',900,`id=>{const n=window.__osp.S().objs.filter(o=>o.shape==='window'&&o.id!=='wn'&&Math.abs(o.y-15000)<200).sort((a,b)=>a.x-b.x);return n.length>1&&n.slice(1).every((o,i)=>Math.abs(o.x-n[i].x-(o.w+900))<2)}`,'Gap between');
  WF('margin',1200,`id=>{const n=window.__osp.S().objs.filter(o=>o.shape==='window'&&o.id!=='wn'&&Math.abs(o.y-15000)<200);return n.length>0&&n.every(o=>o.x-o.w/2>=1200-1&&o.x+o.w/2<=5000-1200+1)}`,'Keep clear of corners');
  /* walls */
  add('wall-th','Details: wall Thickness thickens it on the plan and in 3D',{obj:'w1',sel:'[data-f=th]',kind:'num',val:250,prop:P_('th'),exp:250,d2:`id=>window.__mx.attr(id,'','stroke-width')`,d2exp:'250',d3:BOX('sz'),d3exp:{near:250}});
  add('wall-len','Details: wall Length shortens it on the plan and in 3D',{obj:'w1',sel:'[data-f=len]',kind:'num',val:5000,prop:`id=>window.__osp.byId(id).pts`,exp:[[0,8000],[5000,8000]],d2:`id=>window.__mx.attr(id,'','d')`,d2exp:{has:'5000'},d3:BOX('x1'),d3exp:{near:5000,tol:100}});
  add('wall-bulge','Details: wall Curve bows it on the plan',{obj:'w1',sel:'[data-f=bulge]',kind:'num',val:600,prop:P_('bulge'),exp:[600],d2:`id=>window.__mx.attr(id,'','d')`,d2exp:{changed:true},d3:BOX('z1'),d3exp:{changed:true}});
  add('wall-col-swatch','Details: wall Colour swatch paints it in 3D',{obj:'w1',sel:'[data-cp=wall-col] [data-cval="#e07b2a"]',kind:'btn',prop:P_('col'),exp:'#e07b2a',d3:`id=>window.__mx.hasCol3(id,'#e07b2a')`,d3exp:true});
  add('wall-col-wheel','Details: wall Colour wheel sets any colour',{obj:'w1',sel:'[data-cp=wall-col] input[type=color]',kind:'color',val:'#336699',prop:P_('col'),exp:'#336699',d3:`id=>window.__mx.hasCol3(id,'#336699')`,d3exp:true});
  add('wall-col-default','Details: wall Colour Default removes its own colour',{obj:'w1',pre:async pg=>{await clickEl(pg,loc_('#p-sel [data-cp=wall-col] [data-cval="#2f6db5"]'));await wf(pg,()=>window.__osp.byId('w1').col==='#2f6db5')},sel:'[data-cp=wall-col] .cdef',kind:'btn',prop:P_('col'),exp:null,d3:`id=>window.__mx.hasCol3(id,'#2f6db5')`,d3exp:false});
  add('wall-winfill','Details: wall Add windows fills it with windows',{obj:'w1',pre:async pg=>{const o=loc_('#p-sel .winf [data-w=outside]');if(await ev(pg,s=>document.querySelector(s).checked,o.sel))await clickEl(pg,o)},sel:'[data-act=winfill]',kind:'btn',prop:`id=>window.__osp.S().objs.filter(o=>o.shape==='window'&&o.id!=='wn'&&Math.abs(o.y-8000)<1).length>0`,exp:true});
  /* site */
  add('fence-h','Details: fence Height sets its 3D height',{obj:'fe',sel:'[data-f=h]',kind:'num',val:1800,prop:P_('h'),exp:1800,d3:BOX('y1'),d3exp:{near:1800,tol:60}});
  add('fence-curve','Details: fence Smooth curve tick box smooths it on the plan',{obj:'fe',sel:'[data-f=curve]',kind:'check',prop:P_('spline'),exp:true,d2:`id=>window.__mx.attr(id,'.fence','d')||[...document.querySelectorAll('#plan [data-id="'+id+'"]')].map(e=>e.getAttribute('d')).join('|')`,d2exp:{changed:true}});
  add('road-th','Details: road Width widens it on the plan and in 3D',{obj:'rd',sel:'[data-f=th]',kind:'num',val:8000,prop:P_('th'),exp:8000,d2:`id=>window.__mx.attr(id,'','stroke-width')`,d2exp:'8000',d3:BOX('sz'),d3exp:{near:8000,tol:250}});
  add('road-curve','Details: road Smooth curve tick box is stored',{obj:'rd',sel:'[data-f=curve]',kind:'check',prop:P_('spline'),exp:true});
  /* text */
  add('text-text','Details: text label Text changes the words on the plan',{obj:'tx',sel:'[data-f=text]',kind:'text',val:'Hello there',prop:P_('text'),exp:'Hello there',d2:`id=>{const e=window.__mx.q(id);return e?e.textContent:null}`,d2exp:'Hello there'});
  add('text-size','Details: text label Size changes its size on the plan',{obj:'tx',sel:'[data-f=size]',kind:'num',val:500,prop:P_('size'),exp:500,d2:`id=>window.__mx.attr(id,'','font-size')`,d2exp:'500'});
  /* trunking */
  add('trunk-w','Details: trunking Width widens it on the plan and in 3D',{obj:'tk',sel:'[data-f=w]',kind:'num',val:300,prop:P_('w'),exp:300,d2:`id=>window.__mx.attr(id,'','stroke-width')`,d2exp:'300',d3:BOX('sz'),d3exp:{near:300}});
  add('trunk-h','Details: trunking Height deepens it in 3D',{obj:'tk',sel:'[data-f=h]',kind:'num',val:200,prop:P_('h'),exp:200,d3:BOX('sy'),d3exp:{near:200}});
  add('trunk-drop','Details: trunking Drop lowers it in 3D',{obj:'tk',sel:'[data-f=drop]',kind:'num',val:100,prop:P_('drop'),exp:100,d3:BOX('y1'),d3exp:{near:H3F.ceil-100}});
  add('trunk-swatch','Details: trunking colour swatch paints it on the plan and in 3D',{obj:'tk',sel:'[data-trunkc="#1f7a4d"]',kind:'btn',prop:P_('col'),exp:'#1f7a4d',desel:true,d2:`id=>window.__mx.attr(id,'','style')`,d2exp:{has:'#1f7a4d'},d3:`id=>window.__mx.hasCol3(id,'#1f7a4d')`,d3exp:true});
  add('trunk-wheel','Details: trunking colour wheel sets any colour',{obj:'tk',sel:'input[data-trunkwheel]',kind:'color',val:'#aa3300',prop:P_('col'),exp:'#aa3300',d3:`id=>window.__mx.hasCol3(id,'#aa3300')`,d3exp:true});
  /* section line */
  const secSel=async pg=>{await ev(pg,()=>{window.__osp.setSel([]);window.__osp.setSecSel(true);window.__osp.setSel([])});await wf(pg,()=>!!document.querySelector('#p-sel [data-sec]'))};
  add('section-toggle','Details: section Turn off switches the section cut off',{noSel:true,pre:secSel,sel:'[data-sec=toggle]',kind:'btn',prop:`()=>window.__osp.S().section&&window.__osp.S().section.on`,exp:false});
  add('section-flip','Details: section Flip side flips the kept side',{noSel:true,pre:secSel,sel:'[data-sec=flip]',kind:'btn',prop:`()=>window.__osp.S().section&&window.__osp.S().section.flip`,exp:true});
  add('section-del','Details: section Delete section removes it',{noSel:true,pre:secSel,sel:'[data-sec=del]',kind:'btn',prop:`()=>!!window.__osp.S().section`,exp:false});
  /* pin (Notes tab) */
  const pinOpen=async pg=>{await ev(pg,()=>{window.__osp.setSel([]);document.querySelector('[data-tab=notes]').click()});await wf(pg,()=>!!document.querySelector('#p-notes [data-pindone="p1"]'))};
  const PIN=`()=>{const p=(window.__osp.pins()||[]).find(p=>p.id==='p1');return p?{done:!!p.done,text:p.text||''}:null}`;
  add('pin-done','Notes: pin Done tick box marks the pin done on the plan',{noSel:true,pre:pinOpen,scope:'#p-notes',sel:'[data-pindone="p1"]',kind:'check',prop:PIN,exp:{done:true,text:''},d2:`()=>{const g=document.querySelector('#plan [data-pin="p1"]');return g?g.getAttribute('class'):null}`,d2exp:{has:'done'}});
  add('pin-text','Notes: pin comment text is stored and undone',{noSel:true,pre:pinOpen,scope:'#p-notes',sel:'textarea[data-pintext="p1"]',kind:'text',val:'Check fire exit',prop:PIN,exp:{done:false,text:'Check fire exit'}});
  add('pin-del','Notes: pin Delete removes the pin from the plan',{noSel:true,pre:pinOpen,scope:'#p-notes',sel:'[data-pindel="p1"]',kind:'btn',prop:`()=>(window.__osp.pins()||[]).some(p=>p.id==='p1')`,exp:false,d2:`()=>!!document.querySelector('#plan [data-pin="p1"]')`,d2exp:false});
  return F}

/* resolve run-time placeholders: @L0/@L1 = the two floor ids, @MIG1 = the first MIG rank in the entitlement list */
async function resolveSpecs(pg,F){const ids=await ev(pg,()=>{const S=window.__osp.S();const sel=document.createElement('div');return {L:(S.bld&&S.bld.levels||[]).map(l=>l.id),M:[...window.__osp.migMap().keys()]}});
  const map={'@L0':ids.L[0],'@L1':ids.L[1],'@MIG1':ids.M[0]};const fix=v=>typeof v==='string'&&map[v]!==undefined?map[v]:v;F.forEach(c=>{c.val=fix(c.val);c.exp=fix(c.exp)});return ids}

async function fieldGroup(b,which,d3){const out=[];let pg;const tag=which+(d3?'-3d':'');
  try{pg=await fxSetup(b,{d3,small:d3,warm:!d3});
    out.push(row(`mx-ob-f-${tag}-fixture`,`Details fields (${tag}): fixture plan with one object of each type opens${d3?' in 3D':''}`,pg.fxOk&&(!pg.d3||await ev(pg,()=>window.__mx.g3('it').length>0))));
    if(which==='items'){/* two floors so cores show Runs from / to: Building > Duplicate floor */
      await clickEl(pg,loc_('[data-tab=bld]'));const d=loc_('#p-bld [data-bb=dupl]');await wf(pg,s=>!!document.querySelector(s),d.sel);if(await cnt(pg,d))await clickEl(pg,d);
      const two=await wf(pg,()=>{const S=window.__osp.S();return S.bld&&S.bld.levels.length===2});
      out.push(row(`mx-ob-f-${tag}-two-floors`,'Building: Duplicate floor gives the plan two floors (for the core fields)',two));
      await clickEl(pg,loc_('[data-tab=sel]'));pg.base=await STATE(pg)}
    /* the live 3D view (software-rendered, slow) re-checks a sample: one number, select and colour field, and each other object type's model */
    const LIVE=new Set(['mx-ob-f-item-w','mx-ob-f-item-cat','mx-ob-f-item-ceil-drop','mx-ob-f-room-raise','mx-ob-f-room-floor-swatch','mx-ob-f-wall-th','mx-ob-f-trunk-w']);
    const F=(which==='items'?itemFields():otherFields()).filter(c=>!d3||LIVE.has(c.id));await resolveSpecs(pg,F);
    for(const c of F){if(ONLY&&process.env.MX_OB_FIELD&&!new RegExp(process.env.MX_OB_FIELD).test(c.id))continue;out.push(await fieldCase(pg,c))}
    out.push(row(`mx-ob-f-${tag}-errors`,`Details fields (${tag}): no console errors`,!pg.errs.length,pg.errs.slice(0,5).join(' | ')));
  }catch(e){out.push(row(`mx-ob-f-${tag}-crash`,`Details fields (${tag}) ran to the end`,false,String(e&&e.stack||e).slice(0,400)))}
  finally{if(pg)await pg.ctx.close()}
  return out}

/* ---------- part 3: rotate 4 × 90°, duplicate, delete + undo, for every object type (2D, real keyboard and Details buttons) ---------- */
const OPS=[['it','workstation'],['ld','L-desk'],['ch','chair'],['wn','window'],['dr','door'],['col','column'],['st','stair core'],['lf','lift core'],['lp','ceiling light'],['cam','CCTV camera'],
  ['cr','custom rectangle'],['cro','custom round'],['cl','custom L-shape'],['cp','custom polygon'],['r1','room'],['w1','wall'],['fe','fence'],['rd','road'],['tx','text label'],['dm','measurement'],['tk','trunking']];
const OBJ=(pg,id)=>ev(pg,id=>{const o=window.__osp.byId(id);return o?JSON.stringify(o):null},id);
const shiftOf=(a,b)=>{const ka=JSON.parse(a),kb=JSON.parse(b);/* compare with id and position stripped */const strip=o=>{const c=Object.assign({},o);delete c.id;delete c.x;delete c.y;if(o.t!=='item'){delete c.pts;delete c.a;delete c.b}return c};/* item pts and a are local shape data, not position */
  const pos=o=>o.t==='dim'?[o.a,o.b]:(o.t==='item'||o.t==='text')?[[o.x,o.y]]:o.pts;const pa=pos(ka),pb=pos(kb);const d=[pb[0][0]-pa[0][0],pb[0][1]-pa[0][1]];
  const same=J(strip(ka))===J(strip(kb));
  const rigid=pa.length===pb.length&&pa.every((p,i)=>Math.abs(pb[i][0]-p[0]-d[0])<1e-6&&Math.abs(pb[i][1]-p[1]-d[1])<1e-6);return {same,rigid,d}};
async function opsGroup(b){const out=[];let pg;
  try{pg=await fxSetup(b,{d3:false});out.push(row('mx-ob-op-fixture','object operations: fixture plan opens in 2D',pg.fxOk));
    for(const [id,nm] of OPS){if(ONLY&&process.env.MX_OB_OP&&!new RegExp(process.env.MX_OB_OP).test(id))continue;
      const e0=pg.errs.length;const f=[];const st0=await STATE(pg);const o0=await OBJ(pg,id);
      if(!await selectObj(pg,id))f.push('not selected');
      /* rotate: R four times; the first turn must change it, four must give back the exact object */
      await blur(pg);await pg.mouse.move(5,600);
      await pg.keyboard.press('r');const r1=await until(pg,`id=>JSON.stringify(window.__osp.byId(id))`,id,v=>v!==o0);if(!r1.ok)f.push('R did not rotate it');
      for(let k=0;k<3;k++){const prev=(await until(pg,`id=>JSON.stringify(window.__osp.byId(id))`,id,()=>true)).v;await pg.keyboard.press('r');await until(pg,`id=>JSON.stringify(window.__osp.byId(id))`,id,v=>v!==prev,1500)}
      const r4=await until(pg,`id=>JSON.stringify(window.__osp.byId(id))`,id,v=>v===o0,1500);if(!r4.ok)f.push('4 × 90° did not return it to its original state: '+r4.v.slice(0,200)+' vs '+o0.slice(0,200));
      for(let k=0;k<4;k++)await pg.keyboard.press('Control+z');
      if(!(await until(pg,()=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null,st:S.style||null})},null,v=>v===st0)).ok)f.push('4 × Ctrl+Z after the rotations did not restore the plan');
      out.push(row(`mx-ob-op-rot-${id}`,`${nm}: R pressed 4 times turns it a full circle back to exactly where it was, and undoes`,!f.length&&!(pg.errs.length>e0),f.concat(pg.errs.slice(e0)).join('; ')));
      /* duplicate: the Details Duplicate button (text and measurement have it too) */
      {const f=[];const e1=pg.errs.length;await selectObj(pg,id);const n0=await ev(pg,()=>window.__osp.S().objs.length);const ids0=await ev(pg,()=>window.__osp.S().objs.map(o=>o.id));
        const btn=loc_('#p-sel [data-act=dup]');if(!await cnt(pg,btn))f.push('no Duplicate button');else await clickEl(pg,btn);
        const nn=await until(pg,`n=>window.__osp.S().objs.length`,null,v=>v===n0+1);if(!nn.ok)f.push(`object count ${nn.v} ≠ ${n0+1}`);
        const nw=await ev(pg,ids0=>{const n=window.__osp.S().objs.filter(o=>!ids0.includes(o.id));return n.length===1?JSON.stringify(n[0]):null},ids0);
        if(nw){const s=shiftOf(o0,nw);if(!s.same)f.push('copy differs beyond id and position: '+nw.slice(0,240));if(!s.rigid)f.push('copy is not a straight shift');if(!s.d[0]&&!s.d[1])f.push('copy sits on top of the original');
          const sel1=await ev(pg,()=>window.__osp.sel());if(!(sel1.length===1&&sel1[0]===JSON.parse(nw).id))f.push('the copy is not the selection')}
        const orig=await OBJ(pg,id);if(orig!==o0)f.push('original changed');
        await blur(pg);await pg.keyboard.press('Control+z');if(!(await until(pg,()=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null,st:S.style||null})},null,v=>v===st0)).ok)f.push('Ctrl+Z did not remove the copy');
        out.push(row(`mx-ob-op-dup-${id}`,`${nm}: Details Duplicate makes an identical copy (new id, shifted) and Ctrl+Z removes it`,!f.length&&!(pg.errs.length>e1),f.concat(pg.errs.slice(e1)).join('; ')))}
      /* delete: Delete key, then Ctrl+Z */
      {const f=[];const e1=pg.errs.length;await selectObj(pg,id);await blur(pg);await pg.keyboard.press('Delete');
        const gone=await until(pg,`id=>!window.__osp.byId(id)&&!document.querySelector('#plan [data-id="'+id+'"]')`,id,v=>v===true);if(!gone.ok)f.push('Delete did not remove it from the plan');
        const others=await ev(pg,([st0,id])=>{const B=JSON.parse(st0).o.filter(o=>o.id!==id);return JSON.stringify(B)===JSON.stringify(window.__osp.S().objs)},[st0,id]);if(!others)f.push('Delete changed other objects');
        await pg.keyboard.press('Control+z');if(!(await until(pg,()=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null,st:S.style||null})},null,v=>v===st0)).ok)f.push('Ctrl+Z did not restore it exactly');
        if(!(await until(pg,`id=>!!document.querySelector('#plan [data-id="'+id+'"]')`,id,v=>v===true)).ok)f.push('restored object not drawn');
        out.push(row(`mx-ob-op-del-${id}`,`${nm}: Delete removes only it and Ctrl+Z restores it exactly`,!f.length&&!(pg.errs.length>e1),f.concat(pg.errs.slice(e1)).join('; ')))}
      await ev(pg,base=>{const o=window.__osp,S=o.S();const B=JSON.parse(base);S.objs=B.o;S.pins=B.p;S.section=B.s||undefined;o.setSel([]);o.render()},pg.base)}
    /* pin: Delete key with the pin selected, Ctrl+Z restores */
    {const f=[];const st0=await STATE(pg);await viewAt(pg,9000,17000,0.045);const [x,y]=await W2S(pg,9000,17000);
      const hit=await ev(pg,([x,y])=>{const e=document.elementFromPoint(x,y);return !!(e&&e.closest('[data-pin="p1"]'))},[x,y]);if(!hit)f.push('pin not under the pointer');
      await pg.mouse.click(x,y);if(!await wf(pg,()=>window.__osp.pinSel()==='p1'))f.push('click did not select the pin');
      await blur(pg);await pg.keyboard.press('Delete');if(!await wf(pg,()=>!(window.__osp.pins()||[]).some(p=>p.id==='p1')))f.push('Delete did not remove the pin');
      await pg.keyboard.press('Control+z');if(!(await until(pg,()=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null,st:S.style||null})},null,v=>v===st0)).ok)f.push('Ctrl+Z did not restore the pin');
      out.push(row('mx-ob-op-del-pin','pin: click selects it, Delete removes it and Ctrl+Z restores it exactly',!f.length,f.join('; ')))}
    /* Add points: Details button, then a real click on an edge adds one corner; Ctrl+Z removes it */
    for(const [id,nm,mx,my] of [['r1','room',2500,15000],['w1','wall',3000,8000],['fe','fence',13500,-3000],['tk','trunking',17000,6500],['rd','road',10000,25000]]){const f=[];const e1=pg.errs.length;
      await viewAt(pg,mx,my,0.045);const st0=await STATE(pg);const n0=await ev(pg,id=>window.__osp.byId(id).pts.length,id);
      await selectObj(pg,id);const btn=loc_('#p-sel [data-act=addpt]');if(!await cnt(pg,btn))f.push('no Add points button');else await clickEl(pg,btn);
      const [x,y]=await W2S(pg,mx,my);await pg.mouse.move(x-10,y-10);await pg.mouse.click(x,y);
      const r=await until(pg,`id=>window.__osp.byId(id).pts.length`,id,v=>v===n0+1);if(!r.ok)f.push(`corners ${r.v} ≠ ${n0+1}`);
      const has=await ev(pg,([id,mx,my])=>window.__osp.byId(id).pts.some(p=>Math.hypot(p[0]-mx,p[1]-my)<300),[id,mx,my]);if(!has)f.push('new corner not where clicked');
      await pg.keyboard.press('Escape');await blur(pg);await pg.keyboard.press('Control+z');
      if(!(await until(pg,()=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null,st:S.style||null})},null,v=>v===st0)).ok)f.push('Ctrl+Z did not remove the corner');
      out.push(row(`mx-ob-f-addpt-${id}`,`Details: ${nm} Add points, then a click on its edge adds a corner there; Ctrl+Z removes it`,!f.length&&!(pg.errs.length>e1),f.concat(pg.errs.slice(e1)).join('; ')));
      await ev(pg,base=>{const o=window.__osp,S=o.S();const B=JSON.parse(base);S.objs=B.o;o.setTool('select');o.setSel([]);o.render()},pg.base)}
    /* pin Locate (Notes): centres the view on the pin, changes nothing in the plan */
    {const f=[];await viewAt(pg,0,0,0.045);const st0=await STATE(pg);await ev(pg,()=>document.querySelector('[data-tab=notes]').click());const l=loc_('#p-notes [data-pingo="p1"]');if(!await cnt(pg,l))f.push('no Locate button');else await clickEl(pg,l);
      const r=await until(pg,()=>{const V=window.__osp.V,R=document.querySelector('#plan').getBoundingClientRect();return [Math.round(V.x+R.width/2/V.k),Math.round(V.y+R.height/2/V.k)]},null,v=>Math.hypot(v[0]-9000,v[1]-17000)<200);if(!r.ok)f.push('view centre '+J(r.v));
      if(await STATE(pg)!==st0)f.push('plan changed');await ev(pg,()=>document.querySelector('[data-tab=sel]').click());
      out.push(row('mx-ob-f-pin-locate','Notes: pin Locate centres the view on the pin and changes nothing',!f.length,f.join('; ')))}
    out.push(row('mx-ob-op-errors','object operations: no console errors',!pg.errs.length,pg.errs.slice(0,5).join(' | ')));
  }catch(e){out.push(row('mx-ob-op-crash','object operations ran to the end',false,String(e&&e.stack||e).slice(0,400)))}
  finally{if(pg)await pg.ctx.close()}
  return out}

/* ---------- phone (P2): a subset of Details fields through the Details sheet, by touch ---------- */
async function phoneGroup(b){const out=[];let pg;
  try{pg=await fxSetup(b,{phone:true});const t=await touch(pg);out.push(row('mx-ob-p-fixture','phone: fixture plan opens',pg.fxOk));
    const tapEl=async loc=>{const p=await ev(pg,([s,n])=>{const e=document.querySelectorAll(s)[n];if(!e)return null;e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);
        return {x,y,ok:!!t&&(t===e||e.contains(t)||(e.closest('label')&&e.closest('label').contains(t)))}},[loc.sel,loc.nth||0]);if(!p)throw new Error('no control '+loc.sel);if(!p.ok)throw new Error('control covered at its centre: '+loc.sel);await t.tap(p.x,p.y);return true};
    /* tap the workstation on the plan, open Details from the bottom bar */
    const sel=async(id,wx,wy)=>{await ev(pg,()=>{window.__osp.setSel([]);if(window.__osp.P().insp)document.querySelector('#mbar [data-m=insp]').click()});await wf(pg,()=>document.querySelector('#p-sel').closest('[hidden]')!==null||!window.__osp.P().insp);
      await viewAt(pg,wx,wy,0.04);const [x,y]=await W2S(pg,wx,wy);
      /* never let this tap pair with the previous case's tap into a double-tap (rename) */
      await ev(pg,()=>document.querySelectorAll('.rename-in').forEach(e=>e.remove()));await wf(pg,()=>{const d=window.__osp.lastDown();return !d||performance.now()-d.t>600},null,3000);const top=await ev(pg,([x,y])=>{const e=document.elementFromPoint(x,y);const g=e&&e.closest('[data-id]');return g?g.dataset.id:(e?e.tagName+'#'+e.id+'.'+e.className:null)},[x,y]);
      await t.tap(x,y);const ok=await wf(pg,id=>{const s=window.__osp.sel();return s.length===1&&s[0]===id},id);
      await t.tap(...await ev(pg,()=>{const r=document.querySelector('#mbar [data-m=insp]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}));
      const open=await wf(pg,()=>{const e=document.querySelector('#p-sel');if(!e)return false;const r=e.getBoundingClientRect();return r.height>0&&window.__osp.P().insp});return {top,ok,open}};
    const PF=[
      {id:'w',obj:'it',at:[2000,2000],sel:'[data-f=w]',kind:'num',val:'1500',prop:'w',exp:1500,d2:B_('width'),d2exp:'1500'},
      {id:'label',obj:'it',at:[2000,2000],sel:'[data-f=label]',kind:'text',val:'Desk P',prop:'label',exp:'Desk P'},
      {id:'cat',obj:'it',at:[2000,2000],sel:'select[data-f=cat]',kind:'select',val:'Meeting',prop:'cat',exp:'Meeting',d2:`id=>window.__mx.attr(id,'','class')`,d2exp:{has:'cat-meet'}},
      /* a thumb taps the tick box's row; Chromium's touch emulation retargets a tap on the 13 px box itself to the panel, which a real phone does not do */
      {id:'arms',obj:'ch',at:[10000,2000],sel:'label:has(> [data-f=arms])',kind:'check',prop:'arms',exp:false},
      {id:'rotate',obj:'it',at:[2000,2000],sel:'[data-mact=rot]',kind:'btn',prop:'r',exp:90,d2:TR,d2exp:{has:'rotate(90)'}},
      {id:'room-swatch',obj:'r1',at:[2500,17000],sel:'[data-cp=room-floor] [data-cval="#2f6db5"]',kind:'btn',prop:'floorCol',exp:'#2f6db5'},
      {id:'wall-th',obj:'w1',at:[3000,8000],sel:'[data-f=th]',kind:'num',val:'250',prop:'th',exp:250,d2:`id=>window.__mx.attr(id,'','stroke-width')`,d2exp:'250'},
      {id:'text',obj:'tx',at:[9000,8500],sel:'[data-f=text]',kind:'text',val:'Phone',prop:'text',exp:'Phone'}];
    for(const c of PF){const f=[];const e1=pg.errs.length;const st0=await STATE(pg);const s=await sel(c.obj,...c.at);if(!s.ok)f.push(`tap did not select ${c.obj} (hit ${s.top})`);if(!s.open)f.push('Details sheet did not open');
      const p0=await ev(pg,([id,k])=>window.__osp.byId(id)[k],[c.obj,c.prop]);if(J(p0)===J(c.exp))f.push('precondition: already '+J(p0));
      const loc=loc_('#p-sel '+c.sel);
      if(!await cnt(pg,loc))f.push('no control '+c.sel);else{
        if(c.kind==='num'||c.kind==='text'){await tapEl(loc);await wf(pg,s=>document.activeElement===document.querySelector('#p-sel '+s),c.sel,2000);await pg.keyboard.press('Control+a');await pg.keyboard.type(c.val);await blur(pg)}
        else if(c.kind==='select'){await tapEl(loc);await pg.locator(loc.sel).first().selectOption(c.val,{force:true})}
        else await tapEl(loc);
        const r=await until(pg,`a=>window.__osp.byId(a[0])[a[1]]`,[c.obj,c.prop],v=>J(v)===J(c.exp));if(!r.ok)f.push(`value ${J(r.v)} ≠ ${J(c.exp)}`);
        if(c.d2){const r2=await until(pg,c.d2,c.obj,matcher(c.d2exp));if(!r2.ok)f.push('2D shows '+J(r2.v))}
        /* phone undo: the header Undo button, by touch */
        await blur(pg);await tapEl(loc_('#b-undo'));
        if(!(await until(pg,()=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null,st:S.style||null})},null,v=>v===st0)).ok)f.push('Undo did not restore it')}
      if(pg.errs.length>e1)f.push('console: '+pg.errs.slice(e1).join(' | '));
      out.push(row(`mx-ob-p-f-${c.id}`,`phone: Details sheet ${c.id} control works by touch (${c.obj}) and the Undo button restores it`,!f.length,f.join('; ')));
      await ev(pg,base=>{const o=window.__osp,S=o.S();const B=JSON.parse(base);S.objs=B.o;o.setSel([]);o.render()},pg.base)}
    out.push(row('mx-ob-p-errors','phone Details fields: no console errors',!pg.errs.length,pg.errs.slice(0,5).join(' | ')));
  }catch(e){out.push(row('mx-ob-p-crash','phone Details fields ran to the end',false,String(e&&e.stack||e).slice(0,400)))}
  finally{if(pg)await pg.ctx.close()}
  return out}

export async function run(b){
  const N=3;const groups=[];
  for(let k=0;k<N;k++)if(!ONLY||ONLY.test('lib'+(k+1)))groups.push(libGroup(b,k,N));
  if(!ONLY||ONLY.test('fitems'))groups.push(fieldGroup(b,'items',false));
  if(!ONLY||ONLY.test('fother'))groups.push(fieldGroup(b,'other',false));
  if(!ONLY||ONLY.test('f3items'))groups.push(fieldGroup(b,'items',true));
  if(!ONLY||ONLY.test('f3other'))groups.push(fieldGroup(b,'other',true));
  if(!ONLY||ONLY.test('ops'))groups.push(opsGroup(b));
  if(!ONLY||ONLY.test('phone'))groups.push(phoneGroup(b));
  return (await Promise.all(groups)).flat()}
