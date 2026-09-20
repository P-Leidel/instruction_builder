# Token drag-and-drop: drop accuracy and the eaten tap

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-20

Task 30 (Test Real Users) feedback, scoped through
`/mattpocock-skills:grilling` before any code was written. The reports were
that token drag-and-drop "feels unresponsive," from a mix of desktop and
touch users - which is what ruled out treating it as a touch-only threshold
problem.

## What was reported

Two things, in the user's own framing:

- "Tokens should be able to connect on both sides." This resolved during
  the grilling session to **drop-side precision** - a chip should accept an
  insertion before *or* after it - not graph/branching connectors.
- Drag-and-drop generally feels unresponsive, with a request to find and fix
  the underlying bugs first rather than tune anything.

## What was actually wrong

Reading the drag path end to end turned the second report into three
concrete defects, two of which compounded into a genuinely destructive one.

**The gap between two chips silently appended to the end of the step.**
`resolveTokenDropTarget` hit-tested with `elementFromPoint`, which only ever
reports the one element under the pointer. The 16-unit `CHIP_GAP` has no
element of its own, so a drop there missed every chip, fell through to the
step background, and returned `index: Infinity` - "append". Dropping a token
into the visible gap between two others, the most natural way to express
"put it here", sent it to the end of the step instead.

**A chip drop could only ever insert *before* that chip.** There was no
"after" side at all, so the only way to land a token after the last chip was
to find empty step background - the report's "both sides" complaint,
exactly.

**A wobbly press did nothing whatsoever.** The drag threshold was a uniform
6px for every pointer type. Finger wobble exceeds that, so a tap became a
"drag" that dropped on the token's own slot; `moveTokenCore`'s `changed`
guard ([state/document.ts](../../../src/state/document.ts)) then returned
early, and `TokenChip`'s `move` branch never fell through to select. No
move, and no selection either: the user pressed a token and the app did
nothing at all.

Those last two compounded. Before this change, wobble that drifted into the
gap yanked the token to the end of the step - a silent, destructive edit
from what the user experienced as a tap.

## What shipped

Seven changes, all of them agreed in the grilling session before
implementation started.

### The drop resolver is a bounding-rect scan now

> ⚠️ **Superseded 2026-09-20 (later the same day) by
> [the layout hit-testing work](./architecture-2026-09-20-layout-hit-testing.md).**
> This section describes what shipped here, and the *behaviour* it describes
> still holds - every point in a step belongs to exactly one slot, and a chip
> accepts an insertion on either side. The mechanism below does not: drop
> resolution no longer measures the DOM at all, and works in canvas design
> units against the rendered `CanvasLayout` rather than in client
> coordinates against live rects. The client-coordinate reasoning in the
> second paragraph is exactly what that change reversed, and the
> "measured copy was subtly not the computed one" bug it left behind - a
> chip with a token-time label measuring taller than an untimed sibling -
> is what forced the rework. Read that file before relying on anything here.

[lib/pointer-drag.ts](../../../src/lib/pointer-drag.ts) still finds the
*step* with `elementFromPoint`, but the slot within it is now
`resolveDropSlot`: clamp the pointer to the nearest row of chips, then
compare its x against each chip's own horizontal midpoint. Left half inserts
before, right half after, and the gap resolves to the boundary it straddles.
That one change fixes both of the first two defects at once - there is no
dead zone left anywhere in a step, because every point now belongs to
exactly one slot.

It works in **client coordinates**, read live from `getBoundingClientRect()`,
rather than the SVG-user-unit `ChipPosition`s in `canvas-layout.ts`: a
pointer event's coordinates are already client coordinates, so comparing the
two directly sidesteps the canvas's `viewBox` scaling instead of having to
undo it. The core is a pure function over an array of rects, so all of the
geometry is unit-tested without a DOM; `resolveTokenDropTarget` is only the
thin part that reads the rects out of the page.

**Nearest-row clamping applies uniformly**, chosen deliberately over carving
out an exception for the bands above and below the chips. The accepted
consequence: hovering the far left of a step's header band resolves to
*insert at front* rather than append, because it clamps to row 0. The live
insertion marker shows that before release, which is why one uniform rule
beat a special case.

The step lookup moved from `data-step-id` to `data-step-index`. A chip
carries its step's id too (it needs it to report where a drag started), so
`closest("[data-step-id]")` from a point over a chip stops at the chip
itself; `data-step-index` is on the step card alone.

### The insertion marker follows the hovered row

A row boundary is where the drop index alone stops being enough: on the
6-per-row desktop layout, index 6 is both "after the last chip of row 0" and
"before the first chip of row 1" - identical insertions, a full row apart on
screen. So the hovered row travels with the target. The `dropTarget` signal
is typed `TokenDropSlot` (`TokenDropTarget & { row: number }`), leaving
`TokenDropTarget` itself as the narrow drop instruction that `moveToken` and
`addTokenToStep` consume - deliberately extending the shared type rather
than re-forking it, per the consolidation recorded in
[known-issues.md](../../known-issues.md).

`insertionMarkerPosition` ([lib/canvas-layout.ts](../../../src/lib/canvas-layout.ts))
then generalizes the special case it already had for appending to an
exactly-full row: at any row boundary, if the pointer is in the row *before*
it, the marker draws just past that row's last chip instead of at the start
of the next row.

### A drag that ends where it started is a tap

`resolveTokenPointerOutcome` now takes the dragged token's own
`stepId`/`index` and returns the tap outcome when the drop lands back on its
own slot - own index *or* own index + 1, since `adjustIndexForRemoval` maps
both back to the position it already occupies. This is the correctness
backstop for the eaten tap at *any* drift distance, not just below a
threshold.

### Per-pointer-type drag thresholds

6px for mouse and pen (unchanged), 12px for touch, from `event.pointerType`.
With the own-slot fallback as the backstop, the touch value only has to
catch the common case, so it is deliberately conservative rather than as
high as it could be - a higher bar would make a real touch drag feel sticky
to start.

Worth recording: the rect scan alone already defuses the *destructive* half
of the wobble bug. With midpoint geometry, drift resolves to either the
token's own index or own index + 1, both of which `tokensEqual` sees as
unchanged - it takes roughly 112px of drift to cause a real move. The
threshold and the own-slot fallback are about recovering the eaten *tap*,
not about preventing a wrong move.

### A cancelled drag no longer performs a selection

`pointercancel` used to be forwarded as `onDrop(..., wasDrag: false)`, which
is indistinguishable from a deliberate tap - so the browser taking the
pointer away mid-drag silently selected a token. `DragHandlers` has a
required `onCancel` now, and all three call sites (`TokenChip`, `StepCard`,
`TokenPicker`) tear down their own `dragGhost`/`dropTarget` in it. Required
rather than optional on purpose: an optional one would have let a fourth
drag source quietly reintroduce the same laundering.

### One guarded `dropTarget` setter

Every `StepCard` subscribes to the `dropTarget` signal, so writing an
equal-but-new object re-renders every step in the document for nothing - once
per animation frame, for as long as a drag lasts. `TokenChip` hand-rolled a
guard for this; `TokenPicker` simply didn't have one, so dragging a new token
in from the picker re-rendered the whole canvas at refresh rate. The guard is
now `setDropTarget` in [state/drag.ts](../../../src/state/drag.ts), beside the
signal, used by both drag sources - one setter can't drift the way two copies
of a guard can.

### The dragged chip dims

Plain local `useState` in `TokenChip`, rendering
`.instruction-canvas__token--dragging` at `opacity: 0.4` - the same value the
canvas already uses to dim a control that isn't currently acting
(`.instruction-canvas__step-move--disabled circle`), rather than a second
dimming value meaning the same thing. Local state, not shared: the chip that
started the drag is the only one that needs to know, and a `TokenPicker` drag
correctly dims nothing.

**One deviation from the agreed spec, flagged for the user:** the dim is set
from the first `onMove` (a real drag passing the threshold) rather than from
`pointerdown` as specified. Setting it on `pointerdown` would dim on every
plain tap too, and a tap is also how a token gets selected - a flicker on
every select. Trivial to switch back if the press-feedback reading was the
intent.

### One new pair of domain terms

[CONTEXT.md](../../../CONTEXT.md) gains a **drop target / drop slot** entry.
Two similarly-named types now exist on purpose - the narrow drop instruction
the document mutators consume, and the same thing plus the hovered row that
the live marker needs - and that is exactly the kind of distinction that
doc exists to settle before someone "simplifies" one into the other.

## A separate bug from the same report

Testing this by hand surfaced the other half of what users were describing:
a press-and-drag that missed a chip, or landed between two picker buttons,
started a *text selection* and swiped a highlight across the labels it
passed. That is not a drop-accuracy problem and did not belong in the
changes above - it is one CSS rule, written up on its own in
[drag-marked-text-instead-of-dragging.md](../../fixed-issues/drag-marked-text-instead-of-dragging.md).

## Explicitly deferred

Three further improvements are bundled and gated on the user's own hands-on
pass, written up in
[known-issues.md](../../known-issues.md): no auto-scroll while dragging, no
insertion marker for a step-reorder drag, and a cross-step token drag
deselecting the token it moved.

## Verification

- `npm run lint`, `npx tsc -b`, `npm test` (179 tests, up from 161 - 15 new
  in `pointer-drag.test.ts` covering `resolveDropSlot` end to end (the gap,
  both chip halves, both sides of a row boundary, an empty step, the header
  band, past the last chip, the row-gap, and mobile's single row), the
  own-slot tap fallback, and the per-pointer-type thresholds; 3 new in
  `canvas-layout.test.ts` for the row-boundary marker, plus the 4 existing
  `insertionMarkerPosition` calls updated for its new `hoveredRow`
  argument), and `npm run build` all pass cleanly.
- The full `run-instruction-builder` Playwright driver passes end to end,
  with 0 console errors and 0 axe violations at all five viewports/states.
  It gained three checks for this work -
  `TOKEN_DROP_SIDE_DECIDES_BEFORE_OR_AFTER`,
  `TOKEN_DROP_IN_GAP_LANDS_AT_THAT_BOUNDARY`, and
  `WOBBLY_PRESS_SELECTS_INSTEAD_OF_MOVING` - and one existing check,
  `FORWARD_TOKEN_DRAG_LANDS_AT_DROP_POINT`, had to be corrected: it dropped
  on the target chip's exact center, which is now the boundary between the
  before and after sides, so it was asserting the old whole-chip semantics.
  It aims a few pixels into the left half now. SKILL.md records both that
  and the tap-instead-of-no-op change as gotchas, since any future driver
  check drags the same way.
- The row-boundary marker was checked by reading its live position
  mid-drag, on both sides of the same drop index: it draws at the end of row
  0 (x ≈ 1021) when the pointer is there, and at the start of row 1
  (x ≈ 349, a full row lower) for that same index - confirmed in
  screenshots, since "does the marker look like it's in the right place" is
  not something a unit assertion can settle.
- **Still outstanding: the user's own hands-on pass.** The original reports
  are about feel, not a reproducible failure, so that is the real gate -
  and the deferred bundle above does not start until it passes.
