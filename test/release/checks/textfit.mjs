/* Text fits its box: on phones, iPads and desktops, on the main screens, menus, dialogs, bars and messages, no words spill out of the
   button, chip, message or box they belong to, and none are cut off without an ellipsis (found on an iPhone, 27 Nov 2026: the SketchUp
   welcome card's buttons, a toast and the 3D bar's Walls menu). A line of text that ends in "…" on purpose is fine. */
import {devFile,row,ENGINE} from '../lib.mjs';
export const name='textfit';
const DEV=[
  ['iPhone SE',{viewport:{width:375,height:667},deviceScaleFactor:2,isMobile:true,hasTouch:true}],
  ['iPhone 13',{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}],
  ['iPhone 13 landscape',{viewport:{width:844,height:390},deviceScaleFactor:3,isMobile:true,hasTouch:true}],
  ['iPad portrait',{viewport:{width:834,height:1194},deviceScaleFactor:2,isMobile:true,hasTouch:true}],
  ['iPad landscape',{viewport:{width:1194,height:834},deviceScaleFactor:2,isMobile:true,hasTouch:true}],
  ['laptop',{viewport:{width:1280,height:800}}],
  ['desktop',{viewport:{width:1600,height:950}}]];
/* runs in the page: every piece of visible text, measured against the box it sits in */
function scan(){
  const out=[];const vis=e=>{const r=e.getBoundingClientRect();if(r.width<1||r.height<1)return false;const cs=getComputedStyle(e);return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0.05};
  const skip=e=>e.closest('#plan,#v3c,svg,canvas,script,style,#cctv-pov,[aria-hidden=true],.sr-only,#drop');
  const scroller=e=>{for(let a=e;a&&a!==document.body;a=a.parentElement){const cs=getComputedStyle(a);if(/(auto|scroll)/.test(cs.overflowX)&&a.scrollWidth>a.clientWidth+1)return a}return null};
  const boxOf=e=>{for(let a=e;a&&a!==document.body;a=a.parentElement){const cs=getComputedStyle(a);if(/(auto|scroll)/.test(cs.overflowX)||/(auto|scroll)/.test(cs.overflowY))return null;
      const bg=cs.backgroundColor,bw=parseFloat(cs.borderTopWidth)+parseFloat(cs.borderLeftWidth);if((bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')||bw>0||a.matches('button,.btn,.chip,[role=button],[role=tab],.toast,.pop,.keys-card'))return a}return null};
  const label=e=>(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'')+' "'+(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,28)+'"';
  const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;const seen=new Set();
  while((n=tw.nextNode())){const t=n.nodeValue.trim();if(!t||t.length<2)continue;const e=n.parentElement;if(!e||skip(e)||!vis(e))continue;
    const rg=document.createRange();rg.selectNodeContents(n);const rs=[...rg.getClientRects()].filter(r=>r.width>0&&r.height>0);if(!rs.length)continue;
    const box=boxOf(e);if(!box||seen.has(box))continue;const b=box.getBoundingClientRect();if(b.bottom<0||b.top>innerHeight||b.right<0||b.left>innerWidth)continue;
    /* a clipping element between the text and its box: deliberate "…" there is fine; clipping without it is measured against that element */
    let clipEl=null;for(let a=e;a&&a!==box;a=a.parentElement){const c=getComputedStyle(a);if(c.overflow!=='visible'||c.overflowX!=='visible'){clipEl=a;break}}
    if(clipEl){const c=getComputedStyle(clipEl);if(c.textOverflow==='ellipsis'||c.webkitLineClamp!=='none')continue;if(clipEl.scrollWidth>clipEl.clientWidth+2&&!/(auto|scroll)/.test(c.overflowX)){out.push('cut off in '+label(clipEl));seen.add(box);continue}continue}
    const sc=scroller(e);const scr=sc&&sc.getBoundingClientRect();
    for(const r of rs){if(scr&&(r.right<scr.left||r.left>scr.right))continue;/* scrolled out of view inside a sideways scroller */
      const cs=getComputedStyle(box);const clips=cs.overflow!=='visible'||cs.overflowX!=='visible';
      if(!clips&&(r.right>b.right+2||r.left<b.left-2||r.bottom>b.bottom+2||r.top<b.top-2)){out.push('spills out of '+label(box));seen.add(box);break}
      if(clips&&(r.right>b.right+2||r.bottom>b.bottom+3)){const ell=getComputedStyle(e).textOverflow==='ellipsis'||cs.textOverflow==='ellipsis'||getComputedStyle(e).webkitLineClamp!=='none';if(!ell){out.push('cut off in '+label(box));seen.add(box);break}}}}
  /* a menu (select) shows its chosen option: it must be as wide as it would be with nothing squeezing it */
  document.querySelectorAll('select').forEach(s=>{if(!vis(s)||skip(s))return;const r=s.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)return;const o=s.options[s.selectedIndex];if(!o)return;
    const keep=[...s.options].map(x=>x.hidden);const st=s.getAttribute('style');[...s.options].forEach((x,k)=>{if(k!==s.selectedIndex)x.hidden=true});s.style.setProperty('width','auto','important');s.style.setProperty('max-width','none','important');s.style.setProperty('min-width','0','important');s.style.setProperty('flex','none','important');
    const nat=s.getBoundingClientRect().width;if(st==null)s.removeAttribute('style');else s.setAttribute('style',st);[...s.options].forEach((x,k)=>x.hidden=keep[k]);
    if(nat>r.width+2)out.push('cut off in select '+(s.id?'#'+s.id:'')+' "'+o.text.slice(0,28)+'" ('+Math.round(nat)+' px wide, shown '+Math.round(r.width)+' px)')});
  return out}
const SCREENS=[
  ['main',async pg=>{}],
  ['settings',async pg=>{await pg.evaluate(()=>document.querySelector('#b-set').click());await pg.waitForTimeout(250)}],
  ['more menu',async pg=>{await pg.evaluate(()=>document.querySelector('#b-more').click());await pg.waitForTimeout(250)}],
  ['SketchUp welcome card',async pg=>{await pg.evaluate(()=>window.__osp.suSheet(true));await pg.waitForTimeout(250)}],
  ['a long message',async pg=>{await pg.evaluate(()=>window.__osp.toast('Axis locked · lift the second finger to free. Sample office floor opened in a new tab'));await pg.waitForTimeout(150)}],
  ['search',async pg=>{await pg.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true})));await pg.waitForTimeout(250);await pg.keyboard.type('door')}],
  ['library',async pg=>{await pg.evaluate(()=>{const o=window.__osp;if(!o.P().lib)document.querySelector('#t-lib')?.click();document.querySelector('[data-m=lib],#mb-lib')?.click()});await pg.waitForTimeout(300)}],
  ['details of a desk',async pg=>{await pg.evaluate(()=>{const o=window.__osp;const x=o.S().objs.find(q=>q.t==='item'&&q.cat==='Workstation');o.setSel([x.id]);if(o.P().insp===false)document.querySelector('#t-insp')?.click();document.querySelector('#tab-sel')?.click();document.querySelector('[data-m=insp],#mb-insp')?.click()});await pg.waitForTimeout(300)}],
  ['details of a room',async pg=>{await pg.evaluate(()=>{const o=window.__osp;const x=o.S().objs.find(q=>q.t==='room');o.setSel([x.id]);document.querySelector('#tab-sel')?.click()});await pg.waitForTimeout(300)}],
  ['checks tab',async pg=>{await pg.evaluate(()=>{window.__osp.setSel([]);document.querySelector('#tab-fire')?.click()});await pg.waitForTimeout(300)}],
  ['3D',async pg=>{await pg.evaluate(()=>document.querySelector('#v3d').click());await pg.waitForFunction(()=>window.__osp.T3()&&window.__osp.T3().renderer,{timeout:30000});await pg.waitForTimeout(600)}],
  ['tutorial card',async pg=>{await pg.evaluate(()=>window.__osp.tutStart(0));await pg.waitForTimeout(500)}]];
export async function run(b){const R=[];
  for(const [dn,opt] of DEV){if(ENGINE!=='chromium'&&opt.isMobile)opt.isMobile=false;const ctx=await b.newContext(opt);
    try{for(const [sn,go] of SCREENS){const pg=await ctx.newPage();pg.on('dialog',d=>d.dismiss().catch(()=>{}));let issues=[];
        try{await pg.goto(devFile(),{waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,{timeout:20000});
          await pg.evaluate(()=>{document.querySelector('#m-sample')?.click()});await pg.waitForTimeout(400);
          await pg.evaluate(()=>{const m=document.querySelector('#su-modal');if(m)m.hidden=true;const c=document.querySelector('#tut-cta');if(c)c.hidden=true;document.querySelectorAll('.toast').forEach(t=>t.hidden=true)});
          await go(pg);await pg.waitForTimeout(150);issues=await pg.evaluate(scan)}catch(e){issues=['check could not run: '+String(e.message||e).slice(0,160)]}
        R.push(row('tf-'+dn.replace(/\W+/g,'-').toLowerCase()+'-'+sn.replace(/\W+/g,'-').toLowerCase(),`${dn}, ${sn}: all text fits its box (nothing spills out or is cut off without "…")`,!issues.length,[...new Set(issues)].slice(0,6).join(' · ')));
        await pg.close()}}finally{await ctx.close()}}
  return R}
