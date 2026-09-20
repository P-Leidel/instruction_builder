# ADR 0002 — Decline a shared no-op guard in `state/document.ts`

> 📌 **Doc status: CURRENT** — a reference doc: it records a decision that
> stays accurate until the decision itself is revisited (at which point this
> file is edited or superseded, not frozen). See
> [../milestones.md](../milestones.md#documentation-status-conventions) for
> what CURRENT/HISTORICAL mean project-wide, and
> [README.md](./README.md) for the index of decisions recorded here.

**Status:** accepted, 2026-09-18. **This one exists to stop a suggestion
from being re-raised**, not to justify something that was built.

## Context

[`state/document.ts`](../../src/state/document.ts) has three checks that all
serve the same *purpose* - "don't record undo history for a change that
changed nothing":

| Guard | Where | What it compares |
|---|---|---|
| `fieldValuesEqual` | `updateTokenIn`, `setStepTimeCore` | shallow key/value equality over a flat attachment object |
| `tokensEqual` | `moveTokenCore` | per-slot identity over an array whose elements are provably never cloned |
| `clamped === fromIndex` | `reorderStepsCore` | index arithmetic, not a comparison at all |

All three were added in one commit, so they read as three differently-named
helpers for one idea - the shape that usually means Duplicated Code. Two
successive architecture reviews have now raised consolidating them behind a
shared `noopGuard(current, next, isEqual)`: the 2026-09-17 pass raised it as
an open question, and the 2026-09-18 pass
([candidate 1](../phase-3/audits/2026-09-18-architecture-review.html))
answered it. Without something recording the answer, a third review will
raise it again.

## Decision

Do not build a shared guard. The three stay as they are, deliberately
different in shape.

## Why

They share a purpose, not a shape. A `noopGuard(current, next, isEqual)`
would take the comparator as a parameter - which is the only part that
actually differs between the three call sites - leaving the shared part as
`if (isEqual(a, b)) return;`. That is one line, hoisted behind an
indirection, with exactly one caller each: textbook Speculative Generality.
Applying the deletion test the other way round, deleting such a helper would
move one line back to three places rather than concentrating anything.

There is also a specific piece of reasoning that generalising would destroy.
`reorderStepsCore`'s comment argues that `clamped === fromIndex` is *a
precise stand-in for a full array-value-equality check, not an approximation
of one* - reinserting at the removal index reconstructs the original array
exactly. Turning that into "a comparator, like the other two" is exactly how
that argument gets deleted, and how the next person "simplifies" it into a
slower array comparison in the belief that they are fixing a shortcut.

## What was done instead

Nothing structural. `setSteps`' doc comment now names the convention in one
sentence, so the concept is visible at the funnel point every one of these
guards leads into, without an abstraction existing to hold it.

## Revisit if

A fourth no-op guard appears whose comparison is genuinely the *same shape*
as one of these three - not merely the same purpose. Three call sites each
supplying their own comparator is Speculative Generality; two call sites
sharing one comparator is ordinary de-duplication, and that is a different
question from this one.

## Update, 2026-09-20 - the revisit clause fired, and the decision held

The 2026-09-20 architecture review's
[candidate 3](../phase-3/audits/2026-09-20-architecture-review.html#c3)
found that `setTokenTime` needed exactly the comparison `attachToToken`
already had - the same flat-object shape, not merely the same purpose - and
had shipped without it, so an unchanged Save on Token time recorded an undo
entry and wiped redo. `setStepTime` had the same gap. That is the
"two call sites sharing one comparator" the clause above sets aside as
ordinary de-duplication, so the comparator was broadened from
`attachmentsEqual` to `fieldValuesEqual` and the table row updated.

**The decision itself is unchanged.** There is still no
`noopGuard(current, next, isEqual)`. What was built is a *traversal* -
`updateTokenIn` - that happens to own one comparison of its own; the
comparison is not a parameter, and no call site supplies one. `tokensEqual`
and `reorderStepsCore`'s `clamped === fromIndex`, the two guards whose
shapes genuinely differ and which this ADR exists to protect, were not
touched. `setStepTimeCore` calls the comparator directly rather than
inheriting it from a step-level seam, precisely because hoisting its
one-line `steps.map` behind an indirection is the move this ADR declines.
