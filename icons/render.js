const {createRequire}=require('module');const req=createRequire('/opt/npm-tools/');const {chromium}=req('playwright');const fs=require('fs');
(async()=>{const svg=fs.readFileSync(__dirname+'/icon.svg','utf8');const b=await chromium.launch();
 for(const s of [32,180,192,512]){const p=await b.newPage({viewport:{width:s,height:s},deviceScaleFactor:1});
  // iOS squares off corners itself, so the 180 gets a full-bleed (square) background; others keep the rounded tile
  const src=s===180?svg.replace('rx="14"','rx="0"'):svg;
  await p.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;utf8,${encodeURIComponent(src)}" width="${s}" height="${s}"></body></html>`);
  await p.screenshot({path:`${__dirname}/icon-${s}.png`,omitBackground:true,clip:{x:0,y:0,width:s,height:s}});await p.close()}
 await b.close();console.log('rendered 32/180/192/512')})();
