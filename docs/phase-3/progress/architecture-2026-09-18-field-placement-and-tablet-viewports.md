# Architecture: 2026-09-18 field placement seam, and two tablet viewports

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-18

A whole-codebase health review ran against `48fa437`, checking the six
preceding remediation commits for regressions (none found) and then
re-examining the whole tree. It produced fourteen new findings and
re-graded every issue already tracked in
[known-issues.md](../../known-issues.md) on the same severity scale, so the
two lists can be read together. The report is archived verbatim at
[docs/phase-3/audits/2026-09-18-architecture-review.html](../audits/2026-09-18-architecture-review.html).

Its own recommended order put two things before the tablet testing round
that task 30 is about to start: teach the Playwright driver the viewport
band between phone and desktop (finding 11), and give field placement a
real seam outside the component (candidate 3, closing findings 3, 6 and 8
together). Both were picked. A `/mattpocock-skills:grill-me` session
settled the shape across five rounds and nineteen questions before any
code changed - including two places where the report's own framing was
corrected, and two where a fix was deliberately declined.

## What shipped

Four commits, sequenced so the tablet viewports land *before* the
placement change. That order is the whole point: it is the only way to
tell a pre-existing 768px problem apart from one this change introduced.
The baseline came back clean at both viewports, so nothing needed logging.

- **`CollapsedField` no longer writes local state while controlled**
  (finding 3). `setEditing` now guards its `setUncontrolledEditing` call
  behind `controlledEditing === undefined`. The drift was harmless today
  only because `controlledEditing ?? uncontrolledEditing` always found a
  real boolean to mask it with; the moment a caller passes `editing`
  conditionally, the stale `true` becomes visible. The considered
  alternative - deleting the uncontrolled mode outright and giving
  `StepDetails` its own `useState` - was deferred rather than rejected,
  and is recorded as a comment at the guard so the reasoning survives.
- **The driver drives both tablet viewports** (finding 11). A new
  `measureViewport` helper screenshots, axe-scans, and overflow-checks the
  app at 768×1024 and 1024×768, then restores 390×844 so nothing
  downstream sees a different app. It also asserts the layout actually
  switches across the pair (`flex` in portrait, `grid` in landscape),
  which is the single most consequential fact about this app on a tablet.
  Scope matches the existing 390px mobile pass - screenshot, axe,
  overflow, active layout - rather than replaying all 56 checks at three
  widths, which would mean restructuring the driver into a parameterised
  run.
- **`lib/field-placement.ts`, a new pure module** (findings 6 and 8).
  `resolveFieldPlacement({ anchor, popover, viewport })` returns
  `{ horizontal: "left" | "right", vertical: "below" | "above" }` and
  nothing else - no DOM, no side effects, no CSS. `FieldPopover.tsx`
  reads its result and toggles two modifier classes; CSS still owns the
  actual position. The extraction also *adds* behaviour the popover never
  had: a vertical flip (there was no flip-up code at all before), and
  re-placement on `resize`/`orientationchange`, which is exactly the case
  the tablet testers are asked about by name.
- **The Tab trap is gone** (finding 8). `FieldPopover` declared
  `aria-modal="false"` while cycling Tab back to its first control - a
  screen reader user was told they could leave and then prevented from
  doing so. With no backdrop and nothing inert, non-modal is the truthful
  description, so the trap went rather than modal machinery arriving.
  Returning focus to the trigger on close is now conditional on focus not
  having since moved elsewhere, tracked via `focusin`/`focusout` because
  `document.activeElement` may already be `<body>` by the time the
  effect's cleanup runs.

## Decisions worth keeping

- **The seam exists for testability, not reuse.** `FieldPopover` is the
  only caller of `resolveFieldPlacement` and will stay the only caller, so
  by the usual rule this is a hypothetical seam, not a real one. It was
  extracted anyway on two grounds, both recorded in the module's own doc
  comment: the deletion test passes (the arithmetic is the whole
  behaviour, not a pass-through), and `vitest.config.ts` is
  `environment: "node"` with `include: ["src/**/*.test.ts"]`, so nothing
  under `src/components/` is reachable from any runnable test. Extracting
  the maths is the only way to test it without the deferred Vite major
  upgrade that a DOM environment would force - which is itself one of the
  dev-only advisories tracked in known-issues.md.
- **The report's horizontal framing was wrong, and was corrected.**
  `max-width: calc(100vw - 2rem)` already capped the panel, and the
  existing flip's `right: 0` is anchor-relative, so a right-flipped panel
  was on-screen by construction. The real gap was vertical.
- **The ~6.4px trigger gap is deliberately not modelled.** It applies
  equally above and below, so it cannot change which side wins, and
  modelling it would create a second constant that has to stay in step
  with a CSS value.
- **`visualViewport` tracking was cut, and autofocus left alone.**
  `window.innerHeight` does not shrink for the iOS software keyboard, so
  both would be code written against unobserved mobile behaviour.
  Confirming either needs a real device, which is what the tablet round is
  for.

## Verification

- `npm run lint` / `typecheck` / `test` (161 tests across 13 files, up
  from 155 - six new `field-placement.test.ts` cases covering fits-below,
  the horizontal flip, the vertical flip, neither-side-fits, both axes at
  once, and the exact-gutter boundary on each axis) / `build` all pass
  cleanly.
- Full Playwright driver run: `NO_HORIZONTAL_OVERFLOW_AT_TABLET_PORTRAIT`,
  `NO_HORIZONTAL_OVERFLOW_AT_TABLET_LANDSCAPE`,
  `LAYOUT_SWITCHES_ACROSS_TABLET_ORIENTATIONS` and
  `FIELD_POPOVER_STAYS_INSIDE_VIEWPORT` all true, all three axe counts
  zero, `CONSOLE_ERRORS_COUNT=0`, and no other check false.
- **The tablet overflow assertion had a bug on its first run, and it was
  mine, not the app's.** It reported `-15`, not a positive overflow:
  `html { scrollbar-gutter: stable }` is scoped to the `min-width: 800px`
  block and reserves 15px unconditionally, so `scrollWidth` is *smaller*
  than `clientWidth` above the breakpoint. The mobile pass's `=== 0` test
  is correct at 390px and wrong at 1024px; both tablet assertions use
  `<= 0` with a comment explaining why. Fixed before the commit landed.
- **The new popover assertion was mutation-tested** rather than assumed to
  have teeth: forcing `vertical: "below"` made it report
  `false (portrait: false, landscape: false)`; reverting restored true. It
  asserts its own precondition (that the trigger really had no room
  beneath it), so it cannot pass just because a page happened to be short.

## What's next

Eleven of the fourteen findings remain, plus two documentation
corrections and two ADRs worth writing; all are tracked in
[known-issues.md](../../known-issues.md#documentation-debt-from-the-2026-09-18-codebase-health-review)
rather than living only inside the report's HTML. See
[README.md](./README.md) for Phase 3's overall status.
