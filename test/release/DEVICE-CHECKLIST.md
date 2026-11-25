# Real-device checklist (about 10 minutes, once per release)

The test kit runs every function automatically, but in a browser on a server: no real finger, no Apple Pencil, no real Safari on
an iPhone or iPad, no real graphics card, no on-screen keyboard. This list covers only those. Do it after `npm run kit:full`
says RELEASE OK, on the deployed site (or the single file), with a fresh tab.

Tick each box. Anything that fails: note what you did and what you saw, and it becomes a bug (and, where it can be, a new check).

| Release | Date | Done by |
|---|---|---|
| | | |

## iPad with Apple Pencil (Safari), about 4 minutes

- [ ] **Open and draw.** The app opens with no error. With the Pencil, draw a room by dragging corner to corner: the outline follows the Pencil tip with no visible lag, and the room appears where you lifted.
- [ ] **Finger and Pencil together.** Pan with two fingers while the Pencil rests off the screen: the plan moves, nothing is drawn or selected. Pinch zooms smoothly.
- [ ] **Select and move.** Tap a desk with the Pencil, drag it: it follows. Hold a second finger on the screen while dragging: the move locks to one direction; lift the finger and it moves freely again.
- [ ] **Long-press menu.** Press and hold a desk with a finger: the menu opens under the finger and lifting the finger runs nothing.
- [ ] **Typing.** Tap a number in Details (say Width): the keyboard comes up, the page does not zoom in, the field stays visible above the keyboard; type a value, tap Done, the desk changes.
- [ ] **3D.** Tap 3D: it appears within a few seconds, orbiting with one finger is smooth (no stutter), pinch zooms. Tap Walk, walk with the on-screen stick, tap a door: it opens.
- [ ] **Rotate the iPad** to portrait and back while in 3D: the view, the bar and the stick re-lay out; nothing is cut off.
- [ ] **Split View.** Put Safari beside another app at half width: the app switches to the phone layout and still works (open Library, place an item).
- [ ] **Tutorial.** On an empty plan, the Tutorial offer shows; start chapter 1 and do the first two steps with the Pencil: each step moves on by itself.

## iPhone (Safari), about 3 minutes

- [ ] **Open.** The app opens with no error; the bottom bar (Select, Draw, Library, Details, More) is above the home indicator, not under it.
- [ ] **Draw and place.** Draw › Room, drag a room. Library › a desk › tap the room: it is placed. Every button is easy to hit with a thumb.
- [ ] **Sheets.** Open Library, then pull it down from the middle: it closes. Open Details on a desk, scroll its list, pull down at the top: it closes; pull while scrolled: it scrolls instead.
- [ ] **Keyboard.** Rename the plan (tap its name): the keyboard does not hide the field and the page does not zoom.
- [ ] **3D and Walk.** 3D opens and orbits; Walk works with the stick and closes with Exit walk.
- [ ] **Save and come back.** Make a change, switch to another app for a minute, come back: the change is still there. Close the tab, open the site again: My plans has the plan.
- [ ] **Save to a file.** ⋮ › Save: iOS offers to save or share the file; open it again through ⋮ › Open: the plan comes back the same.

## Laptop or desktop with a graphics card (Chrome, Edge or Safari), about 3 minutes

- [ ] **3D looks right.** Open 3D on the sample office: walls, furniture and floor colours look right, shadows are under the furniture, nothing flickers or is missing. Turn Settings › Smooth edges in 3D on (it reloads): edges are smooth; then off again.
- [ ] **3D is quick.** Orbiting is smooth. Open a large plan (or duplicate the sample's furniture a few times with Ctrl+D, Ctrl+A first): 3D still opens within about 10 seconds and orbits without long pauses; a note may say it is drawn softer, which is expected.
- [ ] **Sun.** 3D › Sun: drag the time; shadows move with it.
- [ ] **SketchUp keys.** With SketchUp keys on (Settings): R, drag a room; M, click a desk, move, click, type 1000 Enter: it moves exactly 1 m; Space returns to Select.
- [ ] **Files.** Save to a file, open it in a new tab with ⋮ › Open: identical. Export PNG and DXF from ⋮: the files download and open.
- [ ] **Two windows.** Open the site in two windows side by side. Move a desk in one: it moves in the other within about a second. Move a different desk in each window at the same time: both moves stay, in both. Undo in either window takes back the latest move. Open a tab in one: it opens in the other.

## Result

- [ ] All ticked: the release can go.
- [ ] Something failed: written up below and fixed (or agreed to ship with) before release.

Notes:
