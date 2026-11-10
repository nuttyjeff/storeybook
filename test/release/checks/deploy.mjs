/* layer 7: the deploy folder works when served over http: blank start, lazy vendors, version banner wiring, no console errors */
import {spawn} from 'child_process';import path from 'path';import {row,ROOT,appVersion,devices} from '../lib.mjs';
export const name='deploy';
export async function run(b){
  const R=[];const port=8765+Math.floor(Math.random()*200);
  const srv=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:path.join(ROOT,'deploy'),stdio:'ignore'});await new Promise(r=>setTimeout(r,700));
  try{
    for(const phone of [false,true]){
      const ctx=phone?await b.newContext({...devices['iPhone 13']}):await b.newContext({viewport:{width:1400,height:900}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push('PE:'+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
      const reqs=[];pg.on('request',r=>reqs.push(new URL(r.url()).pathname));
      const resp=await pg.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});await pg.waitForFunction(()=>document.querySelector('#plan')&&document.querySelector('#lib-list'),{timeout:20000});await pg.waitForTimeout(600);
      const L=phone?'phone':'desktop';
      const st=await pg.evaluate(()=>({sample:!!document.querySelector('#m-sample'),debug:!!window.__osp,rooms:document.querySelectorAll('#L-rooms *').length,title:document.title,three:!!window.THREE,pdf:!!window.pdfjsLib}));
      R.push(row(`dep-start-${L}`,`${L}: served page starts blank, no sample, no debug hook, titled StoreyBook`,resp.ok()&&!st.sample&&!st.debug&&st.rooms===0&&/^StoreyBook/.test(st.title),st));
      R.push(row(`dep-lazy-${L}`,`${L}: three.js and pdf.js are not loaded at start`,!st.three&&!st.pdf&&!reqs.some(p=>/vendor\//.test(p)),reqs.filter(p=>/vendor/.test(p))));
      await pg.evaluate(()=>document.querySelector('#v3d').click());await pg.waitForFunction(()=>!!window.THREE,{timeout:30000});await pg.waitForTimeout(800);
      R.push(row(`dep-3d-${L}`,`${L}: 3D loads three.js on demand`,reqs.some(p=>/vendor\/three\./.test(p))&&!reqs.some(p=>/vendor\/pdf\./.test(p))));
      const vj=await pg.evaluate(async()=>{const r=await fetch('version.json',{cache:'no-store'});return r.ok?await r.json():null});
      R.push(row(`dep-version-${L}`,`${L}: version.json served and matches ${appVersion()}`,vj&&vj.v===appVersion(),vj));
      R.push(row(`dep-clean-${L}`,`${L}: no console errors on the served build`,errs.length===0,errs.slice(0,5)));
      await ctx.close()}
  }finally{srv.kill()}
  return R}
