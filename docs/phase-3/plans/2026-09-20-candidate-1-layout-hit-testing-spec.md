# Spec — Candidate 1: resolve a drop against the layout, not against the DOM

> 🗄️ **Doc status: HISTORICAL — superseded (2026-09-20).** The work this
> spec scoped shipped the same day the spec was written, so it is frozen
> here as the plan of record rather than maintained. See
> [../progress/architecture-2026-09-20-layout-hit-testing.md](../progress/architecture-2026-09-20-layout-hit-testing.md)
> for what actually shipped - including the two claims below that probing
> sharpened, and the one place the implementation departed from this plan.
> See [../../milestones.md](../../milestones.md#documentation-status-conventions)
> for what CURRENT/HISTORICAL mean project-wide.

**Date:** 2026-09-20
**Source:** [2026-09-20 architecture review](../audits/2026-09-20-architecture-review.html),
candidate 1 (graded *Strong*, *in-process*, **top recommendation**)
**Depends on:** candidate 4 —
[the canvas layout moved onto computed signals](../progress/architecture-2026-09-20-canvas-layout-signals.md),
landed 2026-09-20. This is the work candidate 4 existed to unblock.
**Status:** **implemented 2026-09-20** — see [the write-up](../progress/architecture-2026-09-20-layout-hit-testing.md), which records the two claims below that probing sharpened

An external architecture review (Step 6 of an "Architectural Modernization
Plan", 2026-09-20) independently reached the same conclusion. Two of its
supporting points are folded in below where they are accurate; the rest of
that review is out of scope, and its companion proposal — splitting
`state/document.ts` — was **declined**, because the 2026-09-18 audit had
already weighed and rejected it and its stated revisit trigger ("a second
document session needs a different history policy") has not fired.

---

## Problem Statement

`computeCanvasLayout` already knows every chip's exact position. The drag
path throws that away and re-derives it from rendered markup — twice per
drag — by hit-testing the DOM with `elementFromPoint` and then measuring one
bounding rect per chip.

**This is a structural change, not a bug fix, and the spec says so up
front.** Candidate 4 was graded the same way, and its write-up withdrew the
audit's claimed performance win rather than repeat it. The honest position
here is the same: there is no reproducing user-visible defect today. The
costs are latent, and they are real:

1. **The preview and the commit are two independent resolutions.** The
   insertion marker resolves on every `pointermove`, through
   `beginPointerDrag`'s rAF coalescing. The move resolves again on
   `pointerup`, from raw coordinates — and *after* the teardown that clears
   the drop target and the dragging flag has already run. That second read is
   correct only because the render it scheduled has not flushed yet. Nothing
   states that rule, nothing tests it, and "the marker said here, the chip
   landed there" is the entire bug class living in the gap.

2. **A chip's hit box is not its chip.** The `data-token-index` attribute
   sits on the wrapping `<g>`, whose box also contains the token-time label
   drawn above the chip. A timed chip's client rect therefore starts about 14
   units higher than an untimed sibling's, and `groupIntoRows` measures a
   row's whole vertical span against whichever chip sorted first. Rows are
   about 98 units apart, so this holds today — but whether it holds depends
   on which chip happens to have a duration attached.

3. **The interface between the canvas and the drag module is markup and
   CSS.** `data-step-index`, `data-step-id` and `data-token-index` are the
   whole contract, and nothing type-checks them: renaming an attribute in
   `TokenChip` breaks drag silently. Three CSS rules are load-bearing on it
   and say so nowhere — `.drag-ghost { pointer-events: none }` (its comment
   explains text selection, not hit-testing), the export canvas's `width: 0`,
   and the `@media print` block restoring it to `width: auto`. Every mounted
   canvas publishes the drag protocol unconditionally; only zero sizing keeps
   two of the three unreachable.

4. **The untested half is where the bugs were.** `resolveDropSlot` and
   `resolveTokenPointerOutcome` are pure and tested. `resolveTokenDropTarget`
   and `resolveStepDropIndex` — the two that read the DOM — have no unit
   tests at all. All three defects fixed in `c68c80d` lived in that untested
   caller.

5. **It blocks work.** A keyboard path for moving a token has no slot model
   to target, because slots exist only as a by-product of pointer events.

## Solution

Convert the pointer's client point into canvas units **once**, via the canvas
element's own `getScreenCTM()`. Resolve both the step and the slot purely
against the `CanvasLayout` the canvas was rendered from. Commit the slot the
preview already established.

From a person's point of view nothing should change: the same drags do the
same things, the marker still previews the same slot, and a drop outside any
step still does nothing. What changes is that the marker and the drop can no
longer disagree, and that the whole resolution becomes testable without a
browser.

---

## User Stories

1. As someone building an instruction set, I want a token I drag to land in
   the exact slot the insertion marker previewed, so that the canvas never
   surprises me at the moment I release.
2. As someone building an instruction set, I want dropping a token in the gap
   between two chips to put it at that boundary, so that the most natural way
   to say "put it here" works.
3. As someone building an instruction set, I want a chip with a duration
   attached to behave in a drag exactly like a chip without one, so that
   adding a time to a token does not quietly change where drops land near it.
4. As someone building an instruction set, I want dropping a token outside
   any step to do nothing at all, so that a mis-aimed drag never moves
   something unexpectedly.
5. As someone building an instruction set, I want dropping a token back onto
   its own slot to select it rather than do nothing, so that a wobbly tap is
   never swallowed.
6. As someone building an instruction set, I want dragging a token from the
   picker onto a step to land in the previewed slot, so that both drag
   sources behave identically.
7. As someone building an instruction set, I want the step-reorder handle to
   drop a step where I aimed it, so that reordering is as predictable as
   moving tokens.
8. As someone building an instruction set on a phone, I want drags to resolve
   correctly at the mobile single-row layout, so that the breakpoint does not
   change where things land.
9. As someone building an instruction set, I want drags to resolve correctly
   after scrolling the page, so that a long document behaves like a short one.
10. As someone building an instruction set, I want drags to resolve correctly
    at any browser zoom level, so that zooming in to see small icons does not
    break dropping them.
11. As someone building an instruction set, I want the drag ghost under my
    pointer never to interfere with where the drop registers, so that the
    thing showing me what I am dragging cannot change where it goes.
12. As someone building an instruction set, I want a drag the browser cancels
    to leave the document untouched, so that a system gesture never commits a
    half-finished move.
13. As someone using the keyboard, I want the eventual keyboard token-move to
    target the same slots a pointer drag does, so that the two input methods
    agree about where a token can go.
14. As a maintainer, I want one module to own chip geometry, so that the same
    numbers are not derived two ways that can drift apart.
15. As a maintainer, I want the contract between the canvas and the drag
    module to be a typed function signature rather than data attributes and
    CSS, so that renaming something breaks the build instead of breaking drag
    silently.
16. As a maintainer, I want the whole drop resolution covered by unit tests,
    so that the part where every past drag defect lived is no longer the part
    with no tests.
17. As a maintainer, I want the drop-resolution tests driven by real
    `computeCanvasLayout` output rather than hand-built fixtures, so that the
    tested model cannot drift from the real input the way it already has.
18. As a maintainer, I want the preview and the commit to be one resolution,
    so that no future change to render timing can make them disagree.
19. As a maintainer, I want `TokenDropTarget.index`'s documented invariant
    guaranteed by construction, so that the defensive clamp at its consumer
    can be deleted rather than left as an unanswerable question.
20. As a maintainer, I want the CSS rules currently load-bearing on
    hit-testing to either stop being load-bearing or say plainly what they
    do, so that a later cleanup cannot remove one and break drag.
21. As a maintainer, I want the browser driver's own attribute hooks left
    intact, so that retiring the drag protocol does not silently break the
    Playwright coverage that stands in for component tests.

---

## Implementation Decisions

### The seam: one pure resolver, one thin adapter

Confirmed with the user before writing this spec. Two new functions replace
two untested DOM readers:

- **`resolveDropTarget(point, layout)`** — pure. Takes a point in canvas
  design units and the `CanvasLayout` the canvas was rendered from; returns
  the drop slot, or nothing when the point is not over a step. This is the
  whole resolution: step *and* slot, which today are two separate mechanisms.
- **`clientToCanvasPoint(svg, clientX, clientY)`** — the only DOM read, one
  per call, on the canvas element itself. Returns nothing when the element
  has no current transform matrix (detached, or not rendered).

`resolveDropSlot` and `resolveTokenPointerOutcome` are **not** rewritten.
Both are already pure and tested; `resolveDropTarget` builds chip rects from
the layout and hands them to the existing `resolveDropSlot` unchanged. Only
the *source* of the rects changes, from measured DOM to computed layout. This
keeps the existing tests meaningful and confines the new risk to rect
construction.

### Where it lives

`resolveDropTarget` goes in the canvas layout module, beside the geometry it
reads. That module's own comment already states the geometry primitives are
private so nobody re-derives them — this makes that true, and lets
`insertionMarkerPosition` stop hand-copying two of them.

`clientToCanvasPoint` goes in the pointer-drag module, where the
browser-facing half of dragging already lives. The split is deliberate: the
layout module stays free of DOM, and the one impure function stays as small
as it can be, because it is the only part no unit test will cover.

### Coordinates

A chip's position in canvas units is fully derivable from the layout: the
step card is offset by the canvas padding and the step's own card top, the
token group by the step's token-centering offset, and the chip by its own
position within that group. Chip extents come from the layout module's chip
width and height constants.

This is what fixes problem 2 above. Rects built from the layout are exactly
one chip tall by construction, so a chip with a duration no longer has a
taller hit box than one without.

### Reaching the canvas element from the token picker

**This is a scope addition the audit's "Honest cost" paragraph did not spell
out.** Candidate 4 made the *layout* reachable from outside `App`'s render.
The CTM conversion also needs the live editable canvas's *SVG element*, and
the token picker has no ref to it.

Decision: the canvas state module gains a signal holding the live editable
canvas's element, written by the editable canvas instance when it mounts and
cleared when it unmounts. Both drag sources then read the layout and the
element from the same module and need nothing from `App`.

The alternative — `App` holding a ref and passing it to the token picker as a
prop — was considered and rejected: it makes `App` a conduit again, which is
the coupling candidate 4 removed, and it would be the only prop the token
picker takes. The read-only and hidden export canvases must never register
themselves; only the editable instance does.

### Behaviour held fixed

Current behaviours, some of them hard-won, that the change must preserve
rather than quietly improve:

- A point outside every step card resolves to nothing, and the drop does
  nothing. It does not fall back to a nearest step.
- Every point *inside* a step resolves to some row, including the header band
  and the padding below the last row. There is deliberately no "inside the
  step but outside the chips" case. The accepted consequence stays accepted:
  the far left of the header band clamps to row 0 and reads as *insert at
  front*, not append.
- Dropping a token onto either drop-before position adjacent to its own slot
  is treated as the tap it was meant to be, not a no-op move.
- A cancelled drag tears down transient state and performs no action.
- The step-reorder drag keeps resolving on drop only. It has no insertion
  marker today; adding one is out of scope, though this makes it cheap.

### What gets retired, and what does not

The audit's deletion test says the attribute contract and the three CSS rules
"all vanish". That is too strong in two places, both verified:

- **`data-step-index` stays.** The Playwright driver locates step groups by
  it, and the skill documentation names it as the disambiguating attribute.
  It stops being the *drag* contract; it remains the *driver* contract.
- **The CSS rules stay, with corrected comments.** `.drag-ghost`'s
  `pointer-events: none` is still wanted on its own merits; the export
  canvas's zero sizing is about layout, scroll and visibility, not only
  hit-testing. The outcome is not deletion — it is that they stop being
  load-bearing on an undeclared contract, and their comments say what they
  actually do.

`data-token-index` has no other reader and can go once the rect scan does.
Each remaining attribute is checked for a reader before removal, not removed
on the strength of this spec.

`resolveTokenDropTarget` is deleted. `resolveStepDropIndex` keeps its name
and job but takes a point and a layout instead of a client Y and a container
element.

### The defensive clamp

The step card currently clamps the hovered slot index to the step's token
count, while the type it clamps documents that index as already within range.
After this change the resolver reads the same layout the render used, so the
invariant holds by construction and the clamp is removed. If implementation
finds a case where it does not hold, that is a finding to write up, not a
clamp to keep.

---

## Testing Decisions

A good test here asserts what a drop *resolves to*, given a point and a
document — never how the resolver walked the layout to get there. Row
grouping, midpoint comparison and rect construction are all implementation;
the slot is the behaviour.

**Tested, at the new seam:**

- `resolveDropTarget` — the bulk of the new coverage. Points inside and
  outside step cards; the header band and the padding below the last row; the
  gap between two chips; both sides of a chip's midpoint; the row boundary
  where one index is both "end of this row" and "start of the next"; an empty
  step; the mobile single-row layout; a step containing a timed chip beside
  an untimed one.
- `resolveStepDropIndex` in its new pure form — currently has no tests at all.

**Driven by real layouts, not fixtures.** These tests build a document, run
`computeCanvasLayout`, and resolve points against its output. This is the
specific fix for the drift already present in the existing fixture, and it is
why the rect-construction step cannot silently disagree with the render.

**Not unit tested:** `clientToCanvasPoint`. It needs a real element with a
real transform matrix, and this project has no DOM test environment by
[ADR 0003](../../adr/0003-no-component-test-environment.md) — whose rule is
exactly what this spec follows: *where a component holds logic worth testing,
the logic moves out rather than the test environment moving in.* Coordinate
conversion is the browser's job and belongs to the driver.

**The driver must verify what no unit test can.** The audit is explicit that
`getScreenCTM()` accounting for transforms and scroll "is a claim the driver
has to check, not a free property" — client rects survive CSS transforms for
free and a CTM conversion has to be shown to. At minimum: a drag after
scrolling a long document, a drag at the mobile breakpoint, and a drag at
non-default browser zoom.

**Prior art.** `canvas-layout.test.ts` already builds real documents and
asserts against real `computeCanvasLayout` output — that is the model to
follow. `pointer-drag.test.ts` shows the pure-resolver test shape, and its
synthetic fixture is the thing being replaced. `canvas.test.ts` shows how to
drive the module-level signals with a `beforeEach` reset.

**Mutation-check before claiming the tests hold**, and publish the table.
Candidates 2, 3 and 4 each did this; match them.

---

## Out of Scope

- **Splitting `state/document.ts`.** Declined — see the header.
- **An insertion marker for the step-reorder drag.** A known gap; this makes
  it cheap but does not do it.
- **The keyboard token-move path.** The leverage this unlocks, not this work.
- **`RenderScene`, a layout strategy registry, a command pipeline, or a
  persistence repository.** All from the same external review; none belong
  here.
- **Adding a token id to the chip position type.** Proposed by the external
  review. Not adopted: a drop resolves to an *insertion index*, which is
  positional by nature, and identity would be the wrong model for it. Revisit
  if the keyboard path or per-connection metadata needs it.
- **The full-canvas re-render on any edit.** A separate known issue with its
  own recorded reasoning; untouched.
- **Changing what a drag does.** Every behaviour listed under "Behaviour held
  fixed" is preserved, not improved.

---

## Further Notes

- **Verify the claimed symptom with a throwaway probe before implementing.**
  Standing project practice: candidate 2's claimed symptom did not reproduce,
  candidate 3's did and was wider than stated, candidate 4's claimed win was
  false and a naive port would have made performance *worse*. The claims most
  worth probing here are the timed-chip row extent and the preview/commit
  double resolution — both are argued above as *latent*, and if either turns
  out to reproduce, that is a finding for the write-up, not a footnote.
- **If behaviour changes anywhere, say so plainly.** This is expected to be
  behaviour-preserving. If it is not, that is the headline.
- Deliverables follow the three sibling candidates: clean `tsc`, `eslint` and
  `build`; a vitest run with the new count reported against the current
  **199 passing / 14 files**; a progress doc in `docs/phase-3/progress/`; and
  an annotation of the audit at its candidate 1 article.
- **Commit only when the user asks.** Candidate 4's eight files are currently
  uncommitted in the working tree — do not sweep them into a candidate 1
  commit.
- Never add a `Co-Authored-By: Claude` line, or any other Claude attribution,
  to a commit message or pull request description in this project.
