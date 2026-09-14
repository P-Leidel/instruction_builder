# Toolbar export/import buttons overflowed the page on narrow phones

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** on phone-width viewports (~390px and narrower), "Export
  PDF" and "Import" - the last two of the toolbar's five export/import
  buttons - were pushed off the right edge of the screen, and the whole
  page gained 175-205px of dead horizontal scroll. The other three buttons
  (Export JSON/SVG/PNG) appeared to wrap onto their own row normally, which
  made the bug easy to miss without actually scrolling the page sideways.
- **Root cause:** `.app__file-controls` (the toolbar group holding all five
  buttons) had `flex-wrap: wrap` on itself but also `flex-shrink: 0` as a
  flex item of the outer `.app__toolbar`. `flex-shrink: 0` pinned it at its
  own full, un-wrapped content width (~550px, the width of five buttons in
  a row) no matter how little room the toolbar actually had - so it was
  never actually squeezed narrower than that width, and its own
  `flex-wrap: wrap` never had a reason to move any button onto a new line.
  It just rendered its whole un-wrapped self, with the tail end of it
  spilling past the viewport.
- **Fix:** changed `.app__file-controls` to `flex-shrink: 1` with an
  explicit `min-width: 0` (the standard fix for a flex item that also needs
  its own children to wrap: without `min-width: 0`, a flex item's automatic
  minimum size is still based on its un-wrapped content, which has the same
  effect as `flex-shrink: 0` in practice). Now the outer toolbar can size
  this group down to the row's actual available width, and its own
  `flex-wrap: wrap` genuinely takes over from there.
- **Verified by:** a scripted audit across six viewport widths (360, 390,
  799, 800, 900, 1400px) checking `document.documentElement.scrollWidth`
  against `clientWidth` and flagging any toolbar button whose bounding box
  fell outside the viewport - confirmed 175-205px of overflow and 2-3
  offscreen buttons at 360/390px before the fix, zero at every width after.
- **Found & fixed:** 2026-09-14 (task 21, Build Responsive Layouts).
