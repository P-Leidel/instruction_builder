# Task 24 — Optimize Performance

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 2 Progress Log](./README.md).

The plan's scope: "Keep interactions smooth and fast." Run audit-first, per
the pattern already established for tasks 21/22 - find real friction before
changing anything, rather than applying generic performance advice to an
app that might already be fine.

## Audit

Two parts: a production build to check the load-time success criterion
directly, and a source-grounded survey (via a sub-agent, since this is a
"read a lot, find real hot spots" task) of runtime hot spots - re-render
scope, signal subscription granularity, and the drag-and-drop pointer-event
path, the three places most likely to matter in an SVG-canvas app built on
`@preact/signals`.

**Load time:** `npm run build` produces 66.86 kB JS (21.70 kB gzip) and
16.43 kB CSS (3.20 kB gzip) - already trivially under the plan's "under 2
seconds on a mid-range mobile device on a 4G connection" criterion (see
[project-plan.md](../../project-plan.md#success-criteria)); a payload this
size transfers in a fraction of a second even on a slow 4G connection.
**No action needed or taken here** - this project's stack choices (Preact
over React, signals over a separate store, no icon/font CDN - see
[project-plan.md](../../project-plan.md#technology-stack)) already bought
this outcome before task 24 started.

**Runtime hot spots**, checked against the actual source, not
speculatively:

1. **`computeCanvasLayout` memoization** (`InstructionCanvas.tsx`) - wrapped
   in `useMemo`, but its only dependency (`document.value.steps`) is a
   fresh array on every edit by design (every mutator in `state/
   document.ts` returns a new immutable snapshot, which is what makes
   undo/redo a plain snapshot stack rather than a diff log - see that
   file's own comment on `past`/`future`). So the memo recomputes on every
   edit regardless; it only guards against extra recomputation from
   unrelated re-renders, of which there are few. Real, but not fixable
   without changing the undo/redo model itself, and the computation is
   cheap arithmetic at this app's actual scale (a handful of steps, a
   couple dozen tokens) - left as is.
2. **Whole-document signal subscription** (`InstructionCanvas.tsx`,
   `StepList.tsx`) - both read `document.value.steps` directly in the
   component body, so any edit anywhere in the document re-renders the
   *entire* canvas/step list, not just the step that changed - the one
   place this app's signals-based "fine-grained reactivity" (see
   [project-plan.md](../../project-plan.md#technology-stack)) isn't
   actually exercised. Investigated further before deciding what to do -
   see "Investigated, not fixed" below.
3. **Drag-and-drop pointer-event path** (`lib/pointer-drag.ts`,
   `InstructionCanvas.tsx`'s token `onPointerDown`) - `beginPointerDrag`
   called `handlers.onMove` synchronously on every raw `pointermove`
   event, unthrottled; `InstructionCanvas`'s `onMove` handler did an
   `elementFromPoint` DOM hit-test and wrote a **new** `dropTarget` object
   on every one of those calls, even while hovering the same slot - and
   since `InstructionCanvas` reads `dropTarget.value` directly in its
   render body, every such write re-rendered the whole canvas. The most
   plausible place actual jank would show up first, on a high-polling-rate
   input device, even though it wasn't visibly janky today. **Fixed - see
   below.**
4. Nothing else significant turned up: no O(n²) shapes in `document.ts`'s
   mutators, no defeated memoization elsewhere (there's exactly one
   `useMemo`/`memo` in the whole codebase, so nothing to defeat), icon
   markup is resolved once at module load, not per render.

## What was built

**Finding 3, fixed in the shared pointer tracker so every caller benefits
(`TokenPicker`, `InstructionCanvas`, `StepList` all drag through it):**

- `beginPointerDrag` (`lib/pointer-drag.ts`) now batches `onMove` calls to
  at most one per animation frame via `requestAnimationFrame`, keeping only
  the latest pointer position between frames rather than firing once per
  raw `pointermove`. The visible result is identical - a display only ever
  paints one position per frame regardless - while the actual hit-test/
  signal-write work drops to the screen's refresh rate instead of the
  input device's event rate. `moved`/threshold detection still happens
  synchronously on the raw events (so drag-vs-click detection isn't
  delayed by a frame), only the `onMove` callback itself is batched;
  `cleanup()` cancels any pending frame so a stale batched call can't fire
  after `pointerup`/`pointercancel`.
- `InstructionCanvas.tsx`'s token drag `onMove` now compares the newly
  resolved drop target against the current `dropTarget.value` by
  `stepId`/`index` before writing, and skips the write - and the
  re-render it would otherwise trigger - when the pointer is still over
  the same slot it was already over.

**Finding 2, investigated further, not fixed - see below.**

## Investigated, not fixed: whole-document signal subscription

Splitting `InstructionCanvas`/`StepList` into per-step components that read
`selectedStepId`/`selectedTokenId`/`dropTarget` directly (rather than the
parent reading them once for every step in one `.map()`) looked like the
natural fix - and would be, on its own. But `computeCanvasLayout`
(`lib/canvas-layout.ts`) doesn't produce per-step layout objects that stay
reference-stable across an edit: each step's `cardY` depends on the height
of every step above it, so touching *any* step's height (a new token, a
wrapped title) shifts the computed layout object for every step after it,
even ones whose own content didn't change. A per-step component split would
still re-render every step below the edited one on every edit, just via a
different mechanism - not the real fix its face value suggested, and no
cheaper than what's here today.

A real fix would mean reworking `computeCanvasLayout` for incremental
per-step stability (e.g. only recomputing `cardY` for steps at or after an
edit's index, and diffing layout objects instead of always returning fresh
ones) - a genuinely larger change to an already-tested layout module, for a
re-render cost the audit itself found small at this app's actual scale
(dozens of DOM nodes; Preact's diffing is cheap at that size even without
memoization). Raised with the user before doing it; **deferred as
accepted** rather than built - see
[known-issues.md](../../known-issues.md#full-canvasstep-list-re-render-on-any-edit-anywhere-in-the-document)
for the tracked entry, with a note on what would make it worth revisiting.

## Verification

`npm run lint`, `npm run typecheck`, `npm test` (113 tests, unchanged - the
pointer-drag/canvas changes aren't in Vitest's scope; see
[phase-2/plans/task-20-automated-testing-plan.md](../plans/task-20-automated-testing-plan.md)),
and `npm run build` all pass; the production bundle grew by 0.27 kB JS
(0.09 kB gzip) - negligible, still comfortably under the load-time
criterion. A full Playwright driver run against the dev server passed all
39 checks with `CONSOLE_ERRORS_COUNT=0`, including every drag-specific
check (`DRAG_ADDED_TOKEN_VIA_PICKER`, `INSERTION_MARKER_VISIBLE_MID_DRAG`,
`TOKEN_MOVED_BETWEEN_STEPS_VIA_DRAG`,
`FORWARD_TOKEN_DRAG_LANDS_AT_DROP_POINT`, `STEPS_REORDERED_VIA_DRAG`,
`FORWARD_STEP_DRAG_LANDS_AT_DROP_POINT`) - confirming the rAF batching and
drop-target diffing are behavior-preserving, not just non-crashing.

## Files touched

- `src/lib/pointer-drag.ts` - `beginPointerDrag`'s `onMove` batched via
  `requestAnimationFrame`.
- `src/components/InstructionCanvas/InstructionCanvas.tsx` - token drag's
  `onMove` skips redundant `dropTarget` writes when the hovered slot is
  unchanged.
- `docs/known-issues.md` - new entry for the investigated-not-fixed
  whole-document re-render finding.
