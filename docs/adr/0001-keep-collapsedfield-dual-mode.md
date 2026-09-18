# ADR 0001 — Keep `CollapsedField`'s dual controlled/uncontrolled mode

> 📌 **Doc status: CURRENT** — a reference doc: it records a decision that
> stays accurate until the decision itself is revisited (at which point this
> file is edited or superseded, not frozen). See
> [../milestones.md](../milestones.md#documentation-status-conventions) for
> what CURRENT/HISTORICAL mean project-wide, and
> [README.md](./README.md) for the index of decisions recorded here.

**Status:** accepted, 2026-09-18.

## Context

[`CollapsedField<T>`](../../src/components/CollapsedField/CollapsedField.tsx)
is the collapsed/edit-toggle chrome shared by "+ Time" and "+ Quantity" -
one line showing a value with Edit/Remove, or an add button when unset, with
the edit form itself supplied as a render prop. It has two callers with
genuinely different needs:

- `TokenDetails`' `TimeAndQuantityRow` **controls** it. Token time and
  Quantity sit in one row and are mutually exclusive while editing, so
  something above both fields has to own "which one is open" - the row
  passes `editing`/`onEditingChange` down to each.
- `StepDetails`' `DurationField` does **not**. A step has exactly one time
  field and nothing to coordinate it with, so it uses the uncontrolled mode
  and lets the component hold its own open/closed state.

The 2026-09-18 codebase health review
([finding 3](../phase-3/audits/2026-09-18-architecture-review.html)) found
that the component wrote its local `uncontrolledEditing` state on every
toggle even while controlled, so it held two sources of truth held together
by an unstated invariant: that a controlled caller passes a non-`undefined`
boolean on *every* render. Both callers did, which is why nothing ever
broke. The report's own preferred fix was to remove the dual mode entirely.

## Decision

Keep both modes. Write local state only when `controlledEditing === undefined`,
so the two sources of truth can no longer both be live at once.

## Considered options

**Delete the uncontrolled mode.** Make `editing`/`onEditingChange` required
and give `StepDetails` its own `useState` to satisfy them. This removes the
class of bug rather than guarding against it, which is the stronger move in
the abstract - the review is right about that.

It was declined because of where the cost lands. `StepDetails` has no other
reason to hold that state: it would gain a `useState` purely to hand it
straight back to the component that already knows how to manage it, and
every future single-field caller would have to do the same. That trades one
guard clause inside the component for one piece of ceremony at every call
site that doesn't need coordination - the cost grows with the number of
callers, while the guard's cost is fixed. The uncontrolled mode is also the
honest default for this component: a collapsed field that nothing else
coordinates with genuinely does own whether it is open.

## Consequences

- The invariant is enforced by the component rather than by caller
  discipline, so a caller that passes `editing` conditionally now degrades
  to the uncontrolled mode instead of surfacing stale local state.
- Two modes still have to be understood by anyone reading the component.
  The guard clause and its comment are where that is explained; this ADR is
  why it wasn't simplified away.
- **Revisit if** a third or fourth *controlled* caller appears without a
  corresponding uncontrolled one. At that point the uncontrolled mode is
  carrying a single caller and deleting it stops costing anything.
