/* layer: rules. Invariants applied to every action in one list, so a new feature is covered by adding one line to ACTIONS
   (and a new dialog is covered with no change at all). Added 15 Nov 2026 after bugs reached the user that per-feature checks had missed:
   a check only tests what its author thought of; a rule tests every action the same way.
     A  undo-redo   every action is exactly one Undo step; Undo returns the identical plan, Redo returns the identical result
     B  reload      saving the plan and opening it again gives the identical plan
     C  copy        a pasted copy is independent: changing or deleting the copy leaves the original identical, and the reverse
     D  dialogs     every dialog has a name, closes on Esc, and lets no key reach the plan behind it
     E  walk        a seeded random run of actions undoes all the way back to the start and redoes to the same end */
import fs from 'fs';import {openApp,row} from '../lib.mjs';
const FORM=fs.readFileSync(new URL('../fixtures/requirements-form.xlsx',import.meta.url)).toString('base64');
/* a point on the visible plan, clear of the side panels, as screen pixels */
const scr=async(pg,i,j)=>{const r=await pg.evaluate(()=>{const e=document.querySelector('#plan').getBoundingClientRect();return[e.left,e.top,e.width,e.height]});return[r[0]+r[2]*(0.36+0.045*i),r[1]+r[3]*(0.30+0.07*j)]};
export const name='rules';
const canon=pg=>pg.evaluate(()=>{const p=JSON.parse(window.__osp.planJSON());delete p.saved;delete p.appVersion;delete p.app;/* empty defaults that a blank plan leaves out and a restored one writes: the same plan either way */if(p.notes==='')delete p.notes;if(Array.isArray(p.pins)&&!p.pins.length)delete p.pins;['style','section','fire','cost','brief','prog','site','underlay'].forEach(k=>{if(p[k]==null)delete p[k]});/* the file lists a floor's shell (rooms, doors, windows) before its fit-out, so list order is not compared */const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;if(Array.isArray(p.objs))p.objs.sort(byId);/* the order of the plan's own keys is not part of the plan (a key removed by Undo and put back by Redo lands at the end) */const q={};Object.keys(p).sort().forEach(k=>{q[k]=p[k]});return JSON.stringify(q)});
const ids=pg=>pg.evaluate(()=>window.__osp.S().objs.map(o=>o.id));
const wait=(pg,ms=180)=>pg.waitForTimeout(ms);
const press=async(pg,k)=>{await pg.evaluate(()=>{if(document.activeElement&&document.activeElement!==document.body)document.activeElement.blur()});await pg.keyboard.press(k);await wait(pg,120)};
const selNew=async(pg,before)=>{const now=await ids(pg),nw=now.filter(i=>!before.includes(i));await pg.evaluate(n=>window.__osp.setSel(n),nw);return nw};
let seq=0;const spot=()=>{seq++;return[seq%6,Math.floor(seq/6)%6]};
/* each action is what a user does in one go. `makes` marks actions that add objects (rule C copies them); `walk` marks actions safe to chain at random on one floor */
const ACTIONS=[
  {id:'place-item',nm:'place a library item',makes:true,walk:true,run:async pg=>{const [x,y]=spot();await pg.evaluate(()=>{const q=s=>document.querySelector(s);if(q('#d-lib').hidden)q('#t-lib').click();window.__osp.libOpenAll&&window.__osp.libOpenAll()});await wait(pg);
      await pg.evaluate(()=>{const r=[...document.querySelectorAll('#lib-list .lib-row')].find(e=>/^Task chair/.test(e.textContent.trim()));r.scrollIntoView({block:'center'});r.click()});await wait(pg);const p=await scr(pg,x,y);await pg.mouse.click(p[0],p[1]);await wait(pg);await pg.evaluate(()=>document.querySelector('.dock [data-tool=select]').click())}},
  {id:'draw-room',nm:'draw a room',makes:true,walk:true,run:async pg=>{const [x,y]=spot();await pg.evaluate(()=>document.querySelector('.dock [data-tool=room]').click());const a=await scr(pg,x,y),b=[a[0]+46,a[1]+38];await pg.mouse.move(a[0],a[1]);await pg.mouse.down();await pg.mouse.move((a[0]+b[0])/2,(a[1]+b[1])/2,{steps:4});await pg.mouse.move(b[0],b[1],{steps:4});await pg.mouse.up();await wait(pg);await pg.evaluate(()=>document.querySelector('.dock [data-tool=select]').click())}},
  {id:'template',nm:'place a data hall template',makes:true,walk:true,run:async pg=>{await pg.evaluate(()=>{window.__osp.tplPlace('DH',{n:6})});await wait(pg,300)}},
  {id:'template-resize',nm:'change a data hall\'s inputs',needs:'template',walk:true,run:async pg=>{await pg.evaluate(()=>{const o=window.__osp,r=o.S().objs.filter(x=>x.t==='room'&&x.tpl&&x.tpl.p).pop();o.tplUpdate(r,{n:(r.tpl.p.n%9)+3})});await wait(pg,300)}},
  {id:'move',nm:'nudge the selection with an arrow key',needs:'sel',walk:true,run:async pg=>{await press(pg,'ArrowRight')}},
  {id:'move-room',nm:'nudge a room that has furniture in it',walk:true,run:async pg=>{await pg.evaluate(()=>{const o=window.__osp,r=o.S().objs.find(x=>x.t==='room'&&x.tpl&&x.tpl.p)||o.S().objs.find(x=>x.t==='room');o.setSel([r.id])});await press(pg,'ArrowDown')}},
  {id:'paste',nm:'copy and paste the selection',needs:'sel',walk:true,run:async pg=>{await press(pg,'Control+c');await press(pg,'Control+v')}},
  {id:'delete',nm:'delete the selection',needs:'sel',walk:true,run:async pg=>{await press(pg,'Delete')}},
  {id:'rename',nm:'rename the plan',walk:true,run:async pg=>{await pg.evaluate(()=>{const e=document.querySelector('#pname');e.value='Plan '+Math.random().toString(36).slice(2,7);e.dispatchEvent(new Event('change',{bubbles:true}))});await wait(pg)}},
  /* 5.0.0 test 30: turning one thing by any angle, and turning the whole plan (design axes) */
  {id:'turn-any',nm:'turn the selection by 23.5 degrees',walk:true,run:async pg=>{await pg.evaluate(()=>{const o=window.__osp;const it=o.S().objs.find(x=>x.t==='room')||o.S().objs.find(x=>x.t==='item');if(it){o.setSel([it.id]);o.rotateSel(23.5)}});await wait(pg)}},
  {id:'design-axes',nm:'turn the whole plan with Design axes',walk:true,run:async pg=>{await pg.evaluate(()=>{window.__osp.turnPlan(17,true)});await wait(pg)}},
  {id:'campus-move',nm:'move this building on the campus site',walk:true,run:async pg=>{await pg.evaluate(()=>{const o=window.__osp;o.campusSet(o.curTab(),s=>{s.x+=7000;s.y-=3000})});await wait(pg)}},
  {id:'add-floor',nm:'add a floor on top',walk:true,run:async pg=>{await pg.evaluate(()=>{document.querySelector('#tab-bld').click()});await wait(pg);await pg.evaluate(()=>{document.querySelector('#p-bld [data-bb=addL],#p-bld #addL,#addL').click()});await wait(pg,300)}},
  {id:'roof-item',nm:'place a PV module on the roof and come back down',run:async pg=>{await pg.evaluate(()=>{const o=window.__osp;o.enterRoof()});await wait(pg,250);await pg.evaluate(()=>{const o=window.__osp;window.__osp.libOpenAll();const q=s=>document.querySelector(s);if(q('#d-lib').hidden)q('#t-lib').click()});await wait(pg);
      await pg.evaluate(()=>{const r=[...document.querySelectorAll('#lib-list .lib-row')].find(e=>/^PV module/.test(e.textContent.trim()));r.scrollIntoView({block:'center'});r.click()});await wait(pg);const p=await scr(pg,2,2);await pg.mouse.click(p[0],p[1]);await wait(pg);await pg.evaluate(()=>{document.querySelector('.dock [data-tool=select]').click();window.__osp.exitRoof();window.__osp.switchFloor&&0});await pg.evaluate(()=>{const o=window.__osp;o.rerender?o.rerender():0});await wait(pg,250)}},
  {id:'switch-floor',nm:'go to another floor',walkOnly:true,walk:true,run:async pg=>{await pg.evaluate(()=>{const o=window.__osp,b=o.S().bld,L=b.levels;if(L.length<2)return;const i=L.findIndex(l=>l.id===b.active);o.switchFloor(L[(i+1)%L.length].id)});await wait(pg,250)}},
  {id:'programme-build',nm:'build from the Programme and accept',fresh:true,run:async pg=>{await pg.evaluate(()=>{const o=window.__osp;o.progBuild()});await wait(pg,600);await pg.evaluate(()=>window.__osp.aiAccept());await wait(pg,300)}},
  {id:'ai-preview-undone',nm:'build from the Programme, then Undo the preview',fresh:true,special:'preview',run:async pg=>{await pg.evaluate(()=>{window.__osp.progBuild()});await wait(pg,600)}},
];
const undo=pg=>pg.evaluate(()=>document.querySelector('#b-undo').click()).then(()=>wait(pg,220));
const redo=pg=>pg.evaluate(()=>document.querySelector('#b-redo').click()).then(()=>wait(pg,220));
const fresh=async pg=>{await pg.evaluate(()=>{const o=window.__osp;o.newTab(o.blankPlan());o.aiRun([{do:'room',name:'Base',x:0,y:0,w:12000,h:8000}])});await wait(pg,250);seq=0};
const closeTab=async pg=>{await pg.evaluate(()=>{const x=document.querySelector('#ptabs .ptab.on .x');x&&x.click()});await wait(pg,300)};
export async function run(b){
  const R=[];const pg=await openApp(b,{sample:false});pg.on('dialog',d=>d.accept());const tabs0=await pg.evaluate(()=>window.__osp.tabsRaw().length);
  const prep=async A=>{if(A.fresh){await pg.evaluate(async f=>{const o=window.__osp;o.newTab(o.blankPlan());await o.progImportBuf(Uint8Array.from(atob(f),c=>c.charCodeAt(0)).buffer,'f.xlsx')},FORM);await wait(pg,300);return}await fresh(pg);if(A.needs==='template'){await ACTIONS.find(x=>x.id==='template').run(pg)}
    if(A.needs==='sel'){const before=await ids(pg);await ACTIONS.find(x=>x.id==='place-item').run(pg);await selNew(pg,before)}};
  /* A and B, per action */
  for(const A of ACTIONS.filter(a=>!a.walkOnly)){const e0=pg.errs.length;let d={};try{await prep(A);const c0=await canon(pg),p0=await pg.evaluate(()=>window.__osp.past());await A.run(pg);
      if(A.special==='preview'){/* Undo on a preview discards it, Redo brings the result back, Undo and Redo again are exact */
        const c1=await canon(pg);await undo(pg);const u=await canon(pg);await redo(pg);const r=await canon(pg);await undo(pg);const u2=await canon(pg);await redo(pg);const r2=await canon(pg);
        d={changed:c1!==c0,undo:u===c0,redo:r===c1,undo2:u2===c0,redo2:r2===c1};R.push(row('rule-undo-'+A.id,`Rule A (undo and redo) · ${A.nm}: Undo returns the plan as it was, Redo returns the AI's result, twice over`,d.changed&&d.undo&&d.redo&&d.undo2&&d.redo2&&pg.errs.length===e0,d));await closeTab(pg);continue}
      const c1=await canon(pg),p1=await pg.evaluate(()=>window.__osp.past()),j=await pg.evaluate(()=>window.__osp.planJSON());let steps=0,back=false;for(;steps<6&&!back;){await undo(pg);steps++;back=(await canon(pg))===c0}
      let fwd=false;if(back){for(let i=0;i<steps;i++)await redo(pg);fwd=(await canon(pg))===c1}
      d={changed:c1!==c0,pastSteps:p1-p0,undoSteps:back?steps:'never',redo:fwd};
      R.push(row('rule-undo-'+A.id,`Rule A (undo and redo) · ${A.nm}: one Undo returns the identical plan, one Redo returns the identical result`,d.changed&&back&&steps===1&&fwd&&pg.errs.length===e0,d));
      /* B: reload */
      const n0=await pg.evaluate(()=>window.__osp.tabsRaw().length);await pg.evaluate(j=>window.__osp.openPlanText(j,null,'rule.json'),j);await wait(pg,350);const c2=await canon(pg),n1=await pg.evaluate(()=>window.__osp.tabsRaw().length);
      R.push(row('rule-reload-'+A.id,`Rule B (save and reload) · ${A.nm}: the saved file opens as the identical plan`,c2===c1&&pg.errs.length===e0,c2===c1?'':{lenSaved:c1.length,lenReloaded:c2.length,at:(()=>{let i=0;while(i<c1.length&&c1[i]===c2[i])i++;return c1.slice(Math.max(0,i-60),i+80)+'  ≠  '+c2.slice(Math.max(0,i-60),i+80)})()}));
      if(n1>n0)await closeTab(pg);
    }catch(e){R.push(row('rule-undo-'+A.id,`Rule A (undo and redo) · ${A.nm}`,false,'threw: '+String(e.message).slice(0,200)))}
    await closeTab(pg)}
  /* C: copies are independent */
  for(const A of ACTIONS.filter(a=>a.makes)){const e0=pg.errs.length;try{await fresh(pg);const before=await ids(pg);await A.run(pg);const orig=await selNew(pg,before);
      const snap=list=>pg.evaluate(l=>JSON.stringify(window.__osp.S().objs.filter(o=>l.includes(o.id))),list);const o0=await snap(orig);const b2=await ids(pg);await press(pg,'Control+c');await press(pg,'Control+v');const copy=(await ids(pg)).filter(i=>!b2.includes(i));const c0=await snap(copy);
      /* change the copy three ways, then the original, and compare the other side each time */
      await pg.evaluate(l=>window.__osp.setSel(l),copy);await press(pg,'ArrowDown');await press(pg,'ArrowDown');const afterMove=(await snap(orig))===o0;
      /* for a template room, "its contents" means what stands inside its outline, so leftovers and takeaways both show */
      const inside=l=>pg.evaluate(l=>{const o=window.__osp,S=o.S(),r=S.objs.find(x=>l.includes(x.id)&&x.t==='room');if(!r)return null;const xs=r.pts.map(p=>p[0]),ys=r.pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
        const c=S.objs.filter(x=>x.t==='item'&&x.x>x0&&x.x<x1&&x.y>y0&&x.y<y1);return{racks:c.filter(x=>x.shape==='rack').length,json:JSON.stringify([r].concat(c).map(x=>Object.assign({},x)).sort((a,b)=>a.id<b.id?-1:1))}},l);
      let afterTpl=true,tplBack=true,afterDelete;if(A.id==='template'){const oIn0=await inside(orig);
        await pg.evaluate(l=>{const o=window.__osp,r=o.S().objs.find(x=>l.includes(x.id)&&x.t==='room');o.tplUpdate(r,{n:3})},copy);await wait(pg,300);const cIn1=await inside(copy),oIn1=await inside(orig);afterTpl=oIn1.json===oIn0.json&&cIn1.racks===3;
        await pg.evaluate(l=>{const o=window.__osp,r=o.S().objs.find(x=>l.includes(x.id)&&x.t==='room');o.tplUpdate(r,{n:5})},orig);await wait(pg,300);const cIn2=await inside(copy),oIn2=await inside(orig);tplBack=cIn2.json===cIn1.json&&oIn2.racks===5;
        const kill=await pg.evaluate(l=>{const o=window.__osp,S=o.S(),r=S.objs.find(x=>l.includes(x.id)&&x.t==='room'),xs=r.pts.map(p=>p[0]),ys=r.pts.map(p=>p[1]);return[r.id].concat(S.objs.filter(x=>x.t==='item'&&x.x>Math.min(...xs)&&x.x<Math.max(...xs)&&x.y>Math.min(...ys)&&x.y<Math.max(...ys)).map(x=>x.id))},copy);
        await pg.evaluate(l=>window.__osp.setSel(l),kill);await press(pg,'Delete');afterDelete=(await inside(orig)).json===oIn2.json}
      else{await pg.evaluate(l=>window.__osp.setSel(l),copy);await press(pg,'Delete');afterDelete=(await snap(orig))===o0}
      const d={copied:copy.length,orig:orig.length,afterMove,afterTpl,tplBack,afterDelete};
      R.push(row('rule-copy-'+A.id,`Rule C (copies are independent) · ${A.nm}: moving, changing and deleting a pasted copy leaves the original identical, and changing the original leaves the copy identical`,copy.length===orig.length&&orig.length>0&&afterMove&&afterTpl&&tplBack&&afterDelete&&pg.errs.length===e0,d));
    }catch(e){R.push(row('rule-copy-'+A.id,`Rule C (copies are independent) · ${A.nm}`,false,'threw: '+String(e.message).slice(0,200)))}
    await closeTab(pg)}
  /* D: every dialog in the page, found by role, not by a list */
  {await fresh(pg);const before=await ids(pg);await ACTIONS[0].run(pg);let item=await selNew(pg,before);
    const dl=await pg.evaluate(()=>[...document.querySelectorAll('[role=dialog]')].map(e=>({id:e.id,label:e.getAttribute('aria-label')||''})));
    /* panels that are meant to sit beside the plan while you work, and the search box, which has its own keys */
    const beside=['ai-panel','cmdk'];
    R.push(row('rule-dialog-found',`Rule D (dialogs): the page has dialogs to check, and each has an id`,dl.length>=6&&dl.every(d=>d.id),dl.map(d=>d.id).join(' ')));
    for(const D of dl.filter(d=>!beside.includes(d.id))){const e0=pg.errs.length;try{
        /* each dialog starts with something really selected, or a pass would mean nothing */
        if(!await pg.evaluate(sel=>sel.every(i=>window.__osp.S().objs.some(x=>x.id===i)),item)){const bf=await ids(pg);await ACTIONS[0].run(pg);item=await selNew(pg,bf)}
        await pg.evaluate(([id,sel])=>{const o=window.__osp;o.setSel(sel);document.getElementById(id).hidden=false;if(document.activeElement)document.activeElement.blur()},[D.id,item]);await wait(pg,120);const armed=await pg.evaluate(()=>window.__osp.sel().size||[...window.__osp.sel()].length);
        const c0=await canon(pg);for(const k of ['Delete','Backspace','ArrowRight','Control+a','Delete','Control+x','Control+d','r'])await pg.keyboard.press(k);await wait(pg,150);const same=(await canon(pg))===c0;
        /* a click outside closes a dialog that is only read, and never one with anything to fill in or tick */
        const busy=await pg.evaluate(id=>{const m=document.getElementById(id);return m.dataset.keep!=null||[...m.querySelectorAll('input:not([type=hidden]):not([type=file]),textarea,select,[contenteditable="true"]')].some(f=>!f.closest('[hidden]')&&f.getClientRects().length>0)},D.id);
        await pg.mouse.click(4,4);await wait(pg,150);const afterOut=await pg.evaluate(id=>document.getElementById(id).hidden,D.id);const outside=busy?!afterOut:afterOut;await pg.evaluate(id=>{document.getElementById(id).hidden=false},D.id);
        await pg.keyboard.press('Escape');await wait(pg,150);const closed=await pg.evaluate(id=>document.getElementById(id).hidden,D.id);await pg.evaluate(id=>{document.getElementById(id).hidden=true},D.id);
        R.push(row('rule-dialog-'+D.id,`Rule D (dialogs) · ${D.label||D.id}: it has a name, no key reaches the plan behind it (Delete, Backspace, arrows, Ctrl+A, Ctrl+X, Ctrl+D, R), a click outside closes it only if it is a read-only dialog, and Esc closes it`,!!D.label&&armed>0&&same&&outside&&closed&&pg.errs.length===e0,{label:D.label,selected:armed,planUntouched:same,hasFields:busy,clickOutside:afterOut?'closed':'stayed open',escCloses:closed}));
      }catch(e){R.push(row('rule-dialog-'+D.id,`Rule D (dialogs) · ${D.label||D.id}`,false,'threw: '+String(e.message).slice(0,200)))}}
    /* and with every dialog closed the same keys do reach the plan, so the rule is not passing by accident */
    if(!await pg.evaluate(sel=>sel.every(i=>window.__osp.S().objs.some(x=>x.id===i)),item)){const bf=await ids(pg);await ACTIONS[0].run(pg);item=await selNew(pg,bf)}
    await pg.evaluate(sel=>window.__osp.setSel(sel),item);const c0=await canon(pg);await press(pg,'Delete');R.push(row('rule-dialog-control','Rule D (dialogs) · control: with no dialog open, Delete does remove the selection',(await canon(pg))!==c0));
    await closeTab(pg)}
  /* E: seeded random walks over the actions that can chain */
  for(const seed of [11,29]){const e0=pg.errs.length;let s=seed;const rnd=()=>{s=(s*1103515245+12345)%2147483648;return s/2147483648};const log=[];try{
      await fresh(pg);const c0=await canon(pg),p0=await pg.evaluate(()=>window.__osp.past());const W=ACTIONS.filter(a=>a.walk);let last=[];
      for(let i=0;i<24;i++){const A=W[Math.floor(rnd()*W.length)];const has=await pg.evaluate(l=>{const o=window.__osp,S=o.S();return{sel:l.filter(i=>S.objs.some(x=>x.id===i)),tpl:S.objs.some(x=>x.t==='room'&&x.tpl&&x.tpl.p)}},last);
        if(A.needs==='sel'){if(!has.sel.length)continue;await pg.evaluate(l=>window.__osp.setSel(l),has.sel)}if(A.needs==='template'&&!has.tpl)continue;
        const before=await ids(pg);await A.run(pg);log.push(A.id);const nw=(await ids(pg)).filter(x=>!before.includes(x));if(nw.length)last=nw}
      const cEnd=await canon(pg),p1=await pg.evaluate(()=>window.__osp.past());let n=0;while(n<200&&await pg.evaluate(p=>window.__osp.past()>p,p0)){await undo(pg);n++}const back=(await canon(pg))===c0;for(let i=0;i<n;i++)await redo(pg);const cF=await canon(pg),fwd=cF===cEnd;/* say what differs, so a failure can be read without a rerun */let why='';if(!fwd){try{const A=JSON.parse(cEnd),B=JSON.parse(cF),d=[];Object.keys({...A,...B}).forEach(k=>{if(k==='objs'||JSON.stringify(A[k])===JSON.stringify(B[k]))return;d.push(k+': '+String(JSON.stringify(A[k])).slice(0,140)+' → '+String(JSON.stringify(B[k])).slice(0,140))});const mb=new Map((B.objs||[]).map(o=>[o.id,o]));(A.objs||[]).forEach(o=>{const q=mb.get(o.id);if(!q)d.push('missing '+o.t+' '+o.id);else if(JSON.stringify(o)!==JSON.stringify(q))d.push(o.t+' '+Object.keys({...o,...q}).filter(k=>JSON.stringify(o[k])!==JSON.stringify(q[k])).map(k=>k+' '+String(JSON.stringify(o[k])).slice(0,60)+' → '+String(JSON.stringify(q[k])).slice(0,60)).join(', '))});why=d.slice(0,5).join(' | ')}catch(e){why='undiffable'}}
      R.push(row('rule-walk-'+seed,`Rule E (random walk, seed ${seed}): ${log.length} actions in a row; Undo all returns the starting plan and Redo all returns the end plan`,log.length>=12&&p1-p0>=1&&p1-p0<=log.length&&back&&fwd&&pg.errs.length===e0,{actions:log.length,undoSteps:p1-p0,back,fwd,why,log:log.join(' ')}));
    }catch(e){R.push(row('rule-walk-'+seed,`Rule E (random walk, seed ${seed})`,false,'threw: '+String(e.message).slice(0,200)+' after '+log.join(' ')))}
    await closeTab(pg)}
  const tabs1=await pg.evaluate(()=>window.__osp.tabsRaw().length);R.push(row('rule-clean','Rules: the checks leave the app as they found it (no stray tabs, no errors)',tabs1===tabs0&&pg.errs.length===0,{tabs0,tabs1,errs:pg.errs.slice(0,3)}));
  await pg.ctx.close();return R}
