/* matrix slice: the 3D view on desktop (mouse) and phone (touch). Rule under test: whatever a user can do in 2D must also work in 3D. */
import {openApp,row,to3D,to2D,touch} from '../../lib.mjs';
export const name='view3d';

/* ---- in-page helpers, installed once per page ---- */
const HELPERS=`(()=>{
 const o=window.__osp,q=s=>document.querySelector(s);
 const rect=()=>q('#v3c').getBoundingClientRect();
 const ray=(x,y)=>{const T=o.T3(),r=rect();const rc=new T.THREE.Raycaster();rc.setFromCamera(new T.THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),T.camera);return rc.intersectObjects(T.group.children,true)};
 const owner=h=>{let m=h.object;while(m&&!m.userData.id&&!m.userData.paint)m=m.parent;return m};
 const ownerId=h=>{let m=h.object;while(m&&!m.userData.id)m=m.parent;return m};
 const firstId=(x,y)=>{for(const h of ray(x,y)){const m=ownerId(h);if(m)return m.userData.id}return null};
 const onCanvas=(x,y)=>{const r=rect();return x>r.left+4&&x<r.right-4&&y>r.top+4&&y<r.bottom-4&&document.elementFromPoint(x,y)===q('#v3c')};
 const proj=(wx,wy,wz)=>{const T=o.T3(),r=rect();const v=new T.THREE.Vector3(wx*.001,wz*.001,wy*.001).project(T.camera);return [r.left+(v.x*.5+.5)*r.width,r.top+(-v.y*.5+.5)*r.height]};
 const cam=(cx,cz,d,tilt)=>{const T=o.T3();tilt=tilt==null?0.35:tilt;T.controls.target.set(cx*.001,0,cz*.001);T.camera.position.set(cx*.001+d*tilt*0.5,d,cz*.001+d*tilt);T.camera.updateMatrixWorld(true);T.controls.update();T.camera.updateMatrixWorld(true);T.need=true;T.last=performance.now()};
 const itemPt=it=>{for(const f of [0.5,0.9,0.3]){const p=proj(it.x,it.y,Math.min(it.h||700,900)*f);if(onCanvas(p[0],p[1])&&firstId(p[0],p[1])===it.id)return p}return null};
 const cands=()=>o.S().objs.filter(x=>x.t==='item'&&!x.site&&!/^door|^win|lift|stair/.test(x.shape||'')&&x.w>=350&&x.d>=350);
 const pair=d=>{const C=cands();for(const A of C.slice(0,80)){for(const B of C){if(B===A||(A.gid&&A.gid===B.gid))continue;const dist=Math.hypot(A.x-B.x,A.y-B.y);if(dist<1000||dist>2300)continue;
   cam((A.x+B.x)/2,(A.y+B.y)/2,d);const a=itemPt(A),b=itemPt(B);if(a&&b&&Math.hypot(a[0]-b[0],a[1]-b[1])>60)return {a:A.id,b:B.id,mid:[(A.x+B.x)/2,(A.y+B.y)/2],d}}}return null};
 const ptOf=id=>{const it=o.byId(id);return it?itemPt(it):null};
 const scan=(pred)=>{const r=rect();for(let y=r.top+20;y<r.bottom-20;y+=18)for(let x=r.left+20;x<r.right-20;x+=18){if(!onCanvas(x,y))continue;const id=firstId(x,y);const it=id?o.byId(id):null;if(pred(id,it,x,y))return [x,y]}return null};
 const emptyPt=()=>scan(id=>id===null);
 const nonItemPt=()=>scan((id,it)=>!it||it.t!=='item');
 const meshOf=id=>{let f=null;o.T3().group.traverse(c=>{if(!f&&c.userData&&c.userData.id===id&&c.parent===o.T3().group)f=c});return f?{x:Math.round(f.position.x/.001),z:Math.round(f.position.z/.001),ry:+f.rotation.y.toFixed(3)}:null};
 const nMesh=()=>{let n=0;o.T3().group.children.forEach(c=>{if(c.userData&&c.userData.id)n++});return n};
 const camState=()=>{const T=o.T3();return {p:T.camera.position.toArray().map(v=>+v.toFixed(3)),t:T.controls.target.toArray().map(v=>+v.toFixed(3)),dist:+T.camera.position.distanceTo(T.controls.target).toFixed(3)}};
 const live=()=>({d3:o.d3Active(),polyPts:(o.polyPts()||[]).length,dock:(q('.dock .btn.on')||{dataset:{}}).dataset.tool,esc:(()=>{const e=q('#esc');return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'})(),walk:o.WALK.on,bld:!!o.bldView(),sun:!!o.SUN().on});
 const snap=()=>JSON.stringify(o.S().objs);
 const geom=sel=>{const e=q(sel);if(!e)return null;const why=()=>{let n=e,out=[];while(n&&n!==document.body){const cs=getComputedStyle(n);if(n.hidden||cs.display==='none')out.push((n.id||n.className||n.tagName)+(n.hidden?'[hidden]':'[display:none]'));n=n.parentElement}return out.join('<')};if(e.hidden||getComputedStyle(e).display==='none')return {hidden:true,why:why()};e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();if(r.width===0)return {hidden:true,why:'zero width '+why()};const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);return {x,y,ok:!!t&&(t===e||e.contains(t)),by:t?(t.id||t.className||t.tagName):null}};
 const floor=(x,y)=>{const T=o.T3(),r=rect();const rc=new T.THREE.Raycaster();rc.setFromCamera(new T.THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),T.camera);const v=new T.THREE.Vector3();return rc.ray.intersectPlane(new T.THREE.Plane(new T.THREE.Vector3(0,1,0),0),v)?[v.x/.001,v.z/.001]:null};
 window.__h={floor,ray,firstId,onCanvas,proj,cam,itemPt,pair,ptOf,scan,emptyPt,nonItemPt,meshOf,nMesh,camState,live,snap,geom,rect:()=>{const r=rect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}};
})()`;

const SLOW=async(label,p)=>{if(!process.env.VT)return p;const t0=Date.now();const r=await p;const dt=Date.now()-t0;if(dt>700)console.error('    slow '+label+' '+dt+'ms');return r};
const ev=(pg,fn,arg)=>SLOW('ev '+fn.toString().slice(0,60),pg.evaluate(fn,arg));
const H=(pg,fn,arg)=>SLOW('H '+fn.toString().slice(0,60),pg.evaluate(([f,a])=>new Function('h','o','a','return ('+f+')(h,o,a)')(window.__h,window.__osp,a),[fn.toString(),arg]));
const nObjs=pg=>ev(pg,()=>window.__osp.S().objs.length);
const RE=process.env.SB_ONLY_IDS?new RegExp(process.env.SB_ONLY_IDS):null;
/* condition wait (≤ ms); resolves true/false, never throws */
const W=(pg,fn,arg,ms=3000)=>pg.waitForFunction(fn,arg===undefined?null:arg,{timeout:ms,polling:40}).then(()=>true,()=>false);
/* every object as JSON keyed by id, and what changed between two of those */
const objMap=pg=>ev(pg,()=>Object.fromEntries(window.__osp.S().objs.map(o=>[o.id,JSON.stringify(o)])));
function delta(a,b){const add=[],rem=[],chg=[];for(const k in b){if(!(k in a))add.push(k);else if(a[k]!==b[k])chg.push(k)}for(const k in a)if(!(k in b))rem.push(k);return {add,rem,chg}}
const same_=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const isNone=d=>!d.add.length&&!d.rem.length&&!d.chg.length;
const dsum=d=>({add:d.add.length,rem:d.rem.length,chg:d.chg.length});
const grpOf=(pg,id)=>ev(pg,id=>{const S=window.__osp.S(),o=S.objs.find(x=>x.id===id);return o.gid?S.objs.filter(x=>x.gid===o.gid).map(x=>x.id):[id]},id);
const sel=pg=>ev(pg,()=>window.__osp.sel());
const DRAW3D=['room','poly','spline','road','fence','trunk','measure','text','section','pin','shape-rect','shape-round','shape-L','shape-poly'];
/* every drawing tool now works in 3D (trunk, text and pin joined after 4.5.0); a tool listed here would be one that still drops to 2D */
const ONLY2D=[];
const SHAPEKIND={'shape-rect':'rect','shape-round':'round','shape-L':'L','shape-poly':'poly'};

async function suite(b,phone){
  const R=[];const P=phone?'p':'d';const pg=await openApp(b,{phone,...(process.env.SB_URL?{url:process.env.SB_URL}:{})});
  const T=phone?await touch(pg):null;
  const dev=phone?'phone':'desktop';
  const add=(id,nm,pass,detail)=>R.push(row(`mx-3d-${P}-${id}`,`3D ${dev}: ${nm}`,pass,detail));
  const chk=async(id,nm,fn)=>{if(RE&&!RE.test(`mx-3d-${P}-${id}`))return;const t0=Date.now();try{const r=await fn();add(id,nm,r.pass,r.detail===undefined?'':r.detail)}catch(e){add(id,nm,false,'threw: '+String(e.message||e).split('\n')[0])}if(process.env.VT)console.error('  '+P+'-'+id+' '+(Date.now()-t0)+'ms')};
  /* ---- input drivers: mouse on desktop, CDP touch on phone ---- */
  const tap=async(x,y,o={})=>{if(phone){await T.tap(x,y)}else{if(o.shift)await pg.keyboard.down('Shift');await pg.mouse.click(x,y);if(o.shift)await pg.keyboard.up('Shift')}await pg.waitForTimeout(140)};
  const drag=async(a,c,n=12)=>{const t0=Date.now();try{return await drag_(a,c,n)}finally{if(process.env.VT&&Date.now()-t0>700)console.error('    slow drag '+(Date.now()-t0))}};
  const drag_=async(a,c,n=12)=>{if(phone){await T.drag(a,c,n)}else{await pg.mouse.move(a[0],a[1]);await pg.mouse.down();for(let i=1;i<=n;i++){await pg.mouse.move(a[0]+(c[0]-a[0])*i/n,a[1]+(c[1]-a[1])*i/n);await pg.waitForTimeout(16)}await pg.mouse.up()}await pg.waitForTimeout(160)};
  /* press an on-screen control with a real pointer; throws if something covers it */
  const press=async sel=>{const g=await H(pg,(h,o,s)=>h.geom(s),sel);if(!g)throw new Error('no control '+sel);if(g.hidden)throw new Error('control hidden '+sel+' ('+g.why+')');if(!g.ok)throw new Error(`control ${sel} is covered by ${g.by}`);await tap(g.x,g.y)};
  const hasCtl=async sel=>{const g=await H(pg,(h,o,s)=>h.geom(s),sel);return !!g&&!g.hidden};
  /* OrbitControls damping can keep the camera drifting for a few frames: wait until two reads 80 ms apart agree */
  const camStill=async()=>{let a=JSON.stringify(await H(pg,h=>h.camState()));for(let i=0;i<20;i++){await pg.waitForTimeout(50);const b=JSON.stringify(await H(pg,h=>h.camState()));if(a===b)return true;a=b}return false};
  const cam=async(c,d)=>{await H(pg,(h,o,a)=>h.cam(a[0],a[1],a[2]),[c[0],c[1],d]);await pg.waitForTimeout(80);await camStill()};
  const ptOf=async id=>{let p=await H(pg,(h,o,id)=>h.ptOf(id),id);if(p)return p;
    /* the scene may still be rebuilding after the last change: give it a moment before calling the item unpickable */
    if(await W(pg,id=>!!window.__h.ptOf(id),id,1500))p=await H(pg,(h,o,id)=>h.ptOf(id),id);if(p)return p;const d=await H(pg,(h,o,id)=>{const it=o.byId(id);if(!it)return 'item missing';const q=h.proj(it.x,it.y,300);return {proj:q,onCanvas:h.onCanvas(q[0],q[1]),first:h.firstId(q[0],q[1]),el:(document.elementFromPoint(q[0],q[1])||{}).id||(document.elementFromPoint(q[0],q[1])||{}).className,cam:h.camState()}},id);throw new Error('item not pickable: '+JSON.stringify(d))};
  const live=()=>H(pg,h=>h.live());
  const cleanLive=l=>!l.d3&&l.polyPts===0&&l.dock==='select'&&!l.esc;
  const go3D=async()=>{await ev(pg,()=>document.querySelector('#v3d').click());await pg.waitForFunction(()=>!document.querySelector('#v3').hidden,null,{timeout:20000});await pg.waitForTimeout(150)};
  const libOpenAndPick=async re=>{if(phone)await press('#mbar [data-m=lib]');else if(await ev(pg,()=>document.querySelector('#d-lib').hidden))await press('#t-lib');await pg.waitForTimeout(200);
    await ev(pg,re=>{const r=[...document.querySelectorAll('#lib-list .lib-row')].find(x=>new RegExp(re,'i').test(x.textContent));if(!r)throw new Error('no library row '+re);r.click()},re);await pg.waitForTimeout(200)};

  await pg.evaluate(HELPERS);await pg.evaluate(()=>{window.__cm=0;document.addEventListener('contextmenu',()=>{window.__cm++},true)});await to3D(pg);
  /* software GL: a real frame of this 1100-mesh scene costs ~1 s on swiftshader and every pointer event waits for it. These checks test picking, tools and state, not pixels
     (the smoke gate renders real frames), so frames only refresh the matrices that raycasting and projection read. */
  await ev(pg,()=>{const T=window.__osp.T3();T.renderer.render=(sc,c)=>{sc.updateMatrixWorld();c.updateMatrixWorld();c.matrixWorldInverse.copy(c.matrixWorld).invert()};T.need=true});await pg.waitForTimeout(300);
  const d0=phone?4.0:5.5;
  await pg.waitForFunction(()=>window.__osp.T3().framed!==false,null,{timeout:5000}).catch(()=>{});await pg.waitForTimeout(400);
  const pr=await H(pg,(h,o,d)=>h.pair(d),d0);
  if(!pr){add('setup','find two clickable items in 3D',false,'no pair of clearly pickable items found');add('clean','no console errors',pg.errs.length===0,pg.errs.slice(0,5));await pg.ctx.close();return R}
  const {a:A,b:B,mid}=pr;
  const baseSnap=await ev(pg,()=>window.__h.snap());
  /* every check starts from the plan as found, in plain 3D with Select */
  const focus=async(d=d0)=>{
    for(let i=0;i<4;i++){const st=await ev(pg,()=>({v3:!document.querySelector('#v3').hidden,walk:window.__osp.WALK.on,bld:!!window.__osp.bldView(),tool:document.querySelector('.dock .btn.on')?.dataset.tool,poly:(window.__osp.polyPts()||[]).length,d3:window.__osp.d3Active()}));
      if(st.walk){await ev(pg,()=>document.querySelector('#v3-walk').click());await pg.waitForTimeout(300);continue}
      if(!st.v3||st.bld){await ev(pg,()=>{window.__osp.setTool('select')});await to3D(pg);await ev(pg,()=>document.querySelector('#v3d').click());await pg.waitForTimeout(300);continue}
      if(st.tool!=='select'||st.poly||st.d3){await ev(pg,()=>window.__osp.setTool('select'));await pg.waitForTimeout(150);continue}break}
    for(let i=0;i<6;i++){if(await ev(pg,b=>window.__h.snap()===b,baseSnap))break;await ev(pg,()=>window.__osp.undo());await pg.waitForTimeout(150)}
    await ev(pg,()=>{const m=document.querySelector('#ctxmenu');if(m)m.hidden=true;window.__osp.S().section=undefined});
    await cam(mid,d)};
  await focus();
  const clearSel=()=>ev(pg,()=>window.__osp.setSel([]));
  const base=await ev(pg,()=>window.__h.snap());
  const meshA0=await H(pg,(h,o,id)=>h.meshOf(id),A);

  /* 1. tap / click selects */
  // mutation: app.js ~2948 3D click `if(it&&!fixed(it)){…sel=new Set(g.map(x=>x.id))}` and ~2923 pointerdown `if(!sel.has(it.id)){sel=new Set(grp…)…}` → both disabled → FAIL confirmed
  await chk('select','tap an item selects it (and not its neighbour)',async()=>{await focus();await clearSel();const s0=(await sel(pg)).length;const gA=await grpOf(pg,A);const p=await ptOf(A);await tap(p[0],p[1]);await W(pg,a=>window.__osp.sel().includes(a),A);const s=await sel(pg);const same=await ev(pg,b=>window.__h.snap()===b,base);
    return {pass:s0===0&&same_(s,gA)&&!s.includes(B)&&same,detail:{s0,sel:s.length,grpA:gA.length,hasA:s.includes(A),hasB:s.includes(B),planUnchanged:same}}});

  /* 2. clear selection */
  // mutation: app.js ~2949 3D click `else if(!e.shiftKey)sel.clear();` → `else if(false);` → FAIL confirmed
  await chk('clear-empty','tap empty floor/sky clears the selection',async()=>{await focus();await clearSel();const p=await ptOf(A);await tap(p[0],p[1]);const s1=(await sel(pg)).length;
    await ev(pg,()=>document.querySelector('#v3-persp').click());await pg.waitForTimeout(900);const e=await H(pg,h=>h.emptyPt());
    if(!e){await focus();return {pass:false,detail:'no empty pixel found to tap'}}
    const m0=await objMap(pg);await tap(e[0],e[1]);await W(pg,()=>window.__osp.sel().length===0);const s2=(await sel(pg)).length;const d=delta(m0,await objMap(pg));await focus();return {pass:s1>0&&s2===0&&isNone(d),detail:{before:s1,after:s2,planChanged:dsum(d)}}});
  // mutation: app.js ~2679 mbar select slot `else if(sel.size||pinSel){sel.clear();…}` → `else if(false){}` → FAIL confirmed (clear-slot)
  // mutation: app.js ~2658 escapeAction `else{sel.clear();render();renderInspector()}` → `else{}` → FAIL confirmed (clear-esc)
  if(phone){await chk('clear-slot','Select slot clears the selection in 3D',async()=>{await focus();await clearSel();const p=await ptOf(A);await tap(p[0],p[1]);await W(pg,a=>window.__osp.sel().includes(a),A);const s1=(await sel(pg)).length;await press('#mbar [data-m=select]');await W(pg,()=>window.__osp.sel().length===0);const s2=(await sel(pg)).length;const in3=await ev(pg,()=>!document.querySelector('#v3').hidden);return {pass:s1>0&&s2===0&&in3,detail:{s1,s2,still3D:in3}}})}
  else{await chk('clear-esc','Esc clears the selection in 3D',async()=>{await focus();await clearSel();const p=await ptOf(A);await tap(p[0],p[1]);await W(pg,a=>window.__osp.sel().includes(a),A);const s1=(await sel(pg)).length;await pg.keyboard.press('Escape');await W(pg,()=>window.__osp.sel().length===0);const s2=(await sel(pg)).length;const in3=await ev(pg,()=>!document.querySelector('#v3').hidden);return {pass:s1>0&&s2===0&&in3,detail:{s1,s2,still3D:in3}}})}

  /* 3. several at once */
  if(!phone){
    // mutation: app.js ~2922 3D pointerdown `if(addMod(e)){grp.forEach(x=>sel.has(x.id)?sel.delete(x.id):sel.add(x.id));…}` → `if(false){…}` and ~2948 click `if(e.shiftKey||e.ctrlKey||e.metaKey)g.forEach…` → `if(false)…` → FAIL confirmed
    await chk('multi','Shift-click adds a second item, Shift-click again removes it',async()=>{await focus();await clearSel();const m0=await objMap(pg);const pa=await ptOf(A),pb=await ptOf(B);await tap(pa[0],pa[1]);await W(pg,a=>window.__osp.sel().includes(a),A);await tap(pb[0],pb[1],{shift:true});await W(pg,b=>window.__osp.sel().includes(b),B);const s=await sel(pg);
      await pg.waitForTimeout(450);await tap(pb[0],pb[1],{shift:true});await W(pg,b=>!window.__osp.sel().includes(b),B);const s2=await sel(pg);const d=delta(m0,await objMap(pg));return {pass:s.includes(A)&&s.includes(B)&&s2.includes(A)&&!s2.includes(B)&&isNone(d),detail:{both:s.length,afterToggle:s2.length,planChanged:dsum(d)}}});
  }else{
    // fix-test: app.js ~2934 add a 480 ms touch long-press timer on #v3 capture pointerdown (cleared on a >10 px move / pointerup / cancel) that does `mv3=null;down=null;ctxFrom3D({clientX,clientY,preventDefault(){}},itemAt(ev),floorAt(ev))` and swallows the lifting finger's click if it lands on the menu → PASS confirmed
    await chk('multi','long-press menu → Select several, then tap a second item adds it',async()=>{await focus();await clearSel();await ev(pg,()=>{const t=document.querySelector('#ctxmenu');if(t)t.hidden=true});const pa=await ptOf(A),pb=await ptOf(B);
      await T.T('touchStart',[[pa[0],pa[1]]]);await pg.waitForTimeout(900);await T.T('touchEnd',[]);await pg.waitForTimeout(250);
      const menu=await ev(pg,()=>{const m=document.querySelector('#ctxmenu');return {shown:!!m&&!m.hidden,items:m?[...m.querySelectorAll('[data-cm]')].map(x=>x.dataset.cm):[]}});
      if(!menu.shown||!menu.items.includes('multi'))return {pass:false,detail:{menu,contextmenuEventFired:await ev(pg,()=>window.__cm),note:'long-press on an item in 3D did not open a menu with Select several (the 2D plan uses its own pointer timer so it works on iOS; 3D relies on the browser contextmenu event)'}};
      await ev(pg,()=>document.querySelector('#ctxmenu [data-cm=multi]').click());await pg.waitForTimeout(150);await tap(pb[0],pb[1]);const s=await sel(pg);
      await press('#mbar [data-m=select]');const multiOff=await ev(pg,()=>document.querySelector('#multibar').hidden);
      return {pass:s.includes(A)&&s.includes(B)&&multiOff,detail:{n:s.length,hasA:s.includes(A),hasB:s.includes(B),multiOff}}});
    await ev(pg,()=>{window.__osp.setSel([])});
  }
  // mutation: app.js ~2896 3D contextmenu `const it=itemAt(e);const g=floorAt(e);ctxFrom3D(e,it,g)` → `return` → FAIL confirmed
  if(!phone){await chk('ctxmenu','right-click an item opens the context menu with Rotate, Duplicate, Delete',async()=>{await focus();await clearSel();const hid0=await ev(pg,()=>document.querySelector('#ctxmenu').hidden);const p=await ptOf(A);await pg.mouse.click(p[0],p[1],{button:'right'});await W(pg,()=>!document.querySelector('#ctxmenu').hidden,undefined,1500);
    const selA=(await sel(pg)).includes(A);const m=await ev(pg,()=>{const e=document.querySelector('#ctxmenu');return {shown:!!e&&!e.hidden,items:e?[...e.querySelectorAll('[data-cm]')].map(x=>x.dataset.cm):[]}});await pg.keyboard.press('Escape');await ev(pg,()=>{document.querySelector('#ctxmenu').hidden=true});
    return {pass:hid0&&m.shown&&selA&&['rotcw','dup','del'].every(k=>m.items.includes(k)),detail:{...m,hid0,selA}}})}

  /* 4. move by dragging */
  // mutation: app.js ~2930 3D pointermove `mv3.dx=dx;mv3.dy=dy;` → `mv3.dx=0;mv3.dy=0;` → FAIL confirmed
  await chk('move','dragging a selected item moves it (plan and 3D), the camera stays, undo restores',async()=>{await focus();await clearSel();const before=await ev(pg,()=>window.__h.snap());const m0=await objMap(pg);const gA=await grpOf(pg,A);const c0=await H(pg,h=>h.camState());const it0=await ev(pg,id=>{const o=window.__osp.byId(id);return [o.x,o.y]},A);const p=await ptOf(A);
    await drag(p,[p[0]+(phone?55:70),p[1]+(phone?30:40)],14);
    const it1=await ev(pg,id=>{const o=window.__osp.byId(id);return [o.x,o.y]},A);const c1=await H(pg,h=>h.camState());const m=await H(pg,(h,o,id)=>h.meshOf(id),A);const moved=Math.hypot(it1[0]-it0[0],it1[1]-it0[1]);
    const camSame=JSON.stringify(c0)===JSON.stringify(c1);const meshMatch=!!m&&Math.abs(m.x-it1[0])<2&&Math.abs(m.z-it1[1])<2;const d=delta(m0,await objMap(pg));
    /* the item follows the pointer: the floor point under the end pixel minus the one under the start pixel */
    const want=await H(pg,(h,o,a)=>{const T=o.T3(),r=h.rect();const f=(x,y)=>{const rc=new T.THREE.Raycaster();rc.setFromCamera(new T.THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),T.camera);const pl=new T.THREE.Plane(new T.THREE.Vector3(0,1,0),0);const v=new T.THREE.Vector3();return rc.ray.intersectPlane(pl,v)?[v.x/.001,v.z/.001]:null};const p0=f(a[0][0],a[0][1]),p1=f(a[1][0],a[1][1]);return p0&&p1?[p1[0]-p0[0],p1[1]-p0[1]]:null},[p,[p[0]+(phone?55:70),p[1]+(phone?30:40)]]);
    const follows=!!want&&Math.hypot((it1[0]-it0[0])-want[0],(it1[1]-it0[1])-want[1])<Math.max(300,0.35*Math.hypot(want[0],want[1]));
    await ev(pg,()=>window.__osp.undo());await W(pg,b=>window.__h.snap()===b,before);const after=await ev(pg,()=>window.__h.snap());
    return {pass:moved>100&&follows&&same_(d.chg,gA)&&!d.add.length&&!d.rem.length&&camSame&&meshMatch&&after===before,detail:{movedMm:Math.round(moved),want:want&&want.map(Math.round),follows,changed:d.chg.length,grp:gA.length,camSame,meshMatch,undoRestores:after===before}}});

  /* 4b. things 2D offers while dragging: hold Shift (desktop) / a second finger (phone) to keep the move on one axis */
  const posA=()=>ev(pg,id=>{const o=window.__osp.byId(id);return [o.x,o.y]},A);
  /* while a 3D drag is in progress only the mesh moves; the plan object is written on release */
  const meshA=async()=>{const m=await H(pg,(h,o,id)=>h.meshOf(id),A);return m?[m.x,m.z]:[NaN,NaN]};
  /* the scene is rebuilt after a change: wait until A's mesh sits where the plan says before aiming at it */
  const meshSettled=()=>W(pg,a=>{const o=window.__osp.byId(a),m=window.__h.meshOf(a);return !!o&&!!m&&Math.abs(m.x-o.x)<2&&Math.abs(m.z-o.y)<2},A,3000);
  const selA=async()=>{await focus();await clearSel();await meshSettled();for(let i=0;i<2;i++){const p=await ptOf(A);await tap(p[0],p[1]);if(await W(pg,a=>window.__osp.sel().includes(a),A,1500))return;await clearSel();await pg.waitForTimeout(500)}throw new Error('could not select item A by tap')};
  // fix-test: app.js ~2926 3D pointermove after `if(P.snap){…}` add `if(e.shiftKey||mv3.axis){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0}` (+ phone: second touch on #v3 capture sets mv3.axis and stops propagation; mv3 ignores other pointerIds) → PASS confirmed
  if(!phone){await chk('axis-lock','Shift-drag moves along one axis only (as in 2D)',async()=>{await focus();await clearSel();const p=await ptOf(A);const o0=await posA();
      await pg.mouse.move(p[0],p[1]);await pg.mouse.down();await pg.mouse.move(p[0]+6,p[1]+4);await pg.keyboard.down('Shift');for(let i=1;i<=10;i++){await pg.mouse.move(p[0]+8*i,p[1]+5*i);await pg.waitForTimeout(16)}await pg.mouse.up();await pg.keyboard.up('Shift');await pg.waitForTimeout(200);
      const o1=await posA();const dx=o1[0]-o0[0],dy=o1[1]-o0[1];await ev(pg,()=>window.__osp.undo());
      return {pass:Math.max(Math.abs(dx),Math.abs(dy))>100&&Math.min(Math.abs(dx),Math.abs(dy))<2,detail:{dxMm:Math.round(dx),dyMm:Math.round(dy)}}});
    // mutation: app.js ~2764 keydown Arrow `nudge(e.key==='ArrowLeft'?-s:…)` → `nudge(0,0)` → FAIL confirmed
    await chk('nudge','arrow keys nudge the selection in 3D',async()=>{await selA();const gA=await grpOf(pg,A);const m0=await objMap(pg);const o0=await posA();await pg.keyboard.press('ArrowRight');await pg.keyboard.press('ArrowDown');await W(pg,([a,y])=>window.__osp.byId(a).y!==y,[A,o0[1]]);await meshSettled();const o1=await posA();const m=await H(pg,(h,o,id)=>h.meshOf(id),A);const d=delta(m0,await objMap(pg));const st=await ev(pg,()=>window.__osp.P().snap?window.__osp.P().snapSize:10);await ev(pg,()=>{window.__osp.undo();window.__osp.undo()});
      return {pass:o1[0]===o0[0]+st&&o1[1]===o0[1]+st&&same_(d.chg,gA)&&!d.add.length&&!!m&&Math.abs(m.x-o1[0])<2&&Math.abs(m.z-o1[1])<2,detail:{o0,o1,step:st,changed:d.chg.length,mesh:m}}});
    // mutation: app.js ~2741 keydown `if(k==='a'){e.preventDefault();setSel(…)` → `if(k==='a'){e.preventDefault();return;setSel(…)` → FAIL confirmed
    await chk('select-all','Ctrl+A selects all furniture in 3D (A and B in, no rooms or walls)',async()=>{await focus();await clearSel();await pg.keyboard.press('Control+a');await W(pg,()=>window.__osp.sel().length>10);const s=await sel(pg);
      const r=await ev(pg,s=>{const S=window.__osp.S();const sel=new Set(s);const walls=s.filter(i=>{const o=S.objs.find(x=>x.id===i);return !o||o.t==='room'||o.t==='wall'}).length;const items=S.objs.filter(o=>o.t==='item'&&!o.site);return {walls,missing:items.filter(o=>!sel.has(o.id)).length,items:items.length}},s);
      await clearSel();return {pass:s.length>10&&s.includes(A)&&s.includes(B)&&r.walls===0&&r.missing<=r.items*0.1,detail:{n:s.length,...r}}})}
  else{await chk('axis-lock','a second finger held down keeps an item drag on one axis (as in 2D)',async()=>{
      /* select A first: a press that changes the selection rebuilds the scene, and only the plan (not the mesh being dragged) could then be read mid-drag */
      await selA();await meshSettled();await pg.waitForTimeout(550);const p=await ptOf(A);const q=await H(pg,h=>h.nonItemPt());if(!q)return {pass:false,detail:'no empty pixel for the second finger'};
      const start=await posA();await T.T('touchStart',[[p[0],p[1],1]]);for(let i=1;i<=6;i++){await T.T('touchMove',[[p[0]+6*i,p[1]+6*i,1]]);await pg.waitForTimeout(16)}await W(pg,([a,x,y])=>{const m=window.__h.meshOf(a);return !!m&&(m.x!==x||m.z!==y)},[A,start[0],start[1]],1500);await pg.waitForTimeout(60);const free=await meshA();
      await T.T('touchStart',[[p[0]+36,p[1]+36,1],[q[0],q[1],2]]);for(let i=7;i<=16;i++){await T.T('touchMove',[[p[0]+6*i,p[1]+6*i,1],[q[0],q[1],2]]);await pg.waitForTimeout(16)}await pg.waitForTimeout(60);const locked=await meshA();await T.T('touchEnd',[]);await pg.waitForTimeout(200);await ev(pg,()=>window.__osp.undo());
      /* as in 2D: once the second finger is down the item sits on one axis through its start point and keeps following the first finger along the other */
      const dx=locked[0]-start[0],dy=locked[1]-start[1],fx=free[0]-start[0],fy=free[1]-start[1];return {pass:Math.abs(fx)>0&&Math.abs(fy)>0&&Math.max(Math.abs(dx),Math.abs(dy))>Math.max(Math.abs(fx),Math.abs(fy))&&Math.min(Math.abs(dx),Math.abs(dy))<2,detail:{freeMm:[Math.round(fx),Math.round(fy)],lockedMm:[Math.round(dx),Math.round(dy)]}}})}

  /* 5. rotate / duplicate / delete */

  const detailsOpen=async()=>{if(!(await ev(pg,()=>!document.querySelector('#d-insp').hidden)))await press('#mbar [data-m=insp]');await pg.waitForTimeout(250)};
  const detailsClose=async()=>{if(await ev(pg,()=>!document.querySelector('#d-insp').hidden))await press('#mbar [data-m=insp]');await pg.waitForTimeout(200)};
  // mutation: app.js ~2760 keydown `if(k==='r'){rotateSel(e.shiftKey?-90:90);return}` → `if(k==='r'){return}` → FAIL confirmed (d-rotate)
  // mutation: app.js ~2699 data-mact `if(k==='rot')rotateSel(90);` → `if(k==='rot');` → FAIL confirmed (p-rotate)
  await chk('rotate','rotate the selection '+(phone?'(Details → Rotate)':'(R key)'),async()=>{await selA();const gA=await grpOf(pg,A);const mp0=await objMap(pg);const m0=await H(pg,(h,o,id)=>h.meshOf(id),A);const r0=await ev(pg,id=>window.__osp.byId(id).r||0,A);
    if(phone){await detailsOpen();await press('#d-insp [data-mact=rot]');await detailsClose()}else await pg.keyboard.press('r');await W(pg,([a,r])=>(window.__osp.byId(a).r||0)!==r,[A,r0]);await meshSettled();
    const r1=await ev(pg,id=>window.__osp.byId(id).r||0,A);const m1=await H(pg,(h,o,id)=>h.meshOf(id),A);const turned=((r1-r0)%360+360)%360===90;const d=delta(mp0,await objMap(pg));
    await ev(pg,()=>window.__osp.undo());await pg.waitForTimeout(200);return {pass:turned&&same_(d.chg,gA)&&!d.add.length&&!!m1&&Math.abs(m1.ry-m0.ry)>1,detail:{r0,r1,changed:d.chg.length,grp:gA.length,mesh0:m0,mesh1:m1}}});
  // mutation: app.js ~2739 keydown `if(k==='d'){e.preventDefault();duplicateSel();return}` → `…;return}` without duplicateSel → FAIL confirmed (d-dup)
  // mutation: app.js ~2699 data-mact `else if(k==='dup')duplicateSel();` → `else if(k==='dup');` → FAIL confirmed (p-dup)
  await chk('dup','duplicate the selection '+(phone?'(Details → Duplicate)':'(Ctrl+D)'),async()=>{await selA();const gA=await grpOf(pg,A);const mp0=await objMap(pg);const n0=await nObjs(pg);const m0=await H(pg,h=>h.nMesh());
    if(phone){await detailsOpen();await press('#d-insp [data-mact=dup]');await detailsClose()}else await pg.keyboard.press('Control+d');await W(pg,n=>window.__osp.S().objs.length===n,n0+gA.length);await W(pg,n=>window.__h.nMesh()>=n,m0+gA.length,2000);
    const n1=await nObjs(pg);const m1=await H(pg,h=>h.nMesh());const d=delta(mp0,await objMap(pg));const codes=await ev(pg,([a,b])=>{const S=window.__osp.S(),c=ids=>ids.map(i=>S.objs.find(o=>o.id===i).code).sort().join();return [c(a),c(b)]},[gA,d.add]);
    await ev(pg,()=>window.__osp.undo());await W(pg,n=>window.__osp.S().objs.length===n,n0);const n2=await nObjs(pg);
    return {pass:d.add.length===gA.length&&!d.rem.length&&!d.chg.length&&codes[0]===codes[1]&&m1>=m0+gA.length&&n2===n0,detail:{n0,n1,n2,delta:dsum(d),codes,mesh0:m0,mesh1:m1}}});
  // mutation: app.js ~2758 keydown `if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteAction();return}` → without deleteAction() → FAIL confirmed (d-delete)
  // mutation: app.js ~2638 `$('#b-del').addEventListener('click',()=>deleteAction())` → `()=>{}` → FAIL confirmed (p-delete, p-undo-redo)
  await chk('delete','delete the selection '+(phone?'(#b-del)':'(Delete key)'),async()=>{await selA();const gA=await grpOf(pg,A);const mp0=await objMap(pg);const n0=await nObjs(pg);
    if(phone)await press('#b-del');else await pg.keyboard.press('Delete');await W(pg,n=>window.__osp.S().objs.length===n,n0-gA.length);await W(pg,a=>window.__h.meshOf(a)===null,A,2000);
    const n1=await nObjs(pg);const m=await H(pg,(h,o,id)=>h.meshOf(id),A);const d=delta(mp0,await objMap(pg));await ev(pg,()=>window.__osp.undo());await W(pg,n=>window.__osp.S().objs.length===n,n0);const n2=await nObjs(pg);
    return {pass:same_(d.rem,gA)&&!d.add.length&&!d.chg.length&&m===null&&n2===n0,detail:{n0,n1,n2,delta:dsum(d),meshLeft:m}}});

  /* 6. undo / redo while in 3D */
  // mutation: app.js ~269 undo() `restoreState(s)` → `void s` → FAIL confirmed (d, p)
  // mutation: app.js ~270 redo() `restoreState(future.pop())` → `future.pop()` → FAIL confirmed (d, p)
  await chk('undo-redo','undo and redo '+(phone?'(header buttons)':'(Ctrl+Z / Ctrl+Shift+Z)')+' work in 3D and the scene follows',async()=>{await selA();const n0=await nObjs(pg);
    if(phone)await press('#b-del');else await pg.keyboard.press('Delete');await W(pg,n=>window.__osp.S().objs.length<n,n0);const n1=await nObjs(pg);
    if(phone)await press('#b-undo');else await pg.keyboard.press('Control+z');await W(pg,n=>window.__osp.S().objs.length===n,n0);await meshSettled();const n2=await nObjs(pg);const mU=await H(pg,(h,o,id)=>h.meshOf(id),A);
    if(phone)await press('#b-redo');else await pg.keyboard.press('Control+Shift+z');await W(pg,n=>window.__osp.S().objs.length===n,n1);await W(pg,a=>window.__h.meshOf(a)===null,A,2000);const n3=await nObjs(pg);const mR=await H(pg,(h,o,id)=>h.meshOf(id),A);
    await ev(pg,()=>window.__osp.undo());await pg.waitForTimeout(250);
    return {pass:n1<n0&&n2===n0&&n3===n1&&!!mU&&mR===null,detail:{n0,n1,n2,n3,meshAfterUndo:!!mU,meshAfterRedo:!!mR}}});

  /* 7. tools */
  const startTool=async t=>{
    if(phone){await press('#mbar [data-m=draw]');await pg.waitForTimeout(200);
      const key=t.startsWith('shape')?'shape':t;await press(`#msheet [data-pt="${key}"]`);await pg.waitForTimeout(250);
      if(SHAPEKIND[t]){await press(`#pop-shape [data-shape="${SHAPEKIND[t]}"]`)}}
    else{if(SHAPEKIND[t]){await press('#t-shape');await pg.waitForTimeout(150);await press(`#pop-shape [data-shape="${SHAPEKIND[t]}"]`)}else await press(`.dock [data-tool="${t}"]`)}
    await pg.waitForTimeout(130)};
  const cancel=async()=>{let n=0;for(;n<4;n++){const l=await live();if(cleanLive(l))break;if(phone){if(l.esc)await press('#esc');else await press('#mbar [data-m=select]')}else await pg.keyboard.press('Escape');await pg.waitForTimeout(120)}return n};
  await focus();await clearSel();
  // mutation: app.js ~766 `function d3Active(){return is3D&&…}` → `{return false&&is3D…}` → FAIL confirmed (all tool-* rows, both devices)
  for(const t of DRAW3D){
    await chk('tool-'+t,`tool "${t}" starts in 3D and ${phone?'Cancel chip/Select slot':'Esc'} leaves no tool live`,async()=>{
      await startTool(t);const l1=await live();const badge=await ev(pg,()=>{const b=document.querySelector('#d3-badge');return !!b&&!b.hidden});const still3D=await ev(pg,()=>!document.querySelector('#v3').hidden);
      const poly=['poly','spline','road','fence','trunk','shape-poly'].includes(t);if(poly){const e=await H(pg,h=>h.rect());const cx=e.left+e.width/2,cy=e.top+e.height/2;await tap(cx-40,cy-20);await tap(cx+40,cy-10)}
      const lp=poly?await live():null;const steps=await cancel();const l2=await live();const nowIn3D=await ev(pg,()=>!document.querySelector('#v3').hidden);
      return {pass:l1.d3&&badge&&still3D&&(!poly||lp.polyPts>=1)&&cleanLive(l2)&&nowIn3D,detail:{started:l1,badge,still3D,polyPtsAfterClicks:lp&&lp.polyPts,cancelSteps:steps,after:l2,nowIn3D}}})}
  // mutation: app.js ~989 setTool `if(is3D&&DRAW2D.includes(t)&&!DRAW3D.includes(t))set3D(false);` → removed → FAIL confirmed (all tool2d-* rows)
  for(const t of ONLY2D){
    await chk('tool2d-'+t,`2D-only tool "${t}" chosen in 3D switches to 2D without an error`,async()=>{const e0=pg.errs.length;await go3D();await startTool(t);
      const r=await ev(pg,()=>({is2D:document.querySelector('#v3').hidden,v2on:document.querySelector('#v2d').classList.contains('on'),d3:window.__osp.d3Active()}));
      /* leave tool, return to 3D */
      await ev(pg,()=>window.__osp.setTool('select'));await pg.waitForTimeout(100);await go3D();await focus();const back=await ev(pg,()=>!document.querySelector('#v3').hidden);
      return {pass:r.is2D&&r.v2on&&!r.d3&&pg.errs.length===e0&&back,detail:{...r,newErrors:pg.errs.slice(e0),back}}})}
  // fix-test: app.js ~2765 keydown `if(is3D&&!['f','i','l'].includes(k))return;` → `if(is3D&&!['f','i','l','d','w','m'].includes(k))return;` → PASS confirmed
  if(!phone){await chk('hotkeys','tool hotkeys (D room, W wall, M measure) start the tool in 3D as they do in 2D',async()=>{await to3D(pg);const res={};for(const [k,t] of [['d','room'],['w','poly'],['m','measure']]){await pg.keyboard.press(k);await pg.waitForTimeout(150);res[k]=await ev(pg,()=>window.__osp.d3Active());await pg.keyboard.press('Escape');await pg.waitForTimeout(100);await ev(pg,()=>window.__osp.setTool('select'))}
    return {pass:Object.values(res).every(Boolean),detail:res}})}

  /* 8. draw in 3D */
  const centre=async()=>{const e=await H(pg,h=>h.rect());return [e.left+e.width/2,e.top+e.height/2]};
  let note={};
  const drawCheck=async(id,nm,tool,gesture,verify)=>chk(id,nm,async()=>{note={};await focus();await clearSel();const base0=await ev(pg,()=>window.__h.snap());const m0=await objMap(pg);const n0=await nObjs(pg);const sec0=await ev(pg,()=>!!window.__osp.S().section);
    await startTool(tool);const c=await centre();await gesture(c);await W(pg,([n,s])=>window.__osp.S().objs.length!==n||!!window.__osp.S().section!==s,[n0,sec0],1500);await pg.waitForTimeout(100);const n1=await nObjs(pg);const sec1=await ev(pg,()=>!!window.__osp.S().section);
    const m1=await objMap(pg);const d=delta(m0,m1);const added=d.add.map(k=>JSON.parse(m1[k]));const v=await verify({n0,n1,sec0,sec1,added,d});
    await cancel();await ev(pg,()=>window.__osp.undo());await pg.waitForTimeout(250);const back=await ev(pg,b=>window.__h.snap()===b,base0);
    return {pass:v.ok&&back,detail:{n0,n1,sec0,sec1,undoBack:back,...v}}});
  let dragBox=null;const dragRect=async c=>{const a=[c[0]-70,c[1]-50],b=[c[0]+70,c[1]+40];const fa=await H(pg,(h,o,p)=>h.floor(p[0],p[1]),a),fb=await H(pg,(h,o,p)=>h.floor(p[0],p[1]),b);dragBox=fa&&fb?{x0:Math.min(fa[0],fb[0]),x1:Math.max(fa[0],fb[0]),y0:Math.min(fa[1],fb[1]),y1:Math.max(fa[1],fb[1])}:null;await drag(a,b,10)};
  /* the new rectangle covers the floor under the drag, within snapping (a grid step or an object edge, ≤ 400 mm) */
  const fitsBox=(x0,x1,y0,y1)=>!!dragBox&&[x0-dragBox.x0,x1-dragBox.x1,y0-dragBox.y0,y1-dragBox.y1].every(v=>Math.abs(v)<=400);
  const one=(x,pred)=>({ok:x.added.length===1&&!x.d.rem.length&&!x.d.chg.length&&pred(x.added[0]),got:x.added.map(o=>o.t+':'+(o.shape||'')+':'+(o.w||'')+'x'+(o.d||'')),chg:x.d.chg.length});
  // mutation: app.js ~2911 d3Up `else d3FinishRect(d.mode,d.a,d.b);` → `else;` → FAIL confirmed (draw-room, draw-shape)
  await drawCheck('draw-room','drag a room on the floor',`room`,dragRect,async x=>({...one(x,o=>{if(o.t!=='room'||o.pts.length!==4)return false;const xs=o.pts.map(p=>p[0]),ys=o.pts.map(p=>p[1]);return fitsBox(Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys))}),box:dragBox}));
  await drawCheck('draw-shape','drag a custom rectangle on the floor','shape-rect',dragRect,async x=>({...one(x,o=>o.t==='item'&&o.shape==='rect'&&fitsBox(o.x-o.w/2,o.x+o.w/2,o.y-o.d/2,o.y+o.d/2)),box:dragBox}));
  // mutation: app.js ~2909 d3Up measure `if(Math.hypot(…)>10){addObjs(…)}` → `if(false){…}` → FAIL confirmed
  await drawCheck('draw-measure','drag a dimension on the floor','measure',dragRect,async x=>one(x,o=>o.t==='dim'&&Math.hypot(o.b[0]-o.a[0],o.b[1]-o.a[1])>300));
  // mutation: app.js ~2910 d3Up `else if(d.mode==='section'){if(` → `else if(d.mode==='section'){if(false&&` → FAIL confirmed
  await drawCheck('draw-section','drag a section line (3D slice)','section',dragRect,async x=>({ok:x.sec1&&!x.sec0&&!x.added.length&&!x.d.chg.length}));
  // mutation: app.js ~2915 d3Up `const np=d3Next(w);if(!polyPts)polyPts=[np];else polyPts.push(np);` → `const np=d3Next(w);` → FAIL confirmed (d-draw-wall)
  // fix-test: app.js ~2915 d3Up after the point push `drawD3Overlay();` → `drawD3Overlay();updateHint();` (shows the phone polybar in 3D) → PASS confirmed (p-draw-wall)
  await drawCheck('draw-wall','click three points to draw walls, then finish',`poly`,async c=>{await tap(c[0]-70,c[1]);await tap(c[0],c[1]-40);await tap(c[0]+70,c[1]);
    if(phone){const vis=await hasCtl('#polybar [data-pb=done]');if(vis){await press('#polybar [data-pb=done]')}else{note.polybarShown=false;await tap(c[0]+70,c[1]);await pg.waitForTimeout(120);await tap(c[0]+70,c[1]);note.triedDoubleTap=true}}else await pg.keyboard.press('Enter')},async x=>({ok:x.added.length>=1&&x.added.every(o=>o.t==='wall')&&!x.d.rem.length&&note.polybarShown!==false,got:x.added.map(o=>o.t),...note}));

  /* 9. place a library item in 3D */
  // mutation: app.js ~2945 3D click placing `const gh=ghostAt(p,e.altKey);addObjs(gh.objs,false);return}` → `…;return}` without addObjs → FAIL confirmed
  await chk('place','pick a library item and click the floor to place it; stop placing',async()=>{await focus();await clearSel();const n0=await nObjs(pg);const m0=await objMap(pg);const base0=await ev(pg,()=>window.__h.snap());await libOpenAndPick('Task chair');
    const l0=await live();const strip=phone?await ev(pg,()=>!document.querySelector('#pstrip').hidden):true;const c=await centre();if(!phone)await pg.mouse.move(c[0]+20,c[1]+30);await tap(c[0]+20,c[1]+30);
    await W(pg,n=>window.__osp.S().objs.length>n,n0);const n1=await nObjs(pg);const m1=await objMap(pg);const dd=delta(m0,m1);const newo=dd.add.map(k=>JSON.parse(m1[k]));    if(phone){await press('#pstrip-done')}else await pg.keyboard.press('Escape');await pg.waitForTimeout(200);const l=await live();
    await ev(pg,()=>{window.__osp.undo()});await pg.waitForTimeout(250);const n2=await nObjs(pg);
    return {pass:dd.add.length===1&&/chair/i.test(newo[0].name||'')&&!dd.chg.length&&strip&&cleanLive(l)&&n2===n0,detail:{n0,n1,n2,added:newo.map(o=>o.name),strip,afterStop:l,wasTool:l0.dock}}});
  await ev(pg,()=>window.__osp.setTool('select'));

  /* 10. paint in 3D */
  const toPaint=async()=>{if(phone){await press('#mbar [data-m=draw]');await pg.waitForTimeout(150);await press('#msheet [data-pt="paint"]')}else await press('.dock [data-tool="paint"]');await pg.waitForTimeout(250)};
  const pickSwatch=async()=>{const col=await ev(pg,()=>{const cur=(window.__osp.P().paintCol||'').toLowerCase();const b=[...document.querySelectorAll('[data-paintc]')].filter(x=>x.getBoundingClientRect().width>0).find(x=>x.dataset.paintc.toLowerCase()!==cur&&x.dataset.paintc.toLowerCase()!=='#ffffff');if(!b)return null;b.click();return b.dataset.paintc.toLowerCase()});await pg.waitForTimeout(100);return col};
  const exitPaint=async()=>{if(phone){await press('#paintstrip-done')}else await pg.keyboard.press('Escape');await pg.waitForTimeout(200)};
  // mutation: app.js ~2941 3D click paint `else{o.col=P.paintCol;if(o.faces)delete o.faces}}markDirty()` → `else{}}markDirty()` → FAIL confirmed
  // mutation: app.js ~2674 paintstrip-done → `{return}` and keydown Esc in paint → no-op (p: strip Done; d: escapeAction `else if(tool!=='select'&&tool!=='paint')…`) → FAIL confirmed (exit part)
  await chk('paint-item','paint an item in 3D with a tap/click; Done returns to Select',async()=>{await focus();await clearSel();await ev(pg,()=>{window.__osp.P().paintFace=false});await toPaint();const col=await pickSwatch();if(!col)return {pass:false,detail:'no swatch to pick'};
    const was=await ev(pg,id=>(window.__osp.byId(id).col||'').toLowerCase(),A);const p=await ptOf(A);await tap(p[0],p[1]);await W(pg,([a,c])=>(window.__osp.byId(a).col||'').toLowerCase()===c,[A,col]);const got=await ev(pg,id=>(window.__osp.byId(id).col||'').toLowerCase(),A);const m=await H(pg,h=>h.nMesh());
    await ev(pg,()=>window.__osp.undo());await exitPaint();const l=await live();return {pass:was!==col&&got===col&&cleanLive(l),detail:{was,want:col,got,after:l}}});
  // mutation: app.js ~2938 3D click `o.faces=o.faces||{};o.faces[fi]=P.paintCol;` → `o.faces=o.faces||{};` → FAIL confirmed
  await chk('paint-part','"paint one part only" (Part) paints a single face of an item in 3D',async()=>{await focus();await clearSel();await toPaint();const col=await pickSwatch();
    if(phone){await press('#paintstrip-part')}else{const on=await ev(pg,()=>{const c=document.querySelector('[data-paintface]');if(!c)return null;if(!c.checked)c.click();return c.checked});if(on===null)return {pass:false,detail:'no Part checkbox on desktop paint panel'}}
    const flag=await ev(pg,()=>!!window.__osp.P().paintFace);const p=await ptOf(A);await tap(p[0],p[1]);const faces=await ev(pg,id=>Object.keys(window.__osp.byId(id).faces||{}).length,A);
    await ev(pg,()=>{window.__osp.undo();window.__osp.P().paintFace=false});await exitPaint();return {pass:flag&&faces===1,detail:{flag,faces,col}}});
  // mutation: app.js ~2941 3D click `if(kind==='wall'){if(o.t==='wall')o.col=P.paintCol;else o.wallCol=P.paintCol}` → `if(kind==='wall'){}` → FAIL confirmed
  await chk('paint-wall','paint a wall face in 3D',async()=>{await clearSel();await toPaint();const col=await pickSwatch();await ev(pg,()=>{window.__osp.P().paintFace=false});
    const found=await H(pg,(h,o)=>{const walls=o.S().objs.filter(x=>(x.t==='wall'&&!x.site&&x.pts&&x.pts.length>=2)||(x.t==='room'&&x.pts));for(const w of walls.slice(0,12)){const a=w.pts[0],c=w.pts[1];const mx=(a[0]+c[0])/2,my=(a[1]+c[1])/2;
      for(const d of [3.5,6]){h.cam(mx,my,d,0.9);const r=h.rect();for(let y=r.top+20;y<r.bottom-20;y+=12)for(let x=r.left+20;x<r.right-20;x+=12){if(!h.onCanvas(x,y))continue;for(const hit of h.ray(x,y)){let m=hit.object;while(m&&!m.userData.id&&!m.userData.paint)m=m.parent;if(!m)continue;if(m.userData.paint==='wall'&&m.userData.id)return {x,y,id:m.userData.id};break}}}}return null});
    if(!found){await exitPaint();return {pass:false,detail:'no wall face reachable by the camera in the sample plan'}}
    await pg.waitForTimeout(300);await tap(found.x,found.y);const r=await ev(pg,id=>{const o=window.__osp.byId(id);return {t:o.t,col:((o.t==='wall'?o.col:o.wallCol)||'').toLowerCase()}},found.id);
    await ev(pg,()=>window.__osp.undo());await exitPaint();await focus();return {pass:r.col===col,detail:{want:col,...r}}});
  // mutation: app.js ~2675 paintstrip-part `P.paintFace=!P.paintFace;savePrefs();paintStrip();` → `savePrefs();paintStrip();` → FAIL confirmed
  if(phone){await chk('paint-part-toggle','Part button on the paint strip is shown in 3D and flips the setting',async()=>{await toPaint();const was=await ev(pg,()=>!!window.__osp.P().paintFace);await press('#paintstrip-part');const now=await ev(pg,()=>!!window.__osp.P().paintFace);await press('#paintstrip-part');const back=await ev(pg,()=>!!window.__osp.P().paintFace);await exitPaint();return {pass:was!==now&&back===was,detail:{was,now,back}}})}

  /* 11. orbit / zoom must not select or move anything */
  // mutation: app.js ~2851 after OrbitControls creation add `controls.enableRotate=false;` → FAIL confirmed
  await chk('orbit','one-finger/mouse drag on empty space orbits the camera and changes nothing else',async()=>{await focus();await ev(pg,id=>window.__osp.setSel([id]),A);const s0=await sel(pg);const before=await H(pg,h=>h.snap());const c0=await H(pg,h=>h.camState());
    let p=await H(pg,h=>h.nonItemPt());if(!p)return {pass:false,detail:'no non-item pixel'};const e=await H(pg,h=>h.rect());
    const to=[Math.min(e.right-20,Math.max(e.left+20,p[0]+(phone?-90:-160))),Math.min(e.bottom-20,Math.max(e.top+20,p[1]+(phone?40:60)))];await drag(p,to,14);await pg.waitForTimeout(500);
    const c1=await H(pg,h=>h.camState());const after=await H(pg,h=>h.snap());const s1=await sel(pg);const moved=Math.hypot(...c0.p.map((v,i)=>v-c1.p[i]));
    return {pass:moved>0.05&&after===before&&JSON.stringify(s0)===JSON.stringify(s1),detail:{cameraMoved:+moved.toFixed(2),planSame:after===before,selSame:JSON.stringify(s0)===JSON.stringify(s1)}}});
  const zoomCheck=async(id,nm,onItems)=>chk(id,nm,async()=>{await focus();await ev(pg,id=>window.__osp.setSel([id]),A);const s0=await sel(pg);const before=await H(pg,h=>h.snap());const c0=await H(pg,h=>h.camState());
    let p1,p2;
    if(onItems){p1=await ptOf(A);p2=await H(pg,h=>{const a=h.nonItemPt();return a})}
    else{const pts=await H(pg,h=>{const a=h.nonItemPt();if(!a)return null;const r=h.rect();for(let dx=60;dx<=240;dx+=20)for(const sg of [1,-1])for(let dy=0;dy<=120;dy+=20){const x=a[0]+sg*dx,y=a[1]+dy;if(h.onCanvas(x,y)){const id=h.firstId(x,y);const it=id&&window.__osp.byId(id);if(!it||it.t!=='item')return [a,[x,y]]}}return null});
      if(!pts)return {pass:false,detail:'no two non-item pixels for the fingers'};[p1,p2]=pts}
    if(phone){const m=[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2];const dx=(p2[0]-p1[0])/2,dy=(p2[1]-p1[1])/2;await T.T('touchStart',[[p1[0],p1[1],1],[p2[0],p2[1],2]]);for(let i=1;i<=10;i++){const k=1+i*0.18;await T.T('touchMove',[[m[0]-dx*k,m[1]-dy*k,1],[m[0]+dx*k,m[1]+dy*k,2]]);await pg.waitForTimeout(16)}await T.T('touchEnd',[])}
    else{const m=[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2];await pg.mouse.move(m[0],m[1]);await pg.mouse.wheel(0,-500)}
    await pg.waitForTimeout(700);const c1=await H(pg,h=>h.camState());const after=await H(pg,h=>h.snap());const s1=await sel(pg);
    return {pass:Math.abs(c1.dist-c0.dist)>0.2&&after===before&&JSON.stringify(s0)===JSON.stringify(s1),detail:{dist0:c0.dist,dist1:c1.dist,planUnchanged:after===before,selUnchanged:JSON.stringify(s0)===JSON.stringify(s1)}}});
  // mutation: app.js ~2851 after OrbitControls creation add `controls.enableZoom=false;` → FAIL confirmed (zoom, zoom-on-items)
  await zoomCheck('zoom',phone?'pinch on empty space zooms the camera and changes nothing else':'mouse wheel on empty space zooms the camera and changes nothing else',false);
  if(!phone)await zoomCheck('zoom-on-items',phone?'pinch with one finger on furniture and one on the floor zooms and does not move or select furniture':'mouse wheel with the pointer over furniture zooms and does not move or select furniture',true);

  /* 12. 2D <-> 3D round trip */
  // mutation: app.js ~3388 set3D(on) → first statement `sel.clear();` → FAIL confirmed
  await chk('roundtrip','2D → 3D → 2D keeps the selection and the plan',async()=>{await focus();await ev(pg,([a,b])=>window.__osp.setSel([a,b]),[A,B]);const s0=(await sel(pg)).sort();const plan0=await H(pg,h=>h.snap());
    await to2D(pg);const s2=(await sel(pg)).sort();const plan2=await H(pg,h=>h.snap());await to3D(pg);const s3=(await sel(pg)).sort();const plan3=await H(pg,h=>h.snap());await to2D(pg);await to3D(pg);const s4=(await sel(pg)).sort();
    await ev(pg,()=>window.__osp.setSel([]));
    const same=JSON.stringify(s0);return {pass:JSON.stringify(s2)===same&&JSON.stringify(s3)===same&&JSON.stringify(s4)===same&&plan2===plan0&&plan3===plan0,detail:{sel:s0.length,in2D:s2.length,back3D:s3.length,again:s4.length,planSame:plan2===plan0&&plan3===plan0}}});
  await focus();

  /* 13. ways out of every 3D state */
  const plain=async()=>{const l=await live();const fov=await ev(pg,()=>window.__osp.T3().camera.fov);const ctl=await ev(pg,()=>window.__osp.T3().controls.enabled);return {ok:!l.walk&&!l.bld&&!l.sun&&cleanLive(l)&&fov===45&&ctl,l,fov,ctl}};
  /* Walk asks where to stand: the app goes to the 2D plan and waits for a tap (or Esc / Cancel) */
  const planTap=async()=>{await ev(pg,()=>window.__osp.fit());await pg.waitForTimeout(150);const p=await ev(pg,()=>{const o=window.__osp,V=o.V,S=o.S(),r=document.querySelector('#plan').getBoundingClientRect();
      for(const rm of S.objs.filter(x=>x.t==='room'&&x.pts)){let cx=0,cy=0;rm.pts.forEach(q=>{cx+=q[0];cy+=q[1]});cx/=rm.pts.length;cy/=rm.pts.length;const x=r.left+(cx-V.x)*V.k,y=r.top+(cy-V.y)*V.k;if(x>r.left+40&&x<r.right-40&&y>r.top+120&&y<r.bottom-120)return [x,y]}return null});if(!p)throw new Error('no room visible on the 2D plan to stand in');await tap(p[0],p[1]);await pg.waitForTimeout(500)};
  const startWalk=async()=>{await press('#v3-walk');await pg.waitForTimeout(300);const picking=await ev(pg,()=>document.querySelector('#v3').hidden);await planTap();return picking};
  // mutation: app.js ~3651 `$('#v3-walk').addEventListener('click',()=>{WALK.on?walkStop():walkPickStart()})` → `WALK.on?0:walkPickStart()` → FAIL confirmed
  await chk('out-walk','Walk mode: Walk → tap where to stand → leave with the on-screen "Exit walk" control',async()=>{await focus();const picking=await startWalk();const on=await ev(pg,()=>window.__osp.WALK.on);const label=await ev(pg,()=>document.querySelector('#v3-walk').textContent.trim());
    await press('#v3-walk');await pg.waitForTimeout(400);const p=await plain();return {pass:picking&&on&&label==='Exit walk'&&p.ok,detail:{wentTo2DToPick:picking,walking:on,label,after:p}}});
  // mutation: app.js ~2657 escapeAction `if(walkPick){walkPick=false;…return}` → `if(walkPick){return}` → FAIL confirmed
  await chk('out-walk-cancel','Walk mode: cancel the "where to stand" step '+(phone?'with the Cancel chip':'with Esc')+' and nothing starts',async()=>{await focus();await press('#v3-walk');await pg.waitForTimeout(300);
    if(phone){await press('#esc')}else await pg.keyboard.press('Escape');await pg.waitForTimeout(200);await planTap();const on=await ev(pg,()=>window.__osp.WALK.on);const l=await live();
    if(on)await ev(pg,()=>document.querySelector('#v3-walk').click());return {pass:!on&&cleanLive(l),detail:{walkStarted:on,live:l}}});
  // mutation: app.js ~2720 keydown WALK `if(k==='escape'){e.preventDefault();walkStop();return}` → without walkStop() → FAIL confirmed
  if(!phone){await chk('out-walk-esc','Walk mode: Esc leaves it',async()=>{await focus();await startWalk();const on=await ev(pg,()=>window.__osp.WALK.on);await pg.keyboard.press('Escape');await pg.waitForTimeout(400);const p=await plain();return {pass:on&&p.ok,detail:{walking:on,after:p}}})}
  // mutation: app.js ~3398 setView: `const was=bldView;bldView=v==='bld';` → `const was=bldView;bldView=v==='bld'||was;` (cannot leave Building view) → FAIL confirmed
  await chk('out-bld','Building view: enter and return to plain 3D, then to 2D',async()=>{await focus();
    if(phone){await press('#mbar [data-m=more]');await pg.waitForTimeout(150);await press('#msheet [data-pm="vbld"]')}else await press('#vbld');await pg.waitForTimeout(700);
    const inB=await ev(pg,()=>!!window.__osp.bldView());await press('#v3d');await pg.waitForTimeout(600);const p=await plain();const is3d=await ev(pg,()=>!document.querySelector('#v3').hidden);
    if(phone){await press('#mbar [data-m=more]');await pg.waitForTimeout(150);await press('#msheet [data-pm="vbld"]');await pg.waitForTimeout(500)}else{await press('#vbld');await pg.waitForTimeout(500)}
    await press('#v2d');await pg.waitForTimeout(400);const l=await live();const in2D=await ev(pg,()=>document.querySelector('#v3').hidden);await to3D(pg);
    return {pass:inB&&p.ok&&is3d&&in2D&&!l.bld,detail:{inB,plain3D:p,in2D,bldAfter2D:l.bld}}});
  // mutation: app.js ~3466 #v3-sun click `SUN.on=!SUN.on;` → `SUN.on=true;` → FAIL confirmed
  await chk('out-sun','Sun study: switch on, switch off with the same control',async()=>{await focus();await press('#v3-sun');await pg.waitForTimeout(500);const on=await ev(pg,()=>({sun:window.__osp.SUN().on,bar:!document.querySelector('#sun-bar').hidden}));await press('#v3-sun');await pg.waitForTimeout(500);const p=await plain();
    return {pass:on.sun&&on.bar&&p.ok,detail:{on,after:p}}});
  // mutation: app.js ~1403 deleteAction section branch `checkpoint();S.section=undefined;secSel=false;` → `checkpoint();secSel=false;` → FAIL confirmed
  await chk('out-section','Section: draw in 3D, see the slice, then remove it from 3D with the normal Delete control',async()=>{await focus();await startTool('section');const c=await centre();await drag([c[0]-70,c[1]-20],[c[0]+70,c[1]+20],10);await pg.waitForTimeout(300);
    const has=await ev(pg,()=>!!window.__osp.S().section);const btn=await ev(pg,()=>{const e=document.querySelector('#v3-sec');return !!e&&getComputedStyle(e).display!=='none'});
    await cancel();
    const st=await ev(pg,()=>({secSel:window.__osp.secSel(),delEnabled:!document.querySelector('#b-del').disabled}));
    if(phone){if(st.delEnabled)await press('#b-del')}else await pg.keyboard.press('Delete');await pg.waitForTimeout(400);
    const gone=await ev(pg,()=>!window.__osp.S().section);const clip=await ev(pg,()=>(window.__osp.T3().renderer.clippingPlanes||[]).length);const btn2=await ev(pg,()=>{const e=document.querySelector('#v3-sec');return !!e&&getComputedStyle(e).display!=='none'});
    return {pass:has&&btn&&gone&&clip===0&&!btn2,detail:{drawn:has,secButtonShown:btn,afterCancel:st,removed:gone,clipPlanes:clip,secButtonStillShown:btn2}}});
  // mutation: app.js ~3398 setView `if(v==='2d')return set3D(false);` → `if(v==='2d')return;` → FAIL confirmed
  await chk('out-to2d','From plain 3D the 2D plan is one control away and the tool is Select',async()=>{await press('#v2d');await pg.waitForTimeout(300);const l=await live();const in2D=await ev(pg,()=>document.querySelector('#v3').hidden);await to3D(pg);return {pass:in2D&&l.dock==='select'&&!l.d3,detail:{in2D,dock:l.dock}}});

  // mutation: app.js ~766 d3Active() → also `console.error('mutant')` → FAIL confirmed
  add('clean','no console or page errors during the 3D slice',pg.errs.length===0,pg.errs.slice(0,5));
  await pg.ctx.close();return R}

export async function run(b){let only=process.env.SB_DEV;
  /* SB_ONLY_IDS naming only one device's ids skips the other device's page */
  if(!only&&RE){const src=RE.source,d=src.includes('mx-3d-d-'),p=src.includes('mx-3d-p-');if(d&&!p)only='d';else if(p&&!d)only='p'}/* the two devices run side by side in separate contexts */
  const parts=await Promise.all([only==='p'?[]:suite(b,false),only==='d'?[]:suite(b,true)]);return parts.flat()}
