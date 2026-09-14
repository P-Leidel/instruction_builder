# Forward drag-reorder overshot by one position (tokens and steps)

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** dragging a token forward within a step's row, or a step
  forward in the step list, landed the dragged item one slot past where it
  was actually dropped. Dragging *backward* (toward the front of the list)
  always worked correctly, which is why the project's own Playwright driver
  never caught it - its only reorder checks dragged backward.
- **Root cause:** both `moveToken`'s same-step branch and `reorderSteps`
  (`src/state/document.ts`) hit-test the drop point against the *currently
  rendered, pre-removal* list to get a "drop-before" target index, then
  filter/splice the dragged item out and reinsert it at that same raw
  numeric index. Removing the dragged item shifts everything after its
  original position back by one, so reinserting at the unadjusted index
  lands one slot too far whenever the target sits after the source.
- **Fix:** both functions now compare the dragged item's original index to
  the target index before removing it, and decrement the target by one when
  the move is forward (target after source) - `moveToken`'s same-step
  branch via a `fromIndex`/`adjustedIndex` comparison, `reorderSteps` via an
  equivalent `adjustedToIndex`.
- **Verified by:** two dedicated Playwright regression checks
  (`FORWARD_TOKEN_DRAG_LANDS_AT_DROP_POINT`,
  `FORWARD_STEP_DRAG_LANDS_AT_DROP_POINT`) that drag an item forward into a
  slot strictly between two others (not just "to the very end," which
  happens to clamp to the same result either way and wouldn't have caught
  this) - confirmed both fail on the pre-fix code and pass after.
- **Found & fixed:** 2026-09-13 (via code review, `docs/phase-2/reviews/2026-09-13-1516-review.md`).
