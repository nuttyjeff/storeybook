/* shared helpers for the release checks */
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
/* paths: this machine's defaults, or SB_ROOT / SB_OUT / SB_TOOLS (CI sets them; the repo's own node_modules when /opt/npm-tools is absent) */
export const ROOT=process.env.SB_ROOT||path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
export const TOOLS=process.env.SB_TOOLS||(fs.existsSync('/opt/npm-tools/node_modules')?'/opt/npm-tools/':ROOT+'/');
/* SB_ENGINE=webkit runs the same checks in Safari's engine (GitHub only: this container has Chromium alone) */
export const ENGINE=process.env.SB_ENGINE||'chromium';
const require=createRequire(TOOLS);const PW=require('playwright');export const { devices } = PW;export const chromium=PW[ENGINE];
export const OUT=process.env.SB_OUT||(fs.existsSync('/mnt/user-data/outputs')?'/mnt/user-data/outputs':path.join(ROOT,'out'));
export const appVersion=()=>(fs.readFileSync(path.join(ROOT,'app.js'),'utf8').match(/APP_VERSION='([0-9.]+)'/)||[])[1];
/* SB_SUKEYS=1 opens the app with SketchUp keys on (#osp-debug-su); otherwise StoreyBook keys, as before */
export const devFile=()=>`file://${OUT}/StoreyBook v${appVersion()}.html#osp-debug${process.env.SB_SUKEYS?'-su':''}`;
export const GL=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
/* every page opened through this browser is watched, so a failing check can leave a picture of the page that was in use (see row()) */
const PAGES=new Set();const SHOTS=[];let shotN=0;
export const SHOT_DIR=path.join(ROOT,'test/release/out/shots');
function watch(p){p.__act=0;PAGES.add(p);p.on('close',()=>PAGES.delete(p));const mark=(o,ms)=>{for(const m of ms){const f=o&&o[m];if(typeof f==='function')o[m]=function(...a){p.__act=Date.now();return f.apply(this,a)}}};
  mark(p,['evaluate','waitForFunction','goto','click','tap','fill','dblclick','hover','waitForTimeout']);mark(p.mouse,['click','dblclick','down','up','move','wheel']);mark(p.keyboard,['press','type','down','up']);mark(p.touchscreen,['tap']);return p}
export async function browser(){const b=await PW[ENGINE].launch(ENGINE==='chromium'?{args:GL}:{});
  const wctx=c=>{const np=c.newPage.bind(c);c.newPage=async(...a)=>watch(await np(...a));return c};
  const nc=b.newContext.bind(b);b.newContext=async(...a)=>wctx(await nc(...a));const bp=b.newPage.bind(b);b.newPage=async(...a)=>watch(await bp(...a));return b}
/* a picture of the one page used in the last 3 s. When several pages were busy at once (slices that run devices side by side) no picture is taken
   rather than a wrong one. The runner waits for the pictures at the end of each layer (flushShots). At most 80 per run */
function shoot(r){if(process.env.SB_SHOTS==='0')return;const now=Date.now(),live=[...PAGES].filter(p=>!p.isClosed()&&now-p.__act<3000);
  if(live.length!==1){r.shotNote=live.length?'several pages were in use at once, so no picture':'no page was in use';return}if(shotN>=80){r.shotNote='picture limit reached';return}
  const f=String(r.id).replace(/[^a-z0-9@.-]+/gi,'_').slice(0,90)+'-'+(++shotN)+'.png';fs.mkdirSync(SHOT_DIR,{recursive:true});r.shot='shots/'+f;
  SHOTS.push(live[0].screenshot({path:path.join(SHOT_DIR,f),timeout:8000}).catch(()=>{r.shot=null;r.shotNote='the picture could not be taken'}))}
export async function flushShots(){const a=SHOTS.splice(0);await Promise.all(a)}
/* open the app in a page; collects console errors and page errors into page.errs */
export async function openApp(b,{phone=false,url=devFile(),sample=true}={}){
  const ctx=phone?await b.newContext({...devices['iPhone 13']}):await b.newContext({viewport:{width:1400,height:900}});
  const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push('PE:'+e.message));pg.on('console',m=>{if(m.type()==='error')pg.errs.push(m.text())});
  await pg.goto(url,{waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,{timeout:20000});
  if(sample){await pg.evaluate(()=>{const b=document.querySelector('#m-sample');if(b)b.click()});await pg.waitForTimeout(400)}
  pg.ctx=ctx;return pg}
/* fingers: Chrome's own touch input; in Safari's engine (no such channel) touch and pointer events are sent to the element under each finger */
const SYNTH=([type,pts,prev])=>{const kind={touchStart:'start',touchMove:'move',touchEnd:'end',touchCancel:'cancel'}[type];const list=kind==='end'||kind==='cancel'?prev:pts;
  for(const [i,p] of list.entries()){const x=p[0],y=p[1],id=(p.length>2?p[2]:i)+1;const t=document.elementFromPoint(x,y)||document.body;const o={bubbles:true,cancelable:true,composed:true,pointerId:id,pointerType:'touch',isPrimary:i===0,clientX:x,clientY:y,button:kind==='move'?-1:0,buttons:kind==='end'||kind==='cancel'?0:1};
    t.dispatchEvent(new PointerEvent({start:'pointerdown',move:'pointermove',end:'pointerup',cancel:'pointercancel'}[kind],o));if(kind==='end'){t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y}))}}};
export async function touch(pg){let T;if(ENGINE==='chromium'){const cdp=await pg.ctx.newCDPSession(pg);T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(p=>Object.assign({x:p[0],y:p[1]},p.length>2?{id:p[2]}:{}))})}
  else{let prev=[];T=async(type,pts)=>{await pg.evaluate(SYNTH,[type,pts,prev]);prev=type==='touchEnd'||type==='touchCancel'?[]:pts}}
  return {T,tap:async(x,y)=>{await T('touchStart',[[x,y]]);await T('touchEnd',[])},drag:async(a,b,n=12)=>{await T('touchStart',[a]);for(let i=1;i<=n;i++){await T('touchMove',[[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]]);await pg.waitForTimeout(16)}await T('touchEnd',[])}}}
/* world -> screen */
export const scr=(pg,wx,wy)=>pg.evaluate(([wx,wy])=>{const o=window.__osp,V=o.V,r=document.querySelector('#plan').getBoundingClientRect();return [r.left+(wx-V.x)*V.k,r.top+(wy-V.y)*V.k]},[wx,wy]);
export const click=(pg,sel)=>pg.evaluate(s=>{const e=document.querySelector(s);if(!e)throw new Error('no element '+s);e.click()},sel);
export const to3D=async pg=>{await click(pg,'#v3d');await pg.waitForFunction(()=>window.__osp.T3()&&window.__osp.T3().renderer,{timeout:30000});await pg.waitForTimeout(800)};
export const to2D=async pg=>{await click(pg,'#v2d');await pg.waitForTimeout(200)};
/* SketchUp keys (SB_SUKEYS=1): a check that presses a key whose meaning differs asks which set is on */
export const SUKEYS=()=>!!process.env.SB_SUKEYS;
/* a 90° turn the way a user makes one. StoreyBook keys: R / Shift+R. SketchUp keys (R draws a rectangle there): on the plan, right-click an empty
   spot and pick Rotate 90° from the menu (it keeps the selection and is offered for every kind of object); in 3D, the Details panel's 90° buttons */
export async function turn90(pg,ccw){if(!SUKEYS())return pg.keyboard.press(ccw?'Shift+R':'r');
  const p=await pg.evaluate(()=>{const v=document.querySelector('#v3');if(v&&!v.hidden)return null;const r=document.querySelector('#plan').getBoundingClientRect();
    for(let y=r.top+30;y<r.bottom-30;y+=17)for(let x=r.left+30;x<r.right-30;x+=17){const t=document.elementFromPoint(x,y);if(t&&t.closest('#plan')&&!t.closest('[data-id],[data-pin],[data-vh],[data-bh],[data-roth],[data-aim]'))return[x,y]}return null});
  if(p){await pg.mouse.click(p[0],p[1],{button:'right'});const s=`#ctxmenu [data-cm="${ccw?'rotccw':'rotcw'}"]`;await pg.waitForSelector(s,{state:'visible',timeout:3000});await pg.click(s);await pg.mouse.move(5,5);return}
  await pg.evaluate(()=>{if(!window.__osp.P().insp)document.querySelector('#t-insp').click();if(document.querySelector('#p-sel').hidden)document.querySelector('#tab-sel').click()});
  const s=`#p-sel [data-act="${ccw?'ccw':'cw'}"]`;await pg.waitForSelector(s,{state:'visible',timeout:3000});await pg.click(s);await pg.mouse.move(5,5)}
/* result row */
export const row=(id,name,pass,detail='')=>{const r={id,name,pass:!!pass,detail:typeof detail==='string'?detail:JSON.stringify(detail)};if(!r.pass)shoot(r);return r};
