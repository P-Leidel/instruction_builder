# Step management moved onto the canvas

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-15

A `/mattpocock-skills:grilling` session settled the shape of a UX rework:
step management (select, add, remove, reorder) moves off the standalone
`StepList` side panel and onto
[InstructionCanvas.tsx](../../../src/components/InstructionCanvas/InstructionCanvas.tsx)
itself, and `StepList` is deleted outright rather than kept alongside the
canvas controls.

## What shipped

- **`StepList.tsx` and its CSS are gone.** `app.tsx`'s left column now opens
  directly with `StepDetails`, which closes the gap that panel's removal
  left (`.app__col-left` is a plain flex column, so nothing else needed to
  move).
- **Each step card gained, inside the SVG:**
  - Its title (or "Untitled step"), next to the select badge - the one
    piece of information `StepList` surfaced that the canvas didn't already.
  - A left-edge control column (`STEP_CONTROLS_WIDTH`, a new fixed-width
    reservation in `lib/canvas-layout.ts`, exactly like `PADDING`) holding a
    drag-to-reorder handle and click-only move up/down buttons, stacked
    below the badge. The drag handle reuses the same `beginPointerDrag`/
    `dragGhost` pattern a token drag already used; its drop slot is resolved
    by a new `resolveStepDropIndex` in `lib/pointer-drag.ts`, ported directly
    from `StepList`'s own bounding-rect algorithm. The two are deliberately
    separate controls, not one overloaded element - `StepList`'s own drag
    lived on its *select* button with the up/down arrows as a distinct,
    click-only pair; the canvas's select control (the badge) already does
    something else, so reorder needed its own affordance rather than
    overloading the badge or the arrows.
  - A remove (×) button, top-right, matching the existing token chip
    remove button's visual language. Both the reorder controls and remove
    are hidden for the sole remaining step, the same rule `StepList` used
    (`steps.length > 1`) - state-layer `removeStepCore` still has no such
    guard itself, same as before; it's UI-only, same as `StepList` was.
  - A dashed "+ Add step" row, full card width, rendered inside the SVG
    just past the last step.
- **Follow-up (same day): the "Empty step" hint text removed.** A
  zero-token step's card initially kept the plain "Empty step" label it had
  before this rework, positioned below the reorder stack once the height
  floor (below) made room for it. Requested removed as visual clutter - the
  card now shows nothing there; an empty step's incompleteness is still
  conveyed everywhere else it already was (`model/validate.ts`'s
  `shouldFlagIncompleteStep` deliberately suppresses the persistent "!"
  badge for an untouched empty step regardless, and export's own warning
  toast still counts it). The `.instruction-canvas__hint` CSS rule was
  removed with it; the driver's JSON-export incomplete-count check (which
  had used that element's count as one of two signals) now counts each
  step's own `.instruction-canvas__token` children directly instead.
- **`canvas-layout.ts` grew a few fixed-position, document-independent
  constants** (`STEP_CONTROLS_WIDTH`, `STEP_CONTROL_CX/RADIUS`,
  `REORDER_HANDLE_CY`, `MOVE_UP_CY`, `MOVE_DOWN_CY`, `ADD_STEP_ROW_HEIGHT`)
  and one new `CanvasLayout` field, `addStepRowY`. An empty step's minimum
  height is now floored so its reorder stack always fits (previously
  `HEADER_HEIGHT + PADDING` was tall enough for just the "Empty step" hint).
  `totalHeight` deliberately keeps its old, tight meaning (no trailing gap)
  since the read-only/export canvas never draws the add-step row -
  `InstructionCanvas.tsx` adds `ADD_STEP_ROW_HEIGHT + PADDING` on top of
  `addStepRowY` itself, only when `!readOnly`, rather than `computeCanvasLayout`
  taking on a `readOnly` parameter it has no other reason to know about.

## Verification

- `npm run lint` / `typecheck` / `test` (128 tests, up from 126 - two new
  `canvas-layout.test.ts` cases covering the empty-step height floor and
  `addStepRowY`'s position) / `build` all pass cleanly. `svg-export.test.ts`'s
  `BAKED_STYLE_PROPS` guardrail caught a real gap: the disabled move
  button's `opacity` wasn't on the export style-baking allowlist - added.
- Full 44-check Playwright driver run against the dev server: all checks
  true/0/0. The driver itself needed a substantial rewrite - every
  `.step-list__*` selector became a canvas one (`.instruction-canvas__step-title`,
  `.instruction-canvas__step-remove`, `.instruction-canvas__step-move--up/--down`,
  `.instruction-canvas__step-drag-handle`, `.instruction-canvas__add-step`,
  `[data-step-index]` on the step's own `<g>`), consistently scoped through
  the existing `editableCanvas` locator (the hidden export canvas renders
  the same classes). The SVG-export and print-preview checks gained explicit
  assertions that none of the new step controls ever leak into a read-only
  render, alongside the existing chip-remove check.
- Read actual screenshots from that run, plus a cropped, zoomed-in
  Playwright script for the step controls specifically (title, reorder
  stack, remove button) since they're small at full-page screenshot scale.
- The hint-removal follow-up was re-verified the same way: `lint`/
  `typecheck`/`test` (128 tests, unchanged) / `build` all clean, a fresh
  44-check driver run all true/0/0, and a screenshot of an empty step
  confirming the card is blank where the hint used to be.

## What's next

See [README.md](./README.md) for Phase 3's overall status.
