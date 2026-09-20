# Domain context

Terms used consistently across `docs/` and `src/`, kept here so architecture
reviews and new contributors have one place to check a name's meaning
instead of reverse-engineering it from call sites.

## Document session

A **document session** is one editable `InstructionDocument` together with
its undo/redo history (`past`/`future`), its selection
(`selectedStepId`/`selectedTokenId`), and its token clipboard
(`copiedToken`) - everything one instance of the app has open at a time.
It's constructed by `createDocumentSession()` in
[src/state/document.ts](./src/state/document.ts).

The running app uses exactly one document session (the module-level
`defaultSession` in that file), and every existing import from
`state/document` (`document`, `addStep`, `undo`, ...) is a thin, zero-argument
binding to it, so no consumer had to change when the session became
constructable. A second document session - independent signals, independent
undo/redo, independent coalescing clock - can be constructed by any other
caller (a test, or a future embedded/second instance of the app) via the
same `createDocumentSession()` factory, without touching the browser's one
JS realm the way the module-level-only version before it required.

This term replaces the informal "module-level singleton" phrasing used in
[docs/known-issues.md](./docs/known-issues.md) while that item was still
open; see [docs/phase-2/progress/README.md](./docs/phase-2/progress/README.md)
for when it was resolved.

## Token clipboard

The **token clipboard** is a document session's single-slot, in-memory
holding area for one copied token (`copiedToken`) - a full deep copy of an
`InstructionToken`, including its `note`/`quantity`/`warning`/`time`, but
with a freshly generated `id`. Copying a token writes it here, overwriting
whatever was held before; pasting reads it and appends a further fresh-id
copy onto the currently selected step, and can be repeated indefinitely
without clearing the clipboard. It is session-only UI state, not part of
the document: it isn't saved, isn't part of undo/redo history, and doesn't
touch the operating system's real clipboard - a browser tab reload or a
document replace (New/Import) simply loses it, the same way selection does.
_Avoid_: "copy buffer", "system clipboard" (this is never that).

## Field popover

A **field popover** is the small floating panel a collapsed field's edit
form renders in - the four day/hour/minute/second boxes behind "+ Time",
or the amount/unit pair behind "+ Quantity". It is anchored to the trigger
button that opened it, and it floats above the layout rather than
expanding inside it, because a **collapsed field**'s own footprint must
never change just because its form opened: Token time and Quantity sit in
one row, and either one growing in place shoves the other sideways
mid-edit. See
[src/components/FieldPopover/FieldPopover.tsx](./src/components/FieldPopover/FieldPopover.tsx)
for the panel and
[src/components/CollapsedField/CollapsedField.tsx](./src/components/CollapsedField/CollapsedField.tsx)
for the collapsed/edit-toggle chrome around it.

It is deliberately **non-modal**: nothing behind it is inert, there is no
backdrop, Tab moves out of it normally, and Escape or a click outside
closes it. Which of the four positions it takes around its trigger
(below or above, left- or right-aligned) is **field placement**, decided
by `resolveFieldPlacement` in
[src/lib/field-placement.ts](./src/lib/field-placement.ts) and applied as a
CSS modifier - the arithmetic is kept out of the panel itself so it can be
tested without a browser. _Avoid_: "modal", "dialog", "tooltip" (it is
none of these).

## Confirm dialog

A **confirm dialog** is the app's modal counterpart to the field popover:
the centered panel, over a backdrop, that asks the user to approve
replacing the whole document before it happens. There are exactly two -
Import's "Replace current document?" and New document's "Start a new
document?" - and they share one shell,
[src/components/ConfirmDialog/ConfirmDialog.tsx](./src/components/ConfirmDialog/ConfirmDialog.tsx),
with each caller supplying only its own wording and its own go-ahead.

The term exists because this app now decides modality in opposite
directions in two places, and "dialog" alone no longer says which. Calling
something a confirm dialog is a commitment to all four of these, not a
description of how it looks:

- `aria-modal="true"` alongside `role="alertdialog"`.
- Everything outside it is `inert` while it is open, so neither Tab nor a
  screen reader in browse mode can reach the page behind it.
- Escape closes it from anywhere, not only while focus is inside it.
- Closing it returns focus to whatever opened it.

Notably **not** part of it: a hand-written Tab cycle between the dialog's
own controls. Focus containment is a consequence of the page behind being
inert, and a second mechanism enforcing the same rule is what made the
field popover's old `aria-modal="false"`-plus-Tab-trap contradict itself.

_Avoid_: "popover", "modal" on its own (this app has exactly one modal
pattern and one non-modal one - name which), "alert" (that is the toast).

## Canvas point

A **canvas point** is a position in the canvas's own design units - the
coordinate space `computeCanvasLayout` returns every `cardY`, `cx` and `cy`
in, and the space all drop resolution happens in (`CanvasPoint` in
[src/lib/canvas-layout.ts](./src/lib/canvas-layout.ts)).

It is deliberately not a client coordinate. The `<svg>` canvas is scaled by
its `viewBox`, scrolled inside its container, and zoomable independently of
the page, so the two spaces agree only by accident. Exactly one function
converts between them: `clientToCanvasPoint` in
[src/lib/pointer-drag.ts](./src/lib/pointer-drag.ts), composing the
element's `getScreenCTM()`. That call and the clipping check beside it
(`isInsideViewport`, which decides whether the point is somewhere the canvas
can actually be seen) are the only two DOM reads left in the drag path.

_Avoid_: calling a client pixel a canvas point, or vice versa. Name which
space a coordinate is in whenever both are in scope.

## Drop target / drop slot

A **drop target** is where a dragged token would land: a step id plus a
drop-before index within that step's tokens (`TokenDropTarget` in
[src/lib/canvas-layout.ts](./src/lib/canvas-layout.ts)). It is the whole
instruction a move needs - `moveToken` and `addTokenToStep` take exactly
this and nothing more.

A **drop slot** is a drop target plus the row of chips the pointer read as
being in (`TokenDropSlot`, which extends it). The row is redundant for
performing the move and essential for previewing it: on the wrapped desktop
layout, one drop index means two different places on screen at a row
boundary - index 6 on a 6-per-row step is both "after the last chip of row
0" and "before the first chip of row 1" - and the live insertion marker has
to pick one. The `dropTarget` signal
([src/state/drag.ts](./src/state/drag.ts)) holds a drop slot for that
reason; the narrower drop target stays what the document mutators consume.

`ChipSlot`, in the same module, is the step-less half of that pair: an
index and a row within *one* step's chips, which is what the resolver
produces before a step id is attached to it, and what
`insertionMarkerPosition` takes. It is deliberately not called a drop slot,
so that term keeps naming exactly one type.

Both are resolved by `resolveDropTarget` from a **canvas point** against the
same `CanvasLayout` the canvas was rendered from - never by hit-testing the
element under the pointer, and, since 2026-09-20, never by measuring a
rendered chip either. Two properties follow, and both are load-bearing. The
gap between two chips has no element of its own, so a hit-test has nothing
to report there, whereas a scan over positioned hit boxes always resolves
every point inside a step to some slot. And a chip's hit box is exactly
`CHIP_WIDTH` by `CHIP_HEIGHT` whatever that chip draws inside itself, so
attaching a time or a quantity to a token cannot shift the slot boundaries
around it - which measuring the rendered box did do. See
[the write-up](./docs/phase-3/progress/architecture-2026-09-20-layout-hit-testing.md)
for what that cost and how it was found.

_Avoid_: "drop zone" (nothing in this app highlights a region as droppable -
every point inside a step resolves to a specific slot), and using "drop
target" for the *step* being hovered (that is the step, which the step card
marks with its own `--drop-target` class).
