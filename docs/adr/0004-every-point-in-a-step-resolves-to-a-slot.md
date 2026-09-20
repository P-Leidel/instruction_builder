# ADR 0004 — Every point inside a step resolves to a drop slot

> 📌 **Doc status: CURRENT** — a reference doc: it records a decision that
> stays accurate until the decision itself is revisited (at which point this
> file is edited or superseded, not frozen). See
> [../milestones.md](../milestones.md#documentation-status-conventions) for
> what CURRENT/HISTORICAL mean project-wide, and
> [README.md](./README.md) for the index of decisions recorded here.

**Status:** accepted, 2026-09-20.

## Context

Drop resolution used to be a DOM hit-test: `elementFromPoint` looked for a
chip's rendered `<g>` under the pointer. A step card is mostly *not* chips,
though — there is a header band above the first row, a `CHIP_GAP` between
every pair of chips, and padding below the last row — and over all of it the
hit-test found nothing. "Nothing" fell through to "append to the end of the
step", so dropping a token into the visible gap *between* two chips, which
is the most natural way to express "put it here", silently sent it to the
end instead. That was the defect the 2026-09-20 drop-accuracy pass fixed
(see
[token-drop-accuracy.md](../phase-3/progress/token-drop-accuracy.md)), and
candidate 1 then moved the fixed resolver off the DOM entirely (see
[architecture-2026-09-20-layout-hit-testing.md](../phase-3/progress/architecture-2026-09-20-layout-hit-testing.md)).

What replaced it is a midpoint scan with no dead zones: `nearestRow` clamps
the pointer's y to the nearest row of chips by distance to that row's own
vertical span, and the scan then compares x against each chip's horizontal
midpoint. The consequence is that there is deliberately no "the pointer is
outside the chips entirely" case *within a step*.

## Decision

Within a step card, every point resolves to a specific drop slot. There are
no dead zones and no null-within-a-step. The only "this drop means nothing"
case is a point outside every step card, which `resolveDropTarget` handles
before any of this is reached.

## Why: one uniform rule beat carving out special cases

The alternative that was weighed is to treat the bands around the chips —
the header, and the padding below the last row — as "no slot", the way the
old hit-test effectively did.

It was declined for two reasons. First, it reintroduces the shape of the bug
that started this: a release over a large, visually meaningful part of the
card would do nothing at all, and "nothing happened" is exactly the failure
users reported as *unresponsive* drag-and-drop. Second, it would put two
different rules on two points a few pixels apart vertically — the bottom of
the header band and the top of row 0 — with nothing on screen marking the
boundary.

The accepted cost is that the far left of the header band clamps to row 0
and so reads as *insert at front*, not append. That is a real surprise if
you reason about it statically. It is not a surprise in use, because the
live insertion marker draws the resolved slot before the user releases:
the preview and the drop come from the same call, so what you see is what
you get.

## Consequences

- Every point in a step previews something, which is what makes the marker
  trustworthy enough to carry the decision above.
- The safety net is the preview, not the rule. A caller that produces a slot
  *without* showing one is relying on a rule it cannot justify.
- **Revisit when** a drop path appears that commits a slot with no live
  preview — the keyboard token-move path is the obvious candidate, and
  `ChipSlot` is now producible from a layout with no pointer involved, so
  that path is newly cheap to build. At that point "every point resolves to
  something" stops being self-correcting and should be re-argued on its own
  merits rather than inherited from here.
