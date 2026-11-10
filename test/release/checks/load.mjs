/* layer 2: load and console sweep on desktop and phone */
import {openApp,row,click,to3D,to2D,touch} from '../lib.mjs';
export const name='load';
const TOOLS=['select','room','poly','spline','road','fence','shape','measure','text','paint','trunk','section','pin','pan','place'];
const TABS=['sel','sch','bld','fire','und','notes'];
async function sweep(pg,label){
  const R=[];const mark=()=>{const n=pg.errs.length;return ()=>pg.errs.slice(n)};
  let m=mark();for(const t of TOOLS){await pg.evaluate(t=>window.__osp.setTool(t),t);await pg.waitForTimeout(30)}await pg.evaluate(()=>window.__osp.setTool('select'));
  R.push(row('l-tools-'+label,`${label}: every tool activates`,m().length===0,m()));
  m=mark();for(const t of TABS){await pg.evaluate(t=>{const b=document.querySelector(`[data-tab=${t}]`);if(b)b.click()},t);await pg.waitForTimeout(60)}
  R.push(row('l-tabs-'+label,`${label}: every inspector tab renders`,m().length===0,m()));
  m=mark();await to3D(pg);R.push(row('l-3d-'+label,`${label}: 3D builds`,m().length===0&&await pg.evaluate(()=>window.__osp.T3().group.children.length>0),m()));
  /* Walk: press Walk in 2D, then tap a room to start there */
  await to2D(pg);if(label==='phone'){await click(pg,'#mbar [data-m=select]');await pg.waitForTimeout(150)}m=mark();await click(pg,'#b-walk');await pg.waitForTimeout(150);
  const c=await pg.evaluate(()=>{const o=window.__osp,S=o.S();const r=S.objs.find(x=>x.t==='room');const c=r.pts.reduce((a,p)=>[a[0]+p[0]/r.pts.length,a[1]+p[1]/r.pts.length],[0,0]);const V=o.V,rr=document.querySelector('#plan').getBoundingClientRect();return [rr.left+(c[0]-V.x)*V.k,rr.top+(c[1]-V.y)*V.k]});
  if(label==='phone'){const t=await touch(pg);await t.tap(c[0],c[1])}else await pg.mouse.click(c[0],c[1]);await pg.waitForFunction(()=>window.__osp.WALK.on,{timeout:20000}).catch(()=>{});await pg.waitForTimeout(500);
  const walking=await pg.evaluate(()=>window.__osp.WALK.on&&!document.querySelector('#walk-hud').hidden);
  R.push(row('l-walk-'+label,`${label}: Walk mode enters from a tapped room`,m().length===0&&walking,{errs:m(),walking}));
  await click(pg,'#v3d');await pg.waitForTimeout(400);
  m=mark();await click(pg,'#vbld');await pg.waitForTimeout(1500);R.push(row('l-bld-'+label,`${label}: Building view`,m().length===0,m()));
  m=mark();await to2D(pg);R.push(row('l-2d-'+label,`${label}: back to 2D`,m().length===0,m()));
  m=mark();for(const id of ['m-sch','m-fire','m-ver','m-keys','m-guide']){await pg.evaluate(id=>{const b=document.getElementById(id);if(b)b.click()},id);await pg.waitForTimeout(120);await pg.keyboard.press('Escape')}
  R.push(row('l-menus-'+label,`${label}: schedule, exits, version, keys, guide open`,m().length===0,m()));
  return R}
export async function run(b){
  const R=[];
  const d=await openApp(b);R.push(row('l-open-desktop','desktop: loads sample with no console errors',d.errs.length===0&&await d.evaluate(()=>window.__osp.S().objs.length>100),d.errs));
  R.push(...await sweep(d,'desktop'));await d.ctx.close();
  const p=await openApp(b,{phone:true});R.push(row('l-open-phone','phone: loads with the shell and no console errors',p.errs.length===0&&await p.evaluate(()=>getComputedStyle(document.querySelector('#mbar')).display!=='none'&&getComputedStyle(document.querySelector('.dock')).display==='none'),p.errs));
  R.push(...await sweep(p,'phone'));await p.ctx.close();
  return R}
