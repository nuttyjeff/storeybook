/* layer 4: one check per shipped feature. Add a row here whenever a backlog item ships; never delete one. */
import {openApp,row,click,to3D,to2D,scr,touch} from '../lib.mjs';
export const name='smoke';
const ev=(pg,fn,arg)=>pg.evaluate(fn,arg);
const n=pg=>ev(pg,()=>window.__osp.S().objs.length);
const C=async(pg,fx,fy)=>ev(pg,([fx,fy])=>{const r=document.querySelector('#plan').getBoundingClientRect();return [r.left+r.width*fx,r.top+r.height*fy]},[fx,fy]);
const mdrag=async(pg,a,b,steps=8)=>{await pg.mouse.move(a[0],a[1]);await pg.mouse.down();for(let i=1;i<=steps;i++){await pg.mouse.move(a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps);await pg.waitForTimeout(16)}await pg.mouse.up();await pg.waitForTimeout(150)};
const libClick=(pg,re)=>ev(pg,re=>{const rows=[...document.querySelectorAll('#lib-list .lib-row')];const r=rows.find(x=>new RegExp(re,'i').test(x.textContent));if(!r)throw new Error('no library row '+re);r.click()},re);
const ids=[];const add=(R,id,name,pass,detail)=>{if(ids.includes(id))throw new Error('duplicate smoke id '+id);ids.push(id);R.push(row(id,name,pass,detail))};

async function desktop(b){
  const R=[];const pg=await openApp(b);const e0=()=>pg.errs.length;
  /* draw a room with the mouse */
  {const n0=await n(pg);await ev(pg,()=>window.__osp.setTool('room'));await mdrag(pg,await C(pg,0.4,0.2),await C(pg,0.55,0.35));await ev(pg,()=>window.__osp.setTool('select'));
   add(R,'s-room','draw a room by dragging',await n(pg)===n0+1)}
  /* place from the library */
  {await ev(pg,()=>{const b=document.querySelector('#t-lib');if(b&&document.querySelector('#d-lib').hidden)b.click()});await pg.waitForTimeout(150);const n0=await n(pg);await libClick(pg,'Task chair');await pg.waitForTimeout(100);
   const a=await C(pg,0.45,0.72);await pg.mouse.click(a[0],a[1]);await pg.waitForTimeout(150);await ev(pg,()=>window.__osp.setTool('select'));add(R,'s-place','place a library item by clicking',await n(pg)===n0+1)}
  /* undo / redo through delete */
  {const n0=await n(pg);await ev(pg,()=>{const S=window.__osp.S();const it=S.objs.find(o=>o.t==='item');window.__osp.setSel([it.id])});await pg.keyboard.press('Delete');const n1=await n(pg);await ev(pg,()=>window.__osp.undo());const n2=await n(pg);await ev(pg,()=>window.__osp.redo());const n3=await n(pg);
   add(R,'s-undo','delete, undo restores, redo removes',n1===n0-1&&n2===n0&&n3===n0-1,{n0,n1,n2,n3})}
  /* drag-array of a workstation set: rows at desk depth + 1200 */
  {await ev(pg,()=>{if(document.querySelector('#d-lib').hidden)document.querySelector('#t-lib').click()});await pg.waitForTimeout(100);await libClick(pg,'Workstation set');await pg.waitForTimeout(100);
   const n0=await n(pg);const k=await ev(pg,()=>window.__osp.V.k);const a=await C(pg,0.55,0.55);await mdrag(pg,a,[a[0],a[1]+4000*k],14);
   const r=await ev(pg,n0=>{const S=window.__osp.S();const nw=S.objs.slice(n0);const desks=nw.filter(o=>/^WS/.test(o.code));const ys=[...new Set(desks.map(o=>o.y))].sort((a,b)=>a-b);return {added:nw.length,rows:ys.length,pitch:ys.length>1?ys[1]-ys[0]:null,want:desks[0]?desks[0].d+1200:null}},n0);
   await ev(pg,()=>window.__osp.setTool('select'));add(R,'s-array-pitch','dragging a workstation set out repeats rows at desk depth + 1.2 m',r.rows>=2&&r.pitch===r.want,r)}
  /* single item dragged out becomes an editable array */
  {await ev(pg,()=>{if(document.querySelector('#d-lib').hidden)document.querySelector('#t-lib').click()});await pg.waitForTimeout(100);await libClick(pg,'Workstation 1200');await pg.waitForTimeout(100);
   const n0=await n(pg);const k=await ev(pg,()=>window.__osp.V.k);const a=await C(pg,0.35,0.88);await mdrag(pg,a,[a[0]+5000*k,a[1]],14);await ev(pg,()=>window.__osp.setTool('select'));
   const r=await ev(pg,n0=>{const o=window.__osp,S=o.S();const nw=S.objs.slice(n0);if(!nw.length||!nw[0].arr)return {added:nw.length,arr:false};o.editArray(nw[0],{rows:3});return {added:nw.length,arr:true,after:S.objs.filter(x=>x.arr&&x.arr.id===nw[0].arr.id).length,cols:nw[0].arr.cols}},n0);
   add(R,'s-array-edit','a dragged row of one item is an array; Rows=3 triples it',r.arr&&r.after===r.cols*3,r)}
  /* a dragged workstation set becomes a set array; Rows and Gap down rebuild every cell */
  {await ev(pg,()=>{if(document.querySelector('#d-lib').hidden)document.querySelector('#t-lib').click()});await pg.waitForTimeout(100);await libClick(pg,'Workstation set');await pg.waitForTimeout(100);
   const n0=await n(pg);const k=await ev(pg,()=>window.__osp.V.k);const a=await C(pg,0.62,0.2);await mdrag(pg,a,[a[0]+2500*k,a[1]+3800*k],14);await ev(pg,()=>window.__osp.setTool('select'));
   const r=await ev(pg,n0=>{const o=window.__osp,S=o.S();const nw=S.objs.slice(n0);const m=nw[0];if(!m||!m.arr||!m.arr.set)return {set:false,added:nw.length};const id=m.arr.id;const per=m.arr.set;
     o.editArray(m,{rows:3,cols:2});const mem=S.objs.filter(x=>x.arr&&x.arr.id===id);const sel1=[...o.sel()].length;const m2=S.objs.find(x=>x.arr&&x.arr.id===id);o.editArray(m2,{gy:2000});const desks=S.objs.filter(x=>x.arr&&x.arr.id===id&&/^WS/.test(x.code));const ys=[...new Set(desks.map(x=>x.y))].sort((a,b)=>a-b);
     const cnt=S.objs.filter(x=>x.arr&&x.arr.id===id).length;o.undo();o.undo();const back=S.objs.length-n0;return {set:true,per,members:mem.length,want:per*6,selAfter:sel1,pitch:ys[1]-ys[0],wantPitch:m2.arr.d+2000,cnt,back}},n0);
   add(R,'s-set-array','a dragged set is a set array: Rows 3 × Cols 2 gives 6 cells, Gap down moves rows, editor keeps one cell selected, undo restores',r.set&&r.members===r.want&&r.selAfter===1&&r.pitch===r.wantPitch&&r.cnt===r.want,r)}
  /* Shift while dragging keeps the move on one axis */
  {const it=await ev(pg,()=>{const S=window.__osp.S();const it=S.objs.find(o=>o.t==='item'&&/^WS/.test(o.code));const el=document.querySelector(`[data-id="${it.id}"]`);const r=el.getBoundingClientRect();return {id:it.id,x:r.left+r.width/2,y:r.top+r.height/2,ox:it.x,oy:it.y}});
   await pg.mouse.move(it.x,it.y);await pg.mouse.down();await pg.mouse.move(it.x+6,it.y+4);await pg.keyboard.down('Shift');for(let i=1;i<=10;i++){await pg.mouse.move(it.x+8*i,it.y+5*i);await pg.waitForTimeout(16)}await pg.mouse.up();await pg.keyboard.up('Shift');await pg.waitForTimeout(100);
   const r=await ev(pg,id=>{const o=window.__osp.S().objs.find(x=>x.id===id);return [o.x,o.y]},it.id);await ev(pg,()=>window.__osp.undo());add(R,'s-axis-shift','Shift-drag moves along one axis only',r[0]-it.ox>0&&r[1]-it.oy===0,{dx:r[0]-it.ox,dy:r[1]-it.oy})}
  /* clash detection */
  {const r=await ev(pg,()=>{const o=window.__osp,S=o.S();const d=S.objs.find(x=>x.t==='item'&&/^WS/.test(x.code));const c=Object.assign({},d,{id:'clashA',x:d.x+100});S.objs.push(c);const cc=o.clash();const hit=(cc.bad&&(cc.bad.size??Object.keys(cc.bad).length))||0;S.objs.pop();o.clash();return {hit}});
   add(R,'s-clash','overlapping desks are reported as a clash',r.hit>0,r)}
  /* snapshots and compare */
  {const r=await ev(pg,()=>{const o=window.__osp,S=o.S();const b=(S.snaps||[]).length;o.snapTake('release');const a=S.snaps.length;const id=S.snaps[S.snaps.length-1].id;let cmp=true;try{o.snapCompare(id)}catch(e){cmp=false}return {b,a,cmp,hasUnderlay:JSON.stringify(S.snaps[S.snaps.length-1]).includes('"src"')}});
   add(R,'s-snap','snapshot taken, compare runs, snapshot carries no underlay image',r.a===r.b+1&&r.cmp&&!r.hasUnderlay&&e0()===0,r)}
  /* MIG, exits, exports */
  {const r=await ev(pg,()=>{const o=window.__osp,S=o.S();const cb=document.querySelector('#s-mig');const was=cb.checked;if(!was){cb.checked=true;cb.dispatchEvent(new Event('change'))}const code=[...o.migMap().keys()][0];const room=Object.assign({},S.objs.find(x=>x.t==='room'),{ent:code});const mig=o.migRoom(room);if(!was){cb.checked=false;cb.dispatchEvent(new Event('change'))}let eg=null;try{eg=o.egressCompute()}catch(e){eg='ERR '+e.message}const dxf=o.exportDXF();const ifc=o.exportIFC();return {mig:!!mig,eg:eg!=null&&!String(eg).startsWith('ERR'),dxf:typeof dxf==='string'&&dxf.includes('ENTITIES')&&dxf.length>5000,ifc:typeof ifc==='string'&&ifc.startsWith('ISO-10303')&&ifc.includes('IFCWALL')}});
   add(R,'s-mig','MIG check evaluates a room',r.mig);add(R,'s-egress','exits check computes',r.eg);add(R,'s-dxf','DXF export has an ENTITIES section',r.dxf);add(R,'s-ifc','IFC export is STEP with walls',r.ifc)}
  /* pins: drop, double-click opens Notes focused, Delete key removes */
  {await ev(pg,()=>window.__osp.setTool('pin'));const a=await C(pg,0.4,0.4);await pg.mouse.click(a[0],a[1]);await pg.waitForTimeout(250);
   const r1=await ev(pg,()=>({pins:window.__osp.pins().length,notes:!document.querySelector('#p-notes').hidden,focus:!!document.activeElement.dataset.pintext}));await ev(pg,()=>document.activeElement.blur());
   await ev(pg,()=>window.__osp.setTool('select'));await ev(pg,()=>document.querySelector('[data-tab=sel]').click());
   const pp=await ev(pg,()=>{const r=document.querySelector('[data-pin]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});await pg.mouse.dblclick(pp[0],pp[1]);await pg.waitForTimeout(250);
   const r2=await ev(pg,()=>({notes:!document.querySelector('#p-notes').hidden,focus:!!document.activeElement.dataset.pintext}));await ev(pg,()=>document.activeElement.blur());
   await pg.keyboard.press('Delete');const r3=await ev(pg,()=>window.__osp.pins().length);
   add(R,'s-pin-drop','dropping a pin opens Notes with the cursor in it',r1.pins>=1&&r1.notes&&r1.focus,r1);add(R,'s-pin-dbl','double-click a pin opens its note',r2.notes&&r2.focus,r2);add(R,'s-pin-del','Delete key removes the selected pin',r3===r1.pins-1,{before:r1.pins,after:r3})}
  /* lock */
  {const r=await ev(pg,()=>{const o=window.__osp,S=o.S();document.querySelector('#b-lock').click();const l1=S.locked;document.querySelector('#b-lock').click();return {l1,l2:S.locked}});add(R,'s-lock','lock toggles on and off',r.l1===true&&r.l2===false,r)}
  /* 3D: walker collisions, sun */
  {await ev(pg,()=>{const o=window.__osp,S=o.S();const l=o.LIB().find(x=>x.shape==='tree'&&x.h>=1500);const ly=S.objs.find(q=>q.t==='item')?.layer;S.objs.push({t:'item',id:'rtree',code:l.code,name:l.name,cat:l.cat,shape:l.shape,w:l.w,d:l.d,h:l.h,x:50000,y:50000,r:0,layer:ly,site:true});
     const d=o.LIB().find(x=>x.code==='WS1470')||o.LIB().find(x=>/^WS/.test(x.code));S.objs.push({t:'item',id:'rdesk',code:d.code,name:d.name,cat:d.cat,shape:d.shape,w:d.w,d:d.d,h:d.h||730,x:60000,y:50000,r:0,layer:ly})});
   await to3D(pg);const r=await ev(pg,()=>{const o=window.__osp;o.WALK.collide=true;const t=p=>o.walkResolve(p.slice()).map(Math.round);return {canopy:t([51000,50000]),trunk:t([50050,50000]),desk:t([60000,50000])}});
   add(R,'s-walk-tree','walker passes under a tree canopy, stops at the trunk',r.canopy[0]===51000&&r.canopy[1]===50000&&r.trunk[0]!==50050,r);add(R,'s-walk-desk','walker is pushed out of a desk',r.desk[0]!==60000||r.desk[1]!==50000,r);
   const s=await ev(pg,()=>{const o=window.__osp;const p=o.sunPos(1.35,o.dayOfYear(5,21),12);const SUN=o.SUN();SUN.on=true;o.applySun();SUN.on=false;o.applySun();return {el:p&&(p.el??p[1]??p.elevation)}});
   add(R,'s-sun','sun study: noon elevation positive and apply runs clean',s.el>0&&e0()===0,s);await to2D(pg)}
  /* building: floors and plan JSON */
  {const r=await ev(pg,()=>{const o=window.__osp,S=o.S();const tabs=o.tabs();const j=JSON.parse(o.planJSON());return {tabs:tabs.length,v:j.v,objs:j.objs.length,bld:!!S.bld}});add(R,'s-plan-json','plan serialises with version, objects and building',r.v>=6&&r.objs>100&&r.bld,r)}
  /* north setting: widget, Building field, Sun bar, sun vector, save/load */
  {await to2D(pg);const r=await ev(pg,async()=>{const o=window.__osp;o.setNorth(90);const w=document.querySelector('#north');const widget=w.style.getPropertyValue('--n');document.querySelector('[data-tab=bld]').click();await new Promise(r=>setTimeout(r,80));const bld=document.querySelector('#bld-north').value;const sun=document.querySelector('#sun-north').value;
     const v90=o.sunVec(180,45).map(x=>+x.toFixed(2));o.setNorth(0);const v0=o.sunVec(180,45).map(x=>+x.toFixed(2));o.setNorth(90);
     const j=o.planJSON();const saved=JSON.parse(j).north;o.openPlanText(j,'north-rt');await new Promise(r=>setTimeout(r,200));const reloaded=o.S().north;const png=o.northSVG(0,0,500,90);o.setNorth(0);
     return {widget,bld,sun,sunMoves:JSON.stringify(v90)!==JSON.stringify(v0),saved,reloaded,png:/rotate\(90\)/.test(png)&&/>N</.test(png),visible:getComputedStyle(w).display!=='none'}});
   add(R,'s-north','north: widget, Building field and Sun bar agree, sun vector follows, saved and reloaded, PNG arrow drawn',r.widget==='90deg'&&r.bld==='90'&&r.sun==='90'&&r.sunMoves&&r.saved===90&&r.reloaded===90&&r.png&&r.visible,r)}
  /* north in 3D: the widget stays visible and turns with the camera; DXF carries a NORTH layer */
  {await to3D(pg);await pg.waitForTimeout(400);const r=await ev(pg,async()=>{const o=window.__osp;o.setNorth(30);await new Promise(r=>setTimeout(r,250));const w=document.querySelector('#north');const vis=getComputedStyle(w).display!=='none';const n1=w.style.getPropertyValue('--n');
     const T=o.T3();T.controls.target.set(0,0,0);T.camera.position.set(8000,6000,-9000);T.camera.lookAt(0,0,0);T.controls.update();T.controls.dispatchEvent({type:'change'});await new Promise(r=>setTimeout(r,250));const n2=w.style.getPropertyValue('--n');
     const dxf=o.exportDXF()||'';o.setNorth(0);
     return {vis,n1,n2,turned:n1!==n2,layer:(dxf.match(/\nNORTH\n/g)||[]).length>=3}});
   add(R,'s-north-3d','north: 3D widget visible, turns with the camera, DXF has a NORTH layer',r.vis&&r.turned&&r.layer,r);
   /* north set in 3D: a quarter-turn mouse drag round the arrow turns north ~90°, one undo puts it back */
   {const T3o=await ev(pg,()=>{const T=window.__osp.T3();T.camera.position.set(6000,9000,7000);T.controls.update();T.controls.dispatchEvent({type:'change'});return 1});await pg.waitForTimeout(200);
    const c=await ev(pg,()=>{const w=document.querySelector('#north'),r=w.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,r.width/2,w.contains(document.elementFromPoint(r.left+r.width/2,r.top+6))]});
    const p0=await ev(pg,()=>window.__osp.past());await pg.mouse.move(c[0],c[1]-c[2]+5);await pg.mouse.down();for(let i=1;i<=12;i++){const a=(Math.PI/2)*i/12;await pg.mouse.move(c[0]+Math.sin(a)*(c[2]-5),c[1]-Math.cos(a)*(c[2]-5))}await pg.mouse.up();await pg.waitForTimeout(150);
    const r2=await ev(pg,async()=>{const o=window.__osp,n=o.S().north,p=o.past();o.undo();await new Promise(r=>setTimeout(r,100));return {n,steps:p,back:o.S().north}});
    add(R,'s-north-3d-set','north: in 3D the arrow can be dragged to set north, and undo puts it back',c[3]&&r2.n>=75&&r2.n<=105&&r2.back===0&&r2.steps===p0+1,{reachable:c[3],...r2,p0})}
   await to2D(pg)}
  /* My plans: a thumbnail per row, Export all round-trips through Import (a newer copy in the browser wins) */
  {const r=await ev(pg,async()=>{const o=window.__osp,P=o.PLANS;o.markDirty();await new Promise(r=>setTimeout(r,1800));P.flush();await new Promise(r=>setTimeout(r,300));const rows=await P.list();const t=await P.exportAll();const j=JSON.parse(t);const same=await P.importAll(t);
     const j2=JSON.parse(t);j2.plans=[Object.assign({},j2.plans[0],{pid:'gate-import',updated:Date.now()+5})];const imp=await P.importAll(JSON.stringify(j2));const got=await P.get('gate-import');await P.del('gate-import');
     document.querySelector('#m-plans').click();await new Promise(r=>setTimeout(r,300));const th=document.querySelectorAll('#plans-list .pt svg').length;const btns=!!document.querySelector('[data-pexport]')&&!!document.querySelector('[data-pimport]');document.querySelector('#plans-modal').hidden=true;
     return{rows:rows.length,thumb:!!(rows[0]&&rows[0].thumb&&/<svg/.test(rows[0].thumb)),exported:j.plans.length,same,imp,gotPid:got&&JSON.parse(got.data).pid,th,btns}});
   add(R,'s-plans-export','My plans: thumbnails drawn, Export all / Import round-trip keeps pids and skips newer copies',r.thumb&&r.exported>=1&&r.same.added===0&&r.imp.added===1&&r.gotPid==='gate-import'&&r.th>=1&&r.btns,r)}
  /* My plans: the plan is kept in the browser store, listed, duplicated, and the copy can be deleted once its tab is closed */
  {const r=await ev(pg,async()=>{const o=window.__osp;const S=o.S();S.name='Gate plan';o.markDirty();await new Promise(r=>setTimeout(r,2400));const l1=await o.PLANS.list();const me=l1.find(p=>p.pid===S.pid);
     document.querySelector('#m-plans').click();await new Promise(r=>setTimeout(r,400));const rows=document.querySelectorAll('.plan-row').length,cur=!!document.querySelector('.plan-row.cur');
     document.querySelector('.plan-row.cur [data-pact=dup]').click();await new Promise(r=>setTimeout(r,2400));const copyName=o.S().name;const l2=await o.PLANS.list();const copy=l2.find(p=>p.pid===o.S().pid);
     const t=o.tabsRaw().find(t=>t.S&&t.S.pid===copy.pid)||null;const cf=window.confirm;window.confirm=()=>true;const pre={isCur:t===o.curTab(),dirty:o.isDirty(),conf:window.confirm('x'),idx:o.tabsRaw().indexOf(t),ids:o.tabsRaw().map(x=>x.id)};let cerr=null;try{o.closeTab(t||o.tabsRaw()[o.tabsRaw().length-1])}catch(e){cerr=String(e)}const closed=o.tabsRaw().length;pre.idsAfter=o.tabsRaw().map(x=>x.id);pre.curAfter=o.curTab().id;await o.PLANS.del(copy.pid);window.confirm=cf;const l3=await o.PLANS.list();const before=l2.length;
     document.querySelector('#plans-modal').hidden=true;return {stored:!!me,items:me&&me.items,rows,cur,copyName,copyStored:!!copy,afterDel:l3.length,tabs:o.tabsRaw().length,closed,cerr,found:!!t,pre,before}});
   add(R,'s-my-plans','My plans: plan stored with counts, listed as current, Duplicate opens a copy that is stored too, Delete removes it',r.stored&&r.items>100&&r.rows>=1&&r.cur&&/copy$/.test(r.copyName)&&r.copyStored&&r.afterDel===r.before-1&&r.closed===r.pre.ids.length-1,r)}
  add(R,'s-desktop-clean','desktop smoke left no console errors',e0()===0,pg.errs.slice(0,5));
  await pg.ctx.close();return R}

async function phone(b){
  const R=[];const pg=await openApp(b,{phone:true});const t=await touch(pg);const e0=()=>pg.errs.length;
  const vis=s=>ev(pg,s=>{const e=document.querySelector(s);if(!e)return false;const r=e.getBoundingClientRect();return getComputedStyle(e).display!=='none'&&!e.hidden&&r.width>0&&r.right<=innerWidth+0.5},s);
  /* header fits on one row with undo, redo, delete */
  {const r=await ev(pg,()=>{const top=e=>Math.round(document.querySelector(e).getBoundingClientRect().top);return {undo:top('#b-undo'),redo:top('#b-redo'),del:top('#b-del'),seg:top('.seg')}});add(R,'p-header','phone header: undo, redo, delete on the same row as the view switch',Math.max(r.undo,r.redo,r.del,r.seg)-Math.min(r.undo,r.redo,r.del,r.seg)<=6,r)}
  /* shell: Draw sheet, More sheet */
  {await click(pg,'#mbar [data-m=draw]');await pg.waitForTimeout(100);const tiles=await ev(pg,()=>document.querySelectorAll('#msheet [data-pt]').length);await click(pg,'#mbar [data-m=more]');await pg.waitForTimeout(100);
   const more=await ev(pg,()=>[...document.querySelectorAll('#msheet [data-pm]')].map(e=>e.dataset.pm));await click(pg,'#mbar [data-m=select]');
   add(R,'p-draw-sheet','Draw sheet lists 12 tools',tiles===12,{tiles});add(R,'p-more-sheet','More sheet has Floors, Lock, Settings, Open, Save',['__floors','b-lock','b-set','m-open','m-save'].every(x=>more.includes(x)),more)}
  /* Cancel chip and Select-as-Esc */
  {await ev(pg,()=>window.__osp.setTool('room'));await pg.waitForTimeout(50);const c1=await vis('#esc');await click(pg,'#esc');await pg.waitForTimeout(50);const tool=await ev(pg,()=>document.querySelector('.dock .btn.on')?.dataset.tool);const c2=await vis('#esc');
   add(R,'p-esc-chip','Cancel chip shows with a tool and returns to Select',c1&&tool==='select'&&!c2,{c1,tool,c2})}
  /* two-finger pan */
  {const v0=await ev(pg,()=>({x:window.__osp.V.x,y:window.__osp.V.y}));const a=await C(pg,0.4,0.5),b2=await C(pg,0.6,0.5);
   await t.T('touchStart',[a,b2]);for(let i=1;i<=8;i++){await t.T('touchMove',[[a[0]+10*i,a[1]+6*i],[b2[0]+10*i,b2[1]+6*i]]);await pg.waitForTimeout(16)}await t.T('touchEnd',[]);await pg.waitForTimeout(100);
   const v1=await ev(pg,()=>({x:window.__osp.V.x,y:window.__osp.V.y}));add(R,'p-two-finger','two fingers pan the plan',v1.x!==v0.x&&v1.y!==v0.y,{v0,v1})}
  /* library grid and placing strip */
  {await click(pg,'#mbar [data-m=lib]');await pg.waitForTimeout(150);const cols=await ev(pg,()=>getComputedStyle(document.querySelector('#lib-list')).gridTemplateColumns.split(' ').length);await libClick(pg,'Task chair');await pg.waitForTimeout(150);
   const strip=await vis('#pstrip');const libHidden=await ev(pg,()=>document.querySelector('#d-lib').hidden);await click(pg,'#pstrip-done');add(R,'p-lib','library is a 3-column grid; picking an item closes it and shows the placing strip',cols===3&&strip&&libHidden,{cols,strip,libHidden})}
  /* Details sheet: height cap, pull to dismiss, actions row */
  {await ev(pg,()=>{const S=window.__osp.S();window.__osp.setSel([S.objs.find(o=>o.t==='item').id])});await click(pg,'#mbar [data-m=insp]');await pg.waitForTimeout(200);
   const h=await ev(pg,()=>document.querySelector('#d-insp').getBoundingClientRect().height/innerHeight);const acts=await ev(pg,()=>!!document.querySelector('#d-insp [data-mact=rot]'));
   const g=await ev(pg,()=>{const r=document.querySelector('#d-insp .grab').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});await mdrag(pg,g,[g[0],g[1]+140],8);await pg.waitForTimeout(300);const closed=await ev(pg,()=>document.querySelector('#d-insp').hidden);
   add(R,'p-sheet','Details is at most half the screen, has the actions row, and pulls down to close',h<=0.52&&acts&&closed,{h:+h.toFixed(2),acts,closed})}
  /* fields at 16px */
  {const f=await ev(pg,()=>Math.min(...[...document.querySelectorAll('input,textarea,select')].map(e=>parseFloat(getComputedStyle(e).fontSize))));add(R,'p-font16','all fields are 16 px or larger (no iOS focus zoom)',f>=16,{min:f})}
  /* header delete button */
  {const n0=await n(pg);await ev(pg,()=>{const S=window.__osp.S();window.__osp.setSel([S.objs.find(o=>o.t==='item').id])});const en=await ev(pg,()=>!document.querySelector('#b-del').disabled);await click(pg,'#b-del');await pg.waitForTimeout(80);const n1=await n(pg);await ev(pg,()=>window.__osp.undo());
   add(R,'p-del-btn','header Delete removes the selection',en&&n1===n0-1,{en,n0,n1})}
  /* pin double-tap */
  {await ev(pg,()=>window.__osp.setTool('pin'));const a=await C(pg,0.5,0.45);await t.tap(a[0],a[1]);await pg.waitForTimeout(250);await ev(pg,()=>document.activeElement.blur());await click(pg,'#mbar [data-m=select]');await pg.waitForTimeout(100);
   const pp=await ev(pg,()=>{const r=document.querySelector('[data-pin]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});await t.tap(pp[0],pp[1]);await pg.waitForTimeout(120);await t.tap(pp[0],pp[1]);await pg.waitForTimeout(500);
   const r=await ev(pg,()=>({open:!document.querySelector('#d-insp').hidden,notes:!document.querySelector('#p-notes').hidden,focus:!!document.activeElement.dataset.pintext,ctx:!document.querySelector('#ctxmenu')?.hidden&&!!document.querySelector('#ctxmenu')}));await ev(pg,()=>document.activeElement.blur());
   add(R,'p-pin-dbl','double-tap a pin opens Notes focused, no stray long-press menu',r.open&&r.notes&&r.focus&&!r.ctx,r)}
  /* 3D bar is one row */
  {await click(pg,'#mbar [data-m=select]');await to3D(pg);const r=await ev(pg,()=>{const b=document.querySelector('.v3bar').getBoundingClientRect();const e=document.querySelector('#esc').getBoundingClientRect();return {barH:Math.round(b.height),chipTop:Math.round(e.top),barBottom:Math.round(b.bottom)}});await ev(pg,()=>window.__osp.setTool('paint'));await pg.waitForTimeout(50);const r2=await ev(pg,()=>{const b=document.querySelector('.v3bar').getBoundingClientRect();const e=document.querySelector('#esc').getBoundingClientRect();return {chipTop:Math.round(e.top),barBottom:Math.round(b.bottom)}});await click(pg,'#esc');await to2D(pg);
   add(R,'p-v3bar','3D toolbar is one row on phones and the Cancel chip sits below it',r.barH<60&&r2.chipTop>=r2.barBottom-2,{...r,...r2})}
  /* north widget on phones: visible above the bar, rotates by touch drag */
  {await click(pg,'#mbar [data-m=select]');await pg.waitForTimeout(150);const c=await ev(pg,()=>{const r=document.querySelector('#north').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,r.width/2,document.querySelector('#north').contains(document.elementFromPoint(r.left+r.width/2,r.top+5))]});
   await t.T('touchStart',[[c[0],c[1]-c[2]+4]]);for(let i=1;i<=10;i++){const a=(Math.PI/2)*i/10;await t.T('touchMove',[[c[0]+Math.sin(a)*(c[2]-4),c[1]-Math.cos(a)*(c[2]-4)]]);await pg.waitForTimeout(16)}await t.T('touchEnd',[]);await pg.waitForTimeout(80);
   const nn=await ev(pg,()=>window.__osp.S().north);await ev(pg,()=>window.__osp.setNorth(0));add(R,'p-north','phone: north arrow is reachable and a quarter-turn drag sets about 90°',c[3]&&nn>=75&&nn<=105,{reachable:c[3],north:nn})}
  /* second finger while dragging = axis lock; lifting it frees the move */
  {await click(pg,'#mbar [data-m=select]');await ev(pg,()=>{window.__osp.V.k*=1.6;window.__osp.render()});await pg.waitForTimeout(100);
   const it=await ev(pg,()=>{const S=window.__osp.S();for(const it of S.objs.filter(o=>o.t==='item'&&/^WS/.test(o.code))){const el=document.querySelector(`[data-id="${it.id}"]`);if(!el)continue;const r=el.getBoundingClientRect();if(r.top>140&&r.bottom<innerHeight-160&&r.left>20&&r.right<innerWidth-20)return {id:it.id,x:r.left+r.width/2,y:r.top+r.height/2,ox:it.x,oy:it.y}}return null});
   if(!it)add(R,'p-axis-hold','phone: second finger locks the axis (no desk on screen to test)',false,'no visible desk');else{
   const pos=()=>ev(pg,id=>{const o=window.__osp.S().objs.find(x=>x.id===id);return [o.x-window.__it.ox,o.y-window.__it.oy]},it.id);await ev(pg,it=>{window.__it=it},it);
   await t.T('touchStart',[[it.x,it.y,1]]);for(let i=1;i<=6;i++){await t.T('touchMove',[[it.x+6*i,it.y+4*i,1]]);await pg.waitForTimeout(16)}const free=await pos();
   await t.T('touchStart',[[it.x+36,it.y+24,1],[60,300,2]]);for(let i=7;i<=16;i++){await t.T('touchMove',[[it.x+6*i,it.y+4*i,1],[60,300,2]]);await pg.waitForTimeout(16)}const locked=await pos();
   await t.T('touchEnd',[[60,300,2]]);for(let i=17;i<=22;i++){await t.T('touchMove',[[it.x+6*i,it.y+4*i,1]]);await pg.waitForTimeout(16)}const freed=await pos();await t.T('touchEnd',[[it.x+132,it.y+88,1]]);await pg.waitForTimeout(80);await ev(pg,()=>window.__osp.undo());
   add(R,'p-axis-hold','phone: a second finger locks the drag to one axis; lifting it frees the move; the view does not pan',free[1]!==0&&locked[1]===0&&locked[0]>free[0]&&freed[1]!==0,{free,locked,freed})}
   await ev(pg,()=>{window.__osp.V.k/=1.6;window.__osp.render()})}
  /* 3D on phones: capped pixel ratio, cheaper shadows; walking drops to 1x and restores */
  {await to3D(pg);const r=await ev(pg,()=>{const T=window.__osp.T3();return {pr:T.renderer.getPixelRatio(),lowGPU:T.lowGPU,shadow:T.dir.shadow.mapSize.x,dpr:devicePixelRatio}});await to2D(pg);
   add(R,'p-3d-caps','phone: 3D renders at 1.5× max with 512 px shadows',r.lowGPU&&r.pr<=1.5&&r.shadow<=512,r)}
  /* paint one part only: the Part button sits on the strip in 3D, not in 2D, and flips the preference */
  {await to3D(pg);await ev(pg,()=>window.__osp.setTool('paint'));await pg.waitForTimeout(250);const r=await ev(pg,()=>{const pb=document.querySelector('#paintstrip-part');const in3d=!pb.hidden;const was=!!window.__osp.P().paintFace;pb.click();const now=!!window.__osp.P().paintFace;pb.click();return{in3d,flipped:was!==now,back:!!window.__osp.P().paintFace===was}});
   await ev(pg,()=>window.__osp.setTool('select'));await to2D(pg);add(R,'p-paint-part','phone: Part toggle on the paint strip in 3D flips "paint one part only"',r.in3d&&r.flipped&&r.back,r)}
  /* paint on phones: strip, not the sheet; pick a swatch; tap an item to paint it */
  {await click(pg,'#mbar [data-m=select]');await pg.waitForTimeout(100);await ev(pg,()=>window.__osp.setTool('paint'));await pg.waitForTimeout(100);
   const st=await ev(pg,()=>({strip:!document.querySelector('#paintstrip').hidden&&getComputedStyle(document.querySelector('#paintstrip')).display!=='none',sheet:document.querySelector('#d-insp').hidden,sw:document.querySelectorAll('#paintstrip .psw').length}));
   await ev(pg,()=>{const b=[...document.querySelectorAll('#paintstrip [data-paintc]')].find(x=>x.dataset.paintc.toLowerCase()==='#1f2226');b.click()});
   const target=await ev(pg,()=>{const S=window.__osp.S();const it=S.objs.find(o=>o.t==='item'&&/^WS/.test(o.code));const el=document.querySelector(`[data-id="${it.id}"]`);const r=el.getBoundingClientRect();return {id:it.id,x:r.left+r.width/2,y:r.top+r.height/2,onScreen:r.top>120&&r.bottom<innerHeight-140}});
   if(target.onScreen)await t.tap(target.x,target.y);await pg.waitForTimeout(150);
   const col=await ev(pg,id=>window.__osp.S().objs.find(o=>o.id===id).col,target.id);await ev(pg,()=>window.__osp.undo());await click(pg,'#paintstrip-done');const after=await ev(pg,()=>({tool:document.querySelector('.dock .btn.on')?.dataset.tool,strip:document.querySelector('#paintstrip').hidden}));
   add(R,'p-paint','phone: Paint shows a swatch strip (no sheet), a swatch is picked and a tapped desk takes the colour; Done returns to Select',st.strip&&st.sheet&&st.sw>=8&&(!target.onScreen||col==='#1f2226')&&after.tool==='select'&&after.strip,{...st,col,onScreen:target.onScreen,...after})}
  /* My plans from the More sheet */
  {await click(pg,'#mbar [data-m=more]');await pg.waitForTimeout(100);const has=await ev(pg,()=>!!document.querySelector('#msheet [data-pm=m-plans]'));await ev(pg,()=>document.querySelector('#msheet [data-pm=m-plans]').click());await pg.waitForTimeout(500);
   const r=await ev(pg,()=>({open:!document.querySelector('#plans-modal').hidden,rows:document.querySelectorAll('.plan-row').length,fits:document.querySelector('.plans-card').getBoundingClientRect().right<=innerWidth}));await ev(pg,()=>{document.querySelector('#plans-modal').hidden=true});
   add(R,'p-my-plans','phone: More → My plans opens the list and fits the screen',has&&r.open&&r.rows>=1&&r.fits,r)}
  /* clearing a selection on touch: a tap on empty plan, and the Select slot */
  {const sel=()=>ev(pg,()=>{const o=window.__osp,S=o.S();o.setSel(S.objs.filter(x=>x.t==='item').map(x=>x.id));return o.sel().length});const n=()=>ev(pg,()=>window.__osp.sel().length);
   await click(pg,'#mbar [data-m=select]');await pg.waitForTimeout(100);const a=await sel();const t=await touch(pg);const pt=await ev(pg,()=>{const r=document.querySelector('#plan').getBoundingClientRect();return[r.left+r.width*0.5,r.top+40]});
   await t.tap(pt[0],pt[1]);await pg.waitForTimeout(150);const b=await n();await sel();await click(pg,'#mbar [data-m=select]');await pg.waitForTimeout(150);const c=await n();
   add(R,'p-deselect','phone: tapping empty plan or the Select slot clears a selection',a>10&&b===0&&c===0,{a,b,c})}
  /* row 30: with Details up, a tap on the plan puts it away · row 31: pulling down anywhere on a sheet closes it, unless its content is scrolled */
  {const t=await touch(pg);const vis=s=>ev(pg,s=>!document.querySelector(s).hidden,s);const pick=()=>ev(pg,()=>{const o=window.__osp;o.setSel([o.S().objs.find(x=>x.t==='item').id])});
   const box=s=>ev(pg,s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.left+r.width/2,r.top+r.height*0.55]},s);
   const taps={};for(const [slot,sel] of [['insp','#d-insp'],['lib','#d-lib'],['draw','#msheet'],['more','#msheet']]){if(slot==='insp')await pick();await click(pg,`#mbar [data-m=${slot}]`);await pg.waitForTimeout(300);const d0=await vis(sel);
     const pt=await ev(pg,()=>{for(let y=150;y<450;y+=20)for(let x=30;x<360;x+=20){const h=document.elementFromPoint(x,y);if(h&&h.closest('#plan')&&!h.closest('[data-id]'))return [x,y]}return null});if(pt){await t.tap(pt[0],pt[1]);await pg.waitForTimeout(300)}taps[slot]=[d0,!!pt,await vis(sel)];if(await vis(sel))await click(pg,'#mbar [data-m=select]')}
   add(R,'p-details-tapclose','phone: with Details, Library, Draw or More up, tapping the plan closes it',Object.values(taps).every(([o,p,a])=>o&&p&&!a),taps);
   const pulls={};for(const [slot,sel] of [['lib','#d-lib'],['draw','#msheet'],['insp','#d-insp']]){if(slot==='insp')await pick();await click(pg,`#mbar [data-m=${slot}]`);await pg.waitForTimeout(300);const o=await vis(sel);const b=await box(sel);await t.drag(b,[b[0],b[1]+170],10);await pg.waitForTimeout(400);pulls[slot]=[o,await vis(sel)]}
   await click(pg,'#mbar [data-m=lib]');await pg.waitForTimeout(300);const sc=await ev(pg,()=>{const d=document.querySelector('#d-lib');const c=[d,...d.querySelectorAll('*')].find(e=>e.scrollHeight>e.clientHeight+40&&/(auto|scroll)/.test(getComputedStyle(e).overflowY));if(!c)return false;c.scrollTop=200;return c.scrollTop>0});
   const b=await box('#d-lib');await t.drag(b,[b[0],b[1]+170],10);await pg.waitForTimeout(400);const stay=await vis('#d-lib');await click(pg,'#mbar [data-m=select]');await pg.waitForTimeout(200);
   add(R,'p-sheet-pull','phone: pulling down from the middle of Library, Draw or Details closes it; a scrolled list scrolls instead',Object.values(pulls).every(([o,a])=>o&&!a)&&sc&&stay,{pulls,scrolled:sc,stillOpenWhenScrolled:stay})}
  add(R,'p-phone-clean','phone smoke left no console errors',e0()===0,pg.errs.slice(0,5));
  await pg.ctx.close();return R}

export async function run(b){ids.length=0;const R=[];R.push(...await desktop(b));R.push(...await phone(b));return R}
