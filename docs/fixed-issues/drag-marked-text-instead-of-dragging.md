# Dragging a token marked the text instead

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** users reported that while dragging they "keep marking the
  text when grabbing the token" - a press-and-drag started a browser text
  selection, so the app's drag gesture doubled as a swipe-to-select and left
  a trail of highlighted labels behind it. Reproduced in Chromium two ways:
  a press starting on the "Add to step" panel's own heading and dragging
  down across the grid selected `"Add to step / Actions / Objects / Tools /
  Chop / Slice / Stir"` - the heading, all three category tabs, and the
  token buttons' labels - and a press starting on a step's title on the
  canvas swept up the step's number badge. Same gesture on touch, where a
  press-and-hold is also the platform's own text-selection gesture.
- **Root cause:** neither region ever opted out of text selection. Nothing
  about them is readable content: the canvas is a diagram (its copy path is
  Export, tasks 15-18, not the clipboard) and the picker is a grid of
  controls - but the browser has no way to know that, so a press that landed
  on any non-control part of either one anchored a selection and the drag
  extended it. What made this look intermittent is that a press landing
  *squarely on a drag source* - a token chip, a picker button, the step
  reorder handle - never marked anything even before the fix: those call
  `setPointerCapture` on `pointerdown`, and a captured press never anchored
  a selection in the pre-fix baseline run. Only a grab that *missed* - a
  pixel off a chip onto the step title, or into the gap between two picker
  buttons - reproduced it.
- **Fix:** `user-select: none` (with the `-webkit-` prefix Safari/iOS still
  needs) on `.instruction-canvas__svg`, on `.token-picker`, on
  `.token-picker__button` - which `TokenDetails`' warning presets reuse
  outside that panel - and on `.drag-ghost`, the label that follows the
  pointer mid-drag. Applied to the whole SVG and the whole picker panel
  rather than to the draggable elements alone, precisely because the
  draggable elements were never the ones that reproduced it. Deliberately
  scoped rather than page-wide: real text elsewhere still selects, including
  the canvas card's own `<h2>`, which sits outside the SVG.
- **Verified by:** a focused Playwright script with a `--baseline` mode that
  re-enables selection in exactly those four places, so the checks are shown
  to fail without the fix: the picker-heading swipe and the step-title swipe
  both report a selection before and none after, nine other gestures (a
  canvas token drag, a picker-to-canvas drag, a picker-label swipe, a step
  handle drag, a chip-label swipe, a step-background swipe) stay clean, and
  two controls confirm the scope - the canvas heading still selects by drag
  and a text input still selects its contents. The drags still do their jobs
  (the token still moves, the picker drag still adds). `DRAG_NEVER_MARKS_TEXT`
  and `PAGE_TEXT_STILL_SELECTABLE` in `driver.mjs` keep both halves covered
  from here on.
- **Found & fixed:** 2026-09-20 (task 30, Test Real Users) - the same
  feedback round as the drop-accuracy work in
  [../phase-3/progress/token-drop-accuracy.md](../phase-3/progress/token-drop-accuracy.md).
