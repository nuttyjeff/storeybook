# StoreyBook backlog and release log

Rule (set 8 Nov 2026): no version bump and no new build until Jeff calls the release. Everything goes into the table first. Items are worked in the source (app.js / head.html / lib.js), tested, and marked "done (unreleased)". A release bumps the version, runs the gate, builds, and moves the done rows into the release log.

Live: **v4.4.3** at storeybook.pages.dev (deployed 8 Nov 2026). **v4.5.0 built and gated 9 Nov, waiting for Jeff to upload the zip.**
Source on disk: 4.5.0 plus row 20 (unreleased). Last gate run: 111/111 (9 Nov, 16:58). Handed over: `StoreyBook v4.5.0.html`, `storeybook-deploy-v4.5.0.zip`.

Release gate: `node test/release/runner.mjs` (8 layers, 111 checks, ~130 s). Flags: `--only=layer,layer`, `--accept-visual`, `--accept-perf`. Results in `test/release/out/last.json`; visual diffs in `test/release/out/diff-*.png`.

## Workflow per release
1. Jeff reports bugs / asks for features → row added, confirmed in one line.
2. Each row fixed in source with its smoke check added in `test/release/checks/smoke.mjs` → status "done (unreleased)".
3. Jeff says "roll it" and picks the version (patch = fixes only, minor = feature).
4. Bump APP_VERSION → run the gate → fix or accept diffs → on green `node build.js --web` → zip + single-file HTML handed over → done rows move to the release log.
5. Release notes for the version are published to the StoreyBook release notes doc (https://claude.ai/artifact/FfyNs6tPGkQ8cYNMKgmp5S) and the entry is added to the release log below. Standing rule from 9 Nov: every new version gets both.
6. Jeff uploads the zip (Workers & Pages → storeybook → Create deployment) and says it is up → `version.json` on the live site confirmed → rows become "live".

## Open items for the next version

| # | Type | Item | Raised | Status | Notes |
|---|------|------|--------|--------|-------|
| 7 | Feature | .com domain (storeybookapp.com / getstoreybook.com were available) | 8 Nov | Deferred | Jeff's call on timing |
| 8 | Feature | MIG passphrase gate (removed in 4.3) may return | 8 Nov | Deferred | |
| 17 | Bug | Detection, still weak: tiny estate-agent JPEGs (~400 px wide) find 4–6 of 8–9 rooms; angled bays/chamfers mostly missed; light-grey marketing plans over-detect; CAD exports with dense furniture give false doors (cad1: 20 for 6); pen-sketch photos find no rooms; doors drawn as a plain 45° line (no arc) not recognised; no auto-scale for uncalibrated images (guess from door widths would help) | 9 Nov | Open | Needs Jeff's actual failing drawings to prioritise |
| 20 | Bug | Phone/tablet: no way to clear a selection (tap on empty plan only panned; Select slot did nothing in Select). Now a tap on empty plan clears it, and the Select slot clears it (or ends Select several) | 9 Nov | Done (unreleased) | Check p-deselect |
| 21 | UX | Select several is only in the long-press menu: add a tile in the More sheet, and let a finger draw a selection box while Select several is on | 9 Nov | Idea | Raised while answering how to multi-select on touch |
| 19 | Task | 2D/3D parity audit (standing rule: everything in 2D must work in 3D) | 9 Nov | Open | Not started |

## Release log

### v4.5.0 (9 Nov 2026) — built and gated, awaiting upload. Full notes: https://claude.ai/artifact/FfyNs6tPGkQ8cYNMKgmp5S
- North setting per plan: arrow widget on the 2D plan (drag, double-click = north up), field in Building tab and Sun bar, sun study follows it, arrow on PNG export, in 3D / Building view (turns with the camera) and a NORTH layer on DXF
- Set arrays: a workstation set dragged out is one editable array (Rows / Columns / Gaps rebuild every cell); the edited cell stays selected
- Paint on phones: swatch strip above the bottom bar with colour wheel and Done; Part button in 3D for "paint one part only"
- Axis lock while moving: Shift on desktop, a second finger on touch
- My plans: every plan kept in IndexedDB, listed with a thumbnail, floors / rooms / items / time / size; Open, Duplicate, Rename, Delete, New, Open a file, Export all, Import
- Mobile 3D caps: pixel ratio ≤ 1.5, PCF shadows, smaller shadow maps, 1× while walking
- Detect walls / rooms / doors / windows reworked (see row 16 in the 9 Nov history): local-background ink reading, sharper PDF render, small images enlarged, tilted scans straightened, single-line sketches, no pairing with door leaves / furniture / text / gridlines / tile patterns, jambs kept where drawn, windows in solid walls, columns no longer invented at corners or hatched walls, title blocks dropped, slanted walls on clean plans, heavy-drawn walls accepted. Synthetic bench: walls 80→96%, rooms 89→114/114, doors 89→120/120, windows 76→123/125 (false 79→2), columns 15→18/18 (false 34→0)
- Phone: double-tap a pin with the Details sheet closed now puts the cursor in the comment
- Release gate: build, load, golden, smoke, detect, visual, perf, deploy — 111 checks; detection bench under `test/detect/` (18 synthetic plans with ground truth, 12 real plans)
- Dev-only debug hook extended for the gate; stripped from the web build

### v4.4.3 (8 Nov 2026)
- Double-tap a pin (or drop one) opens Notes on that pin with the cursor in it
- Phone sheets capped at 50% of the screen, 40% while typing
- Pull a sheet down by its handle to dismiss; short pull springs back
- One delete rule for key, trash button and phone action row: section line → selected pin → selection
- Lock rooms / Unlock rooms in the More sheet
- Drag-array pitch counts clearance zones; workstations get a 1.2 m band in front (600 desk repeats at 1,800 centres); Repeat dialog defaults Gap down to 1,200 for workstations
- Single items laid out by dragging become editable arrays (Rows / Columns / Gaps in Details)

### v4.4.2 (8 Nov 2026)
- Cancel/Done chip top-right of the plan whenever a tool or action is live on phones; Select slot runs the Esc cascade
- Fields 16 px on phones (stops iOS focus zoom); notes box 120 px; pin comments capped
- 3D toolbar on phones is one scrollable row; Save image / Save STL hidden on phones

### v4.4.1 (8 Nov 2026)
- Trees: only the trunk blocks the walker
- Delete button in the header on phones and tablets; Redo back on narrow phones (Settings and Lock moved to More under 480 px)

### v4.4.0 (8 Nov 2026)
- Phone shell: five-slot bottom bar, Draw and More sheets, library grid with placing strip, Details half-sheet with Rotate / Duplicate / Delete, two-finger pan and zoom, D2 icon
