/* matrix slice: PHONE in 2D view (iPhone 13). Real CDP touch input wherever a user would use touch.
   Findings stay as failing rows: nothing here is weakened to pass.
   Every check asserts its precondition, acts with real touch, waits on the condition (no sleep-as-assertion) and checks that
   nothing else in the plan changed. SB_ONLY_IDS=<regex> runs only the groups holding matching ids (rows are filtered too).
   Each check carries the mutation (or, for a known bug, the fix) that proved it can go red (or green). */
import {openApp,row,click,touch} from '../../lib.mjs';
export const name='matrix-phone-2d';
const ID='mx-p2-';
const url=process.env.SB_URL||undefined;
const RE=process.env.SB_ONLY_IDS?new RegExp(process.env.SB_ONLY_IDS):null;
const want=ids=>!RE||ids.some(i=>RE.test(ID+i));
const ev=(pg,fn,arg)=>pg.evaluate(fn,arg);
const sleep=(pg,ms)=>pg.waitForTimeout(ms);
const ALLERRS=[];

/* the dev sample loader skips ensureBld (dev-only), so reopen it the way a user opens a file: through openPlanText */
async function open(b,extra){const pg=await openApp(b,{phone:true,...(url?{url}:{})});
  await pg.evaluate(x=>{const o=window.__osp;o.openPlanText(o.planJSON(),'sample.json');if(x){const S=o.S();S.objs.push(...JSON.parse(JSON.stringify(x.objs||[])));if(x.pins)S.pins=(S.pins||[]).concat(x.pins);if(x.section)S.section=x.section;o.render()}},extra||null);
  await pg.waitForFunction(()=>window.__osp.S().objs.length>100,null,{timeout:5000});await ev(pg,()=>window.__osp.toastOff());const t=await touch(pg);return {pg,t}}
async function done(pg,tag=''){try{ALLERRS.push(...pg.errs.map(e=>(tag?tag+' :: ':'')+e))}catch(e){}try{await Promise.race([pg.ctx.close(),new Promise(r=>{const h=setTimeout(r,6000);h.unref&&h.unref()})])}catch(e){}}

/* ---- waits and state readers ---- */
const W=(pg,fn,arg,ms=3000)=>pg.waitForFunction(fn,arg===undefined?null:arg,{timeout:ms,polling:40}).then(()=>true,()=>false);
const nObjs=pg=>ev(pg,()=>window.__osp.S().objs.length);
const sel=pg=>ev(pg,()=>window.__osp.sel());
const selIs=(pg,ids,ms)=>W(pg,ids=>JSON.stringify(window.__osp.sel().sort())===JSON.stringify([...ids].sort()),ids,ms);
const selN=(pg,n,ms)=>W(pg,n=>window.__osp.sel().length===n,n,ms);
const item=(pg,id)=>ev(pg,id=>{const o=window.__osp.S().objs.find(x=>x.id===id);return o?{x:o.x,y:o.y,r:o.r||0}:null},id);
const vis=(pg,s)=>ev(pg,s=>{const e=document.querySelector(s);if(!e)return false;const r=e.getBoundingClientRect();return !e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&r.width>0&&r.height>0},s);
const visW=(pg,s,on=true,ms)=>W(pg,([s,on])=>{const e=document.querySelector(s);const v=!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0;return v===on},[s,on],ms);
/* every object as JSON keyed by id, and what changed between two of those */
const objMap=pg=>ev(pg,()=>Object.fromEntries(window.__osp.S().objs.map(o=>[o.id,JSON.stringify(o)])));
function delta(a,b){const add=[],rem=[],chg=[];for(const k in b){if(!(k in a))add.push(k);else if(a[k]!==b[k])chg.push(k)}for(const k in a)if(!(k in b))rem.push(k);return {add,rem,chg}}
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const dsum=d=>({add:d.add.length,rem:d.rem.length,chg:d.chg.length});
const isNone=d=>!d.add.length&&!d.rem.length&&!d.chg.length;
/* "plain Select with nothing live" */
async function plain(pg){return ev(pg,()=>{const q=s=>document.querySelector(s);const v=s=>{const e=q(s);if(!e)return false;const r=e.getBoundingClientRect();return !e.hidden&&getComputedStyle(e).display!=='none'&&r.width>0&&r.height>0};
  const live={};
  live.toolNotSelect=!q('.dock [data-tool=select]').classList.contains('on');
  live.esc=v('#esc');live.multibar=v('#multibar');live.pstrip=v('#pstrip');live.paintstrip=v('#paintstrip');live.msheet=v('#msheet');live.ctx=v('#ctxmenu');
  live.lib=v('#d-lib');live.insp=v('#d-insp');live.shapePop=v('#pop-shape');live.poly=!!window.__osp.polyPts();live.placing=!!q('.lib-row.on');
  const bad=Object.keys(live).filter(k=>live[k]);return {ok:!bad.length,bad}})}
const plainW=(pg,ms)=>W(pg,()=>{const q=s=>document.querySelector(s);const v=s=>{const e=q(s);return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0};
  return q('.dock [data-tool=select]').classList.contains('on')&&!['#esc','#multibar','#pstrip','#paintstrip','#msheet','#ctxmenu','#d-lib','#d-insp','#pop-shape'].some(v)&&!window.__osp.polyPts()&&!q('.lib-row.on')},undefined,ms);
/* hard reset between states so one failure does not poison the next */
async function reset(pg){await ev(pg,()=>{const o=window.__osp;o.setTool('select');const m=document.querySelector('#multi-done');if(m&&!document.querySelector('#multibar').hidden)m.click();
  const ms=document.querySelector('#msheet');if(!ms.hidden)document.querySelector('#msheet [data-msheet-close]').click();
  ['#d-lib','#d-insp'].forEach(s=>{if(!document.querySelector(s).hidden)document.querySelector(s+' .grab').click()});
  const c=document.querySelector('#ctxmenu');if(c)c.hidden=true;const sp=document.querySelector('#pop-shape');if(sp)sp.hidden=true;o.setSel([]);o.toastOff();const r=document.querySelector('.rename-in');if(r)r.remove()});await sleep(pg,60)}

/* ---- touch helpers ---- */
async function center(pg,sel,nth=0){return ev(pg,([s,n])=>{const e=[...document.querySelectorAll(s)][n];if(!e)return null;e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();if(!(r.width>0&&r.height>0))return null;const x=r.left+r.width/2,y=r.top+r.height/2;const top=document.elementFromPoint(x,y);return {x,y,hit:!!top&&(e===top||e.contains(top)||top.contains(e))}},[sel,nth])}
/* tap the centre of a control; throws when it is missing, hidden or covered (a user could not tap it either) */
async function tapEl(pg,t,sel,nth=0,wait=60){const c=await center(pg,sel,nth);if(!c)throw new Error('no visible element '+sel);if(!c.hit)throw new Error('covered: '+sel);await t.tap(c.x,c.y);await sleep(pg,wait);return true}
async function longPress(pg,t,x,y,ms=650){await t.T('touchStart',[[x,y]]);await sleep(pg,ms);await t.T('touchEnd',[]);await visW(pg,'#ctxmenu',true,1500)}
/* two quick taps at one spot, inside the app's 500 ms double-tap window */
async function dblTap(pg,t,x,y){await t.tap(x,y);await t.tap(x,y)}
/* one-finger drag whose first step already travels 14 px, as a real finger does, so the app's 480 ms long-press timer can never
   fire mid-drag on a loaded machine (it only fires while the finger is still within 10 px of where it landed) */
async function fdrag(pg,t,a,b,n=10){const L=Math.hypot(b[0]-a[0],b[1]-a[1])||1,f=Math.min(1,14/L);await Promise.all([t.T('touchStart',[[a[0],a[1]]]),t.T('touchMove',[[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]])]);
  for(let i=1;i<=n;i++){const k=f+(1-f)*i/n;await t.T('touchMove',[[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k]]);await sleep(pg,16)}await t.T('touchEnd',[])}
const planRect=pg=>ev(pg,()=>{const r=document.querySelector('#plan').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height}});
const fit=async pg=>{await ev(pg,()=>{window.__osp.fit();window.__osp.render()});await sleep(pg,60)};
/* zoom onto three desks in a row, return their ids and screen centres */
async function desks(pg){
  await ev(pg,()=>{const o=window.__osp,S=o.S();const ds=S.objs.filter(x=>x.t==='item'&&/^WS/.test(x.code));const a=ds[0];
    const r=ds.filter(d=>Math.abs(d.y-a.y)<50).sort((p,q)=>Math.abs(p.x-a.x)-Math.abs(q.x-a.x)).slice(0,3).sort((p,q)=>p.x-q.x);
    const k=0.05,p=document.querySelector('#plan').getBoundingClientRect();o.V.k=k;o.V.x=r[1].x-(p.width/2)/k;o.V.y=r[1].y-(p.height*0.3)/k;o.render();window.__dk=r.map(d=>d.id)});
  await sleep(pg,60);
  return ev(pg,()=>window.__dk.map(id=>{const e=document.querySelector(`#plan [data-id="${id}"]`);const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const top=document.elementFromPoint(x,y);const h=top&&top.closest('[data-id]');const o=window.__osp.S().objs.find(q=>q.id===id);const g=o.gid?window.__osp.S().objs.filter(q=>q.gid===o.gid).map(q=>q.id):[id];return {id,x,y,ok:!!h&&h.dataset.id===id,grp:g.sort()}}))}
/* a point on the plan that is not on any object (needs the fitted view) */
async function empty(pg,nth=0){return ev(pg,nth=>{const p=document.querySelector('#plan').getBoundingClientRect();const found=[];const mb=document.querySelector('#mbar').getBoundingClientRect().top;
  const bad=(x,y)=>{const e=document.elementFromPoint(x,y);return !e||!e.closest('#plan')||!!e.closest('[data-id],[data-pin],[data-vh],[data-bh],[data-aim],[data-sech]')};
  for(let y=p.top+24;y<Math.min(p.bottom,mb)-40;y+=16)for(let x=p.left+24;x<p.right-24;x+=16){if(bad(x,y)||bad(x+10,y)||bad(x,y+10)||bad(x-10,y)||bad(x,y-10))continue;found.push([x,y])}
  return found[nth]||null},nth)}
/* a screen point whose topmost plan element belongs to object id (scans the element's box) */
const hitPt=(pg,id)=>ev(pg,id=>{const e=document.querySelector(`#plan [data-id="${id}"]`);if(!e)return null;const r=e.getBoundingClientRect(),p=document.querySelector('#plan').getBoundingClientRect(),mb=document.querySelector('#mbar').getBoundingClientRect().top;
  const st=Math.max(2,Math.min(r.width,r.height)/8);for(let y=r.top+r.height/2,dy=0;dy<=r.height/2;dy+=st)for(const yy of [y+dy,y-dy])for(let x=r.left+r.width/2,dx=0;dx<=r.width/2;dx+=st)for(const xx of [x+dx,x-dx]){if(xx<p.left+6||xx>p.right-6||yy<p.top+6||yy>mb-10)continue;
    const h=document.elementFromPoint(xx,yy);const c=h&&h.closest('[data-id]');if(c&&c.dataset.id===id&&!h.closest('[data-vh],[data-bh]'))return [xx,yy]}return null},id);
const undoBtn=async pg=>{const p=await ev(pg,()=>window.__osp.past());await click(pg,'#b-undo');await W(pg,p=>window.__osp.past()===p-1,p,2000)};
const redoBtn=async pg=>{const f=await ev(pg,()=>window.__osp.future());await click(pg,'#b-redo');await W(pg,f=>window.__osp.future()===f-1,f,2000)};

export async function run(b){
  /* every group has its own page; groups run two at a time; rows are joined in group order */
  const jobs=[];const mk=R=>(id,nm,pass,d)=>R.push(row(ID+id,nm,pass,d));
  const mkg=add=>async(id,nm,fn)=>{try{await fn()}catch(e){add(id,nm+' (test threw)',false,String(e&&e.message||e).slice(0,300))}};
  const declared=[];const job=(ids,fn)=>{if(want(ids)){declared.push(...ids);jobs.push(fn)}};

  /* ================= A. selection, move, actions, undo/redo ================= */
  job(['setup','sel-one','clear-tap','clear-slot','multi-menu','multi','multi-done-plain','selall','move','undo-move','acts-row','rotate','undo-rotate','duplicate','undo-duplicate','delete-sheet','undo-delete-sheet','delete-header','undo-delete-header'],async()=>{const R=[],add=mk(R),guard=mkg(add);const {pg,t}=await open(b);let D;
   // mutation: app.js ~575 item markup `<g data-id=` → `<g data-idx=` → FAIL confirmed
   await guard('setup','desks are hit-testable at the zoomed view',async()=>{D=await desks(pg);add('setup','three desks in a row are tappable at the zoomed view',D.length===3&&D.every(d=>d.ok)&&!same(D[0].grp,D[1].grp)&&!same(D[1].grp,D[2].grp),D)});
   if(D&&D.length===3){
   // mutation: app.js ~1103 select-case `if(!sel.has(o.id)){sel=new Set(grp…)}` → `if(!sel.size){…}` (a second tap does not replace) → FAIL confirmed
   await guard('sel-one','select one by tap, tap another replaces',async()=>{
     await reset(pg);D=await desks(pg);const s0=await sel(pg);const m0=await objMap(pg);
     await t.tap(D[0].x,D[0].y);const a=await selIs(pg,D[0].grp);await sleep(pg,550);await t.tap(D[1].x,D[1].y);const c=await selIs(pg,D[1].grp);const d=delta(m0,await objMap(pg));
     add('sel-one','tap selects one object, tapping another replaces the selection',s0.length===0&&a&&c&&isNone(d),{s0:s0.length,first:a,replaced:c,now:await sel(pg),g1:D[1].grp,planChanged:dsum(d)})});
   // mutation: app.js ~1225 pan pointerup `if(tool==='select'&&!multiMode&&…){sel.clear()…}` → `if(false&&…)` → FAIL confirmed (clear-tap)
   // mutation: app.js ~2679 mbar select slot `else if(sel.size||pinSel){sel.clear();…}` → `else if(false){…}` → FAIL confirmed (clear-slot)
   await guard('clear','clear selection',async()=>{
     await reset(pg);D=await desks(pg);await t.tap(D[0].x,D[0].y);const a=await selIs(pg,D[0].grp);
     await fit(pg);const e=await empty(pg);const m0=await objMap(pg);let b1=false;if(e){await t.tap(e[0],e[1]);b1=await selN(pg,0)}const d1=delta(m0,await objMap(pg));
     add('clear-tap','tapping empty plan clears the selection',a&&b1&&isNone(d1),{selectedFirst:a,cleared:b1,emptyFound:!!e,planChanged:dsum(d1)});
     await sleep(pg,550);D=await desks(pg);await t.tap(D[0].x,D[0].y);const a2=await selIs(pg,D[0].grp);const m1=await objMap(pg);await tapEl(pg,t,'#mbar [data-m=select]');const c1=await selN(pg,0);const d2=delta(m1,await objMap(pg));
     add('clear-slot','Select slot in the bottom bar clears the selection',a2&&c1&&isNone(d2),{selectedFirst:a2,cleared:c1,planChanged:dsum(d2)})});
   // mutation: app.js ~1305 ctxmenu `if(a==='multi')setMulti(!multiMode);` → `if(a==='multi');` → FAIL confirmed (multi, multi-done-plain)
   // mutation: app.js ~1257 ctxItems empty-canvas `items.push(['multi',…` → `['multiX',…` → FAIL confirmed (multi-menu)
   await guard('multi','select several',async()=>{
     await reset(pg);await fit(pg);const e=await empty(pg);let menu=false,hadMulti=false,n3=false,n2=false,bar='',ended=false,tapped=false,barOn=false;D=await desks(pg);const g=D.map(d=>d.grp);
     await fit(pg);
     if(e){await longPress(pg,t,e[0],e[1]);menu=await vis(pg,'#ctxmenu');hadMulti=await ev(pg,()=>!!document.querySelector('#ctxmenu [data-cm=multi]'));
       if(hadMulti){await tapEl(pg,t,'#ctxmenu [data-cm=multi]');barOn=await visW(pg,'#multibar',true);D=await desks(pg);
         let acc=[];for(const d of D){await t.tap(d.x,d.y);acc=acc.concat(d.grp);await selIs(pg,acc)}n3=await selIs(pg,[...g[0],...g[1],...g[2]]);bar=await ev(pg,()=>document.querySelector('#multibar b').textContent);
         await sleep(pg,550);await t.tap(D[1].x,D[1].y);n2=await selIs(pg,[...g[0],...g[2]]);tapped=true;
         await tapEl(pg,t,'#multi-done');ended=await visW(pg,'#multibar',false)}}
     add('multi-menu','long-press on empty plan opens a menu with "Select several…"',menu&&hadMulti,{menu,hadMulti,emptyFound:!!e});
     const nAll=g[0].length+g[1].length+g[2].length;
     add('multi','Select several: tap 3 objects → 3 selected, tap one again → 2, Done ends the mode',barOn&&tapped&&n3&&n2&&ended&&bar.startsWith(String(nAll)),{barOn,n3,n2,bar,ended,sel:await sel(pg)});
     /* after Done, a plain tap must replace, not toggle (wait out the 500 ms double-tap window first) */
     const before=await sel(pg);await sleep(pg,550);await t.tap(D[1].x,D[1].y);const rep=await selIs(pg,D[1].grp);
     add('multi-done-plain','after Done a tap on another object replaces the selection (mode really ended)',tapped&&same(before,[...g[0],...g[2]])&&rep,{before,rep,now:await sel(pg),g1:D[1].grp})});
   // mutation: app.js ~1287 ctxmenu `if(a==='selall'){setSel(…)…}` → `if(a==='selall'){return}` → FAIL confirmed
   await guard('selall','select all + clear',async()=>{
     /* oracle: the same filter the app uses for Ctrl+A */
     await reset(pg);await fit(pg);await pg.keyboard.press('Control+a');await W(pg,()=>window.__osp.sel().length>0);const exp=await sel(pg);await reset(pg);await fit(pg);
     const e=await empty(pg);let got=[],cleared=false,has=false;const s0=(await sel(pg)).length;const m0=await objMap(pg);
     if(e){await longPress(pg,t,e[0],e[1]);has=await ev(pg,()=>!!document.querySelector('#ctxmenu [data-cm=selall]'));
       if(has){await tapEl(pg,t,'#ctxmenu [data-cm=selall]');await W(pg,n=>window.__osp.sel().length===n,exp.length);got=await sel(pg);
         const e2=await empty(pg);if(e2){await t.tap(e2[0],e2[1]);cleared=await selN(pg,0)}}}
     const walls=await ev(pg,ids=>ids.filter(i=>{const o=window.__osp.S().objs.find(x=>x.id===i);return o&&(o.t==='room'||o.t==='wall')}).length,got);const d=delta(m0,await objMap(pg));
     add('selall','long-press empty → Select all furniture selects exactly the furniture (no rooms/walls), a tap on empty plan clears it',has&&s0===0&&exp.length>=10&&same(got,exp)&&walls===0&&cleared&&isNone(d),{has,s0,n:got.length,exp:exp.length,walls,cleared,planChanged:dsum(d)})});
   // mutation: app.js ~1135 pointermove `case 'move':` body returns early (`case 'move':return;`) → FAIL confirmed (move)
   // mutation: app.js ~269 undo(): `restoreState(s)` → `void s` (undo does nothing) → FAIL confirmed (all undo-* rows)
   await guard('move','move by drag + undo/redo',async()=>{
     await reset(pg);D=await desks(pg);const id=D[0].id;const o0=await item(pg,id);const m0=await objMap(pg);
     await fdrag(pg,t,[D[0].x,D[0].y],[D[0].x+60,D[0].y+40],12);await W(pg,([id,x])=>window.__osp.S().objs.find(o=>o.id===id).x!==x,[id,o0.x]);await sleep(pg,60);const o1=await item(pg,id);const m1=await objMap(pg);const d=delta(m0,m1);
     const k=await ev(pg,()=>window.__osp.V.k);const dx=o1.x-o0.x,dy=o1.y-o0.y;
     /* 60×40 px at the zoom, within one snap step (or two) of the finger */
     const ok=Math.abs(dx-60/k)<=Math.max(250,0.25*60/k)&&Math.abs(dy-40/k)<=Math.max(250,0.25*40/k);
     add('move','dragging an item with one finger moves it (its group only) by the finger distance',ok&&d.add.length===0&&d.rem.length===0&&same(d.chg,D[0].grp),{o0,o1,want:[Math.round(60/k),Math.round(40/k)],changed:d.chg,grp:D[0].grp});
     await undoBtn(pg);const back=delta(m0,await objMap(pg));await redoBtn(pg);const again=delta(m1,await objMap(pg));
     add('undo-move','Undo button puts the moved item back, Redo moves it again',d.chg.length>0&&isNone(back)&&isNone(again),{undoDiff:dsum(back),redoDiff:dsum(again)});
     await undoBtn(pg)});
   // mutation: app.js ~2699 data-mact `if(k==='rot')rotateSel(90);` → `if(k==='rot');` → FAIL confirmed (rotate, undo-rotate)
   // mutation: app.js ~2699 data-mact `else if(k==='dup')duplicateSel();` → `else if(k==='dup');` → FAIL confirmed (duplicate, undo-duplicate)
   // mutation: app.js ~2699 data-mact `else if(k==='del')deleteAction()` → `else if(k==='del');` → FAIL confirmed (delete-sheet, undo-delete-sheet)
   // mutation: app.js ~1601 action row `if(PHONE()&&sel.size&&!S.locked)h=…macts…` → `if(false)` → FAIL confirmed (acts-row)
   await guard('acts','Details actions row',async()=>{
     await reset(pg);D=await desks(pg);const g=D[1].grp;await t.tap(D[1].x,D[1].y);const s1=await selIs(pg,g);
     const closed0=!(await vis(pg,'#d-insp'));await tapEl(pg,t,'#mbar [data-m=insp]');const open=await visW(pg,'#d-insp',true);
     const hasRow=await W(pg,()=>['rot','dup','del'].every(k=>{const e=document.querySelector(`#d-insp [data-mact=${k}]`);return e&&e.getBoundingClientRect().width>0}));
     add('acts-row','Details sheet shows Rotate / Duplicate / Delete for a selected item',s1&&closed0&&open&&hasRow,{s1,closed0,open,hasRow});
     /* rotate */
     const m0=await objMap(pg);const r0=await item(pg,D[1].id);await tapEl(pg,t,'#d-insp [data-mact=rot]');await W(pg,([id,r])=>(window.__osp.S().objs.find(o=>o.id===id).r||0)!==r,[D[1].id,r0.r]);const r1=await item(pg,D[1].id);const mr=await objMap(pg);const dr=delta(m0,mr);
     add('rotate','Details → Rotate turns the selected item 90° (only its group changes)',((r1.r-r0.r+360)%360)===90&&same(dr.chg,g)&&!dr.add.length&&!dr.rem.length,{r0:r0.r,r1:r1.r,changed:dr.chg,grp:g});
     await undoBtn(pg);const u=delta(m0,await objMap(pg));await redoBtn(pg);const rr=delta(mr,await objMap(pg));
     add('undo-rotate','Undo/Redo after Rotate',dr.chg.length>0&&isNone(u)&&isNone(rr),{undo:dsum(u),redo:dsum(rr)});await undoBtn(pg);
     /* duplicate */
     await ev(pg,g=>window.__osp.setSel(g),g);const n0=await nObjs(pg);await tapEl(pg,t,'#d-insp [data-mact=dup]');await W(pg,n=>window.__osp.S().objs.length===n,n0+g.length);const md=await objMap(pg);const dd=delta(m0,md);
     const codes=await ev(pg,([a,b])=>{const S=window.__osp.S(),c=ids=>ids.map(i=>S.objs.find(o=>o.id===i).code).sort().join();return [c(a),c(b)]},[g,dd.add]);const selNew=same(await sel(pg),dd.add);
     add('duplicate','Details → Duplicate adds a copy of the group (same items, the copy is selected, nothing else changes)',dd.add.length===g.length&&!dd.rem.length&&!dd.chg.length&&codes[0]===codes[1]&&selNew,{delta:dsum(dd),codes,selNew});
     await undoBtn(pg);const ud=delta(m0,await objMap(pg));await redoBtn(pg);const rd=delta(md,await objMap(pg));
     add('undo-duplicate','Undo/Redo after Duplicate',dd.add.length>0&&isNone(ud)&&isNone(rd),{undo:dsum(ud),redo:dsum(rd)});await undoBtn(pg);
     /* delete */
     await ev(pg,g=>window.__osp.setSel(g),g);await W(pg,()=>!!document.querySelector('#d-insp [data-mact=del]'));
     await tapEl(pg,t,'#d-insp [data-mact=del]');await W(pg,n=>window.__osp.S().objs.length===n,n0-g.length);const mx=await objMap(pg);const dx=delta(m0,mx);
     add('delete-sheet','Details → Delete removes exactly the selected group',same(dx.rem,g)&&!dx.add.length&&!dx.chg.length,{delta:dsum(dx),removed:dx.rem,grp:g});
     await undoBtn(pg);const ux=delta(m0,await objMap(pg));await redoBtn(pg);const rx=delta(mx,await objMap(pg));
     add('undo-delete-sheet','Undo/Redo after Delete from the sheet',dx.rem.length>0&&isNone(ux)&&isNone(rx),{undo:dsum(ux),redo:dsum(rx)});await undoBtn(pg);
     await reset(pg)});
   // mutation: app.js ~2638 `$('#b-del').addEventListener('click',()=>deleteAction())` → `…,()=>{}` → FAIL confirmed (delete-header, undo-delete-header)
   await guard('hdel','header delete',async()=>{
     await reset(pg);D=await desks(pg);const g=D[2].grp;const dis0=await ev(pg,()=>document.querySelector('#b-del').disabled);
     await t.tap(D[2].x,D[2].y);const s=await selIs(pg,g);const en=await ev(pg,()=>!document.querySelector('#b-del').disabled);
     const m0=await objMap(pg);await tapEl(pg,t,'#b-del');await W(pg,n=>window.__osp.S().objs.length===n,Object.keys(m0).length-g.length);const m1=await objMap(pg);const d=delta(m0,m1);
     add('delete-header','header Delete: disabled with nothing selected, enabled with a selection, removes exactly it',dis0&&s&&en&&same(d.rem,g)&&!d.add.length&&!d.chg.length,{dis0,s,en,delta:dsum(d)});
     await undoBtn(pg);const u=delta(m0,await objMap(pg));await redoBtn(pg);const r=delta(m1,await objMap(pg));
     add('undo-delete-header','Undo/Redo after header Delete',d.rem.length>0&&isNone(u)&&isNone(r),{undo:dsum(u),redo:dsum(r)});await undoBtn(pg)});
   }
   await done(pg,'grp');return R});

  /* ================= A7/A8. select every kind of thing; locked rooms ================= */
  const EXTRA={objs:[{id:'p2txt',t:'text',x:4000,y:16000,text:'Phone label',size:900,gid:null},{id:'p2dim',t:'dim',a:[12000,16000],b:[20000,16000],gid:null},{id:'p2wall',t:'wall',pts:[[3000,-4000],[27000,-4000]],th:400,closed:false,gid:null}],
    pins:[{id:'p2pin',x:26000,y:16000,text:'',done:false,lv:null}],section:{a:[2000,19500],b:[28000,19500],on:true,flip:false}};
  job(['sel-room','sel-wall','sel-text','sel-dim','sel-pin','sel-section','lock-room','unlock-room'],async()=>{const R=[],add=mk(R),guard=mkg(add);const {pg,t}=await open(b,EXTRA);
   const tapSel=async(id,label,nm,expect)=>guard(label,nm,async()=>{await reset(pg);await fit(pg);await sleep(pg,550);const p=await hitPt(pg,id);if(!p)return add(label,nm,false,'no tappable point on '+id);
     const s0=await sel(pg);const m0=await objMap(pg);await t.tap(p[0],p[1]);const ok=await expect();const d=delta(m0,await objMap(pg));add(label,nm,s0.length===0&&ok&&isNone(d),{s0:s0.length,ok,sel:await sel(pg),planChanged:dsum(d)})});
   const roomId=await ev(pg,()=>window.__osp.S().objs.find(o=>o.t==='room'&&o.name==='Meeting room').id);
   const wallId='p2wall';
   // mutation: app.js ~1046 touch pan branch `(tool==='select'&&!onObj)` → `(tool==='select')` (a finger on anything pans) → FAIL confirmed (sel-room, sel-wall, sel-text, sel-dim)
   await tapSel(roomId,'sel-room','tap inside a room selects the room',()=>selIs(pg,[roomId]));
   await tapSel(wallId,'sel-wall','tap a wall selects the wall',()=>selIs(pg,[wallId]));
   await tapSel('p2txt','sel-text','tap a text label selects it',()=>selIs(pg,['p2txt']));
   await tapSel('p2dim','sel-dim','tap a dimension selects it',()=>selIs(pg,['p2dim']));
   // mutation: app.js ~1046 `const onObj=ev.target.closest('[data-id],…,[data-pin]')` → drop `,[data-pin]` (a finger on a pin pans) → FAIL confirmed
   await guard('sel-pin','tap a pin',async()=>{await reset(pg);await fit(pg);await sleep(pg,550);const p=await ev(pg,()=>{const e=document.querySelector('[data-pin="p2pin"] .pin-body')||document.querySelector('[data-pin="p2pin"]');const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});
     const ps0=await ev(pg,()=>window.__osp.pinSel());await t.tap(p[0],p[1]);const ok=await W(pg,()=>window.__osp.pinSel()==='p2pin');const x=await ev(pg,()=>window.__osp.pins().find(q=>q.id==='p2pin'));
     add('sel-pin','tap a pin selects it (and does not move it)',!ps0&&ok&&x.x===26000&&x.y===16000,{ps0,pinSel:await ev(pg,()=>window.__osp.pinSel()),pin:[x.x,x.y]})});
   /* a finger tap near the section line must select it, as a click does on desktop */
   // NEW BUG (fails on the real build): a finger tap on the section line pans instead of selecting it.
   // fix-test: app.js ~1046 touch pan branch `(tool==='select'&&!onObj)` → `(tool==='select'&&!onObj&&!(S.section&&S.section.a&&segDist(w[0],w[1],S.section.a,S.section.b)<fs(9)))` → PASS confirmed
   await guard('sel-section','tap the section line',async()=>{await reset(pg);await fit(pg);await sleep(pg,550);const p=await ev(pg,()=>{const o=window.__osp,V=o.V,r=document.querySelector('#plan').getBoundingClientRect();return [r.left+(15000-V.x)*V.k,r.top+(19500-V.y)*V.k]});
     const top=await ev(pg,p=>{const e=document.elementFromPoint(p[0],p[1]);return !!e&&!!e.closest('#plan')&&!e.closest('[data-id]')},p);
     const s0=await ev(pg,()=>window.__osp.secSel());await t.tap(p[0],p[1]);const ok=await W(pg,()=>window.__osp.secSel()===true,undefined,1500);
     add('sel-section','tap on the section line selects it',top&&!s0&&ok,{onPlanNotObject:top,before:s0,secSel:await ev(pg,()=>window.__osp.secSel())})});
   // mutation: app.js ~384 `const fixed=o=>isWallish(o)&&!o.site&&S.locked` → `…&&false` (lock has no effect) → FAIL confirmed (lock-room)
   // mutation: app.js ~2639 #b-lock handler `S.locked=!S.locked` → `S.locked=true` (unlock impossible) → FAIL confirmed (unlock-room)
   await guard('lock','locked rooms',async()=>{await reset(pg);await fit(pg);
     await tapEl(pg,t,'#mbar [data-m=more]');await visW(pg,'#msheet',true);const tile=await vis(pg,'#msheet [data-pm=b-lock]');if(!tile)return add('lock-room','More → Lock rooms',false,'no Lock rooms tile');
     await tapEl(pg,t,'#msheet [data-pm=b-lock]');const locked=await W(pg,()=>window.__osp.S().locked===true);await ev(pg,()=>window.__osp.toastOff());await sleep(pg,550);
     const p=await hitPt(pg,roomId);const m0=await objMap(pg);const pts0=m0[roomId];
     if(p){await t.tap(p[0],p[1]);await sleep(pg,550);await fdrag(pg,t,p,[p[0]+50,p[1]+30],10)}
     const notSel=!(await W(pg,id=>window.__osp.sel().includes(id),roomId,700));const d=delta(m0,await objMap(pg));
     add('lock-room','More → Lock rooms: a tap on a room does not select it and a drag does not move it',locked&&!!p&&notSel&&!d.chg.includes(roomId)&&!d.rem.length&&!d.add.length,{locked,pt:!!p,notSel,changed:d.chg.slice(0,4)});
     await reset(pg);await fit(pg);await tapEl(pg,t,'#mbar [data-m=more]');await visW(pg,'#msheet',true);await tapEl(pg,t,'#msheet [data-pm=b-lock]');const un=await W(pg,()=>window.__osp.S().locked===false);await sleep(pg,550);
     const p2=await hitPt(pg,roomId);if(p2)await t.tap(p2[0],p2[1]);const selOk=await selIs(pg,[roomId]);
     add('unlock-room','More → Unlock rooms: a tap on the room selects it again',locked&&un&&selOk&&pts0===(await objMap(pg))[roomId],{un,selOk,sel:await sel(pg)})});
   await done(pg,'grp');return R});

  /* ================= B (phone). more edit actions from the long-press menu ================= */
  job(['axis-lock','rot-ccw','copy-paste','group','ungroup','rename-room'],async()=>{const R=[],add=mk(R),guard=mkg(add);const {pg,t}=await open(b);let D;
   /* item long-press menu helper: long-press desk k, then tap entry cm */
   const ctxOn=async(d,cm)=>{await sleep(pg,550);await longPress(pg,t,d.x,d.y);const has=await ev(pg,cm=>!!document.querySelector(`#ctxmenu [data-cm="${cm}"]`),cm);if(!has)throw new Error('item menu has no '+cm+': '+await ev(pg,()=>[...document.querySelectorAll('#ctxmenu [data-cm]')].map(b=>b.dataset.cm).join(',')));await tapEl(pg,t,`#ctxmenu [data-cm="${cm}"]`)};
   // mutation: app.js ~1041 pointerdown `if(pointers.size===2&&drag&&drag.m==='move'&&drag.moved&&…){drag.axisHold=true…}` → `if(false&&…)` → FAIL confirmed
   await guard('axis-lock','second finger axis-locks a drag',async()=>{await reset(pg);D=await desks(pg);const d0=D[0];const o0=await item(pg,d0.id);
     const e2=await ev(pg,()=>{const p=document.querySelector('#plan').getBoundingClientRect();return [p.left+30,p.top+30]});
     const pn0=await ev(pg,()=>window.__osp.pointersN());await t.T('touchStart',[[d0.x,d0.y,1]]);for(let i=3;i<=5;i++){await t.T('touchMove',[[d0.x+5*i,d0.y+2*i,1]]);await sleep(pg,16)}
     await W(pg,([id,x])=>window.__osp.S().objs.find(o=>o.id===id).x!==x,[d0.id,o0.x],1500);const free=await item(pg,d0.id);
     await t.T('touchStart',[[d0.x+25,d0.y+10,1],[e2[0],e2[1],2]]);for(let i=1;i<=10;i++){await t.T('touchMove',[[d0.x+25+6*i,d0.y+10+5*i,1],[e2[0],e2[1],2]]);await sleep(pg,16)}
     const locked=await item(pg,d0.id);await t.T('touchEnd',[]);await sleep(pg,120);const dx=locked.x-o0.x,dy=locked.y-o0.y;
     /* free drag moved both ways; with the second finger down the item sits on one axis through its start point and still follows the finger along the other */
     add('axis-lock','a second finger held down while dragging keeps the move on one axis',pn0===0&&free.x!==o0.x&&free.y!==o0.y&&Math.max(Math.abs(dx),Math.abs(dy))>Math.max(Math.abs(free.x-o0.x),Math.abs(free.y-o0.y))&&Math.min(Math.abs(dx),Math.abs(dy))<1,{pn0,o0,free,locked,dx,dy});
     await W(pg,()=>window.__osp.pointersN()===0,undefined,1500);
     await ev(pg,()=>{while(window.__osp.past())window.__osp.undo()})});
   // mutation: app.js ~1293 ctxmenu `else if(a==='rotccw')rotateSel(-90);` → `…rotateSel(90);` → FAIL confirmed
   await guard('rot-ccw','rotate the other way',async()=>{await reset(pg);D=await desks(pg);const r0=await item(pg,D[0].id);const m0=await objMap(pg);
     await ctxOn(D[0],'rotccw');await W(pg,([id,r])=>(window.__osp.S().objs.find(o=>o.id===id).r||0)!==r,[D[0].id,r0.r]);const r1=await item(pg,D[0].id);const d=delta(m0,await objMap(pg));
     add('rot-ccw','long-press menu → Rotate left turns the item −90° (only its group changes)',((r1.r-r0.r+360)%360)===270&&same(d.chg,D[0].grp)&&!d.add.length,{r0:r0.r,r1:r1.r,changed:d.chg});await ev(pg,()=>window.__osp.undo())});
   // mutation: app.js ~1294 ctxmenu `else if(a==='copy')copySel();` → `else if(a==='copy');` → FAIL confirmed
   await guard('copy-paste','copy then paste',async()=>{await reset(pg);D=await desks(pg);const m0=await objMap(pg);
     await ctxOn(D[2],'copy');await sleep(pg,100);await reset(pg);await fit(pg);const e=await empty(pg,30)||await empty(pg);await sleep(pg,550);await longPress(pg,t,e[0],e[1]);
     const has=await ev(pg,()=>!!document.querySelector('#ctxmenu [data-cm=paste]'));if(has)await tapEl(pg,t,'#ctxmenu [data-cm=paste]');await W(pg,n=>window.__osp.S().objs.length>n,Object.keys(m0).length);
     const d=delta(m0,await objMap(pg));const codes=await ev(pg,([a,b])=>{const S=window.__osp.S(),c=ids=>ids.map(i=>S.objs.find(o=>o.id===i).code).sort().join();return [c(a),c(b)]},[D[2].grp,d.add]);
     add('copy-paste','long-press item → Copy, long-press empty → Paste adds a copy of it',has&&d.add.length===D[2].grp.length&&codes[0]===codes[1]&&!d.rem.length&&!d.chg.length,{has,delta:dsum(d),codes});await ev(pg,()=>window.__osp.undo())});
   // mutation: app.js ~1298 ctxmenu `else if(a==='group')groupSel();` → `else if(a==='group');` → FAIL confirmed (group)
   // mutation: app.js ~1299 ctxmenu `else if(a==='ungroup')ungroupSel();` → `else if(a==='ungroup');` → FAIL confirmed (ungroup)
   await guard('group','group / ungroup',async()=>{await reset(pg);D=await desks(pg);const ids=[...D[0].grp,...D[1].grp];const m0=await objMap(pg);
     await ev(pg,ids=>window.__osp.setSel(ids),ids);await sleep(pg,550);await longPress(pg,t,D[0].x,D[0].y);const has=await ev(pg,()=>!!document.querySelector('#ctxmenu [data-cm=group]'));if(has)await tapEl(pg,t,'#ctxmenu [data-cm=group]');
     const gd=await W(pg,ids=>{const S=window.__osp.S(),g=ids.map(i=>S.objs.find(o=>o.id===i).gid);return !!g[0]&&g.every(x=>x===g[0])},ids);const d=delta(m0,await objMap(pg));
     add('group','long-press menu → Group puts the selected items in one group',has&&gd&&same(d.chg,ids)&&!d.add.length,{has,grouped:gd,changed:d.chg.length});
     await reset(pg);await sleep(pg,550);D=await desks(pg);await t.tap(D[0].x,D[0].y);const all=await selIs(pg,ids);await sleep(pg,550);await longPress(pg,t,D[0].x,D[0].y);const hu=await ev(pg,()=>!!document.querySelector('#ctxmenu [data-cm=ungroup]'));if(hu)await tapEl(pg,t,'#ctxmenu [data-cm=ungroup]');
     const ug=await W(pg,ids=>ids.every(i=>!window.__osp.S().objs.find(o=>o.id===i).gid),ids);
     add('ungroup','tap selects the whole group; long-press menu → Ungroup splits it',gd&&all&&hu&&ug,{tapSelectsGroup:all,has:hu,ungrouped:ug});await ev(pg,()=>{window.__osp.undo();window.__osp.undo()})});
   // mutation: app.js ~1061 double-tap `if(hit.t==='room')renameRoom(hit);` → `if(hit.t==='room');` → FAIL confirmed
   await guard('rename-room','double-tap rename',async()=>{await reset(pg);await fit(pg);const rid=await ev(pg,()=>window.__osp.S().objs.find(o=>o.t==='room'&&o.name==='Server room').id);await sleep(pg,550);
     /* a point inside the room where nothing else sits */
     const p=await hitPt(pg,rid);if(!p)throw new Error('no free point inside the room');
     await dblTap(pg,t,p[0],p[1]);let inp=await W(pg,()=>!!document.querySelector('.rename-in'),undefined,1500);
     /* a loaded machine can stretch two CDP taps past the 500 ms double-tap window: one more double-tap, as a user would */
     if(!inp){await ev(pg,()=>window.__osp.setSel([]));await sleep(pg,600);await dblTap(pg,t,p[0],p[1]);inp=await W(pg,()=>!!document.querySelector('.rename-in'))}
     if(inp){await pg.fill('.rename-in','Comms room');await pg.press('.rename-in','Enter')}const nm=await W(pg,id=>window.__osp.S().objs.find(o=>o.id===id).name==='Comms room',rid);
     add('rename-room','double-tap a room opens the name box; typing a name and Enter renames it',inp&&nm,{input:inp,name:await ev(pg,id=>window.__osp.S().objs.find(o=>o.id===id).name,rid)});await ev(pg,()=>window.__osp.undo())});
   await done(pg,'grp');return R});

  /* ================= C. draw, line, library ================= */
  job(['room','undo-room','line','undo-line','cancel-line-ends','cancel-line-discards','cancel-line-one','lib-place','undo-place','lib-stop-esc','lib-stop-strip','measure','text','section'],async()=>{const R=[],add=mk(R),guard=mkg(add);const {pg,t}=await open(b);
   const toolTile=async k=>{await tapEl(pg,t,'#mbar [data-m=draw]');await visW(pg,`#msheet [data-pt=${k}]`,true);await tapEl(pg,t,`#msheet [data-pt=${k}]`);await visW(pg,'#msheet',false)};
   const wp=(pg,x,y)=>ev(pg,([x,y])=>{const V=window.__osp.V,r=document.querySelector('#plan').getBoundingClientRect();return [V.x+(x-r.left)/V.k,V.y+(y-r.top)/V.k]},[x,y]);
   // mutation: app.js ~1232 pointerup rect `if(tool==='room'){…addObjs([{…t:'room'…}],true)…}` → `if(tool==='room'){render();return}` → FAIL confirmed (room, undo-room)
   await guard('room','draw a room',async()=>{
     await reset(pg);await fit(pg);const m0=await objMap(pg);
     await toolTile('room');await ev(pg,()=>window.__osp.toastOff());const e=await empty(pg,20)||await empty(pg);const chip=await ev(pg,()=>({v:!document.querySelector('#esc').hidden,txt:document.querySelector('#esc span').textContent}));const onTool=await ev(pg,()=>document.querySelector('.dock [data-tool=room]').classList.contains('on'));
     const a=e;const w0=await wp(pg,a[0],a[1]),w1=await wp(pg,a[0]+90,a[1]+60);
     await fdrag(pg,t,[a[0],a[1]],[a[0]+90,a[1]+60],10);await W(pg,n=>window.__osp.S().objs.length>n,Object.keys(m0).length);const m1=await objMap(pg);const d=delta(m0,m1);
     const r=d.add.length===1?JSON.parse(m1[d.add[0]]):null;const xs=r&&r.pts?r.pts.map(p=>p[0]):[],ys=r&&r.pts?r.pts.map(p=>p[1]):[];const tol=600;
     /* the Room tool snaps a corner onto a nearby wall face or room edge on purpose: a coordinate counts if it is near the finger, or a little further but exactly on a wall line */
     const wl=await ev(pg,()=>{const X=[],Y=[];window.__osp.S().objs.filter(o=>(o.t==='wall'||o.t==='room')&&o.pts).forEach(o=>{const h=o.t==='room'?0:(o.th||100)/2;o.pts.forEach(p=>{X.push(p[0],p[0]-h,p[0]+h);Y.push(p[1],p[1]-h,p[1]+h)})});return [X,Y]});
     const ok=(v,want,L)=>Math.abs(v-want)<tol||(Math.abs(v-want)<2.5*tol&&L.some(q=>Math.abs(q-v)<=1));
     const fits=!!r&&r.t==='room'&&ok(Math.min(...xs),w0[0],wl[0])&&ok(Math.max(...xs),w1[0],wl[0])&&ok(Math.min(...ys),w0[1],wl[1])&&ok(Math.max(...ys),w1[1],wl[1]);
     add('room','Draw sheet → Room, then dragging a finger draws one room where the finger went',onTool&&chip.v&&d.add.length===1&&!d.rem.length&&!d.chg.length&&fits,{onTool,chip,delta:dsum(d),fits,room:r&&r.pts,want:[w0,w1]});
     await undoBtn(pg);const u=delta(m0,await objMap(pg));await redoBtn(pg);const rr=delta(m1,await objMap(pg));
     add('undo-room','Undo/Redo after drawing a room',d.add.length===1&&isNone(u)&&isNone(rr),{undo:dsum(u),redo:dsum(rr)});
     await reset(pg)});
   const walls=pg=>ev(pg,()=>window.__osp.S().objs.filter(o=>o.t==='wall').length);
   // mutation: app.js ~1107 poly case `if(polyTool()&&polyPts&&polyPts.length>=2){…finishPoly(false)…}` → `if(false){…}` (a repeat tap does not finish) → FAIL confirmed (line, undo-line)
   await guard('line','poly line',async()=>{
     await reset(pg);await fit(pg);const p=await planRect(pg);const y0=p.t+60;const pts=[[p.l+50,y0],[p.l+130,y0+20],[p.l+210,y0]];
     const m0=await objMap(pg);await toolTile('poly');
     for(const q of pts){await t.tap(q[0],q[1]);await sleep(pg,90)}
     const live=await ev(pg,()=>({poly:(window.__osp.polyPts()||[]).length,txt:document.querySelector('#esc span').textContent,v:!document.querySelector('#esc').hidden}));
     /* finish: tap the last corner again */
     await sleep(pg,550);await t.tap(pts[2][0],pts[2][1]);await W(pg,()=>!window.__osp.polyPts());const m1=await objMap(pg);const d=delta(m0,m1);const w=d.add.length===1?JSON.parse(m1[d.add[0]]):null;
     add('line','three taps then a repeat tap on the last corner finishes one 3-corner wall line',live.poly===3&&!!w&&w.t==='wall'&&w.pts.length===3&&!d.rem.length&&!d.chg.length&&!(await ev(pg,()=>window.__osp.polyPts())),{live,delta:dsum(d),pts:w&&w.pts.length});
     await undoBtn(pg);const u=delta(m0,await objMap(pg));await redoBtn(pg);const r=delta(m1,await objMap(pg));
     add('undo-line','Undo/Redo after drawing a line',!!w&&isNone(u)&&isNone(r),{undo:dsum(u),redo:dsum(r)});
     await reset(pg)});
   // mutation: app.js ~2687 `$('#esc').addEventListener('click',()=>escapeAction())` → `…,()=>{}` → FAIL confirmed (cancel-line-ends, cancel-line-one)
   // fix-test: app.js ~2687 chip click handler → `()=>{if(polyPts&&polyPts.length){polyPts=null;typed='';updateHint();render();escSync();return}escapeAction()}` → PASS confirmed (cancel-line-discards)
   await guard('cancel-line','cancel half line',async()=>{
     await reset(pg);await fit(pg);const p=await planRect(pg);const y0=p.t+120;const w0=await walls(pg);
     await toolTile('poly');
     await t.tap(p.l+60,y0);await sleep(pg,90);await t.tap(p.l+160,y0+10);await W(pg,()=>(window.__osp.polyPts()||[]).length===2);
     const live=await ev(pg,()=>({n:(window.__osp.polyPts()||[]).length,txt:document.querySelector('#esc span').textContent}));
     await tapEl(pg,t,'#esc');const ended=await W(pg,()=>!window.__osp.polyPts());
     const w1=await walls(pg);
     add('cancel-line-ends','Cancel chip ends the half-drawn line (no line left in progress)',live.n===2&&ended,{live,ended});
     add('cancel-line-discards','chip labelled "Cancel line" throws the half-drawn line away (adds no wall)',live.n===2&&live.txt==='Cancel line'&&ended&&w1===w0,{label:live.txt,w0,w1});
     /* one corner only: chip must clear it */
     await reset(pg);const wA=await walls(pg);await toolTile('poly');await t.tap(p.l+60,y0+60);await W(pg,()=>(window.__osp.polyPts()||[]).length===1);
     const n1=await ev(pg,()=>(window.__osp.polyPts()||[]).length);await tapEl(pg,t,'#esc');const gone=await W(pg,()=>!window.__osp.polyPts());const w2=await walls(pg);
     add('cancel-line-one','with a single corner placed the chip cancels it and adds nothing',n1===1&&gone&&w2===wA,{n1,gone,wA,w2});
     await reset(pg)});
   // mutation: app.js ~1225 pointerup arr `if(d.m==='arr'){…addObjs(list,false)…}` → `if(d.m==='arr'){drawOverlay();return}` → FAIL confirmed (lib-place, undo-place)
   // mutation: app.js ~2688 `$('#pstrip-done').addEventListener('click',()=>setTool('select'))` → `…,()=>{}` → FAIL confirmed (lib-stop-strip)
   // mutation: app.js ~2658 escapeAction `else if(tool!=='select')setTool('select')` → skip when tool==='place' → FAIL confirmed (lib-stop-esc)
   await guard('lib','library placing',async()=>{
     await reset(pg);await fit(pg);const m0=await objMap(pg);
     await tapEl(pg,t,'#mbar [data-m=lib]');const libOpen=await visW(pg,'#d-lib',true);
     const ri=await ev(pg,()=>[...document.querySelectorAll('#lib-list .lib-row')].findIndex(r=>/Task chair/i.test(r.textContent)));
     if(ri<0)throw new Error('no Task chair row');await tapEl(pg,t,'#lib-list .lib-row',ri);
     const st={strip:await visW(pg,'#pstrip',true),libGone:await visW(pg,'#d-lib',false),chip:await ev(pg,()=>document.querySelector('#esc span').textContent)};
     await ev(pg,()=>window.__osp.toastOff());const e=await empty(pg,5)||await empty(pg);const we=await wp(pg,e[0],e[1]);await t.tap(e[0],e[1]);await W(pg,n=>window.__osp.S().objs.length>n,Object.keys(m0).length);const m1=await objMap(pg);const d=delta(m0,m1);const o=d.add.length===1?JSON.parse(m1[d.add[0]]):null;
     const near=!!o&&Math.hypot(o.x-we[0],o.y-we[1])<800&&/chair/i.test(o.name||'');
     add('lib-place','Library slot → tap a row → tap the plan places one task chair where tapped',libOpen&&st.strip&&st.libGone&&d.add.length===1&&!d.rem.length&&!d.chg.length&&near,{libOpen,st,delta:dsum(d),near,o:o&&[o.name,o.x,o.y],at:we});
     await undoBtn(pg);const u=delta(m0,await objMap(pg));await redoBtn(pg);const r=delta(m1,await objMap(pg));
     add('undo-place','Undo/Redo after placing an item',d.add.length===1&&isNone(u)&&isNone(r),{undo:dsum(u),redo:dsum(r)});
     const stillPlacing=await vis(pg,'#pstrip');const chipTxt=await ev(pg,()=>document.querySelector('#esc span').textContent);const n2=await nObjs(pg);await tapEl(pg,t,'#esc');const pl=await plainW(pg);
     add('lib-stop-esc','Cancel chip ("Stop placing") ends placing and adds nothing',stillPlacing&&chipTxt==='Stop placing'&&pl&&(await nObjs(pg))===n2,{stillPlacing,chipTxt,pl,bad:(await plain(pg)).bad});
     /* again via the strip's own Done */
     await tapEl(pg,t,'#mbar [data-m=lib]');await visW(pg,'#d-lib',true);await tapEl(pg,t,'#lib-list .lib-row',ri);const s2=await visW(pg,'#pstrip',true);const n3=await nObjs(pg);await tapEl(pg,t,'#pstrip-done');const pl2=await plainW(pg);
     add('lib-stop-strip','strip Done ends placing and adds nothing',s2&&pl2&&(await nObjs(pg))===n3,{s2,pl2,bad:(await plain(pg)).bad});
     await reset(pg)});
   // mutation: app.js ~1236 pointerup `if(d.m==='measure'){if(…>10)addObjs([{…t:'dim'…}],false)…}` → `if(d.m==='measure'){render();return}` → FAIL confirmed
   await guard('measure','measure',async()=>{await reset(pg);await fit(pg);const m0=await objMap(pg);await toolTile('measure');await ev(pg,()=>window.__osp.toastOff());const e=await empty(pg,40)||await empty(pg);
     const a=await wp(pg,e[0],e[1]),c=await wp(pg,e[0]+100,e[1]);await fdrag(pg,t,e,[e[0]+100,e[1]],10);await W(pg,n=>window.__osp.S().objs.length>n,Object.keys(m0).length);const m1=await objMap(pg);const d=delta(m0,m1);const o=d.add.length===1?JSON.parse(m1[d.add[0]]):null;
     const len=o&&o.a?Math.hypot(o.b[0]-o.a[0],o.b[1]-o.a[1]):0;const want=Math.hypot(c[0]-a[0],c[1]-a[1]);
     add('measure','Draw → Measure: a finger drag adds one dimension of the dragged length',!!o&&o.t==='dim'&&Math.abs(len-want)<Math.max(300,want*0.1)&&!d.rem.length&&!d.chg.length,{delta:dsum(d),len:Math.round(len),want:Math.round(want)});await ev(pg,()=>window.__osp.undo());await reset(pg)});
   // mutation: app.js ~1110 pointerdown `case 'text':{…addObjs([o],true)…}` → `case 'text':{return}` → FAIL confirmed
   await guard('text','text',async()=>{await reset(pg);await fit(pg);const m0=await objMap(pg);await toolTile('text');await ev(pg,()=>window.__osp.toastOff());const e=await empty(pg,60)||await empty(pg);
     await t.tap(e[0],e[1]);await W(pg,n=>window.__osp.S().objs.length>n,Object.keys(m0).length);const m1=await objMap(pg);const d=delta(m0,m1);const o=d.add.length===1?JSON.parse(m1[d.add[0]]):null;const we=await wp(pg,e[0],e[1]);
     await ev(pg,()=>document.activeElement&&document.activeElement.blur());
     add('text','Draw → Text: a tap adds one label there and returns to Select',!!o&&o.t==='text'&&Math.hypot(o.x-we[0],o.y-we[1])<800&&!d.rem.length&&!d.chg.length&&(await plainW(pg,1500)||(await plain(pg)).bad.every(k=>k==='insp')),{delta:dsum(d),o:o&&[o.x,o.y],at:we,bad:(await plain(pg)).bad});await ev(pg,()=>window.__osp.undo());await reset(pg)});
   // mutation: app.js ~1237 pointerup `if(d.m==='section'){if(…>200){checkpoint();S.section={…}…` → `if(d.m==='section'){render();return}` → FAIL confirmed
   await guard('section','section',async()=>{await reset(pg);await fit(pg);const p=await planRect(pg);const s0=await ev(pg,()=>!!window.__osp.S().section);const m0=await objMap(pg);await toolTile('section');
     const a=[p.l+40,p.t+80],c=[p.l+p.w-40,p.t+80];await fdrag(pg,t,a,c,10);const ok=await W(pg,()=>!!window.__osp.S().section);const d=delta(m0,await objMap(pg));
     add('section','Draw → Section: a finger drag sets the section line',!s0&&ok&&isNone(d),{before:s0,set:ok,planChanged:dsum(d)});await ev(pg,()=>window.__osp.undo());await reset(pg)});
   await done(pg,'grp');return R});

  /* ================= D. pinch and two-finger pan ================= */
  job(['pinch-zoom','pinch-out','pan-two','pan-one','pinch-still','pinch-furn'],async()=>{const R=[],add=mk(R),guard=mkg(add);const {pg,t}=await open(b);
   const Vs=()=>ev(pg,()=>({x:window.__osp.V.x,y:window.__osp.V.y,k:window.__osp.V.k}));
   // mutation: app.js ~1116 pointermove pinch `zoomAt((pinch.k*d/pinch.d)/V.k,…)` → `zoomAt(1,…)` → FAIL confirmed (pinch-zoom, pinch-out)
   // mutation: app.js ~1116 pointermove pinch `V.x-=(mx-pinch.mx)/V.k;V.y-=(my-pinch.my)/V.k;` → removed → FAIL confirmed (pan-two)
   // mutation: app.js ~1126 pointermove `case 'pan':V.x=…;applyView();return;` → `case 'pan':return;` → FAIL confirmed (pan-one)
   await guard('pinch','pinch / pan',async()=>{
     await fit(pg);const p=await planRect(pg);
     const pair=await ev(pg,()=>{const pr=document.querySelector('#plan').getBoundingClientRect();const ok=(x,y)=>{const e=document.elementFromPoint(x,y);return e&&e.closest('#plan')&&!e.closest('[data-id],[data-pin],[data-vh]')};
       for(let y=pr.top+24;y<pr.bottom-200;y+=12)for(let x=pr.left+40;x<pr.left+150;x+=12){if(ok(x,y)&&ok(x+120,y))return [[x,y],[x+120,y]]}return null});
     const A=pair?pair[0]:[p.l+100,p.t+60],B2=pair?pair[1]:[p.l+220,p.t+60];
     const V0=await Vs();const m0=await objMap(pg);const s0=(await sel(pg)).length;
     await Promise.all([t.T('touchStart',[[A[0],A[1],1],[B2[0],B2[1],2]]),t.T('touchMove',[[A[0]-12,A[1],1],[B2[0]+12,B2[1],2]])]);
     for(let i=3;i<=10;i++){await t.T('touchMove',[[A[0]-6*i,A[1],1],[B2[0]+6*i,B2[1],2]]);await sleep(pg,16)}
     await t.T('touchEnd',[]);await W(pg,k=>window.__osp.V.k>k*1.3,V0.k);
     const V1=await Vs();const s1=(await sel(pg)).length;const d1=delta(m0,await objMap(pg));
     /* the spread was 120 → 240 px, so the zoom should be about 2× */
     add('pinch-zoom','two-finger spread zooms in about as far as the fingers spread; nothing is selected or moved',V1.k>V0.k*1.6&&V1.k<V0.k*2.5&&s0===0&&s1===0&&isNone(d1),{V0:V0.k,V1:V1.k,sel:s1,pair:!!pair,planChanged:dsum(d1)});
     const A2=[A[0],A[1]+10],B3=[A[0]+200,A[1]+10];
     await Promise.all([t.T('touchStart',[[A2[0],A2[1],1],[B3[0],B3[1],2]]),t.T('touchMove',[[A2[0]+16,A2[1],1],[B3[0]-16,B3[1],2]])]);
     for(let i=3;i<=10;i++){await t.T('touchMove',[[A2[0]+8*i,A2[1],1],[B3[0]-8*i,B3[1],2]]);await sleep(pg,16)}
     await t.T('touchEnd',[]);await W(pg,k=>window.__osp.V.k<k*0.85,V1.k);
     const V2=await Vs();const d2=delta(m0,await objMap(pg));
     add('pinch-out','two-finger pinch zooms out; nothing is selected or moved',V2.k<V1.k*0.85&&(await sel(pg)).length===0&&isNone(d2),{V1:V1.k,V2:V2.k,planChanged:dsum(d2)});
     const V3=await Vs();
     await Promise.all([t.T('touchStart',[[A[0],A[1],1],[B2[0],B2[1],2]]),t.T('touchMove',[[A[0]+14,A[1]+10,1],[B2[0]+14,B2[1]+10,2]])]);
     for(let i=3;i<=10;i++){await t.T('touchMove',[[A[0]+7*i,A[1]+5*i,1],[B2[0]+7*i,B2[1]+5*i,2]]);await sleep(pg,16)}
     await t.T('touchEnd',[]);await W(pg,([x,y])=>window.__osp.V.x!==x||window.__osp.V.y!==y,[V3.x,V3.y]);await sleep(pg,60);await W(pg,()=>window.__osp.pointersN()===0,undefined,1500);
     const V4=await Vs();const d3=delta(m0,await objMap(pg));
     /* fingers moved +70,+50 px: the view origin moves the other way by that distance in world units */
     const ex=-70/V3.k,ey=-50/V3.k;
     add('pan-two','two-finger drag pans the view by the finger travel without zooming and selects nothing',Math.abs((V4.x-V3.x)-ex)<Math.abs(ex)*0.25&&Math.abs((V4.y-V3.y)-ey)<Math.abs(ey)*0.25&&Math.abs(V4.k/V3.k-1)<0.05&&(await sel(pg)).length===0&&isNone(d3),{dx:V4.x-V3.x,dy:V4.y-V3.y,ex,ey,k:[V3.k,V4.k],planChanged:dsum(d3)});
     await W(pg,()=>window.__osp.pointersN()===0,undefined,1500);const pn5=await ev(pg,()=>window.__osp.pointersN());const V5=await Vs();const e=await empty(pg);await fdrag(pg,t,[e[0],e[1]],[e[0]+50,e[1]+30],8);await W(pg,x=>window.__osp.V.x!==x,V5.x);await sleep(pg,60);
     const V6=await Vs();const d4=delta(m0,await objMap(pg));
     add('pan-one','one finger dragging empty plan pans the view by the finger travel',Math.abs((V6.x-V5.x)+50/V5.k)<20/V5.k&&Math.abs((V6.y-V5.y)+30/V5.k)<20/V5.k&&(await sel(pg)).length===0&&isNone(d4),{pn5,e,dx:V6.x-V5.x,want:-50/V5.k,planChanged:dsum(d4)})});
   /* NEW BUG (fails on the real build): a pinch where one finger stays put (the usual anchor-and-spread) turns into a long-press */
   // fix-test: app.js ~1042 pinch start `if(pointers.size===2){const p=…` → `if(pointers.size===2){clearTimeout(lpTimer);const p=…` → PASS confirmed
   await guard('pinch-still','pinch with a still finger',async()=>{
     await reset(pg);await fit(pg);const pair=await ev(pg,()=>{const pr=document.querySelector('#plan').getBoundingClientRect();const ok=(x,y)=>{const e=document.elementFromPoint(x,y);return e&&e.closest('#plan')&&!e.closest('[data-id],[data-pin],[data-vh]')};
       for(let y=pr.top+24;y<pr.bottom-200;y+=12)for(let x=pr.left+40;x<pr.left+150;x+=12){if(ok(x,y)&&ok(x+100,y))return [[x,y],[x+100,y]]}return null});
     if(!pair)return add('pinch-still','pinch with one finger held still zooms and opens no menu',false,'no empty pair');
     const [A,B2]=pair;const k0=await ev(pg,()=>window.__osp.V.k);
     await t.T('touchStart',[[A[0],A[1],1],[B2[0],B2[1],2]]);for(let i=1;i<=10;i++){await t.T('touchMove',[[A[0],A[1],1],[B2[0]+10*i,B2[1],2]]);await sleep(pg,70)}
     const menu=await vis(pg,'#ctxmenu');await t.T('touchEnd',[]);await W(pg,()=>window.__osp.pointersN()===0,undefined,1500);const k1=await ev(pg,()=>window.__osp.V.k);
     add('pinch-still','pinch with one finger held still (spread over 0.7 s) zooms ~2× and opens no long-press menu',k1>k0*1.6&&!menu,{k0,k1,menuOpened:menu});await reset(pg)});
   // fix-test: app.js select-case keep the selection before a finger lands (`drag={m:'move',…,sb:new Set(sel)}` saved before `sel=new Set(grp…)`) and in the pinch branch ~1042 `if(drag&&drag.m==='move'&&!drag.moved&&drag.sb){sel=drag.sb;renderInspector()}` → PASS confirmed
   await guard('pinch-furn','pinch over furniture',async()=>{
     await reset(pg);const D=await desks(pg);await ev(pg,()=>window.__osp.setSel([]));await sleep(pg,60);
     const A=[D[0].x,D[0].y],B2=[D[2].x,D[2].y];const k0=await ev(pg,()=>window.__osp.V.k);const m0=await objMap(pg);const s0=(await sel(pg)).length;
     await t.T('touchStart',[[A[0],A[1],1],[B2[0],B2[1],2]]);for(let i=1;i<=8;i++){await t.T('touchMove',[[A[0]-5*i,A[1],1],[B2[0]+5*i,B2[1],2]]);await sleep(pg,16)}
     await t.T('touchEnd',[]);await W(pg,k=>window.__osp.V.k>k*1.2,k0);await sleep(pg,100);
     const k1=await ev(pg,()=>window.__osp.V.k);const s=await sel(pg);const d=delta(m0,await objMap(pg));
     add('pinch-furn','pinch with a finger landing on a desk zooms, selects nothing and moves nothing',s0===0&&k1>k0*1.2&&s.length===0&&isNone(d),{k0,k1,sel:s.length,planChanged:dsum(d)})});
   await done(pg,'grp');return R});

  /* ================= E. pins ================= */
  job(['pin-drop','undo-pin','pin-notes','pin-delete','undo-pin-delete'],async()=>{const R=[],add=mk(R),guard=mkg(add);const {pg,t}=await open(b);
   const pins=()=>ev(pg,()=>JSON.stringify(window.__osp.pins()||[]));
   // mutation: app.js ~1102 pointerdown `case 'pin':{checkpoint();…S.pins.push(pin)…}` → `case 'pin':{return}` → FAIL confirmed (pin-drop, undo-pin)
   // mutation: app.js ~1053 double-tap `…&&ev.target.closest('[data-pin]')){…openPin(…)…}` → `…&&false){…}` → FAIL confirmed (pin-notes)
   // mutation: app.js ~1404 deleteAction pin branch `S.pins=(S.pins||[]).filter(p=>p.id!==pinSel)` → `S.pins=S.pins||[]` → FAIL confirmed (pin-delete, undo-pin-delete)
   await guard('pin','pins',async()=>{
     await reset(pg);await fit(pg);const e=await empty(pg,3)||await empty(pg);const p0=JSON.parse(await pins());const m0=await objMap(pg);
     await tapEl(pg,t,'#mbar [data-m=draw]');await visW(pg,'#msheet [data-pt=pin]',true);await tapEl(pg,t,'#msheet [data-pt=pin]');
     const we=await ev(pg,e=>{const V=window.__osp.V,r=document.querySelector('#plan').getBoundingClientRect();return [V.x+(e[0]-r.left)/V.k,V.y+(e[1]-r.top)/V.k]},e);
     await t.tap(e[0],e[1]);await W(pg,n=>(window.__osp.pins()||[]).length===n+1,p0.length);const p1=JSON.parse(await pins());await ev(pg,()=>document.activeElement&&document.activeElement.blur());
     const np=p1.find(q=>!p0.some(z=>z.id===q.id));const d=delta(m0,await objMap(pg));
     add('pin-drop','Draw → Pin, tap the plan drops one pin where tapped',p1.length===p0.length+1&&!!np&&Math.hypot(np.x-we[0],np.y-we[1])<300&&isNone(d),{n0:p0.length,n1:p1.length,pin:np&&[np.x,np.y],at:we});
     await undoBtn(pg);const p2=JSON.parse(await pins());await redoBtn(pg);const p3=JSON.parse(await pins());
     add('undo-pin','Undo/Redo after dropping a pin',p1.length===p0.length+1&&p2.length===p0.length&&p3.length===p1.length,{n:[p0.length,p1.length,p2.length,p3.length]});
     await tapEl(pg,t,'#esc');await ev(pg,()=>{const g=document.querySelector('#d-insp .grab');if(!document.querySelector('#d-insp').hidden)g.click()});await visW(pg,'#d-insp',false);
     const pp=await ev(pg,()=>{const r=document.querySelector('[data-pin] .pin-body').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});
     const closed=!(await vis(pg,'#d-insp'));await sleep(pg,550);await dblTap(pg,t,pp[0],pp[1]);
     /* a loaded test machine can stretch two CDP taps past the 500 ms double-tap window; one more double-tap is what a user would do */
     if(!(await W(pg,()=>!document.querySelector('#d-insp').hidden,undefined,1200))){await sleep(pg,600);await dblTap(pg,t,pp[0],pp[1])}
     const r=await W(pg,()=>!document.querySelector('#d-insp').hidden&&!document.querySelector('#p-notes').hidden&&document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.pintext!==undefined)
     const rd=await ev(pg,()=>({open:!document.querySelector('#d-insp').hidden,notes:!document.querySelector('#p-notes').hidden,focus:!!document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.pintext!==undefined}));await ev(pg,()=>document.activeElement&&document.activeElement.blur());
     add('pin-notes','double-tap on a pin opens the notes with the text box focused',closed&&r,{closed,...rd});
     const ps=await ev(pg,()=>window.__osp.pinSel());const en=await ev(pg,()=>!document.querySelector('#b-del').disabled);const q0=JSON.parse(await pins());const mq=await objMap(pg);await tapEl(pg,t,'#b-del');await W(pg,n=>(window.__osp.pins()||[]).length===n-1,q0.length);const q1=JSON.parse(await pins());const dq=delta(mq,await objMap(pg));
     add('pin-delete','header Delete removes the selected pin (only it)',!!ps&&en&&q1.length===q0.length-1&&!q1.some(z=>z.id===ps)&&isNone(dq),{pinSel:ps,enabled:en,n0:q0.length,n1:q1.length});
     await undoBtn(pg);const q2=JSON.parse(await pins());add('undo-pin-delete','Undo after pin delete brings the pin back',q1.length===q0.length-1&&q2.length===q0.length&&q2.some(z=>z.id===ps),{n:[q0.length,q1.length,q2.length]})});
   await done(pg,'grp');return R});

  /* ================= F. a way out of every state ================= */
  const SHEET_TOOLS=['room','poly','spline','road','fence','shape','measure','text','paint','trunk','section','pin'];
  for(const part of ['tools','misc'])job(part==='tools'?['way-out-tools']:['way-out-placing','way-out-paint','way-out-measure','way-out-pin','way-out-multi','way-out-multi-slot','way-out-ctx','ctx-fits','way-out-sheet-draw','way-out-sheet-more','way-out-sheet-lib','way-out-sheet-insp','way-out-pull-lib','way-out-pull-insp','way-out-slot-toggle','way-out-shape-pop'],async()=>{const R=[],add=mk(R),guard=mkg(add);const {pg,t}=await open(b);
   /* try the on-screen exits in order: Cancel chip, strip Done, Select slot (each up to twice) */
   const exits=async()=>{const tried=[];
     for(const how of ['esc','strip','select']){
       for(let i=0;i<2;i++){if(await plainW(pg,250))return {ok:true,via:tried.join('>')||'none'};
         if(how==='esc'){if(!(await vis(pg,'#esc')))break;await tapEl(pg,t,'#esc');tried.push('esc')}
         else if(how==='strip'){const s=(await vis(pg,'#paintstrip'))?'#paintstrip-done':(await vis(pg,'#pstrip'))?'#pstrip-done':(await vis(pg,'#multibar'))?'#multi-done':null;if(!s)break;await tapEl(pg,t,s);tried.push(s)}
         else{await tapEl(pg,t,'#mbar [data-m=select]');tried.push('select')}}}
     const ok=await plainW(pg,600);const pl=await plain(pg);return {ok,via:tried.join('>'),bad:pl.bad}};
   // mutation: app.js ~2658 escapeAction `else if(tool!=='select')setTool('select')` → `else if(tool!=='select');` → FAIL confirmed (way-out-tools, way-out-measure, way-out-pin, way-out-shape-pop)
   if(part==='tools')await guard('wo-tools','way out tools',async()=>{
     const bad=[],via={};
     for(const k of SHEET_TOOLS){await reset(pg);await fit(pg);
       await tapEl(pg,t,'#mbar [data-m=draw]');if(!(await visW(pg,`#msheet [data-pt=${k}]`,true))){bad.push(k+':no tile');continue}
       await tapEl(pg,t,`#msheet [data-pt=${k}]`);
       /* tools that leave a live line: put a corner down first, as a user would */
       if(['poly','spline','road','fence','trunk'].includes(k)){const p=await planRect(pg);await t.tap(p.l+80,p.t+100);await sleep(pg,90);await t.tap(p.l+160,p.t+130);await W(pg,()=>(window.__osp.polyPts()||[]).length>=2)}
       const live=await plain(pg);if(live.ok){bad.push(k+':tool did not start');continue}
       const r=await exits();via[k]=r.via;if(!r.ok)bad.push(k+':'+(r.bad||[]).join('+')+' after '+r.via)}
     add('way-out-tools','every Draw-sheet tool (12) starts and can be left for plain Select with the on-screen controls',bad.length===0&&Object.keys(via).length===12,{bad,via})});
   if(part==='misc')await guard('wo-misc','way out misc',async()=>{
     /* placing */
     // mutation: app.js ~2688 pstrip-done → no-op AND escapeAction place → no-op (combined) → FAIL confirmed (way-out-placing)
     await reset(pg);await tapEl(pg,t,'#mbar [data-m=lib]');await visW(pg,'#d-lib',true);await tapEl(pg,t,'#lib-list .lib-row',0);let live=await visW(pg,'#pstrip',true);let r=await exits();
     add('way-out-placing','placing: a way back to plain Select',live&&r.ok,{live,...r});
     /* paint */
     // mutation: app.js ~2674 `if(e.target.closest('#paintstrip-done')){setTool('select');return}` → `{return}` plus escapeAction no-op → FAIL confirmed (way-out-paint)
     await reset(pg);await tapEl(pg,t,'#mbar [data-m=draw]');await visW(pg,'#msheet',true);await tapEl(pg,t,'#msheet [data-pt=paint]');live=await visW(pg,'#paintstrip',true);r=await exits();
     add('way-out-paint','paint: a way back to plain Select',live&&r.ok,{live,...r});
     /* measure and pin, explicitly */
     for(const k of ['measure','pin']){await reset(pg);await tapEl(pg,t,'#mbar [data-m=draw]');await visW(pg,'#msheet',true);await tapEl(pg,t,`#msheet [data-pt=${k}]`);const on=await W(pg,k=>document.querySelector(`.dock [data-tool=${k}]`).classList.contains('on'),k);r=await exits();add('way-out-'+k,k+' tool: a way back to plain Select',on&&r.ok,{on,...r})}
     /* select several */
     // mutation: app.js ~1307 `if(e.target.closest('#multi-done'))setMulti(false)` → `…)void 0` plus mbar select `else if(multiMode)setMulti(false)` → `else if(false)` → FAIL confirmed (way-out-multi, way-out-multi-slot)
     await reset(pg);await fit(pg);let e=await empty(pg);await longPress(pg,t,e[0],e[1]);await tapEl(pg,t,'#ctxmenu [data-cm=multi]');live=await visW(pg,'#multibar',true);
     r=await exits();add('way-out-multi','Select several: Done button / Select slot leave the mode',live&&r.ok,{live,...r});
     /* ...and the Select slot alone (no Done) */
     await reset(pg);await fit(pg);e=await empty(pg);await longPress(pg,t,e[0],e[1]);await tapEl(pg,t,'#ctxmenu [data-cm=multi]');const lm=await visW(pg,'#multibar',true);await tapEl(pg,t,'#mbar [data-m=select]');const pl=await plainW(pg);
     add('way-out-multi-slot','Select several: the Select slot alone ends the mode',lm&&pl,{live:lm,ok:pl,bad:(await plain(pg)).bad});
     /* long-press menu: dismiss by tapping elsewhere, by Select slot */
     // mutation: app.js ~1308 capture pointerdown ctxmenu hide → `void 0` and ~2489 closePops list drop '#ctxmenu' → FAIL confirmed (way-out-ctx)
     await reset(pg);await fit(pg);e=await empty(pg);await longPress(pg,t,e[0],e[1]);live=await vis(pg,'#ctxmenu');const e2=await empty(pg,40)||await empty(pg,1);await t.tap(e2[0],e2[1]);const d1=await visW(pg,'#ctxmenu',false);
     await sleep(pg,550);await longPress(pg,t,e[0],e[1]);const live2=await vis(pg,'#ctxmenu');await tapEl(pg,t,'#mbar [data-m=select]');const d2=await visW(pg,'#ctxmenu',false);
     add('way-out-ctx','long-press menu: a tap elsewhere or the Select slot dismisses it',live&&live2&&d1&&d2,{live,d1,live2,d2});
     /* ctx menu over a selected desk (item menu is longer, must not run under the bar) */
     // mutation: app.js ~1272 showMenu `m.style.top=Math.max(8,Math.min(cy,innerHeight-mh-reserve))` → `Math.max(8,cy)` → FAIL confirmed (ctx-fits)
     await reset(pg);const D=await desks(pg);
     /* bring the desk down near the bar with a one-finger pan on empty plan (real input) */
     {const y=await ev(pg,id=>{const e=document.querySelector(`#plan [data-id="${id}"]`).getBoundingClientRect();return e.top+e.height/2},D[0].id);const mbt=await ev(pg,()=>document.querySelector('#mbar').getBoundingClientRect().top);
      const e0=await ev(pg,()=>{const p=document.querySelector('#plan').getBoundingClientRect();for(let y=p.top+20;y<p.top+200;y+=8)for(let x=p.left+20;x<p.right-20;x+=8){const e=document.elementFromPoint(x,y);if(e&&e.closest('#plan')&&!e.closest('[data-id],[data-pin]'))return [x,y]}return null});
      if(e0)await fdrag(pg,t,e0,[e0[0],e0[1]+(mbt-70-y)],10);await sleep(pg,120)}
     const lp=await ev(pg,id=>{const e=document.querySelector(`#plan [data-id="${id}"]`).getBoundingClientRect();const x=e.left+e.width/2,y=e.top+e.height/2;const h=document.elementFromPoint(x,y);return {x,y,ok:!!h&&!!h.closest(`[data-id="${id}"]`)}},D[0].id);
     await longPress(pg,t,lp.x,lp.y);const mi=await ev(pg,()=>{const m=document.querySelector('#ctxmenu');const r=m.getBoundingClientRect();const mb=document.querySelector('#mbar').getBoundingClientRect();return {open:!m.hidden,top:r.top,bottom:r.bottom,mbarTop:mb.top,right:r.right,vw:innerWidth,items:m.querySelectorAll('[data-cm]').length}});
     add('ctx-fits','item long-press menu near the bottom bar stays on screen and above the bar',lp.ok&&lp.y>mi.mbarTop-120&&mi.open&&mi.items>5&&mi.top>=0&&mi.bottom<=mi.mbarTop+1&&mi.right<=mi.vw+1,{press:lp,...mi});
     await reset(pg);
     /* sheets */
     // mutation: app.js ~2684 msheet `if(e.target.closest('[data-msheet-close]')){msheet(null);return}` → `{return}` → FAIL confirmed (way-out-sheet-draw, -more)
     // mutation: app.js ~2698 document click `.grab[data-close]` → `if(g){return}` and ~2701 `[data-close]` click → no-op → FAIL confirmed (way-out-sheet-lib, -insp)
     for(const [slot,sheet,closer] of [['draw','#msheet','[data-msheet-close]'],['more','#msheet','[data-msheet-close]'],['lib','#d-lib','.grab'],['insp','#d-insp','.grab']]){
       await reset(pg);const was=await vis(pg,sheet);await tapEl(pg,t,`#mbar [data-m=${slot}]`);const o=await visW(pg,sheet,true);
       let tapped=false;if(o){await tapEl(pg,t,`${sheet} ${closer}`);tapped=true}const pl=await plainW(pg);
       add('way-out-sheet-'+slot,slot+' sheet: grab handle tap closes it',!was&&o&&tapped&&pl,{was,opened:o,tapped,plain:pl,bad:(await plain(pg)).bad})}
     /* pulled-down dismiss for the two drawers */
     // mutation: app.js ~2695 grab pull end `if(dy>70){…applyDrawers()}` → `if(false){…}` → FAIL confirmed (way-out-pull-lib, -insp)
     for(const [slot,sheet] of [['lib','#d-lib'],['insp','#d-insp']]){await reset(pg);await sleep(pg,400);const pre=await ev(pg,()=>[window.__osp.P().lib,window.__osp.P().insp,document.querySelector('#d-insp').hidden,document.querySelector('#d-lib').hidden]);await tapEl(pg,t,`#mbar [data-m=${slot}]`);const o=await visW(pg,sheet,true);const g=await center(pg,`${sheet} .grab`);
       if(o&&g){await t.T('touchStart',[[g.x+40,g.y]]);for(let i=1;i<=8;i++){await t.T('touchMove',[[g.x+40,g.y+i*17]]);await sleep(pg,16)}await t.T('touchEnd',[])}
       const gone=await visW(pg,sheet,false,1500);
       add('way-out-pull-'+slot,slot+' sheet: pulling the handle down dismisses it',o&&!!g&&gone,{pre,opened:o,gone,P:await ev(pg,()=>[window.__osp.P().lib,window.__osp.P().insp,document.querySelector('#d-insp').hidden])})}
     /* second tap on the same bar slot */
     // mutation: app.js ~2648 msheet `if(!kind||msheetKind===kind){sh.hidden=true…}` → `if(!kind){…}` → FAIL confirmed
     await reset(pg);await sleep(pg,400);await tapEl(pg,t,'#mbar [data-m=draw]');const first=await visW(pg,'#msheet',true);await tapEl(pg,t,'#mbar [data-m=draw]');const tg=await visW(pg,'#msheet',false);
     add('way-out-slot-toggle','tapping the Draw slot again closes its sheet',first&&tg,{openedFirst:first,closedSecond:tg});
     /* shape popup */
     await reset(pg);await tapEl(pg,t,'#mbar [data-m=draw]');await visW(pg,'#msheet',true);await tapEl(pg,t,'#msheet [data-pt=shape]');const sp=await visW(pg,'#pop-shape',true);
     /* pick a shape from the popup, as a user does: the shape tool is now live */
     let on=false;if(sp){await tapEl(pg,t,'#pop-shape [data-shape=rect]');on=await W(pg,()=>document.querySelector('.dock [data-tool=shape]')&&document.querySelector('.dock [data-tool=shape]').classList.contains('on'))}const r3=await exits();
     add('way-out-shape-pop','Shape tile → popup → Rectangle: the shape tool starts and there is a way back to plain Select',sp&&on&&r3.ok,{popShown:sp,toolOn:on,...r3});
   });
   await done(pg,'grp');return R});

  /* ================= G. no dead ends ================= */
  // mutation: app.js ~2637 `$('#b-save').addEventListener('click',()=>savePlan(false))` → `…,()=>{}` → FAIL confirmed (no-dead-ends flags hdr:b-save)
  job(['no-dead-ends'],async()=>{const R=[],add=mk(R);
   const snap=pg=>ev(pg,()=>{const o=window.__osp,S=o.S();const ids=[...document.querySelectorAll('[id]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden]')}).map(e=>e.id+'.'+e.className).join('|');
     const toast=document.querySelector('#toast');return JSON.stringify({ids,toast:toast&&!toast.hidden?toast.textContent:'',n:S.objs.length,sel:o.sel().length,past:o.past(),locked:S.locked,rcp:o.P().rcp,lib:o.P().lib,insp:o.P().insp,tabs:o.tabs().length,floor:document.querySelector('#b-floor').textContent,is3d:document.querySelector('#v3d').classList.contains('on'),dock:document.querySelector('.dock .btn.on')?.id||document.querySelector('.dock .btn.on')?.dataset.tool,k:o.V.k})});
   const bad=[],ok=[],dis=[];
   const HDR=()=>[...document.querySelectorAll('button,[role=button]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('#mbar,#msheet,#d-lib,#d-insp,#plans-modal,.modal,#ctxmenu,#pop-more')&&r.top<110});
   const list=await (async()=>{const {pg,t}=await open(b);const hdr=await ev(pg,src=>{const f=eval('('+src+')');return f().map((e,i)=>({i,id:e.id||('.'+e.className.split(' ')[0]+':'+e.textContent.trim())}))},HDR.toString());
     await tapEl(pg,t,'#mbar [data-m=more]');await visW(pg,'#msheet',true);const tiles=await ev(pg,()=>[...document.querySelectorAll('#msheet [data-pm]')].map(e=>e.dataset.pm));await done(pg,'list');return {hdr,tiles}})();
   const targets=[...list.hdr.map(h=>({kind:'hdr',id:h.id,idx:h.i})),...['select','draw','lib','insp','more'].map(id=>({kind:'bar',id})),...list.tiles.map(id=>({kind:'tile',id}))];
   const detail={};
   const probe=async tg=>{
     const {pg,t}=await open(b);let fc=0,dl=0;pg.on('filechooser',()=>fc++);pg.on('download',()=>dl++);
     await ev(pg,()=>{window.showSaveFilePicker=undefined;window.showOpenFilePicker=undefined;window.__sv=0;window.confirm=()=>true});
     try{
       const s0=await snap(pg);
       const hs=HDR.toString();const dis0=tg.kind==='hdr'?await ev(pg,([src,i])=>{const e=eval('('+src+')')()[i];return !!(e&&(e.disabled||e.getAttribute('aria-disabled')==='true'))},[hs,tg.idx]):false;
       if(tg.kind==='hdr'){if(dis0){dis.push(tg.id);await done(pg);return}const c=await ev(pg,([src,i])=>{const e=eval('('+src+')')()[i];const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]},[hs,tg.idx]);await t.tap(c[0],c[1])}
       else if(tg.kind==='bar'){await tapEl(pg,t,`#mbar [data-m=${tg.id}]`,0,0)}
       else{await tapEl(pg,t,'#mbar [data-m=more]');await visW(pg,'#msheet',true);await tapEl(pg,t,`#msheet [data-pm=${tg.id}]`,0,0)}
       /* condition wait: something observable changes within 1.5 s */
       await sleep(pg,350);let s1=await snap(pg);if(s1===s0&&!fc&&!dl){await sleep(pg,900);s1=await snap(pg)}
       let changed=s0!==s1||fc>0||dl>0;
       if(tg.id==='v2d'&&!changed){const on=await ev(pg,()=>document.querySelector('#v2d').classList.contains('on'));if(on){changed=true;detail.v2d='already the active view'}}
       if(tg.kind==='bar'&&tg.id==='select'&&!changed){const pl=await plain(pg);if(pl.ok)changed=true}
       (changed?ok:bad).push(tg.kind+':'+tg.id);detail[tg.kind+':'+tg.id]=changed?'ok':'no visible change';
     }catch(e){bad.push(tg.kind+':'+tg.id+' threw '+String(e.message).slice(0,80))}
     await done(pg,'dead-end '+tg.kind+':'+tg.id)};
   const q=[...targets];await Promise.all(Array.from({length:3},async()=>{while(q.length)await probe(q.shift())}));
   add('no-dead-ends','every visible header button, bottom-bar slot and More tile does something observable or is disabled',bad.length===0&&ok.length>=15,{checked:ok.length,disabled:dis,dead:bad,targets:targets.length});
  return R});

  /* ================= H. save / open ================= */
  job(['save-picker','save-download','save-header','open-file'],async()=>{const R=[],add=mk(R),guard=mkg(add);const {pg,t}=await open(b);let dl=0;pg.on('download',()=>dl++);
   const toastTxt=()=>ev(pg,()=>{const x=document.querySelector('#toast');return x&&!x.hidden?x.textContent:''});
   // mutation: app.js ~2352 savePlan `if(window.showSaveFilePicker){` → `if(false){` → FAIL confirmed (save-picker)
   // mutation: app.js ~2357 savePlan `download(name,text,'application/json');` → removed → FAIL confirmed (save-download, save-header)
   await guard('save','save',async()=>{
     /* path 1: File System Access picker present (stubbed) */
     await ev(pg,()=>{window.__sv={picker:0,wrote:0};window.showSaveFilePicker=async()=>{window.__sv.picker++;return {name:'plan.json',kind:'file',createWritable:async()=>({write:async x=>{window.__sv.wrote+=String(x).length},close:async()=>{}})}}});
     await ev(pg,()=>{window.__osp.markDirty();window.__osp.toastOff()});const dirty0=await ev(pg,()=>window.__osp.isDirty());
     await tapEl(pg,t,'#mbar [data-m=more]');const has=await visW(pg,'#msheet [data-pm=m-save]',true);await tapEl(pg,t,'#msheet [data-pm=m-save]',0,0);await W(pg,()=>window.__sv.wrote>0&&!window.__osp.isDirty());
     const sv=await ev(pg,()=>window.__sv);const toast=await toastTxt();const clean=await ev(pg,()=>!window.__osp.isDirty());
     add('save-picker','More → Save file runs the save path (picker called, JSON written, plan marked saved)',dirty0&&has&&sv.picker===1&&sv.wrote>1000&&clean&&/Saved/i.test(toast),{dirty0,has,sv,clean,toast});
     /* path 2: no picker (iOS Safari) → download */
     await ev(pg,()=>{window.showSaveFilePicker=undefined;window.__osp.markDirty();window.__osp.toastOff()});const d0=dl;
     await tapEl(pg,t,'#mbar [data-m=more]');await visW(pg,'#msheet [data-pm=m-save]',true);await tapEl(pg,t,'#msheet [data-pm=m-save]',0,0);await W(pg,()=>!window.__osp.isDirty());await sleep(pg,400);
     const toast2=await toastTxt();
     add('save-download','More → Save file without a file picker (iPhone) downloads a .json',dl===d0+1&&/download/i.test(toast2),{downloads:dl-d0,toast2});
     /* header Save */
     await ev(pg,()=>{window.__osp.markDirty();window.__osp.toastOff()});const d1=dl;const hit=await tapEl(pg,t,'#b-save',0,0);await W(pg,()=>!window.__osp.isDirty());await sleep(pg,400);add('save-header','header Save also saves (one download)',hit&&dl===d1+1,{downloads:dl-d1})});
   // mutation: app.js ~2362 openPlan `$('#f-plan').click();` → removed → FAIL confirmed (open-file)
   await guard('open','open',async()=>{
     const txt=await ev(pg,()=>window.__osp.planJSON());const name0=await ev(pg,()=>window.__osp.S().name);
     await ev(pg,()=>{window.showOpenFilePicker=undefined});
     await tapEl(pg,t,'#mbar [data-m=more]');const has=await visW(pg,'#msheet [data-pm=m-open]',true);
     const [fch]=await Promise.all([pg.waitForEvent('filechooser',{timeout:4000}).catch(()=>null),tapEl(pg,t,'#msheet [data-pm=m-open]',0,0)]);
     let opened=false;
     if(fch){const p=JSON.parse(txt);p.name='Phone matrix open test';await fch.setFiles({name:'phone-open.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
       opened=await W(pg,n=>window.__osp.S().name==='Phone matrix open test'&&window.__osp.S().objs.length===n,p.objs.length,5000)}
     add('open-file','More → Open file shows the file chooser and the chosen plan opens',has&&name0!=='Phone matrix open test'&&!!fch&&opened,{has,chooser:!!fch,opened,n:await ev(pg,()=>window.__osp.S().objs.length)});
   });
   await done(pg,'grp');return R});

  /* ================= run ================= */
  const out=new Array(jobs.length);let next=0;const PAR=+process.env.SB_P2_PAR||2;
  await Promise.all(Array.from({length:PAR},async()=>{while(next<jobs.length){const i=next++;const t0=Date.now();let tm;try{out[i]=await Promise.race([jobs[i](),new Promise(r=>{tm=setTimeout(()=>r([row(ID+'group-'+i+'-timeout','phone 2D test group '+i+' finished within 75 s (it hung)',false,'hung')]),75000)})])}finally{clearTimeout(tm)}if(process.env.SB_P2_TIME)console.error('group',i,Date.now()-t0,'ms')}}));
  let R=out.flat();
  /* a check whose group threw before it could report is a failure, never a silent gap */
  for(const id of declared)if(!R.some(r=>r.id===ID+id)){const g=R.find(r=>/test threw/.test(r.name));R.push(row(ID+id,id+' (did not report: an earlier step in its group threw)',false,g?g.detail:'no row'))}
  if(RE)R=R.filter(r=>RE.test(r.id));
  /* mutation: app.js ~975 multiSync() → also `console.error('mut')` → FAIL confirmed */
  R.push(row(ID+'no-errors','no console or page errors over the whole phone 2D slice',ALLERRS.length===0,ALLERRS.slice(0,6)));
  return R}
