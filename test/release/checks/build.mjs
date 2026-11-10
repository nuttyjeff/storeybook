/* layer 1: build integrity */
import {execSync} from 'child_process';import fs from 'fs';import path from 'path';import {ROOT,OUT,appVersion,row} from '../lib.mjs';
export const name='build';
export async function run(){
  const R=[];const ver=appVersion();
  let devOk=false,webOk=false,err='';
  try{execSync('node build.js',{cwd:ROOT,stdio:'pipe'});devOk=true;execSync('node build.js --web --nozip',{cwd:ROOT,stdio:'pipe'});webOk=true}catch(e){err=String(e.stderr||e.message).slice(0,300)}
  R.push(row('b1','dev build writes the single file',devOk&&fs.existsSync(path.join(OUT,`StoreyBook v${ver}.html`)),err));
  R.push(row('b2','web build completes (no dev-only leak)',webOk,err));
  if(!webOk)return R;
  const dep=path.join(ROOT,'deploy');const files=fs.readdirSync(dep);
  const app=files.find(f=>/^app\.[0-9a-f]{8}\.js$/.test(f));const vendor=fs.existsSync(path.join(dep,'vendor'))?fs.readdirSync(path.join(dep,'vendor')):[];
  R.push(row('b3','deploy has index, hashed app, three, pdf, worker, icons, manifest, headers',!!app&&vendor.some(f=>/^three\./.test(f))&&vendor.some(f=>/^pdf\.[0-9a-f]+\.js$/.test(f))&&vendor.some(f=>/^pdf\.worker\./.test(f))&&['index.html','manifest.webmanifest','_headers','version.json','robots.txt'].every(f=>files.includes(f))&&[180,192,512].every(s=>fs.existsSync(path.join(dep,'icons',`icon-${s}.png`))),files.join(' ')));
  const vj=JSON.parse(fs.readFileSync(path.join(dep,'version.json'),'utf8'));R.push(row('b4','version.json matches APP_VERSION',vj.v===ver,vj.v+' vs '+ver));
  const html=fs.readFileSync(path.join(dep,'index.html'),'utf8');
  R.push(row('b5','index.html is blank: no sample, no debug hook, no Master name',!/m-sample|osp-debug|loadSample|Master/.test(html)));
  R.push(row('b6','index.html references the hashed app and vendor files it ships',html.includes(app)&&vendor.every(f=>html.includes('vendor/'+f))));
  const kb=f=>fs.statSync(path.join(dep,f)).size/1024;const sizes={index:kb('index.html'),app:kb(app),three:kb('vendor/'+vendor.find(f=>/^three/.test(f)))};
  R.push(row('b7','size budget: index ≤ 120 KB, app ≤ 480 KB, three ≤ 700 KB',sizes.index<=120&&sizes.app<=480&&sizes.three<=700,Object.fromEntries(Object.entries(sizes).map(([k,v])=>[k,Math.round(v)+' KB']))));
  const dev=fs.readFileSync(path.join(OUT,`StoreyBook v${ver}.html`),'utf8');
  R.push(row('b8','single file keeps the watermark and the version',dev.includes('Designed by Jeff Ying, BI')&&dev.includes(`APP_VERSION='${ver}'`)));
  R.push(row('b9','single file starts with the doctype and charset',/^<!doctype html>/i.test(dev)&&dev.includes('charset="utf-8"')));
  return R}
