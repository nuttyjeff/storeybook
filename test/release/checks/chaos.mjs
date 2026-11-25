/* layer: chaos. Random real input (taps, drags, keys, every visible control, odd values typed into fields) with faults injected around the
   app while it runs: storage full, the plans database failing, the network down, the clipboard refused, the 3D context lost, the window
   resized, the page frozen or hidden, a gesture cancelled, a modifier key stuck, garbage pasted or dropped, a key storm, very long text.
   After every action: no page error, the plan saves and loads, no NaN, no duplicate ids, no stuck dialog, tools and buttons agree.
   After every fault: the app draws, saves and stores again. At the end, undo everything returns the start plan and redo everything the end.

   A new random seed every run, so each run explores new ground; the seed is in every row (and in the report's re-run command).
   SB_SEED=<n> replays a run. SB_CHAOS_DEV=desktop,ipad,iphone picks devices, SB_CHAOS_N the actions per device, SB_CHAOS_FAULTS the chance
   of a fault per action (default 0.12). The fuzz engine is the one in matrix/robust.mjs. */
import {row} from '../lib.mjs';
export const name='chaos';
export async function run(b){
  const {fuzzOne}=await import('./matrix/robust.mjs');
  /* one seed per test run: a second run of this layer (the runner's retry) replays the same one */
  if(!process.env.__CHAOS_SEED)process.env.__CHAOS_SEED=String(process.env.SB_SEED||(Date.now()%1000000007));
  const seed=+process.env.__CHAOS_SEED,devs=(process.env.SB_CHAOS_DEV||'desktop').split(',').filter(Boolean),N=+(process.env.SB_CHAOS_N||120),rate=+(process.env.SB_CHAOS_FAULTS||0.12);
  const R=[];
  for(let i=0;i<devs.length;i++){const kind=devs[i];
    const add=(id,nm,pass,detail)=>{const r=row(id,nm,pass,detail);r.seed=seed+i;r.dev=kind;R.push(r)};
    await fuzzOne(b,kind,seed+i,N,add,{prefix:`ch-${kind}-`,faults:rate})}
  return R}
