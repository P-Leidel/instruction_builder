# ADR 0005 — The viewport guard applies to token drops, not to step reorders

> 📌 **Doc status: CURRENT** — a reference doc: it records a decision that
> stays accurate until the decision itself is revisited (at which point this
> file is edited or superseded, not frozen). See
> [../milestones.md](../milestones.md#documentation-status-conventions) for
> what CURRENT/HISTORICAL mean project-wide, and
> [README.md](./README.md) for the index of decisions recorded here.

**Status:** accepted, 2026-09-20.

## Context

`resolveLiveDropTarget` and `resolveLiveStepDropIndex`
([src/state/canvas.ts](../../src/state/canvas.ts)) are the two live drag
resolvers, and they are the same composition: find the mounted canvas,
convert the client point into canvas units, resolve against the same
`liveLayout` the canvas was rendered from. They differ by exactly one line.
The token-drop one rejects points outside the canvas's visible viewport
first:

```ts
if (!isInsideViewport(canvas.viewport, clientX, clientY)) return null;
```

That check is not decoration. `resolveDropTarget` rejects the canvas's own
left and right padding, but it cannot know that at the mobile breakpoint the
`<svg>` is wider than the card holding it — so a client point over the page
background *beside* the card still converts to a canvas point comfortably
inside a step. Before drop resolution left the DOM, `elementFromPoint`
rejected those points for free, by finding nothing there. The explicit check
is what replaced that (see
[known-issues.md](../known-issues.md) and
[architecture-2026-09-20-layout-hit-testing.md](../phase-3/progress/architecture-2026-09-20-layout-hit-testing.md)).

The step-reorder resolver deliberately does not have it.

## Decision

Keep the asymmetry. A token drag is rejected when the pointer is somewhere
the canvas cannot be seen; a step reorder is not.

## Why: the two drags are not the same shape

A step reorder is a drag along a vertical list, and it has always been
horizontally indifferent — the DOM version this replaced took a `clientY`
and nothing else, with no x in the signature at all. A handle released wide
of the card still drops the step at the row it was level with, which is what
users who overshoot sideways already expect.

Applying the check uniformly, for symmetry, was the alternative. It was
declined because it would be a behaviour change in its own right rather than
a fix: it would make a reorder fail in the one direction users are most
likely to overshoot, in exchange for consistency between two operations that
differ in dimensionality. Symmetry between a two-dimensional drop and a
one-dimensional reorder is not itself a virtue.

## Consequences

- Two near-identical functions differ by one line, which reads as an
  oversight to anyone meeting them in sequence. That is the whole reason
  this is recorded here rather than left as a code comment.
- A step reorder can be committed from a pointer position over the page
  background, which is intended.
- **Revisit when** the step-reorder drag gains a live insertion marker of
  its own — still an open gap in
  [known-issues.md](../known-issues.md). Once a reorder previews where it
  will land, a release far outside the canvas would be previewing something
  at the edge of the screen, and "horizontally indifferent" stops being
  obviously right.
