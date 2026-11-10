/* matrix: iPad + Apple Pencil (tablet) and desktop 2D mouse/keyboard.
   Tablet ids mx-tb-<cfg>-<check>, cfg = ls (iPad Pro 11 landscape, 1194 wide, desktop shell), pt (iPad Pro 11 portrait, 834, desktop shell),
   ph (iPad gen 7 portrait, 810 wide, so the PHONE shell). Desktop ids mx-dk-<check>.
   Pen input uses real pen pointer events (CDP Input.dispatchMouseEvent pointerType:'pen'); fingers use CDP touch. */
import {devices, row, devFile} from '../../lib.mjs';
export const name='matrix-tablet-desktop';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const URL_=()=>process.env.SB_URL||devFile();
const ev=(pg,fn,arg)=>pg.evaluate(fn,arg);

/* ---------- page setup ---------- */
async function wire(pg){
  pg.errs=[];pg.sig={dialog:0,chooser:0,download:0};
  pg.on('pageerror',e=>pg.errs.push('PE:'+e.message));pg.on('console',m=>{if(m.type()==='error')pg.errs.push(m.text())});
  pg.on('dialog',d=>{pg.sig.dialog++;d.dismiss().catch(()=>{})});pg.on('filechooser',()=>{pg.sig.chooser++});pg.on('download',()=>{pg.sig.download++});
  await pg.addInitScript(()=>{window.__sfp=0;window.__ofp=0;window.showSaveFilePicker=async()=>{window.__sfp++;throw new DOMException('test','AbortError')};window.showOpenFilePicker=async()=>{window.__ofp++;throw new DOMException('test','AbortError')}});
  await pg.goto(URL_(),{waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,{timeout:20000});
  await pg.evaluate(()=>{const b=document.querySelector('#m-sample');if(b)b.click()});await pg.waitForTimeout(400);
  await ev(pg,()=>window.__osp.toastOff());
}
async function openTablet(b,devName,land){
  const d=devices[devName];const vp=land?{width:d.viewport.height,height:d.viewport.width}:d.viewport;
  const ctx=await b.newContext({...d,viewport:vp,defaultBrowserType:undefined,hasTouch:true});
  const pg=await ctx.newPage();pg.ctx=ctx;await wire(pg);
  pg.cdp=await ctx.newCDPSession(pg);const cdp=pg.cdp;
  const M=(type,x,y,extra={})=>cdp.send('Input.dispatchMouseEvent',Object.assign({type,x,y,pointerType:'pen'},extra));
  pg.pen={
    down:async(x,y)=>{await M('mouseMoved',x,y);await M('mousePressed',x,y,{button:'left',buttons:1,clickCount:1})},
    move:async(x,y)=>{await M('mouseMoved',x,y,{button:'left',buttons:1})},
    up:async(x,y)=>{await M('mouseReleased',x,y,{button:'left',buttons:0,clickCount:1})},
    tap:async(x,y)=>{await pg.pen.down(x,y);await pg.pen.up(x,y);await sleep(60)},
    /* first step ≥ 14 px: past the app's 10 px long-press slop at once, as a real stroke is */
    drag:async(a,b2,n=10,mid)=>{const L=Math.hypot(b2[0]-a[0],b2[1]-a[1])||1,f=Math.min(1,14/L);
      /* press and the first step are queued together, so a stalled main thread handles them back to back (before the 480 ms long-press timer) */
      await Promise.all([M('mouseMoved',a[0],a[1]),M('mousePressed',a[0],a[1],{button:'left',buttons:1,clickCount:1}),M('mouseMoved',a[0]+(b2[0]-a[0])*f,a[1]+(b2[1]-a[1])*f,{button:'left',buttons:1})]);for(let i=1;i<=n;i++){const k=f+(1-f)*i/n;await pg.pen.move(a[0]+(b2[0]-a[0])*k,a[1]+(b2[1]-a[1])*k);await sleep(16);if(mid&&i===Math.ceil(n/2))await mid()}await pg.pen.up(b2[0],b2[1]);await sleep(80)},
    hold:async(x,y,ms=700)=>{await pg.pen.down(x,y);await sleep(ms);await pg.pen.up(x,y);await sleep(80)}};
  const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(p=>({x:p[0],y:p[1],id:p[2]??0}))});
  pg.fin={T,
    tap:async(x,y)=>{await T('touchStart',[[x,y]]);await sleep(20);await T('touchEnd',[]);await sleep(40)},
    /* a real finger crosses the app's 10 px long-press slop at once; the first step is ≥ 14 px so the 480 ms long-press timer cannot fire mid-drag on a loaded machine */
    drag:async(a,b2,n=10,mid)=>{const L=Math.hypot(b2[0]-a[0],b2[1]-a[1])||1,f=Math.min(1,14/L);await Promise.all([T('touchStart',[a]),T('touchMove',[[a[0]+(b2[0]-a[0])*f,a[1]+(b2[1]-a[1])*f]])]);for(let i=1;i<=n;i++){const k=f+(1-f)*i/n;await T('touchMove',[[a[0]+(b2[0]-a[0])*k,a[1]+(b2[1]-a[1])*k]]);await sleep(16);if(mid&&i===Math.ceil(n/2))await mid()}await T('touchEnd',[]);await sleep(80)},
    hold:async(x,y,ms=700)=>{await T('touchStart',[[x,y]]);await sleep(ms);await T('touchEnd',[]);await sleep(80)},
    pinch:async(c,r0,r1,n=10)=>{const P=r=>[[c[0]-r,c[1],1],[c[0]+r,c[1],2]];const g=Math.sign(r1-r0)*Math.max(12,Math.abs(r1-r0)/n);await Promise.all([T('touchStart',P(r0)),T('touchMove',P(r0+g))]);for(let i=1;i<=n;i++){await T('touchMove',P(r0+g+(r1-r0-g)*i/n));await sleep(16)}await T('touchEnd',[]);await sleep(80)}};
  return pg}
async function openDesktop(b){
  const ctx=await b.newContext({viewport:{width:1400,height:900}});const pg=await ctx.newPage();pg.ctx=ctx;await wire(pg);pg.dk={tap:async(x,y)=>{await pg.mouse.click(x,y)}};pg.fin=pg.dk;return pg}

/* ---------- geometry / state helpers ---------- */
const findItems=async(pg,n=3,notIn=[])=>{for(let i=0;i<4;i++){const r=await findItems_(pg,n,notIn);if(r.length)return r;await sleep(300)}return []};
const findItems_=(pg,n=3,notIn=[])=>ev(pg,([n,notIn])=>{
  const o=window.__osp,S=o.S(),pl=document.querySelector('#plan').getBoundingClientRect(),out=[];
  for(const it of S.objs){if(it.t!=='item'||it.gid||it.arr||notIn.includes(it.id))continue;
    const el=document.querySelector(`#plan [data-id="${it.id}"]`);if(!el)continue;const r=el.getBoundingClientRect();if(r.width<14||r.height<14)continue;
    for(const fx of [.5,.3,.7,.2,.8])for(const fy of [.5,.3,.7]){const x=r.left+r.width*fx,y=r.top+r.height*fy;
      if(x<pl.left+8||x>pl.right-8||y<pl.top+8||y>pl.bottom-8)continue;
      const h=document.elementFromPoint(x,y);if(!h||!h.closest('#plan'))continue;const c=h.closest('[data-id]');
      if(c&&c.dataset.id===it.id&&[[6,0],[-6,0],[0,6],[0,-6]].every(([dx,dy])=>{const q=document.elementFromPoint(x+dx,y+dy);const qc=q&&q.closest('[data-id]');return qc&&qc.dataset.id===it.id})){if(out.every(p=>Math.hypot(p.x-x,p.y-y)>50)){out.push({id:it.id,x,y,ox:it.x,oy:it.y,or:it.r||0})}break}}
    if(out.length>=n)break}
  return out},[n,notIn]);
/* empty canvas points (nothing with data-id within 24 px), widest clearance first */
const emptyPts=(pg,n=3)=>ev(pg,n=>{
  const pl=document.querySelector('#plan').getBoundingClientRect(),res=[];
  const bad=(x,y)=>{const h=document.elementFromPoint(x,y);return !h||!h.closest('#plan')||!!h.closest('[data-id],[data-pin],[data-vh],[data-bh],[data-aim],[data-sech]')};
  for(let y=pl.top+30;y<pl.bottom-30;y+=36)for(let x=pl.left+30;x<pl.right-30;x+=36){
    if([[0,0],[24,0],[-24,0],[0,24],[0,-24]].some(([dx,dy])=>bad(x+dx,y+dy)))continue;res.push([x,y])}
  return res.slice(0,400)},n).then(a=>{const out=[];for(const p of a){if(out.every(q=>Math.hypot(p[0]-q[0],p[1]-q[1])>80))out.push(p);if(out.length>=n)break}return out});
const st=pg=>ev(pg,()=>{const o=window.__osp,S=o.S();return {sel:o.sel(),n:S.objs.length,tool:(document.querySelector('.dock .btn.on[data-tool]')||{dataset:{}}).dataset.tool||null,poly:(o.polyPts()||[]).length,V:{x:o.V.x,y:o.V.y,k:o.V.k},dm:o.dragM(),pen:document.documentElement.classList.contains('pen'),pn:o.pointersN(),past:o.past(),fut:o.future()}});
const obj=(pg,id)=>ev(pg,id=>{const x=window.__osp.S().objs.find(o=>o.id===id);return x?{x:x.x,y:x.y,r:x.r||0}:null},id);
const reset=async pg=>{await ev(pg,()=>{const o=window.__osp;if(!document.querySelector('#v3').hidden)document.querySelector('#v2d').click();o.setTool('select');o.setSel([]);const mb=document.querySelector('#multibar');if(mb&&!mb.hidden)document.querySelector('#multi-done').click();
  const ms=document.querySelector('#msheet');if(ms&&!ms.hidden)document.querySelector('[data-msheet-close]').click();document.querySelectorAll('.pop').forEach(p=>p.hidden=true);document.querySelectorAll('.keys-modal').forEach(p=>p.hidden=true);o.fit();o.toastOff()});await sleep(120)};
const worldOf=(pg,x,y)=>ev(pg,([x,y])=>{const V=window.__osp.V,r=document.querySelector('#plan').getBoundingClientRect();return [V.x+(x-r.left)/V.k,V.y+(y-r.top)/V.k]},[x,y]);
const visible=(pg,sel)=>ev(pg,sel=>{const e=document.querySelector(sel);if(!e)return false;const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return !e.hidden&&r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'},sel);
/* the widest stretch of plan (not covered by drawers or panels) across the middle: [cx, cy, half-width for two fingers] */
const freeSpan=pg=>ev(pg,()=>{const r=document.querySelector('#plan').getBoundingClientRect();const ok=(x,y)=>{const h=document.elementFromPoint(x,y);return h&&h.closest('#plan')};let best=null;const y=r.top+r.height/2;let a=null,b2=null;for(let x=r.left;x<r.right;x+=4){if(ok(x,y)){if(a===null)a=x;b2=x}else if(a!==null&&b2-a>100)break;else if(!ok(x,y)){a=null;b2=null}}if(a!==null&&b2-a>100)best=[(a+b2)/2,y,Math.min(130,(b2-a)/2-18)];return best||[r.left+r.width/2,y,60]});
/* tap the centre of an element with a finger; reports whether it was reachable (topmost at its centre) */
async function tapEl(pg,sel,how='fin'){
  const p=await ev(pg,sel=>{const e=document.querySelector(sel);if(!e)return {err:'missing'};e.scrollIntoView({inline:'center',block:'nearest'});const r=e.getBoundingClientRect();
    if(!(r.width>0&&r.height>0))return {err:'zero size'};const x=r.left+r.width/2,y=r.top+r.height/2;
    if(x<0||y<0||x>innerWidth||y>innerHeight)return {err:'offscreen'};const h=document.elementFromPoint(x,y);if(!h||!(e===h||e.contains(h)))return {err:'covered by '+(h&&(h.id||h.className))};return {x,y}},sel);
  if(p.err)return {ok:false,why:p.err};await pg[how].tap(p.x,p.y);await sleep(60);return {ok:true}}
const toolSel=t=>t==='shape'?'#t-shape':`.dock [data-tool="${t}"]`;
/* choose a drawing tool with a finger, through whichever shell is showing */
async function chooseTool(pg,t){let r;
  if(await visible(pg,'.dock'))r=await tapEl(pg,toolSel(t));
  else{const a=await tapEl(pg,'#mbar [data-m="draw"]');if(!a.ok)return a;await W(pg,t=>!!document.querySelector(`#msheet [data-pt="${t}"]`),t,1500);r=await tapEl(pg,`#msheet [data-pt="${t}"]`)}
  /* wait for the tool to be live before the caller draws */
  if(r.ok&&t!=='shape'){const on=await W(pg,t=>{const b=document.querySelector(`.dock [data-tool="${t}"]`);return !!b&&b.classList.contains('on')},t,2000);if(!on)return {ok:false,why:'tool '+t+' did not start'}}return r}
/* the on-screen way out: Done/Cancel chip if there is one, else the Select control */
async function exitTap(pg){
  if(await visible(pg,'#esc'))return tapEl(pg,'#esc');
  if(await visible(pg,'.dock'))return tapEl(pg,'.dock [data-tool="select"]');
  return tapEl(pg,'#mbar [data-m="select"]')}
const live=pg=>ev(pg,()=>{const o=window.__osp;const vis=s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&e.getBoundingClientRect().width>0};
  const live=[];const tl=(document.querySelector('.dock .btn.on[data-tool]')||{dataset:{}}).dataset.tool;if(tl&&tl!=='select')live.push('tool:'+tl);
  if(o.polyPts())live.push('poly');if(vis('#multibar'))live.push('multibar');if(vis('#ctxmenu'))live.push('ctxmenu');if(vis('#msheet'))live.push('msheet');if(vis('#polybar'))live.push('polybar');if(vis('#pstrip'))live.push('pstrip');if(vis('#paintstrip'))live.push('paintstrip');if(document.querySelector('.lib-row.on'))live.push('placing');if(vis('#mbar')&&(vis('#d-lib')||vis('#d-insp')))live.push('drawer');
  document.querySelectorAll('.pop:not([hidden])').forEach(p=>{if(p.id!=='ctxmenu')live.push(p.id)});document.querySelectorAll('.keys-modal:not([hidden])').forEach(p=>live.push(p.id));return live});
/* snapshot of everything a button might change */
const snap=pg=>ev(pg,()=>{const o=window.__osp,S=o.S(),t=document.querySelector('#toast'),g=s=>document.querySelector(s);
  return JSON.stringify({tool:[...document.querySelectorAll('.dock .on')].map(e=>e.id||e.dataset.tool),sel:o.sel(),n:S.objs.length,lock:S.locked,past:o.past(),fut:o.future(),
   pops:[...document.querySelectorAll('.pop:not([hidden])')].map(e=>e.id),modals:[...document.querySelectorAll('.keys-modal:not([hidden]),[role=dialog]:not([hidden])')].map(e=>e.id),
   lib:!g('#d-lib').hidden,insp:!g('#d-insp').hidden,v3:!g('#v3').hidden,ms:!g('#msheet').hidden,msb:g('#msheet-b').innerHTML.length,toast:t.hidden?'':t.textContent,k:Math.round(o.V.k*1000),
   poly:(o.polyPts()||[]).length,pb:!g('#polybar').hidden,mb:!g('#multibar').hidden,esc:!g('#esc').hidden,tabs:o.tabs().map(x=>x.id+x.on),floor:g('#b-floor').textContent,sfp:window.__sfp,ofp:window.__ofp,walk:!!o.WALK.on,bld:o.bldView(),name:S.name,
   mbar:[...document.querySelectorAll('#mbar .on')].length,rcp:g('#t-rcp').className,lay:!g('#pop-layers').hidden,hint:g('#hint').hidden?'':g('#hint').textContent.slice(0,40),insptab:(document.querySelector('.dtab.on,[data-tab].on')||{}).textContent||''})});
const sigs=pg=>JSON.stringify(pg.sig);
/* condition wait (≤ ms), resolves true/false */
const W=(pg,fn,arg,ms=3000)=>pg.waitForFunction(fn,arg===undefined?null:arg,{timeout:ms,polling:40}).then(()=>true,()=>false);
const selIs=(pg,ids,ms)=>W(pg,ids=>JSON.stringify(window.__osp.sel().sort())===JSON.stringify([...ids].sort()),ids,ms);
/* every object as JSON keyed by id, and what changed between two of those */
const objMap=pg=>ev(pg,()=>Object.fromEntries(window.__osp.S().objs.map(o=>[o.id,JSON.stringify(o)])));
function delta(a,b){const add=[],rem=[],chg=[];for(const k in b){if(!(k in a))add.push(k);else if(a[k]!==b[k])chg.push(k)}for(const k in a)if(!(k in b))rem.push(k);return {add,rem,chg}}
const isNone=d=>!d.add.length&&!d.rem.length&&!d.chg.length;
const dsum=d=>({add:d.add.length,rem:d.rem.length,chg:d.chg.length});
const sameSet=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());

/* ---------- result accumulation ---------- */
const mk=()=>{const R=[],ids=new Set();return {R,add:(id,nm,pass,detail)=>{if(ids.has(id))throw new Error('dup '+id);ids.add(id);R.push(row(id,nm,pass,detail))}}};
const FILTER=process.env.SB_ONLY_IDS||process.env.SB_CHECK;
const safe=async(A,id,nm,fn)=>{if(FILTER&&!new RegExp(FILTER).test(id))return;const t0=Date.now();try{const r=await fn();A.add(id,nm,r.pass,r.detail);if(process.env.SB_TRACE)console.error('  '+id+' '+(Date.now()-t0)+'ms')}catch(e){A.add(id,nm,false,'threw: '+String(e.message).split('\n')[0])}};

/* ---------- context-menu sweep (shared by tablet long-press and desktop right-click) ---------- */
/* each entry's exact effect; an entry not listed here must at least change the plan or the screen */
const CTX_EXPECT={
  rotcw:async(pg,b4)=>{await W(pg,([i,r])=>(window.__osp.S().objs.find(o=>o.id===i).r||0)!==r,[b4.id,b4.r],3000);const a=await obj(pg,b4.id);return ((a.r-b4.r+360)%360)===90},
  rotccw:async(pg,b4)=>{await W(pg,([i,r])=>(window.__osp.S().objs.find(o=>o.id===i).r||0)!==r,[b4.id,b4.r],3000);const a=await obj(pg,b4.id);return ((a.r-b4.r+360)%360)===270},
  dup:async(pg,b4)=>W(pg,n=>window.__osp.S().objs.length===n,b4.n+1,3000),copy:async(pg)=>W(pg,()=>{const t=document.querySelector('#toast');return !t.hidden&&/Copied/.test(t.textContent)},undefined,1500),
  multi:async(pg)=>W(pg,()=>{const b=document.querySelector('#multibar');return !!b&&!b.hidden},undefined,1500),props:async(pg)=>W(pg,()=>!document.querySelector('#d-insp').hidden,undefined,1500),del:async(pg,b4)=>W(pg,([n,i])=>window.__osp.S().objs.length===n-1&&!window.__osp.S().objs.some(o=>o.id===i),[b4.n,b4.id],3000),
  selall:async(pg)=>W(pg,()=>window.__osp.sel().length>3,undefined,1500),paste:async(pg,b4)=>W(pg,n=>window.__osp.S().objs.length>n,b4.n,1500),snap:async(pg,b4)=>W(pg,s=>window.__osp.P().snap!==s,b4.snapP,1500),
  rename:async(pg)=>W(pg,()=>!!document.querySelector('.rename-in'),undefined,1500)};
async function ctxSweep(pg,openMenu,tapBtn,labelOf){
  const out=[];await reset(pg);const its=await findItems(pg,1);if(!its.length)return {pass:false,detail:'no item to test'};const it=its[0];
  await openMenu(it.x,it.y);const cms=await ev(pg,()=>[...document.querySelectorAll('#ctxmenu [data-cm]')].map(b=>b.dataset.cm));
  if(!cms.length)return {pass:false,detail:'context menu did not open on an item'};
  for(const cm of cms){
    await reset(pg);const f=await findItems(pg,1);const x=f[0];await openMenu(x.x,x.y);
    const sel0=await st(pg);const b4={id:x.id,r:(await obj(pg,x.id)).r,n:sel0.n,snapP:await ev(pg,()=>window.__osp.P().snap),snap:await snap(pg)};
    if(!(await ev(pg,cm=>!!document.querySelector(`#ctxmenu [data-cm="${cm}"]`),cm))){out.push(cm+': missing on reopen');continue}
    const e0=pg.errs.length;const r=await tapBtn(pg,`#ctxmenu [data-cm="${cm}"]`);if(!r.ok){out.push(cm+': not tappable ('+r.why+')');continue}await sleep(150);
    const ok=CTX_EXPECT[cm]?await CTX_EXPECT[cm](pg,b4):(await snap(pg))!==b4.snap;if(!ok)out.push(cm+': had no effect');if(cm==='snap')await ev(pg,s=>{window.__osp.P().snap=s},b4.snapP);if(cm==='rename')await ev(pg,()=>{const r=document.querySelector('.rename-in');if(r)r.remove()});if(pg.errs.length>e0)out.push(cm+': console error '+pg.errs[pg.errs.length-1]);
    if(cm==='del'||cm==='dup')await ev(pg,()=>window.__osp.undo())}
  await reset(pg);
  return {pass:out.length===0,detail:out.length?out.join('; '):cms.join(',')}}
/* empty-canvas menu */
async function ctxEmpty(pg,openMenu,tapBtn){
  await reset(pg);await sleep(560);const e=(await emptyPts(pg,1))[0];if(!e)return {pass:false,detail:'no empty point'};await openMenu(e[0],e[1]);
  const cms=await ev(pg,()=>[...document.querySelectorAll('#ctxmenu [data-cm]')].map(b=>b.dataset.cm));if(!cms.includes('selall'))return {pass:false,detail:'empty menu items: '+cms.join(',')};
  const s0=(await st(pg)).sel.length;const e0=pg.errs.length;const r=await tapBtn(pg,'#ctxmenu [data-cm="selall"]');await W(pg,()=>window.__osp.sel().length>3,undefined,1500);const s=await st(pg);
  const walls=await ev(pg,ids=>ids.filter(i=>{const o=window.__osp.S().objs.find(x=>x.id===i);return o&&(o.t==='room'||o.t==='wall')}).length,s.sel);await reset(pg);
  return {pass:r.ok&&s0===0&&s.sel.length>10&&walls===0&&pg.errs.length===e0,detail:{r,s0,sel:s.sel.length,walls,cms}}}

/* ---------- A7 / A8: every kind of thing can be picked; locked rooms pass clicks through ---------- */
const KINDS={objs:[{id:'mxtxt',t:'text',x:4000,y:-3000,text:'Matrix label',size:900,gid:null},{id:'mxdim',t:'dim',a:[12000,-3000],b:[20000,-3000],gid:null},{id:'mxwall',t:'wall',pts:[[3000,-6500],[27000,-6500]],th:400,closed:false,gid:null}],
  pin:{id:'mxpin',x:26000,y:-3000,text:'',done:false,lv:null},section:{a:[2000,-9000],b:[28000,-9000],on:true,flip:false}};
const hitPt=(pg,id)=>ev(pg,id=>{const e=document.querySelector(`#plan [data-id="${id}"]`);if(!e)return null;const r=e.getBoundingClientRect(),p=document.querySelector('#plan').getBoundingClientRect();
  const st=Math.max(2,Math.min(r.width,r.height)/8);for(let y=r.top+r.height/2,dy=0;dy<=r.height/2;dy+=st)for(const yy of [y+dy,y-dy])for(let x=r.left+r.width/2,dx=0;dx<=r.width/2;dx+=st)for(const xx of [x+dx,x-dx]){if(xx<p.left+6||xx>p.right-6||yy<p.top+6||yy>p.bottom-6)continue;
    const h=document.elementFromPoint(xx,yy);const c=h&&h.closest('[data-id]');if(c&&c.dataset.id===id&&!h.closest('[data-vh],[data-bh]'))return [xx,yy]}return null},id);
async function kindsChecks(pg,id,tap,drag,tapBtn){
  await ev(pg,K=>{const o=window.__osp,S=o.S();S.objs.push(...JSON.parse(JSON.stringify(K.objs)));S.pins=(S.pins||[]).concat([K.pin]);S.section=K.section;o.fit();o.render()},KINDS);await sleep(150);
  const prep=async(dbl)=>{await reset(pg);await ev(pg,()=>{window.__osp.fit();window.__osp.render()});await sleep(dbl?560:120)};
  const one=async(suf,nm,target,expect)=>id(suf,nm,async()=>{await prep();const p=await target();if(!p)return {pass:false,detail:'no point on the target'};const s0=(await st(pg)).sel.length;const m0=await objMap(pg);await tap(p[0],p[1]);const ok=await expect();const d=delta(m0,await objMap(pg));return {pass:s0===0&&ok&&isNone(d),detail:{s0,ok,sel:(await st(pg)).sel,planChanged:dsum(d)}}});
  const roomId=await ev(pg,()=>window.__osp.S().objs.find(o=>o.t==='room'&&o.name==='Meeting room').id);
  // mutation: app.js ~1108 select-case `const hitEl=ev.target.closest('[data-id]');let o=hitEl?byId(hitEl.dataset.id):null;` → `let o=null;` → FAIL confirmed (sel-room, sel-wall, sel-text, sel-dim)
  await one('sel-room','tap inside a room selects the room',()=>hitPt(pg,roomId),()=>selIs(pg,[roomId]));
  await one('sel-wall','tap a wall selects the wall',()=>hitPt(pg,'mxwall'),()=>selIs(pg,['mxwall']));
  await one('sel-text','tap a text label selects it',()=>hitPt(pg,'mxtxt'),()=>selIs(pg,['mxtxt']));
  await one('sel-dim','tap a dimension selects it',()=>hitPt(pg,'mxdim'),()=>selIs(pg,['mxdim']));
  // mutation: app.js ~1100 select-case `if(pe){const id=pe.dataset.pin;pinSel=id;…}` → `if(false){…}` → FAIL confirmed
  await one('sel-pin','tap a pin selects it',()=>ev(pg,()=>{const e=document.querySelector('[data-pin="mxpin"] .pin-body')||document.querySelector('[data-pin="mxpin"]');const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}),()=>W(pg,()=>window.__osp.pinSel()==='mxpin',undefined,1500));
  // mutation: app.js ~1107 select-case `if(S.section&&S.section.a&&segDist(w[0],w[1],S.section.a,S.section.b)<fs(9)){…secSel=true…}` → `…<-1){…}` → FAIL confirmed
  await one('sel-section','tap the section line selects it',()=>ev(pg,()=>{const o=window.__osp,V=o.V,r=document.querySelector('#plan').getBoundingClientRect();return [r.left+(15000-V.x)*V.k,r.top+(-9000-V.y)*V.k]}),()=>W(pg,()=>window.__osp.secSel()===true,undefined,1500));
  // mutation: app.js ~384 `const fixed=o=>isWallish(o)&&!o.site&&S.locked` → `…&&false` → FAIL confirmed (lock-room); ~2639 `S.locked=!S.locked` → `S.locked=true` → FAIL confirmed (unlock-room)
  await id('lock-room','Lock rooms: a tap on a room does not select it and a drag does not move it',async()=>{await prep(true);const l0=await ev(pg,()=>!!window.__osp.S().locked);const b=await tapBtn('#b-lock');const locked=await W(pg,()=>window.__osp.S().locked===true,undefined,1500);await ev(pg,()=>window.__osp.toastOff());await sleep(560);
    const p=await hitPt(pg,roomId);const m0=await objMap(pg);if(p){await tap(p[0],p[1]);await sleep(560);await drag(p,[p[0]+60,p[1]+40])}const notSel=!(await W(pg,i=>window.__osp.sel().includes(i),roomId,600));const d=delta(m0,await objMap(pg));
    return {pass:!l0&&b.ok!==false&&locked&&!!p&&notSel&&!d.chg.includes(roomId)&&!d.add.length&&!d.rem.length,detail:{l0,locked,pt:!!p,notSel,changed:d.chg.slice(0,3)}}});
  await id('unlock-room','Unlock rooms: a tap on the room selects it again',async()=>{await prep(true);const l0=await ev(pg,()=>!!window.__osp.S().locked);const b=await tapBtn('#b-lock');const un=await W(pg,()=>window.__osp.S().locked===false,undefined,1500);await ev(pg,()=>window.__osp.toastOff());await sleep(560);const p=await hitPt(pg,roomId);if(p)await tap(p[0],p[1]);const ok=await selIs(pg,[roomId]);
    return {pass:l0&&un&&ok,detail:{l0,un,ok,sel:(await st(pg)).sel}}});
  await ev(pg,K=>{const o=window.__osp,S=o.S();S.objs=S.objs.filter(x=>!K.objs.some(k=>k.id===x.id));S.pins=(S.pins||[]).filter(p=>p.id!==K.pin.id);S.section=undefined;S.locked=false;o.setSel([]);o.render()},KINDS);await reset(pg)}

/* ---------- button sweeps ---------- */
async function settle(pg){
  const was3=await ev(pg,()=>{const o=window.__osp;if(!document.querySelector('#v3').hidden||o.bldView()||o.WALK.on){document.querySelector('#v2d').click();return true}return false});if(was3)await sleep(150);
  await pg.keyboard.press('Escape').catch(()=>{});
  await ev(pg,()=>{const o=window.__osp;o.setTool('select');o.setSel([]);const mb=document.querySelector('#multibar');if(mb&&!mb.hidden)document.querySelector('#multi-done').click();
    const ms=document.querySelector('#msheet');if(ms&&!ms.hidden)document.querySelector('[data-msheet-close]').click();
    document.querySelectorAll('.pop').forEach(p=>p.hidden=true);document.querySelectorAll('.keys-modal,[role=dialog]').forEach(p=>{if(!p.hidden){const c=p.querySelector('[data-kclose],#snap-close,[data-pclose],[data-gclose],#mig-cancel,[aria-label=Close]');if(c)c.click();p.hidden=true}});o.toastOff()});await sleep(40)}
/* click every visible control matching `sel` with a finger; each must change something (or be disabled) */
async function sweep(pg,sels,how='fin',pre,skip=[]){
  const bad=[],seen=[];
  const ids=await ev(pg,sels=>{const out=[];document.querySelectorAll(sels).forEach((e,i)=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);if(r.width>0&&r.height>0&&cs.display!=='none'&&!e.closest('[hidden]'))out.push(e.id?'#'+e.id:(e.dataset.tool?`.dock [data-tool="${e.dataset.tool}"]`:(e.dataset.m?`#mbar [data-m="${e.dataset.m}"]`:null)))});return out.filter(Boolean)},sels);
  for(const s of ids){
    if(skip.includes(s))continue;await settle(pg);if(pre)await pre(pg);
    const dis=await ev(pg,s=>{const e=document.querySelector(s);return !!(e&&(e.disabled||e.getAttribute('aria-disabled')==='true'))},s);if(dis){seen.push(s+'(disabled)');continue}
    const act=await ev(pg,s=>document.querySelector(s).classList.contains('on'),s);const b4=await snap(pg),s4=sigs(pg),e0=pg.errs.length;const r=await tapEl(pg,s,how);if(!r.ok){bad.push(s+' unreachable: '+r.why);continue}
    await sleep(s==='#b-save'?600:120);const a4=await snap(pg);seen.push(s);
    if(a4===b4&&sigs(pg)===s4&&!act)bad.push(s+' did nothing');if(pg.errs.length>e0)bad.push(s+' console error: '+pg.errs[pg.errs.length-1].slice(0,100))}
  await settle(pg);return {bad,seen}}
async function menuSweep(pg,openMenu){
  const bad=[],seen=[],escFail=[];
  await settle(pg);await openMenu();const ids=await ev(pg,()=>[...document.querySelectorAll('#pop-more .mi')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.id));
  if(!ids.length)return {bad:['menu has no items / did not open'],seen};
  for(const id of ids){
    await settle(pg);await openMenu();const open=await visible(pg,'#pop-more');if(!open){bad.push('menu would not reopen before #'+id);continue}
    const b4=await snap(pg),s4=sigs(pg),e0=pg.errs.length;const r=await tapEl(pg,'#'+id);if(!r.ok){bad.push('#'+id+' unreachable: '+r.why);continue}
    await sleep(250);const a4=await snap(pg);seen.push(id);
    const after=await ev(pg,()=>({pm:!document.querySelector('#pop-more').hidden}));
    if(a4===b4&&sigs(pg)===s4)bad.push('#'+id+' did nothing');if(pg.errs.length>e0)bad.push('#'+id+' console error: '+pg.errs[pg.errs.length-1].slice(0,100));
    /* a modal it opened must be closable */
    const m=await ev(pg,()=>[...document.querySelectorAll('.keys-modal:not([hidden])')].map(e=>e.id));
    if(m.length){await pg.keyboard.press('Escape');await sleep(120);const still=await ev(pg,()=>document.querySelectorAll('.keys-modal:not([hidden])').length);
      if(still)escFail.push(m.join(','));
      if(still){const c=await ev(pg,()=>{const e=document.querySelector('.keys-modal:not([hidden]) [data-kclose],.keys-modal:not([hidden]) #snap-close,.keys-modal:not([hidden]) [data-pclose],.keys-modal:not([hidden]) [data-gclose],.keys-modal:not([hidden]) #mig-cancel');if(e){e.click();return true}return false});await sleep(100);
        const still2=await ev(pg,()=>document.querySelectorAll('.keys-modal:not([hidden])').length);if(still2||!c)bad.push('#'+id+' opened '+m.join(',')+' which will not close')}}}
  await settle(pg);return {bad,seen,escFail}}

/* ======================================================================== TABLET ======= */
async function tabletSuite(b,A,cfg,devName,land,full){const heavy=cfg==='ls';
  const P='mx-tb-'+cfg+'-',lab={ls:'iPad landscape',pt:'iPad portrait',ph:'iPad 810 (phone shell)'}[cfg]+': ';
  const pg=await openTablet(b,devName,land);const vp=await ev(pg,()=>({w:innerWidth,phone:matchMedia('(max-width:820px), (pointer:coarse) and (max-height:500px)').matches,dock:!!document.querySelector('.dock')&&getComputedStyle(document.querySelector('.dock')).display!=='none',mbar:getComputedStyle(document.querySelector('#mbar')).display!=='none'}));
  const id=(s,n,f)=>safe(A,P+s,lab+n,f);
  await reset(pg);
  /* 0: how much plan is left visible between the drawers */
  // mutation: app.js ~3682 startup `if(window.innerWidth<820){P.lib=false;P.insp=false}` → both drawers forced open and Details 80vw wide → FAIL confirmed (ls, ph)
  // fix-test (pt): app.js ~3682 → add `else if(window.innerWidth<900)P.lib=false;` (portrait iPad opens with Details only) → PASS confirmed
  await id('plan-room','at least 40% of the canvas width is free of open drawers (plan usable)',async()=>{const r=await ev(pg,()=>{const pl=document.querySelector('#plan').getBoundingClientRect();let cov=[];['#d-lib','#d-insp'].forEach(s=>{const e=document.querySelector(s);if(!e||e.hidden)return;const r=e.getBoundingClientRect();if(r.width>0)cov.push([Math.max(r.left,pl.left),Math.min(r.right,pl.right)])});
    cov.sort((a,b)=>a[0]-b[0]);let c=0,end=-1e9;for(const [a,b2] of cov){const s=Math.max(a,end);if(b2>s)c+=b2-s;end=Math.max(end,b2)}return {free:Math.round(pl.width-c),w:Math.round(pl.width)}});return {pass:r.free>=r.w*0.4,detail:r}});

  /* 1 pencil tap select / tap empty clears / drag marquee */
  const its=await findItems(pg,4);const em=await emptyPts(pg,3);
  // mutation: app.js ~1103 select-case `if(!sel.has(o.id)){sel=new Set(grp…)}` → `if(!sel.size){…}` → FAIL confirmed (pen-tap-replace); ~976 pen-seen `PEN_SEEN=true;document.documentElement.classList.add('pen')` → `PEN_SEEN=false` → FAIL confirmed (pen-tap-select)
  await id('pen-tap-select','Pencil tap selects the item and marks pen as seen',async()=>{if(!its.length)return {pass:false,detail:'no visible item'};const s0=await st(pg);const m0=await objMap(pg);await pg.pen.tap(its[0].x,its[0].y);await selIs(pg,[its[0].id]);await W(pg,()=>document.documentElement.classList.contains('pen'));const s=await st(pg);const d=delta(m0,await objMap(pg));return {pass:s0.sel.length===0&&!s0.pen&&s.sel.length===1&&s.sel[0]===its[0].id&&s.pen&&isNone(d),detail:{s0:s0.sel.length,pen0:s0.pen,sel:s.sel,pen:s.pen,planChanged:dsum(d)}}});
  await id('pen-tap-replace','Pencil tap on another item replaces the selection',async()=>{if(its.length<2)return {pass:false,detail:'need two items'};await reset(pg);await sleep(560);await pg.pen.tap(its[0].x,its[0].y);const a=await selIs(pg,[its[0].id]);await sleep(560);await pg.pen.tap(its[1].x,its[1].y);const b2=await selIs(pg,[its[1].id]);return {pass:a&&b2,detail:{first:a,replaced:b2,sel:(await st(pg)).sel}}});
  // mutation: app.js ~1112 select-case marquee `const addKey=addMod(ev);if(!addKey)sel.clear();` → `const addKey=addMod(ev);` → FAIL confirmed
  await id('pen-tap-empty','Pencil tap on empty canvas clears the selection',async()=>{if(!em.length)return {pass:false,detail:'no empty point'};await reset(pg);await ev(pg,i=>window.__osp.setSel([i]),its[0].id);const s0=(await st(pg)).sel.length;const m0=await objMap(pg);await pg.pen.tap(em[0][0],em[0][1]);await W(pg,()=>window.__osp.sel().length===0);const s=await st(pg);const d=delta(m0,await objMap(pg));return {pass:s0===1&&s.sel.length===0&&isNone(d),detail:{s0,sel:s.sel.length,planChanged:dsum(d)}}});
  // mutation: app.js ~1113 select-case `drag={m:'marq',a:w,b:w,…}` → `drag={m:'marqX',…}` → FAIL confirmed
  await id('pen-marquee','Pencil drag on empty draws a selection box that selects the items inside',async()=>{
    await reset(pg);const r=await ev(pg,()=>{const pl=document.querySelector('#plan').getBoundingClientRect();
      const bad=(x,y)=>{const h=document.elementFromPoint(x,y);return !h||!h.closest('#plan')||!!h.closest('[data-id],[data-pin]')};
      const rects=[...document.querySelectorAll('#plan [data-id]')].map(e=>({id:e.dataset.id,r:e.getBoundingClientRect()})).filter(q=>q.r.width>6&&q.r.width<400);
      for(let y=pl.top+20;y<pl.bottom-60;y+=20)for(let x=pl.left+20;x<pl.right-60;x+=20){if(bad(x,y)||bad(x+14,y+14)||bad(x-14,y-14))continue;
        for(let w=60;w<pl.width*0.7;w+=24){const h2=Math.min(w*0.75,pl.bottom-y-6);const inn=rects.filter(q=>q.r.left>=x+4&&q.r.right<=x+w-4&&q.r.top>=y+4&&q.r.bottom<=y+h2-4);if(inn.length>=2)return {a:[x,y],b:[x+w,y+h2],inside:inn.map(q=>q.id)}}}return null});
    if(!r)return {pass:false,detail:'no empty start point with items to box'};
    let mid=null;await pg.pen.drag(r.a,r.b,12,async()=>{mid=await ev(pg,()=>({dm:window.__osp.dragM(),sel:window.__osp.sel().length}))});
    const s=await st(pg);const miss=r.inside.filter(i=>!s.sel.includes(i));
    const extra=await ev(pg,([sel,inside])=>{const S=window.__osp.S(),g=new Set(inside.map(i=>(S.objs.find(o=>o.id===i)||{}).gid).filter(Boolean));return sel.filter(i=>!inside.includes(i)&&!g.has((S.objs.find(o=>o.id===i)||{}).gid))},[s.sel,r.inside]);
    const box=await ev(pg,([a,b2,ids])=>ids.filter(i=>{const e=document.querySelector(`#plan [data-id="${i}"]`);if(!e)return true;const q=e.getBoundingClientRect();return q.right<Math.min(a[0],b2[0])||q.left>Math.max(a[0],b2[0])||q.bottom<Math.min(a[1],b2[1])||q.top>Math.max(a[1],b2[1])}),[r.a,r.b,extra]);
    return {pass:mid&&mid.dm==='marq'&&s.sel.length>=2&&miss.length===0&&box.length===0,detail:{mid,sel:s.sel.length,expected:r.inside.length,missing:miss.length,selectedOutsideBox:box.length}}});
  /* 2 finger */
  // mutation: app.js ~1126 pointermove `case 'pan':V.x=drag.vx…` → `case 'pan':return;…` → FAIL confirmed
  await id('finger-pan-empty','Finger drag on empty canvas (pen seen) pans by the finger travel and does not select',async()=>{
    await reset(pg);const e=(await emptyPts(pg,1))[0];const v0=(await st(pg)).V;const m0=await objMap(pg);let mid=null;await pg.fin.drag(e,[e[0]+70,e[1]+50],10,async()=>{mid=await ev(pg,()=>window.__osp.dragM())});await W(pg,x=>window.__osp.V.x!==x,v0.x);const s=await st(pg);const d=delta(m0,await objMap(pg));
    const ok=Math.abs((s.V.x-v0.x)+70/v0.k)<15/v0.k&&Math.abs((s.V.y-v0.y)+50/v0.k)<15/v0.k;
    return {pass:mid==='pan'&&s.sel.length===0&&ok&&s.dm===null&&isNone(d),detail:{mid,sel:s.sel.length,dVpx:[(s.V.x-v0.x)*v0.k,(s.V.y-v0.y)*v0.k],planChanged:dsum(d)}}});
  // mutation: app.js ~1225 pan pointerup `if(tool==='select'&&!multiMode&&!lpFired&&(sel.size||pinSel)…)` → `if(false&&…)` → FAIL confirmed
  await id('finger-tap-empty','Finger tap on empty canvas clears the selection',async()=>{
    await reset(pg);const f=await findItems(pg,1);const e=(await emptyPts(pg,1))[0];await ev(pg,i=>window.__osp.setSel([i]),f[0].id);const s0=(await st(pg)).sel.length;const m0=await objMap(pg);await pg.fin.tap(e[0],e[1]);await W(pg,()=>window.__osp.sel().length===0);const s=await st(pg);const d=delta(m0,await objMap(pg));return {pass:s0===1&&s.sel.length===0&&isNone(d),detail:{s0,sel:s.sel,planChanged:dsum(d)}}});
  // mutation: app.js ~1050 touch branch `if(PEN_SEEN||(tool==='select'&&!onObj))` → `if((tool==='select'&&!onObj))` (a finger on an item drags it once a pen was seen) → FAIL confirmed
  await id('finger-drag-item-pans','Finger drag starting on an item (pen seen) pans the plan and leaves the item in place',async()=>{
    await reset(pg);const f=(await findItems(pg,1))[0];const pen=(await st(pg)).pen;const m0=await objMap(pg);const v0=(await st(pg)).V;await pg.fin.drag([f.x,f.y],[f.x+60,f.y+40],10);await W(pg,x=>window.__osp.V.x!==x,v0.x);const s=await st(pg);const d=delta(m0,await objMap(pg));
    return {pass:pen&&isNone(d)&&Math.abs(s.V.x-v0.x)>1&&s.sel.length===0,detail:{pen,planChanged:dsum(d),dV:s.V.x-v0.x,sel:s.sel.length}}});
  /* 3 pencil move + undo/redo */
  // mutation: app.js ~1144 pointermove `case 'move':{` → `case 'move':{if(drag.m==='move')return;` → FAIL confirmed; undo() `restoreState(s)` → `void s` → FAIL confirmed
  await id('pen-move-undo','Pencil drag moves a selected item; on-screen Undo then Redo restore and reapply it',async()=>{
    await reset(pg);const f=(await findItems(pg,1))[0];await pg.pen.tap(f.x,f.y);await selIs(pg,[f.id]);await sleep(550);const o0=await obj(pg,f.id);const k=(await st(pg)).V.k;const m0=await objMap(pg);
    await pg.pen.drag([f.x,f.y],[f.x+90,f.y+50],12);await W(pg,([i,x])=>window.__osp.S().objs.find(o=>o.id===i).x!==x,[f.id,o0.x]);const o1=await obj(pg,f.id);const m1=await objMap(pg);const d=delta(m0,m1);
    const moved=Math.abs((o1.x-o0.x)-90/k)<Math.max(400,0.2*90/k)&&Math.abs((o1.y-o0.y)-50/k)<Math.max(400,0.2*50/k)&&sameSet(d.chg,[f.id])&&!d.add.length;
    const u=await tapEl(pg,'#b-undo');await W(pg,([i,x])=>window.__osp.S().objs.find(o=>o.id===i).x===x,[f.id,o0.x]);const back=delta(m0,await objMap(pg));const rd=await tapEl(pg,'#b-redo');await W(pg,([i,x])=>window.__osp.S().objs.find(o=>o.id===i).x===x,[f.id,o1.x]);const again=delta(m1,await objMap(pg));
    return {pass:moved&&u.ok&&isNone(back)&&rd.ok&&isNone(again),detail:{moved:[o1.x-o0.x,o1.y-o0.y],want:[90/k,50/k],changed:d.chg.length,u,undo:dsum(back),rd,redo:dsum(again)}}});
  /* 4 pencil draws room / wall line */
  // mutation: app.js ~1232 pointerup rect `if(tool==='room'){const n=S.objs.filter…` → `if(tool==='room'){render();return;…` → FAIL confirmed
  await id('pen-room','Pencil drags out a room with the Room tool',async()=>{
    await reset(pg);const t=await chooseTool(pg,'room');if(!t.ok)return {pass:false,detail:t};await ev(pg,()=>window.__osp.toastOff());const e=(await emptyPts(pg,1))[0];const m0=await objMap(pg);const wa=await worldOf(pg,e[0],e[1]),wb=await worldOf(pg,e[0]+110,e[1]+80);
    await pg.pen.drag(e,[e[0]+110,e[1]+80],10);await W(pg,n=>window.__osp.S().objs.length>n,Object.keys(m0).length);const m1=await objMap(pg);const d=delta(m0,m1);const r=d.add.length===1?JSON.parse(m1[d.add[0]]):null;
    /* the Room tool snaps a corner onto a nearby wall face or room edge on purpose: a coordinate counts if it is near the pen, or a little further but exactly on a wall line */
    const wl=await pg.evaluate(()=>{const X=[],Y=[];window.__osp.S().objs.filter(o=>(o.t==='wall'||o.t==='room')&&o.pts).forEach(o=>{const h=o.t==='room'?0:(o.th||100)/2;o.pts.forEach(p=>{X.push(p[0],p[0]-h,p[0]+h);Y.push(p[1],p[1]-h,p[1]+h)})});return [X,Y]});
    const fits=!!r&&r.t==='room'&&(()=>{const xs=r.pts.map(p=>p[0]),ys=r.pts.map(p=>p[1]),tol=Math.max(300,40/((wb[0]-wa[0])/110));const ok=(v,want,L)=>Math.abs(v-want)<tol||(Math.abs(v-want)<2.5*tol&&L.some(q=>Math.abs(q-v)<=1));return ok(Math.min(...xs),wa[0],wl[0])&&ok(Math.max(...xs),wb[0],wl[0])&&ok(Math.min(...ys),wa[1],wl[1])&&ok(Math.max(...ys),wb[1],wl[1])})();
    const ex=await exitTap(pg);const l=await live(pg);
    return {pass:d.add.length===1&&!d.rem.length&&!d.chg.length&&fits&&ex.ok&&l.length===0,detail:{delta:dsum(d),fits,room:r&&r.pts,want:[wa,wb],exit:ex,live:l}}});
  // mutation: app.js ~1007 polybar `if(k==='done'){finishPoly(!polyTool());…}` → `if(k==='done'){return}` → FAIL confirmed
  await id('pen-wall-finish','Pencil taps corners with Walls, then the on-screen Done finishes the line',async()=>{
    await reset(pg);const t=await chooseTool(pg,'poly');if(!t.ok)return {pass:false,detail:t};const e=(await emptyPts(pg,1))[0];const n0=(await st(pg)).n;
    await pg.pen.tap(e[0],e[1]);await pg.pen.tap(e[0]+90,e[1]);await pg.pen.tap(e[0]+90,e[1]+70);const s1=await st(pg);
    const m0=await objMap(pg);await ev(pg,()=>window.__osp.toastOff());const pbv=await visible(pg,'#polybar');const d=await tapEl(pg,'#polybar [data-pb="done"]');await W(pg,()=>!window.__osp.polyPts());const s2=await st(pg);const m1=await objMap(pg);const dd=delta(m0,m1);const w=dd.add.length===1?JSON.parse(m1[dd.add[0]]):null;const ex=await exitTap(pg);const l=await live(pg);
    return {pass:s1.poly===3&&pbv&&d.ok&&s2.poly===0&&!!w&&w.t==='wall'&&w.pts.length===3&&!dd.chg.length&&ex.ok&&l.length===0,detail:{pts:s1.poly,polybar:pbv,done:d,n0,n:s2.n,wall:w&&w.pts.length,live:l}}});
  // fix-test: app.js ~1008 polybar `if(k==='cancel'){finishPoly(false);…}` → `if(k==='cancel'){polyPts=null;typed='';updateHint();render();if(is3D)drawD3Overlay();return}` → PASS confirmed
  await id('pen-wall-cancel','Pencil starts a Walls line; the on-screen Cancel discards it and adds nothing',async()=>{
    await reset(pg);const t=await chooseTool(pg,'poly');if(!t.ok)return {pass:false,detail:t};const e=(await emptyPts(pg,1))[0];const n0=(await st(pg)).n;
    await pg.pen.tap(e[0],e[1]);await pg.pen.tap(e[0]+90,e[1]+20);const s1=await st(pg);
    /* the first-Pencil-use toast can sit over the bar for a few seconds; it is not what is under test */
    await ev(pg,()=>window.__osp.toastOff());const c=await tapEl(pg,'#polybar [data-pb="cancel"]');await W(pg,()=>!window.__osp.polyPts());const s2=await st(pg);const ex=await exitTap(pg);const l=await live(pg);
    return {pass:s1.poly===2&&c.ok&&s2.poly===0&&s2.n===n0&&ex.ok&&l.length===0,detail:{pts:s1.poly,cancel:c,n0,n:s2.n,live:l}}});
  /* 5 pinch */
  // mutation: app.js ~1116 pinch `zoomAt((pinch.k*d/pinch.d)/V.k,…)` → `zoomAt(1,…)` → FAIL confirmed
  await id('pinch-zoom','Two-finger pinch zooms the plan while a Pencil was used, and does not draw or select',async()=>{
    await reset(pg);const m0=await objMap(pg);const pl=await freeSpan(pg);const R1=pl[2],R0=R1/3;const s0=await st(pg);
    await pg.fin.pinch(pl,R0,R1,10);const s1=await st(pg);await pg.fin.pinch(pl,R1,R0,10);const s2=await st(pg);
    const d=delta(m0,await objMap(pg));return {pass:s1.V.k>s0.V.k*1.5&&s2.V.k<s1.V.k*0.7&&s2.pn===0&&s2.sel.length===0&&isNone(d),detail:{k:[s0.V.k,s1.V.k,s2.V.k],pointers:s2.pn,sel:s2.sel.length,planChanged:dsum(d)}}});
  // mutation: app.js ~1219 pointerup `pointers.delete(ev.pointerId);if(pinch){…}` → `if(pinch){…}` (pointers never released) → FAIL confirmed
  await id('pen-after-pinch','Pencil still selects after a pinch (no stuck pointers)',async()=>{
    await reset(pg);const pl=await freeSpan(pg);await pg.fin.pinch(pl,pl[2]/3,pl[2],8);await W(pg,()=>window.__osp.pointersN()===0,undefined,1500);const pn0=(await st(pg)).pn;const k1=(await st(pg)).V.k;
    await reset(pg);await sleep(560);const f=(await findItems(pg,1))[0];await ev(pg,()=>window.__osp.setSel([]));await pg.pen.tap(f.x,f.y);await selIs(pg,[f.id]);const s=await st(pg);return {pass:pn0===0&&s.sel.length===1&&s.sel[0]===f.id&&s.pn===0,detail:{pn0,sel:s.sel,pn:s.pn,pinchAt:pl}}});
  /* 6 long press */
  const openFin=async(x,y)=>{await pg.fin.hold(x,y,700);await W(pg,()=>!document.querySelector('#ctxmenu').hidden,undefined,1500)};const openPen=async(x,y)=>{await pg.pen.hold(x,y,700);await W(pg,()=>!document.querySelector('#ctxmenu').hidden,undefined,1500)};
  // mutation: app.js ~1047 long-press timer `lpTimer=setTimeout(()=>{…showCtx(…)},480)` → `…},48000)` → FAIL confirmed (longpress-finger-item, longpress-pen-item, longpress-pen-empty)
  await id('longpress-finger-item','Finger long-press on an item opens its context menu and selects it',async()=>{
    await reset(pg);await sleep(560);const f=(await findItems(pg,1))[0];const h0=await ev(pg,()=>document.querySelector('#ctxmenu').hidden);const m0=await objMap(pg);await openFin(f.x,f.y);const m=await ev(pg,()=>({v:!document.querySelector('#ctxmenu').hidden,items:[...document.querySelectorAll('#ctxmenu [data-cm]')].map(b=>b.dataset.cm)}));const s=await st(pg);const d=delta(m0,await objMap(pg));
    return {pass:h0&&m.v&&m.items.includes('rotcw')&&m.items.includes('del')&&s.sel.length===1&&s.sel[0]===f.id&&isNone(d),detail:{m,sel:s.sel,f:f.id,pn:s.pn,planChanged:dsum(d)}}});
  await id('longpress-pen-item','Pencil long-press on an item opens its context menu and selects it',async()=>{
    await reset(pg);await sleep(560);const f=(await findItems(pg,1))[0];const h0=await ev(pg,()=>document.querySelector('#ctxmenu').hidden);const m0=await objMap(pg);await openPen(f.x,f.y);const m=await ev(pg,()=>({v:!document.querySelector('#ctxmenu').hidden,items:[...document.querySelectorAll('#ctxmenu [data-cm]')].map(b=>b.dataset.cm)}));const s=await st(pg);const d=delta(m0,await objMap(pg));
    return {pass:h0&&m.v&&m.items.includes('rotcw')&&m.items.includes('del')&&s.sel.length===1&&s.sel[0]===f.id&&isNone(d),detail:{m,sel:s.sel,planChanged:dsum(d)}}});
  await id('longpress-pen-empty','Pencil long-press on empty canvas opens the empty-canvas menu',async()=>{
    await reset(pg);await sleep(560);const e=(await emptyPts(pg,1))[0];const h0=await ev(pg,()=>document.querySelector('#ctxmenu').hidden);await openPen(e[0],e[1]);const m=await ev(pg,()=>({v:!document.querySelector('#ctxmenu').hidden,items:[...document.querySelectorAll('#ctxmenu [data-cm]')].map(b=>b.dataset.cm)}));const s=await st(pg);return {pass:h0&&m.v&&m.items.includes('selall')&&!m.items.includes('del')&&s.sel.length===0,detail:{...m,sel:s.sel.length}}});
  // fix-test (pt): app.js ~1047 long-press timer: after `lpFired=true;` add a one-shot capture `window` pointerup for that pointer that resets `lpFired=false` on the next tick (the lifting finger lands on the menu, never on the plan) → PASS confirmed
  // mutation (ls, ph): app.js ~1218 pointerup `if(lpFired){lpFired=false;…return}` → `if(lpFired){…return}` (flag never cleared) → FAIL confirmed
  await id('tap-empty-after-menu','after a long-press menu action, the next tap on empty canvas still clears the selection',async()=>{
    await reset(pg);await sleep(560);const f=(await findItems(pg,1))[0];const e=(await emptyPts(pg,1))[0];await pg.fin.hold(f.x,f.y,700);const c=await tapEl(pg,'#ctxmenu [data-cm="copy"]');await W(pg,()=>document.querySelector('#ctxmenu').hidden);const s1=await st(pg);await sleep(560);await pg.fin.tap(e[0],e[1]);await W(pg,()=>window.__osp.sel().length===0,undefined,1500);const s2=await st(pg);
    let second=null;if(s2.sel.length){await sleep(560);await pg.fin.tap(e[0]+25,e[1]);second=(await st(pg)).sel.length}
    return {pass:c.ok&&s1.sel.length===1&&s2.sel.length===0,detail:{copy:c,before:s1.sel.length,afterFirstTap:s2.sel.length,afterSecondTap:second}}});
  if(heavy)await kindsChecks(pg,id,(x,y)=>pg.pen.tap(x,y),(a,b2)=>pg.pen.drag(a,b2,10),s=>tapEl(pg,s));
  /* A3 on the tablet: Select several from the long-press menu, then Pencil taps add and remove */
  // mutation: app.js ~973 addMod `||multiMode` → removed → FAIL confirmed
  if(heavy)await id('multi-pen','long-press → Select several, then Pencil taps add two items and a third tap removes one',async()=>{await reset(pg);await sleep(560);const f=await findItems(pg,3);const e=(await emptyPts(pg,1))[0];await openFin(e[0],e[1]);const has=await ev(pg,()=>!!document.querySelector('#ctxmenu [data-cm="multi"]'));if(!has)return {pass:false,detail:'no Select several entry'};
    await tapEl(pg,'#ctxmenu [data-cm="multi"]');const on=await W(pg,()=>!document.querySelector('#multibar').hidden,undefined,1500);await pg.pen.tap(f[0].x,f[0].y);await selIs(pg,[f[0].id]);await sleep(560);await pg.pen.tap(f[1].x,f[1].y);const two=await selIs(pg,[f[0].id,f[1].id]);await sleep(560);await pg.pen.tap(f[0].x,f[0].y);const back=await selIs(pg,[f[1].id]);
    await tapEl(pg,'#multi-done');const off=await W(pg,()=>document.querySelector('#multibar').hidden,undefined,1500);await reset(pg);return {pass:on&&two&&back&&off,detail:{on,two,back,off}}});
  if(full){
    // mutation: app.js ~1293 ctxmenu `else if(a==='rotcw')rotateSel(90);` → `else if(a==='rotcw');` → FAIL confirmed
    await id('ctx-items-finger','Every item-menu entry (finger long-press) runs and has its effect',()=>ctxSweep(pg,openFin,tapEl));
    // mutation: app.js ~1287 ctxmenu `if(a==='selall'){setSel(` → `if(a==='selall'){return;setSel(` → FAIL confirmed
    await id('ctx-empty-pen','Empty-canvas menu entry "Select all" works from a Pencil long-press',()=>ctxEmpty(pg,openPen,tapEl));
  }
  /* 7 way out of every state, on-screen controls only */
  const outs=[];
  const states={
    'tool-room':async()=>{await chooseTool(pg,'room')},
    'tool-room-mid-drag-done':async()=>{await chooseTool(pg,'room');const e=(await emptyPts(pg,1))[0];await pg.pen.drag(e,[e[0]+80,e[1]+60],6)},
    'tool-walls-with-points':async()=>{await chooseTool(pg,'poly');const e=(await emptyPts(pg,1))[0];await pg.pen.tap(e[0],e[1]);await pg.pen.tap(e[0]+80,e[1])},
        'tool-measure':async()=>{await chooseTool(pg,'measure')},'tool-pin':async()=>{await chooseTool(pg,'pin')},'tool-section':async()=>{await chooseTool(pg,'section')},
    'tool-paint':async()=>{await chooseTool(pg,'paint')},
    'tool-fence-with-points':async()=>{await chooseTool(pg,'fence');const e=(await emptyPts(pg,1))[0];await pg.pen.tap(e[0],e[1]);await pg.pen.tap(e[0]+80,e[1])},
    'tool-shape-popup':async()=>{await ev(pg,()=>window.__osp.setTool('shape-rect'));await ev(pg,()=>{const p=document.querySelector('#pop-shape');p.hidden=false})},
    'placing-from-library':async()=>{await ev(pg,()=>{window.__osp.setTool('select')});const had=await visible(pg,'#d-lib');if(!had){if(await visible(pg,'#mbar'))await tapEl(pg,'#mbar [data-m="lib"]');else await tapEl(pg,'#t-lib')}await sleep(150);await ev(pg,()=>document.querySelector('#lib-list .lib-row').click())},
    'select-several-mode':async()=>{const f=(await findItems(pg,1))[0];await openFin(f.x,f.y);await tapEl(pg,'#ctxmenu [data-cm="multi"]')},
    'several-selected':async()=>{await ev(pg,()=>{const S=window.__osp.S();window.__osp.setSel(S.objs.filter(o=>o.t==='item').slice(0,5).map(o=>o.id))})},
    'context-menu-open':async()=>{const f=(await findItems(pg,1))[0];await openFin(f.x,f.y)},
    'more-menu-open':async()=>{await tapEl(pg,'#b-more')},'settings-open':async()=>{await tapEl(pg,'#b-set')},'floor-pop-open':async()=>{await tapEl(pg,'#b-floor')}};
  if(vp.mbar){states['more-sheet-open']=async()=>{await tapEl(pg,'#mbar [data-m="more"]')};states['draw-sheet-open']=async()=>{await tapEl(pg,'#mbar [data-m="draw"]')};states['details-sheet-open']=async()=>{await tapEl(pg,'#mbar [data-m="insp"]')};states['library-sheet-open']=async()=>{await tapEl(pg,'#mbar [data-m="lib"]')}}
  if(vp.dock){states['layers-pop-open']=async()=>{await tapEl(pg,'#t-layers')}}
  /* each state is a check of its own would be too slow to report separately, so one row lists the offenders */
  // mutation: app.js ~2658 escapeAction `else if(tool!=='select')setTool('select')` → `else if(tool!=='select');` (+ ~2496 dock Select button ignored, the desktop-shell exit) → FAIL confirmed
  if(full)await id('way-out','Every tool, line, placing, paint, select-several, menu, popup and sheet state can be left with on-screen controls only',async()=>{
    let dbgE=null;const bad=[];
    for(const [nm,enter] of Object.entries(states)){if(process.env.SB_STATES&&!new RegExp(process.env.SB_STATES).test(nm))continue;
      await reset(pg);
      try{await enter()}catch(e){bad.push(nm+': enter threw '+e.message.slice(0,60));continue}
      await sleep(120);
      const l0=await live(pg);const sel0=(await st(pg)).sel.length;
      if(!l0.length&&sel0<2){bad.push(nm+': state did not start');continue}
      /* exit: whichever on-screen control fits the state, then (for sheets/popups/selection) a tap on empty canvas */
      let exited=false,how='';
      const tryExit=async(label,fn)=>{if(exited)return;const r=await fn();how+=label+(r&&r.ok===false?'(x '+r.why+')':'')+' ';const l=await live(pg);const s=(await st(pg)).sel.length;if(l.length===0&&!(nm==='several-selected'&&s>1))exited=true};
      if(/^tool|^placing/.test(nm)||nm==='tool-shape-popup'){await tryExit('exit',()=>exitTap(pg));if(!exited){await tryExit('exit2',()=>exitTap(pg))}}
      else if(nm==='select-several-mode'){await tryExit('multi-done',()=>tapEl(pg,'#multi-done'))}
      else if(/sheet-open$/.test(nm)){await tryExit('select-slot',()=>tapEl(pg,'#mbar [data-m="select"]'));await tryExit('grab',()=>tapEl(pg,'[data-msheet-close]'))}
      else{const e=(await emptyPts(pg,1))[0];dbgE=e;await tryExit('tap-empty',()=>pg.fin.tap(e[0],e[1]));await tryExit('tap-empty-again',async()=>{await sleep(560);await pg.fin.tap(e[0]+30,e[1])});await tryExit('exit',()=>exitTap(pg))}
      if(!exited)bad.push(nm+': stuck ['+(await live(pg)).join(',')+'] sel='+(await st(pg)).sel.length+' ptrs='+(await st(pg)).pn+' after '+how+' e='+JSON.stringify(dbgE)+' hit='+(dbgE?await ev(pg,([x,y])=>{const h=document.elementFromPoint(x,y);return h&&(h.tagName+'.'+h.getAttribute('class')+'#'+h.id)},dbgE):'')+' ld='+JSON.stringify(await ev(pg,()=>window.__osp.lastDown())));
    }
    await settle(pg);return {pass:bad.length===0,detail:bad.length?bad.join(' | '):Object.keys(states).length+' states'}});
  /* 8 dead buttons */
  // mutation: app.js ~2639 `$('#b-lock')` click handler → returns at once → FAIL confirmed (buttons-header ls/ph, dk)
  if(full)await id('buttons-header','Every visible header button does something (or is disabled)',async()=>{
    await reset(pg);const r=await sweep(pg,'header.top .btn[id],#b-view',  'fin',async pg2=>{const f=(await findItems(pg2,1))[0];if(f)await ev(pg2,i=>window.__osp.setSel([i]),f.id)},heavy?[]:['#v3d','#b-walk','#vbld']);return {pass:r.bad.length===0,detail:r.bad.length?r.bad.join('; '):r.seen.join(',')}});
  // mutation: app.js dock tool click handler → ignores data-tool="measure" → FAIL confirmed (ls, pt)
  if(vp.dock)await id('buttons-dock','Every dock button does something',async()=>{await reset(pg);const r=await sweep(pg,'.dock .btn[data-tool],.dock .btn[id]','fin');return {pass:r.bad.length===0,detail:r.bad.length?r.bad.join('; '):r.seen.length+' buttons'}});
  // mutation: app.js ~2681 mbar `if(k==='more'){msheet('more');return}` → `if(k==='more'){return}` → FAIL confirmed
  if(vp.mbar)await id('buttons-mbar','Every bottom-bar slot does something',async()=>{await reset(pg);const r=await sweep(pg,'#mbar [data-m]','fin');return {pass:r.bad.length===0,detail:r.bad.length?r.bad.join('; '):r.seen.join(',')}});
  // mutation: app.js ~2686 msheet More tiles `const src=$('#'+id);if(src)src.click()` → `const src=null;…` → FAIL confirmed
  if(vp.mbar)await id('buttons-sheets','Every Draw and More sheet tile does something',async()=>{
    const bad=[];for(const kind of ['draw','more']){
      const n=await (async()=>{await settle(pg);await tapEl(pg,`#mbar [data-m="${kind}"]`);return ev(pg,()=>document.querySelectorAll('#msheet [data-pt],#msheet [data-pm]').length)})();
      for(let i=0;i<n;i++){await settle(pg);const b4=await snap(pg),s4=sigs(pg);await tapEl(pg,`#mbar [data-m="${kind}"]`);await W(pg,()=>!document.querySelector('#msheet').hidden,undefined,1500);const nm=await ev(pg,i=>{const e=document.querySelectorAll('#msheet [data-pt],#msheet [data-pm]')[i];return e?(e.dataset.pt||e.dataset.pm):null},i);if(!nm||nm==='vbld')continue;
        /* baseline b4 is the plain state before the sheet opened: a tile whose only effect is closing its sheet is dead */
        const e0=pg.errs.length;const sel=`#msheet [data-pt="${nm}"],#msheet [data-pm="${nm}"]`;const r=await tapEl(pg,sel);await sleep(200);
        if(!r.ok)bad.push(kind+':'+nm+' unreachable '+r.why);else{const a4=await snap(pg);if(a4===b4&&sigs(pg)===s4)bad.push(kind+':'+nm+' did nothing');if(pg.errs.length>e0)bad.push(kind+':'+nm+' console error '+pg.errs[pg.errs.length-1].slice(0,80))}}}
    await settle(pg);return {pass:bad.length===0,detail:bad.length?bad.join('; '):'ok'}});
  // mutation: app.js #m-guide click handler → no-op → FAIL confirmed (ls buttons-menu, dk menu-items)
  if(full&&!vp.mbar)await id('buttons-menu','Every item in the ⋮ menu does something and its dialog closes',async()=>{
    await reset(pg);const r=await menuSweep(pg,async()=>{if(!(await visible(pg,'#pop-more')))await tapEl(pg,'#b-more')});return {pass:r.bad.length===0,detail:r.bad.length?r.bad.join('; '):r.seen.length+' items'}});
  // fix-test: app.js add `window.addEventListener('pointerup',e=>{if(pointers.has(e.pointerId)){pointers.delete(e.pointerId);if(pointers.size<2)pinch=null}})` (+ pointercancel): a finger lifted over a drawer still leaves the plan's pointer list → PASS confirmed
  if(vp.dock)await id('pinch-over-drawer','A pinch whose finger slides onto the open Details drawer leaves no stuck pointer behind',async()=>{
    /* precondition: the Details drawer is open (open it with its dock button if the layout started without it) */
    await reset(pg);if(await ev(pg,()=>document.querySelector('#d-insp').hidden))await tapEl(pg,'#t-insp');const open=await W(pg,()=>!document.querySelector('#d-insp').hidden,undefined,1500);
    const c=await ev(pg,()=>{const d=document.querySelector('#d-insp');const r=document.querySelector('#plan').getBoundingClientRect();if(!d||d.hidden)return null;const dr=d.getBoundingClientRect();return [dr.left-110,r.top+r.height/2,dr.left]});
    if(!c)return {pass:false,detail:'Details drawer would not open'};const pn0=(await st(pg)).pn;await pg.fin.pinch(c,40,120,10);await sleep(150);const s=await st(pg);
    return {pass:open&&pn0===0&&c[0]+120>c[2]&&s.pn===0,detail:{pn0,pointersLeft:s.pn,fingerEndsOnDrawer:c[0]+120>c[2]}}});
  /* 9 */
  // mutation: app.js ~975 multiSync() / render path → also `console.error('mutant')` → FAIL confirmed
  await id('no-console-errors','no console or page errors during the session',async()=>({pass:pg.errs.length===0,detail:pg.errs.slice(0,4).join(' | ')}));
  await pg.ctx.close();
}

/* ======================================================================== DESKTOP ======= */
async function desktopSuite(b,A){
  const pg=await openDesktop(b);const id=(s,n,f)=>safe(A,'mx-dk-'+s,'desktop: '+n,f);
  await reset(pg);
  let last=null;const clickAt=async(p,o={})=>{const x=p.x??p[0],y=p.y??p[1];if(last&&Date.now()-last.t<560&&Math.hypot(last.x-x,last.y-y)<12)await sleep(560);await pg.mouse.click(x,y,o);last={x,y,t:Date.now()};await sleep(90)};
  let escFail=[];
  const items=await findItems(pg,5);const em=await emptyPts(pg,3);
  // mutation: app.js ~1103 select-case `if(!sel.has(o.id)){sel=new Set(grp…)}` → `if(!sel.size){…}` → FAIL confirmed
  await id('click-select','click selects one item, click another replaces',async()=>{await reset(pg);const s0=(await st(pg)).sel.length;const m0=await objMap(pg);await clickAt(items[0]);await selIs(pg,[items[0].id]);const a=await st(pg);await clickAt(items[1]);await selIs(pg,[items[1].id]);const c=await st(pg);const d=delta(m0,await objMap(pg));return {pass:s0===0&&a.sel.length===1&&a.sel[0]===items[0].id&&c.sel.length===1&&c.sel[0]===items[1].id&&isNone(d),detail:{s0,a:a.sel,c:c.sel,planChanged:dsum(d)}}});
  // mutation: app.js ~973 `const addMod=ev=>!!(ev.shiftKey||ev.ctrlKey||ev.metaKey||multiMode)` → `!!(ev.ctrlKey||ev.metaKey||multiMode)` → FAIL confirmed (shift-click); → `!!(ev.shiftKey||ev.metaKey||multiMode)` → FAIL confirmed (ctrl-click)
  await id('shift-click','Shift-click adds, Shift-click again removes',async()=>{await reset(pg);await clickAt(items[0]);await selIs(pg,[items[0].id]);await pg.keyboard.down('Shift');await clickAt(items[1]);await selIs(pg,[items[0].id,items[1].id]);const a=await st(pg);await clickAt(items[1]);await selIs(pg,[items[0].id]);const c=await st(pg);await pg.keyboard.up('Shift');return {pass:sameSet(a.sel,[items[0].id,items[1].id])&&c.sel.length===1&&c.sel[0]===items[0].id,detail:{a:a.sel,c:c.sel}}});
  await id('ctrl-click','Ctrl-click adds and removes',async()=>{await reset(pg);await clickAt(items[0]);await selIs(pg,[items[0].id]);await pg.keyboard.down('Control');await clickAt(items[1]);await selIs(pg,[items[0].id,items[1].id]);const a=await st(pg);await clickAt(items[1]);await selIs(pg,[items[0].id]);const c=await st(pg);await pg.keyboard.up('Control');return {pass:sameSet(a.sel,[items[0].id,items[1].id])&&c.sel.length===1&&c.sel[0]===items[0].id,detail:{a:a.sel,c:c.sel}}});
  // mutation: app.js ~1113 select-case `drag={m:'marq',…}` → `drag={m:'marqX',…}` → FAIL confirmed
  await id('marquee','mouse drag on empty draws a box that selects the items inside',async()=>{
    await reset(pg);const r=await ev(pg,()=>{const pl=document.querySelector('#plan').getBoundingClientRect();const bad=(x,y)=>{const h=document.elementFromPoint(x,y);return !h||!h.closest('#plan')||!!h.closest('[data-id],[data-pin]')};
      const rects=[...document.querySelectorAll('#plan [data-id]')].map(e=>({id:e.dataset.id,r:e.getBoundingClientRect()})).filter(q=>q.r.width>6&&q.r.width<400);
      for(let y=pl.top+20;y<pl.bottom-60;y+=20)for(let x=pl.left+20;x<pl.right-60;x+=20){if(bad(x,y)||bad(x+14,y+14)||bad(x-14,y-14))continue;
        for(let w=60;w<pl.width*0.7;w+=24){const h2=Math.min(w*0.75,pl.bottom-y-6);const inn=rects.filter(q=>q.r.left>=x+4&&q.r.right<=x+w-4&&q.r.top>=y+4&&q.r.bottom<=y+h2-4);if(inn.length>=2)return {a:[x,y],b:[x+w,y+h2],inside:inn.map(q=>q.id)}}}return null});
    if(!r)return {pass:false,detail:'no box found'};await pg.mouse.move(r.a[0],r.a[1]);await pg.mouse.down();let mid=null;for(let i=1;i<=10;i++){await pg.mouse.move(r.a[0]+(r.b[0]-r.a[0])*i/10,r.a[1]+(r.b[1]-r.a[1])*i/10);await sleep(12);if(i===5)mid=await ev(pg,()=>window.__osp.dragM())}await pg.mouse.up();await sleep(80);
    const s=await st(pg);const miss=r.inside.filter(i=>!s.sel.includes(i));return {pass:mid==='marq'&&miss.length===0&&s.sel.length>=2,detail:{mid,sel:s.sel.length,exp:r.inside.length,miss:miss.length}}});
  // mutation: app.js ~1112 select-case `const addKey=addMod(ev);if(!addKey)sel.clear();` → `const addKey=addMod(ev);` → FAIL confirmed
  await id('click-empty-clears','click on empty canvas clears the selection',async()=>{await reset(pg);await ev(pg,i=>window.__osp.setSel([i]),items[0].id);const s0=(await st(pg)).sel.length;const m0=await objMap(pg);await clickAt(em[0]);await W(pg,()=>window.__osp.sel().length===0);const d=delta(m0,await objMap(pg));return {pass:s0===1&&(await st(pg)).sel.length===0&&isNone(d),detail:{s0,planChanged:dsum(d)}}});
  // mutation: app.js ~2658 escapeAction `else{sel.clear();render();renderInspector()}` → `else{}` → FAIL confirmed
  await id('esc-clears','Esc clears the selection',async()=>{await reset(pg);await ev(pg,i=>window.__osp.setSel([i]),items[0].id);const s0=(await st(pg)).sel.length;await pg.keyboard.press('Escape');await W(pg,()=>window.__osp.sel().length===0);return {pass:s0===1&&(await st(pg)).sel.length===0,detail:{s0}}});
  // mutation: app.js ~2741 keydown `if(k==='a'){e.preventDefault();setSel(` → `…;return;setSel(` → FAIL confirmed
  await id('select-all','Ctrl+A selects all furniture (no rooms or walls)',async()=>{await reset(pg);const s0=(await st(pg)).sel.length;await pg.keyboard.press('Control+a');await W(pg,()=>window.__osp.sel().length>10);const s=await st(pg);const r=await ev(pg,ids=>{const S=window.__osp.S(),set=new Set(ids);return {tot:S.objs.filter(o=>o.t==='item').length,walls:ids.filter(i=>{const o=S.objs.find(x=>x.id===i);return o&&(o.t==='room'||o.t==='wall')}).length,missing:S.objs.filter(o=>o.t==='item'&&!o.site&&!set.has(o.id)).length}},s.sel);return {pass:s0===0&&s.sel.length>=r.tot*0.9&&s.sel.length>10&&r.walls===0,detail:{sel:s.sel.length,...r}}});
  // mutation: app.js ~2758 keydown Delete → without deleteAction() → FAIL confirmed; ~269 undo() `restoreState(s)` → `void s` → FAIL confirmed; ~270 redo() `restoreState(future.pop())` → `future.pop()` → FAIL confirmed
  await id('delete-undo-redo','Delete removes; Ctrl+Z restores; Ctrl+Y removes again; Ctrl+Shift+Z also redoes',async()=>{
    await reset(pg);await clickAt(items[0]);await selIs(pg,[items[0].id]);const m0=await objMap(pg);const n0=Object.keys(m0).length;const nw=n=>W(pg,n=>window.__osp.S().objs.length===n,n,1500);
    await pg.keyboard.press('Delete');await nw(n0-1);const m1=await objMap(pg);const d1=delta(m0,m1);await pg.keyboard.press('Control+z');await nw(n0);const d2=delta(m0,await objMap(pg));await pg.keyboard.press('Control+y');await nw(n0-1);const d3=delta(m1,await objMap(pg));
    await pg.keyboard.press('Control+z');await nw(n0);await pg.keyboard.press('Control+Shift+z');await nw(n0-1);const d4=delta(m1,await objMap(pg));await pg.keyboard.press('Control+z');await nw(n0);
    return {pass:sameSet(d1.rem,[items[0].id])&&!d1.add.length&&!d1.chg.length&&isNone(d2)&&isNone(d3)&&isNone(d4),detail:{del:dsum(d1),undo:dsum(d2),ctrlY:dsum(d3),ctrlShiftZ:dsum(d4)}}});
  // mutation: app.js ~2739 keydown `if(k==='d'){e.preventDefault();duplicateSel();return}` → without duplicateSel() → FAIL confirmed
  await id('dup','Ctrl+D duplicates the selection (one copy of the same item, selected)',async()=>{await reset(pg);await clickAt(items[0]);await selIs(pg,[items[0].id]);const m0=await objMap(pg);await pg.keyboard.press('Control+d');await W(pg,n=>window.__osp.S().objs.length===n+1,Object.keys(m0).length);const m1=await objMap(pg);const d=delta(m0,m1);const o=d.add.length===1?JSON.parse(m1[d.add[0]]):null;const src=JSON.parse(m0[items[0].id]);const s=await st(pg);await pg.keyboard.press('Control+z');
    return {pass:!!o&&o.code===src.code&&!d.rem.length&&!d.chg.length&&sameSet(s.sel,d.add),detail:{delta:dsum(d),code:o&&o.code,src:src.code,sel:s.sel}}});
  // mutation: app.js ~2737 keydown `if(k==='v'){…pasteClip(true)…}` → `if(k==='v'){return}` and ~2780 paste event `pasteClip(true);` → removed → FAIL confirmed (copy-paste, cut)
  await id('copy-paste','Ctrl+C then Ctrl+V pastes one copy under the cursor',async()=>{await reset(pg);await clickAt(items[0]);await selIs(pg,[items[0].id]);const m0=await objMap(pg);await pg.keyboard.press('Control+c');await pg.mouse.move(em[0][0],em[0][1]);const at=await worldOf(pg,em[0][0],em[0][1]);await pg.keyboard.press('Control+v');await W(pg,n=>window.__osp.S().objs.length===n+1,Object.keys(m0).length);const m1=await objMap(pg);const d=delta(m0,m1);const o=d.add.length===1?JSON.parse(m1[d.add[0]]):null;await pg.keyboard.press('Control+z');
    return {pass:!!o&&o.code===JSON.parse(m0[items[0].id]).code&&Math.hypot(o.x-at[0],o.y-at[1])<600&&!d.rem.length&&!d.chg.length,detail:{delta:dsum(d),o:o&&[o.x,o.y],at}}});
  // mutation: app.js ~2736 keydown `if(k==='x'){if(copySel()){e.preventDefault();deleteSel()}return}` → `…{e.preventDefault()}return}` → FAIL confirmed
  await id('cut','Ctrl+X removes the selection (and Ctrl+V brings it back)',async()=>{await reset(pg);await clickAt(items[1]);await selIs(pg,[items[1].id]);const m0=await objMap(pg);const n0=Object.keys(m0).length;await pg.keyboard.press('Control+x');await W(pg,n=>window.__osp.S().objs.length===n-1,n0);const d1=delta(m0,await objMap(pg));await pg.mouse.move(em[0][0],em[0][1]);await pg.keyboard.press('Control+v');await W(pg,n=>window.__osp.S().objs.length===n,n0);const n2=(await st(pg)).n;await pg.keyboard.press('Control+z');await pg.keyboard.press('Control+z');
    return {pass:sameSet(d1.rem,[items[1].id])&&!d1.add.length&&n2===n0,detail:{cut:dsum(d1),n0,n2}}});
  // mutation: app.js ~2760 keydown `if(k==='r'){rotateSel(e.shiftKey?-90:90);return}` → `rotateSel(90)` → FAIL confirmed (Shift+R)
  await id('rotate','R rotates the selected item 90°, Shift+R back',async()=>{await reset(pg);const f=(await findItems(pg,1))[0];await clickAt(f);await selIs(pg,[f.id]);const o0=await obj(pg,f.id);await pg.keyboard.press('r');await W(pg,([i,r])=>(window.__osp.S().objs.find(o=>o.id===i).r||0)!==r,[f.id,o0.r]);const o1=await obj(pg,f.id);await pg.keyboard.press('Shift+r');await W(pg,([i,r])=>(window.__osp.S().objs.find(o=>o.id===i).r||0)!==r,[f.id,o1.r]);const o2=await obj(pg,f.id);return {pass:((o1.r-o0.r+360)%360)===90&&o2.r===o0.r,detail:{r:[o0.r,o1.r,o2.r]}}});
  // mutation: app.js ~2764 keydown Arrow: `e.key==='ArrowDown'?s:0` → `e.key==='ArrowDown'?-s:0` → FAIL confirmed
  await id('arrow-nudge','Arrow keys nudge the selection (Right: +x, Down: +y, Left/Up undo it)',async()=>{await reset(pg);const f=(await findItems(pg,1))[0];await clickAt(f);await selIs(pg,[f.id]);const o0=await obj(pg,f.id);const ch=(p)=>W(pg,([i,x,y])=>{const o=window.__osp.S().objs.find(q=>q.id===i);return o.x!==x||o.y!==y},[f.id,p.x,p.y],1500);
    await pg.keyboard.press('ArrowRight');await ch(o0);const o1=await obj(pg,f.id);await pg.keyboard.press('ArrowDown');await ch(o1);const o2=await obj(pg,f.id);await pg.keyboard.press('ArrowLeft');await ch(o2);await pg.keyboard.press('ArrowUp');await W(pg,([i,x,y])=>{const o=window.__osp.S().objs.find(q=>q.id===i);return o.x===x&&o.y===y},[f.id,o0.x,o0.y],1500);const o3=await obj(pg,f.id);
    return {pass:o1.x>o0.x&&o1.y===o0.y&&o2.y>o1.y&&o2.x===o1.x&&o3.x===o0.x&&o3.y===o0.y,detail:{o0,o1,o2,o3}}});
  // mutation: app.js ~2742 keydown `if(k==='g'){e.preventDefault();e.shiftKey?ungroupSel():groupSel();return}` → `e.shiftKey?0:groupSel()` → FAIL confirmed (ungroup half); `e.shiftKey?ungroupSel():0` → FAIL confirmed (group half)
  await id('group','Ctrl+G groups two selected items; Ctrl+Shift+G ungroups',async()=>{await reset(pg);const gi=await findItems(pg,2);items[0]=gi[0];items[1]=gi[1];await clickAt(items[0]);await pg.keyboard.down('Shift');await clickAt(items[1]);await pg.keyboard.up('Shift');await selIs(pg,[items[0].id,items[1].id]);const g0=await ev(pg,ids=>ids.some(i=>window.__osp.S().objs.find(o=>o.id===i).gid),[items[0].id,items[1].id]);await pg.keyboard.press('Control+g');const g=await W(pg,ids=>{const S=window.__osp.S();const a=S.objs.find(o=>o.id===ids[0]),b2=S.objs.find(o=>o.id===ids[1]);return !!a.gid&&a.gid===b2.gid},[items[0].id,items[1].id],1500);await pg.keyboard.press('Control+Shift+g');const u=await W(pg,ids=>ids.every(i=>!window.__osp.S().objs.find(o=>o.id===i).gid),[items[0].id,items[1].id],1500);await ev(pg,()=>{window.__osp.undo();window.__osp.undo()});return {pass:!g0&&g&&u,detail:{g0,g,u}}});
  await kindsChecks(pg,id,(x,y)=>clickAt([x,y]),async(a,b2)=>{await pg.mouse.move(a[0],a[1]);await pg.mouse.down();for(let i=1;i<=8;i++){await pg.mouse.move(a[0]+(b2[0]-a[0])*i/8,a[1]+(b2[1]-a[1])*i/8);await sleep(12)}await pg.mouse.up()},async s=>{await pg.click(s);return {ok:true}});
  /* context menu */
  const rc=async(x,y)=>{await pg.mouse.click(x,y,{button:'right'});await sleep(120)};
  // mutation: app.js ~1293 ctxmenu `else if(a==='rotcw')rotateSel(90);` → `else if(a==='rotcw');` → FAIL confirmed
  await id('ctx-items','right-click item menu: every entry runs with its effect',()=>ctxSweep(pg,rc,async(pg2,sel)=>{await pg2.click(sel);return {ok:true}}));
  // mutation: app.js ~1287 ctxmenu `if(a==='selall'){setSel(` → `…{return;setSel(` → FAIL confirmed
  await id('ctx-empty','right-click on empty canvas: Select all works',()=>ctxEmpty(pg,rc,async(pg2,sel)=>{await pg2.click(sel);return {ok:true}}));
  /* tools */
  // mutation: app.js dock tool click handler → ignores data-tool="measure" → FAIL confirmed
  await id('dock-tools','every dock tool button activates its tool; one Esc returns to Select with nothing live',async()=>{
    const bad=[];const tools=await ev(pg,()=>[...document.querySelectorAll('.dock [data-tool]')].map(b=>b.dataset.tool));
    for(const t of tools){await reset(pg);await pg.click(toolSel(t));await sleep(80);const s=await st(pg);
      if(t==='shape'){const pv=await visible(pg,'#pop-shape');if(!pv)bad.push('shape: no shape popup')}else if(s.tool!==t)bad.push(t+': tool is '+s.tool);
      if(t==='shape'){await pg.keyboard.press('Escape')}else await pg.keyboard.press('Escape');await sleep(60);const s2=await st(pg);const l=await live(pg);if(s2.tool!==null&&s2.tool!=='select')bad.push(t+': Esc left tool '+s2.tool);if(l.length)bad.push(t+': live after Esc '+l.join(','))}
    await reset(pg);return {pass:bad.length===0,detail:bad.length?bad.join('; '):tools.length+' tools'}});
  // mutation: app.js ~2752 keydown `if(e.key==='Escape'&&polyTool()){escapeAction();…}` + ~2756 `if(e.key==='Escape'){escapeAction();return}` → both no-op → FAIL confirmed
  await id('dock-esc-with-points','Esc cancels a line in progress and a second Esc returns to Select (poly, curve, fence)',async()=>{
    const bad=[];for(const t of ['poly','spline','fence']){await reset(pg);await pg.click(toolSel(t));const e=em[0];await pg.mouse.click(e[0],e[1]);await pg.mouse.click(e[0]+80,e[1]);await sleep(60);const s0=await st(pg);await pg.keyboard.press('Escape');const s1=await st(pg);await pg.keyboard.press('Escape');const l=await live(pg);const s2=await st(pg);
      if(s0.poly<2)bad.push(t+': points not placed');if(s1.poly!==0)bad.push(t+': 1st Esc kept the line');if(l.length||(s2.tool&&s2.tool!=='select'))bad.push(t+': not idle after 2 Esc ['+l.join(',')+']')}
    await reset(pg);return {pass:bad.length===0,detail:bad.join('; ')}});
  // mutation: app.js ~1232 pointerup rect `if(tool==='room'){const n=S.objs.filter…` → `if(tool==='room'){render();return;…` → FAIL confirmed
  await id('draw-room','Room tool: mouse drag creates one room over the dragged box, Esc exits',async()=>{await reset(pg);await pg.click(toolSel('room'));await ev(pg,()=>window.__osp.toastOff());const e=em[0];const m0=await objMap(pg);const wa=await worldOf(pg,e[0],e[1]),wb=await worldOf(pg,e[0]+112,e[1]+80);await pg.mouse.move(e[0],e[1]);await pg.mouse.down();for(let i=1;i<=8;i++){await pg.mouse.move(e[0]+14*i,e[1]+10*i);await sleep(12)}await pg.mouse.up();await W(pg,n=>window.__osp.S().objs.length>n,Object.keys(m0).length);const m1=await objMap(pg);const d=delta(m0,m1);const r=d.add.length===1?JSON.parse(m1[d.add[0]]):null;
    const fits=!!r&&r.t==='room'&&(()=>{const xs=r.pts.map(p=>p[0]),ys=r.pts.map(p=>p[1]);return Math.abs(Math.min(...xs)-wa[0])<300&&Math.abs(Math.max(...xs)-wb[0])<300&&Math.abs(Math.min(...ys)-wa[1])<300&&Math.abs(Math.max(...ys)-wb[1])<300})();
    await pg.keyboard.press('Escape');await sleep(60);const l=await live(pg);return {pass:d.add.length===1&&!d.rem.length&&!d.chg.length&&fits&&l.length===0,detail:{delta:dsum(d),fits,room:r&&r.pts,want:[wa,wb],l}}});
  /* placing */
  // mutation: app.js ~1391 rotateSel `if(tool==='place'){placeRot=(placeRot+deg+360)%360;…}` → `placeRot=placeRot;` → FAIL confirmed
  await id('place-click-rotate-esc','library row then click places; R rotates the ghost while placing; Esc stops',async()=>{
    await reset(pg);await ev(pg,()=>{if(document.querySelector('#d-lib').hidden)document.querySelector('#t-lib').click()});await sleep(100);
    await pg.click('#lib-list .lib-row');await sleep(80);const s0=await ev(pg,()=>({tool:!!document.querySelector('#hint')&&document.querySelector('#hint').textContent,on:!!document.querySelector('.lib-row.on')}));
    const e=em[0];await pg.mouse.move(e[0],e[1]);await sleep(60);const ov0=await ev(pg,()=>document.querySelector('#plan').innerHTML.length+':'+document.querySelector('#plan').innerHTML.slice(-300));await pg.keyboard.press('r');await sleep(60);const ov1=await ev(pg,()=>document.querySelector('#plan').innerHTML.length+':'+document.querySelector('#plan').innerHTML.slice(-300));
    const m0=await objMap(pg);await pg.mouse.click(e[0],e[1]);await W(pg,n=>window.__osp.S().objs.length>n,Object.keys(m0).length);const m1=await objMap(pg);const d=delta(m0,m1);const o=d.add.length===1?JSON.parse(m1[d.add[0]]):null;const n1=Object.keys(m1).length;
    await pg.keyboard.press('Escape');await W(pg,()=>!document.querySelector('.lib-row.on'),undefined,1500);const l=await live(pg);const on=await ev(pg,()=>!!document.querySelector('.lib-row.on'));
    return {pass:s0.on&&ov0!==ov1&&d.add.length===1&&!d.chg.length&&!!o&&(o.r||0)===90&&!on&&l.length===0,detail:{placing:s0.on,rotateChangedGhost:ov0!==ov1,delta:dsum(d),placedR:o&&o.r,rowStillOn:on,live:l}}});
  // mutation: app.js plan `drop` handler for a dragged library row → returns at once → FAIL confirmed
  await id('place-drag','dragging a library row onto the plan places it',async()=>{
    await reset(pg);await ev(pg,()=>{if(document.querySelector('#d-lib').hidden)document.querySelector('#t-lib').click()});await sleep(100);const e=em[0];const n0=(await st(pg)).n;
    await pg.dragAndDrop('#lib-list .lib-row','#plan',{targetPosition:await ev(pg,e=>{const r=document.querySelector('#plan').getBoundingClientRect();return {x:e[0]-r.left,y:e[1]-r.top}},e)});await W(pg,n=>window.__osp.S().objs.length>n,n0);const n1=(await st(pg)).n;return {pass:n1===n0+1,detail:{n0,n1}}});
  /* menu */
  // mutation: app.js #m-guide click handler → no-op → FAIL confirmed
  await id('menu-items','every ⋮ menu item opens something or runs cleanly, and what it opens closes',async()=>{
    const p2=await openDesktop(b);const r=await menuSweep(p2,async()=>{if(!(await visible(p2,'#pop-more')))await p2.click('#b-more')});escFail=r.escFail;await p2.ctx.close();
    return {pass:r.bad.length===0,detail:r.bad.length?r.bad.join('; '):r.seen.length+' items'}});
  // fix-test: app.js ~2715 keydown: add `if(!$('#snap-modal').hidden&&e.key==='Escape'){$('#snap-modal').hidden=true;return}` beside the keys-modal line → PASS confirmed
  await id('menu-esc-closes-dialogs','Esc closes every dialog the ⋮ menu opens',async()=>({pass:escFail.length===0,detail:'Esc left open: '+escFail.join(',')}));
  // mutation: app.js ~2639 `$('#b-lock')` click handler → returns at once → FAIL confirmed
  await id('buttons-header','every header button does something',async()=>{const p2=await openDesktop(b);await reset(p2);const r=await sweep(p2,'header.top .btn[id],#b-view','dk',async pg2=>{const f=(await findItems(pg2,1))[0];if(f)await ev(pg2,i=>window.__osp.setSel([i]),f.id)},['#v3d','#b-walk','#vbld']);await p2.ctx.close();return {pass:r.bad.length===0,detail:r.bad.length?r.bad.join('; '):r.seen.join(',')}});
  // mutation: app.js ~975 multiSync() / render path → also `console.error('mutant')` → FAIL confirmed
  await id('no-console-errors','no console or page errors during the session',async()=>({pass:pg.errs.length===0,detail:pg.errs.slice(0,4).join(' | ')}));
  await pg.ctx.close();
}
export async function run(b){
  const t0=Date.now();const log=n=>{if(process.env.SB_TRACE)console.error(n,Math.round((Date.now()-t0)/1000)+'s')};
  const suites=[['ls',A=>tabletSuite(b,A,'ls','iPad Pro 11',true,true)],['ph',A=>tabletSuite(b,A,'ph','iPad (gen 7)',false,true)],['pt',A=>tabletSuite(b,A,'pt','iPad Pro 11',false,false)],['dk',A=>desktopSuite(b,A)]];
  let only=process.env.SB_ONLY?process.env.SB_ONLY.split(','):null;
  /* SB_ONLY_IDS naming ids of some setups only: skip the other setups' pages */
  if(!only&&FILTER){const src=FILTER;const pre={ls:'mx-tb-ls-',ph:'mx-tb-ph-',pt:'mx-tb-pt-',dk:'mx-dk-'};const hit=Object.keys(pre).filter(k=>src.includes(pre[k]));if(hit.length)only=hit}
  const res=await Promise.all(suites.filter(x=>!only||only.includes(x[0])).map(async([n,f])=>{const A=mk();try{await f(A)}catch(e){A.add('mx-'+n+'-suite-crash','suite '+n+' crashed',false,String(e.stack||e).slice(0,300))}log(n);return A.R}));
  return res.flat()}
export const _openTablet=openTablet;export const _h={reset,findItems,emptyPts,st};
