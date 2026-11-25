# StoreyBook test kit

One command after every build, and it runs by itself on every push to GitHub. It builds the app, runs the checks at the size you pick, and
writes a report page.

| Command | When | Takes (this container) | Runs |
|---|---|---|---|
| `npm run kit` | after every build; on every push (GitHub) | about 10 min | build, load, old plan files, every shipped feature, **every function**, **random input with injected faults** (desktop), screenshots, speed, deploy |
| `npm run kit:standard` | before pushing a feature | about 26 min | the above + rules, bad input, simulated users, detection, random input and faults on desktop and iPad, the device checks with SketchUp keys on (desktop and iPad) |
| `npm run kit:full` | before a release | about 60 min | everything: the device checks with StoreyBook keys and with SketchUp keys on every device size, random input and faults on desktop, iPad and iPhone |

The times are printed in each report; `test/release/out/kit-history.json` keeps the last 30 runs.

## What is checked

| Layer | What it does |
|---|---|
| build, load, golden, deploy | the app builds, opens with no errors, opens plan files from every old version unchanged, and the website folder works |
| smoke | one check for every feature that has shipped (add one per backlog item; never delete one) |
| **functions** | **every function a person can reach**, run once through the real interface in a fresh browser: every Search command, every documented shortcut with StoreyBook keys and with SketchUp keys, every right-click entry (empty ground, desk, two desks, group, room, wall, door, both key sets), every Settings control (and settings survive a reload). Each must raise no error and change something visible |
| **chaos** | **random real input** (taps, drags, keys, every visible control, odd values typed into fields) **with faults injected**: storage full, the browser database refusing writes, the network down, the clipboard refused, the 3D graphics lost, the window resized, the page frozen or hidden, a gesture cancelled, a modifier key stuck, garbage pasted or dropped, key storms, very long text. After every action: no page error, the plan still saves and loads, no NaN, no duplicate ids, no dialog without a way out. After every fault: the app draws, saves and stores again. At the end, undo everything gives back the start and redo everything the end. **A new random seed every run**, so each run explores new ground |
| rules, except, users | rules that hold after every action; broken files, bad CSVs and garbage AI answers; five simulated people doing whole jobs |
| matrix, matrix-su | every basic action on every device and view, with StoreyBook keys and again with SketchUp keys (ids end in `@su`); every library item placed |
| detect, visual, perf | floor plan detection, screenshots against the accepted ones, speed against the recorded numbers |

## Reading the result

The terminal ends with one line, for example `Test kit (Quick): PASS · 0 failed · 1 flaky · 10 min`, and the path of the report,
`test/release/out/report.html`. On GitHub, the run page shows a summary table and the report is attached as the `kit-report` artifact.
The report shows:

- **The verdict.** PASS or BLOCKED; RELEASE OK only from the Full kit.
- **Every layer**, what it checks, its result and how long it took.
- **Each failure**, with a picture of the page, what the check saw, the command that runs just that check again (with a Copy button),
  and whether it is new or also failed last time. For a chaos failure the command includes the seed, so it replays the same run.
- **Flaky checks.** A layer with failures is run once more (chaos with the same seed). A check that fails and then passes is listed as
  flaky and does not block. One that keeps turning up needs its timing fixed.
- **Coverage.** How many checks covered each kind of function in this run, and every row of the core checklist
  (`CORE-CHECKLIST.md`, matched through `coverage.json`). In the Full kit a row with no check is marked red.
- **Known issues** from `known.json`, and the last eight runs.

## What to do

- **Green:** carry on.
- **Red:** open the report, fix each failure, run the kit again. Use the command under a failure to re-run only that check while you work.
- **A chaos failure:** run its command (it has the seed) until you can see what happens, fix the app, then run it again. If the failure was
  in the test's own judgement rather than the app, fix the rule in `checks/matrix/robust.mjs` and say why in a comment.
- **A screenshot changed on purpose:** look at the new picture in `test/release/out/` first, then `npm run kit -- --accept-visual`.
- **You fixed a bug:** add a check that fails before the fix and passes after (in `checks/smoke.mjs`, or the slice it belongs to).
- **You added a function:** a new Search command, right-click entry or setting is picked up by the functions layer by itself.
  A new shortcut needs a line in `SBKEY`/`SUKEY` in `checks/functions.mjs` (the layer fails until it has one, so it cannot be missed).
  A new checklist row needs a pattern in `coverage.json` if its checks do not carry the row code in their ids.
- **Before a release:** `npm run kit:full` must say RELEASE OK (or run the release gate on GitHub, split across machines), then work through
  `DEVICE-CHECKLIST.md` on a real iPad with Pencil, iPhone and laptop (about 10 minutes): the things a server browser cannot see.
- **Narrow a run:** `npm run kit -- --only=build,functions` runs just those layers with the same report.

## Settings for a run

| Variable | What it does |
|---|---|
| `SB_SEED=<n>` | replay a chaos run |
| `SB_CHAOS_DEV`, `SB_CHAOS_N`, `SB_CHAOS_FAULTS` | chaos devices (`desktop,ipad,iphone`), actions per device, chance of a fault per action (0.12) |
| `SB_FN=cmd,key,ctx,set` | which parts of the functions layer run |
| `SB_CHECK=<regex>` | run matching checks only (functions, and matrix slices that support it) |
| `SB_SUKEYS=1` | open the app with SketchUp keys (`#osp-debug-su`) for any test |
| `SB_NORETRY=1`, `SB_SHOTS=0` | no second run of a failing layer; no failure pictures |

## Notes

- Pictures are taken of the one page in use when a check records its result. When several pages are busy at once no picture is taken
  rather than a wrong one, and a few checks tidy up before recording, so a picture can show the state after the tidy-up.
- Everything runs in Chromium with a software renderer, plus Safari's engine (WebKit) on GitHub. Real touch, Apple Pencil, on-screen
  keyboards and real graphics cards are covered by `DEVICE-CHECKLIST.md`, by hand.
- On GitHub, screenshots are compared with their own baseline (`baseline-ci`, kept in the artifact): fonts there differ from this machine.
