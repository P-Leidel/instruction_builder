# Architecture: 2026-09-16 review remediation

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-16

A `/mattpocock-skills:improve-codebase-architecture` pass targeted what grew
since the 2026-09-15 canvas deepening: the step-management-onto-canvas and
"Add to token"-into-Token-details reworks both landed by growing existing
files rather than adding new modules, so this pass re-examined
[InstructionCanvas.tsx](../../../src/components/InstructionCanvas/InstructionCanvas.tsx)
(626 lines by then), [lib/canvas-layout.ts](../../../src/lib/canvas-layout.ts),
[lib/pointer-drag.ts](../../../src/lib/pointer-drag.ts), and
[state/document.ts](../../../src/state/document.ts). A sub-agent walked the
code (not just the file lengths) and applied the deletion test throughout;
four candidates came out, written up with before/after diagrams at
[docs/phase-3/audits/2026-09-16-canvas-and-state-architecture-review.html](../audits/2026-09-16-canvas-and-state-architecture-review.html).
Two were picked - #1 (the report's own top recommendation) and #3:

1. **Strong** - name the two-stage select/drag decision, currently
   hand-rolled inline in two of `InstructionCanvas.tsx`'s `onDrop` closures.
   This is candidate #3 from the 2026-09-15 canvas-deepening review, named
   and deliberately deferred there - the step-management rework has since
   added a second, independently-written copy of the same shape, so the
   friction it flagged had grown rather than shrunk.
2. Worth exploring - give `pointer-drag.ts`'s hit-test functions
   (`resolveStepDropIndex`, `resolveTokenDropTarget`) their own Vitest
   coverage instead of relying solely on the Playwright driver. Deferred -
   real but not urgent, see "What's next".
3. **Worth exploring, picked** - `state/document.ts`'s
   `attachToSelectedToken` no longer earns its keep: both of its production
   callers (`TokenDetails.tsx`'s `QuantityRow`/`WarningRow`) already hold
   `step`/`token` as props, same as every other mutator call in that file.
4. Speculative - reunite `pointer-drag.ts`'s drag-move perf comment with
   the equality check that completes it, currently split into
   `InstructionCanvas.tsx`'s render loop. Deferred, see "What's next".

A `/mattpocock-skills:grilling` session settled the shape of #1 before any
code changed.

## What shipped

- **`resolveTokenPointerOutcome`, a new function in `lib/pointer-drag.ts`**
  (co-located with `resolveTokenDropTarget`, which supplies its `target`
  input - the grilling session's call, over a new standalone module, since
  the function's own interface stays data-only and doesn't pull
  `state/document.ts` concepts into `pointer-drag.ts`). It turns the raw
  facts of a token pointer interaction - did it drag, was the step already
  selected, and (if it dragged) what's under the pointer now - into one of
  four outcomes: `{ kind: "selectStep" }`, `{ kind: "selectToken" }`,
  `{ kind: "move", target }`, or `{ kind: "none" }` (a drag that ended over
  no valid target). It returns a plain descriptor rather than calling a
  mutator itself, so `InstructionCanvas.tsx`'s `onDrop` closure shrank to
  resolving the outcome and switching on `.kind` - the two-stage
  select-vs-drag *decision* now lives in exactly one place, testable with
  plain values instead of simulated pointer events.
- **The step-drag handler's `onDrop` was deliberately left inline.** The
  grilling session applied the deletion test to a hypothetical
  `resolveStepDragOutcome` and it didn't hold up: the whole decision is one
  `if (wasDrag) reorderSteps(fromIndex, dropIndex)`, and wrapping a
  one-condition branch in a named function wouldn't add real depth, just a
  name to look up. Candidate #1 narrowed to the token-drag decision alone,
  which is where the actual three-way policy and the duplication live.
- **`attachToSelectedToken`/`attachToSelectedTokenCore` are deleted.**
  `TokenDetails.tsx`'s `QuantityRow.save()` and `WarningRow`'s preset
  `onClick` now call `attachToToken(step.id, token.id, kind, attachment)`
  directly, the same convention every other mutator call in that file
  already used. Deleting the wrapper outright (rather than keeping it
  unused) was a deliberate call in the grilling session: one adapter with
  no real caller is a hypothetical seam, not a real one. Its own
  now-orphaned "no-op when nothing is selected" test in `document.test.ts`
  was deleted with it.

## Verification

- `npm run lint` / `typecheck` / `test` (131 tests, up from 128 - 4 new
  `resolveTokenPointerOutcome` cases in `pointer-drag.test.ts` covering all
  four outcomes, minus the 1 orphaned `attachToSelectedToken` test removed)
  / `build` all pass cleanly.

## What's next

See [README.md](./README.md) for Phase 3's overall status. Candidates #2
(unit-testing `pointer-drag.ts`'s hit-test functions directly) and #4
(reuniting the drag-move perf comment with its completing equality check)
remain unexplored - both real, neither urgent enough to have been picked
this pass.
