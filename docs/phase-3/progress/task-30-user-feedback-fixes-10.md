# Task 30: tenth user feedback pass

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

A same-day follow-up to the
[ninth feedback pass](./task-30-user-feedback-fixes-9.md).

## What was reported

"For visual clarity, StepDetails and TokenDetails should have the same
border as a selected step: if a token is selected there should be a border
around TokenDetails, and when a step is selected (with no token also
selected) there should only be a border around StepDetails. The border
should match the same thickness and color as the one highlighting steps in
the canvas."

## What shipped

`StepDetails` and `TokenDetails` (`src/components/StepDetails/`,
`src/components/TokenDetails/`) each conditionally render a `--selected`
modifier class on their outer panel:

- `StepDetails` adds `.step-details--selected` whenever a step is selected
  *and* no token is also selected (`!selectedTokenId.value`) - so the
  border moves off StepDetails the moment a token within it is selected.
- `TokenDetails` adds `.token-details--selected` unconditionally on its one
  "editing" render branch, since that branch itself only ever renders once
  a token is selected (`selectedStep.value && selectedToken.value`) - there
  is no case where this panel renders that content without a token
  selected.

The two are mutually exclusive by construction: exactly one of the two
panels carries the selected border at a time, matching the request's
"only" wording.

`src/styles/global.css` gives both classes `border-color: var(--color-
accent)`, deliberately matching `.instruction-canvas__step-bg--selected`'s
own `stroke: var(--color-accent)` - and leaves `border-width` alone, since
the panels' existing base border (`.step-details, .token-details { border:
1px solid var(--color-border); }`) is already 1px, the same as the
canvas's own selected-step stroke (`.instruction-canvas__step-bg--selected`
doesn't override its base `stroke-width: 1`) - so "same thickness" needed
no extra rule, only the color swap.

No `CONTEXT.md` changes - this is a presentation-only change to existing,
already-named concepts (the selected step/token), not a new domain term or
model change, so `domain-modeling` wasn't invoked for this pass.

## Verification

- `npm run lint`, `npx tsc -b`, `npm test` (141 tests, unchanged - a pure
  CSS/class-name change with no new branchable logic), and `npm run build`
  all pass cleanly.
- A live Playwright check against the dev server: selected a step with no
  token selected and read back `.step-details`'s and `.token-details`'s
  computed `border-top-color`/`border-top-width` - confirmed StepDetails
  carried the accent color at 1px and TokenDetails still carried the
  default border color. Selected a token within that step and repeated the
  same read - confirmed the border flipped to TokenDetails and off
  StepDetails, and both matched `.instruction-canvas__step-bg--selected`'s
  own computed `stroke`/`stroke-width` (`rgb(75, 102, 242)` at `1px`)
  exactly. Also confirmed via class-list checks that `step-details
  --selected`/`token-details--selected` toggle correctly in both states.

## What's next

See [README.md](./README.md) for Phase 3's overall status - task 30 (Test
Real Users) continues as more feedback comes in.
