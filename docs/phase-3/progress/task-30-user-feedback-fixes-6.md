# Task 30: sixth user feedback pass

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

A same-day follow-up to the
[fifth feedback pass](./task-30-user-feedback-fixes-5.md), on `StepDetails`'
"Tokens in this step" list. Settled via `/mattpocock-skills:grill-me` (one
round, six questions) before any code changed.

## What was reported

**"The 'tokens in this step' section in StepDetails is bad - live adding
tokens to it moves down Token details."** `StepDetails.tsx` and
`TokenDetails.tsx` stack in the same right-hand column (`app.tsx`); the
token list is a plain, always-expanded `<ul>` between the step's Title/
Details/Time fields and that list, so every token added to the step grows
the list and visibly pushes `TokenDetails` further down the page. Its own
existing doc comment already notes the list is kept around *solely* as an
accessibility affordance - a keyboard-only path to select a token, since the
canvas's SVG chips are pointer/touch-only. **Proposed solution: make it
collapsible.**

## What shipped

The list now sits inside a native `<details>`/`<summary>`
(`.step-details__tokens-disclosure`), collapsed by default - which directly
removes the reported problem, since a mouse/touch user never needs this list
open at all (the canvas already covers token selection for them). Decisions
made while grilling:

- **Native `<details>`, not a hand-rolled toggle.** The closest existing
  pattern in the codebase, `CollapsedField` (used by `DurationField` and
  `QuantityRow`), is a different shape - add/edit/remove chrome around a
  single value plus a popover form - not a plain expand/collapse-a-list
  disclosure, so it wasn't reused here. `<details>` gets keyboard
  operability (Enter/Space) and correct semantics for free, with no new
  state hook, fitting a section whose whole reason for existing is
  accessibility.
- **Collapsed by default**, with the summary reading
  `Tokens in this step (${count})` so the count stays visible even while
  collapsed.
- **Resets to collapsed on every step switch**, via `key={step.id}` on the
  `<details>` - the same remount-to-reset idiom `DurationField` already
  uses just above it in this file, so a step never inherits whatever
  open/closed state a previously selected step's disclosure happened to be
  left in.
- **Does not force itself open when a token in this step is selected.**
  Selection is already shown visually elsewhere (the canvas, and the
  `TokenDetails` panel it opens) - a keyboard user who wants this list just
  opens it themselves.
- **The zero-token empty state skips the disclosure chrome entirely** -
  there's nothing to hide, so `step.tokens.length === 0` still renders
  today's plain, always-visible "No tokens yet - add some from the panel on
  the right." text, not a toggle with nothing behind it.

## Verification

- `npm run lint` / `npm run typecheck` / `npm test` (131 tests, unchanged -
  a component-only change, no new `lib`/`state` logic) / `npm run build` all
  clean.
- Real-browser Playwright checks (a scratch script run against the dev
  server, deleted after use - not part of `driver.mjs`): the disclosure is
  entirely absent for an empty step; appears collapsed the instant a token
  is drag-added (confirmed `TokenDetails`'s own bounding box doesn't move
  until the disclosure is opened manually); the summary reads the correct
  count; manual open/close via the summary works; and switching away from a
  step and back resets its disclosure to collapsed even if it had been
  opened before the switch.

## What's next

See [README.md](./README.md) for Phase 3's overall status - task 30 (Test
Real Users) continues as more feedback comes in.
