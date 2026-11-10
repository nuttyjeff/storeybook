/* matrix slice: robustness, invariants, data safety and security (ids mx-rb-*).
   1 fuzz     seeded monkey test on desktop (mouse + keys), iPad (Apple Pencil + finger) and iPhone (touch): random real input drawn
              from the live DOM's visible enabled controls plus canvas gestures, with invariants checked after every action, then undo
              everything back to the start and redo everything forward again. The seed is in every row's detail (SB_SEED=<n> replays it).
   2 files    broken, foreign, future and huge plan files through the app's own Open dialog (file chooser), with timing budgets.
   3 inject   HTML / script payloads typed into every name field, put in an opened plan file and in an imported library CSV.
   4 persist  autosave timing, reload restore, two pages on one origin, storage quota exceeded.
   5 undo     one undo and one redo per action type restore the exact JSON.
   The debug hook only reads state and sets up preconditions; the OS file / save dialogs are the only things stubbed. */
import fs from 'fs';import path from 'path';
import {devices,devFile,row,ROOT} from '../../lib.mjs';
export const name='matrix-robust';
const ID='mx-rb-';
const URL_=()=>process.env.SB_URL||devFile();
const SCR='/tmp/mx-rb';
const ev=(pg,fn,arg)=>pg.evaluate(fn,arg);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitF=(pg,fn,arg,timeout=5000)=>pg.waitForFunction(fn,arg,{timeout,polling:50}).then(()=>true,()=>false);
async function waitA(pg,fn,arg,timeout=5000){const t0=Date.now();while(Date.now()-t0<timeout){try{if(await pg.evaluate(fn,arg))return true}catch(e){}await sleep(100)}return false}

/* ---------------- pages ---------------- */
/* OS dialogs: the save picker is cancelled by the "user"; the open picker hands over window.__openFile or is cancelled */
const INIT=()=>{window.__pwned=0;window.__saved=[];
  window.showSaveFilePicker=async o=>{const name=(o&&o.suggestedName)||'file';return {name,kind:'file',createWritable:async()=>{const parts=[];return {write:async d=>{parts.push(d)},close:async()=>{window.__saved.push({name,blob:new Blob(parts)})}}}}};
  window.showOpenFilePicker=undefined;
  const ac=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.__saved.push({name:this.download,href:this.href});return}return ac.call(this)}};
const DEV={
  desktop:()=>({viewport:{width:1400,height:900}}),
  ipad:()=>{const d=devices['iPad Pro 11 landscape'];return {...d,defaultBrowserType:undefined,hasTouch:true}},
  iphone:()=>{const d=devices['iPhone 13'];return {...d,defaultBrowserType:undefined}}};
async function openPage(b,kind='desktop',{ctx=null,sample=true,init=null}={}){
  const own=!ctx;if(!ctx){ctx=await b.newContext(DEV[kind]());await ctx.addInitScript(INIT);if(init)await ctx.addInitScript(init)}
  const pg=await ctx.newPage();pg.kind=kind;pg.ctx=ctx;pg.own=own;pg.errs=[];pg.dlog=[];pg.chooser=0;
  pg.on('pageerror',e=>pg.errs.push('PE:'+e.message));pg.on('console',m=>{if(m.type()==='error')pg.errs.push(m.text().slice(0,300))});
  pg.on('dialog',async d=>{const t=d.type();pg.dlog.push(t);try{if(t==='confirm'&&pg.confirmYes)await d.accept();else if(t==='prompt'&&pg.promptVal!=null)await d.accept(pg.promptVal);else await d.dismiss()}catch(e){}});
  pg.on('filechooser',fc=>{pg.chooser++;if(pg.onChooser){const f=pg.onChooser;pg.onChooser=null;f(fc)}});
  pg.on('popup',p=>p.close().catch(()=>{}));
  await pg.goto(URL_(),{waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,{timeout:20000});
  if(sample){const j=await sampleJSON(b);await ev(pg,j=>{const o=window.__osp;o.openPlanText(j,'sample.json');o.toastOff()},j);await sleep(150)}
  if(kind!=='desktop'){pg.cdp=await ctx.newCDPSession(pg);const cdp=pg.cdp;
    const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(p=>({x:p[0],y:p[1],id:p[2]??0}))});
    const M=(type,x,y,extra={})=>cdp.send('Input.dispatchMouseEvent',Object.assign({type,x,y,pointerType:'pen'},extra));
    pg.fin={tap:async(x,y)=>{await T('touchStart',[[x,y]]);await sleep(20);await T('touchEnd',[]);await sleep(40)},
      drag:async(a,c,n=10)=>{await T('touchStart',[a]);for(let i=1;i<=n;i++){await T('touchMove',[[a[0]+(c[0]-a[0])*i/n,a[1]+(c[1]-a[1])*i/n]]);await sleep(16)}await T('touchEnd',[]);await sleep(60)},
      hold:async(x,y,ms=700)=>{await T('touchStart',[[x,y]]);await sleep(ms);await T('touchEnd',[]);await sleep(60)},
      pinch:async(c,r0,r1,n=8)=>{const P=r=>[[c[0]-r,c[1],1],[c[0]+r,c[1],2]];await T('touchStart',P(r0));for(let i=1;i<=n;i++){await T('touchMove',P(r0+(r1-r0)*i/n));await sleep(16)}await T('touchEnd',[]);await sleep(60)}};
    pg.pen={tap:async(x,y)=>{await M('mouseMoved',x,y);await M('mousePressed',x,y,{button:'left',buttons:1,clickCount:1});await M('mouseReleased',x,y,{button:'left',buttons:0,clickCount:1});await sleep(50)},
      drag:async(a,c,n=10)=>{await M('mouseMoved',a[0],a[1]);await M('mousePressed',a[0],a[1],{button:'left',buttons:1,clickCount:1});for(let i=1;i<=n;i++){await M('mouseMoved',a[0]+(c[0]-a[0])*i/n,a[1]+(c[1]-a[1])*i/n,{button:'left',buttons:1});await sleep(16)}await M('mouseReleased',c[0],c[1],{button:'left',buttons:0,clickCount:1});await sleep(60)},
      hold:async(x,y,ms=700)=>{await M('mouseMoved',x,y);await M('mousePressed',x,y,{button:'left',buttons:1,clickCount:1});await sleep(ms);await M('mouseReleased',x,y,{button:'left',buttons:0,clickCount:1});await sleep(60)}}}
  return pg}
async function closePage(pg){try{await Promise.race([pg.own?pg.ctx.close():pg.close(),sleep(6000)])}catch(e){}}
/* the sample office floor, taken once from a throwaway page (the dev loader skips ensureBld, so it is reopened the way a file is) */
let SAMPLE=null;
async function sampleJSON(b){if(SAMPLE)return SAMPLE;SAMPLE=(async()=>{const ctx=await b.newContext({viewport:{width:1400,height:900}});const pg=await ctx.newPage();
  await pg.goto(URL_(),{waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,{timeout:20000});
  const j=await ev(pg,()=>{document.querySelector('#m-sample').click();return window.__osp.planJSON()});await ctx.close();return j})();return SAMPLE}

/* real input at a point / on an element */
async function tapAt(pg,x,y,how){if(pg.kind==='desktop')return pg.mouse.click(x,y);if(how==='pen')return pg.pen.tap(x,y);return pg.fin.tap(x,y)}
async function where(pg,sel,nth=0){return ev(pg,([s,n])=>{const e=document.querySelectorAll(s)[n];if(!e)return {err:'missing'};
  e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(e).visibility==='hidden')return {err:'not shown'};
  const x=r.left+r.width/2,y=r.top+r.height/2;if(x<0||y<0||x>innerWidth||y>innerHeight)return {err:'off screen'};
  const t=document.elementFromPoint(x,y);return {x,y,hit:!!t&&(t===e||e.contains(t)),top:t?(t.id?'#'+t.id:String(t.className&&t.className.baseVal!=null?t.className.baseVal:t.className)||t.tagName):null}},[sel,nth])}
async function press(pg,sel,nth=0,how){let c=await where(pg,sel,nth);
  if(!c.err&&!c.hit&&c.top==='#toast'){await ev(pg,()=>window.__osp.toastOff());c=await where(pg,sel,nth)}
  if(c.err||!c.hit)throw new Error(`${sel} is not reachable on screen (${c.err||'covered by '+c.top})`);await tapAt(pg,c.x,c.y,how);await sleep(60);return c}
async function menu(pg,id){
  if(pg.kind==='iphone'){const inMore=await ev(pg,()=>!!document.querySelector('#mbar [data-m=more]'));
    if(inMore){await press(pg,'#mbar [data-m=more]');if(await waitF(pg,id=>!document.querySelector('#msheet').hidden&&!!document.querySelector(`#msheet [data-pm="${id}"]`),id,1500)){await press(pg,`#msheet [data-pm="${id}"]`);return}
      await ev(pg,()=>{const g=document.querySelector('#msheet [data-msheet-close]');if(g&&!document.querySelector('#msheet').hidden)g.click()})}}
  await press(pg,'#b-more');if(!await waitF(pg,()=>!document.querySelector('#pop-more').hidden,null,2000))throw new Error('menu did not open');await press(pg,'#'+id)}
async function chooseFile(pg,opener,file){let h;const got=new Promise((res,rej)=>{h=setTimeout(()=>{pg.onChooser=null;rej(new Error('no file chooser'))},10000);pg.onChooser=async fc=>{clearTimeout(h);try{await fc.setFiles(file);res(fc)}catch(e){rej(e)}}});
  got.catch(()=>{});try{await opener()}catch(e){clearTimeout(h);pg.onChooser=null;throw e}return got}
const toastText=pg=>ev(pg,()=>{const t=document.querySelector('#toast');return t&&!t.hidden?t.textContent:''});
/* plan text comparable across undo: drop the save stamp */
/* plan text comparable across undo: drop the save stamp, and treat an absent field and its empty value ('' / [] / null) as the same.
   Snapshots are left out: they are version control kept outside the undo history on purpose (snapTake never checkpoints). */
const canon=pg=>ev(pg,()=>{const p=JSON.parse(window.__osp.planJSON());delete p.saved;delete p.appVersion;delete p.snaps;
  for(const k of Object.keys(p)){const v=p[k];if(v==null||v===''||(Array.isArray(v)&&!v.length))delete p[k]}return JSON.stringify(Object.fromEntries(Object.keys(p).sort().map(k=>[k,p[k]])))});
function diffKeys(a,b){try{const A=JSON.parse(a),B=JSON.parse(b);const out=[];for(const k of new Set([...Object.keys(A),...Object.keys(B)]))if(JSON.stringify(A[k])!==JSON.stringify(B[k]))out.push(k);
  if(out.includes('objs')){const ma=new Map(A.objs.map(o=>[o.id,JSON.stringify(o)])),mb=new Map(B.objs.map(o=>[o.id,JSON.stringify(o)]));const d=[];for(const[k,v]of ma)if(mb.get(k)!==v)d.push(k);for(const k of mb.keys())if(!ma.has(k))d.push('+'+k);out.push('objs:'+d.length+' '+d.slice(0,4).join(','))}return out}catch(e){return ['? '+String(e.message).slice(0,60)]}}

/* ======================= 1. fuzz with invariants ======================= */
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
/* checked after every action, in the page */
const INV=()=>{const o=window.__osp,S=o.S(),out={};
  try{const p=JSON.parse(o.planJSON());o.migratePlan(p);out.json=''}catch(e){out.json=String(e.message||e).slice(0,120)}
  const bad=[];const walk=(v,p,d)=>{if(bad.length>3||d>9)return;if(typeof v==='number'){if(!isFinite(v))bad.push(p+'='+v);return}
    if(v&&typeof v==='object'){if(Array.isArray(v)){for(let i=0;i<v.length;i++)walk(v[i],p+'['+i+']',d+1)}else for(const k in v){if(k==='src'||k==='snaps')continue;walk(v[k],p+'.'+k,d+1)}}};
  walk(S.objs,'objs',0);walk(S.bld,'bld',0);walk(S.pins,'pins',0);walk(S.underlay,'u',0);out.fin=bad;
  const dup=[];const chk=(arr,w)=>{const s=new Set();(arr||[]).forEach(x=>{if(!x||x.id==null||x.id===''){dup.push(w+':no id');return}if(s.has(x.id))dup.push(w+':'+x.id);s.add(x.id)})};
  chk(S.objs,'objs');if(S.bld&&Array.isArray(S.bld.levels))S.bld.levels.forEach((l,i)=>chk([...(l.unique?(l.base||[]):(S.bld.typical||[])),...(l.fit||[])],'level'+i));chk(S.pins,'pins');out.dup=dup.slice(0,4);
  const ids=new Set(S.objs.map(x=>x.id));out.sel=o.sel().filter(id=>!ids.has(id)).slice(0,4);
  /* every open dialog / sheet has a way out the user can see and reach */
  const vis=e=>{if(!e||e.hidden)return false;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
  /* reachable: on screen and on top, or only covered by a popover menu or the toast, which an outside tap / a moment clears */
  const reach=e=>{if(!vis(e))return false;const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;if(x<0||y<0||x>innerWidth||y>innerHeight)return false;const t=document.elementFromPoint(x,y);return !!t&&(t===e||e.contains(t)||!!t.closest('.pop,#toast'))};
  const stuck=[];
  document.querySelectorAll('.keys-modal').forEach(m=>{if(vis(m)&&![...m.querySelectorAll('[aria-label=Close],[data-pclose],[data-kclose],[data-gclose]')].some(reach))stuck.push('#'+m.id)});
  const ms=document.querySelector('#msheet');if(vis(ms)&&![...ms.querySelectorAll('[data-msheet-close]')].some(reach))stuck.push('#msheet');
  document.querySelectorAll('.pop').forEach(p=>{if(!vis(p))return;const r=p.getBoundingClientRect();if(r.right<4||r.bottom<4||r.left>innerWidth-4||r.top>innerHeight-4)stuck.push('#'+p.id+' off screen')});
  if(o.WALK.on&&!reach(document.querySelector('#v3-walk')))stuck.push('walk with no Exit walk');
  out.stuck=stuck;
  /* tool state shown consistently: one dock tool lit, the plan cursor matches it, the phone Draw slot names it, the phone Done chip shows while a tool is live */
  const tl=[];const on=[...document.querySelectorAll('.dock [data-tool].on')];if(on.length>1)tl.push('dock lit: '+on.map(b=>b.dataset.tool).join('+'));
  const is3=!document.querySelector('#v3').hidden;const svg=document.querySelector('#plan');
  if(!is3&&!o.WALK.on&&o.dragM()==null){const cur=svg.style.cursor;
    if(on.length===1){const t=on[0].dataset.tool,want=t==='select'?'default':t==='pan'?'grab':'crosshair';if(cur!==want)tl.push(`dock ${t} but cursor ${cur}`)}
    /* no dock button lit is only right for the tools that have none (placing from the library, adding a point), which draw with the crosshair */
    else if(on.length===0&&cur!=='crosshair')tl.push(`no dock tool lit but cursor ${cur||'unset'}`)}
  if(innerWidth<=820){const dl=document.querySelector('#mbar [data-m=draw] span');const lab=dl?dl.textContent.trim():'';if(lab!=='Draw'&&!(on.length===1&&on[0].textContent.trim()===lab))tl.push(`mbar Draw says ${lab}, dock ${on.map(b=>b.dataset.tool)}`);
    const esc=document.querySelector('#esc');if(!o.WALK.on&&on.length===1&&on[0].dataset.tool!=='select'&&esc&&esc.hidden)tl.push(`tool ${on[0].dataset.tool} live with no Done chip`)}
  out.tool=tl;return out};
const INVK=['err','json','fin','dup','sel','stuck','tool'];
const INVN={err:'no console or page error',json:'planJSON parses and migratePlan accepts it',fin:'no NaN or Infinity in any coordinate or size',dup:'every object id is unique',sel:'the selection only holds existing objects',
  stuck:'no dialog, sheet or menu is left open without a reachable way out',tool:'the tool state matches the UI (dock highlight, cursor, phone Draw slot and Done chip)',undo:'undo all returns the exact starting plan',redo:'redo all returns the exact end plan'};
/* controls a user can see and reach now; only the session-destroying ones are left out */
const CANDS=()=>{const vis=e=>{const r=e.getBoundingClientRect();if(r.width<4||r.height<4)return null;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.pointerEvents==='none')return null;
    const x=r.left+r.width/2,y=r.top+r.height/2;if(x<2||y<2||x>innerWidth-2||y>innerHeight-2)return null;const t=document.elementFromPoint(x,y);if(!t||!(t===e||e.contains(t)))return null;return [x,y]};
  /* session-destroying (Clear data, the dev sample loader, reload, links away) and the 3D entries, which the fuzz takes on a schedule instead (see VIEW3D) */
  const NO='#m-wipe,[data-sv=wipe],#m-sample,#upd-go,a[href],#b-walk,#v3-walk,#vbld,#v3d,#b-view,#v3-pov';const tabs=document.querySelectorAll('#ptabs .ptab').length;
  const out=[];document.querySelectorAll('button,[role=button],.mi,.lib-row,input,select,textarea,.ptab,[data-tab],[data-pm],[data-m],label.sw').forEach(e=>{
    if(e.disabled||e.closest('[hidden]')||e.matches(NO)||e.closest(NO))return;if(e.matches('[data-tab-close]')&&tabs<2)return;if(e.type==='file')return;
    const p=vis(e.matches('label.sw')?e:e);if(!p)return;const tag=e.tagName.toLowerCase(),ty=(e.type||'').toLowerCase();
    const kind=tag==='select'?'select':tag==='textarea'||(tag==='input'&&!['checkbox','radio','button','submit','range','color'].includes(ty))?'field':tag==='input'&&ty==='range'?'range':'click';
    out.push({x:p[0],y:p[1],kind,ty,label:(e.id?'#'+e.id:'')+(e.dataset&&Object.keys(e.dataset).length?'['+Object.entries(e.dataset).map(([k,v])=>k+'='+v).join(' ').slice(0,40)+']':'')||(e.textContent||e.getAttribute('aria-label')||tag).trim().slice(0,24)})});
  return out};
const CANVAS=(seedPts)=>{const is3=!document.querySelector('#v3').hidden;const host=is3?document.querySelector('#v3c'):document.querySelector('#plan');const r=host.getBoundingClientRect();
  const ok=(x,y)=>{const t=document.elementFromPoint(x,y);return !!t&&(is3?(t===host||t.id==='d3ov'||!!t.closest('#d3ov')):!!t.closest('#plan'))};
  const pts=[];for(const[fx,fy]of seedPts){const x=r.left+12+fx*(r.width-24),y=r.top+12+fy*(r.height-24);if(ok(x,y))pts.push([x,y])}
  const objs=[];if(!is3)document.querySelectorAll('#plan [data-id]').forEach(e=>{if(objs.length>40)return;const q=e.getBoundingClientRect();if(q.width<8||q.height<8)return;const x=q.left+q.width/2,y=q.top+q.height/2;if(x<r.left||y<r.top||x>r.right||y>r.bottom)return;const t=document.elementFromPoint(x,y);if(t&&t.closest('[data-id]')===e)objs.push([x,y])});
  return {pts,objs,is3}};
const FIELDV=['0','-5','1e9','abc','','12.5','-0','99999999','NaN','2500','.','-1e400','<b>x</b>','3000','45','1,5'];
const KEYS=['v','h','d','w','u','m','t','p','r','R','x','s','c','q','l','i','f','+','-','2','Escape','Escape','Delete','Backspace','Enter','ArrowLeft','ArrowUp','PageUp','PageDown','?','5','0','Control+z','Control+y','Control+d','Control+a','Control+g','Control+Shift+G','Control+c','Control+v','Control+x','Control+s','Control+o'];

async function fuzzOne(b,kind,seed,N,add){
  const P=`${ID}fz-${kind}-`,S={desktop:'desktop',ipad:'iPad (Pencil + finger)',iphone:'iPhone'}[kind];const R=rng(seed),pick=a=>a[Math.floor(R()*a.length)];
  const fail={};INVK.forEach(k=>fail[k]=null);let pg=null;const log=[];let step=0;
  const note=(k,v)=>{if(!fail[k])fail[k]={step,last:log.slice(-4),v}};
  try{pg=await openPage(b,kind);pg.confirmYes=false;
    const tab0=await ev(pg,()=>window.__osp.curTab().id);const start=await canon(pg);const n0=await ev(pg,()=>window.__osp.S().objs.length);
    const how=()=>kind==='ipad'?(R()<0.5?'pen':'finger'):kind==='iphone'?'finger':'mouse';
    const gesture=async(k)=>{const sp=Array.from({length:6},()=>[R(),R()]);const c=await ev(pg,CANVAS,sp);const h=how();
      const a=(c.objs.length&&R()<0.55)?pick(c.objs):c.pts[0];const z=c.pts[1]||c.pts[0];if(!a||!z)return 'no canvas point';
      if(k==='tap'){await tapAt(pg,a[0],a[1],h);return `${h} tap ${a.map(Math.round)}`}
      if(k==='drag'){const to=R()<0.5?[a[0]+(R()-.5)*160,a[1]+(R()-.5)*160]:z;if(kind==='desktop'){await pg.mouse.move(a[0],a[1]);await pg.mouse.down();for(let i=1;i<=8;i++){await pg.mouse.move(a[0]+(to[0]-a[0])*i/8,a[1]+(to[1]-a[1])*i/8);await sleep(12)}await pg.mouse.up()}else await (h==='pen'?pg.pen:pg.fin).drag(a,to,8);return `${h} drag ${a.map(Math.round)}→${to.map(Math.round)}`}
      if(k==='long'){if(kind==='desktop'){await pg.mouse.click(a[0],a[1],{button:'right'});return `right-click ${a.map(Math.round)}`}await (h==='pen'?pg.pen:pg.fin).hold(a[0],a[1],650);return `${h} long-press ${a.map(Math.round)}`}
      if(k==='pinch'){if(kind==='desktop'){await pg.mouse.move(a[0],a[1]);await pg.mouse.wheel(0,(R()-.5)*600);return 'wheel'}await pg.fin.pinch(a,40,40+(R()-.4)*120);return 'pinch'}
      if(k==='dbl'){if(kind==='desktop'){await pg.mouse.dblclick(a[0],a[1])}else{await tapAt(pg,a[0],a[1],h);await tapAt(pg,a[0],a[1],h)}return `${h} double tap`}};
    const control=async(filter)=>{let c=await ev(pg,CANDS);if(filter)c=c.filter(filter);if(!c.length)return 'no control';const t=pick(c);const h=how();
      if(t.kind==='select'){await tapAt(pg,t.x,t.y,h);const v=await ev(pg,([x,y,r])=>{const e=document.elementFromPoint(x,y);const s=e&&e.closest('select');if(!s||!s.options.length)return null;return s.options[Math.floor(r*s.options.length)].value},[t.x,t.y,R()]);
        if(v!=null){const el=await pg.evaluateHandle(([x,y])=>document.elementFromPoint(x,y).closest('select'),[t.x,t.y]);await el.asElement().selectOption(v).catch(()=>{})}await ev(pg,()=>document.activeElement&&document.activeElement.blur&&document.activeElement.blur());return `select ${t.label}=${v}`}
      if(t.kind==='field'){await tapAt(pg,t.x,t.y,h);const v=pick(FIELDV);await ev(pg,()=>{const e=document.activeElement;if(e&&e.select)try{e.select()}catch(x){}});if(v)await pg.keyboard.type(v,{delay:0});else await pg.keyboard.press('Backspace');await pg.keyboard.press(R()<0.7?'Enter':'Tab');
        await ev(pg,()=>document.activeElement&&document.activeElement.blur&&document.activeElement.blur());return `field ${t.label}=${JSON.stringify(v)}`}
      if(t.kind==='range'){if(kind==='desktop'){await pg.mouse.click(t.x+(R()-.5)*40,t.y)}else await pg.fin.tap(t.x+(R()-.5)*40,t.y);return `range ${t.label}`}
      await tapAt(pg,t.x,t.y,h);return `${h} ${t.label}`};
    const ACTS=[['ctl',30],['tap',11],['drag',12],['long',4],['pinch',3],['dbl',2],['tool',8],['key',kind==='desktop'?9:0],['esc',3],['undo',5],['redo',3],['selslot',kind==='iphone'?3:0]];
    const tot=ACTS.reduce((a,x)=>a+x[1],0);const choose=()=>{let r=R()*tot;for(const[k,w]of ACTS){if((r-=w)<0)return k}return 'ctl'};
    /* 3D: on swiftshader every 3D frame is expensive, so each run makes a fixed number of 3D visits at seeded steps: switch with the
       2D/3D button, act there (orbit drags, taps, 3D bar controls), switch back. Walk and the building view are left to the 3D slices. */
    const V3=+(process.env.SB_FUZZ_3D||2),v3at=new Set(Array.from({length:V3},(_,i)=>Math.floor(N*(i+1)/(V3+1))));let in3=0;
    for(step=1;step<=N;step++){let k=choose();if(v3at.has(step))k='view';if(in3&&await ev(pg,()=>document.querySelector('#v3').hidden))in3=0;if(in3){k=in3>=3?'view':pick(['drag','tap','ctl','pinch']);in3++}let d='';const e0=pg.errs.length;
      try{if(['tap','drag','long','pinch','dbl'].includes(k))d=await gesture(k);
        else if(k==='ctl')d=await control();
        else if(k==='tool')d=await control(c=>/data-tool=|data-m=|data-shape=|data-mt=|data-tool/.test(c.label)||/^\[tool/.test(c.label));
        else if(k==='key'){const key=pick(KEYS);await pg.keyboard.press(key);d='key '+key}
        else if(k==='esc'){const c=await where(pg,'#esc');if(!c.err&&c.hit){await tapAt(pg,c.x,c.y,how());d='Done chip'}else if(kind==='desktop'){await pg.keyboard.press('Escape');d='key Escape'}else d=await control(c=>c.label==='#esc'||/close|msheet-close/i.test(c.label))}
        else if(k==='undo'||k==='redo'){const c=await where(pg,'#b-'+k);if(!c.err&&c.hit){await tapAt(pg,c.x,c.y,how());d=k+' button'}else d=k+' button not reachable'}
        else if(k==='view'){const to3=await ev(pg,()=>document.querySelector('#v3').hidden);let c=await where(pg,'#b-view');if(c.err||!c.hit)c=await where(pg,to3?'#v3d':'#v2d');
          if(!c.err&&c.hit){await tapAt(pg,c.x,c.y,how());const ok=await waitF(pg,to3=>to3?(!document.querySelector('#v3').hidden&&window.__osp.T3()&&!!window.__osp.T3().renderer):document.querySelector('#v3').hidden,to3,30000);d=(to3?'to 3D':'to 2D')+(ok?'':' (did not switch)');in3=to3&&ok?1:0;if(to3&&ok)await sleep(400)}else{d='view button not reachable: '+(c.err||c.top);in3=0}}
        else if(k==='selslot'){const c=await where(pg,'#mbar [data-m=select]');if(!c.err&&c.hit){await tapAt(pg,c.x,c.y,'finger');d='Select slot'}}
      }catch(e){d=k+' threw '+String(e.message||e).slice(0,80)}
      log.push(step+':'+d);if(process.env.SB_DEBUG)console.error(kind,step,Date.now()%100000,d);await sleep(30);
      let inv;try{inv=await ev(pg,INV)}catch(e){inv={json:'invariant eval threw '+String(e.message||e).slice(0,80)}}
      if(pg.errs.length>e0)note('err',pg.errs.slice(e0,e0+2));
      if(inv.json)note('json',inv.json);for(const q of ['fin','dup','sel','stuck','tool'])if(inv[q]&&inv[q].length)note(q,inv[q]);}
    const end=await canon(pg);const nEnd=await ev(pg,()=>window.__osp.S().objs.length);
    for(const k of INVK)add(P+k,`${S} fuzz: ${INVN[k]} after every one of ${N} random actions`,!fail[k],fail[k]?{seed,...fail[k]}:{seed,steps:N,objs:[n0,nEnd]});
    /* ---- undo everything, then redo everything, by the header buttons ---- */
    const tidy=async()=>{for(let i=0;i<4;i++){const st=await ev(pg,()=>({walk:window.__osp.WALK.on,is3:!document.querySelector('#v3').hidden,modal:[...document.querySelectorAll('.keys-modal')].some(m=>!m.hidden),sheet:!document.querySelector('#msheet').hidden}));
        if(st.walk){await press(pg,'#v3-walk').catch(()=>{});continue}
        if(st.modal){await ev(pg,()=>document.querySelectorAll('.keys-modal').forEach(m=>{if(!m.hidden){const c=m.querySelector('[aria-label=Close]');if(c)c.click()}}));continue}
        if(st.sheet){await ev(pg,()=>{const g=document.querySelector('#msheet [data-msheet-close]');if(g)g.click()});continue}
        break}
      await ev(pg,()=>{document.activeElement&&document.activeElement.blur&&document.activeElement.blur();document.querySelectorAll('.pop').forEach(p=>p.hidden=true);window.__osp.toastOff()})};
    const eFz=pg.errs.length;await tidy();
    let back=true;const cur=await ev(pg,()=>window.__osp.curTab().id);
    if(cur!==tab0){try{await press(pg,`#ptabs [data-tab="${tab0}"] .nm`)}catch(e){back=false}back=back&&await waitF(pg,t=>window.__osp.curTab().id===t,tab0,3000)}
    /* the end plan is the start tab's plan: if the session wandered into another tab, undo / redo history belongs to each tab */
    const endT=back?await canon(pg):end;
    /* how many steps undo will walk back; redo walks forward exactly that many (a session that ended with steps already undone keeps them on the redo stack, and redo-all would rightly go past the end) */
    const p0=back?await ev(pg,()=>window.__osp.past()):0;
    let pres=0;const t0=Date.now();
    if(back){while(await ev(pg,()=>window.__osp.past())>0&&pres<N*3&&Date.now()-t0<40000){await press(pg,'#b-undo').catch(()=>{});pres++}}
    const afterU=await canon(pg);
    add(P+'undo',`${S} fuzz: ${INVN.undo}`,back&&afterU===start,{seed,presses:pres,back,differs:afterU===start?[]:diffKeys(start,afterU)});
    let rp=0;const t1=Date.now();if(back){while(await ev(pg,()=>window.__osp.future())>0&&rp<p0&&Date.now()-t1<40000){await press(pg,'#b-redo').catch(()=>{});rp++}}
    const afterR=await canon(pg);
    add(P+'redo',`${S} fuzz: ${INVN.redo}`,back&&afterR===endT,{seed,presses:rp,differs:afterR===endT?[]:diffKeys(endT,afterR)});
    add(P+'clean',`${S} fuzz: undo / redo phase had no console errors`,pg.errs.length===eFz,pg.errs.slice(eFz,eFz+3));
  }catch(e){add(P+'crash',`${S} fuzz ran to the end`,false,{seed,step,last:log.slice(-5),e:String(e.stack||e).slice(0,300)})}
  finally{if(pg)await closePage(pg)}}

/* ======================= shared desktop helpers ======================= */
const dock=(pg,t)=>press(pg,`.dock [data-tool="${t}"]`);
/* frame the sample building in the middle of the plan with free ground below it (world y 19 000 – 25 000) */
const frame=pg=>ev(pg,()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
const frameSample=async pg=>{await ev(pg,()=>{const o=window.__osp,p=document.querySelector('#plan').getBoundingClientRect();const k=Math.min(p.width*0.62/30000,p.height*0.8/27000);o.V.k=k;o.V.x=15000-(p.width/2)/k;o.V.y=12000-(p.height/2)/k;o.render()});await frame(pg)};
const w2s=(pg,wx,wy)=>ev(pg,([wx,wy])=>{const o=window.__osp,V=o.V,r=document.querySelector('#plan').getBoundingClientRect();const x=r.left+(wx-V.x)*V.k,y=r.top+(wy-V.y)*V.k;const t=document.elementFromPoint(x,y);return {x,y,on:!!t&&!!t.closest('#plan'),id:t&&t.closest('[data-id]')?t.closest('[data-id]').dataset.id:null}},[wx,wy]);
async function clickW(pg,wx,wy,opt){const p=await w2s(pg,wx,wy);if(!p.on)throw new Error(`world ${wx},${wy} is not on the plan on screen`);await pg.mouse.click(p.x,p.y,opt);await sleep(60);return p}
async function dragW(pg,a,b,steps=8){const p=await w2s(pg,a[0],a[1]),q=await w2s(pg,b[0],b[1]);if(!p.on||!q.on)throw new Error('drag ends not on the plan');
  await pg.mouse.move(p.x,p.y);await pg.mouse.down();for(let i=1;i<=steps;i++){await pg.mouse.move(p.x+(q.x-p.x)*i/steps,p.y+(q.y-p.y)*i/steps);await sleep(14)}await pg.mouse.up();await sleep(100);return [p,q]}
/* an item whose own outline is under its centre on screen */
const itemPt=async(pg,pred)=>{await frame(pg);return itemPt0(pg,pred)};
const itemPt0=(pg,pred)=>ev(pg,pred=>{const o=window.__osp,S=o.S(),f=new Function('x','return ('+pred+')(x)');for(const it of S.objs){if(it.t!=='item'||!f(it))continue;const e=document.querySelector(`#plan [data-id="${it.id}"]`);if(!e)continue;const r=e.getBoundingClientRect();if(r.width<10||r.height<10)continue;
  const x=r.left+r.width/2,y=r.top+r.height/2;const h=document.elementFromPoint(x,y);const c=h&&h.closest('[data-id]');if(c&&c.dataset.id===it.id)return {id:it.id,x,y,ox:it.x,oy:it.y,gid:it.gid||null}}return null},String(pred));
async function inspTab(pg,k){if(await ev(pg,()=>document.querySelector('#d-insp').hidden))await press(pg,'#t-insp');await press(pg,'#tab-'+k);if(!await waitF(pg,k=>!document.querySelector('#p-'+k).hidden,k,2000))throw new Error('tab '+k+' did not show')}
async function typeInto(pg,sel,text,key='Enter'){const c=await press(pg,sel);await ev(pg,s=>{const e=document.querySelector(s);if(e&&e.select)e.select()},sel);await pg.keyboard.type(text,{delay:0});if(key)await pg.keyboard.press(key);await sleep(80);return c}
const blur=async pg=>{await ev(pg,()=>{const e=document.activeElement;if(e&&e.blur)e.blur()});await frame(pg)};
const nObjs=pg=>ev(pg,()=>window.__osp.S().objs.length);

/* ======================= 2. files ======================= */
function makeFiles(sample){const D=path.join(SCR,'files');fs.mkdirSync(D,{recursive:true});const p=JSON.parse(sample);const F={};
  const W=(n,t)=>{const f=path.join(D,n);fs.writeFileSync(f,t);F[n.replace(/\..*$/,'')]=f};
  W('corrupt.json','{"app":"layout-planner","v":6,"objs":[{"id":"a1","t":"room","pts":[[0,0],[10');
  W('wrong-app.json',JSON.stringify({name:'my-web-app',version:'1.2.0',dependencies:{react:'^18.3.1'},scripts:{start:'vite'}},null,2));
  W('truncated.json',sample.slice(0,Math.floor(sample.length*0.6)));
  const fut=JSON.parse(sample);fut.v=99;fut.name='From the future';fut.objs.push({id:'fut-holo-1',t:'hologram',x:1000,y:1000,beam:'blue'});W('future.json',JSON.stringify(fut));
  const big=JSON.parse(sample);big.name='Twenty megabytes';big.notes='Long site survey notes. '.repeat(Math.ceil(20.2e6/24));W('big20.json',JSON.stringify(big));
  /* 5 000 items on the open floor of a 10-floor building */
  const h=JSON.parse(sample);const base=h.objs.filter(o=>o.t==='room');const tpl=h.objs.find(o=>o.t==='item'&&o.code==='LK3')||h.objs.find(o=>o.t==='item'&&!o.gid);
  const items=[];for(let i=0;i<5000;i++){const c=i%100,r=Math.floor(i/100);items.push(Object.assign({},tpl,{id:'hx'+i,gid:null,x:300+c*300,y:300+r*350,r:0}))}
  const lv=Array.from({length:10},(_,i)=>({id:'lv'+i,kind:'L',unique:false,fit:i===0?items:items.slice(0,40).map(o=>Object.assign({},o,{id:'f'+i+'-'+o.id})),names:{}}));
  h.name='Five thousand items';h.bld={ceiling:2800,void:900,slab:250,slabB1:400,roofSlab:300,parapet:1000,typical:base,cores:[],roofFit:[],levels:lv,active:'lv0'};h.objs=base.concat(items);W('huge.json',JSON.stringify(h));
  return F}
async function gFiles(b,add){const P=ID+'fl-';const sample=await sampleJSON(b);const F=makeFiles(sample);const pg=await openPage(b,'desktop');
  const T=async(id,nm,fn)=>{try{await fn()}catch(e){add(P+id,nm+' (test threw)',false,String(e.message||e).slice(0,300))}};
  const st=()=>ev(pg,()=>{const o=window.__osp,S=o.S();return {n:S.objs.length,name:S.name,tabs:o.tabs().length,dom:document.querySelectorAll('#plan [data-id]').length,pane:!!document.querySelector('#plan')&&!!document.querySelector('.dock')}});
  const open=async f=>{await ev(pg,()=>window.__osp.toastOff());await chooseFile(pg,()=>menu(pg,'m-open'),f)};
  try{
    /* mutation: app.js:2365 openPlanText `throw new Error('The file is not valid JSON…')` → `o={objs:[]}` → corrupt + truncated + iPhone p-corrupt FAIL confirmed
       mutation: app.js:179 migratePlan `||!Array.isArray(raw.objs))throw…` → objs defaulted to [] → wrong-app FAIL confirmed */
    for(const [k,nm,re] of [['corrupt','a damaged (unparseable) plan file',/not valid JSON/i],['wrong-app','a JSON file from another app',/not a plan file/i],['truncated','a truncated plan file',/not valid JSON/i]])
      await T(k,`desktop: opening ${nm} shows a clear message and leaves the open plan untouched`,async()=>{const s0=await st();if(!(s0.n>100&&s0.dom>100))throw new Error('precondition: sample not open '+JSON.stringify(s0));
        const e0=pg.errs.length;await open(F[k]);const shown=await waitF(pg,re=>{const t=document.querySelector('#toast');return !t.hidden&&new RegExp(re,'i').test(t.textContent)},re.source,4000);
        const s1=await st();const msg=await toastText(pg);
        add(P+k,`desktop: opening ${nm} shows a clear message and leaves the open plan untouched`,shown&&/could not open/i.test(msg)&&JSON.stringify(s0)===JSON.stringify(s1)&&pg.errs.length===e0,{msg,s0,s1,errs:pg.errs.slice(e0)})});
    /* mutation: app.js:186 migratePlan `if(fileV>PLAN_V)notes.unshift(` → `if(false)notes.unshift(` → FAIL confirmed */
    await T('future','desktop: a plan from a future version (v99) opens with a newer-version notice and keeps the unknown object for saving',async()=>{
      await open(F.future);const shown=await waitF(pg,()=>{const t=document.querySelector('#toast');return !t.hidden&&/saved by a newer version/i.test(t.textContent)},null,4000);
      const r=await ev(pg,()=>{const o=window.__osp,S=o.S(),j=JSON.parse(o.planJSON());return {name:S.name,n:S.objs.length,kept:j.objs.some(x=>x.id==='fut-holo-1'&&x.beam==='blue'),shownObj:S.objs.some(x=>x.id==='fut-holo-1'),v:j.v}});
      const n0=JSON.parse(sample).objs.length;add(P+'future','desktop: a plan from a future version (v99) opens with a newer-version notice and keeps the unknown object for saving',shown&&r.name==='From the future'&&r.n===n0&&r.kept&&!r.shownObj&&r.v===99,{...r,n0,msg:(await toastText(pg)).slice(0,160)})});
    /* mutation: app.js:2371 openPlanText `else toast('Opened '+name)` → `else{}` → FAIL confirmed */
    await T('big20','desktop: a 20 MB plan file opens, renders and says so',async()=>{const t0=Date.now();await open(F.big20);
      const ok=await waitF(pg,()=>window.__osp.S().name==='Twenty megabytes'&&document.querySelectorAll('#plan [data-id]').length>100,null,15000);const ms=Date.now()-t0;
      const r=await ev(pg,()=>({notes:(window.__osp.S().notes||'').length,toast:document.querySelector('#toast').hidden?'':document.querySelector('#toast').textContent}));
      add(P+'big20','desktop: a 20 MB plan file opens, renders and says so (within 10 s)',ok&&ms<10000&&r.notes>20e6&&/opened/i.test(r.toast)&&pg.errs.length===0,{ms,mb:+(fs.statSync(F.big20).size/1e6).toFixed(1),...r,errs:pg.errs.slice(0,2)})});
    /* mutation: app.js:570 draw() item loop `.forEach(` → `.slice(0,4000).forEach(` (items past 4 000 not drawn) → FAIL confirmed */
    let hugeOk=false;
    await T('huge-open','desktop: a 5,000-item, 10-floor plan opens with every item drawn',async()=>{const t0=Date.now();await open(F.huge);
      const ok=await waitF(pg,()=>window.__osp.S().name==='Five thousand items'&&document.querySelectorAll('#plan [data-id^="hx"]').length>=5000,null,20000);const ms=Date.now()-t0;
      const r=await ev(pg,()=>{const o=window.__osp,S=o.S();return {items:S.objs.filter(x=>x.t==='item').length,floors:S.bld.levels.length,dom:document.querySelectorAll('#plan [data-id^="hx"]').length}});hugeOk=ok;
      add(P+'huge-open','desktop: a 5,000-item, 10-floor plan opens with every item drawn (open recorded)',ok&&r.items===5000&&r.floors===10&&r.dom>=5000,{openMs:ms,...r})});
    /* mutation: app.js:462 render() busy-waits 3.2 s when the plan has > 4 000 objects → FAIL confirmed */
    await T('huge-2d','desktop: the 5,000-item plan redraws in 2D within 3 s and pans / zooms responsively',async()=>{if(!hugeOk)throw new Error('precondition: large plan did not open');
      const rnd=await ev(pg,()=>new Promise(res=>{const o=window.__osp;const t=performance.now();o.render();requestAnimationFrame(()=>setTimeout(()=>res(performance.now()-t),0))}));
      const pl=await ev(pg,()=>{const r=document.querySelector('#plan').getBoundingClientRect();return [r.left+r.width*0.45,r.top+r.height*0.5]});
      const k0=await ev(pg,()=>window.__osp.V.k);let t=Date.now();await pg.mouse.move(pl[0],pl[1]);await pg.mouse.wheel(0,-300);const zoomed=await waitF(pg,k0=>window.__osp.V.k>k0*1.05,k0,5000);await ev(pg,()=>new Promise(r=>requestAnimationFrame(()=>r())));const zoomMs=Date.now()-t;
      await dock(pg,'pan');const x0=await ev(pg,()=>window.__osp.V.x);t=Date.now();await pg.mouse.move(pl[0],pl[1]);await pg.mouse.down();for(let i=1;i<=6;i++){await pg.mouse.move(pl[0]+i*25,pl[1]+i*10)}await pg.mouse.up();
      const panned=await waitF(pg,x0=>Math.abs(window.__osp.V.x-x0)>1,x0,5000);await ev(pg,()=>new Promise(r=>requestAnimationFrame(()=>r())));const panMs=Date.now()-t;await dock(pg,'select');
      add(P+'huge-2d','desktop: the 5,000-item plan redraws in 2D within 3 s and pans / zooms within 3 s',rnd<3000&&zoomed&&panned&&zoomMs<3000&&panMs<3000,{renderMs:Math.round(rnd),zoomMs,panMs,zoomed,panned})});
    /* mutation: app.js:2963 build3D() busy-waits 11 s when the plan has > 4 000 objects → FAIL confirmed */
    await T('huge-3d','desktop: the 5,000-item plan builds its 3D view within 10 s',async()=>{if(!hugeOk)throw new Error('precondition: large plan did not open');
      const t=Date.now();await press(pg,'#b-view');const ok=await waitF(pg,()=>{const T=window.__osp.T3();return !document.querySelector('#v3').hidden&&T&&T.renderer&&T.framed},null,30000);const ms=Date.now()-t;
      await press(pg,'#b-view').catch(()=>{});await waitF(pg,()=>document.querySelector('#v3').hidden,null,15000);
      add(P+'huge-3d','desktop: the 5,000-item plan builds its 3D view within 10 s',ok&&ms<10000,{buildMs:ms,ok})});
  /* mutation: app.js:2364 openPlanText starts with console.error('mutant') → FAIL confirmed */
  }finally{add(P+'clean','desktop files: no console or page errors',pg.errs.length===0,pg.errs.slice(0,4));await closePage(pg)}
  /* the phone reaches Open from its More sheet; a damaged file gets the same message there */
  const ph=await openPage(b,'iphone');
  try{await T('p-corrupt','iPhone: opening a damaged plan file from the More sheet shows a clear message and leaves the plan untouched',async()=>{
      const s0=await ev(ph,()=>window.__osp.S().objs.length);await chooseFile(ph,()=>menu(ph,'m-open'),F.corrupt);
      const shown=await waitF(ph,()=>{const t=document.querySelector('#toast');return !t.hidden&&/not valid JSON/i.test(t.textContent)},null,4000);const s1=await ev(ph,()=>window.__osp.S().objs.length);
      add(P+'p-corrupt','iPhone: opening a damaged plan file from the More sheet shows a clear message and leaves the plan untouched',shown&&s0===s1&&s0>100&&ph.errs.length===0,{s0,s1,msg:await toastText(ph),errs:ph.errs.slice(0,2)})})}
  finally{await closePage(ph)}}

/* ======================= 3. injection ======================= */
const XA='<img src=x onerror=window.__pwned=1>',XB='"><svg onload=window.__pwned=1>';
/* text areas (pin comments, notes) are only escaped out of by closing the element */
const XC='</textarea><img src=x onerror=window.__pwned=1>';
const PWN=pg=>ev(pg,()=>({pwned:window.__pwned,live:document.querySelectorAll('img[src="x"],[onerror],[onload]').length}));
async function gInject(b,add){const P=ID+'xs-';const pg=await openPage(b,'desktop');pg.confirmYes=true;
  const T=async(id,nm,fn)=>{try{await fn()}catch(e){add(P+id,nm+' (test threw)',false,String(e.message||e).slice(0,300))}};
  const lit=(sel,s)=>ev(pg,([sel,s])=>[...document.querySelectorAll(sel)].some(e=>(e.value!=null&&e.tagName!=='BUTTON'?e.value:e.textContent).includes(s)),[sel,s]);
  try{const base=await PWN(pg);await frameSample(pg);
    /* mutation: app.js:3951 renderTabs `<span class="nm">${esc(nm||'Untitled plan')}` → no esc → FAIL confirmed */
    await T('ui-plan','desktop: a script payload typed as the plan name shows literally in the name box and the tab',async()=>{
      await typeInto(pg,'#pname',XA);await press(pg,'#ptab-add');await waitF(pg,()=>window.__osp.tabs().length===2,null,3000);
      const first=await ev(pg,()=>window.__osp.tabs()[0].id);await press(pg,`#ptabs [data-tab="${first}"] .nm`);await waitF(pg,f=>window.__osp.curTab().id===f,first,3000);
      const r=await PWN(pg);const ok=await ev(pg,s=>window.__osp.S().name===s&&[...document.querySelectorAll('#ptabs .nm')].some(e=>e.textContent===s),XA);
      add(P+'ui-plan','desktop: a script payload typed as the plan name shows literally in the name box and the tab',!r.pwned&&r.live===base.live&&ok,{...r,ok})});
    /* mutation: app.js:549 room label `${esc(o.name||'Room')}` → `${o.name||'Room'}` → FAIL confirmed */
    await T('ui-room','desktop: a payload typed as a room name (inspector) shows literally on the plan and in the schedule',async()=>{
      const rid=await ev(pg,()=>{const o=window.__osp,r=o.S().objs.find(x=>x.t==='room'&&x.name==='Meeting room');o.setSel([r.id]);return r.id});await inspTab(pg,'sel');
      await typeInto(pg,'#p-sel [data-f=name]',XB);await blur(pg);
      const onPlan=await waitF(pg,([id,s])=>window.__osp.S().objs.find(x=>x.id===id).name===s&&[...document.querySelectorAll('#plan text,#plan tspan')].some(e=>e.textContent.includes(s)),[rid,XB],4000);
      await inspTab(pg,'sch');const inSch=await lit('#p-sch td,#p-sch th,#p-sch div,#p-sch span',XB);const r=await PWN(pg);
      add(P+'ui-room','desktop: a payload typed as a room name (inspector) shows literally on the plan and in the schedule',!r.pwned&&r.live===base.live&&onPlan&&inSch,{...r,onPlan,inSch})});
    /* mutation: app.js:584 text label `${esc(o.text)}` → `${o.text}` → FAIL confirmed */
    await T('ui-text','desktop: a payload typed into a new text label shows literally on the plan',async()=>{
      const nt=await ev(pg,()=>window.__osp.S().objs.filter(x=>x.t==='text').length);await dock(pg,'text');await clickW(pg,6000,21000);if(!await waitF(pg,n=>window.__osp.S().objs.filter(x=>x.t==='text').length===n+1&&!!document.querySelector('#f-text'),nt,3000))throw new Error('no text label was added');
      await typeInto(pg,'#f-text',XA);await blur(pg);await sleep(100);
      const ok=await waitF(pg,s=>window.__osp.S().objs.some(x=>x.t==='text'&&x.text===s)&&[...document.querySelectorAll('#plan text,#plan tspan')].some(e=>e.textContent.includes(s)),XA,4000);const r=await PWN(pg);
      add(P+'ui-text','desktop: a payload typed into a new text label shows literally on the plan',!r.pwned&&r.live===base.live&&ok,{...r,ok})});
    /* mutation: app.js:1487 renderNotes pin textarea `${esc(p.text||'')}` → `${p.text||''}` → FAIL confirmed */
    await T('ui-pin','desktop: a payload typed as a pin comment shows literally in the Notes tab',async()=>{
      await dock(pg,'pin');await clickW(pg,10000,21000);await waitF(pg,()=>!document.querySelector('#p-notes').hidden&&!!document.querySelector('#p-notes [data-pintext]'),null,3000);
      const sel='#p-notes [data-pintext]';await press(pg,sel,(await ev(pg,s=>document.querySelectorAll(s).length,sel))-1);await pg.keyboard.type(XC);await blur(pg);
      await inspTab(pg,'sel');await inspTab(pg,'notes');const ok=await ev(pg,s=>(window.__osp.S().pins||[]).some(p=>p.text===s)&&[...document.querySelectorAll('#p-notes [data-pintext]')].some(e=>e.value===s),XC);const r=await PWN(pg);
      add(P+'ui-pin','desktop: a payload typed as a pin comment shows literally in the Notes tab',!r.pwned&&r.live===base.live&&ok,{...r,ok})});
    /* mutation: app.js:910 renderLib `<span class="nm">${esc(l.name)}` → no esc → FAIL confirmed */
    await T('csv','desktop: a library CSV with payloads in its fields imports, lists literally and places an item labelled literally',async()=>{
      const f=path.join(SCR,'files','xss-lib.csv');fs.mkdirSync(path.dirname(f),{recursive:true});
      const q=s=>'"'+s.replace(/"/g,'""')+'"';fs.writeFileSync(f,['code,name,category,shape,width_mm,depth_mm,height_mm',`${q(XB)},${q(XA)},${q(XB)},rect,1200,600,750`,'DK2,Plain desk,Desks,rect,1400,700,750'].join('\r\n'));
      if(await ev(pg,()=>document.querySelector('#d-lib').hidden))await press(pg,'#t-lib');await chooseFile(pg,()=>press(pg,'#lib-imp'),f);
      const listed=await waitF(pg,s=>[...document.querySelectorAll('#lib-list .lib-row')].some(r=>r.textContent.includes(s)),XA,4000);
      const ri=await ev(pg,s=>[...document.querySelectorAll('#lib-list .lib-row')].findIndex(r=>r.textContent.includes(s)),XA);if(ri>=0){await press(pg,'#lib-list .lib-row',ri);await clickW(pg,14000,22000);await dock(pg,'select')}
      const placed=await ev(pg,s=>window.__osp.S().objs.some(o=>o.t==='item'&&o.name===s),XA);const r=await PWN(pg);
      add(P+'csv','desktop: a library CSV with payloads in its fields imports, lists literally and places an item labelled literally',!r.pwned&&r.live===base.live&&listed&&placed,{...r,listed,placed})});
    /* mutation: app.js:3901 openPlans `<div class="pn">${esc(r.name)}` → no esc → FAIL confirmed */
    await T('plans','desktop: My plans lists a payload-named plan literally, and Rename with a payload keeps it literal',async()=>{
      await ev(pg,()=>window.__osp.PLANS.flush());await waitA(pg,async s=>(await window.__osp.PLANS.list()).some(r=>r.name===s),XA,5000);
      await menu(pg,'m-plans');await waitF(pg,()=>!document.querySelector('#plans-modal').hidden&&!!document.querySelector('#plans-list .plan-row'),null,4000);
      const listed=await lit('#plans-list .pn',XA);const ri=await ev(pg,s=>[...document.querySelectorAll('#plans-list .plan-row')].findIndex(r=>r.querySelector('.pn').textContent.includes(s)),XA);
      pg.promptVal=XB;await press(pg,'#plans-list .plan-row [data-pact=rename]',Math.max(0,ri));
      const renamed=await waitF(pg,s=>[...document.querySelectorAll('#plans-list .pn')].some(e=>e.textContent.includes(s)),XB,6000);pg.promptVal=null;const tab=await waitF(pg,s=>[...document.querySelectorAll('#ptabs .nm')].some(e=>e.textContent.includes(s)),XB,3000);
      await press(pg,'#plans-modal [data-pclose]');const r=await PWN(pg);
      add(P+'plans','desktop: My plans lists a payload-named plan literally, and Rename with a payload keeps it literal (tab too)',!r.pwned&&r.live===base.live&&listed&&renamed&&tab,{...r,listed,renamed,tab})});
    /* mutation: app.js:2451 exportDXF room TEXT `o.name||'Room'` → `'Room'` → FAIL confirmed */
    await T('export','desktop: PNG and DXF exports of payload-named content run without executing it and the DXF holds the text literally',async()=>{
      const n0=await ev(pg,()=>window.__saved.length);await menu(pg,'m-png');const png=await waitF(pg,n=>window.__saved.length>n&&/\.png$/i.test(window.__saved[window.__saved.length-1].name),n0,8000);
      const n1=await ev(pg,()=>window.__saved.length);await menu(pg,'m-dxf');const dxf=await waitF(pg,n=>window.__saved.length>n,n1,8000);
      const d=await ev(pg,async()=>{const c=window.__saved[window.__saved.length-1];return {name:c.name,text:c.blob?await c.blob.text():''}});
      const r=await PWN(pg);add(P+'export','desktop: PNG and DXF exports of payload-named content run without executing it and the DXF holds the text literally',!r.pwned&&png&&dxf&&d.text.includes(XB.replace(/"/g,'"'))&&/\.dxf$/i.test(d.name),{...r,png,dxf,dxfName:d.name,hasRoom:d.text.includes(XB),hasText:d.text.includes(XA)})});
    /* the same payloads arriving in a plan file */
    /* mutation: app.js:1562 inspector item heading `${esc(o.name)}` → `${o.name}` → FAIL confirmed */
    await T('file','desktop: a plan file with payloads in every name renders literally in 2D, the inspector, schedule, Notes and tabs',async()=>{
      const p=JSON.parse(await sampleJSON(b));p.name=XB;p.notes=XC;p.objs.forEach((o,i)=>{if(o.t==='room')o.name=i%2?XA:XB;else if(o.t==='item'&&i%5===0){o.name=XB;o.label=XA}});p.objs.push({id:'xt1',t:'text',x:5000,y:5000,text:XB,size:300,gid:null});
      p.pins=[{id:'xp1',x:3000,y:3000,text:XC,done:false,lv:null}];delete p.bld;/* the building is rebuilt from objs */const f=path.join(SCR,'files','xss-plan.json');fs.writeFileSync(f,JSON.stringify(p));
      await chooseFile(pg,()=>menu(pg,'m-open'),f);if(!await waitF(pg,s=>window.__osp.S().name===s&&window.__osp.S().objs.some(q=>q.t==='item'&&q.name===s),XB,12000))throw new Error('the payload plan file did not open: '+await toastText(pg));
      const it=await ev(pg,s=>{const o=window.__osp,x=o.S().objs.find(q=>q.t==='item'&&q.name===s);o.setSel([x.id]);return x.id},XB);await inspTab(pg,'sel');const insp=await lit('#p-sel .big,#p-sel p,#p-sel input',XB);
      await inspTab(pg,'sch');const sch=await lit('#p-sch td,#p-sch div,#p-sch span',XA);await inspTab(pg,'notes');const notes=await ev(pg,s=>[...document.querySelectorAll('#p-notes textarea')].filter(t=>t.value===s).length>=2,XC);
      const plan=await waitF(pg,([a,b])=>{const t=[...document.querySelectorAll('#plan text,#plan tspan')].map(e=>e.textContent).join('\n');return t.includes(a)&&t.includes(b)},[XA,XB],4000);const tab=await lit('#ptabs .nm',XB);
      const r=await PWN(pg);add(P+'file','desktop: a plan file with payloads in every name renders literally in 2D, the inspector, schedule, Notes and tabs',!r.pwned&&r.live===base.live&&insp&&sch&&notes&&plan&&tab,{...r,insp,sch,notes,plan,tab})});
    /* the 3D view has no name sink today, so this guards a future one. mutation: app.js:3393 set3D(on) appends room names via innerHTML to #v3 → FAIL confirmed */
    await T('3d','desktop: the payload-named plan in 3D runs no payload',async()=>{await press(pg,'#b-view');const ok=await waitF(pg,()=>{const T=window.__osp.T3();return T&&T.renderer&&T.framed},null,30000);await sleep(300);
      const r=await PWN(pg);await press(pg,'#b-view').catch(()=>{});await waitF(pg,()=>document.querySelector('#v3').hidden,null,15000);
      add(P+'3d','desktop: the payload-named plan in 3D runs no payload',ok&&!r.pwned&&r.live===base.live,{...r,ok})});
  }finally{add(P+'clean','desktop injection: no console or page errors',pg.errs.length===0,pg.errs.slice(0,4));await closePage(pg)}}

/* ======================= 4. persistence ======================= */
const lsPlan=pg=>ev(pg,()=>{const o=window.__osp;try{return JSON.parse(localStorage.getItem('osp-tab-'+o.curTab().id)||'null')}catch(e){return null}});
const idbPlan=(pg,pid)=>ev(pg,async pid=>{const r=await window.__osp.PLANS.get(pid);return r?JSON.parse(r.data):null},pid);
/* what must survive: objects, name, pins, notes, building */
/* objects compared by id: the app stores each floor as walls/rooms then fit-out, so the order of plan.objs after a reload is that canonical order */
const byIdSort=a=>(a||[]).slice().sort((x,y)=>String(x.id).localeCompare(String(y.id)));
const core=p=>p?JSON.stringify({o:byIdSort(p.objs),n:p.name,p:p.pins||[],no:p.notes||'',b:p.bld&&p.bld.levels.map(l=>[l.id,(l.fit||[]).length])}):'';
async function gPersist(b,add){const P=ID+'ps-';const pg=await openPage(b,'desktop');pg.confirmYes=true;
  const T=async(id,nm,fn)=>{try{await fn()}catch(e){add(P+id,nm+' (test threw)',false,String(e.message||e).slice(0,300))}};
  try{await frameSample(pg);
    const live=()=>ev(pg,()=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,n:S.name,p:S.pins||[],no:S.notes||'',b:S.bld&&S.bld.levels.map(l=>[l.id,(l.fit||[]).length])})});
    const EDITS=[
      ['move','drag an item',async()=>{const it=await itemPt(pg,x=>!x.gid);await pg.mouse.move(it.x,it.y);await pg.mouse.down();for(let i=1;i<=6;i++)await pg.mouse.move(it.x+i*8,it.y+i*5);await pg.mouse.up()}],
      ['rotate','R rotates the selection',async()=>{await pg.keyboard.press('r')}],
      ['dup','Ctrl+D duplicates',async()=>{await pg.keyboard.press('Control+d')}],
      ['del','Delete removes',async()=>{await pg.keyboard.press('Delete')}],
      ['name','rename the plan',async()=>{await typeInto(pg,'#pname','Autosave check')}],
      ['room','draw a room',async()=>{await dock(pg,'room');await dragW(pg,[2000,20000],[6000,23000]);await dock(pg,'select')}],
      ['text','add a text label',async()=>{await dock(pg,'text');await clickW(pg,9000,21000);await ev(pg,()=>document.activeElement&&document.activeElement.select&&document.activeElement.select());await pg.keyboard.type('Saved label');await pg.keyboard.press('Enter');await blur(pg)}],
      ['pin','drop a pin with a comment',async()=>{await dock(pg,'pin');await clickW(pg,12000,21000);await waitF(pg,()=>!!document.querySelector('#p-notes [data-pintext]'),null,3000);const n=await ev(pg,()=>document.querySelectorAll('#p-notes [data-pintext]').length);await press(pg,'#p-notes [data-pintext]',n-1);await pg.keyboard.type('Check this');await blur(pg)}],
      ['field','edit an item width in Details',async()=>{await ev(pg,()=>{const o=window.__osp,x=o.S().objs.find(q=>q.t==='item'&&!q.gid);o.setSel([x.id])});await inspTab(pg,'sel');await typeInto(pg,'#p-sel [data-f=w]','1234')}],
      ['undo','undo the last edit',async()=>{await press(pg,'#b-undo')}]];
    /* mutation: app.js:272 markDirty `autosave()` removed → all 10 FAIL confirmed; app.js:277 saveTabData `PLANS.put(plan);` removed → all 10 FAIL (idb) confirmed */
    for(const[k,nm,fn]of EDITS){await T('as-'+k,`desktop: autosave writes within 3 s after: ${nm}`,async()=>{const before=await live();await fn();await sleep(50);const after=await live();
      if(after===before)throw new Error('precondition: the edit changed nothing');
      const t0=Date.now();const ls=await waitA(pg,want=>{const o=window.__osp;const p=JSON.parse(localStorage.getItem('osp-tab-'+o.curTab().id)||'null');const S=o.S();return !!p&&JSON.stringify(p.objs)===JSON.stringify(S.objs)&&p.name===S.name},null,3000);const lsMs=Date.now()-t0;
      const pid=await ev(pg,()=>window.__osp.S().pid);const idb=await waitA(pg,async pid=>{const r=await window.__osp.PLANS.get(pid);if(!r)return false;const p=JSON.parse(r.data),S=window.__osp.S();return JSON.stringify(p.objs)===JSON.stringify(S.objs)&&p.name===S.name},pid,3000);
      add(P+'as-'+k,`desktop: autosave writes this browser's copy (localStorage and My plans) within 3 s after: ${nm}`,ls&&idb,{ls,idb,lsMs,totalMs:Date.now()-t0})})}
    /* mutation: app.js:3962 boot restore `idx.ids.forEach(` → `[].forEach(` → FAIL confirmed */
    await T('reload','desktop: reloading restores the plan exactly',async()=>{await sleep(700);const want=core(JSON.parse(await ev(pg,()=>window.__osp.planJSON())));const tabs0=await ev(pg,()=>window.__osp.tabs().map(t=>t.id));
      await pg.reload({waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,{timeout:20000});const got=core(JSON.parse(await ev(pg,()=>window.__osp.planJSON())));const tabs1=await ev(pg,()=>window.__osp.tabs().map(t=>t.id));
      const W=JSON.parse(want),G=JSON.parse(got);const dk=Object.keys(W).filter(k=>JSON.stringify(W[k])!==JSON.stringify(G[k]));
      add(P+'reload','desktop: reloading restores the plan exactly (objects, name, pins, notes, floors, tabs)',want===got&&JSON.stringify(tabs0)===JSON.stringify(tabs1)&&want.length>1000,{same:want===got,differs:dk,objs:dk.includes('o')?diffKeys(JSON.stringify({objs:W.o}),JSON.stringify({objs:G.o})):'',tabs0,tabs1,lens:[W.o.length,G.o.length]})});
  }finally{add(P+'clean','desktop persistence: no console or page errors',pg.errs.length===0,pg.errs.slice(0,4));await closePage(pg)}
  /* two pages of the app on one origin (same browser profile), each editing its plan, then both reloaded */
  /* mutation: app.js:3962 boot restore `idx.ids.forEach(` → `[].forEach(` → FAIL confirmed (also FAILs with autosave or PLANS.put removed) */
  await T('two','desktop: two open pages of the app on the same origin keep both pages\' edits after both reload and after reopening',async()=>{const ctx=await b.newContext(DEV.desktop());await ctx.addInitScript(INIT);
    try{const p1=await openPage(b,'desktop',{ctx});await sleep(900);const p2=await openPage(b,'desktop',{ctx,sample:false});
      const pre=await ev(p2,()=>({n:window.__osp.S().objs.length,tabs:window.__osp.tabs().length}));
      for(const[p,nm,x]of[[p1,'From page one',4000],[p2,'From page two',9000]]){await frameSample(p);await dock(p,'text');await clickW(p,x,21000);await ev(p,()=>document.activeElement&&document.activeElement.select&&document.activeElement.select());await p.keyboard.type(nm);await p.keyboard.press('Enter');await blur(p);await sleep(150)}
      await sleep(2200);await p1.reload({waitUntil:'load'});await p1.waitForFunction(()=>window.__osp&&window.__osp.S);await p2.reload({waitUntil:'load'});await p2.waitForFunction(()=>window.__osp&&window.__osp.S);await sleep(300);
      const find=p=>ev(p,async()=>{const o=window.__osp;const txt=[];o.tabsRaw().forEach(t=>{const S=t===o.curTab()?o.S():t.S;S.objs.forEach(x=>{if(x.t==='text')txt.push(x.text)})});
        let stored=[];try{const ids=(await o.PLANS.list()).map(r=>r.pid);for(const id of ids){const r=await o.PLANS.get(id);JSON.parse(r.data).objs.forEach(x=>{if(x.t==='text')stored.push(x.text)})}}catch(e){}return {tabs:txt,stored}});
      const a=await find(p1),c=await find(p2);const live=[...a.tabs,...c.tabs];
      /* then both pages are closed and the app is opened again: what this browser kept must hold both edits (open tabs or My plans) */
      await p1.close();await p2.close();const p3=await openPage(b,'desktop',{ctx,sample:false});await sleep(300);const z=await find(p3);const kept=[...z.tabs,...z.stored];
      const both=x=>x.includes('From page one')&&x.includes('From page two');
      add(P+'two','desktop: two open pages of the app on the same origin keep both pages\' edits after both reload and after reopening',both(live)&&both(kept)&&p1.errs.length===0&&p2.errs.length===0&&p3.errs.length===0,
        {pre,page1:a.tabs.filter(t=>/page/.test(t)),page2:c.tabs.filter(t=>/page/.test(t)),reopenedTabs:z.tabs.filter(t=>/page/.test(t)),reopenedMyPlans:[...new Set(z.stored.filter(t=>/page/.test(t)))],errs:[...p1.errs,...p2.errs,...p3.errs].slice(0,3)})}
    finally{await Promise.race([ctx.close(),sleep(6000)])}});
  /* storage full: every localStorage write throws QuotaExceededError */
  /* quota-toast FAILs on the real build (finding: only the status line warns), so it has no mutant to confirm.
     mutation: app.js:285 setStatus 'fail' text → 'Autosave on (this browser)' → quota-status FAIL confirmed; app.js:277 `PLANS.put(plan);` removed → quota-idb FAIL confirmed */
  const qp=await openPage(b,'desktop');
  try{await ev(qp,()=>{const real=Storage.prototype.setItem;window.__quota=0;Storage.prototype.setItem=function(k,v){if(String(k).startsWith('osp-')){window.__quota++;throw new DOMException('The quota has been exceeded.','QuotaExceededError')}return real.call(this,k,v)}});
    await frameSample(qp);await ev(qp,()=>window.__osp.toastOff());const n0=await nObjs(qp);
    await dock(qp,'room');await dragW(qp,[2000,20000],[6000,23000]);await dock(qp,'select');const n1=await nObjs(qp);
    const toast=await waitF(qp,()=>{const t=document.querySelector('#toast');return !t.hidden&&/(storage|full|not (been )?(auto)?saved|save to a file|quota)/i.test(t.textContent)},null,3000);
    const status=await waitF(qp,()=>/not autosaved|full|blocked/i.test(document.querySelector('#status').textContent),null,3000);
    add(P+'quota-toast','desktop: when browser storage is full, the user gets a warning toast',n1===n0+1&&toast&&(await ev(qp,()=>window.__quota!==undefined)),{n0,n1,toast,status:await ev(qp,()=>document.querySelector('#status').textContent),tries:await ev(qp,()=>window.__quota)});
    add(P+'quota-status','desktop: when browser storage is full, the status line says autosave is failing',n1===n0+1&&status,{status:await ev(qp,()=>document.querySelector('#status').textContent)});
    const pid=await ev(qp,()=>window.__osp.S().pid);const idb=await waitA(qp,async([pid,n])=>{const r=await window.__osp.PLANS.get(pid);return !!r&&JSON.parse(r.data).objs.length===n},[pid,n1],4000);
    add(P+'quota-idb','desktop: when browser storage is full, the edit is still kept in My plans (IndexedDB) and no error is thrown',idb&&qp.errs.length===0,{idb,errs:qp.errs.slice(0,3)})}
  catch(e){add(P+'quota-crash','desktop: storage-full checks ran',false,String(e.message||e).slice(0,300))}
  finally{await closePage(qp)}}

/* ======================= 5. undo integrity per action type ======================= */
async function gUndo(b,add){const P=ID+'un-';const pg=await openPage(b,'desktop');pg.confirmYes=true;
  try{await frameSample(pg);
    const C=async(key,nm,act,opt={})=>{const name=`desktop: one undo restores the exact plan before, one redo the exact plan after: ${nm}`;
      try{if(opt.setup)await opt.setup();await ev(pg,()=>window.__osp.toastOff());const pre=await canon(pg);await act();await sleep(80);if(opt.after)await opt.after();await blur(pg);await sleep(60);const post=await canon(pg);
        if(post===pre){add(P+key,name,false,'precondition: the action changed nothing');return}
        await press(pg,'#b-undo');await sleep(60);const u=await canon(pg);await press(pg,'#b-redo');await sleep(60);const r=await canon(pg);
        add(P+key,name,u===pre&&r===post,{undo:u===pre?'ok':diffKeys(pre,u),redo:r===post?'ok':diffKeys(post,r)})}
      catch(e){add(P+key,name+' (test threw)',false,String(e.message||e).slice(0,300))}finally{try{await pg.keyboard.press('Escape');await dock(pg,'select')}catch(e){}}};
    const clicks=async(t,pts,end='Enter')=>{await dock(pg,t);for(const p of pts)await clickW(pg,p[0],p[1]);if(end)await pg.keyboard.press(end);await sleep(80)};
    const selItem=async()=>{const it=await itemPt(pg,x=>!x.gid&&!x.arr);await pg.mouse.click(it.x,it.y);await waitF(pg,id=>window.__osp.sel().includes(id),it.id,2000);return it};
    /* mutation: app.js:261 checkpoint() without pushPast → every row FAILs except move and field (they push their own history) → FAIL confirmed
       mutation: app.js:1146 drag `pushPast(snapState())` removed → move FAIL confirmed; app.js:1610 field edit `pushPast(snapState())` removed → field FAIL confirmed
       mutation: app.js:270 redo() pops without restoreState → every row FAIL confirmed
       floor-add, floor-del and north FAIL on the real build (findings), so they need no mutant. */
    await C('room','draw a room',async()=>{await dock(pg,'room');await dragW(pg,[2000,20000],[5000,23000])});
    await C('walls','draw walls',()=>clicks('poly',[[6000,20000],[9000,20000],[9000,23000]]));
    await C('curve','draw a curved wall',()=>clicks('spline',[[10000,20000],[11500,21500],[13000,20500]]));
    await C('road','lay a road',()=>clicks('road',[[2000,24500],[9000,24500]]));
    await C('fence','build a fence',()=>clicks('fence',[[14000,20000],[17000,20000],[17000,23000]]));
    await C('shape','draw a custom rectangle shape',async()=>{await press(pg,'#t-shape');if(await ev(pg,()=>!document.querySelector('#pop-shape').hidden))await press(pg,'#pop-shape [data-shape=rect]');await dragW(pg,[18000,20000],[20000,22000])});
    await C('measure','measure a dimension',async()=>{await dock(pg,'measure');await dragW(pg,[21000,20000],[25000,20000])});
    await C('text','add a text label',async()=>{await dock(pg,'text');await clickW(pg,26000,21000)});
    await C('trunk','run ceiling trunking',()=>clicks('trunk',[[2000,19500],[8000,19500]]));
    await C('section','cut a section line',async()=>{await dock(pg,'section');await dragW(pg,[1000,6000],[29000,6000])});
    await C('pin','drop a review pin',async()=>{await dock(pg,'pin');await clickW(pg,28000,22000)});
    await C('place','place a library item',async()=>{if(await ev(pg,()=>document.querySelector('#d-lib').hidden))await press(pg,'#t-lib');const i=await ev(pg,()=>[...document.querySelectorAll('#lib-list .lib-row')].findIndex(r=>/task chair/i.test(r.textContent)));if(i<0)throw new Error('no Task chair row');await press(pg,'#lib-list .lib-row',i);await clickW(pg,23000,23000);await dock(pg,'select')});
    await C('move','drag an item',async()=>{const it=await itemPt(pg,x=>!x.gid&&!x.arr);await pg.mouse.move(it.x,it.y);await pg.mouse.down();for(let i=1;i<=6;i++)await pg.mouse.move(it.x+i*9,it.y+i*4);await pg.mouse.up()});
    await C('rotate','rotate with R',async()=>{await selItem();await pg.keyboard.press('r')});
    await C('dup','duplicate with Ctrl+D',async()=>{await selItem();await pg.keyboard.press('Control+d')});
    await C('delete','delete with the Delete key',async()=>{await selItem();await pg.keyboard.press('Delete')});
    await C('paint','paint a room floor',async()=>{await dock(pg,'paint');const p=await w2s(pg,16000,15000);await pg.mouse.click(p.x,p.y)});
    await C('field','edit an item width in Details',async()=>{await selItem();await inspTab(pg,'sel');await typeInto(pg,'#p-sel [data-f=w]','1357')});
    await C('lock','lock rooms and underlay',async()=>{await press(pg,'#b-lock')},{after:async()=>{}});
    await press(pg,'#b-lock').catch(()=>{});
    /* arrays are made by the column / array dialog; the array itself is set up through the hook, the edit is the user's */
    await C('array','change an array\'s rows in Details',async()=>{await inspTab(pg,'sel');await typeInto(pg,'#p-sel [data-arrf=rows]','3')},
      {setup:async()=>{const it=await itemPt(pg,x=>!x.gid&&!x.arr&&x.cat!=='Door'&&x.w<1500&&x.d<1500);if(!it)throw new Error('no free item on screen');await ev(pg,id=>{const o=window.__osp;o.makeColArray(o.byId(id),2,2,1500,1500)},it.id);await pg.keyboard.press('Escape');const m=await itemPt(pg,x=>!!x.arr);if(!m)throw new Error('no array member on screen');await pg.mouse.click(m.x,m.y);await waitF(pg,()=>window.__osp.sel().length===1,null,2000)}});
    await C('floor-add','add a floor in the Building tab',async()=>{await inspTab(pg,'bld');await press(pg,'#p-bld [data-bb=addL]')});
    await C('floor-del','delete a floor in the Building tab',async()=>{await inspTab(pg,'bld');const n=await ev(pg,()=>document.querySelectorAll('#p-bld [data-bb=del]').length);if(n<2)throw new Error('precondition: need two floors');await press(pg,'#p-bld [data-bb=del]',n-1)});
    await C('north','set the north angle in the Building tab',async()=>{await inspTab(pg,'bld');await typeInto(pg,'#bld-north','45')});
    /* underlay: loaded through the Underlay tab's own file chooser, then calibrated and traced by the user */
    let und=false;try{await inspTab(pg,'und');await chooseFile(pg,()=>press(pg,'#p-und [data-u=load]').catch(async()=>{await press(pg,'#m-under')}),ROOT+'/test/detect/synth/flat-cad.png');und=await waitF(pg,()=>{const u=window.__osp.S().underlay;return !!u&&!!u.src},null,8000)}catch(e){}
    await C('calibrate','calibrate the underlay from two clicks and a length',async()=>{if(!und)throw new Error('precondition: underlay did not load');await inspTab(pg,'und');await press(pg,'#p-und [data-u=cal]');
      const u=await ev(pg,()=>{const u=window.__osp.S().underlay;return [u.x,u.y,u.w,u.h]});await clickW(pg,u[0]+u[2]*0.25,u[1]+u[3]*0.5);await clickW(pg,u[0]+u[2]*0.75,u[1]+u[3]*0.5);
      await waitF(pg,()=>!!document.querySelector('#cal-len'),null,3000);await typeInto(pg,'#cal-len','8000')});
    await C('detect','trace walls from the underlay (Detect, Enter for the whole sheet)',async()=>{if(!und)throw new Error('precondition: underlay did not load');await inspTab(pg,'und');await press(pg,'#p-und [data-u=detect]');await pg.mouse.move(700,450);await pg.keyboard.press('Enter');
      await waitF(pg,()=>window.__osp.S().objs.some(o=>o.det),null,15000)});
    await C('group','select all (Ctrl+A) and group with Ctrl+G',async()=>{await pg.mouse.click(...Object.values(await ev(pg,()=>{const r=document.querySelector('#plan').getBoundingClientRect();return {x:r.left+r.width/2,y:r.bottom-30}})));await pg.keyboard.press('Control+a');await waitF(pg,()=>window.__osp.sel().length>5,null,2000);await pg.keyboard.press('Control+g')});
  }finally{add(P+'clean','desktop undo integrity: no console or page errors',pg.errs.length===0,pg.errs.slice(0,4));await closePage(pg)}}

/* ======================= runner ======================= */
const GROUPS={
  fuzz:async(b,add)=>{const N=+(process.env.SB_FUZZ_N||200);const base=+(process.env.SB_SEED||20261109);
    const K=(process.env.SB_FUZZ_DEV||'desktop,ipad,iphone').split(',');await Promise.all(K.map(k=>fuzzOne(b,k,base+['desktop','ipad','iphone'].indexOf(k),N,add)))},
  files:gFiles,inject:gInject,persist:gPersist,undo:gUndo};
export async function run(b,opt={}){const R=[];const ids=new Set();const add=(id,nm,pass,detail)=>{if(ids.has(id))throw new Error('duplicate id '+id);ids.add(id);R.push(row(id,nm,pass,detail))};
  const only=opt.only&&opt.only.length?opt.only:(process.env.SB_RB_ONLY?process.env.SB_RB_ONLY.split(','):Object.keys(GROUPS));
  /* the fuzz runs beside the other groups, which run one after another */
  const rest=only.filter(g=>g!=='fuzz');
  await Promise.all([only.includes('fuzz')?GROUPS.fuzz(b,add).catch(e=>add(ID+'fuzz-crash','fuzz group ran',false,String(e.stack||e).slice(0,400))):null,
    (async()=>{for(const g of rest)await GROUPS[g](b,add).catch(e=>add(ID+g+'-crash',`${g} group ran`,false,String(e.stack||e).slice(0,400)))})()]);
  return R}
