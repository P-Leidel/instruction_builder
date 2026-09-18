# The hidden export canvas was a keyboard tab stop

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** `App`'s always-mounted, zero-sized, `aria-hidden`
  export canvas (`.app__export-canvas`, the node every SVG/PNG/PDF export
  serializes) was reachable by Tab. A keyboard user tabbing through the
  app hit a stop where focus simply disappeared: no visible focus ring, no
  announced element, nothing on screen to explain where they were. The
  next Tab carried on normally, so the symptom was one silent dead stop
  per pass through the page.
- **Root cause:** `.instruction-canvas` is `overflow-x: auto` - deliberate,
  so a canvas wider than a narrow phone scrolls sideways instead of
  overflowing the page. Chromium makes **scroll containers keyboard
  focusable** so they can be scrolled with the arrow keys, which quietly
  turns any `overflow: auto` element into a tab stop whether or not it
  contains anything focusable. The wrapper's `width: 0; height: 0;
  overflow: hidden` hides the canvas visually and `aria-hidden="true"`
  hides it from assistive technology, but neither of those has any effect
  on the tab order.
- **Fix:** `inert` on the `.app__export-canvas` wrapper, unconditionally.
  The node exists only to be read by `XMLSerializer`/`getComputedStyle`,
  neither of which `inert` affects, so export behavior is byte-for-byte
  unchanged. This also makes the wrapper's intent explicit - it was already
  `aria-hidden`, and `inert` is the same statement for input rather than
  for the accessibility tree.
- **Verified by:** the driver's new tab-stop probe (`IMPORT_DIALOG_TAB_STOPS`,
  added while checking confirm-dialog modality) recorded
  `OUTSIDE:instruction-canvas instruction-canvas--readonly` as a landing
  spot, and reports only dialog buttons and `<body>` after the fix.
- **Worth noting:** this was found while fixing something else entirely,
  and had nothing to do with dialogs - the tab stop was there on every page
  view, modal or not, and had been since the hidden canvas was introduced
  in task 15. Nothing checked the tab *order* before, only that particular
  elements were focusable; the probe that found it checks the opposite
  direction, which is what made it visible.
- **Found & fixed:** 2026-09-18 (while remediating the 2026-09-18 codebase
  health review's finding 7).
