# Architecture: extract `SvgButton`

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

Candidate #1 ("One SVG-button interface, five [really six] copies deleted")
from the 2026-09-15 canvas-followup architecture review (see
[phase-3/audits/2026-09-15-canvas-followup-review.html](../audits/2026-09-15-canvas-followup-review.html)),
picked up now - while real users are still manually testing the app
(task 30) - specifically because it's a pure, behavior-preserving
refactor with zero UI-visible change, unlike the mobile-layout fix also
on the table (see
[known-issues.md](../../known-issues.md#mobile-layout-order-buries-the-canvas-below-an-empty-token-details-placeholder)),
which was deliberately left for a later pass so it doesn't change what
testers see mid-session. A `/mattpocock-skills:grilling` session had
already settled the shape ahead of time, written up as an implementation
spec at `docs/liftoff-svgbutton.md` (now folded into this file and
deleted, per the doc-naming convention that one-off documents don't sit
loose in `docs/` root).

## What shipped

Six places in `InstructionCanvas.tsx` each hand-rolled an identical
keyboard-activatable SVG `<g role="button">` block (`tabindex`, `onClick`,
an `onKeyDown` checking Enter/Space) - the step select badge, step remove
(×), move step up/down, chip remove (×), and "+ Add step." They'd already
drifted (chip-remove double-called `stopPropagation`, the other five
didn't). All six are now `<SvgButton>`, a new component at
`src/components/InstructionCanvas/SvgButton.tsx` owning `disabled` (move
up/down no longer duplicate each other's tabindex/aria-disabled guard
logic) and `stopPropagation` (chip-remove's own
`onPointerDown={(event) => event.stopPropagation()}`, which suppresses a
different interaction - drag-start - than the one `SvgButton` owns,
stays as a small wrapping `<g>` around its circle/text content rather
than folding into the interface itself). `ariaCurrent` and `transform`
are one-off props for the step badge and "+ Add step" respectively, the
only two call sites that needed something extra.

## Tests

No new test file or testing dependency - this codebase has zero
component-level render tests (all UI behavior is verified through the
Playwright driver against the real dev server). Instead,
`.claude/skills/run-instruction-builder/driver.mjs` was extended: it
already exercised all six real call sites end-to-end and already
pressed Enter/Space on move-up/move-down; four more spots (step badge
select, chip remove, step remove, "+ Add step" - previously exercised
only via `.click()`) now go through `.focus()` + `.press("Enter"/" ")`
instead, closing the keyboard-coverage gap with the existing tool rather
than new tooling. Since activation is identical either way (`SvgButton`'s
`onClick` and `onKeyDown` both call the same `activate()`), converting an
existing click to a key-press changes nothing about the resulting
document state, so no other assertions needed to change.

## Verification

- `npm run lint` / `npm run typecheck` / `npm test` (131 tests, unchanged
  - this was a component-only change with no `lib`/`state` logic touched)
  / `npm run build` all clean.
- Full Playwright driver run against the dev server: all 46 checks
  `true`/`0`/`0`, identical to the pre-refactor baseline, including the
  four new keyboard-activation spots.
- Screenshots read directly to confirm no visual regression - badge,
  step remove ×, move up/down, chip remove ×, and the "+ Add step" row
  all render identically to before.

## What's next

The 2026-09-15 review's other candidate - splitting `<StepCard>`/
`<TokenChip>` out of `InstructionCanvas.tsx`'s render tree - remains
unexplored. See [README.md](./README.md) for Phase 3's overall status.
