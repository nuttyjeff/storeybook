/* shared helpers for the release checks */
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
/* paths: this machine's defaults, or SB_ROOT / SB_OUT / SB_TOOLS (CI sets them; the repo's own node_modules when /opt/npm-tools is absent) */
export const ROOT=process.env.SB_ROOT||path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
export const TOOLS=process.env.SB_TOOLS||(fs.existsSync('/opt/npm-tools/node_modules')?'/opt/npm-tools/':ROOT+'/');
const require=createRequire(TOOLS); export const { chromium, devices } = require('playwright');
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
export async function browser(){const b=await chromium.launch({args:GL});
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
export async function touch(pg){const cdp=await pg.ctx.newCDPSession(pg);const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(p=>Object.assign({x:p[0],y:p[1]},p.length>2?{id:p[2]}:{}))});
  return {T,tap:async(x,y)=>{await T('touchStart',[[x,y]]);await T('touchEnd',[])},drag:async(a,b,n=12)=>{await T('touchStart',[a]);for(let i=1;i<=n;i++){await T('touchMove',[[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]]);await pg.waitForTimeout(16)}await T('touchEnd',[])}}}
/* world -> screen */
export const scr=(pg,wx,wy)=>pg.evaluate(([wx,wy])=>{const o=window.__osp,V=o.V,r=document.querySelector('#plan').getBoundingClientRect();return [r.left+(wx-V.x)*V.k,r.top+(wy-V.y)*V.k]},[wx,wy]);
export const click=(pg,sel)=>pg.evaluate(s=>{const e=document.querySelector(s);if(!e)throw new Error('no element '+s);e.click()},sel);
export const to3D=async pg=>{await click(pg,'#v3d');await pg.waitForFunction(()=>window.__osp.T3()&&window.__osp.T3().renderer,{timeout:30000});await pg.waitForTimeout(800)};
export const to2D=async pg=>{await click(pg,'#v2d');await pg.waitForTimeout(200)};
/* result row */
export const row=(id,name,pass,detail='')=>{const r={id,name,pass:!!pass,detail:typeof detail==='string'?detail:JSON.stringify(detail)};if(!r.pass)shoot(r);return r};
