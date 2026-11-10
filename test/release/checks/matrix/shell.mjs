/* matrix slice: shell and escape hatches (CORE-CHECKLIST I1-I5) and locked rooms (A8), on every setup.
   D2 desktop 2D · D3 desktop 3D · P2 phone 2D (iPhone 13) · P3 phone 3D · T iPad Pro 11 landscape + Pencil (desktop shell).
   Ids: mx-sh-<group>-<item>-<setup>.

   The checks are generated from inventories, not hand-picked:
   - STATES: every enterable state (each tool, half-drawn lines, placing, paint, Select several, context menu, a selection,
     a selected pin / section line, calibrate, underlay move, detect box, walk pick, Walk, roof, Building, section slice,
     sun, ceiling plan, every sheet, drawer, popover and modal). Each is entered with real input, then a user agent gets out
     using ONLY what that setup offers (desktop: the Esc key, or the on-screen toggle for view modes; touch: the Cancel chip,
     the Select slot, grab handles, close buttons, Done buttons, tapping outside). The agent takes up to 4 steps and the
     check asserts plain Select: tool select, no line, nothing open or live, selection empty, object count unchanged.
     A state the agent cannot leave is a FAIL (a finding).
   - CONTROLS: every visible control in the header, dock, bottom bar, Draw and More sheets, the main menu, the 3D bar, the
     sun bar and each inspector tab, listed from the live DOM. Each is tapped from a known start state and must change
     something observable (DOM, tool, view, plan, prefs, a download / file picker / dialog) or be disabled.
   - SETTINGS: every option in the settings popover applies (its own observable effect) and persists across a reload.
   - I4: Shortcuts, Guide and Version open and close on every setup.  A8: locked rooms on D2, P2, T.

   n/a (not generated): Pan tool on phones (no Pan tool in the phone shell: fingers pan); the phone sheets/drawers on
   desktop shells (they do not exist there); underlay calibrate / move / detect, walk pick, pin / section-line selection
   and ceiling plan in 3D setups (each drops to 2D by design, so the 2D rows cover them); sun / section slice / STL in 2D
   (they exist only in 3D; T runs them in 3D); Select several on desktops (touch-only: desktop adds with Shift / Ctrl);
   the save-status popover on phones (no status line there); Layers on D3 (no Layers button in the desktop 3D view);
   Details panel buttons on T (same desktop panel as D2; kept off T for runtime).

   Mutation testing: `SB_SETUPS=<setups> node /tmp/mx-sh/mut.mjs <name> <id-regex> <find> <replace>` builds a copy of app.js
   with one change (find must occur once) and runs the matching rows. Mutants run are listed above the code they guard as
   `// mutation: ... → FAIL confirmed`; generated rows were sampled per inventory type (states, controls, every setting). */
import {devices,row,devFile} from '../../lib.mjs';
export const name='matrix-shell';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const URL_=()=>process.env.SB_URL||devFile();
const ev=(pg,fn,arg)=>pg.evaluate(fn,arg);
const ONLY=process.env.SB_CHECK?new RegExp(process.env.SB_CHECK):null;
export const retryable=true;

/* ---------------- setups ---------------- */
const SETUPS=[
  {id:'d2',nm:'desktop 2D',kind:'desk',three:false},
  {id:'d3',nm:'desktop 3D',kind:'desk',three:true},
  {id:'p2',nm:'phone 2D',kind:'phone',three:false},
  {id:'p3',nm:'phone 3D',kind:'phone',three:true},
  {id:'t',nm:'iPad + Pencil',kind:'tab',three:false}];

async function openSetup(b,su){
  let ctx;
  if(su.kind==='desk')ctx=await b.newContext({viewport:{width:1400,height:900}});
  else if(su.kind==='phone')ctx=await b.newContext({...devices['iPhone 13']});
  else{const d=devices['iPad Pro 11'];ctx=await b.newContext({...d,viewport:{width:d.viewport.height,height:d.viewport.width},hasTouch:true})}
  const pg=await ctx.newPage();pg.ctx=ctx;pg.su=su;pg.errs=[];pg.sig={dialog:0,chooser:0,download:0};
  pg.on('pageerror',e=>pg.errs.push('PE:'+e.message));pg.on('console',m=>{if(m.type()==='error')pg.errs.push(m.text())});
  pg.on('dialog',d=>{pg.sig.dialog++;d.dismiss().catch(()=>{})});pg.on('filechooser',()=>{pg.sig.chooser++});pg.on('download',()=>{pg.sig.download++});
  await pg.addInitScript(()=>{window.__sfp=0;window.showSaveFilePicker=async()=>{window.__sfp++;throw new DOMException('test','AbortError')};window.showOpenFilePicker=async()=>{window.__sfp++;throw new DOMException('test','AbortError')}});
  await pg.goto(URL_(),{waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,null,{timeout:20000});
  await ev(pg,()=>{const b=document.querySelector('#m-sample');if(b)b.click()});await pg.waitForFunction(()=>window.__osp.S().objs.length>100,null,{timeout:5000});
  await ev(pg,()=>window.__osp.toastOff());
  if(su.kind!=='desk'){
    const cdp=await ctx.newCDPSession(pg);pg.cdp=cdp;
    const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(p=>({x:p[0],y:p[1],id:p[2]??0}))});
    pg.fin={T,tap:async(x,y)=>{await T('touchStart',[[x,y]]);await sleep(30);await T('touchEnd',[]);await sleep(50)},
      hold:async(x,y,ms=750)=>{await T('touchStart',[[x,y]]);await sleep(ms);await T('touchEnd',[]);await sleep(80)},
      drag:async(a,b2,n=10)=>{await T('touchStart',[a]);for(let i=1;i<=n;i++){await T('touchMove',[[a[0]+(b2[0]-a[0])*i/n,a[1]+(b2[1]-a[1])*i/n]]);await sleep(16)}await T('touchEnd',[]);await sleep(80)}};
    const M=(type,x,y,extra={})=>cdp.send('Input.dispatchMouseEvent',Object.assign({type,x,y,pointerType:'pen'},extra));
    pg.pen={tap:async(x,y)=>{await M('mouseMoved',x,y);await M('mousePressed',x,y,{button:'left',buttons:1,clickCount:1});await sleep(30);await M('mouseReleased',x,y,{button:'left',buttons:0,clickCount:1});await sleep(60)},
      hold:async(x,y,ms=750)=>{await M('mouseMoved',x,y);await M('mousePressed',x,y,{button:'left',buttons:1,clickCount:1});await sleep(ms);await M('mouseReleased',x,y,{button:'left',buttons:0,clickCount:1});await sleep(80)},
      drag:async(a,b2,n=10)=>{await M('mouseMoved',a[0],a[1]);await M('mousePressed',a[0],a[1],{button:'left',buttons:1,clickCount:1});for(let i=1;i<=n;i++){await M('mouseMoved',a[0]+(b2[0]-a[0])*i/n,a[1]+(b2[1]-a[1])*i/n,{button:'left',buttons:1});await sleep(16)}await M('mouseReleased',b2[0],b2[1],{button:'left',buttons:0,clickCount:1});await sleep(80)}};
  }
  /* UI taps: mouse on desktop, finger on phone and iPad.  Canvas input: mouse, finger (phone), Pencil (iPad). */
  pg.uiTap=su.kind==='desk'?(x,y)=>pg.mouse.click(x,y):(x,y)=>pg.fin.tap(x,y);
  pg.cvTap=su.kind==='desk'?async(x,y)=>{await pg.mouse.click(x,y);await sleep(40)}:su.kind==='phone'?(x,y)=>pg.fin.tap(x,y):(x,y)=>pg.pen.tap(x,y);
  pg.cvHold=su.kind==='desk'?async(x,y)=>{await pg.mouse.click(x,y,{button:'right'});await sleep(80)}:su.kind==='phone'?(x,y)=>pg.fin.hold(x,y):(x,y)=>pg.pen.hold(x,y);
  pg.cvDrag=su.kind==='desk'?async(a,b2,n=10)=>{await pg.mouse.move(a[0],a[1]);await pg.mouse.down();for(let i=1;i<=n;i++){await pg.mouse.move(a[0]+(b2[0]-a[0])*i/n,a[1]+(b2[1]-a[1])*i/n);await sleep(16)}await pg.mouse.up();await sleep(80)}:su.kind==='phone'?(a,b2,n)=>pg.fin.drag(a,b2,n):(a,b2,n)=>pg.pen.drag(a,b2,n);
  pg.defaults=await ev(pg,()=>({lib:!!window.__osp.P().lib,insp:!!window.__osp.P().insp}));
  if(su.three)await to3D(pg);
  return pg}

const is3D=pg=>ev(pg,()=>!document.querySelector('#v3').hidden);
async function to3D(pg){if(await is3D(pg)&&!(await ev(pg,()=>window.__osp.bldView())))return;await ev(pg,()=>document.querySelector('#v3d').click());
  await pg.waitForFunction(()=>window.__osp.T3()&&window.__osp.T3().renderer&&!document.querySelector('#v3').hidden,null,{timeout:30000});await sleep(500)}
async function to2D(pg){if(!(await is3D(pg)))return;await ev(pg,()=>document.querySelector('#v2d').click());await pg.waitForFunction(()=>document.querySelector('#v3').hidden,null,{timeout:5000});await sleep(80)}

/* ---------------- reading state ---------------- */
/* everything that is "not plain Select" */
const LIVE=()=>{const o=window.__osp,S=o.S(),g=s=>document.querySelector(s);
  const vis=e=>{if(!e||e.hidden||e.closest('[hidden]'))return false;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'};
  const L=[];const on=g('.dock .btn.on[data-tool]');const tl=on?on.dataset.tool:'(none)';if(tl!=='select')L.push('tool:'+tl);
  if(document.querySelector('.lib-row.on'))L.push('placing');
  if((o.polyPts()||[]).length)L.push('line');
  document.querySelectorAll('.pop').forEach(p=>{if(vis(p))L.push(p.id)});document.querySelectorAll('.keys-modal').forEach(p=>{if(!p.hidden)L.push(p.id)});
  ['#msheet','#multibar','#pstrip','#paintstrip','#polybar','#esc'].forEach(s=>{if(vis(g(s)))L.push(s.slice(1))});
  if(innerWidth<=820){if(vis(g('#d-lib')))L.push('sheet:lib');if(vis(g('#d-insp')))L.push('sheet:insp')}
  if(o.WALK.on)L.push('walk');const h=g('#hint');const ht=h&&!h.hidden?(h.querySelector('b')||{}).textContent||'':'';if(/^(Calibrate|Move underlay|Walk · step 1|Detect walls)/.test(ht))L.push('mode:'+ht);
  if(o.bldView())L.push('building');if(o.roofMode())L.push('roof');if(o.P().rcp)L.push('ceiling');if(o.SUN().on)L.push('sun');
  if(!g('#v3').hidden&&S.section&&S.section.on)L.push('section-on');
  if(o.sel().length)L.push('sel:'+o.sel().length);if(o.pinSel())L.push('pin-selected');if(o.secSel())L.push('section-selected');
  return L};
const live=pg=>ev(pg,LIVE);
const nObjs=pg=>ev(pg,()=>window.__osp.S().objs.length);

/* reset to a known start (debug hook; never the action under test) */
async function hardReset(pg){
  const su=pg.su;
  await ev(pg,()=>{const o=window.__osp,g=s=>document.querySelector(s);if(o.WALK.on)g('#b-walk').click();if(o.roofMode())o.switchFloor(o.S().bld.active);
    document.querySelectorAll('.keys-modal').forEach(p=>p.hidden=true);if(!g('#multibar').hidden)g('#multi-done').click();
    if(!g('#msheet').hidden)g('[data-msheet-close]').click();if(o.SUN().on)g('#v3-sun').click();
    for(let i=0;i<6&&LIVE_ESC();i++)g('#esc').click();
    function LIVE_ESC(){const h=g('#hint');const ht=h&&!h.hidden?(h.querySelector('b')||{}).textContent||'':'';return /^(Calibrate|Move underlay|Walk · step 1|Detect walls)/.test(ht)||(o.polyPts()||[]).length>0}
    o.setTool('select');o.setSel([]);o.setSecSel(false);if(o.pinSel()){g('#mbar [data-m=select]').click()}
    const S=o.S();if(S.section){S.section=undefined;o.render()}
    if(o.P().rcp)g('#t-rcp').click();
    document.querySelectorAll('.pop').forEach(p=>p.hidden=true);o.toastOff()});
  /* drawers back to this setup's defaults (phones: both closed); report the view so only a needed switch is made */
  const st=await ev(pg,d=>{const o=window.__osp,P=o.P(),ph=innerWidth<=820;const wantL=ph?false:d.lib,wantI=ph?false:d.insp;
    if(!!P.lib!==wantL)document.querySelector('#t-lib').click();if(!!P.insp!==wantI)document.querySelector('#t-insp').click();
    if(o.bldView())document.querySelector('#v2d').click();const V=o.V;return {is3D:!document.querySelector('#v3').hidden,V:[V.x,V.y,V.k]}},pg.defaults);
  if(su.three&&!st.is3D)await to3D(pg);else if(!su.three&&st.is3D)await to2D(pg);
  if(!su.three){const v=st.is3D?await ev(pg,()=>{const V=window.__osp.V;return [V.x,V.y,V.k]}):st.V;if(!pg.view||v.some((x,i)=>Math.abs(x-pg.view[i])>1e-6))await homeView(pg)}
  await ev(pg,()=>{const o=window.__osp;o.setSel([]);o.setSecSel(false);document.querySelectorAll('.pop').forEach(p=>p.hidden=true);o.render();o.toastOff()});await sleep(30)}
/* the 2D view every check starts from: fit; on phones zoom in about 2x and pan (two fingers) so the building's
   top-left corner, with some outside space, fills the screen (items big enough for a finger, empty ground to tap) */
async function homeView(pg){await ev(pg,()=>document.querySelector('#z-fit').click());await sleep(40);
  if(pg.su.kind==='phone'){await ev(pg,()=>{for(let i=0;i<3;i++)document.querySelector('#z-in').click()});await sleep(60);
    const d=await ev(pg,()=>{const V=window.__osp.V,r=document.querySelector('#plan').getBoundingClientRect();const sx=r.left+(-1600-V.x)*V.k,sy=r.top+(-1600-V.y)*V.k;return [r.left+110-sx,r.top+250-sy]});
    /* strokes of at most 140 px so both fingers stay on the plan (a finger lifted off the plan leaves a ghost pointer) */
    const k=Math.max(1,Math.ceil(Math.hypot(d[0],d[1])/140));const c=[195,400];
    for(let j=0;j<k;j++){const dx=d[0]/k,dy=d[1]/k,a=[c[0]-50-dx/2,c[1]-dy/2],b2=[c[0]+50-dx/2,c[1]-dy/2],n=8;await pg.fin.T('touchStart',[[a[0],a[1],1],[b2[0],b2[1],2]]);
      for(let i=1;i<=n;i++){await pg.fin.T('touchMove',[[a[0]+dx*i/n,a[1]+dy*i/n,1],[b2[0]+dx*i/n,b2[1]+dy*i/n,2]]);await sleep(16)}await pg.fin.T('touchEnd',[]);await sleep(60)}
    await pg.waitForFunction(()=>window.__osp.pointersN()===0,null,{timeout:4000}).catch(()=>{});
    /* the pan must leave empty ground on screen; if a stroke was lost, start over once */
    if(!pg.homeRetry&&!(await emptyPts(pg,1)).length){pg.homeRetry=true;try{return await homeView(pg)}finally{pg.homeRetry=false}}}
  pg.view=await ev(pg,()=>{const V=window.__osp.V;return [V.x,V.y,V.k]})}

/* ---------------- geometry ---------------- */
const visible=(pg,sel)=>ev(pg,sel=>{const e=document.querySelector(sel);if(!e||e.hidden||e.closest('[hidden]'))return false;const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'},sel);
/* centre of a control, scrolled into view, and proven to be the topmost element there */
const ptOf=(pg,sel)=>ev(pg,sel=>{const e=typeof sel==='string'?document.querySelector(sel):null;if(!e)return {err:'missing '+sel};
  if(e.hidden||e.closest('[hidden]'))return {err:'hidden'};e.scrollIntoView({inline:'center',block:'nearest'});const r=e.getBoundingClientRect();if(!(r.width>0&&r.height>0))return {err:'zero size'};
  const x=r.left+r.width/2,y=r.top+r.height/2;if(x<0||y<0||x>innerWidth||y>innerHeight)return {err:'offscreen'};const h=document.elementFromPoint(x,y);
  if(!h||!(e===h||e.contains(h)||(e.tagName==='INPUT'&&h.contains(e))||(h.tagName==='LABEL'&&h.control===e)))return {err:'covered by '+(h&&(h.id||h.className||h.tagName))};return {x,y}},sel);
async function tapEl(pg,sel){/* wait (≤2 s) for the control to be rendered and tappable: sheets and popovers fill in after the tap that opens them */
  let p=await ptOf(pg,sel);for(let i=0;i<10&&p.err&&/missing|hidden|covered by msheet|covered by pop/.test(p.err);i++){await sleep(200);p=await ptOf(pg,sel)}if(p.err&&/covered by toast/.test(p.err)){await ev(pg,()=>window.__osp.toastOff());p=await ptOf(pg,sel)}if(p.err)throw new Error(`cannot tap ${sel}: ${p.err}`);await pg.uiTap(p.x,p.y);await sleep(40);return p}
/* items visible on the 2D plan that a tap at (x,y) would hit */
const findItems=(pg,n=2)=>ev(pg,n=>{const o=window.__osp,S=o.S(),pl=document.querySelector('#plan').getBoundingClientRect(),out=[];
  const top=innerWidth<=820?130:90,bot=innerWidth<=820?110:90;
  for(const it of S.objs){if(it.t!=='item'||/^(door|win)/.test(it.shape||''))continue;const el=document.querySelector(`#plan [data-id="${it.id}"]`);if(!el)continue;const r=el.getBoundingClientRect();if(r.width<12||r.height<12)continue;
    const x=r.left+r.width/2,y=r.top+r.height/2;if(x<pl.left+20||x>pl.right-20||y<pl.top+top||y>pl.bottom-bot)continue;const h=document.elementFromPoint(x,y);if(!h||!h.closest('#plan'))continue;const c=h.closest('[data-id]');
    if(c&&c.dataset.id===it.id&&out.every(p=>Math.hypot(p.x-x,p.y-y)>60))out.push({id:it.id,x,y});if(out.length>=n)break}return out},n);
/* empty plan points: nothing pickable within 24 px, inside the plan away from bars */
/* setup only: when the fitted plan fills the screen, zoom out about the centre (up to 3 times) until bare ground shows */
const emptyPts=async(pg,n=2)=>{for(let i=0;i<4;i++){const r=await emptyPts0(pg,n);if(r.length>=n||i===3)return r;await ev(pg,()=>document.querySelector('#z-out').click());await sleep(80)}};
const emptyPts0=(pg,n=2)=>ev(pg,n=>{const pl=document.querySelector('#plan').getBoundingClientRect(),res=[];const top=innerWidth<=820?140:100,bot=innerWidth<=820?120:110;
  const bad=(x,y)=>{const h=document.elementFromPoint(x,y);return !h||!h.closest('#plan')||!!h.closest('[data-id],[data-pin],[data-vh],[data-bh],[data-aim],[data-sech]')};
  for(let y=pl.top+top;y<pl.bottom-bot;y+=30)for(let x=pl.left+40;x<pl.right-40;x+=30){if([[0,0],[24,0],[-24,0],[0,24],[0,-24]].some(([dx,dy])=>bad(x+dx,y+dy)))continue;
    if(res.every(q=>Math.hypot(x-q[0],y-q[1])>90))res.push([x,y]);if(res.length>=n)return res}return res},n);
/* a point inside a room's floor that is not on any item (for room picks and walk starts) */
const roomPt=pg=>ev(pg,()=>{const o=window.__osp,S=o.S();const rooms=S.objs.filter(r=>r.t==='room').sort((a,b)=>b.pts.length-a.pts.length);const pl=document.querySelector('#plan').getBoundingClientRect();const top=innerWidth<=820?140:100,bot=innerWidth<=820?120:110;
  for(const r of rooms){const el=document.querySelector(`#plan [data-id="${r.id}"]`);if(!el)continue;const b=el.getBoundingClientRect();
    for(let fy=0.15;fy<0.9;fy+=0.07)for(let fx=0.15;fx<0.9;fx+=0.07){const x=b.left+b.width*fx,y=b.top+b.height*fy;if(x<pl.left+30||x>pl.right-30||y<pl.top+top||y>pl.bottom-bot)continue;
      const ok=[[0,0],[14,0],[-14,0],[0,14],[0,-14]].every(([dx,dy])=>{const h=document.elementFromPoint(x+dx,y+dy);const c=h&&h.closest('[data-id]');return c&&c.dataset.id===r.id});if(ok)return {id:r.id,x,y,pts:JSON.stringify(r.pts)}}}return null});
/* an item on the 3D canvas: project its centre with the three.js camera and confirm the canvas is under it */
const item3D=pg=>ev(pg,()=>{const o=window.__osp,T=o.T3(),S=o.S();if(!T||!T.camera)return null;const c=document.querySelector('#v3c').getBoundingClientRect();const V=new T.THREE.Vector3();
  const its=S.objs.filter(x=>x.t==='item'&&/^WS/.test(x.code||''));for(const it of its){V.set(it.x*0.001,(it.h||730)*0.0009,it.y*0.001).project(T.camera);const x=c.left+(V.x+1)/2*c.width,y=c.top+(1-V.y)/2*c.height;
    if(x<c.left+60||x>c.right-60||y<c.top+120||y>c.bottom-140)continue;const h=document.elementFromPoint(x,y);if(h&&h.id==='v3c')return {id:it.id,x,y}}return null});
/* empty sky / ground on the 3D canvas: a point near the top that is canvas */
const empty3D=pg=>ev(pg,()=>{const c=document.querySelector('#v3c').getBoundingClientRect();for(const fy of [0.2,0.25,0.3])for(const fx of [0.15,0.85,0.5]){const x=c.left+c.width*fx,y=c.top+c.height*fy;const h=document.elementFromPoint(x,y);if(h&&h.id==='v3c')return [x,y]}return null});

/* ---------------- entering states (real input) ---------------- */
const isPhone=pg=>pg.su.kind==='phone';
const dockSel=t=>/^shape/.test(t)?'#t-shape':`.dock [data-tool="${t}"]`;
async function chooseTool(pg,t){
  if(isPhone(pg)){await tapEl(pg,'#mbar [data-m=draw]');await tapEl(pg,`#msheet [data-pt="${/^shape/.test(t)?'shape':t}"]`)}
  else await tapEl(pg,dockSel(t));
  if(/^shape-/.test(t))await tapEl(pg,`#pop-shape [data-shape="${t.slice(6)}"]`)}
/* zoom buttons and some items keep the menu open on purpose; tapping ⋮ again would close it */
async function openMenu(pg){if(await ev(pg,()=>!document.querySelector('#pop-more').hidden))return;await tapEl(pg,'#b-more');
  /* after the scripted two-finger pans of homeView a synthetic touch can be swallowed by CDP; one more tap, as a user would */
  if(!(await ev(pg,()=>!document.querySelector('#pop-more').hidden))){await sleep(150);if(await ev(pg,()=>document.querySelector('#pop-more').hidden))await tapEl(pg,'#b-more')}
  await pg.waitForFunction(()=>!document.querySelector('#pop-more').hidden,null,{timeout:3000})}
async function menuItem(pg,id){await openMenu(pg);await tapEl(pg,'#'+id)}
async function moreTile(pg,id){await tapEl(pg,'#mbar [data-m=more]');await tapEl(pg,`#msheet [data-pm="${id}"]`)}
async function openInspTab(pg,tab){
  if(isPhone(pg)){if(!(await visible(pg,'#d-insp')))await tapEl(pg,'#mbar [data-m=insp]')}else if(!(await visible(pg,'#d-insp')))await tapEl(pg,'#t-insp');
  await tapEl(pg,`#d-insp [data-tab="${tab}"]`)}
async function openSettings(pg){if(isPhone(pg))await moreTile(pg,'b-set');else await tapEl(pg,'#b-set');await pg.waitForFunction(()=>!document.querySelector('#pop-set').hidden,null,{timeout:3000})}
async function openLib(pg){if(isPhone(pg))await tapEl(pg,'#mbar [data-m=lib]');else if(!(await visible(pg,'#d-lib')))await tapEl(pg,'#t-lib')}
async function libRow(pg,re){const sel=await ev(pg,re=>{const r=[...document.querySelectorAll('#lib-list .lib-row')].find(x=>new RegExp(re,'i').test(x.textContent));if(!r)return null;r.id=r.id||'shlib-'+Math.random().toString(36).slice(2,8);return '#'+r.id},re);if(!sel)throw new Error('no library row '+re);await tapEl(pg,sel)}
async function canvasPts(pg,n=2){if(await is3D(pg)){const c=await ev(pg,()=>{const r=document.querySelector('#v3c').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,r.width]});return [[c[0]-c[2]*0.12,c[1]+20],[c[0]+c[2]*0.08,c[1]+40],[c[0],c[1]+80]].slice(0,n)}return emptyPts(pg,n)}
async function selectOne(pg){
  if(await is3D(pg)){const it=await item3D(pg);if(!it)throw new Error('no item on the 3D canvas');await pg.cvTap(it.x,it.y);await pg.waitForFunction(()=>window.__osp.sel().length>0,null,{timeout:3000}).catch(()=>{});return it}
  const it=(await findItems(pg,1))[0];if(!it)throw new Error('no item on screen');await pg.cvTap(it.x,it.y);await pg.waitForFunction(()=>window.__osp.sel().length>0,null,{timeout:3000}).catch(()=>{});return it}
async function ctxOn(pg,empty){
  let p;if(await is3D(pg)){p=empty?await empty3D(pg):await item3D(pg);if(p&&!Array.isArray(p))p=[p.x,p.y]}else{p=empty?(await emptyPts(pg,1))[0]:await findItems(pg,1).then(a=>a[0]&&[a[0].x,a[0].y])}
  if(!p)throw new Error("no point for the context menu");await pg.cvHold(p[0],p[1]);await pg.waitForFunction(()=>!document.querySelector('#ctxmenu').hidden,null,{timeout:3000}).catch(()=>{})}
async function makeUnderlay(pg){await ev(pg,async()=>{const o=window.__osp;if(o.S().underlay&&o.S().underlay.src)return;const c=document.createElement('canvas');c.width=800;c.height=600;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,800,600);g.strokeStyle='#000';g.lineWidth=8;g.strokeRect(100,100,600,400);g.beginPath();g.moveTo(400,100);g.lineTo(400,500);g.stroke();
  const bl=await new Promise(r=>c.toBlob(r,'image/png'));await o.loadUnder(new File([bl],'sh-under.png',{type:'image/png'}))});await pg.waitForFunction(()=>window.__osp.S().underlay&&window.__osp.S().underlay.src,null,{timeout:5000});await ev(pg,()=>window.__osp.toastOff())}
async function underBtn(pg,u){await makeUnderlay(pg);await openInspTab(pg,'und');await tapEl(pg,`#p-und [data-u="${u}"]`)}
/* a section line across a room (the usual case; it also keeps a finger tap on the line from panning) */
async function drawSection(pg){const r=await roomPt(pg);if(!r)throw new Error('no room point');await chooseTool(pg,'section');const a=[r.x,r.y],b2=[a[0]+(isPhone(pg)?90:200),a[1]];await pg.cvDrag(a,b2,10);
  await pg.waitForFunction(()=>window.__osp.S().section&&window.__osp.S().section.a,null,{timeout:3000});return [a,b2]}
async function exitToSelectByUI(pg){if(isPhone(pg)){if(await visible(pg,'#esc'))await tapEl(pg,'#esc');else await tapEl(pg,'#mbar [data-m=select]')}else await tapEl(pg,'.dock [data-tool=select]')}

const TOOLS=['pan','room','poly','spline','road','fence','shape-rect','shape-round','shape-L','shape-poly','measure','text','paint','trunk','section','pin'];
const toolOn=t=>`(()=>{const b=document.querySelector('.dock .btn.on[data-tool]');return !!b&&b.dataset.tool===${JSON.stringify(/^shape/.test(t)?'shape':t)}})()`;
const has=x=>`window.__LIVE().some(l=>l===${JSON.stringify(x)}||l.startsWith(${JSON.stringify(x)}))`;
/* the state inventory. where(su) says on which setups the state can exist; in3D:true runs it in 3D even on T. */
const STATES=[
  ...TOOLS.map(t=>({id:'tool-'+t,nm:`the ${t.replace('shape-','shape: ')} tool`,ck:'I1',where:su=>!(t==='pan'&&su.kind==='phone'),enter:pg=>chooseTool(pg,t),isIn:toolOn(t)})),
  {id:'line-walls',nm:'a half-drawn wall line',ck:'I1',enter:async pg=>{await chooseTool(pg,'poly');const p=await canvasPts(pg,2);for(const q of p)await pg.cvTap(q[0],q[1])},isIn:'(window.__osp.polyPts()||[]).length>=1'},
  {id:'line-curve',nm:'a half-drawn curve',ck:'I1',enter:async pg=>{await chooseTool(pg,'spline');const p=await canvasPts(pg,2);for(const q of p)await pg.cvTap(q[0],q[1])},isIn:'(window.__osp.polyPts()||[]).length>=1'},
  {id:'line-shape',nm:'a half-drawn polygon shape',ck:'I1',enter:async pg=>{await chooseTool(pg,'shape-poly');const p=await canvasPts(pg,2);for(const q of p)await pg.cvTap(q[0],q[1])},isIn:'(window.__osp.polyPts()||[]).length>=1'},
  {id:'placing',nm:'placing a library item',ck:'I1',enter:async pg=>{await openLib(pg);await libRow(pg,'^Task chair')},isIn:'!!document.querySelector(".lib-row.on")'},
  {id:'multi',nm:'Select several',ck:'I1',where:su=>su.kind!=='desk',enter:async pg=>{await ctxOn(pg,false);await tapEl(pg,'#ctxmenu [data-cm=multi]')},isIn:'!document.querySelector("#multibar").hidden'},
  {id:'ctx-item',nm:'the context menu on an item',ck:'I1',enter:pg=>ctxOn(pg,false),isIn:'!document.querySelector("#ctxmenu").hidden'},
  {id:'ctx-empty',nm:'the context menu on empty space',ck:'I1',enter:pg=>ctxOn(pg,true),isIn:'!document.querySelector("#ctxmenu").hidden'},
  {id:'selection',nm:'a selection',ck:'I1',enter:pg=>selectOne(pg),isIn:'window.__osp.sel().length>0'},
  {id:'pin-sel',nm:'a selected pin',ck:'I1',where:su=>!su.three,enter:async pg=>{await chooseTool(pg,'pin');const e=(await emptyPts(pg,1))[0];await pg.cvTap(e[0],e[1]);await ev(pg,()=>document.activeElement&&document.activeElement.blur());await hardResetKeep(pg);
    const pp=await ev(pg,()=>{const els=[...document.querySelectorAll('#plan [data-pin]')];const el=els[els.length-1];const r=el.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});await pg.cvTap(pp[0],pp[1]);await ev(pg,()=>document.activeElement&&document.activeElement.blur())},isIn:'!!window.__osp.pinSel()',after:pg=>ev(pg,()=>{const S=window.__osp.S();S.pins.pop();window.__osp.render()})},
  {id:'section-sel',nm:'a selected section line',ck:'I1',where:su=>!su.three,enter:async pg=>{const [a,b2]=await drawSection(pg);await hardResetKeep(pg);const m=[(a[0]+b2[0])/2,a[1]];await pg.cvTap(m[0],m[1])},isIn:'!!window.__osp.secSel()'},
  {id:'calibrate',nm:'calibrating the underlay',ck:'I1',where:su=>!su.three,enter:pg=>underBtn(pg,'cal'),isIn:has('mode:Calibrate')},
  {id:'under-move',nm:'moving the underlay',ck:'I1',where:su=>!su.three,enter:pg=>underBtn(pg,'move'),isIn:has('mode:Move underlay')},
  {id:'detect-box',nm:'the detect-walls box',ck:'I1',where:su=>!su.three,enter:pg=>underBtn(pg,'detect'),isIn:has('mode:Detect walls')},
  {id:'walk-pick',nm:'choosing where to start a walk',ck:'I1',enter:pg=>tapEl(pg,'#b-walk'),isIn:has('mode:Walk · step 1')},
  {id:'walk',nm:'Walk mode',ck:'I1',slow:true,enter:async pg=>{await tapEl(pg,'#b-walk');await pg.waitForFunction(()=>document.querySelector('#v3').hidden,null,{timeout:4000});const r=await roomPt(pg);if(!r)throw new Error('no room point');await pg.cvTap(r.x,r.y);
    await pg.waitForFunction(()=>window.__osp.WALK.on,null,{timeout:20000}).catch(()=>{});await sleep(300)},isIn:'window.__osp.WALK.on'},
  {id:'roof',nm:'roof mode',ck:'I1',swap:true,enter:async pg=>{await tapEl(pg,'#b-floor');await tapEl(pg,'#pop-floor [data-fl=roof]')},isIn:'window.__osp.roofMode()'},
  {id:'building',nm:'Building view',ck:'I1',slow:true,enter:async pg=>{await tapEl(pg,'#vbld');await pg.waitForFunction(()=>window.__osp.bldView()&&window.__osp.T3()&&window.__osp.T3().renderer,null,{timeout:20000});await sleep(300)},isIn:'window.__osp.bldView()'},
  {id:'section-on',nm:'a section slice in 3D',ck:'I1',in3D:true,where:su=>su.three||su.kind==='tab',slow:true,enter:async pg=>{await to2D(pg);await drawSection(pg);await hardResetKeep(pg);await to3D(pg);
    if(!(await ev(pg,()=>window.__osp.S().section.on)))await tapEl(pg,'#v3-sec')},isIn:'!document.querySelector("#v3").hidden&&window.__osp.S().section&&window.__osp.S().section.on'},
  {id:'sun',nm:'the sun study',ck:'I1',in3D:true,where:su=>su.three||su.kind==='tab',enter:pg=>tapEl(pg,'#v3-sun'),isIn:'window.__osp.SUN().on'},
  {id:'ceiling',nm:'the ceiling plan',ck:'I1',where:su=>!su.three,enter:async pg=>{if(isPhone(pg))await moreTile(pg,'t-rcp');else await tapEl(pg,'#t-rcp')},isIn:'!!window.__osp.P().rcp'},
  {id:'sheet-draw',nm:'the Draw sheet',ck:'I1',where:su=>su.kind==='phone',enter:pg=>tapEl(pg,'#mbar [data-m=draw]'),isIn:'!document.querySelector("#msheet").hidden'},
  {id:'sheet-more',nm:'the More sheet',ck:'I1',where:su=>su.kind==='phone',enter:pg=>tapEl(pg,'#mbar [data-m=more]'),isIn:'!document.querySelector("#msheet").hidden'},
  {id:'sheet-lib',nm:'the Library sheet',ck:'I1',where:su=>su.kind==='phone',enter:pg=>tapEl(pg,'#mbar [data-m=lib]'),isIn:'!document.querySelector("#d-lib").hidden'},
  {id:'sheet-insp',nm:'the Details sheet',ck:'I1',where:su=>su.kind==='phone',enter:pg=>tapEl(pg,'#mbar [data-m=insp]'),isIn:'!document.querySelector("#d-insp").hidden'},
  {id:'sheet-sched',nm:'the Schedule tab',ck:'I1',where:su=>su.kind==='phone',enter:pg=>openInspTab(pg,'sch'),isIn:'!document.querySelector("#d-insp").hidden&&!document.querySelector("#p-sch").hidden'},
  {id:'sheet-exits',nm:'the Exits check (menu)',ck:'I1',where:su=>su.kind==='phone',enter:pg=>moreTile(pg,'m-fire'),isIn:'!document.querySelector("#d-insp").hidden&&!document.querySelector("#p-fire").hidden'},
  {id:'menu',nm:'the main menu',ck:'I1',enter:pg=>openMenu(pg),isIn:'!document.querySelector("#pop-more").hidden'},
  {id:'version',nm:'the version info',ck:'I4',enter:pg=>openMenu(pg),isIn:'!document.querySelector("#pop-more").hidden&&document.querySelector("#m-ver").textContent.includes("StoreyBook "+window.__osp.APP_VERSION)&&document.querySelector("#m-ver").getBoundingClientRect().height>0'},
  {id:'settings',nm:'the settings popover',ck:'I1',enter:pg=>openSettings(pg),isIn:'!document.querySelector("#pop-set").hidden'},
  {id:'save-pop',nm:'the "how saving works" popover',ck:'I1',where:su=>su.kind!=='phone',enter:pg=>tapEl(pg,'#status'),isIn:'!document.querySelector("#pop-save").hidden'},
  {id:'layers',nm:'the Layers popover',ck:'I1',enter:async pg=>{if(isPhone(pg))await moreTile(pg,'t-layers');else{if(await is3D(pg))throw new Error('Layers button not on screen in 3D');await tapEl(pg,'#t-layers')}},where:su=>!(su.kind==='desk'&&su.three),isIn:'!document.querySelector("#pop-layers").hidden'},
  {id:'floors',nm:'the floor popover',ck:'I1',enter:pg=>tapEl(pg,'#b-floor'),isIn:'!document.querySelector("#pop-floor").hidden'},
  {id:'shape-pop',nm:'the shape picker',ck:'I1',enter:async pg=>{if(isPhone(pg)){await tapEl(pg,'#mbar [data-m=draw]');await tapEl(pg,'#msheet [data-pt=shape]')}else await tapEl(pg,'#t-shape')},isIn:'!document.querySelector("#pop-shape").hidden'},
  {id:'stl-pop',nm:'the Save STL popover',ck:'I1',in3D:true,where:su=>(su.three||su.kind==='tab')&&su.kind!=='phone',enter:pg=>tapEl(pg,'#v3-stl'),isIn:'!document.querySelector("#pop-stl").hidden'},
  {id:'keys',nm:'the keyboard shortcuts',ck:'I4',enter:pg=>menuItem(pg,'m-keys'),isIn:'!document.querySelector("#keys-modal").hidden'},
  {id:'guide',nm:'the user guide',ck:'I4',enter:async pg=>{if(isPhone(pg))await moreTile(pg,'m-guide');else await menuItem(pg,'m-guide')},isIn:'!document.querySelector("#guide-modal").hidden'},
  {id:'plans',nm:'My plans',ck:'I1',enter:async pg=>{if(isPhone(pg))await moreTile(pg,'m-plans');else await menuItem(pg,'m-plans');await sleep(250)},isIn:'!document.querySelector("#plans-modal").hidden'},
  {id:'snaps',nm:'Snapshots',ck:'I1',enter:async pg=>{if(isPhone(pg))await moreTile(pg,'m-snaps');else await menuItem(pg,'m-snaps')},isIn:'!document.querySelector("#snap-modal").hidden'},
  {id:'mig',nm:'the MIG table editor',ck:'I1',enter:async pg=>{await openSettings(pg);await tapEl(pg,'#mig-edit')},isIn:'!document.querySelector("#mig-modal").hidden'},
];
/* a reset that keeps what the state set up (pins, section line) */
async function hardResetKeep(pg){await ev(pg,()=>{const o=window.__osp,g=s=>document.querySelector(s);document.querySelectorAll('.pop').forEach(p=>p.hidden=true);if(!g('#msheet').hidden)g('[data-msheet-close]').click();o.setTool('select');o.setSel([]);o.setSecSel(false);
  const P=o.P();if(innerWidth<=820&&(P.lib||P.insp)){if(P.lib)g('#t-lib').click();if(P.insp)g('#t-insp').click()}o.toastOff()});await sleep(60)}

/* ---------------- the user agent: one step out, using only what this setup offers ---------------- */
const SCAN=()=>{const o=window.__osp,S=o.S(),g=s=>document.querySelector(s);const vis=e=>{if(!e||e.hidden||e.closest('[hidden]'))return false;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'};
  const h=g('#hint');const ht=h&&!h.hidden?(h.querySelector('b')||{}).textContent||'':'';const on=g('.dock .btn.on[data-tool]');
  return {modal:([...document.querySelectorAll('.keys-modal')].find(p=>!p.hidden)||{}).id||null,pop:([...document.querySelectorAll('.pop')].find(vis)||{}).id||null,msheet:vis(g('#msheet')),
    drawer:innerWidth<=820?(vis(g('#d-lib'))?'d-lib':vis(g('#d-insp'))?'d-insp':null):null,multibar:vis(g('#multibar')),pstrip:vis(g('#pstrip')),paintstrip:vis(g('#paintstrip')),esc:vis(g('#esc')),
    walk:o.WALK.on,walkPick:/^Walk · step 1/.test(ht),calib:/^Calibrate/.test(ht),underMove:/^Move underlay/.test(ht),detBox:/^Detect walls/.test(ht),
    rcp:!!o.P().rcp,sun:o.SUN().on,bld:o.bldView(),roof:o.roofMode(),secOn:!g('#v3').hidden&&!!(S.section&&S.section.on),tool:on?on.dataset.tool:'(none)',
    line:(o.polyPts()||[]).length,sel:o.sel().length,pin:!!o.pinSel(),sec:!!o.secSel(),is3D:!g('#v3').hidden}};
const CLOSE_OF={'keys-modal':'#keys-modal [data-kclose]','plans-modal':'#plans-modal [data-pclose]','guide-modal':'#guide-modal [data-gclose]','mig-modal':'#mig-cancel','snap-modal':'#snap-close'};
/* returns a description of the step taken, or null when there is nothing on screen to try */
async function stepOut(pg,how){const su=pg.su;const s=await ev(pg,SCAN);const tap=async(sel,why)=>{await tapEl(pg,sel);return why};
  const homeView=su.three?'#v3d':'#v2d';
  /* view modes: their own on-screen toggle, on every setup */
  const modes=async()=>{
    if(s.modal&&how!=='esc')return tap(CLOSE_OF[s.modal],'close '+s.modal);
    if(s.roof){await tapEl(pg,'#b-floor');return tap('#pop-floor [data-fl]:not([data-fl=roof]):not([data-fl=__manage])','floor chip → a level')}
    if(s.bld)return tap(homeView,'view button '+homeView);
    if(s.sun&&!s.pop&&!s.msheet)return tap('#v3-sun','Sun button');
    if(s.secOn&&!s.pop&&!s.msheet)return tap('#v3-sec','Section button');
    if(s.rcp&&!s.pop&&!s.modal&&!s.msheet&&!s.drawer){if(su.kind==='phone'){await tapEl(pg,'#mbar [data-m=more]');return tap('#msheet [data-pm=t-rcp]','More → Ceiling plan')}return tap('#t-rcp','Ceiling button')}
    return null};
  if(su.kind==='desk'){
    const transient=s.modal||s.pop||s.multibar||s.walk||s.walkPick||s.calib||s.underMove||s.detBox||s.tool!=='select'||s.line||s.sel||s.pin||s.sec;
    if(transient&&how!=='ui'){await pg.keyboard.press('Escape');await sleep(80);return 'Esc'}
    const m=await modes();if(m)return m;
    if(how==='ui'){if(s.multibar)return tap('#multi-done','Done (Select several)');if(s.pop){const e=s.is3D?await empty3D(pg):(await emptyPts(pg,1))[0];await pg.mouse.click(e[0],e[1]);await sleep(60);return 'click outside'}}
    return null}
  /* touch: phone and iPad */
  if(s.modal)return tap(CLOSE_OF[s.modal],'close ✕ '+s.modal);
  if(s.pop){let e=null;if(s.tool==='select')e=s.is3D?await empty3D(pg):(await emptyPts(pg,1))[0];if(e){await pg.uiTap(e[0],e[1]);await sleep(80);return 'tap outside (plan)'}return tap('.top .logo','tap outside (header)')}
  if(s.msheet)return tap('#msheet [data-msheet-close]','sheet grab handle');
  if(s.drawer)return tap(`#${s.drawer} .grab`,'drawer grab handle');
  if(s.multibar)return tap('#multi-done','Done (Select several)');
  if(s.pstrip)return tap('#pstrip-done','Done (placing strip)');
  if(s.paintstrip)return tap('#paintstrip-done','Done (paint strip)');
  if(s.walk)return tap(await visible(pg,'#b-walk')?'#b-walk':'#v3-walk','Walk button');
  if(s.esc)return tap('#esc','Cancel chip');
  if(su.kind==='tab'){
    if(s.calib&&await visible(pg,'#p-und [data-u=cancel]'))return tap('#p-und [data-u=cancel]','Underlay: Cancel');
    if(s.underMove&&await visible(pg,'#p-und [data-u=move]'))return tap('#p-und [data-u=move]','Underlay: Done moving');
    if(s.walkPick)return tap('#b-walk','Walk button');}
  const m=await modes();if(m)return m;
  if(s.tool!=='select'||s.walkPick||s.calib||s.underMove||s.detBox||s.line){if(su.kind==='phone')return tap('#mbar [data-m=select]','Select slot');return tap('.dock [data-tool=select]','dock Select')}
  if(s.sel||s.pin||s.sec){if(su.kind==='phone')return tap('#mbar [data-m=select]','Select slot');const e=s.is3D?await empty3D(pg):(await emptyPts(pg,1))[0];await pg.cvTap(e[0],e[1]);return 'Pencil tap on empty plan'}
  return null}
async function getOut(pg,how,max=4){const steps=[];for(let i=0;i<max;i++){const L=await live(pg);if(!L.length)break;let s;try{s=await stepOut(pg,how)}catch(e){steps.push('ERR '+e.message.split('\n')[0]);break}if(!s){steps.push('nothing on screen to try');break}steps.push(s);await sleep(50)}
  return {steps,left:await live(pg)}}

/* ---------------- result plumbing ---------------- */
function mk(){const R=[],ids=new Set();return {R,add:(id,nm,pass,detail)=>{if(ids.has(id))throw new Error('dup '+id);ids.add(id);R.push(row(id,nm,pass,detail))}}}
async function safe(A,id,nm,fn){if(ONLY&&!ONLY.test(id))return;const t0=Date.now();try{const r=await fn();A.add(id,nm,r.pass,r.detail)}catch(e){A.add(id,nm,false,'threw: '+String(e.message).split('\n')[0].slice(0,240))}if(process.env.SB_TRACE)console.error('  '+id+' '+(Date.now()-t0)+'ms')}

/* one state × one setup × one way out */
async function stateCheck(pg,stx,how){
  await hardReset(pg);if(stx.in3D)await to3D(pg);
  const L0=await live(pg);if(L0.length)return {pass:false,detail:{why:'start not plain',L0}};const n0=await nObjs(pg);const p0=await ev(pg,()=>window.__osp.past());
  await stx.enter(pg);await sleep(60);
  const inn=await ev(pg,'(()=>{window.__LIVE=window.__LIVE||('+LIVE.toString()+');return '+stx.isIn+'})()');
  if(!inn){const L=await live(pg);if(stx.after)await stx.after(pg);return {pass:false,detail:{why:'could not enter the state',live:L}}}
  const n1=await nObjs(pg);const out=await getOut(pg,how);const n2=await nObjs(pg);
  if(stx.after)await stx.after(pg);
  /* put back anything the exit created, so later checks start from the same plan */
  await ev(pg,p0=>{const o=window.__osp;let g=0;while(o.past()>p0&&g++<10)o.undo()},p0);
  /* a cancel must not create or delete anything (pins / section are not objects; roof mode swaps in the roof's own objects) */
  const pass=out.left.length===0&&n2===n0&&(stx.swap||n1===n0);
  return {pass,detail:{steps:out.steps,left:out.left,n:[n0,n1,n2]}}}

/* =============== I1 / I4: every state, every setup =============== */
// mutation: escapeAction `...else{sel.clear();render();renderInspector()}` → `...else{render();renderInspector()}` → FAIL confirmed (mx-sh-i1-selection-d2, ctx-item-d2)
// mutation: escapeAction `else if(tool!=='select')setTool('select');` → `else if(false)...` → FAIL confirmed (tool-room-d2, tool-measure-d2, tool-room-p2, tool-measure-p2)
// mutation: mbar `if(k==='select'){msheet(null);` → `{return;...` → FAIL confirmed (mx-sh-i1-selection-p2)
// mutation: keydown guide `if(e.key==='Escape')$('#guide-modal').hidden=true;` removed → FAIL confirmed (mx-sh-i4-guide-d2; guide-d2-ui stays green, as it should: ✕ still works)
// mutation: msheet `if(e.target.closest('[data-msheet-close]')){msheet(null);return}` → `{return}` → FAIL confirmed (sheet-draw-p2, sheet-more-p2)
// mutation: walk keydown `if(k==='escape'){e.preventDefault();walkStop();return}` → no walkStop → FAIL confirmed (mx-sh-i1-walk-d2)
// mutation: close-popovers pointerdown `if(!e.target.closest('.pop')&&` → `if(false&&...` → FAIL confirmed (mx-sh-i1-menu-p2); menu-d2-ui stays green (the plan's own pointerdown also closes menus)
// mutation: `$('#v3-sun')` handler `SUN.on=!SUN.on` → `SUN.on=true` → FAIL confirmed (mx-sh-i1-sun-d3, sun-p3)
// mutation: `$('#v3d')` click → no-op → FAIL confirmed (Building view on D3 cannot be left; shows as mx-sh-crash-d3 because every later reset needs 3D)
// mutation: select pointerdown `if(secSel){secSel=false}` + `if(sel.size)return;` → FAIL confirmed (mx-sh-i1-selection-t: Pencil tap on empty no longer clears)
async function statesFor(pg,A){const su=pg.su;
  for(const stx of STATES){if(stx.where&&!stx.where(su))continue;
    const grp=stx.ck==='I4'?'i4':'i1';
    const how=su.kind==='desk'?'esc':'touch';
    await safe(A,`mx-sh-${grp}-${stx.id}-${su.id}`,`${su.nm}: get out of ${stx.nm} back to plain Select (${su.kind==='desk'?'Esc':'on-screen controls'})`,()=>stateCheck(pg,stx,how));
    /* desktop also: the close button / clicking elsewhere for modals, popovers and Select several */
    if(su.kind==='desk'&&/^(keys|guide|plans|snaps|mig|menu|settings|save-pop|layers|floors|shape-pop|stl-pop|ctx-item|ctx-empty|version)$/.test(stx.id))
      await safe(A,`mx-sh-${grp}-${stx.id}-${su.id}-ui`,`${su.nm}: close ${stx.nm} with the mouse (✕, Done or click elsewhere)`,()=>stateCheck(pg,stx,'ui'));
  }}

/* phone extras: other on-screen ways out of sheets and selections */
// mutation: grab pull `if(dy>70){const id=g.dataset.close;` → `if(dy>7000){` → FAIL confirmed (mx-sh-i1-pull-lib-p2, pull-insp-p2)
// mutation: touch pan end `(sel.size||pinSel)&&Math.hypot(...)<8` → `false&&Math.hypot(...)<8` → FAIL confirmed (mx-sh-i1-sel-tapempty-p2)
// mutation: mbar `if(k==='select'){msheet(null);` → `if(k==='select'){return;msheet(null);` → FAIL confirmed (all four mx-sh-i1-sheet-*-p2-slot)
async function phoneExtras(pg,A){const su=pg.su;if(su.kind!=='phone')return;
  for(const [id,nm,slot] of [['sheet-draw','the Draw sheet','draw'],['sheet-more','the More sheet','more'],['sheet-lib','the Library sheet','lib'],['sheet-insp','the Details sheet','insp']])
    await safe(A,`mx-sh-i1-${id}-${su.id}-slot`,`${su.nm}: the Select slot closes ${nm}`,async()=>{await hardReset(pg);await tapEl(pg,`#mbar [data-m=${slot}]`);const a=await live(pg);await tapEl(pg,'#mbar [data-m=select]');await sleep(120);const b=await live(pg);return {pass:a.length>0&&b.length===0,detail:{open:a,after:b}}});
  for(const dr of ['lib','insp'])
    await safe(A,`mx-sh-i1-pull-${dr}-${su.id}`,`${su.nm}: pulling the ${dr==='lib'?'Library':'Details'} sheet down by its handle closes it`,async()=>{await hardReset(pg);await tapEl(pg,`#mbar [data-m=${dr}]`);const a=await visible(pg,'#d-'+dr);
      const g=await ptOf(pg,`#d-${dr} .grab`);if(g.err)return {pass:false,detail:g};await pg.fin.drag([g.x,g.y],[g.x,g.y+160],10);await sleep(350);const b=await live(pg);return {pass:a&&b.length===0,detail:{open:a,after:b}}});
  await safe(A,`mx-sh-i1-sel-tapempty-${su.id}`,`${su.nm}: tapping empty space clears a selection`,async()=>{await hardReset(pg);await selectOne(pg);await hardResetKeepSel(pg);const a=await ev(pg,()=>window.__osp.sel().length);
    const e=su.three?await empty3D(pg):(await emptyPts(pg,1))[0];await pg.fin.tap(e[0],e[1]);await sleep(150);const b=await live(pg);return {pass:a>0&&b.length===0,detail:{a,after:b}}});
}
async function hardResetKeepSel(pg){await ev(pg,()=>{const o=window.__osp,g=s=>document.querySelector(s),P=o.P();if(innerWidth<=820&&(P.lib||P.insp)){if(P.lib)g('#t-lib').click();if(P.insp)g('#t-insp').click()}o.toastOff()});await sleep(60)}

/* desktop: clicking empty plan clears a selection; the ? key opens shortcuts */
// mutation: keydown `if(e.key==='?'){e.preventDefault();openKeys();return}` → `{e.preventDefault();return}` → FAIL confirmed (mx-sh-i4-keys-qkey-d2)
// mutation: pointerdown `const addKey=addMod(ev);if(!addKey)sel.clear();` → `const addKey=addMod(ev);` → FAIL confirmed (mx-sh-i1-sel-clickempty-d2)
async function deskExtras(pg,A){const su=pg.su;if(su.kind!=='desk')return;
  await safe(A,`mx-sh-i1-sel-clickempty-${su.id}`,`${su.nm}: clicking empty space clears a selection`,async()=>{await hardReset(pg);await selectOne(pg);const a=await ev(pg,()=>window.__osp.sel().length);
    const e=su.three?await empty3D(pg):(await emptyPts(pg,1))[0];await pg.mouse.click(e[0],e[1]);await sleep(150);const b=await live(pg);return {pass:a>0&&b.length===0,detail:{a,after:b}}});
  await safe(A,`mx-sh-i4-keys-qkey-${su.id}`,`${su.nm}: the ? key opens the shortcuts and Esc closes them`,async()=>{await hardReset(pg);await pg.keyboard.press('Shift+Slash');await sleep(150);const a=await visible(pg,'#keys-modal');await pg.keyboard.press('Escape');await sleep(100);const b=await live(pg);return {pass:a&&b.length===0,detail:{open:a,after:b}}});
}

/* =============== I2: every visible control does something or is disabled =============== */
const SIG=()=>{const o=window.__osp,S=o.S(),g=s=>document.querySelector(s);
  const h=str=>{let x=2166136261;for(let i=0;i<str.length;i++){x^=str.charCodeAt(i);x=Math.imul(x,16777619)}return (x>>>0).toString(36)};
  const vis=e=>{if(!e||e.hidden||e.closest('[hidden]'))return false;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'};
  
  const t3=o.T3();const cam=t3&&t3.camera?[t3.camera.position.x,t3.camera.position.y,t3.camera.position.z,t3.camera.fov].map(v=>Math.round(v*100)).join(','):'';
  const parts={plan:h(JSON.stringify([S.objs,S.locked,S.name,S.section,S.pins,S.bld,S.style,S.notes,S.fire])),P:h(JSON.stringify(o.P())),V:[o.V.x,o.V.y,o.V.k].map(v=>Math.round(v*1000)).join(','),sel:o.sel().join(','),pin:String(o.pinSel()),sec:String(o.secSel()),
    main:h(g('#main').innerHTML),hdr:h(g('header').innerHTML),tabs:h(g('#ptabs').innerHTML),toast:g('#toast').hidden?'':g('#toast').textContent,cls:document.documentElement.className+'|'+(document.documentElement.dataset.theme||'')+'|'+document.body.className,
    sfp:window.__sfp,cam,sun:JSON.stringify(o.SUN()),walk:o.WALK.on,bld:o.bldView(),past:o.past(),fut:o.future(),/* focus is not an effect: tapping any button focuses it */
    pops:[...document.querySelectorAll('.pop,.keys-modal,#msheet,#d-lib,#d-insp,#v3')].filter(vis).map(e=>e.id).join(',')};
  return parts};
const sigDiff=(a,b)=>Object.keys(a).filter(k=>a[k]!==b[k]);
/* restore after a control: close everything, undo any edits it made, close extra tabs, restore prefs */
async function restore(pg,base){
  await ev(pg,b=>{const o=window.__osp;const cf=window.confirm;window.confirm=()=>true;try{while(o.tabsRaw().length>b.tabs){const t=o.tabsRaw()[o.tabsRaw().length-1];if(t===o.curTab()&&o.tabsRaw().length>1)o.closeTab(t);else o.closeTab(t)}}finally{window.confirm=cf}
    const cur=o.tabsRaw().find(t=>t.id===b.cur);if(cur&&cur!==o.curTab()){const el=document.querySelector(`#ptabs [data-tab="${b.cur}"],#ptabs [data-tid="${b.cur}"]`);if(el)el.click()}},base);
  await hardReset(pg);
  await ev(pg,b=>{const o=window.__osp;let g=0;while(o.past()>b.past&&g++<20)o.undo();const P=o.P();Object.keys(P).forEach(k=>{if(!(k in b.P))delete P[k]});Object.assign(P,JSON.parse(JSON.stringify(b.P)));
    const th=P.theme;if(th==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=th;o.render()},base)}
async function baseOf(pg){return ev(pg,()=>{const o=window.__osp;return {past:o.past(),P:JSON.parse(JSON.stringify(o.P())),tabs:o.tabsRaw().length,cur:o.curTab().id}})}
/* tap one control and report what changed */
/* controls that act relative to the current view need a start where they have something to do */
const CPREP={'z-fit':pg=>ev(pg,()=>{document.querySelector('#z-in').click();document.querySelector('#z-in').click()}),'v3-persp':pg=>ev(pg,()=>document.querySelector('#v3-top').click()).then(()=>sleep(400)),
  'bld-north-up':pg=>ev(pg,()=>window.__osp.setNorth(30))};
async function tryControl(pg,c,prep){
  await hardReset(pg);if(prep)await prep(pg);if(CPREP[c.key])await CPREP[c.key](pg);await sleep(60);
  const sel=await ev(pg,`(${FIND})(${JSON.stringify(c.q)},${JSON.stringify(c.key)})`);if(!sel)return {pass:false,detail:'control not on screen after the same start: '+c.key};
  const meta=await ev(pg,sel=>{const e=document.querySelector(sel);if(!e)return null;return {dis:!!e.disabled||e.getAttribute('aria-disabled')==='true',tag:e.tagName,type:e.type||'',opts:e.tagName==='SELECT'?[...e.options].map(o=>o.value):null,val:e.value,lab:(e.textContent||e.getAttribute('aria-label')||e.title||'').trim().slice(0,30),on:e.classList.contains('on')||e.getAttribute('aria-pressed')==='true'||e.getAttribute('aria-selected')==='true'}},sel);
  if(!meta)return {pass:false,detail:'control vanished before the tap: '+sel};
  if(meta.dis)return {pass:true,detail:{disabled:true,lab:meta.lab}};
  const base=await baseOf(pg);
  /* in 3D the scene keeps settling (camera damping, the north widget): what changes on its own is noise, not an effect */
  let noise=[];if(await is3D(pg)){const a=await ev(pg,SIG);await sleep(150);noise=sigDiff(a,await ev(pg,SIG))}
  const s0=await ev(pg,SIG);const sig0=JSON.stringify(pg.sig);const e0=pg.errs.length;
  if(meta.tag==='SELECT'){const v=meta.opts.find(x=>x!==meta.val);await pg.locator(sel).selectOption(v)}
  else if(meta.type==='range'){await ev(pg,()=>window.__osp.toastOff());const p=await ptOf(pg,sel);if(p.err)return {pass:false,detail:p};const w=await ev(pg,sel=>document.querySelector(sel).getBoundingClientRect().width,sel);await pg.uiTap(p.x-w*0.3,p.y)}
  else if(meta.type==='number'||meta.type==='time'||meta.type==='text'||meta.type==='search'){await tapEl(pg,sel);await pg.locator(sel).fill(meta.type==='time'?'08:30':meta.type==='number'?String((+meta.val||0)+5):'chair');await pg.locator(sel).press('Enter').catch(()=>{});await pg.locator(sel).dispatchEvent('change')}
  else await tapEl(pg,sel);
  await sleep(150);meta.stillOn=await ev(pg,sel=>{const e=document.querySelector(sel);return !!e&&(e.classList.contains('on')||e.getAttribute('aria-pressed')==='true')},sel);let s1=await ev(pg,SIG);let d=sigDiff(s0,s1).filter(k=>!noise.includes(k));
  if(!d.length&&JSON.stringify(pg.sig)===sig0){await sleep(600);s1=await ev(pg,SIG);d=sigDiff(s0,s1).filter(k=>!noise.includes(k))}/* async effects (image export, file save) */const sigChanged=JSON.stringify(pg.sig)!==sig0;
  const err=pg.errs.length>e0?pg.errs.slice(e0):null;await restore(pg,base);
  /* a mode button that already shows the current mode (Select slot in Select, the open tab) may do nothing, as long as it stays on */
  return {pass:(d.length>0||sigChanged||(meta.on&&meta.stillOn))&&!err,detail:{lab:meta.lab,changed:d,alreadyOn:meta.on||undefined,events:sigChanged?JSON.stringify(pg.sig):undefined,err}}}
/* the groups of controls, per setup; listed from the live DOM */
const LIST=()=>{const vis=e=>{if(!e||e.hidden||e.closest('[hidden]'))return false;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'};
  return (window.__SHSEL||'').split('|').flatMap(q=>[...document.querySelectorAll(q)]).filter(vis)};
/* label used to re-find a control after the panel re-renders */
const LAB=e=>(e.id||e.dataset.tool||e.dataset.m||e.dataset.pt||e.dataset.pm||e.dataset.tab||e.dataset.sunp||e.dataset.u||e.dataset.fl||(e.textContent||'').trim().replace(/\W+/g,'_').slice(0,18)||e.tagName).toString().replace(/[^\w-]/g,'_');
const FIND=`(q,lab)=>{window.__SHSEL=q;const LIST=${LIST.toString()},LAB=${LAB.toString()};const l=LIST();const e=l.find(x=>LAB(x)===lab);if(!e)return null;e.dataset.shc=lab;return '[data-shc="'+lab+'"]'}`;
async function listControls(pg,q,prep){await hardReset(pg);if(prep)await prep(pg);await sleep(80);
  const labs=await ev(pg,`(()=>{window.__SHSEL=${JSON.stringify(q)};const LIST=${LIST.toString()},LAB=${LAB.toString()};return LIST().map(LAB)})()`);
  return [...new Set(labs)].map(k=>({q,key:k}))}
const GROUPS=[
  {g:'hdr',nm:'header',where:()=>true,q:'header.top button|header.top select|#ptabs #ptab-add'},
  {g:'tabx',nm:'plan tab close',where:su=>!su.three,q:'#ptabs .x',prep:async pg=>{await ev(pg,()=>{const o=window.__osp;if(o.tabsRaw().length<2)document.querySelector('#ptab-add').click()})},pick:l=>l.slice(0,1)},
  {g:'dock',nm:'dock',where:su=>su.kind!=='phone',q:'.dock button'},
  {g:'mbar',nm:'bottom bar',where:su=>su.kind==='phone',q:'#mbar [data-m]'},
  {g:'draw',nm:'Draw sheet',where:su=>su.kind==='phone',q:'#msheet [data-pt]',prep:pg=>tapEl(pg,'#mbar [data-m=draw]')},
  {g:'more',nm:'More sheet',where:su=>su.kind==='phone',q:'#msheet [data-pm]',prep:pg=>tapEl(pg,'#mbar [data-m=more]')},
  {g:'menu',nm:'main menu',where:su=>!su.three,q:'#pop-more button',prep:pg=>openMenu(pg)},
  {g:'v3',nm:'3D bar',where:su=>su.three||su.kind==='tab',in3D:true,q:'#v3 .v3bar button|#v3 .v3bar select|#v3 .v3bar input'},
  {g:'sun',nm:'sun bar',where:su=>su.three||su.kind==='tab',in3D:true,q:'#sun-bar button|#sun-bar select|#sun-bar input',prep:async pg=>{if(!(await ev(pg,()=>window.__osp.SUN().on)))await tapEl(pg,'#v3-sun')}},
  {g:'insp-tabs',nm:'Details tabs',where:su=>!su.three,q:'#d-insp [data-tab]',prep:pg=>openInspTab(pg,'notes')},
  /* panel buttons: D2 and P2 (the iPad uses the same desktop panel as D2) */
  ...['sel','sch','und','bld','notes','fire'].map(t=>({g:'insp-'+t,nm:`Details › ${t} tab`,where:su=>!su.three&&su.kind!=='tab',q:`#p-${t} button`,
    prep:async pg=>{if(t==='sel')await selectOne(pg);if(t==='und')await makeUnderlay(pg);await openInspTab(pg,t);await sleep(80)}})),
];
// mutation: `$('#z-in').addEventListener('click',()=>zoomAt(1.25,W/2,H/2));` removed → FAIL confirmed (mx-sh-i2-menu-z-in-d2)
// mutation: `$('#v3-top').addEventListener('click',()=>frame3D('top'));` removed → FAIL confirmed (mx-sh-i2-v3-v3-top-d3) (needed the 3D noise filter)
// mutation: mbar `if(k==='more'){msheet('more');return}` → `if(k==='more'){return}` → FAIL confirmed (mx-sh-i2-mbar-more-p2)
// mutation: sun bar `[data-sunp]` handler returns early → FAIL confirmed (mx-sh-i2-sun-jun-d3, sun-dec-d3)
// mutation: `$('#b-lock')` handler returns first → FAIL confirmed (mx-sh-i2-hdr-b-lock-d2)
// mutation: dock `$$('.dock [data-tool]').forEach(...setTool...)` removed → FAIL confirmed (mx-sh-i2-dock-room-t, dock-pin-t, i1-tool-room-t)
/* SB_SHELL=full sweeps every group on every setup (~15-40 min); the default gate run sweeps D2 and P2 (the two shells),
   plus the 3D bar on D3 and the dock on T, to stay near the runtime budget */
const FULL=process.env.SB_SHELL==='full';
const QUICK_GROUPS={d2:null,p2:null,d3:['v3'],p3:[],t:['dock']};
async function controlsFor(pg,A){const su=pg.su;
  for(const G of GROUPS){if(!G.where(su))continue;if(!FULL&&QUICK_GROUPS[su.id]&&!QUICK_GROUPS[su.id].includes(G.g))continue;if(ONLY&&!ONLY.test(`mx-sh-i2-${G.g}-`)&&!ONLY.source.includes(`i2-${G.g}-`))continue;
    const prep=async pg=>{if(G.in3D)await to3D(pg);if(G.prep)await G.prep(pg)};
    let list;try{list=await listControls(pg,G.q,prep)}catch(e){A.add(`mx-sh-i2-${G.g}-${su.id}-list`,`${su.nm}: list the ${G.nm} controls`,false,'threw: '+e.message.split('\n')[0]);continue}
    if(G.pick)list=G.pick(list);
    if(!list.length&&/^insp-/.test(G.g))continue;/* a panel with no buttons in this state (Notes) */
    if(!list.length){A.add(`mx-sh-i2-${G.g}-${su.id}-list`,`${su.nm}: the ${G.nm} has controls on screen`,false,'none visible');continue}
    const seen=new Set();
    for(const c of list){const k=c.key;seen.add(k);
      await safe(A,`mx-sh-i2-${G.g}-${k}-${su.id}`,`${su.nm}: ${G.nm} control "${k}" does something`,()=>tryControl(pg,c,prep))}}}

/* =============== I3: settings apply and persist =============== */
/* each setting: set(v) through the popover with real input, effect() reads its observable result in the page */
const SETTINGS=[
  {id:'grid',sel:'#s-grid',to:'2000',eff:async()=>{/* a big plan with an underlay can take a few frames to redraw */for(let i=0;i<20;i++){await new Promise(r=>requestAnimationFrame(()=>r()));if(document.querySelector('#gp-minor').getAttribute('width')===String(window.__osp.P().grid))break;await new Promise(r=>setTimeout(r,50))}return document.querySelector('#gp-minor').getAttribute('width')}},
  {id:'snap',sel:'#s-snap',chk:true,eff:'nudge'},
  {id:'snapsz',sel:'#s-snapsz',to:'250',pre:{snap:true},eff:'nudge'},
  {id:'osnap',sel:'#s-osnap',chk:true,pre:{osnap:true,ortho:false},eff:'osnap'},
  {id:'ortho',sel:'#s-ortho',chk:true,pre:{osnap:false,ortho:true},eff:'ortho'},
  {id:'dims',sel:'#s-dims',to:'all',eff:()=>document.querySelectorAll('#plan text').length},
  {id:'mig',sel:'#s-mig',chk:true,eff:()=>document.querySelectorAll('#plan [class*="mig"]').length},
  {id:'clash',sel:'#s-clash',chk:true,eff:()=>document.querySelectorAll('#plan .clash').length},
  {id:'wall',sel:'#s-wall',to:'300',eff:()=>document.querySelector('#L-rooms').innerHTML.length+'/'+(document.querySelector('#plan [data-id]')&&document.querySelector('#L-rooms').innerHTML.match(/stroke-width="([\d.]+)"/g)||[]).join()},
  {id:'inv',sel:'#s-inv',chk:true,pre:{theme:'dark',inv:false},under:true,eff:()=>{const u=document.querySelector('#under-img');return u.style.filter+'|'+u.style.display+'|'+document.documentElement.dataset.theme+'|'+!!(window.__osp.S().underlay&&window.__osp.S().underlay.src)}},
  {id:'theme-dark',sel:'#s-theme',to:'dark',pre:{theme:'light'},eff:()=>document.documentElement.dataset.theme+'|'+getComputedStyle(document.body).backgroundColor},
  {id:'theme-light',sel:'#s-theme',to:'light',pre:{theme:'dark'},eff:()=>document.documentElement.dataset.theme+'|'+getComputedStyle(document.body).backgroundColor},
  {id:'fill',sel:'#s-fill',to:'outline',eff:()=>document.body.classList.contains('fill-outline')+'|'+getComputedStyle(document.querySelector('#L-items .it .b')||document.body).fill},
  {id:'lbl',sel:'#s-lbl',to:'code',eff:'zoomed',fn:()=>{const t=[...document.querySelectorAll('#plan text.it-lbl')].map(x=>x.textContent);const codes=new Set(window.__osp.S().objs.map(o=>o.code));return !t.length?'no labels':t.every(x=>codes.has(x))?'codes':'names'}},
  {id:'col-wall',sel:'.cpick[data-cp="plan-wall"] [data-cval]:not([data-cval=""])',btn:true,eff:()=>JSON.stringify(window.__osp.S().style||null)},
  {id:'col-floor',sel:'.cpick[data-cp="plan-floor"] [data-cval]:not([data-cval=""])',btn:true,eff:()=>JSON.stringify(window.__osp.S().style||null)},
];
async function effectOf(pg,s){
  if(s.eff==='nudge'){/* arrow-key nudge distance = snap size when snap is on, else 10 mm */
    const it=(await findItems(pg,1))[0];if(!it)return 'no item on screen';await pg.mouse.click(it.x,it.y);await sleep(60);const id=await ev(pg,i=>{const s=window.__osp.sel();return s.includes(i)?i:s.find(x=>{const o=window.__osp.byId(x);return o&&typeof o.x==='number'})},it.id);if(!id)return 'nothing selected';const x0=await ev(pg,id=>window.__osp.S().objs.find(o=>o.id===id).x,id);await pg.keyboard.press('ArrowRight');await sleep(60);
    const x1=await ev(pg,id=>window.__osp.S().objs.find(o=>o.id===id).x,id);await ev(pg,moved=>{if(moved)window.__osp.undo();window.__osp.setSel([])},x1!==x0);return 'dx='+(x1-x0)}
  if(s.eff==='osnap'){/* hover the room tool just off a room corner: object snap pulls the marker onto the corner */
    const c=await ev(pg,()=>{const o=window.__osp,S=o.S(),V=o.V,r=document.querySelector('#plan').getBoundingClientRect();const rm=S.objs.find(x=>x.t==='room'&&x.name==='Meeting room');const p=rm.pts[0];return [r.left+(p[0]-V.x)*V.k+5,r.top+(p[1]-V.y)*V.k+4]});
    await ev(pg,()=>window.__osp.setTool('room'));await pg.mouse.move(c[0]-30,c[1]-30);await pg.mouse.move(c[0],c[1],{steps:3});await sleep(80);const ov=await ev(pg,()=>document.querySelector('#L-over').innerHTML.replace(/\s+/g,''));await ev(pg,()=>window.__osp.setTool('select'));return ov}
  if(s.eff==='zoomed'){/* labels only draw when items are big enough: zoom in with the + button, read, fit again */
    await ev(pg,()=>{for(let i=0;i<5;i++)document.querySelector('#z-in').click()});await sleep(80);const r=await ev(pg,s.fn);await ev(pg,()=>document.querySelector('#z-fit').click());await sleep(40);return r}
  if(s.eff==='ortho'){/* walls drawn about 1.5° off horizontal (7 px over 260, inside the 2° ortho band, more than one snap step) come out level with ortho on */
    const n0=await nObjs(pg);const e=(await emptyPts(pg,1))[0];await ev(pg,()=>window.__osp.setTool('poly'));await pg.mouse.click(e[0],e[1]);await sleep(40);await pg.mouse.click(e[0]+260,e[1]+7);await sleep(40);await pg.keyboard.press('Enter');await sleep(80);
    const w=await ev(pg,n0=>{const o=window.__osp.S().objs.slice(n0)[0];return o&&o.pts?o.pts.slice(0,2):null},n0);if(await nObjs(pg)>n0)await ev(pg,()=>window.__osp.undo());await ev(pg,()=>window.__osp.setTool('select'));return w?'dy='+(w[1][1]-w[0][1]):'no wall'}
  /* screen effects on a big plan can land a frame or two after the change */
  await ev(pg,()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,120)))));return ev(pg,s.eff)}
async function setSetting(pg,s){await openSettings(pg);
  if(s.btn){const p=await ptOf(pg,s.sel);if(p.err)throw new Error(s.sel+': '+p.err);await pg.uiTap(p.x,p.y)}
  else if(s.chk){const p=await ptOf(pg,s.sel);let tgt=s.sel;if(p.err){const id=s.sel;tgt=await ev(pg,id=>{const l=document.querySelector(id).closest('label');l.id=l.id||'shl-'+id.slice(1);return '#'+l.id},id)}await tapEl(pg,tgt)}
  else await pg.locator(s.sel).selectOption(s.to);
  await sleep(120);await ev(pg,()=>document.querySelectorAll('.pop').forEach(p=>p.hidden=true))}
const readSetting=(pg,s0)=>ev(pg,s=>{const e=document.querySelector(s.sel);return s.btn?JSON.stringify(window.__osp.S().style||null):s.chk?e.checked:e.value},{sel:s0.sel,btn:!!s0.btn,chk:!!s0.chk});
/* set preferences a check depends on, and show them in the popover so the control starts from the same value */
const setPre=(pg,pre)=>ev(pg,pre=>{const o=window.__osp,P=o.P();Object.assign(P,pre);if(pre.theme)document.documentElement.dataset.theme=pre.theme;
  const M={'#s-snap':'snap','#s-osnap':'osnap','#s-ortho':'ortho','#s-theme':'theme','#s-snapsz':'snapSize','#s-grid':'grid','#s-dims':'dims','#s-clash':'clash','#s-wall':'wall','#s-fill':'fill','#s-lbl':'lbl','#s-inv':'inv'};
  Object.entries(M).forEach(([id,k])=>{const e=document.querySelector(id);if(e.type==='checkbox')e.checked=!!P[k];else e.value=String(P[k])});document.querySelector('#s-mig').checked=!!(P.mig&&P.mig.on);o.render()},pre||{});
// mutation (one mutant per setting; each deletes that setting's bindSet(...) call in app.js menus & settings) → FAIL confirmed for:
//   grid, snap, snapsz, osnap, ortho, dims, clash, wall, theme (theme-dark and theme-light), fill, lbl, inv;
//   mig: `$('#s-mig').addEventListener('change',` → `('x-change',` → FAIL confirmed; colours: cpick click `applyColor(id,b.dataset.cval||null,false)` removed → FAIL col-wall, col-floor;
//   persistence: `const savePrefs=()=>store.set('osp-prefs',JSON.stringify(P));` → `const savePrefs=()=>0;` → FAIL grid-, wall-, fill-persist (sample run);
//   phone: `bindSet('#s-theme','theme');` removed → FAIL mx-sh-i3-theme-p2.
async function settingsChecks(b,A,pg){
  if(ONLY&&!SETTINGS.some(x=>ONLY.test(`mx-sh-i3-${x.id}-d2`)||ONLY.test(`mx-sh-i3-${x.id}-persist-d2`)))return;
  const res={};
  {/* a fresh sample plan in its own tab: earlier checks on this page may have changed the current one */
    await hardReset(pg);await ev(pg,()=>document.querySelector('#m-sample').click());await pg.waitForFunction(()=>window.__osp.S().objs.length>100&&!window.__osp.S().underlay,null,{timeout:5000});pg.view=null;await hardReset(pg);
    /* preconditions for observable effects: an MIG rank in a room name, an overlapping desk, an underlay */
    await ev(pg,()=>{const o=window.__osp,S=o.S();const r=S.objs.find(x=>x.t==='room'&&x.name==='Private office 1');r.name='COL Private office';const d=S.objs.find(x=>x.t==='item'&&/^WS/.test(x.code));S.objs.push(Object.assign({},d,{id:'shclash',x:d.x+150,gid:null}));
      const P=o.P();P.snap=false;P.osnap=false;P.ortho=false;P.clash=false;P.mig=Object.assign({},P.mig||{},{on:false});document.querySelector('#s-mig').checked=false;P.dims='sel';P.theme='light';document.documentElement.dataset.theme='light';o.render()});
    await makeUnderlay(pg);
    for(const s of SETTINGS){
      await safe(A,`mx-sh-i3-${s.id}-d2`,`desktop: setting "${s.id}" applies`,async()=>{await hardReset(pg);await setPre(pg,s.pre);const v0=await readSetting(pg,s);const e0=await effectOf(pg,s);await setSetting(pg,s);const v1=await readSetting(pg,s);const e1=await effectOf(pg,s);
        res[s.id]={v1,e1,e0};return {pass:v1!==v0&&e1!==e0,detail:{v0,v1,e0:String(e0).slice(0,80),e1:String(e1).slice(0,80)}}})}
    /* what every setting reads now (later checks' preconditions change some), then autosave and reload in the same browser */
    await hardReset(pg);for(const s of SETTINGS)if(res[s.id]){let e=String(await effectOf(pg,s));if(/^(nothing selected|no item)/.test(e)){await hardReset(pg);e=String(await effectOf(pg,s))}res[s.id]={v1:await readSetting(pg,s),e1:e,e0:res[s.id].e0}}
    await ev(pg,()=>window.__osp.markDirty());await pg.waitForFunction(()=>{try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/osp/.test(k)&&/COL Private office/.test(localStorage.getItem(k)||''))return true}}catch(e){}return false},null,{timeout:6000}).catch(()=>{});
    await sleep(400);await pg.reload({waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S&&window.__osp.S().objs.length>100,null,{timeout:20000}).catch(()=>{});await sleep(300);
    for(const s of SETTINGS){if(s.id==='theme-dark')continue;/* theme-light ran last and owns the persisted theme */
      await safe(A,`mx-sh-i3-${s.id}-persist-d2`,`desktop: setting "${s.id}" is still set after a reload`,async()=>{if(!res[s.id])return {pass:false,detail:'did not apply'};await hardReset(pg);await ev(pg,()=>{document.querySelectorAll('.pop').forEach(p=>p.hidden=true);window.__osp.setSel([])});
        await ev(pg,()=>document.querySelector('#b-set').click());await sleep(80);const v=await readSetting(pg,s);await ev(pg,()=>document.querySelectorAll('.pop').forEach(p=>p.hidden=true));const e=typeof s.eff==='string'?await effectOf(pg,s):await ev(pg,s.eff);
        /* numeric effects that depend on what is on screen (dimension count) may drift by a few; they must still sit with the applied value */
        const near=a=>parseFloat(String(a).replace(/^dx=/,''));
        const en=near(e),e1n=near(res[s.id].e1),e0n=near(res[s.id].e0);const close=String(e)===String(res[s.id].e1)||(!/^dx=/.test(String(e))&&isFinite(en)&&isFinite(e1n)&&isFinite(e0n)&&e1n!==e0n&&Math.abs(en-e1n)<Math.abs(en-e0n)&&Math.abs(en-e1n)<=2);
        /* the reloaded preference itself (what drives the effect proven above); screen-dependent effects (zoom, what is in view) only as a fallback */
        const PK={'#s-snap':'snap','#s-osnap':'osnap','#s-ortho':'ortho','#s-theme':'theme','#s-snapsz':'snapSize','#s-grid':'grid','#s-dims':'dims','#s-clash':'clash','#s-wall':'wall','#s-fill':'fill','#s-lbl':'lbl','#s-inv':'inv'}[s.sel];
        const pv=PK?await ev(pg,k=>{const x=window.__osp.P()[k];return x==null?null:String(x)},PK):null;const prefOk=PK?(s.chk?(pv==='true')===res[s.id].v1:pv===String(res[s.id].v1)):close;
        return {pass:v===res[s.id].v1&&prefOk,detail:{want:res[s.id],v,pref:pv,e:String(e).slice(0,80)}}})}
    /* phone: the settings popover is reachable from More and the theme applies there too */
    A.add('mx-sh-i3-clean-d2','desktop settings checks left no console errors',pg.errs.length===0,pg.errs.slice(0,4));
  }}
async function phoneTheme(pp,A){
  {await safe(A,'mx-sh-i3-theme-p2','phone: More › Settings › Theme Dark applies and survives a reload',async()=>{await hardReset(pp);await ev(pp,()=>{const P=window.__osp.P();P.theme='light';document.documentElement.dataset.theme='light'});const bg0=await ev(pp,()=>getComputedStyle(document.body).backgroundColor);
      await openSettings(pp);await pp.locator('#s-theme').selectOption('dark');await sleep(150);const a=await ev(pp,()=>({t:document.documentElement.dataset.theme,bg:getComputedStyle(document.body).backgroundColor}));
      await pp.reload({waitUntil:'load'});await pp.waitForFunction(()=>window.__osp&&window.__osp.S,null,{timeout:20000});await sleep(200);const b2=await ev(pp,()=>({t:document.documentElement.dataset.theme,bg:getComputedStyle(document.body).backgroundColor}));
      await ev(pp,()=>{const P=window.__osp.P();P.theme='light'});return {pass:a.t==='dark'&&a.bg!==bg0&&b2.t==='dark'&&b2.bg===a.bg,detail:{bg0,a,b2}}});
    A.add('mx-sh-i3-clean-p2','phone settings checks left no console errors',pp.errs.length===0,pp.errs.slice(0,4))}}

/* =============== A8: locked rooms =============== */
// mutation: app.js `const fixed=o=>isWallish(o)&&!o.site&&S.locked;` → `...&&S.locked&&false;` → FAIL confirmed (mx-sh-a8-lock-d2, -p2, -t)
// mutation: app.js b-lock handler `checkpoint();S.locked=!S.locked;` → `checkpoint();S.locked=true;` → FAIL confirmed (mx-sh-a8-unlock-d2, -p2, -t)
async function lockChecks(pg,A){const su=pg.su;if(su.three)return;
  const lockBtn=async()=>{if(isPhone(pg))await moreTile(pg,'b-lock');else await tapEl(pg,'#b-lock')};
  await safe(A,`mx-sh-a8-lock-${su.id}`,`${su.nm}: with rooms locked, a room cannot be selected or dragged`,async()=>{await hardReset(pg);
    const r=await roomPt(pg);if(!r)return {pass:false,detail:'no room point'};
    /* precondition: unlocked, tapping this point selects the room */
    await pg.cvTap(r.x,r.y);await sleep(120);const selU=await ev(pg,()=>window.__osp.sel());await hardReset(pg);
    await lockBtn();await sleep(100);const locked=await ev(pg,()=>window.__osp.S().locked);await hardReset(pg);
    await sleep(550);await pg.cvTap(r.x,r.y);await sleep(120);const selL=await ev(pg,()=>window.__osp.sel());
    await sleep(550);await pg.cvDrag([r.x,r.y],[r.x+70,r.y+50],10);await sleep(120);const pts=await ev(pg,id=>JSON.stringify(window.__osp.S().objs.find(o=>o.id===id).pts),r.id);const selD=await ev(pg,()=>window.__osp.sel());
    return {pass:selU.includes(r.id)&&locked===true&&!selL.includes(r.id)&&pts===r.pts&&!selD.includes(r.id),detail:{unlockedTapSelects:selU.includes(r.id),locked,selL,moved:pts!==r.pts,selD}}});
  await safe(A,`mx-sh-a8-unlock-${su.id}`,`${su.nm}: unlocking rooms lets a tap select the room again`,async()=>{await hardReset(pg);const was=await ev(pg,()=>window.__osp.S().locked);if(!was){await lockBtn();await hardReset(pg)}
    const r=await roomPt(pg);await pg.cvTap(r.x,r.y);await sleep(100);const selL=await ev(pg,()=>window.__osp.sel());await hardReset(pg);
    await lockBtn();await sleep(100);const locked=await ev(pg,()=>window.__osp.S().locked);await hardReset(pg);await sleep(550);await pg.cvTap(r.x,r.y);await sleep(120);const selU=await ev(pg,()=>window.__osp.sel());await hardReset(pg);
    return {pass:!selL.includes(r.id)&&locked===false&&selU.includes(r.id),detail:{lockedSel:selL,locked,unlockedSel:selU}}});
  await ev(pg,()=>{const o=window.__osp;if(o.S().locked){o.S().locked=false;o.render()}});}

/* =============== run =============== */
/* one page per setup (opening a page is the expensive part); settings reuse the desktop page at the end, as they reload it */
async function runSetup(b,su){const A=mk();let pg;
  try{pg=await openSetup(b,su);
    await statesFor(pg,A);await deskExtras(pg,A);await phoneExtras(pg,A);await lockChecks(pg,A);await controlsFor(pg,A);
    if(!ONLY||A.R.length)A.add(`mx-sh-i5-${su.id}`,`${su.nm}: no console errors during the shell checks`,pg.errs.length===0,pg.errs.slice(0,5));
    if(su.id==='d2'){/* settings on a page of their own: earlier checks change prefs and plans on this one */
      const sp=await openSetup(b,su);try{await settingsChecks(b,A,sp)}finally{await sp.ctx.close().catch(()=>{})}}if(su.id==='p2'&&(!ONLY||ONLY.test('mx-sh-i3-theme-p2')))await phoneTheme(pg,A);
  }catch(e){A.add(`mx-sh-crash-${su.id}`,`${su.nm}: shell slice ran`,false,String(e.stack||e).slice(0,300))}
  finally{if(pg)await pg.ctx.close().catch(()=>{})}
  return A.R}
export async function run(b){
  const want=(process.env.SB_SETUPS||'').split(',').filter(Boolean);const jobs=SETUPS.filter(su=>!want.length||want.includes(su.id)).map(su=>()=>runSetup(b,su));
  const N=+(process.env.SB_PAR||2);const out=new Array(jobs.length);let i=0;
  await Promise.all(Array.from({length:N},async()=>{while(i<jobs.length){const k=i++;out[k]=await jobs[k]()}}));
  return out.flat()}
