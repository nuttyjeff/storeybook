/* matrix slice: F (Analysis), G (Underlay and detection), H (Files and data) on desktop 2D/3D and phone 2D/3D.
   Real mouse / keyboard / CDP touch for every user action; the debug hook only reads state and sets up preconditions.
   The OS file dialogs are the only thing stubbed: saves are captured (showSaveFilePicker stub on desktop, blob download on
   the phone, which has no picker), and files are handed to the app's own file inputs through Playwright's file chooser.
   Phone rows reach every action from the phone shell's on-screen controls (More sheet, header menu, Details sheet).
   Findings stay as failing rows: nothing here is weakened to pass. */
import fs from 'fs';import path from 'path';
import {chromium,devices,devFile,row,touch,scr,ROOT} from '../../lib.mjs';
export const name='matrix-data';
const ID='mx-dt-';
const URL_=()=>process.env.SB_URL||devFile();
const SYN=path.join(ROOT,'test/detect/synth');
const ev=(pg,fn,arg)=>pg.evaluate(fn,arg);
const sleep=(pg,ms)=>pg.waitForTimeout(ms);
/* phones: the on-screen keyboard's Done key — the field loses focus (the drawer shrinks while a field has focus) */
const kbDone=async pg=>{if(pg.phone){await ev(pg,()=>document.activeElement&&document.activeElement.blur&&document.activeElement.blur());await sleep(pg,120)}};
const waitF=(pg,fn,arg,timeout=5000)=>pg.waitForFunction(fn,arg,{timeout,polling:50}).then(()=>true,()=>false);
/* async conditions (IndexedDB): poll from here */
async function waitA(pg,fn,arg,timeout=5000){const t0=Date.now();while(Date.now()-t0<timeout){try{if(await pg.evaluate(fn,arg))return true}catch(e){}await sleep(pg,100)}return false}

/* ---------- page with capture of saved files ---------- */
const INIT=({phone})=>{window.__cap=[];window.__clip=null;const B=new Map();const oc=URL.createObjectURL.bind(URL);
  URL.createObjectURL=b=>{const u=oc(b);B.set(u,b);return u};
  const ac=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.__cap.push({via:'download',name:this.download,blob:B.get(this.href)||null});return}return ac.call(this)};
  try{Object.defineProperty(navigator,'clipboard',{configurable:true,get:()=>({writeText:async t=>{window.__clip=String(t)},readText:async()=>window.__clip||'',read:async()=>[]})})}catch(e){}
  if(phone){window.showSaveFilePicker=undefined;window.showOpenFilePicker=undefined}
  else{window.showSaveFilePicker=async o=>{const name=(o&&o.suggestedName)||'file';window.__pickN=(window.__pickN||0)+1;return {name,kind:'file',createWritable:async()=>{const parts=[];return {write:async d=>{parts.push(d)},close:async()=>{window.__cap.push({via:'picker',name,blob:new Blob(parts)})}}}}};
    window.showOpenFilePicker=async()=>{const f=window.__openFile;if(!f){const e=new Error('aborted');e.name='AbortError';throw e}return [{name:f.name,kind:'file',getFile:async()=>new File([f.text],f.name,{type:'application/json'}),createWritable:async()=>{const parts=[];return {write:async d=>{parts.push(d)},close:async()=>{window.__cap.push({via:'handle',name:f.name,blob:new Blob(parts)})}}}}]}}};
async function openMx(b,{phone=false,sample=true}={}){
  const ctx=phone?await b.newContext({...devices['iPhone 13']}):await b.newContext({viewport:{width:1400,height:900}});
  await ctx.addInitScript(INIT,{phone});
  const pg=await ctx.newPage();pg.errs=[];pg.dq=[];pg.dlog=[];
  pg.on('pageerror',e=>pg.errs.push('PE:'+e.message));pg.on('console',m=>{if(m.type()==='error')pg.errs.push(m.text())});
  pg.on('dialog',async d=>{const a=pg.dq.length?pg.dq.shift():true;pg.dlog.push(d.type()+': '+d.message().slice(0,50));try{if(a===false)await d.dismiss();else await d.accept(typeof a==='string'?a:undefined)}catch(e){}});
  await pg.goto(URL_(),{waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,{timeout:20000});
  if(sample){await ev(pg,()=>document.querySelector('#m-sample').click());await sleep(pg,300);
    /* the dev sample loader skips ensureBld, so reopen it the way a user opens a file */
    await ev(pg,()=>{const o=window.__osp;o.openPlanText(o.planJSON(),'sample.json');o.toastOff()});await sleep(pg,200)}
  pg.ctx=ctx;pg.phone=phone;pg.t=phone?await touch(pg):null;return pg}
async function closeMx(pg){try{await Promise.race([pg.ctx.close(),new Promise(r=>{const h=setTimeout(r,6000);h.unref&&h.unref()})])}catch(e){}}

/* ---------- real input ---------- */
async function where(pg,sel,nth=0){return ev(pg,([s,n])=>{const e=document.querySelectorAll(s)[n];if(!e)return {err:'missing'};
  e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(e).visibility==='hidden')return {err:'not shown'};
  const x=r.left+r.width/2,y=r.top+r.height/2;if(x<0||y<0||x>innerWidth||y>innerHeight)return {err:'off screen'};
  const t=document.elementFromPoint(x,y);return {x,y,w:r.width,l:r.left,hit:!!t&&(t===e||e.contains(t)),top:t?(t.id?'#'+t.id:(t.className&&t.className.baseVal!=null?t.className.baseVal:t.className)||t.tagName):null}},[sel,nth])}
async function press(pg,sel,nth=0,wait=80){let c=await where(pg,sel,nth);
  if(!c.err&&!c.hit&&c.top==='#toast'){await waitF(pg,()=>document.querySelector('#toast').hidden,null,4000);c=await where(pg,sel,nth)}if(c.err||!c.hit)throw new Error(`${sel} is not reachable on screen (${c.err||'covered by '+c.top})`);
  if(pg.phone)await pg.t.tap(c.x,c.y);else await pg.mouse.click(c.x,c.y);await sleep(pg,wait);return c}
async function pressAt(pg,x,y){if(pg.phone)await pg.t.tap(x,y);else await pg.mouse.click(x,y);await sleep(pg,60)}
async function drag(pg,a,b,steps=12){if(pg.phone){/* the first move follows the touch at once, like a finger, so a slow machine never reads it as a long press */
    const T=pg.t.T,L=Math.hypot(b[0]-a[0],b[1]-a[1])||1,f=Math.min(1,14/L);await T('touchStart',[a]);await T('touchMove',[[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]]);
    for(let i=1;i<=steps;i++){await T('touchMove',[[a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps]]);await sleep(pg,16)}await T('touchEnd',[])}else{await pg.mouse.move(a[0],a[1]);await pg.mouse.down();for(let i=1;i<=steps;i++){await pg.mouse.move(a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps);await sleep(pg,16)}await pg.mouse.up()}await sleep(pg,120)}
const onPlan=(pg,x,y)=>ev(pg,([x,y])=>{const e=document.elementFromPoint(x,y);return !!e&&!!e.closest('#plan')},[x,y]);
const visible=(pg,s)=>ev(pg,s=>{const e=document.querySelector(s);if(!e)return false;const r=e.getBoundingClientRect();return !e.hidden&&getComputedStyle(e).display!=='none'&&r.width>0&&r.height>0},s);
/* the phone More sheet lists these; everything else is in the header menu (⋮), which phones show too */
const MORE=['m-snaps','m-fire','m-plans','m-open','m-save','b-set','m-guide'];
async function menu(pg,id){
  if(pg.phone&&MORE.includes(id)){await press(pg,'#mbar [data-m=more]');if(!await waitF(pg,()=>!document.querySelector('#msheet').hidden,null,5000))throw new Error('More sheet did not open');await press(pg,`#msheet [data-pm="${id}"]`);return}
  await press(pg,'#b-more');if(!await waitF(pg,()=>!document.querySelector('#pop-more').hidden,null,5000))throw new Error('menu did not open');await press(pg,'#'+id)}
async function tab(pg,k){const open=await ev(pg,()=>!document.querySelector('#d-insp').hidden);
  if(!open){await press(pg,pg.phone?'#mbar [data-m=insp]':'#t-insp');if(!await waitF(pg,()=>!document.querySelector('#d-insp').hidden,null,2000))throw new Error('Details did not open')}
  await press(pg,'#tab-'+k);if(!await waitF(pg,k=>!document.querySelector('#p-'+k).hidden,k,2000))throw new Error('tab '+k+' did not show')}
/* phones: the Details sheet covers the plan, so put it away before acting on the plan (pull handle tap) */
async function sheetAway(pg){if(!pg.phone)return;if(await ev(pg,()=>!document.querySelector('#d-insp').hidden)){await press(pg,'#d-insp .grab');await waitF(pg,()=>document.querySelector('#d-insp').hidden,null,2000)}}
/* a file handed to the app's own <input type=file> by the browser's file chooser, opened by a real tap/click */
async function choose(pg,sel,files,expectId){const [fc]=await Promise.all([pg.waitForEvent('filechooser',{timeout:5000}),press(pg,sel)]);const id=await fc.element().evaluate(e=>e.id);if(expectId&&id!==expectId)throw new Error('file chooser came from #'+id);await fc.setFiles(files);return id}
const nCap=pg=>ev(pg,()=>window.__cap.length);
async function capNext(pg,n0,mode='text',timeout=8000){if(!await waitF(pg,n=>window.__cap.length>n,n0,timeout))return null;
  return ev(pg,async([n,mode])=>{const c=window.__cap[n];if(!c.blob)return {name:c.name,via:c.via,size:-1};if(mode==='text'){const h=new Uint8Array(await c.blob.slice(0,3).arrayBuffer());return {name:c.name,via:c.via,size:c.blob.size,bom:h[0]===0xEF&&h[1]===0xBB&&h[2]===0xBF,text:await c.blob.text()}}
    const u=new Uint8Array(await c.blob.arrayBuffer());return {name:c.name,via:c.via,size:u.length,type:c.blob.type,head:[...u.slice(0,16)]}},[n0,mode])}
function parseCSV(t){t=t.replace(/^﻿/,'');const rows=[];let r=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===','){r.push(f);f=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;r.push(f);rows.push(r);r=[];f=''}else f+=c}if(f!==''||r.length){r.push(f);rows.push(r)}return rows}
/* frame two world points in the middle of the plan */
const frame=(pg,cx,cy,k)=>ev(pg,([cx,cy,k])=>{const o=window.__osp,p=document.querySelector('#plan').getBoundingClientRect();const top=document.querySelector('header')?document.querySelector('header').getBoundingClientRect().bottom:0;
  const midY=innerWidth<=820?(Math.max(p.top,top)+Math.min(p.bottom,innerHeight-90))/2-p.top:p.height/2;o.V.k=k;o.V.x=cx-(p.width/2)/k;o.V.y=cy-midY/k;/* the app applies V on resize */window.dispatchEvent(new Event('resize'))},[cx,cy,k]);
const idCenter=(pg,id)=>ev(pg,id=>{const e=document.querySelector(`#plan [data-id="${id}"]`);if(!e)return null;const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);const h=t&&t.closest('[data-id]');return {x,y,ok:!!h&&h.dataset.id===id}},id);

/* ======================= F: analysis ======================= */
async function gClash(b,phone,add){const S=phone?'phone 2D':'desktop 2D',P=phone?'p2-':'d2-';const pg=await openMx(b,{phone});
  try{
    const pick=await ev(pg,()=>{const o=window.__osp,S=o.S();const ok=x=>x.t==='item'&&!x.nests&&x.cat!=='Ceiling'&&x.cat!=='Door'&&x.cat!=='Window';
      const items=S.objs.filter(ok);const A=items.find(x=>!x.gid&&x.cat==='Storage')||items.find(x=>!x.gid);
      const B=items.filter(x=>x!==A&&(!A.gid||x.gid!==A.gid)&&Math.hypot(x.x-A.x,x.y-A.y)>1500).sort((p,q)=>Math.hypot(p.x-A.x,p.y-A.y)-Math.hypot(q.x-A.x,q.y-A.y))[0];
      return {A:A.id,B:B.id,ax:A.x,ay:A.y,bx:B.x,by:B.y,pref:o.P().clash,bad:o.clash().bad.size}});
    const dist=Math.hypot(pick.bx-pick.ax,pick.by-pick.ay);await frame(pg,(pick.ax+pick.bx)/2,(pick.ay+pick.by)/2,Math.min(0.09,160/dist));await sleep(pg,80);
    const a=await idCenter(pg,pick.A),bb=await idCenter(pg,pick.B);
    /* mutation: app.js:574 render class `' clash'` → `''` → FAIL confirmed */
    let flagged=null;
    await (async()=>{if(!(pick.pref&&pick.bad===0&&a.ok&&bb.ok)){add(P+'clash-flag',`${S}: dragging an item onto another flags both as a clash`,false,{why:'precondition',pick,a,bb});return}
      const v0=await ev(pg,()=>({x:window.__osp.V.x,y:window.__osp.V.y}));await drag(pg,[a.x,a.y],[bb.x+4,bb.y+3]);const v1=await ev(pg,()=>({x:window.__osp.V.x,y:window.__osp.V.y,sel:window.__osp.sel(),ctx:!!document.querySelector('#ctxmenu')&&!document.querySelector('#ctxmenu').hidden}));
      const ok=await waitF(pg,([A,B])=>{const q=id=>document.querySelector(`#plan [data-id="${id}"]`);return q(A)&&q(B)&&q(A).classList.contains('clash')&&q(B).classList.contains('clash')},[pick.A,pick.B],3000);
      const r=await ev(pg,([A,B,ax,ay])=>{const o=window.__osp,S=o.S(),q=id=>document.querySelector(`#plan [data-id="${id}"]`);const it=S.objs.find(x=>x.id===A);return {moved:[Math.round(it.x-ax),Math.round(it.y-ay)],aCls:q(A)&&q(A).classList.contains('clash'),bCls:q(B)&&q(B).classList.contains('clash'),others:[...document.querySelectorAll('#plan .it.clash')].map(e=>e.dataset.id).filter(x=>x!==A&&x!==B).length}},[pick.A,pick.B,pick.ax,pick.ay]);
      flagged=ok;add(P+'clash-flag',`${S}: dragging an item onto another flags both as a clash (and nothing else)`,ok&&r.others===0,{...r,panned:v1.x!==v0.x||v1.y!==v0.y,sel:v1.sel,ctx:v1.ctx,a,bb})})().catch(e=>add(P+'clash-flag',`${S}: dragging an item onto another flags both as a clash (test threw)`,false,String(e.message||e)));
    /* mutation: app.js:531 `if(clashDirty&&P.clash)` → `…&&!clashCache.bad.size` (never re-checked once a clash exists) → FAIL confirmed */
    await (async()=>{if(!flagged){add(P+'clash-clear',`${S}: moving the item back off clears the clash`,false,'precondition: no clash was flagged');return}
      /* grab whichever of the two is on top at the moved item's centre and drag it back the way it came */
      const a2=await idCenter(pg,pick.A);const top=await ev(pg,([x,y])=>{const e=document.elementFromPoint(x,y);const h=e&&e.closest('#plan [data-id]');return h&&h.dataset.id},[a2.x,a2.y]);
      const ov=await ev(pg,A=>{const it=window.__osp.S().objs.find(x=>x.id===A);return [it.x,it.y]},top);const dw=await ev(pg,([A,ax,ay])=>{const o=window.__osp,it=o.S().objs.find(x=>x.id===A);return [(it.x-ax)*o.V.k,(it.y-ay)*o.V.k]},[pick.A,pick.ax,pick.ay]);
      if(top!==pick.A&&top!==pick.B)throw new Error('neither clashing item is under the finger: '+top);
      await drag(pg,[a2.x,a2.y],[a2.x-dw[0],a2.y-dw[1]]);
      const ok=await waitF(pg,()=>!document.querySelector('#plan .it.clash'),null,3000);
      const r=await ev(pg,A=>{const o=window.__osp,S=o.S(),it=S.objs.find(x=>x.id===A);return {left:[...document.querySelectorAll('#plan .it.clash')].length,x:it.x,y:it.y}},top);r.dragged=top===pick.A?'A':'B';
      add(P+'clash-clear',`${S}: moving the item back off clears the clash`,ok&&Math.hypot(r.x-ov[0],r.y-ov[1])>1000,{...r,overlapAt:ov,start:[pick.ax,pick.ay]})})().catch(e=>add(P+'clash-clear',`${S}: moving the item back off clears the clash (test threw)`,false,String(e.message||e)));
  }finally{add(P+'clash-clean',`${S}: clash page had no console errors`,pg.errs.length===0,pg.errs.slice(0,4));await closeMx(pg)}}

async function gExits(b,phone,add){const S=phone?'phone 2D':'desktop 2D',P=phone?'p2-':'d2-';const pg=await openMx(b,{phone});
  const T=async(id,nm,fn)=>{try{await fn()}catch(e){add(P+id,nm+' (test threw)',false,String(e.message||e))}};
  try{
    /* mutation: app.js:837 markexit `o.exit=!o.exit` → `o.exit=o.exit` → FAIL confirmed */
    let door=null;
    await T('exit-mark',`${S}: Exits tab marks the selected door as a final exit`,async()=>{
      door=await ev(pg,()=>{const o=window.__osp,S=o.S();const d=S.objs.find(x=>x.t==='item'&&x.cat==='Door');o.setSel([d.id]);return {id:d.id,n:S.objs.filter(x=>x.exit).length}});
      await tab(pg,'fire');await press(pg,'#p-fire [data-fire=markexit]');
      const r=await ev(pg,id=>({exit:!!window.__osp.S().objs.find(x=>x.id===id).exit,n:window.__osp.S().objs.filter(x=>x.exit).length}),door.id);
      add(P+'exit-mark',`${S}: Exits tab marks the selected door as a final exit`,door.n===0&&r.exit&&r.n===1,{before:door.n,...r})});
    /* mutation: app.js:704 egressRun `EG.res=res;` → `EG.res=null;` → FAIL confirmed */
    await T('exit-run',`${S}: Show distances reports the longest travel distance and a distance for every room`,async()=>{
      const pre=await ev(pg,()=>!document.querySelector('#p-fire .firebox'));
      await press(pg,'#p-fire [data-fire=run]');await waitF(pg,()=>!!document.querySelector('#p-fire .firebox'),null,5000);
      const r=await ev(pg,()=>{const o=window.__osp,EG=o.EG(),S=o.S();const res=EG.res;if(!res||res.err)return {err:res&&res.err};const b=document.querySelector('#p-fire .firebox .fire-row b');const rows=[...document.querySelectorAll('#p-fire .fire-row')].slice(res.unreached?2:1);
        return {worst:+(res.worst/1000).toFixed(1),shown:b?parseFloat(b.textContent):null,rows:rows.length,rooms:S.objs.filter(x=>x.t==='room').length,resRooms:res.rooms.length,fmt:rows.every(x=>/(\d+\.\d m|no route)/.test(x.querySelector('b').textContent)),overlay:!!EG.img&&document.querySelector('#plan').innerHTML.includes(EG.img.slice(0,80))}});
      add(P+'exit-run',`${S}: Show distances reports the longest travel distance and a distance for every room`,pre&&!r.err&&r.worst>0&&r.shown===r.worst&&r.rows===r.rooms&&r.resRooms===r.rooms&&r.fmt&&r.overlay,{pre,...r})});
    /* mutation: app.js:836 toggle `EG.on=!EG.on` → `EG.on=EG.on` → FAIL confirmed */
    let off=false;
    await T('exit-hide',`${S}: Hide overlay takes the distances off the plan`,async()=>{
      const pre=await ev(pg,()=>document.querySelectorAll('#plan text.eg-ok,#plan text.eg-fail').length);await press(pg,'#p-fire [data-fire=toggle]');
      off=await waitF(pg,()=>document.querySelectorAll('#plan text.eg-ok,#plan text.eg-fail').length===0,null,2000);
      add(P+'exit-hide',`${S}: Hide overlay takes the distance colours and labels off the plan`,pre>0&&off,{pre,off})});
    /* the menu path: desktop ⋮ → Travel distance to exits; phone More → Exits check */
    /* mutation: app.js:2521 m-fire handler `egressRun()` → `0` → FAIL confirmed */
    await T('exit-menu',`${S}: ${phone?'More → Exits check':'menu → Travel distance to exits'} runs the check and shows the distances`,async()=>{
      if(!off)throw new Error('precondition: overlay still on');await sheetAway(pg);
      const pre=await ev(pg,()=>document.querySelectorAll('#plan text.eg-ok,#plan text.eg-fail').length);
      await menu(pg,'m-fire');await waitF(pg,()=>document.querySelectorAll('#plan text.eg-ok,#plan text.eg-fail').length>0,null,5000);
      const r=await ev(pg,()=>{const o=window.__osp,res=o.EG().res;if(!res||res.err)return {err:res&&res.err};const lab=[...document.querySelectorAll('#plan text.eg-ok,#plan text.eg-fail')].map(t=>t.textContent);const want=res.rooms.filter(x=>x.reach).map(x=>(x.mx/1000).toFixed(1)+' m');
        const panel=!document.querySelector('#d-insp').hidden&&!document.querySelector('#p-fire').hidden&&!!document.querySelector('#p-fire .firebox');return {labels:lab.length,rooms:res.rooms.length,reach:want.length,match:want.every(w=>lab.some(l=>l.startsWith(w))),panel}});
      add(P+'exit-menu',`${S}: ${phone?'More → Exits check':'menu → Travel distance to exits'} runs the check and shows a distance label for every room${phone?' on the plan':' on the plan and the report in the Exits tab'}`,pre===0&&!r.err&&r.labels===r.rooms&&r.reach>=1&&r.match&&(phone||r.panel),{pre,...r})});
  }finally{add(P+'exit-clean',`${S}: exits page had no console errors`,pg.errs.length===0,pg.errs.slice(0,4));await closeMx(pg)}}

async function gSchedule(b,phone,add){const S=phone?'phone 2D':'desktop 2D',P=phone?'p2-':'d2-';const pg=await openMx(b,{phone});
  const T=async(id,nm,fn)=>{try{await fn()}catch(e){add(P+id,nm+' (test threw)',false,String(e.message||e))}};
  const truth=()=>ev(pg,()=>{const S=window.__osp.S();const it=S.objs.filter(o=>o.t==='item');const by={};it.forEach(o=>{by[o.code]=(by[o.code]||0)+1});
    const area=o=>{let a=0;const p=o.pts;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1]}return Math.abs(a/2)/1e6};
    return {items:it.length,ws:it.filter(o=>o.cat==='Workstation').length,seats:it.reduce((a,o)=>a+(+o.seats||0),0),by,rooms:S.objs.filter(o=>o.t==='room').map(o=>[o.name,area(o).toFixed(2)])}});
  const checkRows=(rows,tr)=>{const i=rows.findIndex(r=>r[0]==='Items');const out={found:i>=0};if(i<0)return out;const by={};let j=i+2;for(;j<rows.length&&rows[j][2]!=='Total';j++){const r=rows[j];by[r[1]]=(by[r[1]]||0)+(+r[6])}
    out.total=rows[j]?+rows[j][6]:null;out.codesOk=Object.keys(tr.by).every(k=>by[k]===tr.by[k])&&Object.keys(by).every(k=>by[k]===tr.by[k]);
    const ri=rows.findIndex(r=>r[0]==='Rooms');const rr=[];if(ri>=0)for(let k=ri+2;k<rows.length&&rows[k][0]!=='Total';k++)rr.push([rows[k][0],rows[k][1]]);
    out.roomsOk=rr.length===tr.rooms.length&&tr.rooms.every(x=>rr.some(y=>y[0]===x[0]&&y[1]===x[1]));out.nRooms=rr.length;return out};
  try{
    /* mutation: app.js:1724 scheduleData `e.qty++` → `e.qty=1` → FAIL confirmed */
    await T('sch-counts',`${S}: Schedule tab totals match the plan's objects`,async()=>{
      await tab(pg,'sch');const tr=await truth();
      const r=await ev(pg,()=>{const b=[...document.querySelectorAll('#p-sch .tot b')].map(x=>+x.textContent);const q=[...document.querySelectorAll('#p-sch table.sch')].find(t=>/Qty/.test(t.textContent));
        const qty=q?[...q.querySelectorAll('tbody tr')].map(tr=>tr.querySelectorAll('td.n')[0]).filter(Boolean).reduce((a,td)=>a+(+td.textContent||0),0):null;return {ws:b[0],seats:b[1],qty}});
      add(P+'sch-counts',`${S}: Schedule tab totals (workstations, seats, item quantities) match the plan's objects`,tr.items>50&&r.ws===tr.ws&&r.seats===tr.seats&&r.qty===tr.items,{...r,want:{ws:tr.ws,seats:tr.seats,items:tr.items}})});
    /* mutation: app.js:1769 exportSchedule `toCSV(scheduleRows())` → `toCSV(scheduleRows().slice(0,8))` → FAIL confirmed */
    await T('sch-csv',`${S}: Export CSV saves a schedule whose item and room rows match the plan`,async()=>{
      const tr=await truth();const n0=await nCap(pg);await press(pg,'#p-sch #sch-csv');const c=await capNext(pg,n0);if(!c)throw new Error('no file was saved');
      const rows=parseCSV(c.text);const r=checkRows(rows,tr);
      add(P+'sch-csv',`${S}: Export CSV saves a schedule whose item and room rows match the plan`,/schedule\.csv$/.test(c.name)&&c.bom&&r.found&&r.total===tr.items&&r.codesOk&&r.roomsOk,{name:c.name,via:c.via,...r,want:tr.items})});
    /* mutation: app.js:1770 copy `r.join('\t')` → `r.join(',')` → FAIL confirmed */
    await T('sch-copy',`${S}: Copy for Excel puts tab-separated schedule rows on the clipboard`,async()=>{
      const tr=await truth();await ev(pg,()=>{window.__clip=null});await press(pg,'#p-sch #sch-copy');await waitF(pg,()=>window.__clip!=null,null,3000);
      const t=await ev(pg,()=>window.__clip);const rows=(t||'').split('\n').map(l=>l.split('\t'));const r=checkRows(rows,tr);
      add(P+'sch-copy',`${S}: Copy for Excel puts tab-separated schedule rows on the clipboard`,!!t&&r.found&&r.total===tr.items&&r.codesOk&&r.roomsOk,r)});
    /* mutation: app.js:2519 m-sch handler `exportSchedule()` → `0` → FAIL confirmed */
    await T('sch-menu',`${S}: menu → Schedule as CSV saves the same schedule`,async()=>{
      await sheetAway(pg);const tr=await truth();const n0=await nCap(pg);await menu(pg,'m-sch');const c=await capNext(pg,n0);if(!c)throw new Error('no file was saved');const r=checkRows(parseCSV(c.text),tr);
      add(P+'sch-menu',`${S}: menu → Schedule as CSV saves the same schedule`,r.found&&r.total===tr.items&&r.codesOk&&r.roomsOk,{name:c.name,...r})});
  }finally{add(P+'sch-clean',`${S}: schedule page had no console errors`,pg.errs.length===0,pg.errs.slice(0,4));await closeMx(pg)}}

async function gSnaps(b,phone,add){const S=phone?'phone 2D':'desktop 2D',P=phone?'p2-':'d2-';const pg=await openMx(b,{phone});
  const T=async(id,nm,fn)=>{try{await fn()}catch(e){add(P+id,nm+' (test threw)',false,String(e.message||e))}};
  const objsJ=()=>ev(pg,()=>JSON.stringify(window.__osp.S().objs));
  let before=null,taken=false,compared=false,tabs0=0,removedId=null;
  try{
    /* mutation: app.js:2383 snapTake `data};list.push(s);` → `data};` → FAIL confirmed */
    await T('snap-take',`${S}: Snapshots → Take snapshot now stores a named snapshot`,async()=>{
      const n0=await ev(pg,()=>window.__osp.snaps().length);before=await objsJ();tabs0=await ev(pg,()=>window.__osp.tabsRaw().length);
      await menu(pg,'m-snaps');await waitF(pg,()=>!document.querySelector('#snap-modal').hidden,null,2000);pg.dq.push('MX snap');await press(pg,'#snap-take');
      await waitF(pg,()=>window.__osp.snaps().length>0,null,3000);
      const r=await ev(pg,()=>({n:window.__osp.snaps().length,name:(window.__osp.snaps()[0]||{}).name,row:!!document.querySelector('#snap-body .snap-row')&&/MX snap/.test(document.querySelector('#snap-body .snap-row').textContent)}));
      taken=n0===0&&r.n===1&&r.name==='MX snap'&&r.row;add(P+'snap-take',`${S}: Snapshots → Take snapshot now stores a named snapshot and lists it`,taken,{n0,...r})});
    /* mutation: app.js:2405 snapCompare `if(!cur.has(k))removed.push` → `if(false)removed.push` → FAIL confirmed */
    await T('snap-compare',`${S}: after deleting an item, Compare reports exactly one removed and draws it`,async()=>{
      if(!taken)throw new Error('precondition: no snapshot');await press(pg,'#snap-close');await waitF(pg,()=>document.querySelector('#snap-modal').hidden,null,2000);
      removedId=await ev(pg,()=>{const o=window.__osp,S=o.S();const it=S.objs.find(x=>x.t==='item'&&x.cat==='Storage'&&!x.gid)||S.objs.find(x=>x.t==='item'&&!x.gid);o.setSel([it.id]);return it.id});
      if(phone)await press(pg,'#b-del');else{await ev(pg,()=>document.activeElement&&document.activeElement.blur&&document.activeElement.blur());await pg.keyboard.press('Delete')}
      const gone=await waitF(pg,id=>!window.__osp.S().objs.find(x=>x.id===id),removedId,2000);
      await menu(pg,'m-snaps');await waitF(pg,()=>!document.querySelector('#snap-modal').hidden,null,2000);await press(pg,'#snap-body [data-snap-cmp]');await waitF(pg,()=>!!document.querySelector('#snap-body .cmp-sum'),null,2000);
      const r=await ev(pg,()=>{const c=window.__osp.cmp();return {sum:(document.querySelector('#snap-body .cmp-sum')||{}).textContent,counts:c&&c.counts,red:[...document.querySelectorAll('#plan path')].filter(p=>p.getAttribute('stroke')==='#d1453b').length}});
      compared=gone&&r.counts&&r.counts.removed===1&&r.counts.added===0&&r.counts.modified===0;
      add(P+'snap-compare',`${S}: after deleting an item, Compare reports exactly 1 removed (0 added, 0 changed) and outlines it on the plan`,compared&&/0 added · 0 changed · 1 removed/.test(r.sum||'')&&r.red>=1,{gone,...r})});
    /* mutation: app.js:2387 snapRestore `openPlanText(text,fileHandle,(S.name||'plan')+'.json');` → `` → FAIL confirmed */
    let restored=false;
    await T('snap-restore',`${S}: Restore brings back the exact plan from the snapshot`,async()=>{
      if(!compared)throw new Error('precondition: compare did not run');pg.dq.push(true);await press(pg,'#snap-body [data-snap-rest]');
      await waitF(pg,id=>!!window.__osp.S().objs.find(x=>x.id===id),removedId,3000);const now=await objsJ();restored=now===before;
      const r=await ev(pg,()=>({snaps:window.__osp.snaps().length,cmp:!!window.__osp.cmp()}));
      add(P+'snap-restore',`${S}: Restore brings back the exact plan from the snapshot, keeps the snapshot and ends the compare`,restored&&r.snaps===1&&!r.cmp,{exact:restored,lenBefore:before.length,lenNow:now.length,...r,dialogs:pg.dlog.slice(-2)})});
    /* the confirm says "This replaces the current layout"; a second tab holding the changed plan with the same pid is not that */
    /* mutation: n/a (fails on the real build — finding: snapRestore → openPlanText opens a new tab, app.js:2387/2367) */
    await T('snap-restore-inplace',`${S}: Restore replaces the current plan in place (no extra tab)`,async()=>{
      if(!restored)throw new Error('precondition: restore did not run');const r=await ev(pg,()=>{const t=window.__osp.tabsRaw();const pids=t.map(x=>(x===window.__osp.curTab()?window.__osp.S():x.S).pid);return {tabs:t.length,dupPid:pids.length!==new Set(pids).size}});
      add(P+'snap-restore-inplace',`${S}: Restore replaces the current plan in place (no extra tab, no two tabs with the same plan id)`,r.tabs===tabs0&&!r.dupPid,{tabs0,...r})});
    /* mutation: app.js:2385 snapDelete `list.splice(i,1)` → `list.slice(i,1)` → FAIL confirmed */
    await T('snap-del',`${S}: the ✕ on a snapshot deletes it`,async()=>{
      if(await ev(pg,()=>document.querySelector('#snap-modal').hidden)){await menu(pg,'m-snaps');await waitF(pg,()=>!document.querySelector('#snap-modal').hidden,null,2000)}
      const n0=await ev(pg,()=>window.__osp.snaps().length);pg.dq.push(true);await press(pg,'#snap-body [data-snap-del]');await waitF(pg,()=>window.__osp.snaps().length===0,null,2000);
      const r=await ev(pg,()=>({n:window.__osp.snaps().length,rows:document.querySelectorAll('#snap-body .snap-row').length}));
      add(P+'snap-del',`${S}: the ✕ on a snapshot deletes it from the plan and the list`,n0===1&&r.n===0&&r.rows===0,{n0,...r})});
  }finally{add(P+'snap-clean',`${S}: snapshots page had no console errors`,pg.errs.length===0,pg.errs.slice(0,4));await closeMx(pg)}}

/* ======================= G: underlay and detection ======================= */
/* a two-page PDF built on the fly: page 1 one box, page 2 two boxes */
function twoPagePDF(){const objs=[];const page=(c)=>c;const s1='0 0 0 rg 100 100 400 300 re f',s2='0 0 0 rg 60 60 200 200 re f 320 320 200 200 re f';
  objs.push('<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 500] /Contents 5 0 R >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 500] /Contents 6 0 R >>',`<< /Length ${s1.length} >>\nstream\n${s1}\nendstream`,`<< /Length ${s2.length} >>\nstream\n${s2}\nendstream`);
  let out='%PDF-1.4\n';const off=[];objs.forEach((o,i)=>{off.push(out.length);out+=`${i+1} 0 obj\n${page(o)}\nendobj\n`});const x=out.length;
  out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+off.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;return Buffer.from(out,'latin1')}
const U=pg=>ev(pg,()=>{const u=window.__osp.S().underlay;return u?{x:u.x,y:u.y,w:u.w,h:u.h,mpp:u.mpp,op:u.op,vis:u.visible,cal:u.calibrated,name:u.name,page:u.page,src:!!u.src,srcHead:u.src?u.src.slice(0,40)+u.src.length:null}:null});
const imgPx=async(pg,px,py)=>{const u=await U(pg);return scr(pg,u.x+px*u.mpp,u.y+py*u.mpp)};
const detN=pg=>ev(pg,()=>{const S=window.__osp.S();const d=S.objs.filter(o=>o.det);return {n:d.length,walls:d.filter(o=>o.t==='wall').length,rooms:d.filter(o=>o.t==='room').length}});

async function gUnder(b,phone,add){const S=phone?'phone 2D':'desktop 2D',P=phone?'p2-':'d2-';const pg=await openMx(b,{phone});
  const T=async(id,nm,fn)=>{try{await fn()}catch(e){add(P+id,nm+' (test threw)',false,String(e.message||e))}};
  const st={loaded:false,cal:false};
  try{
    /* mutation: app.js:2511 m-new `closePops();newTab(blankPlan());` → `closePops();` → FAIL confirmed */
    await T('u-new',`${S}: menu → New blank plan starts an empty plan for the underlay`,async()=>{const n0=await ev(pg,()=>window.__osp.S().objs.length);await menu(pg,'m-new');await waitF(pg,()=>window.__osp.S().objs.length===0,null,2000);
      const n1=await ev(pg,()=>window.__osp.S().objs.length);add(P+'u-new',`${S}: menu → New blank plan starts an empty plan`,n0>0&&n1===0,{n0,n1})});
    /* mutation: app.js:1815 `$('#f-under')` change handler `if(f)loadUnderFile(f)` → `if(0)loadUnderFile(f)` → FAIL confirmed */
    await T('u-load',`${S}: Underlay tab → Load floor plan reads a PNG through the file picker`,async()=>{
      const pre=await U(pg);await tab(pg,'und');const id=await choose(pg,'#p-und [data-u=load]',path.join(SYN,'small-solid.png'),'f-under');
      await waitF(pg,()=>{const u=window.__osp.S().underlay;return u&&u.src&&u.w>0},null,5000);await sleep(pg,150);
      const u=await U(pg);const img=await ev(pg,()=>{const i=document.querySelector('#under-img');return {href:(i.getAttribute('href')||'').slice(0,22),disp:i.style.display,w:+i.getAttribute('width'),h:+i.getAttribute('height')}});
      st.loaded=!pre&&u&&u.w===1400&&u.h===1032&&img.href.startsWith('data:image/png')&&img.disp!=='none'&&Math.abs(img.w-u.w*u.mpp)<1;
      add(P+'u-load',`${S}: Underlay tab → Load floor plan reads a PNG through the file picker and draws it under the plan`,st.loaded,{input:id,u,img})});
    /* mutation: app.js:1799 apply `u.mpp*=f;` → `u.mpp*=1;` → FAIL confirmed */
    await T('u-cal',`${S}: calibrate from two clicked points and a typed length sets the scale`,async()=>{
      if(!st.loaded)throw new Error('precondition: no underlay');const u0=await U(pg);await press(pg,'#p-und [data-u=cal]');await sheetAway(pg);
      const p1=await imgPx(pg,200,516),p2=await imgPx(pg,1200,516);const on=[await onPlan(pg,...p1),await onPlan(pg,...p2)];if(!on[0]||!on[1])throw new Error('calibration points not on the plan '+JSON.stringify({p1,p2,on}));
      await pressAt(pg,...p1);await pressAt(pg,...p2);
      if(phone){await tab(pg,'und');await press(pg,'#cal-len');await pg.keyboard.type('8142.857');await kbDone(pg);await press(pg,'#p-und [data-u=apply]')}
      else{const f=await ev(pg,()=>document.activeElement&&document.activeElement.id);
        /* mutation: n/a (fails on the real build — finding) */
        add(P+'u-cal-focus',`${S}: after the second calibration click the length field has the cursor (type straight away)`,f==='cal-len',{focused:f||'(body)'});
        if(f!=='cal-len')await press(pg,'#cal-len');await pg.keyboard.type('8142.857');await pg.keyboard.press('Enter')}
      await waitF(pg,()=>window.__osp.S().underlay.calibrated,null,2000);const u=await U(pg);
      st.cal=!u0.cal&&u.cal&&Math.abs(u.mpp-8.142857)/8.142857<0.01;add(P+'u-cal',`${S}: calibrate from two clicked points 1000 px apart and a typed 8142.857 mm gives 8.14 mm per pixel`,st.cal,{before:+u0.mpp.toFixed(3),after:+u.mpp.toFixed(4)})});
    /* mutation (desktop): app.js:1128 `case 'under':S.underlay.x=drag.u0[0]+(w[0]-drag.w0[0])` → `…-(w[0]-drag.w0[0])` → FAIL confirmed.
       Phone: fails on the real build (finding: a touch on empty plan pans even while Move underlay is on, app.js:1049) */
    await T('u-move',`${S}: Move underlay drags the drawing and Done stops it`,async()=>{
      if(!st.loaded)throw new Error('precondition: no underlay');if(phone)await tab(pg,'und');await press(pg,'#p-und [data-u=move]');await sheetAway(pg);
      const u0=await U(pg);const k=await ev(pg,()=>window.__osp.V.k);const c=await imgPx(pg,700,516);const n0=await ev(pg,()=>window.__osp.S().objs.length);
      await drag(pg,c,[c[0]+80,c[1]+50]);const u1=await U(pg);
      if(phone)await press(pg,'#esc');else await press(pg,'#p-und [data-u=move]');
      const c2=await imgPx(pg,700,516);await drag(pg,c2,[c2[0]-60,c2[1]-40]);const u2=await U(pg);
      const dx=(u1.x-u0.x)*k,dy=(u1.y-u0.y)*k;const r={dx:+dx.toFixed(1),dy:+dy.toFixed(1),afterDone:[+(u2.x-u1.x).toFixed(1),+(u2.y-u1.y).toFixed(1)],objs:await ev(pg,()=>window.__osp.S().objs.length)-n0};
      add(P+'u-move',`${S}: Move underlay drags the drawing by the drag distance; after Done a drag no longer moves it`,Math.abs(dx-80)<4&&Math.abs(dy-50)<4&&u2.x===u1.x&&u2.y===u1.y&&r.objs===0,r)});
    /* mutation: app.js:1810 `S.underlay.op=num(e.target.value,0.6)` → `S.underlay.op=0.6` → FAIL confirmed */
    await T('u-opacity',`${S}: the Opacity slider changes the underlay opacity`,async()=>{
      if(!st.loaded)throw new Error('precondition: no underlay');await tab(pg,'und');const u0=await U(pg);const c=await where(pg,'#u-op');if(c.err||!c.hit)throw new Error('slider not reachable '+JSON.stringify(c));
      await pressAt(pg,c.l+c.w*0.2,c.y);await sleep(pg,100);const u=await U(pg);const attr=await ev(pg,()=>+document.querySelector('#under-img').getAttribute('opacity'));
      add(P+'u-opacity',`${S}: tapping the Opacity slider at 20% sets the underlay to about 0.28 opacity`,Math.abs((u0.op??0.6)-0.6)<1e-9&&Math.abs(u.op-0.28)<=0.08&&Math.abs(attr-u.op)<1e-9,{before:u0.op,after:u.op,attr})});
    /* mutation: app.js:1806 vis `u.visible=u.visible===false` → `u.visible=true` → FAIL confirmed */
    await T('u-hide',`${S}: Hide and Show toggle the underlay`,async()=>{
      if(!st.loaded)throw new Error('precondition: no underlay');await tab(pg,'und');const d0=await ev(pg,()=>document.querySelector('#under-img').style.display);
      await press(pg,'#p-und [data-u=vis]');const a=await ev(pg,()=>({vis:window.__osp.S().underlay.visible,disp:document.querySelector('#under-img').style.display,lab:document.querySelector('#p-und [data-u=vis]').textContent}));
      await press(pg,'#p-und [data-u=vis]');const c=await ev(pg,()=>({vis:window.__osp.S().underlay.visible,disp:document.querySelector('#under-img').style.display}));
      add(P+'u-hide',`${S}: Hide hides the underlay (button turns to Show) and Show brings it back`,d0!=='none'&&a.vis===false&&a.disp==='none'&&a.lab==='Show'&&c.vis===true&&c.disp!=='none',{d0,a,c})});
    /* whole sheet: Enter while the detect box is armed (desktop); phones have no Enter key, so it needs an on-screen control */
    /* mutation (desktop): app.js:2756 `if(detBox&&e.key==='Enter'){…runDetect(null)` → `runDetect({x0:0,y0:0,x1:1,y1:1})` → FAIL confirmed. Phone: fails on the real build (finding: no on-screen whole-sheet control) */
    let whole=0;
    await T('det-whole',`${S}: Detect → whole sheet traces walls and rooms`,async()=>{
      if(!st.cal)throw new Error('precondition: underlay not calibrated');await tab(pg,'und');const d0=await detN(pg);await press(pg,'#p-und [data-u=detect]');
      if(phone){await sheetAway(pg);const btn=await ev(pg,()=>{const v=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'&&!e.closest('[hidden]')};return [...document.querySelectorAll('button')].filter(v).map(e=>e.textContent.trim()).filter(t=>/whole|entire|full sheet|all of/i.test(t))});
        if(!btn.length){add(P+'det-whole',`${S}: Detect → whole sheet can be run without a keyboard`,false,{why:'after tapping Detect the phone says "press Enter for the whole sheet" but shows no on-screen control for it',d0});await press(pg,'#esc').catch(()=>{});return}
        /* tap the control found above (by its own box, so it must be on screen and on top) */
        const at=await ev(pg,()=>{const v=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'&&!e.closest('[hidden]')};const e=[...document.querySelectorAll('button')].filter(v).find(e=>/whole|entire|full sheet|all of/i.test(e.textContent.trim()));const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;return document.elementFromPoint(x,y)===e||e.contains(document.elementFromPoint(x,y))?[x,y]:null});
        if(!at)throw new Error('the whole-sheet control is covered');const t=await touch(pg);await t.tap(at[0],at[1]);}
      else await pg.keyboard.press('Enter');
      await waitF(pg,()=>window.__osp.S().objs.some(o=>o.det),null,10000);const d=await detN(pg);whole=d.walls;
      add(P+'det-whole',`${S}: Detect → Enter traces the whole sheet into walls and rooms`,d0.n===0&&d.walls>=8&&d.rooms>=2,{d0,d})});
    /* mutation: app.js:263 undo `restoreState(s)` → `restoreState(snapState())` → FAIL confirmed */
    await T('det-undo',`${S}: Undo removes a whole detection in one step`,async()=>{
      let d0=await detN(pg);if(!d0.n&&st.cal){/* setup (phones: the whole-sheet run above had no control) */await ev(pg,()=>window.__osp.runDetect(null));await waitF(pg,()=>window.__osp.S().objs.some(o=>o.det),null,10000);d0=await detN(pg)}
      if(!d0.n)throw new Error('precondition: nothing detected');
      if(phone)await press(pg,'#b-undo');else{await ev(pg,()=>document.activeElement&&document.activeElement.blur&&document.activeElement.blur());await pg.keyboard.press('Control+z')}
      await waitF(pg,()=>!window.__osp.S().objs.some(o=>o.det),null,2000);const d=await detN(pg);const u=await U(pg);
      add(P+'det-undo',`${S}: one Undo removes the whole detection and keeps the underlay`,d.n===0&&!!u&&u.src,{d0,d})});
    /* mutation: app.js:1236 detbox end `runDetect({x0,y0,x1,y1})` → `runDetect(null)` → FAIL confirmed */
    let boxN=0;
    await T('det-box',`${S}: Detect → a dragged box traces only inside the box`,async()=>{
      if(!st.cal)throw new Error('precondition: underlay not calibrated');await tab(pg,'und');const d0=await detN(pg);await press(pg,'#p-und [data-u=detect]');await sheetAway(pg);
      /* setup: frame the drawing (earlier drags may have panned it away) */await ev(pg,()=>{window.__osp.fit()});await sleep(pg,100);
      const u=await U(pg);const a=await imgPx(pg,10,10),c=await imgPx(pg,0.5*u.w,u.h-10);const box={x1:u.x+0.5*u.w*u.mpp};
      if(!await onPlan(pg,...a)||!await onPlan(pg,...c))throw new Error('box corners not on the plan');await drag(pg,a,c,14);
      await waitF(pg,()=>window.__osp.S().objs.some(o=>o.det),null,10000);const d=await detN(pg);boxN=d.n;
      const maxX=await ev(pg,()=>Math.max(...window.__osp.S().objs.filter(o=>o.det&&o.t==='wall').map(o=>Math.max(...o.pts.map(p=>p[0])))));
      add(P+'det-box',`${S}: Detect → a box over the left half traces walls and rooms only inside the box`,d0.n===0&&d.walls>=3&&d.rooms>=1&&maxX<=box.x1+400&&(phone||d.walls<whole),{d0,d,maxX:Math.round(maxX),boxRight:Math.round(box.x1),whole})});
    /* mutation: app.js:1805 undet `S.objs=S.objs.filter(o=>!o.det)` → `S.objs=S.objs.filter(o=>o)` → FAIL confirmed */
    await T('det-remove',`${S}: Remove traced deletes the traced objects and Undo brings them back`,async()=>{
      if(!boxN)throw new Error('precondition: nothing detected');await tab(pg,'und');await press(pg,'#p-und [data-u=undet]');const d1=await detN(pg);
      await sheetAway(pg);if(phone)await press(pg,'#b-undo');else{await ev(pg,()=>document.activeElement&&document.activeElement.blur&&document.activeElement.blur());await pg.keyboard.press('Control+z')}
      await waitF(pg,()=>window.__osp.S().objs.some(o=>o.det),null,2000);const d2=await detN(pg);
      add(P+'det-remove',`${S}: Remove traced deletes every traced object; Undo restores them`,d1.n===0&&d2.n===boxN,{before:boxN,removed:d1.n,undone:d2.n})});
    /* mutation: app.js:1808 del `S.underlay=null;` → `` → FAIL confirmed */
    await T('u-remove',`${S}: Remove takes the underlay away`,async()=>{
      if(!st.loaded)throw new Error('precondition: no underlay');await tab(pg,'und');const pre=await U(pg);await press(pg,'#p-und [data-u=del]');
      const r=await ev(pg,()=>{const i=document.querySelector('#under-img');return {u:window.__osp.S().underlay,href:i.getAttribute('href'),disp:i.style.display,load:!!document.querySelector('#p-und [data-u=load]')}});
      add(P+'u-remove',`${S}: Remove takes the underlay away and the tab offers Load again`,!!pre&&r.u==null&&!r.href&&r.disp==='none'&&r.load,{...r,u:!!r.u})});
    /* mutation: app.js:880 renderPdfPage `await page.render({canvasContext:cx,viewport:vp}).promise;` → `` → FAIL confirmed */
    let pdfOk=false;
    await T('pdf-load',`${S}: a PDF floor plan loads and its page is drawn`,async()=>{
      await tab(pg,'und');await choose(pg,'#p-und [data-u=load]',path.join(SYN,'small-pdf.pdf'),'f-under');await waitF(pg,()=>{const u=window.__osp.S().underlay;return u&&u.src&&/page 1/.test(u.name)},null,10000);
      const u=await U(pg);const ink=await ev(pg,async()=>{const u=window.__osp.S().underlay;const i=new Image();await new Promise((r,j)=>{i.onload=r;i.onerror=j;i.src=u.src});const c=document.createElement('canvas');c.width=1600;c.height=Math.round(1600*i.height/i.width);const x=c.getContext('2d');x.drawImage(i,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let k=0;k<d.length;k+=4)if(d[k]<200)n++;return n/(d.length/4)});
      pdfOk=!!u&&/small-pdf\.pdf · page 1/.test(u.name)&&u.w>500&&ink>0.002;add(P+'pdf-load',`${S}: a PDF floor plan loads and its page is drawn (dark lines on the image)`,pdfOk,{name:u&&u.name,w:u&&u.w,ink:+ink.toFixed(3)})});
    /* mutation: app.js:1796 page `renderPdfPage(num($('#u-page').value,1))` → `renderPdfPage(1)` → FAIL confirmed */
    await T('pdf-page',`${S}: a two-page PDF switches to page 2`,async()=>{
      await tab(pg,'und');await choose(pg,'#p-und [data-u=load]',{name:'two-page.pdf',mimeType:'application/pdf',buffer:twoPagePDF()},'f-under');
      await waitF(pg,()=>{const u=window.__osp.S().underlay;return u&&/two-page\.pdf · page 1/.test(u.name)},null,10000);await waitF(pg,()=>!!document.querySelector('#u-page'),null,2000);const u1=await U(pg);
      await press(pg,'#u-page');await pg.keyboard.press('Control+a');await pg.keyboard.type('2');await kbDone(pg);await press(pg,'#p-und [data-u=page]');
      await waitF(pg,()=>/page 2/.test(window.__osp.S().underlay.name),null,5000);const u2=await U(pg);
      add(P+'pdf-page',`${S}: a two-page PDF shows a page field; Show page 2 draws page 2`,/page 1/.test(u1.name)&&/two-page\.pdf · page 2/.test(u2.name)&&u2.src&&u2.srcHead!==u1.srcHead,{p1:u1.name,p2:u2.name})});
  }finally{add(P+'u-clean',`${S}: underlay page had no console errors`,pg.errs.length===0,pg.errs.slice(0,4));await closeMx(pg)}}

/* ======================= H: files and data ======================= */
async function gSaveOpen(b,phone,add){const S=phone?'phone 2D':'desktop 2D',P=phone?'p2-':'d2-';const pg=await openMx(b,{phone});
  const T=async(id,nm,fn)=>{try{await fn()}catch(e){add(P+id,nm+' (test threw)',false,String(e.message||e))}};
  const KEYS=['objs','bld','pins','north','snaps','underlay','name','notes','locked','fire','section','style','pid'];
  const pick=()=>ev(pg,K=>{const o=window.__osp;o.syncFloorOut();const S=o.S();const r={};K.forEach(k=>{r[k]=S[k]===undefined?null:JSON.parse(JSON.stringify(S[k]))});return r},KEYS);
  const diff=(a,b)=>KEYS.filter(k=>JSON.stringify(a[k]??null)!==JSON.stringify(b[k]??null));
  let saved=null,pre=null;
  try{
    /* set up a plan that has every part: underlay, north, a pin (dropped with the Pin tool) and a snapshot */
    await pg.setInputFiles('#f-under',path.join(SYN,'small-single.png'));await waitF(pg,()=>{const u=window.__osp.S().underlay;return u&&u.src},null,5000);
    await ev(pg,()=>{const o=window.__osp;o.setNorth(30);o.setTool('pin')});await sheetAway(pg);
    const pp=await ev(pg,()=>{const r=document.querySelector('#plan').getBoundingClientRect();return [r.left+r.width*0.5,r.top+r.height*0.45]});await pressAt(pg,...pp);await sleep(pg,200);
    await ev(pg,()=>{const o=window.__osp;document.activeElement&&document.activeElement.blur&&document.activeElement.blur();o.setTool('select');o.snapTake('rt snap',true)});await sheetAway(pg);
    /* mutation: app.js:2347 planJSON `delete out.extraObjs;` → `delete out.extraObjs;delete out.snaps;` → FAIL confirmed */
    await T('save',`${S}: ${phone?'More → Save file':'menu → Save plan file'} writes the whole plan`,async()=>{
      pre=await pick();if(!(pre.pins&&pre.pins.length===1&&pre.north===30&&pre.snaps&&pre.snaps.length===1&&pre.underlay&&pre.underlay.src))throw new Error('setup incomplete '+JSON.stringify({pins:pre.pins&&pre.pins.length,north:pre.north,snaps:pre.snaps&&pre.snaps.length,u:!!(pre.underlay&&pre.underlay.src)}));
      const n0=await nCap(pg);await menu(pg,'m-save');const c=await capNext(pg,n0);if(!c)throw new Error('nothing was saved');saved=c;const j=JSON.parse(c.text);const d=diff(j,pre);
      add(P+'save',`${S}: ${phone?'More → Save file':'menu → Save plan file'} writes a .json with every part of the plan (objects, building, pins, north, snapshots, underlay)`,/\.json$/.test(c.name)&&d.length===0&&j.objs.length>100,{name:c.name,via:c.via,diff:d})});
    /* mutation: app.js:2369 openPlanText `S=m.plan;` → `S=m.plan;S.pins=[];` → FAIL confirmed */
    await T('open',`${S}: ${phone?'More → Open file':'menu → Open plan file'} reads the saved file back identically`,async()=>{
      if(!saved)throw new Error('precondition: nothing saved');const t0=await ev(pg,()=>window.__osp.tabsRaw().length);
      let via='picker';
      if(phone){/* Safari path: no open picker, the app's #f-plan input */await ev(pg,()=>{if(!document.querySelector('#msheet').hidden)document.querySelector('#msheet [data-msheet-close]').click()});
        await press(pg,'#mbar [data-m=more]');await waitF(pg,()=>!document.querySelector('#msheet').hidden,null,2000);
        via=await choose(pg,'#msheet [data-pm="m-open"]',{name:'rt.json',mimeType:'application/json',buffer:Buffer.from(saved.text)},'f-plan')}
      else{await ev(pg,t=>{window.__openFile={name:'rt.json',text:t}},saved.text);await menu(pg,'m-open')}
      await waitF(pg,t0=>window.__osp.tabsRaw().length>t0,t0,4000);const now=await pick();const d=diff(now,JSON.parse(saved.text));const d2=diff(now,pre);
      add(P+'open',`${S}: ${phone?'More → Open file':'menu → Open plan file'} reopens the saved file in a tab identical to the plan that was saved`,d.length===0&&d2.length===0&&now.objs.length===pre.objs.length,{via,diffVsFile:d,diffVsPlan:d2})});
    /* mutation (desktop): app.js:2352 savePlan `if(!fileHandle||asNew)` → `if(!fileHandle)` → FAIL confirmed
       mutation (phone): app.js:2518 m-saveas `closePops();savePlan(true)` → `closePops();` → FAIL confirmed */
    await T('saveas',`${S}: menu → Save as new file writes a new file with the same content`,async()=>{
      if(!saved)throw new Error('precondition: nothing saved');const k0=await ev(pg,()=>window.__pickN||0);const n0=await nCap(pg);
      let first=null;if(!phone){/* the reopened tab has a file handle: Save writes to it without asking, Save as must ask again */await menu(pg,'m-save');first=await capNext(pg,n0);}
      const k1=await ev(pg,()=>window.__pickN||0);const n1=await nCap(pg);await menu(pg,'m-saveas');const c=await capNext(pg,n1);if(!c)throw new Error('nothing was saved');const k2=await ev(pg,()=>window.__pickN||0);
      const d=diff(JSON.parse(c.text),JSON.parse(saved.text));
      add(P+'saveas',`${S}: menu → Save as new file ${phone?'downloads':'asks for a new file and writes'} the same plan`,d.length===0&&(phone?c.via==='download':(first&&first.via==='handle'&&k1===k0&&k2===k1+1&&c.via==='picker')),{via:c.via,first:first&&first.via,pickers:[k0,k1,k2],diff:d})});
    /* exports from the menu */
    /* mutation: app.js:2487 exportPNG toBlob `'image/png')}catch` → `'image/jpeg')}catch` → FAIL confirmed */
    await T('png',`${S}: menu → Plan as PNG image saves a real PNG`,async()=>{
      const n0=await nCap(pg);await menu(pg,'m-png');const c=await capNext(pg,n0,'bin',10000);if(!c)throw new Error('nothing was saved');
      const dim=await ev(pg,async n=>{try{const bm=await createImageBitmap(window.__cap[n].blob);return [bm.width,bm.height]}catch(e){return null}},n0);
      add(P+'png',`${S}: menu → Plan as PNG image saves a PNG (signature 89 50 4E 47) that decodes`,/\.png$/.test(c.name)&&c.head.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'&&c.size>2000&&dim&&dim[0]>200&&dim[1]>100,{name:c.name,size:c.size,head:c.head.slice(0,8),dim})});
    /* mutation: app.js:2517 exportDXF `'\n0\nENDSEC\n0\nEOF\n'` → `'\n0\nEOF\n'` → FAIL confirmed */
    await T('dxf',`${S}: menu → Export DXF saves a well-formed DXF`,async()=>{
      const rooms=await ev(pg,()=>window.__osp.S().objs.filter(o=>o.t==='room').length);const n0=await nCap(pg);await menu(pg,'m-dxf');const c=await capNext(pg,n0);if(!c)throw new Error('nothing was saved');const t=c.text;
      const sec=(t.match(/(^|\n)0\nSECTION\n/g)||[]).length,end=(t.match(/\n0\nENDSEC\n/g)||[]).length,ent=t.includes('\n2\nENTITIES\n'),eof=/\n0\nEOF\n?$/.test(t),roomLines=(t.match(/\n0\nLINE\n8\nROOMS\n/g)||[]).length;
      add(P+'dxf',`${S}: menu → Export DXF saves SECTION/ENDSEC pairs, an ENTITIES section with the rooms, and EOF`,/\.dxf$/.test(c.name)&&t.startsWith('0\nSECTION')&&sec===3&&end===3&&ent&&eof&&roomLines>=rooms*3,{name:c.name,sec,end,ent,eof,roomLines,rooms})});
    /* mutation: app.js:2571 exportIFC header `return `ISO-10303-21;` → `return `ISO-10303-2;` → FAIL confirmed */
    await T('ifc',`${S}: menu → Export IFC saves a well-formed IFC`,async()=>{
      const rooms=await ev(pg,()=>{const b=window.__osp.S().bld;return b&&b.levels?b.levels.length:1});const n0=await nCap(pg);await menu(pg,'m-ifc');const c=await capNext(pg,n0);if(!c)throw new Error('nothing was saved');const t=c.text.trim();
      const r={name:c.name,head:t.startsWith('ISO-10303-21;'),header:/HEADER;[\s\S]*FILE_SCHEMA\(\('IFC[^']*'\)\);[\s\S]*ENDSEC;/.test(t),data:/\nDATA;\n/.test(t)||/DATA;/.test(t),tail:t.endsWith('END-ISO-10303-21;'),project:(t.match(/=\s*IFCPROJECT\(/g)||[]).length,storeys:(t.match(/=\s*IFCBUILDINGSTOREY\(/g)||[]).length,walls:(t.match(/=\s*IFCWALL\w*\(/g)||[]).length,slabs:(t.match(/=\s*IFCSLAB\(/g)||[]).length,levels:rooms};
      add(P+'ifc',`${S}: menu → Export IFC saves an ISO-10303-21 file with HEADER, DATA (one project, a storey per floor, walls, slabs) and END-ISO-10303-21`,/\.ifc$/.test(c.name)&&r.head&&r.header&&r.data&&r.tail&&r.project===1&&r.storeys>=rooms&&r.walls>=1&&r.slabs>=1,r)});
    /* 3D: STL from the 3D bar */
    /* mutation (desktop): app.js:3495 stl-go `exportSTL(` → `0&&exportSTL(` → FAIL confirmed. Phone: fails on the real build (finding: #v3-stl is display:none on phones, head.html:414) */
    const S3=phone?'phone 3D':'desktop 3D',P3=phone?'p3-':'d3-';
    await T3(P3,'stl',`${S3}: 3D bar → Save STL saves a valid binary STL`,add,async()=>{
      await sheetAway(pg);await press(pg,'#v3d');await waitF(pg,()=>window.__osp.T3()&&window.__osp.T3().renderer,null,20000);await sleep(pg,600);
      const n0=await nCap(pg);await press(pg,'#v3-stl');if(!await waitF(pg,()=>!document.querySelector('#pop-stl').hidden,null,5000))throw new Error('Save STL options did not open');await press(pg,'#stl-go');
      const c=await capNext(pg,n0,'bin',15000);if(!c)throw new Error('nothing was saved');
      const r=await ev(pg,async n=>{const u=await window.__cap[n].blob.arrayBuffer();const dv=new DataView(u);const N=dv.getUint32(80,true);let bad=0;for(let t=0;t<Math.min(N,2000);t++){const o=84+t*50;const nx=dv.getFloat32(o,true),ny=dv.getFloat32(o+4,true),nz=dv.getFloat32(o+8,true);const l=Math.hypot(nx,ny,nz);if(!(Math.abs(l-1)<1e-3||l===0))bad++;for(let k=12;k<48;k+=4)if(!isFinite(dv.getFloat32(o+k,true)))bad++}return {N,size:u.byteLength,bad}},n0);
      add(P3+'stl',`${S3}: 3D bar → Save STL saves a binary STL (84 + 50 × facets bytes, unit normals, finite vertices)`,/\.stl$/.test(c.name)&&r.N>500&&r.size===84+50*r.N&&r.bad===0,{name:c.name,...r})});
    /* mutation: app.js:2582 m-ifc handler `saveText(nm+'.ifc',exportIFC()` → `0&&saveText(nm+'.ifc',exportIFC()` → FAIL confirmed */
    await T3(P3,'ifc',`${S3}: menu → Export IFC works while in 3D`,add,async()=>{
      if(!await ev(pg,()=>!document.querySelector('#v3').hidden))throw new Error('precondition: not in 3D');const n0=await nCap(pg);await menu(pg,'m-ifc');const c=await capNext(pg,n0);if(!c)throw new Error('nothing was saved');
      const t=c.text.trim();add(P3+'ifc',`${S3}: menu → Export IFC works while in 3D`,t.startsWith('ISO-10303-21;')&&t.endsWith('END-ISO-10303-21;'),{name:c.name,size:c.size})});
  }finally{add(P+'files-clean',`${S}: save/open/export page had no console errors`,pg.errs.length===0,pg.errs.slice(0,4));await closeMx(pg)}}
async function T3(P3,id,nm,add,fn){try{await fn()}catch(e){add(P3+id,nm+' (test threw)',false,String(e.message||e))}}

async function gPlans(b,phone,add){const S=phone?'phone 2D':'desktop 2D',P=phone?'p2-':'d2-';const pg=await openMx(b,{phone});
  const T=async(id,nm,fn)=>{try{await fn()}catch(e){add(P+id,nm+' (test threw)',false,String(e.message||e))}};
  const open=async()=>{if(await ev(pg,()=>!document.querySelector('#plans-modal').hidden))return;await menu(pg,'m-plans');await waitF(pg,()=>!document.querySelector('#plans-modal').hidden&&!!document.querySelector('#plans-list .plan-row'),null,4000)};
  const reopen=async()=>{await ev(pg,()=>{document.querySelector('#plans-modal').hidden=true});await open()};
  const rowSel=(pid,act)=>`#plans-list .plan-row[data-pid="${pid}"] [data-pact=${act}]`;
  let orig=null,copy=null;
  try{
    await ev(pg,()=>{const o=window.__osp;o.S().name='MX plans';o.markDirty()});await waitA(pg,async()=>{const o=window.__osp;o.PLANS.flush();const l=await o.PLANS.list();return l.some(p=>p.pid===o.S().pid&&p.name==='MX plans')},null,5000);
    orig=await ev(pg,()=>window.__osp.S().pid);
    /* mutation: app.js:3902 plans row `${r.items} items` → `${r.rooms} items` → FAIL confirmed */
    await T('plans-list',`${S}: My plans lists the open plan with its counts`,async()=>{
      await open();const r=await ev(pg,pid=>{const S=window.__osp.S();const e=document.querySelector(`#plans-list .plan-row[data-pid="${pid}"]`);return {cur:!!e&&e.classList.contains('cur'),txt:e&&e.querySelector('.pm').textContent,name:e&&e.querySelector('.pn').textContent,rooms:S.objs.filter(o=>o.t==='room').length,items:S.objs.filter(o=>o.t==='item').length}},orig);
      add(P+'plans-list',`${S}: My plans lists the open plan, marked current, with its room and item counts`,r.cur&&/MX plans/.test(r.name)&&r.txt.includes(r.rooms+' rooms')&&r.txt.includes(r.items+' items'),r)});
    /* mutation: app.js:3922 dup `p.pid=uid();` → `` → FAIL confirmed */
    await T('plans-dup',`${S}: Duplicate opens a stored copy in a new tab`,async()=>{
      await open();const t0=await ev(pg,()=>window.__osp.tabsRaw().length);await press(pg,rowSel(orig,'dup'));await waitF(pg,t0=>window.__osp.tabsRaw().length===t0+1,t0,3000);
      copy=await ev(pg,()=>window.__osp.S().pid);const ok=await waitA(pg,async c=>{const o=window.__osp;o.PLANS.flush();const g=await o.PLANS.get(c);return !!(g&&g.pid)},copy,5000);
      const r=await ev(pg,async([o0,c])=>{const o=window.__osp;const a=await o.PLANS.get(o0),b=await o.PLANS.get(c);return {name:o.S().name,tabs:o.tabsRaw().length,stored:!!(b&&b.pid===c),origKept:!!a&&a.name==='MX plans',same:b&&JSON.parse(b.data).objs.length===JSON.parse(a.data).objs.length}},[orig,copy]);
      add(P+'plans-dup',`${S}: Duplicate opens "… copy" in a new tab, stored separately with the same objects`,copy!==orig&&ok&&r.name==='MX plans copy'&&r.tabs===t0+1&&r.stored&&r.origKept&&r.same,{t0,...r})});
    /* mutation: app.js:3920 rename `p.name=n.trim();` → `` → FAIL confirmed */
    await T('plans-rename',`${S}: Rename changes a stored plan's name`,async()=>{
      if(!copy||copy===orig)throw new Error('precondition: no copy');await open();pg.dq.push('MX renamed');await press(pg,rowSel(orig,'rename'));
      await waitA(pg,async p=>{const g=await window.__osp.PLANS.get(p);return g&&g.name==='MX renamed'},orig,4000);await waitF(pg,p=>{const e=document.querySelector(`#plans-list .plan-row[data-pid="${p}"] .pn`);return e&&/MX renamed/.test(e.textContent)},orig,3000);
      const r=await ev(pg,async p=>{const o=window.__osp;const g=await o.PLANS.get(p);const t=o.tabsRaw().find(x=>(x===o.curTab()?o.S():x.S).pid===p);const e=document.querySelector(`#plans-list .plan-row[data-pid="${p}"] .pn`);return {stored:g&&g.name,tab:t&&(t===o.curTab()?o.S():t.S).name,row:e&&e.textContent}},orig);
      add(P+'plans-rename',`${S}: Rename changes the stored name, the open tab's name and the list row`,r.stored==='MX renamed'&&r.tab==='MX renamed'&&/MX renamed/.test(r.row||''),r)});
    /* mutation: app.js:3907 openStoredPlan `if(live!==curTab)switchTab(live);` → `` → FAIL confirmed */
    await T('plans-open',`${S}: Open switches to that plan`,async()=>{
      await open();const cur0=await ev(pg,()=>window.__osp.S().pid);await press(pg,rowSel(orig,'open'));await waitF(pg,p=>window.__osp.S().pid===p,orig,3000);
      const r=await ev(pg,()=>({pid:window.__osp.S().pid,name:window.__osp.S().name,modal:!document.querySelector('#plans-modal').hidden}));
      add(P+'plans-open',`${S}: Open on another plan switches to it and closes My plans`,cur0===copy&&r.pid===orig&&r.name==='MX renamed'&&!r.modal,{cur0,...r})});
    /* mutation: app.js:3917 del `await PLANS.del(pid);` → `` → FAIL confirmed */
    await T('plans-del',`${S}: Delete removes a stored plan`,async()=>{
      if(!copy||copy===orig)throw new Error('precondition: no copy');await open();pg.dq.push(true);await press(pg,rowSel(copy,'del'));
      await waitF(pg,c=>!document.querySelector(`#plans-list .plan-row[data-pid="${c}"]`),copy,4000);const r=await ev(pg,async c=>({stored:!!((await window.__osp.PLANS.get(c))||{}).pid,row:!!document.querySelector(`#plans-list .plan-row[data-pid="${c}"]`)}),copy);
      add(P+'plans-del',`${S}: Delete (confirmed) removes the plan from this browser and the list`,!r.stored&&!r.row,r);
      /* the copy is still open in another tab; a deleted plan should not come back on its own */
      /* mutation: n/a (fails on the real build — finding) */
      await sleep(pg,2000);await ev(pg,()=>window.__osp.PLANS.flush());await reopen();const r2=await ev(pg,async c=>({stored:!!((await window.__osp.PLANS.get(c))||{}).pid,row:!!document.querySelector(`#plans-list .plan-row[data-pid="${c}"]`)}),copy);
      add(P+'plans-del-sticks',`${S}: a deleted plan stays deleted (it was open in another tab; 2 s later it is still gone from My plans)`,!r2.stored&&!r2.row,r2)});
    /* mutation: app.js:3914 pexport `saveText('storeybook-plans.json',t,` → `saveText('storeybook-plans.json','{"plans":[]}',` → FAIL confirmed */
    let exported=null;
    await T('plans-export',`${S}: Export all saves every stored plan in one file`,async()=>{
      await sleep(pg,1700);await ev(pg,()=>window.__osp.PLANS.flush());await sleep(pg,200);await reopen();const want=await ev(pg,async()=>(await window.__osp.PLANS.list()).map(p=>p.pid).sort());const n0=await nCap(pg);await press(pg,'#plans-modal [data-pexport]');const c=await capNext(pg,n0);if(!c)throw new Error('nothing was saved');exported=c.text;
      const j=JSON.parse(c.text);const got=(j.plans||[]).map(p=>p.pid).sort();add(P+'plans-export',`${S}: Export all saves storeybook-plans.json holding every stored plan`,c.name==='storeybook-plans.json'&&want.length>=1&&JSON.stringify(got)===JSON.stringify(want),{name:c.name,want:want.length,got:got.length})});
    /* mutation: app.js:3909 f-plans `PLANS.importAll(await f.text())` → `PLANS.importAll('{"app":"storeybook-plans","plans":[]}')` → FAIL confirmed */
    await T('plans-import',`${S}: Import adds plans from an exported file`,async()=>{
      if(!exported)throw new Error('precondition: nothing exported');const j=JSON.parse(exported);const p=Object.assign({},j.plans[0],{pid:'mx-import',updated:Date.now()+10});try{const d=JSON.parse(p.data);d.pid='mx-import';d.name='MX imported';p.data=JSON.stringify(d)}catch(e){}p.name='MX imported';j.plans=[p];
      await open();const pre=await ev(pg,async()=>{const g=await window.__osp.PLANS.get('mx-import');return !!(g&&g.pid)});await choose(pg,'#plans-modal [data-pimport]',{name:'plans.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(j))},'f-plans');
      await waitF(pg,()=>!!document.querySelector('#plans-list .plan-row[data-pid="mx-import"]'),null,4000);const r=await ev(pg,async()=>{const g=await window.__osp.PLANS.get('mx-import');return {stored:!!(g&&g.pid==='mx-import'),name:g&&g.name,row:!!document.querySelector('#plans-list .plan-row[data-pid="mx-import"]')}});
      add(P+'plans-import',`${S}: Import adds the plans from an exported file and lists them`,!pre&&r.stored&&r.row,{pre,...r})});
  }finally{add(P+'plans-clean',`${S}: My plans page had no console errors`,pg.errs.length===0,pg.errs.slice(0,4));await closeMx(pg)}}

async function gLib(b,phone,add){const S=phone?'phone 2D':'desktop 2D',P=phone?'p2-':'d2-';const pg=await openMx(b,{phone});
  const T=async(id,nm,fn)=>{try{await fn()}catch(e){add(P+id,nm+' (test threw)',false,String(e.message||e))}};
  const openLib=async()=>{if(await ev(pg,()=>document.querySelector('#d-lib').hidden)){await press(pg,phone?'#mbar [data-m=lib]':'#t-lib');await waitF(pg,()=>!document.querySelector('#d-lib').hidden,null,2000)}};
  const shown=()=>ev(pg,()=>{const L=window.__osp.LIB();return [...document.querySelectorAll('#lib-list .lib-row')].map(e=>L[+e.dataset.li]).filter(Boolean).map(l=>({code:l.code,name:l.name,cat:l.cat}))});
  const clearQ=async()=>{await press(pg,'#lib-q');await pg.keyboard.press('Control+a');await pg.keyboard.press('Backspace');await sleep(pg,80);await kbDone(pg)};
  let n0=0,csv=null;
  try{
    n0=await ev(pg,()=>window.__osp.LIB().length);
    /* mutation: app.js:907 renderLib `if(q&&!(l.name+…).includes(q))return;` → `if(0)return;` → FAIL confirmed */
    await T('lib-search',`${S}: typing in the library search filters the list`,async()=>{
      await openLib();const all=(await shown()).length;await press(pg,'#lib-q');await pg.keyboard.type('chair');await sleep(pg,120);await kbDone(pg);const s=await shown();
      const want=await ev(pg,()=>window.__osp.LIB().filter(l=>(l.name+' '+l.code+' '+l.cat).toLowerCase().includes('chair')).length);
      add(P+'lib-search',`${S}: typing "chair" in the library search shows exactly the matching items`,all===n0&&s.length===want&&want>0&&want<all&&s.every(l=>(l.name+' '+l.code+' '+l.cat).toLowerCase().includes('chair')),{all,shown:s.length,want})});
    /* mutation: app.js:907 renderLib `if(libCat!=='All'&&l.cat!==libCat)return;` → `if(0)return;` → FAIL confirmed */
    await T('lib-cat',`${S}: a category chip shows only that category; All shows everything`,async()=>{
      await openLib();await clearQ();const q0=await ev(pg,()=>document.querySelector('#lib-q').value);const pc=await press(pg,'#lib-cats [data-cat="Storage"]');const on=await ev(pg,()=>(document.querySelector('#lib-cats .chip.on')||{}).textContent);const s=await shown();const want=await ev(pg,()=>window.__osp.LIB().filter(l=>l.cat==='Storage').length);
      await press(pg,'#lib-cats [data-cat="All"]');const a=await shown();
      add(P+'lib-cat',`${S}: the Storage chip shows only the ${'Storage'} items; All shows the whole library again`,s.length===want&&want>0&&s.every(l=>l.cat==='Storage')&&a.length===n0,{storage:s.length,want,all:a.length,n0,q0,on,pc})});
    /* mutation (desktop): app.js:920 lib-exp `libToCSV(LIB)` → `libToCSV(LIB.slice(1))` → FAIL confirmed. Phone: fails on the real build (finding: #d-lib .df is display:none on phones, head.html:362) — same for import and reset */
    await T('lib-export',`${S}: Export CSV saves the whole library`,async()=>{
      await openLib();const c0=await nCap(pg);await press(pg,'#lib-exp');const c=await capNext(pg,c0);if(!c)throw new Error('nothing was saved');csv=c.text;const rows=parseCSV(c.text).filter(r=>r.length>1||r[0]);
      const codes=await ev(pg,()=>window.__osp.LIB().map(l=>l.code));const got=rows.slice(1).map(r=>r[0]);
      add(P+'lib-export',`${S}: Export CSV saves furniture-library.csv with a header and one row per library item`,c.name==='furniture-library.csv'&&/code/i.test(rows[0][0])&&got.length===codes.length&&codes.every((x,i)=>got[i]===x),{name:c.name,rows:got.length,lib:codes.length})});
    /* mutation (desktop): app.js:919 importLib `LIB=libFromCSV(text);` → `LIB=libFromCSV(DEFAULT_LIB_CSV);` → FAIL confirmed */
    await T('lib-import',`${S}: Import CSV loads a library with a new item`,async()=>{
      if(!csv){/* setup: the library CSV as the app writes it */const c0=await nCap(pg);await ev(pg,()=>document.querySelector('#lib-exp').click());const c=await capNext(pg,c0);csv=c&&c.text}if(!csv)throw new Error('precondition: no library CSV');const rows=parseCSV(csv).filter(r=>r.length>1);const first=rows.find((r,i)=>i>0&&r[3]==='rect')||rows[1];const nr=first.slice();nr[0]='MXTEST';nr[1]='MX Test Box';
      const q=v=>/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;const txt=csv.replace(/\s*$/,'')+'\n'+nr.map(q).join(',')+'\n';
      await openLib();await choose(pg,'#lib-imp',{name:'mx-lib.csv',mimeType:'text/csv',buffer:Buffer.from(txt)},'f-lib');await waitF(pg,()=>window.__osp.LIB().some(l=>l.code==='MXTEST'),null,3000);
      await press(pg,'#lib-q');await pg.keyboard.type('MX Test');await sleep(pg,120);await kbDone(pg);const s=await shown();
      const r=await ev(pg,()=>({n:window.__osp.LIB().length,has:window.__osp.LIB().some(l=>l.code==='MXTEST'&&l.name==='MX Test Box'),stored:/MXTEST/.test(localStorage.getItem('osp-lib')||'')}));await clearQ();
      add(P+'lib-import',`${S}: Import CSV loads the file: the new item is in the library, findable, and kept in this browser`,r.has&&r.n===n0+1&&r.stored&&s.length===1&&s[0].code==='MXTEST',{...r,n0,shown:s.length})});
    /* mutation (desktop): app.js:921 lib-reset `LIB=libFromCSV(DEFAULT_LIB_CSV);` → `` → FAIL confirmed */
    await T('lib-reset',`${S}: Reset puts back the built-in library`,async()=>{
      if(!await ev(pg,()=>window.__osp.LIB().some(l=>l.code==='MXTEST'))&&csv){/* setup */const rows=parseCSV(csv).filter(r=>r.length>1);const nr=rows[1].slice();nr[0]='MXTEST';nr[1]='MX Test Box';await pg.setInputFiles('#f-lib',{name:'mx.csv',mimeType:'text/csv',buffer:Buffer.from(csv.replace(/\s*$/,'')+'\n'+nr.map(v=>/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v).join(',')+'\n')});await waitF(pg,()=>window.__osp.LIB().some(l=>l.code==='MXTEST'),null,3000)}
      const pre=await ev(pg,()=>window.__osp.LIB().some(l=>l.code==='MXTEST'));await openLib();await press(pg,'#lib-reset');await sleep(pg,100);
      const r=await ev(pg,()=>({has:window.__osp.LIB().some(l=>l.code==='MXTEST'),n:window.__osp.LIB().length,stored:localStorage.getItem('osp-lib')}));
      add(P+'lib-reset',`${S}: Reset removes the imported item, restores the built-in list and forgets the stored library`,pre&&!r.has&&r.n===n0&&r.stored==null,{pre,...r,n0})});
  }finally{add(P+'lib-clean',`${S}: library page had no console errors`,pg.errs.length===0,pg.errs.slice(0,4));await closeMx(pg)}}

async function gReloadWipe(b,phone,add){const S=phone?'phone 2D':'desktop 2D',P=phone?'p2-':'d2-';const pg=await openMx(b,{phone});
  const T=async(id,nm,fn)=>{try{await fn()}catch(e){add(P+id,nm+' (test threw)',false,String(e.message||e))}};
  const boot=async()=>{await pg.waitForFunction(()=>window.__osp&&window.__osp.S&&window.__osp.curTab(),null,{timeout:20000});await sleep(pg,300)};
  try{
    /* mutation: app.js:3962 boot `if(pl)tabs.push({id,S:pl` → `if(0)tabs.push({id,S:pl` → FAIL confirmed */
    await T('reload',`${S}: reloading the page brings back the working plan`,async()=>{
      const id=await ev(pg,()=>{const o=window.__osp,S=o.S();const it=S.objs.find(x=>x.t==='item'&&!x.gid);o.setSel([it.id]);return it.id});
      if(phone)await press(pg,'#b-del');else{await ev(pg,()=>document.activeElement&&document.activeElement.blur&&document.activeElement.blur());await pg.keyboard.press('Delete')}
      await waitF(pg,id=>!window.__osp.S().objs.find(x=>x.id===id),id,2000);await waitF(pg,()=>/Autosaved/.test(document.querySelector('#status span').textContent),null,4000);
      const before=await ev(pg,()=>{const o=window.__osp;return {objs:JSON.stringify(o.S().objs),name:o.S().name,pid:o.S().pid,tabs:o.tabsRaw().length,cur:o.curTab().id}});
      await pg.reload({waitUntil:'load'});await boot();
      const after=await ev(pg,()=>{const o=window.__osp;return {objs:JSON.stringify(o.S().objs),name:o.S().name,pid:o.S().pid,tabs:o.tabsRaw().length,cur:o.curTab().id}});
      add(P+'reload',`${S}: after an edit, reloading the page brings back the same tabs and the edited plan exactly`,before.objs.length>1000&&after.objs===before.objs&&after.name===before.name&&after.pid===before.pid&&after.tabs===before.tabs&&after.cur===before.cur&&!after.objs.includes(id),{same:after.objs===before.objs,b:{...before,objs:before.objs.length},a:{...after,objs:after.objs.length}})});
    /* mutation A: app.js:301 wipeLocal `ks.forEach(k=>localStorage.removeItem(k))` → `0` → FAIL confirmed
       mutation B: app.js:302 wipeLocal `PLANS.clear().finally(` → `Promise.resolve().finally(` → FAIL confirmed */
    await T('wipe',`${S}: Clear data in this browser empties local storage and the plans store`,async()=>{
      await ev(pg,()=>{const o=window.__osp;o.markDirty()});await waitA(pg,async()=>{const o=window.__osp;o.PLANS.flush();return (await o.PLANS.list()).length>0},null,5000);
      const pre=await ev(pg,async()=>{const o=window.__osp;const ks=Object.keys(localStorage).filter(k=>k.startsWith('osp-'));return {ks,tabIds:o.tabsRaw().map(t=>t.id),pids:(await o.PLANS.list()).map(p=>p.pid)}});
      pg.dq.push(true);const nav=pg.waitForEvent('load',{timeout:10000});await menu(pg,'m-wipe');await nav;await boot();
      const r=await ev(pg,async pre=>{const o=window.__osp;const ks=Object.keys(localStorage).filter(k=>k.startsWith('osp-'));const left=pre.tabIds.filter(id=>localStorage.getItem('osp-tab-'+id)!=null);const idx=localStorage.getItem('osp-tabs')||'';
        const db=await new Promise(res=>{const q=indexedDB.open('storeybook',1);q.onsuccess=()=>{const d=q.result;if(!d.objectStoreNames.contains('plans')){res([]);return}const g=d.transaction('plans').objectStore('plans').getAllKeys();g.onsuccess=()=>res(g.result);g.onerror=()=>res(['ERR'])};q.onerror=()=>res(['ERR'])});
        return {keys:ks,oldTabKeys:left.length,idxOld:pre.tabIds.filter(id=>idx.includes(id)).length,oldPids:pre.pids.filter(p=>db.includes(p)).length,db:db.length,objs:o.S().objs.length,tabs:o.tabsRaw().length}},pre);
      add(P+'wipe',`${S}: Clear data (confirmed) reloads into a blank plan with no old tabs in local storage and no old plans in the browser store`,pre.tabIds.length>=1&&pre.pids.length>=1&&r.oldTabKeys===0&&r.idxOld===0&&r.oldPids===0&&r.objs===0&&r.tabs===1,{pre:{keys:pre.ks.length,tabs:pre.tabIds.length,pids:pre.pids.length},...r})});
  }finally{add(P+'reload-clean',`${S}: reload / clear-data page had no console errors`,pg.errs.length===0,pg.errs.slice(0,4));await closeMx(pg)}}

/* every *-clean row — mutation: app.js:2703 `function toast(m){` → `function toast(m){console.error('mutant');` → FAIL confirmed */
/* ======================= runner ======================= */
const GROUPS={clash:gClash,exits:gExits,sched:gSchedule,snaps:gSnaps,under:gUnder,files:gSaveOpen,plans:gPlans,lib:gLib,reload:gReloadWipe};
export async function run(b){
  const only=(process.env.MX_GROUPS||'').split(',').filter(Boolean);const devs=(process.env.MX_DEV||'desktop,phone').split(',');
  const jobs=[];
  for(const [k,fn] of Object.entries(GROUPS)){if(only.length&&!only.includes(k))continue;for(const d of devs){const R=[];const add=(id,nm,pass,detail)=>R.push(row(ID+id,nm,pass,detail));
    jobs.push({R,go:()=>fn(b,d==='phone',add).catch(e=>add((d==='phone'?'p2-':'d2-')+k+'-crash',`${d} ${k} group crashed`,false,String(e&&e.stack||e)))})}}
  /* a few pages at a time */
  const lim=+(process.env.MX_PAR||6);let i=0;const worker=async()=>{while(i<jobs.length){const j=jobs[i++];await j.go()}};
  await Promise.all(Array.from({length:Math.min(lim,jobs.length)},worker));
  const out=[];const seen=new Set();for(const j of jobs)for(const r of j.R){if(seen.has(r.id))r.id+='-dup';seen.add(r.id);out.push(r)}return out}
