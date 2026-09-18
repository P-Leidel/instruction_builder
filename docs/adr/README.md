# Architecture Decision Records

> 📌 **Doc status: CURRENT** — living index. Add a row the moment a new ADR
> lands; see [../milestones.md](../milestones.md#documentation-status-conventions)
> for what CURRENT/HISTORICAL mean project-wide.

Decisions that were **deliberately made and are worth not re-litigating** -
particularly the ones where the obvious-looking move was declined. Started
2026-09-18, on the 2026-09-18 codebase health review's own recommendation
([candidate 1](../phase-3/audits/2026-09-18-architecture-review.html)), after
the same consolidation suggestion was raised by two successive reviews with
nothing in `docs/` recording the answer.

This folder is the counterpart to the other three decision logs, and the
distinction matters when deciding where something belongs:

| Folder / doc | Holds |
|---|---|
| **`adr/`** (here) | A decision, with its alternatives and its reasoning. Includes decisions *not* to do something. |
| [`../fixed-issues/`](../fixed-issues/README.md) | A real defect that shipped (or was caught mid-session) and how it was fixed. Not a design decision. |
| [`../known-issues.md`](../known-issues.md) | An issue found and deliberately left unfixed, with a revisit trigger. |
| [`../planned-additions.md`](../planned-additions.md) | An idea discussed but not built. |

An ADR earns its place when all three are true: the decision is meaningfully
hard to reverse, a future reader would otherwise wonder "why on earth is it
like this", and there was a genuine alternative that was weighed and
declined. If any of those is missing, a code comment is enough.

Numbering is sequential and never reused. Each entry is banner-marked
📌 CURRENT rather than 🗄️ HISTORICAL: an ADR is a reference doc that stays
accurate until the decision itself changes, at which point it is edited or
superseded by a later ADR - unlike a phase's progress log, which is frozen
on a date and stops being touched.

| # | Decision | Recorded |
|---|---|---|
| [0001](./0001-keep-collapsedfield-dual-mode.md) | Keep `CollapsedField`'s dual controlled/uncontrolled mode, guarded, rather than deleting the uncontrolled half | 2026-09-18 |
| [0002](./0002-no-shared-no-op-guard.md) | Decline a shared no-op guard behind `state/document.ts`'s three history guards | 2026-09-18 |
| [0003](./0003-no-component-test-environment.md) | No DOM test environment; `src/components/` is covered by the Playwright driver, and testable logic moves to `src/lib/` instead | 2026-09-18 |
