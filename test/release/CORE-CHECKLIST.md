# StoreyBook core-function checklist (gate coverage target)

Every row must have at least one gate check per applicable setup:
**D2** desktop 2D · **D3** desktop 3D · **P2** phone 2D · **P3** phone 3D · **T** iPad + Pencil.
Each check must (1) assert the starting state, (2) drive real input where a user would, (3) assert the result,
(4) be proven by a mutation test (break the behaviour in a copy of the app → the check goes red).
"n/a" only where the action cannot exist on that setup (e.g. keyboard shortcuts on a phone); a missing capability is a FAIL, not n/a.

## A. Selection
| # | Action | D2 | D3 | P2 | P3 | T |
|---|---|---|---|---|---|---|
| A1 | Select one object (tap / click) | | | | | |
| A2 | Replace selection by selecting another | | | | | |
| A3 | Add / remove from selection (Shift/Ctrl; Select several on touch) | | | | | |
| A4 | Box select (marquee; Pencil box) | | | | | |
| A5 | Select all furniture | | | | | |
| A6 | Clear selection (empty click/tap, Esc, Select slot) | | | | | |
| A7 | Select a wall, a room, a pin, a section line, a text, a dimension | | | | | |
| A8 | Locked rooms cannot be selected / moved; unlock restores | | | | | |

## B. Edit
| # | Action | D2 | D3 | P2 | P3 | T |
|---|---|---|---|---|---|---|
| B1 | Move by drag | | | | | |
| B2 | Axis-locked move (Shift / second finger) | | | | | |
| B3 | Nudge with arrow keys | | | | | n/a |
| B4 | Rotate 90° both ways | | | | | |
| B5 | Duplicate | | | | | |
| B6 | Copy / paste | | | | | |
| B7 | Delete (key, trash button, menu) | | | | | |
| B8 | Undo / redo after every edit type | | | | | |
| B9 | Group / ungroup | | | | | |
| B10 | Align (left/right/top/bottom/centre) | | | | | |
| B11 | Edit properties in Details (size, name, colour, height) | | | | | |
| B12 | Wall: drag vertex, insert corner, bulge to arc | | | | | |
| B13 | Room: rename (double-click/tap), drag vertex | | | | | |
| B14 | Door: flip hinge / swing | | | | | |

## C. Create (every dock / Draw-sheet tool)
| # | Action | D2 | D3 | P2 | P3 | T |
|---|---|---|---|---|---|---|
| C1 | Room (rect drag) | | | | | |
| C2 | Walls (poly line: points, finish, cancel half-way) | | | | | |
| C3 | Curve (spline) | | | | | |
| C4 | Shape: rectangle, round, L, polygon | | | | | |
| C5 | Road, fence | | | | | |
| C6 | Measure (dimension) | | | | | |
| C7 | Text label | | | | | |
| C8 | Trunk (ceiling) | | | | | |
| C9 | Section line | | | | | |
| C10 | Pin + note | | | | | |
| C11 | Place a library item; rotate while placing; stop | | | | | |
| C12 | Drag-array (single item, workstation set); edit array | | | | | |
| C13 | Column array | | | | | |
| C14 | Make rooms from walls | | | | | |
| C15 | Paint (whole item, one part, wall face, floor) | | | | | |

## D. Views and navigation
| # | Action | D2 | D3 | P2 | P3 | T |
|---|---|---|---|---|---|---|
| D1 | Pan, zoom (wheel / pinch), fit | | | | | |
| D2 | 2D ⇄ 3D ⇄ Building, selection and plan preserved | | | | | |
| D3 | 3D orbit, perspective / top, walls full / cut, furniture toggle, explode | | | | | |
| D4 | Walk: enter from a room, move, exit; interact with doors / lifts | | | | | |
| D5 | Sun study: on, time, month, latitude, north; off | | | | | |
| D6 | Section view on/off, flip | | | | | |
| D7 | Ceiling plan (RCP) on/off | | | | | |
| D8 | Layers: each toggle hides / shows its objects | | | | | |
| D9 | North: set, widget drag, double-click reset | | | | | |
| D10 | CCTV point-of-view | | | | | |

## E. Building and floors
| # | Action | D2 | D3 | P2 | P3 | T |
|---|---|---|---|---|---|---|
| E1 | Add floor, basement; switch floor; reorder; delete | | | | | |
| E2 | Shared walls / columns / cores carry across floors | | | | | |
| E3 | Roof mode enter / edit / exit | | | | | |
| E4 | Building tab fields (heights, slab, north) | | | | | |

## F. Analysis
| # | Action | D2 | D3 | P2 | P3 | T |
|---|---|---|---|---|---|---|
| F1 | Clash check flags an overlap; fix clears it | | | | | |
| F2 | Exits check (egress) runs and reports | | | | | |
| F3 | Schedule: counts, CSV export, copy | | | | | |
| F4 | MIG check | | | | | |
| F5 | Snapshots: take, compare, restore, delete | | | | | |
| F6 | Room areas | | | | | |

## G. Underlay and detection
| # | Action | D2 | D3 | P2 | P3 | T |
|---|---|---|---|---|---|---|
| G1 | Load image / PDF; page switch | | | | | |
| G2 | Calibrate from two points | | | | | |
| G3 | Move, opacity, hide, remove | | | | | |
| G4 | Detect (box, whole sheet), remove traced, undo | | | | | |

## H. Files and data
| # | Action | D2 | D3 | P2 | P3 | T |
|---|---|---|---|---|---|---|
| H1 | New plan, tabs: open, switch, close (dirty prompt) | | | | | |
| H2 | Save, Save as, Open (round-trip keeps everything) | | | | | |
| H3 | My plans: list, open, duplicate, rename, delete, export all, import | | | | | |
| H4 | Export PNG, DXF, IFC, STL | | | | | |
| H5 | Library: search, categories, import / export / reset CSV | | | | | |
| H6 | Clear data in this browser | | | | | |
| H7 | Reload restores the working plan (autosave) | | | | | |

## I. Shell and escape hatches
| # | Action | D2 | D3 | P2 | P3 | T |
|---|---|---|---|---|---|---|
| I1 | A way out of every tool, mode, menu, sheet, modal, selection back to plain Select | | | | | |
| I2 | No dead buttons: every visible control acts or is disabled | | | | | |
| I3 | Settings: each option applies and persists; theme light / dark | | | | | |
| I4 | Shortcuts, Guide, Version dialogs open and close | | | | | |
| I5 | No console errors anywhere above | | | | | |
