import {browser,openApp} from './lib.mjs';import fs from 'fs';
const b=await browser();const pg=await openApp(b);
const j=await pg.evaluate(()=>window.__osp.planJSON());const o=JSON.parse(j);delete o.saved;
fs.writeFileSync('test/release/golden/golden-v'+o.v+'.json',JSON.stringify(o));console.log('golden v'+o.v,o.objs.length,'objs');await b.close();
