<script>(function(){
'use strict';
/* ================= utilities ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>Math.random().toString(36).slice(2,10);
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=(v,d)=>{const n=parseFloat(v);return isFinite(n)?n:(d===undefined?0:d)};
const r1=v=>Math.round(v);
const fmt=v=>Math.round(v).toLocaleString('en-SG');
const store={off:false,get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){if(store.off)return false;try{localStorage.setItem(k,v);return true}catch(e){return false}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const isMac=/Mac|iPhone|iPad/.test(navigator.platform||'');

/* ================= CSV ================= */
function parseCSV(text){
  const rows=[];let row=[],f='',q=false;
  text=String(text).replace(/^﻿/,'');
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;
    else if(c===','){row.push(f);f=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f);f='';if(row.some(x=>x!==''))rows.push(row);row=[]}
    else f+=c}
  row.push(f);if(row.some(x=>x!==''))rows.push(row);
  return rows;
}
const csvCell=v=>{v=v==null?'':String(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const toCSV=rows=>rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
const LIB_COLS=['code','name','category','shape','width_mm','depth_mm','height_mm','leg_mm','seats','clear_front_mm','clear_back_mm','nests','unit_rate','components','arm_rests','discipline'];
/* chairs have arm rests unless the library or the item says no; pantry chairs never do */
const hasArms=o=>o.shape==='chair'&&(o.arms!=null?!!o.arms:!(o.cat==='Pantry'||/pantry/i.test(o.name||'')));
/* sets: components "CODE@x,y,rot;CODE@x,y,rot" relative to the set centre */
function parseComps(s){return String(s||'').split(';').map(t=>t.trim()).filter(Boolean).map(t=>{const m=t.split('@');const p=(m[1]||'0,0,0').split(',').map(v=>num(v,0));return{code:m[0].trim(),x:p[0]||0,y:p[1]||0,r:p[2]||0}})}
const compsStr=c=>(c||[]).map(x=>`${x.code}@${Math.round(x.x)},${Math.round(x.y)},${Math.round(x.r)}`).join(';');
function libFromCSV(text){
  const rows=parseCSV(text);if(!rows.length)throw new Error('The file is empty.');
  const h=rows[0].map(x=>x.trim().toLowerCase());
  const ix=k=>h.indexOf(k);
  if(ix('name')<0||ix('width_mm')<0||ix('depth_mm')<0)throw new Error('The CSV needs at least name, width_mm and depth_mm columns.');
  const g=(r,k)=>{const i=ix(k);return i<0?'':(r[i]||'').trim()};
  const out=[];
  rows.slice(1).forEach((r,n)=>{
    const comps=parseComps(g(r,'components'));const isSet=g(r,'shape').toLowerCase()==='set'||comps.length>0;
    const w=num(g(r,'width_mm')),d=num(g(r,'depth_mm'));if(!g(r,'name'))return;if(!isSet&&!(w>0&&d>0))return;if(isSet&&!comps.length)return;
    out.push({code:g(r,'code')||('ITEM'+(n+1)),name:g(r,'name'),cat:g(r,'category')||(isSet?'Workstation set':'Custom'),shape:isSet?'set':(g(r,'shape')||'rect'),w:w||1000,d:d||1000,h:num(g(r,'height_mm'),750),a:num(g(r,'leg_mm'),0),seats:num(g(r,'seats'),0),cf:num(g(r,'clear_front_mm'),0),cb:num(g(r,'clear_back_mm'),0),nests:/^(y|yes|true|1)$/i.test(g(r,'nests')),rate:g(r,'unit_rate')===''?null:num(g(r,'unit_rate'),null),pts:null,comps:isSet?comps:null,arms:g(r,'arm_rests')===''?null:/^(y|yes|true|1)$/i.test(g(r,'arm_rests')),disc:g(r,'discipline')||undefined});
  });
  if(!out.length)throw new Error('No usable rows found. Check width_mm and depth_mm are numbers.');
  resolveSets(out);
  return out;
}
/* work out each set's footprint and seat count from its components */
function resolveSets(lib){
  lib.forEach(l=>{if(l.shape!=='set')return;const pts=[];let seats=0,ok=true;
    l.comps.forEach(c=>{const li=lib.find(z=>z.code===c.code&&z.shape!=='set');if(!li){ok=false;return}seats+=(+li.seats||0);[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{const q=rotPt(sx*li.w/2,sy*li.d/2,0,0,c.r);pts.push([q[0]+c.x,q[1]+c.y])})});
    l.missing=!ok;if(pts.length){const b=bboxPts(pts),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;if(Math.abs(cx)>1||Math.abs(cy)>1)l.comps.forEach(c=>{c.x-=cx;c.y-=cy});l.w=Math.round(b.x1-b.x0);l.d=Math.round(b.y1-b.y0);l.seats=seats}});
}
function libToCSV(lib){return toCSV([LIB_COLS].concat(lib.map(l=>[l.code,l.name,l.cat,l.shape,l.w,l.d,l.shape==='set'?'':l.h,l.a||'',l.seats,l.cf,l.cb,l.nests?'yes':'no',l.rate==null?'':l.rate,l.shape==='set'?compsStr(l.comps):'',l.shape==='chair'?(hasArms(l)?'yes':'no'):'',l.disc||''])))}

/* ================= files ================= */
function download(name,data,type){
  const blob=data instanceof Blob?data:new Blob([data],{type:type||'text/plain'});
  /* on touch devices the Share sheet is the natural way out: Files, OneDrive, mail, AirDrop. Anything else, or a refusal, falls back to a plain download. */
  if(matchMedia('(pointer:coarse)').matches&&navigator.share&&navigator.canShare){try{const f=new File([blob],name,{type:blob.type});if(navigator.canShare({files:[f]})){navigator.share({files:[f],title:name}).catch(e=>{if(e&&e.name!=='AbortError')dlAnchor(name,blob)});return}}catch(e){}}
  dlAnchor(name,blob)}
function dlAnchor(name,blob){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
}
async function saveText(name,text,type,ext,desc){
  if(window.showSaveFilePicker){
    try{const h=await window.showSaveFilePicker({suggestedName:name,types:[{description:desc,accept:{[type]:[ext]}}]});const w=await h.createWritable();await w.write(text);await w.close();return h}
    catch(e){if(e&&e.name==='AbortError')return null}
  }
  download(name,text,type);return 'download';
}

/* ================= categories ================= */
const CATS={Workstation:'ws',Seating:'seat',Meeting:'meet',Storage:'store',Pantry:'pantry',IT:'it',Equipment:'equip',Lounge:'soft',Partition:'part',Door:'door',Window:'win',Column:'col',Ceiling:'ceil',Core:'core',Site:'site',Custom:'custom'};
/* ceiling items: lights, services, sensors, cameras, hanging acoustic panels. Per floor, like furniture */
const isCeil=o=>!!o&&o.t==='item'&&o.cat==='Ceiling';
/* cores: stairs, lifts and shafts belong to the building and show on every floor they run through */
const isCore=o=>!!o&&o.t==='item'&&o.cat==='Core';
/* objects kept once for the whole building: cores and the columns a column grid places */
/* site: roads, fences and outdoor items live once for the building, on the ground floor */
const isSite=o=>!!o&&((o.t==='wall'&&!!o.site)||(o.t==='item'&&o.cat==='Site'));
const isBldObj=o=>isCore(o)||isSite(o)||(!!o&&o.t==='item'&&o.cat==='Column'&&!!o.bldCol);
/* things that live on a wall: windows sit in it, wall-mounted FCUs sit on its face */
const isWallMount=o=>!!o&&o.t==='item'&&(o.shape==='window'||o.shape==='fcuw');
const isCCTV=o=>isCeil(o)&&/^cctv/.test(o.shape||'');
const ROUND_SHAPES=['round','colr','cctv','fan','det','spr','dl','pend','spk','wap','pir'];
/* what can be clicked: the ceiling plan picks ceiling items, the floor plan everything else */
const pickable=o=>isCeil(o)?!!P.rcp:!(P.rcp&&o.t==='item');
const isCol=o=>!!o&&o.t==='item'&&(o.shape==='col'||o.shape==='colr');
function makeColumn(round,w,d,x,y,det){const o={id:uid(),t:'item',code:round?'CR'+Math.round(w):'C'+Math.round(w)+(Math.abs(w-d)>5?'x'+Math.round(d):''),name:round?`Round column ${Math.round(w)}`:`Column ${Math.round(w)} x ${Math.round(d)}`,cat:'Column',shape:round?'colr':'col',w:Math.round(w),d:Math.round(round?w:d),h:0,a:0,seats:0,cf:0,cb:0,nests:false,rate:null,pts:null,x:Math.round(x),y:Math.round(y),r:0,gid:null,label:''};if(det)o.det=true;return o}
/* doors and windows sit in walls, belong to the floor layout and live on the Doors and windows layer */
const isOpening=o=>!!o&&o.t==='item'&&(o.cat==='Door'||o.cat==='Window'||/^door/.test(o.shape||'')||o.shape==='window');
const isWin=o=>!!o&&o.t==='item'&&o.shape==='window';
const catCls=c=>'cat-'+(CATS[c]||'custom');

/* ================= state ================= */
const PREF_DEF={wall3d:'full',grid:1000,snap:true,snapSize:50,osnap:true,ortho:true,dims:'sel',gaps:true,clear:true,clash:true,wall:150,theme:'system',fill:'solid',lbl:'name',inv:true,lib:true,insp:true,roadW:6000,fenceH:2400,paintCol:'#d9c7a7',paintFace:false,trunkW:150,trunkH:100};
let P=Object.assign({},PREF_DEF);try{Object.assign(P,JSON.parse(store.get('osk-prefs')||'{}'))}catch(e){}
if(P.dims===true)P.dims='sel';if(P.dims===false)P.dims='off';
if(!P.layers||typeof P.layers!=='object')P.layers={};if(!Array.isArray(P.hideCats))P.hideCats=[];
if(P.clear===false)P.layers.zones=false;if(P.gaps===false)P.layers.gaps=false;if(P.dims==='off'){P.layers.walldims=false;P.dims='sel'}delete P.clear;delete P.gaps;
const LY=k=>k==='secz'?P.layers.secz===true:P.layers[k]!==false;
function visible(o){if(typeof SU!=='undefined'&&SU&&SU.hidden.size&&SU.hidden.has(o.id))return false;if(isSite(o))return LY('site');if(o.t==='room'||o.t==='wall')return LY('walls');if(o.t==='item')return isCeil(o)?LY('ceil'):(isCol(o)||isCore(o))?LY('walls'):isOpening(o)?LY('doors'):(LY('furn')&&!P.hideCats.includes(o.cat)&&!(o.setCat&&P.hideCats.includes(o.setCat)));if(o.t==='text')return LY('texts');if(o.t==='dim')return LY('measures');if(o.t==='trunk')return LY('ceil');return true}
const savePrefs=()=>store.set('osk-prefs',JSON.stringify(P));
if(!P.det||typeof P.det!=='object')P.det={tmin:75,tmax:350,gap:1850,rooms:true};

/* ================= versions and migrations =================
   APP_VERSION  what users see.
   PLAN_V       plan file (.json) format. Bump it when the meaning of saved data changes, and add a step to PLAN_STEPS.
   LIB_V        built-in library revision. Bump it when built-in items change, and add a step to LIB_STEPS.
   Rules that keep old files opening:
   - steps run in order from the file's version up to the current one; never edit or remove an old step
   - each step must be safe to run twice
   - only change values that still equal the old default, so users' own edits survive
   - anything this version does not understand (new object types, new fields) is kept and written back on save */
const APP_VERSION='5.0.0',PLAN_V=6,LIB_V=11;
/* numbered test builds handed over before a release: shown in the tab title and the More menu. Empty for a release. */
const APP_TEST='test 12',APP_FORK='sketchup';
const KNOWN_T=['room','wall','item','text','dim','trunk'];
/* v1 rack clearances were service aisles; v2 stores door leaf widths */
const OLD_RACK={RK6010:[1200,1000],RK6012:[1200,1000],RK8010:[1200,1000],IRC3012:[1200,1000],UPS6085:[1000,600],WMC6045:[900,0]};
let DEF_LIB=null;const defLib=()=>DEF_LIB||(DEF_LIB=libFromCSV(DEFAULT_LIB_CSV));
function rackSwingFix(o){const old=OLD_RACK[o.code];if(!old||o.shape!=='rack')return false;if(num(o.cf)!==old[0]||num(o.cb)!==old[1])return false;const d=defLib().find(l=>l.code===o.code);if(!d)return false;o.cf=d.cf;o.cb=d.cb;return true}
const PLAN_STEPS={
  /* v5 -> v6: a plan becomes a building with one floor (L1) */
  5:(p,notes)=>{if(!p.bld)ensureBld(p)},
  /* v4 -> v5: curved wall segments (bulge), plan, room and wall colours. All optional, so nothing to rewrite */
  4:(p,notes)=>{},
  /* v3 -> v4: height-adjustable desks show at seated height (740) instead of full rise (1250) */
  3:(p,notes)=>{let n=0;p.objs.forEach(o=>{if(o&&o.t==='item'&&o.code==='HA1470'&&num(o.h)===1250){o.h=740;n++}});if(n)notes.push(`${n} height-adjustable ${n===1?'desk now shows':'desks now show'} at seated height`)},
  /* v2 -> v3: chairs carry an arms flag, doors a flip flag. Both default safely, so nothing to rewrite; the bump lets 2.2 warn that the file is newer */
  2:(p,notes)=>{},
  1:(p,notes)=>{let n=0;p.objs.forEach(o=>{if(o&&o.t==='item'&&rackSwingFix(o))n++});if(n)notes.push(`${n} rack door ${n===1?'swing was':'swings were'} updated to the door width`)}
};
const LIB_STEPS={
  10:(lib,notes)=>{const def=defLib();const add=def.filter(d=>d.cat==='Solar PV'&&!lib.some(l=>l.code===d.code));add.forEach(d=>lib.push(clone(d)));if(add.length)notes.push('Library updated: solar PV module (Mechanical)')},
  9:(lib,notes)=>{const def=defLib();const add=def.filter(d=>d.cat==='Site'&&!lib.some(l=>l.code===d.code));add.forEach(d=>lib.push(clone(d)));if(add.length)notes.push(`Library updated: ${add.length} site items (gates, barriers, trees, parking)`)},
  8:(lib,notes)=>{const def=defLib();const add=def.filter(d=>d.shape==='fcuw'&&!lib.some(l=>l.code===d.code));add.forEach(d=>lib.push(clone(d)));if(add.length)notes.push(`Library updated: ${add.length} wall-mounted FCUs`)},
  7:(lib,notes)=>{const def=defLib();const add=def.filter(d=>d.cat==='Core'&&!lib.some(l=>l.code===d.code));add.forEach(d=>lib.push(clone(d)));if(add.length)notes.push(`Library updated: ${add.length} stairs, lifts and shafts`)},
  6:(lib,notes)=>{const def=defLib();const add=def.filter(d=>d.cat==='Ceiling'&&!lib.some(l=>l.code===d.code));add.forEach(d=>lib.push(clone(d)));if(add.length)notes.push(`Library updated: ${add.length} ceiling items (lights, services, sensors, cameras, acoustic panels)`)},
  5:(lib,notes)=>{const def=defLib();const add=def.filter(d=>d.cat==='Column'&&!lib.some(l=>l.code===d.code));add.forEach(d=>lib.push(clone(d)));if(add.length)notes.push(`Library updated: ${add.length} columns`)},
  4:(lib,notes)=>{const def=defLib();const add=def.filter(d=>d.cat==='Window'&&!lib.some(l=>l.code===d.code));add.forEach(d=>lib.push(clone(d)));if(add.length)notes.push(`Library updated: ${add.length} windows and glazing panels`)},
  3:(lib,notes)=>{const l=lib.find(x=>x.code==='HA1470');if(l&&num(l.h)===1250){l.h=740;notes.push('Height-adjustable desk shows at seated height (740 mm)')}},
  2:(lib,notes)=>{const def=defLib();const want=['WS1570','WSS1570','CH-PAN'];const add=def.filter(d=>want.includes(d.code)&&!lib.some(l=>l.code===d.code));
    const after={'WS1570':'WS1470','WSS1570':'WSS1470','CH-PAN':'CH-VIS'};
    add.forEach(d=>{const i=lib.findIndex(l=>l.code===after[d.code]);if(i>=0)lib.splice(i+1,0,clone(d));else lib.push(clone(d))});
    if(add.length)notes.push(`Library updated: ${add.map(d=>d.name).join(', ')}`);resolveSets(lib)},
  1:(lib,notes)=>{const def=defLib();let n=0;
    lib.forEach(l=>{if(rackSwingFix(l))n++});
    const add=def.filter(d=>(d.shape==='set'||d.code==='RK6008')&&!lib.some(l=>l.code===d.code));
    add.forEach(d=>{const after=d.code==='RK6008'?lib.findIndex(l=>l.code==='RK6010'):lib.reduce((p,l,i)=>l.cat===d.cat?i:p,lib.findIndex(l=>l.code===(d.cat==='Meeting set'?'HT1860':'EX2018')));if(after>=0)lib.splice(after+(d.code==='RK6008'?0:1),0,clone(d));else lib.push(clone(d))});
    if(n||add.length)notes.push('Library updated: '+[add.length?`${add.length} new items and sets`:'',n?`${n} rack swings`:''].filter(Boolean).join(', '));resolveSets(lib)}
};
/* nothing in a plan is further than 10 km from the origin or larger than that: beyond it the drawing maths breaks down */
const LIM=1e7;const inLim=v=>typeof v!=='boolean'&&v!==null&&v!==''&&isFinite(v)&&Math.abs(v)<=LIM;
const isPair=p=>Array.isArray(p)&&p.length>=2&&inLim(p[0])&&inLim(p[1]);
/* clean one saved object; returns the object, 'unknown' for a type this version cannot show, or null if it is broken */
function normObj(o,seen){
  if(!o||typeof o!=='object')return null;
  if(typeof o.t!=='string'||!o.t)return null;
  if(!KNOWN_T.includes(o.t))return 'unknown';
  const n=Object.assign({},o);
  if(typeof n.id!=='string'||!n.id||seen.has(n.id))n.id=uid();seen.add(n.id);
  if(n.gid!=null&&typeof n.gid!=='string')n.gid=String(n.gid);if(n.gid===undefined)n.gid=null;
  const pts=a=>Array.isArray(a)?a.filter(isPair).map(p=>[+p[0],+p[1]]):[];
  if(n.t==='room'){n.pts=pts(n.pts);if(n.pts.length<3)return null;n.name=String(n.name==null?'Room':n.name)}
  else if(n.t==='wall'){n.pts=pts(n.pts);if(n.pts.length<2)return null;n.th=num(n.th,100)>0?num(n.th,100):100;n.closed=!!n.closed;if(Array.isArray(n.bulge))n.bulge=n.bulge.map(v=>num(v,0));else delete n.bulge}
  else if(n.t==='item'){n.w=num(n.w,0);n.d=num(n.d,0);if(!(n.w>0&&n.d>0)||n.w>LIM||n.d>LIM)return null;n.x=num(n.x,0);n.y=num(n.y,0);if(!inLim(n.x)||!inLim(n.y))return null;n.r=num(n.r,0);if(Math.abs(n.r)>LIM)n.r=0;
    n.shape=String(n.shape||'rect');n.cat=String(n.cat||'Custom');n.code=String(n.code==null?'':n.code);n.name=String(n.name==null?'Item':n.name);n.label=String(n.label==null?'':n.label);
    ['h','a','seats','cf','cb'].forEach(k=>{n[k]=num(n[k],k==='h'?750:0);if(Math.abs(n[k])>LIM)n[k]=k==='h'?750:0});n.nests=!!n.nests;if(n.arms!=null)n.arms=!!n.arms;if(n.flip!=null)n.flip=!!n.flip;n.rate=n.rate==null||n.rate===''?null:num(n.rate,null);
    n.pts=n.shape==='poly'?pts(n.pts):null;if(n.shape==='poly'&&n.pts.length<3)n.shape='rect';if(n.shape==='window'){n.sill=Math.max(0,num(n.sill,900));n.h=Math.max(0,n.h)}
    if(n.cat==='Core'){n.from=n.from?String(n.from):null;n.to=n.to?String(n.to):null;n.roof=n.shape==='stair'?n.roof!==false:false;n.h=0}
    if(n.cat==='Ceiling'){n.drop=Math.max(0,num(n.drop,0));n.cov=Math.max(0,num(n.cov,0));if(/^cctv/.test(n.shape)){n.tilt=Math.max(0,Math.min(90,num(n.tilt,20)));n.fov=Math.max(50,Math.min(180,num(n.fov,90)));n.range=Math.max(500,num(n.range,15000))}}}
  else if(n.t==='text'){n.x=num(n.x,0);n.y=num(n.y,0);if(!inLim(n.x)||!inLim(n.y))return null;if(n.r!=null){n.r=((Math.round(num(n.r,0))%360)+360)%360;if(!n.r)delete n.r}n.size=num(n.size,250)>0?num(n.size,250):250;n.text=String(n.text==null?'':n.text)}
  else if(n.t==='dim'){if(!isPair(n.a)||!isPair(n.b))return null;n.a=[+n.a[0],+n.a[1]];n.b=[+n.b[0],+n.b[1]]}
  else if(n.t==='trunk'){if(!Array.isArray(n.pts)||n.pts.length<2)return null;n.pts=n.pts.filter(isPair).map(p=>[+p[0],+p[1]]);if(n.pts.length<2)return null;n.w=Math.max(20,num(n.w,150));n.h=Math.max(20,num(n.h,100));n.drop=Math.max(0,num(n.drop,30))}
  return n;
}
/* any saved plan, any version -> current in-memory plan */
const NAME_MAX=120;const PLAN_KEYS=['comps','scenes','guides','axes','app','appVersion','v','name','objs','extraObjs','underlay','locked','bld','north','pid','pins','snaps','revs','notes','style','section','fire','cost','brief','prog','site','saved'];
/* is this value nested deeper than d levels? (no recursion, so a hostile file cannot exhaust the stack) */
function tooDeep(v,d){let cur=[v];for(let i=0;i<=d;i++){const nx=[];for(const x of cur){if(x&&typeof x==='object')for(const k in x){const y=x[k];if(y&&typeof y==='object')nx.push(y)}}if(!nx.length)return false;cur=nx}return true}
function migratePlan(raw){
  if(!raw||typeof raw!=='object'||!Array.isArray(raw.objs))throw new Error('Not a plan file.');
  const p=clone(raw);const notes=[];const fileV=Math.max(1,Math.floor(num(p.v,1)));let v=fileV;
  while(v<PLAN_V){if(PLAN_STEPS[v])PLAN_STEPS[v](p,notes);v++}
  const seen=new Set(),objs=[],extra=Array.isArray(p.extraObjs)?p.extraObjs.slice():[];let bad=0;
  p.objs.forEach(o=>{const n=normObj(o,seen);if(n==='unknown')extra.push(o);else if(n)objs.push(n);else bad++});
  let u=p.underlay;
  if(u&&typeof u==='object'){u=Object.assign({},u);['x','y','w','h','mpp'].forEach(k=>u[k]=num(u[k],k==='mpp'?10:0));if(!(u.mpp>0))u.mpp=10;if(u.src&&typeof u.src!=='string')u.src=null}else u=null;
  if(fileV>PLAN_V)notes.unshift(`This file was saved by a newer version of the planner (plan format ${fileV}). Get the latest planner to see everything in it`);
  if(extra.length)notes.push(`${extra.length} ${extra.length===1?'object':'objects'} from a newer version kept but not shown`);
  if(bad)notes.push(`${bad} damaged ${bad===1?'object was':'objects were'} skipped`);
  const out=Object.assign({},p,{v:Math.max(fileV,PLAN_V),name:String(p.name||'Untitled plan').slice(0,NAME_MAX),objs,underlay:u,locked:!!p.locked});
  /* parts that must be lists or text: anything else is dropped, with a note */
  {const dropped=[];if(out.guides!=null){if(!Array.isArray(out.guides)){delete out.guides;dropped.push('guides')}else out.guides=out.guides.filter(g=>g&&Array.isArray(g.a)&&Array.isArray(g.b)&&[g.a[0],g.a[1],g.b[0],g.b[1]].every(v=>typeof v==='number'&&isFinite(v)&&Math.abs(v)<=1e7)).map(g=>({a:[g.a[0],g.a[1]],b:[g.b[0],g.b[1]]}))}if(out.comps!=null){if(typeof out.comps!=='object'||Array.isArray(out.comps)){delete out.comps;dropped.push('comps')}else{const c2={};Object.keys(out.comps).slice(0,2000).forEach(k=>{const c=out.comps[k];if(c&&typeof c==='object'&&Array.isArray(c.objs))c2[k]={name:String(c.name||'Component').slice(0,60),objs:c.objs.filter(x=>x&&typeof x==='object'&&typeof x.t==='string').slice(0,5000)}});if(Object.keys(c2).length)out.comps=c2;else delete out.comps}}if(out.scenes!=null){if(!Array.isArray(out.scenes)){delete out.scenes;dropped.push('scenes')}else out.scenes=out.scenes.filter(c=>c&&typeof c==='object'&&c.v&&[c.v.x,c.v.y,c.v.k].every(v=>typeof v==='number'&&isFinite(v))).slice(0,100).map(c=>{const n={name:String(c.name||'Scene').slice(0,60),v:{x:c.v.x,y:c.v.y,k:c.v.k},d3:!!c.d3};if(c.cam&&Array.isArray(c.cam.p)&&Array.isArray(c.cam.t)&&c.cam.p.concat(c.cam.t).every(v=>typeof v==='number'&&isFinite(v)))n.cam={p:c.cam.p.slice(0,3),t:c.cam.t.slice(0,3),fov:+c.cam.fov||50};if(c.par)n.par=true;if(c.xray)n.xray=true;if(Array.isArray(c.hidden))n.hidden=c.hidden.filter(x=>typeof x==='string').slice(0,20000);return n})}['pins','snaps','revs'].forEach(k=>{if(out[k]!=null&&!Array.isArray(out[k])){delete out[k];dropped.push(k)}else if(Array.isArray(out[k]))out[k]=out[k].filter(x=>x&&typeof x==='object')});if(out.notes!=null&&typeof out.notes!=='string'){delete out.notes;dropped.push('notes')}
    const known=new Set(PLAN_KEYS);Object.keys(out).forEach(k=>{if(!known.has(k)&&out[k]&&typeof out[k]==='object'&&tooDeep(out[k],12)){delete out[k];dropped.push(k)}});
    if(dropped.length)notes.push(`${dropped.length} damaged ${dropped.length===1?'part':'parts'} of the file (${dropped.join(', ')}) ${dropped.length===1?'was':'were'} left out`)}
  if(extra.length)out.extraObjs=extra;else delete out.extraObjs;
  /* building contents: clean every floor, then rebuild the active floor from them */
  ensureBld(out);{const b=out.bld;const norm=arr=>{const seen=new Set();return(Array.isArray(arr)?arr:[]).map(o=>normObj(o,seen)).filter(o=>o&&o!=='unknown')};
    b.typical=norm(b.typical);b.cores=norm(b.cores);b.levels=b.levels.filter(l=>l&&typeof l==='object').map(l=>Object.assign(l,{id:String(l.id||uid()),kind:l.kind==='B'?'B':'L',unique:!!l.unique,fit:norm(l.fit),base:l.unique?norm(l.base):undefined,names:l.names&&typeof l.names==='object'?l.names:{}}));
    if(!b.levels.length)b.levels.push({id:uid(),kind:'L',unique:false,fit:[],names:{}});b.levels.sort((x,y)=>(x.kind==='B'?0:1)-(y.kind==='B'?0:1));if(!b.levels.some(l=>l.id===b.active))b.active=bldLevel(out).id;syncFloorIn(out)}
  out.north=((Math.round(num(out.north,0))%360)+360)%360;if(!out.pid||typeof out.pid!=='string')out.pid=uid();
  return{plan:out,notes,fileV};
}

/* ================= building: floors share a base layer =================
   plan.bld = {ceiling, void, slab, slabB1, roofSlab, parapet, typical:[base objects], levels:[...bottom to top], active}
   level = {id, kind:'B'|'L', unique, base (only when unique), fit:[fit-out objects], names:{roomId:name}, ceiling?, void?, slab?}
   Base objects (walls, doors, rooms) come from the typical floor unless the floor is unique. Fit-out (furniture, text, dimensions) is per floor,
   and room names can differ per floor. plan.objs always holds the active floor (base + fit-out) so every editing tool works unchanged;
   it is split back into the building whenever the plan is saved, autosaved or another floor is opened. */
const BLD_DEF={ceiling:2800,void:900,slab:250,slabB1:400,roofSlab:300,parapet:1000};
const isBaseObj=o=>!!o&&!isSite(o)&&(o.t==='wall'||o.t==='room'||isOpening(o)||isCol(o));
function ensureBld(plan){if(plan.bld&&Array.isArray(plan.bld.levels)&&plan.bld.levels.length){for(const k in BLD_DEF)if(plan.bld[k]==null)plan.bld[k]=BLD_DEF[k];if(!Array.isArray(plan.bld.cores))plan.bld.cores=[];if(!Array.isArray(plan.bld.roofFit))plan.bld.roofFit=[];return plan.bld}
  const id=uid(),objs=plan.objs||[];plan.bld=Object.assign({},BLD_DEF,{typical:objs.filter(isBaseObj).map(o=>Object.assign({},o)),cores:objs.filter(isBldObj).map(o=>Object.assign({},o)),roofFit:[],levels:[{id,kind:'L',unique:false,fit:objs.filter(o=>!isBaseObj(o)&&!isBldObj(o)),names:{}}],active:id});return plan.bld}
/* which floors a core runs through: from / to are level ids, empty = lowest / highest */
function coreRange(b,c){const L=b.levels;let lo=c.from?L.findIndex(l=>l.id===c.from):0,hi=c.to?L.findIndex(l=>l.id===c.to):L.length-1;if(lo<0)lo=0;if(hi<0)hi=L.length-1;if(hi<lo)[lo,hi]=[hi,lo];return[lo,hi]}
const groundI=b=>Math.max(0,b.levels.findIndex(l=>l.kind!=='B'));
const coreOn=(b,c,i)=>{if(isSite(c))return i===groundI(b);const[lo,hi]=coreRange(b,c);return i>=lo&&i<=hi};
/* does the core carry on upward from this floor (stairs to the roof from the top floor) */
const coreUp=(b,c,i)=>{const[lo,hi]=coreRange(b,c);return i<hi||(c.shape==='stair'&&c.roof!==false&&i===b.levels.length-1&&hi===i)};
const coresOn=(b,i)=>(b.cores||[]).filter(c=>coreOn(b,c,i));
const bldLevel=(plan,id)=>{const L=plan.bld.levels;return L.find(l=>l.id===(id||plan.bld.active))||L[L.findIndex(l=>l.kind!=='B')]||L[0]};
/* basements count down from the ground and levels count up: B2 B1 L1 L2 */
function levelNames(bld){const bs=bld.levels.filter(l=>l.kind==='B'),ls=bld.levels.filter(l=>l.kind!=='B'),m={};bs.forEach((l,i)=>m[l.id]='B'+(bs.length-i));ls.forEach((l,i)=>m[l.id]='L'+(i+1));return m}
const lvVal=(bld,l,k)=>l[k]!=null&&l[k]!==''?+l[k]:+bld[k];
/* the slab above a floor: B1 to L1 and the roof have their own defaults */
function slabAbove(bld,i){const l=bld.levels[i],n=bld.levels[i+1];if(l.slab!=null&&l.slab!=='')return+l.slab;if(!n)return+bld.roofSlab;if(l.kind==='B'&&n.kind!=='B')return+bld.slabB1;return+bld.slab}
/* finished floor levels in mm, L1 at 0; floor to floor = ceiling + void + slab above */
function levelStack(bld){const L=bld.levels,out=[],i1=L.findIndex(l=>l.kind!=='B');const row=i=>{const l=L[i],c=lvVal(bld,l,'ceiling'),v=lvVal(bld,l,'void'),sl=slabAbove(bld,i);return{ceiling:c,void:v,slab:sl,ftf:c+v+sl}};
  let z=0;if(i1>=0)for(let i=i1;i<L.length;i++){const r=row(i);r.ffl=z;out[i]=r;z+=r.ftf}
  z=0;for(let i=(i1<0?L.length:i1)-1;i>=0;i--){const r=row(i);z-=r.ftf;r.ffl=z;out[i]=r}return out}
/* active floor -> building (never changes the objects being edited) */
function syncFloorOut(plan){if(!plan)return;if(roofMode&&plan===S){saveRoof();return}ensureBld(plan);const b=plan.bld,l=bldLevel(plan),base=[],fit=[],cores=[];(plan.objs||[]).forEach(o=>(isBldObj(o)?cores:isBaseObj(o)?base:fit).push(o));
  const li=b.levels.indexOf(l);b.cores=(b.cores||[]).filter(c=>!coreOn(b,c,li)&&!cores.some(x=>x.id===c.id)).concat(cores);
  if(l.unique){l.base=base}else{const prev=new Map((b.typical||[]).map(o=>[o.id,o]));const nm={};
    b.typical=base.map(o=>{if(o.t!=='room')return o;const t=prev.get(o.id);if(t&&o.name!==t.name){nm[o.id]=o.name;return Object.assign({},o,{name:t.name})}return o});l.names=nm}
  l.fit=fit}
/* building -> active floor */
function syncFloorIn(plan){ensureBld(plan);const b=plan.bld,l=bldLevel(plan);const base=clone(l.unique?(l.base||[]):(b.typical||[]));const nm=l.unique?{}:(l.names||{});base.forEach(o=>{if(o.t==='room'&&nm[o.id]!=null)o.name=nm[o.id]});plan.objs=base.concat(clone(coresOn(b,b.levels.indexOf(l))),l.fit||[])}
/* the active floor's stored objects, rebuilt without touching plan.objs (used while roof mode holds roof plant in plan.objs) */
function activeStored(){const b=S.bld,l=bldLevel(S);const base=clone(l.unique?(l.base||[]):(b.typical||[]));const nm=l.unique?{}:(l.names||{});base.forEach(o=>{if(o.t==='room'&&nm[o.id]!=null)o.name=nm[o.id]});return base.concat(clone(coresOn(b,b.levels.indexOf(l))),l.fit||[])}

let LIB;const libNotes=[];
try{LIB=libFromCSV(store.get('osk-lib')||DEFAULT_LIB_CSV)}catch(e){LIB=libFromCSV(DEFAULT_LIB_CSV)}
{const saved=store.get('osk-lib');let lv=saved?Math.floor(num(store.get('osk-lib-v'),1)):LIB_V;
  /* the first build with sets marked its upgrade with osk-sets-added; it still needs the later steps, which are safe to rerun */
  while(lv<LIB_V){try{if(LIB_STEPS[lv])LIB_STEPS[lv](LIB,libNotes)}catch(e){console.error(e)}lv++}
  if(saved)store.set('osk-lib',libToCSV(LIB));store.set('osk-lib-v',String(LIB_V))}
const saveLib=()=>{store.set('osk-lib',libToCSV(LIB));store.set('osk-lib-v',String(LIB_V))};

const blankPlan=()=>({v:PLAN_V,name:'Untitled plan',objs:[],underlay:null,locked:false,north:0,pid:uid()});
let S=blankPlan();
let sel=new Set();
let fileHandle=null, dirty=false;
const underCache={};
const byId=id=>S.objs.find(o=>o.id===id);

/* ================= history ================= */
let past=[],future=[];
function snapState(){
  const u=S.underlay?Object.assign({},S.underlay,{src:null}):null;
  return JSON.stringify({objs:S.objs,locked:S.locked,name:S.name,north:num(S.north,0),u,style:S.style||null,section:S.section||null,fire:S.fire||null,notes:S.notes||'',pins:S.pins||[],bld:S.bld||null,cost:S.cost||null,brief:S.brief||null,prog:S.prog||null,site:S.site||null,axes:S.axes||0,guides:S.guides||[],scenes:S.scenes||[],comps:S.comps||null,roof:!!roofMode});
}
/* undo history is bounded by total bytes, not a fixed count — effectively unlimited for a normal session without unbounded memory growth */
let pastBytes=0;const UNDO_BUDGET=96*1024*1024;
function pushPast(str){past.push(str);pastBytes+=str.length;while(past.length>1&&pastBytes>UNDO_BUDGET)pastBytes-=past.shift().length}
function checkpoint(){pushPast(snapState());future=[];markDirty()}
function restoreState(str){
  const o=JSON.parse(str);/* one history for the whole building (Jeff, 15 Nov 2026): a step made on another floor, or on the roof, is restored there, and the view follows it */
  const wasFloor=S.bld?S.bld.active:null,wasRoof=roofMode,toRoof='roof' in o?!!o.roof:roofMode;
  S.objs=o.objs;S.locked=o.locked;S.name=o.name;if(o.north!=null&&o.north!==num(S.north,0)){S.north=o.north;try{drawNorth();if(SUN.on)applySun()}catch(e){}}
  S.style=o.style||undefined;S.section=o.section||undefined;S.fire=o.fire||undefined;S.notes=o.notes||'';S.pins=o.pins||[];if(o.bld)S.bld=o.bld;S.cost=o.cost||undefined;S.brief=o.brief||undefined;S.prog=o.prog||undefined;try{progUI()}catch(e){}pinSel=null;
  /* the building's place on the campus site is part of the plan, so Undo takes it back too (steps saved before 5.0.0 test 23 have no site key and leave it alone) */
  if('axes' in o){if(o.axes)S.axes=o.axes;else delete S.axes;try{axesUI()}catch(e){}}
  if('guides' in o){if(Array.isArray(o.guides)&&o.guides.length)S.guides=o.guides;else delete S.guides}
  if('comps' in o){if(o.comps&&Object.keys(o.comps).length)S.comps=o.comps;else delete S.comps}
  if('scenes' in o){if(Array.isArray(o.scenes)&&o.scenes.length)S.scenes=o.scenes;else delete S.scenes;try{suScenesBar()}catch(e){}}
  if('site' in o){S.site=o.site||undefined;try{campusUI();if(bldView&&BV.campus)buildBld3D()}catch(e){}}
  if(toRoof!==wasRoof){roofMode=toRoof;try{roofRefObjs=toRoof?bldObjs(topLevel()).filter(q=>(q.t==='wall'&&!q.site)||q.t==='room'):[]}catch(e){roofRefObjs=[]}if(toRoof&&is3D)bldView=true;sel.clear();clashDirty=true}
  {const nowFloor=S.bld?S.bld.active:null;if(toRoof!==wasRoof||(!toRoof&&nowFloor!==wasFloor)){sel.clear();clashDirty=true;try{const nm=levelNames(S.bld);toast(toRoof?'Back on the roof, where that change was made':`Back on ${nm[nowFloor]||'that floor'}, where that change was made`)}catch(e){}}}
  if(o.u){S.underlay=Object.assign({},o.u,{src:underCache[o.u.uid]||null})}else S.underlay=null;
  [...sel].forEach(id=>{if(!byId(id))sel.delete(id)});secSel=false;
  $('#pname').value=S.name;markDirty();syncUnder();if(o.bld){try{renderFloorUI();if(!$('#p-bld').hidden)renderBldPanel();if(is3D&&T3)build3D()}catch(e){}}if(is3D)sectionApply();render();if(!$('#p-fire').hidden)renderFire();if(!$('#p-notes').hidden)renderNotes();
  /* a redone step asks to be shown where it was made: go there without recording a step */
  if(o.show&&S.bld){try{if(o.show.roof){if(!roofMode)enterRoof()}else{if(roofMode){exitRoof();render();renderFloorUI()}if(o.show.floor&&o.show.floor!==S.bld.active&&S.bld.levels.some(l=>l.id===o.show.floor))switchFloor(o.show.floor)}}catch(e){}}
  return{floor:S.bld?S.bld.active:null,roof:!!roofMode};
}
function undo(){if(typeof SU!=='undefined'&&SU&&suBusy()){/* an operation in hand is put down first, so its own history step is never crossed */suCancelAll();render();updateHint();return}/* while an AI preview is showing, Undo means undo the AI's changes */if(AI.pending){aiReject();return}if(!past.length)return toast('Nothing to undo');const cur=snapState(),s=past.pop();pastBytes-=s.length;const at=restoreState(s);/* the step just undone was made where Undo has landed; Redo will show that place again, not wherever the later steps were made */future.push(at?cur.slice(0,-1)+',"show":'+JSON.stringify(at)+'}':cur)}
function redo(){if(typeof SU!=='undefined'&&SU&&suBusy()){/* an operation in hand is put down first, so its own history step is never crossed */suCancelAll();render();updateHint();return}if(AI.pending)return toast('Accept or undo the AI preview first');if(!future.length)return toast('Nothing to redo');pushPast(snapState());const f=future.pop();restoreState(f);if(f.endsWith(',"ai":1}'))toast('The AI changes are back and kept. Undo removes them again')}

function markDirty(){dirty=true;setStatus();autosave()}
let asT=null;
/* each save is tied to the tab it came from, so switching tabs mid-way can never write one plan over another */
/* autosave: every change is written to this browser's local storage (not the cache) about half a second later, one entry per tab.
   Returns 'full', 'lite' (saved without the drawing, which did not fit) or false (nothing saved) */
function saveTabData(t,plan){try{syncFloorOut(plan)}catch(e){console.error(e)}PLANS.put(plan);const key=t?'osk-tab-'+t.id:'osk-plan';const txt=JSON.stringify(plan);if(store.set(key,txt))return'full';
  if(plan.underlay&&plan.underlay.src&&store.set(key,JSON.stringify(Object.assign({},plan,{underlay:Object.assign({},plan.underlay,{src:null})}))))return'lite';return false}
const AS={state:'idle',at:0,fileAt:0,fileNote:''};
function autosave(){clearTimeout(asT);const t=curTab,plan=S;AS.state='pending';setStatus();asT=setTimeout(()=>{/* an AI preview that has not been accepted is not autosaved: the plan as it was before is */const r=saveTabData(t,t===curTab&&AI.pending?AI.pending.pre.S:plan);if(t===curTab){AS.state=r||'fail';AS.at=Date.now();
    /* say it once when the browser stops taking autosaves (My plans in IndexedDB still keeps a copy) */
    if(AS.state==='fail'&&!AS.warned){AS.warned=true;toast('Browser storage is full: this plan is no longer autosaved here. My plans still keeps a copy; Save to a file to be safe.')}else if(AS.state!=='fail')AS.warned=false}setStatus()},600)}
const ago=t=>{const d=Math.round((Date.now()-t)/1000);return d<5?'just now':d<60?d+' s ago':d<3600?Math.round(d/60)+' min ago':new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
function storageUse(){let n=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('osk-'))n+=(localStorage.getItem(k)||'').length+k.length}}catch(e){}return n*2}
function setStatus(){if(typeof tabs!=='undefined'&&tabs&&tabs.length)renderTabs();
  const el=$('#status');const st=AS.state;
  el.className='status '+(st==='pending'?'pending':st==='fail'?'bad':st==='lite'?'dirty':'saved');
  const a=st==='pending'?'Saving in this browser…':st==='fail'?'Not autosaved: browser storage is full or blocked. Save to a file':st==='lite'?'Autosaved without the drawing (too big) '+ago(AS.at):st==='full'?'Autosaved in this browser '+ago(AS.at):'Autosave on (this browser)';
  const f=fileHandle?(dirty?' · Not yet saved to '+fileHandle.name:' · Saved to '+fileHandle.name):AS.fileNote?' · '+AS.fileNote:' · not saved to a file';
  el.querySelector('span').textContent=a+f;el.title='Click for how saving works';
}
setInterval(()=>{if(AS.state==='full'||AS.state==='lite')setStatus()},15000);
/* how saving works, from the status line */
function renderSavePop(){const kb=Math.round(storageUse()/1024),pct=Math.min(100,Math.round(kb/5120*100));const st=AS.state;
  $('#pop-save').innerHTML=`<h3 style="margin:0 0 6px">How saving works</h3>
  <p style="margin:0 0 6px"><b>Autosave</b> writes every change to this browser's local storage about half a second later, one copy per tab. Close the browser and the tabs come back as you left them.</p>
  <p class="muted" style="margin:0 0 6px">It stays on this computer, in this browser only. Clearing browsing data, a private window or a work-laptop clean-up removes it, and it is not encrypted.</p>
  <p style="margin:0 0 6px"><b>My plans</b> (in the menu) lists every plan this browser has kept, including ones whose tab you closed. Open, duplicate, rename or delete them there.</p>
  <p style="margin:0 0 6px"><b>Save</b> writes a .json file. That is your real record: keep it on approved storage, share it, open it on another computer.</p>
  <div class="meter"><i style="width:${pct}%"></i></div><p class="muted" style="margin:4px 0 8px">Browser storage used: ${kb.toLocaleString()} KB of about 5,000 KB${st==='lite'?'. <b>The drawing did not fit</b>: the plan is autosaved, but load the drawing again next time, or save to a file':''}${st==='fail'?'. <b>Autosave is failing</b>: save to a file now':''}</p>
  <div class="row"><button class="btn sm primary" type="button" data-sv="save">Save to a file</button><button class="btn sm ghost" type="button" data-sv="wipe">Clear data in this browser…</button></div>`}
function wipeLocal(){if(!confirm('Remove everything StoreyBook keeps in this browser?\n\n· autosaved plans for every tab\n· your settings\n· your library changes\n\nPlan files you saved are not touched. Save any open plan you want to keep first.'))return;
  store.off=true;clearTimeout(asT);try{const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('osk-'))ks.push(k)}ks.forEach(k=>localStorage.removeItem(k))}catch(e){}
  PLANS.clear().finally(()=>{toast('Cleared. Reloading…');setTimeout(()=>location.reload(),600)})}

/* ================= geometry ================= */
function rotPt(x,y,cx,cy,deg){const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t),dx=x-cx,dy=y-cy;return[cx+dx*c-dy*s,cy+dx*s+dy*c]}
const rectP=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
function ellP(rx,ry,n){const p=[];n=n||20;for(let i=0;i<n;i++){const t=i/n*Math.PI*2;p.push([Math.cos(t)*rx,Math.sin(t)*ry])}return p}
function bodyLocal(o){
  const w=o.w,d=o.d;
  if(ROUND_SHAPES.includes(o.shape))return[ellP(w/2,d/2)];
  if(o.shape==='L'){const a=Math.min(o.a||Math.min(w,d)/2,w,d);return[rectP(-w/2,-d/2,w/2,-d/2+a),rectP(-w/2,-d/2+a,-w/2+a,d/2)]}
  return[rectP(-w/2,-d/2,w/2,d/2)];
}
/* overall size of what the 3D model really occupies (eaves, door handles, partition feet, stair enclosure, paper tray, sink tap, bench screens).
   The plan shows it as a dashed outline when it is bigger than the item's own box, and clash checks use it. */
function envOf(o){const w=num(o.w,0),d=num(o.d,0),hw=w/2,hd=d/2,H=num(o.h,0),nm=String(o.name||'').toLowerCase();let x0=-hw,x1=hw,y0=-hd,y1=hd,top=H;
  if(o.t!=='item')return {x0,x1,y0,y1,top,grown:false};
  if(o.shape==='rack'){if(num(o.cf,0)>0)y1+=25;if(num(o.cb,0)>0)y0-=25}
  else if(/guard/.test(nm)){x0-=300;x1+=300;y0-=300;y1+=300}
  else if(/island/.test(nm)){y0-=250;y1+=20}
  else if(/printer|mfd/.test(nm)||o.code==='MFD'){y1+=80}
  else if(/partition panel/.test(nm)&&d<400){y0=Math.min(y0,-200);y1=Math.max(y1,200)}
  else if(o.shape==='stair'){x0-=150;x1+=150;y0-=150}
  else if(/sink/.test(nm)){y1+=20;top=H+262}
  if(/bench/.test(nm)&&o.shape!=='set')top=H+355;
  if(/cylinder/.test(nm))top=H+70;
  /* a tilted bullet camera hangs lower than its own height */let under=null;if(o.shape==='cctvb'){const t=num(o.tilt,20)*Math.PI/180,hh=Math.max(10,H||50);under=Math.round(hh*Math.cos(t)+d*Math.sin(t))}
  return {x0,x1,y0,y1,top,under,grown:x0<-hw||x1>hw||y0<-hd||y1>hd}}
function envLocal(o){const e=envOf(o);return e.grown?[rectP(e.x0,e.y0,e.x1,e.y1)]:bodyLocal(o)}
function zoneLocal(o){
  const w=o.w,d=o.d,z=[];
  if(o.shape==='round'){if(o.cf>0)z.push(ellP(w/2+o.cf,d/2+o.cf));return z}
  if(o.shape==='door'||o.shape==='door2'){const s=o.cf||w;z.push(rectP(-w/2,d/2,w/2,d/2+(o.shape==='door2'?Math.min(s,w/2):s)));return z}
  if(o.shape==='L'){const a=Math.min(o.a||Math.min(w,d)/2,w,d);if(o.cf>0)z.push(rectP(-w/2+a,-d/2+a,w/2,-d/2+a+o.cf));return z}
  if(o.shape==='rack'){
    /* racks: clear_front_mm and clear_back_mm are door leaf widths. The swing is a quarter circle of that radius from the hinge.
       A leaf half the rack width or less means split doors, hinged at both corners. */
    const sweep=(y,sg,R)=>{if(!(R>0))return;const leaf=(hx,dir)=>{const p=[[hx,y]];for(let i=0;i<=8;i++){const t=i/8*Math.PI/2;p.push([hx+dir*R*Math.cos(t),y+sg*R*Math.sin(t)])}z.push(p)};
      if(R<=w/2+1){leaf(-w/2,1);leaf(w/2,-1)}else leaf(-w/2,1)};
    sweep(d/2,1,o.cf);sweep(-d/2,-1,o.cb);return z}
  if(o.cf>0)z.push(rectP(-w/2,d/2,w/2,d/2+o.cf));
  if(o.cb>0)z.push(rectP(-w/2,-d/2-o.cb,w/2,-d/2));
  return z;
}
const toW=(o,poly)=>poly.map(p=>{const q=rotPt(p[0],p[1],0,0,o.r||0);return[q[0]+o.x,q[1]+o.y]});
function bboxPts(pts){let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;pts.forEach(p=>{if(p[0]<a)a=p[0];if(p[1]<b)b=p[1];if(p[0]>c)c=p[0];if(p[1]>d)d=p[1]});return{x0:a,y0:b,x1:c,y1:d}}
function objPts(o){
  if(o.t==='item')return toW(o,rectP(-o.w/2,-o.d/2,o.w/2,o.d/2));
  if(o.t==='room')return o.pts;
  if(o.t==='wall')return wallPathPts(o);
  if(o.t==='text'){const w=(o.text||'').length*o.size*0.55,h=o.size;const q=rectP(o.x-w/2,o.y-h/2,o.x+w/2,o.y+h/2);return o.r?q.map(p=>rotPt(p[0],p[1],o.x,o.y,o.r)):q}
  if(o.t==='dim')return[o.a,o.b];
  if(o.t==='trunk')return o.pts;
  return[];
}
const objBox=o=>{const b=bboxPts(objPts(o));if(o.t==='wall'){const h=(o.th||0)/2;b.x0-=h;b.y0-=h;b.x1+=h;b.y1+=h}return b};
const isWallish=o=>o.t==='room'||o.t==='wall';
/* a room made by closing a wall keeps following that wall's curves and corners */
/* a new corner where the wall (or room edge) was double-clicked; a curved side splits into two arcs on the same circle */
/* after a wall or room is reshaped, doors, windows and wall FCUs that sat on a changed edge move with it */
function followWall(o,old){if(!old||!o.pts||o.spline)return;const closed=o.t==='room'||!!o.closed,n=old.length;if(o.pts.length!==n)return;
  const segs=[];for(let i=0;i<(closed?n:n-1);i++){const j=(i+1)%n,a=old[i],b=old[j],A=o.pts[i],B=o.pts[j];if(a[0]===A[0]&&a[1]===A[1]&&b[0]===B[0]&&b[1]===B[1])continue;segs.push([a,b,A,B])}
  if(!segs.length)return;const tol=Math.max(o.th||0,P.wall||0,150)/2+200;
  S.objs.filter(x=>isOpening(x)||isWallMount(x)).forEach(x=>{for(const[a,b,A,B]of segs){const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1)continue;const ux=(b[0]-a[0])/L,uy=(b[1]-a[1])/L,dx=x.x-a[0],dy=x.y-a[1],al=dx*ux+dy*uy,pd=-dx*uy+dy*ux;
    if(al<-50||al>L+50||Math.abs(pd)>tol+(x.d||0)/2)continue;const L2=Math.hypot(B[0]-A[0],B[1]-A[1]);if(L2<1)continue;const vx=(B[0]-A[0])/L2,vy=(B[1]-A[1])/L2,t=Math.max(0,Math.min(L2,al/L*L2));
    x.x=Math.round(A[0]+vx*t-vy*pd);x.y=Math.round(A[1]+vy*t+vx*pd);const da=(Math.atan2(vy,vx)-Math.atan2(uy,ux))*180/Math.PI;x.r=Math.round(((x.r||0)+da)%360*10)/10;break}});clashDirty=true}
/* a four-corner room (or closed wall) with square corners: dragging one corner keeps it a rectangle, the opposite corner stays put */
function rectFrame(o,i){const P=o.pts;if(!P||P.length!==4||!(o.t==='room'||(o.t==='wall'&&o.closed&&!o.spline&&!(o.bulge||[]).some(x=>x))))return null;
  for(let k=0;k<4;k++){const a=P[(k+3)%4],b=P[k],c=P[(k+1)%4],ux=a[0]-b[0],uy=a[1]-b[1],vx=c[0]-b[0],vy=c[1]-b[1],L1=Math.hypot(ux,uy),L2=Math.hypot(vx,vy);if(L1<1||L2<1||Math.abs((ux*vx+uy*vy)/(L1*L2))>0.02)return null}
  const iC=(i+2)%4,iB=(i+1)%4,iD=(i+3)%4,C=P[iC],nb=P[iB],nd=P[iD],LB=Math.hypot(nb[0]-C[0],nb[1]-C[1]),LD=Math.hypot(nd[0]-C[0],nd[1]-C[1]);
  return{C:C.slice(),iB,iD,u:[(nb[0]-C[0])/LB,(nb[1]-C[1])/LB],v:[(nd[0]-C[0])/LD,(nd[1]-C[1])/LD]}}
function insertCorner(o,w,tol){const segs=o.t==='room'?o.pts.map((p,i)=>[p,o.pts[(i+1)%o.pts.length],i]):rawSegs(o);if(!segs.length)return false;
  let best=null;segs.forEach(([a,b,i])=>{const h=o.t==='wall'&&!o.spline?segBulge(o,i):0;const q=h?arcPoints(a,b,h):[a,b];const pr=polyProj(q,w);if(!best||pr.d<best.d)best={i,a,b,h,q,pr,d:pr.d}});
  if(o.spline){const full=wallPathPts(o).concat(o.closed?[o.pts[0]]:[]),pr=polyProj(full,w);if(pr.d>(tol||fs(12)))return false;best.P=polyAt(full,pr.s).p}else{if(best.d>(tol||fs(12)))return false;best.P=polyAt(best.q,best.pr.s).p}
  const P=[Math.round(best.P[0]),Math.round(best.P[1])];if(Math.hypot(P[0]-best.a[0],P[1]-best.a[1])<50||Math.hypot(P[0]-best.b[0],P[1]-best.b[1])<50)return false;
  checkpoint();const i=best.i;o.pts.splice(i+1,0,P);
  if(o.t==='wall'&&o.bulge){const h=best.h;let b1=0,b2=0;if(h){const g=arcGeom(best.a,best.b,h);const sag=c=>Math.sign(h)*(g.r-Math.sqrt(Math.max(0,g.r*g.r-c*c/4)));b1=sag(Math.hypot(P[0]-best.a[0],P[1]-best.a[1]));b2=sag(Math.hypot(best.b[0]-P[0],best.b[1]-P[1]))}
    while(o.bulge.length<o.pts.length-1)o.bulge.push(0);o.bulge.splice(i,1,b1,b2)}
  markDirty();clashDirty=true;render();renderInspector();schedule3D();toast('Corner added · drag it to reshape');return true}
function syncLinkedRooms(){S.objs.forEach(r=>{if(r.t!=='room'||!r.link)return;const w=S.objs.find(o=>o.id===r.link);if(!w||w.t!=='wall'||!w.closed){delete r.link;return}
  const key=JSON.stringify([w.pts,w.bulge||0,w.th,!!w.spline]);if(r._lk===key)return;const q=wallPathPts(w).filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>1);
  if(q.length>2&&Math.hypot(q[0][0]-q.at(-1)[0],q[0][1]-q.at(-1)[1])<1)q.pop();if(q.length<3)return;r.pts=insetPoly(q,(w.th||0)/2);Object.defineProperty(r,'_lk',{value:key,writable:true,enumerable:false,configurable:true})})}
/* ================= MIG entitlement check =================
   Ranks found in a room's name (or set on the room) give its entitlement; the room's drawn area is compared with it.
   "COL Tan" -> 16 m2. "2 x ME2" or "ME2 x 2" -> 8 m2. "COL, LTC" -> 28 m2. The table is editable in Settings. */
const MIG_DEF=[{codes:['PS','DS','MG'],area:36},{codes:['BG','ME8'],area:20},{codes:['COL','ME7'],area:16},{codes:['LTC','ME6'],area:12},{codes:['CPT','MAJ','ME4','ME5'],area:8},{codes:['ME1','ME2','ME3'],area:4}];
const migCfg=()=>Object.assign({on:true,tol:10,under:true,table:MIG_DEF},P.mig||{});
function migMap(){const m=new Map();migCfg().table.forEach(r=>r.codes.forEach(c=>m.set(String(c).toUpperCase().replace(/\s+/g,''),+r.area)));return m}
let migRe=null,migKey='';
function migParse(name){const M=migMap(),key=[...M.keys()].join('|');if(key!==migKey){migKey=key;const codes=[...M.keys()].sort((a,b)=>b.length-a.length).map(c=>c.replace(/[^A-Z0-9]/g,''));migRe=codes.length?new RegExp(`(?:(\\d+)\\s*[xX×*]\\s*)?\\b(${codes.join('|')})\\b(?:\\s*[xX×*]\\s*(\\d+))?`,'g'):null}
  if(!migRe||!name)return[];const t=String(name).toUpperCase().replace(/\bME\s+(\d)\b/g,'ME$1');const out=[];let m;migRe.lastIndex=0;
  while((m=migRe.exec(t))){const n=Math.max(1,Math.min(99,+(m[1]||m[3]||1)));out.push({code:m[2],n,area:M.get(m[2])})}return out}
/* the room's entitlement: its own setting, else ranks in its name. null = not checked */
function migRoom(o){if(!o||o.t!=='room'||!migCfg().on)return null;if(o.ent==='none')return null;const M=migMap();
  const ranks=o.ent&&M.has(o.ent)?[{code:o.ent,n:1,area:M.get(o.ent)}]:migParse(o.name);if(!ranks.length)return null;
  const ent=ranks.reduce((a,r)=>a+r.n*r.area,0),area=Math.abs(polyArea(o.pts))/1e6,C=migCfg(),tol=(+C.tol||0)/100,diff=area-ent;
  /* over the moment it exceeds the entitlement; still OK down to tol below it (default 10%); under beyond that */
  const st=area>ent+0.05?'over':(C.under&&area<ent*(1-tol)-0.05?'under':'ok');
  return{ranks,ent,area,diff,st,label:ranks.map(r=>(r.n>1?r.n+' x ':'')+r.code).join(' + ')}}
const fixed=o=>isWallish(o)&&!o.site&&S.locked;
/* wall runs: list of [a,b] segments, closing segment included for closed walls */
/* curved walls: o.bulge[i] is how far (mm) the middle of segment i bows out from the straight line; 0 or missing means straight.
   Everything downstream (3D, collisions, rooms, gaps, mini-map) reads wallSegs, which turns arcs into short straight pieces. */
function rawSegs(o){const p=o.pts||[],out=[];for(let i=0;i<p.length-1;i++)out.push([p[i],p[i+1],i]);if(o.closed&&p.length>2)out.push([p[p.length-1],p[0],p.length-1]);return out}
const segBulge=(o,i)=>(o.bulge&&+o.bulge[i])||0;
function arcGeom(a,b,h){const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L,m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  if(Math.abs(h)<1)return{straight:true,m,n:[nx,ny],L,len:L,P:m};
  const r=(L*L/4+h*h)/(2*Math.abs(h)),sg=Math.sign(h),C=[m[0]+nx*(h-sg*r),m[1]+ny*(h-sg*r)],P=[m[0]+nx*h,m[1]+ny*h];
  const ta=Math.atan2(a[1]-C[1],a[0]-C[0]),tp=Math.atan2(P[1]-C[1],P[0]-C[0]);let d=tp-ta;while(d>Math.PI)d-=2*Math.PI;while(d<=-Math.PI)d+=2*Math.PI;
  return{straight:false,m,n:[nx,ny],L,r,C,P,ta,sweep:2*d,len:Math.abs(2*d)*r}}
function arcPoints(a,b,h){const g=arcGeom(a,b,h);if(g.straight)return[a,b];const n=Math.max(8,Math.min(64,Math.ceil(Math.abs(g.sweep)*g.r/250)));const out=[];
  for(let k=0;k<=n;k++){const t=g.ta+g.sweep*k/n;out.push([g.C[0]+Math.cos(t)*g.r,g.C[1]+Math.sin(t)*g.r])}out[0]=a;out[n]=b;return out}
/* free-form curves: a centripetal Catmull-Rom spline through the clicked points (it passes through every point, without loops or cusps) */
function splinePts(P0,closed){const P=P0.filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>1);const n=P.length;if(n<3)return P.slice();
  const at=i=>closed?P[(i%n+n)%n]:P[Math.max(0,Math.min(n-1,i))];const out=[P[0]];const spans=closed?n:n-1;
  for(let i=0;i<spans;i++){const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2);const tj=(a,b)=>Math.pow(Math.max(1e-6,Math.hypot(b[0]-a[0],b[1]-a[1])),0.5);
    const t0=0,t1=t0+tj(p0,p1),t2=t1+tj(p1,p2),t3=t2+tj(p2,p3);const L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),m=Math.max(6,Math.min(48,Math.ceil(L/200)));
    for(let k=1;k<=m;k++){const t=t1+(t2-t1)*k/m;const lp=(a,b,ta,tb)=>{const u=(tb-ta)||1e-6;return[(tb-t)/u*a[0]+(t-ta)/u*b[0],(tb-t)/u*a[1]+(t-ta)/u*b[1]]};
      const A1=lp(p0,p1,t0,t1),A2=lp(p1,p2,t1,t2),A3=lp(p2,p3,t2,t3),B1=lp(A1,A2,t0,t2),B2=lp(A2,A3,t1,t3),C=lp(B1,B2,t1,t2);out.push(k===m?p2.slice():C)}}
  if(closed)out.pop();return out}
function wallSegs(o){if(o.spline){const q=splinePts(o.pts||[],o.closed),out=[];for(let k=0;k<q.length-1;k++)out.push([q[k],q[k+1]]);if(o.closed&&q.length>2)out.push([q[q.length-1],q[0]]);return out}const out=[];rawSegs(o).forEach(([a,b,i])=>{const h=segBulge(o,i);if(!h){out.push([a,b]);return}const q=arcPoints(a,b,h);for(let k=0;k<q.length-1;k++)out.push([q[k],q[k+1]])});return out}
function wallPathPts(o){if(o.spline)return splinePts(o.pts||[],o.closed);const pts=[];rawSegs(o).forEach(([a,b,i],j)=>{const h=segBulge(o,i);const q=h?arcPoints(a,b,h):[a,b];q.forEach((p,k)=>{if(j>0&&k===0)return;pts.push(p)})});if(!pts.length)return(o.pts||[]).slice();return pts}
const newWallTh=()=>P.wall>0?P.wall:100;
function unionBox(list){const pts=[];list.forEach(o=>{const b=objBox(o);pts.push([b.x0,b.y0],[b.x1,b.y1])});return pts.length?bboxPts(pts):null}
/* a point and direction at distance s along a polyline; and where a point falls along it */
function polyLen(q){let L=0;for(let i=0;i<q.length-1;i++)L+=Math.hypot(q[i+1][0]-q[i][0],q[i+1][1]-q[i][1]);return L}
function polyAt(q,s){for(let i=0;i<q.length-1;i++){const a=q[i],b=q[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(s<=l||i===q.length-2){const f=l?Math.max(0,Math.min(1,s/l)):0;return{p:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],ang:Math.atan2(b[1]-a[1],b[0]-a[0])}}s-=l}return{p:q[0],ang:0}}
function polyProj(q,p){let best={s:0,d:1e18},acc=0;for(let i=0;i<q.length-1;i++){const a=q[i],b=q[i+1],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy||1,l=Math.sqrt(l2);const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2));const d=Math.hypot(a[0]+dx*t-p[0],a[1]+dy*t-p[1]);if(d<best.d)best={s:acc+t*l,d,i,t};acc+=l}return best}
function polyArea(p){let a=0;for(let i=0;i<p.length;i++){const q=p[i],r=p[(i+1)%p.length];a+=q[0]*r[1]-r[0]*q[1]}return a/2}
function centroid(p){let A=polyArea(p),cx=0,cy=0;if(Math.abs(A)<1){const b=bboxPts(p);return[(b.x0+b.x1)/2,(b.y0+b.y1)/2]}for(let i=0;i<p.length;i++){const q=p[i],r=p[(i+1)%p.length],f=q[0]*r[1]-r[0]*q[1];cx+=(q[0]+r[0])*f;cy+=(q[1]+r[1])*f}return[cx/(6*A),cy/(6*A)]}
function boxHit(a,b){return a.x0<b.x1&&b.x0<a.x1&&a.y0<b.y1&&b.y0<a.y1}
function polysHit(A,B){
  for(const P of[A,B]){for(let i=0;i<P.length;i++){const p1=P[i],p2=P[(i+1)%P.length];const nx=p2[1]-p1[1],ny=p1[0]-p2[0],L=Math.hypot(nx,ny);if(L<1e-9)continue;
    let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
    for(const q of A){const v=(q[0]*nx+q[1]*ny)/L;if(v<a0)a0=v;if(v>a1)a1=v}
    for(const q of B){const v=(q[0]*nx+q[1]*ny)/L;if(v<b0)b0=v;if(v>b1)b1=v}
    if(a1<=b0+2||b1<=a0+2)return false}}
  return true;
}
function pointInPoly(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if(((p[i][1]>y)!==(p[j][1]>y))&&(x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0]))c=!c}return c}

/* ================= view ================= */
const svg=$('#plan');
const V={x:-2000,y:-2000,k:0.04};
let W=800,H=600;
function resize(){const r=svg.getBoundingClientRect();W=r.width||800;H=r.height||600;applyView()}
function applyView(){if(typeof rotChip!=='undefined'&&rotChip&&!rotChip.hidden)rotChipHide();svg.setAttribute('viewBox',`${V.x} ${V.y} ${W/V.k} ${H/V.k}`);$('#z-val').textContent=Math.round(V.k/0.04*100)+'%'}
/* ---- north: one angle per plan, clockwise from screen-up; the arrow widget, the Building tab, the Sun bar and the PNG export all read it ---- */
function setNorth(v,opts={}){v=((Math.round(+v||0)%360)+360)%360;if(v===num(S.north,0)&&!opts.force)return;if(!opts.quiet)checkpoint();S.north=v;markDirty();drawNorth();if(SUN.on&&typeof applySun==='function')applySun();if(!opts.quiet)toast(v===0?'North is up':`North is ${v}° clockwise from up`)}
/* in 3D the arrow turns with the camera: project the plan's up direction to the screen and add the plan's north angle */
function northScreenAngle(){if(!is3D||!T3||!T3.camera)return 0;const {camera,controls}=T3;const a=controls.target.clone(),b=a.clone();b.z-=1;a.project(camera);b.project(camera);const dx=b.x-a.x,dy=-(b.y-a.y);if(Math.abs(dx)+Math.abs(dy)<1e-6)return 0;return Math.atan2(dx,-dy)*180/Math.PI}
/* the dock grew with the SketchUp tools: whatever sits in the bottom right corner (Measurements box, coordinates, the 2D / 3D button, the Push/Pull value box) moves up above it when the window is too narrow for both, so nothing ends up under the dock */
const dockNat=new Map();let dockKey='';
function dockClear(){const d=$('.dock'),m=$('#main');if(!d||!m)return;const r=d.getBoundingClientRect(),mr=m.getBoundingClientRect(),dt=mr.bottom-r.top,key=innerWidth+'x'+innerHeight;if(key!==dockKey){dockKey=key;dockNat.clear()}
  /* where each sits by its own style sheet rule: measured once per window size, with anything set here taken off first */
  const nat=e=>{if(!e)return null;const c=getComputedStyle(e);if(c.display==='none'||c.visibility==='hidden')return null;let n=dockNat.get(e);if(!n){const b0=e.style.bottom,r0=e.style.right;e.style.bottom='';e.style.right='';const b=e.getBoundingClientRect();e.style.bottom=b0;e.style.right=r0;if(!b.width)return null;n={b:mr.bottom-b.bottom,h:b.height,gap:mr.right-b.right};dockNat.set(e,n)}const w=e.getBoundingClientRect().width;return{b:n.b,h:n.h,l:mr.right-n.gap-w,r:mr.right-n.gap}};
  const under=n=>r.width>0&&n.r>r.left&&n.l<r.right&&n.b<dt&&n.b+n.h>mr.bottom-r.bottom,put=(e,b,rt)=>{if(e.style.bottom!==b)e.style.bottom=b;if(e.style.right!==rt)e.style.right=rt};
  const dw=$('.drawer.right'),q=dw&&!dw.hidden?dw.getBoundingClientRect():null,side=q&&q.width>0&&q.bottom>r.top-60?Math.round(mr.right-q.left+8)+'px':'';const col=[],scol=[];/* what already stands in the corner, and beside the drawer, bottom to top */const stack=(c,b,h)=>{c.sort((x,y)=>x[0]-y[0]).forEach(k=>{if(b<k[1]&&b+h>k[0])b=k[1]+8});c.push([b,b+h]);return b};
  /* the readout goes above the dock; with Details open it stands left of that drawer, not behind it */
  [$('#vcb'),$('.coords')].forEach(e=>{const n=nat(e);if(!n)return;if(under(n))put(e,Math.round(stack(side?scol:col,dt+8,n.h))+'px',side);else{put(e,'','');col.push([n.b,n.b+n.h])}});
  /* the view button and the value box keep their own place unless the dock or the readout is in it; then they stack upward */
  [$('#b-view'),$('#su-chip')].forEach(e=>{const n=nat(e);if(!n)return;const u=under(n),sd=u&&side?side:'',b=stack(sd?scol:col,u?dt+8:n.b,n.h);put(e,!sd&&Math.abs(b-n.b)<1?'':Math.round(b)+'px',sd)})}
function drawNorth(){try{dockClear()}catch(e){}const n=num(S.north,0)+northScreenAngle();const w=$('#north');if(w){/* desktop: sit just left of the toolbar dock, whatever its width */if(!PHONE()){const d=$('.dock');if(d){const r=d.getBoundingClientRect(),m=$('#main').getBoundingClientRect();if(r.width){const room=r.left-m.left-w.offsetWidth-14;/* no room beside the dock (a narrow window, or the longer SketchUp dock): sit above it and clear of an open Library drawer, never under either */let L=Math.max(8,room);if(room<8){const dl=$('.drawer.left'),q=dl&&!dl.hidden?dl.getBoundingClientRect():null;if(q&&q.width&&q.bottom>r.top-8-w.offsetHeight)L=Math.round(q.right-m.left+8)}w.style.left=L+'px';w.style.bottom=room<8?Math.round(m.bottom-r.top+8)+'px':''}}}else{w.style.left='';w.style.bottom=''}w.style.setProperty('--n',n+'deg');w.title=is3D?`North · ${num(S.north,0)}° clockwise from plan-up · turns with the camera · drag to rotate, double-click to set north up`:`North · ${num(S.north,0)}° clockwise from up · drag to rotate, double-click to set north up`;w.querySelector('.nv').textContent=num(S.north,0)+'°'}
  const a=$('#bld-north');if(a&&document.activeElement!==a)a.value=n;const b=$('#sun-north');if(b&&document.activeElement!==b)b.value=n}
function northSVG(cx,cy,r,n){/* arrow for exports, in world units */
  return `<g transform="translate(${cx} ${cy}) rotate(${n})" font-family="Inter,Arial,sans-serif"><circle r="${r}" fill="none" stroke="#1d2a38" stroke-width="${r*0.06}"/><path d="M0 ${-r*0.82} L${r*0.26} ${r*0.3} L0 ${r*0.1} L${-r*0.26} ${r*0.3} Z" fill="#1d2a38"/><text y="${-r*0.95}" text-anchor="middle" font-size="${r*0.5}" font-weight="700" fill="#1d2a38">N</text></g>`}
(function(){const w=$('#north');if(!w)return;let drag=null;
  const ang=e=>{const r=w.getBoundingClientRect();return Math.atan2(e.clientX-(r.left+r.width/2),-(e.clientY-(r.top+r.height/2)))*180/Math.PI};
  w.addEventListener('pointerdown',e=>{/* works in 2D and 3D: the drag turns north by the same angle the finger turns round the arrow, whatever way the camera faces */e.stopPropagation();if(e.button!==0&&e.pointerType==='mouse')return;drag={a0:ang(e),n0:num(S.north,0),moved:false};w.setPointerCapture(e.pointerId);e.preventDefault()});
  w.addEventListener('pointermove',e=>{if(!drag)return;const d=ang(e)-drag.a0;if(Math.abs(d)>2)drag.moved=true;if(drag.moved){const v=Math.round((drag.n0+d)/5)*5,nv=((v%360)+360)%360;if(nv!==S.north){S.north=nv;drawNorth();/* 3D: shadows follow while dragging */if(is3D&&SUN.on&&!drag.raf)drag.raf=requestAnimationFrame(()=>{if(drag)drag.raf=0;try{applySun()}catch(e){}})}}});
  const end=e=>{if(!drag)return;const m=drag.moved,n0=drag.n0;drag=null;if(m){const nv=S.north;S.north=n0;checkpoint();S.north=nv;markDirty();if(SUN.on)applySun();toast(num(S.north,0)===0?'North is up':`North is ${S.north}° clockwise from up`)}};
  w.addEventListener('pointerup',end);w.addEventListener('pointercancel',end);
  w.addEventListener('dblclick',()=>setNorth(0));})();
function toWorld(ev){const r=svg.getBoundingClientRect();return[V.x+(ev.clientX-r.left)/V.k,V.y+(ev.clientY-r.top)/V.k]}
function zoomAt(f,sx,sy){/* 0.0002 shows about 7 km across a desktop screen (was 700 m, too little for a 70,000 m² floor) */const nk=Math.max(0.0002,Math.min(2,V.k*f));const wx=V.x+sx/V.k,wy=V.y+sy/V.k;V.k=nk;V.x=wx-sx/nk;V.y=wy-sy/nk;applyView();render()}
function fit(){if(typeof SU!=='undefined'&&SU)suPushView();if(typeof TUT!=='undefined'&&TUT&&TUT.on)TUT.f.fit=1;
  const pts=[];S.objs.forEach(o=>{const b=objBox(o);pts.push([b.x0,b.y0],[b.x1,b.y1])});
  if(S.underlay&&S.underlay.src&&S.underlay.visible!==false){const u=S.underlay;pts.push([u.x,u.y],[u.x+u.w*u.mpp,u.y+u.h*u.mpp])}
  if(!pts.length){V.k=0.04;V.x=-2000;V.y=-2000;applyView();render();return}
  const b=bboxPts(pts),padL=(P.lib&&!PHONE()?310:20),padR=(P.insp&&!PHONE()?330:20),padT=60,padB=100;
  const aw=Math.max(100,W-padL-padR),ah=Math.max(100,H-padT-padB);
  V.k=Math.min(aw/Math.max(1,b.x1-b.x0),ah/Math.max(1,b.y1-b.y0),1);
  V.x=b.x0-(padL+(aw-(b.x1-b.x0)*V.k)/2)/V.k;V.y=b.y0-(padT+(ah-(b.y1-b.y0)*V.k)/2)/V.k;applyView();render();
}

/* zoom to one box, keeping it clear of the drawers and the AI panel */
function fitBox(b){if(typeof SU!=='undefined'&&SU)suPushView();const ai=$('#ai-panel')&&!$('#ai-panel').hidden&&!PHONE()?420:0,padL=(P.lib&&!PHONE()?310:20),padR=Math.max(P.insp&&!PHONE()?330:20,ai),padT=70,padB=110,aw=Math.max(100,W-padL-padR),ah=Math.max(100,H-padT-padB);V.k=Math.min(aw/Math.max(1,b.x1-b.x0),ah/Math.max(1,b.y1-b.y0),1);V.x=b.x0-(padL+(aw-(b.x1-b.x0)*V.k)/2)/V.k;V.y=b.y0-(padT+(ah-(b.y1-b.y0)*V.k)/2)/V.k;applyView();render()}
function centerOn(px,py){V.x=px-(W/2)/V.k;V.y=py-(H/2)/V.k;applyView();render()}
/* ================= rendering ================= */
let renderQ=false;
function render(){try{syncLinkedRooms()}catch(e){console.error(e)}if(renderQ)return;renderQ=true;requestAnimationFrame(()=>{renderQ=false;draw()})}
let clashCache={bad:new Set(),zbad:new Set()},clashDirty=true;
/* clashes are kept as pairs, so while objects are being dragged only the pairs that involve them are re-tested (moving = Set of ids); otherwise everything is tested */
function computeClash(moving){
  const items=S.objs.filter(o=>o.t==='item'&&!o.nests&&!isCeil(o));
  const info=items.map(o=>{const b=envLocal(o).map(p=>toW(o,p)),z=zoneLocal(o).map(p=>toW(o,p));return{o,b,z,bb:bboxPts([].concat(...b)),zb:z.length?bboxPts([].concat(...z)):null}});
  const alive=new Set(items.map(o=>o.id)),full=!moving||!clashCache.pairs;
  const pairs=new Set(),zpairs=new Set();
  if(!full){clashCache.pairs.forEach(k=>{const[a,b]=k.split('|');if(alive.has(a)&&alive.has(b)&&!moving.has(a)&&!moving.has(b))pairs.add(k)});
    clashCache.zpairs.forEach(k=>{const[a,b]=k.split('|'),ai=a.split(':')[0];if(alive.has(ai)&&alive.has(b)&&!moving.has(ai)&&!moving.has(b))zpairs.add(k)})}
  const test=(A,B)=>{if(boxHit(A.bb,B.bb)&&A.b.some(p=>B.b.some(q=>polysHit(p,q))))pairs.add(A.o.id<B.o.id?A.o.id+'|'+B.o.id:B.o.id+'|'+A.o.id)};
  const ztest=(A,B)=>{if(!A.zb||!boxHit(A.zb,B.bb))return;A.z.forEach((zp,zi)=>{if(boxHit(bboxPts(zp),B.bb)&&B.b.some(q=>polysHit(zp,q)))zpairs.add(A.o.id+':'+zi+'|'+B.o.id)})};
  if(full){/* a grid finds the neighbours, so a plan with tens of thousands of items is not tested pair by pair */
    const CS=4000,grid=new Map(),big=[],cx=v=>Math.floor(v/CS);const three=(A,B)=>{test(A,B);ztest(A,B);ztest(B,A)};
    info.forEach((A,i)=>{const u=A.u=A.zb?{x0:Math.min(A.bb.x0,A.zb.x0),y0:Math.min(A.bb.y0,A.zb.y0),x1:Math.max(A.bb.x1,A.zb.x1),y1:Math.max(A.bb.y1,A.zb.y1)}:A.bb;A.i=i;
      if((cx(u.x1)-cx(u.x0)+1)*(cx(u.y1)-cx(u.y0)+1)>400){big.push(A);return}
      for(let x=cx(u.x0);x<=cx(u.x1);x++)for(let y=cx(u.y0);y<=cx(u.y1);y++){const k=x+','+y;let c=grid.get(k);if(!c)grid.set(k,c=[]);c.push(A)}});
    grid.forEach((c,k)=>{if(c.length<2)return;const[gx,gy]=k.split(',').map(Number);for(let i=0;i<c.length;i++)for(let j=i+1;j<c.length;j++){const A=c[i],B=c[j];if(!boxHit(A.u,B.u))continue;/* each pair once: in the cell where their overlap starts */if(cx(Math.max(A.u.x0,B.u.x0))!==gx||cx(Math.max(A.u.y0,B.u.y0))!==gy)continue;three(A.i<B.i?A:B,A.i<B.i?B:A)}});
    big.forEach(A=>info.forEach(B=>{if(B===A||(B.u&&big.includes(B)&&B.i<A.i))return;three(A,B)}))}
  else{const mv=info.filter(x=>moving.has(x.o.id));mv.forEach(A=>info.forEach(B=>{if(B===A)return;if(moving.has(B.o.id)&&B.o.id<A.o.id)return;test(A,B);ztest(A,B);ztest(B,A)}))}
  const bad=new Set(),zbad=new Set();pairs.forEach(k=>{const[a,b]=k.split('|');bad.add(a);bad.add(b)});zpairs.forEach(k=>zbad.add(k.split('|')[0]));
  clashCache={bad,zbad,pairs,zpairs};clashDirty=false;
}
const fs=px=>px/V.k;
/* site: grass inside a closed fence, roads with a centre line, fences with posts */
function siteSVG(){if(!LY('site'))return'';let g='',r='',f='';
  S.objs.filter(o=>o.t==='wall'&&o.site&&o.pts&&o.pts.length>=2).forEach(o=>{const P=wallPathPts(o),d='M'+P.map(p=>p[0]+' '+p[1]).join('L')+(o.closed?'Z':''),on=sel.has(o.id)?' sel':'';
    if(o.site==='road'){r+=`<path data-id="${o.id}" class="road${on}" d="${d}" stroke-width="${o.th||6000}"${o.col?` style="stroke:${o.col}"`:''}/><path class="road-cl" d="${d}" style="pointer-events:none"/>`}
    else{if(o.closed)g+=`<path class="grass" d="${d}" style="pointer-events:none"/>`;f+=`<path data-id="${o.id}" class="site-hit" d="${d}" stroke-width="${fs(14)}"/><path data-id="${o.id}" class="fence${on}" d="${d}" stroke-width="${Math.max(o.th||150,fs(2.5))}"${o.col?` style="stroke:${o.col}"`:''}/><path class="fence-post" d="${d}" style="pointer-events:none" stroke-width="${fs(6)}"/>`}});
  return g+r+f}
function shapeSVG(o){
  const w=o.w,d=o.d,hw=w/2,hd=d/2;let s='';
  switch(o.shape){
    case 'round':s=`<ellipse class="b" rx="${hw}" ry="${hd}"/>`;break;
    case 'tree':s=`<ellipse class="b tree" rx="${hw}" ry="${hd}"/><ellipse class="d" rx="${hw*0.55}" ry="${hd*0.55}" style="stroke-dasharray:${hw*0.2} ${hw*0.15}"/><circle class="d" r="${Math.min(hw,hd)*0.08}"/>`;break;
    case 'parking':s=`<rect class="b park" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="M${-hw} ${-hd}V${hd}M${hw} ${-hd}V${hd}M${-hw} ${hd}H${hw}"/>`;break;
    case 'gate':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="${Array.from({length:Math.max(1,Math.round(w/600))},(_,i)=>{const x=-hw+i*w/Math.max(1,Math.round(w/600));return`M${x} ${-hd}L${x+w/Math.max(1,Math.round(w/600))} ${hd}`}).join('')}"/>`;break;
    case 'boom':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${Math.min(w,400)}" height="${d}"/><path class="d" d="M${-hw} 0H${hw}" style="stroke-width:${d*0.35};stroke-dasharray:${d} ${d}"/>`;break;
    case 'L':{const a=Math.min(o.a||Math.min(w,d)/2,w,d);s=`<path class="b" d="M${-hw} ${-hd}H${hw}V${-hd+a}H${-hw+a}V${hd}H${-hw}Z"/>`;break}
    case 'chair':{const rr=Math.min(w,d)*0.22;s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}" rx="${rr}"/><path class="d" d="M${-hw*0.8} ${-hd+d*0.2}H${hw*0.8}"/>`;
      if(hasArms(o)){const aw=w*0.13;s+=`<rect class="d" x="${-hw+w*0.04}" y="${-hd+d*0.2}" width="${aw}" height="${d*0.6}" rx="${aw/2}"/><rect class="d" x="${hw-w*0.04-aw}" y="${-hd+d*0.2}" width="${aw}" height="${d*0.6}" rx="${aw/2}"/>`}break}
    case 'sofa':{const bk=d*0.25,ar=Math.min(w*0.12,180);s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}" rx="${Math.min(60,d*0.1)}"/><path class="d" d="M${-hw} ${-hd+bk}H${hw}M${-hw+ar} ${-hd+bk}V${hd}M${hw-ar} ${-hd+bk}V${hd}"/>`;break}
    case 'rack':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="M${-hw} ${-hd}L${hw} ${hd}M${hw} ${-hd}L${-hw} ${hd}M${-hw} ${hd-d*0.08}H${hw}"/>`;break;
    case 'sink':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><rect class="d" x="${-w*0.3}" y="${-d*0.3}" width="${w*0.6}" height="${d*0.55}" rx="${d*0.1}"/>`;break;
    case 'door':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="M${-hw} ${hd}V${hd+w}M${hw} ${hd}A${w} ${w} 0 0 1 ${-hw} ${hd+w}"/>`;break;
    case 'door2':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="M${-hw} ${hd}V${hd+hw}M0 ${hd}A${hw} ${hw} 0 0 1 ${-hw} ${hd+hw}M${hw} ${hd}V${hd+hw}M0 ${hd}A${hw} ${hw} 0 0 0 ${hw} ${hd+hw}"/>`;break;
    case 'col':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="M${-hw} ${-hd}L${hw} ${hd}M${hw} ${-hd}L${-hw} ${hd}"/>`;break;
    case 'colr':s=`<ellipse class="b" rx="${hw}" ry="${hd}"/><path class="d" d="M${-hw*0.7} ${-hd*0.7}L${hw*0.7} ${hd*0.7}M${hw*0.7} ${-hd*0.7}L${-hw*0.7} ${hd*0.7}"/>`;break;
    case 'stair':{const g=100,fw=(w-g)/2,Ld=Math.min(fw,d*0.4),y0=-hd+Ld;let t='';for(let y=y0;y<hd-1;y+=280)t+=`M${-hw} ${y}H${-g/2}M${g/2} ${y}H${hw}`;
      const xl=-g/2-fw/2,xr=g/2+fw/2;s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="${t}M${-g/2} ${y0}V${hd}M${g/2} ${y0}V${hd}"/><path class="d" style="stroke-width:1.6px" d="M${xl} ${hd-150}V${-hd+Ld/2}H${xr}V${hd-350}M${xr-120} ${hd-560}L${xr} ${hd-350}L${xr+120} ${hd-560}"/>`;break}
    case 'lift':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><rect class="d" x="${-hw+150}" y="${-hd+150}" width="${w-300}" height="${d-400}" style="fill:none"/><path class="d" d="M${-hw+150} ${-hd+150}L${hw-150} ${hd-250}M${hw-150} ${-hd+150}L${-hw+150} ${hd-250}M${-550} ${hd}H${550}"/>`;break;
    case 'shaft':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="M${-hw} ${-hd}L${hw} ${hd}M${hw} ${-hd}L${-hw} ${hd}"/>`;break;
    case 'cctv':s=`<circle class="b" r="${hw}"/><circle class="d" r="${hw*0.45}"/><path class="d" d="M0 0V${hd*1.9}"/>`;break;
    case 'cctvb':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}" rx="${hw*0.4}"/><path class="d" d="M0 ${hd*0.2}V${hd*1.6}"/>`;break;
    case 'fan':{const r=hw;s=`<circle class="b" r="${r}" style="fill-opacity:.18"/><circle class="d" r="${r*0.12}"/>`+[0,120,240].map(a=>`<path class="d" transform="rotate(${a})" d="M0 ${-r*0.12}L${-r*0.1} ${-r*0.95}L${r*0.1} ${-r*0.95}Z"/>`).join('');break}
    case 'fcuw':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}" rx="${Math.min(hd,40)}"/><path class="d" d="M${-hw*0.85} ${hd*0.45}H${hw*0.85}M0 ${hd}V${hd+380}M${-90} ${hd+260}L0 ${hd+380}L90 ${hd+260}"/>`;break;
    case 'fcu':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><rect class="d" x="${-hw*0.6}" y="${-hd*0.6}" width="${w*0.6}" height="${d*0.6}"/><path class="d" d="M${-hw*0.85} ${-hd*0.75}V${hd*0.75}M${hw*0.85} ${-hd*0.75}V${hd*0.75}M${-hw*0.75} ${-hd*0.85}H${hw*0.75}M${-hw*0.75} ${hd*0.85}H${hw*0.75}"/>`;break;
    case 'grille':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="M${-hw} ${-hd}L${hw} ${hd}M${hw} ${-hd}L${-hw} ${hd}"/>`;break;
    case 'grillr':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="${[-0.5,-0.17,0.17,0.5].map(f=>`M${-hw} ${f*d}H${hw}`).join('')}"/>`;break;
    case 'det':case 'spk':case 'wap':case 'pir':s=`<circle class="b" r="${hw}"/><circle class="d" r="${hw*0.5}"/>`;break;
    case 'spr':s=`<circle class="b" r="${hw}"/><path class="d" d="M${-hw} 0H${hw}M0 ${-hw}V${hw}"/>`;break;
    case 'dl':case 'pend':s=`<circle class="b" r="${hw}"/><circle class="d" r="${hw*0.35}"/>`;break;
    case 'panel':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="M${-hw} ${-hd}L${hw} ${hd}M${hw} ${-hd}L${-hw} ${hd}"/>`;break;
    case 'linear':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="M${-hw*0.9} 0H${hw*0.9}"/>`;break;
    case 'acp':case 'baffle':s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><rect class="d" x="${-hw*0.85}" y="${-hd*0.85}" width="${w*0.85}" height="${d*0.85}" style="fill:none"/>`;break;
    case 'window':{const g=Math.max(8,d*0.14);s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/><path class="d" d="M${-hw} ${-g}H${hw}M${-hw} ${g}H${hw}"/>`;break}
    case 'poly':s=`<path class="b" d="M${(o.pts||[]).map(p=>p[0]+' '+p[1]).join('L')}Z"/>`;break;
    default:s=`<rect class="b" x="${-hw}" y="${-hd}" width="${w}" height="${d}"/>`;
  }
  return s;
}
function itemLabel(o){
  if(o.label)return o.label;if(P.lbl==='none')return'';return P.lbl==='code'?o.code||'':o.name||'';
}
function draw(){
  if(clashDirty&&P.clash){const mv=(drag&&drag.m==='move'&&drag.moved&&drag.orig)?new Set(drag.orig.map(x=>x[0]).concat(S.objs.filter(isOpening).map(o=>o.id))):null;computeClash(mv)}
  const k=V.k;
  document.body.classList.toggle('fill-outline',P.fill==='outline');document.body.classList.toggle('rcp',!!P.rcp);
  svg.classList.toggle('has-under',!!(S.underlay&&S.underlay.src&&S.underlay.visible!==false));
  // grid
  $('#gp-minor').setAttribute('width',P.grid);$('#gp-minor').setAttribute('height',P.grid);$('#gp-minor path').setAttribute('d',`M${P.grid} 0H0V${P.grid}`);
  const mg=P.grid*5;$('#gp-major').setAttribute('width',mg);$('#gp-major').setAttribute('height',mg);$('#gp-major path').setAttribute('d',`M${mg} 0H0V${mg}`);
  $('#gr-minor').style.display=P.grid*k<6?'none':'';$('#L-grid').style.display=LY('grid')?'':'none';
  // rooms
  let rs='',an='';
  const wallPx=P.wall>0?Math.max(1.5,P.wall*k):1.5;
  S.objs.filter(o=>o.t==='room').forEach(o=>{
    const d='M'+o.pts.map(p=>p[0]+' '+p[1]).join('L')+'Z';
    const fc=o.floorCol||(S.style&&S.style.floor);
    const mg=LY('mig')?migRoom(o):null;
    if(LY('walls'))rs+=`<path data-id="${o.id}" class="room-f${sel.has(o.id)?' sel':''}${mg?' mig-'+mg.st:''}" d="${d}" stroke-width="${o.nowall?0:wallPx}" vector-effect="non-scaling-stroke"${fc&&!sel.has(o.id)?` style="fill:${fc};fill-opacity:.6"`:''}/>`;
    const c=centroid(o.pts),area=Math.abs(polyArea(o.pts))/1e6,b=bboxPts(o.pts);
    if((b.x1-b.x0)*k>70&&(b.y1-b.y0)*k>36){
      if(LY('labels'))an+=`<text class="room-lbl" x="${c[0]}" y="${c[1]-fs(3)}" font-size="${fs(13)}" text-anchor="middle">${esc(o.name||'Room')}</text>`;if(LY('areas'))an+=`<text class="room-area" x="${c[0]}" y="${c[1]+(LY('labels')?fs(13):0)}" font-size="${fs(11)}" text-anchor="middle">${area.toFixed(1)} m²</text>`;
      if(mg)an+=`<text class="mig-lbl mig-${mg.st}" x="${c[0]}" y="${c[1]+(LY('labels')?fs(13):0)+(LY('areas')?fs(13):0)}" font-size="${fs(10.5)}" text-anchor="middle">MIG ${esc(mg.label)} · ${mg.ent} m²${mg.st==='ok'?' ✓':` · ${mg.diff>0?'+':''}${mg.diff.toFixed(1)} m²`}</text>`;
    }
    if(LY('walldims')&&(P.dims==='all'||sel.has(o.id))){const ccw=polyArea(o.pts)<0;for(let i=0;i<o.pts.length;i++){const a=o.pts[i],e=o.pts[(i+1)%o.pts.length],L=Math.hypot(e[0]-a[0],e[1]-a[1]);if(L*k<40)continue;let nx=(e[1]-a[1])/L,ny=-(e[0]-a[0])/L;if(ccw){nx=-nx;ny=-ny}const off=fs(12)+(P.wall/2);const mx=(a[0]+e[0])/2+nx*off,my=(a[1]+e[1])/2+ny*off;let ang=Math.atan2(e[1]-a[1],e[0]-a[0])*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180;an+=`<text class="edge-lbl" font-size="${fs(10.5)}" text-anchor="middle" dominant-baseline="central" transform="translate(${mx} ${my}) rotate(${ang})">${fmt(L)}</text>`}}
  });
  rs=siteSVG()+rs;
  if(LY('walls'))S.objs.filter(o=>o.t==='wall'&&!o.site).forEach(o=>{
    if(!o.pts||o.pts.length<2)return;
    const d='M'+wallPathPts(o).map(p=>p[0]+' '+p[1]).join('L')+(o.closed?'Z':'');
    rs+=`<path data-id="${o.id}" class="wall-f${sel.has(o.id)?' sel':''}" d="${d}" stroke-width="${Math.max(o.th||100,fs(2))}"/>`;
    if(LY('walldims')&&(P.dims==='all'||sel.has(o.id)))rawSegs(o).forEach(([a,e,si])=>{const g=arcGeom(a,e,segBulge(o,si)),L=g.len;if(g.L*k<40)return;const sgn=g.straight||segBulge(o,si)>0?1:-1;const nx=g.n[0]*sgn,ny=g.n[1]*sgn,off=fs(12)+(o.th||0)/2;const mx=g.P[0]+nx*off,my=g.P[1]+ny*off;let ang=Math.atan2(e[1]-a[1],e[0]-a[0])*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180;an+=`<text class="edge-lbl" font-size="${fs(10.5)}" text-anchor="middle" dominant-baseline="central" transform="translate(${mx} ${my}) rotate(${ang})">${fmt(L)}</text>`});
  });
  if(roofMode&&roofRefObjs.length){let rf='<g style="pointer-events:none">';roofRefObjs.forEach(o=>{if(!o.pts||o.pts.length<2)return;const d='M'+wallPathPts(o).map(p=>p[0]+' '+p[1]).join('L')+((o.t==='room'||o.closed)?'Z':'');rf+=o.t==='room'?`<path d="${d}" fill="#5f6b78" fill-opacity=".05" stroke="#5f6b78" stroke-opacity=".3" stroke-width="${fs(1.2)}" stroke-dasharray="${fs(6)} ${fs(5)}"/>`:`<path d="${d}" fill="none" stroke="#5f6b78" stroke-opacity=".4" stroke-width="${Math.max(o.th||100,fs(2))}"/>`});rs=rf+'</g>'+rs}
  $('#L-rooms').innerHTML=rs;
  // zones and items
  let zs='',is='';
  /* column grid: chain-dot lines with numbered and lettered bubbles */
  const GR=S.bld&&S.bld.grid;if(GR&&LY('cgrid')&&GR.X&&GR.X.length&&GR.Y&&GR.Y.length){const ext=2400,r=420,x0=GR.X[0]-ext,x1=GR.X.at(-1)+ext,y0=GR.Y[0]-ext,y1=GR.Y.at(-1)+ext;
    GR.X.forEach((x,i)=>{zs+=`<line class="cgl" x1="${x}" y1="${y0+r}" x2="${x}" y2="${y1}"/><circle class="cgb" cx="${x}" cy="${y0}" r="${r}"/><text class="cgt" x="${x}" y="${y0}" font-size="${r}">${i+1}</text>`});
    GR.Y.forEach((y,i)=>{zs+=`<line class="cgl" x1="${x0+r}" y1="${y}" x2="${x1}" y2="${y}"/><circle class="cgb" cx="${x0}" cy="${y}" r="${r}"/><text class="cgt" x="${x0}" y="${y}" font-size="${r}">${gridLetter(i)}</text>`})}
  const camWalls=LY('cover')&&S.objs.some(o=>isCCTV(o)&&visible(o))?wallRuns():null;
  /* fixed order: doors, windows and columns (the building's own parts), then furniture, then ceiling items. The list order of those parts changes when a floor is stored and brought back, so drawing by list order made a window jump under or over a desk after reopening */
  const zOf=o=>isCeil(o)?2:isBaseObj(o)?0:1;
  S.objs.filter(o=>o.t==='item'&&visible(o)).sort((a,b)=>zOf(a)-zOf(b)).forEach(o=>{
    const tr=`translate(${o.x} ${o.y}) rotate(${o.r||0})${o.flip?' scale(-1 1)':''}`;
    if(isCeil(o)&&LY('cover')){if(isCCTV(o))zs+=`<path class="cctv-fov${sel.has(o.id)?' on':''}" d="M${cctvPoly(o,camWalls).map(p=>p[0]+' '+p[1]).join('L')}Z"/>`;else if(o.cov>0)zs+=`<circle class="cov" cx="${o.x}" cy="${o.y}" r="${o.cov}"/>`}
    if(LY('zones')){zoneLocal(o).forEach((p,zi)=>{zs+=`<path class="zone${P.clash&&clashCache.zbad.has(o.id+':'+zi)?' bad':''}" transform="${tr}" d="M${p.map(q=>q[0]+' '+q[1]).join('L')}Z"/>`})}
    const cls=`it ${catCls(o.cat)}${isCeil(o)?' ceil':''}${o.col?' painted':''}${P.clash&&clashCache.bad.has(o.id)?' clash':''}`;
    is+=`<g data-id="${o.id}" class="${cls}" transform="${tr}"${o.col?` style="--pc:${o.col}"`:''}>${shapeSVG(o)}${(e=>e.grown?`<rect class="env" x="${e.x0}" y="${e.y0}" width="${e.x1-e.x0}" height="${e.y1-e.y0}"/>`:'')(envOf(o))}</g>`;
    const lb=itemLabel(o);
    if(lb){const sw=Math.min(o.w,o.d)*k,lw=Math.max(o.w,o.d)*k;if(sw>14&&lw>34){const f=Math.min(11,sw*0.42),maxc=Math.floor(lw/(f*0.56));if(lb.length>maxc&&maxc<10){}else{const t=lb.length>maxc?lb.slice(0,Math.max(1,maxc-1))+'…':lb;const rot=((o.r||0)%180+180)%180;const vert=(o.w<o.d)!==(rot===90);an+=`<text class="it-lbl" x="${o.x}" y="${o.y}" font-size="${fs(f)}" text-anchor="middle" dominant-baseline="central"${vert?` transform="rotate(-90 ${o.x} ${o.y})"`:''}>${esc(t)}</text>`}}}
  });
  if(LY('ceil'))S.objs.filter(o=>o.t==='trunk'&&o.pts&&o.pts.length>=2).forEach(o=>{const d='M'+o.pts.map(p=>p[0]+' '+p[1]).join('L');is+=`<path data-id="${o.id}" class="trunk${sel.has(o.id)?' sel':''}" d="${d}" stroke-width="${o.w}"${o.col&&!sel.has(o.id)?` style="stroke:${o.col}"`:''}/><path class="trunk-c" d="${d}" style="pointer-events:none"/>`;const c=o.pts[Math.floor(o.pts.length/2)];if(LY('labels'))an+=`<text class="it-lbl" x="${c[0]}" y="${c[1]}" font-size="${fs(10)}" text-anchor="middle" dominant-baseline="central">${o.w}×${o.h}</text>`});
  $('#L-zones').innerHTML=zs;$('#L-items').innerHTML=is;
  // texts and dims
  S.objs.forEach(o=>{
    if(!visible(o))return;
    if(o.t==='text')an+=`<text data-id="${o.id}" class="txt" x="${o.x}" y="${o.y}" font-size="${o.size}" text-anchor="middle" dominant-baseline="central" style="cursor:move"${o.r?` transform="rotate(${o.r} ${o.x} ${o.y})"`:''}>${esc(o.text)}</text>`;
    if(o.t==='dim')an+=dimSVG(o.a,o.b,o.id);
  });
  $('#L-anno').innerHTML=an;
  drawNorth();
  drawOverlay();
  {const le=$('#L-egress');if(le)le.innerHTML=zoneLayer()+egressLayer()}zoneLegend();
  {const lp=$('#L-pins');if(lp)lp.innerHTML=pinsLayer()}
  updateUnderImg();
  if(!$('#p-sch').hidden)renderSchedule();if(!$('#p-secz').hidden)renderSecz();
  if(is3D)schedule3D();
}
function dimSVG(a,b,id){
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1)return'';
  const nx=-(b[1]-a[1])/L,ny=(b[0]-a[0])/L,t=fs(5);
  let ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180;
  const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
  return `<g${id?` data-id="${id}" style="cursor:move"`:''}><line class="dimln" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><line class="dimln" x1="${a[0]-nx*t}" y1="${a[1]-ny*t}" x2="${a[0]+nx*t}" y2="${a[1]+ny*t}"/><line class="dimln" x1="${b[0]-nx*t}" y1="${b[1]-ny*t}" x2="${b[0]+nx*t}" y2="${b[1]+ny*t}"/><text class="dimtx" font-size="${fs(11)}" stroke-width="${fs(3)}" text-anchor="middle" transform="translate(${mx+nx*fs(9)} ${my+ny*fs(9)}) rotate(${ang})">${fmt(L)}</text>${id?`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="transparent" stroke-width="${fs(12)}"/>`:''}</g>`;
}
function drawOverlay(){
  let s='';const k=V.k;
  const list=[...sel].map(byId).filter(Boolean);
  list.forEach(o=>{
    if(o.t==='item')s+=`<g transform="translate(${o.x} ${o.y}) rotate(${o.r||0})"><rect class="selo" x="${-o.w/2}" y="${-o.d/2}" width="${o.w}" height="${o.d}"/></g>`;
    else if(o.t==='room'||o.t==='wall'){s+=`<path class="selo" d="M${(o.t==='wall'?wallPathPts(o):o.pts).map(p=>p[0]+' '+p[1]).join('L')}${o.t==='room'||o.closed?'Z':''}"/>`;
      if(o.t==='wall'&&list.length===1&&o.spline)s+=`<path class="ctrlpoly" d="M${o.pts.map(p=>p[0]+' '+p[1]).join('L')}${o.closed?'Z':''}"/>`;
      if(o.t==='wall'&&list.length===1&&!S.locked&&!o.spline)rawSegs(o).forEach(([a,b,i])=>{const P=arcGeom(a,b,segBulge(o,i)).P,r=fs(5.5);s+=`<rect class="bh" data-bh="${i}" x="${P[0]-r}" y="${P[1]-r}" width="${2*r}" height="${2*r}" transform="rotate(45 ${P[0]} ${P[1]})"><title>Drag to curve this wall · double-click to straighten</title></rect>`});if(list.length===1&&!S.locked&&!(o.t==='room'&&o.link))o.pts.forEach((p,i)=>{s+=`<circle class="vh" data-vh="${i}" cx="${p[0]}" cy="${p[1]}" r="${fs(6)}"/>`})}
    else{const b=objBox(o);s+=`<rect class="selo" x="${b.x0}" y="${b.y0}" width="${b.x1-b.x0}" height="${b.y1-b.y0}"/>`}
  });
  if(list.length===1&&isCCTV(list[0])){const o=list[0],a=((o.r||0)+90)*Math.PI/180,L=fs(70),hx=o.x+Math.cos(a)*L,hy=o.y+Math.sin(a)*L;s+=`<line class="aiml" x1="${o.x}" y1="${o.y}" x2="${hx}" y2="${hy}"/><circle class="aimh" data-aim="1" cx="${hx}" cy="${hy}" r="${fs(7)}"><title>Drag to aim the camera</title></circle>`}
  s+=rotGripSVG(list.filter(o=>!fixed(o)));
  if(list.length>1){const b=unionBox(list);const p=fs(6);s+=`<rect class="selbox" x="${b.x0-p}" y="${b.y0-p}" width="${b.x1-b.x0+2*p}" height="${b.y1-b.y0+2*p}"/>`}
  if(LY('gaps')&&list.length&&list.every(o=>o.t==='item'))s+=gapsSVG(list);
  if(list.length===1&&list[0].t==='item'){const o=list[0],b=objBox(o);s+=`<text class="dimtx" font-size="${fs(11)}" stroke-width="${fs(3)}" x="${(b.x0+b.x1)/2}" y="${b.y1+fs(16)}" text-anchor="middle">${fmt(o.w)} × ${fmt(o.d)}</text>`}
  s+=liveSVG()+guideSVG+(typeof SU!=='undefined'&&SU?suSVG():'')+(typeof TUT!=='undefined'&&TUT&&TUT.on?tutSVG():'');try{tutCta()}catch(e){}
  $('#L-over').innerHTML=s;
  {const lc=$('#L-cmp');if(lc)lc.innerHTML=cmp?cmpSVG():'';const lg=$('#cmp-legend');if(lg){lg.hidden=!cmp;if(cmp)lg.innerHTML=`<b>vs ${esc(cmp.name)}</b><span class="cl g"></span>added<span class="cl a"></span>changed<span class="cl r"></span>removed<button type="button" id="cmp-cl" class="cmp-cl${P.clouds?' on':''}" aria-pressed="${!!P.clouds}" title="Draw revision clouds round the changes">☁ Clouds${P.clouds?` △${cmpRevNo()}`:''}</button><button type="button" id="cmp-x" title="Exit compare">✕</button>`}}
}
/* gaps: rays from selection bbox to nearest walls or other items */
function segs(){
  const out=[];const ids=sel;
  S.objs.forEach(o=>{if(!visible(o))return;if(o.t==='room'){const p=o.pts,h=o.nowall?0:P.wall/2;for(let i=0;i<p.length;i++)out.push([p[i],p[(i+1)%p.length],h])}else if(o.t==='wall'){wallSegs(o).forEach(([a,b])=>out.push([a,b,(o.th||0)/2]))}else if(o.t==='item'&&!ids.has(o.id)&&!o.nests){const q=toW(o,rectP(-o.w/2,-o.d/2,o.w/2,o.d/2));for(let i=0;i<4;i++)out.push([q[i],q[(i+1)%4],0])}});
  return out;
}
function rayHit(ox,oy,dx,dy,S2){let best=Infinity;S2.forEach(([a,b,h])=>{const ex=b[0]-a[0],ey=b[1]-a[1];const den=dx*ey-dy*ex;if(Math.abs(den)<1e-9)return;const t=((a[0]-ox)*ey-(a[1]-oy)*ex)/den,u=((a[0]-ox)*dy-(a[1]-oy)*dx)/den;if(t>0.5&&u>=-1e-6&&u<=1+1e-6){const tt=t-h;if(tt<best)best=tt}});return best}
function gapsSVG(list){
  const b=unionBox(list),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,S2=segs();let s='<g class="gap">';
  const dirs=[[b.x0,cy,-1,0],[b.x1,cy,1,0],[cx,b.y0,0,-1],[cx,b.y1,0,1]];
  dirs.forEach(([ox,oy,dx,dy])=>{const t=rayHit(ox,oy,dx,dy,S2);if(!isFinite(t)||t<=1||t>30000)return;const ex=ox+dx*t,ey=oy+dy*t;s+=`<line x1="${ox}" y1="${oy}" x2="${ex}" y2="${ey}"/><text font-size="${fs(11)}" stroke-width="${fs(3)}" x="${(ox+ex)/2+(dy?fs(4):0)}" y="${(oy+ey)/2-(dx?fs(4):0)}" text-anchor="${dy?'start':'middle'}">${fmt(t)}</text>`});
  return s+'</g>';
}

/* ================= egress / fire check (advisory) =================
   Geodesic travel distance to the nearest marked exit, corridor clear width, and single-route (dead-end) areas.
   Numbers are editable defaults, NOT a compliance sign-off. */
const FIRE_DEF={travel:30000,deadend:15000,corridor:1200};
function fireCfg(){const f=S.fire||{};return{travel:num(f.travel,FIRE_DEF.travel),deadend:num(f.deadend,FIRE_DEF.deadend),corridor:num(f.corridor,FIRE_DEF.corridor)}}
let EG={on:false,res:null,img:null,geo:null};
function curLv(){return S.bld?bldLevel(S).id:null}
function visPins(){const cl=curLv();return (S.pins||[]).filter(p=>!p.lv||!S.bld||p.lv===cl)}
function pinsLayer(){const ps=visPins();if(!ps.length)return'';const r=Math.max(240,fs(11));let s='';
  ps.forEach((p,idx)=>{const cls='pin-m'+(p.done?' done':'')+(pinSel===p.id?' sel':'');
    s+=`<g class="${cls}" data-pin="${p.id}" transform="translate(${p.x},${p.y})"><circle class="pin-body" r="${r}"/><text class="pin-n" x="0" y="0" font-size="${fs(12)}">${p.done?'✓':pinNo(p)}</text></g>`});
  return s}
function egressExits(){return S.objs.filter(o=>o.exit&&(isOpening(o)||isCore(o))&&visible(o))}
function egressCompute(){
  const cfg=fireCfg();
  const rooms=S.objs.filter(o=>o.t==='room'&&visible(o));
  const walls=S.objs.filter(o=>o.t==='wall'&&!o.site&&visible(o));
  const obst=S.objs.filter(o=>(isCol(o)||isCore(o))&&visible(o));
  const exits=egressExits();
  if(!rooms.length&&!walls.length)return{err:'Draw rooms or walls first, then mark an exit.'};
  const plate=floorPlate();
  if(!plate.length)return{err:'Could not trace the floor outline — make sure rooms or walls enclose the space.'};
  if(!exits.length)return{err:'Mark at least one exit: select a door or an exit stair, then tick “Final exit (egress)”.'};
  const pts=[];plate.forEach(poly=>poly.forEach(p=>pts.push(p)));const B=bboxPts(pts);
  const pad=1500;let c=180;const gw=B.x1-B.x0+2*pad,gh=B.y1-B.y0+2*pad,maxCells=300000;
  if(gw*gh/(c*c)>maxCells)c=Math.ceil(Math.sqrt(gw*gh/maxCells));
  const gx0=B.x0-pad,gy0=B.y0-pad,GW=Math.ceil(gw/c)+1,GH=Math.ceil(gh/c)+1,N=GW*GH;
  const CX=i=>gx0+(i+0.5)*c,CY=j=>gy0+(j+0.5)*c;
  const inside=new Uint8Array(N),blocked=new Uint8Array(N),nearDoor=new Uint8Array(N);
  const fill=(poly,arr)=>{for(let j=0;j<GH;j++){const y=CY(j),xs=[];for(let i=0,k=poly.length-1;i<poly.length;k=i++){const a=poly[i],b=poly[k];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))}xs.sort((p,q)=>p-q);for(let t=0;t+1<xs.length;t+=2){const i0=Math.max(0,Math.ceil((xs[t]-gx0)/c-0.5)),i1=Math.min(GW-1,Math.floor((xs[t+1]-gx0)/c-0.5));for(let i=i0;i<=i1;i++)arr[j*GW+i]=1}}};
  const line=(a,b,r)=>{r=Math.max(r,c*0.6);const i0=Math.max(0,Math.floor((Math.min(a[0],b[0])-r-gx0)/c)),i1=Math.min(GW-1,Math.ceil((Math.max(a[0],b[0])+r-gx0)/c)),j0=Math.max(0,Math.floor((Math.min(a[1],b[1])-r-gy0)/c)),j1=Math.min(GH-1,Math.ceil((Math.max(a[1],b[1])+r-gy0)/c));for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(segDist(CX(i),CY(j),a,b)<=r)blocked[j*GW+i]=1};
  plate.forEach(poly=>fill(poly,inside));
  rooms.forEach(r=>{if(!r.nowall)r.pts.forEach((p,i)=>line(p,r.pts[(i+1)%r.pts.length],(P.wall||100)/2))});
  walls.forEach(w=>wallSegs(w).forEach(([a,b])=>line(a,b,(w.th||100)/2)));
  obst.forEach(o=>bodyLocal(o).forEach(poly=>fill(toW(o,poly),blocked)));
  const doors=S.objs.filter(o=>isOpening(o)&&!isWin(o)&&visible(o));
  const carve=o=>{const w=(o.w||900),dd=Math.max(o.d||200,(P.wall||150)+300),poly=toW(o,rectP(-w/2-c,-dd/2-(P.wall||150),w/2+c,dd/2+(P.wall||150)));
    const bb=bboxPts(poly),i0=Math.max(0,Math.floor((bb.x0-gx0)/c)),i1=Math.min(GW-1,Math.ceil((bb.x1-gx0)/c)),j0=Math.max(0,Math.floor((bb.y0-gy0)/c)),j1=Math.min(GH-1,Math.ceil((bb.y1-gy0)/c));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(pointInPoly(CX(i),CY(j),poly)){blocked[j*GW+i]=0;nearDoor[j*GW+i]=1}};
  doors.forEach(carve);
  const walk=new Uint8Array(N);for(let k=0;k<N;k++)walk[k]=(inside[k]&&!blocked[k])?1:0;
  /* Dijkstra from all exit seeds */
  const INF=Infinity,dist=new Float64Array(N);dist.fill(INF);
  const heap=[];let hn=0;
  const hpushq=(d,k)=>{heap[hn++]=[d,k];let i=hn-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;const t=heap[p];heap[p]=heap[i];heap[i]=t;i=p}};
  const hpopq=()=>{const top=heap[0],last=heap[--hn];heap.length=hn;if(hn){heap[0]=last;let i=0;for(;;){let l=2*i+1,r=l+1,s=i;if(l<hn&&heap[l][0]<heap[s][0])s=l;if(r<hn&&heap[r][0]<heap[s][0])s=r;if(s===i)break;const t=heap[s];heap[s]=heap[i];heap[i]=t;i=s}}return top};
  const seedAt=(wx,wy,R)=>{let any=false;const i0=Math.max(0,Math.floor((wx-R-gx0)/c)),i1=Math.min(GW-1,Math.ceil((wx+R-gx0)/c)),j0=Math.max(0,Math.floor((wy-R-gy0)/c)),j1=Math.min(GH-1,Math.ceil((wy+R-gy0)/c));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*GW+i;if(walk[k]&&Math.hypot(CX(i)-wx,CY(j)-wy)<=R){if(dist[k]>0){dist[k]=0;hpushq(0,k)}any=true}}return any};
  exits.forEach(o=>{const R=Math.max(o.w||1200,o.d||1200,1600)/2+2*c;if(!seedAt(o.x,o.y,R)){/* nudge: nearest walkable */let best=-1,bd=1e9;for(let k=0;k<N;k++)if(walk[k]){const d=Math.hypot(CX(k%GW)-o.x,CY((k/GW)|0)-o.y);if(d<bd){bd=d;best=k}}if(best>=0&&bd<8*c){dist[best]=0;hpushq(0,best)}}});
  const D=c,Dd=c*1.4142136;
  while(hn){const[d,k]=hpopq();if(d>dist[k])continue;const i=k%GW,j=(k/GW)|0;
    const rel=(ni,nj,w)=>{if(ni<0||nj<0||ni>=GW||nj>=GH)return;const nk=nj*GW+ni;if(!walk[nk])return;const nd=d+w;if(nd<dist[nk]){dist[nk]=nd;hpushq(nd,nk)}};
    const L=i>0&&walk[k-1],R=i<GW-1&&walk[k+1],U=j>0&&walk[k-GW],Dn=j<GH-1&&walk[k+GW];
    rel(i-1,j,D);rel(i+1,j,D);rel(i,j-1,D);rel(i,j+1,D);
    if(L&&U)rel(i-1,j-1,Dd);if(R&&U)rel(i+1,j-1,Dd);if(L&&Dn)rel(i-1,j+1,Dd);if(R&&Dn)rel(i+1,j+1,Dd);
  }
  /* per-room worst travel distance */
  let worst=0,worstXY=null,unreached=0;
  const roomRes=rooms.map(r=>{let mx=-1,mxXY=null,reach=false,cells=0;const bb=bboxPts(r.pts),i0=Math.max(0,Math.floor((bb.x0-gx0)/c)),i1=Math.min(GW-1,Math.ceil((bb.x1-gx0)/c)),j0=Math.max(0,Math.floor((bb.y0-gy0)/c)),j1=Math.min(GH-1,Math.ceil((bb.y1-gy0)/c));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*GW+i;if(!walk[k]||!pointInPoly(CX(i),CY(j),r.pts))continue;cells++;if(dist[k]<INF){reach=true;if(dist[k]>mx){mx=dist[k];mxXY=[CX(i),CY(j)]}}}
    if(!cells)return null;const miss=cells&&!reach;if(reach&&mx>worst){worst=mx;worstXY=mxXY}if(miss)unreached++;
    return{id:r.id,name:r.name||'Room',mx:reach?mx:INF,reach,fail:!reach||mx>cfg.travel};}).filter(Boolean);
  /* heatmap image */
  const cv=document.createElement('canvas');cv.width=GW;cv.height=GH;const ctx=cv.getContext('2d'),img=ctx.createImageData(GW,GH),px=img.data;
  const lim=cfg.travel;
  for(let k=0;k<N;k++){let r=0,g=0,b=0,a=0;if(walk[k]){if(dist[k]===INF){r=150;g=120;b=170;a=150}else{const t=Math.min(1.6,dist[k]/lim);if(t<=1){const u=t;r=Math.round(31+u*(245-31));g=Math.round(157+u*(179-157));b=Math.round(85+u*(1-85))}else{const u=Math.min(1,(t-1)/0.6);r=Math.round(245+u*(197-245));g=Math.round(179+u*(26-179));b=Math.round(1+u*(45-1))}a=150}}px[k*4]=r;px[k*4+1]=g;px[k*4+2]=b;px[k*4+3]=a}
  ctx.putImageData(img,0,0);
  return{cfg,GW,GH,c,gx0,gy0,worst:worstXY?worst:0,worstXY,rooms:roomRes,exits:exits.length,unreached,imgURL:cv.toDataURL(),geo:{x:gx0,y:gy0,w:GW*c,h:GH*c}};
}
function egressRun(silent){EG.on=false;EG.img=null;EG.res=null;render();const res=egressCompute();EG.res=res;EG.on=!res.err;if(res.err){EG.img=null;if(!silent)toast(res.err)}else{EG.img=res.imgURL;EG.geo=res.geo}render();if(!$('#p-fire').hidden)renderFire();return res}
function egressLayer(){let s='';
  if(EG.on&&EG.res&&!EG.res.err){const r=EG.res,g=r.geo;
    if(EG.img)s+=`<image href="${EG.img}" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" opacity="0.55" preserveAspectRatio="none"/>`;
    egressExits().forEach(o=>{s+=`<rect class="eg-exit" x="${o.x-220}" y="${o.y-220}" width="440" height="440" rx="60"/><text class="eg-exit-t" x="${o.x}" y="${o.y+fs(5)}" font-size="${fs(13)}" text-anchor="middle">EXIT</text>`});
    r.rooms.forEach(rm=>{const o=byId(rm.id);if(!o)return;const ct=centroid(o.pts);if(!rm.reach)s+=`<text class="eg-fail" x="${ct[0]}" y="${ct[1]+fs(20)}" font-size="${fs(12)}" text-anchor="middle">no route to an exit</text>`;else s+=`<text class="${rm.fail?'eg-fail':'eg-ok'}" x="${ct[0]}" y="${ct[1]+fs(20)}" font-size="${fs(12)}" text-anchor="middle">${(rm.mx/1000).toFixed(1)} m${rm.fail?' ⚠':''}</text>`});
  }
  if(S.section&&S.section.a&&S.section.b){const a=S.section.a,b=S.section.b,mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;let nx=b[1]-a[1],ny=-(b[0]-a[0]);const L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;if(S.section.flip){nx=-nx;ny=-ny}const al=fs(60);
    if(secSel)s+=`<line class="selo" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    s+=`<line class="sec-line" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><path class="sec-arr" d="M${mx} ${my}L${mx+nx*al-ny*al*0.3} ${my+ny*al+nx*al*0.3}L${mx+nx*al+ny*al*0.3} ${my+ny*al-nx*al*0.3}Z"/>`;
    if(secSel){[a,b].forEach((p,i)=>{s+=`<circle class="vh" data-sech="${i}" cx="${p[0]}" cy="${p[1]}" r="${fs(7)}" style="pointer-events:all"/>`})}}
  return s;
}
function sectionApply(){if(!T3||!T3.renderer)return;kick3D();const r=T3.renderer,sec=S.section;
  if(sec&&sec.on&&sec.a&&sec.b&&is3D&&!WALK.on&&!bldView){const{THREE}=T3,s=0.001,a=sec.a,b=sec.b;let nx=b[1]-a[1],ny=-(b[0]-a[0]);const L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;if(sec.flip){nx=-nx;ny=-ny}
    const n=new THREE.Vector3(nx,0,ny),pt=new THREE.Vector3(a[0]*s,0,a[1]*s),pl=new THREE.Plane();pl.setFromNormalAndCoplanarPoint(n,pt);r.clippingPlanes=[pl]}
  else r.clippingPlanes=[];
  if(is3D&&T3.scene&&!T3.raf)r.render(T3.scene,T3.camera);
}

/* ================= security zones (PSM): each room White, Green, Red or Black; an overlay switched on and off like the exits heat map ================= */
const ZONES=[['white','White','#ffffff','#7d8792'],['green','Green','#2f9e5b','#2f9e5b'],['red','Red','#d64534','#d64534'],['black','Black','#1b1e22','#1b1e22']];
const ZONE_BY=Object.fromEntries(ZONES.map(z=>[z[0],z]));
const zoneOn=()=>LY('secz');
/* each zone colour can be hidden on its own; zoneVis says whether a room's zone is being shown right now */
const zoneHid=z=>!!(P.szHide&&P.szHide[z]);const zoneVis=o=>zoneOn()&&o.zone&&ZONE_BY[o.zone]&&!zoneHid(o.zone);
function setZoneShow(z,on){P.szHide=Object.assign({},P.szHide,{[z]:!on});savePrefs();render();if(!$('#p-secz').hidden)renderSecz();if(is3D)build3D()}
function setZoneLayer(on){P.layers.secz=!!on;savePrefs();renderLayers();render();renderInspector();if(!$('#p-secz').hidden)renderSecz();if(is3D)build3D()}
function zoneLayer(){if(!zoneOn())return'';let s='<g class="secz" style="pointer-events:none">';
  S.objs.filter(o=>o.t==='room'&&zoneVis(o)&&visible(o)).forEach(o=>{const z=ZONE_BY[o.zone],d='M'+o.pts.map(p=>p[0]+' '+p[1]).join('L')+'Z',b=bboxPts(o.pts);
    s+=`<path class="sz sz-${z[0]}" d="${d}" fill="${z[2]}" fill-opacity="${z[0]==='white'?0.28:z[0]==='black'?0.45:0.32}" stroke="${z[3]}" stroke-width="2.5" vector-effect="non-scaling-stroke"${z[0]==='white'?' stroke-dasharray="6 4"':''}/>`;
    if((b.x1-b.x0)*V.k>60&&(b.y1-b.y0)*V.k>30)s+=`<text class="sz-t sz-t-${z[0]}" x="${b.x0+fs(6)}" y="${b.y0+fs(14)}" font-size="${fs(10.5)}">${z[1].toUpperCase()} ZONE</text>`});
  return s+'</g>'}
function zoneSummary(){const r={};ZONES.forEach(z=>r[z[0]]={n:0,area:0});r.none={n:0,area:0};S.objs.filter(o=>o.t==='room').forEach(o=>{const k=o.zone&&ZONE_BY[o.zone]?o.zone:'none';r[k].n++;r[k].area+=Math.abs(polyArea(o.pts))/1e6});return r}
function zoneLegend(){const el=$('#sz-legend');if(!el)return;const on=zoneOn();el.hidden=!on;if(!on)return;const Z=zoneSummary();
  el.innerHTML=`<b>Security zones</b>${ZONES.filter(z=>!zoneHid(z[0])).map(z=>`<span class="szc sz-${z[0]}"></span>${z[1]} <span class="muted">${Z[z[0]].area.toFixed(0)} m²</span>`).join('')}<button type="button" data-sz="off" aria-label="Hide security zones" title="Hide security zones">✕</button>`}
function zoneRow(cur){return`<div class="szrow" role="group" aria-label="Security zone">${[['','None']].concat(ZONES).map(z=>`<button type="button" class="btn sm sz-b${(cur||'')===z[0]?' on':''}" data-zone="${z[0]}" aria-pressed="${(cur||'')===z[0]}"><i class="szc sz-${z[0]||'none'}"></i>${z[1]}</button>`).join('')}</div>${zoneOn()?'':'<p class="muted" style="margin-top:6px">Zones are hidden. <button type="button" class="linkbtn" data-sz="on">Show security zones</button></p>'}`}
function applyZone(z,ids){const rs=(ids?ids.map(byId):selList()).filter(o=>o&&o.t==='room');if(!rs.length)return;checkpoint();rs.forEach(o=>{if(z)o.zone=z;else delete o.zone});markDirty();
  if(z&&!zoneOn()){P.layers.secz=true;savePrefs();renderLayers();toast(`${ZONE_BY[z][1]} zone set. Security zones are now shown; hide them in Layers or the Security tab.`)}
  render();renderInspector();if(!$('#p-secz').hidden)renderSecz();if(is3D)build3D()}
function renderSecz(){const el=$('#p-secz');if(!el)return;if(el.contains(document.activeElement)&&document.activeElement.tagName==='SELECT')return;const on=zoneOn(),Z=zoneSummary(),rooms=S.objs.filter(o=>o.t==='room');
  let h=`<button class="btn sm ghost" type="button" data-back="fire" style="margin:0 0 8px -6px">‹ All checks</button><div class="sec" style="margin-top:0">Security zones</div><p class="muted">Mark each room White, Green, Red or Black to the Physical Security Manual. The overlay works like the exits heat map: switch it on and off as you need it. It shows on the plan and in 3D.</p>
  <div class="row"><button class="btn sm${on?'':' primary'}" type="button" data-sz="${on?'off':'on'}">${on?'Hide all zones':'Show zones'}</button></div>
  <table class="sch"><thead><tr><th>Show</th><th>Zone</th><th style="text-align:right">Rooms</th><th style="text-align:right">m²</th></tr></thead><tbody>${ZONES.map(z=>`<tr><td><input type="checkbox" data-szshow="${z[0]}"${on&&!zoneHid(z[0])?' checked':''}${on?'':' disabled'} aria-label="Show ${z[1]} zone" style="width:auto"></td><td><i class="szc sz-${z[0]}"></i> ${z[1]}</td><td class="n">${Z[z[0]].n}</td><td class="n">${Z[z[0]].area.toFixed(1)}</td></tr>`).join('')}<tr class="muted"><td></td><td>Not set</td><td class="n">${Z.none.n}</td><td class="n">${Z.none.area.toFixed(1)}</td></tr></tbody></table>
  <div class="sec">Rooms${S.bld?' · this floor':''}</div>`;
  if(!rooms.length)h+='<p class="muted">No rooms drawn yet. Draw rooms, then give each a zone here or in Selection.</p>';
  else h+=`<table class="sch szlist"><tbody>${rooms.map(o=>`<tr><td>${esc(o.name||'Room')}<br><span class="muted" style="font-size:11px">${(Math.abs(polyArea(o.pts))/1e6).toFixed(1)} m²</span></td><td style="text-align:right"><select data-szroom="${o.id}" aria-label="Zone for ${esc(o.name||'Room')}"><option value="">Not set</option>${ZONES.map(z=>`<option value="${z[0]}"${o.zone===z[0]?' selected':''}>${z[1]}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>`;
  el.innerHTML=h}
$('#p-secz').addEventListener('change',e=>{const t=e.target;if(t.dataset.szshow){setZoneShow(t.dataset.szshow,t.checked);return}if(t.dataset.szroom){applyZone(t.value,[t.dataset.szroom]);t.blur();renderSecz()}});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-sz]');if(!b)return;setZoneLayer(b.dataset.sz==='on')});

/* ================= sun / daylight study =================
   Screen-up is North, +X is East (adjustable with a north offset). Solar azimuth/elevation from latitude, date and local clock time (approx — a design aid, not an almanac). */
const SUN={on:false,month:new Date().getMonth(),day:21,min:720,lat:1.35,north:0};
const COMPASS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function dayOfYear(mon,day){const d=new Date(2025,mon,day);return Math.round((d-new Date(2025,0,0))/864e5)}
function sunPos(lat,doy,hour){
  const rad=Math.PI/180;const decl=23.45*Math.sin(rad*360*(284+doy)/365);
  const H=15*(hour-12);const la=lat*rad,de=decl*rad,ha=H*rad;
  const sinEl=Math.sin(la)*Math.sin(de)+Math.cos(la)*Math.cos(de)*Math.cos(ha);
  const el=Math.asin(Math.max(-1,Math.min(1,sinEl)));
  let az=Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(la)-Math.tan(de)*Math.cos(la));/* from south, clockwise */
  az=(az/rad+180+360)%360;/* convert to from-north clockwise */
  return{az,el:el/rad};
}
function sunReadout(p){if(p.el<=0)return'Sun below the horizon (night)';const c=COMPASS[Math.round(p.az/22.5)%16];return`Sun from the ${c} (${Math.round(p.az)}°), ${Math.round(p.el)}° above horizon`}
/* bearing of screen-up, derived from the plan's north arrow */
const northUp=()=>((360-num(S.north,0))%360+360)%360;
function sunVec(az,el){const sa=(az-northUp())*Math.PI/180,e=el*Math.PI/180,ce=Math.cos(e);return[ce*Math.sin(sa),Math.sin(e),-ce*Math.cos(sa)]}
function applySun(){kick3D();
  if(!T3||!T3.renderer)return;const{THREE,dir,hemi,scene}=T3,s=0.001;const sg=T3.sunGroup;while(sg.children.length){const c=sg.children.pop();if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose()}
  const active=SUN.on&&is3D&&!WALK.on;
  if(!active){sg.visible=false;dir.visible=true;dir.intensity=0.7;dir.color.set(0xffffff);hemi.intensity=0.8;if(!WALK.on)scene.background=new THREE.Color(cssColor('--paper')).convertSRGBToLinear();const rd=$('#sun-read');if(rd)rd.textContent='';return}
  sg.visible=true;
  const doy=dayOfYear(SUN.month,SUN.day),hour=SUN.min/60,p=sunPos(SUN.lat,doy,hour);
  const[cx,cz]=T3.center||[0,0],span=T3.span||10,R=span*1.35;
  const v=sunVec(p.az,p.el);
  if(p.el>0){dir.visible=true;dir.position.set(cx+v[0]*R,v[1]*R,cz+v[2]*R);dir.target.position.set(cx,0,cz);dir.target.updateMatrixWorld();
    const k=Math.sin(Math.max(0,p.el)*Math.PI/180);dir.intensity=0.35+1.15*k;hemi.intensity=0.5;
    /* warm at low sun, white high */const warm=new THREE.Color().setHSL(0.11,0.6-0.5*k,0.5+0.45*k);dir.color.copy(warm);
    const sky=new THREE.Color().setHSL(0.58,0.45,0.18+0.42*k);scene.background=sky.convertSRGBToLinear();
  }else{dir.visible=false;dir.intensity=0;hemi.intensity=0.22;scene.background=new THREE.Color('#0b1016').convertSRGBToLinear()}
  /* sun disc */
  if(p.el>0){const disc=new THREE.Mesh(new THREE.SphereGeometry(span*0.03,20,16),new THREE.MeshBasicMaterial({color:0xffdf7a}));disc.position.set(cx+v[0]*R,v[1]*R,cz+v[2]*R);disc.userData.noExport=true;sg.add(disc);
    /* beam to building */const bg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(cx+v[0]*R,v[1]*R,cz+v[2]*R),new THREE.Vector3(cx,span*0.12,cz)]);sg.add(new THREE.Line(bg,new THREE.LineBasicMaterial({color:0xffcf6a,transparent:true,opacity:0.5})))}
  /* day path arc: sample the whole day where the sun is up */
  const arc=[];for(let h=0;h<=24;h+=0.25){const pp=sunPos(SUN.lat,doy,h);if(pp.el<=0)continue;const vv=sunVec(pp.az,pp.el);arc.push(new THREE.Vector3(cx+vv[0]*R,vv[1]*R,cz+vv[2]*R))}
  if(arc.length>1){const ag=new THREE.BufferGeometry().setFromPoints(arc);sg.add(new THREE.Line(ag,new THREE.LineDashedMaterial({color:0xffb347,dashSize:span*0.03,gapSize:span*0.02,transparent:true,opacity:0.8})).computeLineDistances())}
  const rd=$('#sun-read');if(rd)rd.textContent=sunReadout(p);
  if(is3D&&!T3.raf)T3.renderer.render(scene,camera);
}
function sunBar(){const b=$('#v3-sun');if(!b)return;const show=is3D&&!WALK.on;b.style.display=show?'':'none';b.classList.toggle('on',SUN.on);$('#sun-bar').hidden=!(show&&SUN.on);placeSunBar()}
/* the sun bar sits just below the 3D toolbar however many rows that toolbar wraps to, so it never covers its buttons */
function placeSunBar(){const sb=$('#sun-bar'),v=$('#v3 .v3bar')||$('.v3bar');if(!sb||sb.hidden||!v||!v.offsetParent)return;const m=$('#main').getBoundingClientRect(),vr=v.getBoundingClientRect();const top=Math.round(vr.bottom-m.top+6);sb.style.top=top+'px';const bar=$('#mbar'),br=bar&&bar.offsetParent?bar.getBoundingClientRect():null;sb.style.maxHeight=Math.max(48,(br?br.top:m.bottom)-m.top-top-8)+'px';sb.style.overflowY='auto'
  /* keep it beside an open drawer rather than under it */
  const dl=$('#d-lib'),di=$('#d-insp'),vis=d=>d&&!d.hidden&&d.offsetParent&&getComputedStyle(d).display!=='none';const L=vis(dl)&&!PHONE()?dl.getBoundingClientRect().right-m.left+8:null,R=vis(di)&&!PHONE()?m.right-di.getBoundingClientRect().left+8:null;
  if(L!=null||R!=null){sb.style.left=(L!=null?L:12)+'px';sb.style.right=(R!=null?R:12)+'px';sb.style.transform='none';sb.style.maxWidth='none'}else{sb.style.left='';sb.style.right='';sb.style.transform='';sb.style.maxWidth=''}}
window.addEventListener('resize',()=>setTimeout(placeSunBar,60));

/* ================= draw directly in 3D (on the ground plane) ================= */
let d3drag=null,lastW3=null,d3down=null,snapGuide3=[];
function d3Active(){return is3D&&!WALK.on&&!bldView&&DRAW3D.includes(tool)}
function projG(wx,wy){const{THREE,camera}=T3,r=$('#v3c').getBoundingClientRect();const v=new THREE.Vector3(wx*0.001,0,wy*0.001).project(camera);return [(v.x*0.5+0.5)*r.width,(-v.y*0.5+0.5)*r.height]}
function d3Next(w){
  if(!polyPts||!polyPts.length)return (P.snap&&!altDown&&!ctrlDown)?[snapV(w[0]),snapV(w[1])]:[Math.round(w[0]),Math.round(w[1])];
  const l=polyPts[polyPts.length-1];let dx=w[0]-l[0],dy=w[1]-l[1];const free=ctrlDown||altDown;
  if(!free&&Math.hypot(dx,dy)>1){if(shiftDown){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0}
    else if(P.ortho){const tol=Math.tan(2*Math.PI/180);if(Math.abs(dy)/Math.max(1,Math.abs(dx))<tol)dy=0;else if(Math.abs(dx)/Math.max(1,Math.abs(dy))<tol)dx=0}}
  let x=l[0]+dx,y=l[1]+dy;if(P.snap&&!free){x=snapV(x);y=snapV(y)}
  /* alignment guides: line up with (and snap to) the x or y of any earlier point, so a box closes cleanly */
  snapGuide3=[];
  if(!free){const tolW=14/Math.max(1e-4,projScale());let gx=null,gy=null,bx=tolW,by=tolW;
    for(let i=0;i<polyPts.length-1;i++){const q=polyPts[i],ax=Math.abs(x-q[0]),ay=Math.abs(y-q[1]);if(ax<bx){bx=ax;gx=q}if(ay<by){by=ay;gy=q}}
    if(gx){x=gx[0];snapGuide3.push(gx)}if(gy){y=gy[1];if(gy!==gx)snapGuide3.push(gy)}
  }
  const ddx=x-l[0],ddy=y-l[1];if(Math.hypot(ddx,ddy)>1){drawAngle=((Math.atan2(-ddy,ddx)*180/Math.PI)%360+360)%360;drawAngleShow=true}else drawAngleShow=false;
  return [Math.round(x),Math.round(y)];
}
function d3Sync(){const ov=$('#d3ov'),bd=$('#d3-badge'),cvp=$('#v3c');if(!ov)return;
  if(!d3Active()){ov.innerHTML='';if(bd)bd.hidden=true;if(cvp&&!WALK.on&&!bldView)cvp.style.cursor='';d3drag=null;if(T3&&T3.controls&&!WALK.on)T3.controls.enabled=true;return}
  if(cvp)cvp.style.cursor='crosshair';
  if(bd){const names={room:'room',poly:'walls',spline:'curved wall',road:'road',fence:'fence',measure:'dimension',section:'section',['shape-rect']:'rectangle',['shape-round']:'round shape',['shape-L']:'L-shape',['shape-poly']:'polygon'};
    bd.textContent='Drawing '+(names[tool]||tool)+' in 3D — '+(d3ClickPoly(tool)?'click points, Enter/right-click to finish':'drag on the floor')+' · Esc to stop';bd.hidden=false}
  drawD3Overlay();
}
function drawD3Overlay(){const ov=$('#d3ov');if(!ov)return;if(!d3Active()){ov.innerHTML='';return}
  const r=$('#v3c').getBoundingClientRect();ov.setAttribute('viewBox',`0 0 ${Math.max(1,r.width)} ${Math.max(1,r.height)}`);
  let s='';const PP=p=>projG(p[0],p[1]);const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];const dist=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(d3drag){const a=d3drag.a,b=d3drag.b;
    if(d3drag.mode==='measure'){const A=PP(a),B=PP(b);s+=`<line class="d3-dash" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"/>`;const m=mid(A,B);s+=`<text class="d3-lbl" x="${m[0]}" y="${m[1]-8}">${fmt(Math.round(dist(a,b)))} mm</text>`}
    else if(d3drag.mode==='section'){const A=PP(a),B=PP(b);s+=`<line class="d3-dash" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"/>`}
    else{const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
      const c=[PP([x0,y0]),PP([x1,y0]),PP([x1,y1]),PP([x0,y1])];s+=`<path class="d3-wall" d="M${c.map(p=>p[0]+' '+p[1]).join('L')}Z"/>`;
      const mw=mid(c[0],c[1]),mh=mid(c[1],c[2]);s+=`<text class="d3-lbl" x="${mw[0]}" y="${mw[1]-8}">${fmt(Math.round(x1-x0))}</text><text class="d3-lbl" x="${mh[0]+10}" y="${mh[1]}">${fmt(Math.round(y1-y0))}</text>`}}
  if(polyPts&&polyPts.length&&d3ClickPoly(tool)){const nx=lastW3?d3Next(lastW3):polyPts[polyPts.length-1];const all=polyPts.concat([nx]);const pr=all.map(PP);
    snapGuide3.forEach(q=>{const A=PP(q),B=PP(nx);s+=`<line class="d3-guide" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"/><circle class="d3-guidep" cx="${A[0]}" cy="${A[1]}" r="4"/>`});
    const cls=tool==='road'?'d3-road':(tool==='fence'?'d3-fence':'d3-wall');const sw=tool==='road'?Math.max(6,(+P.roadW||6000)*0.001*projScale()):3;
    s+=`<path class="${cls}" ${cls==='d3-wall'?'style="fill:none"':''} stroke-width="${sw}" d="M${pr.map(p=>p[0]+' '+p[1]).join('L')}"/>`;
    pr.forEach((p,i)=>{if(i<polyPts.length)s+=`<circle class="${i===0?'d3-pt0':'d3-pt'}" cx="${p[0]}" cy="${p[1]}" r="${i===0?6:4}"/>`});
    const A=pr[pr.length-2],B=pr[pr.length-1],m=mid(A,B);s+=`<text class="d3-lbl" x="${m[0]}" y="${m[1]-8}">${fmt(Math.round(dist(polyPts[polyPts.length-1],nx)))} mm</text>`;
    if(drawAngleShow&&![0,90,180,270,360].some(x=>Math.abs(drawAngle-x)<0.4))s+=`<text class="d3-ang" x="${m[0]}" y="${m[1]+16}">${drawAngle.toFixed(1)}°</text>`}
  ov.innerHTML=s;
}
function projScale(){const r=$('#v3c').getBoundingClientRect();const a=projG(0,0),b=projG(1000,0);return Math.hypot(b[0]-a[0],b[1]-a[1])/1000}
function d3FinishRect(mode,a,b){const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
  if((x1-x0)<100||(y1-y0)<100)return;
  if(mode==='room'){const n=S.objs.filter(o=>o.t==='room').length+1;addObjs([{id:uid(),t:'room',name:'Room '+n,pts:rectP(x0,y0,x1,y1),gid:null}],true)}
  else{const kind=mode.slice(6);const o={id:uid(),t:'item',code:'CUSTOM',name:kind==='round'?'Custom round':(kind==='L'?'Custom L-shape':'Custom rectangle'),cat:'Custom',shape:kind,w:x1-x0,d:y1-y0,h:750,a:Math.round(Math.min(x1-x0,y1-y0)/2),seats:0,cf:0,cb:0,nests:false,rate:null,pts:null,x:(x0+x1)/2,y:(y0+y1)/2,r:0,gid:null,label:''};addObjs([o],true)}
  clashDirty=true;render();build3D();showTab('sel')}
function sectionBar(){const b=$('#v3-sec');if(!b)return;const on=is3D&&!WALK.on&&!bldView&&S.section&&S.section.a;b.style.display=on?'':'none';$('#v3-secflip').style.display=on&&S.section.on?'':'none';if(on){b.classList.toggle('on',!!S.section.on);b.textContent=S.section.on?'Section on':'Section'}}
/* Roof solar PV against the layout rules of Fire Code Cl. 10.2.1 (roof-mounted). Modules closer than 300 mm count as one array.
   The roof is taken as the rectangle round the top floor, so an L-shaped roof is only approximate at its inner corner. */
let pvMemo=null;
function pvCheck(fresh){ensureBld(S);const b0=S.bld,it0=(roofMode?S.objs:(b0.roofFit||[]));let sig=(roofMode?'r':'f')+it0.length+'|'+num(b0.parapet,0)+'|'+(b0.levels?b0.levels.length:0)+'|'+(b0.cores||[]).length+'|'+(roofMode?roofRefObjs.length:S.objs.length)+'|',h=0;for(let i=0;i<it0.length;i++){const o=it0[i];h=(h*31+o.x*7+o.y*13+(o.r||0)+o.w+o.d*3)%2147483647}sig+=h;
  if(!fresh&&pvMemo&&pvMemo.tab===curTab&&pvMemo.sig===sig)return pvMemo.r;const r=pvCheck0();pvMemo={tab:curTab,sig,r};return r}
function pvCheck0(){ensureBld(S);const b=S.bld,items=(roofMode?S.objs:(b.roofFit||[])).filter(o=>o.t==='item');
  const isPV=o=>o.cat==='Solar PV'||/\bPV\b|solar/i.test(o.name||''),pv=items.filter(isPV);if(!pv.length)return{n:0,arrays:0,rows:[]};
  let R=null;{const real=S.objs;try{S.objs=roofMode?roofRefObjs:bldObjs(topLevel(),real);const pts=[];floorPlate().forEach(q=>pts.push(...q));if(pts.length)R=bboxPts(pts)}catch(e){}finally{S.objs=real}}
  const bx=pv.map(objBox),gap=(a,c)=>{const dx=Math.max(0,a.x0-c.x1,c.x0-a.x1),dy=Math.max(0,a.y0-c.y1,c.y0-a.y1);return{dx,dy,d:Math.hypot(dx,dy)}};
  const par=pv.map((_,i)=>i),find=i=>par[i]===i?i:(par[i]=find(par[i]));for(let i=0;i<pv.length;i++)for(let j=i+1;j<pv.length;j++){const g=gap(bx[i],bx[j]);if(g.dx<=300&&g.dy<=300)par[find(i)]=find(j)}
  const G=new Map();pv.forEach((o,i)=>{const r=find(i);if(!G.has(r))G.set(r,{ids:[],box:null});const a=G.get(r);a.ids.push(o.id);a.box=a.box?{x0:Math.min(a.box.x0,bx[i].x0),y0:Math.min(a.box.y0,bx[i].y0),x1:Math.max(a.box.x1,bx[i].x1),y1:Math.max(a.box.y1,bx[i].y1)}:Object.assign({},bx[i])});
  const A=[...G.values()],m=v=>(v/1000).toFixed(1)+' m',rows=[],bad=(rule,text,ids)=>rows.push({ok:false,rule,text,ids}),nm=i=>A.length>1?`Array ${i+1}`:'The array';
  /* d(1): 60 m x 40 m */
  {let ok=true;A.forEach((a,i)=>{const w=a.box.x1-a.box.x0,d=a.box.y1-a.box.y0;if(Math.max(w,d)>60001||Math.min(w,d)>40001){ok=false;bad('10.2.1d(1)',`${nm(i)} is ${m(w)} × ${m(d)}; the limit is 60 m × 40 m. Split it with an access aisle.`,a.ids)}});if(ok)rows.push({ok:true,rule:'10.2.1d(1)',text:`Every array is within 60 m × 40 m (${A.length} ${A.length===1?'array':'arrays'}).`})}
  /* d(3): 1.5 m aisles between arrays */
  {let ok=true;for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++){const g=gap(A[i].box,A[j].box);if((g.dx===0||g.dy===0)&&g.d<1500){ok=false;bad('10.2.1d(3)',`The gap between arrays ${i+1} and ${j+1} is ${m(g.d)}; an access aisle needs 1.5 m clear.`,A[i].ids.concat(A[j].ids))}}if(ok&&A.length>1)rows.push({ok:true,rule:'10.2.1d(3)',text:'Gaps between arrays are at least 1.5 m.'})}
  /* d(3): no part more than 20 m from an aisle; 2.5 m at an unguarded roof edge */
  {const guard=num(b.parapet,0)>=1000;let ok=true,edgeOk=true;A.forEach((a,i)=>{const B=a.box,side={L:true,R:true,T:true,B:true};
      if(R){const e={L:B.x0-R.x0,R:R.x1-B.x1,T:B.y0-R.y0,B:R.y1-B.y1};Object.keys(e).forEach(k=>{if(e[k]<1500)side[k]=false;else if(e[k]<2500&&!guard){edgeOk=false;bad('10.2.1d(3)',`${nm(i)} leaves ${m(e[k])} at the roof edge. An aisle along an unguarded edge needs 2.5 m; 1.5 m is enough with a parapet or railing (parapet here is ${m(num(b.parapet,0))}).`,a.ids)}})}
      A.forEach((c,j)=>{if(j===i)return;const g=gap(B,c.box);if(g.d>=1500)return;if(g.dy===0){if(c.box.x1<=B.x0)side.L=false;if(c.box.x0>=B.x1)side.R=false}if(g.dx===0){if(c.box.y1<=B.y0)side.T=false;if(c.box.y0>=B.y1)side.B=false}});
      const far=(x,y)=>Math.min(side.L?x-B.x0:1e12,side.R?B.x1-x:1e12,side.T?y-B.y0:1e12,side.B?B.y1-y:1e12);let worst=0;[0,.5,1].forEach(u=>[0,.5,1].forEach(v=>{worst=Math.max(worst,far(B.x0+(B.x1-B.x0)*u,B.y0+(B.y1-B.y0)*v))}));
      if(worst>=1e12){ok=false;bad('10.2.1d(3)',`${nm(i)} has no access aisle on any side.`,a.ids)}else if(worst>20001){ok=false;bad('10.2.1d(3)',`Part of ${nm(i).toLowerCase()} is ${m(worst)} from the nearest access aisle; the limit is 20 m.`,a.ids)}});
    if(ok)rows.push({ok:true,rule:'10.2.1d(3)',text:'No part of any array is more than 20 m from an access aisle.'});if(edgeOk&&R)rows.push({ok:true,rule:'10.2.1d(3)',text:'Aisles along the roof edge are wide enough.'})}
  /* d(2): 3 m round the roof access */
  {const st=(b.cores||[]).filter(c=>c.shape==='stair'&&c.roof!==false);let ok=true;st.forEach(c=>{const cb=objBox(c),near=pv.filter((o,i)=>gap(bx[i],cb).d<3000);if(near.length){ok=false;bad('10.2.1d(2)',`${near.length} ${near.length===1?'module is':'modules are'} within 3 m of the roof access stair "${c.name||'Stair'}".`,near.map(o=>o.id))}});
    if(st.length){if(ok)rows.push({ok:true,rule:'10.2.1d(2)',text:'3 m is clear round every roof access stair.'})}else rows.push({ok:null,rule:'10.2.1d(2)',text:'No stair reaches the roof in this plan, so the 3 m clearance round the roof access could not be checked.'})}
  /* d(5): 500 mm from roof ventilation and skylights */
  {const vt=items.filter(o=>!isPV(o)&&/vent|skylight|smoke|exhaust|extract|air ?well/i.test(o.name||''));let ok=true;vt.forEach(v=>{const vb=objBox(v),near=pv.filter((o,i)=>gap(bx[i],vb).d<500);if(near.length){ok=false;bad('10.2.1d(5)',`${near.length} ${near.length===1?'module is':'modules are'} within 500 mm of "${v.name}".`,near.map(o=>o.id))}});
    if(vt.length&&ok)rows.push({ok:true,rule:'10.2.1d(5)',text:'Modules are at least 500 mm clear of roof vents and skylights.'})}
  return{n:pv.length,arrays:A.length,area:pv.reduce((a,o)=>a+o.w*o.d,0)/1e6,rows,roof:!!R}}
function pvHTML(){let r;try{r=pvCheck()}catch(e){return''}
  let h=`<p class="big">Roof solar PV</p><p class="muted">Layout rules of Fire Code Cl. 10.2.1 for roof-mounted modules.</p>`;
  if(!r.n)return h+`<p class="muted">No PV modules on the roof. In Roof mode, place them from Library › Mechanical › Solar PV, then drag one out into an array.</p>`;
  const fails=r.rows.filter(x=>x.ok===false).length;
  h+=`<div class="firebox"><div class="fire-row"><span>${r.n} modules in ${r.arrays} ${r.arrays===1?'array':'arrays'} · ${r.area.toFixed(0)} m²</span><b class="${fails?'bad':'ok'}">${fails?fails+(fails===1?' issue':' issues')+' ⚠':'layout rules met'}</b></div></div>`;
  r.rows.forEach((x,i)=>{h+=`<div class="pv-row ${x.ok===false?'bad':x.ok?'ok':'na'}"><span class="mk">${x.ok===false?'✗':x.ok?'✓':'?'}</span><span>${esc(x.text)} <span class="muted">${esc(x.rule)}</span>${x.ok===false&&x.ids&&roofMode?` <button class="btn sm ghost" type="button" data-pv="sel" data-i="${i}">Select</button>`:''}</span></div>`});
  return h+`<div class="row" style="margin-top:6px"><button class="btn sm" type="button" data-pv="again">Check again</button></div><p class="muted" style="margin-top:6px">Advisory only. Modules closer than 300 mm count as one array, and the roof is taken as the rectangle round the top floor. Not checked: travel distance on the roof, hatch size, what is stored below the arrays, and the emergency shut-off.</p>`}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-pv]');if(!b)return;if(b.dataset.pv==='again'){pvMemo=null;renderFire();toast('PV layout checked')}else{const r=pvCheck().rows[+b.dataset.i];if(r&&r.ids&&roofMode){sel=new Set(r.ids);render();renderInspector()}}});
/* the Checks tab: every check in one place, each with its state and the way to its detail */
let checksMemo=null;
function checksRun(){syncFloorOut(S);ensureBld(S);const out={};
  /* plan problems, every floor: the same checks the AI is held to */
  try{const r=aiIssues(),k=r.keys||[],n=p=>k.filter(x=>x.startsWith(p)).length;out.plan={ov:n('ov'),out:n('out'),dw:n('dw'),dx:n('dx'),cl:n('cl')}}catch(e){out.plan=null}
  out.n=S.objs.length;checksMemo={tab:curTab,at:Date.now(),r:out};return out}
function checksHTML(){const rooms=S.objs.filter(o=>o.t==='room'),row=(name,st,txt,btn)=>`<div class="pv-row ${st}"><span class="mk">${st==='ok'?'✓':st==='bad'?'✗':'?'}</span><span style="flex:1"><b>${name}</b><br><span class="muted">${txt}</span></span>${btn||''}</div>`,B=(a,t)=>`<button class="btn sm ghost" type="button" data-chk="${a}">${t}</button>`;
  let h=`<p class="big">Checks</p><p class="muted">Every check on this plan in one place. All of them are advisory.</p>`;
  /* 1 travel distance */
  {const res=EG.res&&!EG.res.err?EG.res:null,lim=fireCfg().travel;h+=row('Travel distance to exits',!res?'na':(res.worst>lim||res.unreached?'bad':'ok'),!res?(egressExits().length?'Not run on this floor yet.':'No exits marked yet.'):`Longest ${(res.worst/1000).toFixed(1)} m against ${(lim/1000).toFixed(0)} m${res.unreached?` · ${res.unreached} room${res.unreached>1?'s':''} cannot reach an exit`:''} · this floor`,B('fire','Run'))}
  /* 2 roof PV */
  {let r=null;try{r=pvCheck()}catch(e){}const f=r&&r.n?r.rows.filter(x=>x.ok===false).length:0;h+=row('Roof solar PV · Fire Code Cl. 10.2.1',!r||!r.n?'na':f?'bad':'ok',!r||!r.n?'No PV modules on the roof.':`${r.n} modules in ${r.arrays} ${r.arrays===1?'array':'arrays'} · ${f?f+(f===1?' issue':' issues'):'layout rules met'}`,r&&r.n?B('pv','Details'):'')}
  /* 3 space entitlement */
  {const on=migCfg().on,rs=on?rooms.map(migRoom).filter(Boolean):[],over=rs.filter(x=>x.st==='over').length,under=rs.filter(x=>x.st==='under').length;h+=row('Space entitlement (MIG)',!on||!rs.length?'na':over||under?'bad':'ok',!on?'Switched off.':!rs.length?'No room on this floor has a rank to check.':`${rs.length} room${rs.length>1?'s':''} checked · ${over} over · ${under} under · this floor`,B('mig','Settings'))}
  /* 4 programme */
  {let c=null;try{c=briefCheck()}catch(e){}h+=row('Programme: brief items',!c||!c.n?'na':c.met<c.n?'bad':'ok',!c||!c.n?'No programme or brief on this plan.':`${c.met} of ${c.n} met${c.fails&&c.fails.length?' · short: '+esc(c.fails.slice(0,3).map(f=>f.name||f).join(', '))+(c.fails.length>3?'…':''):''}`,B('prog','Open'))}
  /* 5 plan problems */
  {const m=checksMemo&&checksMemo.tab===curTab&&checksMemo.r.n===S.objs.length?checksMemo.r:null,p=m&&m.plan,tot=p?p.ov+p.out+p.dw+p.dx+p.cl:0,parts=p?[[p.ov,'overlapping rooms'],[p.out,'items outside every room'],[p.dw,'doors not on a wall'],[p.dx,'outside doors above ground'],[p.cl,'furniture clashes']].filter(x=>x[0]).map(x=>x[0]+' '+x[1]):[];
    h+=row('Plan problems · all floors',!p?'na':tot?'bad':'ok',!p?'Not run yet. Checks overlaps, stray furniture, doors and clashes.':tot?parts.join(' · '):'None found.',B('plan',p?'Run again':'Run'))}
  /* 6 security zones */
  {const z=rooms.filter(o=>o.zone).length;h+=row('Security zones (PSM)',!rooms.length||!z?'na':z<rooms.length?'bad':'ok',!rooms.length?'No rooms on this floor.':`${z} of ${rooms.length} rooms have a zone · this floor`,B('secz','Open'))}
  return h+`<div id="chk-pv"></div>`}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-chk]');if(!b)return;const a=b.dataset.chk;
  if(a==='fire'){const r=egressRun();renderFire();const t=document.querySelector('#p-fire [data-sec=travel]');if(t)t.scrollIntoView({block:'start'})}
  else if(a==='pv'){const t=document.querySelector('#p-fire [data-sec=pv]');if(t)t.scrollIntoView({block:'start'})}
  else if(a==='mig'){const m=$('#m-mig');if(m)m.click();else openMig()}
  else if(a==='prog')progOpen();
  else if(a==='plan'){checksRun();renderFire();toast('Plan checked on every floor')}
  else if(a==='secz')showTab('secz',true)});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-back]');if(b)showTab(b.dataset.back,true)});
function renderFire(){const el=$('#p-fire');if(!el)return;if(el.contains(document.activeElement)&&document.activeElement.tagName==='INPUT')return;
  const cfg=fireCfg(),exN=egressExits().length,sel1=selList();const canMark=sel1.length===1&&(isOpening(sel1[0])||isCore(sel1[0]));
  let res=EG.res&&!EG.res.err?EG.res:null;
  let h=checksHTML()+`<p class="big" data-sec="travel" style="margin-top:18px">Travel distance to exits</p>
  <div class="fire-banner"><b>Advisory only.</b> Shows the walking distance from every point to the nearest marked exit (routed through doors, not through walls). The limit below only colours the plan — it is <b>not</b> an SCDF compliance sign-off. Confirm figures with your QP / fire consultant.</div>
  <div class="sec">Exits</div><p class="muted">${exN?`${exN} exit${exN>1?'s':''} marked.`:'No exits marked yet.'} Select a door or an exit stair on the plan, then tick it as a final exit.</p>
  ${canMark?`<div class="row"><button class="btn sm" type="button" data-fire="markexit">${sel1[0].exit?'Unmark':'Mark'} “${esc(sel1[0].name||'selected')}” as exit</button></div>`:'<p class="muted">Tip: the “Final exit (egress)” tick also appears in the Selection tab when a door or stair is selected.</p>'}
  <div class="sec">Highlight over (mm)</div>
  <div class="fld"><label>Max travel distance<input type="number" data-fire-lim="travel" value="${cfg.travel}" step="1000" min="1000"></label><span></span></div>
  <div class="row"><button class="btn sm primary" type="button" data-fire="run">Show distances</button>${res?`<button class="btn sm" type="button" data-fire="toggle">${EG.on?'Hide overlay':'Show overlay'}</button>`:''}</div>`;
  if(EG.res&&EG.res.err)h+=`<p class="muted" style="color:var(--danger);margin-top:8px">${esc(EG.res.err)}</p>`;
  if(res){const okTravel=res.worst<=cfg.travel&&!res.unreached;
    h+=`<div class="firebox"><div class="fire-row"><span>Longest travel distance</span><b class="${okTravel?'ok':'bad'}">${(res.worst/1000).toFixed(1)} m${res.worst>cfg.travel?' ⚠':''}</b></div>${res.unreached?`<div class="fire-row"><span>Rooms with no route</span><b class="bad">${res.unreached} ⚠</b></div>`:''}</div>`;
    const sorted=res.rooms.slice().sort((a,b)=>(b.reach?b.mx:1e18)-(a.reach?a.mx:1e18));
    h+=`<div class="sec">Distance to nearest exit, by room</div>`;
    sorted.forEach(r=>{h+=`<div class="fire-row"><span>${esc(r.name)}</span><b class="${r.reach?(r.fail?'bad':'ok'):'bad'}">${r.reach?(r.mx/1000).toFixed(1)+' m'+(r.fail?' ⚠':''):'no route'}</b></div>`});
    h+=`<div class="eg-legend"><span><i style="background:#1f9d55"></i>near exit</span><span><i style="background:#f5b301"></i>at limit</span><span><i style="background:#e5484d"></i>over limit</span><span><i style="background:#9678aa"></i>no route</span></div>
    <p class="muted" style="margin-top:8px">The overlay colours each point by its walking distance to the nearest exit. Each room label on the plan shows its longest distance.</p>`;}
  h+=`<div data-sec="pv" style="margin-top:18px">${pvHTML()}</div>`;
  el.innerHTML=h;
}
$('#p-fire').addEventListener('input',e=>{const lm=e.target.dataset.fireLim;if(lm){S.fire=Object.assign({},fireCfg(),{[lm]:Math.max(1,num(e.target.value,FIRE_DEF[lm]))});markDirty();if(EG.on)egressRun(true)}});
$('#p-fire').addEventListener('click',e=>{const b=e.target.closest('[data-fire]');if(!b)return;const a=b.dataset.fire;
  if(a==='run'){const r=egressRun();if(!r.err)showTab('fire');renderFire()}
  else if(a==='toggle'){EG.on=!EG.on;render();renderFire()}
  else if(a==='markexit'){const o=selList()[0];if(o){checkpoint();o.exit=!o.exit;markDirty();render();renderInspector();if(EG.on)egressRun(true);renderFire()}}});

/* ================= underlay ================= */
const uimg=$('#under-img');
function syncUnder(){const u=S.underlay;if(u&&u.src){uimg.setAttribute('href',u.src)}else{uimg.removeAttribute('href')}updateUnderImg();if(!$('#p-und').hidden)renderUnderPanel()}
function updateUnderImg(){
  const u=S.underlay;if(!u||!u.src||u.visible===false||!LY('under')){uimg.style.display='none';return}
  uimg.style.display='';uimg.setAttribute('x',u.x);uimg.setAttribute('y',u.y);uimg.setAttribute('width',u.w*u.mpp);uimg.setAttribute('height',u.h*u.mpp);uimg.setAttribute('opacity',u.op==null?0.6:u.op);if(u.rot)uimg.setAttribute('transform',`rotate(${u.rot} ${u.x+u.w*u.mpp/2} ${u.y+u.h*u.mpp/2})`);else uimg.removeAttribute('transform');
  const th=document.documentElement.dataset.theme;const dark=th==='dark'||(th!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);
  uimg.style.filter=(P.inv&&dark)?'invert(1) hue-rotate(180deg)':'';
}
let pdfDoc=null,pdfName='';
function pdfLib(){
  const lib=window.pdfjsLib||window['pdfjs-dist/build/pdf'];if(!lib)throw new Error('PDF reader did not load.');
  if(!lib.GlobalWorkerOptions.workerSrc){if(VEND.pdfWorker)lib.GlobalWorkerOptions.workerSrc=VEND.pdfWorker;else{const src=$('#pdfjs-worker-src').textContent;lib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([src],{type:'text/javascript'}))}}
  return lib;
}
async function loadUnderFile(file){
  try{
    if(/pdf$/i.test(file.type)||/\.pdf$/i.test(file.name)){
      toast('Reading PDF…');await ensurePdf();const buf=await file.arrayBuffer();pdfDoc=await pdfLib().getDocument({data:buf}).promise;pdfName=file.name;
      await renderPdfPage(1);
    }else if(/^image\/(png|jpe?g|pjpeg|gif|bmp|webp|svg\+xml)$/i.test(file.type)||/\.(png|jpe?g|jfif|jpe|gif|bmp|webp|svg)$/i.test(file.name||'')){
      toast('Reading image…');
      let src=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
      if(/^data:application\/octet-stream/.test(src))src=src.replace(/^data:application\/octet-stream/,'data:image/'+((file.name||'').match(/\.(\w+)$/)||[0,'png'])[1].toLowerCase().replace('jpg','jpeg').replace('jfif','jpeg'));
      let img=await loadImg(src);let w=img.naturalWidth,h=img.naturalHeight;
      if(!w||!h)throw new Error('the image has no size');
      /* very large scans: keep up to 8000 px on the long side so the plan file stays a sensible size */
      if(Math.max(w,h)>8000){const f=8000/Math.max(w,h);const cv=document.createElement('canvas');cv.width=Math.round(w*f);cv.height=Math.round(h*f);const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(img,0,0,cv.width,cv.height);src=cv.toDataURL('image/jpeg',0.9);w=cv.width;h=cv.height}
      pdfDoc=null;setUnder(src,w,h,file.name||'Pasted image',0,0);
    }else if(/\.(heic|heif|tiff?|dwg|dxf)$/i.test(file.name||''))toast('That format cannot be read here. Save or export it as PDF, PNG or JPEG first.');
    else toast('Pick a PDF, PNG or JPEG file.');
  }catch(e){console.error(e);toast('Could not read that file: '+(e.message||e))}
}
const loadImg=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('image failed'));i.src=src});
async function renderPdfPage(n){
  if(!pdfDoc)return;n=Math.max(1,Math.min(pdfDoc.numPages,n|0));
  const page=await pdfDoc.getPage(n);const v1=page.getViewport({scale:1});
  const sc=Math.min(4,4800/Math.max(v1.width,v1.height));const vp=page.getViewport({scale:sc});
  const cv=document.createElement('canvas');cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);
  await page.render({canvasContext:cx,viewport:vp}).promise;
  const src=cv.toDataURL('image/jpeg',0.88);
  // PDF points: 1 pt = 1/72 in. Default scale assumes 1:100 at the drawn size, calibrate to confirm.
  const mpp=(25.4/72)/sc*100;
  setUnder(src,cv.width,cv.height,pdfName+' · page '+n,n,mpp,sc);
}
function setUnder(src,w,h,name,page,mpp,sc){
  checkpoint();
  const prev=S.underlay;const id=uid();underCache[id]=src;
  S.underlay={uid:id,src,w,h,name,page:page||0,sc:sc||0,mpp:mpp||(30000/w),x:prev?prev.x:0,y:prev?prev.y:0,op:prev?prev.op:0.6,visible:true,calibrated:false};
  if(prev&&prev.calibrated&&prev.sc&&sc){S.underlay.mpp=prev.mpp*prev.sc/sc;S.underlay.calibrated=true}
  syncUnder();showTab('und');fit();toast(S.underlay.calibrated?'Underlay loaded at the same scale.':'Floor plan loaded. Next: set its scale, then detect walls.');
}

/* styles for the Campus map, the template dialog and the PV rows live here, not in the page head, to keep the first-load page inside its size budget */
(()=>{const st=document.createElement('style');st.textContent=`.sulab{font-weight:500;pointer-events:none}#su-outliner .ol-row{display:flex;gap:8px;width:100%;text-align:left;border:0;background:none;color:var(--fg);padding:6px 8px;border-radius:6px;cursor:pointer;font:inherit}#su-outliner .ol-row:hover{background:rgba(0,0,0,.06)}#su-outliner .ol-row .muted{margin-left:auto}.su-fade{opacity:.22;pointer-events:none}#su-scenes{position:absolute;left:50%;transform:translateX(-50%);top:8px;z-index:8;display:flex;gap:4px;align-items:center;max-width:60%;overflow-x:auto;scrollbar-width:none;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:3px}#su-scenes[hidden]{display:none}#su-scenes .sc{display:flex;align-items:center;border-radius:6px}#su-scenes .sc.on{background:var(--accent-soft,rgba(0,0,0,.08))}#su-scenes button{border:0;background:none;color:var(--fg);font:inherit;font-size:12px;padding:4px 8px;cursor:pointer;white-space:nowrap;border-radius:6px}#su-scenes button:hover{background:rgba(0,0,0,.06)}#su-scenes .x{padding:4px 5px;color:var(--muted)}#su-scenes .add{font-weight:500;padding:4px 9px}.suguide{stroke:#7a8794;stroke-dasharray:8 6;stroke-width:1px;vector-effect:non-scaling-stroke;pointer-events:none}#su-chip{position:absolute;right:12px;bottom:56px;z-index:12;display:flex;align-items:center;gap:6px;background:var(--panel);border:1px solid var(--accent);border-radius:8px;padding:4px 6px;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.18)}#su-chip[hidden]{display:none}#su-chip input{width:72px;font:inherit;padding:3px 6px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}#rot-chip{position:absolute;z-index:12;display:flex;align-items:center;gap:6px;background:var(--panel);border:1px solid var(--accent);border-radius:8px;padding:4px 6px;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.18)}#rot-chip[hidden]{display:none}#rot-chip input{width:64px;font:inherit;padding:3px 6px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}@media (pointer:coarse){#rot-chip input{font-size:16px;width:72px}}.roth{cursor:grab;pointer-events:all}.roth circle{fill:var(--panel);stroke:var(--accent);stroke-width:2px;vector-effect:non-scaling-stroke}.roth path{stroke:var(--accent);stroke-width:1.6px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.roth .hit{fill:transparent!important;stroke:none!important}.roth:hover circle:not(.hit){fill:var(--accent)}.roth:hover path{stroke:#fff}.rotl{stroke:var(--accent);stroke-dasharray:3 3;stroke-width:1px;vector-effect:non-scaling-stroke;pointer-events:none}.rotc{fill:var(--accent);pointer-events:none}.v3bar::-webkit-scrollbar{display:none}.v3bar>*{flex:none}@media (min-width:821px){#main:has(.drawer.left:not([hidden])) .v3bar{--bl:calc(max(12px,env(safe-area-inset-left,0px)) + 262px);left:var(--bl);max-width:calc(100% - var(--bl,12px) - var(--br,12px))}#main:has(.drawer.right:not([hidden])) .v3bar{--br:calc(max(12px,env(safe-area-inset-right,0px)) + 292px);right:var(--br);max-width:calc(100% - var(--bl,12px) - var(--br,12px))}}@media (min-width:1101px){#main:has(.drawer.left:not([hidden])) .v3bar{--bl:calc(max(12px,env(safe-area-inset-left,0px)) + 302px)}#main:has(.drawer.right:not([hidden])) .v3bar{--br:calc(max(12px,env(safe-area-inset-right,0px)) + 322px)}}@media (max-width:820px),(pointer:coarse) and (max-height:500px){#main .v3bar{width:auto;max-width:none;margin:0}}.pname input:focus-visible{outline:2px solid var(--accent);outline-offset:1px}.tabs [hidden]{display:none!important}@media (min-width:821px){#d-insp .tabs{padding:6px 4px}#d-insp .tabs button{padding:6px 2px}}.camp-map{display:block;width:100%;height:320px;border:1px solid var(--line);border-radius:8px;background:var(--bg);touch-action:pan-y;user-select:none;-webkit-user-select:none}.camp-map [data-cb]{touch-action:none}.camp-map:focus-visible{outline:2px solid var(--accent);outline-offset:1px}.camp-map g[data-cb]{cursor:grab}.camp-map g[data-cb] polygon{fill:var(--panel);stroke:var(--ink)}.camp-map g.sel polygon{stroke:var(--accent);fill:color-mix(in srgb,var(--accent) 14%,var(--panel))}.camp-map g.over polygon{stroke:#c0392b;stroke-dasharray:4 3}.camp-map text{fill:var(--ink);pointer-events:none;font-family:inherit}.camp-map text.sub{fill:var(--muted)}.camp-map .lk{fill:var(--accent);opacity:.55}.camp-map .bar line{stroke:var(--muted)}.camp-map .bar text{fill:var(--muted)}.pv-row{display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px solid var(--line);font-size:13px;line-height:1.4}.pv-row .mk{flex:none;width:16px;font-weight:700}.pv-row.ok .mk{color:#1f9d55}.pv-row.bad .mk{color:var(--danger)}.pv-row.na .mk{color:var(--muted)}.tpl-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}@media (max-width:700px){.tpl-grid{grid-template-columns:minmax(0,1fr)}}.tpl-prev{max-width:100%;height:auto;display:block}.tpl-prev .rm{fill:var(--bg);stroke:var(--ink);stroke-width:2}.tpl-prev .rk{fill:var(--accent);opacity:.75;stroke:var(--panel);stroke-width:.5}.tpl-prev .cu{fill:#2a9d8f;opacity:.8}`;document.head.appendChild(st)})();
/* ================= room templates =================
   A room template is a room that knows its contents. Sized templates (TPL) are generated from inputs and can be regenerated
   when the inputs change; saved templates (UTPL) are a room and its items stored as drawn. The room carries `tpl:{code,p}`
   and every item made for it carries `tp:<room id>`, so an update can replace exactly what the template put there. */
const TPL={DH:{code:'DH',name:'Data hall',disc:'IT',sub:'sized from racks and kW',what:'data hall',fields:[
  {k:'n',l:'Number of racks',d:20,min:1,max:2000,int:1},{k:'row',l:'Most racks in a row',d:10,min:1,max:60,int:1},
  {k:'rw',l:'Rack width (mm)',d:600,min:300,max:1200},{k:'rd',l:'Rack depth (mm)',d:1000,min:600,max:1500},
  {k:'ru',l:'Rack height (U)',d:42,min:6,max:60,int:1},{k:'kw',l:'Load per rack (kW)',d:5,min:0,max:100,step:.5},
  {k:'aisle',l:'Clear width around each row (mm)',d:1200,min:1200,max:5000,note:'policy minimum 1,200'},
  {k:'cr',l:'Cooling needed per kW of IT load (kW)',d:1,min:.5,max:3,step:.05,note:'1 kW of servers needs 1 kW of cooling unless you change it'},
  {k:'mode',l:'Where the cooling units stand',d:'wall',opts:[['wall','Along the end walls'],['row','In the rows, between racks']]},
  {k:'ckw',l:'Capacity of one cooling unit (kW)',d:50,min:5,max:200,note:'bigger units are fewer'},{k:'cred',l:'Spare cooling units',d:1,min:0,max:10,int:1}],
  build:dhBuild}};
let UTPL=[];try{const u=JSON.parse(store.get('osk-rtpl')||'[]');if(Array.isArray(u))UTPL=u.filter(t=>t&&t.code&&Array.isArray(t.pts)&&Array.isArray(t.items))}catch(e){UTPL=[]}
const tplAll=()=>Object.values(TPL).concat(UTPL),tplGet=c=>TPL[c]||UTPL.find(t=>t.code===c);
/* saved room templates live in this browser only, so they can be written to a file and read back on another machine */
const tplOk=t=>t&&typeof t==='object'&&typeof t.code==='string'&&typeof t.name==='string'&&Array.isArray(t.pts)&&t.pts.length>=3&&t.pts.every(isPair)&&Array.isArray(t.items)&&t.items.length<=DH_MAX;
function tplExport(){if(!UTPL.length)return toast('No saved room templates yet. Select a room and use Save this room and its contents as a template');download('StoreyBook room templates.json',JSON.stringify({app:'storeybook-room-templates',v:1,saved:new Date().toISOString(),templates:UTPL},null,1),'application/json');toast(`${UTPL.length} room template${UTPL.length===1?'':'s'} saved to a file`)}
function tplImportText(text,fname){let o;try{o=JSON.parse(text)}catch(e){return toast(`Could not read ${fname||'the file'}: it is not valid JSON`)}
  if(!o||o.app!=='storeybook-room-templates'||!Array.isArray(o.templates))return toast(`${fname||'The file'} is not a room templates file. Export one from the command search: Room templates: save mine to a file`);
  let add=0,rep=0,bad=0;o.templates.forEach(t=>{if(!tplOk(t)){bad++;return}const n=clone(t),seen=new Set(),bb=bboxPts(n.pts);n.items=n.items.map(i=>normObj(Object.assign({},i,{t:'item'}),seen)).filter(i=>i&&i!=='unknown').map(i=>{delete i.id;delete i.tp;return i});n.name=String(n.name).slice(0,60);n.user=true;n.disc=DISC.includes(n.disc)?n.disc:'Architecture';n.w=Math.round(bb.x1-bb.x0);n.h=Math.round(bb.y1-bb.y0);const i=UTPL.findIndex(x=>x.code===n.code);if(i>=0){UTPL[i]=n;rep++}else{UTPL.push(n);add++}});
  if(add||rep){store.set('osk-rtpl',JSON.stringify(UTPL));renderLib()}toast(add||rep?`Room templates: ${add} added${rep?', '+rep+' replaced':''}${bad?', '+bad+' damaged and skipped':''}`:'No usable room templates in that file')}
function tplImport(){const f=document.createElement('input');f.type='file';f.accept='.json,application/json';f.onchange=()=>{const x=f.files[0];if(x)x.text().then(t=>tplImportText(t,x.name)).catch(()=>toast('Could not read that file'))};f.click()}
/* Data hall sizing. Racks stand side by side in rows; the clear width applies in front of, behind and at both ends of every row.
   Rows face each other in pairs (cold aisle, then hot aisle). Cooling load is taken as the IT load; units stand along the end
   walls, facing down the aisles. Room clear size:
     width = [cooling strip or clear width] + racks per row x rack width + [cooling strip or clear width]
     depth = rows x rack depth + (rows + 1) x clear width   (more if the cooling units need the wall length) */
/* footprint of a wall-standing cooling unit by capacity (placeholder sizes until the mechanical team gives theirs) */
const DH_CU=[[35,900],[60,1700],[110,2550],[1e9,3100]],DH_MAX=3000;
function dhBuild(q){const p={};TPL.DH.fields.forEach(f=>{if(f.opts){const v=q&&q[f.k];p[f.k]=f.opts.some(o=>o[0]===v)?v:f.d;return}let v=Math.min(f.max,Math.max(f.min,num(q&&q[f.k],f.d)));p[f.k]=f.int?Math.round(v):v});
  const R=Math.ceil(p.n/p.row),per=Math.ceil(p.n/R),kw=p.n*p.kw,need=kw*p.cr,cool=need>0?Math.ceil(need/p.ckw-1e-9)+p.cred:0,rowsH=R*p.rd+(R-1)*p.aisle,items=[],notes=[];
  if(p.n+cool>DH_MAX)return{p,name:'Data hall',iw:0,ih:0,items:[],tooBig:true,sum:[['IT load',`${kw.toFixed(0)} kW`],['Cooling needed',`${need.toFixed(0)} kW`],['Cooling units',`${cool.toLocaleString()} × ${p.ckw} kW`]],notes:[`That is ${(p.n+cool).toLocaleString()} racks and cooling units in one room; the limit is ${DH_MAX.toLocaleString()}. Use bigger cooling units, or split the load across several halls.`]};
  const lr=LIB.find(l=>l.shape==='rack'&&l.w===p.rw&&l.d===p.rd&&/server/i.test(l.name)),half=Math.min(600,p.aisle/2);
  const rack={code:lr?lr.code:`RK${Math.round(p.rw/100)}${Math.round(p.rd/100)}`,name:`Server rack ${p.ru}U ${p.rw} x ${p.rd}`,cat:'IT',shape:'rack',w:p.rw,d:p.rd,h:Math.round(p.ru*44.45+133),a:0,seats:0,cf:half,cb:half,nests:false,rate:lr?lr.rate:null};
  let iw,ih,cuTxt='';
  if(p.mode==='row'){/* in-row coolers stand in the rows between racks, so the rows get longer and the walls stay clear */
    const ir=LIB.find(l=>l.code==='IRC3012')||{code:'IRC3012',name:'In-row cooler 300 x 1200',cat:'IT',shape:'rack',w:300,d:1200,h:2000,a:0,seats:0,cf:300,cb:300,nests:false,rate:null};
    const cu=Object.assign({},ir,{name:`In-row cooler ${p.ckw} kW ${ir.w} x ${ir.d}`,cf:half,cb:half}),dep=Math.max(p.rd,cu.d),rowsH2=R*dep+(R-1)*p.aisle;ih=rowsH2+2*p.aisle;
    const perRow=Array.from({length:R},(_,j)=>Math.floor(cool/R)+(j<cool%R?1:0));let left_=p.n,maxLen=0;const rows=[];
    for(let j=0;j<R;j++){const c=Math.min(per,left_);left_-=c;const k=perRow[j],seq=[];/* spread the coolers evenly among the racks */
      for(let i=0;i<c;i++)seq.push(0);for(let u=0;u<k;u++)seq.splice(Math.min(seq.length,Math.round((u+.5)*(c+k)/Math.max(1,k))),0,1);
      rows.push(seq);maxLen=Math.max(maxLen,seq.reduce((a,v)=>a+(v?cu.w:p.rw),0))}
    iw=maxLen+2*p.aisle;rows.forEach((seq,j)=>{let x=p.aisle;const cy=p.aisle+j*(dep+p.aisle)+dep/2;seq.forEach(v=>{const l=v?cu:rack;items.push({l,x:x+l.w/2,y:cy,r:j%2?180:0});x+=l.w})});
    cuTxt=`${cool} in-row × ${p.ckw} kW (${cool-p.cred} duty + ${p.cred} spare)`;notes.push('In-row coolers stand between the racks, so rows are longer and no wall space is used.')}
  else{const cw=DH_CU.find(a=>p.ckw<=a[0])[1],lib=cw===1700&&LIB.find(l=>l.code==='PAC1790'),cu=lib||{code:'PAC'+Math.round(cw/100)+'90',name:`Precision air-con unit ${cw} x 900`,cat:'IT',shape:'rect',w:cw,d:900,h:1950,a:0,seats:0,cf:1000,cb:0,nests:false,rate:null};
    const cl=Math.max(p.aisle,+cu.cf||0),pitch=cu.w+300,fit=h=>Math.max(0,Math.floor((h-300)/pitch));ih=rowsH+2*p.aisle;const ih0=ih;
    let left=Math.min(Math.ceil(cool/2),fit(ih)),right=Math.min(cool-left,fit(ih));if(left+right<cool){left=Math.ceil(cool/2);right=cool-left;ih=left*pitch+300}
    const lx=left?cu.d+cl:p.aisle,rx=right?cu.d+cl:p.aisle,rowLen=per*p.rw,y0=(ih-rowsH)/2;iw=lx+rowLen+rx;
    let left_=p.n;for(let j=0;j<R;j++){const c=Math.min(per,left_);left_-=c;for(let i=0;i<c;i++)items.push({l:rack,x:lx+i*p.rw+p.rw/2,y:y0+j*(p.rd+p.aisle)+p.rd/2,r:j%2?180:0})}
    for(let k=0;k<left;k++)items.push({l:cu,x:cu.d/2,y:ih*(k+1)/(left+1),r:270});for(let k=0;k<right;k++)items.push({l:cu,x:iw-cu.d/2,y:ih*(k+1)/(right+1),r:90});
    cuTxt=cool?`${cool} × ${p.ckw} kW, each ${(cw/1000).toFixed(2).replace(/0$/,'')} × 0.9 m (${cool-p.cred} duty + ${p.cred} spare)`:'none (no load given)';
    notes.push('Cooling units stand along the two end walls and blow down the aisles.');if(ih>ih0)notes.push(`The room is ${((ih-ih0)/1000).toFixed(1)} m deeper than the racks need, to fit the cooling units along the walls. Larger units or in-row cooling would shrink it.`);
    if(p.kw>8)notes.push('Above roughly 8 kW per rack, cooling from the end walls struggles to reach the middle of a row; in-row cooling is the usual choice.')}
  const area=iw*ih/1e6;notes.push('UPS, batteries and switchgear are not in this room; size them as their own rooms.');
  return{p,name:'Data hall',iw,ih,items,door:{x:Math.min(iw-1200,Math.max(1200,p.aisle+900))},
    sum:[['Layout',`${R} ${R===1?'row':'rows'} of up to ${per} racks`],['Clear room size',`${(iw/1000).toFixed(1)} × ${(ih/1000).toFixed(1)} m`],['Floor area',`${area.toFixed(1)} m² (${(area/p.n).toFixed(1)} m² per rack)`],['IT load',`${kw.toFixed(0)} kW`],['Cooling needed',`${need.toFixed(0)} kW (${p.cr} kW per kW of IT load)`],['Cooling units',cuTxt||'none (no load given)']],notes}}
/* build the objects for a template with its room's outer top-left corner at (x0,y0) */
/* copies made by paste or array: a copied room takes its copied contents with it; contents copied without their room stop belonging to it */
function tpFix(pairs){const m=new Map();pairs.forEach(([o,n])=>{if(o.t==='room')m.set(o.id,n.id)});pairs.forEach(([o,n])=>{if(n.tp){if(m.has(n.tp))n.tp=m.get(n.tp);else delete n.tp}})}
function tplMake(t,q,x0,y0,roomId){const id=roomId||uid(),wt=P.wall;
  if(t.user){const room={id,t:'room',name:t.name,pts:t.pts.map(a=>[Math.round(a[0]+x0),Math.round(a[1]+y0)]),gid:null,tpl:{code:t.code}};
    const gm=new Map();const objs=t.items.map(o=>{const c=clone(o);c.id=uid();c.x=Math.round(c.x+x0);c.y=Math.round(c.y+y0);if(c.gid){if(!gm.has(c.gid))gm.set(c.gid,uid());c.gid=gm.get(c.gid)}c.tp=id;return c});return{room,objs,B:null}}
  const B=t.build(q),X=x0+wt/2,Y=y0+wt/2,objs=[];
  const room={id,t:'room',name:B.name,pts:rectP(Math.round(x0),Math.round(y0),Math.round(x0+B.iw+wt),Math.round(y0+B.ih+wt)),gid:null,tpl:{code:t.code,p:B.p}};
  B.items.forEach(it=>placeObjs(it.l,Math.round(X+it.x),Math.round(Y+it.y),it.r).forEach(o=>{o.tp=id;objs.push(o)}));
  const dr=LIB.find(l=>l.code==='DR1800')||LIB.find(l=>l.shape==='door');if(dr&&B.door)placeObjs(dr,Math.round(X+B.door.x),Math.round(y0+B.ih+wt),0).forEach(o=>{o.tp=id;objs.push(o)});
  return{room,objs,B}}
function tplPlace(code,q){const t=tplGet(code);if(!t)return null;if(roofMode){toast('Leave Roof mode to place a room');return null}
  const ub=S.objs.length?unionBox(S.objs.filter(visible)):null,x0=ub?Math.ceil((ub.x1+3000)/100)*100:0,y0=ub?Math.floor(ub.y0/100)*100:0;
  if(t.build&&t.build(q).tooBig){toast('Too many racks and cooling units for one room');return null}
  const m=tplMake(t,q,x0,y0);addObjs([m.room].concat(m.objs),true);fitBox(unionBox(S.objs.filter(visible)));render();
  toast(`${t.name} placed to the right of the plan. It is selected: drag it where you want it.`);return m.room}
function tplUpdate(room,q){const t=room&&room.tpl&&TPL[room.tpl.code];if(!t)return false;const b=bboxPts(room.pts);
  if(!(room.pts.length===4&&room.pts.every(a=>(Math.abs(a[0]-b.x0)<1||Math.abs(a[0]-b.x1)<1)&&(Math.abs(a[1]-b.y0)<1||Math.abs(a[1]-b.y1)<1)))){toast('This room has been reshaped or turned, so it cannot be regenerated. Place a new one.');return false}
  if(t.build(q).tooBig){toast('Too many racks and cooling units for one room');return false}
  checkpoint();const m=tplMake(t,q,b.x0,b.y0,room.id);S.objs=S.objs.filter(o=>o.tp!==room.id);room.pts=m.room.pts;room.tpl=m.room.tpl;m.objs.forEach(o=>S.objs.push(o));
  clashDirty=true;sel=new Set([room.id]);markDirty();render();renderInspector();toast(`${t.name} updated: ${(m.B.iw/1000).toFixed(1)} × ${(m.B.ih/1000).toFixed(1)} m`);return true}
/* save a drawn room and what stands in it as a template in this browser */
function tplSave(room,name,disc){name=String(name||room.name||'Room').trim().slice(0,60)||'Room';disc=DISC.includes(disc)?disc:'Architecture';const b=bboxPts(room.pts),w=P.wall;
  const inside=o=>o.t==='item'&&(o.tp===room.id||pointInPoly(o.x,o.y,room.pts)||(isOpening(o)&&o.x>b.x0-w&&o.x<b.x1+w&&o.y>b.y0-w&&o.y<b.y1+w));
  const items=S.objs.filter(inside).map(o=>{const c=clone(o);delete c.id;delete c.tp;c.x=Math.round(c.x-b.x0);c.y=Math.round(c.y-b.y0);return c});
  const t={code:'RT'+Date.now().toString(36).toUpperCase(),name,disc,user:true,w:Math.round(b.x1-b.x0),h:Math.round(b.y1-b.y0),pts:room.pts.map(a=>[Math.round(a[0]-b.x0),Math.round(a[1]-b.y0)]),items};
  UTPL.push(t);store.set('osk-rtpl',JSON.stringify(UTPL));renderLib();toast(`Saved "${name}" under ${disc} › Room templates (${items.length} items)`);return t}
function tplRoomHTML(o){const t=o.tpl&&TPL[o.tpl.code];
  return`<div class="sec">Room template</div>${t?`<p class="muted" style="margin:2px 0 6px">Made from the ${esc(t.name)} template${o.tpl.p&&o.tpl.p.n?` · ${o.tpl.p.n} racks`:''}.</p><div class="row"><button class="btn sm primary" type="button" data-act="tpledit">Change ${esc(t.what||'template')} inputs…</button></div>`:''}
  <div class="fld" style="margin-top:6px"><label class="full">Save this room and its contents as a template<input id="rt-name" value="${esc(o.name)}" maxlength="60" aria-label="Template name"></label><label>Discipline<select id="rt-disc">${DISC.filter(d=>d!=='Custom').map(d=>`<option${d===(t?t.disc:'Architecture')?' selected':''}>${esc(d)}</option>`).join('')}</select></label><span style="align-self:end"><button class="btn sm" type="button" data-act="tplsave">Save template</button></span></div>`}
/* the set-up dialog: inputs on the left, the worked-out room on the right, live */
const TPLD={code:null,room:null};
function tplOpen(code,room){const t=tplGet(code);if(!t)return;closePops();$('#tpl-modal').dataset.keep='1';TPLD.code=code;TPLD.room=room||null;const el=$('#tpl-body');$('#tpl-title').textContent=t.name;$('#tpl-sub').textContent=t.user?'saved room template':t.sub||'';
  if(t.user){el.innerHTML=`<p class="muted">${fmt(t.w)} × ${fmt(t.h)} mm · ${t.items.length} ${t.items.length===1?'item':'items'} · ${esc(t.disc)}. Saved in this browser.</p><div class="row" style="margin-top:10px"><button class="btn primary" type="button" data-tp="go">Place room</button><button class="btn ghost" type="button" data-tp="del">Delete template</button></div>`}
  else{const p0=room&&room.tpl&&room.tpl.p||{};
    el.innerHTML=`<div class="tpl-grid"><div><div class="fld">${t.fields.map(f=>{const v=p0[f.k]!=null?p0[f.k]:f.d;return`<label>${esc(f.l)}${f.opts?`<select data-tf="${f.k}">${f.opts.map(o=>`<option value="${o[0]}"${o[0]===v?' selected':''}>${esc(o[1])}</option>`).join('')}</select>`:`<input type="number" data-tf="${f.k}" value="${v}" min="${f.min}" max="${f.max}" step="${f.step||(f.int?1:50)}">`}${f.note?`<small class="muted" style="display:block;font-size:11px">${esc(f.note)}</small>`:''}</label>`}).join('')}</div></div><div><div id="tpl-sum"></div></div></div>
    <div class="row" style="margin-top:12px"><button class="btn primary" type="button" data-tp="go">${room?'Update room':'Place room'}</button><span class="muted" id="tpl-msg"></span></div>`;tplSum()}
  $('#tpl-modal').hidden=false;const f=el.querySelector('input,button');if(f)f.focus()}
const tplVals=()=>{const q={};document.querySelectorAll('#tpl-body [data-tf]').forEach(i=>{q[i.dataset.tf]=i.value});return q};
function tplSum(){const t=tplGet(TPLD.code),el=$('#tpl-sum');if(!t||!t.build||!el)return;const B=t.build(tplVals()),q=tplVals(),go=document.querySelector('#tpl-body [data-tp=go]');if(go)go.disabled=!!B.tooBig;
  if(B.tooBig){el.innerHTML=`<dl class="kv">${B.sum.map(r=>`<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl><p style="color:var(--danger);margin-top:8px">${esc(B.notes[0])}</p>`;return}
  const sc=Math.min(300/B.iw,190/B.ih),W=B.iw*sc,H=B.ih*sc,fixed=t.fields.filter(f=>!f.opts&&String(B.p[f.k])!==String(num(q[f.k],NaN))).map(f=>f.l);
  el.innerHTML=`<svg class="tpl-prev" viewBox="-6 -6 ${W+12} ${H+12}" width="${W+12}" height="${H+12}" aria-hidden="true"><rect x="0" y="0" width="${W}" height="${H}" class="rm"/>${B.items.map(it=>{const w=it.l.w*sc,d=it.l.d*sc,v=it.r===90||it.r===270;return`<rect class="${/cooler|air-con/i.test(it.l.name)?'cu':'rk'}" x="${it.x*sc-(v?d:w)/2}" y="${it.y*sc-(v?w:d)/2}" width="${v?d:w}" height="${v?w:d}"/>`}).join('')}</svg>
  <dl class="kv" style="margin-top:8px">${B.sum.map(r=>`<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl>${fixed.length?`<p class="muted" style="color:var(--danger)">Out of range, so the limit is used: ${esc(fixed.join(', '))}.</p>`:''}<p class="muted" style="margin-top:6px">${B.notes.map(esc).join(' ')}</p>`}
(()=>{const m=$('#tpl-modal');if(!m)return;m.addEventListener('input',e=>{if(e.target.dataset.tf)tplSum()});m.addEventListener('change',e=>{if(e.target.dataset.tf)tplSum()});
  m.addEventListener('click',e=>{const b=e.target.closest('[data-tp]');if(!b)return;const a=b.dataset.tp;
    if(a==='close')m.hidden=true;
    else if(a==='del'){const tt=tplGet(TPLD.code);if(!confirm(`Delete the room template "${tt?tt.name:''}"?\n\nThis cannot be undone. Rooms already placed from it stay on the plan.`))return;UTPL=UTPL.filter(t=>t.code!==TPLD.code);store.set('osk-rtpl',JSON.stringify(UTPL));m.hidden=true;renderLib();toast('Template deleted')}
    else if(a==='go'){const room=TPLD.room&&S.objs.includes(TPLD.room)?TPLD.room:null,q=tplVals();m.hidden=true;if(room)tplUpdate(room,q);else tplPlace(TPLD.code,q)}})})();

/* ================= library panel ================= */
let libCat='All',libQ='',placeLib=null;
function libIcon(l){
  if(l.shape==='set'){const s=28/Math.max(l.w,l.d);let h='';
    l.comps.forEach(c=>{const li=LIB.find(z=>z.code===c.code&&z.shape!=='set');if(!li)return;const o=Object.assign({},li,{x:0,y:0,r:0});h+=`<g class="it ${catCls(li.cat)}" transform="translate(${c.x} ${c.y}) rotate(${c.r||0})">${shapeSVG(o)}</g>`});
    return `<svg viewBox="-17 -17 34 34" aria-hidden="true"><g transform="scale(${s})">${h}</g></svg>`}
  const door=/^door/.test(l.shape);const m=Math.max(l.w,l.d),s=(door?14:26)/m;const o=Object.assign({},l,{x:0,y:0,r:0});
  return `<svg viewBox="-17 -17 34 34" aria-hidden="true"><g class="it ${catCls(l.cat)}" transform="translate(0 ${door?-7:0}) scale(${s})">${shapeSVG(o)}</g></svg>`;
}
/* the library is a tree: discipline, then group, then item. An item's discipline comes from its own `discipline` column if it has one, else from its category (ceiling items are split by what they are). The category itself is untouched, because it drives behaviour (ceiling plan, cores, site). */
const DISC=['Architecture','C&S','Mechanical','Electrical','IT','Site','Custom'];
const CEIL_AT={cctv:['Electrical','Security'],cctvb:['Electrical','Security'],fan:['Mechanical','ACMV'],fcu:['Mechanical','ACMV'],fcuw:['Mechanical','ACMV'],grille:['Mechanical','ACMV'],grillr:['Mechanical','ACMV'],spr:['Mechanical','Fire protection'],det:['Electrical','Fire alarm'],panel:['Electrical','Lighting'],linear:['Electrical','Lighting'],dl:['Electrical','Lighting'],pend:['Electrical','Lighting'],pir:['Electrical','Lighting'],spk:['Electrical','Public address'],wap:['IT','Network'],acp:['Architecture','Acoustic ceiling'],baffle:['Architecture','Acoustic ceiling']};
const CAT_GRP={IT:'Racks and cooling',Site:'Site works',Core:'Stairs, lifts and shafts'};
const CAT_DISC={Column:'C&S',IT:'IT',Site:'Site',Custom:'Custom','Solar PV':'Mechanical'};
function libAt(l){if(l.disc)return[l.disc,l.cat];if(l.cat==='Ceiling'&&CEIL_AT[l.shape])return CEIL_AT[l.shape];return[CAT_DISC[l.cat]||'Architecture',CAT_GRP[l.cat]||l.cat]}
const libHay=l=>{const a=libAt(l);return(l.name+' '+l.code+' '+l.cat+' '+a[1]+' '+a[0]).toLowerCase()};
const libShut=new Set();let libFirst=true;
function renderLib(){
  if(libFirst){libFirst=false;if(P.libDisc)libCat=P.libDisc}
  const at=LIB.map(libAt),T=tplAll(),rank=d=>{const i=DISC.indexOf(d);return i<0?DISC.length:i};
  const ds=[...new Set(at.map(a=>a[0]).concat(T.map(t=>t.disc)))].sort((a,b)=>rank(a)-rank(b));
  if(libCat!=='All'&&!ds.includes(libCat))libCat='All';
  $('#lib-cats').innerHTML=['All'].concat(ds).map(c=>`<button type="button" class="chip${c===libCat?' on':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  const q=libQ.toLowerCase();let html='';
  ds.forEach(d=>{if(libCat!=='All'&&d!==libCat)return;const groups=new Map();
    LIB.forEach((l,i)=>{if(at[i][0]!==d)return;if(q&&!libHay(l).includes(q))return;const g=at[i][1];if(!groups.has(g))groups.set(g,[]);groups.get(g).push(i)});
    const tp=T.filter(t=>t.disc===d&&(!q||(t.name+' room template '+d).toLowerCase().includes(q)));
    if(!groups.size&&!tp.length)return;let n=tp.length;groups.forEach(ix=>n+=ix.length);
    const dk='d:'+d,dShut=!q&&libShut.has(dk);
    html+=`<button type="button" class="lib-disc" data-lk="${esc(dk)}" aria-expanded="${!dShut}"><span class="tw">${dShut?'▸':'▾'}</span>${esc(d)}<span class="n">${n}</span></button>`;if(dShut)return;
    groups.forEach((ix,g)=>{const k='g:'+d+'/'+g,shut=!q&&libShut.has(k);
      html+=`<button type="button" class="lib-cat" data-lk="${esc(k)}" aria-expanded="${!shut}"><span class="tw">${shut?'▸':'▾'}</span>${esc(g)}<span class="n">${ix.length}</span></button>`;if(shut)return;
      ix.forEach(i=>{const l=LIB[i];const sub=l.shape==='set'?`${l.comps.length} items · ${fmt(l.w)} × ${fmt(l.d)} · ${esc(l.code)}${l.missing?' · missing items':''}`:`${fmt(l.w)} × ${fmt(l.d)} · ${esc(l.code)}`;
        html+=`<button type="button" class="lib-row${placeLib===l?' on':''}" draggable="true" data-li="${i}" title="Click, then click on the plan to place. Or drag onto the plan.">${libIcon(l)}<span><span class="nm">${esc(l.name)}</span><br><span class="sz">${sub}</span></span></button>`})});
    if(tp.length){const k='g:'+d+'/Room templates',shut=!q&&libShut.has(k);
      html+=`<button type="button" class="lib-cat" data-lk="${esc(k)}" aria-expanded="${!shut}"><span class="tw">${shut?'▸':'▾'}</span>Room templates<span class="n">${tp.length}</span></button>`;
      if(!shut)tp.forEach(t=>{html+=`<button type="button" class="lib-tpl" data-tpl="${esc(t.code)}" title="A whole room with its contents. Click to set it up and place it."><svg viewBox="-17 -17 34 34" aria-hidden="true"><rect x="-13" y="-10" width="26" height="20" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="-9" y="-6" width="5" height="12" fill="currentColor" opacity=".45"/><rect x="-2" y="-6" width="5" height="12" fill="currentColor" opacity=".45"/><rect x="5" y="-6" width="5" height="12" fill="currentColor" opacity=".45"/></svg><span><span class="nm">${esc(t.name)}</span><br><span class="sz">${esc(t.user?`${fmt(t.w)} × ${fmt(t.h)} · ${t.items.length} items · saved`:t.sub||'room template')}</span></span></button>`})}});
  $('#lib-list').innerHTML=html||'<p class="muted">Nothing in the library matches that search.</p>';
}
$('#lib-q').addEventListener('input',e=>{libQ=e.target.value;renderLib()});
$('#lib-cats').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(b){libCat=b.dataset.cat;P.libDisc=libCat==='All'?'':libCat;savePrefs();renderLib()}});
$('#lib-list').addEventListener('click',e=>{const hk=e.target.closest('[data-lk]');if(hk){const k=hk.dataset.lk;if(libShut.has(k))libShut.delete(k);else libShut.add(k);renderLib();const n=[...document.querySelectorAll('#lib-list [data-lk]')].find(x=>x.dataset.lk===k);if(n)n.focus({preventScroll:true});return}const tb=e.target.closest('[data-tpl]');if(tb){tplOpen(tb.dataset.tpl);return}const b=e.target.closest('[data-li]');if(!b)return;const l=LIB[+b.dataset.li];if(placeLib===l){setTool('select');return}if(!!P.rcp!==(l.cat==='Ceiling'))setRCP(l.cat==='Ceiling',true);placeLib=l;placeRot=0;placeFlip=false;setTool('place');renderLib();if(PHONE()&&P.lib){P.lib=false;savePrefs();applyDrawers()}});
$('#lib-list').addEventListener('dragstart',e=>{const b=e.target.closest('[data-li]');if(!b)return;e.dataTransfer.setData('text/osk-lib',b.dataset.li);e.dataTransfer.effectAllowed='copy'});
$('#lib-imp').addEventListener('click',()=>$('#f-lib').click());
$('#f-lib').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(f)importLib(await f.text(),f.name)});
function importLib(text,name){try{LIB=libFromCSV(text);if(LIB.some(l=>l.missing))toast('Some sets list items that are not in this CSV');saveLib();libCat='All';renderLib();toast(`Loaded ${LIB.length} items from ${name}`)}catch(err){toast(err.message)}}
$('#lib-exp').addEventListener('click',async()=>{const r=await saveText('furniture-library.csv',libToCSV(LIB),'text/csv','.csv','CSV file');if(r)toast('Library exported')});
$('#lib-reset').addEventListener('click',()=>{{const def=new Set(defLib().map(l=>l.code)),mine=LIB.filter(l=>!def.has(l.code)).length;if(mine&&!confirm(`Reset the library to the built-in list?\n\n${mine} item${mine>1?'s':''} you added or imported will be removed. This cannot be undone. Export CSV first if you want to keep them.`))return}LIB=libFromCSV(DEFAULT_LIB_CSV);store.del('osk-lib');renderLib();toast('Library reset to the built-in list')});

/* ================= object creation ================= */
function itemFromLib(l,x,y,r){return{id:uid(),t:'item',arms:l.shape==='chair'?hasArms(l):undefined,code:l.code,name:l.name,cat:l.cat,shape:l.shape,w:l.w,d:l.d,h:l.h,a:l.a,seats:l.seats,cf:l.cf,cb:l.cb,nests:!!l.nests,rate:l.rate,pts:l.pts?clone(l.pts):null,x,y,r:r||0,gid:null,label:'',sill:l.shape==='window'?(+l.a||0):undefined,drop:l.cat==='Ceiling'?(+l.a||0):undefined,from:l.cat==='Core'?null:undefined,to:l.cat==='Core'?null:undefined,roof:l.cat==='Core'?l.shape==='stair':undefined,cov:l.cat==='Ceiling'?0:undefined,tilt:/^cctv/.test(l.shape)?20:undefined,fov:/^cctv/.test(l.shape)?90:undefined,range:/^cctv/.test(l.shape)?15000:undefined}}
function snapV(v){return P.snap?Math.round(v/P.snapSize)*P.snapSize:Math.round(v)}
/* a library entry becomes one item, or a grouped set of items */
function placeObjs(l,x,y,r){
  if(l.shape!=='set')return[itemFromLib(l,x,y,r)];
  const g=uid();const out=[];
  l.comps.forEach(c=>{const li=LIB.find(z=>z.code===c.code&&z.shape!=='set');if(!li)return;const p=rotPt(c.x,c.y,0,0,r||0);const o=itemFromLib(li,Math.round(x+p[0]),Math.round(y+p[1]),(((c.r||0)+(r||0))%360+360)%360);o.gid=g;o.setCat=l.cat;o.setName=l.name;out.push(o)});
  return out;
}
/* where the next placement lands: grid first, then flush to wall faces and item edges */
function ghostAt(w,alt){
  if(placeLib&&(placeLib.shape==='window'||placeLib.shape==='fcuw')&&!alt&&!altDown){const o=itemFromLib(placeLib,0,0,0);if(seatWindow(o,w,Math.max(700,fs(24))))return{objs:[o],g:''}}
  const objs=placeObjs(placeLib,snapV(w[0]),snapV(w[1]),placeRot);if(placeFlip)objs.forEach(o=>{if(o.shape==='door')o.flip=true});
  if(!P.osnap||alt||altDown)return{objs,g:''};
  const r=objSnap(objs.map(o=>[o.id,o]),0,0);
  if(r[0]||r[1])objs.forEach(o=>{o.x=Math.round(o.x+r[0]);o.y=Math.round(o.y+r[1])});
  return{objs,g:r[2]};
}
/* drag-to-array: copies at the item's own pitch (its footprint, plus the clearance in front of a single item), filling the dragged box */
/* pitch of a dragged row or grid: the footprint plus each item's clearance zone, and a 1.2 m circulation band in front of any workstation (so rows of desks never touch the chairs of the row before) */
const WS_ROW_GAP=1200;
function arrPitch(gh){const pts=[];gh.objs.forEach(o=>{const b=objBox(o);pts.push([b.x0,b.y0],[b.x1,b.y1]);if(o.t!=='item')return;zoneLocal(o).forEach(p=>toW(o,p).forEach(q=>pts.push(q)));
    if(/workstation/i.test(o.cat||'')&&o.shape!=='round')toW(o,rectP(-o.w/2,-o.d/2,o.w/2,o.d/2+WS_ROW_GAP)).forEach(q=>pts.push(q))});
  const bb=bboxPts(pts);return[Math.max(100,bb.x1-bb.x0),Math.max(100,bb.y1-bb.y0)]}
function arrCopies(d){const[pw,pd]=arrPitch(d.gh),dx=d.b[0]-d.a[0],dy=d.b[1]-d.a[1];let nx=1+Math.floor(Math.abs(dx)/pw+0.15),ny=1+Math.floor(Math.abs(dy)/pd+0.15);
  if(nx*ny>400){const f=Math.sqrt(400/(nx*ny));nx=Math.max(1,Math.floor(nx*f));ny=Math.max(1,Math.floor(ny*f))}
  const sx=dx<0?-1:1,sy=dy<0?-1:1,out=[];
  /* a single item dragged out becomes an array you can edit later in Details (rows, columns, gaps) */
  const items=d.gh.objs.every(o=>o.t==='item')&&nx*ny>1,one=items&&d.gh.objs.length===1,o0=d.gh.objs[0];
  let arr=null,bb=null;
  if(one)arr={id:uid(),rows:ny,cols:nx,gx:pw-o0.w,gy:pd-o0.d,w:o0.w,d:o0.d,ox:Math.round(o0.x+(sx<0?-(nx-1)*pw:0)),oy:Math.round(o0.y+(sy<0?-(ny-1)*pd:0)),r:o0.r||0};
  /* a set (desk + chair + pedestal) becomes a set array: every member remembers its cell and its offset from the cell's corner */
  else if(items){bb=bboxPts(d.gh.objs.flatMap(o=>{const b=objBox(o);return[[b.x0,b.y0],[b.x1,b.y1]]}));const w=bb.x1-bb.x0,dd=bb.y1-bb.y0;
    arr={id:uid(),rows:ny,cols:nx,gx:pw-w,gy:pd-dd,w,d:dd,ox:Math.round(bb.x0+(sx<0?-(nx-1)*pw:0)),oy:Math.round(bb.y0+(sy<0?-(ny-1)*pd:0)),r:0,set:d.gh.objs.length}}
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const gm={};out.push(d.gh.objs.map(o=>{const c=clone(o);c.id=uid();if(o.gid){gm[o.gid]=gm[o.gid]||uid();c.gid=gm[o.gid]}c.x=Math.round(o.x+sx*i*pw);c.y=Math.round(o.y+sy*j*pd);
    if(arr){c.arr=Object.assign({},arr);if(bb){c.arr.cell=[sy<0?ny-1-j:j,sx<0?nx-1-i:i];c.arr.off=[Math.round(o.x-bb.x0),Math.round(o.y-bb.y0)]}}return c}))}
  return out}
function addObjs(list,select){checkpoint();list.forEach(o=>S.objs.push(o));clashDirty=true;if(select){sel=new Set(list.map(o=>o.id))}render();renderInspector()}

/* ================= selection helpers ================= */
function groupOf(o){return o.gid?S.objs.filter(x=>x.gid===o.gid):[o]}
function selList(){return[...sel].map(byId).filter(Boolean)}
function setSel(ids){if(multiMode)setTimeout(multiSync,0);sel=new Set(ids);render();renderInspector()}

/* ================= tools & pointer ================= */
let bldView=false,tool='select',shapeKind='rect',placeRot=0,placeFlip=false,spaceDown=false,lastDown=null;
let drag=null; // current interaction
let lpTimer=null,lpFired=false; // long-press (touch/pen) opens the context menu
/* touch devices: fingers pan and pinch; a pen (Apple Pencil, S Pen) draws and selects. Until a pen is seen, a finger also draws, except that a finger on empty canvas in Select pans. */
const TOUCH=matchMedia('(pointer:coarse)').matches;let PEN_SEEN=false;let multiMode=false;const addMod=ev=>!!(ev.shiftKey||ev.ctrlKey||ev.metaKey||multiMode);
function setMulti(on){multiMode=!!on;const b=$('#multibar');if(b){b.hidden=!multiMode;multiSync()}if(!multiMode)render()}
function multiSync(){const b=$('#multibar');if(b&&!b.hidden)b.querySelector('b').textContent=sel.size+' selected'}if(TOUCH)document.documentElement.classList.add('touch');
document.addEventListener('pointerdown',e=>{if(e.pointerType==='pen'&&!PEN_SEEN){PEN_SEEN=true;document.documentElement.classList.add('pen');toast('Pen draws and selects · fingers pan and zoom')}},true);
document.addEventListener('click',e=>{if(!(e.target instanceof Element))return;const i=e.target.closest('.info');if(i&&i.title)toast(i.title)});
let polyPts=null,typed='',lastW=[0,0],calib=null,underMove=false,guideSVG='',detBox=false,altDown=false,walkPick=false,hoverWalk=null;
let addPtFor=null,shiftDown=false,ctrlDown=false,secSel=false,pinSel=null,drawAngle=0,drawAngleShow=false;
/* roads and fences draw straight or curved; C switches while drawing */
const siteCurve=()=>(tool==='road'&&!!P.roadCurve)||(tool==='fence'&&!!P.fenceCurve);
const polyTool=()=>tool==='poly'||tool==='spline'||tool==='road'||tool==='fence'||tool==='trunk';
const DRAW2D=['su-arc','su-erase','su-zwin','su-offset','su-scale','su-tape','su-circle','su-polygon','su-rrect','room','poly','spline','road','fence','trunk','measure','text','addpt','section','pin','shape','shape-rect','shape-round','shape-L','shape-poly'];
/* tools usable directly in the 3D view (draw on the ground plane). Others still drop to 2D. */
const DRAW3D=['room','poly','spline','road','fence','trunk','measure','text','addpt','section','pin','shape-rect','shape-round','shape-L','shape-poly'];
const d3ClickPoly=t=>['poly','spline','road','fence','trunk','shape-poly'].includes(t);
/* tools that act on a single tap of the floor in 3D */
const d3TapTool=t=>t==='text'||t==='pin';
const d3RectTool=t=>['room','shape-rect','shape-round','shape-L'].includes(t);
function setTool(t){detBox=false;if(typeof SU!=='undefined'&&SU&&t!==tool)suCancelAll();
  if(is3D&&DRAW2D.includes(t)&&!DRAW3D.includes(t))set3D(false);
  if(t!=='place'){placeLib=null;$$('.lib-row.on').forEach(b=>b.classList.remove('on'));if(typeof ghost3D==='function')ghost3D(null)}
  if(t!=='poly'&&t!=='spline'&&t!=='road'&&t!=='fence'&&t!=='trunk'&&t!=='shape-poly')polyPts=null;
  if(t!=='addpt')addPtFor=null;
  typed='';tool=t;drag=null;
  $$('.dock [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t||(t.startsWith('shape')&&b.dataset.tool==='shape')));
  svg.style.cursor=t==='pan'?'grab':(t==='select'?'default':'crosshair');
  $('#pop-shape').hidden=true;if(t==='paint'){if(PHONE())paintStrip();else showTab('sel',true)}updateHint();render();mbarSync();
  if(typeof d3Sync==='function')d3Sync();
}
function setRCP(on,quiet){P.rcp=!!on;savePrefs();sel=new Set([...sel].filter(id=>{const o=byId(id);return o&&pickable(o)}));const b=$('#t-rcp');if(b)b.classList.toggle('on',P.rcp);
  render();renderInspector();updateHint();if(!quiet)toast(P.rcp?'Ceiling plan: furniture faded, ceiling items can be picked':'Floor plan: ceiling items shown faintly')}
function applyPaint(o,col,wallMode){if(!o)return false;if(o.t==='wall'){o.col=col;return true}if(o.t==='room'){if(wallMode)o.wallCol=col;else o.floorCol=col;return true}if(o.t==='item'){o.col=col;if(o.faces)delete o.faces;return true}return false}
function paintColorOf(o,wallMode){if(!o)return null;if(o.t==='wall')return o.col||(o.site?(o.site==='road'?'#8a9097':'#3f6a4a'):planWallCol());if(o.t==='room')return wallMode?(o.wallCol||planWallCol()):(o.floorCol||planFloorCol());if(o.t==='item')return o.col||cssColor('--c-'+(CATS[o.cat]||'custom'));return null}
function polyBar(){const b=$('#polybar');if(!b)return;const on=!!(polyPts&&polyPts.length)&&(polyTool()||tool==='shape-poly');b.hidden=!on;if(on){const n=polyPts.length;b.querySelector('b').textContent=n+(n===1?' point':' points');const i=b.querySelector('input');if(document.activeElement!==i)i.value=typed}}
$('#polybar')&&$('#polybar').addEventListener('click',e=>{const a=e.target.closest('[data-pb]');if(!a||!polyPts)return;const k=a.dataset.pb;const inp=$('#polybar input');
  if(k==='undo'){if(typed)typed='';else polyPts.pop();if(!polyPts.length)polyPts=null;updateHint();drawOverlay();if(is3D)drawD3Overlay();return}
  if(k==='add'){typed=String(inp.value||'').trim();const p=typedPoint();if(p){polyPts.push(p);typed='';inp.value='';updateHint();drawOverlay();if(is3D)drawD3Overlay()}else toast('Type a length in mm first, then tap Add');return}
  if(k==='done'){finishPoly(!polyTool());if(is3D)drawD3Overlay();return}
  if(k==='cancel'){cancelPoly();return}});
/* drop the points of a line still being drawn; nothing is added */
function cancelPoly(){polyPts=null;typed='';updateHint();drawOverlay();render();if(is3D)drawD3Overlay();if(typeof polyBar==='function')polyBar();escSync()}
$('#polybar')&&$('#polybar').addEventListener('input',e=>{if(e.target.tagName==='INPUT'){typed=e.target.value.replace(/[^0-9.]/g,'');drawOverlay();if(is3D)drawD3Overlay()}});
$('#polybar')&&$('#polybar').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#polybar [data-pb=add]').click()}});
function updateHint(){polyBar();escSync();if(rotChip&&!rotChip.hidden&&!rotTypedOK())rotChipHide();if(typeof SU!=='undefined'&&SU)vcbSync();
  const h=$('#hint');let t='';
  if(tool==='paint'){h.innerHTML=`<b>Paint</b><span style="display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid var(--line);vertical-align:-1px;background:${P.paintCol||'#d9c7a7'}"></span> Click a wall, floor, door or item · Shift-click a room for its walls · Alt-click to pick a colour · 2D and 3D`;h.hidden=false;return}
  if(typeof SU!=='undefined'&&SU&&suHint())t=suHint();else if(rotTyped&&rotLast)t=`<b>Rotate</b>Angle ${esc(rotTyped)}° · Enter to apply · Esc to cancel`;else if(rotLast&&tool==='select'&&!calib&&rotTypedOK())t=`<b>Rotate</b>Turned ${+rotLast.deg.toFixed(1)}° · type an exact angle and press Enter`;else
  if(calib)t=calib.length===0?'<b>Calibrate</b>Click the first point of a known dimension':(calib.length===1?'<b>Calibrate</b>Click the second point':'<b>Calibrate</b>Enter the real length in the Underlay panel');
  else if(underMove)t='<b>Move underlay</b>Drag the floor plan into position, then press Done';
  else if(tool==='place'&&placeLib)t=`<b>${esc(placeLib.name)}</b>Click to place one · press and drag to fill a row or grid · snaps flush to walls and furniture (Alt places freely) · R rotates · Esc to stop`;
  else if(walkPick)t='<b>Walk · step 1</b>Click where you want to stand · drag to face a direction · Esc cancels';
  else if(detBox)t='<b>Detect walls</b>Drag a box around the floor plan · '+(PHONE()?'Whole sheet button for all of it':'Enter for the whole sheet')+' · Esc cancels';
  else if(tool==='room')t='<b>Room</b>Drag rectangles, one after another · corners snap to walls · Esc to stop';
  else if(tool==='spline'){const n=polyPts?polyPts.length:0;t=n===0?'<b>Curve</b>Click where the curved wall starts · Esc to stop':'<b>Curve</b>Click points the wall curves through · Enter, double-click or right-click ends it · click the first point to close a loop (a room follows the curve)'}
  else if(tool==='trunk'){const n=polyPts?polyPts.length:0;t=`<b>Ceiling trunking</b>`+(n===0?`Click where the run starts · ${(+P.trunkW||150)}×${(+P.trunkH||100)} mm (change in Details) · shown on the Ceiling layer`:'Click the next point · type a length and Enter · Enter, double-click or right-click to end');}
  else if(tool==='road'||tool==='fence'){const n=polyPts?polyPts.length:0,R=tool==='road';t=`<b>${R?'Road':'Fence'} · ${siteCurve()?'curved':'straight'}</b>`+(n===0?`Click where the ${R?'road':'fence'} starts · ${R?'width '+fmt(+P.roadW||6000)+' mm':'height '+fmt(+P.fenceH||2400)+' mm'} (change it in Details after)`:'Click the next point · type a length and Enter · Enter, double-click or right-click to end'+(R?'':' · click the first point to close the boundary'))+` · <kbd>C</kbd> ${siteCurve()?'straight':'curved'}${siteCurve()?'':' · Shift squares up'}`}
  else if(tool==='addpt'){t='<b>Add point</b>Click on the line or outline to add a point there · Esc to stop'}
  else if(tool==='poly'){const n=polyPts?polyPts.length:0;t=n===0?'<b>Walls</b>Click where the wall starts · Esc to stop':(`<b>Walls</b>${typed?('Length '+esc(typed)+' mm · Enter to place'):'Click the next corner, or type a length'} · Enter or double-click ends the wall · click the first point to close a room`)}
  else if(tool==='shape-poly'){const n=polyPts?polyPts.length:0;t=n===0?'<b>Step 1</b>Click the first corner':(`<b>Step 2</b>${typed?('Length '+esc(typed)+' mm · Enter to place'):'Click the next corner, or type a length'} · click the first point or press Enter to close`)}
  else if(tool==='shape-rect'||tool==='shape-round'||tool==='shape-L')t='<b>Shape</b>Drag to draw. Set exact size after.';
  else if(tool==='measure')t='<b>Measure</b>Drag between two points';
  else if(tool==='section')t='<b>Section</b>Drag a line across the plan — the 3D view is sliced along it';
  else if(tool==='pin')t='<b>Pin</b>Click to drop a review comment, then type it in the Notes tab';
  else if(tool==='text')t='<b>Text</b>Click where the label goes';
  if(!is3D&&P.rcp&&tool==='select'&&!calib&&!underMove)t='<b>Ceiling plan</b>Furniture is faded · click lights, services and cameras · drag a camera\'s dot to aim it · '+(typeof SU!=='undefined'&&SU&&suOn()?'search Ceiling to go':'C')+' back to the floor plan';
  if(is3D&&WALK.on)t='';else if(is3D&&!bldView&&typeof SU!=='undefined'&&SU&&['su-push','su-move','su-rotate'].includes(tool)&&suHint())t=suHint();else if(is3D&&tool==='place'&&placeLib)t=`<b>${esc(placeLib.name)}</b>Click the floor to place · R rotates · Esc to stop`;else if(is3D&&bldView)t='<b>Building</b>Click a floor to open it · drag to orbit · middle or right-drag to pan · PageUp / PageDown change floor · Tab back to 2D';else if(is3D)t=typeof SU!=='undefined'&&SU&&suOn()?'<b>3D view</b>Drag furniture to move it · drag the floor or middle-drag to orbit · right-drag to pan · M move · Q rotate · P push/pull · K library · Tab back to 2D':'<b>3D view</b>Drag furniture to move it · drag the floor to orbit · middle or right-drag to pan · R rotates · Q adds furniture · Tab back to 2D';
  h.innerHTML=t;h.hidden=!t;
}
function pointerWorld(ev){const w=toWorld(ev);lastW=w;$('#coords').textContent=`${fmt(w[0])}, ${fmt(w[1])} mm`;return w}
const pointers=new Map();let pinch=null,selBeforeTouch=null,lpMenuPid=null,lastDownAt=0,ctxOpenedAt=0;
/* a menu item only runs for a press that started after the menu opened: the finger that long-pressed it open lifting over an item does nothing */
document.addEventListener('pointerdown',()=>{lastDownAt=performance.now()},true);
/* a finger lifted over a panel or menu still ends its touch: otherwise the next single tap reads as a pinch */
['pointerup','pointercancel'].forEach(t=>document.addEventListener(t,ev=>{
  if(!svg.contains(ev.target)){lpFired=false;if(pointers.has(ev.pointerId)){pointers.delete(ev.pointerId);if(pointers.size<2)pinch=null}}},true));
svg.addEventListener('pointerdown',ev=>{
  if(axesPick){axesPick=false;ev.preventDefault();const r=axesFromPoint(toWorld(ev),18/V.k);if(!r)toast('No wall or room edge there. Search for Design axes to try again');else if(!r.turn)toast('That edge is already level or upright');else turnPlan(r.turn);return}
  {const now=performance.now();pointers.forEach((p,id)=>{if(id!==ev.pointerId&&now-(p[2]||0)>3000)pointers.delete(id)})}/* a pointer that went quiet without an up is a ghost; drop it so one finger is never mistaken for a pinch */
  pointers.set(ev.pointerId,[ev.clientX,ev.clientY,performance.now()]);if(pointers.size===1)selBeforeTouch=ev.pointerType!=='mouse'?new Set(sel):null;
  /* a second finger while an object is being dragged is the touch Shift: it locks the move to one axis until it lifts; two fingers with nothing being dragged pan and zoom */
  if(pointers.size===2&&drag&&drag.m==='move'&&drag.moved&&ev.pointerType!=='mouse'){drag.axisHold=true;drag.holdId=ev.pointerId;if(!drag.holdToast){drag.holdToast=true;toast('Axis locked · lift the second finger to free')}return}
  /* a pinch or two-finger pan is a view gesture: whatever the first finger selected on the way down is put back */
  /* a press that became a two-finger gesture never counts as the first tap of a double-tap */
  if(pointers.size>=2&&lastDown)lastDown.multi=true;
  if(pointers.size===2&&selBeforeTouch&&ev.pointerType!=='mouse'&&!(drag&&drag.moved)){sel=new Set(selBeforeTouch);selBeforeTouch=null;renderInspector()}
  if(pointers.size===2){clearTimeout(lpTimer);svg.style.cursor=tool==='pan'?'grab':(tool==='select'?'default':'crosshair');const p=[...pointers.values()];pinch={d:Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]),k:V.k,mx:(p[0][0]+p[1][0])/2,my:(p[0][1]+p[1][1])/2};drag=null;guideSVG='';if(polyPts===null)render();return}
  closePops();
  const w=pointerWorld(ev);
  if(ev.button===2){ev.preventDefault();if(polyTool()&&polyPts&&polyPts.length>=2){finishPoly(false);return}if(tool==='place'||polyPts||tool==='room')setTool('select');return}
  if(ev.button===1||spaceDown||tool==='pan'){if(spaceDown&&SU)SU.spaceUsed=true;drag={m:'pan',sx:ev.clientX,sy:ev.clientY,vx:V.x,vy:V.y};svg.setPointerCapture(ev.pointerId);svg.style.cursor='grabbing';return}
  if(ev.pointerType!=='mouse'&&tool==='select'&&!WALK.on&&!polyPts&&!calib&&!detBox&&!walkPick){clearTimeout(lpTimer);const sx=ev.clientX,sy=ev.clientY,pid=ev.pointerId,tgt=ev.target;
    lpTimer=setTimeout(()=>{if(!pointers.has(pid))return;const p=pointers.get(pid);if(Math.hypot(p[0]-sx,p[1]-sy)>10)return;drag=null;try{svg.releasePointerCapture(pid)}catch(e){}pointers.delete(pid);lpFired=true;lpMenuPid=pid;if(navigator.vibrate)navigator.vibrate(8);showCtx({clientX:sx,clientY:sy,target:tgt,preventDefault(){}})},480)}
  if(ev.pointerType==='touch'&&!polyPts&&!walkPick&&!calib&&!detBox&&!underMove){const onObj=ev.target.closest('[data-id],[data-vh],[data-bh],[data-aim],[data-pin],[data-roth]');
    const onSec=!is3D&&S.section&&S.section.a&&(()=>{const w=toWorld(ev);return segDist(w[0],w[1],S.section.a,S.section.b)<fs(12)})();
    if(!onSec&&(PEN_SEEN||(tool==='select'&&!onObj))){drag={m:'pan',sx:ev.clientX,sy:ev.clientY,vx:V.x,vy:V.y};svg.setPointerCapture(ev.pointerId);return}}
  if(ev.button!==0)return;
  /* double-click to rename a room. Detected here because the first click redraws the plan, so the browser often never fires dblclick */
  {const now=performance.now(),dbl=lastDown&&!lastDown.multi&&now-lastDown.t<500&&Math.hypot(ev.clientX-lastDown.x,ev.clientY-lastDown.y)<8;lastDown={t:now,x:ev.clientX,y:ev.clientY};
    if(dbl&&tool==='select'){const bh=ev.target.closest('[data-bh]');const o=selList()[0];if(bh&&o&&o.t==='wall'){lastDown=null;checkpoint();o.bulge[+bh.dataset.bh]=0;markDirty();render();renderInspector();return}}
    if(dbl&&tool==='select'&&!S.locked&&!ev.target.closest('[data-vh],[data-bh],[data-aim]')){const el=ev.target.closest('[data-id]'),w=toWorld(ev);let o=el&&byId(el.dataset.id);/* the edge of a room that follows its wall belongs to that wall */if(o&&o.t==='room'&&o.link&&polyProj(o.pts.concat([o.pts[0]]),w).d<fs(14))o=byId(o.link)||o;
      if(o&&(o.t==='wall'||(o.t==='room'&&!o.link&&polyProj(o.pts.concat([o.pts[0]]),w).d<fs(8)))&&insertCorner(o,w)){lastDown=null;drag=null;ev.preventDefault();return}}
    if(dbl&&tool==='select'&&ev.target.closest('[data-pin]')){lastDown=null;drag=null;clearTimeout(lpTimer);pointers.delete(ev.pointerId);ev.preventDefault();openPin(ev.target.closest('[data-pin]').dataset.pin);return}
    if(dbl&&!polyPts&&!calib&&!detBox&&!walkPick&&(tool==='select'||tool==='room')){const hit=dblTarget(ev);if(hit){lastDown=null;drag=null;ev.preventDefault();
      if(typeof SU!=='undefined'&&SU&&suOn()&&hit.gid&&SU.gctx!==hit.gid&&tool==='select'){suGroupEnter(hit.gid);return}
      if(hit.t==='room')renameRoom(hit);else if(hit.t==='item')renameItem(hit);else{setSel([hit.id]);showTab('sel');setTimeout(()=>{const i=$('#f-text');if(i){i.focus();i.select()}},30)}return}}}
  svg.setPointerCapture(ev.pointerId);
  const sw=[snapV(w[0]),snapV(w[1])];
  if(calib){calib.push(w);if(calib.length===2){renderUnderPanel();ev.preventDefault();/* after the pointer's own default action, which would take the focus back */setTimeout(()=>{const inp=$('#cal-len');if(inp){inp.focus();inp.select()}},0)}updateHint();render();return}
  if(walkPick){drag={m:'walkpick',a:w,b:w};return}
  if(detBox){drag={m:'detbox',a:w,b:w};return}
  if(underMove&&S.underlay){checkpoint();drag={m:'under',w0:w,u0:[S.underlay.x,S.underlay.y]};return}
  const ps=pointSnap(w,{alt:ev.altKey}).p;
  switch(tool){
    case 'place':{if(!placeLib)return;if(placeLib.missing)return toast('This set uses items that are not in the library.');const gh=ghostAt(w,ev.altKey);
      if(placeLib.shape==='window'||placeLib.shape==='fcuw'){addObjs(gh.objs,false);return}
      /* press and drag to lay out a row or a grid of copies; a plain click places one */
      drag={m:'arr',gh,a:w,b:w,sx:ev.clientX,sy:ev.clientY,moved:false};drawOverlay();return}
    case 'room':case 'shape-rect':case 'shape-round':case 'shape-L':drag={m:'rect',a:ps,b:ps};return;
    case 'measure':{const pm=pointSnap(w,{alt:ev.altKey,faces:true}).p;drag={m:'measure',a:pm,b:pm};return}
    case 'section':{const pm=pointSnap(w,{alt:ev.altKey}).p;drag={m:'section',a:pm,b:pm};return}
    case 'pin':{checkpoint();S.pins=S.pins||[];const pin=newPin(Math.round(w[0]),Math.round(w[1]));S.pins.push(pin);markDirty();openPin(pin.id);return}
    case 'poly':case 'spline':case 'road':case 'fence':case 'trunk':case 'shape-poly':{
      const p=nextPolyPt(w,ev.altKey);
      if(polyPts&&polyPts.length>=3){const f=polyPts[0];if(Math.hypot(f[0]-p[0],f[1]-p[1])*V.k<12||Math.hypot(f[0]-w[0],f[1]-w[1])*V.k<12){finishPoly(true);return}}
      if(polyTool()&&polyPts&&polyPts.length>=2){const l=polyPts[polyPts.length-1];if(Math.hypot(l[0]-p[0],l[1]-p[1])*V.k<4){finishPoly(false);return}}
      if(!polyPts)polyPts=[];polyPts.push(p);typed='';updateHint();render();return}
    case 'addpt':{const o=byId(addPtFor);if(!o){setTool('select');return}if(insertCorner(o,w)){sel=new Set([o.id]);render();renderInspector();toast('Point added. Drag it to shape the line.')}else toast('Click on the line itself to add a point');return}
    case 'text':{const o={id:uid(),t:'text',x:sw[0],y:sw[1],text:'Label',size:Math.max(200,Math.round(fs(16)/50)*50),gid:null};addObjs([o],true);setTool('select');showTab('sel');setTimeout(()=>{const i=$('#f-text');if(i){i.focus();i.select()}},30);return}
    case 'paint':{const hitEl=ev.target.closest('[data-id]');const o=hitEl?byId(hitEl.dataset.id):null;if(!o)return;
      if(ev.altKey){const c=paintColorOf(o,ev.shiftKey);if(c){P.paintCol=c;savePrefs();renderInspector();updateHint();toast('Picked colour')}return}
      checkpoint();if(applyPaint(o,P.paintCol,ev.shiftKey)){markDirty();clashDirty=true;render();if(is3D)build3D()}return}
    case 'select':{
      if(ev.target.closest('[data-aim]')){const o=selList()[0];if(isCCTV(o)){checkpoint();drag={m:'aim',o};return}}
      if(ev.target.closest('[data-roth]')&&!S.locked&&rotGripDouble())return;
      if(ev.target.closest('[data-roth]')&&!S.locked){const base=rotList();const g=base.length&&rotGrip(base);if(g){const list=base.concat(carried(base));rotTyped='';rotLast=null;drag={m:'rot',cx:g.cx,cy:g.cy,h0:[g.hx,g.hy],e0:[g.ex,g.ey],a0:Math.atan2(w[1]-g.cy,w[0]-g.cx),deg:0,ids:list.map(o=>o.id),orig:list.map(o=>[o,clone(o)]),moved:false};return}}
      const bh=ev.target.closest('[data-bh]');if(bh){const o=selList()[0];if(o&&o.t==='wall'){checkpoint();drag={m:'bulge',o,i:+bh.dataset.bh};return}}
      const pe=ev.target.closest('[data-pin]');
      if(pe){const id=pe.dataset.pin;pinSel=id;secSel=false;sel.clear();checkpoint();drag={m:'pin',id,moved:false};renderInspector();showTab('notes');render();return}
      const sh=ev.target.closest('[data-sech]');
      if(sh&&S.section){checkpoint();drag={m:'sec',i:+sh.dataset.sech};return}
      const vh=ev.target.closest('[data-vh]');
      if(vh){const o=selList()[0],i=+vh.dataset.vh;
        checkpoint();drag={m:'vertex',o,i,old:o&&o.pts?clone(o.pts):null,rect:ev.altKey?null:rectFrame(o,i),alt:ev.altKey,sx:ev.clientX,sy:ev.clientY,moved:false};return}
      if(S.section&&S.section.a&&segDist(w[0],w[1],S.section.a,S.section.b)<fs(9)){sel.clear();secSel=true;renderInspector();render();return}
      const hitEl=ev.target.closest('[data-id]');let o=hitEl?byId(hitEl.dataset.id):null;
      if(o&&fixed(o))o=null;
      if(secSel){secSel=false}
      if(pinSel){pinSel=null;if(!$('#p-notes').hidden)renderNotes()}
      if(o){
        const grp=ev.altKey||(typeof SU!=='undefined'&&SU&&SU.gctx&&o.gid===SU.gctx)?[o]:groupOf(o);
        if(addMod(ev)){const allIn=grp.every(g=>sel.has(g.id)),md=suSelMode(ev);grp.forEach(g=>md==='add'?sel.add(g.id):md==='sub'?sel.delete(g.id):(allIn?sel.delete(g.id):sel.add(g.id)));render();renderInspector();return}
        if(!sel.has(o.id)){sel=new Set(grp.map(g=>g.id))}
        renderInspector();
        drag={m:'move',w0:w,orig:selList().concat(carried(selList())).map(x=>[x.id,clone(x)]),moved:false};render();return;
      }
      const addKey=addMod(ev);if(!addKey)sel.clear();
      drag={m:'marq',a:w,b:w,add:addKey,base:new Set(sel),mode:addKey?suSelMode(ev):'add'};render();renderInspector();return}
  }
});
svg.addEventListener('pointermove',ev=>{shiftDown=ev.shiftKey;ctrlDown=ev.ctrlKey||ev.metaKey;
  if(pointers.has(ev.pointerId))pointers.set(ev.pointerId,[ev.clientX,ev.clientY,performance.now()]);
  if(drag&&drag.holdId===ev.pointerId)return;
  /* two fingers: pan with the midpoint and zoom with the spread, together, like a map */
  if(pinch&&pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]),mx=(p[0][0]+p[1][0])/2,my=(p[0][1]+p[1][1])/2;const r=svg.getBoundingClientRect();V.x-=(mx-pinch.mx)/V.k;V.y-=(my-pinch.my)/V.k;pinch.mx=mx;pinch.my=my;zoomAt((pinch.k*d/pinch.d)/V.k,mx-r.left,my-r.top);return}
  const w=pointerWorld(ev);
  altDown=ev.altKey;
  if(!drag){
    if(tool==='place'||polyPts){hoverSnap=null;drawOverlay()}
    else if(walkPick){hoverWalk=w;drawOverlay()}
    else if(['room','measure','poly','spline','road','fence','trunk','shape-rect','shape-round','shape-L','shape-poly'].includes(tool)&&!detBox&&!calib){hoverSnap=pointSnap(w,{alt:ev.altKey});drawOverlay()}
    else if(hoverSnap){hoverSnap=null;drawOverlay()}
    return}
  const sw=[snapV(w[0]),snapV(w[1])];
  switch(drag.m){
    case 'pan':V.x=drag.vx-(ev.clientX-drag.sx)/V.k;V.y=drag.vy-(ev.clientY-drag.sy)/V.k;applyView();return;
    case 'under':S.underlay.x=drag.u0[0]+(w[0]-drag.w0[0]);S.underlay.y=drag.u0[1]+(w[1]-drag.w0[1]);updateUnderImg();return;
    case 'detbox':drag.b=w;drawOverlay();return;
    case 'walkpick':drag.b=w;drawOverlay();return;
    case 'sec':{if(!S.section)return;const p=P.snap?[snapV(w[0]),snapV(w[1])]:w;if(drag.i===0)S.section.a=p;else S.section.b=p;markDirty();if(is3D)sectionApply();render();return}
    case 'pin':{const p=(S.pins||[]).find(x=>x.id===drag.id);if(!p)return;p.x=Math.round(w[0]);p.y=Math.round(w[1]);drag.moved=true;markDirty();render();return}
    case 'rect':case 'measure':case 'section':{const sn=pointSnap(w,{alt:ev.altKey,faces:drag.m==='measure'});let b=sn.p;guideSVG=sn.g;if((drag.m==='measure'||drag.m==='section')&&ev.shiftKey){b=Math.abs(b[0]-drag.a[0])>Math.abs(b[1]-drag.a[1])?[b[0],drag.a[1]]:[drag.a[0],b[1]]}drag.b=b;drawOverlay();return}
    case 'rot':{let a=(Math.atan2(w[1]-drag.cy,w[0]-drag.cx)-drag.a0)*180/Math.PI;a=((a+180)%360+360)%360-180;a=ev.altKey?Math.round(a*10)/10:Math.round(a/15)*15;if(a===drag.deg&&drag.moved)return;
      if(!drag.moved){if(!a)return;drag.moved=true;checkpoint()}drag.deg=a;rotRestore(drag.orig);if(a)drag.orig.forEach(([o])=>turnObj(o,drag.cx,drag.cy,a));markDirty();render();return}
    case 'aim':{const o=drag.o;let a=Math.atan2(w[1]-o.y,w[0]-o.x)*180/Math.PI-90;if(!ev.altKey)a=Math.round(a/5)*5;o.r=((Math.round(a*10)/10)%360+360)%360;const ri=$('#p-sel [data-f="r"]');if(ri)ri.value=r1(o.r);markDirty();render();schedulePOV();return}
    case 'bulge':{const o=drag.o,sg=rawSegs(o).find(q=>q[2]===drag.i);if(!sg)return;const g=arcGeom(sg[0],sg[1],0);let h=(w[0]-g.m[0])*g.n[0]+(w[1]-g.m[1])*g.n[1];
      if(Math.abs(h)<fs(8))h=0;else h=Math.round(h/10)*10;h=Math.max(-g.L*1.5,Math.min(g.L*1.5,h));if(!o.bulge)o.bulge=[];while(o.bulge.length<(o.pts||[]).length)o.bulge.push(0);o.bulge[drag.i]=h;clashDirty=true;render();return}
    case 'arr':{drag.b=w;if(Math.hypot(ev.clientX-drag.sx,ev.clientY-drag.sy)>6)drag.moved=true;drawOverlay();updateHint();return}
    case 'vertex':{if(!drag.moved&&Math.hypot(ev.clientX-drag.sx,ev.clientY-drag.sy)<4)return;drag.moved=true;const sn=pointSnap(w,{alt:ev.altKey,exV:{o:drag.o,i:drag.i}});
      if(drag.rect&&!ev.altKey){const R=drag.rect,q=sn.p,a=(q[0]-R.C[0])*R.u[0]+(q[1]-R.C[1])*R.u[1],b=(q[0]-R.C[0])*R.v[0]+(q[1]-R.C[1])*R.v[1],pt=(x,y)=>[Math.round(R.C[0]+R.u[0]*x+R.v[0]*y),Math.round(R.C[1]+R.u[1]*x+R.v[1]*y)];
        const P=drag.o.pts;P[R.iB]=pt(a,0);P[R.iD]=pt(0,b);P[drag.i]=pt(a,b);guideSVG=sn.g;clashDirty=true;render();return}
      drag.o.pts[drag.i]=sn.p;guideSVG=sn.g;clashDirty=true;render();return}
    case 'marq':drag.b=w;{const x0=Math.min(drag.a[0],w[0]),x1=Math.max(drag.a[0],w[0]),y0=Math.min(drag.a[1],w[1]),y1=Math.max(drag.a[1],w[1]),cross=w[0]<drag.a[0];const box={x0,y0,x1,y1};const ns=new Set(drag.base);
      S.objs.forEach(o=>{if(fixed(o))return;if(!visible(o)||!pickable(o))return;const b=objBox(o);const hit=cross?boxHit(b,box):(b.x0>=x0&&b.x1<=x1&&b.y0>=y0&&b.y1<=y1);if(hit)groupOf(o).forEach(g=>drag.mode==='sub'?ns.delete(g.id):drag.mode==='tog'?(drag.base.has(g.id)?ns.delete(g.id):ns.add(g.id)):ns.add(g.id))});sel=ns;render()}return;
    case 'move':{
      let dx=w[0]-drag.w0[0],dy=w[1]-drag.w0[1];
      if(!drag.moved){if(Math.hypot(dx,dy)*V.k<3)return;drag.moved=true;pushPast(snapState());future=[];}
      /* Shift (or a second finger on touch) keeps the move on one axis */
      if(ev.shiftKey||drag.axisHold){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0}
      if(P.snap){dx=Math.round(dx/P.snapSize)*P.snapSize;dy=Math.round(dy/P.snapSize)*P.snapSize}
      guideSVG='';
      const rdx=dx,rdy=dy;
      if(P.osnap&&!ev.altKey){const r=objSnap(drag.orig,dx,dy);dx=r[0];dy=r[1];guideSVG=r[2]}
      drag.orig.forEach(([id,o0])=>{const o=byId(id);if(!o)return;moveObj(o,o0,dx,dy)});
      if(!ev.altKey)seatWindows(drag.orig,rdx,rdy);
      clashDirty=true;render();return}
  }
});
/* windows stay in a wall: put the window on the wall nearest to where it is being dragged, slid along it.
   Far from any wall it moves freely, so it can be carried to another wall. Alt drags without this. */
function seatWindow(o,p,tol,cur){let h=null;
  /* stay on the wall it started on while the pointer is still near that wall, so sliding past a cross wall does not jump onto it */
  if(cur){const ux=(cur.b[0]-cur.a[0])/cur.L,uy=(cur.b[1]-cur.a[1])/cur.L,dx=p[0]-cur.a[0],dy=p[1]-cur.a[1],al=dx*ux+dy*uy,pd=Math.abs(-dx*uy+dy*ux);if(pd<tol*0.8&&al>-50&&al<cur.L+50)h=Object.assign({},cur,{along:al,pd})}
  if(!h)h=wallAt(p,tol);if(!h)return false;const L=h.L,ux=(h.b[0]-h.a[0])/L,uy=(h.b[1]-h.a[1])/L;
  let al=h.along;if(P.snap)al=Math.round(al/P.snapSize)*P.snapSize;al=L<o.w?L/2:Math.max(o.w/2,Math.min(L-o.w/2,al));
  if(o.shape==='fcuw'){/* on the face of the wall, on the side the pointer is, blowing into the room */const sd=(-(p[0]-h.a[0])*uy+(p[1]-h.a[1])*ux)>=0?1:-1,nx=-uy*sd,ny=ux*sd,off=h.t/2+o.d/2+5;
    o.x=Math.round(h.a[0]+ux*al+nx*off);o.y=Math.round(h.a[1]+uy*al+ny*off);o.r=Math.round((Math.atan2(ny,nx)*180/Math.PI-90)*10)/10;return true}
  o.x=Math.round(h.a[0]+ux*al);o.y=Math.round(h.a[1]+uy*al);o.r=Math.round(Math.atan2(uy,ux)*1800/Math.PI)/10;o.d=Math.max(60,h.t);return true}
function seatWindows(orig,dx,dy){const l=orig.map(([id,o0])=>[byId(id),o0]).filter(([o])=>o);
  /* only when windows are moved on their own; moving walls or rooms with them carries them along unchanged */
  if(!l.length||l.some(([o])=>!isWallMount(o)&&!(o.t==='item'))||l.some(([o])=>o.t==='room'||o.t==='wall'))return;
  const tol=Math.max(600,fs(24));l.forEach(([o,o0])=>{if(isWallMount(o))seatWindow(o,[o0.x+dx,o0.y+dy],tol,wallAt([o0.x,o0.y],o.shape==='fcuw'?o.d/2+400:60))})}
function moveObj(o,o0,dx,dy){
  if(o.t==='item'||o.t==='text'){o.x=o0.x+dx;o.y=o0.y+dy}
  else if(o.t==='room'||o.t==='wall')o.pts=o0.pts.map(p=>[p[0]+dx,p[1]+dy]);
  else if(o.t==='dim'){o.a=[o0.a[0]+dx,o0.a[1]+dy];o.b=[o0.b[0]+dx,o0.b[1]+dy]}
  else if(o.t==='trunk')o.pts=o0.pts.map(p=>[p[0]+dx,p[1]+dy]);
}
/* snap targets: every wall face, wall centreline, room edge and item edge that runs straight across or down */
function snapLines(ids,exV,noFaces){
  const xs=[],ys=[],verts=[],cx=[],cy=[];const mvC=!!ids&&[...ids].some(id=>isCeil(byId(id)));
  const seg=(a,b,h)=>{if(noFaces)h=0;if(Math.abs(a[0]-b[0])<1){const x=(a[0]+b[0])/2;if(noFaces||!h)xs.push(x);if(h){xs.push(x-h,x+h)}}if(Math.abs(a[1]-b[1])<1){const y=(a[1]+b[1])/2;if(noFaces||!h)ys.push(y);if(h){ys.push(y-h,y+h)}}};
  S.objs.forEach(o=>{if(ids&&ids.has(o.id))return;if(!visible(o))return;
    if(o.t==='item'){if(isOpening(o)||noFaces||isCeil(o)!==mvC)return;const q=objBox(o);xs.push(q.x0,q.x1);ys.push(q.y0,q.y1);cx.push((q.x0+q.x1)/2);cy.push((q.y0+q.y1)/2)}
    else if(o.t==='room'){const h=o.nowall?0:P.wall/2;o.pts.forEach((p,i)=>{if(!(exV&&exV.o===o&&exV.i===i))verts.push(p);seg(p,o.pts[(i+1)%o.pts.length],h)})}
    else if(o.t==='wall'){o.pts.forEach((p,i)=>{if(!(exV&&exV.o===o&&exV.i===i))verts.push(p)});wallSegs(o).forEach(([a,b])=>seg(a,b,(o.th||0)/2))}});
  return{xs,ys,verts,cx,cy};
}
/* snap one point: corners first, then lines across and down, then the grid */
let hoverSnap=null;
function pointSnap(w,opt){
  opt=opt||{};let p=[snapV(w[0]),snapV(w[1])];
  if(!P.osnap||opt.alt)return{p,g:''};
  const tol=10/V.k,T=snapLines(opt.ids||null,opt.exV,!opt.faces);let g='';
  /* also snap to the points of the line being drawn, so you can line up with (and close back onto) the start point */
  let verts=T.verts,xs=T.xs,ys=T.ys;
  if(typeof SU!=='undefined'&&SU&&suOn()&&!opt.axis){const r=suInfer(w,tol,T,opt);if(r)return r}
  if(polyPts&&polyPts.length){const pp=polyPts.slice(0,polyPts.length-1);if(pp.length){verts=verts.concat(pp);xs=xs.concat(pp.map(p=>p[0]));ys=ys.concat(pp.map(p=>p[1]))}}
  if(!opt.axis){let best=null;verts.forEach(v=>{const d=Math.hypot(v[0]-w[0],v[1]-w[1]);if(d<tol&&(!best||d<best.d))best={d,v}});
    if(best){return{p:[best.v[0],best.v[1]],g:`<rect class="snapv" x="${best.v[0]-fs(5)}" y="${best.v[1]-fs(5)}" width="${fs(10)}" height="${fs(10)}"/>`}}}
  const near=(arr,v)=>{let b=null;arr.forEach(t=>{const d=Math.abs(t-v);if(d<tol&&(b===null||d<Math.abs(b-v)))b=t});return b};
  if(opt.axis!=='y'){const x=near(xs,w[0]);if(x!==null){p[0]=x;g+=`<line class="guide" x1="${x}" y1="${V.y}" x2="${x}" y2="${V.y+H/V.k}"/>`}}
  if(opt.axis!=='x'){const y=near(ys,w[1]);if(y!==null){p[1]=y;g+=`<line class="guide" x1="${V.x}" y1="${y}" x2="${V.x+W/V.k}" y2="${y}"/>`}}
  return{p,g};
}
function objSnap(orig,dx,dy){
  const items=orig.map(x=>x[1]);const b=unionBox(items);if(!b)return[dx,dy,''];
  const mv={x0:b.x0+dx,x1:b.x1+dx,y0:b.y0+dy,y1:b.y1+dy};const tol=is3D?150:10/V.k;
  const ids=new Set(orig.map(x=>x[0]));const T=snapLines(ids);
  /* edges go flush to wall faces and item edges first; centres line up with other items' centres only if no edge fits */
  const pick=(edges,mid,ts,cs)=>{let b=null;edges.forEach(v=>ts.forEach(t=>{const d=t-v;if(Math.abs(d)<tol&&(b===null||Math.abs(d)<Math.abs(b.d)))b={d,t}}));
    if(!b)cs.forEach(t=>{const d=t-mid;if(Math.abs(d)<tol&&(b===null||Math.abs(d)<Math.abs(b.d)))b={d,t}});return b};
  const bx=pick([mv.x0,mv.x1],(mv.x0+mv.x1)/2,T.xs,T.cx),by=pick([mv.y0,mv.y1],(mv.y0+mv.y1)/2,T.ys,T.cy);
  let g='';
  if(bx){dx+=bx.d;g+=`<line class="guide" x1="${bx.t}" y1="${V.y}" x2="${bx.t}" y2="${V.y+H/V.k}"/>`}
  if(by){dy+=by.d;g+=`<line class="guide" x1="${V.x}" y1="${by.t}" x2="${V.x+W/V.k}" y2="${by.t}"/>`}
  return[dx,dy,g];
}
svg.addEventListener('pointerup',ev=>{
  clearTimeout(lpTimer);if(lpFired){lpFired=false;pointers.delete(ev.pointerId);drag=null;return}
  pointers.delete(ev.pointerId);if(pinch){if(pointers.size<2)pinch=null;return}
  if(drag&&drag.holdId===ev.pointerId){drag.axisHold=false;drag.holdId=null;return}
  if(!drag)return;const d=drag;drag=null;guideSVG='';if(d.m==='move'&&d.moved)clashDirty=true;
  if(d.m==='pan'){svg.style.cursor=tool==='pan'?'grab':(tool==='select'?'default':'crosshair');
    /* a tap on empty plan (finger barely moved) clears the selection, as a click does on desktop */
    if(tool==='select'&&!multiMode&&!lpFired&&Math.hypot(ev.clientX-d.sx,ev.clientY-d.sy)<8){if(sel.size||pinSel){sel.clear();pinSel=null;render();renderInspector()}
      /* phones: a tap on the plan also puts any open sheet away (Details, Library, Draw, More) */if(PHONE()){if(P.insp||P.lib){P.insp=false;P.lib=false;savePrefs();applyDrawers()}if(msheetKind)msheet(null);mbarSync()}}
    return}
  if(d.m==='under'){markDirty();return}
  if(d.m==='sec'){markDirty();if(is3D)sectionApply();render();renderInspector();return}
  if(d.m==='pin'){markDirty();render();return}
  /* Alt-click on a point (no drag) removes it */
  if(d.m==='vertex'&&d.alt&&!d.moved){const o=d.o,i=d.i,min=(o.t==='room'||o.closed)?3:2;if(o.pts.length<=min){toast(`A ${o.t==='room'?'room':'line'} needs at least ${min} points`);render();return}
    o.pts.splice(i,1);if(Array.isArray(o.bulge)){o.bulge.splice(i,1);if(i>0)o.bulge[i-1]=0}markDirty();clashDirty=true;render();renderInspector();return}
  if(d.m==='arr'){const list=d.moved?arrCopies(d).flat():d.gh.objs;addObjs(list,false);if(d.moved)toast(`Placed ${arrCopies(d).length} × ${placeLib?placeLib.name:'item'}`);drawOverlay();updateHint();return}
  if(d.m==='walkpick'){const dx=d.b[0]-d.a[0],dy=d.b[1]-d.a[1];const yaw=Math.hypot(dx,dy)>150?Math.atan2(-dx,-dy):0;walkPick=false;hoverWalk=null;updateHint();render();set3D(true);walkStart({pos:d.a,yaw});return}
  if(d.m==='detbox'){const x0=Math.min(d.a[0],d.b[0]),x1=Math.max(d.a[0],d.b[0]),y0=Math.min(d.a[1],d.b[1]),y1=Math.max(d.a[1],d.b[1]);
    if((x1-x0)*V.k<20||(y1-y0)*V.k<20){toast('Drag a larger box, or press Enter for the whole sheet');render();return}
    runDetect({x0,y0,x1,y1});return}
  if(d.m==='rect'){
    if(suOn()&&(tool==='room'||tool==='shape-rect')&&Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])*V.k<6){SU.rect={a:d.a,b:d.a};SU.typed='';updateHint();render();return}
    rectFinish(d.a,d.b);return}
  if(d.m==='measure'){if(Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])>10)addObjs([{id:uid(),t:'dim',a:d.a,b:d.b,gid:null}],false);else render();return}
  if(d.m==='section'){if(Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])>200){checkpoint();S.section={a:d.a,b:d.b,on:true,flip:!!(S.section&&S.section.flip)};markDirty();setTool('select');secSel=true;renderInspector();toast('Section line set — open the 3D view to see the slice');if(is3D)sectionApply();sectionBar()}render();return}
  SUREST(d)});
function rectFinish(a,b){{const d={a,b};
    const x0=Math.min(d.a[0],d.b[0]),x1=Math.max(d.a[0],d.b[0]),y0=Math.min(d.a[1],d.b[1]),y1=Math.max(d.a[1],d.b[1]);
    if((x1-x0)<100||(y1-y0)<100){render();return}
    if(tool==='room'){const n=S.objs.filter(o=>o.t==='room').length+1;addObjs([{id:uid(),t:'room',name:'Room '+n,pts:rectP(x0,y0,x1,y1),gid:null}],true);showTab('sel');return}
    else{const kind=tool.slice(6);const o={id:uid(),t:'item',code:'CUSTOM',name:kind==='round'?'Custom round':(kind==='L'?'Custom L-shape':'Custom rectangle'),cat:'Custom',shape:kind,w:x1-x0,d:y1-y0,h:750,a:Math.round(Math.min(x1-x0,y1-y0)/2),seats:0,cf:0,cb:0,nests:false,rate:null,pts:null,x:(x0+x1)/2,y:(y0+y1)/2,r:0,gid:null,label:''};addObjs([o],true)}
    setTool('select');showTab('sel');return;
  }}
/* the rest of the pointer-up cases, split out so the rectangle can also be finished by a second click */
function SUREST(d){
  if(d.m==='vertex'&&d.moved&&d.old&&!d.o.site){followWall(d.o,d.old);render()}
  if(d.m==='vertex'||d.m==='bulge'){markDirty();renderInspector();return}
  if(d.m==='marq'){renderInspector();render();return}
  if(d.m==='rot'){if(d.moved){clashDirty=true;markDirty();rotLast={ids:d.ids,sel:[...sel],orig:d.orig.map(([o,c])=>[o,c]),cx:d.cx,cy:d.cy,deg:d.deg,sig:rotSig(d.ids)};if(is3D)build3D()}render();renderInspector();updateHint();if(d.moved)rotChipShow();return}
  if(d.m==='move'){if(d.moved){markDirty();clashDirty=true}render();renderInspector();return}
}
svg.addEventListener('pointercancel',ev=>{clearTimeout(lpTimer);pointers.delete(ev.pointerId);if(drag&&drag.holdId===ev.pointerId){drag.axisHold=false;drag.holdId=null;return}pinch=null;drag=null;render()});
svg.addEventListener('contextmenu',e=>{e.preventDefault();if(WALK.on||tool==='place'||polyPts||calib||detBox||walkPick)return;showCtx(e)});
function ctxItems(){const it=ctxItems0();if(!suOn()||secSel)return it;const l=selList();const add=[];
  if(l.length===1&&(l[0].t==='room'||l[0].t==='wall'))add.push(['su-offset','Offset…']);
  if(l.length&&!l.some(o=>o.cmp))add.push(['su-comp','Make component…']);if(l.some(o=>o.cmp))add.push(['su-cedit','Edit component'],['su-cuniq','Make unique'],['su-cexp','Explode component']);
  if(l.length){add.push(['su-zsel','Zoom selection'],['su-flipx','Flip along red (x)'],['su-flipy','Flip along green (y)'],['su-hide','Hide'],['su-iso','Hide everything else'])}else add.push(['su-zwin','Zoom window'],['su-prev','Previous view'],['su-scene','Add scene']);if(!l.length&&S.guides&&S.guides.length)add.push(['su-guidesx','Delete guides']);
  if(SU.hidden.size)add.push(['su-unhide',`Unhide all (${SU.hidden.size})`]);it.forEach(r=>{if(r[0]==='group')r[1]='Make group'});const di=it.findIndex(r=>r[0]==='del');if(di<0)return it.concat(add);return it.slice(0,di).concat(add,it.slice(di))}
function ctxItems0(){
  let items=[];
  if(secSel&&S.section){return [['grp','Section cut'],['sectoggle',S.section.on?'Turn off slice':'Turn on slice'],['secflip','Flip side'],['secdel','Delete section','danger']];}
  const l=selList();
  if(!l.length){if(clip&&clip.length)items.push(['paste','Paste here']);items.push(['selall','Select all furniture']);if(TOUCH)items.push(['multi',multiMode?'Stop selecting several':'Select several…'],['snap',P.snap?'Snap to grid: on':'Snap to grid: off']);return items;}
  const exits=l.filter(x=>isOpening(x)||isCore(x));
  if(exits.length){const allEx=exits.every(x=>x.exit);items.push(['exit',(allEx?'Unmark':'Mark')+' as exit'+(exits.length>1?'s':'')]);}
  if(l.length===1&&l[0].t==='room')items.push(['rename','Rename room']);
  items.push(['rotcw','Rotate 90° ⟳'],['rotccw','Rotate 90° ⟲'],['dup','Duplicate'],['copy','Copy']);
  if(l.some(o=>o.t==='item'&&/^door/.test(o.shape)))items.push(['hinge','Flip door hinge']);
  if(l.length>1&&!l.every(o=>o.gid&&o.gid===l[0].gid))items.push(['group','Group']);if(l.some(o=>o.gid))items.push(['ungroup','Ungroup']);
  if(TOUCH)items.push(['multi',multiMode?'Stop selecting several':'Select several…'],['props','Details…']);
  if(l.some(x=>x.col||x.floorCol||x.wallCol||x.faces))items.push(['resetcol','Reset colour']);
  items.push(['del','Delete','danger']);
  return items;
}
function showMenu(cx,cy){ctxOpenedAt=performance.now();const m=$('#ctxmenu');const items=ctxItems();if(!items.length){m.hidden=true;return}
  m.innerHTML=items.map(it=>it[0]==='grp'?`<div class="grp">${it[1]}</div>`:`<button class="mi${it[2]?' '+it[2]:''}" type="button" data-cm="${it[0]}">${it[1]}</button>`).join('');
  m.hidden=false;const mw=m.offsetWidth||190,mh=m.offsetHeight||40;
  const reserve=TOUCH?(matchMedia('(max-width:820px), (pointer:coarse) and (max-height:500px)').matches?96:16):8;m.style.left=Math.min(cx,window.innerWidth-mw-8)+'px';m.style.top=Math.max(8,Math.min(cy,window.innerHeight-mh-reserve))+'px';}
function showCtx(e){
  const w=toWorld(e);lastW=w;
  if(S.section&&S.section.a&&segDist(w[0],w[1],S.section.a,S.section.b)<fs(10)){secSel=true;sel.clear();renderInspector();render();showMenu(e.clientX,e.clientY);return}
  const hitEl=e.target.closest('[data-id]');let o=hitEl?byId(hitEl.dataset.id):null;if(o&&fixed(o))o=null;
  secSel=false;if(o&&!sel.has(o.id))sel=new Set(groupOf(o).map(g=>g.id));
  renderInspector();render();showMenu(e.clientX,e.clientY);
}
function ctxFrom3D(e,o,ground){secSel=false;pinSel=null;if(ground)lastW=ground;
  if(o&&!fixed(o)){if(!sel.has(o.id))sel=new Set(groupOf(o).map(g=>g.id))}else sel.clear();
  renderInspector();build3D();showMenu(e.clientX,e.clientY);
}
$('#ctxmenu').addEventListener('click',e=>{if(e.detail>0&&lastDownAt<ctxOpenedAt){e.stopImmediatePropagation();return}const b=e.target.closest('[data-cm]');if(!b)return;const a=b.dataset.cm;$('#ctxmenu').hidden=true;
  if(a==='sectoggle'){if(S.section){checkpoint();S.section.on=!S.section.on;markDirty();if(is3D){sectionApply();sectionBar()}render()}return}
  if(a==='secflip'){if(S.section){checkpoint();S.section.flip=!S.section.flip;markDirty();if(is3D)sectionApply();render()}return}
  if(a==='secdel'){if(S.section){checkpoint();S.section=undefined;secSel=false;if(is3D){sectionApply();sectionBar()}render();renderInspector();toast('Section deleted')}return}
  if(a==='paste'){pasteClip(true);return}
  if(a==='selall'){setSel(S.objs.filter(o=>!isWallish(o)&&visible(o)&&pickable(o)).map(o=>o.id));return}
  const l=selList();if(!l.length)return;
  if(a==='exit'){checkpoint();const ex=l.filter(x=>isOpening(x)||isCore(x)),all=ex.every(x=>x.exit);ex.forEach(x=>x.exit=!all);markDirty();render();renderInspector();if(EG.on)egressRun(true);if(!$('#p-fire').hidden)renderFire();toast(all?'Exit cleared':'Marked as exit')}
  else if(a==='rename'){const o=l[0];if(o.t==='room')renameRoom(o);else if(o.t==='item')renameItem(o)}
  else if(a==='rotcw')rotateSel(90);
  else if(a==='rotccw')rotateSel(-90);
  else if(a==='dup')duplicateSel();
  else if(a==='copy')copySel();
  else if(a==='resetcol'){checkpoint();l.forEach(o=>{delete o.col;delete o.floorCol;delete o.wallCol;delete o.faces});markDirty();clashDirty=true;render();if(is3D)build3D();renderInspector();toast('Colour reset')}
  else if(a==='del')deleteSel();
  else if(a==='hinge')applyDoorFlip(false);
  else if(a==='group')groupSel();
  else if(a==='ungroup')ungroupSel();
  else if(a==='props')showTab('sel',true);
});
$('#ctxmenu').addEventListener('click',e=>{if(e.detail>0&&lastDownAt<ctxOpenedAt){e.stopImmediatePropagation();return}const b=e.target.closest('[data-cm]');if(!b)return;const a=b.dataset.cm;
  if(a==='multi')setMulti(!multiMode);
  else if(a==='snap'){P.snap=!P.snap;savePrefs();toast(P.snap?'Snap to grid on':'Snap to grid off');render()}});
$('#multibar')&&$('#multibar').addEventListener('click',e=>{if(e.target.closest('#multi-done'))setMulti(false)});
document.addEventListener('pointerdown',e=>{if(!$('#ctxmenu').hidden&&!e.target.closest('#ctxmenu'))$('#ctxmenu').hidden=true},true);
svg.addEventListener('dblclick',ev=>{if(!polyPts)return;
  if(polyTool()){if(polyPts.length>=2)finishPoly(false)}
  else if(polyPts.length>=3){polyPts.pop();finishPoly(true)}});
svg.addEventListener('wheel',ev=>{ev.preventDefault();const r=svg.getBoundingClientRect();const f=Math.exp(-(ev.deltaMode===1?ev.deltaY*16:ev.deltaY)*0.0015);zoomAt(f,ev.clientX-r.left,ev.clientY-r.top)},{passive:false});
let polyGuide='';
function nextPolyPt(w,alt){
  if(alt===undefined)alt=altDown;
  /* straight walls, roads and fences snap to horizontal/vertical only when within ~2° of it, so they still run free at any angle.
     Hold Ctrl (or Alt) to adjust completely freely; hold Shift to force the nearest axis. */
  const free=alt||ctrlDown;let res=null;
  if(polyPts&&polyPts.length&&tool!=='spline'&&!siteCurve()){const l=polyPts[polyPts.length-1],dx=w[0]-l[0],dy=w[1]-l[1],L=Math.hypot(dx,dy);
    let lock=false;
    if(L>1&&!free){if(shiftDown)lock=true;else if(P.ortho){const tol=Math.tan(2*Math.PI/180);if(Math.abs(dy)/Math.max(1,Math.abs(dx))<tol||Math.abs(dx)/Math.max(1,Math.abs(dy))<tol)lock=true}}
    if(lock){const hz=Math.abs(dx)>=Math.abs(dy);const s=pointSnap(hz?[w[0],l[1]]:[l[0],w[1]],{axis:hz?'x':'y',alt});polyGuide=s.g;res=hz?[s.p[0],l[1]]:[l[0],s.p[1]]}}
  if(!res){const s=pointSnap(w,{alt});polyGuide=s.g;res=s.p}
  if(polyPts&&polyPts.length){const l=polyPts[polyPts.length-1],dx=res[0]-l[0],dy=res[1]-l[1];if(Math.hypot(dx,dy)>1){let a=Math.atan2(-dy,dx)*180/Math.PI;drawAngle=((a%360)+360)%360;drawAngleShow=true}else drawAngleShow=false}
  else drawAngleShow=false;
  return res;
}
function typedPoint(){
  const L=num(typed,0);if(!(L>0)||!polyPts||!polyPts.length)return null;
  const l=polyPts[polyPts.length-1];const p=nextPolyPt(lastW);let dx=p[0]-l[0],dy=p[1]-l[1];const m=Math.hypot(dx,dy);if(m<1){dx=1;dy=0}else{dx/=m;dy/=m}
  return[Math.round(l[0]+dx*L),Math.round(l[1]+dy*L)];
}
function finishPoly(closed){
  if(polyTool()){
    /* walls: open runs finish on Enter, double-click or right-click; clicking the first corner closes the loop and makes a room inside */
    const pts=(polyPts||[]).filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>1);polyPts=null;typed='';
    if(pts.length<2){updateHint();render();return}
    if(tool==='road'||tool==='fence'){const site=tool,o={id:uid(),t:'wall',site,spline:siteCurve()||undefined,pts,closed:!!(closed&&pts.length>=3),th:site==='road'?(+P.roadW||6000):150,gid:null};if(site==='fence')o.h=+P.fenceH||2400;
      addObjs([o],false);setTool('select');sel=new Set([o.id]);showTab('sel');updateHint();render();renderInspector();if(is3D)build3D();
      if(S.bld&&S.bld.levels.indexOf(bldLevel(S))!==groundI(S.bld))toast(`${site==='road'?'Road':'Fence'} saved to the ground floor: the site shows on ${levelNames(S.bld)[S.bld.levels[groundI(S.bld)].id]} only`);return}
    if(tool==='trunk'){const o={id:uid(),t:'trunk',pts,w:+P.trunkW||150,h:+P.trunkH||100,drop:30,gid:null};addObjs([o],false);setTool('select');sel=new Set([o.id]);showTab('sel');updateHint();render();renderInspector();if(is3D)build3D();if(!LY('ceil'))toast('Trunking is on the Ceiling layer (currently hidden)');return}
    const out=[{id:uid(),t:'wall',pts,closed:!!(closed&&pts.length>=3),th:newWallTh(),gid:null}];
    if(tool==='spline')out[0].spline=true;
    if(closed&&pts.length>=3){const n=S.objs.filter(o=>o.t==='room').length+1;out.push({id:uid(),t:'room',name:'Room '+n,pts:insetPoly(pts,newWallTh()/2),nowall:true,link:out[0].id,gid:null})}
    addObjs(out,false);sel=new Set([out[0].id]);updateHint();render();renderInspector();return}
  if(!polyPts||polyPts.length<3){toast('A shape needs at least three corners');return}
  const pts=polyPts;polyPts=null;
  {const b=bboxPts(pts),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;addObjs([{id:uid(),t:'item',code:'CUSTOM',name:'Custom polygon',cat:'Custom',shape:'poly',w:b.x1-b.x0,d:b.y1-b.y0,h:750,a:0,seats:0,cf:0,cb:0,nests:false,rate:null,pts:pts.map(p=>[p[0]-cx,p[1]-cy]),x:cx,y:cy,r:0,gid:null,label:''}],true)}
  setTool('select');showTab('sel');
}
function liveSVG(){
  let s='';
  if(drag&&drag.m==='rect'){const x0=Math.min(drag.a[0],drag.b[0]),y0=Math.min(drag.a[1],drag.b[1]),w=Math.abs(drag.b[0]-drag.a[0]),h=Math.abs(drag.b[1]-drag.a[1]);
    if(tool==='shape-round')s+=`<ellipse class="draw" cx="${x0+w/2}" cy="${y0+h/2}" rx="${w/2}" ry="${h/2}"/>`;else s+=`<rect class="draw" x="${x0}" y="${y0}" width="${w}" height="${h}"/>`;
    s+=dimSVG([x0,y0+h],[x0+w,y0+h])+dimSVG([x0+w,y0],[x0+w,y0+h])}
  if(drag&&drag.m==='measure')s+=dimSVG(drag.a,drag.b);
  if(drag&&drag.m==='section')s+=`<line class="sec-line" x1="${drag.a[0]}" y1="${drag.a[1]}" x2="${drag.b[0]}" y2="${drag.b[1]}"/>`;
  if(drag&&drag.m==='marq'){const x0=Math.min(drag.a[0],drag.b[0]),y0=Math.min(drag.a[1],drag.b[1]);s+=`<rect class="marq${drag.b[0]<drag.a[0]?' cross':''}" x="${x0}" y="${y0}" width="${Math.abs(drag.b[0]-drag.a[0])}" height="${Math.abs(drag.b[1]-drag.a[1])}"/>`}
  if(polyPts&&polyPts.length){const nx=typedPoint()||nextPolyPt(lastW);const all=polyPts.concat([nx]);
    if(tool==='poly')s+=`<path class="wall-ghost" d="M${all.map(p=>p[0]+' '+p[1]).join('L')}" stroke-width="${newWallTh()}"/>`;
    if(tool==='road'||tool==='fence'){const gp=siteCurve()&&all.length>=3?splinePts(all,false):all;s+=`<path class="${tool==='road'?'road-ghost':'fence-ghost'}" d="M${gp.map(p=>p[0]+' '+p[1]).join('L')}" stroke-width="${tool==='road'?(+P.roadW||6000):fs(3)}"/>`}
    if(tool==='spline'){const cl=all.length>=4&&hoverSnap&&Math.hypot(all[0][0]-all.at(-1)[0],all[0][1]-all.at(-1)[1])*V.k<12;const q=splinePts(cl?all.slice(0,-1):all,cl);s+=`<path class="wall-ghost" d="M${q.map(p=>p[0]+' '+p[1]).join('L')}${cl?'Z':''}" stroke-width="${newWallTh()}"/>`}
    s+=`<path class="draw" style="fill-opacity:${polyTool()?0:.05}${tool==='spline'?';stroke-dasharray:4 4;opacity:.6':''}" d="M${all.map(p=>p[0]+' '+p[1]).join('L')}"/>`;polyPts.forEach((p,i)=>s+=`<circle class="drawpt" cx="${p[0]}" cy="${p[1]}" r="${fs(i===0?6:4)}"/>`);s+=dimSVG(polyPts[polyPts.length-1],nx)+polyGuide;
    if(drawAngleShow&&![0,90,180,270,360].some(x=>Math.abs(drawAngle-x)<0.4)){const mid=[(polyPts[polyPts.length-1][0]+nx[0])/2,(polyPts[polyPts.length-1][1]+nx[1])/2];s+=`<text class="draw-ang" x="${mid[0]}" y="${mid[1]+fs(22)}" font-size="${fs(12)}" text-anchor="middle">${drawAngle.toFixed(1)}°</text>`}}
  else if(hoverSnap&&!drag)s+=hoverSnap.g+`<path class="draw" d="M${hoverSnap.p[0]-fs(7)} ${hoverSnap.p[1]}H${hoverSnap.p[0]+fs(7)}M${hoverSnap.p[0]} ${hoverSnap.p[1]-fs(7)}V${hoverSnap.p[1]+fs(7)}"/>`;
  if(walkPick){const a=drag&&drag.m==='walkpick'?drag.a:hoverWalk;if(a){let ang=-Math.PI/2;if(drag&&drag.m==='walkpick'&&Math.hypot(drag.b[0]-a[0],drag.b[1]-a[1])>150)ang=Math.atan2(drag.b[1]-a[1],drag.b[0]-a[0]);s+=walkerSVG(a,ang)}}
  if(drag&&drag.m==='detbox'){const x0=Math.min(drag.a[0],drag.b[0]),y0=Math.min(drag.a[1],drag.b[1]);s+=`<rect class="marq" x="${x0}" y="${y0}" width="${Math.abs(drag.b[0]-drag.a[0])}" height="${Math.abs(drag.b[1]-drag.a[1])}"/>`}
  if(drag&&drag.m==='arr'){const cs=drag.moved?arrCopies(drag):[drag.gh.objs];cs.forEach(l=>l.forEach(o=>{s+=`<g class="it ghost ${catCls(o.cat)}" transform="translate(${o.x} ${o.y}) rotate(${o.r})${o.flip?' scale(-1 1)':''}" style="pointer-events:none">${shapeSVG(o)}</g>`}));
    if(drag.moved){const[pw,pd]=arrPitch(drag.gh),nx=new Set(cs.map(l=>l[0].x)).size,ny=new Set(cs.map(l=>l[0].y)).size;s+=`<text class="arr-lbl" x="${drag.b[0]}" y="${drag.b[1]-fs(14)}" font-size="${fs(13)}" text-anchor="middle">${nx} × ${ny} = ${cs.length}</text>`}}
  if(tool==='place'&&placeLib&&!drag){const gh=ghostAt(lastW);gh.objs.forEach(o=>{s+=`<g class="it ghost ${catCls(o.cat)}" transform="translate(${o.x} ${o.y}) rotate(${o.r})${o.flip?' scale(-1 1)':''}" style="pointer-events:none">${shapeSVG(o)}</g>`;if(LY('zones'))zoneLocal(o).forEach(p=>s+=`<path class="zone" transform="translate(${o.x} ${o.y}) rotate(${o.r})" d="M${p.map(q=>q[0]+' '+q[1]).join('L')}Z" style="pointer-events:none"/>`)});s+=gh.g}
  if(calib){calib.forEach(p=>s+=`<circle class="calpt" cx="${p[0]}" cy="${p[1]}" r="${fs(5)}"/>`);if(calib.length===2)s+=`<line class="calln" x1="${calib[0][0]}" y1="${calib[0][1]}" x2="${calib[1][0]}" y2="${calib[1][1]}"/>`}
  return s;
}

/* ================= drop files / library ================= */
const mainEl=$('#main');let dragDepth=0;
mainEl.addEventListener('dragenter',e=>{if([...e.dataTransfer.types].includes('Files')){dragDepth++;$('#drop').hidden=false}});
mainEl.addEventListener('dragleave',e=>{if([...e.dataTransfer.types].includes('Files')){dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('#drop').hidden=true}});
mainEl.addEventListener('dragover',e=>{e.preventDefault()});
mainEl.addEventListener('drop',async e=>{e.preventDefault();dragDepth=0;$('#drop').hidden=true;
  const li=e.dataTransfer.getData('text/osk-lib');
  if(li!==''){const l=LIB[+li];if(!l)return;if(l.missing)return toast('This set uses items that are not in the library.');const w=toWorld(e);const keep=[placeLib,placeRot];placeLib=l;placeRot=0;const gh=ghostAt(w,e.altKey);placeLib=keep[0];placeRot=keep[1];addObjs(gh.objs,true);showTab('sel');return}
  const f=e.dataTransfer.files[0];if(!f)return;
  if(/\.json$/i.test(f.name))openPlanText(await f.text(),null,f.name);
  else if(/\.csv$/i.test(f.name))importLib(await f.text(),f.name);
  else loadUnderFile(f);
});

/* ================= edit commands ================= */
/* turn one object about a point; used to rotate a selection and to turn the whole plan */
function turnObj(o,cx,cy,deg){const n=d=>((d%360)+360)%360;
  if(o.t==='item'){const p=rotPt(o.x,o.y,cx,cy,deg);o.x=Math.round(p[0]);o.y=Math.round(p[1]);o.r=+n((o.r||0)+deg).toFixed(3)}
  else if(o.t==='text'){const p=rotPt(o.x,o.y,cx,cy,deg);o.x=p[0];o.y=p[1];o.r=+n((o.r||0)+deg).toFixed(3);if(!o.r)delete o.r}
  else if(o.t==='room'||o.t==='wall')o.pts=o.pts.map(p=>rotPt(p[0],p[1],cx,cy,deg).map(Math.round));
  else if(o.t==='dim'){o.a=rotPt(o.a[0],o.a[1],cx,cy,deg);o.b=rotPt(o.b[0],o.b[1],cx,cy,deg)}
  else if(o.t==='trunk')o.pts=o.pts.map(p=>rotPt(p[0],p[1],cx,cy,deg))}
/* Design axes: turn the whole plan (every floor, the roof, pins, the section line and the drawing underneath) so that a building which sits at an angle on its site is drawn square to the screen. North turns with it, and the building's angle on the campus turns back by the same amount, so true north and the site layout are unchanged: only the working axes move */
function turnPlan(deg,quiet){deg=((deg+180)%360+360)%360-180;if(!deg||!isFinite(deg))return false;leaveRoof();checkpoint();syncFloorOut(S);const b=S.bld;
  /* only finite corners count: one damaged object must not send every other one to NaN */const pts=[];S.objs.forEach(o=>{const q=objBox(o);if([q.x0,q.y0,q.x1,q.y1].every(isFinite))pts.push([q.x0,q.y0],[q.x1,q.y1])});const u=S.underlay;if(!pts.length&&u&&u.src)pts.push([u.x,u.y],[u.x+u.w*u.mpp,u.y+u.h*u.mpp]);const bb=pts.length?bboxPts(pts):{x0:0,y0:0,x1:0,y1:0},cx=Math.round((bb.x0+bb.x1)/2),cy=Math.round((bb.y0+bb.y1)/2);
  [b.typical,b.cores,b.roofFit].concat(b.levels.map(l=>l.base),b.levels.map(l=>l.fit)).forEach(a=>{if(Array.isArray(a))a.forEach(o=>turnObj(o,cx,cy,deg))});syncFloorIn(S);
  (S.pins||[]).forEach(p=>{const q=rotPt(p.x,p.y,cx,cy,deg);p.x=q[0];p.y=q[1]});(S.guides||[]).forEach(g=>{g.a=rotPt(g.a[0],g.a[1],cx,cy,deg);g.b=rotPt(g.b[0],g.b[1],cx,cy,deg)});if(S.section&&S.section.a&&S.section.b){S.section.a=rotPt(S.section.a[0],S.section.a[1],cx,cy,deg);S.section.b=rotPt(S.section.b[0],S.section.b[1],cx,cy,deg)}
  if(u){const w=u.w*u.mpp,h=u.h*u.mpp,c=rotPt(u.x+w/2,u.y+h/2,cx,cy,deg);u.x=c[0]-w/2;u.y=c[1]-h/2;u.rot=+((((u.rot||0)+deg)%360+360)%360).toFixed(3);if(!u.rot)delete u.rot}
  S.north=+(((num(S.north,0)+deg)%360+360)%360).toFixed(3);
  if(S.site){const r0=(S.site.r||0),r1=r0-deg,R=(a,x,y)=>{const t=a*Math.PI/180,c=Math.cos(t),n=Math.sin(t);return[x*c-y*n,x*n+y*c]},p0=R(r0,cx,cy),p1=R(r1,cx,cy);S.site=Object.assign({},S.site,{r:+(((r1%360)+360)%360).toFixed(3),x:Math.round((S.site.x||0)+p0[0]-p1[0]),y:Math.round((S.site.y||0)+p0[1]-p1[1])})}
  const ax=+(((num(S.axes,0)+deg+180)%360+360)%360-180).toFixed(3);if(ax)S.axes=ax;else delete S.axes;
  sel.clear();clashDirty=true;markDirty();try{syncUnder();drawNorth();if(SUN.on)applySun();campusUI()}catch(e){}fit();if(is3D)build3D();renderInspector();axesUI();
  if(!quiet)toast(`Plan turned ${+Math.abs(deg).toFixed(2)}° ${deg>0?'clockwise':'anticlockwise'}. North and the campus position turned with it, so nothing has moved on site`);return true}
/* the angle that makes the wall or room edge nearest a point level or upright, by the smaller turn */
function axesFromPoint(w,tol){let best=null;S.objs.forEach(o=>{if((o.t!=='wall'&&o.t!=='room')||!o.pts||!visible(o))return;const P=o.pts,n=o.t==='room'?P.length:P.length-1;for(let i=0;i<n;i++){const a=P[i],c=P[(i+1)%P.length],vx=c[0]-a[0],vy=c[1]-a[1],L=vx*vx+vy*vy;if(L<250000)continue;const t=Math.max(0,Math.min(1,((w[0]-a[0])*vx+(w[1]-a[1])*vy)/L)),d=Math.hypot(w[0]-(a[0]+vx*t),w[1]-(a[1]+vy*t));if(d<=tol&&(!best||d<best.d))best={d,ang:Math.atan2(vy,vx)*180/Math.PI,a,b:c}}});
  if(!best)return null;let t=((best.ang%90)+90)%90;if(t>45)t-=90;return{turn:+(-t).toFixed(3),a:best.a,b:best.b}}
let axesPick=false;
function axesUI(){const m=$('#axes-modal');if(!m||m.hidden)return;const ax=num(S.axes,0);$('#axes-now').textContent=ax?`This plan is turned ${+Math.abs(ax).toFixed(2)}° ${ax>0?'clockwise':'anticlockwise'} from how it was first drawn.`:'This plan has not been turned.';$('#axes-reset').disabled=!ax}
function axesOpen(){const m=$('#axes-modal');m.hidden=false;axesUI();const f=$('#axes-deg');if(f){f.value='';f.focus()}}
function axesPickStart(){$('#axes-modal').hidden=true;if(is3D)set3D(false);setTool('select');axesPick=true;toast('Click a wall or the edge of a room. The plan turns so that edge is level or upright. Esc cancels')}
/* on-canvas rotate handle: a round grip just past the top of the selection. Dragging it turns the selection about its centre in 15° steps (Alt turns freely); right after, typing an angle and pressing Enter sets the exact turn, as in SketchUp */
let rotLast=null,rotTyped='';
function rotList(){return selList().filter(o=>!fixed(o))}
function rotGrip(list){if(drag&&drag.m==='rot'){const p=rotPt(drag.h0[0],drag.h0[1],drag.cx,drag.cy,drag.deg);return{cx:drag.cx,cy:drag.cy,hx:p[0],hy:p[1],ex:drag.e0[0],ey:drag.e0[1],deg:drag.deg}}
  const g=fs(30);if(list.length===1&&list[0].t==='item'){const o=list[0],a=(o.r||0)*Math.PI/180,L=o.d/2+g,e=o.d/2;return{cx:o.x,cy:o.y,hx:o.x+Math.sin(a)*L,hy:o.y-Math.cos(a)*L,ex:o.x+Math.sin(a)*e,ey:o.y-Math.cos(a)*e}}
  const b=unionBox(list);if(!b||![b.x0,b.y0,b.x1,b.y1].every(isFinite))return null;const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;return{cx,cy,hx:cx,hy:b.y0-g,ex:cx,ey:b.y0}}
function rotGripSVG(list){if(S.locked||tool!=='select'||!list.length)return'';if(list.length===1&&isCCTV(list[0]))return'';const g=rotGrip(list);if(!g)return'';const r=fs(9),q=fs(5),hx=g.hx,hy=g.hy;
  let s=`<line class="rotl" x1="${g.ex}" y1="${g.ey}" x2="${hx}" y2="${hy}"/><g class="roth" data-roth="1"><circle class="hit" cx="${hx}" cy="${hy}" r="${fs(18)}"/><circle cx="${hx}" cy="${hy}" r="${r}"/><path d="M${hx+q} ${hy}A${q} ${q} 0 1 1 ${hx} ${hy-q}" fill="none"/><path d="M${hx-fs(2.2)} ${hy-q-fs(2.2)}L${hx+fs(.6)} ${hy-q}L${hx-fs(2.2)} ${hy-q+fs(2.2)}" fill="none"/><title>Drag to rotate · 15° steps, hold Alt to turn freely · double-click for an exact angle</title></g>`;
  if(drag&&drag.m==='rot'){s+=`<circle class="rotc" cx="${g.cx}" cy="${g.cy}" r="${fs(3)}"/><text class="dimtx" font-size="${fs(12)}" stroke-width="${fs(3)}" x="${hx}" y="${hy-fs(16)}" text-anchor="middle">${+g.deg.toFixed(1)}°</text>`}
  return s}
function rotRestore(orig){orig.forEach(([o,c])=>{Object.keys(o).forEach(k=>{if(!(k in c))delete o[k]});Object.assign(o,clone(c))})}
function rotSig(ids){return JSON.stringify(ids.map(byId))}
function rotTypedOK(){if(!rotLast)return false;if(tool!=='select'||sel.size!==rotLast.sel.length||rotLast.sel.some(id=>!sel.has(id))||rotSig(rotLast.ids)!==rotLast.sig){rotLast=null;rotTyped='';return false}return true}
function rotApplyTyped(){const v=parseFloat(rotTyped);rotTyped='';if(!isFinite(v)||Math.abs(v)>360){toast('Type an angle between -360 and 360. A minus sign turns anticlockwise');updateHint();return}
  checkpoint();rotRestore(rotLast.orig);if(v)rotLast.orig.forEach(([o])=>turnObj(o,rotLast.cx,rotLast.cy,v));rotLast.deg=v;rotLast.sig=rotSig(rotLast.ids);clashDirty=true;markDirty();render();renderInspector();updateHint();toast(`Turned ${Math.abs(v)}° ${v>=0?'clockwise':'anticlockwise'}`)}
/* angle box beside the grip: shown after a turn, or on a double-click (double-tap) of the grip; works without a keyboard */
let rotChip=null;
function rotChipHide(){if(rotChip)rotChip.hidden=true}
function rotChipShow(){if(!rotLast)return;const list=rotList();const g=rotGrip(list);if(!g)return rotChipHide();
  if(!rotChip){rotChip=document.createElement('div');rotChip.id='rot-chip';rotChip.innerHTML='<label>Angle <input type="text" inputmode="decimal" aria-label="Exact angle in degrees, minus for anticlockwise" autocomplete="off"></label>°<button class="btn sm primary" type="button">Turn</button><button class="btn sm ghost icon" type="button" data-x aria-label="Close">✕</button>';(svg.parentElement||document.body).appendChild(rotChip);
    const inp=rotChip.querySelector('input'),go=()=>{rotTyped=String(inp.value).replace(/[°\s]/g,'');if(!rotTyped)return;if(!rotTypedOK()){rotChipHide();return}rotApplyTyped();rotChipShow();inp.select()};
    rotChip.querySelector('.primary').addEventListener('click',go);rotChip.querySelector('[data-x]').addEventListener('click',()=>{rotChipHide();svg.focus&&svg.focus()});
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();go()}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();rotChipHide()}})}
  const pb=svg.getBoundingClientRect(),hb=(svg.parentElement||document.body).getBoundingClientRect(),x=pb.left-hb.left+(g.hx-V.x)*V.k,y=pb.top-hb.top+(g.hy-V.y)*V.k;
  rotChip.style.left=Math.max(4,Math.min(hb.width-230,x+18))+'px';rotChip.style.top=Math.max(4,Math.min(hb.height-48,y-18))+'px';rotChip.hidden=false;const inp=rotChip.querySelector('input');inp.value=+(+rotLast.deg||0).toFixed(1);if(!PHONE())setTimeout(()=>{inp.focus();inp.select()},0)}
function rotStartLast(){const base=rotList();const g=base.length&&rotGrip(base);if(!g)return false;const list=base.concat(carried(base));rotLast={ids:list.map(o=>o.id),sel:[...sel],orig:list.map(o=>[o,clone(o)]),cx:g.cx,cy:g.cy,deg:0,sig:rotSig(list.map(o=>o.id))};return true}
/* the grip is redrawn between the two presses, so a double press is timed here rather than left to the browser's dblclick */
let rotGripDown=0;
function rotGripDouble(){const t=Date.now(),d=t-rotGripDown<450;rotGripDown=d?0:t;if(!d)return false;if(!rotTypedOK())rotStartLast();rotChipShow();return true}
function rotateSel(deg){
  if(tool==='place'){placeRot=(placeRot+deg+360)%360;drawOverlay();if(is3D&&placeLib)ghost3D(ghostAt(lastW).objs);return}
  let list=selList().filter(o=>!fixed(o));if(!list.length)return;const b=unionBox(list);list=list.concat(carried(list));
  checkpoint();const cx=snapV((b.x0+b.x1)/2),cy=snapV((b.y0+b.y1)/2);
  list.forEach(o=>{turnObj(o,cx,cy,deg);
  });clashDirty=true;render();renderInspector();
}
/* Delete: the section line, else the selected pin, else the selection */
function deleteAction(){if(secSel&&S.section){checkpoint();S.section=undefined;secSel=false;if(is3D){sectionApply();sectionBar()}render();renderInspector();toast('Section deleted');return}
  if(pinSel){checkpoint();S.pins=(S.pins||[]).filter(p=>p.id!==pinSel);pinSel=null;markDirty();render();renderInspector();if(!$('#p-notes').hidden)renderNotes();toast('Pin deleted');return}
  if(!sel.size)return;deleteSel();toast('Deleted')}
function deleteSel(kit){if(!sel.size)return;checkpoint();const l=selList(),gone=new Set(sel);if(kit)roomKit(l).forEach(o=>gone.add(o.id));const rooms=new Set(l.filter(o=>o.t==='room').map(o=>o.id));/* deleting a room deletes only the room: what stood in it stays, as free items no longer tied to a template */S.objs=S.objs.filter(o=>!gone.has(o.id));S.objs.forEach(o=>{if(o.tp&&rooms.has(o.tp))delete o.tp});sel.clear();clashDirty=true;render();renderInspector()}
let clip=null,pasteN=0;
function copySel(){let l=selList();if(!l.length)return false;l=l.concat(roomKit(l));clip=clone(l);pasteN=0;store.set('osk-clip',JSON.stringify(clip));toast(`Copied ${l.length} ${l.length===1?'object':'objects'}`);return true}
function pasteClip(atCursor){
  let c=clip;if(!c){try{c=JSON.parse(store.get('osk-clip')||'null')}catch(e){}}
  if(Array.isArray(c)){const seen=new Set();c=c.map(o=>normObj(o,seen)).filter(o=>o&&o!=='unknown')}
  if(!c||!c.length)return toast('Nothing to paste');
  const b=unionBox(c);let dx,dy;
  const inView=lastW[0]>V.x&&lastW[0]<V.x+W/V.k&&lastW[1]>V.y&&lastW[1]<V.y+H/V.k;
  if(atCursor&&inView){dx=snapV(lastW[0]-(b.x0+b.x1)/2);dy=snapV(lastW[1]-(b.y0+b.y1)/2)}else{pasteN++;dx=dy=500*pasteN}
  const gmap={};const out=c.map(o=>{const n=clone(o);n.id=uid();if(n.arr)delete n.arr;if(n.gid){gmap[n.gid]=gmap[n.gid]||uid();n.gid=gmap[n.gid]}moveObj(n,o,dx,dy);return n});tpFix(c.map((o,i)=>[o,out[i]]));
  addObjs(out,true);
}
function duplicateSel(){let l=selList();if(!l.length)return;l=l.concat(roomKit(l));const keep=clip;clip=clone(l);pasteN=0;pasteClip(false);clip=keep}
function groupSel(){const l=selList();if(l.length<2)return toast('Select two or more objects to group');checkpoint();const g=uid();l.forEach(o=>o.gid=g);render();renderInspector();toast('Grouped')}
function ungroupSel(){const l=selList();if(!l.some(o=>o.gid))return;checkpoint();l.forEach(o=>o.gid=null);render();renderInspector();toast('Ungrouped')}
/* a room takes what stands in it: moving or turning a room moves the furniture inside its outline (and anything a template put there). Doors and windows already follow their wall. Hold nothing extra: select the furniture itself to move it alone */
function carried(list,any){const have=new Set(list.map(o=>o.id)),out=[];list.forEach(r=>{if(r.t!=='room'||(!any&&fixed(r))||!r.pts)return;S.objs.forEach(o=>{if(o.t!=='item'||have.has(o.id)||isOpening(o)||!visible(o))return;if(o.tp===r.id||pointInPoly(o.x,o.y,r.pts)){have.add(o.id);out.push(o)}})});return out}
/* everything that belongs to the rooms in a list: the furniture inside them, what a template put there, and the doors and windows on their outline. Used by copy, cut and duplicate, so a room always arrives with its contents */
function roomKit(list){const have=new Set(list.map(o=>o.id)),out=carried(list,true);out.forEach(o=>have.add(o.id));
  list.forEach(r=>{if(r.t!=='room'||!r.pts)return;const P=r.pts,n=P.length;S.objs.forEach(o=>{if(have.has(o.id)||!isOpening(o)||!visible(o))return;const reach=Math.max(250,(o.d||0)/2+150);for(let i=0;i<n;i++){const a=P[i],b=P[(i+1)%n],vx=b[0]-a[0],vy=b[1]-a[1],L=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,((o.x-a[0])*vx+(o.y-a[1])*vy)/L));if(Math.hypot(o.x-(a[0]+vx*t),o.y-(a[1]+vy*t))<=reach){have.add(o.id);out.push(o);break}}})});return out}
function nudge(dx,dy){let l=selList().filter(o=>!fixed(o));if(!l.length)return;l=l.concat(carried(l));checkpoint();const orig=l.map(o=>[o.id,clone(o)]);l.forEach(o=>moveObj(o,clone(o),dx,dy));seatWindows(orig,dx,dy);clashDirty=true;render();renderInspector()}
function alignSel(how){
  const l=selList();if(l.length<2)return;checkpoint();const B=unionBox(l);
  if(how==='dh'||how==='dv'){const ax=how==='dh';const s=l.map(o=>({o,b:objBox(o)})).sort((p,q)=>ax?p.b.x0-q.b.x0:p.b.y0-q.b.y0);const tot=s.reduce((a,p)=>a+(ax?p.b.x1-p.b.x0:p.b.y1-p.b.y0),0);const gap=((ax?B.x1-B.x0:B.y1-B.y0)-tot)/(s.length-1);let pos=ax?B.x0:B.y0;s.forEach(p=>{const d=pos-(ax?p.b.x0:p.b.y0);moveObj(p.o,clone(p.o),ax?d:0,ax?0:d);pos+=(ax?p.b.x1-p.b.x0:p.b.y1-p.b.y0)+gap})}
  else l.forEach(o=>{const b=objBox(o);let dx=0,dy=0;if(how==='l')dx=B.x0-b.x0;if(how==='r')dx=B.x1-b.x1;if(how==='c')dx=(B.x0+B.x1)/2-(b.x0+b.x1)/2;if(how==='t')dy=B.y0-b.y0;if(how==='b')dy=B.y1-b.y1;if(how==='m')dy=(B.y0+B.y1)/2-(b.y0+b.y1)/2;moveObj(o,clone(o),dx,dy)});
  clashDirty=true;render();renderInspector();
}
/* build or rebuild a parametric array from a template; members carry o.arr so the array can be edited later */
function buildArray(template,def,arrId){
  arrId=arrId||uid();
  const w=Math.max(1,def.w),d=Math.max(1,def.d),rows=Math.max(1,def.rows|0),cols=Math.max(1,def.cols|0);
  const px=w+def.gx,py=d+def.gy,out=[];
  if(def.set&&Array.isArray(template)){/* a set array: template is the members of one cell, each with its offset from the cell corner */
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const gm={};template.forEach(t=>{const n=clone(t);n.id=uid();if(t.gid){gm[t.gid]=gm[t.gid]||uid();n.gid=gm[t.gid]}const off=(t.arr&&t.arr.off)||[0,0];
      n.x=Math.round(def.ox+off[0]+c*px);n.y=Math.round(def.oy+off[1]+r*py);n.arr={id:arrId,rows,cols,gx:def.gx,gy:def.gy,w,d,ox:def.ox,oy:def.oy,r:0,set:template.length,cell:[r,c],off:off.slice()};out.push(n)})}
    return out}
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const n=clone(template);n.id=uid();n.w=w;n.d=d;n.x=Math.round(def.ox+c*px);n.y=Math.round(def.oy+r*py);n.gid=null;
    n.arr={id:arrId,rows,cols,gx:def.gx,gy:def.gy,w,d,ox:def.ox,oy:def.oy,r:template.r||0};out.push(n)}
  return out;
}
function makeColArray(base,rows,cols,gx,gy){
  checkpoint();const tmpl=clone(base);const def={rows,cols,gx,gy,w:base.w,d:base.d,ox:base.x,oy:base.y};
  S.objs=S.objs.filter(o=>o.id!==base.id);const out=buildArray(tmpl,def);out.forEach(o=>S.objs.push(o));
  clashDirty=true;sel=new Set(out.map(o=>o.id));render();renderInspector();toast(`Array of ${out.length} created — edit it any time in Details`);
}
function editArray(member,changes){
  const arrId=member.arr.id;const mem=S.objs.filter(o=>o.arr&&o.arr.id===arrId);
  /* anchor at the current top-left cell centre so a moved array stays put */
  let ox=Infinity,oy=Infinity;const isSet=!!member.arr.set;
  mem.forEach(o=>{const off=isSet&&o.arr.off?o.arr.off:[0,0];if(o.x-off[0]<ox)ox=o.x-off[0];if(o.y-off[1]<oy)oy=o.y-off[1]});if(!isFinite(ox)){ox=member.arr.ox;oy=member.arr.oy}
  const def=Object.assign({},member.arr,{ox,oy},changes);if(isSet){def.w=member.arr.w;def.d=member.arr.d}
  /* a set array rebuilds every cell from the members of the member's own cell, so edits made to that cell carry over */
  let tmpl;if(isSet){const cell=member.arr.cell||[0,0];tmpl=mem.filter(o=>o.arr.cell&&o.arr.cell[0]===cell[0]&&o.arr.cell[1]===cell[1]).map(clone);if(!tmpl.length)tmpl=[clone(member)]}else tmpl=clone(member);
  checkpoint();const out=buildArray(tmpl,def,arrId);
  S.objs=S.objs.filter(o=>!(o.arr&&o.arr.id===arrId));out.forEach(o=>S.objs.push(o));
  /* keep the edited cell selected so the array editor stays open; the whole array is still one unit */
  const px=def.w+def.gx,py=def.d+def.gy;const off=isSet&&member.arr.off?member.arr.off:[0,0];const cr=Math.max(0,Math.min(def.rows-1,Math.round((member.y-off[1]-oy)/py))),cc=Math.max(0,Math.min(def.cols-1,Math.round((member.x-off[0]-ox)/px)));
  const keep=out.find(o=>isSet?(o.arr.cell[0]===cr&&o.arr.cell[1]===cc&&o.code===member.code):(Math.round((o.y-oy)/py)===cr&&Math.round((o.x-ox)/px)===cc))||out[0];
  clashDirty=true;sel=new Set([keep.id]);markDirty();render();if(is3D)build3D();renderInspector();
}
function arrEditRow(o){const a=o.arr;const set=!!a.set;return `<div class="sec">${set?'Set array':'Array'} (${a.rows}×${a.cols})</div><p class="muted">${set?`Edit the whole array. Each cell is a set of ${a.set} items, ${r1(a.w)} × ${r1(a.d)} mm.`:`Edit the whole array. Each cell is ${r1(a.w)} × ${r1(a.d)} mm.`}</p><div class="fld"><label>Rows<input type="number" min="1" data-arrf="rows" value="${a.rows}"></label><label>Columns<input type="number" min="1" data-arrf="cols" value="${a.cols}"></label><label>Gap down (mm)<input type="number" data-arrf="gy" value="${r1(a.gy)}"></label><label>Gap across (mm)<input type="number" data-arrf="gx" value="${r1(a.gx)}"></label>${set?'':`<label>Cell width (mm)<input type="number" data-arrf="w" value="${r1(a.w)}"></label><label>Cell depth (mm)<input type="number" data-arrf="d" value="${r1(a.d)}"></label>`}</div><p class="muted">${set?'Changes rebuild every cell from this one, so edit one set first and the rest follow.':'Changes rebuild the whole array from its top-left corner.'}</p>`}
function arraySel(rows,cols,gx,gy,group){
  const l=selList();if(!l.length)return;rows=Math.max(1,rows|0);cols=Math.max(1,cols|0);if(rows*cols<2)return toast('Set more than one row or column');if(rows*cols>2000)return toast('That is more than 2,000 copies');
  if(l.length===1&&!l[0].arr){makeColArray(l[0],rows,cols,gx,gy);return;}
  const b=unionBox(l),px=b.x1-b.x0+gx,py=b.y1-b.y0+gy;const out=[];const g=group?uid():null;
  if(group)l.forEach(o=>o.gid=g);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(!r&&!c)continue;const gmap={},pr=[];l.forEach(o=>{const n=clone(o);n.id=uid();if(group)n.gid=g;else if(n.gid){gmap[n.gid]=gmap[n.gid]||uid();n.gid=gmap[n.gid]}moveObj(n,o,c*px,r*py);out.push(n);pr.push([o,n])});tpFix(pr)}
  addObjs(out,false);sel=new Set(l.map(o=>o.id).concat(out.map(o=>o.id)));render();renderInspector();toast(`Added ${out.length} copies`);
}

/* ================= inspector ================= */
const panes={sel:'#p-sel',sch:'#p-sch',und:'#p-und',bld:'#p-bld',notes:'#p-notes',fire:'#p-fire',secz:'#p-secz'};
const PHONE=()=>matchMedia('(max-width:820px), (pointer:coarse) and (max-height:500px)').matches;
function openInsp(){if(!P.insp){P.insp=true;if(W<1100)P.lib=false;savePrefs();applyDrawers()}}
function showTab(t,explicit){if(!P.insp&&(explicit||!PHONE()))openInsp();Object.entries(panes).forEach(([k,s])=>{$(s).hidden=k!==t;/* Security is part of Checks, so Checks stays lit while it is open */$('#tab-'+k).classList.toggle('on',k===t||(k==='fire'&&t==='secz'))});{const tb=$('#tab-'+t);if(tb&&tb.scrollIntoView)try{tb.scrollIntoView({inline:'nearest',block:'nearest'})}catch(e){}}if(t==='sch')renderSchedule();if(t==='und')renderUnderPanel();if(t==='sel')renderInspector();if(t==='bld')renderBldPanel();if(t==='notes')renderNotes();if(t==='fire')renderFire();if(t==='secz')renderSecz()}
$$('.tabs [data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
/* the Details tab row scrolls sideways: arrows at the ends when it overflows, the mouse wheel scrolls it, and the open tab is kept in view */
{const tb=$('#d-insp .tabs');if(tb){const w=document.createElement('div');w.className='tabsw';tb.parentNode.insertBefore(w,tb);
  const mk=(c,l,t)=>{const b=document.createElement('button');b.type='button';b.className='tabs-arr '+c;b.setAttribute('aria-label',l);b.innerHTML=t;b.hidden=true;return b};
  const L=mk('l','Scroll tabs left','‹'),Rt=mk('r','Scroll tabs right','›');w.append(L,tb,Rt);
  const upd=()=>{const o=tb.scrollWidth>tb.clientWidth+2;w.classList.toggle('ovf',o);L.hidden=!o||tb.scrollLeft<4;Rt.hidden=!o||tb.scrollLeft+tb.clientWidth>=tb.scrollWidth-4};
  tb.addEventListener('scroll',upd,{passive:true});try{new ResizeObserver(upd).observe(tb)}catch(e){addEventListener('resize',upd)}
  const go=d=>{try{tb.scrollBy({left:d*Math.max(110,tb.clientWidth*0.6),behavior:'smooth'})}catch(e){tb.scrollLeft+=d*120}};L.addEventListener('click',()=>go(-1));Rt.addEventListener('click',()=>go(1));
  tb.addEventListener('wheel',e=>{if(tb.scrollWidth<=tb.clientWidth)return;const d=Math.abs(e.deltaY)>Math.abs(e.deltaX)?e.deltaY:e.deltaX;if(!d)return;tb.scrollLeft+=d;e.preventDefault()},{passive:false});upd()}}

/* open the Notes tab on a pin and put the cursor in its comment (double-tap a pin, or drop a new one) */
function openPin(id){pinSel=id;secSel=false;sel.clear();render();renderInspector();showTab('notes',true);renderNotes();
  /* the sheet may re-render once more while it opens, which drops focus; focus now and again a moment later */
  const foc=()=>{const ta=$(`#p-notes textarea[data-pintext="${id}"]`);if(ta&&document.activeElement!==ta){ta.closest('.pin-item').scrollIntoView({block:'nearest'});ta.focus()}};clearTimeout(pinFocT[0]);clearTimeout(pinFocT[1]);pinFocT=[setTimeout(foc,60),setTimeout(foc,320)]}
/* a key or press after the pin opens cancels the late focus retry, so it never grabs focus from what the user did next */
let pinFocT=[];['keydown','pointerdown'].forEach(t=>document.addEventListener(t,e=>{if(pinFocT.length&&!(e.target.closest&&e.target.closest('[data-pin],#p-notes'))){clearTimeout(pinFocT[0]);clearTimeout(pinFocT[1]);pinFocT=[]}},true));
/* ---- review: pinned comments with a number that never changes, who raised them and when, resolve, replies, a filter and an export ---- */
function pinNo(p){return p.no||((S.pins||[]).indexOf(p)+1)}
function newPin(x,y){S.pins=S.pins||[];const no=S.pins.reduce((m,p)=>Math.max(m,pinNo(p)),0)+1;return{id:uid(),x,y,text:'',done:false,lv:(S.bld?bldLevel(S).id:null),no,by:P.me||'',at:new Date().toISOString()}}
const dstr=t=>{const d=new Date(t);return isNaN(d)?'':d.toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'})};
function revPins(){const allF=!!P.revAll&&!!S.bld;return allF?(S.pins||[]):visPins()}
function renderNotes(){const el=$('#p-notes');if(!el)return;if(el.contains(document.activeElement)&&/^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName))return;
  const nm=S.bld?levelNames(S.bld):null,cl=curLv(),f=['open','done','all'].includes(P.revF)?P.revF:'all',allF=!!P.revAll&&!!S.bld,base=revPins();
  const ps=base.filter(p=>f==='all'||(f==='open'?!p.done:!!p.done)),nO=base.filter(p=>!p.done).length,nR=base.length-nO;
  let h=`<div class="sec" style="margin-top:0">Review${S.bld&&!allF?` · ${nm[cl]}`:''}</div>
  <div class="fld"><label>Your name, shown on comments<input type="text" id="rev-me" value="${esc(P.me||'')}" placeholder="e.g. Jeff, BI" autocomplete="name"></label><span></span></div>
  <div class="rev-bar"><div class="seg" role="group" aria-label="Show comments">${[['open',`Open ${nO}`],['done',`Resolved ${nR}`],['all',`All ${base.length}`]].map(([k,n])=>`<button type="button" class="btn sm${f===k?' on':''}" data-revf="${k}" aria-pressed="${f===k}">${n}</button>`).join('')}</div>${S.bld?`<label class="muted rev-all"><input type="checkbox" id="rev-all"${allF?' checked':''}> All floors</label>`:''}</div>
  <div class="row"><button class="btn sm" type="button" data-rev="csv">Export review</button><button class="btn sm" type="button" data-rev="copy">Copy for Excel</button></div>`;
  if(!base.length)h+=`<p class="muted">Use the <b>Pin</b> tool, then click the plan to drop a review comment where it belongs${S.bld&&!allF?' on this floor':''}. Each pin keeps its number, who raised it and when.</p>`;
  else if(!ps.length)h+=`<p class="muted">No ${f==='open'?'open':'resolved'} comments.</p>`;
  else h+=ps.map(p=>`<div class="pin-item${p.done?' done':''}${pinSel===p.id?' sel':''}"><div class="pin-hd"><span class="pin-no">${p.done?'✓':pinNo(p)}</span><label class="muted" style="font-size:12px;display:flex;gap:5px;align-items:center"><input type="checkbox" data-pindone="${p.id}"${p.done?' checked':''} style="width:auto"> Resolved</label><span style="flex:1"></span><button class="btn sm" type="button" data-pingo="${p.id}">Locate</button><button class="btn sm ghost" type="button" data-pindel="${p.id}">Delete</button></div>
    <div class="pin-meta muted">#${pinNo(p)}${allF&&nm&&p.lv?` · ${esc(nm[p.lv]||'')}`:''}${p.by?` · ${esc(p.by)}`:''}${p.at?` · ${dstr(p.at)}`:''}${p.done&&p.doneAt?` · resolved${p.doneBy?' by '+esc(p.doneBy):''} ${dstr(p.doneAt)}`:''}</div>
    <textarea data-pintext="${p.id}" data-keepfocus placeholder="What needs checking or fixing here…">${esc(p.text||'')}</textarea>
    ${(p.replies||[]).map(r=>`<div class="pin-rep"><b>${esc(r.by||'Reply')}</b> <span class="muted">${dstr(r.at)}</span><div>${esc(r.text)}</div></div>`).join('')}
    <div class="pin-reply"><input type="text" data-pinrep="${p.id}" placeholder="Reply…" aria-label="Reply to comment ${pinNo(p)}"><button class="btn sm" type="button" data-pinrepgo="${p.id}">Reply</button></div></div>`).join('');
  h+=`<div class="sec">Notes for this plan</div><textarea id="plan-notes" class="notes-ta" placeholder="Design notes, assumptions, to-dos, references for this plan...">${esc(S.notes||'')}</textarea><p class="muted">Saved with the plan and in the .json file.</p>`;
  el.innerHTML=h}
function reviewRows(){const nm=S.bld?levelNames(S.bld):null;const rows=[['Plan',S.name],['Exported',new Date().toLocaleString('en-SG')],[],['No','Floor','Status','Comment','Raised by','Raised on','Resolved by','Resolved on','Replies','X mm','Y mm']];
  (S.pins||[]).slice().sort((a,b)=>pinNo(a)-pinNo(b)).forEach(p=>rows.push([pinNo(p),nm&&p.lv?nm[p.lv]||'':'',p.done?'Resolved':'Open',p.text||'',p.by||'',p.at?dstr(p.at):'',p.doneBy||'',p.doneAt?dstr(p.doneAt):'',(p.replies||[]).map(r=>`${r.by||'Reply'} (${dstr(r.at)}): ${r.text}`).join(' | '),Math.round(p.x),Math.round(p.y)]));return rows}
function addReply(id){const inp=$(`#p-notes [data-pinrep="${id}"]`),t=inp&&inp.value.trim();const p=(S.pins||[]).find(x=>x.id===id);if(!t||!p)return;checkpoint();p.replies=(p.replies||[]).concat([{by:P.me||'',at:new Date().toISOString(),text:t}]);markDirty();inp.value='';inp.blur();renderNotes()}
$('#p-notes').addEventListener('input',e=>{if(e.target.id==='plan-notes'){S.notes=e.target.value;markDirty();return}if(e.target.id==='rev-me'){P.me=e.target.value.trim();savePrefs();return}const pt=e.target.dataset.pintext;if(pt){const p=(S.pins||[]).find(x=>x.id===pt);if(p){p.text=e.target.value;markDirty()}}});
$('#p-notes').addEventListener('change',e=>{const pd=e.target.dataset.pindone;if(pd){const p=(S.pins||[]).find(x=>x.id===pd);if(p){checkpoint();p.done=e.target.checked;if(p.done){p.doneAt=new Date().toISOString();p.doneBy=P.me||''}else{delete p.doneAt;delete p.doneBy}markDirty();render();renderNotes()}return}
  if(e.target.id==='rev-all'){P.revAll=e.target.checked;savePrefs();e.target.blur();renderNotes();render()}});
$('#p-notes').addEventListener('keydown',e=>{const r=e.target.dataset&&e.target.dataset.pinrep;if(r&&e.key==='Enter'){e.preventDefault();addReply(r)}});
$('#p-notes').addEventListener('click',e=>{const go=e.target.closest('[data-pingo]'),del=e.target.closest('[data-pindel]'),rf=e.target.closest('[data-revf]'),rv=e.target.closest('[data-rev]'),rp=e.target.closest('[data-pinrepgo]');
  if(rf){P.revF=rf.dataset.revf;savePrefs();renderNotes();return}
  if(rp){addReply(rp.dataset.pinrepgo);return}
  if(rv){if(rv.dataset.rev==='csv')saveText((S.name||'plan').replace(/[\\/:*?"<>|]+/g,'-')+' review.csv','﻿'+toCSV(reviewRows()),'text/csv','.csv','CSV file').then(r=>{if(r)toast('Review exported')});else{const t=reviewRows().map(r=>r.join('\t')).join('\n');try{navigator.clipboard.writeText(t).then(()=>toast('Copied. Paste into Excel.'),()=>toast('Copy was blocked here. Use Export review.'))}catch(err){toast('Copy was blocked here. Use Export review.')}}return}
  if(go){const p=(S.pins||[]).find(x=>x.id===go.dataset.pingo);if(p){if(S.bld&&p.lv&&p.lv!==curLv())switchFloor(p.lv);pinSel=p.id;centerOn(p.x,p.y);render();renderNotes()}return}
  if(del){const id=del.dataset.pindel;checkpoint();S.pins=(S.pins||[]).filter(p=>p.id!==id);if(pinSel===id)pinSel=null;markDirty();render();renderNotes();return}});
const ICON={ccw:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 4v7h7"/></svg>',cw:'<svg class="ic" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>'};
/* plain-language help for the parameters in the Details panel, keyed by the label text (minus units) */
const PARAM_INFO={
  'floor to ceiling':'Clear height inside the room, from the finished floor up to the ceiling.',
  'ceiling void':'Hidden space above the ceiling for ducts, pipes and cabling.',
  'slab':'Thickness of the concrete floor slab for each storey.',
  'slab above':'Thickness of the concrete slab sitting on top of this floor.',
  'b1 to l1 slab':'Thickness of the slab between the first basement and the ground floor (L1).',
  'roof slab':'Thickness of the concrete roof slab at the top of the building.',
  'parapet':'Low wall running around the edge of the roof.',
  'floor to floor':'Total height of this storey, from one floor surface to the next. Equals floor to ceiling + ceiling void + slab above. Changing it adjusts the floor-to-ceiling height.',
  'ceiling':'Floor-to-ceiling height for this floor only. Blank uses the building default.',
  'void':'Ceiling void for this floor only. Blank uses the building default.',
  'width':'Side-to-side size of the object, in millimetres.',
  'depth':'Front-to-back size of the object, in millimetres.',
  'height':'Height of the object, in millimetres.',
  'angle':'Rotation on the plan, in degrees. 0 faces up.',
  'centre x':'Horizontal position of the object’s centre, in millimetres.',
  'centre y':'Vertical position of the object’s centre, in millimetres.',
  'label on plan':'Text shown on this item in the drawing. Blank uses its default name.',
  'seats':'Number of seats this item provides, counted in the schedule.',
  'unit rate':'Cost per unit, used to price the schedule. Optional.',
  'clear front':'Clearance to keep in front of the item, e.g. for a chair or access.',
  'clear back':'Clearance to keep behind the item.',
  'category':'Groups the item in the schedule and the library.',
  'code':'Short reference code for the item, shown in the schedule.',
  'leg width':'Width of the short leg of an L-shaped item.',
  'sill height':'Height of the window sill above the floor.',
  'glass height':'Height of the glass pane.',
  'drop below ceiling':'How far the item hangs below the ceiling.',
  'coverage radius':'Radius of the coverage circle drawn on the plan. 0 turns it off.',
  'facing':'Direction the camera points, in degrees.',
  'tilt down':'How far the camera tilts downward, in degrees.',
  'range':'How far the camera can see, in millimetres.',
  'field of view':'Width of the camera’s view angle, in degrees.',
  'height above slab':'Height of the raised floor above the structural slab.',
  'name':'Name of the room, shown on the plan and in schedules.',
  'thickness':'Thickness of the wall, in millimetres.',
  'length':'Length of the wall segment, in millimetres.',
  'size':'Text size, in millimetres.',
  'text':'The words shown on the label.',
  'entitlement':'Rank entitlement to compare the room area against (from the MIG).',
  'rows':'Number of rows in the array.',
  'columns':'Number of columns in the array.',
  'gap across':'Spacing between columns, in millimetres.',
  'gap down':'Spacing between rows, in millimetres.'
};
function addSteppers(root){if(!TOUCH||!root)return;root.querySelectorAll('label>input[type=number]').forEach(inp=>{const lb=inp.parentElement;if(lb.querySelector('.stp'))return;const st=document.createElement('span');st.className='stp';st.innerHTML='<button type="button" data-stp="-1" aria-label="Less">−</button><button type="button" data-stp="1" aria-label="More">+</button>';lb.appendChild(st);lb.classList.add('has-stp');stpSync(inp)})}
/* a stepper button at the field's limit is greyed out rather than silently doing nothing */
function stpSync(inp){const st=inp&&inp.parentElement&&inp.parentElement.querySelector('.stp');if(!st)return;const cur=inp.value===''?(+inp.placeholder||0):(+inp.value||0);
  const lo=st.querySelector('[data-stp="-1"]'),hi=st.querySelector('[data-stp="1"]');lo.disabled=inp.disabled||(inp.min!==''&&cur<=+inp.min);hi.disabled=inp.disabled||(inp.max!==''&&cur>=+inp.max)}
document.addEventListener('input',e=>{if(e.target&&e.target.matches&&e.target.matches('label.has-stp>input[type=number]'))stpSync(e.target)},true);
document.addEventListener('click',e=>{const b=e.target.closest('[data-stp]');if(!b)return;const lb=b.closest('label'),inp=lb&&lb.querySelector('input[type=number]');if(!inp)return;
  let txt='';inp.parentElement.childNodes.forEach(n=>{if(n.nodeType===3)txt+=n.textContent});const deg=/°/.test(txt),step=inp.step&&+inp.step>0?+inp.step:(deg?15:Math.max(10,P.snapSize||50));
  const cur=inp.value===''?(+inp.placeholder||0):(+inp.value||0);let v=cur+step*(+b.dataset.stp);if(inp.min!==''&&v<+inp.min)v=+inp.min;if(inp.max!==''&&v>+inp.max)v=+inp.max;v=Math.round(v*100)/100;inp.value=v;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}))});
function annotateInfo(root){if(!root)return;addSteppers(root);root.querySelectorAll('label').forEach(lb=>{if(lb.querySelector('.info'))return;const inp=lb.querySelector('input,select');if(!inp)return;if(inp.type==='checkbox'||inp.type==='color'||inp.type==='radio')return;
  let txt='';lb.childNodes.forEach(n=>{if(n.nodeType===3)txt+=n.textContent});txt=txt.replace(/\((?:mm|°|m²)\)/g,'').replace(/[:]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  const tip=PARAM_INFO[txt];if(!tip)return;
  const s=document.createElement('span');s.className='info';s.textContent='i';s.title=tip;s.setAttribute('role','img');s.setAttribute('aria-label',txt+': '+tip);s.tabIndex=0;
  lb.insertBefore(s,inp)})}
function renderInspector(){if(multiMode)multiSync();{const bd=$('#b-del');if(bd)bd.disabled=!(sel.size||pinSel||(secSel&&S.section))}
  const el=$('#p-sel');if(el.hidden)return;
  if(el.contains(document.activeElement)&&document.activeElement.tagName==='INPUT')return;
  if(tool==='paint'){const pc=P.paintCol||'#d9c7a7';el.innerHTML=`<p class="big">Paint</p><p class="muted">Pick a colour, then click a wall, floor, door or item. Alt-click to pick up a colour. Shift-click a room to paint its walls.</p><div class="sec">Colour</div><div class="paintpal">${COLOR_PRESETS.map(([n,c])=>`<button type="button" class="psw${c.toLowerCase()===pc.toLowerCase()?' on':''}" data-paintc="${c}" title="${esc(n)}" style="background:${c}"></button>`).join('')}<label class="psw pcustom" title="Any colour" style="background:${pc}"><input type="color" value="${pc}" data-paintwheel></label></div><label class="chk" style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" data-paintface ${P.paintFace?'checked':''}> Paint one part only (3D) — e.g. a table top, not its legs</label><p class="muted">Works in 2D and in 3D. In 3D, click a wall face or the floor. Alt-click picks a colour.</p>`;return}
  if(secSel&&S.section){el.innerHTML=`<p class="big">Section cut</p><p class="muted">Slices the 3D model along this line. Drag its end handles to move it.</p><div class="row" style="margin-top:8px"><button class="btn sm" type="button" data-sec="toggle">${S.section.on?'Turn off':'Turn on'}</button><button class="btn sm" type="button" data-sec="flip">Flip side</button></div><div class="row"><button class="btn sm" type="button" data-sec="del">Delete section</button></div><p class="muted" style="margin-top:8px">In the 3D view you can also use the Section and Flip buttons on the top bar.</p>`;return}
  const l=selList();
  if(!l.length){el.innerHTML=`<p class="big">Nothing selected</p><p class="muted">Click furniture to select it. Shift-click or drag a box to select several. Pick an item from the library to place it.</p><div class="sec">Plan</div><dl class="kv"><dt>Rooms</dt><dd>${S.objs.filter(o=>o.t==='room').length}</dd><dt>Walls</dt><dd>${S.objs.filter(o=>o.t==='wall'&&!o.site).length}</dd><dt>Furniture</dt><dd>${S.objs.filter(o=>o.t==='item').length}</dd></dl>`;return}
  let h='';
  const rotRow=`<div class="row"><button class="btn sm" type="button" data-act="ccw">${ICON.ccw}90° anticlockwise</button><button class="btn sm" type="button" data-act="cw">${ICON.cw}90° clockwise</button></div>`;
  const cmdRow=`<div class="row"><button class="btn sm" type="button" data-act="dup">Duplicate</button><button class="btn sm" type="button" data-act="copy">Copy</button><button class="btn sm" type="button" data-act="del">Delete</button>${l.length>1?`<button class="btn sm" type="button" data-act="${l.some(o=>o.gid)&&new Set(l.map(o=>o.gid)).size===1?'ungroup':'group'}">${l.some(o=>o.gid)&&new Set(l.map(o=>o.gid)).size===1?'Ungroup':'Group'}</button>`:''}</div>`;
  const arrRow=`<div class="sec">Repeat as an array</div><div class="fld"><label>Rows<input type="number" min="1" id="ar-r" value="1"></label><label>Columns<input type="number" min="1" id="ar-c" value="4"></label><label>Gap across (mm)<input type="number" id="ar-gx" value="0"></label><label>Gap down (mm)<input type="number" id="ar-gy" value="${l.some(o=>/workstation/i.test(o.cat||''))?WS_ROW_GAP:0}"></label><label class="full" style="display:flex;align-items:center;gap:6px;color:var(--ink)"><input type="checkbox" id="ar-g" style="width:auto"> Group the result</label></div><div class="row"><button class="btn sm primary" type="button" data-act="array">Create array</button></div>`;
  if(l.length===1){const o=l[0];
    if(o.t==='item'){h=`<p class="big">${esc(o.name)}</p><p class="muted">${esc(o.code)} · ${esc(o.cat)}${o.gid?' · in a group':''}</p>${(isOpening(o)||isCore(o))?`<label class="chk" style="display:flex;gap:8px;align-items:center;margin:6px 0;color:var(--ink)"><input type="checkbox" data-f="exit" style="width:auto"${o.exit?' checked':''}> Final exit (egress) — a safe exit for the fire check</label>`:''}${isCore(o)&&S.bld?(()=>{const b=S.bld,nm=levelNames(b),opt=(v,emp)=>`<option value="">${emp}</option>`+b.levels.map(l=>`<option value="${l.id}"${v===l.id?' selected':''}>${nm[l.id]}</option>`).join('');const[lo,hi]=coreRange(b,o);
      return`<div class="sec">Runs through</div><div class="fld"><label>From<select data-f="cfrom">${opt(o.from,'Lowest floor')}</select></label><label>To<select data-f="cto">${opt(o.to,'Top floor')}</select></label>${o.shape==='stair'?`<label class="full" style="display:flex;align-items:center;gap:6px;color:var(--ink)"><input type="checkbox" data-f="croof" style="width:auto"${o.roof!==false?' checked':''}> Continues to the roof (adds a stair-roof box)</label>`:''}</div>
      <p class="muted">On ${nm[b.levels[lo].id]} to ${nm[b.levels[hi].id]}. Moving or resizing it here moves it on every floor${o.shape==='lift'?'. Lifts stop at the top floor they serve and never go to the roof':''}.</p>`})():''}${isCeil(o)?`<div class="sec">${isCCTV(o)?'Camera':'Ceiling'}</div><div class="fld"><label>Drop below ceiling (mm)<input type="number" data-f="drop" value="${r1(o.drop||0)}" step="50"></label>${isCCTV(o)?`<label>Facing (°)<input type="number" data-f="r" value="${r1(o.r||0)}" step="5"></label><label>Tilt down (°)<input type="number" data-f="tilt" min="0" max="90" value="${r1(o.tilt||0)}" step="5"></label><label>Range (mm)<input type="number" data-f="range" value="${r1(o.range||15000)}" step="500"></label><label class="full">Field of view: <b id="fov-v">${Math.round(o.fov||90)}°</b><input type="range" data-f="fov" min="50" max="180" step="5" value="${o.fov||90}"></label>`:`<label>Coverage radius (mm)<input type="number" data-f="cov" value="${r1(o.cov||0)}" step="500" placeholder="0 = off"></label>`}</div>${isCCTV(o)?`<canvas id="cctv-pov" width="480" height="300" style="width:100%;border-radius:8px;margin-top:8px;background:#1b2026"></canvas><p class="muted">What the camera sees. Drag the dot in front of it on the plan to aim it; the shaded area on the plan is its view, cut off by walls.</p>`:`<p class="muted">${o.cov>0?'Coverage circle shows on the plan (Layers › Coverage and camera views). ':''}Top of the item sits ${fmt(o.drop||0)} mm below the ceiling.</p>`}`:''}
      <div class="fld" style="margin-top:10px">
      <label class="full">Label on plan<input data-f="label" value="${esc(o.label)}" placeholder="${esc(itemLabel(Object.assign({},o,{label:''})))}"></label>
      <label>Width (mm)<input type="number" data-f="w" value="${r1(o.w)}"></label><label>Depth (mm)<input type="number" data-f="d" value="${r1(o.d)}"></label>
      <label>Angle (°)<input type="number" data-f="r" value="${r1(o.r||0)}" step="15"></label><label>Height (mm)<input type="number" data-f="h" value="${r1(o.h||0)}"></label>
      <label>Centre X (mm)<input type="number" data-f="x" value="${r1(o.x)}"></label><label>Centre Y (mm)<input type="number" data-f="y" value="${r1(o.y)}"></label>
      ${o.shape==='L'?`<label>Leg width (mm)<input type="number" data-f="a" value="${r1(o.a||0)}"></label><span></span>`:''}
${isCeil(o)?`<label>Unit rate<input type="number" data-f="rate" value="${o.rate==null?'':o.rate}" placeholder="optional"></label><span></span>`:`      <label>Seats<input type="number" data-f="seats" value="${o.seats||0}"></label><label>Unit rate<input type="number" data-f="rate" value="${o.rate==null?'':o.rate}" placeholder="optional"></label>
      <label>Clear front (mm)<input type="number" data-f="cf" value="${r1(o.cf||0)}"></label><label>Clear back (mm)<input type="number" data-f="cb" value="${r1(o.cb||0)}"></label>`}
      <label>Category<select data-f="cat">${Object.keys(CATS).map(c=>`<option${c===o.cat?' selected':''}>${c}</option>`).join('')}</select></label><label>Code<input data-f="code" value="${esc(o.code)}"></label>
      </div>${P.clash&&clashCache.bad.has(o.id)?'<p class="muted" style="color:var(--danger);margin-top:8px">Overlaps another item.</p>':''}${rotRow}${cmdRow}${o.shape==='chair'?`<label class="fld" style="display:flex;align-items:center;gap:6px;margin-top:8px;color:var(--ink)"><input type="checkbox" data-f="arms" style="width:auto"${hasArms(o)?' checked':''}> Arm rests</label>`:''}${o.shape==='window'?`<div class="sec">Window</div><div class="fld"><label>Sill height (mm)<input type="number" data-f="sill" value="${r1(o.sill||0)}"${o.h?'':' disabled'}></label><label>Glass height (mm)<input type="number" data-f="h" value="${r1(o.h||0)}"${o.h?'':' disabled'}></label><label class="full" style="display:flex;align-items:center;gap:6px;color:var(--ink)"><input type="checkbox" data-f="fullh" style="width:auto"${o.h?'':' checked'}> Full height, floor to ceiling</label></div><p class="muted">${o.h?`Head at ${fmt((o.sill||0)+o.h)} mm. `:''}Windows sit in the wall they are placed on and are shared by typical floors.</p>`:''}${/^door/.test(o.shape)?`<div class="sec">Door swing</div><div class="row">${o.shape==='door'?'<button class="btn sm" type="button" data-act="dflip">Hinge to the other side · X</button>':''}<button class="btn sm" type="button" data-act="dswing">Swing the other way · Shift X</button></div>`:''}<div class="row"><button class="btn sm" type="button" data-act="tolib">Save to library</button></div>${o.arr?arrEditRow(o):arrRow}`}
    else if(o.t==='room'){const b=bboxPts(o.pts),isRect=o.pts.length===4&&o.pts.every(p=>(Math.abs(p[0]-b.x0)<1||Math.abs(p[0]-b.x1)<1)&&(Math.abs(p[1]-b.y0)<1||Math.abs(p[1]-b.y1)<1));
      const area=Math.abs(polyArea(o.pts))/1e6;let per=0;o.pts.forEach((p,i)=>{const q=o.pts[(i+1)%o.pts.length];per+=Math.hypot(q[0]-p[0],q[1]-p[1])});
      const its=S.objs.filter(x=>x.t==='item'&&pointInPoly(x.x,x.y,o.pts));const seats=its.reduce((a,x)=>a+(+x.seats||0),0);
      h=`<p class="big">${esc(o.name)}</p><p class="muted">Room · ${o.link?'follows the shape of its wall':o.pts.length+' corners'}${S.locked?' · locked':''}${o.raise>0?` · raised ${r1(o.raise)} mm`:''}</p>${o.link?'<div class="row" style="margin:4px 0"><button class="btn sm" type="button" data-act="unlink">Reshape it on its own</button></div>':''}${(()=>{if(!migCfg().on)return'';const mg=migRoom(o),M=migMap();const opts=`<option value=""${!o.ent?' selected':''}>From the room name</option><option value="none"${o.ent==='none'?' selected':''}>Not checked</option>`+[...M.keys()].map(c=>`<option value="${c}"${o.ent===c?' selected':''}>${c} · ${M.get(c)} m²</option>`).join('');
  return`<div class="migbox ${mg?'mig-'+mg.st:''}"><div class="sec" style="margin-top:0">MIG entitlement</div>${mg?`<p style="margin:2px 0"><b>${esc(mg.label)}</b>: entitled ${mg.ent} m², room is ${mg.area.toFixed(1)} m² · <b>${mg.st==='over'?`over by ${mg.diff.toFixed(1)} m²`:mg.st==='under'?`under by ${(-mg.diff).toFixed(1)} m²`:'within entitlement'}</b></p>`:`<p class="muted" style="margin:2px 0">No rank in the name. Put one in it (like COL or ME5) or pick one below.</p>`}<label class="fld" style="display:block;margin-top:6px">Entitlement<select data-f="ment" style="width:100%">${opts}</select></label></div>`})()}<div class="fld" style="margin-top:10px"><label class="full">Name<input data-f="name" value="${esc(o.name)}"></label>${isRect?`<label>Width (mm)<input type="number" data-f="rw" value="${r1(b.x1-b.x0)}"></label><label>Depth (mm)<input type="number" data-f="rd" value="${r1(b.y1-b.y0)}"></label>`:''}</div>
      <div class="sec">Measures</div><dl class="kv"><dt>Area</dt><dd>${area.toFixed(2)} m²</dd><dt>Perimeter</dt><dd>${fmt(per)} mm</dd><dt>Furniture inside</dt><dd>${its.length}</dd><dt>Seats inside</dt><dd>${seats}</dd>${seats?`<dt>Area per seat</dt><dd>${(area/seats).toFixed(1)} m²</dd>`:''}</dl>
      <div class="sec">Security zone</div>${zoneRow(o.zone)}<div class="sec">Raised floor</div><div class="fld"><label>Height above slab (mm)<input type="number" data-f="raise" value="${r1(o.raise||0)}" step="50" min="0"></label><span></span></div><div class="sec">Colours</div>${colorRow('room-floor',o.floorCol,planFloorCol(),'Floor')}${o.nowall?'':colorRow('room-wall',o.wallCol,planWallCol(),'Walls')}${o.link?'':`<div class="row" style="margin-top:8px"><button class="btn sm" type="button" data-act="addpt">Add points</button></div><p class="muted" style="margin-top:8px">${isRect?'Drag a corner to resize; the room stays rectangular (hold Alt to move one corner on its own).':'Drag the corner handles to reshape.'} Add points, or double-click an edge, to put in a corner. Alt-click a corner to remove it.</p>`}${o.nowall?'':`<div class="sec">Windows on this room's walls</div>${winForm('sel')}<div class="row"><button class="btn sm primary" type="button" data-act="winfill">Add windows</button></div>`}${tplRoomHTML(o)}${rotRow}${cmdRow}`}
    else if(o.t==='wall'&&o.site){const sg=wallSegs(o);const tot=sg.reduce((a,[p,q])=>a+Math.hypot(q[0]-p[0],q[1]-p[1]),0);const R=o.site==='road';
      h=`<p class="big">${R?'Road':'Fence'}</p><p class="muted">${sg.length} ${sg.length===1?'segment':'segments'}${o.closed?' · closed boundary':''} · ground floor</p><div class="fld" style="margin-top:10px">${R?`<label>Width (mm)<input type="number" data-f="th" value="${r1(o.th||0)}" step="500"></label>`:`<label>Height (mm)<input type="number" data-f="h" value="${r1(o.h||2400)}" step="100"></label>`}<span></span></div>
      <div class="sec">Measures</div><dl class="kv"><dt>Total length</dt><dd>${fmt(tot)} mm</dd>${R?`<dt>Area</dt><dd>${(tot*(o.th||0)/1e6).toFixed(0)} m²</dd>`:o.closed?`<dt>Site area inside</dt><dd>${(Math.abs(polyArea(wallPathPts(o)))/1e6).toFixed(0)} m²</dd>`:''}</dl>
      <label class="chk" style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" data-f="curve" ${o.spline?'checked':''}>Smooth curve through the points</label><div class="row"><button class="btn sm" type="button" data-act="addpt">Add points</button></div><p class="muted" style="margin-top:8px">Drag a point to move it. Alt-click a point to remove it. ${R?'':'A closed fence marks the site; everything inside is grass unless a road or the building covers it.'}</p>${rotRow}${cmdRow}`}
    else if(o.t==='wall'){const sg=wallSegs(o);const tot=sg.reduce((a,[p,q])=>a+Math.hypot(q[0]-p[0],q[1]-p[1]),0);
      h=`<p class="big">Wall</p><p class="muted">${sg.length} ${sg.length===1?'segment':'segments'}${o.closed?' · closed loop':''}${o.det?' · traced from the drawing':''}${S.locked?' · locked':''}</p><div class="fld" style="margin-top:10px"><label>Thickness (mm)<input type="number" data-f="th" value="${r1(o.th||0)}"></label>${sg.length===1?`<label>Length (mm)<input type="number" data-f="len" value="${r1(tot)}"></label>`:'<span></span>'}</div>
      <div class="sec">Measures</div><dl class="kv"><dt>Total length</dt><dd>${fmt(tot)} mm</dd></dl>${rawSegs(o).length===1?`<div class="fld"><label class="full">Curve (mm, how far the middle bows out; 0 is straight)<input type="number" data-f="bulge" value="${r1(segBulge(o,0))}" step="50"></label></div>`:''}<div class="row"><button class="btn sm" type="button" data-act="addpt">Add points</button></div><p class="muted" style="margin-top:8px">Drag a corner handle to reshape. Add points, or double-click the wall, to put in a new corner. Alt-click a corner to remove it. Drag the diamond in the middle of a segment to curve it; double-click the diamond to straighten.</p>
      <div class="sec">Colour</div>${colorRow('wall-col',o.col,planWallCol(),'Wall')}<div class="sec">Windows along this wall</div>${winForm('sel')}<div class="row"><button class="btn sm primary" type="button" data-act="winfill">Add windows</button></div>${rotRow}${cmdRow}`}
    else if(o.t==='text'){h=`<p class="big">Text label</p><div class="fld" style="margin-top:10px"><label class="full">Text<input id="f-text" data-f="text" value="${esc(o.text)}"></label><label>Size (mm)<input type="number" data-f="size" value="${r1(o.size)}"></label></div>${cmdRow}`}
    else if(o.t==='trunk'){let tot=0;for(let i=0;i<o.pts.length-1;i++)tot+=Math.hypot(o.pts[i+1][0]-o.pts[i][0],o.pts[i+1][1]-o.pts[i][1]);
      h=`<p class="big">Ceiling trunking</p><p class="muted">${o.pts.length-1} ${o.pts.length-1===1?'run':'runs'} · overlaps allowed</p><div class="fld" style="margin-top:8px"><label>Width (mm)<input type="number" data-f="w" value="${r1(o.w)}" step="25"></label><label>Height (mm)<input type="number" data-f="h" value="${r1(o.h)}" step="25"></label></div><div class="fld"><label>Drop below ceiling (mm)<input type="number" data-f="drop" value="${r1(o.drop||0)}" step="25" min="0"></label><span></span></div><div class="sec">Measures</div><dl class="kv"><dt>Total length</dt><dd>${fmt(tot)} mm</dd></dl><div class="sec">Colour</div><div class="paintpal">${TRUNK_COLORS.map(([n,c])=>`<button type="button" class="psw${(o.col||'').toLowerCase()===c.toLowerCase()?' on':''}" data-trunkc="${c}" title="${esc(n)}" style="background:${c}"></button>`).join('')}<label class="psw pcustom" title="Any colour" style="background:${o.col||'#b4b9bd'}"><input type="color" value="${o.col||'#b4b9bd'}" data-trunkwheel></label></div><div class="row"><button class="btn sm" type="button" data-act="addpt">Add points</button></div><p class="muted" style="margin-top:8px">Drag a point to move it. Alt-click a point to remove it. Shown on the Ceiling layer.</p>${rotRow}${cmdRow}`}
    else if(o.t==='dim'){h=`<p class="big">Measurement</p><dl class="kv"><dt>Length</dt><dd>${fmt(Math.hypot(o.b[0]-o.a[0],o.b[1]-o.a[1]))} mm</dd></dl>${cmdRow}`}
  }else{
    const items=l.filter(o=>o.t==='item');const b=unionBox(l);
    const counts={};items.forEach(o=>{counts[o.name]=(counts[o.name]||0)+1});
    h=`<p class="big">${l.length} objects selected</p><p class="muted">${fmt(b.x1-b.x0)} × ${fmt(b.y1-b.y0)} mm overall</p><dl class="kv" style="margin-top:8px">${Object.entries(counts).slice(0,8).map(([n,c])=>`<dt>${esc(n)}</dt><dd>${c}</dd>`).join('')}</dl>${l.some(o=>o.t==='room')?`<div class="sec">Security zone · ${l.filter(o=>o.t==='room').length} rooms</div>${zoneRow((()=>{const z=[...new Set(l.filter(o=>o.t==='room').map(o=>o.zone||''))];return z.length===1?z[0]:'~'})())}`:''}${rotRow}${cmdRow}
    ${items.length>1?`<div class="sec">Save as a set</div><p class="muted">Adds these ${items.length} items to the library as one entry you can place again, such as a desk, chair and pedestal.</p><div class="fld"><label class="full">Set name<input id="set-name" placeholder="e.g. Workstation set 1400 with screen"></label></div><div class="row"><button class="btn sm" type="button" data-act="toset">Save set to library</button></div>`:''}
    <div class="sec">Align</div><div class="row"><button class="btn sm" type="button" data-act="al-l">Left</button><button class="btn sm" type="button" data-act="al-c">Centre</button><button class="btn sm" type="button" data-act="al-r">Right</button><button class="btn sm" type="button" data-act="al-t">Top</button><button class="btn sm" type="button" data-act="al-m">Middle</button><button class="btn sm" type="button" data-act="al-b">Bottom</button><button class="btn sm" type="button" data-act="al-dh">Space across</button><button class="btn sm" type="button" data-act="al-dv">Space down</button></div>${arrRow}`;
  }
  if(PHONE()&&sel.size&&!S.locked)h=`<div class="macts"><button class="btn" type="button" data-mact="rot">↻ Rotate</button><button class="btn" type="button" data-mact="dup">⧉ Duplicate</button><button class="btn danger" type="button" data-mact="del" style="color:#b3261e">Delete</button></div>`+h;
  el.innerHTML=h;annotateInfo(el);{const one=selList();if(one.length===1&&isCCTV(one[0]))schedulePOV()}
}
let editSession=false;
$('#p-sel').addEventListener('focusin',e=>{if(e.target.matches('[data-f]'))editSession=false});
/* no number field takes a value beyond the plan limit: the field goes back to what it showed and says why */
['input','change'].forEach(ev=>document.addEventListener(ev,e=>{const t=e.target;if(!t||t.tagName!=='INPUT'||t.type!=='number'||t.value==='')return;const n=parseFloat(t.value);if(isFinite(n)&&Math.abs(n)<=LIM)return;if(!isFinite(n)&&!/e\d{3,}/i.test(t.value))return;e.stopImmediatePropagation();t.value=t.defaultValue;toast('That number is too large. The limit is 10,000,000')},true));
$('#p-sel').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches&&e.target.matches('[data-turn]')){e.preventDefault();const b=$('#p-sel [data-act=turn]');if(b)b.click()}});
$('#p-sel').addEventListener('input',e=>{
  if(e.target.matches('[data-paintwheel]')){P.paintCol=e.target.value;savePrefs();updateHint();const pc=$('#p-sel .pcustom');if(pc)pc.style.background=e.target.value;$$('#p-sel .psw').forEach(x=>x.classList.toggle('on',x.dataset.paintc&&x.dataset.paintc.toLowerCase()===e.target.value.toLowerCase()));return}
  if(e.target.matches('[data-trunkwheel]')){const l=selList().filter(o=>o.t==='trunk');if(!l.length)return;if(!editSession){pushPast(snapState());future=[];editSession=true}l.forEach(o=>o.col=e.target.value);markDirty();render();if(is3D)build3D();const pc=$('#p-sel .pcustom');if(pc)pc.style.background=e.target.value;return}
  const f=e.target.dataset.f;if(!f)return;const l=selList();if(l.length!==1)return;const o=l[0];
  if(!editSession){pushPast(snapState());future=[];editSession=true}
  const v=e.target.value;
  if(f==='curve'&&o.t==='wall'){if(e.target.checked){o.spline=true;o.bulge=[]}else delete o.spline;markDirty();clashDirty=true;render();renderInspector();return}
  if(f==='ment'&&o.t==='room'){if(v)o.ent=v;else delete o.ent;markDirty();render();renderInspector();return}
  if(o.t==='item'){
    if(f==='exit'){o.exit=e.target.checked;markDirty();render();renderInspector();if(EG.on)egressRun(true);if(!$('#p-fire').hidden)renderFire();return}
    if(f==='cfrom'||f==='cto'||f==='croof'){if(f==='croof')o.roof=e.target.checked;else o[f==='cfrom'?'from':'to']=e.target.value||null;
      syncFloorOut(S);syncFloorIn(S);if(!S.objs.some(x=>x.id===o.id)){sel.clear();toast('It no longer runs through this floor')}markDirty();clashDirty=true;render();renderInspector();schedule3D();return}
    if(f==='fullh'){if(e.target.checked){o.h=0;o.sill=0}else{o.h=1500;o.sill=900}markDirty();clashDirty=true;render();renderInspector();schedule3D();return}
    if(['w','d','h','x','y','r','a','cf','cb','seats','sill','drop','cov','tilt','fov','range'].includes(f)){let n=num(v,NaN);if(!isFinite(n))return;if(f==='fov'){n=Math.max(50,Math.min(180,n));const fv=$('#fov-v');if(fv)fv.textContent=Math.round(n)+'°'}if(f==='tilt')n=Math.max(0,Math.min(90,n));if((f==='drop'||f==='cov'||f==='range')&&n<0)return;
      if(o.shape==='poly'&&(f==='w'||f==='d')&&n>0&&o.pts){const s=n/(f==='w'?o.w:o.d);o.pts=o.pts.map(p=>f==='w'?[p[0]*s,p[1]]:[p[0],p[1]*s])}
      if((f==='w'||f==='d')&&n<=0)return;o[f]=n}
    else if(f==='arms')o.arms=e.target.checked;
    else if(f==='rate')o.rate=v===''?null:num(v,null);
    else o[f]=v;
  }else if(o.t==='room'){
    if(f==='name')o.name=v;else if(f==='raise'){const n=num(v,0);o.raise=n>0?n:0}else{const n=num(v,NaN);if(!(n>0))return;const b=bboxPts(o.pts);const x1=f==='rw'?b.x0+n:b.x1,y1=f==='rd'?b.y0+n:b.y1;o.pts=rectP(b.x0,b.y0,x1,y1)}
  }else if(o.t==='wall'){const n=num(v,NaN);if(f==='bulge'){if(!isFinite(n))return;o.bulge=[n];markDirty();clashDirty=true;render();return}if(!(n>0))return;
    if(f==='th')o.th=n;
    else if(f==='h')o.h=n;
    else if(f==='len'&&o.pts.length===2){const a=o.pts[0],b=o.pts[1],L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;o.pts[1]=[Math.round(a[0]+(b[0]-a[0])/L*n),Math.round(a[1]+(b[1]-a[1])/L*n)]}
  }else if(o.t==='trunk'){if(f==='drop'){o.drop=Math.max(0,num(v,0))}else{const n=num(v,NaN);if(!(n>0))return;o[f]=n}
  }else if(o.t==='text'){if(f==='size'){const n=num(v,NaN);if(n>0)o.size=n}else o.text=v}
  markDirty();clashDirty=true;render();if(isCCTV(o))schedulePOV();schedule3D();
});
$('#p-sel').addEventListener('change',e=>{
  if(e.target.matches('[data-arrf]')){const l=selList();if(l.length===1&&l[0].arr){const k=e.target.dataset.arrf;let v=num(e.target.value,NaN);if(!isFinite(v))return;if((k==='rows'||k==='cols')){v=Math.max(1,Math.min(200,v|0))}else if((k==='w'||k==='d')&&v<1)return;editArray(l[0],{[k]:v})}return}
  if(e.target.matches('[data-f]')){editSession=false;const a=document.activeElement;if(e.target.tagName==='SELECT')renderInspector()}});
/* leaving a field redraws the panel, but not when the user has just pressed something else in the panel: on browsers where a click does not move the focus (Safari, iPad) that redraw threw away the control being pressed, so a colour picked in the colour dialog was lost */
let pselDown=0;$('#p-sel').addEventListener('pointerdown',()=>{pselDown=performance.now()},true);
$('#p-sel').addEventListener('focusout',e=>{setTimeout(()=>{if(performance.now()-pselDown<700)return;if(!$('#p-sel').contains(document.activeElement))renderInspector()},0)});
$('#p-sel').addEventListener('click',e=>{const zb=e.target.closest('[data-zone]');if(zb){applyZone(zb.dataset.zone);return}const tc=e.target.closest('[data-trunkc]');if(tc){const l=selList().filter(o=>o.t==='trunk');if(l.length){checkpoint();l.forEach(o=>o.col=tc.dataset.trunkc);markDirty();render();if(is3D)build3D();renderInspector()}return}const pf=e.target.closest('[data-paintface]');if(pf){P.paintFace=pf.checked;savePrefs();updateHint();return}const ps=e.target.closest('[data-paintc]');if(ps){P.paintCol=ps.dataset.paintc;savePrefs();renderInspector();updateHint();return}if(e.target.matches('[data-paintface]')){P.paintFace=e.target.checked;savePrefs();updateHint();return}const sc=e.target.closest('[data-sec]');if(sc){const a=sc.dataset.sec;if(!S.section)return;if(a==='toggle'){checkpoint();S.section.on=!S.section.on}else if(a==='flip'){checkpoint();S.section.flip=!S.section.flip}else if(a==='del'){checkpoint();S.section=undefined;secSel=false}markDirty();if(is3D){sectionApply();sectionBar()}render();renderInspector();return}const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;if(a==='winfill'){runWindowFill('sel',$('#p-sel .winf'));return}if(a==='addpt'){const o=selList()[0];if(o){const t=o.t==='room'&&o.link?byId(o.link):o;setTool('addpt');addPtFor=t.id;sel=new Set([t.id]);render();updateHint()}return}if(a==='unlink'){const o=selList()[0];if(o){checkpoint();delete o.link;o.pts=dropCollinear(o.pts.slice());markDirty();render();renderInspector();toast('The room no longer follows its wall')}return}
  if(a==='turn'){const f=$('#p-sel [data-turn]'),v=f?parseFloat(f.value):NaN;if(!isFinite(v)||!v||Math.abs(v)>360)return toast('Type an angle between -360 and 360. A minus sign turns anticlockwise');rotateSel(v);toast(`Turned ${Math.abs(v)}° ${v>0?'clockwise':'anticlockwise'}`);return}
  if(a==='ccw')rotateSel(-90);else if(a==='cw')rotateSel(90);else if(a==='dup')duplicateSel();else if(a==='copy')copySel();else if(a==='del')deleteSel();
  else if(a==='group')groupSel();else if(a==='ungroup')ungroupSel();
  else if(a.startsWith('al-'))alignSel(a.slice(3));
  else if(a==='toset')saveSet();
  else if(a==='dflip')applyDoorFlip(false);else if(a==='dswing')applyDoorFlip(true);
  else if(a==='array')arraySel(num($('#ar-r').value,1),num($('#ar-c').value,1),num($('#ar-gx').value,0),num($('#ar-gy').value,0),$('#ar-g').checked);
  else if(a==='tpledit'){const o=selList()[0];if(o&&o.tpl)tplOpen(o.tpl.code,o)}
  else if(a==='tplsave'){const o=selList()[0];if(o)tplSave(o,($('#rt-name')||{}).value,($('#rt-disc')||{}).value)}
  else if(a==='tolib'){const o=selList()[0];if(!o)return;checkpoint();const code=o.code&&o.code!=='CUSTOM'&&!LIB.some(l=>l.code===o.code&&(l.w!==o.w||l.d!==o.d))?o.code:('CUS-'+uid().slice(0,4).toUpperCase());
    const ex=LIB.findIndex(l=>l.code===code);const rec={code,name:o.label||o.name,cat:o.cat,shape:o.shape,w:o.w,d:o.d,h:o.h||750,a:o.a||0,seats:o.seats||0,cf:o.cf||0,cb:o.cb||0,nests:!!o.nests,rate:o.rate,pts:o.pts?clone(o.pts):null};
    if(o.shape==='poly')toast('Polygon outlines stay in this browser only. The CSV keeps the size as a rectangle.');
    if(ex>=0)LIB[ex]=rec;else LIB.push(rec);o.code=code;saveLib();renderLib();renderInspector();if(o.shape!=='poly')toast(`Saved ${rec.name} to the library`)}
});

/* Q: open the library ready to search, in 2D or 3D */
function openAddFurniture(){if(WALK.on)return;if(!P.lib){P.lib=true;if(W<1100)P.insp=false;savePrefs();applyDrawers()}const q=$('#lib-q');setTimeout(()=>{q.focus();q.select()},20);toast('Type to search, click an item, then click on the plan to place it')}
/* what a double-click lands on: a text label, else the smallest room under the pointer, unless furniture is on top */
function dblTarget(ev){
  const hits=document.elementsFromPoint(ev.clientX,ev.clientY).map(e=>e.closest&&e.closest('[data-id]')).filter(Boolean).map(e=>byId(e.dataset.id)).filter(Boolean);
  const top=hits[0];if(top&&(top.t==='text'||top.t==='item'))return top;if(top&&top.t==='wall')return null;
  const w=toWorld(ev);return S.objs.filter(r=>r.t==='room'&&visible(r)&&pointInPoly(w[0],w[1],r.pts)).sort((p,q)=>Math.abs(polyArea(p.pts))-Math.abs(polyArea(q.pts)))[0]||null}
/* type a furniture name right on the plan: custom shapes change their name, library items get a label of their own */
function renameItem(o){
  const old=$('.rename-in');if(old)old.remove();setSel([o.id]);
  const r=svg.getBoundingClientRect(),inp=document.createElement('input');inp.className='rename-in';const custom=o.cat==='Custom'||o.code==='CUSTOM'||/^CUS-/.test(o.code||'');
  inp.value=custom?(o.name||''):(o.label||o.name||'');inp.setAttribute('aria-label','Furniture name');inp.style.left=(r.left+(o.x-V.x)*V.k)+'px';inp.style.top=(r.top+(o.y-V.y)*V.k)+'px';
  document.body.appendChild(inp);setTimeout(()=>{inp.focus();inp.select()},0);
  let done=false;const fin=ok=>{if(done)return;done=true;const v=inp.value.trim();inp.remove();if(!ok)return;
    if(custom){if(v&&v!==o.name){checkpoint();o.name=v;o.label=''}}else{const nl=v===o.name?'':v;if(nl!==(o.label||'')){checkpoint();o.label=nl}}
    render();renderInspector();if(is3D)schedule3D()};
  inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();fin(true)}else if(e.key==='Escape'){e.preventDefault();fin(false)}});
  setTimeout(()=>inp.addEventListener('blur',()=>fin(true)),50);
}
/* ---------- wall and floor colours: plan-wide in Settings, per room or per wall in the inspector ---------- */
const COLOR_PRESETS=[['White','#f4f4f2'],['Black','#1f2226'],['Dark grey','#4a4f55'],['Beige','#d9c7a7'],['Army green','#4b5320'],['Orange','#e07b2a'],['Blue','#2f6db5']];
const TRUNK_COLORS=[['Orange','#e8711a'],['White','#f4f4f1'],['Epoxy green','#1f7a4d'],['Apple green','#8db600'],['Maroon','#7b2e3b']];
const defWallCol=()=>isDark()?'#56626f':'#e9ecef',defFloorCol=()=>cssColor('--room');
const planWallCol=()=>(S.style&&S.style.wall)||defWallCol(),planFloorCol=()=>(S.style&&S.style.floor)||defFloorCol();
function colorRow(id,val,fallback,label){const cur=(val||'').toLowerCase();
  return `<div class="crow"><span class="clbl">${esc(label)}</span><div class="cpick" data-cp="${id}">${COLOR_PRESETS.map(([n,c])=>`<button type="button" class="csw${cur===c?' on':''}" style="background:${c}" data-cval="${c}" title="${n}" aria-label="${n}"></button>`).join('')}
    <label class="cwheel${val&&!COLOR_PRESETS.some(p=>p[1]===cur)?' on':''}" title="Any colour"><input type="color" value="${val||fallback}" aria-label="Pick any colour"></label><button type="button" class="cdef" data-cval="" title="Back to the default">${val?'Default':'Using default'}</button></div></div>`}
function colorTarget(id){const o=selList()[0];
  if(id==='plan-wall'||id==='plan-floor')return{get:()=>S.style&&S.style[id==='plan-wall'?'wall':'floor'],set:v=>{S.style=Object.assign({},S.style||{});if(v)S.style[id==='plan-wall'?'wall':'floor']=v;else delete S.style[id==='plan-wall'?'wall':'floor']}};
  if(!o)return null;const key={'room-floor':'floorCol','room-wall':'wallCol','wall-col':'col'}[id];if(!key)return null;return{get:()=>o[key],set:v=>{if(v)o[key]=v;else delete o[key]}}}
let colorEditing=false;
function applyColor(id,v,live){const t=colorTarget(id);if(!t)return;if(!colorEditing){checkpoint();colorEditing=!!live}t.set(v);markDirty();render();if(is3D)build3D();if(!live){colorEditing=false;refreshColorUI()}}
function refreshColorUI(){renderInspector();const sc=$('#set-colors');if(sc)renderSetColors()}
function renderSetColors(){const el=$('#set-colors');if(!el)return;el.innerHTML=colorRow('plan-wall',S.style&&S.style.wall,defWallCol(),'Walls')+colorRow('plan-floor',S.style&&S.style.floor,defFloorCol(),'Floors')+'<p class="muted" style="font-size:12px;margin:4px 2px 0">Saved with this plan. Shows in 3D and the walkthrough, and tints room floors on the plan. Rooms and walls can have their own colour in Details.</p>'}
document.addEventListener('click',e=>{const b=e.target.closest('.cpick [data-cval]');if(!b)return;const id=b.closest('.cpick').dataset.cp;applyColor(id,b.dataset.cval||null,false)});
document.addEventListener('input',e=>{if(e.target.matches('.cpick input[type=color]'))applyColor(e.target.closest('.cpick').dataset.cp,e.target.value,true)});
document.addEventListener('change',e=>{if(e.target.matches('.cpick input[type=color]'))applyColor(e.target.closest('.cpick').dataset.cp,e.target.value,false)});

/* type a room's name right on the plan */
function renameRoom(o){
  const old=$('.rename-in');if(old)old.remove();
  const c=centroid(o.pts),r=svg.getBoundingClientRect();const inp=document.createElement('input');inp.className='rename-in';inp.value=o.name||'';inp.setAttribute('aria-label','Room name');
  inp.style.left=(r.left+(c[0]-V.x)*V.k)+'px';inp.style.top=(r.top+(c[1]-V.y)*V.k)+'px';document.body.appendChild(inp);setTimeout(()=>{inp.focus();inp.select()},0);
  let done=false;const fin=ok=>{if(done)return;done=true;const v=inp.value.trim();inp.remove();if(ok&&v&&v!==o.name){checkpoint();o.name=v;render();renderInspector();if(is3D)schedule3D()}};
  inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();fin(true)}else if(e.key==='Escape'){e.preventDefault();fin(false)}});
  setTimeout(()=>inp.addEventListener('blur',()=>fin(true)),50);
}
/* door swing: the same door drawn every way it can open, so you pick by picture */
function doorVariants(o){const r=((o.r||0)%360+360)%360,f=!!o.flip;
  return o.shape==='door2'?[{r,f:false},{r:(r+180)%360,f:false}]:[{r,f},{r,f:!f},{r:(r+180)%360,f:!f},{r:(r+180)%360,f}]}
function doorVariantSVG(o,v){const m=Object.assign({},o,{w:900,d:100,x:0,y:0});const sh=shapeSVG(m);
  return `<svg viewBox="-700 -700 1400 1400" aria-hidden="true"><line x1="-700" y1="0" x2="-450" y2="0" stroke="currentColor" stroke-width="60" transform="rotate(${v.r})"/><line x1="450" y1="0" x2="700" y2="0" stroke="currentColor" stroke-width="60" transform="rotate(${v.r})"/><g class="it cat-door" transform="rotate(${v.r})${v.f?' scale(-1 1)':''}">${sh}</g></svg>`}
function applyDoorFlip(other){const l=selList().filter(o=>o.t==='item'&&/^door/.test(o.shape));if(!l.length)return false;checkpoint();
  l.forEach(o=>{if(other){o.r=(((o.r||0)+180)%360);if(o.shape==='door')o.flip=!o.flip}else if(o.shape==='door')o.flip=!o.flip});clashDirty=true;render();renderInspector();return true}

/* selected items -> one library set */
function saveSet(){
  const items=selList().filter(o=>o.t==='item');if(items.length<2)return toast('Select two or more furniture items');
  const miss=items.filter(o=>!LIB.some(l=>l.code===o.code&&l.shape!=='set'));
  if(miss.length)return toast(`Save ${miss[0].name} to the library first, then save the set`);
  const b=unionBox(items),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;
  const name=(($('#set-name')||{}).value||'').trim()||('Set of '+items.length+' items');
  const cat=items.some(o=>o.cat==='Workstation')?'Workstation set':(items.some(o=>o.cat==='Meeting')?'Meeting set':'Custom set');
  const code='SET-'+uid().slice(0,4).toUpperCase();
  const rec={code,name,cat,shape:'set',w:0,d:0,h:0,a:0,seats:0,cf:0,cb:0,nests:false,rate:null,pts:null,comps:items.map(o=>({code:o.code,x:Math.round(o.x-cx),y:Math.round(o.y-cy),r:o.r||0}))};
  const at=LIB.reduce((p,l,i)=>l.cat===cat?i+1:p,-1);if(at>=0)LIB.splice(at,0,rec);else LIB.push(rec);
  items.forEach(o=>{o.setCat=cat;o.setName=name});resolveSets(LIB);saveLib();libCat='All';renderLib();layersChanged();toast(`Saved ${name} to the library under ${cat}`);
}

/* ================= schedule ================= */
function scheduleData(){
  const items=S.objs.filter(o=>o.t==='item'),rooms=S.objs.filter(o=>o.t==='room');
  const g=new Map();items.forEach(o=>{const k=(o.code||'')+'|'+(o.label||o.name)+'|'+r1(o.w)+'x'+r1(o.d);if(!g.has(k))g.set(k,{code:o.code,name:o.label||o.name,cat:o.cat,w:r1(o.w),d:r1(o.d),qty:0,seats:0,rate:o.rate});const e=g.get(k);e.grp=isCeil(o)?'ceil':(isOpening(o)||isCol(o)||isCore(o))?'build':'furn';e.qty++;e.seats+=(+o.seats||0);if(e.rate==null&&o.rate!=null)e.rate=o.rate});
  const CO=Object.keys(CATS);const ci=c=>{const i=CO.indexOf(c);return i<0?99:i};
  const GO={furn:0,ceil:1,build:2};const lines=[...g.values()].sort((a,b)=>GO[a.grp]-GO[b.grp]||ci(a.cat)-ci(b.cat)||a.name.localeCompare(b.name));
  const rl=rooms.map(r=>{const its=items.filter(x=>pointInPoly(x.x,x.y,r.pts));return{name:r.name,area:Math.abs(polyArea(r.pts))/1e6,items:its.length,seats:its.reduce((a,x)=>a+(+x.seats||0),0),ws:its.filter(x=>x.cat==='Workstation').length}});
  const seats=items.reduce((a,o)=>a+(+o.seats||0),0),ws=items.filter(o=>o.cat==='Workstation').length,area=rl.reduce((a,r)=>a+r.area,0);
  const cost=lines.reduce((a,l)=>a+(l.rate!=null?l.rate*l.qty:0),0),hasRate=lines.some(l=>l.rate!=null);
  return{lines,rooms:rl,seats,ws,area,cost,hasRate,count:items.length,furn:items.filter(o=>!isCeil(o)&&!isOpening(o)&&!isCol(o)&&!isCore(o)).length,ceil:items.filter(isCeil).length};
}
/* every floor of the building: levels, areas, seats and items, worked out from each floor's own contents */
function buildingSchedule(){const b=S.bld;if(!b)return null;syncFloorOut(S);const st=levelStack(b),nm=levelNames(b),real=S.objs;const rows=[];
  try{b.levels.forEach((l,i)=>{S.objs=bldObjs(l,real);const D=scheduleData();const fp=floorPlate(),gross=fp.reduce((a,p)=>a+Math.abs(polyArea(p)),0)/1e6,inner=plateInner(fp);
    rows.push({name:nm[l.id],ffl:st[i].ffl,ftf:st[i].ftf,gross,inner,area:D.area,rooms:D.rooms.length,ws:D.ws,seats:D.seats,furn:D.furn,ceil:D.ceil,cost:D.cost,hasRate:D.hasRate,unique:l.unique,active:l===bldLevel(S)})})}finally{S.objs=real}
  rows.reverse();const T=k=>rows.reduce((a,r)=>a+(r[k]||0),0);const top=st[st.length-1];
  return{rows,tot:{gross:T('gross'),inner:T('inner'),area:T('area'),rooms:T('rooms'),ws:T('ws'),seats:T('seats'),furn:T('furn'),ceil:T('ceil'),cost:T('cost')},hasRate:rows.some(r=>r.hasRate),height:top.ffl+top.ftf+ +b.parapet,cores:(b.cores||[]).filter(isCore).length}}
function renderSchedule(){
  {const a=document.activeElement;if(a&&$('#p-sch').contains(a)&&a.tagName==='INPUT'){updateCostOut();return}}
  const D=scheduleData();
  let h=`<div class="tot"><div><b>${D.ws}</b><span>WORKSTATIONS</span></div><div><b>${D.seats}</b><span>SEATS</span></div><div><b>${D.area.toFixed(1)}</b><span>ROOM AREA m²</span></div><div><b>${D.seats?(D.area/D.seats).toFixed(1):'–'}</b><span>m² PER SEAT</span></div></div>`;
  h+=`<div class="row" style="margin:0 0 10px"><button class="btn sm primary" type="button" id="sch-csv">Export CSV</button><button class="btn sm" type="button" id="sch-copy">Copy for Excel</button></div>`;
  const BS=S.bld&&S.bld.levels.length>1?buildingSchedule():null;
  h+=costHTML(costCalc(BS));
  if(BS){const m=v=>(v/1000>=0?'+':'')+(v/1000).toFixed(2);h+=`<div class="sec">Building · ${BS.rows.length} floors · ${(BS.height/1000).toFixed(1)} m to parapet</div><table class="sch"><thead><tr><th>Floor</th><th style="text-align:right">FFL m</th><th style="text-align:right">Gross m²</th><th style="text-align:right">Rooms m²</th><th style="text-align:right">Seats</th><th style="text-align:right">Items</th></tr></thead><tbody>${BS.rows.map(r=>`<tr${r.active?' style="font-weight:600"':''}><td>${r.name}${r.unique?' <span class="muted" style="font-size:11px">unique</span>':''}</td><td class="n">${m(r.ffl)}</td><td class="n">${r.gross.toFixed(0)}</td><td class="n">${r.area.toFixed(0)}</td><td class="n">${r.seats||''}</td><td class="n">${r.furn+r.ceil||''}</td></tr>`).join('')}<tr style="font-weight:600"><td>Total</td><td></td><td class="n">${BS.tot.gross.toFixed(0)}</td><td class="n">${BS.tot.area.toFixed(0)}</td><td class="n">${BS.tot.seats}</td><td class="n">${BS.tot.furn+BS.tot.ceil}</td></tr></tbody></table><p class="muted">Gross = the floor outline including walls. The rest of this tab is the open floor.</p>`}
  const MR=S.objs.filter(o=>o.t==='room').map(o=>[o,migRoom(o)]).filter(x=>x[1]);
  if(MR.length){const no=MR.filter(x=>x[1].st==='over').length,nu=MR.filter(x=>x[1].st==='under').length;h+=`<div class="sec">MIG check · ${MR.length} rooms${no?` · <span style="color:#c0392b">${no} over</span>`:''}${nu?` · <span style="color:#b7791f">${nu} under</span>`:''}</div><table class="sch"><thead><tr><th>Room</th><th>Ranks</th><th style="text-align:right">Entitled m²</th><th style="text-align:right">Room m²</th><th style="text-align:right">+/−</th></tr></thead><tbody>${MR.map(([o,m])=>`<tr class="mig-row mig-${m.st}"><td>${esc(o.name)}</td><td>${esc(m.label)}</td><td class="n">${m.ent}</td><td class="n">${m.area.toFixed(1)}</td><td class="n">${m.st==='ok'?'✓':(m.diff>0?'+':'')+m.diff.toFixed(1)}</td></tr>`).join('')}</tbody></table>`}
  h+=`<div class="sec">Furniture${BS?' · this floor':''}</div>`;
  if(!D.lines.length)h+='<p class="muted">No furniture placed yet.</p>';
  else h+=`<table class="sch"><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Seats</th>${D.hasRate?'<th style="text-align:right">Amount</th>':''}</tr></thead><tbody>${D.lines.map((l,i)=>`${i===0||D.lines[i-1].grp!==l.grp?`<tr><td colspan="${D.hasRate?4:3}" class="muted" style="font-size:11px;letter-spacing:.06em;padding-top:8px">${{furn:'FURNITURE',ceil:'CEILING ITEMS',build:'DOORS, WINDOWS, COLUMNS AND CORES'}[l.grp]}</td></tr>`:''}<tr><td>${esc(l.name)}<br><span class="muted" style="font-size:11px">${esc(l.code)} · ${fmt(l.w)}×${fmt(l.d)}</span></td><td class="n">${l.qty}</td><td class="n">${l.seats||''}</td>${D.hasRate?`<td class="n">${l.rate!=null?fmt(l.rate*l.qty):''}</td>`:''}</tr>`).join('')}</tbody>${D.hasRate?`<tfoot><tr><td><b>Total</b></td><td class="n"><b>${D.count}</b></td><td class="n"><b>${D.seats}</b></td><td class="n"><b>${fmt(D.cost)}</b></td></tr></tfoot>`:''}</table>`;
  h+=`<div class="sec">Rooms</div>`;
  if(!D.rooms.length)h+='<p class="muted">No rooms drawn yet.</p>';
  else h+=`<table class="sch"><thead><tr><th>Room</th><th style="text-align:right">m²</th><th style="text-align:right">Seats</th><th style="text-align:right">m²/seat</th></tr></thead><tbody>${D.rooms.map(r=>`<tr><td>${esc(r.name)}</td><td class="n">${r.area.toFixed(1)}</td><td class="n">${r.seats||''}</td><td class="n">${r.seats?(r.area/r.seats).toFixed(1):''}</td></tr>`).join('')}</tbody></table>`;
  $('#p-sch').innerHTML=h;
}
function scheduleRows(){
  const D=scheduleData();const rows=[['Plan',S.name],['Exported',new Date().toLocaleString('en-SG')],[]];
  const BS=S.bld&&S.bld.levels.length>1?buildingSchedule():null;
  if(BS){rows.push(['Building'],['Floor','FFL mm','Floor to floor mm','Gross m2','Room area m2','Rooms','Workstations','Seats','Furniture','Ceiling items','Amount']);BS.rows.forEach(r=>rows.push([r.name,r.ffl,r.ftf,r.gross.toFixed(2),r.area.toFixed(2),r.rooms,r.ws,r.seats,r.furn,r.ceil,r.hasRate?r.cost:'']));
    rows.push(['Total','','',BS.tot.gross.toFixed(2),BS.tot.area.toFixed(2),BS.tot.rooms,BS.tot.ws,BS.tot.seats,BS.tot.furn,BS.tot.ceil,BS.hasRate?BS.tot.cost:''],[],[`Open floor: ${levelNames(S.bld)[bldLevel(S).id]}`])}
  {const C=costCalc(BS);rows.push(['Cost estimate'],['Project type',C.label],['Rate S$ per m2 GFA',C.rate==null?'':C.rate],['GFA basis',C.basis==='int'?'Internal (inside face of external walls)':'External (outside face of external walls)'],['GFA m2',C.gfa.toFixed(2),C.override?'your figure':'measured'],['Estimated cost S$',C.total==null?'':Math.round(C.total)],[])}
  const MR=S.objs.filter(o=>o.t==='room').map(o=>[o,migRoom(o)]).filter(x=>x[1]);
  if(MR.length){rows.push(['MIG check'],['Room','Ranks','Entitled m2','Room m2','Difference m2','Result']);MR.forEach(([o,m])=>rows.push([o.name,m.label,m.ent,m.area.toFixed(2),m.diff.toFixed(2),{over:'Over',under:'Under',ok:'Within'}[m.st]]));rows.push([])}
  rows.push(['Items'],['Group','Code','Item','Category','Width mm','Depth mm','Qty','Seats','Unit rate','Amount']);
  D.lines.forEach(l=>rows.push([{furn:'Furniture',ceil:'Ceiling',build:'Building'}[l.grp],l.code,l.name,l.cat,l.w,l.d,l.qty,l.seats,l.rate==null?'':l.rate,l.rate==null?'':l.rate*l.qty]));
  rows.push(['','','Total','','','',D.count,D.seats,'',D.hasRate?D.cost:'']);
  rows.push([],['Rooms'],['Room','Area m2','Furniture','Workstations','Seats','m2 per seat']);
  D.rooms.forEach(r=>rows.push([r.name,r.area.toFixed(2),r.items,r.ws,r.seats,r.seats?(r.area/r.seats).toFixed(2):'']));
  rows.push(['Total',D.area.toFixed(2),D.count,D.ws,D.seats,D.seats?(D.area/D.seats).toFixed(2):'']);
  return rows;
}
async function exportSchedule(){const r=await saveText((S.name||'plan').replace(/[\\/:*?"<>|]+/g,'-')+' schedule.csv','﻿'+toCSV(scheduleRows()),'text/csv','.csv','CSV file');if(r)toast('Schedule exported')}
$('#p-sch').addEventListener('click',e=>{if(e.target.closest('#sch-csv'))exportSchedule();if(e.target.closest('#sch-copy')){const t=scheduleRows().map(r=>r.join('\t')).join('\n');try{navigator.clipboard.writeText(t).then(()=>toast('Copied. Paste into Excel.'),()=>toast('Copy was blocked here. Use Export CSV.'))}catch(err){toast('Copy was blocked here. Use Export CSV.')}}});


/* ---- cost estimate: A&A or new build, a rate per m² of GFA, times the GFA (measured from the floor plates, or the user's own figure) ---- */
function costCfg(){const c=S.cost&&typeof S.cost==='object'?S.cost:{},r=c.rate||{},n=v=>v===null||v===''||v===undefined||!isFinite(+v)||+v<0?null:+v;return{type:c.type==='nb'?'nb':'aa',basis:c.basis==='int'?'int':'ext',rate:{aa:n(r.aa),nb:n(r.nb)},gfa:n(c.gfa)>0?n(c.gfa):null}}
/* internal GFA: each floor plate shrunk by the external wall thickness (outside face to inside face): A − perimeter × t + 4t² */
function plateInner(fp){const t=Math.max(0,+P.wall||150);return fp.reduce((a,p)=>{let per=0;for(let i=0;i<p.length;i++){const q=p[i],r=p[(i+1)%p.length];per+=Math.hypot(r[0]-q[0],r[1]-q[1])}return a+Math.max(0,Math.abs(polyArea(p))-per*t+4*t*t)},0)/1e6}
const GFA_B={ext:'External',int:'Internal'};
const COST_T={aa:'A&A',nb:'New build'};
function gfaMeasured(BS,basis){if(BS)return{gfa:basis==='int'?BS.tot.inner:BS.tot.gross,floors:BS.rows.length};const fp=floorPlate();return{gfa:basis==='int'?plateInner(fp):fp.reduce((a,p)=>a+Math.abs(polyArea(p)),0)/1e6,floors:1}}
function costCalc(BS){if(BS===undefined)BS=S.bld&&S.bld.levels.length>1?buildingSchedule():null;const c=costCfg(),m=gfaMeasured(BS,c.basis),gfa=c.gfa!=null?c.gfa:m.gfa,rate=c.rate[c.type];
  return{type:c.type,basis:c.basis,label:COST_T[c.type],rate,gfa,measured:m.gfa,floors:m.floors,override:c.gfa!=null,total:rate!=null?rate*gfa:null}}
const money=v=>'S$ '+Math.round(v).toLocaleString('en-SG');
function costOut(C){return{total:C.total!=null?money(C.total):'Type a rate',sum:C.total!=null?`${money(C.rate)} × ${C.gfa.toLocaleString('en-SG',{maximumFractionDigits:1})} m² GFA`:`${C.gfa.toLocaleString('en-SG',{maximumFractionDigits:1})} m² GFA`,
  note:`Measured ${C.basis==='int'?'internal':'external'} GFA ${C.measured.toLocaleString('en-SG',{maximumFractionDigits:0})} m²${C.floors>1?` over ${C.floors} floors`:''}, ${C.basis==='int'?'to the inside face of the external walls (perimeter walls left out)':'to the outside face of the external walls'}. ${C.override?'Using your GFA. Clear it to go back to the measured figure.':'Type a GFA to use your own figure.'}`}}
function costHTML(C){const o=costOut(C);return`<div class="sec">Cost estimate</div><div class="cost" id="cost-box">
  <div class="seg" role="group" aria-label="Project type">${Object.entries(COST_T).map(([k,n])=>`<button type="button" class="btn sm${C.type===k?' on':''}" data-cost-type="${k}" aria-pressed="${C.type===k}">${n.replace('&','&amp;')}</button>`).join('')}</div>
  <div class="gfa-b"><span class="muted">GFA measured to</span><div class="seg" role="group" aria-label="GFA basis">${Object.entries(GFA_B).map(([k,n])=>`<button type="button" class="btn sm${C.basis===k?' on':''}" data-gfa-b="${k}" aria-pressed="${C.basis===k}" title="${k==='int'?'Inside face of the external walls: perimeter walls left out':'Outside face of the external walls: perimeter walls included'}">${n}</button>`).join('')}</div></div>
  <div class="fld" style="margin-top:8px"><label>Rate, S$ per m² GFA<input type="number" id="cost-rate" min="0" step="50" inputmode="decimal" value="${C.rate!=null?C.rate:''}" placeholder="${C.label} rate"></label><label>GFA, m²<input type="number" id="cost-gfa" min="0" step="1" inputmode="decimal" value="${C.override?C.gfa:''}" placeholder="${C.measured.toFixed(0)} measured"></label></div>
  <div class="cost-tot"><span id="cost-lbl">Estimated ${C.label} cost</span><b id="cost-total">${o.total}</b><span class="muted" id="cost-sum">${o.sum}</span></div>
  <p class="muted" id="cost-note">${o.note}</p></div>`}
function updateCostOut(){const C=costCalc(),o=costOut(C),g=id=>$('#'+id);if(!g('cost-total'))return;g('cost-total').textContent=o.total;g('cost-sum').textContent=o.sum;g('cost-note').textContent=o.note;g('cost-lbl').textContent=`Estimated ${C.label} cost`}
function setCost(k,v){const c=costCfg();if(k==='type')c.type=v;else if(k==='basis')c.basis=v==='int'?'int':'ext';else if(k==='rate')c.rate[c.type]=v===''?null:Math.max(0,num(v,0));else if(k==='gfa')c.gfa=v===''||!(num(v,0)>0)?null:num(v,0);S.cost=c;markDirty()}
let costPre=null;
$('#p-sch').addEventListener('focusin',e=>{if(e.target.id==='cost-rate'||e.target.id==='cost-gfa')costPre=snapState()});
$('#p-sch').addEventListener('input',e=>{const t=e.target;if(t.id==='cost-rate'){setCost('rate',t.value);updateCostOut()}else if(t.id==='cost-gfa'){setCost('gfa',t.value);updateCostOut()}});
$('#p-sch').addEventListener('change',e=>{const t=e.target;if((t.id==='cost-rate'||t.id==='cost-gfa')&&costPre!=null){if(snapState()!==costPre){pushPast(costPre);future=[]}costPre=snapState()}});
$('#p-sch').addEventListener('click',e=>{const gb=e.target.closest('[data-gfa-b]');if(gb){if(costCfg().basis!==gb.dataset.gfaB){checkpoint();setCost('basis',gb.dataset.gfaB);renderSchedule()}return}const b=e.target.closest('[data-cost-type]');if(!b)return;if(costCfg().type===b.dataset.costType)return;checkpoint();setCost('type',b.dataset.costType);renderSchedule()});

/* ================= underlay panel ================= */
function renderUnderPanel(){
  const el=$('#p-und');const u=S.underlay;
  if(!u||!u.src){el.innerHTML=`<p class="big">Floor plan underlay</p><p class="muted">Load the architect's floor plan as a PDF, PNG or JPEG. You can also drag the file onto the plan, or paste a screenshot with Ctrl V. Then set its scale and let the planner trace the walls and rooms. Nothing leaves this computer.</p><div class="row"><button class="btn sm primary" type="button" data-u="load">Load floor plan (PDF, PNG, JPEG)</button><button class="btn sm" type="button" data-u="pasteimg">Paste image</button></div>${u&&!u.src?'<p class="muted" style="margin-top:8px">This plan had an underlay that was too large for browser storage. Load the file again.</p>':''}`;return}
  const D=P.det,nDet=S.objs.filter(o=>o.det).length;
  const detHTML=`<div class="sec">Walls and rooms</div><p class="muted">Traces walls drawn as solid fill or as two parallel lines, places a door wherever the drawing shows a door swing, and turns each enclosed space into a room measured to the inside wall faces. ${u.calibrated?'':'<b>Set the scale first</b> so wall thickness is read correctly.'}</p>
  <div class="fld"><label>Thinnest wall (mm)<input type="number" id="d-tmin" value="${D.tmin}"></label><label>Thickest wall (mm)<input type="number" id="d-tmax" value="${D.tmax}"></label><label>Close openings up to (mm)<input type="number" id="d-gap" value="${D.gap}"></label><label style="display:flex;align-items:flex-end;gap:6px;color:var(--ink)"><input type="checkbox" id="d-rooms" style="width:auto"${D.rooms?' checked':''}> Make rooms</label><label style="display:flex;align-items:flex-end;gap:6px;color:var(--ink)"><input type="checkbox" id="d-doors" style="width:auto"${D.doors!==false?' checked':''}> Place doors</label><label style="display:flex;align-items:flex-end;gap:6px;color:var(--ink)"><input type="checkbox" id="d-cols" style="width:auto"${D.cols!==false?' checked':''}> Find columns</label><label style="display:flex;align-items:flex-end;gap:6px;color:var(--ink)"><input type="checkbox" id="d-wins" style="width:auto"${D.wins!==false?' checked':''}> Place windows</label></div>
  <div class="row"><button class="btn sm${u.calibrated?' primary':''}" type="button" data-u="detect">Detect in a box…</button><button class="btn sm" type="button" data-u="detall">Detect whole sheet</button>${nDet?`<button class="btn sm" type="button" data-u="undet">Remove traced (${nDet})</button>`:''}</div>
  <p class="muted" style="margin-top:6px">Drag a box around the building to skip the title block and notes. Check the result against the drawing. Undo removes it in one step.</p>`;
  const cal=calib&&calib.length===2?Math.hypot(calib[1][0]-calib[0][0],calib[1][1]-calib[0][1]):0;
  el.innerHTML=`<p class="big">Floor plan underlay</p><p class="muted">${esc(u.name||'')}</p>
  ${pdfDoc&&pdfDoc.numPages>1?`<div class="fld" style="margin-top:8px"><label>Page (of ${pdfDoc.numPages})<input type="number" min="1" max="${pdfDoc.numPages}" id="u-page" value="${u.page||1}"></label><label>&nbsp;<button class="btn sm" type="button" data-u="page">Show page</button></label></div>`:''}
  <div class="sec">Scale</div>
  ${calib?(calib.length<2?`<p class="muted">Click two points on the plan that are a known distance apart, such as a gridline spacing or a dimensioned wall.</p><div class="row"><button class="btn sm" type="button" data-u="cancel">Cancel</button></div>`:`<div class="fld"><label class="full">Real length between the points (mm)<input type="number" id="cal-len" placeholder="e.g. 8400"></label></div><p class="muted">Currently reads ${fmt(cal)} mm.</p><div class="row"><button class="btn sm primary" type="button" data-u="apply">Apply scale</button><button class="btn sm" type="button" data-u="cancel">Cancel</button></div>`)
   :`<p class="muted">${u.calibrated?'Calibrated. Check it with the Measure tool against a known dimension.':(u.sc?'Not calibrated yet. A PDF opens at an assumed 1:100.':'Not calibrated yet. An image has no scale, so set one from a dimension you know, such as a gridline spacing.')}</p><div class="row"><button class="btn sm${u.calibrated?'':' primary'}" type="button" data-u="cal">${u.calibrated?'Recalibrate':'Calibrate from two points'}</button></div>`}
  ${calib?'':detHTML}
  <div class="sec">Display</div>
  <label class="fld" style="display:block"><span class="muted">Opacity</span><input type="range" min="0.1" max="1" step="0.05" id="u-op" value="${u.op==null?0.6:u.op}"></label>
  <div class="row"><button class="btn sm" type="button" data-u="vis">${u.visible===false?'Show':'Hide'}</button><button class="btn sm${underMove?' on':''}" type="button" data-u="move">${underMove?'Done moving':'Move underlay'}</button><button class="btn sm" type="button" data-u="load">Replace</button><button class="btn sm" type="button" data-u="pasteimg">Paste image</button><button class="btn sm" type="button" data-u="del">Remove</button></div>
  <p class="muted" style="margin-top:10px">Saving the plan file stores the underlay inside it, so the file opens anywhere with the floor plan in place.</p>`;
}
$('#p-und').addEventListener('click',async e=>{const b=e.target.closest('[data-u]');if(!b)return;const a=b.dataset.u;const u=S.underlay;
  if(a==='load')$('#f-under').click();
  else if(a==='pasteimg'){try{const items=await navigator.clipboard.read();for(const it of items){const t=it.types.find(x=>/^image\//.test(x));if(t){const bl=await it.getType(t);loadUnderFile(new File([bl],'Pasted floor plan.'+(t.split('/')[1]||'png').replace('jpeg','jpg'),{type:t}));return}}toast('There is no image on the clipboard. Copy the floor plan image first.')}catch(err){toast('The browser blocked clipboard access. Click the plan and press Ctrl V instead.')}}
  else if(a==='page'){await renderPdfPage(num($('#u-page').value,1))}
  else if(a==='cal'){calib=[];underMove=false;setTool('select');renderUnderPanel();updateHint()}
  else if(a==='cancel'){calib=null;renderUnderPanel();updateHint();render()}
  else if(a==='apply'){const real=num($('#cal-len').value,0);const m=Math.hypot(calib[1][0]-calib[0][0],calib[1][1]-calib[0][1]);if(!(real>0)||m<1)return toast('Enter the real length in mm');checkpoint();const f=real/m;const p=calib[0];u.x=p[0]-(p[0]-u.x)*f;u.y=p[1]-(p[1]-u.y)*f;u.mpp*=f;u.calibrated=true;calib=null;
    /* walls and rooms traced from this drawing scale with it */
    const sc=q=>[Math.round(p[0]+(q[0]-p[0])*f),Math.round(p[1]+(q[1]-p[1])*f)];let nd=0;
    S.objs.forEach(o=>{if(!o.det)return;nd++;o.pts=o.pts.map(sc);if(o.t==='wall')o.th=Math.max(20,Math.round(o.th*f/10)*10)});clashDirty=true;
    syncUnder();updateHint();render();toast(`Scale set. ${fmt(real)} mm now matches.${nd?' Traced walls and rooms were rescaled too.':''}`)}
  else if(a==='detall'){readDetOpts();runDetect(null);return}
  else if(a==='detect'){readDetOpts();calib=null;underMove=false;setTool('select');detBox=true;updateHint();render();toast('Drag a box around the floor plan, or press Enter for the whole sheet')}
  else if(a==='undet'){checkpoint();S.objs=S.objs.filter(o=>!o.det);[...sel].forEach(id=>{if(!byId(id))sel.delete(id)});clashDirty=true;render();renderInspector();renderUnderPanel();toast('Traced walls and rooms removed')}
  else if(a==='vis'){checkpoint();u.visible=u.visible===false;syncUnder()}
  else if(a==='move'){underMove=!underMove;calib=null;if(underMove)setTool('select');renderUnderPanel();updateHint()}
  else if(a==='del'){checkpoint();S.underlay=null;underMove=false;calib=null;syncUnder();updateHint()}
});
$('#p-und').addEventListener('input',e=>{if(e.target.id==='u-op'&&S.underlay){S.underlay.op=num(e.target.value,0.6);updateUnderImg();markDirty()}});
$('#p-und').addEventListener('change',e=>{if(/^d-/.test(e.target.id))readDetOpts()});
function readDetOpts(){const g=(id,d)=>{const el=$('#'+id);return el?num(el.value,d):d};const D=P.det;
  D.tmin=Math.max(20,g('d-tmin',D.tmin));D.tmax=Math.max(D.tmin+10,g('d-tmax',D.tmax));D.gap=Math.max(0,g('d-gap',D.gap));const r=$('#d-rooms');if(r)D.rooms=r.checked;const dr=$('#d-doors');if(dr)D.doors=dr.checked;const dc=$('#d-cols');if(dc)D.cols=dc.checked;const dw=$('#d-wins');if(dw)D.wins=dw.checked;savePrefs()}
$('#p-und').addEventListener('keydown',e=>{if(e.target.id==='cal-len'&&e.key==='Enter'){e.preventDefault();$('[data-u="apply"]').click()}});
$('#f-under').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)loadUnderFile(f)});

/* ================= wall and room detection =================
   Runs entirely in the browser on the underlay image.
   1. Ink mask: Otsu threshold on luminance.
   2. Long straight runs across rows (horizontal walls) and down columns (vertical walls), stacked into bands.
   3. Bands as thick as a wall are solid-fill walls. Thin bands are lines: two parallel lines a wall-thickness apart make a double-line wall.
   4. Touching bands merge, ends snap to the centreline of the wall they meet.
   5. Rooms: walls are rasterised, door openings bridged, the outside flood-filled, and each enclosed space traced to a polygon. */
function otsu(lum,n){const h=new Array(256).fill(0);for(let i=0;i<n;i++)h[lum[i]]++;let sum=0;for(let i=0;i<256;i++)sum+=i*h[i];let sB=0,wB=0,best=-1,thr=128;for(let t=0;t<256;t++){wB+=h[t];if(!wB)continue;const wF=n-wB;if(!wF)break;sB+=t*h[t];const mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>best){best=v;thr=t}}return thr}
function findBands(bin,W,H,minLen,horiz){
  const N=horiz?H:W,M=horiz?W:H;let active=[];const done=[];const line=new Uint8Array(M);
  for(let i=0;i<N;i++){
    if(horiz)line.set(bin.subarray(i*W,i*W+W));else for(let j=0;j<H;j++)line[j]=bin[j*W+i];
    const runs=[];let j=0;while(j<M){if(line[j]){let k=j;while(k<M&&line[k])k++;if(k-j>=minLen)runs.push([j,k-1]);j=k}else j++}
    const next=[];
    runs.forEach(([a,b])=>{let m=null;for(const bd of active){if(bd.used===i)continue;const ov=Math.min(b,bd.b)-Math.max(a,bd.a),la=b-a,lb=bd.b-bd.a;if(ov>=0.6*Math.min(la,lb)&&la<=lb*1.8+4&&lb<=la*1.8+4){m=bd;break}}
      if(m){m.used=i;m.i1=i;m.a=a;m.b=b;m.as.push(a);m.bs.push(b);next.push(m)}else next.push({i0:i,i1:i,a,b,as:[a],bs:[b],used:i})});
    active.forEach(bd=>{if(bd.used!==i)done.push(bd)});active=next;
  }
  done.push(...active);
  const med=arr=>{const s=arr.slice().sort((x,y)=>x-y);return s[s.length>>1]};
  return done.map(bd=>({c:(bd.i0+bd.i1+1)/2,t:bd.i1-bd.i0+1,a0:med(bd.as),a1:med(bd.bs)+1}));
}
function subtractIv(iv,used){let out=[iv];used.forEach(([u0,u1])=>{const n=[];out.forEach(([a,b])=>{if(u1<=a||u0>=b){n.push([a,b]);return}if(u0>a)n.push([a,u0]);if(u1<b)n.push([u1,b])});out=n});return out}
function traceWalls(bin,W,H,ps,D){
  const minT=D.tmin/ps,maxT=D.tmax/ps,minLen=Math.max(6,Math.round(Math.max(450,D.tmax*1.3)/ps)),thinLen=Math.max(5,Math.round(150/ps));
  const walls=[],wins=[],cols=D._cols||[];
  const inkAt=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&bin[y*W+x];
  const allBands=[findBands(bin,W,H,thinLen,true),findBands(bin,W,H,thinLen,false)];
  /* the drawing's own wall weight: walls drawn heavier than the limit (small pictures, estate agents' plans) are
     taken up to a quarter beyond the heaviest common band, so long and short pieces are read alike */
  let maxS=maxT;{const hist=new Map();allBands.forEach(bs=>bs.forEach(b=>{const L=b.a1-b.a0;if(b.t<minT*0.85||b.t>3*maxT||L<2*minLen||L<4*b.t)return;const k=Math.round(b.t);hist.set(k,(hist.get(k)||0)+L)}));
    /* the heavy end of the drawing's walls: the 95th percentile of band thickness, weighted by length */
    const ks=[...hist.keys()].sort((a,b)=>a-b),tot=ks.reduce((a,k)=>a+hist.get(k),0);let acc=0,p90=0;for(const k of ks){acc+=hist.get(k);if(acc>=0.95*tot){p90=k;break}}
    if(p90>0.6*maxT)maxS=Math.max(maxT,Math.min(3*maxT,1.25*p90));if(D._dbg)D._dbg.push(['maxS',[{o:'-',c:maxS,t:p90,a0:maxT,a1:minT,k:JSON.stringify([...hist])}]])}
  [true,false].forEach((horiz,hi)=>{
    const o=horiz?'h':'v';const bands=allBands[hi];const thin=[];
    bands.forEach(b=>{const L=b.a1-b.a0;if(b.t>=minT*0.85&&b.t<=maxS){if(L>=minLen)walls.push({o,c:b.c,t:b.t,a0:b.a0,a1:b.a1,k:'solid'})}else if(b.t<minT*0.85)thin.push(Object.assign(b,{up:[],dn:[]}))});
    /* ink running across the line at a position along it: a wall meeting this line there */
    const junction=(c,a)=>{const ci=Math.round(c),ai=Math.round(a),need=Math.max(6,Math.round(minT*0.6));
      for(const da of [0,-1,1])for(const side of [-1,1]){let run=0,gap=0;for(let d=2;d<=need+4;d++){const q=ci+side*d;if(horiz?inkAt(ai+da,q):inkAt(q,ai+da)){run++;gap=0;if(run>=need)return true}else if(++gap>1)break}}return false};
    /* ink crossing the whole space between two lines, away from the ends: a wall drawn as two faces has none (furniture and door leaves do) */
    /* a line of text reads as two lines (tops and bottoms of the letters) with a lot of ink between: a wall is mostly empty or hatched */
    const dense=(cA,cB,a,b)=>{const i0=Math.round(cA)+2,i1=Math.round(cB)-2,wd=i1-i0+1;if(wd<5)return false;let ink=0,n=0,tall=0,cols=0;
      for(let p=Math.round(a);p<=Math.round(b);p+=2){let k=0;for(let q=i0;q<=i1;q++){n++;if(horiz?inkAt(p,q):inkAt(q,p)){ink++;k++}}cols++;if(k>=0.6*wd)tall++}
      /* a centreline or hatch leaves most of the space empty; letters fill it and stand across it */
      return n>0&&(ink/n>0.45||tall/cols>0.3)};
    const crossed=(cA,cB,a,b)=>{const i0=Math.round(cA)+2,i1=Math.round(cB)-2;if(i1-i0<2)return false;const T=cB-cA,m=Math.max(6,Math.round(T*0.6));const I=(p,q)=>horiz?inkAt(p,q):inkAt(q,p);
      /* window jambs cross the wall too: skip the windows already found on this wall */
      const skip=wins.filter(w=>w.o===o&&Math.abs(w.c-(cA+cB)/2)<=T).map(w=>[w.a0-8,w.a1+8]);
      const full=p=>{for(let q=i0;q<=i1;q++)if(!I(p,q))return false;return true};
      /* a line running straight through both faces (a gridline, a wall met end on) is not furniture */
      const thru=p=>(I(p,i0-6)||I(p,i0-7))&&(I(p,i1+6)||I(p,i1+7));
      let n=0,prev=false;const a0=Math.round(a),b0=Math.round(b);
      for(let p=a0+m;p<b0-m;p++){if(skip.some(([s0,s1])=>p>=s0&&p<=s1)){prev=false;continue}const f=full(p)&&!thru(p);if(f&&!prev)n++;prev=f}
      if(n>=(b-a>3000/ps?3:1))return true;
      /* a box: an edge across at each end, with a line running on past the end (a door leaf beside a fitting, a counter against a face) */
      const A=Math.round(cA),B=Math.round(cB);
      const boxed=(e,dir)=>{let cross=false;for(let d=0;d<=m&&!cross;d++){const p=e+dir*d;if(full(p)&&!thru(p))cross=true}if(!cross)return 0;
        for(let k=3;k<=6;k++){const p=e-dir*k;if(I(p,A)||I(p,B))return 2}return 1};
      const ba=boxed(a0,1),bb=boxed(b0,-1);if(ba===2&&bb===2)return true;
      /* closed at both ends by a line across (a box): kept only if it later proves to lie on a wall line */
      return ba&&bb?'box':false};
    /* dashed lines (grids, hidden edges) are chains of short pieces on one line with empty gaps: never walls or glass.
       A face line broken by the walls that meet it has ink across every break, so it stays */
    {const byC=thin.slice().sort((p,q)=>p.c-q.c||p.a0-q.a0);const dashed=new Set();const gapMax=Math.max(4,Math.round(350/ps)),dashMax=2500/ps;
      for(let i=0;i<byC.length;){let j=i;while(j+1<byC.length&&Math.abs(byC[j+1].c-byC[i].c)<=1.2)j++;
        const grp=byC.slice(i,j+1).sort((p,q)=>p.a0-q.a0);let run=[grp[0]];
        const flush=()=>{if(run.length<3)return;let empty=0;for(let k=1;k<run.length;k++){if(!junction(run[k-1].c,run[k-1].a1)&&!junction(run[k].c,run[k].a0))empty++}if(empty<0.6*(run.length-1))return;
          const ls=run.map(b=>b.a1-b.a0).sort((p,q)=>p-q),md=ls[Math.floor(ls.length*0.25)];run.forEach(b=>{if(b.a1-b.a0<Math.min(dashMax,md*2.2))dashed.add(b)})};
        for(let k=1;k<grp.length;k++){const prev=run[run.length-1],g=grp[k].a0-prev.a1;/* a dash gap is about as long as the dashes */if(g>=0&&g<=Math.max(gapMax,1.3*Math.min(prev.a1-prev.a0,grp[k].a1-grp[k].a0)))run.push(grp[k]);else{flush();run=[grp[k]]}}flush();i=j+1}
      for(let i=thin.length-1;i>=0;i--)if(dashed.has(thin[i]))thin.splice(i,1)}
    thin.sort((p,q)=>p.c-q.c);
    /* a sketch: every long line is a wall of the thinnest thickness */
    if(D._single){thin.forEach(b=>{if(b.a1-b.a0>=Math.max(2*thinLen,300/ps))walls.push({o,c:b.c,t:Math.max(minT,100/ps),a0:b.a0,a1:b.a1,k:'line'})});return}
    /* a window is drawn as the two wall faces running on, with one or two glass lines between them.
       Glass lines are taken out (and remembered as windows) so the faces pair up into one continuous wall */
    const glass=new Set();
    thin.forEach(M=>{if(M.a1-M.a0<Math.max(thinLen,600/ps))return;for(const A of thin){if(A.c>=M.c-0.5||M.c-A.c>maxT)continue;for(const B of thin){if(B.c<=M.c+0.5)continue;const T=B.c-A.c;if(T<minT||T>maxT)continue;
      if(Math.abs(M.c-(A.c+B.c)/2)>0.34*T)continue;const lo=Math.max(A.a0,B.a0)-3,hi=Math.min(A.a1,B.a1)+3;if(M.a0<lo||M.a1>hi)continue;
      if(!glass.has(M)){glass.add(M);wins.push({o,c:(A.c+B.c)/2,t:T,a0:M.a0,a1:M.a1})}return}}});
    for(let i=thin.length-1;i>=0;i--)if(glass.has(thin[i]))thin.splice(i,1);
    /* two parallel lines a wall thickness apart are a double-line wall. A line is one face of one wall only:
       the near side of a wall never doubles as the far side of another */
    const cand=[];
    /* four or more lines at one spacing are a pattern (tiles, stair treads, hatching), not wall faces */
    const series=(A,B,T,lo,hi)=>{const at=c=>thin.some(X=>Math.abs(X.c-c)<=Math.max(1.5,0.12*T)&&Math.min(X.a1,hi)-Math.max(X.a0,lo)>=0.5*(hi-lo));
      let n=2;if(at(A.c-T))n++;if(at(B.c+T))n++;if(n>=4)return true;if(at(A.c-T)&&at(A.c-2*T))return true;if(at(B.c+T)&&at(B.c+2*T))return true;return false};
    for(let i=0;i<thin.length;i++){const A=thin[i];
      for(let j=i+1;j<thin.length;j++){const B=thin[j];const T=B.c-A.c;if(T>maxT)break;if(T<minT)continue;
        const lo=Math.max(A.a0,B.a0),hi=Math.min(A.a1,B.a1),need=Math.max(Math.round(minLen*0.5),Math.round(1.2*T),thinLen);if(hi-lo<need)continue;if(series(A,B,T,lo,hi))continue;cand.push({A,B,T,lo,hi,need})}}
    /* longest overlaps first: a door leaf beside a partition loses to the partition's own faces */
    cand.sort((p,q)=>(q.hi-q.lo)-(p.hi-p.lo)).forEach(({A,B,T,lo,hi,need})=>{
      let pcs=subtractIv([lo,hi],A.up.concat(A.dn));pcs=pcs.flatMap(p=>subtractIv(p,B.dn.concat(B.up))).filter(([a,b])=>b-a>=need);
      pcs.forEach(([a,b])=>{const cr=crossed(A.c,B.c,a,b);if(cr===true||dense(A.c,B.c,a,b))return;walls.push({o,c:(A.c+B.c)/2,t:T,a0:a,a1:b,k:'pair',box:cr==='box'});A.up.push([a,b]);B.dn.push([a,b])})});
  });
  /* a run of four or more parallel solid bands at one spacing is a pattern (floor tiles, stair treads, louvres), not walls */
  {const drop=new Set();walls.forEach(w=>{if(w.k!=='solid'||w.t>minT*1.5)return;const near=walls.filter(q=>q!==w&&q.o===w.o&&q.k==='solid'&&Math.abs(q.c-w.c)<=3*maxT&&Math.min(q.a1,w.a1)-Math.max(q.a0,w.a0)>=0.5*Math.min(q.a1-q.a0,w.a1-w.a0));
      if(near.length<3)return;const ds=near.map(q=>Math.abs(q.c-w.c)).sort((a,b)=>a-b);const d0=ds[0];if(d0<2)return;let n=1;ds.slice(1).forEach(d=>{const r=d/d0;if(Math.abs(r-Math.round(r))<=0.15*Math.round(r)&&Math.round(r)<=4)n++});if(n>=3)drop.add(w)});
    if(drop.size)for(let i=walls.length-1;i>=0;i--)if(drop.has(walls[i]))walls.splice(i,1)}
  if(D._dbg)D._dbg.push(['raw',walls.map(w=>Object.assign({},w))]);
  /* merge bands that touch side by side, or meet end to end with a hairline gap */
  let changed=true,guard=0;
  while(changed&&guard++<200){changed=false;
    for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){const a=walls[i],b=walls[j];if(a.o!==b.o)continue;
      const ov=Math.min(a.a1,b.a1)-Math.max(a.a0,b.a0);if(ov<-3)continue;
      const lo=Math.min(a.c-a.t/2,b.c-b.t/2),hi=Math.max(a.c+a.t/2,b.c+b.t/2);
      if(Math.abs(a.c-b.c)>(a.t+b.t)/2+1.5)continue;if(hi-lo>maxS*1.3)continue;
      /* end to end: only pieces of the same wall, lined up and alike in thickness */
      if(ov<Math.min(a.a1-a.a0,b.a1-b.a0)*0.3&&(Math.abs(a.c-b.c)>Math.max(1.5,Math.min(a.t,b.t)*0.2)||Math.abs(a.t-b.t)>Math.max(2,0.35*Math.max(a.t,b.t))))continue;
      walls[i]={o:a.o,c:(lo+hi)/2,t:hi-lo,a0:Math.min(a.a0,b.a0),a1:Math.max(a.a1,b.a1),k:a.k==='solid'||b.k==='solid'?'solid':'pair',box:a.box&&b.box};walls.splice(j,1);changed=true;j--}}
  if(D._dbg)D._dbg.push(['m1',walls.map(w=>Object.assign({},w))]);
  /* a double-line wall runs on past the wall that meets it: the far face is unbroken, the near face has a gap as wide as the crossing wall */
  {let ch=true,g2=0;while(ch&&g2++<60){ch=false;
    for(let i=0;i<walls.length&&!ch;i++)for(let j=0;j<walls.length;j++){if(i===j)continue;const a=walls[i],b=walls[j];if(a.o!==b.o||a.k!=='pair'||b.k!=='pair')continue;
      if(Math.abs(a.c-b.c)>Math.max(1.5,0.2*a.t)||Math.abs(a.t-b.t)>Math.max(2,0.25*a.t))continue;const g=b.a0-a.a1;if(g<0||g>maxT*1.3+2)continue;
      /* unbroken ink on one face across the gap */
      const faces=[a.c-a.t/2,a.c+a.t/2].map(f=>{let hit=0,n=0;for(let p=Math.round(a.a1);p<=Math.round(b.a0);p++){n++;const f0=Math.round(f);if(a.o==='h'?(inkAt(p,f0)||inkAt(p,f0-1)||inkAt(p,f0+1)):(inkAt(f0,p)||inkAt(f0-1,p)||inkAt(f0+1,p)))hit++}return n?hit/n:0});
      if(Math.max(faces[0],faces[1])<0.85)continue;
      walls[i]={o:a.o,c:(a.c*(a.a1-a.a0)+b.c*(b.a1-b.a0))/((a.a1-a.a0)+(b.a1-b.a0)),t:Math.max(a.t,b.t),a0:a.a0,a1:b.a1,k:'pair'};walls.splice(j,1);ch=true;break}}}
  if(D._dbg)D._dbg.push(['m2',walls.map(w=>Object.assign({},w))]);
  /* a double-line wall ends where its faces end, even when the near face was broken by a wall meeting it just before:
     follow the unbroken face past the end (no further than a wall thickness and a half) */
  walls.forEach(w=>{if(w.k!=='pair')return;const f=[Math.round(w.c-w.t/2),Math.round(w.c+w.t/2)];const faceInk=(p,q)=>w.o==='h'?(inkAt(p,q)||inkAt(p,q-1)||inkAt(p,q+1)):(inkAt(q,p)||inkAt(q-1,p)||inkAt(q+1,p));
    [['a1',1],['a0',-1]].forEach(([end,dir])=>{const e=Math.round(w[end]);let last=e,blank=0;const lim=Math.round(maxT*1.5);
      for(let d=1;d<=lim;d++){const p=e+dir*d;if(faceInk(p,f[0])||faceInk(p,f[1])){last=p;blank=0}else if(++blank>2)break}
      /* the run must end on something: a line across (jamb), or simply the end of the drawn face */
      if(Math.abs(last-e)>=2)w[end]=last})});
  if(D._dbg)D._dbg.push(['m3',walls.map(w=>Object.assign({},w))]);
  /* a wall interrupted by a column carries on through it */
  if(cols.length){let ch=true,g2=0;while(ch&&g2++<50){ch=false;
    for(let i=0;i<walls.length&&!ch;i++)for(let j=0;j<walls.length;j++){if(i===j)continue;const a=walls[i],b=walls[j];if(a.o!==b.o||b.a0<a.a1-2)continue;
      if(Math.abs(a.c-b.c)>Math.max(2,0.3*Math.min(a.t,b.t))||Math.abs(a.t-b.t)>Math.max(3,0.35*Math.max(a.t,b.t)))continue;const g0=a.a1,g1=b.a0;
      const col=cols.find(q=>{const along=a.o==='h'?q.x:q.y,acr=a.o==='h'?q.y:q.x,ha=(a.o==='h'?q.w:q.h)/2,hc=(a.o==='h'?q.h:q.w)/2;return Math.abs(acr-a.c)<=hc+2&&along-ha<=g0+3&&along+ha>=g1-3});
      if(!col)continue;walls[i]={o:a.o,c:(a.c*(a.a1-a.a0)+b.c*(b.a1-b.a0))/((a.a1-a.a0)+(b.a1-b.a0)),t:Math.max(a.t,b.t),a0:a.a0,a1:b.a1,k:a.k};walls.splice(j,1);ch=true;break}}}
  /* two lines inside or continuing the band of a solid wall (the window symbol drawn in it) are not a wall of their own */
  for(let i=walls.length-1;i>=0;i--){const p=walls[i];if(p.k!=='pair')continue;
    if(walls.some(w=>w!==p&&w.k==='solid'&&w.o===p.o&&Math.abs(p.c-w.c)<=w.t/2&&p.t<=0.8*w.t&&p.a1>=w.a0-2*p.t&&p.a0<=w.a1+2*p.t))walls.splice(i,1)}
  if(D._dbg)D._dbg.push(['merged',walls.map(w=>Object.assign({},w))]);
  /* to millimetres */
  const mm=walls.map(w=>({o:w.o,c:w.c*ps,t:w.t*ps,a0:w.a0*ps,a1:w.a1*ps,k:w.k,box:w.box}));
  /* ends: a wall that runs into another ends on its centreline. Only ends already inside that wall's band are moved,
     so a door jamb just past a corner stays where the drawing has it */
  const slack=Math.max(35,2.5*ps);
  const fix=(A,B)=>A.forEach(w=>['a0','a1'].forEach(end=>{const e=w[end];let best=null;
    B.forEach(q=>{const d=Math.abs(q.c-e);if(d>q.t/2+slack)return;if(w.c<q.a0-w.t/2-slack||w.c>q.a1+w.t/2+slack)return;if(!best||d<best.d)best={d,q}});
    if(best){w[end]=best.q.c;const q=best.q;if(w.c<q.a0)q.a0=w.c;if(w.c>q.a1)q.a1=w.c}}));
  const Hs=mm.filter(w=>w.o==='h'),Vs=mm.filter(w=>w.o==='v');fix(Hs,Vs);fix(Vs,Hs);fix(Hs,Vs);
  const r5=v=>Math.round(v/5)*5;
  /* short pieces touching nothing at either end are furniture or symbols, not walls */
  const colsMM=cols.map(q=>({x0:(q.x-q.w/2)*ps,x1:(q.x+q.w/2)*ps,y0:(q.y-q.h/2)*ps,y1:(q.y+q.h/2)*ps}));
  /* an end is free unless it runs into a wall across it or continues into one on the same line (a parallel neighbour is not a junction) */
  const endFree=(w,e)=>{const p=w.o==='h'?[e,w.c]:[w.c,e];const near=mm.some(q=>{if(q===w)return false;if(q.o===w.o&&Math.abs(q.c-w.c)>Math.max(q.t,w.t)/2)return false;const sa=q.o==='h'?[q.a0,q.c]:[q.c,q.a0],sb=q.o==='h'?[q.a1,q.c]:[q.c,q.a1];return segDist(p[0],p[1],sa,sb)<=q.t/2+w.t/2+150});
    return!near&&!colsMM.some(c=>p[0]>=c.x0-200&&p[0]<=c.x1+200&&p[1]>=c.y0-200&&p[1]<=c.y1+200)};
  /* a piece on the same line as a longer wall nearby (the stretch of partition between two doors) is wall */
  const collinear=w=>mm.some(q=>q!==w&&q.o===w.o&&Math.abs(q.c-w.c)<=Math.max(q.t,w.t)/2&&q.a1-q.a0>=1000&&(q.a0-w.a1<=D.gap+300&&w.a0-q.a1<=D.gap+300));
  const keep=mm.filter(w=>{const L=w.a1-w.a0;if(L<Math.max(200,D.tmin*2))return false;const f0=endFree(w,w.a0),f1=endFree(w,w.a1);
    if(f0&&f1&&L<(w.k==='pair'?2500:1500)&&!collinear(w))return false;
    /* a box of lines (a sofa, a counter, a bed) that is not on any wall line */
    if(w.box&&L<3500&&!collinear(w))return false;
    /* a stub of two lines hanging off a wall is a door leaf or a fitting beside it; in a sketch a short free line is a door leaf */
    if(w.k==='pair'&&(f0||f1)&&L<2.5*w.t)return false;if(w.k==='line'&&(f0||f1)&&L<1200&&!collinear(w))return false;return true});
  const out=keep.map(w=>({o:w.o,c:r5(w.c),t:Math.max(50,Math.round(w.t/10)*10),a0:r5(w.a0),a1:r5(w.a1),k:w.k}));
  if(D._dbg)D._dbg.push(['keep',out.map(w=>({o:w.o,c:w.c/ps,t:w.t/ps,a0:w.a0/ps,a1:w.a1/ps,k:w.k}))]);
  /* windows: one per opening (two glass lines are one window), in millimetres */
  const wmm=wins.map(w=>({o:w.o,c:w.c*ps,t:w.t*ps,a0:w.a0*ps,a1:w.a1*ps})).filter(w=>w.a1-w.a0>=600).sort((p,q)=>p.a0-q.a0);
  const wout=[];wmm.forEach(w=>{const m=wout.find(q=>q.o===w.o&&Math.abs(q.c-w.c)<=Math.max(q.t,w.t)&&Math.min(q.a1,w.a1)-Math.max(q.a0,w.a0)>-100);if(m){m.a0=Math.min(m.a0,w.a0);m.a1=Math.max(m.a1,w.a1);m.c=(m.c+w.c)/2}else wout.push(w)});
  /* a gap in a solid wall that thin lines run across is a window too */
  gapWindows(out,bin,W,H,ps,D).forEach(w=>{if(!wout.some(q=>q.o===w.o&&Math.abs(q.c-w.c)<=Math.max(q.t,w.t)&&Math.min(q.a1,w.a1)-Math.max(q.a0,w.a0)>0))wout.push(w)});
  /* the wall carries on under a window: join the two pieces either side of it */
  wout.forEach(w=>{const a=out.find(q=>q.o===w.o&&Math.abs(q.c-w.c)<=q.t&&Math.abs(q.a1-w.a0)<=60),b=out.find(q=>q.o===w.o&&Math.abs(q.c-w.c)<=q.t&&Math.abs(q.a0-w.a1)<=60);
    if(a&&b&&a!==b){a.a1=b.a1;a.c=r5((a.c+b.c)/2);a.t=Math.max(a.t,b.t);out.splice(out.indexOf(b),1)}});
  out.windows=wout.map(w=>({o:w.o,c:r5(w.c),t:Math.max(50,Math.round(w.t/10)*10),a0:r5(w.a0),a1:r5(w.a1)}));
  return out;
}
/* windows in solid-fill drawings: the wall stops, one to three thin lines span the opening along the wall, the wall resumes.
   The opening is either a gap between two pieces, or a hollow stretch inside one piece when the lines made the band read as continuous */
function gapWindows(walls,bin,W,H,ps,D){
  const out=[];const inkAt=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&y>=0&&x<W&&y<H&&bin[y*W+x]};
  const I=(o,p,q)=>o==='h'?inkAt(p/ps,q/ps):inkAt(q/ps,p/ps);
  /* lines along the opening: fraction covered on several offsets across the wall */
  const lined=(o,c,t,p0,p1)=>{let best=0;[-t/2,-t/3,-t/6,0,t/6,t/3,t/2].forEach(off=>{let hit=0,n=0;for(let p=p0;p<=p1;p+=ps){n++;const q=c+off;if(I(o,p,q)||I(o,p,q-ps)||I(o,p,q+ps))hit++}const cov=n?hit/n:0;if(cov>best)best=cov});return best};
  /* ink across the band at one position along it */
  const across=(o,c,t,p)=>{let k=0,n=0;for(let q=c-t/2+ps;q<=c+t/2-ps;q+=ps){n++;if(I(o,p,q))k++}return n?k/n:1};
  const add=(o,c,t,p0,p1)=>{if(p1-p0<500)return;if(lined(o,c,t,p0+t/2,p1-t/2)<0.7)return;
    let solid=0,n=0;for(let p=p0+t/4;p<=p1-t/4;p+=ps){n++;if(across(o,c,t,p)>=0.8)solid++}if(n&&solid/n>0.6)return;
    out.push({o,c,t,a0:p0,a1:p1})};
  walls.forEach(a=>walls.forEach(b=>{if(a===b||a.o!==b.o||b.a0<a.a1)return;const g=b.a0-a.a1;if(g<300||g>4000)return;if(Math.abs(a.c-b.c)>Math.max(a.t,b.t)/2)return;
    if(walls.some(q=>q!==a&&q!==b&&q.o===a.o&&Math.abs(q.c-a.c)<=Math.max(a.t,q.t)&&q.a0<b.a0&&q.a1>a.a1))return; /* something else already in the gap */
    add(a.o,(a.c+b.c)/2,Math.min(a.t,b.t),a.a1,b.a0)}));
  walls.forEach(w=>{if(w.k!=='solid'||w.t<4*ps)return;let run=null;
    for(let p=w.a0+w.t/2;p<=w.a1-w.t/2;p+=ps){const hollow=across(w.o,w.c,w.t,p)<=0.5;
      if(hollow){if(!run)run=[p,p];else run[1]=p}else if(run){if(run[1]-run[0]>=500-ps)add(w.o,w.c,w.t,run[0]-ps/2,run[1]+ps/2);run=null}}
    if(run&&run[1]-run[0]>=500-ps)add(w.o,w.c,w.t,run[0]-ps/2,run[1]+ps/2)});
  return out}
/* columns: solid squares and circles (or crossed / hatched outlines) clearly thicker than the walls.
   Outlines are filled first, then a distance map finds compact thick cores at a few depths. Returns pixel boxes. */
function detectColumns(bin,W,H,ps,D){
  const N=W*H,minC=Math.max(D.cmin||250,(D.tmax||350)*0.9)/ps,maxC=(D.cmax||1500)/ps;
  /* fill small enclosed white areas, so outlined columns become solid */
  const out=new Uint8Array(N),st=[];const push=k=>{if(bin[k]||out[k])return;out[k]=1;st.push(k)};
  for(let i=0;i<W;i++){push(i);push((H-1)*W+i)}for(let j=0;j<H;j++){push(j*W);push(j*W+W-1)}
  while(st.length){const k=st.pop(),i=k%W;if(i>0)push(k-1);if(i<W-1)push(k+1);if(k>=W)push(k-W);if(k<N-W)push(k+W)}
  const fil=bin.slice();const lab=new Int32Array(N);let id=0;
  for(let k0=0;k0<N;k0++){if(bin[k0]||out[k0]||lab[k0])continue;id++;const cells=[k0];lab[k0]=id;let x0=1e9,x1=-1,y0=1e9,y1=-1,big=false;
    for(let q=0;q<cells.length;q++){const k=cells[q],i=k%W,j=(k/W)|0;if(i<x0)x0=i;if(i>x1)x1=i;if(j<y0)y0=j;if(j>y1)y1=j;if(x1-x0>maxC||y1-y0>maxC){big=true}
      if(cells.length>maxC*maxC*1.2){big=true;break}
      [k-1,k+1,k-W,k+W].forEach(n=>{if(n<0||n>=N||bin[n]||out[n]||lab[n])return;if((n%W===0&&k%W===W-1)||(k%W===0&&n%W===W-1))return;lab[n]=id;cells.push(n)})}
    /* only compact pockets (a crossed or hatched column splits into small triangles); long wall interiors stay open */
    const bw=x1-x0+1,bh=y1-y0+1;if(!big&&Math.max(bw,bh)<=2.2*Math.min(bw,bh)+2)cells.forEach(k=>fil[k]=1)}
  const cols=[];const taken=new Uint8Array(N);
  /* pass 1 finds solid columns on the drawing as it is; pass 2 finds crossed or hatched outlines on the filled copy */
  const scan=(img,want)=>{
  /* chamfer distance to white, in pixels */
  const Dt=new Float32Array(N);for(let k=0;k<N;k++)Dt[k]=img[k]?1e6:0;
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const k=j*W+i;if(!Dt[k])continue;let v=Dt[k];if(i>0)v=Math.min(v,Dt[k-1]+1);if(j>0){v=Math.min(v,Dt[k-W]+1);if(i>0)v=Math.min(v,Dt[k-W-1]+1.414);if(i<W-1)v=Math.min(v,Dt[k-W+1]+1.414)}else v=Math.min(v,1);if(i===0)v=Math.min(v,1);Dt[k]=v}
  for(let j=H-1;j>=0;j--)for(let i=W-1;i>=0;i--){const k=j*W+i;if(!Dt[k])continue;let v=Dt[k];if(i<W-1)v=Math.min(v,Dt[k+1]+1);if(j<H-1){v=Math.min(v,Dt[k+W]+1);if(i<W-1)v=Math.min(v,Dt[k+W+1]+1.414);if(i>0)v=Math.min(v,Dt[k+W-1]+1.414)}else v=Math.min(v,1);if(i===W-1)v=Math.min(v,1);Dt[k]=v}
  [1.4,1,0.7,0.5,0.36].map(f=>f*(D.tmax||350)/ps/2).filter(t=>t>=1.5&&t*2<maxC).forEach(t=>{
    const L=new Int32Array(N);let n=0;
    for(let k0=0;k0<N;k0++){if(Dt[k0]<t||L[k0]||taken[k0])continue;n++;const cells=[k0];L[k0]=n;let x0=1e9,x1=-1,y0=1e9,y1=-1,stop=false,peak=0;
      for(let q=0;q<cells.length;q++){const k=cells[q],i=k%W,j=(k/W)|0;if(Dt[k]>peak)peak=Dt[k];if(i<x0)x0=i;if(i>x1)x1=i;if(j<y0)y0=j;if(j>y1)y1=j;
        for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=W||jj>=H)continue;const m=jj*W+ii;if(L[m]||Dt[m]<t)continue;L[m]=n;cells.push(m)}
        if(x1-x0>maxC||y1-y0>maxC)stop=true}
      if(stop)continue;const w=x1-x0+1+2*t,h=y1-y0+1+2*t;if(w<minC||h<minC||w>maxC||h>maxC)continue;if(Math.max(w,h)/Math.min(w,h)>1.6)continue;/* genuinely thick all the way through, not a short wall piece made to look square */if(peak<0.38*Math.min(w,h))continue;
      const cx=(x0+x1+1)/2,cy=(y0+y1+1)/2;if(cols.some(c=>Math.abs(c.x-cx)<(c.w+w)/2&&Math.abs(c.y-cy)<(c.h+h)/2))continue;
      /* how full the original drawing is: solid fill, or an outline that needs a cross or hatching to count */
      let ink=0,tot=0;const bx0=Math.round(cx-w/2),bx1=Math.round(cx+w/2),by0=Math.round(cy-h/2),by1=Math.round(cy+h/2),br=Math.max(2,Math.round(Math.min(w,h)*0.15));
      const rowHit=new Set(),colHit=new Set();let inn=0,innInk=0;
      let dg=0;const B=(i,j)=>i>=0&&j>=0&&i<W&&j<H&&bin[j*W+i];
      for(let j=Math.max(0,by0);j<Math.min(H,by1);j++)for(let i=Math.max(0,bx0);i<Math.min(W,bx1);i++){const v=bin[j*W+i];tot++;ink+=v;if(i>bx0+br&&i<bx1-br&&j>by0+br&&j<by1-br){inn++;if(v){innInk++;rowHit.add(j);colHit.add(i);/* a pixel on a slanted line: diagonal neighbours only */if(!B(i-1,j)&&!B(i+1,j)&&!B(i,j-1)&&!B(i,j+1)&&(B(i-1,j-1)||B(i+1,j+1)||B(i+1,j-1)||B(i-1,j+1)))dg++}}}
      const ir=Math.max(1,by1-by0-2*br-1),ic=Math.max(1,bx1-bx0-2*br-1);
      const solid=ink/Math.max(1,tot)>0.75,hatched=!solid&&innInk/Math.max(1,inn)>0.05&&rowHit.size>=0.6*ir&&colHit.size>=0.6*ic&&dg>=Math.max(0.15*innInk,0.6*Math.min(ir,ic));if(want==='solid'?!solid:!hatched)continue;
      /* round when the corners of its box are empty */
      const cor=[[-1,-1],[1,-1],[1,1],[-1,1]].filter(([a,b])=>{const i=Math.round(cx+a*w*0.42),j=Math.round(cy+b*h*0.42);return i<0||j<0||i>=W||j>=H||!img[j*W+i]}).length;
      cols.push({x:cx,y:cy,w,h,round:cor>=3,solid});cells.forEach(k=>taken[k]=1);continue;
      cells.forEach(k=>taken[k]=1)}
  });
  };
  scan(bin,'solid');scan(fil,'hatched');
  return cols;
}
/* erase found columns from the ink so they do not turn into short wall pieces */
function eraseColumns(bin,W,H,cols){cols.forEach(c=>{const x0=Math.max(0,Math.floor(c.x-c.w/2-1)),x1=Math.min(W-1,Math.ceil(c.x+c.w/2+1)),y0=Math.max(0,Math.floor(c.y-c.h/2-1)),y1=Math.min(H-1,Math.ceil(c.y+c.h/2+1));for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++)bin[j*W+i]=0})}
/* one-pixel skeleton of a mask (Zhang-Suen) */
function thinMask(src,w,h){const m=src.slice();const get=(x,y)=>x>=0&&y>=0&&x<w&&y<h?m[y*w+x]:0;let any=true,it=0;
  while(any&&it++<60){any=false;for(let pass=0;pass<2;pass++){const del=[];
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){if(!m[y*w+x])continue;const p2=get(x,y-1),p3=get(x+1,y-1),p4=get(x+1,y),p5=get(x+1,y+1),p6=get(x,y+1),p7=get(x-1,y+1),p8=get(x-1,y),p9=get(x-1,y-1);
      const B=p2+p3+p4+p5+p6+p7+p8+p9;if(B<2||B>6)continue;let A=0;const q=[p2,p3,p4,p5,p6,p7,p8,p9,p2];for(let i=0;i<8;i++)if(!q[i]&&q[i+1])A++;if(A!==1)continue;
      if(pass===0){if(p2*p4*p6||p4*p6*p8)continue}else{if(p2*p4*p8||p2*p6*p8)continue}del.push(y*w+x)}
    del.forEach(k=>m[k]=0);if(del.length)any=true}}
  return m}
/* directions, other than square, along which the drawing has long straight lines (slanted walls, bays, chamfers):
   run lengths along each angle on a small skeleton of the mask, where square walls shrink to lines that cannot leak into other angles */
function lineAngles(bin,W,H,minLenPx){
  const k=Math.max(1,Math.ceil(Math.max(W,H)/700)),w=Math.ceil(W/k),h=Math.ceil(H/k);const sm=new Uint8Array(w*h);
  for(let y=0;y<H;y++){const row=y*W,r2=((y/k)|0)*w;for(let x=0;x<W;x++)if(bin[row+x])sm[r2+((x/k)|0)]=1}
  const sk=thinMask(sm,w,h);const need=Math.max(7,Math.round(minLenPx/k));
  /* run lengths along the rows, riding over one- or two-pixel breaks left by turning a one-pixel line */
  const runs=R=>{let t=0;for(let y=0;y<h;y++){const row=y*w;let x=0;while(x<w){if(R[row+x]){let e=x,gap=0,last=x;while(e<w){if(R[row+e]){last=e;gap=0}else if(++gap>2)break;e++}if(last-x+1>=need)t+=last-x+1;x=last+1}else x++}}return t};
  const at=d=>runs(rotateBin(sk,w,h,d));
  const axis=at(0)+at(90);if(!axis)return[];
  const sc=new Map();for(let d=15;d<=165;d+=3){if(Math.abs(d-90)<15)continue;sc.set(d,at(d))}
  const out=[];sc.forEach((v,d)=>{if(v<0.012*axis||v<2*need)return;let peak=true;sc.forEach((v2,d2)=>{if(d2!==d&&Math.abs(d2-d)<=9&&v2>=v)peak=false});if(!peak)return;
    let bd=d,bv=v;for(let e=d-2;e<=d+2;e++){if(e===d||e<15||e>165||Math.abs(e-90)<15)continue;const ve=at(e);if(ve>bv){bv=ve;bd=e}}out.push({d:bd,v:bv})});
  return out.sort((a,b)=>b.v-a.v).slice(0,3).map(p=>p.d)}
/* walls along a direction that is not square to the picture: the mask is turned so they lie flat, read as bands, turned back.
   Returns segments in millimetres with their thickness */
function angledWalls(bin,W,H,ps,D,axisWalls){
  const out=[];const minT=D.tmin/ps,maxT=D.tmax/ps,thinLen=Math.max(5,Math.round(150/ps)),minLen=Math.max(8,Math.round(Math.max(600,D.tmax*1.7)/ps));
  const cx=W/2,cy=H/2;
  lineAngles(bin,W,H,minLen).forEach(deg=>{const a=deg*Math.PI/180,sn=Math.sin(a),cs=Math.cos(a);const R=rotateBin(bin,W,H,deg);
    const back=(x,y)=>[cx+cs*(x-cx)-sn*(y-cy),cy+sn*(x-cx)+cs*(y-cy)];
    findBands(R,W,H,thinLen,true).forEach(b=>{const L=b.a1-b.a0;if(b.t<minT*0.85||b.t>2*maxT||L<minLen||L<2.2*b.t)return;
      const p=back(b.a0,b.c),q=back(b.a1,b.c);
      /* not something the square pass already has */
      const dup=axisWalls.some(w=>{const A=w.o==='h'?[w.a0,w.c]:[w.c,w.a0],B=w.o==='h'?[w.a1,w.c]:[w.c,w.a1];return segDist(p[0]*ps,p[1]*ps,A,B)<=w.t&&segDist(q[0]*ps,q[1]*ps,A,B)<=w.t});
      if(dup)return;out.push({a:[p[0]*ps,p[1]*ps],b:[q[0]*ps,q[1]*ps],t:Math.max(50,Math.round(b.t*ps/10)*10),deg})})});
  /* ends that reach a square wall stop on its centreline */
  out.forEach(w=>{const dx=w.b[0]-w.a[0],dy=w.b[1]-w.a[1],L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
    [['a',-1],['b',1]].forEach(([k,dir])=>{const e=w[k];const hit=axisWalls.find(q=>{const acr=q.o==='h'?e[1]:e[0],along=q.o==='h'?e[0]:e[1];return Math.abs(acr-q.c)<=q.t/2+w.t/2+100&&along>=q.a0-q.t&&along<=q.a1+q.t});
      if(!hit)return;/* slide the end along the wall's own line to the centreline of the wall it meets */
      const den=hit.o==='h'?uy:ux;if(Math.abs(den)<0.2)return;const s=((hit.o==='h'?hit.c-e[1]:hit.c-e[0]))/den;if(Math.abs(s)>w.t+D.tmax)return;w[k]=[Math.round(e[0]+ux*s),Math.round(e[1]+uy*s)]})});
  return out}
function detectPlan(bin,W,H,ps,D){
  const first=traceWalls(bin,W,H,ps,Object.assign({},D,{_cols:[]}));
  const angled=D._single?[]:angledWalls(bin,W,H,ps,D,first);
  let cols=D.cols===false?[]:detectColumns(bin,W,H,ps,D);
  /* a candidate sitting on a slanted wall is a piece of that wall */
  if(cols.length&&angled.length)cols=cols.filter(c=>!angled.some(w=>segDist(c.x*ps,c.y*ps,w.a,w.b)<=w.t/2+Math.max(c.w,c.h)*ps*0.5));
  if(cols.length&&first.length){
    /* columns sit among the walls, and a square of wall is not a column: a candidate inside a wall band must be clearly thicker than it */
    const xs=first.flatMap(w=>w.o==='h'?[w.a0,w.a1]:[w.c]),ys=first.flatMap(w=>w.o==='v'?[w.a0,w.a1]:[w.c]);const m=D.tmax*1.5;
    const bx0=Math.min(...xs)-m,bx1=Math.max(...xs)+m,by0=Math.min(...ys)-m,by1=Math.max(...ys)+m;
    const inBand=(x,y)=>first.some(w=>{const acr=w.o==='h'?y:x,along=w.o==='h'?x:y;return Math.abs(acr-w.c)<=w.t/2+ps&&along>=w.a0-w.t/2-ps&&along<=w.a1+w.t/2+ps});
    cols=cols.filter(c=>{const cx=c.x*ps,cy=c.y*ps,cw=c.w*ps,ch=c.h*ps;if(cx<bx0||cx>bx1||cy<by0||cy>by1)return false;
      if(first.some(w=>{const acr=w.o==='h'?cy:cx,along=w.o==='h'?cx:cy,across=w.o==='h'?ch:cw;return Math.abs(acr-w.c)<=w.t/2+ps&&along>=w.a0-ps&&along<=w.a1+ps&&across<=1.3*w.t+2*ps}))return false;
      /* a block at a corner or beside a window that is nearly all wall band is wall */
      let inb=0,tot=0;for(let j=0;j<6;j++)for(let i=0;i<6;i++){tot++;if(inBand(cx-cw/2+cw*(i+0.5)/6,cy-ch/2+ch*(j+0.5)/6))inb++}
      return inb/tot<0.85})}
  let walls=first;if(cols.length){const b2=bin.slice();eraseColumns(b2,W,H,cols);walls=traceWalls(b2,W,H,ps,Object.assign({},D,{_cols:cols}))}
  return{walls,angled,windows:walls.windows||[],cols:cols.map(c=>({x:Math.round(c.x*ps),y:Math.round(c.y*ps),w:Math.round(c.w*ps/10)*10,d:Math.round(c.h*ps/10)*10,round:c.round}))}}
function segDist(px,py,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy;let t=L2?((px-a[0])*dx+(py-a[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-a[0]-t*dx,py-a[1]-t*dy)}
/* enclosed spaces between walls -> room polygons on the inner wall faces (net area, no overlap with the walls) */
function roomsFromWalls(walls,opt){
  opt=opt||{};const segsA=[];walls.forEach(o=>wallSegs(o).forEach(([a,b])=>segsA.push({a,b,th:o.th||100,o})));
  if(!segsA.length)return[];
  const allP=[];segsA.forEach(s=>{if(isFinite(s.a[0])&&isFinite(s.a[1])&&isFinite(s.b[0])&&isFinite(s.b[1]))allP.push(s.a,s.b)});if(!allP.length)return[];const B=bboxPts(allP);
  let c=50;const ar=(B.x1-B.x0+600)*(B.y1-B.y0+600);if(ar/(c*c)>4e6)c=Math.ceil(Math.sqrt(ar/4e6));
  const pad=3*c,gx0=B.x0-pad,gy0=B.y0-pad,GW=Math.ceil((B.x1-B.x0+2*pad)/c)+1,GH=Math.ceil((B.y1-B.y0+2*pad)/c)+1;
  const grid=new Uint8Array(GW*GH),hw=0.75*c,rad=th=>Math.max(th/2,hw);
  const paint=(a,b,r)=>{r=r||hw;const i0=Math.max(0,Math.floor((Math.min(a[0],b[0])-r-gx0)/c)),i1=Math.min(GW-1,Math.ceil((Math.max(a[0],b[0])+r-gx0)/c)),j0=Math.max(0,Math.floor((Math.min(a[1],b[1])-r-gy0)/c)),j1=Math.min(GH-1,Math.ceil((Math.max(a[1],b[1])+r-gy0)/c));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){if(segDist(gx0+(i+0.5)*c,gy0+(j+0.5)*c,a,b)<=r)grid[j*GW+i]=1}};
  segsA.forEach(s=>paint(s.a,s.b,rad(s.th)));
  /* bridge door openings: a free wall end looks ahead along its line for the next wall */
  const maxGap=opt.gap||0;
  if(maxGap>0)walls.forEach(o=>{if(o.closed||!o.pts||o.pts.length<2)return;const p=o.pts;
    [[p[0],p[1]],[p[p.length-1],p[p.length-2]]].forEach(([e,prev])=>{
      const connected=segsA.some(s=>s.o!==o&&segDist(e[0],e[1],s.a,s.b)<=s.th/2+20);if(connected)return;
      const L=Math.hypot(e[0]-prev[0],e[1]-prev[1]);if(L<1)return;const ux=(e[0]-prev[0])/L,uy=(e[1]-prev[1])/L;
      const r0=rad(o.th||100);for(let d=r0+c;d<=maxGap+r0+c;d+=c/2){const x=e[0]+ux*d,y=e[1]+uy*d;const i=Math.floor((x-gx0)/c),j=Math.floor((y-gy0)/c);if(i<0||j<0||i>=GW||j>=GH)break;if(grid[j*GW+i]){paint(e,[x,y],r0);break}}
    })});
  /* outside */
  const lab=new Int32Array(GW*GH);const st=[];
  const push=(i,j)=>{if(i<0||j<0||i>=GW||j>=GH)return;const k=j*GW+i;if(grid[k]||lab[k])return;lab[k]=-1;st.push(k)};
  for(let i=0;i<GW;i++){push(i,0);push(i,GH-1)}for(let j=0;j<GH;j++){push(0,j);push(GW-1,j)}
  while(st.length){const k=st.pop(),i=k%GW,j=(k/GW)|0;push(i+1,j);push(i-1,j);push(i,j+1);push(i,j-1)}
  /* each enclosed space */
  /* snap targets: both faces of every straight wall */
  const vx=[],hy=[];segsA.forEach(s=>{const h=s.th/2;if(Math.abs(s.a[0]-s.b[0])<1){const y0=Math.min(s.a[1],s.b[1])-h,y1=Math.max(s.a[1],s.b[1])+h;vx.push({x:s.a[0]-h,y0,y1},{x:s.a[0]+h,y0,y1})}if(Math.abs(s.a[1]-s.b[1])<1){const x0=Math.min(s.a[0],s.b[0])-h,x1=Math.max(s.a[0],s.b[0])+h;hy.push({y:s.a[1]-h,x0,x1},{y:s.a[1]+h,x0,x1})}});
  const existing=(opt.keep||[]).filter(o=>o.t==='room');
  const rooms=[];let id=0;const minCells=Math.ceil((opt.minArea||1.0e6)/(c*c));
  for(let k0=0;k0<GW*GH;k0++){if(grid[k0]||lab[k0])continue;id++;const cells=[];st.push(k0);lab[k0]=id;
    while(st.length){const k=st.pop();cells.push(k);const i=k%GW,j=(k/GW)|0;[[i+1,j],[i-1,j],[i,j+1],[i,j-1]].forEach(([a,b])=>{if(a<0||b<0||a>=GW||b>=GH)return;const q=b*GW+a;if(grid[q]||lab[q])return;lab[q]=id;st.push(q)})}
    if(cells.length<minCells)continue;
    const out=new Map(),VW=GW+1;const add=(x0,y0,x1,y1)=>{const kk=y0*VW+x0;let a=out.get(kk);if(!a){a=[];out.set(kk,a)}a.push(y1*VW+x1)};
    cells.forEach(k=>{const i=k%GW,j=(k/GW)|0;
      if(j===0||lab[k-GW]!==id)add(i,j,i+1,j);if(i===GW-1||lab[k+1]!==id)add(i+1,j,i+1,j+1);
      if(j===GH-1||lab[k+GW]!==id)add(i+1,j+1,i,j+1);if(i===0||lab[k-1]!==id)add(i,j+1,i,j)});
    let bestLoop=null,bestA=0;
    while(out.size){const start=out.keys().next().value;let cur=start;const loop=[];let n=0;
      do{loop.push([cur%VW,(cur/VW)|0]);const arr=out.get(cur);if(!arr)break;const nx=arr.pop();if(!arr.length)out.delete(cur);cur=nx}while(cur!==start&&n++<1e6);
      const A=Math.abs(polyArea(loop));if(A>bestA){bestA=A;bestLoop=loop}}
    if(!bestLoop)continue;
    let poly=simplifyClosed(bestLoop,1.1).map(p=>[gx0+p[0]*c,gy0+p[1]*c]);
    /* snap edges onto the nearest wall face */
    const sn=2.2*c;
    poly=poly.map(([x,y])=>{let bx=null,by=null;vx.forEach(v=>{if(y<v.y0-sn||y>v.y1+sn)return;const d=Math.abs(v.x-x);if(d<=sn&&(bx===null||d<Math.abs(bx-x)))bx=v.x});hy.forEach(h=>{if(x<h.x0-sn||x>h.x1+sn)return;const d=Math.abs(h.y-y);if(d<=sn&&(by===null||d<Math.abs(by-y)))by=h.y});return[Math.round(bx===null?x:bx),Math.round(by===null?y:by)]});
    poly=dropCollinear(poly.filter((p,i,a)=>{const q=a[(i+1)%a.length];return Math.hypot(p[0]-q[0],p[1]-q[1])>1}));
    if(poly.length<3||Math.abs(polyArea(poly))<(opt.minArea||1.0e6))continue;
    const ce=centroid(poly);if(existing.some(r=>pointInPoly(ce[0],ce[1],r.pts)))continue;
    rooms.push(poly);
  }
  return rooms;
}
/* polygon moved inwards by d on every edge (mitred corners) */
function insetPoly(pts,d){
  const off=k=>{const n=pts.length,L=[];for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=-dy/l*k,ny=dx/l*k;L.push([[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny]])}
    return L.map((l1,i)=>{const l0=L[(i+n-1)%n];const[p1,p2]=l0,[p3,p4]=l1;const den=(p1[0]-p2[0])*(p3[1]-p4[1])-(p1[1]-p2[1])*(p3[0]-p4[0]);if(Math.abs(den)<1e-9)return[Math.round(p3[0]),Math.round(p3[1])];
      const t=((p1[0]-p3[0])*(p3[1]-p4[1])-(p1[1]-p3[1])*(p3[0]-p4[0]))/den;return[Math.round(p1[0]+t*(p2[0]-p1[0])),Math.round(p1[1]+t*(p2[1]-p1[1]))]})};
  const A=off(d),B=off(-d);return Math.abs(polyArea(A))<Math.abs(polyArea(B))?A:B;
}
function dropCollinear(p){let ch=true;while(ch&&p.length>3){ch=false;for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],q=p[(i+1)%p.length];const cr=(b[0]-a[0])*(q[1]-b[1])-(b[1]-a[1])*(q[0]-b[0]);const L=Math.hypot(q[0]-a[0],q[1]-a[1])||1;if(Math.abs(cr)/L<0.5){p.splice(i,1);ch=true;break}}}return p}
function rdp(pts,eps){if(pts.length<3)return pts.slice();let dm=0,ix=0;const a=pts[0],b=pts[pts.length-1];for(let i=1;i<pts.length-1;i++){const d=segDist(pts[i][0],pts[i][1],a,b);if(d>dm){dm=d;ix=i}}if(dm>eps){const l=rdp(pts.slice(0,ix+1),eps),r=rdp(pts.slice(ix),eps);return l.slice(0,-1).concat(r)}return[a,b]}
function simplifyClosed(loop,eps){
  let p=dropCollinear(loop.slice());if(p.length<=4)return p;
  /* split at the two farthest-apart corners so the closed outline simplifies evenly */
  let ia=0,ib=0,best=0;for(let i=0;i<p.length;i++){const d=Math.hypot(p[i][0]-p[0][0],p[i][1]-p[0][1]);if(d>best){best=d;ib=i}}
  best=0;for(let i=0;i<p.length;i++){const d=Math.hypot(p[i][0]-p[ib][0],p[i][1]-p[ib][1]);if(d>best){best=d;ia=i}}
  const r=p.slice(ia).concat(p.slice(0,ia));const m=(ib-ia+p.length)%p.length;
  const s1=rdp(r.slice(0,m+1),eps),s2=rdp(r.slice(m).concat([r[0]]),eps);
  return dropCollinear(s1.slice(0,-1).concat(s2.slice(0,-1)));
}
/* doors: every gap between a wall end and the next wall is an opening. If the drawing has a swing arc in it, it is a door.
   Arcs are tested for a single leaf hinged at either end (or a double leaf), swinging to either side, hinged on the centreline or the face. */
function detectDoors(walls,bin,W,H,ps,D){
  const ink=(x,y)=>{const px=Math.round(x/ps),py=Math.round(y/ps),r=Math.max(2,Math.round(50/ps));for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){const X=px+i,Y=py+j;if(X>=0&&Y>=0&&X<W&&Y<H&&bin[Y*W+X])return true}return false};
  const opens=[];
  walls.forEach(w=>{[[w.a0,-1],[w.a1,1]].forEach(([e,dir])=>{
    const perp=walls.filter(q=>q.o!==w.o);
    if(perp.some(q=>Math.abs(q.c-e)<=q.t/2+25&&w.c>=q.a0-q.t/2-25&&w.c<=q.a1+q.t/2+25))return; /* end meets a wall */
    let g=Infinity;
    walls.forEach(q=>{if(q===w)return;
      if(q.o===w.o){if(Math.abs(q.c-w.c)>Math.max(q.t,w.t)/2)return;const d=dir>0?q.a0-e:e-q.a1;if(d>0&&d<g)g=d}
      else{if(w.c<q.a0-q.t/2-25||w.c>q.a1+q.t/2+25)return;const d=dir*(q.c-e)-q.t/2;if(d>0&&d<g)g=d}});
    if(!(g>=500&&g<=D.gap+150))return;
    const p0=Math.min(e,e+dir*g),p1=Math.max(e,e+dir*g);
    if(opens.some(q=>q.o===w.o&&Math.abs(q.c-w.c)<=Math.max(q.t,w.t)&&Math.min(q.p1,p1)-Math.max(q.p0,p0)>0.5*Math.min(q.p1-q.p0,p1-p0)))return;
    opens.push({o:w.o,c:w.c,t:w.t,p0,p1})})});
  const out=[];
  opens.forEach(op=>{
    const g=op.p1-op.p0,P=a=>op.o==='h'?[a,op.c]:[op.c,a],u=op.o==='h'?[1,0]:[0,1],nrm=op.o==='h'?[[0,1],[0,-1]]:[[1,0],[-1,0]];
    const arc1=(H0,dirO,n,R)=>{let hit=0,tot=0;for(let i=0;i<=12;i++){const t=(15+i*5)*Math.PI/180;tot++;if(ink(H0[0]+R*(Math.cos(t)*dirO[0]+Math.sin(t)*n[0]),H0[1]+R*(Math.cos(t)*dirO[1]+Math.sin(t)*n[1])))hit++}return hit/tot};
    const arc=(H0,dirO,n,R)=>Math.max(arc1(H0,dirO,n,R),arc1(H0,dirO,n,R*0.93),arc1(H0,dirO,n,R*1.07),arc1(H0,dirO,n,R-100),arc1(H0,dirO,n,R+100));
    let best=null;const consider=(sc,cfg)=>{if(!best||sc>best.sc)best=Object.assign({sc},cfg)};
    nrm.forEach(n=>[0,op.t/2].forEach(off=>{
      const A=P(op.p0),B=P(op.p1),Ah=[A[0]+n[0]*off,A[1]+n[1]*off],Bh=[B[0]+n[0]*off,B[1]+n[1]*off];
      consider(arc(Ah,u,n,g),{type:'single',hinge:'p0',n});
      consider(arc(Bh,[-u[0],-u[1]],n,g),{type:'single',hinge:'p1',n});
      if(g>=1100){const sc=(arc(Ah,u,n,g/2)+arc(Bh,[-u[0],-u[1]],n,g/2))/2;consider(sc+0.02,{type:'double',n})}}));
    if(!best||best.sc<0.55)return;
    out.push(Object.assign({},op,best,{w:g,cx:(P(op.p0)[0]+P(op.p1)[0])/2,cy:(P(op.p0)[1]+P(op.p1)[1])/2,u}));
  });
  return out;
}
function doorFromDetect(dd,ox,oy){
  const lib=LIB.filter(l=>l.shape===(dd.type==='double'?'door2':'door'));
  const li=lib.length?lib.reduce((a,b)=>Math.abs(b.w-dd.w)<Math.abs(a.w-dd.w)?b:a):{code:'DOOR',name:dd.type==='double'?'Double door':'Single door',cat:'Door',shape:dd.type==='double'?'door2':'door',w:dd.w,d:100,h:2100,a:0,seats:0,cf:0,cb:0,nests:false,rate:null};
  /* local +x runs from the hinge to the far jamb, local +y is the swing side */
  const ex=dd.type==='single'&&dd.hinge==='p1'?[-dd.u[0],-dd.u[1]]:dd.u;
  let r=Math.round(Math.atan2(ex[1],ex[0])*180/Math.PI),flip=false;
  const t=r*Math.PI/180,ey=[-Math.sin(t),Math.cos(t)];
  if(ey[0]*dd.n[0]+ey[1]*dd.n[1]<0){r+=180;flip=dd.type==='single'}
  const o=itemFromLib(li,Math.round(ox+dd.cx),Math.round(oy+dd.cy),((r%360)+360)%360);
  o.w=Math.round(dd.w);o.d=Math.max(50,Math.round(dd.t));o.cf=0;o.flip=flip;o.det=true;return o;
}
/* ink mask: darker than the local background. The background is read per block (bright percentile) so grey scan paper,
   unevenly lit photos and anti-aliased hairlines all read the same way; soft:true also takes light-grey fills */
/* the strong grey levels of a picture made of flat fills, darkest first, the page colour left out. Empty for a line drawing or a scan, whose ink is a thin spread of greys, not a level */
function flatLevels(lum,n){const h=new Float64Array(256);for(let i=0;i<n;i++)h[lum[i]]++;const sm=new Float64Array(256);for(let v=0;v<256;v++){let a=0;for(let d=-3;d<=3;d++){const k=v+d;if(k>=0&&k<256)a+=h[k]}sm[v]=a}
  const peaks=[];for(let v=4;v<252;v++){let top=true;for(let d=-8;d<=8;d++){const k=v+d;if(k>=0&&k<256&&sm[k]>sm[v]){top=false;break}}if(top&&sm[v]/n>=0.012)peaks.push({v,share:sm[v]/n,tol:10})}
  if(!peaks.length)return[];const page=peaks.filter(p=>p.share>=0.08).reduce((a,p)=>Math.max(a,p.v),0)||peaks[peaks.length-1].v;
  return peaks.filter(p=>p.v<page-25).slice(0,5)}
/* the wall mask of a flat-colour picture: everything at the wall's grey level, plus thin strokes a little lighter than it. A wall one or two pixels wide is blended with the floor beside it by the picture's smoothing, so it never reaches the wall colour; a wide area of that lighter grey is a floor tint and is left out */
function flatMask(lum,W,H,L,thin){const n=W*H,m=new Uint8Array(n),lo=L-14,hi=L+10,hi2=L+48;for(let i=0;i<n;i++){const v=lum[i];if(v>=lo&&v<=hi)m[i]=1;else if(v<=hi2&&v>=lo-30)m[i]=2}
  /* a blended pixel stays only where its stroke is thin across or down */
  const run=new Uint16Array(n);for(let y=0;y<H;y++){let s=-1;for(let x=0;x<=W;x++){const on=x<W&&m[y*W+x];if(on&&s<0)s=x;if(!on&&s>=0){const len=Math.min(65535,x-s);for(let k=s;k<x;k++)run[y*W+k]=len;s=-1}}}
  const out=new Uint8Array(n);for(let x=0;x<W;x++){let s=-1;for(let y=0;y<=H;y++){const on=y<H&&m[y*W+x];if(on&&s<0)s=y;if(!on&&s>=0){const len=y-s;for(let k=s;k<y;k++){const i=k*W+x;out[i]=m[i]===1||(m[i]===2&&(len<=thin||run[i]<=thin))?1:0}s=-1}}}
  /* a wall drawn right at the picture's edge must not read as the picture's border */
  for(let x=0;x<W;x++){out[x]=out[W+x]=out[(H-1)*W+x]=out[(H-2)*W+x]=0}for(let y=0;y<H;y++){out[y*W]=out[y*W+1]=out[y*W+W-1]=out[y*W+W-2]=0}
  return out}
/* an outside wall drawn in pieces with windows between them. Each thick wall is followed along its line: where the wall colour stops but the strip still carries drawn lines (a window's frame and glass), the wall carries on and a window is noted; where the strip is plain floor (a real opening) it stops */
function flatBridge(plan,lum,mask,W,H,ps,L){const out=[],wins=plan.windows||(plan.windows=[]);const thick=plan.walls.filter(w=>w.t>=150),rest=plan.walls.filter(w=>w.t<150);const used=new Set();
  const band=(w,pos)=>{/* what the strip across the wall holds at one position along it: 2 wall, 1 drawn lines, 0 plain */const c0=Math.max(0,Math.round((w.c-w.t/2)/ps)),c1=Math.round((w.c+w.t/2)/ps),p=Math.round(pos/ps);let ink=0,mn=255,mx=0,cnt=0;for(let c=c0;c<=c1;c++){const x=w.o==='h'?p:c,y=w.o==='h'?c:p;if(x<0||y<0||x>=W||y>=H)continue;const i=y*W+x;cnt++;if(mask[i])ink++;const v=lum[i];if(v<mn)mn=v;if(v>mx)mx=v}
    if(!cnt)return 0;if(ink>=cnt*0.6)return 2;return mx-mn>=22||mn<=L+60?1:0};
  /* only an outside wall is followed: one with nothing drawn in the wall colour between it and the edge of the picture on one side. Inside the building a break in a wall is a doorway, not a window */
  const outer=w=>{const far=(w.o==='h'?H:W),c0=Math.round((w.c-w.t/2)/ps)-3,c1=Math.round((w.c+w.t/2)/ps)+3;return[-1,1].some(side=>{let clear=0;for(let k=1;k<=5;k++){const p=Math.round((w.a0+(w.a1-w.a0)*k/6)/ps);let hit=0;for(let c=side<0?c0:c1;c>=0&&c<far;c+=side){const x=w.o==='h'?p:c,y=w.o==='h'?c:p;if(x<0||y<0||x>=W||y>=H)break;if(mask[y*W+x])hit++}if(hit<=2)clear++}return clear>=4})};
  thick.sort((a,b)=>(b.a1-b.a0)-(a.a1-a.a0)).forEach(w=>{if(used.has(w))return;used.add(w);const n={o:w.o,c:w.c,t:w.t,a0:w.a0,a1:w.a1};if(!outer(w)){out.push(n);return}const lim=(w.o==='h'?W:H)*ps,step=ps;
    [1,-1].forEach(dir=>{let pos=dir>0?n.a1:n.a0,end=pos,plain=0,ws=null;while(pos>0&&pos<lim){pos+=dir*step;const k=band(n,pos);if(k===2){if(ws!=null){const a=Math.min(ws,pos),b=Math.max(ws,pos);if(b-a>=500&&b-a<=6500)wins.push({o:n.o,c:n.c,t:n.t,a0:a,a1:b});ws=null}end=pos;plain=0}else if(k===1){if(ws==null)ws=pos-dir*step;plain=0}else{plain+=step;if(plain>180)break}}
      if(dir>0)n.a1=end;else n.a0=end});
    /* pieces this wall now runs through are the same wall */
    thick.forEach(v=>{if(used.has(v)||v.o!==n.o||Math.abs(v.c-n.c)>Math.max(v.t,n.t)/2)return;if(v.a0>=n.a0-200&&v.a1<=n.a1+200)used.add(v)});out.push(n)});
  plan.walls=out.concat(rest);return plan}
/* how much a trace looks like the walls of a building: long thin runs count, and a trace made of a few fat blocks does not */
function planScore(p,ps){const W=(p.walls||[]).filter(w=>Math.abs(w.a1-w.a0)>=600);let s=0;
  W.forEach((w,i)=>{const L=w.a1-w.a0;/* a wall with another lying along its side is part of a filled block (a dark floor, a core shown solid), not a wall */let stacked=0;for(let k=0;k<W.length;k++){if(k===i)continue;const v=W[k];if(v.o!==w.o)continue;const gap=Math.abs(v.c-w.c)-(v.t+w.t)/2;if(gap>60)continue;const ov=Math.min(w.a1,v.a1)-Math.max(w.a0,v.a0);if(ov>0)stacked=Math.max(stacked,ov)}
    s+=(L-2*stacked)*Math.min(1,300/Math.max(60,w.t))});return s}
function binarize(lum,W,H,ps,D,opt){
  const n=W*H,B=Math.max(24,Math.min(128,Math.round(6*(D.tmax||350)/ps))),BW=Math.ceil(W/B),BH=Math.ceil(H/B);const bg=new Float32Array(BW*BH),hist=new Uint32Array(256);
  for(let bj=0;bj<BH;bj++)for(let bi=0;bi<BW;bi++){hist.fill(0);let cnt=0;const x0=bi*B,y0=bj*B,x1=Math.min(W,x0+B),y1=Math.min(H,y0+B);
    for(let y=y0;y<y1;y++){const row=y*W;for(let x=x0;x<x1;x++){hist[lum[row+x]]++;cnt++}}
    let acc=0,v=255;for(let k=255;k>=0;k--){acc+=hist[k];if(acc>=cnt*0.15){v=k;break}}bg[bj*BW+bi]=v}
  /* a block that is mostly ink takes the brightest of its neighbours */
  const bg2=new Float32Array(BW*BH);for(let bj=0;bj<BH;bj++)for(let bi=0;bi<BW;bi++){let m=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const i=bi+di,j=bj+dj;if(i<0||j<0||i>=BW||j>=BH)continue;m=Math.max(m,bg[j*BW+i])}bg2[bj*BW+bi]=m}
  const soft=opt&&opt.soft;const bin=new Uint8Array(n);
  const xi0=new Int32Array(W),xi1=new Int32Array(W),xt=new Float32Array(W);for(let x=0;x<W;x++){const fx=Math.max(0,Math.min(BW-1,(x+0.5)/B-0.5));xi0[x]=Math.floor(fx);xi1[x]=Math.min(BW-1,xi0[x]+1);xt[x]=fx-xi0[x]}
  for(let y=0;y<H;y++){const fy=Math.max(0,Math.min(BH-1,(y+0.5)/B-0.5)),j0=Math.floor(fy),j1=Math.min(BH-1,j0+1),ty=fy-j0;const r0=j0*BW,r1=j1*BW,row=y*W;
    for(let x=0;x<W;x++){const tx=xt[x],b=(bg2[r0+xi0[x]]*(1-tx)+bg2[r0+xi1[x]]*tx)*(1-ty)+(bg2[r1+xi0[x]]*(1-tx)+bg2[r1+xi1[x]]*tx)*ty;
      const thr=soft?b-Math.max(12,0.08*b):b-Math.max(28,0.3*b);bin[row+x]=lum[row+x]<thr?1:0}}
  return bin}
/* how far the drawing is turned from square, in degrees: the angle at which rows and columns of ink line up best */
function skewAngle(bin,W,H){
  const step=Math.max(1,Math.ceil(Math.max(W,H)/900));const xs=[],ys=[];for(let y=0;y<H;y+=step){const row=y*W;for(let x=0;x<W;x+=step)if(bin[row+x]){xs.push(x);ys.push(y)}}
  if(xs.length<200)return 0;const cx=W/2,cy=H/2,N=xs.length,bins=Math.ceil(Math.max(W,H)/step)+2;const hy=new Int32Array(bins*2),hx=new Int32Array(bins*2);
  const score=a=>{const s=Math.sin(a),c=Math.cos(a);hy.fill(0);hx.fill(0);for(let i=0;i<N;i++){const dx=xs[i]-cx,dy=ys[i]-cy;const y2=(-s*dx+c*dy)/step+bins,x2=(c*dx+s*dy)/step+bins;hy[y2|0]++;hx[x2|0]++}
    let v=0;for(let i=0;i<hy.length;i++)v+=hy[i]*hy[i]+hx[i]*hx[i];return v};
  let best=0,bv=-1;for(let d=-6;d<=6;d+=0.25){const v=score(d*Math.PI/180);if(v>bv){bv=v;best=d}}
  for(let d=best-0.25;d<=best+0.25;d+=0.05){const v=score(d*Math.PI/180);if(v>bv){bv=v;best=d}}
  /* only when it clearly beats square */
  return Math.abs(best)>=0.3&&bv>1.08*score(0)?best:0}
/* the ink mask turned by -deg about its centre, same size */
function rotateBin(bin,W,H,deg){const a=deg*Math.PI/180,s=Math.sin(a),c=Math.cos(a),cx=W/2,cy=H/2,out=new Uint8Array(W*H);
  for(let y=0;y<H;y++){const dy=y+0.5-cy;for(let x=0;x<W;x++){const dx=x+0.5-cx;const sx=Math.floor(c*dx-s*dy+cx),sy=Math.floor(s*dx+c*dy+cy);if(sx>=0&&sy>=0&&sx<W&&sy<H&&bin[sy*W+sx])out[y*W+x]=1}}return out}
async function runDetect(box){
  detBox=false;updateHint();render();
  const u=S.underlay;if(!u||!u.src)return toast('Load a floor plan first');
  const D=P.det;toast('Tracing walls…');await new Promise(r=>setTimeout(r,40));
  try{
    const img=await loadImg(u.src);const kx=img.naturalWidth/u.w;
    let ix0=0,iy0=0,ix1=u.w,iy1=u.h;
    if(box){ix0=Math.max(0,Math.floor((box.x0-u.x)/u.mpp));iy0=Math.max(0,Math.floor((box.y0-u.y)/u.mpp));ix1=Math.min(u.w,Math.ceil((box.x1-u.x)/u.mpp));iy1=Math.min(u.h,Math.ceil((box.y1-u.y)/u.mpp))}
    if(ix1-ix0<20||iy1-iy0<20)return toast('The box does not cover the floor plan');
    const cw=ix1-ix0,ch=iy1-iy0;
    /* working resolution: at least 8 px across the thinnest wall when the drawing can give it (a PDF is drawn again, sharper), at most 6000 px across */
    const MAXPX=6000;let f=Math.min(1,MAXPX/Math.max(cw,ch));
    const fromPdf=pdfDoc&&u.sc>0&&u.page>0&&u.name===pdfName+' · page '+u.page;
    if(fromPdf){const want=Math.max(4,D.tmin/8);f=Math.min(u.mpp/want,MAXPX/Math.max(cw,ch),Math.sqrt(2.4e7/(cw*ch)));if(f<1.15)f=Math.min(1,MAXPX/Math.max(cw,ch))}
    /* a small picture (a web floor plan) is enlarged so that thin walls are a few pixels wide */
    else if(u.mpp>=19){f=Math.min(3,u.mpp/12,MAXPX/Math.max(cw,ch),Math.sqrt(2.4e7/(cw*ch)));if(f<1.15)f=Math.min(1,MAXPX/Math.max(cw,ch))}
    const Wd=Math.max(1,Math.round(cw*f)),Hd=Math.max(1,Math.round(ch*f));
    const cv=document.createElement('canvas');cv.width=Wd;cv.height=Hd;const cx=cv.getContext('2d',{willReadFrequently:true});cx.fillStyle='#fff';cx.fillRect(0,0,Wd,Hd);
    if(fromPdf&&f>1){const page=await pdfDoc.getPage(u.page);const vp=page.getViewport({scale:u.sc*f,offsetX:-ix0*f,offsetY:-iy0*f});await page.render({canvasContext:cx,viewport:vp}).promise}
    else{if(f>1&&u.mpp>=24)cx.imageSmoothingEnabled=false;cx.drawImage(img,ix0*kx,iy0*kx,cw*kx,ch*kx,0,0,Wd,Hd)}
    const px=cx.getImageData(0,0,Wd,Hd).data,n=Wd*Hd,lum=new Uint8Array(n);
    for(let i=0,j=0;i<n;i++,j+=4)lum[i]=(px[j]*299+px[j+1]*587+px[j+2]*114)/1000;
    const ps=u.mpp/f,ox=u.x+ix0*u.mpp,oy=u.y+iy0*u.mpp;
    let bin=binarize(lum,Wd,Hd,ps,D);
    /* a scan or photo that is not quite square is straightened first; everything found is turned back at the end */
    const skew=skewAngle(bin,Wd,Hd);if(skew)bin=rotateBin(bin,Wd,Hd,skew);
    const sa=skew*Math.PI/180,rc=[ox+Wd/2*ps,oy+Hd/2*ps];
    const back=p=>{if(!skew)return p;const dx=p[0]-rc[0],dy=p[1]-rc[1];return[rc[0]+Math.cos(sa)*dx-Math.sin(sa)*dy,rc[1]+Math.sin(sa)*dx+Math.cos(sa)*dy]};
    let plan=detectPlan(bin,Wd,Hd,ps,D),single=false,soft=false;
    /* a rendered plan (flat colour fills: mid-grey walls on tinted floors) defeats a darker-than-the-background mask, because a dark floor tint reads as ink and a grey wall on a dark tint does not. For such a picture each strong grey level is tried as the wall colour and the trace that looks most like walls is kept */
    let flat=null;{const lv=flatLevels(lum,n);/*@dev-only*/if(window.__osp)window.__osp.flat=[];/*@end-dev-only*/
      if(lv.length){const base=planScore(plan,ps);let best=null;lv.forEach(L=>{const m=flatMask(lum,Wd,Hd,L.v,Math.max(2,Math.round(4*f)));const mm=skew?rotateBin(m,Wd,Hd,skew):m;const D2=Object.assign({},D,{tmax:Math.max(D.tmax||350,600),tmin:Math.min(D.tmin||75,50)});let p=detectPlan(mm,Wd,Hd,ps,D2);if(!skew&&p.walls.length>=4)p=flatBridge(p,lum,mm,Wd,Hd,ps,L.v);const sc=planScore(p,ps);/*@dev-only*/if(window.__osp)window.__osp.flat.push({level:L.v,share:+L.share.toFixed(3),walls:p.walls.length,score:Math.round(sc),base:Math.round(base)});/*@end-dev-only*/if(!best||sc>best.sc)best={p,sc,mm,L}});
        if(best&&best.sc>1.25*base&&best.p.walls.length>=4){plan=best.p;bin=best.mm;flat=best.L.v}}}
    /* nothing much: try light-grey ink, then walls drawn as single lines (a sketch) */
    if(plan.walls.length<3){const b2=binarize(lum,Wd,Hd,ps,D,{soft:true});const p2=detectPlan(skew?rotateBin(b2,Wd,Hd,skew):b2,Wd,Hd,ps,D);if(p2.walls.length>=3){plan=p2;bin=skew?rotateBin(b2,Wd,Hd,skew):b2;soft=true}}
    if(plan.walls.length<8){const p2=detectPlan(bin,Wd,Hd,ps,Object.assign({},D,{_single:true}));if(p2.walls.length>=Math.max(3,2*plan.walls.length)){plan=p2;single=true}}
    const found=plan.walls;/*@dev-only*/if(window.__osp)window.__osp.last={bin,lum,Wd,Hd,ps,ox,oy,skew,f,fromPdf,plan};/*@end-dev-only*/
    if(!found.length&&!plan.cols.length){toast('No walls found. Check the scale and the wall thickness range, or draw a tighter box.');return}
    let walls=found.map(w=>({id:uid(),t:'wall',det:true,closed:false,th:w.t,gid:null,pts:w.o==='h'?[[ox+w.a0,oy+w.c],[ox+w.a1,oy+w.c]]:[[ox+w.c,oy+w.a0],[ox+w.c,oy+w.a1]]}))
      .concat((plan.angled||[]).map(w=>({id:uid(),t:'wall',det:true,closed:false,th:w.t,gid:null,pts:[[ox+w.a[0],oy+w.a[1]],[ox+w.b[0],oy+w.b[1]]]})));
    /* running it again replaces the earlier trace in the same area, so walls and rooms never stack up */
    const inArea=o=>{if(!box)return true;const b=objBox(o),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;return cx>=box.x0&&cx<=box.x1&&cy>=box.y0&&cy<=box.y1};
    const keepObjs=S.objs.filter(o=>!(o.det&&inArea(o)));const replaced=S.objs.length-keepObjs.length;
    const doors=D.doors!==false?detectDoors(found,bin,Wd,Hd,ps,D).map(dd=>doorFromDetect(dd,ox,oy)):[];
    /* a small group of walls on its own with no door or window in it is a title block, a legend or a table, not a building */
    {const segs=walls.map(w=>({a:w.pts[0],b:w.pts[1],th:w.th}));const n=segs.length,par=segs.map((_,i)=>i);const find=i=>par[i]===i?i:(par[i]=find(par[i]));
      const touch=(p,q)=>{const r=(p.th+q.th)/2+100;if(segDist(p.a[0],p.a[1],q.a,q.b)<=r||segDist(p.b[0],p.b[1],q.a,q.b)<=r||segDist(q.a[0],q.a[1],p.a,p.b)<=r||segDist(q.b[0],q.b[1],p.a,p.b)<=r)return true;
        /* two pieces of one wall either side of an opening */
        const ph=Math.abs(p.a[1]-p.b[1])<1,qh=Math.abs(q.a[1]-q.b[1])<1;if(ph!==qh)return false;const pc=ph?p.a[1]:p.a[0],qc=qh?q.a[1]:q.a[0];if(Math.abs(pc-qc)>Math.max(p.th,q.th)/2)return false;
        const P=ph?[p.a[0],p.b[0]]:[p.a[1],p.b[1]],Q=qh?[q.a[0],q.b[0]]:[q.a[1],q.b[1]];const gap=Math.max(Math.min(...Q)-Math.max(...P),Math.min(...P)-Math.max(...Q));return gap<=D.gap+300};
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(touch(segs[i],segs[j]))par[find(i)]=find(j);
      const len=new Map(),bb=new Map();segs.forEach((s,i)=>{const k=find(i);len.set(k,(len.get(k)||0)+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]));const B=bb.get(k)||{x0:1e12,y0:1e12,x1:-1e12,y1:-1e12};[s.a,s.b].forEach(p=>{B.x0=Math.min(B.x0,p[0]);B.y0=Math.min(B.y0,p[1]);B.x1=Math.max(B.x1,p[0]);B.y1=Math.max(B.y1,p[1])});bb.set(k,B)});
      let big=0,bigK=null;len.forEach((v,k)=>{if(v>big){big=v;bigK=k}});const MB=bb.get(bigK);
      const hasOpening=k=>doors.concat(plan.windows.map(w=>({x:w.o==='h'?ox+(w.a0+w.a1)/2:ox+w.c,y:w.o==='h'?oy+w.c:oy+(w.a0+w.a1)/2}))).some(d=>segs.some((s,i)=>find(i)===k&&segDist(d.x,d.y,s.a,s.b)<=s.th+300));
      const inside=k=>{const B=bb.get(k),m=D.tmax;return MB&&B.x0>=MB.x0-m&&B.x1<=MB.x1+m&&B.y0>=MB.y0-m&&B.y1<=MB.y1+m};
      const drop=new Set([...len.keys()].filter(k=>k!==bigK&&len.get(k)<0.2*big&&!hasOpening(k)&&!inside(k)));
      if(drop.size)walls=walls.filter((w,i)=>!drop.has(find(i)))}
    const cols=plan.cols.map(c=>makeColumn(c.round,c.w,c.d,ox+c.x,oy+c.y,true));
    /* windows found in the drawing, skipping any that a detected door already fills */
    const wins=D.wins===false?[]:plan.windows.filter(w=>{const L=w.a1-w.a0,m=(w.a0+w.a1)/2,cx=w.o==='h'?ox+m:ox+w.c,cy=w.o==='h'?oy+w.c:oy+m;return!doors.some(d=>Math.hypot(d.x-cx,d.y-cy)<Math.max(d.w,L)/2)}).map(w=>{const m=(w.a0+w.a1)/2,o=makeWindow(Object.assign({},WIN_DEF,{w:w.a1-w.a0}),w.o==='h'?[ox+m,oy+w.c]:[ox+w.c,oy+m],w.o==='h'?0:90,w.t);o.det=true;return o});
    let rooms=[];
    if(D.rooms){let n2=keepObjs.filter(o=>o.t==='room').length;
      /* rooms are traced while the walls are still square, then turned with them */
      const own=keepObjs.filter(o=>o.t==='wall'&&!o.site);
      rooms=roomsFromWalls((skew?[]:own).concat(walls),{gap:D.gap,keep:skew?[]:keepObjs}).map(pts=>({id:uid(),t:'room',name:'Room '+(++n2),pts,nowall:true,det:true,gid:null}))}
    if(skew){const deg=skew;walls.forEach(w=>w.pts=w.pts.map(back));rooms.forEach(r=>r.pts=r.pts.map(back));
      cols.concat(doors,wins).forEach(o=>{const p=back([o.x,o.y]);o.x=p[0];o.y=p[1];o.r=((Math.round(num(o.r,0)+deg)%360)+360)%360})}
    walls.forEach(w=>w.pts=w.pts.map(p=>[Math.round(p[0]),Math.round(p[1])]));rooms.forEach(r=>r.pts=r.pts.map(p=>[Math.round(p[0]),Math.round(p[1])]));
    cols.concat(doors,wins).forEach(o=>{o.x=Math.round(o.x);o.y=Math.round(o.y)});
    /* skip walls you already drew yourself in the same place */
    const own=keepObjs.filter(o=>o.t==='wall'&&!o.site);
    walls=walls.filter(w=>{const[a,b]=w.pts;return!own.some(o=>wallSegs(o).some(([p,q])=>{if(segDist(a[0],a[1],p,q)>Math.max(o.th,w.th)/2||segDist(b[0],b[1],p,q)>Math.max(o.th,w.th)/2)return false;return true}))});
    /* a drawing that has been turned with the plan is traced square, then the result is turned to lie on it */if(u.rot){const ucx=u.x+u.w*u.mpp/2,ucy=u.y+u.h*u.mpp/2;[rooms,walls,cols,doors,wins].forEach(a=>a.forEach(o=>turnObj(o,ucx,ucy,u.rot)))}
    checkpoint();S.objs=keepObjs.concat(rooms,walls,cols,doors,wins);sel.clear();clashDirty=true;
    if(LY('under')&&S.underlay.op>0.45){S.underlay.op=0.35;updateUnderImg()}
    render();renderInspector();renderUnderPanel();
    const notes=[];if(skew)notes.push(`drawing straightened by ${Math.abs(skew).toFixed(1)}°`);if(single)notes.push('walls read as single lines');if(flat!=null)notes.push('read as a colour plan: walls taken by their grey, outside walls followed through their windows; doors drawn as pale swings are not found');if(soft)notes.push('light ink');
    toast(`Traced ${walls.length} walls, ${cols.length} columns, ${doors.length} doors, ${wins.length} windows${D.rooms?` and ${rooms.length} rooms`:''}${replaced?' (replacing the earlier trace here)':''}${notes.length?' · '+notes.join(', '):''}. Check them against the drawing. Undo removes them.`);
  }catch(e){console.error(e);toast('Detection failed: '+(e.message||e))}
}

/* ================= save / open ================= */
function planJSON(){syncFloorOut(S);
  /* objects from newer versions go back where they came from */
  const out=Object.assign({},S,{app:'layout-planner',appVersion:APP_VERSION,v:Math.max(PLAN_V,num(S.v,PLAN_V)),saved:new Date().toISOString()});
  const baseObjs=roofMode?activeStored():S.objs;
  out.objs=S.extraObjs&&S.extraObjs.length?baseObjs.concat(S.extraObjs):baseObjs;delete out.extraObjs;
  return JSON.stringify(out)}
async function savePlan(asNew){
  const autoSnap=P.snapOnSave?snapTake('Save '+new Date().toLocaleString(),true):null;
  const name=(S.name||'plan').replace(/[\\/:*?"<>|]+/g,'-')+'.json';const text=planJSON();
  if(window.showSaveFilePicker){
    try{if(!fileHandle||asNew)fileHandle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'Plan file',accept:{'application/json':['.json']}}]});
      const w=await fileHandle.createWritable();await w.write(text);await w.close();dirty=false;AS.fileAt=Date.now();setStatus();toast('Saved to '+fileHandle.name);return}
    catch(e){if(e&&e.name==='AbortError'){if(autoSnap){const i=snaps().indexOf(autoSnap);if(i>=0)snaps().splice(i,1)}return}fileHandle=null}
  }
  download(name,text,'application/json');dirty=false;AS.fileNote='file copy downloaded '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});setStatus();toast('Plan file downloaded');
}
async function openPlan(){
  if(window.showOpenFilePicker){try{const[h]=await window.showOpenFilePicker({types:[{description:'Plan file',accept:{'application/json':['.json']}}]});const f=await h.getFile();openPlanText(await f.text(),h,f.name);return}catch(e){if(e&&e.name==='AbortError')return}}
  $('#f-plan').click();
}
$('#f-plan').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(f)openPlanText(await f.text(),null,f.name)});
function openPlanText(text,handle,name){
  try{let o;try{o=JSON.parse(text)}catch(e){throw new Error('The file is not valid JSON. It may be damaged or not a plan file.')}
    if(tooDeep(o,60))throw new Error('It is nested far deeper than any plan and looks damaged.');
    if(o&&o.campus&&Array.isArray(o.plans)){CAMP.adding=false;campusOpenText(o,name||'the campus file');campusUI();return}
    const m=migratePlan(o);
    leaveRoof();if(!curUntouched())newTab(blankPlan());S=m.plan;curTab.S=S;past=[];future=[];ensureBld(S);setTimeout(renderFloorUI,0);if(!o.name)S.name=name.replace(/\.json$/i,'');
    if(S.underlay&&S.underlay.src){S.underlay.uid=S.underlay.uid||uid();underCache[S.underlay.uid]=S.underlay.src}
    pdfDoc=null;fileHandle=handle||null;sel.clear();clashDirty=true;$('#pname').value=S.name;syncLock();syncUnder();fit();renderInspector();
    dirty=!handle;AS.fileNote=handle?'':'opened from '+name;setStatus();
    if(m.notes.length)notice('Opened '+name,m.notes,m.fileV<PLAN_V?`Saved with an older version (plan format ${m.fileV}) and upgraded. Save to keep the upgrade.`:'');else toast('Opened '+name);
    if(CAMP.adding){CAMP.adding=false;if(!o.site)campusPlaceNew();setTimeout(campusUI,0)}
  }catch(e){CAMP.adding=false;toast('Could not open that file: '+e.message)}
}

/* ================= version control: snapshots and whole-building compare ================= */
let cmp=null; /* active comparison: {snapId,name,time,map:id->('add'|'mod'|'same'),removed:[o],counts,list} */
function snaps(){if(!Array.isArray(S.snaps))S.snaps=[];return S.snaps}
/* a snapshot holds geometry only: no earlier snapshots and no underlay image (that is carried back on restore), so files and autosave stay small */
function snapData(){syncFloorOut(S);const out=Object.assign({},S,{app:'layout-planner',appVersion:APP_VERSION,v:Math.max(PLAN_V,num(S.v,PLAN_V))});
  delete out.snaps;delete out.saved;delete out.extraObjs;out.objs=roofMode?activeStored():S.objs;
  if(out.underlay&&out.underlay.src)out.underlay=Object.assign({},out.underlay,{src:null,imgKept:true});
  return JSON.parse(JSON.stringify(out))}
function snapTake(name,silent){const list=snaps();const n=(name||'').trim()||('Snapshot '+(list.length+1));const data=snapData();const s={id:uid(),name:n,time:Date.now(),kb:Math.round(JSON.stringify(data).length/1024),data};list.push(s);
  const total=list.reduce((a,x)=>a+(x.kb||0),0);if(!silent){dirty=true;setStatus();toast('Snapshot saved: '+n+(total>2500?' · snapshots now '+(total/1024).toFixed(1)+' MB, consider deleting old ones':''))}return s}
function snapDelete(id){const list=snaps();const i=list.findIndex(s=>s.id===id);if(i<0)return;const nm=list[i].name;if(cmp&&cmp.snapId===id)cmpClear();list.splice(i,1);dirty=true;setStatus();toast('Snapshot deleted: '+nm);renderSnaps()}
function snapRestore(id){const s=snaps().find(x=>x.id===id);if(!s)return;if(!confirm('Restore "'+s.name+'"? This replaces the current layout with that snapshot. Your snapshots are kept, and Undo brings the current layout back.'))return;
  const keep=clone(snaps());cmpClear();const data=Object.assign({},s.data);if(data.underlay&&data.underlay.imgKept&&!data.underlay.src&&S.underlay&&S.underlay.src)data.underlay=Object.assign({},data.underlay,{src:S.underlay.src});const text=JSON.stringify(Object.assign({},data,{snaps:keep,name:S.name,pid:S.pid}));
  /* in place: same tab, same plan id, one undo step back to what was there */
  let m;try{m=migratePlan(JSON.parse(text))}catch(e){toast('Could not restore: '+(e.message||e));return}
  const P2=m.plan;ensureBld(P2);if(P2.underlay&&P2.underlay.src){P2.underlay.uid=P2.underlay.uid||uid();underCache[P2.underlay.uid]=P2.underlay.src}
  checkpoint();restoreState(JSON.stringify({objs:P2.objs,locked:P2.locked,name:S.name,u:P2.underlay?Object.assign({},P2.underlay,{src:null}):null,style:P2.style||null,section:P2.section||null,fire:P2.fire||null,notes:P2.notes||'',pins:P2.pins||[],bld:P2.bld||null}));
  sel.clear();clashDirty=true;setTimeout(renderFloorUI,0);renderInspector();if(is3D)build3D();toast('Restored snapshot: '+s.name+' · Undo brings the previous layout back')}
/* a plan state's objects for one level id, rebuilt the way the editor composes a floor */
function floorObjsOf(p,lid){const b=p.bld;if(!b||!Array.isArray(b.levels))return clone(p.objs||[]);const l=b.levels.find(x=>x.id===lid);if(!l)return null;
  const base=clone(l.unique?(l.base||[]):(b.typical||[]));const nm=l.unique?{}:(l.names||{});base.forEach(o=>{if(o.t==='room'&&nm[o.id]!=null)o.name=nm[o.id]});
  return base.concat(clone((b.cores||[]).filter(c=>coreOn(b,c,b.levels.indexOf(l)))),clone(l.fit||[]))}
/* every object across the whole building, id -> {o,where} */
function flattenPlan(p){const out=new Map();const add=(o,w)=>{if(o&&o.id!=null&&!out.has(o.id))out.set(o.id,{o,where:w})};const b=p.bld;
  if(!b||!Array.isArray(b.levels)){(p.objs||[]).forEach(o=>add(o,''));return out}
  const nm=levelNames(b);(b.typical||[]).forEach(o=>add(o,'typical'));
  b.levels.forEach(l=>{if(l.unique&&l.base)l.base.forEach(o=>add(o,nm[l.id]));(l.fit||[]).forEach(o=>add(o,nm[l.id]))});
  (b.cores||[]).forEach(o=>add(o,isSite(o)?'site':'cores'));(b.roofFit||[]).forEach(o=>add(o,'roof'));return out}
const GEOK=['x','y','w','d','h','r','th','bulge','sill','pts','a','b','drop','tilt'];
function objStatus(a,b){if(JSON.stringify(a)===JSON.stringify(b))return'same';for(const k of GEOK)if(JSON.stringify(a[k])!==JSON.stringify(b[k]))return'moved';return'changed'}
function objLabel(o){return o.name||o.code||(o.t==='wall'?(o.site==='road'?'Road':o.site?'Fence':'Wall'):o.t==='room'?'Room':o.t==='item'?(o.cat||'Item'):o.t==='text'?'Text':o.t==='dim'?'Dimension':o.t==='trunk'?'Trunking':o.t||'Object')}
function snapCompare(id){const s=snaps().find(x=>x.id===id);if(!s)return;cmpWith(s.data,s.name,s.id);toast('Comparing with: '+s.name)}
/* compare the plan now with any earlier plan state (a snapshot, or the plan before an AI change) */
function cmpWith(data,name,id){const s={data,name,id,time:Date.now()};ensureBld(S);syncFloorOut(S);
  const cur=flattenPlan(S),old=flattenPlan(s.data);
  const added=[],removed=[],modified=[];
  cur.forEach((v,k)=>{if(!old.has(k))added.push({o:v.o,where:v.where});else{const st=objStatus(v.o,old.get(k).o);if(st!=='same')modified.push({o:v.o,where:v.where,st})}});
  old.forEach((v,k)=>{if(!cur.has(k))removed.push({o:v.o,where:v.where})});
  const curA=roofMode?[]:S.objs,oldRaw=floorObjsOf(s.data,S.bld.active),oldA=oldRaw||[],oldMap=new Map(oldA.map(o=>[o.id,o])),map=new Map();
  curA.forEach(o=>{if(!oldMap.has(o.id))map.set(o.id,'add');else map.set(o.id,objStatus(o,oldMap.get(o.id))==='same'?'same':'mod')});
  const curIds=new Set(curA.map(o=>o.id));
  cmp={snapId:s.id,name:s.name,time:s.time,map,removed:oldA.filter(o=>!curIds.has(o.id)),counts:{added:added.length,removed:removed.length,modified:modified.length},list:{added,removed,modified},note:oldRaw?'':'This floor did not exist in that snapshot, so everything on it shows as added.'};
  render();renderSnaps()}
function cmpClear(){if(!cmp)return;cmp=null;render();renderSnaps()}
/* ---- revisions and revision clouds: issue a revision (a named snapshot with a number), then compare against it and the changes since are clouded and tagged with the next number ---- */
function revs(){if(!Array.isArray(S.revs))S.revs=[];return S.revs}
function revIssue(desc){const list=revs();const no=list.reduce((m,r)=>Math.max(m,r.no),0)+1;const sn=snapTake(`Rev ${no}${desc?' · '+desc:''}`,true);list.push({no,date:new Date().toISOString(),desc:desc||'',snapId:sn.id});dirty=true;markDirty();setStatus();toast(`Issued revision ${no}${desc?': '+desc:''}`);return no}
function cmpRevNo(){const r=cmp&&revs().find(x=>x.snapId===cmp.snapId);return (r?r.no:revs().reduce((m,x)=>Math.max(m,x.no),0))+1}
function cloudBoxes(){if(!cmp)return[];const pad=500,bx=[];const add=o=>{const pts=[];cmpOutline(o).forEach(sg=>pts.push(...sg.pts));if(!pts.length)return;const b=bboxPts(pts);bx.push({x0:b.x0-pad,y0:b.y0-pad,x1:b.x1+pad,y1:b.y1+pad})};
  cmp.removed.forEach(add);S.objs.forEach(o=>{const st=cmp.map.get(o.id);if(st&&st!=='same')add(o)});
  for(let again=true;again;){again=false;outer:for(let i=0;i<bx.length;i++)for(let j=i+1;j<bx.length;j++){const a=bx[i],b=bx[j];if(a.x0<=b.x1+pad&&b.x0<=a.x1+pad&&a.y0<=b.y1+pad&&b.y0<=a.y1+pad){bx[i]={x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)};bx.splice(j,1);again=true;break outer}}}
  return bx}
/* a scalloped outline round a box, arcs bulging outwards, with a revision triangle on its top-right corner */
function cloudPath(b){const w=b.x1-b.x0,h=b.y1-b.y0,L=Math.max(fs(11),Math.min(1100,(w+h)/18)),side=(a,c)=>{const n=Math.max(2,Math.round(Math.hypot(c[0]-a[0],c[1]-a[1])/L));const o=[];for(let i=1;i<=n;i++)o.push([a[0]+(c[0]-a[0])*i/n,a[1]+(c[1]-a[1])*i/n]);return o};
  const C=[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]];let pts=[];for(let i=0;i<4;i++)pts=pts.concat(side(C[i],C[(i+1)%4]));const r=L*0.53;
  return 'M'+b.x0+' '+b.y0+pts.map(p=>`A${r} ${r} 0 0 1 ${p[0]} ${p[1]}`).join('')+'Z'}
function cloudSVG(){if(!cmp||!P.clouds)return'';const no=cmpRevNo(),T=fs(13);let s='<g class="rev-clouds" style="pointer-events:none">';
  cloudBoxes().forEach(b=>{s+=`<path class="rev-cloud" d="${cloudPath(b)}" fill="none" stroke="#d1453b" stroke-width="${fs(2.2)}" stroke-linejoin="round"/>`;const x=b.x1,y=b.y0;
    s+=`<path d="M${x} ${y-T*1.6}L${x+T*0.95} ${y}L${x-T*0.95} ${y}Z" fill="#fff" stroke="#d1453b" stroke-width="${fs(1.8)}" stroke-linejoin="round"/><text x="${x}" y="${y-T*0.32}" font-size="${T*0.82}" font-weight="700" text-anchor="middle" fill="#d1453b">${no}</text>`});
  return s+'</g>'}
/* the revision table drawn on exports: issued revisions, then the one these clouds belong to */
function revTableSVG(x,y,u){const rows=revs().slice().sort((a,b)=>a.no-b.no).map(r=>[r.no,dstr(r.date),r.desc||'']);const no=cmpRevNo();rows.push([no,dstr(new Date().toISOString()),`Changes since ${cmp?cmp.name:'last issue'} (clouded)`]);
  const rh=u*1.5,W=u*28;let s=`<g font-family="Inter,Arial,sans-serif" font-size="${u*0.8}"><rect x="${x}" y="${y}" width="${W}" height="${rh*(rows.length+1)}" fill="#fff" stroke="#1d2a38" stroke-width="${u*0.06}"/><text x="${x+u*0.5}" y="${y+rh*0.68}" font-weight="700" fill="#1d2a38">REVISIONS</text>`;
  rows.forEach((r,i)=>{const yy=y+rh*(i+1);s+=`<line x1="${x}" y1="${yy}" x2="${x+W}" y2="${yy}" stroke="#1d2a38" stroke-width="${u*0.04}"/><text x="${x+u*1.2}" y="${yy+rh*0.68}" text-anchor="middle" font-weight="700" fill="#d1453b">△${r[0]}</text><text x="${x+u*2.4}" y="${yy+rh*0.68}" fill="#1d2a38">${esc(r[1])}</text><text x="${x+u*8.4}" y="${yy+rh*0.68}" fill="#1d2a38">${esc(String(r[2]).slice(0,60))}</text>`});
  return s+'</g>'}
function setClouds(on){P.clouds=!!on;savePrefs();render();renderSnaps()}
document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('#cmp-cl'))setClouds(!P.clouds)});
function cmpOutline(o){if(o.pts&&o.pts.length>=2)return[{pts:o.pts,closed:o.t==='room'||o.closed}];
  if(o.t==='dim'&&o.a&&o.b)return[{pts:[o.a,o.b],closed:false}];
  if(o.t!=='text'){try{const bl=bodyLocal(o);if(bl&&bl.length)return bl.map(p=>({pts:toW(o,p),closed:true}))}catch(e){}}
  const b=objBox(o);return[{pts:[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]],closed:true}]}
function cmpSVG(){if(!cmp)return'';const col={add:'#2e9e5b',mod:'#e0a008',same:'#9aa3ab',rem:'#d1453b'},sw=fs(2.6);let s='';
  const path=(o,c,dash,fill)=>{cmpOutline(o).forEach(seg=>{if(!seg.pts||seg.pts.length<2)return;const d='M'+seg.pts.map(p=>p[0]+' '+p[1]).join('L')+(seg.closed?'Z':'');s+=`<path d="${d}" fill="${fill?c:'none'}" fill-opacity="${fill?0.1:0}" stroke="${c}" stroke-width="${sw}"${dash?` stroke-dasharray="${fs(9)} ${fs(6)}"`:''} stroke-linejoin="round" stroke-linecap="round"/>`})};
  cmp.removed.forEach(o=>path(o,col.rem,true,true));
  S.objs.forEach(o=>{const st=cmp.map.get(o.id);if(!st||st==='same')return;path(o,col[st],st==='mod',false)});
  return s+cloudSVG()}
function cmpDetail(){if(!cmp)return'';const row=(title,arr,cls)=>{if(!arr.length)return'';const li=arr.slice(0,14).map(x=>`<li>${esc(objLabel(x.o))}${x.where?` <span class="muted">· ${esc(x.where)}</span>`:''}${x.st==='moved'?' — moved/resized':x.st==='changed'?' — edited':''}</li>`).join('');const more=arr.length>14?`<li class="muted">…and ${arr.length-14} more</li>`:'';return `<div class="cmp-grp ${cls}"><div class="cmp-h">${title} (${arr.length})</div><ul>${li}${more}</ul></div>`};
  return `<div class="cmp-detail">${row('Added',cmp.list.added,'g-add')}${row('Changed',cmp.list.modified,'g-mod')}${row('Removed',cmp.list.removed,'g-rem')}</div>`}
function renderSnaps(){const body=$('#snap-body');if(!body||$('#snap-modal').hidden)return;const list=snaps();
  let h=`<div class="row" style="justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><span class="row" style="gap:6px;margin:0"><button class="btn sm primary" id="snap-take">Take snapshot now</button><button class="btn sm" id="rev-issue" title="Save a numbered revision (a snapshot) to compare and cloud against later">Issue revision</button></span><label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="snap-onsave" ${P.snapOnSave?'checked':''} style="width:auto"> Snapshot on every save</label></div>`;
  if(cmp)h+=`<div class="snap-cmp"><b>Comparing with "${esc(cmp.name)}"</b> <button class="btn sm ghost" id="snap-exit">Exit compare</button><label class="rev-cl"><input type="checkbox" id="snap-clouds"${P.clouds?' checked':''}> Revision clouds round the changes, tagged △${cmpRevNo()}</label><div class="cmp-sum"><span class="cmp-add">${cmp.counts.added} added</span> · <span class="cmp-mod">${cmp.counts.modified} changed</span> · <span class="cmp-rem">${cmp.counts.removed} removed</span> across the building</div>${cmp.note?`<div class="muted" style="font-size:12px">${esc(cmp.note)}</div>`:''}${cmpDetail()}</div>`;
  if(revs().length)h+=`<div class="sec">Revisions</div><table class="sch revs"><tbody>${revs().slice().sort((a,b)=>b.no-a.no).map(r=>`<tr><td style="color:#d1453b;font-weight:700">△${r.no}</td><td>${dstr(r.date)}</td><td>${esc(r.desc||'')}</td><td style="text-align:right">${snaps().some(x=>x.id===r.snapId)?`<button class="btn sm" data-snap-cmp="${r.snapId}">Compare</button>`:'<span class="muted">snapshot deleted</span>'}</td></tr>`).join('')}</tbody></table><div class="sec">Snapshots</div>`;
  if(!list.length)h+=`<p class="muted" style="margin:12px 0">No snapshots yet. Take one to capture the building now, then compare after making changes.</p>`;
  else h+='<div class="snap-list">'+list.slice().reverse().map(s=>`<div class="snap-row"><div class="snap-meta"><b>${esc(s.name)}</b><span class="muted">${new Date(s.time).toLocaleString()}${s.kb?' · '+(s.kb>=1024?(s.kb/1024).toFixed(1)+' MB':s.kb+' KB'):''}</span></div><div class="snap-acts"><button class="btn sm ${cmp&&cmp.snapId===s.id?'primary':''}" data-snap-cmp="${s.id}">${cmp&&cmp.snapId===s.id?'Comparing':'Compare'}</button><button class="btn sm ghost" data-snap-rest="${s.id}">Restore</button><button class="btn sm ghost" data-snap-del="${s.id}" aria-label="Delete snapshot">✕</button></div></div>`).join('')+'</div>';
  body.innerHTML=h}
$('#m-snaps')&&$('#m-snaps').addEventListener('click',()=>{closePops();$('#snap-modal').hidden=false;renderSnaps()});
$('#snap-close')&&$('#snap-close').addEventListener('click',()=>{$('#snap-modal').hidden=true});
$('#snap-modal')&&$('#snap-modal').addEventListener('click',e=>{if(e.target===$('#snap-modal'))$('#snap-modal').hidden=true});
$('#snap-body')&&$('#snap-body').addEventListener('click',e=>{const t=e.target.closest('[data-snap-cmp],[data-snap-rest],[data-snap-del],#snap-take,#snap-exit,#rev-issue');if(!t)return;
  if(t.id==='snap-take'){const nm=prompt('Name this snapshot:','Snapshot '+new Date().toLocaleString());if(nm===null)return;snapTake(nm);renderSnaps();return}
  if(t.id==='snap-exit'){cmpClear();return}
  if(t.id==='rev-issue'){const d=prompt(`Issue revision ${revs().reduce((m,r)=>Math.max(m,r.no),0)+1}. What is it for? (e.g. PDR issue, CDR comments incorporated)`,'');if(d===null)return;revIssue(d.trim());renderSnaps();return}
  if(t.dataset.snapCmp){snapCompare(t.dataset.snapCmp);return}
  if(t.dataset.snapRest){snapRestore(t.dataset.snapRest);return}
  if(t.dataset.snapDel){if(confirm('Delete this snapshot?'))snapDelete(t.dataset.snapDel);return}});
$('#snap-body')&&$('#snap-body').addEventListener('change',e=>{if(e.target.id==='snap-clouds'){setClouds(e.target.checked);return}if(e.target.id==='snap-onsave'){P.snapOnSave=e.target.checked;savePrefs();toast(P.snapOnSave?'A snapshot will be taken on each save':'Snapshot on save turned off')}});
document.addEventListener('click',e=>{if(e.target&&e.target.id==='cmp-x')cmpClear()});

/* ================= PNG export ================= */
function exportDXF(){syncFloorOut(S);
  const E=[];const FY=y=>-y;
  const L=(x1,y1,x2,y2,lay)=>E.push(`0\nLINE\n8\n${lay}\n10\n${Math.round(x1)}\n20\n${Math.round(FY(y1))}\n11\n${Math.round(x2)}\n21\n${Math.round(FY(y2))}`);
  const poly=(pts,lay,closed)=>{if(!pts||pts.length<2)return;const n=pts.length;for(let i=0;i<(closed?n:n-1);i++){const a=pts[i],bq=pts[(i+1)%n];L(a[0],a[1],bq[0],bq[1],lay)}};
  const TXT=(x,y,hgt,str,lay,rot)=>E.push(`0\nTEXT\n8\n${lay}\n10\n${Math.round(x)}\n20\n${Math.round(FY(y))}\n40\n${Math.round(hgt)}\n1\n${String(str==null?'':str).replace(/[\n\r]+/g,' ').slice(0,250)}${rot?`\n50\n${((-rot)%360+360)%360}`:''}`);
  const CIRC=(x,y,r,lay)=>E.push(`0\nCIRCLE\n8\n${lay}\n10\n${Math.round(x)}\n20\n${Math.round(FY(y))}\n40\n${Math.round(r)}`);
  S.objs.forEach(o=>{
    if(o.t==='wall'&&!o.site)poly(wallPathPts(o),'WALLS',o.closed);
    else if(o.t==='wall'&&o.site)poly(wallPathPts(o),o.site==='road'?'SITE-ROAD':'SITE-FENCE',o.closed);
    else if(o.t==='room'){poly(o.pts,'ROOMS',true);const c=centroid(o.pts),a=Math.abs(polyArea(o.pts))/1e6;TXT(c[0]-600,c[1]+120,300,o.name||'Room','ROOM-TEXT');TXT(c[0]-600,c[1]-380,250,a.toFixed(1)+' sqm','ROOM-TEXT')}
    else if(isCol(o)){if(ROUND_SHAPES.includes(o.shape))CIRC(o.x,o.y,o.w/2,'COLUMNS');else poly(toW(o,bodyLocal(o)[0]),'COLUMNS',true)}
    else if(isOpening(o)){const p=toW(o,[[-o.w/2,0],[o.w/2,0]]);L(p[0][0],p[0][1],p[1][0],p[1][1],o.cat==='Window'?'WINDOWS':'DOORS')}
    else if(isCore(o))bodyLocal(o).forEach(pp=>poly(toW(o,pp),'CORES',true));
    else if(o.t==='trunk')poly(o.pts,'CEILING-TRUNK',false);
    else if(o.t==='dim'){L(o.a[0],o.a[1],o.b[0],o.b[1],'DIMENSIONS');const c=[(o.a[0]+o.b[0])/2,(o.a[1]+o.b[1])/2];TXT(c[0],c[1]+140,250,fmt(Math.hypot(o.b[0]-o.a[0],o.b[1]-o.a[1])),'DIMENSIONS')}
    else if(o.t==='text')TXT(o.x,o.y,o.size||250,o.text,'TEXT',o.r||0);
    else if(o.t==='item'&&!isCeil(o))bodyLocal(o).forEach(pp=>poly(toW(o,pp),'FURNITURE',true));
    else if(isCeil(o))bodyLocal(o).forEach(pp=>poly(toW(o,pp),'CEILING',true));
  });
  const lcol={WALLS:7,ROOMS:3,'ROOM-TEXT':3,COLUMNS:5,DOORS:2,WINDOWS:4,FURNITURE:8,CORES:6,'CEILING-TRUNK':1,CEILING:8,DIMENSIONS:4,TEXT:2,'SITE-ROAD':8,'SITE-FENCE':3};
  const layers=Object.keys(lcol);
  let d='0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n';
  d+='0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n'+layers.length+'\n';
  layers.forEach(l=>{d+=`0\nLAYER\n2\n${l}\n70\n0\n62\n${lcol[l]}\n6\nCONTINUOUS\n`});
  d+='0\nENDTAB\n0\nENDSEC\n';
  /* north arrow, top-right of the drawing, on its own layer */
  {const pts=[];S.objs.forEach(o=>{if(o.pts)o.pts.forEach(p=>pts.push(p));else if(o.t==='item'||isCol(o)||isCore(o)){const b=objBox(o);pts.push([b.x0,b.y0],[b.x1,b.y1])}});
   if(pts.length){const bb=bboxPts(pts),r=800,cx=bb.x1+r*2,cy=bb.y0+r*1.5,n=num(S.north,0),R=(x,y)=>rotPt(x,y,cx,cy,n);
    CIRC(cx,cy,r,'NORTH');const tri=[R(cx,cy-r*0.82),R(cx+r*0.26,cy+r*0.3),R(cx,cy+r*0.1),R(cx-r*0.26,cy+r*0.3)];poly(tri,'NORTH',true);const t=R(cx-r*0.18,cy-r*1.0);TXT(t[0],t[1],r*0.45,'N','NORTH')}}
  d+='0\nSECTION\n2\nENTITIES\n'+E.join('\n')+'\n0\nENDSEC\n0\nEOF\n';
  return d;}

async function exportPNG(){
  const pts=[];S.objs.forEach(o=>{const b=objBox(o);pts.push([b.x0,b.y0],[b.x1,b.y1])});if(!pts.length)return toast('Draw something first');
  const b=bboxPts(pts),m=1000,x0=b.x0-m,y0=b.y0-m,w=b.x1-b.x0+2*m,h=b.y1-b.y0+2*m;const sc=Math.min(0.12,8000/Math.max(w,h));
  const keep={x:V.x,y:V.y,k:V.k};V.k=sc;V.x=x0;V.y=y0;const ss=new Set(sel);sel.clear();draw();
  const cs=getComputedStyle(document.documentElement);const vars=['--paper','--ink','--muted','--grid','--grid-major','--wall','--room','--room-sel','--clear','--clash','--accent','--panel','--f-ui','--f-mono'].concat(Object.values(CATS).map(c=>'--c-'+c));
  const css=':root{'+vars.map(v=>v+':'+cs.getPropertyValue(v)).join(';')+'}'+$('#plan-style').textContent+(P.fill==='outline'?'.it .b{fill:none!important}':'');
  const parts=['L-under','L-rooms','L-zones','L-items','L-egress','L-anno'].concat(cmp&&P.clouds?['L-cmp']:[]).map(id=>{const g=$('#'+id).cloneNode(true);return g.outerHTML}).join('')+(cmp&&P.clouds?revTableSVG(x0+m*0.4,y0+h-m*0.4-Math.max(260,Math.min(w,h)*0.018)*1.5*(revs().length+2),Math.max(260,Math.min(w,h)*0.018)):'');
  const nr=Math.max(350,Math.min(w,h)*0.03);const north=northSVG(x0+w-m*0.5-nr*0.2,y0+m*0.5+nr*0.2,nr,num(S.north,0));
  const out=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${x0} ${y0} ${w} ${h}" width="${Math.round(w*sc)}" height="${Math.round(h*sc)}"><style>${css}</style><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${cs.getPropertyValue('--paper')}"/>${parts}${north}</svg>`;
  V.x=keep.x;V.y=keep.y;V.k=keep.k;sel=ss;applyView();draw();
  try{const img=await loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(out));const cv=document.createElement('canvas');cv.width=Math.round(w*sc);cv.height=Math.round(h*sc);cv.getContext('2d').drawImage(img,0,0);
    cv.toBlob(bl=>{if(!bl)return toast('PNG export failed');download((S.name||'plan')+'.png',bl);toast('PNG exported')},'image/png')}catch(e){toast('PNG export failed: '+e.message)}
}

/* ================= menus & settings ================= */
function closePops(except){if(except!=='#pop-layers'&&$('#t-layers'))$('#t-layers').classList.remove('on');['#pop-set','#pop-more','#pop-shape','#pop-layers','#pop-floor','#pop-stl','#pop-save','#ctxmenu'].forEach(s=>{if(s!==except)$(s).hidden=true})}
function togglePop(s,anchor){const p=$(s);const open=p.hidden;closePops(s);p.hidden=!open;if(open&&anchor){const r=anchor.getBoundingClientRect(),m=$('#main').getBoundingClientRect();if(s==='#pop-shape'){p.style.left=Math.max(8,r.left-m.left-60)+'px';p.style.bottom=(m.bottom-r.top+8)+'px';p.style.top='auto'}}}
$('#b-set').addEventListener('click',e=>{e.stopPropagation();togglePop('#pop-set');renderSetColors()});
$('#b-more').addEventListener('click',e=>{e.stopPropagation();togglePop('#pop-more')});
$('#t-shape').addEventListener('click',e=>{e.stopPropagation();togglePop('#pop-shape',e.currentTarget)});
$('#pop-shape').addEventListener('click',e=>{const b=e.target.closest('[data-shape]');if(!b)return;shapeKind=b.dataset.shape;setTool('shape-'+shapeKind)});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.pop')&&!e.target.closest('#b-set,#b-more,#t-shape,#t-layers,#b-floor,#v3-stl,#status'))closePops()});
$$('.dock [data-tool]').forEach(b=>{if(b.dataset.tool!=='shape')b.addEventListener('click',()=>setTool(b.dataset.tool))});
const bindSet=(id,key,parse)=>{const el=$(id);const isCb=el.type==='checkbox';const val=P[key];if(isCb)el.checked=!!val;else el.value=String(val);el.addEventListener('change',()=>{P[key]=isCb?el.checked:(parse?parse(el.value):el.value);savePrefs();clashDirty=true;applyTheme();render()})};
/* MIG table editor */
function migText(t){return t.map(r=>`${r.codes.join(', ')} = ${r.area}`).join('\n')}
function openMig(){const C=migCfg();$('#mig-text').value=migText(C.table);$('#mig-tol').value=C.tol||0;$('#mig-under').checked=C.under!==false;$('#mig-err').textContent='';$('#mig-modal').hidden=false;closePops()}
function saveMig(){const rows=[],bad=[];$('#mig-text').value.split(/\n+/).forEach((ln,i)=>{if(!ln.trim())return;const m=/^(.+?)\s*[=:]\s*(\d+(?:\.\d+)?)\s*(?:m2|m²|sqm)?\s*$/i.exec(ln.trim());if(!m){bad.push(i+1);return}
    const codes=m[1].split(/[,/]|\bor\b/i).map(c=>c.trim().toUpperCase().replace(/\s+/g,'')).filter(Boolean);if(codes.length)rows.push({codes,area:+m[2]})});
  if(bad.length)return $('#mig-err').textContent=`Line ${bad.join(', ')} needs the form: COL, ME7 = 16`;if(!rows.length)return $('#mig-err').textContent='Add at least one line';
  P.mig=Object.assign(migCfg(),{table:rows,tol:Math.max(0,num($('#mig-tol').value,0)),under:$('#mig-under').checked});savePrefs();$('#mig-modal').hidden=true;render();renderInspector();if(!$('#p-sch').hidden)renderSchedule();toast('MIG table saved in this browser')}
$('#mig-edit').addEventListener('click',openMig);$('#mig-save').addEventListener('click',saveMig);$('#mig-cancel').addEventListener('click',()=>$('#mig-modal').hidden=true);
$('#mig-reset').addEventListener('click',()=>{$('#mig-text').value=migText(MIG_DEF);$('#mig-tol').value=10;$('#mig-under').checked=true});
$('#s-mig').checked=migCfg().on;$('#s-mig').addEventListener('change',e=>{P.mig=Object.assign(migCfg(),{on:e.target.checked});savePrefs();render();renderInspector();if(!$('#p-sch').hidden)renderSchedule()});
bindSet('#s-grid','grid',Number);bindSet('#s-snap','snap');bindSet('#s-snapsz','snapSize',Number);bindSet('#s-osnap','osnap');bindSet('#s-ortho','ortho');bindSet('#s-dims','dims');bindSet('#s-clash','clash');bindSet('#s-wall','wall',Number);bindSet('#s-theme','theme');bindSet('#s-fill','fill');bindSet('#s-lbl','lbl');bindSet('#s-inv','inv');
function applyTheme(){if(P.theme==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=P.theme;updateUnderImg()}
$('#z-in').addEventListener('click',()=>zoomAt(1.25,W/2,H/2));$('#z-out').addEventListener('click',()=>zoomAt(0.8,W/2,H/2));$('#z-fit').addEventListener('click',fit);
$('#m-new').addEventListener('click',()=>{closePops();newTab(blankPlan());toast('New blank plan opened in its own tab')});
/*@dev-only*/$('#m-sample')&&$('#m-sample').addEventListener('click',()=>{closePops();newTab(blankPlan());loadSample();curTab.S=S;renderTabs();toast('Sample office floor opened in a new tab')});/*@end-dev-only*/
$('#m-open').addEventListener('click',()=>{closePops();openPlan()});
$('#m-under').addEventListener('click',()=>{closePops();$('#f-under').click()});
$('#m-undp').addEventListener('click',()=>{closePops();showTab('und',true)});
/* the Design axes menu item and dialog are made here, not in the page, to keep the page inside its size budget */
(()=>{const mi=document.createElement('button');mi.className='mi';mi.type='button';mi.id='m-axes';mi.innerHTML='<svg class="ic" viewBox="0 0 24 24"><path d="M4 20V5M4 20h15"/><path d="M8 16l9-9M17 7v4M17 7h-4"/></svg>Design axes: turn the plan…';$('#m-undp').after(mi);
  const d=document.createElement('div');d.className='keys-modal';d.id='axes-modal';d.hidden=true;d.setAttribute('role','dialog');d.setAttribute('aria-label','Design axes');d.setAttribute('data-keep','');
  d.innerHTML='<div class="keys-card" style="height:auto;max-width:460px"><div class="keys-head"><h3>Design axes</h3><span style="flex:1"></span><button class="btn icon ghost sm" type="button" id="axes-x" aria-label="Close">✕</button></div><div style="padding:14px 16px;display:flex;flex-direction:column;gap:12px"><p class="muted" style="margin:0">Turn the whole plan so a building that sits at an angle is drawn square to the screen. Every floor, the roof and the drawing underneath turn together. North and the campus position turn with it, so nothing moves on site.</p><p id="axes-now" style="margin:0;font-weight:600"></p><button class="btn" type="button" id="axes-pick">Pick a wall to make level</button><div class="row" style="align-items:flex-end"><label class="f" style="flex:1">Or turn by (°), minus for anticlockwise<input type="text" inputmode="decimal" id="axes-deg" autocomplete="off"></label><button class="btn" type="button" id="axes-go">Turn</button></div><button class="btn ghost" type="button" id="axes-reset">Back to how it was first drawn</button></div></div>';
  document.body.appendChild(d)})();
$('#m-axes').addEventListener('click',()=>{closePops();axesOpen()});
$('#axes-modal').addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.id==='axes-x')$('#axes-modal').hidden=true;else if(t.id==='axes-pick')axesPickStart();else if(t.id==='axes-go'){const v=parseFloat($('#axes-deg').value);if(!isFinite(v)||!v)return toast('Type an angle in degrees. A minus sign turns anticlockwise');if(Math.abs(v)>360)return toast('An angle between -360 and 360');turnPlan(v);$('#axes-deg').value=''}else if(t.id==='axes-reset'){const ax=num(S.axes,0);if(ax)turnPlan(-ax)}});
$('#axes-deg').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#axes-go').click()}});
$('#m-ver').innerHTML=`StoreyBook ${APP_VERSION}${APP_FORK?' ('+APP_FORK+')':''}${APP_TEST?' · '+APP_TEST:''} · plan format ${PLAN_V} · library ${LIB_V}<br>Your plans stay in this browser; nothing is uploaded.<br>© Jeff Ying. Free to use; not for redistribution. Not for statutory submission.`;
$('#m-save').addEventListener('click',()=>{closePops();savePlan(false)});
$('#m-saveas').addEventListener('click',()=>{closePops();savePlan(true)});
$('#m-sch').addEventListener('click',()=>{closePops();exportSchedule()});
$('#m-png').addEventListener('click',()=>{closePops();exportPNG()});
$('#m-fire')&&$('#m-fire').addEventListener('click',()=>{closePops();showTab('fire',true);egressRun()});
$('#m-dxf')&&$('#m-dxf').addEventListener('click',()=>{closePops();const nm=((S.name||'plan')+' '+(S.bld?levelNames(S.bld)[bldLevel(S).id]:'')).trim().replace(/[\\/:*?"<>|]+/g,'-');saveText(nm+'.dxf',exportDXF(),'application/dxf','.dxf','AutoCAD DXF');toast('DXF exported (current floor, mm) — opens in AutoCAD, import into Revit as a reference')});
/* IFC4 export: storeys, walls, floor slabs and columns — a 3D model Revit imports as BIM elements */
function exportIFC(){
  ensureBld(S);syncFloorOut(S);const b=S.bld,st=levelStack(b),nm=levelNames(b),real=S.objs,mm=0.001;
  let id=0;const L=[];
  const E=(t,a)=>{id++;L.push('#'+id+'='+t+'('+a+');');return '#'+id};
  const GID=()=>{let s='';const cs='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';for(let i=0;i<22;i++)s+=cs[(Math.random()*64)|0];return s};
  const SS=s=>String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"''").replace(/[\r\n]+/g,' ');
  const N=x=>{let v=(+x);if(!isFinite(v))v=0;return (Math.abs(v)<1e-7?0:v).toFixed(5)};
  const PT3=(x,y,z)=>E('IFCCARTESIANPOINT','('+N(x)+','+N(y)+','+N(z)+')');
  const PT2=(x,y)=>E('IFCCARTESIANPOINT','('+N(x)+','+N(y)+')');
  const DIR=(x,y,z)=>E('IFCDIRECTION',z==null?'('+N(x)+','+N(y)+')':'('+N(x)+','+N(y)+','+N(z)+')');
  const A3=p=>E('IFCAXIS2PLACEMENT3D',p+',$,$');
  const ctx=E('IFCGEOMETRICREPRESENTATIONCONTEXT',"$,'Model',3,1.E-05,"+A3(PT3(0,0,0))+',$');
  const units=E('IFCUNITASSIGNMENT','('+[E('IFCSIUNIT','*,.LENGTHUNIT.,$,.METRE.'),E('IFCSIUNIT','*,.AREAUNIT.,$,.SQUARE_METRE.'),E('IFCSIUNIT','*,.VOLUMEUNIT.,$,.CUBIC_METRE.'),E('IFCSIUNIT','*,.PLANEANGLEUNIT.,$,.RADIAN.')].join(',')+')');
  const pname=SS(S.name||'Layout');
  const proj=E('IFCPROJECT',"'"+GID()+"',$,'"+pname+"',$,$,$,$,("+ctx+"),"+units);
  const sitePl=E('IFCLOCALPLACEMENT','$,'+A3(PT3(0,0,0)));
  const site=E('IFCSITE',"'"+GID()+"',$,'Site',$,$,"+sitePl+",$,$,.ELEMENT.,$,$,$,$,$");
  const bldPl=E('IFCLOCALPLACEMENT',sitePl+','+A3(PT3(0,0,0)));
  const bldg=E('IFCBUILDING',"'"+GID()+"',$,'"+pname+"',$,$,"+bldPl+",$,$,.ELEMENT.,$,$,$");
  const body=(solid)=>{const rep=E('IFCSHAPEREPRESENTATION',ctx+",'Body','SweptSolid',("+solid+")");return E('IFCPRODUCTDEFINITIONSHAPE','$,$,('+rep+')')};
  const wallEl=(a,c,tmm,h,stPl)=>{const ax=a[0]*mm,ay=-a[1]*mm,cx=c[0]*mm,cy=-c[1]*mm,dx=cx-ax,dy=cy-ay,len=Math.hypot(dx,dy);if(len<1e-4||h<=0)return null;
    const prof=E('IFCRECTANGLEPROFILEDEF','.AREA.,$,'+E('IFCAXIS2PLACEMENT2D',PT2((ax+cx)/2,(ay+cy)/2)+','+DIR(dx/len,dy/len))+','+N(len)+','+N(Math.max(0.02,tmm*mm)));
    const solid=E('IFCEXTRUDEDAREASOLID',prof+','+A3(PT3(0,0,0))+','+DIR(0,0,1)+','+N(h));
    return E('IFCWALL',"'"+GID()+"',$,'Wall',$,$,"+E('IFCLOCALPLACEMENT',stPl+','+A3(PT3(0,0,0)))+","+body(solid)+",$,.NOTDEFINED.")};
  const colEl=(o,h,stPl)=>{const a=(o.r||0)*Math.PI/180;const prof=E('IFCRECTANGLEPROFILEDEF','.AREA.,$,'+E('IFCAXIS2PLACEMENT2D',PT2(o.x*mm,-o.y*mm)+','+DIR(Math.cos(a),-Math.sin(a)))+','+N(Math.max(0.02,(o.w||300)*mm))+','+N(Math.max(0.02,(o.d||300)*mm)));
    const solid=E('IFCEXTRUDEDAREASOLID',prof+','+A3(PT3(0,0,0))+','+DIR(0,0,1)+','+N(h));
    return E('IFCCOLUMN',"'"+GID()+"',$,'Column',$,$,"+E('IFCLOCALPLACEMENT',stPl+','+A3(PT3(0,0,0)))+","+body(solid)+",$,.COLUMN.")};
  const slabEl=(poly,thick,stPl)=>{if(!poly||poly.length<3)return null;const pts=poly.map(p=>PT2(p[0]*mm,-p[1]*mm));pts.push(pts[0]);
    const pl=E('IFCPOLYLINE','('+pts.join(',')+')');const prof=E('IFCARBITRARYCLOSEDPROFILEDEF','.AREA.,$,'+pl);
    const solid=E('IFCEXTRUDEDAREASOLID',prof+','+A3(PT3(0,0,0))+','+DIR(0,0,-1)+','+N(thick));
    return E('IFCSLAB',"'"+GID()+"',$,'Slab',$,$,"+E('IFCLOCALPLACEMENT',stPl+','+A3(PT3(0,0,0)))+","+body(solid)+",$,.FLOOR.")};
  const storeys=[],contain=[];
  try{b.levels.forEach((lv,i)=>{const elev=st[i].ffl*mm,h=Math.max(2,st[i].ftf*mm);
    const stPl=E('IFCLOCALPLACEMENT',bldPl+','+A3(PT3(0,0,elev)));
    const storey=E('IFCBUILDINGSTOREY',"'"+GID()+"',$,'"+SS(nm[lv.id])+"',$,$,"+stPl+",$,$,.ELEMENT.,"+N(elev));storeys.push(storey);
    S.objs=bldObjs(lv,real);const els=[];
    S.objs.filter(o=>o.t==='room'&&!o.nowall).forEach(r=>{(r.pts||[]).forEach((p,k)=>{const c=r.pts[(k+1)%r.pts.length];els.push(wallEl(p,c,P.wall||100,h,stPl))})});
    S.objs.filter(o=>o.t==='wall'&&!o.site).forEach(w=>wallSegs(w).forEach(([a,c])=>els.push(wallEl(a,c,w.th||100,h,stPl))));
    S.objs.filter(o=>isCol(o)).forEach(o=>els.push(colEl(o,h,stPl)));
    floorPlate().forEach(poly=>els.push(slabEl(poly,0.2,stPl)));
    const good=els.filter(Boolean);if(good.length)contain.push([storey,good]);
  })}finally{S.objs=real}
  E('IFCRELAGGREGATES',"'"+GID()+"',$,$,$,"+proj+",("+site+")");
  E('IFCRELAGGREGATES',"'"+GID()+"',$,$,$,"+site+",("+bldg+")");
  if(storeys.length)E('IFCRELAGGREGATES',"'"+GID()+"',$,$,$,"+bldg+",("+storeys.join(',')+")");
  contain.forEach(([storey,els])=>E('IFCRELCONTAINEDINSPATIALSTRUCTURE',"'"+GID()+"',$,$,$,("+els.join(',')+"),"+storey));
  const ts=new Date().toISOString().replace(/\.\d+Z$/,'');
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('${pname}.ifc','${ts}',(''),(''),'StoreyBook','StoreyBook','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
${L.join('\n')}
ENDSEC;
END-ISO-10303-21;`;
}
$('#m-ifc')&&$('#m-ifc').addEventListener('click',()=>{closePops();const nm=(S.name||'building').replace(/[\\/:*?"<>|]+/g,'-');saveText(nm+'.ifc',exportIFC(),'application/x-step','.ifc','IFC model');toast('IFC model exported (all floors, metres) — open or link in Revit')});
$('#m-keys').addEventListener('click',e=>{e.stopPropagation();closePops();openKeys()});

/* ================= keyboard shortcuts page =================
   One list drives the keyboard map, so the page always matches what the keys actually do. */
const KEYGROUPS={tool:['Tools','#2f9e8f'],edit:['Edit','#d08a2b'],view:['View','#3f7fd1'],walk:['Walkthrough','#7a5bd0']};
const KEYMAP={
  plan:{v:['Select','tool'],h:['Pan','tool'],d:['Room','tool'],w:['Walls','tool'],s:['Search commands','view'],g:['Shape','tool'],m:['Measure','tool'],t:['Text','tool'],p:['Paint','tool'],
    r:['Rotate','edit'],x:['Door hinge','edit'],del:['Delete','edit'],esc:['Cancel','edit'],
    q:['Add furniture','view'],u:['Curve','tool'],c:['Ceiling plan','view'],l:['Library','view'],i:['Details','view'],f:['Fit plan','view'],tab:['2D / 3D','view'],'1':['Building','view'],'2':['2D view','view'],'3':['3D view','view'],space:['Hold to pan','view'],'/':['Shortcuts (?)','view']},
  walk:{w:['Forward','walk'],a:['Left','walk'],s:['Back','walk'],d:['Right','walk'],shift:['Run','walk'],space:['Jump','walk'],e:['Open / close door','walk'],v:['1st / 3rd person','walk'],'=':['Zoom in','walk'],'-':['Zoom out','walk'],c:['Walls solid / ghost','walk'],'1':['Building','walk'],'2':['2D plan','walk'],'3':['Exit to 3D','walk'],esc:['Exit walk','walk']}};
const KEYCOMBOS={plan:[['1 / 2 / 3','Building view / 2D / 3D'],['PageUp / PageDown','Floor above / below'],['Shift R','Rotate anticlockwise'],['Shift X','Door swings the other way'],['Ctrl Z / Ctrl Y','Undo / redo'],['Ctrl C · X · V','Copy, cut, paste at the cursor'],['Ctrl D','Duplicate'],['Ctrl A','Select all furniture'],['Ctrl G / Ctrl Shift G','Group / ungroup'],['Ctrl S / Ctrl O','Save / open plan file'],['Arrows','Nudge by snap size (Shift: 10 mm)'],['Shift drag','Move along one axis only (touch: hold a second finger)'],['Shift or Ctrl click','Add to or remove from the selection'],['Alt','Place or draw without snapping'],['Alt click','Pick one item inside a group'],['Drag while placing','Fill a row or grid with copies'],['Alt click a point','Remove the point'],['Alt drag a room corner','Move one corner; without Alt the room stays rectangular'],['Enter / Esc','End the wall you are drawing'],['Type numbers','Set the next wall length while drawing walls']],
  walk:[['PageUp / PageDown','Ride a lift to another floor'],['Mouse wheel','Zoom the third-person camera; all the way in is first person'],['Mouse','Look around (click the view first)'],['Arrows','Move and turn'],['Click the map','Jump to that spot']]};
const KEYMOUSE=[['Wheel','Zoom at the cursor'],['Middle drag','Pan (2D and 3D)'],['Right drag','Pan in 3D'],['Left drag','Box select in 2D · orbit in 3D'],['Double-click a room or furniture','Rename it'],['Right-click','Stop placing or drawing; otherwise opens a menu (2D and 3D)']];
let keysMode='plan';
function openKeys(mode){if(mode)keysMode=mode;renderKeys();$('#keys-modal').hidden=false}
function renderKeys(){
  const map=KEYMAP[keysMode];const rows=[['1','2','3','4','5','6','7','8','9','0','-','='],['tab','q','w','e','r','t','y','u','i','o','p','[',']'],['caps','a','s','d','f','g','h','j','k','l',';',"'",'enter'],['shift','z','x','c','v','b','n','m',',','.','/','shift2'],['ctrl','alt','space','alt2','esc','del']];
  const lab={tab:'Tab',caps:'Caps',enter:'Enter',shift:'Shift',shift2:'Shift',ctrl:'Ctrl',alt:'Alt',alt2:'Alt',space:'Space',esc:'Esc',del:'Delete'};
  const wide={tab:1.5,caps:1.8,enter:2,shift:2.3,shift2:2.3,ctrl:1.5,alt:1.3,alt2:1.3,space:6,esc:1.3,del:1.6};
  const kb=rows.map(r=>`<div class="kb-row">${r.map(k=>{const id=(k==='shift2'?'shift':k==='alt2'?'alt':k);const m=map[id];const g=m?KEYGROUPS[m[1]]:null;
    return `<div class="kb-key${m?' on':''}" style="flex:${wide[k]||1}${g?`;--kc:${g[1]}`:''}"><span class="kb-cap">${esc(lab[k]||k.toUpperCase())}</span>${m?`<span class="kb-act">${esc(m[0])}</span>`:''}</div>`}).join('')}</div>`).join('');
  const used=[...new Set(Object.values(map).map(m=>m[1]))];
  $('#keys-body').innerHTML=`<div class="kb-tabs"><button type="button" data-km="plan" class="${keysMode==='plan'?'on':''}">Planning (2D and 3D)</button><button type="button" data-km="walk" class="${keysMode==='walk'?'on':''}">Walkthrough</button></div>
    <div class="kb">${kb}</div><div class="kb-legend">${used.map(u=>`<span><i style="background:${KEYGROUPS[u][1]}"></i>${KEYGROUPS[u][0]}</span>`).join('')}</div>
    <div class="kb-cols"><div><h4>Key combinations</h4><dl>${KEYCOMBOS[keysMode].map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></div>
    <div><h4>Mouse</h4><dl>${KEYMOUSE.map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></div></div>`;
}
/* ================= user guide =================
   A short beginner's guide, opened from the menu. Plain HTML, one section at a time. */
const GUIDE=[
 ['start','Start here',`<h4>Start here</h4><p><b>StoreyBook is a sketchbook for buildings.</b> Start on a blank page, draw a floor, then add the next storey on top: a book of storeys you can flip through, check and walk around in 3D before an architect is ever involved.</p><p>Plan a single floor or a whole building, check rooms against MIG, and walk through it. Your plans stay in this browser; nothing is uploaded.</p>
  <p><b>Your first layout in five minutes</b></p><ol><li>Press <kbd>D</kbd> (Room) and drag a rectangle. Drag more rectangles next to it for more rooms.</li><li>Double-click a room to name it, for example <i>COL office</i>. MIG checks the size straight away.</li><li>Open the <b>Library</b>, pick a workstation and click to place it. Press and drag to place a whole row.</li><li>Click <b>3D</b>, then <b>Walk</b>, to see it.</li><li>Click <b>Save</b> to keep a plan file you can share.</li></ol>
  <p><b>Four ways to get a building on the page</b></p><ol><li><b>Draw it by hand</b> (section 1).</li><li><b>Start from a drawing</b>: load a floor plan and let StoreyBook trace the walls (section 1).</li><li><b>Start from requirements</b>: fill in the Excel requirements form and let StoreyBook size and lay out the building (section 8).</li><li><b>Ask the AI assistant</b> in plain words (section 9).</li></ol>
  <p><b>Cannot find something?</b> Press <kbd>S</kbd> (or <kbd>Ctrl K</kbd>, or the magnifier at the top) and type. It searches every tool, menu item, view, tab, library item and room template.</p>
  <div class="tip">Try the sample: menu ⋮ → <b>Load sample office floor</b>. It is a full office floor you can change freely.</div>`],
 ['draw','1 · Draw the floor',`<h4>Draw the floor</h4><p><b>From a drawing (fastest):</b></p><ol><li>Menu ⋮ → <b>Load floor plan</b> and pick a PDF or image. The <b>Underlay</b> panel in Details holds the controls. It opens when a drawing is loaded; to come back to it, use menu ⋮ → <b>Floor plan underlay</b>.</li><li>Set the scale: click two ends of a known length and type the length.</li><li>Click <b>Detect walls</b>. Columns, walls, windows and rooms are traced for you. Fix anything it missed by hand.</li></ol>
  <p><b>By hand:</b></p><ul><li><b>Room</b> <kbd>D</kbd>: drag rectangles. Drag a corner later and the room stays rectangular; hold <kbd>Alt</kbd> to move one corner on its own.</li><li><b>Walls</b> <kbd>W</kbd>: click corners. Type a number and press <kbd>Enter</kbd> for an exact length. Click the first corner to close the loop and make a room.</li><li><b>Curve</b> <kbd>U</kbd>: click points and the wall curves smoothly through them.</li></ul>
  <p><b>Changing a shape:</b> select it and drag its points. Click <b>Add points</b> in Details (or double-click the line) to put in a new point. <kbd>Alt</kbd>-click a point to remove it.</p>`],
 ['floors','2 · Floors and cores',`<h4>Floors and cores</h4><ul><li>The floor button at the top (L1) switches floors. <kbd>PageUp</kbd> and <kbd>PageDown</kbd> do the same.</li><li>Floors share one <i>typical</i> layout of walls and rooms. Make a floor <b>unique</b> in the Floors tab if its walls differ.</li><li>Furniture is always per floor. <b>Duplicate floor</b> makes a new floor that copies an existing one (its walls and rooms too, if it is unique); <b>Copy fit-out</b> repeats furniture onto floors you already have.</li><li>Stairs, lifts and shafts come from the <b>Core</b> section of the Library. Place one once and it runs through every floor, basements included. Set <b>From</b> and <b>To</b> in Details to limit it.</li><li>Column grids: Floors tab → Column grid. Type bays like <i>3x8400, 6000</i>.</li><li><b>Raised floor</b>: select a room and set its raised-floor height in Details. The floor lifts in 3D and when you walk.</li><li><b>Lifts</b>: in walk mode, step into a lift, then <kbd>PageUp</kbd> / <kbd>PageDown</kbd> to ride to another floor.</li><li><b>Roof</b>: the Floors tab has a Roof level. Go up to place roof items such as solar PV modules. They are checked against the Fire Code roof rules in the Checks tab.</li><li><b>Undo works across the building.</b> There is one history: Undo takes back the last change on whichever floor (or the roof) it was made, and the view jumps there and tells you.</li></ul>`],
 ['fit','3 · Fit out',`<h4>Fit out</h4><ol><li>Open the <b>Library</b> (<kbd>L</kbd>) or press <kbd>Q</kbd> to search. Items are grouped by discipline (Architecture, C&amp;S, Mechanical, Electrical with Security, IT, Site), then by group. Click a heading to fold it; use the chips at the top to show one discipline.</li><li>Click an item, then click the plan to place it. It snaps flush to walls and furniture.</li><li><b>Press and drag</b> instead of clicking to lay out a row or a grid. The count shows as you drag.</li><li><kbd>R</kbd> rotates while placing. Right-click or <kbd>Esc</kbd> stops.</li></ol>
  <ul><li>Select several things with a drag box, then move, copy (<kbd>Ctrl C</kbd> / <kbd>Ctrl V</kbd>), align or array them from Details.</li><li><b>Turn anything by any angle</b>: select it and drag the round grip above it. It turns in 15° steps; hold <kbd>Alt</kbd> to turn freely. Straight after, an angle box opens beside the grip: type the exact angle (e.g. 23.5, or -23.5 for anticlockwise) and press <kbd>Enter</kbd> or Turn. Double-click (double-tap) the grip to open the box without dragging. <kbd>R</kbd> still turns 90°. <b>Building at an angle on its site?</b> Menu ⋮ → <b>Design axes</b>: pick one of its walls and the whole plan turns so that wall is level, then draw square as usual. North and the campus position turn with it, so nothing moves on site.</li><li><b>A room takes its contents with it.</b> Moving, turning, copying, cutting or duplicating a room takes the furniture inside it and the doors and windows on its outline. Select the furniture itself to move it alone. <b>Deleting a room deletes only the room</b>; what stood in it stays.</li><li><b>Room templates</b> sit under each discipline in the Library. <b>Data hall</b> (IT) sizes a room from the number of racks, rack size, kW per rack, clear width around each row and the cooling needed, then places the room with its racks, cooling units and door. Select the room later and change the inputs to rebuild it. Any room can be saved with its contents as your own template: select it and use <b>Save this room and its contents as a template</b> in Details.</li><li><b>Sets</b> (workstation clusters, meeting sets) place as a group. <kbd>Alt</kbd>-click picks one item inside a group.</li><li><b>Ceiling</b> (<kbd>C</kbd>) shows the ceiling plan for lights, FCUs, sprinklers and CCTV. Select a CCTV to aim it and see what it sees.</li><li><b>Paint</b> (<kbd>P</kbd>): pick a colour, then click a wall, floor, door or item. Shift-click a room for its walls; Alt-click to pick up a colour. Tick <b>Paint one part only</b> to colour a single face in 3D (a table top, not its legs). Works in 2D and 3D.</li><li><b>Trunking</b>: the Trunk tool draws ceiling cable trunking along a path; set its width, height and drop in Details. It shows on the Ceiling layer and overlaps are allowed.</li></ul>`],
 ['site','4 · Site: fence and roads',`<h4>Site: fence and roads</h4><p>The site sits on the ground floor (L1). Outside the building, everything is grass.</p><ol><li><b>Fence</b>: click points around the boundary and click the first point to close it. The area inside shows its size in Details. Change the height there.</li><li><b>Road</b>: click points along the road's centre line, then <kbd>Enter</kbd>. Change the width in Details.</li><li>From the Library's <b>Site</b> section, add gates, boom barriers, a guardhouse, car park lots and trees. Drag to lay out a row of car park lots.</li></ol><div class="tip">Leave a gap in the fence and put a sliding gate in it. The Site layer hides or shows all of it at once.</div>`],
 ['check','5 · Check',`<h4>Check</h4><p>The <b>Checks</b> tab in Details lists every check in one place, each with its state and a button to its detail.</p><ul><li><b>Travel distance to exits</b>: mark doors or exit stairs as <b>final exits</b>, then show the distances. It colours every point by its walking distance to the nearest exit (routed through doors, not walls), labels each room with its longest distance, and flags rooms over the limit or with no route.</li><li><b>Roof solar PV</b>: checks modules on the roof against Fire Code Cl. 10.2.1 (array size, aisles, reach, distance from the roof edge, the roof stair and vents).</li><li><b>Space entitlement (MIG)</b>: put the rank in the room name (COL, ME5, 2x ME4). A room over its entitlement turns red. Change entitlements in menu ⋮ → MIG entitlements.</li><li><b>Programme brief</b>: whether each space asked for in the requirements has been drawn.</li><li><b>Plan problems</b>: press Run to look on every floor for rooms lying on each other, furniture outside every room, doors not on a wall and clashes.</li><li><b>Security zones</b>: press its button to set rooms White, Green, Red or Black and show the zones as an overlay in 2D and 3D.</li></ul>
  <ul><li><b>Clashes</b>: items that overlap walls or each other are outlined in red as you work.</li><li><b>Schedule</b> tab: counts for every item, per floor and for the building, plus rooms, areas and MIG results. Export it as CSV. It also holds the <b>cost estimate</b>: pick A&amp;A or New build, type a rate per m² and the total follows the measured GFA.</li><li><b>Review</b> tab: use the <b>Pin</b> tool to drop a numbered comment on the plan. Each shows who raised it and when, takes replies, and can be marked Resolved. Filter Open / Resolved / All and export the list.</li></ul><div class="tip">All checks are advisory. Confirm fire and code figures with your QP or fire consultant.</div>`],
 ['see','6 · See it in 3D',`<h4>See it in 3D</h4><ul><li><b>3D</b> (<kbd>Tab</kbd>): orbit with left drag, pan with right drag, zoom with the wheel.</li><li><b>Building</b>: every floor stacked. Tick <i>Exploded</i> to pull floors apart. Click a floor to open it.</li><li><b>Walk</b>: click where to start and drag to face a direction. <kbd>W A S D</kbd> to move, <kbd>Shift</kbd> to run, <kbd>E</kbd> opens doors and lift doors, <kbd>V</kbd> switches to third person. Walk up a stair to reach the next floor.</li>
  <li><b>Draw in 3D</b>: the drawing tools now work right in the 3D view. Pick Room, Walls, Curve, Road, Fence, a Shape, Measure or Section and draw on the floor — drag for rooms and shapes, click points for walls and roads (Enter, double-click or right-click to finish). Drag empty space to orbit while you draw. Snapping, <kbd>Ctrl</kbd> for a free angle and the live angle all work as in 2D.</li>
  <li><b>Section cut</b>: use the <b>Section</b> tool in 2D or 3D to drag a line across the plan, then view 3D — the model is sliced along that line. Use <b>Section</b> / <b>Flip</b> on the 3D bar to turn it off or flip which side is kept.</li>
  <li><b>Sun study</b>: in 3D press <b>Sun</b>. Pick a month (or Today / 21 Jun / equinox / 21 Dec), then drag the time or type it in. The model lights and shadows for that moment, and the readout shows the sun's direction and height. Screen-up is North by default — set <b>N↑</b> to the compass bearing of up if your site is turned, and <b>Lat</b> to the site latitude (Singapore ≈ 1.35). It's a design aid using local clock time, not an almanac.</li></ul>`],
 ['save','7 · Save and share',`<h4>Save and share</h4><ul><li>Work is <b>autosaved in this browser</b> as you go. The status under the plan name shows when. It stays on this computer and this browser only.</li><li><b>Save</b> writes a plan file (.json). This is the copy to keep and send. Anyone with StoreyBook can open it.</li><li>Export: <b>PNG</b> for slides, <b>CSV</b> schedule for costing, <b>STL</b> for 3D printing,, <b>DXF</b> (2D CAD, mm, current floor) for AutoCAD, and <b>IFC</b> (3D, all floors, metres) to hand the model to architects — it opens or links in Revit as walls, slabs, columns and levels.</li><li><b>Snapshots</b> (menu ⋮): keep a named copy of the building at a point in time, compare it with now, or go back to it. <b>Issue revision</b> numbers a snapshot; comparing then draws revision clouds round what changed, and the PNG export carries the clouds and a revision table.</li><li>The <b>Review</b> tab keeps design notes with the plan and lists the pinned comments (section 5).</li><li>Messages at the bottom of the screen can be read again: search for <b>Recent messages</b>.</li><li>Tabs along the top let you keep several plans open.</li></ul><div class="tip">Treat a plan file at the classification of the drawing inside it.</div>`],
 ['prog','8 · From requirements',`<h4>From requirements to a building</h4><p>The <b>Programme</b> turns requirements into areas, GFA and storeys, then lays out a building. Open it by searching for <b>Programme</b>, or from the AI assistant panel.</p><ol><li><b>Bring in the requirements.</b> Open the Excel requirements form, or type the headcount and spaces into the Programme itself. Anything you change in the app is marked against the form.</li><li><b>Read the result.</b> StoreyBook works out workspace and named-space areas, circulation, cores, total GFA, the number of storeys, the area per person and which code rules are triggered. The sums are done by formula, not by AI.</li><li><b>Stack the floors.</b> A stacking table suggests which spaces go on which floor. Edit it per floor, or ask the AI for stacking and adjacency advice.</li><li><b>Build the building.</b> Each floor is laid out as rows of rooms on corridors, with a stair and lift core, a second stair, a door on every room, furniture from the seat counts, and windows. It appears as a preview you accept or undo. If the plan already has rooms, it builds in a new tab.</li></ol><ul><li>Norms and code rules are locked until you unlock them; changes are flagged.</li><li>The generator draws a rectangular block. Check the result in the Checks tab: fire travel distance and accessibility are not designed in.</li></ul>`],
 ['ai','9 · AI assistant',`<h4>AI assistant</h4><p>Open it with the <b>AI</b> button at the top, or menu ⋮ → AI assistant. Type what you want in plain words, for example <i>add a pantry next to the meeting room</i>. Its changes appear as a <b>preview</b>: press Accept to keep them or Undo to throw them away.</p><ul><li><b>Three ways to connect</b> (tabs at the top of the panel): <b>Ollama</b> runs a model on your own machine; <b>Claude</b> uses an API key and sends the plan over the internet; <b>Copy &amp; paste</b> gives you a prompt to paste into any AI chat and a box to paste the answer back.</li><li><b>Attach files</b>: drag in a drawing (image or PDF) to have it traced into rooms, or a requirements document (PDF, Word, text) to have it read into a brief. The Excel requirements form goes to the Programme.</li><li>After it draws, StoreyBook checks the result and can send the problems back for the AI to fix, up to three rounds.</li><li>The (i) button in the panel gives the connection steps.</li></ul><div class="tip">Only the Ollama tab keeps everything on your machine. Claude and Copy &amp; paste send plan details outside. Use Ollama for work documents.</div>`],
 ['campus','10 · Campus',`<h4>Campus: several buildings on one site</h4><p>Every plan tab is one building. <b>Campus</b> sets them out together. Open it from the Building view bar, or search for <b>Campus</b>.</p><ul><li><b>Site map</b>: drag a building to move it. Edges snap to neighbours so buildings touch or line up. Arrow keys nudge the selected building by 1 m (<kbd>Shift</kbd> for 10 m). Turn left / right rotates it 90°. Overlapping buildings are outlined in red.</li><li><b>Add building from file</b> opens a saved plan as a new building, set clear of the others.</li><li><b>Links</b> join chosen floors of two buildings and are drawn as bridges.</li><li>The table lists GFA per building and the site total. <b>Show every building in 3D</b> draws them together in the Building view. <b>Set out in a row</b> lines them up for you.</li><li><b>Save campus file</b> writes one file holding every building; opening that file brings them all back.</li></ul>`],
 ['keys','Shortcuts',`<h4>Shortcuts</h4><p>Press <kbd>?</kbd> at any time for the full keyboard map.</p><ul><li><kbd>S</kbd> or <kbd>Ctrl K</kbd> search everything</li><li><kbd>V</kbd> select · <kbd>D</kbd> room · <kbd>W</kbd> walls · <kbd>U</kbd> curve · <kbd>G</kbd> shape · <kbd>M</kbd> measure · <kbd>T</kbd> text</li><li><kbd>2</kbd> 2D view · <kbd>3</kbd> 3D view · <kbd>Tab</kbd> toggles them</li><li><kbd>Ctrl Z</kbd> undo · <kbd>Ctrl Y</kbd> redo · <kbd>Ctrl S</kbd> save</li><li><kbd>F</kbd> fit the plan to the screen · <kbd>Space</kbd> hold to pan</li></ul>`]];
let guideSec='start';
function openGuide(id){if(id)guideSec=id;renderGuide();$('#guide-modal').hidden=false}
function renderGuide(){const g=GUIDE.find(x=>x[0]===guideSec)||GUIDE[0];$('#guide-body').innerHTML=`<div class="guide-wrap"><nav class="guide-nav">${GUIDE.map(x=>`<button type="button" data-gs="${x[0]}" class="${x[0]===g[0]?'on':''}">${x[1]}</button>`).join('')}</nav><div class="guide-main">${g[2]}</div></div>`}
$('#m-guide').addEventListener('click',e=>{e.stopPropagation();closePops();openGuide()});
$('#guide-modal').addEventListener('click',e=>{const t=e.target.closest('[data-gs]');if(t){guideSec=t.dataset.gs;renderGuide();return}if(e.target.id==='guide-modal'||e.target.closest('[data-gclose]'))$('#guide-modal').hidden=true});
$('#keys-modal').addEventListener('click',e=>{const t=e.target.closest('[data-km]');if(t){keysMode=t.dataset.km;renderKeys();return}if(e.target.id==='keys-modal'||e.target.closest('[data-kclose]'))$('#keys-modal').hidden=true});
$('#b-save').addEventListener('click',()=>savePlan(false));
$('#b-undo').addEventListener('click',undo);$('#b-redo').addEventListener('click',redo);$('#b-del').addEventListener('click',()=>deleteAction());
$('#b-lock').addEventListener('click',()=>{checkpoint();S.locked=!S.locked;if(S.locked)[...sel].forEach(id=>{const o=byId(id);if(o&&isWallish(o))sel.delete(id)});syncLock();render();renderInspector();toast(S.locked?'Rooms locked. Clicks pass through to furniture.':'Rooms unlocked')});
function syncLock(){const b=$('#b-lock');b.classList.toggle('on',S.locked);b.setAttribute('aria-pressed',String(S.locked))}
$('#pname').addEventListener('change',e=>{checkpoint();S.name=e.target.value.trim().slice(0,NAME_MAX)||'Untitled plan';e.target.value=S.name;renderTabs()});
function applyDrawers(){if(P.lib&&P.insp&&(window.innerWidth||W)<1100&&!PHONE())P.lib=false;$('#d-lib').hidden=!P.lib;$('#d-insp').hidden=!P.insp;$('#t-lib').classList.toggle('on',P.lib);$('#t-insp').classList.toggle('on',P.insp);mbarSync();/* the corner readouts stand clear of the Details drawer: place them again now and once it has slid in */try{dockClear();setTimeout(()=>{try{dockClear();drawNorth()}catch(e){}},320)}catch(e){}}
$('#t-lib').addEventListener('click',()=>{P.lib=!P.lib;if(P.lib&&W<1100)P.insp=false;savePrefs();applyDrawers()});
$('#t-insp').addEventListener('click',()=>{P.insp=!P.insp;if(P.insp&&W<1100)P.lib=false;savePrefs();applyDrawers();if(P.insp)showTab('sel',true)});
/* ===== phone shell: a five-slot bar and sheets that forward to the desktop controls ===== */
const DRAW_TOOLS=['room','poly','spline','road','fence','shape','measure','text','paint','trunk','section','pin'];
let msheetKind=null;
function msheet(kind){const sh=$('#msheet'),b=$('#msheet-b');if(!sh)return;if(!kind||msheetKind===kind){sh.hidden=true;msheetKind=null;mbarSync();return}
  msheetKind=kind;let h='';
  if(kind==='draw'){h='<h3>Draw</h3><div class="ptiles">'+$$('.dock [data-tool],.dock #t-shape').filter(b=>!['select','pan'].includes(b.dataset.tool)).map(b=>{const key=b.dataset.tool||'shape';const on=(key==='shape'?/^shape/.test(tool):tool===key);return `<button type="button" class="ptile${on?' on':''}" data-pt="${key}">${b.querySelector('svg').outerHTML}<span>${esc(b.textContent.trim())}</span></button>`}).join('')+'</div>'}
  else{const items=[['t-rcp','Ceiling plan'],['t-layers','Layers'],['vbld','Building'],['__floors','Floors'],['m-snaps','Snapshots'],['m-undp','Underlay'],['m-fire','Exits check'],['m-ai','AI assistant'],['b-lock',S.locked?'Unlock rooms':'Lock rooms'],['b-set','Settings'],['m-guide','Guide'],['m-plans','My plans'],['m-open','Open file'],['m-save','Save file'],['m-axes','Design axes']];
    h='<h3>More</h3><div class="ptiles">'+items.map(([id,lab])=>{const src=id.startsWith('__')?null:$('#'+id);if(!src&&!id.startsWith('__'))return '';const ic=src&&src.querySelector('svg')?src.querySelector('svg').outerHTML:'<svg class="ic" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>';return `<button type="button" class="ptile" data-pm="${id}">${ic}<span>${lab}</span></button>`}).join('')+'</div>'}
  b.innerHTML=h;sh.hidden=false;if(P.lib||P.insp){P.lib=false;P.insp=false;savePrefs();applyDrawers()}mbarSync()}
/* Esc, one step at a time: cancel the line being drawn, then the pick box, then the tool, then the selection. The phone Cancel chip and the Select slot run the same cascade. */
function escapeAction(){
  if((polyTool()||tool==='shape-poly')&&polyPts&&polyPts.length){const one=tool==='shape-poly';cancelPoly();if(one)setTool('select');return}
  if(walkPick){walkPick=false;hoverWalk=null;updateHint();render();return}
  if(detBox){detBox=false;updateHint();render();return}
  if(calib){calib=null;renderUnderPanel()}else if(underMove){underMove=false;renderUnderPanel()}else if(tool!=='select')setTool('select');else{sel.clear();pinSel=null;secSel=false;render();renderInspector()}
  closePops();updateHint();escSync()}
function escSync(){const ea=$('#esc-all');if(ea)ea.hidden=!(detBox&&PHONE());const c=$('#esc');if(!c)return;const drawing=polyPts&&polyPts.length>0;const live=tool!=='select'||drawing||walkPick||detBox||calib||underMove;
  c.hidden=!(live&&PHONE()&&!WALK.on);if(!c.hidden)$('#esc span').textContent=drawing?'Cancel line':walkPick?'Cancel':tool==='place'?'Stop placing':'Done'}
function mbarSync(){escSync();const bar=$('#mbar');if(!bar)return;const drawOn=DRAW_TOOLS.includes(tool)||/^shape/.test(tool);
  bar.querySelectorAll('[data-m]').forEach(b=>{const k=b.dataset.m;b.classList.toggle('on',k==='select'?(tool==='select'&&!msheetKind&&!P.lib&&!P.insp):k==='draw'?((drawOn&&!P.lib&&!P.insp&&msheetKind!=='more')||msheetKind==='draw'):k==='lib'?P.lib:k==='insp'?P.insp:msheetKind==='more')});
  const dl=bar.querySelector('[data-m=draw] span');if(dl){const src=drawOn?($$('.dock [data-tool],.dock #t-shape').find(b=>(b.dataset.tool||'shape')===(/^shape/.test(tool)?'shape':tool))):null;dl.textContent=src?src.textContent.trim():'Draw'}
  const ps=$('#pstrip');if(ps){const on=tool==='place'&&placeLib&&PHONE();ps.hidden=!on;if(on)$('#pstrip-t').textContent='Placing '+placeLib.name+' · tap the plan'}
  const pp=$('#paintstrip');if(pp){const on=tool==='paint'&&PHONE();pp.hidden=!on;if(on){const pb=$('#paintstrip-part');if(pb){pb.hidden=!is3D;pb.classList.toggle('on',!!P.paintFace)}}}}
/* phone paint strip: the same presets as the Details palette, scrolling sideways, plus the colour wheel */
function paintStrip(){const el=$('#paintstrip-sw');if(!el)return;const pc=(P.paintCol||'#d9c7a7').toLowerCase();
  el.innerHTML=COLOR_PRESETS.map(([n,c])=>`<button type="button" class="psw${c.toLowerCase()===pc?' on':''}" data-paintc="${c}" title="${esc(n)}" aria-label="${esc(n)}" style="background:${c}"></button>`).join('')+`<label class="psw pcustom" title="Any colour" style="background:${pc}"><input type="color" value="${pc}" data-paintwheel></label>`;
  const on=el.querySelector('.psw.on');if(on)on.scrollIntoView({inline:'center',block:'nearest'});
  /* one part only: a 3D choice, so the button shows there */
  const pb=$('#paintstrip-part');if(pb){pb.hidden=!is3D;pb.classList.toggle('on',!!P.paintFace);pb.setAttribute('aria-pressed',P.paintFace?'true':'false')}}
$('#paintstrip')&&$('#paintstrip').addEventListener('click',e=>{if(e.target.closest('#paintstrip-done')){setTool('select');return}
  if(e.target.closest('#paintstrip-part')){P.paintFace=!P.paintFace;savePrefs();paintStrip();const f=$('#p-sel [data-paintface]');if(f)f.checked=P.paintFace;toast(P.paintFace?'Painting one part at a time':'Painting the whole item');return}
  const b=e.target.closest('[data-paintc]');if(!b)return;P.paintCol=b.dataset.paintc;savePrefs();updateHint();paintStrip()});
$('#paintstrip')&&$('#paintstrip').addEventListener('input',e=>{if(!e.target.matches('[data-paintwheel]'))return;P.paintCol=e.target.value;savePrefs();updateHint();const pc=$('#paintstrip .pcustom');if(pc)pc.style.background=e.target.value;$$('#paintstrip .psw').forEach(x=>x.classList.toggle('on',(x.dataset.paintc||'').toLowerCase()===e.target.value.toLowerCase()))});
/* phones have no Enter key for "detect the whole sheet" */
$('#esc-all')&&$('#esc-all').addEventListener('click',()=>{if(detBox)runDetect(null);escSync()});
$('#mbar')&&$('#mbar').addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(!b)return;const k=b.dataset.m;
  if(k==='select'){msheet(null);if(P.lib||P.insp){P.lib=false;P.insp=false;savePrefs();applyDrawers()}if(tool!=='select'||(polyPts&&polyPts.length)||detBox||calib||underMove||walkPick)escapeAction();else if(multiMode)setMulti(false);else if(sel.size||pinSel||secSel){sel.clear();pinSel=null;secSel=false;render();renderInspector()}else setTool('select');return}
  if(k==='draw'){msheet('draw');return}
  if(k==='more'){msheet('more');return}
  if(k==='lib'){msheet(null);$('#t-lib').click();return}
  if(k==='insp'){msheet(null);$('#t-insp').click();return}});
$('#msheet')&&$('#msheet').addEventListener('click',e=>{if(e.target.closest('[data-msheet-close]')){msheet(null);return}
  const pt=e.target.closest('[data-pt]');if(pt){const key=pt.dataset.pt;const src=key==='shape'?$('#t-shape'):$(`.dock [data-tool="${key}"]`);msheet(null);if(src)src.click();if(key==='shape'){const pp=$('#pop-shape');if(pp&&!pp.hidden){pp.style.left='12px';pp.style.right='12px';pp.style.top='auto';pp.style.bottom='calc(70px + env(safe-area-inset-bottom,0px))'}}return}
  const pm=e.target.closest('[data-pm]');if(pm){const id=pm.dataset.pm;msheet(null);if(id==='__floors'){openInsp();showTab('bld',true)}else{const src=$('#'+id);if(src)src.click()}}});
$('#esc')&&$('#esc').addEventListener('click',()=>escapeAction());
$('#pstrip-done')&&$('#pstrip-done').addEventListener('click',()=>setTool('select'));
/* phones: pull a sheet down by its handle to dismiss it; a short pull springs back */
$$('.grab[data-close]').forEach(g=>{let y0=null,dr=null;const dw=()=>g.closest('.drawer');
  g.addEventListener('pointerdown',e=>{y0=e.clientY;dr=dw();dr.style.transition='none';g.setPointerCapture(e.pointerId)});
  g.addEventListener('pointermove',e=>{if(y0==null||!dr)return;const dy=Math.max(0,e.clientY-y0);if(dy>4)g.dataset.swiped='1';dr.style.transform=`translateY(${dy}px)`;dr.style.opacity=String(Math.max(0.35,1-dy/400))});
  const end=e=>{if(y0==null||!dr)return;const dy=e.clientY-y0;const d=dr;y0=null;dr=null;d.style.transition='';d.style.transform='';d.style.opacity='';
    /* a real pull (over 70 px) dismisses; a shorter one springs back; a plain tap falls through to the click handler, which also dismisses */
    if(dy>70){const id=g.dataset.close;if(id==='d-lib')P.lib=false;if(id==='d-insp')P.insp=false;savePrefs();applyDrawers()}
    if(g.dataset.swiped)setTimeout(()=>delete g.dataset.swiped,350)};
  g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end)});
document.addEventListener('click',e=>{const g=e.target.closest('.grab[data-close]');if(g){if(g.dataset.swiped)return;const id=g.dataset.close;if(id==='d-lib')P.lib=false;if(id==='d-insp')P.insp=false;savePrefs();applyDrawers();return}
  const a=e.target.closest('[data-mact]');if(a){const k=a.dataset.mact;if(k==='rot')rotateSel(90);else if(k==='dup')duplicateSel();else if(k==='del')deleteAction()}});
window.addEventListener('resize',()=>mbarSync());
/* phones: pull any sheet down to close it, from anywhere on it, not only the grab bar. A pull starts only when the
   content under the finger is already scrolled to the top, so scrolling inside a sheet still works. */
(function(){let st=null;
  const sheetOf=t=>{if(!PHONE())return null;const d=t.closest('#d-insp,#d-lib,#msheet');return d&&!d.hidden?d:null};
  const atTop=(t,d)=>{for(let e=t;e&&e!==d.parentElement;e=e.parentElement){if(e.scrollHeight>e.clientHeight+1&&e.scrollTop>0&&/(auto|scroll)/.test(getComputedStyle(e).overflowY))return false}return true};
  const close=d=>{if(d.id==='msheet'){msheet(null);return}if(d.id==='d-lib')P.lib=false;if(d.id==='d-insp')P.insp=false;savePrefs();applyDrawers();mbarSync()};
  document.addEventListener('touchstart',e=>{st=null;if(e.touches.length!==1)return;const t=e.target;/* a field being typed in, a slider or a picker keeps its own gestures; an unfocused field is just part of the sheet */if(t.closest('select,input[type=range],.grab')||(t.closest('input,textarea,[contenteditable=true]')&&t.closest('input,textarea,[contenteditable=true]')===document.activeElement))return;const d=sheetOf(t);if(!d)return;
    const p=e.touches[0];st={d,t,x:p.clientX,y:p.clientY,on:false,top:atTop(t,d)}},{passive:true});
  document.addEventListener('touchmove',e=>{if(!st)return;const p=e.touches[0],dx=p.clientX-st.x,dy=p.clientY-st.y;
    if(!st.on){if(Math.abs(dy)<10&&Math.abs(dx)<10)return;if(!st.top||dy<=0||Math.abs(dx)>Math.abs(dy)){st=null;return}st.on=true;st.d.style.transition='none'}
    e.preventDefault();const y=Math.max(0,dy);st.d.style.transform=`translateY(${y}px)`;st.d.style.opacity=String(Math.max(0.35,1-y/400))},{passive:false});
  const end=e=>{if(!st)return;const s0=st;st=null;if(!s0.on)return;const p=(e.changedTouches&&e.changedTouches[0])||{clientY:s0.y};const dy=p.clientY-s0.y;
    s0.d.style.transition='';s0.d.style.transform='';s0.d.style.opacity='';if(dy>70)close(s0.d);
    /* the finger lifted over a button after a pull must not press it */const stop=ev=>{ev.stopPropagation();ev.preventDefault()};document.addEventListener('click',stop,{capture:true,once:true});setTimeout(()=>document.removeEventListener('click',stop,{capture:true}),400)};
  document.addEventListener('touchend',end,{passive:true});document.addEventListener('touchcancel',end,{passive:true})})();
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>{P.lib=false;savePrefs();applyDrawers()}));
function notice(title,lines,foot){const t=$('#toast');t.innerHTML=`<b>${esc(title)}</b>`+lines.map(l=>`<br>· ${esc(l)}`).join('')+(foot?`<br><span style="opacity:.8">${esc(foot)}</span>`:'');t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,9000)}
/* a message stays about as long as it takes to read (2.6 s at least, 12 s at most). It never takes clicks, so it cannot block what is under it. The last few are kept so one that was missed can be read again (Command search: Recent messages) */
let toastT=null;const TOASTS=[];
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;TOASTS.push({m:String(m),at:Date.now()});if(TOASTS.length>12)TOASTS.shift();clearTimeout(toastT);const ms=Math.min(12000,Math.max(2600,String(m).length*65));toastT=setTimeout(()=>{t.hidden=true},ms)}
function toastLog(){if(!TOASTS.length)return toast('No messages yet');const el=$('#tpl-body');delete $('#tpl-modal').dataset.keep;$('#tpl-title').textContent='Recent messages';$('#tpl-sub').textContent='newest first';TPLD.code=null;el.innerHTML=TOASTS.slice().reverse().map(x=>`<div class="pv-row na"><span class="mk" style="width:70px;font-weight:400">${new Date(x.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span><span>${esc(x.m)}</span></div>`).join('');$('#tpl-modal').hidden=false}

/* ================= keyboard ================= */
/* A click outside a dialog. One rule for every dialog, decided by what is in it (Jeff, 15 Nov 2026): if the dialog has anything to fill in or tick,
   a stray click beside it must not throw that work away, so it closes only on its X or Esc. A dialog that is only read (Shortcuts, the User guide, Recent messages)
   closes on a click outside. The dialog element itself is the backdrop, so a click whose target is the dialog is a click outside its card. */
const DLG_FIELDS='input:not([type=hidden]):not([type=file]),textarea,select,[contenteditable="true"]';
/* a dialog can also say so itself (data-keep), for the ones that are work surfaces even on a page with no field showing, such as the Programme's result page */
const dlgBusy=m=>m.dataset.keep!=null||[...m.querySelectorAll(DLG_FIELDS)].some(f=>!f.closest('[hidden]')&&f.getClientRects().length>0);
document.addEventListener('click',e=>{const m=e.target;if(!m||!m.matches||!m.matches('[role=dialog]')||m.id==='ai-panel'||m.id==='cmdk'||m.hidden)return;e.stopPropagation();if(dlgBusy(m)){e.preventDefault();return}m.hidden=true;if(m.id==='campus-modal')CAMP.adding=false},true);
document.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();const typing=tag==='input'||tag==='textarea'||tag==='select'||e.target.isContentEditable;
  const mod=e.ctrlKey||e.metaKey;const k=e.key.toLowerCase();
  /* Esc closes the dialog in front, from anywhere including inside one of its fields, and before it closes the AI panel behind it */
  if(e.key==='Escape'&&!($('#cmdk')&&!$('#cmdk').hidden)){const m=['tut-menu','su-mats','su-outliner','su-modal','axes-modal','tpl-modal','campus-modal','prog-modal','keys-modal','snap-modal','plans-modal','guide-modal','mig-modal'].map(i=>document.getElementById(i)).find(x=>x&&!x.hidden);if(m){m.hidden=true;if(m.id==='campus-modal')CAMP.adding=false;e.preventDefault();return}}
  /* a dialog is in front: the plan behind it takes no keys (Delete used to remove the selection). Esc still closes the dialog, ? still toggles Shortcuts, and typing in the dialog's own fields is left alone */
  if(e.key!=='Escape'&&e.key!=='?'&&e.key!=='Tab'&&!(mod&&k==='s')&&document.querySelector('#tut-menu:not([hidden]),#su-mats:not([hidden]),#su-outliner:not([hidden]),#su-modal:not([hidden]),#axes-modal:not([hidden]),#keys-modal:not([hidden]),#tpl-modal:not([hidden]),#campus-modal:not([hidden]),#prog-modal:not([hidden]),#plans-modal:not([hidden]),#snap-modal:not([hidden]),#guide-modal:not([hidden]),#mig-modal:not([hidden])')){if(!typing&&!e.target.closest('#campus-map')&&(e.key==='Delete'||e.key==='Backspace'||mod))e.preventDefault();return}
  if(mod&&k==='s'){e.preventDefault();savePrefs();savePlan(e.shiftKey);return}
  if(mod&&k==='o'){e.preventDefault();openPlan();return}
  if(mod&&k==='k'){e.preventDefault();cmdkOpen();return}
  /* Tab flips 2D and 3D from anywhere except form fields, including straight after Q put the cursor in the library search */
  if(e.key==='Tab'&&!mod&&(!typing||e.target.id==='lib-q')){e.preventDefault();if(typing)e.target.blur();if(WALK.on)return;if(bldView){setView('2d');return}set3D(!is3D);return}
  /* Esc in a Details or Notes field leaves the field; the next Esc carries on out (deselect, close) */
  /* Esc closes the command search wherever the focus is; other keys do nothing behind it */
  if(axesPick&&e.key==='Escape'){axesPick=false;e.preventDefault();toast('Design axes: cancelled');return}
  if($('#cmdk')&&!$('#cmdk').hidden){if(e.key==='Escape'){e.preventDefault();cmdkClose()}return}
  /* Esc closes the AI panel even while typing in it */
  if(e.key==='Escape'&&$('#ai-panel')&&!$('#ai-panel').hidden){/* closing the panel never stops the AI: only the Stop button does. It carries on and the preview bar appears when it is done */aiClose();return}
  if(typing&&e.key==='Escape'&&!e.target.closest('.modal,#ctxmenu')&&e.target.id!=='lib-q'){e.target.blur();return}
  if(typing)return;
  if(!WALK.on&&SU&&suKey(e,k,mod))return;
  if(e.key==='?'){e.preventDefault();openKeys();return}
  if(!$('#keys-modal').hidden&&e.key==='Escape'){$('#keys-modal').hidden=true;return}
  if($('#snap-modal')&&!$('#snap-modal').hidden&&e.key==='Escape'){$('#snap-modal').hidden=true;return}
  if(!$('#plans-modal').hidden&&e.key==='Escape'){$('#plans-modal').hidden=true;return}
  if($('#tpl-modal')&&!$('#tpl-modal').hidden&&e.key==='Escape'){$('#tpl-modal').hidden=true;return}
  if($('#prog-modal')&&!$('#prog-modal').hidden&&e.key==='Escape'){$('#prog-modal').hidden=true;return}
  if($('#tpl-modal')&&!$('#tpl-modal').hidden&&e.key==='Escape'){$('#tpl-modal').hidden=true;return}
  if($('#campus-modal')&&!$('#campus-modal').hidden&&e.key==='Escape'){$('#campus-modal').hidden=true;return}
  if(!$('#mig-modal').hidden){if(e.key==='Escape')$('#mig-modal').hidden=true;return}
  if(!$('#guide-modal').hidden){if(e.key==='Escape')$('#guide-modal').hidden=true;return}
  if(WALK.on){
    if(k==='escape'){e.preventDefault();walkStop();return}
    if(e.key==='PageUp'||e.key==='PageDown'){e.preventDefault();rideLift(e.key==='PageUp'?1:-1);return}
    if(k==='c'&&!mod){WALK.collide=!WALK.collide;if(WALK.collide)walkResolve(WALK.pos);walkHud();toast(WALK.collide?'Walls are solid':'Walking through walls');return}
    if(k===' '){e.preventDefault();if(WALK.z<=0)WALK.vz=3300;return}
    if(k==='e'&&!mod){e.preventDefault();walkInteract();return}
    if((e.key==='PageUp'||e.key==='PageDown')&&walkLiftAt(WALK.pos)){e.preventDefault();rideLift(e.key==='PageUp'?1:-1);return}
    if(k==='v'&&!mod){e.preventDefault();walkView();return}
    if(e.key==='+'||e.key==='='||e.key==='-'){e.preventDefault();walkZoom(e.key==='-'?1:-1);return}
    if(k==='1'&&!mod){e.preventDefault();setView('bld');return}
    if(k==='2'&&!mod){e.preventDefault();setView('2d');return}
    if(k==='3'&&!mod){e.preventDefault();walkStop();return}
    /* physical key positions, so an input method or Shift can never leave a key stuck down */
    const wk=walkKey(e);if(wk){WALK.keys.add(wk);e.preventDefault();return}
    if(!mod)return}
  if(e.key===' '&&!spaceDown){if(SU)SU.spaceUsed=false;spaceDown=true;svg.style.cursor='grab';e.preventDefault();return}
  if(mod){
    if(k==='z'&&!e.shiftKey){e.preventDefault();undo();return}
    if((k==='z'&&e.shiftKey)||k==='y'){e.preventDefault();redo();return}
    if(k==='c'){if(copySel())e.preventDefault();return}
    if(k==='x'){if(copySel()){e.preventDefault();deleteSel(true)}return}
    if(k==='v'){if(clip||store.get('osk-clip')){e.preventDefault();pasteClip(true)}return} /* furniture you copied here always wins; otherwise the paste event may carry a floor plan image */
    if(k==='d'){e.preventDefault();duplicateSel();return}
    if(k==='a'){e.preventDefault();setSel(S.objs.filter(o=>!isWallish(o)&&visible(o)&&pickable(o)).map(o=>o.id));return}
    if(k==='g'){e.preventDefault();e.shiftKey?ungroupSel():groupSel();return}
    return;
  }
  if(rotLast&&!mod&&!polyPts&&rotTypedOK()){
    if(/^[0-9.]$/.test(e.key)||(e.key==='-'&&!rotTyped)){rotTyped+=e.key;updateHint();e.preventDefault();return}
    if(e.key==='Backspace'&&rotTyped){rotTyped=rotTyped.slice(0,-1);updateHint();e.preventDefault();return}
    if(e.key==='Enter'&&rotTyped){e.preventDefault();rotApplyTyped();return}
    if(e.key==='Escape'&&rotTyped){rotTyped='';updateHint();e.preventDefault();return}}
  if((tool==='road'||tool==='fence')&&(e.key==='c'||e.key==='C')&&!e.ctrlKey&&!e.metaKey){e.preventDefault();if(tool==='road')P.roadCurve=!P.roadCurve;else P.fenceCurve=!P.fenceCurve;savePrefs();updateHint();drawOverlay();toast(siteCurve()?'Curved: the line bends smoothly through your points':'Straight: any angle · hold Shift to square up');return}
  if((polyTool()||tool==='shape-poly')&&polyPts&&polyPts.length){
    if(/^[0-9.]$/.test(e.key)){typed+=e.key;updateHint();drawOverlay();e.preventDefault();return}
    if(e.key==='Backspace'){if(typed){typed=typed.slice(0,-1)}else polyPts.pop();if(!polyPts.length)polyPts=null;updateHint();drawOverlay();e.preventDefault();return}
    if(e.key==='Enter'){const p=typedPoint();if(p){polyPts.push(p);typed='';updateHint();drawOverlay();if(is3D)drawD3Overlay()}else{finishPoly(!polyTool());if(is3D)drawD3Overlay()}e.preventDefault();return}
    if(e.key==='Escape'&&polyTool()){escapeAction();e.preventDefault();return}
  }
  if(e.key==='1'&&!mod){e.preventDefault();setView('bld');return}
  if(e.key==='2'&&!mod){e.preventDefault();setView('2d');return}
  if(e.key==='3'&&!mod){e.preventDefault();setView('3d');return}
  if(detBox&&e.key==='Enter'){e.preventDefault();runDetect(null);return}
  if(e.key==='Escape'){escapeAction();return}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteAction();return}
  if(k==='x'){if(tool==='place'&&placeLib&&/^door/.test(placeLib.shape)){if(e.shiftKey){placeRot=(placeRot+180)%360;if(placeLib.shape==='door')placeFlip=!placeFlip}else if(placeLib.shape==='door')placeFlip=!placeFlip;drawOverlay();return}if(applyDoorFlip(e.shiftKey))return}
  if(k==='r'){rotateSel(e.shiftKey?-90:90);return}
  if(k==='q'){openAddFurniture();return}
  if(k==='c'&&!mod&&!WALK.on){if(is3D)set3D(false);setRCP(!P.rcp);return}
  if((e.key==='PageUp'||e.key==='PageDown')&&!WALK.on){e.preventDefault();stepFloor(e.key==='PageUp'?1:-1);return}
  if(e.key.startsWith('Arrow')){e.preventDefault();const s=e.shiftKey?10:(P.snap?P.snapSize:10);nudge(e.key==='ArrowLeft'?-s:e.key==='ArrowRight'?s:0,e.key==='ArrowUp'?-s:e.key==='ArrowDown'?s:0);return}
  const tk={v:'select',h:'pan',d:'room',w:'poly',u:'spline',m:'measure',t:'text',p:'paint'};
  /* tool keys work in 3D too: a tool that only exists on the plan switches back to 2D as it does from the dock */
  if(is3D&&!['f','i','l','s','g'].includes(k)&&!tk[k])return;
  if(tk[k]){setTool(tk[k]);return}
  if(k==='s'){e.preventDefault();cmdkOpen();return}
  if(k==='g'){setTool('shape-'+shapeKind);return}
  if(k==='f'){if(is3D)frame3D('persp');else fit();return}
  if(k==='l'){$('#t-lib').click();return}
  if(k==='i'){$('#t-insp').click();return}
  if(e.key==='+'||e.key==='='){zoomAt(1.25,W/2,H/2);return}
  if(e.key==='-'){zoomAt(0.8,W/2,H/2);return}
});
/*@su-start*/
/* ================= SketchUp way of working (fork: 5.0.0 sketchup) =================
   Tools that behave like SketchUp's: Move (M) and Rotate (Q) pick up with one click and put down with the next;
   a value typed straight after (or during) any of them goes into the Measurements box and Enter applies it:
   a distance, an angle, "4000,3000" for a rectangle, "x5" or "/5" for copies. Ctrl while moving or rotating makes a copy.
   Eraser (E) deletes what you click or drag across. The axes are coloured as in SketchUp: red along x, green along y. */
var SU={hidden:new Set(),views:[],zw:null,mv:null,rt:null,rect:null,er:null,last:null,typed:'',cur:null,g:'',spaceUsed:false};
function suOn(){return P.suKeys===undefined?!location.hash.endsWith('-debug'):!!P.suKeys}
function suCancelAll(){if(!SU)return;if(SU.arc){SU.arc=null;render()}if(SU.cir||SU.rr){SU.cir=null;SU.rr=null;render()}SU.zw=null;if(SU.sc)suScaleCancel();if(SU.tp){SU.tp=null;render()}if(SU.of){SU.of=null;render()}if(SU.pp)suPPCancel();if(SU.mv)suMoveCancel();if(SU.rt)suRotCancel();SU.rect=null;SU.er=null;SU.typed=''}
function suHint(){if(!SU)return'';const c=SU.mv?SU.mv.copy:SU.rt?SU.rt.copy:false;
  if(SU.typed)return`<b>Measurements</b>${esc(SU.typed)} · Enter to apply · Esc to clear`;
  if(SU.rect&&(tool==='room'||tool==='shape-rect'))return'<b>Rectangle</b>Click the opposite corner, or type width,depth (e.g. 4000,3000) and press Enter';
  if(SU.mv)return`<b>${c?'Copy':'Move'}</b>Click to put it down · type a distance and Enter · Ctrl ${c?'stops copying':'makes a copy'} · Shift locks the axis · Esc cancels`;
  if(SU.rt)return SU.rt.stage===1?'<b>Rotate</b>Click to set the starting direction · Esc cancels':`<b>${c?'Rotate copy':'Rotate'}</b>Click to finish · snaps every 15° (Alt turns freely) · type an angle and Enter · Ctrl ${c?'stops copying':'makes a copy'}`;
  if(tool==='su-move'||tool==='su-rotate'){if(suLastOK()){const L=SU.last;return L.copy?`<b>${L.kind==='move'?'Copy':'Rotate copy'}</b>Type x5 for five copies, /5 to spread five over the ${L.kind==='move'?'distance':'angle'}, or a new ${L.kind==='move'?'distance':'angle'}`:`<b>${L.kind==='move'?'Move':'Rotate'}</b>Type a new ${L.kind==='move'?'distance':'angle'} and press Enter to change it`}
    if(is3D)return tool==='su-move'?'<b>Move</b>Press on furniture and drag on the floor, or click, move, click · ↑ locks the blue axis to lift it · Ctrl copies · type a distance':'<b>Rotate</b>Press on what to turn and drag round it · snaps every 15° · type an angle';
    return tool==='su-move'?'<b>Move</b>Click what to move (or select first), then click where it goes · Ctrl copies · Shift locks the axis':'<b>Rotate</b>Select, or click the object, at the centre of rotation; then click a starting direction and turn'}
  if(tool==='su-arc'){if(!SU.arc)return'<b>Arc</b>Click where the arc starts';if(!SU.arc.b)return'<b>Arc</b>Click where it ends';return`<b>Arc</b>Move out to bow it (${fmt(Math.abs(SU.arc.h||0))}) and click, or type the bulge · Esc cancels`}
  if(tool==='su-circle'||tool==='su-polygon'){const nm=tool==='su-circle'?'Circle':'Polygon';if(SU.cir&&SU.cir.c)return`<b>${nm}</b>Radius ${fmt(SU.cir.r)}, ${SU.cir.n} sides · click to finish · type a radius, or 12s for 12 sides · Esc cancels`;if(suLastOK())return`<b>${nm}</b>Type a new radius, or 12s for 12 sides, and Enter to change it`;return`<b>${nm}</b>Click the centre of a round room · type 12s first to change the number of sides`}
  if(tool==='su-rrect'){if(SU.rr)return SU.rr.stage===1?'<b>Rotated rectangle</b>Click the other end of the first side':'<b>Rotated rectangle</b>Move out for the depth and click, or type it · Esc cancels';return'<b>Rotated rectangle</b>Click one corner, then the other end of a side at any angle, then the depth'}
  if(tool==='su-scale'){if(SU.sc)return`<b>Scale</b>${+SU.sc.f.toFixed(3)} · move away or towards the centre, click to finish · type a factor and Enter · Esc cancels`;if(suLastOK()&&SU.last.kind==='sc')return'<b>Scale</b>Type a new factor and Enter to change it';return'<b>Scale</b>Select, then click on it and pull · plan sizes scale about the centre; heights stay'}
  if(tool==='su-tape'){if(SU.tp)return`<b>Tape measure</b>Guide ${fmt(Math.abs(SU.tp.d))} from the edge · click to place · type a distance and Enter · Esc cancels`;if(suLastOK()&&SU.last.kind==='tp')return'<b>Tape measure</b>Type a new distance and Enter to move the guide';return'<b>Tape measure</b>Click an edge and pull out a guide line parallel to it · right-click empty space › Delete guides'}
  if(tool==='su-offset'){if(SU.of)return`<b>Offset</b>${fmt(Math.abs(SU.of.d))} ${SU.of.d<0?'inward':'outward'} · click to finish · type a distance and Enter · Esc cancels`;if(suLastOK()&&SU.last.kind==='off')return'<b>Offset</b>Type a new distance and Enter to change it';return'<b>Offset</b>Click a room or a wall, move in or out, click again · a new outline is made and the original stays'}
  if(tool==='su-push'){if(SU.pp)return`<b>Push/Pull</b>${esc(SU.pp.t.label)} ${fmt(SU.pp.t.get())} · move up or down, click to finish · type a value and Enter · Esc cancels`;if(suLastOK()&&SU.last.kind==='pp')return`<b>Push/Pull</b>${esc(SU.last.t.label)} ${fmt(SU.last.t.get())} · type a new value and Enter to change it`;return is3D?'<b>Push/Pull</b>Press on an item and drag up or down to set its height, or on a wall or floor to set the floor-to-ceiling height · or click, move, click':'<b>Push/Pull</b>Click an item, room or wall, then type its height and press Enter (in 3D you can pull it)'}
  if(tool==='su-zwin')return'<b>Zoom window</b>Drag a box, or click two corners, round what to zoom to · F8 goes back';
  if(SU.gctx&&tool==='select')return'<b>Group</b>Editing inside the group: click its parts to select them · Esc or a click outside leaves';
  if(SU.hidden.size&&tool==='select')return`<b>Hidden</b>${SU.hidden.size} hidden · right-click › Unhide all · hidden things are left out of the checks, as with a layer turned off`;
  if(tool==='su-erase')return'<b>Eraser</b>Click, or drag across, what to delete · a room goes alone and its contents stay';return''}
const SU_TOOLS=['su-arc','su-move','su-rotate','su-erase','su-zwin','su-push','su-offset','su-scale','su-tape','su-circle','su-polygon','su-rrect'];
function suBusy(){return !!(SU.arc||SU.mv||SU.rt||SU.rect||SU.er||SU.pp||SU.of||SU.sc||SU.tp||SU.cir||SU.rr)}
/* a step taken when an operation starts; if the operation is cancelled the step goes and Redo comes back as it was */
function suCP(){SU.fut=future;checkpoint()}
function suPopPast(){const s=past.pop();if(s)pastBytes-=s.length;if(SU.fut){if(!future.length)future=SU.fut;SU.fut=null}}
function suTargets(ev){let l=selList().filter(o=>!fixed(o));if(l.length)return l;
  const el=ev&&ev.target&&ev.target.closest&&ev.target.closest('[data-id]');let o=el?byId(el.dataset.id):null;if(!o||fixed(o))return null;
  l=groupOf(o).filter(x=>!fixed(x));sel=new Set(l.map(x=>x.id));renderInspector();return l}
/* copies of a set of objects, with new ids and their own group and template links */
function suClones(src){const gmap={};const out=src.map(o=>{const n=clone(o);n.id=uid();if(n.arr)delete n.arr;if(n.gid){gmap[n.gid]=gmap[n.gid]||uid();n.gid=gmap[n.gid]}return n});tpFix(src.map((o,i)=>[o,out[i]]));return out}
function suRemove(ids){const g=new Set(ids);S.objs=S.objs.filter(o=>!g.has(o.id))}
function suAxis(d){if(!d[0]&&!d[1])return'';if(Math.abs(d[1])<0.5)return'x';if(Math.abs(d[0])<0.5)return'y';return''}
const SU_COL={x:'#d6332e',y:'#2f9a3a','':'var(--accent)'};

/* ---- Move ---- */
function suMoveStart(list,base){const kit=list.concat(carried(list));suCP();
  SU.mv={base,ids:list.map(o=>o.id),orig:kit.map(o=>[o.id,clone(o)]),d:[0,0],copy:false,copies:[],lock:null};SU.typed='';rotLast=null;updateHint();drawOverlay()}
function suMoveApply(d){const m=SU.mv;if(!m)return;m.d=d;
  if(m.copy)m.copies.forEach(([n,o0])=>moveObj(n,o0,d[0],d[1]));else m.orig.forEach(([id,o0])=>{const o=byId(id);if(o)moveObj(o,o0,d[0],d[1])});
  clashDirty=true;if(is3D)suB3();else render()}
function suCopyToggle(){const m=SU.mv||SU.rt;if(!m)return;m.copy=!m.copy;
  if(m.copy){/* originals go back; the copies follow the pointer */m.orig.forEach(([id,o0])=>{const o=byId(id);if(o)Object.assign(o,clone(o0))});const src=m.orig.map(x=>x[1]),cl=suClones(src);cl.forEach(n=>S.objs.push(n));m.copies=cl.map((n,i)=>[n,src[i]])}
  else{suRemove(m.copies.map(c=>c[0].id));m.copies=[]}
  if(SU.mv)suMoveApply(m.d);else suRotApply(m.deg||0);toast(m.copy?'Copy: the original stays · type x5 after placing for five copies':'Move: no copy');updateHint()}
function suMoveTo(raw,shift){const m=SU.mv;let d=raw.slice();
  if(m.akey){if(m.akey==='x')d[1]=0;else d[0]=0}
  else if(shift){if(!m.lock)m.lock=Math.abs(d[0])>=Math.abs(d[1])?'x':'y';if(m.lock==='x')d[1]=0;else d[0]=0}else{m.lock=null;if(Math.abs(d[1])*V.k<8)d[1]=0;else if(Math.abs(d[0])*V.k<8)d[0]=0}
  suMoveApply(d)}
function suMoveCommit(){const m=SU.mv;if(!m)return;SU.mv=null;SU.g='';
  if(!m.d[0]&&!m.d[1]&&!m.copy&&!m.dz){suPopPast();if(is3D){build3D();if(T3&&T3.controls)T3.controls.enabled=true}render();updateHint();return}
  SU.last={kind:'move',copy:m.copy,d:m.d.slice(),n:1,src:m.orig.map(x=>clone(x[1])),ids:m.orig.map(x=>x[0]),copies:m.copies.map(c=>c[0].id),selIds:m.ids};
  if(m.copy)sel=new Set(m.copies.filter(([n,o0])=>m.ids.includes(o0.id)).map(c=>c[0].id));
  SU.last.sig=suSig();SU.last.pl=past.length;markDirty();clashDirty=true;render();renderInspector();updateHint();if(is3D){build3D();if(T3&&T3.controls)T3.controls.enabled=true}}
function suMoveCancel(){const m=SU.mv;if(!m)return;SU.mv=null;SU.g='';if(m.copy)suRemove(m.copies.map(c=>c[0].id));m.orig.forEach(([id,o0])=>{const o=byId(id);if(o){Object.keys(o).forEach(k=>{if(!(k in o0))delete o[k]});Object.assign(o,clone(o0))}});suPopPast();render();updateHint()}

/* ---- Rotate (protractor: centre, then a reference direction, then the turn) ---- */
function suRotStart(list,c){SU.rt={stage:1,c,list,a0:0,deg:0,copy:false,copies:[],orig:null,ids:list.map(o=>o.id)};SU.typed='';rotLast=null;updateHint();drawOverlay()}
function suRotRef(w){const r=SU.rt;if(!r)return;const kit=r.list.concat(carried(r.list));r.a0=Math.hypot(w[0]-r.c[0],w[1]-r.c[1])*V.k<4?0:Math.atan2(w[1]-r.c[1],w[0]-r.c[0]);suCP();r.orig=kit.map(o=>[o.id,clone(o)]);r.stage=2;updateHint();drawOverlay()}
function suRotApply(deg){const r=SU.rt;if(!r||!r.orig)return;r.deg=deg;
  /* a copy keeps its own id and group: only the shape and place come from the original */const put=(o,o0)=>{const id=o.id,gid=o.gid,tp=o.tp,arr=o.arr;Object.keys(o).forEach(k=>{if(!(k in o0))delete o[k]});Object.assign(o,clone(o0));o.id=id;if(gid!==undefined)o.gid=gid;else delete o.gid;/* and its own room link: a copied item belongs to the copied room */if(tp!==undefined)o.tp=tp;else delete o.tp;if(arr!==undefined)o.arr=arr;else delete o.arr;if(deg)turnObj(o,r.c[0],r.c[1],deg)};
  if(r.copy)r.copies.forEach(([n,o0])=>put(n,o0));else r.orig.forEach(([id,o0])=>{const o=byId(id);if(o)put(o,o0)});clashDirty=true;if(is3D)suB3();else render()}
function suRotAngle(w,alt){const r=SU.rt;let a=(Math.atan2(w[1]-r.c[1],w[0]-r.c[0])-r.a0)*180/Math.PI;a=((a+180)%360+360)%360-180;if(alt)return Math.round(a*10)/10;const s=Math.round(a/15)*15;return Math.abs(a-s)<=4?s:Math.round(a*2)/2}
function suRotCommit(){const r=SU.rt;if(!r)return;SU.rt=null;if(r.stage<2){render();updateHint();return}
  if(!r.deg&&!r.copy){suPopPast();render();updateHint();return}
  SU.last={kind:'rot',copy:r.copy,deg:r.deg,c:r.c.slice(),n:1,src:r.orig.map(x=>clone(x[1])),ids:r.orig.map(x=>x[0]),copies:r.copies.map(c=>c[0].id),selIds:r.ids};
  if(r.copy)sel=new Set(r.copies.filter(([n,o0])=>r.ids.includes(o0.id)).map(c=>c[0].id));
  SU.last.sig=suSig();SU.last.pl=past.length;markDirty();clashDirty=true;render();renderInspector();updateHint();if(is3D){build3D();if(T3&&T3.controls)T3.controls.enabled=true}}
function suRotCancel(){const r=SU.rt;if(!r)return;SU.rt=null;if(r.stage===2){if(r.copy)suRemove(r.copies.map(c=>c[0].id));else{r.deg=0;r.copy=false;r.orig.forEach(([id,o0])=>{const o=byId(id);if(o){Object.keys(o).forEach(k=>{if(!(k in o0))delete o[k]});Object.assign(o,clone(o0))}})}suPopPast()}render();updateHint()}

/* ---- what was just done can still be changed by typing, as long as nothing else has touched it ---- */
function suSig(){const L=SU.last;if(!L)return'';if(L.kind==='tp')return JSON.stringify(S.guides||[]);if(L.kind==='pp')return JSON.stringify([L.t.get(),L.t.key]);return JSON.stringify(L.ids.concat(L.copies).map(byId))}
function suLastOK(){if(!SU.last)return false;if((SU.last.kind==='shape'?({circle:'su-circle',poly:'su-polygon',rr:'su-rrect'})[SU.last.shape&&SU.last.shape.k]:({move:'su-move',rot:'su-rotate',pp:'su-push',off:'su-offset',sc:'su-scale',tp:'su-tape'})[SU.last.kind])!==tool||suSig()!==SU.last.sig){SU.last=null;SU.typed='';return false}return true}
/* redo the last move or turn with new numbers: one Undo step per change */
/* a value typed straight after a move or turn changes that same step, as in SketchUp: one Undo takes back the whole operation */
function suRedoLast(o){const L=SU.last;if(!(past.length===L.pl&&!future.length))checkpoint();
  suRemove(L.copies);L.ids.forEach((id,i)=>{const o0=L.src[i],ob=byId(id);if(ob){Object.keys(ob).forEach(k=>{if(!(k in o0))delete ob[k]});Object.assign(ob,clone(o0))}});
  Object.assign(L,o);L.copies=[];
  const step=(obj,o0,k)=>{if(L.kind==='move')moveObj(obj,o0,L.d[0]*k,L.d[1]*k);else{const id=obj.id,gid=obj.gid,tp=obj.tp,arr=obj.arr;Object.keys(obj).forEach(q=>{if(!(q in o0))delete obj[q]});Object.assign(obj,clone(o0));obj.id=id;if(gid!==undefined)obj.gid=gid;else delete obj.gid;if(tp!==undefined)obj.tp=tp;else delete obj.tp;if(arr!==undefined)obj.arr=arr;else delete obj.arr;turnObj(obj,L.c[0],L.c[1],L.deg*k)}};
  if(!L.copy)L.ids.forEach((id,i)=>{const ob=byId(id);if(ob)step(ob,L.src[i],1)});
  else{const f=L.div?1/L.n:1;for(let k=1;k<=L.n;k++){const cl=suClones(L.src);cl.forEach((n,i)=>{step(n,L.src[i],k*f);S.objs.push(n);L.copies.push(n.id)})}}
  L.sig=suSig();L.pl=past.length;markDirty();clashDirty=true;render();renderInspector();updateHint()}

/* ---- Measurements box ---- */
function suParse(t){t=String(t||'').trim();let m;
  if((m=t.match(/^[x*]\s*(\d+)$/i)))return{n:Math.max(1,Math.min(500,+m[1])),div:false};
  if((m=t.match(/^(\d+)\s*s$/i)))return{sides:Math.max(3,Math.min(200,+m[1]))};
  if((m=t.match(/^\/\s*(\d+)$/)))return{n:Math.max(1,Math.min(500,+m[1])),div:true};
  if((m=t.match(/^(-?\d*\.?\d+)\s*[,;]\s*(-?\d*\.?\d+)$/)))return{w:+m[1],d:+m[2]};
  if((m=t.match(/^-?\d*\.?\d+$/)))return{v:+t};return null}
function suApplyTyped(){const t=SU.typed;SU.typed='';const q=suParse(t);
  const bad=msg=>{toast(msg);updateHint();vcbSync()};
  if(!q)return bad('Type a number, a width and depth such as 4000,3000, or x5 or /5 for copies');
  if(SU.rect){if(q.w==null)return bad('Type the width and depth with a comma between, e.g. 4000,3000');const a=SU.rect.a,c=SU.cur||[a[0]+1,a[1]+1];const sx=c[0]<a[0]?-1:1,sy=c[1]<a[1]?-1:1;SU.rect=null;rectFinish(a,[a[0]+sx*Math.abs(q.w),a[1]+sy*Math.abs(q.d)]);updateHint();return}
  if(SU.mv&&SU.mv.akey==='z'){if(q.v==null)return bad('Type a height in mm');const m=SU.mv;m.dz=q.v;m.z0.forEach(([id,z])=>{const o=byId(id);if(o&&o.t==='item')o.z=Math.max(0,z+q.v)||undefined});suMoveCommit();return}
  if(SU.mv){if(q.v==null)return bad('Type a distance in mm');const d=SU.mv.d,L=Math.hypot(d[0],d[1]);if(!L)return bad('Move the pointer the way to go, then type the distance');suMoveApply([d[0]/L*q.v,d[1]/L*q.v]);suMoveCommit();return}
  if(SU.arc&&SU.arc.b){if(q.v==null)return bad('Type how far the arc bows, in mm');const A=SU.arc;SU.arc=null;checkpoint();const w=suArcWall(A.a,A.b,suArcSign(A.a,A.b,SU.cur||A.b,Math.abs(q.v)));S.objs.push(w);sel=new Set([w.id]);markDirty();clashDirty=true;render();renderInspector();updateHint();return}
  if(SU.cir){if(q.sides){SU.cir.n=q.sides;P['su'+SU.cir.k+'N']=q.sides;savePrefs();drawOverlay();updateHint();vcbSync();return}if(!SU.cir.c){SU.cir=null;return bad('Click the centre first, then type the radius · 12s sets 12 sides')}if(q.v==null||q.v<=0)return bad('Type a radius in mm, or 12s for 12 sides');SU.cir.r=q.v;suCirFinish();return}
  if(SU.rr&&SU.rr.stage===2){if(q.v==null)return bad('Type the depth in mm');const sg=SU.rr.d<0?-1:1;SU.rr.d=sg*Math.abs(q.v);const r=SU.rr;SU.rr=null;SU.lastShape={k:'rr'};suRoomAdd(suRRPts(r.a,r.b,r.d),'Room');return}
  if(suLastOK()&&SU.last.kind==='shape'){const L=SU.last,sh=L.shape,o=byId(L.ids[0]);if(!o)return bad('Nothing to change');let pts=null;if(sh.k==='circle'||sh.k==='poly'){if(q.sides)sh.n=q.sides;else if(q.v>0)sh.r=q.v;else return bad('Type a radius or 12s');pts=suCirPts(sh.c,sh.r,sh.n,sh.a0)}else return bad('Nothing to change');if(!(past.length===L.pl&&!future.length))checkpoint();o.pts=pts;L.sig=suSig();L.pl=past.length;markDirty();clashDirty=true;render();updateHint();return}
  if(SU.sc){if(q.v==null||q.v<=0)return bad('Type a scale factor, e.g. 1.5 or 0.5');suScaleApply(q.v);suScaleCommit();return}
  if(suLastOK()&&SU.last.kind==='sc'){if(q.v==null||q.v<=0)return bad('Type a scale factor');const L=SU.last;if(!(past.length===L.pl&&!future.length))checkpoint();SU.sc=L.st;suScaleApply(q.v);SU.sc=null;L.f=q.v;L.sig=suSig();L.pl=past.length;markDirty();clashDirty=true;render();renderInspector();updateHint();return}
  if(SU.tp){if(q.v==null)return bad('Type a distance in mm');const sg=SU.tp.d<0?-1:1;SU.tp.d=sg*Math.abs(q.v)*(q.v<0?-1:1);suTapeCommit();return}
  if(suLastOK()&&SU.last.kind==='tp'){if(q.v==null)return bad('Type a distance in mm');const L=SU.last,g=S.guides[S.guides.length-1];if(!g)return bad('Nothing to change');if(!(past.length===L.pl&&!future.length))checkpoint();const sg=L.d<0?-1:1,d=sg*Math.abs(q.v)*(q.v<0?-1:1);const ng=suGuideAt(L.base,d);g.a=ng.a;g.b=ng.b;L.d=d;L.sig=suSig();L.pl=past.length;markDirty();render();updateHint();return}
  if(SU.of){if(q.v==null)return bad('Type a distance in mm');const sg=SU.of.d<0?-1:1;suOffPreview(sg*Math.abs(q.v)*(q.v<0?-1:1));suOffCommit();return}
  if(suLastOK()&&SU.last.kind==='off'){if(q.v==null)return bad('Type a distance in mm');const L=SU.last,sg=L.d<0?-1:1,d=sg*Math.abs(q.v)*(q.v<0?-1:1),pts=suOffsetPts(L.src,d,L.closed);if(!pts)return bad('That distance folds the outline over itself');if(!(past.length===L.pl&&!future.length))checkpoint();const o=byId(L.ids[0]);if(o)o.pts=pts;L.d=d;L.sig=suSig();L.pl=past.length;markDirty();clashDirty=true;render();renderInspector();updateHint();vcbSync();return}
  if(SU.pp){if(q.v==null)return bad('Type a height in mm');suPPSet(q.v);suPPCommit();return}
  if(suLastOK()&&SU.last.kind==='pp'){if(q.v==null)return bad('Type a height in mm');const L=SU.last;if(!(past.length===L.pl&&!future.length))checkpoint();L.t.set(q.v);L.v=L.t.get();L.sig=suSig();L.pl=past.length;suPPAfter();return}
  if(SU.rt&&SU.rt.stage===2){if(q.v==null)return bad('Type an angle in degrees');if(Math.abs(q.v)>360)return bad('Type an angle between -360 and 360');suRotApply(q.v);suRotCommit();return}
  if(suLastOK()){const L=SU.last;
    if(q.n!=null){if(!L.copy)return bad('Hold Ctrl while moving or rotating to make a copy, then type x5');suRedoLast({n:q.n,div:q.div});toast(`${q.n} ${q.n===1?'copy':'copies'}${q.div?' spread over the distance':''}`);return}
    if(q.v!=null){if(L.kind==='move'){const l=Math.hypot(L.d[0],L.d[1])/(L.div?1:1);if(!l)return bad('Nothing to change');suRedoLast({d:[L.d[0]/l*q.v,L.d[1]/l*q.v]})}else{if(Math.abs(q.v)>360)return bad('Type an angle between -360 and 360');suRedoLast({deg:q.v})}return}}
  bad('Nothing to apply that to. Start a move, a turn or a rectangle first')}
function vcbLabel(){if(SU.arc)return SU.arc.b?'Bulge':'Length';if(SU.cir)return SU.cir.c?'Radius':'Sides';if(SU.rr)return SU.rr.stage===2?'Depth':'Length';if(SU.sc||(SU.last&&SU.last.kind==='sc'&&tool==='su-scale'))return'Scale';if(SU.tp||(SU.last&&SU.last.kind==='tp'&&tool==='su-tape'))return'Distance';if(SU.of||(SU.last&&SU.last.kind==='off'&&tool==='su-offset'))return'Distance';if(SU.pp||(SU.last&&SU.last.kind==='pp'&&tool==='su-push'))return(SU.pp||SU.last).t.label;if(SU.rect)return'Dimensions';if(SU.mv)return'Distance';if(SU.rt)return SU.rt.stage===2?'Angle':'Angle';if(SU.last&&SU.last.copy&&(SU.last.kind==='move'||SU.last.kind==='rot'))return SU.last.kind==='move'?'Distance · copies':'Angle · copies';if(SU.last&&(SU.last.kind==='move'||SU.last.kind==='rot'))return SU.last.kind==='move'?'Distance':'Angle';if(tool==='poly'||tool==='spline')return'Length';if(tool==='room'||tool==='shape-rect')return'Dimensions';return'Position'}
function vcbValue(){if(SU.typed)return SU.typed;if(SU.mv&&SU.mv.akey==='z')return'↑ '+fmt(SU.mv.dz||0);if(SU.cir)return SU.cir.c?fmt(SU.cir.r)+' · '+SU.cir.n+' sides':SU.cir.n+'';if(SU.rr)return SU.rr.stage===2?fmt(Math.abs(SU.rr.d)):SU.rr.b?fmt(Math.hypot(SU.rr.b[0]-SU.rr.a[0],SU.rr.b[1]-SU.rr.a[1])):'';if(SU.sc)return (+SU.sc.f.toFixed(3))+'';if(SU.last&&SU.last.kind==='sc'&&tool==='su-scale')return (+SU.last.f.toFixed(3))+'';if(SU.tp)return fmt(Math.abs(SU.tp.d));if(SU.last&&SU.last.kind==='tp'&&tool==='su-tape')return fmt(Math.abs(SU.last.d));if(SU.of)return fmt(Math.abs(SU.of.d));if(SU.last&&SU.last.kind==='off'&&tool==='su-offset')return fmt(Math.abs(SU.last.d));if(SU.pp)return fmt(SU.pp.t.get());if(SU.last&&SU.last.kind==='pp'&&tool==='su-push')return fmt(SU.last.t.get());if(SU.rect&&SU.cur)return fmt(Math.abs(SU.cur[0]-SU.rect.a[0]))+', '+fmt(Math.abs(SU.cur[1]-SU.rect.a[1]));if(SU.mv)return fmt(Math.hypot(SU.mv.d[0],SU.mv.d[1]));if(SU.rt)return SU.rt.stage===2?(+SU.rt.deg.toFixed(1))+'°':'';
  if(SU.last&&(SU.last.kind==='move'||SU.last.kind==='rot')){const L=SU.last,base=L.kind==='move'?fmt(Math.hypot(L.d[0],L.d[1])):(+L.deg.toFixed(1))+'°';return base+(L.copy&&L.n>1?(L.div?' /':' x')+L.n:'')}if((tool==='poly'||tool==='spline')&&typed)return typed;return($('#coords')||{}).textContent||''}
let vcbEl=null;
function vcbSync(){if(!vcbEl){vcbEl=document.createElement('div');vcbEl.id='vcb';vcbEl.setAttribute('aria-live','polite');vcbEl.innerHTML='<span class="l"></span><span class="v"></span>';const m=$('#main');if(!m)return;m.appendChild(vcbEl)}
  document.documentElement.classList.toggle('su-on',suOn());vcbEl.hidden=!suOn()||(is3D&&!['su-push','su-move','su-rotate'].includes(tool))||WALK.on||bldView;if(vcbEl.hidden)return;vcbEl.querySelector('.l').textContent=vcbLabel();vcbEl.querySelector('.v').textContent=vcbValue()||' ';vcbEl.classList.toggle('typing',!!SU.typed);try{dockClear()}catch(e){}}

/* ---- drawing on the plan ---- */
function suSVG(){/* runs as the plan's overlay is drawn, after the objects: fade what is outside an open group, keep the scenes bar current */try{suFade();const sg=(S.scenes||[]).map(c=>c.name).join('|')+suOn()+WALK.on+bldView;if(sg!==suBarSig){suBarSig=sg;suScenesBar()}}catch(e){}
  if(!suOn()&&!(S.guides&&S.guides.length))return'';let s='';const st=(c,dash)=>`stroke="${c}" stroke-width="1.6" vector-effect="non-scaling-stroke" fill="none"${dash?' stroke-dasharray="6 4"':''}`;
  const tag=(x,y,t)=>`<text class="dimtx" font-size="${fs(12)}" stroke-width="${fs(3)}" x="${x}" y="${y}" text-anchor="middle">${esc(t)}</text>`;
  if(SU.mv){const m=SU.mv,b=m.base,e=[b[0]+m.d[0],b[1]+m.d[1]],ax=suAxis(m.d);s+=`<line x1="${b[0]}" y1="${b[1]}" x2="${e[0]}" y2="${e[1]}" ${st(SU_COL[ax],!ax)}/><circle cx="${b[0]}" cy="${b[1]}" r="${fs(4)}" fill="${SU_COL[ax]}"/><circle cx="${e[0]}" cy="${e[1]}" r="${fs(4)}" fill="none" stroke="${SU_COL[ax]}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
    if(m.d[0]||m.d[1])s+=tag((b[0]+e[0])/2,(b[1]+e[1])/2-fs(10),fmt(Math.hypot(m.d[0],m.d[1]))+(ax?ax==='x'?' · on red axis':' · on green axis':''))}
  if(SU.rt){const r=SU.rt,c=r.c,R=fs(60),cur=SU.cur||c;s+=`<circle cx="${c[0]}" cy="${c[1]}" r="${R}" ${st('#3a6fd8',true)}/><circle cx="${c[0]}" cy="${c[1]}" r="${fs(3.5)}" fill="#3a6fd8"/>`;
    if(r.stage===1){s+=`<line x1="${c[0]}" y1="${c[1]}" x2="${cur[0]}" y2="${cur[1]}" ${st('#3a6fd8',true)}/>`}
    else{const a0=r.a0,a1=a0+r.deg*Math.PI/180,p=a=>[c[0]+Math.cos(a)*R*1.6,c[1]+Math.sin(a)*R*1.6],q0=p(a0),q1=p(a1),A=a=>[c[0]+Math.cos(a)*R,c[1]+Math.sin(a)*R],s0=A(a0),s1=A(a1);
      s+=`<line x1="${c[0]}" y1="${c[1]}" x2="${q0[0]}" y2="${q0[1]}" ${st('#3a6fd8',true)}/><line x1="${c[0]}" y1="${c[1]}" x2="${q1[0]}" y2="${q1[1]}" ${st('#3a6fd8')}/>`;
      if(r.deg)s+=`<path d="M${s0[0]} ${s0[1]}A${R} ${R} 0 ${Math.abs(r.deg)>180?1:0} ${r.deg>0?1:0} ${s1[0]} ${s1[1]}" ${st('#3a6fd8')}/>`;
      const mid=a0+r.deg*Math.PI/360;s+=tag(c[0]+Math.cos(mid)*R*1.35,c[1]+Math.sin(mid)*R*1.35+fs(4),(+r.deg.toFixed(1))+'°')}}
  if(SU.rect&&SU.cur){const a=SU.rect.a,b=SU.cur,x0=Math.min(a[0],b[0]),y0=Math.min(a[1],b[1]),w=Math.abs(b[0]-a[0]),h=Math.abs(b[1]-a[1]);s+=`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" ${st('var(--accent)',true)}/><circle cx="${a[0]}" cy="${a[1]}" r="${fs(4)}" fill="var(--accent)"/>`;if(w&&h)s+=tag(x0+w/2,y0-fs(8),fmt(w)+' × '+fmt(h))}
  if(S.guides&&S.guides.length){const ext=1e7;S.guides.forEach(g=>{const dx=g.b[0]-g.a[0],dy=g.b[1]-g.a[1],L=Math.hypot(dx,dy)||1,ux=dx/L*ext,uy=dy/L*ext;s+=`<line class="suguide" x1="${g.a[0]-ux}" y1="${g.a[1]-uy}" x2="${g.a[0]+ux}" y2="${g.a[1]+uy}"/>`})}
  if(SU.tp&&SU.tp.d){const g=suGuideAt(SU.tp.base,SU.tp.d),dx=g.b[0]-g.a[0],dy=g.b[1]-g.a[1],L=Math.hypot(dx,dy)||1,ext=1e7;s+=`<line class="suguide" style="stroke:var(--accent)" x1="${g.a[0]-dx/L*ext}" y1="${g.a[1]-dy/L*ext}" x2="${g.a[0]+dx/L*ext}" y2="${g.a[1]+dy/L*ext}"/>`+tag(SU.cur?SU.cur[0]:g.a[0],(SU.cur?SU.cur[1]:g.a[1])-fs(12),fmt(Math.abs(SU.tp.d)))}
  if(SU.sc){const c=SU.sc.c;s+=`<circle cx="${c[0]}" cy="${c[1]}" r="${fs(4)}" fill="var(--accent)"/>`;if(SU.cur)s+=`<line x1="${c[0]}" y1="${c[1]}" x2="${SU.cur[0]}" y2="${SU.cur[1]}" ${st('var(--accent)',true)}/>`+tag(SU.cur[0],SU.cur[1]-fs(12),'× '+(+SU.sc.f.toFixed(3)))}
  if(SU.arc){const A=SU.arc;if(!A.b)s+=`<line x1="${A.a[0]}" y1="${A.a[1]}" x2="${A.e[0]}" y2="${A.e[1]}" ${st('var(--accent)',true)}/>`;else{try{const q=wallPathPts(suArcWall(A.a,A.b,A.h));s+=`<path d="M${q.map(p=>p.join(' ')).join('L')}" ${st('var(--accent)',true)}/>`}catch(e){}}}
  if(SU.cir&&SU.cir.c&&SU.cir.r){const q=suCirPts(SU.cir.c,SU.cir.r,SU.cir.n,SU.cir.a0);s+=`<path d="M${q.map(p=>p.join(' ')).join('L')}Z" ${st('var(--accent)',true)}/><circle cx="${SU.cir.c[0]}" cy="${SU.cir.c[1]}" r="${fs(3)}" fill="var(--accent)"/>`+tag(SU.cir.c[0],SU.cir.c[1]-fs(10),'r '+fmt(SU.cir.r))}
  if(SU.rr&&SU.rr.b){const r=SU.rr;if(r.stage===1)s+=`<line x1="${r.a[0]}" y1="${r.a[1]}" x2="${r.b[0]}" y2="${r.b[1]}" ${st('var(--accent)',true)}/>`;else{const q=suRRPts(r.a,r.b,r.d);s+=`<path d="M${q.map(p=>p.join(' ')).join('L')}Z" ${st('var(--accent)',true)}/>`}}
  if(SU.of&&SU.of.pts){const q=SU.of.pts;s+=`<path d="M${q.map(p=>p.join(' ')).join('L')}${SU.of.closed?'Z':''}" ${st('var(--accent)',true)}/>`;const c=SU.cur||q[0];s+=tag(c[0],c[1]-fs(14),fmt(Math.abs(SU.of.d))+(SU.of.d<0?' in':' out'))}
  if(SU.zw){const a=SU.zw.a,b=SU.zw.b;s+=`<rect x="${Math.min(a[0],b[0])}" y="${Math.min(a[1],b[1])}" width="${Math.abs(b[0]-a[0])}" height="${Math.abs(b[1]-a[1])}" ${st('var(--accent)',true)}/>`}
  if(SU.er)SU.er.ids.forEach(id=>{const o=byId(id);if(!o)return;const b=objBox(o);s+=`<rect x="${b.x0}" y="${b.y0}" width="${b.x1-b.x0}" height="${b.y1-b.y0}" ${st('#d6332e')}/>`});
  return s+(SU.g||'')}

/* ---- pointer: these tools run ahead of the plan's own pointer handling ---- */
svg.addEventListener('pointerdown',ev=>{
  const rectTool=(tool==='room'||tool==='shape-rect')&&SU.rect;if((SU_TOOLS.indexOf(tool)<0||tool==='su-push')&&!rectTool)return;
  if(ev.button!==0||spaceDown)return;if(ev.pointerType==='touch'){const now=performance.now();pointers.forEach((p,id)=>{if(id!==ev.pointerId&&now-(p[2]||0)>3000)pointers.delete(id)});if(pointers.size>0){/* a second finger is a view gesture (pinch or pan), never a second click */SU.downAt=null;if(SU.er){SU.er=null;drawOverlay()}return}pointers.set(ev.pointerId,[ev.clientX,ev.clientY,now])}
  ev.stopImmediatePropagation();ev.preventDefault();closePops();const w=pointerWorld(ev);SU.cur=w;SU.downAt=[ev.clientX,ev.clientY];
  if(rectTool){const b=pointSnap(w,{alt:ev.altKey}).p;const a=SU.rect.a;SU.rect=null;rectFinish(a,b);return}
  if(tool==='su-move'){if(SU.mv){suMoveCommit();SU.downAt=null;return}const l=suTargets(ev);if(!l){toast('Click the object to move, or select first');return}suMoveStart(l,pointSnap(w,{alt:ev.altKey,ids:new Set(l.concat(carried(l)).map(o=>o.id))}).p);return}
  if(tool==='su-rotate'){if(!SU.rt){const l=suTargets(ev);if(!l){toast('Select what to rotate first, or click it');return}suRotStart(l,pointSnap(w,{alt:ev.altKey}).p);return}
    if(SU.rt.stage===1){suRotRef(pointSnap(w,{alt:ev.altKey}).p);return}suRotCommit();SU.downAt=null;return}
  if(tool==='su-erase'){SU.er={ids:[]};try{svg.setPointerCapture(ev.pointerId)}catch(e){}suEraseAt(ev);return}
  if(tool==='su-zwin'){if(SU.zw){suZoomWinEnd(w);return}SU.zw={a:w,b:w};return}
  if(tool==='su-arc'){const p=pointSnap(w,{alt:ev.altKey}).p;if(!SU.arc){SU.arc={a:p,b:null,h:0,e:p};updateHint();return}if(!SU.arc.b){if(Math.hypot(p[0]-SU.arc.a[0],p[1]-SU.arc.a[1])<100)return;SU.arc.b=p;updateHint();return}const A=SU.arc;SU.arc=null;checkpoint();const wl=suArcWall(A.a,A.b,A.h);S.objs.push(wl);sel=new Set([wl.id]);markDirty();clashDirty=true;render();renderInspector();updateHint();return}
  if(tool==='su-circle'||tool==='su-polygon'){const p=pointSnap(w,{alt:ev.altKey}).p;if(SU.cir&&SU.cir.c){suCirFinish();SU.downAt=null;return}const k=tool==='su-circle'?'circle':'poly';SU.cir={k,c:p,r:0,n:(SU.cir&&SU.cir.n)||+P['su'+k+'N']||(k==='circle'?24:6),a0:0};SU.typed='';updateHint();return}
  if(tool==='su-rrect'){const p=pointSnap(w,{alt:ev.altKey}).p;if(!SU.rr){SU.rr={a:p,b:null,stage:1,d:0};updateHint();return}if(SU.rr.stage===1){if(!SU.rr.b||Math.hypot(SU.rr.b[0]-SU.rr.a[0],SU.rr.b[1]-SU.rr.a[1])<100)return;SU.rr.stage=2;updateHint();return}const r=SU.rr;SU.rr=null;SU.lastShape={k:'rr'};suRoomAdd(suRRPts(r.a,r.b,r.d),'Room');return}
  if(tool==='su-scale'){if(SU.sc){suScaleCommit();SU.downAt=null;return}const l=suTargets(ev);if(!l){toast('Select what to scale, or click it');return}suScaleStart(l,w);return}
  if(tool==='su-tape'){if(SU.tp){suTapeCommit();SU.downAt=null;return}suTapeStart(w);return}
  if(tool==='su-offset'){if(SU.of){suOffCommit();return}const el=ev.target.closest&&ev.target.closest('[data-id]');suOffStart(el?byId(el.dataset.id):null);return}
},true);
function suEraseAt(ev){const el=document.elementFromPoint(ev.clientX,ev.clientY);const h=el&&el.closest&&el.closest('[data-id]');const o=h?byId(h.dataset.id):null;if(!o||fixed(o)||SU.er.ids.includes(o.id))return;SU.er.ids.push(o.id);drawOverlay()}
svg.addEventListener('pointermove',ev=>{if(vcbEl&&!vcbEl.hidden&&!suBusy()&&!SU.typed&&!SU.last)requestAnimationFrame(()=>{if(vcbEl&&!suBusy()&&!SU.last&&!SU.typed)vcbEl.querySelector('.v').textContent=($('#coords')||{}).textContent||''});if(!SU_TOOLS.includes(tool)&&!SU.rect)return;if(ev.pointerType==='touch'&&pointers.size>1)return;const w=toWorld(ev);SU.cur=w;
  if(SU.er){suEraseAt(ev);return}
  if(SU.zw){SU.zw.b=w;drawOverlay();return}
  if(SU.of){suOffPreview(suOffDist(w));vcbSync();return}
  if(SU.arc){const p=pointSnap(w,{alt:ev.altKey}).p;if(!SU.arc.b)SU.arc.e=p;else{const[a,b]=[SU.arc.a,SU.arc.b],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;const d=Math.abs(((p[0]-a[0])*-dy+(p[1]-a[1])*dx)/L);SU.arc.h=suArcSign(a,b,p,Math.round(Math.min(d,L/2)/10)*10)}drawOverlay();vcbSync();updateHint();return}
  if(SU.cir&&SU.cir.c){const p=pointSnap(w,{alt:ev.altKey}).p;SU.cir.r=Math.round(Math.hypot(p[0]-SU.cir.c[0],p[1]-SU.cir.c[1]));SU.cir.a0=Math.atan2(p[1]-SU.cir.c[1],p[0]-SU.cir.c[0]);drawOverlay();vcbSync();updateHint();return}
  if(SU.rr){const p=pointSnap(w,{alt:ev.altKey}).p;if(SU.rr.stage===1)SU.rr.b=p;else{const[a,b]=[SU.rr.a,SU.rr.b],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;SU.rr.d=Math.round(((p[0]-a[0])*-dy+(p[1]-a[1])*dx)/L/10)*10}drawOverlay();vcbSync();return}
  if(SU.sc){const c=SU.sc.c,d=Math.hypot(w[0]-c[0],w[1]-c[1]);let f=d/SU.sc.r0;f=ev.altKey?Math.round(f*1000)/1000:Math.max(0.05,Math.round(f*20)/20);suScaleApply(f);vcbSync();return}
  if(SU.tp){SU.tp.d=suTapeDist(w);drawOverlay();vcbSync();updateHint();return}
  if(SU.mv){const ex=new Set(SU.mv.orig.map(x=>x[0]).concat(SU.mv.copies.map(c=>c[0].id)));const sn=pointSnap(w,{alt:ev.altKey,ids:ex});SU.mv.raw=[sn.p[0]-SU.mv.base[0],sn.p[1]-SU.mv.base[1]];SU.g=sn.g;suMoveTo(SU.mv.raw,ev.shiftKey);vcbSync();return}
  if(SU.rt){if(SU.rt.stage===2)suRotApply(suRotAngle(w,ev.altKey));else drawOverlay();vcbSync();return}
  if(SU.rect){SU.cur=pointSnap(w,{alt:ev.altKey}).p;vcbSync()}
},true);
svg.addEventListener('pointerup',ev=>{if(SU.zw&&SU.downAt&&Math.hypot(ev.clientX-SU.downAt[0],ev.clientY-SU.downAt[1])>8){suZoomWinEnd(toWorld(ev));SU.downAt=null;return}if(SU.er){const ids=SU.er.ids;SU.er=null;if(ids.length){sel=new Set(ids);deleteSel(false);toast(ids.length===1?'Erased':`Erased ${ids.length}`)}else render();return}
  /* press, drag, release also works: the release puts it down */
  if(SU.downAt&&Math.hypot(ev.clientX-SU.downAt[0],ev.clientY-SU.downAt[1])>8){if(SU.sc)suScaleCommit();else if(SU.tp)suTapeCommit();else if(SU.mv)suMoveCommit();else if(SU.rt&&SU.rt.stage===2)suRotCommit()}SU.downAt=null},true);

/* ---- keys ---- */
function suKey(e,k,mod){
  if(e.key==='Control'&&!e.repeat&&(SU.mv||(SU.rt&&SU.rt.stage===2))){e.preventDefault();suCopyToggle();return true}
  if(mod)return false;
  if(e.key==='Escape'&&SU.gctx&&!SU.typed&&!suBusy()){e.preventDefault();suGroupLeave();return true}
  if(SU.mv&&/^Arrow/.test(e.key)){e.preventDefault();const m=SU.mv;if(e.key==='ArrowRight')m.akey=m.akey==='x'?null:'x';else if(e.key==='ArrowLeft')m.akey=m.akey==='y'?null:'y';else if(e.key==='ArrowUp'&&!is3D)toast('Blue axis is height: use Move in 3D');else if(e.key==='ArrowUp'&&is3D){m.akey=m.akey==='z'?null:'z';if(m.akey==='z'){m.d=[0,0];suMoveApply([0,0])}else m.z0.forEach(([id,z])=>{const o=byId(id);if(o){if(z)o.z=z;else delete o.z}});toast(m.akey==='z'?'Blue axis: move up or down to lift':'Blue axis off');updateHint();return true}else toast('Parallel lock comes with the full snap hints');if(m.raw)suMoveTo(m.raw,e.shiftKey);updateHint();return true}
  if(e.key==='F8'&&suOn()){e.preventDefault();suPrevView();return true}
  if((tool==='su-circle'||tool==='su-polygon')&&!SU.cir&&/^[0-9]$/.test(e.key)&&!suLastOK())SU.cir={k:tool==='su-circle'?'circle':'poly',c:null,r:0,n:+P['su'+(tool==='su-circle'?'circle':'poly')+'N']||(tool==='su-circle'?24:6),a0:0};
  const live=suBusy()||suLastOK()||(SU.rect&&(tool==='room'||tool==='shape-rect'));
  if(live&&!SU.er){
    if(/^[0-9.,;]$/.test(e.key)||((e.key==='s'||e.key==='S')&&/^\d+$/.test(SU.typed)&&(tool==='su-circle'||tool==='su-polygon'))||(e.key==='-'&&!SU.typed)||((e.key==='x'||e.key==='X'||e.key==='*'||e.key==='/')&&!SU.typed&&!SU.rect)){SU.typed+=e.key;updateHint();vcbSync();e.preventDefault();return true}
    if(SU.typed&&e.key==='Backspace'){SU.typed=SU.typed.slice(0,-1);updateHint();vcbSync();e.preventDefault();return true}
    if(SU.typed&&e.key==='Enter'){e.preventDefault();suApplyTyped();vcbSync();return true}
    if(e.key==='Escape'&&SU.arc&&!SU.typed){e.preventDefault();SU.arc=null;render();updateHint();return true}
  if(e.key==='Escape'&&(SU.cir||SU.rr)&&!SU.typed){/* a circle with no centre yet is only a typed number of sides: Esc drops it and goes on to leave the tool */const ph=!SU.rr&&SU.cir&&!SU.cir.c;SU.cir=null;SU.rr=null;render();updateHint();if(ph)return false;e.preventDefault();return true}
  if(e.key==='Escape'){e.preventDefault();if(SU.typed){SU.typed=''}else if(SU.sc)suScaleCancel();else if(SU.tp){SU.tp=null;render()}else if(SU.of){SU.of=null;render()}else if(SU.pp)suPPCancel();else if(SU.mv)suMoveCancel();else if(SU.rt)suRotCancel();else if(SU.rect){SU.rect=null;render()}else{SU.last=null;updateHint();vcbSync();return false}updateHint();vcbSync();return true}}
  if(!suOn()||e.altKey)return false;
  if(tool==='place'&&(k==='r'||k==='x'))return false;
  /* SketchUp's default keys. StoreyBook's own keys that do not clash keep working */
  const map={l:'poly',r:'room',m:'su-move',q:'su-rotate',e:'su-erase',t:'su-tape',b:'paint',h:'pan',f:'su-offset',s:'su-scale',c:'su-circle',a:'su-arc'};
  if(map[k]&&!e.shiftKey){setTool(map[k]);return true}
  if(k==='o'&&!e.shiftKey){if(!is3D)set3D(true);toast('Orbit: drag in the 3D view · Tab goes back to the plan');return true}
  if(k==='p'&&!e.shiftKey){setTool('su-push');return true}
  if(k==='z'&&e.shiftKey){if(is3D)frame3D('persp');else fit();return true}
  if(k==='g'&&!e.shiftKey){suCompMake();return true}
  if(k==='k'&&!e.shiftKey){$('#t-lib').click();return true}
  return false}

/* ---- the welcome card and cheat sheet ---- */
const SU_SHEET=[['Select','Space','Space (tap)','select'],['Line','L','L · walls','poly'],['Rectangle','R','R · room, click two corners or type 4000,3000','room'],['Move','M','M · Ctrl copies, then x5','su-move'],['Rotate','Q','Q · protractor, type an angle','su-rotate'],['Eraser','E','E · click or drag across','su-erase'],['Tape measure','T','T · click an edge and pull out a guide line; type the distance','su-tape'],['Dimension','','Measure button in the toolbar','measure'],['Scale','S','S · click the selection, pull, type a factor such as 1.5','su-scale'],['Search','','Ctrl+K (S is Scale with SketchUp keys)',''],['Paint bucket','B','B · search Materials for named colours','paint'],['Styles','','search Style: shaded, hidden line, sketchy edges',''],['Pan','H','H, or hold Space and drag','pan'],['Orbit','O','O opens 3D','3d'],['Arc','A','A · click both ends, then how far it bows; type the bulge; makes a curved wall','su-arc'],['Circle','C','C · round room: click the centre, then the radius, or type it; type 12s for 12 sides','su-circle'],['Polygon','','Search Polygon · type 6s for six sides','su-polygon'],['Rotated rectangle','','Search Rotated rectangle · two clicks for one side, then the depth','su-rrect'],['Ceiling plan','','search Ceiling (C is Circle with SketchUp keys)',''],['Offset','F','F · room outline or wall in or out, type a distance','su-offset'],['Zoom extents','Shift+Z','Shift+Z','fit'],['Make component','G','G · copies share one definition; double-click a copy to edit them all','comp'],['Make group','','right-click › Make group','group'],['Outliner','','search Outliner · components, groups and rooms; Purge unused',''],['Push/Pull','P','P · item height; wall or floor sets floor to ceiling; type a value','su-push'],['Components','','Library: K, or the Library button','lib']];
function suSheetOpen(first){let m=$('#su-modal');if(!m){m=document.createElement('div');m.id='su-modal';m.className='keys-modal';m.hidden=true;m.setAttribute('data-keep','');m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','su-h');document.body.appendChild(m);
    m.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.su==='x'){m.hidden=true;return}if(b.dataset.su==='tut'){P.suWelcome=1;savePrefs();m.hidden=true;tutOpen();return}if(b.dataset.su==='on'||b.dataset.su==='off'){P.suKeys=b.dataset.su==='on';P.suWelcome=1;savePrefs();suTips();m.hidden=true;toast(P.suKeys?'SketchUp keys on':'StoreyBook keys');updateHint();vcbSync()}})}
  m.innerHTML=`<div class="keys-card" style="height:auto;max-width:560px"><div class="keys-head"><h3 id="su-h">${first?'Coming from SketchUp?':'SketchUp keys and tools'}</h3><span style="flex:1"></span><button class="btn icon ghost sm" type="button" data-su="x" aria-label="Close">✕</button></div><div style="padding:14px 16px;max-height:60vh;overflow:auto">
    <p class="muted" style="margin:0 0 8px">The tools work the way SketchUp's do: click to pick up, click to put down, and type a value straight after into the Measurements box at the bottom right. Rooms and walls are still StoreyBook objects, so the MIG, PSM, fire and cost checks keep working.</p>
    <table class="kv-t" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:4px">SketchUp</th><th style="text-align:left;padding:4px">Key</th><th style="text-align:left;padding:4px">In StoreyBook</th></tr></thead><tbody>${SU_SHEET.map(r=>`<tr><td style="padding:4px;border-top:1px solid var(--line)">${r[0]}</td><td style="padding:4px;border-top:1px solid var(--line)"><kbd>${r[1]||'–'}</kbd></td><td style="padding:4px;border-top:1px solid var(--line)">${esc(r[2])}</td></tr>`).join('')}</tbody></table>
    <p class="muted" style="margin:8px 0 0">Red and green lines show you are on an axis. Shift locks it. Alt turns snapping off. Search (S) still finds every command.</p></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;padding:0 16px 14px"><button class="btn ghost" type="button" data-su="tut">Take the tutorial</button><span style="flex:1"></span><button class="btn" type="button" data-su="off">${P.suKeys===false?'Keep StoreyBook keys':'Use StoreyBook keys'}</button><button class="btn primary" type="button" data-su="on">Use SketchUp keys</button></div></div>`;
  m.hidden=false;if(first&&!P.suWelcome){P.suWelcome=1;savePrefs()}setTimeout(()=>{const b=m.querySelector('[data-su=on]');if(b)b.focus()},0)}
/* dock buttons say what they are in SketchUp */
function suTips(){suNames();try{suScenesBar()}catch(e){}{const sl=$('#s-keys');if(sl)sl.value=suOn()?'su':'sb'}const nm={select:'Select (SketchUp: Space)',poly:'Walls (SketchUp: Line, L)',room:'Room (SketchUp: Rectangle, R)',measure:'Measure (SketchUp: Tape measure, T)',paint:'Paint (SketchUp: Paint bucket, B)',pan:'Pan (SketchUp: H)'};
  $$('.dock [data-tool]').forEach(b=>{if(!b.dataset.t0)b.dataset.t0=b.getAttribute('title')||'';const t=suOn()&&nm[b.dataset.tool];b.setAttribute('title',t||b.dataset.t0)})}
/* the three SketchUp tools that StoreyBook did not have get dock buttons after Select */
(()=>{const d=$('.dock [data-tool="select"]');if(!d)return;const ic={'su-move':'<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>','su-rotate':'<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/>','su-erase':'<path d="M4 16l8-8 6 6-6 6H8z"/><path d="M14 20h6"/>'};
  const lab={'su-move':'Move (SketchUp: M)','su-rotate':'Rotate (SketchUp: Q)','su-erase':'Eraser (SketchUp: E)'};let at=d;
  ic['su-push']='<path d="M5 20h14"/><path d="M7 16V9h10v7"/><path d="M12 3v8M9 6l3-3 3 3"/>';lab['su-push']='Push/Pull (SketchUp: P)';
  ['su-move','su-rotate','su-erase','su-push'].forEach(t=>{const b=document.createElement('button');b.type='button';b.className=d.className.replace(/\bon\b/,'').trim();b.dataset.tool=t;b.setAttribute('title',lab[t]);b.setAttribute('aria-label',lab[t]);b.innerHTML=`<svg class="ic" viewBox="0 0 24 24">${ic[t]}</svg>${{'su-move':'Move','su-rotate':'Rotate','su-erase':'Eraser','su-push':'Push/Pull'}[t]}`;b.addEventListener('click',()=>setTool(t));at.after(b);at=b})})();
(()=>{const st=document.createElement('style');st.textContent=`#vcb{position:absolute;right:max(12px,env(safe-area-inset-right,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9;display:flex;gap:8px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:5px 10px;font-size:12px;min-width:170px;max-width:240px;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.12)}.su-on .coords{visibility:hidden}#vcb[hidden]{display:none}#vcb .l{color:var(--muted)}#vcb .v{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:500}#vcb.typing{border-color:var(--accent)}#vcb.typing .v{color:var(--accent)}.coords{pointer-events:none}/* iPad split view and small tablets held upright: the header wraps to a third row there, so sheets are capped lower to leave 45% of the screen for the plan */@media (min-width:481px) and (max-width:820px) and (orientation:portrait){#main .drawer,#main .psheet{max-height:max(130px,calc(55vh - 262px))!important}}@media (pointer:coarse),(max-width:820px){#vcb{display:none}}`;document.head.appendChild(st)})();
setTimeout(()=>{suTips();vcbSync();if(!location.hash.endsWith('-debug')&&!P.suWelcome)suSheetOpen(true)},600);

/* ---- test 2: selection rules, flip, zoom window, previous view, hide and isolate, SketchUp names ---- */
/* Ctrl adds, Shift adds or removes, Ctrl+Shift removes (StoreyBook keys: Shift or Ctrl add or remove) */
function suSelMode(ev){if(multiMode||!suOn())return'tog';const c=ev.ctrlKey||ev.metaKey,sh=ev.shiftKey;return c&&sh?'sub':c?'add':'tog'}
function suPushView(){const v={x:V.x,y:V.y,k:V.k},l=SU.views[SU.views.length-1];if(l&&l.x===v.x&&l.y===v.y&&l.k===v.k)return;SU.views.push(v);if(SU.views.length>30)SU.views.shift()}
function suPrevView(){if(is3D)return toast('Previous view works on the plan');const v=SU.views.pop();if(!v)return toast('No earlier view');V.x=v.x;V.y=v.y;V.k=v.k;applyView();render()}
function suZoomWinEnd(w){const a=SU.zw.a;SU.zw=null;const b={x0:Math.min(a[0],w[0]),y0:Math.min(a[1],w[1]),x1:Math.max(a[0],w[0]),y1:Math.max(a[1],w[1])};if((b.x1-b.x0)*V.k<10||(b.y1-b.y0)*V.k<10){toast('Drag a larger box');render();return}fitBox(b);setTool('select')}
function suZoomSel(){const l=selList();if(!l.length)return;const b=unionBox(l);if(!b)return;const p=Math.max(500,(b.x1-b.x0+b.y1-b.y0)*0.08);fitBox({x0:b.x0-p,y0:b.y0-p,x1:b.x1+p,y1:b.y1+p})}
/* mirror the selection about its own centre: red flips x, green flips y. Rooms take their contents */
function suFlip(axis){let l=selList().filter(o=>!fixed(o));if(!l.length)return;const b=unionBox(l);l=l.concat(carried(l));checkpoint();const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;
  const n=d=>+(((d%360)+360)%360).toFixed(3),F=p=>axis==='x'?[Math.round(2*cx-p[0]),p[1]]:[p[0],Math.round(2*cy-p[1])];
  l.forEach(o=>{if(o.t==='item'||o.t==='text'){const q=F([o.x,o.y]);o.x=q[0];o.y=q[1];o.r=n(axis==='x'?-(o.r||0):180-(o.r||0));if(o.t==='item'){if(o.flip)delete o.flip;else o.flip=true}else if(!o.r)delete o.r}
    else if(o.t==='room'||o.t==='wall'||o.t==='trunk'){o.pts=o.pts.map(F);if(Array.isArray(o.bulge))o.bulge=o.bulge.map(v=>v?-v:v)}
    else if(o.t==='dim'){o.a=F(o.a);o.b=F(o.b)}});
  markDirty();clashDirty=true;render();renderInspector();if(is3D)build3D();toast(axis==='x'?'Flipped along red':'Flipped along green')}
function suHide(iso){const keep=selList();if(!keep.length)return;const ids=new Set(keep.concat(carried(keep)).map(o=>o.id));
  if(iso)S.objs.forEach(o=>{if(!ids.has(o.id))SU.hidden.add(o.id)});else ids.forEach(id=>SU.hidden.add(id));if(!iso)sel.clear();clashDirty=true;render();renderInspector();updateHint();if(is3D)build3D();toast(iso?'Everything else hidden · right-click › Unhide all':'Hidden · right-click › Unhide all')}
function suUnhide(){SU.hidden.clear();clashDirty=true;render();renderInspector();updateHint();if(is3D)build3D();toast('Everything shown')}
$('#ctxmenu').addEventListener('click',e=>{const b=e.target.closest('[data-cm]');if(!b||!/^su-/.test(b.dataset.cm))return;const a=b.dataset.cm;$('#ctxmenu').hidden=true;
  if(a==='su-comp')suCompMake();else if(a==='su-cedit'){const o=selList().find(x=>x.cmp);if(o)suGroupEnter(o.gid)}else if(a==='su-cuniq')suCompUnique();else if(a==='su-cexp')suCompExplode();else if(a==='su-scene')suSceneAdd();else if(a==='su-guidesx')suGuidesClear();else if(a==='su-offset'){const o=selList()[0];setTool('su-offset');suOffStart(o)}else if(a==='su-zsel')suZoomSel();else if(a==='su-flipx')suFlip('x');else if(a==='su-flipy')suFlip('y');else if(a==='su-hide')suHide(false);else if(a==='su-iso')suHide(true);else if(a==='su-unhide')suUnhide();else if(a==='su-zwin')setTool('su-zwin');else if(a==='su-prev')suPrevView()});
/* SketchUp names for the panels */
function suLabel(el,txt){if(!el)return;if(!el.dataset.l0){const t=[...el.childNodes].filter(n=>n.nodeType===3).pop();el.dataset.l0=t?t.textContent:''}const t=[...el.childNodes].filter(n=>n.nodeType===3).pop();if(t)t.textContent=txt||el.dataset.l0}
function suNames(){const on=suOn();suLabel($('#t-insp'),on?'Entity Info':'');suLabel($('#t-layers'),on?'Tags':'');suLabel($('#m-axes'),on?'Axes tool: turn the plan…':'');
  const h=[...document.querySelectorAll('h3')].find(x=>x.textContent==='Layers'||x.textContent==='Tags');if(h)h.textContent=on?'Tags':'Layers';const ah=document.querySelector('#axes-modal h3');if(ah)ah.textContent=on?'Axes tool':'Design axes';
  if(T3&&T3.controls&&T3.THREE)T3.controls.mouseButtons.MIDDLE=on?T3.THREE.MOUSE.ROTATE:T3.THREE.MOUSE.PAN}
/* 3D: a double click of the middle button centres the orbit on that point */
$('#v3c')&&$('#v3c').addEventListener('auxclick',e=>{if(e.button!==1||e.detail<2||!suOn()||!T3||WALK.on)return;const p=floorAt(e);if(!p)return;const c=T3.controls,nx=p[0]*0.001,nz=p[1]*0.001,dx=nx-c.target.x,dz=nz-c.target.z;c.target.x+=dx;c.target.z+=dz;T3.camera.position.x+=dx;T3.camera.position.z+=dz;c.update();toast('Orbit centred here')});
/* ---- inference: the point hints SketchUp users read without thinking ---- */
const SU_IC={end:['#2f9a3a','Endpoint'],mid:['#0aa5c8','Midpoint'],edge:['#d6332e','On Edge'],par:['#c83ab4','Parallel to edge'],perp:['#c83ab4','Perpendicular to edge'],int:['#1b6fd1','Intersection']};
function suSegs(ids){const out=[];S.objs.forEach(o=>{if(ids&&ids.has(o.id))return;if(!visible(o))return;if(o.t==='room'&&o.pts)o.pts.forEach((p,i)=>out.push([p,o.pts[(i+1)%o.pts.length]]));else if(o.t==='wall')wallSegs(o).forEach(sg=>out.push(sg))});(S.guides||[]).forEach(g=>{const dx=g.b[0]-g.a[0],dy=g.b[1]-g.a[1],L=Math.hypot(dx,dy)||1,e=1e6;out.push([[g.a[0]-dx/L*e,g.a[1]-dy/L*e],[g.a[0]+dx/L*e,g.a[1]+dy/L*e]])});return out}
function suMark(p,k){const [c,l]=SU_IC[k],r=fs(5);const shape=k==='end'?`<rect x="${p[0]-r}" y="${p[1]-r}" width="${2*r}" height="${2*r}" fill="${c}" fill-opacity=".25" stroke="${c}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`:k==='mid'?`<path d="M${p[0]} ${p[1]-r*1.3}L${p[0]+r*1.2} ${p[1]+r}L${p[0]-r*1.2} ${p[1]+r}Z" fill="${c}" fill-opacity=".25" stroke="${c}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`:k==='int'?`<path d="M${p[0]-r} ${p[1]-r}L${p[0]+r} ${p[1]+r}M${p[0]+r} ${p[1]-r}L${p[0]-r} ${p[1]+r}" stroke="${c}" stroke-width="2" vector-effect="non-scaling-stroke"/>`:`<path d="M${p[0]} ${p[1]-r}L${p[0]+r} ${p[1]}L${p[0]} ${p[1]+r}L${p[0]-r} ${p[1]}Z" fill="${c}" fill-opacity=".25" stroke="${c}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
  return shape+`<text class="sulab" x="${p[0]+fs(9)}" y="${p[1]-fs(9)}" font-size="${fs(11)}" fill="${c}" stroke="var(--bg)" stroke-width="${fs(3)}" paint-order="stroke">${l}</text>`}
function suInfer(w,tol,T,opt){const ids=opt.ids||null;let verts=T.verts;if(polyPts&&polyPts.length>1)verts=verts.concat(polyPts.slice(0,-1));
  let b=null;verts.forEach(v=>{const d=Math.hypot(v[0]-w[0],v[1]-w[1]);if(d<tol&&(!b||d<b.d))b={d,v}});if(b)return{p:[b.v[0],b.v[1]],g:suMark(b.v,'end'),k:'end'};
  const segs=suSegs(ids).filter(([a,c])=>w[0]>=Math.min(a[0],c[0])-tol&&w[0]<=Math.max(a[0],c[0])+tol&&w[1]>=Math.min(a[1],c[1])-tol&&w[1]<=Math.max(a[1],c[1])+tol);
  let m=null;segs.forEach(([a,c])=>{const q=[(a[0]+c[0])/2,(a[1]+c[1])/2],d=Math.hypot(q[0]-w[0],q[1]-w[1]);if(d<tol&&(!m||d<m.d))m={d,q}});if(m)return{p:[Math.round(m.q[0]),Math.round(m.q[1])],g:suMark(m.q,'mid'),k:'mid'};
  /* two edges crossing near the pointer */
  const near=segs.map(sg=>{const[a,c]=sg,dx=c[0]-a[0],dy=c[1]-a[1],L2=dx*dx+dy*dy;if(!L2)return null;const t=Math.max(0,Math.min(1,((w[0]-a[0])*dx+(w[1]-a[1])*dy)/L2)),q=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(q[0]-w[0],q[1]-w[1]);return d<tol?{sg,q,d}:null}).filter(Boolean).sort((x,y)=>x.d-y.d);
  for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){const X=suCross(near[i].sg,near[j].sg);if(X&&Math.hypot(X[0]-w[0],X[1]-w[1])<tol)return{p:[Math.round(X[0]),Math.round(X[1])],g:suMark(X,'int'),k:'int'}}
  if(near.length){const q=near[0].q;return{p:[Math.round(q[0]),Math.round(q[1])],g:suMark(q,'edge'),k:'edge'}}
  /* while drawing walls: parallel or perpendicular to an edge of the plan */
  if(polyPts&&polyPts.length){const o=polyPts[polyPts.length-1],vx=w[0]-o[0],vy=w[1]-o[1],L=Math.hypot(vx,vy);if(L*V.k>20){const ang=Math.atan2(vy,vx);let best=null;
    suSegs(ids).forEach(([a,c])=>{const sa=Math.atan2(c[1]-a[1],c[0]-a[0]);if(Math.abs(Math.sin(sa))<1e-6||Math.abs(Math.cos(sa))<1e-6)return;[[0,'par'],[Math.PI/2,'perp']].forEach(([off,k])=>{const t=sa+off;let dd=((ang-t)%Math.PI+Math.PI*1.5)%Math.PI-Math.PI/2;if(Math.abs(dd)<0.035&&(!best||Math.abs(dd)<Math.abs(best.dd)))best={dd,t,k}})});
    if(best){const ux=Math.cos(best.t),uy=Math.sin(best.t),pr=vx*ux+vy*uy,q=[Math.round(o[0]+ux*pr),Math.round(o[1]+uy*pr)];return{p:q,g:`<line x1="${o[0]}" y1="${o[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#c83ab4" stroke-dasharray="6 4" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`+suMark(q,best.k),k:best.k}}}}
  return null}
function suCross(s1,s2){const[a,b]=s1,[c,d]=s2,r=[b[0]-a[0],b[1]-a[1]],q=[d[0]-c[0],d[1]-c[1]],den=r[0]*q[1]-r[1]*q[0];if(Math.abs(den)<1e-9)return null;const t=((c[0]-a[0])*q[1]-(c[1]-a[1])*q[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;if(t<-0.001||t>1.001||u<-0.001||u>1.001)return null;return[a[0]+r[0]*t,a[1]+r[1]*t]}

/* ---- Offset (F): a new outline a set distance inside or outside a room, or beside a wall; the original stays ---- */
function suOffsetPts(pts,d,closed){const n=pts.length;if(n<2)return null;let sg=1;if(closed){sg=polyArea(pts)>0?1:-1;if(polyArea(pts)===0)return null}
  /* edge normals pointing out of the room (closed) or to the left (open) */
  const off=[];for(let i=0;i<(closed?n:n-1);i++){const a=pts[i],b=pts[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);if(!L)return null;const nx=dy/L*sg,ny=-dx/L*sg;off.push([[a[0]+nx*d,a[1]+ny*d],[b[0]+nx*d,b[1]+ny*d]])}
  const line=(s1,s2)=>{const[a,b]=s1,[c,e]=s2,r=[b[0]-a[0],b[1]-a[1]],q=[e[0]-c[0],e[1]-c[1]],den=r[0]*q[1]-r[1]*q[0];if(Math.abs(den)<1e-9)return[b[0],b[1]];const t=((c[0]-a[0])*q[1]-(c[1]-a[1])*q[0])/den;return[a[0]+r[0]*t,a[1]+r[1]*t]};
  const out=[];if(closed){for(let i=0;i<n;i++)out.push(line(off[(i-1+n)%n],off[i]))}else{out.push(off[0][0]);for(let i=1;i<off.length;i++)out.push(line(off[i-1],off[i]));out.push(off[off.length-1][1])}
  const r=out.map(p=>[Math.round(p[0]),Math.round(p[1])]);/* an edge that comes out pointing the other way means the outline has turned inside out */if(closed)for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n],c=r[i],e=r[(i+1)%n];if((b[0]-a[0])*(e[0]-c[0])+(b[1]-a[1])*(e[1]-c[1])<=0)return null}if(closed&&(Math.sign(polyArea(r))!==Math.sign(polyArea(pts))||Math.abs(polyArea(r))<1e4))return null;return r}
function suOffStart(o){if(!o||fixed(o)||!(o.t==='room'||(o.t==='wall'&&!o.spline&&!(Array.isArray(o.bulge)&&o.bulge.some(Boolean))))){toast('Click a room or a straight wall to offset');return}
  const closed=o.t==='room'||!!o.closed;SU.of={o,closed,src:o.pts.map(p=>p.slice()),d:0,pts:null};SU.typed='';sel=new Set([o.id]);render();updateHint()}
function suOffDist(w){const f=SU.of,P_=f.src,n=P_.length;let best=Infinity,side=1;for(let i=0;i<(f.closed?n:n-1);i++){const a=P_[i],b=P_[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy;if(!L2)continue;const t=Math.max(0,Math.min(1,((w[0]-a[0])*dx+(w[1]-a[1])*dy)/L2)),q=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(w[0]-q[0],w[1]-q[1]);if(d<best){best=d;side=((dx*(w[1]-a[1])-dy*(w[0]-a[0]))<0)?1:-1}}
  let d=f.closed?(pointInPoly(w[0],w[1],P_)?-best:best):best*side*(polyArea(P_)>0?1:1);const st=P.snap?(+P.snapSize||10):10;return Math.round(d/st)*st}
function suOffPreview(d){const f=SU.of;f.d=d;f.pts=d?suOffsetPts(f.src,d,f.closed):null;drawOverlay();updateHint()}
function suOffCommit(){const f=SU.of;if(!f)return;SU.of=null;if(!f.pts||!f.d){toast(f.d?'That distance folds the outline over itself':'Move in or out first, or type a distance');render();updateHint();return}
  checkpoint();const n=clone(f.o);n.id=uid();n.pts=f.pts;if(n.arr)delete n.arr;n.gid=null;if(n.t==='room'){n.name=(f.o.name||'Room')+' (offset)';delete n.zone;delete n.tpl;delete n.tp}S.objs.push(n);sel=new Set([n.id]);
  SU.last={kind:'off',ids:[n.id],copies:[],src:f.src,d:f.d,closed:f.closed};SU.last.sig=suSig();SU.last.pl=past.length;markDirty();clashDirty=true;render();renderInspector();updateHint();vcbSync()}

/* ---- Scale (S): plan sizes scale about the selection's centre; heights stay ---- */
function suScaleStart(list,w){const kit=list.concat(carried(list)),b=unionBox(list);if(!b)return;const c=[(b.x0+b.x1)/2,(b.y0+b.y1)/2];suCP();SU.sc={c,r0:Math.max(1/V.k*8,Math.hypot(w[0]-c[0],w[1]-c[1])),f:1,orig:kit.map(o=>[o.id,clone(o)]),w:b.x1-b.x0};SU.typed='';updateHint()}
function suScaleApply(f){const z=SU.sc;if(!z)return;z.f=f;const c=z.c,S_=p=>[Math.round(c[0]+(p[0]-c[0])*f),Math.round(c[1]+(p[1]-c[1])*f)];
  z.orig.forEach(([id,o0])=>{const o=byId(id);if(!o)return;Object.keys(o).forEach(k=>{if(!(k in o0))delete o[k]});Object.assign(o,clone(o0));
    if(o.t==='item'||o.t==='text'){const q=S_([o.x,o.y]);o.x=q[0];o.y=q[1];if(o.t==='item'){o.w=Math.max(10,Math.round(o.w*f));o.d=Math.max(10,Math.round(o.d*f))}}
    else if(o.pts){o.pts=o.pts.map(S_);/* a curved wall keeps its shape: the bow scales with the chord */if(Array.isArray(o.bulge))o.bulge=o.bulge.map(v=>v?Math.round(v*f):v)}else if(o.t==='dim'){o.a=S_(o.a);o.b=S_(o.b)}});clashDirty=true;render()}
function suScaleCommit(){const z=SU.sc;if(!z)return;SU.sc=null;if(z.f===1){suPopPast();render();updateHint();return}SU.last={kind:'sc',f:z.f,st:z,ids:z.orig.map(x=>x[0]),copies:[]};SU.last.sig=suSig();SU.last.pl=past.length;markDirty();clashDirty=true;render();renderInspector();updateHint();vcbSync()}
function suScaleCancel(){const z=SU.sc;if(!z)return;suScaleApply(1);SU.sc=null;suPopPast();render();updateHint()}
/* ---- Tape measure (T): a guide line parallel to an edge, a set distance away; guides snap and are saved with the plan ---- */
function suGuideAt(base,d){const[a,b]=base,dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;return{a:[Math.round(a[0]+nx*d),Math.round(a[1]+ny*d)],b:[Math.round(b[0]+nx*d),Math.round(b[1]+ny*d)]}}
function suTapeStart(w){const tol=10/V.k;let best=null;suSegs(null).concat((S.guides||[]).map(g=>[g.a,g.b])).forEach(sg=>{const[a,c]=sg,dx=c[0]-a[0],dy=c[1]-a[1],L2=dx*dx+dy*dy;if(!L2)return;const t=((w[0]-a[0])*dx+(w[1]-a[1])*dy)/L2,q=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(q[0]-w[0],q[1]-w[1]);if(d<tol&&(!best||d<best.d))best={d,sg}});
  if(!best){toast('Click on an edge to pull a guide from it');return}SU.tp={base:best.sg,d:0};SU.typed='';updateHint();drawOverlay()}
function suTapeDist(w){const[a,b]=SU.tp.base,dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,d=((w[0]-a[0])*-dy+(w[1]-a[1])*dx)/L;const st=P.snap?(+P.snapSize||10):10;return Math.round(d/st)*st}
function suTapeCommit(){const t=SU.tp;if(!t)return;SU.tp=null;if(!t.d){toast('Pull away from the edge, or type a distance');render();updateHint();return}checkpoint();S.guides=(S.guides||[]).concat([suGuideAt(t.base,t.d)]);SU.last={kind:'tp',base:t.base,d:t.d,ids:[],copies:[]};SU.last.sig=suSig();SU.last.pl=past.length;markDirty();render();updateHint();vcbSync()}
function suGuidesClear(){if(!S.guides||!S.guides.length)return toast('No guides to delete');checkpoint();delete S.guides;markDirty();render();toast('Guides deleted')}
/* ---- 3D: standard views, parallel projection, X-ray ---- */
function suView(k){if(!is3D){set3D(true);setTimeout(()=>suView(k),400);return}if(!T3)return;const{camera,controls}=T3;const[cx,cz]=T3.center,sp=T3.span,cy=T3.cy||0,d=sp*(SU.par?40:1.4);controls.target.set(cx,cy,cz);
  const P_={top:[cx,cy+d,cz+0.0001],front:[cx,cy+sp*0.15,cz+d],back:[cx,cy+sp*0.15,cz-d],right:[cx+d,cy+sp*0.15,cz],left:[cx-d,cy+sp*0.15,cz],iso:[cx+d*0.62,cy+d*0.62,cz+d*0.62]}[k];if(!P_)return;camera.position.set(P_[0],P_[1],P_[2]);
  camera.near=Math.max(0.01,sp/2000)*(SU.par?20:1);camera.far=Math.max(sp*30,d*4);camera.updateProjectionMatrix();controls.update();T3.need=true;toast({top:'Top',front:'Front',back:'Back',right:'Right',left:'Left',iso:'Iso'}[k]+' view')}
function suParallel(on){if(!T3){if(on!==undefined)SU.par=on;return}const{camera,controls}=T3;if(T3.fov0==null)T3.fov0=camera.fov;on=on===undefined?!SU.par:on;if(on===!!SU.par)return;
  const t=controls.target,dir=camera.position.clone().sub(t),d=dir.length(),h=2*d*Math.tan(camera.fov*Math.PI/360),f2=on?2:T3.fov0,d2=h/(2*Math.tan(f2*Math.PI/360));
  SU.par=on;camera.fov=f2;camera.position.copy(t.clone().add(dir.normalize().multiplyScalar(d2)));camera.near=Math.max(0.01,d2/400);camera.far=Math.max(T3.span*30,d2*4);camera.updateProjectionMatrix();controls.update();T3.need=true;toast(on?'Parallel projection (camera far away with a narrow lens)':'Perspective')}
const suXmats=new Map();
function suXrayApply(on){if(!T3)return;if(!on){suXmats.forEach((v,m)=>{m.transparent=v[0];m.opacity=v[1];m.depthWrite=v[2];m.needsUpdate=true});suXmats.clear();T3.need=true;return}
  T3.group.traverse(o=>{if(!o.isMesh)return;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!m||suXmats.has(m))return;suXmats.set(m,[m.transparent,m.opacity,m.depthWrite]);m.transparent=true;m.opacity=Math.min(m.opacity,0.45);m.depthWrite=false;m.needsUpdate=true})});T3.need=true}
function suXray(on){SU.xray=on===undefined?!SU.xray:on;if(is3D)suXrayApply(SU.xray);toast(SU.xray?'X-ray on':'X-ray off')}


/* ---- Scenes: saved views as tabs across the top of the plan, saved with the plan ---- */
function suSceneGrab(){const sc={v:{x:V.x,y:V.y,k:V.k},d3:!!is3D};if(is3D&&T3){const c=T3.camera,t=T3.controls.target;sc.cam={p:[c.position.x,c.position.y,c.position.z],t:[t.x,t.y,t.z],fov:c.fov};sc.par=!!SU.par}if(SU.xray)sc.xray=true;if(SU.hidden.size)sc.hidden=[...SU.hidden];return sc}
function suSceneAdd(){checkpoint();S.scenes=(S.scenes||[]).concat([Object.assign({name:'Scene '+((S.scenes||[]).length+1)},suSceneGrab())]);markDirty();suScenesBar();toast('Scene added · click its tab to come back to this view')}
function suSceneGo(i){const sc=(S.scenes||[])[i];if(!sc)return;SU.hidden=new Set(sc.hidden||[]);const fin=()=>{if(sc.d3&&T3&&sc.cam){const c=T3.camera;if(T3.fov0==null)T3.fov0=c.fov;SU.par=!!sc.par;c.fov=sc.cam.fov||c.fov;c.position.set(...sc.cam.p);T3.controls.target.set(...sc.cam.t);c.updateProjectionMatrix();T3.controls.update();T3.need=true}SU.xray=!!sc.xray;if(is3D){build3D();suXrayApply(SU.xray)}render();suScenesBar(i)};
  if(sc.d3&&!is3D){set3D(true);let n=0;const wt=()=>{if(T3&&is3D)fin();else if(n++<40)setTimeout(wt,100)};setTimeout(wt,100)}else{if(!sc.d3&&is3D)set3D(false);if(!sc.d3){V.x=sc.v.x;V.y=sc.v.y;V.k=sc.v.k;applyView()}fin()}}
function suSceneUpdate(i){const sc=(S.scenes||[])[i];if(!sc)return;checkpoint();Object.assign(sc,suSceneGrab());if(!SU.hidden.size)delete sc.hidden;if(!SU.xray)delete sc.xray;markDirty();toast('Scene updated')}
function suSceneDel(i){if(!(S.scenes||[])[i])return;checkpoint();S.scenes.splice(i,1);if(!S.scenes.length)delete S.scenes;markDirty();suScenesBar()}
function suSceneRename(i){const sc=(S.scenes||[])[i];if(!sc)return;const n=prompt('Scene name',sc.name);if(n==null||!String(n).trim())return;checkpoint();sc.name=String(n).trim().slice(0,60);markDirty();suScenesBar()}
let suBar=null,suBarSig='';
function suScenesBar(on){if(!suBar){suBar=document.createElement('div');suBar.id='su-scenes';suBar.setAttribute('role','tablist');suBar.setAttribute('aria-label','Scenes');$('#main').appendChild(suBar);
    suBar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const i=+b.dataset.i;if(b.dataset.a==='add')suSceneAdd();else if(b.dataset.a==='x')suSceneDel(i);else suSceneGo(i)});
    suBar.addEventListener('dblclick',e=>{const b=e.target.closest('button[data-a=go]');if(b)suSceneRename(+b.dataset.i)});
    suBar.addEventListener('contextmenu',e=>{const b=e.target.closest('button[data-a=go]');if(!b)return;e.preventDefault();suSceneUpdate(+b.dataset.i)})}
  const L=S.scenes||[];suBar.hidden=!suOn()||!L.length||WALK.on||bldView;if(suBar.hidden)return;
  suBar.innerHTML=L.map((sc,i)=>`<span class="sc${on===i?' on':''}"><button type="button" data-a="go" data-i="${i}" role="tab" title="Go to this scene · double-click to rename · right-click to update it to the current view">${esc(sc.name)}</button><button type="button" class="x" data-a="x" data-i="${i}" aria-label="Delete scene ${esc(sc.name)}">×</button></span>`).join('')+'<button type="button" class="add" data-a="add" aria-label="Add scene" title="Add a scene from the current view">+</button>'}
/* ---- editing inside a group: double-click a group to work on its parts; the rest fades; Esc or a click outside leaves ---- */
function suGroupEnter(gid){SU.gctx=gid;{const mem=S.objs.filter(o=>o.gid===gid),d=mem.find(o=>o.cmp)&&mem.find(o=>o.cmp).cmp;SU.cedit=d&&S.comps&&S.comps[d]?{gid,d,T:suInstT(mem.filter(o=>o.cmp===d),S.comps[d]),sig:JSON.stringify(mem)}:null}sel=new Set();render();renderInspector();updateHint();toast('Editing inside the group · Esc or a click outside leaves')}
function suGroupLeave(){if(!SU.gctx)return;const ce=SU.cedit;SU.cedit=null;const g=SU.gctx;SU.gctx=null;if(ce&&JSON.stringify(S.objs.filter(o=>o.gid===g))!==ce.sig){checkpoint();const n=suCompPropagate(g,ce.d,ce.T);markDirty();clashDirty=true;if(n)toast(`Component updated: ${n} other ${n===1?'copy':'copies'} changed`)}render();updateHint()}
function suFade(){const g=SU&&SU.gctx;$$('#L-rooms [data-id],#L-items [data-id],#L-anno [data-id]').forEach(el=>{const o=g?byId(el.dataset.id):null;el.classList.toggle('su-fade',!!g&&!!o&&o.gid!==g)})}

svg.addEventListener('pointerdown',ev=>{if(!SU.gctx||ev.button!==0)return;const el=ev.target.closest&&ev.target.closest('[data-id]');const o=el?byId(el.dataset.id):null;if(!o||o.gid!==SU.gctx)suGroupLeave()},true);

/* ---- Circle (C), Polygon and Rotated rectangle: they draw rooms, so the checks see them ---- */
function suCirPts(c,r,n,a0){const out=[];for(let i=0;i<n;i++){const a=a0+i*2*Math.PI/n;out.push([Math.round(c[0]+Math.cos(a)*r),Math.round(c[1]+Math.sin(a)*r)])}return out}
function suRoomAdd(pts,name){if(!pts||pts.length<3||Math.abs(polyArea(pts))<2e5){toast('Too small to make a room');render();return}checkpoint();const o={id:uid(),t:'room',name,pts,gid:null};S.objs.push(o);sel=new Set([o.id]);markDirty();clashDirty=true;render();renderInspector();SU.last={kind:'shape',ids:[o.id],copies:[],shape:SU.lastShape};SU.last.sig=suSig();SU.last.pl=past.length;updateHint();vcbSync()}
function suCirFinish(){const c=SU.cir;if(!c)return;SU.cir=null;if(!c.r){render();updateHint();return}SU.lastShape={k:c.k,c:c.c,r:c.r,n:c.n,a0:c.a0};suRoomAdd(suCirPts(c.c,c.r,c.n,c.a0),c.k==='circle'?'Round room':`${c.n}-sided room`)}
function suRRPts(a,b,d){const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,nx=-dy/L*d,ny=dx/L*d;return[a,b,[Math.round(b[0]+nx),Math.round(b[1]+ny)],[Math.round(a[0]+nx),Math.round(a[1]+ny)]]}

/* ---- Move and Rotate inside 3D. Move slides on the floor; the up arrow locks the blue (height) axis and lifts items off the floor ---- */
let suB3raf=0;function suB3(){if(!suB3raf)suB3raf=requestAnimationFrame(()=>{suB3raf=0;build3D()})}
function su3pick(e){if(!T3)return null;const cv=$('#v3c'),{THREE,camera,group}=T3,r=cv.getBoundingClientRect(),rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
  for(const h of rc.intersectObjects(group.children,true)){let m=h.object;while(m&&!m.userData.id)m=m.parent;if(!m)continue;const o=byId(m.userData.id);if(!o||fixed(o))continue;return{o,p:h.point,wall:m.userData.paint==='wall'}}return null}
function su3ppm(p){const cv=$('#v3c'),r=cv.getBoundingClientRect(),a=p.clone().project(T3.camera),b=p.clone();b.y+=1;b.project(T3.camera);return Math.max(0.005,Math.abs(a.y-b.y)*r.height/2/1000)}
(()=>{const cv=$('#v3c'),host=$('#v3');if(!cv||!host)return;/* on the 3D view's container, in the capture phase, so these tools act before anything listening on the canvas */
  host.addEventListener('pointerdown',e=>{if(e.target!==cv)return;if(!is3D||WALK.on||e.button!==0||(tool!=='su-move'&&tool!=='su-rotate'))return;e.stopImmediatePropagation();e.preventDefault();SU.d3down=[e.clientX,e.clientY];
    if(tool==='su-move'){if(SU.mv){suMoveCommit();SU.d3down=null;return}const h=su3pick(e);let l=selList().filter(o=>!fixed(o));if(!l.length&&h){l=groupOf(h.o).filter(o=>!fixed(o));sel=new Set(l.map(o=>o.id))}if(!l.length){toast('Press on what to move');return}
      const fp=floorAt(e)||[h?h.p.x*1000:0,h?h.p.z*1000:0];if(T3.controls)T3.controls.enabled=false;suMoveStart(l,[Math.round(fp[0]),Math.round(fp[1])]);SU.mv.y0=e.clientY;SU.mv.ppm=h?su3ppm(h.p):1;SU.mv.z0=l.map(o=>[o.id,+o.z||0]);try{cv.setPointerCapture(e.pointerId)}catch(_){};return}
    if(tool==='su-rotate'){if(SU.rt&&SU.rt.stage===2){suRotCommit();SU.d3down=null;if(T3.controls)T3.controls.enabled=true;return}const h=su3pick(e);let l=selList().filter(o=>!fixed(o));if(!l.length&&h){l=groupOf(h.o).filter(o=>!fixed(o));sel=new Set(l.map(o=>o.id))}if(!l.length){toast('Press on what to rotate');return}
      const b=unionBox(l),c=[(b.x0+b.x1)/2,(b.y0+b.y1)/2],fp=floorAt(e)||[c[0]+1000,c[1]];if(T3.controls)T3.controls.enabled=false;suRotStart(l,c);suRotRef([fp[0]+(Math.hypot(fp[0]-c[0],fp[1]-c[1])<100?1000:0),fp[1]]);try{cv.setPointerCapture(e.pointerId)}catch(_){}}},true);
  host.addEventListener('pointermove',e=>{if(!is3D||(tool!=='su-move'&&tool!=='su-rotate'))return;
    if(SU.mv){e.stopImmediatePropagation();const m=SU.mv;if(m.akey==='z'){let dz=(m.y0-e.clientY)/m.ppm;dz=Math.round(dz/(e.altKey?10:50))*(e.altKey?10:50);m.dz=dz;m.z0.forEach(([id,z])=>{const o=byId(id);if(o&&o.t==='item')o.z=Math.max(0,z+dz)||undefined});m.d=[0,0];suB3();vcbSync();return}
      const fp=floorAt(e);if(!fp)return;m.raw=[fp[0]-m.base[0],fp[1]-m.base[1]];suMoveTo(m.raw,e.shiftKey);vcbSync();return}
    if(SU.rt&&SU.rt.stage===2){e.stopImmediatePropagation();const fp=floorAt(e);if(fp)suRotApply(suRotAngle(fp,e.altKey));vcbSync()}},true);
  host.addEventListener('pointerup',e=>{if(!is3D||!SU.d3down)return;const far=Math.hypot(e.clientX-SU.d3down[0],e.clientY-SU.d3down[1])>8;SU.d3down=null;if(!far)return;e.stopImmediatePropagation();if(SU.mv)suMoveCommit();else if(SU.rt&&SU.rt.stage===2)suRotCommit();if(T3&&T3.controls)T3.controls.enabled=true},true);
})();
/* ---- Arc (A): two clicks for the ends, a third for how far it bows; makes a curved wall ---- */
function suArcWall(a,b,h){const w={id:uid(),t:'wall',pts:[a,b],th:typeof newWallTh==='function'?newWallTh():100,closed:false,gid:null};if(h)w.bulge=[h];return w}
function suArcSign(a,b,cur,h){/* bow towards the pointer whatever the sign convention of the wall drawing */const w=suArcWall(a,b,h);try{const q=wallPathPts(w),m=q[Math.floor(q.length/2)],side=p=>Math.sign((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));return side(m)===side(cur)?h:-h}catch(e){return h}}
/* ---- colour by tag: plan objects tinted by their library group ---- */
function suTagColours(on){SU.tagcol=on===undefined?!SU.tagcol:on;let st=$('#su-tagcol');if(!st){st=document.createElement('style');st.id='su-tagcol';document.head.appendChild(st)}
  if(!SU.tagcol){st.textContent='';toast('Colour by tag off');return}/* the class each item is drawn with (catCls), so every library group is tinted */const cats=[...new Set(S.objs.filter(o=>o.t==='item'&&o.cat).map(o=>catCls(o.cat)))];const cls=c=>c;
  st.textContent=cats.map((c,i)=>`#L-items .${cls(c)} :is(rect,path,circle,ellipse,polygon){fill:hsl(${Math.round(i*137.5)%360},62%,72%)!important}`).join('');toast(`Colour by tag: ${cats.length} ${cats.length===1?'group':'groups'}`)}

/* ---- Components: copies that share one definition. Edit inside any copy (double-click it); when you leave, every other copy takes the change ---- */
function suPose(o){if(o.t==='item'||o.t==='text')return{p:[o.x,o.y],a:+o.r||0};if(o.pts&&o.pts.length>1)return{p:o.pts[0],a:Math.atan2(o.pts[1][1]-o.pts[0][1],o.pts[1][0]-o.pts[0][0])*180/Math.PI};if(o.pts)return{p:o.pts[0],a:0};if(o.t==='dim')return{p:o.a,a:Math.atan2(o.b[1]-o.a[1],o.b[0]-o.a[0])*180/Math.PI};return{p:[0,0],a:0}}
function suXf(o,T,inv){if(inv){moveObj(o,clone(o),-T.t[0],-T.t[1]);turnObj(o,0,0,-T.r)}else{turnObj(o,0,0,T.r);moveObj(o,clone(o),T.t[0],T.t[1])}const R=v=>Math.round(v*1000)/1000;if(o.x!=null){o.x=R(o.x);o.y=R(o.y)}if(o.r!=null)o.r=R(((o.r%360)+360)%360);if(o.pts)o.pts=o.pts.map(p=>[R(p[0]),R(p[1])]);if(o.a&&o.b){o.a=[R(o.a[0]),R(o.a[1])];o.b=[R(o.b[0]),R(o.b[1])]}return o}
function suInstT(members,def){const keys=members.map(m=>m.cmk).filter(k=>k!=null).sort((a,b)=>a-b);for(const k of keys){const m=members.find(x=>x.cmk===k),d=def.objs.find(x=>x.cmk===k);if(!m||!d)continue;const pm=suPose(m),pd=suPose(d),r=pm.a-pd.a,q=rotPt(pd.p[0],pd.p[1],0,0,r);return{r,t:[pm.p[0]-q[0],pm.p[1]-q[1]]}}return{r:0,t:[0,0]}}
function suInstances(d){const by={};S.objs.forEach(o=>{if(o.cmp===d&&o.gid){(by[o.gid]=by[o.gid]||[]).push(o)}});return by}
function suCompMake(){let l=selList().filter(o=>!fixed(o));if(!l.length)return toast('Select what to make into a component');l=l.concat(carried(l));const ids=new Set(l.map(o=>o.id));l=S.objs.filter(o=>ids.has(o.id));
  if(l.some(o=>o.cmp))return toast('Part of that is already a component. Explode it first, or Make unique');
  const n=Object.keys(S.comps||{}).length+1,name=prompt('Component name','Component '+n);if(name==null)return;checkpoint();const d=uid(),g=uid();S.comps=S.comps||{};
  l.forEach((o,i)=>{o.gid=g;o.cmp=d;o.cmk=i});S.comps[d]={name:String(name).trim().slice(0,60)||'Component '+n,objs:l.map(o=>{const c=clone(o);delete c.id;delete c.gid;return c})};
  markDirty();render();renderInspector();toast(`Component made: ${S.comps[d].name} · copy it to place more; edit any copy and the others follow`)}
function suCompUnique(){const l=selList().filter(o=>o.cmp);if(!l.length)return;const d0=l[0].cmp,def=S.comps&&S.comps[d0];if(!def)return;checkpoint();const d=uid();const g=l[0].gid;const mem=S.objs.filter(o=>o.gid===g&&o.cmp===d0);
  mem.forEach(o=>{o.cmp=d});S.comps[d]={name:def.name+' (unique)',objs:mem.map(o=>{const c=clone(o);delete c.id;delete c.gid;c.cmp=d;return suXf(c,suInstT(mem,def),true)})};markDirty();render();toast('This copy is now its own component')}
function suCompExplode(){const l=selList().filter(o=>o.cmp);if(!l.length)return;checkpoint();const g=l[0].gid;S.objs.forEach(o=>{if(o.gid===g){delete o.cmp;delete o.cmk}});markDirty();render();renderInspector();toast('Exploded: now a plain group')}
function suCompPropagate(gid,d,T0,why){const def=S.comps&&S.comps[d];if(!def)return 0;const mem=S.objs.filter(o=>o.gid===gid);let k=Math.max(-1,...def.objs.map(c=>+c.cmk||0))+1;mem.forEach(o=>{if(o.cmp!==d){o.cmp=d;o.cmk=k++}});
  const src=mem.map(o=>o.id),nd=mem.map(o=>{const c=clone(o);delete c.id;delete c.gid;return suXf(c,T0,true)});const inst=suInstances(d);let n=0;
  Object.keys(inst).forEach(g2=>{if(g2===gid)return;const m2=inst[g2],T2=suInstT(m2,def),gone=new Set(m2.map(o=>o.id));S.objs=S.objs.filter(o=>!gone.has(o.id));/* each part keeps the id it had in this copy, and items follow the room of their own copy */const used=new Set(),ids=nd.map(c=>{const old=m2.find(x=>x.cmk===c.cmk&&!used.has(x.id)),id=old?old.id:uid();used.add(id);return id});nd.forEach((c,i)=>{const o=clone(c);o.id=ids[i];o.gid=g2;if(o.tp){const j=src.indexOf(o.tp);if(j>=0)o.tp=ids[j];else delete o.tp}suXf(o,T2,false);S.objs.push(o)});n++});
  def.objs=nd;return n}
function suCompPurge(){const used=new Set(S.objs.map(o=>o.cmp).filter(Boolean));const dead=Object.keys(S.comps||{}).filter(d=>!used.has(d));if(!dead.length)return toast('Nothing to purge');checkpoint();dead.forEach(d=>delete S.comps[d]);if(!Object.keys(S.comps).length)delete S.comps;markDirty();toast(`Purged ${dead.length} unused ${dead.length===1?'component':'components'}`);suOutlinerUI()}
/* ---- Outliner: components, groups and rooms in one list; click to select, double-click a component to rename ---- */
function suOutlinerOpen(){let m=$('#su-outliner');if(!m){m=document.createElement('div');m.id='su-outliner';m.className='keys-modal';m.hidden=true;m.setAttribute('data-keep','');m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','su-ol-h');document.body.appendChild(m);
    m.addEventListener('click',e=>{const b=e.target.closest('[data-ol]');if(!b)return;const a=b.dataset.ol,v=b.dataset.v;if(a==='x'){m.hidden=true;return}if(a==='purge')return suCompPurge();
      if(a==='comp'){const ids=S.objs.filter(o=>o.cmp===v).map(o=>o.id);setSel(ids);suZoomSel()}else if(a==='grp'){setSel(S.objs.filter(o=>o.gid===v).map(o=>o.id));suZoomSel()}else if(a==='room'){setSel([v]);suZoomSel()}});
    m.addEventListener('dblclick',e=>{const b=e.target.closest('[data-ol=comp]');if(!b)return;const def=S.comps[b.dataset.v];const n=prompt('Component name',def.name);if(n==null||!n.trim())return;checkpoint();def.name=n.trim().slice(0,60);markDirty();suOutlinerUI()});
    m.addEventListener('input',e=>{if(e.target.id==='su-ol-f')suOutlinerUI(true)})}
  m.innerHTML='<div class="keys-card" style="height:auto;max-width:440px"><div class="keys-head"><h3 id="su-ol-h">Outliner</h3><span style="flex:1"></span><button class="btn sm" type="button" data-ol="purge" title="Delete component definitions that have no copies left">Purge unused</button><button class="btn icon ghost sm" type="button" data-ol="x" aria-label="Close">✕</button></div><div style="padding:10px 14px"><input id="su-ol-f" type="search" placeholder="Filter" aria-label="Filter the outliner" style="width:100%;margin-bottom:8px"><div id="su-ol-list" style="max-height:55vh;overflow:auto;font-size:13px"></div></div></div>';m.hidden=false;suOutlinerUI()}
function suOutlinerUI(keep){const box=$('#su-ol-list');if(!box)return;const f=(($('#su-ol-f')||{}).value||'').toLowerCase(),ok=t=>!f||String(t).toLowerCase().includes(f);let h='';
  const comps=Object.entries(S.comps||{}).filter(([d,c])=>ok(c.name));if(comps.length)h+='<div class="grp">Components</div>'+comps.map(([d,c])=>{const n=Object.keys(suInstances(d)).length;return`<button type="button" class="ol-row" data-ol="comp" data-v="${d}" title="Select every copy · double-click to rename">◈ ${esc(c.name)} <span class="muted">${n} ${n===1?'copy':'copies'}</span></button>`}).join('');
  const gs={};S.objs.forEach(o=>{if(o.gid&&!o.cmp)(gs[o.gid]=gs[o.gid]||[]).push(o)});const gl=Object.entries(gs).filter(([g,l])=>ok('group '+l.map(o=>o.name||'').join(' ')));if(gl.length)h+='<div class="grp">Groups</div>'+gl.map(([g,l])=>`<button type="button" class="ol-row" data-ol="grp" data-v="${g}">▣ Group of ${l.length} <span class="muted">${esc(l.slice(0,3).map(o=>o.name||o.t).join(', '))}</span></button>`).join('');
  const rs=S.objs.filter(o=>o.t==='room'&&ok(o.name||'Room'));if(rs.length)h+='<div class="grp">Rooms</div>'+rs.map(o=>`<button type="button" class="ol-row" data-ol="room" data-v="${o.id}">▢ ${esc(o.name||'Room')} <span class="muted">${(Math.abs(polyArea(o.pts))/1e6).toFixed(1)} m²</span></button>`).join('');
  box.innerHTML=h||'<p class="muted">Nothing here yet.</p>'}

/* ---- 3D styles: hidden line (white faces, black edges) and sketchy edges; section fill on cut walls ---- */
const suStyleMats=new Map();
function suStyleApply(){if(!T3||!is3D)return;const{THREE,group}=T3;group.children.filter(c=>c.userData.suEdge).forEach(c=>{group.remove(c);c.geometry&&c.geometry.dispose()});suStyleMats.forEach((v,m)=>{m.color&&m.color.copy(v);m.needsUpdate=true});suStyleMats.clear();
  const st=SU.style||'shaded';if(st==='shaded')return;const meshes=[];group.traverse(o=>{if(o.isMesh&&!o.userData.noExport&&!o.userData.suCap&&o.visible)meshes.push(o)});const cap=6000;if(meshes.length>cap)toast(`Edges drawn on the first ${cap} of ${meshes.length} parts`);
  const lm=new THREE.LineBasicMaterial({color:0x222222});const sk=st==='sketchy';let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-0.5};
  meshes.slice(0,cap).forEach(o=>{(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m&&m.color&&!suStyleMats.has(m)){suStyleMats.set(m,m.color.clone());if(st==='hidden')m.color.set(0xffffff);m.needsUpdate=true}});
    if(o.userData.suCap)return;let eg;try{eg=new THREE.EdgesGeometry(o.geometry,25)}catch(e){return}if(sk){const p=eg.attributes.position,a=p.array,j=0.012;for(let i=0;i<a.length;i+=6){const dx=a[i+3]-a[i],dy=a[i+4]-a[i+1],dz=a[i+5]-a[i+2],ext=0.06;a[i]-=dx*ext;a[i+1]-=dy*ext;a[i+2]-=dz*ext;a[i+3]+=dx*ext;a[i+4]+=dy*ext;a[i+5]+=dz*ext;for(let k=0;k<6;k++)a[i+k]+=rnd()*j}p.needsUpdate=true}
    const L=new THREE.LineSegments(eg,lm);o.updateWorldMatrix(true,false);L.applyMatrix4(o.matrixWorld);const inv=new THREE.Matrix4().copy(group.matrixWorld).invert();L.applyMatrix4(inv);L.userData.suEdge=true;L.userData.noExport=true;L.raycast=()=>{};group.add(L)});T3.need=true}
function suStyle(k){SU.style=k;if(is3D){build3D()}toast({shaded:'Shaded',hidden:'Hidden line',sketchy:'Sketchy edges'}[k])}
function suSecFill(){if(T3&&T3.group)T3.group.children.filter(c=>c.userData.suCap).forEach(c=>{T3.group.remove(c);c.geometry&&c.geometry.dispose()});if(!T3||!is3D||!S.section||!S.section.on||WALK.on||bldView||SU.secfill===false)return;const{THREE,group}=T3,s=0.001,sec=S.section,a=sec.a,b=sec.b;let nx=b[1]-a[1],ny=-(b[0]-a[0]);const L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;if(sec.flip){nx=-nx;ny=-ny}
  const wh=S.bld?lvVal(S.bld,bldLevel(S),'ceiling'):2800,dx=b[0]-a[0],dy=b[1]-a[1],mat=new THREE.MeshBasicMaterial({color:0x2b2b2b,side:THREE.DoubleSide});let n=0;
  (T3.cols||[]).forEach(c=>{if(!c||!Array.isArray(c.a)||!Array.isArray(c.b)||!(c.t>0))return;const X=suCross([a,b],[c.a,c.b]);if(!X)return;const ux=c.b[0]-c.a[0],uy=c.b[1]-c.a[1],ul=Math.hypot(ux,uy)||1,sin=Math.abs((ux*dy-uy*dx)/(ul*(Math.hypot(dx,dy)||1)));if(sin<0.05)return;const w=c.t/sin;
    const g=new THREE.PlaneGeometry(w*s,wh*s),m=new THREE.Mesh(g,mat);m.position.set((X[0]+nx*2)*s,wh/2*s,(X[1]+ny*2)*s);m.rotation.y=-Math.atan2(dy,dx);m.userData.noExport=true;m.userData.suCap=true;m.raycast=()=>{};group.add(m);n++});T3.need=true;return n}
function suAfter3D(){suXmats.clear();if(SU.xray)suXrayApply(true);suSecFill();suStyleApply()}
/* ---- Materials: named colours for the paint bucket ---- */
const SU_MATS=[['Brick','#a0522d'],['Concrete','#b8b8b0'],['Fair-face concrete','#cfcfc8'],['Plaster white','#f4f2ec'],['Timber, light','#d9b98c'],['Timber, dark','#7a5230'],['Carpet, grey','#8c8f94'],['Carpet, blue','#49648c'],['Vinyl, beige','#d8cdb4'],['Tile, white','#eeeeea'],['Marble','#e8e4dc'],['Granite','#6e6a66'],['Glass','#9ec9de'],['Steel','#8a9299'],['Aluminium','#c4c8cc'],['Grass','#6b9a43'],['Water','#5b9bc4'],['Asphalt','#4a4a4a'],['Paint, sage','#a9b8a0'],['Paint, terracotta','#c96f4a']];
function suMatsOpen(){let m=$('#su-mats');if(!m){m=document.createElement('div');m.id='su-mats';m.className='keys-modal';m.hidden=true;m.setAttribute('data-keep','');m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','su-mats-h');document.body.appendChild(m);
    m.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(!b)return;if(b.dataset.m==='x'){m.hidden=true;return}P.paintCol=b.dataset.m;savePrefs();m.hidden=true;setTool('paint');toast(`${b.title}: click a wall, floor or item to paint it`)})}
  m.innerHTML=`<div class="keys-card" style="height:auto;max-width:460px"><div class="keys-head"><h3 id="su-mats-h">Materials</h3><span style="flex:1"></span><button class="btn icon ghost sm" type="button" data-m="x" aria-label="Close">✕</button></div><div style="padding:12px 14px"><p class="muted" style="margin:0 0 8px">Pick one to paint with. Colours only: no textures yet.</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px">${SU_MATS.map(([n,c])=>`<button type="button" class="mat" data-m="${c}" title="${esc(n)}" style="border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:6px;cursor:pointer;font:inherit;font-size:12px;color:var(--fg);text-align:left"><span style="display:block;height:34px;border-radius:5px;background:${c};margin-bottom:4px"></span>${esc(n)}</button>`).join('')}</div></div></div>`;m.hidden=false}

/* ---- Push/Pull (SketchUp's extrude). StoreyBook objects keep their type, so pulling sets a value:
   an item's height; a wall or floor's floor-to-ceiling height (the building's walls share it per floor) ---- */
function suPPTarget(o,wallHit){if(!o)return null;
  /* looked up afresh each time: Undo replaces the plan's objects, and a kept reference would write to one that is gone */
  if(o.t==='item'&&!isSite(o)){const id=o.id;return{key:'h:'+id,label:'Height',get:()=>{const q=byId(id);return q?+q.h||0:0},set:v=>{const q=byId(id);if(q)q.h=Math.round(Math.max(10,Math.min(30000,v)))},ids:[id]}}
  if((o.t==='room'||o.t==='wall'||wallHit)&&S.bld){const lid=bldLevel(S).id,L=()=>(S.bld&&S.bld.levels.find(x=>x.id===lid))||bldLevel(S);return{key:'c:'+lid,label:'Floor to ceiling',get:()=>lvVal(S.bld,L(),'ceiling'),set:v=>{L().ceiling=Math.round(Math.max(1000,Math.min(30000,v)))},ids:[]}}
  if(o.t==='room'||o.t==='wall'||wallHit){toast('Walls take their height from the floor. Set up the building in Details › Floors to pull it');return null}
  return null}
function suPPStart(t,ev,ppm){SU.pp={t,v0:t.get(),y0:ev?ev.clientY:0,ppm:ppm||0,moved:false,cp:false,armed:false};SU.typed='';updateHint();vcbSync()}
let suPPraf=0;
function suPPSet(v){const p=SU.pp;if(!p)return;if(!p.cp){suCP();p.cp=true}p.t.set(v);markDirty();clashDirty=true;if(is3D){if(!suPPraf)suPPraf=requestAnimationFrame(()=>{suPPraf=0;build3D()})}else render();vcbSync();updateHint()}
function suPPCommit(){const p=SU.pp;if(!p)return;SU.pp=null;if(!p.cp||p.t.get()===p.v0){if(p.cp)suPopPast();suPPAfter();return}SU.last={kind:'pp',t:p.t,ids:p.t.ids,copies:[],v:p.t.get()};SU.last.sig=suSig();SU.last.pl=past.length;suPPAfter();suChipFor()}
function suPPCancel(){const p=SU.pp;if(!p)return;SU.pp=null;if(p.cp){p.t.set(p.v0);suPopPast()}suPPAfter()}
function suPPAfter(){if(T3&&T3.controls)T3.controls.enabled=true;markDirty();renderInspector();updateHint();vcbSync();if(is3D)build3D();else render()}
/* a small value box for touch screens and for anyone who would rather type into a box */
let suChip=null;
function suChipFor(){const L=SU.last;if(!L||L.kind!=='pp')return;if(!suChip){suChip=document.createElement('div');suChip.id='su-chip';suChip.innerHTML='<label><span></span> <input type="text" inputmode="decimal" autocomplete="off"></label> mm<button class="btn sm primary" type="button">Set</button><button class="btn sm ghost icon" type="button" data-x aria-label="Close">✕</button>';$('#main').appendChild(suChip);
    const inp=suChip.querySelector('input'),go=()=>{SU.typed=String(inp.value).replace(/[^0-9.\-]/g,'');if(!SU.typed)return;if(!suLastOK()){suChip.hidden=true;return}suApplyTyped();suChipFor()};
    suChip.querySelector('.primary').addEventListener('click',go);suChip.querySelector('[data-x]').addEventListener('click',()=>{suChip.hidden=true});inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();go()}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();suChip.hidden=true}})}
  suChip.querySelector('span').textContent=L.t.label;const inp=suChip.querySelector('input');inp.value=L.t.get();suChip.hidden=false;if(!PHONE())setTimeout(()=>{inp.focus();inp.select()},0)}
/* 3D: press on an item, wall or floor and pull; or click, move, click */
(()=>{const cv=$('#v3c'),host=$('#v3');if(!cv||!host)return;
  const pick=e=>{if(!T3)return null;const{THREE,camera,group}=T3;const r=cv.getBoundingClientRect();const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
    for(const h of rc.intersectObjects(group.children,true)){let m=h.object;while(m&&!m.userData.id)m=m.parent;if(!m)continue;const o=byId(m.userData.id);if(!o||fixed(o))continue;return{o,wall:m.userData.paint==='wall',p:h.point}}return null};
  const ppm=(p)=>{const{camera}=T3,r=cv.getBoundingClientRect();const a=p.clone().project(camera),b=p.clone();b.y+=1;b.project(camera);return Math.max(0.005,Math.abs(a.y-b.y)*r.height/2/1000)};
  host.addEventListener('pointerdown',e=>{if(e.target!==cv)return;if(tool!=='su-push'||!is3D||WALK.on||e.button!==0)return;e.stopImmediatePropagation();e.preventDefault();
    if(SU.pp){suPPCommit();return}const h=pick(e);if(!h){toast('Press on an item, a wall or a floor');return}const t=suPPTarget(h.o,h.wall);if(!t)return;if(suChip)suChip.hidden=true;
    if(T3.controls)T3.controls.enabled=false;suPPStart(t,e,ppm(h.p));SU.pp.down=[e.clientX,e.clientY];try{cv.setPointerCapture(e.pointerId)}catch(_){}},true);
  host.addEventListener('pointermove',e=>{const p=SU.pp;if(!p||!is3D||tool!=='su-push')return;e.stopImmediatePropagation();let v=p.v0+(p.y0-e.clientY)/p.ppm;const st=e.altKey?10:50;v=Math.round(v/st)*st;if(Math.abs(e.clientY-p.y0)>3)p.moved=true;if(v!==p.t.get())suPPSet(v)},true);
  host.addEventListener('pointerup',e=>{const p=SU.pp;if(!p||tool!=='su-push')return;e.stopImmediatePropagation();if(p.down&&Math.hypot(e.clientX-p.down[0],e.clientY-p.down[1])>6){suPPCommit()}else{p.armed=true;p.down=null;updateHint()}},true);
})();
/* 2D: click what to set, then type the height */
svg.addEventListener('pointerdown',ev=>{if(tool!=='su-push'||ev.button!==0||spaceDown)return;if(ev.pointerType==='touch'){if(pointers.size>0)return;pointers.set(ev.pointerId,[ev.clientX,ev.clientY,performance.now()])}ev.stopImmediatePropagation();ev.preventDefault();const el=ev.target.closest&&ev.target.closest('[data-id]');const o=el?byId(el.dataset.id):null;const t=suPPTarget(o,false);if(!t){if(!o)toast('Click an item, a room or a wall');return}
  sel=new Set([o.id]);SU.last={kind:'pp',t,ids:t.ids,copies:[],v:t.get()};SU.last.sig=suSig();SU.last.pl=-1;render();renderInspector();updateHint();vcbSync();suChipFor()},true);
/* Settings › Keys and tools: switch between StoreyBook's keys and SketchUp's */
(()=>{const pop=$('#pop-set');if(!pop)return;const h=pop.querySelector('h3');const box=document.createElement('div');
  box.innerHTML='<div class="grp">Keys and tools</div><div class="set"><span>Key bindings</span><select id="s-keys" aria-label="Key bindings"><option value="su">SketchUp</option><option value="sb">StoreyBook</option></select></div><div class="set"><span>SketchUp keys and tools</span><button class="btn sm" type="button" id="s-keys-sheet">Show…</button></div>';
  box.innerHTML+='<div class="grp">3D view</div><div class="set"><span>Smooth edges in 3D</span><label class="sw"><input type="checkbox" id="s-aa" aria-label="Smooth edges in 3D"><span></span></label></div><div class="grp">Help</div><div class="set"><span>Offer the tutorial on an empty plan</span><label class="sw"><input type="checkbox" id="s-tut" aria-label="Offer the tutorial on an empty plan"><span></span></label></div>';
  h.after(...box.childNodes);{const aa=$('#s-aa');aa.checked=!!P.aa3d;aa.title='Smoother edges, slower 3D. Off by default';
    /* the browser fixes edge smoothing when the 3D view is first made, so a change after that needs the page loaded again (every plan is autosaved) */
    aa.addEventListener('change',()=>{P.aa3d=aa.checked;savePrefs();if(!T3){toast(P.aa3d?'Smooth edges on':'Smooth edges off: 3D draws faster');return}if(confirm('Smooth edges '+(P.aa3d?'on':'off')+'.\n\nThe 3D view picks this up when the page loads. Reload now? Your plans are autosaved.'))location.reload();else toast('It takes effect the next time the page loads')})}
  {const tt=$('#s-tut');tt.checked=P.tutCta!==false;tt.addEventListener('change',()=>{if(tt.checked)delete P.tutCta;else P.tutCta=false;savePrefs();tutCta();toast(tt.checked?'An empty plan offers the tutorial again':'The tutorial is still in the ⋮ menu')})}
  const sl=$('#s-keys');const sync=()=>{sl.value=suOn()?'su':'sb';$('#s-tut').checked=P.tutCta!==false};sync();
  sl.addEventListener('change',()=>{P.suKeys=sl.value==='su';P.suWelcome=1;savePrefs();suCancelAll();suTips();updateHint();vcbSync();toast(P.suKeys?'SketchUp keys and tools: L walls, R rectangle, M move, Q rotate, E eraser, Space select':'StoreyBook keys: W walls, D room, M measure, R turns 90°, V select')});
  $('#s-keys-sheet').addEventListener('click',()=>suSheetOpen(false));
  new MutationObserver(()=>{if(!pop.hidden)sync()}).observe(pop,{attributes:true,attributeFilter:['hidden']})})();
/*@su-end*/
/* ================= Tutorial =================
   More › Tutorial (also in the command search and on the SketchUp welcome card). Six short chapters that design one small office,
   12 m by 8 m, and use every tool on the way. It runs in its own plan tab, so no real plan is touched.
   Each step says what to do, rings the button to press, draws a dashed guide on the plan where it helps, and moves on by itself
   once the thing has actually been done. "Do it for me" does a step for anyone who is stuck; a chapter can be started on its own
   (what earlier chapters would have drawn is put in first). Finished chapters are remembered in the settings (P.tut). */
var TUT={on:false,ch:0,i:0,pid:null,b:null,f:{},wait:false,el:null,ring:null,timer:null,moved:false};
const tN=f=>S.objs.filter(f).length,tRooms=()=>tN(o=>o.t==='room'),tWalls=()=>tN(o=>o.t==='wall'&&!o.site),tSites=()=>tN(isSite),tCat=c=>tN(o=>o.t==='item'&&o.cat===c),tType=t=>tN(o=>o.t===t);
const tLib=f=>LIB.find(l=>!l.missing&&f(l)),tPut=(l,x,y,r)=>{if(l)addObjs([itemFromLib(l,x,y,r||0)],true)};
const tPoly=(t,pts)=>{setTool(t);polyPts=pts.map(p=>p.slice());finishPoly(false);setTool('select')};
const tBig=()=>S.objs.filter(o=>o.t==='room').sort((a,b)=>Math.abs(polyArea(b.pts))-Math.abs(polyArea(a.pts)))[0];
const tDesk=()=>S.objs.find(o=>o.t==='item'&&o.cat==='Workstation')||S.objs.find(o=>o.t==='item'&&!isOpening(o)&&!isSite(o)&&!isCeil(o));
const tK=(k,txt)=>suOn()?` (key <kbd>${k}</kbd>)`:(txt||'');
const tLast=k=>b=>!!SU.last&&SU.last.kind===k&&SU.last!==b;
const tColSig=()=>JSON.stringify(S.objs.map(o=>[o.col,o.floorCol,o.wallCol,o.faces]));
/* dashed guides on the plan, in plan millimetres */
const tgRect=(x0,y0,x1,y1,l)=>`<rect class="tutg" x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}"/>`+tgLab((x0+x1)/2,y0-fs(10),l);
const tgLine=(a,b,l)=>`<line class="tutg" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><circle class="tutd" cx="${a[0]}" cy="${a[1]}" r="${fs(5)}"/><circle class="tutd" cx="${b[0]}" cy="${b[1]}" r="${fs(5)}"/>`+tgLab((a[0]+b[0])/2,(a[1]+b[1])/2-fs(10),l);
const tgDot=(p,l)=>`<circle class="tutg" cx="${p[0]}" cy="${p[1]}" r="${fs(14)}"/><circle class="tutd" cx="${p[0]}" cy="${p[1]}" r="${fs(4)}"/>`+tgLab(p[0],p[1]-fs(20),l);
const tgLab=(x,y,l)=>l?`<text class="tutt" x="${x}" y="${y}" font-size="${fs(12)}" stroke-width="${fs(3)}" text-anchor="middle">${esc(l)}</text>`:'';
function tutSVG(){if(!TUT.on||TUT.wait||S.pid!==TUT.pid||is3D)return'';const st=tutStep();try{return st&&st.ghost?st.ghost():''}catch(e){return''}}
/* what earlier chapters would have left on the plan */
function tutEnsure(ch){if(is3D)set3D(false);if(P.rcp)setRCP(false,true);if(S.bld&&S.bld.levels.length&&bldLevel(S)!==S.bld.levels.find(l=>l.kind!=='B'))switchFloor(S.bld.levels.find(l=>l.kind!=='B').id);setTool('select');sel=new Set();
  const add=[];if(ch>0){if(!S.objs.some(o=>o.t==='room'&&Math.abs(polyArea(o.pts))>=4e7))add.push({id:uid(),t:'room',name:'Office',pts:rectP(0,0,12000,8000),gid:null});
    if(!tWalls())add.push({id:uid(),t:'wall',pts:[[8000,0],[8000,8000]],th:newWallTh(),closed:false,gid:null});
    if(tRooms()+add.filter(o=>o.t==='room').length<2)add.push({id:uid(),t:'room',name:'Meeting',pts:rectP(8000,0,12000,4000),gid:null})}
  if(ch>1&&tCat('Workstation')<3){const l=tLib(x=>x.cat==='Workstation');if(l)for(let i=0;i<4;i++)add.push(itemFromLib(l,1500+i*(l.w+100),2000,0))}
  if(add.length){addObjs(add,false)}fit()}
const TUT_CH=[
 {t:'Draw the shell',d:'Look around, then draw the outside of the office, a partition and a meeting room. Add a dimension and a label.',steps:[
  {h:'Look around',say:()=>`Roll the mouse wheel to zoom. To pan, hold <kbd>Space</kbd> (or the middle button) and drag. On an iPad, pinch and drag with two fingers.`,base:()=>[V.x,V.y,V.k],done:b=>Math.abs(V.k-b[2])>b[2]*0.05||Math.hypot(V.x-b[0],V.y-b[1])*V.k>40,auto:()=>zoomAt(1.25,W/2,H/2)},
  {h:'Draw the office',at:'.dock [data-tool="room"]',say:()=>`Click <b>Room</b>${tK('R')}. Then press at one corner of the dashed outline and drag to the opposite corner. It is 12 m by 8 m.${suOn()?' For an exact size, click one corner, type <kbd>12000,8000</kbd> and press <kbd>Enter</kbd>.':''}`,ghost:()=>tgRect(0,0,12000,8000,'12,000 × 8,000'),base:()=>0,done:()=>S.objs.some(o=>o.t==='room'&&Math.abs(polyArea(o.pts))>=4e7),auto:()=>{addObjs([{id:uid(),t:'room',name:'Office',pts:rectP(0,0,12000,8000),gid:null}],true);setTool('select')}},
  {h:'Fit it to the screen',at:['#pop-more:not([hidden]) #z-fit','#b-more'],say:()=>`Click <b>⋮</b> at the top right, then <b>Fit</b> in the zoom row${tK('Shift+Z')}. It brings the whole plan into view; use it whenever you lose your place.`,done:()=>!!TUT.f.fit,auto:()=>{fit();TUT.f.fit=1}},
  {h:'Add a partition wall',at:'.dock [data-tool="poly"]',say:()=>`Click <b>Walls</b>${tK('L')}. Click the top end of the dashed line, then the bottom end, then press <kbd>Enter</kbd> (or double-click) to finish. Red and green lines show when you are square to the axes.`,ghost:()=>tgLine([8000,0],[8000,8000],'partition'),base:tWalls,done:b=>tWalls()>b,auto:()=>tPoly('poly',[[8000,0],[8000,8000]])},
  {h:'Draw the meeting room',at:'.dock [data-tool="room"]',say:()=>`Click <b>Room</b> again and drag over the dashed square in the top right corner. Rooms are what the area, fire and cost checks count.`,ghost:()=>tgRect(8000,0,12000,4000,'4,000 × 4,000'),base:tRooms,done:b=>tRooms()>b,auto:()=>{addObjs([{id:uid(),t:'room',name:'Room '+(tRooms()+1),pts:rectP(8000,0,12000,4000),gid:null}],true);setTool('select')}},
  {h:'Name the room',say:()=>`Double-click inside the small room, type <kbd>Meeting</kbd> and press <kbd>Enter</kbd>. The name shows on the plan and in the schedule.`,ghost:()=>tgDot([10000,2000],'double-click here'),base:()=>S.objs.filter(o=>o.t==='room').map(o=>o.name).join('|'),done:b=>S.objs.filter(o=>o.t==='room').map(o=>o.name).join('|')!==b&&tRooms()===b.split('|').length,auto:()=>{const r=S.objs.filter(o=>o.t==='room').pop();if(r){checkpoint();r.name='Meeting';markDirty();render();renderInspector()}}},
  {h:'Measure it',at:'.dock [data-tool="measure"]',say:()=>`Click <b>Measure</b>, then press at one end of the dashed line and drag to the other. The dimension stays on the plan and follows the drawing.`,ghost:()=>tgLine([0,8700],[12000,8700],'measure here'),base:()=>tType('dim'),done:b=>tType('dim')>b,auto:()=>{addObjs([{id:uid(),t:'dim',a:[0,8700],b:[12000,8700],gid:null}],false);setTool('select')}},
  {h:'Write a label',at:'.dock [data-tool="text"]',say:()=>`Click <b>Text</b>, then click in the big room. Type what it should say in the box that opens on the right.`,ghost:()=>tgDot([4000,7000],'click here'),base:()=>tType('text'),done:b=>tType('text')>b,auto:()=>{addObjs([{id:uid(),t:'text',x:4000,y:7000,text:'Open office',size:300,gid:null}],true);setTool('select')}}]},
 {t:'Doors, windows and furniture',d:'Open the library, put in a door, a window and a row of desks, look at an item\'s details and paint a floor.',steps:[
  {h:'Open the library',at:'#t-lib',enter:()=>{if(P.lib){P.lib=false;savePrefs();applyDrawers()}},say:()=>`Click <b>Library</b>${tK('K')}. Everything you can place is in here, grouped by discipline, with a search box at the top.`,done:()=>!!P.lib,auto:()=>{P.lib=true;savePrefs();applyDrawers()}},
  {h:'Put in a door',say:()=>`Type <kbd>door</kbd> in the library search and click a door. Then click on the partition wall near the dashed circle. <kbd>R</kbd> turns it before you place it. Press <kbd>Esc</kbd> when you are done placing.`,ghost:()=>tgDot([8000,6000],'door here'),base:()=>tCat('Door'),done:b=>tCat('Door')>b,auto:()=>tPut(tLib(l=>l.cat==='Door'),8000,6000,90)},
  {h:'Put in a window',say:()=>`Search <kbd>window</kbd>, click one, and click on the top wall of the office near the dashed circle. Doors and windows snap onto walls.`,ghost:()=>tgDot([4000,0],'window here'),base:()=>tCat('Window'),done:b=>tCat('Window')>b,auto:()=>tPut(tLib(l=>l.cat==='Window'),4000,0,0)},
  {h:'Fill a row of desks',say:()=>`Search <kbd>workstation</kbd> and click one. Then press in the big room and drag sideways: a whole row fills in as you drag. A single click places just one.`,ghost:()=>tgLine([1500,2000],[6500,2000],'drag along here'),base:()=>tCat('Workstation'),done:b=>tCat('Workstation')>=b+2,auto:()=>{const l=tLib(x=>x.cat==='Workstation');if(l)addObjs([0,1,2,3].map(i=>itemFromLib(l,1500+i*(l.w+100),2000,0)),true);setTool('select')}},
  {h:'Look at an item',at:'.dock [data-tool="select"]',say:()=>`Click <b>Select</b>${tK('Space')}, then click one desk. The panel on the right shows its size, height, label and colour, and every number there can be typed over.`,enter:()=>{sel=new Set();openInsp();showTab('sel');render();renderInspector()},done:()=>sel.size===1&&!!P.insp&&selList()[0].t==='item',auto:()=>{const o=tDesk();if(o){setTool('select');setSel([o.id]);openInsp();showTab('sel')}}},
  {h:'Paint a floor',at:'.dock [data-tool="paint"]',say:()=>`Click <b>Paint</b>${tK('B')}, pick a colour from the strip that appears, and click the floor of the meeting room. Walls, doors and furniture take paint the same way, in 2D and 3D.`,base:tColSig,done:b=>tColSig()!==b,auto:()=>{const r=S.objs.filter(o=>o.t==='room').pop();if(r){checkpoint();r.floorCol='#d9c7a7';markDirty();render()}setTool('select')}}]},
 {t:'Move, copy and change',d:'Move a desk an exact distance, make copies, turn, scale, offset an outline, pull out a guide, erase and undo.',steps:[
  {h:'Move a desk',at:'.dock [data-tool="su-move"]',say:()=>`Click <b>Move</b>${tK('M')}. Click a desk to pick it up, move the pointer, and click again to put it down. Straight after, type <kbd>1000</kbd> and <kbd>Enter</kbd> to make the move exactly 1,000 mm.`,base:()=>SU.last,done:b=>!!SU.last&&SU.last.kind==='move'&&!SU.last.copy&&SU.last!==b,auto:()=>{const o=tDesk();if(!o)return;setTool('su-move');suMoveStart([o],[o.x,o.y]);suMoveApply([0,1000]);suMoveCommit()}},
  {h:'Make copies',at:'.dock [data-tool="su-move"]',say:()=>`Still in <b>Move</b>: click a desk, tap <kbd>Ctrl</kbd> once (the hint changes to Copy), and click to put the copy down. Then type <kbd>x3</kbd> and <kbd>Enter</kbd> for three copies the same distance apart.`,base:()=>SU.last,done:b=>!!SU.last&&SU.last.kind==='move'&&!!SU.last.copy&&(SU.last!==b||!TUT.f.wasCopy),enter:()=>{TUT.f.wasCopy=!!(SU.last&&SU.last.copy)},auto:()=>{const o=tDesk();if(!o)return;setTool('su-move');suMoveStart([o],[o.x,o.y]);suCopyToggle();suMoveApply([0,1200]);suMoveCommit()}},
  {h:'Turn it',at:'.dock [data-tool="su-rotate"]',say:()=>`Click <b>Rotate</b>${tK('Q')}. Click a desk (that point is the centre), click again to set a starting direction, then turn and click. It snaps every 15°; or type an angle such as <kbd>90</kbd> and <kbd>Enter</kbd>.`,base:()=>SU.last,done:tLast('rot'),auto:()=>{const o=tDesk();if(!o)return;setTool('su-rotate');suRotStart([o],[o.x,o.y]);suRotRef([o.x+1000,o.y]);suRotApply(90);suRotCommit()}},
  {h:'Scale it',tool:'su-scale',say:()=>`Choose <b>Scale</b>${tK('S')} with the button below. Click a desk and pull away from its centre, then click; or type a factor such as <kbd>1.5</kbd> and <kbd>Enter</kbd>. Plan sizes change, heights stay.`,base:()=>SU.last,done:tLast('sc'),auto:()=>{const o=tDesk();if(!o)return;setTool('su-scale');suScaleStart([o],[o.x+o.w/2,o.y]);suScaleApply(1.5);suScaleCommit()}},
  {h:'Offset an outline',tool:'su-offset',say:()=>`Choose <b>Offset</b>${tK('F')}. Click the meeting room, move the pointer inward and click. A second outline appears a set distance inside; type <kbd>500</kbd> and <kbd>Enter</kbd> to make it exactly 500 mm. The original stays.`,base:()=>SU.last,done:tLast('off'),auto:()=>{const r=S.objs.filter(o=>o.t==='room').sort((a,b)=>Math.abs(polyArea(a.pts))-Math.abs(polyArea(b.pts)))[0];if(!r)return;setTool('su-offset');suOffStart(r);suOffPreview(-500);suOffCommit()}},
  {h:'Pull out a guide line',tool:'su-tape',say:()=>`Choose <b>Tape measure</b>${tK('T')}. Click on the top wall of the office and move down: a dashed guide follows, parallel to the wall. Click to leave it, or type <kbd>2000</kbd> and <kbd>Enter</kbd>. Guides snap, and are saved with the plan.`,base:()=>(S.guides||[]).length,done:b=>(S.guides||[]).length>b,auto:()=>{setTool('su-tape');SU.tp={base:[[0,0],[12000,0]],d:2000};suTapeCommit()}},
  {h:'Erase something',at:'.dock [data-tool="su-erase"]',say:()=>`Click <b>Eraser</b>${tK('E')} and click the inner outline you just made with Offset. You can also drag across several things. A room erased this way leaves its contents behind.`,base:()=>S.objs.length,done:b=>S.objs.length<b,auto:()=>{const o=S.objs.filter(x=>x.t==='room').pop();if(o){sel=new Set([o.id]);deleteSel(false)}}},
  {h:'Undo and redo',at:'#b-undo',say:()=>`Click <b>Undo</b> (<kbd>Ctrl+Z</kbd>): the outline comes back. Then click <b>Redo</b> next to it (<kbd>Ctrl+Y</kbd>). Every step can be taken back, all the way to the start.`,done:()=>{if(future.length)TUT.f.undid=1;return !!TUT.f.undid&&!future.length},auto:()=>{undo();TUT.f.undid=1;redo()}}]},
 {t:'Round rooms, curves and the ceiling',d:'Draw a round room, a curved wall and a shape of your own, then switch to the ceiling plan for a light and trunking, and use Layers.',steps:[
  {h:'A round room',tool:'su-circle',say:()=>`Choose <b>Circle</b>${tK('C')}. Click the centre at the dashed circle, move out and click for the radius, or type <kbd>1200</kbd> and <kbd>Enter</kbd>. It is a room like any other, so the checks see it.`,ghost:()=>tgDot([10000,6000],'centre here'),base:tRooms,done:b=>S.objs.filter(o=>o.t==='room'&&o.pts.length>=8).length>(TUT.f.r8||0),enter:()=>{TUT.f.r8=S.objs.filter(o=>o.t==='room'&&o.pts.length>=8).length},auto:()=>{SU.lastShape={k:'circle',c:[10000,6000],r:1200,n:24,a0:0};suRoomAdd(suCirPts([10000,6000],1200,24,0),'Round room');setTool('select')}},
  {h:'A curved wall',at:'.dock [data-tool="spline"]',say:()=>`Click <b>Curve</b>. Click three or four points in the big room along the dashed line and press <kbd>Enter</kbd>: the wall bends smoothly through them.`,ghost:()=>tgLine([1000,6500],[4000,6500],'curve through here'),base:tWalls,done:b=>tWalls()>b,auto:()=>tPoly('spline',[[1000,6500],[2500,5800],[4000,6500]])},
  {h:'A shape of your own',at:'#t-shape',say:()=>`Click <b>Shape</b>, choose Rectangle, and drag a small box in the big room. It is a custom item: give it a name, a height and a colour on the right, for anything the library does not have.`,ghost:()=>tgRect(5000,6000,6500,7000,''),base:()=>tN(o=>o.t==='item'&&o.code==='CUSTOM'),done:b=>tN(o=>o.t==='item'&&o.code==='CUSTOM')>b,auto:()=>{setTool('shape-rect');rectFinish([5000,6000],[6500,7000])}},
  {h:'Go to the ceiling plan',at:'#t-rcp',say:()=>`Click <b>Ceiling</b>. Furniture fades, and lights, cameras and services become the things you work on.`,done:()=>!!P.rcp,auto:()=>setRCP(true,true)},
  {h:'Hang a light',say:()=>`The library now shows ceiling items. Click a light and click in the big room to place it.`,enter:()=>{if(!P.lib){P.lib=true;savePrefs();applyDrawers()}},ghost:()=>tgDot([3000,3500],'light here'),base:()=>tCat('Ceiling'),done:b=>tCat('Ceiling')>b,auto:()=>tPut(tLib(l=>l.cat==='Ceiling'&&!/^cctv/.test(l.shape)),3000,3500,0)},
  {h:'Run some trunking',at:'.dock [data-tool="trunk"]',say:()=>`Click <b>Trunk</b>, click at each end of the dashed line and press <kbd>Enter</kbd>. Cable trunking and ducts hang below the ceiling and show in 3D.`,ghost:()=>tgLine([500,7600],[7500,7600],'trunking'),base:()=>tType('trunk'),done:b=>tType('trunk')>b,auto:()=>tPoly('trunk',[[500,7600],[7500,7600]])},
  {h:'Back to the floor plan',at:'#t-rcp',say:()=>`Click <b>Ceiling</b> again to go back to the floor plan.`,done:()=>!P.rcp,auto:()=>setRCP(false,true)},
  {h:'Layers',at:'#t-layers',say:()=>`Click <b>${suOn()?'Tags':'Layers'}</b> and switch Furniture off, then on again. Each kind of thing can be hidden while you work on the rest; hidden things are left out of the checks.`,base:()=>JSON.stringify([P.layers,P.hideCats]),done:b=>{const s=JSON.stringify([P.layers,P.hideCats]);if(s!==b)TUT.f.lay=1;return !!TUT.f.lay&&s===b},auto:()=>{TUT.f.lay=1;closePops()}}]},
 {t:'Floors and the site',d:'Turn the plan into a building with a second floor, move between floors, and add a road, a fence and north.',steps:[
  {h:'Open Floors',at:'#tab-bld',enter:()=>{openInsp();showTab('sel')},say:()=>`In the panel on the right, click the <b>Floors</b> tab. This is where a plan becomes a building: floor heights, slabs, basements and the roof.`,done:()=>!$('#p-bld').hidden&&!!P.insp,auto:()=>showTab('bld',true)},
  {h:'Add a floor',at:'#p-bld [data-bb="addL"]',say:()=>`Click <b>+ Floor on top</b>. The new floor repeats this one (a typical floor) until you change it.`,base:()=>S.bld?S.bld.levels.length:1,done:b=>!!S.bld&&S.bld.levels.length>b,auto:()=>{showTab('bld',true);const x=$('#p-bld [data-bb="addL"]');if(x)x.click()}},
  {h:'Move between floors',at:'#b-floor',say:()=>`Use the floor button at the top (or <kbd>PageUp</kbd> and <kbd>PageDown</kbd>) to go up to L2, then come back to L1.`,done:()=>{if(!S.bld)return false;const g=S.bld.levels.find(l=>l.kind!=='B'),here=bldLevel(S);if(here!==g)TUT.f.up=1;return !!TUT.f.up&&here===g},auto:()=>{const L=S.bld.levels.filter(l=>l.kind!=='B');if(L[1])switchFloor(L[1].id);TUT.f.up=1;switchFloor(L[0].id)}},
  {h:'A road',at:'.dock [data-tool="road"]',say:()=>`Click <b>Road</b>, click at each end of the dashed line below the building and press <kbd>Enter</kbd>. Roads, fences and landscape belong to the site and show on the ground floor.`,box:[-4500,-4000,16500,15000],ghost:()=>tgLine([-3000,12500],[15000,12500],'road'),base:tSites,done:b=>tSites()>b,auto:()=>tPoly('road',[[-3000,12500],[15000,12500]])},
  {h:'A fence',at:'.dock [data-tool="fence"]',say:()=>`Click <b>Fence</b> and click round the corners of the dashed line, then press <kbd>Enter</kbd>.`,box:[-4500,-4000,16500,15000],ghost:()=>tgLine([-2500,-2500],[14500,-2500],'fence')+tgLine([14500,-2500],[14500,8500],''),base:tSites,done:b=>tSites()>b,auto:()=>tPoly('fence',[[-2500,-2500],[14500,-2500],[14500,8500]])},
  {h:'Set north',at:'#north',say:()=>`Drag the north arrow to turn it; double-click sets it back to up. North drives the sun and shadows in 3D.`,base:()=>num(S.north,0),done:b=>num(S.north,0)!==b,auto:()=>setNorth(30)}]},
 {t:'3D, checks and saving',d:'See the building in 3D, pull a height, turn on the sun, walk through, cut a section, run the checks, leave a comment and save.',steps:[
  {h:'Go to 3D',at:'#v3d',say:()=>`Click <b>3D</b> at the top (<kbd>Tab</kbd> switches back and forth).`,done:()=>is3D&&!bldView&&!!T3,auto:()=>set3D(true)},
  {h:'Orbit',say:()=>`Drag on the floor to orbit, roll the wheel to zoom, and drag with the right button to pan.`,done:()=>{if(!T3)return false;const p=T3.camera.position;if(!TUT.f.cam){TUT.f.cam=[p.x,p.y,p.z];return false}return Math.hypot(p.x-TUT.f.cam[0],p.y-TUT.f.cam[1],p.z-TUT.f.cam[2])>T3.span*0.05},auto:()=>{if(!T3)return;const p=T3.camera.position;if(!TUT.f.cam)TUT.f.cam=[p.x,p.y,p.z];p.x+=T3.span*0.3;p.z-=T3.span*0.15;T3.controls.update();T3.need=true}},
  {h:'Pull a height',at:'.dock [data-tool="su-push"]',say:()=>`Click <b>Push/Pull</b>${tK('P')}. Press on a desk and drag upward, then let go: its height changes. On a wall or floor the same pull sets the floor-to-ceiling height. A typed value and <kbd>Enter</kbd> sets it exactly.`,base:()=>SU.last,done:tLast('pp'),auto:()=>{const o=tDesk();if(!o)return;setTool('su-push');const t=suPPTarget(o,false);if(!t)return;suPPStart(t,null,1);suPPSet(1100);suPPCommit();if(suChip)suChip.hidden=true}},
  {h:'Turn on the sun',at:'#v3-sun',say:()=>`Click <b>Sun</b> in the bar at the top of the 3D view. Pick a date and drag the time: shadows follow, using the north you set.`,enter:()=>setTool('select'),done:()=>SUN.on,auto:()=>{const b=$('#v3-sun');if(b&&!SUN.on)b.click()}},
  {h:'Walk through',at:'#b-walk',say:()=>`Click <b>Walk</b> at the top, then click on the plan where you want to stand. Move with <kbd>W A S D</kbd> or the arrow keys and look round with the mouse.`,enter:()=>{if(SUN.on){const b=$('#v3-sun');if(b)b.click()}},done:()=>WALK.on,auto:()=>walkStart({pos:[4000,4500],yaw:0})},
  {h:'Leave the walk',at:'#b-walk',say:()=>`Click <b>Walk</b> again (or <b>Exit walk</b>) to come out.`,done:()=>!WALK.on,auto:()=>walkStop()},
  {h:'Cut a section',at:'.dock [data-tool="section"]',say:()=>`Click <b>Section</b> (it takes you back to the plan) and drag a line right across the building along the dashed line. In 3D the building is then sliced along it.`,ghost:()=>tgLine([-500,4000],[12500,4000],'section line'),enter:()=>{TUT.f.sec=S.section?JSON.stringify(S.section):''},done:()=>!!S.section&&JSON.stringify(S.section)!==TUT.f.sec,auto:()=>{if(is3D)set3D(false);checkpoint();S.section={a:[-500,4000],b:[12500,4000],on:true,flip:false};markDirty();setTool('select');render()}},
  {h:'See the whole building',at:'#vbld',say:()=>`Click <b>Building</b> at the top: every floor stacked, with the site round it. Click a floor there to open it.`,done:()=>bldView,auto:()=>{const b=$('#vbld');if(b)b.click()}},
  {h:'Back to the plan',at:'#v2d',say:()=>`Click <b>2D</b> to go back to the plan.`,done:()=>!is3D,auto:()=>{const b=$('#v2d');if(b)b.click()}},
  {h:'Run the checks',at:'#tab-fire',enter:()=>{openInsp();showTab('sel')},say:()=>`In the panel on the right, click <b>Checks</b>. Clashes, clearances, exits and the rest are all listed in one place, and each row takes you to the problem on the plan.`,done:()=>!$('#p-fire').hidden&&!!P.insp,auto:()=>showTab('fire',true)},
  {h:'Leave a comment',at:'.dock [data-tool="pin"]',say:()=>`Click <b>Pin</b> and click anywhere on the plan. A numbered pin drops, and you type the comment in the Review tab. Use pins for questions to the team.`,base:()=>(S.pins||[]).length,done:b=>(S.pins||[]).length>b,auto:()=>{checkpoint();S.pins=S.pins||[];S.pins.push(newPin(4000,4500));markDirty();setTool('select');render()}},
  {h:'Save your work',at:'#b-save',next:true,say:()=>`Plans are saved in this browser as you go. <b>Save</b> writes a file you can keep, send or open on another machine. That is every tool: you have drawn, fitted out, checked and walked through a building.`}]}];
/* an empty plan offers the tutorial, with an x to put the offer away for good (it stays in the ⋮ menu). Not on phones, not once every chapter is done.
   Under the test hook it shows only when a test asks for it, so the gate's pictures of an empty plan stay as they are */
let tutCtaEl=null,tutCtaOn=null;
function tutCta(){if(!TUT)return;const want=!TUT.on&&P.tutCta!==false&&(TUT.cta||!location.hash.endsWith('-debug'))&&!is3D&&!WALK.on&&!S.objs.length&&!(S.underlay&&S.underlay.src)&&!PHONE()&&Object.keys(tutDone()).length<TUT_CH.length;
  if(want===tutCtaOn)return;tutCtaOn=want;if(!tutCtaEl){if(!want)return;const e=tutCtaEl=document.createElement('div');e.id='tut-cta';e.innerHTML='<button type="button" class="btn primary" data-c="go">Tutorial</button><span>New here? Design a small office and learn every tool.</span><button type="button" class="btn icon ghost sm" data-c="x" aria-label="Do not offer the tutorial again" title="Do not offer this again (it stays in the ⋮ menu)">✕</button>';$('#main').appendChild(e);
    e.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;if(b.dataset.c==='go')tutOpen();else{P.tutCta=false;savePrefs();tutCta();toast('The tutorial is still in the ⋮ menu')}})}
  tutCtaEl.hidden=!want}
function tutStep(){const c=TUT_CH[TUT.ch];return c&&c.steps[TUT.i]}
function tutDone(){return (P.tut&&P.tut.done)||{}}
/* the chapter list */
function tutOpen(){if(PHONE()){toast('The tutorial needs a larger screen (a tablet or a computer). Here is the user guide instead.');openGuide();return}
  let m=$('#tut-menu');if(!m){m=document.createElement('div');m.id='tut-menu';m.className='keys-modal';m.hidden=true;m.setAttribute('data-keep','');m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','tut-mh');document.body.appendChild(m);
    m.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.tc==='x'){m.hidden=true;return}if(b.dataset.tc!=null){m.hidden=true;tutStart(+b.dataset.tc)}})}
  const dn=tutDone(),nx=TUT_CH.findIndex((c,i)=>!dn[i]);
  m.innerHTML=`<div class="keys-card" style="height:auto;max-width:520px"><div class="keys-head"><h3 id="tut-mh">Tutorial: design a small office</h3><span style="flex:1"></span><button class="btn icon ghost sm" type="button" data-tc="x" aria-label="Close">✕</button></div><div style="padding:12px 16px 16px;max-height:70vh;overflow:auto">
    <p class="muted" style="margin:0 0 10px">Six short chapters, a few minutes each. You draw one small office and use every tool on the way. It opens in its own plan tab, so your plans are not touched. Each step waits until you have done it; <b>Do it for me</b> does a step for you.</p>
    ${TUT_CH.map((c,i)=>`<button type="button" class="tut-ch" data-tc="${i}"><span class="n${dn[i]?' ok':''}">${dn[i]?'✓':i+1}</span><span><b>${esc(c.t)}</b><br><span class="muted">${esc(c.d)}</span></span><span class="go">${dn[i]?'Again':i===nx?'Start':'Open'}</span></button>`).join('')}</div></div>`;
  m.hidden=false;setTimeout(()=>{const b=m.querySelector(`[data-tc="${nx<0?0:nx}"]`);if(b)b.focus()},0)}
function tutStart(ch){closePops();if(WALK.on)walkStop(true);
  /* its own tab: the tutorial tab if it is still open, else a new one */
  const t=TUT.pid&&tabs.find(x=>(x===curTab?S:x.S).pid===TUT.pid);if(t){if(t!==curTab)applyTab(t)}else{newTab(Object.assign(blankPlan(),{name:'Tutorial: small office'}));TUT.pid=S.pid}
  /* both drawers shut to give the plan room; the steps that need one open it */if(!TUT.on)TUT.pre={lib:!!P.lib,insp:!!P.insp};if(P.lib||P.insp){P.lib=false;P.insp=false;savePrefs();applyDrawers()}
  TUT.on=true;TUT.ch=ch;TUT.wait=false;tutEnsure(ch);tutCard();tutGo(0);if(!TUT.timer)TUT.timer=setInterval(tutTick,300)}
function tutExit(){if(!TUT.on)return;TUT.on=false;clearInterval(TUT.timer);TUT.timer=null;if(TUT.el)TUT.el.hidden=true;if(TUT.ring)TUT.ring.hidden=true;/* the drawers go back to how they were before the tutorial */if(TUT.pre&&!PHONE()){P.lib=TUT.pre.lib;P.insp=TUT.pre.insp;savePrefs();applyDrawers()}render()}
function tutGo(i){const c=TUT_CH[TUT.ch];TUT.wait=false;TUT.f={};
  if(i>=c.steps.length){P.tut=P.tut||{done:{}};P.tut.done=P.tut.done||{};P.tut.done[TUT.ch]=1;savePrefs();TUT.i=c.steps.length;tutDraw();render();return}
  TUT.i=i;const st=c.steps[i];try{if(st.enter)st.enter()}catch(e){console.warn(e)}try{TUT.b=st.base?st.base():null}catch(e){TUT.b=null}
  /* bring the dashed guide into view, clear of the drawers */if(st.ghost&&!is3D){const q=st.box||[-1500,-1800,13500,10200];/* with spare ground on the left, where this card sits */try{fitBox({x0:q[0]-(TUT.moved?0:(q[2]-q[0])*0.45),y0:q[1],x1:q[2],y1:q[3]})}catch(e){}}tutDraw();render()}
function tutAuto(){const st=tutStep();if(!st||TUT.wait)return;try{if(st.auto)st.auto()}catch(e){console.warn(e)}if(st.next||!st.done)tutGo(TUT.i+1);else tutTick()}
function tutCard(){if(TUT.el)return;const el=TUT.el=document.createElement('div');el.id='tut';el.setAttribute('role','region');el.setAttribute('aria-label','Tutorial');el.setAttribute('aria-live','polite');$('#main').appendChild(el);
  TUT.ring=document.createElement('div');TUT.ring.id='tut-ring';TUT.ring.hidden=true;document.body.appendChild(TUT.ring);
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.ta;if(a==='x')tutExit();else if(a==='auto')tutAuto();else if(a==='next')tutGo(TUT.i+1);else if(a==='back'){if(TUT.i>0)tutGo(TUT.i-1)}else if(a==='tool'){const st=tutStep();if(st&&st.tool)setTool(st.tool)}else if(a==='menu'){tutExit();tutOpen()}else if(a==='nextch')tutStart(TUT.ch+1)});
  /* the card can be dragged out of the way by its top bar */
  let d=null;el.addEventListener('pointerdown',e=>{if(!e.target.closest('.th')||e.target.closest('button'))return;const r=el.getBoundingClientRect(),m=$('#main').getBoundingClientRect();d={x:e.clientX-(r.left-m.left),y:e.clientY-(r.top-m.top)};el.setPointerCapture(e.pointerId);e.preventDefault()});
  el.addEventListener('pointermove',e=>{if(!d)return;const m=$('#main').getBoundingClientRect();TUT.moved=true;el.style.left=Math.max(4,Math.min(m.width-el.offsetWidth-4,e.clientX-d.x))+'px';el.style.top=Math.max(4,Math.min(m.height-el.offsetHeight-4,e.clientY-d.y))+'px';el.style.bottom='auto'});
  const up=()=>{d=null};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  /* fit, and any other step that is simply a press of one button */
  }
function tutDraw(){const el=TUT.el;if(!el)return;const c=TUT_CH[TUT.ch],n=c.steps.length,st=c.steps[TUT.i];el.hidden=false;
  if(S.pid!==TUT.pid){el.innerHTML=`<div class="th"><b>Tutorial paused</b><span style="flex:1"></span><button type="button" class="btn icon ghost sm" data-ta="x" aria-label="Leave the tutorial">✕</button></div><div class="tb"><p>The tutorial is waiting in its own tab, <b>Tutorial: small office</b>. Switch back to that tab to carry on.</p></div>`;return}
  if(!st){const last=TUT.ch>=TUT_CH.length-1;el.innerHTML=`<div class="th"><b>${esc(c.t)}</b><span style="flex:1"></span><button type="button" class="btn icon ghost sm" data-ta="x" aria-label="Leave the tutorial">✕</button></div><div class="tb"><h4>✓ Chapter ${TUT.ch+1} done</h4><p>${last?'That is the whole tutorial. The plan in this tab is yours to keep playing with, and <b>More › Tutorial</b> brings any chapter back.':'Next: <b>'+esc(TUT_CH[TUT.ch+1].t)+'</b>. '+esc(TUT_CH[TUT.ch+1].d)}</p></div><div class="tf"><button type="button" class="btn sm ghost" data-ta="menu">Chapters</button><span style="flex:1"></span>${last?'<button type="button" class="btn sm primary" data-ta="x">Finish</button>':'<button type="button" class="btn sm primary" data-ta="nextch">Next chapter</button>'}</div><div class="tp"><i style="width:100%"></i></div>`;return}
  el.innerHTML=`<div class="th"><b>${TUT.ch+1}. ${esc(c.t)}</b><span class="muted">${TUT.i+1} / ${n}</span><span style="flex:1"></span><button type="button" class="btn icon ghost sm" data-ta="x" aria-label="Leave the tutorial">✕</button></div>
    <div class="tb"><h4>${TUT.wait?'✓ ':''}${esc(st.h)}</h4><p>${st.say()}</p></div>
    <div class="tf">${TUT.i>0?'<button type="button" class="btn sm ghost" data-ta="back">Back</button>':''}${st.tool?`<button type="button" class="btn sm" data-ta="tool">Choose the tool</button>`:''}<span style="flex:1"></span>${st.next?'<button type="button" class="btn sm primary" data-ta="next">Finish chapter</button>':'<button type="button" class="btn sm" data-ta="auto">Do it for me</button>'}</div><div class="tp"><i style="width:${Math.round(TUT.i/n*100)}%"></i></div>`;
  el.classList.toggle('ok',!!TUT.wait)}
/* every 300 ms: has the step been done? keep the ring on its button and the card clear of the Library drawer */
function tutTick(){if(!TUT.on||!TUT.el)return;const el=TUT.el,paused=S.pid!==TUT.pid;if(paused!==!!TUT.paused){TUT.paused=paused;tutDraw()}
  if(!TUT.moved){const lib=$('#d-lib'),r=lib&&!lib.hidden?lib.getBoundingClientRect():null,m=$('#main').getBoundingClientRect();el.style.left=(r&&r.width?Math.round(r.right-m.left+10):12)+'px'}
  const st=tutStep(),ring=TUT.ring;let tg=null;if(st&&!paused&&!TUT.wait&&st.at){for(const q of [].concat(st.at)){const e=document.querySelector(q);if(!e)continue;const r=e.getBoundingClientRect();if(r.width&&r.height&&r.bottom>0&&r.top<innerHeight){tg=e;break}}}
  if(tg){const r=tg.getBoundingClientRect();ring.hidden=false;ring.style.left=(r.left-5)+'px';ring.style.top=(r.top-5)+'px';ring.style.width=(r.width+10)+'px';ring.style.height=(r.height+10)+'px'}else ring.hidden=true;
  if(!st||paused||TUT.wait||st.next||!st.done)return;let ok=false;try{ok=!!st.done(TUT.b)}catch(e){}
  if(ok){TUT.wait=true;tutDraw();render();const at=[TUT.ch,TUT.i];setTimeout(()=>{if(TUT.on&&TUT.ch===at[0]&&TUT.i===at[1])tutGo(TUT.i+1)},900)}}
(()=>{const st=document.createElement('style');st.textContent=`#tut{position:absolute;left:12px;bottom:96px;z-index:14;width:340px;max-width:calc(100% - 24px);background:var(--panel);border:1px solid var(--accent);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.22);font-size:13px;line-height:1.45}#tut[hidden]{display:none}#tut .th{display:flex;gap:8px;align-items:center;padding:6px 6px 6px 12px;border-bottom:1px solid var(--line);cursor:grab;touch-action:none;user-select:none}#tut .tb{padding:10px 12px 4px}#tut h4{margin:0 0 4px;font-size:14px}#tut p{margin:0 0 8px}#tut kbd{font:inherit;font-size:12px;border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:0 4px;background:var(--bg);white-space:nowrap}#tut .tf{display:flex;gap:6px;align-items:center;padding:4px 10px 10px}#tut .tp{height:3px;background:var(--line);border-radius:0 0 12px 12px;overflow:hidden}#tut .tp i{display:block;height:100%;background:var(--accent);transition:width .3s}#tut.ok h4{color:#1f9d55}#tut-ring{position:fixed;z-index:60;border:3px solid var(--accent);border-radius:12px;pointer-events:none;animation:tutp 1.2s ease-in-out infinite}#tut-ring[hidden]{display:none}#tut-cta{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);z-index:8;display:flex;gap:10px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:8px 8px 8px 10px;font-size:13px;max-width:calc(100% - 24px)}#tut-cta[hidden]{display:none}@keyframes tutp{50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--accent) 28%,transparent)}}@media (prefers-reduced-motion:reduce){#tut-ring{animation:none}}.tutg{fill:color-mix(in srgb,var(--accent) 7%,transparent);stroke:var(--accent);stroke-width:2px;stroke-dasharray:10 8;vector-effect:non-scaling-stroke;pointer-events:none}.tutd{fill:var(--accent);pointer-events:none}.tutt{fill:var(--accent);stroke:var(--bg);paint-order:stroke;font-weight:600;pointer-events:none}.tut-ch{display:flex;gap:12px;align-items:center;width:100%;text-align:left;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--fg);padding:10px 12px;margin:0 0 8px;cursor:pointer;font:inherit;font-size:13px}.tut-ch:hover{border-color:var(--accent)}.tut-ch .n{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);font-weight:600}.tut-ch .n.ok{background:#1f9d55;border-color:#1f9d55;color:#fff}.tut-ch .go{margin-left:auto;flex:none;font-weight:600;color:var(--accent)}`;document.head.appendChild(st);
  /* More › Tutorial, straight after User guide */
  const g=$('#m-guide');if(g){const b=document.createElement('button');b.type='button';b.className='mi';b.id='m-tut';b.innerHTML='<svg class="ic" viewBox="0 0 24 24"><path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11.5V16c0 1.5 2.5 3 5 3s5-1.5 5-3v-4.5"/><path d="M21 9v6"/></svg>Tutorial';g.after(b);b.addEventListener('click',e=>{e.stopPropagation();closePops();tutOpen()})}})();
document.addEventListener('paste',e=>{
  const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='textarea'||e.target.isContentEditable)return;
  const items=[...((e.clipboardData&&e.clipboardData.items)||[])];const im=items.find(i=>i.kind==='file'&&/^image\//.test(i.type));
  e.preventDefault();
  if(im){if(S.underlay&&S.underlay.src){toast('To replace the floor plan with the copied image, use Underlay › Paste image');return}const f=im.getAsFile();if(f){const named=new File([f],'Pasted floor plan.'+(f.type.split('/')[1]||'png').replace('jpeg','jpg'),{type:f.type});loadUnderFile(named);return}}
  pasteClip(true);
});
document.addEventListener('keyup',e=>{const wk=walkKey(e);if(wk)WALK.keys.delete(wk);if(e.key==='Shift'||!e.shiftKey)WALK.keys.delete('shift');if(e.key===' '){if(SU&&suOn()&&spaceDown&&!SU.spaceUsed&&!WALK.on&&!['input','textarea','select'].includes((e.target.tagName||'').toLowerCase())&&!(e.target.matches&&e.target.matches('button:focus-visible,a:focus-visible,summary:focus-visible,[role=button]:focus-visible')))setTool('select');spaceDown=false;svg.style.cursor=tool==='pan'?'grab':(tool==='select'?'default':'crosshair')}});

/* ================= sample floor ================= */
/*@dev-only*/function loadSample(){
  const L=c=>LIB.find(l=>l.code===c)||LIB[0];const objs=[];
  const room=(name,x0,y0,x1,y1)=>objs.push({id:uid(),t:'room',name,pts:rectP(x0,y0,x1,y1),gid:null});
  const put=(code,x,y,r,gid)=>{const o=itemFromLib(L(code),x,y,r||0);o.gid=gid||null;objs.push(o);return o};
  room('Open plan office',0,0,19000,12000);room('Meeting room',19000,0,25000,6000);room('Private office 1',25000,0,30000,4500);room('Private office 2',25000,4500,30000,9000);
  room('Server room',19000,6000,25000,9000);room('Print and copy',19000,9000,25000,12000);room('Store',25000,9000,30000,12000);
  room('Pantry',0,12000,8000,18000);room('Huddle room',8000,12000,13000,18000);room('Lounge',13000,12000,30000,18000);
  for(let p=0;p<3;p++){const yTop=1800+p*3800;for(let c=0;c<8;c++){const x=2200+c*1400;let g=uid();put('WS1470',x,yTop+350,180,g);put('CH-TASK',x,yTop-450,0,g);g=uid();put('WS1470',x,yTop+1050,0,g);put('CH-TASK',x,yTop+1850,180,g)}}
  for(let i=0;i<4;i++)put('LK3',14800+i*900,11400,180);put('MFD',13500,11300,180);
  put('MT2412',22000,3000,0);for(let i=0;i<4;i++){put('CH-MTG',20500+i*1000,2050,0);put('CH-MTG',20500+i*1000,3950,180)}put('WB1860',22000,450,0);
  [0,4500].forEach(oy=>{put('EX1890',27500,oy+1700,180);put('CH-EXEC',27500,oy+900,0);put('CH-VIS',27050,oy+2700,180);put('CH-VIS',27950,oy+2700,180);put('TC9045',27500,oy+4200,180)});
  for(let i=0;i<4;i++)put('RK6010',20300+i*600,7800,180);put('UPS6085',22700,7800,180);put('PAC1790',23900,7800,180);
  put('MFD',19700,10500,270);put('LF9045',21500,11775,180);put('LF9045',22400,11775,180);put('TC9045',23400,11775,180);
  put('MS3024',28500,10500,90);
  put('PC2460',1600,12300,0);put('PS9060',3350,12300,0);put('FR7070',4300,12350,0);put('VM9080',7400,12400,0);put('HT1860',4000,14600,0);
  for(let i=0;i<2;i++){put('CH-STL',3400+i*1200,14000,0);put('CH-STL',3400+i*1200,15200,0)}
  [[2000,16600],[5000,16600]].forEach(([x,y])=>{put('CF7070',x,y,0);put('CH-PAN',x-600,y,270);put('CH-PAN',x+600,y,90)});
  put('MT-R1200',10500,15000,0);[[0,-1],[1,0],[0,1],[-1,0]].forEach(([dx,dy],i)=>put('CH-MTG',10500+dx*850,15000+dy*850,[0,90,180,270][i]));
  put('SF3',17000,16900,180);put('SF3',17000,13600,0);put('CT1050',17000,15250,0);put('ARM',15300,15250,270);put('POD1',27500,15000,0);put('POD4',23500,15000,0);put('PLANT',13500,17500,0);
  put('DR900',19000,4500,270);put('DR900',25000,2250,270);put('DR900',25000,6750,270);put('DR1000',24500,9000,0);put('DR900',25000,10500,270);put('DR1800',10500,12000,0);put('DR900',6000,12000,0);put('DR1800',16500,12000,0);
  S={v:PLAN_V,name:'Sample office floor',objs,underlay:null,locked:false};fileHandle=null;pdfDoc=null;sel.clear();clashDirty=true;$('#pname').value=S.name;syncLock();syncUnder();fit();renderInspector();markDirty();
}/*@end-dev-only*/

/* ================= layers ================= */
const LAYER_DEF=[['walls','Walls and rooms'],['site','Site: roads, fences, outdoor items'],['doors','Doors and windows'],['furn','Furniture'],['labels','Room labels'],['areas','Room areas'],['walldims','Wall dimensions'],['measures','Measurements'],['texts','Text labels'],['zones','Clearance zones'],['gaps','Spacing guides'],['under','Floor plan underlay'],['grid','Grid'],['cgrid','Column grid'],['mig','MIG check'],['secz','Security zones'],['ceil','Ceiling items'],['cover','Coverage and camera views']];
const EYE='<svg class="ic" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYEOFF='<svg class="ic" viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
function renderLayers(){
  let h='';
  LAYER_DEF.forEach(([k,n])=>{const on=LY(k);
    h+=`<div class="ly${on?'':' off'}"><span>${n}</span><button type="button" class="btn icon ghost sm" data-ly="${k}" aria-pressed="${on}" aria-label="${on?'Hide':'Show'} ${n}">${on?EYE:EYEOFF}</button></div>`;
    if(k==='furn'){const cats=[...new Set(LIB.map(l=>l.cat).concat(S.objs.filter(o=>o.t==='item').map(o=>o.cat),S.objs.filter(o=>o.setCat).map(o=>o.setCat)))].filter(c=>c!=='Door'&&c!=='Window'&&c!=='Column'&&c!=='Ceiling'&&c!=='Core');
      cats.forEach(c=>{const con=!P.hideCats.includes(c);h+=`<div class="ly sub${con&&on?'':' off'}"><span>${esc(c)}</span><button type="button" class="btn icon ghost sm" data-lycat="${esc(c)}" aria-pressed="${con}" aria-label="${con?'Hide':'Show'} ${esc(c)}">${con?EYE:EYEOFF}</button></div>`})}
  });
  $('#ly-list').innerHTML=h;
}
function layersChanged(){savePrefs();[...sel].forEach(id=>{const o=byId(id);if(o&&!visible(o))sel.delete(id)});clashDirty=true;renderLayers();render();renderInspector()}
$('#ly-list').addEventListener('click',e=>{const b=e.target.closest('[data-ly],[data-lycat]');if(!b)return;
  if(b.dataset.ly){const k=b.dataset.ly;P.layers[k]=!LY(k)}else{const c=b.dataset.lycat;const i=P.hideCats.indexOf(c);if(i<0)P.hideCats.push(c);else P.hideCats.splice(i,1)}
  layersChanged()});
$('#ly-all').addEventListener('click',()=>{P.layers={};P.hideCats=[];layersChanged()});
$('#t-rcp').addEventListener('click',()=>{if(is3D)set3D(false);setRCP(!P.rcp)});$('#t-rcp').classList.toggle('on',!!P.rcp);
$('#t-layers').addEventListener('click',e=>{e.stopPropagation();const p=$('#pop-layers');const open=p.hidden;closePops();p.hidden=!open;$('#t-layers').classList.toggle('on',open);if(open){renderLayers();placeUpPop(p,e.currentTarget)}});
/* a popover that opens upwards from a dock button: stays below the plan tabs (scrolling inside if it must), and on phones,
   where the dock is hidden and the button has no box, sits above the bottom bar */
function placeUpPop(p,btn){p.style.overflowY='auto';const m=$('#main').getBoundingClientRect(),r=btn.getBoundingClientRect(),tb=$('#ptabs'),tbr=tb&&tb.offsetParent?tb.getBoundingClientRect():null;
  const topLimit=Math.max(m.top,tbr&&tbr.bottom>m.top?tbr.bottom:m.top)+8;
  if(!r.width||!r.height||PHONE()){const bar=$('#mbar'),br=bar&&bar.offsetParent?bar.getBoundingClientRect():null;const bottom=br?m.bottom-br.top+8:16;
    p.style.left='8px';p.style.right='8px';p.style.top='auto';p.style.bottom=bottom+'px';p.style.maxHeight=Math.max(160,m.bottom-bottom-topLimit)+'px';return}
  p.style.right='';p.style.left=Math.max(8,Math.min(m.width-300,r.left-m.left-120))+'px';p.style.bottom=(m.bottom-r.top+8)+'px';p.style.top='auto';p.style.maxHeight=Math.max(160,r.top-8-topLimit)+'px'}

/* ================= 3D view ================= */
let is3D=false,T3=null,t3Timer=null;
/* ask the 3D loop for a frame (render on demand) */
function kick3D(){if(T3){T3.need=true;T3.sh=true;T3.last=performance.now()}}
/* the light 3D mode: half sharpness, shadows left as they are. Used for big plans and whenever frames come slowly */
function lightMode(){if(!T3||T3.slow)return;T3.slow=true;T3.renderer.setPixelRatio(T3.fullDpr*0.5);T3.need=true;if(!T3.slowTold){T3.slowTold=true;toast(T3.slowBig?"Large plan: the 3D view is drawn softer and without fresh shadows to keep it moving":"The 3D view is drawn softer here to keep it moving")}}
function cssColor(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()||'#888888'}
function isDark(){const th=document.documentElement.dataset.theme;return th==='dark'||(th!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)}
/* the 3D and PDF libraries are separate files on the website and load the first time they are needed; in the single-file build they are already on the page */
const VEND=window.SB_VENDOR||{};const vendLoaded={};
function loadScript(src){return vendLoaded[src]||(vendLoaded[src]=new Promise((ok,bad)=>{const sc=document.createElement('script');sc.src=src;sc.onload=()=>ok();sc.onerror=()=>{delete vendLoaded[src];bad(new Error('could not load '+src))};document.head.appendChild(sc)}))}
function ensureThree(){return (window.THREE&&window.THREE.OrbitControls)?Promise.resolve():(VEND.three?loadScript(VEND.three):Promise.reject(new Error('the 3D library is missing')))}
function ensurePdf(){return (window.pdfjsLib||window['pdfjs-dist/build/pdf'])?Promise.resolve():(VEND.pdf?loadScript(VEND.pdf):Promise.reject(new Error('the PDF reader is missing')))}
function init3D(){
  const THREE=window.THREE;if(!THREE||!THREE.OrbitControls)throw new Error('the 3D library did not load');
  const cv=$('#v3c');
  /* no preserveDrawingBuffer: the PNG export and camera views render immediately before reading pixels, so the buffer never has to be kept */
  const renderer=new THREE.WebGLRenderer({canvas:cv,/* edge smoothing costs frame rate: off unless Settings > Smooth edges in 3D is on */antialias:!!P.aa3d,preserveDrawingBuffer:false});
  /* the browser can take the graphics away (driver reset, too many tabs): say so, and redraw when they come back */
  cv.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('3D has stopped: the browser reset the graphics. It restarts by itself; if it does not, go to 2D and back')});cv.addEventListener('webglcontextrestored',()=>{try{build3D()}catch(e){}toast('3D is back')});
  /* phones and tablets: cap the pixel ratio at 1.5, use the cheaper shadow filter and smaller shadow maps; a 390-px phone at 1.5× is still sharp and renders about half the pixels of 2× */
  const LOW_GPU=TOUCH||(navigator.deviceMemory&&navigator.deviceMemory<=4);
  /* speed comes first in 3D: one screen pixel per point at most, even on a high-density screen (a phone or a Retina display used to draw up to four times the pixels) */const fullDpr=Math.min(1,window.devicePixelRatio||1);
  renderer.setPixelRatio(fullDpr);renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=LOW_GPU?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;renderer.outputEncoding=THREE.sRGBEncoding;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(45,1,0.05,1000);
  /* picks right after a rebuild can come before the next frame has placed the new meshes: bring matrices up to date before every ray */
  if(!THREE.Raycaster.prototype._sbFresh){const sf=THREE.Raycaster.prototype.setFromCamera;THREE.Raycaster.prototype.setFromCamera=function(c,cam){cam.updateMatrixWorld();if(T3&&T3.scene)T3.scene.updateMatrixWorld();return sf.call(this,c,cam)};THREE.Raycaster.prototype._sbFresh=true}
  const controls=new THREE.OrbitControls(camera,cv);controls.enableDamping=true;controls.dampingFactor=0.12;controls.maxPolarAngle=Math.PI/2-0.03;controls.screenSpacePanning=true;
  /* same mouse as the 2D plan: left orbits, middle and right pan, wheel zooms */
  controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.PAN};
  /* SketchUp fork: the middle button orbits (Shift with it pans), as in SketchUp */if(suOn())controls.mouseButtons.MIDDLE=THREE.MOUSE.ROTATE;
  const hemi=new THREE.HemisphereLight(0xffffff,0x6f7884,0.8);scene.add(hemi);
  const dir=new THREE.DirectionalLight(0xffffff,0.7);dir.castShadow=true;dir.shadow.mapSize.set(LOW_GPU?1024:2048,LOW_GPU?1024:2048);dir.shadow.bias=-0.0006;scene.add(dir);scene.add(dir.target);
  const group=new THREE.Group();scene.add(group);
  T3={THREE,renderer,scene,camera,controls,dir,hemi,group,lowGPU:!!LOW_GPU,fullDpr,framed:false,raf:null,center:[0,0],span:10,doorState:{},doorPiv:{},liftPiv:{},need:true,last:0,lastRender:0,fullDpr};
  T3.sunGroup=new THREE.Group();T3.sunGroup.userData.noExport=true;scene.add(T3.sunGroup);
  /* render on demand: a frame is drawn when something changed (need), within 0.7 s of input, while walking or a door is moving,
     and once a second as a safety net. A still scene costs almost nothing. */
  T3.loop=()=>{if(!is3D){T3.raf=null;return}const now=performance.now();if(WALK.on)walkStep();else controls.update();const anim=doorsAnimate();
    if(T3.lowDpr&&WALK.on&&T3.walkMoved&&now-T3.walkMoved>500&&!T3.orbiting){T3.lowDpr=false;renderer.setPixelRatio(T3.slow?fullDpr*0.5:fullDpr);T3.walkMoved=0}
    /* frames that keep coming slowly (under five a second, four in a row) switch the view to the light mode for good: half sharpness and no shadow pass */
    /* (not under the test hook: the release gate draws on a software renderer, which is always slow, and its pictures must not depend on when the switch happens) */if(!T3.slow&&T3.wasDrawn&&!location.hash.endsWith("-debug")){if(now-T3.lastRender>200){if((T3.slowN=(T3.slowN||0)+1)>=4){T3.slowAuto=true;lightMode()}}else T3.slowN=0}
    
    /* in Walk mode the scene used to be redrawn every frame, standing still included, which kept the graphics card at full load. Now it is redrawn only while the view is changing (and once a second, as in orbit) */
    const cs=WALK.on?camera.position.x.toFixed(4)+','+camera.position.y.toFixed(4)+','+camera.position.z.toFixed(4)+','+camera.quaternion.x.toFixed(5)+','+camera.quaternion.y.toFixed(5)+','+camera.quaternion.w.toFixed(5):'';const walking=WALK.on&&cs!==T3.camSig;T3.camSig=cs;if(walking)T3.last=now;
    if(T3.orbiting||walking||anim||T3.need)drawNorth();
    if(walking||T3.need||anim||now-T3.last<700||now-T3.lastRender>1000){if(renderer.getContext().isContextLost()){T3.lastRender=now}else{if(bldView)bldLabelsMove();/* shadows are drawn again only when something in the scene changed, not when the camera moved: that pass goes over every triangle */if(!T3.slow&&(T3.sh||anim||(T3.need&&!T3.camNeed)||(walking&&WALK.third)))renderer.shadowMap.needsUpdate=true;T3.sh=false;T3.camNeed=false;renderer.render(scene,camera);T3.need=false;T3.lastRender=now;T3.wasDrawn=true}}else T3.wasDrawn=false;
    T3.raf=requestAnimationFrame(T3.loop)};
  controls.addEventListener('change',()=>{if(!T3.need)T3.camNeed=true;T3.need=true;T3.last=performance.now()});
  /* orbiting at a lower pixel ratio on high-density screens; full quality returns when the hand lifts */
  controls.addEventListener('start',()=>{T3.last=performance.now();T3.orbiting=true;if(fullDpr>1&&!T3.lowDpr){T3.lowDpr=true;renderer.setPixelRatio(1)}});
  controls.addEventListener('end',()=>{T3.last=performance.now();T3.orbiting=false;if(T3.lowDpr){T3.lowDpr=false;renderer.setPixelRatio(fullDpr)}T3.need=true;drawNorth()});
  controls.addEventListener('change',()=>{if(!T3.orbiting)drawNorth()});
  ['pointerdown','pointermove','pointerup','wheel','keydown','keyup'].forEach(ev=>$('#v3').addEventListener(ev,()=>{T3.last=performance.now()},{passive:true}));
  // click to select
  let down=null;
  T3.ghost=new THREE.Group();scene.add(T3.ghost);
  cv.addEventListener('pointermove',e=>{if(WALK.on||tool!=='place'||!placeLib)return;const p=floorAt(e);if(!p)return;lastW=p;$('#coords').textContent=`${fmt(p[0])}, ${fmt(p[1])} mm`;ghost3D(ghostAt(p,e.altKey).objs)});
  cv.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});
  cv.addEventListener('pointermove',e=>{if(!bldView||e.buttons)return;bldHover(bldPickAt(e))});
  cv.addEventListener('pointerleave',()=>{if(bldView)bldHover(null)});
  /* drag furniture across the floor in 3D. Listens on the wrapper in the capture phase so the orbit control never sees a drag that starts on furniture */
  let mv3=null;
  const itemAt=e=>{const r=cv.getBoundingClientRect();const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
    const h=rc.intersectObjects(group.children,true).find(h=>{let o=h.object;while(o&&!o.userData.id)o=o.parent;return!!o});if(!h)return null;let o=h.object;while(o&&!o.userData.id)o=o.parent;return byId(o.userData.id)};
  const vhAt=e=>{const r=cv.getBoundingClientRect();const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);const h=rc.intersectObjects(group.children.filter(c=>c.userData.vh),false)[0];return h?h.object:null};
  let vh3=null;
  $('#v3').addEventListener('pointerdown',e=>{if(e.target!==cv||WALK.on||bldView||tool==='paint'||d3Active()||e.button!==0)return;const hm=vhAt(e);if(!hm)return;e.stopPropagation();const o=byId(hm.userData.vh.id);if(!o)return;
    vh3={o,i:hm.userData.vh.i,hm,sx:e.clientX,sy:e.clientY,moved:false,alt:e.altKey,old:clone(o.pts),rect:e.altKey?null:rectFrame(o,hm.userData.vh.i)};try{cv.setPointerCapture(e.pointerId)}catch(err){}},true);
  cv.addEventListener('pointermove',e=>{if(!vh3)return;if(!vh3.moved&&Math.hypot(e.clientX-vh3.sx,e.clientY-vh3.sy)<4)return;const p=floorAt(e);if(!p)return;
    if(!vh3.moved){vh3.moved=true;checkpoint()}const q=vh3.o.site?(P.snap?[snapV(p[0]),snapV(p[1])]:p):pointSnap(p,{alt:e.altKey,exV:{o:vh3.o,i:vh3.i}}).p;
    if(vh3.rect){const R=vh3.rect,a=(q[0]-R.C[0])*R.u[0]+(q[1]-R.C[1])*R.u[1],bb=(q[0]-R.C[0])*R.v[0]+(q[1]-R.C[1])*R.v[1],pt=(x,y)=>[Math.round(R.C[0]+R.u[0]*x+R.v[0]*y),Math.round(R.C[1]+R.u[1]*x+R.v[1]*y)];const P_=vh3.o.pts;P_[R.iB]=pt(a,0);P_[R.iD]=pt(0,bb);P_[vh3.i]=pt(a,bb)}
    else vh3.o.pts[vh3.i]=[Math.round(q[0]),Math.round(q[1])];vh3.hm.position.x=q[0]*0.001;vh3.hm.position.z=q[1]*0.001;e.stopPropagation();schedule3D()},true);
  const endVh=e=>{if(!vh3)return;const v=vh3;vh3=null;down=null;e.stopPropagation();
    if(v.moved&&!v.o.site)followWall(v.o,v.old);
    if(!v.moved&&v.alt){const o=v.o,min=(o.t==='room'||o.closed)?3:2;if(o.pts.length>min){checkpoint();o.pts.splice(v.i,1);if(Array.isArray(o.bulge)){o.bulge.splice(v.i,1);if(v.i>0)o.bulge[v.i-1]=0}}else toast(`A line needs at least ${min} points`)}
    markDirty();clashDirty=true;render();renderInspector();build3D()};
  cv.addEventListener('pointerup',endVh,true);cv.addEventListener('pointercancel',endVh,true);
  /* touch and pen: holding still for half a second opens the menu (iOS sends no contextmenu event) */
  {let lp3=null,lpLast=null;const lpClear=()=>{if(lp3){clearTimeout(lp3.t);lp3=null}};
    /* on #v3, ahead of the item handler that stops the event before it reaches the canvas */
    const v3el=$('#v3');v3el.addEventListener('pointerdown',e=>{if(e.target!==cv)return;lpClear();if(e.pointerType==='mouse'||WALK.on||bldView||d3Active()||tool==='place'||tool==='paint')return;
      const ev={clientX:e.clientX,clientY:e.clientY,target:e.target,preventDefault(){}},pid=e.pointerId;
      const ts=e.timeStamp;lp3={pid,x:e.clientX,y:e.clientY,t:setTimeout(()=>{if(!lp3||lp3.pid!==pid)return;lp3=null;lpLast={pid,ts,item:!!itemAt(ev)};
        if(mv3){mv3.orig.forEach(([id,o0])=>{const g=mv3.gs[id];if(g){g.position.set(o0.x*0.001,0,o0.y*0.001);g.rotation.y=-(o0.r||0)*Math.PI/180}});mv3=null}
        down=null;controls.enabled=false;setTimeout(()=>{controls.enabled=true},0);lpFired=true;lpMenuPid=pid;if(navigator.vibrate)navigator.vibrate(8);
        ctxFrom3D(ev,itemAt(ev),floorAt(ev))},480)}},true);
    v3el.addEventListener('pointermove',e=>{if(lp3&&e.pointerId===lp3.pid&&Math.hypot(e.clientX-lp3.x,e.clientY-lp3.y)>10)lpClear();else if(lp3&&e.pointerId!==lp3.pid)lpClear()},true);
    ['pointerup','pointercancel'].forEach(t=>v3el.addEventListener(t,e=>{if(lp3&&e.pointerId===lp3.pid)lpClear();
      /* a busy 3D frame can run the long-press timer before a quick tap's lift is handled; the lift's own time stamp says when the finger really came up, so a tap shorter than the hold opens no menu and still clears the selection */
      else if(lpLast&&e.pointerId===lpLast.pid&&e.timeStamp-lpLast.ts<440){const L=lpLast;lpLast=null;$('#ctxmenu').hidden=true;lpFired=false;if(!L.item&&tool==='select'&&!multiMode&&(sel.size||pinSel)){sel.clear();pinSel=null;render();renderInspector()}}
      if(lpLast&&e.pointerId===lpLast.pid)lpLast=null},true))}
  $('#v3').addEventListener('contextmenu',e=>{/* a long-press or right-click on a control over the 3D view (the Sun bar's fields, say) is not a press on the model behind it */if(e.target!==$('#v3c')){if(!e.target.closest('input,textarea,select'))e.preventDefault();return}e.preventDefault();if(WALK.on||bldView)return;if(d3ClickPoly(tool)&&polyPts&&polyPts.length>=2){finishPoly(false);drawD3Overlay();return}if(d3Active()){setTool('select');return}const it=itemAt(e);const g=floorAt(e);ctxFrom3D(e,it,g)});
  /* ---- draw on the ground plane in 3D ---- */
  $('#v3').addEventListener('pointerdown',e=>{if(e.target!==cv||WALK.on||bldView||e.button!==0||!d3Active())return;const w=floorAt(e);if(!w)return;
    if(d3RectTool(tool)||tool==='measure'||tool==='section'){e.stopPropagation();controls.enabled=false;const a=(P.snap&&!altDown&&!ctrlDown&&tool!=='section')?[snapV(w[0]),snapV(w[1])]:[Math.round(w[0]),Math.round(w[1])];d3drag={mode:tool,a,b:a.slice()};try{cv.setPointerCapture(e.pointerId)}catch(x){}drawD3Overlay();return}
    if(d3ClickPoly(tool)){d3down={x:e.clientX,y:e.clientY};/* decide click vs orbit on pointerup */}
  },true);
  $('#v3').addEventListener('pointermove',e=>{if(e.target===cv&&!WALK.on&&!bldView&&e.pointerType==='mouse'){const g=floorAt(e);if(g)lastW=[Math.round(g[0]),Math.round(g[1])]}if(!d3Active())return;const w=floorAt(e);if(w)lastW3=w;
    if(d3drag){e.stopPropagation();/* pointer off the ground (sky, or outside the view): keep the last point */if(!w){drawD3Overlay();return}d3drag.b=(tool==='measure'&&e.shiftKey)?(Math.abs(w[0]-d3drag.a[0])>Math.abs(w[1]-d3drag.a[1])?[Math.round(w[0]),d3drag.a[1]]:[d3drag.a[0],Math.round(w[1])]):((P.snap&&!altDown&&!ctrlDown&&tool!=='section')?[snapV(w[0]),snapV(w[1])]:[Math.round(w[0]),Math.round(w[1])]);drawD3Overlay();return}
    drawD3Overlay();
  },true);
  const d3Up=e=>{if(e.button!==0)return;
    if(d3drag){e.stopPropagation();const d=d3drag;d3drag=null;controls.enabled=true;
      if(d.mode==='measure'){if(Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])>10){addObjs([{id:uid(),t:'dim',a:d.a,b:d.b,gid:null}],false);build3D()}}
      else if(d.mode==='section'){if(Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])>200){checkpoint();S.section={a:d.a,b:d.b,on:true,flip:!!(S.section&&S.section.flip)};markDirty();sectionApply();sectionBar();secSel=true}}
      else d3FinishRect(d.mode,d.a,d.b);
      drawD3Overlay();return}
    if(d3down&&d3ClickPoly(tool)){const moved=Math.hypot(e.clientX-d3down.x,e.clientY-d3down.y)>5;d3down=null;if(moved)return;/* was an orbit */
      const w=floorAt(e);if(!w)return;
      if(polyPts&&polyPts.length>=2){const p0=projG(polyPts[0][0],polyPts[0][1]),cur=[e.clientX-$('#v3c').getBoundingClientRect().left,e.clientY-$('#v3c').getBoundingClientRect().top];if(Math.hypot(p0[0]-cur[0],p0[1]-cur[1])<12){finishPoly(true);drawD3Overlay();return}}
      const np=d3Next(w);if(!polyPts)polyPts=[np];else polyPts.push(np);lastW3=w;drawD3Overlay();polyBar();escSync()}
  };
  cv.addEventListener('pointerup',d3Up,true);
  controls.addEventListener('change',()=>{if(d3Active())drawD3Overlay()});
  $('#v3').addEventListener('dblclick',e=>{if(d3ClickPoly(tool)&&polyPts&&polyPts.length>=2){e.preventDefault();e.stopPropagation();finishPoly(tool==='shape-poly'&&polyPts.length>=3);drawD3Overlay();return}
    /* double-click a wall in 3D adds a corner where you clicked, as in 2D */
    if(tool==='select'&&!WALK.on){const r=cv.getBoundingClientRect();const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
      const h=rc.intersectObjects(group.children,true).find(h=>{let o=h.object;while(o&&!o.userData.id)o=o.parent;return!!o});if(!h)return;let m=h.object;while(m&&!m.userData.id)m=m.parent;const o=byId(m.userData.id);
      if(o&&o.t==='wall'&&!o.site){/* where the ray crosses the wall's own vertical plane (the mesh hit point can be off for long extrusions) */
        const O=rc.ray.origin,D=rc.ray.direction,k=0.001,H=num(o.h,3000)*k+0.2;let best=null;const pp=o.pts.concat(o.closed?[o.pts[0]]:[]);
        for(let i=0;i<pp.length-1;i++){const ax=pp[i][0]*k,az=pp[i][1]*k,bx=pp[i+1][0]*k,bz=pp[i+1][1]*k,nx=-(bz-az),nz=bx-ax,den=nx*D.x+nz*D.z;if(Math.abs(den)<1e-9)continue;
          const t=(nx*(ax-O.x)+nz*(az-O.z))/den;if(t<=0)continue;const qx=O.x+D.x*t,qy=O.y+D.y*t,qz=O.z+D.z*t,L2=(bx-ax)**2+(bz-az)**2,u=((qx-ax)*(bx-ax)+(qz-az)*(bz-az))/L2;
          if(u<0||u>1||qy<-0.05||qy>H)continue;if(!best||t<best.t)best={t,p:[qx/k,qz/k]}}
        if(best&&insertCorner(o,best.p,Math.max(300,(o.th||100)))){e.preventDefault();e.stopPropagation();sel=new Set([o.id]);render();renderInspector();build3D();toast('Corner added. Drag the dot to move it.')}}}},true);
  $('#v3').addEventListener('pointerdown',e=>{if(mv3||e.target!==cv||WALK.on||bldView||tool==='place'||tool==='paint'||d3Active()||e.button!==0)return;if(e.pointerType==='touch'&&PEN_SEEN)return;const it=itemAt(e);if(!it||it.t!=='item')return;const p=floorAt(e);if(!p)return;
    e.stopPropagation();const grp=e.altKey?[it]:groupOf(it);
    if(addMod(e)){grp.forEach(x=>sel.has(x.id)?sel.delete(x.id):sel.add(x.id));renderInspector();build3D();return}
    if(!sel.has(it.id)){sel=new Set(grp.map(x=>x.id));renderInspector();build3D()}
    const list=selList().filter(o=>o.t==='item');const gs={};group.children.forEach(c=>{if(c.userData.id)gs[c.userData.id]=c});
    mv3={p0:p,pid:e.pointerId,orig:list.map(o=>[o.id,clone(o)]),gs,dx:0,dy:0,moved:false};try{cv.setPointerCapture(e.pointerId)}catch(err){}},true);
  /* a second finger while a 3D move is under way locks it to one axis (as on the plan); it never reaches the orbit controls */
  cv.addEventListener('pointerdown',e=>{if(mv3&&e.pointerId!==mv3.pid&&e.pointerType!=='mouse'&&mv3.hold==null){mv3.hold=e.pointerId;e.stopPropagation();e.preventDefault();toast('Axis locked · lift the second finger to free')}},true);
  cv.addEventListener('pointermove',e=>{if(!mv3)return;if(e.pointerId!==mv3.pid){if(e.pointerId===mv3.hold)e.stopPropagation();return}const p=floorAt(e);if(!p)return;let dx=p[0]-mv3.p0[0],dy=p[1]-mv3.p0[1];
    if(!mv3.moved){if(Math.hypot(dx,dy)<30)return;mv3.moved=true;pushPast(snapState());future=[]}
    if(P.snap){dx=Math.round(dx/P.snapSize)*P.snapSize;dy=Math.round(dy/P.snapSize)*P.snapSize}
    if(P.osnap&&!e.altKey){const r=objSnap(mv3.orig,dx,dy);dx=r[0];dy=r[1]}
    if(e.shiftKey||mv3.hold!=null){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0}
    mv3.dx=dx;mv3.dy=dy;const s=0.001;mv3.orig.forEach(([id,o0])=>{const g=mv3.gs[id];if(!g)return;const o=byId(id);
      if(isWallMount(o)&&!e.altKey){const t=clone(o0);if(seatWindow(t,[o0.x+dx,o0.y+dy],600,mv3.cur&&mv3.cur[id]!==undefined?mv3.cur[id]:((mv3.cur=mv3.cur||{})[id]=wallAt([o0.x,o0.y],60)))){g.position.set(t.x*s,0,t.y*s);g.rotation.y=-(t.r||0)*Math.PI/180;mv3.seat=mv3.seat||{};mv3.seat[id]=t;return}}if(mv3.seat)delete mv3.seat[id];g.position.set((o0.x+dx)*s,0,(o0.y+dy)*s)});
    $('#coords').textContent=`${fmt(mv3.orig[0][1].x+dx)}, ${fmt(mv3.orig[0][1].y+dy)} mm`});
  const end3=e=>{if(!mv3)return;if(e&&e.pointerId!==mv3.pid){if(e.pointerId===mv3.hold){mv3.hold=null;e.stopPropagation()}return}const m=mv3;mv3=null;down=null;if(!m.moved)return;m.orig.forEach(([id,o0])=>{const o=byId(id);if(!o)return;moveObj(o,o0,m.dx,m.dy);const t=m.seat&&m.seat[id];if(t){o.x=t.x;o.y=t.y;o.r=t.r;o.d=t.d}});clashDirty=true;markDirty();render();renderInspector();build3D()};
  cv.addEventListener('pointerup',end3,true);cv.addEventListener('pointercancel',end3,true);
  /* placing in 3D with a mouse or Pencil: a click places one, press and drag lays out a row or grid (as on the plan). Runs on the wrapper so the orbit control never sees it */
  let arr3=null;const v3w=$('#v3');
  const arr3Off=()=>{if(!arr3)return;try{cv.releasePointerCapture(arr3.pid)}catch(err){}arr3=null;T3.controls.enabled=true;ghost3D(null)};
  v3w.addEventListener('pointerdown',e=>{if(e.target!==cv||tool!=='place'||!placeLib||WALK.on||bldView||e.button!==0)return;if(e.pointerType==='touch')return;
    if(placeLib.missing){e.stopPropagation();return toast('This set uses items that are not in the library.')}if(placeLib.shape==='window'||placeLib.shape==='fcuw')return;
    const p=floorAt(e);if(!p)return;e.stopPropagation();e.preventDefault();const gh=ghostAt(p,e.altKey);arr3={pid:e.pointerId,gh,a:p,b:p,sx:e.clientX,sy:e.clientY,moved:false};T3.controls.enabled=false;try{cv.setPointerCapture(e.pointerId)}catch(err){}},true);
  v3w.addEventListener('pointermove',e=>{if(!arr3||e.pointerId!==arr3.pid)return;e.stopPropagation();const p=floorAt(e);if(!p)return;arr3.b=p;
    if(!arr3.moved&&Math.hypot(e.clientX-arr3.sx,e.clientY-arr3.sy)>6)arr3.moved=true;if(arr3.moved){const cs=arrCopies(arr3);ghost3D(cs.flat());$('#coords').textContent=`${cs.length} × ${placeLib.name}`}},true);
  v3w.addEventListener('pointerup',e=>{if(!arr3||e.pointerId!==arr3.pid)return;e.stopPropagation();const d=arr3;arr3Off();const list=d.moved?arrCopies(d).flat():d.gh.objs;addObjs(list,false);if(d.moved)toast(`Placed ${arrCopies(d).length} × ${placeLib?placeLib.name:'item'}`);build3D()},true);
  v3w.addEventListener('pointercancel',e=>{if(arr3&&e.pointerId===arr3.pid)arr3Off()},true);
  cv.addEventListener('pointerup',e=>{if(WALK.on){down=null;return}if(e.defaultPrevented)return;if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4||e.button!==0)return;down=null;
    if(d3TapTool(tool)){const w=floorAt(e);if(!w)return;const p=[Math.round(w[0]),Math.round(w[1])];
      if(tool==='pin'){checkpoint();S.pins=S.pins||[];const pin=newPin(p[0],p[1]);S.pins.push(pin);markDirty();setTool('select');build3D();openPin(pin.id);return}
      const sw=P.snap?[snapV(p[0]),snapV(p[1])]:p;const o={id:uid(),t:'text',x:sw[0],y:sw[1],text:'Label',size:250,gid:null};addObjs([o],true);setTool('select');showTab('sel');build3D();toast('Label added: type its text in Details. Labels show on the 2D plan and in exports');setTimeout(()=>{const i=$('#f-text');if(i){i.focus();i.select()}},30);return}
    if(tool==='paint'){const rr=cv.getBoundingClientRect();const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(((e.clientX-rr.left)/rr.width)*2-1,-((e.clientY-rr.top)/rr.height)*2+1),camera);
      const hits=rc.intersectObjects(group.children,true);let mesh=null,top=null,topHit=null;for(const h of hits){let m=h.object;while(m&&!m.userData.id&&!m.userData.paint)m=m.parent;if(m&&(m.userData.id||m.userData.paint)){mesh=m;top=h.object;topHit=h;break}}
      if(mesh&&P.paintFace&&top&&top.userData.fid!=null&&mesh.userData.id){const o=byId(mesh.userData.id),fi=fidAt(top,topHit);if(o){if(e.altKey){try{P.paintCol='#'+top.material.color.getHexString();savePrefs();renderInspector();updateHint();toast('Picked colour')}catch(err){}}else{checkpoint();o.faces=o.faces||{};o.faces[fi]=P.paintCol;markDirty();build3D();render();toast('Face painted')}}return}
      if(mesh){const kind=mesh.userData.paint,o=mesh.userData.id?byId(mesh.userData.id):null;
        if(e.altKey){let c=null;if(kind==='basefloor')c=planFloorCol();else if(o)c=kind==='wall'?((o.t==='wall'?o.col:o.wallCol)||planWallCol()):kind==='floor'?(o.floorCol||planFloorCol()):(o.col||cssColor('--c-'+(CATS[o.cat]||'custom')));if(c){P.paintCol=c;savePrefs();renderInspector();updateHint();toast('Picked colour')}}
        else{checkpoint();if(kind==='basefloor'){S.style=S.style||{};S.style.floor=P.paintCol}else if(o){if(kind==='wall'){if(o.t==='wall')o.col=P.paintCol;else o.wallCol=P.paintCol}else if(kind==='floor')o.floorCol=P.paintCol;else{o.col=P.paintCol;if(o.faces)delete o.faces}}markDirty();clashDirty=true;build3D();render()}}
      return}
    if(bldView){const id=bldPickAt(e);if(id){bldHover(null);switchFloor(id);setView('2d')}return}
    if(tool==='addpt'){const o=byId(addPtFor),p=floorAt(e);if(o&&p&&insertCorner(o,p,1500)){sel=new Set([o.id]);render();renderInspector();build3D();toast('Point added. Drag the dot to move it.')}else toast('Click on the line itself to add a point');return}
    if(tool==='place'&&placeLib){const p=floorAt(e);if(!p)return;if(placeLib.missing)return toast('This set uses items that are not in the library.');const gh=ghostAt(p,e.altKey);addObjs(gh.objs,false);return}
    const r=cv.getBoundingClientRect();const v=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);const rc=new THREE.Raycaster();rc.setFromCamera(v,camera);
    const hit=rc.intersectObjects(group.children,true).find(h=>{let o=h.object;while(o&&!o.userData.id)o=o.parent;return!!o});
    if(hit){let o=hit.object;while(o&&!o.userData.id)o=o.parent;const it=byId(o.userData.id);if(it&&!fixed(it)){const g=e.altKey?[it]:groupOf(it);if(addMod(e))g.forEach(x=>sel.has(x.id)?sel.delete(x.id):sel.add(x.id));else sel=new Set(g.map(x=>x.id))}}
    else if(!e.shiftKey)sel.clear();
    renderInspector();build3D()});
}
/* where the mouse meets the floor, in plan millimetres */
function floorAt(e){const{THREE,camera}=T3;const r=$('#v3c').getBoundingClientRect();const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
  const o=rc.ray.origin,d=rc.ray.direction;if(Math.abs(d.y)<1e-6)return null;const t=-o.y/d.y;if(t<0)return null;return[(o.x+d.x*t)/0.001,(o.z+d.z*t)/0.001]}
/* see-through preview of what the next click will place */
function ghost3D(objs){if(!T3||!T3.ghost)return;kick3D();const{THREE}=T3,G=T3.ghost,s=0.001;G.children.slice().forEach(c=>{c.geometry&&c.geometry.dispose();G.remove(c)});if(!objs)return;
  const m=T3.ghostMat||(T3.ghostMat=new THREE.MeshBasicMaterial({color:new THREE.Color(cssColor('--accent')),transparent:true,opacity:0.35,depthWrite:false}));
  objs.forEach(o=>{const h=Math.max(30,o.h||750);bodyLocal(o).forEach(p=>{const sh=new THREE.Shape(p.map(q=>new THREE.Vector2(q[0]*s,-q[1]*s)));const geo=new THREE.ExtrudeGeometry(sh,{depth:h*s,bevelEnabled:false});geo.rotateX(-Math.PI/2);const me=new THREE.Mesh(geo,m);me.position.set(o.x*s,0,o.y*s);me.rotation.y=-(o.r||0)*Math.PI/180;G.add(me)})})}
function size3D(){if(!T3)return;const r=$('#v3').getBoundingClientRect();T3.renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);T3.camera.aspect=r.width/Math.max(1,r.height);T3.camera.updateProjectionMatrix();kick3D()}
function schedule3D(){if(!is3D)return;clearTimeout(t3Timer);t3Timer=setTimeout(build3D,60)}
function clear3D(group){group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(m.map&&!(T3&&T3.uTex&&m.map===T3.uTex.tex))m.map.dispose();m.dispose()})}});group.clear()}
/* tg/opts: the Building view builds each floor into its own group: no ground, grid, underlay or framing, walls up to the slab, furniture optional */
function build3D(tg,opts){/* while the browser has taken the graphics away nothing can be built: three.js throws on a lost context. The scene is rebuilt when it comes back */if(T3&&T3.renderer&&T3.renderer.getContext().isContextLost()){T3.rebuildOnRestore=true;return}
  if(!T3)return;if(bldView&&!tg)return buildBld3D();const{THREE,dir,scene}=T3;const group=tg||T3.group,sub=!!tg;opts=opts||{};const s=0.001;
  if(!sub){T3.cy=0;bldLabels(null)}
  if(!sub)group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(m.map&&!(T3.uTex&&m.map===T3.uTex.tex))m.map.dispose();m.dispose()})}});
  /* shadow detail follows the sun study: 2048 for a study, 1024 for everyday depth cues (half the shadow-pass cost) */
  if(!sub){const want=T3.lowGPU?(SUN.on?1024:512):(SUN.on?2048:1024);if(dir.shadow.mapSize.x!==want){dir.shadow.mapSize.set(want,want);if(dir.shadow.map){dir.shadow.map.dispose();dir.shadow.map=null}}}
  if(!sub){group.clear();T3.cols=[];T3.doorPiv={};T3.liftPiv={}}
  const dark=isDark();scene.background=new THREE.Color(WALK.on&&!sub?(dark?'#22313f':'#cfe3f2'):cssColor('--paper')).convertSRGBToLinear();
  const cache=sub?(opts.cache||{}):{};
  const mat=(col,opt)=>{const k=col+'|'+(opt?JSON.stringify(opt):'');if(!cache[k]){const o=Object.assign({roughness:0.85,metalness:0.02},opt||{});o.color=new THREE.Color(col).convertSRGBToLinear();if(opt&&opt.emissive)o.emissive=new THREE.Color(opt.emissive).convertSRGBToLinear();cache[k]=new THREE.MeshStandardMaterial(o)}return cache[k]};
  const wallCol=dark?'#56626f':'#e9ecef',floorCol=cssColor('--room'),legCol=dark?'#a7b2bd':'#3d4855',accent=cssColor('--accent');
  const pts=[];S.objs.forEach(o=>{if(visible(o)){const b=objBox(o);pts.push([b.x0,b.y0],[b.x1,b.y1])}});
  const u=S.underlay,showU=!!(u&&u.src&&u.visible!==false&&LY('under'));
  if(showU)pts.push([u.x,u.y],[u.x+u.w*u.mpp,u.y+u.h*u.mpp]);
  const B=pts.length?bboxPts(pts):{x0:-5000,y0:-5000,x1:5000,y1:5000};
  const cx=(B.x0+B.x1)/2,cy=(B.y0+B.y1)/2,span=Math.max(B.x1-B.x0,B.y1-B.y0,4000);
  const gsz=span*1.6*s;
  const lvW=S.bld?S.bld.levels.indexOf(bldLevel(S)):0;const downs=(!sub&&WALK.on&&S.bld&&lvW>0)?S.objs.filter(c=>isCore(c)&&c.shape==='stair'&&coreUp(S.bld,c,lvW-1)):[];
  if(!sub){const gq=(WALK.on?gsz*4:gsz)/s/2,gpoly=[[cx-gq,cy-gq],[cx+gq,cy-gq],[cx+gq,cy+gq],[cx-gq,cy+gq]],gsh=new THREE.Shape(gpoly.map(p=>new THREE.Vector2((p[0]-cx)*s,-(p[1]-cy)*s)));if(downs.length)coreHoles(gsh,downs.map(c=>Object.assign({},c,{x:c.x-cx,y:c.y-cy})),gpoly.map(p=>[p[0]-cx,p[1]-cy]));const gg=new THREE.ShapeGeometry(gsh);gg.rotateX(-Math.PI/2);const ground=new THREE.Mesh(gg,mat(dark?'#3b4436':'#b9c4a4'));ground.position.set(cx*s,-0.03,cy*s);ground.userData.ground=true;ground.receiveShadow=true;ground.userData.noExport=true;group.add(ground)}
  if(!sub&&LY('grid')&&!(LY('site')&&S.objs.some(isSite))){const n=Math.max(2,Math.min(400,Math.round(gsz/(P.grid*s))));const gh=new THREE.GridHelper(n*P.grid*s,n,new THREE.Color(cssColor('--grid-major')).convertSRGBToLinear(),new THREE.Color(cssColor('--grid')).convertSRGBToLinear());gh.position.set(cx*s,-0.02,cy*s);group.add(gh)}
  if(showU&&!sub){if(!T3.uTex||T3.uTex.src!==u.src){if(T3.uTex)T3.uTex.tex.dispose();const t=new THREE.TextureLoader().load(u.src,()=>kick3D());t.encoding=THREE.sRGBEncoding;T3.uTex={src:u.src,tex:t}}const tex=T3.uTex.tex;const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:u.op==null?0.6:u.op,depthWrite:false});const w=u.w*u.mpp*s,h=u.h*u.mpp*s;const pl=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);pl.rotation.x=-Math.PI/2;if(u.rot)pl.rotation.z=-u.rot*Math.PI/180;pl.position.set(u.x*s+w/2,0.002,u.y*s+h/2);pl.renderOrder=1;pl.userData.noExport=true;group.add(pl)}
  const rooms=LY('walls')?S.objs.filter(o=>o.t==='room'):[];
  /* floor slab under the whole building in the plan floor colour, so corridors, doorways and spaces that are not rooms are coloured too */
  const customFloor=!!(S.style&&S.style.floor);
  floorPlate().forEach(poly=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh,downs,poly);const g=new THREE.ShapeGeometry(sh);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,mat(planFloorCol(),showU&&!customFloor&&!sub?{transparent:true,opacity:0.3}:null));m.position.y=0.0005;m.receiveShadow=true;if(!sub)m.userData.paint='basefloor';group.add(m)});
  /* room floors on top; a chosen colour stays solid even with the drawing showing */
  rooms.forEach(o=>{const zc=zoneVis(o)?ZONE_BY[o.zone][o.zone==='white'?2:3]:null;const custom=!!(zc||o.floorCol||customFloor);const sh=new THREE.Shape(o.pts.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh,downs,o.pts);const g=new THREE.ShapeGeometry(sh);g.rotateX(-Math.PI/2);const ry=o.raise>0?o.raise:0;const m=new THREE.Mesh(g,mat(zc||o.floorCol||planFloorCol(),showU&&!custom&&!sub?{transparent:true,opacity:0.3}:null));m.position.y=ry*s+0.001;m.receiveShadow=true;if(!sub){m.userData.id=o.id;m.userData.paint='floor'}group.add(m);if(ry>0){const sc=mat(o.floorCol||(dark?'#5a636c':'#aeb4bb'));for(let i=0;i<o.pts.length;i++){const a=o.pts[i],bq=o.pts[(i+1)%o.pts.length],L=Math.hypot(bq[0]-a[0],bq[1]-a[1]);if(L<1)continue;const sk=new THREE.Mesh(new THREE.BoxGeometry(L*s,ry*s,40*s),sc);sk.position.set((a[0]+bq[0])/2*s,ry/2*s,(a[1]+bq[1])/2*s);sk.rotation.y=-Math.atan2(bq[1]-a[1],bq[0]-a[0]);sk.castShadow=true;sk.receiveShadow=true;group.add(sk)}}});
  // walls, deduplicated, with door openings
  const doors=S.objs.filter(o=>isOpening(o)&&visible(o));
  const ceilH=opts.ceil!=null?opts.ceil:(S.bld?lvVal(S.bld,bldLevel(S),'ceiling'):2800);
  const openV=d=>{if(!isWin(d))return[0,Math.min(ceilH,Math.max(600,num(d.h,2100)||2100))];const s0=Math.max(0,d.sill||0);return[s0,d.h>0?Math.min(s0+d.h,ceilH):ceilH]};
  const segMap=new Map();const key=p=>Math.round(p[0])+','+Math.round(p[1]);
  const addSeg=(a,b,th,col,id)=>{const k1=key(a)+'|'+key(b),k2=key(b)+'|'+key(a);if(!segMap.has(k1)&&!segMap.has(k2))segMap.set(k1,[a,b,th,col,id])};
  rooms.forEach(o=>{if(o.nowall)return;for(let i=0;i<o.pts.length;i++)addSeg(o.pts[i],o.pts[(i+1)%o.pts.length],Math.max(P.wall||0,60),o.wallCol,o.id)});
  if(LY('walls'))S.objs.filter(o=>o.t==='wall'&&!o.site).forEach(o=>wallSegs(o).forEach(([a,b])=>addSeg(a,b,Math.max(o.th||0,40),o.col,o.id)));
  const wallH=opts.wallH!=null?opts.wallH:P.wall3d==='full'&&S.bld?(WALK.on&&!sub?levelStack(S.bld)[S.bld.levels.indexOf(bldLevel(S))].ftf:lvVal(S.bld,bldLevel(S),'ceiling')):(P.wall3d==='half'?1200:(P.wall3d==='off'?0:2800));let wi=0;
  /* site: roads lie on the grass, fences stand on it */
  if(LY('site'))S.objs.filter(o=>o.t==='wall'&&o.site&&o.pts&&o.pts.length>=2).forEach(o=>{const Pp=wallPathPts(o).slice();if(o.closed)Pp.push(Pp[0]);const isSelO=sel.has(o.id),em=isSelO?{emissive:accent,emissiveIntensity:0.35}:null;
    const sg=new THREE.Group();sg.userData.id=o.id;group.add(sg);const put=(geo,m,x,y,z,ry)=>{const me=new THREE.Mesh(geo,m);me.position.set(x*s,y*s,z*s);if(ry)me.rotation.y=ry;me.receiveShadow=true;me.castShadow=o.site==='fence';sg.add(me);return me};
    if(!sub&&isSelO&&sel.size===1&&!WALK.on)o.pts.forEach((p,i)=>{const hm=new THREE.Mesh(new THREE.SphereGeometry(Math.max(450,span*0.008)*s,16,12),new THREE.MeshBasicMaterial({color:new THREE.Color(accent),depthTest:false}));hm.renderOrder=10;hm.position.set(p[0]*s,(o.site==='fence'?(+o.h||2400)+300:300)*s,p[1]*s);hm.userData.vh={id:o.id,i};hm.userData.noExport=true;group.add(hm)});
    if(o.site==='road'){const wd=o.th||6000,asp=mat(o.col||(dark?'#3a3f45':'#5b6168'),em),wl=mat('#f2f2ee');
      for(let i=0;i<Pp.length-1;i++){const a=Pp[i],b=Pp[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1)continue;const ux=(b[0]-a[0])/L,uy=(b[1]-a[1])/L,ry=-Math.atan2(uy,ux);
        put(new THREE.BoxGeometry(L*s,25*s,wd*s),asp,(a[0]+b[0])/2,2.5,(a[1]+b[1])/2,ry);
        if(L>3000&&wd>=4500)for(let t=1000;t+2500<L-500;t+=5000)put(new THREE.BoxGeometry(2500*s,6*s,120*s),wl,a[0]+ux*(t+1250),17,a[1]+uy*(t+1250),ry)}
      Pp.forEach((p,i)=>{if(i===0&&!o.closed||i===Pp.length-1)return;put(new THREE.CylinderGeometry(wd/2*s,wd/2*s,24*s,32),asp,p[0],2,p[1])})}
    else{const H=+o.h||2400,post=mat(o.col||(dark?'#5a6a5a':'#3f5545'),em),mesh=mat(o.col||(dark?'#6f8a77':'#4d6b57'),Object.assign({transparent:true,opacity:0.45,side:THREE.DoubleSide},em||{}));
      /* gates open a gap in the fence, like doors in a wall */
      const gates=S.objs.filter(g=>g.t==='item'&&g.shape==='gate'&&visible(g));
      for(let i=0;i<Pp.length-1;i++){const a=Pp[i],b=Pp[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1)continue;const ux=(b[0]-a[0])/L,uy=(b[1]-a[1])/L,ry=-Math.atan2(uy,ux);
        const gaps=[];gates.forEach(g=>{const dx=g.x-a[0],dy=g.y-a[1],along=dx*ux+dy*uy,perp=Math.abs(-dx*uy+dy*ux),an=(g.r||0)*Math.PI/180,par=Math.abs(Math.cos(an)*ux+Math.sin(an)*uy);if(perp<(o.th||150)/2+(g.d||200)+300&&par>0.88&&along>-g.w/2&&along<L+g.w/2)gaps.push([Math.max(0,along-g.w/2),Math.min(L,along+g.w/2)])});
        gaps.sort((p,q)=>p[0]-q[0]);const spans=[];let cur=0;gaps.forEach(gp=>{if(gp[0]>cur+1)spans.push([cur,gp[0]]);cur=Math.max(cur,gp[1])});if(cur<L-1)spans.push([cur,L]);if(!gaps.length)spans.length=0,spans.push([0,L]);
        spans.forEach(([s0,s1])=>{const sl=s1-s0;if(sl<1)return;const mx=(s0+s1)/2,cx=a[0]+ux*mx,cz=a[1]+uy*mx,n=Math.max(1,Math.ceil(sl/2500));
          for(let k=0;k<=n;k++){const t=s0+k*sl/n;put(new THREE.BoxGeometry(80*s,H*s,80*s),post,a[0]+ux*t,H/2,a[1]+uy*t,ry)}
          put(new THREE.BoxGeometry(sl*s,60*s,50*s),post,cx,H-30,cz,ry);put(new THREE.BoxGeometry(sl*s,50*s,50*s),post,cx,120,cz,ry);
          put(new THREE.PlaneGeometry(sl*s,(H-180)*s),mesh,cx,(H+60)/2,cz,ry);
          if(!sub)T3.cols.push({a:[a[0]+ux*s0,a[1]+uy*s0],b:[a[0]+ux*s1,a[1]+uy*s1],t:Math.max(o.th||150,120)})})}}});
  /* corner dots for a selected wall or room, to drag in 3D */
  if(!sub&&!WALK.on&&sel.size===1){const o=byId([...sel][0]);if(o&&(o.t==='room'||(o.t==='wall'&&!o.site))&&!fixed(o)&&!(o.t==='room'&&o.link)&&o.pts){const hy=Math.min(Math.max(wallH,0),2800)+250;
    o.pts.forEach((p,i)=>{const hm=new THREE.Mesh(new THREE.SphereGeometry(Math.max(300,span*0.006)*s,16,12),new THREE.MeshBasicMaterial({color:new THREE.Color(accent),depthTest:false}));hm.renderOrder=10;hm.position.set(p[0]*s,hy*s,p[1]*s);hm.userData.vh={id:o.id,i};hm.userData.noExport=true;group.add(hm)})}}
  const pwc=planWallCol();segMap.forEach(([a,b,t,wcol,wid])=>{
    const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1)return;const ux=(b[0]-a[0])/L,uy=(b[1]-a[1])/L;
    const ops=[];doors.forEach(d=>{const dx=d.x-a[0],dy=d.y-a[1];const along=dx*ux+dy*uy,perp=Math.abs(-dx*uy+dy*ux);const an=(d.r||0)*Math.PI/180;const par=Math.abs(Math.cos(an)*ux+Math.sin(an)*uy);if(perp<t/2+(isWin(d)?d.d/2:d.d)+30&&par>0.95&&along>-d.w/2&&along<L+d.w/2){const v=openV(d);ops.push([Math.max(0,along-d.w/2),Math.min(L,along+d.w/2),v[0],v[1],isWin(d)])}});
    /* split the run at every opening edge; each slice keeps the wall that no opening covers */
    const cuts=[...new Set([0,L].concat(ops.flatMap(o=>[o[0],o[1]])))].sort((p,q)=>p-q);const pieces=[];
    for(let ci=0;ci+1<cuts.length;ci++){const p0=cuts[ci],p1=cuts[ci+1];if(p1-p0<1)continue;const mid=(p0+p1)/2;const hs=ops.filter(o=>o[0]<=mid&&o[1]>=mid).map(o=>[o[2],o[3]]).sort((p,q)=>p[0]-q[0]);
      let y=0;hs.forEach(([b0,b1])=>{if(b0>y)pieces.push([p0,p1,y,b0]);y=Math.max(y,b1)});if(y<Math.max(wallH,1))pieces.push([p0,p1,y,Math.max(wallH,1)])}
    if(!sub)ops.forEach(o=>{if(o[4])T3.cols.push({a:[a[0]+ux*o[0],a[1]+uy*o[0]],b:[a[0]+ux*o[1],a[1]+uy*o[1]],t})});
    /* merge slices that end up the same so walls stay single boxes */
    for(let pi=pieces.length-1;pi>0;pi--){const A=pieces[pi-1],B=pieces[pi];if(Math.abs(A[1]-B[0])<0.5&&A[2]===B[2]&&A[3]===B[3]){A[1]=B[1];pieces.splice(pi,1)}}
    const tt=t+(wi++%3)*1.5;
    pieces.forEach(([p0,p1,h0,h1])=>{if(p0<=0)p0=-t/2;if(p1>=L)p1=L+t/2;const len=p1-p0;if(len<1)return;if(h0===0&&!sub)T3.cols.push({a:[a[0]+ux*p0,a[1]+uy*p0],b:[a[0]+ux*p1,a[1]+uy*p1],t});if(wallH<=0||h1<=h0)return;h1=Math.min(h1,wallH);const m=new THREE.Mesh(new THREE.BoxGeometry(len*s,(h1-h0)*s,tt*s),mat(wcol||pwc,!sub&&wid&&sel.has(wid)?{emissive:accent,emissiveIntensity:0.35}:null));if(!sub&&wid){m.userData.id=wid;m.userData.paint='wall'}const mid=(p0+p1)/2;m.position.set((a[0]+ux*mid)*s,((h0+h1)/2)*s,(a[1]+uy*mid)*s);m.rotation.y=-Math.atan2(uy,ux);m.castShadow=true;m.receiveShadow=true;group.add(m)});
  });
  /* floor to floor here, and which floor this is, for cores */
  const lvI=opts.lvI!=null?opts.lvI:(S.bld?S.bld.levels.indexOf(bldLevel(S)):0);const stk=S.bld?levelStack(S.bld):null;const ftfH=opts.ftf!=null?opts.ftf:(stk&&stk[lvI]?stk[lvI].ftf:wallH+1150);
  if(!sub)S.objs.forEach(o=>{if(o.t==='item'&&visible(o)&&!o.nests&&!isOpening(o)&&!isCeil(o)&&((o.h||0)>=300||isCol(o)||isCore(o))){
    if(isCore(o)&&o.shape==='stair'){const G=stairGeo(o,ftfH);if(S.bld&&coreUp(S.bld,o,lvI)){const hw=G.hw,hd=G.hd,t=150;[rectP(-G.g0/2,-G.hd+G.Ld,G.g0/2,G.hd),rectP(-hw-t,-hd-t,hw+t,-hd),rectP(-hw-t,-hd,-hw,hd),rectP(hw,-hd,hw+t,hd)].forEach(r=>T3.cols.push({poly:toW(o,r)}))}return}
    if(isCore(o)&&o.shape==='lift'){const t=200,hw=o.w/2,hd=o.d/2,oh=Math.min(550,Math.max(60,(o.w-2*t-200)/2));[rectP(-hw,-hd,hw,-hd+t),rectP(-hw,-hd,-hw+t,hd),rectP(hw-t,-hd,hw,hd),rectP(-hw,hd-t,-oh,hd),rectP(oh,hd-t,hw,hd)].forEach(r=>T3.cols.push({poly:toW(o,r)}));return}
    /* trees: only the trunk blocks the walker, so you can walk under the canopy (shrubs under 1.5 m stay solid) */
    if(o.shape==='tree'&&(o.h||0)>=1500){const r=Math.max(60,Math.min(o.w,o.d)/2*0.05)+40;T3.cols.push({poly:toW(o,rectP(-r,-r,r,r))});return}
    bodyLocal(o).forEach(p=>T3.cols.push({poly:toW(o,p)}))}});
  // furniture
  const showCeil=wallH>=ceilH-5;
  /* walking: a ceiling overhead, open where a stair or lift goes up */
  if(!sub&&WALK.on&&!WALK.roof&&S.bld&&P.wall3d==='full'){const li=S.bld.levels.indexOf(bldLevel(S));const ups=S.objs.filter(o=>isCore(o)&&coreUp(S.bld,o,li));const cm=new THREE.MeshStandardMaterial({color:new THREE.Color(dark?'#3a4048':'#f3f4f5').convertSRGBToLinear(),side:THREE.DoubleSide,roughness:1});
    floorPlate().forEach(poly=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh,ups,poly);const g=new THREE.ShapeGeometry(sh);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,cm);m.position.y=ceilH*s;m.userData.noExport=true;group.add(m);
      /* the floor above, seen through a stair opening */const sh2=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh2,ups,poly);const g2=new THREE.ShapeGeometry(sh2);g2.rotateX(-Math.PI/2);const m2=new THREE.Mesh(g2,cm);m2.position.y=(levelStack(S.bld)[li].ftf-2)*s;m2.userData.noExport=true;group.add(m2)})}
  /* sun study: an invisible ceiling that still casts a shadow, so the interior is lit only through window and door openings and not from an open top. Stair and lift shafts stay open to the sky. */
  if(!sub&&!bldView&&SUN.on&&!WALK.on&&wallH>0){const ups=S.bld?S.objs.filter(o=>isCore(o)&&coreUp(S.bld,o,lvI)):[];const inv=new THREE.MeshBasicMaterial({colorWrite:false,side:THREE.DoubleSide});const cyH=Math.min(ceilH,wallH);
    floorPlate().forEach(poly=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh,ups,poly);const g=new THREE.ShapeGeometry(sh);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,inv);m.position.y=cyH*s;m.castShadow=true;m.receiveShadow=false;m.userData.noExport=true;group.add(m)})}
  S.objs.filter(o=>o.t==='item'&&visible(o)&&(!opts.noFurn||isOpening(o)||isBldObj(o)||isCol(o))&&(!isCeil(o)||showCeil)).forEach(o=>{
    const g=new THREE.Group();g.userData.id=o.id;g.position.set(o.x*s,(+o.z||0)*s,o.y*s);g.rotation.y=-(o.r||0)*Math.PI/180;
    const isSel=sel.has(o.id);const col=o.col||cssColor('--c-'+(CATS[o.cat]||'custom'));
    const m=mat(col,isSel?{emissive:accent,emissiveIntensity:0.45}:null),lm=mat(legCol,isSel?{emissive:accent,emissiveIntensity:0.45}:null);
    const H=Math.max(30,o.h||750),w=o.w,d=o.d,hw=w/2,hd=d/2;
    const add=(geo,mm,x,y,z)=>{const me=new THREE.Mesh(geo,mm);me.position.set(x*s,y*s,z*s);me.castShadow=true;me.receiveShadow=true;g.add(me);return me};
    const box=(x0,z0,x1,z1,y0,y1,mm)=>add(new THREE.BoxGeometry(Math.max(1,x1-x0)*s,Math.max(1,y1-y0)*s,Math.max(1,z1-z0)*s),mm||m,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
    const ext=(poly,y0,y1,mm)=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));const geo=new THREE.ExtrudeGeometry(sh,{depth:Math.max(1,y1-y0)*s,bevelEnabled:false,curveSegments:24});geo.rotateX(-Math.PI/2);return add(geo,mm||m,0,y0,0)};
    const cyl=(r,y0,y1,x,z,mm,r2)=>add(new THREE.CylinderGeometry(r*s,(r2||r)*s,Math.max(1,y1-y0)*s,28),mm||m,x||0,(y0+y1)/2,z||0);
    const shp=o.shape,nm=(o.name||'').toLowerCase();
    if(isCore(o)){const cm=mat(dark?'#8a9097':'#c4c7ca',isSel?{emissive:accent,emissiveIntensity:0.4}:null),full=sub?ftfH:Math.min(ftfH,Math.max(wallH,1));
      if(shp==='stair'){const b=S.bld,up=b?coreUp(b,o,lvI):true,st=b?levelStack(b):null,walk=WALK.on&&!sub,t=150,rail=mat(dark?'#5d6670':'#9aa1a8'),wm=mat(wallCol);
        /* one floor's dog-leg: flight up the left half, landing at the back, flight up the right half; yo lifts or drops it to another floor */
        const flights=(F,yo,cap,firstOnly)=>{const g0=100,fw=(w-g0)/2,Ld=Math.min(fw,d*0.4),R=d-Ld,n=Math.max(4,Math.round(F/170)),n1=Math.ceil(n/2),n2=n-n1,ri=F/n,go1=R/n1,go2=R/n2;
          for(let k=0;k<n1;k++){const tp=(k+1)*ri;if(tp>cap)break;box(-hw,hd-(k+1)*go1,-g0/2,hd-k*go1,yo+Math.max(0,tp-ri-180),yo+tp,cm)}
          if(firstOnly)return;const lt=n1*ri;if(lt<=cap)box(-hw,-hd,hw,-hd+Ld,yo+lt-180,yo+lt,cm);
          for(let k=0;k<n2;k++){const tp=(n1+k+1)*ri;if(tp>cap)break;box(g0/2,-hd+Ld+k*go2,hw,-hd+Ld+(k+1)*go2,yo+tp-ri-180,yo+tp,cm)}
          box(-g0/2,-hd+Ld,g0/2,hd,yo,yo+Math.min(cap,lt+1000),rail)};
        /* the stair enclosure: three walls, open on the entry side */
        const encl=(y0,y1)=>{if(y1<=y0)return;box(-hw-t,-hd-t,hw+t,-hd,y0,y1,wm);box(-hw-t,-hd,-hw,hd,y0,y1,wm);box(hw,-hd,hw+t,hd,y0,y1,wm)};
        if(up){flights(ftfH,0,sub?1e9:Math.max(wallH,1));if(!sub)encl(0,walk?ftfH:Math.min(ftfH,Math.max(wallH,1)))}
        if(walk&&b){
          /* the next floor's first flight carries on above, so the stair reads as one shaft */
          if(up&&st[lvI+1]&&coreUp(b,o,lvI+1)){flights(st[lvI+1].ftf,ftfH,1e9,true);const tc=ftfH+st[lvI+1].ceiling;encl(ftfH,tc);box(-hw-t,-hd-t,hw+t,hd,tc,tc+150,wm)}
          /* and the floor below shows through the opening, with its own stair coming up */
          if(lvI>0&&st[lvI-1]&&coreUp(b,o,lvI-1)){const F=st[lvI-1].ftf;flights(F,-F,1e9);box(-hw,-hd,hw,hd,-F-20,-F,mat(planFloorCol()));encl(-F,0)}}}
      else{const t=shp==='lift'?200:150;box(-hw,-hd,hw,-hd+t,0,full,cm);box(-hw,-hd,-hw+t,hd,0,full,cm);box(hw-t,-hd,hw,hd,0,full,cm);
        if(shp==='lift'){const oh=Math.min(550,Math.max(60,(w-2*t-200)/2)),dh=Math.min(2100,full),pz=hd-t-16;
          box(-hw,hd-t,-oh,hd,0,full,cm);box(oh,hd-t,hw,hd,0,full,cm);if(full>dh)box(-oh,hd-t,oh,hd,dh,full,cm);
          if(!sub){box(-hw+t,-hd+t,hw-t,hd-t,-25,0,mat(dark?'#5a636c':'#aeb4bb'));box(-hw+t,-hd+t,hw-t,hd-t,dh-40,dh,mat(dark?'#6f7881':'#d9dcdf'));box(hw-t-45,-hd+t+150,hw-t,-hd+t+850,900,1550,mat('#8a9097',{metalness:0.5,roughness:0.4}))}
          const slide=Math.min(oh,Math.max(0,hw-t-oh)),dm=mat('#9ea7b0',{metalness:0.65,roughness:0.28});
          const left=add(new THREE.BoxGeometry(Math.max(1,oh)*s,dh*s,32*s),dm,-oh/2,dh/2,pz),right=add(new THREE.BoxGeometry(Math.max(1,oh)*s,dh*s,32*s),dm,oh/2,dh/2,pz);
          const ds0=T3.doorState[o.id],s0=ds0&&ds0.s!=null?ds0.s:(ds0&&ds0.open?1:0);
          left.position.x=(-oh/2-s0*slide)*s;right.position.x=(oh/2+s0*slide)*s;
          T3.liftPiv[o.id]={left,right,lx:-oh/2,rx:oh/2,slide}}
        else box(-hw,hd-t,hw,hd,0,full,cm)}}
    else if(isCeil(o)){const top=ceilH-(o.drop||0),hh=Math.max(10,o.h||50),bot=top-hh,white=mat(dark?'#d5d9dd':'#f4f5f6',isSel?{emissive:accent,emissiveIntensity:0.4}:null),grey=mat('#8c939a',isSel?{emissive:accent,emissiveIntensity:0.4}:null),
        dk=mat('#23282e',isSel?{emissive:accent,emissiveIntensity:0.4}:null),glow=mat('#fffbe8',{emissive:'#fff3c4',emissiveIntensity:isSel?0.5:0.9});
      const hang=y0=>{if(o.drop>0)[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b])=>cyl(3,y0,ceilH,a*hw*0.8,b*hd*0.8,grey))};
      if(shp==='cctv'){cyl(hw,top-25,top,0,0,white);const dm=new THREE.Mesh(new THREE.SphereGeometry(hw*0.8*s,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2),dk);dm.position.y=(top-25)*s;g.add(dm);if(o.drop>0)cyl(15,top,ceilH,0,0,grey)}
      else if(shp==='cctvb'){cyl(30,top-60,ceilH,0,0,grey);const b=new THREE.Group();/* hinged at the top-back on its mount, so tilting swings the lens down and nothing rises into the ceiling */b.position.y=top*s;b.position.z=-d/2*s;b.rotation.x=(o.tilt||0)*Math.PI/180;g.add(b);const bm=new THREE.Mesh(new THREE.BoxGeometry(w*s,hh*s,(d-6)*s),white);bm.position.y=-hh/2*s;bm.position.z=(d/2-3)*s;b.add(bm);const ln=new THREE.Mesh(new THREE.CylinderGeometry(w*0.3*s,w*0.3*s,6*s,16),dk);ln.rotation.x=Math.PI/2;ln.position.y=-hh/2*s;ln.position.z=(d-3)*s;b.add(ln)}
      else if(shp==='fan'){cyl(12,top-hh+120,ceilH,0,0,grey);cyl(90,top-hh,top-hh+120,0,0,white);[0,120,240].forEach(a=>{const bl=new THREE.Mesh(new THREE.BoxGeometry(hw*0.85*s,8*s,130*s),white);const p=new THREE.Group();p.rotation.y=a*Math.PI/180;p.position.y=(top-hh+60)*s;bl.position.x=hw*0.5*s;bl.rotation.x=0.12;p.add(bl);g.add(p)})}
      else if(shp==='pend'){cyl(4,top-hh+150,ceilH,0,0,dk);cyl(hw*0.25,top-hh,top-hh+150,0,0,dk,hw);cyl(hw*0.85,top-hh-2,top-hh,0,0,glow)}
      else if((shp==='panel'||shp==='linear'||shp==='dl')&&o.code!=='EXIT'){if(ROUND_SHAPES.includes(shp))cyl(hw,bot,top,0,0,white);else box(-hw,-hd,hw,hd,bot,top,white);if(ROUND_SHAPES.includes(shp))cyl(hw*0.85,bot-2,bot,0,0,glow);else box(-hw*0.92,-hd*0.92,hw*0.92,hd*0.92,bot-2,bot,glow)}
      else if(shp==='acp'||shp==='baffle'){box(-hw,-hd,hw,hd,bot,top,mat(dark?'#6e7782':'#7d8794',isSel?{emissive:accent,emissiveIntensity:0.4}:null));hang(top)}
      else if(shp==='fcuw'){box(-hw,-hd,hw,hd,bot,top,white);box(-hw*0.88,hd-40,hw*0.88,hd+3,bot+25,bot+70,dk)}
      else if(shp==='fcu'){box(-hw,-hd,hw,hd,bot,top,white);box(-hw*0.6,-hd*0.6,hw*0.6,hd*0.6,bot-3,bot,grey)}
      else if(shp==='grille'||shp==='grillr'){box(-hw,-hd,hw,hd,bot,top,grey)}
      else if(o.code==='EXIT'){box(-hw,-hd,hw,hd,bot,top,mat('#1f9d55',{emissive:'#1f9d55',emissiveIntensity:0.6}));cyl(4,top,ceilH,0,0,grey)}
      else if(ROUND_SHAPES.includes(shp))cyl(hw,bot,top,0,0,white);else box(-hw,-hd,hw,hd,bot,top,white)}
    else if(shp==='col'||shp==='colr'){const cm=mat(dark?'#8a9097':'#b9bdc1',isSel?{emissive:accent,emissiveIntensity:0.4}:null);const top=o.h>0?o.h:Math.max(wallH,1);if(shp==='colr')cyl(hw,0,top,0,0,cm);else box(-hw,-hd,hw,hd,0,top,cm)}
    else if(shp==='window'){const v=openV(o),fr=mat(dark?'#5d6670':'#3a434c',isSel?{emissive:accent,emissiveIntensity:0.4}:null);
      const gl=mat('#a9d3ea',{transparent:true,opacity:0.32,roughness:0.08,metalness:0.1,depthWrite:false});const fw=45,y0=v[0],y1=v[1],dd=Math.min(d,90);
      if(y1-y0>20){const pane=new THREE.Mesh(new THREE.BoxGeometry(Math.max(1,w-2*fw)*s,Math.max(1,y1-y0-2*fw)*s,12*s),gl);pane.position.set(0,(y0+y1)/2*s,0);pane.renderOrder=2;g.add(pane);
        box(-hw,-dd/2,hw,dd/2,y0,y0+fw,fr);box(-hw,-dd/2,hw,dd/2,y1-fw,y1,fr);box(-hw,-dd/2,-hw+fw,dd/2,y0,y1,fr);box(hw-fw,-dd/2,hw,dd/2,y0,y1,fr);
        if(w>2000){const n=Math.ceil(w/1500);for(let k=1;k<n;k++){const x=-hw+k*w/n;box(x-fw/2,-dd/2,x+fw/2,dd/2,y0,y1,fr)}}}
    }else if(/^door/.test(shp)){
      /* each leaf hangs on a pivot at its hinge, so walkthrough can swing it open and shut */
      const dm=mat(o.col||(dark?'#b08a63':'#c9a37b'),isSel?{emissive:accent,emissiveIntensity:0.35}:null);const leaves=shp==='door2'?[{hx:-hw,dir:1,len:hw},{hx:hw,dir:-1,len:hw}]:[o.flip?{hx:hw,dir:-1,len:w}:{hx:-hw,dir:1,len:w}];
      const ds=T3.doorState[o.id]||(T3.doorState[o.id]={open:true,a:Math.PI/2});const piv=[];
      leaves.forEach(L=>{const pv=new THREE.Group();pv.position.set(L.hx*s,0,(hd-20)*s);g.add(pv);const dh=Math.max(600,num(o.h,2100)||2100);const me=new THREE.Mesh(new THREE.BoxGeometry(Math.max(1,L.len-10)*s,dh*s,40*s),dm);me.position.set(L.dir*L.len/2*s,dh/2*s,0);me.castShadow=true;me.receiveShadow=true;pv.add(me);pv.rotation.y=-L.dir*ds.a;piv.push({pv,dir:L.dir})});
      T3.doorPiv[o.id]=piv;
    }else furnitureModel(o,g,{THREE,mat,s,dark,isSel,accent});
    if(!sub&&!isWallish(o)){let fi=0;g.traverse(m=>{if(m.isMesh){m.userData.fid=fi;if(o.faces&&o.faces[fi]!=null)m.material=mat(o.faces[fi],sel.has(o.id)?{emissive:accent,emissiveIntensity:0.3}:null);fi++}})}
    if(!/^door/.test(shp))mergeItemGroup(g,THREE);
    group.add(g);
  });
  if(LY('ceil'))S.objs.filter(o=>o.t==='trunk'&&o.pts&&o.pts.length>=2).forEach(o=>{const top=ceilH-(o.drop||0),hh=Math.max(20,o.h||100),ww=Math.max(20,o.w||150),y=top-hh/2;const mtl=mat(o.col||(dark?'#8a9097':'#b4b9bd'),sel.has(o.id)?{emissive:accent,emissiveIntensity:0.4}:null);
    for(let i=0;i<o.pts.length-1;i++){const a=o.pts[i],bq=o.pts[i+1],L=Math.hypot(bq[0]-a[0],bq[1]-a[1]);if(L<1)continue;const bx=new THREE.Mesh(new THREE.BoxGeometry((L+ww)*s,hh*s,ww*s),mtl);bx.position.set((a[0]+bq[0])/2*s,y*s,(a[1]+bq[1])/2*s);bx.rotation.y=-Math.atan2(bq[1]-a[1],bq[0]-a[0]);bx.castShadow=true;if(!sub)bx.userData.id=o.id;group.add(bx)}});
  if(sub)return{cx,cy,B};
  try{batchItems(group,THREE);/* a big plan always uses the light mode; it goes back to normal with a smaller plan unless slow frames asked for it */if(T3.batched){T3.slowBig=true;lightMode()}else if(T3.slowBig){T3.slowBig=false;if(!T3.slowAuto){T3.slow=false;T3.renderer.setPixelRatio(T3.fullDpr)}}}catch(e){console.warn(e)}
  T3.sh=true;
  if(WALK.on&&WALK.roof&&S.bld)buildRoofWalk(group,{s,mat,dark});
  const R=span*s*0.8;dir.position.set(cx*s+R*0.6,R*1.3,cy*s+R*0.9);dir.target.position.set(cx*s,0,cy*s);const sc=dir.shadow.camera;sc.left=-R;sc.right=R;sc.top=R;sc.bottom=-R;sc.near=0.1;sc.far=R*5;sc.updateProjectionMatrix();
  T3.center=[cx*s,cy*s];T3.span=span*s;
  if(!T3.framed){frame3D('persp');T3.framed=true}
  try{sectionApply();sectionBar();if(!sub)applySun();sunBar();if(!sub)d3Sync()}catch(e){}
  /* SketchUp fork: X-ray, styles and section fill are laid over each fresh build */if(!sub&&typeof SU!=='undefined'&&SU)try{suAfter3D()}catch(e){console.warn(e)}
}
/* ================= 3D furniture models =================
   Local frame: x across the width, z across the depth with the front (user side, clearance side) at +z, y up. Millimetres. */
const PAL={wood:'#7a4a2c',woodD:'#8a5a3a',blk:'#1c2126',fab:'#2b2f34',mesh:'#33383e',steel:'#aeb5bc',grey:'#8b939c',white:'#eef0ef',lam:'#e1e3e4',stone:'#cbc6bd',felt:'#5f6b78',sofa:'#6b7480',glass:'#9fc4d8',red:'#b83a2e',screen:'#0e1114'};
/* the roof's plant and M&E (condensers, AHUs, etc.), sitting on the roof slab at baseY (mm) */
function roofItems(){return(S.bld&&Array.isArray(S.bld.roofFit))?S.bld.roofFit:[]}
function buildRoofFit(group,baseY,K){const{THREE,mat,s,dark}=K,accent=cssColor('--accent');
  roofItems().forEach(o=>{if(o.t!=='item'||!visible(o))return;const g=new THREE.Group();g.position.set(o.x*s,baseY*s,o.y*s);g.rotation.y=-(o.r||0)*Math.PI/180;const isSel=roofMode&&sel.has(o.id);if(!K.sub)g.userData.id=o.id;group.add(g);
    try{furnitureModel(o,g,{THREE,mat,s,dark,isSel,accent});mergeItemGroup(g,THREE)}catch(e){}})}
/* the ground-level site (fence, road, gates, trees) drawn at depth gY, so the perimeter is visible from a roof several storeys up */
function buildRoofSite(group,gY,K){const{THREE,mat,s,dark}=K,b=S.bld;if(!b||!LY('site'))return;const accent=cssColor('--accent');
  const site=(b.cores||[]).filter(isSite),gates=site.filter(g=>g.t==='item'&&g.shape==='gate'&&visible(g));
  site.forEach(o=>{if(!visible(o))return;
    if(o.t==='item'){const g=new THREE.Group();g.position.set(o.x*s,gY*s,o.y*s);g.rotation.y=-(o.r||0)*Math.PI/180;group.add(g);try{furnitureModel(o,g,{THREE,mat,s,dark,isSel:false,accent});mergeItemGroup(g,THREE)}catch(e){}return}
    if(!o.pts||o.pts.length<2)return;const Pp=wallPathPts(o).slice();if(o.closed)Pp.push(Pp[0]);
    const put=(geo,m,x,y,z,ry)=>{const me=new THREE.Mesh(geo,m);me.position.set(x*s,(y+gY)*s,z*s);if(ry)me.rotation.y=ry;me.receiveShadow=true;me.castShadow=o.site==='fence';group.add(me)};
    if(o.site==='road'){const wd=o.th||6000,asp=mat(o.col||(dark?'#3a3f45':'#5b6168'));
      for(let i=0;i<Pp.length-1;i++){const a=Pp[i],bp=Pp[i+1],L=Math.hypot(bp[0]-a[0],bp[1]-a[1]);if(L<1)continue;const ry=-Math.atan2(bp[1]-a[1],bp[0]-a[0]);put(new THREE.BoxGeometry(L*s,25*s,wd*s),asp,(a[0]+bp[0])/2,2.5,(a[1]+bp[1])/2,ry)}return}
    const H=+o.h||2400,post=mat(o.col||(dark?'#5a6a5a':'#3f5545')),mesh=mat(o.col||(dark?'#6f8a77':'#4d6b57'),{transparent:true,opacity:0.45,side:THREE.DoubleSide});
    for(let i=0;i<Pp.length-1;i++){const a=Pp[i],bp=Pp[i+1],L=Math.hypot(bp[0]-a[0],bp[1]-a[1]);if(L<1)continue;const ux=(bp[0]-a[0])/L,uy=(bp[1]-a[1])/L,ry=-Math.atan2(uy,ux);
      const gaps=[];gates.forEach(g=>{const dx=g.x-a[0],dy=g.y-a[1],along=dx*ux+dy*uy,perp=Math.abs(-dx*uy+dy*ux),an=(g.r||0)*Math.PI/180,par=Math.abs(Math.cos(an)*ux+Math.sin(an)*uy);if(perp<(o.th||150)/2+(g.d||200)+300&&par>0.88&&along>-g.w/2&&along<L+g.w/2)gaps.push([Math.max(0,along-g.w/2),Math.min(L,along+g.w/2)])});
      gaps.sort((p,q)=>p[0]-q[0]);const spans=[];let cur=0;gaps.forEach(gp=>{if(gp[0]>cur+1)spans.push([cur,gp[0]]);cur=Math.max(cur,gp[1])});if(cur<L-1)spans.push([cur,L]);if(!gaps.length){spans.length=0;spans.push([0,L])}
      spans.forEach(([s0,s1])=>{const sl=s1-s0;if(sl<1)return;const mx=(s0+s1)/2,cx=a[0]+ux*mx,cz=a[1]+uy*mx,n=Math.max(1,Math.ceil(sl/2500));
        for(let k=0;k<=n;k++){const t=s0+k*sl/n;put(new THREE.BoxGeometry(80*s,H*s,80*s),post,a[0]+ux*t,H/2,a[1]+uy*t,ry)}
        put(new THREE.BoxGeometry(sl*s,60*s,50*s),post,cx,H-30,cz,ry);put(new THREE.BoxGeometry(sl*s,50*s,50*s),post,cx,120,cz,ry);
        put(new THREE.PlaneGeometry(sl*s,(H-180)*s),mesh,cx,(H+60)/2,cz,ry)})}});
}
/* walking on the roof: the top floor drops below, the roof slab, parapet and stair housing take its place */
function buildRoofWalk(group,K){const{THREE}=T3,{s,mat,dark}=K,b=S.bld,li=b.levels.indexOf(bldLevel(S)),st=levelStack(b)[li],F=st.ftf;
  group.children.forEach(ch=>{ch.position.y-=(ch.userData.ground?F+Math.max(0,st.ffl||0):F)*s});
  T3.cols=[];const conc=mat(dark?'#6f767d':'#c9ccc8'),wm=mat(dark?'#56626f':'#e9ecef'),par=+b.parapet||0;
  const ups=S.objs.filter(o=>isCore(o)&&o.shape==='stair'&&coreUp(b,o,li));
  floorPlate().forEach(poly=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh,ups,poly);const geo=new THREE.ExtrudeGeometry(sh,{depth:(st.slab||300)*s,bevelEnabled:false});geo.rotateX(-Math.PI/2);const m=new THREE.Mesh(geo,conc);m.position.y=(30-(st.slab||300))*s;m.receiveShadow=true;group.add(m);
    if(par>0)poly.forEach((a,k)=>{const c=poly[(k+1)%poly.length],L=Math.hypot(c[0]-a[0],c[1]-a[1]);if(L<1)return;const pm=new THREE.Mesh(new THREE.BoxGeometry((L+200)*s,par*s,200*s),conc);pm.position.set((a[0]+c[0])/2*s,par/2*s,(a[1]+c[1])/2*s);pm.rotation.y=-Math.atan2(c[1]-a[1],c[0]-a[0]);pm.castShadow=true;pm.receiveShadow=true;group.add(pm);T3.cols.push({a,b:c,t:200})})});
  /* stair housing: three walls and a roof, open on the side you step out of */
  ups.forEach(o=>{const hw=o.w/2,hd=o.d/2,t=150,H=2700,g=new THREE.Group();g.position.set(o.x*s,0,o.y*s);g.rotation.y=-(o.r||0)*Math.PI/180;
    const bx=(x0,z0,x1,z1,y0,y1,m)=>{const me=new THREE.Mesh(new THREE.BoxGeometry((x1-x0)*s,(y1-y0)*s,(z1-z0)*s),m);me.position.set((x0+x1)/2*s,(y0+y1)/2*s,(z0+z1)/2*s);me.castShadow=true;me.receiveShadow=true;g.add(me)};
    bx(-hw-t,-hd-t,hw+t,-hd,-F,H,wm);bx(-hw-t,-hd,-hw,hd,-F,H,wm);bx(hw,-hd,hw+t,hd,-F,H,wm);bx(-hw-t,-hd-t,hw+t,hd,H,H+200,conc);group.add(g);
    const G=stairGeo(o,F);[rectP(-hw-t,-hd-t,hw+t,-hd),rectP(-hw-t,-hd,-hw,hd),rectP(hw,-hd,hw+t,hd),rectP(-hw,-hd,G.g0/2,hd),rectP(-hw,-hd,hw,-hd+G.Ld)].forEach(r=>T3.cols.push({poly:toW(o,r)}))});
  if(li>groundI(b))buildRoofSite(group,30-(st.ffl+F),{THREE,mat,s,dark});
  buildRoofFit(group,30,{THREE,mat,s,dark})}
/* big plans: thousands of items mean tens of thousands of draw calls, and the frame rate goes with the number of calls, not the number of triangles.
   Above BATCH_MIN meshes, the furniture that is not selected is drawn as one mesh per material. Each item keeps its own meshes, hidden, so a click
   still finds the item and its painted face; a selected item is left out and drawn on its own, so it can be dragged and highlighted as before.
   Doors, lifts and cameras keep their own meshes too (they move or are hidden on their own). */
const BATCH_MIN=4000,BATCH_VERTS=1500000;
function batchItems(group,THREE){T3.batched=0;const by=new Map();let n=0;
  group.children.forEach(g=>{const id=g.userData.id;if(!g.isGroup||!id||!g.visible||sel.has(id)||T3.doorPiv[id]||T3.liftPiv[id])return;const o=byId(id);if(!o||o.t!=='item'||isOpening(o)||/^cctv/.test(o.shape||''))return;
    g.children.forEach(m=>{if(!m.isMesh||!m.visible||m.children.length||m.renderOrder||Array.isArray(m.material)||!m.material||m.material.transparent||!m.geometry||!m.geometry.attributes.position||!m.geometry.attributes.normal)return;n++;if(!by.has(m.material))by.set(m.material,[]);by.get(m.material).push([g,m])})});
  if(n<BATCH_MIN)return;const v=new THREE.Vector3(),M=new THREE.Matrix4(),nm=new THREE.Matrix3();
  by.forEach((all,material)=>{if(all.length<2)return;const hasUv=all.every(x=>x[1].geometry.attributes.uv);if(material.map&&!hasUv)return;
    /* in chunks, so one buffer never grows past what a phone will take */let i0=0;while(i0<all.length){let nv=0,ni=0,i1=i0;while(i1<all.length){const ge=all[i1][1].geometry,c=ge.attributes.position.count;if(i1>i0&&nv+c>BATCH_VERTS)break;nv+=c;ni+=ge.index?ge.index.count:c;i1++}
      const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),uv=hasUv?new Float32Array(nv*2):null,idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni);let vo=0,io=0;
      for(let k=i0;k<i1;k++){const g=all[k][0],m=all[k][1];g.updateMatrix();m.updateMatrix();M.multiplyMatrices(g.matrix,m.matrix);nm.getNormalMatrix(M);const ge=m.geometry,Pa=ge.attributes.position,Na=ge.attributes.normal,Ua=ge.attributes.uv,c=Pa.count;
        for(let i=0;i<c;i++){v.fromBufferAttribute(Pa,i).applyMatrix4(M);pos[(vo+i)*3]=v.x;pos[(vo+i)*3+1]=v.y;pos[(vo+i)*3+2]=v.z;v.fromBufferAttribute(Na,i).applyMatrix3(nm).normalize();nor[(vo+i)*3]=v.x;nor[(vo+i)*3+1]=v.y;nor[(vo+i)*3+2]=v.z;if(uv){uv[(vo+i)*2]=Ua.getX(i);uv[(vo+i)*2+1]=Ua.getY(i)}}
        const cnt=ge.index?ge.index.count:c;if(ge.index){const ia=ge.index.array;for(let i=0;i<cnt;i++)idx[io+i]=ia[i]+vo}else{for(let i=0;i<cnt;i++)idx[io+i]=vo+i}vo+=c;io+=cnt;m.visible=false;T3.batched++}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));if(uv)geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(new THREE.BufferAttribute(idx,1));
      const me=new THREE.Mesh(geo,material);me.castShadow=true;me.receiveShadow=true;me.userData.batch=true;/* clicks go to the item's own hidden meshes */me.raycast=()=>{};group.add(me);i0=i1}})}
/* fewer draw calls: the plain meshes of one item, grouped by material, become a single mesh per material.
   Each piece's face id survives as an index range, so painting one piece still works (see fidAt). */
function mergeItemGroup(g,THREE){const by=new Map();
  g.children.forEach(m=>{if(!m.isMesh||m.renderOrder||m.children.length||!m.geometry||!m.geometry.attributes.position||!m.geometry.attributes.normal||m.material.transparent)return;if(!by.has(m.material))by.set(m.material,[]);by.get(m.material).push(m)});
  by.forEach((list,material)=>{if(list.length<2)return;let nv=0,ni=0;const hasUv=list.every(m=>m.geometry.attributes.uv);
    list.forEach(m=>{const ge=m.geometry;nv+=ge.attributes.position.count;ni+=ge.index?ge.index.count:ge.attributes.position.count});
    const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),uv=hasUv?new Float32Array(nv*2):null,idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni),ranges=[];let vo=0,io=0;const v=new THREE.Vector3(),nm=new THREE.Matrix3();
    list.forEach(m=>{m.updateMatrix();const ge=m.geometry,Pa=ge.attributes.position,Na=ge.attributes.normal,Ua=ge.attributes.uv,n=Pa.count;nm.getNormalMatrix(m.matrix);
      for(let i=0;i<n;i++){v.fromBufferAttribute(Pa,i).applyMatrix4(m.matrix);pos[(vo+i)*3]=v.x;pos[(vo+i)*3+1]=v.y;pos[(vo+i)*3+2]=v.z;v.fromBufferAttribute(Na,i).applyMatrix3(nm).normalize();nor[(vo+i)*3]=v.x;nor[(vo+i)*3+1]=v.y;nor[(vo+i)*3+2]=v.z;if(uv){uv[(vo+i)*2]=Ua.getX(i);uv[(vo+i)*2+1]=Ua.getY(i)}}
      const cnt=ge.index?ge.index.count:n;if(ge.index){for(let i=0;i<cnt;i++)idx[io+i]=ge.index.getX(i)+vo}else{for(let i=0;i<cnt;i++)idx[io+i]=vo+i}
      ranges.push({fid:m.userData.fid,start:io/3,count:cnt/3});vo+=n;io+=cnt});
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));if(uv)geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(new THREE.BufferAttribute(idx,1));
    const me=new THREE.Mesh(geo,material);me.castShadow=true;me.receiveShadow=true;me.userData.fid=ranges[0].fid;me.userData.fidRanges=ranges;
    list.forEach(m=>{g.remove(m);m.geometry.dispose()});g.add(me)})}
/* the face id under a raycast hit, for merged meshes */
function fidAt(obj,hit){const R=obj&&obj.userData.fidRanges;if(R&&hit&&hit.faceIndex!=null){const f=hit.faceIndex;for(const r of R)if(f>=r.start&&f<r.start+r.count)return r.fid}return obj?obj.userData.fid:null}
function furnitureModel(o,g,K){
  const{THREE,mat,s,dark,isSel,accent}=K;
  const M=(c,opt)=>mat(c,Object.assign({},opt||{},isSel?{emissive:accent,emissiveIntensity:0.32}:{}));
  const add=(geo,mm,x,y,z)=>{const me=new THREE.Mesh(geo,mm);me.position.set(x*s,y*s,z*s);me.castShadow=true;me.receiveShadow=true;g.add(me);return me};
  const box=(x0,z0,x1,z1,y0,y1,mm)=>add(new THREE.BoxGeometry(Math.max(1,x1-x0)*s,Math.max(1,y1-y0)*s,Math.max(1,z1-z0)*s),mm,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  const ext=(poly,y0,y1,mm)=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));const geo=new THREE.ExtrudeGeometry(sh,{depth:Math.max(1,y1-y0)*s,bevelEnabled:false,curveSegments:24});geo.rotateX(-Math.PI/2);return add(geo,mm,0,y0,0)};
  const cyl=(r,y0,y1,x,z,mm,r2,seg)=>add(new THREE.CylinderGeometry(r*s,(r2==null?r:r2)*s,Math.max(1,y1-y0)*s,seg||24),mm,x||0,(y0+y1)/2,z||0);
  const sph=(r,x,y,z,mm)=>add(new THREE.SphereGeometry(r*s,14,10),mm,x,y,z);
  const rrect=(hw,hd,r)=>{r=Math.min(r,hw,hd);const p=[];[[hw-r,-hd+r,-Math.PI/2],[hw-r,hd-r,0],[-hw+r,hd-r,Math.PI/2],[-hw+r,-hd+r,Math.PI]].forEach(([cx,cy,a0])=>{for(let k=0;k<=5;k++){const t=a0+k/5*Math.PI/2;p.push([cx+Math.cos(t)*r,cy+Math.sin(t)*r])}});return p};
  const H=Math.max(30,o.h||750),w=o.w,d=o.d,hw=w/2,hd=d/2,shp=o.shape,nm=(o.name||'').toLowerCase(),code=(o.code||'').toUpperCase();
  const wood=M(dark?PAL.woodD:PAL.wood),blk=M(PAL.blk),steel=M(PAL.steel,{metalness:0.5,roughness:0.4});
  const caster=(x,z)=>{sph(22,x,24,z,blk)};
  /* site items: trees, gates, barriers, parking, guardhouse */
  if(o.cat==='Site'){
    if(shp==='tree'){const leaf=M(dark?'#3f6b45':'#5f9a5c');if(H<1500){add(new THREE.SphereGeometry(1,16,12),leaf,0,H/2,0).scale.set(hw*s,H/2*s,hd*s);return}
      cyl(Math.max(60,Math.min(hw,hd)*0.05),0,H*0.5,0,0,M('#6b4f3a'),null,10);add(new THREE.SphereGeometry(1,18,14),leaf,0,H*0.66,0).scale.set(hw*s,H*0.34*s,hd*s);return}
    if(shp==='gate'){const st=M(dark?'#4a5560':'#39424b',{metalness:0.4,roughness:0.5});box(-hw,-hd,hw,hd,H-60,H,st);box(-hw,-hd,hw,hd,80,140,st);box(-hw,-hd,-hw+80,hd,0,H,st);box(hw-80,-hd,hw,hd,0,H,st);
      const n=Math.max(2,Math.round(w/150));for(let i=1;i<n;i++){const x=-hw+i*w/n;box(x-12,-12,x+12,12,80,H-60,st)}return}
    if(shp==='boom'){const pw=Math.min(400,w*0.1);box(-hw,-hd,-hw+pw,hd,0,H,M('#e9e6df'));const n=Math.max(2,Math.round((w-pw)/500));for(let i=0;i<n;i++){const x0=-hw+pw+i*(w-pw)/n;box(x0,-40,x0+(w-pw)/n,40,H-180,H-100,M(i%2?'#f4f4f0':'#d2402f'))}return}
    if(shp==='parking'){const ln=M('#f2f2ee');box(-hw,-hd,hw,hd,-10,16,M(dark?'#3a3f45':'#5b6168'));box(-hw,-hd,-hw+100,hd,16,22,ln);box(hw-100,-hd,hw,hd,16,22,ln);box(-hw,hd-100,hw,hd,16,22,ln);return}
    if(/guard/.test(nm)){box(-hw,-hd,hw,hd,0,H-250,M('#e8e4dc'));box(-hw-300,-hd-300,hw+300,hd+300,H-250,H,M('#5b6168'));box(-hw*0.75,hd-10,hw*0.75,hd+10,1000,H-600,M('#2c3e50',{metalness:0.3,roughness:0.2}));return}
    if(shp==='round'){cyl(hw,0,H,0,0,M('#c9ccd0'),null,16);cyl(hw,H-180,H-120,0,0,M('#e8b400'),null,16);return}}
  /* cabinet body with fronts (doors or drawers) drawn as panels with seams and handles */
  const cabinet=(y0,y1,body,front,fronts,handle)=>{box(-hw,-hd,hw,hd-18,y0,y1,body);
    fronts.forEach(f=>{box(f[0]+3,hd-18,f[1]-3,hd,f[2]+3,f[3]-3,front);if(handle!==false){const hx=f[4]!=null?f[4]:(f[0]+f[1])/2,hy=f[5]!=null?f[5]:f[3]-60;box(hx-(f[6]?8:60),hd,hx+(f[6]?8:60),hd+18,hy-(f[6]?80:8),hy+(f[6]?80:8),steel)}})};
  const isHA=/height.?adjustable|sit.?stand/.test(nm)||/^HA/.test(code);
  const isTable=['rect','round','L'].includes(shp)&&o.cat!=='Partition'&&(o.cat==='Workstation'||o.cat==='Meeting'||/table|desk/.test(nm))&&!/pod|booth|screen/.test(nm);

  /* ---------- tables: timber top, black frame ---------- */
  if(isTable&&shp==='rect'&&isHA){
    const top=25,cx=hw-Math.min(180,w*0.13),fz=Math.min(hd-20,330);
    ext(rrect(hw,hd,Math.min(45,w*0.05)),H-top,H,wood);
    [-1,1].forEach(sg=>{const x=sg*cx;box(x-35,-fz,x+35,fz,12,45,blk);[-fz+25,fz-25].forEach(z=>cyl(18,0,12,x,z,blk));
      box(x-42,-32,x+42,32,45,Math.min(H*0.5,560),blk);box(x-34,-25,x+34,25,Math.min(H*0.5,560),H-top-30,blk);box(x-25,-hd*0.8,x+25,hd*0.8,H-top-30,H-top,blk)});
    box(-cx,-15,cx,15,H-top-28,H-top-2,blk);box(hw-260,hd-12,hw-150,hd+14,H-top-22,H-top-4,blk);return}
  if(isTable&&shp==='round'){const top=30;ext(ellP(hw,hd,48),H-top,H,wood);cyl(38,60,H-top,0,0,blk);
    for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,L=Math.min(w,d)*0.34;const leg=new THREE.Mesh(new THREE.BoxGeometry(L*s,35*s,50*s),blk);leg.geometry.translate(L/2*s,0,0);leg.position.set(0,18*s,0);leg.rotation.y=-a;leg.castShadow=true;g.add(leg)}
    cyl(Math.min(w,d)*0.1,40,70,0,0,blk);return}
  if(isTable){
    const top=/coffee/.test(nm)?30:25;
    bodyLocal(o).forEach(p=>ext(p,H-top,H,wood));
    if(/cafe/.test(nm)){cyl(35,40,H-top,0,0,blk);box(-hw*0.75,-30,hw*0.75,30,0,30,blk);box(-30,-hd*0.75,30,hd*0.75,0,30,blk);return}
    bodyLocal(o).forEach(p=>{const b=bboxPts(p),i=40,l=50,fr=40;
      [[b.x0+i,b.y0+i],[b.x1-i-l,b.y0+i],[b.x0+i,b.y1-i-l],[b.x1-i-l,b.y1-i-l]].forEach(([x,z])=>box(x,z,x+l,z+l,0,H-top,blk));
      /* apron frame under the top */
      box(b.x0+i,b.y0+i,b.x1-i,b.y0+i+fr,H-top-60,H-top,blk);box(b.x0+i,b.y1-i-fr,b.x1-i,b.y1-i,H-top-60,H-top,blk);
      box(b.x0+i,b.y0+i,b.x0+i+fr,b.y1-i,H-top-60,H-top,blk);box(b.x1-i-fr,b.y0+i,b.x1-i,b.y1-i,H-top-60,H-top,blk);
      if((b.x1-b.x0)>2600&&/bench/.test(nm)){const x=(b.x0+b.x1)/2;box(x-25,b.y0+i,x+25,b.y0+i+l,0,H-top,blk);box(x-25,b.y1-i-l,x+25,b.y1-i,0,H-top,blk)}});
    if(/bench/.test(nm))box(-hw+60,-12,hw-60,12,H-top,H-top+380,M(PAL.felt));
    return}

  /* ---------- chairs ---------- */
  if(shp==='chair'&&(/pantry|cafe/.test(nm)||code==='CH-PAN')){
    const sh=450;[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>box(sx*(hw-40)-12,sz*(hd-45)-12,sx*(hw-40)+12,sz*(hd-45)+12,0,sh,blk));
    box(-hw+20,-hd+25,hw-20,hd-10,sh-20,sh+10,wood);[-1,1].forEach(sx=>box(sx*(hw-40)-12,-hd+33,sx*(hw-40)+12,-hd+57,sh,H-20,blk));
    box(-hw+30,-hd+30,hw-30,-hd+55,H-170,H,wood);return}
  if(shp==='chair'){
    /* office chair: five-star base on castors, gas lift, upholstered seat, mesh back, T-arms, headrest on executive chairs */
    const head=/exec/.test(nm)||code==='CH-EXEC';const R=Math.min(w,d)*0.46,seatY=470;
    for(let i=0;i<5;i++){const a=i*2*Math.PI/5-Math.PI/2;const leg=new THREE.Mesh(new THREE.BoxGeometry(R*s,26*s,44*s),blk);leg.geometry.translate(R/2*s,0,0);leg.position.set(0,62*s,0);leg.rotation.y=-a;leg.castShadow=true;g.add(leg);caster(Math.cos(a)*(R-18),Math.sin(a)*(R-18))}
    cyl(40,50,90,0,0,blk);cyl(22,90,seatY-60,0,0,steel);box(-70,-80,70,80,seatY-70,seatY-40,blk);
    const sw=Math.min(w*0.78,520),sd=Math.min(d*0.78,500);ext(rrect(sw/2,sd/2,60).map(p=>[p[0],p[1]+20]),seatY-40,seatY+25,M(PAL.fab));
    const backTop=H-(head?190:0),bh=Math.max(320,backTop-(seatY+90));
    box(-25,-sd/2-10,25,-sd/2+50,seatY-40,seatY+90,blk);
    const back=new THREE.Group();back.position.set(0,(seatY+90)*s,(-sd/2+5)*s);back.rotation.x=-0.13;g.add(back);
    const bw=sw*0.92;const panel=new THREE.Mesh(new THREE.BoxGeometry(bw*s,bh*s,22*s),M(PAL.mesh,{transparent:true,opacity:0.92}));panel.position.set(0,bh/2*s,0);panel.castShadow=true;back.add(panel);
    [[-bw/2,1],[bw/2,-1]].forEach(([x])=>{const f=new THREE.Mesh(new THREE.BoxGeometry(28*s,bh*s,32*s),blk);f.position.set(x*s,bh/2*s,0);f.castShadow=true;back.add(f)});
    const tf=new THREE.Mesh(new THREE.BoxGeometry(bw*s,28*s,32*s),blk);tf.position.set(0,bh*s,0);back.add(tf);
    const lum=new THREE.Mesh(new THREE.BoxGeometry(bw*0.7*s,60*s,30*s),blk);lum.position.set(0,bh*0.28*s,12*s);back.add(lum);
    if(head){const post=new THREE.Mesh(new THREE.BoxGeometry(40*s,120*s,20*s),blk);post.position.set(0,(bh+50)*s,-6*s);back.add(post);
      const hr=new THREE.Mesh(new THREE.BoxGeometry(bw*0.62*s,130*s,45*s),M(PAL.fab));hr.position.set(0,(bh+150)*s,0);hr.castShadow=true;back.add(hr)}
    if(hasArms(o)){const ax=sw/2+25;[-1,1].forEach(sg=>{box(sg*ax-14,-30,sg*ax+14,10,seatY-30,seatY+190,blk);box(sg*ax-38,-sd*0.35,sg*ax+38,sd*0.32,seatY+190,seatY+220,M(PAL.fab))})}
    return}
  if(shp==='round'&&o.cat==='Seating'){cyl(hw,H-55,H,0,0,M(PAL.fab));cyl(24,70,H-55,0,0,steel);add(new THREE.TorusGeometry(hw*0.7*s,10*s,8,32),steel,0,300,0).rotation.x=Math.PI/2;cyl(hw*0.8,0,25,0,0,blk);return}

  /* ---------- lounge ---------- */
  if(shp==='sofa'){const fb=M(PAL.sofa),ar=Math.min(w*0.12,180),seat=430;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>box(sx*(hw-50)-15,sz*(hd-50)-15,sx*(hw-50)+15,sz*(hd-50)+15,0,90,blk));
    box(-hw,-hd,hw,hd,90,seat-90,fb);const n=Math.max(1,Math.round((w-2*ar)/650));const cw=(w-2*ar)/n;
    for(let i=0;i<n;i++)box(-hw+ar+i*cw+6,-hd+d*0.25,-hw+ar+(i+1)*cw-6,hd-10,seat-90,seat,fb);
    box(-hw,-hd,hw,-hd+d*0.24,90,H,fb);box(-hw,-hd,-hw+ar,hd,90,600,fb);box(hw-ar,-hd,hw,hd,90,600,fb);return}
  if(/pod|booth/.test(nm)){const fe=M(PAL.felt),gl=M(PAL.glass,{transparent:true,opacity:0.28,roughness:0.1});const t=50;
    box(-hw,-hd,hw,hd,0,40,blk);box(-hw,-hd,hw,-hd+t,40,H-60,fe);box(-hw,-hd,-hw+t,hd,40,H-60,fe);box(hw-t,-hd,hw,hd,40,H-60,fe);box(-hw,-hd,hw,hd,H-60,H,fe);
    box(-hw+t,hd-12,hw-t,hd,40,H-60,gl);box(hw*0.55-15,hd,hw*0.55+15,hd+30,1000,1150,steel);
    if(w>1500){box(-hw*0.5,-hd*0.25,hw*0.5,hd*0.25,700,725,wood);box(-hw*0.5+60,-25,-hw*0.5+100,25,40,700,blk);box(hw*0.5-100,-25,hw*0.5-60,25,40,700,blk);
      [-1,1].forEach(sz=>box(-hw*0.55,sz*hd*0.62-120,hw*0.55,sz*hd*0.62+120,40,450,fe))}
    else{box(-hw+t,-hd+t,hw-t,-hd+t+300,1000,1025,wood);box(-hw*0.35,-hd*0.1,hw*0.35,hd*0.3,40,560,fe)}
    const light=box(-hw*0.3,-hd*0.3,hw*0.3,hd*0.3,H-75,H-60,M('#fff8e6',{emissive:'#fff1c9',emissiveIntensity:0.6}));return}

  /* ---------- storage ---------- */
  if(code==='PED'||/pedestal/.test(nm)){const b=M(PAL.lam);cabinet(60,H,b,b,[[-hw,hw,H-140,H],[-hw,hw,H-330,H-140],[-hw,hw,60,H-330]]);[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>caster(sx*(hw-50),sz*(hd-60)));return}
  if(/locker/.test(nm)){const b=M(PAL.lam),f=M('#c9ced3');box(-hw,-hd,hw,hd,0,80,blk);const n=Math.max(1,Math.round(w/300));const cw=w/n;
    cabinet(80,H,b,f,Array.from({length:n},(_,i)=>[-hw+i*cw,-hw+(i+1)*cw,80,H,-hw+(i+1)*cw-40,H*0.55,true]));
    for(let i=0;i<n;i++)for(let k=0;k<4;k++)box(-hw+i*cw+cw*0.3,hd,-hw+i*cw+cw*0.7,hd+4,H-120-k*25,H-110-k*25,blk);return}
  if(/bookshelf/.test(nm)){const b=wood;box(-hw,-hd,-hw+20,hd,0,H,b);box(hw-20,-hd,hw,hd,0,H,b);box(-hw,-hd,hw,-hd+10,0,H,b);const n=Math.max(3,Math.round(H/360));for(let i=0;i<=n;i++){const y=i*(H-20)/n;box(-hw+20,-hd+10,hw-20,hd,y,y+20,b)}return}
  if(/mobile shelving/.test(nm)){const ep=M('#7f8b97'),sh=M(PAL.lam);const n=Math.max(2,Math.round(d/480)),cd=d/n;
    box(-hw,-hd,hw,hd,0,30,steel);
    for(let i=0;i<n;i++){const z0=-hd+i*cd+10,z1=-hd+(i+1)*cd-10;box(-hw,z0,-hw+30,z1,30,H,ep);box(hw-30,z0,hw,z1,30,H,ep);
      for(let k=0;k<6;k++){const y=60+k*(H-120)/5;box(-hw+30,z0+20,hw-30,z1-20,y,y+18,sh)}
      const wh=add(new THREE.TorusGeometry(90*s,10*s,8,24),steel,hw+40,1100,(z0+z1)/2);wh.rotation.y=Math.PI/2;cyl(15,1090,1110,hw+20,(z0+z1)/2,steel)}return}
  if(/credenza/.test(nm)){const b=wood;[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>box(sx*(hw-40)-15,sz*(hd-40)-15,sx*(hw-40)+15,sz*(hd-40)+15,0,150,blk));
    const n=Math.max(2,Math.round(w/400)),cw=w/n;cabinet(150,H,b,b,Array.from({length:n},(_,i)=>[-hw+i*cw,-hw+(i+1)*cw,150,H,i%2?-hw+i*cw+40:-hw+(i+1)*cw-40,H-120,true]));return}
  if(/filing/.test(nm)){const b=M(PAL.lam);box(-hw,-hd,hw,hd,0,60,blk);const n=Math.max(2,Math.round((H-60)/330)),dh=(H-60)/n;cabinet(60,H,b,b,Array.from({length:n},(_,i)=>[-hw,hw,60+i*dh,60+(i+1)*dh]));return}
  if(/cabinet/.test(nm)&&o.cat==='Storage'){const b=M(PAL.lam);box(-hw,-hd,hw,hd,0,60,blk);cabinet(60,H,b,b,[[-hw,0,60,H,-40,H*0.55,true],[0,hw,60,H,40,H*0.55,true]]);return}

  /* ---------- pantry ---------- */
  const counter=(top2)=>{const base=M(PAL.white),top=M(PAL.stone);box(-hw+10,-hd+10,hw-10,hd-60,0,100,blk);
    const n=Math.max(1,Math.round(w/600)),cw=w/n;cabinet(100,H-35,base,base,Array.from({length:n},(_,i)=>[-hw+i*cw,-hw+(i+1)*cw,100,H-35,-hw+(i+0.5)*cw,H-110]));box(-hw,-hd,hw,hd+20,H-35,H,top);if(top2)box(-hw,-hd-280,hw,-hd,H-35,H,top)};
  if(code.startsWith('PC')||/pantry counter/.test(nm)){counter();return}
  if(/island/.test(nm)){counter(false);box(-hw,-hd-250,hw,hd,H-35,H,M(PAL.stone));return}
  if(/sink/.test(nm)){counter();box(-w*0.3,-d*0.25,w*0.3,d*0.25,H-2,H+2,M('#5d666e'));cyl(14,H,H+260,0,-d*0.32,steel);box(-14,-d*0.32,14,-d*0.08,H+240,H+262,steel);return}
  if(/fridge/.test(nm)){const ss=M('#c3c8cc',{metalness:0.4,roughness:0.35});box(-hw,-hd,hw,hd-15,0,H,ss);box(-hw+4,hd-15,hw-4,hd,H*0.68+3,H-4,ss);box(-hw+4,hd-15,hw-4,hd,40,H*0.68-3,ss);
    [[H*0.68+40,H-60],[H*0.68-400,H*0.68-40]].forEach(([y0,y1])=>box(hw-70,hd,hw-50,hd+30,y0,y1,steel));box(-hw,-hd,hw,hd,0,40,blk);return}
  if(/water dispenser/.test(nm)){box(-hw,-hd,hw,hd,0,H-260,M(PAL.white));box(-hw*0.6,hd-5,hw*0.6,hd+2,H-560,H-380,M('#d9dde0'));cyl(12,H-470,H-430,-60,hd+15,blk);cyl(12,H-470,H-430,60,hd+15,M(PAL.red));
    cyl(Math.min(w,d)*0.38,H-260,H,0,0,M('#4f8fc0',{transparent:true,opacity:0.55}),Math.min(w,d)*0.38,28);return}
  if(/vending/.test(nm)){box(-hw,-hd,hw,hd-15,0,H,blk);box(-hw+40,hd-15,hw*0.4,hd,200,H-120,M('#22364a',{transparent:true,opacity:0.75,roughness:0.1}));
    for(let k=0;k<5;k++){const y=320+k*(H-500)/5;box(-hw+60,hd-200,hw*0.4-20,hd-20,y,y+12,steel)}box(hw*0.5,hd-15,hw-40,hd+4,H*0.55,H*0.75,M('#2d3238'));box(hw*0.55,hd-15,hw-60,hd+4,120,260,M('#0b0d0f'));return}
  if(/recycl|bin/.test(nm)){const n=3,cw=w/n,lids=['#2d6fb8','#3c9a53','#3b4148'];for(let i=0;i<n;i++){const x0=-hw+i*cw+8,x1=-hw+(i+1)*cw-8;box(x0,-hd,x1,hd,0,H-40,M('#9aa3ab'));box(x0-4,-hd-4,x1+4,hd+4,H-40,H,M(lids[i]));box(x0+cw*0.25,hd-30,x1-cw*0.25,hd+5,H-25,H+2,blk)}return}

  /* ---------- IT ---------- */
  if(shp==='rack'){
    /* grey body, white doors front and back; split doors when the swing is half the width */
    const body=M(PAL.grey),door=M(PAL.white),y0=/wall.?mount/.test(nm)?1500:0;
    box(-hw,-hd+20,hw,hd-20,y0+(y0?0:60),y0+H,body);if(!y0)box(-hw+20,-hd+40,hw-20,hd-40,0,60,blk);
    const doors=(zf,sg,leaf)=>{const split=leaf>0&&leaf<=w/2+1;const panels=split?[[-hw+3,-1.5],[1.5,hw-3]]:[[-hw+3,hw-3]];
      panels.forEach(([x0,x1])=>{box(x0,zf-20*(sg>0?1:0),x1,zf+20*(sg>0?0:-1)*-1,y0+(y0?15:75),y0+H-15,door);
        for(let k=0;k<10;k++){const yy=y0+H*0.15+k*(H*0.7/10);box(x0+30,sg>0?zf:zf-3,x1-30,sg>0?zf+3:zf,yy,yy+(H*0.7/10)*0.45,M('#d3d7da'))}
        const hx=split?(x0<0?x1-40:x0+40):x1-45;box(hx-10,sg>0?zf:zf-25,hx+10,sg>0?zf+25:zf,y0+H*0.48,y0+H*0.6,M(PAL.blk))})};
    if(o.cf>0)doors(hd,1,o.cf);else box(-hw,hd-20,hw,hd,y0,y0+H,body);
    if(o.cb>0)doors(-hd,-1,o.cb);else box(-hw,-hd,hw,-hd+20,y0,y0+H,body);
    box(-hw,-hd,hw,hd,y0+H-12,y0+H,M('#7a828b'));return}
  if(/precision air/.test(nm)){const b=M('#e6e7e3');box(-hw,-hd,hw,hd,0,H,b);for(let i=0;i<3;i++){const x0=-hw+20+i*(w-40)/3;box(x0+10,hd,x0+(w-40)/3-10,hd+6,120,H*0.55,M('#cfd2cf'));for(let k=0;k<12;k++)box(x0+30,hd+6,x0+(w-40)/3-30,hd+9,160+k*((H*0.55-200)/12),168+k*((H*0.55-200)/12),M('#9aa0a4'))}
    box(-hw+40,hd,-hw+260,hd+5,H-320,H-140,M('#20262c'));return}
  if(/cylinder/.test(nm)){const r=Math.min(w,d)/2*0.9;cyl(r,0,H-r,0,0,M(PAL.red),r,28);add(new THREE.SphereGeometry(r*s,24,12,0,Math.PI*2,0,Math.PI/2),M(PAL.red),0,H-r,0);cyl(30,H-10,H+70,0,0,steel);box(-60,-12,60,12,H+40,H+60,steel);return}

  /* ---------- equipment ---------- */
  if(/printer|mfd/.test(nm)||code==='MFD'){const b=M('#dcdfe2'),dk=M('#4a5058');box(-hw,-hd,hw,hd,0,80,blk);
    for(let k=0;k<3;k++)box(-hw+8,hd-6,hw-8,hd+4,90+k*170,240+k*170,b);box(-hw,-hd,hw,hd-6,80,H-260,b);
    box(-hw,-hd,hw,hd,H-260,H-200,dk);box(-hw+10,-hd+10,hw-10,hd-10,H-200,H-60,b);box(-hw+10,-hd+10,hw-10,hd-10,H-60,H,M('#c4c8cc'));
    const p=box(hw-230,hd-30,hw-20,hd+80,H-90,H-70,M('#20262c'));p.rotation.x=0.4;return}
  if(/shredder/.test(nm)){box(-hw,-hd,hw,hd,0,H-120,blk);box(-hw,-hd,hw,hd,H-120,H,M('#2f353b'));box(-hw*0.6,-8,hw*0.6,8,H,H+2,M('#0b0d0f'));box(-hw+30,hd,hw-30,hd+4,80,H-180,M('#2a3036'));return}
  if(/whiteboard/.test(nm)){const al=steel;[-1,1].forEach(sg=>{const x=sg*(hw-60);box(x-20,-hd,x+20,hd,40,80,blk);caster(x,-hd+40);caster(x,hd-40);box(x-18,-18,x+18,18,80,H,al)});
    box(-hw+40,-12,hw-40,12,H-1250,H-30,M('#fbfbf9'));box(-hw+30,-18,hw-30,18,H-30,H-10,al);box(-hw+30,-18,hw-30,18,H-1270,H-1250,al);box(-hw*0.5,12,hw*0.5,70,H-1270,H-1250,al);return}
  if(/display|tv/.test(nm)){const sw=Math.min(w-20,1680),sh=Math.min(980,H*0.5);[-1,1].forEach(sg=>{const x=sg*Math.min(260,hw*0.3);box(x-25,-hd,x+25,hd,40,80,blk);caster(x,-hd+40);caster(x,hd-40);box(x-30,-30,x+30,30,80,H-sh*0.5,blk)});
    box(-sw/2,-40,sw/2,30,H-sh,H,blk);box(-sw/2+15,30,sw/2-15,34,H-sh+15,H-15,M(PAL.screen,{roughness:0.15,metalness:0.2}));box(-120,-80,120,-40,H-sh*0.75,H-sh*0.45,blk);return}
  if(/plant/.test(nm)){const r=Math.min(w,d)/2;cyl(r*0.72,0,420,0,0,M(dark?'#4a4f55':'#3b4046'),r*0.58,24);cyl(r*0.66,400,430,0,0,M('#5b4636'));const lf=M(dark?'#5d8d4c':'#5f9150');
    const fy=H-(430+(H-430)*0.55+120+r*0.75);[[0,0,1],[0.35,0.2,0.75],[-0.3,0.25,0.8],[0.1,-0.35,0.7]].forEach(([dx,dz,k])=>sph(r*0.75*k,dx*r,430+(H-430)*0.55+k*120+fy,dz*r,lf));cyl(15,420,700,0,0,M('#6b4f3a'));return}

  /* ---------- partitions ---------- */
  if(o.cat==='Partition'){const fab=M('#7c8996'),al=steel;const y0=o.nests?730:0,y1=y0+H;
    box(-hw,-hd,hw,hd,y0+(o.nests?0:60),y1,fab);box(-hw,-hd-3,-hw+20,hd+3,y0,y1,al);box(hw-20,-hd-3,hw,hd+3,y0,y1,al);box(-hw,-hd-3,hw,hd+3,y1-15,y1,al);
    if(!o.nests)[-1,1].forEach(sg=>box(sg*(hw-150)-20,-200,sg*(hw-150)+20,200,0,40,al));else[-1,1].forEach(sg=>box(sg*(hw-200)-15,-25,sg*(hw-200)+15,25,y0-60,y0,al));return}

  /* ---------- anything else: the outline extruded, with a darker plinth ---------- */
  const col=cssColor('--c-'+(CATS[o.cat]||'custom'));
  if(shp==='poly'&&o.pts){ext(o.pts,0,H,M(col));return}
  bodyLocal(o).forEach(p=>{ext(p,40,H,M(col));ext(p,0,40,blk)});
}

/* the building's floor outline: rooms, walls and doors are painted on a grid, openings up to the door-gap setting are sealed,
   the outside is flood-filled, and what is left is traced back into polygons. Cached until the geometry changes. */
const PLATES=new Map();
function floorPlate(){
  const rooms=S.objs.filter(o=>o.t==='room'&&visible(o)),walls=S.objs.filter(o=>o.t==='wall'&&!o.site&&visible(o)),doors=S.objs.filter(o=>isOpening(o)||isCol(o));
  if(!rooms.length&&!walls.length)return[];
  const gap=Math.min(1200,((P.det&&P.det.gap)||1850)/2);
  const key=JSON.stringify([rooms.map(r=>[r.pts,r.nowall?1:0]),walls.map(w=>[w.pts,w.th,w.bulge||0,w.closed?1:0,w.spline?1:0]),doors.map(d=>[d.x,d.y,d.w,d.d,d.r]),P.wall,gap]);
  if(PLATES.has(key))return PLATES.get(key);
  const pts=[];rooms.forEach(r=>pts.push(...r.pts));walls.forEach(w=>pts.push(...wallPathPts(w)));const B=bboxPts(pts);
  let c=100;const pad=gap+400;const ar=(B.x1-B.x0+2*pad)*(B.y1-B.y0+2*pad);if(ar/(c*c)>2.5e6)c=Math.ceil(Math.sqrt(ar/2.5e6));
  const gx0=B.x0-pad,gy0=B.y0-pad,GW=Math.ceil((B.x1-B.x0+2*pad)/c)+1,GH=Math.ceil((B.y1-B.y0+2*pad)/c)+1,N=GW*GH;const bar=new Uint8Array(N);
  const cx=i=>gx0+(i+0.5)*c,cy=j=>gy0+(j+0.5)*c;
  const fillPoly=poly=>{for(let j=0;j<GH;j++){const y=cy(j),xs=[];for(let i=0,k=poly.length-1;i<poly.length;k=i++){const a=poly[i],b=poly[k];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))}xs.sort((p,q)=>p-q);
    for(let t=0;t+1<xs.length;t+=2){const i0=Math.max(0,Math.ceil((xs[t]-gx0)/c-0.5)),i1=Math.min(GW-1,Math.floor((xs[t+1]-gx0)/c-0.5));for(let i=i0;i<=i1;i++)bar[j*GW+i]=1}}};
  const line=(a,b,r)=>{r=Math.max(r,c*0.75);const i0=Math.max(0,Math.floor((Math.min(a[0],b[0])-r-gx0)/c)),i1=Math.min(GW-1,Math.ceil((Math.max(a[0],b[0])+r-gx0)/c)),j0=Math.max(0,Math.floor((Math.min(a[1],b[1])-r-gy0)/c)),j1=Math.min(GH-1,Math.ceil((Math.max(a[1],b[1])+r-gy0)/c));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(segDist(cx(i),cy(j),a,b)<=r)bar[j*GW+i]=1};
  rooms.forEach(r=>{fillPoly(r.pts);if(!r.nowall)r.pts.forEach((p,i)=>line(p,r.pts[(i+1)%r.pts.length],(P.wall||100)/2))});
  walls.forEach(w=>wallSegs(w).forEach(([a,b])=>line(a,b,(w.th||100)/2)));
  doors.forEach(d=>bodyLocal(d).forEach(p=>fillPoly(toW(d,p))));
  /* chamfer distance (in cells) from a set of seed cells */
  const dist=seed=>{const D=new Float32Array(N);for(let k=0;k<N;k++)D[k]=seed(k)?0:1e9;
    for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=j*GW+i;let v=D[k];if(i>0)v=Math.min(v,D[k-1]+1);if(j>0){v=Math.min(v,D[k-GW]+1);if(i>0)v=Math.min(v,D[k-GW-1]+1.414);if(i<GW-1)v=Math.min(v,D[k-GW+1]+1.414)}D[k]=v}
    for(let j=GH-1;j>=0;j--)for(let i=GW-1;i>=0;i--){const k=j*GW+i;let v=D[k];if(i<GW-1)v=Math.min(v,D[k+1]+1);if(j<GH-1){v=Math.min(v,D[k+GW]+1);if(i<GW-1)v=Math.min(v,D[k+GW+1]+1.414);if(i>0)v=Math.min(v,D[k+GW-1]+1.414)}D[k]=v}return D};
  const R=gap/c,D1=dist(k=>bar[k]===1);
  const out=new Uint8Array(N),st=[];const push=k=>{if(out[k]||D1[k]<=R)return;out[k]=1;st.push(k)};
  for(let i=0;i<GW;i++){push(i);push((GH-1)*GW+i)}for(let j=0;j<GH;j++){push(j*GW);push(j*GW+GW-1)}
  while(st.length){const k=st.pop(),i=k%GW,j=(k/GW)|0;if(i>0)push(k-1);if(i<GW-1)push(k+1);if(j>0)push(k-GW);if(j<GH-1)push(k+GW)}
  const D2=dist(k=>out[k]===1);const plate=new Uint8Array(N);for(let k=0;k<N;k++)plate[k]=(bar[k]||D2[k]>R+0.5)?1:0;
  /* trace the outline of each piece of floor */
  const lab=new Int32Array(N);const polys=[];let id=0;
  for(let k0=0;k0<N;k0++){if(!plate[k0]||lab[k0])continue;id++;const cells=[];st.push(k0);lab[k0]=id;
    while(st.length){const k=st.pop();cells.push(k);const i=k%GW,j=(k/GW)|0;[[i+1,j],[i-1,j],[i,j+1],[i,j-1]].forEach(([a,b])=>{if(a<0||b<0||a>=GW||b>=GH)return;const q=b*GW+a;if(!plate[q]||lab[q])return;lab[q]=id;st.push(q)})}
    if(cells.length*c*c<0.5e6)continue;
    const E=new Map(),VW=GW+1;const add=(x0,y0,x1,y1)=>{const kk=y0*VW+x0;let a=E.get(kk);if(!a){a=[];E.set(kk,a)}a.push(y1*VW+x1)};
    cells.forEach(k=>{const i=k%GW,j=(k/GW)|0;if(j===0||lab[k-GW]!==id)add(i,j,i+1,j);if(i===GW-1||lab[k+1]!==id)add(i+1,j,i+1,j+1);if(j===GH-1||lab[k+GW]!==id)add(i+1,j+1,i,j+1);if(i===0||lab[k-1]!==id)add(i,j+1,i,j)});
    let best=null,bestA=0;while(E.size){const start=E.keys().next().value;let cur=start;const loop=[];let n=0;do{loop.push([cur%VW,(cur/VW)|0]);const arr=E.get(cur);if(!arr)break;const nx=arr.pop();if(!arr.length)E.delete(cur);cur=nx}while(cur!==start&&n++<1e6);
      const A=Math.abs(polyArea(loop));if(A>bestA){bestA=A;best=loop}}
    if(best)polys.push(simplifyClosed(best,1.1).map(p=>[gx0+p[0]*c,gy0+p[1]*c]));
  }
  if(PLATES.size>40)PLATES.clear();PLATES.set(key,polys);return polys;
}
function frame3D(kind){const{camera,controls}=T3;camera.rotation.order='XYZ';const[cx,cz]=T3.center,sp=T3.span,cy=T3.cy||0;controls.target.set(cx,cy,cz);
  if(kind==='top')camera.position.set(cx,cy+sp*1.3,cz+0.0001);else if(bldView)camera.position.set(cx+sp*1.25,cy+sp*0.75,cz+sp*1.6);else camera.position.set(cx+sp*0.5,sp*0.62,cz+sp*0.8);
  camera.near=Math.max(0.01,sp/2000);camera.far=sp*30;camera.updateProjectionMatrix();controls.update()}
function set3D(on){
  if(!on&&WALK.on)walkStop(true);if(!on)bldView=false;if(on&&roofMode)bldView=true;
  if(on&&!T3&&!(window.THREE&&window.THREE.OrbitControls)){toast('Loading 3D…');ensureThree().then(()=>set3D(on)).catch(e=>toast('3D view is not available: '+e.message));return}
  if(on){try{if(!T3)init3D()}catch(e){toast('3D view is not available: '+e.message);return}}
  is3D=on;$('#main').classList.toggle('mode3d',on);if(typeof mbarSync==='function')setTimeout(mbarSync,0);{const vb=$('#b-view');if(vb){vb.textContent=on?'2D plan':'3D view';vb.title=(on?'Back to the 2D plan':'Switch to 3D')+' (Tab)'}}$('#v2d').classList.toggle('on',!on);$('#v3d').classList.toggle('on',on&&!bldView);$('#vbld').classList.toggle('on',on&&bldView);$('#main').classList.toggle('bldmode',on&&bldView);$('#v3').hidden=!on;if(!(on&&bldView))bldLabels(null);
  if(on){if(tool!=='select'&&tool!=='place'&&tool!=='paint')setTool('select');closePops();size3D();T3.framed=false;build3D();if(!T3.raf)T3.loop()}else render();
  sectionBar();sunBar();d3Sync();
  updateHint();
}
$('#v2d').addEventListener('click',()=>setView('2d'));$('#b-view').addEventListener('click',()=>{if(WALK.on)walkStop();if(bldView)return setView('2d');set3D(!is3D)});$('#v3d').addEventListener('click',()=>setView('3d'));$('#vbld').addEventListener('click',()=>setView('bld'));
/* the selection is kept through Building view (it picks floors, not objects) and is still there when you come back */
function setView(v){if(WALK.on)walkStop(true);
  if(v==='2d')return set3D(false);const was=bldView;bldView=v==='bld';if(bldView&&tool!=='select')setTool('select');if(is3D&&was===bldView)return;if(is3D){$('#v3d').classList.toggle('on',!bldView);$('#vbld').classList.toggle('on',bldView);$('#main').classList.toggle('bldmode',bldView);if(!bldView)bldLabels(null);T3.framed=false;build3D();updateHint();return}set3D(true)}
/* ================= Building view =================
   Every floor stacked at its level. Typical floors are drawn from the shared layout, furniture on the open floor only (or all, or none).
   Click a floor to open it in 2D. */
const BV={explode:false,cut:'',furn:'active',hover:null,campus:false};
function bldObjs(l,real){const b=S.bld;if(l.id===b.active)return real||S.objs;const base=clone(l.unique?(l.base||[]):(b.typical||[]));const nm=l.unique?{}:(l.names||{});base.forEach(o=>{if(o.t==='room'&&nm[o.id]!=null)o.name=nm[o.id]});return base.concat(clone(coresOn(b,b.levels.indexOf(l))),l.fit||[])}
/* cut a core's footprint out of a slab outline (only when it sits inside that outline) */
function coreHoles(sh,cores,poly){const{THREE}=T3;cores.forEach(c=>{const q=toW(c,rectP(-c.w/2,-c.d/2,c.w/2,c.d/2));if(!q.every(p=>pointInPoly(p[0],p[1],poly)))return;sh.holes.push(new THREE.Path(q.map(p=>new THREE.Vector2(p[0]*0.001,-p[1]*0.001))))})}
function buildBld3D(){const{THREE,dir,scene}=T3,root=T3.group,group=root,s=0.001;clear3D(root);T3.cols=[];T3.doorPiv={};T3.bldPick=[];if(T3.renderer)T3.renderer.clippingPlanes=[];
  const dark=isDark();let bb=null,top=0,bot=0,hasB=false;
  scene.background=new THREE.Color(cssColor('--paper')).convertSRGBToLinear();
  const cache={};const conc=new THREE.MeshStandardMaterial({color:new THREE.Color(dark?'#7d848b':'#b9bcbe').convertSRGBToLinear(),roughness:0.95});
  /* one building (the plan in S) into a group. main = the plan being worked on: it alone honours the floor cut and takes clicks */
  const one=(group,main)=>{ensureBld(S);syncFloorOut(S);const b=S.bld,L=b.levels,st=levelStack(b),nm=levelNames(b),act=bldLevel(S);if(L.some(l=>l.kind==='B'))hasB=true;
  const cutI=main&&BV.cut?L.findIndex(l=>l.id===BV.cut):L.length-1;const gapE=BV.explode?3500:0;
  const trueObjs=S.objs,real=main&&roofMode?activeStored():S.objs;let lb=null;const plateOf=[];
  try{L.forEach((l,i)=>{if(i>cutI)return;S.objs=bldObjs(l,real);const r=st[i];const y=r.ffl+(i-L.findIndex(x=>x.kind!=='B'))*gapE;
    const g=new THREE.Group();g.position.y=y*s;group.add(g);
    const furn=BV.furn==='all'||(BV.furn==='active'&&l===act);
    const info=build3D(g,{wallH:r.ceiling+r.void,ceil:r.ceiling,noFurn:!furn,cache,lvI:i,ftf:r.ftf});const plates=floorPlate();plateOf[i]=plates;
    /* the slab this floor stands on: the lowest floor gets a ground slab */
    const below=i>0?st[i-1].slab:Math.max(+b.slab,200);
    const holes=i>0?(b.cores||[]).filter(c=>isCore(c)&&coreOn(b,c,i)&&coreOn(b,c,i-1)):[];
    plates.forEach(poly=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh,holes,poly);const geo=new THREE.ExtrudeGeometry(sh,{depth:below*s,bevelEnabled:false});geo.rotateX(-Math.PI/2);const m=new THREE.Mesh(geo,conc);m.position.y=-below*s-0.0002;m.castShadow=true;m.receiveShadow=true;g.add(m)});
    /* a lid over every floor that has another above it: where the floor above is smaller (a step in the building, or a lower wing) the part left showing gets its roof. Under the floor above it sits inside that floor's own slab. Left off when the floors are pulled apart, where it would hide the rooms */
    if(i<cutI&&i<L.length-1&&!BV.explode){const up=(b.cores||[]).filter(c=>isCore(c)&&coreOn(b,c,i)&&coreOn(b,c,i+1));plates.forEach(poly=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh,up,poly);const geo=new THREE.ExtrudeGeometry(sh,{depth:r.slab*s,bevelEnabled:false});geo.rotateX(-Math.PI/2);const m=new THREE.Mesh(geo,conc);m.position.y=(r.ceiling+r.void)*s-0.0001;m.castShadow=true;m.receiveShadow=true;g.add(m)})}
    if(info&&info.B){const B=info.B;lb=lb?{x0:Math.min(lb.x0,B.x0),y0:Math.min(lb.y0,B.y0),x1:Math.max(lb.x1,B.x1),y1:Math.max(lb.y1,B.y1)}:Object.assign({},B)}
    const h=r.ceiling+r.void;top=Math.max(top,y+h+(i===L.length-1&&i===cutI?r.slab+ +b.parapet:0));bot=Math.min(bot,y-below);
    /* invisible box for hover and click */
    if(main){const B=info?info.B:{x0:-5000,y0:-5000,x1:5000,y1:5000};const pk=new THREE.Mesh(new THREE.BoxGeometry((B.x1-B.x0+400)*s,(h+below)*s,(B.y1-B.y0+400)*s),new THREE.MeshBasicMaterial({color:new THREE.Color(cssColor('--accent')),transparent:true,opacity:0,depthWrite:false}));
    pk.position.set((B.x0+B.x1)/2*s,(y+(h-below)/2)*s,(B.y0+B.y1)/2*s);pk.userData.level=l.id;group.add(pk);T3.bldPick.push({mesh:pk,id:l.id,name:nm[l.id],y:y+h/2,B,active:l===act})}});
    /* RC roof and parapet over the top floor */
    const ti=L.length-1;if(cutI===ti&&plateOf[ti]){const r=st[ti],y=r.ffl+(ti-L.findIndex(x=>x.kind!=='B'))*gapE+r.ceiling+r.void;const rs=r.slab,par=+b.parapet;
      const rcs=(b.cores||[]).filter(c=>c.shape==='stair'&&coreUp(b,c,ti));
      rcs.forEach(c=>{const m=new THREE.Mesh(new THREE.BoxGeometry((c.w+400)*s,3000*s,(c.d+400)*s),conc);m.position.set(c.x*s,(y+rs+1500)*s,c.y*s);m.rotation.y=-(c.r||0)*Math.PI/180;m.castShadow=true;group.add(m)});
      plateOf[ti].forEach(poly=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh,rcs,poly);const geo=new THREE.ExtrudeGeometry(sh,{depth:rs*s,bevelEnabled:false});geo.rotateX(-Math.PI/2);const m=new THREE.Mesh(geo,conc);m.position.y=y*s;m.castShadow=true;m.receiveShadow=true;group.add(m);
        if(par>0)poly.forEach((a,k)=>{const c=poly[(k+1)%poly.length],len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len<1)return;const pm=new THREE.Mesh(new THREE.BoxGeometry((len+200)*s,par*s,200*s),conc);pm.position.set((a[0]+c[0])/2*s,(y+rs+par/2)*s,(a[1]+c[1])/2*s);pm.rotation.y=-Math.atan2(c[1]-a[1],c[0]-a[0]);pm.castShadow=true;group.add(pm)})});
      /* roof plant and M&E on top of the slab */
      const matR=(col,opt)=>{const k='R'+col+'|'+(opt?JSON.stringify(opt):'');if(!cache[k]){const o2=Object.assign({roughness:0.85,metalness:0.02},opt||{});o2.color=new THREE.Color(col).convertSRGBToLinear();if(opt&&opt.emissive)o2.emissive=new THREE.Color(opt.emissive).convertSRGBToLinear();cache[k]=new THREE.MeshStandardMaterial(o2)}return cache[k]};
      buildRoofFit(group,y+rs,{THREE,mat:matR,s,dark,sub:true})}
  }finally{S.objs=trueObjs}
  return lb};
  bb=one(root,true);
  /* campus: every other open plan drawn where it stands on the site, relative to this one, and the links between buildings */
  if(BV.campus&&tabs.length>1){const me=siteOf(S),rot=(x,y,deg)=>{const a=deg*Math.PI/180,c=Math.cos(a),n=Math.sin(a);return[x*c-y*n,x*n+y*c]},boxes=[{t:curTab,p:S,b:bb,dx:0,dy:0,r:0}];
    tabs.forEach(t=>{if(t===curTab||!t.S)return;const st=siteOf(t.S),[dx,dy]=rot(st.x-me.x,st.y-me.y,-me.r),r=st.r-me.r,sub=new THREE.Group();sub.position.set(dx*s,0,dy*s);sub.rotation.y=-r*Math.PI/180;root.add(sub);
      const lb=withPlan(t,()=>{try{return one(sub,false)}catch(e){return null}});if(!lb)return;
      const cs=[[lb.x0,lb.y0],[lb.x1,lb.y0],[lb.x1,lb.y1],[lb.x0,lb.y1]].map(q=>{const[x,y]=rot(q[0],q[1],r);return[x+dx,y+dy]}),wb={x0:Math.min(...cs.map(q=>q[0])),y0:Math.min(...cs.map(q=>q[1])),x1:Math.max(...cs.map(q=>q[0])),y1:Math.max(...cs.map(q=>q[1]))};
      boxes.push({t,p:t.S,b:wb,dx,dy,r});bb=bb?{x0:Math.min(bb.x0,wb.x0),y0:Math.min(bb.y0,wb.y0),x1:Math.max(bb.x1,wb.x1),y1:Math.max(bb.y1,wb.y1)}:wb});
    const lm=new THREE.MeshStandardMaterial({color:new THREE.Color(dark?'#9fb4c7':'#8fa3b5').convertSRGBToLinear(),roughness:0.6,transparent:true,opacity:0.85});
    boxes.forEach(A=>siteOf(A.p).links.forEach(k=>{const B=boxes.find(x=>x!==A&&x.p.name===k.to);if(!A.b||!B||!B.b)return;const g=campusLink(A.b,B.b,+k.w||3000);if(!g)return;
      const lv=p=>{ensureBld(p);const nm=levelNames(p.bld),i=p.bld.levels.findIndex(l=>nm[l.id]===k.from);return i<0?null:levelStack(p.bld)[i]},r=lv(A.p);if(!r)return;
      const m=new THREE.Mesh(new THREE.BoxGeometry(Math.max(g.w,200)*s,3000*s,Math.max(g.d,200)*s),lm);m.position.set(g.cx*s,(r.ffl+1500)*s,g.cy*s);m.castShadow=true;root.add(m);top=Math.max(top,r.ffl+3000)}))}
  const L=S.bld.levels;
  bb=bb||{x0:-5000,y0:-5000,x1:5000,y1:5000};const cx=(bb.x0+bb.x1)/2,cy=(bb.y0+bb.y1)/2,span=Math.max(bb.x1-bb.x0,bb.y1-bb.y0,top-bot,6000);
  /* ground at L1, see-through so basements show below */
  const gs=span*2.2*s;const ground=new THREE.Mesh(new THREE.PlaneGeometry(gs,gs),new THREE.MeshStandardMaterial({color:new THREE.Color(isDark()?'#3b4436':'#b9c4a4').convertSRGBToLinear(),transparent:true,opacity:hasB?0.55:1,depthWrite:false,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.set(cx*s,-0.004,cy*s);ground.receiveShadow=true;ground.renderOrder=-1;ground.userData.noExport=true;group.add(ground);
  const R=span*s;dir.position.set(cx*s+R*0.6,top*s+R*1.2,cy*s+R*0.9);dir.target.position.set(cx*s,0,cy*s);const sc=dir.shadow.camera;sc.left=-R;sc.right=R;sc.top=R;sc.bottom=-R;sc.near=0.1;sc.far=R*6;sc.updateProjectionMatrix();
  T3.center=[cx*s,cy*s];T3.span=span*s;T3.cy=(top+bot)/2*s;bldLabels(T3.bldPick);
  if(!T3.framed){frame3D('persp');T3.framed=true}
  try{applySun();sunBar();d3Sync()}catch(e){}}
/* ================= campus: several buildings on one site (5.0.0 test 17)
   Each building stays its own plan in its own tab, exactly as before: its own floors, heights, programme and cost. New here: where each stands on the site (S.site), a view that draws every open building together, links between them, and one file that holds them all. The plan format itself does not change. */
const siteOf=p=>{const q=(p&&p.site)||{};return{x:+q.x||0,y:+q.y||0,r:+q.r||0,links:Array.isArray(q.links)?q.links:[]}};
/* run something as if another tab's plan were the open one */
function withPlan(t,fn){if(t===curTab)return fn();const S0=S,r0=roofMode;S=t.S;roofMode=false;try{return fn()}finally{S=S0;roofMode=r0}}
function planBox(p){let b=null;ensureBld(p);p.bld.levels.forEach(l=>(floorObjsOf(p,l.id)||[]).forEach(o=>{if(o.t==='room'||o.t==='wall')(o.pts||[]).forEach(q=>{b=b?{x0:Math.min(b.x0,q[0]),y0:Math.min(b.y0,q[1]),x1:Math.max(b.x1,q[0]),y1:Math.max(b.y1,q[1])}:{x0:q[0],y0:q[1],x1:q[0],y1:q[1]}})}));return b}
/* a straight link across the gap between two buildings' outlines, where they face each other */
function campusLink(A,B,w){const ox=[Math.max(A.x0,B.x0),Math.min(A.x1,B.x1)],oy=[Math.max(A.y0,B.y0),Math.min(A.y1,B.y1)],mid=(o,a0,a1,b0,b1)=>o[1]-o[0]>=w?(o[0]+o[1])/2:((a0+a1)/2+(b0+b1)/2)/2;
  const gx=Math.max(B.x0-A.x1,A.x0-B.x1),gy=Math.max(B.y0-A.y1,A.y0-B.y1);if(gx<=0&&gy<=0)return null;
  if(gx>=gy){const x0=A.x1<B.x0?A.x1:B.x1,x1=A.x1<B.x0?B.x0:A.x0;return{cx:(x0+x1)/2,cy:mid(oy,A.y0,A.y1,B.y0,B.y1),w:x1-x0,d:w,len:x1-x0}}
  const y0=A.y1<B.y0?A.y1:B.y1,y1=A.y1<B.y0?B.y0:A.y0;return{cx:mid(ox,A.x0,A.x1,B.x0,B.x1),cy:(y0+y1)/2,w,d:y1-y0,len:y1-y0}}
function campusRows(){syncFloorOut(S);return tabs.map(t=>withPlan(t,()=>{const p=t===curTab?S:t.S;ensureBld(p);if(t!==curTab)syncFloorOut(p);let gfa=0,cost=null;try{const C=costCalc();gfa=C.gfa;cost=C.total}catch(e){}
    const b=planBox(p);return{t,name:p.name||'Untitled',site:siteOf(p),st:p.bld.levels.filter(l=>l.kind!=='B').length,bas:p.bld.levels.filter(l=>l.kind==='B').length,gfa,cost,box:b,levels:Object.values(levelNames(p.bld))}}))}
/* change where a plan stands, or its links: the open plan through Undo, another tab directly */
function campusSet(t,fn){if(t===curTab){checkpoint();S.site=Object.assign({},siteOf(S));fn(S.site);markDirty()}else{t.S.site=Object.assign({},siteOf(t.S));fn(t.S.site);t.dirty=true;saveTabData(t,t.S)}campusUI();if(bldView&&BV.campus){T3.framed=false;build3D()}}
function campusArrange(){const R=campusRows();let x=0;R.forEach(r=>{const b=r.box||{x0:0,y0:0,x1:20000,y1:20000};campusSet(r.t,q=>{q.x=Math.round(x-b.x0);q.y=Math.round(-b.y0);q.r=0});x+=b.x1-b.x0+20000});toast('Buildings set out in a row, 20 m apart')}
function campusUI(){const el=$('#campus-body');if(!el||$('#campus-modal').hidden)return;const R=campusRows(),m=v=>(Math.round(v/100)/10),f0=v=>Math.round(v).toLocaleString(),names=R.map(r=>r.name),dup=names.some((n,i)=>names.indexOf(n)!==i);
  const links=[];R.forEach((r,i)=>r.site.links.forEach((k,j)=>links.push({r,i,j,k})));
  const opt=(list,v)=>list.map(x=>`<option${x===v?' selected':''}>${esc(x)}</option>`).join('');
  el.innerHTML=`<p class="muted">Every open plan tab is one building. Give each its place on the site, then tick <b>Show every building</b> in the Building view. Each building keeps its own floors, floor heights, programme and cost.</p>
  ${campusMap(R)}
  <div class="row" style="margin:8px 0;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-cg="add">Add building from file</button><button type="button" class="btn sm" data-cg="turnl"${CAMP.sel?'':' disabled'}>Turn left 90°</button><button type="button" class="btn sm" data-cg="turnr"${CAMP.sel?'':' disabled'}>Turn right 90°</button><span class="muted" id="campus-read">${CAMP.sel&&R.find(r=>r.t===CAMP.sel)?esc(R.find(r=>r.t===CAMP.sel).name)+' selected. Drag it, or use the arrow keys (1 m, Shift 10 m).':'Drag a building to move it. Edges snap to the buildings next to it.'}</span></div>
  <div class="prog-tw"><table class="prog-t"><thead><tr><th>Building (plan tab)</th><th>East, m</th><th>South, m</th><th>Turn, °</th><th class="x">Storeys</th><th class="x">GFA m²</th><th class="x">Cost</th><th></th></tr></thead><tbody>${R.map((r,i)=>`<tr><td>${esc(r.name)}${r.t===curTab?' <span class="muted">(open)</span>':''}</td>${[['x',m(r.site.x)],['y',m(r.site.y)],['r',r.site.r]].map(([f,v])=>`<td><input type="number" step="any" data-ci="${i}" data-cf="${f}" value="${v}" aria-label="${esc(r.name)} ${f}"></td>`).join('')}<td class="x">${r.st}${r.bas?' + '+r.bas+'B':''}</td><td class="x">${f0(r.gfa)}</td><td class="x">${r.cost!=null?money(r.cost):''}</td><td>${r.t===curTab?'':`<button type="button" class="btn sm ghost" data-cg="go" data-ci="${i}">Open</button>`}</td></tr>`).join('')}<tr><td><b>Site total</b></td><td></td><td></td><td></td><td></td><td class="x"><b>${f0(R.reduce((a,r)=>a+r.gfa,0))}</b></td><td class="x"><b>${R.some(r=>r.cost!=null)?money(R.reduce((a,r)=>a+(r.cost||0),0)):''}</b></td><td></td></tr></tbody></table></div>
  <div class="row" style="margin:8px 0;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-cg="arrange">Set out in a row</button><button type="button" class="btn sm" data-cg="view">${bldView&&BV.campus?'Showing every building':'Show every building in 3D'}</button></div>
  <h4>Links between buildings</h4><p class="muted">A link is a straight covered bridge across the gap, at the floor you choose, where the two buildings face each other.${dup?' <span class="no">Two plans share a name: links find buildings by name, so rename one.</span>':''}</p>
  <div class="prog-tw"><table class="prog-t"><thead><tr><th>From</th><th>Floor</th><th>To</th><th>Width, m</th><th>Length</th><th></th></tr></thead><tbody>${links.map(({r,i,j,k})=>{const B=R.find(x=>x.name===k.to&&x!==r),g=B&&r.box&&B.box?campusLink(campusWorld(r),campusWorld(B),+k.w||3000):null;return`<tr><td>${esc(r.name)}</td><td><select data-ci="${i}" data-cl="${j}" data-cf="from" aria-label="Floor">${opt(r.levels,k.from)}</select></td><td><select data-ci="${i}" data-cl="${j}" data-cf="to" aria-label="To building">${opt(names.filter(n=>n!==r.name),k.to)}</select></td><td><input type="number" step="any" min="1" data-ci="${i}" data-cl="${j}" data-cf="w" value="${m(+k.w||3000)}" aria-label="Width"></td><td class="x">${!B?'<span class="no">Building not open</span>':g?m(g.len)+' m':'<span class="no">Buildings touch or overlap</span>'}</td><td><button type="button" class="btn icon ghost sm" data-cg="ldel" data-ci="${i}" data-cl="${j}" aria-label="Remove link">✕</button></td></tr>`}).join('')||'<tr><td colspan="6" class="muted">None yet.</td></tr>'}</tbody></table></div>
  <button type="button" class="btn sm" data-cg="ladd"${R.length<2?' disabled':''}>Add link</button>`}
/* a plan's outline in site coordinates (turned and moved) */
function campusWorld(r){const b=r.box,a=r.site.r*Math.PI/180,c=Math.cos(a),n=Math.sin(a),cs=[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]].map(q=>[q[0]*c-q[1]*n+r.site.x,q[0]*n+q[1]*c+r.site.y]);return{x0:Math.min(...cs.map(q=>q[0])),y0:Math.min(...cs.map(q=>q[1])),x1:Math.max(...cs.map(q=>q[0])),y1:Math.max(...cs.map(q=>q[1]))}}
/* the site map: every building as its turned outline, dragged with mouse or finger */
const CAMP={sel:null,drag:null,adding:false};
function campusPoly(r){const b=r.box||{x0:0,y0:0,x1:20000,y1:20000},a=r.site.r*Math.PI/180,c=Math.cos(a),n=Math.sin(a);return[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]].map(q=>[q[0]*c-q[1]*n+r.site.x,q[0]*n+q[1]*c+r.site.y])}
const campusBoxOf=P=>({x0:Math.min(...P.map(q=>q[0])),y0:Math.min(...P.map(q=>q[1])),x1:Math.max(...P.map(q=>q[0])),y1:Math.max(...P.map(q=>q[1]))});
function campusMap(R){if(!R.length)return'';const P=R.map(campusPoly),B=P.map(campusBoxOf),hit=(a,b)=>a.x0<b.x1-1&&b.x0<a.x1-1&&a.y0<b.y1-1&&b.y0<a.y1-1;
  let x0=Math.min(...B.map(b=>b.x0)),y0=Math.min(...B.map(b=>b.y0)),x1=Math.max(...B.map(b=>b.x1)),y1=Math.max(...B.map(b=>b.y1));const pad=Math.max(15000,(x1-x0)*.15,(y1-y0)*.15);x0-=pad;y0-=pad;x1+=pad;y1+=pad;
  const W=x1-x0,H=y1-y0,u=Math.max(W/900,H/320),fs=13*u,bar=[100,50,20,10,5].find(v=>v*1000<W*.25)||5;
  const links=[];R.forEach((r,i)=>r.site.links.forEach(k=>{const j=R.findIndex(x=>x.name===k.to&&x!==r);if(j<0)return;const g=campusLink(B[i],B[j],+k.w||3000);if(g)links.push(`<rect class="lk" x="${g.cx-g.w/2}" y="${g.cy-g.d/2}" width="${g.w}" height="${g.d}"/>`)}));
  return`<svg id="campus-map" class="camp-map" tabindex="0" role="application" aria-label="Site map. Drag a building to move it; arrow keys move the selected building" viewBox="${x0} ${y0} ${W} ${H}" preserveAspectRatio="xMidYMid meet">${links.join('')}${R.map((r,i)=>{const over=B.some((b,j)=>j!==i&&hit(B[i],b)),cx=(B[i].x0+B[i].x1)/2,cy=(B[i].y0+B[i].y1)/2;return`<g data-cb="${i}" class="${r.t===CAMP.sel?'sel ':''}${over?'over':''}"><polygon points="${P[i].map(q=>q.join(',')).join(' ')}" stroke-width="${1.5*u}"${r.box?'':` stroke-dasharray="${6*u} ${5*u}" fill-opacity=".35"`}/><text x="${cx}" y="${cy}" font-size="${fs}" text-anchor="middle" dominant-baseline="middle">${esc(r.name.length>26?r.name.slice(0,25)+'…':r.name)}</text><text x="${cx}" y="${cy+fs*1.3}" font-size="${fs*.8}" text-anchor="middle" dominant-baseline="middle" class="sub">${r.box?`${r.st} storey${r.st===1?'':'s'}`:'nothing drawn yet'}${over?' · overlaps':''}</text></g>`}).join('')}<g class="bar"><line x1="${x0+12*u}" y1="${y1-12*u}" x2="${x0+12*u+bar*1000}" y2="${y1-12*u}" stroke-width="${2*u}"/><text x="${x0+12*u}" y="${y1-18*u}" font-size="${fs*.8}">${bar} m</text><text x="${x1-12*u}" y="${y0+20*u}" font-size="${fs*.8}" text-anchor="end">North ↑</text></g></svg>`}
/* turn a building about the middle of its outline, so it stays where it stands */
function campusTurn(t,d){const r=campusRows().find(x=>x.t===t);if(!r)return;const c0=campusBoxOf(campusPoly(r)),r1=Object.assign({},r,{site:Object.assign({},r.site,{r:(((r.site.r+d)%360)+360)%360})}),c1=campusBoxOf(campusPoly(r1));
  campusSet(t,q=>{q.r=r1.site.r;q.x=Math.round(q.x+(c0.x0+c0.x1-c1.x0-c1.x1)/2);q.y=Math.round(q.y+(c0.y0+c0.y1-c1.y0-c1.y1)/2)})}
/* a building just opened from the Campus dialog with no place of its own goes to the right of the others */
function campusPlaceNew(){const R=campusRows(),me=R.find(r=>r.t===curTab),oth=R.filter(r=>r.t!==curTab).map(r=>campusBoxOf(campusPoly(r)));if(!me||!oth.length)return;const b=me.box||{x0:0,y0:0};
  S.site={x:Math.round(Math.max(...oth.map(o=>o.x1))+20000-b.x0),y:Math.round(Math.min(...oth.map(o=>o.y0))-b.y0),r:0,links:[]};markDirty();CAMP.sel=curTab}
function campusDragStart(e){const g=e.target.closest('[data-cb]'),svg=$('#campus-map');if(!g||!svg)return;const R=campusRows(),r=R[+g.dataset.cb];if(!r)return;e.preventDefault();svg.focus();
  const m=svg.getScreenCTM(),k=m&&m.a?1/m.a:100;svg.querySelectorAll('g.sel').forEach(x=>x.classList.remove('sel'));g.classList.add('sel');CAMP.sel=r.t;
  CAMP.drag={g,r,k,sx:e.clientX,sy:e.clientY,dx:0,dy:0,box:campusBoxOf(campusPoly(r)),oth:R.filter(x=>x!==r).map(x=>campusBoxOf(campusPoly(x))),id:e.pointerId};try{svg.setPointerCapture(e.pointerId)}catch(_){}}
function campusDragMove(e){const D=CAMP.drag;if(!D||e.pointerId!==D.id)return;let dx=(e.clientX-D.sx)*D.k,dy=(e.clientY-D.sy)*D.k;if(Math.hypot(e.clientX-D.sx,e.clientY-D.sy)<4&&!D.on)return;D.on=true;
  const grid=500,tol=14*D.k;dx=Math.round((D.r.site.x+dx)/grid)*grid-D.r.site.x;dy=Math.round((D.r.site.y+dy)/grid)*grid-D.r.site.y;
  /* edges within reach of a neighbour's edges line up with them: touch, or share a face line */
  let bx=null,by=null;D.oth.forEach(o=>{[o.x1-D.box.x0,o.x0-D.box.x1,o.x0-D.box.x0,o.x1-D.box.x1].forEach(c=>{const v=Math.abs(c-dx);if(v<tol&&(bx==null||v<Math.abs(bx-dx)))bx=c});[o.y1-D.box.y0,o.y0-D.box.y1,o.y0-D.box.y0,o.y1-D.box.y1].forEach(c=>{const v=Math.abs(c-dy);if(v<tol&&(by==null||v<Math.abs(by-dy)))by=c})});
  if(bx!=null)dx=bx;if(by!=null)dy=by;D.dx=Math.round(dx);D.dy=Math.round(dy);D.g.setAttribute('transform',`translate(${D.dx} ${D.dy})`);
  const rd=$('#campus-read');if(rd)rd.textContent=`${D.r.name}: East ${((D.r.site.x+D.dx)/1000).toFixed(1)} m, South ${((D.r.site.y+D.dy)/1000).toFixed(1)} m${bx!=null||by!=null?' · snapped to a neighbour':''}`}
function campusDragEnd(e){const D=CAMP.drag;if(!D||(e&&e.pointerId!==D.id))return;CAMP.drag=null;try{$('#campus-map').releasePointerCapture(D.id)}catch(_){}
  if(D.on&&(D.dx||D.dy)&&!(e&&e.type==='pointercancel'))campusSet(D.r.t,q=>{q.x=Math.round(q.x+D.dx);q.y=Math.round(q.y+D.dy)});else campusUI();const s=$('#campus-map');if(s)s.focus({preventScroll:true})}
function campusOpen(){closePops();$('#campus-modal').hidden=false;campusUI()}
/* one file for the whole site: every open plan, each complete */
function campusFile(){captureTab();const plans=tabs.map(t=>withPlan(t,()=>JSON.parse(planJSON())));return JSON.stringify({app:'layout-planner',campus:1,appVersion:APP_VERSION,saved:new Date().toISOString(),plans})}
/* links name their target building; when the open plan is renamed, links in the other open plans follow, unless another building still has the old name */
function campusRenamed(a,b){if(tabs.some(t=>t!==curTab&&(t.S&&t.S.name)===a))return;tabs.forEach(t=>{if(t===curTab)return;const st=t.S&&t.S.site;if(st&&Array.isArray(st.links))st.links.forEach(k=>{if(k.to===a)k.to=b})});}
function campusOpenText(o,name){const list=(o.plans||[]).filter(x=>x&&typeof x==='object');if(!list.length)throw new Error('The campus file has no plans in it');{const open=new Set(tabs.map(t=>t===curTab?S.name:(t.S&&t.S.name))),dup=list.filter(pl=>open.has(pl.name)).map(pl=>pl.name);if(dup.length&&!confirm(`${dup.length===1?'A building':dup.length+' buildings'} in this campus file ${dup.length===1?'is':'are'} already open (${dup.slice(0,4).join(', ')}${dup.length>4?'…':''}).\n\nOpen the file anyway? The buildings will be added again as separate tabs.`))return}list.forEach((pl,i)=>openPlanText(JSON.stringify(pl),null,(pl.name||'Building '+(i+1))+'.json'));toast(`Opened ${list.length} buildings from ${name}`)}
if($('#campus-modal')){
  $('#campus-modal').addEventListener('click',e=>{const b=e.target.closest('[data-cg]');if(!b)return;const a=b.dataset.cg,R=campusRows(),r=R[+b.dataset.ci];
    if(a==='close'){$('#campus-modal').hidden=true;CAMP.adding=false}else if(a==='arrange')campusArrange();
    else if(a==='add'){CAMP.adding=true;$('#f-plan').click()}
    else if((a==='turnl'||a==='turnr')&&CAMP.sel)campusTurn(CAMP.sel,a==='turnl'?-90:90);else if(a==='go'&&r){switchTab(r.t);campusUI()}
    else if(a==='view'){$('#campus-modal').hidden=true;BV.campus=true;const c=$('#v3-campus');if(c)c.checked=true;if(!bldView)$('#vbld').click();else{T3.framed=false;build3D()}}
    else if(a==='save')download((S.name||'Campus').replace(/[\\/:*?"<>|]+/g,'-')+' campus.json',campusFile(),'application/json');
    else if(a==='ladd'){const A=R.find(x=>x.t===curTab)||R[0],B=R.find(x=>x!==A);if(A&&B)campusSet(A.t,q=>{q.links=q.links.concat([{to:B.name,from:A.levels.find(n=>/^L/.test(n))||A.levels[0],w:3000}])})}
    else if(a==='ldel'&&r)campusSet(r.t,q=>{q.links=q.links.filter((k,j)=>j!==+b.dataset.cl)})});
  $('#campus-modal').addEventListener('change',e=>{const t=e.target,f=t.dataset.cf;if(!f)return;const r=campusRows()[+t.dataset.ci];if(!r)return;
    if(t.dataset.cl!=null)campusSet(r.t,q=>{q.links=q.links.map((k,j)=>j!==+t.dataset.cl?k:Object.assign({},k,{[f]:f==='w'?Math.max(1000,Math.min(30000,Math.round((+t.value||3)*1000))):t.value}))});
    else{const v=+t.value||0;if(f!=='r'&&Math.abs(v)>5000){toast('A building can be at most 5,000 m from the site origin');campusUI();return}campusSet(r.t,q=>{q[f]=f==='r'?(v%360):Math.round(v*1000)})}});
  $('#campus-modal').addEventListener('pointerdown',campusDragStart);$('#campus-modal').addEventListener('pointermove',campusDragMove);$('#campus-modal').addEventListener('pointerup',campusDragEnd);$('#campus-modal').addEventListener('pointercancel',campusDragEnd);
  $('#campus-modal').addEventListener('keydown',e=>{if(!e.target.closest||!e.target.closest('#campus-map')||!CAMP.sel)return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d)return;e.preventDefault();e.stopPropagation();const st=e.shiftKey?10000:1000;
    if(!tabs.includes(CAMP.sel)){CAMP.sel=null;return}campusSet(CAMP.sel,q=>{q.x+=d[0]*st;q.y+=d[1]*st});const s=$('#campus-map');if(s)s.focus({preventScroll:true})});
  $('#f-plan').addEventListener('cancel',()=>{CAMP.adding=false});
  $('#v3-campus').addEventListener('change',e=>{BV.campus=e.target.checked;T3.framed=false;build3D()})}
/* floor names beside the building, kept in place every frame */
function bldLabels(list){const host=$('#v3');host.querySelectorAll('.bld-lbl').forEach(e=>e.remove());T3&&(T3.bldLbl=null);if(!list||!T3)return;
  T3.bldLbl=list.map(p=>{const d=document.createElement('div');d.className='bld-lbl'+(p.active?' on':'');d.textContent=p.name;host.appendChild(d);return{el:d,p}})}
function bldLabelsMove(){if(!T3||!T3.bldLbl||!T3.bldLbl.length||!T3.bldLbl[0].p||!T3.bldLbl[0].p.B)return;const{THREE,camera}=T3,r=$('#v3c').getBoundingClientRect(),h=$('#v3').getBoundingClientRect();
  /* labels sit at whichever corner of the building is furthest left on screen, so they stay on the visible side as you orbit */
  const B0=T3.bldLbl[0].p.B,cs=[[B0.x0,B0.y0],[B0.x1,B0.y0],[B0.x1,B0.y1],[B0.x0,B0.y1]];let ci=0,mx=1e9;cs.forEach((c,i)=>{const v=new THREE.Vector3(c[0]*0.001,T3.cy,c[1]*0.001).project(camera);if(v.x<mx){mx=v.x;ci=i}});const C=cs[ci];
  T3.bldLbl.forEach(({el,p})=>{const v=new THREE.Vector3(C[0]*0.001,p.y*0.001,C[1]*0.001).project(camera);if(v.z>1){el.style.display='none';return}el.style.display='';el.style.left=((v.x+1)/2*r.width+r.left-h.left-8)+'px';el.style.top=((1-v.y)/2*r.height+r.top-h.top)+'px';el.classList.toggle('hov',BV.hover===p.id)})}
function bldPickAt(e){if(!T3||!T3.bldPick)return null;const{THREE,camera}=T3,r=$('#v3c').getBoundingClientRect();const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
  const h=rc.intersectObjects(T3.bldPick.map(p=>p.mesh),false)[0];return h?h.object.userData.level:null}
function bldHover(id){if(BV.hover===id)return;BV.hover=id;kick3D();(T3.bldPick||[]).forEach(p=>{p.mesh.material.opacity=p.id===id?0.13:0});$('#v3c').style.cursor=id?'pointer':''}
function renderBldBar(){const b=S.bld,nm=levelNames(b);const c=$('#v3-cut');if(c)c.innerHTML='<option value="">All floors</option>'+b.levels.slice().reverse().map(l=>`<option value="${l.id}"${BV.cut===l.id?' selected':''}>Up to ${nm[l.id]}</option>`).join('');}
$('#v3-cut').addEventListener('change',e=>{BV.cut=e.target.value;build3D()});
$('#v3-exp').addEventListener('change',e=>{BV.explode=e.target.checked;T3.framed=false;build3D()});if($('#v3-campus-b'))$('#v3-campus-b').addEventListener('click',()=>campusOpen());
$('#v3-furn').addEventListener('change',e=>{BV.furn=e.target.value;build3D()});
$('#v3-persp').addEventListener('click',()=>{if(WALK.on)walkStop();else frame3D('persp')});$('#v3-top').addEventListener('click',()=>frame3D('top'));
$('#v3-sec')&&$('#v3-sec').addEventListener('click',()=>{if(!S.section||!S.section.a)return;S.section.on=!S.section.on;markDirty();sectionApply();sectionBar();toast(S.section.on?'Section slice on':'Section slice off')});
$('#v3-secflip')&&$('#v3-secflip').addEventListener('click',()=>{if(!S.section)return;S.section.flip=!S.section.flip;markDirty();sectionApply()});
/* ---- sun study controls ---- */
(function sunUI(){const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const msel=$('#sun-month');if(msel){msel.innerHTML=MN.map((m,i)=>`<option value="${i}"${i===SUN.month?' selected':''}>${m}</option>`).join('')}
  const fmtMin=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const sync=()=>{const sl=$('#sun-time'),tv=$('#sun-timev');if(sl)sl.value=SUN.min;if(tv)tv.value=fmtMin(SUN.min);if(msel)msel.value=SUN.month};
  const upd=()=>{sync();applySun()};
  $('#v3-sun')&&$('#v3-sun').addEventListener('click',()=>{SUN.on=!SUN.on;sunBar();sync();if(is3D&&T3)build3D();applySun();toast(SUN.on?'Sun study on — choose the month and drag the time. Light enters through windows and open doors.':'Sun study off')});
  msel&&msel.addEventListener('change',e=>{SUN.month=+e.target.value;applySun()});
  $('#sun-time')&&$('#sun-time').addEventListener('input',e=>{SUN.min=+e.target.value;const tv=$('#sun-timev');if(tv)tv.value=fmtMin(SUN.min);applySun()});
  $('#sun-timev')&&$('#sun-timev').addEventListener('input',e=>{const m=/^(\d\d):(\d\d)$/.exec(e.target.value);if(m){SUN.min=Math.max(0,Math.min(1440,(+m[1])*60+(+m[2])));const sl=$('#sun-time');if(sl)sl.value=SUN.min;applySun()}});
  $('#sun-lat')&&$('#sun-lat').addEventListener('input',e=>{const v=parseFloat(e.target.value);if(isFinite(v)){SUN.lat=Math.max(-66,Math.min(66,v));applySun()}});
  $('#sun-north')&&$('#sun-north').addEventListener('input',e=>{const v=parseFloat(e.target.value);if(isFinite(v))setNorth(v)});
  const today=new Date();
  $('#sun-bar')&&$('#sun-bar').addEventListener('click',e=>{const b=e.target.closest('[data-sunp]');if(!b)return;const p=b.dataset.sunp;
    if(p==='today'){SUN.month=today.getMonth();SUN.day=today.getDate()}else if(p==='jun'){SUN.month=5;SUN.day=21}else if(p==='dec'){SUN.month=11;SUN.day=21}else if(p==='eq'){SUN.month=2;SUN.day=21}upd()});
})();
$('#v3-walls').value=P.wall3d||'full';$('#v3-walls').addEventListener('change',e=>{P.wall3d=e.target.value;savePrefs();build3D()});
/* STL of what the 3D view shows now (layers, cut height, floors, furniture options), in millimetres with Z up */
function exportSTL(scale,printable){if(!T3)return;scale=scale||1;const{THREE}=T3;T3.group.updateMatrixWorld(true);const tris=[];const v=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  const shown=o=>{for(let p=o;p&&p!==T3.group;p=p.parent){if(!p.visible||(p.userData&&p.userData.noExport))return false}return true};
  const flat=g=>g.type==='ShapeGeometry'||g.type==='PlaneGeometry';
  const addGeo=(g,mw)=>{const P=g.attributes.position,I=g.index,n=I?I.count:P.count;for(let k=0;k+2<n;k+=3){for(let q=0;q<3;q++){v[q].fromBufferAttribute(P,I?I.getX(k+q):k+q);if(mw)v[q].applyMatrix4(mw)}tris.push(v[0].x,v[0].y,v[0].z,v[1].x,v[1].y,v[1].z,v[2].x,v[2].y,v[2].z)}};
  /* printable: no glass or paper-thin floors; a 200 mm slab under a single floor so the model holds together */
  if(printable&&!bldView)floorPlate().forEach(poly=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*0.001,-p[1]*0.001)));const gg=new THREE.ExtrudeGeometry(sh,{depth:0.2,bevelEnabled:false});gg.rotateX(-Math.PI/2);gg.translate(0,-0.2,0);addGeo(gg,null);gg.dispose()});
  T3.group.traverse(o=>{if(!o.isMesh||!shown(o))return;const m=o.material;if(m&&!Array.isArray(m)&&m.transparent&&(m.opacity===0||printable))return;if(printable&&flat(o.geometry))return;const g=o.geometry,P=g.attributes.position;if(!P)return;const I=g.index;const n=I?I.count:P.count;
    for(let k=0;k+2<n;k+=3){for(let q=0;q<3;q++){v[q].fromBufferAttribute(P,I?I.getX(k+q):k+q).applyMatrix4(o.matrixWorld)}tris.push(v[0].x,v[0].y,v[0].z,v[1].x,v[1].y,v[1].z,v[2].x,v[2].y,v[2].z)}});
  const N=tris.length/9;if(!N)return toast('Nothing to export');const buf=new ArrayBuffer(84+N*50),dv=new DataView(buf);
  const head='StoreyBook '+APP_VERSION+' - '+(S.name||'plan');for(let i=0;i<Math.min(80,head.length);i++)dv.setUint8(i,head.charCodeAt(i)&127);dv.setUint32(80,N,true);
  /* scene is metres with Y up; STL gets millimetres with Z up */
  const f=1000/scale,X=(i)=>tris[i]*f,Y=(i)=>-tris[i+2]*f,Z=(i)=>tris[i+1]*f;let off=84;
  for(let t=0;t<N;t++){const b=t*9;const ax=X(b),ay=Y(b),az=Z(b),bx=X(b+3),by=Y(b+3),bz=Z(b+3),cx=X(b+6),cy=Y(b+6),cz=Z(b+6);
    let nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay),ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az),nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);const l=Math.hypot(nx,ny,nz)||1;
    [nx/l,ny/l,nz/l,ax,ay,az,bx,by,bz,cx,cy,cz].forEach(f=>{dv.setFloat32(off,f,true);off+=4});dv.setUint16(off,0,true);off+=2}
  download((S.name||'plan')+(bldView?' building':'')+(scale>1?` 1-${scale}`:'')+'.stl',new Blob([buf],{type:'model/stl'}));toast(`3D model saved: ${N.toLocaleString()} triangles${scale>1?` at 1:${scale}`:' at full size'}, millimetres, Z up`)}
$('#v3-stl').addEventListener('click',e=>{e.stopPropagation();const p=$('#pop-stl'),open=p.hidden;closePops();if(!open)return;const r=e.currentTarget.getBoundingClientRect();p.style.left=Math.max(8,Math.min(innerWidth-260,r.left))+'px';p.style.top=(r.bottom+6)+'px';p.hidden=false});
$('#stl-go').addEventListener('click',()=>{$('#pop-stl').hidden=true;exportSTL(+$('#stl-scale').value||1,$('#stl-print').checked)});
$('#v3-png').addEventListener('click',()=>{if(!T3)return;T3.renderer.render(T3.scene,T3.camera);T3.renderer.domElement.toBlob(b=>{if(b){download((S.name||'plan')+' 3D.png',b);toast('3D image saved')}},'image/png')});
window.addEventListener('resize',()=>{if(is3D)size3D()});
if(window.ResizeObserver&&$('#v3'))new ResizeObserver(()=>{if(is3D&&T3)size3D()}).observe($('#v3'));
['resize','orientationchange'].forEach(t=>window.addEventListener(t,()=>{if(is3D&&T3){size3D();setTimeout(()=>{if(is3D&&T3)size3D()},120)}}));

/* ================= walkthrough =================
   First person at eye height. W A S D or arrows move, mouse looks (click to capture it), Shift runs.
   Walls stop you, door openings let you through, furniture taller than 300 mm blocks you. C walks through walls. */
const WALK={dist:3200,on:false,yaw:0,pitch:0,pos:[0,0],keys:new Set(),last:0,collide:true,R:250,eye:1630,look:null,z:0,vz:0,map:null,third:false,stride:0,moveAmt:0,height:1750};
/* the person marker used when picking the start: body circle and a view cone */
function walkerSVG(a){const r=Math.max(260,fs(10));
  return `<ellipse class="walk-body" cx="${a[0]}" cy="${a[1]+r*0.5}" rx="${r*1.2}" ry="${r*1.65}"/><circle class="walk-head" cx="${a[0]}" cy="${a[1]-r*1.1}" r="${r}"/>`}
function walkPickStart(){if(WALK.on)return;if(roofMode)exitRoof();if(is3D)set3D(false);calib=null;detBox=false;underMove=false;setTool('select');walkPick=true;svg.style.cursor='crosshair';updateHint();render();toast((TOUCH?'Tap where you want to stand. Drag to face a direction.':'Click where you want to stand. Drag to face a direction.'))}
function walkStart(opt){
  if(roofMode)exitRoof();if(!is3D)set3D(true);if(!T3||!is3D)return;const{camera,controls,THREE}=T3;
  let st=opt&&opt.pos?opt.pos.slice():null;const r=selList().find(o=>o.t==='room');if(!st&&r)st=centroid(r.pts);
  if(!st){const rooms=S.objs.filter(o=>o.t==='room'&&visible(o));const t=[controls.target.x/0.001,controls.target.z/0.001];const inR=rooms.find(o=>pointInPoly(t[0],t[1],o.pts));
    st=inR?t:(rooms.length?centroid(rooms.slice().sort((a,b)=>Math.abs(polyArea(b.pts))-Math.abs(polyArea(a.pts)))[0].pts):t)}
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  WALK.on=true;WALK.gz=0;WALK.roof=false;WALK.joy=null;if(T3&&T3.controls)T3.controls.enabled=false;const jy=$('#joy');if(jy)jy.hidden=!TOUCH;try{build3D()}catch(e){}WALK.pos=[st[0],st[1]];WALK.yaw=opt&&opt.yaw!=null?opt.yaw:Math.atan2(-dir.x,-dir.z);WALK.pitch=0;WALK.z=0;WALK.vz=0;WALK.keys.clear();WALK.last=performance.now();
  controls.enabled=false;camera.fov=70;camera.near=0.05;camera.far=500;camera.updateProjectionMatrix();
  sel.clear();renderInspector();build3D();walkResolve(WALK.pos);
  $('#walk-hud').hidden=false;$('#walk-map').hidden=false;$('#main').classList.add('walking');$('#v3-top').style.display='none';$('#v3-persp').style.display='none';$('#v3-pov').style.display='';$('#v3-pov').textContent=WALK.third?'1st person':'3rd person';mapBuild();$('#v3-walk').classList.add('on');$('#v3-walk').textContent='Exit walk';$('#b-walk').classList.add('on');updateHint();walkHud();
}
function walkStop(silent){WALK.roof=false;
  WALK.on=false;WALK.keys.clear();WALK.joy=null;if(T3&&T3.controls)T3.controls.enabled=true;{const jy=$('#joy');if(jy)jy.hidden=true}if(document.pointerLockElement)document.exitPointerLock();
  $('#walk-hud').hidden=true;$('#walk-map').hidden=true;$('#main').classList.remove('walking');$('#walk-tip').hidden=true;$('#v3-top').style.display='';$('#v3-persp').style.display='';$('#v3-pov').style.display='none';if(T3&&T3.avatar)T3.avatar.visible=false;$('#v3-walk').classList.remove('on');$('#v3-walk').textContent='Walk';$('#b-walk').classList.remove('on');
  if(T3&&!silent){T3.controls.enabled=true;T3.camera.fov=45;T3.camera.updateProjectionMatrix();build3D();frame3D('persp')}else if(T3){T3.controls.enabled=true;T3.camera.fov=45;T3.camera.updateProjectionMatrix()}
  updateHint();
}
function walkHud(){const h=$('#walk-hud');if(!h)return;const locked=!!document.pointerLockElement;
  if(TOUCH){const lift=liftHere();h.innerHTML='<b>Walkthrough</b> left stick to walk · drag the view to look · tap a door to open it'+(lift?'<div class="row" style="justify-content:center;margin-top:6px;gap:8px"><button class="btn sm" type="button" data-lift="1">▲ Floor up</button><button class="btn sm" type="button" data-lift="-1">▼ Floor down</button></div>':'');WALK.hudLift=!!lift;return}
  h.innerHTML=`<b>Walkthrough</b> ${locked?'Move the mouse to look around':'Click the view to look with the mouse'} · <span class="kbd">W A S D</span> move · <span class="kbd">Shift</span> run · <span class="kbd">Space</span> jump · <span class="kbd">E</span> open or close a door or lift · <span class="kbd">V</span> ${WALK.third?'first':'third'} person · <span class="kbd">C</span> walls ${WALK.collide?'solid':'walk-through'} · <span class="kbd">Esc</span> ${locked?'shows the cursor, again to exit':'exits'}`}
/* doors swing towards open or shut a little each frame */
function doorsAnimate(){if(!T3)return false;let moving=false;/* eased by the clock, not by the frame: a door takes the same time to swing on a slow graphics card as on a fast one (it used to move 18% of the way per frame, so at 3 frames a second a lift door took over six seconds and kept the view redrawing) */const now=performance.now(),dt=T3.doorMoving?Math.min(1000,Math.max(1,now-(T3.doorT||now))):16.7,K=1-Math.pow(0.82,dt/16.7);T3.doorT=now;Object.entries(T3.doorPiv).forEach(([id,piv])=>{const ds=T3.doorState[id];if(!ds)return;const tg=ds.open?Math.PI/2:0;if(Math.abs(ds.a-tg)<0.002)return;moving=true;ds.a+=(tg-ds.a)*K;if(Math.abs(ds.a-tg)<0.01)ds.a=tg;piv.forEach(q=>q.pv.rotation.y=-q.dir*ds.a)});
  Object.entries(T3.liftPiv).forEach(([id,lp])=>{const ds=T3.doorState[id];const tg=ds&&ds.open?1:0;if(ds&&ds.s==null)ds&&(ds.s=tg);const cur=ds?ds.s:0;if(Math.abs(cur-tg)<0.002)return;moving=true;const nv=cur+(tg-cur)*K,v=Math.abs(nv-tg)<0.01?tg:nv;if(ds)ds.s=v;lp.left.position.x=(lp.lx-v*lp.slide)*0.001;lp.right.position.x=(lp.rx+v*lp.slide)*0.001});T3.doorMoving=moving;return moving}
/* a shut door blocks the opening like a thin wall */
function doorCols(){const out=[];if(!T3)return out;S.objs.forEach(o=>{if(o.t!=='item'||!visible(o))return;
  if(/^door/.test(o.shape)){const ds=T3.doorState[o.id];if(!ds||ds.open)return;const p=toW(o,[[-o.w/2,0],[o.w/2,0]]);out.push({a:p[0],b:p[1],t:60});return}
  if(isCore(o)&&o.shape==='lift'){const ds=T3.doorState[o.id];if(ds&&ds.open)return;const t=200,hd=o.d/2,oh=Math.min(550,Math.max(60,(o.w-2*t-200)/2));const p=toW(o,[[-oh,hd-t/2],[oh,hd-t/2]]);out.push({a:p[0],b:p[1],t:60})}});return out}
/* the door you are looking at, within reach */
function walkTarget(){const f=[-Math.sin(WALK.yaw),-Math.cos(WALK.yaw)];let best=null;
  S.objs.forEach(o=>{if(o.t!=='item'||!(/^door/.test(o.shape)||o.shape==='lift')||!visible(o))return;/* a lift is reached at its doors, not its middle: measured from the middle, a deep lift car (2.5 m in generated buildings) was out of reach from the lobby */const at=o.shape==='lift'?toW(o,[[0,o.d/2-100]])[0]:[o.x,o.y];const dx=at[0]-WALK.pos[0],dy=at[1]-WALK.pos[1],d=Math.hypot(dx,dy);if(d>2200)return;const dot=d<1?1:(dx*f[0]+dy*f[1])/d;if(dot<0.4&&d>800)return;const sc=d*(1.7-dot);if(!best||sc<best.sc)best={o,sc}});return best?best.o:null}
function walkInteract(){const o=walkTarget();if(!o)return toast('Nothing to open within reach. Walk up to a door or lift and look at it.');const isLift=o.shape==='lift';
  const ds=T3.doorState[o.id]||(T3.doorState[o.id]=isLift?{open:false,s:0}:{open:true,a:Math.PI/2});ds.open=!ds.open;if(!ds.open)walkResolve(WALK.pos);
  if(isLift)toast(ds.open?'Lift doors opening':'Lift doors closing')}
/* keep the walker out of walls and furniture */
function walkResolve(p){
  if(!WALK.collide||!T3||!T3.cols)return p;const R=WALK.R;const cols=T3.cols.concat(doorCols());
  for(let it=0;it<3;it++)cols.forEach(c=>{
    if(c.poly){const P2=c.poly;const inside=pointInPoly(p[0],p[1],P2);let best=null;
      for(let i=0;i<P2.length;i++){const a=P2[i],b=P2[(i+1)%P2.length];const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1;let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2;t=Math.max(0,Math.min(1,t));const q=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(!best||d<best.d)best={d,q}}
      if(!best)return;if(inside||best.d<R){let nx=p[0]-best.q[0],ny=p[1]-best.q[1],L=Math.hypot(nx,ny);if(L<1e-6){nx=1;ny=0;L=1}if(inside){nx=-nx;ny=-ny}p[0]=best.q[0]+nx/L*R;p[1]=best.q[1]+ny/L*R}}
    else{const a=c.a,b=c.b,dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1;let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2;t=Math.max(0,Math.min(1,t));const q=[a[0]+t*dx,a[1]+t*dy];const d=Math.hypot(p[0]-q[0],p[1]-q[1]),m=R+c.t/2;
      if(d<m){let nx=p[0]-q[0],ny=p[1]-q[1],L=Math.hypot(nx,ny);if(L<1e-6){nx=-dy;ny=dx;L=Math.hypot(nx,ny)||1}p[0]=q[0]+nx/L*m;p[1]=q[1]+ny/L*m}}});
  return p;
}
/* the 1.75 m figure shown in third person: legs and arms hang from hip and shoulder pivots so they can swing */
function avatarGet(){
  if(T3.avatar)return T3.avatar;const{THREE}=T3,s=0.001;const A=new THREE.Group(),body=new THREE.Group();A.add(body);
  const M=c=>new THREE.MeshStandardMaterial({color:new THREE.Color(c).convertSRGBToLinear(),roughness:0.8});
  const shirt=M('#5b7fa6'),pants=M('#2c3440'),skin=M('#d6a47c'),hair=M('#2a1f1a'),shoe=M('#16191d');
  const part=(parent,geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x*s,y*s,z*s);m.castShadow=true;parent.add(m);return m};
  const limb=(x,y,len,w,d,mat,end)=>{const pv=new THREE.Group();pv.position.set(x*s,y*s,0);body.add(pv);part(pv,new THREE.BoxGeometry(w*s,len*s,d*s),mat,0,-len/2,0);if(end)end(pv,len);return pv};
  /* legs from the hips (0.9 m), shoes pointing forward (-z) */
  const legL=limb(-95,900,860,130,150,pants,(pv,len)=>part(pv,new THREE.BoxGeometry(120*s,70*s,250*s),shoe,0,-len-5,-45));
  const legR=limb(95,900,860,130,150,pants,(pv,len)=>part(pv,new THREE.BoxGeometry(120*s,70*s,250*s),shoe,0,-len-5,-45));
  part(body,new THREE.BoxGeometry(330*s,150*s,190*s),pants,0,930,0);
  part(body,new THREE.BoxGeometry(400*s,500*s,230*s),shirt,0,1230,0);
  const armL=limb(-245,1440,640,95,110,shirt,(pv,len)=>part(pv,new THREE.SphereGeometry(52*s,10,8),skin,0,-len-30,0));
  const armR=limb(245,1440,640,95,110,shirt,(pv,len)=>part(pv,new THREE.SphereGeometry(52*s,10,8),skin,0,-len-30,0));
  part(body,new THREE.CylinderGeometry(50*s,55*s,90*s,12),skin,0,1520,0);
  part(body,new THREE.SphereGeometry(118*s,20,16),skin,0,1630,0);
  const h=part(body,new THREE.SphereGeometry(126*s,20,14,0,Math.PI*2,0,Math.PI*0.62),hair,0,1640,6);h.rotation.x=0.75;/* hair over the crown and the back of the head, so you can tell front from back */
  part(body,new THREE.BoxGeometry(40*s,40*s,40*s),skin,0,1620,-118);
  A.userData={legL,legR,armL,armR,body};A.visible=false;T3.scene.add(A);T3.avatar=A;return A;
}
/* keep the follow camera on this side of the walls (only when walls are drawn full height) */
function camClear(tg,dir,dist){if(P.wall3d!=='full'||!T3.cols)return dist;const ax=tg[0],az=tg[2],bx=tg[0]-dir[0]*dist,bz=tg[2]-dir[2]*dist;let best=1;
  T3.cols.forEach(c=>{if(!c.a)return;const cx=c.a[0],cz=c.a[1],dx=c.b[0]-cx,dz=c.b[1]-cz,ex=bx-ax,ez=bz-az;const den=ex*dz-ez*dx;if(Math.abs(den)<1e-9)return;
    const t=((cx-ax)*dz-(cz-az)*dx)/den,u=((cx-ax)*ez-(cz-az)*ex)/den;if(t>0&&t<best&&u>=0&&u<=1)best=t});
  return best<1?Math.max(500,best*dist-300):dist}
function walkView(third,quiet){WALK.third=third!=null?third:!WALK.third;if(WALK.third&&WALK.dist<900)WALK.dist=quiet?1200:3200;$('#v3-pov').textContent=WALK.third?'1st person':'3rd person';walkHud();if(!quiet)toast(WALK.third?'Third person: scroll to zoom, all the way in for first person':'First person: eye height 1.63 m · scroll out for third person')}
function walkZoom(dir){/* dir>0 zooms out */if(!WALK.third){if(dir>0)walkView(true,true);return}WALK.dist*=dir>0?1.15:1/1.15;if(WALK.dist<800){WALK.dist=800;walkView(false,true);return}WALK.dist=Math.min(6000,WALK.dist)}
$('#v3c').addEventListener('wheel',e=>{if(!WALK.on)return;e.preventDefault();walkZoom(e.deltaY>0?1:-1)},{passive:false});
/* ground under the walker: 0 on the floor, rising along a stair that goes up from this floor */
function stairLocal(c,p){const a=-(c.r||0)*Math.PI/180,dx=p[0]-c.x,dy=p[1]-c.y;return[dx*Math.cos(a)-dy*Math.sin(a),dx*Math.sin(a)+dy*Math.cos(a)]}
function stairGeo(c,ftf){const g0=100,fw=(c.w-g0)/2,Ld=Math.min(fw,c.d*0.4),R=c.d-Ld,n=Math.max(4,Math.round(ftf/170)),n1=Math.ceil(n/2),ri=ftf/n;return{g0,Ld,R,n1,n2:n-n1,ri,hw:c.w/2,hd:c.d/2}}
function stairH(c,q,ftf){const G=stairGeo(c,ftf);const[x,y]=q;if(Math.abs(x)>G.hw||Math.abs(y)>G.hd)return 0;
  if(y<-G.hd+G.Ld)return G.n1*G.ri;if(x<0)return Math.max(0,Math.min(1,(G.hd-y)/G.R))*G.n1*G.ri;return G.n1*G.ri+Math.max(0,Math.min(1,(y-(-G.hd+G.Ld))/G.R))*G.n2*G.ri}
function walkFloorInfo(){const b=S.bld;if(!b)return null;const i=b.levels.indexOf(bldLevel(S)),st=levelStack(b);return{b,i,ftf:st[i]?st[i].ftf:3950,stairs:S.objs.filter(o=>isCore(o)&&o.shape==='stair')}}
function walkLiftAt(p){const b=S.bld;if(!b)return null;for(const c of S.objs){if(!isCore(c)||c.shape!=='lift')continue;const q=stairLocal(c,p),t=200;if(Math.abs(q[0])<c.w/2-t&&Math.abs(q[1])<c.d/2-t)return c}return null}
function walkGround(p){if(WALK.roof)return 0;const F=walkFloorInfo();if(!F)return 0;let h=0;F.stairs.forEach(c=>{if(coreUp(F.b,c,F.i))h=Math.max(h,stairH(c,stairLocal(c,p),F.ftf))});
  if(F.b)S.objs.forEach(o=>{if(o.t==='room'&&o.raise>0&&pointInPoly(p[0],p[1],o.pts))h=Math.max(h,o.raise)});return h}
/* after a move: climb off the top of a stair onto the floor above, or step down into the stair from the floor below */
function walkStairs(prev,gz0){const F=walkFloorInfo();if(!F)return false;
  if(WALK.roof){for(const c of F.stairs){if(!coreUp(F.b,c,F.i))continue;const q0=stairLocal(c,prev),q1=stairLocal(c,WALK.pos),G=stairGeo(c,F.ftf);
      if(q1[0]>G.g0/2&&q1[0]<G.hw&&q0[1]>G.hd&&q1[1]<=G.hd){WALK.roof=false;build3D();WALK.gz=walkGround(WALK.pos);return true}}return false}
  for(const c of F.stairs){const q0=stairLocal(c,prev),q1=stairLocal(c,WALK.pos),G=stairGeo(c,F.ftf);const inX=x=>x>G.g0/2&&x<G.hw;
    if(coreUp(F.b,c,F.i)&&inX(q0[0])&&q0[1]<=G.hd&&q1[1]>G.hd&&gz0>F.ftf*0.7){const nx=F.b.levels[F.i+1];if(!nx){if(WALK.roof||c.roof===false)return false;WALK.roof=true;WALK.gz=0;build3D();notice('Roof',['You are on the roof.','Walk back into the stair housing to go down.']);return true}
      switchFloor(nx.id,true);WALK.gz=0;return true}
    const below=F.i>0&&coreUp(F.b,c,F.i-1);if(below&&inX(q1[0])&&q0[1]>G.hd&&q1[1]<=G.hd&&gz0<300){const pv=F.b.levels[F.i-1];switchFloor(pv.id,true);WALK.gz=walkGround(WALK.pos);return true}}return false}
function insideLift(o,p){const t=200,hw=o.w/2,hd=o.d/2,q=stairLocal(o,p);return Math.abs(q[0])<hw-t&&Math.abs(q[1])<hd-t}
function liftHere(){return S.bld?S.objs.find(o=>isCore(o)&&o.shape==='lift'&&insideLift(o,WALK.pos)):null}
function rideLift(dir){const b=S.bld;if(!b)return;const lift=liftHere();if(!lift)return toast(TOUCH?'Step inside a lift to change floor':'Step inside a lift, then use PageUp / PageDown to change floor');
  const[lo,hi]=coreRange(b,lift),i=b.levels.indexOf(bldLevel(S)),ni=i+dir;
  if(ni<lo||ni>hi)return toast(dir>0?'This lift stops here at the top':'This lift stops here at the bottom');
  const target=b.levels[ni];switchFloor(target.id,true);WALK.gz=walkGround(WALK.pos);WALK.z=0;WALK.vz=0;
  const ds=T3.doorState[lift.id]||(T3.doorState[lift.id]={open:false,s:0});ds.open=true;if(is3D&&T3)build3D();
  toast('Lift: '+(levelNames(b)[target.id]||target.id))}
/* on touch the lift buttons appear in the walk banner while you stand in a lift */
$('#walk-hud')&&$('#walk-hud').addEventListener('click',e=>{const b=e.target.closest('[data-lift]');if(!b)return;e.stopPropagation();rideLift(+b.dataset.lift);setTimeout(walkHud,50)});
function walkStep(){if(TOUCH&&WALK.on&&!!liftHere()!==!!WALK.hudLift)walkHud();
  const now=performance.now(),dt=Math.min(0.05,(now-WALK.last)/1000);WALK.last=now;const K=WALK.keys;
  if(K.has('arrowleft'))WALK.yaw+=1.8*dt;if(K.has('arrowright'))WALK.yaw-=1.8*dt;
  let f=0,r=0;if(K.has('w')||K.has('arrowup'))f++;if(K.has('s')||K.has('arrowdown'))f--;if(K.has('d'))r++;if(K.has('a'))r--;if(WALK.joy){f+=WALK.joy.f;r+=WALK.joy.r}
  if(f||r){T3.walkMoved=now;if(T3.fullDpr>1&&!T3.lowDpr&&T3.renderer){T3.lowDpr=true;T3.renderer.setPixelRatio(1)}
    const L=Math.hypot(f,r),sp=(K.has('shift')?3200:1400)*dt*(WALK.joy&&!K.size?Math.min(1,L):1);const fx=-Math.sin(WALK.yaw),fy=-Math.cos(WALK.yaw),rx=Math.cos(WALK.yaw),ry=-Math.sin(WALK.yaw);
    const mx=(fx*f+rx*r)/L*sp,my=(fy*f+ry*r)/L*sp;const n=Math.max(1,Math.ceil(Math.hypot(mx,my)/(WALK.R/3)));
    const p0=WALK.pos.slice();for(let i=0;i<n;i++){const pp=WALK.pos.slice();WALK.pos[0]+=mx/n;WALK.pos[1]+=my/n;walkResolve(WALK.pos);
      const gz0=WALK.gz||0;if(walkStairs(pp,gz0))break;
      /* a step up or down of more than a riser is a wall or a drop: walk back */const g=walkGround(WALK.pos);if(Math.abs(g-gz0)>320){WALK.pos=pp;break}WALK.gz=g}WALK.stride+=Math.hypot(WALK.pos[0]-p0[0],WALK.pos[1]-p0[1])}
  else WALK.gz=walkGround(WALK.pos);
  {const inL=!!walkLiftAt(WALK.pos);if(inL&&!WALK.inLift)toast(TOUCH?'In the lift — tap ▲ Floor up or ▼ Floor down':'In the lift — PageUp / PageDown to change floor');WALK.inLift=inL}
  WALK.moveAmt+=(((f||r)?1:0)-WALK.moveAmt)*Math.min(1,dt*10);
  if(WALK.z>0||WALK.vz>0){WALK.vz-=9810*dt;WALK.z+=WALK.vz*dt;if(WALK.z<=0){WALK.z=0;WALK.vz=0}}
  const c=T3.camera,s=0.001;const A=avatarGet();
  if(WALK.third){
    /* third person: a follow camera about 3.2 m behind and above the figure, pulled in when a wall is in the way */
    const yaw=WALK.yaw,pitch=Math.max(-1.1,Math.min(0.45,WALK.pitch));const gz=WALK.gz||0;const tg=[WALK.pos[0],1450+gz+WALK.z,WALK.pos[1]];
    const dir=[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];const dist=camClear(tg,dir,WALK.dist);
    c.position.set((tg[0]-dir[0]*dist)*s,Math.max(350+gz,tg[1]-dir[1]*dist+450)*s,(tg[2]-dir[2]*dist)*s);c.rotation.order='XYZ';c.lookAt(tg[0]*s,(tg[1]+100)*s,tg[2]*s);
    A.visible=true;A.position.set(WALK.pos[0]*s,(gz+WALK.z)*s,WALK.pos[1]*s);A.rotation.y=yaw;
    const sw=Math.sin(WALK.stride/700*Math.PI)*0.6*WALK.moveAmt,U=A.userData;U.legL.rotation.x=sw;U.legR.rotation.x=-sw;U.armL.rotation.x=-sw*0.8;U.armR.rotation.x=sw*0.8;
    U.body.position.y=Math.abs(Math.sin(WALK.stride/700*Math.PI))*18*WALK.moveAmt*s;
  }else{
    A.visible=false;c.position.set(WALK.pos[0]*s,(WALK.eye+(WALK.gz||0)+WALK.z)*s,WALK.pos[1]*s);
    /* point the camera where you are looking: turn (yaw) first, then tilt (pitch) */
    c.rotation.order='YXZ';c.rotation.set(WALK.pitch,WALK.yaw,0);
  }
  mapDraw();
  $('#coords').textContent=`${fmt(WALK.pos[0])}, ${fmt(WALK.pos[1])} mm`;
}
const WALK_CODES={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',ArrowUp:'arrowup',ArrowDown:'arrowdown',ArrowLeft:'arrowleft',ArrowRight:'arrowright',ShiftLeft:'shift',ShiftRight:'shift'};
const walkKey=e=>WALK_CODES[e.code]||null;
const walkLook=(dx,dy)=>{if(Math.abs(dx)>200||Math.abs(dy)>200)return;WALK.yaw-=dx*0.0025;WALK.pitch=Math.max(-1.35,Math.min(1.35,WALK.pitch-dy*0.0025))};
$('#v3c').addEventListener('pointerdown',e=>{if(!WALK.on||e.button!==0)return;WALK.look=[e.clientX,e.clientY];if(!document.pointerLockElement){try{const pr=$('#v3c').requestPointerLock();if(pr&&pr.catch)pr.catch(()=>{})}catch(err){}}});
document.addEventListener('pointermove',e=>{if(!WALK.on)return;if(document.pointerLockElement===$('#v3c')){walkLook(e.movementX||0,e.movementY||0);return}if(!WALK.look)return;if(!e.buttons){WALK.look=null;return}walkLook(e.clientX-WALK.look[0],e.clientY-WALK.look[1]);WALK.look=[e.clientX,e.clientY]});
document.addEventListener('pointerup',()=>{WALK.look=null});
/* virtual joystick (touch): drag the knob to walk; a short tap on the view opens the door or lift in front of you */
{const jy=$('#joy');if(jy){const kn=jy.querySelector('.knob');let pid=null;const R=46;
  const setJ=(e)=>{const b=jy.getBoundingClientRect();let dx=e.clientX-(b.left+b.width/2),dy=e.clientY-(b.top+b.height/2);const L=Math.hypot(dx,dy)||1;if(L>R){dx=dx/L*R;dy=dy/L*R}kn.style.transform=`translate(${dx}px,${dy}px)`;WALK.joy={f:-dy/R,r:dx/R}};
  jy.addEventListener('pointerdown',e=>{pid=e.pointerId;jy.setPointerCapture(pid);setJ(e);e.preventDefault()});
  jy.addEventListener('pointermove',e=>{if(e.pointerId===pid)setJ(e)});
  const end=e=>{if(e.pointerId!==pid)return;pid=null;WALK.joy=null;kn.style.transform=''};jy.addEventListener('pointerup',end);jy.addEventListener('pointercancel',end)}
 const c3=$('#v3c');let tapAt=null;c3.addEventListener('pointerdown',e=>{tapAt=(WALK.on&&e.pointerType==='touch')?[e.clientX,e.clientY,performance.now()]:null});
 c3.addEventListener('pointerup',e=>{if(tapAt&&WALK.on&&Math.hypot(e.clientX-tapAt[0],e.clientY-tapAt[1])<8&&performance.now()-tapAt[2]<350)walkInteract();tapAt=null})}
document.addEventListener('pointerlockchange',()=>{if(WALK.on)walkHud()});
window.addEventListener('blur',()=>{WALK.keys.clear();WALK.look=null});document.addEventListener('visibilitychange',()=>{WALK.keys.clear();WALK.look=null});
$('#v3-walk').addEventListener('click',()=>{WALK.on?walkStop():walkPickStart()});
$('#v3-pov').addEventListener('click',()=>walkView());
$('#b-walk').addEventListener('click',()=>{WALK.on?walkStop():walkPick?(walkPick=false,updateHint(),render()):walkPickStart()});
/* mini-map: the plan from above with you on it. Click it to jump there. */
function mapBuild(){
  const cv=$('#walk-map canvas');const dpr=Math.min(2,window.devicePixelRatio||1);const Wm=240,Hm=180;cv.width=Wm*dpr;cv.height=Hm*dpr;
  const objs=S.objs.filter(o=>visible(o)&&(o.t==='room'||o.t==='wall'||o.t==='item'));const pts=[];objs.forEach(o=>{const b=objBox(o);pts.push([b.x0,b.y0],[b.x1,b.y1])});pts.push(WALK.pos);
  const B=bboxPts(pts),pad=10,sc=Math.min((Wm-2*pad)/Math.max(1,B.x1-B.x0),(Hm-2*pad)/Math.max(1,B.y1-B.y0));
  const ox=pad+((Wm-2*pad)-(B.x1-B.x0)*sc)/2-B.x0*sc,oy=pad+((Hm-2*pad)-(B.y1-B.y0)*sc)/2-B.y0*sc;
  const base=document.createElement('canvas');base.width=cv.width;base.height=cv.height;const g=base.getContext('2d');g.scale(dpr,dpr);
  const css=v=>cssColor(v);g.fillStyle=css('--panel');g.fillRect(0,0,Wm,Hm);
  const path=(p,close)=>{g.beginPath();p.forEach((q,i)=>{const x=ox+q[0]*sc,y=oy+q[1]*sc;i?g.lineTo(x,y):g.moveTo(x,y)});if(close)g.closePath()};
  objs.filter(o=>o.t==='room').forEach(o=>{path(o.pts,true);g.fillStyle=css('--room');g.globalAlpha=.5;g.fill();g.globalAlpha=1;if(!o.nowall){g.strokeStyle=css('--wall');g.lineWidth=Math.max(1,(P.wall||100)*sc);g.stroke()}});
  objs.filter(o=>o.t==='item'&&!isOpening(o)).forEach(o=>{path(toW(o,rectP(-o.w/2,-o.d/2,o.w/2,o.d/2)),true);g.strokeStyle=css('--muted');g.globalAlpha=.55;g.lineWidth=.6;g.stroke();g.globalAlpha=1});
  objs.filter(o=>o.t==='wall').forEach(o=>{path(wallPathPts(o),o.closed);g.strokeStyle=css('--wall');g.lineWidth=Math.max(1.2,(o.th||100)*sc);g.lineCap='square';g.stroke()});
  WALK.map={base,sc,ox,oy,Wm,Hm,dpr};
}
function mapDraw(){const M=WALK.map;if(!M)return;const cv=$('#walk-map canvas');const g=cv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.drawImage(M.base,0,0);g.scale(M.dpr,M.dpr);
  const x=M.ox+WALK.pos[0]*M.sc,y=M.oy+WALK.pos[1]*M.sc;const col=cssColor('--danger'),ang=Math.atan2(-Math.cos(WALK.yaw),-Math.sin(WALK.yaw));
  /* facing cone */
  g.beginPath();g.moveTo(x,y);g.arc(x,y,30,ang-0.5,ang+0.5);g.closePath();g.fillStyle=cssColor('--accent');g.globalAlpha=.3;g.fill();g.globalAlpha=1;
  /* person dot */
  g.fillStyle=col;g.strokeStyle='#fff';g.lineWidth=1.5;g.beginPath();g.arc(x,y,5,0,Math.PI*2);g.fill();g.stroke()}
$('#walk-map').addEventListener('pointerdown',e=>{e.stopPropagation();const M=WALK.map;if(!M||!WALK.on)return;const r=e.currentTarget.querySelector('canvas').getBoundingClientRect();
  WALK.pos=[(e.clientX-r.left-M.ox)/M.sc,(e.clientY-r.top-M.oy)/M.sc];walkResolve(WALK.pos)});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{render()});

/* ================= on-prem AI (Ollama): the model answers with JSON commands, StoreyBook runs them, and the changes wait as a preview to accept or undo =================
   Runs entirely on the user's machine: the page talks to Ollama at http://localhost:11434 (or another address on the user's network). Nothing leaves the network. */
const AI={on:false,busy:false,ctrl:null,logs:{},pending:null,tab:null,wait:null,briefOpen:false};const AI_CLOSED='That plan was closed while the AI was working, so its answer was dropped.';
/* each provider tab keeps its own conversation */
Object.defineProperty(AI,'log',{get(){const k=aiCfg().prov;return AI.logs[k]||(AI.logs[k]=[])},set(v){AI.logs[aiCfg().prov]=v}});
const AI_DEF={prov:'ollama',url:'http://localhost:11434',model:'',ctx:16384,think:false,key:'',cmodel:'claude-sonnet-5-5',curl:'https://api.anthropic.com'};
const CLAUDE_MODELS=['claude-opus-5-5','claude-sonnet-5-5','claude-haiku-5-5'];
const aiIsC=c=>(c||aiCfg()).prov==='claude';
const aiIsP=c=>(c||aiCfg()).prov==='paste';
const aiModel=c=>aiIsC(c)?c.cmodel:c.model;
const aiCfg=()=>Object.assign({},AI_DEF,P.ai||{});
const aiLevelByName=n=>{if(!S.bld)return null;const nm=levelNames(S.bld),k=String(n||'').trim().toUpperCase();return S.bld.levels.find(l=>nm[l.id]===k||l.id===n)||null};
function aiRoomBy(ref){const r=String(ref||'').trim().toLowerCase();return S.objs.find(o=>o.t==='room'&&(o.id===ref||(o.name||'').toLowerCase()===r))||S.objs.find(o=>o.t==='room'&&(o.name||'').toLowerCase().includes(r))}
/* numbers from a model are kept within 5 km, so one wild value cannot send the plan off the page */const aiNum=(v,d)=>{const n=+v;return isFinite(n)?Math.max(-5e6,Math.min(5e6,n)):d};
const aiPts=a=>Array.isArray(a)?a.filter(p=>Array.isArray(p)&&p.length>=2&&isFinite(+p[0])&&isFinite(+p[1])).map(p=>[Math.round(aiNum(p[0],0)),Math.round(aiNum(p[1],0))]):[];
function aiLib(code){const c=String(code||'').trim().toUpperCase();return LIB.find(l=>l.code.toUpperCase()===c)||null}
/* the plan as the model sees it: compact, ids included so it can edit what is there */
function aiPlanSummary(){syncFloorOut(S);ensureBld(S);const b=S.bld,nm=levelNames(b),st=levelStack(b),act=bldLevel(S);
  const rooms=S.objs.filter(o=>o.t==='room').map(o=>{const bb=bboxPts(o.pts);return{id:o.id,name:o.name,box:[Math.round(bb.x0),Math.round(bb.y0),Math.round(bb.x1),Math.round(bb.y1)],corners:o.pts.length,area_m2:+(Math.abs(polyArea(o.pts))/1e6).toFixed(1),zone:o.zone||undefined}});
  const items=S.objs.filter(o=>o.t==='item'),walls=S.objs.filter(o=>o.t==='wall');const cnt={};items.forEach(o=>{cnt[o.code]=(cnt[o.code]||0)+1});
  const all=[...rooms.flatMap(r=>[[r.box[0],r.box[1]],[r.box[2],r.box[3]]]),...walls.flatMap(w=>w.pts||[])];const ext=all.length?bboxPts(all):null;
  return{units:'mm, x to the right, y downwards',wall_thickness:P.wall||150,north_deg:num(S.north,0),name:S.name,
    floors:b.levels.map((l,i)=>({name:nm[l.id],kind:l.kind==='B'?'basement':'floor',layout:l.unique?'unique':'typical',floor_to_floor:st[i].ftf,fitout_items:(l===act?items.length:(l.fit||[]).length)})).reverse(),open_floor:nm[act.id],
    extents:ext?[Math.round(ext.x0),Math.round(ext.y0),Math.round(ext.x1),Math.round(ext.y1)]:null,rooms,walls:walls.map(w=>({id:w.id,pts:w.pts,kind:w.site||'wall'})).slice(0,60),
    item_counts:cnt,items:items.slice(0,200).map(o=>({id:o.id,code:o.code,x:Math.round(o.x),y:Math.round(o.y),r:o.r||0})),items_listed:Math.min(200,items.length),items_total:items.length,
    cost:costCfg(),pins:(S.pins||[]).map(p=>({no:pinNo(p),x:p.x,y:p.y,text:p.text,done:!!p.done}))}}
function aiCatalogue(){return LIB.filter(l=>l.shape!=='set').map(l=>`${l.code}|${l.name}|${l.cat}|${Math.round(l.w)}x${Math.round(l.d)}${l.seats?'|seats '+l.seats:''}`).join('\n')}
function aiSystem(){return`You are the design assistant inside StoreyBook, a floor plan and building planner. You change the plan by returning JSON commands that StoreyBook runs. The user sees your changes as a preview and accepts or undoes them.
Reply with one JSON object: {"reply":"one or two sentences for the user","commands":[ ... ]}. No other text.
Units are millimetres. x grows to the right, y grows downwards. Start new buildings at x=0,y=0.
Rooms are drawn with walls on their outline (${P.wall||150} mm thick), so rooms that share a wall should share an edge exactly. Doors go on a room edge, centred on the edge line.
Items are placed by their centre. rotation is degrees clockwise; 0 means the item's width runs along x and its front faces +y (down). A door at rotation 0 sits in a horizontal wall; use 90 for a vertical wall.
Walls, doors, windows, rooms and columns on typical floors are shared by every typical floor. Furniture, text and room names belong to each floor. Lifts, stairs and shafts (Core) run through every floor.
Leave at least 1200 mm walkways between desk rows, and keep furniture inside rooms and clear of doors.
Entrance doors in outside walls belong on the ground floor only: make the ground floor unique first ({"do":"floor","floor":"L1","unique":true}, then go_floor L1) and add them there, or they repeat on every floor.
After your commands run, StoreyBook checks the plan (overlapping rooms, furniture outside rooms or clashing, doors off walls) and may send you the problems to fix.
Commands (field "do" names the command; anything in [ ] is optional):
- {"do":"plan","name":"..","north":deg}
- {"do":"building","ceiling":2800,"void":900,"slab":250,"parapet":1000}  defaults for every floor, mm
- {"do":"add_floor","count":n,["kind":"basement"]}  floors go on top, basements below; new floors use the typical layout
- {"do":"go_floor","floor":"L2"}  later commands work on this floor
- {"do":"floor","floor":"L1",["floor_to_floor":4500],["unique":true]}  unique = own walls and rooms
- {"do":"copy_fitout","from":"L2","to":["L3","L4"]}
- {"do":"room","name":"Meeting 1","x":0,"y":0,"w":6000,"h":4000,["zone":"white|green|red|black"],["walls":false]}  or "pts":[[x,y],...] instead of x,y,w,h
- {"do":"wall","pts":[[x,y],[x,y],...],["closed":true],["thickness":200]}
- {"do":"place","code":"WS1470","x":..,"y":..,["rotation":0],["label":".."]}
- {"do":"array","code":"WS1470","x":..,"y":..,"rows":r,"cols":c,["dx":pitch along x],["dy":pitch along y],["rotation":0]}  x,y is the first item's centre
- {"do":"door","x":..,"y":..,["rotation":0|90],["width":900|1000|1800],["exit":true]}
- {"do":"windows",["width":1500],["gap":600],["sill":900],["height":1500],["full_height":false],["within":[x0,y0,x1,y1]]}  fills every outside wall of the open floor, or only walls inside the box
- {"do":"grid","bays_x":"8400 x 4","bays_y":"8400 x 2",["x":0],["y":0],["column_size":600]}  structural grid with columns
- {"do":"road","pts":[[x,y],...],["width":6000]}  {"do":"fence","pts":[[x,y],...]}
- {"do":"text","x":..,"y":..,"text":"..",["size":300]}   {"do":"pin","x":..,"y":..,"text":"review comment"}
- {"do":"zone","room":"name or id","zone":"white|green|red|black|none"}
- {"do":"cost","type":"aa|new","rate":3200,["gfa":"internal|external"]}
- {"do":"move","ids":[..],"dx":..,"dy":..}   {"do":"rotate","id":"..","rotation":90}
- {"do":"set","id":"..",["name":".."],["w":..],["d":..],["label":".."]}
- {"do":"delete","ids":[..]}   {"do":"delete_room","room":"name or id"}   {"do":"clear_floor"}  removes everything on the open floor
- set also takes: "thickness" and "h" (walls), "sill", "leg" (L-desk return), "seats", "rate", "exit":true|false (doors, stairs), "text" and "size" (text), "entitlement":"rank code" and "raised_floor":mm (rooms)
- wall also takes "curved":true (smooth curve through 3+ points) and "height":mm
- {"do":"align","ids":[..],"how":"left|right|centre|top|bottom|middle|space_across|space_down"}
- {"do":"group","ids":[..]}   {"do":"ungroup","ids":[..]}   {"do":"duplicate","ids":[..],"dx":..,"dy":..,["count":n]}
- {"do":"edit_array","id":"any member","rows":r,"cols":c,["gap_x":mm],["gap_y":mm]}  arrays of one unrotated item are editable
- {"do":"paint","ids":[..] or "room":"name","color":"#rrggbb",["part":"floor|walls"]}   {"do":"reset_colour","ids":[..]}
- {"do":"trunk","pts":[[x,y],...],["width":150],["height":100]}  cable trunking
- {"do":"dimension","a":[x,y],"b":[x,y]}   {"do":"section","a":[x,y],"b":[x,y]}  or {"do":"section","on":false}
- {"do":"notes","text":".."}   {"do":"pin_resolve","no":n,["done":true]}   {"do":"lock",["on":true]}  locks rooms and walls
- {"do":"go_floor","floor":"roof"} works on the roof: place roof plant, rooms become roof structures
- {"do":"snapshot","name":".."}   {"do":"issue_revision","description":".."}
- {"do":"library_add","code":"XX1200","name":"..","category":"..","w":..,"d":..,["h":750],["seats":0],["clear_front":0]}  then place it by its code
- {"do":"view","mode":"2d|3d|building"}   {"do":"layer","name":"furniture|rooms|clearances|dimensions|text|grid|mig|security|pins","on":true|false}
- {"do":"sun","on":true,["month":1-12],["day":21],["hour":0-24],["latitude":1.35]}
- {"do":"export","what":"png|dxf|ifc|schedule|review"}   {"do":"save"}
- {"do":"check","what":"mig|exits|clashes|schedule|cost|items|brief",["room":"name"]}  StoreyBook sends you the result so you can act on it. Use items to list ids when the plan summary does not show them all.
Library items (code|name|category|width x depth). Use only these codes:
${aiCatalogue()}`}
/* ---- the command layer: every command a user could do by hand ---- */
function aiRun(cmds){const log=[],err=[],info=[];const IDS=c=>[].concat(c.ids||c.id||[]).map(byId).filter(Boolean);const withSel=(objs,fn)=>{const keep=sel;sel=new Set(objs.map(o=>o.id));try{fn()}finally{sel=new Set()}};const put=o=>{S.objs.push(o);return o};
  const ITEM=(l,x,y,r)=>{const objs=placeObjs(l,Math.round(x),Math.round(y),((aiNum(r,0)%360)+360)%360);objs.forEach(put);return objs};
  (Array.isArray(cmds)?cmds:[]).slice(0,600).forEach((c,i)=>{if(!c||typeof c!=='object')return;const d=String(c.do||c.cmd||c.command||'').toLowerCase();const at=`#${i+1} ${d}`;
    try{switch(d){
      case 'plan':if(c.name)S.name=String(c.name).slice(0,80),$('#pname').value=S.name;if(c.north!=null)setNorth(c.north,{quiet:true});log.push('plan');break;
      case 'building':ensureBld(S);['ceiling','void','slab','slabB1','parapet','roofSlab'].forEach(k=>{if(c[k]!=null&&aiNum(c[k],-1)>=0)S.bld[k]=Math.min(30000,aiNum(c[k]))});log.push('building heights');break;
      case 'add_floor':{ensureBld(S);syncFloorOut(S);const n=Math.max(1,Math.min(60,aiNum(c.count,1)|0)),B=/^b/i.test(c.kind||'');for(let k=0;k<n;k++){const lv={id:uid(),kind:B?'B':'L',unique:false,fit:[],names:{}};if(B)S.bld.levels.unshift(lv);else S.bld.levels.push(lv)}log.push(`${n} ${B?'basement':'floor'}${n>1?'s':''} added`);break}
      case 'go_floor':{if(/^roof$/i.test(c.floor||'')){switchFloor('roof');log.push('on the roof');break}if(roofMode)switchFloor(S.bld.active);const l=aiLevelByName(c.floor);if(!l)throw new Error('no floor '+c.floor);switchFloor(l.id,true);log.push('on '+c.floor);break}
      case 'floor':{const l=aiLevelByName(c.floor);if(!l)throw new Error('no floor '+c.floor);syncFloorOut(S);const b=S.bld,idx=b.levels.indexOf(l);
        if(c.floor_to_floor!=null){const n=aiNum(c.floor_to_floor,0),v=lvVal(b,l,'void'),sl=slabAbove(b,idx);l.ceiling=Math.max(1000,Math.min(30000,Math.round(n-v-sl)))}
        if(c.unique===true&&!l.unique){const base=clone(b.typical||[]);l.unique=true;l.base=base;l.names={}}if(l.id===b.active)syncFloorIn(S);log.push('floor '+c.floor);break}
      case 'copy_fitout':{syncFloorOut(S);const f=aiLevelByName(c.from);if(!f)throw new Error('no floor '+c.from);(Array.isArray(c.to)?c.to:[c.to]).forEach(t=>{const d2=aiLevelByName(t);if(!d2||d2===f)return;const gm={};d2.fit=clone(f.fit||[]).map(o=>{o.id=uid();if(o.gid){gm[o.gid]=gm[o.gid]||uid();o.gid=gm[o.gid]}return o});d2.names=Object.assign({},f.names||{})});syncFloorIn(S);log.push('fit-out copied');break}
      case 'room':{let pts=aiPts(c.pts);if(pts.length<3){const x=aiNum(c.x,NaN),y=aiNum(c.y,NaN),w=aiNum(c.w??c.width,NaN),h=aiNum(c.h??c.height??c.d,NaN);if(![x,y,w,h].every(isFinite)||w<300||h<300)throw new Error('room needs x, y, w, h (mm) or pts');if(w>1e6||h>1e6)throw new Error('room is over 1 km across: sizes are in mm');pts=rectP(Math.round(x),Math.round(y),Math.round(x+w),Math.round(y+h))}
        const o=put({id:uid(),t:'room',name:String(c.name||'Room').slice(0,60),pts,gid:null});if(c.walls===false)o.nowall=true;if(c.zone&&ZONE_BY[c.zone])o.zone=c.zone;log.push('room '+o.name);break}
      case 'wall':{const pts=aiPts(c.pts);if(pts.length<2)throw new Error('wall needs 2+ points');const w=put({id:uid(),t:'wall',pts,closed:!!(c.closed&&pts.length>=3),th:Math.max(50,aiNum(c.thickness,newWallTh())),gid:null});if(c.curved&&pts.length>=3)w.curve=true;if(c.height!=null&&aiNum(c.height,0)>0)w.h=aiNum(c.height);log.push('wall');break}
      case 'road':case 'fence':{const pts=aiPts(c.pts);if(pts.length<2)throw new Error(d+' needs 2+ points');put({id:uid(),t:'wall',site:d,pts,closed:false,th:d==='road'?Math.max(2000,aiNum(c.width,+P.roadW||6000)):150,h:d==='fence'?aiNum(c.height,+P.fenceH||2400):undefined,gid:null});log.push(d);break}
      case 'place':{const l=aiLib(c.code);if(!l)throw new Error('unknown code '+c.code);const o=ITEM(l,aiNum(c.x,0),aiNum(c.y,0),c.rotation);if(c.label&&o[0])o[0].label=String(c.label).slice(0,60);log.push(l.code);break}
      case 'array':{const l=aiLib(c.code);if(!l)throw new Error('unknown code '+c.code);const R=Math.max(1,Math.min(40,aiNum(c.rows,1)|0)),C=Math.max(1,Math.min(40,aiNum(c.cols,1)|0));const rot=aiNum(c.rotation,0),turned=Math.abs(rot%180)===90;
        const dx=aiNum(c.dx,(turned?l.d:l.w)+(l.cat==='Workstation'?0:600)),dy=aiNum(c.dy,(turned?l.w:l.d)+(l.cf||0)+(l.cat==='Workstation'?WS_ROW_GAP:600));
        /* a plain, unrotated single item becomes a real editable array, the same as one made by hand */
        if(l.shape!=='set'&&!(rot%360)&&R*C>1&&dx>=l.w&&dy>=l.d){const t=placeObjs(l,Math.round(aiNum(c.x,0)),Math.round(aiNum(c.y,0)),0);if(t.length===1){buildArray(t[0],{rows:R,cols:C,gx:dx-l.w,gy:dy-l.d,w:l.w,d:l.d,ox:t[0].x,oy:t[0].y}).forEach(put);log.push(`${R*C}× ${l.code} (editable array)`);break}}
        for(let r=0;r<R;r++)for(let k=0;k<C;k++)ITEM(l,aiNum(c.x,0)+k*dx,aiNum(c.y,0)+r*dy,rot);log.push(`${R*C}× ${l.code}`);break}
      case 'door':{const w=aiNum(c.width,900),l=aiLib(w>=1600?'DR1800':w>=1000?'DR1000':'DR900');const o=ITEM(l,aiNum(c.x,0),aiNum(c.y,0),c.rotation)[0];if(c.exit)o.exit=true;log.push('door');break}
      case 'windows':{const W=Object.assign(winSpec(),{type:c.full_height?'full':'win'});['width','gap','sill','height'].forEach(k=>{if(c[k]!=null){const v=aiNum(c[k],NaN);if(isFinite(v))W[k==='width'?'w':k==='height'?'h':k]=v}});W.w=Math.max(300,W.w);
        /* within: only the walls of rooms inside this box, so windows already on the rest of the floor are left alone */const only=Array.isArray(c.within)&&c.within.length>=4?S.objs.filter(o=>(o.t==='room'||o.t==='wall')&&o.pts&&o.pts.every(p=>p[0]>=c.within[0]&&p[0]<=c.within[2]&&p[1]>=c.within[1]&&p[1]<=c.within[3])):null;let runs=wallRuns(only,'fill');const pl=floorPlate();runs=runs.filter(r=>runIsOutside(r,pl));const{added,removed}=fillWindows(runs,W);S.objs=S.objs.filter(o=>!removed.has(o.id)).concat(added);log.push(`${added.length} windows`);break}
      case 'grid':{ensureBld(S);const G=Object.assign(gridDefaults(),{xs:String(c.bays_x||'7200 x 4'),ys:String(c.bays_y||'7200 x 3')});if(c.x!=null)G.ox=aiNum(c.x,G.ox);if(c.y!=null)G.oy=aiNum(c.y,G.oy);if(c.column_size)G.size=Math.max(150,aiNum(c.column_size,600));applyGrid(G);log.push('grid');break}
      case 'text':put({id:uid(),t:'text',x:Math.round(aiNum(c.x,0)),y:Math.round(aiNum(c.y,0)),text:String(c.text||'Label').slice(0,120),size:Math.max(100,aiNum(c.size,300)),gid:null});log.push('text');break;
      case 'pin':{const p=newPin(Math.round(aiNum(c.x,0)),Math.round(aiNum(c.y,0)));p.text=String(c.text||'');p.by=(P.me?P.me+' · ':'')+'AI';S.pins=S.pins||[];S.pins.push(p);log.push('pin');break}
      case 'zone':{const r=aiRoomBy(c.room);if(!r)throw new Error('no room '+c.room);if(c.zone&&ZONE_BY[c.zone])r.zone=c.zone;else delete r.zone;if(c.zone&&ZONE_BY[c.zone]){P.layers.secz=true;savePrefs()}log.push('zone '+r.name);break}
      case 'cost':{const cc=costCfg();if(c.type)cc.type=/^n/i.test(c.type)?'nb':'aa';if(c.rate!=null)cc.rate[cc.type]=Math.max(0,aiNum(c.rate,0));if(c.gfa)cc.basis=/^i/i.test(c.gfa)?'int':'ext';S.cost=cc;log.push('cost');break}
      case 'move':{const ids=new Set([].concat(c.ids||c.id||[]));const dx=Math.round(aiNum(c.dx,0)),dy=Math.round(aiNum(c.dy,0));let n=0;S.objs.forEach(o=>{if(!ids.has(o.id))return;n++;if(o.pts)o.pts=o.pts.map(p=>[p[0]+dx,p[1]+dy]);if(o.x!=null){o.x+=dx;o.y+=dy}if(Array.isArray(o.a)&&Array.isArray(o.b)){o.a=[o.a[0]+dx,o.a[1]+dy];o.b=[o.b[0]+dx,o.b[1]+dy]}});if(!n)throw new Error('nothing to move');log.push(`moved ${n}`);break}
      case 'rotate':{const o=byId(c.id);if(!o||o.x==null)throw new Error('no item '+c.id);o.r=((aiNum(c.rotation,0)%360)+360)%360;log.push('rotated');break}
      case 'set':{const o=byId(c.id);if(!o)throw new Error('no object '+c.id);if(c.name!=null)o.name=String(c.name).slice(0,60);if(c.label!=null)o.label=String(c.label).slice(0,60);['w','d','h'].forEach(k=>{if(c[k]!=null&&aiNum(c[k],0)>0)o[k]=aiNum(c[k])});if(c.thickness!=null&&o.t==='wall')o.th=Math.max(50,aiNum(c.thickness,o.th));if(c.sill!=null)o.sill=Math.max(0,aiNum(c.sill,0));if(c.leg!=null)o.a=Math.max(0,aiNum(c.leg,0));if(c.seats!=null)o.seats=Math.max(0,aiNum(c.seats,0)|0);if(c.rate!=null)o.rate=aiNum(c.rate,0);if(c.exit!=null)o.exit=!!c.exit;if(c.text!=null&&o.t==='text')o.text=String(c.text).slice(0,120);if(c.size!=null&&o.t==='text')o.size=Math.max(100,aiNum(c.size,300));if(c.entitlement!=null&&o.t==='room')o.ent=String(c.entitlement).toUpperCase().replace(/\s+/g,'')||undefined;if(c.raised_floor!=null&&o.t==='room')o.raised=Math.max(0,aiNum(c.raised_floor,0));log.push('edited');break}
      case 'delete':{const ids=new Set([].concat(c.ids||c.id||[]));const n0=S.objs.length;S.objs=S.objs.filter(o=>!ids.has(o.id));log.push(`deleted ${n0-S.objs.length}`);break}
      case 'delete_room':{const r=aiRoomBy(c.room);if(!r)throw new Error('no room '+c.room);S.objs=S.objs.filter(o=>o!==r);log.push('room deleted');break}
      case 'clear_floor':S.objs=[];log.push('floor cleared');break;
      /* ---- editing ---- */
      case 'align':{const o=IDS(c);if(o.length<2)throw new Error('align needs 2+ ids');const how={left:'l',right:'r',centre:'c',center:'c',top:'t',bottom:'b',middle:'m',space_across:'dh',space_down:'dv'}[String(c.how||'').toLowerCase()];if(!how)throw new Error('how must be left, right, centre, top, bottom, middle, space_across or space_down');withSel(o,()=>alignSel(how));log.push('aligned '+o.length);break}
      case 'group':{const o=IDS(c);if(o.length<2)throw new Error('group needs 2+ ids');const g=uid();o.forEach(x=>x.gid=g);log.push('grouped '+o.length);break}
      case 'ungroup':{const o=IDS(c);o.forEach(x=>x.gid=null);log.push('ungrouped');break}
      case 'duplicate':{const o=IDS(c);if(!o.length)throw new Error('nothing to duplicate');const n=Math.max(1,Math.min(50,aiNum(c.count,1)|0)),dx=Math.round(aiNum(c.dx,0)),dy=Math.round(aiNum(c.dy,0));if(!dx&&!dy)throw new Error('duplicate needs dx or dy');
        for(let k=1;k<=n;k++){const gm={};o.forEach(x=>{const y=clone(x);y.id=uid();delete y.arr;if(y.gid){gm[y.gid]=gm[y.gid]||uid();y.gid=gm[y.gid]}if(y.pts)y.pts=y.pts.map(p=>[p[0]+dx*k,p[1]+dy*k]);if(y.x!=null){y.x+=dx*k;y.y+=dy*k}if(y.a&&y.b&&Array.isArray(y.a)){y.a=[y.a[0]+dx*k,y.a[1]+dy*k];y.b=[y.b[0]+dx*k,y.b[1]+dy*k]}S.objs.push(y)})}log.push(`${o.length*n} copies`);break}
      case 'edit_array':{const m=byId(c.id);if(!m||!m.arr)throw new Error('id is not part of an editable array');const ch={};if(c.rows!=null)ch.rows=Math.max(1,Math.min(60,aiNum(c.rows,1)|0));if(c.cols!=null)ch.cols=Math.max(1,Math.min(60,aiNum(c.cols,1)|0));if(c.gap_x!=null)ch.gx=aiNum(c.gap_x,0);if(c.gap_y!=null)ch.gy=aiNum(c.gap_y,0);editArray(m,ch);sel.clear();log.push('array edited');break}
      case 'paint':{const col=String(c.color||'');if(!/^#[0-9a-f]{6}$/i.test(col))throw new Error('color must be #rrggbb');const o=c.room?[aiRoomBy(c.room)].filter(Boolean):IDS(c);if(!o.length)throw new Error('nothing to paint');const wm=/^wall/i.test(c.part||'');o.forEach(x=>{if(x.t==='item')x.col=col;else applyPaint(x,col,wm)});log.push('painted '+o.length);break}
      case 'reset_colour':{IDS(c).forEach(o=>{delete o.col;delete o.floorCol;delete o.wallCol;delete o.faces});log.push('colours reset');break}
      /* ---- more things to draw ---- */
      case 'trunk':{const pts=aiPts(c.pts);if(pts.length<2)throw new Error('trunk needs 2+ points');put({id:uid(),t:'trunk',pts,w:Math.max(25,aiNum(c.width,+P.trunkW||150)),h:Math.max(25,aiNum(c.height,+P.trunkH||100)),drop:aiNum(c.drop,30),gid:null});log.push('trunking');break}
      case 'dimension':{const a=aiPts([c.a])[0],b2=aiPts([c.b])[0];if(!a||!b2)throw new Error('dimension needs a and b as [x,y]');put({id:uid(),t:'dim',a,b:b2,gid:null});log.push('dimension');break}
      case 'section':{if(c.on===false){if(S.section)S.section.on=false;log.push('section off');break}const a=aiPts([c.a])[0],b2=aiPts([c.b])[0];if(!a||!b2)throw new Error('section needs a and b as [x,y]');S.section={a,b:b2,on:true,flip:!!c.flip};log.push('section line');break}
      case 'notes':S.notes=String(c.text||'').slice(0,4000);log.push('notes');break;
      case 'pin_resolve':{const p=(S.pins||[]).find(x=>pinNo(x)===aiNum(c.no,-1));if(!p)throw new Error('no pin '+c.no);p.done=c.done!==false;if(p.done){p.doneAt=new Date().toISOString();p.doneBy=(P.me?P.me+' · ':'')+'AI'}else{delete p.doneAt;delete p.doneBy}log.push('pin '+c.no);break}
      case 'lock':S.locked=c.on!==false;log.push(S.locked?'rooms locked':'rooms unlocked');break;
      /* ---- records ---- */
      case 'snapshot':snapTake(String(c.name||'AI snapshot').slice(0,60),true);log.push('snapshot');break;
      case 'issue_revision':{const no=revIssue(String(c.description||'').slice(0,80));log.push('revision '+no);break}
      case 'library_add':{const code=String(c.code||'').trim().toUpperCase();if(!/^[A-Z0-9-]{2,12}$/.test(code))throw new Error('code must be 2 to 12 letters, digits or dashes');if(aiLib(code))throw new Error('code '+code+' is already in the library');const w=aiNum(c.w,0),d2=aiNum(c.d,0);if(w<50||d2<50)throw new Error('library_add needs w and d in mm');
        LIB.push({code,name:String(c.name||code).slice(0,60),cat:String(c.category||'Equipment').slice(0,24),shape:String(c.shape||'rect'),w,d:d2,h:aiNum(c.h,750),a:0,seats:Math.max(0,aiNum(c.seats,0)|0),cf:Math.max(0,aiNum(c.clear_front,0)),cb:Math.max(0,aiNum(c.clear_back,0)),nests:!!c.nests,rate:c.rate!=null?aiNum(c.rate,0):undefined,pts:null});saveLib();renderLib();log.push('library item '+code+' (stays in the library even if you undo)');break}
      /* ---- views, layers and files: these happen at once and are not part of the preview's Undo ---- */
      case 'view':{const m=String(c.mode||'').toLowerCase();if(m==='2d'){if(WALK.on)walkStop(true);setView('2d')}else if(m==='3d'){if(!is3D)set3D(true)}else if(m==='building')setView('bld');else throw new Error('mode must be 2d, 3d or building');log.push('view '+m);break}
      case 'layer':{const LM={items:'items',furniture:'items',rooms:'rooms',zones:'zones',clearances:'zones',dimensions:'dims',text:'text',grid:'grid',underlay:'under',mig:'mig',security:'secz',pins:'pins',names:'names'},nm=String(c.name||'').toLowerCase(),k=Object.prototype.hasOwnProperty.call(LM,nm)?LM[nm]:Object.values(LM).includes(String(c.name))?String(c.name):'';if(!k)throw new Error('no layer called '+c.name);P.layers[k]=c.on!==false;savePrefs();renderLayers();log.push(`layer ${k} ${c.on!==false?'on':'off'}`);break}
      case 'sun':{if(c.on!=null)SUN.on=!!c.on;if(c.month!=null)SUN.month=Math.max(0,Math.min(11,(aiNum(c.month,1)|0)-1));if(c.day!=null)SUN.day=Math.max(1,Math.min(31,aiNum(c.day,21)|0));if(c.hour!=null)SUN.min=Math.max(0,Math.min(1439,Math.round(aiNum(c.hour,12)*60)));if(c.latitude!=null)SUN.lat=aiNum(c.latitude,1.35);if(!is3D)set3D(true);try{sunBar();applySun()}catch(e){}log.push('sun study');break}
      case 'export':{const id={png:'m-png',dxf:'m-dxf',ifc:'m-ifc',schedule:'sch-csv',review:null}[String(c.what||'').toLowerCase()];if(id===undefined)throw new Error('what must be png, dxf, ifc, schedule or review');if(id==='sch-csv')exportSchedule();else if(id===null)saveText((S.name||'plan').replace(/[\\/:*?"<>|]+/g,'-')+' review.csv','﻿'+toCSV(reviewRows()),'text/csv','.csv','CSV file');else $('#'+id).click();log.push('export '+c.what);break}
      case 'save':savePlan(false);log.push('save');break;
      /* ---- reading the plan: the answer goes back to the model on the next round ---- */
      case 'check':{const w=String(c.what||'').toLowerCase();
        if(w==='mig'){const rs=S.objs.filter(o=>o.t==='room').map(o=>({o,m:migRoom(o)})).filter(x=>x.m);info.push(rs.length?'MIG check, open floor: '+rs.map(x=>`"${x.o.name}" ${x.m.label}: ${x.m.area.toFixed(1)} m² against ${x.m.ent.toFixed(1)} m² entitlement, ${x.m.st==='ok'?'OK':x.m.st==='over'?'OVER by '+x.m.diff.toFixed(1)+' m²':'UNDER by '+(-x.m.diff).toFixed(1)+' m²'}`).join('; '):'MIG check: no room on the open floor is named with a rank or grade, so nothing was checked.')}
        else if(w==='exits'){const r=egressCompute();info.push(r.err?'Exits check: '+r.err:`Exits check, open floor: ${r.exits} exit${r.exits===1?'':'s'}; worst travel distance ${(r.worst/1000).toFixed(1)} m against a ${(r.cfg.travel/1000).toFixed(0)} m limit; ${r.rooms.filter(x=>x.fail).length?'rooms failing: '+r.rooms.filter(x=>x.fail).map(x=>`"${x.name}" ${x.reach?(x.mx/1000).toFixed(1)+' m':'cannot reach an exit'}`).join(', '):'all rooms pass'}.`)}
        else if(w==='clashes'){clashDirty=true;computeClash();const bad=[...clashCache.bad].map(byId).filter(Boolean);info.push(bad.length?`Clashes, open floor: ${bad.length} items: ${bad.slice(0,20).map(o=>`${o.code} id ${o.id} at (${Math.round(o.x)},${Math.round(o.y)})`).join('; ')}`:'Clashes, open floor: none.')}
        else if(w==='schedule'||w==='cost'){const its=S.objs.filter(o=>o.t==='item'&&!isOpening(o)),cnt={};its.forEach(o=>cnt[o.code]=(cnt[o.code]||0)+1);const C=costCalc();info.push(`Schedule, open floor: ${S.objs.filter(o=>o.t==='room').length} rooms, ${its.reduce((a,o)=>a+(+o.seats||0),0)} seats, items ${Object.entries(cnt).map(([k,v])=>k+' x'+v).join(', ')||'none'}. Building: ${C.basis==='int'?'internal':'external'} GFA ${C.gfa.toFixed(0)} m²${C.total!=null?`, ${C.label} at S$${C.rate}/m² = S$${Math.round(C.total).toLocaleString('en-SG')}`:', no rate set'}.`)}
        else if(w==='items'){const r=c.room?aiRoomBy(c.room):null;if(c.room&&!r)throw new Error('no room '+c.room);const its=S.objs.filter(o=>o.t==='item'&&(!r||pointInPoly(o.x,o.y,r.pts)));info.push(`Items${r?' in "'+r.name+'"':' on the open floor'} (${its.length}): ${its.slice(0,150).map(o=>`${o.code} id ${o.id} (${Math.round(o.x)},${Math.round(o.y)}) r${o.r||0}`).join('; ')}${its.length>150?' …':''}`)}
        else if(w==='brief'){const k=briefCheck();info.push(S.brief?`Brief check: ${k.met} of ${k.n} met.${k.fails.length?' '+k.fails.join(' '):''}`:'There is no brief on this plan.')}
        else throw new Error('what must be mig, exits, clashes, schedule, cost, items or brief');log.push('check '+w);break}
      default:throw new Error('unknown command')}}catch(e){err.push(`${at}: ${e.message||e}`)}});
  clashDirty=true;syncFloorOut(S);return{log,err,info}}
/* ---- talking to Ollama ---- */
/* model list: Ollama's /api/tags, or Anthropic's /v1/models (falls back to the known Claude models) */
const aiCHead=c=>({'x-api-key':c.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true','content-type':'application/json'});
async function aiModels(){const c=aiCfg();
  if(aiIsC(c)){if(!c.key)throw new Error('Paste your Anthropic API key in Settings');const r=await fetch(c.curl.replace(/\/+$/,'')+'/v1/models?limit=50',{headers:aiCHead(c)});if(r.status===401)throw new Error('Anthropic rejected the API key (401). Check it in Settings.');if(!r.ok)throw new Error('Anthropic said '+r.status);
    const j=await r.json();const ms=(j.data||[]).map(m=>m.id).filter(id=>/^claude/.test(id));return ms.length?ms:CLAUDE_MODELS}
  const r=await fetch(c.url.replace(/\/+$/,'')+'/api/tags');if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();return(j.models||[]).map(m=>m.name)}
const AI_SCHEMA={type:'object',properties:{reply:{type:'string'},commands:{type:'array',items:{type:'object'}}},required:['reply','commands']};
async function aiChat(messages,onTok,schema){const c=aiCfg();if(!aiModel(c))throw new Error('Pick a model first (Settings in this panel)');AI.ctrl=new AbortController();
  const out=await(aiIsC(c)?aiChatClaude(c,messages,onTok,schema):aiChatOllama(c,messages,onTok,schema));await aiHome();return out}
/* the answer belongs to the plan the request was sent from. If another plan is open when it arrives, it waits until the user is back on that plan */
function aiHome(){const t=AI.tab;if(!t||t===curTab)return Promise.resolve();if(!tabs.includes(t))return Promise.reject(new Error(AI_CLOSED));const nm=(t.S&&t.S.name)||'that plan';toast(`The AI has answered. Go back to “${nm}” to see it.`);aiState(`Answer ready. Go back to “${nm}” to see it.`);
  return new Promise((res,rej)=>{AI.wait={tab:t,res,rej};if(AI.ctrl)AI.ctrl.signal.addEventListener('abort',()=>{if(AI.wait&&AI.wait.tab===t)AI.wait=null;rej(new DOMException('Stopped','AbortError'))},{once:true})})}
/* stopped or failed part-way: put the plan back as it was, on the plan the request came from */
function aiRestore(pre){const t=AI.tab||curTab;if(t!==curTab){if(tabs.includes(t)){t.S=pre.S;t.past=pre.past;t.future=pre.future;saveTabData(t,t.S)}return}
  if(cmp&&cmp.snapId==null)cmp=null;AI.pending=null;S=pre.S;curTab.S=S;past=pre.past;future=pre.future;pastBytes=pre.bytes;clashDirty=true;try{syncUnder()}catch(x){}try{aiBar()}catch(x){}$('#pname').value=S.name;renderFloorUI();render();renderInspector();if(is3D)build3D()}
async function aiChatOllama(c,messages,onTok,schema){
  const body={model:c.model,messages,stream:true,format:schema||AI_SCHEMA,options:{num_ctx:c.ctx,temperature:0.2}};if(c.think===false)body.think=false;
  let r=await fetch(c.url.replace(/\/+$/,'')+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AI.ctrl.signal});
  if(r.status===400&&body.think===false){delete body.think;r=await fetch(c.url.replace(/\/+$/,'')+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AI.ctrl.signal})}
  if(!r.ok){let t='';try{t=(await r.json()).error||''}catch(e){}throw new Error(`Ollama said ${r.status}${t?': '+t:''}`)}
  const rd=r.body.getReader(),dec=new TextDecoder();let buf='',out='',n=0;
  for(;;){const{value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let k;while((k=buf.indexOf('\n'))>=0){const line=buf.slice(0,k).trim();buf=buf.slice(k+1);if(!line)continue;let j;try{j=JSON.parse(line)}catch(e){continue}if(j.error)throw new Error(j.error);if(j.message&&j.message.content){out+=j.message.content;n++;onTok&&onTok(n,out)}}}
  return out}
/* Claude: the Messages API straight from the browser; the answer is forced through one tool whose input is the {reply, commands} object, streamed as JSON pieces */
async function aiChatClaude(c,messages,onTok,schema){if(!c.key)throw new Error('Paste your Anthropic API key in Settings');
  const sys=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n\n');const msgs=[];messages.filter(m=>m.role!=='system').forEach(m=>{const last=msgs[msgs.length-1];if(last&&last.role===m.role){last.content+='\n\n'+m.content;if(m.images)last.images=(last.images||[]).concat(m.images)}else msgs.push(Object.assign({role:m.role,content:m.content},m.images?{images:m.images}:{}))});
  /* pictures ride as image blocks ahead of the text */
  msgs.forEach(m=>{if(m.images){m.content=m.images.map(d=>({type:'image',source:{type:'base64',media_type:'image/jpeg',data:d}})).concat([{type:'text',text:m.content}]);delete m.images}});
  while(msgs.length&&msgs[0].role!=='user')msgs.shift();
  const body={model:c.cmodel,max_tokens:16000,system:sys,messages:msgs,stream:true,tools:[{name:'apply_commands',description:schema?'Send the reply for the user and the brief read from the requirements.':'Send the reply for the user and the StoreyBook commands to run.',input_schema:schema||AI_SCHEMA}],tool_choice:{type:'tool',name:'apply_commands'}};
  const r=await fetch(c.curl.replace(/\/+$/,'')+'/v1/messages',{method:'POST',headers:aiCHead(c),body:JSON.stringify(body),signal:AI.ctrl.signal});
  if(!r.ok){let t='';try{const j=await r.json();t=(j.error&&j.error.message)||''}catch(e){}throw new Error(r.status===401?'Anthropic rejected the API key (401). Check it in Settings.':`Anthropic said ${r.status}${t?': '+t:''}`)}
  const rd=r.body.getReader(),dec=new TextDecoder();let buf='',out='',txt='',n=0,stop='';
  for(;;){const{value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let k;while((k=buf.indexOf('\n'))>=0){const line=buf.slice(0,k).trim();buf=buf.slice(k+1);if(!line.startsWith('data:'))continue;let j;try{j=JSON.parse(line.slice(5).trim())}catch(e){continue}
    if(j.type==='error')throw new Error((j.error&&j.error.message)||'Anthropic stream error');
    if(j.type==='content_block_delta'&&j.delta){if(j.delta.type==='input_json_delta'){out+=j.delta.partial_json||'';n++;onTok&&onTok(n,out)}else if(j.delta.type==='text_delta')txt+=j.delta.text||''}
    if(j.type==='message_delta'&&j.delta&&j.delta.stop_reason)stop=j.delta.stop_reason}}
  if(stop==='max_tokens')throw new Error('The answer was too long and got cut off. Ask for less at a time, e.g. one floor per request.');
  return out||txt}
function aiParse(t){let s=String(t||'').trim();
  /* tidy what comes back: a bare list of commands, a single command, or one command object where a list belongs are all usable */
  const fin=j=>{if(Array.isArray(j))j={reply:'',commands:j};if(!j||typeof j!=='object')throw new Error('The model did not return JSON');if(j.do&&j.commands==null)j={reply:'',commands:[j]};if(j.commands&&!Array.isArray(j.commands)&&typeof j.commands==='object')j.commands=[j.commands];if(!Array.isArray(j.commands))j.commands=[];return j};
  const s0=s.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();if(s0[0]==='['){try{const arr=JSON.parse(s0);if(Array.isArray(arr)&&arr.every(x=>x&&typeof x==='object'))return fin(arr)}catch(e){}}
  /* start at the answer object itself, not at a brace in the chat around it */
  const m=s.search(/\{\s*["“](?:reply|commands|brief|outline|rooms|width_m|stacking)["”]/),a=m>=0?m:s.indexOf('{');if(a<0)throw new Error('The model did not return JSON');
  /* and stop where that object closes, so text after it does not matter */
  const end=b=>{let d=0,q=false,es=false;for(let i=0;i<b.length;i++){const c=b[i];if(q){if(es)es=false;else if(c==='\\')es=true;else if(c==='"')q=false}else if(c==='"')q=true;else if(c==='{'||c==='[')d++;else if(c==='}'||c===']'){d--;if(!d)return i}}return -1};
  let perr=null;const tryP=b=>{const e=end(b);if(e<0)return null;try{return JSON.parse(b.slice(0,e+1))}catch(x){perr=x;return null}};
  let j=tryP(s.slice(a));if(!j&&/[“”]/.test(s))j=tryP(s.slice(a).replace(/[“”]/g,'"'));if(j)return fin(j);
  {const e=perr||new Error('cut off');/* cut off or slightly broken: keep everything up to the last complete command */let body=s.slice(a),ok=null;for(let i=0,cut=body.length;i<400&&cut>0;i++){cut=body.lastIndexOf('}',cut-1);if(cut<0)break;const head=body.slice(0,cut+1);for(const tail of [']}','}',']}}','']){try{ok=JSON.parse(head+tail);break}catch(x){}}if(ok)break}if(!ok||typeof ok!=='object')throw new Error('The model’s answer was not valid JSON and could not be repaired ('+String(e.message).slice(0,80)+')');j=ok;j.cut=true}return fin(j)}
/* ---- preview: changes are applied, highlighted against the plan before them, and wait for Accept or Undo ---- */
function aiPre(){if(AI.pending)aiAccept();syncFloorOut(S);const base=aiIssues().keys;return{base,S:clone(S),past:past.slice(),future:future.slice(),bytes:pastBytes,str:snapState(),data:snapData()}}
function aiShow(pre,reply,log,err,prompt,issues,rounds){if(!log.length){aiAddMsg('ai',reply||'No changes.',err);return}
  AI.pending={pre,n:log.length,prompt,issues:issues||[]};sel.clear();renderFloorUI();cmpWith(pre.data,'before AI',null);fit();renderInspector();if(is3D)build3D();
  const chk=issues==null?'':issues.length?`\n\nChecked ${rounds?`and corrected ${rounds} time${rounds>1?'s':''}`:'once'}. ${issues.length} problem${issues.length>1?'s':''} left:\n• ${issues.slice(0,6).join('\n• ')}${issues.length>6?`\n• and ${issues.length-6} more`:''}`:`\n\nChecked${rounds?` and corrected ${rounds} time${rounds>1?'s':''}`:''}: no clashes, nothing outside its room, doors on walls.`;
  aiAddMsg('ai',(reply||'Done.')+chk,err,log);aiBar();/* on a phone the panel covers the plan and the Accept bar, so it steps aside to show the preview */if(matchMedia('(max-width:820px)').matches&&!$('#ai-panel').hidden){aiClose();toast(`AI preview: ${log.length} change${log.length>1?'s':''}. Accept or Undo at the top. Open the assistant to read the reply.`)}}
/* one answer applied as a preview, with the checks reported but no correction rounds */
function aiApply(j,prompt){const pre=aiPre();const res=aiRun(j.commands);if(res.info.length)j.reply=(j.reply||'')+'\n\n'+res.info.join('\n');aiShow(pre,j.reply,res.log,res.err,prompt,res.log.length?aiIssues(pre.base):null,0)}
/* ---- the checks the agent loop feeds back to the model: what StoreyBook can see is wrong with the plan as it now stands, floor by floor ---- */
/* skip: problems the plan already had before the AI touched it, which are not the AI's to fix */
const shoelace=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1]}return a/2};
function aiIssues(skip){syncFloorOut(S);ensureBld(S);const b=S.bld,nm=levelNames(b),out=[],seen=new Set(skip||[]),keep=S.objs,ground=b.levels.find(l=>l.kind!=='B');
  const say=(key,t)=>{if(seen.has(key))return;seen.add(key);out.push(t)};
  try{b.levels.forEach(l=>{const objs=floorObjsOf(S,l.id);if(!objs)return;S.objs=objs;const F=nm[l.id],rooms=objs.filter(o=>o.t==='room'),items=objs.filter(o=>o.t==='item');
    /* rooms on top of each other */
    /* measured on the real outlines, not their boxes: a corridor that turns, or an L-shaped room, wraps round its neighbours without lying on them */
    for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){const A=bboxPts(rooms[i].pts),B=bboxPts(rooms[j].pts),x0=Math.max(A.x0,B.x0),y0=Math.max(A.y0,B.y0),w=Math.min(A.x1,B.x1)-x0,h=Math.min(A.y1,B.y1)-y0;if(w>300&&h>300){
      const N=24,pa=rooms[i].pts,pb=rooms[j].pts;let hit=0,mx0=1e99,my0=1e99,mx1=-1e99,my1=-1e99;for(let a=0;a<N;a++)for(let c=0;c<N;c++){const x=x0+(a+.5)*w/N,y=y0+(c+.5)*h/N;if(pointInPoly(x,y,pa)&&pointInPoly(x,y,pb)){hit++;if(x<mx0)mx0=x;if(x>mx1)mx1=x;if(y<my0)my0=y;if(y>my1)my1=y}}
      const area=hit/(N*N)*w*h,sm=Math.min(Math.abs(shoelace(pa)),Math.abs(shoelace(pb)));if(hit&&area>90000&&area>sm*0.05)say('ov'+rooms[i].id+rooms[j].id,`${F}: rooms "${rooms[i].name}" (id ${rooms[i].id}) and "${rooms[j].name}" (id ${rooms[j].id}) overlap by about ${Math.round(mx1-mx0+w/N)} x ${Math.round(my1-my0+h/N)} mm. Rooms may share an edge but must not overlap.`)}}
    /* furniture outside every room */
    if(rooms.length){const outI=items.filter(o=>!isOpening(o)&&!['Site','Column','Ceiling'].includes(o.cat)&&!rooms.some(r=>pointInPoly(o.x,o.y,r.pts)));const fresh=outI.filter(o=>!seen.has('out'+o.id));fresh.forEach(o=>seen.add('out'+o.id));
      if(fresh.length)out.push(`${F}: ${fresh.length} item${fresh.length>1?'s are':' is'} outside every room: ${fresh.slice(0,8).map(o=>`${o.code} id ${o.id} at (${Math.round(o.x)},${Math.round(o.y)})`).join('; ')}${fresh.length>8?` and ${fresh.length-8} more`:''}. Move them inside a room or delete them.`)}
    /* doors: on a wall, and no outside doors above the ground */
    const segs=[];rooms.filter(r=>!r.nowall).forEach(r=>r.pts.forEach((p,i)=>segs.push([p,r.pts[(i+1)%r.pts.length]])));objs.filter(o=>o.t==='wall'&&!o.site).forEach(w=>{for(let i=0;i<w.pts.length-1;i++)segs.push([w.pts[i],w.pts[i+1]]);if(w.closed)segs.push([w.pts[w.pts.length-1],w.pts[0]])});
    const plate=floorPlate(),pseg=[];plate.forEach(p=>p.forEach((q,i)=>pseg.push([q,p[(i+1)%p.length]])));
    items.filter(o=>o.cat==='Door').forEach(o=>{const d=segs.length?Math.min(...segs.map(sg=>segDist(o.x,o.y,sg[0],sg[1]))):1e9;if(d>250)say('dw'+o.id,`${F}: door id ${o.id} at (${Math.round(o.x)},${Math.round(o.y)}) is not on a wall (nearest wall is ${Math.round(d)} mm away). Move it onto a room edge.`);
      else if(l.kind!=='B'&&l!==ground&&pseg.length&&Math.min(...pseg.map(sg=>segDist(o.x,o.y,sg[0],sg[1])))<400)say('dx'+o.id,`${F}: door id ${o.id} at (${Math.round(o.x)},${Math.round(o.y)}) is in an outside wall above the ground, so it opens into mid-air.${l.unique?' Delete it.':` It is on the typical layout shared by every floor. Fix: delete it, then make ${nm[ground.id]} unique with {"do":"floor","floor":"${nm[ground.id]}","unique":true}, go to ${nm[ground.id]} and add the entrance door there.`}`)});
    /* furniture clashing with furniture */
    clashDirty=true;computeClash();const bad=[...clashCache.bad].map(id=>objs.find(o=>o.id===id)).filter(o=>o&&!seen.has('cl'+o.id));bad.forEach(o=>seen.add('cl'+o.id));
    if(bad.length)out.push(`${F}: ${bad.length} item${bad.length>1?'s clash':' clashes'} with other furniture: ${bad.slice(0,8).map(o=>`${o.code} id ${o.id} at (${Math.round(o.x)},${Math.round(o.y)})`).join('; ')}${bad.length>8?` and ${bad.length-8} more`:''}. Space them apart or delete the extras.`)})}
  finally{S.objs=keep;clashDirty=true}
  const r=out.slice(0,20);r.keys=[...seen];return r}
const AI_ROUNDS=3;
function aiFixMsg(issues,errs,info){info=info||[];if(!issues.length)return`StoreyBook ran your commands.${errs.length?`\nCommands that failed and were skipped:\n- ${errs.slice(0,10).join('\n- ')}`:''}\nResults of your checks:\n- ${info.join('\n- ')}\n\nThe plan as it now stands:\n${JSON.stringify(aiPlanSummary())}\n\nIf the results call for changes, return the commands. If not, return an empty commands list and put the answer for the user in reply.`;return`StoreyBook ran your commands and checked the result.${info.length?`\nResults of your checks:\n- ${info.join('\n- ')}`:''}${errs.length?`\nCommands that failed and were skipped:\n- ${errs.slice(0,10).join('\n- ')}`:''}\nProblems found:\n- ${issues.join('\n- ')}\n\nThe plan as it now stands:\n${JSON.stringify(aiPlanSummary())}\n\nReturn only the commands that fix these problems (move, delete, set, place, room, door...). Do not rebuild what is already right. Use the ids given.`}
function aiAccept(){const p=AI.pending;if(!p)return;AI.pending=null;past=p.pre.past.concat([p.pre.str]);future=[];pastBytes=p.pre.bytes+p.pre.str.length;markDirty();if(cmp&&cmp.snapId==null)cmpClear();aiBar();autosave();toast('AI changes kept. Undo still takes them back.')}
function aiReject(){const p=AI.pending;if(!p)return;AI.pending=null;if(cmp&&cmp.snapId==null)cmpClear();/* keep what the AI made as the Redo step, so undoing a preview is not a one-way door */let after=null;try{after=snapState()}catch(e){}S=p.pre.S;curTab.S=S;past=p.pre.past;future=after?[after.slice(0,-1)+',"ai":1}']:p.pre.future;pastBytes=p.pre.bytes;sel.clear();clashDirty=true;$('#pname').value=S.name;renderFloorUI();render();renderInspector();if(is3D)build3D();aiBar();toast(after?'AI changes undone. Redo brings them back.':'AI changes undone')}
function aiBar(){try{aiBriefUI()}catch(e){}const b=$('#ai-bar');if(!b)return;const p=AI.pending;b.hidden=!p;if(p)b.innerHTML=`<b>AI preview</b><span>${p.n} change${p.n>1?'s':''} · highlighted against the plan before</span>${p.issues&&p.issues.length?`<span class="ai-warn">${p.issues.length} problem${p.issues.length>1?'s':''} left</span>${aiIsP()?'<button type="button" class="btn sm" data-ai="pfix">Copy fix prompt</button>':''}`:''}<button type="button" class="btn sm primary" data-ai="accept">Accept</button><button type="button" class="btn sm" data-ai="reject">Undo</button>`}
function aiAddMsg(who,text,err,log){AI.log.push({who,text,err:err||[],log:log||[],at:Date.now()});aiRenderLog();/* copy and paste keeps the chat under the three boxes: bring a new reply into view */if(who==='ai'&&aiIsP()){const el=$('#ai-log');if(el&&el.lastElementChild)try{el.lastElementChild.scrollIntoView({block:'nearest'})}catch(e){}}}
function aiRenderLog(){const el=$('#ai-log');if(!el)return;/* copy and paste has its own three numbered boxes, so no intro text there */if(!AI.log.length&&aiIsP()){el.innerHTML='';return}if(!AI.log.length){el.innerHTML=`<div class="ai-empty"><b>Describe what to build or change.</b><span>For example: “A 4-storey office block 30 m by 18 m on a 8.4 m grid, with a lift and stair core, open-plan desks for 60 on each floor, two meeting rooms and a pantry. Make L1 a lobby.”</span><span class="muted">${aiIsP()?'Copy and paste mode: works with any AI chat you can paste into.':aiIsC()?'Using Claude through the Anthropic API: your request and this plan are sent over the internet.':'The model runs on your own machine through Ollama.'} Its changes show as a preview you accept or undo.</span></div>`;return}
  el.innerHTML=AI.log.map(m=>`<div class="ai-m ${m.who}">${m.who==='me'?'':'<span class="ai-who">AI</span>'}<div>${esc(m.text)}</div>${m.log.length?`<div class="muted ai-sub">${esc(m.log.slice(0,12).join(' · '))}${m.log.length>12?` · and ${m.log.length-12} more`:''}</div>`:''}${m.err.length?`<div class="ai-err">${m.err.slice(0,6).map(esc).join('<br>')}${m.err.length>6?`<br>and ${m.err.length-6} more skipped`:''}</div>`:''}</div>`).join('');el.scrollTop=el.scrollHeight}
async function aiSend(over,shown){if(AI.busy)return;const ta=$('#ai-in'),typed=typeof over==='string'?'':ta.value.trim(),q=typeof over==='string'?over:typed;if(typeof over!=='string')AI.briefOn=false;
  const docs=AI.files.some(f=>f.kind==='doc'&&f.text),briefFirst=typeof over!=='string'&&docs&&$('#ai-briefchk').checked;if(!q&&!briefFirst){if(AI.files.length)toast('Say what to do with the attached file');return}
  if(!aiIsP()&&!aiModel(aiCfg())){await aiTest();if(!aiModel(aiCfg())){aiAddMsg('ai',$('#ai-conn').textContent);return}}
  if(briefFirst){ta.value='';return aiBriefExtract(q)}
  const att=aiAttachText(aiTextLimit()),imgs=aiAttachImgs(),extra=att+(imgs.length||AI.files.some(f=>f.kind==='drawing')?AI_DRAW_NOTE:''),fnames=AI.files.map(f=>f.name);
  /* a drawing is traced, not described: the model locates rooms on the picture and StoreyBook does the geometry */
  {const dr=AI.files.find(f=>f.kind==='drawing'&&(f.images||[]).length);if(dr&&!aiIsP()&&typeof over!=='string')return aiTrace(q,imgs,fnames,dr.images[0])}
  if(aiIsP()){aiPasteStart(q,extra,shown);return}ta.value='';aiAddMsg('me',(shown||q)+(fnames.length?'\n📎 '+fnames.join(', '):''));AI.busy=true;AI.tab=curTab;aiState('Thinking…');
  const hist=AI.log.slice(-7,-1).filter(m=>m.text).map(m=>({role:m.who==='me'?'user':'assistant',content:m.who==='me'?m.text.slice(0,1500):JSON.stringify({reply:m.text.slice(0,1500),commands:[]})}));
  const msgs=[{role:'system',content:aiSystem()},...hist,Object.assign({role:'user',content:`Current plan:\n${JSON.stringify(aiPlanSummary())}\n\nRequest: ${q}${extra}`},imgs.length?{images:imgs}:{})];AI.files=[];aiFilesUI();
  const t0=performance.now();const secs=()=>((performance.now()-t0)/1000).toFixed(0);let pre=null;try{const out=await aiChat(msgs,(n)=>aiState(`Writing… ${n} tokens · ${secs()} s`));let j=aiParse(out);pre=aiPre();let res=aiRun(j.commands);const log=res.log.slice(),err=res.err.slice();let issues=log.length?aiAllIssues(pre):null,rounds=0;let reply=j.reply,info=res.info||[];
    /* the agent loop: check the result, hand the problems back, apply the fixes, check again */
    while(issues&&(issues.length||info.length)&&rounds<AI_ROUNDS&&aiCfg().loop!==false){rounds++;const n0=issues.length,asked=!n0;aiState(n0?`Check ${rounds} of ${AI_ROUNDS}: ${n0} problem${n0>1?'s':''} found, asking for fixes… ${secs()} s`:`Round ${rounds}: sending the check results back… ${secs()} s`);
      msgs.push({role:'assistant',content:JSON.stringify(j)},{role:'user',content:aiFixMsg(issues,res.err,info)});
      try{const o2=await aiChat(msgs,(n)=>aiState(`Check ${rounds} of ${AI_ROUNDS}: fixing ${n0} problem${n0>1?'s':''}… ${n} tokens · ${secs()} s`));j=aiParse(o2)}catch(e){if(e.name==='AbortError')break;err.push('Fix round stopped: '+aiErrText(e));break}
      if(asked&&j.reply)reply=j.reply;info=[];if(!j.commands.length)break;res=aiRun(j.commands);log.push(...res.log);err.length=0;err.push(...res.err);info=res.info||[];issues=aiAllIssues(pre)}
    if(info.length)reply=(reply||'')+'\n\n'+info.join('\n');
    /* stopped while another plan was open: the preview still shows on its own plan */await aiHome();aiShow(pre,reply,log,err,q,issues,rounds);pre=null;aiState(`Done in ${secs()} s${rounds?` · ${rounds} correction round${rounds>1?'s':''}`:''}`)}
  catch(e){/* stopped or failed part-way: put the plan back as it was */if(pre)aiRestore(pre);if(e.name==='AbortError')aiAddMsg('ai','Stopped.');else aiAddMsg('ai',aiErrText(e));aiState('')}finally{AI.busy=false;AI.ctrl=null;AI.tab=null;AI.wait=null;$('#ai-send').hidden=false;$('#ai-stop').hidden=true}}
function aiErrText(e){const m=String(e&&e.message||e);if(/Failed to fetch|NetworkError|Load failed/i.test(m)&&aiIsC())return'Could not reach Anthropic. Check this computer is online and nothing blocks api.anthropic.com.';if(/Failed to fetch|NetworkError|Load failed/i.test(m))return`Could not reach Ollama at ${aiCfg().url}. Check that Ollama is running, and that it allows this page: set OLLAMA_ORIGINS=* (or this page's address) and restart Ollama. See Settings in this panel.`;return m}
/* ---- copy and paste: works with any AI chat. StoreyBook writes the whole prompt, the user pastes it into their AI and pastes the answer back ---- */
function aiPastePrompt(q){return aiSystem()+`\n\nCurrent plan:\n${JSON.stringify(aiPlanSummary())}\n\nRequest: ${q}\n\nAnswer with the JSON object only, in one code block.`}
async function aiCopy(t){try{await navigator.clipboard.writeText(t);return true}catch(e){const ta=$('#ai-pp');try{ta.focus();ta.select();return document.execCommand('copy')}catch(x){return false}}}
async function aiPasteStart(q,extra,shown){/* the request stays in box 1 so it can be reworded and copied again */aiAddMsg('me',shown||q);AI.pasteQ=q;const t=aiPastePrompt(q+(extra||''));if(extra){AI.files=AI.files.filter(f=>(f.images||[]).length&&0);aiFilesUI()}$('.ai-set').open=false;$('#ai-pp').value=t;$('#ai-pr').value='';$('#ai-paste').hidden=false;$('#ai-perr').textContent='';
  const ok=await aiCopy(t);$('#ai-pstat').textContent=ok?`Prompt copied (${Math.round(t.length/1000)}k characters). Paste it into your AI, then paste its answer below.`:'Copy was blocked here. Select the prompt below and copy it yourself, then paste the AI’s answer underneath.';if(!matchMedia('(pointer:coarse)').matches)$('#ai-pr').focus()}
function aiPasteApply(){const t=$('#ai-pr').value.trim(),er=$('#ai-perr');er.textContent='';if(!t){er.textContent='Paste the AI’s answer first.';return}let j;try{j=aiParse(t)}catch(e){er.textContent='That does not look like the JSON answer. Copy the AI’s whole reply, including the { } block, and paste it again.';return}
  if(j.brief&&Array.isArray(j.brief.rooms)&&j.brief.rooms.length){aiSetBrief(j.brief,AI.pasteSrc||[]);AI.pasteSrc=null;AI.files=[];aiFilesUI();$('#ai-pr').value='';$('#ai-pp').value='';$('#ai-pstat').textContent='Brief read. Check the table, then press Build from brief.';aiAddMsg('ai',(j.reply||'Brief read.')+`\n\n${S.brief.rooms.length} room types found. Check the brief table, then press Build from brief.`);return}
  if(!j.commands.length&&!j.reply){er.textContent='The answer has no commands in it. Ask the AI to answer with the JSON object only.';return}$('#ai-pr').value='';$('#ai-pp').value='';$('#ai-pstat').textContent='Done. Type the next request in box 1.';
  /* a fix answer goes on top of the preview already showing; a first answer starts a new preview */
  let pre,log=[],rounds=0;if(AI.pasteFix&&AI.pending){pre=AI.pending.pre;log=AI.pending.log||[];rounds=(AI.pending.rounds||0)+1;AI.pending=null}else pre=aiPre();AI.pasteFix=false;
  const res=aiRun(j.commands);if(res.info.length)j.reply=(j.reply||'')+'\n\n'+res.info.join('\n');log=log.concat(res.log);const issues=log.length?aiAllIssues(pre):null;aiShow(pre,j.reply,log,res.err,AI.pasteQ||'',issues,rounds);if(AI.pending){AI.pending.log=log;AI.pending.rounds=rounds;AI.pending.errs=res.err}aiBar()}
async function aiPasteFix(){const p=AI.pending;if(!p||!p.issues.length)return;AI.pasteFix=true;const t=aiSystem()+'\n\n'+`The request was: ${AI.pasteQ||p.prompt||''}\n\n`+aiFixMsg(p.issues,p.errs||[])+'\n\nAnswer with the JSON object only, in one code block.';$('.ai-set').open=false;$('#ai-pp').value=t;$('#ai-pr').value='';$('#ai-perr').textContent='';$('#ai-paste').hidden=false;const ok=await aiCopy(t);$('#ai-pstat').textContent=ok?'Fix prompt copied. Paste it into your AI, then paste its answer below.':'Copy was blocked here. Select the prompt below and copy it yourself.'}
function aiState(t){const s=$('#ai-state');if(s)s.textContent=t;const busy=AI.busy;$('#ai-send').hidden=busy;$('#ai-stop').hidden=!busy;const hb=$('#b-ai');if(hb){hb.classList.toggle('busy',busy);hb.title=busy?'AI assistant: working… '+(t||''):'AI assistant'}}
/* tell "Ollama is not running" from "Ollama is running but refuses this page": a no-cors request gets through whenever something is listening */
async function aiDiag(){const c=aiCfg();if(aiIsC(c)||aiIsP(c))return'';try{await fetch(c.url.replace(/\/+$/,'')+'/api/version',{mode:'no-cors'});return`Ollama is running at ${c.url}, but it is refusing this page. In PowerShell run: setx OLLAMA_ORIGINS "*" then quit Ollama from the system tray (right-click the llama icon, Quit) and start it again. Closing its window is not enough.`}catch(e){return`Nothing is answering at ${c.url}. Ollama is not running, or it is on a different address. Start Ollama (Start menu, Ollama), then press Test connection.`}}
async function aiTest(){const st=$('#ai-conn');/* the old message stays, dimmed, while it checks, so the panel does not jump */st.classList.add('busy');if(!st.textContent)st.textContent='Connecting…';try{const ms=await aiModels();const c=aiCfg(),C=aiIsC(c),k=C?'cmodel':'model',cur=c[k];const sel2=$('#ai-model');sel2.innerHTML=ms.map(m=>`<option${m===cur?' selected':''}>${esc(m)}</option>`).join('');
    if(!cur||!ms.includes(cur)){const pick=C?(ms.find(m=>/sonnet/i.test(m))||ms[0]):(ms.find(m=>/qwen/i.test(m))||ms[0]||'');P.ai=Object.assign(aiCfg(),{[k]:pick});savePrefs();sel2.value=pick}
    P.ai=Object.assign(aiCfg(),C?{okC:true}:{ok:true});savePrefs();st.textContent=ms.length?`Connected · ${ms.length} model${ms.length>1?'s':''}`:'Connected, but no models. Run: ollama pull qwen3'}catch(e){st.textContent=aiErrText(e);if(/Failed to fetch|NetworkError|Load failed/i.test(String(e&&e.message))){const d=await aiDiag();if(d)st.textContent=d}}finally{st.classList.remove('busy')}}
function aiSetUI(){const c=aiCfg(),C=aiIsC(c),Pm=aiIsP(c);aiRenderLog();if(Pm){$('#ai-help').hidden=true;$('#ai-panel [data-ai=help]').setAttribute('aria-expanded','false')}$$('#ai-tabs [data-prov]').forEach(b=>{const on=b.dataset.prov===c.prov;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});$('#ai-loop').checked=c.loop!==false;$('#ai-prov').value=c.prov;$$('#ai-panel .ai-oll').forEach(e=>e.hidden=C||Pm);$$('#ai-panel .ai-cl').forEach(e=>e.hidden=!C);$$('#ai-panel .ai-net').forEach(e=>e.hidden=Pm);$$('#ai-panel .ai-pm').forEach(e=>e.hidden=!Pm);$('#ai-paste').hidden=!Pm;$('#ai-panel .ai-panel').classList.toggle('pm',Pm);if(Pm&&!$('#ai-pp').value)$('#ai-pstat').textContent='Type your request in box 1, then press Copy prompt.';$('#ai-sub').textContent=Pm?'copy and paste · any AI':C?'Claude API · online':'on-prem · Ollama';$('#ai-send').textContent=Pm?'Copy prompt':'Send';if(Pm){$('#ai-conn').textContent='No connection needed';return}
  $('#ai-url').value=c.url;$('#ai-ctx').value=c.ctx;$('#ai-think').checked=!!c.think;$('#ai-loop').checked=c.loop!==false;$('#ai-key').value=c.key||'';const m=aiModel(c);$('#ai-model').innerHTML=m?`<option selected>${esc(m)}</option>`:'';
  if(C?c.okC&&c.key:c.ok)aiTest();else $('#ai-conn').textContent=C&&!c.key?'Paste your API key':'Not connected yet'}
/* closing also gives up the typing focus, so phones bring the bottom bar back */
function aiClose(){const p=$('#ai-panel');if(p.contains(document.activeElement))document.activeElement.blur();p.hidden=true}
function aiOpen(){const p=$('#ai-panel');p.hidden=false;aiRenderLog();aiBriefUI();aiFilesUI();/* only reconnect on open once it has worked here, so a machine without Ollama gets no failed request */aiSetUI();/* no automatic focus on touch screens: it would pop the keyboard up over the panel */if(!matchMedia('(pointer:coarse)').matches)setTimeout(()=>$('#ai-in').focus(),50)}
$('#m-ai')&&$('#m-ai').addEventListener('click',()=>{closePops();aiOpen()});
$('#b-ai')&&$('#b-ai').addEventListener('click',()=>{closePops();if($('#ai-panel').hidden)aiOpen();else aiClose()});
$('#ai-panel')&&$('#ai-panel').addEventListener('click',e=>{const t=e.target.closest('[data-ai]');if(!t)return;const a=t.dataset.ai;
  if(a==='close')aiClose();else if(a==='help'){const h=$('#ai-help');h.hidden=!h.hidden;t.setAttribute('aria-expanded',!h.hidden)}else if(a==='attach')$('#ai-file').click();else if(a==='prog')progOpen();else if(a==='bbuild')aiBriefBuild();else if(a==='btog'){AI.briefOpen=!AI.briefOpen;aiBriefUI()}else if(a==='badd'){if(S.brief){checkpoint();S.brief.rooms.push({name:'Room',qty:1,area:null,seats:null,zone:null,floor:null,notes:''});markDirty();aiBriefUI()}}else if(a==='bclear'){if(S.brief){checkpoint();delete S.brief;markDirty();aiBriefUI()}}else if(a==='pcopy'){aiCopy($('#ai-pp').value).then(ok=>{$('#ai-pstat').textContent=ok?'Prompt copied.':'Copy was blocked here. Select the prompt and copy it yourself.'})}else if(a==='papply')aiPasteApply();else if(a==='pcancel'){$('#ai-pr').value='';$('#ai-perr').textContent=''}else if(a==='send')aiSend();else if(a==='stop'){if(AI.ctrl)AI.ctrl.abort()}else if(a==='test')aiTest();else if(a==='clear'){AI.log=[];aiRenderLog()}});
$('#ai-panel')&&$('#ai-panel').addEventListener('change',e=>{const t=e.target,c=aiCfg();if(t.id==='ai-prov')c.prov=['claude','paste'].includes(t.value)?t.value:'ollama';else if(t.id==='ai-url'){const u=t.value.trim();if(u&&!/^https?:\/\/[^\s<>"]+$/i.test(u)){t.value=c.url;toast('That is not a web address. It should look like http://localhost:11434');return}c.url=u||AI_DEF.url}else if(t.id==='ai-key')c.key=t.value.trim();else if(t.id==='ai-model'){if(aiIsC(c))c.cmodel=t.value;else c.model=t.value}else if(t.id==='ai-ctx')c.ctx=Math.max(4096,aiNum(t.value,16384)|0);else if(t.id==='ai-think')c.think=t.checked;else if(t.id==='ai-loop')c.loop=t.checked;else return;P.ai=c;savePrefs();if(t.id==='ai-prov'){aiSetUI();aiFilesUI();/* nothing more to set up for copy and paste, so Settings folds away and the three boxes show */if(aiIsP(c))$('.ai-set').open=false}else if(t.id==='ai-url'||t.id==='ai-key')aiTest()});
$('#ai-in')&&$('#ai-in').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();aiSend()}});
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('#ai-bar [data-ai]');if(!t)return;if(t.dataset.ai==='accept')aiAccept();else if(t.dataset.ai==='pfix')aiPasteFix();else aiReject()});


/* ---- attachments: drawings (images, drawing PDFs) go to the model as pictures; requirement documents (PDF, Word, text) go as text ---- */
AI.files=[];const AI_MAXIMG=4;
function aiImgScale(src,max){max=max||1600;return new Promise((res,rej)=>{const im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',0.85))};im.onerror=()=>rej(new Error('could not read the image'));im.src=src})}
/* a .docx is a zip: find word/document.xml, inflate it, keep the words */
async function aiDocx(buf){const u=new Uint8Array(buf),dv=new DataView(buf);let e=u.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('that is not a Word .docx file');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const td=new TextDecoder();
  for(let i=0;i<n;i++){if(dv.getUint32(p,true)!==0x02014b50)break;const method=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true),name=td.decode(u.subarray(p+46,p+46+nl));
    if(name==='word/document.xml'){const lnl=dv.getUint16(off+26,true),lxl=dv.getUint16(off+28,true),data=u.subarray(off+30+lnl+lxl,off+30+lnl+lxl+csz);let xml;
      if(method===0)xml=td.decode(data);else{if(typeof DecompressionStream==='undefined')throw new Error('this browser cannot open Word files. Save the document as PDF and attach that.');xml=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()}
      return xml.replace(/<w:tab\/>/g,'\t').replace(/<\/w:p>\s*<\/w:tc>/g,'\t').replace(/<\/w:p>|<w:br\/>|<\/w:tr>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/\n{3,}/g,'\n\n').trim().slice(0,200000)}
    p+=46+nl+xl+cl}
  throw new Error('no text found in the Word file')}
async function aiReadFile(file){const n=file.name||'file',ext=(n.split('.').pop()||'').toLowerCase();
  if(/^image\//.test(file.type)||['png','jpg','jpeg','webp','gif','bmp'].includes(ext)){const url=await new Promise((r,j)=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.onerror=()=>j(new Error('could not read '+n));fr.readAsDataURL(file)});return{name:n,kind:'drawing',text:'',images:[await aiImgScale(url)]}}
  if(ext==='pdf'||file.type==='application/pdf'){await ensurePdf();const doc=await pdfLib().getDocument({data:await file.arrayBuffer()}).promise;let text='';const images=[],np=Math.min(doc.numPages,30);
    for(let i=1;i<=np;i++){const pg=await doc.getPage(i),tc=await pg.getTextContent();let last=null,line='';tc.items.forEach(it=>{const y=it.transform?Math.round(it.transform[5]):0;if(last!==null&&Math.abs(y-last)>2){text+=line.trim()+'\n';line=''}line+=it.str+' ';last=y});text+=line.trim()+'\n\n';
      if(i<=3){const v0=pg.getViewport({scale:1}),vp=pg.getViewport({scale:Math.min(2.5,1600/Math.max(v0.width,v0.height))}),c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:vp}).promise;images.push(c.toDataURL('image/jpeg',0.85))}}
    text=text.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    /* plenty of words per page: a document, sent as text. Few words: a drawing or a scan, sent as pictures of its first pages */
    const wordy=text.replace(/\s/g,'').length>np*250;return{name:n,kind:wordy?'doc':'drawing',text:text.slice(0,200000),images:wordy?[]:images,pages:doc.numPages}}
  if(ext==='docx')return{name:n,kind:'doc',text:await aiDocx(await file.arrayBuffer()),images:[]};
  if(['txt','md','csv','json'].includes(ext)||/^text\//.test(file.type)){const tx=(await file.text()).slice(0,200000);if(!tx.trim())throw new Error(n+' is empty');{const h=tx.slice(0,4000);let bad=0;for(let i=0;i<h.length;i++){const c=h.charCodeAt(i);if(c===0xFFFD||(c<32&&c!==9&&c!==10&&c!==13))bad++}if(bad>h.length*0.02)throw new Error(n+' is not a text file, so it cannot be read')}return{name:n,kind:'doc',text:tx,images:[]}}
  throw new Error(`${n}: not a type I can read. Attach a PDF, a Word .docx, a text file or an image.`)}
async function aiAttach(files){for(const f of [...files]){/* the Excel requirements form is read by StoreyBook itself and goes to the Programme, not to the model */if(/\.xlsx$/i.test(f.name||'')){await progImportFile(f);continue}if(AI.files.length>=6){toast('Six files at most');break}try{aiState('Reading '+(f.name||'file')+'…');AI.files.push(await aiReadFile(f))}catch(e){toast(e.message||String(e))}}aiState('');aiFilesUI()}
function aiFilesUI(){const el=$('#ai-files');if(!el)return;const docs=AI.files.some(f=>f.kind==='doc'&&f.text),pics=AI.files.some(f=>(f.images||[]).length),c=aiCfg();
  el.innerHTML=AI.files.map((f,i)=>`<span class="ai-chip" title="${f.kind==='doc'?`Document: ${f.text.length.toLocaleString()} characters of text`:`Drawing: sent as ${(f.images||[]).length} picture${(f.images||[]).length===1?'':'s'}`}"><i>${f.kind==='doc'?'DOC':'IMG'}</i>${esc(f.name)}<button type="button" data-ai-rm="${i}" aria-label="Remove ${esc(f.name)}">✕</button></span>`).join('');
  $('#ai-briefrow').hidden=!docs;const w=$('#ai-fwarn');w.hidden=!AI.files.length||(!aiIsC(c)&&!aiIsP(c)&&!(pics&&0));
  if(AI.files.length)w.textContent=aiIsP(c)?(pics?'Copy and paste: the document text goes into the prompt. Attach the drawing in your AI chat yourself. Only use an AI you may share these files with.':'The document text goes into the prompt you paste. Only use an AI you may share it with.'):aiIsC(c)?'These files will be sent to Anthropic over the internet. For work documents, use the Ollama tab.':''}
function aiAttachText(limit){const docs=AI.files.filter(f=>f.text);if(!docs.length)return'';let room=limit;return'\n\n'+docs.map(f=>{const t=f.text.slice(0,Math.max(0,room));room-=t.length;return`Attached ${f.kind==='doc'?'document':'text found on the drawing'} "${f.name}"${t.length<f.text.length?' (cut short: too long to send whole)':''}:\n"""\n${t}\n"""`}).join('\n\n')}
function aiAttachImgs(){return AI.files.flatMap(f=>f.images||[]).slice(0,AI_MAXIMG).map(d=>d.split(',')[1])}
const AI_DRAW_NOTE='\n\nA floor plan drawing is attached as a picture. Recreate it in StoreyBook: every room with the name written on it, the doors and the windows, to the dimensions written on the drawing. If it shows no dimensions or scale, take a standard single door as 900 mm wide and size everything from that. Then do what the request says (for a building, add the floors asked for).';
const aiTextLimit=()=>aiIsC()?120000:aiIsP()?60000:Math.max(6000,(aiCfg().ctx-7000)*3);
/* ---- the brief: requirements read from a document, reviewed by the user, built from, and checked against ---- */
const BRIEF_SCHEMA={type:'object',properties:{reply:{type:'string'},brief:{type:'object'}},required:['reply','brief']};
function aiBriefSystem(){return`You read a client's requirements for a building or a floor and turn them into a brief for StoreyBook, a floor plan and building planner.
Reply with one JSON object and no other text:
{"reply":"two sentences: what the document asks for, and anything unclear or missing","brief":{"title":"short name","floors":storeys above ground or null,"rooms":[{"name":"room or space type","qty":how many,"area":area of each in m² or null,"seats":people or desks in each or null,"zone":"white|green|red|black" or null,"floor":"L1" or null,"notes":"adjacency, rank, special needs"}],"notes":"site, structure, cost and other requirements that are not rooms"}}
Rules: one row for each kind of room. Use only what the document says: put null where it is silent and never invent a figure. An open-plan office is one room whose seats is its headcount. Include corridors, toilets, cores and plant rooms only if the document asks for them.`}
function aiBriefNorm(b,src){const n=v=>v==null||v===''||!isFinite(+v)||+v<=0?null:+v;return{title:String(b.title||'Brief').slice(0,80),floors:n(b.floors),notes:String(b.notes||'').slice(0,2000),src:src||b.src||[],at:new Date().toISOString(),
  rooms:(Array.isArray(b.rooms)?b.rooms:[]).slice(0,80).map(r=>({name:String(r&&r.name||'Room').slice(0,60),qty:Math.max(1,Math.round(n(r&&r.qty)||1)),area:n(r&&r.area),seats:n(r&&r.seats)?Math.round(+r.seats):null,zone:r&&ZONE_BY[String(r.zone||'').toLowerCase()]?String(r.zone).toLowerCase():null,floor:r&&r.floor?String(r.floor).toUpperCase().slice(0,6):null,notes:String(r&&r.notes||'').slice(0,200)}))}}
function aiSetBrief(b,src){checkpoint();S.brief=aiBriefNorm(b,Array.isArray(src)?src:null);if(!Array.isArray(S.brief.src))S.brief.src=[];AI.briefOpen=true;markDirty();aiBriefUI()}
/* how the plan measures up to the brief, over every floor */
function briefCheck(){const b=S.brief;if(!b)return{n:0,met:0,rows:[],fails:[]};syncFloorOut(S);ensureBld(S);const nm=levelNames(S.bld),all=[];
  S.bld.levels.forEach(l=>{const objs=floorObjsOf(S,l.id)||[],rooms=objs.filter(o=>o.t==='room'),seated=objs.filter(o=>o.t==='item'&&+o.seats>0);rooms.forEach(r=>all.push({name:r.name||'',area:Math.abs(polyArea(r.pts))/1e6,zone:r.zone||null,floor:nm[l.id],seats:seated.filter(i=>pointInPoly(i.x,i.y,r.pts)).reduce((a,i)=>a+(+i.seats||0),0)}))});
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const rows=b.rooms.map(r=>{const key=norm(r.name).replace(/s$/,''),bareOf=x=>norm(x.name).replace(/\s*\d+$/,'').replace(/s$/,''),loose=all.filter(x=>{const nx=norm(x.name),bare=nx.replace(/\s*\d+$/,'');return(nx.includes(key)||(bare.length>2&&key.includes(bare)))&&(!r.floor||x.floor===r.floor)}),same=loose.filter(x=>norm(x.name)===key),exact=same.length?same:loose.filter(x=>bareOf(x)===key),/* "Manager office 3" belongs to "Manager office", not to "Senior manager office" */m=exact.length?exact:loose,qty=r.qty||1,pr=[];
    if(m.length<qty)pr.push(`${m.length} of ${qty} drawn`);
    if(r.area&&m.length){const small=m.filter(x=>x.area<r.area*0.9),big=m.filter(x=>x.area>r.area*1.25);if(small.length)pr.push(`${small.length} smaller than ${r.area} m² (smallest ${Math.min(...small.map(x=>x.area)).toFixed(1)} m²)`);if(big.length)pr.push(`${big.length} more than 25% over ${r.area} m² (largest ${Math.max(...big.map(x=>x.area)).toFixed(1)} m²)`)}
    if(r.seats&&m.length){const short=m.filter(x=>x.seats<r.seats);if(short.length)pr.push(`${short.length} with fewer than ${r.seats} seats (fewest ${Math.min(...short.map(x=>x.seats))})`)}
    if(r.zone&&m.length){const wz=m.filter(x=>x.zone!==r.zone).length;if(wz)pr.push(`${wz} not marked ${r.zone} zone`)}
    return{ok:!pr.length,text:pr.length?pr.join('; '):'Met',found:m.length}});
  const fl=S.bld.levels.filter(l=>l.kind!=='B').length,flBad=b.floors&&fl!==b.floors;
  const fails=rows.map((x,i)=>x.ok?null:`Brief: "${b.rooms[i].name}" (${b.rooms[i].qty} wanted${b.rooms[i].area?`, ${b.rooms[i].area} m² each`:''}${b.rooms[i].seats?`, ${b.rooms[i].seats} seats each`:''}): ${x.text}.`).filter(Boolean);if(flBad)fails.push(`Brief: ${b.floors} floors above ground wanted; the plan has ${fl}.`);
  return{n:rows.length+(b.floors?1:0),met:rows.filter(x=>x.ok).length+(b.floors&&!flBad?1:0),rows,fails,floors:fl,flBad:!!flBad}}
function aiBriefUI(){const el=$('#ai-brief');if(!el)return;const b=S.brief;el.hidden=!b;if(!b)return;const chk=briefCheck(),all=chk.met===chk.n,open=!!AI.briefOpen;/* folded to one line by default so the chat keeps its room; Show opens the table */
  el.innerHTML=`<div class="ai-bh"><b>Brief</b><span class="muted">${esc(b.title||'')}${b.src&&b.src.length?' · from '+esc(b.src.join(', ')):''}</span><span style="flex:1"></span><span class="ai-bm ${all?'ok':'no'}">${chk.met} of ${chk.n} met</span><button type="button" class="btn sm ghost" data-ai="btog" aria-expanded="${open}">${open?'Hide':'Show'}</button></div>
  ${!open?`<div class="row ai-bf"><span style="flex:1"></span><button type="button" class="btn sm primary" data-ai="bbuild">Build from brief</button></div>`:`<div class="ai-bt"><table><thead><tr><th>Room</th><th>Qty</th><th>m² each</th><th>Seats</th><th>Zone</th><th></th><th></th></tr></thead><tbody>${b.rooms.map((r,i)=>`<tr><td><input type="text" data-bf="name" data-bi="${i}" value="${esc(r.name)}" aria-label="Room name"></td><td><input type="number" min="1" data-bf="qty" data-bi="${i}" value="${r.qty}" aria-label="Quantity"></td><td><input type="number" min="0" data-bf="area" data-bi="${i}" value="${r.area??''}" aria-label="Area each"></td><td><input type="number" min="0" data-bf="seats" data-bi="${i}" value="${r.seats??''}" aria-label="Seats each"></td><td><select data-bf="zone" data-bi="${i}" aria-label="Zone"><option value="">–</option>${ZONES.map(z=>`<option value="${z[0]}"${r.zone===z[0]?' selected':''}>${z[1]}</option>`).join('')}</select></td><td class="ai-bs ${chk.rows[i].ok?'ok':'no'}" title="${esc(chk.rows[i].text)}">${chk.rows[i].ok?'✓':'✗'}</td><td><button type="button" class="btn sm ghost" data-bdel="${i}" aria-label="Remove ${esc(r.name)}">✕</button></td></tr>${chk.rows[i].ok?'':`<tr class="ai-bw"><td colspan="7">${esc(chk.rows[i].text)}</td></tr>`}`).join('')}</tbody></table></div>
  ${b.notes?`<p class="muted ai-bn">${esc(b.notes)}</p>`:''}
  <div class="row ai-bf"><label class="muted">Floors <input type="number" min="1" data-bf="floors" value="${b.floors??''}" style="width:56px" aria-label="Floors above ground"></label>${chk.flBad?`<span class="ai-bs no">plan has ${chk.floors}</span>`:''}<button type="button" class="btn sm" data-ai="badd">Add row</button><span style="flex:1"></span><button type="button" class="btn sm ghost" data-ai="bclear">Clear</button><button type="button" class="btn sm primary" data-ai="bbuild">Build from brief</button></div>`}`}
$('#ai-brief')&&$('#ai-brief').addEventListener('change',e=>{const t=e.target,f=t.dataset.bf,b=S.brief;if(!f||!b)return;checkpoint();const n=v=>v===''||!(+v>0)?null:+v;
  if(f==='floors')b.floors=n(t.value);else{const r=b.rooms[+t.dataset.bi];if(!r)return;if(f==='name')r.name=t.value.trim().slice(0,60)||'Room';else if(f==='qty')r.qty=Math.max(1,Math.round(+t.value||1));else if(f==='zone')r.zone=t.value||null;else r[f]=n(t.value)}markDirty();aiBriefUI()});
$('#ai-brief')&&$('#ai-brief').addEventListener('click',e=>{const d=e.target.closest('[data-bdel]');if(d&&S.brief){checkpoint();S.brief.rooms.splice(+d.dataset.bdel,1);markDirty();aiBriefUI()}});
function aiBriefBuild(){if(S.prog&&progCalc(S.prog).rows)return progBuild();const b=S.brief;if(!b||!b.rooms.length){toast('The brief has no rooms yet');return}AI.briefOn=true;
  aiSend(`Build what this brief asks for${b.floors?`, on ${b.floors} floors`:''}. Name every room exactly as the brief names it, adding a number when there are several (for example "Meeting room 1", "Meeting room 2"). Give each room at least its area, the seats asked for (desks or chairs placed inside it) and its security zone. Rooms share walls on shared edges; add a corridor where rooms need one, doors, and windows on the outside walls.\nBrief:\n${JSON.stringify({floors:b.floors,rooms:b.rooms,notes:b.notes})}`,'Build from brief'+(b.title?': '+b.title:''))}
async function aiBriefExtract(q){const att=aiAttachText(aiTextLimit()),imgs=aiAttachImgs(),names=AI.files.map(f=>f.name);aiAddMsg('me',(q?q+'\n':'')+'Read the requirements: '+names.join(', '));
  if(aiIsP()){const t=aiBriefSystem()+`\n\n${q?'Instruction: '+q:'Read the attached requirements and return the brief.'}${att}\n\nAnswer with the JSON object only, in one code block.`;AI.pasteSrc=names;$('.ai-set').open=false;$('#ai-pp').value=t;$('#ai-pr').value='';$('#ai-perr').textContent='';const ok=await aiCopy(t);$('#ai-pstat').textContent=ok?'Requirements prompt copied. Paste it into your AI, then paste its answer below.':'Copy was blocked here. Select the prompt below and copy it yourself.';return}
  AI.busy=true;AI.tab=curTab;aiState('Reading the requirements…');const t0=performance.now();
  try{const u={role:'user',content:(q?'Instruction: '+q:'Read the attached requirements and return the brief.')+att};if(imgs.length)u.images=imgs;const out=await aiChat([{role:'system',content:aiBriefSystem()},u],n=>aiState(`Reading the requirements… ${n} tokens · ${((performance.now()-t0)/1000).toFixed(0)} s`),BRIEF_SCHEMA);
    const j=aiParse(out);if(!j.brief||!Array.isArray(j.brief.rooms)||!j.brief.rooms.length)throw new Error('The model found no rooms in the document. Check it is a requirements document, or type the rooms into the brief yourself.');
    aiSetBrief(j.brief,names);AI.files=[];aiFilesUI();aiAddMsg('ai',(j.reply||'Brief read.')+`\n\n${S.brief.rooms.length} room types found. Check the brief table, correct anything that is wrong, then press Build from brief.`);aiState(`Done in ${((performance.now()-t0)/1000).toFixed(0)} s`)}
  catch(e){aiAddMsg('ai',e.name==='AbortError'?'Stopped.':aiErrText(e));aiState('')}finally{AI.busy=false;AI.ctrl=null;AI.tab=null;AI.wait=null;$('#ai-send').hidden=false;$('#ai-stop').hidden=true}}
/* problems for the loop: the plan's own checks, plus the brief when building from one */
function aiAllIssues(pre){const a=aiIssues(pre.base);if(AI.briefOn&&S.brief)a.push(...briefCheck().fails.slice(0,14));return a}
$('#ai-file')&&$('#ai-file').addEventListener('change',e=>{aiAttach(e.target.files);e.target.value=''});
{const pn=$('#ai-panel');if(pn){const dragOK=e=>{const ty=[...e.dataTransfer.types];return ty.includes('Files')||ty.includes('text/uri-list')||ty.includes('text/html')};['dragenter','dragover'].forEach(t=>pn.addEventListener(t,e=>{if(dragOK(e)){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy';$('.ai-panel').classList.add('dropping');/* the plan's own drop screen steps aside while the pointer is over the panel */dragDepth=0;$('#drop').hidden=true}}));pn.addEventListener('dragleave',e=>{if(!pn.contains(e.relatedTarget))$('.ai-panel').classList.remove('dropping')});
  pn.addEventListener('drop',async e=>{if(!dragOK(e))return;e.preventDefault();e.stopPropagation();$('.ai-panel').classList.remove('dropping');dragDepth=0;$('#drop').hidden=true;
    if(e.dataTransfer.files.length){aiAttach(e.dataTransfer.files);return}
    /* a picture dragged straight from a web page or another app arrives as a link, not a file: fetch it if the browser lets us */
    const html=e.dataTransfer.getData('text/html')||'',m=html.match(/<img[^>]+src=["']([^"']+)["']/i),url=(m&&m[1])||(e.dataTransfer.getData('text/uri-list')||'').split('\n').find(u=>u&&!u.startsWith('#'))||'';
    if(!url){toast('Nothing to attach in that drop. Drag a file from a folder.');return}
    try{aiState('Fetching the picture…');const r=await fetch(url);if(!r.ok)throw 0;const bl=await r.blob();if(!/^image\/|pdf/.test(bl.type))throw 0;await aiAttach([new File([bl],(url.split('/').pop()||'picture').split('?')[0].slice(0,60)||'picture',{type:bl.type})])}
    catch(x){aiState('');toast('That picture could not be read from where it was dragged. Save it to a folder first, then drag the file in or use Attach.')}});
  pn.addEventListener('click',e=>{const r=e.target.closest('[data-ai-rm]');if(r){AI.files.splice(+r.dataset.aiRm,1);aiFilesUI()}});
  $('#ai-in').addEventListener('paste',e=>{const fs=[...((e.clipboardData&&e.clipboardData.files)||[])];if(fs.length){e.preventDefault();aiAttach(fs)}})}}

/* ---- tracing a drawing: the model only says where things are on the picture (boxes, as thousandths of its width and height, which vision models do well);
   StoreyBook does the geometry: scales to the building's real width, lines shared walls up, puts doors on the nearest wall, and lays the picture under the plan to check against ---- */
const TRACE_SCHEMA={type:'object',properties:{reply:{type:'string'},outline:{type:'array',items:{type:'number'}},width_m:{type:['number','null']},rooms:{type:'array',items:{type:'object'}},doors:{type:'array',items:{type:'array',items:{type:'number'}}}},required:['reply','outline','rooms']};
function aiTraceSystem(){return`You locate the rooms on a floor plan picture. You do not design anything: you report where things are.
Reply with one JSON object and no other text:
{"reply":"one sentence on what the drawing shows","outline":[x0,y0,x1,y1],"width_m":overall building width in metres if the drawing shows a dimension or scale, otherwise null,"rooms":[{"name":"as written on the drawing","box":[x0,y0,x1,y1]}],"doors":[[x,y],...]}
All coordinates are whole numbers from 0 to 1000: x is the fraction of the picture's width from its left edge, y the fraction of its height from its top edge.
outline is the box round the whole building, wall to wall.
rooms: one box for each space enclosed by walls, tight to the inside of its walls. Use the name written in it; if none, name it by what it is (Stairs, Lift, Toilet, Store, Corridor).
A space that is not a rectangle (an L-shaped open area, a corridor that turns) is given as two or three boxes with the same name that touch.
Boxes of different rooms must not overlap. Rooms that share a wall have boxes that meet on that wall. Together the boxes should fill the outline.
doors: the centre of each door opening.
Look at where each room really is on the picture. Do not arrange rooms in a tidy grid unless the drawing is one.`}
function aiTraceBuild(j,img,widthMM){const iw=img.w,ih=img.h,px=v=>Math.max(0,Math.min(1000,+v||0));const o=Array.isArray(j.outline)&&j.outline.length>=4?j.outline.map(px):[0,0,1000,1000];
  const ow=Math.max(1,(o[2]-o[0])/1000*iw),k=widthMM/ow,X=v=>((px(v)-o[0])/1000*iw)*k,Y=v=>((px(v)-o[1])/1000*ih)*k;
  let boxes=(Array.isArray(j.rooms)?j.rooms:[]).map(r=>{const b=Array.isArray(r&&r.box)?r.box:null;if(!b||b.length<4)return null;const x0=Math.min(X(b[0]),X(b[2])),x1=Math.max(X(b[0]),X(b[2])),y0=Math.min(Y(b[1]),Y(b[3])),y1=Math.max(Y(b[1]),Y(b[3]));return x1-x0>400&&y1-y0>400?{name:String(r.name||'Room').slice(0,60),x0,y0,x1,y1}:null}).filter(Boolean).slice(0,80);
  /* line the walls up: edges that are nearly on the same line become one line, so neighbours share a wall exactly */
  const snap=keys=>{const vals=[];boxes.forEach(b=>keys.forEach(kk=>vals.push(b[kk])));vals.sort((a,b)=>a-b);const groups=[];vals.forEach(v=>{const g=groups[groups.length-1];if(g&&v-g[g.length-1]<=Math.max(350,widthMM*0.012))g.push(v);else groups.push([v])});const map=new Map();groups.forEach(g=>{const m=Math.round(g.reduce((a,b)=>a+b,0)/g.length/50)*50;g.forEach(v=>map.set(v,m))});boxes.forEach(b=>keys.forEach(kk=>b[kk]=map.get(b[kk])))};
  snap(['x0','x1']);snap(['y0','y1']);boxes=boxes.filter(b=>b.x1-b.x0>=400&&b.y1-b.y0>=400);
  /* a box that sits mostly inside a bigger one is a named corner of that room (a kitchen in a cafe, a reception in an open area), not a room with walls: it becomes a text label */
  const labels=[],ar=b=>(b.x1-b.x0)*(b.y1-b.y0);boxes.slice().sort((a,b)=>ar(a)-ar(b)).forEach(sm=>{const host=boxes.find(bg=>bg!==sm&&bg.name!==sm.name&&ar(bg)>ar(sm)&&!labels.includes(bg)&&Math.max(0,Math.min(sm.x1,bg.x1)-Math.max(sm.x0,bg.x0))*Math.max(0,Math.min(sm.y1,bg.y1)-Math.max(sm.y0,bg.y0))>ar(sm)*0.6);if(host)labels.push(sm)});boxes=boxes.filter(b=>!labels.includes(b));
  const cmds=boxes.map(b=>({do:'room',name:b.name,x:b.x0,y:b.y0,w:b.x1-b.x0,h:b.y1-b.y0})).concat(labels.map(b=>({do:'text',x:Math.round((b.x0+b.x1)/2),y:Math.round((b.y0+b.y1)/2),text:b.name,size:300})));const doorAt=[];
  /* doors go onto the nearest room edge, turned to lie along it */
  (Array.isArray(j.doors)?j.doors:[]).slice(0,80).forEach(d=>{if(!Array.isArray(d)||d.length<2)return;const x=X(d[0]),y=Y(d[1]);let best=null;boxes.forEach(b=>{[[b.x0,b.y0,b.x1,b.y0,0],[b.x0,b.y1,b.x1,b.y1,0],[b.x0,b.y0,b.x0,b.y1,90],[b.x1,b.y0,b.x1,b.y1,90]].forEach(e=>{const dd=segDist(x,y,[e[0],e[1]],[e[2],e[3]]);if(!best||dd<best.d)best={d:dd,e}})});
    if(!best||best.d>1500)return;const e=best.e,hz=e[4]===0,cx=hz?Math.max(e[0]+600,Math.min(e[2]-600,x)):e[0],cy=hz?e[1]:Math.max(e[1]+600,Math.min(e[3]-600,y));if(hz?e[2]-e[0]<1300:e[3]-e[1]<1300)return;const dx=Math.round(cx/50)*50,dy=Math.round(cy/50)*50;if(doorAt.some(p=>Math.hypot(p[0]-dx,p[1]-dy)<1200))return;doorAt.push([dx,dy]);cmds.push({do:'door',x:dx,y:dy,rotation:e[4]})});
  return{cmds,boxes,labels,k,origin:[o[0]/1000*iw*k,o[1]/1000*ih*k]}}
function aiWidthFrom(q){const t=String(q||'').toLowerCase();let m=t.match(/(\d+(?:\.\d+)?)\s*(m|metres|meters)\s*(?:wide|in width|width|across|long)/)||t.match(/(?:width|wide)\D{0,12}(\d+(?:\.\d+)?)\s*(m|metres|meters)\b/)||t.match(/(\d+(?:\.\d+)?)\s*(?:m|metres|meters)?\s*(?:by|x|×)\s*\d+(?:\.\d+)?\s*(m|metres|meters)\b/);if(m)return +m[1]*1000;m=t.match(/(\d{4,6})\s*mm\s*(?:wide|width|across|long)/);return m?+m[1]:null}
async function aiTrace(q,imgs,fnames,src){const ta=$('#ai-in');ta.value='';aiAddMsg('me',q+'\n📎 '+fnames.join(', '));AI.busy=true;AI.tab=curTab;aiState('Looking at the drawing…');const t0=performance.now(),secs=()=>((performance.now()-t0)/1000).toFixed(0);let pre=null;
  try{const dim=await new Promise((r,jn)=>{const im=new Image();im.onload=()=>r({w:im.width,h:im.height});im.onerror=()=>jn(new Error('could not read the drawing'));im.src=src});
    const out=await aiChat([{role:'system',content:aiTraceSystem()},{role:'user',content:'Locate the rooms and doors on this floor plan.'+(q?`\nThe user says: ${q}`:''),images:[imgs[0]]}],n=>aiState(`Locating rooms on the drawing… ${n} tokens · ${secs()} s`),TRACE_SCHEMA);
    const j=aiParse(out);if(!Array.isArray(j.rooms)||j.rooms.length<1)throw new Error('The model did not find any rooms on the drawing. It may not be able to read pictures: check the model has vision, or use the Claude tab.');
    const said=aiWidthFrom(q),read=+j.width_m>3&&+j.width_m<500?+j.width_m*1000:null,W=said||read||30000,T=aiTraceBuild(j,dim,W);if(!T.cmds.length)throw new Error('The room boxes the model returned could not be used. Try again, or use a clearer picture.');
    pre=aiPre();/* a plan that already has things on this floor keeps them: the traced building goes to their right */let offX=0;{const pts=[];S.objs.forEach(o=>{if(o.pts)pts.push(...o.pts);else if(o.x!=null)pts.push([o.x,o.y])});if(pts.length)offX=Math.ceil((bboxPts(pts).x1+5000)/1000)*1000}T.cmds.forEach(c=>{c.x+=offX});
    const id=uid();underCache[id]=src;S.underlay={uid:id,src,w:dim.w,h:dim.h,name:fnames[0],page:0,sc:0,mpp:T.k,x:offX-T.origin[0],y:-T.origin[1],op:0.45,visible:true,calibrated:true};syncUnder();
    const bx=T.boxes.reduce((a,b)=>[Math.min(a[0],b.x0),Math.min(a[1],b.y0),Math.max(a[2],b.x1),Math.max(a[3],b.y1)],[1e12,1e12,-1e12,-1e12]);let res=aiRun(T.cmds.concat([{do:'windows',within:[bx[0]+offX-100,bx[1]-100,bx[2]+offX+100,bx[3]+100]}]));const log=res.log.slice(),err=res.err.slice();let reply=`${j.reply||'Traced the drawing.'}\n\nTraced ${T.boxes.length} rooms${T.labels.length?` and ${T.labels.length} named area${T.labels.length>1?'s':''} inside them`:''} at ${(W/1000).toFixed(1)} m overall width${said?' (your figure)':read?' (read off the drawing)':' (assumed: tell me the real width, e.g. "the building is 42 m wide", and trace again)'}. The drawing is laid under the plan so you can check the walls against it; hide it in Details › Underlay.${offX?' This floor already had a plan on it, so the traced floor is placed to its right.':''}`;
    /* second pass, words only: furnish the traced rooms and do the rest of the request, with the usual checks */
    let issues=aiAllIssues(pre),rounds=0;
    if(aiCfg().loop!==false){aiState(`Rooms traced. Furnishing… ${secs()} s`);const msgs=[{role:'system',content:aiSystem()},{role:'user',content:`Current plan:\n${JSON.stringify(aiPlanSummary())}\n\nThe rooms and doors above were traced from the user's drawing: do not move, resize, rename or delete them, and do not add rooms. Now furnish each room to suit its name (desks, meeting table and chairs, sofas, pantry counter, stairs and lift in the core), keeping furniture inside its room and clear of doors. Then carry out the rest of the user's request (for example more floors, cost), ignoring the part about recreating the drawing, which is done.\nRequest: ${q}`}];
      let j2=null;for(let tryN=0;tryN<2&&!j2;tryN++){try{j2=aiParse(await aiChat(msgs,n=>aiState(`Furnishing${tryN?' (second try)':''}… ${n} tokens · ${secs()} s`)))}catch(e){if(e.name==='AbortError')throw e;if(tryN)err.push('Furnishing stopped: '+aiErrText(e))}}
      while(j2){res=aiRun(j2.commands);log.push(...res.log);err.length=0;err.push(...res.err);issues=aiAllIssues(pre);if(!issues.length||rounds>=AI_ROUNDS)break;rounds++;aiState(`Check ${rounds} of ${AI_ROUNDS}: ${issues.length} problem${issues.length>1?'s':''} found, asking for fixes… ${secs()} s`);msgs.push({role:'assistant',content:JSON.stringify(j2)},{role:'user',content:aiFixMsg(issues,res.err,res.info)});
        try{j2=aiParse(await aiChat(msgs,n=>aiState(`Check ${rounds} of ${AI_ROUNDS}: fixing… ${n} tokens · ${secs()} s`)));if(!j2.commands.length)break}catch(e){if(e.name==='AbortError')break;err.push('Fix round stopped: '+aiErrText(e));break}}}
    AI.files=[];aiFilesUI();/* stopped while another plan was open: the preview still shows on its own plan */await aiHome();aiShow(pre,reply,log,err,q,issues,rounds);pre=null;try{renderUnderPanel()}catch(e){}fitBox({x0:bx[0]+offX-1500,y0:bx[1]-1500,x1:bx[2]+offX+1500,y1:bx[3]+1500});aiState(`Done in ${secs()} s`)}
  catch(e){if(pre)aiRestore(pre);aiAddMsg('ai',e.name==='AbortError'?'Stopped.':aiErrText(e));aiState('')}
  finally{AI.busy=false;AI.ctrl=null;AI.tab=null;AI.wait=null;$('#ai-send').hidden=false;$('#ai-stop').hidden=true}}

/* ================= command search (press S): type to find any tool, menu item, view, Details tab or library item, then Enter or click to use it ================= */
let cmdkItems=[],cmdkHits=[],cmdkAt=0;
function cmdkBuild(){const out=[],seen=new Set();const lab=e=>(e.getAttribute('aria-label')||e.title||e.textContent||'').replace(/\s*\([^)]*\)\s*$/,'').replace(/\s+/g,' ').trim();
  const keyOf={};Object.entries(KEYMAP.plan).forEach(([k,v])=>{keyOf[v[0].toLowerCase()]=k.length===1?k.toUpperCase():k});
  const add=(name,group,run,key)=>{const id=group+'|'+name.toLowerCase();if(!name||seen.has(id))return;seen.add(id);out.push({name,group,run,key:key||keyOf[name.toLowerCase()]||'',q:(name+' '+group).toLowerCase()})};
  $$('.dock .btn[data-tool]').forEach(b=>add(lab(b),'Tool',()=>b.click()));
  [['v2d','2D view'],['v3d','3D view'],['vbld','Building view'],['b-walk','Walkthrough']].forEach(([id,n])=>{const b=$('#'+id);if(b)add(n,'View',()=>b.click())});
  [['b-undo','Undo'],['b-redo','Redo'],['b-lock','Lock or unlock rooms'],['b-set','Settings'],['b-ai','AI assistant'],['b-floor','Floors'],['t-lib','Library panel'],['t-insp','Details panel'],['t-layers','Layers'],['t-rcp','Ceiling plan']].forEach(([id,n])=>{const b=$('#'+id);if(b)add(n,'Command',()=>b.click())});
  $$('#pop-more .mi[id],#pop-save .mi[id]').forEach(b=>add(lab(b),'Menu',()=>b.click()));
  $$('#d-insp .tabs [data-tab]').forEach(b=>add('Details: '+lab(b),'Panel',()=>{openInsp();showTab(b.dataset.tab,true)}));
  add('Fit plan to screen','View',()=>{if(is3D)frame3D('persp');else fit()});add('Tutorial: learn every tool by designing a small office','Help',()=>tutOpen());add('Keyboard shortcuts','Help',()=>{$('#m-keys')&&$('#m-keys').click()});
  add('Recent messages','Help',()=>toastLog());add('Design axes: turn the whole plan','Command',()=>axesOpen());add('SketchUp: keys and tools sheet','Help',()=>suSheetOpen(false));add(suOn()?'SketchUp keys: turn off (StoreyBook keys)':'SketchUp keys: turn on','Command',()=>{P.suKeys=!suOn();P.suWelcome=1;savePrefs();suTips();updateHint();toast(P.suKeys?'SketchUp keys on':'StoreyBook keys')});add('Move (SketchUp)','Tool',()=>setTool('su-move'));add('Style: shaded','View',()=>suStyle('shaded'));add('Style: hidden line','View',()=>suStyle('hidden'));add('Style: sketchy edges','View',()=>suStyle('sketchy'));add('Section fill on / off','View',()=>{SU.secfill=SU.secfill===false;if(is3D)build3D();toast(SU.secfill===false?'Section fill off':'Section fill on')});add('Materials (paint bucket)','Panel',()=>suMatsOpen());add('Outliner (components, groups, rooms)','Panel',()=>suOutlinerOpen());add('Make component','Command',()=>suCompMake());add('Purge unused components','Command',()=>suCompPurge());add('Arc (SketchUp): curved wall','Tool',()=>setTool('su-arc'));add('Colour by tag on / off','View',()=>suTagColours());add('Circle (SketchUp): round room','Tool',()=>setTool('su-circle'));add('Polygon (SketchUp): many-sided room','Tool',()=>setTool('su-polygon'));add('Rotated rectangle (SketchUp)','Tool',()=>setTool('su-rrect'));add('Add scene (saved view)','View',()=>suSceneAdd());(S.scenes||[]).forEach((sc,i)=>add('Scene: '+sc.name,'View',()=>suSceneGo(i)));add('Scale (SketchUp)','Tool',()=>setTool('su-scale'));add('Tape measure guides (SketchUp)','Tool',()=>setTool('su-tape'));add('Delete guides','Command',()=>suGuidesClear());['top','front','back','right','left','iso'].forEach(k=>add('View: '+k[0].toUpperCase()+k.slice(1),'View',()=>suView(k)));add('Parallel projection / perspective','View',()=>suParallel());add('X-ray on / off','View',()=>suXray());add('Offset (SketchUp)','Tool',()=>setTool('su-offset'));add('Push/Pull (SketchUp)','Tool',()=>setTool('su-push'));add('Zoom window','View',()=>setTool('su-zwin'));add('Previous view (F8)','View',()=>suPrevView());add('Zoom selection','View',()=>suZoomSel());add('Flip along red (x)','Command',()=>suFlip('x'));add('Flip along green (y)','Command',()=>suFlip('y'));add('Hide selection','Command',()=>suHide(false));add('Hide everything else','Command',()=>suHide(true));add('Unhide all','Command',()=>suUnhide());add('Entity Info (Details)','Panel',()=>showTab('sel',true));add('Rotate (SketchUp)','Tool',()=>setTool('su-rotate'));add('Eraser (SketchUp)','Tool',()=>setTool('su-erase'));add('Design axes: pick a wall to square the plan to','Command',()=>axesPickStart());add('Room templates: save mine to a file','Command',()=>tplExport());add('Room templates: open a templates file','Command',()=>tplImport());if(tabs.length>1){add('Plan tab: move left','Command',()=>tabShift(-1));add('Plan tab: move right','Command',()=>tabShift(1))}add('Checks: every check in one place','Command',()=>{openInsp();showTab('fire',true)});add('Security zones: show or hide','Command',()=>setZoneLayer(!zoneOn()));add('Programme: requirements, areas and GFA','Command',()=>progOpen());add('Campus: several buildings on one site','Command',()=>campusOpen());add('Issue revision','Command',()=>{$('#m-snaps')&&$('#m-snaps').click()});
  if(is3D)$$('.v3bar button[id]').forEach(b=>{const n=lab(b);if(n)add(n,'3D',()=>b.click())});
  tplAll().forEach(t=>add(t.name+' (room template)','Place · '+t.disc,()=>tplOpen(t.code)));
  LIB.forEach(l=>add(`${l.name}`,'Place · '+libAt(l).join(' › '),()=>{if(is3D&&l.cat==='Ceiling')set3D(false);if(!!P.rcp!==(l.cat==='Ceiling'))setRCP(l.cat==='Ceiling',true);placeLib=l;placeRot=0;placeFlip=false;setTool('place');renderLib()},l.code));
  return out}
function cmdkFilter(){const q=$('#cmdk-in').value.trim().toLowerCase(),ws=q.split(/\s+/).filter(Boolean);
  let hits=cmdkItems.filter(it=>ws.every(w=>it.q.includes(w)||(it.key&&it.key.toLowerCase()===w)));
  const score=it=>{const n=it.name.toLowerCase();return(q&&n===q?0:q&&n.startsWith(q)?1:q&&n.split(' ').some(x=>x.startsWith(ws[0]||''))?2:3)+(it.group.startsWith('Place')?0.5:0)};
  hits=hits.map((it,i)=>[score(it),i,it]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(x=>x[2]).slice(0,q?14:10);cmdkHits=hits;cmdkAt=0;cmdkDraw()}
function cmdkDraw(){const el=$('#cmdk-list');el.innerHTML=cmdkHits.length?cmdkHits.map((it,i)=>`<button type="button" class="cmdk-it${i===cmdkAt?' on':''}" data-ck="${i}" role="option" aria-selected="${i===cmdkAt}"><span class="nm">${esc(it.name)}</span><span class="gp">${esc(it.group)}</span>${it.key?`<kbd>${esc(it.key)}</kbd>`:''}</button>`).join(''):'<p class="muted" style="padding:10px 12px;margin:0">Nothing matches. Try a tool, a menu item or a furniture name.</p>';
  const on=el.querySelector('.cmdk-it.on');if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest'})}
function cmdkOpen(){const m=$('#cmdk');if(!m||!m.hidden)return;closePops();cmdkItems=cmdkBuild();m.hidden=false;const i=$('#cmdk-in');i.value='';cmdkFilter();i.focus()}
function cmdkClose(){const m=$('#cmdk');if(m.contains(document.activeElement))document.activeElement.blur();m.hidden=true}
function cmdkRun(i){const it=cmdkHits[i];if(!it)return;cmdkClose();try{it.run()}catch(e){toast('Could not run: '+it.name)}}
$('#cmdk-in').addEventListener('input',cmdkFilter);
$('#cmdk-in').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();cmdkClose()}else if(e.key==='ArrowDown'){e.preventDefault();cmdkAt=Math.min(cmdkHits.length-1,cmdkAt+1);cmdkDraw()}else if(e.key==='ArrowUp'){e.preventDefault();cmdkAt=Math.max(0,cmdkAt-1);cmdkDraw()}else if(e.key==='Enter'){e.preventDefault();cmdkRun(cmdkAt)}});
$('#cmdk').addEventListener('click',e=>{const b=e.target.closest('[data-ck]');if(b){cmdkRun(+b.dataset.ck);return}if(e.target.id==='cmdk'||e.target.closest('[data-ck-close]'))cmdkClose()});
$('#b-find')&&$('#b-find').addEventListener('click',cmdkOpen);
/* provider tabs in the AI panel drive the (hidden) provider field, so the settings underneath change with the tab */
$('#ai-tabs')&&$('#ai-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-prov]');if(!b)return;const s=$('#ai-prov');if(s.value===b.dataset.prov)return;s.value=b.dataset.prov;s.dispatchEvent(new Event('change',{bubbles:true}))});

/* ================= programme: requirements → areas, GFA, storeys (5.0.0)
   The requirements form (Excel) is read by plain code and the sums are formulas, so nothing here needs a model. Norms and code rules are data the user can see; they stay locked until someone unlocks them on purpose. The result feeds the brief, which the AI builds from. */
const PROG={tab:'project',tmp:null};
const xmlTxt=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(m,c)=>String.fromCharCode(c)).replace(/&amp;/g,'&');
async function zipRead(buf,want){const u=new Uint8Array(buf),dv=new DataView(u.buffer,u.byteOffset,u.byteLength);let e=u.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('that is not an Excel .xlsx file');
  if(typeof DecompressionStream==='undefined')throw new Error('this browser cannot open Excel files');
  const n=dv.getUint16(e+10,true),td=new TextDecoder(),out={};let p=dv.getUint32(e+16,true);
  for(let i=0;i<n;i++){if(dv.getUint32(p,true)!==0x02014b50)break;const method=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true),name=td.decode(u.subarray(p+46,p+46+nl));
    if(want(name)){const lnl=dv.getUint16(off+26,true),lxl=dv.getUint16(off+28,true),data=u.subarray(off+30+lnl+lxl,off+30+lnl+lxl+csz);out[name]=method===0?td.decode(data):await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()}
    p+=46+nl+xl+cl}
  return out}
/* every sheet as rows of cell values (numbers stay numbers; formulas give the value Excel last worked out) */
async function xlsxRead(buf){const z=await zipRead(buf,n=>/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(n)),wb=z['xl/workbook.xml'];if(!wb)throw new Error('that is not an Excel .xlsx file');
  const at=(t,k)=>{const m=new RegExp('(?:^|\\s)'+k+'="([^"]*)"').exec(t);return m?xmlTxt(m[1]):''},ss=[],rel={},out={};
  (z['xl/sharedStrings.xml']||'').replace(/<si>([\s\S]*?)<\/si>/g,(m,b)=>{let t='';b.replace(/<rPh[\s\S]*?<\/rPh>/g,'').replace(/<t\/>/g,'').replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g,(m2,x)=>{t+=x});ss.push(xmlTxt(t))});
  (z['xl/_rels/workbook.xml.rels']||'').replace(/<Relationship\s[^>]*>/g,m=>{rel[at(m,'Id')]=at(m,'Target').replace(/^\/?(xl\/)?/,'xl/')});
  wb.replace(/<sheet\s[^>]*>/g,m=>{const x=z[rel[at(m,'r:id')]],rows=[];if(!x)return;
    x.replace(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,(m2,a,body)=>{const r=/^([A-Z]+)(\d+)$/.exec(at(' '+a,'r'));if(!r||body==null)return;let c=0;for(const ch of r[1])c=c*26+ch.charCodeAt(0)-64;const t=at(' '+a,'t'),v=/<v>([\s\S]*?)<\/v>/.exec(body),is=/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/.exec(body);
      const val=t==='s'?ss[+(v&&v[1])]:t==='inlineStr'?(is?xmlTxt(is[1]):''):v?(t==='str'||t==='e'?xmlTxt(v[1]):+v[1]):null;if(val==null||val==='')return;(rows[+r[2]-1]=rows[+r[2]-1]||[])[c-1]=val});
    out[at(m,'name')]=rows});
  return out}
/* a small .xlsx writer: stored (uncompressed) zip, inline strings. Enough for Excel and for xlsxRead above */
function xlsxWrite(sheets){const te=new TextEncoder(),tb=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;tb[n]=c>>>0}
  const crc=u=>{let c=~0;for(let i=0;i<u.length;i++)c=tb[(c^u[i])&255]^(c>>>8);return(~c)>>>0},col=i=>{let s='';for(i++;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s},names=Object.keys(sheets),H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',NS='http://schemas.openxmlformats.org/';
  const files=[['[Content_Types].xml',H+`<Types xmlns="${NS}package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((n,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels',H+`<Relationships xmlns="${NS}package/2006/relationships"><Relationship Id="rId1" Type="${NS}officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml',H+`<workbook xmlns="${NS}spreadsheetml/2006/main" xmlns:r="${NS}officeDocument/2006/relationships"><sheets>${names.map((n,i)=>`<sheet name="${esc(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',H+`<Relationships xmlns="${NS}package/2006/relationships">${names.map((n,i)=>`<Relationship Id="rId${i+1}" Type="${NS}officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`]];
  names.forEach((n,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,H+`<worksheet xmlns="${NS}spreadsheetml/2006/main"><sheetData>${sheets[n].map((row,r)=>`<row r="${r+1}">${(row||[]).map((v,c)=>v==null||v===''?'':typeof v==='number'&&isFinite(v)?`<c r="${col(c)}${r+1}"><v>${v}</v></c>`:`<c r="${col(c)}${r+1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`]));
  const parts=[],cd=[];let off=0;
  for(const [name,text] of files){const nm=te.encode(name),d=te.encode(text),c=crc(d),h=new DataView(new ArrayBuffer(30)),e=new DataView(new ArrayBuffer(46));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint32(14,c,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nm.length,true);
    e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint32(16,c,true);e.setUint32(20,d.length,true);e.setUint32(24,d.length,true);e.setUint16(28,nm.length,true);e.setUint32(42,off,true);
    parts.push(h.buffer,nm,d);cd.push(e.buffer,nm);off+=30+nm.length+d.length}
  const z=new DataView(new ArrayBuffer(22));z.setUint32(0,0x06054b50,true);z.setUint16(8,files.length,true);z.setUint16(10,files.length,true);z.setUint32(12,cd.reduce((a,b)=>a+b.byteLength,0),true);z.setUint32(16,off,true);
  return new Blob([...parts,...cd,z.buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}

/* the figures below are PLACEHOLDERS so the sums have something to run on. They are not MIG or PSM figures: the real ones come in with the form, or are typed into the Norms tab */
function progDefault(){return{src:'',ph:true,unlocked:false,base:null,
  project:{name:'',type:'New Build',site:null,cover:0.4,hlimit:null,f2f:4.2,storeys:null,bas:0,basd:null,pg:'IV'},people:[],spaces:[],servers:[],accom:[],
  norms:{ranks:[['Band 1','Head of department','Enclosed office',30],['Band 2','Senior manager','Enclosed office',20],['Band 3','Manager','Enclosed office',12],['Band 4','Officer','Open plan',8],['Band 5','Support staff','Open plan',6],['Band 6','Shift or hot desk','Open plan',5]].map(r=>({code:r[0],desc:r[1],ws:r[2],m2:r[3]})),
    types:[['Auditorium',1.2,'N','White',7],['Operations room',6,'N','Red'],['Meeting room',2.5,'Y','Green'],['Training room',2.5,'Y','Green'],['Pantry',1.5,'Y','Green'],['Store',0,'Y','Green'],['Gym',0,'N','White'],['Other',0,'N','Green']].map(r=>({type:r[0],m2:r[1],cap:r[2],zone:r[3],ht:r[4]||null})),
    beds:[['Single room',1,12,3],['Twin room',2,8,2],['4-bed bunk room',4,5,1.5]].map(r=>({type:r[0],per:r[1],m2:r[2],abl:r[3]})),
    srv:{rack:3,kw:0.15,n:1,n1:1.25,n2:2},bld:{cap:13,circ:0.25,circCap:'Y',me:0.1,core:0.08}},
  rules:[['Habitable height over 24 m','hh',24,'At least two fire lifts (purpose groups III to VIII). Purpose group II: at least one.','Cl. 6.6.4b','SCDF Fire Code 2023',0],['Basement deeper than 9 m below average ground level','basd',9,'At least two fire lifts (all except purpose group I).','Cl. 6.6.4b','SCDF Fire Code 2023',0],['Building above four storeys','st',4,'Standby generator to home or operate lifts (purpose groups III to VIII).','Cl. 6.6.3b','SCDF Fire Code 2023',0],['Habitable height over 24 m','hh',24,'Evacuation lift requirements apply; passenger lifts are designed to work with the fire lifts.','Cl. 6.6.5','SCDF Fire Code 2023',0],['More than one storey','st',1,'Passenger lift for accessibility. Requirement and clause to be entered by BI.','To be entered','BCA Code on Accessibility in the Built Environment 2025',1]].map(r=>({rule:r[0],src:r[1],th:r[2],req:r[3],clause:r[4],code:r[5],chk:r[6]}))}}
const progGet=()=>S.prog||(PROG.tmp=PROG.tmp||progDefault());
/* the sums: the same ones as sheet 8 of the form */
function progCalc(p){const N=v=>+v>0?+v:0,nm=p.norms,rk=Object.fromEntries(nm.ranks.map(r=>[r.code,r])),ty=Object.fromEntries(nm.types.map(r=>[r.type,r])),bd=Object.fromEntries(nm.beds.map(r=>[r.type,r])),pj=p.project;
  const people=p.people.map(r=>{const k=rk[r.rank]||{};return{ws:k.ws||(r.rank?'Not in the norms':''),m2:N(k.m2),area:N(r.n)*N(k.m2)}}),
    spaces=p.spaces.map(r=>{const k=ty[r.type]||{},each=N(r.area)||N(r.seats)*N(k.m2);return{each,tot:N(r.qty)*each,cap:k.cap==='Y'?'Y':'N'}}),
    servers=p.servers.map(r=>{const tkw=N(r.tkw)||N(r.racks)*N(r.kw);return{tkw,white:N(r.racks)*N(nm.srv.rack),plant:tkw*N(nm.srv.kw)*N(r.red==='2N'?nm.srv.n2:r.red==='N+1'?nm.srv.n1:nm.srv.n)}}),
    accom=p.accom.map(r=>{const k=bd[r.type]||{};return{rooms:N(k.per)?Math.ceil(N(r.beds)/N(k.per)):0,room:N(r.beds)*N(k.m2),abl:N(r.beds)*N(k.abl),per:N(k.per),m2:N(k.m2)}}),sum=(a,f)=>a.reduce((s,x)=>s+x[f],0);
  const pax=p.people.reduce((s,r)=>s+N(r.n),0),pax24=p.people.reduce((s,r)=>s+(r.shift==='Y'?N(r.n):0),0),work=sum(people,'area'),named=sum(spaces,'tot'),white=sum(servers,'white'),plant=sum(servers,'plant'),kw=sum(servers,'tkw'),acc=sum(accom,'room')+sum(accom,'abl'),beds=p.accom.reduce((s,r)=>s+N(r.beds),0);
  const net=work+named+white+acc,circ=net*N(nm.bld.circ),pre=net+circ+plant,den=1-N(nm.bld.me)-N(nm.bld.core),gfa=den>0?pre/den:0,me=gfa*N(nm.bld.me),core=gfa*N(nm.bld.core);
  const capBase=work+spaces.reduce((s,x)=>s+(x.cap==='Y'?x.tot:0),0),capArea=capBase+(nm.bld.circCap==='Y'&&net>0?circ*capBase/net:0),perPax=pax?capArea/pax:0,capOk=pax?perPax<=N(nm.bld.cap):null;
  const plate=N(pj.site)*N(pj.cover),need=plate>0?Math.ceil(gfa/plate):0,st=N(pj.storeys)?Math.round(N(pj.storeys)):Math.max(1,need),fp=gfa/st,h=st*N(pj.f2f),hh=(st-1)*N(pj.f2f);
  const rules=p.rules.map(r=>{const val=r.src==='hh'?hh:r.src==='basd'?N(pj.basd):st;return{val,trig:val>N(r.th)?(r.chk?'Check':'Yes'):'No'}});
  return{people,spaces,servers,accom,rules,pax,pax24,work,named,white,plant,kw,acc,beds,net,circ,gfa,me,core,capArea,perPax,capOk,plate,need,st,fp,h,hh,hOk:N(pj.hlimit)?h<=N(pj.hlimit):null,siteOk:plate>0?fp<=plate:null,rows:p.people.length+p.spaces.length+p.servers.length+p.accom.length}}
/* the programme as a brief: room types the AI can build and the brief check can count */
function progBrief(p,c){const z=v=>String(v||'').toLowerCase(),rk=Object.fromEntries(p.norms.ranks.map(r=>[r.code,r])),rooms=[],R=Math.round,r1=v=>Math.round(v*10)/10;
  p.people.forEach((r,i)=>{const k=rk[r.rank],n=+r.n||0;if(!k||!n)return;const nm=(k.desc||r.rank);
    if(/enclosed/i.test(k.ws))rooms.push({k:'office',name:nm+' office',qty:n,area:k.m2,seats:1,notes:(r.shift==='Y'?'24/7 shift. ':'')+(r.notes||'')});
    else rooms.push({k:'open',name:nm+' open office',qty:c.st,area:r1(n*k.m2/c.st),seats:Math.ceil(n/c.st),notes:`${n} desks in all, ${k.m2} m² each. `+(r.shift==='Y'?'24/7 shift. ':'')+(r.notes||'')})});
  p.spaces.forEach((r,i)=>{if(!(+r.qty>0)||!c.spaces[i].each)return;rooms.push({k:'named',type:r.type,name:r.name||r.type,qty:R(r.qty),area:r1(c.spaces[i].each),seats:+r.seats>0?R(r.seats):null,zone:z(r.zone),notes:(r.h24==='Y'?'24/7. ':'')+(r.notes||'')})});
  p.servers.forEach((r,i)=>{const x=c.servers[i];if(!x.white)return;rooms.push({k:'server',racks:+r.racks||0,name:r.name||'Server room',qty:1,area:r1(x.white),zone:z(r.zone),notes:`24/7. ${r.racks} racks, ${R(x.tkw)} kW, ${r.red||'N'}. `+(r.notes||'')});if(x.plant)rooms.push({k:'plant',name:(r.name||'Server room')+' plant',qty:1,area:r1(x.plant),zone:z(r.zone),notes:'UPS, switchgear and cooling for '+(r.name||'the server room')})});
  p.accom.forEach((r,i)=>{const x=c.accom[i];if(!x.rooms)return;rooms.push({k:'bunk',name:r.type,qty:x.rooms,area:r1(x.per*x.m2),seats:null,zone:z(r.zone),notes:`${x.per} bed${x.per>1?'s':''} each, mechanically ventilated. `+(r.notes||'')});if(x.abl)rooms.push({k:'abl',name:p.accom.filter(q=>q.type).length>1?r.type+' ablutions':'Ablutions',qty:1,area:r1(x.abl),zone:z(r.zone),notes:'For '+r.type})});
  if(c.me>0)rooms.push({k:'me',name:'M&E plant room',qty:c.st,area:r1(c.me/c.st),notes:'Base building plant'});
  const tr=p.rules.map((r,i)=>c.rules[i].trig!=='No'?`${r.req} (${r.clause}, ${r.code})`:'').filter(Boolean);
  return{title:p.project.name||'Programme',floors:c.st,rooms,notes:`From the programme. Interior GFA ${R(c.gfa)} m² on ${c.st} storey${c.st>1?'s':''}, about ${R(c.fp)} m² a floor, floor to floor ${p.project.f2f||'?'} m. Allow about ${R(c.circ)} m² of corridors and ${R(c.core)} m² for cores, stairs and toilets across the building. Keep security zones apart, with higher zones away from public areas, and group the 24/7 rooms so they work when the rest is shut.${tr.length?' Code: '+tr.join(' '):''}`.slice(0,2000)}}
/* ---- programme → building, by code (5.0.0 test 12)
   Geometry is not left to a model: 150 rooms that fit a floor, share walls and leave corridors is a packing problem. Stacking is a small table (suggested by rule, editable), each floor is laid out as rows of rooms along corridors with fixed cores, and rooms are furnished from their seat counts. The result goes through the same preview, checks and Undo as an AI answer. */
const PL={cor:2000,spine:2400,cw:7000,sw:3400,sh:6200,toilets:60};
/* which floor each room type goes on. Rule of thumb: public rooms low, offices in the middle, accommodation above, secure rooms at the top; one open office and one plant room on every floor. A row the user has typed wins while it still adds up */
function progStack(p,c,units){const st=c.st,T=units.reduce((s,u)=>s+u.qty*u.area,0)/st,used=Array(st).fill(0),cnt={},auto={},rank=u=>(u.k==='open'||u.k==='me')&&u.qty===st?-1:u.zone==='white'?0:u.zone==='red'?4:u.zone==='black'?5:u.k==='bunk'||u.k==='abl'?3:u.k==='office'||u.k==='open'?2:1;
  let f=0;units.map((u,i)=>i).sort((a,b)=>rank(units[a])-rank(units[b])||units[b].area-units[a].area).forEach(i=>{const u=units[i],n=Array(st).fill(0),user=p.stack&&p.stack[u.name];
    if(Array.isArray(user)&&user.length===st&&user.reduce((a,b)=>a+(+b||0),0)===u.qty){user.forEach((v,k)=>{n[k]=+v||0;used[k]+=n[k]*u.area})}
    else{auto[u.name]=1;if(rank(u)<0){n.fill(1);used.forEach((x,k)=>{used[k]+=u.area})}else for(let j=0;j<u.qty;j++){if(used[f]+u.area>T*1.05&&used[f]>0&&f<st-1)f++;n[f]++;used[f]+=u.area}}
    cnt[u.name]=n});
  return{cnt,used,T,auto}}
/* one floor: rooms in rows ("shelves") across the width, a corridor at the top edge and then one between every pair of rows, so every room has a door on a corridor */
function progFloor(rooms,Ws,adj,targetH){const zr=z=>z==='white'?0:z==='red'?2:z==='black'?3:1,cls=a=>a<=45?0:a<=160?1:2,BH=[5000,8000],shelves=[];let cur=null;
  /* biggest first; rooms wide enough to take a whole row lead, so the rest of the large ones can share rows */const full=r=>r.area*1e6/Ws>=9000?1:0;
  /* adjacencies: room types that should be near each other get the same group number, so they sit together in their row; a type that should be apart from the one before it goes to the end of its size band */
  const grp={};let gn=0;(adj||[]).filter(a=>a.t==='near').forEach(a=>{const g=grp[a.a]||grp[a.b]||++gn;Object.keys(grp).forEach(k=>{if(grp[k]===grp[a.a]||grp[k]===grp[a.b])grp[k]=g});grp[a.a]=grp[a.b]=g});
  const G=r=>grp[r.u]||99,gmax={};rooms.forEach(r=>{const g=grp[r.u];if(g)gmax[g]=Math.max(gmax[g]||0,cls(r.area))});/* a group sorts with its biggest member, so a small room can sit beside the large one it belongs with */const sc=r=>grp[r.u]?gmax[grp[r.u]]:cls(r.area),apart=(x,y)=>(adj||[]).some(a=>a.t==='apart'&&((a.a===x&&a.b===y)||(a.a===y&&a.b===x)));
  const order=rooms.slice().sort((a,b)=>sc(b)-sc(a)||full(b)-full(a)||G(a)-G(b)||cls(b.area)-cls(a.area)||(cls(a.area)<2?zr(a.zone)-zr(b.zone):0)||b.area-a.area||(a.u<b.u?-1:a.u>b.u?1:0));
  for(let i=1;i<order.length;i++){const a=order[i-1],b=order[i];if(a.u!==b.u&&cls(a.area)===cls(b.area)&&apart(a.u,b.u)){const mv=order.filter(r=>r.u===b.u&&cls(r.area)===cls(b.area)),rest=order.filter(r=>!mv.includes(r));let e=rest.length;while(e>0&&cls(rest[e-1].area)<cls(b.area))e--;if(e>0&&apart(rest[e-1].u,b.u))continue;order.length=0;order.push(...rest.slice(0,e),...mv,...rest.slice(e));break}}
  /* does this room keep a usable shape in a row of depth h? Rooms that belong with a neighbour may be a little narrower */
  const shape=(r,h)=>{const w=r.area*1e6/h;return grp[r.u]?w>=1800&&h/w<=4.5:w>=3000&&h/w<=3},seen={};
  order.forEach(r=>{const k=cls(r.area),A=r.area*1e6,g=grp[r.u];let h=k<2?BH[k]:A/Ws>=9000?A/Ws:Math.max(10000,Math.min(24000,Math.sqrt(A/1.8)));if(A/h>Ws)h=A/Ws;
    /* a group that cannot all fit in what is left of this row starts a row of its own, so its rooms stay side by side */
    if(g&&!seen[g]){seen[g]=1;const mem=order.filter(x=>grp[x.u]===g);if(cur&&!(mem.every(x=>cls(x.area)===cur.k||shape(x,cur.h))&&cur.sum+mem.reduce((t,x)=>t+x.area*1e6/cur.h,0)<=Ws+1))cur=null}
    if(cur&&cur.sum+A/cur.h<=Ws+1&&(cur.k===k||shape(r,cur.h))){cur.rooms.push(r);cur.sum+=A/cur.h}else{cur={k,h,rooms:[r],sum:A/h};shelves.push(cur)}});
  const out=[],fingers=[[0,PL.cor]];let y=PL.cor,spare=0;
  /* every floor is made the same depth as the deepest one, so the building is one block with a roof over all of it: rows are deepened by up to 15% (rooms get a little bigger), and anything still missing becomes a spare strip */
  const h0=s=>Math.round(s.k===2&&s.rooms.length===1?s.h:s.h*Math.max(s.sum/Ws,0.6)),rowsH=shelves.reduce((t,s)=>t+h0(s),0),corH=PL.cor*(1+Math.ceil(Math.max(0,shelves.length-1)/2)),sf=targetH&&rowsH&&targetH>rowsH+corH?Math.min(1.15,(targetH-corH)/rowsH):1;
  const lay=(s,side)=>{const hb=h0(s),h=Math.round(hb*sf);let x=0;
    s.rooms.forEach((r,i)=>{let w=Math.round(r.area*1e6/hb);if(i===s.rooms.length-1&&Ws-(x+w)<600)w=Ws-x;out.push(Object.assign({},r,{x,y,w,h,side}));x+=w});
    if(Ws-x>=600){out.push({name:'Spare',k:'spare',x,y,w:Ws-x,h,side,area:(Ws-x)*h/1e6});spare+=(Ws-x)*h/1e6}y+=h};
  for(let i=0;i<shelves.length;i++){if(i===0){lay(shelves[i],'top');continue}
    if(i+1<shelves.length){lay(shelves[i],'bottom');fingers.push([y,y+PL.cor]);y+=PL.cor;lay(shelves[++i],'top')}else{lay(shelves[i],'bottom');fingers.push([y,y+PL.cor]);y+=PL.cor}}
  if(targetH&&targetH-y>=600){out.push({name:'Spare',k:'spare',x:0,y,w:Ws,h:targetH-y,side:'top',area:Ws*(targetH-y)/1e6});spare+=Ws*(targetH-y)/1e6;y=targetH}
  else if(targetH&&targetH>y){const d=targetH-y,last=out.filter(r=>r.y+r.h===y);if(last.length){last.forEach(r=>{r.h+=d});y=targetH}}
  return{rooms:out,fingers,H:y,spare}}
/* the whole building as commands for the command layer, one list per floor */
function progPlan(p,c){const units=progBrief(p,c).rooms,S_=progStack(p,c,units),st=c.st,pj=p.project,ty=Object.fromEntries(p.norms.types.map(t=>[t.type,t])),meA=0;
  const per=[];for(let f=0;f<st;f++)per.push([]);const no={};
  units.forEach(u=>{S_.cnt[u.name].forEach((n,f)=>{for(let j=0;j<n;j++){no[u.name]=(no[u.name]||0)+1;per[f].push(Object.assign({},u,{u:u.name,name:u.qty>1?u.name+' '+no[u.name]:u.name}))}})});
  const big=Math.max(...per.map(r=>r.reduce((s,x)=>s+x.area,0)),1),Ws=Math.max(24000,Math.round(Math.sqrt(big*1.25*1.6)*1000/600)*600),lay0=per.map(r=>progFloor(r,Ws,p.adj)),Hall=Math.max(...lay0.map(L=>L.H)),lay=per.map(r=>progFloor(r,Ws,p.adj,Hall));
  const cw=PL.cw,xs=cw+PL.spine,X=xs+Ws,warn=[],floors=[];let spare=0;
  lay.forEach((L,f)=>{const cm=[],nm='L'+(f+1),H=L.H,rc=(name,x,y,w,h,zone)=>cm.push(Object.assign({do:'room',name,x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)},zone?{zone}:{})),door=(x,y,rot,w,exit)=>cm.push(Object.assign({do:'door',x:Math.round(x),y:Math.round(y),rotation:rot,width:w},exit?{exit:true}:{}));
    const ht=Math.max(+pj.f2f||4.2,...per[f].map(r=>+(ty[r.type]||{}).ht||0));cm.push({do:'floor',floor:nm,unique:true,floor_to_floor:Math.round(ht*1000)},{do:'go_floor',floor:nm});
    /* cores: the same place on every floor */
    rc('Stair 1',0,0,cw,3400);door(cw,1700,90,1000,true);rc('Lift lobby',0,3400,cw,3800);door(cw,5300,90,1800);
    let yy=7200;const tH=Math.max(2500,Math.min(PL.toilets*1e6/cw,H-7200-meA*1e6/cw)),mH=meA*1e6/cw;
    if(H-yy<tH+mH*0.9){warn.push(nm+': the core column is too short for its plant room')}
    rc('Toilets '+nm,0,yy,cw,tH);door(cw,yy+tH/2,90,900);yy+=tH;if(meA){const h=Math.min(mH,H-yy);if(h>1500){rc('M&E plant room '+(st>1?f+1:'').toString().trim(),0,yy,cw,h);door(cw,yy+h/2,90,1800);yy+=h}}
    if(H-yy>=1500){rc('Services '+nm,0,yy,cw,H-yy);door(cw,yy+(H-yy)/2,90,900)}else if(H-yy>0){cm[cm.length-2].h+=Math.round(H-yy)}
    rc('Stair 2',X,0,PL.sw,PL.sh);door(X,PL.cor/2,90,1000,true);
    if(f===0)cm.push({do:'place',code:'ST2654',x:Math.round(cw/2),y:1700,rotation:90},{do:'place',code:'LF2425',x:Math.round(cw/2-1400),y:3400+1900},{do:'place',code:'LF2425',x:Math.round(cw/2+1400),y:3400+1900},{do:'place',code:'ST2654',x:X+PL.sw/2,y:PL.sh/2});
    /* corridor: a comb, the spine down the core side and a finger along each row */
    const pts=[[cw,0],[X,0],[X,PL.cor],[xs,PL.cor]];L.fingers.slice(1).forEach(([a,b])=>{pts.push([xs,a],[X,a],[X,b]);if(b<H)pts.push([xs,b])});if(pts[pts.length-1][1]<H)pts.push([xs,H]);else pts.push([xs,H]);pts.push([cw,H]);
    cm.push({do:'room',name:'Corridor '+nm,pts:pts.filter((q,i,a)=>!i||q[0]!==a[i-1][0]||q[1]!==a[i-1][1])});
    L.rooms.forEach(r=>{const x=xs+r.x,y=r.y,w=r.w,h=r.h,dy=r.side==='top'?y:y+h;rc(r.name,x,y,w,h,r.zone||null);if(r.k==='spare')return;
      if(r.area>300){door(x+w*0.25,dy,0,1800);door(x+w*0.75,dy,0,1800)}else door(x+w/2,dy,0,r.area>=100?1800:900);
      /* a grid of one item that holds n: roomy first, then tighter spacing if the room is small for its seats */const grid=(code,iw,id,dx,dy2,n)=>{let best=null;for(const [m,px,py] of [[1500,dx,dy2],[1000,iw+100,id+1100],[700,iw+50,id+800],[400,iw,id+500]]){const cols=Math.max(1,Math.min(40,Math.floor((w-2*m-iw)/px)+1)),fit=Math.max(1,Math.min(40,Math.floor((h-2*m-id)/py)+1));best={m,px,py,cols,rows:Math.min(fit,Math.ceil(n/cols))};if(cols*fit>=n)break}
        cm.push({do:'array',code,x:Math.round(x+best.m+iw/2),y:Math.round(y+best.m+id/2),rows:best.rows,cols:best.rows===1?Math.min(best.cols,n):best.cols,dx:best.px,dy:best.py})};
      if(r.k==='office')cm.push({do:'place',code:w>=3000&&h>=3000?'WS1670':'WS1260',x:Math.round(x+w/2),y:Math.round(y+h/2)});
      else if(r.k==='open'&&r.seats)grid('WS1470',1400,700,1600,2000,r.seats);
      else if(r.k==='server'&&r.racks)grid('RK6010',600,1000,600,2400,r.racks);
      else if(r.seats){const t=[['MT1680',4,1600,800],['MT1890',6,1800,900],['MT2412',8,2400,1200],['MT3612',12,3600,1200],['MT4815',16,4800,1500]].find(q=>q[1]>=r.seats&&q[2]+1600<=w&&q[3]+1600<=h);
        if(t)cm.push({do:'place',code:t[0],x:Math.round(x+w/2),y:Math.round(y+h/2)});else grid('TR1260',1200,600,1300,1500,Math.ceil(r.seats/2))}});
    cm.push({do:'windows'});spare+=L.spare;floors.push({name:nm,cm,rooms:L.rooms.length,H,ht})});
  /* were the adjacencies honoured? Near = sharing a wall or facing across one corridor, on the same floor. Apart = not sharing a wall */
  const gap=(a,b)=>Math.max(0,Math.max(a.x,b.x)-Math.min(a.x+a.w,b.x+b.w))+Math.max(0,Math.max(a.y,b.y)-Math.min(a.y+a.h,b.y+b.h)),over=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>300||Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>300;
  const adj=(p.adj||[]).map(a=>{let best=Infinity,same=false;lay.forEach(L=>{const A=L.rooms.filter(r=>r.u===a.a),B=L.rooms.filter(r=>r.u===a.b);if(A.length&&B.length)same=true;A.forEach(x=>B.forEach(y=>{if(over(x,y))best=Math.min(best,gap(x,y))}))});
    return a.t==='near'?{ok:best<=PL.cor+1,note:!same?'on different floors':best<=PL.cor+1?'':'same floor, not next to each other'}:{ok:best>1,note:best>1?'':'share a wall'}});
  return{floors,units,stack:S_,Ws,W:X+PL.sw,H:Math.max(...lay.map(L=>L.H)),spare,warn,cw,adj}}
/* the AI's part: choices, not geometry. It is asked one small question (which floor for each room type, and what should be near or apart) and answers with a short table that StoreyBook checks before using */
const ADVISE_SCHEMA={type:'object',properties:{reply:{type:'string'},stacking:{type:'array',items:{type:'object',properties:{room:{type:'string'},floors:{type:'array',items:{type:'integer'}},why:{type:'string'}},required:['room','floors']}},near:{type:'array',items:{type:'object',properties:{a:{type:'string'},b:{type:'string'},why:{type:'string'}},required:['a','b']}},apart:{type:'array',items:{type:'object',properties:{a:{type:'string'},b:{type:'string'},why:{type:'string'}},required:['a','b']}}},required:['reply','stacking']};
function progAdviseAsk(p,c){const u=progBrief(p,c).rooms,s=progStack(Object.assign({},p,{stack:null}),c,u);
  return[{role:'system',content:`You advise on how to stack a building: which floor each room type goes on, and which room types should be near each other or kept apart. StoreyBook draws the building; you only make these choices.
Reply with one JSON object and nothing else: {"reply":"two or three sentences on the main choices","stacking":[{"room":"exact name","floors":[rooms on L1, rooms on L2, ...],"why":"short reason"}],"near":[{"a":"name","b":"name","why":"short reason"}],"apart":[{"a":"name","b":"name","why":"short reason"}]}
Rules:
- Every room type appears once in "stacking". "floors" has exactly ${c.st} whole numbers, lowest floor first, and they add up to the room type's quantity.
- Keep each floor's total room area near the target and never above 120% of it.
- A room type marked every_floor keeps one on each floor.
- Room types that must be near each other go on the same floor.
- Use only the names given. At most 8 "near" and 8 "apart" pairs, only where it matters.
Think about: public and heavy rooms low; security zones kept apart (white is public, green is staff, red is restricted, black is most restricted) with higher zones away from the entrance; 24/7 rooms together and with their plant; server rooms with their plant; accommodation away from noise and from restricted rooms.`},
    {role:'user',content:JSON.stringify({storeys:c.st,target_room_area_per_floor_m2:Math.round(s.T),room_types:u.map(r=>Object.assign({name:r.name,quantity:r.qty,area_each_m2:r.area},r.zone?{zone:r.zone}:{},r.notes?{notes:String(r.notes).slice(0,120)}:{},(r.k==='open'||r.k==='me')&&r.qty===c.st?{every_floor:true}:{})),rule_based_suggestion:s.cnt})}]}
/* use what is valid in the answer, say what was not */
function progAdviceApply(j){const p=S.prog;if(!p)return'';const c=progCalc(p),u=progBrief(p,c).rooms,key=x=>String(x||'').trim().toLowerCase(),by=Object.fromEntries(u.map(r=>[key(r.name),r])),bad=[];let ok=0;const adj=[];
  progEdit(p=>{p.stack=p.stack||{};p.why={};(Array.isArray(j.stacking)?j.stacking:[]).forEach(r=>{const t=by[key(r&&r.room)];if(!t)return;const fl=(Array.isArray(r.floors)?r.floors:[]).map(v=>Math.max(0,Math.round(+v||0)));
      if(fl.length!==c.st||fl.reduce((a,b)=>a+b,0)!==t.qty||((t.k==='open'||t.k==='me')&&t.qty===c.st&&fl.some(v=>v!==1))){bad.push(t.name);return}p.stack[t.name]=fl;if(r.why)p.why[t.name]=String(r.why).slice(0,160);ok++});
    [['near',j.near],['apart',j.apart]].forEach(([t,list])=>(Array.isArray(list)?list:[]).slice(0,8).forEach(x=>{const a=by[key(x&&x.a)],b=by[key(x&&x.b)];if(a&&b&&a!==b&&!adj.some(q=>(q.a===a.name&&q.b===b.name)||(q.a===b.name&&q.b===a.name)))adj.push({a:a.name,b:b.name,t,why:String(x.why||'').slice(0,160)})}));
    if(adj.length||Array.isArray(j.near)||Array.isArray(j.apart))p.adj=adj;p.advice=String(j.reply||'').slice(0,600)});
  return`${ok} of ${u.length} room types stacked by the AI${bad.length?`; ${bad.length} kept on the rule-based floors because the answer did not add up (${bad.slice(0,4).join(', ')}${bad.length>4?'…':''})`:''}. ${adj.length} adjacenc${adj.length===1?'y':'ies'}.`}
async function progAdvise(){const p=S.prog;if(!p||AI.busy)return;const c=progCalc(p);if(!c.rows)return;if(aiIsP()){PROG.msg='Stacking advice needs the Ollama or Claude tab of the AI assistant. Copy and paste is not supported here yet.';progUI();return}
  AI.busy=true;AI.tab=curTab;PROG.msg='Asking AI…';progUI();const t0=performance.now();
  try{const out=await aiChat(progAdviseAsk(p,c),n=>{PROG.msg=`Asking AI… ${n} tokens · ${((performance.now()-t0)/1000).toFixed(0)} s`;const e=$('#prog-msg');if(e)e.textContent=PROG.msg},ADVISE_SCHEMA),j=aiParse(out);
    if(!Array.isArray(j.stacking)||!j.stacking.length)throw new Error('The model did not return a stacking table');PROG.msg=progAdviceApply(j)+` Done in ${((performance.now()-t0)/1000).toFixed(0)} s.`}
  catch(e){PROG.msg=e.name==='AbortError'?'Stopped.':aiErrText(e)}finally{AI.busy=false;AI.ctrl=null;AI.tab=null;AI.wait=null;try{aiState('')}catch(e){}progUI()}}
function progBuild(){const p=S.prog;if(!p)return;const c=progCalc(p);if(!c.rows){toast('The programme has nothing in it yet');return}
  if(planHasRooms()){const pr=clone(p),br=S.brief?clone(S.brief):null;newTab(Object.assign(blankPlan(),{name:p.project.name||'Programme building'}));S.prog=pr;if(br)S.brief=br;toast('Built in a new plan tab. Your drawing is still in its own tab.')}
  $('#prog-modal').hidden=true;const pl=progPlan(S.prog,c),pre=aiPre(),log=[],err=[];
  const run=cm=>{for(let i=0;i<cm.length;i+=500){const r=aiRun(cm.slice(i,i+500));log.push(...r.log);err.push(...r.err)}};
  run([{do:'plan',name:p.project.name||S.name},...(c.st>1?[{do:'add_floor',count:c.st-1}]:[])]);pl.floors.forEach(f=>run(f.cm));run([{do:'go_floor',floor:'L1'}]);
  AI.briefOn=true;aiOpen();const k=briefCheck(),R=v=>Math.round(v).toLocaleString();
  aiShow(pre,`Built from the programme by StoreyBook (no model used): ${pl.floors.length} floor${pl.floors.length>1?'s':''}, ${pl.floors.reduce((s,f)=>s+f.rooms,0)} rooms plus cores and corridors, about ${R(pl.W/1000)} m × ${R(pl.H/1000)} m.\nBrief: ${k.met} of ${k.n} items met.${pl.spare>1?` Spare space left at the ends of rows: ${R(pl.spare)} m².`:''}${pl.adj.length?` Adjacencies: ${pl.adj.filter(a=>a.ok).length} of ${pl.adj.length} met.`:''}${pl.warn.length?'\n'+pl.warn.join('\n'):''}${(()=>{const w=[];if(c.capOk===false)w.push(`Office norm: ${(Math.round(c.perPax*10)/10)} m² per pax is over the cap of ${S.prog.norms.bld.cap}.`);if(c.hOk===false)w.push(`Height: ${(Math.round(c.h*10)/10)} m is over the limit of ${S.prog.project.hlimit} m.`);if(c.siteOk===false)w.push('Site: the floor plate the programme needs is larger than the site allows.');if(c.plate>0&&pl.W*pl.H/1e6>c.plate*1.02)w.push(`Site: the drawn floor is about ${R(pl.W*pl.H/1e6)} m², more than the ${R(c.plate)} m² the site allows. Corridors, cores and spare space take more than the programme's allowances.`);const t=S.prog.rules.filter((r,i)=>c.rules[i].trig!=='No');if(t.length)w.push(`Code rules that apply: ${t.map(r=>r.rule+' ('+r.clause+')').join('; ')}.`);return w.length?'\nChecks:\n• '+w.join('\n• '):''})()}\nThis is a block layout to test fit: rows of rooms on straight corridors, two stairs, a lift core. Fire travel distances and accessibility are not checked. Bunk rooms are left unfurnished.`,log,err,'Build from the programme',k.fails.slice(0,14),0)}

function planHasRooms(){ensureBld(S);syncFloorOut(S);return S.bld.levels.some(l=>(floorObjsOf(S,l.id)||[]).some(o=>o.t==='room'))}
/* keep the brief in step with the programme (only once the programme has something in it) */
function progSync(){const p=S.prog;if(!p)return;const c=progCalc(p);if(!c.rows)return;S.brief=aiBriefNorm(progBrief(p,c),[p.src||'Programme']);try{aiBriefUI()}catch(e){}}
/* read the requirements form. Tables are found by their header text, not by row number, so rows can be added to the form without breaking this */
function progFromSheets(sh){const pick=re=>{const k=Object.keys(sh).find(n=>re.test(n));return k?sh[k]:null},lc=v=>String(v==null?'':v).trim().toLowerCase(),P=pick(/project/i),W=pick(/people/i);
  if(!P||!W)throw new Error('This Excel file is not the StoreyBook requirements form');
  const p=progDefault(),S_=v=>v==null?'':String(v).trim(),n=v=>v===''||v==null||!isFinite(+v)?null:+v;p.ph=false;
  /* a header row is known by its first two cells, so the guidance block above a table (which repeats the first column's name) is not mistaken for it */const tbl=(rows,head,h2,f,gap)=>{const out=[];if(!rows)return null;const h=rows.findIndex(r=>r&&lc(r[0])===lc(head)&&lc(r[1]).startsWith(lc(h2)));if(h<0)return null;let miss=0;for(let i=h+1;i<rows.length&&miss<=gap&&out.length<200;i++){const r=rows[i]||[];if(S_(r[0])===''){miss++;continue}miss=0;out.push(f(r))}return out};
  [['name',/project name/i,1],['type',/new build/i,1],['site',/site area/i],['cover',/coverage/i],['hlimit',/height limit/i],['f2f',/floor-to-floor/i],['storeys',/storeys wanted/i],['bas',/basement levels/i],['basd',/basement depth/i],['pg',/purpose group/i,1]].forEach(([k,re,str])=>{const r=P.find(x=>x&&re.test(S_(x[0])));if(r)p.project[k]=str?S_(r[1])||p.project[k]:n(r[1])});
  p.people=tbl(W,'Rank or grade','Headcount',r=>({rank:S_(r[0]),n:n(r[1]),shift:S_(r[2])==='Y'?'Y':'N',notes:S_(r[3])}),3)||[];
  p.spaces=tbl(pick(/spaces/i),'Space type','Name',r=>({type:S_(r[0]),name:S_(r[1]),qty:n(r[2]),seats:n(r[3]),area:n(r[4]),h24:S_(r[5])==='Y'?'Y':'N',zone:S_(r[6]),notes:S_(r[7])}),3)||[];
  p.servers=tbl(pick(/servers/i),'Room name','Racks',r=>({name:S_(r[0]),racks:n(r[1]),kw:n(r[2]),tkw:n(r[3]),red:S_(r[4])||'N',zone:S_(r[5]),notes:S_(r[6])}),3)||[];
  p.accom=tbl(pick(/accommodation/i),'Bed type','Beds',r=>({type:S_(r[0]),beds:n(r[1]),zone:S_(r[2]),notes:S_(r[3])}),3)||[];
  const Nm=pick(/norms/i);if(Nm){const a=tbl(Nm,'Rank or grade','Description',r=>({code:S_(r[0]),desc:S_(r[1]),ws:S_(r[2]),m2:n(r[3])}),0),b=tbl(Nm,'Space type','Unit',r=>({type:S_(r[0]),m2:n(r[2])||0,cap:S_(r[3])==='Y'?'Y':'N',zone:S_(r[4]),ht:n(r[6])}),0),c=tbl(Nm,'Bed type','Beds per room',r=>({type:S_(r[0]),per:n(r[1]),m2:n(r[2]),abl:n(r[3])}),0);if(a&&a.length)p.norms.ranks=a;if(b&&b.length)p.norms.types=b;if(c&&c.length)p.norms.beds=c;
    [['srv','rack',/white space per rack/i],['srv','kw',/plant area per kw/i],['srv','n1',/factor: n\+1/i],['srv','n2',/factor: 2n/i],['srv','n',/factor: n$/i],['bld','cap',/maximum area per person/i],['bld','circ',/circulation, as/i],['bld','circCap',/circulation counts/i,1],['bld','me',/m&e/i],['bld','core',/^core/i]].forEach(([g,k,re,str])=>{const r=Nm.find(x=>x&&re.test(S_(x[0])));if(r&&r[1]!=null)p.norms[g][k]=str?(S_(r[1])==='Y'?'Y':'N'):n(r[1])})}
  const Ru=tbl(pick(/code|rule|trigger/i),'Rule','Value',r=>({rule:S_(r[0]),src:/habitable/i.test(r[0])?'hh':/basement/i.test(r[0])?'basd':'st',th:n(r[2])||0,req:S_(r[4]),clause:S_(r[5]),code:S_(r[6]),chk:/not verified/i.test(S_(r[7]))?1:0}),0);if(Ru&&Ru.length)p.rules=Ru;
  return p}
const progBaseOf=p=>JSON.stringify({project:p.project,people:p.people,spaces:p.spaces,servers:p.servers,accom:p.accom,norms:p.norms,rules:p.rules});
async function progImportBuf(buf,name){const p=progFromSheets(await xlsxRead(buf));p.src=name||'requirements form';p.base=progBaseOf(p);checkpoint();S.prog=p;PROG.tmp=null;markDirty();progSync();const c=progCalc(p);toast(`Requirements read: ${c.pax} people, ${Math.round(c.gfa).toLocaleString()} m² GFA, ${c.st} storey${c.st>1?'s':''}`);progOpen('result');return c}
async function progImportFile(f){try{await progImportBuf(await f.arrayBuffer(),f.name)}catch(e){toast(e.message||String(e))}}
function progExportBlob(){const p=progGet(),c=progCalc(p),pj=p.project,R=Math.round,pc=v=>v==null?null:v;
  return xlsxWrite({'1 Project':[['1 Project'],['Exported from StoreyBook '+APP_VERSION+'. Values only: the guidance and formulas are in the blank form.'],[],['Question','Answer'],['Project name',pj.name],['New build or A&A',pj.type],['Site area',pc(pj.site)],['Maximum site coverage',pc(pj.cover)],['Height limit',pc(pj.hlimit)],['Floor-to-floor height',pc(pj.f2f)],['Storeys wanted',pc(pj.storeys)],['Basement levels',pc(pj.bas)],['Basement depth below average ground level',pc(pj.basd)],['Fire Code purpose group',pj.pg]],
    '2 People':[['2 People'],[],[],['Rank or grade','Headcount','Works a 24/7 shift (Y/N)','Notes','Workspace type','m² each','Area m²'],...p.people.map((r,i)=>[r.rank,r.n,r.shift,r.notes,c.people[i].ws,c.people[i].m2,c.people[i].area])],
    '3 Spaces':[['3 Spaces'],[],[],['Space type','Name','Quantity','Seats each','Area each, override m²','24/7 (Y/N)','Security zone','Notes','','Area each m²','Total area m²','Counts toward office cap'],...p.spaces.map((r,i)=>[r.type,r.name,r.qty,r.seats,r.area,r.h24,r.zone,r.notes,null,c.spaces[i].each,c.spaces[i].tot,c.spaces[i].cap])],
    '4 Servers':[['4 Servers'],[],[],['Room name','Racks','kW per rack','Total kW, override','Redundancy','Security zone','Notes','Total kW','White space m²','Plant m²'],...p.servers.map((r,i)=>[r.name,r.racks,r.kw,r.tkw,r.red,r.zone,r.notes,c.servers[i].tkw,c.servers[i].white,c.servers[i].plant])],
    '5 Accommodation':[['5 Accommodation'],[],[],['Bed type','Beds','Security zone','Notes','Rooms','Room area m²','Ablution area m²'],...p.accom.map((r,i)=>[r.type,r.beds,r.zone,r.notes,c.accom[i].rooms,c.accom[i].room,c.accom[i].abl])],
    '6 Norms':[['6 Norms'],[],['Rank or grade entitlements'],['Rank or grade','Description','Workspace type','m² each'],...p.norms.ranks.map(r=>[r.code,r.desc,r.ws,r.m2]),[],['Space types'],['Space type','Unit','m² per seat','Counts toward office cap (Y/N)','Default zone','Source','Floor-to-floor height m'],...p.norms.types.map(r=>[r.type,r.m2?'seat':'area only',r.m2,r.cap,r.zone,null,r.ht]),[],['Server rooms'],['Factor','Value'],['White space per rack, including aisles',p.norms.srv.rack],['Plant area per kW of IT load (UPS, switchgear, cooling)',p.norms.srv.kw],['Redundancy factor: N',p.norms.srv.n],['Redundancy factor: N+1',p.norms.srv.n1],['Redundancy factor: 2N',p.norms.srv.n2],[],['Accommodation (mechanically ventilated)'],['Bed type','Beds per room','Room m² per bed','Ablution m² per bed'],...p.norms.beds.map(r=>[r.type,r.per,r.m2,r.abl]),[],['Building factors'],['Factor','Value'],['Global office norm: maximum area per person',p.norms.bld.cap],['Circulation, as a share of net area',p.norms.bld.circ],['Circulation counts toward the office cap (Y/N)',p.norms.bld.circCap],['Base M&E plant, as a share of interior GFA',p.norms.bld.me],['Core, stairs and toilets, as a share of interior GFA',p.norms.bld.core]],
    '7 Code triggers':[['7 Code triggers'],[],[],['Rule','Value now','Threshold','Triggered','Requirement','Clause','Code and edition','Status'],...p.rules.map((r,i)=>[r.rule,c.rules[i].val,r.th,c.rules[i].trig,r.req,r.clause,r.code,r.chk?'NOT VERIFIED':''])],
    '8 Programme':[['8 Programme'],[],['Item','Value','Unit'],['Total headcount',c.pax,'pax'],['Headcount on 24/7 shift',c.pax24,'pax'],['Workspace area',R(c.work),'m²'],['Named spaces area',R(c.named),'m²'],['Server white space',R(c.white),'m²'],['Server plant',R(c.plant),'m²'],['Total IT load',R(c.kw),'kW'],['Accommodation area',R(c.acc),'m²'],['Net area',R(c.net),'m²'],['Circulation',R(c.circ),'m²'],['Interior GFA',R(c.gfa),'m²'],['Base M&E plant',R(c.me),'m²'],['Core, stairs and toilets',R(c.core),'m²'],['Area per person',Math.round(c.perPax*10)/10,'m² per pax'],['Cap',p.norms.bld.cap,'m² per pax'],['Storeys used',c.st,'storeys'],['Floor plate per storey',R(c.fp),'m²'],['Building height',Math.round(c.h*10)/10,'m'],['Norms changed in StoreyBook since import',progOver(p)?'Yes':'No']]})}
/* have the norms or code rules been changed in the app since the form came in? */
function progOver(p){if(!p.base)return false;const b=JSON.parse(p.base);return JSON.stringify(b.norms)!==JSON.stringify(p.norms)||JSON.stringify(b.rules)!==JSON.stringify(p.rules)}
const PROG_T={people:{add:{rank:'',n:null,shift:'N',notes:''},c:[['rank','Rank or grade','ranks'],['n','Headcount','n'],['shift','24/7 shift','yn'],['notes','Notes','t']],x:[['ws','Workspace'],['m2','m² each'],['area','Area m²']]},
  spaces:{add:{type:'',name:'',qty:1,seats:null,area:null,h24:'N',zone:'',notes:''},c:[['type','Space type','types'],['name','Name','t'],['qty','Qty','n'],['seats','Seats each','n'],['area','Area each, override','n'],['h24','24/7','yn'],['zone','Zone','zone'],['notes','Notes','t']],x:[['each','Area each'],['tot','Total m²'],['cap','In cap']]},
  servers:{add:{name:'',racks:null,kw:null,tkw:null,red:'N',zone:'',notes:''},c:[['name','Room name','t'],['racks','Racks','n'],['kw','kW per rack','n'],['tkw','Total kW, override','n'],['red','Redundancy','red'],['zone','Zone','zone'],['notes','Notes','t']],x:[['tkw','Total kW'],['white','White space m²'],['plant','Plant m²']]},
  accom:{add:{type:'',beds:null,zone:'',notes:''},c:[['type','Bed type','beds'],['beds','Beds','n'],['zone','Zone','zone'],['notes','Notes','t']],x:[['rooms','Rooms'],['room','Room m²'],['abl','Ablution m²']]},
  ranks:{nm:1,add:{code:'',desc:'',ws:'Open plan',m2:null},c:[['code','Rank or grade','t'],['desc','Description','t'],['ws','Workspace type','ws'],['m2','m² each','n']]},
  types:{nm:1,add:{type:'',m2:0,cap:'N',zone:'',ht:null},c:[['type','Space type','t'],['m2','m² per seat','n'],['cap','Counts toward cap','yn'],['zone','Default zone','zone'],['ht','Floor-to-floor (m), if taller','n']]},
  beds:{nm:1,add:{type:'',per:1,m2:null,abl:null},c:[['type','Bed type','t'],['per','Beds per room','n'],['m2','Room m² per bed','n'],['abl','Ablution m² per bed','n']]},
  rules:{nm:1,add:{rule:'',src:'st',th:0,req:'',clause:'',code:'',chk:1},c:[['rule','Rule','t'],['src','Measured by','src'],['th','Threshold','n'],['req','Requirement','t'],['clause','Clause','t'],['code','Code and edition','t']],x:[['val','Now'],['trig','Triggered']]}};
const PROG_F={project:[['name','Project name','t'],['type','New build or A&A','ptype'],['site','Site area (m²)','n'],['cover','Maximum site coverage (%)','pct'],['hlimit','Height limit (m)','n'],['f2f','Floor-to-floor height (m)','n'],['storeys','Storeys wanted (blank to work it out)','n'],['bas','Basement levels','n'],['basd','Basement depth below ground (m)','n'],['pg','Fire Code purpose group','pg']],
  srv:[['rack','White space per rack, including aisles (m²)','n'],['kw','Plant area per kW of IT load (m²)','n'],['n','Redundancy factor: N','n'],['n1','Redundancy factor: N+1','n'],['n2','Redundancy factor: 2N','n']],
  bld:[['cap','Global office norm: maximum m² per pax','n'],['circ','Circulation, share of net area (%)','pct'],['circCap','Circulation counts toward the office cap','yn'],['me','Base M&E plant, share of interior GFA (%)','pct'],['core','Core, stairs and toilets, share of interior GFA (%)','pct']]};
const progRows=(p,k)=>PROG_T[k]?(k==='rules'?p.rules:PROG_T[k].nm?p.norms[k]:p[k]):null,progObj=(p,k)=>k==='project'?p.project:p.norms[k];
function progUI(){const el=$('#prog-body');if(!el||$('#prog-modal').hidden)return;const p=progGet(),c=progCalc(p),base=p.base?JSON.parse(p.base):null,tab=PROG.tab,f1=v=>(Math.round(v*10)/10).toLocaleString(),f0=v=>Math.round(v).toLocaleString();
  const opts=ty=>ty==='ranks'?p.norms.ranks.map(r=>r.code):ty==='types'?p.norms.types.map(r=>r.type):ty==='beds'?p.norms.beds.map(r=>r.type):ty==='yn'?['Y','N']:ty==='zone'?['White','Green','Red','Black']:ty==='red'?['N','N+1','2N']:ty==='ws'?['Enclosed office','Open plan']:ty==='ptype'?['New Build','A&A']:ty==='pg'?['I','II','III','IV','V','VI','VII','VIII']:ty==='src'?[['hh','Habitable height (m)'],['basd','Basement depth (m)'],['st','Storeys']]:null;
  const cell=(k,i,f,lab,ty,v,bv,lock)=>{const o=opts(ty),shown=ty==='pct'&&v!=null&&v!==''?Math.round(v*1000)/10:v,chg=base&&bv!==undefined&&String(bv??'')!==String(v??''),a=`data-pk="${k}" data-pi="${i}" data-pf="${f}" data-py="${ty}" aria-label="${esc(lab)}"${lock?' disabled':''}${chg?` class="chg" title="In the imported form: ${esc(ty==='pct'&&bv!=null?Math.round(bv*1000)/10:bv??'blank')}"`:''}`;
    return o?`<select ${a}>${v==null||v===''||ty==='zone'?'<option value=""></option>':''}${o.map(x=>{const[val,tx]=Array.isArray(x)?x:[x,x];return`<option value="${esc(val)}"${String(v??'')===String(val)?' selected':''}>${esc(tx)}</option>`}).join('')}${v&&!o.some(x=>(Array.isArray(x)?x[0]:x)===v)?`<option selected>${esc(v)}</option>`:''}</select>`:`<input type="${ty==='t'?'text':'number'}" ${ty==='t'?'':'step="any" min="0" '}${a} value="${esc(shown??'')}">`};
  const table=(k,title)=>{const T=PROG_T[k],rows=progRows(p,k),br=base?(k==='rules'?base.rules:T.nm?base.norms[k]:base[k]):null,lock=T.nm&&!p.unlocked,cx=c[k];
    return`${title?`<h4>${title}</h4>`:''}<div class="prog-tw"><table class="prog-t"><thead><tr>${T.c.map(x=>`<th>${x[1]}</th>`).join('')}${(T.x||[]).map(x=>`<th class="x">${x[1]}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map((r,i)=>`<tr${br&&!br[i]?' class="new" title="Added in StoreyBook"':''}>${T.c.map(x=>`<td>${cell(k,i,x[0],x[1],x[2],r[x[0]],br?(br[i]?br[i][x[0]]:undefined):undefined,lock)}</td>`).join('')}${(T.x||[]).map(x=>{const v=cx&&cx[i]?cx[i][x[0]]:'';return`<td class="x${v==='Yes'||v==='Check'?' no':''}">${typeof v==='number'?f1(v):esc(v)}</td>`}).join('')}<td>${lock?'':`<button type="button" class="btn icon ghost sm" data-pg="del" data-pk="${k}" data-pi="${i}" aria-label="Remove row">✕</button>`}</td></tr>`).join('')||`<tr><td colspan="${T.c.length+(T.x||[]).length+1}" class="muted">Nothing here yet.</td></tr>`}</tbody></table></div>${lock?'':`<button type="button" class="btn sm" data-pg="add" data-pk="${k}">Add row</button>`}`};
  const fields=(k,title)=>{const o=progObj(p,k),bo=base?(k==='project'?base.project:base.norms[k]):null,lock=k!=='project'&&!p.unlocked;return`${title?`<h4>${title}</h4>`:''}<div class="prog-f">${PROG_F[k].map(x=>`<label><span>${x[1]}</span>${cell(k,0,x[0],x[1],x[2],o[x[0]],bo?bo[x[0]]:undefined,lock)}</label>`).join('')}</div>`};
  const over=progOver(p),lockBar=`<div class="prog-lock ${p.unlocked?'open':''}"><span>${p.unlocked?'Norms and code rules are unlocked. Changes here change every area and check.':'Norms and code rules are locked so they are not changed by accident.'}${p.ph?' These are placeholder figures, not MIG or PSM: import the form or enter the approved figures.':''}${over?' <b>Changed since the form was imported.</b>':''}</span><button type="button" class="btn sm" data-pg="${p.unlocked?'lock':'unlock'}">${p.unlocked?'Lock':'Unlock to edit'}</button></div>`;
  const trig=p.rules.map((r,i)=>c.rules[i].trig!=='No'?`<li class="${c.rules[i].trig==='Check'?'chk':''}"><b>${esc(r.rule)}</b> (${f1(c.rules[i].val)} against ${r.th}): ${esc(r.req)} <span class="muted">${esc(r.clause)}, ${esc(r.code)}${r.chk?' · not verified':''}</span></li>`:'').filter(Boolean);
  const line=(a,b,u,how)=>`<tr><td>${a}</td><td class="x">${b}</td><td>${u}</td><td class="muted">${how}</td></tr>`,st=(ok,y,n,none)=>ok==null?`<span class="muted">${none}</span>`:ok?`<span class="ok">${y}</span>`:`<span class="no">${n}</span>`;
  el.innerHTML=tab==='project'?fields('project'):tab==='norms'?lockBar+table('ranks','Rank or grade entitlements')+table('types','Space types')+fields('srv','Server rooms')+table('beds','Accommodation')+fields('bld','Building factors'):tab==='rules'?lockBar+table('rules')+'<p class="muted">Each rule is tested against the result. A rule marked not verified shows "Check" instead of "Yes".</p>'
    :tab==='result'?`<div class="prog-tw"><table class="prog-t res"><tbody>${line('Total headcount',f0(c.pax),'pax',c.pax24?f0(c.pax24)+' on a 24/7 shift':'')+line('Workspace area',f0(c.work),'m²','Headcount × rank entitlement')+line('Named spaces',f0(c.named),'m²','Seats × m² per seat, or the area typed')+line('Server white space',f0(c.white),'m²','Racks × m² per rack')+line('Accommodation',f0(c.acc),'m²',f0(c.beds)+' beds, rooms plus ablutions')+line('<b>Net area</b>','<b>'+f0(c.net)+'</b>','m²','The four lines above')+line('Circulation',f0(c.circ),'m²','Net × circulation share')+line('Server plant',f0(c.plant),'m²',f0(c.kw)+' kW × m² per kW × redundancy')+line('Base M&E plant',f0(c.me),'m²','GFA × M&E share')+line('Core, stairs, toilets',f0(c.core),'m²','GFA × core share')+line('<b>Interior GFA</b>','<b>'+f0(c.gfa)+'</b>','m²','(Net + circulation + server plant) ÷ (1 − M&E share − core share)')+line('Storeys',c.st,'',N0(p.project.storeys)?'As asked. '+(c.need?c.need+' needed for the site':''):c.need?'GFA ÷ the largest floor plate the site allows ('+f0(c.plate)+' m²), rounded up':'No site area entered')+line('Floor plate',f0(c.fp),'m²','GFA ÷ storeys')+line('Building height',f1(c.h),'m','Storeys × floor-to-floor. Habitable height about '+f1(c.hh)+' m')}</tbody></table></div>
      <div class="prog-chk"><div>Office norm: <b>${f1(c.perPax)}</b> m² per pax against ${p.norms.bld.cap}. ${st(c.capOk,'Within the cap','Over the cap','No headcount yet')}</div><div>Height: ${st(c.hOk,'Within the height limit','Over the height limit','No height limit entered')}</div><div>Site: ${st(c.siteOk,'Floor plate fits the site','Floor plate is larger than the site allows','No site area entered')}</div></div>
      <h4>Code rules triggered</h4>${trig.length?`<ul class="prog-tr">${trig.join('')}</ul>`:'<p class="muted">None.</p>'}${over?'<p class="no">Norms or code rules were changed in StoreyBook after the form was imported.</p>':''}`
    :tab==='stack'?(()=>{if(!c.rows)return'<p class="muted">Nothing to stack yet.</p>';const u=progBrief(p,c).rooms,pl=progPlan(p,c),s=pl.stack,fl=[...Array(c.st).keys()],adj=p.adj||[],sel=(i,f,v)=>`<select data-pa="${i}" data-pf="${f}" aria-label="Room type">${u.map(r=>`<option${r.name===v?' selected':''}>${esc(r.name)}</option>`).join('')}</select>`;
      return`<div class="prog-lock"><span id="prog-msg">${esc(PROG.msg||'StoreyBook suggests a stacking by rule: public rooms low, secure rooms high, an open office and a plant room on every floor. The AI can propose a better one, with reasons and adjacencies.')}</span><button type="button" class="btn sm" data-pg="${AI.busy?'stopai':'advise'}">${AI.busy?'Stop':'Ask AI for stacking and adjacencies'}</button></div>${p.advice?`<p class="prog-adv"><b>AI:</b> ${esc(p.advice)}</p>`:''}
      <h4>Which floor each room type goes on</h4><div class="prog-tw"><table class="prog-t"><thead><tr><th>Room type</th><th class="x">Qty</th><th class="x">m² each</th><th>Zone</th>${fl.map(f=>`<th class="x">L${f+1}</th>`).join('')}<th></th><th>Why</th></tr></thead><tbody>${u.map((r,i)=>{const row=(p.stack&&p.stack[r.name])||s.cnt[r.name],sum=row.reduce((a,b)=>a+(+b||0),0),own=!s.auto[r.name];return`<tr><td>${esc(r.name)}</td><td class="x">${r.qty}</td><td class="x">${f1(r.area)}</td><td>${esc(r.zone||'')}</td>${fl.map(f=>`<td><input type="number" min="0" step="1" data-ps="${i}" data-pf="${f}" value="${+row[f]||0}" aria-label="${esc(r.name)} on L${f+1}"${own?' class="chg" title="Set by you or the AI"':''}></td>`).join('')}<td class="${sum===r.qty?'x':'x no'}">${sum===r.qty?'':sum+' of '+r.qty}</td><td class="muted why">${esc(own&&p.why&&p.why[r.name]||'')}</td></tr>`}).join('')}<tr><td><b>Room area per floor</b></td><td></td><td></td><td></td>${fl.map(f=>`<td class="x${s.used[f]>s.T*1.25?' no':''}"><b>${f0(s.used[f])}</b> m²</td>`).join('')}<td></td><td class="muted">Target about ${f0(s.T)} m² a floor</td></tr></tbody></table></div><button type="button" class="btn sm" data-pg="restack">Use the rule-based stacking</button>
      <h4>Adjacencies</h4><p class="muted">Rooms that should be near each other are placed together in their row. Near means sharing a wall or facing across one corridor, on the same floor. The layout is straight rows, so not every wish can be met.</p><div class="prog-tw"><table class="prog-t"><thead><tr><th>Room type</th><th></th><th>Room type</th><th>Why</th><th>In the layout</th><th></th></tr></thead><tbody>${adj.map((a,i)=>`<tr><td>${sel(i,'a',a.a)}</td><td><select data-pa="${i}" data-pf="t" aria-label="Near or apart"><option value="near"${a.t==='near'?' selected':''}>near</option><option value="apart"${a.t==='apart'?' selected':''}>apart from</option></select></td><td>${sel(i,'b',a.b)}</td><td><input type="text" data-pa="${i}" data-pf="why" value="${esc(a.why||'')}" aria-label="Reason"></td><td>${pl.adj[i]?(pl.adj[i].ok?'<span class="ok">Met</span>':`<span class="no">Not met</span> <span class="muted">${esc(pl.adj[i].note)}</span>`):''}</td><td><button type="button" class="btn icon ghost sm" data-pg="adel" data-pi="${i}" aria-label="Remove adjacency">✕</button></td></tr>`).join('')||'<tr><td colspan="6" class="muted">None yet.</td></tr>'}</tbody></table></div><button type="button" class="btn sm" data-pg="aadd">Add adjacency</button>`})()
    :table(tab);
  $$('#prog-tabs button').forEach(b=>{const on=b.dataset.pt===tab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});
  $('#prog-src').textContent=p.src?'from '+p.src:S.prog?'entered in StoreyBook':'nothing entered yet';
  $('#prog-sum').innerHTML=c.rows?`<b>${f0(c.gfa)}</b> m² GFA · <b>${c.st}</b> storey${c.st>1?'s':''} · ${f1(c.perPax)} m² per pax ${c.capOk===false?'<span class="no">over the cap</span>':''}${trig.length?` · <span class="no">${trig.length} code rule${trig.length>1?'s apply':' applies'}</span>`:''}`:'Import the requirements form, or fill in the tabs.';
  const k=c.rows&&S.brief?briefCheck():null,has=c.rows&&planHasRooms(),ask=$('#prog-ask');ask.hidden=!has||!k||!k.fails.length;$('#prog-build').hidden=!c.rows;$('#prog-build').textContent=has?'Build again in a new tab':'Build the building';
  $('#prog-st').textContent=!c.rows?'':has?(k&&k.fails.length?`The drawing does not meet ${k.fails.length} of ${k.n} brief items.`:'The drawing meets the brief.'):'Nothing drawn yet.'}
const N0=v=>+v>0?+v:0;
function progOpen(tab){closePops();if(typeof tab==='string')PROG.tab=tab;$('#prog-modal').hidden=false;progUI()}
function progEdit(fn){checkpoint();if(!S.prog){S.prog=PROG.tmp||progDefault();PROG.tmp=null}fn(S.prog);markDirty();progSync();progUI()}
function progAskAI(){const b=S.brief;if(!b)return;const k=briefCheck(),has=planHasRooms();if(!has)return progBuild();$('#prog-modal').hidden=true;aiOpen();
  aiSend(`The requirements changed. Update the plan so it meets the brief again. Change as little as possible: keep rooms that still fit, resize or add only what is needed, and keep every name as the brief has it.\nNot met now:\n- ${k.fails.join('\n- ')}\nBrief:\n${JSON.stringify({floors:b.floors,rooms:b.rooms,notes:b.notes})}`,'Update the layout to the changed requirements')}
if($('#prog-modal')){
  $('#prog-tabs').innerHTML=[['project','Project'],['people','People'],['spaces','Spaces'],['servers','Servers'],['accom','Accommodation'],['result','Result'],['stack','Stacking'],['norms','Norms'],['rules','Code rules']].map(t=>`<button type="button" role="tab" data-pt="${t[0]}">${t[1]}</button>`).join('');
  $('#prog-modal').addEventListener('click',e=>{const t=e.target;const tb=t.closest('[data-pt]');if(tb){PROG.tab=tb.dataset.pt;progUI();return}const b=t.closest('[data-pg]');if(!b)return;const a=b.dataset.pg,k=b.dataset.pk;
    if(a==='close')$('#prog-modal').hidden=true;else if(a==='import')$('#prog-file').click();else if(a==='export')download((progGet().project.name||S.name||'Requirements').replace(/[\\/:*?"<>|]+/g,' ').trim()+' requirements.xlsx',progExportBlob());
    else if(a==='ask')progAskAI();else if(a==='build')progBuild();else if(a==='restack')progEdit(p=>{delete p.stack;delete p.why;delete p.advice})
    else if(a==='advise')progAdvise();else if(a==='stopai'){if(AI.ctrl)AI.ctrl.abort()}else if(a==='adel')progEdit(p=>{(p.adj||[]).splice(+b.dataset.pi,1)});else if(a==='aadd')progEdit(p=>{const u=progBrief(p,progCalc(p)).rooms;if(u.length>1)(p.adj=p.adj||[]).push({a:u[0].name,b:u[1].name,t:'near',why:''})});else if(a==='add')progEdit(p=>progRows(p,k).push(Object.assign({},PROG_T[k].add)));else if(a==='del')progEdit(p=>progRows(p,k).splice(+b.dataset.pi,1));
    else if(a==='lock')progEdit(p=>{p.unlocked=false});else if(a==='unlock'){if(confirm('Unlock the norms and code rules?\n\nThey are policy figures. Changing them changes every area and every check in this plan, and the plan is marked as changed from the imported form.'))progEdit(p=>{p.unlocked=true})}});
  $('#prog-modal').addEventListener('change',e=>{const t=e.target,k=t.dataset.pk,f=t.dataset.pf,ty=t.dataset.py;if(t.id==='prog-file'){if(t.files[0])progImportFile(t.files[0]);t.value='';return}if(t.dataset.pa!=null){progEdit(p=>{const a=(p.adj||[])[+t.dataset.pa];if(a)a[f]=f==='why'?t.value.trim().slice(0,160):t.value});return}if(t.dataset.ps!=null){progEdit(p=>{const c=progCalc(p),u=progBrief(p,c).rooms,r=u[+t.dataset.ps];if(!r)return;const row=((p.stack&&p.stack[r.name])||progStack(p,c,u).cnt[r.name]).slice();row[+f]=Math.max(0,Math.round(+t.value||0));(p.stack=p.stack||{})[r.name]=row;if(p.why)delete p.why[r.name]});return}if(!k||!f)return;
    const v=ty==='t'?t.value.trim().slice(0,200):ty==='n'||ty==='pct'?(t.value===''||!isFinite(+t.value)||+t.value<0?null:ty==='pct'?Math.min(+t.value,95)/100:Math.min(+t.value,1e7)):t.value;
    progEdit(p=>{if(PROG_T[k]){const r=progRows(p,k)[+t.dataset.pi];if(r)r[f]=v}else{progObj(p,k)[f]=v;if(k!=='project')p.ph=false}if(PROG_T[k]&&PROG_T[k].nm)p.ph=false})})}

/* ================= boot ================= */
window.addEventListener('resize',()=>{resize();render()});
/* re-measure whenever the drawing area changes size (tab bar, panels, window), so clicks always land where things are drawn */
if(window.ResizeObserver)new ResizeObserver(()=>{resize();render()}).observe(svg);
if(PHONE()){P.lib=false;P.insp=false}
applyTheme();applyDrawers();renderLib();
/* ================= cameras ================= */
/* what a camera can see on plan: rays across its field of view, each stopped by the first wall or column */
function cctvPoly(o,runs){runs=runs||wallRuns();const segs=runs.map(r=>[r.a,r.b]);
  S.objs.forEach(c=>{if(isCol(c)&&visible(c)){const q=toW(c,rectP(-c.w/2,-c.d/2,c.w/2,c.d/2));for(let i=0;i<4;i++)segs.push([q[i],q[(i+1)%4]])}});
  const R=o.range||15000,f=(o.fov||90)*Math.PI/180,a0=((o.r||0)+90)*Math.PI/180-f/2,n=Math.max(12,Math.round((o.fov||90)/1.5));const pts=[[o.x,o.y]];
  for(let i=0;i<=n;i++){const a=a0+f*i/n,dx=Math.cos(a),dy=Math.sin(a);let t=R;
    segs.forEach(([p,q])=>{const ex=q[0]-p[0],ey=q[1]-p[1],den=dx*ey-dy*ex;if(Math.abs(den)<1e-9)return;const wx=p[0]-o.x,wy=p[1]-o.y;const u=(wx*ey-wy*ex)/den,v=(wx*dy-wy*dx)/den;if(u>60&&u<t&&v>=0&&v<=1)t=u});
    pts.push([o.x+dx*t,o.y+dy*t])}
  return pts}
/* the camera's own picture: the 3D scene rendered from the lens. Past 120° it is stitched from 2 or 3 views side by side */
let povT=null;function schedulePOV(){clearTimeout(povT);povT=setTimeout(renderPOV,120)}
function renderPOV(){const cv=$('#cctv-pov');if(!cv)return;const o=selList()[0];if(!isCCTV(o))return;const g2=cv.getContext('2d');
  const note=t=>{g2.fillStyle='#1b2026';g2.fillRect(0,0,cv.width,cv.height);g2.fillStyle='#c9d1d9';g2.font='13px sans-serif';g2.textAlign='center';g2.fillText(t,cv.width/2,cv.height/2)};
  if(bldView)return note('Open the floor in 2D or 3D to see the camera view');
  if(!T3&&!(window.THREE&&window.THREE.OrbitControls)){note('Loading 3D…');ensureThree().then(()=>schedulePOV()).catch(()=>note('3D is not available here'));return}
  try{if(!T3)init3D()}catch(e){return note('3D is not available here')}
  const{THREE,renderer:R,scene,group}=T3,s=0.001;
  if(!is3D){const keep=P.wall3d;P.wall3d='full';T3.framed=true;build3D();P.wall3d=keep}
  const me=group.children.filter(c=>c.userData.id===o.id);me.forEach(c=>c.visible=false);
  const ceil=S.bld?lvVal(S.bld,bldLevel(S),'ceiling'):2800,y=(ceil-(o.drop||0)-(o.h||100)*0.6)*s;
  const cam=T3.povCam||(T3.povCam=new THREE.PerspectiveCamera(60,1.6,0.05,200));const fov=o.fov||90,k=fov>120?Math.ceil(fov/90):1,slice=fov/k,tilt=(o.tilt||0)*Math.PI/180,base=((o.r||0)+90)*Math.PI/180;
  const sz=R.getSize(new THREE.Vector2()),pr=R.getPixelRatio();const W=cv.width,H=cv.height;R.setPixelRatio(1);R.setSize(W,H,false);R.setScissorTest(true);
  for(let i=0;i<k;i++){const x0=Math.floor(i*W/k),w=Math.floor((i+1)*W/k)-x0;R.setViewport(x0,0,w,H);R.setScissor(x0,0,w,H);
    cam.aspect=w/H;cam.fov=2*Math.atan(Math.tan(slice*Math.PI/360)/cam.aspect)*180/Math.PI;cam.updateProjectionMatrix();
    const a=base+(-fov/2+slice*(i+0.5))*Math.PI/180;cam.position.set(o.x*s,y,o.y*s);cam.up.set(0,1,0);cam.lookAt(o.x*s+Math.cos(a)*Math.cos(tilt),y-Math.sin(tilt),o.y*s+Math.sin(a)*Math.cos(tilt));R.render(scene,cam)}
  R.setScissorTest(false);g2.drawImage(R.domElement,0,0,W,H,0,0,W,H);
  me.forEach(c=>c.visible=true);R.setPixelRatio(pr);R.setViewport(0,0,sz.x,sz.y);if(is3D)size3D();else R.setSize(sz.x,sz.y,false);
  g2.fillStyle='rgba(0,0,0,.55)';g2.fillRect(0,H-22,W,22);g2.fillStyle='#fff';g2.font='12px sans-serif';g2.textAlign='left';g2.fillText(`${o.label||o.name} · ${Math.round(fov)}° · tilt ${Math.round(o.tilt||0)}°${k>1?` · ${k} views stitched`:''}`,8,H-7);
  if(k>1){g2.strokeStyle='rgba(255,255,255,.35)';for(let i=1;i<k;i++){const x=Math.floor(i*W/k)+0.5;g2.beginPath();g2.moveTo(x,0);g2.lineTo(x,H-22);g2.stroke()}}}

/* ================= windows: wall segments, façade fill ================= */
/* every wall run on this floor (room edges with walls, drawn walls), deduplicated */
function wallRuns(only,mode){const m=new Map(),key=p=>Math.round(p[0]/5)+','+Math.round(p[1]/5),curves=[];const add=(a,b,t,src,minL)=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<(minL||200))return;const k1=key(a)+'|'+key(b),k2=key(b)+'|'+key(a);if(m.has(k1)||m.has(k2))return;m.set(k1,{a,b,t,L,src})};
  S.objs.forEach(o=>{if(only&&!only.includes(o))return;if(o.t==='room'&&!o.nowall)o.pts.forEach((p,i)=>add(p,o.pts[(i+1)%o.pts.length],Math.max(P.wall||0,60),o));else if(o.t==='wall'&&!o.site){const t=Math.max(o.th||0,40);
    /* a curved side is one run for windows (placed along its length) and many short straight pieces for snapping and sight lines */
    const curve=q=>{if(mode==='fill'){const L=polyLen(q);if(L>=300)curves.push({poly:q,a:q[0],b:q.at(-1),t,L,src:o,curve:true})}else for(let k=0;k<q.length-1;k++)add(q[k],q[k+1],t,o,20)};
    if(o.spline){const q=splinePts(o.pts||[],o.closed);curve(o.closed&&q.length>2?q.concat([q[0]]):q)}
    else rawSegs(o).forEach(([a,b,i])=>{const h=segBulge(o,i);if(h)curve(arcPoints(a,b,h));else add(a,b,t,o)})}});return[...m.values()].concat(curves)}
function wallAt(p,tol){let best=null;wallRuns().forEach(r=>{const ux=(r.b[0]-r.a[0])/r.L,uy=(r.b[1]-r.a[1])/r.L,dx=p[0]-r.a[0],dy=p[1]-r.a[1],al=dx*ux+dy*uy;if(al<-50||al>r.L+50)return;const pd=Math.abs(-dx*uy+dy*ux);if(pd<tol&&(!best||pd<best.pd))best=Object.assign({},r,{along:al,pd})});return best}
/* a run faces outside when one side is inside the floor outline and the other is not */
function runIsOutside(r,plates){if(r.curve){const q=r.poly,k=Math.max(0,Math.floor(q.length/2)-1),a=q[k],b=q[k+1]||q[k];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1)return false;return runIsOutside({a,b,t:r.t,L},plates)}const ux=(r.b[0]-r.a[0])/r.L,uy=(r.b[1]-r.a[1])/r.L,off=r.t/2+300;const mid=[(r.a[0]+r.b[0])/2,(r.a[1]+r.b[1])/2];
  const inside=q=>plates.some(pl=>pointInPoly(q[0],q[1],pl));let n=0,out=0;[0.25,0.5,0.75].forEach(f=>{const c=[r.a[0]+(r.b[0]-r.a[0])*f,r.a[1]+(r.b[1]-r.a[1])*f];const A=inside([c[0]-uy*off,c[1]+ux*off]),B=inside([c[0]+uy*off,c[1]-ux*off]);if(A!==B)out++;n++});return out>=2}
const WIN_DEF={type:'win',w:1500,gap:600,sill:900,h:1500,margin:300,outside:true};
const winSpec=()=>Object.assign({},WIN_DEF,P.win||{});
function winForm(scope){const W=winSpec();return`<div class="fld winf" data-scope="${scope}"><label class="full">Type<select data-w="type"><option value="win"${W.type==='win'?' selected':''}>Windows with a sill</option><option value="full"${W.type==='full'?' selected':''}>Full-height glazing, floor to ceiling</option></select></label>
  <label>Width each (mm)<input type="number" data-w="w" value="${W.w}"></label><label>Gap between (mm)<input type="number" data-w="gap" value="${W.gap}"></label>
  ${W.type==='full'?'':`<label>Sill height (mm)<input type="number" data-w="sill" value="${W.sill}"></label><label>Glass height (mm)<input type="number" data-w="h" value="${W.h}"></label>`}
  <label>Keep clear of corners (mm)<input type="number" data-w="margin" value="${W.margin}"></label>${scope==='sel'?`<label style="display:flex;align-items:center;gap:6px;color:var(--ink)"><input type="checkbox" data-w="outside" style="width:auto"${W.outside?' checked':''}> Outside walls only</label>`:'<span></span>'}</div>`}
function readWinForm(box){const W=winSpec();box.querySelectorAll('[data-w]').forEach(i=>{const k=i.dataset.w;if(k==='type')W.type=i.value;else if(k==='outside')W.outside=i.checked;else{const v=num(i.value,NaN);if(isFinite(v)&&v>=0)W[k]=v}});W.w=Math.max(300,W.w);P.win=W;savePrefs();return W}
function makeWindow(W,c,ang,t){const full=W.type==='full';const li=LIB.find(l=>l.shape==='window'&&Math.abs(l.w-W.w)<1&&(full?!(l.h>0):l.h>0));
  return{id:uid(),t:'item',code:li?li.code:(full?'FG':'WN')+Math.round(W.w),name:li&&(full?!(li.h>0):(li.h===W.h&&li.a===W.sill))?li.name:(full?'Full-height glazing ':'Window ')+Math.round(W.w),cat:'Window',shape:'window',w:W.w,d:Math.max(60,t),h:full?0:W.h,sill:full?0:W.sill,a:0,seats:0,cf:0,cb:0,nests:false,rate:li?li.rate:null,pts:null,x:Math.round(c[0]),y:Math.round(c[1]),r:Math.round(ang*10)/10,gid:null,label:''}}
/* fill wall runs with evenly spaced windows; replaces windows already on those runs and keeps clear of doors */
function fillWindows(runs,W){const added=[],removed=new Set();const opens=S.objs.filter(isOpening);
  runs.forEach(r=>{if(r.curve){/* along a curve: same spacing, measured along the wall, each window turned to the curve */
      const q=r.poly,blocked=[];opens.forEach(o=>{const pr=polyProj(q,[o.x,o.y]);if(pr.d>r.t/2+(o.d||100)+60)return;if(isWin(o)){removed.add(o.id);return}blocked.push([pr.s-o.w/2-150,pr.s+o.w/2+150])});
      blocked.push([-1e9,W.margin],[r.L-W.margin,1e9]);blocked.sort((p,q2)=>p[0]-q2[0]);let cur=-1e9;const free=[];blocked.forEach(([b0,b1])=>{if(b0>cur)free.push([cur,b0]);cur=Math.max(cur,b1)});
      free.forEach(([f0,f1])=>{f0=Math.max(f0,0);f1=Math.min(f1,r.L);const len=f1-f0;const n=Math.floor((len+W.gap)/(W.w+W.gap));if(n<1)return;const tot=n*W.w+(n-1)*W.gap;let x=f0+(len-tot)/2+W.w/2;
        for(let k=0;k<n;k++){const at=polyAt(q,x);added.push(makeWindow(W,at.p,at.ang*180/Math.PI,r.t));x+=W.w+W.gap}});return}const ux=(r.b[0]-r.a[0])/r.L,uy=(r.b[1]-r.a[1])/r.L;const loc=o=>{const dx=o.x-r.a[0],dy=o.y-r.a[1];return{al:dx*ux+dy*uy,pd:Math.abs(-dx*uy+dy*ux)}};
    const blocked=[];opens.forEach(o=>{const q=loc(o);if(q.pd>r.t/2+(o.d||100)+60||q.al<-o.w/2||q.al>r.L+o.w/2)return;if(isWin(o)){removed.add(o.id);return}blocked.push([q.al-o.w/2-150,q.al+o.w/2+150])});
    blocked.push([-1e9,W.margin],[r.L-W.margin,1e9]);blocked.sort((p,q)=>p[0]-q[0]);
    /* free stretches between doors and the corners */
    let cur=-1e9;const free=[];blocked.forEach(([b0,b1])=>{if(b0>cur)free.push([cur,b0]);cur=Math.max(cur,b1)});
    free.forEach(([f0,f1])=>{f0=Math.max(f0,0);f1=Math.min(f1,r.L);const len=f1-f0;const n=Math.floor((len+W.gap)/(W.w+W.gap));if(n<1)return;const tot=n*W.w+(n-1)*W.gap;let x=f0+(len-tot)/2+W.w/2;
      for(let k=0;k<n;k++){added.push(makeWindow(W,[r.a[0]+ux*x,r.a[1]+uy*x],Math.atan2(uy,ux)*180/Math.PI,r.t));x+=W.w+W.gap}})});
  return{added,removed}}
function runWindowFill(scope,box){const W=readWinForm(box);let runs;
  if(scope==='sel'){const l=selList().filter(o=>(o.t==='wall'&&!o.site)||o.t==='room');if(!l.length)return toast('Select a wall or a room first');runs=wallRuns(l,'fill')}else runs=wallRuns(null,'fill');
  if((scope!=='sel'||W.outside)){const pl=floorPlate();runs=runs.filter(r=>runIsOutside(r,pl))}
  if(!runs.length)return toast(scope==='sel'?'No outside walls in the selection. Untick Outside walls only to use every wall.':'No outside walls found on this floor');
  const{added,removed}=fillWindows(runs,W);if(!added.length&&!removed.size)return toast('The walls are too short for windows this wide');
  checkpoint();S.objs=S.objs.filter(o=>!removed.has(o.id)).concat(added);clashDirty=true;render();renderInspector();renderBldPanel();schedule3D();
  const b=S.bld,shared=b&&!bldLevel(S).unique?b.levels.filter(l=>!l.unique).length:1;
  toast(`${added.length} ${W.type==='full'?'glazing panels':'windows'} added on ${runs.length} wall${runs.length>1?'s':''}${removed.size?`, ${removed.size} old ones replaced`:''}${shared>1?` · on all ${shared} typical floors`:''}`)}
function removeAllWindows(){const n=S.objs.filter(isWin).length;if(!n)return toast('No windows on this floor');checkpoint();S.objs=S.objs.filter(o=>!isWin(o));clashDirty=true;render();renderInspector();renderBldPanel();schedule3D();toast(`${n} windows removed`)}
document.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.w==='type'){const box=t.closest('.winf');readWinForm(box);const host=box.parentElement;box.outerHTML=winForm(box.dataset.scope)}});

/* ================= column grid ================= */
const gridLetter=i=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ';return i<A.length?A[i]:A[Math.floor(i/A.length)-1]+A[i%A.length]};
/* '7200 x 5, 8400' -> [7200,7200,7200,7200,7200,8400]; small numbers are read as metres */
function parseBays(t){const out=[];String(t||'').replace(/×/g,'x').split(/[,;]+/).forEach(p=>{const m=/^\s*(\d+(?:\.\d+)?)\s*(?:[x*]\s*(\d+))?\s*$/i.exec(p);if(!m)return;let v=+m[1];if(v<100)v*=1000;const n=Math.min(60,+(m[2]||1));for(let i=0;i<n;i++)out.push(Math.round(v))});return out.filter(v=>v>=500)}
function gridDefaults(){const pts=[];S.objs.forEach(o=>{if(o.t==='room'||(o.t==='wall'&&!o.site))o.pts.forEach(p=>pts.push(p))});const b=pts.length?bboxPts(pts):{x0:0,y0:0};return{xs:'7200 x 5',ys:'7200 x 3',ox:Math.round(b.x0),oy:Math.round(b.y0),size:600,round:false,cols:true,inside:true}}
function gridForm(){const G=Object.assign(gridDefaults(),S.bld.gridSpec||{});return`<div class="fld grf"><label class="full">Bays across, left to right (mm)<input type="text" data-g="xs" value="${esc(G.xs)}" placeholder="7200 x 5, 8400"></label><label class="full">Bays down, top to bottom (mm)<input type="text" data-g="ys" value="${esc(G.ys)}" placeholder="7200 x 3"></label>
  <label>Grid 1 / A at X (mm)<input type="number" data-g="ox" value="${G.ox}"></label><label>Y (mm)<input type="number" data-g="oy" value="${G.oy}"></label><label>Column size (mm)<input type="number" data-g="size" value="${G.size}"></label><label style="display:flex;align-items:flex-end;gap:6px;color:var(--ink)"><input type="checkbox" data-g="round" style="width:auto"${G.round?' checked':''}> Round</label>
  <label style="display:flex;align-items:center;gap:6px;color:var(--ink)"><input type="checkbox" data-g="cols" style="width:auto"${G.cols?' checked':''}> Place columns</label><label style="display:flex;align-items:center;gap:6px;color:var(--ink)"><input type="checkbox" data-g="inside" style="width:auto"${G.inside?' checked':''}> Only inside the building</label></div>`}
function readGrid(box){const G=Object.assign(gridDefaults(),S.bld.gridSpec||{});box.querySelectorAll('[data-g]').forEach(i=>{const k=i.dataset.g;if(i.type==='checkbox')G[k]=i.checked;else if(k==='xs'||k==='ys')G[k]=i.value;else{const v=num(i.value,NaN);if(isFinite(v))G[k]=v}});G.size=Math.max(150,G.size);return G}
function applyGrid(G){const xs=parseBays(G.xs),ys=parseBays(G.ys);if(!xs.length||!ys.length)return toast('Enter the bays as sizes in mm, like 7200 x 5, 8400');
  const X=[G.ox],Y=[G.oy];xs.forEach(v=>X.push(X.at(-1)+v));ys.forEach(v=>Y.push(Y.at(-1)+v));checkpoint();
  const b=S.bld;b.gridSpec=G;b.grid={X,Y};
  /* the grid's own columns are replaced; columns traced from a drawing stay, and the grid skips points they already hold */
  S.objs=S.objs.filter(o=>!(o.t==='item'&&o.bldCol));b.cores=(b.cores||[]).filter(o=>!o.bldCol);let n=0;
  if(G.cols){const pl=G.inside?floorPlate():[];const have=S.objs.filter(isCol);
    X.forEach(x=>Y.forEach(y=>{if(G.inside&&pl.length&&!pl.some(p=>pointInPoly(x,y,p)))return;if(have.some(c=>Math.hypot(c.x-x,c.y-y)<Math.max(300,c.w/2)))return;const c=makeColumn(G.round,G.size,G.size,x,y);c.bldCol=true;S.objs.push(c);n++}))}
  clashDirty=true;markDirty();render();renderBldPanel();schedule3D();toast(`Grid ${X.length} x ${Y.length} set${n?`, ${n} columns placed on every floor`:''}`)}
function removeGrid(){const b=S.bld;if(!b.grid&&!S.objs.some(o=>o.bldCol))return toast('No column grid yet');checkpoint();delete b.grid;S.objs=S.objs.filter(o=>!(o.t==='item'&&o.bldCol));b.cores=(b.cores||[]).filter(o=>!o.bldCol);clashDirty=true;markDirty();render();renderBldPanel();schedule3D();toast('Column grid and its columns removed')}

/* ================= floors: switching, panel, copy fit-out ================= */
let roofMode=false,roofRefObjs=[],roofStash=null;
function topLevel(){const b=S.bld,ls=b.levels.filter(l=>l.kind!=='B');return ls[ls.length-1]||b.levels[b.levels.length-1]}
function enterRoof(){if(roofMode)return;ensureBld(S);if(WALK.on)walkStop(true);syncFloorOut(S);const b=S.bld,tl=topLevel();
  roofRefObjs=bldObjs(tl).filter(o=>(o.t==='wall'&&!o.site)||o.t==='room');
  roofMode=true;S.objs=clone(b.roofFit||[]);sel.clear();secSel=false;pinSel=null;clashDirty=true;
  if(tool!=='select'&&tool!=='place')setTool('select');if(is3D)bldView=true;renderFloorUI();render();renderInspector();if(is3D&&T3){$('#v3d').classList.toggle('on',false);$('#vbld').classList.toggle('on',true);$('#main').classList.toggle('bldmode',true);build3D()}toast('Roof — place plant & M&E (condensers, AHUs…). The grey outline is the building below.')}
function saveRoof(){if(S&&S.bld)S.bld.roofFit=clone(S.objs.filter(o=>o.t==='item'))}
function exitRoof(){if(!roofMode)return;saveRoof();roofMode=false;roofRefObjs=[];syncFloorIn(S);sel.clear();clashDirty=true}
function switchFloor(id,keepWalk){ensureBld(S);const b=S.bld;
  if(id==='roof'){if(roofMode)switchFloor(b.active);else enterRoof();return}
  if(roofMode){exitRoof();if(id===b.active){render();renderInspector();renderFloorUI();if(is3D&&T3)build3D();return}}
  if(id===b.active){renderFloorUI();return}const from=bldLevel(S),to=b.levels.find(l=>l.id===id);if(!to)return;
  if(WALK.on&&!keepWalk)walkStop(true);WALK.roof=false;if(tool!=='select')setTool('select');syncFloorOut(S);
  b.active=id;syncFloorIn(S);sel.clear();clashDirty=true;
  render();renderInspector();renderFloorUI();autosave();if(is3D&&T3)build3D();toast(keepWalk?`Now on ${levelNames(b)[id]}`:`${levelNames(b)[id]} opened${to.unique?' (unique layout)':' (typical layout)'}`)}
function stepFloor(d){ensureBld(S);const L=S.bld.levels,i=L.indexOf(bldLevel(S)),j=i+d;if(j<0||j>=L.length)return toast(d>0?'This is the top floor':'This is the lowest floor');switchFloor(L[j].id)}
function renderFloorUI(){if(!S)return;ensureBld(S);const b=S.bld,l=bldLevel(S),nm=levelNames(b);const others=b.levels.filter(x=>!x.unique&&x!==l).length;
  const chip=$('#b-floor');if(chip&&roofMode){chip.innerHTML=`<b>Roof</b><span class="fl-tag">plant</span>▾`;chip.title='Roof level — plant and M&E equipment';if(!$('#p-bld').hidden)renderBldPanel();if(!$('#pop-floor').hidden)renderFloorPop();renderBldBar();return}
  if(chip){chip.innerHTML=`<b>${nm[l.id]}</b><span class="fl-tag">${l.unique?'unique':(b.levels.length>1?'typical':'')}</span>▾`;chip.title=l.unique?`${nm[l.id]} has its own walls, doors and rooms`:(others?`${nm[l.id]} uses the typical layout. Walls, doors and rooms you change here also change on ${b.levels.filter(x=>!x.unique&&x!==l).map(x=>nm[x.id]).join(', ')}.`:`${nm[l.id]}`)}
  if(!$('#p-bld').hidden)renderBldPanel();if(!$('#pop-floor').hidden)renderFloorPop();renderBldBar()}
function renderFloorPop(){/* a plan that arrived without a building (cleared data, an odd file) gets the default one rather than an error */if(!S.bld||!Array.isArray(S.bld.levels)||!S.bld.levels.length)ensureBld(S);const b=S.bld,nm=levelNames(b),act=bldLevel(S);
  $('#pop-floor').innerHTML=`<button class="mi${roofMode?' on':''}" type="button" data-fl="roof"><b style="min-width:34px;display:inline-block">Roof</b><span class="muted" style="font-size:12px">plant & M&E · ${(b.roofFit||[]).filter(o=>o.t==='item').length} items</span></button>`+b.levels.slice().reverse().map(l=>`<button class="mi${!roofMode&&l===act?' on':''}" type="button" data-fl="${l.id}"><b style="min-width:34px;display:inline-block">${nm[l.id]}</b><span class="muted" style="font-size:12px">${l.unique?'unique':'typical'} · ${(l.fit||[]).filter(o=>o.t==='item').length} items</span></button>`).join('')+
    `<div style="border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><button class="mi" type="button" data-fl="__manage">Manage floors and heights…</button></div>`}
let copyFrom=null;
function renderBldPanel(){const el=$('#p-bld');if(!el||el.hidden)return;if(el.contains(document.activeElement)&&document.activeElement.tagName==='INPUT')return;
  ensureBld(S);const b=S.bld,nm=levelNames(b),st=levelStack(b),act=bldLevel(S);const top=st[st.length-1];const height=(top.ffl+top.ftf+ +b.parapet)/1000;
  const fld=(k,lab)=>`<label>${lab}<input type="number" data-bk="${k}" value="${b[k]}"></label>`;
  let h=`<p class="big">Building</p><p class="muted">${b.levels.filter(l=>l.kind!=='B').length} floors${b.levels.some(l=>l.kind==='B')?` + ${b.levels.filter(l=>l.kind==='B').length} basement${b.levels.filter(l=>l.kind==='B').length>1?'s':''}`:''} · ${height.toFixed(1)} m from L1 to top of parapet</p>
  <div class="sec">Orientation</div><div class="fld"><label>North, ° clockwise from up <input type="number" id="bld-north" min="0" max="359" step="5" value="${num(S.north,0)}"></label><label>&nbsp;<button class="btn sm" type="button" id="bld-north-up">North up</button></label></div><p class="muted">Drag the arrow on the plan to rotate it. The sun study and the PNG export use this.</p>
  <div class="sec">Defaults for every floor (mm)</div><div class="fld">${fld('ceiling','Floor to ceiling')}${fld('void','Ceiling void')}${fld('slab','Slab')}${fld('slabB1','B1 to L1 slab')}${fld('roofSlab','Roof slab')}${fld('parapet','Parapet')}</div>
  <div class="sec">Floors</div><div class="row"><button class="btn sm primary" type="button" data-bb="addL">+ Floor on top</button><button class="btn sm" type="button" data-bb="addB">+ Basement</button></div>`;
  b.levels.slice().reverse().forEach(l=>{const i=b.levels.indexOf(l),r=st[i];const ph=k=>k==='slab'?slabAbove(Object.assign({},b,{levels:b.levels.map(x=>x===l?Object.assign({},x,{slab:null}):x)}),i):b[k];
    h+=`<div class="lvl${l===act?' on':''}" draggable="${TOUCH?'false':'true'}" data-lvid="${l.id}"><div class="lvl-h"><span class="lvl-grip" title="Drag to reorder">⠿</span> <b>${nm[l.id]}</b><span class="muted">FFL ${(r.ffl/1000>=0?'+':'')}${(r.ffl/1000).toFixed(2)} m · ${(r.ftf/1000).toFixed(2)} m floor to floor</span><span class="badge${l.unique?' u':''}">${l.unique?'Unique':'Typical'}</span></div>
    <div class="fld3" style="grid-template-columns:repeat(auto-fit,minmax(92px,1fr))"><label>Floor to floor<input type="number" data-lv="${l.id}" data-k="ftf" value="${r1(r.ftf)}" step="100"></label><label>Ceiling<input type="number" data-lv="${l.id}" data-k="ceiling" value="${l.ceiling??''}" placeholder="${b.ceiling}"></label><label>Void<input type="number" data-lv="${l.id}" data-k="void" value="${l.void??''}" placeholder="${b.void}"></label><label>Slab above<input type="number" data-lv="${l.id}" data-k="slab" value="${l.slab??''}" placeholder="${ph('slab')}"></label></div>
    <div class="row">${l===act?'<span class="muted" style="font-size:12px;align-self:center">Open now</span>':`<button class="btn sm" type="button" data-bb="open" data-id="${l.id}">Open</button>`}<button class="btn sm" type="button" data-bb="lvup" data-id="${l.id}" title="Move this floor up one" aria-label="Move up">▲</button><button class="btn sm" type="button" data-bb="lvdn" data-id="${l.id}" title="Move this floor down one" aria-label="Move down">▼</button><button class="btn sm" type="button" data-bb="dupl" data-id="${l.id}">Duplicate floor</button><button class="btn sm" type="button" data-bb="copy" data-id="${l.id}">Copy fit-out to…</button><button class="btn sm" type="button" data-bb="uniq" data-id="${l.id}">${l.unique?'Use typical layout':'Make unique'}</button>${b.levels.length>1?`<button class="btn sm ghost" type="button" data-bb="del" data-id="${l.id}">Delete</button>`:''}</div>
    ${copyFrom===l.id?`<div class="copybox"><p class="muted">Copy ${nm[l.id]}'s furniture, labels and room names to:</p>${b.levels.filter(x=>x!==l).slice().reverse().map(x=>`<label class="ck"><input type="checkbox" data-ct="${x.id}"> ${nm[x.id]}</label>`).join('')}<div class="row"><button class="btn sm primary" type="button" data-bb="docopy" data-id="${l.id}">Copy (replaces their fit-out)</button><button class="btn sm" type="button" data-bb="nocopy">Cancel</button></div></div>`:''}</div>`});
  h+=`<div class="sec">Column grid</div><p class="muted">Grid lines with bubbles, and a column at every crossing on every floor. Applying again replaces the grid's columns.</p>${gridForm()}<div class="row"><button class="btn sm primary" type="button" data-bb="gridgo">Apply grid</button>${b.grid?'<button class="btn sm ghost" type="button" data-bb="gridoff">Remove grid</button>':''}</div>`;
  const nw=S.objs.filter(isWin).length;h+=`<div class="sec">Façade windows · ${nm[act.id]}</div><p class="muted">Puts windows along every outside wall of the open floor${act.unique?'':', and so on every typical floor'}. Running it again replaces the windows it finds. ${nw?`${nw} on this floor now.`:''}</p>${winForm('all')}<div class="row"><button class="btn sm primary" type="button" data-bb="winall">Add windows to outside walls</button>${nw?'<button class="btn sm ghost" type="button" data-bb="winnone">Remove all windows</button>':''}</div>`;
  h+=`<p class="muted" style="margin-top:10px">Walls, doors, windows and rooms on typical floors are shared: change them on any typical floor and they change on all of them. Furniture, labels and room names belong to each floor. Floor to floor = ceiling + void + slab above.</p>`;
  el.innerHTML=h;annotateInfo(el)}
function bldChanged(){markDirty();renderFloorUI();renderBldPanel();if(bldView&&T3)build3D()}
function reorderLevel(dragId,targetId,below){const b=S.bld;const disp=b.levels.slice().reverse();
  const di=disp.findIndex(l=>l.id===dragId),ti=disp.findIndex(l=>l.id===targetId);if(di<0||ti<0||dragId===targetId)return;
  if(disp[di].kind!==disp[ti].kind){toast('Move floors among floors and basements among basements');return}
  checkpoint();syncFloorOut(S);const[dl]=disp.splice(di,1);let ni=disp.findIndex(l=>l.id===targetId);ni=below?ni+1:ni;disp.splice(ni,0,dl);
  b.levels=disp.reverse();b.levels.sort((x,y)=>(x.kind==='B'?0:1)-(y.kind==='B'?0:1));bldChanged();toast('Floors reordered')}
let dragLv=null;
$('#p-bld').addEventListener('click',e=>{if(e.target.closest('#bld-north-up'))setNorth(0)});
$('#p-bld').addEventListener('dragstart',e=>{const r=e.target.closest('[data-lvid]');if(!r)return;dragLv=r.dataset.lvid;e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragLv)}catch(x){}});
$('#p-bld').addEventListener('dragover',e=>{if(!dragLv)return;const r=e.target.closest('[data-lvid]');if(!r)return;e.preventDefault();$$('#p-bld .lvl.drop-above,#p-bld .lvl.drop-below').forEach(x=>x.classList.remove('drop-above','drop-below'));const rc=r.getBoundingClientRect();r.classList.add(e.clientY>rc.top+rc.height/2?'drop-below':'drop-above')});
$('#p-bld').addEventListener('drop',e=>{if(!dragLv)return;const r=e.target.closest('[data-lvid]');$$('#p-bld .lvl.drop-above,#p-bld .lvl.drop-below').forEach(x=>x.classList.remove('drop-above','drop-below'));if(r){e.preventDefault();const rc=r.getBoundingClientRect();reorderLevel(dragLv,r.dataset.lvid,e.clientY>rc.top+rc.height/2)}dragLv=null});
$('#p-bld').addEventListener('dragend',()=>{dragLv=null;$$('#p-bld .lvl.drop-above,#p-bld .lvl.drop-below').forEach(x=>x.classList.remove('drop-above','drop-below'))});
$('#p-bld').addEventListener('change',e=>{const t=e.target;if(t.id==='bld-north'){setNorth(t.value);return}if(t.dataset.bk){const v=num(t.value,NaN);if(isFinite(v)&&v>=0){S.bld[t.dataset.bk]=v}bldChanged();return}
  if(t.dataset.lv){const l=S.bld.levels.find(x=>x.id===t.dataset.lv);if(!l)return;const v=t.value.trim();
    if(t.dataset.k==='ftf'){const n=num(v,NaN);if(isFinite(n)&&n>0){const b=S.bld,idx=b.levels.indexOf(l),effVoid=l.void??b.void,effSlab=slabAbove(b,idx),want=Math.round(n-effVoid-effSlab);l.ceiling=Math.max(1000,want);if(want<1000)toast(`Minimum floor to floor here is ${1000+effVoid+effSlab} mm (1000 ceiling + ${effVoid} void + ${effSlab} slab)`)}bldChanged();return}
    if(v==='')delete l[t.dataset.k];else{const n=num(v,NaN);if(isFinite(n)&&n>=0)l[t.dataset.k]=n}bldChanged()}});
$('#p-bld').addEventListener('click',e=>{const t=e.target.closest('[data-bb]');if(!t)return;const a=t.dataset.bb,b=S.bld,nm=levelNames(b),l=b.levels.find(x=>x.id===t.dataset.id);
  if(a==='gridgo'){applyGrid(readGrid($('#p-bld .grf')));return}if(a==='gridoff'){removeGrid();return}
  if(a==='winall'){runWindowFill('all',$('#p-bld .winf'));return}if(a==='winnone'){removeAllWindows();return}
  syncFloorOut(S);
  /* floor changes are one undo step each (a delete only once it is confirmed) */
  if(['addL','addB','dupl','docopy','uniq'].includes(a))checkpoint();
  /* up / down buttons do what dragging the row does (drag needs a mouse) */
  if(a==='lvup'||a==='lvdn'){const disp=b.levels.slice().reverse(),i=disp.indexOf(l),j=a==='lvup'?i-1:i+1;if(j<0||j>=disp.length)return toast(a==='lvup'?'Already the top floor':'Already the lowest floor');if(a==='lvup')reorderLevel(l.id,disp[j].id,false);else reorderLevel(l.id,disp[j].id,true);renderBldPanel();return}
  if(a==='addL'){const n={id:uid(),kind:'L',unique:false,fit:[],names:{}};b.levels.push(n);bldChanged();toast(`${levelNames(b)[n.id]} added with the typical layout`)}
  else if(a==='addB'){const n={id:uid(),kind:'B',unique:false,fit:[],names:{}};b.levels.unshift(n);bldChanged();toast(`${levelNames(b)[n.id]} added. Basements often need their own layout: use Make unique.`)}
  else if(a==='dupl'){const i=b.levels.indexOf(l);const refit=arr=>{const gm={};return clone(arr||[]).map(o=>{o.id=uid();if(o.gid){gm[o.gid]=gm[o.gid]||uid();o.gid=gm[o.gid]}return o})};
    const n={id:uid(),kind:l.kind,unique:l.unique,fit:refit(l.fit),names:Object.assign({},l.names||{})};
    if(l.unique)n.base=clone(l.base||[]);
    b.levels.splice(i+1,0,n);b.levels.sort((x,y)=>(x.kind==='B'?0:1)-(y.kind==='B'?0:1));
    bldChanged();toast(`${nm[l.id]} duplicated as ${levelNames(b)[n.id]}${l.unique?' (its own walls and rooms copied)':' (typical layout, fit-out copied)'}`)}
  else if(a==='open'){switchFloor(l.id)}
  else if(a==='copy'){copyFrom=copyFrom===l.id?null:l.id;renderBldPanel()}
  else if(a==='nocopy'){copyFrom=null;renderBldPanel()}
  else if(a==='docopy'){const ids=[...$('#p-bld').querySelectorAll('[data-ct]:checked')].map(x=>x.dataset.ct);if(!ids.length)return toast('Tick at least one floor');
    ids.forEach(id=>{const d=b.levels.find(x=>x.id===id);if(!d)return;const gm={};d.fit=clone(l.fit||[]).map(o=>{o.id=uid();if(o.gid){gm[o.gid]=gm[o.gid]||uid();o.gid=gm[o.gid]}return o});d.names=Object.assign({},l.names||{})});
    copyFrom=null;if(ids.includes(b.active))syncFloorIn(S);clashDirty=true;render();bldChanged();toast(`Fit-out copied from ${nm[l.id]} to ${ids.map(i=>nm[i]).join(', ')}`)}
  else if(a==='uniq'){if(!l.unique){const base=clone(b.typical||[]);base.forEach(o=>{if(o.t==='room'&&l.names&&l.names[o.id]!=null)o.name=l.names[o.id]});l.unique=true;l.base=base;l.names={};toast(`${nm[l.id]} now has its own walls, doors and rooms`)}
    else{if(!confirm(`${nm[l.id]}'s own walls, doors and rooms will be replaced by the typical layout. Continue?`))return;l.unique=false;delete l.base;l.names={};toast(`${nm[l.id]} uses the typical layout again`)}
    if(l.id===b.active){syncFloorIn(S);sel.clear();clashDirty=true;render();renderInspector()}bldChanged()}
  else if(a==='del'){const hasFit=(l.fit||[]).length;if(!confirm(`Delete ${nm[l.id]}${hasFit?` and its ${hasFit} items`:''}? Undo brings it back.`))return;checkpoint();
    const i=b.levels.indexOf(l);if(l.id===b.active){const nb=b.levels[i+1]||b.levels[i-1];b.active=nb.id;syncFloorIn(S);/* history kept: the checkpoint above brings the deleted floor back */sel.clear();clashDirty=true;render();renderInspector()}
    b.levels.splice(i,1);bldChanged();toast(`${nm[l.id]} deleted`)}});
$('#b-floor').addEventListener('click',e=>{e.stopPropagation();const p=$('#pop-floor');const open=p.hidden;closePops();if(open){renderFloorPop();const r=e.currentTarget.getBoundingClientRect();p.style.left=Math.max(8,r.left)+'px';p.style.top=(r.bottom+6)+'px';p.hidden=false}});
$('#pop-floor').addEventListener('click',e=>{const t=e.target.closest('[data-fl]');if(!t)return;$('#pop-floor').hidden=true;if(t.dataset.fl==='__manage'){showTab('bld');return}switchFloor(t.dataset.fl)});

/* ================= My plans: every plan ever edited in this browser, in IndexedDB =================
   Keyed by the plan's pid. Written on every autosave (debounced), listed in the My plans dialog. Independent of the tab autosave in localStorage, which only covers open tabs and is capped at ~5 MB. */
const PLANS=(()=>{
  let dbp=null;const open=()=>dbp||(dbp=new Promise((res,rej)=>{try{const q=indexedDB.open('storeybook-sku',1);q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains('plans'))db.createObjectStore('plans',{keyPath:'pid'})};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}catch(e){rej(e)}}));
  const tx=async(mode,fn)=>{const db=await open();return new Promise((res,rej)=>{const t=db.transaction('plans',mode),st=t.objectStore('plans');let out;try{out=fn(st)}catch(e){rej(e);return}t.oncomplete=()=>res(out&&typeof IDBRequest!=='undefined'&&out instanceof IDBRequest?out.result:out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})};
  let putT=null,pending=null;
  /* a small picture of the plan: room fills, walls and item footprints, scaled into 160 x 100 */
  const thumb=p=>{try{const pts=[];p.objs.forEach(o=>{if((o.t==='room'||o.t==='wall')&&o.pts)o.pts.forEach(q=>pts.push(q));else if(o.t==='item'&&o.x!=null)pts.push([o.x-o.w/2,o.y-o.d/2],[o.x+o.w/2,o.y+o.d/2])});if(pts.length<2)return '';
      let x0=1e12,y0=1e12,x1=-1e12,y1=-1e12;pts.forEach(([x,y])=>{if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y});const W=160,H=100,k=Math.min((W-8)/Math.max(1,x1-x0),(H-8)/Math.max(1,y1-y0));
      const X=x=>((x-x0)*k+(W-(x1-x0)*k)/2).toFixed(1),Y=y=>((y-y0)*k+(H-(y1-y0)*k)/2).toFixed(1);let g='';
      p.objs.forEach(o=>{if(o.t==='room'&&o.pts&&o.pts.length>2)g+=`<path d="M${o.pts.map(q=>X(q[0])+' '+Y(q[1])).join('L')}Z" fill="${/^#[0-9a-f]{3,8}$/i.test(o.col||'')?o.col:'#dfe7f0'}" fill-opacity=".9"/>`});
      p.objs.forEach(o=>{if(o.t==='item'&&o.x!=null&&o.w>0)g+=`<rect x="${X(o.x-o.w/2)}" y="${Y(o.y-o.d/2)}" width="${(o.w*k).toFixed(1)}" height="${(o.d*k).toFixed(1)}" fill="#8aa0b8" fill-opacity=".6"/>`});
      p.objs.forEach(o=>{if(o.t==='wall'&&o.pts&&o.pts.length>1)g+=`<path d="M${o.pts.map(q=>X(q[0])+' '+Y(q[1])).join('L')}${o.closed?'Z':''}" fill="none" stroke="#1d3d63" stroke-width="${Math.max(1,(o.th||100)*k).toFixed(1)}" stroke-linecap="square"/>`});
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${g}</svg>`}catch(e){return ''}};
  const summarise=p=>({pid:p.pid,name:p.name||'Untitled plan',updated:Date.now(),floors:(p.bld&&p.bld.levels&&p.bld.levels.length)||1,objs:p.objs.length,items:p.objs.filter(o=>o.t==='item').length,rooms:p.objs.filter(o=>o.t==='room').length,thumb:thumb(p)});
  return {
    ok:()=>'indexedDB' in window,
    /* debounced: the last plan wins; the whole plan goes in as JSON text so snapshots, notes and the underlay travel with it */
    put(plan){if(!plan||!PLANS.ok())return;if(!plan.pid)plan.pid=uid();pending=plan;clearTimeout(putT);putT=setTimeout(()=>{const p=pending;pending=null;try{syncFloorOut(p)}catch(e){}let data;try{data=JSON.stringify(p)}catch(e){return}
      tx('readwrite',st=>st.put(Object.assign(summarise(p),{size:data.length,data}))).catch(e=>console.warn('plan store',e))},1500)},
    async list(){if(!PLANS.ok())return[];const all=await tx('readonly',st=>st.getAll());return (all||[]).map(r=>{const{data,...m}=r;return m}).sort((a,b)=>b.updated-a.updated)},
    async get(pid){return tx('readonly',st=>st.get(pid))},
    async del(pid){if(pending&&pending.pid===pid){clearTimeout(putT);pending=null}return tx('readwrite',st=>st.delete(pid))},
    async clear(){if(!PLANS.ok())return;clearTimeout(putT);return tx('readwrite',st=>st.clear())},
    flush(){if(pending){clearTimeout(putT);const p=pending;pending=null;try{tx('readwrite',st=>st.put(Object.assign(summarise(p),{size:(JSON.stringify(p)).length,data:JSON.stringify(p)})))}catch(e){}}},
    /* the whole store as one file, and back: records keep their pid and time, a newer copy in the browser is not overwritten */
    async exportAll(){const all=await tx('readonly',st=>st.getAll());return JSON.stringify({app:'storeybook-plans',v:1,exported:new Date().toISOString(),plans:(all||[]).map(r=>({pid:r.pid,name:r.name,updated:r.updated,data:r.data}))})},
    async importAll(text){const j=JSON.parse(text);if(!j||j.app!=='storeybook-plans'||!Array.isArray(j.plans))throw new Error('not a StoreyBook plans file');let added=0,skipped=0;
      for(const r of j.plans){if(!r||!r.pid||typeof r.data!=='string')continue;let p;try{p=JSON.parse(r.data)}catch(e){continue}const have=await tx('readonly',st=>st.get(r.pid));if(have&&have.updated>=(r.updated||0)){skipped++;continue}
        p.pid=r.pid;const data=JSON.stringify(p);await tx('readwrite',st=>st.put(Object.assign(summarise(p),{pid:r.pid,updated:r.updated||Date.now(),size:data.length,data})));added++}
      return{added,skipped}}
  }})();
window.addEventListener('pagehide',()=>PLANS.flush());
const fmtWhen=t=>{const d=new Date(t),now=new Date();const same=d.toDateString()===now.toDateString();return (same?'Today ':d.toLocaleDateString([],{day:'numeric',month:'short'})+' ')+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
async function openPlans(){closePops();$('#plans-modal').hidden=false;$('#plans-list').innerHTML='<div class="plans-empty">Loading…</div>';
  if(!PLANS.ok()){$('#plans-list').innerHTML='<div class="plans-empty">This browser does not offer local plan storage (private window?). Use Save to a file.</div>';return}
  let rows=[];try{rows=await PLANS.list()}catch(e){$('#plans-list').innerHTML='<div class="plans-empty">Could not read local storage: '+esc(String(e&&e.message||e))+'</div>';return}
  const openIds=new Set(tabs.map(t=>(t===curTab?S:t.S).pid));
  $('#plans-list').innerHTML=rows.length?rows.map(r=>`<div class="plan-row${r.pid===S.pid?' cur':''}" data-pid="${esc(r.pid)}"><div class="pt">${r.thumb||''}</div><div class="pn">${esc(r.name)}${r.pid===S.pid?' <span class="muted">· open now</span>':openIds.has(r.pid)?' <span class="muted">· open in a tab</span>':''}</div><div class="pm">${r.floors} ${r.floors===1?'floor':'floors'} · ${r.rooms} rooms · ${r.items} items · ${fmtWhen(r.updated)} · ${Math.max(1,Math.round(r.size/1024))} KB</div><div class="pa"><button class="btn sm primary" type="button" data-pact="open">Open</button><button class="btn sm" type="button" data-pact="dup">Duplicate</button><button class="btn sm" type="button" data-pact="rename">Rename</button><button class="btn sm ghost" type="button" data-pact="del">Delete</button></div></div>`).join(''):'<div class="plans-empty">Nothing here yet. Plans are kept automatically as you work.</div>';
  const kb=Math.round(rows.reduce((a,r)=>a+(r.size||0),0)/1024);$('#plans-use').textContent=rows.length?`${rows.length} ${rows.length===1?'plan':'plans'} · ${kb.toLocaleString()} KB`:''}
async function openStoredPlan(pid){const r=await PLANS.get(pid);if(!r){toast('That plan is no longer in this browser');return}
  const live=tabs.find(t=>(t===curTab?S:t.S).pid===pid);if(live){if(live!==curTab)switchTab(live);$('#plans-modal').hidden=true;toast(`Switched to "${r.name}"`);return}
  try{openPlanText(r.data,null,r.name)}catch(e){toast('Could not open: '+(e.message||e));return}
  $('#plans-modal').hidden=true}
$('#m-plans').addEventListener('click',()=>openPlans());
$('#f-plans')&&$('#f-plans').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const r=await PLANS.importAll(await f.text());toast(`Imported ${r.added} ${r.added===1?'plan':'plans'}${r.skipped?`, ${r.skipped} already here and newer`:''}`);openPlans()}catch(err){toast('Could not import: '+(err.message||err))}});
$('#plans-modal').addEventListener('click',async e=>{
  if(e.target.id==='plans-modal'||e.target.closest('[data-pclose]')){$('#plans-modal').hidden=true;return}
  if(e.target.closest('[data-pnew]')){$('#plans-modal').hidden=true;newTab(blankPlan());toast('New blank plan');return}
  if(e.target.closest('[data-popen]')){$('#plans-modal').hidden=true;$('#m-open').click();return}
  if(e.target.closest('[data-pexport]')){try{PLANS.flush();const t=await PLANS.exportAll();const n=JSON.parse(t).plans.length;if(!n){toast('Nothing to export yet');return}const r=await saveText('storeybook-plans.json',t,'application/json','.json','StoreyBook plans');if(r)toast(`${n} ${n===1?'plan':'plans'} exported`)}catch(err){toast('Export failed: '+(err.message||err))}return}
  if(e.target.closest('[data-pimport]')){$('#f-plans').click();return}
  const b=e.target.closest('[data-pact]');if(!b)return;const pid=b.closest('[data-pid]').dataset.pid,act=b.dataset.pact;
  if(act==='open'){await openStoredPlan(pid);return}
  if(act==='del'){const r=await PLANS.get(pid);if(!r)return;if(pid===S.pid){toast('This plan is open now: switch to another tab or start a new plan first');return}
    /* open in another tab: deleting it closes that tab too, so its autosave cannot bring it back */
    const other=tabs.find(t=>t!==curTab&&t.S&&t.S.pid===pid);if(!confirm(`Delete "${r.name}" from this browser?${other?' It is open in another tab, which will close.':''} Plan files you saved are not touched.`))return;
    if(other){clearTimeout(other.asT);store.del('osk-tab-'+other.id);tabs.splice(tabs.indexOf(other),1);saveTabIndex();renderTabs()}await PLANS.del(pid);openPlans();return}
  if(act==='rename'){const r=await PLANS.get(pid);if(!r)return;const n=prompt('Plan name',r.name);if(!n||!n.trim())return;const p=JSON.parse(r.data);p.name=n.trim();const live=tabs.find(t=>(t===curTab?S:t.S).pid===pid);if(live){(live===curTab?S:live.S).name=p.name;if(live===curTab){$('#pname').value=p.name;renderTabs()}}PLANS.put(p);PLANS.flush();setTimeout(openPlans,120);return}
  if(act==='dup'){const r=await PLANS.get(pid);if(!r)return;const p=JSON.parse(r.data);p.pid=uid();p.name=(p.name||'Untitled plan')+' copy';delete p.saved;newTab(migratePlan(p).plan);$('#plans-modal').hidden=true;toast(`Opened "${p.name}"`);return}
});
/* ================= plan tabs =================
   Each tab is a whole plan with its own undo history, file, underlay and view. Each is autosaved under its own key. */
var tabs=[],curTab=null;
/* Roof mode belongs to the plan on screen. Leave it before the screen shows another plan, or the next plan is taken for a roof and its rooms are lost (found by the rules layer, 15 Nov 2026; the fault dates from before 5.0.0) */
function leaveRoof(){if(roofMode){try{exitRoof()}catch(e){roofMode=false;roofRefObjs=[]}}}
function captureTab(){if(!curTab)return;clearTimeout(asT);saveTabData(curTab,AI.pending?AI.pending.pre.S:S);Object.assign(curTab,{S,sel,fileHandle,dirty,past,future,pdfDoc,pdfName,V:{x:V.x,y:V.y,k:V.k}})}
function applyTab(t){
  /* whatever the caller did, the plan coming on screen is never opened as a roof */if(roofMode){roofMode=false;roofRefObjs=[]}
  /* an AI preview belongs to the plan it was made on: it is parked with that tab and comes back with it */
  if(curTab&&curTab!==t&&AI.pending){curTab.aiPend=AI.pending;AI.pending=null;if(cmp&&cmp.snapId==null)cmp=null}
  if(WALK.on)walkStop(true);if(tool!=='select')setTool('select');calib=null;detBox=false;underMove=false;walkPick=false;
  /* hidden objects, an open group and the last typed-over step belong to the plan being left */if(typeof SU!=='undefined'&&SU){if(SU.gctx)try{suGroupLeave()}catch(e){}SU.gctx=null;SU.cedit=null;SU.last=null;SU.typed='';SU.fut=null;if(curTab&&curTab!==t){curTab.suHidden=SU.hidden;SU.hidden=t.suHidden||new Set();SU.views=[]}}
  curTab=t;S=t.S;sel=t.sel||new Set();fileHandle=t.fileHandle||null;dirty=!!t.dirty;past=t.past||[];future=t.future||[];pdfDoc=t.pdfDoc||null;pdfName=t.pdfName||'';
  if(S.underlay&&S.underlay.src){S.underlay.uid=S.underlay.uid||uid();underCache[S.underlay.uid]=S.underlay.src}
  $('#pname').value=S.name;syncLock();syncUnder();clashDirty=true;
  if(t.V){V.x=t.V.x;V.y=t.V.y;V.k=t.V.k;applyView();render()}else fit();
  AS.state='idle';AS.fileNote='';ensureBld(S);renderInspector();setStatus();renderTabs();saveTabIndex();updateHint();renderFloorUI();
  if(t.aiPend){AI.pending=t.aiPend;t.aiPend=null;try{cmpWith(AI.pending.pre.data,'before AI',null)}catch(e){}}try{aiBar()}catch(e){}
  if(is3D&&T3){T3.framed=false;build3D()}
  /* an AI answer that arrived while another plan was open has been waiting for this one */
  if(AI.wait&&AI.wait.tab===t){const w=AI.wait;AI.wait=null;w.res()}
}
const curUntouched=()=>!S.objs.length&&!(S.underlay&&S.underlay.src)&&!past.length&&!fileHandle;
function newTab(plan){
  leaveRoof();
  if(curTab&&curUntouched()){curTab.V=null;curTab.S=plan;applyTab(Object.assign(curTab,{S:plan,sel:new Set(),past:[],future:[],dirty:false,fileHandle:null,pdfDoc:null,V:null}));autosave();return curTab}
  leaveRoof();captureTab();const t={id:uid(),S:plan,sel:new Set(),past:[],future:[],dirty:false,fileHandle:null,pdfDoc:null,pdfName:'',V:null};
  tabs.splice(tabs.indexOf(curTab)+1,0,t);saveTabData(t,plan);applyTab(t);return t;
}
function switchTab(t){if(!t||t===curTab)return;leaveRoof();captureTab();applyTab(t)}
function closeTab(t){
  const live=t===curTab?S:t.S,isDirty=t===curTab?dirty:t.dirty;
  if(isDirty&&live.objs.length&&!confirm(`"${live.name}" has changes that are not saved to a file. Close the tab anyway?`))return;
  if(t===curTab)leaveRoof();
  store.del('osk-tab-'+t.id);const i=tabs.indexOf(t);tabs.splice(i,1);if(AI.wait&&AI.wait.tab===t){const w=AI.wait;AI.wait=null;w.rej(new Error(AI_CLOSED))}
  if(!tabs.length){const n={id:uid(),S:blankPlan(),sel:new Set(),past:[],future:[],dirty:false,V:null};tabs.push(n);applyTab(n);autosave();return}
  if(t===curTab)applyTab(tabs[Math.min(i,tabs.length-1)]);else{renderTabs();saveTabIndex()}
}
function saveTabIndex(){store.set('osk-tabs',JSON.stringify({ids:tabs.map(t=>t.id),active:curTab&&curTab.id}))}
let tabDragging=false;
function renderTabs(){const el=$('#ptabs');if(!el)return;if(curTab){if(curTab._nm!=null&&curTab._nm!==S.name)campusRenamed(curTab._nm,S.name);curTab._nm=S.name}/* a tab being dragged must not be rebuilt under the pointer (autosave redraws the tabs) */if(tabDragging)return;el.classList.toggle('single',tabs.length<2);
  el.innerHTML=tabs.map(t=>{const on=t===curTab,nm=on?S.name:t.S.name,dt=on?dirty:t.dirty;
    return `<div class="ptab${on?' on':''}" data-tab="${t.id}" tabindex="0" role="tab" aria-selected="${on}" title="${esc(nm)}${dt?' · not saved to a file':''}${tabs.length>1?' · Alt+← / Alt+→ moves this tab':''}"><span class="nm">${esc(nm||'Untitled plan')}</span>${dt?'<i class="dot" aria-label="Not saved to a file"></i>':''}<button type="button" class="x" data-tab-close="${t.id}" aria-label="Close ${esc(nm)}">×</button></div>`}).join('')+
    `<button type="button" class="ptab-add" id="ptab-add" title="New blank plan in a new tab" aria-label="New tab">+</button>`}
$('#ptabs').addEventListener('click',e=>{const c=e.target.closest('[data-tab-close]');if(c){e.stopPropagation();closeTab(tabs.find(t=>t.id===c.dataset.tabClose));return}
  if(e.target.closest('#ptab-add')){newTab(blankPlan());return}const t=e.target.closest('[data-tab]');if(t)switchTab(tabs.find(x=>x.id===t.dataset.tab))});
/* drag a plan tab sideways to reorder it, the way browser tabs move: the tab follows the pointer and swaps places as it passes a neighbour's middle */
{let td=null,tabNoClick=false;const bar=$('#ptabs');
  bar.addEventListener('pointerdown',e=>{if(e.button)return;const t=e.target.closest('.ptab');if(!t||e.target.closest('.x')||tabs.length<2)return;td={el:t,pid:e.pointerId,x0:e.clientX,on:false}});
  addEventListener('pointermove',e=>{if(!td||e.pointerId!==td.pid)return;const dx=e.clientX-td.x0;if(!td.on){if(Math.abs(dx)<7)return;td.on=true;tabDragging=true;td.el.classList.add('dragging');try{bar.setPointerCapture(td.pid)}catch(x){}}
    const el=td.el,r=el.getBoundingClientRect(),mid=r.left+r.width/2;const prev=el.previousElementSibling,next=el.nextElementSibling;
    if(prev&&prev.classList.contains('ptab')){const p=prev.getBoundingClientRect();if(mid<p.left+p.width/2){bar.insertBefore(el,prev);td.x0-=p.width+4}}
    if(next&&next.classList.contains('ptab')){const n=next.getBoundingClientRect();if(mid>n.left+n.width/2){bar.insertBefore(next,el);td.x0+=n.width+4}}
    el.style.transform=`translateX(${e.clientX-td.x0}px)`},true);
  const end=e=>{if(!td||e.pointerId!==td.pid)return;const was=td;td=null;if(!was.on)return;tabDragging=false;was.el.classList.remove('dragging');was.el.style.transform='';const order=[...bar.querySelectorAll('.ptab')].map(x=>x.dataset.tab);tabs.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));tabNoClick=true;setTimeout(()=>tabNoClick=false,0);renderTabs()};
  addEventListener('pointerup',end,true);addEventListener('pointercancel',end,true);
  bar.addEventListener('click',e=>{if(tabNoClick){e.stopPropagation();e.preventDefault()}},true)}
/* keyboard and search alternative to dragging a tab (WCAG 2.5.7) */
function tabShift(d){const i=tabs.indexOf(curTab),j=i+d;if(i<0||j<0||j>=tabs.length)return toast(d<0?'This plan is already the first tab':'This plan is already the last tab');tabs.splice(j,0,tabs.splice(i,1)[0]);renderTabs();const el=$('#ptabs .ptab.on');if(el)el.focus();toast(`${S.name||'Plan'} moved to tab ${j+1} of ${tabs.length}`)}
$('#ptabs').addEventListener('keydown',e=>{const t=e.target.closest('.ptab');if(!t)return;if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&e.altKey){e.preventDefault();e.stopPropagation();if(t.classList.contains('on'))tabShift(e.key==='ArrowLeft'?-1:1)}else if((e.key==='Enter'||e.key===' ')&&e.target===t){e.preventDefault();switchTab(tabs.find(x=>x.id===t.dataset.tab))}});
$('#ptabs').addEventListener('auxclick',e=>{if(e.button!==1)return;const t=e.target.closest('[data-tab]');if(t){e.preventDefault();closeTab(tabs.find(x=>x.id===t.dataset.tab))}});

resize();
let bootNotes=[];
{ /* restore every tab from the last session; fall back to the single autosave of older versions, then the sample */
  let idx=null;try{idx=JSON.parse(store.get('osk-tabs')||'null')}catch(e){}
  const load=raw=>{try{const m=migratePlan(raw);m.notes.forEach(n=>{if(!bootNotes.includes(n))bootNotes.push(n)});return Object.assign(blankPlan(),m.plan)}catch(e){return null}};
  if(idx&&Array.isArray(idx.ids))idx.ids.forEach(id=>{let raw=null;try{raw=JSON.parse(store.get('osk-tab-'+id)||'null')}catch(e){}const pl=raw&&Array.isArray(raw.objs)&&load(raw);if(pl)tabs.push({id,S:pl,sel:new Set(),past:[],future:[],dirty:true,V:null})});
  if(!tabs.length){let saved=null;try{saved=JSON.parse(store.get('osk-plan')||'null')}catch(e){}const pl=saved&&Array.isArray(saved.objs)&&load(saved);if(pl)tabs.push({id:uid(),S:pl,sel:new Set(),past:[],future:[],dirty:true,V:null})}
  let fresh=false;if(!tabs.length){S=blankPlan();tabs.push({id:uid(),S,sel:new Set(),past:[],future:[],dirty:false,V:null});fresh=true}
  tabs.forEach(t=>{if(!store.get('osk-tab-'+t.id))saveTabData(t,t.S)});
  applyTab(tabs.find(t=>idx&&t.id===idx.active)||tabs[0]);
  window.addEventListener('pagehide',()=>{if(curTab&&!store.off){clearTimeout(asT);saveTabData(curTab,AI.pending?AI.pending.pre.S:S)}});
  $('#status').addEventListener('click',e=>{e.stopPropagation();const p=$('#pop-save'),open=p.hidden;closePops();if(!open)return;renderSavePop();const r=e.currentTarget.getBoundingClientRect();p.style.left=Math.max(8,r.left)+'px';p.style.top=(r.bottom+6)+'px';p.hidden=false});
  $('#pop-save').addEventListener('click',e=>{const b=e.target.closest('[data-sv]');if(!b)return;$('#pop-save').hidden=true;if(b.dataset.sv==='save')$('#m-save').click();else wipeLocal()});
  $('#m-wipe').addEventListener('click',()=>{closePops();wipeLocal()});
}
setTool('select');setStatus();renderInspector();
document.title=`StoreyBook ${APP_VERSION}${APP_FORK?' ('+APP_FORK+')':''}${APP_TEST?' · '+APP_TEST:''}`;
/* on the website, a newer build shows a reload banner; the single file skips this */
if(/^https?:$/.test(location.protocol)){const chk=()=>fetch('version.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(j&&j.v&&j.v!==APP_VERSION){const b=$('#upd');if(b){b.hidden=false;b.querySelector('b').textContent=j.v}}}).catch(()=>{});
  setTimeout(chk,2500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)chk()});$('#upd-go')&&$('#upd-go').addEventListener('click',()=>location.reload());$('#upd-x')&&$('#upd-x').addEventListener('click',()=>{$('#upd').hidden=true})}
{const all=libNotes.concat(bootNotes);if(all.length)setTimeout(()=>notice('Updated to version '+APP_VERSION,all,''),400)}
/* on-screen keyboard: when it opens (the visual viewport shrinks) the field being typed in is scrolled into the part still visible */
if(window.visualViewport){const vv=window.visualViewport;const keep=()=>{const a=document.activeElement;if(!a||!a.matches||!a.matches('input,textarea,select'))return;const r=a.getBoundingClientRect(),bot=vv.offsetTop+vv.height;if(r.bottom>bot-8||r.top<vv.offsetTop)try{a.scrollIntoView({block:'center',inline:'nearest'})}catch(e){}};vv.addEventListener('resize',()=>{setTimeout(keep,50);setTimeout(keep,200)});window.addEventListener('resize',()=>setTimeout(keep,120));document.addEventListener('focusin',()=>setTimeout(keep,300))}
/* accessibility: every control gets a name (from its label row, title or placeholder) as panels are drawn,
   and closing a dialog, sheet or popover hands the focus back to the control that opened it */
{const named=new WeakSet();const nameOf=el=>{if(el.getAttribute('aria-label')||el.getAttribute('aria-labelledby'))return null;/* cheap test first: asking a control for its labels searches the whole page, which froze the app on a 20,000-row library */if(el.tagName==='BUTTON'&&el.textContent.trim())return null;if(el.labels&&el.labels.length&&el.labels[0].textContent.trim())return null;
    const t=el.getAttribute('title')||el.getAttribute('placeholder');if(t)return t;
    const row=el.closest('.set,.fld label,label,.row,.ck');const txt=row?[...row.childNodes].filter(n=>n!==el&&!(n.nodeType===1&&n.matches('input,select,textarea,button'))).map(n=>n.textContent).join(' ').replace(/\s+/g,' ').trim():'';
    return txt||(el.type==='color'?'Colour':el.dataset&&el.dataset.f?el.dataset.f:null)};
  const pass=root=>{(root.querySelectorAll?root:document).querySelectorAll('input:not([type=hidden]),select,textarea,button').forEach(el=>{if(named.has(el))return;named.add(el);const n=nameOf(el);if(n)el.setAttribute('aria-label',n.slice(0,80))})};
  let qd=false;new MutationObserver(ms=>{if(qd||ms.every(m=>m.target.closest&&m.target.closest('svg,#v3c')))return;qd=true;requestAnimationFrame(()=>{qd=false;pass(document)})}).observe(document.body,{childList:true,subtree:true});pass(document);
  let opener=null;document.addEventListener('pointerdown',e=>{const b=e.target.closest('button,[role=button]');if(b)opener=b},true);document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const b=document.activeElement;if(b&&b.matches&&b.matches('button'))opener=b}},true);
  /* phones: while a text field has focus the on-screen keyboard is up; the bottom bar steps aside so it cannot cover the field */
  const kbdEl=e=>e&&e.matches&&e.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),textarea,[contenteditable=true]');
  document.addEventListener('focusin',e=>{if(TOUCH&&PHONE()&&kbdEl(e.target))document.documentElement.classList.add('kbd')});document.addEventListener('focusout',e=>{if(kbdEl(e.target))setTimeout(()=>{if(!kbdEl(document.activeElement))document.documentElement.classList.remove('kbd')},0)});
  /* switch toggles in Settings take their name from the row text */
  $$('.set .sw input').forEach(i=>{if(!i.getAttribute('aria-label')){const t=i.closest('.set').querySelector(':scope>span');if(t)i.setAttribute('aria-label',t.textContent.trim())}});
  const dlg='.keys-modal,.pop,#msheet,#snap-modal,#plans-modal,#ctxmenu,#ai-panel';const back=new Map();
  new MutationObserver(ms=>ms.forEach(m=>{const el=m.target;if(!el.matches||!el.matches(dlg))return;if(!el.hidden){if(opener&&!el.contains(opener)){/* opened from inside a menu or sheet: focus goes back to what opened that menu */const d=opener.closest(dlg);back.set(el,d&&d!==el&&back.get(d)||opener)}}else{const o=back.get(el);if(o&&o.isConnected&&o.offsetParent&&(document.activeElement===document.body||el.contains(document.activeElement)))try{o.focus({preventScroll:true})}catch(x){}lost=performance.now()}})).observe(document.body,{attributes:true,attributeFilter:['hidden'],subtree:true});
  /* a menu or dialog closed by a tap on the plan: the tap itself then takes focus off the button that opened it and would leave it nowhere (on the page body), so it goes to the work area that was tapped. Keys keep working as before */
  let lost=0;const mainEl2=$('#main');if(mainEl2){mainEl2.tabIndex=-1;mainEl2.style.outline='none';const keep=()=>setTimeout(()=>{if(lost&&performance.now()-lost<1200&&(document.activeElement===document.body||!document.activeElement)){try{mainEl2.focus({preventScroll:true})}catch(x){}}},0);document.addEventListener('pointerup',keep,true);document.addEventListener('click',keep,true)}}
/*@dev-only*/if(location.hash==='#osp-debug')window.__osp={TUT:()=>TUT,tutCtaShow:v=>{TUT.cta=!!v;tutCta();render()},tutOpen:()=>tutOpen(),tutStart:c=>tutStart(c),tutAuto:()=>tutAuto(),tutTick:()=>tutTick(),tutExit:()=>tutExit(),tutChapters:()=>TUT_CH.map(c=>c.steps.length),tutStepOk:()=>{const st=tutStep();try{return !st||!!st.next||!st.done||!!st.done(TUT.b)}catch(e){return "ERR "+e.message}},SU:()=>SU,isSel:id=>sel.has(id),suKeys:v=>{P.suKeys=v;suTips();updateHint()},suOn:()=>suOn(),suMoveStart:(ids,b)=>suMoveStart(ids.map(byId),b),suMoveApply:d=>suMoveApply(d),suMoveCommit:()=>suMoveCommit(),suCopyToggle:()=>suCopyToggle(),suRotStart:(ids,c)=>suRotStart(ids.map(byId),c),suRotRef:w=>suRotRef(w),suRotApply:d=>suRotApply(d),suRotCommit:()=>suRotCommit(),suType:t=>{SU.typed=t;suApplyTyped()},suStyle:k=>suStyle(k),suSecFill:()=>suSecFill(),suMatsOpen:()=>suMatsOpen(),suCompMake:()=>suCompMake(),suCompUnique:()=>suCompUnique(),suCompPurge:()=>suCompPurge(),suOutlinerOpen:()=>suOutlinerOpen(),suTagColours:o=>suTagColours(o),suSceneAdd:()=>suSceneAdd(),suSceneGo:i=>suSceneGo(i),suGroupEnter:g=>suGroupEnter(g),suGroupLeave:()=>suGroupLeave(),suScaleStart:(ids,w)=>suScaleStart(ids.map(byId),w),suScaleApply:f=>suScaleApply(f),suScaleCommit:()=>suScaleCommit(),suTapeStart:w=>suTapeStart(w),suTapeSet:d=>{SU.tp.d=d},suTapeCommit:()=>suTapeCommit(),suView:k=>suView(k),suParallel:o=>suParallel(o),suXray:o=>suXray(o),suXmatN:()=>suXmats.size,suOffStart:id=>suOffStart(byId(id)),suOffPreview:d=>suOffPreview(d),suOffCommit:()=>suOffCommit(),suInferAt:(x,y,ids)=>{const r=pointSnap([x,y],{ids:ids?new Set(ids):null});return{p:r.p,k:r.k||''}},suPPTarget:(id,w)=>suPPTarget(byId(id),w),suPPStart:(id,w)=>{const t=suPPTarget(byId(id),w);suPPStart(t,null,1)},suPPSet:v=>suPPSet(v),suPPCommit:()=>suPPCommit(),suFlip:a=>suFlip(a),suHide:i=>suHide(i),suUnhide:()=>suUnhide(),suPrevView:()=>suPrevView(),suZoomSel:()=>suZoomSel(),suSelMode:(c,s)=>suSelMode({ctrlKey:c,shiftKey:s}),ctxItems:()=>ctxItems(),suSheetOpen:f=>suSheetOpen(f),rectFinish:(a,b)=>rectFinish(a,b),zoomAt:(f,x,y)=>zoomAt(f,x,y),view:()=>({x:V.x,y:V.y,k:V.k}),turnPlan:(d,q)=>turnPlan(d,q),axesFromPoint:(w,t)=>axesFromPoint(w,t),axesPickStart:()=>axesPickStart(),axesOpen:()=>axesOpen(),renders:()=>T3&&T3.renderer?T3.renderer.info.render.frame:0,walkStart:o=>walkStart(o),set3D:v=>set3D(v),doorCols:()=>doorCols(),tplExport:()=>tplExport(),tplImportText:(t,n)=>tplImportText(t,n),UTPL:()=>UTPL,tabShift:d=>tabShift(d),clashRun:m=>{computeClash(m);return{bad:[...clashCache.bad].sort(),zbad:[...clashCache.zbad].sort()}},importLib:(t,n)=>importLib(t,n),roomKit:l=>roomKit(l),progImportBuf:(b,n)=>progImportBuf(b,n),progCalc:()=>progCalc(progGet()),progOpen:t=>progOpen(t),progExportBlob:()=>progExportBlob(),xlsxRead:b=>xlsxRead(b),progEdit:f=>progEdit(f),progBuild:()=>progBuild(),campusOpen:()=>campusOpen(),campusRows:()=>campusRows(),campusSet:(t,f)=>campusSet(t,f),campusFile:()=>campusFile(),campusTurn:(t,d)=>campusTurn(t,d),libAt:l=>libAt(l),addObjs:(l,sel)=>addObjs(l,!!sel),toastLog:()=>toastLog(),toast:m=>toast(m),toasts:()=>TOASTS.slice(),rotateSel:d=>rotateSel(d),libOpenAll:()=>{libShut.clear();libQ='';libCat='All';renderLib()},libHay:l=>libHay(l),tplPlace:(c,q)=>tplPlace(c,q),tplUpdate:(r,q)=>tplUpdate(r,q),tplOpen:(c,r)=>tplOpen(c,r),tplSave:(r,n,d)=>tplSave(r,n,d),tplAll:()=>tplAll(),dhBuild:q=>dhBuild(q),pvCheck:()=>pvCheck(),enterRoof:()=>enterRoof(),exitRoof:()=>exitRoof(),CAMP:()=>CAMP,openPlanText:(t,h,n)=>openPlanText(t,h,n),campusArrange:()=>campusArrange(),BV:()=>BV,newTab:p=>newTab(p),blankPlan:()=>blankPlan(),progAdvise:()=>progAdvise(),progAdviceApply:j=>progAdviceApply(j),progAdviseAsk:()=>progAdviseAsk(progGet(),progCalc(progGet())),progPlan:()=>progPlan(progGet(),progCalc(progGet())),briefCheck:()=>briefCheck(),S:()=>S,envOf:o=>envOf(o),V,LIB:()=>LIB,APP_VERSION,PLAN_V,openPlanText:(t,n)=>openPlanText(t,null,n||'test'),migratePlan:o=>migratePlan(o),clash:()=>{computeClash();return clashCache},setNorth:v=>setNorth(v,{quiet:true}),PLANS,tabsRaw:()=>tabs,curTab:()=>curTab,isDirty:()=>dirty,markDirty,closeTab:t=>closeTab(t),sunVec:(a,e)=>sunVec(a,e),northSVG,migMap:()=>migMap(),sel:()=>[...sel],planJSON,WALK,walkStep:()=>walkStep(),insertCorner:(o,w)=>insertCorner(o,w),toWorld,floorPlate:()=>floorPlate(),T3:()=>T3,walkInteract:()=>walkInteract(),doorsAnimate:()=>doorsAnimate(),walkTarget:()=>walkTarget(),rideLift:d=>rideLift(d),walkLiftAt:p=>walkLiftAt(p),walkGround:p=>walkGround(p),walkResolve:p=>walkResolve(p),switchFloor:(id,k)=>switchFloor(id,k),exportDXF:()=>exportDXF(),exportIFC:()=>exportIFC(),pins:()=>S.pins,pinSel:()=>pinSel,reorderLevel:(a,t,bl)=>reorderLevel(a,t,bl),d3Active:()=>d3Active(),polyPts:()=>polyPts,migRoom:o=>migRoom(o),aiRun:c=>aiRun(c),aiParse:t=>aiParse(t),aiTraceBuild:(j,i,w)=>aiTraceBuild(j,i,w),aiWidthFrom:q=>aiWidthFrom(q),aiAttach:f=>aiAttach(f),briefCheck:()=>briefCheck(),aiSetBrief:(b,s2)=>aiSetBrief(b,s2),aiDocx:b=>aiDocx(b),cmdkOpen:()=>cmdkOpen(),aiIssues:()=>aiIssues(AI.pending?AI.pending.pre.base:null),aiPastePrompt:q=>aiPastePrompt(q),aiApply:(j,q)=>aiApply(j,q),aiAccept:()=>aiAccept(),aiReject:()=>aiReject(),aiPlanSummary:()=>aiPlanSummary(),aiSystem:()=>aiSystem(),AI:()=>AI,revIssue:d=>revIssue(d),revs:()=>revs(),cloudBoxes:()=>cloudBoxes(),setClouds:v=>setClouds(v),cmpRevNo:()=>cmpRevNo(),plateInner:f=>plateInner(f),costCalc:()=>costCalc(),zoneSummary:()=>zoneSummary(),applyZone:(z,ids)=>applyZone(z,ids),setZoneLayer:v=>setZoneLayer(v),reviewRows:()=>reviewRows(),newPin:(x,y)=>newPin(x,y),egressRun:s=>egressRun(s),egressCompute:()=>egressCompute(),sectionApply:()=>sectionApply(),EG:()=>EG,secSel:()=>secSel,setSecSel:v=>{secSel=v},makeColArray:(o,r,c,gx,gy)=>makeColArray(o,r,c,gx,gy),editArray:(o,ch)=>editArray(o,ch),undo:()=>undo(),redo:()=>redo(),setTool:t=>setTool(t),setSel:ids=>{sel=new Set(ids);renderInspector();render()},SUN:()=>SUN,sunPos:(la,doy,h)=>sunPos(la,doy,h),applySun:()=>applySun(),dayOfYear:(m,d)=>dayOfYear(m,d),snapNext:(tl,last,w)=>{const pt=tool;const pp=polyPts;tool=tl;polyPts=[last];const r=nextPolyPt(w,false);tool=pt;polyPts=pp;return r},tabs:()=>tabs.map(t=>({id:t.id,on:t===curTab,name:t===curTab?S.name:t.S.name,n:(t===curTab?S:t.S).objs.length})),roofMode:()=>roofMode,roofFit:()=>S.bld&&S.bld.roofFit,bldView:()=>bldView,syncFloorOut:()=>syncFloorOut(S),snapTake:n=>snapTake(n),snapCompare:id=>snapCompare(id),snaps:()=>snaps(),cmp:()=>cmp,pointersN:()=>pointers.size,dragM:()=>drag&&drag.m,lastDown:()=>lastDown,checkpoint:()=>checkpoint(),past:()=>past.length,future:()=>future.length,computeClash:m=>computeClash(m),clashCache:()=>clashCache,fidAt,byId:id=>byId(id),build3D:()=>build3D(),renderPOV:o=>renderPOV(o),render:()=>render(),kick3D,runDetect:b=>runDetect(b),loadUnder:f=>loadUnderFile(f),P:()=>P,fit:()=>fit(),toastOff:()=>{const t=$('#toast');if(t)t.hidden=true},detectPlan,traceWalls,findBands,detectColumns,roomsFromWalls,detectDoors,otsu,binarize,skewAngle,rotateBin,lineAngles,angledWalls,thinMask};/*@end-dev-only*/
})();
</script>
