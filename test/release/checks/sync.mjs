/* Several windows on one plan: every window shows the same tabs and plans; a change in one reaches the others; changes made in two
   windows at once are both kept; Undo takes back the latest change whichever window made it; settings and the clipboard follow */
import {devFile,row} from '../lib.mjs';
export const name='sync';
const T=+(process.env.SB_TIME_FACTOR||1);
export async function run(b){
  const out=[];
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const open=async()=>{const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push('PE:'+e.message));pg.on('console',m=>{if(m.type()==='error')pg.errs.push(m.text())});
    await pg.goto(devFile(),{waitUntil:'load'});await pg.waitForFunction(()=>window.__osp&&window.__osp.S,{timeout:20000});return pg};
  const wait=ms=>new Promise(r=>setTimeout(r,ms*T));
  const items=pg=>pg.evaluate(()=>window.__osp.S().objs.filter(o=>o.t==='item').map(o=>({id:o.id,x:o.x,y:o.y})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));
  const nudge=(pg,id,key)=>pg.evaluate(([id,key])=>{window.__osp.setSel([id]);document.querySelector('#plan').dispatchEvent(new Event('pointerenter'));document.activeElement&&document.activeElement.blur&&document.activeElement.blur();
    document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}))},[id,key]);
  const x=(list,id)=>(list.find(o=>o.id===id)||{}).x;
  try{
    const A=await open();await A.evaluate(()=>document.querySelector('#m-sample').click());await wait(1500);
    const B=await open();await wait(500);
    const a0=await items(A),b0=await items(B);
    out.push(row('sync-open','A second window opens with the same plan',a0.length>3&&JSON.stringify(a0)===JSON.stringify(b0),{a:a0.length,b:b0.length}));
    const [i1,i2]=[a0[0].id,a0[1].id];
    await nudge(A,i1,'ArrowRight');await wait(1500);
    const b1=await items(B);out.push(row('sync-change','A change in one window reaches the other',x(b1,i1)===x(await items(A),i1)&&x(b1,i1)!==x(a0,i1),{was:x(a0,i1),a:x(await items(A),i1),b:x(b1,i1)}));
    /* both at once: A moves item 1, B moves item 2, before either autosave has gone out */
    const s1=x(await items(A),i1),s2=x(await items(A),i2);
    await Promise.all([nudge(A,i1,'ArrowRight'),nudge(B,i2,'ArrowLeft')]);await wait(2500);
    const a2=await items(A),b2=await items(B);
    out.push(row('sync-both','Changes made in two windows at once are both kept, in both',x(a2,i1)>s1&&x(a2,i2)<s2&&JSON.stringify(a2)===JSON.stringify(b2),{a:[x(a2,i1),x(a2,i2)],b:[x(b2,i1),x(b2,i2)],start:[s1,s2]}));
    /* A changes item 1, then B changes item 2; Undo in A takes back B's change (the latest), not A's own */
    await nudge(A,i1,'ArrowDown');await wait(1500);const u1=x(await items(A),i1);await nudge(B,i2,'ArrowLeft');await wait(1500);const u2=x(await items(A),i2);
    await A.evaluate(()=>window.__osp.undo());await wait(1500);const a3=await items(A),b3=await items(B);
    out.push(row('sync-undo','Undo takes back the latest change, whichever window made it, and the other window follows',u2<x(a2,i2)&&x(a3,i2)===x(a2,i2)&&x(a3,i1)===u1&&JSON.stringify(a3)===JSON.stringify(b3),{a:[x(a3,i1),x(a3,i2)],b:[x(b3,i1),x(b3,i2)],want:[u1,x(a2,i2)]}));
    /* tabs: one opened in A appears in B; closed in A, it closes in B */
    await A.click('#ptab-add');await wait(1500);const nB=await B.evaluate(()=>window.__osp.tabs().length),nA=await A.evaluate(()=>window.__osp.tabs().length);
    out.push(row('sync-tab-open','A tab opened in one window opens in the other',nA===2&&nB===2,{a:nA,b:nB}));
    await A.evaluate(()=>{const t=document.querySelectorAll('#ptabs [data-tab-close]');t[t.length-1].click()});await wait(1500);
    const cB=await B.evaluate(()=>window.__osp.tabs().length),cA=await A.evaluate(()=>window.__osp.tabs().length);
    out.push(row('sync-tab-close','A tab closed in one window closes in the other',cA===1&&cB===1,{a:cA,b:cB}));
    /* a window that is busy (a button held down) takes the change once it lets go */
    await B.mouse.move(700,450);await B.mouse.down();const pre=x(await items(B),i1);await nudge(A,i1,'ArrowRight');await wait(1500);const mid=x(await items(B),i1);await B.mouse.up();await wait(800);const post=x(await items(B),i1);
    out.push(row('sync-busy','A window holding a button down takes the other window\'s change once it lets go',mid===pre&&post===x(await items(A),i1),{pre,mid,post}));
    /* the clipboard: copied in A, pasted in B */
    const n0=(await items(B)).length;await A.evaluate(id=>{window.__osp.setSel([id]);document.dispatchEvent(new KeyboardEvent('keydown',{key:'c',ctrlKey:true,bubbles:true,cancelable:true}))},i2);await wait(300);
    await B.evaluate(()=>{window.__osp.setSel([]);document.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true,cancelable:true}))});await wait(1800);
    const n1=(await items(B)).length,n1A=(await items(A)).length;
    out.push(row('sync-clip','Something copied in one window pastes in another, and the paste reaches the first',n1===n0+1&&n1A===n1,{before:n0,b:n1,a:n1A}));
    const errs=[...A.errs,...B.errs].filter(e=>!/net::|Failed to load resource/.test(e));
    out.push(row('sync-errors','No errors in either window',!errs.length,errs.slice(0,3)));
  }catch(e){out.push(row('sync-run','Window sync checks ran',false,String(e&&e.stack||e).slice(0,400)))}
  await ctx.close();return out}
