# Moving a token to a step that no longer exists destroyed the token

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** `moveToken` removed a token from its source step and never
  re-inserted it anywhere when `toStepId` named a step the document did not
  hold. The token was gone from the document entirely, and because the
  removal ran through `setSteps`, the destruction was recorded as an
  ordinary undo entry and wiped the redo stack along with it. Undo brought
  the token back, so the data was recoverable - but only for a user who
  noticed, and only until the next edit.
- **Root cause:** `moveTokenCore` (`src/state/document.ts`) validated the
  *source* and not the *destination*. Its `steps.map` has one branch that
  filters the token out of `fromStepId` and a separate branch that inserts
  it into `toStepId`; an unmatched destination ran the first branch without
  the second. The no-op guard that would otherwise have caught the
  resulting document did not apply either: `tokensEqual` is only consulted
  when `fromStepId === toStepId`, because a move between two different
  steps was assumed to always be a real change.
- **How it was reachable:** both step ids arrive from a drop target that was
  resolved *during* the drag, not from a read of the document at the moment
  the drop commits. Anything that replaces the step list mid-drag - an undo
  from the keyboard, a document import, a persisted document restoring -
  leaves the pending drop naming a step that has since gone.
- **Fix:** `moveTokenCore` now checks `toStepId` against the document before
  writing anything, which is the property `updateTokenIn` already states for
  its own traversal: a write naming a step or token the document doesn't
  hold does nothing, rather than rebuilding a steps array and recording it.
  `addTokenToStepCore` was given the same guard in the same pass. One of its
  two callers is that same drop-target seam, in `TokenPicker`, and carries
  the identical hole - with a milder consequence, since its `steps.map`
  simply matches nothing, so the damage is a spurious undo entry and a wiped
  redo stack rather than a lost token. Its other caller is the tap-to-insert
  and paste path, which passes the *selected* step id; `repairSelection`
  already keeps that pointing at a live step, so on that path the guard is
  redundant rather than load-bearing.
- **Verified by:** three unit tests in `src/state/document.test.ts` - an
  unknown destination leaving the document identical by reference and the
  token still in place, an unknown source doing the same (already correct,
  now pinned), and an unknown step id for `addTokenToStep`. Mutation-checked
  three ways: removing the destination guard, pointing it at `fromStepId`
  instead of `toStepId`, and removing the `addTokenToStep` guard each failed
  exactly one of the three.
- **Found & fixed:** 2026-09-20, while reviewing the drop path during the
  [layout hit-testing work](../phase-3/progress/architecture-2026-09-20-layout-hit-testing.md).
