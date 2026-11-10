/* matrix slice: layout across real device sizes, orientations, themes and accessibility.
   Ids: geometry mx-ly-<device>-<orient>-<screen>-<fit|touch|text|plan|name> · per theme mx-ly-<device>-<orient>-<theme>-<screen>-<contrast|wm>
        screen that cannot be opened mx-ly-<device>-<orient>-<screen>-open · rotation mx-ly-<device>-rot-<tool|sheet|3d|walk>
        keyboard mx-ly-<device>-<orient>-kbd-<lib|det> · modals mx-ly-<device>-<orient>-a11y-<modal>-<role|close|focus>
        long-press menu under the finger mx-ly-<device>-<orient>-menu-lift · console errors mx-ly-<device>-errors.

   Only Chromium runs here: iPhone / iPad are emulated with Playwright device descriptors (viewport, DPR, touch, isMobile, UA) or explicit
   sizes where no descriptor exists or the brief names a different size (iPhone SE 2/3 375×667, iPhone 13 mini 375×812, iPhone 15 Pro Max
   430×932, iPad Pro 12.9 1024×1366, iPad split views 507 / 678 / 981 × 1024). Phones and full-screen iPads run portrait and landscape
   (landscape = the descriptor's landscape viewport where one exists, else width and height swapped); one page per device, rotated with
   setViewportSize, which is what a real rotation does to the layout viewport.

   Themes: lt = light (colorScheme light, app theme System) · dko = dark from the OS (colorScheme dark, app theme System) ·
           dka = dark from the app's Settings → Theme = Dark (colorScheme light).  Each theme's row asserts the theme really applied.

   Screens (entered with real input: finger taps / long-press through CDP on touch devices, the mouse on desktops; the opener must be
   on screen and hit by elementFromPoint, else the screen row fails "could not open"):
     2d (plan), 3d, sun (Sun bar), walk (Walk HUD), menu (long-press / right-click menu), plans (My plans), set (Settings), keys (Shortcuts),
     guide, snaps (Snapshots); phone shell only: sh-draw, sh-more, sh-lib, sh-det (Details with an item selected), paint (paint strip),
     place (placing strip); touch only: multi (Select-several bar; the menu offers it only on touch); desktop shell only: dr-lib, dr-det
     (each drawer alone).  Phone sheets / strips do not exist in the desktop shell (> 820 px) and drawers are sheets in the phone shell,
     so those rows are not generated there.

   Rule families (detail lists every offender).  Themes only change colours, so the geometry families (fit, touch, text, plan, name) get
   one row per device × orientation × screen, measured in full in light and re-measured in each dark theme whenever any control's box
   differs from light (a fingerprint of every box is compared; offenders found only there are tagged with the theme); contrast and the
   credit get one row per theme:
     fit   (rule 1) every visible control in the screen's scope is inside the viewport, or inside a scroll container that brings it fully
           into view (tested by scrolling it there and back), is not clipped by an overflow:hidden ancestor, and elementFromPoint at its
           centre hits it (or its child / its label); and no horizontal page scroll.
     touch (rule 2, touch devices) every control is ≥ 40×40 CSS px, or ≥ 32×32 with ≥ 8 px to its nearest neighbour (label counts as
           the target for wrapped inputs).
     text  (rule 3) no button / tab text overflowing or truncated inside it (scrollWidth ≤ clientWidth + 1 on the control and its text
           children), and on iOS (iPhone / iPad UA) every visible field's font-size ≥ 16 px.
     plan  (rule 4, a sheet or drawer open) ≥ 45 % of the viewport (30 × 30 elementFromPoint grid) shows the plan; exact % in detail.
     name  (rule 7a) every visible control has an accessible name (aria-labelledby, aria-label, label, title, text, placeholder, value, alt).
     contrast (rule 7d) every text run in a toolbar in scope (header, dock, phone bar, 3D bar, Sun bar, strips, Select-several bar,
           Cancel chip) has contrast ≥ 4.5:1 against its composited background (computed styles, element opacity included).
           The credit is excluded here (incidental text, rule 8 covers it); disabled controls are exempt (WCAG 1.4.3).
     wm    (rule 8, 2D) "Designed by Jeff Ying, BI" is displayed, inside the viewport, not clipped by an ancestor and not covered.
   Scope: the 2D screen checks every control on the page; the others check the screen's own container (sheet, drawer, modal, menu, bar)
   plus, in the phone shell, the bottom bar and Cancel chip that stay on screen with it.  This keeps each offender in one row.

   rot   (rule 5, phones and iPads) a tool live, a sheet / drawer open, 3D, Walk: rotate mid-task; the state is kept, the layout follows
         (plan / canvas sized to the new viewport, renderer and camera aspect updated, bars inside the viewport) and the task carries on
         with real input (draw a room after rotating; close the sheet; go back to 2D; exit Walk).
   kbd   (rule 6, phone shell) tap a text field in a phone sheet (Library search; Details → Label on plan), then shrink the viewport height
         to 55 % (the on-screen keyboard; app.js has no visualViewport handling, so the layout viewport is what moves): the field keeps
         focus, is fully visible inside the remaining 55 % and not covered.
   a11y  (rule 7b/c) My plans, Shortcuts, User guide, Snapshots: -role role=dialog with a name; -close Esc closes it on desktops (its ✕
         on touch); -focus after closing, focus is not dropped to <body>.  Settings is a popover: close and focus only.
   menu-lift (rule 1, touch) a long-press low and right on the plan opens the menu pushed up and left over the finger; lifting the finger
         (Chromium's touch pipeline, like Android Chrome, then sends a click) must not run the item under it or close the menu.

   3D cost: every page round-trip in 3D waits behind swiftshader frames, so the 3D phase (3d, sun, walk screens on both orientations with
   the 3D and Walk rotations) runs on one representative device per class by default (rep3D: iPhone 13, 320-px phone, iPad Pro 11, split
   view 507, laptop 1280, desktop 2560) and on every device with MX_LY_FULL=1.  All 2D screens, rotations of a live tool and of a sheet,
   keyboard, modal and menu checks run on every device.

   Mutation testing: /tmp/mx-ly/mut.mjs <name> builds a mutant (find/replace on a copy of app.js or head.html, find must occur once),
   runs this slice against it filtered by MX_LY_DEV / MX_LY_SCR / MX_LY_GRP and lists the rows that went red.  Mutants are listed
   above the code they guard as `// mutation: ... → FAIL confirmed`. */
import {devices,row,devFile} from '../../lib.mjs';
export const name='matrix-layout';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const URL_=()=>process.env.SB_URL||devFile();
const ev=(pg,fn,arg)=>pg.evaluate(fn,arg);
/* the gate retries failed rows once on their own (device + screen); a pass on retry is marked FLAKY */
export const retryEnv=ids=>{const dev=new Set(),scr=new Set();for(const id of ids){const m=/^mx-ly-([a-z0-9]+)-(?:[pl]-)?(.*)$/.exec(id);if(!m)continue;dev.add(m[1]);const parts=m[2].split('-');for(let i=parts.length;i>0;i--)scr.add(parts.slice(0,i).join('-'))}return {MX_LY_DEV:'^('+[...dev].join('|')+')$',MX_LY_SCR:'^('+[...scr].join('|')+')$'}};
const reDEV=process.env.MX_LY_DEV?new RegExp(process.env.MX_LY_DEV):null;
const reSCR=process.env.MX_LY_SCR?new RegExp(process.env.MX_LY_SCR):null;
const reGRP=process.env.MX_LY_GRP?new RegExp(process.env.MX_LY_GRP):null;
const reTH=process.env.MX_LY_TH?new RegExp(process.env.MX_LY_TH):null;
const PAR=+(process.env.MX_LY_PAR||3);
const FULL3D=process.env.MX_LY_FULL==='1';

/* ---------------- devices ---------------- */
const IPHONE_UA=devices['iPhone 13'].userAgent,IPAD_UA=devices['iPad Pro 11'].userAgent;
const dsc=(k,extra={})=>{const d=devices[k];return {vp:d.viewport,dpr:d.deviceScaleFactor,touch:d.hasTouch,mobile:d.isMobile,ua:d.userAgent,...extra}};
const exp=(w,h,ua,dpr,extra={})=>({vp:{width:w,height:h},dpr,touch:true,mobile:true,ua,...extra});
const land=k=>devices[k+' landscape']?devices[k+' landscape'].viewport:null;
const swap=v=>({width:v.height,height:v.width});
const DEVICES=[
  {id:'se',nm:'iPhone SE (375×667)',...exp(375,667,IPHONE_UA,2),rot:true},
  {id:'13mini',nm:'iPhone 13 mini',...exp(375,812,IPHONE_UA,3),rot:true},
  {id:'13',rep3D:true,nm:'iPhone 13',...dsc('iPhone 13'),land:land('iPhone 13'),rot:true},
  {id:'15pm',nm:'iPhone 15 Pro Max (430×932)',...exp(430,932,devices['iPhone 15 Pro Max'].userAgent,3),rot:true},
  {id:'px7',nm:'Pixel 7',...dsc('Pixel 7'),land:land('Pixel 7'),rot:true},
  {id:'s8',nm:'Galaxy S8 (360×740)',...dsc('Galaxy S8'),land:land('Galaxy S8'),rot:true},
  {id:'w320',rep3D:true,nm:'320-px phone (iPhone SE 1st gen)',...dsc('iPhone SE'),land:land('iPhone SE'),rot:true},
  {id:'ipmini',nm:'iPad mini',...dsc('iPad Mini'),land:land('iPad Mini'),rot:true},
  {id:'ip7',nm:'iPad (gen 7)',...dsc('iPad (gen 7)'),land:land('iPad (gen 7)'),rot:true},
  {id:'ipp11',rep3D:true,nm:'iPad Pro 11',...dsc('iPad Pro 11'),land:land('iPad Pro 11'),rot:true},
  {id:'ipp13',nm:'iPad Pro 12.9',...exp(1024,1366,IPAD_UA,2),rot:true},
  {id:'split507',rep3D:true,nm:'iPad split view 507',...exp(507,1024,IPAD_UA,2),rot:false},
  {id:'split678',nm:'iPad split view 678',...exp(678,1024,IPAD_UA,2),rot:false},
  {id:'split981',nm:'iPad split view 981',...exp(981,1024,IPAD_UA,2),rot:false},
  {id:'lap1280',rep3D:true,nm:'laptop 1280×720',vp:{width:1280,height:720},dpr:1,touch:false,mobile:false,rot:false},
  {id:'d1440',nm:'desktop 1440×900',vp:{width:1440,height:900},dpr:1,touch:false,mobile:false,rot:false},
  {id:'d1920',nm:'desktop 1920×1080',vp:{width:1920,height:1080},dpr:1,touch:false,mobile:false,rot:false},
  {id:'d2560',rep3D:true,nm:'desktop 2560×1440',vp:{width:2560,height:1440},dpr:1,touch:false,mobile:false,rot:false}];
for(const d of DEVICES){d.ios=/iPhone|iPad/.test(d.ua||'');d.orients=d.rot?[['p',d.vp],['l',d.land||swap(d.vp)]]:[[d.vp.width>d.vp.height?'l':'p',d.vp]]}

const THEMES=[{id:'lt',nm:'light',cs:'light',app:'system',dark:false},{id:'dka',nm:'dark (app setting)',cs:'light',app:'dark',dark:true},{id:'dko',nm:'dark (OS)',cs:'dark',app:'system',dark:true}]
  .filter(t=>!reTH||reTH.test(t.id));

/* ---------------- page ---------------- */
async function openDev(b,d){
  const opts={viewport:d.vp,deviceScaleFactor:d.dpr,hasTouch:d.touch,isMobile:d.mobile};if(d.ua)opts.userAgent=d.ua;
  const ctx=await b.newContext(opts);const pg=await ctx.newPage();pg.ctx=ctx;pg.d=d;pg.errs=[];
  pg.on('pageerror',e=>pg.errs.push('PE:'+e.message));pg.on('console',m=>{if(m.type()==='error')pg.errs.push(m.text())});
  pg.on('dialog',x=>x.dismiss().catch(()=>{}));
  await pg.addInitScript({content:`window.__MXM=${MEASURE.toString()};`});
  await pg.addInitScript(()=>{window.showSaveFilePicker=async()=>{throw new DOMException('test','AbortError')};window.showOpenFilePicker=async()=>{throw new DOMException('test','AbortError')}});
  await pg.goto(URL_(),{waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,null,{timeout:20000});
  await ev(pg,()=>{const b=document.querySelector('#m-sample');if(b)b.click()});await pg.waitForFunction(()=>window.__osp.S().objs.length>100,null,{timeout:8000});
  await ev(pg,()=>window.__osp.toastOff());
  if(d.touch){const cdp=await ctx.newCDPSession(pg);
    const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(p=>({x:p[0],y:p[1],id:p[2]??0}))});
    pg.tap=async(x,y)=>{await T('touchStart',[[x,y]]);await sleep(30);await T('touchEnd',[]);await sleep(60)};
    pg.hold=async(x,y,ms=750)=>{await T('touchStart',[[x,y]]);await sleep(ms);await T('touchEnd',[]);await sleep(80)};
    pg.drag=async(a,b2,n=10)=>{await T('touchStart',[a]);for(let i=1;i<=n;i++){await T('touchMove',[[a[0]+(b2[0]-a[0])*i/n,a[1]+(b2[1]-a[1])*i/n]]);await sleep(16)}await T('touchEnd',[]);await sleep(80)};
  }else{
    pg.tap=async(x,y)=>{await pg.mouse.click(x,y);await sleep(40)};
    pg.hold=async(x,y)=>{await pg.mouse.click(x,y,{button:'right'});await sleep(80)};
    pg.drag=async(a,b2,n=10)=>{await pg.mouse.move(a[0],a[1]);await pg.mouse.down();for(let i=1;i<=n;i++){await pg.mouse.move(a[0]+(b2[0]-a[0])*i/n,a[1]+(b2[1]-a[1])*i/n);await sleep(16)}await pg.mouse.up();await sleep(80)};
  }
  return pg}

/* tap a control the way a user would: at its centre if that is on screen and hits it, else scroll it into view first (users scroll) */
async function tapEl(pg,sel){
  const p=await ev(pg,sel=>{const e=document.querySelector(sel);if(!e)return {err:'no element '+sel};
    const at=()=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return {err:sel+' is not displayed'};const x=r.left+r.width/2,y=r.top+r.height/2;
      if(x<0||y<0||x>innerWidth||y>innerHeight)return {err:`${sel} is off-screen at ${Math.round(x)},${Math.round(y)} (viewport ${innerWidth}×${innerHeight})`};
      const h=document.elementFromPoint(x,y);if(!h||!(h===e||e.contains(h)||(h.tagName==='LABEL'&&h.contains(e))))return {err:`${sel} is covered by ${h?(h.tagName.toLowerCase()+(h.id?'#'+h.id:'')+(h.className&&typeof h.className==='string'?'.'+h.className.split(' ')[0]:'')):'nothing'}`};return {x,y}};
    let a=at();if(a.err){e.scrollIntoView({block:'nearest',inline:'nearest'});a=at()}return a},sel);
  if(p.err)throw new Error(p.err);await pg.tap(p.x,p.y);return p}
const visible=(pg,sel)=>ev(pg,sel=>{const e=document.querySelector(sel);if(!e||e.closest('[hidden]'))return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'},sel);
const waitFor=(pg,fn,arg,ms=5000)=>pg.waitForFunction(fn,arg,{timeout:ms,polling:100});
const phoneShell=pg=>ev(pg,()=>matchMedia('(max-width:820px), (pointer:coarse) and (max-height:500px)').matches);

/* an item on the plan, hit at its centre and clear of the bars.
   menu:'safe'  → one where the long-press / right-click menu (showMenu puts its top-left corner at the finger, pushed up / left near
                  the edges) opens down-right of the finger; else one where it is only pushed up (finger on its left edge).
   menu:'under' → one low and right on the plan, where the menu is pushed up AND left, so the finger ends up inside it. */
/* solo prefers an ungrouped item; if earlier screens left every visible item grouped, any item will do */
const findItem=async(pg,menu=null,solo=false)=>{for(let k=0;k<3;k++){const r=await findItem1(pg,menu,solo);if(r)return r;await sleep(250);await ev(pg,()=>window.__osp.fit())}return solo?findItem1(pg,menu,false):null};
const findItem1=(pg,menu,solo)=>ev(pg,([menu,solo])=>{const C=[];const o=window.__osp,S=o.S();const pl=document.querySelector('#plan').getBoundingClientRect();
  const top=Math.max(pl.top,0)+(menu?20:Math.min(60,innerHeight*0.1)),bot=Math.min(pl.bottom,innerHeight)-Math.min(80,innerHeight*0.15);
  const reserve=matchMedia('(pointer:coarse)').matches?(matchMedia('(max-width:820px), (pointer:coarse) and (max-height:500px)').matches?96:16):8;const mh=8*44+12,mw=190;
  const its=S.objs.filter(x=>x.t==='item'&&!(solo&&x.gid)&&/^(WS|TC|CH|OC|MT)/.test(x.code||'')).concat(S.objs.filter(x=>x.t==='item'&&!(solo&&x.gid)));
  for(const it of its){const el=document.querySelector(`#plan [data-id="${it.id}"]`);if(!el)continue;const r=el.getBoundingClientRect();if(r.width<10||r.height<10)continue;const x=r.left+r.width/2,y=r.top+r.height/2;
    if(x<pl.left+20||x>Math.min(pl.right,innerWidth)-20||y<top||y>bot)continue;const h=document.elementFromPoint(x,y);const c=h&&h.closest('[data-id]');if(!c||c.dataset.id!==it.id)continue;
    if(!menu)return {id:it.id,x,y};const pushX=x+mw>innerWidth-8,pushY=y+mh+reserve>innerHeight;
    C.push({id:it.id,x,y,rank:!pushX&&!pushY?0:!pushX?1:2,inside:x>innerWidth-mw-8+12&&y>innerHeight-mh-reserve+12})}
  if(menu==='under'){C.sort((a,b)=>b.y-a.y);return C.find(c=>c.inside)||null}
  C.sort((a,b)=>(a.rank-b.rank)||((a.x+a.y)-(b.x+b.y)));return C[0]||null},[menu,solo]);
/* empty plan points (grid only) clear of the bars */
const emptyPt=pg=>ev(pg,()=>{const pl=document.querySelector('#plan').getBoundingClientRect();const top=Math.min(130,innerHeight*0.2),bot=Math.min(150,innerHeight*0.3);
  const ok=(x,y)=>{const h=document.elementFromPoint(x,y);return h&&h.closest('#plan')&&!h.closest('[data-id],[data-pin],[data-vh],[data-bh],[data-aim],[data-sech]')};
  for(let y=pl.top+top;y<Math.min(pl.bottom,innerHeight)-bot;y+=20)for(let x=pl.left+30;x<Math.min(pl.right,innerWidth)-90;x+=20){if([[0,0],[60,0],[60,40],[0,40],[30,20]].every(([dx,dy])=>ok(x+dx,y+dy)))return [x,y]}return null});
const roomPt=pg=>ev(pg,()=>{const o=window.__osp,S=o.S();const rooms=S.objs.filter(r=>r.t==='room');const pl=document.querySelector('#plan').getBoundingClientRect();const top=Math.min(130,innerHeight*0.2),bot=Math.min(130,innerHeight*0.25);
  for(const r of rooms){const el=document.querySelector(`#plan [data-id="${r.id}"]`);if(!el)continue;const b=el.getBoundingClientRect();
    for(let fy=0.15;fy<0.9;fy+=0.07)for(let fx=0.15;fx<0.9;fx+=0.07){const x=b.left+b.width*fx,y=b.top+b.height*fy;if(x<Math.max(pl.left,0)+20||x>Math.min(pl.right,innerWidth)-20||y<Math.max(pl.top,0)+top||y>Math.min(pl.bottom,innerHeight)-bot)continue;
      const ok=[[0,0],[10,0],[-10,0],[0,10],[0,-10]].every(([dx,dy])=>{const h=document.elementFromPoint(x+dx,y+dy);const c=h&&h.closest('[data-id]');return c&&c.dataset.id===r.id});if(ok)return {x,y}}}return null});

/* a point on the bare plan (grid, no object) outside the element sel, for "tap outside to close" */
const outsidePt=(pg,sel)=>ev(pg,sel=>{const m=document.querySelector(sel);for(let y=innerHeight*0.15;y<innerHeight*0.9;y+=12)for(let x=innerWidth*0.05;x<innerWidth*0.95;x+=12){const h=document.elementFromPoint(x,y);
  if(h&&h.closest('#plan')&&!h.closest('[data-id],[data-pin],[data-vh],[data-bh],[data-aim],[data-sech]')&&!m.contains(h))return [x,y]}return null},sel);
/* back to a known start: 2D, Select, nothing selected, nothing open, drawers as the shell's default (setup only, not under test) */
async function reset(pg,{keep3D=false}={}){
  const desk=!(await phoneShell(pg));
  await ev(pg,({keep3D,desk})=>{const o=window.__osp,g=s=>document.querySelector(s);
    if(o.WALK.on)g('#v3-walk').click();
    document.querySelectorAll('.keys-modal').forEach(m=>m.hidden=true);
    if(!g('#multibar').hidden)g('#multi-done').click();
    ['#pop-set','#pop-more','#pop-shape','#pop-layers','#pop-floor','#pop-stl','#pop-save','#ctxmenu'].forEach(s=>{const e=g(s);if(e)e.hidden=true});
    if(!g('#msheet').hidden)g('#msheet [data-msheet-close]').click();
    if(o.SUN().on)g('#v3-sun').click();
    o.setTool('select');o.setSel([]);
    if(!keep3D&&!g('#v3').hidden)g('#v2d').click();
    const P=o.P();const want=desk?{lib:true,insp:true}:{lib:false,insp:false};
    if(!!P.lib!==want.lib)g('#t-lib').click();if(!!P.insp!==want.insp)g('#t-insp').click();if(!!P.lib!==want.lib)g('#t-lib').click();
    if(document.activeElement&&document.activeElement!==document.body)document.activeElement.blur();o.toastOff();
    const se=document.scrollingElement;se.scrollTop=0;se.scrollLeft=0},{keep3D,desk});
  await sleep(30)}
async function setDrawers(pg,lib,insp){await ev(pg,([lib,insp])=>{const o=window.__osp,P=o.P(),g=s=>document.querySelector(s);if(!!P.lib!==lib)g('#t-lib').click();if(!!P.insp!==insp)g('#t-insp').click();if(!!P.lib!==lib)g('#t-lib').click()},[lib,insp])}
const in3D=pg=>ev(pg,()=>!document.querySelector('#v3').hidden&&!!window.__osp.T3()&&!!window.__osp.T3().renderer);
async function go3D(pg){if(await in3D(pg))return;await tapEl(pg,'#v3d');await waitFor(pg,()=>!document.querySelector('#v3').hidden&&window.__osp.T3()&&window.__osp.T3().renderer,null,60000);await sleep(250)}
async function openMenuItem(pg,id){await tapEl(pg,'#b-more');await waitFor(pg,()=>!document.querySelector('#pop-more').hidden,null,3000);await tapEl(pg,'#'+id)}
async function moreTile(pg,id){await tapEl(pg,'#mbar [data-m=more]');await waitFor(pg,()=>!document.querySelector('#msheet').hidden,null,3000);await tapEl(pg,`#msheet [data-pm="${id}"]`)}
async function selectItem(pg,solo=false){const it=await findItem(pg,null,solo);if(!it)throw new Error('no item visible on the plan to select');await pg.tap(it.x,it.y);await waitFor(pg,()=>window.__osp.sel().length>0,null,3000);return it}
async function startWalk(pg){if(await in3D(pg))await tapEl(pg,'#v3-walk');else await tapEl(pg,'#b-walk');await waitFor(pg,()=>document.querySelector('#v3').hidden,null,5000);await sleep(80);
  const r=await roomPt(pg);if(!r)throw new Error('no room visible to start the walk in');await pg.tap(r.x,r.y);await waitFor(pg,()=>window.__osp.WALK.on&&!document.querySelector('#v3').hidden,null,60000);await sleep(300)}

/* read-only trace of what the context menu does (a capture listener; nothing is prevented) */
const traceMenu=pg=>ev(pg,()=>{window.__mxe=[];window.__mxr=null;if(window.__mxeOn)return;window.__mxeOn=1;document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#ctxmenu [data-cm]');if(b&&window.__mxe)window.__mxe.push('clicked '+b.dataset.cm)},true);
  const m=document.querySelector('#ctxmenu');new MutationObserver(()=>{if(!m.hidden){const r=m.getBoundingClientRect();window.__mxr=[r.left,r.top,r.right,r.bottom]}}).observe(m,{attributes:true,attributeFilter:['hidden','style']})});

/* the menu opened by a long-press low and right on the plan is pushed up and left over the finger; lifting the finger must not run
   the item under it, nor close the menu.  (Chromium's touch pipeline, as on Android, sends a click after the long-press.)
   One row per touch device × orientation (rule 1 family: the menu has to stay usable). */
// mutation (inverse: this check FAILS on the real build): app.js:1284 first ctxmenu click handler ignores clicks < 600 ms after showMenu (showMenu stamps window.__mxShown) → menu-lift PASS confirmed on 13-p/l and ipp11-p/l (real build: lifting runs "Select several…" and the menu closes)
async function menuLift(pg,d,o,R){if(!d.touch||(reSCR&&!reSCR.test('menu-lift')))return;let pass=false,det='';
  try{await reset(pg);if(!(await phoneShell(pg)))await setDrawers(pg,false,false);const kind='empty plan';
    /* the empty-space menu (Select all, Select several, Snap: 132-144 px tall, 180 wide) is placed with its top-left at the finger but
       kept inside [8, innerWidth-8] × [8, innerHeight-reserve]; a spot this close to the bottom-right puts the finger inside it */
    const it=await ev(pg,()=>{const reserve=matchMedia('(pointer:coarse)').matches?(matchMedia('(max-width:820px), (pointer:coarse) and (max-height:500px)').matches?96:16):8;const mh=132,mw=180;
      const y0=innerHeight-reserve-mh+16,y1=innerHeight-reserve-16,x0=innerWidth-8-mw+16,x1=innerWidth-24;
      for(let y=Math.round((y0+y1)/2),k=0;k<40;k++){const yy=y+((k%2)?1:-1)*Math.ceil(k/2)*4;if(yy<y0||yy>y1)continue;
        for(let x=x1;x>=x0;x-=6){const ok=[[0,0],[8,0],[-8,0],[0,8],[0,-8]].every(([dx,dy])=>{const h=document.elementFromPoint(x+dx,yy+dy);return h&&h.closest('#plan')&&!h.closest('[data-id],[data-pin],[data-vh],[data-bh],[data-aim],[data-sech]')});if(ok)return {id:null,x,y:yy}}}return null});
    if(!it)throw new Error('PRECONDITION: no spot low and right on the plan where the menu must open over the finger');
    const st=id=>ev(pg,id=>{const o=window.__osp,S=o.S();return {o:id?JSON.stringify(S.objs.find(x=>x.id===id)):null,n:S.objs.length,past:o.past(),snap:!!o.P().snap,sel:o.sel().length,multi:!document.querySelector('#multibar').hidden}},id);
    const s0=await st(it.id);await traceMenu(pg);await pg.hold(it.x,it.y);await sleep(150);const s1=await st(it.id);
    const m=await ev(pg,()=>{const m=document.querySelector('#ctxmenu');return {open:!m.hidden,menu:window.__mxr&&window.__mxr.map(Math.round),trace:window.__mxe}});
    /* precondition: the menu did open, and over the finger (its rect as it appeared, recorded by the observer) */
    const over=m.menu&&it.x>m.menu[0]+4&&it.x<m.menu[2]-4&&it.y>m.menu[1]+4&&it.y<m.menu[3]-4;
    if(s1.past>s0.past)await ev(pg,()=>window.__osp.undo());if(s1.snap!==s0.snap)await ev(pg,()=>{const c=document.querySelector('#s-snap');c.checked=!c.checked;c.dispatchEvent(new Event('change',{bubbles:true}))});
    const changed=['o','n','past','snap','multi'].filter(k=>s1[k]!==s0[k]);
    pass=over&&m.open&&!changed.length;det={...(over?{}:{PRECONDITION:m.menu?'menu did not open over the finger':'menu never opened'}),on:kind,finger:[Math.round(it.x),Math.round(it.y)],menuOpenedAt:m.menu,stillOpen:m.open,clickedItem:m.trace,changed}}
  catch(e){det='ERR '+String(e.message||e).split('\n')[0].slice(0,220)}
  R.push(row(`mx-ly-${d.id}-${o}-menu-lift`,`${d.nm} ${o==='p'?'portrait':'landscape'}: long-press low on the plan opens the menu and lifting the finger runs nothing`,pass,det));await reset(pg)}

/* ---------------- screens ---------------- */
const PH='#mbar,#esc';   // phone bar + Cancel chip stay on screen with sheets and strips
const SCREENS=[
  {id:'2d',nm:'2D plan',scope:null,toolbar:true,wm:true,enter:async()=>{},isIn:()=>document.querySelector('#v3').hidden},
  {id:'sh-draw',nm:'Draw sheet',shell:'phone',sheet:true,scope:'#msheet,'+PH,enter:pg=>tapEl(pg,'#mbar [data-m=draw]'),isIn:()=>!document.querySelector('#msheet').hidden&&!!document.querySelector('#msheet [data-pt]')},
  {id:'sh-more',nm:'More sheet',shell:'phone',sheet:true,scope:'#msheet,'+PH,enter:pg=>tapEl(pg,'#mbar [data-m=more]'),isIn:()=>!document.querySelector('#msheet').hidden&&!!document.querySelector('#msheet [data-pm]')},
  {id:'sh-lib',nm:'Library sheet',shell:'phone',sheet:true,scope:'#d-lib,'+PH,enter:pg=>tapEl(pg,'#mbar [data-m=lib]'),isIn:()=>!document.querySelector('#d-lib').hidden},
  {id:'sh-det',nm:'Details sheet with an item selected',shell:'phone',sheet:true,scope:'#d-insp,'+PH,enter:async pg=>{await selectItem(pg);await tapEl(pg,'#mbar [data-m=insp]')},isIn:()=>!document.querySelector('#d-insp').hidden&&window.__osp.sel().length>0},
  {id:'dr-lib',nm:'Library drawer',shell:'desk',sheet:true,scope:'#d-lib',enter:async pg=>{await setDrawers(pg,false,false);await tapEl(pg,'#t-lib')},isIn:()=>!document.querySelector('#d-lib').hidden&&document.querySelector('#d-insp').hidden},
  {id:'dr-det',nm:'Details drawer with an item selected',shell:'desk',sheet:true,scope:'#d-insp',enter:async pg=>{await setDrawers(pg,false,false);await selectItem(pg);if(await visible(pg,'#d-insp'))return;await tapEl(pg,'#t-insp')},isIn:()=>!document.querySelector('#d-insp').hidden&&document.querySelector('#d-lib').hidden&&window.__osp.sel().length>0},
  {id:'paint',nm:'paint strip',shell:'phone',toolbar:true,scope:'#paintstrip,'+PH,enter:async pg=>{await tapEl(pg,'#mbar [data-m=draw]');await tapEl(pg,'#msheet [data-pt=paint]')},isIn:()=>!document.querySelector('#paintstrip').hidden},
  {id:'place',nm:'placing strip',shell:'phone',toolbar:true,scope:'#pstrip,'+PH,enter:async pg=>{await tapEl(pg,'#mbar [data-m=lib]');const s=await ev(pg,()=>{const r=[...document.querySelectorAll('#lib-list .lib-row')].find(x=>/Task chair/i.test(x.textContent));if(!r)return null;r.id=r.id||'mxly-row';return '#'+r.id});if(!s)throw new Error('no Task chair row');await tapEl(pg,s)},isIn:()=>!document.querySelector('#pstrip').hidden},
  {id:'menu',nm:'long-press / right-click menu',scope:'#ctxmenu',enter:async pg=>{const it=await findItem(pg,'safe');if(!it)throw new Error('no item visible');await traceMenu(pg);await pg.hold(it.x,it.y);
    const tr=await ev(pg,()=>window.__mxe);if(tr.some(t=>/^ran /.test(t)))throw new Error(`the menu opened under the finger at ${Math.round(it.x)},${Math.round(it.y)} and lifting the finger ran it: ${tr.join(', ')}`)},isIn:()=>!document.querySelector('#ctxmenu').hidden&&document.querySelectorAll('#ctxmenu [data-cm]').length>0},
  {id:'multi',nm:'Select-several bar',touch:true,toolbar:true,scope:'#multibar,'+PH,enter:async pg=>{const it=await findItem(pg,'safe');if(!it)throw new Error('no item visible');await pg.hold(it.x,it.y);await waitFor(pg,()=>!document.querySelector('#ctxmenu').hidden,null,3000);await tapEl(pg,'#ctxmenu [data-cm=multi]')},isIn:()=>!document.querySelector('#multibar').hidden},
  {id:'plans',nm:'My plans',scope:'#plans-modal',enter:async pg=>{if(await phoneShell(pg))await moreTile(pg,'m-plans');else await openMenuItem(pg,'m-plans')},isIn:()=>!document.querySelector('#plans-modal').hidden},
  {id:'set',nm:'Settings',scope:'#pop-set',enter:async pg=>{if(await phoneShell(pg))await moreTile(pg,'b-set');else await tapEl(pg,'#b-set')},isIn:()=>!document.querySelector('#pop-set').hidden},
  {id:'keys',nm:'Shortcuts',scope:'#keys-modal',enter:pg=>openMenuItem(pg,'m-keys'),isIn:()=>!document.querySelector('#keys-modal').hidden},
  {id:'guide',nm:'User guide',scope:'#guide-modal',enter:async pg=>{if(await phoneShell(pg))await moreTile(pg,'m-guide');else await openMenuItem(pg,'m-guide')},isIn:()=>!document.querySelector('#guide-modal').hidden},
  {id:'snaps',nm:'Snapshots',scope:'#snap-modal',enter:async pg=>{if(await phoneShell(pg))await moreTile(pg,'m-snaps');else await openMenuItem(pg,'m-snaps')},isIn:()=>!document.querySelector('#snap-modal').hidden},
  {id:'3d',nm:'3D view',three:true,toolbar:true,scope:'#v3',enter:pg=>go3D(pg),isIn:()=>!document.querySelector('#v3').hidden},
  {id:'sun',nm:'Sun bar',three:true,keep3D:true,toolbar:true,scope:'#sun-bar,.v3bar',enter:async pg=>{await go3D(pg);await tapEl(pg,'#v3-sun')},isIn:()=>!document.querySelector('#sun-bar').hidden&&window.__osp.SUN().on},
  {id:'walk',nm:'Walk HUD',three:true,keep3D:true,toolbar:true,scope:'#v3',enter:pg=>startWalk(pg),isIn:()=>window.__osp.WALK.on&&!document.querySelector('#walk-hud').hidden}].filter(s=>!reSCR||reSCR.test(s.id));

/* ---------------- the measurement (in page, read only; scroll positions it touches are put back) ---------------- */
function MEASURE({scope,ios,touch,plan3d,geom,contrast,plan,wm,exp}){
  const vw=exp?exp[0]:innerWidth,vh=exp?exp[1]:innerHeight;const CS=new Map();const cs=e=>{let c=CS.get(e);if(!c){c=getComputedStyle(e);CS.set(e,c)}return c};
  const CTL='button,input:not([type=hidden]),select,textarea,a[href],[role=button],[role=tab],[role=switch],[contenteditable="true"],summary';
  const roots=scope?[...document.querySelectorAll(scope)]:[document.body];
  const D=e=>{if(!e)return 'nothing';let s=e.tagName.toLowerCase();if(e.id)s+='#'+e.id;else{const c=typeof e.className==='string'&&e.className.trim().split(/\s+/)[0];if(c)s+='.'+c;
      for(const k of ['m','pt','pm','cm','tool','tab','f','pb','sunp','paintc','gs','km','shape','pact','close','mact'])if(e.dataset&&e.dataset[k]!=null){s+=`[${k}=${e.dataset[k]}]`;break}}
    const t=(e.getAttribute('aria-label')||(e.matches('select')?'':e.textContent)||e.title||'').trim().replace(/\s+/g,' ').slice(0,18);return t?s+` "${t}"`:s};
  const shown=e=>{if(e.closest('[hidden]'))return false;if(!e.checkVisibility({visibilityProperty:true}))return false;const r=e.getBoundingClientRect();return r.width>0.5&&r.height>0.5};
  const OP=new Map();const opq=e=>{if(!e||e.nodeType!==1)return 1;if(OP.has(e))return OP.get(e);const v=(+cs(e).opacity)*opq(e.parentElement);OP.set(e,v);return v};
  let ctl=[];for(const R of roots){if(R!==document.body&&!shown(R))continue;if(R.matches(CTL))ctl.push(R);ctl.push(...R.querySelectorAll(CTL))}
  ctl=[...new Set(ctl)].filter(e=>!e.closest('#plan')&&shown(e)&&cs(e).pointerEvents!=='none');
  /* what a finger or pointer hits: an invisible or tiny native input inside a label is hit through the label */
  const tgt=e=>{const lb=e.closest('label');if(lb&&(opq(e)<0.05||e.matches('input[type=checkbox],input[type=radio],input[type=color]')))return lb;return e};
  ctl=ctl.filter(e=>opq(tgt(e))>0.05);
  const fp=ctl.map(e=>{const r=tgt(e).getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)].join(',')}).join(';');
  const out={vw,vh,n:ctl.length,fp};
  const bodyBg=(()=>{const m=cs(document.body).backgroundColor.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return (a.length>3&&a[3]===0)?null:0.2126*f(a[0])+0.7152*f(a[1])+0.0722*f(a[2])})();
  out.bgL=bodyBg;out.theme=document.documentElement.dataset.theme||'system';out.osDark=matchMedia('(prefers-color-scheme: dark)').matches;
  const inVP=r=>r.left>=-1&&r.top>=-1&&r.right<=vw+1&&r.bottom<=vh+1;
  /* a field's own stepper buttons, drawn over its padded right end inside the same label, belong to it */
  const hitOK=(e,h)=>{if(!h)return false;const t=tgt(e);const lb=e.closest('label');return h===e||e.contains(h)||h===t||t.contains(h)||(h.tagName==='LABEL'&&h.contains(e))||!!(e.labels&&[...e.labels].includes(h))||!!(lb&&e.matches('input')&&lb.contains(h)&&h.closest('.stp'))};
  /* fully usable where it is: inside the viewport and hit at its centre and at 20 % / 80 % across and down */
  const usable=e=>{const r=tgt(e).getBoundingClientRect();if(!inVP(r))return {ok:false,why:`off-screen at ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)} (viewport ${vw}×${vh})`};
    for(const [fx,fy] of [[0.5,0.5],[0.2,0.5],[0.8,0.5],[0.5,0.2],[0.5,0.8]]){const x=r.left+r.width*fx,y=r.top+r.height*fy;const h=document.elementFromPoint(x,y);
      if(!hitOK(e,h)){const anc=h&&h.contains(e);return {ok:false,why:(anc?`clipped by ${D(h)}`:`covered by ${D(h)}`)+` at ${Math.round(x)},${Math.round(y)}`}}}return {ok:true}};
  if(geom){
    const fit=[];
    for(const e of ctl){const u=usable(e);if(u.ok)continue;const t=tgt(e);let sc=null;
      for(let a=t.parentElement;a&&a!==document.documentElement;a=a.parentElement){const c=cs(a);if((/(auto|scroll)/.test(c.overflowY)&&a.scrollHeight>a.clientHeight+1)||(/(auto|scroll)/.test(c.overflowX)&&a.scrollWidth>a.clientWidth+1)){sc=a;break}}
      if(!sc){fit.push(`${D(e)} ${u.why}`);continue}
      const saved=[];for(let a=t.parentElement;a;a=a.parentElement)saved.push([a,a.scrollTop,a.scrollLeft]);saved.push([document.scrollingElement,document.scrollingElement.scrollTop,document.scrollingElement.scrollLeft]);
      t.scrollIntoView({block:'nearest',inline:'nearest'});const u2=usable(e);saved.forEach(([a,st,sl])=>{a.scrollTop=st;a.scrollLeft=sl});
      if(!u2.ok)fit.push(`${D(e)} ${u2.why} even when ${D(sc)} is scrolled to it`)}
    const sw=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);out.hscroll=innerWidth>vw+1?`layout viewport widened to ${innerWidth} px on a ${vw} px screen (page wider than the screen, so the browser zooms out)`:sw>vw+1?`page scrolls sideways: scrollWidth ${sw} > ${vw}`:null;out.fit=fit;
    const small=[];if(touch){const rs=ctl.map(e=>[e,tgt(e).getBoundingClientRect()]);
      for(const [e,r] of rs){if(r.width>=40&&r.height>=40)continue;const sz=`${Math.round(r.width)}×${Math.round(r.height)}`;
        if(r.width>=32&&r.height>=32){let gap=1e9;for(const [f,q] of rs){if(f===e||f.contains(e)||e.contains(f)||tgt(f)===tgt(e))continue;const dx=Math.max(0,q.left-r.right,r.left-q.right),dy=Math.max(0,q.top-r.bottom,r.top-q.bottom);gap=Math.min(gap,Math.hypot(dx,dy))}
          if(gap>=8)continue;small.push(`${D(e)} ${sz}, ${Math.round(gap)} px from the next control`)}else small.push(`${D(e)} ${sz}`)}}
    out.small=small;
    const text=[];for(const e of ctl){if(!e.matches('button,a,[role=button],[role=tab]'))continue;if(cs(e).display==='inline')continue;
      if(e.clientWidth>0&&e.scrollWidth>e.clientWidth+1)text.push(`${D(e)} text overflows: ${e.scrollWidth} > ${e.clientWidth}`);
      else for(const c of e.querySelectorAll('*')){if(c.closest('svg')||!c.textContent.trim()||cs(c).display==='inline'||c.clientWidth===0)continue;if(c.scrollWidth>c.clientWidth+1){text.push(`${D(e)} label cut off: ${D(c)} ${c.scrollWidth} > ${c.clientWidth}`);break}}}
    out.text=text;
    const font=[];if(ios)for(const e of ctl){if(!e.matches('input,select,textarea')||e.matches('[type=checkbox],[type=radio],[type=range],[type=color],[type=button],[type=submit],[type=file]'))continue;const f=parseFloat(cs(e).fontSize);if(f<16)font.push(`${D(e)} ${f}px`)}
    out.font=font;
    const nm=e=>{const lb=e.getAttribute('aria-labelledby');if(lb){const t=lb.split(/\s+/).map(i=>document.getElementById(i)).filter(Boolean).map(x=>x.textContent).join(' ').trim();if(t)return t}
      const al=(e.getAttribute('aria-label')||'').trim();if(al)return al;
      if(e.matches('input,select,textarea')){for(const l of e.labels||[]){const c=l.cloneNode(true);c.querySelectorAll('input,select,textarea').forEach(x=>x.remove());const t=c.textContent.trim();if(t)return t}
        if(e.matches('[type=button],[type=submit]')&&e.value)return e.value;if((e.title||'').trim())return e.title.trim();if((e.placeholder||'').trim())return e.placeholder.trim();return ''}
      const c=e.cloneNode(true);c.querySelectorAll('[aria-hidden=true]').forEach(x=>x.remove());const t=c.textContent.trim();if(t)return t;const im=e.querySelector('img[alt],svg title');if(im&&(im.alt||im.textContent).trim())return (im.alt||im.textContent).trim();
      return (e.title||'').trim()};
    out.noname=ctl.filter(e=>!nm(e)).map(e=>D(e)+(e.closest('label')&&!e.matches('select')?' (its label has no text)':''));
  }
  if(contrast){
    const P=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return [a[0],a[1],a[2],a.length>3?a[3]:1]};
    const L=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])};
    const over=(top,bot)=>{const a=top[3];return [top[0]*a+bot[0]*(1-a),top[1]*a+bot[1]*(1-a),top[2]*a+bot[2]*(1-a),1]};
    const BG=new Map();const bgOf=e=>{if(!e||e.nodeType!==1){let c=P(cs(document.documentElement).backgroundColor)||[255,255,255,1];return c[3]<1?over(c,[255,255,255,1]):c}
      if(BG.has(e))return BG.get(e);const under=e===document.documentElement?[255,255,255,1]:bgOf(e.parentElement);const b=P(cs(e).backgroundColor);const v=b&&b[3]>0?over([b[0],b[1],b[2],b[3]*(+cs(e).opacity)],under):under;BG.set(e,v);return v};
    const TB='header.top,.dock,#mbar,.v3bar,#sun-bar,#multibar,#pstrip,#paintstrip,#esc,#polybar';
    const low=[];let nTxt=0;const tbs=new Set();for(const R of roots){if(R.matches(TB))tbs.add(R);R.querySelectorAll(TB).forEach(x=>tbs.add(x));const up=R.parentElement&&R.parentElement.closest(TB);if(up)tbs.add(up)}
    for(const T of tbs){if(!shown(T))continue;
      const els=[T,...T.querySelectorAll('*')].filter(e=>!e.closest('.credit,[disabled],svg')&&shown(e)&&(e.matches('input:not([type=checkbox]):not([type=range]):not([type=color]),select')||[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())));
      for(const e of els){const fg=P(cs(e).color);if(!fg)continue;const bg=bgOf(e);let op=1;for(let x=e;x&&x!==T.parentElement;x=x.parentElement)op*=+cs(x).opacity;
        const f=over([fg[0],fg[1],fg[2],fg[3]*op],bg);const l1=L(f),l2=L(bg);const ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);nTxt++;
        if(ratio<4.5)low.push(`${D(e)} ${ratio.toFixed(2)}:1 (${cs(e).color}${op<1?' at opacity '+op.toFixed(2):''} on rgb(${bg.slice(0,3).map(Math.round).join(',')}))`)}}
    out.low=low;out.nTxt=nTxt}
  if(plan){let ph=0,pn=0;for(let i=0;i<30;i++)for(let j=0;j<30;j++){const h=document.elementFromPoint((i+0.5)*vw/30,(j+0.5)*vh/30);pn++;if(h&&(plan3d?h.id==='v3c':!!h.closest('#plan')))ph++}out.plan=ph/pn}
  if(wm){let w=null;const c=[...document.querySelectorAll('.credit')].find(x=>/Designed by Jeff Ying, BI/.test(x.textContent));
    if(!c)w='no element with the text';else{const r=c.getBoundingClientRect();
      if(cs(c).display==='none'||c.closest('[hidden]')||!c.checkVisibility({visibilityProperty:true}))w=`not displayed (display:${cs(c).display}) at ${vw}×${vh}`;
      else if(opq(c)<0.2)w='opacity '+opq(c).toFixed(2);else if(!(r.width>0&&r.height>0))w='zero size';else if(!inVP(r))w=`off-screen at ${Math.round(r.left)},${Math.round(r.top)}`;
      else if(c.scrollWidth>c.clientWidth+1)w=`text cut off in its own box (${c.scrollWidth} > ${c.clientWidth})`;
      else{const pe=c.style.pointerEvents;c.style.pointerEvents='auto';const bad=[[0.5,0.5],[0.08,0.5],[0.92,0.5]].map(([fx,fy])=>document.elementFromPoint(r.left+r.width*fx,r.top+r.height*fy)).filter(h=>h!==c&&!(h&&c.contains(h)));c.style.pointerEvents=pe;
        if(bad.length)w=(bad[0]&&bad[0].contains(c)?'clipped by ':'covered by ')+D(bad[0])}}
    out.wm=w}
  return out}

async function applyTheme(pg,t){await pg.emulateMedia({colorScheme:t.cs});
  await ev(pg,v=>{const s=document.querySelector('#s-theme');if(s.value!==v){s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}))}},t.app);await sleep(20)}
const ON=(arr,max=12)=>arr.length?arr.slice(0,max).join(' · ')+(arr.length>max?` · …+${arr.length-max} more`:''):'';
const LIGHT={id:'lt',cs:'light',app:'system'};

/* ---------------- one screen on one orientation, every theme ----------------
   Geometry (fit / touch / text / plan / name) is measured in full in the first theme; in the other themes a fingerprint of every
   control's box is compared and, if anything moved, the full geometry is measured again there and its offenders are added with the
   theme named.  So one geometry row per device × orientation × screen covers all themes exactly; contrast and the credit get a row
   per theme. */
async function doScreen(pg,d,o,s,R,{enter=true}={}){
  const tag=`${d.nm} ${o==='p'?'portrait':'landscape'}`;const base=`mx-ly-${d.id}-${o}`;let err=null;const T0=Date.now();
  if(enter){try{await reset(pg,{keep3D:!!s.keep3D});if(process.env.MX_LY_T)console.log('  reset',Date.now()-T0);await s.enter(pg);if(process.env.MX_LY_T)console.log('  entered',Date.now()-T0);await waitFor(pg,s.isIn,null,s.three?60000:4000);await sleep(s.three?150:60)}catch(e){err=String(e.message||e).split('\n')[0].slice(0,220)}}
  else{const ok=await ev(pg,s.isIn).catch(()=>false);if(!ok)err='PRECONDITION: '+s.nm+' is not showing'}
  if(err){R.push(row(`${base}-${s.id}-open`,`${tag}: ${s.nm} opens with real input`,false,'could not open: '+err));return false}
  const args={scope:s.scope,ios:d.ios,touch:d.touch,plan3d:!!s.three,plan:!!s.sheet,contrast:!!s.toolbar,wm:!!s.wm,exp:pg.vp?[pg.vp.width,pg.vp.height]:null};
  const G={fit:[],touch:[],text:[],plan:[],name:[]};let n=0,planTxt='';
  /* the app-setting themes are measured in one evaluate (two page round-trips per screen in all: in 3D each round-trip waits behind
     swiftshader frames); the OS dark theme needs emulateMedia, so it gets the second evaluate */
  const appT=THEMES.filter(t=>t.cs==='light'),osT=THEMES.filter(t=>t.cs!=='light');const ta=Date.now();
  const per=[];
  const run=async(ts,fp0)=>{const ms=await ev(pg,({args,apps,fp0})=>{const out=[];const sel=document.querySelector('#s-theme');const set=v=>{if(sel.value!==v){sel.value=v;sel.dispatchEvent(new Event('change',{bubbles:true}))}};
      for(const a of apps){set(a);let m=window.__MXM({...args,geom:fp0==null});if(fp0==null)fp0=m.fp;else if(m.fp!==fp0){m=window.__MXM({...args,geom:true});m.moved=true}out.push(m)}set('system');return out},{args,apps:ts.map(t=>t.app),fp0});
    ts.forEach((t,k)=>per.push({t,m:ms[k],moved:!!ms[k].moved,first:per.length===0&&k===0}))};
  if(appT.length)await run(appT,null);
  if(osT.length){await pg.emulateMedia({colorScheme:'dark'});await run(osT,per.length?per[0].m.fp:null);await pg.emulateMedia({colorScheme:'light'})}
  if(process.env.MX_LY_T)console.log('  measured',Date.now()-ta);
  for(const {t,m,moved,first} of per){if(!(first||moved))continue;const lab=first?'':`[${t.nm}] `;n=Math.max(n,m.n);
    G.fit.push(...[m.hscroll,...m.fit].filter(Boolean).map(x=>lab+x));G.touch.push(...m.small.map(x=>lab+x));
    G.text.push(...m.text.map(x=>lab+x),...m.font.map(x=>lab+'field under 16 px: '+x));G.name.push(...m.noname.map(x=>lab+x));
    if(s.sheet){if(m.plan<0.45)G.plan.push(`${lab}plan on ${(m.plan*100).toFixed(1)}%`);planTxt+=`${lab}plan visible on ${(m.plan*100).toFixed(1)}% of ${m.vw}×${m.vh}; `}}
  const moved=per.filter(p=>p.moved).map(p=>p.t.nm);const thm=`themes ${THEMES.map(t=>t.id).join('/')}${moved.length?' (layout differs in '+moved.join(', ')+')':' (same layout in all)'}`;
  const pre=n>0||s.id==='2d';const preD=pre?'':'PRECONDITION: no controls found in scope · ';
  const nm=f=>`${tag}, ${s.nm}: ${f}`;
  // mutation: head.html:266 `.top .spacer{flex:1}` → `{flex:1;min-width:2600px}` (header pushed past the right edge, page scrolls sideways) → FAIL confirmed (d1440 / d1920 dr-lib-fit and set-fit, green on the real build)
  // mutation: head.html:110 `.pop{…max-height:calc(100% - 20px);overflow:auto}` → `overflow:hidden` (Settings rows below the popover edge can no longer be scrolled to) → FAIL confirmed (lap1280 / d1440 set-fit, green on the real build)
  R.push(row(`${base}-${s.id}-fit`,nm('every control is on screen, reachable and not covered; no sideways page scroll'),pre&&!G.fit.length,preD+(ON(G.fit)||`${n} controls ok`)+' · '+thm));
  // mutation: head.html:329 `.mbar button{flex:1 1 0;` → `{flex:0 0 30px;` (phone bar slots 30 px wide) → FAIL confirmed (13 / s8 sh-draw-touch, both orientations)
  if(d.touch)R.push(row(`${base}-${s.id}-touch`,nm('touch targets are ≥ 40×40 px (or ≥ 32 with 8 px spacing)'),pre&&!G.touch.length,preD+(ON(G.touch)||`${n} targets ok`)+' · '+thm));
  // mutation: head.html:339 `.ptile{min-height:62px;` → `…white-space:nowrap;width:44px;` (Draw tile label overflows) → FAIL confirmed (13 / s8 sh-draw-text)
  // mutation: head.html:423 `input,textarea,select{font-size:16px!important}` → `14px` (fields would zoom on iOS) → FAIL confirmed (13-l / se-l sh-lib-text: lib-q 14px)
  R.push(row(`${base}-${s.id}-text`,nm(d.ios?'no text overflows its button; fields are ≥ 16 px (no iOS zoom)':'no text overflows its button'),pre&&!G.text.length,preD+(ON(G.text)||'ok')+' · '+thm));
  // mutation: head.html:335 `.psheet{…max-height:62vh;` → `height:85vh;max-height:85vh;` (sheet covers the plan) → FAIL confirmed (ipmini-p / split678-p sh-draw-plan 0%)
  if(s.sheet)R.push(row(`${base}-${s.id}-plan`,nm('at least 45% of the screen still shows the plan'),!G.plan.length,planTxt.trim()));
  // mutation: head.html:537 `id="b-undo" title="Undo (Ctrl+Z)" aria-label="Undo"` → `id="b-undo"` (icon-only button, no name) → FAIL confirmed (13-p/l, lap1280 2d-name)
  R.push(row(`${base}-${s.id}-name`,nm('every control has an accessible name'),pre&&!G.name.length,preD+(ON(G.name)||`${n} controls named`)+' · '+thm));
  for(const {t,m} of per){const thOK=t.dark?m.bgL!=null&&m.bgL<0.2:m.bgL!=null&&m.bgL>0.5;const thD=thOK?'':`PRECONDITION: ${t.nm} did not apply (body luminance ${m.bgL==null?'n/a':m.bgL.toFixed(2)}, data-theme ${m.theme}, OS dark ${m.osDark}) · `;
    const nmT=f=>`${tag}, ${t.nm}, ${s.nm}: ${f}`;
    // mutation: head.html:16+22 dark `--muted:#93a0ad` → `#3b3f47` (1.5:1 on the dark panel) → FAIL confirmed (13 / lap1280 dka + dko 2d-contrast; lt rows stay green)
    if(s.toolbar)R.push(row(`${base}-${t.id}-${s.id}-contrast`,nmT('toolbar text has contrast ≥ 4.5:1'),thOK&&m.nTxt>0&&!m.low.length,thD+(m.nTxt?'':'PRECONDITION: no toolbar text found · ')+(ON(m.low,8)||`${m.nTxt} text runs ok`)));
    // mutation: head.html:266 `@media (max-width:1100px){.credit{display:none}}` → `max-width:4000px` (credit hidden everywhere) → FAIL confirmed (lap1280 / d1920 2d-wm, all themes)
    if(s.wm)R.push(row(`${base}-${t.id}-${s.id}-wm`,nmT('the "Designed by Jeff Ying, BI" credit is visible'),thOK&&!m.wm,thD+(m.wm||'visible')))}
  if(process.env.MX_LY_T)console.log('T',d.id,o,s.id,Date.now()-T0);
  return true}

/* ---------------- rule 5: rotate mid-task ---------------- */
/* a phone browser widens the layout viewport when the page is wider than the screen (it zooms out), so innerWidth can stay above the
   screen width: wait for the resize, but measure against the screen size (pg.vp), and MEASURE flags a widened layout viewport */
async function rotateTo(pg,vp){pg.vp=vp;const cur=pg.viewportSize();if(cur&&cur.width===vp.width&&cur.height===vp.height)return;await pg.setViewportSize(vp);
  await waitFor(pg,([w,h])=>innerHeight===h&&innerWidth>=w,[vp.width,vp.height],5000).catch(()=>{});await sleep(200)}
const layoutState=pg=>ev(pg,()=>{const g=s=>document.querySelector(s);const vw=innerWidth,vh=innerHeight;
  const inV=e=>{if(!e||e.closest('[hidden]')||getComputedStyle(e).display==='none')return false;const r=e.getBoundingClientRect();return r.width>0&&r.left>=-1&&r.top>=-1&&r.right<=vw+1&&r.bottom<=vh+1};
  /* bar: anchored to the new bottom edge (top well inside, bottom within 10 px: the page's 8 px body margin already pushes it 8 px
     past the edge before any rotation, which the fit rows report) */
  const inB=e=>{if(!e||e.closest('[hidden]')||getComputedStyle(e).display==='none')return false;const r=e.getBoundingClientRect();return r.width>0&&r.left>=-1&&r.right<=vw+1&&r.top>=0&&r.top<vh-30&&r.bottom<=vh+10};
  const phone=matchMedia('(max-width:820px), (pointer:coarse) and (max-height:500px)').matches;const bar=phone?g('#mbar'):g('.dock');const pl=g('#plan').getBoundingClientRect();const main=g('#main').getBoundingClientRect();
  const sw=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);return {vw,vh,phone,bar:inB(bar),plan:[Math.round(pl.width),Math.round(pl.height)],main:[Math.round(main.width),Math.round(main.height)],hs:sw>vw+1?sw:0}});
const v3State=pg=>ev(pg,()=>{const T=window.__osp.T3(),g=s=>document.querySelector(s);const c=g('#v3c'),v=g('#v3').getBoundingClientRect();const bar=g('.v3bar').getBoundingClientRect();
  return {on:!g('#v3').hidden,cw:c.clientWidth,ch:c.clientHeight,bw:c.width,bh:c.height,pr:T&&T.renderer?T.renderer.getPixelRatio():null,vw:Math.round(v.width),vh:Math.round(v.height),aspect:T&&T.camera?+T.camera.aspect.toFixed(3):null,
    bar:bar.width>0&&bar.left>=-1&&bar.right<=innerWidth+1&&bar.top>=-1&&bar.bottom<=innerHeight+1,iw:innerWidth,ih:innerHeight}});
const v3OK=s=>s.on&&s.pr!=null&&Math.abs(s.cw-s.vw)<=2&&Math.abs(s.ch-s.vh)<=2&&Math.abs(s.bw-s.cw*s.pr)<=s.pr*2+1&&Math.abs(s.bh-s.ch*s.pr)<=s.pr*2+1&&s.aspect!=null&&Math.abs(s.aspect-s.vw/s.vh)<0.02&&s.bar;
/* re-laid out for the new viewport: bar on screen, no sideways scroll, the main area spans the new width (less its 8 px gutters) */
const layOK=(s,vp)=>s.vw===vp.width&&s.vh===vp.height&&s.bar&&!s.hs&&s.main[0]>=vp.width-24&&s.main[0]<=vp.width&&s.plan[0]>=vp.width*0.5;
const rotRow=(R,d,id,nm,pass,det)=>R.push(row(`mx-ly-${d.id}-rot-${id}`,`${d.nm}: rotating ${nm}`,pass,det));
const rotOn=id=>!reSCR||reSCR.test('rot-'+id);

// mutation: app.js:2700 `window.addEventListener('resize',()=>mbarSync());` → `…{mbarSync();if(innerWidth>innerHeight)setTool('select')}` (rotating drops the tool) → FAIL confirmed (13 / ipmini rot-tool)
// mutation: app.js:2700 same line → `…{mbarSync();P.lib=false;applyDrawers()}` (rotating closes the Library) → FAIL confirmed (13 / ipmini rot-sheet)
async function rotTool(pg,d,R,from,to){let pass=false,det='';
  try{await rotateTo(pg,from);await reset(pg);
    if(await phoneShell(pg)){await tapEl(pg,'#mbar [data-m=draw]');await tapEl(pg,'#msheet [data-pt=room]')}else await tapEl(pg,'.dock [data-tool=room]');
    const t0=await ev(pg,()=>document.querySelector('.dock .btn.on[data-tool]')?.dataset.tool);if(t0!=='room')throw new Error('PRECONDITION: Room tool not live after tapping it (tool '+t0+')');
    await rotateTo(pg,to);const L=await layoutState(pg);
    const st=await ev(pg,()=>{const g=s=>document.querySelector(s);const ph=matchMedia('(max-width:820px), (pointer:coarse) and (max-height:500px)').matches;const vis=e=>{if(!e||e.closest('[hidden]')||getComputedStyle(e).display==='none')return false;const r=e.getBoundingClientRect();return r.width>0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&r.left>=-1&&r.top>=-1};
      return {tool:g('.dock .btn.on[data-tool]')?.dataset.tool,shown:ph?(g('#mbar [data-m=draw]').classList.contains('on')&&/Room/.test(g('#mbar [data-m=draw]').textContent)):vis(g('.dock [data-tool=room].on')),chip:ph?vis(g('#esc')):true}});
    const n0=await ev(pg,()=>window.__osp.S().objs.length);const e=await emptyPt(pg);if(!e)throw new Error('no empty plan area after rotating '+JSON.stringify(L));
    await pg.drag(e,[e[0]+60,e[1]+40],10);const n1=await ev(pg,()=>window.__osp.S().objs.length);if(n1>n0)await ev(pg,()=>window.__osp.undo());const n2=await ev(pg,()=>window.__osp.S().objs.length);
    pass=st.tool==='room'&&st.shown&&st.chip&&layOK(L,to)&&n1===n0+1&&n2===n0;det={after:st,layout:L,objs:[n0,n1,n2]}}
  catch(e){det='ERR '+String(e.message||e).split('\n')[0].slice(0,240)}
  rotRow(R,d,'tool','with the Room tool live keeps the tool, its button and Cancel chip, and a room can still be drawn',pass,det);await reset(pg)}
async function rotSheet(pg,d,R,from,to){let pass=false,det='';
  try{await rotateTo(pg,from);await reset(pg);
    if(await phoneShell(pg))await tapEl(pg,'#mbar [data-m=lib]');else{await setDrawers(pg,false,false);await tapEl(pg,'#t-lib')}
    if(!(await visible(pg,'#d-lib')))throw new Error('PRECONDITION: Library did not open');
    await rotateTo(pg,to);const L=await layoutState(pg);
    const st=await ev(pg,()=>{const g=s=>document.querySelector(s);const d=g('#d-lib');const r=d.getBoundingClientRect();const q=g('#lib-q');q.scrollIntoView({block:'nearest'});const qr=q.getBoundingClientRect();const h=document.elementFromPoint(qr.left+qr.width/2,qr.top+qr.height/2);
      return {open:!d.hidden,inV:r.width>0&&r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,search:h===q,sheet:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]}});
    if(await phoneShell(pg))await tapEl(pg,'#mbar [data-m=select]');else await tapEl(pg,'#d-lib .dh [data-close]');
    const closed=await ev(pg,()=>document.querySelector('#d-lib').hidden);
    pass=st.open&&st.inV&&st.search&&layOK(L,to)&&closed;det={after:st,layout:L,closedAfter:closed}}
  catch(e){det='ERR '+String(e.message||e).split('\n')[0].slice(0,240)}
  rotRow(R,d,'sheet','with the Library open keeps it open and on screen, its search reachable, and it still closes',pass,det);await reset(pg)}

/* ---------------- 3D phase: 3d, sun, walk screens on both orientations, with the 3D and Walk rotations in between ----------------
   orientation A: 3D → Sun → Walk; rotate to B while walking (rot-walk); Walk at B; Exit walk; 3D at B; Sun at B; rotate to A in 3D (rot-3d).
   One 3D start per device keeps swiftshader time down. */
// mutation: app.js:3497 `window.addEventListener('resize',()=>{if(is3D)size3D()});` → `if(false)` (canvas not re-sized) → FAIL confirmed (13 rot-walk; 13 rot-3d run on its own fails its own assertion: backing store stays 1101×381)
async function phase3D(pg,d,R){
  const S3=id=>SCREENS.find(s=>s.id===id);const [oA,vA]=d.orients[0];const B=d.orients[1];
  await rotateTo(pg,vA);await reset(pg);await ev(pg,()=>window.__osp.fit());
  if(S3('3d'))await doScreen(pg,d,oA,S3('3d'),R);
  if(S3('sun'))await doScreen(pg,d,oA,S3('sun'),R);
  let walking=false;if(S3('walk'))walking=await doScreen(pg,d,oA,S3('walk'),R);
  if(!B)return reset(pg);
  const [oB,vB]=B;
  if(rotOn('walk')){let pass=false,det='';
    try{if(!walking){await reset(pg);await startWalk(pg)}if(!(await ev(pg,()=>window.__osp.WALK.on)))throw new Error('PRECONDITION: walk did not start');
      const s0=await v3State(pg);await rotateTo(pg,vB);await sleep(150);const s1=await v3State(pg);
      const st=await ev(pg,()=>{const g=s=>document.querySelector(s);const inV=e=>{if(!e||e.hidden||getComputedStyle(e).display==='none')return false;const r=e.getBoundingClientRect();return r.width>0&&r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};
        return {walk:window.__osp.WALK.on,hud:inV(g('#walk-hud')),joy:matchMedia('(pointer:coarse)').matches?inV(g('#joy')):true}});
      if(S3('walk'))await doScreen(pg,d,oB,S3('walk'),R,{enter:false});
      const ex=await visible(pg,'#v3-walk')?'#v3-walk':'#b-walk';await tapEl(pg,ex);await waitFor(pg,()=>!window.__osp.WALK.on,null,3000).catch(()=>{});const out=await ev(pg,()=>!window.__osp.WALK.on);
      pass=st.walk&&st.hud&&st.joy&&v3OK(s1)&&s1.vw!==s0.vw&&out;det={after:st,before3D:s0,after3D:s1,exitBy:ex,exited:out}}
    catch(e){det='ERR '+String(e.message||e).split('\n')[0].slice(0,240)}
    rotRow(R,d,'walk','in Walk keeps walking, re-lays out the view, HUD and stick, and Exit walk still works',pass,det)}
  await reset(pg,{keep3D:true});await rotateTo(pg,vB);
  if(S3('3d'))await doScreen(pg,d,oB,S3('3d'),R);
  if(S3('sun'))await doScreen(pg,d,oB,S3('sun'),R);
  if(rotOn('3d')){let pass=false,det='';
    try{await reset(pg,{keep3D:true});await go3D(pg);const s0=await v3State(pg);if(!v3OK(s0))throw new Error('PRECONDITION: 3D not laid out before rotating '+JSON.stringify(s0));
      await rotateTo(pg,vA);await sleep(150);const s1=await v3State(pg);await tapEl(pg,'#v2d');const back=await ev(pg,()=>document.querySelector('#v3').hidden);
      pass=v3OK(s1)&&s1.vw!==s0.vw&&back;det={before:s0,after:s1,back2D:back}}
    catch(e){det='ERR '+String(e.message||e).split('\n')[0].slice(0,240)}
    rotRow(R,d,'3d','in 3D re-sizes the canvas, renderer and camera, keeps the 3D bar on screen, and 2D still works',pass,det)}
  await reset(pg)}

/* ---------------- rule 6: the on-screen keyboard ---------------- */
// mutation: head.html:352 `#main .drawer{…bottom:calc(58px + env(…))!important;` + `transform:translateY(min(0px,(100vh - 600px)))` (short viewports push the sheet off the top) → FAIL confirmed (13-p kbd-lib, green on the real build)
async function keyboard(pg,d,o,vp,R){
  if(!(await phoneShell(pg))||!d.touch)return;const vvH=await ev(pg,()=>/visualViewport\.(addEventListener|onresize)/.test(document.documentElement.innerHTML));
  const one=async(id,nm,open,field)=>{if(reSCR&&!reSCR.test('kbd-'+id))return;let pass=false,det='';
    try{await reset(pg);await ev(pg,()=>window.__osp.fit());await open();await tapEl(pg,field);await waitFor(pg,f=>document.activeElement===document.querySelector(f),field,3000).catch(()=>{});
      const f0=await ev(pg,f=>document.activeElement===document.querySelector(f),field);if(!f0)throw new Error('PRECONDITION: tapping '+field+' did not focus it');
      const H=Math.round(vp.height*0.55);await pg.setViewportSize({width:vp.width,height:H});await waitFor(pg,h=>innerHeight===h,H,3000).catch(()=>{});await sleep(200);
      const st=await ev(pg,f=>{const e=document.querySelector(f);const r=e.getBoundingClientRect();const h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        return {focus:document.activeElement===e,rect:[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)],vh:innerHeight,inV:r.width>0&&r.top>=-1&&r.bottom<=innerHeight+1&&r.left>=-1&&r.right<=innerWidth+1,hit:h===e||e.contains(h)}},field);
      pass=st.focus&&st.inV&&st.hit;det={...st,visualViewportHandler:vvH}}
    catch(e){det='ERR '+String(e.message||e).split('\n')[0].slice(0,220)}
    await pg.setViewportSize(vp);await waitFor(pg,([w,h])=>innerWidth===w&&innerHeight===h,[vp.width,vp.height],3000).catch(()=>{});await sleep(120);
    R.push(row(`mx-ly-${d.id}-${o}-kbd-${id}`,`${d.nm} ${o==='p'?'portrait':'landscape'}: with the keyboard up, ${nm} stays visible and focused`,pass,det))};
  await one('lib','the Library search field',()=>tapEl(pg,'#mbar [data-m=lib]'),'#lib-q');
  await one('det','Details → Label on plan',async()=>{await selectItem(pg,true);await tapEl(pg,'#mbar [data-m=insp]');await waitFor(pg,()=>!!document.querySelector('#p-sel [data-f=label]'),null,5000)},'#p-sel [data-f=label]');
  await reset(pg)}

/* ---------------- rule 7b/c: modals ---------------- */
// mutation: head.html `id="plans-modal" hidden role="dialog"` → `id="plans-modal" hidden` → FAIL confirmed (a11y-plans-role)
// mutation: app.js `if(!$('#keys-modal').hidden&&e.key==='Escape'){$('#keys-modal').hidden=true;return}` → `…{return}` (Esc no longer closes Shortcuts) → FAIL confirmed (a11y-keys-close on desktops)
// mutation (inverse, focus fails on the real build): app.js same Esc line → `…{$('#keys-modal').hidden=true;$('#b-more').focus();return}` (focus back to the menu button) → a11y-keys-focus PASS confirmed
const MODALS=[
  {id:'plans',nm:'My plans',sel:'#plans-modal',close:'#plans-modal [data-pclose]',dialog:true,open:async pg=>{if(await phoneShell(pg))await moreTile(pg,'m-plans');else await openMenuItem(pg,'m-plans')}},
  {id:'keys',nm:'Shortcuts',sel:'#keys-modal',close:'#keys-modal [data-kclose]',dialog:true,open:pg=>openMenuItem(pg,'m-keys')},
  {id:'guide',nm:'User guide',sel:'#guide-modal',close:'#guide-modal [data-gclose]',dialog:true,open:async pg=>{if(await phoneShell(pg))await moreTile(pg,'m-guide');else await openMenuItem(pg,'m-guide')}},
  {id:'snaps',nm:'Snapshots',sel:'#snap-modal',close:'#snap-close',dialog:true,open:async pg=>{if(await phoneShell(pg))await moreTile(pg,'m-snaps');else await openMenuItem(pg,'m-snaps')}},
  {id:'set',nm:'Settings (popover)',sel:'#pop-set',close:null,dialog:false,open:async pg=>{if(await phoneShell(pg))await moreTile(pg,'b-set');else await tapEl(pg,'#b-set')}}];
async function modals(pg,d,o,R){
  const tag=`${d.nm} ${o==='p'?'portrait':'landscape'}`;
  for(const M of MODALS){if(reSCR&&!reSCR.test('a11y-'+M.id))continue;const id=`mx-ly-${d.id}-${o}-a11y-${M.id}`;
    let a=null,b=null,how='',err=null;
    try{await reset(pg);await M.open(pg);await waitFor(pg,s=>!document.querySelector(s).hidden,M.sel,3000);
      a=await ev(pg,s=>{const e=document.querySelector(s);const lb=e.getAttribute('aria-labelledby');return {role:e.getAttribute('role'),name:(e.getAttribute('aria-label')||(lb&&document.getElementById(lb)?document.getElementById(lb).textContent:'')||'').trim()}},M.sel);
      if(!d.touch){await pg.keyboard.press('Escape');how='Esc'}else if(M.close){await tapEl(pg,M.close);how='its ✕'}else{const e=await outsidePt(pg,M.sel);if(!e)throw new Error(M.nm+' covers every bit of the plan: nowhere to tap outside it');await pg.tap(e[0],e[1]);how='a tap on the plan outside it'}
      await waitFor(pg,s=>document.querySelector(s).hidden,M.sel,1500).catch(()=>{});
      b=await ev(pg,s=>{const ae=document.activeElement;return {closed:document.querySelector(s).hidden,focus:!ae||ae===document.body||ae===document.documentElement?'body':(ae.id?'#'+ae.id:ae.tagName.toLowerCase()+(typeof ae.className==='string'&&ae.className?'.'+ae.className.split(' ')[0]:''))}},M.sel)}
    catch(e){err='ERR '+String(e.message||e).split('\n')[0].slice(0,220)}
    if(M.dialog)R.push(row(id+'-role',`${tag}: ${M.nm} is a dialog (role=dialog) with an accessible name`,!err&&a.role==='dialog'&&!!a.name,err||{role:a.role,name:a.name}));
    R.push(row(id+'-close',`${tag}: ${M.nm} closes with ${d.touch?(M.close?'its ✕':'a tap outside'):'Esc'}`,!err&&b.closed,err||{closedBy:how,closed:b.closed}));
    R.push(row(id+'-focus',`${tag}: after closing ${M.nm}, focus is not dropped to <body>`,!err&&b.closed&&b.focus!=='body',err||{closedBy:how,closed:b.closed,focusAfter:b.focus}))}
  await reset(pg)}

/* ---------------- run ---------------- */
async function device(b,d){
  const R=[];let pg;const g=x=>!reGRP||reGRP.test(x);
  try{pg=await openDev(b,d);const two=d.orients.length>1;
    for(let i=0;i<d.orients.length;i++){const [o,vp]=d.orients[i];await rotateTo(pg,vp);await reset(pg);await ev(pg,()=>window.__osp.fit());
      if(g('screens'))for(const s of SCREENS){if(s.three)continue;const shell=(await phoneShell(pg))?'phone':'desk';if(s.shell&&s.shell!==shell)continue;if(s.touch&&!d.touch)continue;await doScreen(pg,d,o,s,R)}
      if(g('screens'))await menuLift(pg,d,o,R);
      if(g('kbd'))await keyboard(pg,d,o,vp,R);
      if(g('a11y'))await modals(pg,d,o,R);
      if(two&&d.rot&&g('rot')){if(i===0&&rotOn('tool'))await rotTool(pg,d,R,vp,d.orients[1][1]);if(i===1&&rotOn('sheet'))await rotSheet(pg,d,R,vp,d.orients[0][1])}}
    if((g('screens')||g('rot'))&&(FULL3D||d.rep3D))await phase3D(pg,d,R);
    R.push(row(`mx-ly-${d.id}-errors`,`${d.nm}: no console errors across the layout run`,pg.errs.length===0,pg.errs.slice(0,5)))}
  catch(e){R.push(row(`mx-ly-${d.id}-crash`,`${d.nm}: layout run completed`,false,String(e.stack||e).slice(0,400)))}
  finally{if(pg)await pg.ctx.close().catch(()=>{})}
  return R}

export async function run(b){
  const list=DEVICES.filter(d=>!reDEV||reDEV.test(d.id));
  /* heaviest first so the pool finishes together */
  const w=d=>d.orients.length*(d.vp.width*d.vp.height*d.dpr*d.dpr)**0.3;const q=list.slice().sort((a,b2)=>w(b2)-w(a));const out=new Map();
  await Promise.all(Array.from({length:Math.min(PAR,q.length)},async()=>{while(q.length){const d=q.shift();out.set(d.id,await device(b,d))}}));
  const R=list.flatMap(d=>out.get(d.id)||[]);const seen=new Set();for(const r of R){if(seen.has(r.id))throw new Error('duplicate id '+r.id);seen.add(r.id)}
  return R}
