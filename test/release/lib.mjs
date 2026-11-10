/* shared helpers for the release checks */
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
/* paths: this machine's defaults, or SB_ROOT / SB_OUT / SB_TOOLS (CI sets them; the repo's own node_modules when /opt/npm-tools is absent) */
export const ROOT=process.env.SB_ROOT||path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
export const TOOLS=process.env.SB_TOOLS||(fs.existsSync('/opt/npm-tools/node_modules')?'/opt/npm-tools/':ROOT+'/');
const require=createRequire(TOOLS); export const { chromium, devices } = require('playwright');
export const OUT=process.env.SB_OUT||(fs.existsSync('/mnt/user-data/outputs')?'/mnt/user-data/outputs':path.join(ROOT,'out'));
export const appVersion=()=>(fs.readFileSync(path.join(ROOT,'app.js'),'utf8').match(/APP_VERSION='([0-9.]+)'/)||[])[1];
export const devFile=()=>`file://${OUT}/StoreyBook v${appVersion()}.html#osp-debug`;
export const GL=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
export async function browser(){return chromium.launch({args:GL})}
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
export const row=(id,name,pass,detail='')=>({id,name,pass:!!pass,detail:typeof detail==='string'?detail:JSON.stringify(detail)});
