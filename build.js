/* StoreyBook build
   node build.js            -> single-file build (dev: keeps the sample plan and the #osp-debug hook) in /mnt/user-data/outputs
   node build.js --web      -> deploy/ folder for Cloudflare Pages: split, stripped, minified, hashed; plus a zip in outputs
*/
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const esbuild=require(fs.existsSync('/opt/npm-tools/node_modules/esbuild')?'/opt/npm-tools/node_modules/esbuild':'esbuild');
const OUT=process.env.SB_OUT||(fs.existsSync('/mnt/user-data/outputs')?'/mnt/user-data/outputs':path.join(__dirname,'out'));
const head=fs.readFileSync('head.html','utf8'),lib=fs.readFileSync('lib.js','utf8'),app=fs.readFileSync('app.js','utf8');
const ver=(app.match(/APP_VERSION='([0-9.]+)'/)||[])[1];if(!ver)throw new Error('no APP_VERSION');
const inner=s=>s.replace(/^\s*<script>/,'').replace(/<\/script>\s*$/,'');
const stripDev=s=>s.replace(/\/\*@dev-only\*\/[\s\S]*?\/\*@end-dev-only\*\//g,'').replace(/<!--@dev-only-->[\s\S]*?<!--@end-dev-only-->/g,'');
const h8=s=>crypto.createHash('sha1').update(s).digest('hex').slice(0,8);

/* split head.html into page markup and the four embedded libraries */
function splitHead(){
  const i0=head.indexOf('<script type="text/plain" id="pdfjs-worker-src">');if(i0<0)throw new Error('worker block not found');
  const page=head.slice(0,i0);let rest=head.slice(i0);
  const blocks=[];const re=/<script[^>]*>([\s\S]*?)<\/script>/g;let m;while((m=re.exec(rest)))blocks.push(m[1]);
  if(blocks.length!==4)throw new Error('expected 4 library blocks, found '+blocks.length);
  const [pdfWorker,pdfMain,three,orbit]=blocks;
  if(!/Three\.js Authors/.test(three)||!/OrbitControls/.test(orbit)||!/Mozilla Foundation/.test(pdfMain))throw new Error('library blocks out of order');
  return{page,pdfWorker,pdfMain,three,orbit};
}

const NOZIP=process.argv.includes("--nozip");
if(process.argv.includes("--web")){
  const {page,pdfWorker,pdfMain,three,orbit}=splitHead();
  const dep='deploy';fs.rmSync(dep,{recursive:true,force:true});fs.mkdirSync(path.join(dep,'vendor'),{recursive:true});
  const put=(rel,data)=>{fs.writeFileSync(path.join(dep,rel),data);return rel};
  /* vendor: content-hashed, cached for a year */
  const threeAll=three+'\n'+orbit;
  const vThree=put(`vendor/three.${h8(threeAll)}.js`,threeAll);
  const vPdf=put(`vendor/pdf.${h8(pdfMain)}.js`,pdfMain);
  const vWorker=put(`vendor/pdf.worker.${h8(pdfWorker)}.js`,pdfWorker);
  /* app: library CSV + app logic, dev-only parts removed, minified */
  const appSrc=inner(lib)+'\n'+stripDev(inner(app));
  const min=esbuild.transformSync(appSrc,{minify:true,target:'es2020',legalComments:'none'}).code;
  const vApp=put(`app.${h8(min)}.js`,min);
  /* page: dev-only markup removed, CSS minified, scripts wired */
  let html=stripDev(page).replace(/<style>([\s\S]*?)<\/style>/g,(_,css)=>'<style>'+esbuild.transformSync(css,{loader:'css',minify:true}).code+'</style>');
  fs.mkdirSync(path.join(dep,'icons'),{recursive:true});for(const s of [180,192,512])fs.copyFileSync(`icons/icon-${s}.png`,path.join(dep,'icons',`icon-${s}.png`));
  put('manifest.webmanifest',JSON.stringify({name:'StoreyBook',short_name:'StoreyBook',description:'A sketchbook for buildings.',start_url:'./',display:'standalone',background_color:'#0b0b0d',theme_color:'#0b0b0d',icons:[{src:'icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]}));
  const boot=`<link rel="apple-touch-icon" sizes="180x180" href="icons/icon-180.png"><link rel="manifest" href="manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><script>window.SB_VENDOR=${JSON.stringify({three:vThree,pdf:vPdf,pdfWorker:vWorker})}</script><script defer src="${vApp}"></script>`;
  html=html.replace(/<title>StoreyBook<\/title>/,m=>m+boot)+'\n</body></html>\n';
  if(/osp-debug|m-sample|loadSample/.test(html+min))throw new Error('dev-only content leaked into the web build');
  put('index.html',html);
  put('version.json',JSON.stringify({v:ver,built:new Date().toISOString()}));
  put('_headers',[
    '/index.html','  Cache-Control: no-cache','/','  Cache-Control: no-cache','/version.json','  Cache-Control: no-store',
    '/vendor/*','  Cache-Control: public, max-age=31536000, immutable','/icons/*','  Cache-Control: public, max-age=604800','/app.*.js','  Cache-Control: public, max-age=31536000, immutable',''].join('\n'));
  put('robots.txt','User-agent: *\nAllow: /\n');
  const sz=f=>(fs.statSync(path.join(dep,f)).size/1024).toFixed(0)+' KB';
  console.log(`WEB build v${ver} -> ${dep}/`);
  console.log(`  index.html ${sz('index.html')} | ${vApp} ${sz(vApp)} | ${vThree} ${sz(vThree)} | ${vPdf} ${sz(vPdf)} | ${vWorker} ${sz(vWorker)}`);
  if(!NOZIP){const zip=path.join(OUT,`storeybook-deploy-v${ver}.zip`);fs.rmSync(zip,{force:true});
  require('child_process').execSync(`cd ${dep} && zip -qr "${zip}" .`);console.log('  zip:',zip)}
}else{
  const out=head+lib+'\n'+app+'\n</body></html>\n';
  const p=path.join(OUT,`StoreyBook v${ver}.html`);fs.writeFileSync(p,out);
  console.log(`FILE build v${ver} ${(out.length/1048576).toFixed(2)} MB -> ${p}`);
}
