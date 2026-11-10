/* matrix slice: views and navigation (checklist D1-D10) and building and floors (E1-E4) on every setup.
   Setups: d2 desktop 2D, d3 desktop 3D, p2 phone 2D, p3 phone 3D, t iPad Pro 11 landscape + Pencil (pen = CDP mouse events with
   pointerType 'pen'; fingers = CDP touch). Ids: mx-vb-<setup>-<row>-<what>.
   MXVB_ONLY=D1,E3 runs only those rows (used by the mutation runner). */
import {openApp,row,devices,devFile} from '../../lib.mjs';
export const name='views-building';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ONLY=process.env.MXVB_ONLY?process.env.MXVB_ONLY.split(','):null;
/* the gate retries failed rows once on their own (same checklist row and device); a pass on retry is marked FLAKY */
export const retryEnv=ids=>{const g=new Set(),d=new Set();for(const id of ids){const m=/^mx-vb-([a-z0-9]+)-([A-Z][0-9]+)-/.exec(id);if(!m)continue;g.add(m[2]);d.add(m[1][0])}return {MXVB_ONLY:[...g].join(','),MXVB_DEV:[...d].join(',')}};
const want=r=>!ONLY||ONLY.includes(r);
const URL_=()=>process.env.SB_URL||devFile();
const ev=(pg,fn,arg)=>pg.evaluate(fn,arg);
const H=(pg,fn,arg)=>pg.evaluate(([f,a])=>new Function('h','o','a','return ('+f+')(h,o,a)')(window.__h,window.__osp,a),[fn.toString(),arg]);

/* ---- in-page helpers ---- */
const HELPERS=`(()=>{
 const o=window.__osp,q=s=>document.querySelector(s);
 const rect3=()=>q('#v3c').getBoundingClientRect();
 const ray=(x,y)=>{const T=o.T3(),r=rect3();const rc=new T.THREE.Raycaster();rc.setFromCamera(new T.THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),T.camera);return rc.intersectObjects(T.group.children,true)};
 const firstId=(x,y)=>{for(const hh of ray(x,y)){let m=hh.object;while(m&&!m.userData.id)m=m.parent;if(m)return m.userData.id}return null};
 const onCanvas=(x,y)=>{const r=rect3();return x>r.left+4&&x<r.right-4&&y>r.top+4&&y<r.bottom-4&&document.elementFromPoint(x,y)===q('#v3c')};
 const proj=(wx,wy,wz)=>{const T=o.T3(),r=rect3();const v=new T.THREE.Vector3(wx*.001,wz*.001,wy*.001).project(T.camera);return [r.left+(v.x*.5+.5)*r.width,r.top+(-v.y*.5+.5)*r.height]};
 const itemPt3=id=>{const it=o.byId(id);for(const f of [0.5,0.9,0.3]){const p=proj(it.x,it.y,Math.min(it.h||700,900)*f);if(onCanvas(p[0],p[1])&&firstId(p[0],p[1])===it.id)return p}return null};
 const pick3=()=>{const C=o.S().objs.filter(x=>x.t==='item'&&!x.gid&&!x.arr&&!/^door|^win|lift|stair/.test(x.shape||'')&&x.w>=500&&x.d>=500);for(const it of C){const p=itemPt3(it.id);if(p)return {id:it.id,p}}return null};
 const emptyPt3=()=>{const r=rect3();for(let y=r.top+r.height*0.75;y>r.top+20;y-=16)for(let x=r.left+20;x<r.right-20;x+=16){if(!onCanvas(x,y))continue;if(firstId(x,y)===null)return [x,y]}return null};
 const plan=()=>q('#plan').getBoundingClientRect();
 const scr=(wx,wy)=>{const r=plan(),V=o.V;return [r.left+(wx-V.x)*V.k,r.top+(wy-V.y)*V.k]};
 /* a screen point on a 2D object that hits that object */
 const pt2=id=>{const el=q('#plan [data-id="'+id+'"]');if(!el)return null;const r=el.getBoundingClientRect();for(const fx of [.5,.35,.65,.25,.75])for(const fy of [.5,.35,.65]){const x=r.left+r.width*fx,y=r.top+r.height*fy;const t=document.elementFromPoint(x,y);const hit=t&&t.closest&&t.closest('[data-id]');if(hit&&hit.dataset.id===id)return [x,y]}return null};
 const item2=()=>{const pl=plan();for(const it of o.S().objs){if(it.t!=='item'||it.gid||it.arr||it.cat==='Door'||it.w<500||it.d<500)continue;const p=pt2(it.id);if(p&&p[0]>pl.left+40&&p[0]<pl.right-40&&p[1]>pl.top+40&&p[1]<pl.bottom-40)return {id:it.id,p}}return null};
 /* an empty spot on the plan (no object under it), inside the viewport */
 const empty2=(fx0,fy0)=>{const pl=plan();for(let fy=fy0||0.3;fy<0.95;fy+=0.05)for(let fx=fx0||0.3;fx<0.95;fx+=0.05){const x=pl.left+pl.width*fx,y=pl.top+pl.height*fy;const t=document.elementFromPoint(x,y);if(t&&t.closest&&!t.closest('[data-id],[data-vh],[data-bh],[data-pin]')&&q('#plan').contains(t))return [x,y]}return null};
 const mid2=(fx,fy)=>{const pl=plan();return [pl.left+pl.width*fx,pl.top+pl.height*fy]};
 const geom=(s,blk)=>{const e=q(s);if(!e)return null;let n=e;while(n&&n!==document.body){const cs=getComputedStyle(n);if(n.hidden||cs.display==='none'||cs.visibility==='hidden')return {hidden:true,why:(n.id||n.className||n.tagName)};n=n.parentElement}e.scrollIntoView({block:blk||'nearest',inline:'nearest'});const r=e.getBoundingClientRect();if(r.width===0)return {hidden:true,why:'zero width'};const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);return {x,y,ok:!!t&&(t===e||e.contains(t)),by:t?(t.id||t.className||t.tagName):null,w:r.width,h:r.height,l:r.left,t:r.top}};
 const objs=()=>JSON.stringify(o.S().objs);
 const ids=()=>o.S().objs.map(x=>x.id).sort().join(',');
 const pip=(x,y,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))c=!c}return c};
 const segD=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1;let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2;t=Math.max(0,Math.min(1,t));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)};
 /* a room, a start point inside it and a wall edge to walk into with nothing in the way */
 const walkPlan=()=>{const S=o.S();const doors=S.objs.filter(x=>x.t==='item'&&/^door/.test(x.shape||''));const block=S.objs.filter(x=>x.t==='item'&&(x.h||700)>300&&!/^door/.test(x.shape||''));
   for(const r of S.objs.filter(x=>x.t==='room'&&!x.nowall)){const P=r.pts;
     for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<2500)continue;const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];let nx=-(b[1]-a[1])/L,ny=(b[0]-a[0])/L;
       for(const sg of [1,-1]){const s=[m[0]+nx*sg*2200,m[1]+ny*sg*2200];if(!pip(s[0],s[1],P))continue;if(doors.some(d=>segD([d.x,d.y],a,b)<1500))continue;
         const clear=block.every(it=>{for(let k=0;k<=20;k++){const p=[s[0]+(m[0]-s[0])*k/20,s[1]+(m[1]-s[1])*k/20];if(Math.abs(p[0]-it.x)<it.w/2+500&&Math.abs(p[1]-it.y)<it.d/2+500)return false}return true});
         if(!clear)continue;if(S.objs.some(x=>x.t==='room'&&x!==r&&pip(s[0],s[1],x.pts)))continue;return {room:r.id,s,m,a,b,pts:P}}}}return null};
 /* a door with free floor in front of it on one side */
 const doorPlan=()=>{const S=o.S();const block=S.objs.filter(x=>x.t==='item'&&(x.h||700)>300&&!/^door/.test(x.shape||''));
   for(const d of S.objs.filter(x=>x.t==='item'&&x.shape==='door')){const r=(d.r||0)*Math.PI/180;const nx=-Math.sin(r),ny=Math.cos(r);for(const sg of [1,-1]){const s=[d.x+nx*sg*1100,d.y+ny*sg*1100];
     if(!S.objs.some(x=>x.t==='room'&&pip(s[0],s[1],x.pts)))continue;if(block.some(it=>Math.abs(s[0]-it.x)<it.w/2+600&&Math.abs(s[1]-it.y)<it.d/2+600))continue;return {id:d.id,s,d:[d.x,d.y]}}}return null};
 const lightDir=()=>{const T=o.T3();const d=T.dir.position.clone().sub(T.dir.target.position).normalize();return [+d.x.toFixed(4),+d.y.toFixed(4),+d.z.toFixed(4),T.dir.visible,+T.dir.intensity.toFixed(3)]};
 const wallTop=()=>{const T=o.T3();const B=new T.THREE.Box3();let n=0,top=-1e9;T.group.updateMatrixWorld(true);T.group.traverse(c=>{if(c.isMesh&&c.visible&&c.userData&&c.userData.paint==='wall'){B.setFromObject(c);top=Math.max(top,B.max.y);n++}});return {n,top:n?+top.toFixed(3):null}};
 const furnMeshes=()=>{const T=o.T3();let n=0;T.group.traverse(c=>{if(c.userData&&c.userData.id){const it=o.byId(c.userData.id);if(it&&it.t==='item'&&!/^door|^win/.test(it.shape||'')&&it.cat!=='Core'&&it.cat!=='Column')n++}});return n};
 const levelYs=()=>{const T=o.T3();return (T.bldPick||[]).map(p=>+p.mesh.position.y.toFixed(3))};
 const cam=()=>{const T=o.T3();const p=T.camera.position,t=T.controls.target;return {p:[+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3)],t:[+t.x.toFixed(3),+t.y.toFixed(3),+t.z.toFixed(3)],d:+p.distanceTo(t).toFixed(3),pol:+Math.atan2(Math.hypot(p.x-t.x,p.z-t.z),p.y-t.y).toFixed(3),az:+Math.atan2(p.x-t.x,p.z-t.z).toFixed(3)}};
 const svgCount=pred=>[...document.querySelectorAll('#plan [data-id]')].filter(e=>{const x=o.byId(e.dataset.id);return x&&pred(x)}).length;
 const pixels=sel=>{const c=q(sel);if(!c)return null;const g=c.getContext('2d');const d=g.getImageData(0,0,c.width,c.height-24).data;let h=0,mn=1e9,mx=-1;for(let i=0;i<d.length;i+=37*4){const v=d[i]+d[i+1]*3+d[i+2]*7;h=(h*31+v)>>>0;mn=Math.min(mn,v);mx=Math.max(mx,v)}return {h,range:mx-mn}};
 const freeSpots=n=>{const out=[];const pl=plan(),P=q('#plan');for(let fy=0.12;fy<0.9&&out.length<n;fy+=0.04)for(let fx=0.05;fx<0.95&&out.length<n;fx+=0.03){const x=pl.left+pl.width*fx,y=pl.top+pl.height*fy;const w=o.toWorld({clientX:x,clientY:y});
   if(o.S().objs.some(r=>r.t==='room'&&pip(w[0],w[1],r.pts)))continue;const k=o.V.k;let free=true;for(const dx of [-1,0,1])for(const dy of [-1,0,1]){const t=document.elementFromPoint(x+dx*Math.max(700*k,30),y+dy*Math.max(700*k,30));if(!t||!P.contains(t)||t.closest('[data-id]'))free=false}
   if(free&&!out.some(p=>Math.hypot(p[0]-w[0],p[1]-w[1])<3500))out.push(w)}return out.length===n?out:null};
 const emptyPair3=()=>{const r=rect3();const ok=(x,y)=>onCanvas(x,y)&&firstId(x,y)===null;for(let y=r.top+r.height*0.25;y<r.top+r.height*0.8;y+=16)for(let x=r.left+60;x<r.right-60;x+=16){if([[0,0],[-45,0],[45,0],[-45,-90],[45,-90],[0,-90]].every(([dx,dy])=>ok(x+dx,y+dy)))return [x,y]}return null};
 window.__h={freeSpots,emptyPair3,mid2,ray,firstId,onCanvas,proj,itemPt3,pick3,emptyPt3,scr,pt2,item2,empty2,geom,objs,ids,pip,segD,walkPlan,doorPlan,lightDir,wallTop,furnMeshes,levelYs,cam,svgCount,pixels};
})()`;

/* ---------- contexts ---------- */
async function wire(pg){pg.errs=[];pg.on('pageerror',e=>pg.errs.push('PE:'+e.message));pg.on('console',m=>{if(m.type()==='error')pg.errs.push(m.text())});pg.on('dialog',d=>d.accept().catch(()=>{}))}
async function openDesk(b){const pg=await openApp(b,{...(process.env.SB_URL?{url:process.env.SB_URL}:{})});pg.on('dialog',d=>d.accept().catch(()=>{}));return pg}
/* phones and tablets have no pointer lock: the browser here grants it to a touch pointer, which real iOS / Android do not, so take it away */
const NO_LOCK=()=>{Element.prototype.requestPointerLock=function(){return Promise.reject(new DOMException('Pointer lock is not available on this device','NotSupportedError'))}};
async function openTouch(b,dev){const ctx=await b.newContext({...dev,hasTouch:true});await ctx.addInitScript(NO_LOCK);const pg=await ctx.newPage();pg.ctx=ctx;await wire(pg);
  await pg.goto(URL_(),{waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,null,{timeout:20000});await ev(pg,()=>document.querySelector('#m-sample').click());await sleep(400);return pg}
const openPhone=b=>openTouch(b,devices['iPhone 13']);
const openTab=b=>openTouch(b,devices['iPad Pro 11 landscape']);

/* input drivers. kind d = mouse, p = finger, t = pen (fingers for pan / pinch / joystick / walk taps) */
async function drivers(pg,kind){
  const cdp=kind==='d'?null:await pg.ctx.newCDPSession(pg);
  const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(p=>({x:p[0],y:p[1],id:p[2]??0}))});
  const M=(type,x,y,extra={})=>cdp.send('Input.dispatchMouseEvent',Object.assign({type,x,y,pointerType:'pen'},extra));
  const fin={T,tap:async(x,y)=>{await T('touchStart',[[x,y]]);await sleep(30);await T('touchEnd',[]);await sleep(60)},
    drag:async(a,b,n=12)=>{await T('touchStart',[a]);for(let i=1;i<=n;i++){await T('touchMove',[[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]]);await sleep(16)}await T('touchEnd',[]);await sleep(80)},
    two:async(a,b,d,n=10)=>{await T('touchStart',[[a[0],a[1],1],[b[0],b[1],2]]);for(let i=1;i<=n;i++){await T('touchMove',[[a[0]+d[0]*i/n,a[1]+d[1]*i/n,1],[b[0]+d[0]*i/n,b[1]+d[1]*i/n,2]]);await sleep(16)}await T('touchEnd',[]);await sleep(100)},
    pinch:async(c,r0,r1,n=10)=>{const P=r=>[[c[0]-r,c[1],1],[c[0]+r,c[1],2]];await T('touchStart',P(r0));for(let i=1;i<=n;i++){await T('touchMove',P(r0+(r1-r0)*i/n));await sleep(16)}await T('touchEnd',[]);await sleep(100)}};
  const pen={tap:async(x,y)=>{await M('mouseMoved',x,y);await M('mousePressed',x,y,{button:'left',buttons:1,clickCount:1});await M('mouseReleased',x,y,{button:'left',buttons:0,clickCount:1});await sleep(60)},
    dbl:async(x,y)=>{await M('mouseMoved',x,y);for(const c of [1,2]){await M('mousePressed',x,y,{button:'left',buttons:1,clickCount:c});await M('mouseReleased',x,y,{button:'left',buttons:0,clickCount:c})}await sleep(80)},
    drag:async(a,b,n=12)=>{await M('mouseMoved',a[0],a[1]);await M('mousePressed',a[0],a[1],{button:'left',buttons:1,clickCount:1});for(let i=1;i<=n;i++){await M('mouseMoved',a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,{button:'left',buttons:1});await sleep(16)}await M('mouseReleased',b[0],b[1],{button:'left',buttons:0,clickCount:1});await sleep(80)}};
  const mouse={tap:async(x,y)=>{await pg.mouse.click(x,y);await sleep(60)},dbl:async(x,y)=>{await pg.mouse.dblclick(x,y);await sleep(80)},
    drag:async(a,b,n=12,btn='left')=>{await pg.mouse.move(a[0],a[1]);await pg.mouse.down({button:btn});for(let i=1;i<=n;i++){await pg.mouse.move(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n);await sleep(16)}await pg.mouse.up({button:btn});await sleep(80)}};
  const fdbl=async(x,y)=>{await fin.tap(x,y);await sleep(40);await fin.tap(x,y)};
  if(kind==='d')return {kind,tap:mouse.tap,dbl:mouse.dbl,drag:mouse.drag,mouse,fin:null,pen:null};
  if(kind==='p')return {kind,tap:fin.tap,dbl:fdbl,drag:fin.drag,fin,pen:null};
  return {kind,tap:pen.tap,dbl:pen.dbl,drag:pen.drag,fin,pen};
}

/* ---------- one suite per device ---------- */
async function suite(b,kind){
  const R=[];const pg=kind==='d'?await openDesk(b):kind==='p'?await openPhone(b):await openTab(b);
  const I=await drivers(pg,kind);const phone=kind==='p';const touchy=kind!=='d';
  const s2=kind==='d'?'d2':kind==='p'?'p2':'t',s3=kind==='d'?'d3':kind==='p'?'p3':'t';
  const dev={d2:'desktop 2D',d3:'desktop 3D',p2:'phone 2D',p3:'phone 3D',t:'iPad + Pencil'};
  const chk=async(setup,rowId,what,nm,fn)=>{if(!want(rowId))return;const id=`mx-vb-${setup}-${rowId}-${what}`;const t0=Date.now(),e0=pg.errs.length;let r;try{r=await fn()}catch(e){r={pass:false,detail:'threw: '+String(e.message||e).split('\n')[0]}}
    R.push(row(id,`${dev[setup]}: ${nm}`,r.pass,r.detail===undefined?'':r.detail));if(process.env.MXVB_TRACE)console.error((r.pass?'PASS ':'FAIL ')+id+' '+(Date.now()-t0)+'ms'+(pg.errs.length>e0?' ERR '+pg.errs.slice(e0).join(' | '):''))};
  await pg.evaluate(HELPERS);
  const g=(s,blk)=>H(pg,(h,o,a)=>h.geom(a[0],a[1]),[s,blk]);
  const press=async(sel,via,blk)=>{await ev(pg,()=>window.__osp.toastOff());const q=await g(sel,blk);if(!q)throw new Error('no control '+sel);if(q.hidden)throw new Error('control hidden '+sel+' ('+q.why+')');if(!q.ok)throw new Error(`control ${sel} at ${Math.round(q.x)},${Math.round(q.y)} is covered by ${q.by}`);await (via||I.tap)(q.x,q.y);await sleep(120)};
  const shown=async sel=>{const q=await g(sel);return !!q&&!q.hidden};
  const pick=async(sel,val)=>{await ev(pg,()=>window.__osp.toastOff());const q=await g(sel);if(!q||q.hidden)throw new Error('select hidden '+sel+(q?' ('+q.why+')':''));await pg.selectOption(sel,val);await sleep(150)};
  const typeInto=async(sel,val)=>{const q=await g(sel,'center');if(!q||q.hidden)throw new Error('field hidden '+sel+(q?' ('+q.why+')':''));
    /* touch shells put − / + steppers on number fields: tap the part of the field that is the field */
    const pt=await ev(pg,sel=>{const e=document.querySelector(sel);const r=e.getBoundingClientRect();for(const fy of [.5,.35,.65])for(let fx=.5;fx>0.04;fx-=.08){for(const f of [fx,1-fx]){const x=r.left+r.width*f,y=r.top+r.height*fy;if(document.elementFromPoint(x,y)===e)return [x,y]}}return null},sel);
    if(!pt)throw new Error('field '+sel+' covered by '+q.by);await I.tap(pt[0],pt[1]);await pg.keyboard.press('Control+a');await pg.keyboard.type(String(val));await sleep(80)};
  /* software GL under load: a real frame costs seconds, so ordinary frames only refresh the matrices raycasting and projection read;
     the CCTV point-of-view camera still renders real pixels */
  const stub3D=()=>ev(pg,()=>{const T=window.__osp.T3();if(!T||T.__stub)return;T.__real=T.renderer.render.bind(T.renderer);T.renderer.render=(sc,c)=>{if(c&&c===T.povCam)return T.__real(sc,c);sc.updateMatrixWorld();c.updateMatrixWorld();c.matrixWorldInverse.copy(c.matrixWorld).invert()};T.__stub=true});
  const wait=(fn,arg,t=5000)=>pg.waitForFunction(fn,arg,{timeout:t,polling:100});
  const is3=()=>ev(pg,()=>!document.querySelector('#v3').hidden);
  const go3D=async(via)=>{await press('#v3d',via);await wait(()=>{const o=window.__osp;return o.T3()&&o.T3().renderer&&!document.querySelector('#v3').hidden&&!o.bldView()},null,30000);await stub3D();await sleep(250)};
  const go2D=async()=>{await press('#v2d');await wait(()=>document.querySelector('#v3').hidden);await sleep(100)};
  const st=()=>ev(pg,()=>{const o=window.__osp,S=o.S();return {n:S.objs.length,sel:o.sel(),is3D:!document.querySelector('#v3').hidden,bld:!!o.bldView(),walk:o.WALK.on,roof:o.roofMode(),levels:S.bld?S.bld.levels.length:0}});
  /* every group starts from the sample plan in 2D with Select, everything off */
  const reset=async()=>{await ev(pg,()=>{const o=window.__osp,q=s=>document.querySelector(s);if(o.WALK.on)q('#v3-walk').click();if(o.roofMode())o.switchFloor('roof');if(!q('#v3').hidden)q('#v2d').click();
    const P=o.P();P.layers={};P.hideCats=[];if(P.rcp)q('#t-rcp').click();P.wall3d='full';q('#v3-walls').value='full';const SU=o.SUN();SU.on=false;SU.lat=1.35;q('#sun-bar').hidden=true;
    o.setTool('select');document.querySelectorAll('.pop').forEach(p=>p.hidden=true);const ms=q('#msheet');if(ms&&!ms.hidden)q('[data-msheet-close]').click();
    q('#m-sample').click();o.syncFloorOut();o.render();o.setSel([]);P.lib=false;P.insp=false;q('#d-lib').hidden=true;q('#d-insp').hidden=true;o.toastOff()});
    await sleep(200);await ev(pg,()=>{window.__osp.fit()});await sleep(150)};
  const openFloors=async()=>{if(phone){await press('#mbar [data-m=more]');await sleep(150);await press('#msheet [data-pm="__floors"]')}else{if(await ev(pg,()=>document.querySelector('#d-insp').hidden))await press('#t-insp');await press('[data-tab=bld]')}await wait(()=>!document.querySelector('#p-bld').hidden&&document.querySelector('#p-bld [data-bb=addL]'));await sleep(100)};
  const closeFloors=async()=>{await ev(pg,()=>{const P=window.__osp.P();P.insp=false;document.querySelector('#d-insp').hidden=true})};
  const addFloor=async()=>{const n0=await ev(pg,()=>{const S=window.__osp.S();return S.bld?S.bld.levels.length:1});await press('#p-bld [data-bb=addL]');await wait(n=>window.__osp.S().bld&&window.__osp.S().bld.levels.length===n+1,n0)};
  const more=async id=>{await press('#mbar [data-m=more]');await sleep(150);await press(`#msheet [data-pm="${id}"]`);await sleep(150)};
  const libPlace=async(re,wpt)=>{/* pick a library row and click / tap the plan where it goes */
    if(phone)await press('#mbar [data-m=lib]');else if(await ev(pg,()=>document.querySelector('#d-lib').hidden))await press('#t-lib');await sleep(150);
    await ev(pg,re=>{const r=[...document.querySelectorAll('#lib-list .lib-row')].find(x=>new RegExp(re,'i').test(x.textContent));if(!r)throw new Error('no library row '+re);r.scrollIntoView({block:'center'})},re);
    const rp=await ev(pg,re=>{const r=[...document.querySelectorAll('#lib-list .lib-row')].find(x=>new RegExp(re,'i').test(x.textContent));const b=r.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]},re);await I.tap(rp[0],rp[1]);await wait(ph=>{const h=document.querySelector('#hint'),ps=document.querySelector('#pstrip');return ph?(!ps.hidden&&document.querySelector('#d-lib').hidden):(!h.hidden&&/place/i.test(h.textContent))},phone).catch(()=>{});await sleep(150);
    if(!phone)await ev(pg,()=>{const P=window.__osp.P();P.lib=false;document.querySelector('#d-lib').hidden=true});
    const n0=await ev(pg,()=>window.__osp.S().objs.length);const p=await H(pg,(h,o,w)=>h.scr(w[0],w[1]),wpt);await I.tap(p[0],p[1]);await wait(n0=>window.__osp.S().objs.length>n0,n0).catch(()=>{});
    if(phone&&await shown('#pstrip-done'))await press('#pstrip-done');else await ev(pg,()=>window.__osp.setTool('select'));
    return ev(pg,n0=>{const S=window.__osp.S();return S.objs.length>n0?S.objs[S.objs.length-1].id:null},n0)};

  /* ================= D1 pan, zoom, fit ================= */
  // mutation: app.js:1127 2D pan move made a no-op (case 'pan') and :1116 two-finger pan offset removed → FAIL confirmed
  await chk(s2,'D1','pan',touchy?'two fingers pan the plan, nothing selected or moved':'Pan tool drag pans the plan, nothing selected or moved',async()=>{await reset();
    const v0=await ev(pg,()=>({x:window.__osp.V.x,y:window.__osp.V.y,k:window.__osp.V.k}));const o0=await H(pg,h=>h.objs());
    const a=await H(pg,h=>h.mid2(0.45,0.45));
    if(touchy){await I.fin.two([a[0]-40,a[1]],[a[0]+40,a[1]],[90,50])}else{await press('.dock [data-tool=pan]');await I.drag(a,[a[0]+90,a[1]+50]);await press('.dock [data-tool=select]')}
    const v1=await ev(pg,()=>({x:window.__osp.V.x,y:window.__osp.V.y,k:window.__osp.V.k}));const same=(await H(pg,h=>h.objs()))===o0;const sel=await ev(pg,()=>window.__osp.sel().length);
    const dx=(v0.x-v1.x)*v0.k,dy=(v0.y-v1.y)*v0.k;const held=await wait(()=>window.__osp.pointersN()===0).then(()=>0,()=>ev(pg,()=>window.__osp.pointersN()));return {pass:Math.abs(dx-90)<12&&Math.abs(dy-50)<12&&same&&sel===0&&held===0,detail:{panPx:[Math.round(dx),Math.round(dy)],planSame:same,sel,pointersHeldAfter:held}}});
  // mutation: app.js:448 zoomAt keeps V.k (nk=V.k) → FAIL confirmed
  await chk(s2,'D1','zoom',touchy?'pinch zooms in about the fingers':'mouse wheel zooms in about the cursor',async()=>{await reset();
    const pn=await wait(()=>window.__osp.pointersN()===0).then(()=>0,()=>ev(pg,()=>window.__osp.pointersN()));if(pn)return {pass:false,detail:{note:'pointers still held from before the pinch',pointers:pn}};const a=await H(pg,h=>h.mid2(0.5,0.5));const w0=await ev(pg,a=>window.__osp.toWorld({clientX:a[0],clientY:a[1]}),a);const k0=await ev(pg,()=>window.__osp.V.k);
    if(touchy)await I.fin.pinch(a,40,110,16);else{await pg.mouse.move(a[0],a[1]);for(let i=0;i<4;i++){await pg.mouse.wheel(0,-120);await sleep(40)}}
    await sleep(100);const k1=await ev(pg,()=>window.__osp.V.k);const w1=await ev(pg,a=>window.__osp.toWorld({clientX:a[0],clientY:a[1]}),a);const drift=Math.hypot(w1[0]-w0[0],w1[1]-w0[1])*k1;
    return {pass:k1>k0*1.4&&drift<15,detail:{k0,k1,ratio:+(k1/k0).toFixed(2),anchorDriftPx:+drift.toFixed(1)}}});
  // mutation: app.js:2510 #z-fit click listener removed → FAIL confirmed
  await chk(s2,'D1','fit','Fit frames the whole plan after zooming away',async()=>{await reset();
    await ev(pg,()=>{const V=window.__osp.V;V.k*=6;V.x+=30000;V.y+=20000;window.dispatchEvent(new Event('resize'))});await sleep(100);
    const out0=await ev(pg,()=>{const o=window.__osp,r=document.querySelector('#plan').getBoundingClientRect();return o.S().objs.filter(x=>x.t==='room').every(x=>x.pts.every(p=>{const s=[(p[0]-o.V.x)*o.V.k,(p[1]-o.V.y)*o.V.k];return s[0]>=0&&s[1]>=0&&s[0]<=r.width&&s[1]<=r.height}))});
    let via='';if(phone){/* a phone user has no Menu button; look for a Fit control anywhere they can reach */
      if(await shown('#z-fit')){await press('#z-fit');via='#z-fit'}else if(await shown('#b-more')){await press('#b-more');await press('#z-fit');via='#b-more > Fit'}
      else{await press('#mbar [data-m=more]');const f=await ev(pg,()=>{const t=[...document.querySelectorAll('#msheet [data-pm]')].find(x=>/fit|zoom/i.test(x.textContent));return t?t.dataset.pm:null});if(f){await press(`#msheet [data-pm="${f}"]`);via='More > '+f}else{await press('#mbar [data-m=select]');return {pass:false,detail:'no Fit / zoom-to-plan control on the phone: #b-more hidden, More sheet has none'}}}}
    else{await press('#b-more');await press('#z-fit');via='Menu > Fit'}
    await sleep(150);const inside=await ev(pg,()=>{const o=window.__osp,r=document.querySelector('#plan').getBoundingClientRect();return o.S().objs.filter(x=>x.t==='room').every(x=>x.pts.every(p=>{const s=[(p[0]-o.V.x)*o.V.k,(p[1]-o.V.y)*o.V.k];return s[0]>=-1&&s[1]>=-1&&s[0]<=r.width+1&&s[1]<=r.height+1}))});
    await ev(pg,()=>document.querySelectorAll('.pop').forEach(p=>p.hidden=true));return {pass:!out0&&inside,detail:{beforeAllVisible:out0,afterAllVisible:inside,via}}});
  /* 3D */
  // mutation: app.js:2851 controls.enableZoom=false added → FAIL confirmed
  await chk(s3,'D1','zoom3d',touchy?'pinch on the 3D view zooms the camera, target fixed':'wheel on the 3D view zooms the camera, target fixed',async()=>{await reset();await go3D();
    const c0=await H(pg,h=>h.cam());const e=true;const r=touchy?await H(pg,h=>h.emptyPair3()):await ev(pg,()=>{const b=document.querySelector('#v3c').getBoundingClientRect();return [b.left+b.width/2,b.top+b.height*0.6]});if(!r)return {pass:false,detail:'no empty area for two fingers'};
    if(touchy)await I.fin.pinch(r,30,45);else{await pg.mouse.move(r[0],r[1]);for(let i=0;i<5;i++){await pg.mouse.wheel(0,-200);await sleep(40)}}
    await sleep(500);const c1=await H(pg,h=>h.cam());return {pass:c1.d<c0.d*0.85,detail:{d0:c0.d,d1:c1.d,empty:!!e}}});
  // mutation: app.js:2851 controls.enablePan=false added → FAIL confirmed
  await chk(s3,'D1','pan3d',touchy?'two-finger drag pans the 3D camera':'right-drag pans the 3D camera',async()=>{await reset();await go3D();
    const c0=await H(pg,h=>h.cam());const e=touchy?await H(pg,h=>h.emptyPair3()):await H(pg,h=>h.emptyPt3());if(!e)return {pass:false,detail:'no empty pixel'};
    if(touchy)await I.fin.two([e[0]-45,e[1]],[e[0]+45,e[1]],[0,-80]);else await I.mouse.drag(e,[e[0]+100,e[1]],10,'right');
    await sleep(500);const c1=await H(pg,h=>h.cam());const moved=Math.hypot(c1.t[0]-c0.t[0],c1.t[1]-c0.t[1],c1.t[2]-c0.t[2]);const sel=await ev(pg,()=>window.__osp.sel().length);
    return {pass:moved>0.3&&sel===0,detail:{targetMovedM:+moved.toFixed(2),sel}}});
  // mutation: app.js:3457 Perspective click no longer calls frame3D('persp') → FAIL confirmed
  await chk(s3,'D1','fit3d','Perspective button re-frames the whole plan after zooming in',async()=>{await reset();await go3D();const c0=await H(pg,h=>h.cam());
    await ev(pg,()=>{const T=window.__osp.T3();T.controls.target.x+=8;T.camera.position.x+=8;T.camera.position.lerp(T.controls.target,0.7);T.controls.update()});await sleep(200);const c1=await H(pg,h=>h.cam());
    await press('#v3-persp');await sleep(400);const c2=await H(pg,h=>h.cam());const ctr=await ev(pg,()=>window.__osp.T3().center);
    return {pass:c1.d<c0.d*0.5&&Math.abs(c2.d-c0.d)<0.05*c0.d&&Math.abs(c2.t[0]-ctr[0])<0.01&&Math.abs(c2.t[2]-ctr[1])<0.01,detail:{d0:c0.d,zoomed:c1.d,after:c2.d}}});

  /* ================= D2 2D / 3D / Building keep the plan and the selection ================= */
  // mutation: app.js:3393 set3D(on) clears the selection → FAIL confirmed
  await chk(s2,'D2','2d3d2d','2D → 3D → 2D keeps the selection and every object exactly',async()=>{await reset();const it=await H(pg,h=>h.item2());if(!it)return {pass:false,detail:'no item to tap'};
    await I.tap(it.p[0],it.p[1]);const s0=await ev(pg,()=>window.__osp.sel());if(s0.length!==1||s0[0]!==it.id)return {pass:false,detail:{note:'tap did not select',s0}};const o0=await H(pg,h=>h.objs());
    await go3D();const s1=await ev(pg,()=>window.__osp.sel());const o1=await H(pg,h=>h.objs());await go2D();const s2_=await ev(pg,()=>window.__osp.sel());const o2=await H(pg,h=>h.objs());
    return {pass:o1===o0&&o2===o0&&JSON.stringify(s1)===JSON.stringify(s0)&&JSON.stringify(s2_)===JSON.stringify(s0),detail:{sel3D:s1,sel2D:s2_,plan3Dsame:o1===o0,plan2Dsame:o2===o0}}});
  // mutation: none needed: FAILS on the real build (Building view clears the selection, app.js:3398 setView sel.clear())
  await chk(s3,'D2','3dbld','3D → Building → 3D → 2D keeps every object; Building keeps the selection',async()=>{await reset();await go3D();const p=await H(pg,h=>h.pick3());if(!p)return {pass:false,detail:'no pickable item in 3D'};
    await I.tap(p.p[0],p.p[1]);const s0=await ev(pg,()=>window.__osp.sel());if(!s0.includes(p.id))return {pass:false,detail:{note:'3D tap did not select',s0}};const o0=await H(pg,h=>h.objs());
    await press('#vbld');await wait(()=>window.__osp.bldView());await stub3D();await sleep(200);const oB=await H(pg,h=>h.objs());const sB=await ev(pg,()=>window.__osp.sel());
    await press('#v3d');await wait(()=>!window.__osp.bldView());await sleep(200);const o3=await H(pg,h=>h.objs());const s3_=await ev(pg,()=>window.__osp.sel());await go2D();const o2=await H(pg,h=>h.objs());
    const planOk=oB===o0&&o3===o0&&o2===o0;return {pass:planOk&&JSON.stringify(sB)===JSON.stringify(s0)&&JSON.stringify(s3_)===JSON.stringify(s0),detail:{planOk,selBefore:s0,selInBuilding:sB,selBack3D:s3_}}});

  /* ================= D3 3D bar ================= */
  // mutation: app.js:2851 controls.enableRotate=false added → FAIL confirmed
  await chk(s3,'D3','orbit',touchy?'one-finger drag on empty 3D orbits the camera (target fixed, nothing selected or moved)':'left-drag on empty 3D orbits the camera (target fixed, nothing selected or moved)',async()=>{await reset();await go3D();
    const c0=await H(pg,h=>h.cam());const o0=await H(pg,h=>h.objs());const e=await H(pg,h=>h.emptyPt3());if(!e)return {pass:false,detail:'no empty pixel'};
    await (touchy?I.fin.drag:I.drag)(e,[e[0]+120,e[1]-20],12);await sleep(500);const c1=await H(pg,h=>h.cam());const same=(await H(pg,h=>h.objs()))===o0;const sel=await ev(pg,()=>window.__osp.sel().length);
    const daz=Math.abs(c1.az-c0.az);return {pass:daz>0.15&&Math.hypot(c1.t[0]-c0.t[0],c1.t[2]-c0.t[2])<0.05&&same&&sel===0,detail:{dAzimuth:+daz.toFixed(3),planSame:same,sel}}});
  // mutation: app.js:3386 frame3D('top') places the camera at the perspective position → FAIL confirmed
  await chk(s3,'D3','top-persp','Top down looks straight down; Perspective goes back to the angled view',async()=>{await reset();await go3D();const c0=await H(pg,h=>h.cam());
    await press('#v3-top');await sleep(300);const c1=await H(pg,h=>h.cam());await press('#v3-persp');await sleep(300);const c2=await H(pg,h=>h.cam());
    return {pass:c0.pol>0.3&&c1.pol<0.01&&Math.abs(c2.pol-c0.pol)<0.03&&Math.abs(c2.d-c0.d)<0.02*c0.d,detail:{polar0:c0.pol,polarTop:c1.pol,polarBack:c2.pol}}});
  // mutation: app.js:3476 #v3-walls change no longer sets P.wall3d → FAIL confirmed
  await chk(s3,'D3','walls','Walls: full height, cut at 1.2 m, hidden, and back to full',async()=>{await reset();await go3D();const w0=await H(pg,h=>h.wallTop());
    await pick('#v3-walls','half');await sleep(200);const w1=await H(pg,h=>h.wallTop());await pick('#v3-walls','off');await sleep(200);const w2=await H(pg,h=>h.wallTop());await pick('#v3-walls','full');await sleep(200);const w3=await H(pg,h=>h.wallTop());
    return {pass:w0.n>0&&w0.top>2.5&&w1.n>0&&Math.abs(w1.top-1.2)<0.05&&(w2.n===0||w2.top<0.05)&&JSON.stringify(w3)===JSON.stringify(w0),detail:{full:w0,half:w1,off:w2,back:w3}}});
  // mutation: app.js:3456 #v3-furn change listener removed → FAIL confirmed
  await chk(s3,'D3','bld-bar','Building bar: Furniture none / all, Exploded, Show up to a floor; each toggles back',async()=>{await reset();await openFloors();await addFloor();await closeFloors();await go3D();await press('#vbld');await wait(()=>window.__osp.bldView());await stub3D();await sleep(300);
    const f0=await H(pg,h=>h.furnMeshes()),y0=await H(pg,h=>h.levelYs());await pick('#v3-furn','none');const f1=await H(pg,h=>h.furnMeshes());await pick('#v3-furn','all');const f2=await H(pg,h=>h.furnMeshes());await pick('#v3-furn','active');const f3=await H(pg,h=>h.furnMeshes());
    await press('#v3-exp');await sleep(250);const y1=await H(pg,h=>h.levelYs());await press('#v3-exp');await sleep(250);const y2=await H(pg,h=>h.levelYs());
    const l1=await ev(pg,()=>window.__osp.S().bld.levels[0].id);await pick('#v3-cut',l1);const n1=(await H(pg,h=>h.levelYs())).length;await pick('#v3-cut','');const n2=(await H(pg,h=>h.levelYs())).length;
    return {pass:f0>50&&f1===0&&f2>=f0&&f3===f0&&y0.length===2&&y1[1]>y0[1]+1&&JSON.stringify(y2)===JSON.stringify(y0)&&n1===1&&n2===2,detail:{furn:[f0,f1,f2,f3],levelY:[y0,y1,y2],cutLevels:[n1,n2]}}});

  /* ================= D4 walk ================= */
  const walkEnter=async(start,face)=>{/* Walk, then press on the spot and drag towards where to face */
    await press('#b-walk');await wait(()=>/Walk/.test(document.querySelector('#hint')?.textContent||'')||true);await sleep(100);
    const a=await H(pg,(h,o,w)=>h.scr(w[0],w[1]),start),b2=await H(pg,(h,o,w)=>h.scr(w[0],w[1]),face);const L=Math.hypot(b2[0]-a[0],b2[1]-a[1]);const e=[a[0]+(b2[0]-a[0])/L*60,a[1]+(b2[1]-a[1])/L*60];
    await I.drag(a,e,8);await wait(()=>window.__osp.WALK.on&&window.__osp.T3()&&!document.querySelector('#v3').hidden,null,30000);await stub3D();await sleep(250)};
  const walkFwd=async ms=>{if(kind==='d'){await pg.keyboard.down('w');await sleep(ms);await pg.keyboard.up('w')}else{const j=await g('#joy');if(!j||j.hidden)throw new Error('no joystick on screen');await I.fin.T('touchStart',[[j.x,j.y,5]]);await I.fin.T('touchMove',[[j.x,j.y-25,5]]);await I.fin.T('touchMove',[[j.x,j.y-60,5]]);await sleep(ms);await I.fin.T('touchEnd',[])}await sleep(120)};
  const walkExit=async()=>{await press('#v3-walk');await wait(()=>!window.__osp.WALK.on);await sleep(150)};
  // mutation: app.js:3542 walkResolve returns at once (no collision) → FAIL confirmed
  await chk(s2,'D4','enter-move-wall',kind==='d'?'Walk: press in a room, W walks forward, the wall stops you':'Walk: tap-drag in a room, the joystick walks forward, the wall stops you',async()=>{await reset();const wp=await H(pg,h=>h.walkPlan());if(!wp)return {pass:false,detail:'no room with a clear wall'};
    await walkEnter(wp.s,wp.m);const p0=await ev(pg,()=>window.__osp.WALK.pos.slice());const hud=await shown('#walk-hud');const inRoom0=await H(pg,(h,o,w)=>h.pip(w.p[0],w.p[1],w.pts),{p:p0,pts:wp.pts});
    await walkFwd(2600);const p1=await ev(pg,()=>window.__osp.WALK.pos.slice());const inRoom=await H(pg,(h,o,w)=>h.pip(w.p[0],w.p[1],w.pts),{p:p1,pts:wp.pts});const dW=await H(pg,(h,o,w)=>h.segD(w.p,w.a,w.b),{p:p1,a:wp.a,b:wp.b});
    const moved=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);return {pass:hud&&inRoom0&&Math.hypot(p0[0]-wp.s[0],p0[1]-wp.s[1])<300&&moved>1200&&inRoom&&dW<600&&dW>150,detail:{hud,startInRoom:inRoom0,movedMm:Math.round(moved),endInRoom:inRoom,distToWallMm:Math.round(dW)}}});
  // mutation: app.js:3651 #v3-walk click no longer calls walkStop when walking → FAIL confirmed
  await chk(s2,'D4','exit','Walk: the on-screen Exit walk button leaves the walk and gives orbit back',async()=>{if(!(await ev(pg,()=>window.__osp.WALK.on))){await reset();const wp=await H(pg,h=>h.walkPlan());await walkEnter(wp.s,wp.m)}
    const on=await ev(pg,()=>window.__osp.WALK.on);await walkExit();const s=await ev(pg,()=>({walk:window.__osp.WALK.on,hud:document.querySelector('#walk-hud').hidden,joy:document.querySelector('#joy').hidden,orbit:window.__osp.T3().controls.enabled,lbl:document.querySelector('#v3-walk').textContent}));
    return {pass:on&&!s.walk&&s.hud&&s.joy&&s.orbit&&s.lbl==='Walk',detail:s}});
  // mutation: app.js:3538 walkInteract no longer toggles ds.open → FAIL confirmed
  await chk(s2,'D4','door',kind==='d'?'Walk: E closes the door in front of you and E opens it again':'Walk: tapping the view closes the door in front of you, tapping again opens it',async()=>{await reset();const dp=await H(pg,h=>h.doorPlan());if(!dp)return {pass:false,detail:'no door with floor in front'};
    await walkEnter(dp.s,dp.d);await sleep(500);await ev(pg,()=>{window.__pt=[];['pointerdown','pointerup','pointercancel'].forEach(k=>document.querySelector('#v3c').addEventListener(k,e=>window.__pt.push(k[7]+':'+Math.round(e.clientX)+','+Math.round(e.clientY)+':'+Math.round(performance.now())+':'+!!document.pointerLockElement+':'+window.__osp.WALK.on),true))});const tgt=await ev(pg,()=>{const t=window.__osp.walkTarget();return t&&t.id});const ds0=await ev(pg,id=>{const d=window.__osp.T3().doorState[id];return d?d.open:'unset'},dp.id);
    const act=async()=>{if(kind==='d'){await pg.keyboard.press('e')}else{const r=await ev(pg,()=>{const b=document.querySelector('#v3c').getBoundingClientRect();return [b.left+b.width*0.6,b.top+b.height*0.45]});await I.fin.T('touchStart',[[r[0],r[1]]]);await I.fin.T('touchEnd',[])}await sleep(250)};
    await act();const t1=await ev(pg,()=>{const t=document.querySelector('#toast');return t&&!t.hidden?t.textContent:''});const ds1=await ev(pg,id=>{const d=window.__osp.T3().doorState[id];return d?d.open:'unset'},dp.id);await act();const ds2=await ev(pg,id=>{const d=window.__osp.T3().doorState[id];return d?d.open:'unset'},dp.id);await walkExit();
    return {pass:tgt===dp.id&&ds0!==false&&ds1===false&&ds2===true,detail:{target:tgt===dp.id,before:ds0,afterFirst:ds1,afterSecond:ds2,ptr:await ev(pg,()=>window.__pt),toast1:t1}}});
  // mutation: app.js:3601 rideLift no longer calls switchFloor (desktop); touch setups red on the real build → FAIL confirmed
  await chk(s2,'D4','lift',kind==='d'?'Walk: inside a lift, PageUp rides to the floor above':'Walk: inside a lift, an on-screen control rides to the floor above',async()=>{await reset();
    const fs=await H(pg,h=>h.freeSpots(1));if(!fs)return {pass:false,detail:'no free spot outside the rooms'};const spot=fs[0];
    await openFloors();await addFloor();await closeFloors();
    await ev(pg,sp=>{const o=window.__osp,l=o.LIB().find(x=>x.code==='LF2425');o.S().objs.push({t:'item',id:'mxlift',code:l.code,name:l.name,cat:l.cat,shape:l.shape,w:l.w,d:l.d,h:l.h||3000,x:sp[0],y:sp[1],r:0});o.render()},spot);
    await walkEnter(spot,[spot[0],spot[1]-2000]);const lv0=await ev(pg,()=>window.__osp.S().bld.active);const L=await ev(pg,()=>window.__osp.S().bld.levels.map(l=>l.id));const inLift=await ev(pg,()=>!!window.__osp.walkLiftAt(window.__osp.WALK.pos));
    let via='PageUp';if(kind==='d')await pg.keyboard.press('PageUp');else{const c=await ev(pg,()=>{const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&getComputedStyle(e).display!=='none'&&!e.closest('[hidden]')};const t=[...document.querySelectorAll('#v3 button,#v3 [role=button],#walk-hud button')].find(e=>vis(e)&&/lift|floor up|up a floor|^up$|▲|⬆/i.test((e.textContent||'')+' '+(e.title||'')+' '+(e.getAttribute('aria-label')||'')));if(!t)return null;const r=t.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,t.id||t.textContent]});
      if(!c){await walkExit();return {pass:false,detail:{inLift,note:'no on-screen control to ride the lift; the walk HUD only offers PageUp / PageDown'}}}via=c[2];await I.fin.tap(c[0],c[1])}
    await sleep(300);const lv1=await ev(pg,()=>window.__osp.S().bld.active);const walk=await ev(pg,()=>window.__osp.WALK.on);await walkExit();
    return {pass:inLift&&lv0===L[0]&&lv1===L[1]&&walk,detail:{inLift,from:lv0===L[0]?'L1':lv0,to:lv1===L[1]?'L2':lv1,stillWalking:walk,via}}});

  /* ================= D5 sun ================= */
  // mutation: app.js:3467 #sun-month change listener removed → FAIL confirmed
  await chk(s3,'D5','sun','Sun: on, then month, time, latitude and north each move the sun; off restores the plain light',async()=>{await reset();await go3D();const l0=await H(pg,h=>h.lightDir());
    await press('#v3-sun');await wait(()=>window.__osp.SUN().on&&!document.querySelector('#sun-bar').hidden);const a=await H(pg,h=>h.lightDir());
    const m0=await ev(pg,()=>window.__osp.SUN().month);await pick('#sun-month',String((m0+6)%12));const b2=await H(pg,h=>h.lightDir());
    const sl=await g('#sun-time');await I.tap(sl.l+sl.w*0.3,sl.y);await sleep(150);const c=await H(pg,h=>h.lightDir());const tmin=await ev(pg,()=>window.__osp.SUN().min);
    await typeInto('#sun-lat','40');await sleep(150);const d=await H(pg,h=>h.lightDir());await typeInto('#sun-north','90');await sleep(150);const e=await H(pg,h=>h.lightDir());const north=await ev(pg,()=>window.__osp.S().north);
    await press('#v3-sun');await wait(()=>!window.__osp.SUN().on);const f=await H(pg,h=>h.lightDir());const barHidden=await ev(pg,()=>document.querySelector('#sun-bar').hidden);
    const J=JSON.stringify,dif=(x,y)=>J(x.slice(0,3))!==J(y.slice(0,3));await ev(pg,()=>window.__osp.setNorth(0));
    return {pass:dif(a,l0)&&dif(b2,a)&&tmin<600&&dif(c,b2)&&dif(d,c)&&dif(e,d)&&north===90&&J(f)===J(l0)&&barHidden,detail:{plain:l0,on:a,month:b2,time:[tmin,c],lat:d,north:[north,e],off:f,barHidden}}});

  /* ================= D6 section ================= */
  // mutation: app.js:719 sectionApply sets clippingPlanes=[] when on → FAIL confirmed
  await chk(s3,'D6','section','Section: on slices the model, Flip turns the cut round, off removes it',async()=>{await reset();
    await ev(pg,()=>{const o=window.__osp,S=o.S();const xs=S.objs.filter(x=>x.t==='room').flatMap(x=>x.pts.map(p=>p[0])),ys=S.objs.filter(x=>x.t==='room').flatMap(x=>x.pts.map(p=>p[1]));const mx=(Math.min(...xs)+Math.max(...xs))/2;S.section={a:[mx,Math.min(...ys)-1000],b:[mx,Math.max(...ys)+1000],on:false}});
    await go3D();const vis=await shown('#v3-sec');const c0=await ev(pg,()=>window.__osp.T3().renderer.clippingPlanes.length);
    await press('#v3-sec');const c1=await ev(pg,()=>{const p=window.__osp.T3().renderer.clippingPlanes;return p.length?[p.length,+p[0].normal.x.toFixed(3),+p[0].normal.z.toFixed(3)]:[0]});
    await press('#v3-secflip');const c2=await ev(pg,()=>{const p=window.__osp.T3().renderer.clippingPlanes;return p.length?[p.length,+p[0].normal.x.toFixed(3),+p[0].normal.z.toFixed(3)]:[0]});
    await press('#v3-sec');const c3=await ev(pg,()=>window.__osp.T3().renderer.clippingPlanes.length);const on=await ev(pg,()=>window.__osp.S().section.on);
    return {pass:vis&&c0===0&&c1[0]===1&&Math.abs(Math.abs(c1[1])-1)<0.01&&c2[0]===1&&Math.abs(c2[1]+c1[1])<0.01&&c3===0&&on===false,detail:{buttonShown:vis,before:c0,on:c1,flipped:c2,off:c3}}});

  /* ================= D7 ceiling plan ================= */
  // mutation: app.js:999 setRCP forces P.rcp=false → FAIL confirmed
  await chk(s2,'D7','rcp','Ceiling plan: on lets you pick a camera and fades furniture; off puts it back',async()=>{await reset();
    const at=await H(pg,h=>h.mid2(0.45,0.4));const w=await ev(pg,a=>window.__osp.toWorld({clientX:a[0],clientY:a[1]}),at);
    await ev(pg,w=>{const o=window.__osp,l=o.LIB().find(x=>x.code==='CCTV-D');o.S().objs.push({t:'item',id:'mxcam',code:l.code,name:l.name,cat:l.cat,shape:l.shape,w:600,d:600,h:l.h||120,x:w[0],y:w[1],r:0});o.render()},w);await sleep(100);
    const p=await H(pg,(h,o,w)=>h.scr(w[0],w[1]),w);const tap=async()=>{await ev(pg,()=>window.__osp.setSel([]));await I.tap(p[0],p[1]);await sleep(100);return ev(pg,()=>window.__osp.sel())};
    const off0=await tap();const tog=async()=>{if(phone)await more('t-rcp');else await press('#t-rcp')};
    await tog();await wait(p=>{const t=document.elementFromPoint(p[0],p[1]);const d=t&&t.closest('[data-id]');return d&&d.dataset.id==='mxcam'},p).catch(()=>{});const on=await ev(pg,()=>({rcp:!!window.__osp.P().rcp,cls:document.querySelector('#plan').classList.contains('rcp')||document.querySelector('#main').classList.contains('rcp')||!!document.querySelector('.rcp #plan, .rcp#plan, #plan.rcp, .rcp')}));
    const fur=await ev(pg,()=>{const e=document.querySelector('#plan .it:not(.ceil)');return e?+getComputedStyle(e).opacity:null});const on1=await tap();
    await tog();const offS=await ev(pg,()=>!!window.__osp.P().rcp);const fur2=await ev(pg,()=>{const e=document.querySelector('#plan .it:not(.ceil)');return e?+getComputedStyle(e).opacity:null});const off1=await tap();
    return {pass:!off0.includes('mxcam')&&on.rcp&&fur<1&&on1.includes('mxcam')&&!offS&&fur2===1&&!off1.includes('mxcam'),detail:{selOff:off0,rcp:on,furnOpacity:[fur,fur2],selOn:on1,selAfterOff:off1}}});

  /* ================= D8 layers ================= */
  // mutation: app.js:107 visible() returns true for texts → FAIL confirmed
  await chk(s2,'D8','layers','Layers: each object layer hides exactly its objects in the plan and shows them again',async()=>{await reset();
    await ev(pg,()=>{const o=window.__osp,S=o.S();const r=S.objs.find(x=>x.t==='room');const c=r.pts[0];const L=n=>o.LIB().find(x=>x.code===n);const cam=L('CCTV-D'),col=L('C600');
      S.objs.push({t:'text',id:'mxtxt',x:c[0]+1500,y:c[1]+1500,text:'Label',size:300},{t:'dim',id:'mxdim',a:[c[0]+500,c[1]+800],b:[c[0]+4500,c[1]+800]},{t:'item',id:'mxcam2',code:cam.code,name:cam.name,cat:cam.cat,shape:cam.shape,w:600,d:600,h:120,x:c[0]+2500,y:c[1]+2500,r:0},
        {t:'item',id:'mxcol',code:col.code,name:col.name,cat:col.cat,shape:col.shape,w:600,d:600,h:2800,x:c[0]-3000,y:c[1]-3000,r:0},{t:'wall',id:'mxroad',site:'road',pts:[[c[0]-8000,c[1]-6000],[c[0]+8000,c[1]-6000]],th:6000});o.render()});await sleep(120);
    if(phone)await more('t-layers');else await press('#t-layers');if(!(await shown('#ly-list [data-ly=furn]')))return {pass:false,detail:'Layers panel did not open'};
    const K={walls:"x=>x.t==='room'||(x.t==='wall'&&!x.site)||x.shape==='col'||x.cat==='Core'",doors:"x=>x.t==='item'&&(x.cat==='Door'||/^door/.test(x.shape||''))",furn:"x=>x.t==='item'&&!['Door','Window','Ceiling','Core','Site'].includes(x.cat)&&x.shape!=='col'",texts:"x=>x.t==='text'",measures:"x=>x.t==='dim'",ceil:"x=>x.t==='item'&&x.cat==='Ceiling'",site:"x=>x.t==='wall'&&!!x.site"};
    const count=()=>H(pg,(h,o,K)=>{const r={};for(const k in K)r[k]=h.svgCount(new Function('return '+K[k])());return r},K);
    const c0=await count();const out={base:c0};let ok=Object.values(c0).every(v=>v>0);
    for(const k of Object.keys(K)){await press(`#ly-list [data-ly=${k}]`,null,'center');const c1=await count();await press(`#ly-list [data-ly=${k}]`,null,'center');const c2=await count();
      const others=Object.keys(K).filter(x=>x!==k&&!(k==='walls'&&x==='site')).every(x=>c1[x]===c0[x]);const good=c1[k]===0&&others&&JSON.stringify(c2)===JSON.stringify(c0);if(!good){ok=false;out[k]={hidden:c1,back:c2}}}
    if(phone)await ev(pg,()=>document.querySelector('#pop-layers').hidden=true);else await ev(pg,()=>document.querySelector('#pop-layers').hidden=true);
    return {pass:ok,detail:ok?{base:c0}:out}});
  // mutation: app.js:538 #L-grid always displayed → FAIL confirmed
  await chk(s2,'D8','layers-view','Layers: grid, room labels and room areas hide and show',async()=>{await reset();if(phone)await more('t-layers');else await press('#t-layers');
    const m=()=>ev(pg,()=>({grid:document.querySelector('#L-grid').style.display!=='none',labels:document.querySelectorAll('#plan .room-lbl').length,areas:document.querySelectorAll('#plan .room-area').length}));
    const c0=await m();const out={};let ok=c0.grid&&c0.labels>0&&c0.areas>0;
    for(const k of ['grid','labels','areas']){await press(`#ly-list [data-ly=${k}]`,null,'center');const c1=await m();await press(`#ly-list [data-ly=${k}]`,null,'center');const c2=await m();const hid=k==='grid'?!c1.grid:c1[k]===0;const keep=Object.keys(c0).filter(x=>x!==k).every(x=>c1[x]===c0[x]);
      if(!(hid&&keep&&JSON.stringify(c2)===JSON.stringify(c0))){ok=false;out[k]={c1,c2}}}
    await ev(pg,()=>document.querySelector('#pop-layers').hidden=true);return {pass:ok,detail:ok?c0:out}});
  // mutation: none needed: FAILS on the real build (Show all is under the plan tabs on desktop / iPad; phone Layers popover is off screen)
  await chk(s2,'D8','show-all','Layers: Show all brings back every hidden layer',async()=>{await reset();if(phone)await more('t-layers');else await press('#t-layers');
    for(const k of ['furn','doors'])await press(`#ly-list [data-ly=${k}]`,null,'center');const hid=await ev(pg,()=>{const P=window.__osp.P();return P.layers.furn===false&&P.layers.doors===false});const n1=await ev(pg,()=>document.querySelectorAll('#plan [data-id]').length);
    await press('#ly-all',null,'center');const P2=await ev(pg,()=>{const P=window.__osp.P();return Object.values(P.layers).every(v=>v!==false)});const n2=await ev(pg,()=>document.querySelectorAll('#plan [data-id]').length);await ev(pg,()=>document.querySelector('#pop-layers').hidden=true);
    return {pass:hid&&P2&&n2>n1,detail:{hidden:hid,allBack:P2,svgIds:[n1,n2]}}});

  /* ================= D9 north ================= */
  // mutation: app.js:443 widget drag no longer sets S.north; and app.js:446 dblclick listener removed → FAIL confirmed
  await chk(s2,'D9','north-drag','North: dragging the arrow widget turns north; double-tap / double-click sets it back to up',async()=>{await reset();const n0=await ev(pg,()=>window.__osp.S().north||0);
    const w=await g('#north');if(!w||w.hidden)return {pass:false,detail:'north widget hidden'};if(!w.ok)return {pass:false,detail:'north widget covered by '+w.by};
    await I.drag([w.x,w.y-w.h*0.4],[w.x+w.w*0.45,w.y],10);await sleep(120);const n1=await ev(pg,()=>window.__osp.S().north||0);const lbl=await ev(pg,()=>document.querySelector('#north .nv').textContent);
    await I.dbl(w.x,w.y);await sleep(200);const n2=await ev(pg,()=>window.__osp.S().north||0);return {pass:n0===0&&n1>=60&&n1<=120&&lbl===n1+'°'&&n2===0,detail:{start:n0,afterDrag:n1,label:lbl,afterDouble:n2}}});
  // mutation: app.js:3471 #sun-north input listener removed → FAIL confirmed
  await chk(s3,'D9','north-3d','North in 3D: the Sun bar North field sets it and the widget turns with the camera',async()=>{await reset();await go3D();await press('#v3-sun');await typeInto('#sun-north','45');await sleep(150);const n=await ev(pg,()=>window.__osp.S().north);
    const a0=await ev(pg,()=>document.querySelector('#north').style.getPropertyValue('--n'));const e=await H(pg,h=>h.emptyPt3());await (touchy?I.fin.drag:I.drag)(e,[e[0]+140,e[1]],12);await sleep(500);const a1=await ev(pg,()=>document.querySelector('#north').style.getPropertyValue('--n'));
    await press('#v3-sun');await ev(pg,()=>window.__osp.setNorth(0));return {pass:n===45&&a0!==a1&&(await shown('#north')),detail:{north:n,widgetBefore:a0,widgetAfterOrbit:a1}}});

  /* ================= D10 CCTV point of view ================= */
  const povCase=async(in3D)=>{await reset();const w=await ev(pg,()=>{const S=window.__osp.S();const r=S.objs.filter(x=>x.t==='room').sort((a,b)=>Math.abs(b.pts[2][0]-b.pts[0][0])*Math.abs(b.pts[2][1]-b.pts[0][1])-Math.abs(a.pts[2][0]-a.pts[0][0])*Math.abs(a.pts[2][1]-a.pts[0][1]))[0];const xs=r.pts.map(p=>p[0]),ys=r.pts.map(p=>p[1]);return [Math.min(...xs)+600,Math.min(...ys)+600]});
    await ev(pg,w=>{const o=window.__osp,l=o.LIB().find(x=>x.code==='CCTV-D');o.S().objs.push({t:'item',id:'mxpov',code:l.code,name:l.name,cat:l.cat,shape:l.shape,w:600,d:600,h:120,x:w[0],y:w[1],r:-45,fov:90,tilt:20,range:15000});o.render()},w);
    const rcp0=await ev(pg,()=>!!window.__osp.P().rcp);if(phone)await more('t-rcp');else await press('#t-rcp');const rcp1=await ev(pg,()=>!!window.__osp.P().rcp);if(rcp0||!rcp1)return {pass:false,detail:{note:'ceiling plan did not switch on',rcp0,rcp1}};
    const p=await H(pg,(h,o,w)=>h.scr(w[0],w[1]),w);await wait(p=>{const t=document.elementFromPoint(p[0],p[1]);const d=t&&t.closest('[data-id]');return d&&d.dataset.id==='mxpov'},p).catch(()=>{});const hit=await ev(pg,p=>{const t=document.elementFromPoint(p[0],p[1]);const d=t&&t.closest('[data-id]');return d&&d.dataset.id},p);await I.tap(p[0],p[1]);await sleep(150);
    if(in3D)await go3D();
    const s=await ev(pg,()=>window.__osp.sel());if(phone)await press('#mbar [data-m=insp]');else if(await ev(pg,()=>document.querySelector('#d-insp').hidden))await press('#t-insp');await press('[data-tab=sel]');
    const has=await wait(()=>!!document.querySelector('#cctv-pov'),null,5000).then(()=>true,()=>false)||await ev(pg,()=>!!document.querySelector('#cctv-pov'));if(!has)return {pass:false,detail:{sel:s,hit,note:'no camera view in Details',insp:await ev(pg,()=>({hidden:document.querySelector('#d-insp').hidden,tab:document.querySelector('#p-sel').hidden,txt:document.querySelector('#p-sel').textContent.slice(0,80),has:document.querySelector('#p-sel').innerHTML.includes('cctv-pov'),n:document.querySelectorAll('canvas').length,tail:document.querySelector('#p-sel').innerHTML.slice(-300),selNow:window.__osp.sel()}))}};
    await pg.waitForFunction(()=>{const p=window.__h.pixels('#cctv-pov');return p&&p.range>50},null,{timeout:5000,polling:200}).catch(()=>{});const px0=await H(pg,h=>h.pixels('#cctv-pov'));
    await typeInto('#p-sel [data-f=r]','135');await pg.keyboard.press('Tab');await pg.waitForFunction(h0=>{const p=window.__h.pixels('#cctv-pov');return p&&p.h!==h0},px0.h,{timeout:5000,polling:200}).catch(()=>{});const px1=await H(pg,h=>h.pixels('#cctv-pov'));const r=await ev(pg,()=>window.__osp.byId('mxpov').r);
    await stub3D();return {pass:s.length===1&&s[0]==='mxpov'&&px0.range>50&&px1.h!==px0.h&&r===135,detail:{sel:s,shade:px0.range,changedOnTurn:px1.h!==px0.h,facing:r}}};
  // mutation: app.js:3695 renderPOV returns before drawing → FAIL confirmed
  await chk(s2,'D10','pov','CCTV: picking a camera shows its point of view, turning it redraws the view',()=>povCase(false));
  // mutation: app.js:3695 renderPOV returns before drawing → FAIL confirmed
  if(kind!=='t')await chk(s3,'D10','pov','CCTV: a camera picked in the ceiling plan keeps its point of view in Details in 3D, turning it redraws',()=>povCase(true));

  /* ================= E1 floors ================= */
  // mutation: app.js:3794 switchFloor no longer calls syncFloorIn → FAIL confirmed
  await chk(s2,'E1','add-switch','Floors: + Floor and + Basement add levels; opening a floor shows its own fit-out; the first floor keeps its own',async()=>{await reset();const n0=await ev(pg,()=>window.__osp.S().objs.length);const ids0=await H(pg,h=>h.ids());
    await openFloors();await addFloor();await press('#p-bld [data-bb=addB]');await wait(()=>window.__osp.S().bld.levels.length===3);const L=await ev(pg,()=>{const S=window.__osp.S();return {lv:S.bld.levels.map(l=>l.kind),act:S.bld.active,ids:S.bld.levels.map(l=>l.id)}});
    const l2=L.ids[2];await press(`#p-bld [data-bb=open][data-id="${l2}"]`);await wait(id=>window.__osp.S().bld.active===id,l2);const on2=await ev(pg,()=>{const S=window.__osp.S();return {n:S.objs.length,items:S.objs.filter(x=>x.t==='item'&&!['Door','Window'].includes(x.cat)).length,rooms:S.objs.filter(x=>x.t==='room').length,chip:document.querySelector('#b-floor b').textContent}});
    await ev(pg,()=>{const o=window.__osp,l=o.LIB()[0];o.checkpoint();o.S().objs.push({t:'item',id:'mxL2',code:l.code,name:l.name,cat:l.cat,shape:l.shape,w:l.w,d:l.d,h:l.h,x:0,y:0,r:0});o.render()});
    const l1=L.ids[1];await openFloors();await press(`#p-bld [data-bb=open][data-id="${l1}"]`);await wait(id=>window.__osp.S().bld.active===id,l1);const back=await ev(pg,()=>{const S=window.__osp.S();return {n:S.objs.length,hasL2:!!S.objs.find(x=>x.id==='mxL2'),chip:document.querySelector('#b-floor b').textContent}});const ids1=await H(pg,h=>h.ids());
    await openFloors();await press(`#p-bld [data-bb=open][data-id="${l2}"]`);await wait(id=>window.__osp.S().bld.active===id,l2);const again=await ev(pg,()=>!!window.__osp.S().objs.find(x=>x.id==='mxL2'));await closeFloors();
    return {pass:JSON.stringify(L.lv)==='["B","L","L"]'&&on2.rooms>0&&on2.items===0&&on2.chip==='L2'&&back.n===n0&&!back.hasL2&&ids1===ids0&&back.chip==='L1'&&again,detail:{levels:L.lv,L2:on2,backOnL1:back,sameIds:ids1===ids0,L2keepsItem:again}}});
  // mutation: app.js:3825 reorderLevel no checkpoint (desktop); touch setups red on the real build → FAIL confirmed
  await chk(s2,'E1','reorder-undo','Floors: dragging a floor in the list (or its ▼ button on touch) reorders it, undo puts it back',async()=>{await reset();await openFloors();await addFloor();await addFloor();
    const ord0=await ev(pg,()=>window.__osp.S().bld.levels.map(l=>l.id));const top=ord0[2],mid=ord0[1];
    /* drag the top floor's row by its name onto the lower half of the floor below it */
    await ev(pg,id=>document.querySelector(`#p-bld .lvl[data-lvid="${id}"]`).scrollIntoView({block:'start'}),top);await sleep(100);
    const a=await g(`#p-bld .lvl[data-lvid="${top}"] .lvl-h b`),b2=await g(`#p-bld .lvl[data-lvid="${mid}"] .lvl-h`);const mr=await ev(pg,id=>{const r=document.querySelector(`#p-bld .lvl[data-lvid="${id}"]`).getBoundingClientRect();return {t:r.top,h:r.height,l:r.left,b:r.bottom}},mid);
    if(!a||a.hidden||!b2||b2.hidden)return {pass:false,detail:'floor rows not shown'};const dst=[mr.l+30,Math.min(mr.t+mr.h*0.75,(await ev(pg,()=>innerHeight))-4)];
    /* touch screens reorder with the ▲▼ buttons (rows are not draggable by finger), so the drag is only tried with a mouse */if(kind==='d')await I.drag([a.x,a.y],dst,14);if(false&&I.fin&&kind==='t'){const o1=await ev(pg,()=>window.__osp.S().bld.levels.map(l=>l.id));if(JSON.stringify(o1)===JSON.stringify(ord0))await I.fin.drag([a.x,a.y],dst,14)}
    await sleep(200);let ord1=await ev(pg,()=>window.__osp.S().bld.levels.map(l=>l.id));
    /* touch: row dragging needs a mouse, so the row's ▼ button is the on-screen way to move it down one */
    if(kind!=='d'&&JSON.stringify(ord1)===JSON.stringify(ord0)){const dn=await g(`#p-bld .lvl[data-lvid="${top}"] [data-bb=lvdn]`,'center');if(dn&&!dn.hidden){await press(`#p-bld .lvl[data-lvid="${top}"] [data-bb=lvdn]`,null,'center');await sleep(200);ord1=await ev(pg,()=>window.__osp.S().bld.levels.map(l=>l.id))}}
    if(phone){await closeFloors();await press('#b-undo')}else if(kind==='d'){await ev(pg,()=>document.activeElement&&document.activeElement.blur());await pg.keyboard.press('Control+z')}else await press('#b-undo');await sleep(200);
    const ord2=await ev(pg,()=>window.__osp.S().bld.levels.map(l=>l.id));await closeFloors();
    return {pass:ord1[1]===top&&ord1[2]===mid&&ord1.length===3&&JSON.stringify(ord2)===JSON.stringify(ord0),detail:{before:ord0.map(x=>ord0.indexOf(x)),afterDrag:ord1.map(x=>ord0.indexOf(x)),afterUndo:ord2.map(x=>ord0.indexOf(x))}}});
  // mutation: none needed: FAILS on the real build (+ Floor makes no undo step, app.js:3841)
  await chk(s2,'E1','add-undo','Floors: undo after + Floor removes the new floor',async()=>{await reset();await openFloors();const n0=await ev(pg,()=>{const S=window.__osp.S();return S.bld?S.bld.levels.length:1});await addFloor();const n1=await ev(pg,()=>window.__osp.S().bld.levels.length);
    if(phone)await closeFloors();await press('#b-undo');await sleep(200);const n2=await ev(pg,()=>window.__osp.S().bld.levels.length);await closeFloors();return {pass:n1===n0+1&&n2===n0,detail:{before:n0,added:n1,afterUndo:n2}}});
  // mutation: app.js:3859 level splice removed → FAIL confirmed
  await chk(s2,'E1','delete','Floors: Delete removes the open floor and opens its neighbour with the right objects',async()=>{await reset();const ids0=await H(pg,h=>h.ids());await openFloors();await addFloor();const L=await ev(pg,()=>window.__osp.S().bld.levels.map(l=>l.id));
    await press(`#p-bld [data-bb=open][data-id="${L[1]}"]`);await wait(id=>window.__osp.S().bld.active===id,L[1]);await openFloors();await press(`#p-bld [data-bb=del][data-id="${L[1]}"]`);await wait(()=>window.__osp.S().bld.levels.length===1);
    const r=await ev(pg,()=>{const S=window.__osp.S();return {act:S.bld.active,chip:document.querySelector('#b-floor b').textContent}});const ids1=await H(pg,h=>h.ids());await closeFloors();
    return {pass:r.act===L[0]&&r.chip==='L1'&&ids1===ids0,detail:{activeIsL1:r.act===L[0],chip:r.chip,objectsAreL1:ids1===ids0}}});
  // mutation: app.js:3794 switchFloor no longer calls syncFloorIn (removing build3D at :3795 survived: 3D is rebuilt elsewhere) → FAIL confirmed
  if(kind!=='t')await chk(s3,'E1','floor-3d','Floors in 3D: the floor chip opens another floor and the 3D model follows',async()=>{await reset();await openFloors();await addFloor();await closeFloors();await go3D();const L=await ev(pg,()=>window.__osp.S().bld.levels.map(l=>l.id));
    const f0=await H(pg,h=>h.furnMeshes());await press('#b-floor');await press(`#pop-floor [data-fl="${L[1]}"]`);await wait(id=>window.__osp.S().bld.active===id,L[1]);await sleep(300);const f1=await H(pg,h=>h.furnMeshes());const w1=await H(pg,h=>h.wallTop());
    await press('#b-floor');await press(`#pop-floor [data-fl="${L[0]}"]`);await wait(id=>window.__osp.S().bld.active===id,L[0]);await sleep(300);const f2=await H(pg,h=>h.furnMeshes());
    return {pass:f0>50&&f1===0&&w1.n>0&&f2===f0,detail:{furnL1:f0,furnL2:f1,wallsL2:w1.n,furnBack:f2}}});

  /* ================= E2 shared walls / columns / cores ================= */
  // mutation: app.js:206 isBaseObj no longer counts columns → FAIL confirmed
  await chk(s2,'E2','shared','Typical floors share walls, rooms, doors, columns and cores; moving a column on L2 moves it on L1; furniture stays per floor',async()=>{await reset();
    const fs=await H(pg,h=>h.freeSpots(2));const spot=fs&&{col:fs[0],lift:fs[1]};if(!spot)return {pass:false,detail:'no free spots outside rooms'};
    const col=await libPlace('Column 600 x 600',spot.col);const lift=await libPlace('Lift 13-person',spot.lift);if(!col||!lift)return {pass:false,detail:{col,lift,note:'placing from the library failed'}};
    const base=await ev(pg,()=>{const S=window.__osp.S();return {rooms:S.objs.filter(x=>x.t==='room').map(x=>x.id).sort().join(),doors:S.objs.filter(x=>x.cat==='Door').map(x=>x.id).sort().join(),furn:S.objs.filter(x=>x.t==='item'&&x.cat==='Workstation').length}});
    await openFloors();await addFloor();await closeFloors();const L=await ev(pg,()=>window.__osp.S().bld.levels.map(l=>l.id));await press('#b-floor');await press(`#pop-floor [data-fl="${L[1]}"]`);await wait(id=>window.__osp.S().bld.active===id,L[1]);await sleep(150);
    const on2=await ev(pg,([c,l])=>{const S=window.__osp.S();const C=S.objs.find(x=>x.id===c),F=S.objs.find(x=>x.id===l);return {rooms:S.objs.filter(x=>x.t==='room').map(x=>x.id).sort().join(),doors:S.objs.filter(x=>x.cat==='Door').map(x=>x.id).sort().join(),furn:S.objs.filter(x=>x.t==='item'&&x.cat==='Workstation').length,col:C&&[C.x,C.y],lift:F&&[F.x,F.y]}},[col,lift]);
    const c0=await ev(pg,id=>{const o=window.__osp,c=o.byId(id),V=o.V,r=document.querySelector('#plan').getBoundingClientRect();V.k=0.12;V.x=c.x-r.width/2/V.k;V.y=c.y-r.height/2/V.k;window.dispatchEvent(new Event('resize'));return [c.x,c.y]},col);await sleep(150);const p=await H(pg,(h,o,id)=>h.pt2(id),col);if(!p)return {pass:false,detail:{on2,note:'column not hittable on L2'}};
    await I.drag(p,[p[0],p[1]+60],10);await sleep(150);const c1=await ev(pg,id=>{const o=window.__osp.byId(id);return [o.x,o.y]},col);
    await press('#b-floor');await press(`#pop-floor [data-fl="${L[0]}"]`);await wait(id=>window.__osp.S().bld.active===id,L[0]);await sleep(150);const c2=await ev(pg,id=>{const o=window.__osp.byId(id);return o&&[o.x,o.y]},col);
    return {pass:on2.rooms===base.rooms&&on2.doors===base.doors&&base.furn>0&&on2.furn===0&&!!on2.col&&!!on2.lift&&c1[1]>c0[1]+300&&JSON.stringify(c2)===JSON.stringify(c1),detail:{roomsShared:on2.rooms===base.rooms,doorsShared:on2.doors===base.doors,furnL1:base.furn,furnL2:on2.furn,colOnL2:!!on2.col,liftOnL2:!!on2.lift,colMovedMm:c1[1]-c0[1],colOnL1:c2}}});

  /* ================= E3 roof ================= */
  // mutation: app.js:3785 enterRoof keeps the floor's objects → FAIL confirmed
  await chk(s2,'E3','roof','Roof: the floor chip opens Roof, a unit placed there stays on the roof, choosing L1 comes back with L1 intact',async()=>{await reset();const ids0=await H(pg,h=>h.ids());
    await press('#b-floor');await press('#pop-floor [data-fl="roof"]');await wait(()=>window.__osp.roofMode());const r1=await ev(pg,()=>({n:window.__osp.S().objs.length,chip:document.querySelector('#b-floor b').textContent}));
    const sp=await ev(pg,()=>{const o=window.__osp;const r=document.querySelector('#plan').getBoundingClientRect();return o.toWorld({clientX:r.left+r.width*0.5,clientY:r.top+r.height*0.5})});const id=await libPlace('Workstation 1200',sp);
    const r2=await ev(pg,()=>window.__osp.S().objs.length);const L1=await ev(pg,()=>window.__osp.S().bld.levels[0].id);await press('#b-floor');await press(`#pop-floor [data-fl="${L1}"]`);await wait(()=>!window.__osp.roofMode());
    const r3=await ev(pg,()=>({roofFit:(window.__osp.roofFit()||[]).length,chip:document.querySelector('#b-floor b').textContent}));const ids1=await H(pg,h=>h.ids());
    return {pass:r1.n===0&&r1.chip==='Roof'&&!!id&&r2===1&&r3.roofFit===1&&r3.chip==='L1'&&ids1===ids0,detail:{onRoof:r1,placed:!!id,roofObjs:r2,after:r3,L1intact:ids1===ids0}}});
  // mutation: app.js:3786 enterRoof no longer sets bldView in 3D → FAIL confirmed
  if(kind!=='t')await chk(s3,'E3','roof3d','Roof in 3D: choosing Roof shows the building; choosing L1 comes back to the floor in 3D',async()=>{await reset();await go3D();await press('#b-floor');await press('#pop-floor [data-fl="roof"]');await wait(()=>window.__osp.roofMode());await stub3D();await sleep(200);
    const a=await ev(pg,()=>({bld:!!window.__osp.bldView(),chip:document.querySelector('#b-floor b').textContent}));const L1=await ev(pg,()=>window.__osp.S().bld.levels[0].id);await press('#b-floor');await press(`#pop-floor [data-fl="${L1}"]`);await wait(()=>!window.__osp.roofMode());await sleep(200);
    const b2=await ev(pg,()=>({v3:!document.querySelector('#v3').hidden,chip:document.querySelector('#b-floor b').textContent,n:window.__osp.S().objs.length}));return {pass:a.bld&&a.chip==='Roof'&&b2.v3&&b2.chip==='L1'&&b2.n>100,detail:{roof:a,back:b2}}});

  /* ================= E4 building fields ================= */
  // mutation: app.js:3833 Floors-tab default field change no longer stored → FAIL confirmed
  await chk(s2,'E4','fields','Floors tab: Floor to ceiling, Slab, a floor\'s Floor to floor and North fields apply',async()=>{await reset();await openFloors();await addFloor();
    const ffl=()=>ev(pg,()=>[...document.querySelectorAll('#p-bld .lvl .lvl-h .muted')].map(e=>e.textContent));const f0=await ffl();
    await typeInto('#p-bld [data-bk=ceiling]','3000');await pg.keyboard.press('Tab');await sleep(150);const b1=await ev(pg,()=>window.__osp.S().bld.ceiling);const f1=await ffl();
    await typeInto('#p-bld [data-bk=slab]','300');await pg.keyboard.press('Tab');await sleep(150);const b2=await ev(pg,()=>window.__osp.S().bld.slab);
    const L1=await ev(pg,()=>window.__osp.S().bld.levels[0].id);await typeInto(`#p-bld [data-lv="${L1}"][data-k=ftf]`,'4500');await pg.keyboard.press('Tab');await sleep(150);const l1=await ev(pg,()=>window.__osp.S().bld.levels[0].ceiling);
    await typeInto('#bld-north','30');await pg.keyboard.press('Tab');await sleep(150);const n=await ev(pg,()=>({n:window.__osp.S().north,w:document.querySelector('#north .nv').textContent}));await closeFloors();await ev(pg,()=>window.__osp.setNorth(0));
    return {pass:b1===3000&&f1.join()!==f0.join()&&b2===300&&l1===4500-900-300&&n.n===30&&n.w==='30°',detail:{ceiling:b1,fflText:[f0[0],f1[0]],slab:b2,L1ceilingFromFtf:l1,north:n}}});
  // mutation: app.js:3821 bldChanged no longer rebuilds the Building view → FAIL confirmed
  if(kind!=='t')await chk(s3,'E4','fields3d','Floors tab in Building view: a taller Floor to ceiling raises the upper floor in 3D',async()=>{await reset();await openFloors();await addFloor();await closeFloors();await go3D();await press('#vbld');await wait(()=>window.__osp.bldView());await stub3D();await sleep(250);
    const y0=await H(pg,h=>h.levelYs());await openFloors();await typeInto('#p-bld [data-bk=ceiling]','3800');await pg.keyboard.press('Tab');await sleep(400);const y1=await H(pg,h=>h.levelYs());await closeFloors();
    const gap0=y0[1]-y0[0],gap1=y1[1]-y1[0];return {pass:y0.length===2&&y1.length===2&&Math.abs((gap1-gap0)-1.0)<0.02,detail:{before:y0,after:y1,gapBefore:+gap0.toFixed(3),gapAfter:+gap1.toFixed(3)}}});

  R.push(row(`mx-vb-${s2}-clean`,`${dev[s2]}: no console errors in the views and building checks`,pg.errs.length===0,pg.errs.slice(0,5)));
  await pg.ctx.close();return R}

export async function run(b){const only=process.env.MXVB_DEV;const ks=['d','p','t'].filter(k=>!only||only.split(',').includes(k));
  const parts=await Promise.all(ks.map(k=>suite(b,k).catch(e=>[row(`mx-vb-${k}-crash`,`suite ${k} crashed`,false,String(e.stack||e).slice(0,300))])));return parts.flat()}
