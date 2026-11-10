/* matrix slice: checklist groups B (Edit) and C (Create) on desktop 2D (D2) and desktop 3D (D3).
   Every check works on a small fixture plan (below), drives real mouse / keyboard input for the action under test,
   asserts the exact result, then undoes with Ctrl+Z (exact previous JSON) and redoes with Ctrl+Y.
   Set MX_EC_ONLY=<regex> to run only matching ids (used for mutation testing). */
import {openApp,row,to3D} from '../../lib.mjs';
export const name='matrix-edit-create';
const ONLY=process.env.MX_EC_ONLY?new RegExp(process.env.MX_EC_ONLY):null;
const ev=(pg,fn,a)=>pg.evaluate(fn,a);
const wf=(pg,fn,a,t=5000)=>pg.waitForFunction(fn,a,{timeout:t,polling:30}).then(()=>true,()=>false);
const ST=pg=>ev(pg,()=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null})});
const stIs=(pg,s)=>wf(pg,s=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null})===s},s);
const O=(pg,id)=>ev(pg,id=>{const o=window.__osp.byId(id);return o?JSON.parse(JSON.stringify(o)):null},id);
const newObjs=(pg,before)=>ev(pg,b=>{const ids=new Set(JSON.parse(b).o.map(o=>o.id));return JSON.parse(JSON.stringify(window.__osp.S().objs.filter(o=>!ids.has(o.id))))},before);
const others=(pg,before,ids)=>ev(pg,([b,ids])=>{const keep=o=>!ids.includes(o.id);const was=JSON.parse(b).o.filter(keep).map(o=>JSON.stringify(o)).join('|');const now=window.__osp.S().objs.filter(o=>!ids.includes(o.id)&&JSON.parse(b).o.some(x=>x.id===o.id)).map(o=>JSON.stringify(o)).join('|');return was===now},[before,ids]);
const near=(a,b,t=50)=>Math.abs(a-b)<=t;
const nearP=(p,q,t=50)=>!!p&&!!q&&near(p[0],q[0],t)&&near(p[1],q[1],t);
const blur=pg=>ev(pg,()=>{const a=document.activeElement;if(a&&a!==document.body&&a.blur)a.blur()});
const tool=pg=>ev(pg,()=>{const b=document.querySelector('.dock .btn.on');return b?b.dataset.tool:null});
/* undo (Ctrl+Z) must give back exactly `before`, redo (Ctrl+Y) exactly `after`; leaves the plan at `before` */
async function UR(pg,before,after){await blur(pg);await pg.keyboard.press('Control+z');const undo=await stIs(pg,before);await pg.keyboard.press('Control+y');const redo=await stIs(pg,after);
  await pg.keyboard.press('Control+z');const back=await stIs(pg,before);return {undo,redo,back,ok:undo&&redo&&back}}
const mdrag=async(pg,a,b,{steps=8,mods=[]}={})=>{await pg.mouse.move(a[0],a[1]);await pg.mouse.down();for(let i=1;i<=steps;i++){if(i===2)for(const m of mods)await pg.keyboard.down(m);await pg.mouse.move(a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps);await pg.waitForTimeout(12)}await pg.mouse.up();for(const m of mods)await pg.keyboard.up(m)};

/* ---------- the fixture plan (mm) ---------- */
function fixture(){const L=window.__osp.LIB();const lib=c=>L.find(l=>l.code===c);
  const it=(id,code,x,y)=>{const l=lib(code);return {id,t:'item',code:l.code,name:l.name,cat:l.cat,shape:l.shape,w:l.w,d:l.d,h:l.h,a:l.a,seats:l.seats,cf:l.cf,cb:l.cb,nests:!!l.nests,rate:l.rate,pts:null,x,y,r:0,gid:null,label:''}};
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  return {name:'mx-ec fixture',objs:[
    {id:'r1',t:'room',name:'Office',pts:rect(0,0,5000,3500),gid:null},
    it('d1','WS1260',1000,800),it('d2','WS1260',3500,2200),
    {id:'w1',t:'wall',pts:[[0,5000],[3500,5000],[3500,7000]],closed:false,th:150,gid:null},
    it('dr1','DR900',1500,5000),
    {id:'w2',t:'wall',pts:[[4500,5500],[7000,5500]],closed:false,th:150,gid:null},
    {id:'w3',t:'wall',pts:rect(5800,0,7300,2500),closed:true,th:150,gid:null},
    it('col1','C400',6500,7500)],pins:[]}}
/* empty drawing area: x 8500..12000, y 0..6500 */

async function setup(b,{d3}){
  const pg=await openApp(b,Object.assign({sample:false},process.env.SB_URL?{url:process.env.SB_URL}:{}));
  await ev(pg,f=>{window.__osp.openPlanText(JSON.stringify(f),'mx-ec.json')},await ev(pg,fixture));
  await wf(pg,()=>window.__osp.S().name==='mx-ec fixture'&&window.__osp.byId('w3'));
  await ev(pg,()=>{const o=window.__osp;if(o.P().lib)document.querySelector('#t-lib').click();if(!o.P().insp)document.querySelector('#t-insp').click()});
  await ev(pg,()=>{const V=window.__osp.V;V.k=0.075;V.x=-500-22/V.k;V.y=-500-23/V.k;document.querySelector('#plan').dispatchEvent(new WheelEvent('wheel',{deltaY:0,clientX:500,clientY:400,bubbles:true,cancelable:true}));window.__osp.toastOff()});
  await wf(pg,()=>{const r=document.querySelector('#plan').getBoundingClientRect(),V=window.__osp.V,vb=document.querySelector('#plan').getAttribute('viewBox').split(' ').map(Number);return Math.abs(vb[0]-V.x)<1&&Math.abs(vb[2]*V.k-r.width)<2});
  pg.base=await ev(pg,()=>JSON.stringify(window.__osp.S().objs));
  if(d3){await to3D(pg);await ev(pg,aim3);await pg.waitForTimeout(200)}
  pg.d3=!!d3;return pg}
/* 3D: straight-down camera over the fixture, scaled so the fixture and the drawing area sit between the docked panels */
function aim3(){const T=window.__osp.T3(),c=document.querySelector('#v3c').getBoundingClientRect(),ins=document.querySelector('#d-insp').getBoundingClientRect();
  const fx=(20+ins.left)/2,fy=475,ppm=75;const H=(c.height/2)/(ppm*Math.tan(T.camera.fov*Math.PI/360));
  const tx=6.0-(fx-(c.left+c.width/2))/ppm,tz=3.8-(fy-(c.top+c.height/2))/ppm;T.controls.target.set(tx,0,tz);T.camera.position.set(tx,H,tz+0.0001);T.camera.near=0.05;T.camera.far=H*4;T.camera.updateProjectionMatrix();T.controls.update();T.need=true}
async function reset(pg){
  if(pg.d3&&!(await in3D(pg))){await to3D(pg);await ev(pg,aim3)}
  await ev(pg,base=>{const o=window.__osp,S=o.S(),P=o.P();const a=document.activeElement;if(a&&a.blur)a.blur();document.querySelectorAll('.rename-in').forEach(e=>e.remove());
    if(!document.querySelector('#d-lib').hidden)document.querySelector('#t-lib').click();o.setTool('select');S.objs=JSON.parse(base);S.pins=[];S.section=undefined;o.setSecSel(false);P.paintFace=false;P.paintCol='#d9c7a7';
    ['#ctxmenu','#pop-shape','#pop-more'].forEach(s=>{const e=document.querySelector(s);if(e)e.hidden=true});o.setSel([]);o.toastOff();const tb=document.querySelector('[data-tab=sel]');if(tb)tb.click();o.render();if(o.T3()&&document.querySelector('#v3')&&!document.querySelector('#v3').hidden)o.build3D()},pg.base);
  await pg.keyboard.up('Shift');await pg.mouse.move(5,500);if(pg.d3)await pg.waitForTimeout(250);
  /* 2D: a click on empty plan far from every target, so the check's first click is never read as the second half of a double-click */
  if(!pg.d3){const p=await S2(pg,8400,-500);if((await hitAt(pg,p))==='plan')await pg.mouse.click(p[0],p[1]);else await wf(pg,()=>{const d=window.__osp.lastDown();return !d||performance.now()-d.t>520},null,5000)}await pg.waitForTimeout(pg.d3?120:40)}

/* ---------- screen coordinates and hit tests ---------- */
/* 2D: world mm -> screen px */
const S2=(pg,wx,wy)=>ev(pg,([wx,wy])=>{const V=window.__osp.V,r=document.querySelector('#plan').getBoundingClientRect();return [r.left+(wx-V.x)*V.k,r.top+(wy-V.y)*V.k]},[wx,wy]);
/* 3D: world mm at height h -> screen px through the live three.js camera */
const S3=(pg,wx,wy,h=0)=>ev(pg,([wx,wy,h])=>{const T=window.__osp.T3(),c=document.querySelector('#v3c'),r=c.getBoundingClientRect();T.camera.updateMatrixWorld();const v=new T.THREE.Vector3(wx*0.001,h*0.001,wy*0.001).project(T.camera);return [r.left+(v.x*0.5+0.5)*r.width,r.top+(-v.y*0.5+0.5)*r.height]},[wx,wy,h]);
const SP=(pg,wx,wy,h)=>pg.d3?S3(pg,wx,wy,h||0):S2(pg,wx,wy);
/* what is under a screen point: the plan object id (2D), or the canvas (3D) */
const hitAt=(pg,p)=>ev(pg,p=>{const e=document.elementFromPoint(p[0],p[1]);if(!e)return null;if(e.id==='v3c')return 'canvas';const d=e.closest('[data-id]');return d?d.dataset.id:(e.closest('#plan')?'plan':e.id||e.tagName)},p);
/* a 3D ray pick at a screen point: the plan object id under it (same rule as the app's click-to-select) */
const pick3=(pg,p)=>ev(pg,p=>{const T=window.__osp.T3(),c=document.querySelector('#v3c'),r=c.getBoundingClientRect();const rc=new T.THREE.Raycaster();rc.setFromCamera(new T.THREE.Vector2(((p[0]-r.left)/r.width)*2-1,-((p[1]-r.top)/r.height)*2+1),T.camera);
  const h=rc.intersectObjects(T.group.children,true).find(h=>{let o=h.object;while(o&&!o.userData.id)o=o.parent;return!!o});if(!h)return null;let o=h.object;while(o&&!o.userData.id)o=o.parent;return o.userData.id},p);
/* 3D: the first few things a ray at a screen point meets: [plan id, paint kind] (diagnostics only) */
const probe=(pg,p)=>ev(pg,p=>{const T=window.__osp.T3(),c=document.querySelector('#v3c'),r=c.getBoundingClientRect();const rc=new T.THREE.Raycaster();rc.setFromCamera(new T.THREE.Vector2(((p[0]-r.left)/r.width)*2-1,-((p[1]-r.top)/r.height)*2+1),T.camera);
  const top=document.elementFromPoint(p[0],p[1]);return {top:top&&(top.id||top.tagName),hits:rc.intersectObjects(T.group.children,true).slice(0,4).map(h=>{let o=h.object;while(o&&!o.userData.id&&!o.userData.paint)o=o.parent;return o?[o.userData.id||'',o.userData.paint||'',Math.round(h.point.y*1000)]:null})}},p);
/* a point on screen for object `id` (at height h in 3D), asserted to land on that object */
/* 3D: try points over the object's footprint at several heights until the app's ray pick lands on it with the canvas on top */
const find3=(pg,id,cands,kind)=>ev(pg,([id,cands,kind])=>{const T=window.__osp.T3(),c=document.querySelector('#v3c'),r=c.getBoundingClientRect();T.camera.updateMatrixWorld();
  for(const [x,y,h] of cands){const v=new T.THREE.Vector3(x*0.001,h*0.001,y*0.001).project(T.camera);const p=[r.left+(v.x*0.5+0.5)*r.width,r.top+(-v.y*0.5+0.5)*r.height];const e=document.elementFromPoint(p[0],p[1]);if(!e||e.id!=='v3c')continue;
    const rc=new T.THREE.Raycaster();rc.setFromCamera(new T.THREE.Vector2(((p[0]-r.left)/r.width)*2-1,-((p[1]-r.top)/r.height)*2+1),T.camera);const hh=rc.intersectObjects(T.group.children,true).find(h=>{let o=h.object;while(o&&!o.userData.id)o=o.parent;return!!o});
    if(!hh)continue;let o=hh.object;while(o&&!o.userData.id)o=o.parent;if(o.userData.id!==id)continue;
    if(kind){const f=rc.intersectObjects(T.group.children,true).map(h=>{let m=h.object;while(m&&!m.userData.id&&!m.userData.paint)m=m.parent;return m}).find(Boolean);if(!f||f.userData.paint!==kind)continue}
    return p}return null},[id,cands,kind||null]);
async function onObj(pg,id,wx,wy,h,kind){if(pg.d3){await pg.waitForTimeout(150);/* let a scheduled 3D rebuild land first */const hs=[h,2800,2100,1500,730,300,20].filter((v,i,a)=>v!=null&&a.indexOf(v)===i);const C=[];for(const hh of hs)for(const [dx,dy] of [[0,0],[0,40],[0,-40],[40,0],[-40,0],[150,0],[-150,0],[0,150],[0,-150]])C.push([wx+dx,wy+dy,hh]);
    let p=await find3(pg,id,C,kind);if(!p){const G=[];for(const hh of [2100,2000,1800,1200,800,400,100,10])for(let dx=-600;dx<=600;dx+=100)for(let dy=-600;dy<=600;dy+=100)G.push([wx+dx,wy+dy,hh]);p=await find3(pg,id,G,kind)}
    if(!p){const c=await S3(pg,wx,wy,h||0);throw new Error(`no 3D point lands on ${id} near ${wx},${wy}; there: ${JSON.stringify(await probe(pg,c))}`)}return p}
  const p=await SP(pg,wx,wy,h);const hit=pg.d3?((await hitAt(pg,p))==='canvas'?await pick3(pg,p):'blocked'):await hitAt(pg,p);if(hit!==id)throw new Error(`point for ${id} hits ${hit}`);return p}
async function onEmpty(pg,wx,wy){if(pg.d3&&!(await in3D(pg)))throw new Error('the view dropped out of 3D to the 2D plan (no 3D version of this tool)');const p=await SP(pg,wx,wy);const hit=await hitAt(pg,p);if(pg.d3?hit!=='canvas':hit!=='plan')throw new Error(`empty point ${wx},${wy} hits ${hit}`);return p}
const click=async(pg,p,mods=[])=>{for(const m of mods)await pg.keyboard.down(m);await pg.mouse.click(p[0],p[1]);for(const m of mods)await pg.keyboard.up(m);await pg.waitForTimeout(pg.d3?60:20)};
const selIs=(pg,ids)=>wf(pg,ids=>{const s=window.__osp.sel().slice().sort();return JSON.stringify(s)===JSON.stringify(ids.slice().sort())},ids,5000);
/* select by clicking the object (desk centres; walls and rooms at a given point) */
const PT={d1:[1000,800,730],d2:[3500,2200,730],dr1:[1500,5000,2100],w1:[2600,5000,2800],w2:[5200,5500,2800],r1:[2500,3000,0],col1:[6500,7500,2800]};
async function pickSel(pg,id,mods=[]){const q=PT[id];const p=await onObj(pg,id,q[0],q[1],q[2]);await click(pg,p,mods);return p}
async function selectOne(pg,id){await pickSel(pg,id);if(!(await selIs(pg,[id])))throw new Error('click did not select '+id+' (sel '+JSON.stringify(await ev(pg,()=>window.__osp.sel()))+')')}
const dockTool=async(pg,t)=>{await pg.click(`.dock [data-tool="${t}"]`);await pg.waitForTimeout(40)};
const shapeTool=async(pg,k)=>{await pg.click('#t-shape');await pg.click(`#pop-shape [data-shape="${k}"]`);await pg.waitForTimeout(40)};
const in3D=pg=>ev(pg,()=>!document.querySelector('#v3').hidden);

/* ======================= B. Edit ======================= */
const B=[];const C=[];
const add=(L,key,name,fn,o={})=>L.push({key,name,fn,...o});

/* B1 */
// mutation [move]: app.js:1153 `drag.orig.forEach(([id,o0])=>{const o=byId(id);if(!o)retu...` → `drag.orig.forEach(([id,o0])=>{const o=byId(id);if(!o)retu...` + app.js:2933 `moveObj(o,o0,m.dx,m.dy)` → `moveObj(o,o0,0,0)` → FAIL confirmed (2D and 3D)
add(B,'b1-move','drag a desk moves it by the dragged distance; undo / redo',async pg=>{
  const s0=await ST(pg);const o0=await O(pg,'d1');const a=await SP(pg,1000,800,730);await onObj(pg,'d1',1000,800,730);const b=await SP(pg,2000,1800,730);
  if(pg.d3){const fa=await SP(pg,1000,800,0),fb=await SP(pg,2000,1800,0);/* drag measured on the floor plane under the pointer */await mdrag(pg,a,[a[0]+fb[0]-fa[0],a[1]+fb[1]-fa[1]],{steps:10})}else await mdrag(pg,a,b,{steps:10});
  await wf(pg,()=>window.__osp.byId('d1').x!==1000);const o1=await O(pg,'d1');const s1=await ST(pg);const oth=await others(pg,s0,['d1']);
  const tol=pg.d3?100:0;const ok=near(o1.x-o0.x,1000,tol)&&near(o1.y-o0.y,1000,tol)&&o1.r===o0.r&&oth;const ur=await UR(pg,s0,s1);
  return {pass:ok&&ur.ok,detail:{dx:o1.x-o0.x,dy:o1.y-o0.y,oth,ur}}});
/* B2 */
// mutation [axis]: app.js:1148 `if(ev.shiftKey||drag.axisHold){if(Math.abs(dx)>=Math.abs(...` → `if(false){}` → FAIL confirmed (2D; 3D has no Shift lock, a finding)
add(B,'b2-axis','Shift-drag a desk moves it along one axis only',async pg=>{
  const s0=await ST(pg);const o0=await O(pg,'d1');const a=await onObj(pg,'d1',1000,800,730);const fa=await SP(pg,1000,800,0),fb=await SP(pg,2500,1300,0);
  await mdrag(pg,a,[a[0]+fb[0]-fa[0],a[1]+fb[1]-fa[1]],{steps:10,mods:['Shift']});await wf(pg,()=>window.__osp.byId('d1').x!==1000);
  const o1=await O(pg,'d1');const s1=await ST(pg);const ok=o1.x-o0.x>=1000&&o1.y===o0.y;const ur=s1!==s0?await UR(pg,s0,s1):{ok:false};
  return {pass:ok&&ur.ok,detail:{dx:o1.x-o0.x,dy:o1.y-o0.y,ur}}});
/* B3 */
// mutation [nudge]: app.js:2764 `nudge(e.key==='ArrowLeft'?-s:e.key==='ArrowRight'?s:0,e.k...` → `nudge(0,0)` → FAIL confirmed (2D and 3D)
add(B,'b3-nudge','arrow keys nudge the selection (one snap; Shift = 10 mm)',async pg=>{
  await selectOne(pg,'d1');const s0=await ST(pg);const o0=await O(pg,'d1');await pg.keyboard.press('ArrowRight');const a1=await O(pg,'d1');const s1=await ST(pg);
  await pg.keyboard.press('Shift+ArrowDown');const a2=await O(pg,'d1');const s2=await ST(pg);
  const ok=a1.x===o0.x+50&&a1.y===o0.y&&a2.y===o0.y+10&&a2.x===o0.x+50;
  await pg.keyboard.press('Control+z');const u1=await stIs(pg,s1);const ur=await UR(pg,s0,s1);
  return {pass:ok&&u1&&ur.ok&&s2!==s1,detail:{a1:[a1.x,a1.y],a2:[a2.x,a2.y],u1,ur}}});
/* B4 */
// mutation [rotate]: app.js:1395 `o.r=(((o.r||0)+deg)%360+360)%360` → `o.r=o.r||0` → FAIL confirmed (2D and 3D)
add(B,'b4-rotate','R rotates the selection 90° clockwise, Shift+R anticlockwise, about its centre',async pg=>{
  await selectOne(pg,'d1');const s0=await ST(pg);await pg.keyboard.press('r');const a=await O(pg,'d1');const sa=await ST(pg);const ura=await UR(pg,s0,sa);
  await pg.keyboard.press('Shift+R');const b=await O(pg,'d1');const sb=await ST(pg);const urb=await UR(pg,s0,sb);
  const ok=a.r===90&&b.r===270&&a.x===1000&&a.y===800&&b.x===1000&&b.y===800;return {pass:ok&&ura.ok&&urb.ok,detail:{a:[a.x,a.y,a.r],b:[b.x,b.y,b.r],ura,urb}}});
/* B5 */
// mutation [dup]: app.js:1419 `function duplicateSel(){const l=selList();` → `function duplicateSel(){return;const l=selList();` → FAIL confirmed (2D and 3D)
add(B,'b5-dup','Ctrl+D duplicates the selection 500 mm down-right and selects the copy',async pg=>{
  await selectOne(pg,'d1');const s0=await ST(pg);await pg.keyboard.press('Control+d');await wf(pg,n=>window.__osp.S().objs.length===n+1,JSON.parse(s0).o.length);
  const nw=await newObjs(pg,s0);const s1=await ST(pg);const sel=await ev(pg,()=>window.__osp.sel());const n=nw[0]||{};
  const ok=nw.length===1&&n.code==='WS1260'&&n.x===1500&&n.y===1300&&n.w===1200&&n.d===600&&n.id!=='d1'&&sel.length===1&&sel[0]===n.id&&await others(pg,s0,[]);const ur=await UR(pg,s0,s1);
  return {pass:ok&&ur.ok,detail:{nw:nw.map(o=>[o.code,o.x,o.y]),sel,ur}}});
/* B6 */
// mutation [copy]: app.js:1408 `clip=clone(l);pasteN=0;store.set('osp-clip',JSON.stringif...` → `clip=null;pasteN=0;` → FAIL confirmed (2D; 3D check fails on the real build, a finding)
add(B,'b6-copy-paste','Ctrl+C then Ctrl+V pastes a copy under the pointer',async pg=>{
  await selectOne(pg,'d1');await pg.evaluate(()=>localStorage.removeItem('osp-clip'));await pg.keyboard.press('Control+c');const clip=await ev(pg,()=>(localStorage.getItem('osp-clip')||'').length);const s0=await ST(pg);const t=await onEmpty(pg,9500,4200);await pg.mouse.move(t[0],t[1]);if(pg.d3)await pg.mouse.move(t[0]+1,t[1]);
  await pg.keyboard.press('Control+v');await wf(pg,n=>window.__osp.S().objs.length===n+1,JSON.parse(s0).o.length);const nw=await newObjs(pg,s0);const s1=await ST(pg);const n=nw[0]||{};
  const pos=pg.d3?(near(n.x,9500,100)&&near(n.y,4200,100)):(n.x===9500&&n.y===4200);const ok=nw.length===1&&n.code==='WS1260'&&n.id!=='d1'&&pos;const ur=await UR(pg,s0,s1);
  return {pass:ok&&ur.ok,detail:{nw:nw.map(o=>[o.code,o.x,o.y]),clip,ur}}});
/* B7 */
const delCheck=how=>async pg=>{
  const p=await pickSel(pg,'d1');if(!(await selIs(pg,['d1'])))throw new Error('click did not select d1 (sel '+JSON.stringify(await ev(pg,()=>window.__osp.sel()))+')');const s0=await ST(pg);
  if(how==='key')await pg.keyboard.press('Delete');
  else if(how==='btn'){/* the header trash button is phone-only; on desktop the trash button is Details › Delete */
    const b=await ev(pg,()=>{const h=document.querySelector('#b-del');if(h&&h.getBoundingClientRect().width>0)return '#b-del';return document.querySelector('#p-sel [data-act="del"]')?'#p-sel [data-act="del"]':null});
    if(!b)return {pass:false,detail:'no visible trash / Delete button with a selection'};if(await ev(pg,b=>document.querySelector(b).disabled,b))return {pass:false,detail:'trash button disabled with a selection'};await pg.click(b,{timeout:3000})}
  else{await pg.mouse.click(p[0],p[1],{button:'right'});const vis=await wf(pg,()=>!document.querySelector('#ctxmenu').hidden&&!!document.querySelector('#ctxmenu [data-cm=del]'),null,5000);if(!vis)return {pass:false,detail:'no context menu with Delete'};await pg.click('#ctxmenu [data-cm=del]')}
  await wf(pg,()=>!window.__osp.byId('d1'));const s1=await ST(pg);const gone=JSON.parse(s1).o.length===JSON.parse(s0).o.length-1&&!(await O(pg,'d1'));const oth=await others(pg,s0,['d1']);const ur=await UR(pg,s0,s1);
  return {pass:gone&&oth&&ur.ok,detail:{gone,oth,ur}}};
// mutation [del]: app.js:1406 `S.objs=S.objs.filter(o=>!sel.has(o.id));sel.clear()` → `sel.clear()` → FAIL confirmed (2D and 3D)
add(B,'b7-del-key','Delete key removes the selected desk; undo restores it exactly',delCheck('key'));
// mutation [del]: app.js:1406 `S.objs=S.objs.filter(o=>!sel.has(o.id));sel.clear()` → `sel.clear()` → FAIL confirmed (2D and 3D)
add(B,'b7-del-btn','the trash button (Details › Delete) removes the selected desk; undo restores it exactly',delCheck('btn'));
// mutation [del]: app.js:1406 `S.objs=S.objs.filter(o=>!sel.has(o.id));sel.clear()` → `sel.clear()` → FAIL confirmed (2D and 3D)
add(B,'b7-del-menu','right-click › Delete removes the desk; undo restores it exactly',delCheck('menu'));
/* B9 */
// mutation [group]: app.js:1420 `const g=uid();l.forEach(o=>o.gid=g)` → `const g=uid();l.forEach(o=>o.gid=null)` → FAIL confirmed (2D and 3D)
add(B,'b9-group','Shift-click two desks, Ctrl+G groups them (one click then picks both), Ctrl+Shift+G ungroups',async pg=>{
  await selectOne(pg,'d1');await pickSel(pg,'d2',['Shift']);const two=await selIs(pg,['d1','d2']);const s0=await ST(pg);
  await pg.keyboard.press('Control+g');const g=await ev(pg,()=>[window.__osp.byId('d1').gid,window.__osp.byId('d2').gid]);const s1=await ST(pg);
  const e=await onEmpty(pg,9500,4200);await click(pg,e);const cleared=await selIs(pg,[]);await pickSel(pg,'d1');const both=await selIs(pg,['d1','d2']);
  await pg.keyboard.press('Control+Shift+G');const ug=await ev(pg,()=>[window.__osp.byId('d1').gid,window.__osp.byId('d2').gid]);
  await blur(pg);await pg.keyboard.press('Control+z');const u1=await stIs(pg,s1);const ur=await UR(pg,s0,s1);
  const ok=two&&g[0]&&g[0]===g[1]&&cleared&&both&&ug[0]==null&&ug[1]==null;return {pass:ok&&u1&&ur.ok,detail:{two,g,cleared,both,ug,u1,ur}}});
/* B10 */
// mutation [align]: app.js:1426 `if(how==='l')dx=B.x0-b.x0;` → `if(how==='l')dx=0;` → FAIL confirmed (2D and 3D)
add(B,'b10-align','Details › Align left / centre / right / top / middle / bottom lines up two desks',async pg=>{
  await selectOne(pg,'d1');await pickSel(pg,'d2',['Shift']);if(!(await selIs(pg,['d1','d2'])))throw new Error('two not selected');const s0=await ST(pg);
  const want={l:[1000,1000,null],c:[2250,2250,null],r:[3500,3500,null],t:[null,800,800],m:[null,1500,1500],b:[null,2200,2200]};const res={};let ok=true;
  for(const k of Object.keys(want)){const btn=`#p-sel [data-act="al-${k}"]`;if(!(await wf(pg,s=>!!document.querySelector(s),btn,5000))){ok=false;res[k]='no button';continue}
    await pg.click(btn);await pg.waitForTimeout(30);const a=await O(pg,'d1'),b=await O(pg,'d2');const s1=await ST(pg);
    const w=want[k];const got=w[0]!==null?(a.x===w[0]&&b.x===w[1]&&a.y===800&&b.y===2200):(a.y===w[1]&&b.y===w[2]&&a.x===1000&&b.x===3500);const ur=await UR(pg,s0,s1);res[k]={d1:[a.x,a.y],d2:[b.x,b.y],ur:ur.ok};if(!got||!ur.ok)ok=false}
  return {pass:ok,detail:res}});
/* B11 */
// mutation [props]: app.js:1621 `if((f==='w'||f==='d')&&n<=0)return;o[f]=n}` → `if((f==='w'||f==='d')&&n<=0)return;}` → FAIL confirmed (2D and 3D)
add(B,'b11-props','Details: width, name and height fields change the desk (one undo step each)',async pg=>{
  await selectOne(pg,'d1');const s0=await ST(pg);const f=k=>`#p-sel [data-f="${k}"]`;
  await pg.fill(f('w'),'1500');await pg.fill(f('label'),'Reception desk');await pg.fill(f('h'),'900');await blur(pg);await pg.waitForTimeout(30);
  const o=await O(pg,'d1');const s1=await ST(pg);const ok=o.w===1500&&o.label==='Reception desk'&&o.h===900&&o.d===600&&await others(pg,s0,['d1']);
  await pg.keyboard.press('Control+z');await pg.keyboard.press('Control+z');await pg.keyboard.press('Control+z');const back=await stIs(pg,s0);
  await pg.keyboard.press('Control+y');await pg.keyboard.press('Control+y');await pg.keyboard.press('Control+y');const redo=await stIs(pg,s1);
  for(let i=0;i<3;i++)await pg.keyboard.press('Control+z');const back2=await stIs(pg,s0);
  return {pass:ok&&back&&redo&&back2,detail:{w:o.w,label:o.label,h:o.h,back,redo,back2}}});
// mutation [colour]: app.js:1686 `applyColor(id,b.dataset.cval||null,false)` → `void 0` → FAIL confirmed (2D and 3D)
add(B,'b11-colour','Details: a floor-colour swatch recolours the selected room',async pg=>{
  await selectOne(pg,'r1');const s0=await ST(pg);const sw='#p-sel .cpick[data-cp="room-floor"] [data-cval]:not([data-cval=""])';
  if(!(await wf(pg,s=>!!document.querySelector(s),sw,5000)))return {pass:false,detail:'no floor colour swatches'};
  const col=await ev(pg,s=>document.querySelectorAll(s)[2].dataset.cval,sw);await pg.click(`#p-sel .cpick[data-cp="room-floor"] [data-cval="${col}"]`);await pg.waitForTimeout(30);
  const o=await O(pg,'r1');const s1=await ST(pg);const ok=(o.floorCol||'').toLowerCase()===col.toLowerCase()&&await others(pg,s0,['r1']);const ur=await UR(pg,s0,s1);
  return {pass:ok&&ur.ok,detail:{col,floorCol:o.floorCol,ur}}});
/* B12 */
const vhPt=(pg,id,i,wx,wy,h)=>pg.d3?S3(pg,wx,wy,h):ev(pg,i=>{const e=document.querySelector(`[data-vh="${i}"]`);if(!e)return null;const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]},i);
// mutation [vertex]: app.js:1141 `drag.o.pts[drag.i]=sn.p;guideSVG=sn.g;` → `guideSVG=sn.g;` + app.js:2890 `else vh3.o.pts[vh3.i]=[Math.round(q[0]),Math.round(q[1])];` → `else;` → FAIL confirmed (2D and 3D)
add(B,'b12-wall-vertex','drag a wall corner dot moves that corner only',async pg=>{
  await selectOne(pg,'w1');await pg.waitForTimeout(pg.d3?150:20);const s0=await ST(pg);const hy=pg.d3?await ev(pg,()=>Math.min(window.__osp.S().bld?2800:2800,2800)+250):0;
  const a=await vhPt(pg,'w1',2,3500,7000,hy);if(!a)return {pass:false,detail:'no corner dot'};
  /* 2D: drag the dot by the distance; 3D: the app puts the corner on the floor under the pointer, so end the drag over the target floor point */
  const b=pg.d3?await S3(pg,4300,6500,0):await (async()=>{const fa=await S2(pg,3500,7000),fb=await S2(pg,4300,6500);return [a[0]+fb[0]-fa[0],a[1]+fb[1]-fa[1]]})();await mdrag(pg,a,b,{steps:10});
  await wf(pg,()=>window.__osp.byId('w1').pts[2][0]!==3500);const o=await O(pg,'w1');const s1=await ST(pg);
  const ok=nearP(o.pts[2],[4300,6500],pg.d3?100:50)&&JSON.stringify(o.pts.slice(0,2))===JSON.stringify([[0,5000],[3500,5000]]);const ur=await UR(pg,s0,s1);
  return {pass:ok&&ur.ok,detail:{pts:o.pts,ur}}});
// mutation [corner]: app.js:1056 `&&insertCorner(o,w)){lastDown=null;drag=null;ev.preventDe...` → `&&false){lastDown=null;drag=null;ev.preventDefault();return}` → FAIL confirmed (2D; 3D has no corner insert, a finding)
add(B,'b12-wall-corner','double-click on a wall inserts a corner there',async pg=>{
  await selectOne(pg,'w1');const s0=await ST(pg);const p=await onObj(pg,'w1',2600,5000,1500);await pg.waitForTimeout(550);await pg.mouse.dblclick(p[0],p[1]);
  await wf(pg,()=>window.__osp.byId('w1').pts.length===4);const o=await O(pg,'w1');const s1=await ST(pg);const ok=o.pts.length===4&&o.pts.some(q=>nearP(q,[2600,5000]));const ur=await UR(pg,s0,s1);
  return {pass:ok&&ur.ok,detail:{pts:o.pts,ur,in3D:await in3D(pg)}}});
// mutation [arc]: app.js:1136 `o.bulge[drag.i]=h;` → `o.bulge[drag.i]=0;` + app.js:1627 `if(f==='bulge'){if(!isFinite(n))return;o.bulge=[n];` → `if(f==='bulge'){if(!isFinite(n))return;o.bulge=[0];` → FAIL confirmed (2D and 3D)
add(B,'b12-wall-arc','pull the middle diamond of a straight wall bows it into an arc (3D: the Curve field)',async pg=>{
  await selectOne(pg,'w2');const s0=await ST(pg);
  if(pg.d3){const f='#p-sel [data-f="bulge"]';if(!(await wf(pg,s=>!!document.querySelector(s),f,5000)))return {pass:false,detail:'no Curve field in Details'};await pg.fill(f,'800');await blur(pg)}
  else{const a=await ev(pg,()=>{const e=document.querySelector('[data-bh="0"]');if(!e)return null;const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});if(!a)return {pass:false,detail:'no curve handle'};
    const fa=await S2(pg,5750,5500),fb=await S2(pg,5750,6300);await mdrag(pg,a,[a[0]+fb[0]-fa[0],a[1]+fb[1]-fa[1]],{steps:10})}
  await wf(pg,()=>{const o=window.__osp.byId('w2');return o.bulge&&o.bulge[0]});const o=await O(pg,'w2');const s1=await ST(pg);const h=o.bulge&&o.bulge[0];
  const ok=near(Math.abs(h||0),800,50)&&JSON.stringify(o.pts)==='[[4500,5500],[7000,5500]]';const ur=await UR(pg,s0,s1);return {pass:ok&&ur.ok,detail:{bulge:o.bulge,ur}}});
/* B13 */
// mutation [rename]: app.js:1695 `if(ok&&v&&v!==o.name){checkpoint();o.name=v;` → `if(ok&&v&&v!==o.name){checkpoint();` → FAIL confirmed (2D and 3D)
add(B,'b13-rename','rename a room (2D double-click; 3D right-click › Rename room), Enter keeps it',async pg=>{
  const s0=await ST(pg);const p=await onObj(pg,'r1',2500,3000,0);
  if(pg.d3){await pg.mouse.click(p[0],p[1],{button:'right'});if(!(await wf(pg,()=>!!document.querySelector('#ctxmenu:not([hidden]) [data-cm=rename]'),null,5000)))return {pass:false,detail:'no Rename room in the 3D menu'};await pg.click('#ctxmenu [data-cm=rename]')}
  else await pg.mouse.dblclick(p[0],p[1]);
  if(!(await wf(pg,()=>document.activeElement&&document.activeElement.classList.contains('rename-in'),null,5000)))return {pass:false,detail:'no rename field focused'};
  await pg.keyboard.press('Control+a');await pg.keyboard.type('Boardroom');await pg.keyboard.press('Enter');await wf(pg,()=>window.__osp.byId('r1').name==='Boardroom');
  const o=await O(pg,'r1');const s1=await ST(pg);const ok=o.name==='Boardroom'&&JSON.stringify(o.pts)==='[[0,0],[5000,0],[5000,3500],[0,3500]]'&&await others(pg,s0,['r1']);const ur=await UR(pg,s0,s1);
  return {pass:ok&&ur.ok,detail:{name:o.name,ur}}});
// mutation [roomvx]: app.js:1140 `const P=drag.o.pts;P[R.iB]=pt(a,0);P[R.iD]=pt(0,b);P[drag...` → `const P=drag.o.pts;` + app.js:2889 `const P_=vh3.o.pts;P_[R.iB]=pt(a,0);P_[R.iD]=pt(0,bb);P_[...` → `const P_=vh3.o.pts` → FAIL confirmed (2D and 3D)
add(B,'b13-room-vertex','drag a room corner dot resizes the room and keeps it rectangular',async pg=>{
  await selectOne(pg,'r1');await pg.waitForTimeout(pg.d3?150:20);const s0=await ST(pg);const hy=pg.d3?3050:0;const a=await vhPt(pg,'r1',2,5000,3500,hy);if(!a)return {pass:false,detail:'no corner dot'};
  const b=pg.d3?await S3(pg,5500,4200,0):await (async()=>{const fa=await S2(pg,5000,3500),fb=await S2(pg,5500,4200);return [a[0]+fb[0]-fa[0],a[1]+fb[1]-fa[1]]})();await mdrag(pg,a,b,{steps:10});
  await wf(pg,()=>window.__osp.byId('r1').pts[2][0]!==5000);const o=await O(pg,'r1');const s1=await ST(pg);const P=o.pts;const t=pg.d3?100:50;
  const ok=P.length===4&&nearP(P[2],[5500,4200],t)&&nearP(P[0],[0,0],0)&&P[1][0]===P[2][0]&&P[1][1]===0&&P[3][1]===P[2][1]&&P[3][0]===0;const ur=await UR(pg,s0,s1);
  return {pass:ok&&ur.ok,detail:{pts:P,ur}}});
/* B14 */
// mutation [door]: app.js:1705 `else if(o.shape==='door')o.flip=!o.flip});clashDirty=true...` → `});clashDirty=true;render();renderInspector();return true}` → FAIL confirmed (2D and 3D)
add(B,'b14-door','X flips the door hinge, Shift+X flips the swing to the other side',async pg=>{
  await selectOne(pg,'dr1');const s0=await ST(pg);const d0=await O(pg,'dr1');await pg.keyboard.press('x');const a=await O(pg,'dr1');const sa=await ST(pg);const ura=await UR(pg,s0,sa);
  await pg.keyboard.press('Shift+X');const b=await O(pg,'dr1');const sb=await ST(pg);const urb=await UR(pg,s0,sb);
  const ok=!!a.flip!==!!d0.flip&&(a.r||0)===(d0.r||0)&&(b.r||0)===((d0.r||0)+180)%360&&!!b.flip!==!!d0.flip&&a.x===d0.x&&b.x===d0.x;
  return {pass:ok&&ura.ok&&urb.ok,detail:{d0:[d0.r,!!d0.flip],a:[a.r,!!a.flip],b:[b.r,!!b.flip],ura,urb}}});

/* ======================= C. Create ======================= */
/* create with a tool, check the new object, undo removes it, redo restores it */
async function created(pg,s0,want,{n=1}={}){
  await wf(pg,([s0,n])=>{const S=window.__osp.S();return JSON.stringify({o:S.objs,p:S.pins||[],s:S.section||null})!==s0&&S.objs.length>=JSON.parse(s0).o.length+n-(n?0:0)},[s0,n]);
  await pg.waitForTimeout(30);const nw=await newObjs(pg,s0);const s1=await ST(pg);const g=want(nw);const oth=await others(pg,s0,[]);const ur=await UR(pg,s0,s1);
  return {pass:!!g.ok&&oth&&ur.ok&&s1!==s0,detail:{...g,oth,ur,n:nw.length}}}
const bbox=pts=>{const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};
const nearB=(b,w,t=50)=>b.every((v,i)=>near(v,w[i],t));
/* rectangle-drag tools: room and shapes */
const TOL=pg=>pg.d3?60:50;
const startTool=async(pg,t)=>{if(t.startsWith('shape-'))await shapeTool(pg,t.slice(6));else await dockTool(pg,t);
  const cur=await ev(pg,()=>window.__osp.S&&document.querySelector('.dock .btn.on')&&document.querySelector('.dock .btn.on').dataset.tool);return cur};
const rectCheck=(t,check)=>async pg=>{
  await startTool(pg,t);const s0=await ST(pg);const a=await onEmpty(pg,8500,1500),b=await onEmpty(pg,11000,3000);await mdrag(pg,a,b,{steps:10});
  const r=await created(pg,s0,nw=>check(nw,pg));r.detail.in3D=await in3D(pg);if(pg.d3&&!r.detail.in3D)r.pass=false;return r};
const rectEsc=t=>async pg=>{
  await startTool(pg,t);const s0=await ST(pg);const a=await onEmpty(pg,8500,1500),b=await onEmpty(pg,11000,3000);
  await pg.mouse.move(a[0],a[1]);await pg.mouse.down();for(let i=1;i<=6;i++){await pg.mouse.move(a[0]+(b[0]-a[0])*i/6,a[1]+(b[1]-a[1])*i/6);await pg.waitForTimeout(12)}
  const live=await ev(pg,()=>window.__osp.dragM()==='rect'||(document.querySelector('#d3ov')&&document.querySelector('#d3ov').innerHTML.length>0));
  await pg.keyboard.press('Escape');await pg.mouse.up();await pg.waitForTimeout(60);const same=(await ST(pg))===s0;const tl=await tool(pg);
  return {pass:live&&same&&tl==='select',detail:{live,same,tool:tl}}};
/* C1 */
// mutation [room]: app.js:1240 `if(tool==='room'){const n=` → `if(tool==='room'){return;const n=` + app.js:811 `if(mode==='room'){const n=` → `if(mode==='room'){return;const n=` → FAIL confirmed (2D and 3D)
add(C,'c1-room','Room tool: drag a rectangle makes a 4-corner room of that size',rectCheck('room',nw=>{const o=nw[0]||{};const b=o.pts?bbox(o.pts):null;return {ok:nw.length===1&&o.t==='room'&&o.pts.length===4&&nearB(b,[8500,1500,11000,3000]),b}}));
// mutation [dragnull]: app.js:993 `typed='';tool=t;drag=null;` → `typed='';tool=t;` + app.js:784 `d3drag=null;if(T3&&T3.controls` → `if(T3&&T3.controls` → FAIL confirmed (2D and 3D)
add(C,'c1-room-esc','Room tool: Esc during the drag cancels, nothing is left',rectEsc('room'));
/* C2 / C3 / C5 / C8: click-point tools */
const clickPts=async(pg,pts)=>{for(const q of pts){const p=await onEmpty(pg,q[0],q[1]);await pg.mouse.move(p[0]-3,p[1]-3);await pg.mouse.move(p[0],p[1]);await pg.mouse.down();await pg.mouse.up();await pg.waitForTimeout(pg.d3?80:30)}};
const polyCheck=(t,pts,check)=>async pg=>{
  await startTool(pg,t);const s0=await ST(pg);await clickPts(pg,pts);const mid=await ev(pg,()=>(window.__osp.polyPts()||[]).length);await pg.keyboard.press('Enter');
  const r=await created(pg,s0,nw=>check(nw));r.detail.midPts=mid;r.detail.in3D=await in3D(pg);if(pg.d3&&!r.detail.in3D)r.pass=false;if(mid!==pts.length)r.pass=false;return r};
const polyEsc=(t,pts)=>async pg=>{
  await startTool(pg,t);const s0=await ST(pg);await clickPts(pg,pts);const mid=await ev(pg,()=>(window.__osp.polyPts()||[]).length);await pg.keyboard.press('Escape');await pg.waitForTimeout(60);
  const after=await ev(pg,()=>(window.__osp.polyPts()||[]).length);const same=(await ST(pg))===s0;const left=(await newObjs(pg,s0)).map(o=>[o.t,o.site||'',o.pts&&o.pts.length]);
  return {pass:mid===pts.length&&after===0&&same,detail:{mid,after,same,left,in3D:await in3D(pg)}}};
const P3=[[8500,1500],[10500,1500],[10500,3000]];
const ptsEq=(a,b,t=50)=>a&&a.length===b.length&&a.every((p,i)=>nearP(p,b[i],t));
// mutation [walls]: app.js:1345 `addObjs(out,false);sel=new Set([out[0].id]);` → `void(out,false);sel=new Set([out[0].id]);` → FAIL confirmed (2D and 3D)
add(C,'c2-walls','Walls tool: click three corners and Enter makes an open wall through them',polyCheck('poly',P3,nw=>{const o=nw[0]||{};return {ok:nw.length===1&&o.t==='wall'&&!o.site&&!o.spline&&!o.closed&&ptsEq(o.pts,P3)&&o.th>0,pts:o.pts}}));
// mutation: none — fails on the real build on every setup it runs (a finding), so there is no passing behaviour to break
add(C,'c2-walls-esc','Walls tool: Esc half-way through a wall cancels it, nothing is left',polyEsc('poly',P3.slice(0,2)));
// mutation [spline]: app.js:1343 `if(tool==='spline')out[0].spline=true;` → `(removed)` → FAIL confirmed (2D and 3D)
add(C,'c3-curve','Curve tool: click three points and Enter makes a curved wall through them',polyCheck('spline',P3,nw=>{const o=nw[0]||{};return {ok:nw.length===1&&o.t==='wall'&&o.spline===true&&ptsEq(o.pts,P3),pts:o.pts}}));
// mutation: none — fails on the real build on every setup it runs (a finding), so there is no passing behaviour to break
add(C,'c3-curve-esc','Curve tool: Esc half-way cancels the curve',polyEsc('spline',P3.slice(0,2)));
/* C4 shapes */
const shapeOk=(kind)=>nw=>{const o=nw[0]||{};return {ok:nw.length===1&&o.t==='item'&&o.code==='CUSTOM'&&o.shape===kind&&near(o.w,2500)&&near(o.d,1500)&&near(o.x,9750)&&near(o.y,2250),got:[o.shape,o.w,o.d,o.x,o.y]}};
// mutation [shaperect]: app.js:1241 `else{const kind=tool.slice(6);` → `else{return;const kind=tool.slice(6);` + app.js:812 `else{const kind=mode.slice(6);` → `else{return;const kind=mode.slice(6);` → FAIL confirmed (2D and 3D)
add(C,'c4-rect','Shape › Rectangle: drag makes a custom rectangle of that size',rectCheck('shape-rect',shapeOk('rect')));
// mutation [shapekind]: app.js:2494 `shapeKind=b.dataset.shape;setTool('shape-'+shapeKind)` → `shapeKind='rect';setTool('shape-rect')` → FAIL confirmed (2D and 3D)
add(C,'c4-round','Shape › Circle or oval: drag makes a round shape of that size',rectCheck('shape-round',shapeOk('round')));
// mutation [shapekind]: app.js:2494 `shapeKind=b.dataset.shape;setTool('shape-'+shapeKind)` → `shapeKind='rect';setTool('shape-rect')` → FAIL confirmed (2D and 3D)
add(C,'c4-L','Shape › L-shape: drag makes an L-shape of that size',rectCheck('shape-L',shapeOk('L')));
// mutation [dragnull]: app.js:993 `typed='';tool=t;drag=null;` → `typed='';tool=t;` + app.js:784 `d3drag=null;if(T3&&T3.controls` → `if(T3&&T3.controls` → FAIL confirmed (2D and 3D)
add(C,'c4-rect-esc','Shape › Rectangle: Esc during the drag cancels',rectEsc('shape-rect'));
const PP=[[8500,1500],[11000,1500],[9750,3500]];
// mutation [polygon]: app.js:1348 `addObjs([{id:uid(),t:'item',code:'CUSTOM',name:'Custom po...` → `void([{id:uid(),t:'item',code:'CUSTOM',name:'Custom polygon'` → FAIL confirmed (2D and 3D)
add(C,'c4-poly','Shape › Polygon: click three corners and click the first again closes a polygon',async pg=>{
  await startTool(pg,'shape-poly');const s0=await ST(pg);await clickPts(pg,PP.concat([PP[0]]));
  if(pg.d3&&(await ev(pg,()=>window.__osp.S().objs.length))===JSON.parse(s0).o.length){await pg.keyboard.press('Enter')}
  const r=await created(pg,s0,nw=>{const o=nw[0]||{};const pts=o.pts?o.pts.map(p=>[p[0]+o.x,p[1]+o.y]):null;return {ok:nw.length===1&&o.shape==='poly'&&ptsEq(pts,PP),pts}});r.detail.in3D=await in3D(pg);if(pg.d3&&!r.detail.in3D)r.pass=false;return r});
// mutation [polyclear]: app.js:991 `if(t!=='poly'&&t!=='spline'&&t!=='road'&&t!=='fence'&&t!=...` → `if(false)polyPts=null;` → FAIL confirmed (2D and 3D)
add(C,'c4-poly-esc','Shape › Polygon: Esc half-way leaves no shape',async pg=>{await startTool(pg,'shape-poly');const s0=await ST(pg);await clickPts(pg,PP.slice(0,2));const mid=await ev(pg,()=>(window.__osp.polyPts()||[]).length);
  await pg.keyboard.press('Escape');await pg.waitForTimeout(60);const after=await ev(pg,()=>(window.__osp.polyPts()||[]).length);const same=(await ST(pg))===s0;return {pass:mid===2&&after===0&&same&&(await tool(pg))==='select',detail:{mid,after,same}}});
/* C5 */
const P2=[[8500,1500],[11500,1500]];
// mutation [site]: app.js:1338 `const site=tool,o={` → `const site=tool,addObjs=()=>{},o={` → FAIL confirmed (2D and 3D)
add(C,'c5-road','Road tool: two clicks and Enter makes a 6 m road along them',polyCheck('road',P2,nw=>{const o=nw[0]||{};return {ok:nw.length===1&&o.t==='wall'&&o.site==='road'&&o.th===6000&&ptsEq(o.pts,P2),pts:o.pts}}));
// mutation [site]: app.js:1338 `const site=tool,o={` → `const site=tool,addObjs=()=>{},o={` → FAIL confirmed (2D and 3D)
add(C,'c5-fence','Fence tool: three clicks and Enter makes a 2.4 m fence through them',polyCheck('fence',P3,nw=>{const o=nw[0]||{};return {ok:nw.length===1&&o.t==='wall'&&o.site==='fence'&&o.h===2400&&ptsEq(o.pts,P3),pts:o.pts}}));
// mutation [escpoly]: app.js:2656 `if(polyTool()&&polyPts&&polyPts.length){finishPoly(false);` → `if(polyTool()&&polyPts&&polyPts.length){polyPts.push(poly...` → FAIL confirmed (2D and 3D)
add(C,'c5-road-esc','Road tool: Esc after the first point cancels the road',polyEsc('road',P2.slice(0,1)));
/* C6 */
// mutation [measure]: app.js:1244 `if(d.m==='measure'){if(Math.hypot(d.b[0]-d.a[0],d.b[1]-d....` → `if(d.m==='measure'){if(Math.hypot(d.b[0]-d.a[0],d.b[1]-d....` + app.js:2908 `if(d.mode==='measure'){if(Math.hypot(d.b[0]-d.a[0],d.b[1]...` → `if(d.mode==='measure'){if(Math.hypot(d.b[0]-d.a[0],d.b[1]...` → FAIL confirmed (2D and 3D)
add(C,'c6-measure','Measure tool: drag between two points makes a dimension',async pg=>{
  await startTool(pg,'measure');const s0=await ST(pg);const a=await onEmpty(pg,8500,4200),b=await onEmpty(pg,11500,4200);await mdrag(pg,a,b,{steps:10});
  const r=await created(pg,s0,nw=>{const o=nw[0]||{};return {ok:nw.length===1&&o.t==='dim'&&nearP(o.a,[8500,4200],TOL(pg))&&nearP(o.b,[11500,4200],TOL(pg)),a:o.a,b:o.b}});r.detail.in3D=await in3D(pg);if(pg.d3&&!r.detail.in3D)r.pass=false;return r});
// mutation [dragnull]: app.js:993 `typed='';tool=t;drag=null;` → `typed='';tool=t;` + app.js:784 `d3drag=null;if(T3&&T3.controls` → `if(T3&&T3.controls` → FAIL confirmed (2D and 3D)
add(C,'c6-measure-esc','Measure tool: Esc during the drag cancels',async pg=>{
  await startTool(pg,'measure');const s0=await ST(pg);const a=await onEmpty(pg,8500,4200),b=await onEmpty(pg,11500,4200);await pg.mouse.move(a[0],a[1]);await pg.mouse.down();for(let i=1;i<=5;i++){await pg.mouse.move(a[0]+(b[0]-a[0])*i/5,a[1]);await pg.waitForTimeout(12)}
  await pg.keyboard.press('Escape');await pg.mouse.up();await pg.waitForTimeout(60);const same=(await ST(pg))===s0;const tl=await tool(pg);return {pass:same&&tl==='select',detail:{same,tool:tl}}});
/* C7 */
// mutation [text]: app.js:1082 `gid:null};addObjs([o],true);setTool('select');showTab('se...` → `gid:null};void([o],true);setTool('select');showTab('sel')...` → FAIL confirmed (2D; 3D is a parity gap)
add(C,'c7-text','Text tool: click places a label and puts the cursor in its text field',async pg=>{
  await startTool(pg,'text');const s0=await ST(pg);const p=await onEmpty(pg,9500,4200);await click(pg,p);
  const r=await created(pg,s0,nw=>{const o=nw[0]||{};return {ok:nw.length===1&&o.t==='text'&&o.text==='Label'&&nearP([o.x,o.y],[9500,4200]),at:[o.x,o.y]}});r.detail.in3D=await in3D(pg);if(pg.d3&&!r.detail.in3D)r.pass=false;return r});
/* C8 */
// mutation [trunk]: app.js:1341 `drop:30,gid:null};addObjs([o],false)` → `drop:30,gid:null};void([o],false)` → FAIL confirmed (2D; 3D is a parity gap)
add(C,'c8-trunk','Trunk tool: click three points and Enter makes a ceiling trunk run',polyCheck('trunk',P3,nw=>{const o=nw[0]||{};return {ok:nw.length===1&&o.t==='trunk'&&o.w===150&&ptsEq(o.pts,P3),pts:o.pts}}));
// mutation: none — fails on the real build on every setup it runs (a finding), so there is no passing behaviour to break
add(C,'c8-trunk-esc','Trunk tool: Esc half-way cancels the run',polyEsc('trunk',P3.slice(0,2)));
/* C9 */
// mutation [section]: app.js:1245 `S.section={a:d.a,b:d.b,on:true,flip:!!(S.section&&S.secti...` → `markDirty();setTool` + app.js:2909 `S.section={a:d.a,b:d.b,on:true,flip:!!(S.section&&S.secti...` → `markDirty();sectionApply()` → FAIL confirmed (2D and 3D)
add(C,'c9-section','Section tool: drag across the plan sets a section line; undo removes it',async pg=>{
  await startTool(pg,'section');const s0=await ST(pg);const a=await onEmpty(pg,8500,4200),b=await onEmpty(pg,11500,4200);await mdrag(pg,a,b,{steps:10});
  await wf(pg,()=>!!window.__osp.S().section);const sec=await ev(pg,()=>window.__osp.S().section||null);const s1=await ST(pg);const t=TOL(pg);
  const ok=!!sec&&sec.on===true&&nearP(sec.a,[8500,4200],t)&&nearP(sec.b,[11500,4200],t)&&JSON.parse(s1).o.length===JSON.parse(s0).o.length;const ur=await UR(pg,s0,s1);
  return {pass:ok&&ur.ok&&(!pg.d3||await in3D(pg)),detail:{sec,ur}}});
// mutation [dragnull]: app.js:993 `typed='';tool=t;drag=null;` → `typed='';tool=t;` + app.js:784 `d3drag=null;if(T3&&T3.controls` → `if(T3&&T3.controls` → FAIL confirmed (2D and 3D)
add(C,'c9-section-esc','Section tool: Esc during the drag cancels',async pg=>{
  await startTool(pg,'section');const s0=await ST(pg);const a=await onEmpty(pg,8500,4200),b=await onEmpty(pg,11500,4200);await pg.mouse.move(a[0],a[1]);await pg.mouse.down();for(let i=1;i<=5;i++){await pg.mouse.move(a[0]+(b[0]-a[0])*i/5,a[1]);await pg.waitForTimeout(12)}
  await pg.keyboard.press('Escape');await pg.mouse.up();await pg.waitForTimeout(60);const same=(await ST(pg))===s0;return {pass:same&&(await tool(pg))==='select',detail:{same}}});
/* C10 */
// mutation [pin]: app.js:1075 `S.pins.push(pin);` → `void 0;` → FAIL confirmed (2D; 3D is a parity gap)
add(C,'c10-pin','Pin tool: click drops a pin there and opens its note; undo removes it',async pg=>{
  await startTool(pg,'pin');const s0=await ST(pg);const p=await onEmpty(pg,9500,4200);await click(pg,p);await wf(pg,()=>(window.__osp.pins()||[]).length===1);
  const pins=await ev(pg,()=>JSON.parse(JSON.stringify(window.__osp.pins()||[])));const note=await ev(pg,()=>!document.querySelector('#p-notes').hidden);await blur(pg);const s1=await ST(pg);
  const ok=pins.length===1&&nearP([pins[0].x,pins[0].y],[9500,4200])&&note;const ur=s1!==s0?await UR(pg,s0,s1):{ok:false};return {pass:ok&&ur.ok&&(!pg.d3||await in3D(pg)),detail:{pins,note,ur,in3D:await in3D(pg)}}});
/* C7 / C10 Esc: picking the tool then Esc leaves Select with nothing added */
// mutation [esctool]: app.js:2659 `else if(tool!=='select')setTool('select');else{` → `else if(false)setTool('select');else{` → FAIL confirmed (2D; 3D is a parity gap)
add(C,'c7-c10-esc','Text and Pin tools: Esc before clicking returns to Select, nothing is added',async pg=>{
  const s0=await ST(pg);const res={};for(const t of ['text','pin']){await startTool(pg,t);const on=await tool(pg);await pg.keyboard.press('Escape');await pg.waitForTimeout(40);res[t]=[on,await tool(pg)]}
  const same=(await ST(pg))===s0;return {pass:same&&res.text[0]==='text'&&res.text[1]==='select'&&res.pin[0]==='pin'&&res.pin[1]==='select'&&(!pg.d3||await in3D(pg)),detail:{res,same,in3D:await in3D(pg)}}});
/* C11 */
const libPick=async(pg,re)=>{if(await ev(pg,()=>document.querySelector('#d-lib').hidden))await pg.click('#t-lib');await wf(pg,()=>!document.querySelector('#d-lib').hidden&&document.querySelectorAll('#lib-list .lib-row').length>0);
  const i=await ev(pg,re=>[...document.querySelectorAll('#lib-list .lib-row')].findIndex(x=>new RegExp(re).test(x.textContent)),re);if(i<0)throw new Error('no library row '+re);
  await pg.locator('#lib-list .lib-row').nth(i).scrollIntoViewIfNeeded();await pg.locator('#lib-list .lib-row').nth(i).click();await pg.waitForTimeout(40)};
// mutation [place]: app.js:1071 `drag={m:'arr',gh,a:w,b:w,sx:ev.clientX,sy:ev.clientY,move...` → `return}` + app.js:2945 `const gh=ghostAt(p,e.altKey);addObjs(gh.objs,false);return}` → `const gh=ghostAt(p,e.altKey);void(gh.objs,false);return}` → FAIL confirmed (2D and 3D)
add(C,'c11-place','Library: pick a desk, click places it, R rotates the next one, Esc stops placing',async pg=>{
  await libPick(pg,'^Workstation 1200 x 600');const s0=await ST(pg);const a=await onEmpty(pg,9500,6400);await click(pg,a);
  await wf(pg,n=>window.__osp.S().objs.length===n+1,JSON.parse(s0).o.length);const n1=await newObjs(pg,s0);const s1=await ST(pg);
  await pg.keyboard.press('r');const b=await onEmpty(pg,11000,6400);await pg.mouse.move(b[0]-4,b[1]);await pg.mouse.move(b[0],b[1]);await click(pg,b);await wf(pg,n=>window.__osp.S().objs.length===n+2,JSON.parse(s0).o.length);
  const n2=(await newObjs(pg,s1));const s2=await ST(pg);await pg.keyboard.press('Escape');await pg.waitForTimeout(40);const tl=await tool(pg);const c=await onEmpty(pg,11000,3000);await click(pg,c);await pg.waitForTimeout(60);const s3=await ST(pg);
  const A=n1[0]||{},Bo=n2[0]||{};const t=TOL(pg);
  const ok=n1.length===1&&A.code==='WS1260'&&A.r===0&&nearP([A.x,A.y],[9500,6400],t)&&n2.length===1&&Bo.code==='WS1260'&&Bo.r===90&&nearP([Bo.x,Bo.y],[11000,6400],t)&&tl==='select'&&s3===s2;
  await blur(pg);await pg.keyboard.press('Control+z');const u1=await stIs(pg,s1);const ur=await UR(pg,s0,s1);
  return {pass:ok&&u1&&ur.ok&&(!pg.d3||await in3D(pg)),detail:{A:[A.code,A.x,A.y,A.r],B:[Bo.code,Bo.x,Bo.y,Bo.r],tool:tl,stopped:s3===s2,u1,ur}}});
/* C12 */
// mutation [arrrow]: app.js:1232 `const list=d.moved?arrCopies(d).flat():d.gh.objs;` → `const list=d.gh.objs;` → FAIL confirmed (2D; 3D is a parity gap)
add(C,'c12-array-row','Library: press and drag a single desk lays out an editable row; Details › Rows 2 doubles it',async pg=>{
  await libPick(pg,'^Workstation 1200 x 600');const s0=await ST(pg);const a=await onEmpty(pg,8500,1500),b=await onEmpty(pg,11500,1500);await mdrag(pg,a,b,{steps:12});
  await wf(pg,n=>window.__osp.S().objs.length>n+1,JSON.parse(s0).o.length,5000);const nw=await newObjs(pg,s0);const s1=await ST(pg);
  const xs=nw.map(o=>o.x).sort((p,q)=>p-q),arr=nw[0]&&nw[0].arr;const pitch=xs.length>1?xs[1]-xs[0]:0;
  const okRow=nw.length>=3&&!!arr&&nw.every(o=>o.arr&&o.arr.id===arr.id&&o.y===nw[0].y&&o.code==='WS1260')&&xs.every((x,i)=>!i||x-xs[i-1]===pitch)&&pitch===arr.w+arr.gx&&arr.cols===nw.length;
  if(!okRow)return {pass:false,detail:{n:nw.length,arr:!!arr,note:'dragging did not lay out an array row'}};
  await pg.keyboard.press('Escape');await pg.waitForTimeout(40);const sx=nw.sort((p,q)=>p.x-q.x)[0];PT[sx.id]=[sx.x,sx.y,730];await selectOne(pg,sx.id);
  /* the user opens Details if they had closed it (selection does not force the drawer open) */if(await ev(pg,()=>document.querySelector('#d-insp').hidden))await pg.click('#t-insp');const f='#p-sel [data-arrf="rows"]';let edited=null;let refill=0;if(await wf(pg,s=>!!document.querySelector(s),f,5000)){await pg.waitForTimeout(120);await pg.fill(f,'2');while(refill<2&&(await ev(pg,f=>document.querySelector(f).value,f))!=='2'){refill++;await pg.waitForTimeout(150);await pg.fill(f,'2')}await pg.press(f,'Enter');await blur(pg);await wf(pg,n=>window.__osp.S().objs.length>=n,JSON.parse(s1).o.length+nw.length);
    edited=await ev(pg,id=>{const S=window.__osp.S();return S.objs.filter(o=>o.arr&&o.arr.id===id).length},arr.id)}
  const s2=await ST(pg);await pg.keyboard.press('Control+z');const u1=await stIs(pg,s1);const ur=await UR(pg,s0,s1);
  return {pass:okRow&&edited===nw.length*2&&u1&&ur.ok&&(!pg.d3||await in3D(pg)),detail:{refill,n:nw.length,pitch,arr:arr&&[arr.cols,arr.w,arr.gx],edited,u1,ur}}});
// mutation [arrset]: app.js:948 `ny=1+Math.floor(Math.abs(dy)/pd+0.15)` → `ny=1` → FAIL confirmed (2D; 3D is a parity gap)
add(C,'c12-array-set','Library: press and drag a workstation set downwards repeats rows at desk depth + 1.2 m',async pg=>{
  await libPick(pg,'^Workstation set 1200');const s0=await ST(pg);const a=await onEmpty(pg,9000,300),b=await onEmpty(pg,9000,6200);await mdrag(pg,a,b,{steps:14});
  await wf(pg,n=>window.__osp.S().objs.length>n+3,JSON.parse(s0).o.length,5000);const nw=await newObjs(pg,s0);const s1=await ST(pg);
  const desks=nw.filter(o=>/^WS\d/.test(o.code));const ys=[...new Set(desks.map(o=>o.y))].sort((p,q)=>p-q);const ok=ys.length>=2&&desks[0]&&ys[1]-ys[0]===desks[0].d+1200&&nw.every(o=>o.arr&&o.arr.set);
  await pg.keyboard.press('Escape');const ur=await UR(pg,s0,s1);return {pass:ok&&ur.ok&&(!pg.d3||await in3D(pg)),detail:{rows:ys.length,pitch:ys[1]-ys[0],want:desks[0]&&desks[0].d+1200,ur}}});
/* C13 */
// mutation [colarr]: app.js:1465 `if(l.length===1&&!l[0].arr){makeColArray(l[0],rows,cols,g...` → `if(l.length===1&&!l[0].arr){return;}` → FAIL confirmed (2D and 3D)
add(C,'c13-col-array','Details › Repeat as an array: a column becomes a 2 × 3 grid at size + gap',async pg=>{
  await selectOne(pg,'col1');const s0=await ST(pg);const F=s=>`#p-sel #${s}`;if(!(await wf(pg,s=>!!document.querySelector(s),F('ar-r'),5000)))return {pass:false,detail:'no array fields'};
  await pg.fill(F('ar-r'),'2');await pg.fill(F('ar-c'),'3');await pg.fill(F('ar-gx'),'1000');await pg.fill(F('ar-gy'),'2000');await pg.click('#p-sel [data-act="array"]');
  await wf(pg,()=>!window.__osp.byId('col1'));const cols=await ev(pg,()=>JSON.parse(JSON.stringify(window.__osp.S().objs.filter(o=>o.code==='C400'))));const s1=await ST(pg);
  const xs=[...new Set(cols.map(o=>o.x))].sort((a,b)=>a-b),ys=[...new Set(cols.map(o=>o.y))].sort((a,b)=>a-b);
  const ok=cols.length===6&&xs.length===3&&ys.length===2&&xs[0]===6500&&xs[1]-xs[0]===1400&&xs[2]-xs[1]===1400&&ys[0]===7500&&ys[1]-ys[0]===2400&&cols.every(o=>o.arr&&o.arr.id===cols[0].arr.id);const ur=await UR(pg,s0,s1);
  return {pass:ok&&ur.ok,detail:{n:cols.length,xs,ys,ur}}});
/* C14 */
// mutation [rooms]: app.js:2339 `addObjs(rooms,false);toast(` → `void(rooms,false);toast(` → FAIL confirmed (2D and 3D)
add(C,'c14-rooms','More › Make rooms from walls fills the closed wall box with one room',async pg=>{
  const s0=await ST(pg);await pg.click('#b-more');await wf(pg,()=>!document.querySelector('#pop-more').hidden);await pg.click('#m-rooms');
  const r=await created(pg,s0,nw=>{const rooms=nw.filter(o=>o.t==='room');const b=rooms[0]&&bbox(rooms[0].pts);return {ok:rooms.length===1&&nw.length===1&&rooms[0].nowall&&!!b&&b[0]>=5800&&b[2]<=7300&&b[1]>=0&&b[3]<=2500&&(b[2]-b[0])>=1300&&(b[3]-b[1])>=2300,b}});
  r.detail.in3D=await in3D(pg);if(pg.d3&&!r.detail.in3D)r.pass=false;return r});
/* C15 paint */
const paintStart=async pg=>{await dockTool(pg,'paint');const sw='#p-sel [data-paintc="#1f2226"]';if(!(await wf(pg,s=>!!document.querySelector(s),sw,5000)))throw new Error('no paint swatch: tool '+(await tool(pg))+', 3D '+(await in3D(pg)));await pg.click(sw);
  if((await ev(pg,()=>window.__osp.P().paintCol))!=='#1f2226')throw new Error('swatch not picked')};
// mutation [pitem]: app.js:1001 `if(o.t==='item'){o.col=col;if(o.faces)delete o.faces;retu...` → `if(o.t==='item'){return true}` + app.js:2941 `else{o.col=P.paintCol;if(o.faces)delete o.faces}}markDirty()` → `else{}}markDirty()` → FAIL confirmed (2D and 3D)
add(C,'c15-paint-item','Paint: pick a swatch, click a desk paints the whole desk',async pg=>{
  await paintStart(pg);const s0=await ST(pg);const p=await onObj(pg,'d1',1000,800,730);await click(pg,p);await wf(pg,()=>window.__osp.byId('d1').col==='#1f2226');
  const o=await O(pg,'d1');const s1=await ST(pg);const ok=o.col==='#1f2226'&&!o.faces&&await others(pg,s0,['d1']);const ur=await UR(pg,s0,s1);return {pass:ok&&ur.ok,detail:{col:o.col,ur}}});
// mutation [pfloor]: app.js:1001 `if(wallMode)o.wallCol=col;else o.floorCol=col;return true` → `if(wallMode)o.wallCol=col;else void 0;return true` + app.js:2941 `else if(kind==='floor')o.floorCol=P.paintCol;` → `else if(kind==='floor')void 0;` → FAIL confirmed (2D and 3D)
add(C,'c15-paint-floor','Paint: click a room floor paints that floor',async pg=>{
  await paintStart(pg);const s0=await ST(pg);const p=await onObj(pg,'r1',2500,3000,0,pg.d3?'floor':null);const pr=pg.d3?await probe(pg,p):null;await click(pg,p);await wf(pg,()=>window.__osp.byId('r1').floorCol==='#1f2226');
  const o=await O(pg,'r1');const s1=await ST(pg);const ok=o.floorCol==='#1f2226'&&!o.wallCol&&await others(pg,s0,['r1']);const ur=await UR(pg,s0,s1);return {pass:ok&&ur.ok,detail:{floorCol:o.floorCol,wallCol:o.wallCol,ur,pr}}});
// mutation [pwall]: app.js:1001 `if(o.t==='wall'){o.col=col;return true}` → `if(o.t==='wall'){return true}` + app.js:2941 `if(kind==='wall'){if(o.t==='wall')o.col=P.paintCol;else` → `if(kind==='wall'){if(o.t==='wall')void 0;else` → FAIL confirmed (2D and 3D)
add(C,'c15-paint-wall','Paint: click a wall paints the wall (3D: its face)',async pg=>{
  await paintStart(pg);const s0=await ST(pg);const p=pg.d3?await (async()=>{const q=await S3(pg,5200,5500,1400);const id=await pick3(pg,q);if(id!=='w2')throw new Error('wall face point hits '+id);return q})():await onObj(pg,'w2',5200,5500);
  await click(pg,p);await wf(pg,()=>window.__osp.byId('w2').col==='#1f2226');const o=await O(pg,'w2');const s1=await ST(pg);const ok=o.col==='#1f2226'&&await others(pg,s0,['w2']);const ur=await UR(pg,s0,s1);
  return {pass:ok&&ur.ok,detail:{col:o.col,ur}}});

/* ======================= 3D-only ======================= */
const D3=[];
// mutation [ppart]: app.js:2938 `o.faces=o.faces||{};o.faces[fi]=P.paintCol;` → `o.faces=o.faces||{};` → FAIL confirmed (3D)
add(D3,'c15-paint-part','Paint one part only (3D): clicking a desk paints just the part under the pointer',async pg=>{
  await paintStart(pg);const cb='#p-sel [data-paintface]';await pg.check(cb);const on=await ev(pg,()=>!!window.__osp.P().paintFace);const s0=await ST(pg);
  const p=await onObj(pg,'d1',1000,800,730);await click(pg,p);await wf(pg,()=>{const o=window.__osp.byId('d1');return o.faces&&Object.keys(o.faces).length>0});const o=await O(pg,'d1');const s1=await ST(pg);
  const ok=on&&!!o.faces&&Object.values(o.faces).length===1&&Object.values(o.faces)[0]==='#1f2226'&&!o.col;const ur=await UR(pg,s0,s1);return {pass:ok&&ur.ok,detail:{on,faces:o.faces,col:o.col,ur}}});

/* ---------- runner ---------- */
async function group(b,{d3,prefix,lists,R}){
  const all=lists.flat().map(c=>Object.assign({},c,{id:prefix+c.key}));const todo=all.filter(c=>!ONLY||ONLY.test(c.id));if(!todo.length)return;
  const label=d3?'desktop 3D: ':'desktop 2D: ';let pg;
  try{pg=await setup(b,{d3})}catch(e){todo.forEach(c=>R.push(row(c.id,label+c.name,false,'setup failed: '+String(e.message||e).slice(0,200))));if(pg&&pg.ctx)await pg.ctx.close();return}
  for(const c of todo){let r;const t0=Date.now();try{await reset(pg);r=await c.fn(pg)}catch(e){r={pass:false,detail:'error: '+String(e.message||e).slice(0,300)}}if(process.env.MX_EC_STREAM)console.log('ROW',r.pass?'PASS':'FAIL',c.id,((Date.now()-t0)/1000).toFixed(1)+'s',JSON.stringify(r.detail).slice(0,400));R.push(row(c.id,label+c.name,r.pass,r.detail))}
  R.push(row(prefix+'clean',label+'edit / create checks left no console errors',pg.errs.length===0,pg.errs.slice(0,5)));
  await pg.ctx.close()}
export async function run(b){const R=[];
  await group(b,{d3:false,prefix:'mx-ec-d2-',lists:[B,C],R});
  await group(b,{d3:true,prefix:'mx-ec-d3-',lists:[B,C,D3],R});
  return R}
