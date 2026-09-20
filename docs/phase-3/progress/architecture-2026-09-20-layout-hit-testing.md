# A drop is resolved against the layout, not against the DOM

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

**Date:** 2026-09-20
**Source:** [2026-09-20 architecture review](../audits/2026-09-20-architecture-review.html), candidate 1
**Spec:** [candidate 1 — layout hit testing](../plans/2026-09-20-candidate-1-layout-hit-testing-spec.md)
**Depends on:** [candidate 4](./architecture-2026-09-20-canvas-layout-signals.md), landed the same day
**Scope:** [`src/lib/canvas-layout.ts`](../../../src/lib/canvas-layout.ts),
[`src/lib/pointer-drag.ts`](../../../src/lib/pointer-drag.ts),
[`src/state/canvas.ts`](../../../src/state/canvas.ts),
[`src/state/drag.ts`](../../../src/state/drag.ts),
[`src/components/InstructionCanvas/InstructionCanvas.tsx`](../../../src/components/InstructionCanvas/InstructionCanvas.tsx),
[`StepCard.tsx`](../../../src/components/InstructionCanvas/StepCard.tsx),
[`TokenChip.tsx`](../../../src/components/InstructionCanvas/TokenChip.tsx),
[`TokenPicker.tsx`](../../../src/components/TokenPicker/TokenPicker.tsx),
[`src/styles/global.css`](../../../src/styles/global.css), plus the tests and
the Playwright driver.

Every decision in the spec was followed as written. The spec's own
instruction — *probe the claimed symptoms before implementing* — is what
made this work worth writing up, because both claims turned out to be
understated.

## What changed

`computeCanvasLayout` already knew every chip's exact position. The drag
path threw that away and re-derived it from rendered markup, twice per drag,
with `elementFromPoint` for the step and one `getBoundingClientRect()` per
chip for the slot.

| Was | Now |
| --- | --- |
| `resolveTokenDropTarget(clientX, clientY)` — hit-test + rect scan, untested | `resolveDropTarget(point, layout)` — pure, 14 tests |
| `resolveStepDropIndex(clientY, container)` — rect scan, untested | `resolveStepDropIndex(point, layout)` — pure, 4 tests |
| `resolveDropSlot(x, y, rects)` exported, tested against a synthetic fixture | `resolveDropSlot(point, rects)`, private to `canvas-layout.ts`, reached through `resolveDropTarget` |
| rects measured from each chip's rendered `<g>` | rects computed from the `StepLayout`'s own `chipPositions` |
| `data-step-id` / `data-step-index` / `data-token-index` were the contract | a typed function signature is the contract |
| the drop re-resolved the release point independently of the preview | the drop commits the slot the preview established |
| `beginPointerDrag` had no tests | 7 tests |

The DOM reads left in the entire drag path are two, both on elements
already in hand: `isInsideViewport`, which rejects a point the canvas is
clipped away from (see *The mobile margin strip, revisited*), and
`clientToCanvasPoint`, which is one
`getScreenCTM()` on the rendered `<svg>`, inverted, per resolution.

## The probes changed two of the audit's claims

### A timed chip did not have the same hit box, and it mattered more than "latent"

The audit called the row-extent drift something that "holds today". It does
not. `data-token-index` sat on the wrapping `<g>`, which also contains the
token-time label drawn *above* the chip, so a timed chip measured
`CHIP_TIME_HEADER_HEIGHT` taller and — sorting first in `groupIntoRows` —
pulled its whole row's span up with it.

The probe swept the gap between two rows with and without a duration on the
first chip of row 1:

```
gap band y where timed/untimed disagree: 7 [77..83]
  untimed -> {"index":1,"row":0}   timed -> {"index":7,"row":1}
```

A 7-unit band — about a quarter of the 30-unit inter-row gap — resolving a
whole row and six slots differently, decided by whether a token happened to
have a time attached. Rows themselves never merged or split, which is the
part that did hold.

### The preview/commit gap was not about render timing at all

The audit diagnosed the second resolution as "correct only because the
render it scheduled has not flushed yet". That is not the mechanism. The
mechanism is `beginPointerDrag`'s `requestAnimationFrame` coalescing, and
the probe reproduced two distinct divergences:

```
# released before the first frame painted
onMove calls (the preview): []
onDrop calls (the commit):  [[40,40,true]]

# travelled on after the last painted frame
onMove calls (the preview): [[40,40]]
onDrop calls (the commit):  [[400,400]]
```

So a fast flick committed a drop that nothing had ever previewed, and a
drag whose pointer moved after the last painted frame committed a point the
preview never saw. Neither has anything to do with when Preact renders.

This is why the fix is not only "resolve against the layout".
`beginPointerDrag` now flushes one final `onMove` synchronously at the
release point before calling `onDrop`, and both drop handlers commit the
slot that flush produced rather than resolving the coordinates a second
time. That makes "the preview and the commit are one resolution" literally
true, and it preserves today's behaviour for the sub-frame flick, which
would otherwise have become a no-op.

## The seam

`resolveDropTarget(point, layout)` is the whole resolution — step *and*
slot, which were two separate mechanisms before. It lives in
`canvas-layout.ts` beside the geometry it reads, and `resolveDropSlot` moved
in with it rather than being imported back out: that keeps the dependency
pointing the right way (the browser-facing module depends on the geometry
module, never the reverse) and leaves exactly one public entry point where
there were three.

`clientToCanvasPoint(svg, clientX, clientY)` stays in `pointer-drag.ts`,
deliberately as small as it can be, because it is the only part no unit test
will cover.

`state/canvas.ts` composes the two into `resolveLiveDropTarget` and
`resolveLiveStepDropIndex`, because only that module knows *which* canvas is
live.

## Reaching the canvas elements — the scope addition the audit missed

Candidate 4 made the *layout* reachable from outside `App`'s render. The CTM
conversion also needs the live editable canvas's *element*, and `TokenPicker`
has no ref to it. The audit's "Honest cost" paragraph names the layout
problem and not this one.

`liveCanvas` is a signal in `state/canvas.ts` holding a `{ svg, viewport }`
pair — the `<svg>` the CTM is read from, and the scrolling card that clips
it. It is registered by the editable `InstructionCanvas` instance on mount
and cleared on unmount — and only when the element still registered is its
own, so a remount cannot clear its successor's registration. The read-only
Preview and hidden export instances never register.

One signal holding both rather than two holding one each: the same effect in
the same component sets and clears them together, and a resolution is only
meaningful if both describe the same mount. Two signals could disagree for a
render; a pair cannot. (The `viewport` half arrived after the rest of this
change — see *The mobile margin strip, revisited* below.)

That is a real improvement over the attribute contract, not just plumbing.
Every mounted canvas used to publish the drag protocol; only the export
canvas's zero sizing kept it out of reach, which is a CSS rule holding up a
behaviour it says nothing about. Now the editable instance opts in by name.

The rejected alternative — `App` holding a ref and passing it to
`TokenPicker` — would have put `App` back in the middle of an interaction it
has nothing to do with, which is the coupling candidate 4 removed.

## Behaviour changes

Three, all small, all deliberate. The first two are the point of the change;
the third is a consequence worth stating rather than discovering later.

1. **A drop near a row boundary no longer depends on which chips have a
   duration.** This is the 7-unit band above. The marker and the drop now
   both read the computed geometry.
2. **A sub-frame flick previews before it commits.** Previously it committed
   with nothing previewed. The outcome is the same move; what changed is
   that the user sees the marker for one frame first.
3. **At the mobile breakpoint, the strip of page margin beside the canvas
   card briefly resolved into a step.** Accepted when this landed, then
   guarded — the next section is the whole story, and supersedes what this
   item originally said.

Everything the spec listed under *behaviour held fixed* is fixed: a point
outside every card still resolves to nothing with no nearest-step fallback;
every point inside a card still resolves to some row, including the header
band, with the far left still reading as insert-at-front; an own-slot drop
still falls back to the tap; a cancelled drag still performs no action; the
step-reorder drag still resolves on drop only.

## The mobile margin strip, revisited

Behaviour change 3 above was first written as accepted-not-guarded. That
call was reversed the same day, after measuring the strip instead of
estimating it. Both the measurement and the reasoning are kept here, because
the original reasoning was defensible and it was the numbers that beat it.

At a 420px viewport the geometry is:

| Box | Client x |
| --- | --- |
| Canvas card (`.instruction-canvas`) | 16 → 404 |
| Card's visible inner area | 17 → 403 |
| `<svg>`, at its 480px floor | 33 → **513** |

The `<svg>` runs 109px past the right edge of the card that clips it. A
client point anywhere in 404 → 502 converts, through a perfectly correct
CTM, to a canvas x inside the accepted band — and `resolveDropTarget` has no
way to know those pixels are not on screen. Only 404 → 420 is reachable,
because the viewport ends there, which is where the "about 16px" estimate
came from. The estimate was right about the size and wrong about the side
and the cause: this is not `.app__main` padding on both flanks, it is the
clipped right edge of an oversized canvas, and it exists only because the
card scrolls.

`isInsideViewport(viewport, clientX, clientY)` in `lib/pointer-drag.ts`
rejects it: the point must be inside the clipping element's *client* box.
Scroll position needs no handling — scrolling moves content inside that box,
never the box itself, which is why the same check holds mid-scroll.

The coupling objection that justified accepting it does not survive either.
Finding the clipping box does not need a second hit test or any guess about
markup: `InstructionCanvas` renders the card and the `<svg>` in the same
function, and now registers both in the same effect. The component that owns
the two elements declares both. Nothing else in the drag path learns a class
name, and the DOM read count per resolution goes from one to two — both on
elements already in hand, neither a search.

**`resolveLiveStepDropIndex` deliberately does not get this guard.** A step
reorder is a drag along a vertical list and has always been horizontally
indifferent; the DOM version it replaced took a `clientY` and nothing else.
Guarding it would be a new behaviour change rather than a repair of one, and
would break a reorder in exactly the direction a user is most likely to
overshoot.

## What was retired, and what was not

The audit's deletion test said the attribute contract and the three CSS
rules "all vanish". Too strong in two places, both checked against the code
rather than assumed:

- **`data-step-index` stays.** `driver.mjs` locates step groups by it and
  `SKILL.md` documents it. It stops being the drag contract and remains the
  driver contract; `SKILL.md` now says exactly that.
- **The CSS rules stay, with comments that say what they do.**
  `.drag-ghost`'s `pointer-events: none` is wanted on its own merits — the
  ghost is centered on the pointer, so without it the ghost would have been
  the answer to every hit-test, and that dependency was written down
  nowhere. The export canvas's zero sizing is about layout, scroll and
  visibility. Both comments now carry the sentence that used to be missing:
  what they *stopped* holding up.
- **`data-token-index` is gone.** Nothing read it but the rect scan.
- **The defensive clamp in `StepCard` is gone.**
  `TokenDropTarget.index`'s documented `[0, tokens.length]` range now holds
  by construction, and a test holds it up rather than a `Math.min`.

`StepCard` also no longer takes an `svgRef` prop at all, since resolving a
reorder no longer needs a container element.

## Verification

- `npx tsc -b`, `npx eslint .`, `npm run build` — all clean.
- `npx vitest run` — **214 passing / 14 files** (was 199 / 14) when this
  landed. Net +15: ten synthetic-fixture `resolveDropSlot` tests deleted;
  14 for `resolveDropTarget`, 4 for `resolveStepDropIndex` and 7 for
  `beginPointerDrag` added. The tree runs **217** today - the extra three
  are the `moveToken` unknown-step guards, found while reviewing this drop
  path and fixed separately (see
  [fixed-issues/move-token-unknown-destination-destroyed-token.md](../../fixed-issues/move-token-unknown-destination-destroyed-token.md)).
- The drop-resolution tests are driven by real `computeCanvasLayout` output
  and derive every point they probe from that same result. That is the
  specific fix for the drift already present in the fixture they replace:
  there is now no way to ask where a chip is except to ask the layout, which
  is what the resolver does.
- Mutation-checked, eight mutations:

  | Mutation | Result |
  | --- | --- |
  | `resolveDropTarget` drops its x bounds | 1 test failed |
  | `chipRects` forgets `tokensOffsetX` | 4 tests failed |
  | a timed chip measures taller, as the DOM scan did | 1 test failed |
  | chip rects shifted uniformly by one time band | 1 test failed |
  | `resolveStepDropIndex` compares the card top, not its midpoint | 2 tests failed |
  | no final `onMove` at the release point | 2 tests failed |
  | the viewport guard removed from `resolveLiveDropTarget` | driver check failed |
  | the guard measures `scrollWidth`, not the visible `clientWidth` | driver check failed |

  The last two have no unit test to fail — they are DOM geometry, and the
  driver is the only place they can be checked. Neither mutation disturbed
  `DROP_LANDS_CORRECTLY_AT_MOBILE_WIDTH`, which is the point: the guard
  rejects what it should and nothing more.

  The fourth one is the useful entry: **it survived the first run.** A
  uniform shift of every chip rect leaves every within-row and between-row
  comparison intact, so nothing caught a resolver that disagreed with the
  render by a constant offset. The test that catches it now — the gap
  between two rows splitting down its own middle — exists because the
  mutation check found the hole, not because the suite was designed well.

- **The driver covers what no unit test can.** `clientToCanvasPoint` needs a
  real element with a real matrix and there is no DOM test environment
  ([ADR 0003](../../adr/0003-no-component-test-environment.md)). The audit
  was explicit that `getScreenCTM()` accounting for transforms and scroll
  "is a claim the driver has to check, not a free property", so four checks
  were added. The first three assert a drop lands in a *specific slot* — the
  left half of a specific chip — rather than merely that something moved:

  ```
  DROP_LANDS_CORRECTLY_WHEN_SCROLLED=true
  DROP_LANDS_CORRECTLY_AT_MOBILE_WIDTH=true (canvas overflows its container: true)
  DROP_LANDS_CORRECTLY_WHEN_ZOOMED=true
  MOBILE_MARGIN_DROP_IS_IGNORED=true (point beside the card at clientX=409
    converts to canvas x=626 of 748, inside the band: true)
  ```

  The mobile line reports the overflow because the check is worthless
  without it: it is only a real test of the matrix if the SVG is rendering
  at a scale its viewBox does not imply. The fourth line reports the
  converted coordinate for the same reason. "Nothing moved" passes just as
  happily when the point converted to somewhere off the canvas anyway, which
  is the boring way a guard looks like it works; printing that the point
  lands at canvas x 626 of 748 — well inside the band `resolveDropTarget`
  accepts — is what makes the assertion mean the guard did the work.

- The full driver run is green: 66 `=true`, no failures, 0 console errors, 0
  accessibility violations at all five states. Every pre-existing drag
  assertion still passes unchanged — the insertion marker mid-drag, the
  drop-side-decides-before-or-after check, the gap-lands-at-that-boundary
  check, the wobbly-press fallback, both forward-drag regression tests, and
  step reorder.

## Not touched

- **`computeCanvasLayout` itself** — unchanged. This work moved *who reads
  its output*, not what it produces.
- **`insertionMarkerPosition`'s geometry** — the spec suggested it could
  stop hand-copying two geometry primitives. It cannot usefully: it reads
  finished `ChipPosition` values and does not have the `rowStartYs` the
  primitives need. Left alone. (Its *signature* did change, for an unrelated
  reason - see the follow-up below.)
- **A token id in `ChipPosition`** — proposed by the external review,
  declined in the spec and still declined. A drop resolves to an insertion
  index, which is positional by nature.
- **An insertion marker for the step-reorder drag** — still a gap, now
  cheap to close, still out of scope.
- **The keyboard token-move path** — the leverage this unlocks. `ChipSlot`
  is now a value any caller can produce from a layout, with no pointer
  involved, which is exactly what that path needed and did not have.

## Follow-up: a code review of this change, same day

A two-axis review (standards and spec) over the whole 2026-09-20 arc raised
four things about this change specifically. All four were cleared in place;
none was behavioural, and the test suite was unchanged at 217 by all of
them.

- **`DropSlot` collided with a glossary term.** [CONTEXT.md](../../../CONTEXT.md)
  reserves *drop slot* for a drop target plus the row - a step id included -
  and this module exported a second, step-less type under that name.
  Renamed `ChipSlot`, with `TokenDropSlot` now written as
  `TokenDropTarget & ChipSlot` so the relationship between the two is in the
  type rather than in prose.
- **`insertionMarkerPosition` took a slot as two loose arguments.**
  `(dropIndex, chipPositions, chipsPerRow, hoveredRow)` split a pair that
  already had a type, in the module that declares it, and every call site
  destructured a slot to produce it. It now takes the `ChipSlot`. That also
  earns the export the rename left behind: `ChipSlot` is public because this
  signature is.
- **`resolveDropSlot` took `(x, y)` rather than a point.**
  `resolveStepDropIndex` one function below already argued the opposite and
  was right - *"it takes the whole point anyway so both drag resolutions read
  the same currency"*. It now takes a `CanvasPoint` too.
- **The spec's "keeps the existing tests meaningful" did not survive.** The
  spec said `resolveDropSlot` was *"not rewritten … handed the rects
  unchanged. This keeps the existing tests meaningful."* Its body was indeed
  not rewritten, but moving it in and making it private deleted its ten
  tests, and this write-up disclosed the move without ever saying that half
  of the claim had lapsed. It is said here instead. The spec's Testing
  Decisions section does sanction replacing the synthetic fixture, so this
  was a tension rather than a contradiction - but the undisclosed half is
  exactly the kind of thing a later reader would take on trust.
