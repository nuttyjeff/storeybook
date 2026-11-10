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
const LIB_COLS=['code','name','category','shape','width_mm','depth_mm','height_mm','leg_mm','seats','clear_front_mm','clear_back_mm','nests','unit_rate','components','arm_rests'];
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
    out.push({code:g(r,'code')||('ITEM'+(n+1)),name:g(r,'name'),cat:g(r,'category')||(isSet?'Workstation set':'Custom'),shape:isSet?'set':(g(r,'shape')||'rect'),w:w||1000,d:d||1000,h:num(g(r,'height_mm'),750),a:num(g(r,'leg_mm'),0),seats:num(g(r,'seats'),0),cf:num(g(r,'clear_front_mm'),0),cb:num(g(r,'clear_back_mm'),0),nests:/^(y|yes|true|1)$/i.test(g(r,'nests')),rate:g(r,'unit_rate')===''?null:num(g(r,'unit_rate'),null),pts:null,comps:isSet?comps:null,arms:g(r,'arm_rests')===''?null:/^(y|yes|true|1)$/i.test(g(r,'arm_rests'))});
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
function libToCSV(lib){return toCSV([LIB_COLS].concat(lib.map(l=>[l.code,l.name,l.cat,l.shape,l.w,l.d,l.shape==='set'?'':l.h,l.a||'',l.seats,l.cf,l.cb,l.nests?'yes':'no',l.rate==null?'':l.rate,l.shape==='set'?compsStr(l.comps):'',l.shape==='chair'?(hasArms(l)?'yes':'no'):''])))}

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
let P=Object.assign({},PREF_DEF);try{Object.assign(P,JSON.parse(store.get('osp-prefs')||'{}'))}catch(e){}
if(P.dims===true)P.dims='sel';if(P.dims===false)P.dims='off';
if(!P.layers||typeof P.layers!=='object')P.layers={};if(!Array.isArray(P.hideCats))P.hideCats=[];
if(P.clear===false)P.layers.zones=false;if(P.gaps===false)P.layers.gaps=false;if(P.dims==='off'){P.layers.walldims=false;P.dims='sel'}delete P.clear;delete P.gaps;
const LY=k=>P.layers[k]!==false;
function visible(o){if(isSite(o))return LY('site');if(o.t==='room'||o.t==='wall')return LY('walls');if(o.t==='item')return isCeil(o)?LY('ceil'):(isCol(o)||isCore(o))?LY('walls'):isOpening(o)?LY('doors'):(LY('furn')&&!P.hideCats.includes(o.cat)&&!(o.setCat&&P.hideCats.includes(o.setCat)));if(o.t==='text')return LY('texts');if(o.t==='dim')return LY('measures');if(o.t==='trunk')return LY('ceil');return true}
const savePrefs=()=>store.set('osp-prefs',JSON.stringify(P));
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
const APP_VERSION='4.6.0',PLAN_V=6,LIB_V=10;
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
const isPair=p=>Array.isArray(p)&&p.length>=2&&isFinite(p[0])&&isFinite(p[1]);
/* clean one saved object; returns the object, 'unknown' for a type this version cannot show, or null if it is broken */
function normObj(o,seen){
  if(!o||typeof o!=='object')return null;
  if(!KNOWN_T.includes(o.t))return 'unknown';
  const n=Object.assign({},o);
  if(typeof n.id!=='string'||!n.id||seen.has(n.id))n.id=uid();seen.add(n.id);
  if(n.gid!=null&&typeof n.gid!=='string')n.gid=String(n.gid);if(n.gid===undefined)n.gid=null;
  const pts=a=>Array.isArray(a)?a.filter(isPair).map(p=>[+p[0],+p[1]]):[];
  if(n.t==='room'){n.pts=pts(n.pts);if(n.pts.length<3)return null;n.name=String(n.name==null?'Room':n.name)}
  else if(n.t==='wall'){n.pts=pts(n.pts);if(n.pts.length<2)return null;n.th=num(n.th,100)>0?num(n.th,100):100;n.closed=!!n.closed;if(Array.isArray(n.bulge))n.bulge=n.bulge.map(v=>num(v,0));else delete n.bulge}
  else if(n.t==='item'){n.w=num(n.w,0);n.d=num(n.d,0);if(!(n.w>0&&n.d>0))return null;n.x=num(n.x,0);n.y=num(n.y,0);n.r=num(n.r,0);
    n.shape=String(n.shape||'rect');n.cat=String(n.cat||'Custom');n.code=String(n.code==null?'':n.code);n.name=String(n.name==null?'Item':n.name);n.label=String(n.label==null?'':n.label);
    ['h','a','seats','cf','cb'].forEach(k=>n[k]=num(n[k],k==='h'?750:0));n.nests=!!n.nests;if(n.arms!=null)n.arms=!!n.arms;if(n.flip!=null)n.flip=!!n.flip;n.rate=n.rate==null||n.rate===''?null:num(n.rate,null);
    n.pts=n.shape==='poly'?pts(n.pts):null;if(n.shape==='poly'&&n.pts.length<3)n.shape='rect';if(n.shape==='window'){n.sill=Math.max(0,num(n.sill,900));n.h=Math.max(0,n.h)}
    if(n.cat==='Core'){n.from=n.from?String(n.from):null;n.to=n.to?String(n.to):null;n.roof=n.shape==='stair'?n.roof!==false:false;n.h=0}
    if(n.cat==='Ceiling'){n.drop=Math.max(0,num(n.drop,0));n.cov=Math.max(0,num(n.cov,0));if(/^cctv/.test(n.shape)){n.tilt=Math.max(0,Math.min(90,num(n.tilt,20)));n.fov=Math.max(50,Math.min(180,num(n.fov,90)));n.range=Math.max(500,num(n.range,15000))}}}
  else if(n.t==='text'){n.x=num(n.x,0);n.y=num(n.y,0);if(n.r!=null){n.r=((Math.round(num(n.r,0))%360)+360)%360;if(!n.r)delete n.r}n.size=num(n.size,250)>0?num(n.size,250):250;n.text=String(n.text==null?'':n.text)}
  else if(n.t==='dim'){if(!isPair(n.a)||!isPair(n.b))return null;n.a=[+n.a[0],+n.a[1]];n.b=[+n.b[0],+n.b[1]]}
  else if(n.t==='trunk'){if(!Array.isArray(n.pts)||n.pts.length<2)return null;n.pts=n.pts.filter(isPair).map(p=>[+p[0],+p[1]]);if(n.pts.length<2)return null;n.w=Math.max(20,num(n.w,150));n.h=Math.max(20,num(n.h,100));n.drop=Math.max(0,num(n.drop,30))}
  return n;
}
/* any saved plan, any version -> current in-memory plan */
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
  const out=Object.assign({},p,{v:Math.max(fileV,PLAN_V),name:String(p.name||'Untitled plan'),objs,underlay:u,locked:!!p.locked});
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
try{LIB=libFromCSV(store.get('osp-lib')||DEFAULT_LIB_CSV)}catch(e){LIB=libFromCSV(DEFAULT_LIB_CSV)}
{const saved=store.get('osp-lib');let lv=saved?Math.floor(num(store.get('osp-lib-v'),1)):LIB_V;
  /* the first build with sets marked its upgrade with osp-sets-added; it still needs the later steps, which are safe to rerun */
  while(lv<LIB_V){try{if(LIB_STEPS[lv])LIB_STEPS[lv](LIB,libNotes)}catch(e){console.error(e)}lv++}
  if(saved)store.set('osp-lib',libToCSV(LIB));store.set('osp-lib-v',String(LIB_V))}
const saveLib=()=>{store.set('osp-lib',libToCSV(LIB));store.set('osp-lib-v',String(LIB_V))};

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
  return JSON.stringify({objs:S.objs,locked:S.locked,name:S.name,north:num(S.north,0),u,style:S.style||null,section:S.section||null,fire:S.fire||null,notes:S.notes||'',pins:S.pins||[],bld:S.bld||null});
}
/* undo history is bounded by total bytes, not a fixed count — effectively unlimited for a normal session without unbounded memory growth */
let pastBytes=0;const UNDO_BUDGET=96*1024*1024;
function pushPast(str){past.push(str);pastBytes+=str.length;while(past.length>1&&pastBytes>UNDO_BUDGET)pastBytes-=past.shift().length}
function checkpoint(){pushPast(snapState());future=[];markDirty()}
function restoreState(str){
  const o=JSON.parse(str);S.objs=o.objs;S.locked=o.locked;S.name=o.name;if(o.north!=null&&o.north!==num(S.north,0)){S.north=o.north;try{drawNorth();if(SUN.on)applySun()}catch(e){}}
  S.style=o.style||undefined;S.section=o.section||undefined;S.fire=o.fire||undefined;S.notes=o.notes||'';S.pins=o.pins||[];if(o.bld)S.bld=o.bld;pinSel=null;
  if(o.u){S.underlay=Object.assign({},o.u,{src:underCache[o.u.uid]||null})}else S.underlay=null;
  [...sel].forEach(id=>{if(!byId(id))sel.delete(id)});secSel=false;
  $('#pname').value=S.name;markDirty();syncUnder();if(o.bld){try{renderFloorUI();if(!$('#p-bld').hidden)renderBldPanel();if(is3D&&T3)build3D()}catch(e){}}if(is3D)sectionApply();render();if(!$('#p-fire').hidden)renderFire();if(!$('#p-notes').hidden)renderNotes();
}
function undo(){if(!past.length)return toast('Nothing to undo');future.push(snapState());const s=past.pop();pastBytes-=s.length;restoreState(s)}
function redo(){if(!future.length)return toast('Nothing to redo');pushPast(snapState());restoreState(future.pop())}

function markDirty(){dirty=true;setStatus();autosave()}
let asT=null;
/* each save is tied to the tab it came from, so switching tabs mid-way can never write one plan over another */
/* autosave: every change is written to this browser's local storage (not the cache) about half a second later, one entry per tab.
   Returns 'full', 'lite' (saved without the drawing, which did not fit) or false (nothing saved) */
function saveTabData(t,plan){try{syncFloorOut(plan)}catch(e){console.error(e)}PLANS.put(plan);const key=t?'osp-tab-'+t.id:'osp-plan';const txt=JSON.stringify(plan);if(store.set(key,txt))return'full';
  if(plan.underlay&&plan.underlay.src&&store.set(key,JSON.stringify(Object.assign({},plan,{underlay:Object.assign({},plan.underlay,{src:null})}))))return'lite';return false}
const AS={state:'idle',at:0,fileAt:0,fileNote:''};
function autosave(){clearTimeout(asT);const t=curTab,plan=S;AS.state='pending';setStatus();asT=setTimeout(()=>{const r=saveTabData(t,plan);if(t===curTab){AS.state=r||'fail';AS.at=Date.now();
    /* say it once when the browser stops taking autosaves (My plans in IndexedDB still keeps a copy) */
    if(AS.state==='fail'&&!AS.warned){AS.warned=true;toast('Browser storage is full: this plan is no longer autosaved here. My plans still keeps a copy; Save to a file to be safe.')}else if(AS.state!=='fail')AS.warned=false}setStatus()},600)}
const ago=t=>{const d=Math.round((Date.now()-t)/1000);return d<5?'just now':d<60?d+' s ago':d<3600?Math.round(d/60)+' min ago':new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
function storageUse(){let n=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('osp-'))n+=(localStorage.getItem(k)||'').length+k.length}}catch(e){}return n*2}
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
  store.off=true;clearTimeout(asT);try{const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('osp-'))ks.push(k)}ks.forEach(k=>localStorage.removeItem(k))}catch(e){}
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
function applyView(){svg.setAttribute('viewBox',`${V.x} ${V.y} ${W/V.k} ${H/V.k}`);$('#z-val').textContent=Math.round(V.k/0.04*100)+'%'}
/* ---- north: one angle per plan, clockwise from screen-up; the arrow widget, the Building tab, the Sun bar and the PNG export all read it ---- */
function setNorth(v,opts={}){v=((Math.round(+v||0)%360)+360)%360;if(v===num(S.north,0)&&!opts.force)return;if(!opts.quiet)checkpoint();S.north=v;markDirty();drawNorth();if(SUN.on&&typeof applySun==='function')applySun();if(!opts.quiet)toast(v===0?'North is up':`North is ${v}° clockwise from up`)}
/* in 3D the arrow turns with the camera: project the plan's up direction to the screen and add the plan's north angle */
function northScreenAngle(){if(!is3D||!T3||!T3.camera)return 0;const {camera,controls}=T3;const a=controls.target.clone(),b=a.clone();b.z-=1;a.project(camera);b.project(camera);const dx=b.x-a.x,dy=-(b.y-a.y);if(Math.abs(dx)+Math.abs(dy)<1e-6)return 0;return Math.atan2(dx,-dy)*180/Math.PI}
function drawNorth(){const n=num(S.north,0)+northScreenAngle();const w=$('#north');if(w){/* in 3D the arrow only shows the direction; touches pass through to the view so it never blocks an orbit */w.style.pointerEvents=is3D?'none':'';/* desktop: sit just left of the toolbar dock, whatever its width */if(!PHONE()){const d=$('.dock');if(d){const r=d.getBoundingClientRect(),m=$('#main').getBoundingClientRect();if(r.width)w.style.left=Math.max(8,r.left-m.left-w.offsetWidth-14)+'px'}}else w.style.left='';w.style.setProperty('--n',n+'deg');w.title=is3D?`North · ${num(S.north,0)}° clockwise from plan-up · turns with the camera; set it in Details › Floors`:`North · ${num(S.north,0)}° clockwise from up · drag to rotate, double-click to set north up`;w.querySelector('.nv').textContent=num(S.north,0)+'°'}
  const a=$('#bld-north');if(a&&document.activeElement!==a)a.value=n;const b=$('#sun-north');if(b&&document.activeElement!==b)b.value=n}
function northSVG(cx,cy,r,n){/* arrow for exports, in world units */
  return `<g transform="translate(${cx} ${cy}) rotate(${n})" font-family="Inter,Arial,sans-serif"><circle r="${r}" fill="none" stroke="#1d2a38" stroke-width="${r*0.06}"/><path d="M0 ${-r*0.82} L${r*0.26} ${r*0.3} L0 ${r*0.1} L${-r*0.26} ${r*0.3} Z" fill="#1d2a38"/><text y="${-r*0.95}" text-anchor="middle" font-size="${r*0.5}" font-weight="700" fill="#1d2a38">N</text></g>`}
(function(){const w=$('#north');if(!w)return;let drag=null;
  const ang=e=>{const r=w.getBoundingClientRect();return Math.atan2(e.clientX-(r.left+r.width/2),-(e.clientY-(r.top+r.height/2)))*180/Math.PI};
  w.addEventListener('pointerdown',e=>{if(is3D)return;if(e.button!==0&&e.pointerType==='mouse')return;drag={a0:ang(e),n0:num(S.north,0),moved:false};w.setPointerCapture(e.pointerId);e.preventDefault()});
  w.addEventListener('pointermove',e=>{if(!drag)return;const d=ang(e)-drag.a0;if(Math.abs(d)>2)drag.moved=true;if(drag.moved){const v=Math.round((drag.n0+d)/5)*5;S.north=((v%360)+360)%360;drawNorth()}});
  const end=e=>{if(!drag)return;const m=drag.moved,n0=drag.n0;drag=null;if(m){const nv=S.north;S.north=n0;checkpoint();S.north=nv;markDirty();if(SUN.on)applySun();toast(num(S.north,0)===0?'North is up':`North is ${S.north}° clockwise from up`)}};
  w.addEventListener('pointerup',end);w.addEventListener('pointercancel',end);
  w.addEventListener('dblclick',()=>setNorth(0));})();
function toWorld(ev){const r=svg.getBoundingClientRect();return[V.x+(ev.clientX-r.left)/V.k,V.y+(ev.clientY-r.top)/V.k]}
function zoomAt(f,sx,sy){const nk=Math.max(0.002,Math.min(2,V.k*f));const wx=V.x+sx/V.k,wy=V.y+sy/V.k;V.k=nk;V.x=wx-sx/nk;V.y=wy-sy/nk;applyView();render()}
function fit(){
  const pts=[];S.objs.forEach(o=>{const b=objBox(o);pts.push([b.x0,b.y0],[b.x1,b.y1])});
  if(S.underlay&&S.underlay.src&&S.underlay.visible!==false){const u=S.underlay;pts.push([u.x,u.y],[u.x+u.w*u.mpp,u.y+u.h*u.mpp])}
  if(!pts.length){V.k=0.04;V.x=-2000;V.y=-2000;applyView();render();return}
  const b=bboxPts(pts),padL=(P.lib&&!PHONE()?310:20),padR=(P.insp&&!PHONE()?330:20),padT=60,padB=100;
  const aw=Math.max(100,W-padL-padR),ah=Math.max(100,H-padT-padB);
  V.k=Math.min(aw/Math.max(1,b.x1-b.x0),ah/Math.max(1,b.y1-b.y0),1);
  V.x=b.x0-(padL+(aw-(b.x1-b.x0)*V.k)/2)/V.k;V.y=b.y0-(padT+(ah-(b.y1-b.y0)*V.k)/2)/V.k;applyView();render();
}

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
  if(full){for(let i=0;i<info.length;i++)for(let j=i+1;j<info.length;j++){test(info[i],info[j]);ztest(info[i],info[j]);ztest(info[j],info[i])}}
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
  S.objs.filter(o=>o.t==='item'&&visible(o)).sort((a,b)=>isCeil(a)-isCeil(b)).forEach(o=>{
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
  {const le=$('#L-egress');if(le)le.innerHTML=egressLayer()}
  {const lp=$('#L-pins');if(lp)lp.innerHTML=pinsLayer()}
  updateUnderImg();
  if(!$('#p-sch').hidden)renderSchedule();
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
  if(list.length>1){const b=unionBox(list);const p=fs(6);s+=`<rect class="selbox" x="${b.x0-p}" y="${b.y0-p}" width="${b.x1-b.x0+2*p}" height="${b.y1-b.y0+2*p}"/>`}
  if(LY('gaps')&&list.length&&list.every(o=>o.t==='item'))s+=gapsSVG(list);
  if(list.length===1&&list[0].t==='item'){const o=list[0],b=objBox(o);s+=`<text class="dimtx" font-size="${fs(11)}" stroke-width="${fs(3)}" x="${(b.x0+b.x1)/2}" y="${b.y1+fs(16)}" text-anchor="middle">${fmt(o.w)} × ${fmt(o.d)}</text>`}
  s+=liveSVG()+guideSVG;
  $('#L-over').innerHTML=s;
  {const lc=$('#L-cmp');if(lc)lc.innerHTML=cmp?cmpSVG():'';const lg=$('#cmp-legend');if(lg){lg.hidden=!cmp;if(cmp)lg.innerHTML=`<b>vs ${esc(cmp.name)}</b><span class="cl g"></span>added<span class="cl a"></span>changed<span class="cl r"></span>removed<button type="button" id="cmp-x" title="Exit compare">✕</button>`}}
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
    s+=`<g class="${cls}" data-pin="${p.id}" transform="translate(${p.x},${p.y})"><circle class="pin-body" r="${r}"/><text class="pin-n" x="0" y="0" font-size="${fs(12)}">${p.done?'✓':(idx+1)}</text></g>`});
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
function renderFire(){const el=$('#p-fire');if(!el)return;if(el.contains(document.activeElement)&&document.activeElement.tagName==='INPUT')return;
  const cfg=fireCfg(),exN=egressExits().length,sel1=selList();const canMark=sel1.length===1&&(isOpening(sel1[0])||isCore(sel1[0]));
  let res=EG.res&&!EG.res.err?EG.res:null;
  let h=`<p class="big">Travel distance to exits</p>
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
  uimg.style.display='';uimg.setAttribute('x',u.x);uimg.setAttribute('y',u.y);uimg.setAttribute('width',u.w*u.mpp);uimg.setAttribute('height',u.h*u.mpp);uimg.setAttribute('opacity',u.op==null?0.6:u.op);
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

/* ================= library panel ================= */
let libCat='All',libQ='',placeLib=null;
function libIcon(l){
  if(l.shape==='set'){const s=28/Math.max(l.w,l.d);let h='';
    l.comps.forEach(c=>{const li=LIB.find(z=>z.code===c.code&&z.shape!=='set');if(!li)return;const o=Object.assign({},li,{x:0,y:0,r:0});h+=`<g class="it ${catCls(li.cat)}" transform="translate(${c.x} ${c.y}) rotate(${c.r||0})">${shapeSVG(o)}</g>`});
    return `<svg viewBox="-17 -17 34 34" aria-hidden="true"><g transform="scale(${s})">${h}</g></svg>`}
  const door=/^door/.test(l.shape);const m=Math.max(l.w,l.d),s=(door?14:26)/m;const o=Object.assign({},l,{x:0,y:0,r:0});
  return `<svg viewBox="-17 -17 34 34" aria-hidden="true"><g class="it ${catCls(l.cat)}" transform="translate(0 ${door?-7:0}) scale(${s})">${shapeSVG(o)}</g></svg>`;
}
function renderLib(){
  const cats=['All'].concat([...new Set(LIB.map(l=>l.cat))]);
  $('#lib-cats').innerHTML=cats.map(c=>`<button type="button" class="chip${c===libCat?' on':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  const q=libQ.toLowerCase();let html='',last='';
  LIB.forEach((l,i)=>{if(libCat!=='All'&&l.cat!==libCat)return;if(q&&!(l.name+' '+l.code+' '+l.cat).toLowerCase().includes(q))return;
    if(l.cat!==last){html+=`<div class="lib-cat">${esc(l.cat)}</div>`;last=l.cat}
    const sub=l.shape==='set'?`${l.comps.length} items · ${fmt(l.w)} × ${fmt(l.d)} · ${esc(l.code)}${l.missing?' · missing items':''}`:`${fmt(l.w)} × ${fmt(l.d)} · ${esc(l.code)}`;
    html+=`<button type="button" class="lib-row${placeLib===l?' on':''}" draggable="true" data-li="${i}" title="Click, then click on the plan to place. Or drag onto the plan.">${libIcon(l)}<span><span class="nm">${esc(l.name)}</span><br><span class="sz">${sub}</span></span></button>`});
  $('#lib-list').innerHTML=html||'<p class="muted">No furniture matches that search.</p>';
}
$('#lib-q').addEventListener('input',e=>{libQ=e.target.value;renderLib()});
$('#lib-cats').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(b){libCat=b.dataset.cat;renderLib()}});
$('#lib-list').addEventListener('click',e=>{const b=e.target.closest('[data-li]');if(!b)return;const l=LIB[+b.dataset.li];if(placeLib===l){setTool('select');return}if(!!P.rcp!==(l.cat==='Ceiling'))setRCP(l.cat==='Ceiling',true);placeLib=l;placeRot=0;placeFlip=false;setTool('place');renderLib();if(PHONE()&&P.lib){P.lib=false;savePrefs();applyDrawers()}});
$('#lib-list').addEventListener('dragstart',e=>{const b=e.target.closest('[data-li]');if(!b)return;e.dataTransfer.setData('text/osp-lib',b.dataset.li);e.dataTransfer.effectAllowed='copy'});
$('#lib-imp').addEventListener('click',()=>$('#f-lib').click());
$('#f-lib').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(f)importLib(await f.text(),f.name)});
function importLib(text,name){try{LIB=libFromCSV(text);if(LIB.some(l=>l.missing))toast('Some sets list items that are not in this CSV');saveLib();libCat='All';renderLib();toast(`Loaded ${LIB.length} items from ${name}`)}catch(err){toast(err.message)}}
$('#lib-exp').addEventListener('click',async()=>{const r=await saveText('furniture-library.csv',libToCSV(LIB),'text/csv','.csv','CSV file');if(r)toast('Library exported')});
$('#lib-reset').addEventListener('click',()=>{LIB=libFromCSV(DEFAULT_LIB_CSV);store.del('osp-lib');renderLib();toast('Library reset to the built-in list')});

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
const DRAW2D=['room','poly','spline','road','fence','trunk','measure','text','addpt','section','pin','shape','shape-rect','shape-round','shape-L','shape-poly'];
/* tools usable directly in the 3D view (draw on the ground plane). Others still drop to 2D. */
const DRAW3D=['room','poly','spline','road','fence','trunk','measure','text','addpt','section','pin','shape-rect','shape-round','shape-L','shape-poly'];
const d3ClickPoly=t=>['poly','spline','road','fence','trunk','shape-poly'].includes(t);
/* tools that act on a single tap of the floor in 3D */
const d3TapTool=t=>t==='text'||t==='pin';
const d3RectTool=t=>['room','shape-rect','shape-round','shape-L'].includes(t);
function setTool(t){detBox=false;
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
function updateHint(){polyBar();escSync();
  const h=$('#hint');let t='';
  if(tool==='paint'){h.innerHTML=`<b>Paint</b><span style="display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid var(--line);vertical-align:-1px;background:${P.paintCol||'#d9c7a7'}"></span> Click a wall, floor, door or item · Shift-click a room for its walls · Alt-click to pick a colour · 2D and 3D`;h.hidden=false;return}
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
  if(!is3D&&P.rcp&&tool==='select'&&!calib&&!underMove)t='<b>Ceiling plan</b>Furniture is faded · click lights, services and cameras · drag a camera\'s dot to aim it · C back to the floor plan';
  if(is3D&&WALK.on)t='';else if(is3D&&tool==='place'&&placeLib)t=`<b>${esc(placeLib.name)}</b>Click the floor to place · R rotates · Esc to stop`;else if(is3D&&bldView)t='<b>Building</b>Click a floor to open it · drag to orbit · middle or right-drag to pan · PageUp / PageDown change floor · Tab back to 2D';else if(is3D)t='<b>3D view</b>Drag furniture to move it · drag the floor to orbit · middle or right-drag to pan · R rotates · Q adds furniture · Tab back to 2D';
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
  if(ev.button===1||spaceDown||tool==='pan'){drag={m:'pan',sx:ev.clientX,sy:ev.clientY,vx:V.x,vy:V.y};svg.setPointerCapture(ev.pointerId);svg.style.cursor='grabbing';return}
  if(ev.pointerType!=='mouse'&&tool==='select'&&!WALK.on&&!polyPts&&!calib&&!detBox&&!walkPick){clearTimeout(lpTimer);const sx=ev.clientX,sy=ev.clientY,pid=ev.pointerId,tgt=ev.target;
    lpTimer=setTimeout(()=>{if(!pointers.has(pid))return;const p=pointers.get(pid);if(Math.hypot(p[0]-sx,p[1]-sy)>10)return;drag=null;try{svg.releasePointerCapture(pid)}catch(e){}pointers.delete(pid);lpFired=true;lpMenuPid=pid;if(navigator.vibrate)navigator.vibrate(8);showCtx({clientX:sx,clientY:sy,target:tgt,preventDefault(){}})},480)}
  if(ev.pointerType==='touch'&&!polyPts&&!walkPick&&!calib&&!detBox&&!underMove){const onObj=ev.target.closest('[data-id],[data-vh],[data-bh],[data-aim],[data-pin]');
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
    case 'pin':{checkpoint();S.pins=S.pins||[];const pin={id:uid(),x:Math.round(w[0]),y:Math.round(w[1]),text:'',done:false,lv:(S.bld?bldLevel(S).id:null)};S.pins.push(pin);markDirty();openPin(pin.id);return}
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
        const grp=ev.altKey?[o]:groupOf(o);
        if(addMod(ev)){const allIn=grp.every(g=>sel.has(g.id));grp.forEach(g=>allIn?sel.delete(g.id):sel.add(g.id));render();renderInspector();return}
        if(!sel.has(o.id)){sel=new Set(grp.map(g=>g.id))}
        renderInspector();
        drag={m:'move',w0:w,orig:selList().map(x=>[x.id,clone(x)]),moved:false};render();return;
      }
      const addKey=addMod(ev);if(!addKey)sel.clear();
      drag={m:'marq',a:w,b:w,add:addKey,base:new Set(sel)};render();renderInspector();return}
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
    case 'aim':{const o=drag.o;let a=Math.atan2(w[1]-o.y,w[0]-o.x)*180/Math.PI-90;if(!ev.altKey)a=Math.round(a/5)*5;o.r=((Math.round(a*10)/10)%360+360)%360;const ri=$('#p-sel [data-f="r"]');if(ri)ri.value=r1(o.r);markDirty();render();schedulePOV();return}
    case 'bulge':{const o=drag.o,sg=rawSegs(o).find(q=>q[2]===drag.i);if(!sg)return;const g=arcGeom(sg[0],sg[1],0);let h=(w[0]-g.m[0])*g.n[0]+(w[1]-g.m[1])*g.n[1];
      if(Math.abs(h)<fs(8))h=0;else h=Math.round(h/10)*10;h=Math.max(-g.L*1.5,Math.min(g.L*1.5,h));if(!o.bulge)o.bulge=[];while(o.bulge.length<(o.pts||[]).length)o.bulge.push(0);o.bulge[drag.i]=h;clashDirty=true;render();return}
    case 'arr':{drag.b=w;if(Math.hypot(ev.clientX-drag.sx,ev.clientY-drag.sy)>6)drag.moved=true;drawOverlay();updateHint();return}
    case 'vertex':{if(!drag.moved&&Math.hypot(ev.clientX-drag.sx,ev.clientY-drag.sy)<4)return;drag.moved=true;const sn=pointSnap(w,{alt:ev.altKey,exV:{o:drag.o,i:drag.i}});
      if(drag.rect&&!ev.altKey){const R=drag.rect,q=sn.p,a=(q[0]-R.C[0])*R.u[0]+(q[1]-R.C[1])*R.u[1],b=(q[0]-R.C[0])*R.v[0]+(q[1]-R.C[1])*R.v[1],pt=(x,y)=>[Math.round(R.C[0]+R.u[0]*x+R.v[0]*y),Math.round(R.C[1]+R.u[1]*x+R.v[1]*y)];
        const P=drag.o.pts;P[R.iB]=pt(a,0);P[R.iD]=pt(0,b);P[drag.i]=pt(a,b);guideSVG=sn.g;clashDirty=true;render();return}
      drag.o.pts[drag.i]=sn.p;guideSVG=sn.g;clashDirty=true;render();return}
    case 'marq':drag.b=w;{const x0=Math.min(drag.a[0],w[0]),x1=Math.max(drag.a[0],w[0]),y0=Math.min(drag.a[1],w[1]),y1=Math.max(drag.a[1],w[1]),cross=w[0]<drag.a[0];const box={x0,y0,x1,y1};const ns=new Set(drag.base);
      S.objs.forEach(o=>{if(fixed(o))return;if(!visible(o)||!pickable(o))return;const b=objBox(o);const hit=cross?boxHit(b,box):(b.x0>=x0&&b.x1<=x1&&b.y0>=y0&&b.y1<=y1);if(hit)groupOf(o).forEach(g=>ns.add(g.id))});sel=ns;render()}return;
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
    if(tool==='select'&&!multiMode&&!lpFired&&(sel.size||pinSel)&&Math.hypot(ev.clientX-d.sx,ev.clientY-d.sy)<8){sel.clear();pinSel=null;render();renderInspector()}
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
    const x0=Math.min(d.a[0],d.b[0]),x1=Math.max(d.a[0],d.b[0]),y0=Math.min(d.a[1],d.b[1]),y1=Math.max(d.a[1],d.b[1]);
    if((x1-x0)<100||(y1-y0)<100){render();return}
    if(tool==='room'){const n=S.objs.filter(o=>o.t==='room').length+1;addObjs([{id:uid(),t:'room',name:'Room '+n,pts:rectP(x0,y0,x1,y1),gid:null}],true);showTab('sel');return}
    else{const kind=tool.slice(6);const o={id:uid(),t:'item',code:'CUSTOM',name:kind==='round'?'Custom round':(kind==='L'?'Custom L-shape':'Custom rectangle'),cat:'Custom',shape:kind,w:x1-x0,d:y1-y0,h:750,a:Math.round(Math.min(x1-x0,y1-y0)/2),seats:0,cf:0,cb:0,nests:false,rate:null,pts:null,x:(x0+x1)/2,y:(y0+y1)/2,r:0,gid:null,label:''};addObjs([o],true)}
    setTool('select');showTab('sel');return;
  }
  if(d.m==='measure'){if(Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])>10)addObjs([{id:uid(),t:'dim',a:d.a,b:d.b,gid:null}],false);else render();return}
  if(d.m==='section'){if(Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])>200){checkpoint();S.section={a:d.a,b:d.b,on:true,flip:!!(S.section&&S.section.flip)};markDirty();setTool('select');secSel=true;renderInspector();toast('Section line set — open the 3D view to see the slice');if(is3D)sectionApply();sectionBar()}render();return}
  if(d.m==='vertex'&&d.moved&&d.old&&!d.o.site){followWall(d.o,d.old);render()}
  if(d.m==='vertex'||d.m==='bulge'){markDirty();renderInspector();return}
  if(d.m==='marq'){renderInspector();render();return}
  if(d.m==='move'){if(d.moved){markDirty();clashDirty=true}render();renderInspector();return}
});
svg.addEventListener('pointercancel',ev=>{clearTimeout(lpTimer);pointers.delete(ev.pointerId);if(drag&&drag.holdId===ev.pointerId){drag.axisHold=false;drag.holdId=null;return}pinch=null;drag=null;render()});
svg.addEventListener('contextmenu',e=>{e.preventDefault();if(WALK.on||tool==='place'||polyPts||calib||detBox||walkPick)return;showCtx(e)});
function ctxItems(){
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
  const li=e.dataTransfer.getData('text/osp-lib');
  if(li!==''){const l=LIB[+li];if(!l)return;if(l.missing)return toast('This set uses items that are not in the library.');const w=toWorld(e);const keep=[placeLib,placeRot];placeLib=l;placeRot=0;const gh=ghostAt(w,e.altKey);placeLib=keep[0];placeRot=keep[1];addObjs(gh.objs,true);showTab('sel');return}
  const f=e.dataTransfer.files[0];if(!f)return;
  if(/\.json$/i.test(f.name))openPlanText(await f.text(),null,f.name);
  else if(/\.csv$/i.test(f.name))importLib(await f.text(),f.name);
  else loadUnderFile(f);
});

/* ================= edit commands ================= */
function rotateSel(deg){
  if(tool==='place'){placeRot=(placeRot+deg+360)%360;drawOverlay();if(is3D&&placeLib)ghost3D(ghostAt(lastW).objs);return}
  const list=selList().filter(o=>!fixed(o));if(!list.length)return;
  checkpoint();const b=unionBox(list),cx=snapV((b.x0+b.x1)/2),cy=snapV((b.y0+b.y1)/2);
  list.forEach(o=>{
    if(o.t==='item'){const p=rotPt(o.x,o.y,cx,cy,deg);o.x=Math.round(p[0]);o.y=Math.round(p[1]);o.r=(((o.r||0)+deg)%360+360)%360}
    else if(o.t==='text'){const p=rotPt(o.x,o.y,cx,cy,deg);o.x=p[0];o.y=p[1];o.r=(((o.r||0)+deg)%360+360)%360;if(!o.r)delete o.r}
    else if(o.t==='room'||o.t==='wall')o.pts=o.pts.map(p=>rotPt(p[0],p[1],cx,cy,deg).map(Math.round));
    else if(o.t==='dim'){o.a=rotPt(o.a[0],o.a[1],cx,cy,deg);o.b=rotPt(o.b[0],o.b[1],cx,cy,deg)}
    else if(o.t==='trunk')o.pts=o.pts.map(p=>rotPt(p[0],p[1],cx,cy,deg));
  });clashDirty=true;render();renderInspector();
}
/* Delete: the section line, else the selected pin, else the selection */
function deleteAction(){if(secSel&&S.section){checkpoint();S.section=undefined;secSel=false;if(is3D){sectionApply();sectionBar()}render();renderInspector();toast('Section deleted');return}
  if(pinSel){checkpoint();S.pins=(S.pins||[]).filter(p=>p.id!==pinSel);pinSel=null;markDirty();render();renderInspector();if(!$('#p-notes').hidden)renderNotes();toast('Pin deleted');return}
  if(!sel.size)return;deleteSel();toast('Deleted')}
function deleteSel(){if(!sel.size)return;checkpoint();S.objs=S.objs.filter(o=>!sel.has(o.id));sel.clear();clashDirty=true;render();renderInspector()}
let clip=null,pasteN=0;
function copySel(){const l=selList();if(!l.length)return false;clip=clone(l);pasteN=0;store.set('osp-clip',JSON.stringify(clip));toast(`Copied ${l.length} ${l.length===1?'object':'objects'}`);return true}
function pasteClip(atCursor){
  let c=clip;if(!c){try{c=JSON.parse(store.get('osp-clip')||'null')}catch(e){}}
  if(Array.isArray(c)){const seen=new Set();c=c.map(o=>normObj(o,seen)).filter(o=>o&&o!=='unknown')}
  if(!c||!c.length)return toast('Nothing to paste');
  const b=unionBox(c);let dx,dy;
  const inView=lastW[0]>V.x&&lastW[0]<V.x+W/V.k&&lastW[1]>V.y&&lastW[1]<V.y+H/V.k;
  if(atCursor&&inView){dx=snapV(lastW[0]-(b.x0+b.x1)/2);dy=snapV(lastW[1]-(b.y0+b.y1)/2)}else{pasteN++;dx=dy=500*pasteN}
  const gmap={};const out=c.map(o=>{const n=clone(o);n.id=uid();if(n.arr)delete n.arr;if(n.gid){gmap[n.gid]=gmap[n.gid]||uid();n.gid=gmap[n.gid]}moveObj(n,o,dx,dy);return n});
  addObjs(out,true);
}
function duplicateSel(){const l=selList();if(!l.length)return;const keep=clip;clip=clone(l);pasteN=0;pasteClip(false);clip=keep}
function groupSel(){const l=selList();if(l.length<2)return toast('Select two or more objects to group');checkpoint();const g=uid();l.forEach(o=>o.gid=g);render();renderInspector();toast('Grouped')}
function ungroupSel(){const l=selList();if(!l.some(o=>o.gid))return;checkpoint();l.forEach(o=>o.gid=null);render();renderInspector();toast('Ungrouped')}
function nudge(dx,dy){const l=selList().filter(o=>!fixed(o));if(!l.length)return;checkpoint();const orig=l.map(o=>[o.id,clone(o)]);l.forEach(o=>moveObj(o,clone(o),dx,dy));seatWindows(orig,dx,dy);clashDirty=true;render();renderInspector()}
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
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(!r&&!c)continue;const gmap={};l.forEach(o=>{const n=clone(o);n.id=uid();if(group)n.gid=g;else if(n.gid){gmap[n.gid]=gmap[n.gid]||uid();n.gid=gmap[n.gid]}moveObj(n,o,c*px,r*py);out.push(n)})}
  addObjs(out,false);sel=new Set(l.map(o=>o.id).concat(out.map(o=>o.id)));render();renderInspector();toast(`Added ${out.length} copies`);
}

/* ================= inspector ================= */
const panes={sel:'#p-sel',sch:'#p-sch',und:'#p-und',bld:'#p-bld',notes:'#p-notes',fire:'#p-fire'};
const PHONE=()=>matchMedia('(max-width:820px), (pointer:coarse) and (max-height:500px)').matches;
function openInsp(){if(!P.insp){P.insp=true;if(W<1100)P.lib=false;savePrefs();applyDrawers()}}
function showTab(t,explicit){if(!P.insp&&(explicit||!PHONE()))openInsp();Object.entries(panes).forEach(([k,s])=>{$(s).hidden=k!==t;$('#tab-'+k).classList.toggle('on',k===t)});{const tb=$('#tab-'+t);if(tb&&tb.scrollIntoView)try{tb.scrollIntoView({inline:'nearest',block:'nearest'})}catch(e){}}if(t==='sch')renderSchedule();if(t==='und')renderUnderPanel();if(t==='sel')renderInspector();if(t==='bld')renderBldPanel();if(t==='notes')renderNotes();if(t==='fire')renderFire()}
$$('.tabs [data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
/* open the Notes tab on a pin and put the cursor in its comment (double-tap a pin, or drop a new one) */
function openPin(id){pinSel=id;secSel=false;sel.clear();render();renderInspector();showTab('notes',true);renderNotes();
  /* the sheet may re-render once more while it opens, which drops focus; focus now and again a moment later */
  const foc=()=>{const ta=$(`#p-notes textarea[data-pintext="${id}"]`);if(ta&&document.activeElement!==ta){ta.closest('.pin-item').scrollIntoView({block:'nearest'});ta.focus()}};clearTimeout(pinFocT[0]);clearTimeout(pinFocT[1]);pinFocT=[setTimeout(foc,60),setTimeout(foc,320)]}
/* a key or press after the pin opens cancels the late focus retry, so it never grabs focus from what the user did next */
let pinFocT=[];['keydown','pointerdown'].forEach(t=>document.addEventListener(t,e=>{if(pinFocT.length&&!(e.target.closest&&e.target.closest('[data-pin],#p-notes'))){clearTimeout(pinFocT[0]);clearTimeout(pinFocT[1]);pinFocT=[]}},true));
function renderNotes(){const el=$('#p-notes');if(!el)return;if(el.contains(document.activeElement)&&document.activeElement.tagName==='TEXTAREA')return;
  const ps=visPins(),nm=S.bld?levelNames(S.bld):null,cl=curLv();
  let h=`<div class="sec">Notes for this plan</div><textarea id="plan-notes" class="notes-ta" placeholder="Design notes, assumptions, to-dos, references for this plan...">${esc(S.notes||'')}</textarea><p class="muted">Saved with the plan and in the .json file.</p>`;
  h+=`<div class="sec">Pinned comments${S.bld?` · ${nm[cl]}`:''}</div>`;
  if(!ps.length)h+=`<p class="muted">Use the <b>Pin</b> tool, then click the plan to drop a review comment where it belongs${S.bld?' on this floor':''}.</p>`;
  else h+=ps.map((p,i)=>`<div class="pin-item${p.done?' done':''}${pinSel===p.id?' sel':''}"><div class="pin-hd"><span class="pin-no">${p.done?'✓':(i+1)}</span><label class="muted" style="font-size:12px;display:flex;gap:5px;align-items:center"><input type="checkbox" data-pindone="${p.id}"${p.done?' checked':''} style="width:auto"> Done</label><span style="flex:1"></span><button class="btn sm" type="button" data-pingo="${p.id}">Locate</button><button class="btn sm ghost" type="button" data-pindel="${p.id}">Delete</button></div><textarea data-pintext="${p.id}" data-keepfocus placeholder="What needs checking or fixing here…">${esc(p.text||'')}</textarea></div>`).join('');
  el.innerHTML=h}
$('#p-notes').addEventListener('input',e=>{if(e.target.id==='plan-notes'){S.notes=e.target.value;markDirty();return}const pt=e.target.dataset.pintext;if(pt){const p=(S.pins||[]).find(x=>x.id===pt);if(p){p.text=e.target.value;markDirty()}}});
$('#p-notes').addEventListener('change',e=>{const pd=e.target.dataset.pindone;if(pd){const p=(S.pins||[]).find(x=>x.id===pd);if(p){checkpoint();p.done=e.target.checked;markDirty();render();renderNotes()}}});
$('#p-notes').addEventListener('click',e=>{const go=e.target.closest('[data-pingo]'),del=e.target.closest('[data-pindel]');
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
      <div class="sec">Raised floor</div><div class="fld"><label>Height above slab (mm)<input type="number" data-f="raise" value="${r1(o.raise||0)}" step="50" min="0"></label><span></span></div><div class="sec">Colours</div>${colorRow('room-floor',o.floorCol,planFloorCol(),'Floor')}${o.nowall?'':colorRow('room-wall',o.wallCol,planWallCol(),'Walls')}${o.link?'':`<div class="row" style="margin-top:8px"><button class="btn sm" type="button" data-act="addpt">Add points</button></div><p class="muted" style="margin-top:8px">${isRect?'Drag a corner to resize; the room stays rectangular (hold Alt to move one corner on its own).':'Drag the corner handles to reshape.'} Add points, or double-click an edge, to put in a corner. Alt-click a corner to remove it.</p>`}${o.nowall?'':`<div class="sec">Windows on this room's walls</div>${winForm('sel')}<div class="row"><button class="btn sm primary" type="button" data-act="winfill">Add windows</button></div>`}${rotRow}${cmdRow}`}
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
    h=`<p class="big">${l.length} objects selected</p><p class="muted">${fmt(b.x1-b.x0)} × ${fmt(b.y1-b.y0)} mm overall</p><dl class="kv" style="margin-top:8px">${Object.entries(counts).slice(0,8).map(([n,c])=>`<dt>${esc(n)}</dt><dd>${c}</dd>`).join('')}</dl>${rotRow}${cmdRow}
    ${items.length>1?`<div class="sec">Save as a set</div><p class="muted">Adds these ${items.length} items to the library as one entry you can place again, such as a desk, chair and pedestal.</p><div class="fld"><label class="full">Set name<input id="set-name" placeholder="e.g. Workstation set 1400 with screen"></label></div><div class="row"><button class="btn sm" type="button" data-act="toset">Save set to library</button></div>`:''}
    <div class="sec">Align</div><div class="row"><button class="btn sm" type="button" data-act="al-l">Left</button><button class="btn sm" type="button" data-act="al-c">Centre</button><button class="btn sm" type="button" data-act="al-r">Right</button><button class="btn sm" type="button" data-act="al-t">Top</button><button class="btn sm" type="button" data-act="al-m">Middle</button><button class="btn sm" type="button" data-act="al-b">Bottom</button><button class="btn sm" type="button" data-act="al-dh">Space across</button><button class="btn sm" type="button" data-act="al-dv">Space down</button></div>${arrRow}`;
  }
  if(PHONE()&&sel.size&&!S.locked)h=`<div class="macts"><button class="btn" type="button" data-mact="rot">↻ Rotate</button><button class="btn" type="button" data-mact="dup">⧉ Duplicate</button><button class="btn danger" type="button" data-mact="del" style="color:#b3261e">Delete</button></div>`+h;
  el.innerHTML=h;annotateInfo(el);{const one=selList();if(one.length===1&&isCCTV(one[0]))schedulePOV()}
}
let editSession=false;
$('#p-sel').addEventListener('focusin',e=>{if(e.target.matches('[data-f]'))editSession=false});
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
$('#p-sel').addEventListener('focusout',e=>{setTimeout(()=>{if(!$('#p-sel').contains(document.activeElement))renderInspector()},0)});
$('#p-sel').addEventListener('click',e=>{const tc=e.target.closest('[data-trunkc]');if(tc){const l=selList().filter(o=>o.t==='trunk');if(l.length){checkpoint();l.forEach(o=>o.col=tc.dataset.trunkc);markDirty();render();if(is3D)build3D();renderInspector()}return}const pf=e.target.closest('[data-paintface]');if(pf){P.paintFace=pf.checked;savePrefs();updateHint();return}const ps=e.target.closest('[data-paintc]');if(ps){P.paintCol=ps.dataset.paintc;savePrefs();renderInspector();updateHint();return}if(e.target.matches('[data-paintface]')){P.paintFace=e.target.checked;savePrefs();updateHint();return}const sc=e.target.closest('[data-sec]');if(sc){const a=sc.dataset.sec;if(!S.section)return;if(a==='toggle'){checkpoint();S.section.on=!S.section.on}else if(a==='flip'){checkpoint();S.section.flip=!S.section.flip}else if(a==='del'){checkpoint();S.section=undefined;secSel=false}markDirty();if(is3D){sectionApply();sectionBar()}render();renderInspector();return}const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;if(a==='winfill'){runWindowFill('sel',$('#p-sel .winf'));return}if(a==='addpt'){const o=selList()[0];if(o){const t=o.t==='room'&&o.link?byId(o.link):o;setTool('addpt');addPtFor=t.id;sel=new Set([t.id]);render();updateHint()}return}if(a==='unlink'){const o=selList()[0];if(o){checkpoint();delete o.link;o.pts=dropCollinear(o.pts.slice());markDirty();render();renderInspector();toast('The room no longer follows its wall')}return}
  if(a==='ccw')rotateSel(-90);else if(a==='cw')rotateSel(90);else if(a==='dup')duplicateSel();else if(a==='copy')copySel();else if(a==='del')deleteSel();
  else if(a==='group')groupSel();else if(a==='ungroup')ungroupSel();
  else if(a.startsWith('al-'))alignSel(a.slice(3));
  else if(a==='toset')saveSet();
  else if(a==='dflip')applyDoorFlip(false);else if(a==='dswing')applyDoorFlip(true);
  else if(a==='array')arraySel(num($('#ar-r').value,1),num($('#ar-c').value,1),num($('#ar-gx').value,0),num($('#ar-gy').value,0),$('#ar-g').checked);
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
  try{b.levels.forEach((l,i)=>{S.objs=bldObjs(l,real);const D=scheduleData();const gross=floorPlate().reduce((a,p)=>a+Math.abs(polyArea(p)),0)/1e6;
    rows.push({name:nm[l.id],ffl:st[i].ffl,ftf:st[i].ftf,gross,area:D.area,rooms:D.rooms.length,ws:D.ws,seats:D.seats,furn:D.furn,ceil:D.ceil,cost:D.cost,hasRate:D.hasRate,unique:l.unique,active:l===bldLevel(S)})})}finally{S.objs=real}
  rows.reverse();const T=k=>rows.reduce((a,r)=>a+(r[k]||0),0);const top=st[st.length-1];
  return{rows,tot:{gross:T('gross'),area:T('area'),rooms:T('rooms'),ws:T('ws'),seats:T('seats'),furn:T('furn'),ceil:T('ceil'),cost:T('cost')},hasRate:rows.some(r=>r.hasRate),height:top.ffl+top.ftf+ +b.parapet,cores:(b.cores||[]).filter(isCore).length}}
function renderSchedule(){
  const D=scheduleData();
  let h=`<div class="tot"><div><b>${D.ws}</b><span>WORKSTATIONS</span></div><div><b>${D.seats}</b><span>SEATS</span></div><div><b>${D.area.toFixed(1)}</b><span>ROOM AREA m²</span></div><div><b>${D.seats?(D.area/D.seats).toFixed(1):'–'}</b><span>m² PER SEAT</span></div></div>`;
  h+=`<div class="row" style="margin:0 0 10px"><button class="btn sm primary" type="button" id="sch-csv">Export CSV</button><button class="btn sm" type="button" id="sch-copy">Copy for Excel</button></div>`;
  const BS=S.bld&&S.bld.levels.length>1?buildingSchedule():null;
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
  const allP=[];segsA.forEach(s=>allP.push(s.a,s.b));const B=bboxPts(allP);
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
    checkpoint();S.objs=keepObjs.concat(rooms,walls,cols,doors,wins);sel.clear();clashDirty=true;
    if(LY('under')&&S.underlay.op>0.45){S.underlay.op=0.35;updateUnderImg()}
    render();renderInspector();renderUnderPanel();
    const notes=[];if(skew)notes.push(`drawing straightened by ${Math.abs(skew).toFixed(1)}°`);if(single)notes.push('walls read as single lines');if(soft)notes.push('light ink');
    toast(`Traced ${walls.length} walls, ${cols.length} columns, ${doors.length} doors, ${wins.length} windows${D.rooms?` and ${rooms.length} rooms`:''}${replaced?' (replacing the earlier trace here)':''}${notes.length?' · '+notes.join(', '):''}. Check them against the drawing. Undo removes them.`);
  }catch(e){console.error(e);toast('Detection failed: '+(e.message||e))}
}
function makeRoomsFromWalls(){
  const walls=S.objs.filter(o=>o.t==='wall'&&!o.site&&visible(o));if(!walls.length)return toast('Draw or detect some walls first');
  let n=S.objs.filter(o=>o.t==='room').length;
  const rooms=roomsFromWalls(walls,{gap:P.det.gap,keep:S.objs}).map(pts=>({id:uid(),t:'room',name:'Room '+(++n),pts,nowall:true,gid:null}));
  if(!rooms.length)return toast('No new enclosed spaces found between the walls');
  addObjs(rooms,false);toast(`Made ${rooms.length} ${rooms.length===1?'room':'rooms'} from the walls`);
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
    const m=migratePlan(o);
    if(!curUntouched())newTab(blankPlan());S=m.plan;curTab.S=S;past=[];future=[];ensureBld(S);setTimeout(renderFloorUI,0);if(!o.name)S.name=name.replace(/\.json$/i,'');
    if(S.underlay&&S.underlay.src){S.underlay.uid=S.underlay.uid||uid();underCache[S.underlay.uid]=S.underlay.src}
    pdfDoc=null;fileHandle=handle||null;sel.clear();clashDirty=true;$('#pname').value=S.name;syncLock();syncUnder();fit();renderInspector();
    dirty=!handle;AS.fileNote=handle?'':'opened from '+name;setStatus();
    if(m.notes.length)notice('Opened '+name,m.notes,m.fileV<PLAN_V?`Saved with an older version (plan format ${m.fileV}) and upgraded. Save to keep the upgrade.`:'');else toast('Opened '+name);
  }catch(e){toast('Could not open that file: '+e.message)}
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
function snapCompare(id){const s=snaps().find(x=>x.id===id);if(!s)return;ensureBld(S);syncFloorOut(S);
  const cur=flattenPlan(S),old=flattenPlan(s.data);
  const added=[],removed=[],modified=[];
  cur.forEach((v,k)=>{if(!old.has(k))added.push({o:v.o,where:v.where});else{const st=objStatus(v.o,old.get(k).o);if(st!=='same')modified.push({o:v.o,where:v.where,st})}});
  old.forEach((v,k)=>{if(!cur.has(k))removed.push({o:v.o,where:v.where})});
  const curA=roofMode?[]:S.objs,oldRaw=floorObjsOf(s.data,S.bld.active),oldA=oldRaw||[],oldMap=new Map(oldA.map(o=>[o.id,o])),map=new Map();
  curA.forEach(o=>{if(!oldMap.has(o.id))map.set(o.id,'add');else map.set(o.id,objStatus(o,oldMap.get(o.id))==='same'?'same':'mod')});
  const curIds=new Set(curA.map(o=>o.id));
  cmp={snapId:id,name:s.name,time:s.time,map,removed:oldA.filter(o=>!curIds.has(o.id)),counts:{added:added.length,removed:removed.length,modified:modified.length},list:{added,removed,modified},note:oldRaw?'':'This floor did not exist in that snapshot, so everything on it shows as added.'};
  render();renderSnaps();toast('Comparing with: '+s.name)}
function cmpClear(){if(!cmp)return;cmp=null;render();renderSnaps()}
function cmpOutline(o){if(o.pts&&o.pts.length>=2)return[{pts:o.pts,closed:o.t==='room'||o.closed}];
  if(o.t==='dim'&&o.a&&o.b)return[{pts:[o.a,o.b],closed:false}];
  if(o.t!=='text'){try{const bl=bodyLocal(o);if(bl&&bl.length)return bl.map(p=>({pts:toW(o,p),closed:true}))}catch(e){}}
  const b=objBox(o);return[{pts:[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]],closed:true}]}
function cmpSVG(){if(!cmp)return'';const col={add:'#2e9e5b',mod:'#e0a008',same:'#9aa3ab',rem:'#d1453b'},sw=fs(2.6);let s='';
  const path=(o,c,dash,fill)=>{cmpOutline(o).forEach(seg=>{if(!seg.pts||seg.pts.length<2)return;const d='M'+seg.pts.map(p=>p[0]+' '+p[1]).join('L')+(seg.closed?'Z':'');s+=`<path d="${d}" fill="${fill?c:'none'}" fill-opacity="${fill?0.1:0}" stroke="${c}" stroke-width="${sw}"${dash?` stroke-dasharray="${fs(9)} ${fs(6)}"`:''} stroke-linejoin="round" stroke-linecap="round"/>`})};
  cmp.removed.forEach(o=>path(o,col.rem,true,true));
  S.objs.forEach(o=>{const st=cmp.map.get(o.id);if(!st||st==='same')return;path(o,col[st],st==='mod',false)});
  return s}
function cmpDetail(){if(!cmp)return'';const row=(title,arr,cls)=>{if(!arr.length)return'';const li=arr.slice(0,14).map(x=>`<li>${esc(objLabel(x.o))}${x.where?` <span class="muted">· ${esc(x.where)}</span>`:''}${x.st==='moved'?' — moved/resized':x.st==='changed'?' — edited':''}</li>`).join('');const more=arr.length>14?`<li class="muted">…and ${arr.length-14} more</li>`:'';return `<div class="cmp-grp ${cls}"><div class="cmp-h">${title} (${arr.length})</div><ul>${li}${more}</ul></div>`};
  return `<div class="cmp-detail">${row('Added',cmp.list.added,'g-add')}${row('Changed',cmp.list.modified,'g-mod')}${row('Removed',cmp.list.removed,'g-rem')}</div>`}
function renderSnaps(){const body=$('#snap-body');if(!body||$('#snap-modal').hidden)return;const list=snaps();
  let h=`<div class="row" style="justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><button class="btn sm primary" id="snap-take">Take snapshot now</button><label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="snap-onsave" ${P.snapOnSave?'checked':''} style="width:auto"> Snapshot on every save</label></div>`;
  if(cmp)h+=`<div class="snap-cmp"><b>Comparing with "${esc(cmp.name)}"</b> <button class="btn sm ghost" id="snap-exit">Exit compare</button><div class="cmp-sum"><span class="cmp-add">${cmp.counts.added} added</span> · <span class="cmp-mod">${cmp.counts.modified} changed</span> · <span class="cmp-rem">${cmp.counts.removed} removed</span> across the building</div>${cmp.note?`<div class="muted" style="font-size:12px">${esc(cmp.note)}</div>`:''}${cmpDetail()}</div>`;
  if(!list.length)h+=`<p class="muted" style="margin:12px 0">No snapshots yet. Take one to capture the building now, then compare after making changes.</p>`;
  else h+='<div class="snap-list">'+list.slice().reverse().map(s=>`<div class="snap-row"><div class="snap-meta"><b>${esc(s.name)}</b><span class="muted">${new Date(s.time).toLocaleString()}${s.kb?' · '+(s.kb>=1024?(s.kb/1024).toFixed(1)+' MB':s.kb+' KB'):''}</span></div><div class="snap-acts"><button class="btn sm ${cmp&&cmp.snapId===s.id?'primary':''}" data-snap-cmp="${s.id}">${cmp&&cmp.snapId===s.id?'Comparing':'Compare'}</button><button class="btn sm ghost" data-snap-rest="${s.id}">Restore</button><button class="btn sm ghost" data-snap-del="${s.id}" aria-label="Delete snapshot">✕</button></div></div>`).join('')+'</div>';
  body.innerHTML=h}
$('#m-snaps')&&$('#m-snaps').addEventListener('click',()=>{closePops();$('#snap-modal').hidden=false;renderSnaps()});
$('#snap-close')&&$('#snap-close').addEventListener('click',()=>{$('#snap-modal').hidden=true});
$('#snap-modal')&&$('#snap-modal').addEventListener('click',e=>{if(e.target===$('#snap-modal'))$('#snap-modal').hidden=true});
$('#snap-body')&&$('#snap-body').addEventListener('click',e=>{const t=e.target.closest('[data-snap-cmp],[data-snap-rest],[data-snap-del],#snap-take,#snap-exit');if(!t)return;
  if(t.id==='snap-take'){const nm=prompt('Name this snapshot:','Snapshot '+new Date().toLocaleString());if(nm===null)return;snapTake(nm);renderSnaps();return}
  if(t.id==='snap-exit'){cmpClear();return}
  if(t.dataset.snapCmp){snapCompare(t.dataset.snapCmp);return}
  if(t.dataset.snapRest){snapRestore(t.dataset.snapRest);return}
  if(t.dataset.snapDel){if(confirm('Delete this snapshot?'))snapDelete(t.dataset.snapDel);return}});
$('#snap-body')&&$('#snap-body').addEventListener('change',e=>{if(e.target.id==='snap-onsave'){P.snapOnSave=e.target.checked;savePrefs();toast(P.snapOnSave?'A snapshot will be taken on each save':'Snapshot on save turned off')}});
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
  const parts=['L-under','L-rooms','L-zones','L-items','L-anno'].map(id=>{const g=$('#'+id).cloneNode(true);return g.outerHTML}).join('');
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
$('#m-ver').innerHTML=`StoreyBook ${APP_VERSION} · plan format ${PLAN_V} · library ${LIB_V}<br>Your plans stay in this browser; nothing is uploaded.<br>© Jeff Ying. Free to use; not for redistribution. Not for statutory submission.`;
$('#m-rooms').addEventListener('click',()=>{closePops();makeRoomsFromWalls()});
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
  plan:{v:['Select','tool'],h:['Pan','tool'],d:['Room','tool'],w:['Walls','tool'],s:['Shape','tool'],m:['Measure','tool'],t:['Text','tool'],p:['Paint','tool'],
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
  <div class="tip">Try the sample: menu ⋮ → <b>Load sample office floor</b>. It is a full office floor you can change freely.</div>`],
 ['draw','1 · Draw the floor',`<h4>Draw the floor</h4><p><b>From a drawing (fastest):</b></p><ol><li>Menu ⋮ → <b>Load floor plan</b> and pick a PDF or image. The <b>Underlay</b> tab in Details holds the controls.</li><li>Set the scale: click two ends of a known length and type the length.</li><li>Click <b>Detect walls</b>. Columns, walls, windows and rooms are traced for you. Fix anything it missed by hand.</li></ol>
  <p><b>By hand:</b></p><ul><li><b>Room</b> <kbd>D</kbd>: drag rectangles. Drag a corner later and the room stays rectangular; hold <kbd>Alt</kbd> to move one corner on its own.</li><li><b>Walls</b> <kbd>W</kbd>: click corners. Type a number and press <kbd>Enter</kbd> for an exact length. Click the first corner to close the loop and make a room.</li><li><b>Curve</b> <kbd>U</kbd>: click points and the wall curves smoothly through them.</li></ul>
  <p><b>Changing a shape:</b> select it and drag its points. Click <b>Add points</b> in Details (or double-click the line) to put in a new point. <kbd>Alt</kbd>-click a point to remove it.</p>`],
 ['floors','2 · Floors and cores',`<h4>Floors and cores</h4><ul><li>The floor button at the top (L1) switches floors. <kbd>PageUp</kbd> and <kbd>PageDown</kbd> do the same.</li><li>Floors share one <i>typical</i> layout of walls and rooms. Make a floor <b>unique</b> in the Floors tab if its walls differ.</li><li>Furniture is always per floor. <b>Duplicate floor</b> makes a new floor that copies an existing one (its walls and rooms too, if it is unique); <b>Copy fit-out</b> repeats furniture onto floors you already have.</li><li>Stairs, lifts and shafts come from the <b>Core</b> section of the Library. Place one once and it runs through every floor, basements included. Set <b>From</b> and <b>To</b> in Details to limit it.</li><li>Column grids: Floors tab → Column grid. Type bays like <i>3x8400, 6000</i>.</li><li><b>Raised floor</b>: select a room and set its raised-floor height in Details. The floor lifts in 3D and when you walk.</li><li><b>Lifts</b>: in walk mode, step into a lift, then <kbd>PageUp</kbd> / <kbd>PageDown</kbd> to ride to another floor.</li></ul>`],
 ['fit','3 · Fit out',`<h4>Fit out</h4><ol><li>Open the <b>Library</b> (<kbd>L</kbd>) or press <kbd>Q</kbd> to search.</li><li>Click an item, then click the plan to place it. It snaps flush to walls and furniture.</li><li><b>Press and drag</b> instead of clicking to lay out a row or a grid. The count shows as you drag.</li><li><kbd>R</kbd> rotates while placing. Right-click or <kbd>Esc</kbd> stops.</li></ol>
  <ul><li>Select several things with a drag box, then move, copy (<kbd>Ctrl C</kbd> / <kbd>Ctrl V</kbd>), align or array them from Details.</li><li><b>Sets</b> (workstation clusters, meeting sets) place as a group. <kbd>Alt</kbd>-click picks one item inside a group.</li><li><b>Ceiling</b> (<kbd>C</kbd>) shows the ceiling plan for lights, FCUs, sprinklers and CCTV. Select a CCTV to aim it and see what it sees.</li><li><b>Paint</b> (<kbd>P</kbd>): pick a colour, then click a wall, floor, door or item. Shift-click a room for its walls; Alt-click to pick up a colour. Tick <b>Paint one part only</b> to colour a single face in 3D (a table top, not its legs). Works in 2D and 3D.</li><li><b>Trunking</b>: the Trunk tool draws ceiling cable trunking along a path; set its width, height and drop in Details. It shows on the Ceiling layer and overlaps are allowed.</li></ul>`],
 ['site','4 · Site: fence and roads',`<h4>Site: fence and roads</h4><p>The site sits on the ground floor (L1). Outside the building, everything is grass.</p><ol><li><b>Fence</b>: click points around the boundary and click the first point to close it. The area inside shows its size in Details. Change the height there.</li><li><b>Road</b>: click points along the road's centre line, then <kbd>Enter</kbd>. Change the width in Details.</li><li>From the Library's <b>Site</b> section, add gates, boom barriers, a guardhouse, car park lots and trees. Drag to lay out a row of car park lots.</li></ol><div class="tip">Leave a gap in the fence and put a sliding gate in it. The Site layer hides or shows all of it at once.</div>`],
 ['check','5 · Check',`<h4>Check</h4><ul><li><b>MIG</b>: put the rank in the room name (COL, ME5, 2x ME4). A room over its entitlement turns red. Change entitlements in menu ⋮ → MIG entitlements.</li><li><b>Clashes</b>: items that overlap walls or each other are outlined in red.</li><li><b>Schedule</b> tab: counts for every item, per floor and for the building, plus rooms, areas and MIG results. Export it as CSV.</li>
  <li><b>Exits</b> tab (or menu ⋮ → Travel distance to exits): mark doors or exit stairs as <b>final exits</b>, then show the distances. It colours every point by its walking distance to the nearest exit (routed through doors, not walls), labels each room with its longest distance, and flags rooms over the limit or with no route. <b>Advisory only</b> — confirm all figures with your QP / fire consultant.</li></ul>`],
 ['see','6 · See it in 3D',`<h4>See it in 3D</h4><ul><li><b>3D</b> (<kbd>Tab</kbd>): orbit with left drag, pan with right drag, zoom with the wheel.</li><li><b>Building</b>: every floor stacked. Tick <i>Exploded</i> to pull floors apart. Click a floor to open it.</li><li><b>Walk</b>: click where to start and drag to face a direction. <kbd>W A S D</kbd> to move, <kbd>Shift</kbd> to run, <kbd>E</kbd> opens doors and lift doors, <kbd>V</kbd> switches to third person. Walk up a stair to reach the next floor.</li>
  <li><b>Draw in 3D</b>: the drawing tools now work right in the 3D view. Pick Room, Walls, Curve, Road, Fence, a Shape, Measure or Section and draw on the floor — drag for rooms and shapes, click points for walls and roads (Enter, double-click or right-click to finish). Drag empty space to orbit while you draw. Snapping, <kbd>Ctrl</kbd> for a free angle and the live angle all work as in 2D.</li>
  <li><b>Section cut</b>: use the <b>Section</b> tool in 2D or 3D to drag a line across the plan, then view 3D — the model is sliced along that line. Use <b>Section</b> / <b>Flip</b> on the 3D bar to turn it off or flip which side is kept.</li>
  <li><b>Sun study</b>: in 3D press <b>Sun</b>. Pick a month (or Today / 21 Jun / equinox / 21 Dec), then drag the time or type it in. The model lights and shadows for that moment, and the readout shows the sun's direction and height. Screen-up is North by default — set <b>N↑</b> to the compass bearing of up if your site is turned, and <b>Lat</b> to the site latitude (Singapore ≈ 1.35). It's a design aid using local clock time, not an almanac.</li></ul>`],
 ['save','7 · Save and share',`<h4>Save and share</h4><ul><li>Work is <b>autosaved in this browser</b> as you go. The status under the plan name shows when. It stays on this computer and this browser only.</li><li><b>Save</b> writes a plan file (.json). This is the copy to keep and send. Anyone with StoreyBook can open it.</li><li>Export: <b>PNG</b> for slides, <b>CSV</b> schedule for costing, <b>STL</b> for 3D printing,, <b>DXF</b> (2D CAD, mm, current floor) for AutoCAD, and <b>IFC</b> (3D, all floors, metres) to hand the model to architects — it opens or links in Revit as walls, slabs, columns and levels.</li><li>The <b>Notes</b> tab keeps design notes with the plan and lists your <b>pinned comments</b>. Use the <b>Pin</b> tool to drop a review note where it belongs on the plan; tick it done when resolved.</li><li>Tabs along the top let you keep several plans open.</li></ul><div class="tip">Treat a plan file at the classification of the drawing inside it.</div>`],
 ['keys','Shortcuts',`<h4>Shortcuts</h4><p>Press <kbd>?</kbd> at any time for the full keyboard map.</p><ul><li><kbd>V</kbd> select · <kbd>D</kbd> room · <kbd>W</kbd> walls · <kbd>U</kbd> curve · <kbd>M</kbd> measure · <kbd>T</kbd> text</li><li><kbd>2</kbd> 2D view · <kbd>3</kbd> 3D view · <kbd>Tab</kbd> toggles them</li><li><kbd>Ctrl Z</kbd> undo · <kbd>Ctrl Y</kbd> redo · <kbd>Ctrl S</kbd> save</li><li><kbd>F</kbd> fit the plan to the screen · <kbd>Space</kbd> hold to pan</li></ul>`]];
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
$('#pname').addEventListener('change',e=>{checkpoint();S.name=e.target.value.trim()||'Untitled plan';e.target.value=S.name;renderTabs()});
function applyDrawers(){if(P.lib&&P.insp&&(window.innerWidth||W)<1100&&!PHONE())P.lib=false;$('#d-lib').hidden=!P.lib;$('#d-insp').hidden=!P.insp;$('#t-lib').classList.toggle('on',P.lib);$('#t-insp').classList.toggle('on',P.insp);mbarSync()}
$('#t-lib').addEventListener('click',()=>{P.lib=!P.lib;if(P.lib&&W<1100)P.insp=false;savePrefs();applyDrawers()});
$('#t-insp').addEventListener('click',()=>{P.insp=!P.insp;if(P.insp&&W<1100)P.lib=false;savePrefs();applyDrawers();if(P.insp)showTab('sel',true)});
/* ===== phone shell: a five-slot bar and sheets that forward to the desktop controls ===== */
const DRAW_TOOLS=['room','poly','spline','road','fence','shape','measure','text','paint','trunk','section','pin'];
let msheetKind=null;
function msheet(kind){const sh=$('#msheet'),b=$('#msheet-b');if(!sh)return;if(!kind||msheetKind===kind){sh.hidden=true;msheetKind=null;mbarSync();return}
  msheetKind=kind;let h='';
  if(kind==='draw'){h='<h3>Draw</h3><div class="ptiles">'+$$('.dock [data-tool],.dock #t-shape').filter(b=>!['select','pan'].includes(b.dataset.tool)).map(b=>{const key=b.dataset.tool||'shape';const on=(key==='shape'?/^shape/.test(tool):tool===key);return `<button type="button" class="ptile${on?' on':''}" data-pt="${key}">${b.querySelector('svg').outerHTML}<span>${esc(b.textContent.trim())}</span></button>`}).join('')+'</div>'}
  else{const items=[['t-rcp','Ceiling plan'],['t-layers','Layers'],['vbld','Building'],['__floors','Floors'],['m-snaps','Snapshots'],['m-fire','Exits check'],['b-lock',S.locked?'Unlock rooms':'Lock rooms'],['b-set','Settings'],['m-guide','Guide'],['m-plans','My plans'],['m-open','Open file'],['m-save','Save file']];
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
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>{P.lib=false;savePrefs();applyDrawers()}));
function notice(title,lines,foot){const t=$('#toast');t.innerHTML=`<b>${esc(title)}</b>`+lines.map(l=>`<br>· ${esc(l)}`).join('')+(foot?`<br><span style="opacity:.8">${esc(foot)}</span>`:'');t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,9000)}
let toastT=null;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2600)}

/* ================= keyboard ================= */
document.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();const typing=tag==='input'||tag==='textarea'||tag==='select'||e.target.isContentEditable;
  const mod=e.ctrlKey||e.metaKey;const k=e.key.toLowerCase();
  if(mod&&k==='s'){e.preventDefault();savePrefs();savePlan(e.shiftKey);return}
  if(mod&&k==='o'){e.preventDefault();openPlan();return}
  /* Tab flips 2D and 3D from anywhere except form fields, including straight after Q put the cursor in the library search */
  if(e.key==='Tab'&&!mod&&(!typing||e.target.id==='lib-q')){e.preventDefault();if(typing)e.target.blur();if(WALK.on)return;if(bldView){setView('2d');return}set3D(!is3D);return}
  /* Esc in a Details or Notes field leaves the field; the next Esc carries on out (deselect, close) */
  if(typing&&e.key==='Escape'&&!e.target.closest('.modal,#ctxmenu')&&e.target.id!=='lib-q'){e.target.blur();return}
  if(typing)return;
  if(e.key==='?'){e.preventDefault();openKeys();return}
  if(!$('#keys-modal').hidden&&e.key==='Escape'){$('#keys-modal').hidden=true;return}
  if($('#snap-modal')&&!$('#snap-modal').hidden&&e.key==='Escape'){$('#snap-modal').hidden=true;return}
  if(!$('#plans-modal').hidden&&e.key==='Escape'){$('#plans-modal').hidden=true;return}
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
  if(e.key===' '&&!spaceDown){spaceDown=true;svg.style.cursor='grab';e.preventDefault();return}
  if(mod){
    if(k==='z'&&!e.shiftKey){e.preventDefault();undo();return}
    if((k==='z'&&e.shiftKey)||k==='y'){e.preventDefault();redo();return}
    if(k==='c'){if(copySel())e.preventDefault();return}
    if(k==='x'){if(copySel()){e.preventDefault();deleteSel()}return}
    if(k==='v'){if(clip||store.get('osp-clip')){e.preventDefault();pasteClip(true)}return} /* furniture you copied here always wins; otherwise the paste event may carry a floor plan image */
    if(k==='d'){e.preventDefault();duplicateSel();return}
    if(k==='a'){e.preventDefault();setSel(S.objs.filter(o=>!isWallish(o)&&visible(o)&&pickable(o)).map(o=>o.id));return}
    if(k==='g'){e.preventDefault();e.shiftKey?ungroupSel():groupSel();return}
    return;
  }
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
  if(is3D&&!['f','i','l','s'].includes(k)&&!tk[k])return;
  if(tk[k]){setTool(tk[k]);return}
  if(k==='s'){setTool('shape-'+shapeKind);return}
  if(k==='f'){if(is3D)frame3D('persp');else fit();return}
  if(k==='l'){$('#t-lib').click();return}
  if(k==='i'){$('#t-insp').click();return}
  if(e.key==='+'||e.key==='='){zoomAt(1.25,W/2,H/2);return}
  if(e.key==='-'){zoomAt(0.8,W/2,H/2);return}
});
document.addEventListener('paste',e=>{
  const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='textarea'||e.target.isContentEditable)return;
  const items=[...((e.clipboardData&&e.clipboardData.items)||[])];const im=items.find(i=>i.kind==='file'&&/^image\//.test(i.type));
  e.preventDefault();
  if(im){if(S.underlay&&S.underlay.src){toast('To replace the floor plan with the copied image, use Underlay › Paste image');return}const f=im.getAsFile();if(f){const named=new File([f],'Pasted floor plan.'+(f.type.split('/')[1]||'png').replace('jpeg','jpg'),{type:f.type});loadUnderFile(named);return}}
  pasteClip(true);
});
document.addEventListener('keyup',e=>{const wk=walkKey(e);if(wk)WALK.keys.delete(wk);if(e.key==='Shift'||!e.shiftKey)WALK.keys.delete('shift');if(e.key===' '){spaceDown=false;svg.style.cursor=tool==='pan'?'grab':(tool==='select'?'default':'crosshair')}});

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
const LAYER_DEF=[['walls','Walls and rooms'],['site','Site: roads, fences, outdoor items'],['doors','Doors and windows'],['furn','Furniture'],['labels','Room labels'],['areas','Room areas'],['walldims','Wall dimensions'],['measures','Measurements'],['texts','Text labels'],['zones','Clearance zones'],['gaps','Spacing guides'],['under','Floor plan underlay'],['grid','Grid'],['cgrid','Column grid'],['mig','MIG check'],['ceil','Ceiling items'],['cover','Coverage and camera views']];
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
function kick3D(){if(T3){T3.need=true;T3.last=performance.now()}}
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
  const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:false});
  /* phones and tablets: cap the pixel ratio at 1.5, use the cheaper shadow filter and smaller shadow maps; a 390-px phone at 1.5× is still sharp and renders about half the pixels of 2× */
  const LOW_GPU=TOUCH||(navigator.deviceMemory&&navigator.deviceMemory<=4);
  const fullDpr=Math.min(LOW_GPU?1.5:2,window.devicePixelRatio||1);
  renderer.setPixelRatio(fullDpr);renderer.shadowMap.enabled=true;renderer.shadowMap.type=LOW_GPU?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;renderer.outputEncoding=THREE.sRGBEncoding;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(45,1,0.05,1000);
  /* picks right after a rebuild can come before the next frame has placed the new meshes: bring matrices up to date before every ray */
  if(!THREE.Raycaster.prototype._sbFresh){const sf=THREE.Raycaster.prototype.setFromCamera;THREE.Raycaster.prototype.setFromCamera=function(c,cam){cam.updateMatrixWorld();if(T3&&T3.scene)T3.scene.updateMatrixWorld();return sf.call(this,c,cam)};THREE.Raycaster.prototype._sbFresh=true}
  const controls=new THREE.OrbitControls(camera,cv);controls.enableDamping=true;controls.dampingFactor=0.12;controls.maxPolarAngle=Math.PI/2-0.03;controls.screenSpacePanning=true;
  /* same mouse as the 2D plan: left orbits, middle and right pan, wheel zooms */
  controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.PAN};
  const hemi=new THREE.HemisphereLight(0xffffff,0x6f7884,0.8);scene.add(hemi);
  const dir=new THREE.DirectionalLight(0xffffff,0.7);dir.castShadow=true;dir.shadow.mapSize.set(LOW_GPU?1024:2048,LOW_GPU?1024:2048);dir.shadow.bias=-0.0006;scene.add(dir);scene.add(dir.target);
  const group=new THREE.Group();scene.add(group);
  T3={THREE,renderer,scene,camera,controls,dir,hemi,group,lowGPU:!!LOW_GPU,fullDpr,framed:false,raf:null,center:[0,0],span:10,doorState:{},doorPiv:{},liftPiv:{},need:true,last:0,lastRender:0,fullDpr};
  T3.sunGroup=new THREE.Group();T3.sunGroup.userData.noExport=true;scene.add(T3.sunGroup);
  /* render on demand: a frame is drawn when something changed (need), within 0.7 s of input, while walking or a door is moving,
     and once a second as a safety net. A still scene costs almost nothing. */
  T3.loop=()=>{if(!is3D){T3.raf=null;return}const now=performance.now();if(WALK.on)walkStep();else controls.update();const anim=doorsAnimate();
    if(T3.lowDpr&&WALK.on&&T3.walkMoved&&now-T3.walkMoved>500&&!T3.orbiting){T3.lowDpr=false;renderer.setPixelRatio(fullDpr);T3.walkMoved=0}
    if(T3.orbiting||WALK.on||anim||T3.need)drawNorth();
    if(WALK.on||T3.need||anim||now-T3.last<700||now-T3.lastRender>1000){if(bldView)bldLabelsMove();renderer.render(scene,camera);T3.need=false;T3.lastRender=now}
    T3.raf=requestAnimationFrame(T3.loop)};
  controls.addEventListener('change',()=>{T3.need=true;T3.last=performance.now()});
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
  {let lp3=null;const lpClear=()=>{if(lp3){clearTimeout(lp3.t);lp3=null}};
    /* on #v3, ahead of the item handler that stops the event before it reaches the canvas */
    const v3el=$('#v3');v3el.addEventListener('pointerdown',e=>{if(e.target!==cv)return;lpClear();if(e.pointerType==='mouse'||WALK.on||bldView||d3Active()||tool==='place'||tool==='paint')return;
      const ev={clientX:e.clientX,clientY:e.clientY,target:e.target,preventDefault(){}},pid=e.pointerId;
      lp3={pid,x:e.clientX,y:e.clientY,t:setTimeout(()=>{if(!lp3||lp3.pid!==pid)return;lp3=null;
        if(mv3){mv3.orig.forEach(([id,o0])=>{const g=mv3.gs[id];if(g){g.position.set(o0.x*0.001,0,o0.y*0.001);g.rotation.y=-(o0.r||0)*Math.PI/180}});mv3=null}
        down=null;controls.enabled=false;setTimeout(()=>{controls.enabled=true},0);lpFired=true;lpMenuPid=pid;if(navigator.vibrate)navigator.vibrate(8);
        ctxFrom3D(ev,itemAt(ev),floorAt(ev))},480)}},true);
    v3el.addEventListener('pointermove',e=>{if(lp3&&e.pointerId===lp3.pid&&Math.hypot(e.clientX-lp3.x,e.clientY-lp3.y)>10)lpClear();else if(lp3&&e.pointerId!==lp3.pid)lpClear()},true);
    ['pointerup','pointercancel'].forEach(t=>v3el.addEventListener(t,e=>{if(lp3&&e.pointerId===lp3.pid)lpClear()},true))}
  $('#v3').addEventListener('contextmenu',e=>{e.preventDefault();if(WALK.on||bldView)return;if(d3ClickPoly(tool)&&polyPts&&polyPts.length>=2){finishPoly(false);drawD3Overlay();return}if(d3Active()){setTool('select');return}const it=itemAt(e);const g=floorAt(e);ctxFrom3D(e,it,g)});
  /* ---- draw on the ground plane in 3D ---- */
  $('#v3').addEventListener('pointerdown',e=>{if(e.target!==cv||WALK.on||bldView||e.button!==0||!d3Active())return;const w=floorAt(e);if(!w)return;
    if(d3RectTool(tool)||tool==='measure'||tool==='section'){e.stopPropagation();controls.enabled=false;const a=(P.snap&&!altDown&&!ctrlDown&&tool!=='section')?[snapV(w[0]),snapV(w[1])]:[Math.round(w[0]),Math.round(w[1])];d3drag={mode:tool,a,b:a.slice()};try{cv.setPointerCapture(e.pointerId)}catch(x){}drawD3Overlay();return}
    if(d3ClickPoly(tool)){d3down={x:e.clientX,y:e.clientY};/* decide click vs orbit on pointerup */}
  },true);
  $('#v3').addEventListener('pointermove',e=>{if(e.target===cv&&!WALK.on&&!bldView&&e.pointerType==='mouse'){const g=floorAt(e);if(g)lastW=[Math.round(g[0]),Math.round(g[1])]}if(!d3Active())return;const w=floorAt(e);if(w)lastW3=w;
    if(d3drag){e.stopPropagation();d3drag.b=(tool==='measure'&&e.shiftKey)?(Math.abs(w[0]-d3drag.a[0])>Math.abs(w[1]-d3drag.a[1])?[Math.round(w[0]),d3drag.a[1]]:[d3drag.a[0],Math.round(w[1])]):((P.snap&&!altDown&&!ctrlDown&&tool!=='section')?[snapV(w[0]),snapV(w[1])]:[Math.round(w[0]),Math.round(w[1])]);drawD3Overlay();return}
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
      if(tool==='pin'){checkpoint();S.pins=S.pins||[];const pin={id:uid(),x:p[0],y:p[1],text:'',done:false,lv:(S.bld?bldLevel(S).id:null)};S.pins.push(pin);markDirty();setTool('select');build3D();openPin(pin.id);return}
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
function build3D(tg,opts){
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
  if(showU&&!sub){if(!T3.uTex||T3.uTex.src!==u.src){if(T3.uTex)T3.uTex.tex.dispose();const t=new THREE.TextureLoader().load(u.src,()=>kick3D());t.encoding=THREE.sRGBEncoding;T3.uTex={src:u.src,tex:t}}const tex=T3.uTex.tex;const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:u.op==null?0.6:u.op,depthWrite:false});const w=u.w*u.mpp*s,h=u.h*u.mpp*s;const pl=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);pl.rotation.x=-Math.PI/2;pl.position.set(u.x*s+w/2,0.002,u.y*s+h/2);pl.renderOrder=1;pl.userData.noExport=true;group.add(pl)}
  const rooms=LY('walls')?S.objs.filter(o=>o.t==='room'):[];
  /* floor slab under the whole building in the plan floor colour, so corridors, doorways and spaces that are not rooms are coloured too */
  const customFloor=!!(S.style&&S.style.floor);
  floorPlate().forEach(poly=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh,downs,poly);const g=new THREE.ShapeGeometry(sh);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,mat(planFloorCol(),showU&&!customFloor&&!sub?{transparent:true,opacity:0.3}:null));m.position.y=0.0005;m.receiveShadow=true;if(!sub)m.userData.paint='basefloor';group.add(m)});
  /* room floors on top; a chosen colour stays solid even with the drawing showing */
  rooms.forEach(o=>{const custom=!!(o.floorCol||customFloor);const sh=new THREE.Shape(o.pts.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh,downs,o.pts);const g=new THREE.ShapeGeometry(sh);g.rotateX(-Math.PI/2);const ry=o.raise>0?o.raise:0;const m=new THREE.Mesh(g,mat(o.floorCol||planFloorCol(),showU&&!custom&&!sub?{transparent:true,opacity:0.3}:null));m.position.y=ry*s+0.001;m.receiveShadow=true;if(!sub){m.userData.id=o.id;m.userData.paint='floor'}group.add(m);if(ry>0){const sc=mat(o.floorCol||(dark?'#5a636c':'#aeb4bb'));for(let i=0;i<o.pts.length;i++){const a=o.pts[i],bq=o.pts[(i+1)%o.pts.length],L=Math.hypot(bq[0]-a[0],bq[1]-a[1]);if(L<1)continue;const sk=new THREE.Mesh(new THREE.BoxGeometry(L*s,ry*s,40*s),sc);sk.position.set((a[0]+bq[0])/2*s,ry/2*s,(a[1]+bq[1])/2*s);sk.rotation.y=-Math.atan2(bq[1]-a[1],bq[0]-a[0]);sk.castShadow=true;sk.receiveShadow=true;group.add(sk)}}});
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
    const g=new THREE.Group();g.userData.id=o.id;g.position.set(o.x*s,0,o.y*s);g.rotation.y=-(o.r||0)*Math.PI/180;
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
  if(WALK.on&&WALK.roof&&S.bld)buildRoofWalk(group,{s,mat,dark});
  const R=span*s*0.8;dir.position.set(cx*s+R*0.6,R*1.3,cy*s+R*0.9);dir.target.position.set(cx*s,0,cy*s);const sc=dir.shadow.camera;sc.left=-R;sc.right=R;sc.top=R;sc.bottom=-R;sc.near=0.1;sc.far=R*5;sc.updateProjectionMatrix();
  T3.center=[cx*s,cy*s];T3.span=span*s;
  if(!T3.framed){frame3D('persp');T3.framed=true}
  try{sectionApply();sectionBar();if(!sub)applySun();sunBar();if(!sub)d3Sync()}catch(e){}
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
const BV={explode:false,cut:'',furn:'active',hover:null};
function bldObjs(l,real){const b=S.bld;if(l.id===b.active)return real||S.objs;const base=clone(l.unique?(l.base||[]):(b.typical||[]));const nm=l.unique?{}:(l.names||{});base.forEach(o=>{if(o.t==='room'&&nm[o.id]!=null)o.name=nm[o.id]});return base.concat(clone(coresOn(b,b.levels.indexOf(l))),l.fit||[])}
/* cut a core's footprint out of a slab outline (only when it sits inside that outline) */
function coreHoles(sh,cores,poly){const{THREE}=T3;cores.forEach(c=>{const q=toW(c,rectP(-c.w/2,-c.d/2,c.w/2,c.d/2));if(!q.every(p=>pointInPoly(p[0],p[1],poly)))return;sh.holes.push(new THREE.Path(q.map(p=>new THREE.Vector2(p[0]*0.001,-p[1]*0.001))))})}
function buildBld3D(){const{THREE,dir,scene}=T3,group=T3.group,s=0.001;clear3D(group);T3.cols=[];T3.doorPiv={};T3.bldPick=[];if(T3.renderer)T3.renderer.clippingPlanes=[];
  ensureBld(S);syncFloorOut(S);const b=S.bld,L=b.levels,st=levelStack(b),nm=levelNames(b),act=bldLevel(S);const dark=isDark();
  scene.background=new THREE.Color(cssColor('--paper')).convertSRGBToLinear();
  const cache={};const conc=new THREE.MeshStandardMaterial({color:new THREE.Color(dark?'#7d848b':'#b9bcbe').convertSRGBToLinear(),roughness:0.95});
  const cutI=BV.cut?L.findIndex(l=>l.id===BV.cut):L.length-1;const gapE=BV.explode?3500:0;
  const trueObjs=S.objs,real=roofMode?activeStored():S.objs;let bb=null,top=0,bot=0;const plateOf=[];
  try{L.forEach((l,i)=>{if(i>cutI)return;S.objs=bldObjs(l,real);const r=st[i];const y=r.ffl+(i-L.findIndex(x=>x.kind!=='B'))*gapE;
    const g=new THREE.Group();g.position.y=y*s;group.add(g);
    const furn=BV.furn==='all'||(BV.furn==='active'&&l===act);
    const info=build3D(g,{wallH:r.ceiling+r.void,ceil:r.ceiling,noFurn:!furn,cache,lvI:i,ftf:r.ftf});const plates=floorPlate();plateOf[i]=plates;
    /* the slab this floor stands on: the lowest floor gets a ground slab */
    const below=i>0?st[i-1].slab:Math.max(+b.slab,200);
    const holes=i>0?(b.cores||[]).filter(c=>isCore(c)&&coreOn(b,c,i)&&coreOn(b,c,i-1)):[];
    plates.forEach(poly=>{const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0]*s,-p[1]*s)));coreHoles(sh,holes,poly);const geo=new THREE.ExtrudeGeometry(sh,{depth:below*s,bevelEnabled:false});geo.rotateX(-Math.PI/2);const m=new THREE.Mesh(geo,conc);m.position.y=-below*s-0.0002;m.castShadow=true;m.receiveShadow=true;g.add(m)});
    if(info&&info.B){const B=info.B;bb=bb?{x0:Math.min(bb.x0,B.x0),y0:Math.min(bb.y0,B.y0),x1:Math.max(bb.x1,B.x1),y1:Math.max(bb.y1,B.y1)}:Object.assign({},B)}
    const h=r.ceiling+r.void;top=Math.max(top,y+h+(i===L.length-1&&i===cutI?r.slab+ +b.parapet:0));bot=Math.min(bot,y-below);
    /* invisible box for hover and click */
    const B=info?info.B:{x0:-5000,y0:-5000,x1:5000,y1:5000};const pk=new THREE.Mesh(new THREE.BoxGeometry((B.x1-B.x0+400)*s,(h+below)*s,(B.y1-B.y0+400)*s),new THREE.MeshBasicMaterial({color:new THREE.Color(cssColor('--accent')),transparent:true,opacity:0,depthWrite:false}));
    pk.position.set((B.x0+B.x1)/2*s,(y+(h-below)/2)*s,(B.y0+B.y1)/2*s);pk.userData.level=l.id;group.add(pk);T3.bldPick.push({mesh:pk,id:l.id,name:nm[l.id],y:y+h/2,B,active:l===act})});
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
  bb=bb||{x0:-5000,y0:-5000,x1:5000,y1:5000};const cx=(bb.x0+bb.x1)/2,cy=(bb.y0+bb.y1)/2,span=Math.max(bb.x1-bb.x0,bb.y1-bb.y0,top-bot,6000);
  /* ground at L1, see-through so basements show below */
  const gs=span*2.2*s;const ground=new THREE.Mesh(new THREE.PlaneGeometry(gs,gs),new THREE.MeshStandardMaterial({color:new THREE.Color(isDark()?'#3b4436':'#b9c4a4').convertSRGBToLinear(),transparent:true,opacity:L.some(l=>l.kind==='B')?0.55:1,depthWrite:false,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.set(cx*s,-0.004,cy*s);ground.receiveShadow=true;ground.renderOrder=-1;ground.userData.noExport=true;group.add(ground);
  const R=span*s;dir.position.set(cx*s+R*0.6,top*s+R*1.2,cy*s+R*0.9);dir.target.position.set(cx*s,0,cy*s);const sc=dir.shadow.camera;sc.left=-R;sc.right=R;sc.top=R;sc.bottom=-R;sc.near=0.1;sc.far=R*6;sc.updateProjectionMatrix();
  T3.center=[cx*s,cy*s];T3.span=span*s;T3.cy=(top+bot)/2*s;bldLabels(T3.bldPick);
  if(!T3.framed){frame3D('persp');T3.framed=true}
  try{applySun();sunBar();d3Sync()}catch(e){}}
/* floor names beside the building, kept in place every frame */
function bldLabels(list){const host=$('#v3');host.querySelectorAll('.bld-lbl').forEach(e=>e.remove());T3&&(T3.bldLbl=null);if(!list||!T3)return;
  T3.bldLbl=list.map(p=>{const d=document.createElement('div');d.className='bld-lbl'+(p.active?' on':'');d.textContent=p.name;host.appendChild(d);return{el:d,p}})}
function bldLabelsMove(){if(!T3||!T3.bldLbl)return;const{THREE,camera}=T3,r=$('#v3c').getBoundingClientRect(),h=$('#v3').getBoundingClientRect();
  /* labels sit at whichever corner of the building is furthest left on screen, so they stay on the visible side as you orbit */
  const B0=T3.bldLbl[0].p.B,cs=[[B0.x0,B0.y0],[B0.x1,B0.y0],[B0.x1,B0.y1],[B0.x0,B0.y1]];let ci=0,mx=1e9;cs.forEach((c,i)=>{const v=new THREE.Vector3(c[0]*0.001,T3.cy,c[1]*0.001).project(camera);if(v.x<mx){mx=v.x;ci=i}});const C=cs[ci];
  T3.bldLbl.forEach(({el,p})=>{const v=new THREE.Vector3(C[0]*0.001,p.y*0.001,C[1]*0.001).project(camera);if(v.z>1){el.style.display='none';return}el.style.display='';el.style.left=((v.x+1)/2*r.width+r.left-h.left-8)+'px';el.style.top=((1-v.y)/2*r.height+r.top-h.top)+'px';el.classList.toggle('hov',BV.hover===p.id)})}
function bldPickAt(e){if(!T3||!T3.bldPick)return null;const{THREE,camera}=T3,r=$('#v3c').getBoundingClientRect();const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
  const h=rc.intersectObjects(T3.bldPick.map(p=>p.mesh),false)[0];return h?h.object.userData.level:null}
function bldHover(id){if(BV.hover===id)return;BV.hover=id;kick3D();(T3.bldPick||[]).forEach(p=>{p.mesh.material.opacity=p.id===id?0.13:0});$('#v3c').style.cursor=id?'pointer':''}
function renderBldBar(){const b=S.bld,nm=levelNames(b);const c=$('#v3-cut');if(c)c.innerHTML='<option value="">All floors</option>'+b.levels.slice().reverse().map(l=>`<option value="${l.id}"${BV.cut===l.id?' selected':''}>Up to ${nm[l.id]}</option>`).join('');}
$('#v3-cut').addEventListener('change',e=>{BV.cut=e.target.value;build3D()});
$('#v3-exp').addEventListener('change',e=>{BV.explode=e.target.checked;T3.framed=false;build3D()});
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
function doorsAnimate(){if(!T3)return false;let moving=false;Object.entries(T3.doorPiv).forEach(([id,piv])=>{const ds=T3.doorState[id];if(!ds)return;const tg=ds.open?Math.PI/2:0;if(Math.abs(ds.a-tg)<0.002)return;moving=true;ds.a+=(tg-ds.a)*0.18;if(Math.abs(ds.a-tg)<0.01)ds.a=tg;piv.forEach(q=>q.pv.rotation.y=-q.dir*ds.a)});
  Object.entries(T3.liftPiv).forEach(([id,lp])=>{const ds=T3.doorState[id];const tg=ds&&ds.open?1:0;if(ds&&ds.s==null)ds&&(ds.s=tg);const cur=ds?ds.s:0;if(Math.abs(cur-tg)<0.002)return;moving=true;const nv=cur+(tg-cur)*0.18,v=Math.abs(nv-tg)<0.01?tg:nv;if(ds)ds.s=v;lp.left.position.x=(lp.lx-v*lp.slide)*0.001;lp.right.position.x=(lp.rx+v*lp.slide)*0.001});return moving}
/* a shut door blocks the opening like a thin wall */
function doorCols(){const out=[];if(!T3)return out;S.objs.forEach(o=>{if(o.t!=='item'||!visible(o))return;
  if(/^door/.test(o.shape)){const ds=T3.doorState[o.id];if(!ds||ds.open)return;const p=toW(o,[[-o.w/2,0],[o.w/2,0]]);out.push({a:p[0],b:p[1],t:60});return}
  if(isCore(o)&&o.shape==='lift'){const ds=T3.doorState[o.id];if(ds&&ds.open)return;const t=200,hd=o.d/2,oh=Math.min(550,Math.max(60,(o.w-2*t-200)/2));const p=toW(o,[[-oh,hd-t/2],[oh,hd-t/2]]);out.push({a:p[0],b:p[1],t:60})}});return out}
/* the door you are looking at, within reach */
function walkTarget(){const f=[-Math.sin(WALK.yaw),-Math.cos(WALK.yaw)];let best=null;
  S.objs.forEach(o=>{if(o.t!=='item'||!(/^door/.test(o.shape)||o.shape==='lift')||!visible(o))return;const dx=o.x-WALK.pos[0],dy=o.y-WALK.pos[1],d=Math.hypot(dx,dy);if(d>2200)return;const dot=d<1?1:(dx*f[0]+dy*f[1])/d;if(dot<0.4&&d>800)return;const sc=d*(1.7-dot);if(!best||sc<best.sc)best={o,sc}});return best?best.o:null}
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
const floorHist=new WeakMap();/* undo history per floor, kept while the planner is open */
let roofMode=false,roofRefObjs=[],roofStash=null;
function topLevel(){const b=S.bld,ls=b.levels.filter(l=>l.kind!=='B');return ls[ls.length-1]||b.levels[b.levels.length-1]}
function enterRoof(){if(roofMode)return;ensureBld(S);if(WALK.on)walkStop(true);syncFloorOut(S);const b=S.bld,tl=topLevel();
  roofRefObjs=bldObjs(tl).filter(o=>(o.t==='wall'&&!o.site)||o.t==='room');
  roofMode=true;S.objs=clone(b.roofFit||[]);sel.clear();secSel=false;pinSel=null;roofStash={past,future,bytes:pastBytes};past=[];future=[];pastBytes=0;clashDirty=true;
  if(tool!=='select'&&tool!=='place')setTool('select');if(is3D)bldView=true;renderFloorUI();render();renderInspector();if(is3D&&T3){$('#v3d').classList.toggle('on',false);$('#vbld').classList.toggle('on',true);$('#main').classList.toggle('bldmode',true);build3D()}toast('Roof — place plant & M&E (condensers, AHUs…). The grey outline is the building below.')}
function saveRoof(){if(S&&S.bld)S.bld.roofFit=clone(S.objs.filter(o=>o.t==='item'))}
function exitRoof(){if(!roofMode)return;saveRoof();roofMode=false;roofRefObjs=[];syncFloorIn(S);sel.clear();clashDirty=true;if(roofStash){past=roofStash.past;future=roofStash.future;pastBytes=roofStash.bytes;roofStash=null}}
function switchFloor(id,keepWalk){ensureBld(S);const b=S.bld;
  if(id==='roof'){if(roofMode)switchFloor(b.active);else enterRoof();return}
  if(roofMode){exitRoof();if(id===b.active){render();renderInspector();renderFloorUI();if(is3D&&T3)build3D();return}}
  if(id===b.active){renderFloorUI();return}const from=bldLevel(S),to=b.levels.find(l=>l.id===id);if(!to)return;
  if(WALK.on&&!keepWalk)walkStop(true);WALK.roof=false;if(tool!=='select')setTool('select');syncFloorOut(S);floorHist.set(from,{past,future});
  b.active=id;syncFloorIn(S);const h=floorHist.get(to);past=h?h.past:[];future=h?h.future:[];sel.clear();clashDirty=true;
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
  let dbp=null;const open=()=>dbp||(dbp=new Promise((res,rej)=>{try{const q=indexedDB.open('storeybook',1);q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains('plans'))db.createObjectStore('plans',{keyPath:'pid'})};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}catch(e){rej(e)}}));
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
    if(other){clearTimeout(other.asT);store.del('osp-tab-'+other.id);tabs.splice(tabs.indexOf(other),1);saveTabIndex();renderTabs()}await PLANS.del(pid);openPlans();return}
  if(act==='rename'){const r=await PLANS.get(pid);if(!r)return;const n=prompt('Plan name',r.name);if(!n||!n.trim())return;const p=JSON.parse(r.data);p.name=n.trim();const live=tabs.find(t=>(t===curTab?S:t.S).pid===pid);if(live){(live===curTab?S:live.S).name=p.name;if(live===curTab){$('#pname').value=p.name;renderTabs()}}PLANS.put(p);PLANS.flush();setTimeout(openPlans,120);return}
  if(act==='dup'){const r=await PLANS.get(pid);if(!r)return;const p=JSON.parse(r.data);p.pid=uid();p.name=(p.name||'Untitled plan')+' copy';delete p.saved;newTab(migratePlan(p).plan);$('#plans-modal').hidden=true;toast(`Opened "${p.name}"`);return}
});
/* ================= plan tabs =================
   Each tab is a whole plan with its own undo history, file, underlay and view. Each is autosaved under its own key. */
var tabs=[],curTab=null;
function captureTab(){if(!curTab)return;clearTimeout(asT);saveTabData(curTab,S);Object.assign(curTab,{S,sel,fileHandle,dirty,past,future,pdfDoc,pdfName,V:{x:V.x,y:V.y,k:V.k}})}
function applyTab(t){
  if(WALK.on)walkStop(true);if(tool!=='select')setTool('select');calib=null;detBox=false;underMove=false;walkPick=false;
  curTab=t;S=t.S;sel=t.sel||new Set();fileHandle=t.fileHandle||null;dirty=!!t.dirty;past=t.past||[];future=t.future||[];pdfDoc=t.pdfDoc||null;pdfName=t.pdfName||'';
  if(S.underlay&&S.underlay.src){S.underlay.uid=S.underlay.uid||uid();underCache[S.underlay.uid]=S.underlay.src}
  $('#pname').value=S.name;syncLock();syncUnder();clashDirty=true;
  if(t.V){V.x=t.V.x;V.y=t.V.y;V.k=t.V.k;applyView();render()}else fit();
  AS.state='idle';AS.fileNote='';ensureBld(S);renderInspector();setStatus();renderTabs();saveTabIndex();updateHint();renderFloorUI();
  if(is3D&&T3){T3.framed=false;build3D()}
}
const curUntouched=()=>!S.objs.length&&!(S.underlay&&S.underlay.src)&&!past.length&&!fileHandle;
function newTab(plan){
  if(curTab&&curUntouched()){curTab.V=null;curTab.S=plan;applyTab(Object.assign(curTab,{S:plan,sel:new Set(),past:[],future:[],dirty:false,fileHandle:null,pdfDoc:null,V:null}));autosave();return curTab}
  captureTab();const t={id:uid(),S:plan,sel:new Set(),past:[],future:[],dirty:false,fileHandle:null,pdfDoc:null,pdfName:'',V:null};
  tabs.splice(tabs.indexOf(curTab)+1,0,t);saveTabData(t,plan);applyTab(t);return t;
}
function switchTab(t){if(!t||t===curTab)return;captureTab();applyTab(t)}
function closeTab(t){
  const live=t===curTab?S:t.S,isDirty=t===curTab?dirty:t.dirty;
  if(isDirty&&live.objs.length&&!confirm(`"${live.name}" has changes that are not saved to a file. Close the tab anyway?`))return;
  store.del('osp-tab-'+t.id);const i=tabs.indexOf(t);tabs.splice(i,1);
  if(!tabs.length){const n={id:uid(),S:blankPlan(),sel:new Set(),past:[],future:[],dirty:false,V:null};tabs.push(n);applyTab(n);autosave();return}
  if(t===curTab)applyTab(tabs[Math.min(i,tabs.length-1)]);else{renderTabs();saveTabIndex()}
}
function saveTabIndex(){store.set('osp-tabs',JSON.stringify({ids:tabs.map(t=>t.id),active:curTab&&curTab.id}))}
function renderTabs(){const el=$('#ptabs');if(!el)return;el.classList.toggle('single',tabs.length<2);
  el.innerHTML=tabs.map(t=>{const on=t===curTab,nm=on?S.name:t.S.name,dt=on?dirty:t.dirty;
    return `<div class="ptab${on?' on':''}" data-tab="${t.id}" title="${esc(nm)}${dt?' · not saved to a file':''}"><span class="nm">${esc(nm||'Untitled plan')}</span>${dt?'<i class="dot" aria-label="Not saved to a file"></i>':''}<button type="button" class="x" data-tab-close="${t.id}" aria-label="Close ${esc(nm)}">×</button></div>`}).join('')+
    `<button type="button" class="ptab-add" id="ptab-add" title="New blank plan in a new tab" aria-label="New tab">+</button>`}
$('#ptabs').addEventListener('click',e=>{const c=e.target.closest('[data-tab-close]');if(c){e.stopPropagation();closeTab(tabs.find(t=>t.id===c.dataset.tabClose));return}
  if(e.target.closest('#ptab-add')){newTab(blankPlan());return}const t=e.target.closest('[data-tab]');if(t)switchTab(tabs.find(x=>x.id===t.dataset.tab))});
$('#ptabs').addEventListener('auxclick',e=>{if(e.button!==1)return;const t=e.target.closest('[data-tab]');if(t){e.preventDefault();closeTab(tabs.find(x=>x.id===t.dataset.tab))}});

resize();
let bootNotes=[];
{ /* restore every tab from the last session; fall back to the single autosave of older versions, then the sample */
  let idx=null;try{idx=JSON.parse(store.get('osp-tabs')||'null')}catch(e){}
  const load=raw=>{try{const m=migratePlan(raw);m.notes.forEach(n=>{if(!bootNotes.includes(n))bootNotes.push(n)});return Object.assign(blankPlan(),m.plan)}catch(e){return null}};
  if(idx&&Array.isArray(idx.ids))idx.ids.forEach(id=>{let raw=null;try{raw=JSON.parse(store.get('osp-tab-'+id)||'null')}catch(e){}const pl=raw&&Array.isArray(raw.objs)&&load(raw);if(pl)tabs.push({id,S:pl,sel:new Set(),past:[],future:[],dirty:true,V:null})});
  if(!tabs.length){let saved=null;try{saved=JSON.parse(store.get('osp-plan')||'null')}catch(e){}const pl=saved&&Array.isArray(saved.objs)&&load(saved);if(pl)tabs.push({id:uid(),S:pl,sel:new Set(),past:[],future:[],dirty:true,V:null})}
  let fresh=false;if(!tabs.length){S=blankPlan();tabs.push({id:uid(),S,sel:new Set(),past:[],future:[],dirty:false,V:null});fresh=true}
  tabs.forEach(t=>{if(!store.get('osp-tab-'+t.id))saveTabData(t,t.S)});
  applyTab(tabs.find(t=>idx&&t.id===idx.active)||tabs[0]);
  window.addEventListener('pagehide',()=>{if(curTab&&!store.off){clearTimeout(asT);saveTabData(curTab,S)}});
  $('#status').addEventListener('click',e=>{e.stopPropagation();const p=$('#pop-save'),open=p.hidden;closePops();if(!open)return;renderSavePop();const r=e.currentTarget.getBoundingClientRect();p.style.left=Math.max(8,r.left)+'px';p.style.top=(r.bottom+6)+'px';p.hidden=false});
  $('#pop-save').addEventListener('click',e=>{const b=e.target.closest('[data-sv]');if(!b)return;$('#pop-save').hidden=true;if(b.dataset.sv==='save')$('#m-save').click();else wipeLocal()});
  $('#m-wipe').addEventListener('click',()=>{closePops();wipeLocal()});
}
setTool('select');setStatus();renderInspector();
document.title=`StoreyBook ${APP_VERSION}`;
/* on the website, a newer build shows a reload banner; the single file skips this */
if(/^https?:$/.test(location.protocol)){const chk=()=>fetch('version.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(j&&j.v&&j.v!==APP_VERSION){const b=$('#upd');if(b){b.hidden=false;b.querySelector('b').textContent=j.v}}}).catch(()=>{});
  setTimeout(chk,2500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)chk()});$('#upd-go')&&$('#upd-go').addEventListener('click',()=>location.reload());$('#upd-x')&&$('#upd-x').addEventListener('click',()=>{$('#upd').hidden=true})}
{const all=libNotes.concat(bootNotes);if(all.length)setTimeout(()=>notice('Updated to version '+APP_VERSION,all,''),400)}
/* on-screen keyboard: when it opens (the visual viewport shrinks) the field being typed in is scrolled into the part still visible */
if(window.visualViewport){const vv=window.visualViewport;const keep=()=>{const a=document.activeElement;if(!a||!a.matches||!a.matches('input,textarea,select'))return;const r=a.getBoundingClientRect(),bot=vv.offsetTop+vv.height;if(r.bottom>bot-8||r.top<vv.offsetTop)try{a.scrollIntoView({block:'center',inline:'nearest'})}catch(e){}};vv.addEventListener('resize',()=>{setTimeout(keep,50);setTimeout(keep,200)});window.addEventListener('resize',()=>setTimeout(keep,120));document.addEventListener('focusin',()=>setTimeout(keep,300))}
/* accessibility: every control gets a name (from its label row, title or placeholder) as panels are drawn,
   and closing a dialog, sheet or popover hands the focus back to the control that opened it */
{const nameOf=el=>{if(el.getAttribute('aria-label')||el.getAttribute('aria-labelledby'))return null;if(el.labels&&el.labels.length&&el.labels[0].textContent.trim())return null;
    if(el.tagName==='BUTTON'&&el.textContent.trim())return null;const t=el.getAttribute('title')||el.getAttribute('placeholder');if(t)return t;
    const row=el.closest('.set,.fld label,label,.row,.ck');const txt=row?[...row.childNodes].filter(n=>n!==el&&!(n.nodeType===1&&n.matches('input,select,textarea,button'))).map(n=>n.textContent).join(' ').replace(/\s+/g,' ').trim():'';
    return txt||(el.type==='color'?'Colour':el.dataset&&el.dataset.f?el.dataset.f:null)};
  const pass=root=>{(root.querySelectorAll?root:document).querySelectorAll('input:not([type=hidden]),select,textarea,button').forEach(el=>{const n=nameOf(el);if(n)el.setAttribute('aria-label',n.slice(0,80))})};
  let qd=false;new MutationObserver(ms=>{if(qd||ms.every(m=>m.target.closest&&m.target.closest('svg,#v3c')))return;qd=true;requestAnimationFrame(()=>{qd=false;pass(document)})}).observe(document.body,{childList:true,subtree:true});pass(document);
  let opener=null;document.addEventListener('pointerdown',e=>{const b=e.target.closest('button,[role=button]');if(b)opener=b},true);document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const b=document.activeElement;if(b&&b.matches&&b.matches('button'))opener=b}},true);
  /* phones: while a text field has focus the on-screen keyboard is up; the bottom bar steps aside so it cannot cover the field */
  const kbdEl=e=>e&&e.matches&&e.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),textarea,[contenteditable=true]');
  document.addEventListener('focusin',e=>{if(TOUCH&&PHONE()&&kbdEl(e.target))document.documentElement.classList.add('kbd')});document.addEventListener('focusout',e=>{if(kbdEl(e.target))setTimeout(()=>{if(!kbdEl(document.activeElement))document.documentElement.classList.remove('kbd')},0)});
  /* switch toggles in Settings take their name from the row text */
  $$('.set .sw input').forEach(i=>{if(!i.getAttribute('aria-label')){const t=i.closest('.set').querySelector(':scope>span');if(t)i.setAttribute('aria-label',t.textContent.trim())}});
  const dlg='.keys-modal,.pop,#msheet,#snap-modal,#plans-modal,#ctxmenu';const back=new Map();
  new MutationObserver(ms=>ms.forEach(m=>{const el=m.target;if(!el.matches||!el.matches(dlg))return;if(!el.hidden){if(opener&&!el.contains(opener)){/* opened from inside a menu or sheet: focus goes back to what opened that menu */const d=opener.closest(dlg);back.set(el,d&&d!==el&&back.get(d)||opener)}}else{const o=back.get(el);if(o&&o.isConnected&&o.offsetParent&&(document.activeElement===document.body||el.contains(document.activeElement)))try{o.focus({preventScroll:true})}catch(x){}}})).observe(document.body,{attributes:true,attributeFilter:['hidden'],subtree:true})}
/*@dev-only*/if(location.hash==='#osp-debug')window.__osp={S:()=>S,envOf:o=>envOf(o),V,LIB:()=>LIB,APP_VERSION,PLAN_V,openPlanText:(t,n)=>openPlanText(t,null,n||'test'),migratePlan:o=>migratePlan(o),clash:()=>{computeClash();return clashCache},setNorth:v=>setNorth(v,{quiet:true}),PLANS,tabsRaw:()=>tabs,curTab:()=>curTab,isDirty:()=>dirty,markDirty,closeTab:t=>closeTab(t),sunVec:(a,e)=>sunVec(a,e),northSVG,migMap:()=>migMap(),sel:()=>[...sel],planJSON,WALK,walkStep:()=>walkStep(),insertCorner:(o,w)=>insertCorner(o,w),toWorld,floorPlate:()=>floorPlate(),T3:()=>T3,walkInteract:()=>walkInteract(),doorsAnimate:()=>doorsAnimate(),walkTarget:()=>walkTarget(),rideLift:d=>rideLift(d),walkLiftAt:p=>walkLiftAt(p),walkGround:p=>walkGround(p),walkResolve:p=>walkResolve(p),switchFloor:(id,k)=>switchFloor(id,k),exportDXF:()=>exportDXF(),exportIFC:()=>exportIFC(),pins:()=>S.pins,pinSel:()=>pinSel,reorderLevel:(a,t,bl)=>reorderLevel(a,t,bl),d3Active:()=>d3Active(),polyPts:()=>polyPts,migRoom:o=>migRoom(o),egressRun:s=>egressRun(s),egressCompute:()=>egressCompute(),sectionApply:()=>sectionApply(),EG:()=>EG,secSel:()=>secSel,setSecSel:v=>{secSel=v},makeColArray:(o,r,c,gx,gy)=>makeColArray(o,r,c,gx,gy),editArray:(o,ch)=>editArray(o,ch),undo:()=>undo(),redo:()=>redo(),setTool:t=>setTool(t),setSel:ids=>{sel=new Set(ids);renderInspector();render()},SUN:()=>SUN,sunPos:(la,doy,h)=>sunPos(la,doy,h),applySun:()=>applySun(),dayOfYear:(m,d)=>dayOfYear(m,d),snapNext:(tl,last,w)=>{const pt=tool;const pp=polyPts;tool=tl;polyPts=[last];const r=nextPolyPt(w,false);tool=pt;polyPts=pp;return r},tabs:()=>tabs.map(t=>({id:t.id,on:t===curTab,name:t===curTab?S.name:t.S.name,n:(t===curTab?S:t.S).objs.length})),roofMode:()=>roofMode,roofFit:()=>S.bld&&S.bld.roofFit,bldView:()=>bldView,syncFloorOut:()=>syncFloorOut(S),snapTake:n=>snapTake(n),snapCompare:id=>snapCompare(id),snaps:()=>snaps(),cmp:()=>cmp,pointersN:()=>pointers.size,dragM:()=>drag&&drag.m,lastDown:()=>lastDown,checkpoint:()=>checkpoint(),past:()=>past.length,future:()=>future.length,computeClash:m=>computeClash(m),clashCache:()=>clashCache,fidAt,byId:id=>byId(id),build3D:()=>build3D(),renderPOV:o=>renderPOV(o),render:()=>render(),kick3D,runDetect:b=>runDetect(b),loadUnder:f=>loadUnderFile(f),P:()=>P,fit:()=>fit(),toastOff:()=>{const t=$('#toast');if(t)t.hidden=true},detectPlan,traceWalls,findBands,detectColumns,roomsFromWalls,detectDoors,otsu,binarize,skewAngle,rotateBin,lineAngles,angledWalls,thinMask};/*@end-dev-only*/
})();
</script>
