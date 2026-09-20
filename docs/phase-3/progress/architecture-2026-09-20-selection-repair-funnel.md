# Selection repair moved into `setSteps`

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

**Date:** 2026-09-20
**Source:** [2026-09-20 architecture review](../audits/2026-09-20-architecture-review.html), candidate 2
**Scope:** [`src/state/document.ts`](../../../src/state/document.ts), [`src/state/document.test.ts`](../../../src/state/document.test.ts)

## What changed

"What happens to the selection when the document changes" was answered in
four different places with three different policies. It is now answered once,
in the funnel every steps mutation already passes through.

`setSteps` now re-resolves the selection via `repairSelection` immediately
after writing the new document, with both writes wrapped in `batch()` so no
subscriber can observe a new document next to a selection that has not been
re-resolved against it. Three call sites lost their own copy of the policy:

| Mutator | Before | After |
| --- | --- | --- |
| `removeStepCore` | `if (selectedStepId === stepId) selectStepCore(steps[0]?.id ?? null)` | no selection code |
| `removeTokenFromStepCore` | `if (selectedTokenId === tokenId) selectedTokenId = null` | no selection code |
| `moveTokenCore` | explicit `repairSelection(session, document.value)` after `setSteps` | no selection code |

`restoreDocument` (undo/redo) still calls `repairSelection` itself, because it
swaps the whole document without going through `setSteps`. That deviation is
unchanged and is documented on both functions.

`replaceDocumentCore` (import) also bypasses `setSteps` and still resets the
selection to the first step of the incoming document. That is a deliberate
policy, not a repair, and was left alone.

## The audit's "live symptom" did not reproduce

The review graded this candidate as having a user-reachable symptom: deleting
the selected step while one of its tokens was selected was said to leave
`selectedTokenId` stale, so `TokenDetails` and `StepDetails` would disagree
about whether a token was selected.

That does not happen at `c68c80d`. The review reads `removeStepCore:388` as
assigning `selectedStepId` directly; it actually calls `selectStepCore`, which
sets `selectedTokenId` to `null` as well. Probed directly before making any
change, deleting the selected step with one of its tokens selected left
`selectedTokenId === null` and the `selectedToken` computed at `null` — no
disagreement between the two panels.

So this landed as a structural change with no behaviour change, not as a bug
fix. Every case the three deleted guards covered is covered identically by
`repairSelection` on the same input; the value is that a future mutator
inherits the invariant instead of having to remember it.

## Verification

- `npx tsc -b`, `npx eslint .`, `npm run build` — all clean.
- `npx vitest run` — 186 passing (was 179; 7 added).
- Seven tests added under a new `selection repair through setSteps` block,
  covering removal of the selected step, removal of an unrelated step,
  removal of the last remaining step, removal of the selected token, removal
  of an unrelated token, an in-place edit that must *not* disturb the
  selection, and a back-to-back run of every selection-invalidating mutator.
- Mutation-checked: with the `repairSelection` call removed from `setSteps`
  (and left in place in `restoreDocument`), 6 tests fail — 4 of the new ones
  plus the existing `removeStep` and cross-step `moveToken` cases. The funnel
  is load-bearing for all of them.

## Not touched

- **Cross-step drag deselects the token it moved.** Still true, still listed
  in [known-issues.md](../../known-issues.md). `repairSelection`'s policy is
  unchanged by this work — only where it is called from changed — so that
  entry stands exactly as written.
- **Candidate 3** (one token-write seam behind the five mutators) touches the
  same file and the same funnel and is the natural next piece of work here,
  but was left out of this change to keep the selection invariant reviewable
  on its own.
