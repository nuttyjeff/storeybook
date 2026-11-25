/* layer: functions. Every function a person can reach, run once through the real interface on the desktop:
     fn-cmd-*   every command in Search (Ctrl+K), except the library items, which the objects slice places one by one
     fn-key-*   every documented keyboard shortcut, with StoreyBook keys (fn-key-sb-*) and with SketchUp keys (fn-key-su-*)
     fn-ctx-*   every right-click menu entry, on empty ground, a desk, two desks, a group, a room, a wall and a door
     fn-set-*   every Settings control: it changes something, and a change to a setting survives a reload
   Each function runs in its own fresh browser context with the sample plan, so one cannot spoil the next. It passes when it raises
   no page error and something visibly happens: the plan, the view, the selection, the tool, a dialog, a toast, a file dialog or a download.
   A command that does nothing at first is tried again from other starts: a desk selected, another tool on, the 3D view, the side panels shut. SB_FN=cmd,key,ctx,set picks parts;
   SB_FN_PAR the number of contexts at once (default 3); SB_CHECK=<regex> runs matching ids only. */
import {row,devFile,ROOT} from '../lib.mjs';
export const name='functions';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ONLY=()=>process.env.SB_CHECK?new RegExp(process.env.SB_CHECK):null;
const slug=s=>String(s).replace(/\?/g,'question').replace(/\//g,'slash').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'x';
/* what a person could see change */
const SNAP=()=>{const o=window.__osp,q=s=>document.querySelector(s),vis=e=>!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&e.getBoundingClientRect().width>0;
  let plan='';try{const j=JSON.parse(o.planJSON());/* the save time and the id a plan is given on its first autosave are not changes anyone sees */delete j.saved;delete j.at;delete j.pid;plan=JSON.stringify(j)}catch(e){plan='ERR'}
  const T=o.T3(),cam=T&&T.camera&&!q('#v3').hidden?[T.camera.position.x,T.camera.position.y,T.camera.position.z].map(v=>Math.round(v*50)).join(','):'';
  const tl=q('.dock .on[data-tool]');const SU=o.SU();
  return {plan,view:[o.V.x,o.V.y,o.V.k].map(v=>Math.round(v*1000)).join(','),prefs:JSON.stringify(o.P()),tool:tl?tl.dataset.tool:'',v3:!q('#v3').hidden,bld:o.bldView(),walk:o.WALK.on,
    sel:o.sel().join(','),dialogs:[...document.querySelectorAll('.keys-modal,.pop,#cmdk,#ai-panel,#ctxmenu,#msheet,#sun-bar,#polybar,#multibar,#tut,#tut-menu,#su-chip,#tpl-modal,#plans-modal,#snap-modal')].filter(vis).map(e=>e.id).sort().join(','),
    toast:vis(q('#toast'))?q('#toast').textContent.slice(0,80):'',su:JSON.stringify([SU.hidden.size,SU.gctx,SU.style,SU.xray,SU.par,SU.tagcol,SU.secfill,(SU.views||[]).length]),
    theme:document.documentElement.dataset.theme||'',cls:document.documentElement.className+'|'+q('#main').className,tabs:o.tabs().map(t=>t.id+t.name).join(','),cam,roof:o.roofMode(),
    hint:vis(q('#hint'))?q('#hint').textContent.slice(0,60):'',focus:(()=>{const a=document.activeElement;return a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)?a.tagName+'#'+(a.id||a.className||''):''})(),files:(window.__sfp||0)+':'+(window.__dl||0),title:document.title,insp:vis(q('#d-insp'))?[...document.querySelectorAll('#d-insp .tabs [data-tab]')].filter(b=>b.classList.contains('on')).map(b=>b.dataset.tab).join(''):'',lib:vis(q('#d-lib'))}};
const diff=(a,b)=>Object.keys(a).filter(k=>a[k]!==b[k]);
const INIT=()=>{window.__sfp=0;window.__dl=0;window.showSaveFilePicker=async()=>{window.__sfp++;throw new DOMException('test','AbortError')};window.showOpenFilePicker=async()=>{window.__sfp++;throw new DOMException('test','AbortError')};
  const ce=Document.prototype.createElement;Document.prototype.createElement=function(t,...a){const e=ce.call(this,t,...a);if(String(t).toLowerCase()==='a'){const c=e.click;e.click=function(){if(this.download){window.__dl++;return}return c.call(this)}}if(String(t).toLowerCase()==='input'){const c=e.click;e.click=function(){if(this.type==='file'){window.__sfp++;return}return c.call(this)}}return e}};
/* a fresh desktop page with the sample plan; mode 'sb' or 'su' sets the key set */
async function fresh(b,mode){const ctx=await b.newContext({viewport:{width:1400,height:900}});await ctx.addInitScript(INIT);const pg=await ctx.newPage();pg.errs=[];pg.ev={dialog:0,chooser:0,download:0,nav:0};
  pg.on('pageerror',e=>pg.errs.push('PE:'+e.message.slice(0,160)));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR/.test(m.text()))pg.errs.push(m.text().slice(0,160))});
  pg.on('dialog',d=>{pg.ev.dialog++;d.type()==='prompt'?d.accept(d.defaultValue()||'Test').catch(()=>{}):d.accept().catch(()=>{})});pg.on('filechooser',()=>pg.ev.chooser++);pg.on('download',()=>pg.ev.download++);
  pg.on('framenavigated',f=>{if(f===pg.mainFrame())pg.ev.nav++});
  await pg.goto(devFile().replace(/#.*$/,'#osp-debug'+(mode==='su'?'-su':'')),{waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,null,{timeout:20000});
  await pg.evaluate(()=>{const b=document.querySelector('#m-sample');if(b)b.click()});await pg.waitForFunction(()=>window.__osp.S().objs.length>100,null,{timeout:8000});
  /* the sample has no free-standing wall: one goes in below the building so walls can be right-clicked too */
  await pg.evaluate(()=>{const o=window.__osp,S=o.S();if(!S.objs.some(x=>x.t==='wall'&&!x.site)){const ys=S.objs.filter(x=>x.t==='room').flatMap(x=>x.pts.map(p=>p[1])),xs=S.objs.filter(x=>x.t==='room').flatMap(x=>x.pts.map(p=>p[0]));const y=Math.max(...ys)+1500,x0=Math.min(...xs);o.addObjs([{id:'fnwall',t:'wall',pts:[[x0+1000,y],[x0+9000,y]],th:200,closed:false,gid:null}],false)}
    o.toastOff();o.fit()});await sleep(150);pg.ev.nav=0;pg.ctx=ctx;return pg}
async function done(pg){try{await Promise.race([pg.ctx.close(),sleep(5000)])}catch(e){}}
/* plan items the tests pick: a desk on its own, two desks, a grouped desk, a door, a room, a wall */
const PICK=k=>{const o=window.__osp,S=o.S(),V=o.V,r=document.querySelector('#plan').getBoundingClientRect();
  const on=(x,y)=>{const X=r.left+(x-V.x)*V.k,Y=r.top+(y-V.y)*V.k;if(X<r.left+300||X>r.right-330||Y<r.top+20||Y>r.bottom-110)return null;return [X,Y]};
  const hit=(o2,p)=>{if(!p)return false;const e=document.elementFromPoint(p[0],p[1]);const h=e&&e.closest('[data-id]');return !!h&&h.dataset.id===o2.id};
  const items=S.objs.filter(x=>x.t==='item');const desk=f=>items.filter(x=>/desk|workstation/i.test(x.name+' '+x.cat)&&f(x)).map(x=>({o:x,p:on(x.x,x.y)})).filter(x=>hit(x.o,x.p));
  if(k==='desk'){const d=desk(x=>!x.gid)[0]||desk(()=>true)[0];return d?{ids:[d.o.id],p:d.p}:null}
  if(k==='two'){const d=desk(x=>!x.gid);return d.length>1?{ids:[d[0].o.id,d[1].o.id],p:d[0].p,q:d[1].p}:null}
  if(k==='group'){const d=desk(x=>!!x.gid)[0];return d?{ids:[d.o.id],p:d.p}:null}
  if(k==='door'){const d=items.filter(x=>x.cat==='Door').map(x=>({o:x,p:on(x.x,x.y)})).filter(x=>hit(x.o,x.p))[0];return d?{ids:[d.o.id],p:d.p}:null}
  if(k==='room'||k==='wall'){for(const x of S.objs.filter(x=>x.t===k)){const P=x.pts;for(let i=0;i<P.length;i++){const a=P[i],c=P[(i+1)%P.length];for(const t of [0.3,0.5,0.7]){const p=on(a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t);if(hit(x,p))return {ids:[x.id],p}}}
      if(k==='room'){const cx=P.reduce((s,q)=>s+q[0],0)/P.length,cy=P.reduce((s,q)=>s+q[1],0)/P.length;const p=on(cx,cy);if(hit(x,p))return {ids:[x.id],p}}}return null}
  if(k==='empty'){for(let y=r.top+40;y<r.bottom-120;y+=19)for(let x=r.left+320;x<r.right-340;x+=19){const e=document.elementFromPoint(x,y);if(e&&e.closest('#plan')&&!e.closest('[data-id],[data-pin],[data-vh],[data-bh],[data-roth],[data-aim]'))return {ids:[],p:[x,y]}}return null}
  return null};
async function prep(pg,k){if(!k||k==='none')return true;if(['edited','undone','floors','zoomed','tool','v3','hold','closed'].includes(k)){if(k!=='hold')await keyPrep(pg,k);return true}
  /* the plan may still be drawing: look again after a frame or two */let t=null;for(let i=0;i<4&&!t;i++){if(i)await sleep(250);t=await pg.evaluate(PICK,k==='copied'?'desk':k)}if(!t)return false;
  await pg.mouse.click(t.p[0],t.p[1]);if(k==='two'){await sleep(300);await pg.keyboard.down('Shift');await pg.mouse.click(t.q[0],t.q[1]);await pg.keyboard.up('Shift')}
  await sleep(350);if(k==='copied'){await pg.keyboard.press('Control+c');await sleep(100);await pg.keyboard.press('Escape');await pg.mouse.move(t.p[0]+60,t.p[1]+40)}
  await pg.evaluate(()=>window.__osp.toastOff());await sleep(100);return true}
/* run one thing in a fresh page and judge it */
async function attempt(b,mode,pre,act){const pg=await fresh(b,mode);try{if(!(await prep(pg,pre)))return {skip:'no '+pre+' on screen'};
    const a=await pg.evaluate(SNAP);const e0=pg.errs.length,ev0=JSON.stringify(pg.ev);let how='';try{how=await act(pg)||''}catch(e){return {fail:'could not run it: '+String(e.message||e).split('\n')[0].slice(0,160)}}
    await sleep(500);if(await pg.evaluate(()=>!document.querySelector('#v3').hidden&&!window.__osp.T3()))await pg.waitForFunction(()=>window.__osp.T3()&&window.__osp.T3().renderer,null,{timeout:15000}).catch(()=>{});
    let z;try{z=await pg.evaluate(SNAP)}catch(e){z=null}const d=z?diff(a,z):['page reloaded'];if(JSON.stringify(pg.ev)!==ev0)d.push('browser:'+Object.keys(pg.ev).filter(k=>pg.ev[k]).join('+'));
    const errs=pg.errs.slice(e0);return {effect:d,errs,how,toast:z&&z.toast}}finally{await done(pg)}}
async function judge(b,mode,pres,act){let last=null;for(const pre of pres){const r=await attempt(b,mode,pre,act);if(r.skip){last=last||r;continue}if(r.fail||r.errs.length||r.effect.length)return {...r,pre};last={...r,pre}}return last}
const verdict=r=>!r?{pass:false,detail:'not run'}:r.skip?{pass:false,detail:'could not set up: '+r.skip}:r.fail?{pass:false,detail:r.fail}:r.errs.length?{pass:false,detail:{errors:r.errs.slice(0,3),effect:r.effect,start:r.pre}}:r.effect.length?{pass:true,detail:{effect:r.effect,start:r.pre,toast:r.toast||undefined}}:{pass:false,detail:{why:'nothing visible happened',start:r.pre,how:r.how}};
async function pool(jobs,n){const out=[];let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<jobs.length){const j=i++;out[j]=await jobs[j]()}}));return out}

/* ---- every Search command ---- */
async function cmds(b){const pg=await fresh(b,'sb');const info=await pg.evaluate(()=>window.__osp.fnInfo());await done(pg);
  const list=info.cmds.filter(c=>!/^Place/.test(c.group));const seen={};
  return list.map(c=>{let id='fn-cmd-'+slug(c.name);seen[id]=(seen[id]||0)+1;if(seen[id]>1)id+='-'+seen[id];return {id,nm:`Search › ${c.name} (${c.group}) runs and does something`,run:async()=>verdict(await judge(b,'sb',['none','desk','tool','v3','closed'],async pg=>{
    await pg.keyboard.press('Control+k');await pg.waitForSelector('#cmdk:not([hidden])',{timeout:3000});await pg.keyboard.insertText(c.name);await sleep(120);
    const h=await pg.evaluate(n=>{const l=[...document.querySelectorAll('#cmdk-list [data-ck]')];const i=l.findIndex(x=>x.querySelector('.nm').textContent===n);if(i<0)return null;l[i].dataset.fnpick='1';return i},c.name);
    if(h==null)throw new Error('not listed when its name is typed');await pg.click('#cmdk-list [data-fnpick="1"]');return 'search'}))}})}
/* ---- every documented shortcut, in both key sets ---- */
const SBKEY={v:['v','tool'],h:['h'],d:['d'],w:['w'],s:['s'],g:['g'],m:['m'],t:['t'],p:['p'],r:['r','desk'],x:['x','door'],del:['Delete','desk'],esc:['Escape','desk'],q:['q'],u:['u'],c:['c'],l:['l'],i:['i'],f:['f','zoomed'],tab:['Tab'],'1':['1'],'2':['2','v3'],'3':['3'],space:['Space','hold'],'/':['?']};
const COMBOS=[['Shift+R','desk'],['Shift+X','door'],['Control+z','edited'],['Control+y','undone'],['Control+c','desk'],['Control+x','desk'],['Control+v','copied'],['Control+d','desk'],['Control+a','none'],['Control+g','two'],['Control+Shift+G','group'],['Control+s','none'],['Control+o','none'],['Control+k','none'],['PageUp','floors'],['PageDown','floors'],['ArrowRight','desk'],['Shift+ArrowDown','desk'],['?','none']];
const SUKEY={Space:['Space','tool'],L:['l'],R:['r'],M:['m'],Q:['q'],E:['e'],T:['t'],S:['s'],B:['b'],H:['h'],O:['o'],A:['a'],C:['c'],F:['f'],'Shift+Z':['Shift+Z','zoomed'],G:['g','desk'],P:['p'],K:['k']};
async function keyPrep(pg,k){/* starts the generic prep cannot make */
  if(k==='edited'){const t=await pg.evaluate(PICK,'desk');await pg.mouse.click(t.p[0],t.p[1]);await sleep(300);await pg.keyboard.press('Control+d');await sleep(200)}
  else if(k==='undone'){const t=await pg.evaluate(PICK,'desk');await pg.mouse.click(t.p[0],t.p[1]);await sleep(300);await pg.keyboard.press('Control+d');await sleep(200);await pg.keyboard.press('Control+z');await sleep(200)}
  else if(k==='floors'){await pg.evaluate(()=>{const o=window.__osp;if(!o.P().insp)document.querySelector('#t-insp').click();document.querySelector('#tab-bld').click()});await sleep(200);await pg.click('#p-bld [data-bb="addL"]');await sleep(300)}
  else if(k==='zoomed'){await pg.mouse.move(700,450);await pg.mouse.wheel(0,-400);await sleep(200)}
  else if(k==='tool'){await pg.click('.dock [data-tool="room"]');await sleep(150)}
  else if(k==='closed'){await pg.evaluate(()=>{const o=window.__osp;if(o.P().insp)document.querySelector('#t-insp').click();if(o.P().lib)document.querySelector('#t-lib').click()});await sleep(200)}
  else if(k==='v3'){await pg.click('#v3d');await pg.waitForFunction(()=>window.__osp.T3()&&window.__osp.T3().renderer,null,{timeout:15000});await sleep(300)}
  await pg.evaluate(()=>window.__osp.toastOff())}
function keyJob(b,mode,id,label,key,pre){return {id,nm:`${mode==='su'?'SketchUp':'StoreyBook'} keys: ${label} does what the Shortcuts list says (something visible happens)`,run:async()=>{
  return verdict(await judge(b,mode,[pre||'none'],async pg=>{await pg.mouse.move(700,450);
    if(pre==='hold'){/* Space: hold it and drag to pan */const p=await pg.evaluate(PICK,'empty');await pg.mouse.move(p.p[0],p.p[1]);await pg.keyboard.down(' ');await pg.mouse.down();await pg.mouse.move(p.p[0]+80,p.p[1]+50,{steps:6});await pg.mouse.up();await pg.keyboard.up(' ');return 'hold Space and drag'}
    await pg.keyboard.press(key===' '||key==='Space'?' ':key);return 'key '+key}))}}}
async function keys(b){const pg=await fresh(b,'sb');const info=await pg.evaluate(()=>window.__osp.fnInfo());await done(pg);const J=[];
  for(const k of info.keymap){const s=SBKEY[k];if(!s){J.push({id:'fn-key-sb-'+slug(k),nm:`StoreyBook keys: "${k}" is listed in Shortcuts but this sweep does not know how to press it`,run:async()=>({pass:false,detail:'add it to SBKEY in checks/functions.mjs'})});continue}J.push(keyJob(b,'sb','fn-key-sb-'+slug(k),`"${k}"`,s[0],s[1]))}
  for(const [k,pre] of COMBOS)J.push(keyJob(b,'sb','fn-key-sb-'+slug(k),k,k,pre));
  for(const [nm,k] of info.su){const s=SUKEY[k];if(!s){J.push({id:'fn-key-su-'+slug(k),nm:`SketchUp keys: "${k}" (${nm}) is listed but this sweep does not know how to press it`,run:async()=>({pass:false,detail:'add it to SUKEY in checks/functions.mjs'})});continue}J.push(keyJob(b,'su','fn-key-su-'+slug(k),`${k} (${nm})`,s[0],s[1]))}
  J.push(keyJob(b,'su','fn-key-su-f8','F8 (Previous view)','F8','zoomed'));
  for(const [k,pre] of COMBOS.filter(c=>/^Control/.test(c[0])))J.push(keyJob(b,'su','fn-key-su-'+slug(k),k,k,pre));
  return J}
/* ---- every right-click menu entry ---- */
const TARGETS=['empty','desk','two','group','room','wall','door'];
async function openCtx(pg,t){const p=t==='empty'?await pg.evaluate(PICK,'empty'):await pg.evaluate(PICK,t==='two'?'desk':t);if(!p)throw new Error('no '+t+' on screen');await pg.mouse.click(p.p[0],p.p[1],{button:'right'});await pg.waitForSelector('#ctxmenu:not([hidden])',{timeout:3000})}
async function ctx(b){const J=[];for(const mode of ['sb','su'])for(const t of TARGETS){const pg=await fresh(b,mode);let ents=[];try{if(await prep(pg,t==='empty'?'none':t)){await openCtx(pg,t);ents=await pg.evaluate(()=>[...document.querySelectorAll('#ctxmenu [data-cm]')].map(e=>[e.dataset.cm,e.textContent.trim().slice(0,40)]))}}catch(e){}await done(pg);
    const pre=mode==='su'?'fn-ctx-su-':'fn-ctx-';/* with SketchUp keys only the entries StoreyBook keys do not have */if(mode==='su'){const sb=new Set((J.filter(j=>j.cm&&j.t===t&&j.mode==='sb').map(j=>j.cm)));ents=ents.filter(e=>!sb.has(e[0]))}
    if(!ents.length){if(mode==='su')continue;J.push({id:'fn-ctx-'+t,nm:`right-click menu on ${t} opens`,run:async()=>({pass:false,detail:'no menu, or nothing to right-click'})});continue}
    for(const [cm,lab] of ents)J.push({cm,t,mode,id:`${pre}${t}-${slug(cm)}`,nm:`${mode==='su'?'SketchUp keys: ':''}right-click ${t} › ${lab} does something`,run:async()=>verdict(await judge(b,mode,[t==='empty'?'none':t],async pg=>{await openCtx(pg,t);await pg.click(`#ctxmenu [data-cm="${cm}"]`);return 'menu'}))})}
  return J}
/* ---- every Settings control, and settings survive a reload ---- */
async function settings(b){const pg=await fresh(b,'sb');await pg.click('#b-set');await pg.waitForSelector('#pop-set:not([hidden])');
  const ctl=await pg.evaluate(()=>[...document.querySelectorAll('#pop-set input,#pop-set select,#pop-set button')].filter(e=>{const r=e.getBoundingClientRect();return (r.width>0||e.closest('.sw'))&&!e.disabled}).map((e,i)=>{const id=e.id||'';const lab=(e.getAttribute('aria-label')||(e.closest('.set')&&e.closest('.set').querySelector('span')||{}).textContent||e.textContent||e.title||'').trim().slice(0,50);return {i,id,lab,tag:e.tagName,type:e.type||''}}));await done(pg);
  const seen={};return ctl.map(c=>{let id='fn-set-'+slug(c.id||c.lab);seen[id]=(seen[id]||0)+1;if(seen[id]>1)id+='-'+seen[id];return {id,nm:`Settings › ${c.lab||c.id} does something${c.tag!=='BUTTON'?' and the choice survives a reload':''}`,run:async()=>{
    const pg=await fresh(b,'sb');try{await pg.click('#b-set');await pg.waitForSelector('#pop-set:not([hidden])');const sel=c.id?'#'+c.id:null;
      await pg.evaluate(c=>{const l=[...document.querySelectorAll('#pop-set input,#pop-set select,#pop-set button')].filter(e=>{const r=e.getBoundingClientRect();return (r.width>0||e.closest('.sw'))&&!e.disabled});const e=l[c.i];if(e)e.dataset.fnset='1';e&&e.scrollIntoView({block:'center'})},c);
      const q='#pop-set [data-fnset="1"]';const a=await pg.evaluate(SNAP);const e0=pg.errs.length,ev0=JSON.stringify(pg.ev);
      if(c.tag==='SELECT'){const v=await pg.evaluate(q=>{const e=document.querySelector(q);const o=[...e.options].map(o=>o.value).filter(v=>v!==e.value);return o[0]},q);if(v==null)return {pass:false,detail:'a list with one choice'};await pg.selectOption(q,v)}
      else if(c.type==='checkbox'){const h=await pg.evaluate(q=>{const e=document.querySelector(q),s=e.closest('.sw')||e;s.dataset.fnsw='1';return true},q);await pg.click('#pop-set [data-fnsw="1"]')}
      else if(c.type==='range'){await pg.focus(q);await pg.keyboard.press('ArrowRight');await pg.keyboard.press('ArrowRight')}
      else if(c.type==='color'){await pg.evaluate(q=>{const e=document.querySelector(q);e.value='#3366cc';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))},q)}
      else if(c.tag==='INPUT'){await pg.fill(q,'Test value');await pg.keyboard.press('Enter')}
      else await pg.click(q);
      await sleep(500);let z;try{z=await pg.evaluate(SNAP)}catch(e){z=null}const d=z?diff(a,z):['page reloaded'];if(JSON.stringify(pg.ev)!==ev0)d.push('browser');const errs=pg.errs.slice(e0);
      if(errs.length)return {pass:false,detail:{errors:errs.slice(0,3),effect:d}};if(!d.length)return {pass:false,detail:'nothing visible happened'};
      if(c.tag!=='BUTTON'&&d.includes('prefs')&&z){/* the choice survives a reload */const P1=JSON.parse(z.prefs);await pg.reload({waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,null,{timeout:20000});const P2=await pg.evaluate(()=>window.__osp.P());
        const lost=Object.keys(P1).filter(k=>JSON.stringify(P1[k])!==JSON.stringify(JSON.parse(a.prefs)[k])&&JSON.stringify(P1[k])!==JSON.stringify(P2[k]));if(lost.length)return {pass:false,detail:{why:'not kept after a reload',lost}}}
      return {pass:true,detail:{effect:d}}}catch(e){return {pass:false,detail:String(e.message||e).split('\n')[0].slice(0,200)}}finally{await done(pg)}}}})}
export async function run(b){const parts=(process.env.SB_FN||'cmd,key,ctx,set').split(','),only=ONLY(),par=+(process.env.SB_FN_PAR||3);const J=[];
  if(parts.includes('cmd'))J.push(...await cmds(b));if(parts.includes('key'))J.push(...await keys(b));if(parts.includes('ctx'))J.push(...await ctx(b));if(parts.includes('set'))J.push(...await settings(b));
  const jobs=J.filter(j=>!only||only.test(j.id));const res=await pool(jobs.map(j=>async()=>{let r;try{r=await j.run()}catch(e){r={pass:false,detail:'threw: '+String(e.message||e).split('\n')[0].slice(0,200)}}return row(j.id,j.nm,r.pass,r.detail)}),par);
  return res}
export const retryable=true;
