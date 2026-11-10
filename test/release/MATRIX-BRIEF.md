# Brief for every agent writing StoreyBook gate checks

You write Playwright checks for StoreyBook (a single-page floor-plan / building planner). You do NOT edit the app source
(`/home/claude/planner/app.js`, `head.html`, `lib.js`, `build.js`) — ever. You write only your own slice file(s) under
`/home/claude/planner/test/release/checks/matrix/` and scratch files under your own `/tmp/<your-dir>/`.

## The app
- `app.js`: one IIFE with all logic. `head.html`: markup + CSS (desktop dock `.dock`, header buttons `#b-*`, menu items `#m-*`,
  inspector tabs `[data-tab=sel|sch|bld|fire|und|notes]`, phone bottom bar `#mbar [data-m=select|draw|lib|insp|more]`,
  sheets `#msheet`, esc chip `#esc`, paint strip `#paintstrip`, placing strip `#pstrip`, Select-several bar `#multibar`,
  context menu built by `showCtx`, My plans modal `#plans-modal`, 3D bar `#v3` with `#v3-*`, sun bar `#sun-bar`, walk HUD `#walk-hud`).
- `PHONE()` = viewport max-width 820px → phone shell. `TOUCH` = pointer:coarse. Pens: `PEN_SEEN`.
- Read the debug hook at the end of app.js (`window.__osp={`): S(), V, sel(), setSel, setTool, undo, redo, T3(), WALK, pins(),
  planJSON, openPlanText, PLANS, exportDXF, exportIFC, clash, egressRun, snapTake/snapCompare, switchFloor, setNorth, runDetect,
  loadUnder, P(), fit, toastOff, etc. Use it to READ state and to set up preconditions; use REAL input (mouse, keyboard, CDP touch,
  synthetic pen PointerEvents) for the action under test wherever a user would act with input.
- Existing gate: `/home/claude/planner/test/release/` — `lib.mjs` (browser, openApp(b,{phone,url,sample}), touch, click, to3D, to2D,
  scr, row, devices), `checks/smoke.mjs` (study it: style, idioms, many worked flows), `runner.mjs`.
- The coverage target is `/home/claude/planner/test/release/CORE-CHECKLIST.md`. Setups: D2 desktop 2D, D3 desktop 3D, P2 phone 2D,
  P3 phone 3D, T iPad + Pencil.

## Build to test (never the files in /mnt/user-data/outputs)
```
D=/tmp/<your-dir>; mkdir -p $D && cd /home/claude/planner && cp app.js head.html lib.js $D/ && \
sed "s#const OUT='/mnt/user-data/outputs'#const OUT='$D'#" build.js > $D/build.js && cd $D && node build.js
# → $D/StoreyBook v4.5.0.html ; open as file://$D/StoreyBook%20v4.5.0.html#osp-debug   (use pathToFileURL)
```
Slice files must honour `process.env.SB_URL` (pass `url` to openApp only when it is set; otherwise lib's default dev file is used by the real gate).

## What makes a check acceptable ("bulletproof")
1. **Precondition asserted**: before the action, assert the state that makes the result meaningful (e.g. something IS selected
   before testing "clear selection"; the object is NOT already at the target position). A check that would pass if the action
   did nothing is wrong.
2. **Real input** for the action (see above). Coordinates from `getBoundingClientRect()` / world→screen via `V` (2D) or the three.js
   camera projection (3D). Verify the point is on screen and that `document.elementFromPoint` hits what you intend.
3. **Specific postcondition**: assert the exact expected change (ids, counts, coordinates within tolerance, class/hidden flags),
   and that nothing else changed that shouldn't (e.g. a pan did not select or move anything; a cancel left object count unchanged).
4. **No fixed sleeps as the assertion mechanism**: use `page.waitForFunction` on the condition (timeouts ≤ 5 s); short sleeps only to
   let animations settle before taking coordinates.
5. **Independent**: each check sets up its own state (fresh page per group, or undo back to the start and assert you are back).
6. **Mutation-tested** — the core requirement. For EVERY check, create a mutated copy of app.js in your scratch dir that breaks
   exactly the behaviour under test (comment out the handler line, invert a condition, return early, swap a sign), build it,
   point SB_URL at it, run the check, and confirm it FAILS. Restore and confirm it PASSES on the real build. Write the mutation into
   the check file as a comment above the check: `// mutation: <file:approx line> <what was changed> → FAIL confirmed`.
   A check that stays green against its mutant must be rewritten. Do this with a small script that applies a `{find, replace}` to a
   copy of app.js (assert the find string occurs exactly once).
7. **Ids** unique, prefixed with your slice prefix, and stable. Names are plain English saying what the user can do, e.g.
   `phone 3D: tap empty floor clears the selection`.
8. **Console errors**: every page's `pg.errs` must stay empty; end each page group with a row asserting it.
9. **Runtime**: keep your slice under the budget given in your task. Close every context you open.

## A failing check is a finding, not a problem to hide
If the app genuinely cannot do a checklist action on a setup (missing feature, broken behaviour, no way out of a state), keep the
check and let it FAIL. Never weaken an assertion, widen a tolerance beyond what a user would accept, skip a setup, or mark
something n/a to turn red into green. Fix only test-side mistakes (selector, timing, coordinate maths).

## Iterate standalone
```
SB_URL="file:///tmp/<dir>/StoreyBook%20v4.5.0.html#osp-debug" node -e "import('/home/claude/planner/test/release/lib.mjs').then(async L=>{const b=await L.browser();const m=await import('/home/claude/planner/test/release/checks/matrix/<file>.mjs');const t=Date.now();const R=await m.run(b);console.log(R.map(r=>(r.pass?'PASS ':'FAIL ')+r.id+' | '+r.name+(r.pass?'':' :: '+r.detail)).join('\n'));console.log(R.filter(r=>r.pass).length+'/'+R.length,(Date.now()-t)/1000+'s');await b.close()})"
```
Playwright lives at /opt/npm-tools (lib.mjs loads it). Install nothing. Other agents run in parallel on other slices: the machine may
be slow, so condition waits matter. Do not touch other agents' files.

## Report back (final message)
1. Checks written; pass / fail counts; runtime.
2. Mutation testing: number of checks mutation-confirmed; any you could not mutate and why.
3. Each FAIL you believe is a real app bug: id · what the user experiences · steps · likely spot in app.js (function / line).
4. Checklist rows (CORE-CHECKLIST ids, per setup) you covered, and any you could not, with the reason.
Concise: under 600 words.
