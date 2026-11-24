# StoreyBook test kit

One command after every build. It builds the app, runs the release gate at the size you pick, and writes a report page.

| Command | When | Takes (this container) | Runs |
|---|---|---|---|
| `npm run kit` | after every build | about 5 min | build, load, old plan files, every shipped feature, screenshots, speed, deploy |
| `npm run kit:standard` | before pushing a feature | see the report | the above + rules, bad input, simulated users, detection, and the device checks with SketchUp keys on (desktop and iPad) |
| `npm run kit:full` | before a release | see the report | everything: the device checks with StoreyBook keys and with SketchUp keys, on every device size |

The times are printed in each report; `test/release/out/kit-history.json` keeps the last 30 runs.

## Reading the result

The terminal ends with one line, for example `Test kit (Quick): PASS · 0 failed · 1 flaky · 5 min`, and the path of the report:
`test/release/out/report.html`. Open it in a browser. It shows:

- **The verdict.** PASS or BLOCKED; RELEASE OK only from the Full kit.
- **Every layer**, what it checks, its result and how long it took.
- **Each failure**, with a picture of the page when the check failed, what the check saw, the command that runs just that check again
  (with a Copy button), and whether it is new or also failed last time.
- **Flaky checks.** A layer with failures is run once more. A check that fails and then passes is listed as flaky and does not block.
  One that keeps turning up needs its timing fixed.
- **Known issues** from `known.json`, and the last eight runs.

## What to do

- **Green:** carry on.
- **Red:** open the report, fix each failure, run the kit again. Use the command under a failure to re-run only that check while you work.
- **A screenshot changed on purpose:** look at the new picture in `test/release/out/` first, then `npm run kit -- --accept-visual`.
- **You fixed a bug:** add a check that fails before the fix and passes after (in `checks/smoke.mjs`, or the matrix slice it belongs to).
- **Before a release:** `npm run kit:full` must say RELEASE OK.
- **Narrow a run:** `npm run kit -- --only=build,smoke` runs just those layers with the same report.

## SketchUp keys

The app opened with `#osp-debug` uses StoreyBook keys; with `#osp-debug-su` (or `SB_SUKEYS=1` for any test) it uses SketchUp keys.
The `matrix-su` layer runs the device checks that way; its check ids end in `@su`. `MX_SU_FILES` picks the slices.

## Notes

- Pictures are taken of the one page in use when a check records its result. When several pages are busy at once no picture is taken
  rather than a wrong one, and a few checks tidy up before recording, so a picture can show the state after the tidy-up.
- Everything runs in Chromium with a software renderer. Safari and real graphics cards are not covered here.
- `SB_NORETRY=1` turns off the second run; `SB_SHOTS=0` turns off the pictures.
