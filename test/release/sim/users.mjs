/* simulated users: several people click, type, drag and press keys through the real screen at random (seeded, so a failure can be replayed).
   After every burst the plan is checked; at the end each user closes every dialog, undoes everything and redoes it. */
import fs from 'fs';import {execSync} from 'child_process';
import os from 'os';import path from 'path';import {browser,devFile} from '../lib.mjs';
const APPURL=process.env.SIM_URL||devFile();const DIR=process.env.SIM_DIR||path.join(os.tmpdir(),'sb-sim');fs.mkdirSync(DIR,{recursive:true});
const FORM=fs.readFileSync(new URL('../fixtures/requirements-form.xlsx',import.meta.url)).toString('base64');
const STEPS=+process.env.STEPS||260;
const b=await browser();
const F=[];const seen=new Set();
const note=(u,sev,what,trail)=>{const k=sev+'|'+String(what).replace(/[0-9.]+/g,'#').slice(0,110);if(seen.has(k)){F.find(f=>f.k===k).users.add(u.id);return}seen.add(k);F.push({k,sev,what:String(what).slice(0,400),users:new Set([u.id]),trail:(trail||[]).slice(-14)});console.log(`[${sev}] ${u.id}: ${String(what).slice(0,260)}\n      after: ${(trail||[]).slice(-8).join(' > ')}`)};
const NASTY=['','0','-1','999999999','abc','1e9','<b>x</b>','  ','12.5','１２','0.0001','-0','a'.repeat(300),'💥','1,200','9e99'];
const KEYS=['Escape','Delete','Backspace','Enter','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Control+z','Control+y','Control+Shift+z','Control+c','Control+v','Control+x','Control+a','Control+d','Control+k','r','w','d','v','h','m','l','t','g','s','?','/','1','2','3','+','-','Shift+ArrowRight','Space','F2','Home','End','PageDown'];
const USERS=[
  {id:'designer-1',prof:'draw',seed:101,start:'blank'},{id:'designer-2',prof:'draw',seed:202,start:'hall'},
  {id:'pm-1',prof:'click',seed:303,start:'form'},{id:'pm-2',prof:'click',seed:404,start:'blank'},
  {id:'engineer-1',prof:'click',seed:505,start:'hall'},{id:'engineer-2',prof:'mixed',seed:606,start:'form'},
  {id:'keyboard-1',prof:'keys',seed:707,start:'hall'},{id:'keyboard-2',prof:'keys',seed:808,start:'form'},
  {id:'phone-1',prof:'mixed',seed:909,start:'blank',vp:{width:390,height:800},touch:true},{id:'phone-2',prof:'click',seed:1010,start:'form',vp:{width:390,height:800},touch:true},
  {id:'tablet-1',prof:'mixed',seed:1111,start:'hall',vp:{width:820,height:1100},touch:true},{id:'small-laptop',prof:'mixed',seed:1212,start:'form',vp:{width:1024,height:640}},
  {id:'impatient-1',prof:'fast',seed:1313,start:'form'},{id:'impatient-2',prof:'fast',seed:1414,start:'hall'},
  {id:'typist-1',prof:'type',seed:1515,start:'form'},{id:'typist-2',prof:'type',seed:1616,start:'hall'}];
const WEIGHTS={draw:{click:3,canvas:5,key:1,type:1},click:{click:7,canvas:1,key:1,type:1},keys:{click:2,canvas:2,key:6,type:0},mixed:{click:4,canvas:3,key:2,type:1},fast:{click:5,canvas:3,key:2,type:0},type:{click:3,canvas:1,key:1,type:5}};

/* runs in the page: every control a person could hit right now */
const TARGETS=()=>{const out=[];const vw=innerWidth,vh=innerHeight;const els=document.querySelectorAll('button,[role=button],[role=tab],[role=menuitem],[data-tool],select,input,textarea,summary,label[for],.lib-row,.ptab,[data-chk],[data-bb],[tabindex="0"]');
  els.forEach((e,i)=>{if(e.disabled||e.type==='file'||e.closest('a[href^="http"]'))return;const r=e.getBoundingClientRect();if(r.width<4||r.height<4)return;const x=r.left+r.width/2,y=r.top+r.height/2;if(x<0||y<0||x>vw||y>vh)return;const top=document.elementFromPoint(x,y);if(!top||!(e===top||e.contains(top)||top.contains(e)))return;
    const kind=e.tagName==='SELECT'?'select':(e.tagName==='TEXTAREA'||(e.tagName==='INPUT'&&!/^(checkbox|radio|button|submit|range|color)$/.test(e.type)))?'text':(e.tagName==='INPUT'&&/^(range|color)$/.test(e.type))?'slide':'click';
    e.setAttribute('data-mk',i);out.push({i,x,y,kind,nm:(e.id?'#'+e.id:'')||(e.getAttribute('data-tool')?'tool:'+e.getAttribute('data-tool'):'')||(e.getAttribute('aria-label')||e.title||e.textContent||e.name||e.tagName).trim().replace(/\s+/g,' ').slice(0,24)})});
  /* the drawing area: the biggest svg or canvas on screen */
  let big=null,ba=0;document.querySelectorAll('svg,canvas').forEach(e=>{const r=e.getBoundingClientRect();const a=Math.max(0,Math.min(r.right,vw)-Math.max(r.left,0))*Math.max(0,Math.min(r.bottom,vh)-Math.max(r.top,0));if(a>ba){ba=a;big=r}});
  return {out,cv:big?{l:Math.max(big.left,0)+8,t:Math.max(big.top,0)+8,r:Math.min(big.right,vw)-8,b:Math.min(big.bottom,vh)-8}:null}};
const CHECK=()=>{const o=window.__osp,out={};try{const j=JSON.parse(o.planJSON());const bad=[];const walk=(v,p)=>{if(typeof v==='number'&&!Number.isFinite(v))bad.push(p);else if(v===undefined)bad.push(p+'=undefined');else if(Array.isArray(v))v.forEach((x,i)=>walk(x,p+'['+i+']'));else if(v&&typeof v==='object')Object.keys(v).forEach(k=>walk(v[k],p+'.'+k))};walk(j,'');
    if(bad.length)out.nonFinite=bad.slice(0,4);const ids=j.objs.map(x=>x&&x.id);if(ids.length!==new Set(ids).size)out.dupIds=ids.length-new Set(ids).size;
    const nul=j.objs.filter(x=>!x||typeof x!=='object'||!x.t||typeof x.id!=='string'||!x.id).length;if(nul)out.junkObjs=nul;
    const br=j.objs.filter(x=>x&&x.t==='room'&&(!Array.isArray(x.pts)||x.pts.length<3)).length;if(br)out.roomsUnder3Points=br;
    const bi=j.objs.filter(x=>x&&x.t==='item'&&!(x.w>0&&x.d>0)).length;if(bi)out.itemsZeroSize=bi;
    const lv=new Set(((j.bld||{}).levels||[]).map(l=>l.id));if(lv.size){const orphan=j.objs.filter(x=>x&&x.lv!=null&&!lv.has(x.lv)).length;if(orphan)out.objsOnMissingFloor=orphan;if(j.bld.active!=null&&!lv.has(j.bld.active))out.activeFloorMissing=j.bld.active}
    const rid=new Set(j.objs.filter(x=>x&&x.t==='room').map(x=>x.id));const tp=j.objs.filter(x=>x&&x.tp&&!rid.has(x.tp)).length;if(tp)out.templateItemsWithoutRoom=tp;
    out.n=j.objs.length}catch(e){out.planJSON='THROWS '+e.message}
  const sel=o.sel?o.sel():null;if(Array.isArray(sel)){const ids=new Set(o.S().objs.map(x=>x.id));const ghost=sel.filter(i=>!ids.has(i)).length;if(ghost)out.selectionPointsAtDeleted=ghost}
  if(document.documentElement.scrollWidth>innerWidth+2)out.pageWiderThanScreen=document.documentElement.scrollWidth-innerWidth;
  const txt=document.body.innerText;const m=txt.match(/\b(NaN|undefined|Infinity|\[object Object\])\b[^\n]{0,30}/);if(m){const ln=txt.split('\n').find(l=>l.includes(m[0]))||m[0];out.badText=ln.trim().slice(0,90)}
  return out};
const CANON=()=>{const p=JSON.parse(window.__osp.planJSON());delete p.saved;delete p.appVersion;delete p.app;if(p.notes==='')delete p.notes;if(Array.isArray(p.pins)&&!p.pins.length)delete p.pins;/* an empty list and no list are the same plan */['revs','snaps'].forEach(k=>{if(Array.isArray(p[k])&&!p[k].length)delete p[k]});if(p.north==null)p.north=0;['style','section','fire','cost','brief','prog','site','underlay'].forEach(k=>{if(p[k]==null)delete p[k]});const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;if(Array.isArray(p.objs))p.objs.sort(byId);return JSON.stringify(p)};
const diffOf=(a,b)=>{try{const A=JSON.parse(a),B=JSON.parse(b);const out=[];Object.keys({...A,...B}).forEach(k=>{if(k==='objs')return;if(JSON.stringify(A[k])!==JSON.stringify(B[k]))out.push(k+': '+JSON.stringify(A[k]).slice(0,70)+' → '+JSON.stringify(B[k]).slice(0,70))});const ma=new Map(A.objs.map(o=>[o.id,o])),mb=new Map(B.objs.map(o=>[o.id,o]));let gone=0,added=0,chg=[];ma.forEach((o,id)=>{if(!mb.has(id))gone++;else if(JSON.stringify(o)!==JSON.stringify(mb.get(id))){const p=mb.get(id);chg.push(o.t+':'+Object.keys({...o,...p}).filter(k=>JSON.stringify(o[k])!==JSON.stringify(p[k])).join(','))}});mb.forEach((o,id)=>{if(!ma.has(id))added++});if(gone)out.push(gone+' objects missing');if(added)out.push(added+' objects extra');if(chg.length)out.push(chg.length+' objects differ ('+chg.slice(0,3).join('; ')+')');return out.join(' | ').slice(0,300)}catch(e){return 'undiffable'}};

async function windDown(pg,u,trail){
  /* wind down: every dialog must close with Esc; then undo everything and redo it */
  try{await pg.mouse.up().catch(()=>{});for(let k=0;k<8;k++){await pg.evaluate(()=>{const a=document.activeElement;if(a&&a!==document.body)a.blur()});await pg.keyboard.press('Escape');await pg.waitForTimeout(60)}
    const open=await pg.evaluate(()=>[...document.querySelectorAll('[role=dialog]')].filter(m=>!m.hidden&&m.getBoundingClientRect().width>0).map(m=>m.id));if(open.length)note(u,'TRAPPED','dialogs still open after Esc ×8: '+open.join(','),trail);
    const c1=await pg.evaluate(CANON);let n=0;while(n<900&&await pg.evaluate(()=>{const e=document.querySelector('#b-undo');if(!e||e.disabled||!window.__osp.past())return false;e.click();return true})){n++;if(n%40===0)await pg.waitForTimeout(20)}
    await pg.waitForTimeout(150);let m=0;for(;m<n;m++){if(!await pg.evaluate(()=>{const e=document.querySelector('#b-redo');if(!e||e.disabled)return false;e.click();return true}))break}
    await pg.waitForTimeout(150);const c2=await pg.evaluate(CANON);u.undo=n;
    if(m<n)note(u,'UNDO',`undid ${n} steps but Redo stopped after ${m}`,trail);else if(c1!==c2){fs.writeFileSync(DIR+'/undo-'+u.id+'.json',JSON.stringify({c1,c2}));note(u,'UNDO',`undo all (${n} steps) then redo all gives a different plan: `+diffOf(c1,c2),trail)};
    /* save and open again */
    const c3=await pg.evaluate(()=>{const o=window.__osp;const t=o.planJSON();o.openPlanText(t,'again.json');return 1}).then(()=>pg.waitForTimeout(250)).then(()=>pg.evaluate(CANON));
    /* the reopened plan must hold the same things in the same places (compared on what a user can see: defaults that opening fills in are not a difference), and opening a saved file twice must give the identical plan */
    const core=s=>{const p=JSON.parse(s);return JSON.stringify({floors:((p.bld||{}).levels||[]).length,north:p.north||0,objs:p.objs.map(o=>({id:o.id,t:o.t,name:o.name,x:o.x,y:o.y,w:o.w,d:o.d,r:o.r||0,pts:o.t==='item'?undefined:o.pts,a:o.t==='dim'?o.a:undefined,b:o.t==='dim'?o.b:undefined,tp:o.tp,tpl:o.tpl?o.tpl.code:undefined,sec:o.sec}))})};
    if(core(c3)!==core(c2)){fs.writeFileSync(DIR+'/save-'+u.id+'.json',JSON.stringify({c2,c3}));note(u,'SAVE','saved file opens as a different plan: '+diffOf(core(c2),core(c3)),trail)}
    const c4=await pg.evaluate(()=>{const o=window.__osp;const t=o.planJSON();o.openPlanText(t,'again2.json');return 1}).then(()=>pg.waitForTimeout(250)).then(()=>pg.evaluate(CANON));
    const strip=s=>{const p=JSON.parse(s);delete p.name;delete p.site;delete p.pid;return JSON.stringify(p)};if(strip(c4)!==strip(c3))note(u,'SAVE','opening a saved file, saving it and opening it again changes the plan: '+diffOf(strip(c3),strip(c4)),trail);
    const h=await pg.evaluate(CHECK);delete h.n;delete h.pageWiderThanScreen;delete h.badText;Object.entries(h).forEach(([k,v])=>note(u,'CORRUPT','after undo/redo/save: '+k+': '+JSON.stringify(v),trail))
  }catch(e){note(u,'WINDDOWN','could not finish: '+e.message.slice(0,200),trail)}
}
async function run(u){const ctx=await b.newContext({viewport:u.vp||{width:1400,height:900},hasTouch:!!u.touch,isMobile:!!u.touch&&u.vp.width<500});
  await ctx.addInitScript(()=>{window.print=()=>{};window.open=()=>null});if(!u.gl&&!process.env.GL)await ctx.addInitScript(()=>{const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...r){return /webgl/.test(t)?null:g.call(this,t,...r)}});await ctx.route(/^https?:\/\//,r=>r.abort());
  const pg=await ctx.newPage();pg.setDefaultTimeout(4000);const trail=[];const slow=[];let s=u.seed+(+process.env.SEEDX||0);const rnd=()=>{s=(s*1103515245+12345)%2147483648;return s/2147483648};const pick=a=>a[Math.floor(rnd()*a.length)];
  pg.on('pageerror',e=>note(u,'CRASH',e.message.slice(0,200)+(e.stack?' @ '+e.stack.split('\n').slice(1,4).map(x=>x.trim().replace(/file:.*html/,'')).join(' < '):''),trail));
  pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR|CORS|Access-Control|ERR_FAILED|Error creating WebGL context/.test(m.text()))note(u,'CONSOLE',m.text().slice(0,200),trail)});
  pg.on('dialog',d=>{trail.push('[browser '+d.type()+': '+d.message().slice(0,30)+']');(rnd()<.5?d.accept():d.dismiss()).catch(()=>{})});
  await pg.goto(APPURL);await pg.waitForFunction(()=>window.__osp);await pg.waitForTimeout(300);
  if(u.start==='hall')await pg.evaluate(()=>{window.__osp.tplPlace('DH',{n:6})});
  if(u.start==='form')await pg.evaluate(async f=>{const o=window.__osp;await o.progImportBuf(Uint8Array.from(atob(f),c=>c.charCodeAt(0)).buffer,'f.xlsx');o.progBuild&&o.progBuild()},FORM).catch(e=>note(u,'SETUP','form start failed: '+e.message,trail));
  await pg.waitForTimeout(400);
  const W=WEIGHTS[u.prof];const bag=[];Object.entries(W).forEach(([k,n])=>{for(let i=0;i<n;i++)bag.push(k)});const gap=u.prof==='fast'?0:35;let stuck=0,done=0;
  for(let i=0;i<STEPS;i++){let act=pick(bag);const ta=Date.now();
    try{const T=await pg.evaluate(TARGETS);
      if(act==='type'&&!T.out.some(t=>t.kind==='text'))act='click';
      if(act==='click'&&!T.out.length)act='key';if(act==='canvas'&&!T.cv)act='click';
      if(act==='click'){const t=pick(T.out);trail.push(t.nm||'?');
        if(t.kind==='select'){await pg.evaluate(i=>{const e=document.querySelector('[data-mk="'+i+'"]');if(!e||!e.options.length)return;e.selectedIndex=Math.floor(Math.random()*e.options.length);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))},t.i)}
        else if(t.kind==='slide'){await pg.evaluate(i=>{const e=document.querySelector('[data-mk="'+i+'"]');if(!e)return;if(e.type==='color')e.value='#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');else{const mn=+e.min||0,mx=+e.max||100;e.value=mn+Math.random()*(mx-mn)}e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))},t.i)}
        else if(u.touch)await pg.touchscreen.tap(t.x,t.y);else{const r=rnd();await pg.mouse.click(t.x,t.y,{clickCount:r<.08?2:1,button:r>.95?'right':'left'})}}
      else if(act==='type'){const t=pick(T.out.filter(t=>t.kind==='text'));const v=pick(NASTY);trail.push((t.nm||'field')+'="'+v.slice(0,10)+'"');if(u.touch)await pg.touchscreen.tap(t.x,t.y);else await pg.mouse.click(t.x,t.y);await pg.keyboard.press('Control+a');if(v)await pg.keyboard.insertText(v);else await pg.keyboard.press('Delete');await pg.keyboard.press(pick(['Enter','Tab','Escape','Tab']))}
      else if(act==='key'){const k=pick(KEYS);trail.push('key:'+k);if(rnd()<.7)await pg.evaluate(()=>{const a=document.activeElement;if(a&&a!==document.body)a.blur()});await pg.keyboard.press(k==='Space'?' ':k)}
      else{const c=T.cv,px=()=>c.l+rnd()*(c.r-c.l),py=()=>c.t+rnd()*(c.b-c.t);const x1=px(),y1=py();const r=rnd();
        if(r<.35){trail.push('plan:click');if(u.touch)await pg.touchscreen.tap(x1,y1);else await pg.mouse.click(x1,y1,{clickCount:rnd()<.15?2:1,modifiers:rnd()<.15?['Shift']:[]})}
        else if(r<.85||u.touch){const x2=Math.min(c.r,Math.max(c.l,x1+(rnd()-.5)*260)),y2=Math.min(c.b,Math.max(c.t,y1+(rnd()-.5)*200));trail.push('plan:drag');await pg.mouse.move(x1,y1);await pg.mouse.down();await pg.mouse.move((x1+x2)/2,(y1+y2)/2,{steps:3});await pg.mouse.move(x2,y2,{steps:3});if(rnd()<.06){trail.push('(Esc mid-drag)');await pg.keyboard.press('Escape')}if(rnd()<.05){trail.push('(drag off window)');await pg.mouse.move(-20,-20)}await pg.mouse.up()}
        else{trail.push('plan:wheel');await pg.mouse.move(x1,y1);await pg.mouse.wheel(0,(rnd()-.5)*1600)}}
      done++;const ms=Date.now()-ta;if(process.env.WATCH&&!u.w){const v=await pg.evaluate(e=>String(eval(e)),process.env.WATCH).catch(()=>'ok');if(v!=='ok'){u.w=1;console.log('WATCH tripped at step',i,v,'after',trail.slice(-6).join(' > '))}}if(process.env.MEM){const mm=await pg.evaluate(()=>[Math.round(performance.memory.usedJSHeapSize/1e6),window.__osp.S().objs.length,window.__osp.past(),document.querySelectorAll('*').length]).catch(()=>['?']);fs.appendFileSync(DIR+'/mem-'+u.id+'.txt',i+' '+ms+'ms rss='+execSync("ps -eo rss,args | grep -i chrom | grep -v grep | sort -n | tail -1 | awk '{print int($1/1024)}'").toString().trim()+'MB heap,objs,past,dom='+mm.join(',')+' '+trail[trail.length-1]+'\n')}if(ms>1500)slow.push(ms+'ms '+trail[trail.length-1]);if(gap)await pg.waitForTimeout(gap)}catch(e){stuck++;slow.push('TIMEOUT '+trail[trail.length-1]+' '+e.message.slice(0,60));if(/Target.*closed|crashed/.test(e.message)){note(u,'CRASH','browser tab died: '+e.message.slice(0,120),trail);break}if(stuck>40){note(u,'HANG','actions keep timing out: '+e.message.slice(0,140),trail);break}}
    if(i%20===19||i===STEPS-1){fs.writeFileSync(DIR+'/trail-'+u.id+'.txt',trail.join('\n'));const h=await pg.evaluate(CHECK).catch(e=>({evalFailed:e.message.slice(0,100)}));const n=h.n;delete h.n;u.objs=n;
      Object.entries(h).forEach(([k,v])=>note(u,k==='pageWiderThanScreen'||k==='badText'?'LAYOUT':k==='selectionPointsAtDeleted'?'STATE':'CORRUPT',k+': '+JSON.stringify(v),trail))}}
  if(process.env.DUMP)console.log('DUMP',u.id,JSON.stringify(await pg.evaluate(()=>{const o=window.__osp,T=o.T3();return{V:{x:o.V.x,y:o.V.y,k:o.V.k},view:[...document.querySelectorAll('#v2d,#v3d,#vbld')].map(e=>e.id+':'+e.className).join(' '),walk:o.WALK.on,bld:o.bldView(),tool:document.querySelector('.dock [data-tool].on')&&document.querySelector('.dock [data-tool].on').dataset.tool,dialogs:[...document.querySelectorAll('[role=dialog]')].filter(m=>!m.hidden).map(m=>m.id),cam:T&&T.camera?[T.camera.position.x,T.camera.position.y,T.camera.position.z].map(v=>+v.toPrecision(4)):null,canv:[...document.querySelectorAll('canvas')].map(c=>c.width+'x'+c.height),svgN:document.querySelector('#main svg')?document.querySelector('#main svg').querySelectorAll('*').length:0,objs:o.S().objs.length,sun:o.SUN().on}})));
  await windDown(pg,u,trail);
  u.done=done;u.stuck=stuck;u.slow=slow;fs.writeFileSync(DIR+'/trail-'+u.id+'.txt',trail.join('\n'));await ctx.close()}
/* scripted journeys: what a real user of each kind does, start to finish, with the same checks afterwards. Random users stay shallow; these go deep */
const W=(pg,ms)=>pg.waitForTimeout(ms);
const JOURNEYS=[
 {id:'journey-pm',what:'requirements form to a building, then edits',go:async(pg,t)=>{
   await pg.evaluate(async f=>{const o=window.__osp;await o.progImportBuf(Uint8Array.from(atob(f),c=>c.charCodeAt(0)).buffer,'f.xlsx');o.progBuild()},FORM);await W(pg,700);t.push('import form, build');
   await pg.evaluate(()=>{const o=window.__osp;if(o.AI().pending)o.aiAccept()});await W(pg,300);t.push('accept preview');
   const r=await pg.evaluate(()=>{const o=window.__osp,out={};const rooms=o.S().objs.filter(x=>x.t==='room');out.rooms=rooms.length;out.overlaps=o.aiIssues().filter(x=>/overlap/.test(x)).length;out.floors=o.S().bld.levels.length;return out});if(r.rooms<10)throw new Error('built only '+r.rooms+' rooms on the open floor');if(r.overlaps)throw new Error(r.overlaps+' overlapping rooms reported in a generated building');
   for(let k=0;k<r.floors;k++){await pg.evaluate(k=>{const o=window.__osp;o.switchFloor(o.S().bld.levels[k].id)},k);await W(pg,200);await pg.evaluate(()=>{const o=window.__osp;const room=o.S().objs.find(x=>x.t==='room'&&!/corridor|stair|lift|core/i.test(x.name));if(room){o.setSel([room.id]);document.dispatchEvent(new KeyboardEvent('keydown',{key:'d',ctrlKey:true,bubbles:true}))}});await W(pg,150);t.push('floor '+k+': duplicate a room')}
   await pg.evaluate(()=>{const o=window.__osp;const rm=o.S().objs.filter(x=>x.t==='room').slice(-1)[0];o.setSel([rm.id]);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}))});await W(pg,150);t.push('delete a room');
   await pg.evaluate(()=>{const o=window.__osp;o.costCalc&&o.costCalc();o.revIssue&&o.revIssue('Issue A')});await W(pg,200);t.push('issue a revision')}},
 {id:'journey-designer',what:'draws rooms by hand, furnishes, copies, turns and deletes',go:async(pg,t)=>{
   const box=await pg.evaluate(()=>{const r=document.querySelector('#plan').getBoundingClientRect();return[r.left,r.top,r.width,r.height]});const P=(i,j)=>[box[0]+box[2]*(0.3+0.1*i),box[1]+box[3]*(0.25+0.14*j)];
   for(let k=0;k<3;k++){await pg.evaluate(()=>window.__osp.setTool('room'));const a=P(k,0),c=P(k+0.8,1.4);await pg.mouse.move(a[0],a[1]);await pg.mouse.down();await pg.mouse.move((a[0]+c[0])/2,(a[1]+c[1])/2,{steps:3});await pg.mouse.move(c[0],c[1],{steps:3});await pg.mouse.up();await W(pg,150);t.push('draw room '+k)}
   const n=await pg.evaluate(()=>window.__osp.S().objs.filter(x=>x.t==='room').length);if(n<3)throw new Error('drew 3 rooms, plan has '+n);
   await pg.evaluate(()=>{const o=window.__osp,L=o.LIB();const rooms=o.S().objs.filter(x=>x.t==='room');const pick=re=>L.find(l=>re.test(l.name)&&l.shape!=='set');let q=0;const mk=(l,x,y)=>({id:'jd'+(q++),t:'item',name:l.name,code:l.code,cat:l.cat,shape:l.shape,w:l.w,d:l.d,h:l.h,a:l.a||0,seats:l.seats||0,cf:l.cf||0,cb:l.cb||0,x,y,r:0,gid:null});const add=[];rooms.forEach(r=>{const xs=r.pts.map(p=>p[0]),ys=r.pts.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;[/desk/i,/chair/i,/cabinet|shelf|locker/i].forEach((re,i)=>{const l=pick(re);if(l)add.push(mk(l,cx+(i-1)*Math.min(700,(Math.max(...xs)-Math.min(...xs))/5),cy))})});o.addObjs(add)});await W(pg,200);t.push('furnish each room');
   const before=await pg.evaluate(()=>window.__osp.S().objs.length);
   const key=async(k,mod)=>{await pg.evaluate(()=>{const a=document.activeElement;a&&a!==document.body&&a.blur()});await pg.keyboard.press((mod?mod+'+':'')+k);await W(pg,160)};
   await pg.evaluate(()=>{const o=window.__osp;o.setSel([o.S().objs.find(x=>x.t==='room').id])});await key('c','Control');await key('v','Control');t.push('copy and paste a room');
   const after=await pg.evaluate(()=>window.__osp.S().objs.length);if(after-before<4)throw new Error('pasting a furnished room added '+(after-before)+' objects, expected the room and its 3 items');
   await pg.evaluate(()=>window.__osp.rotateSel(90));await W(pg,120);for(const k of ['ArrowRight','ArrowRight','ArrowDown'])await key(k,'Shift');t.push('turn and nudge the copy');
   await pg.evaluate(()=>{const o=window.__osp;o.setSel([o.S().objs.find(x=>x.t==='room').id])});await key('x','Control');await key('v','Control');t.push('cut and paste the first room');
   await pg.evaluate(()=>{const o=window.__osp;o.setSel([o.S().objs.filter(x=>x.t==='room')[1].id])});await key('Delete');t.push('delete a room, contents stay');
   await pg.evaluate(()=>{const o=window.__osp;o.setTool('select')})}},
 {id:'journey-engineer',what:'data hall, resize it, solar PV on the roof, checks',go:async(pg,t)=>{
   await pg.evaluate(()=>window.__osp.tplPlace('DH',{n:12,kw:8}));await W(pg,300);t.push('place a data hall of 12 racks');
   const r=await pg.evaluate(()=>{const o=window.__osp;const room=o.S().objs.find(x=>x.t==='room'&&x.tpl);const n0=o.S().objs.filter(x=>x.tp===room.id).length;o.tplUpdate(room,{n:30,kw:12,mode:'row'});const n1=o.S().objs.filter(x=>x.tp===room.id).length;return[n0,n1,o.S().objs.filter(x=>x.t==='room').length]});await W(pg,250);t.push('resize to 30 racks, in-row cooling');if(!(r[1]>r[0])||r[2]!==1)throw new Error('resizing the data hall: '+JSON.stringify(r));
   await pg.evaluate(()=>{const o=window.__osp;const room=o.S().objs.find(x=>x.t==='room'&&x.tpl);o.setSel([room.id]);document.dispatchEvent(new KeyboardEvent('keydown',{key:'d',ctrlKey:true,bubbles:true}))});await W(pg,250);t.push('duplicate the hall');
   const d=await pg.evaluate(()=>{const o=window.__osp;const rooms=o.S().objs.filter(x=>x.t==='room'&&x.tpl);const per=rooms.map(r=>o.S().objs.filter(x=>x.tp===r.id).length);return{rooms:rooms.length,per}});if(d.rooms!==2||d.per[0]!==d.per[1]||!d.per[0])throw new Error('duplicated hall: '+JSON.stringify(d));
   await pg.evaluate(()=>{const o=window.__osp;const b=o.S().objs.filter(x=>x.t==='room'&&x.tpl)[1];o.tplUpdate(b,{n:8})});await W(pg,200);t.push('shrink the copy to 8 racks');
   const e=await pg.evaluate(()=>{const o=window.__osp;const rooms=o.S().objs.filter(x=>x.t==='room'&&x.tpl);return rooms.map(r=>o.S().objs.filter(x=>x.tp===r.id&&/rack/i.test(x.name)).length)});if(e[0]!==30||e[1]!==8)throw new Error('the copy is not independent of the original: racks '+JSON.stringify(e));
   await pg.evaluate(()=>{const o=window.__osp;o.enterRoof()});await W(pg,300);await pg.evaluate(()=>{const o=window.__osp,l=o.LIB().find(x=>x.code==='PV2311');const add=[];for(let i=0;i<6;i++)for(let j=0;j<4;j++)add.push({id:'pv'+i+'_'+j,t:'item',name:l.name,code:l.code,cat:l.cat,shape:l.shape,w:l.w,d:l.d,h:l.h,a:0,seats:0,cf:0,cb:0,x:3000+i*(l.w+20),y:3000+j*(l.d+20),r:0,gid:null});o.addObjs(add)});await W(pg,250);t.push('24 PV modules on the roof');
   const pv=await pg.evaluate(()=>{const o=window.__osp;const c=o.pvCheck(true);return c&&(c.rows||c.checks||c).length!==undefined?'ok':typeof c});t.push('PV check: '+pv);
   await pg.evaluate(()=>window.__osp.exitRoof());await W(pg,250);const leak=await pg.evaluate(()=>window.__osp.roofMode());if(leak)throw new Error('still in Roof mode after leaving the roof');t.push('leave the roof')}},
 {id:'journey-campus',what:'two buildings on a site, moved, linked, saved and reopened',go:async(pg,t)=>{
   await pg.evaluate(()=>{const o=window.__osp;o.tplPlace('DH',{n:6});const n=document.querySelector('#pname');n.value='Block A';n.dispatchEvent(new Event('change',{bubbles:true}))});await W(pg,250);
   await pg.evaluate(()=>{const o=window.__osp;o.newTab(o.blankPlan())});await W(pg,250);await pg.evaluate(()=>{const o=window.__osp;o.tplPlace('DH',{n:10});const n=document.querySelector('#pname');n.value='Block B';n.dispatchEvent(new Event('change',{bubbles:true}))});await W(pg,250);t.push('two buildings');
   await pg.evaluate(()=>window.__osp.campusOpen());await W(pg,300);await pg.evaluate(()=>{const o=window.__osp;o.campusArrange&&o.campusArrange()});await W(pg,200);t.push('campus: set out in a row');
   await pg.evaluate(()=>{const o=window.__osp;const R=o.campusRows();o.campusSet(R[1].t,q=>{q.x=60000;q.y=5000;q.r=90});o.campusSet(R[1].t,q=>{q.links=[{to:'Block A',from:0,w:3000}]})});await W(pg,200);t.push('move, turn and link Block B');
   const g=await pg.locator('#campus-map [data-cb]').first().boundingBox();if(g){await pg.mouse.move(g.x+g.width/2,g.y+g.height/2);await pg.mouse.down();await pg.mouse.move(g.x+g.width/2+40,g.y+g.height/2+25,{steps:4});await pg.mouse.up();await W(pg,200);t.push('drag Block A on the map')}
   await pg.evaluate(()=>{const n=document.querySelector('#pname');n.value='Block B2';n.dispatchEvent(new Event('change',{bubbles:true}))});await W(pg,200);t.push('rename Block B');
   const file=await pg.evaluate(()=>window.__osp.campusFile());const j=JSON.parse(file);if(!j.plans||j.plans.length!==2)throw new Error('campus file holds '+(j.plans?j.plans.length:0)+' plans');
   const names=j.plans.map(p=>p.name).sort().join();if(names!=='Block A,Block B2')throw new Error('campus file names: '+names);
   await pg.evaluate(()=>{document.querySelector('#campus-modal').hidden=true});t.push('campus file checked')}},
 {id:'journey-phone',vp:{width:390,height:800},touch:true,what:'phone: template, sheets, select and move by touch',go:async(pg,t)=>{
   await pg.evaluate(()=>window.__osp.tplPlace('DH',{n:6}));await W(pg,300);t.push('place a data hall');
   const pt=await pg.evaluate(()=>{const o=window.__osp,V=o.V,r=document.querySelector('#plan').getBoundingClientRect();const it=o.S().objs.find(x=>x.t==='item'&&x.tp);return[r.left+(it.x-V.x)*V.k,r.top+(it.y-V.y)*V.k]});
   await pg.touchscreen.tap(pt[0],pt[1]);await W(pg,300);t.push('tap a rack');
   const cdp=await pg.context().newCDPSession(pg);const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(p=>({x:p[0],y:p[1]}))});
   await T('touchStart',[pt]);for(let i=1;i<=5;i++)await T('touchMove',[[pt[0]+i*8,pt[1]+i*5]]);await T('touchEnd',[]);await W(pg,250);t.push('drag it with a finger');
   await T('touchStart',[[120,300],[260,420]]);for(let i=1;i<=4;i++)await T('touchMove',[[120-i*8,300-i*6],[260+i*8,420+i*6]]);await T('touchEnd',[]);await W(pg,250);t.push('pinch to zoom');
   for(const s of ['#t-lib','#t-insp','#t-more']){const ok=await pg.evaluate(s=>{const e=document.querySelector(s);if(!e||e.getBoundingClientRect().width===0)return false;e.click();return true},s);await W(pg,250);if(ok){t.push('open '+s);await pg.touchscreen.tap(195,150);await W(pg,250)}}
   const wide=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);if(wide>2)throw new Error('page is '+wide+' px wider than the phone screen')}}];
async function journey(j){const u={id:j.id};const ctx=await b.newContext({viewport:j.vp||{width:1400,height:900},hasTouch:!!j.touch,isMobile:!!j.touch});await ctx.addInitScript(()=>{window.print=()=>{};window.open=()=>null});await ctx.route(/^https?:\/\//,r=>r.abort());
  const pg=await ctx.newPage();pg.setDefaultTimeout(8000);const trail=[];pg.on('pageerror',e=>note(u,'CRASH',e.message.slice(0,200)+(e.stack?' @ '+e.stack.split('\n').slice(1,4).map(x=>x.trim().replace(/file:.*html/,'')).join(' < '):''),trail));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR|CORS|Access-Control|ERR_FAILED/.test(m.text()))note(u,'CONSOLE',m.text().slice(0,200),trail)});pg.on('dialog',d=>d.accept().catch(()=>{}));
  await pg.goto(APPURL);await pg.waitForFunction(()=>window.__osp);await pg.waitForTimeout(300);
  try{await j.go(pg,trail);const h=await pg.evaluate(CHECK);u.objs=h.n;delete h.n;Object.entries(h).forEach(([k,v])=>note(u,k==='pageWiderThanScreen'||k==='badText'?'LAYOUT':k==='selectionPointsAtDeleted'?'STATE':'CORRUPT',k+': '+JSON.stringify(v),trail))}catch(e){note(u,'JOURNEY',j.what+': '+e.message.slice(0,260),trail)}
  await windDown(pg,u,trail);u.done=trail.length;u.stuck=0;u.journey=j.what;DONE.push(u);fs.writeFileSync(DIR+'/trail-'+u.id+'.txt',trail.join('\n'));await ctx.close()}
const DONE=[];
const t0=Date.now();const PAR=+process.env.PAR||4;const list=(process.env.ONLY?USERS.filter(u=>process.env.ONLY.split(',').includes(u.id)):USERS).slice();
if(!process.env.NO_JOURNEYS)for(const j of JOURNEYS){if(process.env.ONLY&&!process.env.ONLY.split(',').includes(j.id))continue;await journey(j).catch(e=>note({id:j.id},'HARNESS',e.message.slice(0,200)))}
if(process.env.ONLY&&!list.length&&!DONE.length)console.log('no user matches ONLY');
await Promise.all(Array.from({length:PAR},async()=>{while(list.length){const u=list.shift();await run(u).catch(e=>note(u,'HARNESS',e.message.slice(0,200)))}}));
fs.writeFileSync(DIR+'/users-'+(process.env.TAG||'x')+'.json',JSON.stringify({F:F.map(f=>({...f,users:[...f.users]})),U:DONE.concat(USERS.filter(u=>u.done!=null)).map(u=>({id:u.id,what:u.journey||'',done:u.done,stuck:u.stuck,objs:u.objs,undo:u.undo,slow:u.slow}))},null,1));console.log('\nUSERS');DONE.concat(USERS).forEach(u=>u.done!=null&&console.log(`  ${u.id.padEnd(14)} ${u.done} actions, ${u.stuck} skipped, ${u.objs} objects at end, ${u.undo} undo steps${u.slow&&u.slow.length?'\n      slow: '+u.slow.slice(0,8).join(' | '):''}`));
console.log('FINDINGS',F.length,Math.round((Date.now()-t0)/1000)+'s');
fs.writeFileSync(DIR+'/users.json',JSON.stringify(F.map(f=>({...f,users:[...f.users]})),null,1));await b.close();
