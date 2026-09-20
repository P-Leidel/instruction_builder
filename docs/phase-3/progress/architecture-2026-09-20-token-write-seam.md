# One token-write seam behind the five mutators

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

**Date:** 2026-09-20
**Source:** [2026-09-20 architecture review](../audits/2026-09-20-architecture-review.html), candidate 3
**Scope:** [`src/state/document.ts`](../../../src/state/document.ts), [`src/state/document.test.ts`](../../../src/state/document.test.ts), [`docs/adr/0002-no-shared-no-op-guard.md`](../../adr/0002-no-shared-no-op-guard.md)

Follows [the selection-repair funnel](./architecture-2026-09-20-selection-repair-funnel.md)
(candidate 2) at the same file and the same funnel point.

## What changed

Five mutators hand-wrote the identical step-then-token traversal
(`steps.map` → `id === stepId` → `tokens.map` → `id === tokenId` → spread).
They now call one private seam:

```ts
updateTokenIn(session, stepId, tokenId, patch, options?)
```

`patch` is merged onto the token; `null` removes it instead. `options` goes
straight through to `setSteps`, so a free-text caller passes
`{ coalesce: true }` exactly as it did before.

| Mutator | Before | After |
| --- | --- | --- |
| `setTokenAttachment` | traversal + `attachmentsEqual` guard | `updateTokenIn(…, { [kind]: attachment })` |
| `updateTokenLabelCore` | traversal, no guard | `updateTokenIn(…, { label }, { coalesce: true })` |
| `updateTokenNoteCore` | traversal, no guard | `updateTokenIn(…, { note }, { coalesce: true })` |
| `setTokenTimeCore` | traversal, **no guard — the copy that drifted** | `updateTokenIn(…, { time })` |
| `removeTokenFromStepCore` | traversal with `tokens.filter` | `updateTokenIn(…, null)` |

Two properties that used to be per-mutator are now properties of the seam:

1. **A patch that changes nothing writes nothing.** No `setSteps`, so no
   history entry and no redo wipe.
2. **A write naming a step or token the document doesn't hold does nothing**,
   rather than rebuilding an identical steps array and recording it.

## The drift was real, and there was more of it

Unlike candidate 2, whose claimed symptom did not reproduce, this one does.
Probed at `c68c80d` before any change, by re-saving a value identical to the
one already stored:

| Probe | `past` length | Verdict |
| --- | --- | --- |
| Token time, unchanged Save | 2 → 3 | **records an empty undo entry** — as the review said |
| Step time, unchanged Save | 1 → 2 | **same bug, not named by the review** |
| Quantity attachment, re-save | 2 → 2 | correctly guarded |
| `removeTokenFromStep`, unknown token id | 0 → 1 | **records a change that didn't happen** |

This is user-reachable, not theoretical: `DurationForm` re-seeds its draft
from `value.seconds` on every open and rebuilds the attachment on Save, so an
unchanged Save is never identity-equal to what is already on the token.
Opening Token time and pressing Save without touching a field pushed an undo
entry and wiped any redo stack.

`setStepTime` is outside candidate 3's token-only scope but had the identical
gap, one level up — same `DurationField`, same form, same symptom. Fixing
only the token side would have closed one drift by leaving its twin in place,
so it got the guard too.

## Why `setStepTimeCore` guards by hand instead of getting its own seam

The step-level traversal is a single `steps.map`, not the nested one
`updateTokenIn` exists to hold. Hoisting one line behind an indirection is
exactly what [ADR 0002](../../adr/0002-no-shared-no-op-guard.md) declined, so
`setStepTimeCore` calls the comparator directly and no `updateStepIn` was
built.

## ADR 0002 — the revisit clause fired, and the decision held

ADR 0002 declined a shared `noopGuard(current, next, isEqual)`, and set a
revisit condition: *"two call sites sharing one comparator is ordinary
de-duplication, and that is a different question from this one."* That is
precisely this case — `setTokenTime` and `setStepTime` needed the same
flat-object comparison `attachToToken` already had.

So `attachmentsEqual` was broadened to `fieldValuesEqual` and the ADR's table
row updated. The decision itself is untouched: there is still no
comparator-taking helper, `updateTokenIn` is a *traversal* that owns one
comparison rather than accepting one as a parameter, and `tokensEqual` and
`reorderStepsCore`'s `clamped === fromIndex` — the two guards ADR 0002 exists
to protect — were not touched. The ADR carries a dated update saying so.

## Behaviour changes

All three are fixes, but they are behaviour changes and not pure
restructuring:

- Re-saving an unchanged **Token time** or **Step time** no longer records
  history or wipes redo.
- `updateTokenLabel`/`updateTokenNote` gain a no-op guard they never had.
  Effectively inert in the app — `onInput` only fires on a real change — but
  it means no future token field can be added without one.
- A token write naming a missing step or token id no longer records history.

## Verification

- `npx tsc -b`, `npx eslint .`, `npm run build` — all clean.
- `npx vitest run` — 194 passing (was 186; 8 added).
- Eight tests added under `token writes through updateTokenIn`: unchanged
  token-time re-save, unchanged step-time re-save, clearing an already-unset
  time at both levels, re-writing an identical label/note, an unknown token
  id, an unknown step id, single-field patching that leaves the rest of the
  token intact, and identity-preservation of untouched steps.
- Mutation-checked, three separate mutations:

  | Mutation | Tests failed |
  | --- | --- |
  | `updateTokenIn`'s equality guard removed | 5 |
  | `updateTokenIn`'s missing-token early return removed | 2 |
  | `setStepTimeCore`'s guard removed | 2 |

## Not touched

- **`updateStepTitleCore` / `updateStepDescriptionCore`** still write through
  their own one-line `steps.map`. See the section above — that is deliberate,
  not an oversight.
- **`addTokenToStepCore` / `moveTokenCore`** operate on the token *list*
  (insert, reorder), not on one token's fields, so neither fits the seam's
  shape and both were left alone.
- **Cross-step drag deselects the token it moved.** Still true, still listed
  in [known-issues.md](../../known-issues.md) — untouched by this work.
